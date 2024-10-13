import isLayoutObj from "../private/isLayoutObj.js";
import VertexBuffer from "../buffer/vertexBuffer.js";
import GL from "../webglHandler/webglHandler.js";
import isDataStoreDescriptor from "../private/isDataStoreDescriptor.js";
import isGLObjectRef from "../private/isGLObjectRef.js";
import Layout from "./layout.js";


// kitfield jul 30 24
//

// TODO: are all of my Object.assigns really needed????
// size opt should be inputted on a dataset wide level...

// TODO: right now I am doing error checking with the actual copying of data. This makes the 
// api a bit more error prone as this will start copying data until a error occurs at which point the 
// api bricks meaning that we are in a half-functional state. 

const defaultInputs = {name: null , size: null, type: null, normalized: false}
const inputKeys = ["name", "size", "type", "normalized"]

const supportedIntTypes = ["short", "byte", "unsignedByte", 
    "unsignedShort", "int", "unsignedInt"];

const supportedFloatTypes = ["float", "halfFloat"];


class DataSet {

    #gl; // this is the webgl context
    #inputs = {};

    #usedInputs = [];

    #dataStores = [];

    #cachedLayouts = {};

    constructor(inputs, layout, gl, initialData = null){
        this.#gl = gl;

        inputs.forEach(el => {
            this.#checkInputs(el);
            
            let inputCopy = {};
            Object.assign(inputCopy, el);
            if(this.#inputs[inputCopy.name]){
                throw new Error("FAIL: input names must be unique within a dataset!");
            }
            this.#inputs[inputCopy.name] = inputCopy; // having the name attribute be in this object is a little redundant....
        });

        // first check that all inputs are used and are used uniquely before moving on to the actual allocation step.

        for(let el of layout){
            if(!(typeof el === "object") || !(el[isDataStoreDescriptor])){
                throw new Error("FAIL: Data set store descriptor must be made up of data descriptor objects such as VertexBuffer");
            }

            let vertexInputs = Object.keys(el.inputs);

            if(this.#inputIsAlreadyUsed(vertexInputs)){
                throw new Error("FAIL: Layout descriptor must include an input only once!");
            }
    
            if(!this.#isAValidInput(vertexInputs)){
                throw new Error("FAIL: Unknown input used in layout descriptor.");
            }
    

            this.#usedInputs.push(...vertexInputs);
        }

        if(this.#usedInputs.length !== Object.keys(this.#inputs).length){
            throw new Error("FAIL: Not all inputs were placed in layout.");
        }

        // if this check has passed, we move on to check if we have initial data, if so, we need to 
        // process the layout of this data before allocating.


        if(initialData){

            if(!initialData.data || !initialData.layout){
                throw new Error("FAIL: initialData must be an object with 'data' and 'layout' properties.");
            }

            let [initialDataDataSource, initialDataLayout] = this.#determineDataSource(initialData.data, initialData.layout);
            initialDataLayout = this.#processLayoutInput(initialData.layout, initialData.opts);
            initialData.layout = initialDataLayout;
            initialData.source = initialDataDataSource;

        }

        // now we can finally allocate

        for(let el of layout){
            switch(el.type){
                case "VertexBuffer":
                    this.#addVertexBuffer(el.inputs, el.atoms, initialData , el.opts);
                    break;
                default:
                    break;
            }
        }
    }

    // checks that we have all the info needed to build the correct opengl calls
    #checkInputs({name = null , size = null, type = null, normalized = false} = defaultInputs){
        
        if(!name || !size || !type){
            throw new Error(`FAIL: Required constructor arguments for DataSet were not provided. 
                             Required arguments are name, size, and type`);
        }

        if(!(size > 0 && size < 5)){
            throw new Error(`FAIL: size has to be 1,2,3, or 4`);
        }

        if(typeof type !== "string"){
            throw new Error("FAIL: type descriptor must be string!");
        }

        if(typeof name !== 'string' && typeof name !== 'symbol'){
            throw new Error("FAIL: name must be of type String or Symbol");
        }

        let isFloat = supportedFloatTypes.includes(type);

        if(!isFloat){
            
            if(!supportedIntTypes.includes(type)){
                throw new Error(`FAIL: provided type '${type}' is not supported by Pika. Supported types are: FILL IN`); //TODO: fill in
            
            }
        }

        if(isFloat && normalized){
            console.warn("WARNING: normalizing was set on a float input, this has no effect!");
        }

        return true

    }

    #inputIsAlreadyUsed(inputs){

        for(let input of inputs){
            if(this.#usedInputs.includes(input)){
                return true;
            }
        }

        return false;
    }

    #isAValidInput(inputs){
        for(let input of inputs){
            if(!this.#inputs[input]){
                return false;
            }
        }

        return true;
    }

    #addVertexBuffer(vbInputs, vbAtoms, initialData, opts){
        this.#dataStores.push(new VertexBuffer(vbAtoms, this.#inputs, this.#gl, initialData ,opts));
    }

    // need to figure out generalizations of append/prepend for multi dim data.

    appendData(data, layoutDesc, opts){

        // check arguments.....
        if(!(layoutDesc instanceof Array)){
            if(typeof layoutDesc === 'object' && opts == null){
                opts = layoutDesc;
                layoutDesc = null;
            }else{
                throw new Error("FAIL: appendData was called with an invalid argument signature");
            }
        }else{
            if(typeof opts !== 'object'){
                throw new Error("FAIL: appendData was called with an invalid argument signature");
            }else{
                opts = opts || {};
            }
        }

        let dataSource;
        [dataSource, layoutDesc] = this.#determineDataSource(data, layoutDesc);

        let layout = this.#processLayoutInput(layoutDesc, opts);

        let effects = this.#dataStores.map(el => el.sizeAppend(dataSource, layout, data, opts));

        // do processing on number of points here!

        effects.forEach(el => el.doAppend());

        return effects.map(el => el.pointsAdded); // TODO: or something similar, way to pass info on how the dataSets have changed...
        

    }


    prependData(data, layoutDesc){

    

    }

    #determineDataSource(data, layoutDesc){

        if(data[isGLObjectRef]){
            return [data.type, data.layout]
        }else if(data instanceof Array){
            return ["clientArray", layoutDesc]
        }else if(data instanceof ArrayBuffer){
            return ["clientBuffer", layoutDesc]
        }   

        throw new Error("FAIL: Data provided to append/prepend cannot be used as a data source.");
    }

    #processLayoutInput(layoutDesc, opts = {}){

        let layout;

        if(layoutDesc instanceof Layout){
            layout = layoutDesc;

            if(!this.sameInputs(layout.inputs, this.#inputs)){
                throw new Error("FAIL: layout object does not have the same input definitions as this dataset.");
            }
        }else if(layoutDesc instanceof Array){  // check cache to skip the parsing and object construction time costs of building a new layout.. if cache miss create a new one and cache
                                                // TODO: is this really faster at all??
            let layoutDescString = JSON.stringify(layoutDesc);

            if(this.#cachedLayouts[layoutDescString]){

                layout = this.#cachedLayouts[layoutDescString];

            }else{
                layout = new Layout(layoutDesc, this.#inputs, opts);

                if(!opts.disableCache){
                    this.#cachedLayouts[layoutDescString] = layout;
                }

            }
            
        }else{
            throw new Error("FAIL: second argument to appendData must be either a layout object or an array.");
        }

        return layout
    }


    sameInputs(input1, input2){
        for(let key of inputKeys){
            if(input1[key] !== input2[key]){
                return false;
            }
        }

        return true
    }

}

export default DataSet;


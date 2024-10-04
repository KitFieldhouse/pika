import isLayoutObj from "../private/isLayoutObj.js";
import VertexBuffer from "../buffer/vertexBuffer.js";
import GL from "../webglHandler/webglHandler.js";
import isDataStoreDescriptor from "../private/isDataStoreDescriptor.js";
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

const typeInfo = [{"short":  {bitSize: 16}}, 
    {"byte":  {bitSize: 8}}, 
    {"unsignedByte":  {bitSize: 8}}, 
    {"unsignedShort":   {bitSize: 16}} , 
    {"int":  {bitSize: 32}}, 
    {"unsignedInt":  {bitSize: 32}}, 
    {"float":  {bitSize: 32}}, 
    {"halfFloat":  {bitSize: 16}}];


const dataViewGetAndSet = [{"short":  {get: 'getInt16',set: 'setInt16'}}, 
    {"byte":  {get: 'getInt8',set: 'setInt8'}}, 
    {"unsignedByte":  {get: 'getUint8',set: 'setUint8'}}, 
    {"unsignedShort":   {get: 'getUint16',set: 'setUint16'}} , 
    {"int":  {get: 'getInt32',set: 'setInt32'}}, 
    {"unsignedInt":  {get: 'getUint32',set: 'setUint32'}}, 
    {"float":  {get: 'getFloat32',set: 'setFloat32'}}, 
    {"halfFloat":  {get: 'getFloat16',set: 'setFloat16'}}];



class DataSet {

    #gl; // this is the webgl context
    #inputs = {};

    #usedInputs = [];

    #dataStores = [];

    #cachedLayouts = {};

    constructor(inputs, layout, gl){
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


        for(let el of layout){
            if(!(typeof el === "object") || !(el[isDataStoreDescriptor])){
                throw new Error("FAIL: Data set store descriptor must be made up of data descriptor objects such as VertexBuffer");
            }

            switch(el.type){
                case "VertexBuffer":
                    this.#addVertexBuffer(el.inputs, el.atoms, el.opts);
                    break;
                default:
                    break;
            }
        }

        if(this.#usedInputs.length !== Object.keys(this.#inputs).length){
            throw new Error("FAIL: Not all inputs were placed in layout.");
        }

        //this.#buildGLCallsFromLayout(layout ?? this.#constructDefaultLayout());
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

    #addVertexBuffer(vbInputs, vbAtoms, opts){

        if(this.#inputIsAlreadyUsed(Object.keys(vbInputs))){
            throw new Error("FAIL: Layout descriptor must include an input only once!");
        }

        if(!this.#isAValidInput(Object.keys(vbInputs))){
            throw new Error("FAIL: Unknown input used in layout descriptor.");
        }

        this.#usedInputs = [...this.#usedInputs, ...Object.keys(vbInputs)];

        this.#dataStores.push(new VertexBuffer(vbAtoms, this.#inputs, this.#gl, opts));
        
    }

    // need to figure out generalizations of append/prepend for multi dim data.

    appendData(data, layoutDesc, opts = {}){

        let layout = this.#processLayoutInput(layoutDesc, opts);
  
        

    }


    prependData(){

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


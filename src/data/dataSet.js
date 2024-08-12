import isLayoutObj from "../private/isLayoutObj.js";
import VertexBuffer from "../buffer/vertexBuffer.js";
import GL from "../webglHandler/webglHandler.js";


// kitfield jul 30 24
//

// TODO: are all of my Object.assigns really needed????
// size opt should be inputted on a dataset wide level...

// TODO: right now I am doing error checking with the actual copying of data. This makes the 
// api a bit more error prone as this will start copying data until a error occurs at which point the 
// api bricks meaning that we are in a half-functional state. 

const defaultInputs = {name: null , size: null, type: null, normalized: false}

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
    #inputs = [];
    #buffers = []; 

    static compareLayouts(layout1, layout2){

        // recursive stuff here blood...



    }

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


        this.#buildGLCallsFromLayout(layout ?? this.#constructDefaultLayout());
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

    // this function checks to see if the supplied layout descriptor is valid. The rules are:
        // goes through the descriptor depth first. Each terminating node is required to be of depth = 2
        // each terminating node must be a layout object descriptor
    // after these checks pass, it verifies that each of the inputs of the data set are actually mentioned 
    // in the layout descriptor exactly once.
    // [ [], [] , {name: "fds", desc: []}]
    #buildGLCallsFromLayout(layout){

        let alreadyUsedInputs = [];
        let desc = null;
        let opts = null;

        for(let bufferDesc of layout){
            if(bufferDesc instanceof Array){

                desc = bufferDesc;
                opts = null;

            }else if(typeof bufferDesc === "object"){

                if(!bufferDesc.name || !bufferDesc.desc || !(bufferDesc.desc instanceof Array)){
                    throw new Error(`FAIL: Individual buffer descriptor must either be an array or an object with the 
                            structure {name: 'name', desc: [--layout--]}`);
                }

                desc = bufferDesc.desc;
                opts = bufferDesc.opts ?? null;

            }else{
                 throw new Error(`FAIL: Individual buffer descriptor must either be an array or an object with the 
                        structure {name: 'name', desc: ''}`);
            }


            let [usedInputs, layoutAtoms, allLayoutAtomsWithType] = this.#extractAtoms(desc, alreadyUsedInputs);
            let [buffer, updateFuncs, bufferViews] = VertexBuffer.constructBufferFromAtoms(allLayoutAtomsWithType, this.#gl, opts);
            
            let layout = [];

            for(let i = 0; i < layoutAtoms.length; i++){
                layout.push({atom: layoutAtoms[i], bufferView: bufferViews[i]});
            }

            let bufferObj = Object.assign({'buffer': buffer, inputs: usedInputs, 'layout': layout}, updateFuncs);

            this.#buffers.push(bufferObj);
        }

        if(alreadyUsedInputs.length !== this.#inputs.keys().length){
            throw new Error("FAIL: Not all inputs were placed in layout.");
        }
    }

    #extractAtoms(bufferDesc, alreadyUsedInputs){

        let allLayoutAtomsWithType = []; // this is the same as layout atom but with the input arguments 
                                         // changed to the appropriate size and and type information instead 
                                         // of the input name (which is what is in the original layout descriptor) 
        let layoutAtoms = [];

        let bufferUsedInputs = [];

        let lastAtomRepeatSize = null;


        for(let layoutAtom of bufferDesc){
            if(!(typeof layoutAtom === "object") || !layoutAtom[isLayoutObj]){
                throw new Error(`FAIL: Buffer descriptors must be filled with objects generated by GL.repeat, GL.endRepeat or GL.centerRepeat`);
            }else if(!layoutAtom.isLayout){
                throw new Error(`FAIL: Provided descriptor is a data descriptor and is not a layout descriptor!!`);
            }else if(layoutAtom.opts.size !== lastAtomRepeatSize && lastAtomRepeatSize){
                throw new Error(`FAIL: As of now Pika expects all sub buffer descriptors to have been given the same repeat size!!`)
            }

            lastAtomRepeatSize = layoutAtom.opts.size;
            
            let translatedArgs = [];

            for(let arg of layoutAtom.arguments){

                if(alreadyUsedInputs.includes(arg)){
                    throw new Error("FAIL: Layout descriptor must include an input only once!");
                }

                let inputInfo = this.#inputs[arg];

                if(!inputInfo){
                    throw new Error("FAIL: Unknown input used in layout descriptor.");
                }

                alreadyUsedInputs.push(arg);
                bufferUsedInputs.push(arg);

                translatedArgs.push({size: inputInfo.size, type: inputInfo.type});
            }

            let layoutAtomWithType = {opts: layoutAtom.opts, repeatType: layoutAtom.repeatType, 
                                        arguments: translatedArgs};
            
            layoutAtomWithType.arguments = translatedArgs;

            layoutAtoms.push(Object.assign({}, layoutAtom));
            allLayoutAtomsWithType.push(layoutAtomWithType);
        }

        return [bufferUsedInputs, layoutAtoms, allLayoutAtomsWithType];
    }

    #constructDefaultLayout(){
        return [[GL.repeat(...this.#inputs.keys())]];
    }

    appendData(data, format = this.#constructDefaultLayout()[0]){ // format is a data layout descriptor

        // first extract all data format atoms and ensure the data actually make sure the data is of the correct format

        let formatAtoms = this.#extractDataAtoms(data, format); // data atoms have format:
                                                                // {descriptor: <repeatObj>, size: <number of points>, data: <dataArray>, isArrayBuffer}

        // check to make sure all extracted atoms have the same amount of points, if not report an error

        let sameSize = formatAtoms.reduce((acc, el) => el.size === acc? acc : false, formatAtoms[0].size);
        let size = formatAtoms[0].size;
        
        if(!sameSize){
            throw new Error("FAIL: Provided data set does not have the same number of data per repeat!");
        }

        // now generate getters for our data
        // there is an innefficiency here were we will generate getters even in the case that a direct transfer would do the trick..
        // the benefit of this is that we avoid having to do an extra for loop over each buffer.layout.
        let inputGetters = {};
        let arrayBuffers = [];
        let usedInputs = [];

        for(let buff of this.#buffers){ // fill out the arrayBuffer structure
            let aBuffs = []
            arrayBuffers.push(aBuffs);
            for(let atm of buff.layout){
                aBuffs.push(null);
            }
        }

        for(let formatAtom of formatAtoms){
            
            if(formatAtom.isArrayBuffer){ // check if can do direct transfer
                    // check if can do direct transfer
                    let directCopyLayoutAtomIndex = -1;
                    let buff = null;

                    for(let i = 0; i < this.#buffers.length; i++){
                        buff = i;
                        let directCopyLayoutAtomIndex = this.#buffers[i].layout.findIndex((lAtom) => this.#canDirectCopy(formatAtom, lAtom))
                        if(directCopyLayoutAtomIndex > 0){
                            break;
                        }
                    }

                    if(directCopyLayoutAtomIndex > 0){

                        let args = formatAtom.descriptor.arguments;

                        if(formatAtom.data.byteSize % this.#buffers[buff].layout[directCopyLayoutAtomIndex].bufferView.datumByteSize !== 0){
                            throw new Error(`FAIL: Provided array buffer for arguments [${args.join(",")}] is not divisable by datum size`);
                        }

                        for(let arg of args){
                            if(usedInputs.includes(arg)){
                                throw new Error("FAIL: Input listed twice in data format descriptor");
                            }
                            usedInputs.push(arg);
                        }

                        arrayBuffers[buff][directCopyLayoutAtomIndex] = formatAtom.data;

                        continue;
                    }

                    // if we have made it down here, we cannot block transfer the supplied array buffer over and will need to generate getter functions for 
                    // unpacking it.

                    let args = formatAtom.descriptor.arguments;
                    let offset = 0;

                    for(let i = 0; i < args.length; i++){
                    let arg = args[i];
                    let closureOffset = offset;

                    if(usedInputs.includes(arg)){
                            throw new Error("FAIL: Input listed twice in data format descriptor");
                    }

                    // assert !!this.#inputs[arg], this was checked for array buffers in the atom extractor.

                    let dataView = new DataView(formatAtom.data);
                    let type = this.#inputs[arg].type;

                    let getter = (i) => {
                        let byteOffset = i*formatAtom.datumByteSize + closureOffset;
                        return dataView[dataViewGetAndSet[type].get](byteOffset);
                    };
                    getter.viewSetter = dataViewGetAndSet[type].set;
                    getter.indexByteAdjust = typeInfo[type].bitSize/8.0;

                    offset = offset + typeInfo[type].bitSize/8.0;

                    inputGetters[arg] = getter;

                    usedInputs.push(arg);
                }
            }else{ // else the data representation for the data format atom is an array and not an array buffer :(
                
                let getters = this.#getGetters(formatAtom.descriptor.arguments, () => formatAtom.data);

            }
        }

    }

    prependData(data, format = this.#constructDefaultLayout()[0]){ // format is a data layout descriptor

    }

    #getGetters(array, func){
        let getters = [];

        for(let arg of array){
            if(arg instanceof Array){
                getters.push(...this.#getGetters(arg, func));
            }else if(typeof arg !== 'string' || typeof arg !== 'symbol'){
                throw new Error("FAIL: Data format descriptors must be made up of only arrays, strings, or symbols!!");
            }
        }

    }

    #canDirectCopy(formatAtom, layoutAtom){
        // formatAtom format: {descriptor: formatEl, size, data: dataEl, isArrayBuffer}
        //  where descriptor: {[isLayoutObj]: true, isLayout: isLayout, arguments: names, repeatType, 'opts'}
        // layoutAtom format: {[isLayoutObj]: true, isLayout: true, arguments: names, repeatType, opts}

        if(!formatAtom.isArrayBuffer){
            return false;
        }

        if(formatAtom.descriptor.arguments.length !== layoutAtom.arguments.length){
            return false;
        }

        for(let i = 0; i < formatAtom.descriptor.arguments.length; i++){
            if(formatAtom.descriptor.arguments[i] !== layoutAtom.arguments[i]){
                return false;
            }
        }

        return true;

    }

    #extractDataAtoms(data, format){

        let formatAtoms = [];

        for(let i = 0; i < format.length; i++){
            let formatEl = format[i];
            let dataEl = data[i];

            if(!dataEl){
                this.#reportDataFormatError();
            }

            if(typeof formatEl === 'object'){
                if((formatEl instanceof Array)){
                    formatAtoms.push(...this.#extractDataAtoms(dataEl, formatEl));
                }
                else if(!formatEl[isLayoutObj]){
                    throw new Error("FAIL: Format should be composed of only arrays and objects generated by GL.repeat variants are allowed as layout descriptors!");
                }else{

                    // is a layout obj!!

                    let size = 0;
                    let datumByteSize = null;

                    if(dataEl instanceof Array){
                        size = dataEl.length;
                        isArrayBuffer = false;
                    }else if(dataEl instanceof ArrayBuffer){

                        if(!formatEl.isLayout){
                            throw new Error("FAIL: Data provided as an array buffer cannot be described with GL.variant repeats that include an array as an argument!")
                        }

                        
                        for(let arg of formatEl.arguments){
                            let input = this.#inputs[arg];

                            if(!input){
                                throw new Error("FAIL: Input in data descriptor does not match any input of the dataset!!");
                            }

                            datumByteSize = datumByteSize + input.size*typeInfo[input.type].bitSize/8.0;
                        }

                        if(dataEl.byteLength % datumByteSize !== 0){
                            throw new Error("FAIL: Provided buffer does not have a byte size divisible by the datum size of the format descriptor!"); // TODO: improve error message
                        }

                        size = dataEl.byteLength/datumByteSize;
                        isArrayBuffer = true;
                        
                    }else{
                        this.#reportDataFormatError();
                    }

                    formatAtoms.push({descriptor: formatEl, size, data: dataEl, isArrayBuffer, datumByteSize})
                }
            }else{
                throw new Error("FAIL: Format should be composed of only arrays and objects generated by GL.repeat variants are allowed as layout descriptors!");
            }

        }

        return formatAtoms;
    }

    #reportDataFormatError(){
        throw new Error("FAIL: Provided data array does not match the provided format descriptor!!");
    }

    #createBlankArrayBuffer(byteSize){
        return new ArrayBuffer(byteSize);
    }

    #transferData(writeBuffer, readBuffer, datumByteSize, amount, writeStart = 0, writeStrides = [0], readStart = 0, readStrides = [0]){

        let writeView = new DataView(writeBuffer);
        let readView = new DataView(readBuffer);

        let writeByteIndex = writeStart;
        let readByteIndex = readStart;

        for(let i = 0; i < amount; i++){
            for(let j = 0; j < datumByteSize; j++){
                writeView.setUint8(writeByteIndex + j, readView.getUint8(readByteIndex + j));
            }

            writeByteIndex = writeByteIndex + datumByteSize + writeStrides[i % writeStrides.length];
            readByteIndex = readByteIndex + datumByteSize + readStrides[i % readStrides.length];
        }
    }


}

export default DataSet;


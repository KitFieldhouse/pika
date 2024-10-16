import DataSet from "../data/dataSet.js";
import isLayoutObj from "../private/isLayoutObj.js";
import isDataStoreDescriptor from "../private/isDataStoreDescriptor.js";

const defaultRepeatOpts = {};

class WebglHandler {
    #gl = {}

    constructor(canvas){
        this.#gl = canvas.getContext("webgl2");
    }

    get gl(){
        return this.#gl
    }

    createDataSet = (dataSetDescriptor) => {
        return new DataSet(dataSetDescriptor.inputs, dataSetDescriptor.layout, this, dataSetDescriptor.initialData);
    }

     // ---------------------------------------------------------------------------------
     // ---------------------------------LAYOUT HANDLERS---------------------------------
     // ---------------------------------------------------------------------------------

     static repeat( opts , ...names){

        if(!opts && names.length === 0){
            throw new Error("FAIL: All variations of gl.repeat require at least one argument!");
        }

        let hasOpts = true;
        
        if(typeof opts === "string" || typeof opts === "symbol" || opts instanceof Array){ // no opts are given, all names
            hasOpts = false;
            names.unshift(opts);
        }else if(typeof opts !== "object"){
            throw new Error("FAIL: gl.repeat variations require an optional argument of an object!");
        }

        if(hasOpts && names.length === 0){
            throw new Error("FAIL; gl.repeat variations require at least one non-optional argument");
        }

        let isFlat = isLayoutArgs(names, false);

        if(!hasOpts){
            opts = {}
        }

        let optsWithDefaults = {};
        Object.assign(optsWithDefaults, defaultRepeatOpts);
        Object.assign(optsWithDefaults, opts);


        return Object.freeze({[isLayoutObj]: true, isFlat: isFlat, arguments: names, repeatType: 'start', 'opts': optsWithDefaults});
    }

    static endRepeat( opts , ...names){

        if(!opts && names.length === 0){
            throw new Error("FAIL: All variations of gl.repeat require at least one argument!");
        }

        let hasOpts = true;
        
        if(typeof opts === "string" || typeof opts === "symbol" || typeof opts instanceof Array){ // no opts are given, all names
            hasOpts = false;
            names.unshift(opts);
        }else if(typeof opts !== "object"){
            throw new Error("FAIL: gl.repeat variations require an optional argument of an object!");
        }

        if(hasOpts && names.length === 0){
            throw new Error("FAIL; gl.repeat variations require at least one non-optional argument");
        }

        let isFlat = isLayoutArgs(names, false);

        if(!hasOpts){
            opts = {}
        }

        let optsWithDefaults = {};
        Object.assign(optsWithDefaults, defaultRepeatOpts);
        Object.assign(optsWithDefaults, opts);

        return Object.freeze({[isLayoutObj]: true, isFlat: isFlat, arguments: names, repeatType: 'end', 'opts': optsWithDefaults});
    }

    static centerRepeat( opts , ...names){

        if(!opts && names.length === 0){
            throw new Error("FAIL: All variations of gl.repeat require at least one argument!");
        }

        let hasOpts = true;
        
        if(typeof opts === "string" || typeof opts === "symbol" || typeof opts instanceof Array){ // no opts are given, all names
            hasOpts = false;
            names.unshift(opts);
        }else if(typeof opts !== "object"){
            throw new Error("FAIL: gl.repeat variations require an optional argument of an object!");
        }

        if(hasOpts && names.length === 0){
            throw new Error("FAIL: gl.repeat variations require at least one non-optional argument");
        }

        let isFlat = isLayoutArgs(names, false);

        if(!hasOpts){
            opts = {}
        }

        let optsWithDefaults = {};
        Object.assign(optsWithDefaults, defaultRepeatOpts);
        Object.assign(optsWithDefaults, opts);


        return Object.freeze({[isLayoutObj]: true, isFlat: isFlat, arguments: names, repeatType: 'center', 'opts': optsWithDefaults});
    }
    
    static VertexBuffer(layout, opts){

        let usedInputs = {};
        let atoms = [];
        
        if(!(layout instanceof Array)){
            throw new Error("FAIL: VertexBuffer layout description should be an array!");
        }


        for(let el of layout){

            if(typeof el === "object"){
                if(!el[isLayoutObj]){
                    throw new Error("FAIL: VertexBuffer layout description must only include repeat objects or input identifiers.");
                }else if(!el.isFlat){
                    throw new Error("FAIL: VertexBuffer layout can only be flat");
                }

                for(let arg of el.arguments){

                    if(usedInputs[arg]){
                        throw new Error("FAIL: VertexBuffers can only use each input once in their layout descriptor.");
                    }

                    usedInputs[arg] = true;
                }

                let atom = Object.assign({}, el);
                atoms.push(atom);

            }else{
                if(typeof el !== "string" || typeof el !== "symbol"){
                    throw new Error("FAIL: VertexBuffer layout description must be composed of repeats or input identifiers.");
                }

                if(usedInputs[el]){
                    throw new Error("FAIL: VertexBuffers can only use each input once in their layout descriptor.");
                }

                let atom = {singleton: true};
                usedInputs[el] = true;
                atoms.push(atom);
            }

        }

        return {type: "VertexBuffer", atoms, inputs: usedInputs, opts, [isDataStoreDescriptor]: true};

    }

}


function isLayoutArgs(names, inArray){ // checks to see if 1) proper args have been given to the repeat function and 
                              // 2) if the layout is flat (i.e does not contain any array arguments);
    let encounteredAnArray = false;

    names.forEach(el => {
        if(el instanceof Array){
            encounteredAnArray = true;
            isLayoutArgs(el, true); // recurse into array to check its args...
        }else if(typeof el === 'object' && el[isLayoutObj]){
            if(!inArray){
                throw new Error("FAIL: Nested repeats must be within array brackets,  no 'naked' repeats)!");
            }
        }else if(typeof el !== "string" && typeof el !== "symbol"){
            throw new Error("FAIL: Arguments to repeat variants must be a string, a symbol, or an array of those types");
        }

    });

    return !encounteredAnArray; // if we encountered an array, then we are not a layout descriptor

}

export default WebglHandler;
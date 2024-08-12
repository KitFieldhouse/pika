import DataSet from "../data/dataSet.js";
import isLayoutObj from "../private/isLayoutObj.js";

const defaultRepeatOpts = {size: 100};

class WebglHandler {
    #gl = {}

    constructor(canvas){
        this.#gl = canvas.getContext("webgl2");
    }

    get gl(){
        return this.#gl
    }

    createDataSet = (dataSetDescriptor) => {
        return new DataSet(dataSetDescriptor.inputs, dataSetDescriptor.layout, this);
    }

     // ---------------------------------------------------------------------------------
     // ---------------------------------LAYOUT HANDLERS---------------------------------
     // ---------------------------------------------------------------------------------

     static repeat( opts , ...names){

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

        let isLayout = isLayoutArgs(names);

        if(!hasOpts){
            opts = {}
        }

        let optsWithDefaults = {};
        Object.assign(optsWithDefaults, defaultRepeatOpts);
        Object.assign(optsWithDefaults, opts);


        return {[isLayoutObj]: true, isLayout: isLayout, arguments: names, repeatType: 'start', 'opts': optsWithDefaults};
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

        let isLayout = isLayoutArgs(names);

        if(!hasOpts){
            opts = {}
        }

        let optsWithDefaults = {};
        Object.assign(optsWithDefaults, defaultRepeatOpts);
        Object.assign(optsWithDefaults, opts);

        return {[isLayoutObj]: true, isLayout: isLayout, arguments: names, repeatType: 'end', 'opts': optsWithDefaults};
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

        let isLayout = isLayoutArgs(names);

        if(!hasOpts){
            opts = {}
        }

        let optsWithDefaults = {};
        Object.assign(optsWithDefaults, defaultRepeatOpts);
        Object.assign(optsWithDefaults, opts);


        return {[isLayoutObj]: true, isLayout: isLayout, arguments: names, repeatType: 'center', 'opts': optsWithDefaults};
    }

}


function isLayoutArgs(names){ // checks to see if 1) proper args have been given to the repeat function and 
                              // 2) if it conforms to the internal or data layout descriptor spec.
    let encounteredAnArray = false;

    names.forEach(el => {
        if(el instanceof Array){
            encounteredAnArray = true;
            isLayoutArgs(el); // recurse into array to check its args...
        }else if(typeof el !== "string" && typeof el !== "symbol"){
            throw new Error("FAIL: Arguments to repeat variants must be a string, a symbol, or an array of those types");
        }

    });

    return !encounteredAnArray; // if we encountered an array, then we are not a layout descriptor

}

export default WebglHandler;
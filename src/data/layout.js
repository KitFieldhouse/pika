import DataSet from "../data/dataSet.js";
import isLayoutObj from "../private/isLayoutObj.js";
import {typeInfo, dataViewGetAndSet} from "../private/types.js"


// TODO: repeats and numberOfPts are kinda doing double duty...
// TODO: Left off oct 13th 0215 -- layout input is an array whereas dataSet input is an obj, fugggg

const rootGetter = (data) => data; 
const root = {getter: rootGetter, isRepeat: false};

const inputKeys = ["name", "size", "type", "normalized"]


class TransformInputGetIterator{

    #inputGetIterator;
    #unraveledData;

    #rearrangedData = [];

    #indexTransformer

    #dataLength = 0;

    #accumulator = null
    #input

    #iterator;

    constructor(input, inputGetIterator, indexTransformer){

        this.#input = input;

        this.#inputGetIterator = inputGetIterator;
        this.#unraveledData = Array.from(this.#inputGetIterator);
        this.#dataLength = this.#unraveledData.length;

        this.#indexTransformer = indexTransformer;

        for(let i = 0; i < this.#dataLength; i++){
            let val = this.#unraveledData[i];

            let transformerResult = this.#indexTransformer(i, val, this.#dataLength, this.#accumulator);

            let transformedIndex;
    
            if(transformerResult.length === 2){
                transformedIndex = transformerResult[0];
                this.#accumulator = transformerResult[1]
            }else{
                transformedIndex = transformerResult;
            }

            if(transformedIndex < 0 || transformedIndex >= this.#dataLength){
                throw new Error(`FAIL: Given index transformer for input ${this.#input} has mapped an index to a value outside of the bounds [0, dataLength - 1]. Value: ${transformedIndex}`);
            }

            if(this.#rearrangedData[transformedIndex]){
                throw new Error(`FAIL: Given index transformer for input ${this.#input} has mapped two different indices to the same index, this is not allowed`);
            }

            this.#rearrangedData[transformedIndex] = val;
    
        }

        this.#iterator = this.#rearrangedData[Symbol.iterator]();

    }

    [Symbol.iterator]() {
        return this.#rearrangedData[Symbol.iterator]();
    };

    next(){
        return this.#iterator.next();
    }

}

class InputGetIterator{

    #rootNode;
    #data;

    #savedCallsQueue = {current: []};
    #savedCalls = [];

    #initial = true;

    constructor(data, rootNode){
        this.#rootNode = rootNode;
        this.#data = data

    }

    [Symbol.iterator]() {

        return this;
    };

    next(){
        let leftover;
        let result = null;

        if(this.#initial){

            this.#initial = false;
            [leftover, result] = descendGetterTreeSingle(this.#rootNode, 0, this.#data, this.#savedCallsQueue);
            this.#savedCalls = this.#savedCallsQueue.current;
            return {done: false, value: result};
        }

        this.#savedCallsQueue.current = [];

        while(this.#savedCalls.length !== 0){

            let lastCall = this.#savedCalls.pop();
            [leftover, result] = lastCall();

            if(result != null){
                break;
            }

        }

        this.#savedCalls.push(...this.#savedCallsQueue.current);

        // console.log("returning result: " + result);
        // console.log(result != null);
        
        return result != null? {done: false, value: result} : {done: true};

    }
}


class Layout { // [repeat([repeat(x), repeat(y)]), [repeat(x), repeat([z])]]

    #dims = [];
    #inputs;

    #getters = {}; // {x: {map: <MAP>, tree: <TREE>}} would be for a single input (x)


    // opts: {expandVectors: []}

    // all repeats that are not an ancestor of another repeat.
    // in the future it might make sense to include repeats that are within 
    // other repeats, as there still would be efficiencies in down bulk 
    // copies of data in the case that they are array buffers
    // this can be built up in a similar way to the getter trees, but for repeat 
    // objects. 
    // Anyways, I am not doing that now as I don't think its a crucial part of 
    // Pika's functionality.

    #loneTopFlatRepeats = []; 

    #atomics = {}; // of the form {<input>: [all layout objs that reference that input directly]}

    #opts;
    #layoutArray;

    constructor(layoutArr, inputs, opts = {}){

        if(!(layoutArr instanceof Array)){
            throw new Error("FAIL: Layout descriptor must be an array");
        }

        this.#layoutArray = layoutArr;
        this.#opts = opts;

        this.#inputs = inputs;

        this.#parseArray(layoutArr, [root]);


        //console.dir(this.#getters, { depth: null })
        //console.log(this.#getters['x'].map.get(root));
        //console.log(this.#getters['x'].tree);

    }

    #parseArray(array, path){ // lets start this mofo over again......

        // first iteration, check if this is a flatten-able structure (i.e it is composed of strings and flatten-able repeat objects only). Also,
        // does the basic syntax type checking while I am at it....

        // TODO: this could probably be optimized out?? Anyways, lets give it a shot...

        let isFlat = null; // guilty until proven innocent
        let isLoneRepeat = false;

        //console.log("parsing an array");

        for(let el of array){

            if(typeof el === "object" && !(el instanceof Array)){
                if(!el[isLayoutObj]){
                    throw new Error("FAIL: Only objects created by gl.repeat variants are allowed!!");
                }

                isFlat = isFlat === null ? el.isFlat : el.isFlat && isFlat;
                isLoneRepeat = (array.length === 1);

                continue;

            }else if(el instanceof Array){
                isFlat = false;
                continue;
            }else if(typeof el === "string" || typeof el === "symbol"){
                continue
            }

            throw new Error("FAIL: Incorrect type given for a data layout descriptor.");
        }

        path[path.length -1].isFlat = isFlat;


        let typer = (data) => { // typers return true if type is an array, false if it is a buffer, null if undefined. Throws an error if
                                // the provided data type is not coherent with the data descriptors

            if(data == null){
                return null;
            }

            if(!(data instanceof Array)){
                console.log(data);
                throw new Error(`FAIL: Expected Array, got type ${typeof data}`);
            }

            //console.log(data.length);
            //console.log(data[0]);

            if(data.length === 1 && data[0] instanceof ArrayBuffer){
                if(isFlat){
                    //console.log("type is array buffer!");
                    return false;
                }else{
                    throw new Error("FAIL: ArrayBuffer type given for a layout descriptor that is not flat!");
                }
                
            }

            return true;
        }

        let staticsByteSize = 0;
        let staticsArraySize = 0;

        let nonStaticsByteSize = 0;
        let nonStaticsArraySize = 0;

        let portionNonStatic = (data) => {
            if(typer(data)){

                //  console.log(data.length);
                //  console.log(staticsArraySize);
                //  console.log(nonStaticsArraySize);

                if( (data.length - staticsArraySize) !== 0 && (data.length - staticsArraySize) % nonStaticsArraySize !== 0){
                    throw new Error("FAIL: Can not chop up provided data array in even chunks of data descriptor");
                }

                // console.log("PASS");

                return (data.length - staticsArraySize) === 0 ? 0 : (data.length - staticsArraySize)/nonStaticsArraySize;
            }else if(data != null){

                 let byteLength = data[0].byteLength;

                //  console.log(byteLength);
                //  console.log(staticsByteSize);
                //  console.log(nonStaticsByteSize);

                if((byteLength - staticsByteSize) !== 0 && (byteLength - staticsByteSize) % nonStaticsByteSize !== 0){
                    throw new Error("FAIL: Can not chop up provided data array in even chunks of data descriptor");
                }

                return (byteLength - staticsByteSize) === 0 ? 0 : (byteLength - staticsByteSize) / nonStaticsByteSize ;
            }else{
                return 0;
            }
        }

        // left of here, need to pass these to the individual repeats, and also for the arrays to since the grabbers there are also important!!

        for(let el of array){

            let staticsByteSizeSoFar = staticsByteSize;
            let staticsArraySizeSoFar = staticsArraySize;

            let nonStaticsArraySizeSoFar = nonStaticsArraySize;
            let nonStaticsByteSizeSoFar = nonStaticsByteSize;

            if(typeof el === "object" && !(el instanceof Array)){

                //console.log("found object inside this array");

                if(isFlat && isLoneRepeat){
                    let pathCopy = [...path]; //TODO: not sure this is needed....

                    let getterFromRoot = data => pathCopy.reduce( (acc, obj) => obj.getter(acc) , data);

                    let getterWithArrayBufferExtraction = data => {
                        let extractedData = getterFromRoot(data);

                        if(typer(extractedData)){
                            return extractedData
                        }

                        return extractedData[0]
                    }

                    this.#loneTopFlatRepeats.push({repeat: el, getter: getterWithArrayBufferExtraction, typer: (data) => typer(getterFromRoot(data)), size: (data) => el.opts.size || portionNonStatic(getterFromRoot(data))});
                }

                if(el.opts.size){
                    let size = el.opts.size;
                    let [datumByteSize, datumArraySize] = this.#parseRepeat(el, ()  => size, [...path, {isRepeatParent: true, isFlat: isFlat, repeats: () => size} ], typer,
                        (data) => staticsArraySizeSoFar + nonStaticsArraySizeSoFar*portionNonStatic(data),
                        (data) => staticsByteSizeSoFar + nonStaticsByteSizeSoFar*portionNonStatic(data));

                    staticsArraySize = staticsArraySize + datumArraySize*size;
                    staticsByteSize = staticsByteSize + datumByteSize*size;

                    //console.log("statically sized object");
                    //console.log(el.opts.size);

                }else{
                    let [datumByteSize, datumArraySize] = this.#parseRepeat(el, portionNonStatic, [...path, {isRepeatParent: true, isFlat: isFlat, repeats: portionNonStatic} ], typer,
                        (data) => {
                            //console.log(`staticsArraySizeSoFar is ${staticsArraySizeSoFar} and nonStaticsArraySizeSoFar is ${nonStaticsArraySizeSoFar} and the portionNonStatic is ${portionNonStatic(data)}`);
                            return staticsArraySizeSoFar + nonStaticsArraySizeSoFar*portionNonStatic(data);
                        },
                        (data) => staticsByteSizeSoFar + nonStaticsByteSizeSoFar*portionNonStatic(data));

                    nonStaticsArraySize = nonStaticsArraySize + datumArraySize;
                    nonStaticsByteSize = nonStaticsByteSize + datumByteSize;

                    //console.log("dynamically sized object");
                    //console.log("dynamically sized, nonStaticsArraySizeSoFar: " + nonStaticsArraySizeSoFar);
                }

            }else if(el instanceof Array){
                //console.log("found arr inside this arr");
                staticsArraySize++;
                staticsByteSize = null; // cant have byte offsets since this cannot be inside an array buffer...

                this.#parseArray(el, [...path, {getter: (data) =>  {
                    //console.log(`Firing getter with data: ${data}`); 
                    return data[staticsArraySizeSoFar + nonStaticsArraySizeSoFar*portionNonStatic(data)] ?? null
                }
                    , isRepeat: false}]);

            }else{ // typeof el === "string" || typeof el === "symbol" must be true

                //console.log("found other inside this arr (hopefully either a string or a symbol)");

                let inputInfo = this.#lookupInput(el);

                staticsArraySize = staticsArraySize + inputInfo.datumArraySize;
                staticsByteSize = staticsByteSize + inputInfo.datumByteSize;

                let getterObject = {getter: (data) => {

                    //console.log(`Firing getter with data: ${data}`);
                    
                    if(typer(data)){ // is array // TODO: this needs to be tested!!
                        if(inputInfo.datumArraySize === 1){
                            let extractedData = data[staticsArraySizeSoFar + nonStaticsArraySizeSoFar*portionNonStatic(data)] ?? null;

                            if(extractedData && inputInfo.unexpandedVector && !(extractedData instanceof Array)){
                                throw new Error("FAIL: Vectors that have not been explicitly expanded need to have type array!")
                            }

                            if(extractedData && inputInfo.unexpandedVector && extractedData.length !== inputInfo.vectorSize){
                                throw new Error("FAIL: Provided data has incorrect vector dimension for input: " + arg);
                            }

                            return extractedData;
                        }else{
                            let startIndex = staticsArraySizeSoFar + nonStaticsArraySizeSoFar*portionNonStatic(data);
                            let slice = (data ?? []).slice(startIndex, startIndex + inputInfo.datumArraySize)

                            return slice.length === 0 ? null : slice;
                        }
                    }else if(data != null){ // is buffer
                        let view = new DataView(data[0]);

                        let calcByteOffset = staticsByteSizeSoFar + nonStaticsByteSizeSoFar*portionNonStatic(data);

                        if(calcByteOffset > view.byteLength){
                            return null;
                        }

                        return view[inputInfo.getter](calcByteOffset, true);
                    }else{
                        return null;
                    }

                }, isDataGrab: true, numberOfPts: () => 1}

                let adjustedPath = [...path, getterObject];

                this.#reconcileWithGetterTree(el, adjustedPath);
                this.#updateAtomics(el);
            }

        }

        return [null,1]; // returns array of [datumByteSize, datumArraySize]

    }
    
    
    #parseRepeat(repeatObj, repeatsAlloted, path, typer, arrayOffset, byteOffset){ // need to keep track of argument level offset <--- left off here

        //console.log("parsing a repeat obj");

        let datumByteSize = 0;
        let datumArraySize = 0;

        for(let arg of repeatObj.arguments){

            let datumByteSizeSoFar = datumByteSize;
            let datumArraySizeSoFar = datumArraySize;

            if(arg instanceof Array){

                datumByteSize = null;


                let getterObject = {getter: (data, i) => {
                    //console.log(`Firing getter with data: ${data} and index ${i}`);
                    //console.log("getter will return: " + data[arrayOffset(data) + datumArraySizeSoFar + datumArraySize*i]);
                    //console.log("Offset: " + arrayOffset(data));
                    return data[arrayOffset(data) + datumArraySizeSoFar + datumArraySize*i] ?? null;
                    }, isRepeat: true, repeats: repeatsAlloted}

                let adjustedPath = [...path, getterObject];

                this.#parseArray(arg, adjustedPath);

                datumArraySize++;
                
            }else if(typeof arg === "string" || typeof arg === "symbol"){
                let inputInfo = this.#lookupInput(arg, repeatObj);
                datumByteSize = datumByteSize + inputInfo.datumByteSize;
                datumArraySize = datumArraySize + inputInfo.datumArraySize;

                let getterObject = {getter: (data, i) => {

                    // console.log(`Firing getter with data: ${data} and index ${i}`);
                    
                    if(typer(data)){ // is array
                        // console.log("Getter will return: " + data[arrayOffset(data) + datumArraySizeSoFar + datumArraySize*i]);
                        if(inputInfo.datumArraySize === 1){
                            let extractedData = data[arrayOffset(data) + datumArraySizeSoFar+ datumArraySize*i] ?? null;

                            if(extractedData && inputInfo.unexpandedVector && !(extractedData instanceof Array)){
                                throw new Error("FAIL: Vectors that have not been explicitly expanded need to have type array!")
                            }

                            if(extractedData && inputInfo.unexpandedVector && extractedData.length !== inputInfo.vectorSize){
                                throw new Error("FAIL: Provided data has incorrect vector dimension for input: " + arg);
                            }

                            return extractedData;
                        }else{
                            let startIndex = arrayOffset(data) + datumArraySizeSoFar+ datumArraySize*i;
                            let slice = (data ?? []).slice(startIndex, startIndex + inputInfo.datumArraySize)

                            // console.log("Running slice getter. " + "startIndex: " + startIndex + ". InputSize: " + inputInfo.datumArraySize);

                            return slice.length === 0 ? null : slice;
                        }
                    }else if(data != null){ // is buffer
                        let view = new DataView(data[0]);
                        let calcByteOffset = byteOffset(data) + datumByteSizeSoFar +  datumByteSize*i;
                        
                        // console.log(byteOffset(data) + datumByteSizeSoFar +  datumByteSize*i);
                        // console.log(view[inputInfo.getter](byteOffset(data) + datumByteSizeSoFar +  datumByteSize*i, true));
                        
                        if(calcByteOffset > view.byteLength){
                            return null;
                        }

                        return view[inputInfo.getter](calcByteOffset, true);
                    }else{
                        return null;
                    }

                }, isDataGrab: true, numberOfPts: repeatsAlloted ,isRepeat: true, repeats: repeatsAlloted}

                let adjustedPath = [...path, getterObject];

                this.#reconcileWithGetterTree(arg, adjustedPath);
                this.#updateAtomics(arg, repeatObj);

            }else{
                throw new Error("FAIL: Something went horribly wrong...");
            }
        }

        //console.log("this repeat obj has a datum array size of: " + datumArraySize);

        return [datumByteSize, datumArraySize];

    }

    
    // {name: 'x', size: 1, type: 'float'},
    // {name: 'y', size: 1, type: 'float'},
    // {name: 'a', size: 1, type: 'float'},
    // {name: 'b', size: 1, type: 'float'} <------ inputs have this form
    #lookupInput(name, repeatObj = null){
        let inputObject = this.#inputs[name];

        if(!inputObject){
            throw new Error(`FAIL: Input "${name}" was not found for this layout`);
        }

        let datumByteSize = inputObject.size*typeInfo[inputObject.type].bitSize / 8;
        let getter = dataViewGetAndSet[inputObject.type].get;
        let setter = dataViewGetAndSet[inputObject.type].set;

        let datumArraySize = 1;

        let shouldExpandVector = (this.#opts.expandVectors && this.#opts.expandVectors.includes(name)) || (repeatObj && repeatObj.opts.expandVectors && repeatObj.opts.expandVectors.includes(name))
        let unexpandedVector = (inputObject.size !== 1) && !shouldExpandVector

        if(shouldExpandVector){
            datumArraySize = inputObject.size;
            // console.log(datumArraySize);
        }

        return {datumByteSize, datumArraySize, getter, setter, unexpandedVector, vectorSize: inputObject.size};
    }

    #reconcileWithGetterTree(input, path){
        // console.log("Wanting to reconcile tree for " + input);
        // console.log("path is:");
        // let trans = [...path]
        // trans.forEach(el => el.getter = el.getter.toString())
        // console.log(trans);

        if(!this.#getters[input]){
            this.#getters[input] = {map: new Map(), tree: {node: root, children: []}}; // TODO: having the tree is redundant, can just use the map....
            this.#getters[input].map.set(root, this.#getters[input].tree); 
        }

        let getter = this.#getters[input];

        let prevCreatedNodeObj = 0;
        let pathObj = null;

        for(let i = path.length-1; i >= 0; i--){
            pathObj = path[i];
            let nodeObj = getter.map.get(pathObj);
            let newNode;
            if(!nodeObj){
                newNode = {node: pathObj, children: []}
                
                if(prevCreatedNodeObj){
                    newNode.children.push(prevCreatedNodeObj);
                }

                getter.map.set(pathObj, newNode);

            }else{
                nodeObj.children.push(prevCreatedNodeObj)
                break;
            }

            prevCreatedNodeObj = newNode;
        }

    }

    #updateAtomics(input, repeatObj){

        if(!this.#atomics[input]){
            this.#atomics[input] = [];
        }

        if(!repeatObj){
            this.#atomics[input].push({nonRepeat: true}); // TODO: make sure the property naming is consistent with what I have for the getter tree structure
            return
        }

        //console.log("updating atomics with input: " + input);

        this.#atomics[input].push(repeatObj);
    }

    getValue(input, data, ...indices){
        if(!this.#getters[input]){
            throw new Error(`FAIL: This layout does not have data related to input ${input}`);
        }

        if(indices.length === 0){
            throw new Error(`FAIL: At least one index is required for grabbing data!`);
        }

        let getter = this.#getters[input];
        let getterDim = calculateGetterDim(getter.tree, 0);

        if(getterDim === 0){
            throw new Error("FAIL: getter for this input has no degrees of freedom!"); // TODO: this should actually be checked in layout processing
        }

        if(indices.length !== 1 && indices.length !== getterDim){
            throw new Error(`FAIL: provided indices expect a getter of dim: ${indices.length}. The getter for input ${input} has dimension of ${getterDim}`);
        }

        let isMulti = false;

        if(indices.length !== 1){
            isMulti = true;
        }

        let leftoverIndex;
        let result;

        if(!isMulti){
            [leftoverIndex, result] = descendGetterTreeSingle(getter.tree, indices[0], data); 
        }else{
            [leftoverIndex, result] = descendGetterTree(getter.tree, indices, data); 
        }
        
        //console.log("leftover Index: " + leftoverIndex);

        return result;

    }

    createInputIterator(input, data, indexTransform = null){

        if(!this.#getters[input]){
            throw new Error(`FAIL: This layout does not have data related to input ${input}`);
        }

        if(!indexTransform){
            return new InputGetIterator(data, this.#getters[input].tree);
        }

        return new TransformInputGetIterator(input, new InputGetIterator(data, this.#getters[input].tree), indexTransform);

    }


    #mustBeArray(data){
        if(!(data instanceof Array)){
            throw new Error("FAIL: Data must have type array!!");
        }
    }

    isSameLayout(otherLayout){
        if(!this.hasSameInputDefinitions(otherLayout.#inputs)){
            return false
        }

        if(Object.keys(this.#opts).length !== Object.keys(otherLayout.#opts).length){
            return false;
        }

        for(let opt in this.#opts){

            if(this.#opts[opt] instanceof Array){
                if(!otherLayout.#opts[opt] || !(otherLayout.#opts[opt] instanceof Array) ){
                    return false;
                }

                if(!this.#opts[opt].reduce((acc, el, i) => !acc? false : el === otherLayout.#opts[opt], true)){
                    return false
                }

                continue

            }

            if(this.#opts[opt] !== otherLayout.#opts[opt]){
                return false
            }
        }

        if(!this.compareLayoutArr(this.#layoutArray, otherLayout.#layoutArray)){
            return false;
        }

        return true;
    }

    hasSameInputDefinitions(otherInputs){

        if(Object.keys(this.#inputs).length !== Object.keys(otherInputs).length){
            return false;
        }

        for(let input in this.#inputs){

            if(!otherInputs[input]){
                return false;
            }

            for(let key of inputKeys){
                if(this.#inputs[input][key] !== otherInputs[input][key]){
                    return false;
                }
            }
        }

        return true
    }

    compareLayoutArr(arr1, arr2){
        if(arr1.length !== arr2.length){
            return false;
        }

        for(let i = 0 ; i < arr1.length; i++){
            let arg1 = arr1[i];
            let arg2 = arr2[i];

            if(arg1[isLayoutObj]){
                if(!arg2[isLayoutObj]){
                    return false;
                }else if(!this.compareRepeats(arg1, arg2)){
                    return false;
                }
            }else if(arg1 !== arg2){ // not layout object so this can only be a string or a symbol
                return false;
            }
        }

        return true
    }

    compareRepeats(repeatObj1, repeatObj2){

        if((repeatObj1.opts && !repeatObj2.opts) || (!repeatObj1.opts && repeatObj2.opts)){
            return false;
        }

        if(repeatObj1.opts){

            if(Object.keys(repeatObj1.opts).length !== Object.keys(repeatObj2.opts).length){
                return false;
            }

            for(let key in repeatObj1.opts){
                if(repeatObj1.opts[key] !== repeatObj2.opts[key]){
                    return false;
                }
            }
        }

        if(!this.compareLayoutArr(repeatObj1.arguments, repeatObj2.arguments)){
            return false;
        }

        return true


    }

    getDataLayoutAtoms(input){
        return this.#atomics[input];
    }

    get dim(){
        return this.#dims.length;
    }

    getDimOfInput(input){
        if(this.#getters[input]){
            return null;
        }

        let getter = this.#getters[input];

        return calculateGetterDim(getter.tree, 0);
    }

    get inputs(){
        return Object.assign({}, this.#inputs);
    }

    get loneTopFlatRepeats(){ // TODO: this is dev only
        return this.#loneTopFlatRepeats;
    }

}


// TODO: Notes for improvements to the getter descends....
        // --> To make it more homogenous, get rid of checking to what the child is before recursing into them, just make recurse and handle as needed.

function descendGetterTreeSingle(node, index, data, savedCallsQueue = null, r = 0, k = 0){ // for now write this only for a single dimensional index...

    //console.log("Inside tree descent, index: " + index);

    if(node.node.isRepeatParent){

        //console.log("node is a repeat parent");

        if(node.node.isFlat){ // this implies that the single child node is a data grab node....

            //console.log("node is flat");

            let childrenCnt = node.children.length;
            let numberOfPts = childrenCnt * node.node.repeats(data);
    
            if(index < numberOfPts){
                //console.log("calling getter with index: " + Math.floor(index/childrenCnt));
                if(savedCallsQueue){
                    //console.log(savedCallsQueue)
                    //console.log(savedCallsQueue.current);
                }
                savedCallsQueue && savedCallsQueue.current.unshift(() => descendGetterTreeSingle(node, index + 1, data, savedCallsQueue, 0, 0));

                return [null, node.children[index % childrenCnt].node.getter(data, Math.floor(index/childrenCnt))];
            }
    
            return [index - numberOfPts, null];
    
        } // else is not flat.... have to visit each child to extract out index offset...

        let starterIndex = k;

        for(let i = r; i < node.node.repeats(data); i++){
            //console.log("doing a repeat iteration!")
            for(let j = starterIndex; j < node.children.length; j++){
                let child = node.children[j];

                //console.log("Iterating next repeat child");

                if(child.node.isDataGrab){
                    if(index === 0){
                        //console.log("calling datagrab getter with i: " + i);
                        savedCallsQueue && savedCallsQueue.current.unshift(() => descendGetterTreeSingle(node, 0, data, savedCallsQueue, i, j + 1));
                        return [null, child.node.getter(data, i)]
                    }else{
                        index--;
                    }

                    continue;
                }

                //console.log("calling non-datagrab getter with i: " + i);
                let [newIndex, result] = descendGetterTreeSingle(child, index, child.node.getter(data, i), savedCallsQueue);
                
                if(result){
                    savedCallsQueue && savedCallsQueue.current.unshift(() => descendGetterTreeSingle(node, 0, data, savedCallsQueue, i, j + 1));
                    return [null, result];
                }

                index = newIndex;

            }

            starterIndex = 0;
        }
    }else{ // not a repeat parent...

        //console.log("node is not a repeat parent");

        for(let j = k; j < node.children.length; j++){
            let child = node.children[j];
            //console.log("next iterations, not a repeat");

            if(child.node.isDataGrab){
                if(index === 0){
                    //console.log("Calling a non-repeat getter that is a datagrab");
                    savedCallsQueue && savedCallsQueue.current.unshift(() => descendGetterTreeSingle(node, 0, data, savedCallsQueue, 0, j + 1));
                    return [null, child.node.getter(data)]
                }else{
                    index--;
                }

                continue;
            }

            //console.log("Calling a non-repeat getter that is not a datagrab");
            let [newIndex, result] = descendGetterTreeSingle(child, index, child.node.getter ? child.node.getter(data) : data, savedCallsQueue);

            if(result !== null){
                savedCallsQueue && savedCallsQueue.current.unshift(() => descendGetterTreeSingle(node, 0, data, savedCallsQueue, 0, j+1));
                return [null, result];
            }

            index = newIndex;
        }
    }

    //console.log("have not exhausted indices, returning with index: " + index);

    return [index, null];
}

function descendGetterTree(node, indices, data){

    let newIndices = [...indices];
    let index = newIndices.shift();
    let child = node.children[0];

    if(child.node.isDataGrab){

        if(indices.length !== 1){
            throw new Error("FAIL(INTERNAL): Expected all indices to be exhausted by time data was reached.");
        }

        //console.log("Attempting to grab data with index: " + index);
        return [null, child.node.getter(data, index)];
    }


    if(node.node.isRepeatParent){

        return descendGetterTree(child, newIndices, child.node.getter(data, index));
        
    }else{
        // console.log("indices: ");
        // console.log(indices);
        return descendGetterTree(child, indices, child.node.getter ? child.node.getter(data) : data);
    }
    
}

function calculateGetterDim(getterObj, dim){

    if(getterObj.children.length > 1){ // && !getterObj.node.isFlat // the second part of the iff
        return NaN;
    }

    let thisDim = dim;


    if(getterObj.node.isRepeatParent){
        thisDim++;
    }

    if(getterObj.children.length === 0){
        return thisDim;
    }else{
        return calculateGetterDim(getterObj.children[0], thisDim); // this is a little non obvious why this works, it might be better to write this in a more self documenting way.
    }

}


export default Layout;
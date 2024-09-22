import DataSet from "../data/dataSet.js";
import isLayoutObj from "../private/isLayoutObj.js";


// TODO: repeats and numberOfPts are kinda doing double duty...

const typeInfo = {"short":  {bitSize: 16},
    "byte":  {bitSize: 8}, 
    "unsignedByte":  {bitSize: 8}, 
    "unsignedShort":   {bitSize: 16} , 
    "int":  {bitSize: 32}, 
    "unsignedInt":  {bitSize: 32}, 
    "float":  {bitSize: 32}, 
    "halfFloat":  {bitSize: 16}};


const dataViewGetAndSet = {"short":  {get: 'getInt16',set: 'setInt16'}, 
    "byte":  {get: 'getInt8',set: 'setInt8'}, 
    "unsignedByte":  {get: 'getUint8',set: 'setUint8'}, 
    "unsignedShort":   {get: 'getUint16',set: 'setUint16'} , 
    "int":  {get: 'getInt32',set: 'setInt32'}, 
    "unsignedInt":  {get: 'getUint32',set: 'setUint32'}, 
    "float":  {get: 'getFloat32',set: 'setFloat32'}, 
    "halfFloat":  {get: 'getFloat16',set: 'setFloat16'}};

const rootGetter = (data) => data; 
const root = {getter: rootGetter, isRepeat: false};


class Layout { // [repeat([repeat(x), repeat(y)]), [repeat(x), repeat([z])]]

    #dims = [];
    #params = {};
    #inputs;

    #getters = {}; // {x: {map: <MAP>, tree: <TREE>}} would be for a single input (x)

    #savedCalls = [];
    #savedCallsQueue = [];

    #savedCallsStore = {};

    constructor(layoutArr, inputs){

        if(!(layoutArr instanceof Array)){
            throw new Error("FAIL: Layout descriptor must be an array");
        }

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

        //console.log("parsing an array");

        for(let el of array){

            if(typeof el === "object" && !(el instanceof Array)){
                if(!el[isLayoutObj]){
                    throw new Error("FAIL: Only objects created by gl.repeat variants are allowed!!");
                }

                isFlat = isFlat === null ? el.isFlat : el.isFlat && isFlat;

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

                return (data.length - staticsArraySize) === 0 ? 0 : (data.length - staticsArraySize)/nonStaticsArraySize;
            }else if(data !== undefined){

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

                staticsArraySize++;

                let inputInfo = this.#lookupInput(el);
                staticsByteSize = staticsByteSize + inputInfo.datumByteSize;

                let getterObject = {getter: (data) => {

                    //console.log(`Firing getter with data: ${data}`);
                    
                    if(typer(data)){ // is array
                        return data[staticsArraySizeSoFar + nonStaticsArraySizeSoFar*portionNonStatic(data)] ?? null;
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
                
            }else if(typeof arg === "string" || typeof arg === "symbol"){
                let inputInfo = this.#lookupInput(arg);
                datumByteSize = datumByteSize + inputInfo.datumByteSize

                let getterObject = {getter: (data, i) => {

                    // console.log(`Firing getter with data: ${data} and index ${i}`);
                    
                    if(typer(data)){ // is array
                        // console.log("Getter will return: " + data[arrayOffset(data) + datumArraySizeSoFar + datumArraySize*i]);
                        return data[arrayOffset(data) + datumArraySizeSoFar+ datumArraySize*i] ?? null;
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

            }else{
                throw new Error("FAIL: Something went horribly wrong...");
            }

            datumArraySize++;
        }

        //console.log("this repeat obj has a datum array size of: " + datumArraySize);

        return [datumByteSize, datumArraySize];

    }

    
    // {name: 'x', size: 1, type: 'float'},
    // {name: 'y', size: 1, type: 'float'},
    // {name: 'a', size: 1, type: 'float'},
    // {name: 'b', size: 1, type: 'float'} <------ inputs have this form
    #lookupInput(name){
        let inputObject = this.#inputs.find(el => el.name === name);

        if(!inputObject){
            throw new Error(`FAIL: Input "${name}" was not found for this layout`);
        }

        let datumByteSize = inputObject.size*typeInfo[inputObject.type].bitSize / 8;
        let getter = dataViewGetAndSet[inputObject.type].get;
        let setter = dataViewGetAndSet[inputObject.type].set;

        return {datumByteSize, getter, setter};
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

    getValue(input, data, ...indices){
        if(!this.#getters[input]){
            throw new Error(`FAIL: This layout does not have data related to input ${input}`);
        }

        if(indices.length === 0){
            throw new Error(`FAIL: At least one index is required for grabbing data!`);
        }

        let getter = this.#getters[input];
        let getterDim = this.#calculateGetterDim(getter.tree, 0);

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
            [leftoverIndex, result] = this.#descendGetterTreeSingle(getter.tree, indices[0], data); 
        }else{
            [leftoverIndex, result] = this.#descendGetterTree(getter.tree, indices, data); 
        }
        
        //console.log("leftover Index: " + leftoverIndex);

        return result;

    }

    getNextValue(input, data){

        if(!this.#getters[input]){
            throw new Error(`FAIL: This layout does not have data related to input ${input}`);
        }

        let leftover;
        let result = null;

        if(!this.#savedCallsStore[input]){
            this.#savedCallsStore[input] = [];

            this.#savedCallsQueue = this.#savedCallsStore[input];

            let getter = this.#getters[input];
            console.log("initial");
            [leftover, result] = this.#descendGetterTreeSingle(getter.tree, 0, data, true);
            console.log("END");

            return result;
        }

        this.#savedCallsQueue = [];
        this.#savedCalls = this.#savedCallsStore[input];

        console.log("Before search length: " + this.#savedCalls.length)

        while(this.#savedCalls.length !== 0){

            console.log("Trying next saved call...");

            let lastCall = this.#savedCalls.pop();
            [leftover, result] = lastCall();

            if(result){
                break;
            }

        }

        this.#savedCalls.push(...this.#savedCallsQueue);

        console.log("After search length: " +  this.#savedCalls.length);
        
        
        return result;

    }

    // TODO: Notes for improvements to the getter descends....
        // --> To make it more homogenous, get rid of checking to what the child is before recursing into them, just make recurse and handle as needed.

    #descendGetterTreeSingle(node, index, data, shouldSave = false, r = 0, k = 0){ // for now write this only for a single dimensional index...
        
        console.log("Inside tree descent, index: " + index);

        if(node.node.isRepeatParent){

            console.log("node is a repeat parent");

            if(node.node.isFlat){ // this implies that the single child node is a data grab node....

                //console.log("node is flat");

                let childrenCnt = node.children.length;
                let numberOfPts = childrenCnt * node.node.repeats(data);
        
                if(index < numberOfPts){
                    //console.log("calling getter with index: " + Math.floor(index/childrenCnt));

                    shouldSave && this.#savedCallsQueue.unshift(() => this.#descendGetterTreeSingle(node, index + 1, data, true, 0, 0));

                    return [null, node.children[index % childrenCnt].node.getter(data, Math.floor(index/childrenCnt))];
                }
        
                return [index - numberOfPts, null];
        
            } // else is not flat.... have to visit each child to extract out index offset...

            let starterIndex = k;

            for(let i = r; i < node.node.repeats(data); i++){
                console.log("doing a repeat iteration!")
                for(let j = starterIndex; j < node.children.length; j++){
                    let child = node.children[j];

                    //console.log("Iterating next repeat child");

                    if(child.node.isDataGrab){
                        if(index === 0){
                            //console.log("calling datagrab getter with i: " + i);
                            shouldSave && this.#savedCallsQueue.unshift(() => this.#descendGetterTreeSingle(node, 0, data, true, i, j + 1));
                            return [null, child.node.getter(data, i)]
                        }else{
                            index--;
                        }

                        continue;
                    }

                    //console.log("calling non-datagrab getter with i: " + i);
                    let [newIndex, result] = this.#descendGetterTreeSingle(child, index, child.node.getter(data, i), shouldSave);
                    
                    if(result){
                        shouldSave && this.#savedCallsQueue.unshift(() => this.#descendGetterTreeSingle(node, 0, data, true, i, j + 1));
                        return [null, result];
                    }

                    index = newIndex;

                }

                starterIndex = 0;
            }
        }else{ // not a repeat parent...

            console.log("node is not a repeat parent");

            for(let j = k; j < node.children.length; j++){
                let child = node.children[j];
                //console.log("next iterations, not a repeat");

                if(child.node.isDataGrab){
                    if(index === 0){
                        //console.log("Calling a non-repeat getter that is a datagrab");
                        shouldSave && this.#savedCallsQueue.unshift(() => this.#descendGetterTreeSingle(node, 0, data, true, 0, j + 1));
                        return [null, child.node.getter(data)]
                    }else{
                        index--;
                    }

                    continue;
                }

                //console.log("Calling a non-repeat getter that is not a datagrab");
                let [newIndex, result] = this.#descendGetterTreeSingle(child, index, child.node.getter ? child.node.getter(data) : data, shouldSave);

                if(result !== null){
                    shouldSave && this.#savedCallsQueue.unshift(() => this.#descendGetterTreeSingle(node, 0, data, true, 0, j+1));
                    return [null, result];
                }

                index = newIndex;
            }
        }

        //console.log("have not exhausted indices, returning with index: " + index);

        return [index, null];
    }

    #descendGetterTree(node, indices, data){

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

            return this.#descendGetterTree(child, newIndices, child.node.getter(data, index));
            
        }else{
            // console.log("indices: ");
            // console.log(indices);
            return this.#descendGetterTree(child, indices, child.node.getter ? child.node.getter(data) : data);
        }
        
    }

    #calculateGetterDim(getterObj, dim){

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
            return this.#calculateGetterDim(getterObj.children[0], thisDim); // this is a little non obvious why this works, it might be better to write this in a more self documenting way.
        }

    }

    #mustBeArray(data){
        if(!(data instanceof Array)){
            throw new Error("FAIL: Data must have type array!!");
        }
    }

    get dim(){
        return this.#dims.length;
    }

    get paramNames(){
        return this.#params.keys();
    }

    getDimOfInput(input){
        if(this.#getters[input]){
            return null;
        }

        let getter = this.#getters[input];

        return this.#calculateGetterDim(getter.tree, 0);
    }

}


export default Layout;
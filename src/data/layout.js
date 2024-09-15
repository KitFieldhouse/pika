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


class layout { // [repeat([repeat(x), repeat(y)]), [repeat(x), repeat([z])]]

    #dims = [];
    #params = {};
    #inputs;

    #getters = {}; // {x: {map: <MAP>, tree: <TREE>}} would be for a single input (x)

    constructor(layoutArr, inputs){

        if(!(layoutArr instanceof Array)){
            throw new Error("FAIL: Layout takes a single layout array as its argument");
        }

        this.#inputs = inputs;

        this.#parseArray(layoutArr, [root]);

        console.dir(this.#getters, { depth: null })
        console.log(this.#getters['x'].map.get(root));
        console.log(this.#getters['x'].tree);

    }

    #parseArray(array, path){ // lets start this mofo over again......

        // first iteration, check if this is a flatten-able structure (i.e it is composed of strings and flatten-able repeat objects only). Also,
        // does the basic syntax type checking while I am at it....

        // TODO: this could probably be optimized out?? Anyways, lets give it a shot...

        let isFlat = null; // guilty until proven innocent

        console.log("parsing an array");

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


        let typer = (data) => { // typers return true if type is an array, false if it is a buffer. Throws an error if
                                // the provided data type is not coherent with the data descriptors

            if(!(data instanceof Array)){
                throw new Error(`FAIL: Expected Array, got type ${typeof data}`);
            }

            if(data.length === 1 && data[0] instanceof ArrayBuffer){
                if(isFlat){
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

                // console.log(data.length);
                // console.log(staticsArraySize);
                // console.log(nonStaticsArraySize);

                if( (data.length - staticsArraySize) !== 0 && (data.length - staticsArraySize) % nonStaticsArraySize !== 0){
                    throw new Error("FAIL: Can not chop up provided data array in even chunks of data descriptor!!");
                }

                return (data.length - staticsArraySize) === 0 ? 0 : (data.length - staticsArraySize)/nonStaticsArraySize;
            }else{
                if((data.byteLength - staticsByteSize) !== 0 && (data.byteLength - staticsByteSize) % nonStaticsByteSize !== 0){
                    throw new Error("FAIL: Can not chop up provided data array in even chunks of data descriptor!!");
                }

                return (data.byteLength - staticsByteSize) === 0 ? 0 : (data.byteLength - staticsByteSize) / nonStaticsByteSize ;
            }
        }

        // left of here, need to pass these to the individual repeats, and also for the arrays to since the grabbers there are also important!!

        for(let el of array){

            let staticsByteSizeSoFar = staticsByteSize;
            let staticsArraySizeSoFar = staticsArraySize;

            let nonStaticsArraySizeSoFar = nonStaticsArraySize;
            let nonStaticsByteSizeSoFar = nonStaticsByteSize;

            if(typeof el === "object" && !(el instanceof Array)){

                console.log("found object inside this array");

                if(el.opts.size){
                    let size = el.opts.size;
                    let [datumByteSize, datumArraySize] = this.#parseRepeat(el, ()  => size, [...path, {isRepeatParent: true, isFlat: isFlat, repeats: () => size} ], typer,
                        (data) => staticsArraySizeSoFar + nonStaticsArraySizeSoFar*portionNonStatic(data),
                        (data) => staticsByteSizeSoFar + nonStaticsByteSizeSoFar*portionNonStatic(data));

                    staticsArraySize = staticsArraySize + datumArraySize*size;
                    staticsByteSize = staticsByteSize + datumByteSize*size;

                    console.log("statically sized object");
                    console.log(el.opts.size);

                }else{
                    let [datumByteSize, datumArraySize] = this.#parseRepeat(el, portionNonStatic, [...path, {isRepeatParent: true, isFlat: isFlat, repeats: portionNonStatic} ], typer,
                        (data) => {
                            console.log(`staticsArraySizeSoFar is ${staticsArraySizeSoFar} and nonStaticsArraySizeSoFar is ${nonStaticsArraySizeSoFar} and the portionNonStatic is ${portionNonStatic(data)}`);
                            return staticsArraySizeSoFar + nonStaticsArraySizeSoFar*portionNonStatic(data);
                        },
                        (data) => staticsByteSizeSoFar + nonStaticsByteSizeSoFar*portionNonStatic(data));

                    nonStaticsArraySize = nonStaticsArraySize + datumArraySize;
                    nonStaticsByteSize = nonStaticsByteSize + datumByteSize;

                    console.log("dynamically sized object");
                    console.log("dynamically sized, nonStaticsArraySizeSoFar: " + nonStaticsArraySizeSoFar);
                }

            }else if(el instanceof Array){
                console.log("found arr inside this arr");
                staticsArraySize++;
                staticsByteSize = null; // cant have byte offsets since this cannot be inside an array buffer...

                this.#parseArray(el, [...path, {getter: (data) =>  {console.log(`Firing getter with data: ${data}`); 
                    return data[staticsArraySizeSoFar + nonStaticsArraySizeSoFar*portionNonStatic(data)]}
                    , isRepeat: false}]);

            }else{ // typeof el === "string" || typeof el === "symbol" must be true

                console.log("found other inside this arr (hopefully either a string or a symbol)");

                staticsArraySize++;

                let inputInfo = this.#lookupInput(el);
                staticsByteSize = staticsByteSize + inputInfo.datumByteSize;

                let getterObject = {getter: (data) => {

                    console.log(`Firing getter with data: ${data}`);
                    
                    if(typer(data)){ // is array
                        return data[staticsArraySizeSoFar + nonStaticsArraySizeSoFar*portionNonStatic(data)]
                    }else{ // is buffer
                        let view = new DataView(data[0]);
                        return view[inputInfo.getter](staticsByteSizeSoFar + nonStaticsByteSizeSoFar*portionNonStatic(data));
                    }

                }, isDataGrab: true, numberOfPts: () => 1}

                let adjustedPath = [...path, getterObject];

                this.#reconcileWithGetterTree(el, adjustedPath);
            }

        }

        return [null,1]; // returns array of [datumByteSize, datumArraySize]

    }
    
    
    #parseRepeat(repeatObj, repeatsAlloted, path, typer, arrayOffset, byteOffset){ // need to keep track of argument level offset <--- left off here

        console.log("parsing a repeat obj");

        let datumByteSize = 0;
        let datumArraySize = 0;

        for(let arg of repeatObj.arguments){

            let datumByteSizeSoFar = datumByteSize;
            let datumArraySizeSoFar = datumArraySize;

            if(arg instanceof Array){

                datumByteSize = null;


                let getterObject = {getter: (data, i) => {
                    console.log(`Firing getter with data: ${data} and index ${i}`);
                    console.log("getter will return: " + data[arrayOffset(data) + datumArraySizeSoFar + datumArraySize*i]);
                    console.log("Offset: " + arrayOffset(data));
                    return data[arrayOffset(data) + datumArraySizeSoFar + datumArraySize*i];
                    }, isRepeat: true, repeats: repeatsAlloted}

                let adjustedPath = [...path, getterObject];

                this.#parseArray(arg, adjustedPath);
                
            }else if(typeof arg === "string" || typeof arg === "symbol"){
                let inputInfo = this.#lookupInput(arg);
                datumByteSize = datumByteSize + inputInfo.datumByteSize

                let getterObject = {getter: (data, i) => {

                    console.log(`Firing getter with data: ${data} and index ${i}`);
                    
                    if(typer(data)){ // is array
                        console.log("Getter will return: " + data[arrayOffset(data) + datumArraySizeSoFar + datumArraySize*i]);
                        return data[arrayOffset(data) + datumArraySizeSoFar+ datumArraySize*i];
                    }else{ // is buffer
                        let view = new DataView(data[0]);
                        return view[inputInfo.getter](byteOffset(data) + datumByteSizeSoFar +  datumByteSize*i);
                    }

                }, isDataGrab: true, numberOfPts: repeatsAlloted ,isRepeat: true, repeats: repeatsAlloted}

                let adjustedPath = [...path, getterObject];

                this.#reconcileWithGetterTree(arg, adjustedPath);

            }else{
                throw new Error("FAIL: Something went horribly wrong...");
            }

            datumArraySize++;
        }

        console.log("this repeat obj has a datum array size of: " + datumArraySize);

        return [datumByteSize, datumArraySize];

    }

    
    // {name: 'x', size: 1, type: 'float'},
    // {name: 'y', size: 1, type: 'float'},
    // {name: 'a', size: 1, type: 'float'},
    // {name: 'b', size: 1, type: 'float'} <------ inputs have this form
    #lookupInput(name){
        let inputObject = this.#inputs.find(el => el.name === name);

        if(!inputObject){
            throw new Error("FAIL: Input described that is not a valid input object!!");
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


        let [leftoverIndex, result] = this.#descendGetterTreeSingle(getter.tree, indices[0], data); 

        console.log("leftover Index: " + leftoverIndex);

        return result;

    }

    #descendGetterTreeSingle(node, index, data){ // for now write this only for a single dimensional index...
        
        console.log("Inside tree descent, index: " + index);

        if(node.node.isRepeatParent){

            console.log("node is a repeat parent");

            if(node.node.isFlat){ // this implies that the single child node is a data grab node....

                console.log("node is flat");

                let childrenCnt = node.children.length;
                let numberOfPts = childrenCnt * node.node.repeats(data);
        
                if(index < numberOfPts){
                    console.log("calling getter with index: " + floor(index/childrenCnt));
                    return [null, node.children[index % childrenCnt].node.getter(data, floor(index/childrenCnt))];
                }
        
                return [index - numberOfPts, null];
        
            } // else is not flat.... have to visit each child to extract out index offset...

            for(let i = 0; i < node.node.repeats(data); i++){
                for(let child of node.children){

                    console.log("Iterating next repeat child");

                    if(child.node.isDataGrab){
                        if(index === 0){
                            console.log("calling datagrab getter with i: " + i);
                            return [null, child.node.getter(data, i)]
                        }else{
                            index--;
                        }

                        continue;
                    }

                    console.log("calling non-datagrab getter with i: " + i);
                    let [newIndex, result] = this.#descendGetterTreeSingle(child, index, child.node.getter(data, i));
                    
                    if(result){
                        return [null, result];
                    }

                    index = newIndex;

                }
            }
        }else{ // not a repeat parent...

            console.log("node is not a repeat parent");

            for(let child of node.children){

                console.log("next iterations, not a repeat");

                if(child.node.isDataGrab){
                    if(index === 0){
                        console.log("Calling a non-repeat getter that is a datagrab");
                        return [null, child.node.getter(data)]
                    }else{
                        index--;
                    }

                    continue;
                }

                console.log("Calling a non-repeat getter that is not a datagrab");
                let [newIndex, result] = this.#descendGetterTreeSingle(child, index, child.node.getter ? child.node.getter(data) : data);

                if(result){
                    return [null, result];
                }

                index = newIndex;
            }
        }

        console.log("have not exhausted indices, returning with index: " + index);

        return [index, null];
    }

    #calculateGetterDim(getterObj, dim){

        if(getterObj.children.length > 1 && !getterObj.node.isRepeatParent){
            return NaN;
        }

        let thisDim = dim;


        if(getterObj.node.isRepeatParent){
            thisDim++;
        }

        if(getterObj.children.length === 0){
            return thisDim;
        }else{
            return this.#calculateGetterDim(getterObj.children[0], thisDim)
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

}


export default layout;


      // for(let element of layoutArray){
        //     if(typeof element === "object"){
        //         if(!element[isLayoutObj]){
        //             throw new Error("FAIL: Layout should be composed of only arrays and objects generated by GL.repeat variants!");
        //         }

        //         isFlat = isFlat && element.isLayout;
        //     }
        // }

        // if(isFlat)


        // #parseLayout(layoutVal, getter, dim, byteoffset, ptOffset, u, insideRepeat){ // TODO: are the parentRepeats really going to be needed??

        //     let dataTypeCheck = () => true; // for now, based on the information found this will be adjusted
        //     let iteratingOverRepeat;
        //     let iterator;
                    
        //     let totalByteSize = [0,0];
        //     let totalPtSize = [0,0];
     
        //     if(!insideRepeat){
        //      let levelU = null;
        //     }
     
     
        //     if(layoutVal instanceof Array){
        //      iteratingOverRepeat = false;
        //      iterator = layoutVal;
        //     }else{
        //      iteratingOverRepeat = true;
        //      iterator = layoutVal.arguments;
        //     }
     
     
        //      for(element of iterator){
     
        //          if(element instanceof Array){
     
        //              dataTypeCheck = this.#mustBeArray();
     
        //              let levelGetter = (array, opts, ...indices) => {
        //                  let lastIndex = indices.pop();
        //                  let data = getter(array, opts, ...indices)[lastIndex]
        //                  dataTypeCheck(data);
        //                  return data;
        //              }
     
        //              this.#parseLayout(element, levelGetter, dim + 1, [0,0], [0,0], levelU, false);
        //              totalPtSize[1] = totalPtSize[1] + 1;
                     
        //          }else if(typeof element === "object"){
        //              if(!element[isLayoutObj]){
        //                  throw new Error("FAIL: Layout should be composed of only arrays and objects generated by GL.repeat variants!");
        //              }
     
        //              if(!element.isLayout){
        //                  dataTypeCheck = this.#mustBeArray();
        //              }
     
     
     
        //          }else{
        //              throw new Error("FAIL: Layout should be composed of only arrays and objects generated by GL.repeat variants!");
        //          }
        //      }
     
        //      this.#dims[dim] = {stuff: 'stuff'};
        //      return;
        //  }
     
        //  #parseInFlatRepeat(layoutObj, getter, byteoffset, ptOffset, u){ // datumSize has form [a,b] where its a*u + b = totalByteSize
             
        //      let totalByteSize = [0,0];
        //      let totalPtSize = [0,0]
     
        //      for(let arg of layoutObj.arguments){
        //          if(typeof arg === "object"){
        //              let [a, b, pta, ptb] = this.#parseInFlatRepeat(arg, getter, [...totalByteSize], u);
     
        //              if(!arg.opts.size && a){
        //                  throw new Error("FAIL: Not enough sizing opts have been given to determine an unpacking algo!");
        //              }else if(!arg.opts.size && !a){
        //                  totalByteSize[0] = totalByteSize[0] + b;
        //                  totalByteSize[1] = 0;
     
        //                  totalPtSize[0] = totalPtSize[0] + ptb;
        //                  totalPtSize[1] = 0;
        //              }else{
        //                  totalByteSize[0] = totalByteSize[0] + arg.opts.size*a;
        //                  totalByteSize[1] = totalByteSize[1] + arg.opts.size*b;
     
        //                  totalPtSize[0] = totalPtSize[0] + arg.opts.size*pta;
        //                  totalPtSize[1] = totalPtSize[1] + arg.opts.size*ptb;
        //              }
        //          }else{ // must be a symbol or string, if anything else we will have thrown an error
        //              let closeArg = arg;
        //              let totalByteSizeSoFar = [...totalByteSize];
        //              let totalPtSizeSoFar = [...totalPtSize];
     
        //              let arrayBufferGetter = (index, dataParent) =>
        //                  {
        //                      let data = getter(0,dataParent);
     
        //                      if(data.length === 1 && data[0] instanceof ArrayBuffer){
     
        //                          return data[dataViewGetAndSet[this.#lookupInput(closeArg).type].get](byteoffset[0]*u(dataInst) + byteoffset[1]  + 
        //                          totalByteSizeSoFar[0]*u(dataInst) + totalByteSizeSoFar[1] + 
        //                          (totalByteSize[0]*u(dataInst) + totalByteSize[1])*index);
     
        //                      }else if(data[0] instanceof Number){
     
        //                          return data[ptOffset[0]*u(dataInst) + ptOffset[1]  + 
        //                          totalPtSizeSoFar[0]*u(dataInst) + totalPtSizeSoFar[1] + 
        //                          (totalPtSize[0]*u(dataInst) + totalPtSize[1])*index];
     
        //                      }else{
        //                          throw new Error("FAIL: BAD INPUT DATA FORMAT");
        //                      }
     
        //                     // next thing to look at is dataum vs total size..... // totalByteSize closure vs totalByteSize so far....
        //                  }
     
        //                  totalByteSize[1] = totalByteSize[1] + this.#lookupInput(arg);
        //                  totalPtSize[1] = totalPtSize[1] + 1;
        //          }
        //      }
     
        //      return [...totalByteSize, ...totalPtSize];
        //  }


        // {tree: {
        //     node: { getter: [Function: rootGetter], isRepeat: false },
        //     children: [
        //       {
        //         node: {
        //           getter: [Function: getter],
        //           isDataGrab: true,
        //           numberOfPts: [Function (anonymous)],
        //           isRepeat: true,
        //           repeats: [Function (anonymous)]
        //         },
        //         children: []
        //       },
        //       {
        //         node: {
        //           getter: [Function: getter],
        //           isRepeat: true,
        //           repeats: [Function (anonymous)]
        //         },
        //         children: [
        //           {
        //             node: {
        //               getter: [Function: getter],
        //               isDataGrab: true,
        //               numberOfPts: [Function (anonymous)],
        //               isRepeat: true,
        //               repeats: [Function (anonymous)]
        //             },
        //             children: []
        //           }
        //         ]
        //       }
        //     ]
        //   }}
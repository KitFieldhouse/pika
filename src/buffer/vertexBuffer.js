import {typeInfo, dataViewGetAndSet} from "../private/types.js"

const acceptedDataSources = ["client", "VertexBuffer"];

const deleteInfoKeys = ['side', 'amount', 'lazy'];


class VertexBuffer{

    #bufferViews = []; // TODO: write description of what a subBufferView is

    #buffer; // this is a reference to the gl buffer.

    #gl;

    #resizeFunction;

    #layoutAtoms;
    #inputInfo;

    #inputViewMap = {};

    #usedInputs = [];

    static temporaryArrayBufferRepeats = 1000; // for sizing array buffers that will be filled with unwrapped data

    constructor(layoutAtoms, inputInfo, gl, initialData = null, opts = {}){
        this.#gl = gl;
        this.#layoutAtoms = layoutAtoms;
        this.#inputInfo = inputInfo;

        this.#resizeFunction = (opts && opts.resizeFunction) ? opts.resizeFunction : (repeatAmount, resizes) => repeatAmount*resizes;

        let startByteIndex = 0;
        let bufferView;

        for(let layoutAtom of layoutAtoms){
            bufferView = new SubBufferView(startByteIndex , layoutAtom , inputInfo, this.#resizeFunction);
            startByteIndex = bufferView.endByteIndex;
            this.#bufferViews.push(bufferView);
            layoutAtom.arguments.forEach(el => this.#inputViewMap[el] = bufferView);
        }

        this.#usedInputs = Object.keys(this.#inputViewMap);

        this.#buffer = this.#createEmptyBuffer(this.bufferByteSize);

        if(initialData){
            this.sizeDataAdd(initialData.source, initialData.layout, initialData.data, false, false, {}, initialData.opts).doAdd();
        }
    }

    get bufferByteSize(){
        return this.#bufferViews[this.#bufferViews.length - 1].endByteIndex;
    }

    #addData(dataSource , dataList, isAppendList, opts){

        if(dataList.length !== this.#bufferViews.length){
            throw new Error("FAIL: Provided data array must have a value for each subview of this buffer"); // is this needed??
        }


        //TODO: see if this algo couldn't be optimized in some way.....

        let startingDataIndices = this.#bufferViews.map(el => [el.dataStartByteIndex, el.dataEndByteIndex]);

        let doesNotNeedResize = true;
        let data = null;
        let byteShift = null;

        for(let i = 0; i < dataList.length; i++){
            data = dataList[i];

            if(data == null || data.length === 0){
                continue
            }

            byteShift = isAppendList[i] ? this.#bufferViews[i].checkResizeAppend(data.byteLength) :  this.#bufferViews[i].checkResizePrepend(data.byteLength)

            if(byteShift != null){
                doesNotNeedResize = false;
                this.#adjustAllIndices(i+1, byteShift);
            }

        }

        if(!doesNotNeedResize){
            let newBuffer = this.#createEmptyBuffer(this.bufferByteSize);
            this.#gl_translateDataIntoBuffer(newBuffer, startingDataIndices);
            this.#gl.gl.deleteBuffer(this.#buffer);
            this.#buffer = newBuffer;
            // TODO: once I incorporate VAO's, I will have to notify them here!
            // one way of doing this is by defining a setter on this.#buffer....
        }

        // copy data into the buffers
        for(let i = 0; i < dataList.length; i++){
            
            let view = this.#bufferViews[i];
            let data = dataList[i];

            if(data == null){
                continue
            }

            let writeIndex = isAppendList[i] ? view.dataEndByteIndex : (view.dataStartByteIndex - data.byteLength); 

            this.#copyData(dataSource , writeIndex, data, 
                isAppendList[i] ? () => view.adjustWriteIndexAppend(data.byteLength):
                           () => view.adjustWriteIndexPrepend(data.byteLength));
        }

    }

    #deleteData(amountList, isFromEndList, isLazyList){ // this is the internal function that actually does the actual deleting of data.....

        if(amountList.length !== this.#bufferViews.length || isFromEndList.length !== this.#bufferViews.length || isLazyList.length !== this.#bufferViews.length){
            throw new Error("FAIL(INTERNAL): Failed to provide delete data with the correct number of items in its argument lists!!");
        }


        //TODO: see if this algo couldn't be optimized in some way.....

        let startingDataIndices = this.#bufferViews.map(el => [el.dataStartByteIndex, el.dataEndByteIndex]);

        let doesNotNeedResize = true;
        let amount = null;
        let shrinkAmount = null;

        for(let i = 0; i < amountList.length; i++){
            amount = amountList[i]*this.#bufferViews[i].datumByteSize;

            if(!amount){
                continue
            }

            shrinkAmount = isFromEndList[i] ? this.#bufferViews[i].checkResizeEndDelete(amount) :  this.#bufferViews[i].checkResizeStartDelete(amount)

            if(shrinkAmount != null){
                doesNotNeedResize = false;
                this.#adjustAllIndices(i+1, -shrinkAmount);
            }

        }

        if(!doesNotNeedResize){
            let newBuffer = this.#createEmptyBuffer(this.bufferByteSize);
            this.#gl_translateDataIntoBuffer(newBuffer, startingDataIndices);
            this.#gl.gl.deleteBuffer(this.#buffer);
            this.#buffer = newBuffer;
            // TODO: once I incorporate VAO's, I will have to notify them here!
            // one way of doing this is by defining a setter on this.#buffer....
        }
    }
    
    sizeDataDelete(deleteInfo){
        //  deleteInfo is an object of objects of the form 
        //  {<input>: {input: <name>, side: <'start', 'end'> -- should default to natural data flow, 
        //  amount: <amount> -- should default to all, lazy: <true/false> -- default of false}, .......}

        let effectedByOperation = false

        for(let usedInput of this.#usedInputs){
            if(deleteInfo[usedInput]){
                effectedByOperation = true;
                break;
            }
        }

        if(!effectedByOperation){
            return {pointsDeleted: [0], doDelete: () => null}
        }

        let deleteAmounts = [];
        let deleteFromEnds = [];
        let isLazy = [];

        for(let layoutAtom of this.#layoutAtoms){
            
            if(!this.#allInputsAreInDeleteInfo(layoutAtom, deleteInfo)){
                if(this.#noInputsAreInDeleteInfo(layoutAtom, deleteInfo)){
                    deleteAmounts.push(0);
                    deleteFromEnds.push(null);
                    isLazy.push(null);
                    continue;
                }else{
                    throw new Error("FAIL: all inputs in a layout atom must be deleted together");
                }
            }

            // in this case we know that all inputs for this layout have delete info, now we need to make sure that delete info is consistent....

            let deleteInfoForAtom = layoutAtom.arguments.map(el => deleteInfo[el]);

            if(!this.#isDeleteInfoConsistent(deleteInfoForAtom)){
                throw new Error("FAIL: delete info for inputs in the same layout atom must have the same values");
            }

            deleteInfoForAtom = deleteInfoForAtom[0]; // choose the first since we just checked that they are all the same....

            let cappedAmount = deleteInfoForAtom.amount && 
                               (deleteInfoForAtom.amount < this.numberOfPoints(layoutAtom.arguments[0]) ?deleteInfoForAtom.amount  : this.numberOfPoints(layoutAtom.arguments[0]));

            deleteAmounts.push(cappedAmount || this.numberOfPoints(layoutAtom.arguments[0]));

            if(deleteInfoForAtom.side){
                if(deleteInfoForAtom.side === "start"){
                    deleteFromEnds.push(false);
                }else if(deleteInfoForAtom.side === "end"){
                    deleteFromEnds.push(true);
                }else{
                    throw new Error("FAIL: in a delete info object the key 'side' can have value of only either 'start' or 'end'");
                }
            }else{
                deleteFromEnds.push(!(layoutAtom.repeatType === 'end'));
            }

            isLazy.push(!!(deleteInfoForAtom.lazy));

        }

        return {pointsDeleted: deleteAmounts, 
                doDelete: () => this.#deleteData(deleteAmounts, deleteFromEnds, isLazy)};

    }

    sizeDataAdd(dataSource, layout, data, allAppend, allPrepend, addMethods, opts = {}){

        if(!acceptedDataSources.includes(dataSource)){
            throw new Error(`FAIL: VertexBuffer cannot accept a data source of ${dataSource}. \n Accepted sources: ${JSON.stringify(acceptedDataSources)}`);
        }

        //first check to see if the layout for the data actually contains the inputs contained in the vertex buffer

        let layoutUsesAInput = false

        for(let usedInput of this.#usedInputs){
            if(layout.usesInput(usedInput)){
                layoutUsesAInput = true;
                break;
            }
        }

        if(!layoutUsesAInput){
            return {pointsAdded: [0], doAdd: () => null, numberOfDirectCopies: 0}
        }

        let translatedDataSets = []; // array of objects of the form {data: [], pts: <number of points>}
        let numberOfDirectCopies = 0;

        if(opts.inputsToAdd){
            for(let i = 0; i < this.#layoutAtoms.length; i++){

                let layoutAtom = this.#layoutAtoms[i];
                let argsInInputsToAdd = layoutAtom.arguments.filter(el => opts.inputsToAdd.includes(el));

                if(argsInInputsToAdd.length === 0){
                    translatedDataSets[i] = {data: null, pts: 0, isAppend: null};
                }else if(argsInInputsToAdd.length !== layoutAtom.arguments.length){
                    throw new Error("FAIL: VertexBuffer requires that all inputs in a layout atom are either all effected by the prepend/append operation or none are");
                }
            }
        }

        
        // now check to see if we have any lone top flat repeats that match the layout atoms for this vertex buffer. If so, we can simply just copy the data 
        // from its source without performing any unwrapping


        if(!opts.skipCopyMatching){

            atomLoop: for(let i = 0; i < this.#layoutAtoms.length; i++){ // TODO: still need to get into buffer mode!! (not sure what this todo means...)

                if(translatedDataSets[i]){
                    continue;
                }

                let layoutAtom = this.#layoutAtoms[i];

                if(opts.indexTransformers){
                    for(let arg of layoutAtom.arguments){
                        if(opts.indexTransformers[arg]){
                            translatedDataSets[i] = null;
                            continue atomLoop;
                        }
                    }
                }

                if(!this.#atMostOneDataLayoutForOneInput(layoutAtom, layout)){
                    translatedDataSets[i] = null;
                    continue;
                }

                let matchingLTFR = layout.loneTopFlatRepeats.find(LTFRAtom => this.#canDirectCopy(LTFRAtom, layoutAtom));
                let directCopyCandidate = matchingLTFR? matchingLTFR.getter(data): null;

                if(directCopyCandidate && !(directCopyCandidate instanceof Array)){
                    numberOfDirectCopies++;
                    translatedDataSets[i] = {data: directCopyCandidate, pts: matchingLTFR.size(data), 
                                                isAppend: this.#isAppendAddTypeForAtom(layoutAtom, addMethods, allAppend, allPrepend)}
                }else{
                    translatedDataSets[i] = null;
                } 

            }
        }

          // TODO: there is probably some things I can do to increase the time efficiency of sizing non-flat repeats.... ??????

        
        for(let i = 0; i < this.#layoutAtoms.length; i++){
            if(!translatedDataSets[i]){
                translatedDataSets[i] = {...this.#repackData(this.#layoutAtoms[i], layout, data, opts),
                                        isAppend: this.#isAppendAddTypeForAtom(this.#layoutAtoms[i], addMethods, allAppend, allPrepend) };
            }else{
                continue;
            }
        }

        return {pointsAdded: translatedDataSets.map(el => el.pts), 
            doAdd: () => this.#addData(dataSource , translatedDataSets.map(el => el.data), translatedDataSets.map(el => el.isAppend), opts ?? null), 
            numberOfDirectCopies};

    }

    #repackData(layoutAtom, dataLayout, data, opts = {}){

        if(!this.#allInputsAreInDataLayout(layoutAtom, dataLayout)){
            if(this.#noInputsAreInDataLayout(layoutAtom, dataLayout)){
                return {data: null, pts: 0, isAppend: null};
            }else{
                throw new Error("FAIL: VertexBuffer requires inputs grouped in the same repeat statement to have the same number of points!"); // TODO: improve error message
            }
        }

        let datumByteSize = layoutAtom.arguments.reduce( (acc, el) => acc + this.#inputInfo[el].size*typeInfo[this.#inputInfo[el].type].bitSize, 0)/8.0;

        // TODO: need to do some thinking here on if copying to an array as an intermediate causes this to be slow.

        // at this point I need to test the difference between filling an array and then filling a buffer vs what I 
        // have now which is immediately filling the buffer used by the buffer for filling....

        let buffer = new ArrayBuffer(VertexBuffer.temporaryArrayBufferRepeats*datumByteSize);
        let view = new DataView(buffer);
        let views = [view];
        let iterators = layoutAtom.arguments.map(el => dataLayout.createInputIterator(el, data, opts.indexTransformers && opts.indexTransformers[el]));

        let allDone = false;
        let offset = 0;

        while(!allDone){
            let iteration = iterators.map(el => el.next());
            let values = iteration.map(el => el.value);

            let numberOfNulls = values.filter(el => el == null).length;

            if(numberOfNulls !== 0 && numberOfNulls !== values.length){
                throw new Error("FAIL: VertexBuffer requires inputs grouped in the same repeat statement to have the same number of points!"); // TODO: improve error message
            }else if(numberOfNulls !== 0 && numberOfNulls ===values.length){
                allDone = true;
                break;
            }

            // at this point we have data and need to update our dummy buffer....

            if(offset === buffer.byteLength){
                buffer = new ArrayBuffer(VertexBuffer.temporaryArrayBufferRepeats*datumByteSize);
                view = new DataView(buffer);
                offset = 0;
                views.push(view);
            }

            for(let i = 0; i < layoutAtom.arguments.length; i++){
                let arg = layoutAtom.arguments[i];
                let value = values[i];
                
                let nonVectorSize = typeInfo[this.#inputInfo[arg].type].bitSize/8.0;

                for(let k = 0; k < this.#inputInfo[arg].size; k++){
                    view[dataViewGetAndSet[this.#inputInfo[arg].type].set](offset, value[k] ?? value, true);
                    offset = offset + nonVectorSize;
                }

            }
        }

        // at this point we have may have an array of filled array views that need to be coagulated..

        let finalByteSize = (views.length - 1) * VertexBuffer.temporaryArrayBufferRepeats*datumByteSize + offset;
        let finalBuffer = new ArrayBuffer(finalByteSize);
        let finalView = new DataView(finalBuffer);

        // copy data with largest step possible...hopefully this is in 64 bit chunks for as long as possible...



        let byteStepsWithGetSet = [{size: 8, get: "getBigUint64", set: "setBigUint64"}, {size: 4, get: "getUint32", set: "setUint32"}, {size: 2, get: "getUint16", set: "setUint16"}, {size: 1, get: "getUint8", set: "setUint8"}]

        let cursor = 0;
        let viewCursor = 0;
        let lastView = views[views.length -1];
        let largestStep = null;

        for(let view of views){

            viewCursor = 0;

            let endOfData = view == lastView? offset : view.byteLength; 

            while(viewCursor < endOfData){
                largestStep = byteStepsWithGetSet.find(el => (endOfData - viewCursor) % el.size === 0); // TODO: this is probably slow...

                finalView[largestStep.set](cursor, view[largestStep.get](viewCursor));

                cursor = cursor + largestStep.size;
                viewCursor = viewCursor + largestStep.size;
            }
        }

        return {data: finalBuffer, pts: finalByteSize/datumByteSize, };

    }

    #isAppendAddTypeForAtom(layoutAtom, addMethods, allAppend, allPrepend){

        // if(allAppend && allPrepend){
        //     throw new Error("FAIL(DEV): Both allAppend and allPrepend can not be asserted at the same time");
        // }

        if(allAppend){
            return true;
        }

        if(allPrepend){
            return false;
        }
      
        let args = layoutAtom.arguments;
        let argsAddMethod = [];
        args.forEach(el => addMethods[el]? argsAddMethod.push(addMethods[el]) : null);

        if(argsAddMethod.length !== args.length && argsAddMethod.length !== 0){
            throw new Error("FAIL: If an input is given an explicit add method, each input that it is in a layout atom with said input also needs to have an explicit add method");
        }

        if(argsAddMethod.length === 0){
            if(layoutAtom.repeatType === "end"){
                return false; // will prepend the data.....
            }else{
                return true
            }
        }

        let methodCandidate = argsAddMethod[0];
        
        let nonMatchers = argsAddMethod.filter(el => el !== methodCandidate);

        if(nonMatchers.length !== 0){
            throw new Error("FAIL: When giving and explicit add method, each input that is in a layout atom with said input also needs to have an explicit add method of the same type");
        }

        if(methodCandidate === "prepend"){
            return false;
        }

        if(methodCandidate === "append"){
            return true;
        }

        throw new Error("FAIL: Unknown add method given: " + methodCandidate);

    }


    #allInputsAreInDeleteInfo(layoutAtom, deleteInfo){

        for(let arg of layoutAtom.arguments){
            if(!deleteInfo[arg]){
                return false
            }
        }

        return true;

    }

    #noInputsAreInDeleteInfo(layoutAtom, deleteInfo){

        for(let arg of layoutAtom.arguments){
            if(deleteInfo[arg]){
                return false
            }
        }

        return true;

    }

    #atMostOneDataLayoutForOneInput(layoutAtom, dataLayout){
        for(let arg of layoutAtom.arguments){
            if(dataLayout.getDataLayoutAtoms(arg) && dataLayout.getDataLayoutAtoms(arg).length > 1){
                return false
            }
        }

        return true;
    }

    #allInputsAreInDataLayout(layoutAtom, dataLayout){
        for(let arg of layoutAtom.arguments){
            if(!dataLayout.getDataLayoutAtoms(arg)){
                return false
            }
        }

        return true;
    }

    #noInputsAreInDataLayout(layoutAtom, dataLayout){
        for(let arg of layoutAtom.arguments){
            if(dataLayout.getDataLayoutAtoms(arg)){
                return false
            }
        }

        return true;
    }

    #canDirectCopy(dataLayoutAtom, layoutAtom){

        if(dataLayoutAtom.repeat.arguments.length !== layoutAtom.arguments.length){
            return false;
        }

        for(let i = 0; i < dataLayoutAtom.repeat.arguments.length; i++){
            if(dataLayoutAtom.repeat.arguments[i] !== layoutAtom.arguments[i]){
                return false;
            }
        }

        return true;

    }

    #isDeleteInfoConsistent(listOfInfo){
        let firstObj = listOfInfo[0];

        for(let info of listOfInfo){
            for(let key of deleteInfoKeys){
                if(info[key] !== firstObj[key]){
                    return false;
                }
            }
        }

        return true;

    }

    // #appendData(dataSource, dataList, opts){ // data is in an array in order of which view it should go to.
    //     this.#addData(dataSource, dataList, opts, true);
    // }

    // #prependData(dataSource, dataList, opts){
    //     this.#addData(dataSource, dataList, opts, false);
    // }

    #adjustAllIndices(startingIndex, byteAmount){
        for(let i = startingIndex; i < this.#bufferViews.length; i++){ // Adjust the indices of the contained buffer views as appropriate
            this.#bufferViews[i].shiftByteIndices(byteAmount);
        }
    }

    #copyData(dataSource, byteIndex, data, indexUpdate){ // copies data from an external (not this gl context) source.

        if(dataSource !== "VertexBuffer"){
            this.#gl.gl.bindBuffer(this.#gl.gl.ARRAY_BUFFER, this.#buffer);
            this.#gl.gl.bufferSubData(this.#gl.gl.ARRAY_BUFFER, byteIndex, data, 0);
        }else{
            console.log(data);
        }

        indexUpdate(data.byteLength);
    }

    #gl_translateDataIntoBuffer(target, originalIndices){ // copies data from current buffer directly into the argument buffer. // THIS NEEDS REFACTORING....

        this.#gl.gl.bindBuffer(this.#gl.gl.COPY_WRITE_BUFFER, target); // read from the supplied buffer and write to the current buffer
        this.#gl.gl.bindBuffer(this.#gl.gl.COPY_READ_BUFFER, this.#buffer);

        let originalStart = null;
        let originalEnd = null;
        let view = null;
        let copySize = null;

        for(let i = 0; i < this.#bufferViews.length; i++){
            [originalStart, originalEnd] = originalIndices[i];
            view = this.#bufferViews[i];
            copySize = (view.dataEndByteIndex - view.dataStartByteIndex) < (originalEnd - originalStart)? (view.dataEndByteIndex - view.dataStartByteIndex) : (originalEnd - originalStart);
            this.#gl.gl.copyBufferSubData(this.#gl.gl.COPY_READ_BUFFER, this.#gl.gl.COPY_WRITE_BUFFER, originalStart, view.dataStartByteIndex, copySize); // transfer the contents of supplied buffer to current buffer...
        }
    }

    #createEmptyBuffer(byteSize){
        let identifier = this.#gl.gl.createBuffer();


        this.#gl.gl.bindBuffer(this.#gl.gl.ARRAY_BUFFER, identifier);

        this.#gl.gl.bufferData(this.#gl.gl.ARRAY_BUFFER, byteSize, this.#gl.gl.DYNAMIC_DRAW); // allocate space for our buffer

        return identifier;
    }

    get layoutAtoms(){
        return this.#layoutAtoms;
    }

    get type(){
        return "VertexBuffer";
    }

    get tests_views(){
        return this.#bufferViews;
    }

    numberOfPoints(input){
        if(!this.#inputViewMap[input]){
            return null
        }
        return this.#inputViewMap[input].dataSize;
    }

}

class SubBufferView{ // next step is to write append, prepend funcs, then fill out the lazy way of doing things, then write a bunch of tests!!

    #repeatSize = 0;

    #startByteIndex = 0;
    #endByteIndex = 0;

    #dataStartByteIndex = 0;
    #dataEndByteIndex = 0;

    #datumByteSize = 0;

    #resizeFunction;
    #resizes = 0;

    constructor(startByteIndex, layoutAtom, inputInfo, resizeFunction){

        this.#datumByteSize = layoutAtom.arguments.reduce((acc, el) => inputInfo[el].size*(typeInfo[inputInfo[el].type].bitSize/8.0) + acc , 0)

        let size =  layoutAtom.opts.size ?? 100; // TODO: this needs to be thrown out??

        this.#resizeFunction = resizeFunction;
        
        if(layoutAtom.repeatType === 'center' && size % 2 === 1){
            size = size + 1; // even sizes only for center repeat....
        }

        this.#repeatSize = size;

        this.#startByteIndex = startByteIndex;
        this.#endByteIndex = this.#startByteIndex + size*this.#datumByteSize;
        
        if(layoutAtom.repeatType === 'start'){
            this.#dataStartByteIndex =this.#startByteIndex;
            this.#dataEndByteIndex = this.#startByteIndex; // index of the next free open spot
        }else if(layoutAtom.repeatType === 'end'){
            this.#dataStartByteIndex = this.#endByteIndex;
            this.#dataEndByteIndex = this.#endByteIndex; // index of the next free open spot
        }else{
            let halfByte = (this.#startByteIndex + this.#endByteIndex) / 2;
            this.#dataStartByteIndex = halfByte;
            this.#dataEndByteIndex = halfByte; // index of the next free open spot
        }
        

    }

    shiftByteIndices(amount){
        this.#startByteIndex = this.#startByteIndex + amount;
        this.#endByteIndex = this.#endByteIndex + amount;
        this.#dataStartByteIndex = this.#dataStartByteIndex + amount;
        this.#dataEndByteIndex = this.#dataEndByteIndex + amount;
    }

    // these adjust the indices of this 
    checkResizePrepend(numberOfBytes){

        if(numberOfBytes % this.#datumByteSize){
            throw new Error("FAIL(INTERNAL): Number of Bytes requested to add to this view is not divisible by the views datum Byte size!");
        }
        
        let newDataStart = this.#dataStartByteIndex - numberOfBytes;
        
        if(newDataStart < this.#startByteIndex){
            let resizeShiftAmount = this.calculateResizeAmount(this.#startByteIndex - newDataStart);

            this.#dataStartByteIndex = this.#dataStartByteIndex + resizeShiftAmount;
            this.#dataEndByteIndex = this.#dataEndByteIndex + resizeShiftAmount;
            this.#endByteIndex = this.#endByteIndex + resizeShiftAmount;

            return resizeShiftAmount;
        }

        return null;
    }

    checkResizeAppend(numberOfBytes){

        if(numberOfBytes % this.#datumByteSize){
            throw new Error("FAIL(INTERNAL): Number of bytes requested to add to this view is not divisible by the views datum byte size!");
        }

        let newDataEnd = this.#dataEndByteIndex + numberOfBytes;
        
        if(newDataEnd > this.#endByteIndex){
            let resizeShiftAmount = this.calculateResizeAmount(newDataEnd - this.#endByteIndex); // thinking about thos write indices...
            this.#endByteIndex = this.#endByteIndex + resizeShiftAmount;

            return resizeShiftAmount;
        }

        return null;
    }

    checkResizeStartDelete(numberOfBytes){

        this.#dataStartByteIndex = this.#dataStartByteIndex + numberOfBytes;

        let shrinkAmount = this.calculateShrinkAmount(this.#dataStartByteIndex - this.#startByteIndex);

        if(shrinkAmount){
            this.#dataStartByteIndex = this.#dataStartByteIndex - shrinkAmount;
            this.#dataEndByteIndex = this.#dataEndByteIndex - shrinkAmount;
            this.#endByteIndex = this.#endByteIndex - shrinkAmount;

            return shrinkAmount;
        }

        return null;

    }

    checkResizeEndDelete(numberOfBytes){

        this.#dataEndByteIndex = this.#dataEndByteIndex - numberOfBytes;

        let shrinkAmount = this.calculateShrinkAmount(this.#endByteIndex - this.#dataEndByteIndex);

        if(shrinkAmount){
            this.#endByteIndex = this.#endByteIndex - shrinkAmount;

            return shrinkAmount;
        }

        return null;
    }

    adjustWriteIndexPrepend(numberOfBytes){

        if(numberOfBytes % this.#datumByteSize){
            throw new Error("FAIL(INTERNAL): Number of bytes requested to add to this view is not divisible by the views datum byte size!"); // might only be needed for dev
        }

        this.#dataStartByteIndex = this.#dataStartByteIndex - numberOfBytes;

        if(this.#dataStartByteIndex < this.#startByteIndex){
            throw new Error(`FAIL(INTERNAL): Somehow a write index adjustment was made without first checking 
                                        if the buffer needs to be resized. This is an internal error for Pika`); // this might only be needed for dev
        }

        return true
    }

    adjustWriteIndexAppend(numberOfBytes){

        if(numberOfBytes % this.#datumByteSize){
            throw new Error("FAIL(INTERNAL): Number of bytes requested to add to this view is not divisible by the views datum byte size!"); // might only be needed for dev
        }

        this.#dataEndByteIndex = this.#dataEndByteIndex + numberOfBytes;


        if(this.#dataEndByteIndex > this.#endByteIndex){
            throw new Error(`FAIL(INTERNAL): Somehow a write index adjustment was made without first checking 
                                        if the buffer needs to be resized. This is an internal error for Pika`); // this might only be needed for dev
        }

        return true;
    }

    calculateResizeAmount(neededShiftAmount){
        let increasedByteAmount = 0;

        while(increasedByteAmount < neededShiftAmount){ // TODO: is this really necessary??
            this.#resizes = this.#resizes + 1;
            increasedByteAmount = increasedByteAmount + this.#datumByteSize*this.#resizeFunction(this.#repeatSize, this.#resizes);
        }

        return increasedByteAmount;
    }

    calculateShrinkAmount(freeSpace){
        let finalShrinkAmount;

        let candidateShrinkAmount = 0;
        let candidateResizes = this.#resizes;

        while(candidateShrinkAmount < freeSpace){
            finalShrinkAmount = candidateShrinkAmount;
            this.#resizes = candidateResizes;

            if(this.#resizes === 0){
                return finalShrinkAmount
            }

            candidateShrinkAmount = candidateShrinkAmount + this.#datumByteSize*this.#resizeFunction(this.#repeatSize, candidateResizes);
            candidateResizes--;
        }

        return finalShrinkAmount;
    }

    get endByteIndex(){
        return this.#endByteIndex;
    }

    get startByteIndex(){
        return this.#startByteIndex;
    }

    get byteSize(){
        return this.#endByteIndex - this.#startByteIndex;
    }

    get dataByteSize(){
        return this.#dataEndByteIndex - this.#dataStartByteIndex;
    }

    get dataStartByteIndex(){
        return this.#dataStartByteIndex;
    }

    get dataEndByteIndex(){
        return this.#dataEndByteIndex;
    }

    get size(){
        return this.byteSize/this.#datumByteSize;
    }

    get dataSize(){
        return this.dataByteSize/this.datumByteSize;
    }

    get datumByteSize(){
        return this.#datumByteSize;
    }
}


export default VertexBuffer;
import {typeInfo, dataViewGetAndSet} from "../private/types.js"

const acceptedDataSources = ["client", "VertexBuffer"];


class VertexBuffer{

    #bufferViews = []; // TODO: write description of what a subBufferView is

    #buffer; // this is a reference to the gl buffer.

    #gl;

    #resizeFunction;

    #layoutAtoms;
    #inputInfo;

    static temporaryArrayBufferRepeats = 1000; // for sizing array buffers that will be filled with unwrapped data

    constructor(layoutAtoms, inputInfo, gl, initialData = null, opts = {}){
        this.#gl = gl;
        this.#layoutAtoms = layoutAtoms;
        this.#inputInfo = inputInfo;

        let startByteIndex = 0;
        let bufferView;

        this.#resizeFunction = (opts && opts.resizeFunction) ? opts.resizeFunction : (repeatAmount, resizes) => repeatAmount*resizes;
        
        this.#bufferViews = layoutAtoms.map((el) =>{
            bufferView = new SubBufferView(startByteIndex , el, inputInfo, this.#resizeFunction);
            startByteIndex = bufferView.endByteIndex;
            return bufferView; // TODO: why did I do Object.assign here??
        });

        this.#buffer = this.#createEmptyBuffer(this.bufferByteSize);
    }

    get bufferByteSize(){
        return this.#bufferViews[this.#bufferViews.length - 1].endByteIndex;
    }

    #addData(dataSource ,dataList, opts, isAppend = true){ // -----------------REFACTOR REFACTOR REFACTOR------------------------

        if(dataList.length !== this.#bufferViews.length){
            throw new Error("FAIL: Provided data array must have a value for each subview of this buffer"); // is this needed??
        }


        //TODO: see if this algo couldn't be optimized in some way.....

        let startByteLength = this.bufferByteSize;
        let startByteShift = 0;

        let doesNotNeedResize = true;
        let data = null;
        let byteShift = null;

        for(let i = 0; i < dataList.length; i++){
            data = dataList[i];
            byteShift = isAppend ? this.#bufferViews[i].checkResizeAppend(data.byteLength) :  this.#bufferViews[i].checkResizePrepend(data.byteLength)

            if(!isAppend && i === 0 && byteShift != null){
                startByteShift = byteShift;
            }

            if(byteShift != null){
                doesNotNeedResize = false;
                this.#adjustAllIndices(i+1, byteShift);
            }

        }

        if(!doesNotNeedResize){
            let newBuffer = this.#createEmptyBuffer(this.bufferByteSize);
            this.#gl_translateDataIntoBuffer(newBuffer, startByteLength, startByteShift);
            this.#gl.gl.deleteBuffer(this.#buffer);
            this.#buffer = newBuffer;
            // TODO: once I incorporate VAO's, I will have to notify them here!
            // one way of doing this is by defining a setter on this.#buffer....
        }

        // copy data into the buffers
        for(let i = 0; i < dataList.length; i++){
            
            let view = this.#bufferViews[i];
            let data = dataList[i];

            let writeIndex = isAppend ? view.dataEndByteIndex : (view.dataStartByteIndex - data.byteLength); 

            this.#copyData(dataSource , writeIndex, data, 
                isAppend ? () => view.adjustWriteIndexAppend(data.byteLength):
                           () => view.adjustWriteIndexPrepend(data.byteLength));
        }

    } // ---------------------------------------------------------------------

    sizeAppend(dataSource, layout, data, opts){

        if(!acceptedDataSources.includes(dataSource)){
            throw new Error(`FAIL: VertexBuffer cannot accept a data source of ${dataSource}. \n Accepted sources: ${JSON.stringify(acceptedDataSources)}`);
        }

        // first check to see if we have any lone top flat repeats that match the layout atoms for this vertex buffer. If so, we can simply just copy the data 
        // from its source without performing any unwrapping

        let translatedDataSets = []; // array of objects of the form {data: [], pts: <number of points>}

        if(!opts.skipCopyMatching){
            translatedDataSets = this.#layoutAtoms.map(lel => {

                if(!this.#oneDataLayoutsForOneInput(lel, layout)){
                    return null
                }

                let matchingLTFR = layout.loneTopFlatRepeats.find(del => this.#canDirectCopy(del, lel));
                let directCopyCandidate = matchingLTFR? matchingLTFR.getter(data): null;

                return directCopyCandidate && !(directCopyCandidate instanceof Array) ? {data: directCopyCandidate, pts: matchingLTFR.size(data)} : null; // TODO: still need to get into buffer mode!!
            });
        }

          // TODO: there is probably some things I can do to increase the time efficiency of sizing non-flat repeats.... ??????

        let numberOfDirectCopies = 0;
        
        for(let i = 0; i < this.#layoutAtoms.length; i++){
            if(!translatedDataSets[i]){
                translatedDataSets[i] = this.#repackData(this.#layoutAtoms[i], layout, data, opts);
            }else{
                numberOfDirectCopies++;
                continue;
            }
        }

        return {pointsAdded: translatedDataSets.map(el => el.pts), doAppend: () => this.requestAppend(dataSource, translatedDataSets.map(el => el.data), opts ?? null), numberOfDirectCopies};

    }

    requestAppend(a, b, c, opts){

        if(arguments.length === 3){

            let dataSource = a;
            let expandedData = b;
            let opts = c;

            this.#appendData(dataSource, expandedData, opts);


        }else{
            let effects = this.sizeAppend(a,b,c, opts);
            effects.forEach(el => el.doAppend());


            return effects.map(el => {
                el.doAppend = null;
                return el;
            });
        }

    }

    #repackData(layoutAtom, dataLayout, data, opts){

        let datumByteSize = layoutAtom.arguments.reduce( (acc, el) => acc + this.#inputInfo[el].size*typeInfo[this.#inputInfo[el].type].bitSize, 0)/8.0;

        // TODO: need to do some thinking here on if copying to an array as an intermediate causes this to be slow.

        // at this point I need to test the difference between filling an array and then filling a buffer vs what I 
        // have now which is immediately filling the buffer used by the buffer for filling....

        let buffer = new ArrayBuffer(VertexBuffer.temporaryArrayBufferRepeats*datumByteSize);
        let view = new DataView(buffer);
        let views = [view];
        let iterators = layoutAtom.arguments.map(el => dataLayout.createInputIterator(el, data));

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
                views.push(view)
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

        return {data: finalBuffer, pts: finalByteSize/datumByteSize};

    }

    #oneDataLayoutsForOneInput(layoutAtom, dataLayout){
        for(let arg of layoutAtom.arguments){
            if(dataLayout.getDataLayoutAtoms(arg).length > 1){
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

    #appendData(dataSource, dataList, opts){ // data is in an array in order of which view it should go to.
        this.#addData(dataSource, dataList, opts, true);
    }

    #prependData(dataSource, dataList, opts){
        this.#addData(dataSource, dataList, opts, false);
    }

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

    #gl_translateDataIntoBuffer(target, copyLength, startByteShift){ // copies data from current buffer directly into the argument buffer. // THIS NEEDS REFACTORING....

        this.#gl.gl.bindBuffer(this.#gl.gl.COPY_WRITE_BUFFER, target); // read from the supplied buffer and write to the current buffer
        this.#gl.gl.bindBuffer(this.#gl.gl.COPY_READ_BUFFER, this.#buffer);

        this.#gl.gl.copyBufferSubData(this.#gl.gl.COPY_READ_BUFFER, this.#gl.gl.COPY_WRITE_BUFFER, 0, startByteShift, copyLength); // transfer the contents of supplied buffer to current buffer...
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

    get numberOfPoints(){
        this.#bufferViews[0].view.size(); // as of now, all buffer views must contain the same number of points....
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
            increasedByteAmount = this.#datumByteSize*this.#resizeFunction(this.#repeatSize, this.#resizes);
        }

        return increasedByteAmount;
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

    get datumByteSize(){
        return this.#datumByteSize;
    }
}


export default VertexBuffer;
import {typeInfo, dataViewGetAndSet} from "../private/types.js"


// all nasty type checking (array vs blob) should be done in this class

const acceptedDataSources = ["clientArray", "clientBuffer", "VertexBuffer"];


class VertexBuffer{

    #subBuffersWithUpdaters = []; // TODO: write description of what a subBufferView is

    #buffer; // this is a reference to the gl buffer.

    #gl;
    // #lazyResize = false; // 'greedy' will resize as soon as any sub buffer violates its bounds. If 'lazy' in that 
                            // it will only resize if one if the sub buffers is about to overwrite another's data.


    #resizeFunction; // function that each view uses for requesting a new buffer size. 
                     // inputs are the number of resizes the view has requested and the original repeat size.
                     // the returned value of the function should be the new datum size of the buffer.
    // some dev notes about the above function: this is a:
    //TODO: think!
    // The problem with having this be a buffer-level function is that I am then limiting the programmer to only 
    // have buffer-wide resizing behavior and not sub buffer view level sizing behavior. For woodchuck this is 
    // does not actually matter, but for a wider reach this might not be the desired behavior?? At least when 
    // dealing with data sets in the abstract. Actually, for vertex data this will have to be the case.....
    // Maybe if dataset is allowed to produce arbitrary type of data, like textures or something similar this 
    // could be undesirable..... hmmmm. Well, for now this doesn't really matter so I will make this a 
    // buffer level knob, and in the future if I want to get more fancy I can make this something that 
    // is more fine-tunable.

    #name;

    #layoutAtoms;
    #inputInfo;

    static temporaryArrayBufferRepeats = 1000; // for sizing array buffers that will be filled with unwrapped data


    static constructBufferFromAtoms(layoutAtoms, inputInfo, gl, initialData = null, opts = {}){
        let buffer = new VertexBuffer(layoutAtoms, inputInfo, gl, opts);

        return [buffer, {appendData: buffer.#appendData, prependData: buffer.#prependData} , buffer.#subBuffersWithUpdaters.map(el => el.view)];
    }

    constructor(layoutAtoms, inputInfo, gl, initialData = null, opts = {}){
        this.#gl = gl;
        this.#layoutAtoms = layoutAtoms;
        this.#inputInfo = inputInfo;

        let startByteIndex = 0;
        let bufferView;
        let updateFuncs;

        this.#resizeFunction = (opts && opts.resizeFunction) ? opts.resizeFunction : (repeatAmount, resizes) => repeatAmount*resizes;
        
        this.#subBuffersWithUpdaters = layoutAtoms.map((el) =>{
            [bufferView, updateFuncs] = SubBufferView.create(startByteIndex , el, inputInfo ,this.#resizeFunction, this.#adjustAllIndices);
            startByteIndex = bufferView.endByteIndex;
            return Object.assign({view: bufferView}, updateFuncs); // TODO: why did I do Object.assign here??
        });

        this.#buffer = this.#createEmptyBuffer(this.bufferByteSize);
    }

    get bufferByteSize(){
        return this.#subBuffersWithUpdaters[this.#subBuffersWithUpdaters.length - 1].view.endByteIndex;
    }

    #addData(dataList, opts, isAppend = true){

        if(dataList.length !== this.#subBuffersWithUpdaters.length){
            throw new Error("FAIL: Provided data array must have a value for each subview of this buffer"); // is this needed??
        }


        //TODO: see if this algo couldn't be optimized in some way.....

        let doesNotNeedResize = true;

        for(let i = 0; i < dataList.length; i++){
            let buff = this.#subBuffersWithUpdaters[i];
            let data = dataList[i];

            doesNotNeedResize = doesNotNeedResize && (isAppend ? 
                       buff.checkResizeAppend(data.byteLength) :
                       buff.checkResizePrepend(data.byteLength) );
        }

        if(!doesNotNeedResize){
            let newBuffer = this.#createEmptyBuffer(this.bufferByteSize);
            this.#gl_translateDataIntoBuffer(newBuffer);
            this.#gl.gl.deleteBuffer(this.#buffer);
            this.#buffer = newBuffer;
            // TODO: once I incorporate VAO's, I will have to notify them here!
            // one way of doing this is by defining a setter on this.#buffer....
        }

        // copy data into the buffers
        for(let i = 0; i < dataList.length; i++){
            
            let buff = this.#subBuffersWithUpdaters[i];
            let data = dataList[i];

            let writeIndex = isAppend ? buff.view.dataEndByteIndex : (buff.view.dataStartByteIndex - data.byteLength); 

            this.#copyData(writeIndex, data, 
                isAppend ? buff.adjustWriteIndexAppend:
                           buff.adjustWriteIndexPrepend);
        }

    }

    sizeAppend(dataSource, layout, data, opts){

        if(!acceptedDataSources.includes(dataSource)){
            throw new Error(`FAIL: VertexBuffer cannot accept a data source of ${dataSource}. \n Accepted sources: ${JSON.stringify(acceptedDataSources)}`);
        }

        if(dataSource === "clientBuffer"){
            data = [data];
        }

        // first check to see if we have any lone top flat repeats that match the layout atoms for this vertex buffer. If so, we can simply just copy the data 
        // from its source without performing any unwrapping

        let translatedDataSets = []; // array of objects of the form {data: [], pts: <number of points>}

        if(!opts.skipCopyMatching){
            translatedDataSets = this.#layoutAtoms.map(lel => {
                let matchingLTFR = layout.loneTopFlatRepeats.find(del => this.#canDirectCopy(del, lel));
                return matchingLTFR? {data: matchingLTFR.getter(data), pts: matchingLTFR.size(data)} : null; // TODO: still need to get into buffer mode!!
            });
        }

          // TODO: there is probably some things I can do to increase the time efficiency of sizing non-flat repeats.... ??????
        
        for(let i = 0; i < this.#layoutAtoms.length; i++){
            if(!translatedDataSets[i]){
                translatedDataSets[i] = this.#repackData(this.#layoutAtoms[i], layout, data, opts);
            }else{
                continue;
            }
        }

        let differentNumberOfPtsData = translatedDataSets.find(el => el.pts !== translatedDataSets[0].pts);

        if(differentNumberOfPtsData){
            throw new Error("FAIL: Each input must have the same number of points when adding to a vertex buffer!!");
        }


        return {pointsAdded: translatedDataSets[0].pts, doAppend: () => this.requestAppend(dataSource, translatedDataSets.map(el => el.data), opts ?? null)};

    }

    requestAppend(a, b, c, opts){

        if(arguments.length === 3){

            let dataSource = a;
            let expandedData = b;
            let opts = c;

            console.log("expanded Data " + expandedData);

            this.#appendData(expandedData, opts);


        }else{
            this.sizeAppend(a,b,c, opts).doAppend();

            return this.numberOfPoints;
        }

    }

    #repackData(layoutAtom, dataLayout, data, opts){

        let datumByteSize = layoutAtom.arguments.reduce( (acc, el) => acc + typeInfo[this.#inputInfo[el].type].bitSize, 0)/8.0;

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

            console.log(values);

            let numberOfNulls = values.filter(el => el == null).length;

            if(numberOfNulls !== 0 && numberOfNulls !== values.length){
                throw new Error("FAIL: VertexBuffer requires each of its inputs to have the same number of points!"); // TODO: improve error message
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

                view[dataViewGetAndSet[this.#inputInfo[arg].type].set](offset, value, true);
                offset = offset + typeInfo[this.#inputInfo[arg].type].bitSize/8.0;

            }
        }

        // at this point we have may have an array of filled array views that need to be coagulated..

        console.log(views.length);
        console.log(offset);

        let finalByteSize = (views.length - 1) * VertexBuffer.temporaryArrayBufferRepeats*datumByteSize + offset;
        let finalBuffer = new ArrayBuffer(finalByteSize);
        let finalView = new DataView(finalBuffer);

        // copy data with largest step possible...hopefully this is in 64 bit chunks for as long as possible...



        let byteStepsWithGetSet = [{size: 8, get: "getBigUint64", set: "setBigUint64"}, {size: 4, get: "getUint32", set: "setUint32"}, {size: 2, get: "getUint16", set: "setUint16"}, {size: 1, get: "getUint8", set: "setUint8"}]

        let cursor = 0;
        let viewCursor = 0;
        let lastView = views[views.length -1];
        let largestStep = null;

        console.log("Final byte size: " + finalByteSize);

        for(let view of views){

            viewCursor = 0;

            let endOfData = view == lastView? offset : view.byteLength; 

            while(viewCursor < endOfData){
                largestStep = byteStepsWithGetSet.find(el => (endOfData - viewCursor) % el.size === 0); // TODO: this is probably slow...

                console.log("cursor: " + cursor);

                finalView[largestStep.set](cursor, view[largestStep.get](viewCursor));

                cursor = cursor + largestStep.size;
                viewCursor = viewCursor + largestStep.size;
            }
        }

        return {data: finalBuffer, pts: finalByteSize/datumByteSize};

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

    #appendData(dataList, opts){ // data is in an array in order of which view it should go to.
        this.#addData(dataList, opts, true);
    }

    #prependData(dataList, opts){
        this.#addData(dataList, opts, false);
    }

    #adjustAllIndices(requestingBufferView, byteAmount){

        // first create the empty buffer we will relocating data too

        let afterExpandedView = false;

        for(let buff of this.#subBuffersWithUpdaters){ // Adjust the indices of the contained buffer views as appropriate

            if(buff.view === requestingBufferView){
                afterExpandedView = true;
                continue;
            }else if(!afterExpandedView){
                continue;
            }

            buff.shiftByteIndices(byteAmount);

        }
    }

    #copyData(byteIndex, data, indexUpdate){ // copies data from an external (not this gl context) source.

        if(data instanceof ArrayBuffer){
            this.#gl.gl.bindBuffer(this.#gl.gl.ARRAY_BUFFER, this.#buffer);
            this.#gl.gl.bufferSubData(this.#gl.gl.ARRAY_BUFFER, byteIndex, data, 0);
        }else{
            console.log(data);
        }

        indexUpdate(data.byteLength);
    }

    #gl_translateDataIntoBuffer(target){ // copies data from current buffer directly into the argument buffer.

        this.#gl.gl.bindBuffer(this.#gl.gl.COPY_WRITE_BUFFER, target); // read from the supplied buffer and write to the current buffer
        this.#gl.gl.bindBuffer(this.#gl.gl.COPY_READ_BUFFER, this.#buffer);

        this.#gl.gl.copyBufferSubData(this.#gl.gl.COPY_READ_BUFFER, this.#gl.gl.COPY_WRITE_BUFFER, 0, 0, this.bufferByteSize); // transfer the contents of supplied buffer to current buffer...
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
        this.#subBuffersWithUpdaters[0].view.size(); // as of now, all buffer views must contain the same number of points....
    }

}

class SubBufferView{ // next step is to write append, prepend funcs, then fill out the lazy way of doing things, then write a bunch of tests!!

    #repeatSize = 0;

    #startByteIndex = 0;
    #endByteIndex = 0;

    #dataStartByteIndex = 0;
    #dataEndByteIndex = 0;

    #datumByteSize = 0;

    #resizes = 0;

    #resizeFunction;

    #adjustAllIndices;


    static create(startByteIndex, layoutAtom, inputInfo, resizeFunction, adjustAllIndices){

        let view = new SubBufferView(startByteIndex, layoutAtom, inputInfo, resizeFunction, adjustAllIndices);

        return [view, {shiftByteIndices: (...args) => view.#shiftByteIndices(args), checkResizeAppend: (...args) => view.#checkResizeAppend(...args), 
                       checkResizePrepend: (...args) => view.#checkResizePrepend(args), adjustWriteIndexPrepend: (...args) => view.#adjustWriteIndexPrepend(...args),
                       adjustWriteIndexAppend: (...args) => view.#adjustWriteIndexAppend(...args)}];
    }

    constructor(startByteIndex, layoutAtom, inputInfo, resizeFunction, adjustAllIndices){

        this.#resizeFunction = resizeFunction;
        this.#adjustAllIndices = adjustAllIndices;

        this.#datumByteSize = layoutAtom.arguments.reduce((acc, el) => inputInfo[el].size*(typeInfo[inputInfo[el].type].bitSize/8.0) + acc , 0)

        let size =  layoutAtom.opts.size ?? 100; // TODO: this needs to be thrown out??
        
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

    #shiftByteIndices(amount){
        this.#startByteIndex = this.#startByteIndex + amount;
        this.#endByteIndex = this.#endByteIndex + amount;
        this.#dataStartByteIndex = this.#dataStartByteIndex + amount;
        this.#dataEndByteIndex = this.#dataEndByteIndex + amount;
    }

    // these adjust the indices of this 
    #checkResizePrepend(numberOfBytes){

        if(numberOfBytes % this.#datumByteSize){
            throw new Error("FAIL(INTERNAL): Number of Bytes requested to add to this view is not divisible by the views datum Byte size!");
        }
        
        let newDataStart = this.#dataStartByteIndex - numberOfBytes;
        
        if(newDataStart < this.#startByteIndex){
            let resizeShiftAmount = this.#calculateResizeAmount(this.#startByteIndex - newDataStart);

            this.#dataStartByteIndex = this.#dataStartByteIndex + resizeShiftAmount;
            this.#dataEndByteIndex = this.#dataEndByteIndex + resizeShiftAmount;
            this.#endByteIndex = this.#endByteIndex + resizeShiftAmount;

            this.#adjustAllIndices(this, resizeShiftAmount);

            return false;
        }

        return true;
    }

    #checkResizeAppend(numberOfBytes){

        if(numberOfBytes % this.#datumByteSize){
            throw new Error("FAIL(INTERNAL): Number of bytes requested to add to this view is not divisible by the views datum byte size!");
        }

        let newDataEnd = this.#dataEndByteIndex + numberOfBytes;
        
        if(newDataEnd > this.#endByteIndex){
            let resizeShiftAmount = this.#calculateResizeAmount(newDataEnd - this.#endByteIndex); // thinking about thos write indices...
            this.#endByteIndex = this.#endByteIndex + resizeShiftAmount;

            this.#adjustAllIndices(this, resizeShiftAmount);

            return false;
        }

        return true;
    }

    #adjustWriteIndexPrepend(numberOfBytes){

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

    #adjustWriteIndexAppend(numberOfBytes){

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

    #calculateResizeAmount(neededShiftAmount){
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
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

        console.log("constuctor was called");
        console.dir(layoutAtoms, {depth: null});

        let startBitIndex = 0;
        let bufferView;
        let updateFuncs;

        this.#resizeFunction = (opts && opts.resizeFunction) ? opts.resizeFunction : (repeatAmount, resizes) => repeatAmount*resizes;
        
        this.#subBuffersWithUpdaters = layoutAtoms.map((el) =>{
            [bufferView, updateFuncs] = SubBufferView.create(startBitIndex , el, inputInfo ,this.#resizeFunction, this.#adjustAllIndices);
            startBitIndex = bufferView.endBitIndex;
            return Object.assign({view: bufferView}, updateFuncs); // TODO: why did I do Object.assign here??
        });

        this.#buffer = this.#createEmptyBuffer(this.bufferByteSize);
    }

    get bufferBitSize(){
        return this.#subBuffersWithUpdaters[this.#subBuffersWithUpdaters.length - 1].view.endBitIndex;
    }

    get bufferByteSize(){
        let bits = this.bufferBitSize;
       
        if(bits % 8 !== 0){
            throw new Error("FAIL(INTERNAL): Provided bit size is not divisible by 8!");
        }

        return bits/8.0;
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
                       buff.checkResizeAppend(data.byteLength * 8) :
                       buff.checkResizePrepend(data.byteLength * 8) );
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

            let writeIndex = isAppend ? buff.view.dataEndBitIndex : (buff.view.dataStartBitIndex - data.byteLength * 8.0); 

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
                return matchingLTFR? {data: matchingLTFR.getter(data), pts: matchingLTFR.size(data)} : null 
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


        return {pointsAdded: translatedDataSets[0].pts, doAppend: () => this.requestAppend(dataSource, translatedDataSets.map(el => el.data), opts ?? null)}; // left off here

    }

    requestAppend(a, b, c, opts){

        if(arguments.length === 3){

            let dataSource = a;
            let expandedData = b;
            let opts = c;

            this.#appendData(expandedData, opts);


        }else{
            this.sizeAppend(a,b,c, opts).doAppend();

            return this.numberOfPoints;
        }

    }

    #repackData(layoutAtom, dataLayout, data, opts){

        let datumByteSize = layoutAtom.arguments.reduce( (acc, el) => acc + typeInfo[el].bitSize, 0)/8.0;

        // TODO: need to do some thinking here on if copying to an array as an intermediate causes this to be slow.
        // left off here, need to make this a github issue and continue with unwrapping the data into an ARRAY, then 
        // it would be interesting to implement a buffer way of doing this so I can compare later, if such a thing 
        // is possible...

        // at this point I need to test the difference between filling an array and then filling a buffer vs what I 
        // have now which is immediately filling the buffer used by the buffer for filling....

        let buffer = new ArrayBuffer(VertexBuffer.temporaryArrayBufferRepeats*datumByteSize);
        let view = new DataView(buffer);
        let views = [view];
        let iterators = layoutAtom.arguments.map(el => dataLayout.createInputIterator(el, data));

        let allDone = false;
        offset = 0;

        while(!allDone){
            let iteration = iterators.map(el => el.next());
            let values = iteration.map(el => el.values);
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

            layoutAtom.arguments.forEach((input, idx) => view[dataViewGetAndSet[this.#inputInfo[input].type].set](offset, values[idx], true));

            offset = offset + datumByteSize;
        }

        // at this point we have may have an array of filled array views that need to be coagulated..

        let finalByteSize = (views.length - 1) * VertexBuffer.temporaryArrayBufferRepeats*datumByteSize + offset;
        let finalBuffer = new ArrayBuffer(finalByteSize);
        let finalView = new DataView(finalBuffer);

        // copy data with largest step possible...hopefully this is in 64 bit chunks for as long as possible...



        let byteStepsWithGetSet = [{size: 8, get: "getUInt64", set: "setUInt64"}, {size: 4, get: "getUInt32", set: "setUInt32"}, {size: 2, get: "getUInt16", set: "setUInt16"}, {size: 1, get: "getUInt8", set: "setUInt8"}]

        let cursor = 0;
        let viewCursor = 0;
        let lastView = views[views.length -1];
        let largestStep = null;

        for(let view of views){

            viewCursor = 0;

            while(viewCursor < view.byteLength && !(view === lastView && viewCursor > offset)){
                largestStep = byteStepsWithGetSet.find(el => (view.byteLength - cursor) % el.size === 0);
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

    #adjustAllIndices(requestingBufferView, bitAmount){

        // first create the empty buffer we will relocating data too

        let afterExpandedView = false;

        for(let buff of this.#subBuffersWithUpdaters){ // Adjust the indices of the contained buffer views as appropriate

            if(buff.view === requestingBufferView){
                afterExpandedView = true;
                continue;
            }else if(!afterExpandedView){
                continue;
            }

            buff.shiftBitIndices(bitAmount);

        }
    }

    #copyData(bitIndex, data, indexUpdate){ // copies data from an external (not this gl context) source.

        if(data instanceof ArrayBuffer){
            this.#gl.gl.bindBuffer(this.#gl.gl.ARRAY_BUFFER, this.#buffer);
            this.#gl.gl.bufferSubData(this.#gl.gl.ARRAY_BUFFER, bitIndex, data, 0);
        }else{
            console.warn("NOT IMPLEMENT YET");
        }

        indexUpdate(data.byteLength * 8);
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

    #startBitIndex = 0;
    #endBitIndex = 0;

    #dataStartBitIndex = 0;
    #dataEndBitIndex = 0;

    #datumBitSize = 0;

    #resizes = 0;

    #resizeFunction;

    #adjustAllIndices;


    static create(startBitIndex, layoutAtom, inputInfo, resizeFunction, adjustAllIndices){

        let view = new SubBufferView(startBitIndex, layoutAtom, inputInfo, resizeFunction, adjustAllIndices);

        return [view, {shiftBitIndices: view.#shiftBitIndices, checkResizeAppend: view.#checkResizeAppend, 
                       checkResizePrepend: view.#checkResizePrepend, adjustWriteIndexPrepend: view.#adjustWriteIndexPrepend,
                       adjustWriteIndexAppend: view.#adjustWriteIndexAppend}];
    }

    constructor(startBitIndex, layoutAtom, inputInfo, resizeFunction, adjustAllIndices){

        this.#resizeFunction = resizeFunction;
        this.#adjustAllIndices = adjustAllIndices;

        console.log(layoutAtom.arguments.map(el => inputInfo[el].type));
        console.log(inputInfo);

        this.#datumBitSize = layoutAtom.arguments.reduce((acc, el) => inputInfo[el].size*typeInfo[inputInfo[el].type].bitSize + acc , 0)

        console.log(this.#datumBitSize);

        let size =  layoutAtom.opts.size ?? 100;
        
        if(layoutAtom.repeatType === 'center' && size % 2 === 1){
            size = size + 1; // even sizes only for center repeat....
        }

        this.#repeatSize = size;

        this.#startBitIndex = startBitIndex;
        this.#endBitIndex = this.#startBitIndex + size*this.#datumBitSize;
        
        if(layoutAtom.repeatType === 'start'){
            this.#dataStartBitIndex =this.#startBitIndex;
            this.#dataEndBitIndex = this.#startBitIndex; // index of the next free open spot
        }else if(layoutAtom.repeatType === 'end'){
            this.#dataStartBitIndex = this.#endBitIndex;
            this.#dataEndBitIndex = this.#endBitIndex; // index of the next free open spot
        }else{
            let halfBit = (this.#startBitIndex + this.#endBitIndex) / 2;
            this.#dataStartBitIndex = halfBit;
            this.#dataEndBitIndex = halfBit; // index of the next free open spot
        }
        

    }

    #shiftBitIndices(amount){
        this.#startBitIndex = this.#startBitIndex + amount;
        this.#endBitIndex = this.#endBitIndex + amount;
        this.#dataStartBitIndex = this.#dataStartBitIndex + amount;
        this.#dataEndBitIndex = this.#dataEndBitIndex + amount;
    }

    // these adjust the indices of this 
    #checkResizePrepend(numberOfBits){

        if(numberOfBits % this.#datumBitSize){
            throw new Error("FAIL(INTERNAL): Number of bits requested to add to this view is not divisible by the views datum bit size!");
        }
        
        let newDataStart = this.#dataStartBitIndex - numberOfBits;
        
        if(newDataStart < this.#startBitIndex){
            let resizeShiftAmount = this.#calculateResizeAmount(this.#startBitIndex - newDataStart);

            this.#dataStartBitIndex = this.#dataStartBitIndex + resizeShiftAmount;
            this.#dataEndBitIndex = this.#dataEndBitIndex + resizeShiftAmount;
            this.#endBitIndex = this.#endBitIndex + resizeShiftAmount;

            this.#adjustAllIndices(this, resizeShiftAmount);

            return false;
        }

        return true;
    }

    #checkResizeAppend(numberOfBits){

        if(numberOfBits % this.#datumBitSize){
            throw new Error("FAIL(INTERNAL): Number of bits requested to add to this view is not divisible by the views datum bit size!");
        }

        let newDataEnd = this.#dataEndBitIndex + numberOfBits;
        
        if(newDataEnd > this.#endBitIndex){
            let resizeShiftAmount = this.#calculateResizeAmount(newDataEnd - this.#endBitIndex); // thinking about thos write indices...
            this.#endBitIndex = this.#endBitIndex + resizeShiftAmount;

            this.#adjustAllIndices(this, resizeShiftAmount);

            return false;
        }

        return true;
    }

    #adjustWriteIndexPrepend(numberOfBits){

        if(numberOfBits % this.#datumBitSize){
            throw new Error("FAIL(INTERNAL): Number of bits requested to add to this view is not divisible by the views datum bit size!"); // might only be needed for dev
        }

        this.#dataStartBitIndex = this.#dataStartBitIndex - numberOfBits;

        if(this.#dataStartBitIndex < this.#startBitIndex){
            throw new Error(`FAIL(INTERNAL): Somehow a write index adjustment was made without first checking 
                                        if the buffer needs to be resized. This is an internal error for Pika`); // this might only be needed for dev
        }

        return true
    }

    #adjustWriteIndexAppend(numberOfBits){

        if(numberOfBits % this.#datumBitSize){
            throw new Error("FAIL(INTERNAL): Number of bits requested to add to this view is not divisible by the views datum bit size!"); // might only be needed for dev
        }

        this.#dataEndBitIndex = this.#dataEndBitIndex + numberOfBits;


        if(this.#dataEndBitIndex > this.#endBitIndex){
            throw new Error(`FAIL(INTERNAL): Somehow a write index adjustment was made without first checking 
                                        if the buffer needs to be resized. This is an internal error for Pika`); // this might only be needed for dev
        }

        return true;
    }

    #calculateResizeAmount(neededShiftAmount){
        let increasedBitAmount = 0;

        while(increasedBitAmount < neededShiftAmount){ // TODO: is this really necessary??
            this.#resizes = this.#resizes + 1;
            increasedBitAmount = this.#datumBitSize*this.#resizeFunction(this.#repeatSize, this.#resizes);
        }

        return increasedBitAmount;
    }

    get endBitIndex(){
        return this.#endBitIndex;
    }

    get startBitIndex(){
        return this.#startBitIndex;
    }


    get bitSize(){
        return this.#endBitIndex - this.#startBitIndex;
    }

    get dataBitSize(){
        return this.#dataEndBitIndex - this.#dataStartBitIndex;
    }

    get dataStartBitIndex(){
        return this.#dataStartBitIndex;
    }

    get dataEndBitIndex(){
        return this.#dataEndBitIndex;
    }

    get size(){
        return this.bitSize/this.#datumBitSize;
    }

    get datumByteSize(){
        return this.#datumBitSize / 8.0;
    }
}


export default VertexBuffer;
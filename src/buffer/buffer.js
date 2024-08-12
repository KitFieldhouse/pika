/** class wrapper around a single VBO object that allows for more programmatic ways of interacting with 
 * the underlying data **/

const bufferDefaults = {initBufferPointSize: 100000, bufferResizeAddPoints: 100000};  // number of data points the initial buffer will store (each data point is 2 floats)

class Buffer {

    static CENTER_ALIGNMENT = 0;
    static START_ALIGNMENT = -1;
    static END_ALIGNMENT = 1;


    identifier = null; // this is the API returned integer identifier of this buffer
    gl = null; // this is the webgl context
    webglHandler = null; // this is an "instance" of the webglHandler class...
    perDatumBytes = null;
    startOfData = null;
    endOfData = null;
    currentBufferByteSize = null;
    startOfData = null;
    endOfData = null;
    dataWrapper = null;

    sizeListeners = [];

    constructor(webglHandler, perDatumBytes, dataWrapper, opts = {}){ // TODO: this probably should have some optional arguments....
        this.webglHandler = webglHandler;
        this.gl = webglHandler.gl;
        this.perDatumBytes = perDatumBytes;
        this.dataWrapper = dataWrapper;

        if(!opts.dataAlignment){
            this.dataAlignment = VertexBuffer.CENTER_ALIGNMENT;
        }else{
            this.dataAlignment = opts.dataAlignment;
        }

        // init buffer
        this.identifier = this.gl.createBuffer();
        this.bindToArrayBuffer();
        this.gl.bufferData(this.gl.ARRAY_BUFFER, perDatumBytes * bufferDefaults.initBufferPointSize , this.gl.DYNAMIC_DRAW); // allocate space for our buffer

        this.currentBufferByteSize = perDatumBytes * bufferDefaults.initBufferPointSize;

        switch(this.dataAlignment){
            case VertexBuffer.CENTER_ALIGNMENT:
                this.startOfData = Math.floor(this.currentBufferByteSize/2.0);
                this.endOfData = Math.floor(this.currentBufferByteSize/2.0);
                break;
            case VertexBuffer.START_ALIGNMENT:
                this.startOfData = 0;
                this.endOfData = 0;
                break;
            case VertexBuffer.END_ALIGNMENT:
                this.startOfData = this.currentBufferByteSize;
                this.endOfData = this.currentBufferByteSize;
                break;
            default:
                this.startOfData = Math.floor(this.currentBufferByteSize/2.0);
                this.endOfData = Math.floor(this.currentBufferByteSize/2.0);
                this.dataAlignment = VertexBuffer.CENTER_ALIGNMENT;
                break;
        }

    }

    bindToArrayBuffer(){ // binds to the ARRAY_BUFFER API binding point...
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.identifier);
    }

    append(packet){

        if(this.endOfData + packet.byteLength >= this.currentBufferByteSize){
            this.extendBuffer((this.endOfData + packet.byteLength) - this.currentBufferByteSize);
        }

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.identifier);
        this.gl.bufferSubData(this.gl.ARRAY_BUFFER, this.endOfData, packet, 0);
        this.endOfData = this.endOfData + packet.byteLength;

        this.checkSizeListeners();

    }

    prepend(packet){
    
        if(this.startOfData - (packet.byteLength) < 0){
            this.preExtendBuffer(packet.byteLength - this.startOfData);
        }
        
        this.startOfData = this.startOfData - (packet.byteLength); 
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.identifier);
        this.gl.bufferSubData(this.gl.ARRAY_BUFFER, this.startOfData, packet, 0);

        this.checkSizeListeners();
    

    }

    appendBuffer(buffer){ // copies the non-empty portion of the provided buffer to the end of the data in this buffer...

        // first make sure our buffer is large enough to handle this incoming data, if not, reallocate....

        let appendBufferSize = buffer.endOfData - buffer.startOfData;

        if(appendBufferSize + this.endOfData >= this.currentBufferByteSize){
            this.extendBuffer((appendBufferSize + this.endOfData) - this.currentBufferByteSize);
        }

        this.gl.bindBuffer(this.gl.COPY_WRITE_BUFFER, this.identifier); // read from the supplied buffer and write to the current buffer
        this.gl.bindBuffer(this.gl.COPY_READ_BUFFER, buffer.identifier);

        this.gl.copyBufferSubData(this.gl.COPY_READ_BUFFER, this.gl.COPY_WRITE_BUFFER, buffer.startOfData, this.endOfData, appendBufferSize); // transfer the contents of supplied buffer to current buffer...

        this.endOfData = this.endOfData + appendBufferSize;
        this.checkSizeListeners();

    }

    prependBuffer(buffer){ // copies the non-empty portion of the provided buffer to the start of the data in this buffer...

        // first make sure our buffer is large enough to handle this incoming data, if not, reallocate....

        let appendBufferSize = buffer.endOfData - buffer.startOfData;

        if(this.startOfData -appendBufferSize < 0){
            this.preExtendBuffer(appendBufferSize - this.startOfData);
        }

        this.gl.bindBuffer(this.gl.COPY_WRITE_BUFFER, this.identifier); // read from the supplied buffer and write to the current buffer
        this.gl.bindBuffer(this.gl.COPY_READ_BUFFER, buffer.identifier);

        this.startOfData = this.startOfData - appendBufferSize;

        this.gl.copyBufferSubData(this.gl.COPY_READ_BUFFER, this.gl.COPY_WRITE_BUFFER, buffer.startOfData, this.startOfData, appendBufferSize); // transfer the contents of supplied buffer to current buffer...

        this.checkSizeListeners();
    }

    extendBuffer(overflowAmount){ // reallocates the buffer, you can imagine this as extending the end of the buffer out
  
        //console.log("buffer extended");


        // first figure out if we are adding more data than a single reallocation will be able to fit. In this case that we are, adjust accordingly..

        let reallocs = Math.ceil((overflowAmount) / (this.perDatumBytes * bufferDefaults.bufferResizeAddPoints));

        let extensionAmount = reallocs*this.perDatumBytes*bufferDefaults.bufferResizeAddPoints;

        let tempIdentifier = this.gl.createBuffer(); // allocates a new, temporary buffer...
        this.gl.bindBuffer(this.gl.COPY_WRITE_BUFFER, tempIdentifier);
        this.gl.bufferData(this.gl.COPY_WRITE_BUFFER, this.currentBufferByteSize + extensionAmount, this.gl.DYNAMIC_DRAW); // allocate space for our buffer
        
        this.gl.bindBuffer(this.gl.COPY_READ_BUFFER, this.identifier); // tell the webgl api that we are going to read from the current buffer object

        this.gl.copyBufferSubData(this.gl.COPY_READ_BUFFER, this.gl.COPY_WRITE_BUFFER, 0, 0, this.currentBufferByteSize);

        this.currentBufferByteSize = this.currentBufferByteSize + extensionAmount;

        this.deallocateBuffer();
        this.identifier = tempIdentifier;

        this.dataWrapper.vaoBufferSwap(this);
    }

    preExtendBuffer(preOverflowAmount){ // reallocates the buffer, you can imagine this as extending the start of the buffer backwards.

        //console.log("buffer pre-extended");


        // first figure out if we are adding more data than a single reallocation will be able to fit. In this case that we are, adjust accordingly..

        let reallocs = Math.ceil(preOverflowAmount / (this.perDatumBytes * bufferDefaults.bufferResizeAddPoints));

        let extensionAmount = reallocs*this.perDatumBytes*bufferDefaults.bufferResizeAddPoints;

        let tempIdentifier = this.gl.createBuffer(); // allocates a new, temporary buffer...
        this.gl.bindBuffer(this.gl.COPY_WRITE_BUFFER, tempIdentifier);
        this.gl.bufferData(this.gl.COPY_WRITE_BUFFER, this.currentBufferByteSize + extensionAmount, this.gl.DYNAMIC_DRAW); // allocate space for our buffer
        
        this.gl.bindBuffer(this.gl.COPY_READ_BUFFER, this.identifier); // tell the webgl api that we are going to read from the current buffer object

        this.gl.copyBufferSubData(this.gl.COPY_READ_BUFFER, this.gl.COPY_WRITE_BUFFER, 0, extensionAmount, this.currentBufferByteSize);
        
        this.startOfData = this.startOfData + extensionAmount;
        this.endOfData = this.endOfData + extensionAmount;

        this.currentBufferByteSize = this.currentBufferByteSize + extensionAmount;

        this.deallocateBuffer();
        this.identifier = tempIdentifier;

        this.dataWrapper.vaoBufferSwap(this);
    }

    // extracts the datum at index (per datum index) relative to the start of data
    // NOTE: this is extremely slow and should not be called every render, or really at all.
    // TODO: the likely hood of someone needing random access the buffer is (hopefully) small, so 
    // I should just store the data I need on the client side instead of having to reach back 
    // into the GPU to grab this data.....
    getDatumRelativeToStart(idx){ 
        let readBuffer = new ArrayBuffer(this.perDatumBytes);
        let dataView = new DataView(readBuffer);
        let returnedData = {};

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.identifier);
        this.gl.getBufferSubData(this.gl.ARRAY_BUFFER, this.startOfData + idx*this.perDatumBytes, dataView);

        returnedData.data = dataView.getFloat32(0, true);
        returnedData.timestamp = dataView.getBigUint64(4, true);

        return returnedData;
    }

    // this is a speed test of finding the index of a point nearest to a provided timestamp....
    binarySearch(timestampToFind){

        if(!timestampToFind){
            throw new Error("FAIL: Please provide the binary search algorithm with a value to find!");
        }

        //console.log(this.getDatumRelativeToStart(5))

        let start = 0;
        let end = this.getNumberOfDatums() - 1;

        let lastCompareResult = 0; // -1 means indx less than to find, 1 mean indx more than to find.

        let mid = 0;
        let midData = null;
        let timestampAtMid = 0;

        while (start <= end){
            mid = Math.floor((start + end) / 2);

            midData = this.getDatumRelativeToStart(mid);
            timestampAtMid = Number(midData.timestamp);

            if (timestampAtMid === timestampToFind) {
              return mid;
            }
        
            if (timestampToFind < timestampAtMid) {
              end = mid - 1;
              lastCompareResult = -1;
            } else {
              start = mid + 1;
              lastCompareResult = 1;
            }
        }
        
        let adjacentIndex = mid + lastCompareResult;
        let adjacentData = this.getDatumRelativeToStart(adjacentIndex)
        let adjacentTimestamp = Number(adjacentData.timestamp);

        if(Math.abs(timestampAtMid - timestampToFind) < Math.abs(adjacentTimestamp - timestampToFind)){
            midData.index = mid;
            return midData;
        }else{
            adjacentData.index = mid;
            return adjacentData;
        }

    }

    getNumberOfDatums(){ // TODO -- not sure if this actually correct.....
        return ((this.endOfData - this.perDatumBytes) - this.startOfData)/(this.perDatumBytes);
    }

    getRawRelativeToStart(idx){ // get raw bytes at BYTE index relative to the start of data
        throw new Error("WHOOPS -- THIS FUNCTION IS NOT IMPLEMENTED YET!!");
    }

    addSizeListener(count, callback){ // adds a listener that will fire whenever the everyCount threshold is reached, resetting after each firing
        this.sizeListeners.push({lastFire: 0 , count , callback})
    }

    checkSizeListeners(){
        let currentSizeDatums = (this.endOfData -this.startOfData)/this.perDatumBytes;
        this.sizeListeners.forEach(el => {
            if((currentSizeDatums - el.lastFire) > el.count){
                el.callback(currentSizeDatums);
                el.lastFire = currentSizeDatums;
            }
        });
    }

    deallocateBuffer(){ // tells the webglAPI that this buffer can be deallocated
        this.gl.deleteBuffer(this.identifier);
    }

}

export default Buffer;



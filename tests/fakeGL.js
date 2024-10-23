// class that is a limited mock of the webgl2 api for use in my unit tests.


// left of working here, mainly with trying to figure out how this buffer should 
// be cleared of data and what that would mean yada yada yada....

export default class FakeGL{

    FLOAT = 1;
    HALF_FLOAT = 2;
    SHORT= 3;
    UNSIGNED_SHORT = 4;
    BYTE = 5;
    UNSIGNED_BYTE = 6; 
    INT = 7;
    UNSIGNED_INT = 8;


    ARRAY_BUFFER = 0x8892; // these constants are ripped from Mozilla's docs on webgl
    COPY_WRITE_BUFFER = 0x8F37;
    COPY_READ_BUFFER = 0x8F36;

    DYNAMIC_DRAW = 0x88E8;
    USAGES = [this.DYNAMIC_DRAW];

    #bindings = {[this.ARRAY_BUFFER]: null, [this.COPY_WRITE_BUFFER]: null, [this.COPY_READ_BUFFER]: null};


    #buffers = [];
    #views = [];


    bindBuffer(bindSpot, bufferId){
        if(this.#bindings[bindSpot] === undefined){
            throw new Error("FAIL(DEV): you have not provided a valid bindSpot! " + bindSpot);
        }

        if(this.#views[bufferId] === undefined){
            throw new Error("FAIL: Provided buffer ID does not match any buffers created!" + bufferId);
        }

        this.#bindings[bindSpot] = bufferId;

        return true;
    }

    bufferData(target, sizeOrData, usage){
        if(!this.USAGES.includes(usage)){
            throw new Error("FAIL(DEV): Invalid usage given for bufferData call: " + usage);
        }

        if(this.#bindings[target] == null){
            throw new Error("FAIL(DEV): Either there is nothing bound to the specified target or such target does not exist!");
        }

        if(typeof sizeOrData === "number"){
            this.#buffers[this.#bindings[target]] = new ArrayBuffer(sizeOrData);
            this.#views[this.#bindings[target]] = new DataView(this.#buffers[this.#bindings[target]]);
        }else{

            if(!(sizeOrData instanceof ArrayBuffer)){
                throw new Error("FAIL(DEV): mock bufferData expects either a number for the size of the buffer or an arrayBuffer of data");
            }

            this.#buffers[this.#bindings[target]] = new ArrayBuffer(sizeOrData.byteLength);
            this.#views[this.#bindings[target]] = new DataView(this.#buffers[this.#bindings[target]]);

            let dataView = new DataView(sizeOrData);

            for(let i = 0 ; i < sizeOrData.byteLength; i++){
                this.#views[this.#bindings[target]].setUint8(i, dataView.getUint8(i,true), true);               
            }
        }



    }


    bufferSubData(target, offset, srcData){
        if(this.#bindings[target] == null){
            throw new Error("FAIL(DEV): Either there is nothing bound to the specified target or such target does not exist!");
        }

        if(!this.#buffers[this.#bindings[target]]){
            throw new Error("FAIL(DEV): bufferSubData requires a buffer's store to be initialized first (I think...)");
        }

        if(!(srcData instanceof ArrayBuffer)){
            throw new Error("FAIL(DEV): mock bufferSubData expects srcData to be an ArrayBuffer object");
        }

        let buffer = this.#buffers[this.#bindings[target]];
        let view = this.#views[this.#bindings[target]];
        let srcView = new DataView(srcData);

        if(offset + srcData.byteLength > buffer.byteLength){
            throw new Error("FAIL(DEV): bufferSubData operation has srcData and an offset that is too large to fit in target!!")
        }

        for(let i = 0; i < srcData.byteLength; i++){
            view.setUint8(offset+i, srcView.getUint8(i, true), true);
        }


    }

    copyBufferSubData(readTarget, writeTarget, readOffset, writeOffset, size){
        if(this.#bindings[readTarget] == null){
            throw new Error("FAIL(DEV): Either there is nothing bound to the specified readTarget or such target does not exist!");
        }

        if(!this.#buffers[this.#bindings[readTarget]]){
            throw new Error("FAIL(DEV): copyBufferSubData requires a buffer's store to be initialized first (I think...)");
        }

        if(this.#bindings[writeTarget] == null){
            throw new Error("FAIL(DEV): Either there is nothing bound to the specified writeTarget or such target does not exist!");
        }

        if(!this.#buffers[this.#bindings[writeTarget]]){
            throw new Error("FAIL(DEV): copyBufferSubData requires a buffer's store to be initialized first (I think...)");
        }

        let readBuffer = this.#buffers[this.#bindings[readTarget]];
        let readView = this.#views[this.#bindings[readTarget]];

        let writeBuffer = this.#buffers[this.#bindings[writeTarget]];
        let writeView = this.#views[this.#bindings[readTarget]];

        if(readOffset + size > readBuffer.byteLength){
            throw new Error("FAIL(DEV): copyBufferSubData operation is trying to read past the end of the attached readBuffer");
        }

        if(writeOffset + size > writeBuffer.byteLength){
            throw new Error("FAIL(DEV): copyBufferSubData operation is trying to read past the end of the attached writeBuffer");
        }

        for(let i = 0; i < size; i++){
            writeView.setUint8(writeOffset + i, readView.getUint8(readOffset + i, true), true)
        }

    }


    createBuffer(){
        this.#buffers.push(null);
        this.#views.push(null);

        return this.#buffers.length - 1;
    }

    deleteBuffer(i){

        this.#buffers[i] = null;
        this.#views[i] = null;

        return true;

    }


    tests_getNonNullBuffers(){
        return this.#buffers.filter(el => el !== null);
    }

    get tests_buffers(){
        return this.#buffers;
    }


}
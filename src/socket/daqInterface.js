// class that abstracts away the interface between the device and its buffers and how I am getting data.....

//TODO: should say ready when a dpm has been picked??? Look into doing this??

class DAQInterface{

    onDataReceipt = null; // callback that will fire when the DAQInterface has received data...
    device = null; // this is the device this DAQInterface is responsible for gathering data for...
    onRequestEnd = null; // callback that will fire when the request being handled by this interface has been satisfied...
    onRequestStart = null; // callback that will fire when the request is started...

    processingRequest = false; // whether or not this DAQInterface is currently processing a request....

    requestQueue = [];

    messagePromises = [];

    daqOpenedPromise = null;

    constructor(device, onDataReceipt, optionals = null){
        this.onDataReceipt = onDataReceipt;
        this.device = device;
        this.daqOpenedPromise = this.addMessagePromise("READY");
    }

    async addRequest(startTime, endTime, dontAddToQueue){ // this is called by the device to say "hey I don't have data here, go and grab it for me!!"

        if(!dontAddToQueue){
            this.requestQueue.push({startTime, endTime});
        }

        if(this.processingRequest){ // if i am currently processing a request, don't allow another request to take over..
            //console.log("Socket is processing a request, bonking!");
            return;
        }

        this.processingRequest = true;

        //console.log("checking to see if daq is ready...");
        
        let daqReady = await this.daqOpenedPromise;

        //console.log("daq is ready -- sending request")

        if(this.onRequestStart){
            this.onRequestStart();
        }

        this.requestImplementation(startTime, endTime);
    }

    onPacketReceipt(event){

        if(typeof event.data === "string"){
            

            let anyHandled = false;

            if(event.data === "PACK"){
                anyHandled = true;
            }else if(event.data === "END"){

                anyHandled = true;

                this.processingRequest = false;
                
                if(this.onRequestEnd){
                    this.onRequestEnd(event.data); // if a onRequestEnd callback has been registered, fire it now....
                }

                if(this.requestQueue.length === 1){
                    this.requestQueue = [];
                }else{
                    this.requestQueue.shift();
                    this.addRequest(this.requestQueue[0].startTime, this.requestQueue[0].endTime, true);
                }

            }

            //console.log(`String message received: ${event.data}`);

            let messageListeners = this.messagePromises.filter(el => el.message === event.data);
            messageListeners.forEach(el => el.resolve(event.data));

            if(messageListeners.length !== 0){
                anyHandled = true;
                this.messagePromises = this.messagePromises.filter(el => el.message !== event.data);
            }

            
            if(!anyHandled){
                console.log(event.data);
                console.warn("WARNING: Got a string response from websocket server that is unhandled by the client!!");
            }
        }else if(event.data instanceof ArrayBuffer){

            let packet = new DataView(event.data);

            //console.log("first datapoint: " + packet.getFloat32(0));
            //console.log("first timestamp: " + packet.getBigInt64(4));
            this.onDataReceipt(packet);

        }else{
            throw new Error("FAIL: Unhandled response type from websocket client.");
        }

    }


    requestImplementation(startDate, endDate){
        throw new Error("requestImplementation has not been overridden!!");
    }

    destroy(){
        throw new Error("destroy has not been overridden!!");
    }


    // registers a new promise object that will be fulfilled when the given message has been received
    // from the back end....
    addMessagePromise(message){ //TODO: maybe use the term message listener??

        if(typeof message !== "string"){
            throw new TypeError("FAIL: addMessagePromise only takes an argument of type String!");
        }

        let resolveFunction = null;
        let rejectFunction = null;

        let promise = new Promise((resolve, reject) => {
            resolveFunction = resolve;
            rejectFunction = reject;
        });

        this.messagePromises.push({promise: promise, resolve: resolveFunction, reject: rejectFunction, message: message});

        return promise;


    }

    cancelRequests(){
        this.requestQueue = [];
        this.processingRequest = false;
        this.daqOpenedPromise = this.sendAndWaitPromise("CANCEL","READY");
        //this.daqOpenedPromise.then(() => console.log("ready received!!"));
    }

    sendMessage(message){
        throw new Error("FAIL: sendMessage has not been overridden by daq implementation!!");
    }

    // sends a message and registers a new promise object that will be be fulfilled when the given message has been received
    // from the back end....
    sendAndWaitPromise(sendMessage, waitMessage){
        this.sendMessage(sendMessage);
        return this.addMessagePromise(waitMessage);
    }
}

export default DAQInterface;
import DAQInterface from "./daqInterface";

class DAQRandom extends DAQInterface{

    timeoutTime = 500;
    perPacketSize = 400;
    timePerDatum = 60000;

    perDatumBytes = 4 + 8;

    center = null;

    constructor(device, onDataReceipt, optionals = null){
        super(device, onDataReceipt, optionals);
        this.center = 50+(2*Math.random() - 1)*0.5;
        this.onPacketReceipt({data: "READY"});
    }

    requestImplementation(startTime, endTime){

        if(startTime < endTime){
            this.lastLoadedTime = startTime;
            this.randoPacketTO = setTimeout(this.randoPacket.bind(this), this.timeoutTime, startTime, endTime);
        }else{
            this.lastLoadedTime = startTime;
            this.randoPacketTO = setTimeout(this.randoPacketReverse.bind(this), this.timeoutTime, endTime, startTime);
        }
    }

    sendMessage(message){
        if(message === "CANCEL"){
            this.onPacketReceipt({data: "READY"});
        }else{
            console.log(`message ${message} is not handled by random daq implementation`)
        }
    }


    randoPacket(start, end){
        
        let dataBuf = new ArrayBuffer(this.perPacketSize*this.perDatumBytes);
        let dataView = new DataView(dataBuf);

        let endOfBuf = 0;

        for(let i = 0; i < this.perPacketSize; i++){
            if(this.lastLoadedTime > end){

                clearTimeout(this.randoPacketTO);

                this.onPacketReceipt({data: dataBuf.slice(0,endOfBuf)});
                this.onPacketReceipt({data: "END"});

                return;
            }

            dataView.setFloat32(i*this.perDatumBytes, this.center + 0.1*(2*Math.random() - 1), true);
            dataView.setBigUint64(i*this.perDatumBytes + 4 , BigInt(this.lastLoadedTime), true);

            this.lastLoadedTime = this.lastLoadedTime + this.timePerDatum;

            endOfBuf = (i+1)*this.perDatumBytes;
        }

        this.onPacketReceipt({data: dataBuf});

        this.randoPacketTO = setTimeout(this.randoPacket.bind(this), this.timeoutTime, start, end);

    }


    randoPacketReverse(start, end){ // reverse chronological streaming...
        
        let dataBuf = new ArrayBuffer(this.perPacketSize*this.perDatumBytes);
        let dataView = new DataView(dataBuf);

        let startOfBuf = this.perPacketSize*this.perDatumBytes;

        //console.log(`starting to build a rando reverse packet. Start time is ${new Date(start)}`);
        //console.log(`starting to build a rando reverse packet. lastLoaded time from the last build is ${new Date(this.lastLoadedTime)}`);

        for(let i = this.perPacketSize - 1; i >= 0; i--){
            if(this.lastLoadedTime < start){

                clearTimeout(this.randoPacketTO);

                this.onPacketReceipt({data: dataBuf.slice(startOfBuf)});
                this.onPacketReceipt({data: "END"});

                return;
            }

            dataView.setFloat32(i*this.perDatumBytes, this.center + 0.1*(2*Math.random() - 1), true);
            dataView.setBigUint64(i*this.perDatumBytes + 4 , BigInt(this.lastLoadedTime), true);

            this.lastLoadedTime = this.lastLoadedTime - this.timePerDatum;

            //console.log(`Last loaded time is ` + new Date(this.lastLoadedTime))

            startOfBuf = i*this.perDatumBytes;
        }

        this.onPacketReceipt({data: dataBuf});

        this.randoPacketTO = setTimeout(this.randoPacketReverse.bind(this), this.timeoutTime, start, end);

    }

    destroy(){
        console.log("destroying random imp");
    }

}

export default DAQRandom;
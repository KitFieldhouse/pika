import DAQInterface from "./daqInterface.js"

// daq for grabbing data through a data socket connection on DPE05................

class DAQSocket extends DAQInterface{
   
    socketConnection = null;

    perDatumBytes = 4 + 8;

    name = null;

    hostname = null;

    constructor(device, onDataReceipt, optionals = null){
        super(device, onDataReceipt, optionals);

        this.name = optionals.name ?? "";

        this.hostname = location.host;

        if(this.hostname.includes("localhost")){
            this.socketConnection = new WebSocket("wss://localhost:8442/hello/dataloggerSocket");
        }else{
            this.socketConnection = new WebSocket("wss://dpe05.fnal.gov:8442/hello/dataloggerSocket");
        }

        this.socketConnection.binaryType = "arraybuffer";

        this.socketConnection.addEventListener("open", () => console.log("socket connection was opened: " + ( optionals.name ?? '')));
        this.socketConnection.addEventListener("close", () => {console.log("socket connection was closed: " + ( optionals.name ?? '')); this.socketConnection = null;});
        this.socketConnection.addEventListener("message",(ev) => this.onPacketReceipt(ev));

    }

    requestImplementation(startTime, endTime){
        
        //console.log("adding start of data request: " + this.name);

        if(!this.socketConnection){ // TODO: should handle this case gracefully..........
            throw new Error("socket is not available or has been closed: " + this.name);
        }

        if(!this.device.deviceName || !this.device.ftd || !this.device.datalogger){
            throw new Error("FAIL: device must be supplied with a device name, ftd, and a datalogger node to sample from!!");
        }

        console.log(`${this.device.deviceName}@${this.device.ftd}<-LOGGER:[${this.fermiTimeFormat(startTime)} ${this.fermiTimeFormat(endTime)}]:${this.device.datalogger}`);

        this.socketConnection.send(`${this.device.deviceName}@${this.device.ftd}<-LOGGER:[${this.fermiTimeFormat(startTime)} ${this.fermiTimeFormat(endTime)}]:${this.device.datalogger}`);
    }

    sendMessage(message){
        
        if(!this.socketConnection){ // TODO: should handle this case gracefully..........
            throw new Error("socket is not available or has been closed: " + this.name);
        }

        //console.log(`Sending message: ${message}`);

        this.socketConnection.send(message);
    }


    fermiTimeFormat(milliseconds){ // formats a millisecond date to the format supported by the DPM's.....

        let dateString = (new Date(milliseconds)).toLocaleDateString('en-us',{month:'short', year:'numeric', day:'numeric', hour:'numeric' , minute:'numeric', second: 'numeric', hourCycle: "h24"});
    
        
        let spaceSplit = dateString.split(' ');
    
        if(spaceSplit[3].slice(0,2) === "24"){
            spaceSplit[3] = "00" + spaceSplit[3].slice(2);
        }
    
        return spaceSplit[1].slice(0, spaceSplit[1].length - 1) + "-" + spaceSplit[0].toUpperCase() + "-" + spaceSplit[2].slice(0, spaceSplit[2].length - 1) + " " + spaceSplit[3];
    
    }

    destroy(){
        console.log("closing socket");
        this.sendMessage("CANCEL");
        this.socketConnection.close();
    }

}

export default DAQSocket;
// A "Device" in an abstract sense is nothing more than a collection of data points and
// metadata. Think about plotting some parameter on a 2D plot, say some measured value 
// vs time. In this case the "Device" encapsulates all x and y data for that plot. 
// Further metadata like the name of the parameter, its units and such can also 
// be stored in this class, but that is optional.
//
// The underlying render engine could have several different ways of passing the x and y 
// data to the Webgl API. For instance, it could store the x and y data in one big buffer 
// where each x value is immediately followed by the corresponding y point. Alternatively, 
// one could decide that the buffer should have all of the x values at the start of the 
// buffer followed by all of the y values, or maybe the x values and y values are stored 
// in separate buffers.
//
// Of course the actual storage of the data should be an implementation detail that is 
// abstracted away by class that provides simple means of "Adding" and "Deleting" data.
// This is precisely the goal of this class!


class DeviceInterface {

    #lifecycleListeners = {};
    #style = {}; // set display params for the device

    constructor(){

    }

    grabAllRawData(){

    }

    setDisplayParams(){

    }

    addRequest(){

    }


    #fireLifecycleListeners(event){
        if(!this.#lifecycleListeners[event]){
            return;
        }

        this.#lifecycleListeners[event].forEach(el => el(this));
    }


    addLifecycleListener(event, callback){
        if(!this.#lifecycleListeners[event]){
            this.#lifecycleListeners[event] = [];
        }

        this.#lifecycleListeners[event].push(callback);
    }

    /*
        to be filled in
    */
}



export default DeviceInterface;
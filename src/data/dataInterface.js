/** This interface is designed to wrap a specific sequence of data. 
 *  The interface is not biased on if the underlying buffer is described 
 *  by a single VAO or several VAOs.
 * **/

class dataInterface {

    #internalState = null;
    #stateListeners = {};

    constructor(){

    }

    /* Implementation specific methods that should be overridden */

    glRenderData(){

    }

    appendData(){

    }

    prependData(){

    }

    deleteAllData(){

    }

    deleteUpToIndex(){

    }

    deleteFromIndex(){

    }

    /* Methods that should **not** be overridden */

    // changes the internal state of the data wrapper
    changeState(newState){
        this.#stateListeners[newState] && this.#stateListeners[newState].onEnter && this.#stateListeners[newState].onEnter.forEach(el => el(this.#internalState, newState));
        this.#stateListeners[this.#internalState] && this.#stateListeners[this.#internalState].onLeave && this.#stateListeners[this.#internalState].onLeave .forEach(el => el(this.#internalState, newState));
        this.#internalState = newState;

    }

    // register event listeners for different state changes
    onStateChange(type, state, func){

        if(type !== "onEnter" && type !== "onLeave" ){
            throw new Error("FAIL: onStateChange only accepts the following state change type: onEnter, onLeave.");
        }

        if(!this.#stateListeners[state]){
            this.#stateListeners[state] = {};
        }

        if(!this.#stateListeners[state][type]){
            this.#stateListeners[state][type] = [];
        }

        this.#stateListeners[state][type].push(func);

    }


}
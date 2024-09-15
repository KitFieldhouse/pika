import GL from '../src/webglHandler/webglHandler.js';
import layout from '../src/data/layout.js';

const inputs = [ {name: 'x', size: 1, type: 'float'},
    {name: 'y', size: 1, type: 'float'},
    {name: 'a', size: 1, type: 'float'},
    {name: 'b', size: 1, type: 'float'}];


let out = new layout([[GL.repeat(['x'], ['y'])], GL.repeat('x')], inputs);

console.log("---------------------PARSING OVER---------------------")

console.log(out.getValue('x', [[[1], [2], [3], [4], [5], [6], [7], [8]], -1, -2, -3 , -4] , 6));


test("Dummy first test", () =>{


    expect('insta fail!').toBe('insta fail!');

});
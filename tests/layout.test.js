import GL from '../src/webglHandler/webglHandler.js';
import Layout from '../src/data/layout.js';

// testing the layout constructor...

const inputs = [ {name: 'x', size: 1, type: 'float'},
    {name: 'y', size: 1, type: 'float'},
    {name: 'z', size: 1, type: 'float'},
    {name: 'b', size: 1, type: 'float'}];

// first testing for single vector...


let out = new Layout([GL.repeat('x', 'y'), GL.repeat('z')], inputs);

console.log("---------------------PARSING OVER---------------------")

console.log(out.getValue('z', [1, 2, 3, 4, 5, 6 , -1, -2, -3], 2));


test("Dummy first test", () =>{


    expect('insta fail!').toBe('insta fail!');

});
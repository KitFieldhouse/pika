import GL from '../src/webglHandler/webglHandler.js';
import Layout from '../src/data/layout.js';

const inputs = [ {name: 'x', size: 1, type: 'float'},
    {name: 'y', size: 1, type: 'float'},
    {name: 'z', size: 1, type: 'float'},
    {name: 'b', size: 1, type: 'float'}];


const mixed = [ {name: 'f', size: 1, type: 'float'},
        {name: 'i', size: 1, type: 'byte'}]


// -------------------------------------------------------------------
// -----------------------LAYOUT SYNTAX CHECKING----------------------
// -------------------------------------------------------------------


test("Objects in layout descriptor must be produced by Gl.repeat variants", () =>{
    expect(() => new Layout([GL.repeat('x', 'y', {})], inputs)).toThrow("repeat variant");
});

test("Layout descriptor must be an array", () =>{
    expect(() => new Layout(GL.repeat('x', 'y'), inputs)).toThrow("Layout descriptor must be an array");
});

test("Must use inputs that are actually defined", () =>{
    expect(() => new Layout([GL.repeat('x', 'foo')], inputs)).toThrow("was not found for this layout");
});

test("Layout Syntax: No naked nested repeats allowed", () =>{
    expect(() => new Layout([GL.repeat('x', 'y', GL.repeat('b', 'z'))], inputs)).toThrow("no 'naked' repeats");
});


// -------------------------------------------------------------------
// --------------------SINGE INDEXED DATA RETRIEVAL TESTS-------------
// -------------------------------------------------------------------

let layout = new Layout([GL.repeat('x', 'y')], inputs);

let unevenData = [1,2,3,4,5,6,7,8,9];

test("Test retrieving single dimensional, single repeat, array data grab, with unchoppable data", () =>{
    expect(() => layout.getValue('x', unevenData, 2)).toThrow("Can not chop up provided data array in even chunks of data descriptor");
});

let data = [1,2,3,4,5,6,7,8,9,10];

test("Test retrieving single dimensional, single repeat, array data grab", () =>{
    expect(layout.getValue('x', data, 2)).toBe(5);
});

test("Test retrieving single dimensional, single repeat, array data grab", () =>{
    expect(layout.getValue('x', data, 4)).toBe(9);
});

test("Test retrieving single dimensional, single repeat, array data grab", () =>{
    expect(layout.getValue('x', data, 20)).toBe(null);
});



let multiRepeatLayout = new Layout([GL.repeat('x', 'y'), GL.repeat('z', 'b')], inputs);

let badMultiRepeatData = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18]; // length not divisable by 4 => can't auto chop!


test("Test retrieving single dimensional, multi repeat, array data grab, with unchoppable data", () =>{
    expect(() => multiRepeatLayout.getValue('x', badMultiRepeatData, 2)).toThrow("Can not chop up provided data array in even chunks of data descriptor");
});


let multiRepeatData = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18, 19, 20]; // five repeats auto divided to each repeat....

test("Test retrieving single dimensional, multi repeat, array data grab", () =>{
    expect(multiRepeatLayout.getValue('y', multiRepeatData, 2)).toBe(6);
});

test("Test retrieving single dimensional, multi repeat, array data grab", () =>{
    expect(multiRepeatLayout.getValue('z', multiRepeatData, 4)).toBe(19);
});

test("Test retrieving single dimensional, multi repeat, array data grab", () =>{
    expect(multiRepeatLayout.getValue('b', multiRepeatData, 0)).toBe(12);
});


let byteDataUneven = new Float32Array([1,2,3,4,5,6,7,8,9]);

test("Test retrieving single dimensional, single repeat, buffer data grab, with unchoppable data", () =>{
    expect(() => layout.getValue('x', [byteDataUneven.buffer], 2)).toThrow("Can not chop up provided data array in even chunks of data descriptor");
});

let byteData = new Float32Array([1,2,3,4,5,6,7,8,9,10]);


test("Test retrieving single dimensional, single repeat, buffer data grab", () =>{
    expect(layout.getValue('x', [byteData.buffer], 2)).toBe(5);
});

test("Test retrieving single dimensional, single repeat, buffer data grab", () =>{
    expect(layout.getValue('x', [byteData.buffer], 4)).toBe(9);
});

test("Test retrieving single dimensional, single repeat, buffer data grab", () =>{
    expect(layout.getValue('x', [byteData.buffer], 20)).toBe(null);
});


let badMultiRepeatDataBuffer = new Float32Array([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18]); // length not divisable by 4 => can't auto chop!


test("Test retrieving single dimensional, multi repeat, buffer data grab, with unchoppable data", () =>{
    expect(() => multiRepeatLayout.getValue('x', [badMultiRepeatDataBuffer.buffer], 2)).toThrow("Can not chop up provided data array in even chunks of data descriptor");
});


let multiRepeatDataBuffer = new Float32Array([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18, 19, 20]); // five repeats auto divided to each repeat....

test("Test retrieving single dimensional, multi repeat, buffer data grab", () =>{
    expect(multiRepeatLayout.getValue('y', [multiRepeatDataBuffer.buffer], 2)).toBe(6);
});

test("Test retrieving single dimensional, multi repeat, buffer data grab", () =>{
    expect(multiRepeatLayout.getValue('z', [multiRepeatDataBuffer.buffer], 4)).toBe(19);
});

test("Test retrieving single dimensional, multi repeat, buffer data grab", () =>{
    expect(multiRepeatLayout.getValue('b', [multiRepeatDataBuffer.buffer], 0)).toBe(12);
});

let mixedTypeLayout = new Layout([GL.repeat('f','i')] , mixed);

let mixedTypeBuffer = new ArrayBuffer(25);
let mixedView = new DataView(mixedTypeBuffer);

for(let i = 0; i < 5; i++){
    mixedView.setFloat32(i*5, i*10, true);
    mixedView.setUint8(i*5 + 4, i, true);
}


test("Test retrieving single dimensional, multi repeat, buffer data grab", () =>{
    expect(mixedTypeLayout.getValue('f', [mixedTypeBuffer], 0)).toBe(0);
});

test("Test retrieving single dimensional, multi repeat, buffer data grab", () =>{
    expect(mixedTypeLayout.getValue('i', [mixedTypeBuffer], 1)).toBe(1);
});

test("Test retrieving single dimensional, multi repeat, buffer data grab", () =>{
    expect(mixedTypeLayout.getValue('i', [mixedTypeBuffer], 3)).toBe(3);
});



// -------------------------------------------------------------------
// --------------------MULTI INDEXED DATA RETRIEVAL TESTS-------------
// -------------------------------------------------------------------

// -------------------------------------------------------------------
// --------------------getNext DATA RETRIEVAL TESTS-------------------
// -------------------------------------------------------------------




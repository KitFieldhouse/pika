import GL from '../src/webglHandler/webglHandler.js';
import Layout from '../src/data/layout.js';

const inputs = {x: {name: 'x', size: 1, type: 'float'},
    y: {name: 'y', size: 1, type: 'float'},
    z: {name: 'z', size: 1, type: 'float'},
    b: {name: 'b', size: 1, type: 'float'}};


const mixed = {f: {name: 'f', size: 1, type: 'float'},
        i: {name: 'i', size: 1, type: 'byte'}};



const inputWithVectors = {v: {name: 'v', size: 3, type: 'float'},
            w: {name: 'w', size: 2, type: 'float'},
            x: {name: 'x', size: 1, type: 'float'},
            y: {name: 'y', size: 1, type: 'float'}};


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

let mixedTypeBufferBad = new ArrayBuffer(24);
let mixedViewBad = new DataView(mixedTypeBufferBad);

for(let i = 0; i < 5; i++){
    mixedViewBad.setFloat32(i*5, i*10, true);

    if(i === 4){
        break;
    }

    mixedViewBad.setUint8(i*5 + 4, i, true);
}

test("Test retrieving single dimensional, multi repeat, buffer data grab, with unchoppable data", () =>{
    expect(() => mixedTypeLayout.getValue('i', [mixedTypeBufferBad], 2)).toThrow("Can not chop up provided data array in even chunks of data descriptor");
});


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


// first for arrays

let multiDimLayout = new Layout([GL.repeat([GL.repeat('x')])], inputs);
let multiDimData = [[1,2,3], [4,5,6], [6,7,8]];

test("Test retrieving multi dimensional, single repeat, array data grab", () =>{
    expect(multiDimLayout.getValue('x', multiDimData, 0, 0)).toBe(1);
});

test("Test retrieving multi dimensional, single repeat, array data grab", () =>{
    expect(multiDimLayout.getValue('x', multiDimData, 1, 1)).toBe(5);
});


test("Test retrieving multi dimensional, single repeat, array data grab", () =>{
    expect(multiDimLayout.getValue('x', multiDimData, 2, 0)).toBe(6);
});

test("Test retrieving multi dimensional, single repeat, array data grab", () =>{
    expect(multiDimLayout.getValue('x', multiDimData, 5, 0)).toBe(null);
});

test("Test retrieving multi dimensional, single repeat, array data grab", () =>{
    expect(multiDimLayout.getValue('x', multiDimData, 0, 10)).toBe(null);
});

test("Test retrieving multi dimensional, single repeat, array data grab", () =>{
    expect(multiDimLayout.getValue('x', multiDimData, 0)).toBe(1);
});

test("Test retrieving multi dimensional, single repeat, array data grab", () =>{
    expect(multiDimLayout.getValue('x', multiDimData, 6)).toBe(6);
});

test("Test retrieving multi dimensional, single repeat, array data grab", () =>{
    expect(multiDimLayout.getValue('x', multiDimData, 30)).toBe(null);
});

let multiDimDataUneven = [[1,2,3,4,5,6], [7,8,9], [10]];

test("Test retrieving multi dimensional, single repeat, array data grab", () =>{
    expect(multiDimLayout.getValue('x', multiDimDataUneven, 6)).toBe(7);
});

test("Test retrieving multi dimensional, single repeat, array data grab", () =>{
    expect(multiDimLayout.getValue('x', multiDimDataUneven, 9)).toBe(10);
});


test("Test retrieving multi dimensional, single repeat, array data grab", () =>{
    expect(multiDimLayout.getValue('x', multiDimDataUneven, 1,2)).toBe(9);
});

test("Test retrieving multi dimensional, single repeat, array data grab", () =>{
    expect(multiDimLayout.getValue('x', multiDimDataUneven, 0,5)).toBe(6);
});


let multiDimLayoutMultiRepeat = new Layout([GL.repeat([GL.repeat('x','y'), GL.repeat('z', 'b')])], inputs);

let multiDimDataMultiRepeatUneven = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11]]

test("Test retrieving multi dimensional, multi repeat, array data grab", () =>{
    expect(() => multiDimLayoutMultiRepeat.getValue('x', multiDimDataMultiRepeatUneven, 2, 0)).toThrow("Can not chop up provided data array in even chunks of data descriptor");
});


let multiDimDataMultiRepeat = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]]

test("Test retrieving multi dimensional, multi repeat, array data grab", () =>{
    expect(multiDimLayoutMultiRepeat.getValue('x', multiDimDataMultiRepeat, 2)).toBe(9);
});

test("Test retrieving multi dimensional, multi repeat, array data grab", () =>{
    expect(multiDimLayoutMultiRepeat.getValue('y', multiDimDataMultiRepeat, 0)).toBe(2);
});


test("Test retrieving multi dimensional, multi repeat, array data grab", () =>{
    expect(multiDimLayoutMultiRepeat.getValue('y', multiDimDataMultiRepeat, 100)).toBe(null);
});



test("Test retrieving multi dimensional, multi repeat, array data grab", () =>{
    expect(multiDimLayoutMultiRepeat.getValue('z', multiDimDataMultiRepeat, 1, 2)).toBe(null);
});

test("Test retrieving multi dimensional, multi repeat, array data grab", () =>{
    expect(multiDimLayoutMultiRepeat.getValue('z', multiDimDataMultiRepeat, 1, 0)).toBe(7);
});

test("Test retrieving multi dimensional, multi repeat, array data grab", () =>{
    expect(multiDimLayoutMultiRepeat.getValue('z', multiDimDataMultiRepeat, 2, 0)).toBe(11);
});



// now for buffers

let multiDimDataBuffer = [[(new Float32Array([1,2,3])).buffer], [(new Float32Array([4,5,6])).buffer], [(new Float32Array([6,7,8])).buffer]];

test("Test retrieving multi dimensional, single repeat, buffer data grab", () =>{
    expect(multiDimLayout.getValue('x', multiDimDataBuffer, 0, 0)).toBe(1);
});

test("Test retrieving multi dimensional, single repeat, buffer data grab", () =>{
    expect(multiDimLayout.getValue('x', multiDimDataBuffer, 1, 1)).toBe(5);
});


test("Test retrieving multi dimensional, single repeat, buffer data grab", () =>{
    expect(multiDimLayout.getValue('x', multiDimDataBuffer, 2, 0)).toBe(6);
});

test("Test retrieving multi dimensional, single repeat, buffer data grab", () =>{
    expect(multiDimLayout.getValue('x', multiDimDataBuffer, 5, 0)).toBe(null);
});

test("Test retrieving multi dimensional, single repeat, buffer data grab", () =>{
    expect(multiDimLayout.getValue('x', multiDimDataBuffer, 0, 10)).toBe(null);
});

test("Test retrieving multi dimensional, single repeat, buffer data grab", () =>{
    expect(multiDimLayout.getValue('x', multiDimDataBuffer, 0)).toBe(1);
});

test("Test retrieving multi dimensional, single repeat, buffer data grab", () =>{
    expect(multiDimLayout.getValue('x', multiDimDataBuffer, 6)).toBe(6);
});

test("Test retrieving multi dimensional, single repeat, buffer data grab", () =>{
    expect(multiDimLayout.getValue('x', multiDimDataBuffer, 30)).toBe(null);
});

let multiDimDataUnevenBuffer = [[(new Float32Array([1,2,3,4,5,6])).buffer], [(new Float32Array([7, 8 , 9])).buffer], [(new Float32Array([10])).buffer]];

test("Test retrieving multi dimensional, single repeat, buffer data grab", () =>{
    expect(multiDimLayout.getValue('x', multiDimDataUnevenBuffer, 6)).toBe(7);
});

test("Test retrieving multi dimensional, single repeat, buffer data grab", () =>{
    expect(multiDimLayout.getValue('x', multiDimDataUnevenBuffer, 9)).toBe(10);
});


test("Test retrieving multi dimensional, single repeat, buffer data grab", () =>{
    expect(multiDimLayout.getValue('x', multiDimDataUnevenBuffer, 1,2)).toBe(9);
});

test("Test retrieving multi dimensional, single repeat, buffer data grab", () =>{
    expect(multiDimLayout.getValue('x', multiDimDataUnevenBuffer, 0,5)).toBe(6);
});


let multiDimDataMultiRepeatUnevenBuffer = [[(new Float32Array([1,2,3,4])).buffer], [(new Float32Array([5,6,7,8])).buffer], [(new Float32Array([9, 10, 11]).buffer)]]

test("Test retrieving multi dimensional, multi repeat, buffer data grab", () =>{
    expect(() => multiDimLayoutMultiRepeat.getValue('x', multiDimDataMultiRepeatUnevenBuffer, 2, 0)).toThrow("Can not chop up provided data array in even chunks of data descriptor");
});


let multiDimDataMultiRepeatBuffer = [[(new Float32Array([1,2,3,4])).buffer], [(new Float32Array([5,6,7,8])).buffer], [(new Float32Array([9, 10, 11, 12]).buffer)]]

test("Test retrieving multi dimensional, multi repeat, buffer data grab", () =>{
    expect(multiDimLayoutMultiRepeat.getValue('x', multiDimDataMultiRepeatBuffer, 2)).toBe(9);
});

test("Test retrieving multi dimensional, multi repeat, buffer data grab", () =>{
    expect(multiDimLayoutMultiRepeat.getValue('y', multiDimDataMultiRepeatBuffer, 0)).toBe(2);
});


test("Test retrieving multi dimensional, multi repeat, buffer data grab", () =>{
    expect(multiDimLayoutMultiRepeat.getValue('y', multiDimDataMultiRepeatBuffer, 100)).toBe(null);
});



test("Test retrieving multi dimensional, multi repeat, buffer data grab", () =>{
    expect(multiDimLayoutMultiRepeat.getValue('z', multiDimDataMultiRepeatBuffer, 1, 2)).toBe(null);
});

test("Test retrieving multi dimensional, multi repeat, buffer data grab", () =>{
    expect(multiDimLayoutMultiRepeat.getValue('z', multiDimDataMultiRepeatBuffer, 1, 0)).toBe(7);
});

test("Test retrieving multi dimensional, multi repeat, buffer data grab", () =>{
    expect(multiDimLayoutMultiRepeat.getValue('z', multiDimDataMultiRepeatBuffer, 2, 0)).toBe(11);
});




// -------------------------------------------------------------------
// --------------------getNext DATA RETRIEVAL TESTS-------------------
// -------------------------------------------------------------------



// layout;


test("Test retrieving single dimensional, single repeat, array getNext datagrab", () =>{
    expect(Array.from(layout.createInputIterator('x', data))).toEqual([1,3,5,7,9]);
});



test("Test retrieving single dimensional, single repeat, buffer getNext datagrab", () =>{
    expect(Array.from(layout.createInputIterator('x', [byteData.buffer]))).toEqual([1,3,5,7,9]);
});


// multiRepeatLayout;

test("Test retrieving single dimensional, multi repeat, array getNext datagrab", () =>{
    expect(Array.from(multiRepeatLayout.createInputIterator('b', multiRepeatData))).toEqual([12, 14, 16, 18, 20]);
});

test("Test retrieving single dimensional, multi repeat, buffer getNext datagrab", () =>{
    expect(Array.from(multiRepeatLayout.createInputIterator('b', [multiRepeatDataBuffer.buffer]))).toEqual([12, 14, 16, 18, 20]);
});



// multiDimLayout;

test("Test retrieving multi dimensional, single repeat, array getNext datagrab", () =>{

    expect(Array.from(multiDimLayout.createInputIterator('x', multiDimData))).toEqual([1,2,3,4,5,6,6,7,8]);
});

test("Test retrieving multi dimensional, single repeat, buffer getNext datagrab", () =>{

    expect(Array.from(multiDimLayout.createInputIterator('x', multiDimDataBuffer))).toEqual([1,2,3,4,5,6,6,7,8]);
});


// multiDimLayoutMultiRepeat;


test("Test retrieving multi dimensional, multi repeat, array getNext datagrab", () =>{
    expect(Array.from(multiDimLayoutMultiRepeat.createInputIterator('z', multiDimDataMultiRepeat))).toEqual([3,7,11]);
});

test("Test retrieving multi dimensional, multi repeat, buffer getNext datagrab", () =>{
    expect(Array.from(multiDimLayoutMultiRepeat.createInputIterator('z', multiDimDataMultiRepeatBuffer))).toEqual([3,7,11]);
});


// mixedTypeLayout;


test("Test retrieving mixed type buffer getNext datagrab", () =>{
    expect(Array.from(mixedTypeLayout.createInputIterator('f', [mixedTypeBuffer]))).toEqual([0, 10, 20, 30, 40]);
    expect(Array.from(mixedTypeLayout.createInputIterator('i', [mixedTypeBuffer]))).toEqual([0, 1, 2, 3, 4]);
});

// -------------------------------------------------------------------
// --------------------Array vector grab for data-------------------
// -------------------------------------------------------------------


let multiDimLayoutMultiRepeatVectors = new Layout([GL.repeat([GL.repeat('v','x')]), GL.repeat([GL.repeat('w', 'y')])], inputWithVectors);
let vectorData = [[[1,2,3], 4], [[5,6,7], 8, [9, 10, 11], 12], [[-1, -2, -3], -4], [[0,0], 1], [[1,1], 2, [2,2], 3], [[3,3], 4]]

test("Test retrieving multi dimensional, multi repeat, array datagrab with vectors", () =>{
    expect(multiDimLayoutMultiRepeatVectors.getValue('v', vectorData, 2)).toEqual([9, 10, 11]);
});


test("Test retrieving multi dimensional, multi repeat, array datagrab with vectors", () =>{
    expect(multiDimLayoutMultiRepeatVectors.getValue('w', vectorData, 3)).toEqual([3,3]);
});


test("Test retrieving multi dimensional, multi repeat, array datagrab with vectors", () =>{
    expect(multiDimLayoutMultiRepeatVectors.getValue('y', vectorData, 3)).toEqual(4);
});


let multiDimLayoutMultiRepeatVectorsExp = new Layout([GL.repeat([GL.repeat('v','x')]), GL.repeat([GL.repeat('w', 'y')])], inputWithVectors, {expandVectors: ['v', 'w']});


let vectorDataExp = [[1,2,3, 4], [5,6,7, 8, 9, 10, 11, 12], [-1, -2, -3, -4], [0,0, 1], [1,1, 2, 2,2, 3], [3,3, 4]]

test("Test retrieving multi dimensional, multi repeat, array datagrab with vectors expanded", () =>{
    expect(multiDimLayoutMultiRepeatVectorsExp.getValue('v', vectorDataExp, 2)).toEqual([9, 10, 11]);
});


test("Test retrieving multi dimensional, multi repeat, array datagrab with vectors expanded", () =>{
    expect(multiDimLayoutMultiRepeatVectorsExp.getValue('w', vectorDataExp, 3)).toEqual([3,3]);
});


test("Test retrieving multi dimensional, multi repeat, array datagrab with vectors expanded", () =>{
    expect(multiDimLayoutMultiRepeatVectorsExp.getValue('y', vectorDataExp, 3)).toEqual(4);
});



let multiDimLayoutMultiRepeatVectorsMixExp = new Layout([[GL.repeat({expandVectors: ['v']}, 'v')], [GL.repeat('v')]], inputWithVectors);


let vectorDataMixExp = [[1,2,3,4,5,6], [[7,8,9], [10,11,12]]];

test("Test retrieving multi dimensional, multi repeat, array datagrab with vectors mixed expanded", () =>{
    expect(Array.from(multiDimLayoutMultiRepeatVectorsMixExp.createInputIterator('v', vectorDataMixExp))).toEqual([[1,2,3], [4,5,6], [7,8,9], [10, 11, 12]]);
});

let vectorDataMixExpBad = [[1,2,3,4,5,6], [7,8,9,10,11,1]]

test("Unexpanded vectors should throw an error if they are not of type array in the source data", () =>{
    expect(() => Array.from(multiDimLayoutMultiRepeatVectorsMixExp.createInputIterator('v', vectorDataMixExpBad))).toThrow("FAIL: Vectors that have not been explicitly expanded need to have type array!");
});


let vectorDataMixWrongSize = [[1,2,3,4,5,6], [[7,8], [10,11]]];

test("Vectors are checked that they have the correct dimension when unexpanded", () =>{
    expect(() => Array.from(multiDimLayoutMultiRepeatVectorsMixExp.createInputIterator('v', vectorDataMixWrongSize))).toThrow("FAIL: Provided data has incorrect vector dimension for input: v");
});








// TODO: more tests for vector grab: with buffer and with the iterator



import GL from '../src/webglHandler/webglHandler.js'
import VertexBuffer from '../src/buffer/vertexBuffer.js';
import fakeCanvas from './fakeCanvas.js';

const defaultRepeatOpts = {size: 100};

// these tests are designed to make sure the the GL.createDataSet() function is 
// catching mismatched and incorrect inputs, layout descriptors and is passing the 
// correct information down to the vertexBuffer objects that it creates.

var mockConstructor;

jest.mock('../src/buffer/vertexBuffer.js', () => {

  mockConstructor =  jest.fn().mockImplementation(() => {
    return {};
  });


  return mockConstructor
});

let fakeGL = fakeCanvas.getContext();

beforeEach(() => {
  // Clear all instances and calls to constructor and all methods:
  mockConstructor.mockClear();
});


test("Test layout with a single atom and a single buffer", () => {
    let gl = new GL(fakeCanvas);

    let inputs = {
        y: {name: 'y', size: 1, type: 'float', normalized: false},
        timestamps: {name: 'timestamps', integer: true, size: 2, type: 'unsignedInt'}
    };

    gl.createDataSet({inputs: Object.values(inputs),
    layout: [GL.VertexBuffer([GL.repeat('y', 'timestamps')])]});

    expect(mockConstructor).toHaveBeenCalledTimes(1);
    expect(mockConstructor).toHaveBeenLastCalledWith([GL.repeat('y', 'timestamps')], inputs , gl, undefined);
});


test("Test layout with two atoms and a single buffer", () => {
  let gl = new GL(fakeCanvas);

  let inputs = {
    'y': {name: 'y', size: 1, type: 'float', normalized: false},
    'timestamps': {name: 'timestamps', integer: true, size: 2, type: 'unsignedInt'}
    };

  gl.createDataSet({inputs: Object.values(inputs),
  layout: [GL.VertexBuffer([GL.repeat('y'), GL.endRepeat('timestamps')])]});

  expect(mockConstructor).toHaveBeenCalledTimes(1);
  expect(mockConstructor).toHaveBeenLastCalledWith([GL.repeat('y'), GL.endRepeat('timestamps')], inputs, gl, undefined);
});


test("Test layout with two atoms and two buffers", () => {
  let gl = new GL(fakeCanvas);

  let inputs = {
    y: {name: 'y', size: 1, type: 'float'},
    timestamps: {name: 'timestamps', size: 2, type: 'unsignedInt'}
    };

  gl.createDataSet({inputs: Object.values(inputs),
  layout: [GL.VertexBuffer([GL.repeat('y')]),
           GL.VertexBuffer([GL.repeat('timestamps')])]});

  expect(mockConstructor).toHaveBeenCalledTimes(2);
  expect(mockConstructor).toHaveBeenNthCalledWith(1, [GL.repeat('y')], inputs , gl, undefined);
  expect(mockConstructor).toHaveBeenNthCalledWith(2, [GL.repeat('timestamps')], inputs, gl, undefined);
});


test("Test layout with 4 atoms and two buffers, two atoms per buffer", () => {
  let gl = new GL(fakeCanvas);

  let inputs = {
        x: {name: 'x', size: 1, type: 'float'},
        y: {name: 'y', size: 1, type: 'float'},
        a: {name: 'a', size: 1, type: 'float'},
        b: {name: 'b', size: 1, type: 'float'}
    };

  gl.createDataSet({inputs: Object.values(inputs),
  layout: [GL.VertexBuffer([GL.repeat('x'), GL.repeat('a')]), 
           GL.VertexBuffer([GL.repeat('y'), GL.repeat('b')])]});

  expect(mockConstructor).toHaveBeenCalledTimes(2);
  expect(mockConstructor).toHaveBeenNthCalledWith(1, [GL.repeat('x'), GL.repeat('a')], inputs, gl, undefined);
  expect(mockConstructor).toHaveBeenNthCalledWith(2, [GL.repeat('y'), GL.repeat('b')], inputs, gl, undefined);
});

test("Test layout with 4 atoms and two buffers, two atoms per buffer with named buffers", () => {
  let gl = new GL(fakeCanvas);

  let inputs = {
    x: {name: 'x', size: 1, type: 'float'},
    y: {name: 'y', size: 1, type: 'float'},
    a: {name: 'a', size: 1, type: 'float'},
    b: {name: 'b', size: 1, type: 'float'}
  };

  gl.createDataSet({inputs: Object.values(inputs),
  layout: [GL.VertexBuffer([GL.repeat('x'), GL.repeat('a')], {name: "buffer1"}), GL.VertexBuffer([GL.repeat('y'), GL.repeat('b')], {name: "buffer2"})]});

  expect(mockConstructor).toHaveBeenCalledTimes(2);
  expect(mockConstructor).toHaveBeenNthCalledWith(1, [GL.repeat('x'), GL.repeat('a')] , inputs, gl, {name: "buffer1"});
  expect(mockConstructor).toHaveBeenNthCalledWith(2, [GL.repeat('y'), GL.repeat('b')], inputs,  gl, {name: "buffer2"});
});


test("Test layout with 4 atoms and two buffers, two atoms per buffer with named buffers and a manually set buffer size", () => {
  let gl = new GL(fakeCanvas);

  let inputs = {
    x: {name: 'x', size: 1, type: 'float'},
    y: {name: 'y', size: 1, type: 'float'},
    a: {name: 'a', size: 1, type: 'float'},
    b: {name: 'b', size: 1, type: 'float'}
  };

  gl.createDataSet({inputs: Object.values(inputs),
  layout: [GL.VertexBuffer([GL.repeat({size: 1000}, 'x'), GL.repeat({size: 1000},'a')]),
           GL.VertexBuffer([GL.repeat({size: 1234}, 'y'), GL.repeat({size: 1234},'b')])]});

  expect(mockConstructor).toHaveBeenCalledTimes(2);
  expect(mockConstructor).toHaveBeenNthCalledWith(1, [GL.repeat({size: 1000}, 'x'), GL.repeat({size: 1000},'a')], inputs,  gl, undefined);
  expect(mockConstructor).toHaveBeenNthCalledWith(2, [GL.repeat({size: 1234}, 'y'), GL.repeat({size: 1234},'b')], inputs, gl, undefined);
});

// now to check that we get proper error checking, first on the input side of things:

test("Test input syntax checking of gl.createDataSet", () =>{

  let gl = new GL(fakeCanvas);

  expect(() => gl.createDataSet({inputs: [
    {name: 'x', type: 'float'},
  ],
  layout: [GL.VertexBuffer([GL.repeat('x')])]}) ).toThrow("Required constructor arguments for DataSet were not provided");
  
  expect(() => gl.createDataSet({inputs: [
    {name: 'x',size: 9, type: 'float'},
  ],
  layout: [GL.VertexBuffer([GL.repeat('x')])]}) ).toThrow("size has to be 1,2,3, or 4");

  expect(() => gl.createDataSet({inputs: [
    {size: 2, type: 'float'},
  ],
  layout: [GL.VertexBuffer([GL.repeat('x')])]}) ).toThrow("Required constructor arguments for DataSet were not provided");

  expect(() => gl.createDataSet({inputs: [
    {name: {}, size: 2, type: 'float'},
  ],
  layout: [GL.VertexBuffer([GL.repeat('x')])]}) ).toThrow("name must be of type");

  expect(() => gl.createDataSet({inputs: [
    {name: 'x', size: 2},
  ],
  layout: [GL.VertexBuffer([GL.repeat('x')])]}) ).toThrow("Required constructor arguments for DataSet were not provided");

  expect(() => gl.createDataSet({inputs: [
    {name: 'x', size: 2, type: {}},
  ],
  layout: [GL.VertexBuffer([GL.repeat('x')])]}) ).toThrow("type descriptor must be string");

  expect(() => gl.createDataSet({inputs: [
    {name: 'x', size: 2, type: "zippityDooDah"},
  ],
  layout: [GL.VertexBuffer([GL.repeat('x')])]}) ).toThrow("is not supported by Pika. Supported types are:");

});



test("Test layout syntax checking of gl.createDataSet", () =>{

  let gl = new GL(fakeCanvas);

  expect(() => gl.createDataSet({inputs: [
    {name: 'x', size: 1, type: 'float'},
    {name: 'y', size: 1, type: 'float'}
  ],
  layout: [GL.VertexBuffer([GL.repeat('x')])]}) ).toThrow("Not all inputs were placed in layout");

  expect(() => gl.createDataSet({inputs: [
    {name: 'x', size: 2, type: "float"},
  ],
  layout: [[GL.repeat('x')]]}) ).toThrow("Data set store descriptor must be made up");
  

  expect(() => gl.createDataSet({inputs: [
    {name: 'x', size: 1, type: 'float'},
  ],
  layout: [GL.VertexBuffer([GL.repeat('x')]), GL.VertexBuffer([GL.repeat('x')])]}) ).toThrow("Layout descriptor must include an input only once!");

  expect(() => gl.createDataSet({inputs: [
    {name: 'x', size: 1, type: 'float'},
  ],
  layout: [GL.VertexBuffer([GL.repeat('x', 'x')])]}) ).toThrow("VertexBuffers can only use each input once in their layout descriptor");

  expect(() => gl.createDataSet({inputs: [
    {name: 'x', size: 1, type: 'float'},
  ],
  layout: [GL.VertexBuffer([GL.repeat('x')]), GL.VertexBuffer([GL.repeat('rando')])]}) ).toThrow("Unknown input used in layout descriptor");


});

// test(`Test that layout validates each sub buffer haas the same defined repeat size`, () => {

//     expect(() => {
//       let gl = new GL(fakeCanvas);

//       gl.createDataSet({inputs: [
//          {name: 'x', size: 1, type: 'float'},
//          {name: 'y', size: 1, type: 'float'},
//          {name: 'a', size: 1, type: 'float'},
//          {name: 'b', size: 1, type: 'float'}
//       ],
//       layout: [{name: "buffer1", desc: [GL.repeat({size: 1000}, 'x'), GL.repeat({size: 1234},'a')]},
//               {name: "buffer2",desc: [GL.repeat({size: 1234}, 'y'), GL.repeat({size: 1000},'b')]}]});
//       }).toThrow("Pika expects all sub buffer descriptors to have been given the same repeat size")
// });


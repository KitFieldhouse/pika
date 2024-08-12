import GL from '../src/webglHandler/webglHandler.js'
import VertexBuffer from '../src/buffer/vertexBuffer.js';
import fakeCanvas from './fakeCanvas.js';

const defaultRepeatOpts = {size: 100};

// these tests are designed to make sure the the GL.createDataSet() function is 
// catching mismatched and incorrect inputs, layout descriptors and is passing the 
// correct information down to the vertexBuffer objects that it creates.

var mockConstructor;
var mockConstructBufferFromAtoms;

jest.mock('../src/buffer/vertexBuffer.js', () => {

  mockConstructor =  jest.fn().mockImplementation(() => {
    return {};
  });

  mockConstructBufferFromAtoms =  jest.fn().mockImplementation((atoms, gl) => [atoms, gl]);

  mockConstructor.constructBufferFromAtoms = mockConstructBufferFromAtoms;

  return mockConstructor
});

let fakeGL = fakeCanvas.getContext();

beforeEach(() => {
  // Clear all instances and calls to constructor and all methods:
  mockConstructor.mockClear();
  mockConstructBufferFromAtoms.mockClear();
});


test("Test layout with a single atom and a single buffer", () => {
    let gl = new GL(fakeCanvas);

    gl.createDataSet({inputs: [
        {name: 'y', size: 1, type: 'float', normalized: false},
        {name: 'timestamps', integer: true, size: 2, type: 'unsignedInt'}
    ],
    layout: [[GL.repeat('y', 'timestamps')]]});

    expect(mockConstructBufferFromAtoms).toHaveBeenCalledTimes(1);
    expect(mockConstructBufferFromAtoms).toHaveBeenLastCalledWith([{repeatType: 'start', opts: defaultRepeatOpts, 
        arguments: [{size: 1, type: 'float'},{size: 2, type: 'unsignedInt'} ]}], gl, null);
});


test("Test layout with two atoms and a single buffer", () => {
  let gl = new GL(fakeCanvas);

  gl.createDataSet({inputs: [
      {name: 'y', size: 1, type: 'float', normalized: false},
      {name: 'timestamps', integer: true, size: 2, type: 'unsignedInt'}
  ],
  layout: [[GL.repeat('y'), GL.endRepeat('timestamps')]]});

  expect(mockConstructBufferFromAtoms).toHaveBeenCalledTimes(1);
  expect(mockConstructBufferFromAtoms).toHaveBeenLastCalledWith([
      {repeatType: 'start', opts: defaultRepeatOpts, arguments: [{size: 1, type: 'float'}]}, 
      {repeatType: 'end', opts: defaultRepeatOpts, arguments: [{size: 2, type: 'unsignedInt'}]}], gl, null);
});


test("Test layout with two atoms and two buffers", () => {
  let gl = new GL(fakeCanvas);

  gl.createDataSet({inputs: [
      {name: 'y', size: 1, type: 'float'},
      {name: 'timestamps', size: 2, type: 'unsignedInt'}
  ],
  layout: [[GL.repeat('y')],[GL.repeat('timestamps')]]});

  expect(mockConstructBufferFromAtoms).toHaveBeenCalledTimes(2);
  expect(mockConstructBufferFromAtoms).toHaveBeenNthCalledWith(1, [
      {repeatType: 'start', opts: defaultRepeatOpts, arguments: [{size: 1, type: 'float'}]},], gl, null);
  expect(mockConstructBufferFromAtoms).toHaveBeenNthCalledWith(2, [ 
      {repeatType: 'start', opts: defaultRepeatOpts, arguments: [{size: 2, type: 'unsignedInt'}]}], gl, null);
});


test("Test layout with 4 atoms and two buffers, two atoms per buffer", () => {
  let gl = new GL(fakeCanvas);

  gl.createDataSet({inputs: [
      {name: 'x', size: 1, type: 'float'},
      {name: 'y', size: 1, type: 'float'},
      {name: 'a', size: 1, type: 'float'},
      {name: 'b', size: 1, type: 'float'}
  ],
  layout: [[GL.repeat('x'), GL.repeat('a')],[GL.repeat('y'), GL.repeat('b')]]});

  expect(mockConstructBufferFromAtoms).toHaveBeenCalledTimes(2);
  expect(mockConstructBufferFromAtoms).toHaveBeenNthCalledWith(1, [
      {repeatType: 'start', opts: defaultRepeatOpts, arguments: [{size: 1, type: 'float'}]},
      {repeatType: 'start', opts: defaultRepeatOpts, arguments: [{size: 1, type: 'float'}]}], gl, null);
  expect(mockConstructBufferFromAtoms).toHaveBeenNthCalledWith(2, [
    {repeatType: 'start', opts: defaultRepeatOpts, arguments: [{size: 1, type: 'float'}]},
    {repeatType: 'start', opts: defaultRepeatOpts, arguments: [{size: 1, type: 'float'}]}], gl, null);
});

test("Test layout with 4 atoms and two buffers, two atoms per buffer with named buffers", () => {
  let gl = new GL(fakeCanvas);

  gl.createDataSet({inputs: [
      {name: 'x', size: 1, type: 'float'},
      {name: 'y', size: 1, type: 'float'},
      {name: 'a', size: 1, type: 'float'},
      {name: 'b', size: 1, type: 'float'}
  ],
  layout: [{name: "buffer1", desc: [GL.repeat('x'), GL.repeat('a')]},{name: "buffer2",desc: [GL.repeat('y'), GL.repeat('b')]}]});

  expect(mockConstructBufferFromAtoms).toHaveBeenCalledTimes(2);
  expect(mockConstructBufferFromAtoms).toHaveBeenNthCalledWith(1, [
      {repeatType: 'start', opts: defaultRepeatOpts, arguments: [{size: 1, type: 'float'}]},
      {repeatType: 'start', opts: defaultRepeatOpts, arguments: [{size: 1, type: 'float'}]}], gl, null);
  expect(mockConstructBufferFromAtoms).toHaveBeenNthCalledWith(2, [
    {repeatType: 'start', opts: defaultRepeatOpts, arguments: [{size: 1, type: 'float'}]},
    {repeatType: 'start', opts: defaultRepeatOpts, arguments: [{size: 1, type: 'float'}]}], gl, null);
});


test("Test layout with 4 atoms and two buffers, two atoms per buffer with named buffers and a manually set buffer size", () => {
  let gl = new GL(fakeCanvas);

  gl.createDataSet({inputs: [
      {name: 'x', size: 1, type: 'float'},
      {name: 'y', size: 1, type: 'float'},
      {name: 'a', size: 1, type: 'float'},
      {name: 'b', size: 1, type: 'float'}
  ],
  layout: [{name: "buffer1", desc: [GL.repeat({size: 1000}, 'x'), GL.repeat({size: 1000},'a')]},
           {name: "buffer2",desc: [GL.repeat({size: 1234}, 'y'), GL.repeat({size: 1234},'b')]}]});

  expect(mockConstructBufferFromAtoms).toHaveBeenCalledTimes(2);
  expect(mockConstructBufferFromAtoms).toHaveBeenNthCalledWith(1, [
      {repeatType: 'start', opts: {size: 1000}, arguments: [{size: 1, type: 'float'}]},
      {repeatType: 'start', opts: {size: 1000}, arguments: [{size: 1, type: 'float'}]}], gl, null);
  expect(mockConstructBufferFromAtoms).toHaveBeenNthCalledWith(2, [
    {repeatType: 'start', opts: {size: 1234}, arguments: [{size: 1, type: 'float'}]},
    {repeatType: 'start', opts: {size: 1234}, arguments: [{size: 1, type: 'float'}]}], gl, null);
});

// now to check that we get proper error checking, first on the input side of things:

test("Test input syntax checking of gl.createDataSet", () =>{

  let gl = new GL(fakeCanvas);

  expect(() => gl.createDataSet({inputs: [
    {name: 'x', type: 'float'},
  ],
  layout: [[GL.repeat('x')]]}) ).toThrow("Required constructor arguments for DataSet were not provided");
  
  expect(() => gl.createDataSet({inputs: [
    {name: 'x',size: 9, type: 'float'},
  ],
  layout: [[GL.repeat('x')]]}) ).toThrow("size has to be 1,2,3, or 4");

  expect(() => gl.createDataSet({inputs: [
    {size: 2, type: 'float'},
  ],
  layout: [[GL.repeat('x')]]}) ).toThrow("Required constructor arguments for DataSet were not provided");

  expect(() => gl.createDataSet({inputs: [
    {name: {}, size: 2, type: 'float'},
  ],
  layout: [[GL.repeat('x')]]}) ).toThrow("name must be of type");

  expect(() => gl.createDataSet({inputs: [
    {name: 'x', size: 2},
  ],
  layout: [[GL.repeat('x')]]}) ).toThrow("Required constructor arguments for DataSet were not provided");

  expect(() => gl.createDataSet({inputs: [
    {name: 'x', size: 2, type: {}},
  ],
  layout: [[GL.repeat('x')]]}) ).toThrow("type descriptor must be string");

  expect(() => gl.createDataSet({inputs: [
    {name: 'x', size: 2, type: "zippityDooDah"},
  ],
  layout: [[GL.repeat('x')]]}) ).toThrow("is not supported by Pika. Supported types are:");

});



test("Test layout syntax checking of gl.createDataSet", () =>{

  let gl = new GL(fakeCanvas);

  expect(() => gl.createDataSet({inputs: [
    {name: 'x', size: 1, type: 'float'},
  ],
  layout: [[]]}) ).toThrow("Not all inputs were placed in layout");

  expect(() => gl.createDataSet({inputs: [
    {name: 'x', size: 1, type: 'float'},
  ],
  layout: [['x']]}) ).toThrow("Buffer descriptors must be filled with objects generated by GL.repeat, GL.endRepeat or GL.centerRepeat");
  

  expect(() => gl.createDataSet({inputs: [
    {name: 'x', size: 1, type: 'float'},
  ],
  layout: [[GL.repeat('x')], [GL.repeat('x')]]}) ).toThrow("Layout descriptor must include an input only once!");

  expect(() => gl.createDataSet({inputs: [
    {name: 'x', size: 1, type: 'float'},
  ],
  layout: [[GL.repeat('x', 'x')]]}) ).toThrow("Layout descriptor must include an input only once!");

  expect(() => gl.createDataSet({inputs: [
    {name: 'x', size: 1, type: 'float'},
  ],
  layout: [[GL.repeat('x')], [GL.repeat('rando')]]}) ).toThrow("Unknown input used in layout descriptor");


});

test(`Test that layout validates each sub buffer haas the same defined repeat size`, () => {

    expect(() => {
      let gl = new GL(fakeCanvas);

      gl.createDataSet({inputs: [
         {name: 'x', size: 1, type: 'float'},
         {name: 'y', size: 1, type: 'float'},
         {name: 'a', size: 1, type: 'float'},
         {name: 'b', size: 1, type: 'float'}
      ],
      layout: [{name: "buffer1", desc: [GL.repeat({size: 1000}, 'x'), GL.repeat({size: 1234},'a')]},
              {name: "buffer2",desc: [GL.repeat({size: 1234}, 'y'), GL.repeat({size: 1000},'b')]}]});
      }).toThrow("Pika expects all sub buffer descriptors to have been given the same repeat size")
});


import GL from '../src/webglHandler/webglHandler.js'
import VertexBuffer from '../src/buffer/vertexBuffer.js';
import fakeCanvas from './fakeCanvas.js';

// lets check that we get proper error/syntax handling of the createDataSet function

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

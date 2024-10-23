import GL from '../src/webglHandler/webglHandler.js'
import VertexBuffer from '../src/buffer/vertexBuffer.js';
import fakeCanvas from './fakeCanvas.js';
import Layout from '../src/data/layout.js';

// mock the constructor of VertexBuffer so that we don't actually end up creating any VertexBuffers....

var mockConstructor;
var mockDoAdd = jest.fn(() => null);
var mockSizeAppend = jest.fn(x => {
  return {pointsAdded: 0, doAdd: mockDoAdd}
})

jest.mock('../src/buffer/vertexBuffer.js', () => {

  mockConstructor =  jest.fn().mockImplementation(() => {
    return {sizeAppend: mockSizeAppend};
  });


  return mockConstructor
});


beforeEach(() => {
  // Clear all instances and calls to constructor and all methods:
  mockConstructor.mockClear();
  mockDoAdd.mockClear();
  mockSizeAppend.mockClear();
});


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



test("Test dataSet descriptor syntax checking of gl.createDataSet", () =>{

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

test("Test that initialData is checked to make sure it provides both initial data and a layout", () =>{
  let gl = new GL(fakeCanvas);

  expect(() => gl.createDataSet({inputs: [
      {name: 'x', size: 1, type: 'float'},
      {name: 'y', size: 1, type: 'float'}
    ],
    layout: [GL.VertexBuffer([GL.repeat('x','y')])],
    initialData: {data: [1,2,3,4,5]}
  }) 
  ).toThrow("FAIL: initialData must be an object with 'data' and 'layout' properties.");

});


test("Test that initialData is checked to make sure it provides both initial data and a layout", () =>{
  let gl = new GL(fakeCanvas);

  expect(() => gl.createDataSet({inputs: [
      {name: 'x', size: 1, type: 'float'},
      {name: 'y', size: 1, type: 'float'}
    ],
    layout: [GL.VertexBuffer([GL.repeat('x','y')])],
    initialData: {layout: [GL.repeat("x")]}
  }) 
  ).toThrow("FAIL: initialData must be an object with 'data' and 'layout' properties.");

});


test("Test that provided initialData inputs are checked that they are inputs of the dataSet", () =>{
  let gl = new GL(fakeCanvas);

  expect(() => gl.createDataSet({inputs: [
      {name: 'x', size: 1, type: 'float'},
      {name: 'y', size: 1, type: 'float'}
    ],
    layout: [GL.VertexBuffer([GL.repeat('x','y')])],
    initialData: {data: [1,2,3,4,5], layout: [GL.repeat("f")]}
  }) 
  ).toThrow("was not found for this layout");

});

test("Test that predefined layout is checked to see if its inputs are in dataSet", () =>{
  let gl = new GL(fakeCanvas);

  let layoutInputs =  {x: {name: 'x', size: 1, type: 'float'},
                      y: {name: 'y', size: 1, type: 'float'},
                      f: {name: 'f', size: 2, type: 'float'}}

  let predefinedLayout = new Layout([GL.repeat("f")],layoutInputs);

  expect(() => gl.createDataSet({inputs: [
      {name: 'x', size: 1, type: 'float'},
      {name: 'y', size: 1, type: 'float'}
    ],
    layout: [GL.VertexBuffer([GL.repeat('x','y')])],
    initialData: {data: [1,2,3,4,5], layout: predefinedLayout}
  }) 
  ).toThrow("FAIL: layout object does not have the same input definitions as this dataset");

});

test("Test that predefined layout is checked to see if its inputs definitions are the same", () =>{
  let gl = new GL(fakeCanvas);

  let layoutInputs =  {x: {name: 'x', size: 1, type: 'float'},
                      y: {name: 'y', size: 2, type: 'float'}}

  let predefinedLayout = new Layout([GL.repeat("x")],layoutInputs);

  expect(() => gl.createDataSet({inputs: [
      {name: 'x', size: 1, type: 'float'},
      {name: 'y', size: 1, type: 'float'}
    ],
    layout: [GL.VertexBuffer([GL.repeat('x','y')])],
    initialData: {data: [1,2,3,4,5], layout: predefinedLayout}
  }) 
  ).toThrow("FAIL: layout object does not have the same input definitions as this dataset");

});





test("Test that layouts are constructed and cached for dataSets", () =>{
  let gl = new GL(fakeCanvas);

  let inputsAsObject = {
     x: {name: 'x', size: 1, type: 'float'},
     y: {name: 'y', size: 1, type: 'float'}
  }

  let dataset = gl.createDataSet({inputs: [
      {name: 'x', size: 1, type: 'float'},
      {name: 'y', size: 1, type: 'float'}
    ],
    layout: [GL.VertexBuffer([GL.repeat('x','y')])],
    initialData: {data: [1,2,3,4,5,6], layout: [GL.repeat("x", "y")]}
  }) 


  expect(Object.keys(dataset.cachedLayouts).length).toBe(1);
  expect(!!dataset.cachedLayouts[JSON.stringify([GL.repeat("x", "y")])]).toBe(true);

  let layoutToTestAgainst = new Layout([GL.repeat('x', 'y')], inputsAsObject);
  let cachedLayout = dataset.cachedLayouts[JSON.stringify([GL.repeat("x", "y")])];

  expect(layoutToTestAgainst.isSameLayout(cachedLayout)).toBe(true);


  dataset.appendData([1,2,3,4,5,6], [GL.repeat("x", "y")])

  expect(Object.keys(dataset.cachedLayouts).length).toBe(1);
  expect(mockSizeAppend.mock.calls).toHaveLength(1);
  expect(mockDoAdd.mock.calls).toHaveLength(1);

  expect(layoutToTestAgainst.isSameLayout(mockSizeAppend.mock.lastCall[1])).toBe(true);


  dataset.appendData([1,2,3,4,5,6], [GL.repeat("x")]);
  let newLayoutToTestAgainst = new Layout([GL.repeat('x')], inputsAsObject);

  expect(Object.keys(dataset.cachedLayouts).length).toBe(2);
  expect(mockSizeAppend.mock.calls).toHaveLength(2);
  expect(mockDoAdd.mock.calls).toHaveLength(2);
  
  expect(layoutToTestAgainst.isSameLayout(mockSizeAppend.mock.lastCall[1])).toBe(false);
  expect(newLayoutToTestAgainst.isSameLayout(mockSizeAppend.mock.lastCall[1])).toBe(true);
});
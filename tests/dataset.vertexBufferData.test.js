import GL from '../src/webglHandler/webglHandler.js'
import VertexBuffer from '../src/buffer/vertexBuffer.js';
import fakeCanvas from './fakeCanvas.js';



// These tests make sure that the correct data manipulation logic is being done by the 
// vertexBuffer class.....



test("Test that a vertex buffer dataStore can be initialized", () => {
  const gl = new GL(fakeCanvas);

  let inputs = {
    y: {name: 'y', size: 1, type: 'float'},
    x: {name: 'x', size: 1, type: 'float'}
  };

  let dataset = gl.createDataSet({
    inputs: Object.values(inputs),
    layout: [GL.VertexBuffer( [GL.repeat('x', 'y')] )]
  });

  expect(gl.gl.tests_buffers.length).toBe(1);
  expect(gl.gl.tests_buffers[0].byteLength).toBe(800);

});



test("Test datastore append on a vertex buffer dataStore, throws error if not equal number of data points", () => {
  const gl = new GL(fakeCanvas);

  let inputs = {
    y: {name: 'y', size: 1, type: 'float'},
    x: {name: 'x', size: 1, type: 'float'}
  };

  let dataset = gl.createDataSet({
    inputs: Object.values(inputs),
    layout: [GL.VertexBuffer( [GL.repeat('x', 'y')] )]
  });

  let data = [[1,2], [3,4,5]]

  expect(() => dataset.appendData(data, [[GL.repeat('x')], [GL.repeat('y')]])).toThrow("VertexBuffer requires each of its inputs to have the same number of points");

});


test("Test datastore append on a vertex buffer dataStore, same layout", () => {
  const gl = new GL(fakeCanvas);

  let inputs = {
    y: {name: 'y', size: 1, type: 'float'},
    x: {name: 'x', size: 1, type: 'float'}
  };

  let dataset = gl.createDataSet({
    inputs: Object.values(inputs),
    layout: [GL.VertexBuffer( [GL.repeat('x', 'y')] )]
  });

  let data = [1,2,3,4]

  dataset.appendData(data, [GL.repeat('x', 'y')]);

  expect(gl.gl.tests_buffers.length).toBe(1);
  expect(gl.gl.tests_buffers[0].byteLength).toBe(800);


  let reconstructedData = [];
  let view = new DataView(gl.gl.tests_buffers[0])

  for(let i = 0; i < 16; i = i + 4){
    reconstructedData.push(view.getFloat32(i, true))
  }

  expect(reconstructedData).toEqual([1,2,3,4]);

});



test("Test datastore append on a vertex buffer dataStore, different layout", () => {
  const gl = new GL(fakeCanvas);

  let inputs = {
    y: {name: 'y', size: 1, type: 'float'},
    x: {name: 'x', size: 1, type: 'float'}
  };

  let dataset = gl.createDataSet({
    inputs: Object.values(inputs),
    layout: [GL.VertexBuffer( [GL.repeat('x', 'y')] )]
  });

  let data = [1,2,3,4]

  dataset.appendData(data, [GL.repeat('y', 'x')]);

  expect(gl.gl.tests_buffers.length).toBe(1);
  expect(gl.gl.tests_buffers[0].byteLength).toBe(800);


  let reconstructedData = [];
  let view = new DataView(gl.gl.tests_buffers[0])

  for(let i = 0; i < 16; i = i + 4){
    reconstructedData.push(view.getFloat32(i, true))
  }

  expect(reconstructedData).toEqual([2,1,4,3]);

});


test("Test datastore append on a vertex buffer dataStore, same layout, direct copy", () => {
  const gl = new GL(fakeCanvas);

  let inputs = {
    y: {name: 'y', size: 1, type: 'float'},
    x: {name: 'x', size: 1, type: 'float'}
  };

  let dataset = gl.createDataSet({
    inputs: Object.values(inputs),
    layout: [GL.VertexBuffer( [GL.repeat('x', 'y')] )]
  });

  let data = new Float32Array([1,2,3,4]);

  console.log(data.buffer instanceof ArrayBuffer);

  let effects = dataset.appendData(data.buffer, [GL.repeat('x', 'y')]);

  expect(effects.numberOfDirectCopies).toEqual([1])

  expect(gl.gl.tests_buffers.length).toBe(1);
  expect(gl.gl.tests_buffers[0].byteLength).toBe(800);


  let reconstructedData = [];
  let view = new DataView(gl.gl.tests_buffers[0])

  for(let i = 0; i < 16; i = i + 4){
    reconstructedData.push(view.getFloat32(i, true))
  }

  console.log(reconstructedData);

  expect(reconstructedData).toEqual([1,2,3,4]);

});





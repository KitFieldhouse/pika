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


test("Test that a vertex buffer dataStore can be initialized with initial data", () => {
  const gl = new GL(fakeCanvas);

  let inputs = {
    y: {name: 'y', size: 1, type: 'float'},
    x: {name: 'x', size: 1, type: 'float'}
  };

  let dataset = gl.createDataSet({
    inputs: Object.values(inputs),
    layout: [GL.VertexBuffer( [GL.repeat('x', 'y')] )],
    initialData: {
      data: [1,2,3,4,5,6],
      layout: [GL.repeat('x', 'y')]
    }
  });

  expect(gl.gl.tests_buffers.length).toBe(1);
  expect(gl.gl.tests_buffers[0].byteLength).toBe(800);

  expect(Array.from(new Float32Array(gl.gl.tests_buffers[0].slice(0, 24)))).toEqual([1,2,3,4,5,6]);

});



test("Test datastore append on a vertex buffer dataStore, throws error if not equal number of data points in the same layout atom", () => {
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

  expect(() => dataset.appendData(data, [[GL.repeat('x')], [GL.repeat('y')]])).toThrow("FAIL: VertexBuffer requires inputs grouped in the same repeat statement to have the same number of points");

});


test("Test datastore append on a vertex buffer dataStore, can append different amount of data points for inputs not in the same layout atom", () => {
  const gl = new GL(fakeCanvas);

  let inputs = {
    y: {name: 'y', size: 1, type: 'float'},
    x: {name: 'x', size: 1, type: 'float'}
  };

  let dataset = gl.createDataSet({
    inputs: Object.values(inputs),
    layout: [GL.VertexBuffer( [GL.repeat('x'), GL.repeat('y')] )]
  });

  let data = [[1,2], [3,4,5]]

  expect(dataset.appendData(data, [[GL.repeat('x')], [GL.repeat('y')]])).toEqual({"numberOfDirectCopies": [0], "pointsAdded": [[2, 3]]});

});

test("Test that dataStore will throw an error when you are attempting to add data to an input but not to its layout atom-mate", () => {
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

  expect(() => dataset.appendData(data, [GL.repeat('x')])).toThrow("VertexBuffer requires inputs grouped in the same repeat statement to have the same number of points");

});


test("Test that dataStore will throw if all inputs in an atom are not given explicit append/prepend instructions of one of the inputs is", () => {
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

  expect(() => dataset.addData(data, [GL.repeat('x','y')], {"x": 'append'})).toThrow("If an input is given an explicit add method, each input that it is in a layout atom with said input also needs to have an explicit add method");

});



test("Test that dataStore will throw when inputs from the same layout atom are given conflicting explicit prepend/append instructions", () => {
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

  expect(() => dataset.addData(data, [GL.repeat('x','y')], {x: 'append', y: 'prepend'})).toThrow("each input that is in a layout atom with said input also needs to have an explicit add method of the same type");

});



test("Test that dataStore will throw when given prepend.append instruction that isn't 'append' or 'prepend'", () => {
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

  expect(() => dataset.addData(data, [GL.repeat('x','y')], {x: 'appendo', y: 'appendo'})).toThrow("Unknown add method given:");

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


test("Test datastore append on a nulti-vertex buffer data store, only one vertex buffer effected", () => {
  const gl = new GL(fakeCanvas);


  let inputs = {
    y: {name: 'y', size: 1, type: 'float'},
    x: {name: 'x', size: 1, type: 'float'}
  };

  let dataset = gl.createDataSet({
    inputs: Object.values(inputs),
    layout: [GL.VertexBuffer([GL.repeat('x')]), GL.VertexBuffer([GL.repeat('y')])]
  });

  let data = [1,2,3,4]

  dataset.appendData(data, [GL.repeat('x')]);

  expect(gl.gl.tests_buffers.length).toBe(2);
  expect(gl.gl.tests_buffers[0].byteLength).toBe(400);


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


  let effects = dataset.appendData(data.buffer, [GL.repeat('x', 'y')]);

  expect(effects.numberOfDirectCopies).toEqual([1])

  expect(gl.gl.tests_buffers.length).toBe(1);
  expect(gl.gl.tests_buffers[0].byteLength).toBe(800);


  let reconstructedData = [];
  let view = new DataView(gl.gl.tests_buffers[0])

  for(let i = 0; i < 16; i = i + 4){
    reconstructedData.push(view.getFloat32(i, true))
  }

  expect(reconstructedData).toEqual([1,2,3,4]);

});


test("Test datastore append on several vertex buffer dataStores, complex layout, no direct copy, mixed data types", () => {
  const gl = new GL(fakeCanvas);

  let inputs = {
    y: {name: 'y', size: 1, type: 'float'},
    x: {name: 'x', size: 1, type: 'float'},
    w: {name: 'w', size: 1, type: 'float'},
    z: {name: 'z', size: 1, type: 'float'}
  };

  let dataset = gl.createDataSet({
    inputs: Object.values(inputs),
    layout: [GL.VertexBuffer( [GL.repeat('x', 'y')]), GL.VertexBuffer( [GL.repeat('w')]), GL.VertexBuffer( [GL.repeat('z')])]
  });

  let dataXY = new Float32Array([1,2,3,4]);

  let data = [[dataXY.buffer], [5,6,7,8], [[-1,-2,-3,-4], -5, -6], -7, -8]
  let dataDescriptor = [[GL.repeat('x','y')], [GL.repeat('y', 'x')], [[GL.repeat('w', 'z')], GL.repeat("w")], GL.repeat('z')];

  let effects = dataset.appendData(data, dataDescriptor); 

  expect(effects.numberOfDirectCopies).toEqual([0,0,0])

  expect(gl.gl.tests_buffers.length).toBe(3);
  expect(gl.gl.tests_buffers[0].byteLength).toBe(800);
  expect(gl.gl.tests_buffers[1].byteLength).toBe(400);
  expect(gl.gl.tests_buffers[2].byteLength).toBe(400);

  expect(Array.from(new Float32Array(gl.gl.tests_buffers[0].slice(0, 8*4)))).toEqual([1,2,3,4,6,5,8,7]);
  expect(Array.from(new Float32Array(gl.gl.tests_buffers[1].slice(0, 4*4)))).toEqual([-1, -3, -5, -6]);
  expect(Array.from(new Float32Array(gl.gl.tests_buffers[2].slice(0, 4*4)))).toEqual([-2, -4, -7, -8]);

  // expect();

});



test("Test datastore append on a vertex buffer dataStore, same layout, direct copy, complex data layout", () => {
  const gl = new GL(fakeCanvas);

  let inputs = {
    y: {name: 'y', size: 1, type: 'float'},
    x: {name: 'x', size: 1, type: 'float'},
    w: {name: 'w', size: 1, type: 'float'},
    z: {name: 'z', size: 1, type: 'float'}
  };

  let dataset = gl.createDataSet({
    inputs: Object.values(inputs),
    layout: [GL.VertexBuffer( [GL.repeat('x', 'y')] ), GL.VertexBuffer( [GL.repeat('w', 'z')])]
  });

  let xyData = new Float32Array([1,2,3,4]);

  let wzData = new Float32Array([5,6,7,8]);

  let data = [ [[[xyData.buffer]]] , [[[[wzData.buffer]]]] ]

  let effects = dataset.appendData(data, [[ [ [GL.repeat('x', 'y')] ]], [[[[GL.repeat('w', 'z')]]]]]);

  expect(effects.numberOfDirectCopies).toEqual([1,1])

  expect(gl.gl.tests_buffers.length).toBe(2);
  expect(gl.gl.tests_buffers[0].byteLength).toBe(800);
  expect(gl.gl.tests_buffers[1].byteLength).toBe(800);


  let reconstructedDataXY = [];
  let view = new DataView(gl.gl.tests_buffers[0])

  for(let i = 0; i < 16; i = i + 4){
    reconstructedDataXY.push(view.getFloat32(i, true))
  }

  let reconstructedDataWZ = [];
  view = new DataView(gl.gl.tests_buffers[1])

  for(let i = 0; i < 16; i = i + 4){
    reconstructedDataWZ.push(view.getFloat32(i, true))
  }


  expect(reconstructedDataXY).toEqual([1,2,3,4]);

  expect(reconstructedDataWZ).toEqual([5,6,7,8]);

});


test("Test datastore append on several vertex buffer dataStores, complex layout, no direct copy, mixed data types with vectors", () => {
  const gl = new GL(fakeCanvas);

  let inputs = {
    y: {name: 'y', size: 2, type: 'float'},  // vector type
    x: {name: 'x', size: 1, type: 'float'},
    w: {name: 'w', size: 3, type: 'float'},  // vector type
    z: {name: 'z', size: 1, type: 'float'}
  };

  let dataset = gl.createDataSet({
    inputs: Object.values(inputs),
    layout: [GL.VertexBuffer( [GL.repeat('x', 'y')]), GL.VertexBuffer( [GL.repeat('w')]), GL.VertexBuffer( [GL.repeat('z')])]
  });

  let dataXY = ([1,[2, 2],3, [4, 4]]);
  let dataW = [[1,2,3], [4,5,6]];
  let dataZ = [9,8];

  let data = [dataXY, dataW, dataZ]
  let dataDescriptor = [[GL.repeat('x','y')], [GL.repeat("w")], [GL.repeat('z')]];

  let effects = dataset.appendData(data, dataDescriptor); 

  expect(effects.numberOfDirectCopies).toEqual([0,0,0])

  expect(gl.gl.tests_buffers.length).toBe(3);
  expect(gl.gl.tests_buffers[0].byteLength).toBe(1200);
  expect(gl.gl.tests_buffers[1].byteLength).toBe(1200);
  expect(gl.gl.tests_buffers[2].byteLength).toBe(400);

  expect(Array.from(new Float32Array(gl.gl.tests_buffers[0].slice(0, 12*2)))).toEqual([1,2,2,3,4,4]);
  expect(Array.from(new Float32Array(gl.gl.tests_buffers[1].slice(0, 12*2)))).toEqual([1,2,3,4,5,6]);
  expect(Array.from(new Float32Array(gl.gl.tests_buffers[2].slice(0, 4*2)))).toEqual([9,8]);

});


test("Test datastore append on a vertex buffer dataStore, same layout, append until resize", () => {
  const gl = new GL(fakeCanvas);

  let inputs = {
    y: {name: 'y', size: 1, type: 'float'},
    x: {name: 'x', size: 1, type: 'float'}
  };

  let dataset = gl.createDataSet({
    inputs: Object.values(inputs),
    layout: [GL.VertexBuffer( [GL.repeat('x', 'y')] )]
  });

  let data = [];

  for(let i = 0; i < 105; i++){
    data.push(i, -i);
  }


  expect(gl.gl.tests_buffers.length).toBe(1);
  expect(gl.gl.tests_buffers[0].byteLength).toBe(800);

  dataset.appendData(data, [GL.repeat('x', 'y')]);

  expect(gl.gl.tests_getNonNullBuffers().length).toBe(1);
  expect(gl.gl.tests_getNonNullBuffers()[0].byteLength).toBe(1600);


  let reconstructedData = [];
  let view = new DataView(gl.gl.tests_getNonNullBuffers()[0])

  for(let i = 0; i < 8*105; i = i + 4){
    reconstructedData.push(view.getFloat32(i, true))
  }

  expect(reconstructedData).toEqual(data);

});



test("Test datastore append on a vertex buffer dataStore end repeat layout, data has same layout", () => {
  const gl = new GL(fakeCanvas);

  let inputs = {
    y: {name: 'y', size: 1, type: 'float'},
    x: {name: 'x', size: 1, type: 'float'}
  };

  let dataset = gl.createDataSet({
    inputs: Object.values(inputs),
    layout: [GL.VertexBuffer( [GL.endRepeat('x', 'y')] )]
  });

  let data = [1,2,3,4];

  dataset.appendData(data, [GL.repeat('x', 'y')]);

  expect(gl.gl.tests_getNonNullBuffers().length).toBe(1);
  expect(gl.gl.tests_getNonNullBuffers()[0].byteLength).toBe(1600);


  let reconstructedData = [];
  let view = new DataView(gl.gl.tests_getNonNullBuffers()[0])

  for(let i = 800; i < (800 + 8*2) ; i = i + 4){
    reconstructedData.push(view.getFloat32(i, true))
  }

  expect(reconstructedData).toEqual([1,2,3,4]);

});



test("Test datastore append on a vertex buffer dataStore with start and end repeat layout", () => {
  const gl = new GL(fakeCanvas);

  let inputs = {
    y: {name: 'y', size: 1, type: 'float'},
    x: {name: 'x', size: 1, type: 'float'}
  };

  let dataset = gl.createDataSet({
    inputs: Object.values(inputs),
    layout: [GL.VertexBuffer( [GL.repeat('x') , GL.endRepeat('y')] )]
  });

  let data = [[1,2], [3,4]];

  dataset.appendData(data, [[GL.repeat('x')], [GL.repeat('y')]]);

  expect(gl.gl.tests_getNonNullBuffers().length).toBe(1);
  expect(gl.gl.tests_getNonNullBuffers()[0].byteLength).toBe(1200);


  let reconstructedDataY = [];
  let reconstructedDataX = [];
  let view = new DataView(gl.gl.tests_getNonNullBuffers()[0])

  for(let i = 800; i < (800 + 8) ; i = i + 4){
    reconstructedDataY.push(view.getFloat32(i, true))
  }

  for(let i = 0; i < 8 ; i = i + 4){
    reconstructedDataX.push(view.getFloat32(i, true))
  }


  expect(reconstructedDataX).toEqual([1,2]);
  expect(reconstructedDataY).toEqual([3,4]);

});



test("Test datastore append on a vertex buffer dataStore with center repeat layout", () => {
  const gl = new GL(fakeCanvas);

  let inputs = {
    y: {name: 'y', size: 1, type: 'float'},
    x: {name: 'x', size: 1, type: 'float'}
  };

  let dataset = gl.createDataSet({
    inputs: Object.values(inputs),
    layout: [GL.VertexBuffer( [GL.centerRepeat('x','y')] )]
  });

  let data = [1,2,3,4];

  dataset.appendData(data, [GL.repeat('x','y')]);

  expect(gl.gl.tests_getNonNullBuffers().length).toBe(1);
  expect(gl.gl.tests_getNonNullBuffers()[0].byteLength).toBe(800);


  let reconstructedData = []
  let view = new DataView(gl.gl.tests_getNonNullBuffers()[0])

  for(let i = 400; i < (400 + 8*2) ; i = i + 4){
    reconstructedData.push(view.getFloat32(i, true))
  }


  expect(reconstructedData).toEqual([1,2,3,4]);

});


test("Test datastore prepend on a vertex buffer dataStore with end repeat layout", () => {
  const gl = new GL(fakeCanvas);

  let inputs = {
    y: {name: 'y', size: 1, type: 'float'},
    x: {name: 'x', size: 1, type: 'float'}
  };

  let dataset = gl.createDataSet({
    inputs: Object.values(inputs),
    layout: [GL.VertexBuffer( [GL.endRepeat('x','y')] )]
  });

  let data = [1,2,3,4];

  dataset.prependData(data, [GL.repeat('x','y')]);

  expect(gl.gl.tests_getNonNullBuffers().length).toBe(1);
  expect(gl.gl.tests_getNonNullBuffers()[0].byteLength).toBe(800);


  let reconstructedData = []
  let view = new DataView(gl.gl.tests_getNonNullBuffers()[0])

  for(let i = 800 -16 ; i < 800 ; i = i + 4){
    reconstructedData.push(view.getFloat32(i, true))
  }


  expect(reconstructedData).toEqual([1,2,3,4]);

});


test("Test datastore prepend on a vertex buffer dataStore with end repeat layout will resize if encroaching on other layout atoms, large amount of data", () => {
  const gl = new GL(fakeCanvas);

  let inputs = {
    y: {name: 'y', size: 1, type: 'float'},
    x: {name: 'x', size: 1, type: 'float'}
  };

  let dataset = gl.createDataSet({
    inputs: Object.values(inputs),
    layout: [GL.VertexBuffer( [GL.repeat('x'), GL.endRepeat('y')] )]
  });


  let data = [];

  for(let i = 0; i < 605; i++){ // works out to be 1210 data points...
    data.push(i,i*2);
  }


  dataset.prependData(data, [GL.repeat('y')]);
  dataset.appendData([1,2,3], [GL.repeat('x')]);


  expect(gl.gl.tests_getNonNullBuffers().length).toBe(1);
  expect(gl.gl.tests_getNonNullBuffers()[0].byteLength).toBe(6800); // 400 of which is still allocated for x data....

  let reconstructedDataX = Array.from(new Float32Array(gl.gl.tests_getNonNullBuffers()[0].slice(0,12)));
  let reconstructedDataY = Array.from(new Float32Array(gl.gl.tests_getNonNullBuffers()[0].slice(400 + 390 * 4)));


  expect(reconstructedDataX).toEqual([1,2,3]);
  expect(reconstructedDataY).toEqual(data);

});


test("Test datastore prepend on a vertex buffer dataStore with end repeat layout will resize and re-locate existing data correctly if encroaching on other layout atoms, large amount of data", () => {
  const gl = new GL(fakeCanvas);

  let inputs = {
    y: {name: 'y', size: 1, type: 'float'},
    x: {name: 'x', size: 1, type: 'float'}
  };

  let dataset = gl.createDataSet({
    inputs: Object.values(inputs),
    layout: [GL.VertexBuffer( [GL.repeat('x'), GL.endRepeat('y')] )]
  });


  let data = [];

  for(let i = 0; i < 605; i++){ // works out to be 1210 data points...
    data.push(i,i*2);
  }


  dataset.prependData([-20, -20], [GL.repeat('y')]);
  dataset.prependData(data, [GL.repeat('y')]);
  dataset.appendData([1,2,3], [GL.repeat('x')]);


  expect(gl.gl.tests_getNonNullBuffers().length).toBe(1);
  expect(gl.gl.tests_getNonNullBuffers()[0].byteLength).toBe(6800); // 400 of which is still allocated for x data....

  let reconstructedDataX = Array.from(new Float32Array(gl.gl.tests_getNonNullBuffers()[0].slice(0,12)));
  let reconstructedDataY = Array.from(new Float32Array(gl.gl.tests_getNonNullBuffers()[0].slice(400 + 388 * 4)));

  data.push(...[-20, -20])

  expect(reconstructedDataX).toEqual([1,2,3]);
  expect(reconstructedDataY).toEqual(data);

});




test("Test datastore append on a vertex buffer dataStore, manually selecting which inputs to operate on throws error if inputs do not  exactly span atoms", () => {
  const gl = new GL(fakeCanvas);

  let inputs = {
    y: {name: 'y', size: 1, type: 'float'},
    x: {name: 'x', size: 1, type: 'float'},
    w: {name: 'w', size: 1, type: 'float'},
    z: {name: 'z', size: 1, type: 'float'}
  };

  let dataset = gl.createDataSet({
    inputs: Object.values(inputs),
    layout: [GL.VertexBuffer( [GL.repeat('x', 'y'), GL.endRepeat('w', 'z')] )]
  });

  let dataXY = [1,2,3,4];
  let dataWZ = [-1,-2,-3,-4];

  let data = [...dataXY, ...dataWZ]

  expect( () => dataset.appendData(data, [GL.repeat('x', 'y'), GL.repeat('w', 'z')], {inputsToAdd: ['x']})).toThrow("VertexBuffer requires that all inputs in a layout atom are either all effected by the prepend/append operation or none are");
  expect( () => dataset.prependData(data, [GL.repeat('x', 'y'), GL.repeat('w', 'z')], {inputsToAdd: ['w', 'y']})).toThrow("VertexBuffer requires that all inputs in a layout atom are either all effected by the prepend/append operation or none are");
});




test("Test datastore append and prepend on a vertex buffer dataStore, manually selecting which inputs to operate on", () => {
  const gl = new GL(fakeCanvas);

  let inputs = {
    y: {name: 'y', size: 1, type: 'float'},
    x: {name: 'x', size: 1, type: 'float'},
    w: {name: 'w', size: 1, type: 'float'},
    z: {name: 'z', size: 1, type: 'float'}
  };

  let dataset = gl.createDataSet({
    inputs: Object.values(inputs),
    layout: [GL.VertexBuffer( [GL.repeat('x', 'y'), GL.endRepeat('w', 'z')] )]
  });

  let dataXY = [1,2,3,4];
  let dataWZ = [-1,-2,-3,-4];

  let data = [...dataXY, ...dataWZ]

  dataset.appendData(data, [GL.repeat('x', 'y'), GL.repeat('w', 'z')], {inputsToAdd: ['x', 'y']});
  dataset.prependData(data, [GL.repeat('x', 'y'), GL.repeat('w', 'z')], {inputsToAdd: ['w', 'z']});

  expect(gl.gl.tests_getNonNullBuffers().length).toBe(1);
  expect(gl.gl.tests_getNonNullBuffers()[0].byteLength).toBe(1600);


  let reconstructedDataXY = Array.from(new Float32Array(gl.gl.tests_getNonNullBuffers()[0].slice(0,16)));
  let reconstructedDataWZ = Array.from(new Float32Array(gl.gl.tests_getNonNullBuffers()[0].slice(1600 - 16)));

  expect(reconstructedDataXY).toEqual(dataXY);
  expect(reconstructedDataWZ).toEqual(dataWZ);

});



test("Test datastore append with input index transformer, index transformer maps outside of valid range", () => {
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

  expect( () => dataset.appendData(data, [GL.repeat('x', 'y')], {inputsToAdd: ['x', 'y'], indexTransformers: {x: (idx, val, len, acc) => len + idx}})).toThrow("has mapped an index to a value outside of the bounds");

});


test("Test datastore append with input index transformer, index transformer maps two indices to the same index", () => {
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

  expect( () => dataset.appendData(data, [GL.repeat('x', 'y')], {inputsToAdd: ['x', 'y'], indexTransformers: {x: (idx, val, len, acc) => 0}})).toThrow("has mapped two different indices to the same index, this is not allowed");

});



test("Test datastore append with input index transformer", () => {
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

  dataset.appendData(data, [GL.repeat('x', 'y')], {inputsToAdd: ['x', 'y'], indexTransformers: {x: (idx, val, len, acc) => len - idx - 1}});

  expect(gl.gl.tests_getNonNullBuffers().length).toBe(1);
  expect(gl.gl.tests_getNonNullBuffers()[0].byteLength).toBe(800);


  let reconstructedData = Array.from(new Float32Array(gl.gl.tests_getNonNullBuffers()[0].slice(0,16)));

  expect(reconstructedData).toEqual([3,2,1,4]);

});



test("Test datastore append with input index transformer", () => {
  const gl = new GL(fakeCanvas);

  let inputs = {
    y: {name: 'y', size: 1, type: 'float'},
    x: {name: 'x', size: 1, type: 'float'}
  };

  let dataset = gl.createDataSet({
    inputs: Object.values(inputs),
    layout: [GL.VertexBuffer( [GL.repeat('x', 'y')] )]
  });


  let data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]

  dataset.appendData(data, [GL.repeat('x', 'y')], {inputsToAdd: ['x', 'y'], indexTransformers: {x: (idx, val, len, acc) => {

    if(acc){
      return idx
    }else if(idx && idx % Math.floor(len/2) === 0){
      return [0, true];
    }else{
      return idx + 1;
    }
  }}});

  expect(gl.gl.tests_getNonNullBuffers().length).toBe(1);
  expect(gl.gl.tests_getNonNullBuffers()[0].byteLength).toBe(800);


  let reconstructedData = Array.from(new Float32Array(gl.gl.tests_getNonNullBuffers()[0].slice(0,8*8)));

  expect(reconstructedData).toEqual([9, 2, 1, 4, 3, 6, 5, 8, 7, 10, 11, 12, 13, 14, 15, 16]);

});





test("Test datastore addData without explicit prepend/append instructions", () => {
  const gl = new GL(fakeCanvas);

  let inputs = {
    y: {name: 'y', size: 1, type: 'float'},
    x: {name: 'x', size: 1, type: 'float'},
    w: {name: 'w', size: 1, type: 'float'},
    z: {name: 'z', size: 1, type: 'float'}
  };

  let dataset = gl.createDataSet({
    inputs: Object.values(inputs),
    layout: [GL.VertexBuffer( [GL.repeat('x', 'y'), GL.endRepeat('w', 'z')] )]
  });

  let dataXY = [1,2,3,4];
  let dataWZ = [-1,-2,-3,-4];

  let data = [...dataXY, ...dataWZ]

  dataset.addData(data, [GL.repeat('x', 'y'), GL.repeat('w', 'z')]);

  expect(gl.gl.tests_getNonNullBuffers().length).toBe(1);
  expect(gl.gl.tests_getNonNullBuffers()[0].byteLength).toBe(1600);


  let reconstructedDataXY = Array.from(new Float32Array(gl.gl.tests_getNonNullBuffers()[0].slice(0,16)));
  let reconstructedDataWZ = Array.from(new Float32Array(gl.gl.tests_getNonNullBuffers()[0].slice(1600 - 16)));

  expect(reconstructedDataXY).toEqual(dataXY);
  expect(reconstructedDataWZ).toEqual(dataWZ);

});



test("Test datastore addData with explicit prepend/append instructions", () => {
  const gl = new GL(fakeCanvas);

  let inputs = {
    y: {name: 'y', size: 1, type: 'float'},
    x: {name: 'x', size: 1, type: 'float'},
    w: {name: 'w', size: 1, type: 'float'},
    z: {name: 'z', size: 1, type: 'float'}
  };

  let dataset = gl.createDataSet({
    inputs: Object.values(inputs),
    layout: [GL.VertexBuffer( [GL.repeat('x', 'y'), GL.endRepeat('w', 'z')] )]
  });

  let dataXY = [1,2,3,4];
  let dataWZ = [-1,-2,-3,-4];

  let data = [...dataXY, ...dataWZ]

  dataset.addData(data, [GL.repeat('x', 'y'), GL.repeat('w', 'z')], {w: "append", z: "append"});

  expect(gl.gl.tests_getNonNullBuffers().length).toBe(1);
  expect(gl.gl.tests_getNonNullBuffers()[0].byteLength).toBe(2400);


  let reconstructedDataXY = Array.from(new Float32Array(gl.gl.tests_getNonNullBuffers()[0].slice(0,16)));
  let reconstructedDataWZ = Array.from(new Float32Array(gl.gl.tests_getNonNullBuffers()[0].slice(1600, 1600 + 16)));

  expect(reconstructedDataXY).toEqual(dataXY);
  expect(reconstructedDataWZ).toEqual(dataWZ);

});



/// THESE TESTS ARE FOR DELETING DATA

// FIRST SOME SYNTAX CHECKS.....

        //  deleteInfo is an object of objects of the form 
        //  {<input>: {input: <name>, side: <'start', 'end'> -- should default to natural data flow, 
        //  amount: <amount> -- should default to all, lazy: <true/false> -- default of false}, .......}



test("DataSet delete checks that provided arguments are either string, symbol, or object with an input name", () => {
  const gl = new GL(fakeCanvas);

  let inputs = {
    y: {name: 'y', size: 1, type: 'float'},
    x: {name: 'x', size: 1, type: 'float'},
    w: {name: 'w', size: 1, type: 'float'},
    z: {name: 'z', size: 1, type: 'float'}
  };

  let dataset = gl.createDataSet({
    inputs: Object.values(inputs),
    layout: [GL.VertexBuffer( [GL.repeat('x', 'y'), GL.endRepeat('w', 'z')] )]
  });

  expect(() => dataset.deleteData(123)).toThrow("Delete input either expects a list of input names (string/symbol) or objects");
})


test("DataSet delete checks that provided arguments are either string, symbol, or object with an input name", () => {
  const gl = new GL(fakeCanvas);

  let inputs = {
    y: {name: 'y', size: 1, type: 'float'},
    x: {name: 'x', size: 1, type: 'float'},
    w: {name: 'w', size: 1, type: 'float'},
    z: {name: 'z', size: 1, type: 'float'}
  };

  let dataset = gl.createDataSet({
    inputs: Object.values(inputs),
    layout: [GL.VertexBuffer( [GL.repeat('x', 'y'), GL.endRepeat('w', 'z')] )]
  });

  expect(() => dataset.deleteData({flap: 10})).toThrow("Delete input description object must include the name of the input to delete!");
})


test("DataSet delete checks that arguments are actually inputs", () => {
  const gl = new GL(fakeCanvas);

  let inputs = {
    y: {name: 'y', size: 1, type: 'float'},
    x: {name: 'x', size: 1, type: 'float'},
    w: {name: 'w', size: 1, type: 'float'},
    z: {name: 'z', size: 1, type: 'float'}
  };

  let dataset = gl.createDataSet({
    inputs: Object.values(inputs),
    layout: [GL.VertexBuffer( [GL.repeat('x', 'y'), GL.endRepeat('w', 'z')] )]
  });

  expect(() => dataset.deleteData("g", "foo")).toThrow("is not known to this datastore");
})



test("DataSet delete checks that arguments are not repeated...", () => {
  const gl = new GL(fakeCanvas);

  let inputs = {
    y: {name: 'y', size: 1, type: 'float'},
    x: {name: 'x', size: 1, type: 'float'},
    w: {name: 'w', size: 1, type: 'float'},
    z: {name: 'z', size: 1, type: 'float'}
  };

  let dataset = gl.createDataSet({
    inputs: Object.values(inputs),
    layout: [GL.VertexBuffer( [GL.repeat('x', 'y'), GL.endRepeat('w', 'z')] )]
  });

  expect(() => dataset.deleteData("x", "x")).toThrow("Repeat argument");
})


test("DataSet delete checks that arguments are not repeated, even for different calling signatures", () => {
  const gl = new GL(fakeCanvas);

  let inputs = {
    y: {name: 'y', size: 1, type: 'float'},
    x: {name: 'x', size: 1, type: 'float'},
    w: {name: 'w', size: 1, type: 'float'},
    z: {name: 'z', size: 1, type: 'float'}
  };

  let dataset = gl.createDataSet({
    inputs: Object.values(inputs),
    layout: [GL.VertexBuffer( [GL.repeat('x', 'y'), GL.endRepeat('w', 'z')] )]
  });

  expect(() => dataset.deleteData("x", {input: "x", amount: 10})).toThrow("Repeat argument");
})



test("VertexBuffer delete checks that inputs that are in a layout atom together are requested to delete together", () => {
  const gl = new GL(fakeCanvas);

  let inputs = {
    y: {name: 'y', size: 1, type: 'float'},
    x: {name: 'x', size: 1, type: 'float'},
    w: {name: 'w', size: 1, type: 'float'},
    z: {name: 'z', size: 1, type: 'float'}
  };

  let dataset = gl.createDataSet({
    inputs: Object.values(inputs),
    layout: [GL.VertexBuffer( [GL.repeat('x', 'y'), GL.endRepeat('w', 'z')] )]
  });

  expect(() => dataset.deleteData("x")).toThrow("FAIL: all inputs in a layout atom must be deleted together");
});



test("VertexBuffer delete checks that inputs that are in a layout atom together are given consistent delete info", () => {
  const gl = new GL(fakeCanvas);

  let inputs = {
    y: {name: 'y', size: 1, type: 'float'},
    x: {name: 'x', size: 1, type: 'float'},
    w: {name: 'w', size: 1, type: 'float'},
    z: {name: 'z', size: 1, type: 'float'}
  };

  let dataset = gl.createDataSet({
    inputs: Object.values(inputs),
    layout: [GL.VertexBuffer( [GL.repeat('x', 'y'), GL.endRepeat('w', 'z')] )]
  });

  expect(() => dataset.deleteData("x", {input: "y", amount: 1})).toThrow("delete info for inputs in the same layout atom must have the same values");
});




test("VertexBuffer deletes data", () => {
  const gl = new GL(fakeCanvas);

  let inputs = {
    y: {name: 'y', size: 1, type: 'float'},
    x: {name: 'x', size: 1, type: 'float'},
    w: {name: 'w', size: 1, type: 'float'},
    z: {name: 'z', size: 1, type: 'float'}
  };

  let dataset = gl.createDataSet({
    inputs: Object.values(inputs),
    layout: [GL.VertexBuffer( [GL.repeat('x', 'y'), GL.endRepeat('w', 'z')] )]
  });

  dataset.appendData([1,2,3,4,5,6], [GL.repeat('x', 'y')]);

  dataset.deleteData('x', 'y');

  expect(gl.gl.tests_getNonNullBuffers().length).toBe(1);
  expect(gl.gl.tests_getNonNullBuffers()[0].byteLength).toBe(1600);


  let reconstructedDataXY = Array.from(new Float32Array(gl.gl.tests_getNonNullBuffers()[0].slice(0,8*3)));

  console.log(reconstructedDataXY)

  expect(reconstructedDataXY).toEqual([0,0,0,0,0,0]);
});















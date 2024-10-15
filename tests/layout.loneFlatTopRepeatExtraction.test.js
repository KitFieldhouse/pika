import GL from '../src/webglHandler/webglHandler.js';
import Layout from '../src/data/layout.js';


const inputs = {x: {name: 'x', size: 1, type: 'float'},
    y: {name: 'y', size: 1, type: 'float'},
    z: {name: 'z', size: 1, type: 'float'},
    b: {name: 'b', size: 1, type: 'float'}};


let layout = new Layout([[GL.repeat("x", "y")], [GL.repeat("z", "b")]] ,inputs)

let data = [[1,2,1,2,1,2,1,2,1,2], [3,4,3,4,3,4,3,4]]

test("Extracted correct lone flat top repeats for simple layout", () =>{
    expect(layout.loneTopFlatRepeats[0].repeat).toEqual(GL.repeat("x", "y"));
    expect(layout.loneTopFlatRepeats[1].repeat).toEqual(GL.repeat("z", "b"));
});

test("Extracted lone flat top repeats are associated with correct getter for simple layout", () =>{
    expect(layout.loneTopFlatRepeats[0].getter(data)).toEqual([1,2,1,2,1,2,1,2,1,2]);
    expect(layout.loneTopFlatRepeats[1].getter(data)).toEqual( [3,4,3,4,3,4,3,4]);
});


let compLayout = new Layout(['y', [[[GL.repeat("x", "y")]]], [[GL.repeat("z", "b")], 'x']] ,inputs)

let compData = [9, [[[1,2,1,2,1,2,1,2,1,2]]], [[3,4,3,4,3,4,3,4], -4]]
let compBufferData = [9, [[[(new Float32Array([1,2,1,2,1,2,1,2,1,2])).buffer]]], [[(new Float32Array([3,4,3,4,3,4,3,4])).buffer], -4] ]

test("Extracted correct lone flat top repeats for more complex layout", () =>{
    expect(compLayout.loneTopFlatRepeats[0].repeat).toEqual(GL.repeat("x", "y"));
    expect(compLayout.loneTopFlatRepeats[1].repeat).toEqual(GL.repeat("z", "b"));
});

test("Extracted lone flat top repeats are associated with correct getter for more complex layout", () =>{
    expect(compLayout.loneTopFlatRepeats[0].getter(compData)).toEqual([1,2,1,2,1,2,1,2,1,2]);
    expect(compLayout.loneTopFlatRepeats[1].getter(compData)).toEqual( [3,4,3,4,3,4,3,4]);
});


test("Layout correctly calculated the number of repeats for array data", () =>{
    expect(compLayout.loneTopFlatRepeats[0].size(compData)).toBe(5);
    expect(compLayout.loneTopFlatRepeats[1].size(compData)).toBe(4);
});


test("Layout correctly calculated the number of repeats for buffer data", () =>{
    expect(compLayout.loneTopFlatRepeats[0].size(compBufferData)).toBe(5);
    expect(compLayout.loneTopFlatRepeats[1].size(compBufferData)).toBe(4);
});


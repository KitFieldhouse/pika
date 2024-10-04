import GL from '../src/webglHandler/webglHandler.js';
import Layout from '../src/data/layout.js';


const inputs = [ {name: 'x', size: 1, type: 'float'},
    {name: 'y', size: 1, type: 'float'},
    {name: 'z', size: 1, type: 'float'},
    {name: 'b', size: 1, type: 'float'}];


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

test("Extracted correct lone flat top repeats for more complex layout", () =>{
    expect(compLayout.loneTopFlatRepeats[0].repeat).toEqual(GL.repeat("x", "y"));
    expect(compLayout.loneTopFlatRepeats[1].repeat).toEqual(GL.repeat("z", "b"));
});

test("Extracted lone flat top repeats are associated with correct getter for more complex layout", () =>{
    expect(compLayout.loneTopFlatRepeats[0].getter(compData)).toEqual([1,2,1,2,1,2,1,2,1,2]);
    expect(compLayout.loneTopFlatRepeats[1].getter(compData)).toEqual( [3,4,3,4,3,4,3,4]);
});
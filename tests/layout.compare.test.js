import GL from '../src/webglHandler/webglHandler.js'
import VertexBuffer from '../src/buffer/vertexBuffer.js';
import fakeCanvas from './fakeCanvas.js';
import Layout from '../src/data/layout.js';


const inputs = {x: {name: 'x', size: 1, type: 'float'},
    y: {name: 'y', size: 1, type: 'float'},
    z: {name: 'z', size: 1, type: 'float'},
    b: {name: 'b', size: 1, type: 'float'}};

const otherInputs = {x: {name: 'x', size: 1, type: 'float'},
y: {name: 'y', size: 1, type: 'float'},
z: {name: 'z', size: 1, type: 'float'},
b: {name: 'j', size: 1, type: 'float'}};



test("Test that layout comparison fails for layouts with different input definitions", () => {
    let gl = new GL(fakeCanvas);


    let layout1 = new Layout([GL.repeat('x', 'y')], inputs);
    let layout2 = new Layout([GL.repeat('x', 'y')], otherInputs);

    expect(layout1.isSameLayout(layout2)).toBe(false);
    expect(layout2.isSameLayout(layout1)).toBe(false);
});


test("Test that layout comparison fails for layouts with different repeats in layout descriptor", () => {
    let gl = new GL(fakeCanvas);


    let layout1 = new Layout([GL.repeat('x')], inputs);
    let layout2 = new Layout([GL.repeat('x', 'y')], inputs);

    expect(layout1.isSameLayout(layout2)).toBe(false);
    expect(layout2.isSameLayout(layout1)).toBe(false);
});

test("Test that layout comparison fails for layouts with different number of repeats in layout descriptor", () => {
    let gl = new GL(fakeCanvas);


    let layout1 = new Layout([GL.repeat('x'), GL.repeat('x'), GL.repeat('x')], inputs);
    let layout2 = new Layout([GL.repeat('x')], inputs);

    expect(layout1.isSameLayout(layout2)).toBe(false);
    expect(layout2.isSameLayout(layout1)).toBe(false);
});




test("Test that layout comparison fails for layouts with different same repeats with different optional args", () => {
    let gl = new GL(fakeCanvas);


    let layout1 = new Layout([GL.repeat({size: 1000}, 'x')], inputs);
    let layout2 = new Layout([GL.repeat('x')], inputs);

    expect(layout1.isSameLayout(layout2)).toBe(false);
    expect(layout2.isSameLayout(layout1)).toBe(false);
});


test("Test that layout comparison fails when different optional arguments are given", () => {
    let gl = new GL(fakeCanvas);


    let layout1 = new Layout([GL.repeat('x')], inputs, {expandVectors: ['x']});
    let layout2 = new Layout([GL.repeat('x')], inputs);

    expect(layout1.isSameLayout(layout2)).toBe(false);
    expect(layout2.isSameLayout(layout1)).toBe(false);
});



test("Test that layout comparison succeeds for same layout", () => {
    let gl = new GL(fakeCanvas);


    let layout1 = new Layout([GL.repeat('x')], inputs);
    let layout2 = new Layout([GL.repeat('x', 'y')], inputs);

    expect(layout1.isSameLayout(layout2)).toBe(false);
    expect(layout2.isSameLayout(layout1)).toBe(false);
});
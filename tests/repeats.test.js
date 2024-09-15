import GL from '../src/webglHandler/webglHandler.js'
import isLayoutObj from '../src/private/isLayoutObj.js';

// first test static repeat functions
const defaultRepeatOpts = {size: 100};


test("Test syntax checks for gl.repeat variants", () =>{

    expect(() => GL.repeat()).toThrow('at least one argument');
    expect(() => GL.endRepeat()).toThrow('at least one argument');
    expect(() => GL.centerRepeat()).toThrow('at least one argument');

    expect(() => GL.repeat({})).toThrow('require at least one non-optional argument');
    expect(() => GL.endRepeat({})).toThrow('require at least one non-optional argument');
    expect(() => GL.centerRepeat({})).toThrow('require at least one non-optional argument');

});

test("Test return values of gl.repeat variants", () =>{

    // without optional param

    expect(GL.repeat("y", "x")).toEqual({[isLayoutObj]: true, isFlat: true, arguments: ['y', 'x'], repeatType: 'start', opts: {}});
    expect(GL.endRepeat("y", "x")).toEqual({[isLayoutObj]: true, isFlat: true ,arguments: ['y', 'x'], repeatType: 'end', opts: {}});
    expect(GL.centerRepeat("y", "x")).toEqual({[isLayoutObj]: true, isFlat: true, arguments: ['y', 'x'], repeatType: 'center', opts: {}});

    // with optional param

    expect(GL.repeat({size: 100} , "y", "x")).toEqual({[isLayoutObj]: true, isFlat: true, arguments: ['y', 'x'], repeatType: 'start', opts: {size: 100}});
    expect(GL.endRepeat({size: 100} ,"y", "x")).toEqual({[isLayoutObj]: true, isFlat: true, arguments: ['y', 'x'], repeatType: 'end', opts: {size: 100}});
    expect(GL.centerRepeat({size: 100} , "y", "x")).toEqual({[isLayoutObj]: true, isFlat: true, arguments: ['y', 'x'], repeatType: 'center', opts: {size: 100}});

});
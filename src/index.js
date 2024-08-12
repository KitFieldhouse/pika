// root file used for having a unified entrypoint to the library


// some pseudo code...

// global gl should define what input data is needed for each data,
// if specific data implementation does not meet requirements new shader is created.
// figure out the ergonomics of how this should be handled....

// also state machine stuff?? Should fail gracefully and check for gl footguns 
// For instance if the shader and vao has a mismatch, should just skip render and 
// throw warning. Should avoid the user getting into this situation as much as 
// possible tho......

// this defines the buffer inputs to each shader program... 
// this will have a sensible default for simple 2d line plot rendering.


gl.defineDataInput({});

let dg = gl.createDataGroup(basicTypeInfo); // provide sane defaults in the case that no args are given
                                         // by default creates a single buffer, but if given an array of buffers it
                                         // will create a buffer for each array entry.

// default state is given by symbol gl.DEFAULT or some other similarly named var.
// 
data.setRenderType = gl.LINE_STRIP; // must set to a valid render mode.... this will be the default
dg.setRenderFunction = () => {gl.drawInstance(blapper)}; // this is for much more advanced and fine grained control over the 
                                                           // how this data is rendered. Whatever function you give here completely 
                                                           // replaces the function that the lib generates itself.

// code includes a default (generated) shader program, but you can replace with your own for more advanced control;
gl/dg.setShader([{}], "")

// first object is a description of the inputs to the shader program that includes:
    // buffer input info (if different than the global gl default, since this will require a new shader to be created for this buffer)
    // type information for uniform, which is used by the library for figuring out the correct conversion from normal ass js to glsl types 
    // when appropriate.
    // name of the uniform
    // initial value of the uniform
    // optional field if a change of this uniform should request a rerender.
// optional output info
// optional variable info (if programmatic changes are wanted to var)
// data will then have a field of the name given that can be changed. When this is changed then depending on if 
// auto rerenders was disabled or not then a rerender will be requested.
// The second arg is the text of the shader. It is then compiled and checked to make sure the uniforms as described in the first 
// object are valid and reports any error to the console.

// shaders of this form should be able to be modified in the same way as the default shader. This will require some parsing of the 
// text. // MAYBE?? I mean, if you are hardcoding in the shader you are pretty sure about it at that point....


gl/dg.defineUniforms([{}, {}, {}]);

// Array of objects that match the same form as the first object in the prev API func.
// The difference with this is that it will create these uniforms in the exists "default"
// shader instead of replacing the shader with a custom built text one.

dg.uniformName = 123.123; // this is how you could then define the uniform.

// one implementation detail is that I will first assume the case that all of the data sets created by the user of API 
// will use the same shader. As soon as the user starts doing manipulating the shader at the data level, this assumption will 
// can no longer be guaranteed so will break off the offending data object and create new shader just for that object that will
// be used. If done AFTER initialization this should prob throw an optimization warning since this requires a recomp of the 
// data's new shader.



// this function will allow the user to define the shader programmatically in js. // NVM I THINK THIS IS A BAD IDEA
// lets scratch out a few different ways that this API function could/should work.

// instead define outputs by text

(gl/dg).setOutput(gl/dg.outputName,`${gl/dg.buffInput} * ${gl/dg.uniformName}`);

// position and stuff like that are default outputs that don't have to be defined before use

// define outputs (of vertex shader)
(gl/dg).defineOutput();

// Also, there should be a "source map" like thing for the glsl to help the debugging.


// this defines an internal, non-uniform variable for use by the shader.
(gl/dg).defineVariable();
// set with...
(gl/dg).setVariable();


// so that defines shader things, but how to define when the thing is chopped up??
    // this is defined at the top of the doc for the global case, for a data obj specific chopping this should be 
    // be done when the data object is created.

// now for some basic qol and lifecycle API functions;

gl.delete(dg);
dg.delete();

dg.returnBuffer();

// one thing I am debating in my mind is how to deal with adding new data in. Who should write the marshalling code? Well, it is certainly up to 
// the API user to tell the API how the code should be marshalled into the buffers, but I am unsure on if I want these buffers to have to be 
// exposed to the API user or not. 

// One heuristic I could follow is the rule "one data object to one call to gl.draw<type>" but this seems restrictive.
// For instance, lets say I needed to draw thousands of devices each with a small amount of data, where each individual device 
// may have data added. It would be more efficient to pack all of the data into one big array and then call gl.draw<type> but 
// the data model still be separated out by device.

// or does this add too much complexity?? hmmmmmm lets do some noodling.

dg.definePrepend( "state" , true, (buffers, newData) => {
    buffers.startBuffer.prepend(newData);
});

// provides the function that tells the data how to perform a prepend operation. This runs whenever the function dg.prepend(data) is called. If a state 
// is provided this function only applies when the data object is in that current state.
// the second (optional) param tells the API if a rerender should be requested after a prepend. Defaults to true.


dg.defineAppend(...yadayada);

// Same as the above API call but this covers when data.append is called.

// I think the best way forward is to simulate a few examples and see if the ergonomics feel right.
// First, out datalogger data. 

// here is an idea -- the ability to, in the layout spec, define subdata layouts.
// subdata -- data that forms a distinct unit from the rest of the data set..
    // --> the ergonomics of this are sort of uncomfortable in my opinion.
// here is an idea -- define the layout and data model from an xml format??

// programmatic layout, think of the repeat function for css grid spec

// name should be able to be a string or a symbol
gl.setDataModel({inputs: [
    {name: 'y', size: 1, type: this.gl.FLOAT, normalized: false},
    {name: 'timestamps', integer: true, size: 2, type: this.gl.UNSIGNED_INT}
    ], 
    layout: [[gl.repeat("y"),gl.repeat('timestamps')]]} );

let dg = gl.createDataGroup(); // no arguments so it uses the data model from gl.setDataModel.
                            // this creates a single VAO,

// second is optional prepend layout descriptor, if descriptor does not match the layout 
// descriptor of the subdata you are appending too should throw a warning as this will 
// require marshalling.
// Also should check to make sure the inputs all make sense with the given subdata it will prepend to.
// syntax for adding to two different subdatas at once: 
    // AH! need something like an unpack descriptor and adder descriptor!!
dg.prependData(packet);

// code for "new vao" and new draw arrays call
// unless args are given this has the exact layout as the default (if there is only one)
// alternatively can give a layout with predefined inputs.
// alternatively can define new inputs which will cause the shader for this VAO draw call to break off
// OOOOH YEAH -- THE SHADER CALL ONLY APPLIES TO A VAO.
dg.newSubData("beforeBuffer");

dg.prependData(packet, "beforeData");

// this might lead to ordering ambiguities
dg.combineAllSubdata();

// also could do:
dg.data.prepend(data.beforeData);

//rename data as data wrapper -- renamed as data group??





rc = gl.createRenderContext("basic2D", {inputs: [
        {name: 'y', size: 1, type: this.gl.FLOAT, normalized: false},
        {name: 'timestamps', integer: true, size: 2, type: this.gl.UNSIGNED_INT}
    ], 
    uniforms: [
        {name: 'color', size: 1, type: this.gl.FLOAT, normalized: false, rerender: true},
        {name: 'blap', integer: true, size: 2, type: this.gl.UNSIGNED_INT}
    ]
});

data = rc.newDataSet("name",  [[gl.repeat('y', 'timestamps')], someOtherData.buffers[1]]); // second is optional layout specifier.

data.append(data, layout);
data.prepend(data, layout);
data.append(someOtherDataSet); // this might have to do some conversion of forms and the like :(

gl.registerForRender(data);

gl.repeat(); // padding is put at end 
gl.endRepeat(); // padding is put at start (data at end)
gl.centerRepeat(); // padding is put at start and end (data is in the center)

data[0].pointToBuffer(someOtherData[0]); // this means that data[0] buffer will point towards someOtherBuf


let renderer = gl.createRenderer({inputs: [{name: "a"}], globalUniforms: [], localUniforms: [], outputString: []});

renderer.setUniform("mousePos", value);

data = gl.createDataSet({});

renderer.registerForRender(data, {}); // second is optional mapping argument;

// Two words from last night thinking about this FUNCTIONS, RENDERER-CENTRIC?? not sure what the seconds 
// one was tbh....
// render state machine!!






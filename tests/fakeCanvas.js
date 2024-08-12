

let fakeGL = {FLOAT: 1, HALF_FLOAT: 2, SHORT: 3, UNSIGNED_SHORT: 4, BYTE: 5, UNSIGNED_BYTE: 6, 
             INT: 7, UNSIGNED_INT: 8};

let fakeCanvas = {};

fakeCanvas.getContext = () => fakeGL;

export default fakeCanvas;
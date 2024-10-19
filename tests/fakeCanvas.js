import fakeGL from "./fakeGL";

let fakeCanvas = {};

fakeCanvas.getContext = () => fakeGL;

export default fakeCanvas;
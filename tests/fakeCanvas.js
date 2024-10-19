import FakeGL from "./fakeGL";

let fakeCanvas = {};

fakeCanvas.getContext = () => new FakeGL();

export default fakeCanvas;
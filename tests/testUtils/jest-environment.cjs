// __test-utils__/custom-jest-environment.js
// Stolen from: https://github.com/ipfs/jest-environment-aegir/blob/master/src/index.js
// Overcomes error from jest internals.. this thing: https://github.com/facebook/jest/issues/6248

// Further, see https://github.com/jestjs/jest/issues/7780
"use strict";

const NodeEnvironment = require("jest-environment-node").TestEnvironment;

class MyEnvironment extends NodeEnvironment {
  constructor(config) {
    super(config);
  }

  async setup() {
    await super.setup();
    this.global.Float32Array = Float32Array;
    this.global.ArrayBuffer = ArrayBuffer;
  }

  async teardown() {
    await super.teardown();
  }

  getVmContext() {
    return super.getVmContext();
  }

}

module.exports = MyEnvironment;
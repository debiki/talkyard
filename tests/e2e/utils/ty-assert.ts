import assert = require('assert');


const tyAssert = {
  ...assert,

  // Maybe might as well always use this one, instead of  strictEqual  sometimes?
  // Could do that change later — but start with deepEq as a separate fn.
  deepEq: assert.deepStrictEqual,

  eq: assert.strictEqual,

  refEq: (actual, expected) => {
    assert.ok(actual === expected,
      `Not reference-equal, actual: ${JSON.stringify(actual)}, ` +
          `expected: ${JSON.stringify(expected)}`);
  },

  includes: (text: string, expectedSubstring: string, message?: string) => {
    // Could make this work w regexs too.
    const ix = text.indexOf(expectedSubstring);
    assert.ok(ix >= 0, message || `This: "${expectedSubstring}" is missing from: "${text}"`);
  },

  excludes: (text: string, unexpectedSubstring: string, message?: string) => {
    const ix = text.indexOf(unexpectedSubstring);
    assert.ok(ix === -1,
      message || `This: "${unexpectedSubstring}" is incorrectly included in: "${text}"`);
  }
};


export = tyAssert;

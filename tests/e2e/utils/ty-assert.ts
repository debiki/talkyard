import assert = require('assert');


const tyAssert = {
   ...assert,

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

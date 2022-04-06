import * as _ from 'lodash';
import * as assert from 'assert';
import { j2s, dieIf } from './log-and-die';

// (Also see: https://www.npmjs.com/package/power-assert )


function toPrettyString(sth): string {
  if (_.isObject(sth)) return JSON.stringify(sth, undefined, 2);
  return `${sth}`;
}


const tyAssert = {
  ...assert,

  that: (test, message?: St, sth?) => {
    tyAssert.ok(test, message, sth);
  },

  ok: (test, message?: St, sth?) => {
    const wholeMessage = (message || '') + (sth ? toPrettyString(sth) : '');
    assert.ok(test, wholeMessage);
  },


  fail: (message: string, sth?) => {
    const wholeMessage = message + (sth ? toPrettyString(sth) : '');
    assert.fail(wholeMessage);
  },

  deepEq: function<T>(actual: unknown, expected: T, message?: St) {
    assert.deepStrictEqual<T>(actual, expected, message);
  },

  partialEq: function<T>(actual: T, expected: Partial<T>, message?: St) {
    tyAssert.that(_.isObject(actual), `Actual value is not an object: ${j2s(actual)}`);
    tyAssert.that(_.isObject(expected), `Expected value is not an object: ${j2s(expected)}`);
    const entries = Object.entries(expected);
    tyAssert.that(entries.length, `Expected object is empty, pointless test: ${j2s(expected)}`);

    for (let [field, expectedValue] of entries) {
      const actualValue = actual[field];
        tyAssert.deepEq(actualValue, expectedValue,
            message +
            `\n  Field '${field}', actual != expected:  ${
                  j2s(actualValue)}  !=  ${j2s(expectedValue)}   [TyET40MPGQ27]` +
            `\n  --- Complete actual obj: -----------------------` +
            `\n  ${j2s(actual)}` +
            `\n  ------------------------------------------------`);
    }
  },

  not: (what, message?) => {
    assert.ok(!what, message);
  },

  notEq: (actual, wrongValue, message?) => {
    tyAssert.ok(actual !== wrongValue,
      `  assert.notEq: Equals the wrong value:\n` +
      `           actual:  ${JSON.stringify(actual)}\n` +
      `    should not be:  ${JSON.stringify(wrongValue)}\n`);
  },

  eq: (actual, expected, message?: string, detailsObj?) => {
    // Show the two values on two lines, aligned, so one sees at a glance
    // what's wrong.
    let wholeMessage = '\n\n' +
          `  assert.eq: Actual value differs from expected value:\n` +
          `        actual:  ${actual}\n` +
          `      expected:  ${expected}\n`;
    if (message) {
      wholeMessage +=
          `  Details:\n` +
          `    ${toPrettyString(message) +
                    (detailsObj ? toPrettyString(detailsObj) : '')
                }\n`;
    }
    assert.strictEqual(actual, expected, wholeMessage);
  },

  eqManyLines: (actual, expected, message?: St, detailsObj?) => {
    // Show the two values on many lines.
    let wholeMessage = '\n\n' +
          `assert.eqManyLines: Actual value differs from expected value:\n` +
          `===== actual + ▩\\n: ========================\n` +  // ◪ or ▩?
          `${actual}▩\n` +
          `===== expected + ▩\\n: ======================\n` +
          `${expected}▩\n` +
          `===========================================\n`;
    if (message) {
      wholeMessage +=
          `Details:\n` +
          `    ${toPrettyString(message) +
                    (detailsObj ? toPrettyString(detailsObj) : '')
                }\n`;
    }
    assert.strictEqual(actual, expected, wholeMessage);
  },

  refEq: (actual, expected) => {
    assert.ok(actual === expected,
      `  assert.refEq: Not reference-equal:\n` +
      `      actual:  ${JSON.stringify(actual)}\n` +
      `    expected:  ${JSON.stringify(expected)}\n`);
  },

  greaterThan: (actual, min) => {
    assert.ok(actual > min,
      `Value too small: ${JSON.stringify(actual)}, ` +
          `should be at least: ${JSON.stringify(min)}`);
  },

  matches: (text: string, regexOrString: RegExp | string) => {
    const regex = _.isString(regexOrString) ?
            new RegExp(regexOrString) : regexOrString;
    assert.ok(regex.test(text), '\n\n' +
        `  assert.matches:\n` +
        `       This regex:  ${regex.toString()}\n` +
        `       does not match:  ${inlineOrDashPara(text)}\n`);
  },

  containsAll: (items: Ay[], expectedItems: Ay[]) => {
    for (const i of expectedItems) {
      tyAssert.contains(items, i);
    }
  },

  contains: (items: Ay[], expectedItem: Ay) => {
    const foundAtIx = _.indexOf(items, expectedItem);
    if (foundAtIx === -1) {
      assert.fail(`\n\n` +
        `  assert.contains:\n` +
        `      This is missing: ${j2s(expectedItem)}\n` +
        `            from list: ${j2s(items)}}\n`);
    }
  },

  includes: (text: St, expectedSubstring: St, atIndex?: Nr | St, message?: St) => {
    // Could make this work w regexs too.

    if (_.isString(atIndex)) {
      dieIf(!_.isUndefined(message), 'TyE603MSE5');
      message = atIndex;
      atIndex = undefined;
    }

    dieIf(!_.isString(text), `\`text\` is not a string, here it is:  ${text}`);
    dieIf(!_.isString(expectedSubstring), `\`expectedSubstring\` is not a string, ` +
          `here it is:  ${expectedSubstring}`);

    const ix = text.indexOf(expectedSubstring);
    assert.ok(ix >= 0, '\n\n' + (message ||
      `  assert.includes:\n` +
      `     This text:  "${expectedSubstring}"\n` +
      `     is missing from:  ${inlineOrDashPara(text)}\n`));
    if (_.isNumber(atIndex)) {
      tyAssert.eq(ix, atIndex, '\n\n' + (message ||
        `  assert.includes:\n` +
        `     This text:  "${expectedSubstring}"\n` +
        `             found at index: ${ix}\n` +
        `     but should be at index: ${atIndex},\n` +
        `     in this text:  ${inlineOrDashPara(text)}\n`));

    }
  },

  excludes: (text: string, unexpectedSubstring: string, message?: string) => {
    tyAssert.ok(text.length > 0, 'TyE4906895SK', 'text empty');
    const ix = text.indexOf(unexpectedSubstring);
    assert.ok(ix === -1,
      message || `This: "${unexpectedSubstring}" is incorrectly included in: "${text}"`);
  },

  numSubstringsEq: (text: St, substringNoSpecialChars: St, numExpected: Nr) => {
    const regex = new RegExp(substringNoSpecialChars, 'gs');
    const numActual = (text.match(regex) || []).length;
    tyAssert.eq(numActual, numExpected,
          `Wrong num matches of:  ${regex}  in:  ${inlineOrDashPara(text)}`);
  }
};


function inlineOrDashPara(text: string): string {
  return text.indexOf('\n') === -1 ? `"${text}"` : (
        `(between the ---)\n` +
        `------------------------------------------------------------------------\n` +
        `${text}\n` +
        `------------------------------------------------------------------------\n`);
}

export default tyAssert;

import * as _ from 'lodash';
import * as assert from 'assert';
import { dieIf } from './log-and-die';

interface TyAssert {
  // Implement later
}


function toPrettyString(sth): string {
  if (_.isObject(sth)) return JSON.stringify(sth, undefined, 2);
  return `${sth}`;
}


const tyAssert: any = {   // : any = works around:
              // error TS2775: Assertions require every name in the call target
              // to be declared with an explicit type annotation.
  ...assert,

  that: (test, message: string, sth?) => {
    tyAssert.ok(test, message, sth);
  },

  ok: (test, message: string, sth?) => {
    const wholeMessage = message + (sth ? toPrettyString(sth) : '');
    assert.ok(test, wholeMessage);
  },


  fail: (message: string, sth?) => {
    const wholeMessage = message + (sth ? toPrettyString(sth) : '');
    assert.fail(wholeMessage);
  },

  // Maybe might as well always use this one, instead of  strictEqual  sometimes?
  // Could do that change later — but start with deepEq as a separate fn.
  deepEq: assert.deepStrictEqual,

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

  includes: (text: string, expectedSubstring: string, message?: string) => {
    // Could make this work w regexs too.

    dieIf(!_.isString(text), `\`text\` is not a string, here it is:  ${text}`);
    dieIf(!_.isString(expectedSubstring), `\`expectedSubstring\` is not a string, ` +
          `here it is:  ${expectedSubstring}`);

    const ix = text.indexOf(expectedSubstring);
    assert.ok(ix >= 0, '\n\n' + (message ||
      `  assert.includes:\n` +
      `     This text:  "${expectedSubstring}"\n` +
      `     is missing from:  ${inlineOrDashPara(text)}\n`));
  },

  excludes: (text: string, unexpectedSubstring: string, message?: string) => {
    tyAssert.ok(text.length > 0, 'TyE4906895SK', 'text empty');
    const ix = text.indexOf(unexpectedSubstring);
    assert.ok(ix === -1,
      message || `This: "${unexpectedSubstring}" is incorrectly included in: "${text}"`);
  },

  numSubstringsEq: (text: string, substringNoSpecialChars: string, numExpected: N) => {
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

export = tyAssert;

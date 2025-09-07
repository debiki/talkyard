import * as _ from 'lodash';
import * as assert from 'assert';
import { j2s, dieIf, die, logMessage, logUnusual } from './log-and-die';
import type { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';

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

  /// Ignores order.
  sameElems: function<T>(actual: Ay[], expected: T[], message?: St) {
    assert.deepStrictEqual<Set<T>>(new Set(actual), new Set(expected), message);
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

  excludes: (text: St, unexpectedSubstring: (St | RegExp) | (St | RegExp)[], details?: St) => {
    tyAssert.ok(text.length > 0, 'TyE4906895SK', 'text empty');
    let found = [];
    const unexVals = _.isArray(unexpectedSubstring) ? unexpectedSubstring : [unexpectedSubstring];
    for (let unexVal of unexVals) {
      if (_.isString(unexVal)) {
        const unexStr: St = unexVal;
        const ix = text.indexOf(unexStr);
        if (ix !== -1)
          found.push(unexStr);
      }
      else if (_.isRegExp(unexVal)) {
        die("Regex unimpl [TyE703SN<MD5]");
      }
      else {
        die(`Bad item type: ${typeof unexVal} [TyE7TKSR47WQ2]`);
      }
    }
    tyAssert.ok(!found.length,
        `assert.excludes:\n` +
        `    These items:  ${j2s(found)}\n` +
        `    found in:  "${text}"` +
        `    (but shouldn't be there)` + (!details ? '' :
        `    Details:  ${details}`));
  },

  numSubstringsEq: (text: St, substringNoSpecialChars: St, numExpected: Nr) => {
    const regex = new RegExp(substringNoSpecialChars, 'gs');
    const numActual = (text.match(regex) || []).length;
    tyAssert.eq(numActual, numExpected,
          `Wrong num matches of:  ${regex}  in:  ${inlineOrDashPara(text)}`);
  },

  /// Verifies that there's a CSP violation.
  ///
  contentSecurityPolicyViolation: async (brX: TyE2eTestBrowser, okayAncestors: St): Pr<Vo> => {
    // There is an iframe but it's empty, because the Content-Security-Policy frame-ancestors
    // policy forbids embedding from this domain.
    // But with WebdriverIO v6, this: browser.switchToFrame(iframe);
    // now blocks, for iframes that couldn't be loaded?
    // So skip this for now:
    //
    // Update, 2025: Now, in Chrome Dev Tools, there's this error message:
    //    Refused to frame 'http://site-w8rs0yh8d2.localhost/' because
    //    an ancestor violates the following Content Security Policy directive:
    //    "frame-ancestors http://e2e-test--ec-6697957.localhost:8080
    //                    https://e2e-test--ec-6697957.localhost:8080".

    const ancErrMsg = 'ancestor violates the following Content Security Policy directive';
    const fullMsg = ancErrMsg + `: "${okayAncestors}"`;
    const msgs = await brX.getLogs_worksInChrome('browser');
    logMessage(`\nBrowser log messages: ${msgs.map(m => j2s(m))}\n`);
    let numMatches = 0;
    for (let m of msgs) {
      // Break out test or err msg?
      if (m.message.indexOf(ancErrMsg) >= 0) {
        if (m.message.indexOf(fullMsg) >= 0) {
          numMatches += 1;
        }
        else {
          assert.fail(`Ancestor policy, but the wrong one?\n` +
                `     Got this log message: ${m.message}\n` +
                `                 Expected: ${fullMsg}\n`);
        }
      }
    }

    if (numMatches !== 1) {
      logUnusual(`Browser log messages: ` + msgs.map(m => j2s(m)));
      assert.fail(`No ancestor-violates browser error log message?  (Or? See above)`)
    }
  },
};


function inlineOrDashPara(text: string): string {
  return text.indexOf('\n') === -1 ? `"${text}"` : (
        `(between the ---)\n` +
        `------------------------------------------------------------------------\n` +
        `${text}\n` +
        `------------------------------------------------------------------------\n`);
}

export default tyAssert;

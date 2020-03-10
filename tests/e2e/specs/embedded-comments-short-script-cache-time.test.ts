/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('../utils/ty-assert');
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
const syncRequest = require('sync-request');

declare const browser: any;
let everyonesBrowsers;

const scriptUrl = `${settings.scheme}://localhost/-/ed-comments.min.js`;
const scriptUrl2 = `${settings.scheme}://localhost/-/ed-comments.v0.min.js`;
const scriptUrl3 = `${settings.scheme}://localhost/-/talkyard-comments.min.js`;

const desiredCacheHeader = settings.prod ?
    'max-age=86400, s-maxage=86400, public' : 'no-cache';

describe("the embedded comments script is cached for a day only", () => {

  it("load comments script", () => {
    everyonesBrowsers = _.assign(browser, pagesFor(browser));
    everyonesBrowsers.go(scriptUrl);
  });

  it("it contains javascript", () => {
    const source = everyonesBrowsers.getSource();
    // It can be annoyingly confusing to track down why this test fails
    // with a 404 Not Found, so let's explain.
    if (source.indexOf('TyE404NF') >= 0) {
      assert.fail(
        `Page not found. You need to build minified Javascript files, for\n` +
        `this test to work — otherwise the file I want becomes 404 Not Found.\n` +
        `\n` +
        `Do this:\n` +
        `\n` +
        `    s/d gulp release\n` +   // sync w gulpfile.js [MKBUNDLS]
        `\n`);
    }
    assert.includes(source, 'edCommentsServerUrl');
  });

  it("the cache time is just one day", () => {
    let theUrl = scriptUrl;
    for (let i = 0; i < 3; ++i) {
      const response = syncRequest('GET', theUrl);
      const headers = response.headers;
      if (headers['cache-control'] !== desiredCacheHeader) {  // [2WBKP46]
        assert.fail("Bad es-comments.min.js cache time, look at the cache header:\n" +
            JSON.stringify(headers));
      }
      if (i === 0) theUrl = scriptUrl2;
      else theUrl = scriptUrl3;
    }
  });

});


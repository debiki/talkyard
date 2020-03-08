/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
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
    assert(source.search('edCommentsServerUrl') > 0);
  });

  it("the cache time is just one day", () => {
    let theUrl = scriptUrl;
    for (let i = 0; i < 3; ++i) {
      const response = syncRequest('GET', theUrl);
      const headers = response.headers;
      if (headers['cache-control'] !== desiredCacheHeader) {  // [2WBKP46]
        console.log("Bad es-comments.min.js cache time, look at the cache header:\n" +
            JSON.stringify(headers));
        assert(false);
      }
      if (i === 0) theUrl = scriptUrl2;
      else theUrl = scriptUrl3;
    }
  });

});


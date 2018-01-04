/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import pagesFor = require('../utils/pages-for');
const syncRequest = require('sync-request');

declare let browser: any;
let everyonesBrowsers;

const scriptUrl = 'http://localhost/-/ed-comments.min.js';
const scriptUrl2 = 'http://localhost/-/ed-comments.v0.min.js';

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
    for (let i = 0; i < 2; ++i) {
      const response = syncRequest('GET', theUrl);
      const headers = response.headers;
      if (headers['cache-control'] !== "max-age=86400, s-maxage=86400, public") {  // [2WBKP46]
        console.log("Bad es-comments.min.js cache time, look at the cache header:\n" +
            JSON.stringify(headers));
        assert(false);
      }
      theUrl = scriptUrl2;
    }
  });

});


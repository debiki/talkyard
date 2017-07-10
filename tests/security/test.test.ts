/// <reference path="../e2e/test-types.ts"/>

import * as tape from 'tape';
const asyncTest = tape;
import syncTest = require('./sync-tape');
import * as syncRequest from 'sync-request';
import * as cheerio from 'cheerio';
import settings = require('./settings');
import { logUnusual, die, dieIf } from '../e2e/utils/log-and-die';


asyncTest('timing test', (test) => {
  test.plan(2);

  test.equal(typeof Date.now, 'function');
  var start = Date.now();

  setTimeout(function () {
    //test.equal(Date.now() - start, 100);
    test.equal('abc', 'abc')
  }, 100);
});


syncTest('equals test', (test) => {
  test.equal(3, 3);
  test.equal(4, 4);
  test.equal(5, 5);
  test.equal(7, 7);
});


syncTest('not found: /non-existing-page', (test) => {
  let response = syncRequest('GET', settings.testSiteOrigin2);
  test.true(/404 Not Found/.test(response.body));
});


syncTest('200 ok with title', (test) => {
  let response = syncRequest('GET', settings.testSiteOrigin3);
  test.equal(response.status, 200);
  let $ = cheerio.load(response.body);
  //console.log("bd: " + response.body);
  test.equal($('body h1').text(), 'broken_test');
});



// --- import site test

import server = require('../e2e/utils/server');
import pagesFor = require('../e2e/utils/pages-for');
import { buildSite } from '../e2e/utils/site-builder';

const forum = buildSite().addLargeForum({ title: 'Tape Test Forum' });
const idAddress = server.importSiteData(forum.siteData);

// server.initOrDie();

console.log('ZZWWQQ idAddress: ' + JSON.stringify(idAddress));


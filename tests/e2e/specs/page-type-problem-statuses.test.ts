/// <reference path="../test-types.ts"/>
import * as _ from 'lodash';
import assert = require('assert');
import fs = require('fs');
import server = require('../utils/server');
import utils = require('../utils/utils');
import pages = require('../utils/pages');
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import make = require('../utils/make');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

declare let browser: any;

let everyonesBrowsers;
let maria;
let mariasBrowser;
let michael;
let michaelsBrowser;
let owen;
let owensBrowser;
let strangersBrowser;

let idAddress: IdAddress;
let siteId: any;

let mariasTopicUrl: string;

const mariasOpReply = 'mariasOpReply';
const mariasOpReplyReply = 'mariasOpReplyReply';

const bottomCommentOneText = 'bottomCommentOneText';
const bottomCommentTwoText = 'bottomCommentTwoText';


describe("Page statuses and bottom comments", () => {

  it("Initialize people", () => {
    browser.perhapsDebugBefore();
    everyonesBrowsers = _.assign(browser, pagesFor(browser));
    strangersBrowser = everyonesBrowsers;
    mariasBrowser = everyonesBrowsers;
    michaelsBrowser = everyonesBrowsers;
    owensBrowser = everyonesBrowsers;
    maria = make.memberMaria();
    michael = make.memberMichael();
    owen = make.memberOwenOwner();
  });

  it("Import a site", () => {
    const site: SiteData = make.forumOwnedByOwen('pgstbc', { title: "Emb Cmts Disc Id Test" });
    site.members.push(maria);
    site.members.push(michael);
    idAddress = server.importSiteData(site);
    siteId = idAddress.id;
  });

  it("Maria logs in", () => {
    mariasBrowser.go(idAddress.origin);
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
    mariasBrowser.disableRateLimits();
  });

  it("She posts a topic, type Problem", () => {
    mariasBrowser.complex.createAndSaveTopic({
      type: c.TestPageRole.Problem, title: "Marias Problem Title", body: "Marias Problem Text" });
    mariasTopicUrl = mariasBrowser.url().value;
  });

  it("Changes status to Planned", () => {
    mariasBrowser.waitAndClick('.icon-attention-circled.dw-clickable');
  });

  it("... then to Started", () => {
    mariasBrowser.waitAndClick('.icon-check-dashed.dw-clickable');
  });

  it("... then to Done", () => {
    mariasBrowser.waitAndClick('.icon-check-empty.dw-clickable');
    mariasBrowser.waitForVisible('.icon-check.dw-clickable');
  });

  it("... and back to New again", () => {
    mariasBrowser.waitAndClick('.icon-check.dw-clickable');
    mariasBrowser.waitForVisible('.icon-attention-circled.dw-clickable');
  });

  it("Three status change events appear (after page refresh)", () => {
    mariasBrowser.refresh(); // [2PKRRSZ0]
    mariasBrowser.topic.waitForPostNrVisible(5);  // 2, 3, 4 an 5  (1 is the orig post)
  });

  it("... with the correct text contents", () => {
    mariasBrowser.topic.assertMetaPostTextMatches(2, 'marked this topic as Planned');
    mariasBrowser.topic.assertMetaPostTextMatches(3, 'marked this topic as Started');
    mariasBrowser.topic.assertMetaPostTextMatches(4, 'marked this topic as Done');
    mariasBrowser.topic.assertMetaPostTextMatches(5, 'marked this topic as New');
  });

  it("Done", () => {
    everyonesBrowsers.perhapsDebug();
  });

});


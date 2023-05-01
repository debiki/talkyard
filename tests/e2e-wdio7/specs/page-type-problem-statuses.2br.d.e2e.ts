/// <reference path="../test-types.ts"/>
import * as _ from 'lodash';
import assert = require('assert');
import fs = require('fs');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import make = require('../utils/make');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

let browser: TyE2eTestBrowser;

let everyonesBrowsers;
let maria;
let mariasBrowser: TyE2eTestBrowser;
let michael;
let michaelsBrowser: TyE2eTestBrowser;
let owen;
let owensBrowser: TyE2eTestBrowser;
let strangersBrowser: TyE2eTestBrowser;

let idAddress: IdAddress;
let siteId: any;

let mariasTopicUrl: string;

const mariasOpReply = 'mariasOpReply';
const mariasOpReplyReply = 'mariasOpReplyReply';

const bottomCommentOneText = 'bottomCommentOneText';
const bottomCommentTwoText = 'bottomCommentTwoText';


describe("Page statuses and bottom comments  TyT602AKK73", () => {

  it("Initialize people", () => {
    everyonesBrowsers = new TyE2eTestBrowser(wdioBrowser);
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
    mariasTopicUrl = mariasBrowser.getUrl();
  });

  it("It starts in status New, with a problem icon", () => {
    mariasBrowser.waitForVisible('.dw-p-ttl .icon-attention-circled.dw-clickable');
  });

  it("Maria changes status to Planned", () => {
    mariasBrowser.topic.setDoingStatus('Planned');  // meta #post-2
  });

  it("... the icon changes to check-dashed", () => {
    mariasBrowser.waitForVisible('.dw-p-ttl .icon-check-dashed.dw-clickable');
  });

  it("She changes status to Started", () => {
    mariasBrowser.topic.setDoingStatus('Started');  // meta #post-3
  });

  it("... the icon changes to check-empty", () => {
    mariasBrowser.waitForVisible('.dw-p-ttl .icon-check-empty.dw-clickable');
  });

  it("Changes status to Done", () => {
    mariasBrowser.topic.setDoingStatus('Done');   // meta #post-4
  });

  it("... the icon changes to a check mark", () => {
    mariasBrowser.waitForVisible('.dw-p-ttl .icon-check.dw-clickable');
  });

  it("She sets status New again", () => {
    mariasBrowser.topic.setDoingStatus('New');   // meta #post-5
  });

  it("... the problem icon is back", () => {
    mariasBrowser.waitForVisible('.dw-p-ttl .icon-attention-circled.dw-clickable');
  });

  it("Four status change events appear (after page refresh)", () => {
    mariasBrowser.topic.refreshUntilPostNrAppears(5, { isMetaPost: true }); // [2PKRRSZ0]
    mariasBrowser.topic.waitForPostNrVisible(5);  // 2, 3, 4 an 5  (1 is the orig post)
  });

  it("... with the correct text contents", () => {
    mariasBrowser.topic.assertMetaPostTextMatches(2, 'marked this topic as Planned');
    mariasBrowser.topic.assertMetaPostTextMatches(3, 'marked this topic as Started');
    mariasBrowser.topic.assertMetaPostTextMatches(4, 'marked this topic as Done');
    mariasBrowser.topic.assertMetaPostTextMatches(5, 'marked this topic as New');
  });

});


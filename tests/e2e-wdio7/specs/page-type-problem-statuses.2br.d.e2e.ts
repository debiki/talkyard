/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import server from '../utils/server';
import * as make from '../utils/make';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';

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

  it("Initialize people", async () => {
    everyonesBrowsers = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    strangersBrowser = everyonesBrowsers;
    mariasBrowser = everyonesBrowsers;
    michaelsBrowser = everyonesBrowsers;
    owensBrowser = everyonesBrowsers;
    maria = make.memberMaria();
    michael = make.memberMichael();
    owen = make.memberOwenOwner();
  });

  it("Import a site", async () => {
    const site: SiteData = make.forumOwnedByOwen('pgstbc', { title: "Emb Cmts Disc Id Test" });
    site.members.push(maria);
    site.members.push(michael);
    idAddress = await server.importSiteData(site);
    siteId = idAddress.id;
  });

  it("Maria logs in", async () => {
    await mariasBrowser.go2(idAddress.origin);
    await mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
    await mariasBrowser.disableRateLimits();
  });

  it("She posts a topic, type Problem", async () => {
    await mariasBrowser.complex.createAndSaveTopic({
            type: c.TestPageRole.Problem, title: "Marias Problem Title",
            body: "Marias Problem Text" });
    mariasTopicUrl = await mariasBrowser.getUrl();
  });

  it("It starts in status New, with a problem icon", async () => {
    await mariasBrowser.waitForVisible('.dw-p-ttl .icon-attention-circled.dw-clickable');
  });

  it("Maria changes status to Planned", async () => {
    await mariasBrowser.topic.setDoingStatus('Planned');  // meta #post-2
  });

  it("... the icon changes to check-dashed", async () => {
    await mariasBrowser.waitForVisible('.dw-p-ttl .icon-check-dashed.dw-clickable');
  });

  it("She changes status to Started", async () => {
    await mariasBrowser.topic.setDoingStatus('Started');  // meta #post-3
  });

  it("... the icon changes to check-empty", async () => {
    await mariasBrowser.waitForVisible('.dw-p-ttl .icon-check-empty.dw-clickable');
  });

  it("Changes status to Done", async () => {
    await mariasBrowser.topic.setDoingStatus('Done');   // meta #post-4
  });

  it("... the icon changes to a check mark", async () => {
    await mariasBrowser.waitForVisible('.dw-p-ttl .icon-check.dw-clickable');
  });

  it("She sets status New again", async () => {
    await mariasBrowser.topic.setDoingStatus('New');   // meta #post-5
  });

  it("... the problem icon is back", async () => {
    await mariasBrowser.waitForVisible('.dw-p-ttl .icon-attention-circled.dw-clickable');
  });

  it("Four status change events appear (after page refresh)", async () => {
    await mariasBrowser.topic.refreshUntilPostNrAppears(5, { isMetaPost: true }); // [2PKRRSZ0]
    await mariasBrowser.topic.waitForPostNrVisible(5);  // 2, 3, 4 an 5  (1 is the orig post)
  });

  it("... with the correct text contents", async () => {
    await mariasBrowser.topic.assertMetaPostTextMatches(2, 'marked this topic as Planned');
    await mariasBrowser.topic.assertMetaPostTextMatches(3, 'marked this topic as Started');
    await mariasBrowser.topic.assertMetaPostTextMatches(4, 'marked this topic as Done');
    await mariasBrowser.topic.assertMetaPostTextMatches(5, 'marked this topic as New');
  });

});


/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
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

let idAddress: IdAddress;
let siteId: any;

const mariasOpReply = 'mariasOpReply';
const mariasOpReplyReply = 'mariasOpReplyReply';

const bottomCommentOneText = 'bottomCommentOneText';
const bottomCommentTwoText = 'bottomCommentTwoText';


describe("page-type-discussion-progress.1br.d  TyTPATYDISC", () => {

  it("Initialize people", async () => {
    everyonesBrowsers = new TyE2eTestBrowser(wdioBrowserA, 'brA');
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
    await server.skipLimits(siteId, { rateLimits: true });
  });

  it("Maria logs in", async () => {
    await mariasBrowser.go2(idAddress.origin);
    await mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  it("She posts a topic, type Discussion", async () => {
    await mariasBrowser.complex.createAndSaveTopic({
            type: c.TestPageRole.Discussion, title: "Marias Topic Title",
            body: "Marias Topic Text" });
  });

  it("Closes", async () => {
    await mariasBrowser.topic.closeTopic();
  });

  it("... then reopens", async () => {
    await mariasBrowser.topic.reopenTopic();
  });

  it("Two status change events appear (after page refresh)", async () => {
    await mariasBrowser.topic.refreshUntilPostNrAppears(3, { isMetaPost: true }); // [2PKRRSZ0]
    assert.eq(c.FirstReplyNr, 2);
    await mariasBrowser.topic.waitForPostNrVisible(2); // status post 1 (close)
    await mariasBrowser.topic.waitForPostNrVisible(3); // status post 2 (reopen)
  });

  it("... with the correct text contents", async () => {
    await mariasBrowser.topic.assertMetaPostTextMatches(2, 'closed');
    await mariasBrowser.topic.assertMetaPostTextMatches(3, 'reopened');
  });

  it("Maria posts a progress reply", async () => {
    // c.FirstReplyNr + 2 = #post-4
    await mariasBrowser.complex.addProgressReply(bottomCommentOneText);
  });

  it("Changes status to Closed", async () => {
    // c.FirstReplyNr + 3 = #post-5
    await mariasBrowser.topic.closeTopic();
  });

  it("Posts an Orig Post reply", async () => {
    // c.FirstReplyNr + 4 = #post-6
    await mariasBrowser.complex.replyToOrigPost(mariasOpReply);
  });

  it("... and a reply to the reply", async () => {
    // c.FirstReplyNr + 5 = #post-7
    await mariasBrowser.complex.replyToPostNr(6, mariasOpReplyReply);
  });

  it("Changes status to Open", async () => {
    await mariasBrowser.topic.reopenTopic();   // event #post-8
  });

  it("Posts another progress reply", async () => {
    await mariasBrowser.complex.addProgressReply(bottomCommentTwoText);  // #post-9
  });

  it("... it appears", async () => {
    // Post 8 is a meta post, not yet visible.
    // If this isn't done before refreshUntilPostNrAppears() below,  [refresh_race]
    // then the reload might happen to soon, somehow leaving the comment
    // in draft status (and breaking the test).
    await mariasBrowser.topic.waitForPostAssertTextMatches(9, bottomCommentTwoText);
  });

  it("The posts has the correct contents", async () => {
    // currently needed, so event posts will appear [2PKRRSZ0]
    await mariasBrowser.topic.refreshUntilPostNrAppears(8, { isMetaPost: true });
    // Also takes a while for the server to refresh its cache: [refresh_race]
    await mariasBrowser.topic.refreshUntilPostNrAppears(9);

    await mariasBrowser.topic.assertMetaPostTextMatches(8, 'reopened');
  });

  it("Everything is in the correct order", async () => {
    await mariasBrowser.topic.assertPostOrderIs([  //  CROK  CODE REVIEW DONE OK
        c.TitleNr,
        c.BodyNr,
        6,   // the orig post reply gets placed first
        7,   // orig post reply reply
        2,   // closed
        3,   // reopened
        4,   // progress comment
        5,   // closed
        8,   // reopened
        9]); // progress comment
  });

  it("Michael may not change page status, not his page", async () => {
    assert.ok(await mariasBrowser.topic.canCloseOrReopen(), 'canCloseOrReopen'); // ttt
    await mariasBrowser.topbar.clickLogout();
    await michaelsBrowser.complex.loginWithPasswordViaTopbar(michael);
    assert.not(await michaelsBrowser.topic.canCloseOrReopen());
  });

  it("Owen can, he's admin", async () => {
    await michaelsBrowser.topbar.clickLogout();
    await owensBrowser.complex.loginWithPasswordViaTopbar(owen);
    assert.ok(await owensBrowser.topic.canCloseOrReopen());
    await owensBrowser.topic.closeTopic();
  });

});


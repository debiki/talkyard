/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('../utils/ty-assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import make = require('../utils/make');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

declare var browserA: any;
declare var browserB: any;

let richBrowserA;
let richBrowserB;
let maria: Member;
let mariasBrowser;
let michael: Member;
let michaelsBrowser;
let strangersBrowser;

let idAddress;
let forumTitle = "Delete Messages Forum";

let siteId;

const mariasMessageTitle = 'mariasMessageTitle';
const mariasMessageText = 'mariasMessageText';
let mariasMessagePageId: string;

const michaelsAnswer = 'michaelsAnswer';
const mariasReplyToMichael = 'mariasReplyToMichael';
const mariasExtraReply = 'mariasExtraReply';
const michaelsLastReply = 'michaelsLastReply';

describe("direct-messages-delete.2browsers.test.ts  TyT5033FKSNS57", () => {

  it("initialize people", () => {
    richBrowserA = _.assign(browserA, pagesFor(browserA));
    richBrowserB = _.assign(browserB, pagesFor(browserB));

    michael = make.memberMichael();
    // New members cannot send direct messages.
    maria = make.memberMaria({ trustLevel: c.TestTrustLevel.FullMember });

    mariasBrowser = richBrowserA;
    michaelsBrowser = richBrowserB;
    strangersBrowser = richBrowserB;
  });

  it("import a site", () => {
    let site: SiteData = make.forumOwnedByOwen('formal-priv-msg', { title: forumTitle });
    site.settings.allowGuestLogin = true;
    site.settings.requireVerifiedEmail = false;

    site.members.push(michael);
    site.members.push(maria);
    idAddress = server.importSiteData(site);
    siteId = idAddress.id;
  });


  // Generate private message discussion
  // ------------------------------------------------------

  it("Maria goes to Michael's profile page", () => {
    mariasBrowser.userProfilePage.openActivityFor(michael.username, idAddress.origin);
  });

  it("... logs in via topbar", () => {
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  it("... sends a formal private message", () => {
    mariasBrowser.userProfilePage.clickSendMessage();
    mariasBrowser.editor.editTitle(mariasMessageTitle);
    mariasBrowser.editor.editText(mariasMessageText);
    mariasBrowser.editor.saveWaitForNewPage();
    mariasBrowser.assertPageTitleMatches(mariasMessageTitle);
    mariasBrowser.assertPageBodyMatches(mariasMessageText);
    mariasMessagePageId = mariasBrowser.getPageId();
  });

  let emailToMichael: EmailSubjectBody;

  it("Michael gets a notf email  TyT603KDTP74", () => {
    emailToMichael = server.waitUntilLastEmailMatches(
        siteId, michael.emailAddress, [mariasMessageTitle, mariasMessageText],
        michaelsBrowser).matchedEmail;
  });

  it("... clicks a notf link", () => {
    const replyNotfLink = utils.findFirstLinkToUrlIn(
        // Currently the link uses the page id, not url slug.
        // So, not:  + firstUpsertedPage.urlPaths.canonical
        // Instead,  /-1:
        `https?://.*/-${mariasMessagePageId}`, emailToMichael.bodyHtmlText);
    michaelsBrowser.go2(replyNotfLink);
  });

  it("... logs in", () => {
    michaelsBrowser.loginDialog.loginWithPassword(michael);
  });

  it("Michael replies", () => {
    michaelsBrowser.complex.replyToOrigPost(michaelsAnswer);
  });

  it("Maria sees the reply", () => {
    mariasBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);
  });

  it("... replies", () => {
    mariasBrowser.complex.replyToPostNr(c.FirstReplyNr, mariasReplyToMichael);
  });

  it("... Michael sees her reply", () => {
    michaelsBrowser.topic.waitForPostNrVisible(c.FirstReplyNr + 1);
  });

  it("Michael and Maria can delete their own replies", () => {
    assert.ok(michaelsBrowser.topic.canDeletePost(c.FirstReplyNr));
    assert.ok(mariasBrowser.topic.canDeletePost(c.FirstReplyNr + 1));
  });

  it("... but not each other's replies  TyT05GKRD45", () => {
    assert.not(michaelsBrowser.topic.canDeletePost(c.FirstReplyNr + 1));
    assert.not(mariasBrowser.topic.canDeletePost(c.FirstReplyNr));
  });

  it("Maria deletes her reply   TyT6036SKSSP", () => {
    mariasBrowser.topic.deletePost(c.FirstReplyNr + 1);
  });

  it("Maria reloads the page", () => {
    mariasBrowser.refresh();
    mariasBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);
    assert.ok(mariasBrowser.topic.isPostNrVisible(c.FirstReplyNr)); // tests the test
    assert.not(mariasBrowser.topic.isPostNrVisible(c.FirstReplyNr + 1));
  });

  it("She posts another reply — there should be two replies, after all, she thinks", () => {
    // This previously didn't work — there was an error, when
    // encountering the deleted post = undefined, in sortPostNrsInPlaceByTime().
    mariasBrowser.complex.replyToPostNr(c.FirstReplyNr, mariasExtraReply);
  });

  it("... works fine, although there're deleted posts above", () => {
    // c.FirstReplyNr + 1  got deleted, so next nr is  +2.
    mariasBrowser.topic.waitForPostNrVisible(c.FirstReplyNr + 2);
  });

  it("Michael tries to reply to the deleted post  TyT6026RSP3J", () => {
    michaelsBrowser.complex.replyToPostNr(c.FirstReplyNr + 1, "this won't work");
  });

  it("... there's an error", () => {
    michaelsBrowser.serverErrorDialog.waitForCannotReplyPostDeletedError();
    michaelsBrowser.serverErrorDialog.close();
  });

  it("... Michael cancels the reply to the deleted post", () => {
    // BUG [063KRTL64] cannot close the editor — the server replies
    // 403 Forbidden [TyEM0REPLY_], so the save-draft ok callback never gets invoked.
    //michaelsBrowser.editor.closeIfOpen();
    // Instead:
    michaelsBrowser.refresh();
  });

  it("Michael can post other replies though", () => {
    // This previously didn't work — there was an error, when
    // encountering the deleted post = undefined, in sortPostNrsInPlaceByTime().
    michaelsBrowser.complex.replyToOrigPost(michaelsLastReply);
  });

  it("... works fine", () => {
    michaelsBrowser.topic.waitForPostAssertTextMatches(
        c.FirstReplyNr + 3, michaelsLastReply);
  });

  it("... Maria sees this last reply too", () => {
    mariasBrowser.topic.waitForPostAssertTextMatches(
        c.FirstReplyNr + 3, michaelsLastReply);
  });

});


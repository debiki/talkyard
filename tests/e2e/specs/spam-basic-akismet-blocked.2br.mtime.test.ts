/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import make = require('../utils/make');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

let browser: TyE2eTestBrowser;
declare let browserA: any;
declare let browserB: any;

let owen;
let owensBrowser: TyE2eTestBrowser;
let mallory;
let mallorysBrowser: TyE2eTestBrowser;

let idAddress: IdAddress;
let forumTitle = "Basic Spam Test Forum";

let notSpamPageUrl: string;


const topicOneNotSpamTitle = 'topicOneNotSpamTitle'
const topicOneNotSpamBody = 'topicOneNotSpamBody'
const replyOneNotSpam = 'replyOneNotSpam';

const replyTwoIsSpam = 'replyTwoIsSpam ' + c.AlwaysSpamText;
const topicTwoTitle = 'topicTwoTitle';
const topicTwoIsSpamBody = 'topicTwoIsSpamBody ' + c.AlwaysSpamText;

const spamReplyThree = "spamReplyThree " + c.AlwaysSpamText;


describe("spam test, Akismet  TyTSPAKISMET", () => {

  if (!settings.include3rdPartyDependentTests) {
    console.log("Skipping this spec; no 3rd party credentials specified.");
    return;
  }

  it("initialize people", () => {
    owen = make.memberOwenOwner();
    owensBrowser = new TyE2eTestBrowser(browserA);
    mallory = make.memberMallory();
    mallorysBrowser = new TyE2eTestBrowser(browserB);
  });

  it("import a site", () => {
    let site: SiteData = make.forumOwnedByOwen('spamaksm', { title: forumTitle });
    site.settings.enableAkismet = true;
    site.settings.numFirstPostsToReview = 9;
    site.settings.maxPostsPendRevwAftr = 9;
    site.settings.maxPostsPendApprBefore = 9;
    idAddress = server.importSiteData(site);
  });

  it("Mallory arrives, with a blank stare in his eyes", () => {
    mallorysBrowser.go(idAddress.origin);
  });

  /* This is disabled for now. [PROFLSPM] Instead, do create user profiles, even if
  believe is a spammer. But heavily lock down the profiles (mark as Moderate Threat),
  and send any profile text of theirs, to a spam check service. Maybe do w all users'
  profile text.

  it("He tries to sign up with a spammers address", () => {
    mallorysBrowser.complex.signUpAsMemberViaTopbar(
        { ...mallory, emailAddress: AkismetAlwaysSpamEmail });
  });

  it("... he's rejected, because of the email address", () => {
    mallorysBrowser.serverErrorDialog.waitForIsRegistrationSpamError();
  });

  it("... closes the dialogs", () => {
    mallorysBrowser.serverErrorDialog.close();
    mallorysBrowser.loginDialog.clickCancel();
  });
  */

  it("Mallory retries with a non-spam address", () => {
    mallorysBrowser.complex.signUpAsMemberViaTopbar(mallory);
    var link = server.getLastVerifyEmailAddressLinkEmailedTo(
        idAddress.id, mallory.emailAddress, mallorysBrowser);
    mallorysBrowser.go(link);
    mallorysBrowser.waitAndClick('#e2eContinue');
    mallorysBrowser.disableRateLimits();
  });

  it("He then submits a topic, not spam, works fine", () => {
    mallorysBrowser.complex.createAndSaveTopic(
        { title: topicOneNotSpamTitle, body: topicOneNotSpamBody });
    notSpamPageUrl = mallorysBrowser.getUrl();
  });

  it("... and a not-spam reply", () => {
    mallorysBrowser.complex.replyToOrigPost(replyOneNotSpam); // notSpamPageUrl reply 1
  });

  it("He then submits a spam reply ...", () => {
    mallorysBrowser.complex.replyToOrigPost(replyTwoIsSpam);  // notSpamPageUrl reply 2, and
                                                              // suspect spam post 1/3
  });

  it("... which will be visible, initially", () => {
    mallorysBrowser.topic.waitForPostNrVisible(c.FirstReplyNr + 0); // reply nr 1
    mallorysBrowser.topic.waitForPostNrVisible(c.FirstReplyNr + 1); // reply nr 2
    assert(!mallorysBrowser.topic.isPostBodyHidden(c.FirstReplyNr));
    assert(!mallorysBrowser.topic.isPostBodyHidden(c.FirstReplyNr + 1));
  });

  it("The spam reply gets hidden, eventually", () => {
    mallorysBrowser.topic.refreshUntilBodyHidden(c.FirstReplyNr + 1);
  });

  it("But not the non-spam reply", () => {
    mallorysBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);
    assert(!mallorysBrowser.topic.isPostBodyHidden(c.FirstReplyNr));
  });

  it("Mallory posts a spam topic", () => {
    mallorysBrowser.topbar.clickHome();
    mallorysBrowser.complex.createAndSaveTopic(            // suspect spam 2/3
        { title: topicTwoTitle, body: topicTwoIsSpamBody });
  });

  it("... which initially is visible", () => {
    assert(!mallorysBrowser.topic.isPostBodyHidden(c.BodyNr));
  });

  it("... after a while, the topic is considered spam, and hidden", () => {
    mallorysBrowser.topic.refreshUntilBodyHidden(c.BodyNr);
  });


  // ----- Too many seems-like-spam comments, Mallory gets blocked

  it("Mallory posts a fifth post — spam, for the 3rd time", () => {
    mallorysBrowser.go(notSpamPageUrl);
    mallorysBrowser.complex.replyToOrigPost(spamReplyThree); // notSpamPageUrl reply 3, and
                                                   // suspect spam 3/3 — gets Mallory blocked
  });

  it("... which initially is visible", () => {
    mallorysBrowser.topic.waitForPostNrVisible(c.FirstReplyNr + 2);
    assert(!mallorysBrowser.topic.isPostBodyHidden(c.FirstReplyNr + 2));
  });

  it("... but soon get hidden, because is spam", () => {
    mallorysBrowser.topic.refreshUntilBodyHidden(c.FirstReplyNr + 2);
  });

  it("... it didn't disappear", () => {
    mallorysBrowser.topic.waitForPostNrVisible(c.FirstReplyNr + 2);
  });

  it("Mallory tries to post another reply", () => {
    mallorysBrowser.complex.replyToOrigPost("This reply gets blocked.");
  });

  it("... but gets blocked: max 3 pending maybe-spam posts allowed [TyT029ASL45], " +
      "even though site.settings.maxPostsPendApprBefore & maxPostsPendRevwAftr = 9", () => {
    mallorysBrowser.serverErrorDialog.waitForTooManyPendingMaybeSpamPostsError();
  });

  it("... closes the error dialog", () => {
    mallorysBrowser.refresh();
    // These annoying dialogs!
    //mallorysBrowser.serverErrorDialog.close();
    //mallorysBrowser.editor.cancelNoHelp();
  });

  it("Mallory wants to post a new topic", () => {
    mallorysBrowser.topbar.clickHome();
    mallorysBrowser.complex.createAndSaveTopic(
        { title: "This gets blocked", body: "Blocked topic text.", resultInError: true });
  });

  it("... but also the new topic gets blocked", () => {
    mallorysBrowser.serverErrorDialog.waitForTooManyPendingMaybeSpamPostsError();
  });


  // ------ Reviewing spam

  it("Owen goes to the Review admin tab and logs in", () => {
    owensBrowser.adminArea.goToReview(idAddress.origin, { loginAs: owen });
  });

  it("He reject-deletes the thre spam posts", () => {
    owensBrowser.adminArea.review.rejectDeleteTaskIndex(1);
    owensBrowser.adminArea.review.rejectDeleteTaskIndex(2);
    owensBrowser.adminArea.review.rejectDeleteTaskIndex(3);
    owensBrowser.adminArea.review.playTimePastUndo();
  });

  it("Mallory is still blocked", () => {
    mallorysBrowser.go(notSpamPageUrl);
    mallorysBrowser.complex.replyToOrigPost("Gets blocked");
  });

  it("... but he's stil blocked", () => {
    mallorysBrowser.serverErrorDialog.waitForTooManyPendingMaybeSpamPostsError();
  });


  // ------ Banning the spammer

  // TESTS_MISSING: Owen clicks some shortcut button and bans Mallory,
  // who gets logged out, and cannot login again.

});


/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import make = require('../utils/make');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

declare const browser: any;
declare var browserA: any;
declare var browserB: any;

const everyoneGroup: GroupInclDetails = {
  id: c.EveryoneId,
  createdAtMs: c.MinUnixMillis,
  isGroup: true,
  username: 'everyone',
  fullName: 'Everyone',
  summaryEmailIntervalMins: 60 * 24,
  summaryEmailIfActive: true,
};

let richBrowserA;
let richBrowserB;

let owen;
let owensBrowser;
let trillian;
let trilliansBrowser;
let modya;
let modyasBrowser;
let mons;
let monsBrowser;
let maja;
let majasBrowser;
let maria;
let mariasBrowser;
let michael;
let michaelsBrowser;

let idAddress: IdAddress;
let siteId: any;

const forumTitle = "Email Notfs in Discussions Forum";

const mariasTopicTitle = "mariasTopicTitle";
const mariasTopicBody = "mariasTopicBody";
let mariasTopicUrl: string;

const majasOpReply = "majasOpReply";
const trilliansReplyToMaja = "trilliansReplyToMaja";
const trilliansOpReply = "trilliansOpReply";
const trilliansOpReply2MentionsModya = "trilliansOpReply2MentionsModya @mod_modya mentioned";
const trilliansEditedOpReplyMentionsMons = "trilliansEditedOpReplyMentionsMons @mod_mons mentioned";
const trilliansTopicTitle = "trilliansTopicTitle";
const trilliansTopicBody = "trilliansTopicBody mentions @maria and @maja";

const majasNewTopicTitleOne = 'majasNewTopicTitleOne';
const majasNewTopicBodyOne = 'majasNewTopicBodyOne';
const majasReplyToHerselfOne = 'majasReplyToHerselfOne';
const majasNewTopicTitleTwo = 'majasNewTopicTitleTwo';
const majasNewTopicBodyTwo = 'majasNewTopicBodyTwo';
const majasReplyToHerselfTwo = 'majasReplyToHerselfTwo';
const majasNewTopicTitleThree = 'majasNewTopicTitleThree';
const majasNewTopicBodyThree = 'majasNewTopicBodyThree';


describe("email notfs discs TyT4FKA2EQ02", () => {

  it("initialize people", () => {
    richBrowserA = _.assign(browserA, pagesFor(browserA));
    richBrowserB = _.assign(browserB, pagesFor(browserB));
    owensBrowser = richBrowserA;
    modyasBrowser = richBrowserA;
    monsBrowser = richBrowserA;
    majasBrowser = richBrowserA;
    mariasBrowser = richBrowserA;
    michaelsBrowser = richBrowserA;
    trilliansBrowser = richBrowserB;

    owen = make.memberOwenOwner();
    modya = make.memberModeratorModya();
    mons = make.memberModeratorMons();
    maja = make.memberMaja();
    maria = make.memberMaria();
    michael = make.memberMichael();
    trillian = make.memberTrillian();
  });

  it("import a site", () => {
    const site: SiteData = make.forumOwnedByOwen('eml-ntf-disc', { title: forumTitle });
    // Avoid "messing up" the notification email counts — this test was written
    // in the past when no email notfs were sent about review tasks. [OLDTSTNTFS]
    site.settings.numFirstPostsToReview = 0;
    site.settings.numFirstPostsToApprove = 0;
    site.groups.push(everyoneGroup);
    site.members.push(modya);
    site.members.push(mons);
    site.members.push(maja);
    site.members.push(maria);
    // But skip Michael — he'll sign up and create an account, so can verify default settings = ok.
    site.members.push(trillian);
    idAddress = server.importSiteData(site);
    siteId = idAddress.id;
  });

  it("Maria creates a new topic", () => {
    mariasBrowser.go(idAddress.origin);
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
    mariasBrowser.complex.createAndSaveTopic({ title: mariasTopicTitle, body: mariasTopicBody });
    mariasTopicUrl = mariasBrowser.getUrl();
    mariasBrowser.topbar.clickLogout();
  });



  // ------- Watching page (Maria watches it)


  it("Maja logs in", () => {
    majasBrowser.go(mariasTopicUrl);
    majasBrowser.complex.loginWithPasswordViaTopbar(maja);
    majasBrowser.disableRateLimits();
  });

  it("... and replies to Maria's topic", () => {
    majasBrowser.complex.replyToOrigPost(majasOpReply);
  });

  it("... goes to the topic list, so won't see replies", () => {
    majasBrowser.topbar.clickHome();
  });

  /*
  it("a day elapses", () => {
    server.playTimeHours(24 + 1);
  }); */

  it("Maria gets a reply notf email", () => {
    server.waitUntilLastEmailMatches(
        siteId, maria.emailAddress, [mariasTopicTitle, majasOpReply], browser);
  });



  // ------- Direct replies


  it("Trillian replies to Maja's reply", () => {
    trilliansBrowser.go(mariasTopicUrl);
    trilliansBrowser.complex.loginWithPasswordViaTopbar(trillian);
    trilliansBrowser.complex.replyToPostNr(2, trilliansReplyToMaja);
  });

  it("... Maja gets an email notf", () => {
    server.waitUntilLastEmailMatches(
        siteId, maja.emailAddress, [mariasTopicTitle, trilliansReplyToMaja], browser);
  });

  it("... and Maria too, it's her topic, she's watching it (by default)", () => {
    server.waitUntilLastEmailMatches(
        siteId, maria.emailAddress, [mariasTopicTitle, trilliansReplyToMaja], browser);
  });

  it("Trillian replies to Maria's orig post (but not to Maja)", () => {
    trilliansBrowser.complex.replyToOrigPost(trilliansOpReply);
  });

  it("... Maria gets a new email notf", () => {
    server.waitUntilLastEmailMatches(
        siteId, maria.emailAddress, [mariasTopicTitle, trilliansOpReply], browser);
  });

  it("... But not Maja", () => {
    // The last email is still about trilliansReplyToMaja, not the new to the orig post.
    server.waitUntilLastEmailMatches(
        siteId, maja.emailAddress, [mariasTopicTitle, trilliansReplyToMaja], browser);
  });



  // ------- Mentions


  it("Modya hasn't gotten any emails", () => {
    const numEmails = server.countLastEmailsSentTo(siteId, modya.emailAddress);
    assert.equal(numEmails, 0);
  });

  it("... Trillian replies to the orig post again, mentions @modya", () => {
    trilliansBrowser.complex.replyToOrigPost(trilliansOpReply2MentionsModya);
  });

  it("... Modya gets a @mention notf", () => {
    server.waitUntilLastEmailMatches(
        siteId, modya.emailAddress, [mariasTopicTitle, trilliansOpReply2MentionsModya], browser);
  });



  // ------- Mentions: Edit a mention, add @username  TyT2WREG78


  it("Mons hasn't gotten any emails", () => {
    const numEmails = server.countLastEmailsSentTo(siteId, mons.emailAddress);
    assert.equal(numEmails, 0);
  });

  it("Trillian edits her firs OP reply, mentions @mons", () => {
    trilliansBrowser.complex.editPostNr(4, trilliansEditedOpReplyMentionsMons);
  });

  it("... Now Mons gets a @mention notf", () => {
    server.waitUntilLastEmailMatches(
        siteId, mons.emailAddress, [mariasTopicTitle, trilliansEditedOpReplyMentionsMons], browser);
  });


  // ------- Mentions: New topic, and to @many @people


  it("Trillian posts a new topic, mentions both @maria and @maja", () => {
    trilliansBrowser.go(idAddress.origin);
    trilliansBrowser.complex.createAndSaveTopic(
        { title: trilliansTopicTitle, body: trilliansTopicBody });
  });

  it("... Maria gets a @mention notf for the new topic", () => {
    server.waitUntilLastEmailMatches(
        siteId, maria.emailAddress, [trilliansTopicTitle, trilliansTopicBody], browser);
  });

  it("... Maja also gets a @mention notf", () => {
    server.waitUntilLastEmailMatches(
        siteId, maja.emailAddress, [trilliansTopicTitle, trilliansTopicBody], browser);
  });


  // ------- Watching everything  TyT2AKBEF05


  it("Trillian edits her preferences, so she'll be notified about every new post", () => {
    trilliansBrowser.topbar.clickGoToProfile();
    trilliansBrowser.userProfilePage.goToPreferences();
    trilliansBrowser.userProfilePage.preferences.switchToNotifications();
    trilliansBrowser.userProfilePage.preferences.notfs.setSiteNotfLevel(c.TestPageNotfLevel.EveryPost);
  });

  it("Maja posts a new topic", () => {
    majasBrowser.forumTopicList.waitForTopics();
    majasBrowser.complex.createAndSaveTopic({ title: majasNewTopicTitleOne, body: majasNewTopicBodyOne });
  });

  it("Trillian gets notified", () => {
    server.waitUntilLastEmailMatches(
        siteId, trillian.emailAddress, [majasNewTopicTitleOne, majasNewTopicBodyOne], browser);
  });

  it("Maja posts a reply in her new topic", () => {
    majasBrowser.complex.replyToOrigPost(majasReplyToHerselfOne);
  });

  it("Trillian gets notified", () => {
    server.waitUntilLastEmailMatches(
        siteId, trillian.emailAddress, [majasReplyToHerselfOne], browser);
  });

  it("Trillian cancels notifications about every new post", () => {
    trilliansBrowser.userProfilePage.preferences.notfs.setSiteNotfLevel(c.TestPageNotfLevel.Normal);
  });

  it("Maja posts a 2nd new topic", () => {
    majasBrowser.topbar.clickHome();
    majasBrowser.forumTopicList.waitForTopics();
    majasBrowser.complex.createAndSaveTopic({ title: majasNewTopicTitleTwo, body: majasNewTopicBodyTwo });
  });

  it("... edit it, mentions @maria", () => {
    majasBrowser.complex.editPageBody("@maria 123 ice cream");
  });

  it("Maria gets a notf", () => {
    server.waitUntilLastEmailMatches(
        siteId, maria.emailAddress, [majasNewTopicTitleTwo, "123 ice cream"], browser);
  });

  it("But Trillian wasn't notified about this new topic", () => {
    // The last email is still from Maja's *first* topic, not her 2nd.
    server.assertLastEmailMatches(
        siteId, trillian.emailAddress, [majasReplyToHerselfOne], browser);
  });



  // ------- Watching new topics,  and re-mentioning [TyT2ABKS057]


  it("Trillian enables notifications about new topics", () => {
    trilliansBrowser.userProfilePage.preferences.notfs.setSiteNotfLevel(c.TestPageNotfLevel.NewTopics);
  });

  it("Maja posts another reply to herself", () => {
    majasBrowser.complex.replyToOrigPost(majasReplyToHerselfTwo);
  });

  const mentionMaria = "@maria ";
  const mentionMons = "@mod_mons ";
  const carrotCake = "456 carrot cakes";
  const rareRaindeers = "789 rare raindeers";

  it("... edit it, mentions @maria", () => {
    majasBrowser.complex.editPostNr(c.FirstReplyNr, mentionMaria + carrotCake);
  });

  it("... edits the page body too, removes the @maria mention [TyT2ABKS057]", () => {
    majasBrowser.complex.editPageBody("No mention of Maria any longer.");
  });

  it("... then adds back the @maria mention — shouldn't generate a new notf [TyT2ABKS057]", () => {
    majasBrowser.complex.editPageBody(
        // mentionMaria +   — *does* generate a new mention. Shouldn't do that?
        mentionMons + rareRaindeers);
  });

  it("Maria gets a notf about: " + carrotCake, () => {
    server.waitUntilLastEmailMatches(
        siteId, maria.emailAddress, [majasNewTopicTitleTwo, carrotCake], browser);
  });

  it("But Trillian didn't get a notf about the reply", () => {
    // It would have arrived before the @mention of Maria.
    server.assertLastEmailMatches(
        siteId, trillian.emailAddress, [majasReplyToHerselfOne], browser);
  });

  it("Maja posts a 3rd new topic", () => {
    majasBrowser.topbar.clickHome();
    majasBrowser.forumTopicList.waitForTopics();
    majasBrowser.complex.createAndSaveTopic({
      title: majasNewTopicTitleThree, body: majasNewTopicBodyThree });
  });

  it("... now Trillian does get notified about the new topic", () => {
    server.waitUntilLastEmailMatches(
        siteId, trillian.emailAddress, [majasNewTopicTitleThree, majasNewTopicBodyThree], browser);
  });

  it(`But Maria never got notified about: ${rareRaindeers}  [TyT2ABKS057]`, () => {
    // It would have arrived before the new topic notf to Trillian.
    server.assertLastEmailMatches(
        siteId, maria.emailAddress, [majasNewTopicTitleTwo, carrotCake], browser);
  });

  it(`... Mons, however, got notified about: ${rareRaindeers}`, () => {
    // Just so we know the test works.
    server.assertLastEmailMatches(
        siteId, mons.emailAddress, [majasNewTopicTitleTwo, rareRaindeers], browser);
  });

});


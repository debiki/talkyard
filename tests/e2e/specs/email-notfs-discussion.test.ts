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

const everyoneGroup: GroupInclDetails = {
  id: c.EveryoneId,
  isGroup: true,
  username: 'everyone',
  fullName: 'Everyone',
  summaryEmailIntervalMins: 60 * 24,
  summaryEmailIfActive: true,
};

let everyonesBrowsers;
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

describe("email notfs discs", () => {

  it("initialize people", () => {
    browser.perhapsDebugBefore();
    everyonesBrowsers = _.assign(browser, pagesFor(browser));
    owensBrowser = everyonesBrowsers;
    modyasBrowser = owensBrowser;
    monsBrowser = owensBrowser;
    majasBrowser = owensBrowser;
    mariasBrowser = owensBrowser;
    michaelsBrowser = owensBrowser;
    trilliansBrowser = owensBrowser;

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
    mariasTopicUrl = mariasBrowser.url().value;
    mariasBrowser.topbar.clickLogout();
  });


  // ------- Watching page (Maria watches it)

  it("Maja logs in", () => {
    majasBrowser.go(mariasTopicUrl);
    majasBrowser.complex.loginWithPasswordViaTopbar(maja);
  });

  it("... and replies to Maria's topic", () => {
    majasBrowser.complex.replyToOrigPost(majasOpReply);
  });

  /*
  it("a day elapses", () => {
    server.playTimeHours(24 + 1);
  }); */

  it("Maria gets a reply notf email", () => {
    server.waitUntilLastEmailMatches(
        siteId, maria.emailAddress, [mariasTopicTitle, majasOpReply], browser);
  });

  it("Maja logs out", () => {
    majasBrowser.topbar.clickLogout();
  });


  // ------- Direct replies

  it("Trillian replies to Maja's reply", () => {
    trilliansBrowser.complex.loginWithPasswordViaTopbar(trillian);
    trilliansBrowser.complex.replyToPostNr(2, trilliansReplyToMaja);
  });

  it("... Maja gets an email notf", () => {
    server.waitUntilLastEmailMatches(
        siteId, maja.emailAddress, [mariasTopicTitle, trilliansReplyToMaja], browser);
  });

  // BUG isn't watching
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
    assert(numEmails === 0);
  });

  it("... Trillian replies to the orig post again, mentions @modya", () => {
    trilliansBrowser.complex.replyToOrigPost(trilliansOpReply2MentionsModya);
  });

  it("... Modya gets a @mention notf", () => {
    server.waitUntilLastEmailMatches(
        siteId, modya.emailAddress, [mariasTopicTitle, trilliansOpReply2MentionsModya], browser);
  });


  // ------- Mentions: Edit a mention, add @username

  it("Mons hasn't gotten any emails", () => {
    const numEmails = server.countLastEmailsSentTo(siteId, mons.emailAddress);
    assert(numEmails === 0);
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


  // ------- Watching everything

  it("Trillian edits her preferences, so she'll be notified about all new topics", () => {
  });

  it("Maja posts a new topic", () => {
  });

  it("Trillian gets notified", () => {
  });

  it("Done", () => {
    everyonesBrowsers.perhapsDebug();
  });

});


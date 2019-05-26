/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import make = require('../utils/make');
import { buildSite } from '../utils/site-builder';
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

declare var browser: any;
declare var browserA: any;
declare var browserB: any;

let richBrowserA;
let richBrowserB;
let owen: Member;
let owensBrowser;
let mons: Member;
let monsBrowser;
let modya: Member;
let modyasBrowser;
let corax: Member;
let coraxBrowser;
let regina: Member;
let reginasBrowser;
let trillian: Member;
let trilliansBrowser;
let maja: Member;
let maria: Member;
let mariasBrowser;
let michael: Member;
let michaelsBrowser;
let mallory: Member;
let mallorysBrowser;
let strangersBrowser;

let siteIdAddress: IdAddress;
let siteId;

let forum: EmptyTestForum;

const topicTitle = 'topicTitle';


describe("group-mentions-built-in.2browsers  TyT4AWJL208R", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addEmptyForum({
      title: "Weird Usernames",
      members: undefined, // undefined = default = everyone
    });
    assert(builder.getSite() === forum.siteData);
    // Avoid "messing up" the notification email counts — this test was written
    // in the past when no email notfs were sent about review tasks. [OLDTSTNTFS]
    forum.siteData.settings.numFirstPostsToReview = 0;
    forum.siteData.settings.numFirstPostsToApprove = 0;

    trillian = make.memberTrillian();
    maja = make.memberMaja();
    forum.siteData.members.push(trillian);
    forum.siteData.members.push(maja);

    // Staff don't need high trust levels, it's enough to toggle is-moderator/admin on.
    forum.members.owen.trustLevel = c.TestTrustLevel.New;
    forum.members.modya.trustLevel = c.TestTrustLevel.New;

    forum.members.michael.trustLevel = c.TestTrustLevel.FullMember;
    forum.members.maria.trustLevel = c.TestTrustLevel.FullMember;
    maja.trustLevel = c.TestTrustLevel.Basic;
    forum.members.mallory.trustLevel = c.TestTrustLevel.New;

    siteIdAddress = server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
  });

  it("initialize people", () => {
    richBrowserA = _.assign(browserA, pagesFor(browserA));
    richBrowserB = _.assign(browserB, pagesFor(browserB));

    owen = forum.members.owen;
    owensBrowser = richBrowserA;
    mons = forum.members.mons;
    monsBrowser = richBrowserA;
    modya = forum.members.modya;
    modyasBrowser = richBrowserA;
    corax = forum.members.corax;
    coraxBrowser = richBrowserA;

    regina = forum.members.regina;
    reginasBrowser = richBrowserA;
    //trillian: see above
    //maja: see above
    michael = forum.members.michael;
    michaelsBrowser = richBrowserA;
    mallory = forum.members.mallory;
    mallorysBrowser = richBrowserA;
    strangersBrowser = richBrowserA;

    maria = forum.members.maria;
    mariasBrowser = richBrowserB;
  });

  it("Maria logs in", () => {
    mariasBrowser.go(siteIdAddress.origin);
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  let lastComment;
  let numExpectedEmailsTotal = 0;


  // ----- No one

  it("Maria posts a topic, mentions no one", () => {
    lastComment = "Zero helloes";
    numExpectedEmailsTotal += 0;
    mariasBrowser.complex.createAndSaveTopic({
      title: topicTitle,
      body: lastComment,
    });
  });

  it("... no one gets any notf", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.equal(num, 0, `Emails sent to: ${addrsByTimeAsc}`);
  });


  // ----- @admins

  it("Maria posts a comment, mentions admins (only Owen)", () => {
    lastComment = "Hello @admins";
    numExpectedEmailsTotal += 1;
    mariasBrowser.complex.replyToOrigPost(lastComment);
  });

  it("... Owen gets a notification", () => {
    server.waitUntilLastEmailMatches(siteId, owen.emailAddress, [topicTitle, lastComment], browser);
  });

  it("... and no one else", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.equal(num, numExpectedEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });


  // ----- @moderators

  const mariasCommentModsModyaMons = "Hello @moderators Modya and Mons";

  it("Maria mentions moderators (Modya, Mons)", () => {
    lastComment = mariasCommentModsModyaMons;
    numExpectedEmailsTotal += 2;
    mariasBrowser.complex.replyToOrigPost(lastComment);
  });

  it("... Modya and Mons get notifications", () => {
    server.waitUntilLastEmailMatches(siteId, modya.emailAddress, [topicTitle, lastComment], browser);
    server.waitUntilLastEmailMatches(siteId, mons.emailAddress, [topicTitle, lastComment], browser);
  });

  it("... and no one else", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.equal(num, numExpectedEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });

  it("Mons unsubs from notfs via email link  TyT7AKWB2LG", () => {
    const unsubLink = server.getLastUnsubscriptionLinkEmailedTo(siteId, mons.emailAddress, browser);
    monsBrowser.go(unsubLink);
    monsBrowser.unsubscribePage.confirmUnsubscription();
  });

  it("Mons logs in", () => {
    monsBrowser.go(siteIdAddress.origin);
    monsBrowser.complex.loginWithPasswordViaTopbar(mons);
  });

  it("... and sees 1 notf", () => {
    monsBrowser.topbar.waitForNumDirectNotfs(1);
  });

  it("Maria again mentions moderators", () => {
    lastComment = "Hello @moderators Modya, not Mons";
    numExpectedEmailsTotal += 1;  // just one more
    mariasBrowser.complex.replyToOrigPost(lastComment);
  });

  it("... now only Modya gets a notification *via email*", () => {
    // New, and old:
    server.waitUntilLastEmailMatches(siteId, modya.emailAddress, [topicTitle, lastComment], browser);
    server.waitUntilLastEmailMatches(siteId, mons.emailAddress, [topicTitle, mariasCommentModsModyaMons],
        browser);
  });

  it("... and no one else", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.equal(num, numExpectedEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });

  it("... but Mons does get a notf via the browser's UI", () => {
    monsBrowser.refresh();
    monsBrowser.topbar.waitForNumDirectNotfs(2);
  });


  // ----- @staff

  it("Maria mentions @staff", () => {
    lastComment = "Hi @staff: Modya, Owen, and Mons who gets no notf";
    numExpectedEmailsTotal += 2;
    mariasBrowser.complex.replyToOrigPost(lastComment);
  });

  it("... Modya and Owen get notifications *via email*", () => {
    server.waitUntilLastEmailMatches(
      siteId, modya.emailAddress, [topicTitle, lastComment], browser);
    server.waitUntilLastEmailMatches(
      siteId, owen.emailAddress, [topicTitle, lastComment], browser);
  });

  it("... and no one else", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.equal(num, numExpectedEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });

  it("... as usual, Mons gets a notf via the browser's UI", () => {
    monsBrowser.refresh();
    monsBrowser.topbar.waitForNumDirectNotfs(3);
  });


  // ----- @core_members

  it("Maria mentions @core_members (which doesn't include @staff)", () => {
    lastComment = "Hi @core_members: Corax and the-2-staff-still-subscribed";
    numExpectedEmailsTotal += 1 + 2;
    mariasBrowser.complex.replyToOrigPost(lastComment);
  });

  it("... Corax get notified via email", () => {
    const titleAndComment = [topicTitle, lastComment];
    server.waitUntilLastEmailMatches(siteId, corax.emailAddress, titleAndComment, browser);
  });

  it("... and the staff members — they're incl in the Core Members group (but Mons unsubd)", () => {
    const titleAndComment = [topicTitle, lastComment];
    server.waitUntilLastEmailMatches(siteId, modya.emailAddress, titleAndComment, browser);
    server.waitUntilLastEmailMatches(siteId, owen.emailAddress, titleAndComment, browser);
  });

  it("... and no one else", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.equal(num, numExpectedEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });


  // ----- @regular_members

  it("Maria mentions @regular_members (which includes @core_members and staff)", () => {
    lastComment = "Hi @regular_members: Regina and Corax";
    numExpectedEmailsTotal += 2 + 2;
    mariasBrowser.complex.replyToOrigPost(lastComment);
  });

  it("... Regina and Corax get notified via email", () => {
    server.waitUntilLastEmailMatches(siteId, regina.emailAddress, [topicTitle, lastComment], browser);
    server.waitUntilLastEmailMatches(siteId, corax.emailAddress, [topicTitle, lastComment], browser);
  });

  it("... and staff ", () => {
    const titleAndComment = [topicTitle, lastComment];
    server.waitUntilLastEmailMatches(siteId, modya.emailAddress, titleAndComment, browser);
    server.waitUntilLastEmailMatches(siteId, owen.emailAddress, titleAndComment, browser);
  });

  it("... and no one else", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.equal(num, numExpectedEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });


  // ----- @trusted_members

  it("Maria mentions @trusted_members (which includes @regular_members and @core_members)", () => {
    lastComment = "Hi @trusted_members: Trillian, Regina and Corax, and staff";
    numExpectedEmailsTotal += 3 + 2;
    mariasBrowser.complex.replyToOrigPost(lastComment);
  });

  it("... Trillian, Regina and Corax get notified via email", () => {
    server.waitUntilLastEmailMatches(siteId, trillian.emailAddress, [topicTitle, lastComment], browser);
    server.waitUntilLastEmailMatches(siteId, regina.emailAddress, [topicTitle, lastComment], browser);
    server.waitUntilLastEmailMatches(siteId, corax.emailAddress, [topicTitle, lastComment], browser);
  });

  it("... and staff, as usual", () => {
    const titleAndComment = [topicTitle, lastComment];
    server.waitUntilLastEmailMatches(siteId, modya.emailAddress, titleAndComment, browser);
    server.waitUntilLastEmailMatches(siteId, owen.emailAddress, titleAndComment, browser);
  });

  it("... and no one else", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.equal(num, numExpectedEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });


  // ----- @full_members

  it("Maria mentions @full_members (which includes higher trust levels)", () => {
    lastComment = "Hi all @full_members, wow so many";
    numExpectedEmailsTotal += 3 + 1  + 2;  // three trusted members and Michael,  + 3-1 staff
    mariasBrowser.complex.replyToOrigPost(lastComment);
  });

  it("... Michael, Trillian, Regina and Corax get notified via email", () => {
    server.waitUntilLastEmailMatches(siteId, michael.emailAddress, [topicTitle, lastComment], browser);
    server.waitUntilLastEmailMatches(siteId, trillian.emailAddress, [topicTitle, lastComment], browser);
    server.waitUntilLastEmailMatches(siteId, regina.emailAddress, [topicTitle, lastComment], browser);
    server.waitUntilLastEmailMatches(siteId, corax.emailAddress, [topicTitle, lastComment], browser);
  });

  it("... and the staff except for Mons", () => {
    const titleAndComment = [topicTitle, lastComment];
    server.waitUntilLastEmailMatches(siteId, modya.emailAddress, titleAndComment, browser);
    server.waitUntilLastEmailMatches(siteId, owen.emailAddress, titleAndComment, browser);
  });

  it("... and no one else — not Maria, although she's in @full_members: she's the poster", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.equal(num, numExpectedEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });

  const modyasTopicTitle = 'modyasTopicTitle';
  const monsFullMemberstMention = 'Very much hello all @full_members';

  it("Mons leaves, Modya logs in", () => {
    monsBrowser.topbar.clickLogout();
    modyasBrowser.complex.loginWithPasswordViaTopbar(modya);
  });

  it("Modya mentions full members", () => {
    lastComment = monsFullMemberstMention;
    numExpectedEmailsTotal += 5   + 3 - 2;  // -2 = mons and modya
    modyasBrowser.complex.createAndSaveTopic({ title: modyasTopicTitle, body: lastComment })
  });

  it("... now also Maria gets notified via email", () => {
    server.waitUntilLastEmailMatches(siteId, maria.emailAddress, [modyasTopicTitle, lastComment], browser);
  });

  it("... plus the other full members and up", () => {
    const titleAndComment = [modyasTopicTitle, lastComment];
    server.waitUntilLastEmailMatches(siteId, michael.emailAddress, titleAndComment, browser);
    server.waitUntilLastEmailMatches(siteId, trillian.emailAddress, titleAndComment, browser);
    server.waitUntilLastEmailMatches(siteId, regina.emailAddress, titleAndComment, browser);
    server.waitUntilLastEmailMatches(siteId, corax.emailAddress, titleAndComment, browser);
  });

  it("... and one staff member: only Owen, because Mons unsubd, and Modya sent the message", () => {
    const titleAndComment = [modyasTopicTitle, lastComment];
    server.waitUntilLastEmailMatches(siteId, owen.emailAddress, titleAndComment, browser);
  });

  it("... no one else", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.equal(num, numExpectedEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });


  /*  [REFACTORNOTFS]  @all_members notifies all members.
      Maybe sth like a mentions- alias that notifies only trust level new-memebers?

  // ----- @basic_members

  it("Maria mentions @basic_members", () => {
    lastComment = "Hi all @basic_members";
    numExpectedEmailsTotal += 1;  // only Maja
    mariasBrowser.complex.replyToOrigPost(lastComment);
  });

  it("... Maja gets notified", () => {
    server.waitUntilLastEmailMatches(siteId, maja.emailAddress, [topicTitle, lastComment], browser);
  });

  it("... and no one else", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.equal(num, numExpectedEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });


  // ----- @new_members

  it("Maria mentions @new_members", () => {
    lastComment = "Hi all @new_members";
    numExpectedEmailsTotal += 3;  // Mallory, + Owen and Modya
    mariasBrowser.complex.replyToOrigPost(lastComment);
  });

  it("... Mallory gets notified", () => {
    server.waitUntilLastEmailMatches(siteId, mallory.emailAddress, [topicTitle, lastComment], browser);
  });

  it("... plus the staff, who oddly enough have trust level New Member", () => {
    server.waitUntilLastEmailMatches(siteId, owen.emailAddress, [topicTitle, lastComment], browser);
    server.waitUntilLastEmailMatches(siteId, modya.emailAddress, [topicTitle, lastComment], browser);
  });

  it("... and no one else (right now, @new_members doesn't incl @basic_members ... hmm)", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.equal(num, numExpectedEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });  */

});


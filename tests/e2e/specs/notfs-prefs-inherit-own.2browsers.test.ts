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

let richBrowserA;
let richBrowserB;

let owen;
let owensBrowser;
let modya;
let modyasBrowser;
let maria;
let mariasBrowser;

let idAddress: IdAddress;
let siteId: any;

const forumTitle = "Notf Pref Inh Onw Content";
const SpecificCatName = 'SpecificCatName';

const TopicTitleOne = 'TopicTitleOne';
const TopicBodyOne = 'TopicBodyOne';
const RelyOneTriggersNotf = 'RelyOneTriggersNotf';
const ReplyTwoNoNotf = 'ReplyTwoNoNotf';

const TopicTitleTwo = 'TopicTitleTwo';
const TopicBodyTwo = 'TopicBodyTwo';

const TopicTwoReplyOneTriggersNotf = 'TopicTwoReplyOneTriggersNotf';
const TopicTwoReplyTwoMuted = 'TopicTwoReplyTwoMuted';

const TopicTitleThree = 'TopicTitleThree';
const TopicBodyThree = 'TopicBodyThree';

let numExpectedEmailsTotal = 0;

describe("notfs-prefs-inherit-own  TyT4RKK7Q2J", () => {

  it("initialize people", () => {
    richBrowserA = _.assign(browserA, pagesFor(browserA));
    richBrowserB = _.assign(browserB, pagesFor(browserB));
    owensBrowser = richBrowserA;
    modyasBrowser = richBrowserB;
    mariasBrowser = richBrowserB;

    owen = make.memberOwenOwner();
    modya = make.memberModeratorModya();
    maria = make.memberMaria();
  });

  it("import a site", () => {
    const site: SiteData = make.forumOwnedByOwen('notf-inh-own', { title: forumTitle });
    site.members.push(modya);
    site.members.push(maria);
    idAddress = server.importSiteData(site);
    siteId = idAddress.id;
  });


  it("Owen logs in", () => {
    owensBrowser.go(idAddress.origin + '/categories');
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
  });

  it("Creates a Specific category", () => {
    owensBrowser.complex.createCategory({ name: SpecificCatName });
    owensBrowser.forumCategoryList.openCategory(SpecificCatName);
  });


  // ------ Config whole site

  it("Maria goes to her notfs prefs", () => {
    mariasBrowser.go(idAddress.origin);
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
    mariasBrowser.userProfilePage.openPreferencesFor(maria.username);
    mariasBrowser.userProfilePage.preferences.switchToNotifications();
  });

  it("... and configs notfs about every post, for the whole site", () => {
    mariasBrowser.userProfilePage.preferences.notfs.setSiteNotfLevel(c.TestPageNotfLevel.EveryPost);
  });

  it("Owen posts a topic", () => {
    owensBrowser.complex.createAndSaveTopic({ title: TopicTitleOne, body: TopicBodyOne });
    numExpectedEmailsTotal += 1;  // notf to Maria
  });

  it("Maria get notified", () => {
    const titleBody = [TopicTitleOne, TopicBodyOne];
    server.waitUntilLastEmailMatches(siteId, maria.emailAddress, titleBody, browser);
    // BUG LIVE_NOTF  no MyMenu notf icon appears, althoug email sent  [NOTFTPCS]
  });

  it("... once, exactly", () => {
    assert.equal(server.countLastEmailsSentTo(siteId, maria.emailAddress), 1);
  });

  it("... but not Modya", () => {
    assert.equal(server.countLastEmailsSentTo(siteId, modya.emailAddress), 0);
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.equal(num, numExpectedEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });

  it("Owen posts a reply", () => {
    owensBrowser.complex.replyToOrigPost(RelyOneTriggersNotf);
    numExpectedEmailsTotal += 1;  // notf to Maria
  });

  it("... Maria get notified", () => {
    server.waitUntilLastEmailMatches(siteId, maria.emailAddress, [RelyOneTriggersNotf], browser);
    assert.equal(server.countLastEmailsSentTo(siteId, maria.emailAddress), 2);
  });

  it("... but not Modya", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.equal(num, numExpectedEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });


  // ------ Category pref overrides whole site pref

  it("Maria goes to the categories page", () => {
    mariasBrowser.go('/categories');
  });

  it("... configures notfs about new topics only, for the Specific category", () => {
    mariasBrowser.go('/categories');
    mariasBrowser.forumCategoryList.setCatNrNotfLevel(2, c.TestPageNotfLevel.NewTopics);
  });

  it("Owen posts a 2nd reply", () => {
    owensBrowser.complex.replyToOrigPost(ReplyTwoNoNotf);
    numExpectedEmailsTotal += 0;  // Maria no longer listens to EveryPost. So zero.
  });

  it("... and then a new topic", () => {
    owensBrowser.topbar.clickAncestor(SpecificCatName);
    owensBrowser.complex.createAndSaveTopic({ title: TopicTitleTwo, body: TopicBodyTwo });
    numExpectedEmailsTotal += 1;  // Maria does listens for new topics.
  });

  it("... Maria get notified about the new topic only — her cat prefs says topics only", () => {
    const titleAndBody = [TopicTitleTwo, TopicBodyTwo];
    server.waitUntilLastEmailMatches(siteId, maria.emailAddress, titleAndBody, browser);
    assert.equal(server.countLastEmailsSentTo(siteId, maria.emailAddress), 3);
  });

  it("... but not Modya", () => {
    assert.equal(server.countLastEmailsSentTo(siteId, modya.emailAddress), 0);
    // Double check:
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.equal(num, numExpectedEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });


  // TESTS_MISSING: Owen could post something in a different category,
  // and then Maria's whole site settings, would apply.
  // But not the Specific category settings.


  // ------ Page prefs override category prefs

  it("Maria goes to the page", () => {
    mariasBrowser.refresh();  // BUG no live notf for new topics?  [NOTFTPCS]
    mariasBrowser.topbar.openLatestNotf();
  });

  it("... configs replies for every post", () => {
    mariasBrowser.metabar.setPageNotfLevel(c.TestPageNotfLevel.EveryPost);
  });

  /*
  it("... leaves the topic, so won't see new replies immediately", () => {
    mariasBrowser.go('/');
  }); */

  it("Owen posts a reply in the topic maria now follows", () => {
    owensBrowser.complex.replyToOrigPost(TopicTwoReplyOneTriggersNotf);
  });

  it("Maria gets notified", () => {
    const replyText = [TopicTwoReplyOneTriggersNotf];
    server.waitUntilLastEmailMatches(siteId, maria.emailAddress, replyText, browser);
    assert.equal(server.countLastEmailsSentTo(siteId, maria.emailAddress), 4);
  });

  it("Maria changes notf level to Muted", () => {
    mariasBrowser.metabar.setPageNotfLevel(c.TestPageNotfLevel.Muted);
  });

  it("Owen posts a second reply in the topic maria now has muted", () => {
    owensBrowser.complex.replyToOrigPost(TopicTwoReplyTwoMuted);
  });

  it("... and then a new topic", () => {
    owensBrowser.topbar.clickAncestor(SpecificCatName);
    owensBrowser.complex.createAndSaveTopic({ title: TopicTitleThree, body: TopicBodyThree });
  });

  it("... Maria get notified about the new topic only — because she muted topic two", () => {
    const titleAndBody = [TopicTitleThree, TopicBodyThree];
    server.waitUntilLastEmailMatches(siteId, maria.emailAddress, titleAndBody, browser);
    assert.equal(server.countLastEmailsSentTo(siteId, maria.emailAddress), 5);
  });

  // TESTS_MISSING clear notf settings for page —> fallbacks to cateory. Claer —> fallb to site.

});

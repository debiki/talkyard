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



let richBrowserA;
let richBrowserB;

let owen;
let owensBrowser: TyE2eTestBrowser;
let trillian;
let trilliansBrowser: TyE2eTestBrowser;
let modya;
let modyasBrowser: TyE2eTestBrowser;
let mons;
let monsBrowser: TyE2eTestBrowser;
let maja;
let majasBrowser: TyE2eTestBrowser;
let maria;
let mariasBrowser: TyE2eTestBrowser;
let michael;
let michaelsBrowser: TyE2eTestBrowser;

let idAddress: IdAddress;
let siteId: any;

const forumTitle = "Email Notfs in Discussions Forum";

const owensTopicTitleOne = 'owensTopicTitleOne';
const owensTopicBodyOne = 'owensTopicBodyOne';
const owensReplyOne = 'owensReplyOne';
const owensReplyTwo = 'owensReplyTwo';
const owensReplyThree = 'owensReplyThree';

const owensTopicTitleTwo = 'owensTopicTitleTwo';
const owensTopicBodyTwo = 'owensTopicBodyTwo';


describe("notfs overr grp prfs TyT6BKWDGY24", () => {

  it("initialize people", () => {
    richBrowserA = new TyE2eTestBrowser(browserA);
    richBrowserB = new TyE2eTestBrowser(browserB);
    owensBrowser = richBrowserA;
    modyasBrowser = richBrowserB;
    monsBrowser = richBrowserB;
    majasBrowser = richBrowserB;
    mariasBrowser = richBrowserB;
    michaelsBrowser = richBrowserB;
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
    //site.members.push(modya);
    //site.members.push(mons);
    site.members.push(maja);
    site.members.push(maria);
    site.members.push(michael);
    idAddress = server.importSiteData(site);
    siteId = idAddress.id;
  });


  // ----- Individual's notf-Normal and Every Post overrides All Member's notf about New Topics


  it("Owen goes to All Members' prefs page", () => {
    owensBrowser.go(idAddress.origin);
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
    owensBrowser.go('/-/groups/all_members/preferences/notifications');
  });

  it("... and configures All Members to get notified about new topics", () => {
    owensBrowser.userProfilePage.preferences.notfs.setSiteNotfLevel(c.TestPageNotfLevel.NewTopics);
  });

  it("Maria goes to her notfs prefs page", () => {
    mariasBrowser.go(idAddress.origin);
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
    mariasBrowser.userProfilePage.openPreferencesFor(maria.username);
    mariasBrowser.userProfilePage.preferences.switchToNotifications();
  });

  it("... and overrides the All Members group prefs: She wants to be notfd about every post ", () => {
    mariasBrowser.userProfilePage.preferences.notfs.setSiteNotfLevel(c.TestPageNotfLevel.Normal);
  });

  it("Maja goes to her notfs prefs page", () => {
    mariasBrowser.topbar.clickLogout();
    majasBrowser.complex.loginWithPasswordViaTopbar(maja);
    majasBrowser.userProfilePage.openPreferencesFor(maja.username);
    majasBrowser.userProfilePage.preferences.switchToNotifications();
  });

  it("... and overrides the All Members group prefs, to get notified about every post", () => {
    majasBrowser.userProfilePage.preferences.notfs.setSiteNotfLevel(c.TestPageNotfLevel.EveryPost);
  });

  it("Owen posts a topic", () => {
    owensBrowser.go('/');
    owensBrowser.complex.createAndSaveTopic({ title: owensTopicTitleOne, body: owensTopicBodyOne });
  });

  it("Maja and Michael get notified", () => {
    const titleBody = [owensTopicTitleOne, owensTopicBodyOne];
    server.waitUntilLastEmailMatches(siteId, maja.emailAddress, titleBody, browser);
    server.waitUntilLastEmailMatches(siteId, michael.emailAddress, titleBody, browser);
  });

  it("... once, exactly", () => {
    assert.equal(server.countLastEmailsSentTo(siteId, maja.emailAddress), 1);
    assert.equal(server.countLastEmailsSentTo(siteId, michael.emailAddress), 1);
  });

  it("... but not Maria (because she configd normal site notfs prefs, *not* for every topic)", () => {
   assert.equal(server.countLastEmailsSentTo(siteId, maria.emailAddress), 0);
  });

  it("Owen posts a reply", () => {
    owensBrowser.complex.replyToOrigPost(owensReplyOne);
  });

  it("Maja gets notified: has overrided All Members' prefs, to get notfs about every new post", () => {
    server.waitUntilLastEmailMatches(siteId, maja.emailAddress, [owensReplyOne], browser);
  });

  it("... she gets exactly one email", () => {
    assert.equal(server.countLastEmailsSentTo(siteId, maja.emailAddress), 2);
  });

  it("No one else gets notified", () => {
    assert.equal(server.countLastEmailsSentTo(siteId, michael.emailAddress), 1);  // old email
    assert.equal(server.countLastEmailsSentTo(siteId, maria.emailAddress), 0);
  });


  // ----- Individual's Normal overrides All Member's notf about Every Post


  let owensTopicUrl;

  it("Owen goes to All Members' prefs page again", () => {
    owensTopicUrl = owensBrowser.getUrl();
    owensBrowser.go('/-/groups/all_members/preferences/notifications');
  });

  it("... configs prefs for every post, for everyone", () => {
    owensBrowser.userProfilePage.preferences.notfs.setSiteNotfLevel(c.TestPageNotfLevel.EveryPost);
  });

  it("Owen returns to his topic", () => {
    owensBrowser.go(owensTopicUrl);
  });

  it("... posts a 2nd reply", () => {
    owensBrowser.complex.replyToOrigPost(owensReplyTwo);
  });

  it("Now also Michael get notified", () => {
    server.waitUntilLastEmailMatches(siteId, michael.emailAddress, [owensReplyTwo], browser);
  });

  it("... and Maja", () => {
    server.waitUntilLastEmailMatches(siteId, maja.emailAddress, [owensReplyTwo], browser);
  });

  it("... num emails sent is correct", () => {
    assert.equal(server.countLastEmailsSentTo(siteId, maja.emailAddress), 3);
    assert.equal(server.countLastEmailsSentTo(siteId, michael.emailAddress), 2);
    assert.equal(server.countLastEmailsSentTo(siteId, maria.emailAddress), 0);
  });


  // ----- Individual's New-Topics only overrides All Member's Every Post


  it("Maja changes her prefs, to new topics only", () => {
    majasBrowser.userProfilePage.preferences.notfs.setSiteNotfLevel(c.TestPageNotfLevel.NewTopics);
  });


  it("Owen posts a 2nd topic", () => {
    owensBrowser.go('/');
    owensBrowser.complex.createAndSaveTopic({ title: owensTopicTitleTwo, body: owensTopicBodyTwo });
  });

  it("Again, Maja and Michael get notified", () => {
    const titleBody = [owensTopicTitleTwo, owensTopicBodyTwo];
    server.waitUntilLastEmailMatches(siteId, maja.emailAddress, titleBody, browser);
    server.waitUntilLastEmailMatches(siteId, michael.emailAddress, titleBody, browser);
  });

  it("... num emails sent is correct", () => {
    assert.equal(server.countLastEmailsSentTo(siteId, maja.emailAddress), 4);
    assert.equal(server.countLastEmailsSentTo(siteId, michael.emailAddress), 3);
    assert.equal(server.countLastEmailsSentTo(siteId, maria.emailAddress), 0);
  });


  it("Owen posts a reply, in the 2nd topic", () => {
    owensBrowser.complex.replyToOrigPost(owensReplyThree);
  });

  it("Michael gets notified (because the All Members group gets notfd about every post)", () => {
    server.waitUntilLastEmailMatches(siteId, michael.emailAddress, [owensReplyThree], browser);
  });

  it("... once, exactly", () => {
    assert.equal(server.countLastEmailsSentTo(siteId, michael.emailAddress), 4);
  });

  it("... but not Maria or Maja (they've overridden the group prefs)", () => {
    assert.equal(server.countLastEmailsSentTo(siteId, maja.emailAddress), 4);
    assert.equal(server.countLastEmailsSentTo(siteId, maria.emailAddress), 0);
  });

});


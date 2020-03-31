/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

declare var browser: any;
declare var browserA: any;
declare var browserB: any;

let everyonesBrowsers;
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

const michaelsUsername = 'michael.lastname';
const coraxUsername = 'Corax-son-of-Tarzan';
const modyasUsername = 'modya.moody-mod';
const mallorysUsername = 'mallory';

const mariasTopicTitle = 'mariasTopicTitle';
const mariasTopicTextWithMentions =
  `@${michaelsUsername} @${coraxUsername} @${modyasUsername} not_@${mallorysUsername}`;


describe("weird-usernames.2browsers  TyT5ABKPUW2", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addEmptyForum({
      title: "Weird Usernames",
      members: undefined, // default = everyone
    });
    forum.members.michael.username = michaelsUsername;
    forum.members.corax.username = coraxUsername;
    forum.members.modya.username = modyasUsername;
    forum.members.mallory.username = mallorysUsername;
    assert(builder.getSite() === forum.siteData);
    siteIdAddress = server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
  });

  it("initialize people", () => {
    everyonesBrowsers = _.assign(browser, pagesFor(browser));
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
    reginasBrowser = richBrowserB;
    maria = forum.members.maria;
    mariasBrowser = richBrowserB;
    michael = forum.members.michael;
    michaelsBrowser = richBrowserB;
    mallory = forum.members.mallory;
    mallorysBrowser = richBrowserB;
    strangersBrowser = richBrowserB;
  });

  it("Maria logs in", () => {
    mariasBrowser.go(siteIdAddress.origin);
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
    mariasBrowser.disableRateLimits();
  });

  it("Maria posts a topic, mentions people with [.-] in their usernames", () => {
    mariasBrowser.complex.createAndSaveTopic({
      title: mariasTopicTitle,
      body: mariasTopicTextWithMentions,
    });
  });

  it("... Michael gets a mention notf, although '.' in his username", () => {
    server.waitUntilLastEmailMatches(
        siteId, michael.emailAddress, [mariasTopicTitle, mariasTopicTextWithMentions], browser);
  });

  it("... Corax gets a mention notf, although '-' in his username", () => {
    server.waitUntilLastEmailMatches(
        siteId, corax.emailAddress, [mariasTopicTitle, mariasTopicTextWithMentions], browser);
  });

  it("... Modya gets a mention notf, although both '.' and '-' in her username", () => {
    server.waitUntilLastEmailMatches(
        siteId, modya.emailAddress, [mariasTopicTitle, mariasTopicTextWithMentions], browser);
  });

  it("... Mallory got no email", () => {
    assert.equal(
        server.countLastEmailsSentTo(siteId, mallory.emailAddress), 0);
  });

  it("Maria can click Michael's mentioned username, to open about user dialogs  TyT2WAB5UY", () => {
    mariasBrowser.topic.clickFirstMentionOf(michaelsUsername);  // CROK
    const usernameInAboutDialog = mariasBrowser.aboutUserDialog.getUsername();
    assert.equal(usernameInAboutDialog, michaelsUsername);
  });

  it("... and Modya's mention", () => {
    mariasBrowser.aboutUserDialog.close();
    mariasBrowser.topic.clickFirstMentionOf(modyasUsername);  // CROK
    const usernameInAboutDialog = mariasBrowser.aboutUserDialog.getUsername();
    assert.equal(usernameInAboutDialog, modyasUsername);
  });

  it("... and Corax'", () => {
    mariasBrowser.aboutUserDialog.close();
    mariasBrowser.topic.clickFirstMentionOf(coraxUsername);  // CROK
    const usernameInAboutDialog = mariasBrowser.aboutUserDialog.getUsername();
    assert.equal(usernameInAboutDialog, coraxUsername);
  });

  it("The View Profile link really opens the user's profile page", () => {
    mariasBrowser.aboutUserDialog.clickViewProfile();
    mariasBrowser.userProfilePage.waitUntilUsernameVisible();
    mariasBrowser.userProfilePage.assertUsernameIs(corax.username);
  });

  // ...  Next: Some users rename themselves, to conflicting - . _ names?

});


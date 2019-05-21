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
let maria: Member;
let mariasBrowser;

let siteIdAddress: IdAddress;
let siteId;

let forum: EmptyTestForum;

let discussionPageUrl: string;


describe("expire-idle-session  TyT7RBKTJ25", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addEmptyForum({
      title: "Some E2E Test",
      members: undefined, // default = everyone
    });
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

    maria = forum.members.maria;
    mariasBrowser = richBrowserB;
  });

  it("Owen logs in to admin area, ... ", () => {
    owensBrowser.adminArea.goToLoginSettings(siteIdAddress.origin);
    owensBrowser.loginDialog.loginWithPassword(owen);
  });

  it("Owen configures 100 minutes session expiration time ", () => {
    owensBrowser.adminArea.settings.login.setExpireIdleAfterMinutes(100);
  });

  it("... saves", () => {
    owensBrowser.adminArea.settings.clickSaveAll();
  });

  it("Maria logs in", () => {
    mariasBrowser.go(siteIdAddress.origin);
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  it("... and posts a topic", () => {
    mariasBrowser.complex.createAndSaveTopic({
        title: "Text and letters, wow", body: "Writing, that's me. Text and words" });
  });

  it("90 minutes elapses", () => {
    server.playTimeMinutes(90);
  });

  it("Maria can post a reply", () => {
    mariasBrowser.complex.replyToOrigPost("And replying.");
    mariasBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr, "And replying.");
  });

  // This shouldn' expire the session though — she's been idle for only 11 minutes;
  // should get logged out instead after 100 idle minutes. [EXPIREIDLE]
  it("11 more minutes elapses, 101 in total — more than 100, so Maria session expires", () => {
    server.playTimeMinutes(11);
  });

  it("Maria attempts to post a reply", () => {
    mariasBrowser.complex.replyToOrigPost("text text");
  });

  it("... but gets a Not Logged In error", () => {
    mariasBrowser.serverErrorDialog.waitForNotLoggedInError();
  });

  it("Maria logs in again", () => {
    mariasBrowser.refresh();
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  it("Now she can post a 2nd reply", () => {
    mariasBrowser.complex.replyToOrigPost("I am back");
    mariasBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr + 1, "I am back");
  });

  it("Owen configures 2000 minutes session expiration time ", () => {
    owensBrowser.adminArea.settings.login.setExpireIdleAfterMinutes(2000);
  });

  it("... saves, again", () => {
    owensBrowser.adminArea.settings.clickSaveAll();
  });

  it("... but his session also expired", () => {
    owensBrowser.serverErrorDialog.waitForNotLoggedInAsAdminError();
    owensBrowser.serverErrorDialog.close();
  });

  it("He tries to save, still doesn't work, of course", () => {
    owensBrowser.adminArea.settings.clickSaveAll();
    owensBrowser.serverErrorDialog.waitForNotLoggedInAsAdminError();
    owensBrowser.serverErrorDialog.close();
  });

  it("... he logs in again", () => {
    owensBrowser.refresh();
    owensBrowser.loginDialog.loginWithPassword(owen);
  });

  it("... and now he can configure 2000 minutes expiration time", () => {
    owensBrowser.adminArea.settings.login.setExpireIdleAfterMinutes(2000);
    owensBrowser.adminArea.settings.clickSaveAll();
  });

  it("1900 minutes elapses", () => {
    server.playTimeMinutes(1900);
  });

  it("This didn't expire Maria's session; she can post a third reply", () => {
    mariasBrowser.complex.replyToOrigPost("Maybe I'll stay");
    mariasBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr + 2, "Maybe I'll stay");
  });

});


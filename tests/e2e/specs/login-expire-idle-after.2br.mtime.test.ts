/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');





let everyonesBrowsers;
let richBrowserA;
let richBrowserB;
let owen: Member;
let owensBrowser: TyE2eTestBrowser;
let maria: Member;
let mariasBrowser: TyE2eTestBrowser;

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
    everyonesBrowsers = new TyE2eTestBrowser(wdioBrowser);
    richBrowserA = new TyE2eTestBrowser(browserA);
    richBrowserB = new TyE2eTestBrowser(browserB);

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
    // [E2EBUG]? This failed 2 times out of 3, Jan 2020:
    //   Waiting for elem [ .esEdtr_textarea ] to not be occluded by [ .fade in modal ]...
    // apparently in   editText: function(...)
    mariasBrowser.complex.replyToOrigPost("text text");
  });

  it("... but gets a Not Logged In error", () => {
    mariasBrowser.serverErrorDialog.waitForNotLoggedInError();
  });

  it("Maria logs in again", () => {
    mariasBrowser.refresh2();
    // 2020-11-06: This timed out a few times [E2EBUG]
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  it("Now she can post a 2nd reply", () => {
    mariasBrowser.complex.replyToOrigPost("I am back");
    mariasBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr + 1, "I am back");
  });

  it("Owen configures 2000 minutes session expiration time ", () => {
    owensBrowser.adminArea.settings.login.setExpireIdleAfterMinutes(2000);
  });

  it("... tries to save", () => {
    owensBrowser.adminArea.settings.clickSaveAll({ willFail: true });
  });

  it("... but his session also expired", () => {
    owensBrowser.serverErrorDialog.waitForNotLoggedInAsAdminError();
    owensBrowser.serverErrorDialog.close();
  });

  it("... He tries once more, still doesn't work, of course", () => {
    owensBrowser.adminArea.settings.clickSaveAll({ willFail: true });
    owensBrowser.serverErrorDialog.waitForNotLoggedInAsAdminError();
    owensBrowser.serverErrorDialog.close();
  });

  it("Owen logs in again", () => {
    owensBrowser.refresh2();
    owensBrowser.loginDialog.loginWithPassword(owen);
  });

  it("... again configures 2000 minutes expiration time", () => {
    owensBrowser.adminArea.settings.login.setExpireIdleAfterMinutes(2000);
  });

  it("... and saves, works now", () => {
    owensBrowser.adminArea.settings.clickSaveAll();
  });

  it("1900 minutes elapses", () => {
    server.playTimeMinutes(1900);
  });

  it("This didn't expire Maria's session; she can post a third reply", () => {
    mariasBrowser.complex.replyToOrigPost("Maybe I'll stay");
    mariasBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr + 2, "Maybe I'll stay");
  });

  it("And Owen can keep changing the expiration time", () => {
    owensBrowser.adminArea.settings.login.setExpireIdleAfterMinutes(2098);
    // This wouldn't work, if session expired — there'd be a modal error dialog:
    owensBrowser.adminArea.settings.clickSaveAll();
    owensBrowser.adminArea.settings.login.setExpireIdleAfterMinutes(2099);
  });

});


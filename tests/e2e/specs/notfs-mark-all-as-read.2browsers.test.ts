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
let regina: Member;
let reginasBrowser: TyE2eTestBrowser;
let maria: Member;
let mariasBrowser: TyE2eTestBrowser;
let michael: Member;
let michaelsBrowser: TyE2eTestBrowser;

let siteIdAddress: IdAddress;
let siteId;

let forum: EmptyTestForum;

let discussionPageUrl: string;


describe("notfs-mark-all-as-read  TyT5BKAR24H", () => {

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

    maria = forum.members.maria;
    mariasBrowser = richBrowserA;

    regina = forum.members.regina;
    reginasBrowser = richBrowserB;
    michael = forum.members.michael;
    michaelsBrowser = richBrowserB;
  });

  it("Maria logs in", () => {
    mariasBrowser.go(siteIdAddress.origin + '/');
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  it("... creates a topic, page notf level will be set to Watching-All", () => {
    mariasBrowser.complex.createAndSaveTopic({ title: "Who are we?", body: "Tell us who we are :-}" });
    discussionPageUrl = mariasBrowser.getUrl();
  });

  it("... returns to the topic list, so won't see any replies", () => {
    mariasBrowser.go('/');
  });

  it("Michael logs in", () => {
    michaelsBrowser.go(discussionPageUrl);
    michaelsBrowser.complex.loginWithPasswordViaTopbar(michael);
  });

  it("... to Maria", () => {
    michaelsBrowser.complex.replyToOrigPost("Hello I'm Michael");
  });

  it("... and replies to himself, mentions @maria", () => {
    michaelsBrowser.complex.replyToPostNr(c.FirstReplyNr, "Hello you are @maria");
  });

  it("Regina logs in", () => {
    michaelsBrowser.topbar.clickLogout();
    reginasBrowser.complex.loginWithPasswordViaTopbar(regina);
  });

  it("... replies to one of Michael's replies", () => {
    reginasBrowser.complex.replyToPostNr(c.FirstReplyNr, "And I am Regina the Royal Ruler of Realms");
  });

  it("Maria has two unread notifications: a reply and a mention", () => {
    mariasBrowser.refresh();
    mariasBrowser.topbar.waitForNumDirectNotfs(2);  // Michael's reply and mention of Maria
    mariasBrowser.topbar.waitForNumOtherNotfs(1);   // Regina's reply to Michael
  });

  it("Maria marks all as read  [TyT4KA2PU6]", () => {
    mariasBrowser.topbar.myMenu.markAllNotfsRead();
  });

  it("Now they are both marked as read", () => {
    mariasBrowser.topbar.waitForNoOtherNotfs();
    mariasBrowser.topbar.waitForNoDirectNotfs();
  });

  it("The mark-all-as-read button is no longer visible", () => {
    mariasBrowser.topbar.openMyMenu();
    assert(!mariasBrowser.isVisible(mariasBrowser.topbar.myMenu.dismNotfsBtnClass));
  });

  // TESTS_MISSING:  go to profile page, view notfs, mark all as read — now the notfs
  // listed on the profile page should also get marked as read ... but they won't, currently
  // not synced with the store.

});


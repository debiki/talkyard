/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('../utils/ty-assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import lad = require('../utils/log-and-die');
import c = require('../test-constants');





let everyonesBrowsers;
let richBrowserA;
let richBrowserB;
let owen: Member;
let owensBrowser: TyE2eTestBrowser;
let mons: Member;
let monsBrowser: TyE2eTestBrowser;
let maria: Member;
let mariasBrowser: TyE2eTestBrowser;
let strangersBrowser: TyE2eTestBrowser;

let siteIdAddress: IdAddress;
let siteId;

let forum: TwoPagesTestForum;  // or: LargeTestForum

const topicTitle111 = 'topicTitle111';
const topicTitle222 = 'topicTitle222';

const topicBody111 = 'topicBody111';
const topicBody222 = 'topicBody222';


describe("slow-3g  TyT502KSTJGJ6", () => {

  if (settings.prod) {
    console.log("Skipping this spec — dummy slow latency not alllowed in Prod mode.");
    return;
  }

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      title: "Slow 3G E2E Test",
      members: undefined, // default = everyone
    });
    assert.eq(builder.getSite(), forum.siteData);

    // Use this hostname, so the server adds some seconds fake latency.
    builder.getSite().meta.localHostname = 'e2e-test-' + c.Slow3gHostnamePart;

    siteIdAddress = server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
    server.skipRateLimits(siteId);
  });

  it("initialize people", () => {
    everyonesBrowsers = new TyE2eTestBrowser(wdioBrowser);
    richBrowserA = new TyE2eTestBrowser(browserA);
    richBrowserB = new TyE2eTestBrowser(browserB);

    owen = forum.members.owen;
    owensBrowser = richBrowserA;
    mons = forum.members.mons;
    monsBrowser = richBrowserA;

    maria = forum.members.maria;
    mariasBrowser = richBrowserB;
    strangersBrowser = richBrowserB;
  });

  //it("Owen logs in to admin area, ... ", () => {
  //  owensBrowser.adminArea.goToUsersEnabled(siteIdAddress.origin);
  //  owensBrowser.loginDialog.loginWithPassword(owen);
  //});

  it("Maria logs in", () => {
    mariasBrowser.go(siteIdAddress.origin);
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  it("... starts typing a new topic", () => {
    mariasBrowser.forumButtons.clickCreateTopic();
  });

  it(`... the server is so slow, so she sees a "Loading draft..." text`, () => {
    mariasBrowser.waitForVisible('.e_LdDft');
  });

  it("She edits the new topic title and body", () => {
    mariasBrowser.editor.editTitle(topicTitle111);
    mariasBrowser.editor.editText(topicBody111);
  });

  it("... suddenly cancels, by refreshing the page", () => {
    mariasBrowser.refresh();
  });

  it("... she starts typing a topic again", () => {
    mariasBrowser.forumButtons.clickCreateTopic();
  });

  it("... the saved draft text reappears", () => {
    mariasBrowser.editor.waitForDraftTitleToLoad(topicTitle111);
    mariasBrowser.editor.waitForDraftTextToLoad(topicBody111);
  });

  it("... edits more", () => {
    mariasBrowser.editor.editTitle(topicTitle222);
    mariasBrowser.editor.editText(topicBody222);
  });

  it("She posts the new topic", () => {
    mariasBrowser.rememberCurrentUrl();
    mariasBrowser.editor.clickSave();
  });

  it("... a Wait-wait-wait overlay appears, because the server is so slow", () => {
    mariasBrowser.waitUntilLoadingOverlayVisible_raceCond();
    assert.ok(
        // This tests the test. (4092762)
        mariasBrowser.isLoadingOverlayVisible_raceCond());
  });

  it("... eventually her new topic appears, with the correct title and body", () => {
    mariasBrowser.waitForNewUrl();
    mariasBrowser.assertPageTitleMatches(topicTitle222);
    mariasBrowser.assertPageBodyMatches(topicBody222);
  });

  it("Maria starts replying to herself", () => {
    mariasBrowser.topic.clickReplyToOrigPost();
  });

  it("... starts typing", () => {
    mariasBrowser.editor.editText("Hello me");
  });

  it("... whilst typing, no annoying Wait-wait-wait overlay pops up   TyT40PKDRT4", () => {
    for (let i = 111; i < 1000; i += 111) {
      const nextText = '' + i;
      lad.logBoring(`Maria types: "${nextText}`);
      mariasBrowser.editor.editText(nextText, { skipWait: true });
      mariasBrowser.pause(250);
      assert.ok(!mariasBrowser.isLoadingOverlayVisible_raceCond());  // (4092762)
    }
  });

  it("... the text is ok afterwards", () => {
    const text = mariasBrowser.editor.getText();
    assert.eq(text, '999');
  });

  it("... the browser dutifuly saved a draft", () => {
    mariasBrowser.editor.waitForDraftSaved();
  });

  it("... she cancels, reloads, resumes typing", () => {
    mariasBrowser.editor.cancel();
    mariasBrowser.refresh();
    mariasBrowser.topic.clickReplyToOrigPost();
  });

  it("... she sees the old text: a draft was fetched from the server", () => {
    const text = mariasBrowser.editor.getText();
    assert.eq(text, '999');
  });

  it("She saves the reply", () => {
    mariasBrowser.editor.clickSave();
  });

  it("... the Wait-wait-wait overlay appears briefly — the server is soo slow", () => {
    mariasBrowser.waitUntilLoadingOverlayVisible_raceCond();
    mariasBrowser.waitUntilLoadingOverlayGone();
  });

  it("Her reply appears, with the correct text", () => {
    mariasBrowser.topic.waitUntilPostTextMatches(c.FirstReplyNr, '999');
  });

  it("... also after page reload", () => {
    mariasBrowser.refresh();
    mariasBrowser.topic.waitUntilPostTextMatches(c.FirstReplyNr, '999');
  });

});


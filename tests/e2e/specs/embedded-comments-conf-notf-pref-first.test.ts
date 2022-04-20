/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import fs = require('fs');
import server = require('../utils/server');
import { TyE2eTestBrowser } from '../utils/pages-for';
import utils = require('../utils/utils');
import make = require('../utils/make');
import c = require('../test-constants');

let browser: TyE2eTestBrowser;

let everyonesBrowsers;
let owen;
let owensBrowser: TyE2eTestBrowser;
let michael;
let michaelsBrowser: TyE2eTestBrowser;

let idAddress: IdAddress;
let siteId: any;

const owensComment = 'owensComment';

const localHostname = 'comments-for-e2e-test-embnprf1st-localhost-8080';
const embeddingOrigin = 'http://e2e-test-embnprf1st.localhost:8080';
const pageSlug = 'emb-cmts-notf-prefs-first.html';
const pageUrl = embeddingOrigin + '/' + pageSlug;
const pageName = "The Page Name";
const bgColor = "#270";


describe("embedded-comments-conf-notf-pref-first  TyT502HMSJP3", () => {

  it("initialize people", () => {
    everyonesBrowsers = new TyE2eTestBrowser(wdioBrowser);
    owen = make.memberOwenOwner();
    owensBrowser = everyonesBrowsers;
    michael = make.memberMichael();
    michaelsBrowser = everyonesBrowsers;
  });

  it("import a site", () => {
    const site: SiteData = make.forumOwnedByOwen('embnprf1st', { title: "Emb Cmts Notf Prefs First Test" });
    site.meta.localHostname = localHostname;
    site.settings.allowEmbeddingFrom = embeddingOrigin;
    site.settings.requireVerifiedEmail = false;
    site.settings.mayPostBeforeEmailVerified = true;
    site.members.push(michael);
    idAddress = server.importSiteData(site);
    siteId = idAddress.id;
  });

  it("create embedding page", () => {
    const html = utils.makeEmbeddedCommentsHtml({ pageName, discussionId: '', localHostname, bgColor });
    fs.writeFileSync(`target/${pageSlug}`, html);
  });

  it("Michael opens the embedding page", () => {
    michaelsBrowser.go(pageUrl);
    michaelsBrowser.switchToEmbeddedCommentsIrame();
    michaelsBrowser.disableRateLimits();
  });

  it("... logs in", () => {
    michaelsBrowser.complex.loginWithPasswordViaMetabar(michael);
  });

  it("... configs notf prefs = EveryPost, the very first thing, before page created", () => {
    // This previously resulted in a "Page not found, id: `0'" error, because the page had
    // not yet been created. Plus, the notf prefs dropdown was too large to fit in the
    // viewport.
    michaelsBrowser.switchToEmbeddedCommentsIrame();
    michaelsBrowser.metabar.setPageNotfLevel(c.TestPageNotfLevel.EveryPost);
  });

  it("... the notf prefs button now reads 'Every Post'  TyT305MHRTDP23", () => {
    michaelsBrowser.waitAndAssertVisibleTextMatches(
        '.dw-page-notf-level .dw-notf-level', "Every Post");
  });

  it(`... which is level ${c.TestPageNotfLevel.EveryPost}`, () => {
    michaelsBrowser.waitForDisplayed(
          `.dw-page-notf-level button.s_NfLv-${c.TestPageNotfLevel.EveryPost}`);
  });

  it("Michael leaves, Owen arrives", () => {
    michaelsBrowser.metabar.clickLogout();
    michaelsBrowser.complex.loginWithPasswordViaMetabar(owen);
  });

  it("Owen posts a comment", () => {
    michaelsBrowser.complex.replyToEmbeddingBlogPost(owensComment);
  });

  it("... Michael gets a notf email", () => {
    server.waitUntilLastEmailMatches(siteId, michael.emailAddress, owensComment, michaelsBrowser);
  });

  it("After page reload, the reply is still there", () => {
    owensBrowser.refresh();
    owensBrowser.switchToEmbeddedCommentsIrame();
    owensBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr, owensComment);
  });

});


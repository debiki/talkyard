/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import fs = require('fs');
import server = require('../utils/server');
import pagesFor = require('../utils/pages-for');
import utils = require('../utils/utils');
import make = require('../utils/make');

declare let browser: any;

let everyonesBrowsers;
let michael;
let michaelsBrowser;

let idAddress: IdAddress;
let siteId: any;

const michaelsComment = 'michaelsComment';

const localHostname = 'comments-for-e2e-test-embvote1st-localhost-8080';
const embeddingOrigin = 'http://e2e-test-embvote1st.localhost:8080';
const pageSlug = 'emb-cmts-edit-and-vote.html';
const pageUrl = embeddingOrigin + '/' + pageSlug;
const pageName = "The Page Name";
const bgColor = "#550";


describe("emb cmts vote first  TyT2AKBS056", () => {

  it("initialize people", () => {
    everyonesBrowsers = _.assign(browser, pagesFor(browser));
    michaelsBrowser = everyonesBrowsers;
    michael = make.memberMichael();
  });

  it("import a site", () => {
    const site: SiteData = make.forumOwnedByOwen('embvote1st', { title: "Emb Cmts Vote First Test" });
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

  it("... clicks Like, the very first thing, before page created", () => {
    // This previously resulted in a "Page not found, id: `0'" error, because the page had
    // not yet been created.
    michaelsBrowser.switchToEmbeddedCommentsIrame();
    michaelsBrowser.topic.clickLikeVoteForBlogPost();
  });

  it("Michael replies, too", () => {
    michaelsBrowser.complex.replyToEmbeddingBlogPost(michaelsComment);
  });

  it("After page reload, the reply is still there", () => {
    michaelsBrowser.refresh();
    michaelsBrowser.switchToEmbeddedCommentsIrame();
    michaelsBrowser.topic.waitForPostNrVisible(2);
    michaelsBrowser.topic.assertPostTextMatches(2, michaelsComment);
  });

  it("... and the like vote is there too", () => {
    assert(michaelsBrowser.isVisible('.dw-a-like.icon-heart.dw-my-vote'));
  });

});


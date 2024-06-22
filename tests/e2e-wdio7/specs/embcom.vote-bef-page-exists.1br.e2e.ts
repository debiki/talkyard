/// <reference path="../test-types.ts"/>

import * as fs from 'fs';
import server from '../utils/server';
import * as utils from '../utils/utils';
import * as make from '../utils/make';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';

let brA;
let michael;
let michal_brA: TyE2eTestBrowser;

let idAddress: IdAddress;

const michaelsComment = 'michaelsComment';

const localHostname = 'comments-for-e2e-test-embvote1st';
const embeddingOrigin = 'http://e2e-test-embvote1st.localhost:8080';
const pageSlug = 'emb-cmts-edit-and-vote.html';
const pageUrl = embeddingOrigin + '/' + pageSlug;
const pageName = "The Page Name";
const bgColor = "#550";


describe(`embcom.vote-bef-page-exists.1br  TyT2AKBS056`, () => {

  it("initialize people", async () => {
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    michal_brA = brA;
    michael = make.memberMichael();
  });

  it("import a site", async () => {
    const site: SiteData = make.forumOwnedByOwen('embvote1st', {
            title: "Emb Cmts Vote First Test" });
    site.meta.localHostname = localHostname;
    site.settings.allowEmbeddingFrom = embeddingOrigin;
    site.settings.requireVerifiedEmail = false;
    site.settings.mayPostBeforeEmailVerified = true;
    site.members.push(michael);
    idAddress = server.importSiteData(site);
  });

  it("create embedding page", async () => {
    const html = utils.makeEmbeddedCommentsHtml({
            pageName, discussionId: '', localHostname, bgColor });
    fs.writeFileSync(`target/${pageSlug}`, html);
  });

  it("Michael opens the embedding page", async () => {
    await michal_brA.go2(pageUrl);
    await michal_brA.switchToEmbeddedCommentsIrame();
    await michal_brA.disableRateLimits();
  });

  it("... logs in", async () => {
    await michal_brA.complex.loginWithPasswordViaMetabar(michael);
  });


  // ----- Like vote before page exists

  it("... clicks Like, the very first thing, before page created", async () => {
    // This previously resulted in a "Page not found, id: `0'" error, because the page had
    // not yet been created.
    await michal_brA.switchToEmbeddedCommentsIrame();
    await michal_brA.topic.clickLikeVoteForBlogPost();
  });

  it("Michael replies, too", async () => {
    await michal_brA.complex.replyToEmbeddingBlogPost(michaelsComment);
  });

  it("After page reload, the reply is still there", async () => {
    await michal_brA.refresh2();
    await michal_brA.switchToEmbeddedCommentsIrame();
    await michal_brA.topic.waitForPostNrVisible(2);
    await michal_brA.topic.assertPostTextMatches(2, michaelsComment);
  });

  it("... and the like vote is there too", async () => {
    await michal_brA.assertDisplayed('.dw-a-like.icon-heart.dw-my-vote');
  });


});


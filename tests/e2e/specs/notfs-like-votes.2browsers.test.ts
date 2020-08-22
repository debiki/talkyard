/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('../utils/ty-assert');
// import fs = require('fs');  EMBCMTS
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/pages-for';
import settings = require('../utils/settings');
import lad = require('../utils/log-and-die');
import c = require('../test-constants');


let richBrowserA: TyE2eTestBrowser;
let richBrowserB: TyE2eTestBrowser;
let owen: Member;
let owensBrowser: TyE2eTestBrowser;
let maria: Member;
let mariasBrowser: TyE2eTestBrowser;
let michael: Member;
let michaelsBrowser: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoPagesTestForum;
let michaelsPageUrl: string;



describe("notfs-like-votes.2browsers.test.ts  TyTE2E703KDH", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      title: "Some E2E Test",
      members: undefined, // default = everyone
    });

    builder.addPost({
      page: forum.topics.byMichaelCategoryA,
      nr: c.FirstReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.michael.id,
      approvedSource: "I'd like some Like votes, like, two? or three? Just like that.",
    });

    // Disable notifications, or notf email counts will be off (since Owen would get emails).
    builder.settings({ numFirstPostsToReview: 0, numFirstPostsToApprove: 0 });
    builder.getSite().pageNotfPrefs = [{
      memberId: forum.members.owen.id,
      notfLevel: c.TestPageNotfLevel.Muted,
      wholeSite: true,
    }];

    assert.refEq(builder.getSite(), forum.siteData);
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
    michaelsPageUrl = site.origin + '/' + forum.topics.byMichaelCategoryA.slug;
  });

  it("initialize people", () => {
    richBrowserA = new TyE2eTestBrowser(wdioBrowserA);
    richBrowserB = new TyE2eTestBrowser(wdioBrowserB);

    owen = forum.members.owen;
    owensBrowser = richBrowserA;

    maria = forum.members.maria;
    mariasBrowser = richBrowserB;
    michael = forum.members.michael;
    michaelsBrowser = richBrowserB;
  });

  it("Owen logs in", () => {
    owensBrowser.go2(michaelsPageUrl);
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
  });

  it("Maria logs in too", () => {
    mariasBrowser.go2(michaelsPageUrl);
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  it("Maria Like-votes Michael's topic", () => {
    mariasBrowser.topic.toggleLikeVote(c.BodyNr);
    assert.ok(mariasBrowser.topic.isPostLikedByMe(c.BodyNr));
  });

  let email: EmailSubjectBody;
  let likeLinkOne: S;

  it("Michael gets a Like vote notf email", () => {
    email = server.waitUntilLastEmailMatches(site.id, michael.emailAddress,
            ['e_NfEm_PgLikeVt', maria.username, site.origin])
            .matchedEmail;
    likeLinkOne = utils.findFirstLinkToUrlIn(site.origin, email.bodyHtmlText);
  });

  it("... about the orig post", () => {
    assert.includes(email.bodyHtmlText, `#post-${c.BodyNr}`);
  });

  it("... no more emails got sent", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(site.id);
    assert.eq(num, 1, `Emails sent to: ${addrsByTimeAsc}`);
  });

  it("Maria changes her mind: Undoes the Like-vote", () => {
    mariasBrowser.topic.toggleLikeVote(c.BodyNr);
    assert.not(mariasBrowser.topic.isPostLikedByMe(c.BodyNr));
  });

  it("... changes her mind again: Like-votes again", () => {
    mariasBrowser.topic.toggleLikeVote(c.BodyNr);
    assert.ok(mariasBrowser.topic.isPostLikedByMe(c.BodyNr));
  });

  it("Owen also Like-votes Michael's topic", () => {
    owensBrowser.topic.toggleLikeVote(c.BodyNr);
  });

  it("... and Michael's reply", () => {
    owensBrowser.topic.toggleLikeVote(c.FirstReplyNr);
  });

  let likeLinkTwo: S;

  it("Michael gets a notf email about the Like vote of his reply", () => {
    email = server.waitUntilLastEmailMatches(
            site.id, michael.emailAddress,
            ['e_NfEm_PoLikeVt', owen.username, site.origin])
            .matchedEmail;
    assert.includes(email.bodyHtmlText, `#post-${c.FirstReplyNr}`);
    likeLinkTwo = utils.findFirstLinkToUrlIn(site.origin, email.bodyHtmlText);
  });

  it("... but just that one Like vote", () => {
    assert.numSubstringsEq(email.bodyHtmlText, '#post-', 1);
  });

  it(`... no other notf emails`, () => {
    // Not more than 2 like vote notifications, one per email.
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(site.id);
    assert.eq(num, 2, `Emails sent to: ${addrsByTimeAsc}`);
  });

  it(`Michael goes to the topic list page`, () => {
    mariasBrowser.topbar.clickLogout();
    michaelsBrowser.go2('/');
    michaelsBrowser.complex.loginWithPasswordViaTopbar(michael);
  });

  it(`... sees 2 notifications to him specifically`, () => {
    michaelsBrowser.topbar.waitForNumDirectNotfs(2);
  });

  it(`... clicks the most recent notification`, () => {
    michaelsBrowser.topbar.openNotfToMe();
  });

  it(`... it brings him to his reply, Liked by Owen ... no, by the OP, liked by Maria,
        whatever. Notfs sorted how?`, () => {
    // There's a browser side url rewrite from  /-page_id to /page-slug.  TyTE2EPGID2SLUG
    michaelsBrowser.waitUntilUrlIs(michaelsPageUrl + `#post-${c.BodyNr}`);
  });

  it(`He sees his topic and reply both got Like voted`, () => {
    michaelsBrowser.topic.isPostLiked(c.BodyNr, { byMe: false });
    michaelsBrowser.topic.isPostLiked(c.FirstReplyNr, { byMe: false });
  });

  it(`Michael goes to the homepage`, () => {
    michaelsBrowser.go2('/');
    michaelsBrowser.forumTopicList.waitForTopics();
  });

  it(`... clicks the link in the last like notf email`, () => {
    michaelsBrowser.go2(likeLinkTwo);
  });

  it(`... brings him to his topic, the like voted reply`, () => {
    michaelsBrowser.waitUntilUrlIs(michaelsPageUrl + `#post-${c.FirstReplyNr}`);
    michaelsBrowser.assertPageTitleMatches(forum.topics.byMichaelCategoryA.title);
  });

  it(`... he sees the two like votes`, () => {
    michaelsBrowser.topic.isPostLiked(c.BodyNr, { byMe: false });
    michaelsBrowser.topic.isPostLiked(c.FirstReplyNr, { byMe: false });
  });

});


/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import lad = require('../utils/log-and-die');
import c = require('../test-constants');

declare var browser: any;
declare var browserA: any;
declare var browserB: any;

let richBrowserA;
let richBrowserB;
let owen: Member;
let owensBrowser;
let maja: Member;
let majasBrowser;
let strangersBrowser;

let siteIdAddress: IdAddress;
let siteId;

let forum: TwoPagesTestForum;  // or: LargeTestForum

const apiSecret: TestApiSecret = {
  nr: 1,
  userId: c.SysbotUserId,
  createdAt: c.MinUnixMillis,
  deletedAt: undefined,
  isDeleted: false,
  secretKey: 'publicE2eTestSecretKey306XSEGR20902',
};

const ssoDummyLoginSlug = 'sso-dummy-login.html';
const ssoUrl =
    `http://localhost:8080/${ssoDummyLoginSlug}?returnPath=\${talkyardPathQueryEscHash}`;


const categoryExtId = 'cat_ext_id';
const majasExternalId = 'majasExternalId';
const majasSsoId = 'majasSsoId';

const pageOneToUpsertMajasSsoId = {
  // id: assigned by the server
  extId: 'ups_paage_one_ext_id',
  pageType: c.TestPageRole.Idea,
  categoryRef: 'extid:' + categoryExtId,
  authorRef: 'ssoid:' + majasSsoId,
  title: 'UpsPageOneTitle',
  body: 'UpsPageOneBody',
};

const pageTwoToUpsertMajasExtId = {
  extId: 'ups_paage_two_ext_id',
  pageType: c.TestPageRole.Problem,
  categoryRef: 'extid:' + categoryExtId,
  authorRef: 'extid:' + majasExternalId,
  title: 'UpsPageTwoTitle',
  body: 'UpsPageTwoBody',
};



describe("api-w-sso-upsert-pages   TyT60KRJXT4X3", () => {

  if (settings.prod) {
    console.log("Skipping this spec — the server needs to have upsert conf vals enabled."); // E2EBUG
    return;
  }


  // ----- Create site, with API enabled

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      title: "Ups Pages E2E Test",
      members: ['owen', 'maja', 'maria', 'michael'],
    });
    assert(builder.getSite() === forum.siteData);
    const site: SiteData2 = forum.siteData;
    site.settings.enableApi = true;
    site.apiSecrets = [apiSecret];
    siteIdAddress = server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;

    site.settings.enableSso = true;
    site.settings.ssoUrl = ssoUrl;

  });

  it("initialize people", () => {
    richBrowserA = _.assign(browserA, pagesFor(browserA));
    richBrowserB = _.assign(browserB, pagesFor(browserB));

    owen = forum.members.owen;
    owensBrowser = richBrowserA;

    maja = forum.members.maja;
    majasBrowser = richBrowserB;
    strangersBrowser = richBrowserB;
  });


  // ----- Upsert Maja, a SSO user

  let oneTimeLoginSecret;

  it("Upsert Maja, an external user, and get a one-time-login-key", () => {
    const externalMaja = utils.makeExternalUserFor(maja, { ssoId: majasSsoId });

    oneTimeLoginSecret = server.apiV0.upsertUserGetLoginSecret({ origin: siteIdAddress.origin,
        requesterId: c.SysbotUserId, apiSecret: apiSecret.secretKey, externalUser: externalMaja });
  });

  it("... gets back a one time login secret", () => {
    console.log(`Got back login secret: ${ oneTimeLoginSecret }`);
    assert(oneTimeLoginSecret);
  });

  it("... redirects Maja to the Talkyard login-with-secret endpoint", () => {
    majasBrowser.rememberCurrentUrl();
    majasBrowser.apiV0.loginWithSecret({
      origin: siteIdAddress.origin,
      oneTimeSecret: oneTimeLoginSecret,
      thenGoTo: '/new',
    });
    majasBrowser.waitForNewUrl();
  });

  it("The Talkayrd server logs Maja in, redirects her to /new", () => {
    assert.equal(majasBrowser.urlPath(), '/new');
  });


  // ----- Assign ext id to a category

  it("Owen goes to Category A, logs in", () => {
    owensBrowser.forumTopicList.goHere({
        origin: siteIdAddress.origin,
        categorySlug: forum.categories.categoryA.slug });
    owensBrowser.topbar.clickLogin();
    owensBrowser.loginDialog.loginWithPassword(owen);
  });

  it("Opens the category", () => {
    owensBrowser.forumButtons.clickEditCategory();
  });

  it("... edits it: assigns an External ID", () => {
    owensBrowser.categoryDialog.fillInFields({ extId: categoryExtId });
  });

  it("... saves", () => {
    owensBrowser.categoryDialog.submit();
  });


  // ----- Upsert page via API, using Maja's Single Sign-On id, 'ssoid:....'

  let upsertResponse;
  let firstUpsertedPage: any;

  it("Upsert a page", () => {
    upsertResponse = server.apiV0.upsertSimple({
      origin: siteIdAddress.origin,
      requesterId: c.SysbotUserId,
      apiSecret: apiSecret.secretKey,
      data: {
        pages: [pageOneToUpsertMajasSsoId],
      },
    });
  });

  it("... gets back the upserted page in the server's response", () => {
    console.log("Page ups resp:\n\n:" + JSON.stringify(upsertResponse, undefined, 2));

    assert.equal(upsertResponse.pages.length, 1);
    firstUpsertedPage = upsertResponse.pages[0];

    assert.equal(firstUpsertedPage.urlPath, '/-1/upspageonetitle');

    assert.equal(firstUpsertedPage.id, "1");
    assert.equal(firstUpsertedPage.pageType, c.TestPageRole.Idea);
    utils.checkNewPageFields(firstUpsertedPage, {
      categoryId: forum.categories.categoryA.id,
      authorId: maja.id,
    });
  });

  it("The upserted page is not yet visible in the topic list", () => {
    owensBrowser.forumTopicList.assertNumVisible(2, { wait: true });
  });

  it("... but Owen refreshes the page", () => {
    owensBrowser.refresh();
  });

  it("... now the upserted page is in the page list", () => {
    owensBrowser.forumTopicList.assertNumVisible(3, { wait: true });
  });

  it("... all topics have the epected titles", () => {
    owensBrowser.forumTopicList.assertTopicTitlesAreAndOrder([
        pageOneToUpsertMajasSsoId.title,
        forum.topics.byMichaelCategoryA.title,
        forum.topics.byMariaCategoryA.title]);
  });


  it("Owen opens the upserted topic", () => {
    owensBrowser.forumTopicList.navToTopic(pageOneToUpsertMajasSsoId.title);
  });

  it("... it has the correct title", () => {
    owensBrowser.topic.waitForPostAssertTextMatches(c.TitleNr, pageOneToUpsertMajasSsoId.title);
  });

  it("... and body", () => {
    owensBrowser.topic.waitForPostAssertTextMatches(c.BodyNr, pageOneToUpsertMajasSsoId.body);
  });

  it("... and author, that is, Maja", () => {
    const atUsername = owensBrowser.topic.getTopicAuthorUsernameInclAt();
    assert.equal(atUsername, '@666' + maja.username);
  });


  it("Owen goes to the page URL path from the topic response", () => {
    owensBrowser.go2('/');
    owensBrowser.go2(siteIdAddress.origin + firstUpsertedPage.urlPath);
  });

  it("... and, again, sees the correct page title and body", () => {
    owensBrowser.topic.waitForPostAssertTextMatches(c.TitleNr, pageOneToUpsertMajasSsoId.title);
    owensBrowser.topic.waitForPostAssertTextMatches(c.BodyNr, pageOneToUpsertMajasSsoId.body);
  });


  // ----- Upsert page, author ref via 'extid: ...'

  /* Not impl:  Not yet any way to assign ext ids to users. (Only SSO (Single Sign-On) ids.)

  it("Owen upserts two pages, in the same API request", () => {
    upsertResponse = server.apiV0.upsertSimple({
        origin: siteIdAddress.origin,
        requesterId: c.SysbotUserId,
        apiSecret: apiSecret.secretKey,
        data: {
          pages: [pageTwoToUpsertMajasExtId],
        }});
  });

  it("... gets back an upserted page in the response", () => {
    console.log("2 pages ups resp:\n\n:" +
        JSON.stringify(upsertResponse.pages.length, undefined, 2));
    assert.equal(upsertResponse.pages.length, 2);
  });

  function expectedUrlPath(page, title: string): string {
    return `/-${page.id}/${title.toLowerCase()}`;

  }
  it("... it looks fine", () => {
    const upsPage = upsertResponse.pages[0];
    assert.equal(upsPage.urlPath, expectedUrlPath(upsPage, pageTwoToUpsertMajasExtId.title));
    assert.equal(upsPage.pageType, c.TestPageRole.Question);
    checkNewPageFields(upsPage, {
      categoryId: forum.categories.categoryA.id,
      authorId: owen.id,
    });
  });

  it("Now there're 2 more pages", () => {
    owensBrowser.topbar.clickAncestor(forum.categories.categoryA.name);
    owensBrowser.forumTopicList.assertNumVisible(5, { wait: true });
  });

  it("... all topics have the epected titles", () => {
    owensBrowser.forumTopicList.assertTopicTitlesAreAndOrder([
        pageTwoToUpsertMajasExtId.title,
        pageOneToUpsertMajasSsoId.title,
        forum.topics.byMichaelCategoryA.title,
        forum.topics.byMariaCategoryA.title]);
  });
  */


  // ----- Edit page, via upsert API

  /* Not yet implemented  TyT650KWUDEPJ03g
  it("Owen edit-upserts the 2nd page: a new name, slug, etc", () => {
    upsertResponse = server.apiV0.upsertSimple({
        origin: siteIdAddress.origin,
        requesterId: c.SysbotUserId,
        apiSecret: apiSecret.secretKey,
        data: {
          pages: [pageTwoEditedToUpsert],
        }});
  });

  let upsEditedPageTwo;

  it("... the server replies; the page has now the new title, slug, etc", () => {
    assert.equal(upsertResponse.pages.length, 1);
    upsEditedPageTwo = upsertResponse.pages[0];
  });

  it("Owen goest to the urlPaths.activeTopics category URL path, for the now edited slug", () => {
    owensBrowser.go(siteIdAddress.origin + upsEditedPageTwo.urlPath);
  });

  it("... and sees the new title and body", () => {
    owensBrowser.topic.waitForPostAssertTextMatches(c.TitleNr, pageTwoEditedToUpsert.title);
    owensBrowser.topic.waitForPostAssertTextMatches(c.BodyNr, pageTwoEditedToUpsert.body);
  });


  it("The previous page slug redirects to the new  [TyT503KRDH24]", () => {
    // TESTS_MISSING not yet impl
  });


  it("... Owen returns to the topic list page", () => {
    owensBrowser.forumTopicList.goHere({
        categorySlug: forum.categories.categoryA.slug });
  });

  it("... the page title did change", () => {
    owensBrowser.forumTopicList.assertNumVisible(5, { wait: true });
    owensBrowser.forumTopicList.assertTopicTitlesAreAndOrder([
        pageThreeToUpsert.title,
        pageTwoEditedToUpsert.title,   // <—— new title
        pageOneToUpsertMajasSsoId.title,
        forum.topics.byMichaelCategoryA.title,
        forum.topics.byMariaCategoryA.title]);
  });
  */


  // TESTS_MISSING: verify page body updated —   [YESUPSERT]
  // actually, not yet impl. Pages are currently only *in*serted.
  // (So right now, one cannot upsert a new page body or title.)



  // ----- Actually use upserted page, via UI

  /*
  it("Owen opens Maja's upserted & upsert-edited page one", () => {
    owensBrowser.forumTopicList.navToTopic(pageOneToUpsertMajasSsoId.title
        //  later: pageOneToUpsertEditedMajasSsoId.title);
        );
  }); */

  const PageTitleManuallyEdited = 'PageTitleManuallyEdited';
  const PageBodyManuallyEdited = 'PageBodyManuallyEdited';
  const OwensReplyToMaja = 'OwensReplyToMaja';

  it("Owen edits the title", () => {
    owensBrowser.complex.editPageTitle(PageTitleManuallyEdited);
  });

  it("... and text", () => {
    owensBrowser.complex.editPageBody(PageBodyManuallyEdited);
  });

  it("... and posts a reply", () => {
    owensBrowser.complex.replyToOrigPost(OwensReplyToMaja);
  });

  it("Owen reloads the page", () => {
    owensBrowser.refresh();
  });

  it("... all fine, after reload", () => {
    owensBrowser.topic.waitForPostAssertTextMatches(c.TitleNr, PageTitleManuallyEdited);
    owensBrowser.topic.waitForPostAssertTextMatches(c.BodyNr, PageBodyManuallyEdited);
    owensBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr, OwensReplyToMaja);
  });

  it("Maja gets notified about the reply", () => {
    server.waitUntilLastEmailMatches(
        siteIdAddress.id, maja.emailAddress,
        [PageTitleManuallyEdited, OwensReplyToMaja], majasBrowser);
  });

  it("Owen returns to the category", () => {
    owensBrowser.topbar.clickAncestor(forum.categories.categoryA.name);  // TyT602FKUDLSV
  });

  it("... the topic list got updated, with the new title", () => {
    owensBrowser.forumTopicList.assertNumVisible(3, { wait: true });
    owensBrowser.forumTopicList.assertTopicTitlesAreAndOrder([
        PageTitleManuallyEdited,
        forum.topics.byMichaelCategoryA.title,
        forum.topics.byMariaCategoryA.title]);
  });

});


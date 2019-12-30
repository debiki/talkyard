/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('../utils/ty-assert');
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

let forum: TwoPagesTestForum;

const apiSecret: TestApiSecret = {
  nr: 1,
  userId: c.SysbotUserId,
  createdAt: c.MinUnixMillis,
  deletedAt: undefined,
  isDeleted: false,
  secretKey: 'publicE2eTestSecretKeyAbc123',
};

const categoryExtId = 'cat_ext_id';

const pageOneToUpsert = {
  // id: assigned by the server
  extId: 'ups_page_one_ext_id',
  pageType: c.TestPageRole.Idea,
  categoryRef: 'extid:' + categoryExtId,
  authorRef: 'username:owen_owner',
  title: 'UpsPageOneTitle',
  body: 'UpsPageOneBody',
};

const evil_example_com = 'evil.example.com';
const script_gets_removed = 'script_gets_removed';

const pageTwoToUpsert = {
  extId: 'UpsPageTwoExtId',
  pageType: c.TestPageRole.Question,
  categoryRef: 'extid:' + categoryExtId,
  authorRef: 'username:owen_owner',
  title: 'UpsPageTwoTitle',
  body: `UpsPageTwoBody
    <h1>h1_stays</h1>
    <h4>h4_stays</h4>
    <b>bold_stays</b>
    <p>para_stays</p>
    <pre>pre_stays</pre>
    <code>code_stays</code>
    <a rel="nofollow" href="http://link_url_stays.example.com">link_text_stays</a>
    <img alt="img_alt_stays" src="https://nice.example.com/img.jpg">
    <blockquote>blockquote_stays</blockquote>
    <ul><li>list_stays</li></ul>
    <table><tbody><td>table_stays</td></tbody></table>
    <script src="http://${evil_example_com}/so_evil_script.js">${script_gets_removed}</script>
    last_line_stays`,
};

const pageTwoEditedToUpsert = {
  ...pageTwoToUpsert,
  title: 'Page Two Edited Title',
  body: 'Page two edited body.',
  slug: 'page-two-edited-slug',
  pageType: c.TestPageRole.Question,
};

const pageThreeToUpsert = {
  extId: 'UpsPageThreeExtId',
  pageType: c.TestPageRole.Problem,
  categoryRef: 'extid:' + categoryExtId,
  authorRef: 'username:owen_owner',
  title: 'UpsPageThreeTitle',
  body: 'UpsPageThreeBody',
  slug: 'ups-page-three-slug',
};


describe("api-upsert-pages   TyT603PKRAEPGJ5", () => {

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
    assert.ok(builder.getSite() === forum.siteData);
    const site: SiteData2 = forum.siteData;
    site.settings.enableApi = true;
    site.apiSecrets = [apiSecret];
    siteIdAddress = server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
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


  // ----- Assign ext id to a category   (dupl code [05KUDTEDW24])

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

  // ----- Upsert page via API

  let upsertResponse;
  let firstUpsertedPage: any;

  it("Upsert a page", () => {
    upsertResponse = server.apiV0.upsertSimple({
      origin: siteIdAddress.origin,
      apiRequesterId: c.SysbotUserId,
      apiSecret: apiSecret.secretKey,
      data: {
        pages: [pageOneToUpsert],
      },
    });
  });

  it("... gets back the upserted page in the server's response", () => {
    console.log("Page ups resp:\n\n:" + JSON.stringify(upsertResponse, undefined, 2));

    assert.eq(upsertResponse.pages.length, 1);
    firstUpsertedPage = upsertResponse.pages[0];

    assert.eq(firstUpsertedPage.urlPaths.canonical, '/-1/upspageonetitle');

    assert.eq(firstUpsertedPage.id, "1");
    assert.eq(firstUpsertedPage.pageType, c.TestPageRole.Idea);
    utils.checkNewPageFields(firstUpsertedPage, {
      categoryId: forum.categories.categoryA.id,
      authorId: owen.id,
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
        pageOneToUpsert.title,
        forum.topics.byMichaelCategoryA.title,
        forum.topics.byMariaCategoryA.title]);
  });


  it("Owen opens the upserted topic", () => {
    owensBrowser.forumTopicList.navToTopic(pageOneToUpsert.title);
  });

  it("... it has the correct title", () => {
    owensBrowser.topic.waitForPostAssertTextMatches(c.TitleNr, pageOneToUpsert.title);
  });

  it("... and body", () => {
    owensBrowser.topic.waitForPostAssertTextMatches(c.BodyNr, pageOneToUpsert.body);
  });


  it("Owen goes to the page URL path from the topic response", () => {
    owensBrowser.go2('/');
    owensBrowser.go2(siteIdAddress.origin + firstUpsertedPage.urlPaths.canonical);
  });

  it("... and, again, sees the correct page title and body", () => {
    owensBrowser.topic.waitForPostAssertTextMatches(c.TitleNr, pageOneToUpsert.title);
    owensBrowser.topic.waitForPostAssertTextMatches(c.BodyNr, pageOneToUpsert.body);
  });



  // ----- Upserting many pages

  it("Owen upserts two pages, in the same API request", () => {
    upsertResponse = server.apiV0.upsertSimple({
        origin: siteIdAddress.origin,
        apiRequesterId: c.SysbotUserId,
        apiSecret: apiSecret.secretKey,
        data: {
          pages: [pageTwoToUpsert, pageThreeToUpsert],
        }});
  });

  it("... gets back two upserted pages in the response", () => {
    console.log("2 pages ups resp:\n\n:" +
        JSON.stringify(upsertResponse.pages.length, undefined, 2));
    assert.eq(upsertResponse.pages.length, 2);
  });

  function expectedUrlPath(page, title: string): string {
    return `/-${page.id}/${title.toLowerCase()}`;

  }
  it("... the first one looks correct", () => {
    const upsPage = upsertResponse.pages[0];
    assert.eq(upsPage.urlPaths.canonical, expectedUrlPath(upsPage, pageTwoToUpsert.title));
    assert.eq(upsPage.pageType, c.TestPageRole.Question);
    utils.checkNewPageFields(upsPage, {
      categoryId: forum.categories.categoryA.id,
      authorId: owen.id,
    });
  });

  it("... the 2nd, likewise", () => {
    const upsPage = upsertResponse.pages[1];
    assert.eq(upsPage.urlPaths.canonical, expectedUrlPath(upsPage, pageThreeToUpsert.title));
    assert.eq(upsPage.pageType, c.TestPageRole.Problem);
    utils.checkNewPageFields(upsPage, {
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
        pageThreeToUpsert.title, // now topic no 3 is first, but below: TyT602FKUDLSV
        pageTwoToUpsert.title,
        pageOneToUpsert.title,
        forum.topics.byMichaelCategoryA.title,
        forum.topics.byMariaCategoryA.title]);
  });

  it("No notf emails sent — by default, no notfs for upserts  TyT305WKTUC2", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.eq(num, 0, `Emails sent to: ${addrsByTimeAsc}`);
  });



  // ----- The HTML got sanitized but not too much

  it("Owen opens the upserted & upsert-edited page two", () => {
    owensBrowser.forumTopicList.navToTopic(pageTwoToUpsert.title
        //  later: pageTwoEditedToUpsert.title);
        );
  });

  it("... the upserted HTML tags are there", () => {
    owensBrowser.topic.waitUntilPostHtmlMatches(c.BodyNr, [
        '<h1>h1_stays</h1>',
        '<h4>h4_stays</h4>',
        '<b>bold_stays</b>',
        '<p>para_stays</p>',
        '<pre>pre_stays</pre>',
        '<code>code_stays</code>',
        '<pre>pre_stays</pre>',
        'link_url_stays',
        'nofollow',
        '<a rel="nofollow" href="http://link_url_stays.example.com">link_text_stays</a>',
        'img_alt_stays',
        '<img alt="img_alt_stays" src="https://nice.example.com/img.jpg">',
        /<blockquote>[\s]*blockquote_stays[\s]*<\/blockquote>/,
        /<ul>[\s]*<li>[\s]*list_stays[\s]*<\/li>[\s]*<\/ul>/,
        /<table>[\s]*<tbody>[\s]*<tr>[\s]*<td>[\s]*table_stays[\s]*<\/td>[\s]*<\/tr>[\s]*<\/tbody>[\s]*<\/table>/,
        'last_line_stays']);
  });

  it("... but not the <script> tag; it got removed by the sanitizer", () => {
    owensBrowser.topic.assertPostHtmlDoesNotMatch(c.BodyNr, [
        script_gets_removed,
        '<script',
        '</script>',
        evil_example_com,
        'so_evil_script']);
  });



  // ----- Edit page, via upsert API

  /* Not yet implemented  TyT650KWUDEPJ03g
  it("Owen edit-upserts the 2nd page: a new name, slug, etc", () => {
    upsertResponse = server.apiV0.upsertSimple({
        origin: siteIdAddress.origin,
        apiRequesterId: c.SysbotUserId,
        apiSecret: apiSecret.secretKey,
        data: {
          pages: [pageTwoEditedToUpsert],
        }});
  });

  let upsEditedPageTwo;

  it("... the server replies; the page has now the new title, slug, etc", () => {
    assert.eq(upsertResponse.pages.length, 1);
    upsEditedPageTwo = upsertResponse.pages[0];
  });

  it("Owen goest to the urlPaths.activeTopics category URL path, for the now edited slug", () => {
    owensBrowser.go(siteIdAddress.origin + upsEditedPageTwo.urlPaths.canonical);
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
        pageOneToUpsert.title,
        forum.topics.byMichaelCategoryA.title,
        forum.topics.byMariaCategoryA.title]);
  });
  */


  // TESTS_MISSING: verify page body updated —   [YESUPSERT]
  // actually, not yet impl. Pages are currently only *in*serted.
  // (So right now, one cannot upsert a new page body or title.)



  // ----- Actually use upserted page, via UI

  const PageTwoTitleManuallyEdited = 'PageTwoTitleManuallyEdited';
  const PageTwoBodyManuallyEdited = 'PageTwoBodyManuallyEdited';
  const PageTwoReplyMentionsMaja = 'PageTwoReply @maja';

  it("... edits the title", () => {
    owensBrowser.complex.editPageTitle(PageTwoTitleManuallyEdited);
  });

  it("... and text", () => {
    owensBrowser.complex.editPageBody(PageTwoBodyManuallyEdited, { append: true });
  });

  it("... and posts a reply, mentions Maja", () => {
    owensBrowser.complex.replyToOrigPost(PageTwoReplyMentionsMaja);
  });

  it("Owen reloads the page", () => {
    owensBrowser.refresh();
  });

  it("... all fine, after reload", () => {
    owensBrowser.topic.waitForPostAssertTextMatches(c.TitleNr, PageTwoTitleManuallyEdited);
    owensBrowser.topic.waitForPostAssertTextMatches(c.BodyNr, PageTwoBodyManuallyEdited);
    owensBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr, PageTwoReplyMentionsMaja);
  });

  it("Maja gets a notf email", () => {
    server.waitUntilLastEmailMatches(
        siteIdAddress.id, maja.emailAddress,
        [PageTwoReplyMentionsMaja], majasBrowser);
  });

  it("... but no one else, no notfs for upserts  TyT305WKTUC2", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    const oneEmailToMaja = 1;
    assert.eq(num, oneEmailToMaja, `Emails sent to: ${addrsByTimeAsc}`);
  });

  it("Owen returns to the category", () => {
    owensBrowser.topbar.clickAncestor(forum.categories.categoryA.name);  // TyT602FKUDLSV
  });

  it("... the topic list got updated, with the new title", () => {
    owensBrowser.forumTopicList.assertNumVisible(5, { wait: true });
    owensBrowser.forumTopicList.assertTopicTitlesAreAndOrder([
        PageTwoTitleManuallyEdited, // topic 2 first — got bumped  TyT602FKUDLSV
        pageThreeToUpsert.title,    // ... above topic 3
        pageOneToUpsert.title,
        forum.topics.byMichaelCategoryA.title,
        forum.topics.byMariaCategoryA.title]);
  });

});


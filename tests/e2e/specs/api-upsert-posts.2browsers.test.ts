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





let richBrowserA;
let richBrowserB;
let owen: Member;
let owensBrowser: TyE2eTestBrowser;
let maja: Member;
let majasBrowser: TyE2eTestBrowser;
let maria: Member;
let michael: Member;
let michaelsBrowser: TyE2eTestBrowser;
let strangersBrowser: TyE2eTestBrowser;

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

const majasApiTopicUpsData = {
  extId: 'majasApiTopicUpsData ext id',
  pageType: c.TestPageRole.Idea,
  categoryRef: 'extid:' + categoryExtId,
  authorRef: 'username:maja',
  title: 'majasApiTopicUpsData Title Text',
  body: 'majasApiTopicUpsData body text',
};

const majasUiTopic = {
  title: 'majasUiTopic_title',
  body: 'majasUiTopic_body',
  type: PageRole.Problem,
};

const michaelsReplyToMajasApiTopic = {
  extId: 'michaelsReplyToMajasApiTopic extId',
  postType: c.TestPostType.Normal,
  parentNr: c.BodyNr,
  pageRef: `extid:${majasApiTopicUpsData.extId}`,
  authorRef: `username:michael`,
  body: 'michaelsReplyToMajasApiTopic hello Maja',
};

const michaelsProgrReplyToMajasUiTopic_lineOne =
    'michaelsProgrReplyToMajasUiTopic progr note text';

const michaelsProgrReplyToMajasUiTopic = {
  ...michaelsReplyToMajasApiTopic,
  extId: 'michaelsProgrReplyToMajasUiTopic extId',
  pageRef: '', // filled in later (3909682)
  postType: c.TestPostType.BottomComment,
  body: michaelsProgrReplyToMajasUiTopic_lineOne + '\n' +
        '  "ddqq"  \'ssqq\'  question: ?   and: &  hash: #  \n' +
        '<script src="https://danger.example.com></script>\n' +
        '<script>danger</script>\n',
};

const majasApiReplyToMichael = {
  ...michaelsReplyToMajasApiTopic,
  extId: 'majasApiReplyToMichael extId',
  parentNr: c.FirstReplyNr,  // that's Michael's post
  authorRef: `username:maria`,
  body: 'majasApiReplyToMichael hello Michael',
};

const majasReplyMentionsMaria = {
  ...michaelsReplyToMajasApiTopic,
  extId: 'majasReplyMentionsMaria extId',
  authorRef: `username:maja`,
  body: 'majasReplyMentionsMaria hello @maria',
};

const majasReplyTextToMichaelOnUiCreatedPage = 'majasReplyTextToMichaelOnUiCreatedPage';

let upsSimpleParams;
let numNotfEmailsSent = 0;


describe("api-upsert-posts   TyT60RKNJF24C", () => {

  if (settings.prod) {
    console.log("Skipping this spec — the server needs to have upsert conf vals enabled."); // E2EBUG
    return;
  }


  // ----- Create site, with API enabled

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      categoryExtId,  // instead of: [05KUDTEDW24]
      title: "Api Priv Chat 2 Participants E2E Test",
      members: ['owen', 'corax', 'maja', 'maria', 'michael'],
    });
    assert.refEq(builder.getSite(), forum.siteData);
    const site: SiteData2 = forum.siteData;
    site.settings.enableApi = true;
    site.apiSecrets = [apiSecret];

    // Disable these, or notf email counts will be off (since Owen would get emails).
    site.settings.numFirstPostsToReview = 0;
    site.settings.numFirstPostsToApprove = 0;
    owen = forum.members.owen;
    site.pageNotfPrefs = [{
      memberId: owen.id,
      notfLevel: c.TestPageNotfLevel.Muted,
      wholeSite: true,
    }];

    siteIdAddress = server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
    server.skipRateLimits(siteId);
  });

  it("initialize people", () => {
    richBrowserA = new TyE2eTestBrowser(browserA);
    richBrowserB = new TyE2eTestBrowser(browserB);

    owen = forum.members.owen;
    owensBrowser = richBrowserA;
    maja = forum.members.maja;
    majasBrowser = richBrowserA;
    maria = forum.members.maria;
    michael = forum.members.michael;
    michaelsBrowser = richBrowserB;
    strangersBrowser = richBrowserB;

    upsSimpleParams = {
      origin: siteIdAddress.origin,
      apiRequesterId: c.SysbotUserId,
      apiSecret: apiSecret.secretKey,
    };
  });


  // ----- Create topics: One via the UI, one via the API

  it("Maja logs in", () => {
    majasBrowser.go2(siteIdAddress.origin);
    majasBrowser.complex.loginWithPasswordViaTopbar(maja);
  });

  it("... posts a topic", () => {
    majasBrowser.complex.createAndSaveTopic(majasUiTopic);
  });

  let majasUiTopicId: PageId;

  it("... remembers its Talkyard id", () => {
    majasUiTopicId = majasBrowser.getPageId();
    assert.eq(majasUiTopicId, '2');
  });

  it("... returns to the topic list", () => {
    majasBrowser.topbar.clickHome();
  });

  let upsertResponse;
  let majasApiTopic: any;

  it("Maja upserts a topic via the API too", () => {
    upsertResponse = server.apiV0.upsertSimple({
      ...upsSimpleParams,
      data: {
        upsertOptions: { sendNotifications: true },
        pages: [majasApiTopicUpsData],
      },
    });
  });

  it("... gets back the upserted page in the server's response", () => {
    console.log("Page ups resp:\n\n:" + JSON.stringify(upsertResponse));

    assert.equal(upsertResponse.pages.length, 1);
    majasApiTopic = upsertResponse.pages[0];

    assert.equal(majasApiTopic.urlPaths.canonical,
        `/-3/${majasApiTopicUpsData.title.toLowerCase().replace(/ /g, '-')}`);

    assert.equal(majasApiTopic.id, "3");
    assert.equal(majasApiTopic.pageType, c.TestPageRole.Idea);
    utils.checkNewPageFields(majasApiTopic, {
      categoryId: forum.categories.specificCategory.id,
      authorId: maja.id,
    });
  });


  // ----- Upsert posts, page autor gets notified

  it("Michael API upserts a ProgressNote to Maja's UI created topic", () => {
    michaelsProgrReplyToMajasUiTopic.pageRef = `tyid:${majasUiTopicId}`;  // (3909682)   e2e map +=
    upsertResponse = server.apiV0.upsertSimple({
      ...upsSimpleParams,
      data: {
        upsertOptions: { sendNotifications: true },
        posts: [michaelsProgrReplyToMajasUiTopic],
      },
    });
    numNotfEmailsSent += 1;
  });

  let majasUiTopicNotfEmail: EmailSubjectBody;

  it("... Maja gets notified", () => {
    majasUiTopicNotfEmail = server.waitUntilLastEmailMatches(
        siteIdAddress.id, maja.emailAddress,
        // Line 2 contains magic regex chars, won't match.
        [maja.username, michaelsProgrReplyToMajasUiTopic_lineOne], browserA).matchedEmail;
  });

  it("... The email has no double escaped '&amp;' and '&quot;'", () => {
    const bodyHtmlText = majasUiTopicNotfEmail.bodyHtmlText;
    console.log('\n\nEMLBDY:\n\n' + bodyHtmlText + '\n\n-------------------');
majasBrowser.debug();
    assert.includes(bodyHtmlText, ' &quot;ddqq&quot; ');
    assert.includes(bodyHtmlText, " 'ssqq' ");
    assert.includes(bodyHtmlText, " question: ? ");
    assert.includes(bodyHtmlText, " and: &amp; ");
    assert.includes(bodyHtmlText, " hash: # ");
  });

  it("... script tags gone", () => {
    const danger = 'danger';
    assert.includes(michaelsProgrReplyToMajasUiTopic.body, c.ScriptTagName);
    assert.includes(michaelsProgrReplyToMajasUiTopic.body, danger);
    assert.excludes(majasUiTopicNotfEmail.bodyHtmlText, c.ScriptTagName);
    assert.excludes(majasUiTopicNotfEmail.bodyHtmlText, danger);
  });

  it("No one else got notified", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.equal(num, numNotfEmailsSent, `Emails sent to: ${addrsByTimeAsc}`);
  });

  it("Michael API upserts a reply to Maja's API created topic", () => {
    upsertResponse = server.apiV0.upsertSimple({
      ...upsSimpleParams,
      data: {
        upsertOptions: { sendNotifications: true },
        posts: [michaelsReplyToMajasApiTopic],
      },
    });
    numNotfEmailsSent += 1;
  });

  it("... Maja gets notified", () => {
    server.waitUntilLastEmailMatches(
        siteIdAddress.id, maja.emailAddress,
        [maja.username, michaelsReplyToMajasApiTopic.body], browserA);
  });

  it("But no one else", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.equal(num, numNotfEmailsSent, `Emails sent to: ${addrsByTimeAsc}`);
  });


  // ----- Can API reply to API reply

  it("Maja API replies to Michael's API reply", () => {
    upsertResponse = server.apiV0.upsertSimple({
      ...upsSimpleParams,
      data: {
        upsertOptions: { sendNotifications: true },
        posts: [majasApiReplyToMichael],
      },
    });
    numNotfEmailsSent += 1;
  });

  let michaelsReplyNotfEmail;

  it("... Michael gets notified", () => {
    michaelsReplyNotfEmail = server.waitUntilLastEmailMatches(
        siteIdAddress.id, michael.emailAddress, [majasApiReplyToMichael.body],
        browserA).matchedEmail;
  });

  it("... but no one else", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.equal(num, numNotfEmailsSent, `Emails sent to: ${addrsByTimeAsc}`);
  });

  it("Maria API replies to her own UI created page, @mentions Maria", () => {
    upsertResponse = server.apiV0.upsertSimple({
      ...upsSimpleParams,
      data: {
        upsertOptions: { sendNotifications: true },
        posts: [majasReplyMentionsMaria],
      },
    });
    numNotfEmailsSent += 1;
  });

  it("... Maria gets notified", () => {
    server.waitUntilLastEmailMatches(
        siteIdAddress.id, maria.emailAddress,
        [maria.username, majasReplyMentionsMaria.body], browserA);
  });

  it("But no one else", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.equal(num, numNotfEmailsSent, `Emails sent to: ${addrsByTimeAsc}`);
  });


  // ----- The notf links work

  let replyNotfLink: string;

  it("Maja finds a page link in a notf email", () => {
    replyNotfLink = utils.findFirstLinkToUrlIn(
        // Currently the link uses the page id, not url slug.
        // So, not:  + firstUpsertedPage.urlPaths.canonical
        // Instead,  /-1:
        'https?://.*/-' + majasUiTopicId, majasUiTopicNotfEmail.bodyHtmlText);
  });

  it("she clicks the link", () => {
    majasBrowser.go2(replyNotfLink);
  });

  it("... sees Michael's reply", () => {
    majasBrowser.topic.waitForPostAssertTextMatches(
        c.FirstReplyNr, michaelsProgrReplyToMajasUiTopic.body);
  });

  it("Michael fins a notf link to Maja's reply", () => {
    replyNotfLink = utils.findFirstLinkToUrlIn(
        // Currently the link uses the page id, not url slug.
        // So, not:  + firstUpsertedPage.urlPaths.canonical
        // Instead,  /-1:
        'https?://.*/-' + majasApiTopic.id, michaelsReplyNotfEmail.bodyHtmlText);
  });

  it("... clicks the link", () => {
    michaelsBrowser.go2(replyNotfLink);
  });

  it("... sees Maja's reply", () => {
    michaelsBrowser.topic.waitForPostAssertTextMatches(
        c.FirstReplyNr + 1, majasApiReplyToMichael.body);
  });


  // ----- The upserted posts work: Can reply via the UI

  it("Maja post a reply to Michael's reply", () => {
    majasBrowser.complex.replyToPostNr(
        c.FirstReplyNr, majasReplyTextToMichaelOnUiCreatedPage);
    numNotfEmailsSent += 1;
  });

  it("... Michael gets notified", () => {
    server.waitUntilLastEmailMatches(
        siteIdAddress.id, michael.emailAddress, [majasReplyTextToMichaelOnUiCreatedPage], browserA);
  });

  it("But no one else", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.eq(num, numNotfEmailsSent, `Emails sent to: ${addrsByTimeAsc}`);
  });


  // ----- Notfs when upserting many posts: Not allowed

  it("Upsert with notfs enabled isn't allowed, when upserting many things", () => {
    const responseText = upsertResponse = server.apiV0.upsertSimple({
      fail: true,
      origin: siteIdAddress.origin,
      apiRequesterId: c.SysbotUserId,
      apiSecret: apiSecret.secretKey,
      data: {
        upsertOptions: { sendNotifications: true },
        posts: [
          // One, two, 3, 4, 5, many — too many.  [SOMNYPSTS]
          { ...michaelsReplyToMajasApiTopic, extId: 'oone', },
          { ...michaelsReplyToMajasApiTopic, extId: 'twoo', },
          { ...michaelsReplyToMajasApiTopic, extId: 'thr33', },
          { ...michaelsReplyToMajasApiTopic, extId: 'f4r', },
          { ...michaelsReplyToMajasApiTopic, extId: '5ive', },
          { ...michaelsReplyToMajasApiTopic, extId: 'manyy', }],
      },
    });
    assert.includes(responseText, 'TyEUPSMNYNTFS_');
  });

});


/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import * as utils from '../utils/utils';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import settings from '../utils/settings';
import c from '../test-constants';


let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brB: TyE2eTestBrowser;
let maja: Member;
let maja_brA: TyE2eTestBrowser;
let maria: Member;
let michael: Member;
let michael_brB: TyE2eTestBrowser;

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
  type: c.TestPageRole.Problem,
};

const michaelsApiReplyToMajasApiTopic = {
  extId: 'michaelsApiReplyToMajasApiTopic extId',
  postType: c.TestPostType.Normal,
  parentNr: c.BodyNr,
  pageRef: `extid:${majasApiTopicUpsData.extId}`,
  authorRef: `username:michael`,
  body: 'michaelsApiReplyToMajasApiTopic hello Maja',
};

const michaelsApiProgrReplyToMajasUiTopic_lineOne =
    'michaelsApiProgrReplyToMajasUiTopic progr note text';

const danger = 'danger';
const link_text_01 = 'link_text_01';
const link_text_02 = 'link_text_02';

const michaelsApiNormalReplyToMajasUiTopic = {
  ...michaelsApiReplyToMajasApiTopic,
  extId: 'michaelsApiNormalReplyToMajasUiTopic refId',
  pageRef: '', // filled in later (3909682)
  body: 'michaelsApiNormalReplyToMajasUiTopic',
};

const michaelsApiProgrReplyToMajasUiTopic = {
  ...michaelsApiReplyToMajasApiTopic,
  extId: 'michaelsProgrReplyToMajasUiTopic extId',
  pageRef: '', // filled in later (3909682)
  postType: c.TestPostType.BottomComment,
  body: michaelsApiProgrReplyToMajasUiTopic_lineOne + '\n' +
        'o "ddqq"  \'ssqq\'  question: ?   and: &  hash: # o\n' +
        'o less than: <  greater than: > o\n' +
        `<a href="#" onclick="alert('${danger}')">${link_text_01}</a>\n` +
        `<a href="javascript:alert('${danger}');">${link_text_02}</a>\n` +
        `<script src="https://${danger}.example.com"></script>\n` +
        `<script>${danger}</script>\n`,
};

const majasApiReplyToMichael = {
  ...michaelsApiReplyToMajasApiTopic,
  extId: 'majasApiReplyToMichael extId',
  parentNr: c.FirstReplyNr,  // that's Michael's post
  authorRef: `username:maja`,
  body: 'majasApiReplyToMichael hello Michael',
};

const majasApiReplyMentionsMaria = {
  ...michaelsApiReplyToMajasApiTopic,
  extId: 'majasApiReplyMentionsMaria extId',
  authorRef: `username:maja`,
  body: 'majasApiReplyMentionsMaria hello @maria',
};

const majasReplyTextToMichaelOnUiCreatedPage = 'majasReplyTextToMichaelOnUiCreatedPage';

let upsSimpleParams;
let numNotfEmailsSent = 0;

let michaelsTopicIdUrl: St;


// Related test:  webhooks-for-api-upserts.2br  TyTE2EWBHK4API

describe(`api-upsert-posts.2br.d  TyT60RKNJF24C`, () => {

  if (settings.prod) {
    console.log("Skipping this spec — the server needs to have upsert conf vals enabled."); // E2EBUG
    return;
  }


  // ----- Create site, with API enabled

  it("import a site", async () => {
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

    siteIdAddress = await server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
    await server.skipRateLimits(siteId);

    michaelsTopicIdUrl = siteIdAddress.origin + '/-' + forum.topics.byMichaelCatA.id;
  });

  it("initialize people", async () => {
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brB = brB;

    maja = forum.members.maja;
    maja_brA = brA;

    maria = forum.members.maria;
    michael = forum.members.michael;
    michael_brB = brB;

    upsSimpleParams = {
      origin: siteIdAddress.origin,
      apiRequesterId: c.SysbotUserId,
      apiSecret: apiSecret.secretKey,
    };
  });


  // ----- Create topics: One via the UI, one via the API

  it("Maja logs in", async () => {
    await maja_brA.go2(siteIdAddress.origin);
    await maja_brA.complex.loginWithPasswordViaTopbar(maja);
  });

  it("... posts a topic", async () => {
    await maja_brA.complex.createAndSaveTopic(majasUiTopic);
  });

  let majasUiTopicId: PageId;

  it("... remembers its Talkyard id", async () => {
    majasUiTopicId = await maja_brA.getPageId();
    assert.eq(majasUiTopicId, '2');
  });

  it("... returns to the topic list", async () => {
    await maja_brA.topbar.clickHome();
  });

  let upsertResponse;
  let majasApiTopic: any;

  it("Maja upserts a topic via the API too", async () => {
    upsertResponse = await server.apiV0.upsertSimple({
      ...upsSimpleParams,
      data: {
        upsertOptions: { sendNotifications: true },
        pages: [majasApiTopicUpsData],
      },
    });
  });

  it("... gets back the upserted page in the server's response", async () => {
    console.log("Page ups resp:\n\n:" + JSON.stringify(upsertResponse));

    assert.eq(upsertResponse.pages.length, 1);
    majasApiTopic = upsertResponse.pages[0];

    assert.eq(majasApiTopic.urlPaths.canonical,
        `/-3/${majasApiTopicUpsData.title.toLowerCase().replace(/ /g, '-')}`);

    assert.eq(majasApiTopic.id, "3");
    assert.eq(majasApiTopic.pageType, c.TestPageRole.Idea);
    utils.checkNewPageFields(majasApiTopic, {
      categoryId: forum.categories.specificCategory.id,
      authorId: maja.id,
    });
  });


  // ----- Upsert reply,  w/o notifications (tested implicitly below)

  it(`Michael API replies to Maja's UI created topic, no notfs  (& Owen will delete later)`,
          async () => {
    michaelsApiNormalReplyToMajasUiTopic.pageRef = `tyid:${majasUiTopicId}`;  // (3909682)   e2e map +=
    upsertResponse = await server.apiV0.upsertSimple({
      ...upsSimpleParams,
      data: {
        upsertOptions: { sendNotifications: false },
        posts: [michaelsApiNormalReplyToMajasUiTopic],
      },
    });
  });


  // ----- Upsert posts, page autor gets notified

  it("Michael API upserts a ProgressNote to Maja's UI created topic", async () => {
    michaelsApiProgrReplyToMajasUiTopic.pageRef = `tyid:${majasUiTopicId}`;  // (3909682)   e2e map +=
    upsertResponse = await server.apiV0.upsertSimple({
      ...upsSimpleParams,
      data: {
        upsertOptions: { sendNotifications: true },
        posts: [michaelsApiProgrReplyToMajasUiTopic],
      },
    });
    numNotfEmailsSent += 1;
  });

  let majasUiTopicNotfEmail: EmailSubjectBody;

  it("... Maja gets notified", async () => {
    majasUiTopicNotfEmail = (await server.waitUntilLastEmailMatches(
        siteIdAddress.id, maja.emailAddress,
        // Line 2 contains magic regex chars, won't match.
        [maja.username, michaelsApiProgrReplyToMajasUiTopic_lineOne])).matchedEmail;
  });

  let bodyHtmlText: string;

  it("... The email has no double escaped '&amp;' and '&quot;'", async () => {
    bodyHtmlText = majasUiTopicNotfEmail.bodyHtmlText;
    //console.log('\n\nEMLBDY:\n\n' + bodyHtmlText + '\n\n-------------------');
    // Dupl match list. (69723056)
    assert.includes(bodyHtmlText, " &quot;ddqq&quot; ");
    assert.includes(bodyHtmlText, " 'ssqq' ");
    assert.includes(bodyHtmlText, " question: ? ");
    assert.includes(bodyHtmlText, " and: &amp; ");
    assert.includes(bodyHtmlText, " hash: # ");
    assert.includes(bodyHtmlText, " less than: &lt; ");
    assert.includes(bodyHtmlText, " greater than: &gt; ");
    assert.includes(bodyHtmlText, link_text_01);
    assert.includes(bodyHtmlText, link_text_02);
  });

  it("... script tags not in email  TyT0RKDL5MW", async () => {
    // Test the tests:
    assert.includes(michaelsApiProgrReplyToMajasUiTopic.body, c.ScriptTagName);
    assert.includes(michaelsApiProgrReplyToMajasUiTopic.body, danger);
    // Real tests:
    assert.excludes(bodyHtmlText, c.ScriptTagName);
    assert.excludes(bodyHtmlText, danger);
  });

  it("No one else got notified (1 email sent in total)", async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(siteId);
    assert.eq(num, numNotfEmailsSent, `Emails sent to: ${addrsByTimeAsc}`);
    assert.eq(numNotfEmailsSent, 1);  // ttt
  });

  it("Michael API upserts a reply to Maja's API created topic", async () => {
    upsertResponse = await server.apiV0.upsertSimple({
      ...upsSimpleParams,
      data: {
        upsertOptions: { sendNotifications: true },
        posts: [michaelsApiReplyToMajasApiTopic],
      },
    });
    numNotfEmailsSent += 1;
  });

  it("... Maja gets notified", async () => {
    await server.waitUntilLastEmailMatches(
        siteIdAddress.id, maja.emailAddress,
        [maja.username, michaelsApiReplyToMajasApiTopic.body]);
  });

  it("But no one else  (2 emails sent in total)", async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(siteId);
    assert.eq(num, numNotfEmailsSent, `Emails sent to: ${addrsByTimeAsc}`);
    assert.eq(numNotfEmailsSent, 2);  // ttt
  });


  // ----- Can API reply to API reply

  it("Maja API replies to Michael's API reply", async () => {
    upsertResponse = await server.apiV0.upsertSimple({
      ...upsSimpleParams,
      data: {
        upsertOptions: { sendNotifications: true },
        posts: [majasApiReplyToMichael],
      },
    });
    numNotfEmailsSent += 1;
  });

  let michaelsReplyNotfEmail;

  it("... Michael gets notified", async () => {
    michaelsReplyNotfEmail = (await server.waitUntilLastEmailMatches(
        siteIdAddress.id, michael.emailAddress, [majasApiReplyToMichael.body])).matchedEmail;
  });

  it("... but no one else  (3 emails sent in total)", async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(siteId);
    assert.eq(num, numNotfEmailsSent, `Emails sent to: ${addrsByTimeAsc}`);
    assert.eq(numNotfEmailsSent, 3);  // ttt
  });

  it("Maja API replies to her own UI created page, @mentions Maria", async () => {
    upsertResponse = await server.apiV0.upsertSimple({
      ...upsSimpleParams,
      data: {
        upsertOptions: { sendNotifications: true },
        posts: [majasApiReplyMentionsMaria],
      },
    });
    numNotfEmailsSent += 1;
  });

  it("... Maria gets notified", async () => {
    await server.waitUntilLastEmailMatches(
        siteIdAddress.id, maria.emailAddress,
        [maria.username, majasApiReplyMentionsMaria.body]);
  });

  it("But no one else  (4 emails sent in total)", async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(siteId);
    assert.eq(num, numNotfEmailsSent, `Emails sent to: ${addrsByTimeAsc}`);
    assert.eq(numNotfEmailsSent, 4);  // ttt
  });


  // ----- The notf links work

  let replyNotfLink: string;

  it("Maja finds a page link in the notf email about Michael's reply", async () => {
    assert.eq(majasUiTopicId, c.SecondPageId);
    replyNotfLink = utils.findFirstLinkToUrlIn(
        // Currently the link uses the page id, not url slug.
        // So, not:  + firstUpsertedPage.urlPaths.canonical
        // Instead,  /-N:
        'https?://.*/-' + majasUiTopicId, majasUiTopicNotfEmail.bodyHtmlText);
  });

  it("she clicks the link", async () => {
    await maja_brA.go2(replyNotfLink);
  });

  it(`... sees Michael's 2nd reply  (which Owen hasn't deleted)`, async () => {
    await maja_brA.topic.waitForPostAssertTextMatches(
        c.SecondReplyNr, michaelsApiProgrReplyToMajasUiTopic_lineOne);
  });

  it("... it's been sanitized: script tags gone  TyT0RKDL5MW", async () => {
    const bodyHtmlText = await maja_brA.topic.getPostHtml(c.SecondReplyNr);

    // Test the test:
    assert.includes(michaelsApiProgrReplyToMajasUiTopic.body, link_text_02);
    assert.includes(michaelsApiProgrReplyToMajasUiTopic.body, danger);

    // Real tests:
    // Dupl match list. (69723056)
    assert.includes(bodyHtmlText, '');
    assert.includes(bodyHtmlText, ' "ddqq" ');  // '"' need not be escaped here ...
    assert.includes(bodyHtmlText, " 'ssqq' ");
    assert.includes(bodyHtmlText, " question: ? ");
    assert.includes(bodyHtmlText, " and: &amp; ");   // but '&'  needs to be escaped
    assert.includes(bodyHtmlText, " hash: # ");
    assert.includes(bodyHtmlText, " less than: &lt; ");     // and '<'
    assert.includes(bodyHtmlText, " greater than: &gt; ");  // and '>'  too
    assert.includes(bodyHtmlText, link_text_01);
    assert.includes(bodyHtmlText, link_text_02);

    assert.excludes(bodyHtmlText, c.ScriptTagName);
    assert.excludes(bodyHtmlText, danger);
  });

  it("Michael fins a notf link to Maja's reply", async () => {
    replyNotfLink = utils.findFirstLinkToUrlIn(
        // Currently the link uses the page id, not url slug.
        // So, not:  + firstUpsertedPage.urlPaths.canonical
        // Instead,  /-N:
        'https?://.*/-' + majasApiTopic.id, michaelsReplyNotfEmail.bodyHtmlText);
  });

  it("... clicks the link", async () => {
    await michael_brB.go2(replyNotfLink);
  });

  it("... sees Maja's reply", async () => {
    await michael_brB.topic.waitForPostAssertTextMatches(
        c.FirstReplyNr + 1, majasApiReplyToMichael.body);
  });


  // ----- The upserted posts work 1/3: Can delete it

  // There was once a bug, this update-statistics code was missing: [ups_po_upd_stats].

  it(`Owen goes to the UI page,  logs in`, async () => {
    await owen_brB.go2('/-' + majasUiTopicId);
    await owen_brB.complex.loginWithPasswordViaTopbar(owen);
  });

  it("... sees Michael's first reply", async () => {
    await owen_brB.topic.waitForPostAssertTextMatches(
        c.FirstReplyNr, 'michaelsApiNormalReplyToMajasUiTopic');
  });

  it(`... deletes Michael's API reply`,
        async () => {
    await owen_brB.topic.deletePost(c.FirstReplyNr);
  });


  // ----- The upserted posts work 2/3: Can reply via the UI

  it("Maja post a reply to Michael's 2nd reply", async () => {
    await maja_brA.complex.replyToPostNr(
        c.SecondReplyNr, majasReplyTextToMichaelOnUiCreatedPage);
    numNotfEmailsSent += 1;
  });

  it("... Michael gets notified", async () => {
    await server.waitUntilLastEmailMatches(
        siteIdAddress.id, michael.emailAddress, [majasReplyTextToMichaelOnUiCreatedPage]);
  });

  it("But no one else", async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(siteId);
    assert.eq(num, numNotfEmailsSent, `Emails sent to: ${addrsByTimeAsc}`);
  });


  // ----- Notfs when upserting many posts: Not allowed

  it("Upsert with notfs enabled isn't allowed, when upserting many things", async () => {
    const responseText = upsertResponse = await server.apiV0.upsertSimple({
      fail: true,
      origin: siteIdAddress.origin,
      apiRequesterId: c.SysbotUserId,
      apiSecret: apiSecret.secretKey,
      data: {
        upsertOptions: { sendNotifications: true },
        posts: [
          // One, two, 3, 4, 5, many — too many.  [SOMNYPSTS]
          { ...michaelsApiReplyToMajasApiTopic, extId: 'oone', },
          { ...michaelsApiReplyToMajasApiTopic, extId: 'twoo', },
          { ...michaelsApiReplyToMajasApiTopic, extId: 'thr33', },
          { ...michaelsApiReplyToMajasApiTopic, extId: 'f4r', },
          { ...michaelsApiReplyToMajasApiTopic, extId: '5ive', },
          { ...michaelsApiReplyToMajasApiTopic, extId: 'manyy', }],
      },
    });
    assert.includes(responseText, 'TyEUPSMNYNTFS_');
  });


  // ----- The upserted posts work 3/3: Can move to other page

  it(`Owen moves Michael's 2nd API reply on the UI page to another page`, async () => {
    await owen_brB.refresh2();
    await owen_brB.topic.openMoveDialogForPostNr(c.SecondReplyNr);
    await owen_brB.movePostDialog.typePostLinkMoveToThere(michaelsTopicIdUrl);
  });

  it(`... confirms`, async () => {
    await owen_brB.waitAndClick('.esStupidDlg a');
  });

  it(`Owen moves the API upserted reply on the API page to another page`, async () => {
    await owen_brB.go2(majasApiTopic.urlPaths.canonical);
    await owen_brB.topic.openMoveDialogForPostNr(c.FirstReplyNr);
    await owen_brB.movePostDialog.typePostLinkMoveToThere(michaelsTopicIdUrl);
  });

  it(`... confirms again`, async () => {
    await owen_brB.waitAndClick('.esStupidDlg a');
  });

  it(`Now Michael's page has four comments
        — because the replies to the replies were moved too (one by Maja)`, async () => {
    await owen_brB.topic.assertNumCommentsVisible(4);
  });

  it(`... and the UI page has none`, async () => {
    await owen_brB.go2('/-' + majasUiTopicId);
    await owen_brB.topic.waitForReplyButtonAssertNoComments();
  });

  it(`... and the API page has one: the extra @mention reply`, async () => {
    await owen_brB.go2(majasApiTopic.urlPaths.canonical);
    await owen_brB.topic.assertNumCommentsVisible(1);
  });

});


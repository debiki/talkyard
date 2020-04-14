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
let charliesBrowser: TyE2eTestBrowser;
let chumasBrowser: TyE2eTestBrowser;
let maria;
let michael;
let mallory;
let mallorysBrowser: TyE2eTestBrowser;
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
  secretKey: 'publicE2eTestSecretKeyDefg345',
};

const ssoDummyLoginSlug = 'sso-dummy-chatters-login.html';
const ssoUrl =
    `http://localhost:8080/${ssoDummyLoginSlug}?returnPath=\${talkyardPathQueryEscHash}`;


const owensSsoId = 'owensSsoId';

const chumaExtUser: ExternalUser = {
  ssoId: "Chuma's SSO id",
  username: 'chuma_un',
  fullName: 'Chuma Ext User',
  primaryEmailAddress: 'e2e-test-chuma@x.co',
  isEmailAddressVerified: true,
};

const charlieExtUser: ExternalUser = {
  ssoId: "Charlie's SSO id",
  extId: "Charlie's External id",
  username: 'charlie_un',
  fullName: 'Charlie Ext User',
  primaryEmailAddress: 'e2e-test-charlie@x.co',
  isEmailAddressVerified: true,
};


const categoryExtId = 'chat_cat_ext_id';

const chatPageOne = {
  extId: 'chat_page_one_ext_id',
  pageType: c.TestPageRole.PrivateChat,
  categoryRef: `extid:${categoryExtId}`,
  authorRef: `ssoid:${chumaExtUser.ssoId}`,  // try with sso id ... (5393267)
  title: 'chatPageOne title',
  body: 'chatPageOne body',
  pageMemberRefs: [
    // Test w both ssoid and extid.
    `ssoid:${chumaExtUser.ssoId}`,
    `extid:${charlieExtUser.extId}`]
};

const chumaSaysHiCharlieChatMessage = {
  // An extId is useful if the API consumer wants to refer to this same
  // chat message in a 2nd API request, e.g. to *edit* or *delete* the message
  // (currently edits and deletes aren't supported though, in the upsert API [ACTNPATCH]).
  extId: 'chumaSaysHiCharlieChatMessage extId',
  postType: c.TestPostType.ChatMessage,
  pageRef: `extid:${chatPageOne.extId}`,
  authorRef: `ssoid:${chumaExtUser.ssoId}`,   // ... (sso id here too)
  body: 'chumaSaysHiCharlieChatMessage body',
};

const charlieSaysHiChuma = {
  ...chumaSaysHiCharlieChatMessage,
  extId: 'charlieSaysHiChuma extId',
  authorRef: `extid:${charlieExtUser.extId}`, // ... and ext id too  (5393267)
  body: 'charlieSaysHiChuma body',
};

const chumaRepliesToCharlie = {
  ...chumaSaysHiCharlieChatMessage,
  extId: 'chumaRepliesToCharlie extId',
  authorRef: `ssoid:${chumaExtUser.ssoId}`,
  body: 'chumaRepliesToCharlie body',
};




export default function addApiChatTestSteps(variants: {
      lookupAndUseUsernames?: boolean,
      useExtIdAndSsoId?: boolean }) {
  lad.dieIf(variants.lookupAndUseUsernames == variants.useExtIdAndSsoId, 'TyE3068KHNKW2');

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
      // Chuma and Charlie are the users active in this test though (SSO-created later),
      // not these: (still needed because they are authors of pages in the TwoPagesForum)
      members: ['owen', 'maria', 'michael', 'mallory'],
    });
    assert.refEq(builder.getSite(), forum.siteData);
    const site: SiteData2 = forum.siteData;
    site.settings.enableApi = true;
    site.apiSecrets = [apiSecret];

    site.settings.ssoUrl = ssoUrl;
    site.settings.enableSso = true;

    siteIdAddress = server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
    server.skipRateLimits(siteId);
  });

  it("initialize people", () => {
    richBrowserA = new TyE2eTestBrowser(browserA);
    richBrowserB = new TyE2eTestBrowser(browserB);

    owen = forum.members.owen;
    owensBrowser = richBrowserA;
    charliesBrowser = richBrowserA;
    chumasBrowser = richBrowserB;
    maria = forum.members.maria;
    michael = forum.members.michael;
    mallory = forum.members.mallory;
    mallorysBrowser = richBrowserB;
  });


  let charliesOneTimeLoginSecret: string;

  it("The remote server upserts Charlie", () => {
    charliesOneTimeLoginSecret = server.apiV0.upsertUserGetLoginSecret({
        origin: siteIdAddress.origin,
        apiRequesterId: c.SysbotUserId,
        apiSecret: apiSecret.secretKey,
        externalUser: charlieExtUser });
  });

  let chumasOneTimeLoginSecret: string;

  it("The remote server upserts Chuma", () => {
    chumasOneTimeLoginSecret = server.apiV0.upsertUserGetLoginSecret({
        origin: siteIdAddress.origin,
        apiRequesterId: c.SysbotUserId,
        apiSecret: apiSecret.secretKey,
        externalUser: chumaExtUser });
  });

  it("Chuma logs in", () => {
    chumasBrowser.apiV0.loginWithSecret({
        origin: siteIdAddress.origin,
        oneTimeSecret: chumasOneTimeLoginSecret,
        thenGoTo: '/' });
  });


  // ----- API: List users

  if (variants.lookupAndUseUsernames) {
    let listUsersResponse: ListUsersApiResponse;

    it("Chuma lists all members, using a 3rd party client and Ty's API", () => {
      listUsersResponse = server.apiV0.listUsers({
        origin: siteIdAddress.origin,
        usernamePrefix: '',
      });
    });

    it("... gets back a list of everyone", () => {
      console.log(`Finds: ${JSON.stringify(listUsersResponse)}`);
      const users = listUsersResponse.users;
      assert.eq(users.length, 6);
      // Should be sorted by name.  TyT05RKVJF68
      assert.eq(users[0].username, charlieExtUser.username);
      assert.eq(users[1].username, chumaExtUser.username);
      assert.eq(users[2].username, mallory.username);
      assert.eq(users[3].username, maria.username);
      assert.eq(users[4].username, michael.username);
      assert.eq(users[5].username, owen.username);
    });

    it("Chuma lists only members starting with 'ch'", () => {
      listUsersResponse = server.apiV0.listUsers({
        origin: siteIdAddress.origin,
        usernamePrefix: 'ch',
      });
    });

    it("... Finds two people", () => {
      assert.eq(listUsersResponse.users.length, 2);
    });

    let charlieFromApi: UserIdName;

    it("... namely Charlie", () => {
      charlieFromApi = listUsersResponse.users[0];
      assert.eq(charlieFromApi.username, charlieExtUser.username);
    });

    let chumaFromApi: UserIdName;

    it("... and Chuma", () => {
      chumaFromApi = listUsersResponse.users[1];
      assert.eq(chumaFromApi.username, chumaExtUser.username);
    });

    it("Make this test use 'username:...' refs, not 'extid:' or 'ssoid:'", () => {
      const chumaRef = `username:${chumaFromApi.username}`;
      const charlieRef = `username:${charlieFromApi.username}`;
      chatPageOne.authorRef = chumaRef;
      chatPageOne.pageMemberRefs = [chumaRef, charlieRef];
      chumaSaysHiCharlieChatMessage.authorRef = chumaRef;
      charlieSaysHiChuma.authorRef = charlieRef;
      chumaRepliesToCharlie.authorRef = chumaRef;
    });
  }


  // ----- API: Upsert chat page incl first message

  let upsertResponse;

  it("Chuma sends a messag to Charlie, via an external server and the API", () => {
    upsertResponse = server.apiV0.upsertSimple({
      origin: siteIdAddress.origin,
      apiRequesterId: c.SysbotUserId,
      apiSecret: apiSecret.secretKey,
      data: {
        upsertOptions: { sendNotifications: true },
        pages: [chatPageOne],
        posts: [chumaSaysHiCharlieChatMessage],
      },
    });
  });

  let firstUpsertedPage: any;

  it("... gets back the upserted page in the server's response", () => {
    console.log("Page ups resp:\n\n:" + JSON.stringify(upsertResponse, undefined, 2));

    assert.eq(upsertResponse.pages.length, 1);
    firstUpsertedPage = upsertResponse.pages[0];

    assert.eq(firstUpsertedPage.urlPaths.canonical, '/-1/chatpageone-title');

    assert.eq(firstUpsertedPage.id, '1');
    assert.eq(firstUpsertedPage.pageType, c.TestPageRole.PrivateChat);
    utils.checkNewPageFields(firstUpsertedPage, {
      categoryId: forum.categories.specificCategory.id,
      numPostsTotal: 3,  // title, body, 1st chat message
      // authorId: ??
    });

    // The chat message = [0], page title & body not included. [205WKTJF4]
    assert.eq(upsertResponse.posts.length, 1);
    utils.checkNewPostFields(upsertResponse.posts[0], {
      postNr: c.FirstReplyNr,
      parentNr: undefined,
      postType: PostType.ChatMessage,
      pageId: '1',
      // authorId: chuma.id, // ?? what id did the server assign to Chuma
      approvedSource: chumaSaysHiCharlieChatMessage.body,
    });
  });


  it("Charlie gets an email notification about the chat message", () => {
    // COULD incl the chat *message* in the notification, [PATCHNOTF]
    // not the page title and body.
    server.waitUntilLastEmailMatches(
        siteIdAddress.id, charlieExtUser.primaryEmailAddress,
        ['charlie', chatPageOne.title, chatPageOne.body], browserA);
  });

  let prevNumEmailsSent = 0;

  it("But no one else", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.eq(num, prevNumEmailsSent + 1, `Emails sent to: ${addrsByTimeAsc}`);
    prevNumEmailsSent = num;
  });



  it("Charlie replies to Chuma: Upserts page again, + new message", () => {
    upsertResponse = server.apiV0.upsertSimple({
      origin: siteIdAddress.origin,
      apiRequesterId: c.SysbotUserId,
      apiSecret: apiSecret.secretKey,
      data: {
        upsertOptions: { sendNotifications: true },
        pages: [chatPageOne],         // <—— has no effect, page already exists
        posts: [charlieSaysHiChuma],  // <—— but this adds a new chat message
      },
    });
  });

  let chumasNotfLink: string;

  it("Chuma gets an email notification, remembers the link", () => {
    const emailMatchResult: EmailMatchResult = server.waitUntilLastEmailMatches(
        siteIdAddress.id, chumaExtUser.primaryEmailAddress,
        ['chuma', charlieSaysHiChuma.body], browserA);
    chumasNotfLink = utils.findAnyFirstLinkToUrlIn(
        siteIdAddress.origin, emailMatchResult.matchedEmail.bodyHtmlText);
    lad.logMessage(`Chuma's notification link: ${chumasNotfLink}`);
  });

  it("But no one else", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.eq(num, prevNumEmailsSent + 1, `Emails sent to: ${addrsByTimeAsc}`);
    prevNumEmailsSent = num;
  });



  it("Chuma replies again: Upserts only a message (not the page)", () => {
    upsertResponse = server.apiV0.upsertSimple({
      origin: siteIdAddress.origin,
      apiRequesterId: c.SysbotUserId,
      apiSecret: apiSecret.secretKey,
      data: {
        upsertOptions: { sendNotifications: true },
        // pages: [chatPageOne],         // <—— skip the page, this time
        posts: [chumaRepliesToCharlie],  // <—— only upsert the chat message
      },
    });
  });

  let charliesNotfEmail: EmailSubjectBody;
  let charliesNotfLink: string;

  // All private chat topic members get notified, by default, about
  // new chat messages.
  //
  it("Charlie gets an email notification, because is private chat page", () => {
    charliesNotfEmail = server.waitUntilLastEmailMatches(
        siteIdAddress.id, charlieExtUser.primaryEmailAddress,
        ['charlie', chumaRepliesToCharlie.body], browserA).matchedEmail;
  });

  it("... he remembers the notf link", () => {
    charliesNotfLink = utils.findAnyFirstLinkToUrlIn(
        siteIdAddress.origin, charliesNotfEmail.bodyHtmlText);
    lad.logMessage(`Charlies's notification link: ${charliesNotfLink}`);
  });

  it("But no one else gets notified", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.eq(num, prevNumEmailsSent + 1, `Emails sent to: ${addrsByTimeAsc}`);
    prevNumEmailsSent = num;
  });



  // ----- Access control: Not logged in

  it("Charlies opens the notification link", () => {
    charliesBrowser.go2(charliesNotfLink);
  });


  it("... but he's not logged in", () => {
    charliesBrowser.assertNotFoundError();
  });


  // ----- Access control ctd, + Login link

  it("Charlie logs in via his one-time login link", () => {
    charliesBrowser.apiV0.loginWithSecret({
        origin: siteIdAddress.origin,
        oneTimeSecret: charliesOneTimeLoginSecret,
        thenGoTo: '/' });
  });


  it("... opens the notification link again", () => {
    charliesBrowser.go2(charliesNotfLink);
  });


  it("... now sees Chuma's message", () => {
    charliesBrowser.topic.waitForPostAssertTextMatches(
        c.FirstReplyNr + 2, chumaRepliesToCharlie.body);
  });


  // ----- Access control: Other members

  it("Mallory logs in, tries to access the chat", () => {
    utils.ssoLogin({ member: mallory, ssoId: 'mallorys sso id', browser: mallorysBrowser,
        origin: siteIdAddress.origin, server, apiSecret: apiSecret.secretKey,
        thenGoTo: charliesNotfLink });
  });

  it("... but not allowed", () => {
    mallorysBrowser.assertNotFoundError();
  });


  // ----- Page ok?

  it("The page looks fine", () => {
    charliesBrowser.chat.waitAndAssertPurposeMatches(chatPageOne.body);
    charliesBrowser.topic.assertPostTextMatches(
        c.FirstReplyNr + 0, chumaSaysHiCharlieChatMessage.body);
    charliesBrowser.topic.assertPostTextMatches(
        c.FirstReplyNr + 1, charlieSaysHiChuma.body);
    // c.FirstReplyNr + 2, chumaRepliesToCharlie: tested already.
  });


  // ----- The upserted page works: Can post replies via Ty's interface, not only API

  it("Charlie posts a message", () => {
    charliesBrowser.chat.addChatMessage(
        `This works fine, like ducks digging for bucks to buy daisies`);
  });

  it("... Chuma gets notified", () => {
    server.waitUntilLastEmailMatches(
        siteIdAddress.id, chumaExtUser.primaryEmailAddress,
        [chumaExtUser.username, 'ducks digging for bucks'], browserA);
  });

  it("But no one else", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.eq(num, prevNumEmailsSent + 1, `Emails sent to: ${addrsByTimeAsc}`);
    prevNumEmailsSent = num;
  });

}


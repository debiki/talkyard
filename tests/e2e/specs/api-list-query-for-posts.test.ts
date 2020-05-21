/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('../utils/ty-assert');
// import fs = require('fs');  EMBCMTS
import server = require('../utils/server');
import utils = require('../utils/utils');
import settings = require('../utils/settings');
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/pages-for';
import lad = require('../utils/log-and-die');
import c = require('../test-constants');


let owen: Member;
let owensBrowser: TyE2eTestBrowser;
let maria: Member;
let mariasBrowser: TyE2eTestBrowser;

let siteIdAddress: IdAddress;
let siteId;

let forum: EmptyTestForum;
const forumTitle = 'List posts via API E2E test';

const pageAaaId = 'pageAaaId';
const pageAaaTitle = 'pageAaaTitle';
const pageAaaBody = 'pageAaaBody';
let pageAaaJustAdded: PageJustAdded | U;

const pageBbbId = 'pageBbbId';
const pageBbbTitle = 'pageBbbTitle';
const pageBbbBody = 'pageBbbBody';
let pageBbbJustAdded: PageJustAdded | U;

const mariasReplyOne = 'mariasReplyOne';

const apiSecret: TestApiSecret = {
  nr: 1,
  userId: c.SysbotUserId,
  createdAt: c.MinUnixMillis,
  deletedAt: undefined,
  isDeleted: false,
  secretKey: 'publicE2eTestSecretKeyAbc123',
};


describe("api-list-query-for-posts.test.ts  TyT503RKDGF", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addEmptyForum({
      title: forumTitle,
      members: ['michael', 'maria', 'owen'],
    });

    pageAaaJustAdded = builder.addPage({
      id: pageAaaId,
      createdAtMs: c.JanOne2020HalfPastFive + 10*1000,
      folder: '/',
      showId: false,
      slug: 'page-aaa',
      role: c.TestPageRole.Discussion,
      title: pageAaaTitle,
      body: pageAaaBody,
      categoryId: forum.categories.categoryA.id,
      authorId: forum.members.maria.id,
    });

    pageBbbJustAdded = builder.addPage({
      id: 'pageBbbId',
      createdAtMs: c.JanOne2020HalfPastFive + 30*1000,
      folder: '/',
      showId: false,
      slug: 'page-zzz',
      role: c.TestPageRole.Discussion,
      title: pageBbbTitle,
      body: pageBbbBody,
      categoryId: forum.categories.categoryA.id,
      authorId: forum.members.michael.id,
    });

    // Enable API.
    builder.settings({ enableApi: true });
    builder.getSite().apiSecrets = [apiSecret];

    assert.refEq(builder.getSite(), forum.siteData);
    siteIdAddress = server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
    server.skipRateLimits(siteId);
  });

  it("initialize people", () => {
    const richBrowserA = new TyE2eTestBrowser(oneWdioBrowser);
    owen = forum.members.owen;
    maria = forum.members.maria;
    mariasBrowser = richBrowserA;
    owensBrowser = richBrowserA;
  });


  it("Maria goes to the forum, logs in", () => {
    mariasBrowser.go2(siteIdAddress.origin);
    // Log in, so can post a post, later below.
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });


  // ----- List Query: Newest posts first


  function listPostsImpl(what?: 'Fail' | TestApiSecret): ListQueryResults<PostListed> | string {
    return server.apiV0.listQuery<PostListed>({
      origin: siteIdAddress.origin,
      listQuery: {
        findWhat: 'Posts',
      },
      sortOrder: 'NewestFirst',
    }, {
      fail: what === 'Fail',
      apiRequesterId: (what as TestApiSecret)?.userId,
      apiSecret: (what as TestApiSecret)?.secretKey,
    })
  }

  function listPosts(apiSecret?: TestApiSecret): ListQueryResults<PostListed> {
    return listPostsImpl(apiSecret) as ListQueryResults<PostListed>;
  }

  function listPostsButFail(): string {
    return listPostsImpl('Fail') as string;
  }

  let response: ListQueryResults<PostListed>;
  let posts: PostListed[];


  it("Maria lists posts", () => {
    response = listPosts();
    posts = response.thingsFound;
  });

  const eight = 8;

  it(`She finds ${eight} posts`, () => {
    // Page Aaa and Bbb title and body: 2 + 2, +
    // CategoryA about page title and body: 2,  +
    // Forum title and intro text:  2  =  8
    // Or maybe excl titles by default? [DONTLISTTTL]
    assert.eq(posts.length, eight, `Response:\n`, response);
  });



  it("The first post is the most recently added page: Bbb, the body text", () => {
    assert.eq(posts[0].approvedHtmlSanitized, `<p>${pageBbbBody}</p>`);
    assert.eq(posts[0].pageId, pageBbbId);
    assert.eq(posts[0].pageTitle, pageBbbTitle);
  });

  it("The 2nd is Bbb's title", () => {
    assert.includes(posts[1].approvedHtmlSanitized, pageBbbTitle);
    assert.eq(posts[1].pageId, pageBbbId);
    assert.eq(posts[1].pageTitle, pageBbbTitle);  // hmm a bit weird [DONTLISTTTL]
  });

  let pageAaaBodyPost: PostListed | U;

  it("The 3rd is Aaa's body", () => {
    assert.includes(posts[2].approvedHtmlSanitized, pageAaaBody);
    assert.eq(posts[2].pageId, pageAaaId);
    assert.eq(posts[2].pageTitle, pageAaaTitle);  // hmm a bit weird [DONTLISTTTL]
    pageAaaBodyPost = posts[2];
  });

  it("The 4th is Aaa's title", () => {
    assert.includes(posts[3].approvedHtmlSanitized, pageAaaTitle);
    assert.eq(posts[3].pageTitle, pageAaaTitle);  // hmm a bit weird [DONTLISTTTL]
    assert.eq(posts[3].pageId, pageAaaId);
  });

  /*
  it("All of them are in Category A", () => {
    const catName = forum.categories.categoryA.name;
    assert.eq(posts[0].categoriesMainFirst?.[0]?.name, catName);
    assert.eq(posts[1].categoriesMainFirst?.[0]?.name, catName);
    assert.eq(posts[2].categoriesMainFirst?.[0]?.name, catName);
  }); */

  it("The author names are correct", () => {
    assert.eq(posts[0].author?.username, forum.members.michael.username);
    assert.eq(posts[1].author?.username, forum.members.michael.username);
    assert.eq(posts[2].author?.username, maria.username);
    assert.eq(posts[3].author?.username, maria.username);
  });

  it("Maria opens page Aaa", () => {
    mariasBrowser.go2(pageAaaBodyPost.urlPath);
  });

  it("The title, body and reply are all there", () => {
    mariasBrowser.topic.waitForPostAssertTextMatches(c.TitleNr, pageAaaTitle);
    mariasBrowser.topic.waitForPostAssertTextMatches(c.BodyNr, pageAaaBody);
  });


  // ----- New replies


  it("Maria replies", () => {
    mariasBrowser.complex.replyToOrigPost(mariasReplyOne);
    mariasBrowser.topic.waitUntilPostTextMatches(c.FirstReplyNr, mariasReplyOne);
  });

  it("Maria again lists posts", () => {
    response = listPosts();
    posts = response.thingsFound;
  });

  it(`She finds ${eight + 1} posts`, () => {
    assert.eq(posts.length, eight + 1, `Response:\n`, response);
  });

  it(`Her mmost recent reply first, and the other ${eight} follows`, () => {
    checkAllPosts(eight + 1);
  });


  function checkAllPosts(howMany: number) {
    if (howMany === eight + 1) {
      assert.includes(posts[0].approvedHtmlSanitized, mariasReplyOne);
      assert.includes(posts[1].approvedHtmlSanitized, pageBbbBody);
      assert.includes(posts[2].approvedHtmlSanitized, pageBbbTitle);
      assert.includes(posts[3].approvedHtmlSanitized, pageAaaBody);
      assert.includes(posts[4].approvedHtmlSanitized, pageAaaTitle);
      assert.includes(posts[5].approvedHtmlSanitized, forum.categories.categoryA.aboutPage.body);
      assert.includes(posts[6].approvedHtmlSanitized, forum.categories.categoryA.name);
      assert.includes(posts[7].approvedHtmlSanitized, "intro text");
      assert.includes(posts[8].approvedHtmlSanitized, forumTitle);
    }
    else if (howMany === 2) {
      assert.includes(posts[0].approvedHtmlSanitized, "intro text");
      assert.includes(posts[1].approvedHtmlSanitized, forumTitle);
    }
    else {
      lad.die('TyE30679084K');
    }
  }

  // ----- Private topics stay private   TyT502RKDJ46


  it("Owen logs in", () => {
    mariasBrowser.topbar.clickLogout();
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
  });


  it("Owen goes to category A", () => {
    owensBrowser.topbar.clickHome();
    owensBrowser.forumTopicList.switchToCategory(forum.categories.categoryA.name);
  });
  it("... eits security settings", () => {
    owensBrowser.forumButtons.clickEditCategory();
    owensBrowser.categoryDialog.openSecurityTab();
  });
  it("... makes it restricted: removes the Everyone group  TyT69WKTEJG4", () => {
    owensBrowser.categoryDialog.securityTab.removeGroup(c.EveryoneId);
    // ?? owensBrowser.categoryDialog.securityTab.addGroup(c.EveryoneFullName);
  });
  it("... saves", () => {
    owensBrowser.categoryDialog.submit();
  });


  it("Maria lists pages again", () => {
    response = listPosts();
    posts = response.thingsFound;
  });

  it("... now finds only the forum title and intro posts", () => {
    assert.eq(posts.length, 2, `Response:\n`, response);
  });

  it("... they look correct: the forum title, and intro text", () => {
    checkAllPosts(2);
  });


  it("Owen makes the forum Login-Required", () => {
    owensBrowser.adminArea.settings.login.goHere();
    owensBrowser.adminArea.settings.login.setLoginRequired(true);
    owensBrowser.adminArea.settings.clickSaveAll();
  });

  let errorText: string | U;

  it("Maria lists pages again", () => {
    errorText = listPostsButFail();
  });

  it("... now gets an error about not being logged in", () => {
    assert.includes(errorText, 'TyE0AUTHN_');
  });


  // ----- List private things via API secret   TyT702KRJGF57


  it("However, Sysbot can list all posts", () => {
    response = listPosts(apiSecret);
    posts = response.thingsFound;
  });

  it(`... finds all ${eight + 1} posts`, () => {
    assert.eq(posts.length, 9, `Response:\n`, response);
  });

  it("... they look fine", () => {
    checkAllPosts(eight + 1);
  });

});


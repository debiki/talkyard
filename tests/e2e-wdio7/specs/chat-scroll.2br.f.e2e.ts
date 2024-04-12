/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import * as fs from 'fs';
import server from '../utils/server';
import * as utils from '../utils/utils';
import * as make from '../utils/make';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/ty-e2e-test-browser';
import settings from '../utils/settings';
import { dieIf } from '../utils/log-and-die';
import c from '../test-constants';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let maria: Member;
let maria_brB: TyE2eTestBrowser;
let stranger_brB: TyE2eTestBrowser;

// For embedded comments:  EMBCMTS
// const localHostname = 'comments-for-e2e-test-embsth-localhost-8080';
// const embeddingOrigin = 'http://e2e-test-embsth.localhost:8080';

let site: IdAddress;
let forum: TwoCatsTestForum;  // or TwoPagesTestForum or EmptyTestForum or LargeTestForum

let michaelsTopicUrl: St;
let mariasTopicUrl: St;
let chatPageUrl: St;

const apiSecret: TestApiSecret = {
  nr: 1,
  userId: c.SysbotUserId,
  createdAt: c.MinUnixMillis,
  deletedAt: undefined,
  isDeleted: false,
  secretKey: 'publicE2eTestSecretKeyAbc123',
};



describe(`some-e2e-test  TyTE2E1234ABC`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addCatABForum({
      title: "Some E2E Test",
      categoryAExtId: 'cat_a_ext_id',
      members: ['maria'],
    });

    const chatPage: PageJustAdded = builder.addPage({
      id: 'chatPageId',
      folder: '/',
      showId: false,
      slug: 'chat-page',
      role: c.TestPageRole.JoinlessChat,
      title: "Scroll Test Chat",
      body: "Note that you can't scroll faster than 3e10 cm per second.",
      categoryId: forum.categories.categoryA.id,
      authorId: forum.members.maria.id,
    });

    for (let nr = c.FirstReplyNr; nr < c.FirstReplyNr + 150; nr += 1) {
      builder.addPost({
        page: chatPage,
        nr,
        // parentNr: c.BodyNr, ? not needed for chats ?
        authorId: forum.members.maria.id,
        approvedSource: `Message_nr_${nr}`,
      });
    }

    // Disable notifications, or notf email counts will be off
    // (since Owen would get emails).
    builder.settings({
      numFirstPostsToApprove: 0,
      //maxPostsPendApprBefore: 0,
      numFirstPostsToReview: 0,
    });
    builder.getSite().pageNotfPrefs = [{
      memberId: forum.members.owen.id,
      notfLevel: c.TestPageNotfLevel.Muted,
      wholeSite: true,
    }];

    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;

    maria = forum.members.maria;
    maria_brB = brB;
    stranger_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = await server.importSiteData(forum.siteData);
    await server.skipRateLimits(site.id);
    chatPageUrl = site.origin + '/chat-page';
  });


  it(`Owen goes to the chat page`, async () => {
    await owen_brA.go2(chatPageUrl);
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
  });


  it(`Maria too`, async () => {
    await maria_brB.go2(chatPageUrl);
    await maria_brB.complex.loginWithPasswordViaTopbar(maria);
  });


});


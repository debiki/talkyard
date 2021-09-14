/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/pages-for';
import c from '../test-constants';

let allBrowsers: TyAllE2eTestBrowsers;
let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let mons: Member;
let maja: Member;
let memah: Member;
let memah_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoPagesTestForum;

let michaelsPageUrl: St;
let mariasPageUrl: St;
let mariasPageExtId = 'marias_page_extid';

const apiSecret: TestApiSecret = {
  nr: 1,
  userId: c.SysbotUserId,
  createdAt: c.MinUnixMillis,
  deletedAt: undefined,
  isDeleted: false,
  secretKey: 'publicE2eTestSecretKey123456',
};

const owensReplyOne = 'owensReplyOne';
const whereIsTheLikeVote_mentionMaja = 'where_is_like_vote @maja';
const memahsReplyOne = 'memahsReplyOne';


describe(`do-api-like-and-subscribe.2br  TyTEAPILIKESUBS`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      title: `Do API Like and Subscribe E2e Test`,
      members: ['owen', 'mons', 'maja', 'memah', 'michael', 'maria'],
    });

    // Disable notifications, or notf email counts will be off
    // (since Owen would get emails).
    builder.settings({
      numFirstPostsToApprove: 0,
      numFirstPostsToReview: 0,
    });

    // Enable API.
    builder.settings({ enableApi: true });
    builder.getSite().apiSecrets = [apiSecret];

    // Skip notifications to the page authors.
    builder.getSite().pageNotfPrefs = [{
      memberId: forum.members.michael.id,
      notfLevel: c.TestPageNotfLevel.Muted,
      wholeSite: true,
    }, {
      memberId: forum.members.maria.id,
      notfLevel: c.TestPageNotfLevel.Muted,
      wholeSite: true,
    }];

    builder.updatePage(forum.topics.byMariaCatA.id, (page: PageToAdd) => {
      page.extId = mariasPageExtId;
    });

    allBrowsers = new TyE2eTestBrowser(allWdioBrowsers, 'brAll');
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;

    mons = forum.members.mons;
    mons.extId = 'mons_extid';

    maja = forum.members.maja;

    memah = forum.members.memah;
    memah.ssoId = 'memah_ssoid';
    memah_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
    michaelsPageUrl = site.origin + '/' + forum.topics.byMichaelCategoryA.slug;
    mariasPageUrl = site.origin + '/' + forum.topics.byMariaCategoryA.slug;
  });


  // ----- Prepare

  it(`Owen goes to Michael's topic`, async () => {
    await owen_brA.go2(michaelsPageUrl);
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
  });
  it(`There're no Like votes`, async () => {
    await owen_brA.waitForMyDataAdded();
    const isOpLiked = await owen_brA.topic.isPostLiked(c.BodyNr);
    assert.not(isOpLiked, "No orig post like vote");  // ttt
  });


  it(`Memah goes to Michael's page too`, async () => {
    await memah_brB.go2(michaelsPageUrl);
    await memah_brB.complex.loginWithPasswordViaTopbar(memah);
  });

  let apiResp;


  // ----- One Do API action at a time

  it(`Memah via the Do API likes Michael's page`, async () => {
    apiResp = await server.apiV0.do_({
      origin: site.origin,
      apiRequesterId: c.SysbotUserId,
      apiSecret: apiSecret.secretKey,
      data: {
        doActions: [
              makeLikeAction(
                  // Test direct id refs.  TyTREFTYPES01
                  'userid:' + memah.id, 'pageid:' + forum.topics.byMichaelCatA.id)],
      },
    });
  });

  it(`... and subscribes to new replies`, async () => {
    apiResp = await server.apiV0.do_({
      origin: site.origin,
      apiRequesterId: c.SysbotUserId,
      apiSecret: apiSecret.secretKey,
      data: {
        doActions: [
              makeSubscribeAction(
                  // Test an ssoid ref, and, for the page, a tyid ref.  TyTREFTYPES01
                  'ssoid:memah_ssoid', 'tyid:' + forum.topics.byMichaelCatA.id)],
      },
    });
  });


  // ----- Two actions at once

  it(`Mons via the Do API likes Maria's page and subscribes`, async () => {
    apiResp = await server.apiV0.do_({
      origin: site.origin,
      apiRequesterId: c.SysbotUserId,
      apiSecret: apiSecret.secretKey,
      data: {
        doActions:
              makeLikeAndSubscribeActions(
                  // Test extid refs.  TyTREFTYPES01
                  'extid:mons_extid', 'extid:' + mariasPageExtId),
      },
    });
  });


  // ----- It works?

  it(`Owen sees the Like vote`, async () => {
    await owen_brA.refresh2();
    await owen_brA.waitForMyDataAdded();                      // [.my_data_first]
    assert.that(await owen_brA.topic.isPostLiked(c.BodyNr));  // ttt
  });

  it(`Memah sees it too — and it's her vote`, async () => {
    await memah_brB.refresh2();
    await memah_brB.topic.waitForLikeVote(c.BodyNr);
    assert.that(await memah_brB.topic.isPostLiked(c.BodyNr, { byMe: true }));
  });

  it(`Memah sees her notification level is New Replies`, async () => {
    await memah_brB.metabar.assertPageNotfLevelIs(c.TestPageNotfLevel.EveryPost);
  });


  it(`Owen replies to Michael. But maybe a bad idea!  TyTDISCRE08`, async () => {
    await owen_brA.complex.replyToOrigPost(owensReplyOne);
  });

  it(`... Memah gets a notf email (subscribed via the Do API)`, async () => {
    await server.waitUntilLastEmailMatches(site.id, memah.emailAddress, owensReplyOne);
  });


  // ----- Undoing the actions

  it(`Memah removes the Like vote! And unsubscribes`, async () => {
    apiResp = await server.apiV0.do_({
      origin: site.origin,
      apiRequesterId: c.SysbotUserId,
      apiSecret: apiSecret.secretKey,
      data: {
        doActions:
              makeLikeAndSubscribeActions(
                  // Test username:  and pagepath: refs.  TyTREFTYPES01
                  'username:' + memah.username,
                  'pagepath:/' + forum.topics.byMichaelCatA.slug, // id not shown in url
                  true /* undo */),
      },
    });
  });

  it(`Owen sees the Like vote no more`, async () => {
    await owen_brA.refresh2();
    await owen_brA.waitForMyDataAdded();   // [.my_data_first]
    assert.not(await owen_brA.topic.isPostLiked(c.BodyNr));
  });

  it(`Owen replies again`, async () => {
    await owen_brA.complex.replyToOrigPost(whereIsTheLikeVote_mentionMaja);
  });

  it(`Memah goes to Maria's page`, async () => {
    await memah_brB.go2(mariasPageUrl);
  });
  it(`... replies — Mons has subscribed`, async () => {
    await memah_brB.complex.replyToOrigPost(memahsReplyOne);
  });

  it(`... Maja gets a notification — Owen @mentioned her`, async () => {
    await server.waitUntilLastEmailMatches(
            site.id, maja.emailAddress, 'where_is_like_vote');
  });
  it(`... Mons gets a notification about Memah's reply`, async () => {
    await server.waitUntilLastEmailMatches(site.id, mons.emailAddress, memahsReplyOne);
  });


  let addrsByTimeAsc_;

  it(`Memah didn't get any notf about Owen's last reply`, async () => {
    // If Memah incorrectly got another notification, it should have arrived
    // before the one to Owen (it got sent first).
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(site.id);
    const numNotfEmailsSent = 3; // to Memah, Maja, Mons
    assert.eq(num, numNotfEmailsSent, `Emails sent to: ${addrsByTimeAsc}`);
    addrsByTimeAsc_ = addrsByTimeAsc;
  });

  it(`... insetad: Memah, Maja, Mons, no others`, async () => {
    assert.deepEq(addrsByTimeAsc_, [
          memah.emailAddress, maja.emailAddress, mons.emailAddress]);
  });



  function makeLikeAndSubscribeActions(asWho: St, whatPage: St, undo?: true): Action[] {
    return [
        makeLikeAction(asWho, whatPage, undo),
        makeSubscribeAction(asWho, whatPage, undo)];
  }

  function makeLikeAction(asWho: St, whatPage: St, undo?: true): Action {
    return {
      asWho,
      doWhat: 'SetVote',
      doHow: { whatPage, whatVote: 'Like', howMany: undo ? 0 : 1 },
    };
  }

  function makeSubscribeAction(asWho: St, whatPage: St, undo?: true): Action {
    return {
      asWho,
      doWhat: 'SetNotfLevel',
      doHow: { whatPage, whatLevel: undo ? 'Normal' : 'NewPosts', }
    };
  }

});


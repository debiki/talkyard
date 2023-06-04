/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';

let allBrowsers: TyAllE2eTestBrowsers;
let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let mons: Member;
let mons_brA: TyE2eTestBrowser;
let corax: MemberFound;
let corax_brA: TyE2eTestBrowser;
let maja: Member;
let memah: Member;
let memah_brB: TyE2eTestBrowser;
let michael: Member;
let stranger_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoCatsTestForum;

const thePagePath = '/the-page';
const buyMilkPagePath = '/buy-milk';
const buyMilkPageUrlRegex = /https?:\/\/e2e-test-[^/]+\/-buyMilkPageId#post-1/;



describe(`assign-to-notfs.2br.d  TyTASSIGN02`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "Assign-To E2E Test",
      members: ['owen', 'mons', 'corax', 'maja', 'memah', 'michael']
    });

    builder.addPage({
      id: 'thePage',
      folder: '/',
      showId: false,
      slug: thePagePath.substring(1),
      role: c.TestPageRole.Idea,
      title: "Buy cream",
      body: "We have milk but we need cream too. Can we buy cream or take from our neighbor?",
      categoryId: forum.categories.categoryA.id,
      authorId: forum.members.maja.id,
    });

    // Disable notifications, or notf email counts will be off
    // (since Owen would get emails).
    builder.settings({
      numFirstPostsToApprove: 0,
      //maxPostsPendApprBefore: 0,
      numFirstPostsToReview: 0,
    });
    builder.getSite().pageNotfPrefs = [{
      memberId: forum.members.corax.id,
      notfLevel: c.TestPageNotfLevel.EveryPost,
      wholeSite: true,
    }];

    allBrowsers = new TyE2eTestBrowser(allWdioBrowsers, 'brAll');
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;
    mons = forum.members.mons;
    mons_brA = brA;
    corax = forum.members.corax;
    corax_brA = brA;

    maja = forum.members.maja;
    memah = forum.members.memah;
    memah_brB = brB;
    michael = forum.members.michael;
    stranger_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = await server.importSiteData(forum.siteData);
    await server.skipRateLimits(site.id);
  });


  it(`Corax goes to the-page, logs in`, async () => {
    await corax_brA.go2(site.origin + thePagePath);
    await corax_brA.complex.loginWithPasswordViaTopbar(corax);
  });


  // ----- Was a bug: Can assign also if subscribed

  it(`Corax starts assigning the page to Memah`, async () => {
    await owen_brA.topic.openAssignToDiag();
    await owen_brA.addUsersToPageDialog.addOneUser(memah.username);
  });
  it(`... submits, works fine although he is subscribed to notfs  TyTASGNOTFSELF`, async () => {
    await owen_brA.addUsersToPageDialog.submit();
  });
  it(`... sees Memah now listed as assignee`, async () => {
    await owen_brA.topic.waitForAssigneesUsernamesNoAt(c.BodyNr, [memah.username]);
  });


  it(`Corax opens the assignees dialog again ...`, async () => {
    await corax_brA.topic.openAssignToDiag();
  });
  it(`... clears current assignees (Memah)`, async () => {
    await corax_brA.addUsersToPageDialog.clear();
  });
  it(`... assigns himself`, async () => {
    await corax_brA.addUsersToPageDialog.addOneUser(corax.username);
    await corax_brA.addUsersToPageDialog.submit();
  });
  it(`... sees himself listed as assignee`, async () => {
    await corax_brA.topic.waitForAssigneesUsernamesNoAt(c.BodyNr, [corax.username]);
  });


});


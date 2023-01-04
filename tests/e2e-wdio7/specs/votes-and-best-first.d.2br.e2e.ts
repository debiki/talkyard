/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import * as make from '../utils/make';
import { buildSite } from '../utils/site-builder';
import c from '../test-constants';

let browser: TyE2eTestBrowser;
declare const $$: any; // webdriver.io global utility   DELETE use  assertPostOrderIs insted [59SKEDT0652]

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owensBrowser: TyE2eTestBrowser;
let modya;
let modyasBrowser: TyE2eTestBrowser;
let mons;
let monsBrowser: TyE2eTestBrowser;
let corax;
let coraxBrowser: TyE2eTestBrowser;
let regina;
let reginasBrowser: TyE2eTestBrowser;
let michael;
let michaelsBrowser: TyE2eTestBrowser;

let site: IdAddress;

let forum: LargeTestForum;

// We add them in order XX, CC, YY, BB, ZZ, AA, so that they start with an "incorrect" sort order.
const postNrXX = 2;
const postNrCC = 3;
const postNrYY = 4;
const postNrBB = 5;
const postNrZZ = 6;
const postNrAA = 7;

/**
 * The tests:
 *
 * [AA: 3 likes]   [BB: 2 likes]  [CC: 1 likes]   [XX: 0 likes]   [YY: 0 likes]  [FF: 0 likes]
 *
 * One AA like undone, BB gets one instead —> placed before AA.
 *
 * Someone disagrees with CC and XX — only XX gets placed last, since no upwoves.
 *
 * Someone bury-votes CC and YY — YY gets placed last, after XX and ZZ.
 * YY bury vote undone —> placed before XX and ZZ again.
 *
 * XX disagree vote undone, moved back again to before YY and ZZ.
 *
 * Only Staff can Unwant AA.
 * Staff Unwants AA, it gets placed last.
 * Unwanted vote cancelled, AA gets placed first again.
 */
describe(`votes-and-best-first  TyTESORTBEST`, () => {

  it("import a site", async () => {
    forum = buildSite().addLargeForum({ title: "Votes Forum" });
    const siteData: SiteData2 = forum.siteData as SiteData2;

    siteData.settings.discPostSortOrder = c.SortOrderBestFirst;

    // Add AA, BB, CC, XX, YY, ZZ, but not in that order, instead, an a bit random
    // order: AA, BB, CC reversed and inserted in between the others. Then, when
    // adding votes, we'll notice if AA, BB, CC will get sorted correctly.
    siteData.posts.push(make.post({
      nr: postNrXX,
      parentNr: c.BodyNr,
      page: forum.topics.byMariaCategoryA,
      approvedSource: 'XX',
    }));
    siteData.posts.push(make.post({
      nr: postNrCC,
      parentNr: c.BodyNr,
      page: forum.topics.byMariaCategoryA,
      approvedSource: 'CC',
    }));
    siteData.posts.push(make.post({
      nr: postNrYY,
      parentNr: c.BodyNr,
      page: forum.topics.byMariaCategoryA,
      approvedSource: 'YY',
    }));
    siteData.posts.push(make.post({
      nr: postNrBB,
      parentNr: c.BodyNr,
      page: forum.topics.byMariaCategoryA,
      approvedSource: 'BB',
    }));
    siteData.posts.push(make.post({
      nr: postNrZZ,
      parentNr: c.BodyNr,
      page: forum.topics.byMariaCategoryA,
      approvedSource: 'ZZ',
    }));
    siteData.posts.push(make.post({
      nr: postNrAA,
      parentNr: c.BodyNr,
      page: forum.topics.byMariaCategoryA,
      approvedSource: 'AA',
    }));

    site = await server.importSiteData(siteData);
  });

  it("initialize people", async () => {
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');  // not needed? Maybe later

    owensBrowser = brA;
    modyasBrowser = owensBrowser;
    monsBrowser = owensBrowser;
    coraxBrowser = owensBrowser;
    reginasBrowser = owensBrowser;
    michaelsBrowser = owensBrowser;

    michael = forum.members.michael;
    modya = forum.members.modya;
    mons = forum.members.mons;
    corax = forum.members.corax;
    regina = forum.members.regina;
  });


  // ----- Like votes

  it("Michael likes post AA", async () => {
    await michaelsBrowser.go2(site.origin + '/' + forum.topics.byMariaCategoryA.slug);
    await michaelsBrowser.complex.loginWithPasswordViaTopbar(michael);
    await michaelsBrowser.topic.toggleLikeVote(postNrAA);
    assert.that(await michaelsBrowser.topic.isPostLikedByMe(postNrAA));
  });

  it("... and BB and CC too", async () => {
    await michaelsBrowser.topic.toggleLikeVote(postNrBB);
    await michaelsBrowser.topic.toggleLikeVote(postNrCC);
    assert.that(await michaelsBrowser.topic.isPostLikedByMe(postNrBB));
    assert.that(await michaelsBrowser.topic.isPostLikedByMe(postNrCC));
  });

  it("... but not the others", async () => {
    assert.not(await michaelsBrowser.topic.isPostLikedByMe(postNrXX));
    assert.not(await michaelsBrowser.topic.isPostLikedByMe(postNrYY));
    assert.not(await michaelsBrowser.topic.isPostLikedByMe(postNrZZ));
  });

  it("Mons likes AA and BB", async () => {
    await michaelsBrowser.topbar.clickLogout();
    await monsBrowser.complex.loginWithPasswordViaTopbar(mons);
    await monsBrowser.topic.toggleLikeVote(postNrAA);
    await monsBrowser.topic.toggleLikeVote(postNrBB);
    assert.that(await monsBrowser.topic.isPostLikedByMe(postNrAA));
    assert.that(await monsBrowser.topic.isPostLikedByMe(postNrBB));
  });

  it("Modya likes AA", async () => {
    await monsBrowser.topbar.clickLogout();
    await modyasBrowser.complex.loginWithPasswordViaTopbar(modya);
    await modyasBrowser.topic.toggleLikeVote(postNrAA);
    assert.that(await modyasBrowser.topic.isPostLikedByMe(postNrAA));
  });

  it("Posts get sorted correctly", async () => {
    // Dupl code, and won't work with > 1 browser. Instead: topic.assertPostOrderIs()  [59SKEDT0652]
    await modyasBrowser.refresh2();
    const els = await modyasBrowser.$$('.dw-depth-1 .dw-p');
    await consoleLogPostSortOrder(els);
    assert.eq(await els[0].getAttribute('id'), `post-${postNrAA}`);  // AA has 3 likes
    assert.eq(await els[1].getAttribute('id'), `post-${postNrBB}`);  // BB has 2
    assert.eq(await els[2].getAttribute('id'), `post-${postNrCC}`);  // CC has 1
    assert.eq(await els[3].getAttribute('id'), `post-${postNrXX}`);  // These are sorted by post nr ?
    assert.eq(await els[4].getAttribute('id'), `post-${postNrYY}`);  // -""-
    assert.eq(await els[5].getAttribute('id'), `post-${postNrZZ}`);  // -""-
  });

  it("Modya un-likes AA", async () => {
    await modyasBrowser.topic.toggleLikeVote(postNrAA);
  });

  it("Regina likes BB", async () => {
    await modyasBrowser.topbar.clickLogout();
    await reginasBrowser.complex.loginWithPasswordViaTopbar(regina);
    await reginasBrowser.topic.toggleLikeVote(postNrBB);
  });

  it("Now BB gets placed first, before AA (and CC)", async () => {
    await reginasBrowser.refresh2();
    const els = await reginasBrowser.$$('.dw-depth-1 .dw-p');
    await consoleLogPostSortOrder(els);
    assert.eq(await els[0].getAttribute('id'), `post-${postNrBB}`);  // BB first, has 3 likes
    assert.eq(await els[1].getAttribute('id'), `post-${postNrAA}`);  // AA has 2 likes
    assert.eq(await els[2].getAttribute('id'), `post-${postNrCC}`);  // CC has 1 like
    assert.eq(await els[3].getAttribute('id'), `post-${postNrXX}`);
    assert.eq(await els[4].getAttribute('id'), `post-${postNrYY}`);
    assert.eq(await els[5].getAttribute('id'), `post-${postNrZZ}`);
  });


  // ----- Disagree votes

  it("Regina disagrees with CC and XX — which means she probably read both CC and XX", async () => {
    await reginasBrowser.topic.toggleDisagreeVote(postNrCC);
    await reginasBrowser.topic.toggleDisagreeVote(postNrXX);
  });

  it("Now XX gets placed last, not because of the Disagree, but because read-but-not-Liked", async () => {
    await reginasBrowser.refresh2();
    const els = await reginasBrowser.$$('.dw-depth-1 .dw-p');
    await consoleLogPostSortOrder(els);
    assert.eq(await els[0].getAttribute('id'), `post-${postNrBB}`);
    assert.eq(await els[1].getAttribute('id'), `post-${postNrAA}`);
    assert.eq(await els[2].getAttribute('id'), `post-${postNrCC}`); // a Like and a Disagree vote
    assert.eq(await els[3].getAttribute('id'), `post-${postNrYY}`);
    assert.eq(await els[4].getAttribute('id'), `post-${postNrZZ}`);
    assert.eq(await els[5].getAttribute('id'), `post-${postNrXX}`); // wasn't Liked  (and has a Disagree)
  });

  it("Regina un-disagrees with XX", async () => {
    await reginasBrowser.topic.toggleDisagreeVote(postNrXX);
  });

  it("But has no effect, since still hasn't gotten any Like vote", async () => {
    await reginasBrowser.refresh2();
    const els = await reginasBrowser.$$('.dw-depth-1 .dw-p');
    await consoleLogPostSortOrder(els);
    assert.eq(await els[0].getAttribute('id'), `post-${postNrBB}`);
    assert.eq(await els[1].getAttribute('id'), `post-${postNrAA}`);
    assert.eq(await els[2].getAttribute('id'), `post-${postNrCC}`); // a Like and a Disagree vote
    assert.eq(await els[3].getAttribute('id'), `post-${postNrYY}`);
    assert.eq(await els[4].getAttribute('id'), `post-${postNrZZ}`);
    assert.eq(await els[5].getAttribute('id'), `post-${postNrXX}`); // wasn't Liked
  });


  // ----- Bury votes

  it("Regina bury-votes CC and YY", async () => {
    await reginasBrowser.topic.toggleBuryVote(postNrCC);
    await reginasBrowser.topic.toggleBuryVote(postNrYY);
  });

  it("Now YY placed last, also after the Disagree:d votes, but CC unaffected, because liked", async () => {
    await reginasBrowser.refresh2();
    const els = await reginasBrowser.$$('.dw-depth-1 .dw-p');
    await consoleLogPostSortOrder(els);
    assert.eq(await els[0].getAttribute('id'), `post-${postNrBB}`);
    assert.eq(await els[1].getAttribute('id'), `post-${postNrAA}`);
    assert.eq(await els[2].getAttribute('id'), `post-${postNrCC}`); // a Like, a Disagree, and a Bury
    assert.eq(await els[3].getAttribute('id'), `post-${postNrZZ}`);
    assert.eq(await els[4].getAttribute('id'), `post-${postNrXX}`); // wasn't Liked
    assert.eq(await els[5].getAttribute('id'), `post-${postNrYY}`); // has a Bury vote, also wasn't Liked
  });

  it("Regina un-bury-votes YY, buries ZZ instead", async () => {
    await reginasBrowser.topic.toggleBuryVote(postNrYY);
    await reginasBrowser.topic.toggleBuryVote(postNrZZ);
  });

  it("Now XX placed before ZZ and YY again", async () => {
    await reginasBrowser.refresh2();
    const els = await reginasBrowser.$$('.dw-depth-1 .dw-p');
    await consoleLogPostSortOrder(els);
    assert.eq(await els[0].getAttribute('id'), `post-${postNrBB}`);
    assert.eq(await els[1].getAttribute('id'), `post-${postNrAA}`);
    assert.eq(await els[2].getAttribute('id'), `post-${postNrCC}`); // a Like, a Disagree, and a Bury
    assert.eq(await els[3].getAttribute('id'), `post-${postNrXX}`);
    assert.eq(await els[4].getAttribute('id'), `post-${postNrYY}`);
    assert.eq(await els[5].getAttribute('id'), `post-${postNrZZ}`); // Bury vote
  });


  // ----- Unwanted votes

  it("Corax Unwanted-votes BB", async () => {
    await reginasBrowser.topbar.clickLogout();
    await coraxBrowser.complex.loginWithPasswordViaTopbar(corax);
    await coraxBrowser.topic.toggleUnwantedVote(postNrBB);
  });

  it("so BB gets placed last", async () => {
    await coraxBrowser.refresh2();
    const els = await coraxBrowser.$$('.dw-depth-1 .dw-p');
    await consoleLogPostSortOrder(els);
    assert.eq(await els[0].getAttribute('id'), `post-${postNrAA}`);
    assert.eq(await els[1].getAttribute('id'), `post-${postNrCC}`); // a Like, a Disagree, and a Bury
    assert.eq(await els[2].getAttribute('id'), `post-${postNrXX}`);
    assert.eq(await els[3].getAttribute('id'), `post-${postNrYY}`);
    assert.eq(await els[4].getAttribute('id'), `post-${postNrZZ}`); // Bury vote
    assert.eq(await els[5].getAttribute('id'), `post-${postNrBB}`); // Unwanted (by core member, bad bad)
  });

  it("Corax un-unwants BB", async () => {
    await coraxBrowser.topic.toggleUnwantedVote(postNrBB);
  });

  it("now BB gets moved back to first, again", async () => {
    await coraxBrowser.refresh2();
    const els = await coraxBrowser.$$('.dw-depth-1 .dw-p');
    await consoleLogPostSortOrder(els);
    assert.eq(await els[0].getAttribute('id'), `post-${postNrBB}`); // Unwanted (by core member, bad bad)
    assert.eq(await els[1].getAttribute('id'), `post-${postNrAA}`);
    assert.eq(await els[2].getAttribute('id'), `post-${postNrCC}`); // a Like, a Disagree, and a Bury
    assert.eq(await els[3].getAttribute('id'), `post-${postNrXX}`);
    assert.eq(await els[4].getAttribute('id'), `post-${postNrYY}`);
    assert.eq(await els[5].getAttribute('id'), `post-${postNrZZ}`); // Bury vote
  });

});


async function consoleLogPostSortOrder(els) {
  // DELETE later when using  assertPostOrderIs insted of $$  [59SKEDT0652]
  console.log("Posts sort order: " +
      await els[0].getAttribute('id') + ' ' + (await els[0].getText()).replace('\n', ' ') + ', ' +
      await els[1].getAttribute('id') + ' ' + (await els[1].getText()).replace('\n', ' ') + ', ' +
      await els[2].getAttribute('id') + ' ' + (await els[2].getText()).replace('\n', ' ') + ', ' +
      await els[3].getAttribute('id') + ' ' + (await els[3].getText()).replace('\n', ' ') + ', ' +
      await els[4].getAttribute('id') + ' ' + (await els[4].getText()).replace('\n', ' ') + ', ' +
      await els[5].getAttribute('id') + ' ' + (await els[5].getText()).replace('\n', ' '));
}

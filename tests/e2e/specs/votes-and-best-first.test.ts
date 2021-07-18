/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import make = require('../utils/make');
import { buildSite } from '../utils/site-builder';
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

let browser: TyE2eTestBrowser;
declare const $$: any; // webdriver.io global utility   DELETE use  assertPostOrderIs insted [59SKEDT0652]

let everyonesBrowsers;
let owen;
let owensBrowser: TyE2eTestBrowser;
let modya;
let modyasBrowser: TyE2eTestBrowser;
let mons;
let monsBrowser: TyE2eTestBrowser;
let corax;
let coraxBrowser: TyE2eTestBrowser;
let regina;
let reginasBrowser: TyE2eTestBrowser;
let maria;
let mariasBrowser: TyE2eTestBrowser;
let michael;
let michaelsBrowser: TyE2eTestBrowser;
let strangersBrowser: TyE2eTestBrowser;

let idAddress: IdAddress;
let siteId: any;

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
describe("votes and best first", () => {

  it("import a site", () => {
    forum = buildSite().addLargeForum({ title: "Votes Forum" });
    const siteData: SiteData2 = forum.siteData as SiteData2;

    siteData.settings.discPostSortOrder = c.SortOrderBestFirst;

    // Add AA, BB, CC, XX, YY, ZZ, but not in that order, instead, an a bit random
    // order: AA, BB, CC reversed and inserted in between the others. Then, when
    // adding votes, we'll notice if AA, BB, CC will get sorted correctly.
    siteData.posts.push(make.post({  // Nice!
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

    idAddress = server.importSiteData(siteData);
    siteId = idAddress.id;
  });

  it("initialize people", () => {
    everyonesBrowsers = new TyE2eTestBrowser(wdioBrowser);

    owensBrowser = everyonesBrowsers;
    modyasBrowser = owensBrowser;
    monsBrowser = owensBrowser;
    coraxBrowser = owensBrowser;
    reginasBrowser = owensBrowser;
    mariasBrowser = owensBrowser;
    michaelsBrowser = owensBrowser;
    strangersBrowser = browser;

    maria = forum.members.maria;
    michael = forum.members.michael;
    modya = forum.members.modya;
    mons = forum.members.mons;
    corax = forum.members.corax;
    regina = forum.members.regina;
  });


  // ----- Like votes

  it("Michael likes post AA", () => {
    michaelsBrowser.go(idAddress.origin + '/' + forum.topics.byMariaCategoryA.slug);
    michaelsBrowser.complex.loginWithPasswordViaTopbar(michael);
    michaelsBrowser.topic.toggleLikeVote(postNrAA);
    assert(michaelsBrowser.topic.isPostLikedByMe(postNrAA));
  });

  it("... and BB and CC too", () => {
    michaelsBrowser.topic.toggleLikeVote(postNrBB);
    michaelsBrowser.topic.toggleLikeVote(postNrCC);
    assert(michaelsBrowser.topic.isPostLikedByMe(postNrBB));
    assert(michaelsBrowser.topic.isPostLikedByMe(postNrCC));
  });

  it("... but not the others", () => {
    assert(!michaelsBrowser.topic.isPostLikedByMe(postNrXX));
    assert(!michaelsBrowser.topic.isPostLikedByMe(postNrYY));
    assert(!michaelsBrowser.topic.isPostLikedByMe(postNrZZ));
  });

  it("Mons likes AA and BB", () => {
    michaelsBrowser.topbar.clickLogout();
    monsBrowser.complex.loginWithPasswordViaTopbar(mons);
    monsBrowser.topic.toggleLikeVote(postNrAA);
    monsBrowser.topic.toggleLikeVote(postNrBB);
    assert(monsBrowser.topic.isPostLikedByMe(postNrAA));
    assert(monsBrowser.topic.isPostLikedByMe(postNrBB));
  });

  it("Modya likes AA", () => {
    monsBrowser.topbar.clickLogout();
    modyasBrowser.complex.loginWithPasswordViaTopbar(modya);
    modyasBrowser.topic.toggleLikeVote(postNrAA);
    assert(modyasBrowser.topic.isPostLikedByMe(postNrAA));
  });

  it("Posts get sorted correctly", () => {
    // Dupl code, and won't work with > 1 browser. Instead: topic.assertPostOrderIs()  [59SKEDT0652]
    modyasBrowser.refresh();
    const els = modyasBrowser.$$('.dw-depth-1 .dw-p');
    consoleLogPostSortOrder(els);
    assert(els[0].getAttribute('id') === `post-${postNrAA}`);  // AA has 3 likes
    assert(els[1].getAttribute('id') === `post-${postNrBB}`);  // BB has 2
    assert(els[2].getAttribute('id') === `post-${postNrCC}`);  // CC has 1
    assert(els[3].getAttribute('id') === `post-${postNrXX}`);  // These are sorted by post nr ?
    assert(els[4].getAttribute('id') === `post-${postNrYY}`);  // -""-
    assert(els[5].getAttribute('id') === `post-${postNrZZ}`);  // -""-
  });

  it("Modya un-likes AA", () => {
    modyasBrowser.topic.toggleLikeVote(postNrAA);
  });

  it("Regina likes BB", () => {
    modyasBrowser.topbar.clickLogout();
    reginasBrowser.complex.loginWithPasswordViaTopbar(regina);
    reginasBrowser.topic.toggleLikeVote(postNrBB);
  });

  it("Now BB gets placed first, before AA (and CC)", () => {
    reginasBrowser.refresh();
    const els = reginasBrowser.$$('.dw-depth-1 .dw-p');
    consoleLogPostSortOrder(els);
    assert(els[0].getAttribute('id') === `post-${postNrBB}`);  // BB first, has 3 likes
    assert(els[1].getAttribute('id') === `post-${postNrAA}`);  // AA has 2 likes
    assert(els[2].getAttribute('id') === `post-${postNrCC}`);  // CC has 1 like
    assert(els[3].getAttribute('id') === `post-${postNrXX}`);
    assert(els[4].getAttribute('id') === `post-${postNrYY}`);
    assert(els[5].getAttribute('id') === `post-${postNrZZ}`);
  });


  // ----- Disagree votes

  it("Regina disagrees with CC and XX — which means she probably read both CC and XX", () => {
    reginasBrowser.topic.toggleDisagreeVote(postNrCC);
    reginasBrowser.topic.toggleDisagreeVote(postNrXX);
  });

  it("Now XX gets placed last, not because of the Disagree, but because read-but-not-Liked", () => {
    reginasBrowser.refresh();
    const els = reginasBrowser.$$('.dw-depth-1 .dw-p');
    consoleLogPostSortOrder(els);
    assert(els[0].getAttribute('id') === `post-${postNrBB}`);
    assert(els[1].getAttribute('id') === `post-${postNrAA}`);
    assert(els[2].getAttribute('id') === `post-${postNrCC}`); // a Like and a Disagree vote
    assert(els[3].getAttribute('id') === `post-${postNrYY}`);
    assert(els[4].getAttribute('id') === `post-${postNrZZ}`);
    assert(els[5].getAttribute('id') === `post-${postNrXX}`); // wasn't Liked  (and has a Disagree)
  });

  it("Regina un-disagrees with XX", () => {
    reginasBrowser.topic.toggleDisagreeVote(postNrXX);
  });

  it("But has no effect, since still hasn't gotten any Like vote", () => {
    reginasBrowser.refresh();
    const els = reginasBrowser.$$('.dw-depth-1 .dw-p');
    consoleLogPostSortOrder(els);
    assert(els[0].getAttribute('id') === `post-${postNrBB}`);
    assert(els[1].getAttribute('id') === `post-${postNrAA}`);
    assert(els[2].getAttribute('id') === `post-${postNrCC}`); // a Like and a Disagree vote
    assert(els[3].getAttribute('id') === `post-${postNrYY}`);
    assert(els[4].getAttribute('id') === `post-${postNrZZ}`);
    assert(els[5].getAttribute('id') === `post-${postNrXX}`); // wasn't Liked
  });


  // ----- Bury votes

  it("Regina bury-votes CC and YY", () => {
    reginasBrowser.topic.toggleBuryVote(postNrCC);
    reginasBrowser.topic.toggleBuryVote(postNrYY);
  });

  it("Now YY placed last, also after the Disagree:d votes, but CC unaffected, because liked", () => {
    reginasBrowser.refresh();
    const els = reginasBrowser.$$('.dw-depth-1 .dw-p');
    consoleLogPostSortOrder(els);
    assert(els[0].getAttribute('id') === `post-${postNrBB}`);
    assert(els[1].getAttribute('id') === `post-${postNrAA}`);
    assert(els[2].getAttribute('id') === `post-${postNrCC}`); // a Like, a Disagree, and a Bury
    assert(els[3].getAttribute('id') === `post-${postNrZZ}`);
    assert(els[4].getAttribute('id') === `post-${postNrXX}`); // wasn't Liked
    assert(els[5].getAttribute('id') === `post-${postNrYY}`); // has a Bury vote, also wasn't Liked
  });

  it("Regina un-bury-votes YY, buries ZZ instead", () => {
    reginasBrowser.topic.toggleBuryVote(postNrYY);
    reginasBrowser.topic.toggleBuryVote(postNrZZ);
  });

  it("Now XX placed before ZZ and YY again", () => {
    reginasBrowser.refresh();
    const els = reginasBrowser.$$('.dw-depth-1 .dw-p');
    consoleLogPostSortOrder(els);
    assert(els[0].getAttribute('id') === `post-${postNrBB}`);
    assert(els[1].getAttribute('id') === `post-${postNrAA}`);
    assert(els[2].getAttribute('id') === `post-${postNrCC}`); // a Like, a Disagree, and a Bury
    assert(els[3].getAttribute('id') === `post-${postNrXX}`);
    assert(els[4].getAttribute('id') === `post-${postNrYY}`);
    assert(els[5].getAttribute('id') === `post-${postNrZZ}`); // Bury vote
  });


  // ----- Unwanted votes

  it("Corax Unwanted-votes BB", () => {
    reginasBrowser.topbar.clickLogout();
    coraxBrowser.complex.loginWithPasswordViaTopbar(corax);
    coraxBrowser.topic.toggleUnwantedVote(postNrBB);
  });

  it("so BB gets placed last", () => {
    coraxBrowser.refresh();
    const els = coraxBrowser.$$('.dw-depth-1 .dw-p');
    consoleLogPostSortOrder(els);
    assert(els[0].getAttribute('id') === `post-${postNrAA}`);
    assert(els[1].getAttribute('id') === `post-${postNrCC}`); // a Like, a Disagree, and a Bury
    assert(els[2].getAttribute('id') === `post-${postNrXX}`);
    assert(els[3].getAttribute('id') === `post-${postNrYY}`);
    assert(els[4].getAttribute('id') === `post-${postNrZZ}`); // Bury vote
    assert(els[5].getAttribute('id') === `post-${postNrBB}`); // Unwanted (by core member, bad bad)
  });

  it("Corax un-unwants BB", () => {
    coraxBrowser.topic.toggleUnwantedVote(postNrBB);
  });

  it("now BB gets moved back to first, again", () => {
    coraxBrowser.refresh();
    const els = coraxBrowser.$$('.dw-depth-1 .dw-p');
    consoleLogPostSortOrder(els);
    assert(els[0].getAttribute('id') === `post-${postNrBB}`); // Unwanted (by core member, bad bad)
    assert(els[1].getAttribute('id') === `post-${postNrAA}`);
    assert(els[2].getAttribute('id') === `post-${postNrCC}`); // a Like, a Disagree, and a Bury
    assert(els[3].getAttribute('id') === `post-${postNrXX}`);
    assert(els[4].getAttribute('id') === `post-${postNrYY}`);
    assert(els[5].getAttribute('id') === `post-${postNrZZ}`); // Bury vote
  });

});


function consoleLogPostSortOrder(els) {
  // DELETE later when using  assertPostOrderIs insted of $$  [59SKEDT0652]
  console.log("Posts sort order: " +
      els[0].getAttribute('id') + ' ' + els[0].getText().replace('\n', ' ') + ', ' +
      els[1].getAttribute('id') + ' ' + els[1].getText().replace('\n', ' ') + ', ' +
      els[2].getAttribute('id') + ' ' + els[2].getText().replace('\n', ' ') + ', ' +
      els[3].getAttribute('id') + ' ' + els[3].getText().replace('\n', ' ') + ', ' +
      els[4].getAttribute('id') + ' ' + els[4].getText().replace('\n', ' ') + ', ' +
      els[5].getAttribute('id') + ' ' + els[5].getText().replace('\n', ' '));
}

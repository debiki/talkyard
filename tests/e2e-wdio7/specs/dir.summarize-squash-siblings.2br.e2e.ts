/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import * as fs from 'fs';
import server from '../utils/server';
import * as utils from '../utils/utils';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/ty-e2e-test-browser';
import settings from '../utils/settings';
import { dieIf } from '../utils/log-and-die';
import c from '../test-constants';

let allBrowsers: TyAllE2eTestBrowsers;
let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let maria: Member;
let maria_brB: TyE2eTestBrowser;
let stranger_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoCatsTestForum;  // or TwoPagesTestForum or EmptyTestForum or LargeTestForum

const bigPageSlug = 'big-page';
let bigPageUrl: St;

let nextCatMsg = -1;
function nextWhat(): St {
  nextCatMsg += 1;
  const ix = nextCatMsg % 10;
  return  (ix == 0) ? 'annoy them' : (
          (ix == 1) ? 'walk in their shadows' : (
          (ix == 2) ? 'displease them' : (
          (ix == 3) ? 'step on their tails' : (
          (ix == 4) ? 'pull their tails' : (
          (ix == 5) ? 'play techno music when they sleep' : (
          (ix == 6) ? 'play the violin when they are in a bad mood' : (
          (ix == 7) ? 'throw any of them into a river' : (
          (ix == 8) ? 'eat their food' :
              'put them on a spaceship to Sun, our star'))))))));
}

const longLongReply = (): St => {
  const t = `
      <p>Our prime purpose in this life is to <i>please</i> the cats.
      And if you can't, at least don't ${nextWhat()}.</p>

      <p>This should be repeated many times.</p>

      <p>Many.</p>

      <p>Many.</p>

      <p>Many.</p>

      <p>This should be repeated many times.</p>

      <p>This should be repeated many times.</p>

      <p>Many times:</p>

      <p>Our prime purpose in this life is to pat cats.
      And if you can't, at least don't ${nextWhat()}.</p>

      <p>Our prime purpose in this life is to pat cats.
      And if you can't, at least don't offend them.</p>

      <p>Many times.</p>`;
  return t + t + t + t;
};


describe(`dir.summarize-squash-siblings.2br  TyTESQUASHSIBL`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "Summarize and Squash E2E Test",
    });

    const newBigPage: PageJustAdded = builder.addPage({
      id: '1234',
      folder: '/',
      showId: false,
      slug: bigPageSlug,
      role: c.TestPageRole.Discussion,
      title: "Big page",
      body: "Big pages have squashed comments.",
      categoryId: forum.categories.categoryA.id,
      authorId: forum.members.maria.id,
    });

    const numOpReplies = 100;
    const numFirstReplyReplies = 100;

    for (let nr = c.FirstReplyNr; nr < c.FirstReplyNr + numOpReplies; ++nr) {
      builder.addPost({
        page: newBigPage,
        nr,
        parentNr: c.BodyNr,
        authorId: forum.members.maria.id,
        approvedSource: (nr % 15) !== 0
            ? `My mission in life is not merely to pat ${nr} cats.`
            // This should get summarized?
            : longLongReply(),
      });
    }

    for (let nr = c.FirstReplyNr + numOpReplies;
            nr < c.FirstReplyNr + numOpReplies + numFirstReplyReplies; ++nr) {
      builder.addPost({
        page: newBigPage,
        nr,
        parentNr: c.SecondReplyNr,
        authorId: forum.members.maria.id,
        approvedSource: (nr % 15) !== 0
              ? `But to do so with some passion, some compassion,
                some humor, and some style, ${nr} times.`
              : longLongReply(),  // gets summarized?
      });
    }

    allBrowsers = new TyE2eTestBrowser(allWdioBrowsers, 'brAll');
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;

    maria = forum.members.maria;
    maria_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
    bigPageUrl = site.origin + '/' + bigPageSlug;
  });


  it(`Owen logs in to admin area, ... `, async () => {
    await owen_brA.adminArea.goToUsersEnabled(site.origin);
    await owen_brA.loginDialog.loginWithPassword(owen);
  });


  it(`Maria logs in`, async () => {
    await maria_brB.go2(bigPageUrl);
    await maria_brB.complex.loginWithPasswordViaTopbar(maria);
  });


});


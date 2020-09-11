/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('../utils/ty-assert');
// import fs = require('fs');  EMBCMTS
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/pages-for';
import settings = require('../utils/settings');
import lad = require('../utils/log-and-die');
import c = require('../test-constants');


let everyonesBrowsers: TyAllE2eTestBrowsers;
let richBrowserA: TyE2eTestBrowser;
let richBrowserB: TyE2eTestBrowser;
let owen: Member;
let owenBrA: TyE2eTestBrowser;
let modya: Member;
let modyaBrA: TyE2eTestBrowser;
let corax: Member;
let coraxBrA: TyE2eTestBrowser;
let memah: Member;
let memahBrB: TyE2eTestBrowser;
let strangerBrB: TyE2eTestBrowser;

let site: IdAddress;

let forum: EmptyTestForum

const apiSecret: TestApiSecret = {
  nr: 1,
  userId: c.SysbotUserId,
  createdAt: c.MinUnixMillis,
  deletedAt: undefined,
  isDeleted: false,
  secretKey: 'publicE2eTestSecretKeyAbc123',
};


const topicOneTitle = 'topicOneTitle';
const topicOneBody = 'topicOneBody';
let topicOneUrl: string;

const replA_txt = 'replA_txt';
const replA_nr = c.FirstReplyNr;
const replB_txt = 'replB_txt';
const replB_nr = c.FirstReplyNr + 1;
const replC_txt = 'replC_txt';
const replC_nr = c.FirstReplyNr + 2;
const replC_edited_text = 'replC_edited_text';
const replD_txt = 'replD_txt';
const replD_nr = c.FirstReplyNr + 3;

const modyasReplyToReplyB = 'modyasReplyToReplyB';

const topicTwoTitleOrig = 'topicTwoTitleOrig';
const topicTwoTitleEdited = 'topicTwoTitleEdited';
const topicTwoBody = 'topicTwoBody';
let topicTwoUrl: string;

const questionTitleOrig = 'questionTitleOrig';
const questionBody = 'questionBody';
let questionUrl: string;

const goodAnswer_txt = 'goodAnswer_txt';
const goodAnswer_nr = c.FirstReplyNr;
const badAnswer_txt = 'badAnswer_txt';
const badAnswer_nr = c.FirstReplyNr + 1;


describe(`modn-from-disc-page-review-after.2browsers  TyTE2E603RKG4`, () => {

  it(`construct site`, () => {
    const builder = buildSite();
    forum = builder.addEmptyForum({
      title: "Some E2E Test",
      members: ['modya', 'corax', 'trillian', 'memah'],
    });

    // Disable notifications, or notf email counts will be off
    // (since Owen would get emails).
    builder.settings({
      numFirstPostsToApprove: 0,
      reviewAfterIfTrustLte: c.TestTrustLevel.FullMember,
      maxPostsPendRevwAftr: 9,
    });
    builder.getSite().pageNotfPrefs = [{
      memberId: forum.members.owen.id,
      notfLevel: c.TestPageNotfLevel.Muted,
      wholeSite: true,
    }];

    everyonesBrowsers = new TyE2eTestBrowser(allWdioBrowsers);
    richBrowserA = new TyE2eTestBrowser(wdioBrowserA);
    richBrowserB = new TyE2eTestBrowser(wdioBrowserB);

    owen = forum.members.owen;
    owenBrA = richBrowserA;
    modya = forum.members.modya;
    modyaBrA = richBrowserA;
    corax = forum.members.corax;
    coraxBrA = richBrowserA;

    memah = forum.members.memah;
    memahBrB = richBrowserB;
    strangerBrB = richBrowserB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`import site`, () => {
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });

  it(`Memah logs in`, () => {
    memahBrB.go2(site.origin);
    memahBrB.complex.loginWithPasswordViaTopbar(memah);
  });

  it(`... posts a new topic`, () => {
    memahBrB.complex.createAndSaveTopic({ title: topicOneTitle, body: topicOneBody });
    topicOneUrl = memahBrB.getUrl();
  });

  it(`... some replies`, () => {
    memahBrB.complex.replyToOrigPost(replA_txt);
    memahBrB.complex.replyToOrigPost(replB_txt);
    memahBrB.complex.replyToOrigPost(replC_txt);
    memahBrB.complex.replyToOrigPost(replD_txt);
  });

  it(`... another topic`, () => {
    memahBrB.topbar.clickHome();
    memahBrB.complex.createAndSaveTopic({ title: topicTwoTitleOrig, body: topicTwoBody });
    topicTwoUrl = memahBrB.getUrl();
  });

  it(`... and a question`, () => {
    memahBrB.topbar.clickHome();
    memahBrB.complex.createAndSaveTopic({
          title: questionTitleOrig, body: questionBody, type: PageRole.Question });
    questionUrl = memahBrB.getUrl();
  });

  it(`... with a good and a bad answer`, () => {
    memahBrB.complex.replyToOrigPost(goodAnswer_txt);
    memahBrB.complex.replyToOrigPost(badAnswer_txt);
  });

  it(`Modya goes to the moderation page`, () => {
    modyaBrA.adminArea.review.goHere(site.origin, { loginAs: modya });
  });

  const nine = 9;

  it(`There are ${nine} review-after mod tasks`, () => {
    // 1 page, 4 replies = 5
    // 1 page, 0 replies = 1
    // 1 question, 2 answers = 3
    assert.eq(modyaBrA.adminArea.review.countThingsToReview(), nine);
  });

  it(`Modya looks at the question topic`, () => {
    //modyaBrA.adminArea.review.goToPostForTaskIndex(1);  no, TyE5NA2953
    modyaBrA.go2(questionUrl);
  });

  it(`Modya implicitly reviews-after accepts the question page and good answer,
        by marking the good answer as the solution  TyTE2E50ARMS`, () => {
    modyaBrA.topic.selectPostNrAsAnswer(goodAnswer_nr);
  });

  it(`... (but not the bad answer)`, () => {
    // Noop.
  });


  it(`Modya goes to topic two`, () => {
    modyaBrA.go(topicTwoUrl);
  });

  it(`... implicitly reviews-accepts it, by editing topic title  TyTE2E042SR4`, () => {
    modyaBrA.complex.editPageTitle(topicTwoTitleEdited);
  });


  it(`Modya goes to topic one`, () => {
    modyaBrA.go(topicOneUrl);
  });

  it(`... implicitly reviews-after the topic, by Like-voting it  TyTE2E5ART25`, () => {
    modyaBrA.topic.toggleLikeVote(c.BodyNr);
  });

  it(`... and reply A, by wikifying it  TYTE2E40IRM5`, () => {
    modyaBrA.topic.wikifyPostNr(replA_nr, true);
  });

  it(`... and reply B, by replying to it`, () => {
    modyaBrA.complex.replyToPostNr(replB_nr, modyasReplyToReplyB);
  });

  it(`... and reply C, by editing it  TyTE2E405R2`, () => {
    modyaBrA.complex.editPostNr(replC_nr, replC_edited_text);
  });


  it(`Modya returns to the moderation page`, () => {
    modyaBrA.adminArea.review.goHere(site.origin);
  });

  const justTwo = 2;

  it(`There're ${justTwo} things left to review`, () => {
    modyaBrA.adminArea.review.hideCompletedTasks();
    assert.eq(modyaBrA.adminArea.review.countThingsToReview(), justTwo);
  });

  it(`... the bad answer`, () => {
    modyaBrA.adminArea.review.waitForTextToReview(badAnswer_txt, { index: 1 });
  });

  it(`... and reply D`, () => {
    modyaBrA.adminArea.review.waitForTextToReview(replD_txt);
        // Oh there're others in between, hidden because completed.
        // { index: 2 });
  });


  //$r s/wdio --only modn-on-page-review-after.2browsers $args  TyT204RKSTEM
  // new member posts new topic. Mons replies (review-okays implicitly), Modya approves & rejects from modn page.
  //                             Mons edits, after replied.
  // new member posts new reply. Mons edits (review-okays implicitly), Modya approves & rejects from modn page.
  //                             Mons replies, after edited.
  // new member posts new reply. Modya approves from mod page, Mons replies & edits.
  // new member posts new reply. Modya rejects from mod page, Mons replies & edits.

});


/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('../utils/ty-assert');
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
let owensBrowser: TyE2eTestBrowser;
let modya: Member;
let modyasBrowser: TyE2eTestBrowser;
let trillian: Member;
let trilliansBrowser: TyE2eTestBrowser;
let maria: Member;
let mariasBrowser: TyE2eTestBrowser;
let michael: Member;

let siteIdAddress: IdAddress;
let siteId: SiteId;

let forum: EmptyTestForum;



describe("review-edits-ninja-late  TyTREVWEDTLATE", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addEmptyForum({
      title: "Some E2E Test",
      members: ['maria', 'michael', 'modya', 'trillian']
    });

    // Disable site owner notifications, not testing that type of notfs.
    builder.settings({ numFirstPostsToReview: 0, numFirstPostsToApprove: 0 });
    builder.getSite().pageNotfPrefs = [{
      memberId: forum.members.owen.id,
      notfLevel: c.TestPageNotfLevel.Muted,
      wholeSite: true,
    }];

    assert.refEq(builder.getSite(), forum.siteData);
    siteIdAddress = server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
    server.skipRateLimits(siteId);
  });

  it("initialize people", () => {
    everyonesBrowsers = new TyE2eTestBrowser(allWdioBrowsers);
    richBrowserA = new TyE2eTestBrowser(wdioBrowserA);
    richBrowserB = new TyE2eTestBrowser(wdioBrowserB);

    owen = forum.members.owen;
    owensBrowser = richBrowserA;

    modya = forum.members.modya;
    modyasBrowser = richBrowserB;
    trillian = forum.members.trillian;
    trilliansBrowser = richBrowserB;
    maria = forum.members.maria;
    mariasBrowser = richBrowserB;
    michael = forum.members.michael;
  });

  it("Owen logs in to admin area, the review page", () => {
    owensBrowser.adminArea.review.goHere(siteIdAddress.origin, { loginAs: owen });
  });



  // ---- Late edits, different trust levels, new topics

  const getLateEditors: [string, () => Member, () => TyE2eTestBrowser][] = [
          ['Modya',    () => modya,    () => modyasBrowser],    // staff
          ['Trillian', () => trillian, () => trilliansBrowser], // trusted member
          ['Maria',    () => maria,    () => mariasBrowser]];   // normal member

  for (let [name, memberFn, browserFn] of getLateEditors) {
    const textFn = () => `Text by ${name}`;
    const lateEditsTextFn = () => `Text LATE_EDITED by ${name}`;

    it(`${name} goes to the forum`, () => {
      browserFn().go2(siteIdAddress.origin);
      browserFn().complex.loginWithPasswordViaTopbar(memberFn());
    });

    it(`... posts a topic`, () => {
      browserFn().complex.createAndSaveTopic({
              title: `Topic by ${name}`, body: textFn() });
    });

    it(`Half a day elapses`, () => {
      server.playTimeHours(12);
    });

    it(`${name} edits the topic — now long after it was created`, () => {
      browserFn().complex.editPageBody(lateEditsTextFn());
    });

    if (name !== 'Maria') it(`${name} logs out`, () => {
      browserFn().topbar.clickLogout();
    });
    // Else: There're more tests for Maria below.
  }

  it(`A review task is generated, but only for Maria's edits ` +
        `— her trust level is < TrustedMember   TyTLADEETD01`, () => {
    owensBrowser.refresh2()
    owensBrowser.adminArea.review.waitUntilLoaded();
    owensBrowser.adminArea.review.waitForTextToReview(`LATE_EDITED by Maria`);
    assert.eq(owensBrowser.adminArea.review.countThingsToReview(), 1);
  });



  // ---- Ninja edit a reply  TyTNINJED02

  it(`Maria replies to herself, @mentions Michael`, () => {
    mariasBrowser.complex.replyToOrigPost(`Hi myself, hi @${michael.username}`);
  });

  it(`Three minutes elapses`, () => {
    server.playTimeMinutes(3);
  });

  it(`Maria ninja edits the reply`, () => {
    mariasBrowser.complex.editPostNr(
          c.FirstReplyNr, `Hi myself ONCE, hi @${michael.username}`);
  });

  it(`... some more time elapses, and a notf email to Michael gets sent`, () => {
    // But not impl. Instead, the email got sent directly.
    server.playTimeMinutes(10);  // no effect
  });

  it(`Michael gets notified`, () => {
    // TESTS_MISSING  the *ninja edited* text 'ONCE' SHOULD be incl in the email ?!  TyTNINJED02
    server.waitUntilLastEmailMatches(siteIdAddress.id, michael.emailAddress, 'Hi myself');
  });



  // ---- Normal edit of a reply

  it(`Maria replies to herself, a 2nd time`, () => {
    mariasBrowser.complex.replyToOrigPost(`Hi myself TWICE OTTERS, hi @${michael.username}`);
  });

  it(`An hour elapses`, () => {
    server.playTimeHours(1);
  });

  it(`Maria edits the reply, mentions Modya too`, () => {
    mariasBrowser.complex.editPostNr(
          c.FirstReplyNr + 1,
          `Hi myself TWICE KITTENS, hi @${michael.username} @${modya.username}`);
  });

  it(`Modya gets notified`, () => {
    server.waitUntilLastEmailMatches(
            siteIdAddress.id, modya.emailAddress, 'TWICE KITTENS');
  });

  it(`Michael also got notified — the original text, no ninja edit`, () => {
    server.waitUntilLastEmailMatches(
            siteIdAddress.id, michael.emailAddress, 'TWICE OTTERS');  // not kittens
  });



  // ---- Late edit of a reply

  it(`Maria replies to herself a 3rd time`, () => {
    mariasBrowser.complex.replyToOrigPost(`Hi myself`);
  });

  it(`... half a day elapses`, () => {
    server.playTimeHours(12);
  });

  it(`... late-edits the reply`, () => {
    mariasBrowser.complex.editPostNr(c.FirstReplyNr + 2, `Hello LATE_EDIT_AGAIN`);
  });

  it(`Just one review task appears — for the late edit`, () => {
    owensBrowser.refresh2()
    owensBrowser.adminArea.review.waitUntilLoaded();
    // Old review task:
    owensBrowser.adminArea.review.waitForTextToReview(`LATE_EDITED`);
    // One new review task:
    owensBrowser.adminArea.review.waitForTextToReview(`LATE_EDIT_AGAIN`);
    assert.eq(owensBrowser.adminArea.review.countThingsToReview(), 2);
  });

});


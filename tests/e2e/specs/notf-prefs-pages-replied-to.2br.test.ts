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
let owen_brA: TyE2eTestBrowser;
let maja: Member;
let maja_brA: TyE2eTestBrowser;
let maria: Member;
let michael: Member;
let memah: Member;
let memah_brB: TyE2eTestBrowser;
let stranger_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoPagesTestForum;

let michealsTopicUrl: St;
let mariasTopicUrl: St;

const memasReplyMichaelsPage = 'memasReplyMichaelsPage';
const majasReplyMichaelsPage = 'majasReplyMichaelsPage';
const majasReplyMariasPage = 'majasReplyMariasPage';
const owensReplyMichaelsPage = 'owensReplyMichaelsPage';
const owensReplyToMemahsReply = 'owensReplyToMemahsReply';
const owensMentionsMaja = 'owensMentionsMaja hello @maja';



describe(`notf-prefs-pages-replied-to.2br  TyTE2E402SM53`, () => {

  it(`construct site`, () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      title: "Pages replied to notfs E2E Test",
      members: ['memah', 'maria', 'maja', 'michael'],
    });

    // Disable notifications, or notf email counts will be off
    // (since Owen would get emails).
    builder.settings({
      numFirstPostsToApprove: 0,
      //maxPostsPendApprBefore: 0,
      numFirstPostsToReview: 0,
    });
    builder.getSite().pageNotfPrefs = [{
      memberId: forum.members.owen.id,
      notfLevel: c.TestPageNotfLevel.Normal,
      wholeSite: true,
    }];

    everyonesBrowsers = new TyE2eTestBrowser(allWdioBrowsers);
    richBrowserA = new TyE2eTestBrowser(wdioBrowserA);
    richBrowserB = new TyE2eTestBrowser(wdioBrowserB);

    owen = forum.members.owen;
    owen_brA = richBrowserA;
    maja = forum.members.maja;
    maja_brA = richBrowserA;
    maria = forum.members.maria;
    michael = forum.members.michael;
    memah = forum.members.memah;
    memah_brB = richBrowserB;
    stranger_brB = richBrowserB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`import site`, () => {
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
    michealsTopicUrl = site.origin + '/' + forum.topics.byMichaelCategoryA.slug;
    mariasTopicUrl = site.origin + '/' + forum.topics.byMariaCategoryA.slug;
  });


  let numEmailsTotal = 0;

  it(`Memah replies to Micheal's topic`, () => {
    memah_brB.go2(michealsTopicUrl);
    memah_brB.complex.loginWithPasswordViaTopbar(memah);
    memah_brB.complex.replyToOrigPost(memasReplyMichaelsPage)
    numEmailsTotal += 1;
  });

  it("... Michael gets notified", () => {
    server.waitUntilLastEmailMatches(
            site.id, michael.emailAddress, memasReplyMichaelsPage);
  });



  // ----- Changing one's own Topics-replied-to notf pref


  it(`Memah goes to her profile page`, () => {
    memah_brB.userProfilePage.preferences.notfs.goHere(memah.username)
  });

  it(`Memah configures Every Post notfs for pages where she has replied`, () => {
    memah_brB.userProfilePage.preferences.notfs.setNotfLevelForTopicsRepliedTo(
          c.TestPageNotfLevel.EveryPost)
  });


  it(`Maja replies to Maria's topic`, () => {
    maja_brA.go2(mariasTopicUrl);
    maja_brA.complex.loginWithPasswordViaTopbar(maja);
    maja_brA.complex.replyToOrigPost(majasReplyMariasPage)
    numEmailsTotal += 1;
  });
  it("... Maria gets notified", () => {
    server.waitUntilLastEmailMatches(
            site.id, maria.emailAddress, majasReplyMariasPage);
  });


  it(`Maja replies to Micheal's topic too — to the Orig Post, not to Memah`, () => {
    maja_brA.go2(michealsTopicUrl);
    maja_brA.complex.replyToOrigPost(majasReplyMichaelsPage)
    numEmailsTotal += 2;  // Michael and Memah
  });
  it("... Michael gets notified — it's his topic", () => {
    server.waitUntilLastEmailMatches(
            site.id, michael.emailAddress, majasReplyMichaelsPage);
  });
  it(`... Memah gets notified too — Memah has configured notfs about every post
              in topics where she has replied`, () => {
    server.waitUntilLastEmailMatches(
            site.id, memah.emailAddress, majasReplyMichaelsPage);
  });
  it(`No one else got notified`, () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(site.id);
    assert.eq(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
    assert.eq(numEmailsTotal, 4);  // ttt
  });



  // ----- *Not* inheriting All Member's  Topics-replied-to  notf pref


  it(`Memah sets her  Pages-where-I've-replied  notf level to Normal`, () => {
    memah_brB.waitForDisplayed(`.e_ReToNfLvB.s_NfLv-${c.TestPageNotfLevel.EveryPost}`);
    memah_brB.userProfilePage.preferences.notfs.setNotfLevelForTopicsRepliedTo(
          c.TestPageNotfLevel.Normal)
  });



  // ----- Inheriting All Member's  Topics-replied-to  notf pref


  it(`Owen goes to the All Members group`, () => {
    maja_brA.topbar.clickLogout();
    owen_brA.complex.loginWithPasswordViaTopbar(owen);
    owen_brA.userProfilePage.preferences.notfs.goHere(c.AllMembersUsername)
  });
  it(`... changes the  Topics-replied-to  notf pref to Every Post`, () => {
    owen_brA.userProfilePage.preferences.notfs.setNotfLevelForTopicsRepliedTo(
          c.TestPageNotfLevel.EveryPost)
  });

  it(`Owen looks at Maja's notf prefs`, () => {
    owen_brA.userProfilePage.preferences.notfs.goHere(maja.username);
    owen_brA.userProfilePage.waitUntilUsernameIs(maja.username);
  });
  it(`... Maja will get notified of Every Post, in topics where she's replied
              — notf pref inherited from the All Members group`, () => {
    owen_brA.waitForDisplayed(`.e_ReToNfLvB.s_NfLv-${c.TestPageNotfLevel.EveryPost}`);
  });
  it(`... (site wide notf prefs didn't change)`, () => {
    owen_brA.waitForDisplayed(`.e_SiteNfLvB.s_NfLv-${c.TestPageNotfLevel.Normal}`);
  });

  it(`Owen looks at Memah's notf prefs`, () => {
    owen_brA.userProfilePage.preferences.notfs.goHere(memah.username);
    owen_brA.userProfilePage.waitUntilUsernameIs(memah.username);
  });
  it(`... Memah has choosen to get notified only about replies to her,
            in topics where she's replied
            — this overrides the Every Post notf pref from from All Members`, () => {
    owen_brA.waitForDisplayed(`.e_ReToNfLvB.s_NfLv-${c.TestPageNotfLevel.Normal}`);
  });


  it(`Owen replies to Michael's topic`, () => {
    owen_brA.go2(michealsTopicUrl);
    owen_brA.complex.replyToOrigPost(owensReplyMichaelsPage)
    numEmailsTotal += 2;  // Michael and Maja, but not Memah
  });
  it("... Michael gets notified — his topic", () => {
    server.waitUntilLastEmailMatches(
            site.id, michael.emailAddress, owensReplyMichaelsPage);
  });
  it("... Maja gets notified — she's replied on that page", () => {
    server.waitUntilLastEmailMatches(
            site.id, maja.emailAddress, owensReplyMichaelsPage);
  });

  // *Not* inheriting, ctd:

  it(`... but not Memah: her pages-where-I've-replied notfs is Normal`, () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(site.id);
    assert.eq(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
    assert.eq(numEmailsTotal, 6);  // ttt
  });



  // ----- Changing All Member's  Topics-replied-to  notf pref


  it(`Owen returns to the All Members group`, () => {
    owen_brA.userProfilePage.preferences.notfs.goHere(c.AllMembersUsername)
  });
  it(`... changes the  Topics-replied-to  notf pref to: Normal`, () => {
    owen_brA.userProfilePage.preferences.notfs.setNotfLevelForTopicsRepliedTo(
          c.TestPageNotfLevel.Normal)
  });

  it(`Owen again looks at Maja's notf prefs`, () => {
    owen_brA.userProfilePage.preferences.notfs.goHere(maja.username);
    owen_brA.userProfilePage.waitUntilUsernameIs(maja.username);
  });
  it(`... now Maja's topics-replied-in notfs is back to Normal`, () => {
    owen_brA.waitForDisplayed(`.e_ReToNfLvB.s_NfLv-${c.TestPageNotfLevel.Normal}`);
  });



  // ----- Direct replies still work?


  it(`Owen now replies directly to Memah, in Michael's topic`, () => {
    owen_brA.go2(michealsTopicUrl);
    owen_brA.complex.replyToPostNr(c.FirstReplyNr, owensReplyToMemahsReply)
    numEmailsTotal += 2;  // Michael and Memah, not Maja
  });
  it("... Michael gets notified — his topic", () => {
    server.waitUntilLastEmailMatches(
            site.id, michael.emailAddress, owensReplyToMemahsReply);
  });
  it("... Memah gets notified — it's a direct reply to her  TyTE2E60923RMT", () => {
    server.waitUntilLastEmailMatches(
            site.id, memah.emailAddress, owensReplyToMemahsReply);
  });
  it(`... but not Maria: the default pages-where-I've-replied notf
              is no longer Every Post`, () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(site.id);
    assert.eq(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
    assert.eq(numEmailsTotal, 8);  // ttt
  });



  // ----- Mentions still work?


  it(`Owen mentions Maria, in an Orig Post reply`, () => {
    owen_brA.complex.replyToOrigPost(owensMentionsMaja)
    numEmailsTotal += 2;  // Michael and Maja, not Memah
  });
  it("... Michael gets notified — his topic", () => {
    server.waitUntilLastEmailMatches(
            site.id, michael.emailAddress, owensMentionsMaja);
  });
  it(`... Maja gets notified — she got mentioned`, () => {
    server.waitUntilLastEmailMatches(
            site.id, maja.emailAddress, owensMentionsMaja);
  });
  it(`... but not Memah`, () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(site.id);
    assert.eq(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
    assert.eq(numEmailsTotal, 10);  // ttt
  });


});


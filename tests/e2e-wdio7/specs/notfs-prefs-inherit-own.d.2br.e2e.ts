/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import * as make from '../utils/make';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;

let owen;
let owensBrowser: TyE2eTestBrowser;
let modya;
let modyasBrowser: TyE2eTestBrowser;
let maria;
let mariasBrowser: TyE2eTestBrowser;

let idAddress: IdAddress;
let siteId: any;

const forumTitle = "Notf Pref Inh Onw Content";
const SpecificCatName = 'SpecificCatName';

const TopicTitleOne = 'TopicTitleOne';
const TopicBodyOne = 'TopicBodyOne';
const RelyOneTriggersNotf = 'RelyOneTriggersNotf';
const ReplyTwoNoNotf = 'ReplyTwoNoNotf';

const TopicTitleTwo = 'TopicTitleTwo';
const TopicBodyTwo = 'TopicBodyTwo';

const TopicTwoReplyOneTriggersNotf = 'TopicTwoReplyOneTriggersNotf';
const TopicTwoReplyTwoMuted = 'TopicTwoReplyTwoMuted';

const TopicTitleThree = 'TopicTitleThree';
const TopicBodyThree = 'TopicBodyThree';

let numExpectedEmailsTotal = 0;


describe(`notfs-prefs-inherit-own.d.2br  TyT4RKK7Q2J`, () => {

  it("initialize people", async () => {
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');
    owensBrowser = brA;
    modyasBrowser = brB;
    mariasBrowser = brB;

    owen = make.memberOwenOwner();
    modya = make.memberModeratorModya();
    maria = make.memberMaria();
  });

  it("import a site", async () => {
    const site: SiteData = make.forumOwnedByOwen('notf-inh-own', { title: forumTitle });
    site.members.push(modya);
    site.members.push(maria);
    idAddress = await server.importSiteData(site);
    siteId = idAddress.id;
  });


  it("Owen logs in", async () => {
    await owensBrowser.go2(idAddress.origin + '/categories');
    await owensBrowser.complex.loginWithPasswordViaTopbar(owen);
  });

  it("Creates a Specific category", async () => {
    await owensBrowser.complex.createCategory({ name: SpecificCatName });
    await owensBrowser.forumCategoryList.openCategory(SpecificCatName);
  });


  // ------ Config whole site

  it("Maria goes to her notfs prefs", async () => {
    await mariasBrowser.go2(idAddress.origin);
    await mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
    await mariasBrowser.userProfilePage.openPreferencesFor(maria.username);
    await mariasBrowser.userProfilePage.preferences.switchToNotifications();
  });

  it("... and configs notfs about every post, for the whole site", async () => {
    await mariasBrowser.userProfilePage.preferences.notfs.setSiteNotfLevel(c.TestPageNotfLevel.EveryPost);
  });

  it("Owen posts a topic", async () => {
    await owensBrowser.complex.createAndSaveTopic({ title: TopicTitleOne, body: TopicBodyOne });
    numExpectedEmailsTotal += 1;  // notf to Maria
  });

  it("Maria get notified", async () => {
    const titleBody = [TopicTitleOne, TopicBodyOne];
    await server.waitUntilLastEmailMatches(siteId, maria.emailAddress, titleBody);
    // BUG LIVE_NOTF  no MyMenu notf icon appears, althoug email sent  [NOTFTPCS]
  });

  it("... once, exactly", async () => {
    assert.eq(await server.countLastEmailsSentTo(siteId, maria.emailAddress), 1);
  });

  it("... but not Modya", async () => {
    assert.eq(await server.countLastEmailsSentTo(siteId, modya.emailAddress), 0);
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(siteId);
    assert.eq(num, numExpectedEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });

  it("Owen posts a reply", async () => {
    await owensBrowser.complex.replyToOrigPost(RelyOneTriggersNotf);
    numExpectedEmailsTotal += 1;  // notf to Maria
  });

  it("... Maria get notified", async () => {
    await server.waitUntilLastEmailMatches(siteId, maria.emailAddress, [RelyOneTriggersNotf]);
    assert.eq(await server.countLastEmailsSentTo(siteId, maria.emailAddress), 2);
  });

  it("... but not Modya", async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(siteId);
    assert.eq(num, numExpectedEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });


  // ------ Category pref overrides whole site pref

  it("Maria goes to the categories page", async () => {
    await mariasBrowser.go2('/categories');
  });

  it("... configures notfs about new topics only, for the Specific category", async () => {
    await mariasBrowser.go2('/categories');
    await mariasBrowser.forumCategoryList.setCatNrNotfLevel(2, c.TestPageNotfLevel.NewTopics);
  });

  it("Owen posts a 2nd reply", async () => {
    await owensBrowser.complex.replyToOrigPost(ReplyTwoNoNotf);
    numExpectedEmailsTotal += 0;  // Maria no longer listens to EveryPost. So zero.
  });

  it("... and then a new topic", async () => {
    await owensBrowser.topbar.clickAncestor(SpecificCatName);
    await owensBrowser.complex.createAndSaveTopic({ title: TopicTitleTwo, body: TopicBodyTwo });
    numExpectedEmailsTotal += 1;  // Maria does listens for new topics.
  });

  it("... Maria get notified about the new topic only — her cat prefs says topics only", async () => {
    const titleAndBody = [TopicTitleTwo, TopicBodyTwo];
    await server.waitUntilLastEmailMatches(siteId, maria.emailAddress, titleAndBody);
    assert.eq(await server.countLastEmailsSentTo(siteId, maria.emailAddress), 3);
  });

  it("... but not Modya", async () => {
    assert.eq(await server.countLastEmailsSentTo(siteId, modya.emailAddress), 0);
    // Double check:
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(siteId);
    assert.eq(num, numExpectedEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });


  // TESTS_MISSING: Owen could post something in a different category,
  // and then Maria's whole site settings, would apply.
  // But not the Specific category settings.


  // ------ Page prefs override category prefs

  it("Maria goes to the page", async () => {
    await mariasBrowser.refresh2();  // BUG no live notf for new topics?  [NOTFTPCS]
    await mariasBrowser.topbar.openLatestNotf();
  });

  it("... configs replies for every post", async () => {
    await mariasBrowser.metabar.setPageNotfLevel(c.TestPageNotfLevel.EveryPost);
  });

  /*
  it("... leaves the topic, so won't see new replies immediately", async () => {
    mariasBrowser.go2('/');
  }); */

  it("Owen posts a reply in the topic maria now follows", async () => {
    await owensBrowser.complex.replyToOrigPost(TopicTwoReplyOneTriggersNotf);
  });

  it("Maria gets notified", async () => {
    const replyText = [TopicTwoReplyOneTriggersNotf];
    await server.waitUntilLastEmailMatches(siteId, maria.emailAddress, replyText);
    assert.eq(await server.countLastEmailsSentTo(siteId, maria.emailAddress), 4);
  });

  it("Maria changes notf level to Muted", async () => {
    await mariasBrowser.metabar.setPageNotfLevel(c.TestPageNotfLevel.Muted);
  });

  it("Owen posts a second reply in the topic maria now has muted", async () => {
    await owensBrowser.complex.replyToOrigPost(TopicTwoReplyTwoMuted);
  });

  it("... and then a new topic", async () => {
    await owensBrowser.topbar.clickAncestor(SpecificCatName);
    await owensBrowser.complex.createAndSaveTopic({ title: TopicTitleThree, body: TopicBodyThree });
  });

  it("... Maria get notified about the new topic only — because she muted topic two", async () => {
    const titleAndBody = [TopicTitleThree, TopicBodyThree];
    await server.waitUntilLastEmailMatches(siteId, maria.emailAddress, titleAndBody);
    assert.eq(await server.countLastEmailsSentTo(siteId, maria.emailAddress), 5);
  });

  // TESTS_MISSING clear notf settings for page —> fallbacks to cateory. Claer —> fallb to site.

});

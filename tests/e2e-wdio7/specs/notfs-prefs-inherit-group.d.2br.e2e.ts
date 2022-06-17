/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import * as make from '../utils/make';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';

let browser: TyE2eTestBrowser;

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;

let owen;
let owensBrowser: TyE2eTestBrowser;
let modya;
let maria;
let mariasBrowser: TyE2eTestBrowser;
let trillian;
let trilliansBrowser: TyE2eTestBrowser;

let idAddress: IdAddress;
let siteId: any;

let url;

let numEmailsToTrillian = 0;
let numEmailsToMaria = 0;
let numEmailsToModya = 0;
let numEmailsTotal = 0;

const forumTitle = "Notf Pref Inh Grps Content";
const SpecificCatName = 'SpecificCatName';
const SpecificCatId = 3;
const OtherCatName = 'OtherCatName';

const TitleOneTrilliianNotfd = 'TitleOneTrilliianNotfd';
const BodyOneTrilliianNotfd = 'BodyOneTrilliianNotfd';

const TitleTwoEveryoneNotfd = 'TitleTwoEveryoneNotfd';
const BodyTwoEveryoneNotfd = 'BodyTwoEveryoneNotfd';

const TopicTwoReplyNoNotfs = 'TopicTwoReplyNoNotfs';
const TopicTwoReplyTrillianEveryPost = 'TopicTwoReplyTrillianEveryPost';
const TopicTwoReplyMariaEveryPost = 'TopicTwoReplyMariaEveryPost';

const TitleThreeNotfsTrillian = 'TitleThreeNotfsTrillian';
const BodyThreeNotfsTrillian = 'BodyThreeNotfsTrillian';

const TitleFourNotfsAll = 'TitleFourNotfsAll';
const BodyFourNotfsAll = 'BodyFourNotfsAll';

const TopicFourReplyTrillianModyaNotfd = 'TopicFourReplyTrillianModyaNotfd';
const TopicFourReplyThreeMariaModya = 'TopicFourReplyThreeMariaModya';
const TopicFourReplyFourTrillanModya = 'TopicFourReplyFourTrillanModya';


describe(`notfs-prefs-inherit-group.d.2br  TyT5RKT2WJ04`, () => {

  it("initialize people", async () => {
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');
    owensBrowser = brA;
    mariasBrowser = brB;
    trilliansBrowser = brB;

    owen = make.memberOwenOwner();
    modya = make.memberModeratorModya();
    maria = make.memberMaria();
    maria.trustLevel = c.TestTrustLevel.Basic;
    trillian = make.memberTrillian();
  });

  it("import a site", async () => {
    const site: SiteData = make.forumOwnedByOwen('notf-inh-grp', { title: forumTitle });
    site.members.push(modya);
    site.members.push(maria);
    site.members.push(trillian);
    idAddress = await server.importSiteData(site);
    siteId = idAddress.id;
  });


  it("Owen logs in", async () => {
    await owensBrowser.go2(idAddress.origin + '/categories');
    await owensBrowser.complex.loginWithPasswordViaTopbar(owen);
  });

  it("Creates a Specific category", async () => {
    await owensBrowser.complex.createCategory({ name: SpecificCatName });
  });

  it("... and an Other category", async () => {
    await owensBrowser.complex.createCategory({ name: OtherCatName });
  });



  // Whole site
  // =======================================================


  // ----- Trusted members group subscribes to New Topics

  it("Owen configs New Topics subscr, Trusted members, whole site: " +
      "goes to the Trusted group", async () => {
    await owensBrowser.adminArea.goToUsersEnabled();
    await owensBrowser.adminArea.navToGroups();
  });

  it("... click click", async () => {
    await owensBrowser.groupListPage.openTrustedMembersGroup();
  });

  it("... to notf settings", async () => {
    await owensBrowser.userProfilePage.clickGoToPreferences();
    await owensBrowser.userProfilePage.preferences.switchToNotifications();
  });

  it("... and configs notfs", async () => {
    await owensBrowser.userProfilePage.preferences.notfs.setSiteNotfLevel(c.TestPageNotfLevel.NewTopics);
  });

  it("Owen posts a topic", async () => {
    await owensBrowser.go2('/latest')
    await owensBrowser.complex.createAndSaveTopic({
        title: TitleOneTrilliianNotfd, body: BodyOneTrilliianNotfd });
    numEmailsToTrillian += 1;  // trusted member
    numEmailsToModya += 1;     // is staff, incl in the trusted members group
    numEmailsTotal += 2;
  });

  it("Trillian get notified", async () => {
    const titleBody = [TitleOneTrilliianNotfd, BodyOneTrilliianNotfd];
    await server.waitUntilLastEmailMatches(siteId, trillian.emailAddress, titleBody);
  });

  it("... once, exactly", async () => {
    assert.eq(await server.countLastEmailsSentTo(siteId, trillian.emailAddress), numEmailsToTrillian);
  });

  it("... but not Maria", async () => {
    assert.eq(await server.countLastEmailsSentTo(siteId, maria.emailAddress), numEmailsToMaria);
  });

  it("... and yes, Modya, because is staff", async () => {
    assert.eq(await server.countLastEmailsSentTo(siteId, modya.emailAddress), numEmailsToModya);
  });

  it("... num emails sent is correct", async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(siteId);
    assert.eq(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });

  // ----- All members group subscribes to New Topics

  it("Owen configs New Topics subscr, All Members, whole site: " +
      "goes to the All Members group", async () => {
    await owensBrowser.userProfilePage.openNotfPrefsFor(c.AllMembersId);
  });

  it("... and configs notfs", async () => {
    await owensBrowser.userProfilePage.preferences.notfs.setSiteNotfLevel(c.TestPageNotfLevel.NewTopics);
  });

  it("Owen posts another topic", async () => {
    await owensBrowser.go2('/latest')
    await owensBrowser.complex.createAndSaveTopic({
        title: TitleTwoEveryoneNotfd, body: BodyTwoEveryoneNotfd });
    numEmailsToTrillian += 1;
    numEmailsToMaria += 1;
    numEmailsToModya += 1;
    numEmailsTotal += 3;
  });

  it("Trillian get notified, once", async () => {
    const titleBody = [TitleTwoEveryoneNotfd, BodyTwoEveryoneNotfd];
    await server.waitUntilLastEmailMatches(siteId, trillian.emailAddress, titleBody);
    assert.eq(await server.countLastEmailsSentTo(siteId, trillian.emailAddress), numEmailsToTrillian);
  });

  it("... and Maria", async () => {
    const titleBody = [TitleTwoEveryoneNotfd, BodyTwoEveryoneNotfd];
    await server.waitUntilLastEmailMatches(siteId, maria.emailAddress, titleBody);
    assert.eq(await server.countLastEmailsSentTo(siteId, maria.emailAddress), numEmailsToMaria);
  });

  it("... and Modya", async () => {
    const titleBody = [TitleTwoEveryoneNotfd, BodyTwoEveryoneNotfd];
    await server.waitUntilLastEmailMatches(siteId, modya.emailAddress, titleBody);
    assert.eq(await server.countLastEmailsSentTo(siteId, modya.emailAddress), numEmailsToModya);
  });

  it("... num emails sent is correct now too", async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(siteId);
    assert.eq(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });

  // ----- No one notfd about a reply

  it("Owen posts a reply", async () => {
    await owensBrowser.complex.replyToOrigPost(TopicTwoReplyNoNotfs);
  });

  it("... another, mentions @mod_modya", async () => {
    await owensBrowser.complex.replyToOrigPost("Hi @mod_modya");
    url = await owensBrowser.getUrl();
    numEmailsToModya += 1;
    numEmailsTotal += 1;
  });

  it("Modya gets notified about the mention, only", async () => {
    await server.waitUntilLastEmailMatches(siteId, modya.emailAddress, 'Hi @mod_modya');
    assert.eq(await server.countLastEmailsSentTo(siteId, modya.emailAddress), numEmailsToModya);
  });

  it("The others didn't get notfd about anything", async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(siteId);
    assert.eq(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });

  // ----- Trusted members subscribes to Every Post, notfd about a reply

  it("Owen subscrs Trusted members to Every Post, whole site: " +
      "goes to the Trusted Members group", async () => {
    await owensBrowser.userProfilePage.openNotfPrefsFor(c.TrustedMembersId);
  });

  it("... and configs notfs", async () => {
    await owensBrowser.userProfilePage.preferences.notfs.setSiteNotfLevel(c.TestPageNotfLevel.EveryPost);
  });

  it("Returns and posts a reply", async () => {
    await owensBrowser.go2(url);
    await owensBrowser.complex.replyToOrigPost(TopicTwoReplyTrillianEveryPost);
    numEmailsToTrillian += 1;
    numEmailsToModya += 1;    // staff incl in Trusted Members group
    numEmailsTotal += 2;
  });

  it("Trillian gets notified — more chatty prefs 'wins' (EveryPost vs NewTopics)  TyT20MRPG2", async () => {
    const reply = [TopicTwoReplyTrillianEveryPost];
    await server.waitUntilLastEmailMatches(siteId, trillian.emailAddress, reply);
    assert.eq(await server.countLastEmailsSentTo(siteId, trillian.emailAddress), numEmailsToTrillian);
  });

  it("... and Modya", async () => {
    const reply = [TopicTwoReplyTrillianEveryPost];
    await server.waitUntilLastEmailMatches(siteId, modya.emailAddress, reply);
    assert.eq(await server.countLastEmailsSentTo(siteId, modya.emailAddress), numEmailsToModya);
  });

  it("... Maria didn't get notfd about anything", async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(siteId);
    assert.eq(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });

  // ----- Trillian mutes site; Mara subscrs to Every Post

  // A user's prefs are more specific, than a group's prefs, and have precedence.

  it("Trillian  goes to her notf prefs", async () => {
    await trilliansBrowser.go2(idAddress.origin);
    await trilliansBrowser.complex.loginWithPasswordViaTopbar(trillian);
    await trilliansBrowser.userProfilePage.openPreferencesFor(trillian.username);
    await trilliansBrowser.userProfilePage.preferences.switchToNotifications();
  });

  it("... mutes the whole site (12564)", async () => {
    await trilliansBrowser.userProfilePage.preferences.notfs.setSiteNotfLevel(c.TestPageNotfLevel.Muted);
  });

  it("Maria goes to her notfs prefs", async () => {
    await trilliansBrowser.topbar.clickLogout();
    await mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
    await mariasBrowser.userProfilePage.openPreferencesFor(maria.username);
    await mariasBrowser.userProfilePage.preferences.switchToNotifications();
  });

  it("... subscrs to Every Post", async () => {
    await mariasBrowser.userProfilePage.preferences.notfs.setSiteNotfLevel(c.TestPageNotfLevel.EveryPost);
  });

  it("Owen posts yet another reply", async () => {
    await owensBrowser.complex.replyToOrigPost(TopicTwoReplyMariaEveryPost);
    numEmailsToMaria += 1;
    numEmailsToModya += 1;
    numEmailsTotal += 2;
  });

  it("... this time, Maria gets notified", async () => {
    const reply = [TopicTwoReplyMariaEveryPost];
    await server.waitUntilLastEmailMatches(siteId, maria.emailAddress, reply);
    assert.eq(await server.countLastEmailsSentTo(siteId, maria.emailAddress), numEmailsToMaria);
  });

  it("... and Modya", async () => {
    const reply = [TopicTwoReplyMariaEveryPost];
    await server.waitUntilLastEmailMatches(siteId, modya.emailAddress, reply);
    assert.eq(await server.countLastEmailsSentTo(siteId, modya.emailAddress), numEmailsToModya);
  });

  it("... not Trillian", async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(siteId);
    assert.eq(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });

  it("Maria mutes the whole site", async () => {
    await mariasBrowser.userProfilePage.preferences.notfs.setSiteNotfLevel(c.TestPageNotfLevel.Muted);
  });

  it("Owen posts yet another reply, mentions Modya again", async () => {
    await owensBrowser.complex.replyToOrigPost("Hi again @mod_modya");
    numEmailsToModya += 1;
    numEmailsTotal += 1;
  });

  it("... Modya gets notified, again", async () => {
    await server.waitUntilLastEmailMatches(siteId, modya.emailAddress, "Hi again @mod_modya");
    assert.eq(await server.countLastEmailsSentTo(siteId, modya.emailAddress), numEmailsToModya);
  });

  it("The others didn't get notfd: both Maria and Trillian have muted the site", async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(siteId);
    assert.eq(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });



  // Category
  // =======================================================


  // ----- Trusted members group subscribes to Spec Cat: New Topics

  it ("Owen opens the Trusted Members notfs prefs", async () => {
    await owensBrowser.userProfilePage.openPreferencesFor(c.TrustedMembersId);
    await owensBrowser.userProfilePage.preferences.switchToNotifications();
  });

  it("... and sets Spec Cat to New Topics", async () => {
    await owensBrowser.userProfilePage.preferences.notfs.setNotfLevelForCategoryId(
          SpecificCatId, c.TestPageNotfLevel.NewTopics);
  });

  it("Owen creates a topic: opens the Specific category", async () => {
    await owensBrowser.go2('/categories');
    await owensBrowser.forumCategoryList.openCategory(SpecificCatName);
  });

  it("... and posts the topic", async () => {
    await owensBrowser.complex.createAndSaveTopic({
        title: TitleThreeNotfsTrillian, body: BodyThreeNotfsTrillian });
    numEmailsToTrillian += 1;
    numEmailsToModya += 1;
    numEmailsTotal += 2;
  });

  it("... Trillian gets notified: the Trusted group is subscr to the cat, New Topics, " +
       "and that's more specific than Trillian's mute-whole-site setting (12564)", async () => {
    const titleBody = [TitleThreeNotfsTrillian, BodyThreeNotfsTrillian];
    await server.waitUntilLastEmailMatches(siteId, trillian.emailAddress, titleBody);
    assert.eq(await server.countLastEmailsSentTo(siteId, trillian.emailAddress), numEmailsToTrillian);
  });

  it("... and Modya, since is staff", async () => {
    const titleBody = [TitleThreeNotfsTrillian, BodyThreeNotfsTrillian];
    await server.waitUntilLastEmailMatches(siteId, modya.emailAddress, titleBody);
    assert.eq(await server.countLastEmailsSentTo(siteId, modya.emailAddress), numEmailsToModya);
  });

  it("... not Maria", async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(siteId);
    assert.eq(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
    // Double check:
    assert.eq(await server.countLastEmailsSentTo(siteId, maria.emailAddress), numEmailsToMaria);
  });


  // ----- All members subscribes to Spec Cat: New Topics

  it ("Owen opens notf prefs for All Members", async () => {
    await owensBrowser.userProfilePage.openPreferencesFor(c.AllMembersId);
    await owensBrowser.userProfilePage.preferences.switchToNotifications();
  });

  it("... configs notfd-of-New-Topics for Spec Cat, this overrides whole-site-Muted setting", async () => {
    await owensBrowser.userProfilePage.preferences.notfs.setNotfLevelForCategoryId(
          SpecificCatId, c.TestPageNotfLevel.NewTopics);
  });

  it("Owen creates a topic: opens the Specific category", async () => {
    await owensBrowser.go2('/categories');
    await owensBrowser.forumCategoryList.openCategory(SpecificCatName);
  });

  it("... and posts the topic", async () => {
    await owensBrowser.complex.createAndSaveTopic({ title: TitleFourNotfsAll, body: BodyFourNotfsAll });
    numEmailsToTrillian += 1;
    numEmailsToMaria += 1;
    numEmailsToModya += 1;
    numEmailsTotal += 3;
  });

  it("... Trillian gets notified", async () => {
    const titleBody = [TitleFourNotfsAll, BodyFourNotfsAll];
    await server.waitUntilLastEmailMatches(siteId, trillian.emailAddress, titleBody);
    assert.eq(await server.countLastEmailsSentTo(siteId, trillian.emailAddress), numEmailsToTrillian);
  });

  it("... and Modya, since is staff", async () => {
    const titleBody = [TitleFourNotfsAll, BodyFourNotfsAll];
    await server.waitUntilLastEmailMatches(siteId, modya.emailAddress, titleBody);
    assert.eq(await server.countLastEmailsSentTo(siteId, modya.emailAddress), numEmailsToModya);
  });

  it("... and Maria, since All Members listens for new topics now", async () => {
    const titleBody = [TitleFourNotfsAll, BodyFourNotfsAll];
    await server.waitUntilLastEmailMatches(siteId, maria.emailAddress, titleBody);
    assert.eq(await server.countLastEmailsSentTo(siteId, maria.emailAddress), numEmailsToMaria);
  });

  it("... and num emails sent is correct", async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(siteId);
    assert.eq(await num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });

  it("Owen posts a reply, mentions Modya for the 3rd time", async () => {
    await owensBrowser.complex.replyToOrigPost("Hi 3rd time @mod_modya");
    url = await owensBrowser.getUrl();
    numEmailsToModya += 1;
    numEmailsTotal += 1;
  });

  it("... Modya gets notified, for the 3rd time", async () => {
    await server.waitUntilLastEmailMatches(siteId, modya.emailAddress, "Hi 3rd time @mod_modya");
    assert.eq(await server.countLastEmailsSentTo(siteId, modya.emailAddress), numEmailsToModya);
  });

  it("... but no one else — they only get notfd about new topics, in Spec Cat", async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(siteId);
    assert.eq(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
    // Double check:
    assert.eq(await server.countLastEmailsSentTo(siteId, trillian.emailAddress), numEmailsToTrillian);
    assert.eq(await server.countLastEmailsSentTo(siteId, maria.emailAddress), numEmailsToMaria);
  });

  // ----- Trusted members subscribes to Every Topic, Spec Cat

  it ("Owen configs Full Members, Spec Cat: Every Topics: Opens the group's notf prefs", async () => {
    await owensBrowser.userProfilePage.openPreferencesFor(c.FullMembersId);
    await owensBrowser.userProfilePage.preferences.switchToNotifications();
  });

  it("... and sets Spec Cat to Every Post", async () => {
    await owensBrowser.userProfilePage.preferences.notfs.setNotfLevelForCategoryId(
          SpecificCatId, c.TestPageNotfLevel.EveryPost);
  });

  it("Owen replies, now when Full Members subscribed to Every Post", async () => {
    await owensBrowser.go2(url);
    await owensBrowser.complex.replyToOrigPost(TopicFourReplyTrillianModyaNotfd);
    numEmailsToTrillian += 1;   // Trusted member, incl in Full Members group
    numEmailsToModya += 1;      // Staff, also included
    numEmailsTotal += 2;
  });

  it("... Trillian gets notified", async () => {
    const reply = [TopicFourReplyTrillianModyaNotfd];
    await server.waitUntilLastEmailMatches(siteId, trillian.emailAddress, reply);
    assert.eq(await server.countLastEmailsSentTo(siteId, trillian.emailAddress), numEmailsToTrillian);
  });

  it("... Modya gets notified", async () => {
    const reply = [TopicFourReplyTrillianModyaNotfd];
    await server.waitUntilLastEmailMatches(siteId, modya.emailAddress, reply);
    assert.eq(await server.countLastEmailsSentTo(siteId, modya.emailAddress), numEmailsToModya);
  });

  it("... not Maria — she's a Basic member only, not in the Full Members group", async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(siteId);
    assert.eq(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });

  // ----- Members override per cat nots

  it ("Maria subscr to Every Post in Spec Cat", async () => {
    await mariasBrowser.go2('/categories');
    await mariasBrowser.forumCategoryList.setCatNrNotfLevel(2, c.TestPageNotfLevel.EveryPost);
  });

  it ("Trillian mutes Spec Cat", async () => {
    await mariasBrowser.topbar.clickLogout();
    await trilliansBrowser.complex.loginWithPasswordViaTopbar(trillian);
    await trilliansBrowser.forumCategoryList.setCatNrNotfLevel(2, c.TestPageNotfLevel.Muted);
  });

  it("Owen replies, again, now when Maria and Trillian have overridden the cat notf prefs", async () => {
    await owensBrowser.complex.replyToOrigPost(TopicFourReplyThreeMariaModya);
    numEmailsToMaria += 1;   // Has subsribed to Every post
    numEmailsToModya += 1;   // Staff, incl in Full Members, which is cat-subscr
    numEmailsTotal += 2;
  });

  it("... Maria gets notified", async () => {
    const reply = [TopicFourReplyThreeMariaModya];
    await server.waitUntilLastEmailMatches(siteId, maria.emailAddress, reply);
    assert.eq(await server.countLastEmailsSentTo(siteId, maria.emailAddress), numEmailsToMaria);
  });

  it("... Modya gets notified", async () => {
    const reply = [TopicFourReplyThreeMariaModya];
    await server.waitUntilLastEmailMatches(siteId, modya.emailAddress, reply);
    assert.eq(await server.countLastEmailsSentTo(siteId, modya.emailAddress), numEmailsToModya);
  });

  it("... not Trillian — she muted the category", async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(siteId);
    assert.eq(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });



  // Page
  // =======================================================

  it("Trillian goes to the page", async () => {
    await trilliansBrowser.go2(url);
  });

  it("... configs replies for every post", async () => {
    await trilliansBrowser.metabar.setPageNotfLevel(c.TestPageNotfLevel.EveryPost);
  });

  it("Maria mutes the page", async () => {
    await trilliansBrowser.topbar.clickLogout();
    await mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
    await mariasBrowser.metabar.setPageNotfLevel(c.TestPageNotfLevel.Muted);
  });

  it("Owen replies. Maria has muted the page, Trillian listens Every Post", async () => {
    await owensBrowser.complex.replyToOrigPost(TopicFourReplyFourTrillanModya);
    numEmailsToTrillian += 1;  // Has subsribed to Every post on the page
    numEmailsToModya += 1;     // Staff, incl in Full Members, which is cat-subscr
    numEmailsTotal += 2;
  });

  it("... Trillian gets notified", async () => {
    const reply = [TopicFourReplyFourTrillanModya];
    await server.waitUntilLastEmailMatches(siteId, trillian.emailAddress, reply);
    assert.eq(await server.countLastEmailsSentTo(siteId, trillian.emailAddress), numEmailsToTrillian);
  });

  it("... Modya gets notified, via Full Memebrs category Every Post subscr", async () => {
    const reply = [TopicFourReplyFourTrillanModya];
    await server.waitUntilLastEmailMatches(siteId, modya.emailAddress, reply);
    assert.eq(await server.countLastEmailsSentTo(siteId, modya.emailAddress), numEmailsToModya);
  });

  it("... not Maria — she muted the page", async () => {
    assert.eq(await server.countLastEmailsSentTo(siteId, maria.emailAddress), numEmailsToMaria);
  });

  it("... lastly, num emails sent is correct", async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(siteId);
    assert.eq(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });

});

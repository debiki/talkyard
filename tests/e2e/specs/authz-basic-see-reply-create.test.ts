/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('../utils/ty-assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import make = require('../utils/make');
import { makeSiteOwnedByOwenBuilder } from '../utils/site-builder';
import lad = require('../utils/log-and-die');
import c = require('../test-constants');

let browser: TyE2eTestBrowser;

let siteBuilder;
let forum: any;

let everyone;
let owen;
let owensBrowser: TyE2eTestBrowser;
let mons;
let monsBrowser: TyE2eTestBrowser;
let modya;
let modyasBrowser: TyE2eTestBrowser;
let maria;
let mariasBrowser: TyE2eTestBrowser;
let michael;
let michaelsBrowser: TyE2eTestBrowser;
let maja;
let majasBrowser: TyE2eTestBrowser;
let corax;
let coraxBrowser: TyE2eTestBrowser;
let guest;
let guestsBrowser: TyE2eTestBrowser;
let strangersBrowser: TyE2eTestBrowser;

let idAddress: IdAddress;
const guestsPostNr = c.FirstReplyNr; // (46WUKT0)
const guestsReplyText = "Guest's reply to Orig Post";
const guestsEditedText = "Guest's reply to Orig Post, edited";
const guestTopicTitle = "Guest topic title";
const guestTopicBody = "Guest topic body";
let guestsTopicUrl: string;
const guestsReplyToOwnTopicText = "Guest's reply to own topic";
const guestsReplyToOwnTopicNr = c.FirstReplyNr;

const majasGuestTopicReplyText = "Majas guest topic reply";
const majasGuestTopicReplyTextEdited = "Majas guest topic reply, edited";
const majasGuestTopicReplyNr = guestsReplyToOwnTopicNr + 1;

const mariasAboutCatReplyText = "Maria's about cat reply";
const mariasAboutCatReplyTextEdited = "Maria's about cat reply, edited";
const mariasAboutCatReplyNr = c.FirstReplyNr;

const michaelsTopicTitle = "Michaels topic title";
const michaelsTopicBody = "Michaels topic body";
const michaelsTopicBodyEdited = "Michaels topic body, edited";
let michaelsTopicUrl: string;


describe("authz basic see reply create  TyT2ABKR83N", () => {

  it("import a site", () => {
    // Later: break out 'PermTestForum' ...? if needed.
    siteBuilder = makeSiteOwnedByOwenBuilder();
    siteBuilder.theSite.settings.allowGuestLogin = true;
    siteBuilder.theSite.settings.requireVerifiedEmail = false;
    siteBuilder.theSite.settings.mayPostBeforeEmailVerified = true; // remove later, if email not required [0KPS2J]
    forum = {
      siteData: siteBuilder.theSite,
      forumPage: null,
      members: {
        owen: siteBuilder.theSite.members[0],
        mons: make.memberModeratorMons(),
        modya: make.memberModeratorModya(),
        maja: make.memberMaja(),
        maria: make.memberMaria(),
        michael: make.memberMichael(),
        trillian: make.memberTrillian(),
        regina: make.memberRegina(),
        corax: make.memberCorax(),
      },
      guests: {
        gunnar: make.guestGunnar(),
      },
      topics: <any> {},
      categories: <any> {},
    };

    forum.members.owen.trustLevel = c.TestTrustLevel.New;
    forum.members.mons.trustLevel = c.TestTrustLevel.New;
    forum.members.modya.trustLevel = c.TestTrustLevel.CoreMember;
    forum.members.maja.trustLevel = c.TestTrustLevel.New;
    forum.members.maria.trustLevel = c.TestTrustLevel.Basic;
    forum.members.michael.trustLevel = c.TestTrustLevel.FullMember;
    // Trillian, Regina, Corax = already trusted, regular, core-member, respectively, by default.

    // Owen has been added already.
    siteBuilder.theSite.members.push(forum.members.mons);
    siteBuilder.theSite.members.push(forum.members.modya);
    siteBuilder.theSite.members.push(forum.members.maja);
    siteBuilder.theSite.members.push(forum.members.maria);
    siteBuilder.theSite.members.push(forum.members.michael);
    siteBuilder.theSite.members.push(forum.members.trillian);
    siteBuilder.theSite.members.push(forum.members.regina);
    siteBuilder.theSite.members.push(forum.members.corax);
    siteBuilder.theSite.guests.push(forum.guests.gunnar);

    let rootCategoryId = 1;
    let defaultCategoryId = 2;
    let allSeeReplyCreateCatId = 3;
    let newSeeBasicReplyFullCreateCatId = 4;
    let onlyStaffSeeCatId = 5;
    let onlyAdminsSeeCatId = 6;

    let forumPage = forum.forumPage = siteBuilder.addForumPageAndRootCategory({
      id: c.FirstPageId,
      rootCategoryId: rootCategoryId,
      // This category is restricted — we don't add any access permissions.
      // That's weird. Commented out this debug assertion to make
      // this test work: [TyT0DEFCAT].
      defaultCategoryId: defaultCategoryId,
      title: 'Authz Basic Forum',
      introText: 'Authz Basic Forum intro text',
    });

    forum.categories.categoryA = siteBuilder.addCategoryWithAboutPage(forumPage, {
      id: defaultCategoryId,
      parentCategoryId: rootCategoryId,
      name: "Default cat",
      slug: 'default-cat',
      aboutPageText: "Default cat",
    });

    forum.categories.allSeeReplyCreateCat = siteBuilder.addCategoryWithAboutPage(forumPage, {
      id: allSeeReplyCreateCatId,
      parentCategoryId: rootCategoryId,
      name: "allSeeReplyCreateCat",
      slug: 'allseereplycreatecat',
      aboutPageText: "About allSeeReplyCreateCat.",
    });
    forum.topics.allSeeReplyCreatePage = siteBuilder.addPage({
      dbgSrc: '382064001',
      id: 'allSeeReplyCreatePage',
      showId: false,
      slug: 'allseereplycreatepage',
      role: PageRole.Discussion,
      title: "Page allSeeReplyCreatePage Title",
      body: "Page allSeeReplyCreatePage text text text.",
      categoryId: allSeeReplyCreateCatId,
      authorId: c.SystemUserId,
    });
    siteBuilder.theSite.permsOnPages.push({
      id: 1,
      forPeopleId: c.EveryoneId,
      onCategoryId: allSeeReplyCreateCatId,
      mayEditWiki: true,
      mayEditOwn: true,
      mayCreatePage: true,
      mayPostComment: true,
      maySee: true,
    });

    forum.categories.newSeeBasicReplyFullCreateCat = siteBuilder.addCategoryWithAboutPage(forumPage, {
      id: newSeeBasicReplyFullCreateCatId,
      parentCategoryId: rootCategoryId,
      name: "newSeeBasicReplyFullCreateCat",
      slug: 'newseebasicreplyfullcreatecat',
      aboutPageText: "About newSeeBasicReplyFullCreateCat.",
    });
    siteBuilder.theSite.permsOnPages.push({
      id: 2,
      forPeopleId: c.AllMembersId,
      onCategoryId: newSeeBasicReplyFullCreateCatId,
      mayEditOwn: true,
      maySee: true,
      maySeeOwn: true,
    });
    siteBuilder.theSite.permsOnPages.push({
      id: 3,
      forPeopleId: c.BasicMembersId,
      onCategoryId: newSeeBasicReplyFullCreateCatId,
      mayEditOwn: true,
      mayPostComment: true,
      maySee: true,
      maySeeOwn: true,
    });
    siteBuilder.theSite.permsOnPages.push({
      id: 4,
      forPeopleId: c.FullMembersId,
      onCategoryId: newSeeBasicReplyFullCreateCatId,
      mayEditWiki: true,
      mayEditOwn: true,
      mayCreatePage: true,
      mayPostComment: true,
      maySee: true,
      maySeeOwn: true,
    });
    siteBuilder.theSite.permsOnPages.push({
      id: 5,
      forPeopleId: c.TrustedMembersId,
      onCategoryId: newSeeBasicReplyFullCreateCatId,
      mayEditComment: true,
      mayEditWiki: true,
      mayEditOwn: true,
      mayDeleteComment: true,
      mayCreatePage: true,
      mayPostComment: true,
      maySee: true,
      maySeeOwn: true,
    });
    siteBuilder.theSite.permsOnPages.push({
      id: 6,
      forPeopleId: c.RegularMembersId,
      onCategoryId: newSeeBasicReplyFullCreateCatId,
      mayEditComment: true,
      mayEditWiki: true,
      mayEditOwn: true,
      mayDeleteComment: true,
      mayCreatePage: true,
      mayPostComment: true,
      maySee: true,
      maySeeOwn: true,
    });
    siteBuilder.theSite.permsOnPages.push({
      id: 7,
      forPeopleId: c.CoreMembersId,
      onCategoryId: newSeeBasicReplyFullCreateCatId,
      mayEditPage: true,
      mayEditComment: true,
      mayEditWiki: true,
      mayEditOwn: true,
      mayDeletePage: true,
      mayDeleteComment: true,
      mayCreatePage: true,
      mayPostComment: true,
      maySee: true,
      maySeeOwn: true,
    });
    // Maria + staff & core members may edit these pages; only >= core members have edit-page perms.
    forum.topics.newSeeBasicReplyFullCreatePage = siteBuilder.addPage({
      dbgSrc: '382064002',
      id: 'newSeeBasicReplyFullCreatePageId',
      showId: false,
      slug: 'newseebasicreplyfullcreatepageslug',
      role: PageRole.Discussion,
      title: "Page newSeeBasicReplyFullCreatePage Title",
      body: "Page newSeeBasicReplyFullCreatePage text text text.",
      categoryId: newSeeBasicReplyFullCreateCatId,
      authorId: c.SystemUserId,
    });
    forum.topics.mariasMindMapPage = siteBuilder.addPage({
      id: 'marias_mind_map_page',
      folder: '/',
      showId: true,
      slug: 'mind-map-page',
      role: c.TestPageRole.MindMap,
      title: `Maria's Mind Map title`,
      body: `Maria's Min Map text text text.`,
      categoryId: forum.categories.newSeeBasicReplyFullCreateCat.id,
      authorId: forum.members.maria.id,
    });

    forum.categories.onlyStaffSeeCat = siteBuilder.addCategoryWithAboutPage(forumPage, {
      id: onlyStaffSeeCatId,
      parentCategoryId: rootCategoryId,
      name: "onlyStaffSeeCat",
      slug: 'onlystaffseecat',
      aboutPageText: "About onlyStaffSeeCat.",
    });
    forum.topics.onlyStaffSeePage = siteBuilder.addPage({
      dbgSrc: '382064003',
      id: 'onlyStaffSeePageId',
      showId: false,
      slug: 'onlystaffseepageslug',
      role: PageRole.Discussion,
      title: "Page onlyStaffSeePage Title",
      body: "Page onlyStaffSeePage text text text.",
      categoryId: onlyStaffSeeCatId,
      authorId: c.SystemUserId,
    });
    siteBuilder.theSite.permsOnPages.push({
      id: 8,
      forPeopleId: c.StaffId,
      onCategoryId: onlyStaffSeeCatId,
      mayEditPage: true,
      mayEditComment: true,
      mayEditWiki: true,
      mayEditOwn: true,
      mayDeletePage: true,
      mayDeleteComment: true,
      mayCreatePage: true,
      mayPostComment: true,
      maySee: true,
      maySeeOwn: true,
    });

    forum.categories.onlyAdminsSeeCat = siteBuilder.addCategoryWithAboutPage(forumPage, {
      id: onlyAdminsSeeCatId,
      parentCategoryId: rootCategoryId,
      name: "onlyAdminsSeeCat",
      slug: 'onlyadminsseecat',
      aboutPageText: "About onlyAdminsSeeCat.",
    });
    forum.topics.onlyAdminsSeePage = siteBuilder.addPage({
      dbgSrc: '382064004',
      id: 'onlyAdminsSeePageId',
      showId: false,
      slug: 'onlyadminsseepageslug',
      role: PageRole.Discussion,
      title: "Page onlyAdminsSeePage Title",
      body: "Page onlyAdminsSeePage text text text.",
      categoryId: onlyAdminsSeeCatId,
      authorId: c.SystemUserId,
    });
    siteBuilder.theSite.permsOnPages.push({
      id: 9,
      forPeopleId: c.AdminsId,
      onCategoryId: onlyAdminsSeeCatId,
      mayEditPage: true,
      mayEditComment: true,
      mayEditWiki: true,
      mayEditOwn: true,
      mayDeletePage: true,
      mayDeleteComment: true,
      mayCreatePage: true,
      mayPostComment: true,
      maySee: true,
      maySeeOwn: true,
    });

    idAddress = server.importSiteData(siteBuilder.theSite);
  });


  it("initialize people", () => {
    browser = new TyE2eTestBrowser(wdioBrowser);
    everyone = browser;
    owen = forum.members.owen;
    owensBrowser = browser;

    modya = forum.members.modya;
    modyasBrowser = browser;
    maria = forum.members.maria;
    mariasBrowser = browser;
    michael = forum.members.michael;
    michaelsBrowser = browser;
    maja = forum.members.maja;
    majasBrowser = browser;
    corax = forum.members.corax;
    coraxBrowser = browser;
    guest = forum.guests.gunnar;
    guestsBrowser = browser;
    strangersBrowser = browser;
  });

  function goToAllEverythingCat(browser) {
    browser.go(`${idAddress.origin}/latest/${forum.categories.allSeeReplyCreateCat.slug}`);
  }

  function goToNewSeeBasicReplyFullCreateCat(browser) {
    browser.go(`${idAddress.origin}/latest/${forum.categories.newSeeBasicReplyFullCreateCat.slug}`);
  }

  function goToNewSeeBasicReplyFullCreateCatAboutPage(browser) {
    browser.go(
      `${idAddress.origin}/about-cat-${forum.categories.newSeeBasicReplyFullCreateCat.slug}`);
  }

  function assertSeesBothCategories(browser) {
    browser.forumCategoryList.waitForNumCategoriesVisible(2);
    const catNames = browser.forumCategoryList.namesOfVisibleCategories();
    assert.deepEq(catNames, [
        forum.categories.allSeeReplyCreateCat.name,
        forum.categories.newSeeBasicReplyFullCreateCat.name]);
  }


  // ------- Stranger

  it("A stranger arrives", () => {
    strangersBrowser.go(idAddress.origin);
  });

  it("Sees only about-all-see-reply-create topic", () => {
    strangersBrowser.forumTopicList.waitForTopics();
    strangersBrowser.forumTopicList.assertNumVisible(1);
    strangersBrowser.forumTopicList.assertTopicVisible(
        forum.topics.allSeeReplyCreatePage.title);
  });

  it("Sees only 'allSeeReplyCreateCat'", () => {
    strangersBrowser.go(idAddress.origin + '/categories');
    strangersBrowser.forumCategoryList.waitForNumCategoriesVisible(1);
    assert.eq(browser.forumCategoryList.numCategoriesVisible(), 1);
    assert.ok(strangersBrowser.forumCategoryList.isCategoryVisible(
        forum.categories.allSeeReplyCreateCat.name));
  });

  it("Cannot access 'newSeeBasicReplyFullCreateCat'", () => {
    goToNewSeeBasicReplyFullCreateCat(strangersBrowser);
    strangersBrowser.forumCategoryList.assertCategoryNotFoundOrMayNotAccess();
  });

  it("... or the 'newSeeBasicReplyFullCreateCat' about page", () => {
    goToNewSeeBasicReplyFullCreateCatAboutPage(strangersBrowser);
    strangersBrowser.assertMayNotSeePage();
  });

  it("... or page 'newSeeBasicReplyFullCreatePage'", () => {
    strangersBrowser.go('/' + forum.topics.newSeeBasicReplyFullCreatePage.slug);
    strangersBrowser.assertMayNotSeePage();
  });

  it("Can access page 'allSeeReplyCreatePage'", () => {
    strangersBrowser.go(idAddress.origin);
    strangersBrowser.forumTopicList.goToTopic(forum.topics.allSeeReplyCreatePage.title);
  });

  it("... can post reply", () => {
    strangersBrowser.complex.signUpAsGuestViaTopbar("Gunnar Guest");
    strangersBrowser.complex.replyToOrigPost(guestsReplyText);
  });

  it("... can edit the reply", () => {
    strangersBrowser.complex.editPostNr(guestsPostNr, guestsEditedText);
  });

  it("... cannot edit orig post", () => {
    assert.not(strangersBrowser.topic.canEditOrigPost());
  });

  it("... cannot edit someone else's reply", () => {
    // TODO TESTS_MISSING add someone elses reply + add +1 above (46WUKT0)
  });

  it("Returns to all-everything category", () => {
    goToAllEverythingCat(strangersBrowser);
  });

  it("... and can create topic 'Guest Topic'", () => {
    strangersBrowser.complex.createAndSaveTopic({ title: guestTopicTitle, body: guestTopicBody });
    guestsTopicUrl = strangersBrowser.getUrl();
  });

  it("... and post a reply", () => {
    strangersBrowser.complex.replyToOrigPost(guestsReplyToOwnTopicText);
  });


  // ------- Maja (trust level = NewMember)

  it("Maja logs in", () => {
    strangersBrowser.topbar.clickLogout();
    majasBrowser.go(idAddress.origin + '/categories');
    majasBrowser.complex.loginWithPasswordViaTopbar(maja);
  });

  it("Sees both 'allSeeReplyCreateCat' and 'newSeeBasicReplyFullCreateCat'", () => {
    assertSeesBothCategories(majasBrowser);
  });

  it("Can access the 'Guest Topic'", () => {
    majasBrowser.go(guestsTopicUrl);
    majasBrowser.assertPageTitleMatches(guestTopicTitle);
  });

  it("... can post reply", () => {
    majasBrowser.complex.replyToOrigPost(majasGuestTopicReplyText);
  });

  it("... can edit the reply", () => {
    majasBrowser.complex.editPostNr(majasGuestTopicReplyNr, majasGuestTopicReplyTextEdited);
  });

  it("... cannot edit orig post", () => {
    assert.not(majasBrowser.topic.canEditOrigPost());
  });

  it("... cannot edit the guest's reply", () => {
    assert.not(majasBrowser.topic.canEditPostNr(guestsReplyToOwnTopicNr));
  });

  it("Goes to 'newSeeBasicReplyFullCreateCat'", () => {
    goToNewSeeBasicReplyFullCreateCat(majasBrowser);
  });

  it("... cannot create topic; there's no Create Topic button", () => {
    majasBrowser.forumButtons.assertNoCreateTopicButton();
  });

  it("Opens page 'newSeeBasicReplyFullCreatePage'", () => {
    majasBrowser.go('/' + forum.topics.newSeeBasicReplyFullCreatePage.slug)
  });

  it("... may read this page", () => {
    majasBrowser.assertPageTitleMatches(forum.topics.newSeeBasicReplyFullCreatePage.title);
  });

  it("... but cannot reply or edit anything", () => {
    assert.not(majasBrowser.topic.canEditSomething());
    assert.not(majasBrowser.topic.canReplyToSomething());
  });


  // ------- Maria (trust level = BasicMember)

  it("Maria logs in", () => {
    majasBrowser.go(idAddress.origin + '/categories');
    majasBrowser.topbar.clickLogout();
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  it("Sees both 'allSeeReplyCreateCat' and 'newSeeBasicReplyFullCreateCat'", () => {
    assertSeesBothCategories(mariasBrowser);
  });

  it("Opens page 'newSeeBasicReplyFullCreatePage'", () => {
    majasBrowser.go('/' + forum.topics.newSeeBasicReplyFullCreatePage.slug)
  });

  it("... can post reply", () => {
    mariasBrowser.complex.replyToOrigPost(mariasAboutCatReplyText);
  });

  it("... can edit the reply", () => {
    mariasBrowser.complex.editPostNr(mariasAboutCatReplyNr, mariasAboutCatReplyTextEdited);
  });

  it("... cannot edit orig post", () => {
    assert.not(mariasBrowser.topic.canEditOrigPost());
  });

  it("Goes to the 'newSeeBasicReplyFullCreateCat' topic list", () => {
    goToNewSeeBasicReplyFullCreateCat(mariasBrowser);
  });

  it("... cannot create topic; there's no Create Topic button", () => {
    mariasBrowser.forumButtons.assertNoCreateTopicButton();
  });


  // ------- Michael (trust level = FullMember)

  it("Michael logs in", () => {
    mariasBrowser.go(idAddress.origin + '/categories');
    mariasBrowser.topbar.clickLogout();
    michaelsBrowser.complex.loginWithPasswordViaTopbar(michael);
  });

  it("Sees both 'allSeeReplyCreateCat' and 'newSeeBasicReplyFullCreateCat'", () => {
    assertSeesBothCategories(michaelsBrowser);
  });

  it("Opens page 'newSeeBasicReplyFullCreatePage'", () => {
    michaelsBrowser.go('/' + forum.topics.newSeeBasicReplyFullCreatePage.slug)
  });

  it("... cannot edit page or Maria's reply", () => {
    assert.not(michaelsBrowser.topic.canEditSomething());
  });

  it("Goes to the 'newSeeBasicReplyFullCreateCat' topic list", () => {
    goToNewSeeBasicReplyFullCreateCat(michaelsBrowser);
  });

  it("... can create topic", () => {
    michaelsBrowser.complex.createAndSaveTopic(
        { title: michaelsTopicTitle, body: michaelsTopicBody });
    michaelsTopicUrl = michaelsBrowser.getUrl();
  });

  it("... can edit the topic afterwards", () => {
    michaelsBrowser.complex.editPageBody(michaelsTopicBodyEdited);
  });


  // ------- Trillian (trusted member)

  // May delete comments but not pages.


  // ------- Corax (trust level = CoreMember)

  it("Corax logs in", () => {
    michaelsBrowser.go(idAddress.origin + '/categories');
    michaelsBrowser.topbar.clickLogout();
    coraxBrowser.complex.loginWithPasswordViaTopbar(corax);
  });

  it("Goes to 'newSeeBasicReplyFullCreatePage'", () => {
    coraxBrowser.go('/' + forum.topics.newSeeBasicReplyFullCreatePage.slug)
  });

  it("... can edit page", () => {
    coraxBrowser.complex.editPageBody("I am Corax.")
  });

  it("... and others' replies", () => {
    coraxBrowser.complex.editPostNr(mariasAboutCatReplyNr, "Corax was here. Corax did edit.")
  });

  it("Goes to guest topic page", () => {
    coraxBrowser.go(guestsTopicUrl);
  });

  it("... can delete posts", () => {
    // coraxBrowser.topic.deletePostNr(majasGuestTopicReplyNr);
  });

  // + can delete whole pages


  // ------- Mons (trust level = New, but is moderator)

  // ...

});


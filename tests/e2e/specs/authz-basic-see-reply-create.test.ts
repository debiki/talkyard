/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import server = require('../utils/server');
import utils = require('../utils/utils');
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import make = require('../utils/make');
import { makeSiteOwnedByOwenBuilder } from '../utils/site-builder';
import assert = require('assert');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

declare let browser: any;

let siteBuilder;
let forum: any;

let everyone;
let owen;
let owensBrowser;
let mons;
let monsBrowser;
let modya;
let modyasBrowser;
let maria;
let mariasBrowser;
let michael;
let michaelsBrowser;
let maja;
let majasBrowser;
let guest;
let guestsBrowser;
let strangersBrowser;

let idAddress: IdAddress;
let forumTitle = "Authz Basic Test Forum";


describe("authz basic see reply create:", () => {

  it("import a site", () => {
    browser.perhapsDebugBefore();

    // Later: break out 'PermTestForum' ...? if needed.
    siteBuilder = makeSiteOwnedByOwenBuilder();
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
        conny: make.memberConny(),
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
    forum.members.michael.trustLevel = c.TestTrustLevel.Member;
    // Trillian, Regina, Conny = already trusted, regular, core-member, respectively, by default.

    // Owen has been added already.
    siteBuilder.theSite.members.push(forum.members.mons);
    siteBuilder.theSite.members.push(forum.members.modya);
    siteBuilder.theSite.members.push(forum.members.maja);
    siteBuilder.theSite.members.push(forum.members.maria);
    siteBuilder.theSite.members.push(forum.members.michael);
    siteBuilder.theSite.members.push(forum.members.trillian);
    siteBuilder.theSite.members.push(forum.members.regina);
    siteBuilder.theSite.members.push(forum.members.conny);
    siteBuilder.theSite.guests.push(forum.guests.gunnar);

    let rootCategoryId = 1;
    let defaultCategoryId = 2;
    let allSeeReplyCreateCatId = 3;
    let newSeeBasicReplyFullCreateCatId = 4;
    let onlyStaffSeeCatId = 5;
    let onlyAdminsSeeCatId = 6;

    let forumPage = forum.forumPage = siteBuilder.addForumPageAndRootCategory({
      id: 'fmp',
      rootCategoryId: rootCategoryId,
      defaultCategoryId: defaultCategoryId,
      title: 'Authz Basic Forum',
      introText: 'Authz Basic Forum intro text',
    });

    forum.categories.categoryA = siteBuilder.addCategoryWithAboutPage(forumPage, {
      id: defaultCategoryId,
      parentCategoryId: rootCategoryId,
      name: "Default cat",
      slug: 'defaultCat',
      aboutPageText: "Default cat",
    });

    forum.categories.allSeeReplyCreateCat = siteBuilder.addCategoryWithAboutPage(forumPage, {
      id: allSeeReplyCreateCatId,
      parentCategoryId: rootCategoryId,
      name: "allSeeReplyCreateCat",
      slug: 'allSeeReplyCreateCat',
      aboutPageText: "About allSeeReplyCreateCat.",
    });
    siteBuilder.theSite.permsOnPages.push({
      id: 1,
      forPeopleId: c.EveryoneId,
      onCategoryId: allSeeReplyCreateCatId,
      mayEditPage: true,
      mayEditComment: true,
      mayEditWiki: true,
      mayEditOwn: true,
      mayDeletePage: true,
      mayDeleteComment: true,
      mayCreatePage: true,
      mayPostComment: true,
      maySee: true,
    });

    forum.categories.newSeeBasicReplyFullCreateCat = siteBuilder.addCategoryWithAboutPage(forumPage, {
      id: newSeeBasicReplyFullCreateCatId,
      parentCategoryId: rootCategoryId,
      name: "newSeeBasicReplyFullCreateCat",
      slug: 'newSeeBasicReplyFullCreateCat',
      aboutPageText: "About newSeeBasicReplyFullCreateCat.",
    });
    siteBuilder.theSite.permsOnPages.push({
      id: 2,
      forPeopleId: c.NewMembersId,
      onCategoryId: newSeeBasicReplyFullCreateCatId,
      mayEditOwn: true,
      maySee: true,
    });
    siteBuilder.theSite.permsOnPages.push({
      id: 3,
      forPeopleId: c.BasicMembersId,
      onCategoryId: newSeeBasicReplyFullCreateCatId,
      mayEditOwn: true,
      mayPostComment: true,
      maySee: true,
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
    });
    siteBuilder.theSite.permsOnPages.push({
      id: 5,
      forPeopleId: c.TrustedMembersId,
      onCategoryId: newSeeBasicReplyFullCreateCatId,
      mayEditComment: true,
      mayEditWiki: true,
      mayEditOwn: true,
      mayCreatePage: true,
      mayPostComment: true,
      maySee: true,
    });
    siteBuilder.theSite.permsOnPages.push({
      id: 6,
      forPeopleId: c.RegularMembersId,
      onCategoryId: newSeeBasicReplyFullCreateCatId,
      mayEditComment: true,
      mayEditWiki: true,
      mayEditOwn: true,
      mayCreatePage: true,
      mayPostComment: true,
      maySee: true,
    });
    siteBuilder.theSite.permsOnPages.push({
      id: 7,
      forPeopleId: c.CoreMembersId,
      onCategoryId: newSeeBasicReplyFullCreateCatId,
      mayEditPage: true,
      mayEditComment: true,
      mayEditWiki: true,
      mayEditOwn: true,
      mayCreatePage: true,
      mayPostComment: true,
      maySee: true,
    });
    // Maria + staff & core members may edit this mind map; only >= core members have edit-page perms.
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
      slug: 'onlyStaffSeeCat',
      aboutPageText: "About onlyStaffSeeCat.",
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
    });

    forum.categories.onlyAdminsSeeCat = siteBuilder.addCategoryWithAboutPage(forumPage, {
      id: onlyAdminsSeeCatId,
      parentCategoryId: rootCategoryId,
      name: "onlyAdminsSeeCat",
      slug: 'onlyAdminsSeeCat',
      aboutPageText: "About onlyAdminsSeeCat.",
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
    });

    idAddress = server.importSiteData(siteBuilder.theSite);
  });


  it("initialize people", () => {
    browser = _.assign(browser, pagesFor(browser));
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
    guest = forum.guests.gunnar;
    guestsBrowser = browser;
    strangersBrowser = browser;
  });


  // ------- Stranger

  it("A stranger arrives", () => {
  });

  it("Sees only 'allSeeReplyCreateCat'", () => {
  });

  it("Cannot access 'newSeeBasicReplyFullCreateCat'", () => {
  });

  it("... or the 'newSeeBasicReplyFullCreateCat' about page", () => {
  });

  it("Can access the 'allSeeReplyCreateCat' about page", () => {
  });

  it("... can post reply", () => {
  });

  it("... can edit the reply", () => {
  });

  it("... cannot edit orig post", () => {
  });

  it("... cannot edit someone else's reply", () => {
  });

  it("Returns to category", () => {
  });

  it("... and can create topic 'Guest Topic'", () => {
  });


  // ------- Maja (trust level = NewMember)

  it("Maja logs in", () => {
    majasBrowser.go(idAddress.origin);
    majasBrowser.complex.loginWithPasswordViaTopbar(maja);
  });

  it("Sees both 'allSeeReplyCreateCat' and 'newSeeBasicReplyFullCreateCat'", () => {
  });

  it("Can crete topic in 'allSeeReplyCreateCat'", () => {
  });

  it("Can access the 'Guest Topic'", () => {
  });

  it("... can post reply", () => {
  });

  it("... can edit the reply", () => {
  });

  it("... cannot edit orig post", () => {
  });

  it("... cannot edit the guest's reply", () => {
  });

  it("Goes to 'newSeeBasicReplyFullCreateCat'", () => {
  });

  it("... cannot create topic; there's no Create Topic button", () => {
  });

  it("Opens the 'newSeeBasicReplyFullCreateCat' About page", () => {
  });

  it("... cannot reply or edit anything", () => {
  });


  // ------- Maria (trust level = BasicMember)

  // ...


  // ------- Michael (trust level = FullMember)

  // ...


  // ------- Conny (trust level = CoreMember)

  // ... can edit orig post + mind map


  // ------- Mons (trust level = New, but is moderator)

  // ...


  it("Done", () => {
    everyone.perhapsDebug();
  });

});


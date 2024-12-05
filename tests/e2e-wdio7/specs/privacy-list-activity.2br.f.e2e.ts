/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;

let forum: LargeTestForum;

let owen: Member;
let owensBrowser: TyE2eTestBrowser;
let maria: Member;
let mariasBrowser: TyE2eTestBrowser;
let mallory: Member;
let mallorysBrowser: TyE2eTestBrowser;
let michael: Member;
let michaelsBrowser: TyE2eTestBrowser;
let guestsBrowser: TyE2eTestBrowser;
let strangersBrowser: TyE2eTestBrowser;

let idAddress: IdAddress;
const forumTitle = "User Profile Access Test Forum";

let oneOfMariasPosts: string;
let oneOfMariasTopicTitles: string;


describe(`privacy-list-activity.2br.f  TyTPRIV_LSACT`, () => {

  it("import a site", async () => {
    forum = buildSite().addLargeForum({ title: forumTitle });

    // Make Michael a full member so he can see activity that strangers may not see.
    forum.members.michael.trustLevel = c.TestTrustLevel.FullMember;

    idAddress = await server.importSiteData(forum.siteData);
    oneOfMariasPosts = forum.topics.byMariaCategoryANr2.body;
    oneOfMariasTopicTitles = forum.topics.byMariaCategoryA.title;
  });

  it("initialize people", async () => {
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owensBrowser = brA;
    owen = forum.members.owen;

    mariasBrowser = brB;
    maria = forum.members.maria;

    mallorysBrowser = brA;
    mallory = forum.members.mallory;

    michaelsBrowser = brA;
    michael = forum.members.michael;
    michael.trustLevel = c.TestTrustLevel.FullMember; // so he can se posts that strangers may not see

    guestsBrowser = brA;
    strangersBrowser = brA;
  });


  // ----- Everyone sees Maria's stuff

  it("Everyone sees Maria's public posts", async () => {
    await strangersBrowser.userProfilePage.openActivityFor(maria.username, idAddress.origin);
    await strangersBrowser.userProfilePage.activity.posts.waitForPostTextsVisible();
    await strangersBrowser.userProfilePage.activity.posts.assertPostTextVisible(oneOfMariasPosts);
  });

  it("... and topics", async () => {
    await strangersBrowser.userProfilePage.activity.switchToTopics({ shallFindTopics: true });
    await strangersBrowser.userProfilePage.activity.topics.waitForTopicTitlesVisible();
    await strangersBrowser.userProfilePage.activity.topics.assertTopicTitleVisible(oneOfMariasTopicTitles);
  });


  // ----- Hide activity for strangers


  it("Maria goes to her privacy tab", async () => {
    await mariasBrowser.userProfilePage.openActivityFor(maria.username, idAddress.origin);
    await mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
    await mariasBrowser.userProfilePage.goToPreferences();
    await mariasBrowser.userProfilePage.preferences.switchToPrivacy();
  });

  it("... hides her activity for strangers", async () => {
    await mariasBrowser.userProfilePage.preferences.privacy.setHideActivityForStrangers(true);
    await mariasBrowser.userProfilePage.preferences.privacy.savePrivacySettings();
  });

  it("The stranger no longer sees her topics", async () => {
    await strangersBrowser.refresh2();
    await strangersBrowser.userProfilePage.activity.topics.waitForNothingToShow();
  });

  it("... and not her posts", async () => {
    await strangersBrowser.userProfilePage.activity.switchToPosts({ shallFindPosts: 'NoSinceActivityHidden' });
    await strangersBrowser.userProfilePage.activity.posts.waitForNothingToShow(); // hmm redundant
  });

  /* Guest login not enabled in this forum. Maybe later? skip for now:
  it("A guest also doesn't see her posts", async () => {
    await guestsBrowser.complex.logInAsGuestViaTopbar("Curiosiy Guestiy");
    await guestsBrowser.refresh2();
    await guestsBrowser.userProfilePage.activity.posts.waitForNothingToShow();
    await guestsBrowser.topbar.clickLogout();
  }); */

  it("Mallory is a new membmer, won't see posts", async () => {
    await mallorysBrowser.complex.loginWithPasswordViaTopbar(mallory);
    await mallorysBrowser.userProfilePage.activity.posts.waitForNothingToShow();
  });

  it("But Michael is a full member, does see the posts", async () => {
    await mallorysBrowser.topbar.clickLogout();
    await michaelsBrowser.complex.loginWithPasswordViaTopbar(michael);
    await michaelsBrowser.userProfilePage.activity.posts.waitForPostTextsVisible();
    await michaelsBrowser.userProfilePage.activity.posts.assertPostTextVisible(oneOfMariasPosts);
  });

  it("... and the topics", async () => {
    await michaelsBrowser.userProfilePage.activity.switchToTopics({ shallFindTopics: true });
    await michaelsBrowser.userProfilePage.activity.topics.waitForTopicTitlesVisible();
    await michaelsBrowser.userProfilePage.activity.topics.assertTopicTitleVisible(oneOfMariasTopicTitles);
  });

  it("Maria also sees her posts", async () => {
    await mariasBrowser.userProfilePage.goToActivity();
    await mariasBrowser.userProfilePage.activity.posts.waitForPostTextsVisible();
    await mariasBrowser.userProfilePage.activity.posts.assertPostTextVisible(oneOfMariasPosts);
  });


  // ----- Hide activity for everyone (except staff)


  it("Maria hides her activity for everyone", async () => {
    await mariasBrowser.userProfilePage.goToPreferences();
    await mariasBrowser.userProfilePage.preferences.switchToPrivacy();
    await mariasBrowser.userProfilePage.preferences.privacy.setHideActivityForAll(true);
    await mariasBrowser.userProfilePage.preferences.privacy.savePrivacySettings();
  });

  it("Michael now cannot see Maria's topics", async () => {
    await michaelsBrowser.refresh2();
    await michaelsBrowser.userProfilePage.activity.topics.waitForNothingToShow();
  });

  it("... or posts", async () => {
    await michaelsBrowser.userProfilePage.activity.switchToPosts({ shallFindPosts: 'NoSinceActivityHidden' });
    await michaelsBrowser.userProfilePage.activity.posts.waitForNothingToShow(); // hmm redundant
  });

  it("The stranger still don't see the posts", async () => {
    await michaelsBrowser.topbar.clickLogout();
    await strangersBrowser.userProfilePage.activity.posts.waitForNothingToShow();
  });

  it("But Owen sees the posts — he's admin", async () => {
    await owensBrowser.complex.loginWithPasswordViaTopbar(owen);
    await owensBrowser.userProfilePage.activity.posts.waitForPostTextsVisible();
    await owensBrowser.userProfilePage.activity.posts.assertPostTextVisible(oneOfMariasPosts);
  });

  it("... and the topics too", async () => {
    await owensBrowser.userProfilePage.activity.switchToTopics({ shallFindTopics: true });
    await owensBrowser.userProfilePage.activity.topics.waitForTopicTitlesVisible();
    await owensBrowser.userProfilePage.activity.topics.assertTopicTitleVisible(oneOfMariasTopicTitles);
  });

  it("Maria still sees her own posts", async () => {
    await mariasBrowser.userProfilePage.goToActivity();
    await mariasBrowser.userProfilePage.activity.posts.waitForPostTextsVisible();
    await mariasBrowser.userProfilePage.activity.posts.assertPostTextVisible(oneOfMariasPosts);
  });

  it("... and topics", async () => {
    await mariasBrowser.userProfilePage.activity.switchToTopics({ shallFindTopics: true });
    await mariasBrowser.userProfilePage.activity.topics.waitForTopicTitlesVisible();
    await mariasBrowser.userProfilePage.activity.topics.assertTopicTitleVisible(oneOfMariasTopicTitles);
  });


  // If implementing search-for-pots-by-user in the advanced search dialog, add e2e tests here
  // that disables that, if user has hidden hens activity.  [6UKDSQ29]


  // ----- Show activity again


  it("Maria shows her activity again", async () => {
    await mariasBrowser.userProfilePage.goToPreferences();
    await mariasBrowser.userProfilePage.preferences.switchToPrivacy();
    await mariasBrowser.userProfilePage.preferences.privacy.setHideActivityForStrangers(false);
    await mariasBrowser.userProfilePage.preferences.privacy.savePrivacySettings();
  });

  it("Now the stranger sees her topics again", async () => {
    await owensBrowser.topbar.clickLogout();
    await strangersBrowser.refresh2();
    await strangersBrowser.userProfilePage.activity.topics.waitForTopicTitlesVisible();
    await strangersBrowser.userProfilePage.activity.topics.assertTopicTitleVisible(oneOfMariasTopicTitles);
  });

  it("... and posts", async () => {
    await strangersBrowser.userProfilePage.activity.switchToPosts({ shallFindPosts: true });
    await strangersBrowser.userProfilePage.activity.posts.waitForPostTextsVisible();
    await strangersBrowser.userProfilePage.activity.posts.assertPostTextVisible(oneOfMariasPosts);
  });

});


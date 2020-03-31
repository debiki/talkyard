/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import fs = require('fs');
import assert = require('assert');
import tyAssert = require('../utils/ty-assert');
import server = require('../utils/server');
import pagesFor = require('../utils/pages-for');
import { buildSite } from '../utils/site-builder';
import lad = require('../utils/log-and-die');
import c = require('../test-constants');
import utils = require('../utils/utils');
const logMessage = lad.logMessage;

declare let browser: any;

let forum: LargeTestForum;

let usersBrowser;

let initResult: InitResult;
let who: string;

let memberName: string;
let member;
let memberIsAdmin: boolean;

let idAddress: IdAddress;
let siteId: number;
let forumTitle = "Navigation Test Forum";

const newTopicTitle = "Rabbits";
const newTopicText = "Follow the white rabbit";

let nextPostNr = c.FirstReplyNr;


function assertPublicTopicsVisible(browser) {
  // browser.forumTopicList.assertTopicTitlesAreAndOrder()
  browser.forumTopicList.waitForTopicVisible(forum.topics.byMariaCategoryA.title);
  browser.forumTopicList.waitForTopicVisible(forum.topics.byMariaCategoryANr2.title);
  browser.forumTopicList.waitForTopicVisible(forum.topics.byMariaCategoryANr3.title);
  browser.forumTopicList.waitForTopicVisible(forum.topics.byMariaCategoryB.title);
  browser.forumTopicList.waitForTopicVisible(forum.topics.byMichaelCategoryA.title);
}


interface InitResult {
  member?: string;  // RENAME to 'username'
  fullName?: string;
  memberIsAdmin?: true;
  isGuest?: true;
}


function makeWholeSpec(initFn: () => InitResult) {
  initResult = initFn();
  memberName = initResult.member;
  memberIsAdmin = initResult.memberIsAdmin;
  let willBeLoggedIn = false;

  // Only for testing guests. -----
  const localHostname = 'comments-for-e2e-test-embguest-localhost-8080';
  const embeddingOrigin = 'http://e2e-test-embguest.localhost:8080';
  const embeddingPageSlug = 'emb-cmts-guest.html';
  const embeddingPageUrl = embeddingOrigin + '/' + embeddingPageSlug;
  // ------------------------------

  forum = buildSite().addLargeForum({
    title: forumTitle,
    members: ['alice', 'maria', 'michael'],
  });

  if (initResult.isGuest) {
    // Create an embedded comments site.
    forum.siteData.meta.localHostname = localHostname;
    forum.siteData.settings.allowEmbeddingFrom = embeddingOrigin;
    forum.siteData.settings.allowGuestLogin = true;
  }

  who = (
      memberIsAdmin ? "admin " : (
        memberName ? "member " : (
          initResult.isGuest ? "guest " : "a stranger"))) + (
      memberName || initResult.fullName || '');


  describe(`Navigation as ${who}:`, () => {

    it("import a site", () => {
      idAddress = server.importSiteData(forum.siteData);
      siteId = idAddress.id;
      server.skipRateLimits(siteId);
    });

    it("init brower", () => {
      usersBrowser = _.assign(browser, pagesFor(browser));
    });

    it("go to forum", () => {
      usersBrowser.go(idAddress.origin);
      usersBrowser.disableRateLimits();
    });

    if (memberName) {
      willBeLoggedIn = true;

      it(`login as member ${memberName}`, () => {
        member = forum.members[memberName];
        usersBrowser.complex.loginWithPasswordViaTopbar(member);
      });
    }
    else if (initResult.isGuest) {
      // Need to create an embedding page, to login as Guest there, by clicking Reply.
      willBeLoggedIn = true;

      it("Creates an embedding page", () => {
        fs.writeFileSync(`target/${embeddingPageSlug}`, makeHtml('b3c-aaa', '#500'));
        function makeHtml(pageName: string, bgColor: string): string {
          return utils.makeEmbeddedCommentsHtml({ pageName, discussionId: '', localHostname, bgColor});
        }
      });

      it(`... opens it`, () => {
        usersBrowser.go(embeddingPageUrl);
      });

      it(`... logs in as guest ${initResult.fullName}`, () => {
        // This opens a guest login dialog: (but the Sign Up button doesn't)
        logMessage("comments iframe: Clicking Reply ...");
        usersBrowser.switchToEmbeddedCommentsIrame();
        usersBrowser.topic.clickReplyToEmbeddingBlogPost();

        logMessage("login popup: Logging in as guest ...");
        usersBrowser.swithToOtherTabOrWindow();
        usersBrowser.loginDialog.signUpLogInAs_Real_Guest(initResult.fullName);
        usersBrowser.switchBackToFirstTabOrWindow();
      });

      it(`Click one's user profile link...`, () => {
        usersBrowser.switchToEmbeddedCommentsIrame();
        usersBrowser.waitAndClick('.s_MB_Name');
      });

      it(`... switches to a new tab, which should show hens profile`, () => {
        usersBrowser.waitForMinBrowserTabs(2);
        usersBrowser.swithToOtherTabOrWindow();
      });

      addOwnProfileTest("0: ");

      it(`... closes that tab, switches back to the first`, () => {
        usersBrowser.closeWindowSwitchToOther();
      });
    }

    it("Prepare tests: Add Maria's page to watchbar", () => {
      // This makes all different 'describe...' below work, also if the first one is skipped.
      usersBrowser.go('/' + forum.topics.byMariaCategoryA.slug);
    });


    // ------- Test the forum

    // This tests navigation from all kinds of pages — user profile, search, topics — to the forum.

    describe("Test navigation to forum", () => {

      it("start at forum, to test forum", () => {
        usersBrowser.go(idAddress.origin);
      });
      addForumTests("1: ");

      it("start at topic, go to forum, test forum", () => {
        usersBrowser.go('/' + forum.topics.byMariaCategoryA.slug);
        usersBrowser.topbar.clickHome();
      });
      addForumTests("2: ");

      it("remember / as last page", () => {
        usersBrowser.go('/');
      });
      it("start at user profile, go back to last page = to the forum, test forum", () => {
        usersBrowser.go('/-/users/maria');
        usersBrowser.topbar.clickBack();  // goes back to the forum
      });
      addForumTests("3: ");

      it("start at search page, go to forum, test forum", () => {
        usersBrowser.goToSearchPage();
        usersBrowser.topbar.clickHome();
      });
      addForumTests("4: ");

      if (memberIsAdmin) {
        it("start in admin area, go to forum via watchbar, test forum", () => {
          usersBrowser.adminArea.goToLoginSettings();
          usersBrowser.adminArea.waitAssertVisible();
          usersBrowser.watchbar.openIfNeeded();
          usersBrowser.watchbar.goToTopic(forumTitle, { isHome: true });
        });
        addForumTests("5: ");
      }
    });


    // ------- Test a topic

    describe("Test navigation to topic", () => {

      it("start at forum, to test Maria's topic", () => {
        usersBrowser.go(idAddress.origin);
      });
      it("... go to Maria's topic", () => {
        usersBrowser.forumTopicList.goToTopic(forum.topics.byMariaCategoryA.title);
      });
      addMariasTopicTests();

      it("start at another topic", () => {
        usersBrowser.go('/' + forum.topics.byMariaCategoryANr2.slug);
      });
      it("... it looks ok", () => {
        usersBrowser.topic.waitForPostAssertTextMatches(
            c.BodyNr, forum.topics.byMariaCategoryANr2.body);
      });
      it("go to Maria's topic, test it (topic to topic)", () => {
        usersBrowser.watchbar.goToTopic(forum.topics.byMariaCategoryA.title);
      });
      addMariasTopicTests();

      it("start at user profile, go back to last page = to Maria's topic, test it", () => {
        usersBrowser.go('/-/users/maria');
        usersBrowser.topbar.clickBack();  // goes back to the topic because it's the last page
      });
      addMariasTopicTests();

      it("start at search page, go back to topic, test it", () => {
        usersBrowser.goToSearchPage();
        usersBrowser.topbar.clickBack();
      });
      addMariasTopicTests();

      if (memberIsAdmin) {
        it("start in admin area, users list, go to topic", () => {
          usersBrowser.adminArea.goToUsersEnabled();
          usersBrowser.adminArea.users.waitForLoaded();
          usersBrowser.watchbar.goToTopic(forum.topics.byMariaCategoryA.title);
        });
        addMariasTopicTests();
      }
    });


    // ------- Test nav to other user's profile

    describe("Test navigation to other user's profile", () => {

      it("start at forum, to test Maria's profile page", () => {
        usersBrowser.go(idAddress.origin);
      });
      it("... go to Maria's profile page", () => {
        usersBrowser.forumTopicList.openAboutUserDialogForUsername('maria');
        usersBrowser.aboutUserDialog.clickViewProfile();
      });
      addMariasProfileTets("1: ");

      it("start at a topic", () => {
        usersBrowser.go('/' + forum.topics.byMariaCategoryANr2.slug);
      });
      it("... go to Maria's profile page", () => {
        usersBrowser.pageTitle.openAboutAuthorDialog();
        usersBrowser.aboutUserDialog.clickViewProfile();
      });
      addMariasProfileTets("2: ");

      it("start at another user's profile", () => {
        usersBrowser.go('/-/users/michael');
      });
      it("... it looks ok", () => {
        usersBrowser.userProfilePage.waitUntilUsernameVisible();
        usersBrowser.userProfilePage.assertUsernameIs('michael');
      });
      it("... go to Maria's profile page", () => {
        usersBrowser.topbar.clickBack(); // goes back to Maria's topic nr 2
        usersBrowser.pageTitle.openAboutAuthorDialog();  // about Maria
        usersBrowser.aboutUserDialog.clickViewProfile(); // goes to Maria's profile
      });
      addMariasProfileTets("3: ");

      it("start at search page, go to Maria's profile, test profile page", () => {
        usersBrowser.goToSearchPage();
        usersBrowser.watchbar.openIfNeeded();
        usersBrowser.watchbar.goToTopic(forum.topics.byMariaCategoryA.title);
        usersBrowser.pageTitle.openAboutAuthorDialog();  // about Maria
        usersBrowser.aboutUserDialog.clickViewProfile(); // goes to Maria's profile
      });
      addMariasProfileTets("4: ");

      if (memberIsAdmin) {
        it("start in admin area, about user page, go to user", () => {
          usersBrowser.adminArea.goToUser(forum.members.maria);
          usersBrowser.adminArea.user.waitForLoaded();
          usersBrowser.adminArea.user.viewPublProfile();
        });
        addMariasProfileTets("5: ");
      }
    });


    // ------- Test nav to own profile

    if (willBeLoggedIn) describe("Test nav to own profile", () => {

      it("start at forum, MyMenu nav to own profile page", () => {
        usersBrowser.go2(idAddress.origin);
        usersBrowser.topbar.clickGoToProfile();
      });
      addOwnProfileTest("1: ");

      it("start at discussion topic, MyMenu nav to own profile page", () => {
        usersBrowser.go2('/' + forum.topics.byMariaCategoryANr2.slug);
        usersBrowser.topbar.clickGoToProfile();
      });
      addOwnProfileTest("2: ");

      it("start at another user's profile, MyMenu nav to own profile", () => {
        usersBrowser.go2('/-/users/maria');
        usersBrowser.topbar.clickGoToProfile();
      });
      addOwnProfileTest("3: ");

      it("start at search page, MyMenu nav to own profile", () => {
        usersBrowser.goToSearchPage();
        usersBrowser.topbar.clickGoToProfile();
      });
      addOwnProfileTest("4: ");

      if (memberIsAdmin) {
        it("start at admin page, MyMenu nav to own profile", () => {
          usersBrowser.adminArea.goToReview();
          usersBrowser.topbar.clickGoToProfile();
        });
        addOwnProfileTest("5: ");
      }
    });


    // ------- Create topic, then test everything

    if (willBeLoggedIn) describe("Test new topic, and navigation from it to everything", () => {

      it("go to forum, create a topic", () => {
        usersBrowser.go(idAddress.origin);
        usersBrowser.complex.createAndSaveTopic({ title: newTopicTitle, body: newTopicText });
      });

      it("... now test all types of pages: go back to the forum, test it", () => {
        usersBrowser.topbar.clickHome();
      });
      addForumTests("NT: ");

      it("... another topic", () => {
        usersBrowser.forumTopicList.goToTopic(forum.topics.byMariaCategoryA.title);
      });
      addMariasTopicTests();

      it("... a user profile page", () => {
        usersBrowser.pageTitle.openAboutAuthorDialog();
        usersBrowser.aboutUserDialog.clickViewProfile();
      });
      addMariasProfileTets("New-topic: ");

      it("... the search page", () => {
        usersBrowser.topbar.searchFor(forum.topics.byMariaCategoryA.title);
      });
      addSearchPageTests(forum.topics.byMariaCategoryA.title);

    });


    // ------- Test search page profile

    describe("Test navigation to search page", () => {

      it("start at forum, to test search page", () => {
        usersBrowser.go(idAddress.origin);
      });
      it("... go to search page, by searching for a title by Maria", () => {
        usersBrowser.topbar.searchFor(forum.topics.byMariaCategoryA.title);
      });
      addSearchPageTests(forum.topics.byMariaCategoryA.title);

      it("start at a topic, search for sth", () => {
        usersBrowser.go('/' + forum.topics.byMichaelCategoryA.slug);
        usersBrowser.topbar.searchFor(forum.topics.byMariaCategoryANr2.title);
      });
      addSearchPageTests(forum.topics.byMariaCategoryANr2.title);

      it("start at a user's profile, search for sth", () => {
        usersBrowser.go('/-/users/michael');
        usersBrowser.topbar.searchFor(forum.topics.byMariaCategoryB.title);
      });
      addSearchPageTests(forum.topics.byMariaCategoryB.title);

      it("start at search page, with q=CategoryB", () => {
        usersBrowser.goToSearchPage('CategoryB');
      });
      addSearchPageTests('CategoryB');

      if (memberIsAdmin) {
        it("start in admin area, review section, search for staff-only page  TyT85WABR0", () => {
          usersBrowser.adminArea.goToReview();
          usersBrowser.topbar.searchFor(forum.topics.byMariaStaffOnlyCat.title);
        });
        addSearchPageTests(forum.topics.byMariaStaffOnlyCat.title);
      }

    });
  });

}


function addForumTests(testTextPrefix) {

  const pfx = testTextPrefix;

  it(pfx + "check /latest topics visible", () => {
    usersBrowser.forumTopicList.waitForTopics();
    assertPublicTopicsVisible(usersBrowser);
  });

  it(pfx + "check /new topics visible", () => {
    usersBrowser.forumButtons.clickViewNew();
    usersBrowser.forumTopicList.waitForTopics();
    assertPublicTopicsVisible(usersBrowser);
  });

  /*
  it(pfx + "check /new/category-b", () => {
    usersBrowser.forumButtons.clickViewNew();
    assertPublicTopicsVisible(usersBrowser);
  }); */

  /*
  TESTS_MISSING  TyT4BKAFE5GA verify topic list sorted correctly. Select a category, verify filters & sorts again.
  TestForum():
  - Go to /latest. Verify sorted correctly.
  - Cat B: only topics from that cat.
  - Cat A:
    - Category sorted correctly.
    - Sort by Newest.
  */
}


function addMariasTopicTests() {
  const pfx = `${nextPostNr}: `;
  const postNr = nextPostNr;
  nextPostNr += 1;

  it(pfx + "check orig post", () => {
    usersBrowser.topic.waitForPostAssertTextMatches(c.BodyNr, forum.topics.byMariaCategoryA.body);
  });

  // Strangers cannot post replies, not logged in.
  if (!memberName)
    return;

  it(pfx + "reply", () => {
    const text = 'Hello post nr ' + postNr;
    usersBrowser.complex.replyToOrigPost(text);
    usersBrowser.topic.waitForPostAssertTextMatches(postNr, text);
  });
}


function addMariasProfileTets(testPrefix) {
  const pfx = testPrefix;

  // Maria has created 3 topics visible to staff only: a deleted, an unlisted and a staff-only topic.
  const numTopicsAndPosts = memberIsAdmin ? 4 + 3 : 4;

  it(pfx + "check username", () => {
    usersBrowser.userProfilePage.waitUntilUsernameVisible();
    usersBrowser.userProfilePage.assertUsernameIs('maria');
  });

  it(pfx + "check posts", () => {
    usersBrowser.userProfilePage.activity.posts.waitForPostTextsVisible();
    usersBrowser.userProfilePage.activity.posts.assertExactly(numTopicsAndPosts);
    usersBrowser.userProfilePage.activity.posts.assertPostTextVisible(
        forum.topics.byMariaCategoryA.body);
  });

  it(pfx + "check navigation to topics, & topics", () => {
    usersBrowser.userProfilePage.activity.switchToTopics({ shallFindTopics: true });
    usersBrowser.userProfilePage.activity.topics.assertExactly(numTopicsAndPosts);
    usersBrowser.userProfilePage.activity.topics.assertTopicTitleVisible(
        forum.topics.byMariaCategoryA.title);
  });
}




function addOwnProfileTest(prefix: string) {
  it(prefix + "... the profile page shows the correct user: " + who, () => {
    const upp = usersBrowser.userProfilePage;
    let n = 0;
    if (initResult.fullName) {
      tyAssert.includes(upp.waitAndGetFullName(), initResult.fullName);
      n += 1;
    }
    if (initResult.member) {
      tyAssert.includes(upp.waitAndGetUsername(), initResult.member);
      n += 1;
    }
    lad.dieIf(!n, `Broken e2e test: No user profile tests [TyE305KD5JM4]`);
  });
}


function addSearchPageTests(searchPhrase) {

  it(`Did search for: "${searchPhrase}"`, () => {
    usersBrowser.searchResultsPage.waitForResults(searchPhrase);
  });

  // Currently uploaded site contents isn't indexed. [2WBKP05]
  //it(`Found correct number of pages`, () => {
  //  usersBrowser.searchResultsPage.countNumPagesFound_1(???);
  //});

  it(`Then search for: "Black gremlins"`, () => {
    usersBrowser.pause(200);  // [E2EBUG] without this, sometimes:
    // """FAIL: Error: An unknown server-side error occurred while processing the command."""
    usersBrowser.searchResultsPage.searchForWaitForResults("Black gremlins");
  });

  it(`Found nothing`, () => {
    const numPagesFound = usersBrowser.searchResultsPage.countNumPagesFound_1();
    assert(numPagesFound === 0, `Found ${numPagesFound} pages, should have found none`);
  });

  // The "white rabbit" page hasn't been created, if the user is a stranger (not a member).
  if (!memberName)
    return;

  it(`Then search for: "White rabbit"`, () => {
    usersBrowser.pause(200);  // [E2EBUG] seee above
    usersBrowser.searchResultsPage.searchForWaitForResults("White rabbit");
  });

  it(`Found correct number of pages`, () => {
    const numPagesFound = usersBrowser.searchResultsPage.countNumPagesFound_1();
    assert(numPagesFound === 1, `Found wrong number of pages: ${numPagesFound}, should have found 1`);
  });

  it(`Found correct search phrase`, () => {
    const text = browser.$('.esSERP_Hit_Text').getText();
    assert(text === newTopicText, `Found text: "${text}", should have been: "${newTopicText}"`);
  });
}


export = makeWholeSpec;

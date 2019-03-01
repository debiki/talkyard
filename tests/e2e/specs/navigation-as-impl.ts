/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import pagesFor = require('../utils/pages-for');
import { buildSite } from '../utils/site-builder';
import logMessageModule = require('../utils/log-and-die');
import c = require('../test-constants');
const logMessage = logMessageModule.logMessage;

declare let browser: any;

let forum: LargeTestForum;

let usersBrowser;
let memberName: string;
let member;
let memberIsAdmin: boolean;

let idAddress: IdAddress;
let forumTitle = "Navigation Test Forum";

const newTopicTitle = "Rabbits";
const newTopicText = "Follow the white rabbit";

let nextPostNr = c.FirstReplyNr;


function logAndAssertVisible(browser, topicTitle: string, shallBeVisible: boolean = true) {
  if (shallBeVisible)
    browser.forumTopicList.assertTopicVisible(topicTitle);
  else
    browser.forumTopicList.assertTopicNotVisible(topicTitle);
}


function assertPublicTopicsVisible(browser) {
  // browser.forumTopicList.assertTopicTitlesAreAndOrder()
  logAndAssertVisible(browser,"About category CategoryA");
  logAndAssertVisible(browser,"About category CategoryB");
  logAndAssertVisible(browser, forum.topics.byMariaCategoryA.title);
  logAndAssertVisible(browser, forum.topics.byMariaCategoryANr2.title);
  logAndAssertVisible(browser, forum.topics.byMariaCategoryANr3.title);
  logAndAssertVisible(browser, forum.topics.byMariaCategoryB.title);
  logAndAssertVisible(browser, forum.topics.byMichaelCategoryA.title);
  process.stdout.write('\n');
}



function makeWholeSpec(initFn) {
  const initResult = initFn(browser);
  memberName = initResult.member;
  usersBrowser = _.assign(browser, pagesFor(browser));
  memberIsAdmin = initResult.memberIsAdmin;
  forum = buildSite().addLargeForum({
    title: forumTitle,
    members: ['alice', 'maria', 'michael'],
  });

  const who = (memberIsAdmin ? "admin " : (memberName ? "member " : "a stranger")) + (memberName || '');

  describe(`Navigation as ${who}:`, () => {

    it("import a site", () => {
      idAddress = server.importSiteData(forum.siteData);
    });

    it("go to forum", () => {
      usersBrowser.go(idAddress.origin);
      usersBrowser.disableRateLimits();
    });

    if (memberName) {
      it("login", () => {
        member = forum.members[memberName];
        usersBrowser.complex.loginWithPasswordViaTopbar(member);
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
        usersBrowser.topic.waitForPostNrVisible(c.BodyNr);
        usersBrowser.topic.assertPostTextMatches(c.BodyNr, forum.topics.byMariaCategoryANr2.body);
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


    // ------- Test user profile

    describe("Test navigation to user profile", () => {

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
        usersBrowser.userProfilePage.waitForName();
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


    // ------- Create topic, then test everything

    if (memberName) describe("Test new topic, and navigation from it to everything", () => {

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
    usersBrowser.topic.waitForPostNrVisible(c.BodyNr);
    usersBrowser.topic.assertPostTextMatches(c.BodyNr, forum.topics.byMariaCategoryA.body);
  });

  // Strangers cannot post replies, not logged in.
  if (!memberName)
    return;

  it(pfx + "reply", () => {
    const text = 'Hello post nr ' + postNr;
    usersBrowser.complex.replyToOrigPost(text);
    usersBrowser.topic.waitForPostNrVisible(postNr);
    usersBrowser.topic.assertPostTextMatches(postNr, text);
  });
}


function addMariasProfileTets(testPrefix) {
  const pfx = testPrefix;

  // Maria has created 3 topics visible to staff only: a deleted, an unlisted and a staff-only topic.
  const numTopicsAndPosts = memberIsAdmin ? 4 + 3 : 4;

  it(pfx + "check username", () => {
    usersBrowser.userProfilePage.waitForName();
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

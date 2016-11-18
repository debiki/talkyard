/// <reference path="../../../../modules/definitely-typed/lodash/lodash.d.ts"/>
/// <reference path="../../../../modules/definitely-typed/node/node.d.ts"/>

import _ = require('lodash');
import assert = require('assert');
import logAndDie = require('./log-and-die');
import settings = require('./settings');
import c = require('../test-constants');
var logUnusual = logAndDie.logUnusual, die = logAndDie.die, dieIf = logAndDie.dieIf;
var logMessage = logAndDie.logMessage;


function byBrowser(result) {  // dupl code [4WKET0] move all to here?
  if (!_.isObject(result) || _.isArray(result) || result.value) {
    // This is the results from one single browser. Create a dummy by-browser
    // result map.
    return { onlyOneBrowser: result };
  }
  else {
    // This is an object like:
    //    { browserA: { ..., value: ... }, browserB: { ..., value: ... } }
    // or like:
    //    { browserA: "text-found", browserB: "other-text-found" }
    // That's what we want.
    return result;
  }
}

function isTheOnly(browserName) {  // dupl code [3PFKD8GU0]
  return browserName === 'onlyOneBrowser';
}

function browserNamePrefix(browserName): string { // dupl code [4GK0D8G2]
  if (isTheOnly(browserName)) return '';
  return browserName + ': ';
}


// There might be many browsers, when using Webdriver.io's multiremote testing, so
// `browser` is an argument.
//
function pagesFor(browser) {
  var api = {

    getSiteId: function(): string {
      var result = browser.execute(function() {
        return window['debiki'].siteId;
      });
      assert.ok(result.state === 'success',
          "Error getting site id, result.state: " + result.state);
      return result.value;
    },


    refresh: function() {
      // browser.refresh() causes a weird cannot-find-elem problem. Perhaps because of
      // some incompatibility between webdriver.io and Chrome? Recently there was a stale-
      // element bug after refresh(), fixed in Webdriver.io 4.3.0. Instead:
      let url = browser.url().value;
      browser.go('http://www.google.com');
      browser.go(url);
    },


    waitForMyDataAdded: function() {
      browser.waitForVisible('.e2eMyDataAdded');
    },


    assertPageHtmlSourceDoesNotMatch: function(toMatch) {
      let resultsByBrowser = byBrowser(browser.getSource());
      let regex = _.isString(toMatch) ? new RegExp(toMatch) : toMatch;
      _.forOwn(resultsByBrowser, (text, browserName) => {
        assert(!regex.test(text), browserNamePrefix(browserName) + "Page source does match " + regex);
      });
    },


    createSite: {
      fillInFieldsAndSubmit: function(data) {
        browser.waitAndSetValue('#e2eEmail', data.email);
        browser.click('#e2eNext1');
        browser.waitAndSetValue('#e2eEmail2', data.email);
        browser.click('#e2eNext2');
        browser.setValue('#dwLocalHostname', data.localHostname);
        browser.click('#e2eNext3');
        browser.setValue('#e2eOrgName', data.localHostname);
        browser.click('#e2eAcceptTerms');
        browser.click('input[type=submit]');
        browser.waitForVisible('#e2eLogin');
        assert.equal(data.origin, browser.origin());
      }
    },


    createSomething: {
      createForum: function(forumTitle) {
        // Button gone, I'll add it back if there'll be Blog & Wiki too.
        // browser.waitAndClick('#e2eCreateForum');
        browser.pause(200); // [e2erace] otherwise it won't find the next input, in the
                            // create-site-all-logins @facebook test
        browser.waitAndSetValue('input[type="text"]', forumTitle);
        browser.waitAndClick('#e2eDoCreateForum');
        var actualTitle = browser.waitAndGetVisibleText('h1.dw-p-ttl');
        assert.equal(actualTitle, forumTitle);
      },
    },


    topbar: {
      waitForVisible: function() {
        browser.waitForVisible('.esMyMenu');
      },

      assertMyUsernameMatches: function(username: string) {
        browser.assertTextMatches('.esMyMenu .esAvtrName_name', username);
      },

      assertNeedsReviewVisible: function() {
        assert(browser.isVisible('.esNotfIcon-reviewOther'));
      },

      getMyUsername: function() {
        return browser.getText('.esMyMenu .esAvtrName_name');
      },

      clickLogin: function() {
        browser.waitAndClick('.esTopbar_logIn');
      },

      clickSignUp: function() {
        browser.waitAndClick('.esTopbar_signUp');
      },

      clickLogout: function(options?: { waitForLoginButton?: boolean }) {
        options = options || {};
        browser.waitAndClick('.esMyMenu');
        browser.waitAndClick('#e2eMM_Logout');
        if (options.waitForLoginButton !== false) {
          // Then a login dialog will probably have opened now in full screen, with a modal
          // backdrop, so don't wait for any backdrop to disappear.
          browser.waitUntilModalGone();
          browser.waitForVisible('.esTopbar_logIn');
        }
      },

      clickGoToAdmin: function() {
        browser.rememberCurrentUrl();
        browser.waitAndClick('.esMyMenu');
        browser.waitAndClick('.esMyMenu_admin a');
        browser.waitForNewUrl();
      },

      clickGoToProfile: function() {
        browser.rememberCurrentUrl();
        browser.waitAndClick('.esMyMenu');
        browser.waitAndClick('#e2eMM_Profile');
        browser.waitForNewUrl();
        browser.waitForVisible('.user-info');
      },

      clickStopImpersonating: function() {
        let oldName = api.topbar.getMyUsername();
        let newName;
        browser.waitAndClick('.esMyMenu');
        browser.waitAndClick('#e2eMM_StopImp');
        browser.waitForVisible('.user-info');
        do {
          newName = api.topbar.getMyUsername();
        }
        while (oldName === newName);
      },

      searchFor: function(phrase: string) {
        browser.waitAndClick('.esTB_SearchBtn');
        browser.waitAndSetValue('.esTB_SearchD input[name="searchPhrase"]', phrase);
        browser.click('.e_SearchB');
      },
    },


    watchbar: {
      titleSelector: '.esWB_T_Title',

      close: function() {
        browser.waitForVisible('.esWB_CloseB');
        browser.click('.esWB_CloseB');
        browser.waitUntilGone('#esWatchbarColumn');
      },

      assertTopicVisible: function(title: string) {
        browser.waitForVisible(api.watchbar.titleSelector);
        browser.assertAnyTextMatches(api.watchbar.titleSelector, title);
      },

      assertTopicAbsent: function(title: string) {
        browser.waitForVisible(api.watchbar.titleSelector);
        browser.assertNoTextMatches(api.watchbar.titleSelector, title);
      },

      asserExactlyNumTopics: function(num: number) {
        if (num > 0) {
          browser.waitForVisible(api.watchbar.titleSelector);
        }
        browser.assertExactly(num, api.watchbar.titleSelector);
      },

      goToTopic: function(title: string) {
        browser.rememberCurrentUrl();
        browser.waitForThenClickText(api.watchbar.titleSelector, title);
        browser.waitForNewUrl();
        browser.assertPageTitleMatches(title);
      },

      clickCreateChat: function() {
        browser.waitAndClick('#e2eCreateChatB');
        browser.waitForVisible('.esEdtr_titleEtc');
      },

      clickViewPeople: function() {
        browser.waitAndClick('.esWB_T-Current .esWB_T_Link');
        browser.waitAndClick('#e2eWB_ViewPeopleB');
        browser.waitUntilModalGone();
        browser.waitForVisible('.esCtxbar_list_title');
      },

      clickLeaveChat: function() {
        browser.waitAndClick('.esWB_T-Current .esWB_T_Link');
        browser.waitAndClick('#e2eWB_LeaveB');
        browser.waitUntilModalGone();
        browser.waitForVisible('#theJoinChatB');
      },
    },


    contextbar: {
      close: function() {
        browser.waitForVisible('.esCtxbar_close');
        browser.click('.esCtxbar_close');
        browser.waitUntilGone('#esThisbarColumn');
      },

      clickAddPeople: function() {
        browser.waitAndClick('#e2eCB_AddPeopleB');
        browser.waitForVisible('#e2eAddUsD');
      },

      clickUser: function(username: string) {
        browser.waitForThenClickText('.esCtxbar_list .esAvtrName_username', username);
      },

      assertUserPresent: function(username: string) {
        browser.waitForVisible('.esCtxbar_onlineCol');
        browser.waitForVisible('.esCtxbar_list .esAvtrName_username');
        var elems = browser.elements('.esCtxbar_list .esAvtrName_username').value;
        var usernamesPresent = elems.map((elem) => {
          return browser.elementIdText(elem.ELEMENT).value;
        });
        assert(usernamesPresent.length, "No users listed at all");
        assert(_.includes(usernamesPresent, username), "User missing: " + username +
            ", those present are: " + usernamesPresent.join(', '));
      },
    },


    loginDialog: {
      refreshUntilFullScreen: function() {
        let startMs = Date.now();
        let dialogShown = false;
        let lap = 0;
        while (Date.now() - startMs < settings.waitforTimeout) {
          browser.refresh();
          // Give the page enough time to load:
          lap += 1;
          browser.pause(200 * Math.pow(1.5, lap));
          dialogShown = browser.isVisible('.dw-login-modal') &&
            browser.isVisible('#e2eLoginDialogTitle');
          if (dialogShown)
            break;
        }
        assert(dialogShown, "The login dialog never appeared");
        api.loginDialog.waitAssertFullScreen();
      },

      waitAssertFullScreen: function() {
        browser.waitForVisible('.dw-login-modal');
        browser.waitForText('#e2eLoginDialogTitle');
        // Forum not shown.
        assert(!browser.isVisible('.dw-forum'));
        assert(!browser.isVisible('.dw-forum-actionbar'));
        // No forum topic shown.
        assert(!browser.isVisible('h1'));
        assert(!browser.isVisible('.dw-p'));
        assert(!browser.isVisible('.dw-p-ttl'));
        // Admin area not shown.
        assert(!browser.isVisible('.esTopbar_custom_backToSite'));
        assert(!browser.isVisible('#dw-react-admin-app'));
        // User profile not shown.
        assert(!browser.isVisible('.user-info'));
      },

      createPasswordAccount: function(data) {
        browser.waitAndSetValue('#e2eFullName', data.fullName);
        browser.waitAndSetValue('#e2eUsername', data.username);
        browser.waitAndSetValue('#e2eEmail', data.email || data.emailAddress);
        browser.waitAndSetValue('#e2ePassword', data.password);
        browser.waitAndClick('#e2eSubmit');
        browser.waitForVisible('#e2eNeedVerifyEmailDialog');
      },

      loginWithPassword: function(username, password?: string) {
        if (_.isObject(username)) {
          password = username.password;
          username = username.username;
        }
        api.loginDialog.tryLogin(username, password);
        browser.waitUntilModalGone();
      },

      loginButBadPassword: function(username: string, password: string) {
        api.loginDialog.tryLogin(username, password);
        browser.waitForVisible('.esLoginDlg_badPwd');
      },

      tryLogin: function(username: string, password: string) {
        browser.waitAndSetValue('#e2eUsername', username);
        browser.waitAndSetValue('#e2ePassword', password);
        browser.waitAndClick('#e2eSubmit');
      },

      loginAsGuest: function(name: string, email?: string) {
        browser.waitAndClick('.esLoginDlg_guestBtn');
        browser.waitAndSetValue('#e2eLD_G_Name', name);
        if (email) {
          browser.waitAndSetValue('#e2eLD_G_Email', email);
        }
        browser.waitAndClick('#e2eLD_G_Submit');
        browser.waitUntilModalGone();
        var nameInHtml = browser.waitAndGetVisibleText('.esTopbar .esAvtrName_name');
        assert(nameInHtml === name);
      },

      clickCreateAccountInstead: function() {
        browser.waitAndClick('.esLD_Switch_L');
      },

      createGmailAccount: function(data) {
        api.loginDialog.loginWithGmail(data);
        // This should be the first time we login with Gmail at this site, so we'll be asked
        // to choose a username.
        browser.waitAndSetValue('#e2eUsername', data.username);
        browser.waitAndClick('#e2eSubmit');
        browser.waitUntilModalGone();
      },

      loginWithGmail: function(data) {
        // Pause or sometimes the click misses the button. Is the browser doing some re-layout?
        browser.pause(100);
        browser.waitAndClick('#e2eLoginGoogle');

        // In Google's login popup window:
        browser.swithToOtherTabOrWindow();
        browser.waitAndSetValue('#Email', data.email);
        if (browser.isExisting('#next')) {
          browser.click('#next');
        }
        browser.waitAndSetValue('#Passwd', data.password);
        browser.click('#signIn');
        browser.waitForEnabled('#submit_approve_access');
        browser.click('#submit_approve_access');

        browser.switchBackToFirstTabOrWindow();
      },

      createFacebookAccount: function(data) {
        api.loginDialog.loginWithFacebook(data);
        // This should be the first time we login with Facebook at this site, so we'll be asked
        // to choose a username.
        browser.waitAndSetValue('#e2eUsername', data.username);
        browser.waitAndClick('#e2eSubmit');
        browser.waitUntilModalGone();
      },

      loginWithFacebook: function(data) {
        // Pause or sometimes the click misses the button. Is the browser doing some re-layout?
        browser.pause(100);
        browser.waitAndClick('#e2eLoginFacebook');

        // In Facebook's login popup window:
        browser.swithToOtherTabOrWindow();
        browser.waitAndSetValue('#email', data.email);
        browser.waitAndSetValue('#pass', data.password);

        // Facebook recently changed from <input> to <button>. So just find anything with type=submit.
        browser.waitAndClick('[type=submit]');

        // Facebook somehow auto accepts the confirmation dialog, perhaps because
        // I'm using a Facebook API test user. So need not do this:
        //b.waitForVisible('[name=__CONFIRM__]');
        //b.click('[name=__CONFIRM__]');

        browser.switchBackToFirstTabOrWindow();
      },

      clickResetPasswordCloseDialogSwitchTab: function() {
        browser.click('.dw-reset-pswd');
        // The login dialog should close when we click the reset-password link. [5KWE02X]
        browser.waitUntilModalGone();
        browser.swithToOtherTabOrWindow();
        browser.waitForVisible('#e2eRPP_emailI');
      },

      clickCancel: function() {
        browser.click('#e2eLD_Cancel');
        browser.waitUntilModalGone();
      },

      reopenToClearAnyError: function() {
        api.loginDialog.clickCancel();
        api.topbar.clickLogin();
      },
    },


    resetPasswordPage: {
      fillInAccountOwnerEmailAddress: function(emailAddress: string) {
        browser.waitAndSetValue('#e2eRPP_emailI', emailAddress);
      },

      clickSubmit: function() {
        browser.waitAndClick('#e2eRPP_SubmitB');
      },
    },

    pageTitle: {
      clickEdit: function() {
        browser.waitAndClick('#e2eEditTitle');
      },

      editTitle: function(title: string) {
        browser.waitAndSetValue('#e2eTitleInput', title);
      },

      save: function() {
        browser.click('.e2eSaveBtn');
        browser.waitForVisible('.dw-p-ttl h1');
      }
    },


    forumButtons: {
      clickEditIntroText: function() {
        browser.waitAndClick('.esForumIntro_edit');
        browser.waitAndClick('#e2eEID_EditIntroB');
        browser.waitUntilModalGone();
      },

      clickRemoveIntroText: function() {
        browser.waitAndClick('.esForumIntro_edit');
        browser.waitAndClick('#e2eEID_RemoveIntroB');
        browser.waitUntilModalGone();
      },

      clickViewCategories: function() {
        browser.waitAndClick('#e2eViewCategoriesB');
      },

      clickViewTopics: function() {
        browser.waitAndClick('#e2eViewTopicsB');
      },

      clickCreateCategory: function() {
        browser.waitAndClick('#e2eCreateCategoryB');
      },

      clickEditCategory: function() {
        browser.waitAndClick('.esF_BB_EditCat');
      },

      clickCreateTopic: function() {
        browser.waitAndClick('#e2eCreateSth');
      },

      assertNoCreateTopicButton: function() {
        // Wait until the button bar has loaded.
        browser.waitForVisible('#e2eViewCategoriesB');
        assert(!browser.isVisible('#e2eCreateSth'));
      },
    },


    forumTopicList: {
      titleSelector: '.e2eTopicTitle a',  // <– remove, later: '.esF_TsL_T_Title',  CLEAN_UP

      waitUntilKnowsIsEmpty: function() {
        browser.waitForVisible('#e2eF_NoTopics');
      },

      goToTopic: function(title: string) {
        browser.rememberCurrentUrl();
        browser.waitForThenClickText(api.forumTopicList.titleSelector, title);
        browser.waitForNewUrl();
        browser.assertPageTitleMatches(title);
      },
    },


    forumCategoryList: {
      categoryNameSelector: '.esForum_cats_cat .forum-title',

      openCategory: function(categoryName: string) {
        browser.rememberCurrentUrl();
        browser.waitForThenClickText(api.forumCategoryList.categoryNameSelector, categoryName);
        browser.waitForNewUrl();
        browser.waitForVisible('.esForum_catsDrop');
        browser.assertTextMatches('.esForum_catsDrop', categoryName);
      },
    },


    categoryDialog: {
      fillInFields: function(data) {
        browser.waitAndSetValue('#e2eCatNameI', data.name);
        if (data.setAsDefault) {
          browser.waitAndClick('#e2eSetDefCat');
        }
        /*
         browser.waitAndSetValue('#e2eUsername', data.username);
         browser.waitAndSetValue('#e2eEmail', data.email);
         browser.waitAndSetValue('#e2ePassword', data.password);
         browser.waitAndClick('#e2eSubmit');
         browser.waitForVisible('#e2eNeedVerifyEmailDialog');
         */
      },

      submit: function() {
        browser.waitAndClick('#e2eSaveCatB');
        browser.waitUntilModalGone();
        browser.waitUntilLoadingOverlayGone();
      },
    },


    aboutUserDialog: {
      clickSendMessage: function() {
        browser.rememberCurrentUrl();
        browser.waitAndClick('#e2eUD_MessageB');
        browser.waitForNewUrl();
      },

      clickViewProfile: function() {
        browser.rememberCurrentUrl();
        browser.waitAndClick('#e2eUD_ProfileB');
        browser.waitForNewUrl();
      },

      clickRemoveFromPage: function() {
        browser.waitAndClick('#e2eUD_RemoveB');
        // Later: browser.waitUntilModalGone();
        // But for now:  [5FKE0WY2]
        browser.waitForVisible('.esStupidDlg');
        browser.refresh();
      },
    },


    addUsersToPageDialog: {
      addOneUser: function(username: string) {
        browser.waitAndClick('#e2eAddUsD .Select-placeholder');
        browser.waitAndSetValue('#e2eAddUsD .Select-input > input', username);
        browser.keys(['Return']);
        // Weird. The react-select dropdown is open and needs to be closed, otherwise
        // a modal overlay hides everything? Can be closed like so:
        browser.click('#e2eAddUsD_SubmitB');
      },

      submit: function() {
        browser.click('#e2eAddUsD_SubmitB');
        // Later: browser.waitUntilModalGone();
        // But for now:  [5FKE0WY2]
        browser.waitForVisible('.esStupidDlg');
        browser.refresh();
      }
    },


    editor: {
      editTitle: function(title) {
        browser.waitAndSetValue('.esEdtr_titleEtc_title', title);
      },

      editText: function(text) {
        browser.waitAndSetValue('.esEdtr_textarea', text);
      },

      setTopicType: function(type: PageRole) {
        let optionId = null;
        var needsClickMore = false;
        switch (type) {
          case c.TestPageRole.Form: optionId = '#e2eTTD_FormO'; needsClickMore = true; break;
          case c.TestPageRole.WebPage: optionId = '#e2eTTD_WebPageO'; needsClickMore = true; break;
          case c.TestPageRole.PrivateChat: optionId = '#e2eTTD_PrivChatO'; break;
          default: die('Test unimpl [EsE4WK0UP]');
        }
        browser.waitAndClick('.esTopicType_dropdown');
        if (needsClickMore) {
          browser.waitAndClick('.esPageRole_showMore');
        }
        browser.waitAndClick(optionId);
        browser.waitUntilModalGone();
      },

      save: function() {
        browser.click('.e2eSaveBtn');
        browser.waitUntilLoadingOverlayGone();
      },

      saveWaitForNewPage: function() {
        browser.rememberCurrentUrl();
        api.editor.save();
        browser.waitForNewUrl();
      }
    },


    topic: {
      clickEditOrigPost: function() {
        browser.waitAndClick('.dw-ar-t > .dw-p-as .dw-a-edit');
      },

      clickHomeNavLink: function() {
        browser.click("a=Home");
      },

      waitForPostNrVisible: function(postNr) {
        browser.waitForVisible('#post-' + postNr);
      },

      postNrContains: function(postNr: PostNr, selector: string) {
        return browser.isVisible(`#post-${postNr} .dw-p-bd ${selector}`);
      },

      assertPostTextMatches: function(postNr: PostNr, text: string) {
        browser.assertTextMatches(`#post-${postNr} .dw-p-bd`, text)
      }
    },


    customForm: {
      submit: function() {
        browser.click('form input[type="submit"]');
        browser.waitAndAssertVisibleTextMatches('.esFormThanks', "Thank you");
      },

      assertNumSubmissionVisible: function(num: number) {
        browser.waitForMyDataAdded();
        browser.assertExactly(num, '.dw-p-flat');
      },
    },


    replies: {
      topLevelReplySelector: '.dw-depth-1 > .dw-p',
      replySelector: '.dw-depth-1 .dw-p',
      allRepliesTextSelector: '.dw-depth-0 > .dw-single-and-multireplies > .dw-res',

      assertNumRepliesVisible: function(num: number) {
        browser.waitForMyDataAdded();
        browser.assertExactly(num, api.replies.replySelector);
      },

      assertNumOrigPostRepliesVisible: function(num: number) {
        browser.waitForMyDataAdded();
        browser.assertExactly(num, api.replies.topLevelReplySelector);
      },

      assertNoReplyMatches: function(text) {
        browser.waitForMyDataAdded();
        browser.assertNoTextMatches(api.replies.allRepliesTextSelector, text);
      },

      assertSomeReplyMatches: function(text) {
        browser.waitForMyDataAdded();
        browser.assertTextMatches(api.replies.allRepliesTextSelector, text);
      },

      assertNoAuthorMissing: function() {
        // There's this error code if a post author isn't included on the page.
        browser.replies.assertNoReplyMatches("EsE4FK07_");
      },

      clickReplyToOrigPost: function() {
        api.replies.clickPostActionButton('.dw-ar-p + .esPA .dw-a-reply');
      },

      clickReplyToPostNr: function(postNr: PostNr) {
        api.replies.clickPostActionButton(`#post-${postNr} + .esPA .dw-a-reply`);
      },

      clickPostActionButton: function(buttonSelector: string) {
        // If the button is close to the bottom of the window, the fixed bottom bar might
        // be above it; then, if it's below the [Scroll][Back] buttons, it won't be clickable.
        // Or the button might be below the lower window edge.
        // If so, scroll down to the reply button.
        //
        // Why try twice? The scroll buttons aren't shown until a few 100 ms after page load.
        // So, `browser.isVisible(api.scrollButtons.fixedBarSelector)` might evaluate to false,
        // and then we won't scroll down — but then just before `browser.waitAndClick`
        // they appear, so the click fails. That's why we try once more.
        //
        for (let attemptNr = 1; attemptNr <= 2; ++attemptNr) {
          while (true) {
            let replyButtonLocation = browser.getLocationInView(buttonSelector);
            let canScroll = browser.isVisible(api.scrollButtons.fixedBarSelector);
            if (!canScroll)
              break;
            let fixedBarLocation = browser.getLocationInView(api.scrollButtons.fixedBarSelector);
            if (replyButtonLocation.y + 70 < fixedBarLocation.y)
              break;
            browser.execute(function(selector) {
              window['debiki2'].utils.scrollIntoViewInPageColumn(
                  selector, {marginBottom: 70 + 20, duration: 220});
            }, buttonSelector);
            browser.pause(220 + 10);
          }
          try {
            browser.waitAndClick(buttonSelector);
            break;
          }
          catch (exception) {
            // Click failed because the scroll buttons appeared after `canScroll = ...isVisible...`
            // but before `...waitAndClick...`? But that can happen only once.
            if (attemptNr === 2)
              throw exception;
          }
        }
      },

      assertFirstReplyTextMatches: function(text) {
        api.topic.assertPostTextMatches(c.FirstReplyNr, text);
      },
    },


    chat: {
      addChatMessage: function(text: string) {
        browser.waitAndSetValue('.esC_Edtr_textarea', text);
        browser.waitAndClick('.esC_Edtr_SaveB');
        browser.waitUntilLoadingOverlayGone();
        // could verify visible
      },

      waitForNumMessages: function(howMany: number) {
        browser.waitForAtLeast(howMany, '.esC_M');
      }
    },


    scrollButtons: {
      fixedBarSelector: '.esScrollBtns_fixedBar',
    },


    searchResultsPage: {
      assertPhraseNotFound: function(phrase: string) {
        api.searchResultsPage.waitForResults(phrase);
        assert(browser.isVisible('#e_SP_NothingFound'));
      },

      waitForAssertNumPagesFound: function(phrase: string, numPages: number) {
        api.searchResultsPage.waitForResults(phrase);
        // oops, search-search-loop needed ...
        // for now:
        browser.waitForAtLeast(numPages, '.esSERP_Hit_PageTitle');
        browser.assertExactly(numPages, '.esSERP_Hit_PageTitle');
      },

      searchForWaitForResults: function(phrase: string) {
        browser.setValue('.s_SP_QueryTI', phrase);
        api.searchResultsPage.clickSearchButton();
        // Later, with Nginx 1.11.0+, wait until a $request_id in the page has changed [5FK02FP]
        api.searchResultsPage.waitForResults(phrase);
      },

      searchForUntilNumPagesFound: function(phrase: string, numResultsToFind: number) {
        while (true) {
          api.searchResultsPage.searchForWaitForResults(phrase);
          var numFound = api.searchResultsPage.countNumPagesFound_1();
          if (numFound >= numResultsToFind) {
            assert(numFound === numResultsToFind);
            break;
          }
          browser.pause(333);
        }
      },

      clickSearchButton: function() {
        browser.click('.s_SP_SearchB');
      },

      waitForResults: function(phrase: string) {
        // Later, check Nginx $request_id to find out if the page has been refreshed
        // unique request identifier generated from 16 random bytes, in hexadecimal (1.11.0).
        browser.waitUntilTextMatches('#e2eSERP_SearchedFor', phrase);
      },

      countNumPagesFound_1: function(): number {
        return browser.elements('.esSERP_Hit_PageTitle').value.length;
      },
    },


    userProfilePage: {
      assertIsMyProfile: function() {
        browser.waitForVisible('.esUP_Un');
        assert(browser.isVisible('.esProfile_isYou'));
      },

      assertUsernameIs: function(username: string) {
        browser.assertTextMatches('.esUP_Un', username);
      },

      assertFullNameIs: function(name: string) {
        browser.assertTextMatches('.esUP_FN', name);
      },

      assertFullNameIsNot: function(name: string) {
        browser.assertNoTextMatches('.esUP_FN', name);
      },
    },


    adminArea: {
      waitAssertVisible: function() {
        browser.waitForVisible('h1');
        browser.assertTextMatches('h1', "Admin Area");
      },

      clickLeaveAdminArea: function() {
        browser.rememberCurrentUrl();
        browser.waitAndClick('.esTopbar_custom_backToSite');
        browser.waitForNewUrl();
      },

      goToLoginSettings: function(siteIdOrigin) {
        browser.go(siteIdOrigin + '/-/admin/settings/login');
      },

      goToUsers: function(siteIdOrigin) {
        browser.go(siteIdOrigin + '/-/admin/users');
      },

      settings: {
        clickSaveAll: function() {
          browser.waitAndClick('.esA_SaveBar_SaveAllB');
        },

        clickLegalNavLink: function() {
          browser.waitAndClick('#e2eAA_Ss_LegalL');
          browser.waitForVisible('#e2eAA_Ss_OrgNameTI');
        },

        clickLoginNavLink: function() {
          browser.waitAndClick('#e2eAA_Ss_LoginL');
          browser.waitForVisible('#e2eLoginRequiredCB');
        },

        clickModerationNavLink: function() {
          browser.waitAndClick('#e2eAA_Ss_ModL');
        },

        clickAnalyticsNavLink: function() {
          browser.waitAndClick('#e2eAA_Ss_AnalyticsL');
        },

        clickAdvancedNavLink: function() {
          browser.waitAndClick('#e2eAA_Ss_AdvancedL');
        },

        clickExperimentalNavLink: function() {
          browser.waitAndClick('#e2eAA_Ss_ExpL');
        },

        legal: {
          editOrgName: function(newName: string) {
            browser.waitAndSetValue('#e2eAA_Ss_OrgNameTI', newName);
          },

          editOrgNameShort: function(newName: string) {
            browser.waitAndSetValue('#e2eAA_Ss_OrgNameShortTI', newName);
          },
        },

        login: {
          clickLoginRequired: function() {
            browser.waitAndClick('#e2eLoginRequiredCB');
          },

          clickAllowGuestLogin: function() {
            browser.waitAndClick('#e2eAllowGuestsCB');
          },
        },
      }
    },

    complex: {
      loginWithPasswordViaTopbar: function(username, password?: string) {
        api.topbar.clickLogin();
        var credentials = _.isObject(username) ?  // already { username, password } object
            username : { username: username, password: password };
        api.loginDialog.loginWithPassword(credentials);
      },

      loginAsGuestViaTopbar: function(name: string, email?: string) {
        api.topbar.clickLogin();
        api.loginDialog.loginAsGuest(name, email);
      },

      closeSidebars: function() {
        if (browser.isVisible('#esWatchbarColumn')) {
          api.watchbar.close();
        }
        if (browser.isVisible('#esThisbarColumn')) {
          api.contextbar.close();
        }
      },

      createAndSaveTopic: function(data: { title: string, body: string, type?: PageRole,
            bodyMatchAfter?: String | boolean }) {
        api.forumButtons.clickCreateTopic();
        api.editor.editTitle(data.title);
        api.editor.editText(data.body);
        if (data.type) {
          api.editor.setTopicType(data.type);
        }
        browser.rememberCurrentUrl();
        api.editor.save();
        browser.waitForNewUrl();
        browser.assertPageTitleMatches(data.title);
        if (data.bodyMatchAfter !== false) {
          browser.assertPageBodyMatches(data.bodyMatchAfter || data.body);
        }
      },

      editPageBody: function(newText: string) {
        api.topic.clickEditOrigPost();
        api.editor.editText(newText);
        api.editor.save();
        browser.assertPageBodyMatches(newText);
      },

      replyToOrigPost: function(text: string) {
        api.replies.clickReplyToOrigPost();
        api.editor.editText(text);
        api.editor.save();
      },

      replyToPostNr: function(postNr: PostNr, text: string) {
        api.replies.clickReplyToPostNr(postNr);
        api.editor.editText(text);
        api.editor.save();
      },

      createChatChannelViaWatchbar: function(
            data: { name: string, purpose: string, public_?: boolean }) {
        api.watchbar.clickCreateChat();
        api.editor.editTitle(data.name);
        api.editor.editText(data.purpose);
        if (data.public_ === false) {
          api.editor.setTopicType(c.TestPageRole.PrivateChat);
        }
        browser.rememberCurrentUrl();
        api.editor.save();
        browser.waitForNewUrl();
        browser.assertPageTitleMatches(data.name);
      },

      addPeopleToPageViaContextbar(usernames: string[]) {
        api.contextbar.clickAddPeople();
        _.each(usernames, api.addUsersToPageDialog.addOneUser);
        api.addUsersToPageDialog.submit();
        _.each(usernames, api.contextbar.assertUserPresent);
      }
    }
  };

  return api;
}


export = pagesFor;


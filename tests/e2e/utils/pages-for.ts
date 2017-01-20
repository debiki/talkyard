/// <reference path="../../../modules/definitely-typed/lodash/lodash.d.ts"/>
/// <reference path="../../../modules/definitely-typed/node/node.d.ts"/>

import _ = require('lodash');
import assert = require('assert');
import logAndDie = require('./log-and-die');
import settings = require('./settings');
import c = require('../test-constants');
var logUnusual = logAndDie.logUnusual, die = logAndDie.die, dieIf = logAndDie.dieIf;
var logError = logAndDie.logError;
var logMessage = logAndDie.logMessage;


function count(elems): number {
  return elems && elems.value ? elems.value.length : 0;
}


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


    // Workaround for bug(s) in Chrome? Chromedriver? Selenium? Webdriver?
    // 1) browser.refresh() causes a weird cannot-find-elem problem. Perhaps because of  [E2EBUG]
    //    some incompatibility between webdriver.io and Chrome? Recently there was a stale-
    //    element bug after refresh(), fixed in Webdriver.io 4.3.0. Instead:
    // 2) Sometimes waitForVisible stops working = blocks forever, although isVisible returns true
    //    (because the elem is visible already).
    toGoogleAndBack: function() {
      let url = browser.url().value;
      browser.go('http://www.google.com');
      browser.go(url);
    },


    waitForMyDataAdded: function() {
      browser.waitForVisible('.e2eMyDataAdded');
    },


    // Can be used to wait until a fade-&-scroll-in dialog is done scrolling in, for example.
    //
    waitUntilDoesNotMove: function(buttonSelector: string, pollInterval?: number) {
      for (let attemptNr = 1; attemptNr <= 30; ++attemptNr) {
        let location = browser.getLocationInView(buttonSelector);
        browser.pause(pollInterval || 50);
        let locationLater = browser.getLocationInView(buttonSelector);
        if (location.y === locationLater.y && location.x === locationLater.x)
          return;
      }
      die(`Never stops moving: '${buttonSelector}' [EdE7KFYU0]`);
    },


    // Placed here, because if placed in commands.ts, exception(s) cannot be caught, [7KSU024]
    // — seems like some weird Chrome - ChromeDriver - Selenium - Fibers - Webdriver.io thing,
    // probably Chrome? because everything was working until I upgraded Chrome & ChromeDriver.
    // Anyway, when placed here, exceptions work as they should.
    //
    waitAndClick: function(selector) {
      api._waitAndClickImpl(selector, true);
    },


    waitAndClickFirst: function(selector) {
      api._waitAndClickImpl(selector, false);
    },


    _waitAndClickImpl: function(selector, mustBeExactlyOne) {
      browser.waitForVisible(selector);
      browser.waitForEnabled(selector);
      browser.waitUntilLoadingOverlayGone();
      if (!selector.startsWith('#') && mustBeExactlyOne) {
        var errors = '';
        var length = 1;
        var byBrowserResults = byBrowser(browser.elements(selector));
        _.forOwn(byBrowserResults, (result, browserName) => {
          var elems = result.value;
          if (elems.length !== 1) {
            length = elems.length;
            errors += browserNamePrefix(browserName) + "Bad num elems to click: " + count(elems) +
              ", should be 1. Elems matches selector: " + selector + " [EsE5JKP82]\n";
          }
        });
        assert.equal(length, 1, errors);
      }
      browser.click(selector);
    },


    assertPageHtmlSourceDoesNotMatch: function(toMatch) {
      let resultsByBrowser = byBrowser(browser.getSource());
      let regex = _.isString(toMatch) ? new RegExp(toMatch) : toMatch;
      _.forOwn(resultsByBrowser, (text, browserName) => {
        assert(!regex.test(text), browserNamePrefix(browserName) + "Page source does match " + regex);
      });
    },

    assertUrlIs: function(expectedUrl) {
      let url = browser.url().value;
      assert(url === expectedUrl);
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
        // api.waitAndClick('#e2eCreateForum');
        browser.pause(200); // [e2erace] otherwise it won't find the next input, in the
                            // create-site-all-logins @facebook test
        browser.waitAndSetValue('input[type="text"]', forumTitle);
        api.waitAndClick('#e2eDoCreateForum');
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
        api.waitAndClick('.esTopbar_logIn');
      },

      clickSignUp: function() {
        api.waitAndClick('.esTopbar_signUp');
      },

      clickLogout: function(options?: { waitForLoginButton?: boolean }) {
        options = options || {};
        api.topbar.openMyMenu();
        api.waitAndClick('#e2eMM_Logout');
        if (options.waitForLoginButton !== false) {
          // Then a login dialog will probably have opened now in full screen, with a modal
          // backdrop, so don't wait for any backdrop to disappear.
          browser.waitUntilModalGone();
          browser.waitForVisible('.esTopbar_logIn');
        }
      },

      openMyMenu: function() {
        api.waitAndClick('.esMyMenu');
        // Because of a bug in Chrome? Chromedriver? Selenium? Webdriver.io? wait-and-click
        // attempts to click instantly, before the show-menu anim has completed and the elem
        // has appeared. So pause for a short while. [E2EBUG]
        browser.pause(333);
      },

      clickGoToAdmin: function() {
        browser.rememberCurrentUrl();
        api.topbar.openMyMenu();
        api.waitAndClick('.esMyMenu_admin a');
        browser.waitForNewUrl();
      },

      clickGoToProfile: function() {
        browser.rememberCurrentUrl();
        api.topbar.openMyMenu();
        api.waitAndClick('#e2eMM_Profile');
        browser.waitForNewUrl();
        browser.waitForVisible(api.userProfilePage.avatarAboutButtonsSelector);
      },

      clickStopImpersonating: function() {
        let oldName = api.topbar.getMyUsername();
        let newName;
        api.topbar.openMyMenu();
        api.waitAndClick('.s_MM_StopImpB');
        browser.waitForVisible(api.userProfilePage.avatarAboutButtonsSelector);
        do {
          newName = api.topbar.getMyUsername();
        }
        while (oldName === newName);
      },

      searchFor: function(phrase: string) {
        api.waitAndClick('.esTB_SearchBtn');
        browser.waitAndSetValue('.esTB_SearchD input[name="q"]', phrase);
        browser.click('.e_SearchB');
      },

      assertNotfToMe: function() {
        assert(browser.isVisible('.esTopbar .esNotfIcon-toMe'));
      },

      openNotfToMe: function(options?: { waitForNewUrl?: boolean }) {
        api.topbar.openMyMenu();
        browser.rememberCurrentUrl();
        api.waitAndClickFirst('.esMyMenu .dropdown-menu .esNotf-toMe');
        if (options && options.waitForNewUrl !== false) {
          browser.waitForNewUrl();
        }
      },

      viewAsStranger: function() {
        api.topbar.openMyMenu();
        api.waitAndClick('.s_MM_ViewAsB');
        // Currently there's just one view-as button, namely to view-as-stranger.
        api.waitAndClick('.s_VAD_Sbd button');
        // Now there's a warning, close it.
        api.stupidDialog.clickClose();
        // Then another stupid-dialog appears. Wait for a while so we won't click the
        // button in the first dialog, before it has disappeared.
        browser.pause(800);  // COULD give incrementing ids to the stupid dialogs,
                              // so can avoid this pause?
        api.stupidDialog.close();
      },

      stopViewingAsStranger: function() {
        api.topbar.openMyMenu();
        api.waitAndClick('.s_MM_StopImpB a');
      },

      myMenu: {
        goToAdminReview: function() {
          browser.rememberCurrentUrl();
          api.topbar.openMyMenu();
          api.waitAndClick('#e2eMM_Review');
          browser.waitForNewUrl();
          browser.waitForVisible('.e_A_Rvw');
        },
      }
    },


    watchbar: {
      titleSelector: '.esWB_T_Title',

      open: function() {
        api.waitAndClick('.esOpenWatchbarBtn');
        browser.waitForVisible('#esWatchbarColumn');
      },

      openIfNeeded: function() {
        if (!browser.isVisible('#esWatchbarColumn')) {
          api.watchbar.open();
        }
      },

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
        api.waitAndClick('#e2eCreateChatB');
      },

      clickCreateChatWaitForEditor: function() {
        api.waitAndClick('#e2eCreateChatB');
        browser.waitForVisible('.esEdtr_titleEtc');
      },

      clickViewPeople: function() {
        api.waitAndClick('.esWB_T-Current .esWB_T_Link');
        api.waitAndClick('#e2eWB_ViewPeopleB');
        browser.waitUntilModalGone();
        browser.waitForVisible('.esCtxbar_list_title');
      },

      clickLeaveChat: function() {
        api.waitAndClick('.esWB_T-Current .esWB_T_Link');
        api.waitAndClick('#e2eWB_LeaveB');
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
        api.waitAndClick('#e2eCB_AddPeopleB');
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
        assert(!browser.isVisible(api.userProfilePage.avatarAboutButtonsSelector));
      },

      createPasswordAccount: function(data) {
        console.log('createPasswordAccount: fillInFullName...');
        api.loginDialog.fillInFullName(data.fullName);
        console.log('fillInUsername...');
        api.loginDialog.fillInUsername(data.username);
        console.log('fillInEmail...');
        api.loginDialog.fillInEmail(data.email || data.emailAddress);
        console.log('fillInPassword...');
        api.loginDialog.fillInPassword(data.password);
        console.log('clickSubmit...');
        api.loginDialog.clickSubmit();
        console.log('waitForNeedVerifyEmailDialog...');
        api.loginDialog.waitForNeedVerifyEmailDialog();
        console.log('createPasswordAccount: done');
      },

      fillInFullName: function(fullName) {
        browser.waitAndSetValue('#e2eFullName', fullName);
      },

      fillInUsername: function(username) {
        browser.waitAndSetValue('#e2eUsername', username);
      },

      fillInEmail: function(emailAddress) {
        browser.waitAndSetValue('#e2eEmail', emailAddress);
      },

      waitForNeedVerifyEmailDialog: function() {
        browser.waitForVisible('#e2eNeedVerifyEmailDialog');
      },

      fillInPassword: function(password) {
        browser.waitAndSetValue('#e2ePassword', password);
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
        api.loginDialog.fillInUsername(username);
        api.loginDialog.fillInPassword(password);
        api.loginDialog.clickSubmit();
      },

      loginAsGuest: function(name: string, email?: string) {
        api.loginDialog.clickLoginAsGuest();
        api.loginDialog.fillInGuestName(name);
        if (email) {
          api.loginDialog.fillInGuestEmail(email);
        }
        api.loginDialog.submitGuestLogin();
        browser.waitUntilModalGone();
        var nameInHtml = browser.waitAndGetVisibleText('.esTopbar .esAvtrName_name');
        assert(nameInHtml === name);
      },

      clickLoginAsGuest: function() {
        api.waitAndClick('.esLoginDlg_guestBtn');
      },

      fillInGuestName: function(name: string) {
        browser.waitAndSetValue('#e2eLD_G_Name', name);
      },

      fillInGuestEmail: function(email: string) {
        browser.waitAndSetValue('#e2eLD_G_Email', email);
      },

      submitGuestLogin: function() {
        api.waitAndClick('#e2eLD_G_Submit');
      },

      clickCancelGuestLogin: function() {
        api.waitAndClick('.e_LD_G_Cancel');
        browser.waitUntilGone('.e_LD_G_Cancel');
      },

      clickCreateAccountInstead: function() {
        api.waitAndClick('.esLD_Switch_L');
        browser.waitForVisible('.esCreateUser');
        browser.waitForVisible('#e2eUsername');
        browser.waitForVisible('#e2ePassword');
      },

      createGmailAccount: function(data) {
        api.loginDialog.loginWithGmail(data);
        // This should be the first time we login with Gmail at this site, so we'll be asked
        // to choose a username.
        browser.waitAndSetValue('#e2eUsername', data.username);
        api.loginDialog.clickSubmit();
        browser.waitUntilModalGone();
      },

      loginWithGmail: function(data) {
        // Pause or sometimes the click misses the button. Is the browser doing some re-layout?
        browser.pause(100);
        api.waitAndClick('#e2eLoginGoogle');

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
        api.loginDialog.clickSubmit();
        browser.waitUntilModalGone();
      },

      loginWithFacebook: function(data) {
        // Pause or sometimes the click misses the button. Is the browser doing some re-layout?
        browser.pause(100);
        api.waitAndClick('#e2eLoginFacebook');

        // In Facebook's login popup window:
        browser.swithToOtherTabOrWindow();
        browser.waitAndSetValue('#email', data.email);
        browser.waitAndSetValue('#pass', data.password);

        // Facebook recently changed from <input> to <button>. So just find anything with type=submit.
        api.waitAndClick('[type=submit]');

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

      clickSubmit: function() {
        api.waitAndClick('#e2eSubmit');
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
        api.waitAndClick('#e2eRPP_SubmitB');
      },
    },


    pageTitle: {
      clickEdit: function() {
        api.waitAndClick('#e2eEditTitle');
      },

      editTitle: function(title: string) {
        browser.waitAndSetValue('#e2eTitleInput', title);
      },

      save: function() {
        browser.click('.e2eSaveBtn');
        api.pageTitle.waitForVisible();
      },

      waitForVisible: function() {
        browser.waitForVisible('.dw-p-ttl h1');
      },

      openAboutAuthorDialog: function() {
        browser.waitAndClick('.dw-ar-p-hd .esP_By');
        browser.waitForVisible('.esUsrDlg');
      },

      assertMatches: function(regex) {
        browser.assertPageTitleMatches(regex);
      },

      assertPageHidden: function() {
        api.pageTitle.waitForVisible();
        assert(browser.isVisible('.dw-p-ttl .icon-eye-off'));
      },

      assertPageNotHidden: function() {
        api.pageTitle.waitForVisible();
        assert(!browser.isVisible('.dw-p-ttl .icon-eye-off'));
      },
    },


    forumButtons: {
      clickEditIntroText: function() {
        api.waitAndClick('.esForumIntro_edit');
        api.waitAndClick('#e2eEID_EditIntroB');
        browser.waitUntilModalGone();
      },

      clickRemoveIntroText: function() {
        api.waitAndClick('.esForumIntro_edit');
        api.waitAndClick('#e2eEID_RemoveIntroB');
        browser.waitUntilModalGone();
      },

      clickViewCategories: function() {
        api.waitAndClick('#e2eViewCategoriesB');
      },

      clickViewTopics: function() {
        api.waitAndClick('#e2eViewTopicsB');
      },

      clickCreateCategory: function() {
        api.waitAndClick('#e2eCreateCategoryB');
      },

      clickEditCategory: function() {
        api.waitAndClick('.esF_BB_EditCat');
      },

      clickCreateTopic: function() {
        api.waitAndClick('#e2eCreateSth');
      },

      assertNoCreateTopicButton: function() {
        // Wait until the button bar has loaded.
        browser.waitForVisible('#e2eViewCategoriesB');
        assert(!browser.isVisible('#e2eCreateSth'));
      },
    },


    forumTopicList: {
      titleSelector: '.e2eTopicTitle a',  // <– remove, later: '.esF_TsL_T_Title',  CLEAN_UP
      hiddenTopicTitleSelector: '.e2eTopicTitle a.icon-eye-off',

      waitUntilKnowsIsEmpty: function() {
        browser.waitForVisible('#e2eF_NoTopics');
      },

      waitForTopics: function() {
        browser.waitForVisible('.e2eF_T');
      },

      clickViewLatest: function() {
        api.waitAndClick('#e2eSortLatestB');
        browser.waitUntilGone('.e_F_SI_Top');
      },

      clickViewTop: function() {
        api.waitAndClick('#e2eSortTopB');
        browser.waitForVisible('.e_F_SI_Top');
      },

      goToTopic: function(title: string) {
        browser.rememberCurrentUrl();
        browser.waitForThenClickText(api.forumTopicList.titleSelector, title);
        browser.waitForNewUrl();
        browser.assertPageTitleMatches(title);
      },

      assertNumVisible: function(howMany: number) {
        browser.assertExactly(howMany, '.e2eTopicTitle');
      },

      assertTopicVisible: function(title) {
        browser.assertAnyTextMatches(api.forumTopicList.titleSelector, title);
        browser.assertNoTextMatches(api.forumTopicList.hiddenTopicTitleSelector, title);
      },

      assertTopicNrVisible: function(nr: number, title: string) {
        browser.assertNthTextMatches(api.forumTopicList.titleSelector, nr, title);
        browser.assertNoTextMatches(api.forumTopicList.hiddenTopicTitleSelector, title);
      },

      assertTopicNotVisible: function(title) {
        browser.assertNoTextMatches(api.forumTopicList.titleSelector, title);
      },

      assertTopicVisibleAsHidden: function(title) {
        browser.assertAnyTextMatches(api.forumTopicList.hiddenTopicTitleSelector, title);
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
          api.waitAndClick('#e2eSetDefCat');
        }
        /*
         browser.waitAndSetValue('#e2eUsername', data.username);
         browser.waitAndSetValue('#e2eEmail', data.email);
         browser.waitAndSetValue('#e2ePassword', data.password);
         api.waitAndClick('#e2eSubmit');
         browser.waitForVisible('#e2eNeedVerifyEmailDialog');
         */
      },

      submit: function() {
        api.waitAndClick('#e2eSaveCatB');
        browser.waitUntilModalGone();
        browser.waitUntilLoadingOverlayGone();
      },
    },


    aboutUserDialog: {
      clickSendMessage: function() {
        browser.rememberCurrentUrl();
        api.waitAndClick('#e2eUD_MessageB');
        browser.waitForNewUrl();
      },

      clickViewProfile: function() {
        browser.rememberCurrentUrl();
        api.waitAndClick('#e2eUD_ProfileB');
        browser.waitForNewUrl();
      },

      clickRemoveFromPage: function() {
        api.waitAndClick('#e2eUD_RemoveB');
        // Later: browser.waitUntilModalGone();
        // But for now:  [5FKE0WY2]
        browser.waitForVisible('.esStupidDlg');
        browser.refresh();
      },
    },


    addUsersToPageDialog: {
      addOneUser: function(username: string) {
        api.waitAndClick('#e2eAddUsD .Select-placeholder');
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
        api.waitAndClick('.esTopicType_dropdown');
        if (needsClickMore) {
          api.waitAndClick('.esPageRole_showMore');
        }
        api.waitAndClick(optionId);
        browser.waitUntilModalGone();
      },

      cancel: function() {
        browser.click('#debiki-editor-controller .e2eCancelBtn');
        api.helpDialog.waitForThenClose();
      },

      save: function() {
        api.editor.clickSave();
        browser.waitUntilLoadingOverlayGone();
      },

      clickSave: function() {
        browser.click('#debiki-editor-controller .e2eSaveBtn');
      },

      saveWaitForNewPage: function() {
        browser.rememberCurrentUrl();
        api.editor.save();
        browser.waitForNewUrl();
      }
    },


    topic: {
      clickEditOrigPost: function() {
        api.waitAndClick('.dw-ar-t > .dw-p-as .dw-a-edit');
      },

      clickHomeNavLink: function() {
        browser.click("a=Home");
      },

      assertPagePendingApprovalBodyHidden: function() {
        browser.waitForVisible('.dw-ar-t');
        browser.assertPageTitleMatches(/pending approval/);
        assert(api.topic._isOrigPostPendingApprovalVisible());
        assert(!api.topic._isOrigPostBodyVisible());
      },

      assertPageNotPendingApproval: function() {
        browser.waitForVisible('.dw-ar-t');
        assert(!api.topic._isOrigPostPendingApprovalVisible());
        assert(api.topic._isOrigPostBodyVisible());
      },

      waitForPostNrVisible: function(postNr) {
        browser.waitForVisible('#post-' + postNr);
      },

      postNrContains: function(postNr: PostNr, selector: string) {
        return browser.isVisible(`#post-${postNr} .dw-p-bd ${selector}`);
      },

      assertPostTextMatches: function(postNr: PostNr, text: string) {
        browser.assertTextMatches(`#post-${postNr} .dw-p-bd`, text)
      },

      topLevelReplySelector: '.dw-depth-1 > .dw-p',
      replySelector: '.dw-depth-1 .dw-p',
      allRepliesTextSelector: '.dw-depth-0 > .dw-single-and-multireplies > .dw-res',

      assertNumRepliesVisible: function(num: number) {
        browser.waitForMyDataAdded();
        browser.assertExactly(num, api.topic.replySelector);
      },

      assertNumOrigPostRepliesVisible: function(num: number) {
        browser.waitForMyDataAdded();
        browser.assertExactly(num, api.topic.topLevelReplySelector);
      },

      assertNoReplyMatches: function(text) {
        browser.waitForMyDataAdded();
        browser.assertNoTextMatches(api.topic.allRepliesTextSelector, text);
      },

      assertSomeReplyMatches: function(text) {
        browser.waitForMyDataAdded();
        browser.assertTextMatches(api.topic.allRepliesTextSelector, text);
      },

      assertNoAuthorMissing: function() {
        // There's this error code if a post author isn't included on the page.
        browser.topic.assertNoReplyMatches("EsE4FK07_");
      },

      getTopicAuthorUsernameInclAt: function(): string {
        return browser.getText('.dw-ar-p-hd .esP_By_U');
      },

      clickReplyToOrigPost: function() {
        api.topic.clickPostActionButton('.dw-ar-p + .esPA .dw-a-reply');
      },

      clickReplyToPostNr: function(postNr: PostNr) {
        api.topic.clickPostActionButton(`#post-${postNr} + .esPA .dw-a-reply`);
      },

      clickMoreForPostNr: function(postNr: PostNr) {
        api.topic.clickPostActionButton(`#post-${postNr} + .esPA .dw-a-more`);
      },

      clickFlagPost: function(postNr: PostNr) {
        api.topic.clickMoreForPostNr(postNr);
        api.waitAndClick('.icon-flag');  // for now, later: e_...
      },

      refreshUntilBodyHidden: function(postNr: PostNr) {
        while (true) {
          let isHidden = api.topic.isPostBodyHidden(postNr);
          if (isHidden) break;
          browser.refresh();
          browser.pause(250);
        }
      },

      isPostBodyHidden: function(postNr) {
        return browser.isVisible(`#post-${postNr}.s_P-Hdn`);
      },

      assertPostHidden: function(postNr: PostNr) {
        assert(api.topic.isPostBodyHidden(postNr));
      },

      assertPostNotHidden: function(postNr: PostNr) {
        assert(!browser.isVisible(`#post-${postNr}.s_P-Hdn`));
        assert(browser.isVisible(`#post-${postNr}`));
        // Check -Hdn again, to prevent some races (but not all), namely that the post gets
        // loaded, and is invisible, but the first -Hdn check didn't find it because at that time
        // it hadn't yet been loaded.
        assert(!browser.isVisible(`#post-${postNr}.s_P-Hdn`));
      },

      assertPostNeedsApprovalBodyVisible: function(postNr: PostNr) {
        assert(api.topic._hasPendingModClass(postNr));
        assert(!api.topic._hasUnapprovedClass(postNr));
        assert(api.topic._isBodyVisible(postNr));
      },

      assertPostNeedsApprovalBodyHidden: function(postNr: PostNr) {
        assert(!api.topic._hasPendingModClass(postNr));
        assert(api.topic._hasUnapprovedClass(postNr));
        assert(!api.topic._isBodyVisible(postNr));
      },

      refreshUntilPostNotPendingApproval: function(postNr: PostNr) {
        for (let i = 0; i < 15; ++i) {
          if (api.topic.isPostNotPendingApproval(postNr))
            return;
          browser.pause(500);
          browser.refresh(500);
        }
        die('EdEKW05Y', `Post nr ${postNr} never gets approved`);
      },

      assertPostNotPendingApproval: function(postNr: PostNr) {
        assert(api.topic.isPostNotPendingApproval(postNr));
      },

      isPostNotPendingApproval: function(postNr: PostNr) {
        return !api.topic._hasUnapprovedClass(postNr) &&
            !api.topic._hasPendingModClass(postNr) &&
            api.topic._isBodyVisible(postNr);
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
            if (replyButtonLocation.y > 60 && // fixed topbar, about 40px tall
                replyButtonLocation.y + 70 < fixedBarLocation.y)
              break;
            browser.execute(function(selector) {
              window['debiki2'].utils.scrollIntoViewInPageColumn(
                  selector, { marginTop: 60 + 20, marginBottom: 70 + 20, duration: 200 });
            }, buttonSelector);
            browser.pause(200 + 50);
          }
          try {
            // Now suddenly, after I upgraded to a newer Chrome version?, an elem-is-not-
            // -clickable exception thrown by waitAndClick, does *not* get caught by this
            // try-catch, *if* waitAndClick is added to `browser` as a command in commands.ts.
            // So I moved it to the top of this file instead. [7KSU024]
            api.waitAndClick(buttonSelector);
            break;
          }
          catch (exception) {
            // Click failed because the scroll buttons appeared after `canScroll = ...isVisible...`
            // but before `...waitAndClick...`? But that can happen only once.
            if (attemptNr === 2) {
              logError(`Error clicking post action button, selector: ${buttonSelector} [EdE2K045]`);
              throw exception;
            }
          }
        }
      },

      assertFirstReplyTextMatches: function(text) {
        api.topic.assertPostTextMatches(c.FirstReplyNr, text);
      },

      _isOrigPostBodyVisible: function() {
        return !!browser.getText('#post-1 > .dw-p-bd');
      },

      _isOrigPostPendingApprovalVisible: function() {
        return browser.isVisible('.dw-ar-t > .esPendingApproval');
      },

      _isBodyVisible: function(postNr: PostNr) {
        return browser.isVisible(`#post-${postNr} .dw-p-bd`);
      },

      _hasPendingModClass: function(postNr: PostNr) {
        return browser.isVisible(`#post-${postNr} .dw-p-pending-mod`);
      },

      _hasUnapprovedClass: function(postNr: PostNr) {
        return browser.isVisible(`#post-${postNr}.dw-p-unapproved`);
      },
    },


    chat: {
      addChatMessage: function(text: string) {
        browser.waitAndSetValue('.esC_Edtr_textarea', text);
        api.waitAndClick('.esC_Edtr_SaveB');
        browser.waitUntilLoadingOverlayGone();
        // could verify visible
      },

      waitForNumMessages: function(howMany: number) {
        browser.waitForAtLeast(howMany, '.esC_M');
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

      goToSearchResult: function(linkText?: string) {
        browser.rememberCurrentUrl();
        if (!linkText) {
          api.waitAndClick('.esSERP_Hit_PageTitle a');
        }
        else {
          browser.waitForThenClickText('.esSERP_Hit_PageTitle a', linkText);
        }
        browser.waitForNewUrl();
      },
    },


    userProfilePage: {
      avatarAboutButtonsSelector: '.s_UP_AvtrAboutBtns',

      openActivityFor: function(who: string, origin?: string) {
        browser.go((origin || '') + `/-/users/${who}/activity/posts`);
      },

      openNotfsFor: function(who: string, origin?: string) {
        browser.go((origin || '') + `/-/users/${who}/notifications`);
      },

      goToPreferences: function() {
        api.userProfilePage.clickGoToPreferences();
      },

      // rename
      clickGoToPreferences: function() {
        browser.waitAndClick('#e2eUP_PrefsB');
        browser.waitForVisible('.e_UP_Prefs_FN');
      },

      isNotfsTabVisible: function() {
        // The activity tab is always visible, if the notfs tab can possibly be visible.
        browser.waitForVisible('.e_UP_ActivityB');
        return browser.isVisible('.e_UP_NotfsB');
      },

      isPrefsTabVisible: function() {
        // The activity tab is always visible, if the preferences tab can possibly be visible.
        browser.waitForVisible('.e_UP_ActivityB');
        return browser.isVisible('#e2eUP_PrefsB');
      },

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

      clickSendMessage: function() {
        api.waitAndClick('.s_UP_SendMsgB');
      },

      activity: {
        switchToPosts: function(opts: { shallFindPosts: boolean }) {
          browser.waitAndClick('.s_UP_Act_Nav_PostsB');
          api.toGoogleAndBack(); // [E2EBUG] otherwise waitForVisible() on the next line hangs,
                                 // although this returns true:  browser.isVisible('.s_UP_Act_Ps');
          browser.waitForVisible('.s_UP_Act_Ps');
          if (opts.shallFindPosts) {
            browser.waitForVisible('.s_UP_Act_Ps_P');
          }
          else {
            // ?? wait for what ??
          }
        },

        switchToTopics: function(opts: { shallFindTopics: boolean }) {
          browser.waitAndClick('.s_UP_Act_Nav_TopicsB');
          api.toGoogleAndBack(); // [E2EBUG] otherwise waitForVisible() on the next line hangs,
                                 // although this returns true: browser.isVisible('.s_UP_Act_Ts');
          browser.waitForVisible('.s_UP_Act_Ts');
          if (opts.shallFindTopics) {
            browser.waitForVisible('.e2eTopicTitle');
          }
          else {
            // ?? wait for what ??
          }
        },

        posts: {
          postSelector: '.s_UP_Act_Ps_P',

          assertExactly: function(num: number) {
            browser.assertExactly(num, api.userProfilePage.activity.posts.postSelector);
          },

          assertPostTextVisible: function(postText: string) {
            let selector = api.userProfilePage.activity.posts.postSelector;
            browser.waitForVisible(selector);
            browser.assertAnyTextMatches(selector, postText);
          },

          assertPostTextAbsent: function(postText: string) {
            let selector = api.userProfilePage.activity.posts.postSelector;
            browser.waitForVisible(selector);
            browser.assertNoTextMatches(selector, postText);
          },
        },

        topics: {
          topicsSelector: '.s_UP_Act_Ts .e2eTopicTitle',

          assertExactly: function(num: number) {
            browser.assertExactly(num, api.userProfilePage.activity.topics.topicsSelector);
          },

          assertTopicTitleVisible: function(title: string) {
            let selector = api.userProfilePage.activity.topics.topicsSelector;
            browser.waitForVisible(selector);
            browser.assertAnyTextMatches(selector, title);
          },

          assertTopicTitleAbsent: function(title: string) {
            let selector = api.userProfilePage.activity.topics.topicsSelector;
            browser.waitForVisible(selector);
            browser.assertNoTextMatches(selector, title);
          },
        }
      },

      notfs: {
        waitUntilKnowsIsEmpty: function() {
          browser.waitForVisible('.e_UP_Notfs_None');
        },

        waitUntilSeesNotfs: function() {
          browser.waitForVisible('.esUP .esNotfs li a');
        },

        openPageNotfWithText: function(text) {
          browser.rememberCurrentUrl();
          browser.waitForThenClickText('.esNotf_page', text);
          browser.waitForNewUrl();
        },

        assertMayNotSeeNotfs: function() {
          browser.waitForVisible('.e_UP_Notfs_Err');
          browser.assertTextMatches('.e_UP_Notfs_Err', 'EdE7WK2L_');
        }
      },

      preferences: {
        setFullName: function(fullName: string) {
          browser.waitAndSetValue('.e_UP_Prefs_FN input', fullName);
        },

        startChangingUsername: function(username: string) {
          browser.waitAndClick('.s_UP_Prefs_ChangeUNB');
          api.stupidDialog.close();
        },

        setUsername: function(username: string) {
          browser.waitAndSetValue('.s_UP_Prefs_UN input', username);
        },

        save: function() {
          api.userProfilePage.preferences.clickSave();
          browser.waitUntilModalGone();
        },

        clickSave: function() {
          browser.waitAndClick('#e2eUP_Prefs_SaveB');
        },
      }
    },


    flagDialog: {
      waitUntilFadedIn: function() {
        browser.waitUntilDoesNotMove('.e_FD_InaptRB');
      },

      clickInappropriate: function() {
        api.waitAndClick('.e_FD_InaptRB label');
      },

      submit: function() {
        api.waitAndClick('.e_FD_SubmitB');
        // Don't: browser.waitUntilModalGone(), because now the stupid-dialog pop ups
        // and says "Thanks", and needs to be closed.
      },
    },


    stupidDialog: {
      clickClose: function() {
        api.waitAndClick('.e_SD_CloseB');
      },

      close: function() {
        api.stupidDialog.clickClose();
        browser.waitUntilModalGone();
      },
    },


    adminArea: {
      waitAssertVisible: function() {
        browser.waitForVisible('h1');
        browser.assertTextMatches('h1', "Admin Area");
      },

      clickLeaveAdminArea: function() {
        browser.rememberCurrentUrl();
        api.waitAndClick('.esTopbar_custom_backToSite');
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
          api.waitAndClick('.esA_SaveBar_SaveAllB');
        },

        clickLegalNavLink: function() {
          api.waitAndClick('#e2eAA_Ss_LegalL');
          browser.waitForVisible('#e2eAA_Ss_OrgNameTI');
        },

        clickLoginNavLink: function() {
          api.waitAndClick('#e2eAA_Ss_LoginL');
          browser.waitForVisible('#e2eLoginRequiredCB');
        },

        clickModerationNavLink: function() {
          api.waitAndClick('#e2eAA_Ss_ModL');
        },

        clickAnalyticsNavLink: function() {
          api.waitAndClick('#e2eAA_Ss_AnalyticsL');
        },

        clickAdvancedNavLink: function() {
          api.waitAndClick('#e2eAA_Ss_AdvancedL');
        },

        clickExperimentalNavLink: function() {
          api.waitAndClick('#e2eAA_Ss_ExpL');
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
          setLoginRequired: function(isRequired: boolean) {
            // Sometimes, clicking this checkbox has no effect. Perhaps a sidebar appeared, which
            // caused the checkbox to move? so the click missed? Therefore, try many times.
            browser.waitForVisible('#e2eLoginRequiredCB');
            console.log('#e2eLoginRequiredCB is visible, should be checked: ' + isRequired);
            for (let i = 0; i < 99; ++i) {
              let isChecked = browser.isSelected('#e2eLoginRequiredCB');
              console.log('#e2eLoginRequiredCB is checked: ' + isChecked);
              if (isChecked === isRequired)
                break;
              api.waitAndClick('#e2eLoginRequiredCB');
              console.log('#e2eLoginRequiredCB **click**');
            }
            // Somehow once this function exited with isChecked !== isRequired. Race condition?
            // Let's find out:
            let isChecked = browser.isSelected('#e2eLoginRequiredCB');
            console.log('#e2eLoginRequiredCB is checked: ' + isChecked);
            browser.pause(100);
            isChecked = browser.isSelected('#e2eLoginRequiredCB');
            console.log('#e2eLoginRequiredCB is checked: ' + isChecked);
            browser.pause(200);
            isChecked = browser.isSelected('#e2eLoginRequiredCB');
            console.log('#e2eLoginRequiredCB is checked: ' + isChecked);
            browser.pause(400);
            isChecked = browser.isSelected('#e2eLoginRequiredCB');
            console.log('#e2eLoginRequiredCB is checked: ' + isChecked);
            browser.pause(800);
            isChecked = browser.isSelected('#e2eLoginRequiredCB');
            console.log('#e2eLoginRequiredCB is checked: ' + isChecked);
          },

          clickAllowGuestLogin: function() {
            api.waitAndClick('#e2eAllowGuestsCB');
          },
        },
      },

      review: {
        approveNextWhatever: function() {
          api.waitAndClickFirst('.e_A_Rvw_AcptB');
          browser.waitUntilModalGone();
        },

        isMoreStuffToReview: function() {
          return browser.isVisible('.e_A_Rvw_AcptB');
        },
      },
    },

    serverErrorDialog: {
      waitAndAssertTextMatches: function(regex) {
        browser.waitAndAssertVisibleTextMatches('.modal-dialog.dw-server-error', regex);
      },

      // remove, use close() instead
      clickClose: function() {
        api.serverErrorDialog.close();
      },

      close: function() {
        browser.click('.e_SED_CloseB');
        browser.waitUntilGone('.modal-dialog.dw-server-error');
      }
    },

    helpDialog: {
      waitForThenClose: function() {
        api.waitAndClick('.esHelpDlg .btn-primary');
        browser.waitUntilModalGone();
      },
    },

    complex: {
      loginWithPasswordViaTopbar: function(username, password?: string) {
        api.topbar.clickLogin();
        var credentials = _.isObject(username) ?  // already { username, password } object
            username : { username: username, password: password };
        api.loginDialog.loginWithPassword(credentials);
      },

      loginAsGuestViaTopbar: function(nameOrObj, email?: string) {
        api.topbar.clickLogin();
        let name = nameOrObj;
        if (_.isObject(nameOrObj)) {
          assert(!email);
          name = nameOrObj.fullName;
          email = nameOrObj.emailAddress;
        }
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
            matchAfter?: boolean, titleMatchAfter?: String | boolean,
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
        if (data.matchAfter !== false && data.titleMatchAfter !== false) {
          browser.assertPageTitleMatches(data.titleMatchAfter || data.title);
        }
        if (data.matchAfter !== false && data.bodyMatchAfter !== false) {
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
        api.topic.clickReplyToOrigPost();
        api.editor.editText(text);
        api.editor.save();
      },

      replyToPostNr: function(postNr: PostNr, text: string) {
        api.topic.clickReplyToPostNr(postNr);
        api.editor.editText(text);
        api.editor.save();
      },

      flagPost: function(postNr: PostNr, reason: 'Inapt' | 'Spam') {
        api.topic.clickFlagPost(postNr);
        api.flagDialog.waitUntilFadedIn();
        if (reason === 'Inapt') {
          api.flagDialog.clickInappropriate();
        }
        else {
          die('Test code bug [EdE7WK5FY0]');
        }
        api.flagDialog.submit();
        api.stupidDialog.close();
      },

      openPageAuthorProfilePage: function() {
        api.pageTitle.openAboutAuthorDialog();
        api.aboutUserDialog.clickViewProfile();
      },

      sendMessageToPageAuthor: function(messageTitle: string, messageText: string) {
        api.pageTitle.openAboutAuthorDialog();
        api.aboutUserDialog.clickSendMessage();
        api.editor.editTitle(messageTitle);
        api.editor.editText(messageText);
        api.editor.saveWaitForNewPage();
      },

      createChatChannelViaWatchbar: function(
            data: { name: string, purpose: string, public_?: boolean }) {
        api.watchbar.clickCreateChatWaitForEditor();
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

// backw compat, for now
  api['replies'] = api.topic;

  return api;
}

export = pagesFor;


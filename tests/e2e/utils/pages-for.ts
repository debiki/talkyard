import _ = require('lodash');
import assert = require('assert');
import logAndDie = require('./log-and-die');
import settings = require('./settings');
import server = require('./server');
import c = require('../test-constants');
let logUnusual = logAndDie.logUnusual, die = logAndDie.die, dieIf = logAndDie.dieIf;
let logError = logAndDie.logError;
let logMessage = logAndDie.logMessage;

// Brekpoint debug help counters, use like so:  if (++ca == 1) debugger;
let ca = 0;
let cb = 0;
let cc = 0;


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
  const api = {

    getSiteId: function(): string {
      const result = browser.execute(function() {
        return window['eds'].siteId;
      });
      dieIf(!result || _.isNaN(parseInt(result.value)),
          "Error getting site id, result: " + JSON.stringify(result));
      return result.value;
    },


    switchToFrame: function(selector) {
      console.log(`switching to frame ${selector}...`);
      browser.waitForExist(selector);
      const iframe = browser.element(selector).value;
      browser.frame(iframe);
    },


    switchToEmbeddedCommentsIrame: function() {
      // These pause() avoids: "FAIL: Error: Remote end send an unknown status code", in Chrome, [E2EBUG]
      // here: [6UKB2FQ]
      browser.pause(75);
      browser.frameParent();
      browser.pause(75);
      browser.switchToFrame('iframe#ed-embedded-comments');
    },


    switchToEmbeddedEditorIrame: function() {
      browser.frameParent();
      browser.switchToFrame('iframe#ed-embedded-editor');
    },


    scrollToTop: function() {
      // I think some browsers wants to scroll <body> others want to scroll <html>, so do both.
      browser.scroll('body', 0, 0);
      browser.scroll('html', 0, 0);
      // Apparently takes a short while for the scroll to happen. I couldn't find any getScroll
      // function to poll and test when the scrolling is done, so just do this:
      // (200 ms is too short; then sometimes the stuff at the top won't be visible, when this
      // function returns.)
      browser.pause(500);
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


    playTimeSeconds: function(seconds: number) {  // [4WKBISQ2]
      browser.execute(function (seconds) {
        console.log("Playing time, seconds: " + seconds);
        window['debiki2'].testExtraMillis = window['debiki2'].testExtraMillis + seconds * 1000;
        console.log("Time now: " + window['debiki2'].testExtraMillis);
      }, seconds);
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
      api._waitAndClickImpl(selector, {});
    },


    waitAndClickFirst: function(selector) {
      api._waitAndClickImpl(selector, { clickFirst: true });
    },


    waitAndClickLast: function(selector) {
      browser.debug();
      //api._waitAndClickImpl(selector, false);
    },


    _waitAndClickImpl: function(selector, opts: { clickFirst?: boolean } = {}) {
      api._waitForClickable(selector);
      if (!selector.startsWith('#') && !opts.clickFirst) {
        let errors = '';
        let length = 1;
        const byBrowserResults = byBrowser(browser.elements(selector));
        _.forOwn(byBrowserResults, (result, browserName) => {
          const elems = result.value;
          if (elems.length !== 1) {
            length = elems.length;
            errors += browserNamePrefix(browserName) + "Bad num elems to click: " +
              JSON.stringify(elems) +
              ", should be 1. Elems matches selector: " + selector + " [EsE5JKP82]\n";
          }
        });
        assert.equal(length, 1, errors);
      }
      // Oddly enough, sometimes the overlay covers the page here, although
      // we just waited for it to go away.  [7UKDWP2] [7JUKDQ4].
      // Happens in FF only (May 2018) — maybe FF is so fast so the first test
      // somehow happens before it has been created?
      browser.waitUntilLoadingOverlayGone();
      browser.click(selector);
    },


    _waitForClickable: function(selector) {
      // Without pause(..), the tests often break when run in an *invisible* browser, but works
      // just fine when run in a *visible* browser. Meaning, it's very hard to fix any race
      // conditions, because only fails when I cannot see. So for now, pause(100).
      browser.pause(100);
      browser.waitForVisible(selector);
      browser.waitForEnabled(selector);
      browser.waitUntilLoadingOverlayGone();
    },


    waitAndClickLinkToNewPage: function(selector: string, refreshBetweenTests?: boolean) {
      // Keep the debug stuff, for now — once, the click failed, although visible already, weird.
      let delay = 30;
      //let count = 0;
      //console.log(`waitAndClickLinkToNewPage ${selector} ...`);
      browser.waitUntilLoadingOverlayGone();
      while (true) {
        browser.waitForMyDataAdded();
        browser.pause(delay);
        //console.log(`waitAndClickLinkToNewPage ${selector} testing:`);
        if (browser.isVisible(selector) && browser.isEnabled(selector)) {
          //console.log(`waitAndClickLinkToNewPage ${selector} —> FOUND and ENABLED`);
          // count += 1;
          // if (count >= 6)
          break;
        }
        else {
          //console.log(`waitAndClickLinkToNewPage ${selector} —> NOT found...`);
          if (refreshBetweenTests) browser.refresh();
          delay *= 1.67;
        }
      }
      browser.rememberCurrentUrl();
      //console.log(`waitAndClickLinkToNewPage ${selector} ... CLICKING`);
      browser.waitAndClick(selector);
      browser.waitForNewUrl();
      //console.log(`waitAndClickLinkToNewPage ${selector} ... New url here now.`);
    },


    waitUntilIsOnHomepage: function() {
      let delay = 20;
      while (true) {
        const url = browser.url().value;
        if (/https?:\/\/[^/?#]+(\/latest|\/top|\/)?(#.*)?$/.test(url)) {
          break;
        }
        delay *= 1.67;
        browser.pause(delay);
      }
    },


    assertPageHtmlSourceMatches_1: function(toMatch) {
      // _1 = only for 1 browser
      const source = browser.getSource();
      let regex = _.isString(toMatch) ? new RegExp(toMatch) : toMatch;
      assert(regex.test(source), "Page source does match " + regex);
    },


    assertPageHtmlSourceDoesNotMatch: function(toMatch) {
      let resultsByBrowser = byBrowser(browser.getSource());
      let regex = _.isString(toMatch) ? new RegExp(toMatch) : toMatch;
      _.forOwn(resultsByBrowser, (text, browserName) => {
        assert(!regex.test(text), browserNamePrefix(browserName) + "Page source does match " + regex);
      });
    },

    pageNotFoundOrAccessDenied: /Page not found, or Access Denied/,

    // Also see browser.pageTitle.assertPageHidden().  Dupl code [05PKWQ2A]
    assertWholePageHidden: function() {
      let resultsByBrowser = byBrowser(browser.getSource());
      _.forOwn(resultsByBrowser, (text, browserName) => {
        if (settings.prod) {
          assert(api.pageNotFoundOrAccessDenied.test(text),
              browserNamePrefix(browserName) + "Page not hidden (no not-found or access-denied)");
        }
        else {
          assert(/EdE0SEEPAGEHIDDEN_/.test(text), browserNamePrefix(browserName) + "Page not hidden");
        }
      });
    },

    // Also see browser.pageTitle.assertPageHidden().  Dupl code [05PKWQ2A]
    assertMayNotSeePage: function() {
      let resultsByBrowser = byBrowser(browser.getSource());
      _.forOwn(resultsByBrowser, (text, browserName) => {
        if (settings.prod) {
          assert(api.pageNotFoundOrAccessDenied.test(text),
              browserNamePrefix(browserName) + "Page not hidden (no not-found or access-denied)");
        }
        else {
          assert(/EdEM0SEE/.test(text), browserNamePrefix(browserName) +
              "User can see page. Or did you forget the --prod flag? (for Prod mode)");
        }
      });
    },

    assertMayNotLoginBecauseNotYetApproved: function() {
      browser.assertPageHtmlSourceMatches_1('TyM0APPR_-TyMAPPRPEND_');
    },

    assertMayNotLoginBecauseRejected: function() {
      browser.assertPageHtmlSourceMatches_1('TyM0APPR_-TyMNOACCESS_');
    },

    assertUrlIs: function(expectedUrl) {
      let url = browser.url().value;
      assert(url === expectedUrl);
    },

    goToSearchPage: (query?: string) => {
      const q = query ? '?q=' + query : '';
      browser.go('/-/search' + q);
      browser.waitForVisible('.s_SP_QueryTI');
    },

    dismissAnyAlert: (): boolean => {
      for (let i = 0; i < 20; ++i) {
        if (i % 10 === 0) console.log("Waiting for alert to dismiss ...");
        try {
          browser.alertDismiss();
          console.log("Dismissed.");
          return true;
        }
        catch (e) {
          // Wait for alert, up to 20*50 = 1 000 ms.
          browser.pause(50);
        }
      }
      console.log("No alert found.");
      return false;
    },

    countLongPollingsDone: () => {
      const result = browser.execute(function() {
        return window['debiki2'].Server.testGetLongPollingNr();
      });
      dieIf(!result, "Error getting long polling count, result: " + JSON.stringify(result));
      const count = parseInt(result.value);
      dieIf(_.isNaN(count), "Long polling count is weird: " + JSON.stringify(result));
      return count;
    },

    createSite: {
      fillInFieldsAndSubmit: function(data) {
        if (data.embeddingUrl) {
          browser.waitAndSetValue('#e_EmbeddingUrl', data.embeddingUrl);
        }
        else {
          browser.waitAndSetValue('#dwLocalHostname', data.localHostname);
        }
        browser.click('#e2eNext3');
        browser.setValue('#e2eOrgName', data.orgName || data.localHostname);
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
        // Click Next, Next ... to accept all default choices.
        api.waitAndClick('.e_Next');
        browser.pause(200); // Wait for next button
        api.waitAndClick('.e_Next');
        browser.pause(200);
        api.waitAndClick('.e_Next');
        browser.pause(200);
        api.waitAndClick('.e_Next');
        browser.pause(200);
        api.waitAndClick('#e2eDoCreateForum');
        var actualTitle = browser.waitAndGetVisibleText('h1.dw-p-ttl');
        assert.equal(actualTitle, forumTitle);
      },
    },


    topbar: {
      waitForVisible: function() {
        browser.waitForVisible('.esMyMenu');
      },

      clickBack: function() {
        browser.rememberCurrentUrl();
        browser.waitAndClick('.esTopbar_custom_backToSite');
        browser.waitForNewUrl();
      },

      clickHome: function() {
        if (browser.isVisible('.esLegal_home_link')) {
          browser.rememberCurrentUrl();
          browser.click('.esLegal_home_link')
          browser.waitForNewUrl();
        }
        else {
          api.topbar.clickAncestor("Home");
        }
      },

      clickAncestor: function(categoryName: string) {
        browser.rememberCurrentUrl();
        browser.waitForThenClickText('.esTopbar_ancestors_link', categoryName);
        browser.waitForNewUrl();
      },

      assertMyUsernameMatches: function(username: string) {
        browser.assertTextMatches('.esMyMenu .esAvtrName_name', username);
      },

      waitForNumPendingUrgentReviews: function(numUrgent: IntAtLeastOne) {
        assert(numUrgent >= 1, "Zero tasks won't ever become visible [TyE5GKRBQQ2]");
        browser.waitUntilTextMatches('.esNotfIcon-reviewUrgent', '^' + numUrgent + '$');
      },

      waitForNumPendingOtherReviews: function(numOther: IntAtLeastOne) {
        assert(numOther >= 1, "Zero tasks won't ever become visible [TyE2WKBPJR3]");
        browser.waitUntilTextMatches('.esNotfIcon-reviewOther', '^' + numOther + '$');
      },

      isNeedsReviewUrgentVisible: function() {
        return browser.isVisible('.esNotfIcon-reviewUrgent');
      },

      isNeedsReviewOtherVisible: function() {
        return browser.isVisible('.esNotfIcon-reviewOther');
      },

      getMyUsername: function() {
        return browser.getText('.esMyMenu .esAvtrName_name');
      },

      clickLogin: function() {
        api.waitAndClick('.esTopbar_logIn');
        browser.waitUntilLoadingOverlayGone();
      },

      clickSignUp: function() {
        api.waitAndClick('.esTopbar_signUp');
        browser.waitUntilLoadingOverlayGone();
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
        // If on a users profile page, might start reloading something (because different user & perms).
        browser.waitUntilLoadingOverlayGone();
      },

      openMyMenu: function() {
        api.waitAndClick('.esMyMenu');
        browser.waitUntilLoadingOverlayGone();
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
        browser.waitUntilLoadingOverlayGone();
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
        api.searchResultsPage.waitForResults(phrase);
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
      },

      pageTools: {
        deletePage: () => {
          browser.waitAndClick('.dw-a-tools');
          browser.waitUntilDoesNotMove('.e_DelPg');
          browser.waitAndClick('.e_DelPg');
          browser.waitUntilModalGone();
          browser.waitForVisible('.s_Pg_DdInf');
        },

        restorePage: () => {
          browser.waitAndClick('.dw-a-tools');
          browser.waitUntilDoesNotMove('.e_RstrPg');
          browser.waitAndClick('.e_RstrPg');
          browser.waitUntilModalGone();
          browser.waitUntilGone('.s_Pg_DdInf');
        },
      },
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
          dialogShown = browser.isVisible('.dw-login-modal') && browser.isVisible('.esLD');
          if (dialogShown)
            break;
        }
        assert(dialogShown, "The login dialog never appeared");
        api.loginDialog.waitAssertFullScreen();
      },

      waitAssertFullScreen: function() {
        browser.waitForVisible('.dw-login-modal');
        browser.waitForVisible('.esLD');
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

      createPasswordAccount: function(data: { fullName, username, email?, emailAddress?, password },
            shallBecomeOwner?: boolean, anyVerifyEmail?) {

        // Switch from the guest login form to the create-real-account form, if needed.
        browser.waitForVisible('#e2eFullName');
        if (browser.isVisible('.s_LD_CreateAccount')) {
          browser.waitAndClick('.s_LD_CreateAccount');
          browser.waitForVisible('#e2ePassword');
        }

        console.log('createPasswordAccount: fillInFullName...');
        if (data.fullName) api.loginDialog.fillInFullName(data.fullName);
        console.log('fillInUsername...');
        api.loginDialog.fillInUsername(data.username);
        console.log('fillInEmail...');
        const theEmail = data.email || data.emailAddress;
        if (theEmail) api.loginDialog.fillInEmail(theEmail);
        console.log('fillInPassword...');
        api.loginDialog.fillInPassword(data.password);
        console.log('clickSubmit...');
        api.loginDialog.clickSubmit();
        console.log('acceptTerms...');
        api.loginDialog.acceptTerms(shallBecomeOwner);
        console.log('waitForNeedVerifyEmailDialog...');
        if (anyVerifyEmail !== 'THERE_WILL_BE_NO_VERIFY_EMAIL_DIALOG') {
          api.loginDialog.waitForNeedVerifyEmailDialog();
        }
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

      waitForAndCloseWelcomeLoggedInDialog: function() {
        browser.waitForVisible('#te_WelcomeLoggedIn');
        browser.waitAndClick('#te_WelcomeLoggedIn button');
        browser.waitUntilModalGone();
      },

      fillInPassword: function(password) {
        browser.waitAndSetValue('#e2ePassword', password);
      },

      waitForBadLoginMessage: function() {
        browser.waitForVisible('.esLoginDlg_badPwd');
      },

      loginWithPassword: function(username, password?, opts?: { resultInError?: boolean }) {
        if (!opts && password && _.isObject(password)) {
          opts = <any> password;
          password = null;
        }
        if (_.isObject(username)) {
          password = username.password;
          username = username.username;
        }
        api.loginDialog.tryLogin(username, password);
        if (opts && opts.resultInError)
          return;
        browser.waitUntilModalGone();
        browser.waitUntilLoadingOverlayGone();
      },

      loginWithEmailAndPassword: function(emailAddress: string, password: string, badLogin) {
        api.loginDialog.tryLogin(emailAddress, password);
        if (badLogin !== 'BAD_LOGIN') {
          browser.waitUntilModalGone();
          browser.waitUntilLoadingOverlayGone();
        }
      },

      // Embedded discussions do all logins in popups.
      loginWithPasswordInPopup: function(username, password?: string) {
        browser.swithToOtherTabOrWindow();
        browser.disableRateLimits();
        if (_.isObject(username)) {
          password = username.password;
          username = username.username;
        }
        api.loginDialog.tryLogin(username, password);
        // The popup auto closes after login.
        browser.waitUntil(function () {
          return browser.getTabIds().length === 1;
        });
        browser.switchBackToFirstTabOrWindow();
      },

      loginButBadPassword: function(username: string, password: string) {
        api.loginDialog.tryLogin(username, password);
        browser.waitForVisible('.esLoginDlg_badPwd');
      },

      tryLogin: function(username: string, password: string) {
        api.loginDialog.switchToLoginIfIsSignup();
        api.loginDialog.fillInUsername(username);
        api.loginDialog.fillInPassword(password);
        api.loginDialog.clickSubmit();
      },

      waitForEmailUnverifiedError: function() {
        browser.waitUntilTextMatches('.modal-body', 'TyEEML0VERIF_');
      },

      waitForAccountSuspendedError: function() {
        browser.waitUntilTextMatches('.modal-body', 'TyEUSRSSPNDD_');
      },

      signUpAsGuest: function(name: string, email?: string) { // CLEAN_UP use createPasswordAccount instead? [8JTW4]
        console.log('createPasswordAccount with no email: fillInFullName...');
        api.loginDialog.fillInFullName(name);
        console.log('fillInUsername...');
        const username = name.replace(/[ '-]+/g, '_').substr(0, 20);  // dupl code (7GKRW10)
        api.loginDialog.fillInUsername(username);
        if (email) {
          console.log('fillInEmail...');
          api.loginDialog.fillInEmail(email);
        }
        else {
          console.log('fillInEmail anyway, because for now, always require email [0KPS2J]');
          api.loginDialog.fillInEmail(`whatever-${Date.now()}@example.com`);
        }
        console.log('fillInPassword...');
        api.loginDialog.fillInPassword("public1234");
        console.log('clickSubmit...');
        api.loginDialog.clickSubmit();
        console.log('acceptTerms...');
        api.loginDialog.acceptTerms();
        console.log('waitForWelcomeLoggedInDialog...');
        api.loginDialog.waitForAndCloseWelcomeLoggedInDialog();
        console.log('createPasswordAccount with no email: done');
        // Took forever: waitAndGetVisibleText, [CHROME_60_BUG]?
        browser.waitForVisible('.esTopbar .esAvtrName_name');
        const nameInHtml = browser.getText('.esTopbar .esAvtrName_name');
        assert(nameInHtml === username);
      },

      logInAsGuest: function(name: string, email_noLongerNeeded?: string) { // CLEAN_UP [8JTW4] is just pwd login?
        const username = name.replace(/[ '-]+/g, '_').substr(0, 20);  // dupl code (7GKRW10)
        console.log('logInAsGuest: fillInFullName...');
        api.loginDialog.fillInUsername(name);
        console.log('fillInPassword...');
        api.loginDialog.fillInPassword("public1234");
        console.log('clickSubmit...');
        api.loginDialog.clickSubmit();
        console.log('logInAsGuest with no email: done');
        const nameInHtml = browser.waitAndGetVisibleText('.esTopbar .esAvtrName_name');
        dieIf(nameInHtml !== username, `Wrong username in topbar: ${nameInHtml} [EdE2WKG04]`);
      },

      // For guests, there's a combined signup and login form.
      signUpLogInAs_Real_Guest: function(name: string, email?: string) {  // RENAME remove '_Real_' [8JTW4]
        api.loginDialog.fillInFullName(name);
        if (email) {
          api.loginDialog.fillInEmail(email);
        }
        api.loginDialog.clickSubmit();
        api.loginDialog.acceptTerms(false);
      },

      clickCreateAccountInstead: function() {
        api.waitAndClick('.esLD_Switch_L');
        browser.waitForVisible('.esCreateUser');
        browser.waitForVisible('#e2eUsername');
        browser.waitForVisible('#e2ePassword');
      },

      switchToLoginIfIsSignup: function() {
        // Switch to login form, if we're currently showing the signup form.
        while (true) {
          if (browser.isVisible('.esCreateUser')) {
            browser.waitAndClick('.esLD_Switch_L');
            browser.waitForVisible('.dw-reset-pswd');
          }
          else if (browser.isVisible('.dw-reset-pswd')) {
            break;
          }
          browser.pause(100);
        }
      },

      createGmailAccount: function(data: { email: string, password: string, username: string },
            shallBecomeOwner?: boolean, anyWelcomeDialog?: string) {
        api.loginDialog.loginWithGmail(data);
        // This should be the first time we login with Gmail at this site, so we'll be asked
        // to choose a username.
        // Not just #e2eUsername, then might try to fill in the username in the create-password-
        // user fields which are still visible for a short moment. Dupl code (2QPKW02)
        browser.waitAndSetValue('.esCreateUserDlg #e2eUsername', data.username);
        api.loginDialog.clickSubmit();
        api.loginDialog.acceptTerms(shallBecomeOwner);
        if (anyWelcomeDialog !== 'THERE_WILL_BE_NO_WELCOME_DIALOG') {
          api.loginDialog.waitAndClickOkInWelcomeDialog();
        }
        browser.waitUntilModalGone();
        browser.waitUntilLoadingOverlayGone();
      },

      loginWithGmail: function(data: { email: string, password: string }, isInPopupAlready?: boolean) {
        // Pause or sometimes the click misses the button. Is the browser doing some re-layout?
        browser.pause(150);
        api.waitAndClick('#e2eLoginGoogle');

        // Switch to a login popup window that got opened, for Google:
        if (!isInPopupAlready)
          browser.swithToOtherTabOrWindow();

        const emailInputSelector = 'input[type="email"]';
        const emailNext = '#identifierNext';
        const passwordInputSelector = 'input[type="password"]';
        const passwordNext = '#passwordNext';

        // We'll get logged in immediately, if we're already logged in to one
        // (and only one) Gmail account in the current browser. Wait for a short while
        // to find out what'll happen.
        while (true) {
          if (api.loginDialog.loginPopupClosedBecauseAlreadyLoggedIn()) {
            browser.switchBackToFirstTabOrWindow();
            return;
          }
          try {
            if (browser.isExisting(emailInputSelector))
              break;
          }
          catch (dummy) {
            console.log(`didn't find ${emailInputSelector}, ` +
                "tab closed? already logged in? [EdM5PKWT0B]");
          }
          browser.pause(500);
        }

        // Google does something weird here, need to wait. Why? Waiting until visible and
        // enabled = not enough.
        while (true) {
          try {
            browser.pause(250);
            console.log(`typing Gmail email: ${data.email}...`);
            browser.waitAndSetValue(emailInputSelector, data.email);
            break;
          }
          catch (dummy) {
            // See the weird issue below: (7FUKBAQ2)
            console.log("... Error. Trying again.");
          }
        }

        browser.pause(500);
        if (browser.isExisting(emailNext)) {
          console.log(`clicking ${emailNext}...`);
          browser.waitAndClick(emailNext);
        }

        // Google does something weird here too, hmm.
        browser.waitForVisible(passwordInputSelector, data.password);
        while (true) {
          try {
            browser.pause(250);
            console.log("typing Gmail password...");
            browser.waitAndSetValue(passwordInputSelector, data.password);
            break;
          }
          catch (dummy) {
            // As of July 29 2017, there's often this error:  (7FUKBAQ2)
            // """org.openqa.selenium.InvalidElementStateException: invalid element state:
            //  Element is not currently interactable and may not be manipulated"""
            // No idea why, because we do wait until visible & endabled.
            // Whatever. Just keep trying.
            console.log("... Error. Trying again.");
          }
        }

        browser.pause(500);
        if (browser.isExisting(passwordNext)) {
          console.log(`clicking ${passwordNext}...`);
          browser.waitAndClick(passwordNext);
        }

        /*
        browser.click('#signIn');
        browser.waitForEnabled('#submit_approve_access');
        browser.click('#submit_approve_access'); */

        if (!isInPopupAlready) {
          console.log("switching back to first tab...");
          browser.switchBackToFirstTabOrWindow();
        }
      },

      createFacebookAccount: function(data: { email: string, password: string, username: string },
            shallBecomeOwner?: boolean, anyWelcomeDialog?) {
        api.loginDialog.loginWithFacebook(data);
        // This should be the first time we login with Facebook at this site, so we'll be asked
        // to choose a username.
        // Not just #e2eUsername, then might try to fill in the username in the create-password-
        // user fields which are still visible for a short moment. Dupl code (2QPKW02)
        console.log("typing Facebook user's new username...");
        browser.waitAndSetValue('.esCreateUserDlg #e2eUsername', data.username);
        api.loginDialog.clickSubmit();
        api.loginDialog.acceptTerms(shallBecomeOwner);
        if (anyWelcomeDialog !== 'THERE_WILL_BE_NO_WELCOME_DIALOG') {
          api.loginDialog.waitAndClickOkInWelcomeDialog();
        }
        browser.waitUntilModalGone();
        browser.waitUntilLoadingOverlayGone();
      },

      loginWithFacebook: function(data: { email: string, password: string }, isInPopupAlready?: boolean) {
        // Pause or sometimes the click misses the button. Is the browser doing some re-layout?
        browser.pause(100);
        api.waitAndClick('#e2eLoginFacebook');

        // In Facebook's login popup window:
        if (!isInPopupAlready)
          browser.swithToOtherTabOrWindow();

        // We'll get logged in immediately, if we're already logged in to Facebook. Wait for
        // a short while to find out what'll happen.
        while (true) {
          if (api.loginDialog.loginPopupClosedBecauseAlreadyLoggedIn()) {
            browser.switchBackToFirstTabOrWindow();
            return;
          }
          try {
            if (browser.isExisting('#email'))
              break;
          }
          catch (dummy) {
            console.log("didn't find #email, tab closed? already logged in? [EdM5PKWT0]");
          }
          browser.pause(300);
        }

        console.log("typing Facebook user's email and password...");
        browser.pause(340); // so less risk Facebook think this is a computer?
        browser.waitAndSetValue('#email', data.email);
        browser.pause(380);
        browser.waitAndSetValue('#pass', data.password);
        browser.pause(280);

        // Facebook recently changed from <input> to <button>. So just find anything with type=submit.
        console.log("submitting Facebook login dialog...");
        api.waitAndClick('#loginbutton'); // or: [type=submit]');

        // Facebook somehow auto accepts the confirmation dialog, perhaps because
        // I'm using a Facebook API test user. So need not do this:
        //b.waitForVisible('[name=__CONFIRM__]');
        //b.click('[name=__CONFIRM__]');

        if (!isInPopupAlready) {
          console.log("switching back to first tab...");
          browser.switchBackToFirstTabOrWindow();
        }
      },

      loginPopupClosedBecauseAlreadyLoggedIn: () => {
        try {
          console.log("checking if we got logged in instantly... [EdM2PG44Y0]");
          const yes = browser.getTabIds().length === 1;// ||  // login tab was auto closed
              //browser.isExisting('.e_AlreadyLoggedIn');    // server shows logged-in-already page
              //  ^--- sometimes blocks forever, how is that possible?
          console.log(yes ? "yes seems so" : "no don't think so");
          return yes;
        }
        catch (dummy) {
          // This is usually/always (?) a """org.openqa.selenium.NoSuchWindowException:
          // no such window: target window already closed""" exception, which means we're
          // logged in already and the OAuth provider (Google/Facebook/etc) closed the login tab.
          console.log("apparently we got logged in directly [EdM2GJGQ03]");
          return true;
        }
      },

      waitAndClickOkInWelcomeDialog: function() {
        api.waitAndClick('#te_WelcomeLoggedIn .btn');
      },

      clickResetPasswordCloseDialogSwitchTab: function() {
        browser.click('.dw-reset-pswd');
        // The login dialog should close when we click the reset-password link. [5KWE02X]
        browser.waitUntilModalGone();
        browser.waitUntilLoadingOverlayGone();
        browser.swithToOtherTabOrWindow();
        browser.waitForVisible('#e2eRPP_emailI');
      },

      clickSubmit: function() {
        api.waitAndClick('#e2eSubmit');
      },

      clickCancel: function() {
        browser.waitAndClick('#e2eLD_Cancel');
        browser.waitUntilModalGone();
      },

      acceptTerms: function(isForSiteOwner?: boolean) {
        browser.waitForVisible('#e_TermsL');
        browser.waitForVisible('#e_PrivacyL');
        const termsLinkHtml = browser.getHTML('#e_TermsL');
        const privacyLinkHtml = browser.getHTML('#e_PrivacyL');
        if (isForSiteOwner) {
          assert(termsLinkHtml.indexOf('/-/terms-for-site-owners') >= 0);
          assert(privacyLinkHtml.indexOf('/-/privacy-for-site-owners') >= 0);
        }
        else if (isForSiteOwner === false) {
          assert(termsLinkHtml.indexOf('/-/terms-of-use') >= 0);
          assert(privacyLinkHtml.indexOf('/-/privacy-policy') >= 0);
        }
        setCheckbox('.s_TermsD_CB input', true);
        browser.waitAndClick('#e_TermsD_B');
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
        const selector = '.dw-ar-p-hd .esP_By';
        browser.waitForVisible(selector);
        api.topic.clickPostActionButton(selector);
        browser.waitForVisible('.esUsrDlg');
      },

      assertMatches: function(regex) {
        browser.assertPageTitleMatches(regex);
      },

      // Also see browser.assertWholePageHidden().
      assertPageHidden: function() {
        api.pageTitle.waitForVisible();
        assert(browser.isVisible('.dw-p-ttl .icon-eye-off'));
      },

      assertPageNotHidden: function() {
        api.pageTitle.waitForVisible();
        assert(!browser.isVisible('.dw-p-ttl .icon-eye-off'));
      },

      canBumpPageStatus: function() {
        return browser.isVisible('.dw-p-ttl .dw-clickable');
      },

      changeStatusToPlanned: function() {
        const selector = '.icon-idea.dw-clickable';
        browser.waitForVisible(selector);
        api.topic.clickPostActionButton(selector);
        browser.waitForVisible('.icon-check-dashed.dw-clickable');
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

      clickViewNew: function() {
        api.waitAndClick('#e_SortNewB');
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

      listDeletedTopics: function() {
        browser.waitAndClick('.esForum_filterBtn');
        browser.waitAndClick('.s_F_BB_TF_Dd');
        browser.forumTopicList.waitForTopics();
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
        browser.waitUntilGone('.s_F_SI_TopB');
      },

      clickViewTop: function() {
        api.waitAndClick('#e2eSortTopB');
        browser.waitForVisible('.s_F_SI_TopB');
      },

      openAboutUserDialogForUsername: function(username: string) {
        browser.waitAndClickFirst(`.edAvtr[title^="${username}"]`);
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

      assertTopicTitlesAreAndOrder: function(titles: string[]) {
        console.log('Not tested: assertTopicTitlesAreAndOrder');
        const els = <any> browser.$$(api.forumTopicList.titleSelector);
        for (let i = 0; i < titles.length; ++i) {
          const titleShouldBe = titles[i];
          const actualTitleElem = els[i];
          if (actualTitleElem) {
            assert(false, `Title nr ${i} missing, should be: "${titleShouldBe}"`);
          }
          const actualTitle = actualTitleElem.getText();
          if (titleShouldBe !== actualTitle) {
            assert(false, `Title nr ${i} is: "${actualTitle}", should be: "${titleShouldBe}"`);
          }
        }
      },

      assertTopicVisible: function(title) {
        browser.assertAnyTextMatches(api.forumTopicList.titleSelector, title, null, 'FAST');
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

      waitForCategories: function() {
        browser.waitForVisible('.s_F_Cs');
      },

      numCategoriesVisible: function(): number {
        return count(browser.elements(api.forumCategoryList.categoryNameSelector));
      },

      isCategoryVisible: function(categoryName: string): boolean {
        return browser.isVisible(api.forumCategoryList.categoryNameSelector, categoryName);
      },

      openCategory: function(categoryName: string) {
        browser.rememberCurrentUrl();
        browser.waitForThenClickText(api.forumCategoryList.categoryNameSelector, categoryName);
        browser.waitForNewUrl();
        browser.waitForVisible('.esForum_catsDrop');
        browser.assertTextMatches('.esForum_catsDrop', categoryName);
      },

      assertCategoryNotFoundOrMayNotAccess: function() {
        browser.assertAnyTextMatches('.dw-forum', 'EdE0CAT');
      }
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

      setUnlisted: function(unlisted: boolean) {
        // for now, ignore 'unlisted == true/false'
        browser.waitAndClick('#e2eShowUnlistedCB');
        browser.waitAndClick('#e2eUnlistedCB');
      },

      openSecurityTab: function() {
        browser.waitAndClick('#t_CD_Tabs-tab-2');
        browser.waitForVisible('.s_CD_Sec_AddB');
      },

      securityTab: {
        setMayCreate: function(groupId: UserId, may: boolean) {
          // For now, just click once
          browser.waitAndClick(`.s_PoP-Grp-${groupId} .s_PoP_Ps_P_CrPg input`);
        },

        setMayReply: function(groupId: UserId, may: boolean) {
          // For now, just click once
          browser.waitAndClick(`.s_PoP-Grp-${groupId} .s_PoP_Ps_P_Re input`);
        },

        setMaySee: function(groupId: UserId, may: boolean) {
          // For now, just click once
          browser.waitAndClick(`.s_PoP-Grp-${groupId} .s_PoP_Ps_P_See input`);
        },
      }
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

        // Clicking Return = complicated!  Only + \n  works in FF:
        browser.waitAndSetValue('#e2eAddUsD .Select-input > input', username + '\n');

        // Works in Chrome but not FF:
        // browser.keys(['Return']);  — so we append \n above, work as a Return press.

        /* Need to?:
          if (browser.options.desiredCapabilities.browserName == "MicrosoftEdge")
            element.setValue(...);
            browser.keys("\uE007");
          others:
            element.setValue(`...\n`);
        } */

        // None of this works:  DELETE_LATER after year 2019?
        /*
        browser.keys(['Enter']);
        browser.keys('\n');
        browser.keys('(\ue007');
        browser.keys('\uE006');
        browser.actions([{
          "type": "key",
          //"id": "keyboard",
          "id": "keys",
          "actions": [
            { "type": "keyDown", "value": "Enter" },
            { "type": "keyUp", "value": "Enter" }
          ]
        }]);
        const result = browser.elementActive();
        const activeElement = result.value && result.value.ELEMENT;
        if(activeElement){
          browser.elementIdValue(activeElement, ['Return']);
        }
        const result = browser.elementActive();
        const activeElement = result.value && result.value.ELEMENT;
        if(activeElement){
          browser.elementIdValue(activeElement, '\uE006');
        } */

        // Weird. The react-select dropdown is open and needs to be closed, otherwise
        // a modal overlay hides everything? Can be closed like so:
        // No, now in rc.10 (instead of previous version, rc.3), the dropdown auto closes, after select.
        // browser.click('#e2eAddUsD_SubmitB');
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
        let needsClickMore = false;
        switch (type) {
          case c.TestPageRole.Question: optionId = '#e2eTTD_QuestionO'; break;
          case c.TestPageRole.Problem: optionId = '#e2eTTD_ProblemO'; break;
          case c.TestPageRole.Idea: optionId = '#e2eTTD_IdeaO'; break;
          case c.TestPageRole.OpenChat: optionId = '#e2eTTD_OpenChatO'; break;
          case c.TestPageRole.PrivateChat: optionId = '#e2eTTD_PrivChatO'; break;
          case c.TestPageRole.Form: optionId = '#e2eTTD_FormO'; needsClickMore = true; break;
          case c.TestPageRole.WebPage: optionId = '#e2eTTD_WebPageO'; needsClickMore = true; break;
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
        browser.click('#debiki-editor-controller .e_EdCancelB');
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


    metabar: {
      clickLogout: function() {
        browser.waitAndClick('.esMetabar .dw-a-logout');
        browser.waitUntilGone('.esMetabar .dw-a-logout');
        browser.waitForVisible('.esMetabar');
      }
    },


    topic: {
      postBodySelector: (postNr: PostNr) => `#post-${postNr} .dw-p-bd`,

      clickHomeNavLink: function() {
        browser.click("a=Home");
      },

      waitForLoaded: function() {
        browser.waitForVisible('.dw-ar-t');
      },

      assertPagePendingApprovalBodyHidden: function() {
        api.topic.waitForLoaded();
        assert(api.topic._isTitlePendingApprovalVisible());
        assert(api.topic._isOrigPostPendingApprovalVisible());
        assert(!api.topic._isOrigPostBodyVisible());
      },

      assertPagePendingApprovalBodyVisible: function() {
        api.topic.waitForLoaded();
        assert(api.topic._isTitlePendingApprovalVisible());
        assert(api.topic._isOrigPostPendingApprovalVisible());
        assert(api.topic._isOrigPostBodyVisible());
      },

      assertPageNotPendingApproval: function() {
        api.topic.waitForLoaded();
        assert(!api.topic._isOrigPostPendingApprovalVisible());
        assert(api.topic._isOrigPostBodyVisible());
      },

      waitForPostNrVisible: function(postNr) {
        browser.waitForVisible('#post-' + postNr);
      },

      postNrContains: function(postNr: PostNr, selector: string) {
        return browser.isExisting(api.topic.postBodySelector(postNr) + ' ' + selector);
      },

      postNrContainsVisible: function(postNr: PostNr, selector: string) {
        return browser.isVisible(api.topic.postBodySelector(postNr) + ' ' + selector);
      },

      assertPostTextMatches: function(postNr: PostNr, text: string) {
        browser.assertTextMatches(api.topic.postBodySelector(postNr), text)
      },

      waitUntilPostTextMatches: function(postNr: PostNr, text: string) {
        browser.waitUntilTextMatches(api.topic.postBodySelector(postNr), text);
      },

      waitUntilTitleMatches: function(text: string) {
        api.topic.waitUntilPostTextMatches(c.TitleNr, text);
      },

      assertMetaPostTextMatches: function(postNr: PostNr, text: string) {
        browser.assertTextMatches(`#post-${postNr} .s_MP_Text`, text)
      },

      topLevelReplySelector: '.dw-depth-1 > .dw-p',
      replySelector: '.dw-depth-1 .dw-p',
      allRepliesTextSelector: '.dw-depth-0 > .dw-single-and-multireplies > .dw-res',
      anyCommentSelector: '.dw-p',
      anyReplyButtonSelector: '.dw-a-reply',
      addBottomCommentSelector: '.s_APAs_ACBB',

      waitForReplyButtonAssertCommentsVisible: function() {
        browser.waitForVisible(api.topic.anyReplyButtonSelector);
        assert(browser.isVisible(api.topic.anyCommentSelector));
      },

      waitForReplyButtonAssertNoComments: function() {
        browser.waitForVisible(api.topic.anyReplyButtonSelector);
        assert(!browser.isVisible(api.topic.anyCommentSelector));
      },

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

      clickReplyToOrigPost: function(whichButton) {
        const selector = whichButton === 'BottomButton' ?
            '.s_APAs_OPRB' : '.dw-ar-p + .esPA .dw-a-reply';
        api.topic.clickPostActionButton(selector);
      },

      clickReplyToEmbeddingBlogPost: function() {
        api.topic.clickPostActionButton('.dw-ar-t > .esPA .dw-a-reply');
      },

      clickReplyToPostNr: function(postNr: PostNr) {
        api.topic.clickPostActionButton(`#post-${postNr} + .esPA .dw-a-reply`);
      },

      clickAddBottomComment: function() {
        api._waitForClickable(api.topic.addBottomCommentSelector);
        api.topic.clickPostActionButton(api.topic.addBottomCommentSelector);
        // Dismiss any help dialog that explains what bottom comments are.
        browser.pause(150);
        if (browser.isVisible('.e_HelpOk')) {
          api.waitAndClick('.e_HelpOk');
          browser.waitUntilModalGone();
        }
      },

      canEditSomething: function(): boolean {
        return browser.isVisible('.dw-a-edit');
      },

      canReplyToSomething: function(): boolean {
        return browser.isVisible('.dw-a-reply');
      },

      canEditOrigPost: function(): boolean {
        return api.topic.canEditPostNr(c.BodyNr);
      },

      canEditPostNr: function(postNr: number): boolean {
        const selector = `#post-${postNr} + .esPA .dw-a-edit`;
        return browser.isVisible(selector) && browser.isEnabled(selector);
      },

      clickEditOrigPost: function() {
        api.waitAndClick('.dw-ar-t > .dw-p-as .dw-a-edit');
      },

      clickEditoPostNr: function(postNr: PostNr) {
        api.topic.clickPostActionButton(`#post-${postNr} + .esPA .dw-a-edit`);
      },

      clickMoreForPostNr: function(postNr: PostNr) {
        api.topic.clickPostActionButton(`#post-${postNr} + .esPA .dw-a-more`);
      },

      clickMoreVotesForPostNr: function(postNr: PostNr) {
        api.topic.clickPostActionButton(`#post-${postNr} + .esPA .dw-a-votes`);
      },

      toggleLikeVote: function(postNr: PostNr) {
        const likeVoteSelector = `#post-${postNr} + .esPA .dw-a-like`;  // dupl (4GKWSG02)
        const isLikedBefore = browser.isVisible(likeVoteSelector + '.dw-my-vote');
        api.topic.clickPostActionButton(likeVoteSelector);
        let delay = 133;
        while (true) {
          // Wait for the server to reply and the page to get updated.
          browser.pause(delay);
          delay *= 1.5;
          const isLikedAfter = browser.isVisible(likeVoteSelector + '.dw-my-vote');
          if (isLikedBefore !== isLikedAfter)
            break;
        }
      },

      isPostLikedByMe: function(postNr: PostNr) {
        const likeVoteSelector = `#post-${postNr} + .esPA .dw-a-like`;  // dupl (4GKWSG02)
        return browser.isVisible(likeVoteSelector + '.dw-my-vote');
      },

      toggleDisagreeVote: function(postNr: PostNr) {
        api.topic._toggleMoreVote(postNr, '.dw-a-wrong');
      },

      toggleBuryVote: function(postNr: PostNr) {
        api.topic._toggleMoreVote(postNr, '.dw-a-bury');
      },

      toggleUnwantedVote: function(postNr: PostNr) {
        api.topic._toggleMoreVote(postNr, '.dw-a-unwanted');
      },

      _toggleMoreVote: function(postNr: PostNr, selector: string) {
        api.topic.clickMoreVotesForPostNr(postNr);
        // The vote button appears in a modal dropdown.
        browser.waitAndClick('.esDropModal_content ' + selector);
        browser.waitUntilModalGone();
        browser.waitUntilLoadingOverlayGone();
      },

      canVoteLike: function(postNr: PostNr) {
        const likeVoteSelector = `#post-${postNr} + .esPA .dw-a-like`;  // dupl (4GKWSG02)
        return browser.isVisible(likeVoteSelector);
      },

      canVoteUnwanted: function(postNr: PostNr) {
        api.topic.clickMoreVotesForPostNr(postNr);
        browser.waitForVisible('.esDropModal_content .dw-a-like');
        const canVote = browser.isVisible('.esDropModal_content .dw-a-unwanted');
        assert(false); // how close modal? to do... later when needed
        return canVote;
      },

      clickFlagPost: function(postNr: PostNr) {
        api.topic.clickMoreForPostNr(postNr);
        api.waitAndClick('.icon-flag');  // for now, later: e_...
      },

      deletePost: function(postNr: PostNr) {
        api.topic.clickMoreForPostNr(postNr);
        api.waitAndClick('.dw-a-delete');
        api.waitAndClick('.dw-delete-post-dialog .e_YesDel');
        browser.waitUntilGone('.dw-delete-post-dialog');
        browser.waitUntilLoadingOverlayGone();
        browser.waitForVisible(`#post-${postNr}.dw-p-dl`);
      },

      canSelectAnswer: function() {
        return browser.isVisible('.dw-a-solve');
      },

      selectPostNrAsAnswer: function(postNr) {
        assert(!browser.isVisible(api.topic._makeUnsolveSelector(postNr)));
        api.topic.clickPostActionButton(api.topic._makeSolveSelector(postNr));
        browser.waitForVisible(api.topic._makeUnsolveSelector(postNr));
      },

      unselectPostNrAsAnswer: function(postNr) {
        assert(!browser.isVisible(api.topic._makeSolveSelector(postNr)));
        api.topic.clickPostActionButton(api.topic._makeUnsolveSelector(postNr));
        browser.waitForVisible(api.topic._makeSolveSelector(postNr));
      },

      _makeSolveSelector(postNr) {
        return `#post-${postNr} + .esPA .dw-a-solve`;
      },

      _makeUnsolveSelector(postNr) {
        return `#post-${postNr} + .esPA .dw-a-unsolve`;
      },

      closeTopic: function() {
        browser.waitAndClick(api.topic._closeButtonSelector);
        browser.waitForVisible(api.topic._reopenButtonSelector);
      },

      reopenTopic: function() {
        browser.waitAndClick(api.topic._reopenButtonSelector);
        browser.waitForVisible(api.topic._closeButtonSelector);
      },

      _closeButtonSelector: '.dw-ar-t > .esPA > .dw-a-close.icon-block',
      _reopenButtonSelector: '.dw-ar-t > .esPA > .dw-a-close.icon-circle-empty',

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

      clickPostActionButton: function(buttonSelector: string, opts: { clickFirst?: boolean } = {}) {   // RENAME to api.scrollAndClick?
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
        browser.waitForVisible(buttonSelector);
        for (let attemptNr = 1; attemptNr <= 2; ++attemptNr) {
          for (let i = 0; i < 20; ++i) {  // because FF sometimes won't realize it's done scrolling
            const buttonLocation = browser.getLocationInView(buttonSelector);

            // If is array, could use [0] — but apparently the button locations are returned
            // in random order, with incorrect positions that never change regardless of how
            // one scrolls, and is sometimes 0 = obviously wrong. So, don't try to
            // pick [0] to click the first = topmost elem.
            // Chrome? Chromedriver? Webdriver? Selenium? buggy (as of June 29 2018).
            dieIf(_.isArray(buttonLocation) && !opts.clickFirst, 'TyEISARRAYBKF');
            if (opts.clickFirst)
              break; // cannot scroll, see above. Currently the tests don't need to scroll (good luck)

            // E.g. the admin area, /-/admin.
            const isOnAutoPage = browser.url().value.indexOf('/-/') >= 0;

            // ? Why did I add this can-scroll test ? Maybe, if can *not* scroll, this loop never got
            // happy with the current scroll position (0, 0?) and continued trying-to-scroll forever?
            let hasScrollBtns = browser.isVisible(api.scrollButtons.fixedBarSelector);
            // If in admin area or user's profile, there're no scroll buttons, but can maybe
            // scroll anyway.
            const canScroll = hasScrollBtns || isOnAutoPage;
            if (!canScroll)
              break;

            let bottomY: number;
            if (hasScrollBtns) {
              bottomY = browser.getLocationInView(api.scrollButtons.fixedBarSelector).y;
            }
            else {
              // browser.windowHandleSize().value.height;  = (sometimes) too tall size
              const result = browser.execute(function() {
                return window['debiki2'].$$bySelector('#esPageColumn')[0].getBoundingClientRect().height;
              });
              dieIf(!result, "Error getting page height, result: " + JSON.stringify(result));
              bottomY = parseInt(result.value);
              dieIf(_.isNaN(bottomY), "Page height result is NaN: " + JSON.stringify(result));
            }

            // fixedBarLocation gets too small in ff, resulting in `< fixedBarLocation.y` below false,
            // so changed from `44 < ..` to `30 < ...`
            //console.log(`clickPostActionButton: is > ${buttonLocation.y > 60}`);
            //console.log(`clickPostActionButton: is < ${buttonLocation.y + 70 < fixedBarLocation.y}`);
            const topY = isOnAutoPage
                ? 100 // fixed topbar, some float drop —> 90 px tall
                : 60; // fixed topbar, about 40px tall
            if (buttonLocation.y > topY &&
                buttonLocation.y + 30 < bottomY)  // scroll button about 40 px tall, [7UKDWQ2]
                                                  // 30 visible = enough to click in middle
              break;

            console.log(`Scrolling into view: ${buttonSelector}, topY = ${topY}, ` +
                `buttonLocation.y = ${buttonLocation.y}, +30 = ${buttonLocation.y + 30}, ` +
                `bottomY: ${bottomY}`);
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
            console.log(`clickPostActionButton: CLICK ${buttonSelector} [TyME2ECLICK]`);
            api._waitAndClickImpl(buttonSelector, opts);
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
          console.log(`clickPostActionButton: attempt 2...`);
        }
      },

      assertFirstReplyTextMatches: function(text) {
        api.topic.assertPostTextMatches(c.FirstReplyNr, text);
      },

      _isOrigPostBodyVisible: function() {
        return !!browser.getText('#post-1 > .dw-p-bd');
      },

      _isTitlePendingApprovalVisible: function() {
        return browser.isVisible('.dw-p-ttl .esPendingApproval');
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

      waitForName: function() {
        browser.waitForVisible('.esUP_Un');
      },

      openActivityFor: function(who: string, origin?: string) {
        browser.go((origin || '') + `/-/users/${who}/activity/posts`);
        browser.waitUntilLoadingOverlayGone();
      },

      openNotfsFor: function(who: string, origin?: string) {
        browser.go((origin || '') + `/-/users/${who}/notifications`);
        browser.waitUntilLoadingOverlayGone();
      },

      openPreferencesFor: function(who: string, origin?: string) {
        browser.go((origin || '') + `/-/users/${who}/preferences`);
        browser.waitUntilLoadingOverlayGone();
      },

      goToActivity: function() {
        browser.waitAndClick('.e_UP_ActivityB');
        browser.waitForVisible('.s_UP_Act_List');
        browser.waitUntilLoadingOverlayGone();
      },

      goToPreferences: function() {
        api.userProfilePage.clickGoToPreferences();
      },

      // rename
      clickGoToPreferences: function() {
        browser.waitAndClick('#e2eUP_PrefsB');
        browser.waitForVisible('.e_UP_Prefs_FN');
        browser.waitUntilLoadingOverlayGone();
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
        switchToPosts: function(opts: { shallFindPosts: boolean | 'NoSinceActivityHidden' }) {
          browser.waitAndClick('.s_UP_Act_Nav_PostsB');
          if (opts.shallFindPosts === 'NoSinceActivityHidden') {
            api.userProfilePage.activity.posts.waitForNothingToShow();
          }
          else if (opts.shallFindPosts) {
            browser.waitForVisible('.s_UP_Act_Ps');
            browser.waitForVisible('.s_UP_Act_Ps_P');
          }
          else {
            api.userProfilePage.activity.posts.waitForNoPosts();
          }
          browser.waitUntilLoadingOverlayGone();
        },

        switchToTopics: function(opts: { shallFindTopics: boolean | 'NoSinceActivityHidden' }) {
          browser.waitAndClick('.s_UP_Act_Nav_TopicsB');
          browser.waitForVisible('.s_UP_Act_Ts');
          if (opts.shallFindTopics === 'NoSinceActivityHidden') {
            api.userProfilePage.activity.topics.waitForNothingToShow();
          }
          else if (opts.shallFindTopics) {
            browser.waitForVisible('.e2eTopicTitle');
          }
          else {
            api.userProfilePage.activity.topics.waitForNoTopics();
          }
          browser.waitUntilLoadingOverlayGone();
        },

        posts: {
          postSelector: '.s_UP_Act_Ps_P .dw-p-bd',

          waitForNothingToShow: function() {
            browser.waitForVisible('.s_UP_Act_List .e_NothingToShow');
          },

          waitForNoPosts: function() {
            browser.waitForVisible('.e_NoPosts');
          },

          assertExactly: function(num: number) {
            browser.assertExactly(num, api.userProfilePage.activity.posts.postSelector);
          },

          // Do this separately, because can take rather long (suprisingly?).
          waitForPostTextsVisible: function() {
            browser.waitForVisible(api.userProfilePage.activity.posts.postSelector);
          },

          assertPostTextVisible: function(postText: string) {
            let selector = api.userProfilePage.activity.posts.postSelector;
            browser.assertAnyTextMatches(selector, postText, null, 'FAST');
          },

          assertPostTextAbsent: function(postText: string) {
            let selector = api.userProfilePage.activity.posts.postSelector;
            browser.assertNoTextMatches(selector, postText);
          },
        },

        topics: {
          topicsSelector: '.s_UP_Act_Ts .e2eTopicTitle',

          waitForNothingToShow: function() {
            browser.waitForVisible('.s_UP_Act_List .e_NothingToShow');
          },

          waitForNoTopics: function() {
            browser.waitForVisible('.e_NoTopics');
          },

          assertExactly: function(num: number) {
            browser.assertExactly(num, api.userProfilePage.activity.topics.topicsSelector);
          },

          waitForTopicTitlesVisible: function() {
            browser.waitForVisible(api.userProfilePage.activity.topics.topicsSelector);
          },

          assertTopicTitleVisible: function(title: string) {
            let selector = api.userProfilePage.activity.topics.topicsSelector;
            browser.assertAnyTextMatches(selector, title, null, 'FAST');
          },

          assertTopicTitleAbsent: function(title: string) {
            let selector = api.userProfilePage.activity.topics.topicsSelector;
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
        switchToEmailsLogins: function() {
          browser.waitAndClick('.s_UP_Prf_Nav_EmLgL');
          browser.waitForVisible('.s_UP_EmLg_EmL');
          browser.waitUntilLoadingOverlayGone();
        },

        switchToAbout: function() {
          browser.waitAndClick('.s_UP_Prf_Nav_AbtL');
          browser.waitForVisible('.e_UP_Prefs_FN');
        },

        switchToPrivacy: function() {
          browser.waitAndClick('.e_UP_Prf_Nav_PrivL');
          browser.waitForVisible('.e_HideActivityAllCB');
        },

        // ---- Should be wrapped in `about { .. }`:

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

        setSummaryEmailsEnabled: function(enabled: boolean) {
          setCheckbox('#sendSummaryEmails', enabled);
        },

        save: function() {
          api.userProfilePage.preferences.clickSave();
          browser.waitUntilModalGone();
          browser.waitUntilLoadingOverlayGone();
        },

        clickSave: function() {
          browser.waitAndClick('#e2eUP_Prefs_SaveB');
        },

        // ---- /END should be wrapped in `about { .. }`.

        privacy: {
          setHideActivityForStrangers: function(enabled: boolean) {
            setCheckbox('.e_HideActivityStrangersCB input', enabled);
          },

          setHideActivityForAll: function(enabled: boolean) {
            setCheckbox('.e_HideActivityAllCB input', enabled);
          },

          savePrivacySettings: function() {
            dieIf(browser.isVisible('.e_Saved'), 'TyE6UKHRQP4'); // unimplemented
            browser.waitAndClick('.e_SavePrivacy');
            browser.waitForVisible('.e_Saved');
          },
        },

        emailsLogins: {
          getEmailAddress: function() {
            browser.waitForVisible('.s_UP_EmLg_EmL_It_Em');
            return browser.getText('.s_UP_EmLg_EmL_It_Em');
          },

          waitUntilEmailAddressListed: function(addrRegexStr: string,
                  opts: { shallBeVerified?: boolean } = {}) {
            const verified = opts.shallBeVerified ? '.e_EmVerfd' : (
              opts.shallBeVerified === false ? '.e_EmNotVerfd' : '');
            browser.waitUntilTextMatches('.s_UP_EmLg_EmL_It_Em' + verified, addrRegexStr);
          },

          addEmailAddress: function(address) {
            const emailsLogins = api.userProfilePage.preferences.emailsLogins;
            emailsLogins.clickAddEmailAddress();
            emailsLogins.typeNewEmailAddress(address);
            emailsLogins.saveNewEmailAddress();
          },

          clickAddEmailAddress: function() {
            browser.waitAndClick('.e_AddEmail');
            browser.waitForVisible('.e_NewEmail input');
          },

          typeNewEmailAddress: function(emailAddress) {
            browser.waitAndSetValue('.e_NewEmail input', emailAddress);
          },

          saveNewEmailAddress: function() {
            browser.waitAndClick('.e_SaveEmB');
            browser.waitForVisible('.s_UP_EmLg_EmAdded');
          },

          canRemoveEmailAddress: function() {
            browser.waitForVisible('.e_AddEmail');
            // Now any remove button should have appeared.
            return browser.isVisible('.e_RemoveEmB');
          },

          removeOneEmailAddress: function() {
            browser.waitAndClick('.e_RemoveEmB');
            while (browser.isVisible('.e_RemoveEmB')) {
              browser.pause(200);
            }
          },

          canMakeOtherEmailPrimary: function() {
            // Only call this function if another email has been added (then there's a Remove button).
            browser.waitForVisible('.e_RemoveEmB');
            // Now the make-primary button would also have appeared, if it's here.
            return browser.isVisible('.e_MakeEmPrimaryB');
          },

          makeOtherEmailPrimary: function() {
            browser.waitAndClick('.e_MakeEmPrimaryB');
          }
        }
      }
    },


    hasVerifiedEmailPage: {
      waitUntilLoaded: function(opts: { needToLogin: boolean }) {
        browser.waitForVisible('.e_HasVerifiedEmail');
        browser.waitForVisible('.e_ViewProfileL');
        browser.waitForVisible('.e_HomepageL');
        assert(opts.needToLogin === browser.isVisible('.e_NeedToLogin'));
      },

      goToHomepage: function() {
        browser.waitAndClick('.e_HomepageL');
      },

      goToProfile: function() {
        browser.waitAndClick('.e_ViewProfileL');
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
        browser.waitUntilLoadingOverlayGone();
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
        browser.waitForVisible('h1.esTopbar_custom_title');
        browser.assertTextMatches('h1', "Admin Area");
      },

      clickLeaveAdminArea: function() {
        browser.rememberCurrentUrl();
        api.waitAndClick('.esTopbar_custom_backToSite');
        browser.waitForNewUrl();
      },

      goToLoginSettings: function(origin?: string) {
        browser.go((origin || '') + '/-/admin/settings/login');
      },

      goToUsersEnabled: function(origin?: string) {
        browser.go((origin || '') + '/-/admin/users');
      },

      goToReview: function(origin?: string) {
        browser.go((origin || '') + '/-/admin/review/all');
        api.adminArea.review.waitUntilLoaded();
        // Because of React? bug workaround, everything might unmount for a moment.
        // Wait for it to reappear. [5QKBRQ]
        browser.pause(600 + 50);
        api.adminArea.review.waitUntilLoaded();
      },

      settings: {
        clickSaveAll: function() {
          api.waitAndClick('.esA_SaveBar_SaveAllB');
          browser.waitUntilLoadingOverlayGone();
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
          setRequireVerifiedEmail: function(isRequired: boolean) {
            setCheckbox('.e_A_Ss_S-RequireVerifiedEmailCB input', isRequired);
          },

          setLoginRequired: function(isRequired: boolean) {
            setCheckbox('#e2eLoginRequiredCB', isRequired);
          },

          setApproveUsers: function(isRequired: boolean) {
            setCheckbox('#e_ApproveUsersCB', isRequired);
          },

          clickAllowGuestLogin: function() {
            api.waitAndClick('#e2eAllowGuestsCB');
          },
        },
      },

      user: {
        enabledSelector: '.e_Enabled-Yes',
        disabledSelector: '.e_Enabled-No',
        disabledBecauseEmailUnverified: '.e_Enabled-No_EmNotVer',
        disabledBecauseWaitingForApproval: '.e_Enabled-No_WaitingAppr',
        setEmailVerifiedButtonSelector: '.e_SetEmVerifB',
        setEmailNotVerifiedButtonSelector: '.e_SetEmNotVerifB',
        sendEmVerEmButtonSelector: '.s_SendEmVerifEmB',

        waitForLoaded: function() {
          browser.waitForVisible('.esA_Us_U_Rows');
        },

        assertEnabled: function() {
          api.adminArea.user.waitForLoaded();
          assert(browser.isVisible(api.adminArea.user.enabledSelector));
        },

        assertEmailVerified: function() {
          assert(browser.isVisible(api.adminArea.user.setEmailNotVerifiedButtonSelector));
        },

        assertEmailNotVerified: function() {
          assert(browser.isVisible(api.adminArea.user.setEmailVerifiedButtonSelector));
        },

        setEmailToVerified: function(verified: boolean) {
          const u = api.adminArea.user;
          browser.waitAndClick(
              verified ? u.setEmailVerifiedButtonSelector : u.setEmailNotVerifiedButtonSelector);
          // Wait for the request to complete — then, the opposite buttons will be shown:
          browser.waitForVisible(
              verified ? u.setEmailNotVerifiedButtonSelector : u.setEmailVerifiedButtonSelector);
        },

        resendEmailVerifEmail: function () {
          browser.waitAndClick(api.adminArea.user.sendEmVerEmButtonSelector);
        },

        assertDisabledBecauseNotYetApproved: function() {
          api.adminArea.user.waitForLoaded();
          assert(browser.isVisible(api.adminArea.user.disabledSelector));
          assert(browser.isVisible(api.adminArea.user.disabledBecauseWaitingForApproval));
          // If email not verified, wouldn't be considered waiting.
          assert(!browser.isVisible(api.adminArea.user.disabledBecauseEmailUnverified));
        },

        assertDisabledBecauseEmailNotVerified: function() {
          api.adminArea.user.waitForLoaded();
          assert(browser.isVisible(api.adminArea.user.disabledSelector));
          assert(browser.isVisible(api.adminArea.user.disabledBecauseEmailUnverified));
          // Isn't considered waiting, until after email approved.
          assert(!browser.isVisible(api.adminArea.user.disabledBecauseWaitingForApproval));
        },

        assertApprovedInfoAbsent: function() {
          api.adminArea.user.waitForLoaded();
          assert(browser.isExisting('.e_Appr_Info-Absent'));
        },

        assertApproved: function() {
          api.adminArea.user.waitForLoaded();
          assert(browser.isVisible('.e_Appr_Yes'));
        },

        assertRejected: function() {
          api.adminArea.user.waitForLoaded();
          assert(browser.isVisible('.e_Appr_No'));
        },

        assertWaitingForApproval: function() {
          api.adminArea.user.waitForLoaded();
          assert(browser.isVisible('.e_Appr_Undecided'));
        },

        approveUser: function() {
          browser.waitAndClick('.e_Appr_ApprB');
          browser.waitForVisible('.e_Appr_Yes');
        },

        rejectUser: function() {
          browser.waitAndClick('.e_Appr_RejB');
          browser.waitForVisible('.e_Appr_No');
        },

        undoApproveOrReject: function() {
          browser.waitAndClick('.e_Appr_UndoB');
          browser.waitForVisible('.e_Appr_Undecided');
        },

        suspendUser: function(opts: { days: number, reason: string } = { days: 10, reason: "reason" }) {
          browser.waitAndClick('.e_Suspend');
          browser.waitUntilDoesNotMove('.e_SuspDays');
          browser.waitAndSetValue('.e_SuspDays input', opts.days);
          browser.waitAndSetValue('.e_SuspReason input', opts.reason);
          browser.waitAndClick('.e_DoSuspendB');
          browser.waitForVisible('.e_Unuspend');
        },

        unsuspendUser: function() {
          browser.waitAndClick('.e_Unuspend');
          browser.waitForVisible('.e_Suspend');
        },

        markAsMildThreat: function() {
          browser.waitAndClick('.e_ThreatLvlB');
          browser.waitAndClick('.e_MildThreatB');
          browser.waitForVisible('.e_ThreatLvlIsLkd');
        },

        markAsModerateThreat: function() {
          browser.waitAndClick('.e_ThreatLvlB');
          browser.waitAndClick('.e_ModerateThreatB');
          browser.waitForVisible('.e_ThreatLvlIsLkd');
        },

        unlockThreatLevel: function() {
          browser.waitAndClick('.e_ThreatLvlB');
          browser.waitAndClick('.e_UnlockThreatB');
          browser.waitForVisible('.e_ThreatLvlNotLkd');
        },

        grantAdmin: function() {
          browser.waitForVisible('.e_Adm-No');
          browser.waitAndClick('.e_ToggleAdminB');
          browser.waitForVisible('.e_Adm-Yes');
        },

        revokeAdmin: function() {
          browser.waitForVisible('.e_Adm-Yes');
          browser.waitAndClick('.e_ToggleAdminB');
          browser.waitForVisible('.e_Adm-No');
        },

        grantModerator: function() {
          browser.waitForVisible('.e_Mod-No');
          browser.waitAndClick('.e_ToggleModB');
          browser.waitForVisible('.e_Mod-Yes');
        },

        revokeModerator: function() {
          browser.waitForVisible('.e_Mod-Yes');
          browser.waitAndClick('.e_ToggleModB');
          browser.waitForVisible('.e_Mod-No');
        },
      },

      users: {
        usernameSelector: '.dw-username',
        enabledUsersTabSelector: '.e_EnabledUsB',
        waitingUsersTabSelector: '.e_WaitingUsB',

        waitForLoaded: function() {
          browser.waitForVisible('.e_AdminUsersList');
        },

        goToUser: function(user: string | Member) {
          const username = _.isString(user) ? user : user.username;
          browser.rememberCurrentUrl();
          browser.waitForThenClickText(api.adminArea.users.usernameSelector, username);
          browser.waitForNewUrl();
          browser.waitAndAssertVisibleTextMatches('.e_A_Us_U_Username', username);
        },

        assertUserListEmpty: function(member: Member) {
          api.adminArea.users.waitForLoaded();
          assert(browser.isVisible('.e_NoSuchUsers'));
        },

        assertUserListed: function(member: Member) {
          api.adminArea.users.waitForLoaded();
          browser.assertAnyTextMatches(api.adminArea.users.usernameSelector, member.username);
        },

        assertUserAbsent: function(member: Member) {
          api.adminArea.users.waitForLoaded();
          browser.assertNoTextMatches(api.adminArea.users.usernameSelector, member.username);
        },

        asserExactlyNumUsers: function(num: number) {
          api.adminArea.users.waitForLoaded();
          browser.assertExactly(num, api.adminArea.users.usernameSelector);
        },

        // Works only if exactly 1 user listed.
        assertEmailVerified_1_user: function(member: Member, verified: boolean) {
          // for now:  --
          api.adminArea.users.assertUserListed(member);
          // later, check the relevant user row.
          // ------------
          if (verified) {
            assert(!browser.isVisible('.e_EmNotVerfd'));
          }
          else {
            assert(browser.isVisible('.e_EmNotVerfd'));
          }
        },

        switchToEnabled: function() {
          browser.waitAndClick(api.adminArea.users.enabledUsersTabSelector);
          browser.waitForVisible('.e_EnabledUsersIntro');
          api.adminArea.users.waitForLoaded();
        },

        switchToWaiting: function() {
          browser.waitAndClick(api.adminArea.users.waitingUsersTabSelector);
          browser.waitForVisible('.e_WaitingUsersIntro');
          api.adminArea.users.waitForLoaded();
        },

        isWaitingTabVisible: function() {
          browser.waitForVisible(api.adminArea.users.enabledUsersTabSelector);
          return browser.isVisible(api.adminArea.users.waitingUsersTabSelector);
        },

        switchToNew: function() {
          browser.waitAndClick('.e_NewUsB');
          browser.waitForVisible('.e_NewUsersIntro');
          api.adminArea.users.waitForLoaded();
        },

        switchToStaff: function() {
          browser.waitAndClick('.e_StaffUsB');
          browser.waitForVisible('.e_StaffUsersIntro');
          api.adminArea.users.waitForLoaded();
        },

        switchToSuspended: function() {
          browser.waitAndClick('.e_SuspendedUsB');
          browser.waitForVisible('.e_SuspendedUsersIntro');
          api.adminArea.users.waitForLoaded();
        },

        switchToWatching: function() {
          browser.waitAndClick('.e_WatchingUsB');
          browser.waitForVisible('.e_ThreatsUsersIntro');
          api.adminArea.users.waitForLoaded();
        },

        switchToInvite: function() {
          browser.waitAndClick('.e_InvitedUsB');
          // When this elem visible, any invited-users-data has also been loaded.
          browser.waitForVisible('.s_InvsL');
        },

        waiting: {
          undoSelector: '.e_UndoApprRjctB',

          approveFirstListedUser: function() {
            browser.waitAndClickFirst('.e_ApproveUserB');
            browser.waitForVisible(api.adminArea.users.waiting.undoSelector);
          },

          rejectFirstListedUser: function() {
            browser.waitAndClickFirst('.e_RejectUserB');
            browser.waitForVisible(api.adminArea.users.waiting.undoSelector);
          },

          undoApproveOrReject: function() {
            browser.waitAndClickFirst(api.adminArea.users.waiting.undoSelector);
            browser.waitUntilGone(api.adminArea.users.waiting.undoSelector);
          },
        }
      },

      review: {
        waitUntilLoaded: function() {
          browser.waitForVisible('.e_A_Rvw, .esLD');
        },

        playTimePastUndo: function() {
          // Make the server and browser believe we've waited for the review timeout seconds.
          server.playTimeSeconds(c.ReviewDecisionUndoTimoutSeconds + 10);
          api.playTimeSeconds(c.ReviewDecisionUndoTimoutSeconds + 10);
        },

        waitForServerToCarryOutDecisions: function(pageId?: PageId, postNr?: PostNr) {
          // Then wait for the server to actually do something.
          // The UI will reload the task list and auto-update itself [2WBKG7E], when
          // the review decisions have been carried out server side. Then the buttons
          // tested for below, hide.
          while (true) {
            browser.pause(c.JanitorThreadIntervalMs + 200);
            if (!pageId) {
              if (!browser.isVisible('.e_A_Rvw_Tsk_UndoB'))
                break;
            }
            else {
              // If we have a specific post in mind, then not only the Undo, but also
              // any Accept or Delete buttons elsewhere, for the same post, should
              // disappear, when the server is done.
              assert(_.isNumber(postNr));
              const pagePostSelector = '.e_Pg-Id-' + pageId + '.e_P-Nr-' + postNr;
              const anyButtonsVisible = (
                browser.isVisible(pagePostSelector + ' .e_A_Rvw_Tsk_UndoB') ||
                browser.isVisible(pagePostSelector + ' .e_A_Rvw_Tsk_AcptB') ||
                browser.isVisible(pagePostSelector + ' .e_A_Rvw_Tsk_RjctB'));
              if (!anyButtonsVisible)
                break;
            }
          }
          browser.waitUntilLoadingOverlayGone();
        },

        goToPostForTaskIndex: function(index: number) {
          die("Won't work, opens in new tab [TyE5NA2953");
          api.topic.clickPostActionButton(`.e_RT-Ix-${index} .s_A_Rvw_Tsk_ViewB`);
          api.topic.waitForLoaded();
        },

        approvePostForMostRecentTask: function() {
          api.topic.clickPostActionButton('.e_A_Rvw_Tsk_AcptB', { clickFirst: true });
          browser.waitUntilModalGone();
          browser.waitUntilLoadingOverlayGone();
        },

        approvePostForTaskIndex: (index: number) => {
          api.topic.clickPostActionButton(`.e_RT-Ix-${index} .e_A_Rvw_Tsk_AcptB`);
          browser.waitUntilModalGone();
          browser.waitUntilLoadingOverlayGone();
        },

        rejectDeleteTaskIndex: (index: number) => {
          api.topic.clickPostActionButton(`.e_RT-Ix-${index} .e_A_Rvw_Tsk_RjctB`);
          browser.waitUntilModalGone();
          browser.waitUntilLoadingOverlayGone();
        },

        countReviewTasksFor: function(pageId, postNr, opts: { waiting: boolean }): number {
          const pageIdPostNrSelector = '.e_Pg-Id-' + pageId + '.e_P-Nr-' + postNr;
          const waitingSelector = opts.waiting ? '.e_Wtng' : '.e_NotWtng';
          const selector = '.esReviewTask' + pageIdPostNrSelector + waitingSelector;
          const elems = browser.elements(selector).value;
          console.log(`Counted to ${elems.length} of these: ${selector}`);
          return elems.length;
        },

        isMoreStuffToReview: function() {
          return browser.isVisible('.e_A_Rvw_Tsk_AcptB');
        },

        waitForTextToReview: function(text) {
          browser.waitUntilTextMatches('.esReviewTask_it', text);
        },

        countThingsToReview: function(): number {
          const elems = browser.elements('.esReviewTask_it').value;
          return elems.length;
        },

        isTasksPostDeleted: function(taskIndex: number): boolean {
          return browser.isVisible(`.e_RT-Ix-${taskIndex}.e_P-Dd`);
        }
      },
    },

    serverErrorDialog: {
      waitForJustGotSuspendedError: function() {
        browser.waitUntilTextMatches('.modal-body', 'TyESUSPENDED_|TyE0LGDIN_');
      },

      dismissReloadPageAlert: function() {
        // Seems this alert appears only in a visible browser (not in an invisible headless browser).
        for (let i = 0; i < 10; ++i) {
          // Clicking anywhere triggers an alert about reloading the page, although has started
          // writing — because was logged out by the server (e.g. because user suspended)
          // and then som js tries to reload.
          browser.click('.modal-body');
          const gotDismissed = browser.dismissAnyAlert();
          if (gotDismissed) {
            console.log("Dismissed got-logged-out but-had-started-writing related alert.");
            return;
          }
        }
        console.log("Didn't get any got-logged-out but-had-started-writing related alert.");
      },

      waitAndAssertTextMatches: function(regex) {
        browser.waitAndAssertVisibleTextMatches('.modal-dialog.dw-server-error', regex);
      },

      clickCloseThenDontWait: function() {
        api.serverErrorDialog.close();
      },

      close: function() {
        browser.waitAndClick('.e_SED_CloseB');
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
      loginWithPasswordViaTopbar: function(username, password?: string, opts?: { resultInError?: boolean }) {
        if (!opts && password && _.isObject(password)) {
          opts = <any> password;
          password = null;
        }
        api.topbar.clickLogin();
        const credentials = _.isObject(username) ?  // already { username, password } object
            username : { username: username, password: password };
        api.loginDialog.loginWithPassword(credentials, opts || {});
      },

      signUpAsMemberViaTopbar: function(
            member: { emailAddress: string, username: string, password: string }) {
        api.topbar.clickSignUp();
        api.loginDialog.fillInEmail(member.emailAddress);
        api.loginDialog.fillInUsername(member.username);
        api.loginDialog.fillInPassword(member.password);
        api.loginDialog.clickSubmit();
        api.loginDialog.acceptTerms();
      },

      signUpAsGuestViaTopbar: function(nameOrObj, email?: string) {
        browser.disableRateLimits();
        api.topbar.clickSignUp();
        let name = nameOrObj;
        if (_.isObject(nameOrObj)) {
          assert(!email);
          name = nameOrObj.fullName;
          email = nameOrObj.emailAddress;
        }
        api.loginDialog.signUpAsGuest(name, email);
      },

      signUpAsGmailUserViaTopbar: function({ username }) {
        browser.disableRateLimits();
        api.topbar.clickSignUp();
        api.loginDialog.createGmailAccount({
            email: settings.gmailEmail, password: settings.gmailPassword, username });
      },

      logInAsGuestViaTopbar: function(nameOrObj, email?: string) {
        api.topbar.clickLogin();
        let name = nameOrObj;
        if (_.isObject(nameOrObj)) {
          assert(!email);
          name = nameOrObj.fullName;
          email = nameOrObj.emailAddress;
        }
        api.loginDialog.logInAsGuest(name, email);
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
            bodyMatchAfter?: String | boolean, resultInError?: boolean }) {
        api.forumButtons.clickCreateTopic();
        api.editor.editTitle(data.title);
        api.editor.editText(data.body);
        if (data.type) {
          api.editor.setTopicType(data.type);
        }
        browser.rememberCurrentUrl();
        api.editor.save();
        if (!data.resultInError) {
          browser.waitForNewUrl();
          if (data.matchAfter !== false && data.titleMatchAfter !== false) {
            browser.assertPageTitleMatches(data.titleMatchAfter || data.title);
          }
          if (data.matchAfter !== false && data.bodyMatchAfter !== false) {
            browser.assertPageBodyMatches(data.bodyMatchAfter || data.body);
          }
        }
        browser.waitUntilLoadingOverlayGone();
      },

      editPageBody: function(newText: string) {
        api.topic.clickEditOrigPost();
        api.editor.editText(newText);
        api.editor.save();
        browser.assertPageBodyMatches(newText);
      },

      editPostNr: function(postNr: PostNr, newText: string) {
        api.topic.clickEditoPostNr(postNr);
        api.editor.editText(newText);
        api.editor.save();
        browser.topic.assertPostTextMatches(postNr, newText);
      },

      replyToOrigPost: function(text: string, whichButton?: string) {
        api.topic.clickReplyToOrigPost(whichButton);
        api.editor.editText(text);
        api.editor.save();
      },

      replyToEmbeddingBlogPost: function(text: string) {
        browser.switchToEmbeddedCommentsIrame();
        api.topic.clickReplyToEmbeddingBlogPost();
        browser.switchToEmbeddedEditorIrame();
        api.editor.editText(text);
        api.editor.save();
        browser.switchToEmbeddedCommentsIrame();
      },

      addBottomComment: function(text: string) {
        api.topic.clickAddBottomComment();
        api.editor.editText(text);
        api.editor.save();
      },

      replyToPostNr: function(postNr: PostNr, text: string) {
        // Sometimes the click fails — maybe a sidebar opens, making the button move a bit? Or
        // the window scrolls, making the click miss? Or whatever. If the click misses the
        // button, most likely, the editor won't open. So, if after clicking, the editor
        // won't appear, then click again.
        api.topic.waitForPostNrVisible(postNr);
        browser.pause(50); // makes the first click more likely to succeed (without,
        // failed 2 times out of 4 at a place in unsubscribe.2browsers.test.ts — but with,
        // failed 2 times out of 20).
        for (let clickAttempt = 0; true; ++clickAttempt) {
          api.topic.clickReplyToPostNr(postNr);
          try {
            browser.waitForVisible('.esEdtr_textarea', 5000);
            break;
          }
          catch (ignore) {
            logMessage("When clicking the Reply button, the editor didn't open. Trying again");
            dieIf(clickAttempt === 3, "Couldn't click Reply and write a reply [EdE7FKAC2]");
          }
        }
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

  function setCheckbox(selector: string, checked: boolean) {
    // Sometimes, clicking this checkbox has no effect. Perhaps a sidebar appeared, which
    // caused the checkbox to move? so the click missed? Therefore, try many times.
    // Update, 2017-11: Look here, the click works, but the button changes state back again,
    // half a second after it was clicked (!):
    // (I don't see how this could be related to any slow http request... We haven't clicked
    // Save yet, no request sent.)
    //   #sendSummaryEmails is visible, should be checked: true
    //   #sendSummaryEmails is checked: false
    //   #sendSummaryEmails **click**
    //   #sendSummaryEmails is checked: true    <— the click worked, state changed
    //   #sendSummaryEmails is checked: true
    //   #sendSummaryEmails is checked: false   <— amazing, it does that by itself?
    //   #sendSummaryEmails is checked: false     (all this was running in an *invisible*
    //   #sendSummaryEmails is checked: false      browser, no real mouse interactions possible)
    // So need to loop, ... until it stops undoing the click? Really weird.
    //
    browser.waitForVisible(selector);
    let bugRetry = 0;
    const maxBugRetry = 2;
    for (; bugRetry <= maxBugRetry; ++bugRetry) {
      console.log(selector + ' is visible, should be checked: ' + checked);
      for (let i = 0; i < 99; ++i) {
        let isChecked = browser.isSelected(selector);
        console.log(selector + ' is checked: ' + isChecked);
        if (isChecked === checked)
          break;
        api.waitAndClick(selector);
        console.log(selector + ' **click**');
      }
      // Somehow once this function exited with isChecked !== isRequired. Race condition?
      // Let's find out:
      let isChecked = browser.isSelected(selector);
      console.log(selector + ' is checked: ' + isChecked);
      browser.pause(300);
      isChecked = browser.isSelected(selector);
      console.log(selector + ' is checked: ' + isChecked);
      browser.pause(400);
      isChecked = browser.isSelected(selector);
      /* maybe works better now? (many months later)
      console.log(selector + ' is checked: ' + isChecked);
      browser.pause(500);
      isChecked = browser.isSelected(selector);
      console.log(selector + ' is checked: ' + isChecked);
      browser.pause(600);
      isChecked = browser.isSelected(selector);
      console.log(selector + ' is checked: ' + isChecked);
      browser.pause(700);
      isChecked = browser.isSelected(selector);
      console.log(selector + ' is checked: ' + isChecked); */
      if (isChecked === checked)
        break;
      console.log("Checkbox refuses to change state. Clicking it again.");
    }
    assert(bugRetry <= maxBugRetry, "Couldn't set checkbox to checked = " + checked);
  }

  // backw compat, for now
  api['replies'] = api.topic;

  return api;
}

export = pagesFor;


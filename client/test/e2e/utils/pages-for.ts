/// <reference path="../../../../modules/definitely-typed/lodash/lodash.d.ts"/>
/// <reference path="../../../../modules/definitely-typed/node/node.d.ts"/>

import _ = require('lodash');
import assert = require('assert');
import logAndDie = require('./log-and-die');
var logUnusual = logAndDie.logUnusual, die = logAndDie.die, dieIf = logAndDie.dieIf;
var logMessage = logAndDie.logMessage;


// There might be many browsers, when using Webdriver.io's multiremote testing, so
// `browser` is an argument.
//
function pagesFor(browser) {
  var api = {

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
                            // create-site @facebook test
        browser.waitAndSetValue('input[type="text"]', forumTitle);
        browser.waitAndClick('#e2eDoCreateForum');
        var actualTitle = browser.waitAndGetVisibleText('h1.dw-p-ttl');
        assert.equal(actualTitle, forumTitle);
      },
    },


    topbar: {
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
      }
    },


    watchbar: {
      titleSelector: '.esWB_T_Title',

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
        browser.waitAndSetValue('#e2eEmail', data.email);
        browser.waitAndSetValue('#e2ePassword', data.password);
        browser.waitAndClick('#e2eSubmit');
        browser.waitForVisible('#e2eNeedVerifyEmailDialog');
      },

      loginWithPassword: function(data: { username: string, password: string }) {
        browser.waitAndSetValue('#e2eUsername', data.username);
        browser.waitAndSetValue('#e2ePassword', data.password);
        browser.waitAndClick('#e2eSubmit');
        browser.waitUntilModalGone();
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
      }
    },


    forumButtons: {
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
      waitUntilKnowsIsEmpty: function() {
        browser.waitForVisible('#e2eF_NoTopics');
      }
    },


    forumCategories: {

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

      setTopicTypePrivateChat: function() {
        browser.waitAndClick('.esTopicType_dropdown');
        browser.waitAndClick('#e2ePrivChatO');
        browser.waitUntilModalGone();
      },

      save: function() {
        browser.click('.e2eSaveBtn');
        browser.waitUntilLoadingOverlayGone();
      }
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


    adminArea: {
      waitAssertVisible: function() {
        browser.waitForVisible('h1');
        browser.assertTextMatches('h1', "Admin Area");
      },

      goToLoginSettings: function(siteIdOrigin) {
        browser.go(siteIdOrigin + '/-/admin/settings/login');
      }
    },

    complex: {
      loginWithPasswordViaTopbar: function(username: string, password: string) {
        api.topbar.clickLogin();
        api.loginDialog.loginWithPassword({ username: username, password: password });
      },

      loginAsGuestViaTopbar: function(name: string, email?: string) {
        api.topbar.clickLogin();
        api.loginDialog.loginAsGuest(name, email);
      },

      createAndSaveTopic: function(data: { title: string, body: string }) {
        api.forumButtons.clickCreateTopic();
        api.editor.editTitle(data.title);
        api.editor.editText(data.body);
        browser.rememberCurrentUrl();
        api.editor.save();
        browser.waitForNewUrl();
        browser.assertPageTitleMatches(data.title);
        browser.assertPageBodyMatches(data.body);
      },

      createChatChannelViaWatchbar: function(
            data: { name: string, purpose: string, public_?: boolean }) {
        api.watchbar.clickCreateChat();
        api.editor.editTitle(data.name);
        api.editor.editText(data.purpose);
        if (data.public_ === false) {
          api.editor.setTopicTypePrivateChat();
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


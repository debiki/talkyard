/// <reference path="../../../../modules/definitely-typed/lodash/lodash.d.ts"/>
/// <reference path="../../../../modules/definitely-typed/node/node.d.ts"/>

import _ = require('lodash');
import assert = require('assert');
import logAndDie = require('./log-and-die');
var logUnusual = logAndDie.logUnusual, die = logAndDie.die, dieIf = logAndDie.dieIf;
var logMessage = logAndDie.logMessage;

declare var browser: any;


var pages: any = {
  createSite: {},
  createSomething: {},
  loginDialog: {},

};


pages.createSite.fillInFieldsAndSubmit = function(data) {
  browser.waitAndSetValue('#e2eEmail', data.email);
  browser.setValue('#dwLocalHostname', data.localHostname);
  browser.click('#e2eAcceptTerms');
  browser.click('input[type=submit]');
  browser.waitForVisible('#e2eLogin');
  assert.equal(data.origin, browser.origin());
};


pages.createSomething.createForum = function(forumTitle) {
  browser.waitAndClick('#e2eCreateForum');
  browser.setValue('input[type="text"]', forumTitle);
  browser.click('#e2eDoCreateForum');
  var actualTitle = browser.waitAndGetVisibleText('h1.dw-p-ttl');
  assert.equal(actualTitle, forumTitle);
};


pages.loginDialog.createPasswordAccount = function(data) {
  browser.waitAndClick('#e2eCreateNewAccount');
  browser.waitAndSetValue('#e2eFullName', data.fullName);
  browser.waitAndSetValue('#e2eUsername', data.username);
  browser.waitAndSetValue('#e2eEmail', data.email);
  browser.waitAndSetValue('#e2ePassword', data.password);
  browser.waitAndClick('#e2eSubmit');
  browser.waitForVisible('#e2eNeedVerifyEmailDialog');
};


pages.loginDialog.createGmailAccount = function(data) {
  pages.loginDialog.loginWithGmail(data);
  // This should be the first time we login with Gmail at this site, so we'll be asked
  // to choose a username.
  browser.waitAndSetValue('#e2eUsername', data.username);
  browser.waitAndClick('#e2eSubmit');
};


pages.loginDialog.loginWithGmail = function(data) {
  browser.waitAndClick('#e2eLoginGoogle');

  // In Google's login popup window:
  browser.swithToOtherTabOrWindow();
  browser.waitAndSetValue('#Email', data.email);
  browser.click('#next');
  browser.waitAndSetValue('#Passwd', data.password);
  browser.click('#signIn');
  browser.waitForEnabled('#submit_approve_access');
  browser.click('#submit_approve_access');

  browser.switchBackToFirstTabOrWindow();
};


pages.loginDialog.createFacebookAccount = function(data) {
  pages.loginDialog.loginWithFacebook(data);
  // This should be the first time we login with Facebook at this site, so we'll be asked
  // to choose a username.
  browser.waitAndSetValue('#e2eUsername', data.username);
  browser.waitAndClick('#e2eSubmit');
};


pages.loginDialog.loginWithFacebook = function(data) {
  browser.waitAndClick('#e2eLoginFacebook');

  // In Facebook's login popup window:
  browser.swithToOtherTabOrWindow();
  browser.waitAndSetValue('#email', data.email);
  browser.waitAndSetValue('#pass', data.password);
  browser.waitAndClick('input[type=submit]');
  // Facebook somehow auto accepts the confirmation dialog, perhaps because
  // I'm using a Facebook API test user. So need not do this:
  //b.waitForVisible('[name=__CONFIRM__]');
  //b.click('[name=__CONFIRM__]');

  browser.switchBackToFirstTabOrWindow();
};


export = pages;


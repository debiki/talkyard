var assert = require('assert');
var server = require('../utils/server');
var utils = require('../utils/utils');
var pages = require('../utils/pages');
var settings = require('../utils/settings');
var logAndDie = require('../utils/log-and-die');
var logUnusual = logAndDie.logUnusual, die = logAndDie.die, dieIf = logAndDie.dieIf;
var logMessage = logAndDie.logMessage;

describe('/-/create-site  @createsite', function() {

  function createPasswordTestData() {
    var testId = utils.generateTestId();
    var localHostname = settings.testLocalHostnamePrefix + 'create-site-' + testId;
    return {
      testId: testId,
      localHostname: localHostname,
      origin: utils.makeSiteOrigin(localHostname),
      originRegexEscaped: utils.makeSiteOriginRegexEscaped(localHostname),

      fullName: 'E2E Test ' + testId,
      email: settings.testEmailAddressPrefix + testId + '@example.com',
      username: 'e2e_test__' + testId,
      password: 'pub5KFV2FY8C',
    }
  }

  it('can create a new site as a Password user  @login @password', function() {
    var data = createPasswordTestData();
    browser.goTo(utils.makeCreateSiteWithFakeIpUrl());
    pages.createSite.fillInFieldsAndSubmit(data);
    browser.click('#e2eLogin');
    pages.loginDialog.createPasswordAccount(data);
    var email = server.getLastEmailSenTo(data.email);
    var link = utils.findFirstLinkToUrlIn(
        data.origin + '/-/login-password-confirm-email', email.bodyHtmlText);
    browser.goTo(link);
    browser.waitAndClick('#e2eContinue');
    pages.createSomething.createForum("Password Forum Title");
  });

  it('can create a new site as a Gmail user  @login @gmail', function() {
    var data = createPasswordTestData();
    data.email = settings.gmailEmail;
    data.password = settings.gmailPassword;
    browser.goTo(utils.makeCreateSiteWithFakeIpUrl());
    pages.createSite.fillInFieldsAndSubmit(data);
    browser.click('#e2eLogin');
    pages.loginDialog.createGmailAccount(data);
    pages.createSomething.createForum("Gmail Forum Title");
  });

  it('can create a new site as a Facebook user  @login @facebook', function() {
    var data = createPasswordTestData();
    data.email = settings.facebookAdminEmail;
    data.password = settings.facebookAdminPassword;
    browser.goTo(utils.makeCreateSiteWithFakeIpUrl());
    pages.createSite.fillInFieldsAndSubmit(data);
    browser.click('#e2eLogin');
    pages.loginDialog.createFacebookAccount(data);
    pages.createSomething.createForum("Gmail Forum Title");
  });

  /*
  it('can create a new site as a Gmail user  @login @gmail', function() {
    var data = createTestData();
    browser.url(utils.makeCreateSiteWithFakeIpUrl());
    pages.createSite.fillInFieldsAndSubmit(data);
  });

  it('can create a new site as a Facebook user  @login @facebook', function() {
    var data = createTestData();
    browser.url(utils.makeCreateSiteWithFakeIpUrl());
    pages.createSite.fillInFieldsAndSubmit(data);
  });
  */

});


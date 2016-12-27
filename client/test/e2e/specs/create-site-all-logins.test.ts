/// <reference path="../../../../modules/definitely-typed/lodash/lodash.d.ts"/>
/// <reference path="../../../../modules/definitely-typed/node/node.d.ts"/>
/// <reference path="../../../../modules/definitely-typed/mocha/mocha.d.ts"/>

import _ = require('lodash');
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import pages = require('../utils/pages');
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import logAndDie = require('../utils/log-and-die');
var logUnusual = logAndDie.logUnusual, die = logAndDie.die, dieIf = logAndDie.dieIf;
var logMessage = logAndDie.logMessage;

declare var browser: any;


describe('/-/create-site  @createsite', function() {

  function createPasswordTestData() {
    var testId = utils.generateTestId();
    var localHostname = settings.localHostname ||
                        settings.testLocalHostnamePrefix + 'create-site-' + testId;
    return {
      testId: testId,
      localHostname: localHostname,
      origin: utils.makeSiteOrigin(localHostname),
      originRegexEscaped: utils.makeSiteOriginRegexEscaped(localHostname),
      orgName: "E2E Org Name",
      fullName: 'E2E Test ' + testId,
      email: settings.testEmailAddressPrefix + testId + '@example.com',
      username: 'e2e_test__' + testId,
      password: 'pub5KFV2FY8C',
    }
  }

  it('can create a new site as a Password user  @login @password', function() {
    browser = _.assign(browser, pagesFor(browser));
    browser.perhapsDebugBefore();
    var data = createPasswordTestData();
    browser.go(utils.makeCreateSiteWithFakeIpUrl());
    pages.createSite.fillInFieldsAndSubmit(data);
    browser.click('#e2eLogin');
    pages.loginDialog.createPasswordAccount(data);
    var siteId = pages.getSiteId();
    var email = server.getLastEmailSenTo(siteId, data.email);
    var link = utils.findFirstLinkToUrlIn(
        data.origin + '/-/login-password-confirm-email', email.bodyHtmlText);
    browser.go(link);
    browser.waitAndClick('#e2eContinue');
    pages.createSomething.createForum("Password Forum Title");

    // Done with create site stuff. But let's test a little bit more, so we know the forum can
    // actually be used, once it's been created: Edit forum title and post a topic.

    // --- Edit title
    pages.pageTitle.clickEdit();
    pages.pageTitle.editTitle("Pwd Frm Edtd");
    pages.pageTitle.save();
    browser.assertPageTitleMatches(/Pwd Frm Edtd/);

    // --- Post a topic.  (Later: break out this as a page object)
    browser.click('#e2eCreateSth');
    browser.waitAndSetValue('.esEdtr_titleEtc_title', "New tpc ttl");
    browser.setValue('textarea', "New tpc txt");
    browser.rememberCurrentUrl();
    browser.click('.e2eSaveBtn');
    browser.waitForNewUrl();
    browser.assertTextMatches('h1', /New tpc ttl/);
    browser.assertTextMatches('#post-1', /New tpc txt/);
    browser.perhapsDebug();
  });

  if (!settings.include3rdPartyDependentTests)
    return;

  it('can create a new site as a Gmail user  @login @gmail @google', function() {
    var data = createPasswordTestData();
    data.email = settings.gmailEmail;
    data.password = settings.gmailPassword;
    browser.go(utils.makeCreateSiteWithFakeIpUrl());
    browser.disableRateLimits(); // there're signup rate limits
    pages.createSite.fillInFieldsAndSubmit(data);
    browser.click('#e2eLogin');
    pages.loginDialog.createGmailAccount(data);
    pages.createSomething.createForum("Gmail Forum Title");
    browser.perhapsDebug();
  });

  it('can create a new site as a Facebook user  @login @facebook', function() {
    var data = createPasswordTestData();
    data.email = settings.facebookAdminEmail;
    data.password = settings.facebookAdminPassword;
    browser.go(utils.makeCreateSiteWithFakeIpUrl());
    browser.disableRateLimits(); // there're signup rate limits
    pages.createSite.fillInFieldsAndSubmit(data);
    browser.click('#e2eLogin');
    pages.loginDialog.createFacebookAccount(data);
    pages.createSomething.createForum("Facebook Forum Title");
    browser.perhapsDebug();
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


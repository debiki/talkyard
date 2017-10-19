/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import pages = require('../utils/pages');
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import make = require('../utils/make');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

declare let browser: any;
declare let browserA: any;
declare let browserB: any;

let everyonesBrowsers;
let owen;
let owensBrowser;
let maria;
let mariasBrowser;
let michael;
let michaelsBrowser;
let strangersBrowser;

let idAddress: IdAddress;
let siteId: any;

const forumTitle = "Summary Emails Forum";
const topicOneEveryone = "topicOneEveryone";
let topicOneEveryoneUrl: string;

const topicTwoToSome = "topicTwoToSome";
let topicTwoToSomeUrl: string;

const topicThreeToOwen = "topicThreeToOwen";
let topicThreeToOwenUrl: string;

const topicFourToMaria = "topicFourToMaria";
let topicFourToMariaUrl: string;

const topicFiveMariaMonth = "topicFiveMariaAfterOneMonth";
let topicFiveMariaMonthUrl: string;

const lastTopicMichael = "lastTopicMichael";
let lastTopicMichaelUrl: string;

describe("summary emails", () => {

  it("initialize people", () => {
    browser.perhapsDebugBefore();
    everyonesBrowsers = _.assign(browser, pagesFor(browser));

    owensBrowser = _.assign(browserA, pagesFor(browserA));

    mariasBrowser = _.assign(browserB, pagesFor(browserB));
    michaelsBrowser = mariasBrowser;
    strangersBrowser = mariasBrowser;

    owen = make.memberOwenOwner();
    maria = make.memberMaria();
    michael = make.memberMichael();
  });


  function createPasswordTestData() {
    const testId = utils.generateTestId();
    const localHostname = settings.localHostname ||
        settings.testLocalHostnamePrefix + 'create-site-' + testId;
    return {
      testId: testId,
      embeddingUrl: 'http://test--embcmts01.localhost:8080/',
      origin: 'http://comments-for-localhost8080.localhost',
      //originRegexEscaped: utils.makeSiteOriginRegexEscaped(localHostname),
      orgName: "E2E Org Name",
      fullName: 'E2E Test ' + testId,
      email: settings.testEmailAddressPrefix + testId + '@example.com',
      // Prefix the number with 'z' because '..._<number>' is reserved. [7FLA3G0L]
      username: 'e2e_test__z' + testId,
      password: 'pub5KFV2FY8C',
    }
  }

  it('can create an embedded comments site as a Password user  @login @password', () => {
    owensBrowser.perhapsDebugBefore();
    const data = createPasswordTestData();
    owensBrowser.go(utils.makeCreateEmbeddedSiteWithFakeIpUrl());
    owensBrowser.disableRateLimits();
    owensBrowser.createSite.fillInFieldsAndSubmit(data);
    // New site; disable rate limits here too.
    owensBrowser.disableRateLimits();
    owensBrowser.click('#e2eLogin');
    owensBrowser.loginDialog.createPasswordAccount(data);
    const siteId = owensBrowser.getSiteId();
    const email = server.getLastEmailSenTo(siteId, data.email);
    const link = utils.findFirstLinkToUrlIn(
        data.origin + '/-/login-password-confirm-email', email.bodyHtmlText);
    owensBrowser.go(link);
    owensBrowser.waitAndClick('#e2eContinue');
    owensBrowser.debug();
  });


  it("Done", () => {
    everyonesBrowsers.perhapsDebug();
  });

});


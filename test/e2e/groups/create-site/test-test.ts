var tests = {
  '@tags': ['TestTag'],
  'open create site page': function(b) {
    var globals = b.globals;

    var testId = globals.generateTestId();
    var localHostname = globals.testLocalHostnamePrefix + 'create-site-' + testId;
    var origin = globals.makeSiteOrigin(localHostname);
    var originRegexEscaped = globals.makeSiteOriginRegexEscaped(localHostname);
    var forumTitle = "The Created Forum";

    var fullName = 'E2E Test ' + testId;
    var email = globals.testEmailAddressPrefix + testId + '@example.com';
    var username = 'e2e_test__' + testId;
    var password = 'pub5KFV2FY8C';

    // Use different ips or the server will complain that we've created too many sites.
    function randomIpPart() { return '.' + Math.floor(Math.random() * 256); }
    var ip = '0' + randomIpPart() + randomIpPart() + randomIpPart();

    b.url(globals.mainSiteOrigin + '/-/create-site?fakeIp=' + ip +
        '&e2eTestPassword=' + globals.e2eTestPassword + '&testSiteOkDelete=true');

    b.waitAndSetValue('#e2eEmail', email);
    b.setValue('#dwLocalHostname', localHostname);
    b.click('#e2eAcceptTerms');
    b.click('input[type=submit]');

    b.waitForElementVisible('#e2eLogin');
    b.urlOrigin(actualOrigin => {
      b.assert.equal(origin, actualOrigin);
    });

    b.click('#e2eLogin');
    b.waitAndClick('#e2eCreateNewAccount');
    b.waitAndSetValue('#e2eFullName', fullName);
    b.waitAndSetValue('#e2eUsername', username);
    b.waitAndSetValue('#e2eEmail', email);
    b.waitAndSetValue('#e2ePassword', password);
    b.pause(900); // Submit not yet enabled. COULD make waitAndClick wait until enabled.
    b.waitAndClick('#e2eSubmit');
    b.waitForElementVisible('#e2eNeedVerifyEmailDialog');

    b.get(origin + '/-/last-e2e-test-email?sentTo=' + email, (response) => {
      var responseObj = JSON.parse(response.body);
      var regexString = originRegexEscaped + '\\/[^"]+';
      var matches = responseObj.bodyHtmlText.match(new RegExp(regexString));
      if (!matches) {
        b.assert.fail(responseObj.bodyHtmlText, regexString,
          'No next-page-link regex match in email');
      }
      else {
        b.url(matches[0]);
      }
    });

    b.waitAndClick('#e2eContinue');
    b.waitAndClick('#e2eCreateForum');
    b.setValue('input[type="text"]', forumTitle);
    b.click('#e2eDoCreateForum');
    b.waitForElementVisible('.dw-p-ttl');
    b.assert.containsText('.dw-p-ttl', forumTitle);
    b.pause();
    b.end();
  },
};

export = tests;
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list

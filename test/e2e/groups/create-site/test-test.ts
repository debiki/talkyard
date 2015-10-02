var mainDomain = 'localhost:9000'
var scheme = 'http'
var createSiteOrigin = 'http://localhost:9000'
var timeout = 60000 * 1000;
var testId = (new Date()).getTime().toString().slice(3, 10);

var tests = {
  '@tags': ['TestTag'],
  'open create site page': function(b) {

    var fullName = 'E2E Test ' + testId;
    var email = 'e2e-test-' + testId + '@example.com';
    var username = 'e2e_test_' + testId;
    var password = 'pub5KFV2FY8C';
    var localHostname = 'e2e-test--create-site-' + testId;
    var origin = scheme + '://' + localHostname + '.' + mainDomain;
    var originRegexEscaped = scheme + ':\\/\\/' + localHostname + '.' + mainDomain;
    var forumTitle = "The Created Forum";

    // Use different ips or the server will complain that we've created too many sites.
    function randomIpPart() { return '.' + Math.floor(Math.random() * 256); }
    var ip = '0' + randomIpPart() + randomIpPart() + randomIpPart();

    b.url(createSiteOrigin + '/-/create-site?fakeIp=' + ip + '&testSiteOkDelete=true');
    b.waitAndSetValue('#e2eEmail', timeout, email);
    b.setValue('#dwLocalHostname', localHostname);
    b.click('#e2eAcceptTerms');
    b.click('input[type=submit]');


    b.waitAndClick('#e2eLogin', timeout);
    b.waitAndClick('#e2eCreateNewAccount', timeout);
    b.waitAndSetValue('#e2eFullName', timeout, fullName);
    b.waitAndSetValue('#e2eUsername', timeout, username);
    b.waitAndSetValue('#e2eEmail', timeout, email);
    b.waitAndSetValue('#e2ePassword', timeout, password);
    b.pause(900); // Submit not yet enabled. COULD make waitAndClick wait until enabled.
    b.waitAndClick('#e2eSubmit', timeout);
    b.waitForElementVisible('#e2eNeedVerifyEmailDialog', timeout);

    b.get(origin + '/-/last-e2e-test-email?sentTo=' + email, (response) => {
      var responseObj = JSON.parse(response.body);
      var regexString = originRegexEscaped + '\\/[^"]+';
      console.log('rx: ' + regexString + '  RSP: ' + JSON.stringify(responseObj));
      var matches = responseObj.bodyHtmlText.match(new RegExp(regexString));
      if (!matches) {
        console.error('No match in: ' + response.bodyHtmlText);
      }
      else {
        console.log('Match: ' + matches[0]);
        b.url(matches[0]);
      }
    });

    b.waitAndClick('#e2eContinue', timeout);
    b.waitAndClick('#e2eCreateForum', timeout);
    b.setValue('input[type="text"]', forumTitle);
    b.click('#e2eDoCreateForum');
    b.waitForElementVisible('.dw-p-ttl', timeout);
    b.assert.containsText('.dw-p-ttl', forumTitle);
    b.end();
  },
};

export = tests;
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list

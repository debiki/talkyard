var tests = {
  '@tags': ['CreateSite', 'Facebook'],
  'create new site with a forum, Facebook user': function(b) {
    // TODO dedupl

    var globals = b.globals;
    if (!globals.facebookAdminEmail) {
      b.end();
      return;
    }

    var testId = globals.generateTestId();
    var localHostname = globals.testLocalHostnamePrefix + 'create-site-' + testId;
    var origin = globals.makeSiteOrigin(localHostname);
    var originRegexEscaped = globals.makeSiteOriginRegexEscaped(localHostname);
    var forumTitle = "The Created Forum";

    var fullName = 'E2E Test ' + testId;
    var email = globals.facebookAdminEmail;
    var username = 'e2e_test__fbadmin';
    var password = globals.facebookAdminPassword;

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

    b.waitUntilEnabled('#e2eLogin');
    b.click('#e2eLogin');
    b.waitAndClick('#e2eLoginFacebook');

    // In Facebook's login popup window:
    b.swithToOtherWindow();
    b.waitAndSetValue('#email', email);
    b.waitAndSetValue('#pass', password); // argh! Prints the password on the console. See: https://github.com/nightwatchjs/nightwatch/issues/758 "Don't print passwords: can I tell setValue() to be silent? ..."
    b.perform(() => { console.log("SATANERR"); });
    b.click('input[type=submit]');
    // Facebook somehow auto accepts the confirmation dialog, perhaps because
    // I'm using a Facebook API test user. So need not do this:
    //b.waitForElementVisible('[name=__CONFIRM__]');
    //b.click('[name=__CONFIRM__]');
    b.switchBackToFirstWindow();

    b.waitAndSetValue('#e2eUsername', username);
    b.waitAndClick('#e2eSubmit');

    b.waitAndClick('#e2eCreateForum');
    b.setValue('input[type="text"]', forumTitle);
    b.click('#e2eDoCreateForum');
    b.waitForElementVisible('.dw-p-ttl');
    b.assert.containsText('.dw-p-ttl', forumTitle);
    b.endOrPause();
  }
};

export = tests;
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list

/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('../utils/ty-assert');
// import fs = require('fs');  EMBCMTS
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/pages-for';
import settings = require('../utils/settings');
import lad = require('../utils/log-and-die');
import c = require('../test-constants');


let everyonesBrowsers: TyAllE2eTestBrowsers;
let richBrowserA: TyE2eTestBrowser;
let richBrowserB: TyE2eTestBrowser;

let owen: Member;
let owen_brA: TyE2eTestBrowser;
let memah: Member;
let memah_brB: TyE2eTestBrowser;
let michael: Member;
let michael_brB: TyE2eTestBrowser;
let maria: Member;
let maria_brB: TyE2eTestBrowser;
let maja: Member;
let maja_brB: TyE2eTestBrowser;

//let merida_brB: TyE2eTestBrowser;
let azure_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoCatsTestForum;


const localHostname = 'e2e-test-azure-oidc'; // settings.azureTalkyardLocalHostname;


export function addOidcAzureTestSteps(variants: { loginRequired: Bo }) {

  // After logout
  const waitForLoginDialog = variants.loginRequired;
  const afterLogoutPath = variants.loginRequired ? '/' : '/latest';

  if (!settings.include3rdPartyDependentTests) {
    console.log("Skipping Azure OIDC spec; no 3rd party login credentials specified.");
    return;
  }

  if (!settings.secure) {
    console.log("Skipping Azure OIDC spec; only works with HTTPS");
    return;
  }

  it(`construct site`, () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "Some E2E Test",
      members: ['owen', 'memah', 'maria', 'maja', 'michael'],
    });

    builder.getSite().meta.localHostname = localHostname;

    everyonesBrowsers = new TyE2eTestBrowser(allWdioBrowsers);
    richBrowserA = new TyE2eTestBrowser(wdioBrowserA);
    richBrowserB = new TyE2eTestBrowser(wdioBrowserB);

    // Azure user 01
    owen = forum.members.owen;
    owen.emailAddress = settings.azureUser01UsernameAndEmail;
    owen_brA = richBrowserA;

    // Azure user 03
    memah = forum.members.memah;
    memah.emailAddress = settings.azureUser03UsernameAndEmail;
    memah_brB = richBrowserB;

    // Azure user 06
    michael = forum.members.michael;
    michael.emailAddress = settings.azureUser06Email;
    michael_brB = richBrowserB;

    // Azure user 12
    maria = forum.members.maria;
    maria.emailAddress = settings.azureUser12EmailWrongDomain;
    maria_brB = richBrowserB;

    // Azure user 14
    maja = forum.members.maja;
    maja.emailAddress = settings.azureUser14EmailWrongDomain;
    maja_brB = richBrowserB;

    // Various Azure users with no pre-existing Ty account.
    azure_brB = richBrowserB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`import site`, () => {
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });


  it(`Owen logs in to admin area, using password, OIDC not yet configured`, () => {
    owen_brA.adminArea.settings.login.goHere(site.origin, { loginAs: owen });
  });


  if (variants.loginRequired) {
    it(`Owen makes the site login-required`, () => {
      owen_brA.adminArea.settings.login.setLoginRequired(true);
    });
  }


  it(`Owen enbles OIDC`, () => {
    owen_brA.adminArea.settings.login.setEnableOidcDontSave(true);
  });


  it(`... configures an Azure AD ID provider, saves the config`, () => {
    owen_brA.adminArea.settings.login.configureIdps(`[{
  "protocol": "oidc",
  "alias": "azure_test_alias",
  "enabled": true,
  "displayName": "Azure AD Test",
  "description": "Azure AD login test",
  "guiOrder": null,
  "confFileIdpId": null,
  "id": 1,
  "trustVerifiedEmail": true,
  "emailVerifiedDomains": "${settings.azureEmailVerifiedDomains}",
  "linkAccountNoLogin": false,
  "syncMode": 1,
  "oauAuthorizationUrl": "${settings.azureOauAuthorizationUrl}",
  "oauAuthReqScope": "openid",
  "oauAuthReqClaims": null,
  "oauAuthReqHostedDomain": null,
  "oauAccessTokenUrl": "${settings.azureOauAccessTokenUrl}",
  "oauAccessTokenAuthMethod": null,
  "oauClientId": "${settings.azureOidcClientId}",
  "oauClientSecret": "${settings.azureOidcClientSecret}",
  "oauIssuer": "https://what.eve.r.example.com",
  "oidcUserInfoUrl": "https://graph.microsoft.com/oidc/userinfo",
  "oidcUserInfoFieldsMap": null,
  "oidcUserinfoReqSendUserIp": null,
  "oidcLogoutUrl": null
}]
`);
  });



  it(`... saves the settings too`, () => {
    // Maybe bad UX to require 2 clicks, fix later [nice_oidc_conf_ux].
    owen_brA.adminArea.settings.clickSaveAll();
  });


  it(`Owen now tries to enable OIDC SSO   TyTOIDCSSO`, () => {
    owen_brA.adminArea.settings.login.setOnlyOidc(true);
  });
  it(`... tries to save`, () => {
    owen_brA.adminArea.settings.clickSaveAll({ willFail: true });
  });
  it(`... but not allowed — he hasn't yet logged in with OIDC,
              and might lock himself out`, () => {
    owen_brA.serverErrorDialog.waitAndAssertTextMatches('TyEADM0LGI2_');
    owen_brA.serverErrorDialog.close();
  });



  it(`Owen logs out`, () => {
    owen_brA.topbar.clickLogout({ waitForLoginDialog });
    // Redirects to /   [.6022563]
    assert.eq(owen_brA.urlPath(), afterLogoutPath);
  });
  it(`... logs in via Azure AD OIDC`, () => {
    if (!variants.loginRequired) {
      // No login required — Owen needs to click Log In.
      // This tests linking accounts, from in a login popup.
      owen_brA.topbar.clickLogin();
    }
    else {
      // Login dialog already visible.
      // This tests linking accounts, from in a "full screen" main win login.
    }
    owen_brA.loginDialog.clickLoginWithOidcAzureAd();
    owen_brA.loginDialog.loginWithOidcAzureAd({
          email: settings.azureUser01UsernameAndEmail,
          password: settings.azureUser01Password,
          fullScreenLogin: variants.loginRequired,
          stayInPopup: !variants.loginRequired });
  });
  it(`... since in Azure he has the same email address, he can link his Azure account
            to his Talkyard account  TyTOIDCLNVERACT`, () => {
    // Check that email addr and username etc is correct  TyTLNIDP2TY043.
    owen_brA.loginDialog.checkLinkAccountsTextOk({
      matchingEmail: settings.azureUser01UsernameAndEmail,
      talkyardUsername: owen.username,
      azureFullName: settings.azureUser01FullName,
      idpName: "Azure AD Test",
    });
  });
  it(`... he links the accounts`, () => {
    owen_brA.loginDialog.clickYesLinkAccounts();
  });

  it(`... clicks Log In Again`, () => {
    owen_brA.loginDialog.clickLogInAgain({
          isInPopupThatWillClose: !variants.loginRequired });
  });

  if (!variants.loginRequired) {
    it(`... the login popup closes`, () => {
      owen_brA.switchBackToFirstTabOrWindow();
    });
  }

  it(`... thereafter he's logged in as Owen again`, () => {
    owen_brA.topbar.assertMyUsernameMatches(owen.username);
  });
  it(`... he jumps to the admin area — was redirected to '/', at logout`, () => {
    // Owen got redirected to / above.  [.6022563]
    owen_brA.adminArea.settings.login.goHere(site.origin);
  });




  // IDP email verified, no Ty acct
  addSignUpViaAzureTestSteps({
        br: () => azure_brB,
        azureUsername: settings.azureUser02UsernameAndEmailDashDot,
        azurePassword: settings.azureUser02Password,
        azureEmail: settings.azureUser02UsernameAndEmailDashDot,
        azureFullName: settings.azureUser02FullName,
        newTalkyardUsername: 'azureUser02' });


  // IDP email verified, Ty acct w verified email
  addLoginAndLinkAzureAccountTestSteps({
        br: () => memah_brB,
        resetBrowser: true,
        who: "Memah",
        tyUser: () => memah,
        azureUsername: settings.azureUser03UsernameAndEmail,
        azurePassword: settings.azureUser03Password });


  // TESTS_MISSING Cancel linking


  // TESTS_MISSING IDP email verified, Ty acct w *un*verified email  TyTE2EIDPTYEMLUNVER


  // IDP email *un*verified, no Ty acct
  it(`Azure user  tyaz13  with no Ty account arrives`, () => {});
  addSignUpViaAzureTestSteps({
        br: () => azure_brB,
        resetBrowser: true,
        azureUsername: settings.azureUser13Username,
        azurePassword: settings.azureUser13Password,
        azureEmail: settings.azureUser13EmailWrongDomain,
        azureEmailVerified: false,
        azureFullName: settings.azureUser13FullName,
        newTalkyardUsername: 'azureUser13' });


  // IDP email *un*verified, Ty acct w verified email
  it(`Maria arrives; she has a Ty account already and Azure acct 12`, () => {});
  addLoginAndLinkAzureAccountTestSteps({
        br: () => maria_brB,
        resetBrowser: true,
        who: "Maria",
        tyUser: () => maria,
        azureUsername: settings.azureUser12Username,
        azurePassword: settings.azureUser12Password,
        azureEmail: settings.azureUser12EmailWrongDomain,
        azureEmailVerified: false });


  // TESTS_MISSING IDP email *un*verified, Ty acct w *un*verified email  TyTE2EIDPTYEMLUNVER




  it(`Owen enables OIDC SSO — works now, when has tested login   TyTOIDCSSO`, () => {
    owen_brA.adminArea.settings.login.setOnlyOidc(true);
  });
  it(`... and save, no problems`, () => {
    owen_brA.adminArea.settings.clickSaveAll();
  });

  // Verify that login works for an account created before SSO got enabled.
  // (Maybe an "unnecessary" test but ... Thinking in that way, all tests are :-))
  it(`Owen logs out`, () => {
    owen_brA.topbar.clickLogout({ waitForLoginDialog });
  });
  it(`... can log in again, also now with SSO enabled`, () => {
    if (!variants.loginRequired) {
      owen_brA.topbar.clickLogin();
      // Will get redirected and logged in directly. [insta_sso_redir]
    }
    else {
      owen_brA.loginDialog.clickSingleSignOnButton();
    }
  });
  it(`... he gets logged in directly — accounts already linked`, () => {
    owen_brA.topbar.assertMyUsernameMatches(owen.username);
  });



  // IDP email verified, no Ty acct
  it(`Azure user  tyaz04  arrives, has no Ty account`, () => {});
  addSignUpViaAzureTestSteps({
        br: () => azure_brB,
        resetBrowser: true,
        azureUsername: settings.azureUser04Username,
        azurePassword: settings.azureUser04Password,
        newTalkyardUsername: 'azureUser04',
        isSingleSignOn: true });


  // IDP email verified, Ty acct w verified email
  it(`Michael arrives; he has a Ty account already, and Azure acct 06`, () => {});
  addLoginAndLinkAzureAccountTestSteps({
        br: () => michael_brB,
        resetBrowser: true,
        who: "Michael",
        tyUser: () => michael,
        azureUsername: settings.azureUser06Username,
        azurePassword: settings.azureUser06Password,
        azureEmail: settings.azureUser06Email,
        isSingleSignOn: true });


  // TESTS_MISSING  IDP email verified, Ty acct w *un*verified email  TyTE2EIDPTYEMLUNVER


  // IDP email *un*verified, no Ty acct
  it(`Azure user  tyaz11  with no Ty account arrives`, () => {});
  addSignUpViaAzureTestSteps({
        br: () => azure_brB,
        resetBrowser: true,
        azureUsername: settings.azureUser11Username,
        azurePassword: settings.azureUser11Password,
        azureEmail: settings.azureUser11EmailWrongDomain,
        azureEmailVerified: false,
        azureFullName: settings.azureUser11FullName,
        newTalkyardUsername: 'azureUser11',
        isSingleSignOn: true });


  // IDP email *un*verified, Ty acct w verified email
  it(`Maja arrives; she has a Ty account already, and Azure acct 14`, () => {});
  addLoginAndLinkAzureAccountTestSteps({
        br: () => maja_brB,
        resetBrowser: true,
        who: "Maja",
        tyUser: () => maja,
        azureUsername: settings.azureUser14Username,
        azurePassword: settings.azureUser14Password,
        azureEmail: settings.azureUser14EmailWrongDomain,
        azureEmailVerified: false,
        isSingleSignOn: true });


  // TESTS_MISSING  IDP email *un*verified, Ty acct w *un*verified email  TyTE2EIDPTYEMLUNVER



  function addStartAzureLoginSteps(ps: {
        br: () => TyE2eTestBrowser,
        isSingleSignOn: Bo }) {

    if (!variants.loginRequired) {
      it(`... clicks Log In`, () => {
        ps.br().topbar.clickLogin();
      });
      if (ps.isSingleSignOn) {
        // auto redirected
      }
      else {
        it(`... picks Azure`, () => {
          ps.br().loginDialog.clickLoginWithOidcAzureAd();
        });
      }
    }
    else if (ps.isSingleSignOn) {
      it(`... clicks the Single Sign-On button`, () => {
        ps.br().loginDialog.clickSingleSignOnButton();
      });
    }
    else {
      it(`... picks Azure`, () => {
        ps.br().loginDialog.clickLoginWithOidcAzureAd();
      });
    }
  }


  function addSignUpViaAzureTestSteps(ps: {
        br: () => TyE2eTestBrowser,
        azureUsername: St,
        azurePassword: St,
        azureFullName?: St,
        azureEmail?: St,
        azureEmailVerified?: false,
        newTalkyardUsername: St,
        isSingleSignOn?: Bo,
        resetBrowser?: Bo }) {

    it(`Azure user ${ps.azureUsername} arrives`, () => {
      // Delete cookies so won't be already logged in as the previous Azure user.
      if (ps.resetBrowser) {
        ps.br().reloadSession();
      }
      ps.br().go2(site.origin);
    });

    addStartAzureLoginSteps({ br: ps.br, isSingleSignOn: ps.isSingleSignOn });

    it(`... logs in via Azure — hen has no Ty account, so one will get created`, () => {
      ps.br().loginDialog.loginWithOidcAzureAd({
            email: ps.azureUsername,
            password: ps.azurePassword,
            fullScreenLogin: variants.loginRequired });
    });

    if (ps.azureFullName) {
      it(`... the full name from Azure is: '${ps.azureFullName}'`, () => {
        ps.br().assertValueIs('#e2eFullName', ps.azureFullName);
      });
    }
    if (ps.azureEmail) {
      it(`... the email from Azure is: '${ps.azureEmail}'`, () => {
        ps.br().assertValueIs('#e2eEmail', ps.azureEmail);
      });
    }

    it(`... Hen types a Ty username — Azure apparently doesn't include any username
              and sets the OIDC 'sub' field to just an opaque string`, () => {
      ps.br().waitAndSetValue('.esCreateUserDlg #e2eUsername',
            ps.newTalkyardUsername, { checkAndRetry: true });
    });
    it(`... saves`, () => {
      ps.br().loginDialog.clickSubmit();
    });
    it(`... accepts terms`, () => {
      ps.br().loginDialog.acceptTerms();
    });

    if (ps.azureEmailVerified === false) {
      it(`... clicks an email addr verification email`, () => {
        const url = server.getLastVerifyEmailAddressLinkEmailedTo(site.id, ps.azureEmail);
        ps.br().go2(url);
      });
      it(`... email now verified, continues`, () => {
        ps.br().hasVerifiedSignupEmailPage.clickContinue();
      });
    }
    else if (!variants.loginRequired && !ps.isSingleSignOn) {
      // UX: Maybe could show this dialog also if login-required or if needed to verify
      // the email addr? Oh well.
      it(`... there's a welcome dialog`, () => {
        ps.br().loginDialog.waitAndClickOkInWelcomeDialog();
      });
    }

    it(`... username shown in topbar: '${ps.newTalkyardUsername}'`, () => {
      ps.br().topbar.assertMyUsernameMatches(ps.newTalkyardUsername);
    });

    it(`... logs out`, () => {
      ps.br().topbar.clickLogout({ waitForLoginDialog });
    });

    it(`... logs in again — gets logged in directly`, () => {});
    addStartAzureLoginSteps({ br: ps.br, isSingleSignOn: ps.isSingleSignOn });

    it(`... correct username shown in topbar: '${ps.newTalkyardUsername}'`, () => {
      ps.br().topbar.assertMyUsernameMatches(ps.newTalkyardUsername);
    });
  }



  function addLoginAndLinkAzureAccountTestSteps(ps: {
        br: () => TyE2eTestBrowser,
        resetBrowser?: Bo,
        who: St,
        tyUser: () => Member,
        azureUsername: St,
        azurePassword: St,
        azureEmail?: St,
        azureEmailVerified?: false,
        azureFullName?: St,
        isSingleSignOn?: Bo }) {

    it(`${ps.who} arrives`, () => {
      if (ps.resetBrowser) {
        ps.br().reloadSession();
      }
      ps.br().go2(site.origin);
    });

    addStartAzureLoginSteps({ br: ps.br, isSingleSignOn: ps.isSingleSignOn });

    it(`... logs in via Azure — hen has a Ty account, and
              wants to link it to hens Azure account`, () => {
      ps.br().loginDialog.loginWithOidcAzureAd({
            email: ps.azureUsername,
            password: ps.azurePassword,
            fullScreenLogin: variants.loginRequired,
            stayInPopup: !variants.loginRequired });
    });

    if (ps.azureEmailVerified === false) {
      it(`... clicks an email addr verification email`, () => {
        const url = server.getLastVerifyEmailAddressLinkEmailedTo(
          site.id, ps.azureEmail, 'LINKING_IDP_ACCT');
        ps.br().go2(url);
      });
    }

    it(`... ${ps.who} says Yes to linking to the Ty account`, () => {
      ps.br().loginDialog.clickYesLinkAccounts();
    });

    it(`... clicks Log In Again`, () => {
      ps.br().loginDialog.clickLogInAgain({
          isInPopupThatWillClose: !variants.loginRequired });
    });

    if (!variants.loginRequired) {
      it(`... the login popup closes`, () => {
        ps.br().switchBackToFirstTabOrWindow();
      });
    }

    it(`... ${ps.who}'s username appears in the topbar`, () => {
      ps.br().topbar.assertMyUsernameMatches(ps.tyUser().username);
    });

    it(`... logs out`, () => {
      ps.br().topbar.clickLogout({ waitForLoginDialog });
    });

    it(`... logs in again — gets logged in directly`, () => {});
    addStartAzureLoginSteps({ br: ps.br, isSingleSignOn: ps.isSingleSignOn });

    it(`... ${ps.who}'s username again shown in topbar`, () => {
      ps.br().topbar.assertMyUsernameMatches(ps.tyUser().username);
    });
  }


};

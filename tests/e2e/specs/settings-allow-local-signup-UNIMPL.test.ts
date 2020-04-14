/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import make = require('../utils/make');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

let browser: TyE2eTestBrowser;

let everyone;
let owen;
let owensBrowser: TyE2eTestBrowser;
let maria;
let mariasBrowser: TyE2eTestBrowser;

let idAddress: IdAddress;
let forumTitle = "(Dis)Allow Signup Forum";


describe("(dis)allow local signup:", () => {

  it("initialize people", () => {
    browser = new TyE2eTestBrowser(wdioBrowser);
    everyone = browser;
    owen = make.memberOwenOwner();
    owensBrowser = browser;
    maria = make.memberMaria();
    mariasBrowser = browser;
  });

  it("import a site", () => {
    let site: SiteData = make.forumOwnedByOwen('no-local-signup', { title: forumTitle });
    site.settings.allowSignup = false;
    site.members.push(maria);
    idAddress = server.importSiteData(site);
  });

  it("Member Maria has a local account already, so she can login", () => {
    mariasBrowser.go(idAddress.origin);
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
    mariasBrowser.disableRateLimits();
  });

  it("... but she cannot send invites, because local signups are disabled", () => {
    // TESTS_MISSING and not included in run-e2e-test.sh
  });

  it("... Maria leaves", () => {
    mariasBrowser.topbar.clickLogout();
  });

  it("A stranger sees a signup button", () => {
    // ...
  });

  it("... but in the signup dialog, there're no create-email-&-password account fields ", () => {
    // ...
  });

  it("An invite sent a while ago, by Maria, no longer works", () => {
  });

});


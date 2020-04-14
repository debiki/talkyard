/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import { buildSite } from '../utils/site-builder';
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

let browser: TyE2eTestBrowser;

let forum;

let everyone;
let owen;
let owensBrowser: TyE2eTestBrowser;
let maria;
let mariasBrowser: TyE2eTestBrowser;
let michael;
let michaelsBrowser: TyE2eTestBrowser;
let maja;
let majasBrowser: TyE2eTestBrowser;
let mallory;
let mallorysBrowser: TyE2eTestBrowser;
let strangersBrowser: TyE2eTestBrowser;

let idAddress: IdAddress;
let forumTitle = "UTX Test Forum";



describe("usability testing exchange:", () => {

  it("import a site", () => {
    idAddress = server.importSiteData(forum.siteData);
  });

  it("initialize people", () => {
    browser = new TyE2eTestBrowser(wdioBrowser);
    everyone = browser;
    owen = forum.members.owen;
    owensBrowser = browser;

    maria = forum.members.maria;
    mariasBrowser = browser;
    michael = forum.members.michael;
    michaelsBrowser = browser;
  });

  describe("as Gmail user", () => {
    it("type address and submit", () => {
    });

    it("fill in instructions, click submit", () => {
    });

    it("login with Gmail", () => {
    });

    it("sees thanks page", () => {
    });

    it("there's nothing to test", () => {
    });

    it("sees own topic in test queue", () => {
    });

    it("opens it, looks ok", () => {
    });
  });

  // utx-all-logins:
  // signup & post with Gmail.
  // signup & post with FB, give feedback to Gmail.
  // login & post with Gmail.
  // login & post with FB.
  // signup & post with pwd.
  // login & post with pwd.


  // utx-is-fair:
  // Maria, Maja,    Mallory,   Michael         Maria, notf email  Maja,reminder-email     Corax
  //   0    1—>Maria    0       1—>Maja         2–>Michael,Maja       1—>Michael (long!)   1—>Maja

  it("Member Maria logs in", () => {
    mariasBrowser.go(idAddress.origin);
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

});


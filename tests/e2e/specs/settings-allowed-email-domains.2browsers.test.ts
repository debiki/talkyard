/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

declare var browser: any;
declare var browserA: any;
declare var browserB: any;

let everyonesBrowsers;
let richBrowserA;
let richBrowserB;
let owen: Member;
let owensBrowser;
let mons: Member;
let monsBrowser;
let modya: Member;
let modyasBrowser;
let corax: Member;
let coraxBrowser;
let regina: Member;
let reginasBrowser;
let maria: Member;
let mariasBrowser;
let michael: Member;
let michaelsBrowser;
let mallory: Member;
let mallorysBrowser;
let strangersBrowser;

let siteIdAddress: IdAddress;
let siteId;

let forum: EmptyTestForum;

let discussionPageUrl: string;


describe("email-domain-whitelist-blacklist [TyT5AKRD04]", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addEmptyForum({
      title: "Allowed Email Domains E2E Test",
      members: undefined, // default = everyone
    });
    assert(builder.getSite() === forum.siteData);
    siteIdAddress = server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
  });

  it("initialize people", () => {
    everyonesBrowsers = _.assign(browser, pagesFor(browser));
    richBrowserA = _.assign(browserA, pagesFor(browserA));
    richBrowserB = _.assign(browserB, pagesFor(browserB));

    owen = forum.members.owen;
    owensBrowser = richBrowserA;
    mons = forum.members.mons;
    monsBrowser = richBrowserA;
    modya = forum.members.modya;
    modyasBrowser = richBrowserA;
    corax = forum.members.corax;
    coraxBrowser = richBrowserA;

    regina = forum.members.regina;
    reginasBrowser = richBrowserB;
    maria = forum.members.maria;
    mariasBrowser = richBrowserB;
    michael = forum.members.michael;
    michaelsBrowser = richBrowserB;
    mallory = forum.members.mallory;
    mallorysBrowser = richBrowserB;
    strangersBrowser = richBrowserB;
  });

  it("Owen logs in to admin area, ... ", () => {
    owensBrowser.adminArea.goToUsersEnabled(siteIdAddress.origin);
    owensBrowser.loginDialog.loginWithPassword(owen);
  });

  it("Owen blacklists the domains 'very.bad.com' and 'evil.org'", () => {
    owensBrowser.debug();
  });

  it("A stranger attempts to sign up with those blacklisted email domains", () => {
    strangersBrowser.go(siteIdAddress.origin);
    strangersBrowser.debug();
    //strangersBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  it("Owen clears the blacklist", () => {
    owensBrowser.debug();
  });

  it("... Now the stranger can sign up", () => {
    strangersBrowser.debug();
  });

  it("Owen adds an email domain whitelist, good.org", () => {
    owensBrowser.debug();
  });

  it("A stranger attempts to sign up with a non white listed domain", () => {
  });

  it("... that doesn't work", () => {
  });

  it("But hen *can* sign up with an email addr on the white listed domain", () => {
  });

  it("Owen black lists a sub domain of the whitelist, not.good.org", () => {
  });

  it("A stranger cannot sign up via this bad sub domain", () => {
  });

});


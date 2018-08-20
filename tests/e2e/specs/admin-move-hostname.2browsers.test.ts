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

const newHostname = 'e2e-test-new-hostname.localhost';

let forum: LargeTestForum;
const forumTitle = "Moved Forum";

let discussionPageUrl: string;


describe("admin-move-hostname.2browsers  TyT6FKAR20P5", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addLargeForum({
      title: forumTitle,
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

    modya = forum.members.modya;
    modyasBrowser = richBrowserB;
    maria = forum.members.maria;
    mariasBrowser = richBrowserB;
    strangersBrowser = richBrowserB;
  });

  it("Owen logs in to admin area,", () => {
    owensBrowser.adminArea.goToLoginSettings(siteIdAddress.origin);
    owensBrowser.loginDialog.loginWithPassword(owen);
  });

  it("... goes to the hostname settings", () => {
    owensBrowser.adminArea.settings.clickAdvancedNavLink();
  });

  let origOrigin: string;
  let origHost: string;

  it("... sees the current hostname; it matches the browser's addr bar hostname", () => {
    origOrigin = owensBrowser.origin();
    origHost = owensBrowser.host();
    const hostnameSetting = owensBrowser.adminArea.settings.advanced.getHostname();
    assert.equal(origHost, hostnameSetting);
  });

  it("A stranger looks at Maria's page", () => {
    strangersBrowser.go(siteIdAddress.origin + '/' + forum.topics.byMariaCategoryA.slug);
    strangersBrowser.assertPageTitleMatches(forum.topics.byMariaCategoryA.title)
  });

  it("... hen is at the same origin as Owen", () => {
    const strangersOrigin = strangersBrowser.origin();
    assert.equal(strangersOrigin, origOrigin);
  });

  it("Owen changes to another hostname", () => {
    owensBrowser.adminArea.settings.advanced.clickChangeSiteAddress();
    owensBrowser.adminArea.settings.advanced.typeNewSiteAddress(newHostname);
    owensBrowser.adminArea.settings.advanced.saveNewSiteAddress();
  });

  it("... and sees a Click Redirect message", () => {
    owensBrowser.adminArea.settings.advanced.waitForNewSiteRedirectLink();
  });

  it("When the stranger refreshes the page, it won't redirect", () => {
    strangersBrowser.refresh();
    strangersBrowser.assertPageTitleMatches(forum.topics.byMariaCategoryA.title);
    const strangersOrigin = strangersBrowser.origin();
    assert.equal(strangersOrigin, origOrigin);
  });

  it("Owen goes to the new address", () => {
    owensBrowser.adminArea.settings.advanced.followLinkToNewSiteAddr();
  });

  it("... he really gets to the correct new address", () => {
    const host = owensBrowser.host();
    assert.equal(host, newHostname);
  });

  it("... needs to login again", () => {
    owensBrowser.loginDialog.loginWithPassword(owen);
  });

  it("... sees the old hostname is now a Duplicating hostname", () => {
    const duplHostnames = owensBrowser.adminArea.settings.advanced.getDuplicatingHostnames();
    assert.equal(duplHostnames, origHost);
    assert(!owensBrowser.adminArea.settings.advanced.isRedirectingHostnamesVisible());
  });

  it("... and clicks Redirect Old Addresses", () => {
    owensBrowser.adminArea.settings.advanced.clickRedirectOldSiteAddresses();
    owensBrowser.refresh();
  });

  it("... now the old hostname changes to a Redirecting hostname", () => {
    const redirHostnames = owensBrowser.adminArea.settings.advanced.getRedirectingHostnames();
    assert.equal(redirHostnames, origHost);
    assert(!owensBrowser.adminArea.settings.advanced.isDuplicatingHostnamesVisible());
  });

  it("The stranger redfreshs the page again", () => {
    strangersBrowser.refresh();
    strangersBrowser.assertPageTitleMatches(forum.topics.byMariaCategoryA.title);
  });

  it("... this time hen gets redirected", () => {
    const strangersHost = strangersBrowser.host();
    assert.equal(strangersHost, newHostname);
  });

  it("Owen starts changing address back to the old hostname", () => {
    owensBrowser.refresh();
    owensBrowser.adminArea.settings.advanced.clickChangeSiteAddress();
    owensBrowser.adminArea.settings.advanced.typeNewSiteAddress(origHost);
  });

  it("... clicks Save", () => {
    owensBrowser.adminArea.settings.advanced.saveNewSiteAddress();
  });

  it("... follows link back to old site (no login needed, already logged in at the old site)", () => {
    owensBrowser.adminArea.settings.advanced.followLinkToNewSiteAddr();
  });

  it("... the formerly new hostname is now Duplicating", () => {
    const duplHostnames = owensBrowser.adminArea.settings.advanced.getDuplicatingHostnames();
    assert.equal(duplHostnames, newHostname);
    assert(!owensBrowser.adminArea.settings.advanced.isRedirectingHostnamesVisible());
  });

  it("Owen clicks Redirect", () => {
    owensBrowser.adminArea.settings.advanced.clickRedirectOldSiteAddresses();
    owensBrowser.refresh();
  });

  it("... the formerly new hostname becomes Redirecting", () => {
    const redirHostnames = owensBrowser.adminArea.settings.advanced.getRedirectingHostnames();
    assert.equal(redirHostnames, newHostname);
    assert(!owensBrowser.adminArea.settings.advanced.isDuplicatingHostnamesVisible());
  });

  it("The stranger again refreshes the page", () => {
    strangersBrowser.refresh();
    strangersBrowser.assertPageTitleMatches(forum.topics.byMariaCategoryA.title);
  });

  it("... and now gets redirected back to the orig hostname", () => {
    const strangersOrigin = strangersBrowser.origin();
    assert.equal(strangersOrigin, origOrigin);
  });

  it("Mallory attempts to change the hostname of his site, to Owens hostname  TyT85RRPJ28", () => {
    // TESTS_MISSING
  });

});


/// <reference path="../test-types.ts"/>
import * as _ from 'lodash';
import assert = require('../utils/ty-assert');
import fs = require('fs');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import make = require('../utils/make');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

let everyone_brA;
let maria;
let maria_brA: TyE2eTestBrowser;
let modya;
let modya_brA: TyE2eTestBrowser;
let mons;
let mons_brA: TyE2eTestBrowser;
let owen;
let owen_brA: TyE2eTestBrowser;
let stranger_brA: TyE2eTestBrowser;

let idAddress: IdAddress;
let siteId: any;

const infoPageTitle = 'infoPageTitle';
const infoPageEditedTitle = 'infoPageEditedTitle';
const infoPageEd2Title = 'infoPageEd2Title';
const infoPageBody = 'infoPageBody';
const infoPageEditedBody = 'infoPageEditedBody';
const infoPageEd2Body = 'infoPageEd2Body';


describe("page-type-info-page.test.ts  TyTE2E503MKTR3", () => {

  it("Initialize people", () => {
    everyone_brA = new TyE2eTestBrowser(wdioBrowser);
    stranger_brA = everyone_brA;
    maria_brA = everyone_brA;
    modya_brA = everyone_brA;
    mons_brA = everyone_brA;
    owen_brA = everyone_brA;
    maria = make.memberMaria();
    modya = make.memberModeratorModya();
    mons = make.memberModeratorMons();
    owen = make.memberOwenOwner();
  });

  it("Import a site", () => {
    const site: SiteData = make.forumOwnedByOwen('pgtpinf', { title: "Info Pages" });
    site.members.push(maria);
    site.members.push(modya);
    site.members.push(mons);
    idAddress = server.importSiteData(site);
    siteId = idAddress.id;
  });

  it("Maria logs in", () => {
    maria_brA.go(idAddress.origin);
    maria_brA.complex.loginWithPasswordViaTopbar(maria);
    maria_brA.disableRateLimits();
  });

  it("She starts composing a new topic", () => {
    maria_brA.forumButtons.clickCreateTopic();
  });

  it("... wants to change topic type to Info Page", () => {
    maria_brA.editor.openTopicTypeDropdown();
  });

  it("... but cannot choose topic type Info Page", () => {
    assert.not(maria_brA.editor.canClickShowMoreTopicTypes());
  });

  it("Maria gets upset; she leaves. Moderator Modya arrives", () => {
    maria_brA.editor.closeTopicTypeDropdown();
    maria_brA.topbar.clickLogout();
    modya_brA.complex.loginWithPasswordViaTopbar(modya);
  });

  it("Modya can posts a topic, type Info Page", () => {
    modya_brA.complex.createAndSaveTopic({
          type: c.TestPageRole.WebPage, title: infoPageTitle, body: infoPageBody });
  });

  it("Info Pages don't have any workflow status", () => {
    assert.not(modya_brA.topicTypeExpl.isTopicTypeExplVisible());
  });

  /* Hmm, no, cannot close them.

  it("But info pages can get Closed: Modya closes the page", () => {
    modya_brA.topic.closeTopic();
  });

  it("... and reopens it", () => {
    modya_brA.topic.reopenTopic();
  }); */

  it("Modya can edit her Info Page, of course", () => {
    modya_brA.complex.editPageBody(infoPageEditedBody);
  });

  it("... the title too", () => {
    modya_brA.complex.editPageTitle(infoPageEditedTitle);
  });

  it("... it works", () => {
    modya_brA.topic.waitUntilPostTextIs(c.BodyNr, infoPageEditedBody);
    modya_brA.topic.waitUntilPostTextIs(c.TitleNr, infoPageEditedTitle);
  });

  it("Modya leaves", () => {
    modya_brA.topbar.clickLogout({ waitForLoginButton: false });
  });

  it(`Mons arrives, needs to login via a not-Info Page,
          currently Info Pages don't have login buttons`, () => {
    const pagePath = mons_brA.urlPath();
    mons_brA.go2('/');
    mons_brA.complex.loginWithPasswordViaTopbar(mons);
    mons_brA.go2(pagePath);
  });

  it(`Mons edits the page too — Moderators can edit each other's Info Pages
            (as long as the category perms let them edit others' pages)`, () => {
    mons_brA.complex.editPageBody(infoPageEd2Body);
  });

  it("... the title too", () => {
    mons_brA.complex.editPageTitle(infoPageEd2Title);
  });

  it("Strangers see Mons' edits", () => {
    mons_brA.topbar.clickLogout({ waitForLoginButton: false });
    stranger_brA.topic.waitUntilPostTextIs(c.BodyNr, infoPageEd2Body);
  });

  it("... the edited title too", () => {
    stranger_brA.topic.waitUntilPostTextIs(c.TitleNr, infoPageEd2Title);
  });

});


/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import * as make from '../utils/make';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';

let maria;
let maria_brA: TyE2eTestBrowser;
let modya;
let modya_brA: TyE2eTestBrowser;
let mons;
let mons_brA: TyE2eTestBrowser;
let stranger_brA: TyE2eTestBrowser;

let idAddress: IdAddress;
let siteId: any;

const infoPageTitle = 'infoPageTitle';
const infoPageEditedTitle = 'infoPageEditedTitle';
const infoPageEd2Title = 'infoPageEd2Title';
const infoPageBody = 'infoPageBody';
const infoPageEditedBody = 'infoPageEditedBody';
const infoPageEd2Body = 'infoPageEd2Body';


describe("page-type-info-page.1br.d  TyTE2E503MKTR3", () => {

  it("Initialize people", () => {
    const brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    stranger_brA = brA;
    maria_brA = brA;
    modya_brA = brA;
    mons_brA = brA;
    maria = make.memberMaria();
    modya = make.memberModeratorModya();
    mons = make.memberModeratorMons();
  });

  it("Import a site", async () => {
    const site: SiteData = make.forumOwnedByOwen('pgtpinf', { title: "Info Pages" });
    site.members.push(maria);
    site.members.push(modya);
    site.members.push(mons);
    idAddress = await server.importSiteData(site);
    siteId = idAddress.id;
  });

  it("Maria logs in", async () => {
    await maria_brA.go2(idAddress.origin);
    await maria_brA.complex.loginWithPasswordViaTopbar(maria);
    await maria_brA.disableRateLimits();
  });

  it("She starts composing a new topic", async () => {
    await maria_brA.forumButtons.clickCreateTopic();
  });

  it("... wants to change topic type to Info Page", async () => {
    await maria_brA.editor.openTopicTypeDropdown();
  });

  it("... but cannot choose topic type Info Page", async () => {
    assert.not(await maria_brA.editor.canClickShowMoreTopicTypes());
  });

  it("Maria gets upset; she leaves. Moderator Modya arrives", async () => {
    await maria_brA.editor.closeTopicTypeDropdown();
    await maria_brA.topbar.clickLogout();
    await modya_brA.complex.loginWithPasswordViaTopbar(modya);
  });

  it("Modya can posts a topic, type Info Page", async () => {
    await modya_brA.complex.createAndSaveTopic({
          type: c.TestPageRole.WebPage, title: infoPageTitle, body: infoPageBody });
  });

  it("Info Pages don't have any workflow status", async () => {
    assert.not(await modya_brA.topicTypeExpl.isTopicTypeExplVisible());
  });

  /* Hmm, no, cannot close them.

  it("But info pages can get Closed: Modya closes the page", async () => {
    await modya_brA.topic.closeTopic();
  });

  it("... and reopens it", async () => {
    await modya_brA.topic.reopenTopic();
  }); */

  it("Modya can edit her Info Page, of course", async () => {
    await modya_brA.complex.editPageBody(infoPageEditedBody);
  });

  it("... the title too", async () => {
    await modya_brA.complex.editPageTitle(infoPageEditedTitle);
  });

  it("... it works", async () => {
    await modya_brA.topic.waitUntilPostTextIs(c.BodyNr, infoPageEditedBody);
    await modya_brA.topic.waitUntilPostTextIs(c.TitleNr, infoPageEditedTitle);
  });

  it("Modya leaves", async () => {
    await modya_brA.topbar.clickLogout({ waitForLoginButton: false });
  });

  it(`Mons arrives, needs to login via a not-Info Page,
          currently Info Pages don't have login buttons`, async () => {
    const pagePath = await mons_brA.urlPath();
    await mons_brA.go2('/');
    await mons_brA.complex.loginWithPasswordViaTopbar(mons);
    await mons_brA.go2(pagePath);
  });

  it(`Mons edits the page too — Moderators can edit each other's Info Pages
            (as long as the category perms let them edit others' pages)`, async () => {
    await mons_brA.complex.editPageBody(infoPageEd2Body);
  });

  it("... the title too", async () => {
    await mons_brA.complex.editPageTitle(infoPageEd2Title);
  });

  it("Strangers see Mons' edits", async () => {
    await mons_brA.topbar.clickLogout({ waitForLoginButton: false });
    await stranger_brA.topic.waitUntilPostTextIs(c.BodyNr, infoPageEd2Body);
  });

  it("... the edited title too", async () => {
    await stranger_brA.topic.waitUntilPostTextIs(c.TitleNr, infoPageEd2Title);
  });

});


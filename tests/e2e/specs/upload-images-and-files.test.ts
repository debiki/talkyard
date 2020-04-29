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
let owen: Member;
let owensBrowser: TyE2eTestBrowser;
let maria: Member;
let mariasBrowser: TyE2eTestBrowser;

let siteIdAddress: IdAddress;
let siteId: SiteId;

let forum: TwoPagesTestForum;


describe("upload-images-and-files  TyT50E6KTDU7", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      title: "Some E2E Test",
      members: undefined, // default = everyone
    });

    assert.refEq(builder.getSite(), forum.siteData);
    siteIdAddress = server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
    server.skipRateLimits(siteId);
  });

  it("initialize people", () => {
    everyonesBrowsers = new TyE2eTestBrowser(allWdioBrowsers);
    richBrowserA = new TyE2eTestBrowser(oneWdioBrowser);

    owen = forum.members.owen;
    //owensBrowser = richBrowserA;

    maria = forum.members.maria;
    mariasBrowser = richBrowserA;
  });

  it("Maria logs in", () => {
    mariasBrowser.go2(siteIdAddress.origin);
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  it("Maria starts writing a new topic", () => {
    mariasBrowser.forumButtons.clickCreateTopic();
    mariasBrowser.editor.editTitle("Upload qute pets");
    mariasBrowser.editor.editText("The pets:");
  });

  it("... she uploads two otters", () => {
    mariasBrowser.editor.uploadFile('TestMediaDir', 'otters-looking.jpeg');
  });

  it("... saves the topic", () => {
    mariasBrowser.editor.saveWaitForNewPage();
  });

  it("Then she starts writing a reply", () => {
    mariasBrowser.topic.clickReplyToOrigPost();
  });

  it("... and uploads a red panda, with many dots in the file name", () => {
    mariasBrowser.editor.editText("Is it dangerous?\n\n");
    mariasBrowser.editor.uploadFile(
        'TestMediaDir', 'red-panda-resting.wow.so.tired.jpeg');
  });

  it("... and uploads a doc Word document with dots in the file name", () => {
    mariasBrowser.editor.uploadFile(
        'TestMediaDir', 'word-doc.with.funny-dash.and.dots.doc');
  });

  it("... and uploads a docx Word document with dots and UPPERcase in the file name", () => {
    mariasBrowser.editor.uploadFile(
        'TestMediaDir', 'word-doc.very-x-files.TOP.SECRET.docx');
  });

  it("... she posts the reply", () => {
    mariasBrowser.editor.save();
  });

  it("TESTS_MISSING: Veriy uploaded images look ok: Visual regression tests", () => {
    // Use  https://webdriver.io/blog/2019/05/18/visual-regression-for-v5.html
  });

  it("TESTS_MISSING: Files with no suffix — currently not allowed, hmm", () => {
  });

});


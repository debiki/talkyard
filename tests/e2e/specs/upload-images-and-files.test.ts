/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import * as fs from 'fs';
import assert = require('../utils/ty-assert');
import { execFileSync } from 'child_process';
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

// Sync file names with script: [bigf_file_names].
const zerosFileOneKibibyte       = `bigfile-0.001mib.zeros`;
const zerosFileTwoKibibyte       = `bigfile-0.002mib.zeros`;
const zerosFileOneMebibyteAlmost = `bigfile-0.99mib.zeros`;
const zerosFileFourMebibyte      = `bigfile-4mib.zeros`;
const zerosFileFiveMebibyte      = `bigfile-5mib.zeros`;

describe("upload-images-and-files  TyT50E6KTDU7", () => {

  it("Generate files to upload", () => {
    // execFileSync throws an exception, if the file returns a
    // non zero exit code.
    let scriptPath = 's/gen-big-file-if-not-exists.sh';
    if (!fs.existsSync(scriptPath)) {  // CLEAN_UP REMOVE once gone [rm_run_e2e_tests_sh]
      scriptPath = '../../s/gen-big-file-if-not-exists.sh';
    }
    execFileSync(scriptPath, ['0.001']);
    execFileSync(scriptPath, ['0.002']);
    execFileSync(scriptPath, ['0.99']);
    execFileSync(scriptPath, ['4']);
    execFileSync(scriptPath, ['5']);
  });


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



  // ----- Upload files, when creating topic


  it("... she uploads two otters", () => {
    mariasBrowser.editor.uploadFile('TestMediaDir', 'otters-looking.jpeg');
  });

  it("... saves the topic", () => {
    mariasBrowser.editor.saveWaitForNewPage();
  });



  // ----- Upload files, when replying


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



  // ----- Too large files: Browser says No


  it("Maria starts writing another reply", () => {
    mariasBrowser.topic.clickReplyToOrigPost();
  });

  it("... uploads a tiny .zeros file", () => {
    mariasBrowser.editor.uploadFile('TargetDir', zerosFileOneKibibyte);
  });

  it("... tries to upload a too large file: 5 MiB", () => {
    mariasBrowser.editor.uploadFile('TargetDir', zerosFileFourMebibyte);
  });

  it("... there's an upload-files problem", () => {
    mariasBrowser.waitForVisible('.s_UplErrD');
  });

  it("... namely that the file is too large  TyTE2ETOOLGUPL", () => {
    mariasBrowser.waitForVisible('.e_FlTooLg');
  });

  it("Maria closes the error dialog", () => {
    mariasBrowser.stupidDialog.close();
  });

  it("... upload an almost 1 MiB file instead (works fine)", () => {
    mariasBrowser.editor.uploadFile('TargetDir', zerosFileOneMebibyteAlmost);
  });

  it("Maria submits the reply", () => {
    mariasBrowser.editor.save();
  });

  let zerosReplyHtml: St;

  it("... it appears", () => {
    const zerosReplyNr = c.FirstReplyNr + 1;
    mariasBrowser.topic.waitForPostNrVisible(zerosReplyNr);
    zerosReplyHtml = mariasBrowser.topic.getPostHtml(zerosReplyNr);
  });

  it("... with a link to the tiny .zeros file", () => {
    assert.includes(zerosReplyHtml, `>${zerosFileOneKibibyte}</a> (1 KiB)`);
  });

  it("... and another link to the almost one MiB file  TyTE2EKILOKIBI", () => {
    // Note that prettyBytes(..) shows  0.99 MiB instead of 1013 KiB. [pretty_mebibytes]
    assert.includes(zerosReplyHtml, `>${zerosFileOneMebibyteAlmost}</a> (0.99 MiB)`);
  });



  // ----- Too large files: Server says No


  it("Maria hacks the browser side max file size", () => {
    mariasBrowser.execute(function() {
      window['theStore'].me.maxUploadSizeBytes = 999999999;
    })
  });

  it("... starts writing another reply", () => {
    mariasBrowser.topic.clickReplyToOrigPost();
  });

  it("... uploads the biggest file she has", () => {
    mariasBrowser.editor.uploadFile('TargetDir', zerosFileFiveMebibyte);
  });

  it("... now the *server* says No  TyTE2ESVUPLCK", () => {
    mariasBrowser.serverErrorDialog.waitAndAssertTextMatches(
            /too large.*TyESVUPLSZCK_/s);
  });

  it("Maria closes the server error dialog", () => {
    mariasBrowser.serverErrorDialog.close();
  });

  it("... upload a really small file", () => {
    mariasBrowser.editor.uploadFile('TargetDir', zerosFileTwoKibibyte);
  });

  it("... works fine; she can submit the reply", () => {
    mariasBrowser.editor.save();
  });

});


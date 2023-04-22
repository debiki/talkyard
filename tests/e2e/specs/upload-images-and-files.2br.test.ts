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
let richBrowserB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let maria: Member;
let maria_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoPagesTestForum;

// Sync file names with script: [bigf_file_names].
const zerosFileOneKibibyte   = `bigfile-0.001mib.zeros`;
const zerosFileTwoKibibyte   = `bigfile-0.002mib.zeros`;
const zerosFile049MiB        = `bigfile-0.49mib.zeros`;
const zerosFile051MiB        = `bigfile-0.51mib.zeros`;
const zerosFileOneMiBAlmost  = `bigfile-0.99mib.zeros`;
const zerosFileFourMebibyte  = `bigfile-4mib.zeros`;

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
    execFileSync(scriptPath, ['0.49']);
    execFileSync(scriptPath, ['0.51']);
    execFileSync(scriptPath, ['0.99']);
    execFileSync(scriptPath, ['4']);
  });


  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      title: "Some E2E Test",
      members: undefined, // default = everyone
    });

    assert.refEq(builder.getSite(), forum.siteData);
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });

  it("initialize people", () => {
    everyonesBrowsers = new TyE2eTestBrowser(allWdioBrowsers);
    richBrowserA = new TyE2eTestBrowser(wdioBrowserA);
    richBrowserB = new TyE2eTestBrowser(wdioBrowserB);

    owen = forum.members.owen;
    owen_brA = richBrowserA;

    maria = forum.members.maria;
    maria_brB = richBrowserB;
  });

  it(`Owen arrives`, () => {
    owen_brA.userProfilePage.openPermissionsFor(c.AllMembersId, site.origin);
    owen_brA.complex.loginWithPasswordViaTopbar(owen);
  });

  it(`And Maria`, () => {
    maria_brB.go2(site.origin);
    maria_brB.complex.loginWithPasswordViaTopbar(maria);
  });

  it("Maria starts writing a new topic", () => {
    maria_brB.forumButtons.clickCreateTopic();
    maria_brB.editor.editTitle("Upload qute pets");
    maria_brB.editor.editText("The pets:");
  });



  // ----- Upload files, when creating topic


  it("... she uploads two otters", () => {
    maria_brB.editor.uploadFile('TestMediaDir', 'otters-looking.jpeg');
  });

  it("... and a red panda, with many dots in the file name", () => {
    maria_brB.editor.editText("Is it dangerous?\n", { append: true });
    maria_brB.editor.uploadFile(
        'TestMediaDir', 'red-panda-resting.wow.so.tired.jpeg');
  });

  it("... saves the topic", () => {
    maria_brB.editor.saveWaitForNewPage();
  });



  // ----- Upload files, when replying


  it("Then she starts writing a reply", () => {
    maria_brB.topic.clickReplyToOrigPost();
  });

  it(`She uploads an uppercase .JPG pic — mobile phones tend to use uppercase`, () => {
    maria_brB.editor.editText("Panda lives here? Red house?");
    maria_brB.editor.uploadFile(
          'TestMediaDir', 'MOBILE_PHONE.JPG');
  });

  it("... '.JPG' extension got converted to lowrecase '.jpg'", () => {
    const text = maria_brB.editor.getText();
    assert.includes(text, '<!-- Uploaded file name:  MOBILE_PHONE.JPG  -->');
    assert.matches(text,
          /<img src="\/-\/u\/[0-9]\/[a-z0-9]\/[a-z0-9]{2}\/[a-z0-9]+.jpg">/);
  });

  it("Maria tries to upload a .doc Word document, but cannot", () => {
    maria_brB.editor.uploadFile(
          'TestMediaDir', 'fakeword.doc', { waitForBadExtErr: true });
  });


  it("Owen adds 'doc' to ok extensions", () => {
    owen_brA.waitAndSetValue('.s_PP_PrmsTb_UplExts textarea', " doc", { append: true });
  });


  it("... saves", () => {
    // [wdio_6_to_7]  Use instead:  await owen_brA.userProfilePage.permissions.save();
    owen_brA.waitAndClick('.e_SvPerms');
  });

  it("Now Maria can upload the doc Word document", () => {
    maria_brB.refresh2(); // refresh max upl size
    maria_brB.topic.clickReplyToOrigPost();
    maria_brB.editor.uploadFile('TestMediaDir', 'fakeword.doc');
  });


  it("... and another Word doc with dots in the file name", () => {
    maria_brB.editor.uploadFile(
        'TestMediaDir', 'word-doc.with.funny-dash.and.dots.doc');
  });

  it("Not docx though", () => {
    maria_brB.editor.uploadFile(
          'TestMediaDir', 'word-doc.very-x-files.TOP.SECRET.docx',
          { waitForBadExtErr: true });
  });

  it("... and not files with no extension", () => {
    maria_brB.editor.uploadFile(
          'TestMediaDir', 'file-without-dot-ext',
          { waitForBadExtErr: true });
  });


  it("... until Owen allows anything", () => {
    owen_brA.waitAndSetValue('.s_PP_PrmsTb_UplExts textarea', "**");
    owen_brA.waitAndClick('.e_SvPerms');
  });

  it(`Now Maria can upload the docx Word document
          with dots and UPPERcase in the file name`, () => {
    maria_brB.refresh2(); // refresh max upl size
    maria_brB.topic.clickReplyToOrigPost();
    maria_brB.editor.uploadFile(
          'TestMediaDir', 'word-doc.very-x-files.TOP.SECRET.docx');
  });

  /* No, won't work. Maybe better wait? Or what mime-type should the
     server use, when people download the file?
     Currently the server says No, here: [upl_ext_req].
  it("... and files with no extensions", () => {
    maria_brB.editor.uploadFile('TestMediaDir', 'file-without-dot-ext');
  });  */

  it("Maria posts the reply", () => {
    maria_brB.editor.save();
  });

  it("TESTS_MISSING Links to the uploaded files appear", () => {
  });

  let html;

  it("File uploaded as .JPG is instead lowrecase .jpg", () => {
    html = maria_brB.topic.getPostHtml(c.FirstReplyNr);
    assert.includes(html, '.jpg"');
    assert.excludes(html, '.JPG"');
    assert.includes(html, '.docx"');
    assert.excludes(html, '.DOCX"');
  });

  it("... the links are url hash paths", () => {
    // Test just one, for now.
    assert.matches(html,
          // Won't work, if any CDN url prefix:
          // /<img src="\/-\/u\/[0-9]\/[a-z0-9]\/[a-z0-9]{2}\/[a-z0-9]+.jpg">/);
          // Instead, for now:
          /\/[0-9]\/[a-z0-9]\/[a-z0-9]{2}\/[a-z0-9]+.jpg">/);
  });

  it("TESTS_MISSING: Uploaded images look ok: Visual regression tests", () => {
    // Use  https://webdriver.io/blog/2019/05/18/visual-regression-for-v5.html
  });



  // ----- Too large files: Browser says No


  it("Maria starts writing another reply", () => {
    maria_brB.topic.clickReplyToOrigPost();
  });

  it("... uploads a tiny .zeros file", () => {
    maria_brB.editor.uploadFile('TargetDir', zerosFileOneKibibyte);
  });

  it("... tries to upload a too large file: 4 MiB", () => {
    maria_brB.editor.uploadFile('TargetDir', zerosFileFourMebibyte, { allFine: false });
  });

  it("... there's an upload-files problem", () => {
    maria_brB.waitForVisible('.s_UplErrD');
  });

  it("... namely that the file is too large  TyTE2ETOOLGUPL", () => {
    maria_brB.waitForVisible('.e_FlTooLg');
  });

  it("Maria closes the error dialog", () => {
    maria_brB.stupidDialog.close();
  });

  it("... uploads an almost 1 MiB file instead (works fine)", () => {
    maria_brB.editor.uploadFile('TargetDir', zerosFileOneMiBAlmost);
  });

  it("Maria submits the reply", () => {
    maria_brB.editor.save();
  });

  let zerosReplyHtml: St;

  it("... it appears", () => {
    const zerosReplyNr = c.FirstReplyNr + 1;
    maria_brB.topic.waitForPostNrVisible(zerosReplyNr);
    zerosReplyHtml = maria_brB.topic.getPostHtml(zerosReplyNr);
  });

  it("... with a link to the tiny .zeros file", () => {
    assert.includes(zerosReplyHtml, `>${zerosFileOneKibibyte}</a> (1 KiB)`);
  });

  it("... and another link to the almost one MiB file  TyTE2EKILOKIBI", () => {
    // Note that prettyBytes(..) shows  0.99 MiB instead of 1013 KiB. [pretty_mebibytes]
    assert.includes(zerosReplyHtml, `>${zerosFileOneMiBAlmost}</a> (0.99 MiB)`);
  });



  // ----- Restrict max upload size


  it(`Owen changes max upload size to just 0.5 MiB — he not like 1 MiB zeros`, () => {
    owen_brA.waitAndSetValue('.s_PP_PrmsTb_UplMiB input', '0.5');
    owen_brA.waitAndClick('.e_SvPerms');
    owen_brA.waitUntilLoadingOverlayGone();
  });

  it(`Maria starts writing yet another reply`, () => {
    maria_brB.refresh2(); // refresh max upl size
    maria_brB.topic.clickReplyToOrigPost();
  });

  it(`... uploads the 1 MiB file again — but this time, won't work!`, () => {
    maria_brB.editor.uploadFile('TargetDir', zerosFileOneMiBAlmost,
          { waitForTooLargeErr: true });
  });

  it(`But she can upload a 0.49 MiB file`, () => {
    maria_brB.editor.uploadFile('TargetDir', zerosFile049MiB);
  });

  it(`... however 0.51 MiB won't work — 0.5 is the limit`, () => {
    maria_brB.editor.uploadFile('TargetDir', zerosFile051MiB,
          { waitForTooLargeErr: true });
  });

  it("Maria submits the reply", () => {
    maria_brB.editor.save();
  });

  let halfMiBZerosReplyHtml: St;

  it("... it appears", () => {
    const replyNr = c.FirstReplyNr + 2;
    maria_brB.topic.waitForPostNrVisible(replyNr);
    halfMiBZerosReplyHtml = maria_brB.topic.getPostHtml(replyNr);
  });

  it("... with a link to the 0.49 MiB .zeros file", () => {
    // 0.49 MiB = 0.49 * 1024 KiB = 501.76 KiB, apparently shown as 501, not 502:
    assert.includes(halfMiBZerosReplyHtml, `>${zerosFile049MiB}</a> (501 KiB)`);
  });



  // ----- Too large files: Server says No


  it("Maria hacks the browser side max file size", () => {
    maria_brB.execute(function() {
      window['theStore'].me.effMaxUplBytes = 999999999;
    })
  });

  it("... starts writing another reply", () => {
    maria_brB.topic.clickReplyToOrigPost();
  });

  it("... uploads the biggest file she has", () => {
    maria_brB.editor.uploadFile('TargetDir', zerosFileFourMebibyte);
  });

  it("... now the *server* says No  TyTE2ESVUPLCK", () => {
    maria_brB.serverErrorDialog.waitAndAssertTextMatches(
            /too large.*TyESVUPLSZCK_/s);
  });

  it("Maria closes the server error dialog", () => {
    maria_brB.serverErrorDialog.close();
  });

  it("... uploads a really small file", () => {
    maria_brB.editor.uploadFile('TargetDir', zerosFileTwoKibibyte);
  });

  it("... works fine; she can submit the reply", () => {
    maria_brB.editor.save();
  });

});


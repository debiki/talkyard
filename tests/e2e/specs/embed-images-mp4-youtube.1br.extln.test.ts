/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import tyZssert = require('../utils/ty-assert');
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
const forumTitle = "Editor Link Preview Forum";
const oneboxTopicTitle = "Link Preview Topic Title";

const dotOneboxClass = '.s_LnPv';

// Test links:

// The server should change this link to https, if the server uses https.
// [no_insec_emb] [E2EHTTPS]
const slashImageJpgUrl = '//www.example.com/image.jpg';
const httpImageJpgUrl = `http:${slashImageJpgUrl}`;
const imageJpgUrl = `${settings.scheme}:${slashImageJpgUrl}`;

// Let's use some more http links, unless the server uses https. [E2EHTTPS]
const imagePngUrl = `${settings.scheme}://www.example.com/image.png`;  // http, sometimes
const imageGifUrl = `${settings.scheme}://www.example.com/image.gif`;  //

const videoMp4Url = 'https://www.example.com/video.mp4';
const videoYouTubeIdInvalid = 'https://www.youtube.com/watch?v=DAR27FWzyZY';
const videoYouTubeId = 'DAR27FWzyZY';
const videoYouTubeUrl = `https://www.youtube.com/watch?v=${videoYouTubeId}`;
const videoYouTubeUrlInvalidId = `https://www.youtube.com/watch?v=${videoYouTubeIdInvalid}`;
const imageJpgOnebox = `aside.s_LnPv.s_LnPv-Img a[href="${imageJpgUrl}"] img[src="${imageJpgUrl}"]`;
const imagePngOnebox = `aside.s_LnPv.s_LnPv-Img a[href="${imagePngUrl}"] img[src="${imagePngUrl}"]`;
const imageGifOnebox = `aside.s_LnPv.s_LnPv-Img a[href="${imageGifUrl}"] img[src="${imageGifUrl}"]`;
const videoMp4Onebox = `aside.s_LnPv.s_LnPv-Video video[src="${videoMp4Url}"]`;
const videoYouTubeOnebox =
    `aside.s_LnPv.s_LnPv-YouTube iframe[src^="https://www.youtube.com/embed/${videoYouTubeId}"]`;


const inPagePreviewSelector = '.s_P-Prvw ';
const inEditorPreviewSelector = '#debiki-editor-controller .preview ';


// Also try w real pics & vids:  TESTS_MISSING
//  https://preview.redd.it/7fig79vdq4451.png?width=640&height=640&crop=smart&auto=webp&s=548214ef563f762152ab1c0733b37fbf16bad3c8
//  http://techslides.com/demos/sample-videos/small.mp4
// verify does resize & show?


describe("link-previews-images-mp4-youtube.1br.extln  TyTE2E2G3MAWKT4", () => {

  it("initialize people", () => {
    browser = new TyE2eTestBrowser(wdioBrowser);
    everyone = browser;
    owen = make.memberOwenOwner();
    owensBrowser = browser;
    maria = make.memberMaria();
    mariasBrowser = browser;
  });

  it("import a site", () => {
    let site: SiteData = make.forumOwnedByOwen('edr-ln-pv', { title: forumTitle });
    site.settings.allowGuestLogin = true;
    site.settings.requireVerifiedEmail = false;
    site.members.push(maria);
    idAddress = server.importSiteData(site);
  });

  it("Owen goes to the homepage and logs in", () => {
    owensBrowser.go2(idAddress.origin);
    owensBrowser.assertPageTitleMatches(forumTitle);
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
  });

  it("Owen opens the create-topic editor", () => {
    owensBrowser.forumButtons.clickCreateTopic();
  });

  it("Owen types a title and an image url", () => {
    owensBrowser.editor.editTitle(oneboxTopicTitle);
    assert.ok(httpImageJpgUrl.startsWith('http://'))
    owensBrowser.editor.editText(httpImageJpgUrl);  // will change to https
  });

  it("The image url gets converted to a .s_LnPv tag", () => {
    owensBrowser.preview.waitForExist(dotOneboxClass, { where: 'InEditor' });
    owensBrowser.waitForExist(inEditorPreviewSelector + dotOneboxClass);  // CLEAN_UP remove
  });

  it("... with an a[href=...] and img[src=...]", () => {
    // httpImageJpgUrl should have gotten changed to https, iff the server uses https:
    if (settings.scheme === 'https:') {
      assert.ok(imageJpgOnebox.includes('https:'));
      assert.ok(!imageJpgOnebox.includes('http:'));
    }
    owensBrowser.preview.waitForExist(imageJpgOnebox, { where: 'InEditor' });
    owensBrowser.waitForExist(inEditorPreviewSelector + imageJpgOnebox);  // CLEAN_UP remove
  });

  it("Owen saves the page", () => {
    owensBrowser.rememberCurrentUrl();
    owensBrowser.editor.save();
    owensBrowser.waitForNewUrl();
    owensBrowser.assertPageTitleMatches(oneboxTopicTitle);
  });

  it("... and sees the link preview <img> tag", () => {
    owensBrowser.waitForExist('.esOrigPost ' + dotOneboxClass);
    owensBrowser.waitForExist('.esOrigPost ' + imageJpgOnebox);
  });

  it("Owen edits the page, adds a video url", () => {
    owensBrowser.topic.clickEditOrigPost();
    owensBrowser.editor.editText(videoMp4Url, { checkAndRetry: true });
  });

  it("It appears as a link preview <video> tag in the preview", () => {
    owensBrowser.preview.waitForExist(dotOneboxClass, { where: 'InPage' });
    owensBrowser.waitForExist(inPagePreviewSelector + dotOneboxClass);  // CLEAN_UP remove

    owensBrowser.preview.waitForExist(videoMp4Onebox, { where: 'InPage' });
    owensBrowser.waitForExist(inPagePreviewSelector + videoMp4Onebox);  // CLEAN_UP remove
  });

  it("Owen saves the edits, sees both the preview <img> and the <video> tags", () => {
    owensBrowser.editor.save();
    owensBrowser.waitForExist('.esOrigPost ' + videoMp4Onebox);
  });

  // Let's do the remaining tests as a non-staff member.
  it("Owen leaves; Maria logs in", () => {
    owensBrowser.topbar.clickLogout();
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
    mariasBrowser.disableRateLimits();
  });

  it("She can also post image urls, which get converted to preview <img> tags", () => {
    mariasBrowser.complex.replyToOrigPost(imageJpgUrl);
    mariasBrowser.topic.waitUntilPostHtmlMatches(2, /\.jpg/);
    mariasBrowser.topic.assertPostNrContains(2, dotOneboxClass);
    mariasBrowser.topic.assertPostNrContains(2, imageJpgOnebox);
  });

  it("But unknown links won't get converted to oneboxes", () => {
    const weirdUrl = 'https://www.example.com/what.is.this.weirdweird';
    mariasBrowser.complex.replyToOrigPost(weirdUrl);
    mariasBrowser.topic.waitUntilPostTextMatches(3, 'weirdweird');
    mariasBrowser.topic.assertPostNrNotContains(3, dotOneboxClass);
    mariasBrowser.topic.assertPostNrContains(3, `a[href="${weirdUrl}"]`);
  });

  it("A media url inside a text paragraph is converted to a plain link", () => {
    mariasBrowser.complex.replyToOrigPost('zzz ' + imageJpgUrl + ' qqq');
    mariasBrowser.topic.waitUntilPostTextMatches(4, 'zzz .* qqq');
    mariasBrowser.topic.assertPostNrNotContains(4, dotOneboxClass);
    mariasBrowser.topic.assertPostNrContains(4, `a[href="${imageJpgUrl}"]`);
  });

  it("A link preview can be inserted between two text paragraphs", () => {
    mariasBrowser.complex.replyToOrigPost("Paragraph one.\n\n" + imageJpgUrl + "\n\nPara two.");
    mariasBrowser.topic.waitUntilPostTextMatches(5, "Paragraph one");
    mariasBrowser.topic.assertPostTextMatches(5, "Para two");
    // Failed once.
    mariasBrowser.topic.assertPostNrContains(5, dotOneboxClass);
    mariasBrowser.topic.assertPostNrContains(5, imageJpgOnebox);
  });

  it("Jpg, png, gif, mp4 link previews work fine", () => {
    // This happens to be 5 x 2 links, = 10, < max which is 11 [TyT603RTDJ43].
    // (Each link preview has a widget link, and also a "View at ..." clickable link.)
    mariasBrowser.complex.replyToOrigPost(
        httpImageJpgUrl + '\n\n' + // <— should get changed to https -.
        imagePngUrl + '\n\n' +     //                                 |
        imageGifUrl + '\n\n' +     //                                 |
        videoMp4Url + '\n\n' +     //                                 |
        videoYouTubeUrl);          //                                 |
    mariasBrowser.topic.waitUntilPostHtmlMatches(6, /\.jpg/);    //   |
    mariasBrowser.topic.assertPostNrContains(6, dotOneboxClass); //   |
    mariasBrowser.topic.assertPostNrContains(6, imageJpgOnebox); // <-'  here
    mariasBrowser.topic.assertPostNrContains(6, imagePngOnebox);
    mariasBrowser.topic.assertPostNrContains(6, imageGifOnebox);
    mariasBrowser.topic.assertPostNrContains(6, videoMp4Onebox);
  });

  it("... and YouTube links too", () => {
    mariasBrowser.topic.assertPostNrContains(6, videoYouTubeOnebox);
  });

  it("The server survives an invalid YouTube video id", () => {
    // Reply to the previous post because we've now scrolled down so the orig post isn't visible.
    mariasBrowser.complex.replyToPostNr(6, videoYouTubeUrlInvalidId + '\n\n\nPlain text.');
    mariasBrowser.topic.waitUntilPostTextMatches(7, "Plain text");
    mariasBrowser.topic.assertPostNrContains(7, '.s_LnPv-Err');
    mariasBrowser.topic.assertPostNrContains(7, `a[href="${videoYouTubeUrlInvalidId}"]`);
    mariasBrowser.topic.assertPostTextMatches(7, 'TyEYOUTBID_');
  });

});


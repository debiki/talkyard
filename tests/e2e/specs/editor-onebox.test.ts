/// <reference path="../test-types.ts"/>
/// <reference path="../../../modules/definitely-typed/lodash/lodash.d.ts"/>
/// <reference path="../../../modules/definitely-typed/mocha/mocha.d.ts"/>

import * as _ from 'lodash';
import server = require('../utils/server');
import utils = require('../utils/utils');
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import make = require('../utils/make');
import assert = require('assert');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

declare let browser: any;

let everyone;
let owen;
let owensBrowser;
let maria;
let mariasBrowser;

let idAddress: IdAddress;
let forumTitle = "Editor Onebox Forum";
let oneboxTopicTitle = "Onebox Topic Title";

let dotOneboxClass = '.onebox';

let imageJpgUrl = 'http://www.example.com/image.jpg';
let imagePngUrl = 'http://www.example.com/image.png';
let imageGifUrl = 'http://www.example.com/image.gif';
let videoMp4Url = 'http://www.example.com/video.mp4';
let videoYouTubeIdInvalid = 'https://www.youtube.com/watch?v=DAR27FWzyZY';
let videoYouTubeId = 'DAR27FWzyZY';
let videoYouTubeUrl = `https://www.youtube.com/watch?v=${videoYouTubeId}`;
let videoYouTubeUrlInvalidId = `https://www.youtube.com/watch?v=${videoYouTubeIdInvalid}`;
let imageJpgOnebox = `aside.onebox.dw-ob-image a[href="${imageJpgUrl}"] img[src="${imageJpgUrl}"]`;
let imagePngOnebox = `aside.onebox.dw-ob-image a[href="${imagePngUrl}"] img[src="${imagePngUrl}"]`;
let imageGifOnebox = `aside.onebox.dw-ob-image a[href="${imageGifUrl}"] img[src="${imageGifUrl}"]`;
let videoMp4Onebox = `aside.onebox.dw-ob-video video[src="${videoMp4Url}"]`;
let videoYouTubeOnebox =
    `aside.onebox.dw-ob-youtube iframe[src^="https://www.youtube.com/embed/${videoYouTubeId}"]`;


describe("editor onebox:", () => {

  it("initialize people", () => {
    browser.perhapsDebugBefore();
    browser = _.assign(browser, pagesFor(browser));
    everyone = browser;
    owen = make.memberOwenOwner();
    owensBrowser = browser;
    maria = make.memberMaria();
    mariasBrowser = browser;
  });

  it("import a site", () => {
    let site: SiteData = make.forumOwnedByOwen('editor-onebox', { title: forumTitle });
    site.settings.allowGuestLogin = true;
    site.members.push(maria);
    idAddress = server.importSiteData(site);
  });

  it("Owen goes to the homepage and logs in", () => {
    owensBrowser.go(idAddress.origin);
    owensBrowser.assertPageTitleMatches(forumTitle);
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
  });

  it("Owen opens the create-topic editor", () => {
    owensBrowser.forumButtons.clickCreateTopic();
  });

  it("Owen types a title and an image url", () => {
    owensBrowser.editor.editTitle(oneboxTopicTitle);
    owensBrowser.editor.editText(imageJpgUrl);
  });

  it("The image url gets converted to an onebox <img> tag", () => {
    // Something in here timed out once.
    // Do this in two steps, so, if breaks, will be simpler to find out what's broken.
    owensBrowser.waitForVisible('#debiki-editor-controller .preview ' + dotOneboxClass);
    owensBrowser.waitForVisible('#debiki-editor-controller .preview ' + imageJpgOnebox);
  });

  it("Owen saves the page", () => {
    owensBrowser.rememberCurrentUrl();
    owensBrowser.editor.save();
    owensBrowser.waitForNewUrl();
    owensBrowser.assertPageTitleMatches(oneboxTopicTitle);
  });

  it("... and sees the onebox <img> tag", () => {
    owensBrowser.waitForVisible('.esOrigPost ' + dotOneboxClass);
    owensBrowser.waitForVisible('.esOrigPost ' + imageJpgOnebox);
  });

  it("Owen edits the page, adds a video url", () => {
    owensBrowser.topic.clickEditOrigPost();
    owensBrowser.editor.editText(videoMp4Url);
  });

  it("It appears as a onebox <video> tag in the preview", () => {
    owensBrowser.waitForVisible('#debiki-editor-controller .preview ' + dotOneboxClass);
    owensBrowser.waitForVisible('#debiki-editor-controller .preview ' + videoMp4Onebox);
  });

  it("Owen saves the edits, sees both the onebox <img> and the <video> tags", () => {
    owensBrowser.editor.save();
    owensBrowser.waitForVisible('.esOrigPost ' + videoMp4Onebox);
  });

  // Let's do the remaining tests as a non-staff member.
  it("Owen leaves; Maria logs in", () => {
    owensBrowser.topbar.clickLogout();
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
    mariasBrowser.disableRateLimits();
  });

  it("She can also post image urls, which get converted to onebox <img> tags", () => {
    mariasBrowser.complex.replyToOrigPost(imageJpgUrl);
    mariasBrowser.topic.waitForPostNrVisible(2);
    assert(mariasBrowser.topic.postNrContains(2, dotOneboxClass));
    assert(mariasBrowser.topic.postNrContains(2, imageJpgOnebox));
  });

  it("But unknown links won't get converted to oneboxes", () => {
    let weirdUrl = 'http://www.example.com/what.is.this.weirdweird';
    mariasBrowser.complex.replyToOrigPost('http://www.example.com/what.is.this.weirdweird');
    mariasBrowser.topic.waitForPostNrVisible(3);
    assert(!mariasBrowser.topic.postNrContains(3, dotOneboxClass));
    assert(mariasBrowser.topic.postNrContains(3, `a[href="${weirdUrl}"]`));
  });

  it("A media url inside a text paragraph is converted to a link, not a onebox", () => {
    mariasBrowser.complex.replyToOrigPost('zzz ' + imageJpgUrl + ' qqq');
    mariasBrowser.topic.waitForPostNrVisible(4);
    assert(!mariasBrowser.topic.postNrContains(4, dotOneboxClass));
    assert(mariasBrowser.topic.postNrContains(4, `a[href="${imageJpgUrl}"]`));
    mariasBrowser.topic.assertPostTextMatches(4, 'zzz .* qqq');
  });

  it("A onebox can be inserted between two text paragraphs", () => {
    mariasBrowser.complex.replyToOrigPost("Paragraph one.\n\n" + imageJpgUrl + "\n\nPara two.");
    mariasBrowser.topic.waitForPostNrVisible(5);
    mariasBrowser.topic.assertPostTextMatches(5, "Paragraph one");
    mariasBrowser.topic.assertPostTextMatches(5, "Para two");
    // Failed once.
    assert(mariasBrowser.topic.postNrContains(5, dotOneboxClass));
    assert(mariasBrowser.topic.postNrContains(5, imageJpgOnebox));
  });

  it("Jpg, png, gif, mp4, YouTube oneboxes work fine", () => {
    mariasBrowser.complex.replyToOrigPost(
        imageJpgUrl + '\n\n' +
        imagePngUrl + '\n\n' +
        imageGifUrl + '\n\n' +
        videoMp4Url + '\n\n' +
        videoYouTubeUrl);
    mariasBrowser.topic.waitForPostNrVisible(6);
    assert(mariasBrowser.topic.postNrContains(6, dotOneboxClass));
    assert(mariasBrowser.topic.postNrContains(6, imageJpgOnebox));
    assert(mariasBrowser.topic.postNrContains(6, imagePngOnebox));
    assert(mariasBrowser.topic.postNrContains(6, imageGifOnebox));
    assert(mariasBrowser.topic.postNrContains(6, videoMp4Onebox));
    assert(mariasBrowser.topic.postNrContains(6, videoYouTubeOnebox));
  });

  it("The server survives an invalid YouTube video id", () => {
    // Reply to the previous post because we've now scrolled down so the orig post isn't visible.
    mariasBrowser.complex.replyToPostNr(6, videoYouTubeUrlInvalidId + '\n\n\nPlain text.');
    mariasBrowser.topic.waitForPostNrVisible(7);
    assert(!mariasBrowser.topic.postNrContains(7, dotOneboxClass));
    assert(mariasBrowser.topic.postNrContains(7, `a[href="${videoYouTubeUrlInvalidId}"]`));
    mariasBrowser.topic.assertPostTextMatches(7, "Plain text");
  });

  it("Done", () => {
    everyone.perhapsDebug();
  });

});


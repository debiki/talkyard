/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import fs = require('fs');
import server = require('../utils/server');
import utils = require('../utils/utils');
import pages = require('../utils/pages');
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import make = require('../utils/make');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

declare let browser: any;

let everyonesBrowsers;
let owen;
let owensBrowser;
let gmailUsersBrowser;
let maria;
let mariasBrowser;

let data;


const specifiedEmbeddingHost =                 'e2e-test--gatsby-starter-blog.localhost';
const commentsSiteLocalHostname = 'comments-for-e2e-test--gatsby-starter-blog-localhost';
const blogUrl = 'http://localhost:8000/';

const owensHiFolksComment = 'owensHiFolksComment';
const owens2ndPostComment = 'owens2ndPostComment';


// Gatsby uses React.js and does history.push + unmounts & remounts React components,
// to navigate to a new page. This spec ensures the Talkyard embedded
// comments plugin handles these un- & re-mounts well, i.e. always shows the correct comments.
//
describe("embedded comments, Gatsby blog and un/re-mmounting comments", () => {

  it("initialize people", () => {
    everyonesBrowsers = _.assign(browser, pagesFor(browser));

    owensBrowser = _.assign(browser, pagesFor(browser));
    mariasBrowser = owensBrowser;
    gmailUsersBrowser = owensBrowser;

    owen = make.memberOwenOwner();
    maria = make.memberMaria();
  });

  function createPasswordTestData() {
    const testId = utils.generateTestId();
    const localHostname     = commentsSiteLocalHostname; // specifiedEmbeddingAddr.replace(/[.:]/, '-');
    return {
      testId: testId,
      embeddingUrl: `http://${specifiedEmbeddingHost}/`,
      origin: `${settings.scheme}://${commentsSiteLocalHostname}.localhost`,
      orgName: "E2E Gatsby",
      fullName: owen.fullName,
      email: owen.emailAddress,
      // Prefix the number with 'z' because '..._<number>' is reserved. [7FLA3G0L]
      username: owen.username,
      password: owen.password,
    }
  }

  it("delete old site with same local hostname", () => {
    server.deleteOldTestSite(commentsSiteLocalHostname); //`comments-for-${specifiedEmbeddingAddr}`);
  });

  it('Owen creates an embedded comments site as a Password user  @login @password', () => {
    data = createPasswordTestData();
    owensBrowser.go(utils.makeCreateEmbeddedSiteWithFakeIpUrl());
    owensBrowser.disableRateLimits();
    owensBrowser.createSite.fillInFieldsAndSubmit(data);
    // New site; disable rate limits here too.
    owensBrowser.disableRateLimits();
    owensBrowser.createSite.clickOwnerSignupButton();
    owensBrowser.loginDialog.createPasswordAccount(data, true);
    const siteId = owensBrowser.getSiteId();
    const email = server.getLastEmailSenTo(siteId, data.email, owensBrowser);
    const link = utils.findFirstLinkToUrlIn(
        data.origin + '/-/login-password-confirm-email', email.bodyHtmlText);
    owensBrowser.go(link);
    owensBrowser.waitAndClick('#e2eContinue');
  });


  it("Sees embedded comments config values", () => {
    owensBrowser.adminArea.waitAssertVisible();
  });


  it("Changes the embedding url from e2e-test--gatsby-starter-blog, to localhost", () => {
    owensBrowser.waitForVisible('#e_AllowEmbFrom');
    const oldEmbeddingUrl = owensBrowser.getValue('#e_AllowEmbFrom');
    assert(oldEmbeddingUrl === `http://${specifiedEmbeddingHost}/`);
    // Need do this twice, maybe because the first attempt is somehow interrupted by the Save
    // button appearing.
    owensBrowser.setValue('#e_AllowEmbFrom', blogUrl);
    owensBrowser.setValue('#e_AllowEmbFrom', blogUrl);
    owensBrowser.adminArea.settings.clickSaveAll();
  });


  it("Goes to the Gatsby site, /hi-folks/", () => {
    owensBrowser.go(blogUrl);
    owensBrowser.waitAndClick('a[href*="hi-folks"]');
  });

  // Small steps here — was an e2e bug here before, without scrollToBottom() just below.

  it("... switches to the comments iframe", () => {
    owensBrowser.waitForEmbeddedCommentsIframe();
    owensBrowser.scrollToBottom();
    owensBrowser.switchToEmbeddedCommentsIrame();
  });

  it("... clicks Reply to post a comment", () => {
    owensBrowser.topic.clickReplyToEmbeddingBlogPost();
    // (Alredy logged in.)
  });

  it("... switches to the editor iframe", () => {
    owensBrowser.switchToEmbeddedEditorIrame();
  });

  it("... composes a comment", () => {
    owensBrowser.editor.editText(owensHiFolksComment);
    owensBrowser.editor.save();
    owensBrowser.switchToEmbeddedCommentsIrame();
    owensBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);
    owensBrowser.topic.postNrContains(c.FirstReplyNr, owensHiFolksComment);
  });

  it("Goes to /my-second-post", () => {
    owensBrowser.frameParent();
    owensBrowser.scrollToTop();
    owensBrowser.click('a[href="/"]');
    owensBrowser.waitAndClick('a[href*="my-second-post"]');
  });

  it("... posts a second comment", () => {
    owensBrowser.waitForEmbeddedCommentsIframe();
    owensBrowser.scrollToBottom();
    owensBrowser.complex.replyToEmbeddingBlogPost(owens2ndPostComment);
    owensBrowser.switchToEmbeddedCommentsIrame();
    owensBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);
    owensBrowser.topic.postNrContains(c.FirstReplyNr, owens2ndPostComment);
  });

  it("... the comment appears on the other page with the same discussion id", () => {
    owensBrowser.frameParent();
    owensBrowser.scrollToTop();
    owensBrowser.click('a[href="/"]');
    owensBrowser.waitAndClick('a[href*="same-discussion-id-as-2nd-post"]');
    owensBrowser.switchToEmbeddedCommentsIrame();
    owensBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);  // because same discussion id
    owensBrowser.topic.postNrContains(c.FirstReplyNr, owens2ndPostComment);
  });

  it("... the last blog post is still empty", () => {
    owensBrowser.frameParent();
    owensBrowser.scrollToTop();
    owensBrowser.waitAndClick('a[href="/"]');
    // This *= selector causes an error in waitUntilElementNotOccluded().
    // There's nothing that can occlude this link, so just skip the check.
    owensBrowser.waitAndClick('a[href*="hello-world"]', { waitUntilNotOccluded: false });
    owensBrowser.switchToEmbeddedCommentsIrame();
    owensBrowser.waitForVisible('.dw-a-logout'); // then comments have loaded
    owensBrowser.topic.assertNumRepliesVisible(0); // no replies on this page
    owensBrowser.waitAndClick('.dw-a-logout');
  });


  it("Maria arrives", () => {
    owensBrowser.frameParent();
    mariasBrowser.go('/same-discussion-id-as-2nd-post');
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);  // because same discussion id
    mariasBrowser.topic.postNrContains(c.FirstReplyNr, owens2ndPostComment);
  });

});


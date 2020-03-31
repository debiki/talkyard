/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import fs = require('fs');
import server = require('../utils/server');
import utils = require('../utils/utils');
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

  if (settings.secure) {
    console.log("Skipping this test — it currently doesn't work with https");  // [GATSBYHTTPS]
    return;
  }

  it("initialize people", () => {
    everyonesBrowsers = _.assign(browser, pagesFor(browser));

    owensBrowser = everyonesBrowsers;
    mariasBrowser = everyonesBrowsers;
    gmailUsersBrowser = everyonesBrowsers;

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
    owensBrowser.go2(utils.makeCreateEmbeddedSiteWithFakeIpUrl());
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
    owensBrowser.go2(link);
    owensBrowser.waitAndClick('#e2eContinue');
  });


  it("Sees embedded comments config values", () => {
    owensBrowser.adminArea.waitAssertVisible();
  });


  it("Changes the embedding url from e2e-test--gatsby-starter-blog, to localhost", () => {
    owensBrowser.waitForVisible('#e_AllowEmbFrom');
    const oldEmbeddingUrl = owensBrowser.$('#e_AllowEmbFrom').getValue();
    assert(oldEmbeddingUrl === `http://${specifiedEmbeddingHost}/`);

    // Need do this twice, maybe because the first attempt is somehow interrupted by the Save
    // button appearing.
    // wdio v6: Works now? delete this?
    //owensBrowser.waitAndSetValue('#e_AllowEmbFrom', blogUrl);

    owensBrowser.waitAndSetValue('#e_AllowEmbFrom', blogUrl);
    owensBrowser.adminArea.settings.clickSaveAll();
  });


  it("Goes to the Gatsby site, /hi-folks/", () => {
    owensBrowser.go2(blogUrl, { isExternalPage: true });
    owensBrowser.waitAndClick('a[href*="hi-folks"]', { waitUntilNotOccluded: false });
  });

  // Small steps here — was an e2e bug here before, without scrollToBottom() just below.

  it("... switches to the comments iframe", () => {
    owensBrowser.waitForEmbeddedCommentsIframe();
    owensBrowser.scrollToBottom();
  });

  it("... clicks Reply to post a comment", () => {
    owensBrowser.topic.clickReplyToEmbeddingBlogPost();
    // (Alredy logged in.)
  });

  it("... composes a comment", () => {
    owensBrowser.editor.editText(owensHiFolksComment);
    owensBrowser.editor.save();
    owensBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);
    owensBrowser.topic.postNrContains(c.FirstReplyNr, owensHiFolksComment);
  });

  it("Goes to /my-second-post", () => {
    owensBrowser.switchToAnyParentFrame();
    owensBrowser.repeatUntilAtNewUrl(() => {
      owensBrowser.scrollToTop();  // [E2ENEEDSRETRY]
      owensBrowser.waitAndClick('a[href="/"]', { waitUntilNotOccluded: false });
    });
    owensBrowser.repeatUntilAtNewUrl(() => {
      owensBrowser.waitAndClick('a[href*="my-second-post"]', { waitUntilNotOccluded: false });
    });
  });

  it("... posts a second comment", () => {
    owensBrowser.waitForEmbeddedCommentsIframe();
    owensBrowser.scrollToBottom();
    owensBrowser.complex.replyToEmbeddingBlogPost(owens2ndPostComment);
    owensBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);
    owensBrowser.topic.postNrContains(c.FirstReplyNr, owens2ndPostComment);
  });

  it("... the comment appears on the other page with the same discussion id", () => {
    owensBrowser.switchToAnyParentFrame();
    owensBrowser.repeatUntilAtNewUrl(() => {
      owensBrowser.scrollToTop();  // [E2ENEEDSRETRY]
      owensBrowser.waitAndClick('a[href="/"]', { waitUntilNotOccluded: false });
    });
    owensBrowser.repeatUntilAtNewUrl(() => {
      owensBrowser.waitAndClick('a[href*="same-discussion-id-as-2nd-post"]', { waitUntilNotOccluded: false });
    });
    owensBrowser.updateIsWhere();
    owensBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);  // because same discussion id
    owensBrowser.topic.postNrContains(c.FirstReplyNr, owens2ndPostComment);
  });

  it("... the last blog post is still empty", () => {
    owensBrowser.switchToAnyParentFrame();
    owensBrowser.repeatUntilAtNewUrl(() => {
      owensBrowser.scrollToTop();
      owensBrowser.waitAndClick('a[href="/"]', { waitUntilNotOccluded: false });
    });
    // This *= selector causes an error in waitUntilElementNotOccluded().
    // There's nothing that can occlude this link, so just skip the check.
    owensBrowser.repeatUntilAtNewUrl(() => {
      owensBrowser.waitAndClick('a[href*="hello-world"]', { waitUntilNotOccluded: false });
    });
    owensBrowser.updateIsWhere();
    owensBrowser.switchToEmbeddedCommentsIrame();
    owensBrowser.waitForVisible('.dw-a-logout'); // then comments have loaded
    owensBrowser.topic.assertNumRepliesVisible(0); // no replies on this page
    owensBrowser.waitAndClick('.dw-a-logout');
  });


  it("Maria arrives", () => {
    owensBrowser.switchToAnyParentFrame();
    mariasBrowser.go2('/same-discussion-id-as-2nd-post');
    mariasBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);  // because same discussion id
    mariasBrowser.topic.postNrContains(c.FirstReplyNr, owens2ndPostComment);
  });

});


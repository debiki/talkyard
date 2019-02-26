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
import { disableIncrementalParsing } from 'typescript';

declare let browser: any;

let everyonesBrowsers;
let maria;
let mariasBrowser;

let idAddress: IdAddress;
let siteId: any;

const dir = 'target';
const localHostname = 'comments-for-e2e-test-embdscid-localhost-8080';
const embeddingOrigin = 'http://e2e-test-embdscid.localhost:8080';

// The ids shall be RGB colors.
const discussionIdx00 = '500';
const discussionId0x0 = '050';
const discussionId00x = '005';

const pageSlug = 'emb-cmts-samepage.html';

const mariasCommentOne = `mariasCommentOne discussion id ${discussionIdx00}`;
const mariasCommentTwo = `mariasCommentTwo discussion id ${discussionId0x0}`;
const mariasCommentThree = `mariasCommentThree no discussion id`;


describe("emb cmts different ids same page  TyT2BKPJL3", () => {

  it("initialize people", () => {
    everyonesBrowsers = _.assign(browser, pagesFor(browser));
    mariasBrowser = everyonesBrowsers;
    maria = make.memberMaria();
  });

  it("import a site", () => {
    const site: SiteData = make.forumOwnedByOwen('embdiffrids',
        { title: "Emb Cmts Difr Ids Same Page" });
    site.meta.localHostname = localHostname;
    site.settings.allowEmbeddingFrom = embeddingOrigin;
    site.members.push(maria);
    idAddress = server.importSiteData(site);
    siteId = idAddress.id;
  });

  function saveEmbeddingPage(discussionId: string) {
    const bgColor = discussionId ? '#' + discussionId : '#000';
    const html = utils.makeEmbeddedCommentsHtml({
        pageName: pageSlug, discussionId, localHostname, bgColor });
    fs.writeFileSync(`${dir}/${pageSlug}`, html);
  }


  // ----- The first embedded topic, id x00

  it("create an embedding page ppp with id x00", () => {
    saveEmbeddingPage(discussionIdx00);
  });

  it("Maria opens embedding page x00", () => {
    mariasBrowser.go(embeddingOrigin + '/' + pageSlug);
  });

  it("... clicks Reply and logs in", () => {
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.clickReplyToEmbeddingBlogPost();
    mariasBrowser.loginDialog.loginWithPasswordInPopup(maria);
  });

  it("... writes a comment", () => {
    mariasBrowser.switchToEmbeddedEditorIrame();
    mariasBrowser.editor.editText(mariasCommentOne);
  });

  it("... saves it. This creates a topic associated both to id x00, and to the URL", () => {
    mariasBrowser.editor.save();
  });

  it("... it appears", () => {
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);
    mariasBrowser.topic.assertPostTextMatches(c.FirstReplyNr, mariasCommentOne);
  });


  // ----- The 2nd id, 0x0

  it("The discussion id mysteriously changes from x00 to 0x0", () => {
    saveEmbeddingPage(discussionId0x0);
  });

  it("When Maria refreshes the page; now, the discussion is gone", () => {
    mariasBrowser.refresh()
  });

  it("She writes another comment", () => {
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.clickReplyToEmbeddingBlogPost();
    mariasBrowser.switchToEmbeddedEditorIrame();
    mariasBrowser.editor.editText(mariasCommentTwo);
  });

  it("... saves it. This creates a topic associated only to the id; URL already taken", () => {
    // The URL and id x00 are associated to embedde topic 1.
    // This createds embedded topic 2, which won't have any associated URL, only an ID.
    mariasBrowser.editor.save();
  });

  it("... it appears, as the first reply", () => {
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);
    mariasBrowser.topic.assertPostTextMatches(c.FirstReplyNr, mariasCommentTwo);
  });


  // ----- No id

  it("The discussion id disappears. No one knows why", () => {
    saveEmbeddingPage('');
  });

  it("When Maria refreshes the page", () => {
    mariasBrowser.refresh()
  });

  it("... the 1st discusssion is back — because it's associated with the URL", () => {
    // This is how the ids look, in the database:
    //
    // > select * from alt_page_ids3 order by site_id asc limit 3;
    // site_id |                            alt_page_id                         | real_page_id
    // --------+----------------------------------------------------------------+-------------
    //    -346 | 050                                                            | 2
    //    -346 | 500                                                            | 1
    //    -346 | http://e2e-test-embdscid.localhost:8080/emb-cmts-samepage.html | 1
    //
    // Note that real_page_id 1 is associated to both the url, and to
    // discussion id x00 (i.e. 500). That's why we'll see the x00 discussion again,
    // although the id is absent.

    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.assertNumOrigPostRepliesVisible(1);
    mariasBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);
    mariasBrowser.topic.assertPostTextMatches(c.FirstReplyNr, mariasCommentOne);
  });

  it("She posts a comment on the now id less page", () => {
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.clickReplyToEmbeddingBlogPost();
    mariasBrowser.switchToEmbeddedEditorIrame();
    mariasBrowser.editor.editText(mariasCommentThree);
    mariasBrowser.editor.save();
  });

  it("... it appears, as the 2nd reply", () => {
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.waitForPostNrVisible(c.FirstReplyNr + 1);
    mariasBrowser.topic.assertPostTextMatches(c.FirstReplyNr + 1, mariasCommentThree);
  });


  // ----- The 2nd id again

  it("The discussion id, unexpectedly, changes back to 0x0", () => {
    saveEmbeddingPage(discussionId0x0);
  });

  it("Maria again refreshes the page", () => {
    mariasBrowser.refresh()
  });

  it("Now, the second discussion is there again", () => {
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);
    mariasBrowser.topic.assertPostTextMatches(c.FirstReplyNr, mariasCommentTwo);
  });


  // ----- The first id again

  it("The discussion id changes to x00", () => {
    saveEmbeddingPage(discussionIdx00);
  });

  it("Maria refreshes the page. For no reason", () => {
    mariasBrowser.refresh()
  });

  it("Now, the first discussion is back, with two comments", () => {
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.assertNumOrigPostRepliesVisible(2);
    mariasBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);
    mariasBrowser.topic.assertPostTextMatches(c.FirstReplyNr, mariasCommentOne);
    mariasBrowser.topic.waitForPostNrVisible(c.FirstReplyNr + 1);
    mariasBrowser.topic.assertPostTextMatches(c.FirstReplyNr + 1, mariasCommentThree);
  });


  // ----- A 3rd id, page empty

  it("Now the discussion id changes to 00x, never seen before", () => {
    saveEmbeddingPage(discussionId00x);
  });

  it("Maria refreshes the page", () => {
    // No embedded discussion topic has been created for this discussion id.
    mariasBrowser.refresh()
  });

  it("There's nothing there", () => {
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.assertNumOrigPostRepliesVisible(0);
  });


  // ----- Back to the No id html

  it("The id disappears again", () => {
    saveEmbeddingPage('');
  });

  it("Maria refreshes the page", () => {
    mariasBrowser.refresh()
  });

  it("Now, the discussion with no id, is there", () => {
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.assertNumOrigPostRepliesVisible(2);
    mariasBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);
    mariasBrowser.topic.assertPostTextMatches(c.FirstReplyNr, mariasCommentOne);
    mariasBrowser.topic.waitForPostNrVisible(c.FirstReplyNr + 1);
    mariasBrowser.topic.assertPostTextMatches(c.FirstReplyNr + 1, mariasCommentThree);
  });

});

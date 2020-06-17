/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import fs = require('fs');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import make = require('../utils/make');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

let browser: TyE2eTestBrowser;

let everyonesBrowsers;
let maria;
let mariasBrowser: TyE2eTestBrowser;
let strangersBrowser: TyE2eTestBrowser;

let data;
let idAddress: IdAddress;
let siteId: any;

const mariasCommentOne = 'mariasCommentOne';
const mariasCommentTwo = 'mariasCommentTwo';
const mariasCommentThree = 'mariasCommentThree';

const localHostname = 'comments-for-e2e-test-embdscid-localhost-8080';
const embeddingOrigin = 'http://e2e-test-embdscid.localhost:8080';
const pageAaaSlug = 'emb-cmts-aaa.html';
const pageBbbSlug = 'emb-cmts-bbb.html';
const pageCccSlug = 'emb-cmts-ccc.html';


describe("emb-cmts.discussion-id  TyT603KRDL46", () => {

  it("initialize people", () => {
    everyonesBrowsers = new TyE2eTestBrowser(wdioBrowser);
    mariasBrowser = everyonesBrowsers;
    maria = make.memberMaria();
  });

  it("import a site", () => {
    const site: SiteData = make.forumOwnedByOwen('embdscid', { title: "Emb Cmts Disc Id Test" });
    site.meta.localHostname = localHostname;
    site.settings.allowEmbeddingFrom = embeddingOrigin;
    site.members.push(maria);
    idAddress = server.importSiteData(site);
    siteId = idAddress.id;
  });

  it("create two embedding pages aaa & bbb with the same id, and a third, ccc, with no id", () => {
    const dir = 'target';
    fs.writeFileSync(`${dir}/${pageAaaSlug}`, makeHtml('aaa', '123abc', '#500'));
    fs.writeFileSync(`${dir}/${pageBbbSlug}`, makeHtml('bbb', '123abc', '#040'));
    fs.writeFileSync(`${dir}/${pageCccSlug}`, makeHtml('ccc', '', '#005'));
    function makeHtml(pageName: string, discussionId: string, bgColor: string): string {
      return utils.makeEmbeddedCommentsHtml({ pageName, discussionId, localHostname, bgColor});
    }
  });

  it("Maria opens embedding page aaa", () => {
    mariasBrowser.go(embeddingOrigin + '/' + pageAaaSlug);
  });

  it("... clicks Reply and logs in", () => {
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.clickReplyToEmbeddingBlogPost();
    mariasBrowser.loginDialog.loginWithPasswordInPopup(maria);
  });

  it("... writes and submits a comment", () => {
    mariasBrowser.switchToEmbeddedEditorIrame();
    mariasBrowser.editor.editText(mariasCommentOne);
    mariasBrowser.editor.save();
  });

  it("... it appears", () => {
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr, mariasCommentOne);
  });

  it("she goes from page aaa to bbb", () => {
    let source = mariasBrowser.getSource();
    assert(source.indexOf('aaa') > 0);
    mariasBrowser.go(embeddingOrigin + '/' + pageBbbSlug);
    source = mariasBrowser.getSource();
    assert(source.indexOf('bbb') > 0);
  });

  it("... sees her comment, because same discussion id", () => {
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr, mariasCommentOne);
  });

  it("she posts a comment on page bbb (already logged in)", () => {
    mariasBrowser.topic.clickReplyToPostNr(c.FirstReplyNr);
    mariasBrowser.switchToEmbeddedEditorIrame();
    mariasBrowser.editor.editText(mariasCommentTwo);
    mariasBrowser.editor.save();
  });

  it("... comment two appears too", () => {
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr + 1, mariasCommentTwo);
  });

  it("page ccc is unchanged, because has no id, so url used instead", () => {
    mariasBrowser.topic.waitForReplyButtonAssertCommentsVisible();
    mariasBrowser.go(embeddingOrigin + '/' + pageCccSlug);
    let source = mariasBrowser.getSource();
    assert(source.indexOf('ccc') > 0);
    mariasBrowser.switchToEmbeddedCommentsIrame();
    // Give any stuff that appears although it shouldn't, some time to load.
    mariasBrowser.pause(500);
    mariasBrowser.topic.waitForReplyButtonAssertNoComments();
  });

  it("she posts a reply on page ccc", () => {
    mariasBrowser.topic.clickReplyToEmbeddingBlogPost();
    mariasBrowser.switchToEmbeddedEditorIrame();
    mariasBrowser.editor.editText(mariasCommentThree);
    mariasBrowser.editor.save();
  });

  it("... the comment appears", () => {
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr, mariasCommentThree);
  });

  it("back on page aaa, only the page-aaa and -bbb comments are shown (not the -ccc comment)", () => {
    mariasBrowser.go(embeddingOrigin + '/' + pageAaaSlug);
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr, mariasCommentOne);
    mariasBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr + 1, mariasCommentTwo);
  });

  it("... the same on page bbb", () => {
    mariasBrowser.go(embeddingOrigin + '/' + pageBbbSlug);
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr, mariasCommentOne);
    mariasBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr + 1, mariasCommentTwo);
  });

});


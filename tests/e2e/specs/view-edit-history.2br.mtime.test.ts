/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('../utils/ty-assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import lad = require('../utils/log-and-die');
import c = require('../test-constants');





let everyonesBrowsers;
let richBrowserA;
let richBrowserB;
let owen: Member;
let owensBrowser: TyE2eTestBrowser;
let maria: Member;
let mariasBrowser: TyE2eTestBrowser;
let strangersBrowser: TyE2eTestBrowser;

let siteIdAddress: IdAddress;
let siteId;

let forum: TwoPagesTestForum;

const approved = 'Approved';
const edited = 'EDITED';
const original = 'original';
const ninjaEdited = 'ninjaEdited';
const ooooones = '1111111';
const twooooos = '2222222';
const threeees = '3333333';
const owenWrote = 'owenWrote';

const addPostOneApprovedSource_111 = `addPostOne ${approved} oh the source ${ooooones}`;
const addPostOneEditedSource_222 = `addPostOne ${edited} oh the source ${twooooos}`;

const newReply = 'newReply';
const newReply_original    = `${newReply} ${original}`;
const newReply_ninjaEdited = `${newReply} ${ninjaEdited}`;
const newReply_22222       = `${newReply} ${twooooos}`;
const owenWrote_newReply_33333 = `${owenWrote} ${newReply} ${threeees}`;

let michaelsTopicUrl: string;


describe("view-edit-history  TyT60RKDWL25", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      title: "View Edit History E2E Test",
      members: undefined, // default = everyone
    });
    builder.addPost({
      page: forum.topics.byMichaelCategoryA,
      nr: c.FirstReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.maria.id,
      approvedSource: addPostOneApprovedSource_111,
    });
    assert.ok(builder.getSite() === forum.siteData);
    siteIdAddress = server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
    server.skipRateLimits(siteId);
    michaelsTopicUrl = siteIdAddress.origin + '/' + forum.topics.byMichaelCategoryA.slug;
  });

  it("initialize people", () => {
    everyonesBrowsers = new TyE2eTestBrowser(allWdioBrowsers);
    richBrowserA = new TyE2eTestBrowser(browserA);
    richBrowserB = new TyE2eTestBrowser(browserB);

    owen = forum.members.owen;
    owensBrowser = richBrowserA;

    strangersBrowser = owensBrowser;

    maria = forum.members.maria;
    mariasBrowser = richBrowserB;
  });

  it("Everyone wants to see Michael's topic", () => {
    everyonesBrowsers.go(michaelsTopicUrl);
  });

  it("There's no view-old-edits button", () => {
    assert.ok(!strangersBrowser.topic.isViewEditsButtonVisible(c.FirstReplyNr));
  });

  it("Maria logs in", () => {
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  it("... edits her old reply", () => {
    mariasBrowser.complex.editPostNr(c.FirstReplyNr, addPostOneEditedSource_222);
  });

  it("... a view-old-edits button appears", () => {
    // Need not refresh. (692096K0)
    mariasBrowser.topic.waitForViewEditsButton(c.FirstReplyNr);
  });

  it("... a stranger sees it too", () => {
    strangersBrowser.refresh();
    strangersBrowser.topic.waitForViewEditsButton(c.FirstReplyNr);
  });

  it("Maria posts a new reply", () => {
    mariasBrowser.complex.replyToPostNr(c.FirstReplyNr, newReply_original);
  });

  it("... ninja-edits it — no new revision created  TyTNINJA01", () => {
    mariasBrowser.complex.editPostNr(c.FirstReplyNr + 1, newReply_ninjaEdited);
  });

  it("... no view-old-edits button appears", () => {
    // Need not refresh. (692096K0)
    assert.ok(!mariasBrowser.topic.isViewEditsButtonVisible(c.FirstReplyNr + 1));
    // Test the test, that this fn works, can return true:
    assert.ok(mariasBrowser.topic.isViewEditsButtonVisible(c.FirstReplyNr));
  });

  it("... a stranger sees the ninja edited text, but no view-edit-history button", () => {
    strangersBrowser.refresh();
    strangersBrowser.topic.waitUntilPostTextMatches(
        c.FirstReplyNr + 1, newReply_ninjaEdited);
    assert.ok(!strangersBrowser.topic.isViewEditsButtonVisible(c.FirstReplyNr + 1));
  });

  it("An hour passes", () => {
    server.playTimeHours(1);
  });

  it("... Maria edits the post again, creating a new revision", () => {
    mariasBrowser.complex.editPostNr(c.FirstReplyNr + 1, newReply_22222);
  });

  it("... so now she sees the view history button", () => {
    mariasBrowser.topic.waitForViewEditsButton(c.FirstReplyNr + 1);
  });

  it("... the stranger sees it too", () => {
    strangersBrowser.refresh();
    strangersBrowser.topic.waitForViewEditsButton(c.FirstReplyNr + 1);
  });


  // ----- Check diff of imported & edted post

  it("The stranger opens the edit history of Maria's old imported reply", () => {
    strangersBrowser.topic.openEditHistory(c.FirstReplyNr);
  });

  it("... looks fine", () => {
    inspectHistoryOfOldReply(strangersBrowser);
  });

  it("... closes the dialog", () => {
    strangersBrowser.editHistoryDialog.close();
  });

  it("... Maria also checks the edit history of her old imported reply", () => {
    mariasBrowser.topic.openEditHistory(c.FirstReplyNr);
    inspectHistoryOfOldReply(mariasBrowser);
    mariasBrowser.editHistoryDialog.close();
  });

  function inspectHistoryOfOldReply(aBrowser) {
    const histEntry: EditHistoryEntry = aBrowser.editHistoryDialog.waitGetAuthorAndDiff(1);
    assert.equal(histEntry.authorUsername, maria.username);
    assert.includes(histEntry.diffHtml, `<del>${approved}</del>`);
    assert.includes(histEntry.diffHtml, `<ins>${edited}</ins>`);
    assert.includes(histEntry.diffHtml, `<del>${ooooones}</del>`);
    assert.includes(histEntry.diffHtml, `<ins>${twooooos}</ins>`);
  }



  // ----- Check diff of new & edted post

  it("The stranger checks the edit history of Maria's new reply", () => {
    strangersBrowser.topic.openEditHistory(c.FirstReplyNr + 1);
  });

  it("... it looks fine, too", () => {
    inspectHistoryOfNewReply(strangersBrowser);
  });

  it("... closes this dialog, too", () => {
    strangersBrowser.editHistoryDialog.close();
  });

  it("... Maria also checks the edit history of her new reply", () => {
    mariasBrowser.topic.openEditHistory(c.FirstReplyNr + 1);
    inspectHistoryOfNewReply(mariasBrowser);
    mariasBrowser.editHistoryDialog.close();
  });

  function inspectHistoryOfNewReply(aBrowser) {
    const histEntry: EditHistoryEntry = aBrowser.editHistoryDialog.waitGetAuthorAndDiff(1);
    assert.equal(histEntry.authorUsername, maria.username);
    assert.excludes(histEntry.diffHtml, original);
    assert.includes(histEntry.diffHtml, newReply);
    assert.includes(histEntry.diffHtml, `<del>${ninjaEdited}</del>`);
    assert.includes(histEntry.diffHtml, `<ins>${twooooos}</ins>`);
  }



  // ----- Diffs by many authors (two: Owen and Maria)


  it("Owen logs in", () => {
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
  });

  it("... edits Maria's new reply", () => {
    owensBrowser.complex.editPostNr(c.FirstReplyNr + 1, owenWrote_newReply_33333);
  });

  it("... opens the edit history", () => {
    owensBrowser.topic.openEditHistory(c.FirstReplyNr + 1);
  });

  it("... there're two entries", () => {
    assert.equal(owensBrowser.editHistoryDialog.countDiffs(), 2);
  });

  it("... the most recent one is his, looks fine", () => {
    // The most recent edits are listed first, entry 1.
    const histEntry: EditHistoryEntry = owensBrowser.editHistoryDialog.waitGetAuthorAndDiff(1);
    assert.equal(histEntry.authorUsername, owen.username);
    assert.excludes(histEntry.diffHtml, ooooones);
    assert.includes(histEntry.diffHtml, `<del>${twooooos}</del>`);
    assert.includes(histEntry.diffHtml, `<ins>${threeees}</ins>`);
  });

  it("... the oldest one is Maria's, looks fine", () => {
    // The oldest edits at the end, entry 2 of 2.
    const histEntry: EditHistoryEntry = owensBrowser.editHistoryDialog.waitGetAuthorAndDiff(2);
    assert.equal(histEntry.authorUsername, maria.username);
    assert.includes(histEntry.diffHtml, `<del>${ninjaEdited}</del>`);
    assert.includes(histEntry.diffHtml, `<ins>${twooooos}</ins>`);
    assert.excludes(histEntry.diffHtml, threeees);
  });

  it("Owenn closes the dialog", () => {
    owensBrowser.editHistoryDialog.close();
  });

});


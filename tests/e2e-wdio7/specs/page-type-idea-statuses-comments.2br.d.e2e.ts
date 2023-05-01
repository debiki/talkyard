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
import api = require('../utils/log-and-die');

let browser: TyE2eTestBrowser;

let everyonesBrowsers;
let maria;
let mariasBrowser: TyE2eTestBrowser;
let michael;
let michaelsBrowser: TyE2eTestBrowser;
let owen;
let owensBrowser: TyE2eTestBrowser;
let strangersBrowser: TyE2eTestBrowser;

let idAddress: IdAddress;
let siteId: any;

let mariasTopicUrl: string;

const mariasOpReply = 'mariasOpReply';
const mariasOpReplyReply = 'mariasOpReplyReply';

const bottomCommentOneText = 'bottomCommentOneText';
const bottomCommentTwoText = 'bottomCommentTwoText';


describe("Page statuses and bottom comments", () => {

  it("Initialize people", () => {
    everyonesBrowsers = new TyE2eTestBrowser(wdioBrowser);
    strangersBrowser = everyonesBrowsers;
    mariasBrowser = everyonesBrowsers;
    michaelsBrowser = everyonesBrowsers;
    owensBrowser = everyonesBrowsers;
    maria = make.memberMaria();
    michael = make.memberMichael();
    owen = make.memberOwenOwner();
  });

  it("Import a site", () => {
    const site: SiteData = make.forumOwnedByOwen('pgstbc', { title: "Emb Cmts Disc Id Test" });
    site.members.push(maria);
    site.members.push(michael);
    idAddress = server.importSiteData(site);
    siteId = idAddress.id;
  });

  it("Maria logs in", () => {
    mariasBrowser.go(idAddress.origin);
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
    mariasBrowser.disableRateLimits();
  });

  it("She posts a topic, type Idea", () => {
    mariasBrowser.complex.createAndSaveTopic({
      type: c.TestPageRole.Idea, title: "Marias Topic Title", body: "Marias Topic Text" });
    mariasTopicUrl = mariasBrowser.getUrl();
  });

  it("It's in status New: An idea icon", () => {
    mariasBrowser.waitForVisible('.dw-p-ttl .icon-idea.dw-clickable');
  });

  it("Changes status to Planned", () => {
    mariasBrowser.topic.setDoingStatus('Planned');  // #post-2 = meta post
  });

  it("... the icon changes to check-dashed", () => {
    mariasBrowser.waitForVisible('.dw-p-ttl .icon-check-dashed.dw-clickable');
  });

  it("... then to Started", () => {
    mariasBrowser.topic.setDoingStatus('Started');    // #post-3
  });

  it("... the icon changes to check-empty", () => {
    mariasBrowser.waitForVisible('.dw-p-ttl .icon-check-empty.dw-clickable');
  });

  it("... then to Done", () => {
    mariasBrowser.topic.setDoingStatus('Done');      // #post-4
  });

  it("... the icon changes to a check mark", () => {
    mariasBrowser.waitForVisible('.dw-p-ttl .icon-check.dw-clickable');
  });

  it("Three status change events appear (after page refresh)", () => {
    mariasBrowser.topic.refreshUntilPostNrAppears(4, { isMetaPost: true }); // [2PKRRSZ0]
    mariasBrowser.topic.waitForPostNrVisible(4);  // 2, 3 and 4  (1 is the orig post)
  });

  it("... with the correct text contents", () => {
    mariasBrowser.topic.assertMetaPostTextMatches(2, 'marked this topic as Planned');
    mariasBrowser.topic.assertMetaPostTextMatches(3, 'marked this topic as Started');
    mariasBrowser.topic.assertMetaPostTextMatches(4, 'marked this topic as Done');
  });

  it("Maria posts a progress reply", () => {
    mariasBrowser.complex.addProgressReply(bottomCommentOneText);  // #post-5
  });

  it("Changes started to New", () => {
    mariasBrowser.topic.setDoingStatus('New');               // #post-6, meta post
  });

  it("... the icon changes to icon-idea", () => {
    mariasBrowser.waitForVisible('.dw-p-ttl .icon-idea.dw-clickable');
  });

  it("Posts an Discussion reply", () => {
    mariasBrowser.complex.replyToOrigPost(mariasOpReply);    // #post-7
  });

  it("... and a reply to the reply", () => {                 // #post-8
    mariasBrowser.complex.replyToPostNr(7, mariasOpReplyReply);
  });

  it("Changes status to Planned (so we know back-to-the-start and-then-bump-one-step works)", () => {
    mariasBrowser.topic.setDoingStatus('Planned');          // event #post-9
  });

  it("Posts another progress reply", () => {
    mariasBrowser.complex.addProgressReply(bottomCommentTwoText);  // #post-10
  });

  it("Refresh page", () => {
    // currently needed, so event posts will appear [2PKRRSZ0]
    mariasBrowser.topic.refreshUntilPostNrAppears(9, { isMetaPost: true });
    mariasBrowser.topic.refreshUntilPostNrAppears(10);
  });

  it("The progress reply has the correct contents", () => {
    mariasBrowser.topic.waitForPostAssertTextMatches(10, bottomCommentTwoText);
  });

  it("... the meta post too", () => {
    mariasBrowser.topic.assertMetaPostTextMatches(9, 'marked this topic as Planned');
  });

  it("Everything is in the correct order", () => {
    mariasBrowser.topic.assertPostOrderIs([  //  CROK  CODE REVIEW DONE OK
        c.TitleNr,
        c.BodyNr,
        7,    // the orig post reply gets placed first
        8,    // orig post reply reply
        2,    // new –> planned
        3,    // planned —> started
        4,    // started —> done
        5,    // bottom comment
        6,    // done —> new
        9,    // new —> planned
        10]); // bottom comment
  });

  it("Michael may not change page status, not his page", () => {
    assert(mariasBrowser.pageTitle.canBumpPageStatus());
    mariasBrowser.topbar.clickLogout();
    michaelsBrowser.complex.loginWithPasswordViaTopbar(michael);
    assert(!michaelsBrowser.pageTitle.canBumpPageStatus());
    michaelsBrowser.waitAndClick('.dw-p-ttl .icon-check-dashed');
    // Nothing happens
    michaelsBrowser.pause(100);
    assert(!michaelsBrowser.topic.isChangePageDialogOpen());  // (396326)
  });

  it("Owen can, he's admin", () => {
    michaelsBrowser.topbar.clickLogout();
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
    assert(owensBrowser.pageTitle.canBumpPageStatus());
    owensBrowser.waitAndClick('.dw-p-ttl .icon-check-dashed.dw-clickable');
    owensBrowser.topic.waitUntilChangePageDialogOpen();
    assert(owensBrowser.topic.isChangePageDialogOpen());  // tests the test (396326)
    owensBrowser.topic.closeChangePageDialog();
  });

  it("... and he does", () => {
    owensBrowser.topic.setDoingStatus('Done');
  });

  it("... he quick-jumped from Planned to Done, skipping status Started, so fast", () => {
    owensBrowser.waitForVisible('.dw-p-ttl .icon-check.dw-clickable');
  });

});


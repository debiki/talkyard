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
let maria;
let mariasBrowser;
let michael;
let michaelsBrowser;
let owen;
let owensBrowser;
let strangersBrowser;

let idAddress: IdAddress;
let siteId: any;

let mariasTopicUrl: string;

const mariasOpReply = 'mariasOpReply';
const mariasOpReplyReply = 'mariasOpReplyReply';

const bottomCommentOneText = 'bottomCommentOneText';
const bottomCommentTwoText = 'bottomCommentTwoText';


describe("Page statuses and bottom comments", () => {

  it("Initialize people", () => {
    everyonesBrowsers = _.assign(browser, pagesFor(browser));
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
    mariasTopicUrl = mariasBrowser.url().value;
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
    mariasBrowser.refresh(); // [2PKRRSZ0]
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
    mariasBrowser.complex.replyToOrigPost(mariasOpReply, 'DiscussionSection'); // #post-7
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

  it("The posts has the correct contents", () => {
    mariasBrowser.refresh();  // currently needed, so event posts will appear [2PKRRSZ0]
    mariasBrowser.topic.waitForPostNrVisible(10);
    mariasBrowser.topic.assertPostTextMatches(10, bottomCommentTwoText);
    mariasBrowser.topic.assertMetaPostTextMatches(9, 'marked this topic as Planned');
  });

  it("Everything is in the correct order", () => {
    const postElems = mariasBrowser.elements('[id^="post-"]').value;
    for (let i = 0; i < postElems.length; ++i) {
      const elem = postElems[i];
      const id = mariasBrowser.elementIdAttribute(elem.ELEMENT, 'id').value;
      console.log('id: ' + id);
      assert.equal(2, c.BodyNr + 1);
      assert.equal(2, c.FirstReplyNr);
      switch (i) {
        case c.TitleNr: assert.equal(id, 'post-' + c.TitleNr);  break;
        case c.BodyNr:  assert.equal(id, 'post-' + c.BodyNr);  break;
        case 2:  assert(id === 'post-7');  break; // the orig post reply gets placed first
        case 3:  assert(id === 'post-8');  break; // orig post reply reply
        case 4:  assert(id === 'post-2');  break; // new –> planned
        case 5:  assert(id === 'post-3');  break; // planned —> started
        case 6:  assert(id === 'post-4');  break; // started —> done
        case 7:  assert(id === 'post-5');  break; // bottom comment
        case 8:  assert(id === 'post-6');  break; // done —> new
        case 9:  assert(id === 'post-9');  break; // new —> planned
        case 10: assert(id === 'post-10'); break; // bottom comment
      }
    }
  });

  it("Michael may not change page status, not his page", () => {
    assert(mariasBrowser.pageTitle.canBumpPageStatus());
    mariasBrowser.topbar.clickLogout();
    michaelsBrowser.complex.loginWithPasswordViaTopbar(michael);
    assert(!michaelsBrowser.pageTitle.canBumpPageStatus());
    michaelsBrowser.waitAndClick('.dw-p-ttl .icon-check-dashed');
    // Nothing happens
    michaelsBrowser.pause(100);
    assert(!michaelsBrowser.topic.isChangePageDialogOpen());
  });

  it("Owen can, he's admin", () => {
    michaelsBrowser.topbar.clickLogout();
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
    assert(owensBrowser.pageTitle.canBumpPageStatus());
    owensBrowser.waitAndClick('.dw-p-ttl .icon-check-dashed.dw-clickable');
    assert(owensBrowser.topic.isChangePageDialogOpen());
    owensBrowser.topic.closeChangePageDialog();
  });

  it("... and he does", () => {
    owensBrowser.topic.setDoingStatus('Done');
  });

  it("... he quick-jumped from Planned to Done, skipping status Started, so fast", () => {
    owensBrowser.waitForVisible('.dw-p-ttl .icon-check.dw-clickable');
  });

});


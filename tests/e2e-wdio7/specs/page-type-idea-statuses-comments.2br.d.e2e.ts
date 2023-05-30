/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import * as make from '../utils/make';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';

let browser: TyE2eTestBrowser;

let brA: TyE2eTestBrowser;
let maria;
let mariasBrowser: TyE2eTestBrowser;
let michael;
let michaelsBrowser: TyE2eTestBrowser;
let owen;
let owensBrowser: TyE2eTestBrowser;
let corax: Member;
let corax_brB: TyE2eTestBrowser;
let strangersBrowser: TyE2eTestBrowser;

let idAddress: IdAddress;
let siteId: any;

let mariasTopicUrl: string;

const mariasOpReply = 'mariasOpReply';
const mariasOpReplyReply = 'mariasOpReplyReply';

const bottomCommentOneText = 'bottomCommentOneText';
const bottomCommentTwoText = 'bottomCommentTwoText';


describe("page-type-idea-statuses-comments.2br.d  TyTPATYIDEA", () => {

  it("Initialize people", async () => {
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    strangersBrowser = brA;
    mariasBrowser = brA;
    michaelsBrowser = brA;
    owensBrowser = brA;

    corax_brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    maria = make.memberMaria();
    michael = make.memberMichael();
    owen = make.memberOwenOwner();
    corax = make.memberCorax();
  });

  it("Import a site", async () => {
    const site: SiteData = make.forumOwnedByOwen('pgstbc', { title: "Page Type Idea Test" });
    site.members.push(maria);
    site.members.push(michael);
    site.members.push(corax);
    idAddress = await server.importSiteData(site);
    siteId = idAddress.id;
  });

  it("Maria logs in", async () => {
    await mariasBrowser.go2(idAddress.origin);
    await mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
    await mariasBrowser.disableRateLimits();
  });

  it("She posts a topic, type Idea", async () => {
    await mariasBrowser.complex.createAndSaveTopic({
            type: c.TestPageRole.Idea, title: "Marias Topic Title",
            body: "Marias Topic Text" });
    mariasTopicUrl = await mariasBrowser.getUrl();
  });

  it("It's in status New: An idea icon", async () => {
    await mariasBrowser.waitForVisible('.dw-p-ttl .icon-idea.dw-clickable');
  });

  it("Changes status to Planned", async () => {
    await mariasBrowser.topic.setDoingStatus('Planned');  // #post-2 = meta post
  });

  it("... the icon changes to check-dashed", async () => {
    await mariasBrowser.waitForVisible('.dw-p-ttl .icon-check-dashed.dw-clickable');
  });

  it("... then to Started", async () => {
    await mariasBrowser.topic.setDoingStatus('Started');    // #post-3
  });

  it("... the icon changes to check-empty", async () => {
    await mariasBrowser.waitForVisible('.dw-p-ttl .icon-check-empty.dw-clickable');
  });

  it("... then to Done", async () => {
    await mariasBrowser.topic.setDoingStatus('Done');      // #post-4
  });

  it("... the icon changes to a check mark", async () => {
    await mariasBrowser.waitForVisible('.dw-p-ttl .icon-check.dw-clickable');
  });

  it("Three status change events appear (after page refresh)", async () => {
    await mariasBrowser.topic.refreshUntilPostNrAppears(4, { isMetaPost: true }); // [2PKRRSZ0]
    await mariasBrowser.topic.waitForPostNrVisible(4);  // 2, 3 and 4  (1 is the orig post)
  });

  it("... with the correct text contents", async () => {
    await mariasBrowser.topic.assertMetaPostTextMatches(2, 'marked this topic as Planned');
    await mariasBrowser.topic.assertMetaPostTextMatches(3, 'marked this topic as Started');
    await mariasBrowser.topic.assertMetaPostTextMatches(4, 'marked this topic as Done');
  });

  it("Maria posts a progress reply", async () => {
    await mariasBrowser.complex.addProgressReply(bottomCommentOneText);  // #post-5
  });

  it("Changes started to New", async () => {
    await mariasBrowser.topic.setDoingStatus('New');               // #post-6, meta post
  });

  it("... the icon changes to icon-idea", async () => {
    await mariasBrowser.waitForVisible('.dw-p-ttl .icon-idea.dw-clickable');
  });

  it("Posts an Discussion reply", async () => {
    await mariasBrowser.complex.replyToOrigPost(mariasOpReply);    // #post-7
  });

  it("... and a reply to the reply", async () => {                 // #post-8
    await mariasBrowser.complex.replyToPostNr(7, mariasOpReplyReply);
  });

  it("Changes status to Planned (so we know back-to-the-start and-then-bump-one-step works)", async () => {
    await mariasBrowser.topic.setDoingStatus('Planned');          // event #post-9
  });

  it("Posts another progress reply", async () => {
    await mariasBrowser.complex.addProgressReply(bottomCommentTwoText);  // #post-10
  });

  it("Refresh page", async () => {
    // currently needed, so event posts will appear [2PKRRSZ0]
    await mariasBrowser.topic.refreshUntilPostNrAppears(9, { isMetaPost: true });
    await mariasBrowser.topic.refreshUntilPostNrAppears(10);
  });

  it("The progress reply has the correct contents", async () => {
    await mariasBrowser.topic.waitForPostAssertTextMatches(10, bottomCommentTwoText);
  });

  it("... the meta post too", async () => {
    await mariasBrowser.topic.assertMetaPostTextMatches(9, 'marked this topic as Planned');
  });

  it("Everything is in the correct order", async () => {
    await mariasBrowser.topic.assertPostOrderIs([  //  CROK  CODE REVIEW DONE OK
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

  it("Maria leaves, Michael arrives", async () => {
    assert.ok(await mariasBrowser.pageTitle.canBumpPageStatus());  // ttt
    await mariasBrowser.topbar.clickLogout();
    await michaelsBrowser.complex.loginWithPasswordViaTopbar(michael);
  });

  it("Michael may not change page status, not his page", async () => {
    // Bit dupl [cant_change_doing_status_e2e]
    assert.not(await michaelsBrowser.pageTitle.canBumpPageStatus());
    await michaelsBrowser.waitAndClick('.dw-p-ttl .icon-check-dashed');
    // Nothing happens
    await michaelsBrowser.pause(100);
    assert.not(await michaelsBrowser.topic.isChangePageDialogOpen());  // (396326)
  });

  it("Owen can, he's admin", async () => {
    await michaelsBrowser.topbar.clickLogout();
    await owensBrowser.complex.loginWithPasswordViaTopbar(owen);
    assert.ok(await owensBrowser.pageTitle.canBumpPageStatus());
    await owensBrowser.waitAndClick('.dw-p-ttl .icon-check-dashed.dw-clickable');
    await owensBrowser.topic.waitUntilChangePageDialogOpen();
    assert.ok(await owensBrowser.topic.isChangePageDialogOpen());  // tests the test (396326)
    await owensBrowser.topic.closeChangePageDialog();
  });

  it("... and he does", async () => {
    await owensBrowser.topic.setDoingStatus('Done');
  });

  it("... he quick-jumped from Planned to Done, skipping status Started, so fast", async () => {
    await owensBrowser.waitForVisible('.dw-p-ttl .icon-check.dw-clickable');
  });

  it("Corax arrives", async () => {
    await corax_brB.go2(await owensBrowser.getUrl());
    await corax_brB.complex.loginWithPasswordViaTopbar(corax);
  });

  it("Core members too can change the Doing status of others ideas  TyTCORECAN", async () => {
    assert.ok(await corax_brB.pageTitle.canBumpPageStatus());
    await corax_brB.waitAndClick('.dw-p-ttl .icon-check.dw-clickable');
    await corax_brB.topic.waitUntilChangePageDialogOpen();
    assert.ok(await corax_brB.topic.isChangePageDialogOpen());  // tests the test (396326)
    await corax_brB.topic.closeChangePageDialog();
  });

  it("... Corax does: Sets status to Started", async () => {
    await corax_brB.topic.setDoingStatus('Started');
    await corax_brB.waitForDisplayed('.dw-p-ttl .icon-check-empty.dw-clickable');
  });

});


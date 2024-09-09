/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import * as make from '../utils/make';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';

let browser: TyE2eTestBrowser;

let everyonesBrowsers;
let maria;
let mariasBrowser: TyE2eTestBrowser;
let michael;
let michael_brB: TyE2eTestBrowser;
let corax;
let corax_brB: TyE2eTestBrowser;
let strangersBrowser: TyE2eTestBrowser;

let idAddress: IdAddress;
let siteId: any;

let mariasTopicUrl: string;

const mariasOpReply = 'mariasOpReply';
const mariasOpReplyReply = 'mariasOpReplyReply';

// .Last_status_change post nr will be 5, and the first answer will be 5 + 1:
const okaySolutionPostNr = 6;
const optimalSolutionPostNr = 6 + 2;

describe("page-type-problem-statuses.2br.d  TyT602AKK73", () => {

  it("Initialize people", async () => {
    everyonesBrowsers = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    strangersBrowser = everyonesBrowsers;
    mariasBrowser = everyonesBrowsers;
    michael_brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');
    corax_brB = michael_brB;
    maria = make.memberMaria();
    michael = make.memberMichael();
    corax = make.memberCorax();
  });

  it("Import a site", async () => {
    const site: SiteData = make.forumOwnedByOwen('pgstbc', { title: "Page Type Problem Test" });
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

  it("She posts a topic, type Problem", async () => {
    await mariasBrowser.complex.createAndSaveTopic({
            type: c.TestPageRole.Problem, title: "Marias Problem Title",
            body: `I have a problem. Help, what's a solution?`});
    mariasTopicUrl = await mariasBrowser.getUrl();
  });

  it("It starts in status New, with a problem icon", async () => {
    await mariasBrowser.waitForVisible('.dw-p-ttl .icon-attention-circled.dw-clickable');
  });

  it("Maria changes status to Planned", async () => {
    await mariasBrowser.topic.setDoingStatus('Planned');  // meta #post-2
  });

  it("... the icon changes to check-dashed", async () => {
    await mariasBrowser.waitForVisible('.dw-p-ttl .icon-check-dashed.dw-clickable');
  });

  it("She changes status to Started", async () => {
    await mariasBrowser.topic.setDoingStatus('Started');  // meta #post-3
  });

  it("... the icon changes to check-empty", async () => {
    await mariasBrowser.waitForVisible('.dw-p-ttl .icon-check-empty.dw-clickable');
  });

  it("Changes status to Done", async () => {
    await mariasBrowser.topic.setDoingStatus('Done');   // meta #post-4
  });

  it("... the icon changes to a check mark", async () => {
    await mariasBrowser.waitForVisible('.dw-p-ttl .icon-check.dw-clickable');
  });

  it("She sets status New again", async () => {
    await mariasBrowser.topic.setDoingStatus('New');   // meta #post-5
  });

  it("... the problem icon is back", async () => {
    await mariasBrowser.waitForVisible('.dw-p-ttl .icon-attention-circled.dw-clickable');
  });

  it("Four status change events appear (after page refresh)", async () => {
    await mariasBrowser.topic.refreshUntilPostNrAppears(5, { isMetaPost: true }); // [2PKRRSZ0]
    await mariasBrowser.topic.waitForPostNrVisible(5);  // 2, 3, 4 an 5  (1 is the orig post)
  });

  it("... with the correct text contents", async () => {
    await mariasBrowser.topic.assertMetaPostTextMatches(2, 'marked this topic as Planned');
    await mariasBrowser.topic.assertMetaPostTextMatches(3, 'marked this topic as Started');
    await mariasBrowser.topic.assertMetaPostTextMatches(4, 'marked this topic as Done');
    await mariasBrowser.topic.assertMetaPostTextMatches(5, 'marked this topic as New');
    // (.Last_status_change post nr is 5, above.)
  });

  it(`Maria posts a comment — she found a solution`, async () => {
    await mariasBrowser.complex.replyToOrigPost(`I found a solution: Just do it again`)
  });


  it(`Michael arrives, looks at Marias problem`, async () => {
    await michael_brB.go2(await mariasBrowser.getUrl());
    await michael_brB.complex.loginWithPasswordViaTopbar(michael);
    await michael_brB.topbar.waitForMyMenuVisible();
    await michael_brB.disableRateLimits();
  });

  it(`Michael can't change the problem's Doing status`, async () => {
    // Bit dupl [cant_change_doing_status_e2e]
    assert.not(await michael_brB.pageTitle.canBumpPageStatus());
    await michael_brB.waitAndClick('.dw-p-ttl .icon-attention-circled');
    // Nothing happens
    await michael_brB.pause(100);
    assert.not(await michael_brB.topic.isChangePageDialogOpen());  // (396326)
  });
  it(`... and can't select an answer as the solution`, async () => {
    assert.not(await michael_brB.topic.canSelectAnswer());
  });

  it(`But Maria can — it's her page. She selects her comment as the solution`, async () => {
    // Generates meta comment nr = okaySolutionPostNr + 1: "@maria accepted an answer"
    await mariasBrowser.topic.selectPostNrAsAnswer(okaySolutionPostNr);
  });

  it(`Maria posts an even better solution`, async () => {
    // Becomes nr = okaySolutionPostNr + 2.
    assert.eq(optimalSolutionPostNr, okaySolutionPostNr + 2);
    await mariasBrowser.complex.replyToOrigPost(`Do it three times`)
  });

  it(`... but she can't accept that solution, before she's unaccepted the first`, async () => {
    assert.not(await mariasBrowser.topic.canSelectAnswer());
  });


  it(`Michael leaves, in frustration. Corax arrives`, async () => {
    await michael_brB.topbar.clickLogout();
    await corax_brB.complex.loginWithPasswordViaTopbar(corax);
    await corax_brB.disableRateLimits();
  });

  it(`Corax first can't select Maria's best solution`, async () => {
    // (Or is there a race? Maybe page loads slowly? Not important — tested above,
    // Maria's browser, too.)
    assert.not(await corax_brB.topic.canSelectAnswer());
  });

  it(`... but he unselect Maria's so-so solution — he can, he's a core member  TyTCORECAN`,
          async () => {
    await corax_brB.topic.unselectPostNrAsAnswer(okaySolutionPostNr);
  });

  it(`... now he can pick another solution`, async () => {
    assert.ok(await corax_brB.topic.canSelectAnswer());
  });

  it(`Corax can change Doing status too  TyTCORECAN`, async () => {
    // Bit dupl [cant_change_doing_status_e2e]
    await corax_brB.waitAndClick('.dw-p-ttl .icon-attention-circled.dw-clickable');
    await corax_brB.topic.waitUntilChangePageDialogOpen();
    assert.ok(await corax_brB.topic.isChangePageDialogOpen());  // tests the test (396326)
    await corax_brB.topic.closeChangePageDialog();
  });

  it(`... and Corax does`, async () => {
    await corax_brB.topic.setDoingStatus('Planned');
  });
  it("... the icon changes to check-dashed", async () => {
    await corax_brB.waitForVisible('.dw-p-ttl .icon-check-dashed.dw-clickable');
  });

  it(`Corax, wisely, selects as solution Maria's best comment  TyTCORECAN`, async () => {
    await corax_brB.topic.selectPostNrAsAnswer(optimalSolutionPostNr);
  });

  it(`Maria sees that the optimal solution is now selected`, async () => {
    await mariasBrowser.refresh2();
    await mariasBrowser.topic.waitUntilPostNrIsAnswer(optimalSolutionPostNr);
  });

});


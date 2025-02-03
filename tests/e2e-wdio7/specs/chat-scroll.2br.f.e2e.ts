/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let maria: Member;
let maria_brB: TyE2eTestBrowser;
let stranger_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoCatsTestForum;

let chatPageUrl: St;

const numMsgs = 150;
const lastMsgNr = c.FirstReplyNr + numMsgs - 1;



describe(`chat-scroll.2br.f  TyTCHATSCROLL`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addCatABForum({
      title: "Chat Scroll E2E",
      members: ['maria'],
    });

    const chatPage: PageJustAdded = builder.addPage({
      id: 'chatPageId',
      folder: '/',
      showId: false,
      slug: 'chat-page',
      role: c.TestPageRole.JoinlessChat,
      title: "Scroll Test Chat",
      body: "Note that you can't scroll faster than 6e10 cm per two seconds.",
      categoryId: forum.categories.categoryA.id,
      authorId: forum.members.maria.id,
    });

    // Nrs 2 (c.FirstReplyNr) .. lastMsgNr.
    for (let nr = c.FirstReplyNr; nr <= lastMsgNr; nr += 1) {
      builder.addPost({
        page: chatPage,
        nr,
        // parentNr: c.BodyNr — not needed for chats. [CHATPRNT]
        authorId: forum.members.maria.id,
        approvedSource: `Message_nr_${nr}`,
      });
    }

    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;

    maria = forum.members.maria;
    maria_brB = brB;
    stranger_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = await server.importSiteData(forum.siteData);
    await server.skipRateLimits(site.id);
    chatPageUrl = site.origin + '/chat-page';
  });


  it(`Owen goes to the chat page`, async () => {
    await owen_brA.go2(chatPageUrl);
  });
  it(`... logs in`, async () => {
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
  });

  addTestScrollSteps(() => owen_brA, "Owen");

  // Is this really interesting?  Hmm, maybe not worth the time actually.
  //it(`A stranger arrives too`, async () => {
  //  await stranger_brB.go2(chatPageUrl);
  //  await maria_brB.complex.loginWithPasswordViaTopbar(maria);
  //});

  // addTestScrollSteps(() => stranger_brB, "A stranger");

  function addTestScrollSteps(brX: () => TyE2eTestBrowser, who: St) {
    it(`${who} can see Message_nr_${lastMsgNr} — the most recent message`, async () => {
      await brX().topic.waitForPostNrVisible(lastMsgNr);
    });
    it(`... and Message_nr_112 — that's far back is included on page load`, async () => {
      await brX().topic.waitForPostNrVisible(112);
    });
    it(`... but not Message_nr_111 — need to scroll up, for it to get inserted`, async () => {
      assert.not(await brX().topic.isPostNrVisible(111));
    });
    it(`... The very first message, #post-${c.FirstReplyNr}, also not visible`, async () => {
      assert.not(await brX().topic.isPostNrVisible(c.FirstReplyNr));
    });

    it(`Han scrolls up to the top of the chat`, async () => {
      await brX().scrollTowardsUntilAppears('.c_Chat_Top', '#post-' + c.FirstReplyNr);
    });

    it(`... but the newest (most recent) message is no longer shown`, async () => {
      assert.not(await brX().topic.isPostNrVisible(lastMsgNr));
    });

    it(`Han scrolls down to the end of the chat`, async () => {
      await brX().scrollTowardsUntilAppears('.c_Chat_Bottom', '#post-' + lastMsgNr);
    });

    it(`... now the oldest (at the very top) no longer shown`, async () => {
      assert.not(await brX().topic.isPostNrVisible(c.FirstReplyNr));
    });
    it(`... but Message_nr_112 is visible again`, async () => {
      await brX().topic.waitForPostNrVisible(112);
    });
    it(`... and Message_nr_51 is visible again
                  — we show 100 messages: 51 – 151  [max_chat_msgs_2_show]`, async () => {
      await brX().topic.waitForPostNrVisible(51);
    });

    it(`... not nr 50 though, that would have been 101 messages`, async () => {
      assert.not(await brX().topic.isPostNrVisible(50));
    });
    it(`... and of course not nr 20 (far below 50)`, async () => {
      assert.not(await brX().topic.isPostNrVisible(20));
    });
  }

});


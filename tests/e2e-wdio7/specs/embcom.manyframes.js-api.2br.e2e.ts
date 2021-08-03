// CR_MISSING
/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import * as fs from 'fs';
import server from '../utils/server';
import * as utils from '../utils/utils';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/pages-for';
import settings from '../utils/settings';
import { dieIf } from '../utils/log-and-die';
import c from '../test-constants';
import { IsWhere } from '../test-types';


let everyonesBrowsers: TyAllE2eTestBrowsers;
let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let maria: Member;
let maria_brB: TyE2eTestBrowser;
let memah: Member;
let memah_brB: TyE2eTestBrowser;
let stranger_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoCatsTestForum;
const localHostname = 'comments-for-e2e-test-manyifrapi-localhost-8080';
const embeddingOrigin = 'http://e2e-test-manyifrapi.localhost:8080';

const embPage1SlashSlug = '/many-embcom-ifr-api-1.html';
const embPage123SlashSlug = '/many-embcom-ifr-api-123.html';
const embPageNoneSlashSlug = '/many-embcom-ifr-api-none.html';

const mariasReply1_disc222 = 'mariasReply1_disc222';
const mariasReply2_disc222 = 'mariasReply2_disc222';
const mariasReply3_disc111 = 'mariasReply3_disc111';


describe(`embcom.manyframes.js-api.2br  TyTEMANYEMBDISAPI`, () => {

  it(`construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "Many Comment Iframes API",
      members: undefined, // default = everyone
        // ['mons', 'modya', 'regina', 'corax', 'memah', 'maria', 'michael', 'mallory']
    });

    builder.getSite().meta.localHostname = localHostname;
    builder.getSite().settings.allowEmbeddingFrom = embeddingOrigin;


    everyonesBrowsers = new TyE2eTestBrowser(allWdioBrowsers, 'brAll');
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;

    maria = forum.members.maria;
    maria_brB = brB;
    memah = forum.members.memah;
    memah_brB = brB;
    stranger_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`import site`, async () => {
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });



  it(`Creates an embedding page`, async () => {
    fs.writeFileSync('target' + embPage1SlashSlug, makeHtml('manyfr-1', ['111'], '#500'));
    fs.writeFileSync('target' + embPage123SlashSlug, makeHtml('manyfr-123', ['111', '222', '333'], '#005'));
    fs.writeFileSync('target' + embPageNoneSlashSlug, makeHtml('manyfr-none', [], '#000'));

    function makeHtml(pageName: St, discussionIds: St[], bgColor: St): St {
      return utils.makeManyEmbeddedCommentsHtml({
              pageName, discussionIds, localHostname, bgColor});
    }
  });

  it(`Maria opens embedding page aaa`, async () => {
    await maria_brB.go2(embeddingOrigin + embPage1SlashSlug);
  });

  it(`The embedding web app calls Ty's js API: `, async () => {
    await maria_brB.execute(function() {
      window['talkyardAddCommentsIframe']({
            appendInside: '#comment_iframes', discussionId: '222' });
    })
  });

  it(`Maria logs in`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame({ discId: '222' });
    await maria_brB.complex.loginIfNeededViaMetabar(maria);
  });

  it(`... posts a comment in disc 222`, async () => {
    await maria_brB.complex.replyToEmbeddingBlogPost(mariasReply1_disc222)
  });

  it(`Maria goes to page 1 2 3`, async () => {
    await maria_brB.go2(embeddingOrigin + embPage123SlashSlug);
  });
  it(`... disc 222 with her comment is there`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame({ discId: '222' });
    await maria_brB.topic.waitForPostAssertTextMatches(
            c.FirstReplyNr, mariasReply1_disc222);
  });

  it(`Maria posts another reply in 222`, async () => {
    await maria_brB.complex.replyToEmbeddingBlogPost(mariasReply2_disc222);
  });
  it(`... and one in 111`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame({ discId: '111' });
    await maria_brB.complex.replyToEmbeddingBlogPost(mariasReply3_disc111);
  });


  it(`Maria goes to page none`, async () => {
    await maria_brB.go2(embeddingOrigin + embPageNoneSlashSlug, {
            willBeWhere: IsWhere.EmbeddingPage });
  });
  it(`There are no comments frames at all`, async () => {
    await waitForNumIframes(maria_brB, 2);
  });

  async function waitForNumIframes(br, n: Nr) {
    let numNow = 0;
    await maria_brB.waitUntil(async (): Pr<Bo> => {
      numNow = await maria_brB.execute(function() {
        return document.querySelectorAll('iframe').length;
      });
      return numNow === n;  // session + editor, no discussions
    }, {
      message: () => `Waiting for ${n} iframes, num now: ${numNow}`,
    });
  }

  it(`The embedding web app calls Ty's js API, creates discs 333, 222, 111`, async () => {
    // TyTAPNDIFR283
    await maria_brB.execute(function() {
      window['talkyardAddCommentsIframe']({
            appendInside: '#comment_iframes', discussionId: '333' });
    });
    await maria_brB.execute(function() {
      // Try with appendInside = an element instead of a selector.
      const elm = document.querySelector('#comment_iframes');
      window['talkyardAddCommentsIframe']({
            appendInside: elm, discussionId: '222' });
    });
    await maria_brB.execute(function() {
      window['talkyardAddCommentsIframe']({
            appendInside: '#comment_iframes', discussionId: '111' });
    });
  });
  it(`There are now 2 + 3 iframes`, async () => {
    await waitForNumIframes(maria_brB, 2 + 3);
  });

  it(`The comments are theree, in 222`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame({ discId: '222' });
    await maria_brB.topic.waitForPostAssertTextMatches(
            c.FirstReplyNr, mariasReply1_disc222);
    await maria_brB.topic.waitForPostAssertTextMatches(
            c.FirstReplyNr + 1, mariasReply2_disc222);
    await maria_brB.topic.waitForNumReplies({ numNormal: 2 });
  });
  it(`... and in 111`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame({ discId: '111' });
    await maria_brB.topic.waitForPostAssertTextMatches(
            c.FirstReplyNr, mariasReply3_disc111);
    await maria_brB.topic.waitForNumReplies({ numNormal: 1 });
  });
  it(`... but none in 333`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame({ discId: '333' });
    await maria_brB.topic.waitForNumReplies({});
  });


  it(`On the embedding page ...`, async () => {
    await maria_brB.switchToTheParentFrame();
  });
  it(`Talkyard knows there're 3 discussions: 111, 222, 333, on the page`, async () => {
    const numDiscussions = await maria_brB.execute(function() {
      return window['e2e_getNumEmbDiscs']();
    });
    assert.eq(numDiscussions, 3);
  });
  it(`... and 2 + 3 iframes`, async () => {
    await waitForNumIframes(maria_brB, 2 + 3);  // session, editor, 3 discussions
  });
  it(`The embedding web app removes an iframe`, async () => {
    await maria_brB.execute(function() {
      document.querySelector('iframe[name=edComments-2]').remove();
    });
  });
  it(`... tells Talkyard about it`, async () => {
    await maria_brB.execute(function() {
      window['talkyardForgetRemovedCommentIframes']();
    });
  });
  it(`... now Talkyard has resized its arrays`, async () => {
    const numDiscussions = await maria_brB.execute(function() {
      return window['e2e_getNumEmbDiscs']();
    });
    assert.eq(numDiscussions, 2);
  });
  it(`... there're 2 + 2 iframes  ttt`, async () => {
    await waitForNumIframes(maria_brB, 2 + 2);  // session, editor, 2 discussions
  });


  it(`The embedding web app adds back the removed discussion, 222`, async () => {
    await maria_brB.execute(function() {
      window['talkyardAddCommentsIframe']({
            appendInside: '#comment_iframes', discussionId: '222' });
    });
  });
  it(`The comments are theree again`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame({ discId: '222' });
    await maria_brB.topic.waitForPostAssertTextMatches(
            c.FirstReplyNr, mariasReply1_disc222);
    await maria_brB.topic.waitForPostAssertTextMatches(
            c.FirstReplyNr + 1, mariasReply2_disc222);
    await maria_brB.topic.waitForNumReplies({ numNormal: 2 });
    await maria_brB.switchToTheParentFrame();
  });


  it(`... and the comments script has resized its arrays`, async () => {
    const numDiscussions = await maria_brB.execute(function() {
      return window['e2e_getNumEmbDiscs']();
    });
    assert.eq(numDiscussions, 3);
  });
  it(`... there're 2 + 3 iframes  ttt`, async () => {
    await waitForNumIframes(maria_brB, 2 + 3);  // session, editor, 3 discussions
  });

});

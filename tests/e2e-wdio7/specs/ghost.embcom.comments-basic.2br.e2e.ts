/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import { IsWhere } from '../test-types';
import settings from '../utils/settings';
import c from '../test-constants';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let maria: Member;
let maria_brB: TyE2eTestBrowser;
let memah: Member;
let memah_brB: TyE2eTestBrowser;


const localHostname = 'e2e-test-ghost-comments';
const embeddingOrigin = `${settings.scheme}://localhost:${c.thirdParty.ghostPort}`;

let site: IdAddress;
let forum: TwoCatsTestForum;

// Can take a while for Ghost and comments to load, so, longer timeout:
const timeoutMs = 4000;


describe(`ghost.embcom.comments-basic.2br  TyTEGHOSTCOMBSC`, () => {

  if (settings.secure) {
    console.log("Skipping Ghost comments test — the Ghost image uses only HTTP.");
    return;
  }

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "Some Emb Comments E2E Test",
      members: ['owen_owner', 'memah', 'maria'],
    });

    builder.getSite().meta.localHostname = localHostname;
    builder.getSite().settings.allowEmbeddingFrom = embeddingOrigin;

    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;

    maria = forum.members.maria;
    maria_brB = brB;
    memah = forum.members.memah;
    memah_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });


  it(`Owen goes to a Ghost blog default installation sample page`, async () => {
    await owen_brA.go2(embeddingOrigin + '/welcome', { willBeWhere: IsWhere.EmbeddingPage });
    //await owen_brA.scrollToBottom();
  });
  it(`... logs in   [2_lgi_clk] need to click Log In twice, fine but why?`, async () => {
    await owen_brA.complex.loginWithPasswordViaMetabar(owen, {
          timeoutMs, maybeMoves: true });
  });


  it(`Maria goes there too`, async () => {
    await maria_brB.go2(embeddingOrigin + '/welcome', { willBeWhere: IsWhere.EmbeddingPage });
  });

  it(`... logs in  [2_lgi_clk] need to click Log In twice here too`, async () => {
    await maria_brB.complex.loginWithPasswordViaMetabar(maria, {
          timeoutMs, maybeMoves: true });
  });


  it(`Maria posts a comment`, async () => {
    await maria_brB.complex.replyToEmbeddingBlogPost("Ghosts_are_welcome but where are they",
          { waitAndClickPs: { timeoutMs }});
  });

  it(`Owen reloads the page`, async () => {
    await owen_brA.refresh2();
  });

  it(`... thereafter he sees Maria's comment (but no ghosts)`, async () => {
    await owen_brA.topic.waitForPostAssertTextMatches(c.FirstReplyNr, "Ghosts_are_welcome");
  });


  it(`Owen goes to page /write/`, async () => {
    await owen_brA.go2('/write/');
  });

  it(`... posts an insightful thought`, async () => {
    await owen_brA.complex.replyToEmbeddingBlogPost("Are writing ghosts ghost_writers",
          { waitAndClickPs: { timeoutMs }});
  });

  it(`Maria goes to /write/ too`, async () => {
    await maria_brB.go2('/write/');
  });

  it(`... sees Owen's comment, only that one`, async () => {
    await maria_brB.topic.waitForNumReplies({ numNormal: 1 });
    await maria_brB.topic.waitForPostAssertTextMatches(c.FirstReplyNr, "ghost_writers");
  });

  // Could [move_a_ghost_post], verify the comments move along — thanks to
  // data-discussion-id="{{comment_id}}" in the Ghost template.
});


/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import * as fs from 'fs';
import server from '../utils/server';
import * as ut from '../utils/utils';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';
import { IsWhere } from '../test-types';


let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let maria: Member;
let maria_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoCatsTestForum;
const localHostname = 'comments-for-e2e-test-manyifr-localhost-8080';
const embeddingOrigin = 'http://e2e-test-manyifr.localhost:8080';

const slashSlug_c407_many = '/embcom-manyframes-com-counts-c407.html';

const numOkDiscs = 3;
const numBrokenLinkDiscs = 1;
const numTotalDiscs = 4;


describe(`embcom.manyframes.comment-counts.2br.cors  TyTE2EMNYFRCOMCNTS`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "Comment Counts, Many Iframes",
      members: ['mons', 'memah', 'maria']
    });

    builder.getSite().meta.localHostname = localHostname;
    builder.getSite().settings.allowEmbeddingFrom = embeddingOrigin;

    const embComsPageDiid000: PageJustAdded = builder.addPage({
      id: '00', // that's the page, '00' — but the discussion id is '000'
      folder: '/',
      showId: false,
      slug: 'emb-coms-diid-000',
      role: c.TestPageRole.EmbeddedComments,
      title: "Emb Coms diid 000",
      body: "Emb Coms diid 000 page body",
      categoryId: forum.categories.categoryA.id,
      authorId: forum.members.owen.id,
    });

    const embComsPageDiid111: PageJustAdded = builder.addPage({
      id: '11',
      folder: '/',
      showId: false,
      slug: 'emb-coms-diid-111',
      role: c.TestPageRole.EmbeddedComments,
      title: "Emb Coms diid 111",
      body: "Emb Coms diid 111 page body",
      categoryId: forum.categories.categoryA.id,
      authorId: forum.members.memah.id,
    });

    const embComsPageDiid222: PageJustAdded = builder.addPage({
      id: '22',
      folder: '/',
      showId: false,
      slug: 'emb-coms-diid-222',
      role: c.TestPageRole.EmbeddedComments,
      title: "Emb Coms diid 222",
      body: "Emb Coms diid 222 page body",
      categoryId: forum.categories.categoryA.id,
      authorId: forum.members.memah.id,
    });

    forum.siteData.pageIdsByAltIds = {};
    forum.siteData.pageIdsByAltIds['000'] = embComsPageDiid000.id;
    forum.siteData.pageIdsByAltIds['111'] = embComsPageDiid111.id;
    forum.siteData.pageIdsByAltIds['222'] = embComsPageDiid222.id;
    // There's also discussion id  'nnn' for a discussion that doesn't exist at all.

    // Zero repies in discussion id 000.

    // One reply in discussion id 111.
    builder.addPost({
      page: embComsPageDiid111,
      nr: c.FirstReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.mons.id,
      approvedSource: "Page diid 111 reply 1/1",
    });

    // Two replies in discussion id 222.
    builder.addPost({
      page: embComsPageDiid222,
      nr: c.FirstReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.mons.id,
      approvedSource: "Page diid 222 reply 1/2",
    });
    builder.addPost({
      page: embComsPageDiid222,
      nr: c.FirstReplyNr + 1,
      parentNr: c.BodyNr,
      authorId: forum.members.mons.id,
      approvedSource: "Page diid 222 reply 2/2",
    });


    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;

    maria = forum.members.maria;
    maria_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = await server.importSiteData(forum.siteData);
    await server.skipRateLimits(site.id);
  });



  it(`Create embedding page with a discussion diid '222',
            and with comment counts for some disussions not shown '000' and '111',
            and for a non-existing discussion 'nnn'`, async () => {
    fs.writeFileSync('target' + slashSlug_c407_many, makeManyHtml('c407', '#407'));
    function makeManyHtml(pageName: St, bgColor: St): St {
      return ut.makeManyEmbeddedCommentsHtml({
              pageName, discussionIds: ['222'],
              showCommentCountsForDiscIds: ['000', '111', '222', 'nnn'],
              localHostname, bgColor});
    }
  });


  it(`Maria opens embedding page ${slashSlug_c407_many}`, async () => {
    await maria_brB.go2(embeddingOrigin + slashSlug_c407_many, {
            willBeWhere: IsWhere.EmbeddingPage });
  });


  it(`There's 1 embedded discussions`, async () => {
    await maria_brB.waitForExactly(1, '.talkyard-comments iframe');
  });

  it(`There're only broken commnet counts — CORS requests not enabled`, async () => {
    // The fetch() request might take some time to complete, so use wait...().
    await maria_brB.waitForExactly(numTotalDiscs, '.ty_NumCmts-Err-TyEFET0RSP');
  });
  it(`... no ok count appears`, async () => {
    // Now fetch() is done.
    const numOk = await maria_brB.count('.ty_NumCmts-Ok, .ty_NumCmts-PgNF');
    assert.eq(numOk, 0);
  });


  it(`Owen enables CORS: He goes to admin area`, async () => {
    await owen_brA.adminArea.settings.features.goHere(site.origin);
    await owen_brA.loginDialog.loginWithPassword(owen);
  });
  it(`... enables AIP`, async () => {
    await owen_brA.adminArea.settings.features.setEnableApi(true);
  });
  it(`... and CORS`, async () => {
    await owen_brA.adminArea.settings.features.setEnableCors(true);
  });
  it(`... for the blog`, async () => {
    await owen_brA.adminArea.settings.features.setCorsOrigins(embeddingOrigin);
  });
  it(`... saves`, async () => {
    await owen_brA.adminArea.settings.clickSaveAll();
  });


  it(`Maria reloas the page`, async () => {
    await maria_brB.refresh2({ isWhere: IsWhere.EmbeddingPage });
  });
  it(`Comment counts found, for 3 discussions '000', '111' and '222'`, async () => {
    await maria_brB.waitForExactly(numOkDiscs, '.ty_NumCmts-Ok');
  });
  it(`... not for the broken link discussion 'nnn'`, async () => {
    await maria_brB.waitForExactly(numBrokenLinkDiscs, '.ty_NumCmts-PgNF');
  });
  it(`Maria sees comment counts 0, 1, 2, and 0`, async () => {
    await maria_brB.waitAndAssertVisibleTextIs('.diid-000 .ty_NumCmts', '0');
    await maria_brB.waitAndAssertVisibleTextIs('.diid-111 .ty_NumCmts', '1');
    await maria_brB.waitAndAssertVisibleTextIs('.diid-222 .ty_NumCmts', '2');
    await maria_brB.waitAndAssertVisibleTextIs('.diid-nnn .ty_NumCmts', '0');
  });
  it(`There was no  got-no-response  error  —  CORS now works`, async () => {
    await maria_brB.waitForExactly(0, '.ty_NumCmts-Err-TyEFET0RSP');
  });


  it(`Maria logs in to discussion 222 with 2 comments`, async () => {
    maria_brB.useCommentsIframe_sync({ discussionId: '222' });
    await maria_brB.complex.loginIfNeededViaMetabar(maria);
  });
  it("... posts a comment", async () => {
    await maria_brB.complex.replyToEmbeddingBlogPost("The last reply")
  });
  it("... now there are three comments", async () => {
    await maria_brB.topic.assertNumRepliesVisible(3);
  });

  // TESTS_MISSING could have the iframe update the comments count
  // on the embedding page. [dyn_upd_com_counts]

  it(`Maria reloads the page`, async () => {
    await maria_brB.refresh2({ isWhere: IsWhere.EmbeddingPage });
  });
  it(`... comment counts appear`, async () => {
    await maria_brB.waitForExactly(numOkDiscs, '.ty_NumCmts-Ok');
  });
  it(`Maria sees comment counts 0, 1, and 3 for diid 222, and 0`, async () => {
    await maria_brB.waitAndAssertVisibleTextIs('.diid-000 .ty_NumCmts', '0');
    await maria_brB.waitAndAssertVisibleTextIs('.diid-111 .ty_NumCmts', '1');
    await maria_brB.waitAndAssertVisibleTextIs('.diid-222 .ty_NumCmts', '3');
    await maria_brB.waitAndAssertVisibleTextIs('.diid-nnn .ty_NumCmts', '0');
  });

});

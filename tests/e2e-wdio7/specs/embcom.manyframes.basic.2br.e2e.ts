// CR_MISSING
/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import * as fs from 'fs';
import server from '../utils/server';
import * as ut from '../utils/utils';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';


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
const localHostname = 'comments-for-e2e-test-manyifr';
const embeddingOrigin = 'http://e2e-test-manyifr.localhost:8080';

const slashSlug_c404_many2 = '/embcom-manyframes-basic-c404-many-2.html';
const slashSlug_c040_single1 = '/embcom-manyframes-basic-c040-single-1.html';

const mariasReply_nr1_diid_222 = 'mariasReply_nr1_diid_222';
const mariasReply_nr2_diid_222 = 'mariasReply_nr2_diid_222';
const mariasReply_nr3_diid_111 = 'mariasReply_nr3_diid_111';
const mariasReply_nr4_diid_111 = 'mariasReply_nr4_diid_111';
const mariasReply_nr5_diid_222 = 'mariasReply_nr5_diid_222';
const mariasReply_nr6_diid_111 = 'mariasReply_nr6_diid_222';


describe(`embcom.manyframes.basic.2br  TyTEMANYCOMIFR01`, () => {

  it(`construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "Many Comment Iframes Basic",
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
    const dir = 'target';
    fs.writeFileSync('target' + slashSlug_c404_many2, makeManyHtml('c404', '#404'));
    //fs.writeFileSync(`${dir}/page-b-slug.html`, makeHtml('bbb', '#040'));

    function makeManyHtml(pageName: string, bgColor: string): string {
      return ut.makeManyEmbeddedCommentsHtml({
              pageName, discussionIds: ['111', '222'], localHostname, bgColor});
    }

    fs.writeFileSync('target' + slashSlug_c040_single1, makeSingleHtml('c040', '#040'));
    function makeSingleHtml(pageName: St, bgColor: St): St {
      return ut.makeEmbeddedCommentsHtml({
            pageName, discussionId: '222', localHostname, bgColor});
    }
  });


  it(`Maria opens embedding page ${slashSlug_c404_many2}`, async () => {
    await maria_brB.go2(embeddingOrigin + slashSlug_c404_many2);
  });


  it("... logs in", async () => {
    maria_brB.useCommentsIframe_sync({ discussionId: '222' });
    await maria_brB.complex.loginIfNeededViaMetabar(maria);
  });


  it("... posts a comment", async () => {
    await maria_brB.complex.replyToEmbeddingBlogPost(mariasReply_nr1_diid_222)
  });
  it("... another one", async () => {
    await maria_brB.complex.replyToEmbeddingBlogPost(mariasReply_nr2_diid_222)
  });
  it("... now there are two comments", async () => {
    await maria_brB.topic.assertNumRepliesVisible(2);
  });


  it(`Maria focuses the iframe with discussion 111`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame({ discId: '111' });
  });
  it(`She's logged in already, as Maria`, async () => {
    const actualUsername = await maria_brB.metabar.getMyUsernameInclAt();
    assert.eq(actualUsername, '@' + maria.username);
  });


  it(`There're no replies here`, async () => {
    await maria_brB.topic.assertNumRepliesVisible(0);
  });
  it(`Maria posts a reply`, async () => {
    await maria_brB.complex.replyToEmbeddingBlogPost(mariasReply_nr3_diid_111)
  });
  it(`... now there's one reply`, async () => {
    await maria_brB.topic.assertNumRepliesVisible(1);
  });


  it(`Back in discussion 222 though`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame({ discId: '222' });
  });
  it(`... there're still just 2 replies`, async () => {
    await maria_brB.topic.assertNumRepliesVisible(2);
  });


  it(`Nothing changes after page reload`, async () => {
    await maria_brB.refresh2();
  });
  it(`... in discussion 222`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame();
    await maria_brB.topic.assertNumRepliesVisible(2);
  });
  it(`... nor in 111`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame({ discId: '111' });
    await maria_brB.switchToEmbeddedCommentsIrame();
    await maria_brB.topic.assertNumRepliesVisible(1);
  });


  // ----- Drafts in multi iframes   TyTEMBDFT02

  it(`Maria creates a comment draft in 111`, async () => {
    await maria_brB.topic.clickReplyToEmbeddingBlogPost();
    await maria_brB.switchToEmbeddedEditorIrame();
    await maria_brB.editor.editText(mariasReply_nr4_diid_111, { timeoutMs: 3000 });
  });
  it(`... cancels, so a draft gets saved`, async () => {
    await maria_brB.editor.cancelNoHelp();
  });

  it(`Maria switches to discussion 222`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame({ discId: '222' });
  });

  it(`Maria writes a a draft reply to the blog post`, async () => {
    await maria_brB.topic.clickReplyToEmbeddingBlogPost();
    await maria_brB.switchToEmbeddedEditorIrame();
    await maria_brB.editor.editText(mariasReply_nr5_diid_222, { timeoutMs: 3000 });
  });
  it(`... cancels, so a draft gets saved`, async () => {
    await maria_brB.editor.cancelNoHelp();
  });
  it(`... writes a draft reply to the 1st comment`, async () => {
    await maria_brB.topic.clickReplyToPostNr(c.FirstReplyNr);
    await maria_brB.switchToEmbeddedEditorIrame();
    await maria_brB.editor.editText(mariasReply_nr6_diid_111, { timeoutMs: 3000 });
  });
  it(`... a draft gets saved after some seconds`, async () => {
    await maria_brB.editor.waitForDraftSaved();
  });
  it(`... refreshes the page`, async () => {
    await maria_brB.refresh2();
  });


  let numReplies: NumReplies | U;

  it(`In discussion 111, there's one comment and 1 draft`, async () => {
    maria_brB.useCommentsIframe_sync({ discussionId: '111' });
    await maria_brB.switchToEmbeddedCommentsIrame();
    numReplies = await maria_brB.topic.countReplies();
    assert.eq(numReplies.numNormal, 1);
  });
  it(`... and one draft`, async () => {
    assert.eq(numReplies.numDrafts, 1);
    assert.eq(numReplies.numPreviews, 0);   // ttt
    assert.eq(numReplies.numUnapproved, 0); // ttt
    assert.eq(numReplies.numDeleted, 0);    // ttt
  });

  it(`In discussion 222 there're two comments`, async () => {
    await maria_brB.switchToTheParentFrame();
    maria_brB.useCommentsIframe_sync({ discussionId: '222' });
    await maria_brB.switchToEmbeddedCommentsIrame();
    numReplies = await maria_brB.topic.countReplies();
    assert.eq(numReplies.numNormal, 2);
  });
  it(`... and two drafts  UNIMPL TESTS_MISSING [many_ifr_my_page_data]`, async () => {
    //assert.eq(numReplies.numDrafts, 2);
  });


  it(`Maria opens the first draft`, async () => {
    // For now:   [many_ifr_my_page_data]
    await maria_brB.topic.clickReplyToEmbeddingBlogPost();
    // Later: await await maria_brB.drafts.resumeNthDraft(1);
    await maria_brB.switchToEmbeddedEditorIrame();
    await maria_brB.editor.waitForDraftTextToLoad(mariasReply_nr5_diid_222);
  });
  it(`... submits it`, async () => {
    await maria_brB.editor.save();
    await maria_brB.topic.waitForPostAssertTextMatches(
            c.FirstReplyNr + 2, mariasReply_nr5_diid_222);
  });
  it(`Now there are 3 comments`, async () => {
    await maria_brB.topic.assertNumRepliesVisible(3);
  });
  it(`... one draft left  UNIMPL TESTS_MISSING [many_ifr_my_page_data]`, async () => {
    // await maria_brB.drafts.assertNumDrafts(1);
  });


  it(`In discussion 111 ...`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame({ discId: '111' });
  });
  it(`... the draft and one comment are still there`, async () => {
    numReplies = await maria_brB.topic.countReplies();
    assert.deepEq(numReplies, ut.numReplies({ numNormal: 1, numDrafts: 1}));
  });
  it(`Maria opens the draft`, async () => {
    await maria_brB.drafts.resumeNthDraft(1);
    await maria_brB.switchToEmbeddedEditorIrame();
    await maria_brB.editor.waitForDraftTextToLoad(mariasReply_nr4_diid_111);
  });
  it(`... submits it`, async () => {
    await maria_brB.editor.save();
    await maria_brB.topic.waitForPostAssertTextMatches(
            c.FirstReplyNr + 1, mariasReply_nr4_diid_111);
  });
  it(`Now there are 2 comments`, async () => {
    numReplies = await maria_brB.topic.countReplies();
    assert.eq(numReplies.numNormal, 2);
  });
  it(`... no draft left`, async () => {
    await maria_brB.drafts.waitUntilNumDrafts(0);
    assert.eq(numReplies.numDrafts, 0);
  });


  it(`Maria opens page ${slashSlug_c040_single1} with emb disc 222`, async () => {
    await maria_brB.go2(embeddingOrigin + slashSlug_c040_single1);
  });
  it(`... she's logged in already, as Maria`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame({ theresOnlyOne: true });
    const actualUsername = await maria_brB.metabar.getMyUsernameInclAt();
    assert.eq(actualUsername, '@' + maria.username);
  });
  it(`... there're three comments`, async () => {
    numReplies = await maria_brB.topic.countReplies();
    assert.eq(numReplies.numNormal, 3);
  });
  it(`... and one draft`, async () => {
    assert.eq(numReplies.numDrafts, 1);
  });


  it(`Maria opens the remaining draft`, async () => {
    await maria_brB.drafts.resumeNthDraft(1);
    await maria_brB.switchToEmbeddedEditorIrame();
    await maria_brB.editor.waitForDraftTextToLoad(mariasReply_nr6_diid_111);
  });
  it(`... edits the text`, async () => {
    await maria_brB.editor.editText(" EDITED", { append: true });
  });
  it(`... submits it`, async () => {
    await maria_brB.editor.save();
  });
  it(`... it appears, incl the edits`, async () => {
    await maria_brB.topic.waitForPostAssertTextMatches(
            c.FirstReplyNr + 3, mariasReply_nr6_diid_111 + " EDITED");
  });


  it(`Back on the many-iframes page`, async () => {
    await maria_brB.go2(embeddingOrigin + slashSlug_c404_many2);
  });
  it(`... she now sees 4 comments in discussion 222`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame({ discId: '222' });
    numReplies = await maria_brB.topic.countReplies();
    assert.deepEq(numReplies, ut.numReplies({ numNormal: 4 }));
  });
  it(`... incl the recently edited & submitted draft`, async () => {
    await maria_brB.topic.waitForPostAssertTextMatches(
            c.FirstReplyNr + 3, mariasReply_nr6_diid_111 + " EDITED");
  });


  it(`Maria logs out`, async () => {
    await maria_brB.metabar.clickLogout();
  });
  it(`... she's not logged in in 222`, async () => {
    await maria_brB.metabar.waitUntilNotLoggedIn();
  });
  it(`... and not in 111`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame({ discId: '111' });
    await maria_brB.metabar.waitUntilNotLoggedIn();
  });

  it(`After page reload, she's still not logged in ...`, async () => {
    await maria_brB.refresh2();
  });
  it(`... in 111`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame({ discId: '111' });
    await maria_brB.metabar.waitUntilNotLoggedIn();
  });
  it(`... nor in 222`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame({ discId: '222' });
    await maria_brB.metabar.waitUntilNotLoggedIn();
  });

  it(`At page ${slashSlug_c040_single1} with only disc 222 ...`, async () => {
    await maria_brB.go2(embeddingOrigin + slashSlug_c040_single1);
  });
  it(`... she's logged out too`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame({ theresOnlyOne: true });
    await maria_brB.metabar.waitUntilNotLoggedIn();
  });

});

// CR_MISSING
/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import * as fs from 'fs';
import server from '../utils/server';
import * as ut from '../utils/utils';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/pages-for';
import settings from '../utils/settings';
import { dieIf } from '../utils/log-and-die';
import c from '../test-constants';


let everyonesBrowsers: TyAllE2eTestBrowsers;
let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let maria: Member;
let maria_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoCatsTestForum;
const localHostname = 'comments-for-e2e-test-mnyifre-localhost-8080';
const embeddingOrigin = 'http://e2e-test-manyifr.localhost:8080';

const slashSlug_c052_many2 = '/embcom-manyframes-replyto-c052-many-2.html';

const mariasReply_nr1_diid_222 = 'mariasReply_nr1_diid_222';
const mariasReply_nr2_diid_111 = 'mariasReply_nr2_diid_111';
const mariasReply_nr3_diid_333 = 'mariasReply_nr3_diid_333';
const mariasReply_nr4_did_222_toMaria = 'mariasReply_nr4_did_222_toMaria';
const mariasReply_nr4_did_222_edited = 'mariasReply_nr4_did_222_edited';

let numReplies: NumReplies | U;

describe(`embcom.manyframes.drafts-repl-to.2br  TyTEMANYCOMIFR02`, () => {

  it(`construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "Many Comment Iframes Repl To",
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

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`import site`, async () => {
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });



  it(`Creates an embedding page`, async () => {
    fs.writeFileSync('target' + slashSlug_c052_many2, makeManyHtml('c052', '#052'));
    function makeManyHtml(pageName: string, bgColor: string): string {
      return ut.makeManyEmbeddedCommentsHtml({
              pageName, discussionIds: ['111', '222', '333'], localHostname, bgColor});
    }
  });


  it(`Maria opens embedding page ${slashSlug_c052_many2}`, async () => {
    await maria_brB.go2(embeddingOrigin + slashSlug_c052_many2);
  });


  it(`... logs in`, async () => {
    maria_brB.useCommentsIframe({ discussionId: '222' });
    await maria_brB.complex.loginIfNeededViaMetabar(maria);
  });



  it(`... starts typing a comment in discussion 222`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame({ discId: '222' });
    await maria_brB.complex.startReplyingToEmbBlogPost(mariasReply_nr1_diid_222);
  });
  it(`... a preview appears in disc 222`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame({ discId: '222' });
    await maria_brB.topic.waitForPostPreviewDisplayed();
    numReplies = await maria_brB.topic.countReplies();
    assert.deepEq(numReplies, ut.numReplies({ numPreviews: 1 }));
  });
  it(`... but not in 111`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame({ discId: '111' });
    numReplies = await maria_brB.topic.countReplies();
    assert.deepEq(numReplies, ut.numReplies({}));
  });
  it(`... Maria cancels the reply`, async () => {
    await maria_brB.switchToEmbeddedEditorIrame();
    await maria_brB.editor.cancelNoHelp();
  });
  it(`... a draft gets saved in 222`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame({ discId: '222' });
    await maria_brB.topic.waitForPostDraftDisplayed();
  });
  it(`... only the draft there`, async () => {
    numReplies = await maria_brB.topic.countReplies();
    assert.deepEq(numReplies, ut.numReplies({ numDrafts: 1 }));  // preview gone
  });
  it(`... she opens the draft`, async () => {
    await maria_brB.drafts.resumeNthDraft(1);
  });
  it(`... a preview appears instead of the draft`, async () => {
    await maria_brB.topic.waitForPostPreviewDisplayed();
    numReplies = await maria_brB.topic.countReplies();
    assert.deepEq(numReplies, ut.numReplies({ numPreviews: 1 }));
  });
  it(`... closes the editor`, async () => {
    await maria_brB.switchToEmbeddedEditorIrame();
    await maria_brB.editor.cancelNoHelp();
  });
  it(`... preview gone, draft back`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame({ discId: '222' });
    await maria_brB.topic.waitForPostDraftDisplayed();
    numReplies = await maria_brB.topic.countReplies();
    assert.deepEq(numReplies, ut.numReplies({ numDrafts: 1 }));
  });


  it(`... Maria saves a draft in disc 111 too`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame({ discId: '111' });
    await maria_brB.complex.startReplyingToEmbBlogPost(mariasReply_nr2_diid_111);
    await maria_brB.switchToEmbeddedEditorIrame();
    await maria_brB.editor.cancelNoHelp();
  });


  it(`... and in disc 333`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame({ discId: '333' });
    await maria_brB.complex.startReplyingToEmbBlogPost(mariasReply_nr3_diid_333);
    await maria_brB.switchToEmbeddedEditorIrame();
    await maria_brB.editor.cancelNoHelp();
  });


  it(`Maria reloads the page`, async () => {
    await maria_brB.refresh2();
  });

  it(`There's a draft in disc 111`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame({ discId: '111' });
    await maria_brB.topic.waitForNumReplies({ numDrafts: 1 });
  });
  it(`... one in 333`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame({ discId: '333' });
    await maria_brB.topic.waitForNumReplies({ numDrafts: 1 });
  });
  it(`... and one in disc 222`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame({ discId: '222' });
    // This works because drafts saved in the browser, since page
    // not yet lazy created. Otherwise, if saving server side,
    // there'd be a bug [many_ifr_my_page_data]
    await maria_brB.topic.waitForNumReplies({ numDrafts: 1 });
  });

  it(`Maria opens the 222 draft`, async () => {
    await maria_brB.drafts.resumeNthDraft(1);
  });
  it(`... a preview appears instead of the draft`, async () => {
    await maria_brB.topic.waitForPostPreviewDisplayed();
    numReplies = await maria_brB.topic.countReplies();
    assert.deepEq(numReplies, ut.numReplies({ numPreviews: 1 }));
  });
  it(`... she submits the post`, async () => {
    await maria_brB.switchToEmbeddedEditorIrame();
    await maria_brB.editor.waitForDraftTextToLoad(mariasReply_nr1_diid_222);
    await maria_brB.editor.save();
  });
  it(`... it appears`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame({ discId: '222' });   // ttt OK
    await maria_brB.topic.waitForPostAssertTextMatches(   /// ttt ok
            c.FirstReplyNr, mariasReply_nr1_diid_222);
  });
  it(`... now there's 1 reply and 0 drafts`, async () => {
    numReplies = await maria_brB.topic.countReplies();
    assert.deepEq(numReplies, ut.numReplies({ numNormal: 1 }));
  });


  it(`Maria deletes the 333 draft`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame({ discId: '333' });
    await maria_brB.drafts.deleteNthDraft(1);
    // delete via editor instead?
  });
  it(`... it disappears`, async () => {
    numReplies = await maria_brB.topic.countReplies();
    assert.deepEq(numReplies, ut.numReplies({}));
  });


  it(`There's still a draft in disc 111`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame({ discId: '111' });
    numReplies = await maria_brB.topic.countReplies();
    assert.deepEq(numReplies, ut.numReplies({ numDrafts: 1 }));
  });


  it(`Maria reloads the page`, async () => {
    await maria_brB.refresh2();
  });

  it(`Nothing changes. In disc 222 there's a reply`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame({ discId: '222' });
    await maria_brB.topic.waitForNumReplies({ numNormal: 1 });
  });
  it(`... in 333, the draft is gone, nothing there to see`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame({ discId: '333' });
    await maria_brB.topic.waitForNumReplies({});
  });
  it(`... and the draft in 111 didn't disappear`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame({ discId: '111' });
    await maria_brB.topic.waitForNumReplies({ numDrafts: 1 });
  });


  it(`Maria submits the 111 draft`, async () => {
    await maria_brB.drafts.resumeNthDraft(1);
    await maria_brB.switchToEmbeddedEditorIrame();
    await maria_brB.editor.waitForDraftTextToLoad(mariasReply_nr2_diid_111);
    await maria_brB.editor.save();
    await maria_brB.topic.waitForPostAssertTextMatches(
            c.FirstReplyNr, mariasReply_nr2_diid_111);
  });
  it(`There's now 1 reply and 0 drafts`, async () => {
    numReplies = await maria_brB.topic.countReplies();
    assert.deepEq(numReplies, ut.numReplies({ numNormal: 1 }));
  });


  // ---- Preview of a reply to a comment

  it(`Maria starts replying to the comment in 222`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame({ discId: '222' });
    await maria_brB.complex.startReplyingToPostNr(
            c.FirstReplyNr, mariasReply_nr4_did_222_toMaria);
  });
  it(`... a reply preview appears in iframe 222`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame({ discId: '222' });
    await maria_brB.topic.waitForPostPreviewDisplayed();
    numReplies = await maria_brB.topic.countReplies();
    assert.deepEq(numReplies, ut.numReplies({ numNormal: 1, numPreviews: 1 }));
  });
  // -- Break out test fns? --------------
  // Dupl test code [repl_pv_e2e]
  it(`... with the text "Your reply to ..."  TyTREPREVW`, async () => {
    await maria_brB.waitUntilTextMatches('.s_T_YourPrvw_ToWho', /Your reply to /);
  });
  it(`... to "maria" herself, plus Unicode up arrow  TyTREPREVW`, async () => {
    await maria_brB.assertTextIs('.s_T_YourPrvw_ToWho a.dw-rr', maria.username + '⬆');
  });
  it(`... with a link to the parent comment  TyTREPREVW`, async () => {
    await maria_brB.assertDisplayed(
            `.s_T_YourPrvw_ToWho a.dw-rr[href="#post-${c.FirstReplyNr}"]`);
  });
  it(`... the preview is just below the post being replied to TyTREPREVW`, async () => {
    await maria_brB.assertDisplayed(
            '#post-2 + .esPA + .dw-single-and-multireplies > .dw-res > .s_T-Prvw-IsEd');
  });
  it(`... "Replying to:" is shown above the parent comments  TyTREPREVW`, async () => {
    await maria_brB.assertDisplayed(
            `.s_T_ReTo + .esAvtr + #post-${c.FirstReplyNr}`);
    await maria_brB.assertTextIs(
            `.s_T_ReTo .s_T_ReTo_Ttl`, "Replying to:");
  });
  it(`... there's a scroll-to-reply-preview button  TyTREPREVW`, async () => {
    await maria_brB.assertTextIs(
            `.s_T_ReTo .s_T_ReTo_Prvw`, "Scroll to preview ⬇️");
  });
  // -------------------------------------
  it(`Maria posts the reply`, async () => {
    await maria_brB.switchToEmbeddedEditorIrame();
    await maria_brB.editor.save();
    await maria_brB.switchToEmbeddedCommentsIrame({ discId: '222' });
    await maria_brB.topic.waitForPostAssertTextMatches(
            c.FirstReplyNr + 1, mariasReply_nr4_did_222_toMaria);
  });


  // ---- Edits preview

  it(`Maria starts editing the reply to the reply in 222`, async () => {
    await maria_brB.topic.clickEditPostNr(c.FirstReplyNr + 1);
  });
  it(`... an edits preview appears in disc 222`, async () => {
    await maria_brB.topic.waitForPostPreviewDisplayed();
    numReplies = await maria_brB.topic.countReplies();
    assert.deepEq(numReplies, ut.numReplies({ numNormal: 1, numPreviews: 1 }));
  });
  it(`... with the text "Your edits"  TyTEDPREVW`, async () => {
    await maria_brB.waitUntilTextMatches('.s_T_YourPrvw_ToWho', /Your edits:/);
  });
  it(`Maria edits the text`, async () => {
    await maria_brB.switchToEmbeddedEditorIrame();
    await maria_brB.editor.editText(mariasReply_nr4_did_222_edited);
  });
  it(`... draft saved (on editor close)`, async () => {
    await maria_brB.editor.cancelNoHelp();
  });


  // ---- Edit draft and preview works after reload

  it(`Maria reloads the page`, async () => {
    await maria_brB.refresh2();
  });
  it(`She sees an "Unfinished edits" text next to the edit button   UNIMPL`, async () => {
    // Won't show up — only drafts etc for the 1st iframe currently loaded.
    // [many_ifr_my_page_data]
    // '.s_UnfinEd'
  });
  it(`... and starts editing again`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame({ discId: '222' });
    await maria_brB.topic.clickEditPostNr(c.FirstReplyNr + 1);
  });
  it(`... the new edited text is therer`, async () => {
    await maria_brB.switchToEmbeddedEditorIrame();
    await maria_brB.editor.waitForDraftTextToLoad(mariasReply_nr4_did_222_edited);
  });
  it(`... an edits preview appears, like before the reload`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame({ discId: '222' });
    await maria_brB.topic.waitForPostPreviewDisplayed();
    numReplies = await maria_brB.topic.countReplies();
    assert.deepEq(numReplies, ut.numReplies({ numNormal: 1, numPreviews: 1 }));
  });
  it(`... again with the text "Your edits"  TyTEDPREVW`, async () => {
    await maria_brB.waitUntilTextMatches('.s_T_YourPrvw_ToWho', /Your edits:/);
  });
  it(`Maria saves the changes`, async () => {
    await maria_brB.switchToEmbeddedEditorIrame();
    await maria_brB.editor.save();
  });
  it(`Now there're 2 posts, no previews`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame({ discId: '222' });
    await maria_brB.topic.waitForNumReplies({ numNormal: 2 });
  });
  it(`The edits appear`, async () => {
    await maria_brB.topic.waitForPostAssertTextMatches(
            c.FirstReplyNr + 1, mariasReply_nr4_did_222_edited);
  });


});

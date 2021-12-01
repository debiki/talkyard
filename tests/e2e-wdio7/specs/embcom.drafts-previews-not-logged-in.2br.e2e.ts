/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import * as fs from 'fs';
import server from '../utils/server';
import * as ut from '../utils/utils';
import * as make from '../utils/make';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import settings from '../utils/settings';
import c from '../test-constants';


let maria;
let maria_brA: TyE2eTestBrowser;

let idAddress: IdAddress;

const mariasCommentOneOrig = 'mariasCommentOneOrig';
const mariasCommentOneEdited = 'mariasCommentOneEdited';
const mariasCommentTwo = 'mariasCommentTwo';
const mariasCommentThree = 'mariasCommentThree';
const mariasCommentFour = 'mariasCommentFour';

const localHostname = 'comments-for-e2e-test-embddrft-localhost-8080';
const embeddingOrigin = 'http://e2e-test-embddrft.localhost:8080';
const pageDddSlug = 'emb-cmts-ddd.html';
const pageEeeSlug = 'emb-cmts-eee.html';

let numReplies: NumReplies | U;

describe(`embcom.drafts-previews-not-logged-in.2br  TyT2ZBKPW048`, () => {

  it("initialize people", async () => {
    maria_brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    maria = make.memberMaria();
  });

  it("import a site", async () => {
    const site: SiteData = make.forumOwnedByOwen('embddrft', { title: "Emb Cmts Disc Id Test" });
    site.meta.localHostname = localHostname;
    site.settings.allowEmbeddingFrom = embeddingOrigin;
    site.settings.requireVerifiedEmail = false;
    site.settings.mayComposeBeforeSignup = true;
    site.settings.mayPostBeforeEmailVerified = true;
    site.settings.allowGuestLogin = true;
    site.members.push(maria);
    idAddress = server.importSiteData(site);
  });

  it("create two embedding pages ddd & eee", async () => {
    const dir = 'target';
    fs.writeFileSync(`${dir}/${pageDddSlug}`, makeHtml('ddd', '', '#500'));
    fs.writeFileSync(`${dir}/${pageEeeSlug}`, makeHtml('eee', '', '#040'));
    function makeHtml(pageName: string, discussionId: string, bgColor: string): string {
      return ut.makeEmbeddedCommentsHtml({ pageName, discussionId, localHostname, bgColor });
    }
  });

  it("Maria opens embedding page ddd", async () => {
    await maria_brA.go2(embeddingOrigin + '/' + pageDddSlug);
  });

  it("Starts writing a reply, when not logged in", async () => {
    await maria_brA.switchToEmbeddedCommentsIrame();
    await maria_brA.topic.clickReplyToEmbeddingBlogPost();
  });

  it("... writes a comment", async () => {
    await maria_brA.switchToEmbeddedEditorIrame();
    await maria_brA.editor.editText(mariasCommentOneOrig);

    // Chrome 80, Feb 2020, stopped on-unload saving drafts, cannot
    // figure out why: it also won't stop on breakpoints. FF still works fine.
    if (settings.browserName === 'chrome') {  // [NOBEACON] [E2EBUG]
      await maria_brA.editor.waitForDraftSavedInBrowser();
    }
  });


  // ----- Beacon save, first reply

  it("She reloads the page, without posting the comment — this saves the text in the browser", async () => {
    await maria_brA.refresh2();
  });

  it(`... there's a draft preview in the comments frame`, async () => {
    await maria_brA.switchToEmbeddedCommentsIrame();
    await maria_brA.topic.waitForPostDraftDisplayed();
  });
  it(`... nothing else (no replies or previews)`, async () => {
    numReplies = await maria_brA.topic.countReplies();
    assert.deepEq(numReplies, ut.numReplies({ numDrafts: 1 }));
  });
  it(`... the draft text is the text she drafted`, async () => {
    await maria_brA.drafts.waitForNthDraftWithText(1, mariasCommentOneOrig);
  });


  // ----- Resumeb draft by clicking Reply

  it("Maria starts writing again, by clicking blog-post-Reply", async () => {
    await maria_brA.topic.clickReplyToEmbeddingBlogPost();
  });

  it(`... a reply preview appears, draft hidden`, async () => {
    await maria_brA.topic.waitForPostPreviewDisplayed();
    numReplies = await maria_brA.topic.countReplies();
    assert.deepEq(numReplies, ut.numReplies({ numPreviews: 1 }));
  });
  it(`... the preview shows the draft text`, async () => {
    await maria_brA.waitForTextVisibleAssertIs(
            '.s_P-Prvw-IsEd .dw-p-bd', mariasCommentOneOrig);
  });

  it("The draft text appears in the editor; was saved in browser's storage", async () => {
    await maria_brA.switchToEmbeddedEditorIrame();
    await maria_brA.editor.waitForDraftTextToLoad(mariasCommentOneOrig);
  });


  // ----- Resumeb draft by clicking Resume Draft  TyTINPGDFTS

  it("Maria closes the editor ...", async () => {
    await maria_brA.editor.cancelNoHelp();
  });
  it(`... draft back`, async () => {
    await maria_brA.switchToEmbeddedCommentsIrame();
    await maria_brA.topic.waitForPostDraftDisplayed();
  });
  it(`... preview gone`, async () => {
    numReplies = await maria_brA.topic.countReplies();
    assert.deepEq(numReplies, ut.numReplies({ numDrafts: 1 }));
  });
  it(`Maria opens by clicking the Resume Draft button`, async () => {
    await maria_brA.drafts.resumeNthDraft(1);
  });
  it(`... a reply preview appears, draft hidden`, async () => {
    await maria_brA.topic.waitForPostPreviewDisplayed();
    numReplies = await maria_brA.topic.countReplies();
    assert.deepEq(numReplies, ut.numReplies({ numPreviews: 1 }));
  });
  it(`... the draft text appears in the editor now too`, async () => {
    await maria_brA.switchToEmbeddedEditorIrame();
    await maria_brA.editor.waitForDraftTextToLoad(mariasCommentOneOrig);
  });


  // ----- Drafts are per page

  it("she goes from page ddd to eee", async () => {
    await maria_brA.switchToAnyParentFrame();
    let source = await maria_brA.getPageSource();
    assert.includes(source, 'ddd');
    await maria_brA.go2(embeddingOrigin + '/' + pageEeeSlug);
    source = await maria_brA.getPageSource();
    assert.includes(source, 'eee');
  });

  it(`... there's no draft in this comments iframe — it's another page`, async () => {
    await maria_brA.switchToEmbeddedCommentsIrame();
    numReplies = await maria_brA.topic.countReplies();
    assert.deepEq(numReplies, ut.numReplies({}));
  });

  it("... starts replying to page Eee's blog post", async () => {
    await maria_brA.topic.clickReplyToEmbeddingBlogPost();
  });

  it("... now there's no draft — because this is a different page, page Eee", async () => {
    await maria_brA.switchToEmbeddedEditorIrame();
    await maria_brA.editor.waitForDraftTextToLoad('');
  });

  it("she retunrs to ddd", async () => {
    await maria_brA.go2(embeddingOrigin + '/' + pageDddSlug);
    const source = await maria_brA.getPageSource();
    assert.includes(source, 'ddd');
  });

  it(`... her draft is here`, async () => {
    await maria_brA.switchToEmbeddedCommentsIrame();
    numReplies = await maria_brA.topic.countReplies();
    assert.deepEq(numReplies, ut.numReplies({ numDrafts: 1 }));
  });

  it("Maria starts replying again", async () => {
    await maria_brA.topic.clickReplyToEmbeddingBlogPost();
  });

  it("... the draft text loads, again", async () => {
    await maria_brA.switchToEmbeddedEditorIrame();
    await maria_brA.editor.waitForDraftTextToLoad(mariasCommentOneOrig);
  });

  it("... she edits the reply draft", async () => {
    await maria_brA.editor.editText(mariasCommentOneEdited);
  });


  // ----- Unmount save, first reply

  it("And closes the editor — this unmount-saves a draft", async () => {
    await maria_brA.editor.cancelNoHelp();
  });

  it("She refreshes, and reopens the editor", async () => {
    await maria_brA.refresh2();
    await maria_brA.switchToEmbeddedCommentsIrame();
    await maria_brA.topic.clickReplyToEmbeddingBlogPost();
  });

  it("... the text is there, edited", async () => {
    await maria_brA.switchToEmbeddedEditorIrame();
    await maria_brA.editor.waitForDraftTextToLoad(mariasCommentOneEdited);
  });

  it("She clicks Post Reply", async () => {
    await maria_brA.editor.save();
  });

  it("... logs in, to post the comment", async () => {
    await maria_brA.loginDialog.loginWithPasswordInPopup(maria);
  });

  it("The comment is there, as the first reply", async () => {
    await maria_brA.switchToEmbeddedCommentsIrame();
    await maria_brA.topic.waitForPostAssertTextMatches(c.FirstReplyNr, mariasCommentOneEdited);
  });

  it("... the draft and preview are gone", async () => {
    numReplies = await maria_brA.topic.countReplies();
    assert.deepEq(numReplies, ut.numReplies({ numNormal: 1 }));
  });


  // ----- Beacon save, subsequent replies

  it("Maria logs out", async () => {
    await maria_brA.metabar.clickLogout();
  });

  it("And starts typing a reply to herself, not logged in", async () => {
    await maria_brA.switchToEmbeddedCommentsIrame();
    await maria_brA.topic.clickReplyToPostNr(c.FirstReplyNr);
    await maria_brA.switchToEmbeddedEditorIrame();
    await maria_brA.editor.editText(mariasCommentTwo);
    if (settings.browserName === 'chrome') {  // [NOBEACON] [E2EBUG]
      await maria_brA.editor.waitForDraftSavedInBrowser();
    }
  });

  it("Refreshs the page — this beacon saves", async () => {
    await maria_brA.refresh2();
  });

  it("She starts replying to herself again", async () => {
    await maria_brA.switchToEmbeddedCommentsIrame();
    await maria_brA.topic.clickReplyToPostNr(c.FirstReplyNr);
  });

  // -- Break out test fns? --------------
  // Dupl test code [repl_pv_e2e]
  it(`A reply preview appears`, async () => {
    await maria_brA.topic.waitForPostPreviewDisplayed();
    numReplies = await maria_brA.topic.countReplies();
    assert.deepEq(numReplies, ut.numReplies({ numNormal: 1, numPreviews: 1 }));
  });
  it(`... and a "Replying to" text at the comment she's replying to`, async () => {
    await maria_brA.waitUntilTextMatches(
            '.s_T-Prvw-IsEd .s_T_YourPrvw_ToWho', /Your reply to /);
  });
  it(`... the preview is just below the post being replied to TyTREPREVW`, async () => {
    await maria_brA.assertDisplayed(
            `#post-${c.FirstReplyNr
                } + .esPA + .dw-single-and-multireplies > .dw-res > .s_T-Prvw-IsEd`);
  });
  it(`... "Replying to:" is shown above the parent comment  TyTREPREVW`, async () => {
    await maria_brA.assertDisplayed(
            `.s_T_ReTo + .esAvtr + #post-${c.FirstReplyNr}`);
    await maria_brA.assertTextIs(
            `.s_T_ReTo .s_T_ReTo_Ttl`, "Replying to:");
  });
  // -------------------------------------

  it("... the text is there, it got beacon-saved", async () => {
    await maria_brA.switchToEmbeddedEditorIrame();
    await maria_brA.editor.waitForDraftTextToLoad(mariasCommentTwo);
  });


  // ----- Drafts are per post

  it("She closes the editor", async () => {
    await maria_brA.editor.cancelNoHelp();
  });

  it("And clicks Reply, to the blog post (but not her own comment)", async () => {
    await maria_brA.switchToEmbeddedCommentsIrame();
    await maria_brA.topic.clickReplyToEmbeddingBlogPost();
  });

  // -- Break out test fns? --------------
  // Dupl test code [repl_pv_e2e]
  it(`A blog post reply preview appears`, async () => {
    await maria_brA.topic.waitForPostPreviewDisplayed();
    numReplies = await maria_brA.topic.countReplies();
    assert.deepEq(numReplies, ut.numReplies({
            numNormal: 1, numDrafts: 1, numPreviews: 1 }));
  });
  it(`... with the text "Preview:" above`, async () => {
    await maria_brA.waitForTextVisibleAssertIs(
            '.s_T-Prvw-IsEd > .s_T_YourPrvw', "Preview:");
  });
  it(`... it's placed after the other commets  TyTPOSTORDR`, async () => {
    await maria_brA.assertDisplayed(
          '.s_ThrDsc > .dw-single-and-multireplies > .dw-singlereplies ' +
          ' > li:last-child > .s_T-Prvw-IsEd > .s_T_YourPrvw');
  });
  // -------------------------------------

  it("Now no draft text loads, because the draft is for a reply to Marias's comment", async () => {
    await maria_brA.switchToEmbeddedEditorIrame();
    await maria_brA.editor.waitForDraftTextToLoad('');
  });


  it(`Maria submits a comment`, async () => {
    await maria_brA.switchToEmbeddedEditorIrame();
    await maria_brA.editor.editText(mariasCommentThree, { timeoutMs: 3000 });
    await maria_brA.editor.save();
  });
  it(`... needs to login again  TyTRELZYAUN`, async () => {
    await maria_brA.loginDialog.loginWithPasswordInPopup(maria);
  });
  it(`... the comment appears`, async () => {
    await maria_brA.switchToEmbeddedCommentsIrame();
    await maria_brA.topic.waitForPostAssertTextMatches(
            c.FirstReplyNr + 1, mariasCommentThree);
  });
  it(`... at the bottom  TyTPOSTORDR`, async () => {   // dupl test code [repl_pv_e2e]
    await maria_brA.assertDisplayed(
          '.s_ThrDsc > .dw-single-and-multireplies > .dw-res > li:last-child ' +
          ` > .dw-t > #post-${c.FirstReplyNr + 1} > .dw-p-bd`);
  });
  it(`The comment preview is gone, but the draft still there`, async () => {
    numReplies = await maria_brA.topic.countReplies();
    assert.deepEq(numReplies, ut.numReplies({ numNormal: 2, numDrafts: 1 }));
  });


  // ----- Delete drafts by clicking Delete Draft  TyTINPGDFTS

  it(`Maria starts replying to the last comment`, async () => {
    await maria_brA.complex.startReplyingToPostNr(
            c.FirstReplyNr + 1, mariasCommentFour);
  });
  it("... cancels", async () => {
    await maria_brA.editor.cancelNoHelp();
  });
  it(`... now there're two drafts`, async () => {
    await maria_brA.switchToEmbeddedCommentsIrame();
    await maria_brA.topic.waitForNumReplies({ numNormal: 2, numDrafts: 2 });
  });

  it(`Maria deletes the first draft`, async () => {
    await maria_brA.drafts.deleteNthDraft(1);
  });
  it(`... now there's just one draft`, async () => {
    await maria_brA.topic.waitForNumReplies({ numNormal: 2, numDrafts: 1 });
  });
  it(`... it's for the last reply`, async () => {   // dupl test code [repl_pv_e2e]
    await maria_brA.assertDisplayed(
            `#post-${c.FirstReplyNr + 1
              } + .esPA + .dw-single-and-multireplies > .dw-res > .s_T-Prvw-NotEd`);
  });

  it(`Maria reloads the page`, async () => {
    await maria_brA.refresh2();
  });
  it(`... the draft is still there (but not the deleted one)`, async () => {
    await maria_brA.switchToEmbeddedCommentsIrame();
    await maria_brA.topic.waitForNumReplies({ numNormal: 2, numDrafts: 1 });
  });
  it(`... still for the last reply`, async () => {   // dupl test code [repl_pv_e2e]
    await maria_brA.assertDisplayed(
            `#post-${c.FirstReplyNr + 1
              } + .esPA + .dw-single-and-multireplies > .dw-res > .s_T-Prvw-NotEd`);
  });

  it(`Maria resumes and submits the draft`, async () => {
    await maria_brA.drafts.resumeNthDraft(1);
    await maria_brA.switchToEmbeddedEditorIrame();
    await maria_brA.editor.editText(" EDITED", { append: true});
    await maria_brA.editor.save();
  });
  it(`... a reply to the last comment appears`, async () => {
    await maria_brA.switchToEmbeddedCommentsIrame();
    await maria_brA.topic.waitForPostAssertTextMatches(
            c.FirstReplyNr + 2, mariasCommentFour + " EDITED");
  });
  it(`... all drafts gone`, async () => {
    await maria_brA.topic.waitForNumReplies({ numNormal: 3 });
  });


  // ----- Deleted draft really gone

  it(`Replying to the first comment, won't bring back the deleted draft`, async () => {
    await maria_brA.complex.startReplyingToPostNr(c.FirstReplyNr);
    await maria_brA.editor.waitForDraftTextToLoad('');
  });
  it(`... also won't, if logging out ...`, async () => {
    await maria_brA.switchToEmbeddedCommentsIrame();
    await maria_brA.metabar.clickLogout();
    await maria_brA.refresh2();
  });
  it(`... and starting to reply: there's no saved draft text`, async () => {
    await maria_brA.switchToEmbeddedCommentsIrame();
    await maria_brA.complex.startReplyingToPostNr(c.FirstReplyNr);
    await maria_brA.editor.waitForDraftTextToLoad('');
  });
});


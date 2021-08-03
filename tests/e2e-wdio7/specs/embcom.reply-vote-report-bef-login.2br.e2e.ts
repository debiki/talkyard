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

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let maria: Member;
let maria_brB: TyE2eTestBrowser;
let memah: Member;
let memah_brB: TyE2eTestBrowser;

const localHostname = 'comments-for-e2e-test-embdftpv-localhost-8080';
const embeddingOrigin = 'http://e2e-test-embdftpv.localhost:8080';

let site: IdAddress;
let forum: TwoCatsTestForum;

const owensComment = 'owensComment';
const mariasReply = 'mariasReply';


describe(`embcom.reply-vote-report-bef-login.2br  TyTEEMBCDOBEFAUN`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "Emb Coms Vote Before Logged In E2e Test",
      members: undefined, // default = everyone
        // ['mons', 'modya', 'regina', 'corax', 'memah', 'maria', 'michael', 'mallory']
    });

    builder.getSite().meta.localHostname = localHostname;
    builder.getSite().settings.allowEmbeddingFrom = embeddingOrigin;
    builder.getSite().settings.mayComposeBeforeSignup = true;

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


  it(`There's embedding pages`, () => {
    const dir = 'target';
    fs.writeFileSync(`${dir}/page-a-slug.html`, makeHtml('aaa', '#500'));
    fs.writeFileSync(`${dir}/page-b-slug.html`, makeHtml('bbb', '#040'));
    function makeHtml(pageName: St, bgColor: St): St {
      return utils.makeEmbeddedCommentsHtml({
              pageName, discussionId: '', localHostname, bgColor});
    }
  });

  it(`Owen goes to emb page a, without logging in`, async () => {
    await owen_brA.go2(embeddingOrigin + '/page-a-slug.html');
  });


  // ----- Post comment before logged in, & before embedded page lazy created

  it(`Owen composes and submits a comment, but not yet logged in`, async () => {
    await owen_brA.switchToEmbeddedCommentsIrame();
    await owen_brA.topic.clickReplyToEmbeddingBlogPost();
    await owen_brA.switchToEmbeddedEditorIrame();
    await owen_brA.editor.editText(owensComment, { timeoutMs: 3000 });
    await owen_brA.editor.save();
  });
  it(`... he needs to login  TyTRELZYAUN`, async () => {
    await owen_brA.loginDialog.loginWithPasswordInPopup(owen);
  });


  // ----- Flag comment before logged in

  it(`Maria sees Owen's comment, when not logged in herself`, async () => {
    await maria_brB.go2(embeddingOrigin + '/page-a-slug.html');
    await maria_brB.switchToEmbeddedCommentsIrame();
    await maria_brB.topic.waitForPostAssertTextMatches(c.FirstReplyNr, owensComment);
  });

  it(`... she starts reporting Owen's comment`, async () => {
    await maria_brB.topic.clickFlagPost(c.FirstReplyNr, { needToClickMore: false });
  });
  it(`... needs to login`, async () => {
    await maria_brB.loginDialog.loginWithPasswordInPopup(maria);
  });
  it(`... back in the comments iframe`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame();
  });
  it(`... can now flag the comment as Inappropriate`, async () => {
    await maria_brB.flagDialog.waitUntilFadedIn();
    await maria_brB.flagDialog.clickInappropriate();
  });
  it(`... submit`, async () => {
    await maria_brB.flagDialog.submit();
  });
  it(`... close "the staff will take a look" dialog`, async () => {
    await maria_brB.stupidDialog.close();
  });
  it(`(Add test?: Owen gets an email)`, async () => {
  });


  // ----- Like vote before logged in

  it(`Maria leaves`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame();
    await maria_brB.metabar.clickLogout();
  });
  it(`Maria clicks Like — a sudden change of mind. She needs to log in`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame();
    await maria_brB.topic.clickLikeVote(c.FirstReplyNr);
  });
  it(`... needs to log in in popup`, async () => {
    await maria_brB.loginDialog.loginWithPasswordInPopup(maria);
  });
  it(`... now the post is Like voted by Maria`, async () => {
    await maria_brB.switchToEmbCommentsIframeIfNeeded();
    await maria_brB.topic.waitForLikeVote(c.FirstReplyNr);
    assert.ok(await maria_brB.topic.isPostLikedByMe(c.FirstReplyNr));
  });


  // ----- Post comment before logged in  (after emb page created)

  it(`Maria leaves again`, async () => {
    await maria_brB.metabar.clickLogout();
  });
  it(`But returns and replies to Owen`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame();
    await maria_brB.complex.startReplyingToPostNr(c.FirstReplyNr, mariasReply);
  });
  it(`... when she clicks Submit`, async () => {
    await maria_brB.editor.save();
  });
  it(`... she needs to login again  TyTRELZYAUN`, async () => {
    await maria_brB.loginDialog.loginWithPasswordInPopup(maria);
  });
  it(`... thereafter her reply to Owen appears`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame();
    await maria_brB.topic.waitForPostAssertTextMatches(c.FirstReplyNr + 1, mariasReply);
  });


  // ----- Disagree vote before logged in

  // (Only Disagree — Bury and Unwant are hidden before logged in.)

  it(`Maria leaves`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame();
    await maria_brB.metabar.clickLogout();
  });
  it(`Maria clicks Disagree`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame();
    await maria_brB.topic.toggleDisagreeVote(c.FirstReplyNr, { waitForModalGone: false });
  });
  it(`... needs to log in in popup`, async () => {
    await maria_brB.loginDialog.loginWithPasswordInPopup(maria);
  });
  it(`... now the post is Disagreed with by Maria`, async () => {
    await maria_brB.switchToEmbCommentsIframeIfNeeded();
    assert.ok(await maria_brB.topic.isPostDisagreVoted(c.FirstReplyNr));
  });

});


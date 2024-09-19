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
let merry_brB: TyE2eTestBrowser;
const merrysEmailAdr = 'merry@ex.co';

let site: IdAddress;
let forum: TwoCatsTestForum;



// Not finished! [_Work_in_progress].
//
describe(`frag-action-compose-topic.2br.f  TyTFRAGCOMPTO`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addCatABForum({
      title: "Some E2E Test",
      categoryAExtId: 'cat_a_ext_id',
      members: ['maria', 'michael']
    });

    builder.settings({
      requireVerifiedEmail: false,
      mayComposeBeforeSignup: true,
    });

    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;

    merry_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = await server.importSiteData(forum.siteData);
    await server.skipRateLimits(site.id);
  });


  it(`Owen arrives, logs in`, async () => {
    await owen_brA.go2(site.origin);
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
  });


  // [_Work_in_progress]:
  //
  // What's supposed to happen, if one doesn't have an account yet, and one
  // follows a  #composeTopic  link?  Should the signup dialog open?
  // But is that really good UX, popping up a dialog the first thing,
  // the person maybe not understanding why — they probably didn't look closely
  // at the URL.
  //
  // But if mayComposeBeforeSignup enabled, then, can open the editor instead,
  // that's less confusing? & works, but when submitting, and signing up,
  // seems the draft is lost :-(
  //
  it(`Merry arrives — via a #composeTopic link somehow`, async () => {
    //  http://e2e-test-cid-0-0-now-5232.localhost/latest#composeTopic&categoryId=4&topicType=12
await merry_brB.d();
    await merry_brB.go2(site.origin +
            `#composeTopic&categoryId=${forum.categories.catB.id
                }&topicType=${c.TestPageRole.Discussion}`);
  });

  it(`... The editor opens; Merry types a title`, async () => {
await merry_brB.d();
    await merry_brB.editor.editTitle("I'm Merry_Not_Zorro")
    await merry_brB.editor.editText("I have the 949 most popular name, wow. " +
        "Zorro is no. 10 019, 2023.")
  });

  it(`...  clicks Save`, async () => {
    // But don't wait for new page, don't: `saveWaitForNewPage()`.
    await merry_brB.editor.clickSave();
  });

  
  it(`... the Create Account dialog opens; Merry fills it in and submits`, async () => {
    await merry_brB.rememberCurrentUrl();
    await merry_brB.loginDialog.createPasswordAccount({
              username: 'merry',
              emailAddress: merrysEmailAdr,
              password: 'public-p4ssw0rd',
            });
  });

  /*
  it(`... the new topic appears`, async () => {
    // Ooops, need verify email. Once done, draft gone — one's account didn't yet exist.

    await merry_brB.waitForNewUrl();
    await merry_brB.assertPageTitleMatches(/Merry_Not_Zorro/);
  });

  let verifLink: St;

  it(`... gets an email, clicks the verification link`, async () => {
    verifLink = await server.waitAndGetLastVerifyEmailAddressLinkEmailedTo(
            site.id, merrysEmailAdr);
  });

  it(`... clicks it`, async () => {
    await merry_brB.go2(verifLink);
  });
  it(`... gets logged in`, async () => {
    await merry_brB.hasVerifiedSignupEmailPage.clickContinue();
  });
  it(`... sees her username menu`, async () => {
    await merry_brB.topbar.assertMyUsernameMatches('merry');
  }); */

});


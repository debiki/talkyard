/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import * as fs from 'fs';
import server from '../utils/server';
import * as utils from '../utils/utils';
import * as make from '../utils/make';
import c from '../test-constants';
import { TyE2eTestBrowser, IsWhere } from '../utils/ty-e2e-test-browser';
import settings from '../utils/settings';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let mei: Member;
let mei_brB: TyE2eTestBrowser;

let newSite: { id: SiteId, origin: St } | U;

const localHostname = 'comments-for-e2e-test-creembsit';
const embeddingOrigin = 'http://e2e-test-creembsit.localhost:8080';



describe(`embcom.create-site-via-api.2br  TyTE2ECREAEMBSITAPI`, () => {

  if (settings.prod) {
    console.log(`Skipping this spec — needs:
          talkyard.createSiteApiSecret="publicCreateSiteApiTestSecret"`);  // E2EBUG
    return;
  }

  it(`Create browsers`, async () => {
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = make.memberOwenOwner();
    owen_brA = brA;
    
    mei = make.memberMei();
    mei_brB = brB;
  });


  it(`Create embedded comments site via API`, async () => {
    newSite = server.apiV0.createSite({ data: {
      testSiteOkDelete: true,
      acceptTermsAndPrivacy: true,
      localHostname: 'comments-for-e2e-test-creembsit',
      createEmbeddedComments: true,
      embeddingSiteAddress: embeddingOrigin,
      organizationName: "E2E Test Create Site Via Api",
      ownerUsername: owen.username,
      ownerEmailAddr: owen.emailAddress,
      ownerEmailAddrVerified: true,
      // Maybe later — so won't need to use Forgot-password link?
      // ownerOneTimeLoginSecret: ___,
    }}).newSite;
  });


  it(`Skip rate limits`, async () => {
    server.skipRateLimits(newSite.id);
  });


  it(`Create embedding pages`, () => {
    const dir = 'target';
    fs.writeFileSync(`${dir}/page-a-slug.html`, makeHtml('aaa', '#500'));
    fs.writeFileSync(`${dir}/page-b-slug.html`, makeHtml('bbb', '#040'));
    function makeHtml(pageName: St, bgColor: St): St {
      return utils.makeEmbeddedCommentsHtml({
              pageName, discussionId: '', localHostname, bgColor});
    }
  });


  it(`Owen goes to the admin area, ... `, async () => {
    await owen_brA.adminArea.goToUsersEnabled(newSite.origin);
  });

  it(`Owen resets his password`, async () => {
    await owen_brA.complex.resetPasswordFromLoginDialog({ site: newSite, who: owen,
            newPassword: owen.password });
  });

  it(`... closse the exta tab where he type the password`, async () => {
    await owen_brA.closeWindowSwitchToOther();
  });

  it(`Owen goes to the admin area (already logged in)`, async () => {
    await owen_brA.adminArea.goToUsersEnabled();
  });

  it(`... sees one user in the active users tab`, async () => {
    await owen_brA.adminArea.users.asserExactlyNumUsers(1);
  });

  it(`... namely himself`, async () => {
    await owen_brA.adminArea.users.assertUserListed(owen);
  });


  it(`Mei goes there too`, async () => {
    await mei_brB.go2(embeddingOrigin + '/page-a-slug.html');
  });

  it(`... creates an account`, async () => {
    await mei_brB.complex.signUpAsMemberViaPagebar(mei);
  });


  it(`Mei verifies her email address`, async () => {
    const link = await server.waitAndGetLastVerifyEmailAddressLinkEmailedTo(
        newSite.id, mei.emailAddress);
    await mei_brB.go2(link);
  });
  it(`... gets logged in to the embedded comments`, async () => {
    await mei_brB.rememberCurrentUrl();
    await mei_brB.hasVerifiedSignupEmailPage.clickContinue();
  });
  it(`... is then sent to the embedded comments page`, async () => {
    await mei_brB.waitForNewUrl();
    let url = await mei_brB.getUrl();
    assert.eq(url, embeddingOrigin + '/page-a-slug.html'
                                                  + '#'); // why needed? Oh well.
  });



  it(`Now Owen sees two users`, async () => {
    await owen_brA.refresh2();
    await owen_brA.adminArea.users.asserExactlyNumUsers(2);
  });

  it(`... namely himself and Mei`, async () => {
    await owen_brA.adminArea.users.assertUserListed(owen);
    await owen_brA.adminArea.users.assertUserListed(mei);
  });


  it(`Owen logs out, done for the day`, async () => {
    await owen_brA.topbar.clickLogout();
  });



  // ----- Verify that the new site can actually be used

  it(`Mei posts a comment`, async () => {
    await mei_brB.complex.replyToEmbeddingBlogPost("Meis_comment");
  });

  it(`... Owen gets a notification email, clicks link to Mei's comment`, async () => {
    const link = await server.waitAndGetLastReplyNotfLinkEmailedTo(newSite.id, owen.emailAddress,
            { textInMessage: "Meis_comment", urlPart: embeddingOrigin + '/page-a-slug.html' });
    await owen_brA.go2(link);
    //const matchRes = await server.waitUntilLastEmailMatches(newSite.id, owen.emailAddress, "Meis_comment");
    //matchRes.matchedEmail.
  });

  it(`... Owen sees the reply`, async () => {
    await owen_brA.switchToEmbCommentsIframeIfNeeded();
    await owen_brA.topic.waitForNumReplies({ numNormal: 1 });
    await owen_brA.topic.assertPostTextIs(c.FirstReplyNr, "Meis_comment");
  });

  /*  Window handle E2E test bug, skip for now: [E2EBUG]

  it(`... clicks Reply`, async () => {
    await owen_brA.topic.clickReplyToPostNr(c.FirstReplyNr);
  });

  it(`... submits a message`, async () => {
    await owen_brA.editor.editText(`Owens_reply`);
    await owen_brA.editor.clickSave();
        // await this.editor.clickSave();
    await owen_brA.swithToOtherTabOrWindow(IsWhere.LoginPopup);
    await owen_brA.loginDialog.switchToLoginIfIsSignup();
    await owen_brA.loginDialog.loginWithPassword(owen);
    //await owen_brA.switchBackToFirstTabOrWindow();
  });

  it(`Mei sees the reply`, async () => {
    await mei_brB.refresh2();
    await mei_brB.topic.waitForNumReplies({ numNormal: 2 });
  });
  */

});


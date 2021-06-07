/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('../utils/ty-assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import make = require('../utils/make');
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import lad = require('../utils/log-and-die');
import c = require('../test-constants');


let brA;
let brB;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let maja: Member;
let maja_brB: TyE2eTestBrowser;
let memah: Member;
let memah_brA: TyE2eTestBrowser;

let site: IdAddress;
let siteId;

let forum: EmptyTestForum;

const apiSecret: TestApiSecret = {
  nr: 1,
  userId: c.SysbotUserId,
  createdAt: c.MinUnixMillis,
  deletedAt: undefined,
  isDeleted: false,
  secretKey: 'publicE2eTestSecretKey306XSEGR20902',
};

const ssoDummyLoginSlug = 'sso-dummy-login.html';
const ssoUrl =
    `http://localhost:8080/${ssoDummyLoginSlug}?returnPath=\${talkyardPathQueryEscHash}`;


const categoryExtId = 'cat_ext_id';
const majasExternalId = 'majasExternalId';
const majasSsoId = 'majasSsoId';



describe(`api-update-user-and-sso-user.2br   TyTE2E05MRR9`, () => {

  if (settings.prod) {
    console.log("Skipping this spec — the server needs to have upsert conf vals enabled."); // E2EBUG
    return;
  }


  // ----- Create site, with API enabled

  it(`import a site`, () => {
    const builder = buildSite();
    forum = builder.addEmptyForum({
      title: "API Upd Users E2E Test",
      members: ['owen', 'memah'],
    });
    assert.eq(builder.getSite(), forum.siteData);
    builder.getSite().settings.enableApi = true;
    builder.getSite().apiSecrets = [apiSecret];

    // Disable notifications to Owen, or email counts would be off.
    builder.settings({
      numFirstPostsToApprove: 0,
      numFirstPostsToReview: 0,
    });
    builder.getSite().pageNotfPrefs = [{
      memberId: forum.members.owen.id,
      notfLevel: c.TestPageNotfLevel.EveryPost,
      wholeSite: true,
    }];

    site = server.importSiteData(builder.getSite());
    siteId = site.id;
  });

  it(`initialize people`, () => {
    brA = new TyE2eTestBrowser(browserA);
    brB = new TyE2eTestBrowser(browserB);

    owen = forum.members.owen;
    owen_brA = brA;

    memah = forum.members.memah;
    memah_brA = brA;

    maja = make.memberMaja();
    maja_brB = brB;
  });


  // ----- Update email and name of ordinary password + username user


  it(`Memah arrives, logs in`, () => {
    memah_brA.go2(site.origin);
    memah_brA.complex.loginWithPasswordViaTopbar(memah);
  });


  /*  Wait with this.  Currently the endpoints
        /-/v0/upsert-user(and-login|get-login-secret)?
      will be for Single Sign-On only (and that's all Ty users have asked for,
      this far).

  it(`But Sysbot API-changes Memah's name and email`, () => {
    const externalMaja = utils.makeExternalUserFor(maja, {
      ssoId: `username:${memah.username}`,   <——— oops won't work, no ssoId
      fullName: "Mimmi Is Me",
      primaryEmailAddress: 'e2e_test_mimmi_email2@x.co',
      username: 'mimmi_was_here',
    });
    server.apiV0.upsertUser({
      origin: site.origin,
      apiRequesterId: c.SysbotUserId,
      apiSecret: apiSecret.secretKey,
      externalUser: externalMaja,
    });
  });


  it(`Maja reloads her profile page`, () => {
    memah_brA.refresh2();
  });

  it(`... her name, username and email have been changed`, () => {
    memah_brA.userProfilePage.waitUntilUsernameIs('mimmi_was_here');
    memah_brA.userProfilePage.assertFullNameIs("Mimmi Is Me");
    memah_brA.userProfilePage.preferences.emailsLogins.waitUntilEmailAddressListed(
          'e2e_test_mimmi_email2@x.co');
  });  */




  // ----- Upsert Maja, a SSO user


  let oneTimeLoginSecret;

  it(`Upsert Maja, and get a one-time-login-key`, () => {
    const externalMaja = utils.makeExternalUserFor(maja, { ssoId: majasSsoId });
    oneTimeLoginSecret = server.apiV0.upsertUserGetLoginSecret({
      origin: site.origin,
      apiRequesterId: c.SysbotUserId,
      apiSecret: apiSecret.secretKey,
      externalUser: externalMaja,
    });
  });

  it(`... gets back a one time login secret`, () => {
    console.log(`Got back login secret: ${oneTimeLoginSecret}`);
    assert.ok(oneTimeLoginSecret);
  });

  it(`... redirects Maja to the Talkyard login-with-secret endpoint`, () => {
    maja_brB.rememberCurrentUrl();
    maja_brB.apiV0.loginWithSecret({
      origin: site.origin,
      oneTimeSecret: oneTimeLoginSecret,
      thenGoTo: '/new',
    });
    maja_brB.waitForNewUrl();
  });

  it(`The Talkayrd server logs Maja in, redirects her to /new`, () => {
    assert.eq(maja_brB.urlPath(), '/new');
  });

  it(`Maja goes to her profile page`, () => {
    maja_brB.userProfilePage.preferences.emailsLogins.goHere(maja.username);
  });

  it(`.. looks at her email address, username, full name`, () => {
    maja_brB.userProfilePage.waitUntilUsernameIs(maja.username)
    maja_brB.userProfilePage.assertFullNameIs(maja.fullName);
    maja_brB.userProfilePage.preferences.emailsLogins.waitUntilEmailAddressListed(
          maja.emailAddress);
  });



  // ----- Update email, name, username


  it(`Sysbot API-changes Maja's email, name, username`, () => {
    const externalMaja = utils.makeExternalUserFor(maja, {
      ssoId: majasSsoId,
      fullName: "Maja_2nd_Name",
      primaryEmailAddress: 'e2e_test_maja_email2@x.co',
      username: 'maja_un2',
    });
    server.apiV0.upsertUser({
      origin: site.origin,
      apiRequesterId: c.SysbotUserId,
      apiSecret: apiSecret.secretKey,
      externalUser: externalMaja,
    });
  });


  it(`Maja reloads her profile page`, () => {
    maja_brB.refresh2();
  });

  it(`... her name, username and email have been changed`, () => {
    maja_brB.userProfilePage.waitUntilUsernameIs('maja_un2');
    maja_brB.userProfilePage.assertFullNameIs("Maja_2nd_Name");
    maja_brB.userProfilePage.preferences.emailsLogins.waitUntilEmailAddressListed(
          'e2e_test_maja_email2@x.co');
  });



  // ----- Update email, but *fail*


  it(`Sysbot API-updates Maja's email to Owen's email — won't work`, () => {
    const externalMaja = utils.makeExternalUserFor(maja, {
      ssoId: majasSsoId,
      primaryEmailAddress: owen.emailAddress,
    });
    const errTxt = server.apiV0.upsertUser({
      origin: site.origin,
      apiRequesterId: c.SysbotUserId,
      apiSecret: apiSecret.secretKey,
      externalUser: externalMaja,
      fail: true,
    });
    maja_brB.l(`Server says:\n${errTxt}`);
    assert.includes(errTxt, 'TyEUPSDUPEML_');
  });



  // ----- Update username, auto fix collission


  it(`Sysbot API-updates Maja's username to Owen's username
          — gets changed to nearby name, since username already in use (by Owen)`, () => {
    const externalMaja: ExternalUser = {
      ssoId: majasSsoId,
      primaryEmailAddress: 'e2e_test_maja_email2@x.co',
      isEmailAddressVerified: true,
      username: owen.username,   //  <——
    };
    server.apiV0.upsertUser({
      origin: site.origin,
      apiRequesterId: c.SysbotUserId,
      apiSecret: apiSecret.secretKey,
      externalUser: externalMaja,
    });
  });


  it(`Maja reloads her profile page`, () => {
    maja_brB.refresh2();
  });

  it(`... now she's 'owen_owner[a-number]'`, () => {
    const newName = maja_brB.userProfilePage.waitAndGetUsername();
    assert.matches(newName, owen.username + '[0-9]');
  });

  it(`... nothing else got changed`, () => {
    maja_brB.userProfilePage.assertFullNameIs('Maja_2nd_Name');
    maja_brB.userProfilePage.preferences.emailsLogins.waitUntilEmailAddressListed(
          'e2e_test_maja_email2@x.co');
  });



  // ----- Update username and name, auto fix funny tokens


  it(`Sysbot API-updates Maja's username: adds funny tokens, and a looong name
        — gets auto corrected`, () => {
    const externalMaja: ExternalUser = {
      ssoId: majasSsoId,
      primaryEmailAddress: 'e2e_test_maja_email2@x.co',
      isEmailAddressVerified: true,
      username: ' ma + ? j____a-fu!!.,#nny ',
      fullName: '  Maja 67890' + '1234567890'.repeat(200) + '  ',  // max length is 100
    };
    const errTxt = server.apiV0.upsertUser({
      origin: site.origin,
      apiRequesterId: c.SysbotUserId,
      apiSecret: apiSecret.secretKey,
      externalUser: externalMaja,
    });
  });


  it(`Maja reloads her profile page`, () => {
    maja_brB.refresh2();
  });

  it(`... now she has a funny, but valid, username and full name`, () => {
    maja_brB.userProfilePage.waitUntilUsernameIs('ma_j_a_fu_nny');
    // Max length is 100, see Validation.MaxFullNameLength.
    maja_brB.userProfilePage.assertFullNameIs('Maja 67890' + '1234567890'.repeat(9));
  });

  it(`... nothing else got changed`, () => {
    maja_brB.userProfilePage.preferences.emailsLogins.waitUntilEmailAddressListed(
          'e2e_test_maja_email2@x.co');
  });



  // ----- User account still works: Can login

  it(`Maja logs out`, () => {
    maja_brB.topbar.clickLogout();
  });

  it(`Maja can login: Upserts, gets login secret ...`, () => {
    const externalMaja = utils.makeExternalUserFor(maja, {
      ssoId: majasSsoId,
      // These things won't get changed, when logging in via API — because
      // then login might fail, e.g. if email already in use.
      // Better to update things explicitly via /-/v0/upsert-user.
      username: 'different_but_ignored_here',
      fullName: 'Ignored',
      primaryEmailAddress: 'also_ignored@x.co',
    });
    oneTimeLoginSecret = server.apiV0.upsertUserGetLoginSecret({
      origin: site.origin,
      apiRequesterId: c.SysbotUserId,
      apiSecret: apiSecret.secretKey,
      externalUser: externalMaja,
    });
  });

  it(`... gets back a one time login secret`, () => {
    console.log(`Got login secret: ${oneTimeLoginSecret}`);
    assert.ok(oneTimeLoginSecret);
  });

  it(`... logs in with secret`, () => {
    maja_brB.rememberCurrentUrl();
    maja_brB.apiV0.loginWithSecret({
      origin: site.origin,
      oneTimeSecret: oneTimeLoginSecret,
      thenGoTo: '/new',
    });
    maja_brB.waitForNewUrl();
  });



  // ----- Logging in won't change one's email or name

  it(`She still has the new names and email — won't change, when just logging in`, () => {
    maja_brB.topbar.clickGoToProfile();
    maja_brB.userProfilePage.waitUntilUsernameIs('ma_j_a_fu_nny');
    // Max length is 100, see Validation.MaxFullNameLength.
    maja_brB.userProfilePage.assertFullNameIs('Maja 67890' + '1234567890'.repeat(9));

    maja_brB.userProfilePage.preferences.emailsLogins.goHere(maja.username);
    maja_brB.userProfilePage.preferences.emailsLogins.waitUntilEmailAddressListed(
          'e2e_test_maja_email2@x.co');
  });



  // ----- User account still works: Can post topics


  it(`Maja can post topics`, () => {
    maja_brB.go2('/');
    maja_brB.complex.createAndSaveTopic({
          title: "Funny names", body: "Funny names are more funny than not funny " +
              "names, because the funny names are funny." });
  });



  // ----- Notifications get sent to the new email addr


  it(`Memah mentions Maja's old username`, () => {
    memah_brA.complex.createAndSaveTopic({
          title: "Hi old Maja", body: `Hi @${maja.username} old name` });
  });


  it(`... Owen gets notified – he watches the whole site`, () => {
    server.waitUntilLastEmailMatches(
          site.id, owen.emailAddress, `${maja.username} old name`);
    // Maja's + Memah's to Maja = 2.
    assert.eq(server.countLastEmailsSentTo(site.id, owen.emailAddress), 2);
  });


  it(`Memah mentions Maja's new username`, () => {
    memah_brA.go2('/');
    memah_brA.complex.createAndSaveTopic({
          title: "Hi new Maja", body: "Hi @ma_j_a_fu_nny" });
  });


  it(`... Maja gets notified — via the new email addr, about the new username`, () => {
    server.waitUntilLastEmailMatches(
          site.id, 'e2e_test_maja_email2@x.co', 'ma_j_a_fu_nny');
    assert.eq(server.countLastEmailsSentTo(site.id, 'e2e_test_maja_email2@x.co'), 1);
  });


  it(`... Maja's old email addr didn't get any notf email at all`, () => {
    assert.eq(server.countLastEmailsSentTo(site.id, maja.emailAddress), 0);
  });

});


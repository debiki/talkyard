/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';

let allBrowsers: TyAllE2eTestBrowsers;
let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let brC: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let memah: Member;
let memah_brB: TyE2eTestBrowser;
let stranger_brC: TyE2eTestBrowser;
let noEmaIl_brC: TyE2eTestBrowser;
let guest_brC: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoCatsTestForum;  // or TwoPagesTestForum or EmptyTestForum or LargeTestForum
let numEmailsTotal = 0;

const startPagePath = '/start-page';



describe(`login-guest-or-user-without-email.3br.f  TyTLGI_GST_OR_WO_EML`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addCatABForum({
      title: "Some E2E Test",
      members: ['memah', 'maria', 'michael'],
    });

    builder.addPage({
      id: 'startPageId',
      folder: '/',
      showId: false,
      slug: startPagePath.substring(1),
      role: c.TestPageRole.Discussion,
      title: "Start_Page",
      body: "Start page text.",
      categoryId: forum.categories.categoryA.id,
      authorId: forum.members.memah.id,  // _start_page_author
    });

    // Disable notifications, or notf email counts will be off (since Owen would get emails).
    builder.settings({
      numFirstPostsToApprove: 0,
      //maxPostsPendApprBefore: 0,
      numFirstPostsToReview: 0,
    });

    allBrowsers = new TyE2eTestBrowser(allWdioBrowsers, 'brAll');
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');
    brC = new TyE2eTestBrowser(wdioBrowserC, 'brC');

    owen = forum.members.owen;
    owen_brA = brA;

    memah = forum.members.memah;
    memah_brB = brB;

    stranger_brC = brC;
    noEmaIl_brC = brC;
    guest_brC = brC;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = await server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });


  it(`Owen logs in to admin area, ... `, async () => {
    await owen_brA.adminArea.settings.login.goHere(site.origin);
    await owen_brA.loginDialog.loginWithPassword(owen);
  });

  it(`Memah logs in ... `, async () => {
    await memah_brB.go2(site.origin);
    await memah_brB.complex.loginWithPasswordViaTopbar(memah);
  });

  // ----- Guests disabled, by default

  it(`A stranger arrives`, async () => {
    await stranger_brC.go2(site.origin + startPagePath);
  });

  it(`... clicks Join`, async () => {
    await stranger_brC.topbar.clickSignUp();
  });
  it(`... can't join as guest`, async () => {
    assert.not(await stranger_brC.loginDialog.canJoinAs_Real_Guest());
  });

  // ----- Email required

  it(`Types a username and password, but no email addr`, async () => {
    await stranger_brC.loginDialog.fillInUsername('no_ema_il');
    await stranger_brC.loginDialog.fillInPassword("public1234");
  });
  it(`... tries to submit`, async () => {
    await stranger_brC.loginDialog.clickSubmit();
    await stranger_brC.loginDialog.acceptTerms();
  });
  it(`... but there's an error dialog: Email address missing`, async () => {
    await stranger_brC.serverErrorDialog.waitAndAssertTextMatches('EdE1GUR0');
    await stranger_brC.serverErrorDialog.close();
  });

  // ----- Don't require email

  it(`Owen disables Require-verified-email`, async () => {
    await owen_brA.adminArea.settings.login.setRequireVerifiedEmail(false);
    await owen_brA.adminArea.settings.clickSaveAll();
  });

  // ----- Can join w/o email

  it(`Now the stranger, whose name is No-Ema-Il, can sign up w/o email addr`, async () => {
    await stranger_brC.refresh2();
    await stranger_brC.topbar.clickSignUp();
    await stranger_brC.loginDialog.createPasswordAccount({
            username: 'no_ema_il', password: 'public1234', willNeedToVerifyEmail: false });
    await stranger_brC.loginDialog.waitForAndCloseWelcomeLoggedInDialog();
  });
  it(`... it worked`, async () => {
    await noEmaIl_brC.topbar.assertMyUsernameMatches('no_ema_il');
  });

  it(`The no-email user can reply to others`, async () => {
    await noEmaIl_brC.complex.replyToOrigPost("Hi, Try_to_email_me")
    numEmailsTotal += 1;
  });
  it(`... Memah, the _start_page_author, gets notified via email`, async () => {
    await server.waitUntilLastEmailMatches(site.id, memah.emailAddress, "Try_to_email_me");
    assert.eq(await server.countLastEmailsSentTo(site.id, memah.emailAddress), 1);
  });
  it(`Memah replies to No-Ema-Il's reply`, async () => {
    await memah_brB.go2(startPagePath);
  });
  it(`... sees No-Ema-Il's reply`, async () => {
    await memah_brB.topic.waitUntilPostTextMatches(c.FirstReplyNr, 'Try_to_email_me');
  });
  it(`... replies`, async () => {
    await memah_brB.complex.replyToPostNr(c.FirstReplyNr, 'Does_this_work');
  });
  // We'll look at this [_Memahs_reply_later].

  it(`No-Ema-Il can post new topics`, async () => {
    await noEmaIl_brC.go2('/');
    await noEmaIl_brC.complex.createAndSaveTopic({
            title: "I_want_emails", body: "Important-Urgent 12 on a scale to 10" });
  });
  it(`... and @mention others`, async () => {
    await noEmaIl_brC.complex.replyToOrigPost("Send_me_emails @memah")
    numEmailsTotal += 1;
  });
  it(`... Memah gets notified via email about the @emtion`, async () => {
    await server.waitUntilLastEmailMatches(site.id, memah.emailAddress, "Send_me_emails");
    assert.eq(await server.countLastEmailsSentTo(site.id, memah.emailAddress), 2);
  });

  it(`No-Ema-Il can send DMs`, async () => {
    await noEmaIl_brC.userProfilePage.openActivityFor(owen);
    await noEmaIl_brC.userProfilePage.clickSendMessage();
    await noEmaIl_brC.editor.editTitle("Send_emails_DM");
    await noEmaIl_brC.editor.editText("Can you DM_me_two_emails");
    await noEmaIl_brC.editor.saveWaitForNewPage();
    await noEmaIl_brC.assertPageTitleMatches("Send_emails_DM");
    numEmailsTotal += 1;
  });

  // This tests notifications to users w/o email, and *also* navigates away from the DM,
  // so Owen's reply won't get auto-marked-as-read just because No-Ema-Il is looking
  // at the page. [_Memahs_reply_later]
  it(`No-Ema-Il sees a notification dot about Memah's reply, opens it`, async () => {
    await noEmaIl_brC.refresh2();  // [NOTFTPCS]
    await noEmaIl_brC.topbar.openLatestNotf();
  });

  it(`... sees Memah's reply`, async () => {
    await noEmaIl_brC.topic.waitUntilPostTextMatches(c.SecondReplyNr, 'Does_this_work');
  });

  let newPostUrl: St;

  it(`... Owen gets notified via email about the DM`, async () => {
    newPostUrl = await server.waitAndGetLastReplyNotfLinkEmailedTo(site.id, owen.emailAddress, {
            textInMessage: "DM_me_two_emails", urlPart: 'https?://[^"]+#post-1' });
  });

  it(`Total emails is correct`, async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(site.id);
    assert.eq(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });

  it(`Owen replies`, async () => {
    await owen_brA.go2(newPostUrl);
    await owen_brA.complex.replyToOrigPost("I, Owen, I_can_and_I_will")
    numEmailsTotal += 0; // no email address (can't notify No-Ema-Il via email)
  });
  it(`... goes to the login settings`, async () => {
    // Now Owen will get email notfs about replies, since he isn't looking at the
    // discussion page any more.  And he'll edit the login settings, below.
    await owen_brA.adminArea.settings.login.goHere();
  });

  it(`No-Ema-Il sees a notification dot, opens the notification`, async () => {
    await noEmaIl_brC.refresh2();  // [NOTFTPCS]
    await noEmaIl_brC.topbar.openLatestNotf();
  });
  it(`... sees Owen's reply`, async () => {
    await noEmaIl_brC.topic.waitUntilPostTextMatches(c.FirstReplyNr, 'I_can_and_I_will');
  });

  it(`No-Ema-Il leaves`, async () => {
    await noEmaIl_brC.topbar.clickLogout();
  });


  // ----- Log in w/o email

  it(`No-Ema-Il can log in via username & password  (email not needed)`, async () => {
    await noEmaIl_brC.complex.loginWithPasswordViaTopbar({
            username: 'no_ema_il', password: 'public1234' });
  });
  it(`... clicks to the Account tab in their user profile`, async () => {
    await noEmaIl_brC.topbar.clickGoToProfile();
    await noEmaIl_brC.userProfilePage.clickGoToPreferences();
    await noEmaIl_brC.userProfilePage.preferences.tabs.switchToAccount();
  });
  it(`... profile page shows "No email address"  TyTLGI_USR_0EM`, async () => {
    await noEmaIl_brC.userProfilePage.preferences.emailsLogins.waitUntilNoEmailAdr();
  });
  it(`... login method Password`, async () => {
    await noEmaIl_brC.userProfilePage.preferences.emailsLogins.waitAndAssertLoginMethod({
          password: true, username: 'no_ema_il', emailAddr: undefined });
  });

  it(`... returns to Owen's reply`, async () => {
    await noEmaIl_brC.go2(newPostUrl);
  });

  it(`... replies Bye`, async () => {
    await noEmaIl_brC.complex.replyToPostNr(c.FirstReplyNr, `Great, _I_say_Bye`);
    numEmailsTotal += 1;  // Owen notified
  });

  it(`Owen gets notified via email about the reply`, async () => {
    await server.waitUntilLastEmailMatches(site.id, owen.emailAddress, "_I_say_Bye");
  });

  it(`No-Ema-Il leaves for real`, async () => {
    await noEmaIl_brC.topbar.clickLogout();
  });


  // ----- Enables guests

  it(`A stranger still can't join as guest`, async () => {
    await stranger_brC.go2('/');
    await stranger_brC.topbar.clickSignUp();
    assert.not(await stranger_brC.loginDialog.canJoinAs_Real_Guest());
  });

  it(`Owen enables guests`, async () => {
    await owen_brA.adminArea.settings.login.goHere();
    await owen_brA.adminArea.settings.login.setAllowGuestLogin(true);
    await owen_brA.adminArea.settings.clickSaveAll();
  });

  // ----- Click back and forth

  it(`Now the stranger can join as guest`, async () => {
    await stranger_brC.refresh2();
    await stranger_brC.topbar.clickSignUp();
    assert.that(await stranger_brC.loginDialog.canJoinAs_Real_Guest());  // ttt
  });

  it(`Han clicks hither and thither  TyTSWITCH_LGI_D`, async () => {
    // We'll test all ways to navigate back and forth in the authn dialog:
    // Signup —> login or guest,
    // Login —> signup or guest,
    // Guest —> signup or login:
                                                      // Starts at: signup, then:
    await stranger_brC.loginDialog.switchToJoinAsGuest();        // signup —> guest
    await stranger_brC.pause(300);  // oh well, see below, _stale_elem
    await stranger_brC.loginDialog.switchToLoginIfIsSignup();    // guest —> login
    await stranger_brC.pause(300);
    await stranger_brC.loginDialog.clickCreateAccountInstead();  // login —> signup
    await stranger_brC.pause(300);
    await stranger_brC.loginDialog.switchToLoginIfIsSignup();    // signup —> login
    await stranger_brC.pause(300);
    await stranger_brC.loginDialog.switchToJoinAsGuest();        // login —> guest
    await stranger_brC.pause(900);  // _stale_elem err, without. Why? Oh well
    await stranger_brC.loginDialog.clickCreateAccountInstead();  // guest —> signup
                                                           // signup —> guest below [_signup_2_g]
  });

  // ----- Join as guest

  it(`Han fills in a too short username and password`, async () => {
    await stranger_brC.loginDialog.fillInUsername('x'); // too short
    await stranger_brC.loginDialog.fillInPassword('x'); // too short, too
  });

  it(`... but instead clicks join-as-guest. Username not needed`, async () => {
    await stranger_brC.loginDialog.switchToJoinAsGuest(); // signup —> guest   [_signup_2_g]
    
  });
  it(`... han does join as guest, w/o email  (not stopped by the too short
                     username and pwd, since those don't matter now)`, async () => {
    await guest_brC.loginDialog.signUpLogInAs_Real_Guest('GundeGuest', '');
    await guest_brC.loginDialog.waitForAndCloseWelcomeLoggedInDialog();
  });
  it(`GundeGuest posts a topic, mentions @memah`, async () => {
    await guest_brC.complex.createAndSaveTopic({
            title: "Gunde_says_Hi", body: "Hi @memah GundeGuest_here"
    })
    numEmailsTotal += 2;  // Memah: mentioned,  & Owen: to review
  });

  let reviewUrl = '';

  // Comments by guests always need to be reviewed, currently, also with numFirstPostsToReview
  // set to 0 above. Maybe, nowadays, an AI could do that instead?
  it(`... Owen gets notified about a new post to review`, async () => {
    reviewUrl = await server.waitAndGetLastReplyNotfLinkEmailedTo(site.id, owen.emailAddress, {
            textInMessage: "new topic for you to review", urlPart: 'https?://[^"]+#post-1' });
  });

  it(`... Memah gets notified via email about the @mention`, async () => {
    newPostUrl = await server.waitAndGetLastReplyNotfLinkEmailedTo(site.id, memah.emailAddress, {
            textInMessage: "GundeGuest_here", urlPart: 'https?://[^"]+#post-1' });
  });
  it(`... the same link as Owen got to review`, async () => {
    assert.eq(reviewUrl, newPostUrl);
  });

  it(`Total emails is correct`, async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(site.id);
    assert.eq(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });

  it(`Memah replies`, async () => {
    await memah_brB.go2(newPostUrl);
    await memah_brB.complex.replyToOrigPost("Hi_GundeGuest")
  });

  /* But no Approve buttons are shown on posts in need of *review*? Only posts that
  // are hidden until *approved*?  [in_pg_apr]
  // And posts to be *reviewed* instead implicitly get improved if a mod interacts
  // with them,  see maybeReviewAcceptPostByInteracting(),  without deleting.
  // Maybe not the best mechanism? Since even I get confused by this.
  // Better with explicit review? And kbd shortcuts, to make it quick? Instead of
  // implicit & confusion?

  it(`Owen approves GundeGuest's page`, async () => {
    await owen_brA.go2(newPostUrl);
    await owen_brA.topic.approvePostNr(c.BodyNr);
  });

  it(`??? Should GundeGuest see a notf dot or not ???  TyTNOTF_GUEST_DOT`, async () => {
  });
  */

});


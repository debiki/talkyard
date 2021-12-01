/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import * as utils from '../utils/utils';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import settings from '../utils/settings';
import { j2s, logMessage } from '../utils/log-and-die';
import c from '../test-constants';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let memah: Member;
let memah_brB: TyE2eTestBrowser;


let site: IdAddress;
let forum: TwoCatsTestForum;

const owensPageTitle = 'owensPageTitle';
let owensPageUrl: St | U;

const memahsReplyToOwen = 'memahsReplyToOwen';


describe(`cannot-reply-via-email.2br  TyTE0REVIAEML`, () => {

  if (settings.prod) {
    console.log("Skipping this spec — needs talkyard.emailWebhooksApiSecret=..."); // E2EBUG
    return;
  }

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "Some E2E Test",
      members: ['owen', 'memah', 'maria'],
    });

    // Enable API — currently app server conf val instead.
    //builder.settings({ enableApi: true });

    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    // So Owen won't get any approve-post email, instead, a reply notf directly.
    builder.settings({
      numFirstPostsToApprove: 0,
      numFirstPostsToReview: 0,
    });

    owen = forum.members.owen;
    owen_brA = brA;

    memah = forum.members.memah;
    memah_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });


  it(`Owen logs in`, async () => {
    await owen_brA.go2(site.origin);
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
  });

  it(`... mentions Memah`, async () => {
    await owen_brA.complex.createAndSaveTopic({
            title: owensPageTitle, body: "Hi @memah" });
    owensPageUrl = await owen_brA.getUrl();
  });


  let replyNotfEmailToMemah: EmailSubjectBody | U;
  let replyUrlInNotfEmail: St | U;

  it(`Memah gets a reply notification email`, async () => {
    replyNotfEmailToMemah = await server.getLastEmailSenTo(site.id, memah.emailAddress);
    replyUrlInNotfEmail = utils.findFirstLinkToUrlIn(
          site.origin, replyNotfEmailToMemah.bodyHtmlText);
  });

  it(`But Memah replies via email instead`, async () => {
    await server.sendIncomingEmailWebhook({
            to: replyNotfEmailToMemah.from,
            body: "Hi_first_reply_via_email so convenient",
            format: 'Postmarkapp' });
  });
  it(`... and again`, async () => {
    await server.sendIncomingEmailWebhook({
            to: replyNotfEmailToMemah.from,
            body: "Hi_2nd_reply_via_email, so much there is to say",
            format: 'Postmarkapp' });
  });
  it(`... a third time, wow! is Memah never done typing?`, async () => {
    await server.sendIncomingEmailWebhook({
            to: replyNotfEmailToMemah.from,
            body: "Hi_3nd_reply_via_email, I forgot",
            format: 'Postmarkapp' });
  });
  it(`... once more, now with the wrong API secret`, async () => {
    await server.sendIncomingEmailWebhook({
            to: replyNotfEmailToMemah.from,
            body: "Hi_4nd_reply_via_email, Thanks for all the fish",
            format: 'Postmarkapp',
            wrongApiSecret: true });
  });


  let cannotReplyEmailToMemah: EmailSubjectBody | U;
  let replyUrlInCannotReplyEmail: St | U;

  it(`Memah gets an email that says she cannot reply via email`, async () => {
    const result = await server.waitUntilLastEmailMatches(
            site.id, memah.emailAddress, 'e_CantReViaEmail');
    cannotReplyEmailToMemah = result.matchedEmail;
    replyUrlInCannotReplyEmail = utils.findFirstLinkToUrlIn(
            site.origin, cannotReplyEmailToMemah.bodyHtmlText);
  });


  it(`... she replies to that email`, async () => {
    await server.sendIncomingEmailWebhook({
            to: cannotReplyEmailToMemah.from, body: "But_I_can!",
            format: 'Postmarkapp' });
  });


  it(`In the cannot-reply-via-email email, there's a reply link,
            it's the same as in the original reply notif email`, async () => {
    logMessage(`replyUrlInCannotReplyEmail: ${replyUrlInCannotReplyEmail}`);
    assert.eq(replyUrlInCannotReplyEmail, replyUrlInNotfEmail);
  });
  it(`... namely to Owen's page, the Original Post`, async () => {
    const urlToOrigPost = utils.replaceSlugWithPostNr(owensPageUrl, c.BodyNr);
    assert.eq(urlToOrigPost, replyUrlInCannotReplyEmail);
  });


  it(`Memah follows the reply link in the email`, async () => {
    memah_brB.go2(replyUrlInCannotReplyEmail);
  });
  it(`... arrives at Owen's page in the forum`, async () => {
    memah_brB.assertPageTitleMatches(owensPageTitle)
  });


  let replyNotfEmailToOwen: EmailSubjectBody | U;
  let replyAddrToOwenNoHash: St | U;
  let replyNotfEmailIdToOwen: St | U;

  it(`Memah logs in`, async () => {
    await memah_brB.complex.loginWithPasswordViaTopbar(memah);
  });
  it(`... and replies to Owen`, async () => {
    await memah_brB.complex.replyToOrigPost(memahsReplyToOwen);
  });
  it(`... Owen gets a reply notification`, async () => {
    replyNotfEmailToOwen = await server.getLastEmailSenTo(site.id, owen.emailAddress);
    const body = replyNotfEmailToOwen.bodyHtmlText;
    assert.includes(body, memahsReplyToOwen);
    // Find the email id:
    const matches = body.match(/Ty_email_id=([\w-]+)/)
    assert.ok(matches && matches.length === 2,
          `Email body doesn't include Ty_email_id=... ?\nMatches: ${j2s(matches)
          }\nThe email: --------\n${
          body
          }\n-------------------\n`)
    replyNotfEmailIdToOwen = matches[1];
  });


  it(`Owen oddly enough removes the +EMAIL_ID from the From address`, async () => {
    // The email id is after a '+' and up to the '@'.
    replyAddrToOwenNoHash = replyNotfEmailToOwen.from.replace(/\+[\w-]+@/, '@');
    logMessage(`From addr with site-email-id hash: ${replyNotfEmailToOwen.from
          }, w/o: ${replyAddrToOwenNoHash}`);
  });
  it(`... then replies to that site-email-id hash-less address`, async () => {
    await server.sendIncomingEmailWebhook({
            to: replyAddrToOwenNoHash,
            toAddrHasNeeded: false,
            body: `Hello, hi there hello. End goodbye the end. Bye
                <blockquote>
                  Ty_email_id=${replyNotfEmailIdToOwen}
                </blockquote>`,
            format: 'Postmarkapp' });
  });
  it(`... Owen gets a cannot-reply-via-email email, although no site-email-id
          in the address he emailed
          — there's a site-email-id in the email body, that's enough`, async () => {
    await server.waitUntilLastEmailMatches(
            site.id, owen.emailAddress, 'e_CantReViaEmail');
  });


  it(`Memah didn't get any more emails
        — max one cannot-reply email is sent, per outgoing email`, async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(site.id);
    // First a reply notf email to Memah,
    // then a cannot-reply-via-email email to Memah,
    // then a reply notf email to Owen,
    // and a cannot-reply-via-email email to Owen  =  4
    assert.eq(num, 4, `Emails sent to: ${addrsByTimeAsc}`);
  });

});


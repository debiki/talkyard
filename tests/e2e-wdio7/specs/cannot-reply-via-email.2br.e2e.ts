/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import * as utils from '../utils/utils';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/pages-for';
import settings from '../utils/settings';
import { logMessage } from '../utils/log-and-die';
import c from '../test-constants';

let allBrowsers: TyAllE2eTestBrowsers;
let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let maria: Member;
let maria_brB: TyE2eTestBrowser;
let memah: Member;
let memah_brB: TyE2eTestBrowser;


let site: IdAddress;
let forum: TwoCatsTestForum;

const owensPageTitle = 'owensPageTitle';
let owensPageUrl: St | U;

const memahsReplyToOwen = 'memahsReplyToOwen';


describe(`cannot-reply-via-email.2br  TyTE0REVIAEML`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "Some E2E Test",
      members: ['owen', 'memah'],
    });

    // Enable API — currently app server conf val instead.
    //builder.settings({ enableApi: true });

    allBrowsers = new TyE2eTestBrowser(allWdioBrowsers, 'brAll');
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


  it(`Memah logs in`, async () => {
    await memah_brB.complex.loginWithPasswordViaTopbar(memah);
  });
  it(`... and replies to Owen`, async () => {
    await memah_brB.complex.replyToOrigPost(memahsReplyToOwen);
  });
  it(`... Owen gets a reply notification`, async () => {
    const email = await server.getLastEmailSenTo(site.id, owen.emailAddress);
    assert.includes(email.bodyHtmlText, memahsReplyToOwen);
  });


  it(`Memah didn't get any more emails
        — max one cannot-reply email is sent, per outgoing email`, async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(site.id);
    // First a reply notf email to Memah,
    // then a cannot-reply email to Memah,
    // then a reply notf email to Owen  =  3
    assert.eq(num, 3, `Emails sent to: ${addrsByTimeAsc}`);
  });

});



import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import make = require('../utils/make');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');


const everyoneGroup: GroupInclDetails = {
  id: c.EveryoneId,
  createdAtMs: c.MinUnixMillis,
  isGroup: true,
  username: 'everyone',
  fullName: 'Everyone',
  summaryEmailIntervalMins: 60 * 24,
  summaryEmailIfActive: true,
};

let everyonesBrowsers;
let owen;
let owensBrowser: TyE2eTestBrowser;
let trillian;
let trilliansBrowser: TyE2eTestBrowser;
let modya;
let modyasBrowser: TyE2eTestBrowser;
let mons;
let monsBrowser: TyE2eTestBrowser;
let maria;
let mariasBrowser: TyE2eTestBrowser;
let michael;
let michaelsBrowser: TyE2eTestBrowser;

let idAddress: IdAddress;
let siteId: any;

const forumTitle = "Summary Emails Forum";
const topicOneEveryone = "topicOneEveryone";
let topicOneEveryoneUrl: string;

const topicTwoToSome = "topicTwoToSome";
let topicTwoToSomeUrl: string;

const topicThreeToOwen = "topicThreeToOwen";
let topicThreeToOwenUrl: string;

const topicFourToMaria = "topicFourToMaria";
let topicFourToMariaUrl: string;

const topicFiveMariaMonth = "topicFiveMariaAfterOneMonth";
let topicFiveMariaMonthUrl: string;

const lastTopicMichael = "lastTopicMichael";
let lastTopicMichaelUrl: string;

const waitForActSumEmail = server.waitUntilLastEmailIsActSumAndMatches;



describe("summary-emails.2br.mtime  TyTE2E06AJG256", () => {

  it("initialize people", () => {
    everyonesBrowsers = new TyE2eTestBrowser(wdioBrowser);

    trilliansBrowser = new TyE2eTestBrowser(wdioBrowserA);

    owensBrowser = new TyE2eTestBrowser(wdioBrowserB);
    modyasBrowser = owensBrowser;
    monsBrowser = owensBrowser;
    mariasBrowser = owensBrowser;
    michaelsBrowser = owensBrowser;

    owen = make.memberOwenOwner();
    modya = make.memberModeratorModya();
    mons = make.memberModeratorMons();
    maria = make.memberMaria();
    michael = make.memberMichael();
    trillian = make.memberTrillian();
  });

  it("import a site", () => {
    const site: SiteData2 = make.forumOwnedByOwen('sumariz', { title: forumTitle });
    site.groups.push(everyoneGroup);
    site.members.push(modya);
    site.members.push(mons);
    site.members.push(maria);
    // But skip Michael — he'll sign up and create an account, so can verify default settings = ok.
    site.members.push(trillian);

    // Disable notifications, or notf email counts will be off
    // (since Owen would get emails).
    site.settings.numFirstPostsToApprove = 0;
    site.settings.numFirstPostsToReview = 0;

    idAddress = server.importSiteData(site);
    siteId = idAddress.id;
  });

  it("Michael signs up, inherits settings from the Everyone group", () => {
    michaelsBrowser.go(idAddress.origin);
    michaelsBrowser.disableRateLimits();
    michaelsBrowser.complex.signUpAsMemberViaTopbar(michael);
  });

  it("Trillian logs in", () => {
    trilliansBrowser.go2(idAddress.origin);
    trilliansBrowser.disableRateLimits();
    trilliansBrowser.assertPageTitleMatches(forumTitle);
    trilliansBrowser.complex.loginWithPasswordViaTopbar(trillian);
  });

  it("... and posts a topic", () => {
    trilliansBrowser.complex.createAndSaveTopic({ title: topicOneEveryone, body: topicOneEveryone });
    topicOneEveryoneUrl = trilliansBrowser.getUrl();
  });

  it("a day elapses", () => {
    server.playTimeHours(24 + 1);
  });

  it("everyone gets a summary email, except for Michael (email not verified)", () => {
    waitForActSumEmail(siteId, owen.emailAddress, topicOneEveryoneUrl);
    waitForActSumEmail(siteId, modya.emailAddress, topicOneEveryoneUrl);
    waitForActSumEmail(siteId, mons.emailAddress, topicOneEveryoneUrl);
    waitForActSumEmail(siteId, maria.emailAddress, topicOneEveryoneUrl);
  });

  it("Michael gets an addr verif email, clicks the verif link", () => {
    const url = server.getLastVerifyEmailAddressLinkEmailedTo(siteId, michael.emailAddress);
    michaelsBrowser.go(url);
    michaelsBrowser.waitAndClick('.btn'); // click Continue
  });

  it("Now Michael gets the activity summary email", () => {
    server.playTimeHours(24 + 1);
    server.waitUntilLastEmailMatches(siteId, michael.emailAddress, topicOneEveryoneUrl);
  });

  it("Michael logs out", () => {
    michaelsBrowser.topbar.clickLogout();
  });

  it("Modya disables summary emails", () => {
    modyasBrowser.complex.loginWithPasswordViaTopbar(modya.username, modya.password);
    modyasBrowser.userProfilePage.openPreferencesFor(modya.username);
    modyasBrowser.userProfilePage.preferences.setSummaryEmailsEnabled(false);
    modyasBrowser.userProfilePage.preferences.save();
    modyasBrowser.topbar.clickLogout();
  });

  it("Maria disables summary emails", () => {
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria.username, maria.password);
    mariasBrowser.userProfilePage.openPreferencesFor(maria.username);
    mariasBrowser.userProfilePage.preferences.setSummaryEmailsEnabled(false);
    mariasBrowser.userProfilePage.preferences.save();
    mariasBrowser.topbar.clickLogout();
  });

  it("Trillian posts 'topicTwoToSome'", () => {
    trilliansBrowser.go(idAddress.origin);
    trilliansBrowser.complex.createAndSaveTopic({ title: topicTwoToSome, body: topicTwoToSome });
    topicTwoToSomeUrl = trilliansBrowser.getUrl();
  });

  it("... after a day, only Owen, Mons and Michael get a summary email with the new topic", () => {
    server.playTimeHours(24 + 1);
    waitForActSumEmail(siteId, owen.emailAddress, topicTwoToSomeUrl);
    waitForActSumEmail(siteId, mons.emailAddress, topicTwoToSomeUrl);
    waitForActSumEmail(siteId, michael.emailAddress, topicTwoToSomeUrl);
  });

  it("... Modya and Maria didn't get a new summary email", () => {
    // Still topic one:
    // Quick fail fast but-only-probably-works test:
    assertLastEmailDoesNotMatch(modya.emailAddress, topicTwoToSomeUrl);
    assertLastEmailDoesNotMatch(maria.emailAddress, topicTwoToSomeUrl);
    // Slow & safe test:
    waitForActSumEmail(siteId, modya.emailAddress, topicOneEveryoneUrl);
    waitForActSumEmail(siteId, maria.emailAddress, topicOneEveryoneUrl);
  });

  function assertLastEmailDoesNotMatch(emailAddress, text) {
    assert(!server.lastEmailMatches(siteId, emailAddress, text),
      `Email address ${emailAddress} got email about: ${topicTwoToSomeUrl}`);
  }

  it("Owen disables summary emails for the Everyone group", () => {
    owensBrowser.complex.loginWithPasswordViaTopbar(owen.username, owen.password);
    owensBrowser.userProfilePage.openPreferencesFor(everyoneGroup.username);
    owensBrowser.userProfilePage.preferences.setSummaryEmailsEnabled(false);
    owensBrowser.userProfilePage.preferences.save();
  });

  it("... but enables summary emails for himself", () => {
    owensBrowser.userProfilePage.openPreferencesFor(owen.username);
    owensBrowser.userProfilePage.preferences.setSummaryEmailsEnabled(true);
    owensBrowser.userProfilePage.preferences.save();
  });

  it("Trillian posts 'topicThreeToOwen'", () => {
    trilliansBrowser.go(idAddress.origin);
    trilliansBrowser.complex.createAndSaveTopic({ title: topicThreeToOwen, body: topicThreeToOwen });
    topicThreeToOwenUrl = trilliansBrowser.getUrl();
  });

  it("... now Owen gets a summary email", () => {
    server.playTimeDays(7 + 1);
    server.waitUntilLastEmailMatches(siteId, owen.emailAddress, topicThreeToOwenUrl);
  });

  it("... but no one else than Owen", () => {
    // Quick fail-fast but not so accurate tests:
    assertLastEmailDoesNotMatch(modya.emailAddress, topicThreeToOwen);
    assertLastEmailDoesNotMatch(maria.emailAddress, topicThreeToOwen);
    assertLastEmailDoesNotMatch(mons.emailAddress, topicThreeToOwen);
    assertLastEmailDoesNotMatch(michael.emailAddress, topicThreeToOwen);
    // Still topic one:
    waitForActSumEmail(siteId, modya.emailAddress, topicOneEveryoneUrl);
    waitForActSumEmail(siteId, maria.emailAddress, topicOneEveryoneUrl);
    // Still topic two:
    waitForActSumEmail(siteId, mons.emailAddress, topicTwoToSomeUrl);
    waitForActSumEmail(siteId, michael.emailAddress, topicTwoToSomeUrl);
  });

  it("Owen disables summary emails (testing that toggling on/off works)", () => {
    owensBrowser.userProfilePage.preferences.setSummaryEmailsEnabled(false);
    owensBrowser.userProfilePage.preferences.save();
  });

  it("... but Maria enables", () => {
    owensBrowser.topbar.clickLogout();
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria.username, maria.password);
    mariasBrowser.userProfilePage.openPreferencesFor(maria.username);
    mariasBrowser.userProfilePage.preferences.setSummaryEmailsEnabled(true);
    mariasBrowser.userProfilePage.preferences.save();
  });

  it("Trillian posts 'topicFourToMaria'", () => {
    trilliansBrowser.go(idAddress.origin);
    trilliansBrowser.complex.createAndSaveTopic({ title: topicFourToMaria, body: topicFourToMaria });
    topicFourToMariaUrl = trilliansBrowser.getUrl();
  });

  it("Maria gets a summary email", () => {
    server.playTimeDays(7 + 1);
    waitForActSumEmail(siteId, maria.emailAddress, topicFourToMariaUrl);
  });

  it("... but no one else than Maria", () => {
    // Quick fail-fast but not so accurate tests:
    assertLastEmailDoesNotMatch(modya.emailAddress, topicFourToMariaUrl);
    assertLastEmailDoesNotMatch(mons.emailAddress, topicFourToMariaUrl);
    assertLastEmailDoesNotMatch(michael.emailAddress, topicFourToMariaUrl);
    assertLastEmailDoesNotMatch(owen.emailAddress, topicFourToMariaUrl);
    // Still topic one:
    waitForActSumEmail(siteId, modya.emailAddress, topicOneEveryoneUrl);
    // Still topic two:
    waitForActSumEmail(siteId, mons.emailAddress, topicTwoToSomeUrl);
    waitForActSumEmail(siteId, michael.emailAddress, topicTwoToSomeUrl);
    // Still topic three:
    waitForActSumEmail(siteId, owen.emailAddress, topicThreeToOwenUrl);
  });

  it("Maria clicks Unsubscribe and changes summary email interval to one month", () => {
    const emailMatchResult: EmailMatchResult = server.waitUntilLastEmailMatches(
      siteId, maria.emailAddress, 'https?://[^/"]+/-/unsub-from-summaries[^"]*');
    const unsubUrl = emailMatchResult.matchingString;
    mariasBrowser.go(unsubUrl);
    mariasBrowser.waitAndClick('input[value="Monthly"]');
    mariasBrowser.waitAndClick('.s_UnsubSum_SubmB');
  });

  it("Trillian attempts to posts 'topicFiveMariaMonth'", () => {
    trilliansBrowser.go(idAddress.origin);
    // The xsrf token has expired (we've fast-forwarded time too much), so get a new one.
    trilliansBrowser.deleteCookie('XSRF-TOKEN');  // ... or, see below (7KRT24)
    trilliansBrowser.refresh();
    trilliansBrowser.complex.createAndSaveTopic(
        { title: topicFiveMariaMonth, body: topicFiveMariaMonth }); //, resultInError: true });

    /* something doesn't work here, when closing the editor.
        So just refresh instead, see above (7KRT24).
  });

  it("... but there's an xsrf token expired error (because we've fast-forwarded time a lot)", () => {
    trilliansBrowser.serverErrorDialog.waitForXsrfTokenExpiredError();
  });

  it("... she closes the error dialog", () => {
    trilliansBrowser.serverErrorDialog.close();
  });

  it("... and the editor", () => {
    trilliansBrowser.editor.closeIfOpen();
  });

  it("... she got a new xsrf token, and can now post 'topicFiveMariaMonth'", () => {
    trilliansBrowser.complex.createAndSaveTopic(
        { title: topicFiveMariaMonth, body: topicFiveMariaMonth });
   */

    topicFiveMariaMonthUrl = trilliansBrowser.getUrl();
  });

  it("... two weeks elapses, no one gets any summary email", () => {
    server.playTimeDays(14 + 1);
    // Still topic one:
    waitForActSumEmail(siteId, modya.emailAddress, topicOneEveryoneUrl);
    // Still topic two:
    waitForActSumEmail(siteId, mons.emailAddress, topicTwoToSomeUrl);
    waitForActSumEmail(siteId, michael.emailAddress, topicTwoToSomeUrl);
    // Still topic three:
    waitForActSumEmail(siteId, owen.emailAddress, topicThreeToOwenUrl);
    // Still topic four: (not five)
    waitForActSumEmail(siteId, maria.emailAddress, topicFourToMariaUrl);
  });

  it("... a month elapses, Maria gets a summary email", () => {
    server.playTimeDays(31 + 1 - 14 - 1);
    waitForActSumEmail(siteId, maria.emailAddress, topicFiveMariaMonthUrl);
  });

  it("Maria totally unsubscribes: goes to the unsub page", () => {
    const emailMatchResult: EmailMatchResult = server.waitUntilLastEmailMatches(
        siteId, maria.emailAddress, 'https?://[^/"]+/-/unsub-from-summaries[^"]*');
    const unsubUrl = emailMatchResult.matchingString;
    mariasBrowser.go(unsubUrl);
  });

  it("... clicks the unsub button", () => {
    mariasBrowser.waitAndClick('.s_UnsubSum_SubmB');
  });

  it("... returns to the homepage", () => {
    mariasBrowser.waitAndClick('a');  // a Done link, to the homepage
  });

  it("... and logs out", () => {
    // The xsrf token has expired (we've fast-forwarded time too much), so get a new one.
    mariasBrowser.deleteCookie('XSRF-TOKEN');
    mariasBrowser.refresh();
    mariasBrowser.topbar.clickLogout();
  });

  // Do activate someone, so we can wait for an email to be sent to that person,
  // before checking that Maria did *not* get any email.
  it("... but Michael activates again", () => {
    michaelsBrowser.complex.loginWithPasswordViaTopbar(michael.username, michael.password);
    michaelsBrowser.userProfilePage.openPreferencesFor(michael.username);
    michaelsBrowser.userProfilePage.preferences.setSummaryEmailsEnabled(true);
    michaelsBrowser.userProfilePage.preferences.save();
  });

  it("Trillian posts 'lastTopicMichael'", () => {
    trilliansBrowser.go(idAddress.origin);
    trilliansBrowser.complex.createAndSaveTopic({
          title: lastTopicMichael, body: lastTopicMichael });
    lastTopicMichaelUrl = trilliansBrowser.getUrl();
  });

  it("... a week elapses, Michael gets a summary email", () => {
    server.playTimeDays(7 + 1);
    waitForActSumEmail(siteId, michael.emailAddress, lastTopicMichaelUrl);
  });

  it("... two months elapses, but no one gets any more summary emails", () => {
    server.playTimeDays(31 + 31 + 1);
    // Also wait for a short while, so the server gets time to send the wrong stuff.
    wdioBrowser.pause(2100);  // COULD do some remote request to the server, and ask, instead.
    // Still topic one:
    waitForActSumEmail(siteId, modya.emailAddress, topicOneEveryoneUrl);
    // Still topic two:
    waitForActSumEmail(siteId, mons.emailAddress, topicTwoToSomeUrl);
    // Still topic three:
    waitForActSumEmail(siteId, owen.emailAddress, topicThreeToOwenUrl);
    // Topic five:
    waitForActSumEmail(siteId, maria.emailAddress, topicFiveMariaMonthUrl);
    // The very last one:
    waitForActSumEmail(siteId, michael.emailAddress, lastTopicMichaelUrl);
  });

});


// This file sends requests to the server we're testing. Doesn't start any server.

/// <reference path="../test-types2.ts"/>

import _ = require('lodash');
import assert = require('assert');
import utils = require('./utils');
import c = require('../test-constants');
import { logMessage, logWarning, die, dieIf } from './log-and-die';

// Didn't find any Typescript defs.
declare function require(path: string): any;
const syncRequest = require('sync-request');

let xsrfTokenAndCookies;

let settings;

function initOrDie(theSettings) {
  settings = theSettings;
  const response = syncRequest('GET', settings.mainSiteOrigin);
  dieIf(response.statusCode !== 200,
      "Error getting xsrf token and cookies from " + settings.mainSiteOrigin + " [EsE2FKE3]",
      showResponse(response));

  let cookieString = '';
  let xsrfToken = '';
  const cookies = response.headers['set-cookie'];
  _.each(cookies, function(cookie) {
    // A Set-Cookie header value looks like so: "name=value; options"
    const nameValueStr = cookie.split(';')[0];
    const nameAndValue = nameValueStr.split('=');
    const name = nameAndValue[0];
    const value = nameAndValue[1];
    cookieString += nameValueStr + '; ';
    if (name == 'XSRF-TOKEN') {
      xsrfToken = value;
    }
  });
  dieIf(!xsrfToken, "Got no xsrf token from " + settings.mainSiteOrigin + " [EsE8GLK2]");
  xsrfTokenAndCookies = [xsrfToken, cookieString];
}


function postOrDie(url, data, opts: { apiUserId?: number, apiSecret?: string,
      retryIfXsrfTokenExpired?: Boolean } = {}): { statusCode: number, headers, bodyJson } {
  dieIf(!settings.e2eTestPassword, "No E2E test password specified [EsE2WKG4]");

  const passwordParam =
      (url.indexOf('?') === -1 ? '?' : '&') + 'e2eTestPassword=' + settings.e2eTestPassword;

  // Authentication headers.
  // Either use Bausic Authentication, if we're doing an API request with an API secret,
  // or include an xsrf cookie if something else.
  const headers = opts.apiUserId
    ? {
        'Authorization': 'Basic ' +
            utils.encodeInBase64(`talkyardId=${opts.apiUserId}:${opts.apiSecret}`)
      }
    : (!xsrfTokenAndCookies ? {} : {
        'X-XSRF-TOKEN': xsrfTokenAndCookies[0],
        'Cookie': xsrfTokenAndCookies[1]
      });

  logMessage(`POST ${url}, headers: ${ JSON.stringify(headers) } ... [TyME2EPOST]`);

  const response = syncRequest('POST', url + passwordParam, { json: data, headers: headers });
  const responseBody = getResponseBodyString(response);

  //console.log('\n\n' + url + '  ——>\n' + responseBody + '\n\n');
  if (response.statusCode !== 200 && responseBody.indexOf('TyEXSRFEXP_') >= 0 &&
      opts.retryIfXsrfTokenExpired !== false) {
    // The xsrf token expires, if we playTime...() too much.
    logMessage("Getting a new xsrf token; the old one has expired ...");
    initOrDie(settings);
    logMessage("... Done getting new xsrf token.");
    return postOrDie(url, data, { ...opts, retryIfXsrfTokenExpired: false });
  }

  dieIf(response.statusCode !== 200, "POST request failed to " + url + " [EsE5GPK02]",
      showResponse(response));

  return {
    statusCode: response.statusCode,
    headers: response.headers,
    bodyJson: function() {
      return JSON.parse(responseBody);
    }
  };
}


function getOrDie(url) {
  dieIf(!settings.e2eTestPassword, "No E2E test password specified [EsE2KU603]");
  logMessage('GET ' + url);

  const passwordParam =
      (url.indexOf('?') === -1 ? '?' : '&') + 'e2eTestPassword=' + settings.e2eTestPassword;

  const headers = !xsrfTokenAndCookies ? {} : {
    'X-XSRF-TOKEN': xsrfTokenAndCookies[0],
    'Cookie': xsrfTokenAndCookies[1]
  };

  const response = syncRequest('GET', url + passwordParam, { headers: headers });

  dieIf(response.statusCode !== 200, "GET request failed to " + url + " [EsE8JYT4]",
      showResponse(response));
  return response;
}


function getResponseBodyString(response): string {
  let bodyString = response.body;
  if (!_.isString(bodyString) && bodyString.toString) {
    bodyString = bodyString.toString('utf8');
  }
  if (!_.isString(bodyString)) {
    bodyString = "(The response body is not a string, and has no toString function. " +
        "Don't know how to show it. [EdE7BXE2I])"
  }
  return bodyString;
}


function showResponse(response) {
  const bodyString = getResponseBodyString(response);
  return (
      "Response status code: " + response.statusCode + " (should have been 200)\n" +
      showResponseBodyJson(bodyString));
}


function showResponseBodyJson(body) {
  let text = body;
  if (!_.isString(text)) text = JSON.stringify(text);
  return (
  "Response body: ———————————————————————————————————————————————————————————————————\n" +
  text +
  "\n——————————————————————————————————————————————————————————————————————————————————\n");
}


function importRealSiteData(siteData: SiteData): IdAddress {
  const url = settings.mainSiteOrigin + '/-/import-site-json';
  const idAddr = postOrDie(url, siteData).bodyJson();
  dieIf(!idAddr.id, "No site id in import-site response [TyE4STJ2]",
      showResponseBodyJson(idAddr));
  return idAddr;
}


function importTestSiteData(siteData: SiteData): IdAddress {
  siteData.meta.nextPageId = 100; // for now
  siteData.meta.version = 1;      // for now
  const deleteOldSite = settings.deleteOldSite ? '?deleteOldSite=true' : '';
  const url = settings.mainSiteOrigin + '/-/import-test-site-json' + deleteOldSite;
  const idAddr = postOrDie(url, siteData).bodyJson();
  dieIf(!idAddr.id, "No site id in import-site response [TyE7UGK2]",
      showResponseBodyJson(idAddr));
  return idAddr;
}


function deleteOldTestSite(localHostname: string) {
  postOrDie(settings.mainSiteOrigin + '/-/delete-test-site', { localHostname });
}


function playTimeSeconds(seconds: number) {
  const url = settings.mainSiteOrigin + '/-/play-time';
  postOrDie(url, { seconds: seconds });
}


function playTimeMinutes(minutes: number) { playTimeSeconds(minutes * 60); }
function playTimeHours(hours: number) { playTimeSeconds(hours * 3600); }
function playTimeDays(days: number) { playTimeSeconds(days * 3600 * 24); }


function getLastEmailSenTo(siteId: SiteId, email: string, browser): EmailSubjectBody | null {
  for (let attemptNr = 1; attemptNr <= settings.waitforTimeout / 500; ++attemptNr) {
    const response = getOrDie(settings.mainSiteOrigin + '/-/last-e2e-test-email?sentTo=' + email +
      '&siteId=' + siteId);
    const lastEmails = JSON.parse(response.body);
    if (lastEmails.length) {
      logMessage(`${email} has gotten ${lastEmails.length} emails:`);
      for (let i = 0; i < lastEmails.length; ++i) {
        const oneLastEmail = lastEmails[i];
        logMessage(`  subject: "${oneLastEmail.subject}" ` + (
            i === lastEmails.length - 1 ? " <— the last one, returning it" : ''));
      }
      const lastEmail = lastEmails[lastEmails.length - 1];
      return lastEmail;
    }
    // Internal functions can pass null, if they pause themselves.
    if (browser) {
      browser.pause(500 - 100); // 100 ms for a request, perhaps?
    }
    else {
      return null;
    }
  }
  die(`Timeout in getLastEmailSenTo, address: ${email} [EdE5JSRWG0]`)
}


/** Doesn't count all emails, only the last 15? so after many emails sent, becomes useless.
 */
function countLastEmailsSentTo(siteId: SiteId, email: string): number {
  const response = getOrDie(settings.mainSiteOrigin + '/-/last-e2e-test-email?sentTo=' + email +
    '&siteId=' + siteId + '&timeoutMs=1000');
  const lastEmails = JSON.parse(response.body);
  dieIf(lastEmails.length >= 14, 'TyE2ABKT0', "Too many emails, e2e test won't work  [R2AB067]");
  return lastEmails.length;
}


/** Counts emails sent, for a test site.
 */
function getEmailsSentToAddrs(siteId: SiteId): { num: number, addrsByTimeAsc: string[] } {
  const response = getOrDie(settings.mainSiteOrigin + `/-/num-e2e-test-emails-sent?siteId=${siteId}`);
  return JSON.parse(response.body);
}


function getLastVerifyEmailAddressLinkEmailedTo(siteId: SiteId, emailAddress: string,
      browser?): string {
  const email = getLastEmailSenTo(siteId, emailAddress, browser);
  return utils.findFirstLinkToUrlIn('https?://.*/-/login-password-confirm-email', email.bodyHtmlText);
}


// Note: for *an additional* email address, not for the initial signup.
function waitAndGetVerifyAnotherEmailAddressLinkEmailedTo(siteId: SiteId, emailAddress: string, browser,
     options?: { isOldAddr: boolean }): string {
  const textToMatch = options && options.isOldAddr
      ? "To verify email"   // [4GKQM2_]
      : "To finish adding"; // [B4FR20L_]
  waitUntilLastEmailMatches(
    siteId, emailAddress, [textToMatch, emailAddress], browser);
  const email = getLastEmailSenTo(siteId, emailAddress, browser);
  return utils.findFirstLinkToUrlIn('https?://[^"\']*/-/confirm-email-address', email.bodyHtmlText);
}


function waitAndGetInviteLinkEmailedTo(siteId: SiteId, emailAddress: string, browser): string {
  const textToMatch = "invites you to join"; // [5FJBAW2_]
  waitUntilLastEmailMatches(siteId, emailAddress, [textToMatch], browser);
  const email = getLastEmailSenTo(siteId, emailAddress, browser);
  return utils.findFirstLinkToUrlIn('https?://[^"\']*/-/accept-invite', email.bodyHtmlText);
}


function waitAndGetThanksForAcceptingInviteEmailResetPasswordLink(siteId, emailAddress, browser) {
  const textToMatch = "thanks for accepting the invitation"; // [5FJB2AZY_]
  waitUntilLastEmailMatches(siteId, emailAddress, [textToMatch], browser);
  const email = getLastEmailSenTo(siteId, emailAddress, browser);
  return utils.findFirstLinkToUrlIn('https?://[^"\']*/-/reset-password', email.bodyHtmlText);
}


function waitForAlreadyHaveAccountEmailGetResetPasswordLink(
      siteId: SiteId, emailAddress: string, browser): string {
  const textToMatch = "you already have such an account"; // [2WABJDD4_]
  waitUntilLastEmailMatches(siteId, emailAddress, [textToMatch], browser);
  const email = getLastEmailSenTo(siteId, emailAddress, browser);
  return utils.findFirstLinkToUrlIn('https?://[^"\']*/-/reset-password', email.bodyHtmlText);
}


function waitAndGetResetPasswordLinkEmailedTo(siteId: SiteId, emailAddress: string, browser): string {
  const textToMatch = 'reset-password';  // in the url
  waitUntilLastEmailMatches(siteId, emailAddress, [textToMatch], browser);
  const email = getLastEmailSenTo(siteId, emailAddress, browser);
  return utils.findFirstLinkToUrlIn('https?://[^"\']*/-/reset-password', email.bodyHtmlText);
}


function waitAndGetOneTimeLoginLinkEmailedTo(siteId: SiteId, emailAddress: string, browser): string {
  const textToMatch = 'login-with-secret';  // in the url
  waitUntilLastEmailMatches(siteId, emailAddress, [textToMatch], browser);
  const email = getLastEmailSenTo(siteId, emailAddress, browser);
  return utils.findFirstLinkToUrlIn('https?://[^"\']+/-/v0/login-with-secret', email.bodyHtmlText);
}


const unsubUrlRegexString = 'https?://[^"\']*/-/unsubscribe';

function getLastUnsubscriptionLinkEmailedTo(siteId: SiteId, emailAddress: string, browser): string {
  const email = getLastEmailSenTo(siteId, emailAddress, browser);
  return utils.findFirstLinkToUrlIn(unsubUrlRegexString, email.bodyHtmlText);
}


function getAnyUnsubscriptionLinkEmailedTo(siteId: SiteId, emailAddress: string, browser?): string {
  const email = getLastEmailSenTo(siteId, emailAddress, browser);
  return utils.findAnyFirstLinkToUrlIn(unsubUrlRegexString, email.bodyHtmlText);
}


function waitForUnsubscriptionLinkEmailedTo(siteId: SiteId, emailAddress: string, browser): string {
  for (let attemptNr = 1; attemptNr <= settings.waitforTimeout / 500; ++attemptNr) {
    const email = getLastEmailSenTo(siteId, emailAddress, null);
    const link = !email ? null : utils.findAnyFirstLinkToUrlIn(unsubUrlRegexString, email.bodyHtmlText);
    if (!link)
      browser.pause(500 - 100); // 100 ms for a request, perhaps?
    else
      return link;
  }
}


function waitUntilLastEmailMatches(siteId: SiteId, emailAddress: string,
        textOrTextsToMatch: string | string[], browser): string | string[] {
  const textsToMatch: string[] =
      _.isString(textOrTextsToMatch) ? [textOrTextsToMatch] : textOrTextsToMatch;
  const startMs = Date.now();
  let hasDebugLoggedLastEmail = false;
  const regexs = textsToMatch.map(text => new RegExp(utils.regexEscapeSlashes(text)));
  let misses: string[];
  for (let attemptNr = 1; attemptNr <= settings.waitforTimeout / 500; ++attemptNr) {
    const email = getLastEmailSenTo(siteId, emailAddress, null);
    misses = [];
    let matchingStrings: string[] = [];
    for (let i = 0; i < regexs.length; ++i) {
      const regex = regexs[i];
      const matches = !email ? null : email.bodyHtmlText.match(regex);
      if (matches) {
        matchingStrings.push(matches[0]);
      }
      else {
        misses.push(textsToMatch[i]);
      }
    }
    if (!misses.length)
      return _.isString(textOrTextsToMatch) ? matchingStrings[0] : matchingStrings;

    // Debug log last email if after a while there're no matching email.
    const tenSecondsPassed = Date.now() > startMs + 10*1000;
    const testEndsSoon = Date.now() > startMs + settings.waitforTimeout*1000 - 3000;
    if (!hasDebugLoggedLastEmail && (tenSecondsPassed || testEndsSoon)) {
      //hasDebugLoggedLastEmail = true;
      logWarning(
        '\n' +
        "This test will fail? " + (!email ? `No email sent to ${emailAddress}` :
            `Last email to ${emailAddress} is still:\n${email.subject}\n${email.bodyHtmlText}`) +
        '\n');
    }

    browser.pause(500 - 50);
  }
  const missesString = misses.join(', ');
  die(`Never got any email to ${emailAddress} matching ${missesString} [EdE5JGK2Q1]`);
}


function assertLastEmailMatches(siteId: SiteId, emailAddress: string,
      textOrTextsToMatch: string | string[], browser) {
  lastEmailMatches(siteId, emailAddress, textOrTextsToMatch, browser, true);
}


function lastEmailMatches(siteId: SiteId, emailAddress: string,
      textOrTextsToMatch: string | string[], browser, assertMatches?: true): string | false {
  const textsToMatch: string[] =
    _.isString(textOrTextsToMatch) ? [textOrTextsToMatch] : textOrTextsToMatch;
  const regexs = textsToMatch.map(text => new RegExp(utils.regexEscapeSlashes(text)));
  const email = getLastEmailSenTo(siteId, emailAddress, browser);
  for (let i = 0; i < regexs.length; ++i) {
    const regex = regexs[i];
    const matches = email.bodyHtmlText.match(regex);
    if (matches) {
      return matches[0];
    }
  }
  if (assertMatches) {
    assert(false, `Email text didn't match regex(s): '${JSON.stringify(textOrTextsToMatch)}',\n` +
      `email sent to: ${emailAddress},\n` +
      `email title: ${email.subject},\n` +
      `email text: ${email.bodyHtmlText}`);
  }
  return false;
}



// ----- API v0

function upsertUserGetLoginSecret(ps: { origin: string, requesterId: UserId, apiSecret: string,
      externalUser: ExternalUser }): string {
  const url = ps.origin + '/-/v0/sso-upsert-user-generate-login-secret';
  const responseJson = postOrDie(
      url, ps.externalUser, { apiUserId: c.SysbotUserId, apiSecret: ps.apiSecret }).bodyJson();
  dieIf(!responseJson.loginSecret, "No login secret in API response [TyE4AKBA05]",
    showResponseBodyJson(responseJson));
  return responseJson.loginSecret;
}



// ----- Export functions

export = {
  initOrDie,
  importRealSiteData,
  importSiteData: importTestSiteData,
  deleteOldTestSite,
  playTimeSeconds,
  playTimeMinutes,
  playTimeHours,
  playTimeDays,
  getLastEmailSenTo,
  countLastEmailsSentTo,
  getEmailsSentToAddrs,
  getLastVerifyEmailAddressLinkEmailedTo,
  waitAndGetVerifyAnotherEmailAddressLinkEmailedTo,
  waitAndGetInviteLinkEmailedTo,
  waitAndGetThanksForAcceptingInviteEmailResetPasswordLink,
  waitForAlreadyHaveAccountEmailGetResetPasswordLink,
  waitAndGetResetPasswordLinkEmailedTo,
  waitAndGetOneTimeLoginLinkEmailedTo,
  getLastUnsubscriptionLinkEmailedTo,
  getAnyUnsubscriptionLinkEmailedTo,
  waitForUnsubscriptionLinkEmailedTo,
  waitUntilLastEmailMatches,
  lastEmailMatches,
  assertLastEmailMatches,
  apiV0: {
    upsertUserGetLoginSecret,
  },
};


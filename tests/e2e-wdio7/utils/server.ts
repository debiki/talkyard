// This file sends requests to the server we're testing. Doesn't start any server.

/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from './ty-assert';
import * as utils from './utils';
import c from '../test-constants';
import { j2s, boldNormalColor, boldUnusualColor, debugColor,
          logMessage, logWarning, logErrorNoTrace, logServerRequest,
          die, dieIf, logServerResponse, logUnusual,
        } from './log-and-die';

const syncRequest = require('sync-request');

let xsrfTokenAndCookies;

let settings: TestSettings;

/// Exits on failure — otherwise wdio prints a 100+ lines long help text,
/// so people wouldn't see any error messages logged below.
/// (Any e2e tests cannot run anyway, if this won't work.)
///
function initOrExit(theSettings) {
  settings = theSettings;
  let response;
  try {
    response = syncRequest('GET', settings.mainSiteOrigin);
  }
  catch (ex) {
    logErrorNoTrace(`Error talking with:  ${settings.mainSiteOrigin}\n` +
        `Is the server not running?  [TyEE2ESRVOFF]\n\n`, ex);
    process.exit(1);
  }

  if (response.statusCode !== 200) {
    logErrorNoTrace(`Error response from:  ${settings.mainSiteOrigin}  ` +
        `when requesting xsrf token and cookies [TyEE2ESRVSTS]\n`);
    logErrorNoTrace(showResponse(response));
    process.exit(1);
  }

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
    if (name == 'TyCoXsrf' || name == '__Host-TyCoXsrf') {
      xsrfToken = value;
    }
  });

  if (!xsrfToken) {
    logErrorNoTrace(
        `Got no xsrf token from:  ${settings.mainSiteOrigin}   [TyEE2ESRVXSRF]\n` +
        `Cookie headers:\n` +
        `    ${j2s(cookies)}\n`);
    process.exit(1);
  }

  xsrfTokenAndCookies = [xsrfToken, cookieString];
}


export function postOrDie(
      url: St,
      data: Object,
      opts: {
        apiRequesterId?: Nr,
        apiRequester?: St,
        apiSecret?: St,
        retryIfXsrfTokenExpired?: Bo,
        fail?: Bo,
        hintIfErr?: St ,
        cookie?: St | Nl,
        sidHeader?: St,
        xsrfTokenHeader?: St | Nl } = {},
      ): {
        statusCode: Nr,
        headers: { [name: string]: St },
        bodyText: St,
        bodyJson: () => Ay,
      } {

  dieIf(!settings.e2eTestPassword, "No E2E test password specified [EsE2WKG4]");
  dieIf(!!(opts.apiRequester || opts.apiRequesterId) !== !!opts.apiSecret,
        "API user id or secret missing [TyE450KST]");
  dieIf(!!opts.apiRequester && !!opts.apiRequesterId,
        "Both apiRequester and apiRequesterId specified [TyE7M0MEG25R]");

  const passwordParam =
      (url.indexOf('?') === -1 ? '?' : '&') + 'e2eTestPassword=' + settings.e2eTestPassword;

  // Authentication headers.
  // Either use Bausic Authentication, if we're doing an API request with an API secret,
  // or include an xsrf cookie if something else.
  const apiRequester = opts.apiRequester || (
            opts.apiRequesterId ? 'talkyardId=' + opts.apiRequesterId : null);
  const headers = apiRequester
    ? {
        'Authorization': 'Basic ' +
            utils.encodeInBase64(apiRequester + ':' + opts.apiSecret)
      }
    : (!xsrfTokenAndCookies ? {} : {
        'X-XSRF-TOKEN': xsrfTokenAndCookies[0],
        'Cookie': xsrfTokenAndCookies[1]
      });

  if (opts.cookie) {
    headers.Cookie = opts.cookie;
  }
  else if (opts.cookie === null) {
    delete headers.Cookie;
  }

  if (opts.sidHeader) {
    headers['X-Ty-Sid'] = opts.sidHeader;
  }

  if (opts.xsrfTokenHeader) {
    headers['X-XSRF-TOKEN'] = opts.xsrfTokenHeader;
  }
  else if (opts.xsrfTokenHeader === null) {
    delete headers['X-XSRF-TOKEN'];
  }

  logServerRequest(`POST ${url}, headers: ${j2s(headers)} ... [TyME2EPOST]`);

  // Log the request as a copy-pasteable cURL command, so one can re-run this server request
  // manually, for testing & debugging.
  let curlHeadersTexts = []
  _.each(headers, (value, key) => {
    dieIf(value.indexOf("'") >= 0, "Header value contains ' [TyE305KTH3KTS]");
    curlHeadersTexts.push(`-H '${key}: ${value}'`);
  });
  let curlDataText = j2s(data).replace("'", "'\\''");
  if (curlDataText.length > 1500 && settings.logLevel != 'trace') {
    // This is a bit much json, makes the logs annoyingly verbose. So truncate. Won't be
    // copy-pasteable.
    curlDataText = curlDataText.substr(0, 1500) + '\n       ...';
  }
  // It's more nice with the cURL command on a single line — then it can be
  // copy-pasted easily. The many-lines alternative (below) gets broken up
  // by some column-0 prompt Webdriverio adds.
  logServerRequest(`curl -X POST ${url}  -H 'Content-Type: application/json'  ` +
        curlHeadersTexts.join('  ') + ` -d '${curlDataText}'`);
  /*
  logServerRequest(`curl  \\
    -X POST  \\
    -H 'Content-Type: application/json'  \\
    ${curlHeadersTexts.join('  \\\n    ')}  \\
    -d '${curlDataText}'  \\
    ${url}`);
    */

  const response = syncRequest('POST', url + passwordParam, { json: data, headers: headers });
  const responseBody = getResponseBodyString(response);

  //console.log('\n\n' + url + '  ——>\n' + responseBody + '\n\n');
  if (response.statusCode !== 200 && responseBody.indexOf('TyEXSRFEXP_') >= 0 &&
      opts.retryIfXsrfTokenExpired !== false && _.isUndefined(opts.xsrfTokenHeader)) {
    // The xsrf token expires, if we playTime...() too much.
    logMessage("Getting a new xsrf token; the old one has expired ...");

    // If this won't work, the tests won't work anyway, feels ok to exit?
    initOrExit(settings);

    logMessage("... Done getting new xsrf token.");
    return postOrDie(url, data, { ...opts, retryIfXsrfTokenExpired: false });
  }

  if (response.statusCode === 503 && /TyMMAINTWORK/.test(responseBody)) {
    logMessage(debugColor(`The server is in ${boldUnusualColor(` MAINTENANCE MODE `)
        }, you can disable:`) + `

      docker-compose exec rdb psql talkyard talkyard -c "update system_settings_t set maintenance_until_unix_secs_c = null;"

if it causes problems when you're trying to run e2e tests.`);
    // Continue below.
  }

  if (opts.fail) {
    dieIf(200 <= response.statusCode && response.statusCode <= 399,
      "POST request should have gotten back an error code, to " +
          url + " [TyE507KDF2P]", showResponse(response, true));
  }
  else if (response.statusCode !== 200) {
    die(`POST request failed to: ${url}  [TyE2EPOSTREQ]`, showResponse(response),
        opts.hintIfErr);
  }

  return {
    statusCode: response.statusCode,
    headers: response.headers,
    bodyText: responseBody,
    bodyJson: function() {
      let obj;
      try {
        obj = JSON.parse(responseBody);
      }
      catch (ex) {
        die(`Error parsing response json: ${ex.toString()} [TyE204GKRTH4]`,
          "--- The server's response: ------\n" +
          responseBody + '\n' +
          '---------------------------------\n');
      }
      return obj;
    }
  };
}


function getOrDie(url) {
  dieIf(!settings.e2eTestPassword, "No E2E test password specified [EsE2KU603]");
  logServerRequest('GET ' + url);

  const passwordParam =
      (url.indexOf('?') === -1 ? '?' : '&') + 'e2eTestPassword=' + settings.e2eTestPassword;

  const headers = !xsrfTokenAndCookies ? {} : {
    'X-XSRF-TOKEN': xsrfTokenAndCookies[0],
    'Cookie': xsrfTokenAndCookies[1]
  };

  // Later, asyncRequest
  const response = syncRequest('GET', url + passwordParam, { headers: headers });

  dieIf(response.statusCode !== 200, "GET request failed to " + url + " [EsE8JYT4]",
      showResponse(response));
  return response;
}


function getResponseBodyString(response): string {  // dupl [304KWPD50]
  let bodyString = response.body;
  if (!_.isString(bodyString) && bodyString.toString) {
    bodyString = bodyString.toString('utf8');
  }
  if (!_.isString(bodyString)) {
    bodyString = "(The response body is not a string, and has no toString function. " +
        "Don't know how to show it. [EdE7BXE2I])";
  }
  return bodyString;
}


function showResponse(response, shouldHaveFailed?: boolean) {
  const bodyString = getResponseBodyString(response);
  const not = shouldHaveFailed ? " *not*" : '';
  return (
      `Response status code: ${response.statusCode} (should have been ${not} 200)\n` +
      showResponseBodyJson(bodyString));
}


function showResponseBodyJson(body) {
  let text = body;
  if (!_.isString(text)) text = j2s(text);
  return (
  "———— Response body: ——————————————————————————————————————————————————————————————\n" +
  text +
  "\n——————————————————————————————————————————————————————————————————————————————————\n");
}


function createSiteViaPubApi(ps: { data: any,
        wrongApiSecret?: true, apiRequester?: St, apiSecret?: St, origin?: St }): { newSite: { origin: St, id: SiteId }} {
  // See CreateSiteController.apiV0_createSite.
  const url = (ps.origin || settings.mainSiteOrigin) + '/-/v0/create-site';
  const data = {
    ...ps.data,
  };
  const apiRequester = ps.apiRequester || 'createsite';
  const apiSecret = ps.apiSecret || (
          ps.wrongApiSecret ? 'wrongCreateSiteApiSecret' : 'publicCreateSiteApiTestSecret');
  const fail = !!ps.wrongApiSecret;
  const resp = postOrDie(url, data, { apiRequester, apiSecret, fail,
        hintIfErr:
          `You need this in conf/my.conf:\n\n` +
          'talkyard.createSiteApiSecret="publicCreateSiteApiTestSecret"' });
  const respJson = fail ? resp.bodyText : resp.bodyJson();
  logServerResponse(respJson);
  return respJson;
}


function importRealSiteData(siteData: SiteData2): IdAddress {
  // We're importing test data, to a "real" endpoint that works also
  // in Prod mode. [06KWFNDS2]
  const url = settings.mainSiteOrigin + '/-/import-site-json?deleteOldSite=true';
  const idAddr = postOrDie(url, { ...siteData, isTestSiteOkDelete: true }).bodyJson();
  dieIf(!idAddr.id, "No site id in import-site response [TyE4STJ2]",
      showResponseBodyJson(idAddr));
  return idAddr;
}


function importTestSiteData(siteData: SiteData): IdAddress {
  siteData.meta.nextPageId = 100; // for now
  siteData.meta.version = 1;      // for now

  // Maybe remove this param? Now done automatically in most cases [DELTSTHOSTS].
  const deleteOldSite = settings.deleteOldSite ? '?deleteOldSite=true' : '';

  const url = settings.mainSiteOrigin + '/-/import-test-site-json' + deleteOldSite;
  const idAddr = postOrDie(url, { ...siteData, isTestSiteOkDelete: true }).bodyJson();
  dieIf(!idAddr.id, "No site id in import-site response [TyE7UGK2]",
      showResponseBodyJson(idAddr));
  logMessage(boldNormalColor(`Created e2e test site, id ${idAddr.id}.`));
  return idAddr;
}


function deleteOldTestSite(localHostname: string) {
  postOrDie(settings.mainSiteOrigin + '/-/delete-test-site', { localHostname });
}


// DEPRECATED use skipLimits(..) instead?
function skipRateLimits(siteId: SiteId) {
  skipLimits(siteId, { rateLimits: true });
}

function skipLimits(siteId: SiteId, ps: { rateLimits?: Bo, diskQuotaLimits?: Bo }) {
  postOrDie(settings.mainSiteOrigin + '/-/skip-limits', { ...ps, siteId });
}

async function reindexSites(siteIds: SiteId[]) {
  await postOrDie(settings.mainSiteOrigin + '/-/test-reindex-sites',
        { siteIdsToReIx: siteIds });
}

async function pauseJobs(ps: { howManySeconds: Nr }) {
  await postOrDie(settings.mainSiteOrigin + '/-/pause-jobs', ps);
}


function playTimeSeconds(seconds: number) {
  const url = settings.mainSiteOrigin + '/-/play-time';
  postOrDie(url, { seconds: seconds });
}


function playTimeMinutes(minutes: number) { playTimeSeconds(minutes * 60); }
function playTimeHours(hours: number) { playTimeSeconds(hours * 3600); }
function playTimeDays(days: number) { playTimeSeconds(days * 3600 * 24); }


function deleteRedisKey(key: string) {
  postOrDie(settings.mainSiteOrigin + '/-/delete-redis-key', { key });
}


function getTestCounters(): TestCounters {
  const response = getOrDie(settings.mainSiteOrigin + '/-/test-counters');
  return JSON.parse(response.body);
}


function addAdminNotice(ps: { siteId: SiteId, noticeId: Nr }) {
  postOrDie(settings.mainSiteOrigin + '/-/add-admin-notice', ps);
}


async function getLastEmailSenTo(siteId: SiteId, email: St, dontWait?: 'DontWait')
        : Pr<EmailSubjectBody | Nl> {
  if (!email || email.indexOf('@') <= 0 || email.indexOf('@') >= email.length - 2) {
    die(`Not an email address: '${email}'  [TyE4MQEJ9MS2]`);
  }
  for (let attemptNr = 1; attemptNr <= settings.waitforTimeout / 500; ++attemptNr) {
    const response = await getOrDie(settings.mainSiteOrigin + '/-/last-e2e-test-email?sentTo=' + email +
      '&siteId=' + siteId);
    const lastEmails = JSON.parse(response.body).emails;
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
    // Internal functions can specify 'DontWait', if they pause themselves.
    if (dontWait !== 'DontWait') {
      await wdioBrowserA.pause(500 - 100); // 100 ms for a request, perhaps?
    }
    else {
      return null;
    }
  }
  die(`Timeout in getLastEmailSenTo, address: ${email} [EdE5JSRWG0]`)
}


/** Doesn't count all emails, only the last 15? so after many emails sent, becomes useless.
 */
async function countLastEmailsSentTo(siteId: SiteId, email: St): Pr<Nr> {
  const response = await getOrDie(
          settings.mainSiteOrigin + '/-/last-e2e-test-email?sentTo=' + email +
              '&siteId=' + siteId + '&timeoutMs=1000');
  const lastEmails = JSON.parse(response.body).emails;
  dieIf(lastEmails.length >= 14, 'TyE2ABKT0', "Too many emails, e2e test won't work  [R2AB067]");
  return lastEmails.length;
}


/** Counts emails sent, for a test site.
 */
async function getEmailsSentToAddrs(siteId: SiteId): Pr<{ num: Nr, addrsByTimeAsc: St[] }> {
  const response = await getOrDie(settings.mainSiteOrigin + `/-/num-e2e-test-emails-sent?siteId=${siteId}`);
  return JSON.parse(response.body);
}


async function waitAndGetLastReplyNotfLinkEmailedTo(siteId: SiteId, emailAddress: St,
          ps: { textInMessage: St, urlPart: St }): Pr<St> {
  const matchRes = await waitUntilLastEmailMatches(siteId, emailAddress, ps.textInMessage);
  const email = matchRes.matchedEmail;
  dieIf(!email, `No email has been sent to ${emailAddress} with text: "${ps.textInMessage
          }". [TyE2ABKF058]`);
  return utils.findFirstLinkToUrlIn(ps.urlPart, email.bodyHtmlText);
}


async function waitAndGetLastVerifyEmailAddressLinkEmailedTo(siteId: SiteId, emailAddress: St,
      linkAccounts?: 'LINKING_IDP_ACCT'): Pr<St> {
  const email = await getLastEmailSenTo(siteId, emailAddress);
  dieIf(!email, `No email has yet been sent to ${emailAddress}. [TyE2ABKF057]`);
  const regex = (linkAccounts !== 'LINKING_IDP_ACCT'
          ? 'https?://.*/-/login-password-confirm-email'
          : 'https?://.*/-/authn/verif-email-ask-if-link-accounts');
  return utils.findFirstLinkToUrlIn(regex, email.bodyHtmlText);
}


// Note: for *an additional* email address, not for the initial signup.
async function waitAndGetVerifyAnotherEmailAddressLinkEmailedTo(
        siteId: SiteId, emailAddress: St, browser, options?: { isOldAddr: Bo }): Pr<St> {
  die("Remove 'browser' arg [TyE4MREG83R-1]");
  const textToMatch = options && options.isOldAddr
      ? "To verify email"   // [4GKQM2_]
      : "To finish adding"; // [B4FR20L_]
  await waitUntilLastEmailMatches(
          siteId, emailAddress, [textToMatch, emailAddress]);
  const email = await getLastEmailSenTo(siteId, emailAddress);
  return utils.findFirstLinkToUrlIn('https?://[^"\']*/-/confirm-email-address', email.bodyHtmlText);
}


async function waitAndGetInviteLinkEmailedTo(siteId: SiteId, emailAddress: St): Pr<St> {
  const textToMatch = "invites you to join"; // [5FJBAW2_]
  await waitUntilLastEmailMatches(siteId, emailAddress, [textToMatch]);
  const email = await getLastEmailSenTo(siteId, emailAddress);
  return utils.findFirstLinkToUrlIn('https?://[^"\']*/-/accept-invite', email.bodyHtmlText);
}


async function waitAndGetThanksForAcceptingInviteEmailResetPasswordLink(
        siteId: SiteId, emailAddress: St): Pr<St> {
  const textToMatch = "thanks for accepting the invitation"; // [5FJB2AZY_]
  await waitUntilLastEmailMatches(siteId, emailAddress, [textToMatch]);
  const email = await getLastEmailSenTo(siteId, emailAddress);
  return utils.findFirstLinkToUrlIn('https?://[^"\']*/-/reset-password', email.bodyHtmlText);
}


async function waitForAlreadyHaveAccountEmailGetResetPasswordLink(
      siteId: SiteId, emailAddress: St): Pr<St> {
  const textToMatch = "you already have such an account"; // [2WABJDD4_]
  await waitUntilLastEmailMatches(siteId, emailAddress, [textToMatch]);
  const email = await getLastEmailSenTo(siteId, emailAddress);
  return utils.findFirstLinkToUrlIn('https?://[^"\']*/-/reset-password', email.bodyHtmlText);
}


async function waitAndGetResetPasswordLinkEmailedTo(siteId: SiteId, emailAddress: St): Pr<St> {
  const textToMatch = 'reset-password';  // in the url
  await waitUntilLastEmailMatches(siteId, emailAddress, [textToMatch]);
  const email = await getLastEmailSenTo(siteId, emailAddress);
  return utils.findFirstLinkToUrlIn('https?://[^"\']*/-/reset-password', email.bodyHtmlText);
}


async function waitAndGetOneTimeLoginLinkEmailedTo(siteId: SiteId, emailAddress: St)
        : Pr<St> {
  const textToMatch = 'login-with-secret';  // in the url
  await waitUntilLastEmailMatches(siteId, emailAddress, [textToMatch]);
  const email = await getLastEmailSenTo(siteId, emailAddress);
  return utils.findFirstLinkToUrlIn('https?://[^"\']+/-/v0/login-with-secret', email.bodyHtmlText);
}


const unsubUrlRegexString = 'https?://[^"\']*/-/unsubscribe';

async function getLastUnsubscriptionLinkEmailedTo(siteId: SiteId, emailAddress: St): Pr<St> {
  const email = await getLastEmailSenTo(siteId, emailAddress);
  return utils.findFirstLinkToUrlIn(unsubUrlRegexString, email.bodyHtmlText);
}


async function getAnyUnsubscriptionLinkEmailedTo(siteId: SiteId, emailAddress: St): Pr<St> {
  const email = await getLastEmailSenTo(siteId, emailAddress);
  return utils.findAnyFirstLinkToUrlIn(unsubUrlRegexString, email.bodyHtmlText);
}


async function waitForUnsubscriptionLinkEmailedTo(siteId: SiteId, emailAddress: St)
        : Pr<St> {
  for (let attemptNr = 1; attemptNr <= settings.waitforTimeout / 500; ++attemptNr) {
    const email = await getLastEmailSenTo(siteId, emailAddress, 'DontWait');
    const link = !email ? null : utils.findAnyFirstLinkToUrlIn(unsubUrlRegexString, email.bodyHtmlText);
    if (!link)
      await wdioBrowserA.pause(500 - 100); // 100 ms for a request, perhaps?
    else
      return link;
  }
}


async function waitUntilLastEmailIsActSumAndMatches(siteId: SiteId, emailAddress: St,
        textOrTextsToMatch: St | St[]): Pr<EmailMatchResult> {
  return await waitUntilLastEmailMatches(siteId, emailAddress, textOrTextsToMatch,
          { isActivitySummary: true });
}


async function waitUntilLastEmailMatches(siteId: SiteId, emailAddress: St,
        textOrTextsToMatch: (St | RegExp) | (St | RegExp)[],
        opts?: { isActivitySummary?: Bo } | any)
        : Pr<EmailMatchResult> {
  let textsToMatch: (St | RegExp)[] =
      !_.isArray(textOrTextsToMatch) ? [textOrTextsToMatch] : textOrTextsToMatch;
  if (opts?.isActivitySummary) {
    textsToMatch = [...textsToMatch, 'e_ActSumEm'];
  }
  dieIf(!textsToMatch?.map, `No texts to match; textsToMatch is: ${j2s(textsToMatch)}`);
  const startMs = Date.now();
  let hasDebugLoggedLastEmail = false;
  const regexs = textsToMatch.map(text =>
          _.isRegExp(text) ? text : new RegExp(utils.regexEscapeSlashes(text)));
  let misses: string[];
  for (let attemptNr = 1; attemptNr <= settings.waitforTimeout / 500; ++attemptNr) {
    const email: EmailSubjectBody | U =
            await getLastEmailSenTo(siteId, emailAddress, 'DontWait');
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
    if (!misses.length) {
      return {
        matchedEmail: email,
        matchingString: _.isString(textOrTextsToMatch) ? matchingStrings[0] : undefined,
        matchingStrings,
      }
    }

    // Debug log last email if after a while there're no matching email.
    const tenSecondsPassed = Date.now() > startMs + 10*1000;
    const testEndsSoon = Date.now() > startMs + settings.waitforTimeout*1000 - 3000;
    if (!hasDebugLoggedLastEmail && (tenSecondsPassed || testEndsSoon)) {
      //hasDebugLoggedLastEmail = true;
      logWarning(
        `Waiting for email to: ${emailAddress} to match: ${j2s(textsToMatch)} ` +
        (!email ? ` — but no email sent to that address` :
            `\nLast email is:\n${email.subject}\n${email.bodyHtmlText}`) +
        '\n');
    }

    await wdioBrowserA.pause(500 - 50);
  }
  const missesString = misses.join(', ');
  die(`Never got any email to ${emailAddress} matching ${missesString} [EdE5JGK2Q1]`);
}


async function assertLastEmailMatches(siteId: SiteId, emailAddress: string,
      textOrTextsToMatch: string | string[], browser) {
  die("Remove 'browser' arg [TyE4MREG83R-2]");
  await lastEmailMatches(siteId, emailAddress, textOrTextsToMatch, browser, true);
}


async function lastEmailMatches(siteId: SiteId, emailAddress: St,
      textOrTextsToMatch: St | St[], browser?, assertMatches?: true): Pr<St | false> {
  dieIf(browser, "Remove 'browser' arg [TyE4MREG83R-3]");
  const textsToMatch: string[] =
    _.isString(textOrTextsToMatch) ? [textOrTextsToMatch] : textOrTextsToMatch;
  const regexs = textsToMatch.map(text => new RegExp(utils.regexEscapeSlashes(text)));
  const email = await getLastEmailSenTo(siteId, emailAddress);
  for (let i = 0; i < regexs.length; ++i) {
    const regex = regexs[i];
    const matches = email.bodyHtmlText.match(regex);
    if (matches) {
      return matches[0];
    }
  }
  if (assertMatches) {
    assert.fail(`Email text didn't match regex(s): '${j2s(textOrTextsToMatch)}',\n` +
      `email sent to: ${emailAddress},\n` +
      `email title: ${email.subject},\n` +
      `email text: ${email.bodyHtmlText}`);
  }
  return false;
}


async function sendIncomingEmailWebhook(ps: { to: St, toAddrHasNeeded?: Bo,
        body: St, format: 'Postmarkapp',
        origin?: St, apiRequester?: St, apiSecret?: St, wrongApiSecret?: true }) {
  // See EmailsInController.parseIncomingEmail [pars_em_in].
  const url = (ps.origin || settings.mainSiteOrigin) + '/-/handle-email';
  const mailboxHash = getHashOrDie(ps.to, 'TyE70MWEP52', ps.toAddrHasNeeded);
  const data = {
    MessageID: 'MessageID',
    Date: '2021-12-31T23:59:59',
    MailboxHash: mailboxHash,
    To: ps.to,
    From: 'From@ex.co',
    ReplyTo: 'ReplyTo@x.co',
    Subject: 'Subject',
    HtmlBody: ps.body,
    TextBody: ps.body, // whatever
    StrippedTextReply: 'StrippedTextReply',
    Headers: [{ Name: 'HeaderName', Value: 'HeaderValue' }],
  };
  const apiRequester = ps.apiRequester || 'emailwebhooks';
  const apiSecret = ps.apiSecret || (
          ps.wrongApiSecret ? 'wrongApiSecret' : 'publicEmailWebhooksApiTestSecret');
  const fail = !!ps.wrongApiSecret;
  const resp = await postOrDie(url, data, { apiRequester, apiSecret, fail,
        hintIfErr:
          `You need this in conf/my.conf:\n\n` +
          'talkyard.emailWebhooksApiSecret="publicEmailWebhooksApiTestSecret"' });
  // Always sends back text (the callers don't care anyway, they don't know what
  // Talkyard is or does; they just send webhooks.)
  const respTxt = resp.bodyText;
  logServerResponse(respTxt);
  return respTxt;
}



function getHashOrDie(emailAdr: St, errCode: St, toAddrHasNeeded?: Bo): St {
  const matches = emailAdr.match(/^[^@\s+]+\+([^@\s]+)@[^@\s]+$/);
  dieIf(matches?.length !== 2 && toAddrHasNeeded !== false,
        `No hash in email addr: "${emailAdr}" [${errCode}]\n\n` +
        `Edit conf/my.conf and include +EMAIL_ID in the from addr, e.g.:\n` +
        `talkyard.smtp.fromAddress="no-reply+EMAIL_ID@example.com\n`);
  return matches?.[1];
}


// ----- API v0


const isApiErrorResponse = (response: ApiResponse<any>)
    : response is ApiErrorResponse =>
  (response as ApiErrorResponse).error !== undefined;


function fullTextSearch<T extends ThingFound>(ps: {
      origin: St, queryText: St, opts?: {
          cookie?: St | Nl, sidHeader?: St, xsrfTokenHeader?: St | Nl, fail?: true }})
      :  SearchQueryResults<T> | St {
  const url = ps.origin + '/-/v0/search';
  const requestBody: SearchQueryApiRequest = {
    searchQuery: { freetext: ps.queryText },
    pretty: true,
  };

  const responseObj = postOrDie(url, requestBody, ps.opts);

  if (ps.opts?.fail)
    return responseObj.bodyText;

  const responseBody = responseObj.bodyJson() as SearchQueryApiResponse<T>;
  const result = responseObj.statusCode === 200 && !isApiErrorResponse(responseBody)
      ? responseBody
      : die(`POST request failed to ${url} [TyE35RKDH4]`, showResponse(responseObj));

  assert.ok(result.thingsFound);
  assert.ok(_.isArray(result.thingsFound));

  return result;
}


async function getQuery<T extends ThingFound>(
      ps: { origin: St, getQuery: GetPatsQuery },
      postPs: { fail?: Bo, apiRequesterId?: UserId, apiSecret?: St } = {})
      : Pr<GetQueryResults<T> | St> {
  const url = ps.origin + '/-/v0/get';
  const requestBody: GetQueryApiRequest = {
    getQuery: ps.getQuery,
    pretty: true,
  };

  const responseObj = await postOrDie(url, requestBody, postPs);

  if (postPs.fail)
    return responseObj.bodyText;

  const responseBody = responseObj.bodyJson() as GetQueryApiResponse<T>;
  const result = responseObj.statusCode === 200 && !isApiErrorResponse(responseBody)
      ? responseBody
      : die(`POST request failed to ${url} [TyE0WJHLS8M]`, showResponse(responseObj));

  assert.ok(result.thingsOrErrs);
  assert.ok(_.isArray(result.thingsOrErrs));

  return result;
}


function listQuery<T extends ThingFound>(
      ps: { origin: string, listQuery: ListQuery, sortOrder?: PageSortOrder },
      postPs: { fail?: boolean, apiRequesterId?: UserId, apiSecret?: string } = {})
      : ListQueryResults<T> | string {
  const url = ps.origin + '/-/v0/list';
  const requestBody: ListQueryApiRequest = {
    listQuery: ps.listQuery,
    pretty: true,
  };

  const responseObj = postOrDie(url, requestBody, postPs);

  if (postPs.fail)
    return responseObj.bodyText;

  const responseBody = responseObj.bodyJson() as ListQueryApiResponse<T>;
  const result = responseObj.statusCode === 200 && !isApiErrorResponse(responseBody)
      ? responseBody
      : die(`POST request failed to ${url} [TyE0WKHLS6M]`, showResponse(responseObj));

  assert.ok(result.thingsFound);
  assert.ok(_.isArray(result.thingsFound));

  return result;
}


function upsertUserGetLoginSecret(ps: { origin: string, apiRequesterId?: UserId, apiSecret: string,
      externalUser: ExternalUser, fail?: boolean }): string {
  const url = ps.origin + '/-/v0/sso-upsert-user-generate-login-secret';
  const response = postOrDie(
      url, ps.externalUser, {
        fail: ps.fail,
        apiRequesterId: ps.apiRequesterId || c.SysbotUserId,
        apiSecret: ps.apiSecret });

  if (ps.fail)
    return response.bodyText;

  const responseJson = response.bodyJson();
  dieIf(!responseJson.loginSecret, "No login secret in API response [TyE4AKBA05]",
      showResponseBodyJson(responseJson));
  logServerRequest("Now you can try:\n    " +
      ps.origin + '/-/v0/login-with-secret' +
      '?oneTimeSecret=' + responseJson.loginSecret +
      '&thenGoTo=/');
  return responseJson.loginSecret;
}


function upsertUser(ps: { origin: St, apiRequesterId?: UserId, apiSecret: St,
      externalUser: ExternalUser, fail?: Bo }): St {
  const url = ps.origin + '/-/v0/upsert-user';
  const response = postOrDie(url, ps.externalUser, {
    fail: ps.fail,
    apiRequesterId: ps.apiRequesterId || c.SysbotUserId,
    apiSecret: ps.apiSecret,
  });
  return response.bodyText;
}


function upsertSimple(ps: { origin: string, apiRequesterId: UserId, apiSecret: string, fail?: boolean,
      data }): string | any {
  const url = ps.origin + '/-/v0/upsert-simple';
  const response = postOrDie(
      url, ps.data, {
        fail: ps.fail,
        apiRequesterId: ps.apiRequesterId || c.SysbotUserId,
        apiSecret: ps.apiSecret });
  return ps.fail ? response.bodyText : response.bodyJson();
}


function listUsers(ps: { origin: string, usernamePrefix: string }): ListUsersApiResponse {
  const url = ps.origin + '/-/v0/list-users?usernamePrefix=' + ps.usernamePrefix;
  const response = getOrDie(url);
  return JSON.parse(response.body);
}


async function do_(ps: { origin: St, apiRequesterId: UserId, apiSecret: St, fail?: Bo,
      data: DoApiRequest }): Pr<St | Ay> {
  const url = ps.origin + '/-/v0/do';
  const response = postOrDie(
      url, ps.data, {
        fail: ps.fail,
        apiRequesterId: ps.apiRequesterId || c.SysbotUserId,
        apiSecret: ps.apiSecret });
  return ps.fail ? response.bodyText : response.bodyJson();
}


function planMaintenance(ps: { origin: St, basicAuthUsername: St, apiSecret: St, fail?: Bo,
      data: { maintenanceUntilUnixSecs?: Nr, maintWordsHtml?: St, maintMessageHtml?: St }}): St {
  // See SuperAdminController.apiV0_planMaintenance().
  const url = ps.origin + '/-/v0/plan-maintenance';
  const response = postOrDie(
      url, ps.data, {
        fail: ps.fail,
        apiRequester: ps.basicAuthUsername,
        apiSecret: ps.apiSecret });
  return response.bodyText;
}



// ----- Export functions

export default {
  initOrExit: initOrExit,
  importRealSiteData,
  importSiteData: importTestSiteData,
  deleteOldTestSite,
  skipRateLimits,
  skipLimits,
  reindexSites,
  pauseJobs,
  playTimeSeconds,
  playTimeMinutes,
  playTimeHours,
  playTimeDays,
  deleteRedisKey,
  getTestCounters,
  addAdminNotice,
  getLastEmailSenTo,  // RENAME waitGetLastEmailsSentTo
  countLastEmailsSentTo,
  getEmailsSentToAddrs,
  sendIncomingEmailWebhook,
  waitAndGetLastReplyNotfLinkEmailedTo,
  waitAndGetLastVerifyEmailAddressLinkEmailedTo,  // was: getLastVerifyEmailAddressLinkEmailedTo
  // no, worse name:
  // getVerifyEmailAddressLinkFromLastEmailTo: waitAndGetLastVerifyEmailAddressLinkEmailedTo,
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
  waitUntilLastEmailIsActSumAndMatches,
  lastEmailMatches,
  assertLastEmailMatches,
  apiV0: {
    createSite: createSiteViaPubApi,
    fullTextSearch,
    getQuery,
    listQuery,
    do_,
    upsertUser,
    upsertUserGetLoginSecret,
    upsertSimple,
    listUsers,
    planMaintenance,
  },
};


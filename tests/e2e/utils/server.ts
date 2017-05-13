// This file sends requests to the server we're testing. Doesn't start any server.

/// <reference path="../test-types.ts"/>

import _ = require('lodash');
import assert = require('assert');
import settings = require('./settings');
import utils = require('./utils');
import { logMessage, die, dieIf } from './log-and-die';

// Didn't find any Typescript defs.
declare function require(path: string): any;
const syncRequest = require('sync-request');

let xsrfTokenAndCookies;


function initOrDie() {
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


function postOrDie(url, data) {
  dieIf(!settings.e2eTestPassword, "No E2E test password specified [EsE2WKG4]");
  logMessage('POST ' + url + ' ...  [EsM5JMMK2]');

  const passwordParam =
      (url.indexOf('?') === -1 ? '?' : '&') + 'e2eTestPassword=' + settings.e2eTestPassword;

  const headers = !xsrfTokenAndCookies ? {} : {
    'X-XSRF-TOKEN': xsrfTokenAndCookies[0],
    'Cookie': xsrfTokenAndCookies[1]
  };

  const response = syncRequest('POST', url + passwordParam, { json: data, headers: headers });

  dieIf(response.statusCode !== 200, "POST request failed to " + url + " [EsE5GPK02]",
      showResponse(response));
  return {
    statusCode: response.statusCode,
    headers: response.headers,
    bodyJson: function() {
      return JSON.parse(response.getBody('utf8'));
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


function showResponse(response) {
  let bodyString = response.body;
  if (!_.isString(bodyString) && bodyString.toString) {
    bodyString = bodyString.toString('utf8');
  }
  if (!_.isString(bodyString)) {
    bodyString = "(The response body is not a string, and has no toString function. " +
        "Don't know how to show it. [EdE7BXE2I])"
  }
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


function importSiteData(siteData: SiteData): IdAddress {
  const deleteOldSite = settings.deleteOldSite ? '?deleteOldSite=true' : '';
  const url = settings.mainSiteOrigin + '/-/import-test-site' + deleteOldSite;
  const ids = postOrDie(url, siteData).bodyJson();
  dieIf(!ids.id, "No site id in import-site response [EsE7UGK2]",
      showResponseBodyJson(ids));
  return ids;
}


function getLastEmailSenTo(siteId: SiteId, email: string): EmailSubjectBody {
  const response = getOrDie(settings.mainSiteOrigin + '/-/last-e2e-test-email?sentTo=' + email +
    '&siteId=' + siteId);
  const lastEmails = JSON.parse(response.body);
  return lastEmails[lastEmails.length - 1];
}


function getLastVerifyEmailAddressLinkEmailedTo(siteId: SiteId, emailAddress: string): string {
  const email = getLastEmailSenTo(siteId, emailAddress);
  return utils.findFirstLinkToUrlIn('https?://.*/-/login-password-confirm-email', email.bodyHtmlText);
}


const unsubUrlRegexString = 'https?://.*/-/unsubscribe';

function getLastUnsubscriptionLinkEmailedTo(siteId: SiteId, emailAddress: string): string {
  const email = getLastEmailSenTo(siteId, emailAddress);
  return utils.findFirstLinkToUrlIn(unsubUrlRegexString, email.bodyHtmlText);
}


function getAnyUnsubscriptionLinkEmailedTo(siteId: SiteId, emailAddress: string): string {
  const email = getLastEmailSenTo(siteId, emailAddress);
  return utils.findAnyFirstLinkToUrlIn(unsubUrlRegexString, email.bodyHtmlText);
}


function waitForUnsubscriptionLinkEmailedTo(siteId: SiteId, emailAddress: string, browser): string {
  for (let attemptNr = 1; attemptNr <= settings.waitforTimeout / 500; ++attemptNr) {
    const email = getLastEmailSenTo(siteId, emailAddress);
    const link = utils.findAnyFirstLinkToUrlIn(unsubUrlRegexString, email.bodyHtmlText);
    if (!link)
      browser.pause(500 - 100); // 100 ms for a request, perhaps?
    else
      return link;
  }
}


function waitUntilLastEmailMatches(siteId: SiteId, emailAddress: string,
        textToMatch: string, browser) {
  const regex = new RegExp(utils.regexEscapeSlashes(textToMatch));
  for (let attemptNr = 1; attemptNr <= settings.waitforTimeout / 500; ++attemptNr) {
    const email = getLastEmailSenTo(siteId, emailAddress);
    const matches = email.bodyHtmlText.match(regex);
    if (!matches)
      browser.pause(500 - 100);
    else
      return matches;
  }
  die(`Never got any email to ${emailAddress} matching /${textToMatch}/ [EdE2WKTSUG0]`);
}


export = {
  initOrDie: initOrDie,
  importSiteData: importSiteData,
  getLastEmailSenTo: getLastEmailSenTo,
  getLastVerifyEmailAddressLinkEmailedTo: getLastVerifyEmailAddressLinkEmailedTo,
  getLastUnsubscriptionLinkEmailedTo: getLastUnsubscriptionLinkEmailedTo,
  getAnyUnsubscriptionLinkEmailedTo: getAnyUnsubscriptionLinkEmailedTo,
  waitForUnsubscriptionLinkEmailedTo: waitForUnsubscriptionLinkEmailedTo,
  waitUntilLastEmailMatches: waitUntilLastEmailMatches,
};


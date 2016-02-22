// This file sends requests to the server we're testing. Doesn't start any server.

var _ = require('lodash');
var assert = require('assert');
var syncRequest = require('sync-request');
var logAndDie = require('./log-and-die.js');
var settings = require('./settings.js');
var logUnusual = logAndDie.logUnusual, die = logAndDie.die, dieIf = logAndDie.dieIf;
var logMessage = logAndDie.logMessage;

var xsrfTokenAndCookies;


function initOrDie(mainSiteOrigin, e2eTestPassword) {
  var response = syncRequest('GET', settings.mainSiteOrigin);
  dieIf(response.statusCode !== 200,
      "Error getting xsrf token and cookies from " + settings.mainSiteOrigin + " [EsE2FKE3]",
      showResponse(response));

  var cookieString = '';
  var xsrfToken = '';
  var cookies = response.headers['set-cookie'];
  _.each(cookies, function(cookie) {
    // A Set-Cookie header value looks like so: "name=value; options"
    var nameValueStr = cookie.split(';')[0];
    var nameAndValue = nameValueStr.split('=');
    var name = nameAndValue[0];
    var value = nameAndValue[1];
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

  var passwordParam =
      (url.indexOf('?') === -1 ? '?' : '&') + 'e2eTestPassword=' + settings.e2eTestPassword;

  var response = syncRequest('POST', url + passwordParam, { json: data, headers: {
    'X-XSRF-TOKEN': xsrfTokenAndCookies[0],
    'Cookie': xsrfTokenAndCookies[1]
  }});

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
  dieIf(!settings.e2eTestPassword, "No E2E test password specified [EsE7YKF2]");
  logMessage('GET ' + url);

  var passwordParam =
      (url.indexOf('?') === -1 ? '?' : '&') + 'e2eTestPassword=' + settings.e2eTestPassword;

  var response = syncRequest('GET', url + passwordParam, { headers: {
    'X-XSRF-TOKEN': xsrfTokenAndCookies[0],
    'Cookie': xsrfTokenAndCookies[1]
  }});

  dieIf(response.statusCode !== 200, "GET request failed to " + url + " [EsE8JYT4]",
      showResponse(response));
  return response;
}


function showResponse(response) {
  return (
      "Response status code: " + response.statusCode + " (should have been 200)\n" +
      showResponseBodyJson(response.body));
}


function showResponseBodyJson(body) {
  return (
  "Response body: ———————————————————————————————————————————————————————————————————\n" +
  JSON.stringify(body) +
  "\n——————————————————————————————————————————————————————————————————————————————————\n");
}


function importSiteData(siteData) {
  var url = settings.mainSiteOrigin + '/-/import-site';
  var body = postOrDie(url, siteData).bodyJson();
  dieIf(!body.site || !body.site.id, "No site.id in import-site response [EsE7UGK2]",
      showResponseBodyJson(body));
  return body.site;
}


function getLastEmailSenTo(email) {
  var response = getOrDie(settings.mainSiteOrigin + '/-/last-e2e-test-email?sentTo=' + email);
  return JSON.parse(response.body); // { subject, bodyTextHtml }
}


module.exports = {
  initOrDie: initOrDie,
  importSiteData: importSiteData,
  getLastEmailSenTo: getLastEmailSenTo,
};


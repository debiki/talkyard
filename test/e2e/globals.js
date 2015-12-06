var _ = require('lodash');
var request = require('request');
var Promise = require('es6-promise').Promise;

// Create colors.
var chalk = require('chalk');
var errorColor = chalk.bold.yellow.bgRed;
var warningColor = chalk.bold.red;
var unusualColor = chalk.black.bgGreen;
function logError(message) { console.log(errorColor(message)); }
function logWarning(message) { console.log(warningColor(message)); }
function logUnusualMessage(message) { console.log(unusualColor(message)); }

// Analyze arguments.
var args;
try {
  // This'll work if we're called from gulp-nightwatch — then [2] is a json obj string
  // with all arguments.
  args = JSON.parse(process.argv[2]);
}
catch (error) {
  // We're probably running Nightwatch directly (not via gulp-nightwatch), then:
  args = require('minimist')(process.argv.slice(2));
}

// Setup settings.
var e2eTestPassword = args.password;
var secure = args.secure;
var host = args.host || (secure ? 'localhost:9443' : 'localhost:9000');
var scheme = secure ? 'https' : 'http';
var mainSiteOrigin = scheme + '://' + host;
var newSiteDomain = args.newSiteDomain || host;
var noTimeout = args.nt || args.noTimeout;
var pauseForeverAfterTest = args.pa || args.pauseForeverAfterTest;

// Setup secret settings.
var gmailEmail;
var gmailPassword;
var facebookAdminPassword;
var facebookAdminEmail;
var facebookUserPassword;
var facebookUserEmail;
var secretsPath = args.secretsPath;
if (secretsPath) {
  var fs = require('fs');
  var content = fs.readFileSync(secretsPath, { encoding: 'utf8' });
  try {
    var json = JSON.parse(content);
    gmailEmail = json.gmailEmail;
    gmailPassword = json.gmailPassword;
    facebookAdminPassword = json.facebookAdminPassword;
    facebookAdminEmail = json.facebookAdminEmail;
    facebookUserPassword = json.facebookUserPassword;
    facebookUserEmail = json.facebookUserEmail;
    if (!e2eTestPassword) e2eTestPassword = json.e2eTestPassword;
    if (!gmailEmail) logWarning("No gmailEmail in " + secretsPath);
    if (!gmailPassword) logWarning("No gmailPassword in " + secretsPath);
    if (!facebookAdminPassword) logWarning("No facebookAdminPassword in " + secretsPath);
    if (!facebookAdminEmail) logWarning("No facebookAdminEmail in " + secretsPath);
    if (!facebookUserPassword) logWarning("No facebookUserPassword in " + secretsPath);
    if (!facebookUserEmail) logWarning("No facebookUserEmail in " + secretsPath);
  }
  catch (error) {
    logError("Error parsing secret file: " + error);
    logError("No secrets loaded. At least all OpenAuth tests will be skipped.");
  }
}

// Create cookies and xsrf token.
// (Don't use request's own cookie handling, it doesn't work for me.)
var xsrfTokenAndCookiesPromise = new Promise(function(resolve, reject) {
  request(mainSiteOrigin, function(error, response, body) {
    if (error) {
      logWarning("\nError getting cookies from " + mainSiteOrigin +
          ", POST requests from Node.js will fail [EsE2FKE3]: " + error.message);
      reject("Get-cookies request failed");
      return;
    }
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
    if (!xsrfToken) {
      logError("\nGot no xsrf token from " + mainSiteOrigin +
          ", POST requests from Node.js will fail [EsE8GLK2]");
      reject("Get-cookies request returned no xsrf token cookie")
    }
    else {
      resolve([xsrfToken, cookieString]);
    }
  });
});


console.log("==================================================");
console.log("~~~~~~ Test settings:");
console.log("host: " + host);
console.log("secure: " + secure);
console.log('derived origin: ' + mainSiteOrigin);
console.log("~~~~~~ Secrets:");
console.log("e2eTestPassword: " + (e2eTestPassword ? "(yes)" : "undefined"));
console.log("gmailEmail: " + gmailEmail);
console.log("facebookAdminEmail: " + facebookAdminEmail);
console.log("facebookUserEmail: " + facebookUserEmail);
console.log("~~~~~~ Extra magic:");
if (pauseForeverAfterTest) {
  console.log("You said " + unusualColor("--pauseForeverAfterTest") +
      ", so I will pause forever after the first test.");
}
if (noTimeout) {
  console.log("You said " + unusualColor("--noTimeout") +
      ", so I might wait forever for something in the browser.");
}
console.log("==================================================");


var self = module.exports = {

  pauseForeverAfterTest: pauseForeverAfterTest,
  logError: logError,
  logWarning: logWarning,
  logUnusualMessage: logUnusualMessage,
  unusualColor: unusualColor,

  // (2.5 seconds is too short, because of spam test requests sent to external services.)
  waitForConditionTimeout: noTimeout ? 1000*3600*24*365*100 : 5000,

  e2eTestPassword: e2eTestPassword,
  e2eTestPasswordUrlParam: 'e2eTestPassword=' + e2eTestPassword,

  generateTestId: function() {
    return (new Date()).getTime().toString().slice(3, 10);
  },

  testLocalHostnamePrefix: 'e2e-test--',
  testEmailAddressPrefix: 'e2e-test--',
  gmailEmail: gmailEmail,
  gmailPassword: gmailPassword,
  facebookAdminPassword: facebookAdminPassword,
  facebookAdminEmail: facebookAdminEmail,
  facebookUserPassword: facebookUserPassword,
  facebookUserEmail: facebookUserEmail,

  mainSiteHost: host,
  mainSiteOrigin: mainSiteOrigin,

  xsrfTokenAndCookiesPromise: xsrfTokenAndCookiesPromise,

  makeSiteOrigin: function(localHostname) {
    return scheme + '://' + localHostname + '.' + newSiteDomain;
  },

  makeSiteOriginRegexEscaped: function(localHostname) {
    return scheme + ':\\/\\/' + localHostname + '.' + newSiteDomain;
  },
};


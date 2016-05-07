/// <reference path="../../../../modules/definitely-typed/lodash/lodash.d.ts"/>
/// <reference path="../../../../modules/definitely-typed/node/node.d.ts"/>
/// <reference path="../../../../modules/definitely-typed/minimist/minimist.d.ts"/>

import _ = require('lodash');
import minimist = require('minimist');
import logAndDie = require('./log-and-die');
var logUnusual = logAndDie.logUnusual, die = logAndDie.die, dieIf = logAndDie.dieIf;
var logWarning = logAndDie.logWarning, logMessage = logAndDie.logMessage;

var settings: any = {
  host: 'localhost',
  testLocalHostnamePrefix: 'e2e-test--',
  testEmailAddressPrefix: 'e2e-test--',
  // Default passwords, for testing on localhost.
  e2eTestPassword: 'public',
  forbiddenPassword: 'public',
};


// ---- Analyze arguments

var args: any = minimist(process.argv.slice(2));
_.extend(settings, args);

settings.scheme = settings.secure ? 'https' : 'http';
settings.mainSiteOrigin = settings.scheme + '://' + settings.host;
settings.newSiteDomain = settings.newSiteDomain || settings.host;

settings.debugAfterwards = args.debugAfterwards || args.da;
settings.waitforTimeout = settings.debugAfterwards || args.noTimeout || args.nt ? 2147483647 : 10*1000;

if (settings.skip3) settings.skip3rdPartyDependentTests = true;

if (settings.password) {
  settings.e2eTestPassword = settings.password;
  delete settings.password;
}


// ---- Setup secrets

var secretsPath = args.secretsPath;
if (secretsPath) {
  var fs = require('fs');
  var fileText = fs.readFileSync(secretsPath, { encoding: 'utf8' });
  try {
    var secrets = JSON.parse(fileText);
    settings = _.extend({}, secrets, settings); // command line stuff overrides file
    if (!settings.skip3rdPartyDependentTests) {
      if (!settings.gmailEmail) logWarning("No gmailEmail in " + secretsPath);
      if (!settings.gmailPassword) logWarning("No gmailPassword in " + secretsPath);
      if (!settings.facebookAdminPassword) logWarning("No facebookAdminPassword in " + secretsPath);
      if (!settings.facebookAdminEmail) logWarning("No facebookAdminEmail in " + secretsPath);
      if (!settings.facebookUserPassword) logWarning("No facebookUserPassword in " + secretsPath);
      if (!settings.facebookUserEmail) logWarning("No facebookUserEmail in " + secretsPath);
    }
  }
  catch (error) {
    die("Error parsing secret file: " + error);
  }
}
else if (!settings.skip3rdPartyDependentTests) {
  die("Neither --secretsPath nor --skip3rdPartyDependentTests specified [EsE5G5P8]");
}

/*
console.log("==================================================");
console.log("~~~~~~ Test settings:");
console.log("host: " + settings.host);
console.log("secure: " + settings.secure);
console.log('derived origin: ' + settings.mainSiteOrigin);
console.log("~~~~~~ Secrets:");
console.log("e2eTestPassword: " + (settings.e2eTestPassword ? "(yes)" : "undefined"));
console.log("gmailEmail: " + settings.gmailEmail);
console.log("facebookAdminEmail: " + settings.facebookAdminEmail);
console.log("facebookUserEmail: " + settings.facebookUserEmail);
console.log("~~~~~~ Extra magic:");
if (settings.pauseForeverAfterTest) {
  console.log("You said " + unusualColor("--pauseForeverAfterTest") +
      ", so I will pause forever after the first test.");
}
if (settings.noTimeout) {
  console.log("You said " + unusualColor("--noTimeout") +
      ", so I might wait forever for something in the browser.");
}
console.log("==================================================");
*/


export = <TestSettings> settings;

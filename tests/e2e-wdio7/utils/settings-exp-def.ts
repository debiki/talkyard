/// <reference path="../test-types2.ts"/>

import * as _ from 'lodash';
import * as minimist from 'minimist';
import * as logAndDie from './log-and-die';
import { logDebugIf } from './log-and-die';
const unusualColor = logAndDie.unusualColor;
const logUnusual = logAndDie.logUnusual, die = logAndDie.die, dieIf = logAndDie.dieIf;
const logWarning = logAndDie.logWarning, logMessage = logAndDie.logMessage;

let settings: Partial<TestSettings> = {
  host: 'localhost',
  testLocalHostnamePrefix: 'e2e-test--',
  testEmailAddressPrefix: 'e2e-test--',
  // Default passwords, for testing on localhost.
  e2eTestPassword: 'public',
  forbiddenPassword: 'public',
};


// ---- Analyze arguments

// Jest disallows to it unknown command line opts, so then we use an env
// var instead: all opts concatenated in a string, space separated.
const argvFromEnvSt: St | U = process.env.TY_ENV_ARGV_ST;
// BUG, harmless: split()s also inside "space quote".
const argvFromEnv: St[] | U = argvFromEnvSt?.split(' ');
logDebugIf(!!argvFromEnvSt, `env.TY_ENV_ARGV_ST: ${argvFromEnvSt}`);


const args: minimist.ParsedArgs = minimist(argvFromEnv || process.argv.slice(2));
_.extend(settings, args);

if (settings.randomLocalHostname) {
  dieIf(!!settings.localHostname, "Both randomLocalHostname and localHostname defined");
  settings.localHostname = `e2e-test-${Date.now().toString().substr(4)}`;
}

if (settings.localHostname && !settings.localHostname.startsWith('e2e-test-')) {
  die("localHostname doesn't start with 'e2e-test-'");
}
settings.secure = settings.secure || settings.https;
settings.scheme = settings.secure ? 'https' : 'http';  // [E2EHTTPS]
settings.mainSiteOrigin = settings.scheme + '://' + settings.host;
settings.proto2Slash = settings.scheme + '://';
settings.newSiteDomain = settings.newSiteDomain || settings.host;

settings.reuseOldSite = settings.reuseOldSite || args.reuse;

settings.specFileRetries = args.retry;

settings.debugEachStep = args.debugEachStep || args.des;
settings.debugBefore = args.debugBefore || args.db;
// dant = debug afterwards, no timeout
settings.debugAfterwards = args.debugAfter || args.debugAfterwards || args.da || args.dant;
settings.debugIfError = args.debugIfError || args.de;
settings.debug = args.debug || args.d || settings.debugBefore ||
    settings.debugAfterwards || settings.debugIfError;

// Quick way to disable all browser.debug():
settings.noDebug = args.nodebug || args.nd;

settings.block3rdPartyCookies = args.block3rdPartyCookies || args.b3c;

settings.only3rdParty = args.only3rdParty || args.o3;

const parallelStr = args.parallel || args.p;
if (parallelStr) settings.parallel = parseInt(parallelStr);

// But some tests cannot run in parallel — e.g. if they modify time.
const notParallelStr = args.notParallel || args['0p'];
if (notParallelStr) delete settings.parallel;

if (args.v || args.verbose || args.t || args.trace) {
  settings.logLevel = 'trace';
}

if (args.i || args.invisible) {
  settings.headless = true;
}

if (args['ss]'] || args['static-server-8080']) {
  settings.staticServer8080 = true;
}
if (args['ssgn]'] || args['static-server-gatsby-v1-8000']) {
  settings.staticServerGatsbyNew8000 = true;
}
if (args['ssgo]'] || args['static-server-gatsby-v1-old-ty-8000']) {
  settings.staticServerGatsbyOld8000 = true;
}

settings.numBrowsers = 1;
if (args['2br'] || args['2browsers']) {
  settings.numBrowsers = 2;
}
if (args['3br'] || args['3browsers']) {
  settings.numBrowsers = 3;
}

if (args.cd || args.chromedrier) {
  settings.useChromedriver = true;
}

if (args.se || args.selenium) {
  dieIf(settings.useChromedriver,
    `Cannot use Chromedriver and Selenium services at the same time [TyE03KTSLJG3]`);
  settings.useSelenium = true;
}

if (args.dt || args.devtools) {
  dieIf(settings.useChromedriver,
    `Cannot use DevTools and Chromedriver services at the same time? [TyE395KRDG2]`);
  dieIf(settings.useSelenium,
    `Cannot use DevTools and Selenium services at the same time [TyE306RKTDH2]`);
  settings.useDevtoolsProtocol = true;
}

// (The default 10 seconds timeout is not enough. When a fresh Docker JVM & Play Framework
// container is started for the very first time, it's rather slow — it takes 5-10 seconds
// for Nashorn to compile all JS,/ that could be why. Or some other Java JIT compilation?
// Also, the email sending background threads are sometimes rather slow. [5KF0WU2T4]
// Whatever. Wait 21 seconds by default.)
let waitforTimeout = args.waitforTimeout || args.wft;
if (waitforTimeout) waitforTimeout = parseInt(waitforTimeout);
settings.waitforTimeout = args.noTimeout || args.nt || args.dant ||
        settings.debugEachStep ?
    2147483647 : (waitforTimeout || (
      // Wait longer, in case many tests running at the same time,
      // on a slow core i5 laptop.
      settings.parallel && settings.parallel >= 2 ?
          42 : 27) * 1000);

settings.browserName = 'chrome';
if (args.ff) settings.browserName = 'firefox';
if (args.firefox) settings.browserName = 'firefox';

if (args['3'] || args.include3rdPartyDependentTests) {
  settings.include3rdPartyDependentTests = true;
}

if (settings['password'] && !settings.e2eTestPassword) {
  settings.e2eTestPassword = settings['password'];
  delete settings['password'];
}


// ---- Setup secrets

const secretsPath = args.secretsPath;
if (secretsPath) {
  const fs = require('fs');
  const fileText = fs.readFileSync(secretsPath, { encoding: 'utf8' });
  try {
    const secrets = JSON.parse(fileText);
    settings = _.extend({}, secrets, settings); // command line stuff overrides file
    if (settings.include3rdPartyDependentTests) {
      if (!settings.gmailEmail) logWarning("No gmailEmail in " + secretsPath);
      if (!settings.gmailPassword) logWarning("No gmailPassword in " + secretsPath);
      if (!settings.githubUsernameMixedCase) logWarning("No githubUsernameMixedCase in " + secretsPath);
      if (!settings.githubPassword) logWarning("No githubPassword in " + secretsPath);
      if (!settings.githubEmailMixedCase) logWarning("No githubEmailMixedCase in " + secretsPath);
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
else if (settings.include3rdPartyDependentTests) {
  die("--include3rdPartyDependentTests (or -3) specified, but no --secretsPath [EsE5G5P8]");
}

const interesting = settings.parallel && settings.parallel > 1;
if (interesting) {
  console.log("==================================================");
  console.log("~~~~~~ Test settings:");
  console.log("host: " + settings.host);
  console.log("secure: " + !!settings.secure);
  console.log('derived origin: ' + settings.mainSiteOrigin);
  console.log("~~~~~~ Parallel: ");
  console.log(settings.parallel + " tests in parallel");
  console.log("~~~~~~ Secrets:");
  console.log("e2eTestPassword: " + (settings.e2eTestPassword ? "(yes)" : "undefined"));
  console.log("gmailEmail: " + settings.gmailEmail);
  console.log("facebookAdminEmail: " + settings.facebookAdminEmail);
  console.log("facebookUserEmail: " + settings.facebookUserEmail);
  console.log("~~~~~~ Extra magic:");
  if (settings.debugAfterwards) {
    console.log("You said " + unusualColor("--debugAfterwards") +
      ", so I will pause so you can debug, after the first test.");
  }
  if (settings.noTimeout) {
    console.log("You said " + unusualColor("--noTimeout") +
      ", so I might wait forever for something in the browser.");
  }
  console.log("==================================================");
}


export default <TestSettings> settings;

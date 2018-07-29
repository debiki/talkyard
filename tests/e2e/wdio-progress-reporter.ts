import util = require('util');
import events = require('events');


type CId = string;  // e.g.: "0-0",


type Runner = any;
/* example: {
  "0-0": {
    "browserA": {
      "desiredCapabilities": {
        "browserName": "chrome"
      }
    },
    "browserB": {
      "desiredCapabilities": {
        "browserName": "chrome"
      }
    }
  }
} */


type Capabilities = any;
/* example:
{"browserA":{"desiredCapabilities":{"browserName":"chrome"}},"browserB":{"desiredCapabilities":{"browserName":"chrome"}}} */


type Config = any;
/* example:
{"host":"127.0.0.1","port":4444,"sync":true,"specs":["target/e2e/specs/** /*2browsers*.js"],"suites":{},"exclude":[],"logLevel":"error","coloredLogs":true,"deprecationWarnings":false,"baseUrl":"http://localhost","bail":3,"waitforInterval":500,"waitforTimeout":21000,"framework":"mocha","reporters":[null],"reporterOptions":{},"maxInstances":1,"maxInstancesPerCapability":100,"connectionRetryTimeout":90000,"connectionRetryCount":3,"execArgv":null,"mochaOpts":{"timeout":21000,"ui":"bdd","bail":true},"jasmineNodeOpts":{"defaultTimeoutInterval":10000},"before":[null],"beforeSession":[],"beforeSuite":[],"beforeHook":[],"beforeTest":[],"beforeCommand":[],"afterCommand":[],"afterTest":[],"afterHook":[],"afterSuite":[],"afterSession":[],"after":[null],"onError":[],"onReload":[],"beforeFeature":[],"beforeScenario":[],"beforeStep":[],"afterFeature":[],"afterScenario":[],"afterStep":[],"screenshotPath":"./target/e2e-test-error-shots/","watch":false} */

interface EverythingInfo {
  isMultiremote: boolean;
  capabilities: Capabilities;
  config: Config;
}

interface SuiteEvent {
  type: string;         // e.g. 'suite:start',
  title: string;        // e.g. "some-e2e-test [TyT1234ABC]"
  parent: string;       // e.g. "some-e2e-test [TyT1234ABC]"  (was the same, weird)
  fullTitle: string;    // e.g. "some-e2e-test [TyT1234ABC]" (was also the same)
  pending: boolean,
  file: string;
  cid: CId;
  specs: string[];      // e.g. [".../talkyard/target/e2e/specs/some-name.2browsers.test.js", ...]
  event: string;        // e.g. 'suite:start';
  runner: Runner;
  uid: string;          // e.g. "some-e2e-test [TyT1234ABC]2"
  parentUid: string;    // e.g. "some-e2e-test [TyT1234ABC]2"
  specHash: string;     // e.g. "ab273a989ee269a544859a1f53c7923b"
}


function nowString(): string {
  return (new Date()).toISOString();
}

let thisFileStartMs;
let suiteStartMs;
let numSpecs = 0;
let numFailures = 0;


// Prints the current test name, so if a test hangs, one sees which test
// (because if you terminate the hanged test via CTRL+C, you'll kill the whole
// process and it'll never get the chance to tell you which test hanged).
//
let Reporter: any = function(options) {

    this.on('start', function(everythingInfo: EverythingInfo) {
      thisFileStartMs = Date.now();
    });

    this.on('end', function() {
      const endMs = Date.now();
      const durSecs = (endMs - thisFileStartMs) / 1000;
      const durMins = Math.floor(durSecs / 60);
      const remRoundSecs = Math.round(durSecs - durMins * 60);
      console.log(`wdio done running ${numSpecs} specs, ` +
          `took ${durMins}m ${remRoundSecs}s, ${numFailures} failures. [TyM5WKAB02]`);
    });

    this.on('suite:start', function(suite: SuiteEvent) {
      // Don't log this, for nested suites (a  describe(){...} inside a test file).
      // if (suite.parentUid !== suite.uid) return;  — is the same, also for nested suites.
      // suite.title and .parent and .fullTitle are different though:
      if (suite.title !== suite.parent) return;
      numSpecs += 1;
      /*
      console.log('title: ' + suite.title + ' parent: ' + suite.parent + ' fullTtl: ' + suite.fullTitle);
      console.log('parentUid: ' + suite.parentUid +  '   uid: ' + suite.uid); */
      suiteStartMs = Date.now();
      console.log(`${suite.cid}: ■■■ Spec start: ${suite.fullTitle}, ${nowString()}`);
    });

    this.on('suite:end', function(suite: SuiteEvent) {
      if (suite.title !== suite.parent) return;
      const endMs = Date.now();
      const durSecs = Math.round((endMs - suiteStartMs) / 1000);
      console.log(`${suite.cid}: ■■■ Spec done, took ${durSecs}s: ${suite.title}, ${nowString()}`);
    });

    this.on('test:start', function(test) {
      console.log(`${test.cid}: ${test.title}`);
    });

    this.on('test:end', function() {
    });

    this.on('hook:start', function(something) {
    });

    this.on('hook:end', function() {
    });

    this.on('test:pass', function() {
    });

    this.on('test:fail', function(test) {
      numFailures += 1;
      const endMs = Date.now();
      const durSecs = Math.round((endMs - suiteStartMs) / 1000);
      console.log(`${test.cid}: ■■■ FAILED after ${durSecs}s: ${test.title}, ${nowString()} [TyEE2EFAIL]`);
      console.log(`${test.cid}: Stack trace:\n${test.err.stack}`);
    });

    this.on('test:pending', function() {
    });
};

util.inherits(Reporter, events.EventEmitter);

Reporter.reporterName = 'ProgressReporter';

export = Reporter;
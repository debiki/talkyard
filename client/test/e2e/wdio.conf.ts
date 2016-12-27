/// <reference path="../../../modules/definitely-typed/lodash/lodash.d.ts"/>

import _ = require('lodash');
import progressReporter = require('./wdio-progress-reporter');
import settings = require('./utils/settings');
import server = require('./utils/server');
import addCommandsToBrowser = require('./utils/commands');

server.initOrDie();

var specs = ['target/e2e/specs/**/*.js'];
if (settings.only) {
  specs = ['target/e2e/specs/**/*' + settings.only + '*.js'];
}

var api = { config: {

  debug: settings.debug,

  // ==================
  // Specify Test Files
  // ==================
  // Define which test specs should run. The pattern is relative to the directory
  // from which `wdio` was called. Notice that, if you are calling `wdio` from an
  // NPM script (see https://docs.npmjs.com/cli/run-script) then the current working
  // directory is where your package.json resides, so `wdio` will be called from there.

  specs: specs,
  exclude: [
    // 'path/to/excluded/files'
  ],


  // ============
  // Capabilities
  // ============
  // Define your capabilities here. WebdriverIO can run multiple capabilties at the same
  // time. Depending on the number of capabilities, WebdriverIO launches several test
  // sessions. Within your capabilities you can overwrite the spec and exclude option in
  // order to group specific specs to a specific capability.

  // If you have trouble getting all important capabilities together, check out the
  // Sauce Labs platform configurator - a great tool to configure your capabilities:
  // https://docs.saucelabs.com/reference/platforms-configurator

  capabilities: [{
    browserName: settings.browserName,
    // For Firefox to work, you need to make http://wildcard.localhost addresses work
    // (where 'wildcard' can be anything).
    // See: <../../../docs/wildcard-dot-localhost.md>.
    // browserName: 'firefox'
  }],


  // ===================
  // Test Configurations
  // ===================
  // Define all options that are relevant for the WebdriverIO instance here

  // Level of logging verbosity: silent | verbose | command | data | result | error
  logLevel: 'error',

  // Enables colors for log output.
  coloredLogs: true,

  // Saves a screenshot to a given path if a command fails.
  screenshotPath: './target/e2e-test-error-shots/',

  // Set a base URL in order to shorten url command calls. If your url parameter starts
  // with "/", the base url gets prepended.
  baseUrl: settings.mainSiteOrigin,

  // Supposedly aborts if these many tests fail, but ... has never done that.
  bail: settings.bail || 3,

  // Default timeout for all waitForXXX commands.
  waitforTimeout: settings.waitforTimeout || 10000,

  // Default timeout in milliseconds for request
  // if Selenium Grid doesn't send response
  connectionRetryTimeout: 90000,

  // Default request retries count
  connectionRetryCount: 3,

  // Initialize the browser instance with a WebdriverIO plugin. The object should have the
  // plugin name as key and the desired plugin options as property. Make sure you have
  // the plugin installed before running any tests. The following plugins are currently
  // available:
  // WebdriverCSS: https://github.com/webdriverio/webdrivercss
  // WebdriverRTC: https://github.com/webdriverio/webdriverrtc
  // Browserevent: https://github.com/webdriverio/browserevent
  // plugins: {
  //   webdrivercss: {
  //     screenshotRoot: 'my-shots',
  //     failedComparisonsRoot: 'diffs',
  //     misMatchTolerance: 0.05,
  //     screenWidth: [320,480,640,1024]
  //   },
  //   webdriverrtc: {},
  //   browserevent: {}
  // },

  // Test runner services
  // Services take over a specfic job you don't want to take care of. They enhance
  // your test setup with almost no self effort. Unlike plugins they don't add new
  // commands but hook themself up into the test process.
  // services: ['sauce'],

  // Framework you want to run your specs with.
  // The following are supported: mocha, jasmine and cucumber
  // see also: http://webdriver.io/guide/testrunner/frameworks.html

  // Make sure you have the wdio adapter package for the specific framework installed
  // before running any tests.
  framework: 'mocha',

  // Test reporter for stdout.
  // The following are supported: dot (default), spec and xunit
  // see also: http://webdriver.io/guide/testrunner/reporters.html
  //reporters: ['dot'],
  reporters: [progressReporter],

  // Options to be passed to Mocha.
  // See the full list at http://mochajs.org/
  mochaOpts: {
    ui: 'bdd',
    timeout: settings.waitforTimeout,
    grep: settings.grep
  },


  // =====
  // Hooks
  // =====
  // WedriverIO provides a several hooks you can use to intefere the test process in order to enhance
  // it and build services around it. You can either apply a single function to it or an array of
  // methods. If one of them returns with a promise, WebdriverIO will wait until that promise got
  // resolved to continue.

  // Gets executed once before all workers get launched.
  // onPrepare: function (config, capabilities) {
  // },

  // Gets executed before test execution begins. At this point you can access to all global
  // variables like `browser`. It is the perfect place to define custom commands.
  before: function (capabilties, specs) {
    addCommandsToBrowser(global['browser']);
    if (_.isObject(capabilties)) {
      if (capabilties['browserName']) {
        // The keys are not browser names, but browser properties. This happens if capabilities =
        // [{ browserName: 'chrome' }], i.e. one single browser, instead of
        // { browserA: { browserName: ... }, browserB: { ... }}, i.e. many browsers.
        return;
      }
      var browserNames = _.keys(capabilties);
      _.each(browserNames, (browserName) => {
        console.log("Adding custom commands to '" + browserName + "' [EsM4GKT5]");
        addCommandsToBrowser(global[browserName]);
      });
    }
  },

  // Hook that gets executed before the suite starts
  // beforeSuite: function (suite) {
  // },

  // Hook that gets executed _before_ a hook within the suite starts (e.g. runs before calling
  // beforeEach in Mocha)
  // beforeHook: function () {
  // },

  // Hook that gets executed _after_ a hook within the suite starts (e.g. runs after calling
  // afterEach in Mocha)
  // afterHook: function () {
  // },

  // Function to be executed before a test (in Mocha/Jasmine) or a step (in Cucumber) starts.
  // beforeTest: function (test) {
  // },

  // Runs before a WebdriverIO command gets executed.
  // beforeCommand: function (commandName, args) {
  // },

  // Runs after a WebdriverIO command gets executed
  // afterCommand: function (commandName, args, result, error) {
  // },

  // Function to be executed after a test (in Mocha/Jasmine) or a step (in Cucumber) starts.
  // afterTest: function (test) {
  // },

  // Hook that gets executed after the suite has ended
  // afterSuite: function (suite) {
  // },

  // Gets executed after all tests are done. You still have access to all global variables from
  // the test.
  // after: function (capabilties, specs) {
  // },

  // Gets executed after all workers got shut down and the process is about to exit. It is not
  // possible to defer the end of the process using a promise.
  // onComplete: function(exitCode) {
  // }
}};

export = api;

declare const global: any;

import * as _ from 'lodash';
import TyWdioReporter = require('./wdio-progress-reporter');
import settings = require('./utils/settings');
import server = require('./utils/server');
import lad = require('./utils/log-and-die');
//import TyWdioReporter from './wdio-progress-reporter';
//import { default as settings } from './utils/settings';
//import { default as server } from './utils/server';
//import * as lad from './utils/log-and-die';

server.initOrExit(settings);

let wasError = false;


// --------------------------------------------------------------------
//  Which specs?
// --------------------------------------------------------------------

// Unfortunately, cannot access stdin. Wdio reads stdin here:
//  https://github.com/webdriverio/webdriverio/blob/7919ff09d4d52f26a38c02649e044508af500c6a/packages/wdio-cli/src/commands/run.js#L109
// and launches a 'Launcher' with the specs to run from stdin:
//  https://github.com/webdriverio/webdriverio/blob/7919ff09d4d52f26a38c02649e044508af500c6a/packages/wdio-cli/src/commands/run.js#L120
// the Launcher then reads the config file:
//  https://github.com/webdriverio/webdriverio/blob/7919ff09d4d52f26a38c02649e044508af500c6a/packages/wdio-cli/src/launcher.js#L20
// but here in the config file, apparently stdin has been consumed,
// and we don't know which files were specified.
// So cannot look at the file names, to determine which capabilities we need.
// Instead, we need to use the command line args, i.e. `settings` (USESTNGS).

const specsPathPrefix = settings.isInProjBaseDir ? './tests/e2e' : '.';

let specs = [`${specsPathPrefix}/specs/**/*.ts`];

// This now not needed? wdio v6 has  --spec
if (settings.only) {
  const globTs = settings.only.endsWith('.test.ts') ? '' : '*.ts';
  specs = [`${specsPathPrefix}/specs/**/*${settings.only}${globTs}`];
}



// --------------------------------------------------------------------
//  Which browser?
// --------------------------------------------------------------------


interface BrowserNameAndOpts {
  browserName: string;
  acceptInsecureCerts?: boolean;
  'goog:chromeOptions'?: any;
  browserVersion?: string;
  platformName?: string;
  'sauce:options'?: any;
}

let browserNameAndOpts: BrowserNameAndOpts = {
  browserName: settings.browserName,
};

// If adding chromeOptions when the browserName is 'firefox', then *Chrome* will get used.
// So don't. Webdriver.io/Selenium bug? (April 29 2018)
if (browserNameAndOpts.browserName === 'chrome'
        || browserNameAndOpts.browserName.toLowerCase() === 'chromium') {
  const opts = {
    args: [
      '--disable-notifications',

      // Make HTTPS snake oil cert work: [E2EHTTPS]

      // Seems this is enough:
      // (from https://deanhume.com/testing-service-workers-locally-with-self-signed-certificates/ )
      '--ignore-certificate-errors',

      // Seems this isn't needed:
      // See: https://www.chromium.org/blink/serviceworker/service-worker-faq
      //'--allow-insecure-localhost',

      // Apparently also not needed: (good because the hostname is "never" the same)
      //'--unsafely-treat-insecure-origin-as-secure=https://comments-for-...-localhost-8080.localhost'
    ],
    // --- Trying to disable "Save password?" popup --------
    prefs: {
      //'profile.password_manager_enabled': false,
      //credentials_enable_service: false,
      //password_manager_enabled: false,
    } as any,
    //profile: {
    //  password_manager_enabled: false
    //},
    // --------------------------------------------------

    // There's also:
    // download: {
    //   default_directory: process.env.REMOTE_DOWNLOAD_DIR,
    //   prompt_for_download: false,
    //   directory_upgrade: true,
    //   extensions_to_open: '',
    // },
  };
  if (settings.block3rdPartyCookies) {
    // Seems `profile.block_third_party_cookies` isn't documented anywhere on the Internet,
    // but you'll find it in your Chrome preferences file. On Linux, it can be in:
    //   ~/.config/google-chrome/Default/Preferences
    // (see:
    //   http://chromedriver.chromium.org/capabilities
    //   https://chromium.googlesource.com/chromium/src/+/lkgr/docs/user_data_dir.md#linux )
    // It's a json file, with lots of settings, one of which is for 3rd party cookies.
    opts.prefs.profile = {
      block_third_party_cookies: true,
    };
  }

  if (settings.headless) {
    // Use --disable-gpu to avoid an error from a missing Mesa library,
    // see: https://chromium.googlesource.com/chromium/src/+/lkgr/headless/README.md.
    opts.args.push('--headless', '--disable-gpu');
  }

  browserNameAndOpts['goog:chromeOptions'] = opts;
  // If the Talkyard server runs https: (the --secure flag [E2EHTTPS])
  browserNameAndOpts.acceptInsecureCerts = true;
}
else if (browserNameAndOpts.browserName === 'safari-12') {
  browserNameAndOpts = {
    "browserName": 'safari',
    "browserVersion": '12.0',
    "platformName": 'macOS 10.14',
    "sauce:options": {}
  };
}
else if (browserNameAndOpts.browserName === 'safari-13') {
  browserNameAndOpts = {
    "browserName": 'safari',
    "browserVersion": '13.0',
    "platformName": 'macOS 10.15',
    "sauce:options": {}
  };
}
else {
  // This supposedly works in FF: "network.cookie.cookieBehavior": 1
  // but where is 'network'?  https://stackoverflow.com/a/48670137/694469
  // Read this?: https://help.crossbrowsertesting.com/selenium-testing/general/running-selenium-test-cookies-turned-off-remote-browser/
  if (settings.block3rdPartyCookies) {
    lad.logWarning(
      "'--block3rdPartyCookies' specified, but I don't know how to do that in this browser");
  }
}



// --------------------------------------------------------------------
// Browser drivers
// --------------------------------------------------------------------

// Recent Chromedriver versions list:
// https://sites.google.com/a/chromium.org/chromedriver/downloads
// (linked from: https://github.com/SeleniumHQ/selenium/wiki/ChromeDriver )

// Also upgrade Selenium. [upd_chromedriver_ffdriver]
const chromeDriverVersion = '86.0.4240.22';  // later:  87.0.4280.20

// Minimum Firefox version >= 60
const firefoxDriverVersion = '0.26.0';




// --------------------------------------------------------------------
// The config
// --------------------------------------------------------------------


const config: WebdriverIO.Config = {

  // ====================
  // Runner Configuration
  // ====================

  // WebdriverIO allows it to run your tests in arbitrary locations (e.g. locally or
  // on a remote machine).
  runner: 'local',

  // ==================
  // Specify Test Files
  // ==================
  // Define which test specs should run. The pattern is relative to the directory
  // from which `wdio` was called. Notice that, if you are calling `wdio` from an
  // NPM script (see https://docs.npmjs.com/cli/run-script) then the current working
  // directory is where your package.json resides, so `wdio` will be called from there.

  specs,

  exclude: [
    specsPathPrefix + '/specs/**/*__e2e-test-template__*.ts',
  ],


  // ============
  // Capabilities
  // ============
  // Define your capabilities here. WebdriverIO can run multiple capabilities at the same
  // time. Depending on the number of capabilities, WebdriverIO launches several test
  // sessions. Within your capabilities you can overwrite the spec and exclude options in
  // order to group specific specs to a specific capability.

  // First, you can define how many instances should be started at the same time. Let's
  // say you have 3 different capabilities (Chrome, Firefox, and Safari) and you have
  // set maxInstances to 1; wdio will spawn 3 processes. Therefore, if you have 10 spec
  // files and you set maxInstances to 10, all spec files will get tested at the same time
  // and 30 processes will get spawned. The property handles how many capabilities
  // from the same test should run tests.
  //
  maxInstances: settings.parallel || 1,

  // If you have trouble getting all important capabilities together, check out the
  // Sauce Labs platform configurator - a great tool to configure your capabilities:
  // https://docs.saucelabs.com/reference/platforms-configurator

  capabilities: [
    browserNameAndOpts as any
    // For Firefox to work, you need to make http://wildcard.localhost addresses work
    // (where 'wildcard' can be anything).
    // See: <../../../docs/wildcard-dot-localhost.md>.
  ],


  // ===================
  // Test Configurations
  // ===================
  // Define all options that are relevant for the WebdriverIO instance here

  // Level of logging verbosity: trace | debug | info | warn | error | silent
  logLevel: settings.logLevel || 'warn',
  // Set specific log levels per logger
  // loggers:
  // - webdriver, webdriverio
  // - @wdio/applitools-service, @wdio/browserstack-service, @wdio/devtools-service, @wdio/sauce-service
  // - @wdio/mocha-framework, @wdio/jasmine-framework
  // - @wdio/local-runner, @wdio/lambda-runner
  // - @wdio/sumologic-reporter
  // - @wdio/cli, @wdio/config, @wdio/sync, @wdio/utils
  // Level of logging verbosity: trace | debug | info | warn | error | silent
  // logLevels: {
  //     webdriver: 'info',
  //     '@wdio/applitools-service': 'info'
  // },

  // If you only want to run your tests until a specific amount of tests have failed use
  // bail (default is 0 - don't bail, run all tests).
  bail: settings.bail || 0,

  // Set a base URL in order to shorten url command calls. If your `url` parameter starts
  // with `/`, the base url gets prepended, not including the path portion of your baseUrl.
  // If your `url` parameter starts without a scheme or `/` (like `some/path`), the base url
  // gets prepended directly.
  baseUrl: settings.mainSiteOrigin,

  // Default timeout for all waitFor* commands.
  waitforTimeout: settings.waitforTimeout || 10000,

  // Default timeout in milliseconds for request
  // if browser driver or grid doesn't send response
  connectionRetryTimeout: Math.max(settings.waitforTimeout || 90000),

  // Default request retries count
  connectionRetryCount: 3,

  // Test runner services
  // Services take over a specific job you don't want to take care of. They enhance
  // your test setup with almost no effort. Unlike plugins, they don't add new
  // commands. Instead, they hook themselves up into the test process.

  // This makes wdio/something hang, and spin the CPU to 100% "forever",
  // when a login popup tab closes itself (which they do, after login).
  // I think this makes WebdriverIO use Puppeteer?
  //
  // services: undefined

  // This doens't need Java, doesn't use Selenium. But works only with Chrome; talks
  // directly with Chrome. Uses the Chromedriver NPM package, which:
  //   """grabbing a particular "blessed" (by this module) version
  //   of ChromeDriver. As new versions are released and vetted, this module
  //   will be updated accordingly"""  https://www.npmjs.com/package/chromedriver
  // Also, cannot be invisible? Won't use any Docker container, and ignores --headless.
  //
  //services: ['chromedriver'],

  //services: ['devtools'],

  // This requires Java — will start Selenium, listens on port 4444.
  // (This binary: node_modules/selenium-standalone/.selenium/selenium-server/3.141.5-server.jar )
  // Does use a Docker container with Chrome — so, can be invisible.
  //
  services: [
    settings.useChromedriver ? 'chromedriver' : (    // if script flag:  --cd
      settings.useDevtoolsProtocol ? 'devtools' : (  // if script flag:  --dt
        ['selenium-standalone', {                    // else the default
        logPath: 'logs',
        installArgs: {
          drivers: {
            chrome: { version: chromeDriverVersion },
            firefox: { version: firefoxDriverVersion }
          }
        },
        args: {
          drivers: {
            chrome: { version: chromeDriverVersion },
            firefox: { version: firefoxDriverVersion }
          }
        }}])),

  //   'sauce',
  //
  //    // https://webdriver.io/docs/wdio-chromedriver-service.html
  //    // Would need to install Chromedriver: npm install chromedriver --save-dev
  //   'wdio-chromedriver-service',

  //   // https://webdriver.io/docs/selenium-standalone-service.html
  //   'selenium-standalone',
  //
  //   // https://webdriver.io/docs/devtools-service.html
  //   'devtools',
  //
  //   // https://webdriver.io/docs/firefox-profile-service.html
  //   'firefox-profile',
  //
  //   // https://webdriver.io/docs/wdio-docker-service.html
  //   'docker',
  //
  //   'intercept'],

  ],

  // Framework you want to run your specs with.
  // The following are supported: Mocha, Jasmine, and Cucumber
  // see also: https://webdriver.io/docs/frameworks.html

  // Make sure you have the wdio adapter package for the specific framework installed
  // before running any tests.

  // I like Mocha because it has no built-in shold.not.be.a.what.not.equal.bää assertion lib.
  framework: 'mocha',

  // The number of times to retry the entire specfile when it fails as a whole
  specFileRetries: settings.specFileRetries,

  // Whether or not retried specfiles should be retried immediately or deferred to the end of the queue
  // specFileRetriesDeferred: true, — the default

  // Delay in seconds between the spec file retry attempts
  // Set to some seconds, because ofen the problem is that the server is
  // recompiling and restarting, because of someone/you edit the source code.
  specFileRetriesDelay: 4,  // default: 0

  // Test reporter for stdout.
  // The only one supported by default is 'dot'
  // see also: https://webdriver.io/docs/dot-reporter.html
  reporters: [TyWdioReporter],
  //  also: 'spec' or 'dot',  or 'concise' — but won't print which file failed :- (


  // =====
  // Hooks
  // =====
  // WebdriverIO provides several hooks you can use to interfere with the test process in order to enhance
  // it and to build services around it. You can either apply a single function or an array of
  // methods to it. If one of them returns with a promise, WebdriverIO will wait until that promise got
  // resolved to continue.

  /**
   * Gets executed once before all workers get launched.
   * @param {Object} config wdio configuration object
   * @param {Array.<Object>} capabilities list of capabilities details
   */
  // onPrepare: function (config, capabilities) {
  // },

  /**
   * Gets executed before a worker process is spawned and can be used to initialise specific service
   * for that worker as well as modify runtime environments in an async fashion.
   * @param  {String} cid      capability id (e.g 0-0)
   * @param  {[type]} caps     object containing capabilities for session that will be spawn in the worker
   * @param  {[type]} specs    specs to be run in the worker process
   * @param  {[type]} args     object that will be merged with the main configuration once worker is initialised
   * @param  {[type]} execArgv list of string arguments passed to the worker process
   */
  onWorkerStart: function (cid: string, caps: WebDriver.DesiredCapabilities,
        specs: string[], args: WebdriverIO.Config, execArgv: string[]) {
    // This is in the main wdio process (not one of the worker processes that
    // actually runs the tests).
    // Maybe pass local hostname, and the cid, to the worker here?
    //     ... instead of this hack, in the reporter: [052RKTL40]
  },

  /**
   * Gets executed just before initialising the webdriver session and test framework. It allows you
   * to manipulate configurations depending on the capability or spec.
   * @param {Object} config wdio configuration object
   * @param {Array.<Object>} capabilities list of capabilities details
   * @param {Array.<String>} specs List of spec file paths that are to be run
   */
  // beforeSession: function (config, capabilities, specs) {
  // },

  /**
   * Gets executed before test execution begins. At this point you can access to all global
   * variables like `browser`. It is the perfect place to define custom commands.
   * @param {Array.<Object>} capabilities list of capabilities details
   * @param {Array.<String>} specs List of spec file paths that are to be run
   */
  before: function (capabilities: WebDriver.DesiredCapabilities, specs: string[]) {
    // Any way to get the 'cid' here?

    // This is in a wdio worker process — it has different 'global.*' than the main process,
    // and any local variables from the main wdio process are "gone" here.

    global.wdioBeforeHookHasRun = true;

    // In case configured in some other way than via --devtools flag.
    settings.useDevtoolsProtocol =
        !!config.services.find(s => s === 'devtools' || s[0] === 'devtools');
    global.settings = settings;

    // Unless otherwise specified on the command line, generate unique hostnames
    // for eacch spec, so they won't overite / try-to-use each other's sites.
    // (I wonder if overwriting `settings.localHostname`, that would affect other
    // specs we're running in parallel with the current one? — No, wouldn't;
    // they run in different Nodejs processes.)
    // Update: Now done here:  [052RKTL40]  instead, where the  cid  is available.
    //if (!settings.localHostname) {
    //  global.localHostname = nextLocalHostname();
    //  console.log(`Generated local hostname: ${global.localHostname}`);
    //}

    // It's nice if browserA is available also in not-multiremote tests with one browser.
    // so there's a way to refer to just *one* browser instead of 
    if (!global.browserA && _.isArray(capabilities) && capabilities.length === 1) {
      global.browserA = global.browser;
    }
    // Let's do this instead: (if the test uses only one browser, then,
    // browserA is undefined, and .browser is the only browser. But, in multiremote,
    // browserA is one single browser, .browser runs each command in *all* browsers.)
    global.oneWdioBrowser = global.browserA || global.browser;
    global.allWdioBrowsers = global.browser;

    global.wdioBrowser = global.allWdioBrowsers;  // deprecated
    global.wdioBrowserA = global.oneWdioBrowser;
    global.wdioBrowserB = global.browserB; // only in multiremote tests
    global.wdioBrowserC = global.browserC; //  — "" —

    // Extremely confusing if calling the wrong $, e.g.:
    //   $('#e_TermsL').getHTML();
    // instead of:
    //   this.$('#e_TermsL').getHTML();
    // The former silently blocks forever, waiting for a  #e_TermsL  elem to appear
    // — in the wrong browser session.  (But with trace log level one can study the
    // logs and eventually find out it's a different browser session.)
    //
    global.$ = (selector) => {
      lad.die(`You called the global $ but it might be bound to the wrong browser session; ` +
          `use:  this.$(...)  instead.  You did:  $('${selector}')  [TyEBADDOLLAR]`);
    }

    global.$$ = (selector) => {
      lad.die(`You called the global $$ but it might be bound to the wrong browser session; ` +
          `use:  this.$$(...)  instead.  You did:  $$('${selector}')  [TyEBADDOLLARS]`);
    }

    if (settings.debugBefore) {
      console.log("*** Paused, just before starting test. Now you can connect a debugger. ***");
      global.browser.debug();
    }
  },

  /**
   * Runs before a WebdriverIO command gets executed.
   * @param {String} commandName hook command name
   * @param {Array} args arguments that command would receive
   */
  // beforeCommand: function (commandName, args) {
  // },

  /**
   * Hook that gets executed before the suite starts
   * @param {Object} suite suite details
   */
  // beforeSuite: function (suite) {
  // },

  /**
   * Function to be executed before a test (in Mocha/Jasmine) starts.
   */
  beforeTest: function (test, context) {
    const oneBrowser = global.browserA || global.browser;
    if (settings.debugEachStep) {
      oneBrowser.debug();
    }
    else if (settings.sloooooooow) {
      oneBrowser.pause(10000);
    }
    else if (settings.slooooooow) {
      oneBrowser.pause(8000);
    }
    else if (settings.sloooooow) {
      oneBrowser.pause(6000);
    }
    else if (settings.slooooow) {
      oneBrowser.pause(5000);
    }
    else if (settings.sloooow) {
      oneBrowser.pause(4000);
    }
    else if (settings.slooow) {
      oneBrowser.pause(3000);
    }
    else if (settings.sloow) {
      oneBrowser.pause(2000);
    }
    else if (settings.slow) {
      oneBrowser.pause(1000);
    }
  },

  /**
   * Hook that gets executed _before_ a hook within the suite starts (e.g. runs before calling
   * beforeEach in Mocha)
   */
  // beforeHook: function (test, context) {
  // },

  /**
   * Hook that gets executed _after_ a hook within the suite starts (e.g. runs after calling
   * afterEach in Mocha)
   */
  // afterHook: function (test, context, { error, result, duration, passed, retries }) {
  // },

  /**
   * Function to be executed after a test (in Mocha/Jasmine).
   */
  afterTest: function(test, context,
        result: { error?: any, result?: any, duration: number, passed: boolean,
                  retries: { limit: number, attempts: number } }) {
    //  Seems isn't called if timeout, weird. So, we also check 'result' below (852RS).
    if (!result.passed) {
      wasError = true;
    }
  },

  /**
   * Hook that gets executed after the suite has ended
   * @param {Object} suite suite details
   */
  afterSuite: function (suite) {
    // The typescript interface is just {} (empty obj), but it looks like:  (852RS)
    // type: 'afterSuite', error?: { message: string, type: 'AssertionError' | string },
    // title: string, parent: string, fullTitle: string, pending: B, file: string }
    if ((suite as any).error) {
      wasError = true;
    }
  },

  /**
   * Runs after a WebdriverIO command gets executed
   * @param {String} commandName hook command name
   * @param {Array} args arguments that command would receive
   * @param {Number} result 0 - command success, 1 - command error
   * @param {Object} error error object if any
   */
  // afterCommand: function (commandName, args, result, error) {
  // },

  /**
   * Gets executed after all tests are done. You still have access to all global variables from
   * the test.
   * @param {Number} result 0 - test pass, 1 - test fail
   * @param {Array.<Object>} capabilities list of capabilities details
   * @param {Array.<String>} specs List of spec file paths that ran
   */
  after: function (result, capabilities, specs) {
    // This works right now, when there's just 1 spec per Webdriverio runner.  (852RS)
    const aTestFailed = result === 1;
    if (settings.debugAfterwards || settings.debugEachStep
          || (wasError || aTestFailed) && settings.debugIfError) {
      console.log("");
      console.log("*** Paused, before exiting test. You can connect a debugger ***");
      global.browser.debug();
    }
  },

  /**
   * Gets executed right after terminating the webdriver session.
   * @param {Object} config wdio configuration object
   * @param {Array.<Object>} capabilities list of capabilities details
   * @param {Array.<String>} specs List of spec file paths that ran
   */
  // afterSession: function (config, capabilities, specs) {
  // },

  /**
   * Gets executed after all workers got shut down and the process is about to exit. An error
   * thrown in the onComplete hook will result in the test run failing.
   * @param {Object} exitCode 0 - success, 1 - fail
   * @param {Object} config wdio configuration object
   * @param {Array.<Object>} capabilities list of capabilities details
   * @param {<Object>} results object containing test results
   */
  // onComplete: function(exitCode, config, capabilities, results) {
  // },

  /**
  * Gets executed when a refresh happens.
  * @param {String} oldSessionId session ID of the old session
  * @param {String} newSessionId session ID of the new session
  */
  //onReload: function(oldSessionId, newSessionId) {
  //}

};


// Options to be passed to Mocha. See the full list at http://mochajs.org.
// (There's a WebdriverIO MochaOptsConfig interface somewhere, but how import it?)
(config as any).mochaOpts = {
  ui: 'bdd',
  timeout: settings.waitforTimeout,
  grep: settings.grep,
  // Bail after first test failure. Saves time, and can inspect the Selenium logs.
  bail: true,
};



// --------------------------------------------------------------------
//  Static file server?
// --------------------------------------------------------------------

// We need a static file server, for blog comments tests:
// Embedded comments tests generate their own "dummy blogs" with
// blog posts that embed Talkyard's comments.

// This won't work if files piped via stdin — then, specs won't include those files.
// (USESTNGS)
//const anyEmbCommentsTestNotGatsby =
//    config.specs.find(path =>
//        path.indexOf('emmbedded-') >= 0 && path.indexOf('gatsby-') === -1);

if (settings.staticServer8080) {
  // https://webdriver.io/docs/static-server-service.html
  console.log(`\n\nCWD: ${process.cwd()}\n`);
  const server: WebdriverIO.ServiceEntry = ['static-server', {
    port: 8080,  // note: eighty-eighy
    folders: [
      { path: 'target/', mount: '/' }],
  }];
  console.log(`I'll start a static server:  ${JSON.stringify(server)}`)
  config.services.push(server);
}

if (settings.staticServerGatsbyNew8000) {
  // TODO use port 8081 instead of colliding with 8000, so can run in prallel.
  console.log(`\n\nCWD: ${process.cwd()}\n`);
  const server: WebdriverIO.ServiceEntry = ['static-server', {
    port: 8000, // eight thousand
    folders: [
      { path: 'modules/gatsby-starter-blog/public/', mount: '/' }],
  }];
  console.log(`I'll start a static server for Gatsby:  ${JSON.stringify(server)}`)
  config.services.push(server);
}

if (settings.staticServerGatsbyOld8000) {
  // TODO use port 8082 instead of colliding with 8000
  console.log(`\n\nCWD: ${process.cwd()}\n`);
  const server: WebdriverIO.ServiceEntry = ['static-server', {
    port: 8000, // eight thousand
    folders: [
      { path: 'modules/gatsby-starter-blog-ed-comments-0.4.4/public/', mount: '/' }],
  }];
  console.log(`I'll start a static server for Gatsby, old:  ${JSON.stringify(server)}`)
  config.services.push(server);
}

// --------------------------------------------------------------------
//  Many browsers?
// --------------------------------------------------------------------

// We can have Webdriver.io start 2 or 3 browser instances, doing different things
// at the same time, e.g. two browsers typing different chat messages to each other.

const maybeInvisible = settings.headless ? ' invisible' : '';
const browserName = config.capabilities[0].browserName;

// onlyAndSpec won't work with files from stdin unfortunately. (USESTNGS)
// 2br and 3br is how many browsers the tests need — 2 or 3 browsers, default 1.
const onlyAndSpec = (settings.only || '') + ((settings as any).spec || '');
const needsNumBrowsers =
    onlyAndSpec.indexOf('3br') >= 0 || settings.numBrowsers >= 3
        ? 3
        : (onlyAndSpec.indexOf('2br') >= 0 || settings.numBrowsers === 2
            ? 2
            : 1);

if (needsNumBrowsers >= 2) {
  const theCaps = config.capabilities[0];

  config.capabilities = {
    browserA: {
      capabilities: { ...theCaps }
    },
    browserB: {
      capabilities: { ...theCaps }
    },
  };

  // Needs to be in own if block — because undefined keys (browserC: undefined)
  // causes an error "TypeError: Cannot convert undefined or null to object"
  // in @wdio/selenium-standalone-service/build/launcher.js (v6.0.15, April 2020).
  if (needsNumBrowsers >= 3) {
    config.capabilities.browserC = {
      capabilities: { ...theCaps }
    };
  };

  console.log(`I'll start ${needsNumBrowsers}${maybeInvisible} ${browserName} browsers.`);
}
else {
  console.log(`I'll start one${maybeInvisible} ${browserName} browser.`);
}


export = config;

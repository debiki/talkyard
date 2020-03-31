import * as _ from 'lodash';

// Assertions tests if Talkyard works, ...
import * as assert from 'assert';
import * as tyAssert from '../utils/ty-assert';

// ... Use die() and dieIf(), though, if an e2e test is broken
// (rather than Talkyard itself).
import { getOrCall, die, dieIf, logUnusual, logDebug, logError, logWarning, logWarningIf,
    logException, logMessage, logBoring,
    logServerRequest, printBoringToStdout } from './log-and-die';

import * as path from 'path';
import * as fs from 'fs';
import settings = require('./settings');
import server = require('./server');
import utils = require('../utils/utils');
import c = require('../test-constants');
import { slugs } from 'specs/embedded-comments-create-site-export-json.2browsers.pages';


//  RENAME  this file, but to what?  TalkyardE2eBrowser? (RichBrowser like Scala's RichString etc?)
//  RENAME  waitAndGetSth, waitAndClick... to just getSth, click, etc,
//          and fns that don't wait, call them  getSthNow  and clickNow  instead,
//          since almost all fns wait until ok to procceed, so that's the 95% normal
//          case — then better that those names are brief.


type WaitForOptsReverse = {
  timeout?: number,
  interval?: number,
  timeoutMsg?: string,
  reverse: true,        //  <—— notice
}


// Brekpoint debug help counters, use like so:  if (++ca == 1) debugger;
let ca = 0;
let cb = 0;
let cc = 0;

const PollMs = 100;
const RefreshPollMs = 250;
const PollExpBackoff = 1.33;
const PollMaxMs = 3500;
const AnnoyinglyLongMs = 500;

function expBackoff(delayMs: number): number {
  const newDelayMs = delayMs * PollExpBackoff;
  return Math.min(newDelayMs, PollMaxMs);
}

function makeTimeoutMs(suggestedTimeoutMs?: number): number {
  dieIf(suggestedTimeoutMs === 0, 'suggestedTimeoutMs is 0  [TyE6053KTP]');
  dieIf(suggestedTimeoutMs && suggestedTimeoutMs < 0, 'TyE306FKDJ67');
  return Math.min(
      suggestedTimeoutMs      || 999*1000*1000,
      settings.waitforTimeout || 999*1000*1000);
}


type ElemRect = { x: number, y: number, width: number, height: number };

// [E2EBUG] Stop using browser.waitUntil — it crashes, on any exception inside,
// instead of propagating to caller. E.g. a harmless & ok stale elem ref error,
// crashes the test, instead of propagating to the util.tryManyTimes retry loop.


function count(elems): number {
  return elems && elems.value ? elems.value.length : 0;
}

function isBlank(x: string): boolean {
  return _.isEmpty(x) || !x.trim();
}

function getNthFromStartOrEnd<T>(n: number, xs: T[]): T {
  dieIf(n === 0, `First index is +1, last is -1 — don't use 0 though [TyENTHSTARTEND]`);
  const index = n > 0
      ? n - 1
      : xs.length - (-n); // count from the end
  logWarningIf(index >= xs.length, `Too few things, n: ${n}, xs.length: ${xs.length}`);
  return xs[index];
}

function getAnyRegExpOrDie(stringOrRegex: string | RegExp | U): RegExp | U {
  if (_.isUndefined) return undefined;
  return getRegExpOrDie(stringOrRegex);
}

function getRegExpOrDie(stringOrRegex: string | RegExp): RegExp {
  if (_.isString(stringOrRegex)) return new RegExp(stringOrRegex);
  else if (_.isRegExp(stringOrRegex)) return stringOrRegex;
  else die(`Not a regex, but a ${typeof stringOrRegex}: ` +
      `${JSON.stringify(stringOrRegex)}  [TyE306MKUSTJ2]`);
}


type ByBrowserAnyResults = { [browserName: string]: string | number };
type ByBrowserResult<T> = { [browserName: string]: T };


function byBrowser(result): ByBrowserAnyResults {  // dupl code [4WKET0] move all to here?
  let r;
  if (!_.isObject(result) || _.isArray(result) || (<any> result).value) {
    // This is the results from one single browser. Create a dummy by-browser
    // result map.
    r = { onlyOneBrowser: result };
  }
  else {
    // This is an object like:
    //    { browserA: { ..., value: ... }, browserB: { ..., value: ... } }
    // or like:
    //    { browserA: "text-found", browserB: "other-text-found" }
    // That's what we want.
    r = result as ByBrowserAnyResults;
  }
  console.log(`byBrowser_: r = ${JSON.stringify(r)}`);
  return r;
}

function isTheOnly(browserName) {  // dupl code [3PFKD8GU0]
  return browserName === 'onlyOneBrowser';
}

function browserNamePrefix(browserName): string { // dupl code [4GK0D8G2]
  if (isTheOnly(browserName)) return '';
  return browserName + ': ';
}

function allBrowserValues(result) {
  const resultByBrowser = byBrowser(result);
  return _.values(resultByBrowser);
}

function isResponseOk(response): boolean {
  // Previously, .status === 0' worked, but now .status instead a function that seems to
  // return the object itself (weird). Use '._status' instead + check '.state' too  :-P
  // Now, Selenium 6.7, .state is undefined, remove it too.
  return response._status === 0;
}

function isBadElemException(ex) {
  // Webdriver says one of these: (what's the difference?)
  const StaleElem1 = 'Request encountered a stale element';
  const StaleElem2 = 'stale element reference: element is not attached to the page document'
  // Puppeteer instead says:
  const CannotFindId = 'Cannot find context with specified id';
  const exStr = ex.toString();
  return (
    exStr.indexOf(StaleElem1) >= 0 ||
    exStr.indexOf(StaleElem2) >= 0 ||
    exStr.indexOf(CannotFindId) >= 0);
}

const sfy: (any) => string = JSON.stringify;

function typeAndAsString(sth): string {
  return `type: ${typeof sth}, as string: ${JSON.stringify(sth)}`;
}


interface WdioV4BackwCompatBrower extends WebdriverIO.BrowserObject {
  isVisible: (selector: string) => boolean;
  waitForVisible: (selector: string, options?: WebdriverIO.WaitForOptions) => boolean;
  isEnabled: (selector: string) => boolean;
  isExisting: (selector: string) => boolean;
  getHTML: (selector: string) => string;
  getTabIds: () => string[];
  getCurrentTabId: () => string;
  switchTab: (newTabId) => void;
}


// There might be many browsers, when using Webdriver.io's multiremote testing, so
// `browser` is an argument.
//
function pagesFor(browser: WdioV4BackwCompatBrower) {

  // The global $ might be for the wrong browser somehow, so:

  const $ = (selector: string | Function | object): WebdriverIO.Element => {
    // Webdriver doesn't show the bad selector in any error message.
    dieIf(!_.isString(selector),
        `Selector is not a string: ${typeAndAsString(selector)}  [TyEE2E506QKSG35]`);
    return browser.$(selector);
  }

  const $$ = (selector: string | Function): WebdriverIO.ElementArray => {
    dieIf(!_.isString(selector),
        `Selector is not a string: ${typeAndAsString(selector)}  [TyEE2E702RMJ40673]`);
    return browser.$$(selector);
  }

  // This is short and nice, when debugging via log messages.
  const l = logDebug as ((any) => void);

  // Short and nice.
  function d(anyMessage?: string | number | (() => string)) {
    if (_.isFunction(anyMessage)) anyMessage = anyMessage();
    if (anyMessage) logUnusual('' + anyMessage);
    browser.debug();
  }

  let firstWindowHandle;
  const hostsVisited = {};
  let isWhere: IsWhere | U;
  let isOnEmbeddedCommentsPage = false;

  function isOnEmbeddedPage() {
    return isWhere && IsWhere.EmbFirst <= isWhere && isWhere <= IsWhere.EmbLast;
  }

  browser.isVisible = (selector: string) => $(selector).isDisplayed();
  browser.waitForVisible = (s, os): boolean => $(s).waitForDisplayed(os);
  browser.isEnabled = (selector: string) => $(selector).isEnabled();
  browser.isExisting = (selector: string) => $(selector).isExisting();
  browser.getHTML = (selector: string) => $(selector).getHTML();
  browser.getTabIds = () => browser.getWindowHandles();
  browser.getCurrentTabId = () => browser.getWindowHandle();

  // Don't invoke debug() in more than one browser.
  //browser.debug = browserA ? browserA.debug.bind(browserA) : browser.debug.bind(browser);

  // There's also:  browser.switchWindow(urlOrTitleToMatch: string | RegExp)
  browser.switchTab = function() { browser.switchToWindow.apply(browser, arguments) };


  const api = {

    origin: (): string => {
      return api._findOrigin();
    },

    // (Cannot replace browser.getUrl() — it's read-only.)
    getUrl: (): string => {
      const url = browser.getUrl();
      dieIf(url.indexOf('chrome-error:') >= 0,  // wasn't matched here, although present, weird.
          `You forgot to start an e2e test help server?  [TyENOHELPSRVR]`);
      return url;
    },

    /** @deprecated */
    getSource: () => browser.getPageSource(),  // backw compat

    host: (): string => {
      const origin = api.origin();
      return origin.replace(/https?:\/\//, '');
    },

    _findOrigin: (anyUrl?: string): string => {
      const url = anyUrl || browser.getUrl();
      const matches = url.match(/(https?:\/\/[^\/]+)\//);
      if (!matches) {
        throw Error('NoOrigin');
      }
      return matches[1];
    },

    urlNoHash: (): string => {
      return browser.getUrl().replace(/#.*$/, '');;
    },

    urlPathQueryHash: (): string => {
      return browser.execute(function() {
        return location.pathname + location.search + location.hash;
      });
    },

    urlPath: (): string => {
      return browser.execute(function() {
        return location.pathname;
      });
    },


    // Change all refresh() to refresh2, then remove '2' from name.
    // (Would need to add  waitForPageType: false  anywhere? Don't think so?)
    refresh2: () => {
      browser.refresh();
      api.__updateIsWhere();
    },


    // Don't use. Change to go2 everywhere, then rename to 'go', and remove this old 'go'.
    go: (url, opts: { useRateLimits?: boolean } = {}) => {
      api.go2(url, { ...opts, waitForPageType: false });
    },

    go2: (url, opts: { useRateLimits?: boolean, waitForPageType?: false, isExternalPage?: true } = {}) => {
      let shallDisableRateLimits = false;

      firstWindowHandle = browser.getWindowHandle();

      if (url[0] === '/') {
        // Local url, need to add origin.

        // Backw compat: wdio v4 navigated relative the top frame (but wdio v6 doesn't).
        api.switchToAnyParentFrame();

        try { url = api._findOrigin() + url; }
        catch (ex) {
          dieIf(ex.message === 'NoOrigin',
              `When opening the first page: ${url}, you need to specify the server origin [TyE7UKHW2]`);
          throw ex;
        }
      }
      else {
        // New origin? Then disable rate limits.
        if (!opts.useRateLimits) {
          const parts = url.split('/');
          const host = parts[2];
          if (!hostsVisited[host]) {
            shallDisableRateLimits = true;
            hostsVisited[host] = true;
          }
        }
      }

      const message = `Go: ${url}${shallDisableRateLimits ? "  & disable rate limits" : ''}`;
      logServerRequest(message);
      try {
        browser.navigateTo(url);
      }
      catch (ex) {
        const exStr = ex.toString();
        if (exStr.indexOf('cannot determine loading status') >= 0) {
          // This can happen with the WebDriver protocol, if an existing page immediately
          // redirects to a non-existing page, e.g. SSO login. [E2ESSOLGIREDR]
          logWarning(`Navigated to broken page? Url:  ${url}`)
          logException('Got this exception:', ex);
        }
        else {
          logError(`Exception when navigating to ${url}:`)
          logException('', ex);
          throw ex;
        }
      }

      // Wait for some Talkyard thing to appear, so we'll know what type of page this is.
      if (opts.isExternalPage) {
        isWhere = IsWhere.External;
      }
      else if (opts.waitForPageType === false) {
        // Backw compat.
        isOnEmbeddedCommentsPage = false;
      }
      else {
        api.__updateIsWhere();
      }


      if (shallDisableRateLimits) {
        api.disableRateLimits();
      }
    },


    isWhere: (): IsWhere => isWhere,


    updateIsWhere: () => {
      api.__updateIsWhere();
    },


    __updateIsWhere: () => {
      // .DW = discussion / topic list page.  .btn = e.g. a Continue-after-having-verified
      // -one's-email-addr page.
      // ('ed-comments' is old, deprecated, class name.)
      api.waitForExist('.DW, .talkyard-comments, .ed-comments, .btn');
      isOnEmbeddedCommentsPage =
          $('.talkyard-comments').isExisting() ||
          $('.ed-comments').isExisting();
      isWhere = isOnEmbeddedCommentsPage ? IsWhere.EmbeddingPage : IsWhere.Forum;
    },


    goAndWaitForNewUrl: function(url) {
      logMessage("Go: " + url);
      api.rememberCurrentUrl();
      browser.url(url);
      api.waitForNewUrl();
    },


    disableRateLimits: () => {
      // Old, before I added the no-3rd-party-cookies tests.
      // Maybe instead always: server.skipRateLimits(siteId)  ?
      browser.execute(function(pwd) {
        var value =
            "esCoE2eTestPassword=" + pwd +
            "; expires=Fri, 31 Dec 9999 23:59:59 GMT";
        if (location.protocol === 'https:') {
          value +=
              "; Secure" +
              "; SameSite=None";  // [SAMESITE]
        }
        document.cookie = value;
      }, settings.e2eTestPassword || '');
    },


    pause: (millis: number) => {
      logBoring(`Pausing ${millis} ms...`);
      browser.pause(millis);
    },

    // The real waitUntil doesn't work, the first test makes any  $('sth')
    // inside be just an empty obj {}.
    // Also, this one can log a message about what we're waiting for.
    waitUntil: (fn: () => Boolean, ps: {
        timeoutMs?: number,
        timeoutIsFine?: boolean,
        message?: StringOrFn,
      } = {}): boolean => {

      let delayMs = PollMs;
      let elapsedMs = 0;
      const timeoutMs = makeTimeoutMs(ps.timeoutMs);
      const startMs = Date.now();
      let loggedAnything = false;

      try {
        do {
          const done = fn();
          if (done) {
            if (loggedAnything) {
              logBoring(`Done: ${ps.message ?
                  getOrCall(ps.message) : "Wait until something."}`);
            }
            return true;
          }

          elapsedMs = Date.now() - startMs;
          if (elapsedMs > AnnoyinglyLongMs) {
            loggedAnything = true;
            logBoring(`${elapsedMs} ms elapsed: ${ps.message ?
                getOrCall(ps.message) : "Wait until what? ..."}`);
          }

          browser.pause(delayMs);
          delayMs = expBackoff(delayMs);
        }
        while (elapsedMs < timeoutMs);
      }
      catch (ex) {
        logError(`Error in api.waitUntil(): [TyEE2EWAIT]\n`, ex);
        throw ex;
      }

      if (ps.timeoutIsFine !== true)
        tyAssert.fail(
            `api.waitUntil() timeout after ${elapsedMs} millis  [TyEE2ETIMEOUT]`);
    },


    getPageId: (): PageId => {
      const result = browser.execute(function() {
        return window['theStore'].currentPageId;
      });
      dieIf(!result,
          `Error getting page id, result: ${JSON.stringify(result)} [TyE503KTTHA24]`);
      return result;
    },


    getSiteId: function(): SiteId {
      const result = browser.execute(function() {
        return window['eds'].siteId;
      });
      dieIf(!result || _.isNaN(parseInt(result)),
          "Error getting site id, result: " + JSON.stringify(result));
      return result;  // ? return  parseInt(result.value)  instead ?
    },


    createNewSite: (data: NewSiteData): NewSiteResult => {
      // Dupl code [502SKHFSKN53]
      let url;
      if (data.siteType === SiteType.Forum) {
        console.log("Go to create Forum site page ...");
        url = utils.makeCreateSiteWithFakeIpUrl();
      }
      else {
        console.log("Go to create Embedded Comments site page ...");
        url = utils.makeCreateEmbeddedSiteWithFakeIpUrl();
      }
      api.go2(url);
      api.disableRateLimits();

      console.log("Fill in fields and submit...");
      api.createSite.fillInFieldsAndSubmit(data);

      // New site; disable rate limits here too.
      api.disableRateLimits();
      const siteId = api.getSiteId();
      const talkyardSiteOrigin = api.origin();

      console.log("Click sign up as owner ...");
      api.createSite.clickOwnerSignupButton();

      console.log("... sign up as owner ...");
      switch (data.newSiteOwner) {
        case NewSiteOwnerType.OwenOwner:
          api.loginDialog.createPasswordAccount(data, true);
          const email = server.getLastEmailSenTo(siteId, data.email, api);
          const link = utils.findFirstLinkToUrlIn(
            data.origin + '/-/login-password-confirm-email', email.bodyHtmlText);
          api.go(link);
          api.waitAndClick('#e2eContinue');
          break;
        case NewSiteOwnerType.GmailAccount:
          api.loginDialog.createGmailAccount({
            email: settings.gmailEmail,
            password: settings.gmailPassword,
            username: data.username,
          }, { shallBecomeOwner: true });
          break;
        case NewSiteOwnerType.FacebookAccount:
          api.loginDialog.createFacebookAccount({
            email: settings.facebookAdminEmail,
            password: settings.facebookAdminPassword,
            username: data.username,
          }, true);
          break;
        case NewSiteOwnerType.GitHubAccount:
          api.loginDialog.createGitHubAccount({
              username: settings.githubUsernameMixedCase,
              password: settings.githubPassword,
              shallBecomeOwner: true,
              alreadyLoggedInAtGitHub: data.alreadyLoggedInAtIdProvider });
          break;
        case NewSiteOwnerType.LinkedInAccount:
          api.loginDialog.createLinkedInAccount({
            email: settings.linkedinEmail,
            password: settings.linkedinPassword,
            username: data.username,
            shallBecomeOwner: true,
            alreadyLoggedInAtLinkedIn: data.alreadyLoggedInAtIdProvider,
          });
          break;
        default:
          die("Unimpl [TyE50KUKTYS25]");
      }

      return {
        data,
        testId: data.testId,
        siteId,
        talkyardSiteOrigin,
      }
    },


    makeNewSiteDataForEmbeddedComments: (ps: { shortName: string, longName: string })
          : NewSiteData => {
      // Dupl code [502KGAWH0]
      const testId = utils.generateTestId();
      const embeddingHostPort = `e2e-test--${ps.shortName}-${testId}.localhost:8080`;
      const localHostname = `e2e-test--${ps.shortName}-${testId}-localhost-8080`;
      //const localHostname = settings.localHostname ||
      //  settings.testLocalHostnamePrefix + 'create-site-' + testId;
      return {
        testId: testId,
        siteType: SiteType.EmbeddedCommments,
        embeddingUrl: `http://${embeddingHostPort}/`,
        origin: `${settings.scheme}://comments-for-${localHostname}.localhost`,
        orgName: ps.longName + " Org Name",
        // The owner:
        newSiteOwner: NewSiteOwnerType.OwenOwner,
        fullName: ps.longName + " test id " + testId,
        email: settings.testEmailAddressPrefix + testId + '@example.com',
        username: 'owen_owner',
        password: 'publ-ow020',
      }
    },


    numTabs: (): number => {
      return browser.getTabIds().length;
    },

    waitForMinBrowserTabs: (howMany: number) => {
      let numNow = -1;
      const message = () => `Waiting for >= ${howMany} tabs, currently ${numNow} tabs...`;
      api.waitUntil(function () {
        numNow = browser.getTabIds().length;
        return numNow >= howMany;
      }, { message });
    },

    waitForMaxBrowserTabs: (howMany: number) => {
      let numNow = -1;
      const message = () => `Waiting for <= ${howMany} tabs, currently ${numNow} tabs...`;
      api.waitUntil(() => {
        // Cannot be 0, that'd mean the test made itself disappear?
        numNow = browser.getWindowHandles().length; // browser.getTabIds().length;
        return numNow <= Math.max(1, howMany);
      }, { message });
    },


    closeWindowSwitchToOther: () => {
      browser.closeWindow();
      // WebdriverIO would continue sending commands to the now closed window, unless:
      const handles = browser.getWindowHandles();
      dieIf(!handles.length, 'TyE396WKDEG2');
      if (handles.length === 1) {
        browser.switchToWindow(handles[0]);
      }
      if (handles.length >= 2) {
        // Maybe a developer has debug-opened other browser tabs?
        // Switch back to the original window, if possible.
        if (firstWindowHandle && handles.indexOf(firstWindowHandle)) {
          logUnusual(`There're ${handles.length} open windows — ` +
              `switching back to the original window...`);
          browser.switchToWindow(firstWindowHandle);
        }
        else {
          die(`Don't know which window to switch to now. The original window is gone. [TyE05KPES]`);
        }
      }
    },


    swithToOtherTabOrWindow: function(isWhereAfter?: IsWhere) {
      for (let i = 0; i < 3; ++i) {
        logMessage("Waiting for other window to open, to prevent weird Selenium errors...");
        browser.pause(1500);
        if (browser.getTabIds().length > 1)
          break;
      }
      const ids = browser.getTabIds();
      const currentId = browser.getCurrentTabId();
      for (let i = 0; i < ids.length; ++i) {
        const id = ids[i];
        if (id !== currentId) {
          logMessage(`Calling browser.switchTab(id), id = ${id}...`);
          browser.switchTab(id);
          logMessage(`... done, current tab id is now: ${browser.getCurrentTabId()}.`);
          if (isWhereAfter) {
            isWhere = isWhereAfter;
          }
          else {
            api.__updateIsWhere();
          }
          return;
        }
      }
      // Might be a login popup that got auto closed? [3GRQU5]
      logMessage("Didn't find any other window to switch to. [EdM2WPDL0]");
    },


    switchBackToFirstTabOrWindow: () => {
      // If no id specified, will switch to the first tab.

      // [E2EBUG] In this test: embedded-comments-navigation-as-guest.test.ts
      // then this:
      //api.pause(500);    ...  makes the next command block forever
      let ids = browser.getTabIds();   // ... this'd block
      if (ids.length > 1) {
        // I've tested "everything else", nothing works.
        logMessage("Waiting for any OAuth loging popup to auto close, to prevent weird " +
            "invalid window ID errors");
        // api.pause(2000);  ??
      }
      ids = browser.getTabIds();
      if (ids.length > 1) {
        // So far all other tabs have been closed when we run this function. So > 1 tab = not tested,
        // so warn about that:
        logMessage("Which tab is the first one? Switching to [0]. All tab ids: " + JSON.stringify(ids));
      }
      try {
        logMessage("Now switching to tab ids[0] = " + ids[0]);
        browser.switchTab(ids[0]);
      }
      catch (dummy) {
        // Probably a tab just got closed? Google and Facebook auto closes login popup tabs, [3GRQU5]
        // if one is logged in already at their websites. Try again.
        logMessage(`Error switching to tab [0]: ${dummy.toString()}.\nTrying again... [EdM1WKY5F]`);
        //browser.pause(2500);
        const idsAgain = browser.getTabIds();
        browser.switchTab(idsAgain[0]);
      }
      api.__updateIsWhere();
    },


    _currentUrl: '',

    rememberCurrentUrl: function() {
      api._currentUrl = browser.getUrl();
    },

    waitForNewUrl: function() {
      assert(!!api._currentUrl, "Please call browser.rememberCurrentUrl() first [EsE7JYK24]");
      while (api._currentUrl === browser.getUrl()) {
        browser.pause(250);
      }
      delete api._currentUrl;
    },

    repeatUntilAtNewUrl: function(fn: () => void) {
      const urlBefore = browser.getUrl();
      fn();
      browser.pause(250);
      while (urlBefore === browser.getUrl()) {
        // E2EBUG RACE: if the url changes right here, maybe fn() below won't work,
        // will block.
        fn();
        browser.pause(250);
      }
    },

    waitForNewOrigin: function(anyCurrentUrl?: string) {
      const currentUrl = anyCurrentUrl || api._currentUrl;
      assert(!!currentUrl, "Please call browser.rememberCurrentUrl() first [TyE603RK54]");
      const curOrigin = api._findOrigin(currentUrl);
      while (curOrigin === api.origin()) {
        browser.pause(250);
      }
      api._currentUrl = '';
    },


    // Could rename to isInTalkyardIframe.
    // NO, use isWhere instead — just remember in which frame we are, instead of polling. ?
    isInIframe: (): boolean => {
      return browser.execute(function() {
        return window['eds'] && window['eds'].isInIframe;
      });
    },


    frameParent: () => {
      die("Use switchToAnyParentFrame() instead [TyE306WKHJP2]");
    },


    switchToAnyParentFrame: () => {
      if (api.isInIframe()) {
        browser.switchToParentFrame();
        // Skip, was some other oddity:
        // // Need to wait, otherwise apparently WebDriver can in rare cases run
        // // the next command in the wrong frame. Currently Talkyard or the e2e tests
        // // don't have iframes in iframes, so this'll work:
        // api.waitUntil(() => browser.execute(function() { return window.self === window.top; }), {
        //   message: `Waiting for browser to enter parent frame, until window.self === top`
        // });
        logMessage("Switched to parent frame.");
        isWhere = IsWhere.EmbeddingPage;
      }
    },


    switchToFrame: function(selector) {
      printBoringToStdout(`Switching to frame ${selector}...`);
      api.waitForExist(selector);
      const iframe = $(selector);
      browser.switchToFrame(iframe);
      printBoringToStdout(` done, now in frame  ${selector}.\n`);
    },


    switchToLoginPopupIfEmbedded: () => {
      if (isOnEmbeddedPage()) {
        api.swithToOtherTabOrWindow(IsWhere.LoginPopup);
      }
    },


    switchBackToFirstTabIfNeeded: () => {
      if (isWhere === IsWhere.LoginPopup) {
        api.switchBackToFirstTabOrWindow();
      }
    },


    waitForEmbeddedCommentsIframe: function() {
      // Can there be any emb comments iframe here?
      dieIf(isWhere && isWhere !== IsWhere.External &&
          isWhere != IsWhere.EmbeddingPage,
          `No comments iframe here, isWhere: ${isWhere} [TyE6RKB2GR04]`);
      api.waitForExist('iframe#ed-embedded-comments');
      if (isWhere) isWhere = IsWhere.EmbeddingPage;
    },


    switchToEmbCommentsIframeIfNeeded: () => {
      if (!isWhere || isWhere == IsWhere.Forum)
        return;
      dieIf(!isOnEmbeddedPage(), `No embedded things here, isWhere: ${isWhere} [TyE703TKDLJ4]`);
      if (isWhere !== IsWhere.EmbCommentsIframe) {
        api.switchToEmbeddedCommentsIrame();
      }
    },


    switchToEmbEditorIframeIfNeeded: () => {
      if (!isWhere || isWhere == IsWhere.Forum)
        return;
      dieIf(!isOnEmbeddedPage(), `No embedded things here, isWhere: ${isWhere} [TyE306WKH2]`);
      if (isWhere !== IsWhere.EmbEditorIframe) {
        api.switchToEmbeddedEditorIrame();
      }
    },


    switchToEmbeddedCommentsIrame: (ps: { waitForContent?: false } = {}) => {
      api.switchToAnyParentFrame();
      // Let's wait for the editor iframe, so Reply buttons etc will work.
      api.waitForExist('iframe#ed-embedded-editor');
      api.switchToFrame('iframe#ed-embedded-comments');
      if (ps.waitForContent !== false) {
        api.waitForExist('.DW');
      }
      isWhere = IsWhere.EmbCommentsIframe;
    },


    switchToEmbeddedEditorIrame: function() {
      api.switchToAnyParentFrame();
      // Let's wait for the comments iframe, so it can receive any messages from the editor iframe.
      api.waitForExist('iframe#ed-embedded-comments');
      api.switchToFrame('iframe#ed-embedded-editor');
      isWhere = IsWhere.EmbEditorIframe;
    },


    getBoundingClientRect: (selector: string): ElemRect => {
      // Something like this might work too:
      //   const elemId: string = browser.findElement('css selector', selector);
      //   browser.getElementRect(elemId);  — how get the id?
      // But this already works:
      const result = browser.execute(function(selector) {
        var elem = document.querySelector(selector);
        if (!elem) return null;
        var rect = elem.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      }, selector);

      dieIf(!result, `Cannot find selector:  ${selector}  [TyE046WKSTH24]`);
      return result;
    },


    getWindowHeight: (): number => {
       // Webdriver.io v5, just this?:
      // return browser.getWindowRect().height
      const result = browser.execute(function() {
        return window.innerHeight;
      });
      dieIf(!result, 'TyE7WKJP42');
      return result;
    },


    getPageScrollY: (): number => {
      return browser.execute(function(): number {
        var pageColumn = document.getElementById('esPageColumn');
        // ?? this works inside execute()?
        if (!pageColumn) throw Error("No #esPageColumn on this page [TyE7KBAQ2]");
        return pageColumn.scrollTop;
      });
    },


    scrollIntoViewInPageColumn: (selector: string) => {   // RENAME to  scrollIntoView
      dieIf(!selector, '!selector [TyE05RKCD5]');
      const isInPageColResult = browser.execute(function(selector) {
        var pageColumn = document.getElementById('esPageColumn');
        if (!pageColumn)
          return false;
        var elem = document.querySelector(selector);
        return pageColumn.contains(elem);
      }, selector);
      if (isInPageColResult) {
        api._real_scrollIntoViewInPageColumn(selector);
      }
      else {
        // Elem outside page column (e.g. modal dialog), or there is no page column.
        browser.execute(function(selector) {
          // Not logMessage — we're in the browser.
          console.log(`Scrolling into view in window: ${selector}`);
          var elem = document.querySelector(selector);
          // Edge and Safari don't suppor 'smooth' though (as of 2019-01).
          elem.scrollIntoView({ behavior: 'smooth' });
        }, selector);
      }
    },


    _real_scrollIntoViewInPageColumn: (selector: string) => { // RENAME to _scrollIntoViewInPageColumn
      dieIf(!selector, '!selector [TyE5WKT02JK4]');
      api.waitForVisible(selector);
      let lastScrollY = api.getPageScrollY();
      for (let i = 0; i < 60; ++i) {   // try for a bit more than 10 seconds
        browser.execute(function(selector) {
          // Not logMessage — we're in the browser.
          console.log(`Scrolling into view in page column: ${selector}`);
          window['debiki2'].utils.scrollIntoViewInPageColumn(
              selector, { marginTop: 100, marginBottom: 100, duration: 100 });
        }, selector);
        browser.pause(150);
        const curScrollY = api.getPageScrollY();
        if (lastScrollY === curScrollY) {
          // Done scrolling;
          return;
        }
        logMessage(`Scrolling <${selector}> into view in page column, scroll y: ${curScrollY} ...`);
        lastScrollY = curScrollY;
      }
      assert.fail(`Cannot scroll to: ${selector}`);
    },


    scrollToTop: function() {
      // Sometimes, the browser won't scroll to the top. [E2ENEEDSRETRY]
      // Who knows why. So try trice.
      utils.tryManyTimes('scrollToTop', 3, () => {
        // // I think some browsers wants to scroll <body> others want to scroll <html>, so do both.
        // // And if we're viewing a topic, need to scroll the page column insetad.  (4ABKW20)
        // browser.scroll('body', 0, 0);
        // browser.scroll('html', 0, 0);
        browser.execute(function() {
          window.scrollTo(0, 0);
          document.documentElement.scrollTop = 0; // not needed? but why not
          // If we're on a Talkyard page, scroll to its top.
          var pageElem = document.getElementById('esPageColumn');
          if (pageElem) pageElem.scrollTop = 0;
        });

        // Need to wait for the scroll to actually happen, otherwise Selenium/Webdriver
        // continues running subsequent test steps, without being at the top.
        let scrollTop;
        browser.waitUntil(() => {
          scrollTop = browser.execute(function() {
            return ('' +
                document.body.scrollTop + ',' +
                document.documentElement.scrollTop + ',' + (
                  document.getElementById('esPageColumn') ?
                    document.getElementById('esPageColumn').scrollTop : 0));
          });
          return scrollTop === '0,0,0';
        }, {
          timeout: 2000,
          timeoutMsg: `Couldn't scroll to top, scrollTop: ${scrollTop}`,
        });
      });
    },


    scrollToBottom: function() {
      //browser.scroll('body', 0, 999*1000);
      //browser.scroll('html', 0, 999*1000);
      //if (browser.isVisible('#esPageColumn')) {
      //  browser.execute(function() {
      //    document.getElementById('esPageColumn').scrollTop = 999*1000;
      //  });
      //}
      browser.execute(function() {
        window.scrollTo(0, 999*1000);
        document.documentElement.scrollTop = 999*1000; // not needed? but why not
        // If we're on a Talkyard page, scroll to its bottom too.
        var pageElem = document.getElementById('esPageColumn');
        if (pageElem) pageElem.scrollTop = 999*1000;
      });

      // Need to wait for the scroll to actually happen. COULD instead maybe
      // waitUntil scrollTop = document height - viewport height?  but will probably be
      // one-pixel-too-litle-too-much errors? For now:
      browser.pause(500);
    },


    clickBackdrop: () => {
      api.waitAndClick('.fade.in.modal');
    },


    playTimeSeconds: function(seconds: number) {  // [4WKBISQ2]
      dieIf(!seconds, '!seconds [TyE503RKTSH25]');
      browser.execute(function (seconds) {
        // Don't use  logMessage in here; this is in the browser (!).
        console.log("Playing time, seconds: " + seconds);
        window['debiki2'].addTestExtraMillis(seconds * 1000);
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            doWhat: 4, // = SwDo.PlayTime [4092RMT5]
            extraTimeMs: seconds * 1000
          });
        }
        console.log("Time now: " + window['debiki2'].getNowMs());
      }, seconds);
      logMessage(`... ${seconds} seconds pass by ...`);
    },


    waitForMyDataAdded: function() {
      api.waitForVisible('.e2eMyDataAdded');
    },


    // Can be used to wait until a fade-&-scroll-in dialog is done scrolling in, for example.
    //
    waitUntilDoesNotMove: function(buttonSelector: string, pollInterval?: number) {
      for (let attemptNr = 1; attemptNr <= 30; ++attemptNr) {
        const location = api.getBoundingClientRect(buttonSelector);
        browser.pause(pollInterval || 50);
        const locationLater = api.getBoundingClientRect(buttonSelector);
        if (location.y === locationLater.y && location.x === locationLater.x)
          return;
      }
      die(`Never stops moving: '${buttonSelector}' [EdE7KFYU0]`);
    },


    count: (selector: string): number =>
      $$(selector).length,


    isVisible: (selector: string) =>
      $(selector).isDisplayed(),


    waitForVisible: function(selector: string, ps: { timeoutMs?: number } = {}) {
                                              //  options?: WebdriverIO.WaitForOptions) {
      api.waitUntil(() => {
        const elem = $(selector);
        if (elem && elem.isExisting() && elem.isDisplayed())
          return true;
      }, {
        ...ps,
        message: `Waiting for visible:  ${selector}`,
      });
    },


    waitForNotVisible: function(selector: string, timeoutMillis?: number) {
      for (let elapsed = 0; elapsed < timeoutMillis || true ; elapsed += PollMs) {
        if (!$(selector).isDisplayed())
          return;
        browser.pause(PollMs);
      }
      /*
      // API is: browser.waitForVisible(selector[,ms][,reverse])
      logMessage(`browser.waitForVisible('${selector}', timeoutMillis || true, timeoutMillis ? true : undefined);`);
      logWarning(`BUG just waits forever [2ABKRP83]`);
      assert(false);
      browser.waitForVisible(selector, timeoutMillis || true, timeoutMillis ? true : undefined);
      */
    },


    // deprecated
    isDisplayedWithText: function(selector: string, text: string): boolean {
      // COULD_OPTIMIZE   test all at once — now the caller calls this fn many times instead.
      const elems = $$(selector);
      for (let elem of elems) {
        if (!elem.isDisplayed())
          continue;
        const actualText = elem.getText();
        if (actualText.indexOf(text) >= 0)
          return true;
      }
      return false;
    },


    waitForEnabled: function(selector: string, options?: WebdriverIO.WaitForOptions) {
      $(selector).waitForEnabled(options)
      // origWaitForEnabled.apply(browser, arguments);
    },


    waitForVisibleText: function(selector: string, ps: { timeoutMs?: number } = {}) {
      let isVisible;
      let text;
      api.waitUntil(() => {
        const elem = $(selector);
        isVisible = elem.isDisplayed();
        text = elem.getText();
        return isVisible && !!text;
      }, {
        ...ps,
        message: `Waiting for visible non-empty text, selector:  ${selector}\n` +
            `    is visible now: ${isVisible}, text now:  "${text}"`,
      })
    },

    getWholePageJsonStrAndObj: (): [string, any] => {
      // Chrome: The browser wraps the json response in a <html><body><pre> tag.
      // Firefox: Shows pretty json with expand/collapse sub trees buttons,
      // and we need click a #rawdata-tab to get a <pre> with json text to copy.
      return utils.tryManyTimes("copy json", 3, () => {
        api.waitForVisible('#rawdata-tab, pre');
        if (browser.isVisible('#rawdata-tab')) {
          api.waitAndClick('#rawdata-tab');
        }
        const jsonStr: string = api.waitAndGetText('pre');
        const obj: any = JSON.parse(jsonStr);
        return [jsonStr, obj];
      });
    },

    waitUntilValueIs: function(selector: string, desiredValue: string) {
      let currentValue;
      api.waitForVisible(selector);
      api.waitUntil(() => {
        currentValue = $(selector).getValue();
        return currentValue === desiredValue;
      }, {
        message: `Waiting for value of:  ${selector}  to be:  ${desiredValue}\n` +
        `  now it is: ${currentValue}`,
      });
    },

    waitForExist: function(selector: string, ps: { timeoutMs?: number } = {}) {
      api.waitUntil(() => {
        const elem = $(selector);
        if (elem && elem.isExisting())
          return true;
      }, {
        ...ps,
        message: `Waiting until exists:  ${selector}`,
      });
    },

    waitForGone: function(selector: string, ps: { timeoutMs?: number } = {}) {
      api.waitUntilGone(selector, ps);
    },

    waitAndClick: function(selector: string,
          opts: { maybeMoves?: boolean, clickFirst?: boolean, mayScroll?: boolean,
            waitUntilNotOccluded?: boolean, timeoutMs?: number } = {}) {
      api._waitAndClickImpl(selector, opts);
    },


    waitAndClickFirst: function(selector: string, opts: { maybeMoves?: boolean } = {}) {
      api._waitAndClickImpl(selector, { ...opts, clickFirst: true });
    },


    waitAndClickLast: function(selector: string) {
      api.waitAndClickNth(selector, -1);
    },


    // Works with many browsers at the same time.
    _waitAndClickImpl: function(selector: string,
          opts: { clickFirst?: boolean, maybeMoves?: boolean, mayScroll?: boolean,
            waitUntilNotOccluded?: boolean, timeoutMs?: number } = {}) {
      selector = selector.trim(); // so selector[0] below, works
      api._waitForClickable(selector, opts);

      if (selector[0] !== '#' && !opts.clickFirst) {
        const elems = $$(selector);
        dieIf(elems.length > 1,
            `Don't know which one of ${elems.length} elems to click. ` +
            `Selector:  ${selector} [TyE305KSU]`);
      }
     $(selector).click();
    },


    // For one browser at a time only.
    // n starts on 1 not 0. -1 clicks the last, -2 the last but one etc.
    waitAndClickNth: function(selector, n) {   // BUG will only scroll the 1st elem into view [05YKTDTH4]
      dieIf(n <= 0, "n starts on 1, change from 0 to 1 please");
      logWarningIf(n !== 1,
          `n = ${n} !== 1, won't scroll into view before trying to click:  ${selector} [05YKTDTH4]`);

      api._waitForClickable(selector);
      const elems = $$(selector);
      assert(elems.length >= n, `Elem ${n} missing: Only ${elems.length} elems match: ${selector}`);
      const index = n > 0
          ? n - 1
          : elems.length - (-n); // count from the end

      const elemToClick = elems[index];
      dieIf(!elemToClick, selector + ' TyE36KT74356');
      elemToClick.click();
    },


    _waitForClickable: function(selector,  // RENAME? to scrollToAndWaitUntilCanInteract
          opts: { maybeMoves?: boolean, timeoutMs?: number, mayScroll?: boolean,
              okayOccluders?: string, waitUntilNotOccluded?: boolean } = {}) {
      api.waitForVisible(selector, { timeoutMs: opts.timeoutMs });
      api.waitForEnabled(selector, { timeout: opts.timeoutMs });
      if (opts.mayScroll !== false) {
        api.scrollIntoViewInPageColumn(selector);
      }
      if (opts.maybeMoves) {
        api.waitUntilDoesNotMove(selector);
      }

      // Sometimes, a not-yet-done-loading-data-from-server overlays the element and steals
      // any click. Or a modal dialog, or nested modal dialog, that is fading away, steals
      // the click. Unless:
      if (opts.waitUntilNotOccluded !== false) {
        api.waitUntilElementNotOccluded(selector, { okayOccluders: opts.okayOccluders });
      }
      else {
        // We can at least do this — until then, nothing is clickable.
        api.waitUntilLoadingOverlayGone();
      }
    },


    waitAndClickLinkToNewPage: function(selector: string, refreshBetweenTests?: boolean) {
      // Keep the debug stuff, for now — once, the click failed, although visible already, weird.
      let delay = 30;
      //let count = 0;
      //logMessage(`waitAndClickLinkToNewPage ${selector} ...`);
      api.waitUntilLoadingOverlayGone();
      while (true) {
        api.waitForMyDataAdded();
        browser.pause(delay);
        //logMessage(`waitAndClickLinkToNewPage ${selector} testing:`);
        if (browser.isVisible(selector) && browser.isEnabled(selector)) {
          //logMessage(`waitAndClickLinkToNewPage ${selector} —> FOUND and ENABLED`);
          // count += 1;
          // if (count >= 6)
          break;
        }
        else {
          //logMessage(`waitAndClickLinkToNewPage ${selector} —> NOT found...`);
          if (refreshBetweenTests) browser.refresh();
          delay *= 1.67;
        }
      }
      api.rememberCurrentUrl();
      api.waitAndClick(selector);
      api.waitForNewUrl();
    },


    waitUntilGone: function(what: string, ps: { timeoutMs?: number } = {}) {   // RENAME to waitUntilCannotSee ?
      api.waitUntil(() => {
        try {
          const elem = $(what);
          const gone = !elem || !elem.isExisting() || !elem.isDisplayed();
          if (gone)
            return true;
        }
        catch (ex) {
          if (isBadElemException(ex)) {
            logMessage(`Seems is gone:  ${what}  — continuing ...`);
            return true;
          }
          logWarning(`Exception when waiting for:  ${what}  to disappear [TyE3062784]:\n` +
              ` ${ex.toString()}\n`);
          throw ex;
        }
      }, {
        ...ps,
        message: `Waiting until gone:  ${what}  ... [TyME2EWAITGONE]`
      });
        /*
        const resultsByBrowser = api.isVisible(what);
        const values = allBrowserValues(resultsByBrowser);
        return _.every(values, x => !x ); */
    },

    focus: (selector: string, opts?: { maybeMoves?: true,
          timeoutMs?: number, okayOccluders?: string }) => {
      api._waitForClickable(selector, opts);
      $(selector).click();
    },

    refreshUntil: (test: () => boolean) => {
      while (true) {
        if (test())
          return;
        browser.pause(PollMs / 3);
        browser.refresh();
        browser.pause(PollMs * 2 / 3);
      }
    },

    refreshUntilGone: function(what) {
      while (true) {
        let resultsByBrowser = browser.isVisible(what);
        let isVisibleValues = allBrowserValues(resultsByBrowser);
        let goneEverywhere = !_.some(isVisibleValues);
        if (goneEverywhere) break;
        browser.refresh();
        browser.pause(250);
      }
    },

    __theLoadingOveraySelector: '#theLoadingOverlay',

    waitUntilLoadingOverlayGone: () => {
      api.waitUntilGone(api.__theLoadingOveraySelector);
    },

    waitUntilLoadingOverlayVisible_raceCond: () => {
      // The loading overlay might disappear at any time, when done loading. (309362485)
      // So not impossible that e2e tests that use this fn, sometimes break
      // (that's fine, we'll just retry them).
      api.waitForVisible(api.__theLoadingOveraySelector);
    },

    isLoadingOverlayVisible_raceCond: (): boolean => {
      // A race: It might disappear at any time. (309362485)
      return browser.isVisible(api.__theLoadingOveraySelector);
    },

    waitUntilModalGone: function() {
      browser.waitUntil(function () {
        // Check for the modal backdrop (it makes the stuff not in the dialog darker).
        let resultsByBrowser = browser.isVisible('.modal-backdrop');
        let values = allBrowserValues(resultsByBrowser);
        let anyVisible = _.some(values, x => x);
        if (anyVisible)
          return false;
        // Check for the block containing the modal itself.
        // This sometimes fails, if waitUntilModalGone() is done in 'everyonesBrowser'.  [4JBKF20]
        // I suppose in one browser, the modal is present, but in another, it's gone... somehow
        // resulting in Selenium failing with a """ERROR: stale element reference: element
        // is not attached to the page document""" error.
        resultsByBrowser = browser.isVisible('.fade.modal');
        values = allBrowserValues(resultsByBrowser);
        anyVisible = _.some(values, x => x);
        return !anyVisible;
      });
      api.waitUntilGone('.fade.modal');
    },

    waitUntilElementNotOccluded: (selector: string, opts: { okayOccluders?: string } = {}) => {
      dieIf(!selector, '!selector,  [TyE7WKSH206]');
      for (let i = 0; i < 9999; ++i) {
        const result = browser.execute(function(selector, okayOccluders): boolean | string {
          var elem = document.querySelector(selector);
          if (!elem)
            return `No elem matches:  ${selector}`;

          var rect = elem.getBoundingClientRect();
          var middleX = rect.left + rect.width / 2;
          var middleY = rect.top + rect.height / 2;
          var elemAtTopOfCenter = document.elementFromPoint(middleX, middleY);
          if (!elemAtTopOfCenter) {
            // This happens if the elem is outside the viewport.
            return `Elem not in viewport? ` +
                `elementFromPoint(${middleX}, ${middleY}) returns: ${elemAtTopOfCenter}, ` +
                `elem top left width height: ` +
                  `${rect.left}, ${rect.top}, ${rect.width}, ${rect.height}\n` +
                `--- elem.innerHTML.substr(0,100): ------------------------\n` +
                `${elem.innerHTML?.substr(0,100)}\n` +
                `----------------------------------------------------------`;
          }

          // Found elem directly, or found a nested elem inside?
          if (elem == elemAtTopOfCenter || elem.contains(elemAtTopOfCenter)) {
            return true;
          }

          // Found an ancestor?
          // Then, if the elem is display: inline, likely `selector` is e.g. an <a href=...>
          // link that line breaks, in a way so that the middle of its bounding rect
          // happens to be empty — when we look in its "middle", we see its parent
          // instead. (The start of the text is to the right, the end is on the next line
          // to the left — but nothing in between). If so, the elem is most likely not occluded.
          var maybeWeird = '';
          if (elemAtTopOfCenter.contains(elem)) {
            var elemStyles = window.getComputedStyle(elem);
            var displayHow = elemStyles.getPropertyValue('display');
            if (displayHow === 'inline') {
              return true;
            }
            else {
              // This would be really weird — how is it possible to see a block elem's
              // ancestor at the top, when looking at the middle of the block elem?
              maybeWeird = " Weird: Middle of block elem has ancestor on top [TyM306RDE24]";
            }
          }

          var elemIdClass =
              (elemAtTopOfCenter.id ? '#' + elemAtTopOfCenter.id : '') +
              (elemAtTopOfCenter.className ? '.' + elemAtTopOfCenter.className : '');
          if (elemIdClass === okayOccluders) {
            return true;
          }
          // Return the id/class of the thing that occludes 'elem'.
          return `Occluded by: ${elemIdClass + maybeWeird}`;
        }, selector, opts.okayOccluders || '');

        dieIf(!_.isBoolean(result) && !_.isString(result),
            `Error checking if elem interactable, result: ${ JSON.stringify(result) }`);

        if (result === true) {
          if (i >= 1) {
            logMessage(`Fine, elem [ ${selector} ] no longer occluded. Continuing`)
          }
          break;
        }

        logMessage(`Waiting for elem [ ${selector} ] to not be occluded, ` +
            `okayOccluders: [ ${opts.okayOccluders} ],\n` +
            `problem: ${result}`);
        browser.pause(200);
      }
    },

    waitForAtLeast: function(num, selector) {
      let numNow = 0;
      api.waitUntil(() => {
        numNow = api.count(selector);
        return numNow >= num;
      }, {
        message: () => `Waiting for >= ${num}  ${selector}  there are only: ${numNow}`
      });
    },

    waitForAtMost: function(num, selector) {
d("waitForAtMost: function(num, selector)  UNTESTED v6")
      let numNow = 0;
      api.waitUntil(() => {
        numNow = api.count(selector);
        return numNow <= num;
      }, {
        message: () => `Waiting for <= ${num}  ${selector}  there are: ${numNow}`
      });
    },

    assertExactly: function(num, selector) {
      let errorString = '';
      const elems = $$(selector);
      //let resultsByBrowser = byBrowser(browser.elements(selector));
      //_.forOwn(resultsByBrowser, (result, browserName) => {
        if (elems.length !== num) {
          //errorString += browserNamePrefix(browserName) + ...
          errorString += "Selector '" + selector + "' matches " +
              elems.length + " elems, but there should be exactly " + num + "\n";
        }
      //});
      assert.ok(!errorString, errorString);
    },


    waitAndPasteClipboard: (selector: string, opts?: { maybeMoves?: true,
          timeoutMs?: number, okayOccluders?: string }) => {
      api.focus(selector, opts);
      // Different keys:
      // https://w3c.github.io/webdriver/#keyboard-actions
      browser.keys(['Control','v']);
    },


    waitAndSelectFile: (selector: string, fileNameInTargetDir: string) => {
      // Step up from  tests/e2e/utils/  to  tests/e2e/target/:
      const pathToUpload = path.join(__dirname, '..', 'target', fileNameInTargetDir);
      logMessage("Uploading file: " + pathToUpload.toString());
      logWarningIf(settings.useDevtoolsProtocol,
          `BUT browser.uploadFile() DOES NOT WORK WITH THIS PROTOCOL, 'DevTools' [TyEE2EBADPROTO]`);
      // Requires Selenium or Chromedriver; the devtools protocol ('webtools' service) won't work.
      const remoteFilePath = browser.uploadFile(pathToUpload);
      $(selector).setValue(remoteFilePath);
    },


    waitAndSetValue: (selector: string, value: string | number,
        opts: { maybeMoves?: true, checkAndRetry?: true, timeoutMs?: number,
            okayOccluders?: string, append?: boolean, skipWait?: true } = {}) => {

      if (opts.append) {
        dieIf(!_.isString(value), `Can only append strings [TyE692RKR3J]`);
        dieIf(!value, `Appending nothing does nothing [TyE3355RKUTGJ6]`);
      }
      if (_.isString(value)) {
        // Chrome/Webdriverio/whatever for some reason changes a single space
        // to a weird char. (259267730)
        dieIf(isBlank(value) && value.length > 0,
            `Chrome or Webdriverio dislikes whitespace [TyE50KDTGF34]`);
      }

      //// Sometimes these tests aren't enough! [6AKBR45] The elem still isn't editable.
      //// How is that possible? What more to check for?
      //// Results in an "<element> is not reachable by keyboard" error.
      //api.waitForVisible(selector, opts.timeoutMs);
      //api.waitForEnabled(selector);
      //api.waitUntilLoadingOverlayGone();
      //if (opts.maybeMoves) {
      //  api.waitUntilDoesNotMove(selector);
      //}
      if (!opts.skipWait) {
        api._waitForClickable(selector, opts);
      }

        // Sometimes, when starting typing, React does a refresh / unmount?
        // — maybe the mysterious unmount e2e test problem [5QKBRQ] ? [E2EBUG]
        // so the remaining characters gets lost. Then, try again.
      api.waitUntil(() => {
          // Old comment, DO_AFTER 2020-08-01: Delete this comment.
          // This used to work, and still works in FF, but Chrome nowadays (2018-12)
          // just appends instead — now works again, with Webdriverio v6.
          //browser.setValue(selector, value);
          // GitHub issue and a more recent & better workaround?:
          //  https://github.com/webdriverio/webdriverio/issues/3024#issuecomment-542888255
          
          const elem = $(selector);
          const oldText = elem.getValue();

          if (opts.append) {
            dieIf(!value, 'TyE29TKP0565');
            elem.addValue(value);
          }
          else if (_.isNumber(value)) {
            elem.setValue(value);
          }
          else if (!value || !value.trim()) {
            // elem.clearValue();  // doesn't work, triggers no React.js events
            // elem.setValue('');  // also triggers no event
            // elem.setValue(' '); // adds a weird square char, why? (259267730) Looks
                     //  like a flower instead though, if printed in the Linux console.
            // But this:
            //elem.setValue('x'); // eh, stopped working, WebdriverIO v6.0.14 —> 6.0.15 ? what ?
            //browser.keys(['Backspace']);  // properly triggers React.js event
            // Instead:
            elem.setValue('x');  // focus it without clicking (in case a placeholder above)
            browser.keys(Array(oldText.length + 1).fill('Backspace'));  // + 1 = the 'x'
          }
          else {
            // --------------------------------
            // With WebDriver, setValue *appends* :- (  But works fine with Puppeteer.
            // So, if WebDriver, first clear the value:
            // elem.clearValue(); — has no effect, with WebDriver. Works with Puppeteer.
            elem.setValue('x');  // appends, and focuses it without clicking
                                  // (in case a placeholder text above)
            // Delete chars one at a time:
            browser.keys(Array(oldText.length + 1).fill('Backspace'));  // + 1 = the 'x'
            // --------------------------------
            elem.setValue(value);
          }

          if (!opts.checkAndRetry)
            return true;

          browser.pause(200);

          const valueReadBack = elem.getValue();
          const desiredValue = (opts.append ? oldText : '') + value;

          if (desiredValue === valueReadBack)
            return true;

          logUnusual('\n' +
            `   Couldn't set value to:  ${desiredValue}\n` +
            `   got back when reading:  ${valueReadBack}\n` +
            `                selector:  ${selector}   — trying again... [TyME2E5MKSRJ2]`);
      });
    },


    waitAndSetValueForId: function(id, value) {
      api.waitAndSetValue('#' + id, value);
    },


    waitAndClickSelectorWithText: (selector: string, regex: string | RegExp) => {
      api.waitForThenClickText(selector, regex);
    },

    waitForThenClickText: (selector: string, regex: string | RegExp) => {   // RENAME to waitAndClickSelectorWithText (above)
      // [E2EBUG] COULD check if visible and enabled, and loading overlay gone? before clicking
      utils.tryManyTimes(`waitForThenClickText(${selector}, ${regex})`, 3, () => {
        const elem = api.waitAndGetElemWithText(selector, regex);
        elem.click();
      });
    },


    waitUntilTextMatches: (selector: string, regex: string | RegExp) => {
      api.waitAndGetElemWithText(selector, regex);
    },


    waitUntilHtmlMatches: function(selector: string, regexOrStr: string | RegExp | any[]) {
      api.waitForExist(selector);

      for (let i = 0; true; ++i) {
        const html = browser.getHTML(selector);
        const anyMiss = api._findHtmlMatchMiss(html, true, regexOrStr);
        if (!anyMiss)
          break;

        browser.pause(PollMs);
        if (i > 10 && (i % 10 === 0)) {
          console.log(`Waiting for '${selector}' to match: \`${anyMiss}'\n` +
            `but the html is:\n-----${html}\n----`);
        }
      }
    },


    _findHtmlMatchMiss: (html: string, shouldMatch: boolean, regexOrStr: string | RegExp | any[])
          : string | null => {

      const matchMiss = shouldMatch ? "match" : "miss";
      if (settings.logLevel === 'verbose') {
        logMessage(
          `Finding ${matchMiss}es in this html:\n------\n${html}\n------`);
      }

      const regexOrStrs = _.isArray(regexOrStr) ? regexOrStr : [regexOrStr];
      for (let i = 0; i < regexOrStrs.length; ++i) {
        const ros = regexOrStrs[i];
        const regex = _.isString(ros)
            ? new RegExp(ros, 's')  // s makes '.' match newlines
            : ros;
        const doesMatch = regex.test(html);

        if (settings.logLevel === 'verbose') {
          logMessage(
              `Should ${matchMiss}: ${regex}, does ${matchMiss}: ` +
                `${ shouldMatch ? doesMatch : !doesMatch }`);
        }

        // If incorrect match/miss, return the failing regex.
        if (shouldMatch != doesMatch)
          return ros;
      }
      return null;
    },


    waitAndAssertVisibleTextMatches: (selector: string, stringOrRegex: string | RegExp) => {
      const regex = getRegExpOrDie(stringOrRegex);
      const text = api.waitAndGetVisibleText(selector);
      // This is easy to read:  [E2EEASYREAD]
      tyAssert.ok(regex.test(text), '\n\n' +
          `  Text of element selected by:  ${selector}\n` +
          `                 should match:  ${regex.toString()}\n` +
          `      but is: (between --- )\n` +
          `------------------------------------\n` +
          `${text}\n` +
          `------------------------------------\n`);
    },


    waitAndGetElemWithText: (selector: string, stringOrRegex: string | RegExp,
          timeoutMs?: number): WebdriverIO.Element => {
      const regex = getRegExpOrDie(stringOrRegex);

      // Don't use browser.waitUntil(..) — exceptions in waitUntil apparently don't
      // propagade to the caller, and instead always break the test. E.g. using
      // a stale elem ref in an ok harmless way, apparently breaks the test.
      const startMs = Date.now();
      for (let pauseMs = PollMs; true; pauseMs *= PollExpBackoff) {
        const elems = $$(selector);
        let texts = '';
        for (let i = 0; i < elems.length; ++i) {
          const elem = elems[i];
          const text = elem.getText();
          const matches = regex.test(text);
          if (matches)
            return elem;

          texts += `"${text}", `;
        }

        const elapsedMs = Date.now() - startMs;
        if (elapsedMs > AnnoyinglyLongMs) {
          logMessage(
              `Waiting for:  ${selector}  to match:  ${regex}` +
              (!elems.length ? `  — but no elems match that selector` : '\n' +
              `   but the ${elems.length} selector-matching-texts are:\n` +
              `--------------------------------------------------------\n` +
              `${texts}\n` +
              `--------------------------------------------------------`));
        }

        if (timeoutMs && elapsedMs > timeoutMs) {
          tyAssert.fail(`Didn't find text ${regex} in selector '${selector}'. ` +
            `Instead, the matching selectors texts are: [${texts}]  [TyE40MRBL25]`)
        }

        browser.pause(Math.min(pauseMs, PollMaxMs));
      }
    },


    getText: function(selector: string): string {  // RENAME to waitAndGetText
                                              // and thereafter, die(...) in api.getText().
      return api.waitAndGetText.apply(browser, arguments);
    },


    waitAndGetText: (selector: string): string => {
      // Maybe not visible, if empty text? So use  waitForExist() here — and,
      // in waitAndGetVisibleText() just below, we waitForVisible() instead.
      api.waitForExist(selector);
      return $(selector).getText();
    },


    waitAndGetValue: (selector: string): string => {
      api.waitForExist(selector);
      return $(selector).getValue();
    },


    waitAndGetVisibleText: (selector): string => {
      api.waitForVisibleText(selector);
      return $(selector).getText();
    },


    assertTextMatches: (selector: string, regex: string | RegExp, regex2?: string | RegExp) => {
      api._assertOneOrAnyTextMatches(false, selector, regex, regex2);
    },


    waitUntilAnyTextMatches: (selector: string, stringOrRegex: string | RegExp) => {
      const regex = getRegExpOrDie(stringOrRegex);
      let num;
      api.waitUntil(() => {
        const items = $$(selector);
        num = items.length;
        for (let item of items) {
          if (regex.test(item.getText()))
            return true;
        }
      }, {
        message: `Waiting for any  ${selector}  (there are ${num}, now) to match:  ${regex}`
      })
    },


    assertAnyTextMatches: (selector: string, regex: string | RegExp,
          regex2?: string | RegExp, fast?) => {
      api._assertOneOrAnyTextMatches(true, selector, regex, regex2, fast);
    },


    // n starts on 1 not 0.
    // Also see:  assertNthClassIncludes
    assertNthTextMatches: (selector: string, n: number,
          stringOrRegex: string | RegExp, stringOrRegex2?: string | RegExp) => {
      const regex = getRegExpOrDie(stringOrRegex);
      const regex2 = getAnyRegExpOrDie(stringOrRegex2);

      assert(n >= 1, "n starts on 1, change from 0 to 1 please");
      const items = $$(selector);
      assert(items.length >= n, `Elem ${n} missing: Only ${items.length} elems match: ${selector}`);

      const text = items[n - 1].getText();

      // Could reformat, make simpler to read [E2EEASYREAD].
      assert(regex.test(text), '\n' +
        `Text of elem ${n} selected by:  ${selector}\n` +
        `            does not match:  ${regex.toString()}\n` +
        `    actual text: (between ---)\n` +
        `-------------------------------------------\n` +
        `${text}\n` +
        `-------------------------------------------\n`);
      // COULD use 'arguments' & a loop instead
      if (regex2) {
        assert(regex2.test(text), "Elem " + n + " selected by '" + selector + "' doesn't match " +
            regex2.toString() + ", actual text: '" + text + "'");
      }
    },


    // n starts on 1 not 0.
    // Also see:  assertNthTextMatches
    assertNthClassIncludes: function(selector, n, classToFind) {
      assert(n >= 1, "n starts on 1, change from 0 to 1 please");
      const items = $$(selector);
      assert(items.length >= n, `Elem ${n} missing: Only ${items.length} elems match: ${selector}`);
      const actuallClassAttr = getNthFromStartOrEnd(n, items).getAttribute('class');
      const regex = new RegExp(`\\b${classToFind}\\b`);
      // Simple to read [E2EEASYREAD].
      assert(regex.test(actuallClassAttr), '\n' +
        `       Elem ${n} selected by:  ${selector}\n` +
           `  doesn't have this class:  ${classToFind}\n` +
           `           instead it has:  ${actuallClassAttr}\n`);
    },


    assertNoTextMatches: function(selector: string, regex: string | RegExp) {
      api._assertAnyOrNoneMatches(selector, false, regex);
    },


    _assertOneOrAnyTextMatches: function(many, selector, regex: string | RegExp,
          regex2?: string | RegExp, fast?) {
      //process.stdout.write('■');
      //if (fast === 'FAST') {
        // This works with only one browser at a time, so only use if FAST, or tests will break.
        api._assertAnyOrNoneMatches(selector, true, regex, regex2);
      /*
        //process.stdout.write('F ');
        return;
      }
      // With Chrome 60, this is suddenly *super slow* and the authz-view-as-stranger   [CHROME_60_BUG] because of (24DKR0)?
      // test takes 4 minutes and times out. Instead, use assertAnyOrNoneMatches (just above).
      if (_.isString(regex)) {
        regex = new RegExp(regex);
      }
      else if (!_.isRegExp(regex)) {
        die(`Not a string or regex: ${JSON.stringify(regex)} [TyE603KHJMSH550]`);
      }

      if (_.isString(regex2)) {
        regex2 = new RegExp(regex2);
      }
      else if (regex2 && !_.isRegExp(regex2)) {
        die(`regex2 is not a string or regex: ${JSON.stringify(regex2)} [TyE603KHJMSH]`);
      }

      // Log a friendly error, if the selector is absent — that'd be a test suite bug.
      // Without this assert...isVisible, Webdriver just prints "Error" and one won't know
      // what the problem is.
      assert(browser.isVisible(selector), `Selector '${selector}' not visible, cannot match text [EdE1WBPGY93]`);  // this could be the very-slow-thing (24DKR0) COULD_OPTIMIZE
      const textByBrowserName = byBrowser(browser.getText(selector));  // SLOW !!
      _.forOwn(textByBrowserName, function(text, browserName) {
        const whichBrowser = isTheOnly(browserName) ? '' : ", browser: " + browserName;
        if (!many) {
          assert(!_.isArray(text), "Broken e2e test. Select only 1 elem please [EsE4KF0W2]");
        }
        // This is easy to read:  [E2EEASYREAD]
        assert(regex.test(text), '\n\n' +
            `  Elem selected by:  ${selector}\n` +
            `      didn't match:  ${regex.toString()}${whichBrowser}\n` +
            `  Actual text: (between ---)\n` +
            `---------------------------------------------------\n` +
            text + '\n' +
            `---------------------------------------------------\n`);
        // COULD use 'arguments' & a loop instead
        if (regex2) {
          assert(regex2.test(text), "Elem selected by '" + selector + "' didn't match " +
              regex2.toString() + ", actual text: '" + text + whichBrowser + "'");
        }
      });
      //process.stdout.write('S ');
      */
    },


    _assertAnyOrNoneMatches: function(selector: string, shallMatch: boolean,
          stringOrRegex: string | RegExp, stringOrRegex2?: string | RegExp) {
      const regex = getRegExpOrDie(stringOrRegex);
      const regex2 = getAnyRegExpOrDie(stringOrRegex2);

      dieIf(_.isString(regex2) && !shallMatch,
          `two regexps only supported if shallMatch = true`);

      const elems = $$(selector);

      // If many browsers, we got back {browserName: ...., otherBrowserName: ...} instead.
      tyAssert.ok(_.isArray(elems) || !_.isObject(elems), '\n\n' +
          `assertAnyOrNoneMatches with many browsers at a time not implemented [EdE4KHA2QU]\n` +
          `$$(${selector}) —> these elems:\n` +
          `  ${JSON.stringify(elems)}  [TyEE2EMANYBRS]`);

      if (!elems.length && !shallMatch)
        return;

      let problems = !elems.length ? "No elems match the selector" : '';

      for (let i = 0; i < elems.length; ++i) {
        const elem = elems[i];
        const isVisible = elem.isDisplayed();
        if (!isVisible) {
          problems += `  Elem ix 0: Not visible\n`;
          continue;
        }
        const text = elem.getText();
        const matchesRegex1 = regex.test(text);

        const matchesAnyRegex2 = regex2 && regex2.test(text);

        if (shallMatch) {
          if (!matchesRegex1) {
            problems += `  Elem ix ${i}: Misses regex 1: ${regex}, actual text: "${text}"\n`;
            continue;
          }
          if (regex2 && !matchesAnyRegex2) {
            problems += `  Elem ix ${i}: Misses regex 2: ${regex2}, actual text: "${text}"\n`;
            continue;
          }
          // All fine, forget all problems — it's enough if one elem matches.
          return;
        }
        else {
          if (matchesRegex1) {
            problems += `  Elem ix ${i}: Matches regex 1: ${regex} (but should not), text: "${text}"\n`;
            continue;
          }
          if (regex2 && matchesAnyRegex2) {
            problems += `  Elem ix ${i}: Matcheses regex 2: ${regex2} (but should not), text: "${text}"\n`;
            continue;
          }
          if (!problems && i === (elems.length - 1)) {
            // All fine, none of the elems matches.
            return;
          }
        }
      }

      assert.fail(`Text match failure, selector:  ${selector}  shallMatch: ${shallMatch}\n` +
        `problems:\n` + problems);
    },


    waitUntilIsOnHomepage: function() {
      api.waitUntil(() => {
        const url = browser.getUrl();
        return /https?:\/\/[^/?#]+(\/latest|\/top|\/)?(#.*)?$/.test(url);
      });
    },


    // RENAME to assertPageTitlePostMatches
    assertPageTitleMatches: function(regex: string | RegExp) {
      api.waitForVisible('h1.dw-p-ttl');
      api.waitUntilTextMatches('h1.dw-p-ttl', regex);
      //api.assertTextMatches('h1.dw-p-ttl', regex);
    },


    // RENAME to assertPageBodyPostMatches
    assertPageBodyMatches: function(regex: string | RegExp) {
      api.waitForVisible('.esOrigPost');
      //api.waitUntilTextMatches('.esOrigPost', regex);
      api.assertTextMatches('.esOrigPost', regex);
    },


    assertPageHtmlSourceMatches_1: (toMatch: string | RegExp) => {
      // _1 = only for 1 browser
      const source = browser.getPageSource();
      const regex = getRegExpOrDie(toMatch);
      assert(regex.test(source), "Page source does match " + regex);
    },


    /**
     * Useful if navigating to a new page, but don't know exactly when will have done that.
     */
    waitUntilPageHtmlSourceMatches_1: (toMatch: string | RegExp) => {
      // _1 = only for 1 browser
      const regex = getRegExpOrDie(toMatch);
      api.waitUntil(() => {
        const source = browser.getPageSource();
        return regex.test(source);
      }, {
        message: `Waiting for page source to match:  ${regex}`,
      });
    },


    assertPageHtmlSourceDoesNotMatch: (toMatch: string | RegExp) => {
      const source = browser.getPageSource();
      const regex = getRegExpOrDie(toMatch)
      assert(!regex.test(source), `Page source *does* match: ${regex}`);
      //let resultsByBrowser = byBrowser(browser.getPageSource());
      //_.forOwn(resultsByBrowser, (text, browserName) => {
      //  assert(!regex.test(text), browserNamePrefix(browserName) + "Page source does match " + regex);
      //});
    },


    _pageNotFoundOrAccessDenied: /Page not found, or Access Denied/,

    // Also see browser.pageTitle.assertPageHidden().  Dupl code [05PKWQ2A]
    assertWholePageHidden: function() {
      let resultsByBrowser = byBrowser(browser.getPageSource());
      _.forOwn(resultsByBrowser, (text: any, browserName) => {
        if (settings.prod) {
          assert(api._pageNotFoundOrAccessDenied.test(text),
              browserNamePrefix(browserName) + "Page not hidden (no not-found or access-denied)");
        }
        else {
          assert(/EdE0SEEPAGEHIDDEN_/.test(text), browserNamePrefix(browserName) + "Page not hidden");
        }
      });
    },


    // Also see api.pageTitle.assertPageHidden().  Dupl code [05PKWQ2A]
    assertMayNotSeePage: function() {
      let resultsByBrowser = byBrowser(browser.getPageSource());
      _.forOwn(resultsByBrowser, (text: any, browserName) => {
        if (settings.prod) {
          assert(api._pageNotFoundOrAccessDenied.test(text),
              browserNamePrefix(browserName) + "Page not hidden (no not-found or access-denied)");
        }
        else {
          assert(/EdEM0SEE/.test(text), browserNamePrefix(browserName) +
              "User can see page. Or did you forget the --prod flag? (for Prod mode)");
        }
      });
    },


    assertMayNotLoginBecauseNotYetApproved: function() {
      api.assertPageHtmlSourceMatches_1('TyM0APPR_-TyMAPPRPEND_');
    },


    assertMayNotLoginBecauseRejected: function() {
      api.assertPageHtmlSourceMatches_1('TyM0APPR_-TyMNOACCESS_');
    },


    assertNotFoundError: function() {
      for (let i = 0; i < 20; ++i) {
        let source = browser.getPageSource();
        // The //s regex modifier makes '.' match newlines. But it's not available before ES2018.
        let is404 = /404 Not Found.+TyE404_/s.test(source);
        if (!is404) {
          browser.pause(250);
          browser.refresh();
          continue;
        }
        return;
      }
      die('EdE5FKW2', "404 Not Found never appears");
    },


    assertUrlIs: function(expectedUrl) {
      let url = browser.getUrl();
      assert(url === expectedUrl);
    },

    goToSearchPage: (query?: string) => {
      const q = query ? '?q=' + query : '';
      api.go('/-/search' + q);
      api.waitForVisible('.s_SP_QueryTI');
    },

    acceptAnyAlert: (howMany: number = 1): boolean => {
      return api.dismissAcceptAnyAlert(howMany, true);
    },

    dismissAnyAlert: (howMany: number = 1): boolean => {
      return api.dismissAcceptAnyAlert(howMany, false);
    },

    dismissAcceptAnyAlert: (howMany: number, accept: boolean): boolean => {
      let numDone = 0;
      api.waitUntil(() => {
        try {
          if (accept) browser.acceptAlert();
          else browser.dismissAlert();
          logMessage(accept ? "Accepted." : "Dismissed.");
          numDone += 1;
          if (numDone === howMany)
            return true;
        }
        catch (ex) {
          // There was no alert to accept/dismiss.
        }
      }, {
        timeoutMs: 1000,
        timeoutIsFine: true,
        message: `Waiting for alert(s), handled ${numDone} out of <= ${howMany}`
      });
      logMessage(`Handled ${numDone} out of <= ${howMany} maybe-alerts.`);
      return numDone >= 1;
    },

    countLongPollingsDone: () => {
      const result = browser.execute(function() {
        return window['debiki2'].Server.testGetLongPollingNr();
      });
      dieIf(!_.isNumber(result), "Error getting long polling count, result: " + JSON.stringify(result));
      const count = result; // parseInt(result);
      dieIf(_.isNaN(count), "Long polling count is weird: " + JSON.stringify(result));
      return count;
    },

    createSite: {
      fillInFieldsAndSubmit: function(data: NewSiteData) {
        if (data.embeddingUrl) {
          api.waitAndSetValue('#e_EmbeddingUrl', data.embeddingUrl);
        }
        else {
          api.waitAndSetValue('#dwLocalHostname', data.localHostname);
        }
        api.waitAndClick('#e2eNext3');
        api.waitAndSetValue('#e2eOrgName', data.orgName || data.localHostname);
        api.waitAndClick('input[type=submit]');
        api.waitForVisible('#t_OwnerSignupB');
        assert.equal(data.origin, api.origin());
      },

      clickOwnerSignupButton: () => {
        api.waitAndClick('#t_OwnerSignupB');
      }
    },


    createSomething: {
      createForum: (forumTitle: string) => {
        // Button gone, I'll add it back if there'll be Blog & Wiki too.
        // api.waitAndClick('#e2eCreateForum');
        browser.pause(200); // [e2erace] otherwise it won't find the next input, in the
                            // create-site-all-logins @facebook test
        logMessage(`Typig forum title: "${forumTitle}" ...`);
        api.waitAndSetValue('input[type="text"]', forumTitle, { checkAndRetry: true });
        // Click Next, Next ... to accept all default choices.
        /*  [NODEFCATS]
        api.waitAndClick('.e_Next');
        browser.pause(200); // Wait for next button
        api.waitAndClick('.e_Next');
        browser.pause(200);
        api.waitAndClick('.e_Next');
        browser.pause(200);
        */
        logMessage(`Clicking Next ...`);
        api.waitAndClick('.e_Next');

        /*
        DB_CONFICT: A Postgres serialization error might happen here, sth like 1 in 12, or 0 in 22:

2020-03-09 15:14:36.476 UTC session-5e665804.1eb tx-98022: DETAIL:  Reason code: Canceled on identification as a pivot, during write.
2020-03-09 15:14:36.476 UTC session-5e665804.1eb tx-98022: HINT:  The transaction might succeed if retried.
2020-03-09 15:14:36.476 UTC session-5e665804.1eb tx-98022: STATEMENT:  
              insert into pages3 (
                site_id,
                page_id,

2020-03-09 15:20:11.012 UTC session-5e665804.1eb tx-98392: ERROR:  could not serialize access due to read/write dependencies among transactions
2020-03-09 15:20:11.012 UTC session-5e665804.1eb tx-98392: DETAIL:  Reason code: Canceled on identification as a pivot, during write.
2020-03-09 15:20:11.012 UTC session-5e665804.1eb tx-98392: HINT:  The transaction might succeed if retried.
2020-03-09 15:20:11.012 UTC session-5e665804.1eb tx-98392: STATEMENT:  
              update pages3 set
                version = $1,
                PAGE_ROLE = $2,
                category_id = $3,
                EMBEDDING_PAGE_URL = $4,
                author_id = $5,
                UPDATED_AT = greatest(created_at, $6),

2020-03-09 15:20:58.349 UTC session-5e665804.1eb tx-98448: ERROR:  could not serialize access due to read/write dependencies among transactions
2020-03-09 15:20:58.349 UTC session-5e665804.1eb tx-98448: DETAIL:  Reason code: Canceled on identification as a pivot, during conflict out checking.
2020-03-09 15:20:58.349 UTC session-5e665804.1eb tx-98448: HINT:  The transaction might succeed if retried.
2020-03-09 15:20:58.349 UTC session-5e665804.1eb tx-98448: STATEMENT:  
              select unique_post_id, page_id, post_nr, type, created_at, created_by_id
              from post_actions3
              where site_id = $1 and page_id = $2 

2020-03-09 15:33:00.317 UTC session-5e665efd.248 tx-98891: ERROR:  could not serialize access due to read/write dependencies among transactions
2020-03-09 15:33:00.317 UTC session-5e665efd.248 tx-98891: DETAIL:  Reason code: Canceled on identification as a pivot, during write.
2020-03-09 15:33:00.317 UTC session-5e665efd.248 tx-98891: HINT:  The transaction might succeed if retried.
2020-03-09 15:33:00.317 UTC session-5e665efd.248 tx-98891: STATEMENT:  
              update pages3 set
                version = $1,
                PAGE_ROLE = $2,
                category_id = $3,

2020-03-09 15:54:49.506 UTC session-5e6665de.29d tx-100416: ERROR:  could not serialize access due to read/write dependencies among transactions
2020-03-09 15:54:49.506 UTC session-5e6665de.29d tx-100416: DETAIL:  Reason code: Canceled on identification as a pivot, during write.
2020-03-09 15:54:49.506 UTC session-5e6665de.29d tx-100416: HINT:  The transaction might succeed if retried.
2020-03-09 15:54:49.506 UTC session-5e6665de.29d tx-100416: STATEMENT:  
              insert into pages3 (
                site_id,
                page_id,
                ext_id,
                version,

          org.postgresql.util.PSQLException: ERROR: could not serialize access due to read/write dependencies among transactions
            Detail: Reason code: Canceled on identification as a pivot, during write.
            Hint: The transaction might succeed if retried.
            at org.postgresql.core.v3.QueryExecutorImpl.receiveErrorResponse(QueryExecutorImpl.java:2440)
            at org.postgresql.core.v3.QueryExecutorImpl.processResults(QueryExecutorImpl.java:2183)
            at org.postgresql.core.v3.QueryExecutorImpl.execute(QueryExecutorImpl.java:308)
            at org.postgresql.jdbc.PgStatement.executeInternal(PgStatement.java:441)
            at org.postgresql.jdbc.PgStatement.execute(PgStatement.java:365)
            at org.postgresql.jdbc.PgPreparedStatement.executeWithFlags(PgPreparedStatement.java:150)
            at org.postgresql.jdbc.PgPreparedStatement.executeUpdate(PgPreparedStatement.java:127)
            at com.zaxxer.hikari.pool.ProxyPreparedStatement.executeUpdate(ProxyPreparedStatement.java:61)
            at com.zaxxer.hikari.pool.HikariProxyPreparedStatement.executeUpdate(HikariProxyPreparedStatement.java)
            at com.debiki.dao.rdb.Rdb.execImpl(Rdb.scala:494)
            at com.debiki.dao.rdb.Rdb.update(Rdb.scala:454)
            at com.debiki.dao.rdb.RdbSiteTransaction._updatePageMeta(RdbSiteTransaction.scala:636)
            at com.debiki.dao.rdb.RdbSiteTransaction.$anonfun$updatePageMetaImpl$1(RdbSiteTransaction.scala:524)
            at com.debiki.dao.rdb.RdbSiteTransaction.$anonfun$updatePageMetaImpl$1$adapted(RdbSiteTransaction.scala:516)
            at com.debiki.dao.rdb.RdbSiteTransaction.$anonfun$transactionCheckQuota$1(RdbSiteTransaction.scala:140)
            at scala.Option.foreach(Option.scala:274)
            at com.debiki.dao.rdb.RdbSiteTransaction.transactionCheckQuota(RdbSiteTransaction.scala:138)
            at com.debiki.dao.rdb.RdbSiteTransaction.updatePageMetaImpl(RdbSiteTransaction.scala:516)
            at com.debiki.core.SiteTransaction.updatePageMeta(SiteTransaction.scala:269)
            at com.debiki.core.SiteTransaction.updatePageMeta$(SiteTransaction.scala:266)
            at com.debiki.dao.rdb.RdbSiteTransaction.updatePageMeta(RdbSiteTransaction.scala:38)
            at debiki.dao.PostsDao.insertReplyImpl(PostsDao.scala:256)
            at debiki.dao.PostsDao.insertReplyImpl$(PostsDao.scala:102)
            at debiki.dao.SiteDao.insertReplyImpl(SiteDao.scala:86)
            at debiki.dao.ForumDao.createForumCategories(ForumDao.scala:405)
            at debiki.dao.ForumDao.createDefaultCategoriesAndTopics(ForumDao.scala:208)
            at debiki.dao.ForumDao.$anonfun$createForum$1(ForumDao.scala:113)
            at debiki.dao.SiteDao.$anonfun$readWriteTransaction$2(SiteDao.scala:199)
            at com.debiki.core.DbDao2.readWriteSiteTransaction(DbDao2.scala:67)
            at debiki.dao.SiteDao.$anonfun$readWriteTransaction$1(SiteDao.scala:199)
            at debiki.dao.SiteDao$.synchronizeOnSiteId(SiteDao.scala:543)
            at debiki.dao.SiteDao.readWriteTransaction(SiteDao.scala:198)
            at debiki.dao.ForumDao.createForum(ForumDao.scala:68)
            at debiki.dao.ForumDao.createForum$(ForumDao.scala:64)
            at debiki.dao.SiteDao.createForum(SiteDao.scala:86)
            at controllers.ForumController.$anonfun$createForum$1(ForumController.scala:70)
            */

        logMessage(`Creating the forum ...`);
        api.waitAndClick('#e2eDoCreateForum');
        logMessage(`Waiting for title ...`);
        const actualTitle = api.waitAndGetVisibleText('h1.dw-p-ttl');
        logMessage(`Done? The forum title is: "${actualTitle}"`);
        assert.equal(actualTitle, forumTitle);
      },
    },


    topbar: {
      isVisible: (): boolean => {
        return browser.isVisible('.esTopbar');
      },

      waitForVisible: function() {  // old name? use waitForMyMenuVisible instead only?
        api.topbar.waitForMyMenuVisible();
      },

      waitForMyMenuVisible: function() {  // RENAME to waitForMyMenuButtonVisible?
        api.waitForVisible('.esMyMenu');
      },

      clickBack: function() {
        api.repeatUntilAtNewUrl(() => {
          api.waitAndClick('.esTopbar_custom_backToSite');
        });
      },

      clickHome: function() {
        if (browser.isVisible('.esLegal_home_link')) {
          api.rememberCurrentUrl();
          api.waitAndClick('.esLegal_home_link');
          api.waitForNewUrl();
        }
        else {
          // (Already waits for new url.)
          api.topbar.clickAncestor("Home");
        }
      },

      clickAncestor: function(categoryName: string) {
        api.repeatUntilAtNewUrl(() => {
          api.waitForThenClickText('.esTopbar_ancestors_link', categoryName);
        });
      },

      // COULD FASTER_E2E_TESTS can set  wait:false at most places
      assertMyUsernameMatches: function(username: string, ps: { wait?: boolean } = {}) {
        if (ps.wait !== false) {
          browser.waitForVisible('.esMyMenu .esAvtrName_name');
        }
        api.assertTextMatches('.esMyMenu .esAvtrName_name', username);
      },

      waitForNumPendingUrgentReviews: function(numUrgent: IntAtLeastOne) {
        assert(numUrgent >= 1, "Zero tasks won't ever become visible [TyE5GKRBQQ2]");
        api.waitUntilTextMatches('.esNotfIcon-reviewUrgent', '^' + numUrgent + '$');
      },

      waitForNumPendingOtherReviews: function(numOther: IntAtLeastOne) {
        assert(numOther >= 1, "Zero tasks won't ever become visible [TyE2WKBPJR3]");
        api.waitUntilTextMatches('.esNotfIcon-reviewOther', '^' + numOther + '$');
      },

      isNeedsReviewUrgentVisible: function() {
        return browser.isVisible('.esNotfIcon-reviewUrgent');
      },

      isNeedsReviewOtherVisible: function() {
        return browser.isVisible('.esNotfIcon-reviewOther');
      },

      getMyUsername: function() {
        return api.waitAndGetVisibleText('.esMyMenu .esAvtrName_name');
      },

      clickLogin: function() {
        api.waitAndClick('.esTopbar_logIn');
        api.waitUntilLoadingOverlayGone();
      },

      clickSignUp: function() {
        api.waitAndClick('.esTopbar_signUp');
        api.waitUntilLoadingOverlayGone();
      },

      clickLogout: function(options: { waitForLoginButton?: boolean } = {}) {   // RENAME to logout
        api.topbar.openMyMenu();
        api.waitAndClick('#e2eMM_Logout');
        api.waitAndClick('.e_ByeD .btn-primary');
        if (options.waitForLoginButton === false) {
          // Then a login dialog will probably have opened now in full screen, with a modal
          // backdrop, so don't wait for any backdrop to disappear.
          // Or we got redirected to an SSO login window.
        } else {
          api.waitUntilModalGone();
          api.topbar.waitUntilLoginButtonVisible();
        }
        // If on a users profile page, might start reloading something (because different user & perms).
        api.waitUntilLoadingOverlayGone();
      },

      waitUntilLoginButtonVisible: function() {
        api.waitForVisible('.esTopbar_logIn');
      },

      openMyMenu: function() {
        api.waitAndClick('.esMyMenu');
        api.waitUntilLoadingOverlayGone();
        // Because of a bug in Chrome? Chromedriver? Selenium? Webdriver.io? wait-and-click
        // attempts to click instantly, before the show-menu anim has completed and the elem
        // has appeared. So pause for a short while. [E2EBUG]
        browser.pause(333);
      },

      closeMyMenuIfOpen: () => {
        if (browser.isVisible('.s_MM .esDropModal_CloseB')) {
          api.waitAndClick('.s_MM .esDropModal_CloseB');
          api.waitForGone('.s_MM .esDropModal_CloseB');
        }
      },

      clickGoToAdmin: function() {
        api.rememberCurrentUrl();
        api.topbar.openMyMenu();
        api.waitAndClick('.esMyMenu_admin a');
        api.waitForNewUrl();
        api.waitUntilLoadingOverlayGone();
      },

      navigateToGroups: () => {
        api.rememberCurrentUrl();
        api.topbar.openMyMenu();
        api.waitAndClick('#te_VwGrps');
        api.waitForNewUrl();
        api.groupListPage.waitUntilLoaded();
      },

      clickGoToProfile: function() {
        api.rememberCurrentUrl();
        api.topbar.openMyMenu();
        api.waitAndClick('#e2eMM_Profile');
        api.waitForNewUrl();
        api.waitForVisible(api.userProfilePage.avatarAboutButtonsSelector);
      },

      clickStopImpersonating: function() {
        let oldName = api.topbar.getMyUsername();
        let newName;
        api.topbar.openMyMenu();
        api.waitAndClick('.s_MM_StopImpB');
        // Wait for page to reload:
        api.waitForGone('.s_MMB-IsImp');  // first, page reloads: the is-impersonating mark, disappears
        api.waitForVisible('.esMyMenu');  // then the page reappears
        do {
          newName = api.topbar.getMyUsername();
        }
        while (oldName === newName);
      },

      searchFor: function(phrase: string) {
        api.waitAndClick('.esTB_SearchBtn');
        // The search text field should grab focus, so we can just start typing:
        // But this causes a "RuntimeError" in Webdriver.io v4:
        // browser.keys(phrase);
        // This works though (although won't test if has focus):
        api.waitAndSetValue('.esTB_SearchD input[name="q"]', phrase);
        api.waitAndClick('.e_SearchB');
        api.searchResultsPage.waitForResults(phrase);
      },

      assertNotfToMe: function() {
        assert(browser.isVisible('.esTopbar .esNotfIcon-toMe'));
      },

      notfsToMeClass: '.esTopbar .esNotfIcon-toMe',
      otherNotfsClass: '.esTopbar .esNotfIcon-toOthers',

      waitForNumDirectNotfs: function(numNotfs: IntAtLeastOne) {
        assert(numNotfs >= 1, "Zero notfs won't ever become visible [TyE5GKRBQQ03]");
        api.waitUntilTextMatches(api.topbar.notfsToMeClass, '^' + numNotfs + '$');
      },

      waitForNoDirectNotfs: function() {
        api.waitForGone(api.topbar.notfsToMeClass);
      },

      waitForNumOtherNotfs: function(numNotfs: IntAtLeastOne) {
        assert(numNotfs >= 1, "Zero notfs won't ever become visible [TyE4ABKF024]");
        api.waitUntilTextMatches(api.topbar.otherNotfsClass, '^' + numNotfs + '$');
      },

      refreshUntilNumOtherNotfs: (desiredNumNotfs: number) => {
        const millisBetweenRefresh = 15*1000;  // should be > report to server interval [6AK2WX0G]
        let millisLeftToRefresh = millisBetweenRefresh;
        while (true) {
          let isWhat;
          if (desiredNumNotfs === 0) {
            if (!browser.isVisible(api.topbar.otherNotfsClass)) {
              break;
            }
            isWhat = '>= 1';
          }
          else {
            const text = api.waitAndGetVisibleText(api.topbar.otherNotfsClass);
            const actualNumNotfs = parseInt(text);
            if (actualNumNotfs === desiredNumNotfs) {
              break;
            }
            isWhat = '' + actualNumNotfs;
          }
          const pauseMs = 1000;
          browser.pause(pauseMs);

          // Because of some race condition, in rare cases, notifications won't get marked
          // as seen. Hard to reproduce, only happens 1 in 10 in invisible e2e tests.
          // For now, do this:
          millisLeftToRefresh -= pauseMs;
          if (millisLeftToRefresh < 0) {
            logUnusual(`Refreshing page. Num-other-notfs count is currently ${isWhat} ` +
                `and refuses to become ${desiredNumNotfs}...`);
            browser.refresh();
            millisLeftToRefresh = millisBetweenRefresh;
          }
        }
      },

      waitForNoOtherNotfs: function() {
        api.waitForGone(api.topbar.otherNotfsClass);
      },

      openNotfToMe: function(options: { waitForNewUrl?: boolean } = {}) {
        api.topbar.openLatestNotf(options);
      },

      openLatestNotf: function(options: { waitForNewUrl?: boolean, toMe?: true } = {}) {
        api.topbar.openMyMenu();
        api.rememberCurrentUrl();
        api.waitAndClickFirst('.s_MM .dropdown-menu ' + (options.toMe ? '.esNotf-toMe' : '.esNotf'));
        if (options.waitForNewUrl !== false) {
          api.waitForNewUrl();
        }
      },

      viewAsStranger: function() {
        api.topbar.openMyMenu();
        api.waitAndClick('.s_MM_ViewAsB');
        // Currently there's just one view-as button, namely to view-as-stranger.
        api.waitAndClick('.s_VAD_Sbd button');
        // Now there's a warning, close it.
        api.stupidDialog.clickClose();
        // Then another stupid-dialog appears. Wait for a while so we won't click the
        // button in the first dialog, before it has disappeared.
        browser.pause(800);  // COULD give incrementing ids to the stupid dialogs,
                              // so can avoid this pause?
        api.stupidDialog.close();
      },

      stopViewingAsStranger: () => {
        api.topbar.openMyMenu();
        api.waitAndClick('.s_MM_StopImpB a');
      },

      myMenu: {
        goToAdminReview: () => {
          api.topbar.myMenu.goToImpl('#e2eMM_Review');
          api.adminArea.review.waitUntilLoaded();
        },

        goToDraftsEtc: () => {
          api.topbar.myMenu.goToImpl('.e_MyDfsB');
          api.userProfilePage.draftsEtc.waitUntilLoaded();
        },

        goToImpl: (selector: string) => {
          api.rememberCurrentUrl();
          api.topbar.openMyMenu();
          api.waitAndClick(selector);
          api.waitForNewUrl();
        },

        dismNotfsBtnClass: '.e_DismNotfs',

        markAllNotfsRead: () => {
          api.topbar.openMyMenu();
          api.waitAndClick(api.topbar.myMenu.dismNotfsBtnClass);
        },

        isMarkAllNotfsReadVisibleOpenClose: (): boolean => {
          api.topbar.openMyMenu();
          api.waitForVisible('.s_MM_NotfsBs');  // (test code bug: sometimes absent — if 0 notfs)
          const isVisible = browser.isVisible(api.topbar.myMenu.dismNotfsBtnClass);
          api.topbar.closeMyMenuIfOpen();
          return isVisible;
        },
      },

      pageTools: {
        deletePage: () => {
          api.waitAndClick('.dw-a-tools');
          api.waitUntilDoesNotMove('.e_DelPg');
          api.waitAndClick('.e_DelPg');
          api.waitUntilModalGone();
          api.waitForVisible('.s_Pg_DdInf');
        },

        restorePage: () => {
          api.waitAndClick('.dw-a-tools');
          api.waitUntilDoesNotMove('.e_RstrPg');
          api.waitAndClick('.e_RstrPg');
          api.waitUntilModalGone();
          api.waitUntilGone('.s_Pg_DdInf');
        },
      },
    },


    watchbar: {
      titleSelector: '.esWB_T_Title',

      open: function() {
        api.waitAndClick('.esOpenWatchbarBtn');
        api.waitForVisible('#esWatchbarColumn');
      },

      openIfNeeded: function() {
        if (!browser.isVisible('#esWatchbarColumn')) {
          api.watchbar.open();
        }
      },

      close: function() {
        api.waitAndClick('.esWB_CloseB');
        api.waitUntilGone('#esWatchbarColumn');
      },

      waitForTopicVisible: (title: string) => {
        api.waitUntilAnyTextMatches(api.watchbar.titleSelector, title);
      },

      assertTopicVisible: function(title: string) {
        api.waitForVisible(api.watchbar.titleSelector);
        api.assertAnyTextMatches(api.watchbar.titleSelector, title);
      },

      assertTopicAbsent: function(title: string) {
        api.waitForVisible(api.watchbar.titleSelector);
        api.assertNoTextMatches(api.watchbar.titleSelector, title);
      },

      asserExactlyNumTopics: function(num: number) {
        if (num > 0) {
          api.waitForVisible(api.watchbar.titleSelector);
        }
        api.assertExactly(num, api.watchbar.titleSelector);
      },

      numUnreadTopics: (num: number): number => {
        return api.count('.esWB_T-Unread');
      },

      openUnreadTopic: (index: number = 1) => {
        dieIf(index !== 1, 'unimpl [TyE6927KTS]');
        api.repeatUntilAtNewUrl(() => {
          api.waitAndClick('.esWB_T-Unread');
        });
      },

      waitUntilNumUnreadTopics: (num: number) => {
        assert.ok(num > 0, 'TyE0578WNSYG');
        api.waitForAtLeast(num, '.esWB_T-Unread');
        api.assertExactly(num, '.esWB_T-Unread');
      },

      goToTopic: function(title: string, opts: { isHome?: true } = {}) {
        api.rememberCurrentUrl();
        api.waitForThenClickText(
            api.watchbar.titleSelector, opts.isHome ? c.WatchbarHomeLinkTitle : title);
        api.waitForNewUrl();
        api.assertPageTitleMatches(title);
      },

      clickCreateChat: function() {
        api.waitAndClick('#e2eCreateChatB');
      },

      clickCreateChatWaitForEditor: function() {
        api.waitAndClick('#e2eCreateChatB');
        api.waitForVisible('.esEdtr_titleEtc');
      },

      clickViewPeople: function() {
        api.waitAndClick('.esWB_T-Current .esWB_T_Link');
        api.waitAndClick('#e2eWB_ViewPeopleB');
        api.waitUntilModalGone();
        api.waitForVisible('.esCtxbar_list_title');
      },

      clickLeaveChat: function() {
        api.waitAndClick('.esWB_T-Current .esWB_T_Link');
        api.waitAndClick('#e2eWB_LeaveB');
        api.waitUntilModalGone();
        api.waitForVisible('#theJoinChatB');
      },
    },


    contextbar: {
      close: function() {
        api.waitAndClick('.esCtxbar_close');
        api.waitUntilGone('#esThisbarColumn');
      },

      clickAddPeople: function() {
        api.waitAndClick('#e2eCB_AddPeopleB');
        api.waitForVisible('#e2eAddUsD');
      },

      clickUser: function(username: string) {
        api.waitForThenClickText('.esCtxbar_list .esAvtrName_username', username);
      },

      assertUserPresent: function(username: string) {
        api.waitForVisible('.esCtxbar_onlineCol');
        api.waitForVisible('.esCtxbar_list .esAvtrName_username');
        var elems = $$('.esCtxbar_list .esAvtrName_username');
        var usernamesPresent = elems.map((elem) => {
          return elem.getText();
        });
        const namesPresent = usernamesPresent.join(', ');
        logMessage(`Users present: ${namesPresent}`)
        assert(usernamesPresent.length, "No users listed at all");
        assert(_.includes(usernamesPresent, username), "User missing: " + username +
            ", those present are: " + namesPresent);
      },
    },


    loginDialog: {
      refreshUntilFullScreen: function() {
        let startMs = Date.now();
        let dialogShown = false;
        let lap = 0;
        while (Date.now() - startMs < settings.waitforTimeout) {
          browser.refresh();
          // Give the page enough time to load:
          lap += 1;
          browser.pause(200 * Math.pow(1.5, lap));
          dialogShown = browser.isVisible('.dw-login-modal') && browser.isVisible('.esLD');
          if (dialogShown)
            break;
        }
        assert(dialogShown, "The login dialog never appeared");
        api.loginDialog.waitAssertFullScreen();
      },

      waitAssertFullScreen: function() {
        api.waitForVisible('.dw-login-modal');
        api.waitForVisible('.esLD');
        // Forum not shown.
        assert(!browser.isVisible('.dw-forum'));
        assert(!browser.isVisible('.dw-forum-actionbar'));
        // No forum topic shown.
        assert(!browser.isVisible('h1'));
        assert(!browser.isVisible('.dw-p'));
        assert(!browser.isVisible('.dw-p-ttl'));
        // Admin area not shown.
        assert(!browser.isVisible('.esTopbar_custom_backToSite'));
        assert(!browser.isVisible('#dw-react-admin-app'));
        // User profile not shown.
        assert(!browser.isVisible(api.userProfilePage.avatarAboutButtonsSelector));
      },

      clickSingleSignOnButton: () => {
        api.waitAndClick('.s_LD_SsoB');
      },

      waitForSingleSignOnButton: () => {
        browser.waitForVisible('.s_LD_SsoB');
      },

      createPasswordAccount: function(data: {
            fullName?: string,
            username: string,
            email?: string,
            emailAddress?: string,
            password: string,
            shallBecomeOwner?: true,       // default is false
            willNeedToVerifyEmail?: false, // default is true
           },
            // Legacy:
            shallBecomeOwner?: boolean,
            anyVerifyEmail?: 'THERE_WILL_BE_NO_VERIFY_EMAIL_DIALOG') {

        // Switch from the guest login form to the create-real-account form, if needed.
        api.waitForVisible('#e2eFullName');
        if (browser.isVisible('.s_LD_CreateAccount')) {
          api.waitAndClick('.s_LD_CreateAccount');
          api.waitForVisible('#e2ePassword');
        }

        // Dupl code (035BKAS20)

        logMessage('createPasswordAccount: fillInFullName...');
        if (data.fullName) api.loginDialog.fillInFullName(data.fullName);
        logMessage('fillInUsername...');
        api.loginDialog.fillInUsername(data.username);
        logMessage('fillInEmail...');
        const theEmail = data.email || data.emailAddress;
        if (theEmail) api.loginDialog.fillInEmail(theEmail);
        logMessage('fillInPassword...');
        api.loginDialog.fillInPassword(data.password);
        logMessage('clickSubmit...');
        api.loginDialog.clickSubmit();
        logMessage('acceptTerms...');
        api.loginDialog.acceptTerms(data.shallBecomeOwner || shallBecomeOwner);
        if (data.willNeedToVerifyEmail !== false &&
            anyVerifyEmail !== 'THERE_WILL_BE_NO_VERIFY_EMAIL_DIALOG') {
          logMessage('waitForNeedVerifyEmailDialog...');
          api.loginDialog.waitForNeedVerifyEmailDialog();
        }
        logMessage('createPasswordAccount: done');
      },

      fillInFullName: function(fullName) {
        api.waitAndSetValue('#e2eFullName', fullName);
      },

      fillInUsername: function(username) {
        api.waitAndSetValue('#e2eUsername', username);
      },

      fillInEmail: function(emailAddress) {
        api.waitAndSetValue('#e2eEmail', emailAddress);
      },

      waitForNeedVerifyEmailDialog: function() {
        api.waitForVisible('#e2eNeedVerifyEmailDialog');
      },

      waitForAndCloseWelcomeLoggedInDialog: function() {
        api.waitForVisible('#te_WelcomeLoggedIn');
        api.waitAndClick('#te_WelcomeLoggedIn button');
        api.waitUntilModalGone();
      },

      fillInPassword: function(password) {
        api.waitAndSetValue('#e2ePassword', password);
      },

      waitForBadLoginMessage: function() {
        api.waitForVisible('.esLoginDlg_badPwd');
      },

      loginWithPassword: (username: string | { username: string, password: string },
            password?, opts?: { resultInError?: boolean }) => {

        if (!opts && password && _.isObject(password)) {
          opts = <any> password;
          password = null;
        }
        if (_.isObject(username)) {
          dieIf(_.isString(password), 'TyE2AKBF053');
          password = username.password;
          username = username.username;
        }
        const numTabs = api.numTabs();
        api.loginDialog.tryLogin(username, password);
        if (opts && opts.resultInError)
          return;
        if (isWhere === IsWhere.LoginPopup) {
          // Wait for this login popup tab/window to close.
          api.waitForMaxBrowserTabs(numTabs - 1);
          api.switchBackToFirstTabIfNeeded();
        }
        else {
          api.waitUntilModalGone();
          api.waitUntilLoadingOverlayGone();
        }
      },

      loginWithEmailAndPassword: function(emailAddress: string, password: string, badLogin) {
        api.loginDialog.tryLogin(emailAddress, password);
        if (badLogin !== 'BAD_LOGIN') {
          api.waitUntilModalGone();
          api.waitUntilLoadingOverlayGone();
        }
      },

      // Embedded discussions do all logins in popups.
      loginWithPasswordInPopup:
          (username: string | { username: string, password: string }, password?: string) => {
        api.swithToOtherTabOrWindow(IsWhere.LoginPopup);
        api.disableRateLimits();
        if (_.isObject(username)) {
          password = username.password;
          username = username.username;
        }
        const numTabs = api.numTabs();
        api.loginDialog.tryLogin(username, password);
        // The popup auto closes after login.
        api.waitForMaxBrowserTabs(numTabs - 1);
        api.switchBackToFirstTabOrWindow();
      },

      loginButBadPassword: function(username: string, password: string) {
        api.loginDialog.tryLogin(username, password);
        api.waitForVisible('.esLoginDlg_badPwd');
      },

      tryLogin: function(username: string, password: string) {
        api.loginDialog.switchToLoginIfIsSignup();
        api.loginDialog.fillInUsername(username);
        api.loginDialog.fillInPassword(password);
        api.loginDialog.clickSubmit();
      },

      waitForEmailUnverifiedError: function() {
        api.waitUntilTextMatches('.modal-body', 'TyEEML0VERIF_');
      },

      waitForAccountSuspendedError: function() {
        api.waitUntilTextMatches('.modal-body', 'TyEUSRSSPNDD_');
      },

      waitForNotCreatedPasswordDialog: () => {
        api.waitForVisible('.e_NoPwD');
      },

      clickCreatePasswordButton: () => {
        api.waitAndClick('.e_NoPwD button');
      },

      signUpAsGuest: function(name: string, email?: string) { // CLEAN_UP use createPasswordAccount instead? [8JTW4]
        logMessage('createPasswordAccount with no email: fillInFullName...');
        api.loginDialog.fillInFullName(name);
        logMessage('fillInUsername...');
        const username = name.replace(/[ '-]+/g, '_').substr(0, 20);  // dupl code (7GKRW10)
        api.loginDialog.fillInUsername(username);
        if (email) {
          logMessage('fillInEmail...');
          api.loginDialog.fillInEmail(email);
        }
        else {
          logMessage('fillInEmail anyway, because for now, always require email [0KPS2J]');
          api.loginDialog.fillInEmail(`whatever-${Date.now()}@example.com`);
        }
        logMessage('fillInPassword...');
        api.loginDialog.fillInPassword("public1234");
        logMessage('clickSubmit...');
        api.loginDialog.clickSubmit();
        logMessage('acceptTerms...');
        api.loginDialog.acceptTerms();
        logMessage('waitForWelcomeLoggedInDialog...');
        api.loginDialog.waitForAndCloseWelcomeLoggedInDialog();
        logMessage('createPasswordAccount with no email: done');
        // Took forever: waitAndGetVisibleText, [CHROME_60_BUG]? [E2EBUG] ?
        const nameInHtml = api.waitAndGetText('.esTopbar .esAvtrName_name');
        assert(nameInHtml === username);
      },

      logInAsGuest: function(name: string, email_noLongerNeeded?: string) { // CLEAN_UP [8JTW4] is just pwd login?
        const username = name.replace(/[ '-]+/g, '_').substr(0, 20);  // dupl code (7GKRW10)
        logMessage('logInAsGuest: fillInFullName...');
        api.loginDialog.fillInUsername(name);
        logMessage('fillInPassword...');
        api.loginDialog.fillInPassword("public1234");
        logMessage('clickSubmit...');
        api.loginDialog.clickSubmit();
        logMessage('logInAsGuest with no email: done');
        const nameInHtml = api.waitAndGetVisibleText('.esTopbar .esAvtrName_name');
        dieIf(nameInHtml !== username, `Wrong username in topbar: ${nameInHtml} [EdE2WKG04]`);
      },

      // For guests, there's a combined signup and login form.
      signUpLogInAs_Real_Guest: function(name: string, email?: string) {  // RENAME remove '_Real_' [8JTW4]
        api.loginDialog.fillInFullName(name);
        if (email) {
          api.loginDialog.fillInEmail(email);
        }
        api.loginDialog.clickSubmit();
        api.loginDialog.acceptTerms(false);
      },

      clickCreateAccountInstead: function() {
        api.waitAndClick('.esLD_Switch_L');
        api.waitForVisible('.esCreateUser');
        api.waitForVisible('#e2eUsername');
        api.waitForVisible('#e2ePassword');
      },

      switchToLoginIfIsSignup: function() {
        // Switch to login form, if we're currently showing the signup form.
        while (true) {
          if (browser.isVisible('.esCreateUser')) {
            api.waitAndClick('.esLD_Switch_L');
            // Don't waitForVisible('.dw-reset-pswd') — that can hang forever (weird?).
          }
          else if (browser.isVisible('.dw-reset-pswd')) {
            // Then the login form is shown, fine.
            break;
          }
          browser.pause(PollMs);
        }
      },


      createGmailAccount: function(data: { email: string, password: string, username: string },
            ps: { isInPopupAlready?: true, shallBecomeOwner?: boolean,
                anyWelcomeDialog?: string, isInFullScreenLogin?: boolean } = {}) {
        api.loginDialog.loginWithGmail(
              data, ps.isInPopupAlready, { isInFullScreenLogin: ps.isInFullScreenLogin });
        // This should be the first time we login with Gmail at this site, so we'll be asked
        // to choose a username.
        // Not just #e2eUsername, then might try to fill in the username in the create-password-
        // user fields which are still visible for a short moment. Dupl code (2QPKW02)
        logMessage("filling in username ...");
        api.waitAndSetValue('.esCreateUserDlg #e2eUsername', data.username, { checkAndRetry: true });
        api.loginDialog.clickSubmit();
        logMessage("accepting terms ...");
        api.loginDialog.acceptTerms(ps.shallBecomeOwner);
        if (ps.anyWelcomeDialog !== 'THERE_WILL_BE_NO_WELCOME_DIALOG') {
          logMessage("waiting for and clicking ok in welcome dialog...");
          api.loginDialog.waitAndClickOkInWelcomeDialog();
        }
        if (ps.isInPopupAlready) {
          // Then the whole popup will close, now. Don't wait for any dialogs in it to
          // close — that'd result in a 'window was already closed' error.
        }
        else if (ps.isInFullScreenLogin) {
          // Then, could wait for our username to appear in my-menu — but the other if
          // branches here don't do that (and shouldn't always do that, in case we're
          // in an embedded something). So don't do here too, for consistency?
        }
        else {
          logMessage("waiting for login dialogs to close ...");
          api.waitUntilModalGone();
          api.waitUntilLoadingOverlayGone();
        }
        logMessage("... done signing up with Gmail.");
      },

      loginWithGmail: function(data: { email: string, password: string },
            isInPopupAlready?: boolean,
            ps?: { stayInPopup?: boolean, isInFullScreenLogin?: boolean }) {
        // Pause or sometimes the click misses the button. Is the browser doing some re-layout?
        browser.pause(150);
        api.waitAndClick('#e2eLoginGoogle');
        ps = ps || {};

        // Switch to a login popup window that got opened, for Google:
        if (!isInPopupAlready && !ps.isInFullScreenLogin) {
          logMessage(`Switching to login popup ...`);
          api.swithToOtherTabOrWindow(IsWhere.External);
        }
        else {
          logMessage(`Already in popup, need not switch window.`);
        }

        const emailInputSelector = 'input[type="email"]';
        const emailNext = '#identifierNext';
        const passwordInputSelector = 'input[type="password"]';
        const passwordNext = '#passwordNext';

        // We'll get logged in immediately via Gmail, if we're already logged in to
        // one (and only one) Gmail account in the current browser. Wait for either
        // the Gmail login widgets to load, or for us to be back in Talkyard again.
        while (true) {
          if (ps.isInFullScreenLogin) {
            if (browser.isExisting('.dw-login-modal')) {
              // We're back in Talkyard.
              return;
            }
          }
          else if (api.loginDialog.loginPopupClosedBecauseAlreadyLoggedIn()) {
            // We're back in Talkyard.
            api.switchBackToFirstTabOrWindow();
            return;
          }
          try {
            if (browser.isExisting(emailInputSelector)) {
              // That's a Gmail login widget. Continue with Gmail login.
              break;
            }
          }
          catch (dummy) {
            logMessage(`didn't find ${emailInputSelector}, ` +
                "tab closed? already logged in? [EdM5PKWT0B]");
          }
          browser.pause(PollMs);
        }

        browser.pause(250);
        logMessage(`typing Gmail email: ${data.email}...`);
        api.waitAndSetValue(emailInputSelector, data.email, { checkAndRetry: true });

        browser.pause(500);
        if (browser.isExisting(emailNext)) {
          logMessage(`clicking ${emailNext}...`);
          api.waitAndClick(emailNext);
        }

        browser.pause(250);
        logMessage("typing Gmail password...");
        api.waitAndSetValue(passwordInputSelector, data.password, { checkAndRetry: true });

        browser.pause(500);
        if (browser.isExisting(passwordNext)) {
          logMessage(`clicking ${passwordNext}...`);
          api.waitAndClick(passwordNext);
        }

        /*
        api.waitAndClick('#signIn');
        api.waitForEnabled('#submit_approve_access');
        api.waitAndClick('#submit_approve_access'); */

        // If you need to verify you're a human:
        // browser.deb ug();

        if (!isInPopupAlready && (!ps || !ps.stayInPopup)) {
          logMessage("switching back to first tab...");
          api.switchBackToFirstTabOrWindow();
        }
      },


      createGitHubAccount: (ps: { username: string, password: string, shallBecomeOwner: boolean,
            anyWelcomeDialog?, alreadyLoggedInAtGitHub: boolean }) => {

        // This should fill in email (usually) and username (definitely).
        api.loginDialog.logInWithGitHub(ps);

        api.loginDialog.clickSubmit();
        api.loginDialog.acceptTerms(ps.shallBecomeOwner);
        if (ps.anyWelcomeDialog !== 'THERE_WILL_BE_NO_WELCOME_DIALOG') {
          api.loginDialog.waitAndClickOkInWelcomeDialog();
        }
        api.waitUntilModalGone();
        api.waitUntilLoadingOverlayGone();
      },

      logInWithGitHub: (ps: { username: string, password: string, alreadyLoggedInAtGitHub: boolean }) => {
        api.waitAndClick('#e2eLoginGitHub');

        if (ps.alreadyLoggedInAtGitHub) {
          // The GitHub login window will auto-log the user in an close directly.
          api.waitForVisible('.esCreateUserDlg');
          return;
        }

        //if (!isInPopupAlready)
        logMessage("Switching to GitHub login window...");
        api.swithToOtherTabOrWindow(IsWhere.External);

        browser.waitForVisible('.auth-form-body');
        api.waitAndSetValue('.auth-form-body #login_field', ps.username);
        browser.pause(340); // so less risk GitHub think this is a computer?
        api.waitAndSetValue('.auth-form-body #password', ps.password);
        browser.pause(340); // so less risk GitHub think this is a computer?
        api.waitAndClick('.auth-form-body input[type="submit"]');
        while (true) {
          browser.pause(200);
          try {
            if (browser.isVisible('#js-oauth-authorize-btn')) {
              logMessage("Authorizing Talkyard to handle this GitHub login ... [TyT4ABKR02F]");
              api.waitAndClick('#js-oauth-authorize-btn');
              break;
            }
          }
          catch (ex) {
            // This error should mean that the login window closed. We've clicked the Authorize
            // button in the past, already.
            break;
          }
        }
        logMessage("Switching back to first window...");
        api.switchBackToFirstTabOrWindow();
      },


      createFacebookAccount: function(data: { email: string, password: string, username: string },
            shallBecomeOwner?: boolean, anyWelcomeDialog?) {
        api.loginDialog.loginWithFacebook(data);
        // This should be the first time we login with Facebook at this site, so we'll be asked
        // to choose a username.
        // Not just #e2eUsername, then might try to fill in the username in the create-password-
        // user fields which are still visible for a short moment. Dupl code (2QPKW02)
        logMessage("typing Facebook user's new username...");
        api.waitAndSetValue('.esCreateUserDlg #e2eUsername', data.username);
        api.loginDialog.clickSubmit();
        api.loginDialog.acceptTerms(shallBecomeOwner);
        if (anyWelcomeDialog !== 'THERE_WILL_BE_NO_WELCOME_DIALOG') {
          api.loginDialog.waitAndClickOkInWelcomeDialog();
        }
        api.waitUntilModalGone();
        api.waitUntilLoadingOverlayGone();
      },

      loginWithFacebook: function(data: { email: string, password: string }, isInPopupAlready?: boolean) {
        // Pause or sometimes the click misses the button. Is the browser doing some re-layout?
        browser.pause(100);
        api.waitAndClick('#e2eLoginFacebook');

        // In Facebook's login popup window:
        if (!isInPopupAlready)
          api.swithToOtherTabOrWindow(IsWhere.External);

        // We'll get logged in immediately, if we're already logged in to Facebook. Wait for
        // a short while to find out what'll happen.
        while (true) {
          if (api.loginDialog.loginPopupClosedBecauseAlreadyLoggedIn()) {
            api.switchBackToFirstTabOrWindow();
            return;
          }
          try {
            if (browser.isExisting('#email'))
              break;
          }
          catch (dummy) {
            logMessage("didn't find #email, tab closed? already logged in? [EdM5PKWT0]");
          }
          browser.pause(300);
        }

        logMessage("typing Facebook user's email and password...");
        browser.pause(340); // so less risk Facebook think this is a computer?
        api.waitAndSetValue('#email', data.email);
        browser.pause(380);
        api.waitAndSetValue('#pass', data.password);
        browser.pause(280);

        // Facebook recently changed from <input> to <button>. So just find anything with type=submit.
        logMessage("submitting Facebook login dialog...");
        api.waitAndClick('#loginbutton'); // or: [type=submit]');

        // Facebook somehow auto accepts the confirmation dialog, perhaps because
        // I'm using a Facebook API test user. So need not do this:
        //b.waitForVisible('[name=__CONFIRM__]');
        //b.click('[name=__CONFIRM__]');

        if (!isInPopupAlready) {
          logMessage("switching back to first tab...");
          api.switchBackToFirstTabOrWindow();
        }
      },


      createLinkedInAccount: function(ps: { email: string, password: string, username: string,
        shallBecomeOwner: boolean, alreadyLoggedInAtLinkedIn: boolean }) {
        api.loginDialog.loginWithLinkedIn({
          email: ps.email,
          password: ps.password,
          alreadyLoggedIn: ps.alreadyLoggedInAtLinkedIn,
        });
        // This should be the first time we login with LinkedInd at this site, so we'll be asked
        // to choose a username.
        // Not just #e2eUsername, then might try to fill in the username in the create-password-
        // user fields which are still visible for a short moment. Dupl code (2QPKW02)
        logMessage("typing LinkedIn user's new username...");
        api.waitAndSetValue('.esCreateUserDlg #e2eUsername', ps.username);
        api.loginDialog.clickSubmit();
        api.loginDialog.acceptTerms(ps.shallBecomeOwner);
        // LinkedIn email addresses might not have been verified (or?) so need
        // to click an email addr verif link.
        const siteId = api.getSiteId();
        const link = server.getLastVerifyEmailAddressLinkEmailedTo(siteId, ps.email, browser);
        api.go2(link);
        api.waitAndClick('#e2eContinue');
      },


      loginWithLinkedIn: function(data: { email: string, password: string,
            alreadyLoggedIn?: boolean, isInPopupAlready?: boolean }) {
        // Pause or sometimes the click misses the button. Is the browser doing some re-layout?
        browser.pause(100);
        api.waitAndClick('#e2eLoginLinkedIn');

        // Switch to LinkedIn's login popup window.
        if (!data.isInPopupAlready)
          api.swithToOtherTabOrWindow(IsWhere.External);

        // Wait until popup window done loading.
        while (true) {
          if (api.loginDialog.loginPopupClosedBecauseAlreadyLoggedIn()) {
            api.switchBackToFirstTabOrWindow();
            return;
          }
          try {
            if (browser.isExisting('input#username'))
              break;
          }
          catch (dummy) {
            logMessage("Didn't find input#username. Tab closed because already logged in?");
          }
          browser.pause(300);
        }

        logMessage("typing LinkedIn user's email and password...");
        browser.pause(340); // so less risk LinkedIn thinks this is a computer?
        // This is over at LinkedIn, and, as username, one can type one's email.
        api.waitAndSetValue('#username', data.email);
        browser.pause(380);
        api.waitAndSetValue('#password', data.password);
        browser.pause(280);

        logMessage("submitting LinkedIn login dialog...");
        api.waitAndClick('button[type="submit"]');

        // If needed, confirm permissions: click an Allow button.
        try {
          for (let i = 0; i < 10; ++i) {
            if (browser.isVisible('#oauth__auth-form__submit-btn')) {
              api.waitAndClick('#oauth__auth-form__submit-btn');
            }
            else {
              const url = browser.getUrl();
              if (url.indexOf('linkedin.com') === -1) {
                logMessage("Didn't need to click any Allow button: Left linkedin.com");
                break;
              }
            }
          }
        }
        catch (ex) {
          logMessage("Didn't need to click Allow button: Exception caught, login popup closed itself?");
          logException(ex);
        }

        if (!data.isInPopupAlready) {
          logMessage("switching back to first tab...");
          api.switchBackToFirstTabOrWindow();
        }
      },

      loginPopupClosedBecauseAlreadyLoggedIn: () => {
        try {
          logMessage("checking if we got logged in instantly... [EdM2PG44Y0]");
          const yes = browser.getTabIds().length === 1;// ||  // login tab was auto closed
              //browser.isExisting('.e_AlreadyLoggedIn');    // server shows logged-in-already page
              //  ^--- sometimes blocks forever, how is that possible?
          logMessage(yes ? "yes seems so" : "no don't think so");
          return yes;
        }
        catch (dummy) {
          // This is usually/always (?) a """org.openqa.selenium.NoSuchWindowException:
          // no such window: target window already closed""" exception, which means we're
          // logged in already and the OAuth provider (Google/Facebook/etc) closed the login tab.
          logMessage("apparently we got logged in directly [EdM2GJGQ03]");
          return true;
        }
      },

      waitAndClickOkInWelcomeDialog: function() {
        api.waitAndClick('#te_WelcomeLoggedIn .btn');
      },

      clickResetPasswordCloseDialogSwitchTab: function() {
        // This click opens a new tab.
        api.waitAndClick('.dw-reset-pswd');
        // The login dialog should close when we click the reset-password link. [5KWE02X]
        api.waitUntilModalGone();
        api.waitUntilLoadingOverlayGone();
        api.swithToOtherTabOrWindow();
        api.waitForVisible('#e2eRPP_emailI');
      },

      clickSubmit: function() {
        api.waitAndClick('#e2eSubmit');
      },

      clickCancel: function() {
        api.waitAndClick('#e2eLD_Cancel');
        api.waitUntilModalGone();
      },

      acceptTerms: function(isForSiteOwner?: boolean) {
        api.waitForVisible('#e_TermsL');
        api.waitForVisible('#e_PrivacyL');
        const termsLinkHtml = browser.getHTML('#e_TermsL');
        const privacyLinkHtml = browser.getHTML('#e_PrivacyL');
        if (isForSiteOwner) {
          // In dev-test, the below dummy urls are defined [5ADS24], but not in prod.
          if (!settings.prod) {
            assert(termsLinkHtml.indexOf('href="/e2e-test-siteOwnerTermsUrl"') >= 0);
            assert(privacyLinkHtml.indexOf('href="/e2e-test-siteOwnerPrivacyUrl"') >= 0);
          }
        }
        else if (isForSiteOwner === false) {
          assert(termsLinkHtml.indexOf('/-/terms-of-use') >= 0);
          assert(privacyLinkHtml.indexOf('/-/privacy-policy') >= 0);
        }
        setCheckbox('.s_TermsD_CB input', true);
        api.waitAndClick('.s_TermsD_B');
      },

      reopenToClearAnyError: function() {
        api.loginDialog.clickCancel();
        api.topbar.clickLogin();
      },
    },


    resetPasswordPage: {
      submitAccountOwnerEmailAddress: function(emailAddress: string) {
        logBoring(`Types email address ...`);
        api.resetPasswordPage.fillInAccountOwnerEmailAddress(emailAddress);
        api.rememberCurrentUrl();
        logBoring(`Submits ...`);
        api.resetPasswordPage.clickSubmit();
        logBoring(`Waits for confirmation that a password reset email got sent ...`);
        api.waitForNewUrl();
        api.waitForVisible('#e2eRPP_ResetEmailSent');
        logBoring(`... Done`);
      },

      fillInAccountOwnerEmailAddress: function(emailAddress: string) {
        api.waitAndSetValue('#e2eRPP_emailI', emailAddress);
      },

      clickSubmit: function() {
        api.waitAndClick('#e2eRPP_SubmitB');
      },
    },


    chooseNewPasswordPage: {
      typeAndSaveNewPassword: (password: string, opts: { oldPassword?: string } = {}) => {
        api.chooseNewPasswordPage.typeNewPassword(password);
        if (!opts.oldPassword) {
          // There's a <span> with the below class, just to show this test that there's
          // no type-old-password input field.
          assert(browser.isExisting('.e_NoOldPwI'));
        }
        api.chooseNewPasswordPage.submit();
        api.chooseNewPasswordPage.waitUntilPasswordChanged();
      },

      typeNewPassword: (password: string) => {
        api.waitAndSetValue('#e2ePassword', password);
      },

      submit: () => {
        api.waitAndClick('.e_SbmNewPwB');
      },

      waitUntilPasswordChanged: () => {
        // Stays at the same url.
        api.waitForVisible("#e2eRPP_PasswordChanged");
      },

      navToHomepage: () => {
        logMessage("Following homepage link...");
        api.repeatUntilAtNewUrl(() => {
          api.waitAndClick('a[href="/"]');
        });
      },
    },


    pageTitle: {
      clickEdit: function() {
        api.waitAndClick('#e2eEditTitle');
      },

      editTitle: function(title: string) {
        api.waitAndSetValue('#e2eTitleInput', title);
      },

      save: function() {
        api.waitAndClick('.e_Ttl_SaveB');
        api.pageTitle.waitForVisible();
      },

      waitForVisible: function() {
        api.waitForVisible('.dw-p-ttl h1');
      },

      openAboutAuthorDialog: function() {
        const selector = '.dw-ar-p-hd .esP_By';
        api.waitForVisible(selector);
        api.topic.clickPostActionButton(selector);
        api.waitForVisible('.esUsrDlg');
      },

      assertMatches: function(regex: string | RegExp) {
        api.assertPageTitleMatches(regex);
      },

      // Also see api.assertWholePageHidden().
      assertPageHidden: function() {
        api.pageTitle.waitForVisible();
        assert(browser.isVisible('.dw-p-ttl .icon-eye-off'));
      },

      assertPageNotHidden: function() {
        api.pageTitle.waitForVisible();
        assert(!browser.isVisible('.dw-p-ttl .icon-eye-off'));
      },

      __changePageButtonSelector: '.dw-p-ttl .dw-clickable',

      openChangePageDialog: function() {
        api.waitAndClick(api.pageTitle.__changePageButtonSelector);
        api.topic.waitUntilChangePageDialogOpen();
      },

      canBumpPageStatus: function() {
        return browser.isVisible(api.pageTitle.__changePageButtonSelector);
      },
    },


    forumButtons: {
      clickEditIntroText: function() {
        api.waitAndClick('.esForumIntro_edit');
        api.waitAndClick('#e2eEID_EditIntroB');
        api.waitUntilModalGone();
      },

      clickRemoveIntroText: function() {
        api.waitAndClick('.esForumIntro_edit');
        api.waitAndClick('#e2eEID_RemoveIntroB');
        api.waitUntilModalGone();
      },

      clickViewCategories: function() {
        api.waitAndClick('#e_ViewCatsB');
      },

      viewTopics: function(ps: { waitForTopics?: false } = {}) {
        api.waitAndClick('#e2eViewTopicsB');
        if (ps.waitForTopics !== false) {
          api.forumTopicList.waitForTopics();
        }
      },

      clickViewNew: function() {
        api.waitAndClick('#e_SortNewB');
      },

      clickCreateCategory: function() {
        api.waitAndClick('#e2eCreateCategoryB');
      },

      clickEditCategory: function() {
        api.waitAndClick('.s_F_Ts_Cat_Edt');
        // Wait until slide-in animation done, otherwise subsequent clicks inside
        // the dialog might miss.
        api.waitForVisible('#t_CD_Tabs');
        api.waitUntilDoesNotMove('#t_CD_Tabs');
      },

      clickCreateTopic: function() {
        api.waitAndClick('#e2eCreateSth');
      },

      assertNoCreateTopicButton: function() {
        // Wait until the button bar has loaded.
        api.waitForVisible('#e_ViewCatsB');
        assert(!browser.isVisible('#e2eCreateSth'));
      },

      listDeletedTopics: function() {
        api.waitAndClick('.esForum_filterBtn');
        api.waitAndClick('.s_F_BB_TF_Dd');
        api.forumTopicList.waitForTopics();
      },
    },


    forumTopicList: {  // RENAME to topicList
      titleSelector: '.e2eTopicTitle a',  // <– remove, later: '.esF_TsL_T_Title',  CLEAN_UP
      hiddenTopicTitleSelector: '.e2eTopicTitle a.icon-eye-off',

      goHere: (ps: { origin?: string, categorySlug?: string } = {}) => {
        const origin = ps.origin || '';
        api.go(origin + '/latest/' + (ps.categorySlug || ''));
      },

      waitUntilKnowsIsEmpty: function() {
        api.waitForVisible('#e2eF_NoTopics');
      },

      waitForCategoryName: (name: string, ps: { isSubCategory?: true } = {}) => {
        const selector = ps.isSubCategory ? '.s_F_Ts_Cat_Ttl-SubCat' : '.s_F_Ts_Cat_Ttl';
        api.waitAndGetElemWithText(selector, name);
      },

      waitForTopics: function() {
        api.waitForVisible('.e2eF_T', { timeoutMs: 1000 });
      },

      waitForTopicVisible: (title: string) => {
        api.waitUntilAnyTextMatches(api.forumTopicList.titleSelector, title);
      },

      clickLoadMore: (opts: { mayScroll?: boolean } = {}) => {
        api.waitAndClick('.load-more', opts);
      },

      switchToCategory: (toCatName: string) => {
        api.waitAndClick('.esForum_catsDrop.s_F_Ts_Cat_Ttl');
        api.waitAndClickSelectorWithText('.s_F_BB_CsM a', toCatName);
        api.forumTopicList.waitForCategoryName(toCatName);
      },

      clickViewLatest: function() {
        api.waitAndClick('#e2eSortLatestB');
        api.waitUntilGone('.s_F_SI_TopB');
        // Means topics loaded.
        api.waitForVisible('.e_SrtOrdr-1'); // TopicSortOrder.BumpTime
      },

      viewNewest: function() {
        api.forumButtons.clickViewNew();
        api.waitUntilGone('.s_F_SI_TopB');
        // This means topics loaded:
        api.waitForVisible('.e_SrtOrdr-2'); // TopicSortOrder.CreatedAt
      },

      clickViewTop: function() {
        api.waitAndClick('#e2eSortTopB');
        api.waitForVisible('.s_F_SI_TopB');
        api.waitForVisible('.e_SrtOrdr-3'); // TopicSortOrder.ScoreAndBumpTime
      },

      openAboutUserDialogForUsername: function(username: string) {
        api.waitAndClickFirst(`.edAvtr[title^="${username}"]`);
      },

      goToTopic: (title: string) => {   // RENAME to navToTopic
        api.forumTopicList.navToTopic(title);
      },

      navToTopic: (title: string) => {
        api.rememberCurrentUrl();
        api.waitForThenClickText(api.forumTopicList.titleSelector, title);
        api.waitForNewUrl();
        api.assertPageTitleMatches(title);
      },

      assertNumVisible: (howMany: number, ps: { wait?: boolean } = {}) => {
        if (ps.wait) {
          api.forumTopicList.waitForTopics();
        }
        api.assertExactly(howMany, '.e2eTopicTitle');
      },

      assertTopicTitlesAreAndOrder: function(titles: string[]) {
        const els = <any> browser.$$(api.forumTopicList.titleSelector);
        for (let i = 0; i < titles.length; ++i) {
          const titleShouldBe = titles[i];
          const actualTitleElem = els[i];
          if (!actualTitleElem) {
            assert(false, `Title nr ${i} missing, should be: "${titleShouldBe}"`);
          }
          const actualTitle = actualTitleElem.getText();
          if (titleShouldBe !== actualTitle) {
            assert(false, `Title nr ${i} is: "${actualTitle}", should be: "${titleShouldBe}"`);
          }
        }
      },

      assertTopicVisible: function(title) {
        api.assertAnyTextMatches(api.forumTopicList.titleSelector, title, null, 'FAST');
        api.assertNoTextMatches(api.forumTopicList.hiddenTopicTitleSelector, title);
      },

      assertTopicNrVisible: function(nr: number, title: string) {
        api.assertNthTextMatches(api.forumTopicList.titleSelector, nr, title);
        api.assertNoTextMatches(api.forumTopicList.hiddenTopicTitleSelector, title);
      },

      assertTopicNotVisible: function(title) {
        api.assertNoTextMatches(api.forumTopicList.titleSelector, title);
      },

      assertTopicVisibleAsHidden: function(title) {
        api.assertAnyTextMatches(api.forumTopicList.hiddenTopicTitleSelector, title);
      },
    },


    forumCategoryList: {   // RENAME to categoryList
      categoryNameSelector: '.esForum_cats_cat .forum-title',
      subCategoryNameSelector: '.s_F_Cs_C_ChildCs_C',

      goHere: (origin?: string) => {
        api.go((origin || '') + '/categories');
        api.forumCategoryList.waitForCategories();
      },

      waitForCategories: function() {
        api.waitForVisible('.s_F_Cs');
      },

      waitForNumCategoriesVisible: (num: number) => {
        api.waitForAtLeast(num, api.forumCategoryList.categoryNameSelector);
      },

      namesOfVisibleCategories: (): string[] =>
        $$(api.forumCategoryList.categoryNameSelector).map(e => e.getText()),

      numCategoriesVisible: (): number =>
        $$(api.forumCategoryList.categoryNameSelector).length,

      numSubCategoriesVisible: (): number =>
        $$(api.forumCategoryList.subCategoryNameSelector).length,

      isCategoryVisible: function(categoryName: string): boolean {
        return api.isDisplayedWithText(
            api.forumCategoryList.categoryNameSelector, categoryName);
      },

      isSubCategoryVisible: function(categoryName: string): boolean {
        return api.isDisplayedWithText(
            api.forumCategoryList.subCategoryNameSelector, categoryName);
      },

      openCategory: function(categoryName: string) {
        api.forumCategoryList._openCategoryImpl(
            categoryName, api.forumCategoryList.categoryNameSelector);
      },

      openSubCategory: function(categoryName: string) {
        api.forumCategoryList._openCategoryImpl(
            categoryName, api.forumCategoryList.subCategoryNameSelector);
      },

      _openCategoryImpl: function(categoryName: string, selector: string) {
        api.repeatUntilAtNewUrl(() => {
          api.waitForThenClickText(selector, categoryName);
        });
        api.waitForVisible('.s_F_Ts_Cat_Ttl');
        const titleSelector = selector === api.forumCategoryList.subCategoryNameSelector
            ? '.s_F_Ts_Cat_Ttl-SubCat'
            : '.s_F_Ts_Cat_Ttl';
        api.assertTextMatches(titleSelector, categoryName);
      },

      // RENAME to setNotfLevelForCategoryNr?
      setCatNrNotfLevel: (categoryNr: number, notfLevel: PageNotfLevel) => {
        api.waitAndClickNth('.dw-notf-level', categoryNr);
        api.notfLevelDropdown.clickNotfLevel(notfLevel);
      },

      assertCategoryNotFoundOrMayNotAccess: function() {
        api.assertAnyTextMatches('.dw-forum', '_TyE0CAT');
      }
    },


    categoryDialog: {
      fillInFields: function(data: { name?: string, slug?: string,
            setAsDefault?: boolean, extId?: string }) {
        if (data.name) {
          api.waitAndSetValue('#e2eCatNameI', data.name);
        }
        if (data.slug) {
          api.waitAndClick('#e2eShowCatSlug');
          api.waitAndSetValue('#e2eCatSlug', data.slug);
        }
        if (data.setAsDefault) {
          api.waitAndClick('#e2eSetDefCat');
        }
        if (data.extId) {
          api.waitAndClick('#te_ShowExtId');
          api.waitAndSetValue('#te_CatExtId', data.extId);
        }
      },

      submit: function() {
        // ---- Some scroll-to-Save-button problem. So do a bit double scrolling.
        api.scrollIntoViewInPageColumn('#e2eSaveCatB')
        api.scrollToBottom();
        // ----
        api.waitAndClick('#e2eSaveCatB');
        api.waitUntilModalGone();
        api.waitUntilLoadingOverlayGone();
      },

      setCategoryUnlisted: function() {
        api.waitAndClick('#e_ShowUnlRBs');
        api.waitAndClick('.e_UnlCatRB input');
      },

      setTopicsUnlisted: function() {
        api.waitAndClick('#e_ShowUnlRBs');
        api.waitAndClick('.e_UnlTpcsRB input');
      },

      setNotUnlisted: function() {
        api.waitAndClick('#e_ShowUnlRBs');
        api.waitAndClick('.e_DontUnlRB input');
      },

      openSecurityTab: function() {
        api.waitAndClick('#t_CD_Tabs-tab-2');
        api.waitForVisible('.s_CD_Sec_AddB');
      },

      securityTab: {
        switchGroupFromTo(fromGroupName: string, toGroupName: string) {
          api.waitAndClickSelectorWithText('.s_PoP_Un button', fromGroupName);
          api.waitAndClickSelectorWithText('.esDropModal_content .esExplDrp_entry', toGroupName);
        },

        setMayCreate: function(groupId: UserId, may: boolean) {
          // For now, just click once
          api.waitAndClick(`.s_PoP-Grp-${groupId} .s_PoP_Ps_P_CrPg input`);
        },

        setMayReply: function(groupId: UserId, may: boolean) {
          // For now, just click once
          api.waitAndClick(`.s_PoP-Grp-${groupId} .s_PoP_Ps_P_Re input`);
        },

        setMaySee: function(groupId: UserId, may: boolean) {
          // For now, just click once
          api.waitAndClick(`.s_PoP-Grp-${groupId} .s_PoP_Ps_P_See input`);
        },
      }
    },


    aboutUserDialog: {
      waitForLoaded: () => {
        api.waitUntilLoadingOverlayGone();
        api.waitForEnabled('.s_UD .e_CloseB');
        api.waitUntilDoesNotMove('.s_UD .e_CloseB');
      },

      getUsername: (): string => {
        api.aboutUserDialog.waitForLoaded();
        return api.waitAndGetVisibleText('.s_UD_Un');
      },

      close: () => {
        api.aboutUserDialog.waitForLoaded();
        api.waitAndClick('.s_UD .e_CloseB');
        api.waitForGone('.s_UD');
        api.waitUntilModalGone();
      },

      clickSendMessage: () => {
        api.aboutUserDialog.waitForLoaded();
        api.rememberCurrentUrl();
        api.waitAndClick('#e2eUD_MessageB');
        api.waitForNewUrl();
        // Wait until new-message title can be edited.
        // For some reason, FF is so fast, so typing the title now after new page load, fails
        // the first time  [6AKBR45] [E2EBUG] — but only in an invisible browser, and within
        // fractions of a second after page load, so hard to fix. As of 2019-01.
        utils.tryManyTimes("Clearing the title field", 2, () => {
          api.editor.editTitle('');
        });
      },

      clickViewProfile: () => {
        api.aboutUserDialog.waitForLoaded();
        api.rememberCurrentUrl();
        api.waitAndClick('#e2eUD_ProfileB');
        api.waitForNewUrl();
      },

      clickRemoveFromPage: () => {
        api.aboutUserDialog.waitForLoaded();
        api.waitAndClick('#e2eUD_RemoveB');
        // Later: browser.waitUntilModalGone();
        // But for now:  [5FKE0WY2]
        api.waitForVisible('.esStupidDlg');
        browser.refresh();
      },
    },


    addUsersToPageDialog: {
      addOneUser: function(username: string) {
        api.waitAndClick('#e2eAddUsD .Select-placeholder');

        // Clicking Return = complicated!  Only + \n  works in FF:
        // The Select input is special: the <input> is occluded, but still works fine.
        api.waitAndSetValue('#e2eAddUsD .Select-input > input', username + '\n',
            { okayOccluders: '.Select-placeholder' });

        // Works in Chrome but not FF:
        // api.keys(['Return']);  — so we append \n above, work as a Return press.

        /* Need to?:
          if (browser.options.desiredCapabilities.browserName == "MicrosoftEdge")
            element.setValue(...);
            browser.keys("\uE007");
          others:
            element.setValue(`...\n`);
        } */

        // None of this works:  DELETE_LATER after year 2019?
        /*
        browser.keys(['Enter']);
        browser.keys('\n');
        browser.keys('(\ue007');
        browser.keys('\uE006');
        browser.actions([{
          "type": "key",
          //"id": "keyboard",
          "id": "keys",
          "actions": [
            { "type": "keyDown", "value": "Enter" },
            { "type": "keyUp", "value": "Enter" }
          ]
        }]);
        const result = browser.elementActive();
        const activeElement = result.value && result.value.ELEMENT;
        if(activeElement){
          browser.elementIdValue(activeElement, ['Return']);
        }
        const result = browser.elementActive();
        const activeElement = result.value && result.value.ELEMENT;
        if(activeElement){
          browser.elementIdValue(activeElement, '\uE006');
        } */

        // Weird. The react-select dropdown is open and needs to be closed, otherwise
        // a modal overlay hides everything? Can be closed like so:
        // No, now in rc.10 (instead of previous version, rc.3), the dropdown auto closes, after select.
        // browser.click('#e2eAddUsD_SubmitB');
      },

      submit: function(ps: { closeStupidDialogAndRefresh?: true } = {}) {
        api.waitAndClick('#e2eAddUsD_SubmitB');
        // Later: browser.waitUntilModalGone();
        // But for now:  [5FKE0WY2]
        if (ps.closeStupidDialogAndRefresh) {
          api.waitForVisible('.esStupidDlg');
          browser.refresh();
        }
      }
    },


    editor: {
      editTitle: function(title, opts: { checkAndRetry?: true } = {}) {
        api.waitAndSetValue('.esEdtr_titleEtc_title', title, opts);
      },

      isTitleVisible: function() {
        browser.waitForVisible('.editor-area');
        return browser.isVisible('.editor-area .esEdtr_titleEtc_title');
      },

      getTitle: (): string => {
        return $('.editor-area .esEdtr_titleEtc_title').getText();
      },

      waitForSimilarTopics: () => {
        api.waitForVisible('.s_E_SimlTpcs');
      },

      numSimilarTopics: (): number => {
        return api.count('.s_E_SimlTpcs_L_It');
      },

      isSimilarTopicTitlePresent: (title: string) => {
        const text = api.waitAndGetVisibleText('.s_E_SimlTpcs')
        return text.search(title) >= 0;
      },

      editText: function(text, opts: {
          timeoutMs?: number, checkAndRetry?: true, append?: boolean, skipWait?: true } = {}) {
        api.switchToEmbEditorIframeIfNeeded();
        api.waitAndSetValue('.esEdtr_textarea', text, opts);
      },

      getText: (): string => {
        return api.waitAndGetValue('.editor-area textarea');
      },

      setTopicType: function(type: PageRole) {
        let optionId = null;
        let needsClickMore = false;
        switch (type) {
          case c.TestPageRole.Discussion: optionId = '#te_DiscO'; break;
          case c.TestPageRole.Question: optionId = '#e2eTTD_QuestionO'; break;
          case c.TestPageRole.Problem: optionId = '#e2eTTD_ProblemO'; break;
          case c.TestPageRole.Idea: optionId = '#e2eTTD_IdeaO'; break;
          case c.TestPageRole.OpenChat: optionId = '#e2eTTD_OpenChatO'; break;
          case c.TestPageRole.PrivateChat: optionId = '#e2eTTD_PrivChatO'; break;
          case c.TestPageRole.Form: optionId = '#e2eTTD_FormO'; needsClickMore = true; break;
          case c.TestPageRole.WebPage: optionId = '#e2eTTD_WebPageO'; needsClickMore = true; break;
          default: die('Test unimpl [EsE4WK0UP]');
        }
        api.waitAndClick('.esTopicType_dropdown');
        if (needsClickMore) {
          api.waitAndClick('.esPageRole_showMore');
        }
        api.waitAndClick(optionId);
        api.waitUntilModalGone();
      },

      cancelNoHelp: function() {  // REMOVE just use cancel() now, help dialog removed
        const buttonSelector = '#debiki-editor-controller .e_EdCancelB';
        api.waitAndClick(buttonSelector);
        // waitForGone won't work — the editor just gets display:none but is still there.
        api.waitForNotVisible(buttonSelector);
      },

      cancel: function() {
        api.editor.cancelNoHelp();
      },

      closeIfOpen: function() {
        if (browser.isVisible('#debiki-editor-controller .e_EdCancelB')) {
          api.editor.cancel();
        }
      },

      switchToSimpleEditor: function() {
        api.waitAndClick('.e_EdCancelB'); // could use different class, weird name
        api.waitForVisible('.esC_Edtr');
      },

      save: function() {
        api.switchToEmbEditorIframeIfNeeded();
        api.editor.clickSave();
        api.waitUntilLoadingOverlayGone();
      },

      clickSave: function() {
        api.waitAndClick('.e_E_SaveB');
      },

      saveWaitForNewPage: function() {
        api.rememberCurrentUrl();
        api.editor.save();
        api.waitForNewUrl();
      },

      isDraftJustSaved: function() {
        browser.isVisible('.e_DfSts-' + c.TestDraftStatus.Saved);
      },

      waitForDraftSaved: function() {
        api.waitForVisible('.e_DfSts-' + c.TestDraftStatus.Saved);
      },

      waitForDraftSavedInBrowser: function() {
        api.waitForVisible('.e_DfSts-' + c.TestDraftStatus.SavedInBrowser);
      },

      waitForDraftDeleted: function() {
        api.waitForVisible('.e_DfSts-' + c.TestDraftStatus.Deleted);
      },

      waitForDraftTitleToLoad: function(text: string) {
        api.waitUntilValueIs('.editor-area .esEdtr_titleEtc_title', text);
      },

      waitForDraftTextToLoad: function(text: string) {
        api.waitUntilValueIs('.editor-area textarea', text);
      },
    },


    preview: {
      __inPagePreviewSelector: '.s_P-Prvw ',
      __inEditorPreviewSelector: '#t_E_Preview ', // '#debiki-editor-controller .preview ';

      waitForExist: (
            selector: string, opts: { where: 'InEditor' | 'InPage' }) => {
        if (opts.where === 'InEditor') {
          api.switchToEmbEditorIframeIfNeeded();
          api.waitForExist(api.preview.__inEditorPreviewSelector + selector);
        }
        else {
          api.switchToEmbCommentsIframeIfNeeded();
          api.waitForExist(api.preview.__inPagePreviewSelector + selector);
        }
      },

      waitUntilPreviewHtmlMatches: (
            text: string, opts: { where: 'InEditor' | 'InPage' }) => {
        if (opts.where === 'InEditor') {
          api.switchToEmbEditorIframeIfNeeded();
          api.waitUntilHtmlMatches(api.preview.__inEditorPreviewSelector, text);
        }
        else {
          api.switchToEmbCommentsIframeIfNeeded();
          api.waitUntilHtmlMatches(api.preview.__inPagePreviewSelector, text);
        }
      },
    },


    metabar: {
      isVisible: (): boolean => {
        return browser.isVisible('.dw-cmts-tlbr-summary');
      },

      clickLogin: () => {
        api.waitAndClick('.esMetabar .dw-a-login');
      },

      waitForLoginButtonVisible: () => {
        api.waitForVisible('.esMetabar .dw-a-login');
      },

      waitUntilLoggedIn: () => {
        api.waitForVisible('.dw-a-logout');
      },

      getMyFullName: (): string => {
        return api.waitAndGetVisibleText('.s_MB_Name .esP_By_F');
      },

      getMyUsernameInclAt: (): string => {
        return api.waitAndGetVisibleText('.s_MB_Name .esP_By_U');
      },

      clickLogout: () => {
        const wasInIframe = api.isInIframe();
        api.waitAndClick('.esMetabar .dw-a-logout');
        api.waitUntilGone('.esMetabar .dw-a-logout');
        // Is there a race? Any iframe might reload, after logout. Better re-enter it?
        // Otherwise the wait-for .esMetabar below can fail.
        if (wasInIframe) {
          api.switchToAnyParentFrame();
          api.switchToEmbeddedCommentsIrame();
        }
        api.waitForVisible('.esMetabar');
      },

      openMetabar: () => {
        api.waitAndClick('.dw-page-notf-level');
        api.waitForVisible('.esMB_Dtls_Ntfs_Lbl');
      },

      openMetabarIfNeeded: () => {
        if (!browser.isVisible('.esMB_Dtls_Ntfs_Lbl')) {
          api.metabar.openMetabar();
        }
      },

      chooseNotfLevelWatchAll: () => {
        api.waitAndClick('.dw-notf-level');
        api.waitAndClick('.e_NtfAll');
        api.waitForGone('.e_NtfAll');
      },

      setPageNotfLevel: (notfLevel: PageNotfLevel) => {
        api.switchToEmbCommentsIframeIfNeeded();
        api.metabar.openMetabarIfNeeded();
        api.waitAndClick('.dw-notf-level');
        api.notfLevelDropdown.clickNotfLevel(notfLevel);
      },
    },


    topic: {
      postBodySelector: (postNr: PostNr) => `#post-${postNr} .dw-p-bd`,

      forAllPostIndexNrElem: (fn: (index: number, postNr: PostNr, elem) => void) => {
        const postElems = $$('[id^="post-"]');
        for (let index = 0; index < postElems.length; ++index) {
          const elem = postElems[index];
          const idAttr = elem.getAttribute('id');
          const postNrStr: string = idAttr.replace('post-', '');
          const postNr: PostNr = parseInt(postNrStr);
          logBoring(`post elem id attr: ${idAttr}, nr: ${postNr}`);
          assert.equal(0, c.TitleNr);
          assert.equal(1, c.BodyNr);
          assert.equal(2, c.FirstReplyNr);
          // The title and body cannot be moved elsewhere on the page.
          if (postNr === c.TitleNr) assert.equal(index, c.TitleNr);
          if (postNr === c.BodyNr) assert.equal(index, c.BodyNr);
          fn(index, postNr, elem);
        }
      },

      clickHomeNavLink: function() {
        // api.waitAndClick() results in this error:
        //   Failed to execute 'querySelector' on 'Document':
        //   'a=Home' is not a valid selector.
        // Instead:
        $("a=Home").click();
      },

      waitForLoaded: function() {
        api.waitForVisible('.dw-ar-t');
      },

      assertPagePendingApprovalBodyHidden: function() {
        api.topic.waitForLoaded();
        assert(api.topic._isTitlePendingApprovalVisible());
        assert(api.topic._isOrigPostPendingApprovalVisible());
        assert(!api.topic._isOrigPostBodyVisible());
      },

      assertPagePendingApprovalBodyVisible: function() {
        api.topic.waitForLoaded();
        assert(api.topic._isTitlePendingApprovalVisible());
        assert(api.topic._isOrigPostPendingApprovalVisible());
        assert(api.topic._isOrigPostBodyVisible());
      },

      assertPageNotPendingApproval: function() {
        api.topic.waitForLoaded();
        assert(!api.topic._isOrigPostPendingApprovalVisible());
        assert(api.topic._isOrigPostBodyVisible());
      },

      isPostNrDescendantOf: function(postNr, maybeParentNr) {
        api.switchToEmbCommentsIframeIfNeeded();
        return browser.isVisible(
            `#post-${maybeParentNr} + .dw-p-as + .dw-single-and-multireplies #post-${postNr}`);
      },

      isPostNrVisible: function(postNr) {
        api.switchToEmbCommentsIframeIfNeeded();
        return browser.isVisible('#post-' + postNr);
      },

      waitForPostNrVisible: function(postNr) {  // RENAME to ...VisibleText?
        api.switchToEmbCommentsIframeIfNeeded();
        api.waitForVisibleText('#post-' + postNr);
      },

      waitForPostAssertTextMatches: function(postNr, text: string | RegExp) {
        dieIf(!_.isString(text) && !_.isRegExp(text),
            "Test broken: `text` is not a string nor a regex [TyEJ53068MSK]");
        api.switchToEmbCommentsIframeIfNeeded();
        api.waitForVisibleText(api.topic.postBodySelector(postNr));
        api.topic.assertPostTextMatches(postNr, text);
      },

      // waitUntilPostTextMatches — see below

      waitUntilPostHtmlMatches: (postNr, regexOrString: string | RegExp | any[]) => {
        const selector = api.topic.postBodySelector(postNr);
        api.waitUntilHtmlMatches(selector, regexOrString)
      },

      assertPostHtmlDoesNotMatch: (postNr, regexOrString: string | RegExp | any[]) => {
        const selector = api.topic.postBodySelector(postNr);
        const html = browser.getHTML(selector);
        const badMatch = api._findHtmlMatchMiss(html, false, regexOrString);
        if (badMatch) {
          assert(false,
              `Found text that shouldn't be there [TyE53DTEGJ4]:\n\n  ${badMatch}\n`);
        }
      },

      assertPostOrderIs: function(expectedPostNrs: PostNr[], selector: string = '[id^="post-"]') {
        dieIf(!expectedPostNrs || !expectedPostNrs.length, `No expected posts [TyEE062856]`);

        // Replace other dupl code with this fn.  [59SKEDT0652]
        api.switchToEmbCommentsIframeIfNeeded();
        api.waitForVisible(selector);

        const postElems = $$(selector);

        if (postElems.length >= expectedPostNrs.length) {
          logMessage(
            `Found ${postElems.length} posts on page, will compare the first` +
              `of them with ${expectedPostNrs.length} expeted posts. [TyE2ECMPPOSTS]`);
        }
        else {
          logWarning(
            `Too few posts: Found ${postElems.length} posts, ` +
                `expected >= ${expectedPostNrs.length}.` +
                `This test will fail. [TyEE2ETOOFEWPOSTSW]`);
          // Let's continue and compare those we *did* find, to make it simpler to
          // troubleshoot this apparently broken e2e test.
        }

        for (let i = 0; i < expectedPostNrs.length; ++i) {
          const expectedNr = expectedPostNrs[i];
          const postElem = postElems[i];

          tyAssert.ok(postElem && postElem.isExisting(),
              `Not enough posts on page to compare with ` +
              `expected post nr ${expectedNr} [TyEE2ETOOFEWPOSTSE]`);

          const idAttr = postElem.getAttribute('id');
          logMessage(`id attr: ${idAttr}, expected nr: ${expectedNr}`);
          tyAssert.eq(idAttr, `post-${expectedNr}`);
        }
      },

      postNrContains: function(postNr: PostNr, selector: string) {
        return browser.isExisting(api.topic.postBodySelector(postNr) + ' ' + selector);
      },

      postNrContainsVisible: function(postNr: PostNr, selector: string) {
        return browser.isVisible(api.topic.postBodySelector(postNr) + ' ' + selector);
      },

      assertPostTextMatches: function(postNr: PostNr, text: string | RegExp) {
        api.assertTextMatches(api.topic.postBodySelector(postNr), text)
      },

      waitUntilPostTextMatches: function(postNr: PostNr, regex: string | RegExp) {
        api.waitUntilTextMatches(api.topic.postBodySelector(postNr), regex);
      },

      refreshUntilPostNrAppears: function(postNr: PostNr,
            ps: { isEmbedded?: true, isMetaPost?: true } = {}) {
        if (ps.isEmbedded) api.switchToEmbeddedCommentsIrame();
        const selector = ps.isMetaPost
            ? `#post-${postNr} .s_MP_Text`
            : api.topic.postBodySelector(postNr);
        api.topic.refreshUntilAppears(selector, ps);
      },

      refreshUntilAppears: function(selector: string, ps: { isEmbedded?: true } = {}) {
        // Maybe use api.waitUntil()? But it's ok to call it from inside itself?
        let delayMs = RefreshPollMs;
        while (!browser.isVisible(selector)) {
          logMessage(`Refreshing page until appears:  ${selector}  [TyE2EMREFRWAIT]`);
          browser.refresh();
          // Pause *after* the refresh, so there's some time for the post to get loaded & appear.
          browser.pause(delayMs);
          // Give the thing more and more time to appear, after page reresh, in case
          // for whatever reason it won't show up immediately.
          delayMs = expBackoff(delayMs);
          if (ps.isEmbedded) api.switchToEmbeddedCommentsIrame();
        }
      },

      refreshUntilPostTextMatches: function(postNr: PostNr, regex: string | RegExp) {
        regex = getRegExpOrDie(regex);
        while (true) {
          const text = api.waitAndGetVisibleText(api.topic.postBodySelector(postNr));
          if (text.match(regex)) {
            break;
          }
          browser.pause(200);
          browser.refresh();
        }
      },

      assertMetaPostTextMatches: function(postNr: PostNr, text: string) {
        api.assertTextMatches(`#post-${postNr} .s_MP_Text`, text)
      },

      topLevelReplySelector: '.dw-depth-1 > .dw-p',
      replySelector: '.dw-depth-1 .dw-p',
      allRepliesTextSelector: '.dw-depth-0 > .dw-single-and-multireplies > .dw-res',
      anyCommentSelector: '.dw-p',
      anyReplyButtonSelector: '.dw-a-reply',
      addProgressReplySelector: '.s_OpReB-Prg',

      waitForReplyButtonAssertCommentsVisible: function() {
        api.waitForVisible(api.topic.anyReplyButtonSelector);
        assert(browser.isVisible(api.topic.anyCommentSelector));
      },

      waitForReplyButtonAssertNoComments: function() {
        api.waitForVisible(api.topic.anyReplyButtonSelector);
        assert(!browser.isVisible(api.topic.anyCommentSelector));
      },

      countReplies: (ps: { skipWait?: boolean } = {}): NumReplies => {
        if (!ps.skipWait) {
          api.waitForMyDataAdded();
        }
        let numNormal = api.count(api.topic.replySelector);
        const numUnapproved = api.count(api.topic.replySelector + '.dw-p-unapproved');
        const numDeleted = api.count(api.topic.replySelector + '.dw-p-dl');
        numNormal = numNormal - numUnapproved - numDeleted;
        return { numNormal, numUnapproved, numDeleted };
      },

      assertNumRepliesVisible: function(num: number) {
        api.waitForMyDataAdded();
        api.assertExactly(num, api.topic.replySelector);
      },

      assertNumOrigPostRepliesVisible: function(num: number) {
        api.waitForMyDataAdded();
        api.assertExactly(num, api.topic.topLevelReplySelector);
      },

      assertNoReplyMatches: function(text) {
        api.waitForMyDataAdded();
        api.assertNoTextMatches(api.topic.allRepliesTextSelector, text);
      },

      assertSomeReplyMatches: function(text) {
        api.waitForMyDataAdded();
        api.assertTextMatches(api.topic.allRepliesTextSelector, text);
      },

      assertNoAuthorMissing: function() {
        // There's this error code if a post author isn't included on the page.
        api.topic.assertNoReplyMatches("EsE4FK07_");
      },

      getTopicAuthorUsernameInclAt: function(): string {
        return api.waitAndGetVisibleText('.dw-ar-p-hd .esP_By_U');
      },

      clickFirstMentionOf: function(username: string) {
        browser.waitForVisible(`a.esMention=@${username}`);
        const elem = $(`a.esMention=@${username}`);
        elem.click();
      },

      clickReplyToOrigPost: function(whichButton?: 'DiscussionSection') {
        const selector = whichButton === 'DiscussionSection' ?
            '.s_OpReB-Dsc' : '.dw-ar-p + .esPA .dw-a-reply';
        api.topic.clickPostActionButton(selector);
      },

      clickReplyToEmbeddingBlogPost: function() {
        api.switchToEmbCommentsIframeIfNeeded();
        api.topic.clickPostActionButton('.dw-ar-t > .esPA .dw-a-reply');
      },

      clickReplyToPostNr: function(postNr: PostNr) {
        api.topic.clickPostActionButton(`#post-${postNr} + .esPA .dw-a-reply`);
      },

      clickAddProgressReply: function() {
        api._waitForClickable(api.topic.addProgressReplySelector);
        api.topic.clickPostActionButton(api.topic.addProgressReplySelector);
        // Dismiss any help dialog that explains what bottom comments are.
        browser.pause(150);
        if (browser.isVisible('.e_HelpOk')) {
          api.waitAndClick('.e_HelpOk');
          api.waitUntilModalGone();
        }
      },

      canEditSomething: function(): boolean {
        return browser.isVisible('.dw-a-edit');
      },

      canReplyToSomething: function(): boolean {
        return browser.isVisible('.dw-a-reply');
      },

      canEditOrigPost: function(): boolean {
        return api.topic.canEditPostNr(c.BodyNr);
      },

      canEditPostNr: function(postNr: number): boolean {
        const selector = `#post-${postNr} + .esPA .dw-a-edit`;
        return browser.isVisible(selector) && browser.isEnabled(selector);
      },

      clickEditOrigPost: function() {
        api.waitAndClick('.dw-ar-t > .dw-p-as .dw-a-edit');
      },

      clickEditoPostNr: function(postNr: PostNr) {
        api.topic.clickPostActionButton(`#post-${postNr} + .esPA .dw-a-edit`);
      },

      waitForViewEditsButton: (postNr: PostNr) => {
        api.waitForVisible(`#post-${postNr} .esP_viewHist`);
      },

      isViewEditsButtonVisible: (postNr: PostNr): boolean => {
        return browser.isVisible(`#post-${postNr} .esP_viewHist`);
      },

      openEditHistory: (postNr: PostNr) => {
        api.waitAndClick(`#post-${postNr} .esP_viewHist`);
        api.editHistoryDialog.waitUntilVisible();
      },

      clickMoreForPostNr: function(postNr: PostNr) {
        api.topic.clickPostActionButton(`#post-${postNr} + .esPA .dw-a-more`);
      },

      openShareDialogForPostNr: function(postNr: PostNr) {
        api.topic.clickPostActionButton(`#post-${postNr} + .esPA .dw-a-link`);
        api.waitForVisible('.s_ShareD');
      },

      openMoveDialogForPostNr: (postNr: PostNr) => {
        // This always works, when the tests are visible and I look at them.
        // But can block forever, in an invisible browser. Just repeat until works.
        utils.tryManyTimes("Open move post dialog", 3, () => {
          if (!browser.isVisible('.s_PA_MvB')) {
            api.topic.clickMoreForPostNr(postNr);
          }
          api.waitAndClick('.s_PA_MvB', { timeoutMs: 500 });
          api.waitForVisible('.s_MvPD', { timeoutMs: 500 });
        });
      },

      clickMoreVotesForPostNr: function(postNr: PostNr) {
        api.topic.clickPostActionButton(`#post-${postNr} + .esPA .dw-a-votes`);
      },

      makeLikeVoteSelector: (postNr: PostNr, ps: { byMe?: true } = {}): string => {
        // Embedded comments pages lack the orig post — instead, there's the
        // blog post, on the embedding page.
        const startSelector = isOnEmbeddedCommentsPage && postNr === c.BodyNr
            ? '.dw-ar-t > ' :`#post-${postNr} + `;
        let result = startSelector + '.esPA .dw-a-like';
        if (ps.byMe) result += '.dw-my-vote'
        return result;
      },

      clickLikeVote: function(postNr: PostNr, opts: { logInAs? } = {}) {
        const likeVoteSelector = api.topic.makeLikeVoteSelector(postNr);

        utils.tryUntilTrue("click Like", 3, () => {
          api.waitAndClick(likeVoteSelector);
          if (!opts.logInAs || !api.isInIframe())
            return true;
          // A login popup should open.
          browser.pause(200);
          const ids = browser.getTabIds();
          return ids.length >= 2;
        });

        if (opts.logInAs) {
          api.switchToLoginPopupIfEmbedded();
          api.loginDialog.loginWithPassword(opts.logInAs);
          api.switchToEmbCommentsIframeIfNeeded();
        }
      },

      clickLikeVoteForBlogPost: () => {
        api.switchToEmbCommentsIframeIfNeeded();
        api.waitAndClick('.dw-ar-t > .esPA > .dw-a-like');
      },

      toggleLikeVote: function(postNr: PostNr, opts: { logInAs? } = {}) {
        const likeVoteSelector = api.topic.makeLikeVoteSelector(postNr);
        api.switchToEmbCommentsIframeIfNeeded();
        const isLikedBefore = browser.isVisible(likeVoteSelector + '.dw-my-vote');
        api.topic.clickLikeVote(postNr, opts);
        api.switchToEmbCommentsIframeIfNeeded();
        let delay = 133;
        while (true) {
          // Wait for the server to reply and the page to get updated.
          browser.pause(delay);
          delay *= 1.5;
          const isLikedAfter = browser.isVisible(likeVoteSelector + '.dw-my-vote');
          if (isLikedBefore !== isLikedAfter)
            break;
        }
      },

      isPostLikedByMe: function(postNr: PostNr) {
        return api.topic.isPostLiked(postNr, { byMe: true });
      },

      isPostLiked: (postNr: PostNr, ps: { byMe?: true } = {}) => {
        const likeVoteSelector = api.topic.makeLikeVoteSelector(postNr, ps);
        return browser.isVisible(likeVoteSelector);
      },

      waitForLikeVote: (postNr: PostNr, ps: { byMe?: true } = {}) => {
        const likeVoteSelector = api.topic.makeLikeVoteSelector(postNr, ps);
        api.waitForVisible(likeVoteSelector);
      },

      toggleDisagreeVote: function(postNr: PostNr) {
        api.topic._toggleMoreVote(postNr, '.dw-a-wrong');
      },

      toggleBuryVote: function(postNr: PostNr) {
        api.topic._toggleMoreVote(postNr, '.dw-a-bury');
      },

      toggleUnwantedVote: function(postNr: PostNr) {
        api.topic._toggleMoreVote(postNr, '.dw-a-unwanted');
      },

      _toggleMoreVote: function(postNr: PostNr, selector: string) {
        api.topic.clickMoreVotesForPostNr(postNr);
        // The vote button appears in a modal dropdown.
        api.waitAndClick('.esDropModal_content ' + selector);
        api.waitUntilModalGone();
        api.waitUntilLoadingOverlayGone();
      },

      canVoteLike: function(postNr: PostNr) {
        const likeVoteSelector = api.topic.makeLikeVoteSelector(postNr);
        return browser.isVisible(likeVoteSelector);
      },

      canVoteUnwanted: function(postNr: PostNr) {
        api.topic.clickMoreVotesForPostNr(postNr);
        api.waitForVisible('.esDropModal_content .dw-a-like');
        const canVote = browser.isVisible('.esDropModal_content .dw-a-unwanted');
        assert(false); // how close modal? to do... later when needed
        return canVote;
      },

      clickFlagPost: function(postNr: PostNr) {
        api.topic.clickMoreForPostNr(postNr);
        api.waitAndClick('.icon-flag');  // for now, later: e_...
        // This opens  api.flagDialog.
      },

      deletePost: function(postNr: PostNr) {
        api.topic.clickMoreForPostNr(postNr);
        api.waitAndClick('.dw-a-delete');
        api.waitAndClick('.dw-delete-post-dialog .e_YesDel');
        api.waitUntilGone('.dw-delete-post-dialog');
        api.waitUntilLoadingOverlayGone();
        api.waitForVisible(`#post-${postNr}.dw-p-dl`);
      },

      canSelectAnswer: function() {
        return browser.isVisible('.dw-a-solve');
      },

      selectPostNrAsAnswer: function(postNr) {
        assert(!browser.isVisible(api.topic._makeUnsolveSelector(postNr)));
        api.topic.clickPostActionButton(api.topic._makeSolveSelector(postNr));
        api.waitForVisible(api.topic._makeUnsolveSelector(postNr));
      },

      unselectPostNrAsAnswer: function(postNr) {
        assert(!browser.isVisible(api.topic._makeSolveSelector(postNr)));
        api.topic.clickPostActionButton(api.topic._makeUnsolveSelector(postNr));
        api.waitForVisible(api.topic._makeSolveSelector(postNr));
      },

      _makeSolveSelector(postNr) {
        return `#post-${postNr} + .esPA .dw-a-solve`;
      },

      _makeUnsolveSelector(postNr) {
        return `#post-${postNr} + .esPA .dw-a-unsolve`;
      },

      openChangePageDialog: () => {
        api.waitAndClick('.dw-a-change');
        api.topic.waitUntilChangePageDialogOpen();   // CROK
      },

      __changePageDialogSelector: '.s_ChPgD .esDropModal_content',

      // Could break out to  changePageDialog: { ... } obj.
      waitUntilChangePageDialogOpen: () => {
        api.waitForVisible(api.topic.__changePageDialogSelector);  // CROK
        browser.waitForVisible('.modal-backdrop');
      },

      isChangePageDialogOpen: () => {
        return browser.isVisible(api.topic.__changePageDialogSelector);  // CROK
      },

      waitUntilChangePageDialogGone: () => {
        api.waitUntilGone(api.topic.__changePageDialogSelector);
        api.waitUntilGone('.modal-backdrop');
      },

      closeChangePageDialog: () => {
        dieIf(!api.topic.isChangePageDialogOpen(), 'TyE5AKTDFF2');
        // Don't: api.waitAndClick('.modal-backdrop');
        // That might block forever, waiting for the dialog that's in front of the backdrop
        // to stop occluding (parts of) the backdrop.
        // Instead:
        while (true) {
          // This no longer works, why not? Chrome 77. The click has no effect —
          // maybe it doesn't click at 10,10 any longer? Or what?
          //if (browser.isVisible('.modal-backdrop')) {
          //  // Click the upper left corner — if any dialog is open, it'd be somewhere in
          //  // the middle and the upper left corner, shouldn't hit it.
          //  browser.leftClick('.modal-backdrop', 10, 10);
          //}
          // Instead: (and is this even slightly better?)
          if (browser.isVisible('.esDropModal_CloseB')) {
            api.waitAndClick('.esDropModal_CloseB');
          }
          if (!api.topic.isChangePageDialogOpen())
            break;
          browser.pause(PollMs);
        }
        api.waitUntilModalGone();
      },

      closeTopic: function() {
        api.topic.openChangePageDialog();
        api.waitAndClick(api.topic._closeButtonSelector);
        api.topic.waitUntilChangePageDialogGone();
        api.waitForVisible('.dw-p-ttl .icon-block');
      },

      reopenTopic: function() {
        api.topic.openChangePageDialog();
        api.waitAndClick(api.topic._reopenButtonSelector);
        api.topic.waitUntilChangePageDialogGone();
        api.waitUntilGone('.dw-p-ttl .icon-block');
      },

      canCloseOrReopen: function() {
        browser.waitForVisible('.dw-a-more'); // so all buttons have appeared
        if (!browser.isVisible('.dw-a-change'))
          return false;
        api.topic.openChangePageDialog();
        let result = false;
        if (browser.isVisible(api.topic._closeButtonSelector)) result = true;
        else if (browser.isVisible(api.topic._reopenButtonSelector)) result = true;
        api.topic.closeChangePageDialog();
        return result;
      },

      setDoingStatus: (newStatus: 'New' | 'Planned' | 'Started' | 'Done') => {
        api.topic.openChangePageDialog();
        api.waitAndClick('.e_PgSt-' + newStatus);
        api.topic.waitUntilChangePageDialogGone();
      },

      _closeButtonSelector: '.s_ChPgD .e_ClosePgB',
      _reopenButtonSelector: '.s_ChPgD .e_ReopenPgB',

      refreshUntilBodyHidden: function(postNr: PostNr) {  // RENAME to refreshUntilPostBodyHidden
        while (true) {
          let isBodyHidden = api.topic.isPostBodyHidden(postNr);
          if (isBodyHidden) break;
          browser.pause(RefreshPollMs);
          browser.refresh();
        }
      },

      refreshUntilPostPresentBodyNotHidden: function(postNr: PostNr) {
        while (true) {
          let isVisible = browser.isVisible(`#post-${postNr}`);
          let isBodyHidden = api.topic.isPostBodyHidden(postNr);
          if (isVisible && !isBodyHidden) break;
          browser.pause(RefreshPollMs);
          browser.refresh();
        }
      },

      isPostBodyHidden: function(postNr) {
        return browser.isVisible(`#post-${postNr}.s_P-Hdn`);
      },

      waitForPostVisibleAsDeleted: function(postNr: PostNr) {
        browser.waitForVisible(`#post-${postNr}.s_P-Dd`);
      },

      assertPostHidden: function(postNr: PostNr) {
        assert(api.topic.isPostBodyHidden(postNr));
      },

      assertPostNotHidden: function(postNr: PostNr) {
        assert(!browser.isVisible(`#post-${postNr}.s_P-Hdn`));
        assert(browser.isVisible(`#post-${postNr}`));
        // Check -Hdn again, to prevent some races (but not all), namely that the post gets
        // loaded, and is invisible, but the first -Hdn check didn't find it because at that time
        // it hadn't yet been loaded.
        assert(!browser.isVisible(`#post-${postNr}.s_P-Hdn`));
      },

      assertPostNeedsApprovalBodyVisible: function(postNr: PostNr) {
        assert(api.topic._hasPendingModClass(postNr));
        assert(!api.topic._hasUnapprovedClass(postNr));
        assert(api.topic._isBodyVisible(postNr));
      },

      assertPostNeedsApprovalBodyHidden: function(postNr: PostNr) {
        assert(!api.topic._hasPendingModClass(postNr));
        assert(api.topic._hasUnapprovedClass(postNr));
        assert(!api.topic._isBodyVisible(postNr));
      },

      refreshUntilPostNotPendingApproval: function(postNr: PostNr) {
        for (let i = 0; i < 15; ++i) {
          if (api.topic.isPostNotPendingApproval(postNr))
            return;
          browser.pause(500);
          browser.refresh();
        }
        die('EdEKW05Y', `Post nr ${postNr} never gets approved`);
      },

      assertPostNotPendingApproval: function(postNr: PostNr, ps: { wait?: false } = {}) {
        if (ps.wait !== false) {
          api.topic.waitForPostNrVisible(postNr);
        }
        assert(api.topic.isPostNotPendingApproval(postNr));
      },

      isPostNotPendingApproval: function(postNr: PostNr) {
        return !api.topic._hasUnapprovedClass(postNr) &&
            !api.topic._hasPendingModClass(postNr) &&
            api.topic._isBodyVisible(postNr);
      },

      // Not needed? Just use  waitAndClick()  instead?
      clickPostActionButton: function(buttonSelector: string, opts: { clickFirst?: boolean } = {}) {   // RENAME to api.scrollAndClick?
        api.switchToEmbCommentsIframeIfNeeded();
        api.waitAndClick(buttonSelector, opts);
        return;
        // DO_AFTER 2020-06-01: CLEAN_UP REMOVE the rest of this function.
        let hasScrolled = false;
        const isInIframe = api.isInIframe();

        // If the button is close to the bottom of the window, the fixed bottom bar might
        // be above it; then, if it's below the [Scroll][Back] buttons, it won't be clickable.
        // Or the button might be below the lower window edge.
        // If so, scroll down to the reply button.
        //
        // Why try twice? The scroll buttons aren't shown until a few 100 ms after page load.
        // So, `browser.isVisible(api.scrollButtons.fixedBarSelector)` might evaluate to false,
        // and then we won't scroll down — but then just before `api.waitAndClick`
        // they appear, so the click fails. That's why we try once more.
        //
        api.waitForVisible(buttonSelector);
        for (let attemptNr = 1; attemptNr <= 2; ++attemptNr) {
          for (let i = 0; i < 20; ++i) {  // because FF sometimes won't realize it's done scrolling
            //OLD: const buttonLocation = browser.getLocationInView(buttonSelector);
            //  for unknown reasons, scrolls back to the top, at least in FF. Weird. Breaks everything.

            // If is array, could use [0] — but apparently the button locations are returned
            // in random order, with incorrect positions that never change regardless of how
            // one scrolls, and is sometimes 0 = obviously wrong. So, don't try to
            // pick [0] to click the first = topmost elem.
            // Chrome? Chromedriver? Webdriver? Selenium? buggy (as of June 29 2018).
            //OLD: dieIf(_.isArray(buttonLocation) && !opts.clickFirst, 'TyEISARRAYBKF');
            //if (opts.clickFirst)
            //  break; // cannot scroll, see above. Currently the tests don't need to scroll (good luck)

            die(`Fn gone: api.getRectOfFirst()`)
            const buttonRect: any = undefined; // = api.getRectOfFirst(buttonSelector);

            // E.g. the admin area, /-/admin.
            const isOnAutoPage = browser.getUrl().indexOf('/-/') >= 0;

            /*
            // ? Why did I add this can-scroll test ? Maybe, if can *not* scroll, this loop never got
            // happy with the current scroll position (0, 0?) and continued trying-to-scroll forever?
            let hasScrollBtns = browser.isVisible(api.scrollButtons.fixedBarSelector);
            // If in admin area or user's profile, there're no scroll buttons, but can maybe
            // scroll anyway.
            const canScroll = hasScrollBtns || isOnAutoPage;
            if (!canScroll) {
              logMessage(`Cannot scroll: ${hasScrollBtns} ${isOnAutoPage},` +
                  ` won't try to scroll to: ${buttonSelector}`);
              break;
            } */

            let bottomY = api.getWindowHeight();
            if (true) { // hasScrollBtns) {
              // Need to place the button we want to click, above the scroll bar — otherwise,
              // the scroll buttons can be on top of the button, and steal the click.
              bottomY -= 35;  // scroll button height [6WRD25]
              // Or could:
              //   bottomY = api.getRectOfFirst(api.scrollButtons.fixedBarSelector).y;
            }

            const topY = isInIframe
                ? 0 : (    // no topbar
                  isOnAutoPage
                    ? 100  // fixed topbar, might float drop —> 90 px tall
                    : 60); // fixed topbar, about 40px tall

            // The browser clicks in the middle of the button?
            const buttonMiddleY = buttonRect.y + buttonRect.height / 2;
            const clickMargin = 5;
            if (buttonMiddleY > topY + clickMargin && buttonMiddleY < bottomY - clickMargin)
              break;

            // Not needed? Nowadays, _waitAndClickImpl() scrolls, if needed.
            logMessage(`Scrolling into view: ${buttonSelector}, topY = ${topY}, ` +
                `buttonRect = ${JSON.stringify(buttonRect)}, buttonMiddleY = ${buttonMiddleY}, ` +
                `bottomY: ${bottomY}`);
            const scrollMargin = clickMargin + 10;
            browser.execute(function(selector, topY, scrollMargin) {
              window['debiki2'].utils.scrollIntoViewInPageColumn(selector, {
                marginTop: topY + scrollMargin,
                marginBottom: 70 + scrollMargin,   // 70 > scroll button heights
                duration: 150,
              });
            }, buttonSelector, topY, scrollMargin);
            hasScrolled = true;
            browser.pause(150 + 100);
          }
          try {
            // If in iframe, we might not have scrolled anything above, and will
            // scroll later instead, so, then, the button will maybe be "moving" / scrolling.
            const maybeMoves = hasScrolled || isInIframe;
            const opts2 = { ...opts, maybeMoves };
            logMessage(`clickPostActionButton:  CLICK  ${buttonSelector}  ` +
                `${JSON.stringify(opts2)}  [TyME2ECLICK]`);
            api._waitAndClickImpl(buttonSelector, opts2);
            break;
          }
          catch (exception) {
            // Click failed because the scroll buttons appeared after `canScroll = ...isVisible...`
            // but before `...waitAndClick...`? But that can happen only once.
            if (attemptNr === 2) {
              logError(`Error clicking post action button, selector: ${buttonSelector} [EdE2K045]`);
              throw exception;
            }
          }
          logMessage(`clickPostActionButton: attempt 2...`);
        }
      },

      _isOrigPostBodyVisible: function() {
        return !!$('#post-1 > .dw-p-bd').getText();
      },

      _isTitlePendingApprovalVisible: function() {
        return browser.isVisible('.dw-p-ttl .esPendingApproval');
      },

      _isOrigPostPendingApprovalVisible: function() {
        return browser.isVisible('.dw-ar-t > .esPendingApproval');
      },

      _isBodyVisible: function(postNr: PostNr) {
        return browser.isVisible(`#post-${postNr} .dw-p-bd`);
      },

      _hasPendingModClass: function(postNr: PostNr) {
        return browser.isVisible(`#post-${postNr} .dw-p-pending-mod`);
      },

      _hasUnapprovedClass: function(postNr: PostNr) {
        return browser.isVisible(`#post-${postNr}.dw-p-unapproved`);
      },
    },


    chat: {
      joinChat: () => {
        api.waitAndClick('#theJoinChatB');
      },

      waitAndAssertPurposeMatches: (regex: RegExp | string) => {
        api.waitAndAssertVisibleTextMatches('.esChatChnl_about', regex);
      },

      addChatMessage: (text: string) => {
        api.chat.editChatMessage(text);
        api.chat.submitChatMessage();
        // could verify visible
      },

      __previewSelector: '.s_C_M-Prvw',

      editChatMessage: (text: string) => {
        api.waitAndSetValue('.esC_Edtr_textarea', text);
        // Wait for a message preview to appear — because it can push the submit button down,
        // so when we click it, when done editing, we'd miss it, if we click at
        // exacty the same time. (Happens like 1 in 5.)
        if (text) api.waitForVisible(api.chat.__previewSelector);
        else api.waitForGone(api.chat.__previewSelector);
      },

      getChatInputText: function(): string {
        return api.waitAndGetText('.esC_Edtr_textarea');
      },

      waitForDraftSaved: function() {
        api.waitForVisible('.e_DfSts-' + c.TestDraftStatus.Saved);
      },

      waitForDraftDeleted: function() {
        api.waitForVisible('.e_DfSts-' + c.TestDraftStatus.Deleted);
      },

      waitForDraftChatMessageToLoad: function(text: string) {
        api.waitUntilValueIs('.esC_Edtr textarea', text);
      },

      submitChatMessage: function() {
        api.waitAndClick('.esC_Edtr_SaveB');
        api.waitUntilLoadingOverlayGone();
        //api.waitForGone('.s_C_M-Prvw'); [DRAFTS_BUG] — add this, see if works?
      },

      waitForNumMessages: function(howMany: number) {
        api.waitForAtLeast(howMany, '.esC_M');
      },

      countMessages: (ps: { inclAnyPreview?: boolean } = {}): number =>
        api.count(
            `.esC_M${ps.inclAnyPreview === false ? '' : ':not(.s_C_M-Prvw)'}`),

      assertMessageNrMatches: (messageNr, regex: RegExp | string) => {
        const postNr = messageNr + 1;
        api.topic.waitForPostAssertTextMatches(postNr, regex);
      },

      openAdvancedEditor: function() {
        api.waitAndClick('.esC_Edtr_AdvB');
      },

      deleteChatMessageNr: (nr: PostNr) => {
        const postSelector = `#post-${nr}`;
        api.waitAndClick(`${postSelector} .s_C_M_B-Dl`);
        api.waitAndClick('.dw-delete-post-dialog .e_YesDel');
        api.waitUntilLoadingOverlayGone();
        api.waitForVisible(`${postSelector}.s_C_M-Dd`);
      },
    },


    customForm: {
      submit: function() {
        api.waitAndClick('form input[type="submit"]');
        api.waitAndAssertVisibleTextMatches('.esFormThanks', "Thank you");
      },

      assertNumSubmissionVisible: function(num: number) {
        api.waitForMyDataAdded();
        api.assertExactly(num, '.dw-p-flat');
      },
    },


    scrollButtons: {
      fixedBarSelector: '.esScrollBtns_fixedBar',
    },


    searchResultsPage: {
      waitForSearchInputField: () => {
        api.waitForVisible('.s_SP_QueryTI');
      },

      assertPhraseNotFound: function(phrase: string) {
        api.searchResultsPage.waitForResults(phrase);
        assert(browser.isVisible('#e_SP_NothingFound'));
      },

      waitForAssertNumPagesFound: function(phrase: string, numPages: number) {
        api.searchResultsPage.waitForResults(phrase);
        // oops, search-search-loop needed ...
        // for now:
        api.waitForAtLeast(numPages, '.esSERP_Hit_PageTitle');
        api.assertExactly(numPages, '.esSERP_Hit_PageTitle');
      },

      searchForWaitForResults: function(phrase: string) {
        api.waitAndSetValue('.s_SP_QueryTI', phrase);
        api.searchResultsPage.clickSearchButton();
        // Later, with Nginx 1.11.0+, wait until a $request_id in the page has changed [5FK02FP]
        api.searchResultsPage.waitForResults(phrase);
      },

      searchForUntilNumPagesFound: function(phrase: string, numResultsToFind: number) {
        while (true) {
          api.searchResultsPage.searchForWaitForResults(phrase);
          const numFound = api.searchResultsPage.countNumPagesFound_1();
          if (numFound >= numResultsToFind) {
            assert(numFound === numResultsToFind);
            break;
          }
          browser.pause(333);
        }
      },

      clickSearchButton: function() {
        api.waitAndClick('.s_SP_SearchB');
      },

      waitForResults: function(phrase: string) {
        // Later, check Nginx $request_id to find out if the page has been refreshed
        // unique request identifier generated from 16 random bytes, in hexadecimal (1.11.0).
        api.waitUntilTextMatches('#e2eSERP_SearchedFor', phrase);
      },

      countNumPagesFound_1: (): number =>
        $$('.esSERP_Hit_PageTitle').length,

      assertResultPageTitlePresent: (title: string) => {
        api.waitAndGetElemWithText('.esSERP_Hit_PageTitle', title, 1);
      },

      goToSearchResult: function(linkText?: string) {
        api.repeatUntilAtNewUrl(() => {
          if (!linkText) {
            api.waitAndClick('.esSERP_Hit_PageTitle a');
          }
          else {
            api.waitForThenClickText('.esSERP_Hit_PageTitle a', linkText);
          }
        });
      },
    },


    groupListPage: {
      goHere: (origin?: string) => {
        api.go((origin || '') + '/-/groups/');
        api.groupListPage.waitUntilLoaded();
      },

      waitUntilLoaded: () => {
        api.waitForVisible('.s_GP');
      },

      countCustomGroups: (): number => {
        return api.count('.s_Gs-Custom .s_Gs_G');
      },

      openTrustedMembersGroup: () => {
        api.waitForThenClickText('.s_Gs_G_Lk .esP_By', 'trusted_members');
        api.waitAndAssertVisibleTextMatches('.esUP_Un', "trusted_members");
      },

      createGroup: (ps: { username: string, fullName: string }) => {
        api.waitAndClick('.s_GP_CrGB');
        api.waitAndSetValue('#te_CrGD_Un', ps.username);
        api.waitAndSetValue('#te_CrGD_FN', ps.fullName);
        api.waitAndClick('.s_CrGD .btn-primary');
        api.waitForVisible('.e_AddMbrsB');
      },

      waitUntilGroupPresent: (ps: { username: string, fullName: string }) => {
        api.waitAndGetElemWithText('.s_Gs_G_Lk .esP_By_U', ps.username);
        api.waitAndGetElemWithText('.s_Gs_G_Lk .esP_By_F', ps.fullName);
      },

      openGroupWithUsername: (username: string) => {
        api.waitForThenClickText('.s_Gs_G_Lk .esP_By_U', username);
        api.userProfilePage.groupMembers.waitUntilLoaded();
      }
    },


    preferences: '',
    userPreferences: '',
    userProfilePage: {
      avatarAboutButtonsSelector: '.s_UP_AvtrAboutBtns',

      waitUntilUsernameVisible: function() {
        api.waitForVisible('.esUP_Un');
      },

      waitUntilUsernameIs: (username) => {
        api.waitAndGetElemWithText('.esUP_Un', username);
      },

      waitAndGetUsername: (): string => {
        return api.waitAndGetVisibleText('.esUP_Un');
      },

      waitAndGetFullName: (): string => {
        return api.waitAndGetVisibleText('.esUP_FN');
      },

      waitUntilDeletedOrDeactivated: () => {
        browser.waitForVisible('.e_ActDd');
      },

      navBackToGroups: () => {
        api.userProfilePage._navigateBackToUsersOrGroupsList(true);
      },

      _navigateBackToUsersOrGroupsList: (isGroup: boolean) => {
        api.repeatUntilAtNewUrl(() => {
          api.waitAndClick('.esTopbar_custom_title a');
        });
        if (api.urlPath().startsWith(c.GroupsUrlPrefix)) {
          assert(isGroup);
          api.groupListPage.waitUntilLoaded();
        }
        else {
          assert(!isGroup);
          // /-/users/ all users list not yet impl
        }
      },

      openActivityFor: function(who: string, origin?: string) {
        api.go((origin || '') + `/-/users/${who}/activity/posts`);
        api.waitUntilLoadingOverlayGone();
      },

      openNotfsFor: function(who: string, origin?: string) {
        api.go((origin || '') + `/-/users/${who}/notifications`);
        api.waitUntilLoadingOverlayGone();
      },

      openNotfPrefsFor: function(who: string, origin?: string) {  // oops, dupl (443300222), remove this
        api.go((origin || '') + `/-/users/${who}/preferences/notifications`);
        api.waitUntilLoadingOverlayGone();
      },

      openDraftsEtcFor: function(who: string, origin?: string) {
        api.go((origin || '') + `/-/users/${who}/drafts-etc`);
        api.waitUntilLoadingOverlayGone();
      },

      openPreferencesFor: function(who: string, origin?: string) {
        api.go((origin || '') + `/-/users/${who}/preferences`);
        api.waitUntilLoadingOverlayGone();
      },

      goToActivity: function() {
        api.waitAndClick('.e_UP_ActivityB');
        api.waitForVisible('.s_UP_Act_List');
        api.waitUntilLoadingOverlayGone();
      },

      tabToNotfs: function() {
        api.waitAndClick('.e_UP_NotfsB');
        api.userProfilePage.notfs.waitUntilSeesNotfs();
        api.waitUntilLoadingOverlayGone();
      },

      goToPreferences: function() {  // RENAME switchTo and goTo, for tabs, to  tabToNnn ?
        api.userProfilePage.clickGoToPreferences();
      },

      // rename
      clickGoToPreferences: function() {
        api.waitAndClick('#e2eUP_PrefsB');
        api.waitForVisible('.e_UP_Prefs_FN');
        api.waitUntilLoadingOverlayGone();
      },

      switchToInvites: () => {
        api.waitAndClick('.e_InvTabB');
        api.invitedUsersList.waitUntilLoaded();
      },

      waitForTabsVisible: () => {
        // The activity tab is always visible, if the notfs tab can possibly be visible.
        api.waitForVisible('.e_UP_ActivityB');
      },

      isInvitesTabVisible: () => {
        api.userProfilePage.waitForTabsVisible();
        return browser.isVisible('.e_InvTabB');
      },

      isNotfsTabVisible: function() {
        api.userProfilePage.waitForTabsVisible();
        return browser.isVisible('.e_UP_NotfsB');
      },

      isPrefsTabVisible: function() {
        api.userProfilePage.waitForTabsVisible();
        return browser.isVisible('#e2eUP_PrefsB');
      },

      assertIsMyProfile: function() {
        api.waitForVisible('.esUP_Un');
        assert(browser.isVisible('.esProfile_isYou'));
      },

      assertUsernameIs: function(username: string) {
        api.assertTextMatches('.esUP_Un', username);
      },

      assertFullNameIs: function(name: string) {
        api.assertTextMatches('.esUP_FN', name);
      },

      assertFullNameIsNot: function(name: string) {
        api.assertNoTextMatches('.esUP_FN', name);
      },

      clickSendMessage: function() {
        api.waitAndClick('.s_UP_SendMsgB');
      },

      _goHere: (username: string, ps: { isGroup?: true, origin?: string }, suffix: string) => {
        api.go(`${ps.origin || ''}/-/${ps.isGroup ? 'groups' : 'users'}/${username}${suffix}`);
      },

      groupMembers: {
        goHere: (username: string, ps: { isGroup?: true, origin?: string } = {}) => {
          api.userProfilePage._goHere(username, ps, '/members');
          api.userProfilePage.groupMembers.waitUntilLoaded();
        },

        waitUntilLoaded: () => {
          api.waitForExist('.s_G_Mbrs, .s_G_Mbrs-Dnd');
        },

        waitUntilMemberPresent: (username: string) => {
          api.waitUntilTextMatches('.s_G_Mbrs .esP_By_U', username);
        },

        getNumMembers: (): number => {
          return api.count('.s_G_Mbrs .esP_By_U');
        },

        addOneMember: (username: string) => {
          api.waitAndClick('.e_AddMbrsB');
          api.addUsersToPageDialog.addOneUser(username);
          api.addUsersToPageDialog.submit();
          api.userProfilePage.groupMembers.waitUntilMemberPresent(username);
        },

        removeFirstMember: () => {
          api.waitAndClick('.s_G_Mbrs_Mbr .e_MngMbr');
          api.waitAndClick('.e_RmMbr');
          // (Could wait until 1 fewer member? or name gone?)
        }
      },

      activity: {
        switchToPosts: function(opts: { shallFindPosts: boolean | 'NoSinceActivityHidden' }) {
          api.waitAndClick('.s_UP_Act_Nav_PostsB');
          if (opts.shallFindPosts === 'NoSinceActivityHidden') {
            api.userProfilePage.activity.posts.waitForNothingToShow();
          }
          else if (opts.shallFindPosts) {
            api.waitForVisible('.s_UP_Act_Ps');
            api.waitForVisible('.s_UP_Act_Ps_P');
          }
          else {
            api.userProfilePage.activity.posts.waitForNoPosts();
          }
          api.waitUntilLoadingOverlayGone();
        },

        switchToTopics: function(opts: { shallFindTopics: boolean | 'NoSinceActivityHidden' }) {
          api.waitAndClick('.s_UP_Act_Nav_TopicsB');
          api.waitForVisible('.s_UP_Act_Ts');
          if (opts.shallFindTopics === 'NoSinceActivityHidden') {
            api.userProfilePage.activity.topics.waitForNothingToShow();
          }
          else if (opts.shallFindTopics) {
            api.waitForVisible('.e2eTopicTitle');
          }
          else {
            api.userProfilePage.activity.topics.waitForNoTopics();
          }
          api.waitUntilLoadingOverlayGone();
        },

        posts: {
          postSelector: '.s_UP_Act_Ps_P .dw-p-bd',

          waitForNothingToShow: function() {
            api.waitForVisible('.s_UP_Act_List .e_NothingToShow');
          },

          waitForNoPosts: function() {
            api.waitForVisible('.e_NoPosts');
          },

          assertExactly: function(num: number) {
            api.assertExactly(num, api.userProfilePage.activity.posts.postSelector);
          },

          // Do this separately, because can take rather long (suprisingly?).
          waitForPostTextsVisible: function() {
            api.waitForVisible(api.userProfilePage.activity.posts.postSelector);
          },

          assertPostTextVisible: function(postText: string) {
            let selector = api.userProfilePage.activity.posts.postSelector;
            api.assertAnyTextMatches(selector, postText, null, 'FAST');
          },

          assertPostTextAbsent: function(postText: string) {
            let selector = api.userProfilePage.activity.posts.postSelector;
            api.assertNoTextMatches(selector, postText);
          },
        },

        topics: {
          topicsSelector: '.s_UP_Act_Ts .e2eTopicTitle',

          waitForNothingToShow: function() {
            api.waitForVisible('.s_UP_Act_List .e_NothingToShow');
          },

          waitForNoTopics: function() {
            api.waitForVisible('.e_NoTopics');
          },

          assertExactly: function(num: number) {
            api.assertExactly(num, api.userProfilePage.activity.topics.topicsSelector);
          },

          waitForTopicTitlesVisible: function() {
            api.waitForVisible(api.userProfilePage.activity.topics.topicsSelector);
          },

          assertTopicTitleVisible: function(title: string) {
            let selector = api.userProfilePage.activity.topics.topicsSelector;
            api.assertAnyTextMatches(selector, title, null, 'FAST');
          },

          assertTopicTitleAbsent: function(title: string) {
            let selector = api.userProfilePage.activity.topics.topicsSelector;
            api.assertNoTextMatches(selector, title);
          },
        }
      },

      notfs: {
        waitUntilKnowsIsEmpty: function() {
          api.waitForVisible('.e_UP_Notfs_None');
        },

        waitUntilSeesNotfs: function() {
          api.waitForVisible('.esUP .esNotfs li a');
        },

        numNotfs: (): number => {
          return api.count('.esUP .esNotfs li a');
        },

        openPageNotfWithText: function(text) {
          api.repeatUntilAtNewUrl(() => {
            api.waitForThenClickText('.esNotf_page', text);
          });
        },

        assertMayNotSeeNotfs: function() {
          api.waitForVisible('.e_UP_Notfs_Err');
          api.assertTextMatches('.e_UP_Notfs_Err', 'EdE7WK2L_');
        }
      },

      draftsEtc: {
        waitUntilLoaded: function() {
          api.waitForExist('.s_Dfs');
        },

        refreshUntilNumDraftsListed: function(numDrafts: number) {
          while (true) {
            const elems = $$('.s_Dfs_Df');
            if (elems.length === numDrafts)
              return;
            browser.pause(125);
          }
        },

        waitUntilNumDraftsListed: function(numDrafts: number) {
          if (numDrafts === 0) {
            browser.waitForVisible('.e_Dfs_None');
          }
          else {
            api.waitForAtLeast(numDrafts, '.s_Dfs_Df');
            api.assertExactly(numDrafts, '.s_Dfs_Df');
          }
        },

        openDraftIndex: function(index) {
          api.repeatUntilAtNewUrl(() => {
            api.waitAndClickNth('.s_Dfs_Df', index);
          });
        },
      },

      invites: {
        clickSendInvite: () => {
          api.waitAndClick('.e_SndInvB');
        }
      },

      preferences: {  // RENAME to prefs
        goHere: (username: string, ps: { isGroup?: true, origin?: string } = {}) => {
          api.userProfilePage._goHere(username, ps, '/preferences');
        },

        switchToEmailsLogins: function() {  // RENAME to tabToAccount
          api.waitAndClick('.s_UP_Prf_Nav_EmLgL');
          if (api.urlPath().startsWith(c.UsersUrlPrefix)) {
            // Wait for user emails loaded.
            api.waitForVisible('.s_UP_EmLg_EmL');
          }
          else {
            // Currently (May 2019) just this section with a delete button.
            api.waitForVisible('.s_UP_EmLg');
          }
          api.waitUntilLoadingOverlayGone();
        },

        switchToAbout: function() {
          api.waitAndClick('.s_UP_Prf_Nav_AbtL');
          api.waitForVisible('.e_UP_Prefs_FN');
        },

        switchToNotifications: function() {
          api.waitAndClick('.s_UP_Prf_Nav_NtfsL');
          api.waitForVisible('.dw-notf-level.btn');
        },

        switchToPrivacy: function() {
          api.waitAndClick('.e_UP_Prf_Nav_PrivL');
          api.waitForVisible('.e_HideActivityAllCB');
        },

        // ---- Should be wrapped in `about { .. }`:

        setFullName: function(fullName: string) {
          api.waitAndSetValue('.e_UP_Prefs_FN input', fullName);
        },

        startChangingUsername: function() {
          api.waitAndClick('.s_UP_Prefs_ChangeUNB');
          api.stupidDialog.close();
        },

        setUsername: function(username: string) {
          api.waitAndSetValue('.s_UP_Prefs_UN input', username);
        },

        setSummaryEmailsEnabled: function(enabled: boolean) {
          setCheckbox('#sendSummaryEmails', enabled);
        },

        clickChangePassword: function() {
          api.waitAndClick('.s_UP_Prefs_ChangePwB');
        },

        save: function() {
          api.userProfilePage.preferences.clickSave();
          api.waitUntilModalGone();
          api.waitUntilLoadingOverlayGone();
        },

        clickSave: function() {
          api.waitAndClick('#e2eUP_Prefs_SaveB');
        },
        // ---- /END should be wrapped in `about { .. }`.

        notfs: {  // api.userProfilePage.preferences.notfs

          goHere: (username: string, ps: { isGroup?: true, origin?: string } = {}) => {  // oops, dupl (443300222), keep this
            api.userProfilePage._goHere(username, ps, '/preferences/notifications');
          },

          setSiteNotfLevel: (notfLevel: PageNotfLevel) => {  // RENAME to setNotfLevelForWholeSite?
            // The site notfs btn is the topmost one.
            api.waitAndClickFirst('.dw-notf-level');
            api.notfLevelDropdown.clickNotfLevel(notfLevel);
          },

          setNotfLevelForCategoryId: (categoryId: CategoryId, notfLevel: PageNotfLevel) => {
            api.waitAndClick(`.e_CId-${categoryId} .dw-notf-level`);
            api.notfLevelDropdown.clickNotfLevel(notfLevel);
          },
        },

        privacy: {
          setHideActivityForStrangers: function(enabled: boolean) {
            setCheckbox('.e_HideActivityStrangersCB input', enabled);
          },

          setHideActivityForAll: function(enabled: boolean) {
            setCheckbox('.e_HideActivityAllCB input', enabled);
          },

          savePrivacySettings: function() {
            dieIf(browser.isVisible('.e_Saved'), 'TyE6UKHRQP4'); // unimplemented
            api.waitAndClick('.e_SavePrivacy');
            api.waitForVisible('.e_Saved');
          },
        },

        emailsLogins: {   // RENAME to `account`
          getEmailAddress: function() {
            return api.waitAndGetVisibleText('.s_UP_EmLg_EmL_It_Em');
          },

          waitUntilEmailAddressListed: function(addrRegexStr: string,
                  opts: { shallBeVerified?: boolean } = {}) {
            const verified = opts.shallBeVerified ? '.e_EmVerfd' : (
              opts.shallBeVerified === false ? '.e_EmNotVerfd' : '');
            api.waitUntilTextMatches('.s_UP_EmLg_EmL_It_Em' + verified, addrRegexStr);
          },

          waitAndAssertLoginMethodId: (ps: { providerName: string, id: string }) => {
            const actualName = api.waitAndGetVisibleText('.s_UP_EmLg_LgL_It_How');
            assert.equal(actualName.toLowerCase(), ps.providerName.toLowerCase());
            const actualId = api.waitAndGetVisibleText('.s_UP_EmLg_LgL_It_Id');
            assert.equal(actualId, ps.id);  // don't convert to lowercase
          },

          addEmailAddress: function(address) {
            const emailsLogins = api.userProfilePage.preferences.emailsLogins;
            emailsLogins.clickAddEmailAddress();
            emailsLogins.typeNewEmailAddress(address);
            emailsLogins.saveNewEmailAddress();
          },

          clickAddEmailAddress: function() {
            api.waitAndClick('.e_AddEmail');
            api.waitForVisible('.e_NewEmail input');
          },

          typeNewEmailAddress: function(emailAddress) {
            api.waitAndSetValue('.e_NewEmail input', emailAddress);
          },

          saveNewEmailAddress: function() {
            api.waitAndClick('.e_SaveEmB');
            api.waitForVisible('.s_UP_EmLg_EmAdded');
          },

          canRemoveEmailAddress: function() {
            api.waitForVisible('.e_AddEmail');
            // Now any remove button should have appeared.
            return browser.isVisible('.e_RemoveEmB');
          },

          removeFirstEmailAddrOutOf: function(numCanRemoveTotal: number) {
            for (let i = 0; api.count('.e_RemoveEmB') !== numCanRemoveTotal; ++i) {
              browser.pause(PollMs);
              if (i >= 10 && (i % 10) === 0) {
                logWarning(`Waiting for ${numCanRemoveTotal} remove buttons ...`);
              }
            }
            api.waitAndClick('.e_RemoveEmB', { clickFirst: true });
            while (api.count('.e_RemoveEmB') !== numCanRemoveTotal - 1) {
              browser.pause(PollMs);
            }
          },

          canMakeOtherEmailPrimary: function() {
            // Only call this function if another email has been added (then there's a Remove button).
            api.waitForVisible('.e_RemoveEmB');
            // Now the make-primary button would also have appeared, if it's here.
            return browser.isVisible('.e_MakeEmPrimaryB');
          },

          makeOtherEmailPrimary: function() {
            api.waitAndClick('.e_MakeEmPrimaryB');
          },

          deleteAccount: () => {
            api.rememberCurrentUrl();
            api.waitAndClick('.e_DlAct');
            api.waitAndClick('.e_SD_SecB');
            api.waitForNewUrl();
          }
        }
      }
    },


    hasVerifiedSignupEmailPage: {
      clickContinue: () => {
        api.repeatUntilAtNewUrl(() => {
          api.waitAndClick('#e2eContinue');
        });
      }
    },


    hasVerifiedEmailPage: {  // for additional addresses, RENAME?
      waitUntilLoaded: function(opts: { needToLogin: boolean }) {
        api.waitForVisible('.e_HasVerifiedEmail');
        api.waitForVisible('.e_ViewProfileL');
        api.waitForVisible('.e_HomepageL');
        assert(opts.needToLogin === browser.isVisible('.e_NeedToLogin'));
      },

      goToHomepage: function() {
        api.waitAndClick('.e_HomepageL');
      },

      goToProfile: function() {
        api.waitAndClick('.e_ViewProfileL');
      }
    },


    flagDialog: {
      waitUntilFadedIn: function() {
        api.waitUntilDoesNotMove('.e_FD_InaptRB');
      },

      clickInappropriate: function() {
        api.waitAndClick('.e_FD_InaptRB label');
      },

      submit: function() {
        api.waitAndClick('.e_FD_SubmitB');
        api.waitUntilLoadingOverlayGone();
        // Don't: api.waitUntilModalGone(), because now the stupid-dialog pop ups
        // and says "Thanks", and needs to be closed.
      },
    },


    stupidDialog: {
      clickClose: function() {
        api.waitAndClick('.e_SD_CloseB');
      },

      close: function() {
        api.stupidDialog.clickClose();
        api.waitUntilModalGone();
      },
    },


    adminArea: {
      waitAssertVisible: function() {
        api.waitForVisible('h1.esTopbar_custom_title');
        api.assertTextMatches('h1', "Admin Area");
      },

      clickLeaveAdminArea: function() {
        api.repeatUntilAtNewUrl(() => {
          api.waitAndClick('.esTopbar_custom_backToSite');
        });
      },

      goToLoginSettings: function(origin?: string, opts: { loginAs? } = {}) {
        api.go((origin || '') + '/-/admin/settings/login');
        if (opts.loginAs) {
          api.loginDialog.loginWithPassword(opts.loginAs);
          api.adminArea.waitAssertVisible();
        }
      },

      goToUsersEnabled: function(origin?: string) {
        api.go((origin || '') + '/-/admin/users');
      },

      goToUser: function(member: Member | UserId, origin?: string) {
        const userId = _.isNumber(member) ? member : member.id;
        api.go((origin || '') + `/-/admin/users/id/${userId}`);
      },

      navToGroups: function() {
        api.repeatUntilAtNewUrl(() => {
          api.waitAndClick('.e_GrpsB');
        });
      },

      goToUsersInvited: (origin?: string, opts: { loginAs? } = {}) => {
        api.go((origin || '') + '/-/admin/users/invited');
        if (opts.loginAs) {
          api.loginDialog.loginWithPassword(opts.loginAs);
        }
        api.adminArea.users.invites.waitUntilLoaded();
      },

      goToBackupsTab: (origin?: string, opts: { loginAs? } = {}) => {
        api.adminArea._goToMaybeLogin(origin, '/-/admin/backup', opts);
        api.adminArea.backupsTab.waitUntilLoaded();
      },

      goToApi: function(origin?: string, opts: { loginAs? } = {}) {
        api.go((origin || '') + '/-/admin/api');
        if (opts.loginAs) {
          api.loginDialog.loginWithPassword(opts.loginAs);
        }
        api.adminArea.apiTab.waitUntilLoaded();
      },

      goToReview: function(origin?: string, opts: { loginAs? } = {}) {
        api.go((origin || '') + '/-/admin/review/all');
        if (opts.loginAs) {
          api.loginDialog.loginWithPassword(opts.loginAs);
        }
        api.adminArea.review.waitUntilLoaded();
      },

      _goToMaybeLogin: (origin: string, endpoint: string, opts: { loginAs? } = {}) => {
        api.go((origin || '') + endpoint);
        if (opts.loginAs) {
          api.loginDialog.loginWithPassword(opts.loginAs);
        }
      },

      goToAdminExtraLogin: (origin?: string) => {
        api.go((origin || '') + '/-/admin-login');
      },

      isReviewTabVisible: () => {
        return browser.isVisible('.e_RvwB');
      },

      isUsersTabVisible: () => {
        return browser.isVisible('.e_UsrsB');
      },

      numTabsVisible: () =>
        $$('.esAdminArea .dw-main-nav > li').length,

      settings: {
        clickSaveAll: function() {
          api.scrollToBottom();
          api.waitAndClick('.esA_SaveBar_SaveAllB');
          api.waitUntilLoadingOverlayGone();
        },

        clickLegalNavLink: function() {
          api.waitAndClick('#e2eAA_Ss_LegalL');
          api.waitForVisible('#e2eAA_Ss_OrgNameTI');
        },

        clickLoginNavLink: function() {
          api.waitAndClick('#e2eAA_Ss_LoginL');
          api.waitForVisible('#e2eLoginRequiredCB');
        },

        clickModerationNavLink: function() {
          api.waitAndClick('#e2eAA_Ss_ModL');
        },

        clickAnalyticsNavLink: function() {
          api.waitAndClick('#e2eAA_Ss_AnalyticsL');
        },

        clickAdvancedNavLink: function() {
          api.waitAndClick('#e2eAA_Ss_AdvancedL');
        },

        clickExperimentalNavLink: function() {
          api.waitAndClick('#e2eAA_Ss_ExpL');
        },

        legal: {
          editOrgName: function(newName: string) {
            api.waitAndSetValue('#e2eAA_Ss_OrgNameTI', newName);
          },

          editOrgNameShort: function(newName: string) {
            api.waitAndSetValue('#e2eAA_Ss_OrgNameShortTI', newName);
          },
        },

        login: {
          goHere: () => {
            api.adminArea.goToLoginSettings();
          },

          setRequireVerifiedEmail: function(isRequired: boolean) {
            setCheckbox('.e_A_Ss_S-RequireVerifiedEmailCB input', isRequired);
          },

          setLoginRequired: function(isRequired: boolean) {
            setCheckbox('#e2eLoginRequiredCB', isRequired);
          },

          setApproveUsers: function(isRequired: boolean) {
            setCheckbox('#e_ApproveUsersCB', isRequired);
          },

          clickAllowGuestLogin: function() {
            api.waitAndClick('#e2eAllowGuestsCB');
          },

          setExpireIdleAfterMinutes: (minutes: number) => {
            api.scrollIntoViewInPageColumn('.e_LgoIdlAftMins input');
            api.waitAndSetValue('.e_LgoIdlAftMins input', minutes, { checkAndRetry: true });
          },

          setEmailDomainWhitelist: (text: string) => {
            api.scrollIntoViewInPageColumn('.e_EmailWhitelist textarea');
            api.waitAndSetValue('.e_EmailWhitelist textarea', text, { checkAndRetry: true });
          },

          setEmailDomainBlacklist: (text: string) => {
            api.scrollIntoViewInPageColumn('.e_EmailBlacklist textarea');
            api.waitAndSetValue('.e_EmailBlacklist textarea', text, { checkAndRetry: true });
          },

          typeSsoUrl: (url: string) => {
            api.scrollIntoViewInPageColumn('.e_SsoUrl input');
            api.waitUntilDoesNotMove('.e_SsoUrl input');
            api.waitAndSetValue('.e_SsoUrl input', url, { checkAndRetry: true });
          },

          setSsoLoginRequiredLogoutUrl: (url: string) => {
            api.scrollIntoViewInPageColumn('.e_SsoAftLgoUrl input');
            api.waitUntilDoesNotMove('.e_SsoAftLgoUrl input');
            api.waitAndSetValue('.e_SsoAftLgoUrl input', url, { checkAndRetry: true });
          },

          setEnableSso: (enabled: boolean) => {
            api.scrollIntoViewInPageColumn('.e_EnblSso input');
            api.waitUntilDoesNotMove('.e_EnblSso input');
            setCheckbox('.e_EnblSso input', enabled);
          },

          goToSsoTestPage: () => {
            api.repeatUntilAtNewUrl(() => {
              api.waitAndClickFirst('.e_SsoTestL');
            });
          }
        },

        embedded: {
          goHere: (origin?: string) => {
            api.go((origin || '') + '/-/admin/settings/embedded-comments');
          },

          setAllowEmbeddingFrom: (value: string) => {
            api.waitAndSetValue('#e_AllowEmbFrom', value);
          },

          createSaveEmbeddingPage: (ps: { urlPath: string, discussionId?: string }) => {
            const htmlToPaste = api.waitAndGetVisibleText('#e_EmbCmtsHtml');
            const pageHtml = utils.makeEmbeddedCommentsHtml({
                htmlToPaste, discussionId: ps.discussionId,
                pageName: ps.urlPath, color: 'black', bgColor: '#a359fc' });
            fs.writeFileSync(`target/${ps.urlPath}.html`, pageHtml);
          },
        },

        advanced: {
          duplHostnamesSelector: '.s_A_Ss_S-Hostnames-Dupl pre',
          redirHostnamesSelector: '.s_A_Ss_S-Hostnames-Redr pre',

          getHostname: (): string => {
            return api.waitAndGetVisibleText('.esA_Ss_S_Hostname');
          },

          getDuplicatingHostnames: (): string => {
            return api.waitAndGetVisibleText(api.adminArea.settings.advanced.duplHostnamesSelector);
          },

          isDuplicatingHostnamesVisible: (): boolean => {
            return api.isVisible(api.adminArea.settings.advanced.duplHostnamesSelector);
          },

          getRedirectingHostnames: (): string => {
            return api.waitAndGetVisibleText(api.adminArea.settings.advanced.redirHostnamesSelector);
          },

          isRedirectingHostnamesVisible: (): boolean => {
            return api.isVisible(api.adminArea.settings.advanced.redirHostnamesSelector);
          },

          clickChangeSiteAddress: () => {
            api.waitAndClick('.e_ChAdrB');
          },

          typeNewSiteAddress: (newAddress: string) => {
            api.waitAndSetValue('.s_A_NewAdrD_HostnI input', newAddress);
          },

          saveNewSiteAddress: () => {
            api.waitAndClick('.s_A_NewAdrD .btn-primary');
          },

          waitForNewSiteRedirectLink: () => {
            api.waitForVisible('.e_NewSiteAddr');
          },

          followLinkToNewSiteAddr: () => {
            api.waitAndClick('.e_NewSiteAddr');
          },

          clickRedirectOldSiteAddresses: () => {
            api.waitAndClick('.e_RedirOldAddrB');
          }
        },
      },

      user: {
        enabledSelector: '.e_Enabled-Yes',
        disabledSelector: '.e_Enabled-No',
        disabledBecauseEmailUnverified: '.e_Enabled-No_EmNotVer',
        disabledBecauseWaitingForApproval: '.e_Enabled-No_WaitingAppr',
        setEmailVerifiedButtonSelector: '.e_SetEmVerifB',
        setEmailNotVerifiedButtonSelector: '.e_SetEmNotVerifB',
        sendEmVerEmButtonSelector: '.s_SendEmVerifEmB',

        waitForLoaded: function() {
          api.waitForVisible('.esA_Us_U_Rows');
        },

        viewPublProfile: () => {
          api.waitAndClick('.e_VwPblPrfB');
        },

        assertUsernameIs: (usernameOrMember: string | Member) => {
          const username = _.isString(usernameOrMember) ?
              usernameOrMember : (usernameOrMember as Member).username;
          api.waitAndAssertVisibleTextMatches('.e_A_Us_U_Username', username);
        },

        assertEnabled: function() {
          api.adminArea.user.waitForLoaded();
          assert(browser.isVisible(api.adminArea.user.enabledSelector));
        },

        assertEmailVerified: function() {
          assert(browser.isVisible(api.adminArea.user.setEmailNotVerifiedButtonSelector));
        },

        assertEmailNotVerified: function() {
          assert(browser.isVisible(api.adminArea.user.setEmailVerifiedButtonSelector));
        },

        setEmailToVerified: function(verified: boolean) {
          const u = api.adminArea.user;
          api.waitAndClick(
              verified ? u.setEmailVerifiedButtonSelector : u.setEmailNotVerifiedButtonSelector);
          // Wait for the request to complete — then, the opposite buttons will be shown:
          api.waitForVisible(
              verified ? u.setEmailNotVerifiedButtonSelector : u.setEmailVerifiedButtonSelector);
        },

        resendEmailVerifEmail: function () {
          api.waitAndClick(api.adminArea.user.sendEmVerEmButtonSelector);
        },

        assertDisabledBecauseNotYetApproved: function() {
          api.adminArea.user.waitForLoaded();
          assert(browser.isVisible(api.adminArea.user.disabledSelector));
          assert(browser.isVisible(api.adminArea.user.disabledBecauseWaitingForApproval));
          // If email not verified, wouldn't be considered waiting.
          assert(!browser.isVisible(api.adminArea.user.disabledBecauseEmailUnverified));
        },

        assertDisabledBecauseEmailNotVerified: function() {
          api.adminArea.user.waitForLoaded();
          assert(browser.isVisible(api.adminArea.user.disabledSelector));
          assert(browser.isVisible(api.adminArea.user.disabledBecauseEmailUnverified));
          // Isn't considered waiting, until after email approved.
          assert(!browser.isVisible(api.adminArea.user.disabledBecauseWaitingForApproval));
        },

        assertApprovedInfoAbsent: function() {
          api.adminArea.user.waitForLoaded();
          assert(browser.isExisting('.e_Appr_Info-Absent'));
        },

        assertApproved: function() {
          api.adminArea.user.waitForLoaded();
          assert(browser.isVisible('.e_Appr_Yes'));
        },

        assertRejected: function() {
          api.adminArea.user.waitForLoaded();
          assert(browser.isVisible('.e_Appr_No'));
        },

        assertWaitingForApproval: function() {   // RENAME to  assertApprovalUndecided
          api.adminArea.user.waitForLoaded();
          assert(browser.isVisible('.e_Appr_Undecided'));
        },

        approveUser: function() {
          api.waitAndClick('.e_Appr_ApprB');
          api.waitForVisible('.e_Appr_Yes');
        },

        rejectUser: function() {
          api.waitAndClick('.e_Appr_RejB');
          api.waitForVisible('.e_Appr_No');
        },

        undoApproveOrReject: function() {
          api.waitAndClick('.e_Appr_UndoB');
          api.waitForVisible('.e_Appr_Undecided');
        },

        suspendUser: function(opts: { days: number, reason: string } = { days: 10, reason: "Because." }) {
          api.waitAndClick('.e_Suspend');
          api.waitUntilDoesNotMove('.e_SuspDays');
          api.waitAndSetValue('.e_SuspDays input', opts.days);
          api.waitAndSetValue('.e_SuspReason input', opts.reason);
          api.waitAndClick('.e_DoSuspendB');
          api.waitForVisible('.e_Unuspend');
        },

        unsuspendUser: function() {
          api.waitAndClick('.e_Unuspend');
          api.waitForVisible('.e_Suspend');
        },

        markAsMildThreat: function() {
          api.waitAndClick('.e_ThreatLvlB');
          api.waitAndClick('.e_MildThreatB');
          api.waitForVisible('.e_ThreatLvlIsLkd');
        },

        markAsModerateThreat: function() {
          api.waitAndClick('.e_ThreatLvlB');
          api.waitAndClick('.e_ModerateThreatB');
          api.waitForVisible('.e_ThreatLvlIsLkd');
        },

        unlockThreatLevel: function() {
          api.waitAndClick('.e_ThreatLvlB');
          api.waitAndClick('.e_UnlockThreatB');
          api.waitForVisible('.e_ThreatLvlNotLkd');
        },

        grantAdmin: function() {
          api.waitForVisible('.e_Adm-No');
          api.waitAndClick('.e_ToggleAdminB');
          api.waitForVisible('.e_Adm-Yes');
        },

        revokeAdmin: function() {
          api.waitForVisible('.e_Adm-Yes');
          api.waitAndClick('.e_ToggleAdminB');
          api.waitForVisible('.e_Adm-No');
        },

        grantModerator: function() {
          api.waitForVisible('.e_Mod-No');
          api.waitAndClick('.e_ToggleModB');
          api.waitForVisible('.e_Mod-Yes');
        },

        revokeModerator: function() {
          api.waitForVisible('.e_Mod-Yes');
          api.waitAndClick('.e_ToggleModB');
          api.waitForVisible('.e_Mod-No');
        },

        startImpersonating: function() {
          api.repeatUntilAtNewUrl(() => {
            api.waitAndClick('#e2eA_Us_U_ImpersonateB');
          });
        },
      },

      users: {
        usernameSelector: '.dw-username',
        enabledUsersTabSelector: '.e_EnabledUsB',
        waitingUsersTabSelector: '.e_WaitingUsB',

        waitForLoaded: function() {
          api.waitForVisible('.e_AdminUsersList');
        },

        goToUser: function(user: string | Member) {
          const username = _.isString(user) ? user : user.username;
          api.rememberCurrentUrl();
          api.waitForThenClickText(api.adminArea.users.usernameSelector, username);
          api.waitForNewUrl();
          api.adminArea.user.assertUsernameIs(user);
        },

        assertUserListEmpty: function(member: Member) {
          api.adminArea.users.waitForLoaded();
          assert(browser.isVisible('.e_NoSuchUsers'));
        },

        assertUserListed: function(member: Member) {
          api.adminArea.users.waitForLoaded();
          api.assertAnyTextMatches(api.adminArea.users.usernameSelector, member.username);
        },

        assertUserAbsent: function(member: Member) {
          api.adminArea.users.waitForLoaded();
          api.assertNoTextMatches(api.adminArea.users.usernameSelector, member.username);
        },

        asserExactlyNumUsers: function(num: number) {
          api.adminArea.users.waitForLoaded();
          api.assertExactly(num, api.adminArea.users.usernameSelector);
        },

        // Works only if exactly 1 user listed.
        assertEmailVerified_1_user: function(member: Member, verified: boolean) {
          // for now:  --
          api.adminArea.users.assertUserListed(member);
          // later, check the relevant user row.
          // ------------
          if (verified) {
            assert(!browser.isVisible('.e_EmNotVerfd'));
          }
          else {
            assert(browser.isVisible('.e_EmNotVerfd'));
          }
        },

        switchToEnabled: function() {
          api.waitAndClick(api.adminArea.users.enabledUsersTabSelector);
          api.waitForVisible('.e_EnabledUsersIntro');
          api.adminArea.users.waitForLoaded();
        },

        switchToWaiting: function() {
          api.waitAndClick(api.adminArea.users.waitingUsersTabSelector);
          api.waitForVisible('.e_WaitingUsersIntro');
          api.adminArea.users.waitForLoaded();
        },

        isWaitingTabVisible: function() {
          api.waitForVisible(api.adminArea.users.enabledUsersTabSelector);
          return browser.isVisible(api.adminArea.users.waitingUsersTabSelector);
        },

        switchToNew: function() {
          api.waitAndClick('.e_NewUsB');
          api.waitForVisible('.e_NewUsersIntro');
          api.adminArea.users.waitForLoaded();
        },

        switchToStaff: function() {
          api.waitAndClick('.e_StaffUsB');
          api.waitForVisible('.e_StaffUsersIntro');
          api.adminArea.users.waitForLoaded();
        },

        switchToSuspended: function() {
          api.waitAndClick('.e_SuspendedUsB');
          api.waitForVisible('.e_SuspendedUsersIntro');
          api.adminArea.users.waitForLoaded();
        },

        switchToWatching: function() {
          api.waitAndClick('.e_WatchingUsB');
          api.waitForVisible('.e_ThreatsUsersIntro');
          api.adminArea.users.waitForLoaded();
        },

        switchToInvites: function() {
          api.waitAndClick('.e_InvitedUsB');
          api.adminArea.users.invites.waitUntilLoaded();
        },

        waiting: {
          undoSelector: '.e_UndoApprRjctB',

          approveFirstListedUser: function() {
            api.waitAndClickFirst('.e_ApproveUserB');
            api.waitForVisible(api.adminArea.users.waiting.undoSelector);
          },

          rejectFirstListedUser: function() {
            api.waitAndClickFirst('.e_RejectUserB');
            api.waitForVisible(api.adminArea.users.waiting.undoSelector);
          },

          undoApproveOrReject: function() {
            api.waitAndClickFirst(api.adminArea.users.waiting.undoSelector);
            api.waitUntilGone(api.adminArea.users.waiting.undoSelector);
          },
        },

        invites: {
          waitUntilLoaded: () => {
            // When this elem present, any invited-users-data has also been loaded.
            api.waitForExist('.s_InvsL');
          },

          clickSendInvite: () => {
            api.waitAndClick('.s_AA_Us_Inv_SendB');
          },
        }
      },

      interface: {
        goHere: (origin?: string, opts: { loginAs? } = {}) => {
          api.adminArea._goToMaybeLogin(origin, '/-/admin/customize/basic', opts);
        },

        waitUntilLoaded: () => {
          api.waitForVisible('.s_A_Ss_S');
          // Top tab pane unmount bug workaround apparently not needed here. [5QKBRQ] [E2EBUG]
          // Can be removed elsewhere too?
        },

        areTopicSectionSettingsVisible: () => {
          return browser.isVisible('.e_DscPrgSct');
        },

        setSortOrder: (value: number) => {
          dieIf(value === 0, "Cannot set to default — that'd clear the value, " +
              "but browser drivers are buggy / weird, won't work with Webdriver v4 [TyE06KUDS]");
          // 0 = default.
          const valueOrEmpty = value === 0 ? '' : value;
          api.waitAndSetValue('.e_BlgSrtOdr input', valueOrEmpty, { checkAndRetry: true });
        },

        setBlogPostLikeVotes: (value: number) => {
          api.waitAndSetValue('.e_BlgPstVts input', value, { checkAndRetry: true });
        },

        setAddCommentBtnTitle: (title: string) => {
          api.waitAndSetValue('.e_AddCmtBtnTtl input', title, { checkAndRetry: true });
        },

      },

      backupsTab: {
        waitUntilLoaded: () => {
          api.waitForVisible('.s_A_Bkp');
        },

        clickRestore: () => {
          api.waitAndClick('.e_RstBkp');
        },

        selectFileToRestore: (fileNameInTargetDir: string) => {
          api.waitAndSelectFile('.e_SelFil', fileNameInTargetDir);
        },
      },

      apiTab: {
        waitUntilLoaded: () => {
          api.waitForVisible('.s_A_Api');
        },

        generateSecret: () => {
          api.waitAndClick('.e_GenSecrB');
        },

        showAndCopyMostRecentSecret: (): string => {
          api.waitAndClick('.e_ShowSecrB');
          return api.waitAndGetVisibleText('.esStupidDlg .e_SecrVal');
        },
      },

      review: {
        goHere: (origin?: string, opts: { loginAs? } = {}) => {
          api.adminArea.goToReview(origin, opts);
        },

        waitUntilLoaded: function() {
          api.waitForVisible('.s_A_Rvw');
          //----
          // Top tab pane unmount bug workaround, for e2e tests. [5QKBRQ].  [E2EBUG]
          // Going to the Settings tab, makes the Review tab pane unmount, and after that,
          // it won't surprise-unmount ever again (until page reload).
          api.waitAndClick('.e_UsrsB');
          api.waitAndClick('.e_RvwB');
          api.waitForVisible('.s_A_Rvw');
          //----
        },

        playTimePastUndo: function() {
          // Make the server and browser believe we've waited for the review timeout seconds.
          server.playTimeSeconds(c.ReviewDecisionUndoTimoutSeconds + 10);
          api.playTimeSeconds(c.ReviewDecisionUndoTimoutSeconds + 10);
        },

        waitForServerToCarryOutDecisions: function(pageId?: PageId, postNr?: PostNr) {
          // Then wait for the server to actually do something.
          // The UI will reload the task list and auto-update itself [2WBKG7E], when
          // the review decisions have been carried out server side. Then the buttons
          // tested for below, hide.
          while (true) {
            browser.pause(c.JanitorThreadIntervalMs + 200);
            if (!pageId) {
              if (!browser.isVisible('.s_A_Rvw_Tsk_UndoB'))
                break;
            }
            else {
              // If we have a specific post in mind, then not only the Undo, but also
              // any Accept or Delete buttons elsewhere, for the same post, should
              // disappear, when the server is done.
              assert(_.isNumber(postNr));
              const pagePostSelector = '.e_Pg-Id-' + pageId + '.e_P-Nr-' + postNr;
              const anyButtonsVisible = (
                browser.isVisible(pagePostSelector + ' .s_A_Rvw_Tsk_UndoB') ||
                browser.isVisible(pagePostSelector + ' .e_A_Rvw_Tsk_AcptB') ||
                browser.isVisible(pagePostSelector + ' .e_A_Rvw_Tsk_RjctB'));
              if (!anyButtonsVisible)
                break;
            }
            //----
            // Top tab pane unmount bug workaround. [5QKBRQ].  [E2EBUG]
            browser.refresh();
            api.adminArea.review.waitUntilLoaded();
            //----
          }
          api.waitUntilLoadingOverlayGone();
        },

        goToPostForTaskIndex: function(index: number) {
          die("Won't work, opens in new tab [TyE5NA2953");
          api.topic.clickPostActionButton(`.e_RT-Ix-${index} .s_A_Rvw_Tsk_ViewB`);
          api.topic.waitForLoaded();
        },

        approvePostForMostRecentTask: function() {
          api.topic.clickPostActionButton('.e_A_Rvw_Tsk_AcptB', { clickFirst: true });
          api.waitUntilModalGone();
          api.waitUntilLoadingOverlayGone();
        },

        approvePostForTaskIndex: (index: number) => {
          api.topic.clickPostActionButton(`.e_RT-Ix-${index} .e_A_Rvw_Tsk_AcptB`);
          api.waitUntilModalGone();
          api.waitUntilLoadingOverlayGone();
        },

        rejectDeleteTaskIndex: (index: number) => {
          api.topic.clickPostActionButton(`.e_RT-Ix-${index} .e_A_Rvw_Tsk_RjctB`);
          api.waitUntilModalGone();
          api.waitUntilLoadingOverlayGone();
        },

        countReviewTasksFor: function(pageId, postNr, opts: { waiting: boolean }): number {
          const pageIdPostNrSelector = '.e_Pg-Id-' + pageId + '.e_P-Nr-' + postNr;
          const waitingSelector = opts.waiting ? '.e_Wtng' : '.e_NotWtng';
          const selector = '.esReviewTask' + pageIdPostNrSelector + waitingSelector;
          const elems = $$(selector);
          logMessage(`Counted to ${elems.length} of these: ${selector}`);
          return elems.length;
        },

        isMoreStuffToReview: function() {
          return browser.isVisible('.e_A_Rvw_Tsk_AcptB');
        },

        waitForTextToReview: function(text, ps: { index?: number } = {}) {
          let selector = '.esReviewTask_it';
          if (ps.index !== undefined) {
            selector = `.e_RT-Ix-${ps.index} ${selector}`;
          }
          api.waitUntilTextMatches(selector, text);
        },

        // RENAME to countReviewTasks? and add countReviewTasksWaiting?
        countThingsToReview: (): number =>
          $$('.esReviewTask_it').length,

        isTasksPostDeleted: function(taskIndex: number): boolean {
          return browser.isVisible(`.e_RT-Ix-${taskIndex}.e_P-Dd`);
        }
      },

      adminExtraLogin: {
        submitEmailAddress: (emailAddress: string) => {
          api.waitAndSetValue('.e_AdmEmI', emailAddress);
          api.waitAndClick('.e_SbmB');
          api.waitForGone('.e_SbmB');
        },

        assertIsBadEmailAddress: () => {
          api.assertPageHtmlSourceMatches_1('TyE0ADMEML_');
        },

        assertEmailSentMessage: () => {
          api.assertPageHtmlSourceMatches_1('Email sent');
        }
      }
    },


    inviteDialog: {
      waitUntilLoaded: () => {
        api.waitForVisible('.s_InvD');
      },

      typeAndSubmitInvite: (emailAddress: string, ps: { numWillBeSent?: number } = {}) => {
        api.inviteDialog.typeInvite(emailAddress);
        api.inviteDialog.clickSubmit();
        if (ps.numWillBeSent !== undefined) {
          api.inviteDialog.waitForCorrectNumSent(ps.numWillBeSent);
        }
        api.inviteDialog.closeResultsDialog();
      },

      typeInvite: (emailAddress: string) => {
        api.waitAndSetValue('.s_InvD textarea', emailAddress, { maybeMoves: true });
      },

      clickSubmit: () => {
        api.waitAndClick('.s_InvD .btn-primary');
      },

      cancel: () => {
        api.waitAndClick('.s_InvD .e_Cncl');
      },

      waitForCorrectNumSent: (num: number) => {
        api.waitForVisible('.e_Invd-' + num);
      },

      assertAlreadyJoined: (emailAddr: string) => {
        api.waitForVisible('.e_InvJoind');
        assert.equal(api.count('.e_InvJoind li'), 1);
        assert.equal(api.waitAndGetVisibleText('.e_InvJoind li'), emailAddr);
      },

      assertAlreadyInvited: (emailAddr: string) => {
        api.waitForVisible('.e_InvRtr');
        assert.equal(api.count('.e_InvRtr li'), 1);
        assert.equal(api.waitAndGetVisibleText('.e_InvRtr li'), emailAddr);
      },

      closeResultsDialog: () => {
        api.waitAndClick('.s_InvSentD .e_SD_CloseB', { maybeMoves: true });
      },

      isInviteAgainVisible: (): boolean => {
        api.waitForVisible('.s_InvD .btn-primary');
        return browser.isVisible('.e_InvAgain');
      }
    },


    invitedUsersList: {
      invitedUserSelector: '.e_Inv_U',

      waitUntilLoaded: () => {
        // When this elem present, any invited-users-data has also been loaded.
        api.waitForExist('.s_InvsL');
      },

      setHideOld: (value: boolean) => {
        setCheckbox('.e_OnlPend input', value);
      },

      setShowOnePerUserOnly: (value: boolean) => {
        setCheckbox('.e_OnePerP input', value);
      },

      assertHasAcceptedInvite: (username: string) => {
        api.assertAnyTextMatches(api.invitedUsersList.invitedUserSelector, username);
      },

      assertHasNotAcceptedInvite: (username: string) => {
        api.assertNoTextMatches(api.invitedUsersList.invitedUserSelector, username);
      },

      waitAssertInviteRowPresent: (index: number, opts: {
            email: string, accepted: boolean, acceptedByUsername?: string, sentByUsername?: string,
            deleted: boolean }) => {
        api.waitForAtLeast(index, '.s_InvsL_It');
        api.assertNthTextMatches('.e_Inv_Em', index, opts.email);
        if (opts.accepted === false) {
          api.assertNthTextMatches('.e_Inv_U', index, /^$/);
        }
        if (opts.deleted) {
          api.assertNthClassIncludes('.s_InvsL_It', index, 's_InvsL_It-Dd');
        }
        if (opts.acceptedByUsername) {
          api.assertNthTextMatches('.e_Inv_U', index, opts.acceptedByUsername);
        }
        if (opts.sentByUsername) {
          api.assertNthTextMatches('.e_Inv_SentByU', index, opts.sentByUsername);
        }
      },

      countNumInvited: (): number =>
        $$('.s_InvsL_It').length,
    },


    apiV0: {
      loginWithSecret: (ps: { origin: string, oneTimeSecret: string, thenGoTo: string }): void => {
        api.go(ps.origin +
            `/-/v0/login-with-secret?oneTimeSecret=${ps.oneTimeSecret}&thenGoTo=${ps.thenGoTo}`);
      },
    },


    unsubscribePage: {
      confirmUnsubscription: () => {
        api.rememberCurrentUrl();
        api.waitAndClick('input[type="submit"]');
        api.waitForNewUrl();
        browser.waitForVisible('#e2eBeenUnsubscribed');
      },
    },


    changePasswordDialog: {
      clickYesChange: () => {
        api.waitAndClick('.esStupidDlg .btn-primary');
      },
    },


    notfLevelDropdown: {
      clickNotfLevel: (notfLevel: PageNotfLevel) => {
        switch (notfLevel) {
          case c.TestPageNotfLevel.EveryPost:
            api.waitAndClick('.e_NtfAll');
            api.waitForGone('.e_NtfAll');
            break;
          case c.TestPageNotfLevel.TopicProgress:
            die('unimpl');
            break;
          case c.TestPageNotfLevel.TopicSolved:
            die('unimpl');
            break;
          case c.TestPageNotfLevel.NewTopics:
            api.waitAndClick('.e_NtfFst');
            api.waitForGone('.e_NtfFst');
            break;
          case c.TestPageNotfLevel.Tracking:
            die('unimpl');
            break;
          case c.TestPageNotfLevel.Normal:
            api.waitAndClick('.e_NtfNml');
            api.waitForGone('.e_NtfNml');
            break;
          case c.TestPageNotfLevel.Hushed:
            api.waitAndClick('.e_NtfHsh');
            api.waitForGone('.e_NtfHsh');
            break;
          case c.TestPageNotfLevel.Muted:
            api.waitAndClick('.e_NtfMtd');
            api.waitForGone('.e_NtfMtd');
            break;
          default:
            die('e2e bug');
        }
      },
    },


    shareDialog: {
      copyLinkToPost: () => {
        api.waitAndClick('.s_ShareD_Link');
      },

      close: () => {
        api.waitAndClick('.esDropModal_CloseB');  // currently not inside .s_ShareD
      }
    },


    movePostDialog: {
      moveToOtherSection: () => {
        api.waitAndClick('.s_MPD_OtrSct .btn');
        api.waitAndClick('.esStupidDlg a');
      },

      pastePostLinkMoveToThere: () => {
        api.waitAndPasteClipboard('#te_MvPI');
        api.waitAndClick('.e_MvPB');
      }
    },


    editHistoryDialog: {
      close: () => {
        api.waitAndClick('.dw-edit-history .modal-footer .btn');
        api.waitUntilGone('.dw-edit-history');
      },

      countDiffs: (): number => {
        return api.count('.dw-edit-history pre');
      },

      waitUntilVisible: () => {
        api.waitForVisible('.dw-edit-history');
        api.waitUntilDoesNotMove('.dw-edit-history');
      },

      waitGetAuthorAndDiff: (editEntryNr: number): EditHistoryEntry => {
        dieIf(editEntryNr < 1, "First edit diff entry is nr 1, not 0 [TyE20KGUTf06]");
        // Nr 1 is a help text, nr 2 is the first diff entry — so add +1.
        const selector =
            `.dw-edit-history .modal-body > div > .ed-revision:nth-child(${editEntryNr + 1})`;
        browser.waitForVisible(selector);
        const authorUsername = api.waitAndGetVisibleText(selector + ' .dw-username');
        const diffHtml = browser.getHTML(selector + ' pre');
        return {
          authorUsername,
          diffHtml,
        }
      },
    },


    serverErrorDialog: {
      waitForNotLoggedInError: function() {
        api.waitUntilTextMatches('.modal-body', 'TyE0LGDIN_');
      },

      waitForNotLoggedInAsAdminError: function() {
        api.waitUntilTextMatches('.modal-body', 'TyE0LGIADM_');
      },

      waitForJustGotSuspendedError: function() {
        api.waitUntilTextMatches('.modal-body', 'TyESUSPENDED_|TyE0LGDIN_');
      },

      dismissReloadPageAlert: function() {
        // Seems this alert appears only in a visible browser (not in an invisible headless browser).
        for (let i = 0; i < 5; ++i) {
          // Clicking anywhere triggers an alert about reloading the page, although has started
          // writing — because was logged out by the server (e.g. because user suspended)
          // and then som js tries to reload.
          $('.modal-body').click();
          const gotDismissed = api.dismissAnyAlert();
          if (gotDismissed) {
            logMessage("Dismissed got-logged-out but-had-started-writing related alert.");
            return;
          }
        }
        logMessage("Didn't get any got-logged-out but-had-started-writing related alert.");
      },

      waitAndAssertTextMatches: (regex: string | RegExp) => {
        api.waitAndAssertVisibleTextMatches('.modal-dialog.dw-server-error', regex);
      },

      waitForBadEmailAddressError: function() {
        api.waitUntilTextMatches('.modal-body', 'TyEBADEMLADR_');
      },

      waitForBadEmailDomainError: function() {
        // Sometimes there's this error:
        //   stale element reference: element is not attached to the page document
        // Why? Maybe there's another dialog .modal-body that fades away and disappears
        // before the server error dialog's .modal-body appears?
        utils.tryManyTimes("waitForBadEmailDomainError", 2, () => {
          api.waitUntilTextMatches('.s_SED_Wrap .modal-body', 'TyEBADEMLDMN_');
        });
      },

      waitForTooManyInvitesError: function() {
        api.waitUntilTextMatches('.modal-body', 'TyETOOMANYBULKINV_');
      },

      waitForTooManyInvitesLastWeekError: function() {
        api.waitUntilTextMatches('.modal-body', 'TyINVMANYWEEK_');
      },

      waitForXsrfTokenExpiredError: function() {
        api.waitUntilTextMatches('.modal-body', 'TyEXSRFEXP_');
      },

      waitForIsRegistrationSpamError: function() {
        // The //s regex modifier makes '.' match newlines. But it's not available before ES2018.
        api.serverErrorDialog.waitAndAssertTextMatches(/spam.*TyEPWREGSPM_/s);
      },

      waitForTooManyPendingMaybeSpamPostsError: function() {
        // The //s regex modifier makes '.' match newlines. But it's not available before ES2018.
        api.serverErrorDialog.waitAndAssertTextMatches(/spam.*TyENEWMBRSPM_/s);
      },

      close: function() {
        api.waitAndClick('.e_SED_CloseB');
        api.waitUntilGone('.modal-dialog.dw-server-error');
      }
    },

    tour: {
      runToursAlthoughE2eTest: () => {
        browser.execute(function() {
          localStorage.setItem('runToursAlthoughE2eTest', 'true');
        });
      },

      assertTourStarts: (shallStart: boolean) => {
        // Wait for the tour to appear. (There's no other way to do that right now,
        // than just waiting for a while. It appears within about a second.
        // Note that this is also used to test that the tour *does* appear fast enough,
        // not only that it does *not* appear — to test, that this test, works.)
        api.waitUntil(() => browser.isVisible('.s_Tour'), {
          timeoutMs: 3500,
          timeoutIsFine: true,
          message: `Will the intro tour start? ...`,
        });
        assert.equal(browser.isVisible('.s_Tour'), shallStart);
      },

      clickNextForStepNr: (stepNr: number) => {
        // Don't scroll — the tour will scroll for us. (Scrolling here too, could scroll
        // too much, and the click might fail.)
        api.waitAndClick(`.s_Tour-Step-${stepNr} .s_Tour_D_Bs_NextB`, { mayScroll: false });
      },

      exitTour: () => {
        api.waitAndClick(`.s_Tour_D_Bs_ExitB`, { mayScroll: false });
      },
    },

    helpDialog: {
      waitForThenClose: function() {
        api.waitAndClick('.esHelpDlg .btn-primary');
        api.waitUntilModalGone();
      },
    },

    complex: {
      waitUntilLoggedIn: () => {
        browser.waitUntil(function () {
          return browser.execute(function() {
            try {
              return window['debiki2'].ReactStore.getMe().isLoggedIn;
            }
            catch {
              return false;
            }
          });
        });

        if (api.metabar.isVisible()) {
          // Extra test, if in embedded comments iframe:
          api.metabar.waitUntilLoggedIn();
        }
        else if (api.topbar.isVisible()) {
          // Extra test, if on topic list pages or discussion pages, but not comments iframes:
          api.topbar.waitForMyMenuVisible();
        }
        else if (false) {  // if is in editor iframe
          // then what?
        }
      },


      waitForLoggedInInEmbeddedCommentsIrames: function() {
        api.switchToEmbeddedCommentsIrame();
        api.complex.waitUntilLoggedIn();
        api.switchToEmbeddedEditorIrame();
        api.complex.waitUntilLoggedIn();
        api.switchToAnyParentFrame();
      },

      waitForNotLoggedInInEmbeddedCommentsIframe: function() {
        api.switchToEmbeddedCommentsIrame();
        api.waitForMyDataAdded();
        api.metabar.waitForLoginButtonVisible();  // ok? or is this a race?
        api.switchToAnyParentFrame();
      },

      loginWithPasswordViaTopbar: (username: string | { username, password },
            password?: string, opts?: { resultInError?: boolean }) => {
        console.log(`TyE2eApi: loginWithPasswordViaTopbar`);
        if (!opts && password && _.isObject(password)) {
          opts = <any> password;
          password = null;
        }
        api.topbar.clickLogin();
        const credentials = _.isObject(username) ?  // already { username, password } object
            username : { username: username, password: password };
        api.loginDialog.loginWithPassword(credentials, opts || {});
      },

      signUpAsMemberViaTopbar: function(
            member: { emailAddress: string, username: string, password: string }) {
        api.topbar.clickSignUp();
        api.loginDialog.createPasswordAccount({
          username: member.username,
          emailAddress: member.emailAddress,
          password: member.password,
          willNeedToVerifyEmail: false,
        });
      },

      signUpAsGuestViaTopbar: (nameOrObj: string | { fullName, emailAddress }, email?: string) => {
        api.disableRateLimits();
        api.topbar.clickSignUp();
        let name: string;
        if (_.isObject(nameOrObj)) {
          assert(!email);
          name = nameOrObj.fullName;
          email = nameOrObj.emailAddress;
        }
        else {
          name = nameOrObj;
        }
        api.loginDialog.signUpAsGuest(name, email);
      },

      signUpAsGmailUserViaTopbar: function({ username }) {
        api.disableRateLimits();
        api.topbar.clickSignUp();
        api.loginDialog.createGmailAccount({
            email: settings.gmailEmail, password: settings.gmailPassword, username });
      },

      logInAsGuestViaTopbar: function(nameOrObj: string | { fullName, emailAddress }, email?: string) {
        api.topbar.clickLogin();
        let name: string;
        if (_.isObject(nameOrObj)) {
          assert(!email);
          name = nameOrObj.fullName;
          email = nameOrObj.emailAddress;
        }
        else {
          name = nameOrObj;
        }
        api.loginDialog.logInAsGuest(name, email);
      },

      loginWithPasswordViaMetabar: (ps: { username: string, password: string }) => {
        api.metabar.clickLogin();
        api.loginDialog.loginWithPasswordInPopup(ps);
      },

      closeSidebars: function() {
        if (browser.isVisible('#esWatchbarColumn')) {
          api.watchbar.close();
        }
        if (browser.isVisible('#esThisbarColumn')) {
          api.contextbar.close();
        }
      },

      createCategory: (ps: { name: string, extId?: string }) => {
        api.forumButtons.clickCreateCategory();
        api.categoryDialog.fillInFields(ps);
        api.categoryDialog.submit();
      },

      createAndSaveTopic: function(data: { title: string, body: string, type?: PageRole,
            matchAfter?: boolean, titleMatchAfter?: string | false,
            bodyMatchAfter?: string | false, resultInError?: boolean }) {
        api.forumButtons.clickCreateTopic();
        api.editor.editTitle(data.title);
        api.editor.editText(data.body);
        if (data.type) {
          api.editor.setTopicType(data.type);
        }
        api.complex.saveTopic(data);
      },

      saveTopic: function(data: { title: string, body: string,
            matchAfter?: boolean, titleMatchAfter?: string | false,
            bodyMatchAfter?: string | false, resultInError?: boolean }) {
        api.rememberCurrentUrl();
        api.editor.save();
        if (!data.resultInError) {
          api.waitForNewUrl();
          if (data.matchAfter !== false && data.titleMatchAfter !== false) {
            api.assertPageTitleMatches(data.titleMatchAfter || data.title);
          }
          if (data.matchAfter !== false && data.bodyMatchAfter !== false) {
            api.assertPageBodyMatches(data.bodyMatchAfter || data.body);
          }
        }
        api.waitUntilLoadingOverlayGone();
      },

      editPageTitle: function(newTitle: string) {
        api.pageTitle.clickEdit();
        api.pageTitle.editTitle(newTitle);
        api.pageTitle.save();
        api.topic.waitUntilPostTextMatches(c.TitleNr, newTitle);
        api.assertPageTitleMatches(newTitle);
      },

      editPageBody: function(newText: string, opts: { append?: boolean } = {}) {
        api.topic.clickEditOrigPost();
        api.editor.editText(newText, opts);
        api.editor.save();
        api.topic.waitUntilPostTextMatches(c.BodyNr, newText);
        api.assertPageBodyMatches(newText);
      },

      editPostNr: function(postNr: PostNr, newText: string, opts: { append?: boolean } = {}) {
        api.topic.clickEditoPostNr(postNr);
        api.editor.editText(newText, opts);
        api.editor.save();
        api.topic.waitUntilPostTextMatches(postNr, newText);
      },

      replyToOrigPost: function(text: string, whichButton?: 'DiscussionSection') {
        api.topic.clickReplyToOrigPost(whichButton);
        api.editor.editText(text);
        api.editor.save();
      },

      replyToEmbeddingBlogPost: function(text: string,
            opts: { signUpWithPaswordAfterAs?, needVerifyEmail?: boolean } = {}) {
        // Apparently, if FF cannot click the Reply button, now when in an iframe,
        // then FF says "all fine I clicked the button", but in fact does nothing,
        // also won't log any error or anything, so that later on, we'll block
        // forever when waiting for the editor.
        // So sometimes this neeeds to be in a retry loop, + timeoutMs below. [4RDEDA0]
        api.switchToEmbeddedCommentsIrame();
        logMessage("comments iframe: Clicking Reply ...");
        api.topic.clickReplyToEmbeddingBlogPost();
        //if (opts.loginWithPaswordBeforeAs) {
          //api.loginDialog.loginWithPasswordInPopup(opts.loginWithPaswordBeforeAs);
        //}
        api.switchToEmbeddedEditorIrame();
        logMessage("editor iframe: Composing a reply ...");
        // Previously, before retrying scroll-to-top, this could hang forever in FF.
        // Add a timeout here so the retry (see comment above) will work.
        api.editor.editText(text, { timeoutMs: 3000 });
        logMessage("editor iframe: Saving ...");
        api.editor.save();

        if (opts.signUpWithPaswordAfterAs) {
          logMessage("editor iframe: Switching to login popup to log in / sign up ...");
          api.swithToOtherTabOrWindow();
          api.disableRateLimits();
          api.loginDialog.createPasswordAccount(
              opts.signUpWithPaswordAfterAs, false,
              opts.needVerifyEmail === false ? 'THERE_WILL_BE_NO_VERIFY_EMAIL_DIALOG' : null);
          api.switchBackToFirstTabOrWindow();
        }

        logMessage("editor iframe: Done.");
        api.switchToEmbeddedCommentsIrame();
      },

      addProgressReply: function(text: string) {
        api.topic.clickAddProgressReply();
        api.editor.editText(text);
        api.editor.save();
      },

      replyToPostNr: function(postNr: PostNr, text: string, opts: { isEmbedded?: true } = {}) {
        if (opts.isEmbedded) api.switchToEmbeddedCommentsIrame();

        // Sometimes the click fails — maybe a sidebar opens, making the button move a bit? Or
        // the window scrolls, making the click miss? Or whatever. If the click misses the
        // button, most likely, the editor won't open. So, if after clicking, the editor
        // won't appear, then click again.
        api.topic.waitForPostNrVisible(postNr);
        browser.pause(50); // makes the first click more likely to succeed (without,
        // failed 2 times out of 4 at a place in unsubscribe.2browsers.test.ts — but with,
        // failed 2 times out of 20).
        for (let clickAttempt = 0; true; ++clickAttempt) {
          api.topic.clickReplyToPostNr(postNr);
          try {
            if (opts.isEmbedded) api.switchToEmbeddedEditorIrame();
            api.waitForVisible('.esEdtr_textarea', { timeoutMs: 5000 });
            break;
          }
          catch (ignore) {
            logUnusual("When clicking the Reply button, the editor didn't open. Trying again");
            dieIf(clickAttempt === 3, "Couldn't click Reply and write a reply [EdE7FKAC2]");
            if (opts.isEmbedded) api.switchToEmbeddedCommentsIrame();
          }
        }
        api.editor.editText(text);
        api.editor.save();
        if (opts.isEmbedded) api.switchToEmbeddedCommentsIrame();
      },

      flagPost: function(postNr: PostNr, reason: 'Inapt' | 'Spam') {
        api.topic.clickFlagPost(postNr);
        api.flagDialog.waitUntilFadedIn();
        if (reason === 'Inapt') {
          api.flagDialog.clickInappropriate();
        }
        else {
          die('Test code bug, only Inapt implemented in tests, yet [EdE7WK5FY0]');
        }
        api.flagDialog.submit();
        api.stupidDialog.close();
      },

      openPageAuthorProfilePage: function() {
        logMessage(`Open about author dialog...`);
        api.pageTitle.openAboutAuthorDialog();
        logMessage(`Click view profile...`);
        api.aboutUserDialog.clickViewProfile();
      },

      sendMessageToPageAuthor: function(messageTitle: string, messageText: string) {
        api.pageTitle.openAboutAuthorDialog();
        logMessage(`Click Send Message...`);
        api.aboutUserDialog.clickSendMessage();
        logMessage(`Edit message title...`);
        api.editor.editTitle(messageTitle);
        logMessage(`Edit message text...`);
        api.editor.editText(messageText);
        logMessage(`Submit...`);
        api.editor.saveWaitForNewPage();
      },

      createChatChannelViaWatchbar: function(
            data: { name: string, purpose: string, public_?: boolean }) {
        api.watchbar.clickCreateChatWaitForEditor();
        api.editor.editTitle(data.name);
        api.editor.editText(data.purpose);
        if (data.public_ === false) {
          api.editor.setTopicType(c.TestPageRole.PrivateChat);
        }
        api.rememberCurrentUrl();
        api.editor.save();
        api.waitForNewUrl();
        api.assertPageTitleMatches(data.name);
      },

      addPeopleToPageViaContextbar(usernames: string[]) {
        api.contextbar.clickAddPeople();
        _.each(usernames, api.addUsersToPageDialog.addOneUser);
        api.addUsersToPageDialog.submit({ closeStupidDialogAndRefresh: true });
        _.each(usernames, api.contextbar.assertUserPresent);
      }
    }
  };

  function setCheckbox(selector: string, checked: boolean) {
    dieIf(_.isUndefined(checked), "setCheckbox: Pass true or false  [TyE036WKDP45]");
    // Sometimes, clicking this checkbox has no effect. Perhaps a sidebar appeared, which
    // caused the checkbox to move? so the click missed? Therefore, try many times.
    // Update, 2017-11: Look here, the click works, but the button changes state back again,
    // half a second after it was clicked (!):
    // (I don't see how this could be related to any slow http request... We haven't clicked
    // Save yet, no request sent.)
    //   #sendSummaryEmails is visible, should be checked: true
    //   #sendSummaryEmails is checked: false
    //   #sendSummaryEmails **click**
    //   #sendSummaryEmails is checked: true    <— the click worked, state changed
    //   #sendSummaryEmails is checked: true
    //   #sendSummaryEmails is checked: false   <— amazing, it does that by itself?
    //   #sendSummaryEmails is checked: false     (all this was running in an *invisible*
    //   #sendSummaryEmails is checked: false      browser, no real mouse interactions possible)
    // So need to loop, ... until it stops undoing the click? Really weird.
    //
    api.waitForVisible(selector);
    let bugRetry = 0;
    const maxBugRetry = 2;
    for (; bugRetry <= maxBugRetry; ++bugRetry) {
      logMessage(selector + ' is visible, should be checked: ' + checked);
      for (let i = 0; i < 99; ++i) {
        let isChecked = $(selector).isSelected();
        logMessage(selector + ' is checked: ' + isChecked);
        if (isChecked === checked)
          break;
        api.waitAndClick(selector);
        logMessage(selector + ' **click**');
      }
      // Somehow once this function exited with isChecked !== isRequired. Race condition?
      // Let's find out:
      let isChecked = $(selector).isSelected();
      logMessage(selector + ' is checked: ' + isChecked);
      browser.pause(300);
      isChecked = $(selector).isSelected();
      logMessage(selector + ' is checked: ' + isChecked);
      browser.pause(400);
      isChecked = $(selector).isSelected();
      /* maybe works better now? (many months later)
      logMessage(selector + ' is checked: ' + isChecked);
      browser.pause(500);
      isChecked = browser.isSelected(selector);
      logMessage(selector + ' is checked: ' + isChecked);
      browser.pause(600);
      isChecked = browser.isSelected(selector);
      logMessage(selector + ' is checked: ' + isChecked);
      browser.pause(700);
      isChecked = browser.isSelected(selector);
      logMessage(selector + ' is checked: ' + isChecked); */
      if (isChecked === checked)
        break;
      logUnusual("Checkbox refuses to change state. Clicking it again.");
    }
    assert(bugRetry <= maxBugRetry, "Couldn't set checkbox to checked = " + checked);
  }

  // backw compat, for now
  api['replies'] = api.topic;

  return api;
}

export = pagesFor;


import * as _ from 'lodash';


// Why are many WebdriverIO's functions reimplemented here?
//
// Because they're either 1) quiet, whilst waiting. No way to find out what's
// wrong, when a test times out. Or, 2) they log frustratingly much log messages, always,
// if you enable detailed log levels.
//
// Talkyards waitFor[Something](), though, logs nothing, *unless* after a short
// while Something hasn't happened. *Then* Talkyard starts logging what is
// being waited for. — More readable logs, when you need them.



// Assertions tests if Talkyard works, ...
import * as assert from 'assert';
import * as tyAssert from '../utils/ty-assert';

// ... Use die() and dieIf(), though, if an e2e test is broken
// (rather than Talkyard itself).
import { getOrCall, die, dieIf, logUnusual, logDebug,
    logError, logErrorNoTrace, logErrorIf,
    logWarning, logWarningIf,
    logException, logMessage, logMessageIf, logBoring,
    logServerRequest, printBoringToStdout } from './log-and-die';

import * as path from 'path';
import * as fs from 'fs';
import settings = require('./settings');
import server = require('./server');
import utils = require('../utils/utils');
import c = require('../test-constants');

// Required with  transpileOnly: true,
// but without, this error:
//     utils/pages-for.ts(33,26): error TS2306:
//        File 'tests/e2e/test-types.ts' is not a module.
//import IsWhere = require('../test-types');


//  RENAME  this file to ty-e2e-test-browser.ts but wait a bit,
//           I'll want to code review the wdio v4 —> v6 upgr first?
//  RENAME  waitAndGetSth, waitAndClick... to just getSth, click, etc,
//          and fns that don't wait, call them  getSthNow  and clickNow  instead,
//          since almost all fns wait until ok to procceed, so that's the 95% normal
//          case — then better that those names are brief.


const traceOrDebug =
    settings.logLevel === 'trace' ||
    settings.logLevel === 'debug';

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


type WElm = WebdriverIO.Element;
type ElemRect = { x: number, y: number, width: number, height: number };


interface SnoozeTime {
  hours?: number;
  minutes?: number;
  toWhen?: 'TomorrowMorning9am';
};


interface WaitPs {   // ps = params
  refreshBetween?: Bo;
  timeoutMs?: Nr;
  timeoutIsFine?: Bo;
  serverErrorDialogIsFine?: Bo;
  winClosedIsFine?: Bo;
  message?: StringOrFn;
}


interface WaitPsWithOptText extends WaitPs {
  text?: St;
}


/// Returns only the WaitPs fields.
///
function pluckWaitPs(ps: Partial<WaitPs>): WaitPs {
  return {
    refreshBetween: ps.refreshBetween,
    timeoutMs: ps.timeoutMs,
    timeoutIsFine: ps.timeoutIsFine,
    serverErrorDialogIsFine: ps.serverErrorDialogIsFine,
    message: ps.message,
  };
}


interface WaitAndClickPs extends WaitPs {
  maybeMoves?: Bo;
  mayScroll?: Bo;
  okayOccluders?: St;
  waitUntilNotOccluded?: Bo;
  clickFirst?: Bo;
}


type WaitForClickableResult = 'Clickable' | 'NotClickable';
type ClickResult = 'Clicked' | 'CouldNotClick';


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
    // This is the results from one single browser. Create a dummy browser
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
  //console.log(`byBrowser_: r = ${JSON.stringify(r)}`);
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


function tryOrIfWinCloses<R>(toTry: () => R, ifWinCloses: R | U): R {
  try {
    return toTry();
  }
  catch (ex) {
    if (!isWindowClosedException(ex)) {
      throw ex;
    }
    if (_.isUndefined(ifWinCloses)) {
      logErrorNoTrace(`Win closed [TyMWINCLSD04]`);
      throw ex;
    }
    logUnusual(`Win closed, returning: ${ifWinCloses}  [TyMWINCLSD03]`);
    return ifWinCloses;
  }
}


function isWindowClosedException(ex): boolean {
  // (Don't check for "no such window" — that might mean something else,
  // e.g. the window never existed at all.)
  const windowClosedText1 =
      // The full text is: "no such window: window was already closed"
      'window was already closed';
  const windowClosedText2 =
      // Full text: "no such window: target window already closed";
      "target window already closed";
  const exStr = ex.toString();
  return (
      exStr.indexOf(windowClosedText1) >= 0 ||
      exStr.indexOf(windowClosedText2) >= 0);
}

function isBadElemException(ex): boolean {
  // Webdriver says one of these: (what's the difference?)
  const StaleElem1 = 'Request encountered a stale element';
  const StaleElem2 = 'stale element reference: ';
  // Puppeteer instead says:
  const CannotFindId = 'Cannot find context with specified id';
  const exStr = ex.toString();
  return (
      exStr.indexOf(StaleElem1) >= 0 ||
      exStr.indexOf(StaleElem2) >= 0 ||
      exStr.indexOf(CannotFindId) >= 0);
}

function isClickInterceptedException(ex): boolean {
  return ex.toString?.().toLowerCase().indexOf('element click intercepted') >= 0;
}


const sfy: (any) => string = JSON.stringify;

function typeAndAsString(sth): string {
  return `type: ${typeof sth}, as string: ${JSON.stringify(sth)}`;
}

// Don't use, deprecated.
export interface MemberBrowser extends TyE2eTestBrowser, Member {
}

// Later, change TyAllE2eTestBrowsers to a class / interface that
// only makes available the TyE2eTestBrowser methods that work with all
// browsers at once. (Like  allBrowsers.go(url) or
// allBrowsers.waitForVisible(a-new-reply)).
// But for now:
//
export type TyAllE2eTestBrowsers = TyE2eTestBrowser;


export class TyE2eTestBrowser {

  #br: WebdriverIO.BrowserObject;

  constructor(aWdioBrowser: WebdriverIO.BrowserObject) {
    dieIf(!aWdioBrowser?.getPageSource,
        `Not a Wdio browser:  ${JSON.stringify(aWdioBrowser)}  [TyE2E7J02SAD35]`);
    this.#br = aWdioBrowser;
  }

  reloadSession(ps: { andGoTo?: St } = {}) {
    const whereToday = ps.andGoTo || this.getUrl();
    this.#br.reloadSession();
    this.go2(whereToday);
  }

  // The global $ might be for the wrong this.#br somehow, so:

  $(selector: St | Function | object): WElm {
    // Webdriver doesn't show the bad selector in any error message.
    dieIf(!_.isString(selector),
          `Selector is not a string: ${typeAndAsString(selector)}  [TyEE2E506QKSG35]`);
    try {
      return this.#br.$(selector);
    }
    catch (ex) {
      if (isWindowClosedException(ex)) {
        // This might be fine — happens when interacting with ext IDPS: their
        // login popups close a bit unpredictably. So don't log an error.
        logUnusual(`Window closed when looking for: ${selector}`)
      }
      else {
        // Webdriverio oddly enough won't print the bad selector, so won't know
        // what it is, unless:
        logError(`Webdriverio browser.$(..) error caused by selector:  "${selector}"`);
      }
      throw ex;
    }
  }

  $$(selector: string | Function): WebdriverIO.ElementArray {
    dieIf(!_.isString(selector),
        `Selector is not a string: ${typeAndAsString(selector)}  [TyEE2E702RMJ40673]`);
    return this.#br.$$(selector);
  }

  // This is short and nice, when debugging via log messages.
  l = logDebug as ((any) => void);

    // Short and nice.
  d(anyMessage?: string | number | (() => string)) {
    if (_.isFunction(anyMessage)) anyMessage = anyMessage();
    if (anyMessage) logUnusual('' + anyMessage);
    this.#br.debug();
  }

  #firstWindowHandle;
  #hostsVisited = {};
  #isWhere: IsWhere | U;
  #isOnEmbeddedCommentsPage = false;

  isOnEmbeddedPage(): boolean {
    return this.#isWhere && IsWhere.EmbFirst <= this.#isWhere && this.#isWhere <= IsWhere.EmbLast;
  }


    debug() {
      if (!settings.noDebug) { // doesn't seem to work, why not?
        this.#br.debug();
      }
    }

    origin(): string {
      return this._findOrigin();
    }

    // (Cannot replace this.#br.getUrl() — it's read-only.)
    getUrl(): string {
      const url = this.#br.getUrl();
      dieIf(url.indexOf('chrome-error:') >= 0,  // wasn't matched here, although present, weird.
          `You forgot to start an e2e test help server?  [TyENOHELPSRVR]`);
      return url;
    }

    waitUntilUrlIs(expectedUrl: St) {
      let urlNow: St;
      this.waitUntil(() => {
        urlNow = this.getUrl();
        return urlNow === expectedUrl;
      }, {
        message: () => `Waiting for url: ${expectedUrl}  currently: ${urlNow}`,
      });
    }

    /** @deprecated */
    getSource = () => this.#br.getPageSource();  // backw compat
    getPageSource = () => this.#br.getPageSource();

    host(): string {
      const origin = this.origin();
      return origin.replace(/https?:\/\//, '');
    }

    _findOrigin(anyUrl?: string): string {
      const url = anyUrl || this.#br.getUrl();
      const matches = url.match(/(https?:\/\/[^\/]+)\//);
      if (!matches) {
        throw Error(`No_origin_ in url: ${url}  (anyUrl: ${anyUrl})`);
      }
      return matches[1];
    }

    urlNoHash(): string {
      return this.#br.getUrl().replace(/#.*$/, '');;
    }

    urlPathQueryHash(): string {
      return this.#br.execute(function() {
        return location.pathname + location.search + location.hash;
      });
    }

    urlPath(): string {
      return this.#br.execute(function() {
        return location.pathname;
      });
    }

    deleteCookie(cookieName: string) {
      this.#br.deleteCookie(cookieName);
    }

    deleteAllCookies() {
      this.#br.deleteAllCookies();
    }

    execute<T>(script: ((...args: any[]) => T), ...args: any[]): T {
      return this.#br.execute.apply(this.#br, arguments);
    }

    refresh() {
      this.#br.refresh();
    }

    // Change all refresh() to refresh2, then remove '2' from name.
    // (Would need to add  waitForPageType: false  anywhere? Don't think so?)
    refresh2(ps: { isWhere?: IsWhere.EmbeddedPagesListPage } = {}) {
      this.#br.refresh();
      if (ps.isWhere) this.#isWhere = ps.isWhere;
      else this.__updateIsWhere();
    }

    back() {
      this.#br.back();
    }


    newWindow(url: St, thenWhat: 'StayInCurWin' | 'SwitchToNewWin') {
      // It seemed as if different drivers had different opinions about which
      // window should be active, after having opened a new one.
      // DevTools seemed to stay in the orig win (2020-11-19) — or was I mistaken,
      // now it, like Selenium, switches to the new win.
      // The docs says the new win becomes active.
      // Anyway, the below code works reardless of what the drivers do.
      const curWinHandle = this.#br.getWindowHandle();
      const handlesBefore: St[] = this.#br.getWindowHandles();

      this.#br.newWindow(url);

      const handlesAfter: St[] = this.#br.getWindowHandles();
      const newCurHandle = this.#br.getWindowHandle();
      const isInOldWin = newCurHandle === curWinHandle;
      const whereNow = isInOldWin ? `original` : `new`
      const switchToNew = thenWhat === 'SwitchToNewWin' && isInOldWin;
      const switchToOld = thenWhat === 'StayInCurWin' && !isInOldWin;
      const doNext = switchToNew ? `will switch to new win` : (
              switchToOld ? `will switch back to the orig win` : `fine`);
      logMessage(`Opened new window at: ${url}, ${whereNow} win active, ${doNext}`);
      logBoring(`Handles before: ${sfy(handlesBefore)}`);
      logBoring(`Handles after: ${sfy(handlesAfter)}`);

      let switchToWhat: St | U;
      if (switchToOld) {
        switchToWhat = curWinHandle;
      }
      else if (switchToNew) {
        switchToWhat = handlesAfter.find(h => !handlesBefore.includes(h));
        if (!switchToWhat) {
          logWarning(`Couldn't find new win handle to switch to`);
        }
      }

      if (switchToWhat) {
        this.#br.switchToWindow(switchToWhat);
        logMessage(`Switched to ${switchToWhat}.`);
        const handleNow = this.#br.getWindowHandle();
        dieIf(switchToWhat != handleNow,
              `Wrong handle after: ${handleNow} [TyE305MRKTM2]`);
      }
    }


    // Don't use. Change to go2 everywhere, then rename to 'go', and remove this old 'go'.
    go(url: string, opts: { useRateLimits?: boolean } = {}) {
      this.go2(url, { ...opts, waitForPageType: false });
    }

    go2(url: string, opts: { useRateLimits?: boolean, waitForPageType?: false,
          isExternalPage?: true, willBeWhere?: IsWhere } = {}) {

      let shallDisableRateLimits = false;

      this.#firstWindowHandle = this.#br.getWindowHandle();

      if (url[0] === '/') {
        // Local url, need to add origin.

        // Backw compat: wdio v4 navigated relative the top frame (but wdio v6 doesn't).
        this.switchToAnyParentFrame();

        try { url = this._findOrigin() + url; }
        catch (ex) {
          dieIf(ex.message?.indexOf('No_origin_') >= 0,
              `When opening the first page: ${url}, you need to specify the server origin [TyE7UKHW2]`);
          throw ex;
        }
      }
      else {
        // New origin? Then disable rate limits.
        if (!opts.useRateLimits) {
          const parts = url.split('/');
          const host = parts[2];
          if (!this.#hostsVisited[host]) {
            shallDisableRateLimits = true;
            this.#hostsVisited[host] = true;
          }
        }
      }

      const message = `Go: ${url}${shallDisableRateLimits ? "  & disable rate limits" : ''}`;
      logServerRequest(message);
      try {
        this.#br.navigateTo(url);
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
      if (opts.willBeWhere) {
        this.#isWhere = opts.willBeWhere;
      }
      else if (opts.isExternalPage) {  // CLEAN_UP  use opts.willBeWhere instead
        this.#isWhere = IsWhere.External;
      }
      else if (opts.waitForPageType === false) {
        // Backw compat.
        this.#isOnEmbeddedCommentsPage = false;
      }
      else {
        this.__updateIsWhere();
      }


      if (shallDisableRateLimits) {
        this.disableRateLimits();
      }
    }


    isWhere(): IsWhere { return this.#isWhere }


    updateIsWhere() {
      this.__updateIsWhere();
    }


    __updateIsWhere() {
      // .DW = discussion / topic list page.  .btn = e.g. a Continue-after-having-verified
      // -one's-email-addr page.
      // ('ed-comments' is old, deprecated, class name.)
      this.waitForExist('.DW, .talkyard-comments, .ed-comments, .btn');
      this.#isOnEmbeddedCommentsPage =
          this.$('.talkyard-comments').isExisting() ||
          this.$('.ed-comments').isExisting();
      this.#isWhere = this.#isOnEmbeddedCommentsPage ? IsWhere.EmbeddingPage : IsWhere.Forum;
    }


    goAndWaitForNewUrl(url: string) {
      logMessage("Go: " + url);
      this.rememberCurrentUrl();
      this.#br.url(url);
      this.waitForNewUrl();
    }


    disableRateLimits() {
      // Old, before I added the no-3rd-party-cookies tests.
      // Maybe instead always: server.skipRateLimits(siteId)  ?
      this.#br.execute(function(pwd) {
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
    }


    pause(millis: number) {
      logBoring(`Pausing ${millis} ms...`);
      this.#br.pause(millis);
    }

    // The real waitUntil doesn't work, the first test makes any  $('sth')
    // inside be just an empty obj {}.  — Mabe I forgot 'this'? Should be: this.$().
    // Anyway, this wait fn logs a message about what we're waiting for, can be nice.
    //
    // Returns true iff the event / condition happened, that is, if fn()
    // returned true before timeout.
    //
    waitUntil(fn: () => Bo, ps: WaitPs = {}): Bo {

      let delayMs = PollMs;
      let elapsedMs = 0;
      const timeoutMs = makeTimeoutMs(ps.timeoutMs);
      const startMs = Date.now();
      let loggedAnything = false;
      let loggedError = false;
      const getMsg = () => getOrCall(ps.message) || "Waiting for something";

      try {
        do {
          const done = fn();
          if (done) {
            if (loggedAnything) {
              logMessage(`Done: ${getMsg()}`);
            }
            return true;
          }

          elapsedMs = Date.now() - startMs;
          if (elapsedMs > AnnoyinglyLongMs) {
            loggedAnything = true;
            logMessage(`${elapsedMs} ms elapsed: ${getMsg()} ...`);
          }

          // Any unrecoverable error dialog? E.g. the server replied Error to a request.
          // However if the waiting message text is like "Waiting for .s_SED_Msg", then we're
          // waiting for the dialog itself, so then it's fine when it appears.
          // (Looking for '.s_SED_Msg' in ps.message is a bit hacky? but works.
          // And if stops working, some server error dialog tests should start
          // failing — easy to notice.)
          const waitingForServerError = () => getOrCall(ps.message)?.indexOf('s_SED_Msg') >= 0;
          if (elapsedMs > 500 && !waitingForServerError() && !ps.serverErrorDialogIsFine) {
            if (this.serverErrorDialog.isDisplayed()) {
              loggedError = true;
              this.serverErrorDialog.failTestAndShowDialogText();
            }
          }

          if (ps.refreshBetween) {
            // Good with the same amount of time before and after the refresh,
            // so the server gets time to do its things, and the browser gets time
            // to reload & repaint the page.
            this.#br.pause(delayMs / 2);
            this.refresh2();
            this.#br.pause(delayMs / 2);
          }
          else {
            this.#br.pause(delayMs);
          }
          delayMs = expBackoff(delayMs);
        }
        while (elapsedMs < timeoutMs);
      }
      catch (ex) {
        if (isWindowClosedException(ex)) {
          if (ps.winClosedIsFine) {
            logUnusual(`Win closed, thas's fine:  ${getMsg()}`);
            return false;
          }
          logError(`Win closed:  ${getMsg()}`);
        }
        else {
          logErrorIf(!loggedError,
                `Error in this.waitUntil() when:  ${getMsg()}  [TyEE2EWAIT]\n`, ex);
        }

        throw ex;
      }

      if (ps.timeoutIsFine === true) {
        logUnusual(`Timed out, that's fine:  ${getMsg()}`);
      }
      else {
        tyAssert.fail(`this.waitUntil() timeout after ${elapsedMs} ms:  ${
              getMsg()}  [TyEE2ETIMEOUT]`);
      }

      return false;
    }


    getPageId(): PageId {
      const result = this.#br.execute(function() {
        return window['theStore'].currentPageId;
      });
      dieIf(!result,
          `Error getting page id, result: ${JSON.stringify(result)} [TyE503KTTHA24]`);
      return result;
    }


    getSiteId(): SiteId {
      const result = this.#br.execute(function() {
        return window['eds'].siteId;
      });
      dieIf(!result || _.isNaN(parseInt(result)),
          "Error getting site id, result: " + JSON.stringify(result));
      return result;  // ? return  parseInt(result.value)  instead ?
    }



    me = {
      waitUntilLoggedIn: () => {
        this.complex.waitUntilLoggedIn();
      },

      waitUntilKnowsNotLoggedIn: (): TestMyself => {
        this.waitForMyDataAdded();
        let me = {} as Partial<TestMyself>;
        this.waitUntil(() => {
          me = this.me.waitAndGetMyself();
          return me && !me.isLoggedIn;
        }, {
          message: () =>
              `Waiting until not logged in, me now: ${me.username || me.fullName}`,
        });
        return me;
      },

      waitAndGetMyself: (): TestMyself => {
        return this.waitUntil(() => {
          return this.#br.execute(function() {
            try {
              return window['debiki2'].ReactStore.getMe();
            }
            catch {
              return false;
            }
          });
        }, {
          message: `Waiting for theStore.me  TyT6503MES63Z`
        }) as TestMyself;
      },
    }



    newSite = {
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
        this.go2(url);
        this.disableRateLimits();

        console.log("Fill in fields and submit...");
        this.createSite.fillInFieldsAndSubmit(data);

        // New site; disable rate limits here too.
        this.disableRateLimits();
        const siteId = this.getSiteId();
        const talkyardSiteOrigin = this.origin();

        return {
          data,
          testId: data.testId,
          siteId,
          talkyardSiteOrigin,
        }
      },


      signUpAsOwner: (newSiteResult: NewSiteResult) => {
        const data = newSiteResult.data;
        const siteId = newSiteResult.siteId;

        console.log("Click sign up as owner ...");
        this.createSite.clickOwnerSignupButton();

        console.log("... sign up as owner ...");
        switch (data.newSiteOwner) {
          case NewSiteOwnerType.OwenOwner:
            this.loginDialog.createPasswordAccount(data, true);
            const email = server.getLastEmailSenTo(siteId, data.email, this);
            const link = utils.findFirstLinkToUrlIn(
              data.origin + '/-/login-password-confirm-email', email.bodyHtmlText);
            this.go(link);
            this.waitAndClick('#e2eContinue');
            break;
          case NewSiteOwnerType.GmailAccount:
            this.loginDialog.createGmailAccount({
              email: settings.gmailEmail,
              password: settings.gmailPassword,
              username: data.username,
            }, { shallBecomeOwner: true });
            break;
          case NewSiteOwnerType.FacebookAccount:
            this.loginDialog.createFacebookAccount({
              email: settings.facebookAdminEmail,
              password: settings.facebookAdminPassword,
              username: data.username,
            }, { shallBecomeOwner: true });
            break;
          case NewSiteOwnerType.GitHubAccount:
            this.loginDialog.createGitHubAccount({
                username: settings.githubUsernameMixedCase,
                password: settings.githubPassword,
                shallBecomeOwner: true,
                alreadyLoggedInAtGitHub: data.alreadyLoggedInAtIdProvider });
            break;
          case NewSiteOwnerType.LinkedInAccount:
            this.loginDialog.createLinkedInAccount({
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
      },
    }


    makeNewSiteDataForEmbeddedComments(ps: { shortName: string, longName: string })
          : NewSiteData {
      // Dupl code [502KGAWH0]
      // Need to generate new local hostname, since we're going to create a new site.
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
    }


    numWindowsOpen(): number {
      return this.#br.getWindowHandles().length;
    }


    numTabs(): number {
      return this.#br.getWindowHandles().length;
    }

    waitForMinBrowserTabs(howMany: number, waitPs: WaitPs = {}): Bo {
      let numNow = -1;
      const message = () => `Waiting for >= ${howMany} tabs, currently ${numNow} tabs...`;
      return this.waitUntil(() => {
        numNow = this.numWindowsOpen();
        return numNow >= howMany;
      }, { ...waitPs, message });
    }

    waitForMaxBrowserTabs(howMany: number) {
      let numNow = -1;
      const message = () => `Waiting for <= ${howMany} tabs, currently ${numNow} tabs...`;
      this.waitUntil(() => {
        // Cannot be 0, that'd mean the test made itself disappear?
        numNow = this.#br.getWindowHandles().length;
        return numNow <= Math.max(1, howMany);
      }, { message, serverErrorDialogIsFine: true });
    }


    closeWindowSwitchToOther() {
      this.#br.closeWindow();
      // WebdriverIO would continue sending commands to the now closed window, unless:
      const handles = this.#br.getWindowHandles();
      dieIf(!handles.length, 'TyE396WKDEG2');
      if (handles.length === 1) {
        this.#br.switchToWindow(handles[0]);
      }
      if (handles.length >= 2) {
        // Maybe a developer has debug-opened other this.#br tabs?
        // Switch back to the original window, if possible.
        if (this.#firstWindowHandle && handles.indexOf(this.#firstWindowHandle)) {
          logUnusual(`There're ${handles.length} open windows — ` +
              `switching back to the original window...`);
          this.#br.switchToWindow(this.#firstWindowHandle);
        }
        else {
          die(`Don't know which window to switch to now. The original window is gone. [TyE05KPES]`);
        }
      }
    }


    swithToOtherTabOrWindow(isWhereAfter?: IsWhere) {
      for (let i = 0; i < 3; ++i) {
        logBoring("Waiting for other window to open, to avoid weird Selenium errors...");
        this.#br.pause(1500);
        if (this.numWindowsOpen() > 1)
          break;
      }
      const handles = this.#br.getWindowHandles();
      const curHandle = this.#br.getWindowHandle();
      for (let ix = 0; ix < handles.length; ++ix) {
        const handle = handles[ix];
        if (handle !== curHandle) {
          logMessage(`Calling this.#br.switchToWindow(handle = '${handle}')`);
          this.#br.switchToWindow(handle);
          logMessage(`... done, win handle is now: ${this.#br.getWindowHandle()}.`);
          if (isWhereAfter) {
            this.#isWhere = isWhereAfter;
          }
          else {
            this.__updateIsWhere();
          }
          return;
        }
      }
      // Might be a login popup that got auto closed? [3GRQU5]
      logMessage("No other window to switch to. [TyM2WPDL0]");
    }


    switchBackToFirstTabOrWindow() {
      // There should be no other windows, except for maybe a login popup.
      // Wait until it closes. However if a developer has opened more tabs and
      // does some experiments, so there're many open windows — then, continue anyway.
      let numWindows;
      this.waitUntil(() => {
        const ids = this.#br.getWindowHandles();
        numWindows = ids.length;
        return numWindows <= 1;
      }, {
        message: () => `Waiting for any loging popup to auto close, to avoid ` +
              `invalid window ID errors. Num windows open: ${numWindows}`,
        timeoutMs: 3000,
        timeoutIsFine: true,
        serverErrorDialogIsFine: true,
      });

      const winIds = this.#br.getWindowHandles();
      logWarningIf(winIds.length >= 2,
          `Still many windows open, window ids: ${JSON.stringify(winIds)}`);

      try {
        let switchToId;
        // The very first window that got opened is probably where we should continue.
        if (winIds.indexOf(this.#firstWindowHandle) >= 0) {
          logMessage(`Switching to this.#firstWindowHandle = ${this.#firstWindowHandle}`);
          switchToId = this.#firstWindowHandle;
        }
        else {
          // (Warning logged above, if >= 2 windows.)
          logMessage(`Switching to winIds[0] = ${winIds[0]}`);
          switchToId = winIds[0];
        }
        this.#br.switchToWindow(switchToId);
      }
      catch (ex) {
        // A race? The window just closed itself? Google and Facebook auto closes
        // login popup tabs, [3GRQU5] if one is logged in already at their
        // websites. Try again.
        logError(`Error switching window [TyEE2ESWWIN]`, ex);
        const idsAgain = this.#br.getWindowHandles();
        logMessage(`Trying again, switching to idsAgain[0]: ${idsAgain[0]} ...`);
        this.#br.switchToWindow(idsAgain[0]);
        // Don't catch.
      }

      this.__updateIsWhere();
    }


    _currentUrl = '';

    rememberCurrentUrl() {
      this._currentUrl = this.#br.getUrl();
    }

    waitForNewUrl() {
      assert(!!this._currentUrl, "Please call this.#br.rememberCurrentUrl() first [EsE7JYK24]");
      this.waitUntil(() => {
        return this._currentUrl !== this.#br.getUrl();
      }, {
        message: `Waiting for new URL, currently at: ${this._currentUrl}`
      });
      delete this._currentUrl;
    }

    repeatUntilAtNewUrl(fn: () => void) {
      const urlBefore = this.#br.getUrl();
      fn();
      const initDelayMs = 250;
      let delayMs = initDelayMs;
      this.#br.pause(delayMs);
      while (urlBefore === this.#br.getUrl()) {
        logMessageIf(delayMs > initDelayMs,
            `Repeating sth until at new URL, currently at: ${urlBefore}`);
        // E2EBUG RACE: if the url changes right here, maybe fn() below won't work,
        // will block.
        fn();
        delayMs = expBackoff(delayMs);
        this.#br.pause(delayMs);
      }
    }

    waitForNewOrigin(anyCurrentUrl?: string) {
      const currentUrl = anyCurrentUrl || this._currentUrl;
      assert(!!currentUrl, "Please call this.#br.rememberCurrentUrl() first [TyE603RK54]");
      const curOrigin = this._findOrigin(currentUrl);
      while (curOrigin === this.origin()) {
        this.#br.pause(250);
      }
      this._currentUrl = '';
    }


    isInIframe(): Bo {
      switch (this.#isWhere) {
        case IsWhere.EmbCommentsIframe:
        case IsWhere.EmbEditorIframe:
        case IsWhere.UnknownIframe:
          return true;
        default:
          // Old code below — but there's a race :- (
          // Use  refresh2() and go2() to avoid — then, #isWhere gets
          // updated properly.
      }

      // E2EBUG: Race. If clicking logout, then, the page reloads,
      // and eds.isInIframe is undefiend — it can seem as if we're not in an iframe,
      // even if we are. Causing switchToAnyParentFrame() to *not*
      // switch to the parent frame.
      logWarningIf(!this.#isWhere,
            `E2EBUG: Use go2() and refresh2() to avoid isInIframe() race [TyM03SMSQ3]`);

      return this.#br.execute(function() {
        return window['eds'] && window['eds'].isInIframe;
      });
    }


    frameParent() {
      die("Use switchToAnyParentFrame() instead [TyE306WKHJP2]");
    }


    switchToAnyParentFrame() {
      if (this.isInIframe()) {
        this.switchToTheParentFrame();
      }
    }


    switchToTheParentFrame(ps: { parentIs?: IsWhere } = {}) {
        dieIf(!this.isInIframe(), 'TyE406RKH2');
        this.#br.switchToParentFrame();
        // Skip, was some other oddity:
        // // Need to wait, otherwise apparently WebDriver can in rare cases run
        // // the next command in the wrong frame. Currently Talkyard or the e2e tests
        // // don't have iframes in iframes, so this'll work:
        // this.waitUntil(() => this.#br.execute(function() { return window.self === window.top; }), {
        //   message: `Waiting for this.#br to enter parent frame, until window.self === top`
        // });
        logMessage("Switched to parent frame.");
        if (ps.parentIs) {
          this.#isWhere = ps.parentIs;
        }
        else if (this.#isWhere === IsWhere.UnknownIframe) {
          // For now: (Later, might be in an embedded blog comments editor or discussion,
          // but right now (2020-07) there are no such tests.)
          this.#isWhere = IsWhere.Forum;
        }
        else {
          this.#isWhere = IsWhere.EmbeddingPage;
        }
    }


    switchToFrame(selector: string, ps: { timeoutMs?: number } = {}) {
      printBoringToStdout(`Switching to frame ${selector}...`);
      this.waitForExist(selector, ps);
      const iframe = this.$(selector);
      this.#br.switchToFrame(iframe);
      printBoringToStdout(` done, now in frame  ${selector}.\n`);
      this.#isWhere = IsWhere.UnknownIframe;
    }


    switchToLoginPopupIfEmbedded() {
      if (this.isOnEmbeddedPage()) {
        this.swithToOtherTabOrWindow(IsWhere.LoginPopup);
      }
    }


    switchBackToFirstTabIfNeeded() {
      if (this.#isWhere === IsWhere.LoginPopup) {
        this.switchBackToFirstTabOrWindow();
      }
    }


    waitForEmbeddedCommentsIframe() {
      // Can there be any emb comments iframe here?
      dieIf(this.#isWhere && this.#isWhere !== IsWhere.External &&
          this.#isWhere != IsWhere.EmbeddingPage,
          `No comments iframe here, this.#isWhere: ${this.#isWhere} [TyE6RKB2GR04]`);
      this.waitForExist('iframe#ed-embedded-comments');
      if (this.#isWhere) this.#isWhere = IsWhere.EmbeddingPage;
    }


    switchToEmbCommentsIframeIfNeeded() {
      if (!this.#isWhere || this.#isWhere == IsWhere.Forum)
        return;
      dieIf(!this.isOnEmbeddedPage(), `No embedded things here, this.#isWhere: ${this.#isWhere} [TyE703TKDLJ4]`);
      if (this.#isWhere !== IsWhere.EmbCommentsIframe) {
        this.switchToEmbeddedCommentsIrame();
      }
    }


    switchToEmbEditorIframeIfNeeded() {
      if (!this.#isWhere || this.#isWhere == IsWhere.Forum)
        return;
      dieIf(!this.isOnEmbeddedPage(), `No embedded things here, this.#isWhere: ${this.#isWhere} [TyE306WKH2]`);
      if (this.#isWhere !== IsWhere.EmbEditorIframe) {
        this.switchToEmbeddedEditorIrame();
      }
    }


    switchToEmbeddedCommentsIrame(ps: { waitForContent?: false } = {}) {
      this.switchToAnyParentFrame();
      // Let's wait for the editor iframe, so Reply buttons etc will work.
      this.waitForExist('iframe#ed-embedded-editor');
      this.switchToFrame('iframe#ed-embedded-comments');
      if (ps.waitForContent !== false) {
        this.waitForExist('.DW');
      }
      this.#isWhere = IsWhere.EmbCommentsIframe;
    }


    switchToEmbeddedEditorIrame() {
      this.switchToAnyParentFrame();
      // Let's wait for the comments iframe, so it can receive any messages from the editor iframe.
      this.waitForExist('iframe#ed-embedded-comments');
      this.switchToFrame('iframe#ed-embedded-editor');
      this.#isWhere = IsWhere.EmbEditorIframe;
    }


    getBoundingClientRect(selector: string, opts: { mustExist?: boolean } = {}): ElemRect | U {
      // Something like this might work too:
      //   const elemId: string = this.#br.findElement('css selector', selector);
      //   this.#br.getElementRect(elemId);  — how get the id?
      // But this already works:
      const result = this.#br.execute(function(selector) {
        var elem = document.querySelector(selector);
        if (!elem) return undefined;
        var rect = elem.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      }, selector);

      dieIf(!result && opts.mustExist !== false,
            `Cannot find selector:  ${selector}  [TyE046WKSTH24]`);
      return result;
    }


    getWindowHeight(): number {
       // Webdriver.io v5, just this?:
      // return this.#br.getWindowRect().height
      const result = this.#br.execute(function() {
        return window.innerHeight;
      });
      dieIf(!result, 'TyE7WKJP42');
      return result;
    }


    getPageScrollY(): number {
      return this.#br.execute(function(): number {
        var pageColumn = document.getElementById('esPageColumn');
        // ?? this works inside execute()?
        if (!pageColumn) throw Error("No #esPageColumn on this page [TyE7KBAQ2]");
        return pageColumn.scrollTop;
      });
    }


    getHtmlBodyScrollY(): Nr {
      return this.#br.execute(function(): Nr {
        return document.body.scrollTop;
      });
    }


    scrollIntoViewInPageColumn(selector: string) {   // RENAME to  scrollIntoView
      dieIf(!selector, '!selector [TyE05RKCD5]');
      const isInPageColResult = this.#br.execute(function(selector) {
        var pageColumn = document.getElementById('esPageColumn');
        if (!pageColumn)
          return false;
        var elem = document.querySelector(selector);
        return pageColumn.contains(elem);
      }, selector);
      if (isInPageColResult) {
        this._real_scrollIntoViewInPageColumn(selector);
      }
      else {
        // Elem outside page column (e.g. modal dialog), or there is no page column.
        this.waitForVisible(selector);
        const problem = this.#br.execute(function(selector) {
          // Not logMessage — we're in the this.#br.
          console.log(`Scrolling into view in window: ${selector}`);
          var elem = document.querySelector(selector);
          if (!elem)
            return `No such elem:  ${selector}  [TyE503RKDN]`;
          // Edge and Safari don't suppor 'smooth' though (as of 2019-01).
          elem.scrollIntoView({ behavior: 'smooth' });
        }, selector);
        logWarningIf(!!problem, `Scroll problem: ${problem}`);
      }
    }


    _real_scrollIntoViewInPageColumn (selector: string) { // RENAME to _scrollIntoViewInPageColumn
      dieIf(!selector, '!selector [TyE5WKT02JK4]');
      this.waitForVisible(selector);
      let lastScrollY = this.getPageScrollY();
      for (let i = 0; i < 60; ++i) {   // try for a bit more than 10 seconds
        this.#br.execute(function(selector) {
          // Not logMessage — we're in the this.#br.
          console.log(`Scrolling into view in page column: ${selector}`);
          window['debiki2'].utils.scrollIntoViewInPageColumn(
              selector, { marginTop: 100, marginBottom: 100, duration: 100 });
        }, selector);
        this.#br.pause(150);
        const curScrollY = this.getPageScrollY();
        if (lastScrollY === curScrollY) {
          // Done scrolling;
          return;
        }
        logMessage(`Scrolling <${selector}> into view in page column, scroll y: ${curScrollY} ...`);
        lastScrollY = curScrollY;
      }
      assert.fail(`Cannot scroll to: ${selector}`);
    }


    scrollToTop() {
      // Sometimes, the this.#br won't scroll to the top. [E2ENEEDSRETRY]
      // Who knows why. So try trice.
      utils.tryManyTimes('scrollToTop', 3, () => {
        // // I think some browsers wants to scroll <body> others want to scroll <html>, so do both.
        // // And if we're viewing a topic, need to scroll the page column insetad.  (4ABKW20)
        // this.#br.scroll('body', 0, 0);
        // this.#br.scroll('html', 0, 0);
        this.#br.execute(function() {
          window.scrollTo(0, 0);
          document.documentElement.scrollTop = 0; // not needed? but why not
          // If we're on a Talkyard page, scroll to its top.
          var pageElem = document.getElementById('esPageColumn');
          if (pageElem) pageElem.scrollTop = 0;
        });

        // Need to wait for the scroll to actually happen, otherwise Selenium/Webdriver
        // continues running subsequent test steps, without being at the top.
        let scrollTop;
        this.#br.waitUntil(() => {
          scrollTop = this.#br.execute(function() {
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
    }


    scrollToBottom() {
      //this.#br.scroll('body', 0, 999*1000);
      //this.#br.scroll('html', 0, 999*1000);
      //if (this.isVisible('#esPageColumn')) {
      //  this.#br.execute(function() {
      //    document.getElementById('esPageColumn').scrollTop = 999*1000;
      //  });
      //}
      this.#br.execute(function() {
        window.scrollTo(0, 999*1000);
        document.documentElement.scrollTop = 999*1000; // not needed? but why not
        // If we're on a Talkyard page, scroll to its bottom too.
        var pageElem = document.getElementById('esPageColumn');
        if (pageElem) pageElem.scrollTop = 999*1000;
      });

      // Need to wait for the scroll to actually happen. COULD instead maybe
      // waitUntil scrollTop = document height - viewport height?  but will probably be
      // one-pixel-too-litle-too-much errors? For now:
      this.#br.pause(500);
    }


    clickBackdrop() {
      this.waitAndClick('.fade.in.modal');
    }


    playTimeSeconds(seconds: number) {  // [4WKBISQ2]
      dieIf(!seconds, '!seconds [TyE503RKTSH25]');
      this.#br.execute(function (seconds) {
        // Don't use  logMessage in here; this is in the this.#br (!).
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
    }


    waitForMyDataAdded() {
      this.waitForVisible('.e2eMyDataAdded');
    }


    // Can be used to wait until a fade-&-scroll-in dialog is done scrolling in, for example.
    //
    waitUntilDoesNotMove(buttonSelector: string, pollInterval?: number) {
      let problem;
      this.waitUntil(() => {
        const location = this.getBoundingClientRect(buttonSelector, { mustExist: false });
        if (!location) {
          problem = `waitUntilDoesNotMove(..): Elem does not yet exist:  ${buttonSelector}`
          return false;
        }

        this.#br.pause(pollInterval || 50);

        const locationLater = this.getBoundingClientRect(buttonSelector, { mustExist: true });
        if (location.y !== locationLater.y || location.x !== locationLater.x) {
          problem = `Keeps moving and moving: '${buttonSelector}' [EdE7KFYU0]`;
          return false;
        }

        return true;
      }, {
        message: problem,
      });
    }


    count(selector: St): Nr {
      return tryOrIfWinCloses(() => this.$$(selector).length, undefined);
    }


    isExisting(selector: St): Bo {
      return tryOrIfWinCloses(() => this.$(selector).isExisting(), undefined);
    }


    isEnabled(selector: St): Bo {
      const elem: WElm = this.$(selector);
      // Sometimes these methods are missing, why?  [MISSINGFNS]
      const enabled = elem?.isExisting?.() && elem.isDisplayed?.() && elem.isEnabled?.();
      return !!enabled;
    }


    isVisible(selector: St): Bo {  // RENAME to isDisplayed, started, see below
      return this.isDisplayed(selector);
    }

    isDisplayed(selector: St): Bo {
      // Sometimes the elem methods below are missing, weird.  [MISSINGFNS]
      // Maybe if win closed so elem gone?

      const elem: WElm = this.$(selector);
      // Skip isExisting()?
      const displayed = elem?.isExisting?.() && elem.isDisplayed?.();
      return !!displayed;
    }


    isDisplayedInViewport(selector: St): Bo {
      // Sometimes the elem methods below are missing, weird.  [MISSINGFNS]
      const elem: WElm = this.$(selector);
      const displayed = elem?.isExisting?.() && elem.isDisplayedInViewport?.();
      return !!displayed;
    }


    // Makes it simple to find out which, of many, selectors won't appear,
    // or won't go away.
    filterVisible(selectors: string[],
            opts: { keepVisible?: true, exclVisible?: true } = {}): string[] {
      dieIf(!!opts.keepVisible === !!opts.exclVisible, 'TyE60RKDNF5');
      const result = [];
      for (let s of selectors) {
        if (this.isVisible(s) === !!opts.keepVisible) {
          result.push(s);
        }
      }
      return result;
    }


    waitForMaybeDisplayed(selector: string, ps: WaitPsWithOptText = {}): Bo {
      const what = ps.text ? `"${ps.text}" text` : selector
      const ps2 = {
        timeoutMs: 2000,
        timeoutIsFine: true,
        winClosedIsFine: true,
        message: `Waiting for any ${what}`,
      };
      if (ps.text) {
        return this.waitUntilTextIs(selector, ps.text, ps2);
      }
      else {
        return this.waitForDisplayed(selector, ps2);
      }
    }


    waitForDisplayed(selector: string, ps: WaitPs = {}): Bo {
      return this.waitForVisible(selector, ps);
    }

    waitForVisible(selector: string, ps: WaitPs = {}): Bo {  // RENAME to waitForDisplayed() above
      return this.waitUntil(() => this.isVisible(selector), {
        ...ps,
        message: `Waiting for visible:  ${selector}`,
      });
    }


    waitForDisplayedInViewport(selector: string, ps: WaitPs = {}) {
      this.waitUntil(() => this.isDisplayedInViewport(selector), {
        ...ps,
        message: `Waiting for dispalyed in viewport:  ${selector}`,
      });
    }


    // DEPRECATED use waitUntilGone  instead?
    waitForNotVisible(selector: string, timeoutMillis?: number) {
      for (let elapsed = 0; elapsed < timeoutMillis || true ; elapsed += PollMs) {
        if (!this.isVisible(selector))
          return;
        this.#br.pause(PollMs);
      }
      /*
      // API is: this.waitForDisplayed(selector[,ms][,reverse])
      logMessage(`this.waitForDisplayed('${selector}', timeoutMillis || true, timeoutMillis ? true : undefined);`);
      logWarning(`BUG just waits forever [2ABKRP83]`);
      assert(false);
      this.waitForDisplayed(selector, timeoutMillis || true, timeoutMillis ? true : undefined);
      */
    }


    // deprecated
    isDisplayedWithText(selector: string, text: string): boolean {
      // COULD_OPTIMIZE   test all at once — now the caller calls this fn many times instead.
      const elems = this.$$(selector);
      for (let elem of elems) {
        if (!elem.isDisplayed())
          continue;
        const actualText = elem.getText();
        if (actualText.indexOf(text) >= 0)
          return true;
      }
      return false;
    }


    waitForEnabled(selector: string, ps: { timeoutMs?: number, timeoutIsFine?: boolean } = {}) {
      this.waitUntil(() => this.isEnabled(selector), {
        ...ps,
        message: `Waiting for visible:  ${selector}`,
      });
    }


    waitForVisibleText(selector: string,
          ps: { timeoutMs?: number, timeoutIsFine?: boolean } = {}): boolean {
      let isExisting;
      let isDisplayed;
      let text;
      return this.waitUntil(() => {
        const elem: WebdriverIO.Element = this.$(selector);
        try {
          // Oddly enough, sometimes isDisplayed is not a function, below. Maybe isExisting()
          // also isn't, sometimes? They're undefined, then, or what? And why?
          // Anyway, let's use: `?.()`.
          isExisting = elem?.isExisting?.();
          if (!isExisting)
            return false;
          isDisplayed = elem.isDisplayed?.();
          if (!isDisplayed)
            return false;
          // This one blocks until the elem appears — so, need 'return' above.
          // Enable DEBUG WebdriverIO log level and you'll see:
          // """DEBUG webdriverio: command getText was called on an element ("#post-670")
          //       that wasn't found, waiting for it... """
          text = elem.getText?.();
        }
        catch (ex) {
          if (isBadElemException(ex)) {
            // Fine, maybe it didn't appear yet?
            logUnusual(`Bad element exception when waiting for:  ${
                  selector}  — will retry. The error: ${ex.toString()}`);
            return false;
          }
          if (isWindowClosedException(ex)) {
            logErrorNoTrace(`Window closed when waiting for:  ${selector}`);
          }
          throw ex;
        }
        return !!text;
      }, {
        ...ps,
        serverErrorDialogIsFine: selector.indexOf('.s_SED_Msg') >= 0,
        message: `Waiting for visible non-empty text, selector:  ${selector}\n` +
            `    isExisting: ${isExisting}, isDisplayed: ${isDisplayed}, getText: ${
            _.isUndefined(text) ? 'undefined' : `"${text}"`}`,
      });
    }

    getWholePageJsonStrAndObj(): [string, any] {
      // Chrome: The this.#br wraps the json response in a <html><body><pre> tag.
      // Firefox: Shows pretty json with expand/collapse sub trees buttons,
      // and we need click a #rawdata-tab to get a <pre> with json text to copy.
      return utils.tryManyTimes("copy json", 3, () => {
        this.waitForVisible('#rawdata-tab, pre');
        if (this.isVisible('#rawdata-tab')) {
          this.waitAndClick('#rawdata-tab');
        }
        const jsonStr: string = this.waitAndGetText('pre');
        const obj: any = JSON.parse(jsonStr);
        return [jsonStr, obj];
      });
    }


    waitUntilTextIs(selector: St, desiredText: St, opts: WaitPs = {}): Bo {
      return this.__waitUntilTextOrVal(selector, 'text', desiredText, opts);
    }

    waitUntilValueIs(selector: St, desiredValue: St, opts: WaitPs = {}): Bo {
      return this.__waitUntilTextOrVal(selector, 'value', desiredValue, opts);
    }

    __waitUntilTextOrVal(selector: St, what: 'text' | 'value', desiredValue: St,
            opts: WaitPs): Bo {
      let currentValue;
      this.waitForVisible(selector, opts);
      return this.waitUntil(() => {
        const elem = this.$(selector);
        currentValue = what === 'text' ? elem.getText() : elem.getValue();
        return currentValue === desiredValue;
      }, {
        ...pluckWaitPs(opts),
        message: `Waiting for ${what} of:  ${selector}  to be:  ${desiredValue}\n` +
        `  now it is: ${currentValue}`,
      });
    }

    waitForExist(selector: string, ps: WaitPs & { howMany?: number } = {}) {
      this.waitUntil(() => {
        const elem = this.$(selector);
        if (elem && elem.isExisting?.())
          return true;
      }, {
        ...pluckWaitPs(ps),
        message: `Waiting until exists:  ${selector}`,
      });

      if (ps.howMany) {
        this.waitForExactly(ps.howMany, selector);
      }
    }

    waitForGone(selector: St, ps: WaitPs = {}) {
      this.waitUntilGone(selector, ps);
    }

    tryClickNow(selector: St): ClickResult {
      if (!this.isExisting(selector))
        return 'CouldNotClick';
      return this.waitAndClick(selector, { timeoutMs: 500, timeoutIsFine: true });
    }

    waitAndClick(selector: St, opts: WaitAndClickPs = {}): ClickResult {
      return this._waitAndClickImpl(selector, opts);
    }


    waitAndClickFirst(selector: St, opts: WaitAndClickPs = {}): ClickResult {
      return this._waitAndClickImpl(selector, { ...opts, clickFirst: true });
    }


    waitAndClickLast(selector: St): ClickResult {
      return this.waitAndClickNth(selector, -1);
    }


    // Clicks or throws an error — unless timeoutIsFine, then
    // returns 'CouldNotClick' instead of throwing error.
    //
    // Works with many browsers at the same time   — probably not any longer?
    //
    _waitAndClickImpl(selector: St, ps: WaitAndClickPs = {}): ClickResult {
      selector = selector.trim(); // so selector[0] below, works
      if (this._waitForClickable(selector, ps) !== 'Clickable')
        return 'CouldNotClick';

      if (selector[0] !== '#' && !ps.clickFirst) {
        const elems = this.$$(selector);
        dieIf(elems.length > 1,
            `Don't know which one of ${elems.length} elems to click. ` +
            `Selector:  ${selector} [TyE305KSU]`);
      }
     return this.clickNow(selector);
    }


    clickNow(selEl: SelectorOrElem): 'Clicked' {
      try {
        if (_.isString(selEl)) this.$(selEl).click();
        else selEl.click();
        return 'Clicked';
      }
      catch (ex) {
        const what = _.isString(selEl) ? `'${selEl}'` : 'elem';
        logWarning(`Error clicking ${what}: ${ex.toString()}`);
        if (isClickInterceptedException(ex)) {
          // This can happen if server error dialog appeared.
          if (this.serverErrorDialog.isDisplayed()) {
            this.serverErrorDialog.failTestAndShowDialogText();
          }
        }
        throw ex;
      }
    }

    // For one this.#br at a time only.
    // n starts on 1 not 0. -1 clicks the last, -2 the last but one etc.
    waitAndClickNth(selector: string, n: number): ClickResult {   // BUG will only scroll the 1st elem into view [05YKTDTH4]
      dieIf(n <= 0, "n starts on 1, change from 0 to 1 please");
      logWarningIf(n !== 1,
          `n = ${n} !== 1, won't scroll into view before trying to click, maybe will miss:  ${selector} [05YKTDTH4]`);

      // Currently always throws if couldn't click — timeoutIsFine isn't set.
      if (this._waitForClickable(selector) !== 'Clickable')
        return 'CouldNotClick';

      const elems = this.$$(selector);
      assert(elems.length >= n, `Elem ${n} missing: Only ${elems.length} elems match: ${selector}`);
      const index = n > 0
          ? n - 1
          : elems.length - (-n); // count from the end

      const elemToClick = elems[index];
      dieIf(!elemToClick, selector + ' TyE36KT74356');
      return this.clickNow(elemToClick);
    }


    // Throws, unless opts.timeoutIsFine.
    _waitForClickable (selector: St,  // RENAME? to scrollToAndWaitUntilCanInteract
          opts: WaitAndClickPs = {}): WaitForClickableResult {
      const clickable = this.waitUntil(() => {
        this.waitForVisible(selector, { timeoutMs: opts.timeoutMs });
        this.waitForEnabled(selector, { timeoutMs: opts.timeoutMs });
        if (opts.mayScroll !== false) {
          // fix sleeping? bugs: [E2EBUG] set maybeMoves to true if did actually scroll
          this.scrollIntoViewInPageColumn(selector);
        }
        if (opts.maybeMoves) {
          this.waitUntilDoesNotMove(selector);
        }

        // Sometimes, a not-yet-done-loading-data-from-server overlays the element and steals
        // any click. Or a modal dialog, or nested modal dialog, that is fading away, steals
        // the click. Unless:
        if (opts.waitUntilNotOccluded !== false) {
          const notOccluded = this.waitUntilElementNotOccluded(
                  selector, { okayOccluders: opts.okayOccluders, timeoutMs: 700,
                      timeoutIsFine: true });
          if (notOccluded)
            return true;

          // Else: This can happen if something above `selector`, maybe an iframe or
          // image, just finished loading, and is a bit tall so it pushed `selector`
          // downwards, outside the viewport. Then, waitUntilElementNotOccluded() times
          // out, returns false.
          // — Maybe we need to scroll down to `selector` again, at its new position,
          // so run this fn again (waitUntil() above will do for us).
        }
        else {
          // We can at least do this — until then, nothing is clickable.
          this.waitUntilLoadingOverlayGone();
          return true;
        }
      }, {
        ...pluckWaitPs(opts),
        message: `Waiting for  ${selector}  to be clickable`
      });
      return clickable ? 'Clickable' : 'NotClickable';
    }


    waitUntilGone(what: St, ps: { timeoutMs?: Nr, timeoutIsFine?: Bo } = {}): Bo {   // RENAME to waitUntilCannotSee ?
      const isGone = this.waitUntil(() => {
        try {
          const elem = this.$(what);
          const gone = !elem || !elem.isExisting() || !elem.isDisplayed();
          if (gone)
            return true;
        }
        catch (ex) {
          if (isBadElemException(ex)) {
            logMessage(`Seems is gone:  ${what}  — continuing ...`);
            return true;
          }
          if (isWindowClosedException(ex)) {
            logWarning(`Window closed when waiting for: ${what
                  } to disappear [TyE5F2AM63R]`);
          }
          else {
            logWarning(`Exception when waiting for:  ${what}  to disappear [TyE3062784]:\n` +
                ` ${ex.toString()}\n`);
          }
          throw ex;
        }
      }, {
        ...ps,
        message: `Waiting until gone:  ${what}  ... [TyME2EWAITGONE]`
      });
        /*
        const resultsByBrowser = this.isVisible(what);
        const values = allBrowserValues(resultsByBrowser);
        return _.every(values, x => !x ); */

      // If ps.timeoutIsFine, `what` might not be gone.
      return isGone;
    }

    focus(selector: string, opts?: { maybeMoves?: true,
          timeoutMs?: number, okayOccluders?: string }) {
      this._waitForClickable(selector, opts);
      this.clickNow(selector);
    }

    // DEPRECATED  use waitUntil(...  refreshBetween: true) instead
    refreshUntil(test: () => boolean) {
      while (true) {
        if (test())
          return;
        this.#br.pause(PollMs / 3);
        this.#br.refresh();
        this.#br.pause(PollMs * 2 / 3);
      }
    }

    refreshUntilGone(what: string, opts: { waitForMyDataAdded?: boolean } = {}) {
      while (true) {
        if (opts.waitForMyDataAdded) {
          this.waitForMyDataAdded();
        }
        let resultsByBrowser = this.isVisible(what);
        let isVisibleValues = allBrowserValues(resultsByBrowser);
        let goneEverywhere = !_.some(isVisibleValues);
        if (goneEverywhere) break;
        this.#br.refresh();
        this.#br.pause(250);
      }
    }

    __theLoadingOveraySelector = '#theLoadingOverlay';

    waitUntilLoadingOverlayGone() {
      this.waitUntilGone(this.__theLoadingOveraySelector);
    }

    waitUntilLoadingOverlayVisible_raceCond () {
      // The loading overlay might disappear at any time, when done loading. (309362485)
      // So not impossible that e2e tests that use this fn, sometimes break
      // (that's fine, we'll just retry them).
      this.waitForVisible(this.__theLoadingOveraySelector);
    }

    isLoadingOverlayVisible_raceCond (): boolean {
      // A race: It might disappear at any time. (309362485)
      return this.isVisible(this.__theLoadingOveraySelector);
    }

    waitUntilModalGone() {
      this.#br.waitUntil(() => {
        // Check for the modal backdrop (it makes the stuff not in the dialog darker).
        let resultsByBrowser = this.isVisible('.modal-backdrop');
        let values = allBrowserValues(resultsByBrowser);
        let anyVisible = _.some(values, x => x);
        if (anyVisible)
          return false;
        // Check for the block containing the modal itself.
        // This sometimes fails, if waitUntilModalGone() is done in 'everyonesBrowser'.  [4JBKF20]
        // I suppose in one this.#br, the modal is present, but in another, it's gone... somehow
        // resulting in Selenium failing with a """ERROR: stale element reference: element
        // is not attached to the page document""" error.
        resultsByBrowser = this.isVisible('.fade.modal');
        values = allBrowserValues(resultsByBrowser);
        anyVisible = _.some(values, x => x);
        return !anyVisible;
      });
      this.waitUntilGone('.fade.modal');
    }

    // Returns true iff the elem is no longer occluded.
    //
    waitUntilElementNotOccluded(selector: string, opts: {
          okayOccluders?: string, timeoutMs?: number, timeoutIsFine?: boolean } = {}): boolean {
      dieIf(!selector, '!selector,  [TyE7WKSH206]');
      let result: [St, St] | true;
      return this.waitUntil(() => {
        result = <[St, St] | true> this.#br.execute(function(selector, okayOccluders): [St, St] | Bo {
          var elem = document.querySelector(selector);
          if (!elem)
            return [`No elem matches:  ${selector}`, ''];

          var rect = elem.getBoundingClientRect();
          var middleX = rect.left + rect.width / 2;
          var middleY = rect.top + rect.height / 2;
          var elemAtTopOfCenter = document.elementFromPoint(middleX, middleY);
          if (!elemAtTopOfCenter) {
            // This happens if the elem is outside the viewport.
            return [`Elem not in viewport? ` +
                `elementFromPoint(${middleX}, ${middleY}) returns: ${elemAtTopOfCenter}, ` +
                `elem top left width height: ` +
                  `${rect.left}, ${rect.top}, ${rect.width}, ${rect.height}\n` +
                `--- elem.innerHTML.substr(0,100): ------------------------\n` +
                `${elem.innerHTML?.substr(0,100)}\n` +
                `----------------------------------------------------------`, ''];
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
          var occludersTextContent = elemAtTopOfCenter.textContent;
          // Return the id/class of the thing that occludes 'elem'.
          return [`Occluded by: ${elemIdClass + maybeWeird}`, occludersTextContent];
        }, selector, opts.okayOccluders || '');

        dieIf(!_.isBoolean(result) && !_.isString(result[0]) && !_.isString(result[1]),
            `Error checking if elem interactable, result: ${
                JSON.stringify(result) }  [TyE306KT73S]`);

        return result === true;
      }, {
        timeoutMs: opts.timeoutMs,
        timeoutIsFine: opts.timeoutIsFine,
        message: () =>
            `Waiting for elem [ ${selector} ] to not be occluded, ` +
                `okayOccluders: [ ${opts.okayOccluders} ],\n` +
            `problem: ${result[0]}, occluder's text content: """${result[1]}"""`,

      });
    }

    waitForAtLeast(num: number, selector: string) {
      this._waitForHowManyImpl(num, selector, '>= ');
    }

    waitForAtMost(num: number, selector: string) {
      this._waitForHowManyImpl(num, selector, '<= ');
    }

    waitForExactly(num: number, selector: string) {
      this._waitForHowManyImpl(num, selector, '');
    }

    _waitForHowManyImpl(num: number, selector: string, compareHow: '>= ' | '<= ' | '') {
      let numNow = 0;
      this.waitUntil(() => {
        numNow = this.count(selector);
        switch (compareHow) {
          case '>= ': return numNow >= num;
          case '<= ': return numNow <= num;
          default: return numNow === num;
        }
      }, {
        message: () => `Waiting for ${compareHow}${num}  ${selector}  there are: ${numNow}`
      });
    }

    assertExactly(num: number, selector: string) {
      let errorString = '';
      const elems = this.$$(selector);
      //let resultsByBrowser = byBrowser(this.#br.elements(selector));
      //_.forOwn(resultsByBrowser, (result, browserName) => {
        if (elems.length !== num) {
          //errorString += browserNamePrefix(browserName) + ...
          errorString += "Selector '" + selector + "' matches " +
              elems.length + " elems, but there should be exactly " + num + "\n";
        }
      //});
      assert.ok(!errorString, errorString);
    }


    keys(keyStrokes: string | string[]) {
      this.#br.keys(keyStrokes);
    }

    waitAndPasteClipboard(selector: string, opts?: { maybeMoves?: true,
          timeoutMs?: number, okayOccluders?: string }) {
      this.focus(selector, opts);
      // Different keys:
      // https://w3c.github.io/webdriver/#keyboard-actions
      this.#br.keys(['Control','v']);
    }


    waitAndSelectFile(selector: string, whichDir: 'TargetDir' | 'TestMediaDir',
        fileName: string) {

      const pathToUpload = (whichDir === 'TargetDir'
          // Step up from  tests/e2e/utils/  to  tests/e2e/target/:
          ? path.join(__dirname, '..', 'target', fileName)
          // Step down-up from  tests/e2e/utils/  to  tests/test-media/.
          : path.join(__dirname, '..', '..', 'test-media', fileName));

      logMessage("Uploading file: " + pathToUpload.toString());
      logWarningIf(settings.useDevtoolsProtocol,
          `BUT this.#br.uploadFile() DOES NOT WORK WITH THIS PROTOCOL, 'DevTools' [TyEE2EBADPROTO]`);
      // Requires Selenium or Chromedriver; the devtools protocol ('webtools' service) won't work.
      const remoteFilePath = this.#br.uploadFile(pathToUpload);
      this.$(selector).setValue(remoteFilePath);
    }


    scrollAndSetValue(selector: string, value: string | number,
        opts: { timeoutMs?: number, okayOccluders?: string, append?: boolean } = {}) {
      this.scrollIntoViewInPageColumn(selector);
      this.waitUntilDoesNotMove(selector);
      this.waitAndSetValue(selector, value, { ...opts, checkAndRetry: true });
    }


    waitAndSetValue(selector: string, value: string | number,
        opts: { maybeMoves?: true, checkAndRetry?: true, timeoutMs?: number,
            okayOccluders?: string, append?: boolean, skipWait?: true } = {}) {

      if (opts.append) {
        dieIf(!_.isString(value), `Can only append strings [TyE692RKR3J]`);
        dieIf(!value, `Appending nothing does nothing [TyE3355RKUTGJ6]`);
      }
      if (_.isString(value)) {
        // Chrome/Webdriverio/whatever for some reason changes a single space
        // to a weird char. (259267730)
        // But '\n' seems to result in Enter in Chrome and FF. [E2EENTERKEY]
        dieIf(isBlank(value) && value.length > 0 && value !== '\n',
            `Chrome or Webdriverio dislikes whitespace [TyE50KDTGF34]`);
      }

      //// Sometimes these tests aren't enough! [6AKBR45] The elem still isn't editable.
      //// How is that possible? What more to check for?
      //// Results in an "<element> is not reachable by keyboard" error.
      //this.waitForVisible(selector, opts.timeoutMs);
      //this.waitForEnabled(selector);
      //this.waitUntilLoadingOverlayGone();
      //if (opts.maybeMoves) {
      //  this.waitUntilDoesNotMove(selector);
      //}
      if (!opts.skipWait) {
        this._waitForClickable(selector, opts);
      }

        // Sometimes, when starting typing, React does a refresh / unmount?
        // — maybe the mysterious unmount e2e test problem [5QKBRQ] ? [E2EBUG]
        // so the remaining characters gets lost. Then, try again.
      this.waitUntil(() => {
          // Old comment, DO_AFTER 2020-08-01: Delete this comment.
          // This used to work, and still works in FF, but Chrome nowadays (2018-12)
          // just appends instead — now works again, with Webdriverio v6.
          //this.#br.setValue(selector, value);
          // GitHub issue and a more recent & better workaround?:
          //  https://github.com/webdriverio/webdriverio/issues/3024#issuecomment-542888255
          
          const elem = this.$(selector);
          const oldText = elem.getValue();

          if (opts.append) {
            dieIf(!value, 'TyE29TKP0565');
            // Move the cursor to the end — it might be at the beginning, if text got
            // loaded from the server and inserted after [the editable elem had appeared
            // already, with the cursor at the beginning].
            this.focus(selector);
            this.#br.keys(Array('Control', 'End'));
            // Now we can append.
            elem.addValue(value);
          }
          else if (_.isNumber(value)) {
            elem.setValue(value);
          }
          else if (!value) {
            // elem.clearValue();  // doesn't work, triggers no React.js events
            // elem.setValue('');  // also triggers no event
            // elem.setValue(' '); // adds a weird square char, why? (259267730) Looks
                     //  like a flower instead though, if printed in the Linux console.
            // But this:
            //elem.setValue('x'); // eh, stopped working, WebdriverIO v6.0.14 —> 6.0.15 ? what ?
            //this.#br.keys(['Backspace']);  // properly triggers React.js event
            // Instead:
            elem.setValue('x');  // focus it without clicking (in case a placeholder above)
            this.#br.keys(Array(oldText.length + 1).fill('Backspace'));  // + 1 = the 'x'
          }
          else {
            // --------------------------------
            // With WebDriver, setValue *appends* :- (  But works fine with Puppeteer.
            // So, if WebDriver, first clear the value:
            // elem.clearValue(); — has no effect, with WebDriver. Works with Puppeteer.
            elem.setValue('x');  // appends, and focuses it without clicking
                                  // (in case a placeholder text above)
            // Delete chars one at a time:
            this.#br.keys(Array(oldText.length + 1).fill('Backspace'));  // + 1 = the 'x'
            // --------------------------------
            elem.setValue(value);
          }

          if (!opts.checkAndRetry)
            return true;

          this.#br.pause(200);

          const valueReadBack = elem.getValue();
          const desiredValue = (opts.append ? oldText : '') + value;

          if (desiredValue === valueReadBack)
            return true;

          logUnusual('\n' +
            `   Couldn't set value to:  ${desiredValue}\n` +
            `   got back when reading:  ${valueReadBack}\n` +
            `                selector:  ${selector}   — trying again... [TyME2E5MKSRJ2]`);
      });
    }


    waitAndSetValueForId(id: string, value: string | number) {
      this.waitAndSetValue('#' + id, value);
    }


    waitAndClickSelectorWithText(selector: string, regex: string | RegExp) {
      this.waitForThenClickText(selector, regex);
    }

    waitForThenClickText(selector: St, regex: St | RegExp,
            opts: { tryNumTimes?: Nr } = {}) {   // RENAME to waitAndClickSelectorWithText (above)
      // [E2EBUG] COULD check if visible and enabled, and loading overlay gone? before clicking
      const numTries = opts.tryNumTimes || 3;
      utils.tryManyTimes(`waitForThenClickText(${selector}, ${regex})`, numTries, () => {
        const elem = this.waitAndGetElemWithText(selector, regex);
        this.clickNow(elem);
      });
    }


    waitUntilTextMatches(selector: string, regex: string | RegExp,
            opts: { timeoutMs?: number, invert?: boolean } = {}) {
      this.waitAndGetElemWithText(selector, regex, opts);
    }


    waitUntilHtmlMatches(selector: string, regexOrStr: string | RegExp | any[]) {
      this.waitForExist(selector);

      for (let i = 0; true; ++i) {
        const html = this.$(selector).getHTML();
        const anyMiss = this._findHtmlMatchMiss(html, true, regexOrStr);
        if (!anyMiss)
          break;

        this.#br.pause(PollMs);
        if (i > 10 && (i % 10 === 0)) {
          console.log(`Waiting for '${selector}' to match: \`${anyMiss}'\n` +
            `but the html is:\n-----${html}\n----`);
        }
      }
    }


    _findHtmlMatchMiss (html: string, shouldMatch: boolean, regexOrStr: string | RegExp | any[])
          : string | null {

      const matchMiss = shouldMatch ? "match" : "miss";
      if (traceOrDebug) {
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

        if (traceOrDebug) {
          logMessage(
              `Should ${matchMiss}: ${regex}, does ${matchMiss}: ` +
                `${ shouldMatch ? doesMatch : !doesMatch }`);
        }

        // If incorrect match/miss, return the failing regex.
        if (shouldMatch != doesMatch)
          return ros;
      }
      return null;
    }


    waitAndAssertVisibleTextIs(selector: St, expected: St) {
      const actual = this.waitAndGetVisibleText(selector);
      tyAssert.ok(actual === expected, '\n\n' +
          `  Text of element selected by:  ${selector}\n` +
          `            should be exactly:  "${expected}"\n` +
          `      but is: (between --- )\n` +
          `------------------------------------\n` +
          `${actual}\n` +
          `------------------------------------\n`);
    }


    waitAndAssertVisibleTextMatches(selector: string, stringOrRegex: string | RegExp) {
      const regex = getRegExpOrDie(stringOrRegex);
      const text = this.waitAndGetVisibleText(selector);
      // This is easy to read:  [E2EEASYREAD]
      tyAssert.ok(regex.test(text), '\n\n' +
          `  Text of element selected by:  ${selector}\n` +
          `                 should match:  ${regex.toString()}\n` +
          `      but is: (between --- )\n` +
          `------------------------------------\n` +
          `${text}\n` +
          `------------------------------------\n`);
    }


    waitAndGetElemWithText(selector: string, stringOrRegex: string | RegExp,
          opts: { timeoutMs?: number, invert?: boolean } = {}): WebdriverIO.Element {
      const regex = getRegExpOrDie(stringOrRegex);

      // Don't use this.#br.waitUntil(..) — exceptions in waitUntil apparently don't
      // propagade to the caller, and instead always break the test. E.g. using
      // a stale elem ref in an ok harmless way, apparently breaks the test.
      const startMs = Date.now();
      for (let pauseMs = PollMs; true; pauseMs *= PollExpBackoff) {
        const elems = this.$$(selector);
        let texts = '';
        for (let i = 0; i < elems.length; ++i) {
          const elem = elems[i];
          const text = elem.getText();
          const matches = regex.test(text);
          if (matches && !opts.invert || !matches && opts.invert)
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

        if (opts.timeoutMs && elapsedMs > opts.timeoutMs) {
          tyAssert.fail(`Didn't find text ${regex} in selector '${selector}'. ` +
            `Instead, the matching selectors texts are: [${texts}]  [TyE40MRBL25]`)
        }

        this.#br.pause(Math.min(pauseMs, PollMaxMs));
      }
    }


    getText(selector: string): string {  // RENAME to waitAndGetText
                                              // and thereafter, die(...) in this.getText().
      return this.waitAndGetText(selector);
    }


    waitAndGetText(selector: string): string {
      // Maybe not visible, if empty text? So use  waitForExist() here — and,
      // in waitAndGetVisibleText() just below, we waitForVisible() instead.
      this.waitForExist(selector);
      return this.$(selector).getText();
    }


    waitAndGetValue(selector: string): string {
      this.waitForExist(selector);
      return this.$(selector).getValue();
    }


    assertValueIs(selector: St, expected: St) {
      const actual = this.waitAndGetValue(selector);
      // [E2EEASYREAD].
      tyAssert.ok(actual === expected, '\n' +
        `Value of elem selected by:  ${selector}\n` +
        `           does not match:  ${expected}\n` +
        `    actual value: (between ---)\n` +
        `-------------------------------------------\n` +
        `${actual}\n` +
        `-------------------------------------------\n`);
    }


    waitAndGetVisibleText(selector): string {
      this.waitForVisibleText(selector);
      return this.$(selector).getText();
    }


    waitAndGetVisibleHtml(selector): string {
      this.waitForVisibleText(selector);
      return this.$(selector).getHTML();
    }


    assertTextIs(selector: St, text: St) {
      this.assertTextMatches(selector, text, 'exact');
    }


    assertTextMatches(selector: string, regex: string | RegExp | (string | RegExp)[],
          how: 'regex' | 'exact' | 'includes' = 'regex') {
      this._assertOneOrAnyTextMatches(false, selector, regex, how);
    }


    waitUntilAnyTextMatches(selector: string, stringOrRegex: string | RegExp) {
      const regex = getRegExpOrDie(stringOrRegex);
      let num;
      this.waitUntil(() => {
        const items = this.$$(selector);
        num = items.length;
        for (let item of items) {
          if (regex.test(item.getText()))
            return true;
        }
      }, {
        message: `Waiting for any  ${selector}  (there are ${num}, now) to match:  ${regex}`
      })
    }


    assertAnyTextMatches(selector: string, regex: string | RegExp | (string | RegExp)[],
            how: 'regex' | 'exact' | 'includes' = 'regex') {
      this._assertOneOrAnyTextMatches(true, selector, regex, how);
    }


    // n starts on 1 not 0.
    // Also see:  assertNthClassIncludes
    assertNthTextMatches(selector: string, n: number,
          stringOrRegex: string | RegExp, stringOrRegex2?: string | RegExp,
          ps?: { caseless?: Bo }) {
      const regex = getRegExpOrDie(stringOrRegex);
      const regex2 = getAnyRegExpOrDie(stringOrRegex2);

      assert(n >= 1, "n starts on 1, change from 0 to 1 please");
      const items = this.$$(selector);
      assert(items.length >= n, `Elem ${n} missing: Only ${items.length} elems match: ${selector}`);

      let text = items[n - 1].getText();
      if (ps?.caseless) {
        text = text.toLowerCase();
      }

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
    }


    // n starts on 1 not 0.
    // Also see:  assertNthTextMatches
    assertNthClassIncludes(selector: string, n: number, classToFind: string) {
      assert(n >= 1, "n starts on 1, change from 0 to 1 please");
      const items = this.$$(selector);
      assert(items.length >= n, `Elem ${n} missing: Only ${items.length} elems match: ${selector}`);
      const actuallClassAttr = getNthFromStartOrEnd(n, items).getAttribute('class');
      const regex = new RegExp(`\\b${classToFind}\\b`);
      // Simple to read [E2EEASYREAD].
      assert(regex.test(actuallClassAttr), '\n' +
        `       Elem ${n} selected by:  ${selector}\n` +
           `  doesn't have this class:  ${classToFind}\n` +
           `           instead it has:  ${actuallClassAttr}\n`);
    }


    assertNoTextMatches(selector: string, regex: string | RegExp) {
      this._assertAnyOrNoneMatches(selector, false, regex, 'regex');
    }


    _assertOneOrAnyTextMatches (many, selector: string,
          stringOrRegex: string | RegExp | (string | RegExp)[],
          how: 'regex' | 'exact' | 'includes') {
      this._assertAnyOrNoneMatches(selector, true, stringOrRegex, how);
      //process.stdout.write('■');
      //if (fast === 'FAST') {
        // This works with only one this.#br at a time, so only use if FAST, or tests will break.
        //this._assertAnyOrNoneMatches(selector, true, regex, regex2);
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
      assert(this.isVisible(selector), `Selector '${selector}' not visible, cannot match text [EdE1WBPGY93]`);  // this could be the very-slow-thing (24DKR0) COULD_OPTIMIZE
      const textByBrowserName = byBrowser(this.#br.getText(selector));  // SLOW !!
      _.forOwn(textByBrowserName, function(text, browserName) {
        const whichBrowser = isTheOnly(browserName) ? '' : ", this.#br: " + browserName;
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
    }


    _assertAnyOrNoneMatches (selector: string, shallMatch: boolean,
          stringOrRegex: string | RegExp | (string | RegExp)[],
          how: 'regex' | 'exact' | 'includes') {

      let text: string;
      let text2: string;
      let regex: RegExp;
      let regex2: RegExp;
      if (_.isArray(stringOrRegex)) {
        dieIf(stringOrRegex.length > 2, 'TyE3056K');
        if (how === 'regex') {
          regex = getRegExpOrDie(stringOrRegex[0]);
          regex2 = getAnyRegExpOrDie(stringOrRegex[1]);
        }
        else {
          die('unimpl [TyE96RKT345R]');
          //text = stringOrRegex[0] as string;
          //text2 = stringOrRegex[1] as string;
        }
      }
      else {
        if (how === 'regex') {
          regex = getRegExpOrDie(stringOrRegex);
        }
        else {
          dieIf(_.isRegExp(stringOrRegex), 'TyE3056KTD57P');
          text = stringOrRegex as string;
        }
      }

      dieIf(_.isString(regex2) && !shallMatch,
          `two regexps only supported if shallMatch = true`);

      const elems = this.$$(selector);

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
        const elemText = elem.getText();
        const matchesRegex1 = regex ? regex.test(elemText) : (
                how === 'includes'
                    ? elemText.indexOf(text) >= 0
                    : elemText === text);

        const matchesAnyRegex2 = regex2 && regex2.test(elemText);

        const what = how === 'regex' ? 'regex' : 'text';

        if (shallMatch) {
          if (!matchesRegex1) {
            problems +=
                `  Elem ix ${i}: Misses ${what} 1:  ${regex || text}\n` +
                `    elem text:  "${elemText}"\n`;
            continue;
          }
          if (regex2 && !matchesAnyRegex2) {
            problems +=
                `  Elem ix ${i}: Misses ${what} 2:  ${regex2 || text2}\n` +
                `    elem text:  "${elemText}"\n`;
            continue;
          }
          // All fine, forget all problems — it's enough if one elem matches.
          return;
        }
        else {
          if (matchesRegex1) {
            problems +=
                `  Elem ix ${i}: Matches ${what} 1:  ${regex || text}  (but should not)\n` +
                `    elem text:  "${elemText}"\n`;
            continue;
          }
          if (regex2 && matchesAnyRegex2) {
            problems +=
                `  Elem ix ${i}: Matches ${what} 2:  ${regex2 || text2}  (but should not)\n` +
                `    elem text:  "${elemText}"\n`;
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
    }


    waitUntilIsOnHomepage() {
      this.waitUntil(() => {
        const url = this.#br.getUrl();
        return /https?:\/\/[^/?#]+(\/latest|\/top|\/)?(#.*)?$/.test(url);
      });
    }


    // RENAME to assertPageTitlePostMatches
    assertPageTitleMatches(regex: string | RegExp) {
      this.waitForVisible('h1.dw-p-ttl');
      this.waitUntilTextMatches('h1.dw-p-ttl', regex);
      //this.assertTextMatches('h1.dw-p-ttl', regex);
    }


    // RENAME to assertPageBodyPostMatches
    assertPageBodyMatches(regex: string | RegExp) {
      this.waitForVisible('.esOrigPost');
      //this.waitUntilTextMatches('.esOrigPost', regex);
      this.assertTextMatches('.esOrigPost', regex);
    }


    assertPageHtmlSourceMatches_1 (toMatch: string | RegExp) {
      // _1 = only for 1 this.#br
      const source = this.#br.getPageSource();
      const regex = getRegExpOrDie(toMatch);
      assert(regex.test(source), "Page source does match " + regex);
    }


    /**
     * Useful if navigating to a new page, but don't know exactly when will have done that.
     */
    waitUntilPageHtmlSourceMatches_1 (toMatch: string | RegExp) {
      // _1 = only for 1 this.#br
      const regex = getRegExpOrDie(toMatch);
      this.waitUntil(() => {
        const source = this.#br.getPageSource();
        return regex.test(source);
      }, {
        message: `Waiting for page source to match:  ${regex}`,
      });
    }


    assertPageHtmlSourceDoesNotMatch(toMatch: string | RegExp) {
      const source = this.#br.getPageSource();
      const regex = getRegExpOrDie(toMatch)
      assert(!regex.test(source), `Page source *does* match: ${regex}`);
      //let resultsByBrowser = byBrowser(this.#br.getPageSource());
      //_.forOwn(resultsByBrowser, (text, browserName) => {
      //  assert(!regex.test(text), browserNamePrefix(browserName) + "Page source does match " + regex);
      //});
    }


    _pageNotFoundOrAccessDenied = 'Page not found, or Access Denied';

    // Also see this.#br.pageTitle.assertPageHidden().  Dupl code [05PKWQ2A]
    assertWholePageHidden() {
      let resultsByBrowser = byBrowser(this.#br.getPageSource());
      _.forOwn(resultsByBrowser, (text: any, browserName) => {
        if (settings.prod) {
          tyAssert.includes(text, this._pageNotFoundOrAccessDenied);
        }
        else {
          tyAssert.includes(text, 'EdE0SEEPAGEHIDDEN_');
        }
      });
    }


    // Also see this.pageTitle.assertPageHidden().  Dupl code [05PKWQ2A]
    assertMayNotSeePage() {
      let resultsByBrowser = byBrowser(this.#br.getPageSource());
      _.forOwn(resultsByBrowser, (text: any, browserName) => {
        if (settings.prod) {
          tyAssert.includes(text, this._pageNotFoundOrAccessDenied);
          //  browserNamePrefix(browserName) + "Page not hidden (no not-found or access-denied)");
        }
        else {
          tyAssert.includes(text, 'TyEM0SEE_'); /*, browserNamePrefix(browserName) +
              "User can see page. Or did you forget the --prod flag? (for Prod mode)");
          */
        }
      });
    }


    assertMayNotLoginBecauseNotYetApproved() {
      this.assertPageHtmlSourceMatches_1('TyM0APPR_-TyMAPPRPEND_');
    }


    assertMayNotLoginBecauseRejected() {
      this.assertPageHtmlSourceMatches_1('TyM0APPR_-TyMNOACCESS_');
    }


    assertNotFoundError(ps: {
            whyNot?: 'CategroyDeleted' | 'MayNotCreateTopicsOrSeeCat' |
                'MayNotSeeCat' | 'PageDeleted' } = {}) {
      for (let i = 0; i < 20; ++i) {
        let source = this.#br.getPageSource();
        // The //s regex modifier makes '.' match newlines. But it's not available before ES2018.
        let is404 = /404 Not Found.+TyE404_/s.test(source);
        if (!is404) {
          this.#br.pause(250);
          this.#br.refresh();
          continue;
        }

        let okNotFoundReason = true;
        if (settings.prod) {
          // Then we won't know why we got 404 Not Found.
        }
        else if (ps.whyNot === 'CategroyDeleted') {
          okNotFoundReason = /TyECATDELD_/.test(source);
        }
        else if (ps.whyNot === 'MayNotCreateTopicsOrSeeCat') {
          okNotFoundReason = /-TyEM0CR0SEE_-TyMMBYSEE_/.test(source);
        }
        else if (ps.whyNot === 'MayNotSeeCat') {
          okNotFoundReason = /-TyEM0SEE_-TyMMBYSEE_/.test(source);
        }
        else if (ps.whyNot === 'PageDeleted') {
          okNotFoundReason = /TyEPAGEDELD_/.test(source);
        }
        tyAssert.ok(okNotFoundReason,
              `Wrong 404 Not Found reason, should have been: ${ps.whyNot
                    } but source is: \n` +
              `-----------------------------------------------------------\n` +
              source + '\n' +
              `-----------------------------------------------------------\n`);

        return;
      }
      die('EdE5FKW2', "404 Not Found never appears");
    }


    assertUrlIs(expectedUrl: string) {
      let url = this.#br.getUrl();
      assert(url === expectedUrl);
    }

    goToSearchPage(query?: string) {
      const q = query ? '?q=' + query : '';
      this.go('/-/search' + q);
      this.waitForVisible('.s_SP_QueryTI');
    }

    acceptAnyAlert(howMany: number = 1): boolean {
      return this.dismissAcceptAnyAlert(howMany, true);
    }

    dismissAnyAlert(howMany: number = 1): boolean {
      return this.dismissAcceptAnyAlert(howMany, false);
    }

    dismissAcceptAnyAlert(howMany: number, accept: boolean): boolean {
      let numDone = 0;
      this.waitUntil(() => {
        try {
          if (accept) this.#br.acceptAlert();
          else this.#br.dismissAlert();
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
        serverErrorDialogIsFine: true,
        message: `Waiting for alert(s), handled ${numDone} out of <= ${howMany}`
      });
      logMessage(`Handled ${numDone} out of <= ${howMany} maybe-alerts.`);
      return numDone >= 1;
    }

    /*
    countLongPollingsDone() {  TyT20956QKSP2
      const result = this.#br.execute(function() {
        return window['debiki2'].Server.testGetLongPol  lingNr();  —  fn gone
      });
      dieIf(!_.isNumber(result), "Error getting long polling count, result: " + JSON.stringify(result));
      const count = result; // parseInt(result);
      dieIf(_.isNaN(count), "Long polling count is weird: " + JSON.stringify(result));
      return count;
    } */

    createSite = {
      fillInFieldsAndSubmit: (data: NewSiteData) => {
        if (data.embeddingUrl) {
          this.waitAndSetValue('#e_EmbeddingUrl', data.embeddingUrl);
        }
        else {
          this.waitAndSetValue('#dwLocalHostname', data.localHostname);
        }
        this.waitAndClick('#e2eNext3');
        this.waitAndSetValue('#e2eOrgName', data.orgName || data.localHostname);
        this.waitAndClick('input[type=submit]');
        this.waitForVisible('#t_OwnerSignupB');
        assert.equal(data.origin, this.origin());
      },

      clickOwnerSignupButton: () => {
        this.waitAndClick('#t_OwnerSignupB');
      }
    };


    createSomething = {
      createForum: (forumTitle: string) => {
        // Button gone, I'll add it back if there'll be Blog & Wiki too.
        // this.waitAndClick('#e2eCreateForum');
        this.#br.pause(200); // [e2erace] otherwise it won't find the next input, in the
                            // create-site-all-logins @facebook test
        logMessage(`Typig forum title: "${forumTitle}" ...`);
        this.waitAndSetValue('input[type="text"]', forumTitle, { checkAndRetry: true });
        // Click Next, Next ... to accept all default choices.
        /*  [NODEFCATS]
        this.waitAndClick('.e_Next');
        this.#br.pause(200); // Wait for next button
        this.waitAndClick('.e_Next');
        this.#br.pause(200);
        this.waitAndClick('.e_Next');
        this.#br.pause(200);
        */
        logMessage(`Clicking Next ...`);
        this.waitAndClick('.e_Next');

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
        this.waitAndClick('#e2eDoCreateForum');
        logMessage(`Waiting for title ...`);
        const actualTitle = this.waitAndGetVisibleText('h1.dw-p-ttl');
        logMessage(`Done? The forum title is: "${actualTitle}"`);
        assert.equal(actualTitle, forumTitle);
      },
    };


    topbar = {
      isVisible: (): boolean => {
        return this.isVisible('.esTopbar');
      },

      waitForVisible: () => {  // old name? use waitForMyMenuVisible instead only?
        this.topbar.waitForMyMenuVisible();
      },

      waitForMyMenuVisible: () => {  // RENAME to waitForMyMenuButtonVisible?
        this.waitForVisible('.esMyMenu');
      },

      clickBack: () => {
        this.repeatUntilAtNewUrl(() => {
          this.waitAndClick('.s_Tb_Ln-Bck');
        });
      },

      clickHome: () => {
        if (this.isVisible('.esLegal_home_link')) {
          this.rememberCurrentUrl();
          this.waitAndClick('.esLegal_home_link');
          this.waitForNewUrl();
        }
        else {
          // (Already waits for new url.)
          this.topbar.clickAncestor("Home");
        }
      },

      // MOVE to topic = ... ? because now in the topic by default
      // Next to: waitUntilParentCatIs(catName)
      clickAncestor: (categoryName: St) => {
        this.repeatUntilAtNewUrl(() => {
          // Prefer licking a link in the topbar, if present, because if the topbar
          // is position: fixed at the top of the page, then a link in the page itself
          // can be occluded by the topbar.
          //
          // However, sometimes the topbar appears just after we've checked if
          // it's there. And then it can steal the clicks. So, try this twice.
          // (This can happen, if posting a reply, and then immediately trying to
          // click Home — because once the reply appears, Ty scrolls down
          // so it gets into view — but then the topbar might appear, just after
          // we've checked if it's there.)
          //
          utils.tryManyTimes("Clicking ancestor link", 2, () => {
            const ancLn = ' .esTopbar_ancestors_link';
            const where = this.isVisible('.s_Tb ' + ancLn) ? '.s_Tb' : '.esPage';
            this.waitForThenClickText(where + ancLn, categoryName, { tryNumTimes: 2 });
          });
        });
      },

      // COULD FASTER_E2E_TESTS can set  wait:false at most places
      assertMyUsernameMatches: (username: string, ps: { wait?: boolean } = {}) => {
        if (ps.wait !== false) {
          this.waitForDisplayed('.esMyMenu .esAvtrName_name');
        }
        this.assertTextMatches('.esMyMenu .esAvtrName_name', username);
      },

      waitForNumPendingUrgentReviews: (numUrgent: IntAtLeastOne) => {
        assert(numUrgent >= 1, "Zero tasks won't ever become visible [TyE5GKRBQQ2]");
        this.waitUntilTextMatches('.esNotfIcon-reviewUrgent', '^' + numUrgent + '$');
      },

      waitForNumPendingOtherReviews: (numOther: IntAtLeastOne) => {
        assert(numOther >= 1, "Zero tasks won't ever become visible [TyE2WKBPJR3]");
        this.waitUntilTextMatches('.esNotfIcon-reviewOther', '^' + numOther + '$');
      },

      isNeedsReviewUrgentVisible: () => {
        return this.isVisible('.esNotfIcon-reviewUrgent');
      },

      isNeedsReviewOtherVisible: () => {
        return this.isVisible('.esNotfIcon-reviewOther');
      },

      getMyUsername: () => {
        return this.waitAndGetVisibleText('.esMyMenu .esAvtrName_name');
      },

      clickLogin: () => {
        this.waitAndClick('.esTopbar_logIn');
        this.waitUntilLoadingOverlayGone();
      },

      clickSignUp: () => {
        this.waitAndClick('.esTopbar_signUp');
        this.waitUntilLoadingOverlayGone();
      },

      clickLogout: (options: { waitForLoginButton?: Bo,   // RENAME to logout
              waitForLoginDialog?: Bo } = {}) => {
        // Sometimes this scrolls to top, small small steps, annoying, [FASTER_E2E_TESTS]
        // and not needed, right.
        // Can speed up by calling scrollToTop() — done here: [305RKTJ205].
        this.topbar.openMyMenu();
        this.waitAndClick('#e2eMM_Logout');
        this.waitAndClick('.e_ByeD .btn-primary');
        if (options.waitForLoginDialog) {
          this.waitForDisplayed('.c_AuD');
        }
        else if (options.waitForLoginButton === false) {
          // Then a login dialog will probably have opened now in full screen, with a modal
          // backdrop, so don't wait for any backdrop to disappear.
          // Or we got redirected to an SSO login window.
        }
        else {
          this.waitUntilModalGone();
          this.topbar.waitUntilLoginButtonVisible();
        }
        // If on a users profile page, might start reloading something (because different user & perms).
        this.waitUntilLoadingOverlayGone();
      },

      waitUntilLoginButtonVisible: () => {
        this.waitForVisible('.esTopbar_logIn');
      },

      openMyMenu: () => {
        // We can click in the fixed topbar if it's present, instead of scrolling
        // all the way up to the static topbar.
        let sel = '.s_TbW-Fxd .esMyMenu';
        const fixedScrollbarVisible = this.isVisible(sel);
        const opts = { mayScroll: !fixedScrollbarVisible };
        if (!fixedScrollbarVisible) {
          sel = '.esMyMenu';
        }
        this.waitAndClick(sel, opts);
        this.waitUntilLoadingOverlayGone();
        // Because of a bug in Chrome? Chromedriver? Selenium? Webdriver.io? wait-and-click
        // attempts to click instantly, before the show-menu anim has completed and the elem
        // has appeared. So pause for a short while. [E2EBUG]
        this.#br.pause(333);
      },

      closeMyMenuIfOpen: () => {
        if (this.isVisible('.s_MM .esDropModal_CloseB')) {
          this.waitAndClick('.s_MM .esDropModal_CloseB');
          this.waitForGone('.s_MM .esDropModal_CloseB');
        }
      },

      clickGoToAdmin: () => {
        this.rememberCurrentUrl();
        this.topbar.openMyMenu();
        this.waitAndClick('.esMyMenu_admin a');
        this.waitForNewUrl();
        this.waitUntilLoadingOverlayGone();
      },

      navigateToGroups: () => {
        this.rememberCurrentUrl();
        this.topbar.openMyMenu();
        this.waitAndClick('#te_VwGrps');
        this.waitForNewUrl();
        this.groupListPage.waitUntilLoaded();
      },

      clickGoToProfile: () => {
        this.rememberCurrentUrl();
        this.topbar.openMyMenu();
        this.waitAndClick('#e2eMM_Profile');
        this.waitForNewUrl();
        this.waitForVisible(this.userProfilePage.avatarAboutButtonsSelector);
      },

      clickStopImpersonating: () => {
        let oldName = this.topbar.getMyUsername();
        let newName;
        this.topbar.openMyMenu();
        this.waitAndClick('.s_MM_StopImpB');
        // Wait for page to reload:
        this.waitForGone('.s_MMB-IsImp');  // first, page reloads: the is-impersonating mark, disappears
        this.waitForVisible('.esMyMenu');  // then the page reappears
        do {
          newName = this.topbar.getMyUsername();
        }
        while (oldName === newName);
      },

      searchFor: (phrase: string) => {
        this.waitAndClick('.esTB_SearchBtn');
        // The search text field should grab focus, so we can just start typing:
        // But this causes a "RuntimeError" in Webdriver.io v4:
        // this.#br.keys(phrase);
        // This works though (although won't test if has focus):
        this.waitAndSetValue('.c_SchD input[name="q"]', phrase);
        this.waitAndClick('.e_SchB');
        this.searchResultsPage.waitForResults(phrase);
      },

      assertNotfToMe: () => {
        assert(this.isVisible('.esTopbar .esNotfIcon-toMe'));
      },

      notfsToMeClass: '.esTopbar .esNotfIcon-toMe',
      otherNotfsClass: '.esTopbar .esNotfIcon-toOthers',

      waitForNumDirectNotfs: (numNotfs: IntAtLeastOne) => {
        assert(numNotfs >= 1, "Zero notfs won't ever become visible [TyE5GKRBQQ03]");
        this.waitUntilTextMatches(this.topbar.notfsToMeClass, '^' + numNotfs + '$');
      },

      waitForNoDirectNotfs: () => {
        this.waitForGone(this.topbar.notfsToMeClass);
      },

      waitForNumOtherNotfs: (numNotfs: IntAtLeastOne) => {
        assert(numNotfs >= 1, "Zero notfs won't ever become visible [TyE4ABKF024]");
        this.waitUntilTextMatches(this.topbar.otherNotfsClass, '^' + numNotfs + '$');
      },

      refreshUntilNumOtherNotfs: (desiredNumNotfs: number) => {
        const millisBetweenRefresh = 15*1000;  // should be > report to server interval [6AK2WX0G]
        let millisLeftToRefresh = millisBetweenRefresh;
        while (true) {
          let isWhat;
          if (desiredNumNotfs === 0) {
            if (!this.isVisible(this.topbar.otherNotfsClass)) {
              break;
            }
            isWhat = '>= 1';
          }
          else {
            const text = this.waitAndGetVisibleText(this.topbar.otherNotfsClass);
            const actualNumNotfs = parseInt(text);
            if (actualNumNotfs === desiredNumNotfs) {
              break;
            }
            isWhat = '' + actualNumNotfs;
          }
          const pauseMs = 1000;
          this.#br.pause(pauseMs);

          // Because of some race condition, in rare cases, notifications won't get marked
          // as seen. Hard to reproduce, only happens 1 in 10 in invisible e2e tests.
          // For now, do this:
          millisLeftToRefresh -= pauseMs;
          if (millisLeftToRefresh < 0) {
            logUnusual(`Refreshing page. Num-other-notfs count is currently ${isWhat} ` +
                `and refuses to become ${desiredNumNotfs}...`);
            this.#br.refresh();
            millisLeftToRefresh = millisBetweenRefresh;
          }
        }
      },

      waitForNoOtherNotfs: () => {
        this.waitForGone(this.topbar.otherNotfsClass);
      },

      openNotfToMe: (options: { waitForNewUrl?: boolean } = {}) => {
        this.topbar.openLatestNotf(options);
      },

      openLatestNotf: (options: { waitForNewUrl?: boolean, toMe?: true } = {}) => {
        this.topbar.openMyMenu();
        this.rememberCurrentUrl();
        this.waitAndClickFirst('.s_MM .dropdown-menu ' + (options.toMe ? '.esNotf-toMe' : '.esNotf'));
        if (options.waitForNewUrl !== false) {
          this.waitForNewUrl();
        }
      },

      viewAsStranger: () => {
        this.topbar.openMyMenu();
        this.waitAndClick('.s_MM_ViewAsB');
        // Currently there's just one view-as button, namely to view-as-stranger.
        this.waitAndClick('.s_VAD_Sbd button');
        // Now there's a warning, close it.
        this.stupidDialog.clickClose();
        // Then another stupid-dialog appears. Wait for a while so we won't click the
        // button in the first dialog, before it has disappeared.
        this.#br.pause(800);  // COULD give incrementing ids to the stupid dialogs,
                              // so can avoid this pause?
        this.stupidDialog.close();
      },

      stopViewingAsStranger: () => {
        this.topbar.openMyMenu();
        this.waitAndClick('.s_MM_StopImpB a');
      },

      myMenu: {
        goToAdminReview: () => {
          this.topbar.myMenu.goToImpl('#e2eMM_Review');
          this.adminArea.review.waitUntilLoaded();
        },

        goToDraftsEtc: () => {
          this.topbar.myMenu.goToImpl('.e_MyDfsB');
          this.userProfilePage.draftsEtc.waitUntilLoaded();
        },

        goToImpl: (selector: string) => {
          this.rememberCurrentUrl();
          this.topbar.openMyMenu();
          this.waitAndClick(selector);
          this.waitForNewUrl();
        },

        _snoozeIcon: '.s_MMB_Snz .s_SnzI',

        snoozeNotfs: (ps: SnoozeTime = {}) => {
          tyAssert.not(this.isVisible(this.topbar.myMenu._snoozeIcon));  // ttt
          this.waitAndClick('.s_MM_SnzB');
          if (ps.toWhen === 'TomorrowMorning9am') {
            this.waitAndClickFirst('.s_SnzD_9amBs .btn');
          }
          this.waitAndClick('.e_SnzB');
          this.topbar.closeMyMenuIfOpen();
          this.waitForVisible(this.topbar.myMenu._snoozeIcon);

          if (ps.hours && !ps.minutes) {
            this.assertTextMatches('.s_MMB_Snz', `${ps.hours}h`);
          }
          if (!ps.hours && ps.minutes) {
            this.assertTextMatches('.s_MMB_Snz', `${ps.minutes}m`);
          }
        },

        unsnooze: () => {
          tyAssert.that(this.isVisible(this.topbar.myMenu._snoozeIcon));  // ttt
          this.waitAndClick('.s_MM_SnzB');
          this.waitAndClick('.e_UnSnzB');
          this.topbar.closeMyMenuIfOpen();
          this.waitForGone(this.topbar.myMenu._snoozeIcon);
        },

        dismNotfsBtnClass: '.e_DismNotfs',

        markAllNotfsRead: () => {
          this.topbar.openMyMenu();
          this.waitAndClick(this.topbar.myMenu.dismNotfsBtnClass);
        },

        isMarkAllNotfsReadVisibleOpenClose: (): boolean => {
          this.topbar.openMyMenu();
          this.waitForVisible('.s_MM_NotfsBs');  // (test code bug: sometimes absent — if 0 notfs)
          const isVisible = this.isVisible(this.topbar.myMenu.dismNotfsBtnClass);
          this.topbar.closeMyMenuIfOpen();
          return isVisible;
        },

        unhideTips: () => {
          this.waitAndClick('.e_UnhTps');
        },

        unhideAnnouncements: () => {
          this.waitAndClick('.e_UnhAnns');
        }
      },

      pageTools: {
        pinPage: (where: 'Globally' | 'InCategory', ps: { willBeTipsAfter: Bo }) => {
          this.topbar.pageTools.__openPinPageDialog();
          const pinWhereRadioBtn = where === 'Globally' ? '.e_PinGlb' : '.e_PinCat';
          this.waitAndClick(pinWhereRadioBtn + ' input');
          this.waitAndClick('.e_SavPinB');
          if (ps.willBeTipsAfter !== false) {
            this.helpDialog.waitForThenClose({ shallHaveBodyClass: '.esPinnedOk' });
          }
          this.waitUntilModalGone();
        },

        __openPinPageDialog: () => {
          this.waitAndClick('.dw-a-tools');
          this.waitUntilDoesNotMove('.e_PinPg');
          this.waitAndClick('.e_PinPg');
          this.waitForDisplayed('input[name="pinWhere"]');
        },

        deletePage: () => {
          this.waitAndClick('.dw-a-tools');
          this.waitUntilDoesNotMove('.e_DelPg');
          this.waitAndClick('.e_DelPg');
          this.waitUntilModalGone();
          this.topic.waitUntilPageDeleted();
        },

        restorePage: () => {
          this.waitAndClick('.dw-a-tools');
          this.waitUntilDoesNotMove('.e_RstrPg');
          this.waitAndClick('.e_RstrPg');
          this.waitUntilModalGone();
          this.topic.waitUntilPageRestored();
        },
      },
    };


    watchbar = {
      titleSelector: '.esWB_T_Title',
      unreadSelector: '.esWB_T-Unread',

      open: () => {
        this.waitAndClick('.esOpenWatchbarBtn');
        this.waitForVisible('#esWatchbarColumn');
      },

      openIfNeeded: () => {
        if (!this.isVisible('#esWatchbarColumn')) {
          this.watchbar.open();
        }
      },

      close: () => {
        this.waitAndClick('.esWB_CloseB');
        this.waitUntilGone('#esWatchbarColumn');
      },

      waitForTopicVisible: (title: string) => {
        this.waitUntilAnyTextMatches(this.watchbar.titleSelector, title);
      },

      assertTopicVisible: (title: string) => {
        this.waitForVisible(this.watchbar.titleSelector);
        this.assertAnyTextMatches(this.watchbar.titleSelector, title);
      },

      assertTopicAbsent: (title: string) => {
        this.waitForVisible(this.watchbar.titleSelector);
        this.assertNoTextMatches(this.watchbar.titleSelector, title);
      },

      asserExactlyNumTopics: (num: number) => {
        if (num > 0) {
          this.waitForVisible(this.watchbar.titleSelector);
        }
        this.assertExactly(num, this.watchbar.titleSelector);
      },

      numUnreadTopics: (): number => {
        return this.count('.esWB_T-Unread');
      },

      openUnreadTopic: (index: number = 1) => {
        dieIf(index !== 1, 'unimpl [TyE6927KTS]');
        this.repeatUntilAtNewUrl(() => {
          this.waitAndClick('.esWB_T-Unread');
        });
      },

      waitUntilNumUnreadTopics: (num: number) => {
        assert.ok(num > 0, 'TyE0578WNSYG');
        this.waitForAtLeast(num, '.esWB_T-Unread');
        this.assertExactly(num, '.esWB_T-Unread');
      },

      goToTopic: (title: string, opts: { isHome?: true, shouldBeUnread?: Bo } = {}) => {
        this.rememberCurrentUrl();
        const selector = `${opts.shouldBeUnread ? this.watchbar.unreadSelector : ''
                } ${this.watchbar.titleSelector}`;
        const titleOrHome = opts.isHome ? c.WatchbarHomeLinkTitle : title;
        this.waitForThenClickText(selector, titleOrHome);
        this.waitForNewUrl();
        this.assertPageTitleMatches(title);
      },

      clickCreateChat: () => {
        this.waitAndClick('#e2eCreateChatB');
      },

      clickCreateChatWaitForEditor: () => {
        this.waitAndClick('#e2eCreateChatB');
        this.waitForVisible('.esEdtr_titleEtc');
      },

      clickViewPeople: () => {
        this.waitAndClick('.esWB_T-Current .esWB_T_Link');
        this.waitAndClick('#e2eWB_ViewPeopleB');
        this.waitUntilModalGone();
        this.waitForVisible('.esCtxbar_list_title');
      },

      clickLeaveChat: () => {
        this.waitAndClick('.esWB_T-Current .esWB_T_Link');
        this.waitAndClick('#e2eWB_LeaveB');
        this.waitUntilModalGone();
        this.waitForVisible('#theJoinChatB');
      },
    };


    contextbar = {
      close: () => {
        this.waitAndClick('.esCtxbar_close');
        this.waitUntilGone('#esThisbarColumn');
      },

      clickAddPeople: () => {
        this.waitAndClick('#e2eCB_AddPeopleB');
        this.waitForVisible('#e2eAddUsD');
      },

      clickUser: (username: string) => {
        this.waitForThenClickText('.esCtxbar_list .esAvtrName_username', username);
      },

      assertUserPresent: (username: string) => {
        this.waitForVisible('.esCtxbar_onlineCol');
        this.waitForVisible('.esCtxbar_list .esAvtrName_username');
        var elems = this.$$('.esCtxbar_list .esAvtrName_username');
        var usernamesPresent = elems.map((elem) => {
          return elem.getText();
        });
        const namesPresent = usernamesPresent.join(', ');
        logMessage(`Users present: ${namesPresent}`)
        assert(usernamesPresent.length, "No users listed at all");
        assert(_.includes(usernamesPresent, username), "User missing: " + username +
            ", those present are: " + namesPresent);
      },
    };


    createUserDialog = {
      isVisible: () => {
        return this.isVisible('.esCreateUser');
      },

      // Most other fns in loginDialog below,  move to here?
    };


    loginDialog = {
      isVisible: () => {
        return this.isVisible('.dw-login-modal') && this.isVisible('.c_AuD');
      },

      refreshUntilFullScreen: () => {
        let startMs = Date.now();
        let dialogShown = false;
        let lap = 0;
        while (Date.now() - startMs < settings.waitforTimeout) {
          this.#br.refresh();
          // Give the page enough time to load:
          lap += 1;
          this.#br.pause(200 * Math.pow(1.5, lap));
          dialogShown = this.loginDialog.isVisible();
          if (dialogShown)
            break;
        }
        assert(dialogShown, "The login dialog never appeared");
        this.loginDialog.waitAssertFullScreen();
      },

      waitAssertFullScreen: () => {
        this.waitForVisible('.dw-login-modal');
        this.waitForVisible('.c_AuD');
        // Forum not shown.
        assert(!this.isVisible('.dw-forum'));
        assert(!this.isVisible('.dw-forum-actionbar'));
        // No forum topic shown.
        assert(!this.isVisible('h1'));
        assert(!this.isVisible('.dw-p'));
        assert(!this.isVisible('.dw-p-ttl'));
        // Admin area not shown.
        assert(!this.isVisible('.s_Tb_Ln'));
        assert(!this.isVisible('#dw-react-admin-app'));
        // User profile not shown.
        assert(!this.isVisible(this.userProfilePage.avatarAboutButtonsSelector));
      },

      clickSingleSignOnButton: () => {
        this.waitAndClick('.s_LD_SsoB');
      },

      waitForSingleSignOnButton: () => {
        this.waitForDisplayed('.s_LD_SsoB');
      },

      createPasswordAccount: (data: MemberToCreate | {
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
            anyVerifyEmail?: 'THERE_WILL_BE_NO_VERIFY_EMAIL_DIALOG') => {

        // Switch from the guest login form to the create-real-account form, if needed.
        this.waitForVisible('#e2eFullName');
        if (this.isVisible('.c_AuD_2SgU')) {
          this.waitAndClick('.c_AuD_2SgU .c_AuD_SwitchB');
          this.waitForVisible('#e2ePassword');
        }

        // Dupl code (035BKAS20)

        logMessage('createPasswordAccount: fillInFullName...');
        if (data.fullName) this.loginDialog.fillInFullName(data.fullName);
        logMessage('fillInUsername...');
        this.loginDialog.fillInUsername(data.username);
        logMessage('fillInEmail...');
        const theEmail = data.email || data.emailAddress;
        if (theEmail) this.loginDialog.fillInEmail(theEmail);
        logMessage('fillInPassword...');
        this.loginDialog.fillInPassword(data.password);
        logMessage('clickSubmit...');
        this.loginDialog.clickSubmit();
        logMessage('acceptTerms...');
        this.loginDialog.acceptTerms(data.shallBecomeOwner || shallBecomeOwner);
        if (data.willNeedToVerifyEmail !== false &&
            anyVerifyEmail !== 'THERE_WILL_BE_NO_VERIFY_EMAIL_DIALOG') {
          logMessage('waitForNeedVerifyEmailDialog...');
          this.loginDialog.waitForNeedVerifyEmailDialog();
        }
        logMessage('createPasswordAccount: done');
      },

      fillInFullName: (fullName: string) => {
        this.waitAndSetValue('#e2eFullName', fullName);
      },

      fillInUsername: (username: string) => {
        this.waitAndSetValue('#e2eUsername', username);
      },

      fillInEmail: (emailAddress: string) => {
        this.waitAndSetValue('#e2eEmail', emailAddress);
      },

      waitForNeedVerifyEmailDialog: () => {
        this.waitForVisible('#e2eNeedVerifyEmailDialog');
      },

      waitForAndCloseWelcomeLoggedInDialog: () => {
        this.waitForVisible('#te_WelcomeLoggedIn');
        this.waitAndClick('#te_WelcomeLoggedIn button');
        this.waitUntilModalGone();
      },

      fillInPassword: (password: string) => {
        this.waitAndSetValue('#e2ePassword', password);
      },

      waitForBadLoginMessage: () => {
        this.waitForVisible('.esLoginDlg_badPwd');
      },

      loginWithPassword: (username: string | Member | { username: string, password: string },
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
        const numTabs = this.numTabs();
        this.loginDialog.tryLogin(username, password);
        if (opts && opts.resultInError)
          return;
        if (this.#isWhere === IsWhere.LoginPopup) {
          // Wait for this login popup tab/window to close.
          this.waitForMaxBrowserTabs(numTabs - 1);
          this.switchBackToFirstTabIfNeeded();
        }
        else {
          this.waitUntilModalGone();
          this.waitUntilLoadingOverlayGone();
        }
      },

      loginWithEmailAndPassword: (emailAddress: string, password: string, badLogin?: 'BAD_LOGIN') => {
        this.loginDialog.tryLogin(emailAddress, password);
        if (badLogin !== 'BAD_LOGIN') {
          this.waitUntilModalGone();
          this.waitUntilLoadingOverlayGone();
        }
      },

      // Embedded discussions do all logins in popups.
      loginWithPasswordInPopup:
          (username: string | NameAndPassword, password?: string) => {
        this.swithToOtherTabOrWindow(IsWhere.LoginPopup);
        this.disableRateLimits();
        if (_.isObject(username)) {
          password = username.password;
          username = username.username;
        }
        const numTabs = this.numTabs();
        this.loginDialog.tryLogin(username, password);
        // The popup auto closes after login.
        this.waitForMaxBrowserTabs(numTabs - 1);
        this.switchBackToFirstTabOrWindow();
      },

      loginButBadPassword: (username: string, password: string) => {
        this.loginDialog.tryLogin(username, password);
        this.waitForVisible('.esLoginDlg_badPwd');
      },

      tryLogin: (username: string, password: string) => {
        this.loginDialog.switchToLoginIfIsSignup();
        this.loginDialog.fillInUsername(username);
        this.loginDialog.fillInPassword(password);
        this.loginDialog.clickSubmit();
      },

      waitForEmailUnverifiedError: () => {
        this.waitUntilTextMatches('.modal-body', 'TyEEML0VERIF_');
      },

      waitForAccountSuspendedError: () => {
        this.waitUntilTextMatches('.modal-body', 'TyEUSRSSPNDD_');
      },

      waitForNotCreatedPasswordDialog: () => {
        this.waitForVisible('.e_NoPwD');
      },

      clickCreatePasswordButton: () => {
        this.waitAndClick('.e_NoPwD button');
      },

      signUpAsGuest: (name: string, email?: string) => { // CLEAN_UP use createPasswordAccount instead? [8JTW4]
        logMessage('createPasswordAccount with no email: fillInFullName...');
        this.loginDialog.fillInFullName(name);
        logMessage('fillInUsername...');
        const username = name.replace(/[ '-]+/g, '_').substr(0, 20);  // dupl code (7GKRW10)
        this.loginDialog.fillInUsername(username);
        if (email) {
          logMessage('fillInEmail...');
          this.loginDialog.fillInEmail(email);
        }
        else {
          logMessage('fillInEmail anyway, because for now, always require email [0KPS2J]');
          this.loginDialog.fillInEmail(`whatever-${Date.now()}@example.com`);
        }
        logMessage('fillInPassword...');
        this.loginDialog.fillInPassword("public1234");
        logMessage('clickSubmit...');
        this.loginDialog.clickSubmit();
        logMessage('acceptTerms...');
        this.loginDialog.acceptTerms();
        logMessage('waitForWelcomeLoggedInDialog...');
        this.loginDialog.waitForAndCloseWelcomeLoggedInDialog();
        logMessage('createPasswordAccount with no email: done');
        // Took forever: waitAndGetVisibleText, [CHROME_60_BUG]? [E2EBUG] ?
        const nameInHtml = this.waitAndGetText('.esTopbar .esAvtrName_name');
        assert(nameInHtml === username);
      },

      logInAsGuest: (name: string, email_noLongerNeeded?: string) => { // CLEAN_UP [8JTW4] is just pwd login?
        const username = name.replace(/[ '-]+/g, '_').substr(0, 20);  // dupl code (7GKRW10)
        logMessage('logInAsGuest: fillInFullName...');
        this.loginDialog.fillInUsername(name);
        logMessage('fillInPassword...');
        this.loginDialog.fillInPassword("public1234");
        logMessage('clickSubmit...');
        this.loginDialog.clickSubmit();
        logMessage('logInAsGuest with no email: done');
        const nameInHtml = this.waitAndGetVisibleText('.esTopbar .esAvtrName_name');
        dieIf(nameInHtml !== username, `Wrong username in topbar: ${nameInHtml} [EdE2WKG04]`);
      },

      // For guests, there's a combined signup and login form.
      signUpLogInAs_Real_Guest: (name: string, email?: string) => {  // RENAME remove '_Real_' [8JTW4]
        this.loginDialog.fillInFullName(name);
        if (email) {
          this.loginDialog.fillInEmail(email);
        }
        this.loginDialog.clickSubmit();
        this.loginDialog.acceptTerms(false);
      },

      clickCreateAccountInstead: () => {
        this.waitAndClick('.c_AuD_2SgU .c_AuD_SwitchB');
        this.waitForVisible('.esCreateUser');
        this.waitForVisible('#e2eUsername');
        this.waitForVisible('#e2ePassword');
      },

      switchToLoginIfIsSignup: () => {
        // Switch to login form, if we're currently showing the signup form.
        while (true) {
          if (this.isVisible('.esCreateUser')) {
            this.waitAndClick('.c_AuD_2LgI .c_AuD_SwitchB');
            // Don't waitForVisible('.dw-reset-pswd') — that can hang forever (weird?).
          }
          else if (this.isVisible('.dw-reset-pswd')) {
            // Then the login form is shown, fine.
            break;
          }
          this.#br.pause(PollMs);
        }
      },


      createGmailAccount: (data: { email: string, password: string, username: string },
            ps: { isInPopupAlready?: true, shallBecomeOwner?: boolean,
                anyWelcomeDialog?: 'THERE_WILL_BE_NO_WELCOME_DIALOG',
                isInFullScreenLogin?: boolean } = {}) => {

        this.loginDialog.loginWithGmail(
              data, ps.isInPopupAlready, { isInFullScreenLogin: ps.isInFullScreenLogin });
        // This should be the first time we login with Gmail at this site, so we'll be asked
        // to choose a username.
        // Not just #e2eUsername, then might try to fill in the username in the create-password-
        // user fields which are still visible for a short moment. Dupl code (2QPKW02)
        logMessage("filling in username ...");
        this.waitAndSetValue('.esCreateUserDlg #e2eUsername', data.username, { checkAndRetry: true });
        this.loginDialog.clickSubmit();
        logMessage("accepting terms ...");
        this.loginDialog.acceptTerms(ps.shallBecomeOwner);

        if (ps.anyWelcomeDialog !== 'THERE_WILL_BE_NO_WELCOME_DIALOG') {
          logMessage("waiting for and clicking ok in welcome dialog...");
          this.loginDialog.waitAndClickOkInWelcomeDialog();
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
          this.waitUntilModalGone();
          this.waitUntilLoadingOverlayGone();
        }
        logMessage("... done signing up with Gmail.");
      },

      loginWithGmail: (data: { email: string, password: string },
            isInPopupAlready: boolean | U,
            ps?: { stayInPopup?: boolean, isInFullScreenLogin?: boolean, anyWelcomeDialog?: 'THERE_WILL_BE_NO_WELCOME_DIALOG' }) => {
        // Pause or sometimes the click misses the button. Is the this.#br doing some re-layout?
        this.#br.pause(150);
        this.waitAndClick('#e2eLoginGoogle');
        ps = ps || {};

        // Switch to a login popup window that got opened, for Google:
        if (!isInPopupAlready && !ps.isInFullScreenLogin) {
          logMessage(`Switching to login popup ...`);
          this.swithToOtherTabOrWindow(IsWhere.External);
        }
        else {
          logMessage(`Already in popup, need not switch window.`);
        }

        const emailInputSelector = 'input[type="email"]';
        const emailNext = '#identifierNext';
        const passwordInputSelector = 'input[type="password"]';
        const passwordNext = '#passwordNext';

        // We'll get logged in immediately via Gmail, if we're already logged in to
        // one (and only one) Gmail account in the current this.#br. Wait for either
        // the Gmail login widgets to load, or for us to be back in Talkyard again.
        while (true) {
          if (ps.isInFullScreenLogin) {
            // Dupl code [insta_login]
            // If logged in both at Google and Ty directly: There's a race?
            // Sometimes we'll see Ty's login dialog briefly before it closes and
            // one's username appears. — This is fine, the tests should work anyway.
            const googleLoginDone = this.isExisting('.dw-login-modal');
            logMessageIf(googleLoginDone,
                `Got logged in directly at Google`);

            const googleAndTalkyardLoginDone = this.isExisting('.esMyMenu .esAvtrName_name');
            logMessageIf(googleAndTalkyardLoginDone,
                `Got logged in directly at both Google and Talkyard`);

            if (googleLoginDone || googleAndTalkyardLoginDone)
              return;
          }
          else if (this.loginDialog.loginPopupClosedBecauseAlreadyLoggedIn()) {
            // We're back in Talkyard.
            this.switchBackToFirstTabOrWindow();
            return;
          }
          try {
            if (this.isExisting(emailInputSelector)) {
              // That's a Gmail login widget. Continue with Gmail login.
              break;
            }
          }
          catch (dummy) {
            logMessage(`didn't find ${emailInputSelector}, ` +
                "tab closed? already logged in? [EdM5PKWT0B]");
          }
          this.#br.pause(PollMs);
        }

        this.#br.pause(250);
        logMessage(`typing Gmail email: ${data.email}...`);
        this.waitAndSetValue(emailInputSelector, data.email, { checkAndRetry: true });

        this.waitForMaybeDisplayed(emailNext, { timeoutMs: 1000 });
        if (this.isExisting(emailNext)) {
          logMessage(`clicking ${emailNext}...`);
          this.waitAndClick(emailNext);
        }

        this.#br.pause(250);
        logMessage("typing Gmail password...");
        this.waitAndSetValue(passwordInputSelector, data.password, { checkAndRetry: true });

        this.waitForMaybeDisplayed(passwordNext, { timeoutMs: 1000 });
        if (this.isExisting(passwordNext)) {
          logMessage(`clicking ${passwordNext}...`);
          this.waitAndClick(passwordNext);
        }

        /*
        this.waitAndClick('#signIn');
        this.waitForEnabled('#submit_approve_access');
        this.waitAndClick('#submit_approve_access'); */

        // If you need to verify you're a human:
        // this.#br.deb ug();

        if (!isInPopupAlready && (!ps || !ps.stayInPopup)) {
          logMessage("switching back to first tab...");
          this.switchBackToFirstTabOrWindow();
        }
      },


      createGitHubAccount: (ps: { username: string, password: string, shallBecomeOwner: boolean,
            anyWelcomeDialog?: 'THERE_WILL_BE_NO_WELCOME_DIALOG',
            alreadyLoggedInAtGitHub: boolean }) => {

        // This should fill in email (usually) and username (definitely).
        this.loginDialog.logInWithGitHub(ps);

        this.loginDialog.clickSubmit();
        this.loginDialog.acceptTerms(ps.shallBecomeOwner);
        if (ps.anyWelcomeDialog !== 'THERE_WILL_BE_NO_WELCOME_DIALOG') {
          this.loginDialog.waitAndClickOkInWelcomeDialog();
        }
        this.waitUntilModalGone();
        this.waitUntilLoadingOverlayGone();
      },

      logInWithGitHub: (ps: { username: string, password: string, alreadyLoggedInAtGitHub: boolean }) => {
        logMessage("Clicking GitHub login");
        this.waitAndClick('#e2eLoginGitHub');

        if (ps.alreadyLoggedInAtGitHub) {
          // The GitHub login window will auto-log the user in an close directly.
          this.waitForVisible('.esCreateUserDlg');
          return;
        }

        //if (!isInPopupAlready)
        logMessage("Switching to GitHub login popup...");
        this.swithToOtherTabOrWindow(IsWhere.External);

        logMessage("Typing GitHub username ...");
        this.waitForDisplayed('.auth-form-body');
        this.waitAndSetValue('.auth-form-body #login_field', ps.username);
        this.#br.pause(340); // so less risk GitHub think this is a computer?

        logMessage("Typing GitHub password ...");
        this.waitAndSetValue('.auth-form-body #password', ps.password);
        this.#br.pause(340); // so less risk GitHub think this is a computer?

        // GitHub might ask if we want cookies — yes we do.
        const cookieYesSelector =
                '.js-main-cookie-banner .js-cookie-consent-accept-all';
        if (this.isExisting(cookieYesSelector)) {
          this.waitAndClick(cookieYesSelector);
        }

        logMessage("Submitting GitHub login form ...");
        this.waitAndClick('.auth-form-body input[type="submit"]');
        while (true) {
          this.#br.pause(200);
          try {
            if (this.isVisible('#js-oauth-authorize-btn')) {
              logMessage("Authorizing Talkyard to handle this GitHub login ... [TyT4ABKR02F]");
              this.waitAndClick('#js-oauth-authorize-btn');
              break;
            }
          }
          catch (ex) {
            if (isWindowClosedException(ex)) {
              // The login window closed itself. We've clicked the Authorize
              // button in the past, already.
              logMessage("The GitHub login popup closed itself, fine.");
            }
            else {
              logWarning(`GitHub login popup exception: ${ex.toString()}`);
            }
            break;
          }
        }

        logMessage("GitHub login done — switching back to first window...");
        this.switchBackToFirstTabOrWindow();
      },


      createFacebookAccount: (
            user: { email: St, password: St, username: St },
            ps: {
              shallBecomeOwner?: Bo,
              mustVerifyEmail?: Bo,
              //anyWelcomeDialog?: 'THERE_WILL_BE_NO_WELCOME_DIALOG',
            } = {}) => {

        this.loginDialog.loginWithFacebook(user);

        // This should be the first time we login with Facebook at this site,
        // so we'll be asked to choose a username.
        // Not just #e2eUsername, then might try to fill in the username in the create-password-
        // user fields which are still visible for a short moment. Dupl code (2QPKW02)
        logMessage("typing Facebook user's new username...");
        this.waitAndSetValue('.esCreateUserDlg #e2eUsername', user.username);
        this.loginDialog.clickSubmit();
        this.loginDialog.acceptTerms(ps.shallBecomeOwner);

        // (Optionally, could verify a "Welcome" or "Verify your email addr"
        // dialog pops up.)

        // Talkyard doesn't assume that FB verifies people's email addresses.
        // Need to click an email verif link:  (unless the site settings
        // don't require verified emails)
        if (ps.mustVerifyEmail !== false) {
          const siteId = this.getSiteId();
          const link = server.getLastVerifyEmailAddressLinkEmailedTo(
                  siteId, user.email, this.#br);
          this.go2(link);
          this.waitAndClick('#e2eContinue');
        }
      },

      loginWithFacebook: (data: {
            email: string, password: string }, isInPopupAlready?: boolean) => {
        // Pause or sometimes the click misses the button. Is the this.#br doing some re-layout?
        this.#br.pause(100);
        this.waitAndClick('#e2eLoginFacebook');

        // In Facebook's login popup window:
        if (!isInPopupAlready)
          this.swithToOtherTabOrWindow(IsWhere.External);

        // We'll get logged in immediately, if we're already logged in to Facebook. Wait for
        // a short while to find out what'll happen.
        while (true) {
          if (this.loginDialog.loginPopupClosedBecauseAlreadyLoggedIn()) {
            this.switchBackToFirstTabOrWindow();
            return;
          }
          try {
            if (this.isExisting('#email'))
              break;
          }
          catch (dummy) {
            logMessage("didn't find #email, tab closed? already logged in? [EdM5PKWT0]");
          }
          this.#br.pause(300);
        }

        // Facebook asks if we want cookies — yes we do. And Facebook sometimes
        // renames the ok-cookies button.
        //const cookieYesSelector = '[data-testid="cookie-policy-banner-accept"]';
        // (There's yet another cookie button, cookieYesBtn2, below.)
        const cookieYesBtn1 = '[data-testid="cookie-policy-dialog-accept-button"]';
        if (this.isExisting(cookieYesBtn1)) {
          logMessage("Accepting cookies 1 ...");
          this.waitAndClick(cookieYesBtn1);
        }

        logMessage("typing Facebook user's email and password...");
        this.#br.pause(340); // so less risk Facebook think this is a computer?
        this.waitAndSetValue('#email', data.email);
        this.#br.pause(380);
        this.waitAndSetValue('#pass', data.password);
        this.#br.pause(280);

        // Facebook recently changed from <input> to <button>. So just find anything with type=submit.
        logMessage("submitting Facebook login dialog...");
        this.waitAndClick('#loginbutton'); // or: [type=submit]');

        // Here Facebook sometimes asks:
        //   > You previously logged in to [localhost test app name] with Facebook.
        //   > Would you like to continue?
        // and we need to click Yes:
        const yesBtn = 'button[name="__CONFIRM__"]';

        // And asks about cookies a 2nd time:
        const cookieYesBtn2 = '[aria-label="Allow All Cookies"]';
        // (Or: div or span with the text 'Allow All Cookies' — but clicking it,
        // does nothing. Instead, clicking the ancestor aria-label=... works.)

        this.waitUntil(() => {
          if (this.loginDialog.loginPopupClosedBecauseAlreadyLoggedIn()) {
            logMessage(`Popup closed, got no "Would you like to continue?" question.`);
            return true;
          }
          if (this.createUserDialog.isVisible()) {
            logMessage(`Continuing at Talkyard, same window as Facebook login`);
            logWarningIf(!isInPopupAlready, `But this is the wrong win?`);
            return true;
          }
          try {
            // Suddenly, Sept 2021, FB has added a 2nd cookie button. Who knows why.
            // So let's accept cookies a 2nd time.
            if (this.tryClickNow(cookieYesBtn2) === 'Clicked') {
              logMessage("Accepted FB cookies 2.");
              // Contiue looping afterwards, until the dialog closes or we see the
              // create-user Talkyard fields. Also, it seemed as if the first click
              // once didn't work, who cares why, just click more?
              return false;
            }
            // Previously, there was some confirmation button. Mayeb FB will
            // add it back?
            if (this.tryClickNow(yesBtn) === 'Clicked') {
              logMessage("Clicked some FB Continue button.");
              // Continue looping, see if{} above.
              return false;
            }
          }
          catch (dummy) {
            logMessage(`No Yes button — already logged in, tab closed? [TyM5PKW5RM8]`);
          }
        }, {
          message: `Waiting for any FB "Continue?" question or cookie button 2`,
          winClosedIsFine: true,  // FB popup can close itself
        });

        if (!isInPopupAlready) {
          logMessage("switching back to first tab...");
          this.switchBackToFirstTabOrWindow();
        }
      },


      createLinkedInAccount: (ps: { email: string, password: string, username: string,
        shallBecomeOwner: boolean, alreadyLoggedInAtLinkedIn: boolean }) => {
        this.loginDialog.loginWithLinkedIn({
          email: ps.email,
          password: ps.password,
          alreadyLoggedIn: ps.alreadyLoggedInAtLinkedIn,
        });
        // This should be the first time we login with LinkedInd at this site, so we'll be asked
        // to choose a username.
        // Not just #e2eUsername, then might try to fill in the username in the create-password-
        // user fields which are still visible for a short moment. Dupl code (2QPKW02)
        logMessage("typing LinkedIn user's new username...");
        this.waitAndSetValue('.esCreateUserDlg #e2eUsername', ps.username);
        this.loginDialog.clickSubmit();
        this.loginDialog.acceptTerms(ps.shallBecomeOwner);
        // LinkedIn email addresses might not have been verified (or?) so need
        // to click an email addr verif link.
        const siteId = this.getSiteId();
        const link = server.getLastVerifyEmailAddressLinkEmailedTo(siteId, ps.email, this.#br);
        this.go2(link);
        this.waitAndClick('#e2eContinue');
      },


      loginWithLinkedIn: (data: { email: string, password: string,
            alreadyLoggedIn?: boolean, isInPopupAlready?: boolean }) => {
        // Pause or sometimes the click misses the button. Is the this.#br doing some re-layout?
        this.#br.pause(100);
        this.waitAndClick('#e2eLoginLinkedIn');

        // Switch to LinkedIn's login popup window.
        if (!data.isInPopupAlready)
          this.swithToOtherTabOrWindow(IsWhere.External);

        // Wait until popup window done loading.
        while (true) {
          if (this.loginDialog.loginPopupClosedBecauseAlreadyLoggedIn()) {
            this.switchBackToFirstTabOrWindow();
            return;
          }
          try {
            if (this.isExisting('input#username'))
              break;
          }
          catch (dummy) {
            logMessage("Didn't find input#username. Tab closed because already logged in?");
          }
          this.#br.pause(300);
        }

        logMessage("typing LinkedIn user's email and password...");
        this.#br.pause(340); // so less risk LinkedIn thinks this is a computer?
        // This is over at LinkedIn, and, as username, one can type one's email.
        this.waitAndSetValue('#username', data.email);
        this.#br.pause(380);
        this.waitAndSetValue('#password', data.password);
        this.#br.pause(280);

        logMessage("submitting LinkedIn login dialog...");
        this.waitAndClick('button[type="submit"]');

        // If needed, confirm permissions: click an Allow button.
        try {
          for (let i = 0; i < 10; ++i) {
            if (this.isVisible('#oauth__auth-form__submit-btn')) {
              this.waitAndClick('#oauth__auth-form__submit-btn');
            }
            else {
              const url = this.#br.getUrl();
              if (url.indexOf('linkedin.com') === -1) {
                logMessage("Didn't need to click any Allow button: Left linkedin.com");
                break;
              }
            }
          }
        }
        catch (ex) {
          const seemsFine = isWindowClosedException(ex);
          logMessage("Didn't need to click Allow button: " + (
              seemsFine ? "The login popup window closed itself." : "Unexpected exception:"));
          if (!seemsFine) {
            logException(ex);
          }
        }

        if (!data.isInPopupAlready) {
          logMessage("switching back to first tab...");
          this.switchBackToFirstTabOrWindow();
        }
      },


      clickLoginWithOidcAzureAd: () => {
        // Maybe moves — the dialog might scroll in?
        this.waitAndClick('#e2eLoginoidc\\/azure_test_alias', { maybeMoves: true });
      },


      loginWithOidcAzureAd: (ps: { email: St, password: St,
            anyWelcomeDialog?: 'THERE_WILL_BE_NO_WELCOME_DIALOG',
            alreadyLoggedIn?: Bo, isInLoginPopupAlready?: Bo, stayInPopup?: Bo,
            fullScreenLogin?: Bo, staySignedIn?: Bo }) => {

        // Switch to LinkedIn's login popup window.
        if (!ps.isInLoginPopupAlready && !ps.fullScreenLogin)
          this.swithToOtherTabOrWindow(IsWhere.External);

        const emailInputSelector = 'input[type="email"]';
        const emailNext = 'input[type="submit"]';
        const passwordInputSelector = 'input[type="password"]';
        const passwordNext = 'input[type="submit"]';
        const yesStaySignedInButton = 'input[type="submit"]';
        const noDontStaySignedInButton = 'input#idBtn_Back';
        const grantPermsButton = 'input[type="submit"]';

        // Wait until popup window done loading.
        while (true) {
          if (ps.fullScreenLogin) {
            // Dupl code [insta_login]
            // If logged in both at Azure and Ty directly: There's a race?
            // Sometimes we'll see Ty's login dialog briefly before it closes and
            // one's username appears. — This is fine, the tests should work anyway.
            const idpLoginDone = this.isExisting('.dw-login-modal');
            logMessageIf(idpLoginDone,
                `Got logged in directly at IDP (Azure)`);

            const idpAndTalkyardLoginDone = this.isExisting('.esMyMenu .esAvtrName_name');
            logMessageIf(idpAndTalkyardLoginDone,
                `Got logged in directly at both IDP (Azure) and Talkyard`);

            if (idpLoginDone || idpAndTalkyardLoginDone)
              return;
          }
          else if (this.loginDialog.loginPopupClosedBecauseAlreadyLoggedIn()) {
            logMessage(`IDP (Azure) login done, back at Talkyard`);
            this.switchBackToFirstTabOrWindow();
            return;
          }
          try {
            // Continue below once the IDP input fields appear.
            if (this.isExisting(emailInputSelector))
              break;
          }
          catch (dummy) {
            logMessage(`Didn't find ${emailInputSelector
                  }. Login popup closed because already logged in?`);
          }
          this.#br.pause(300);
        }

        logMessage("Typing Azure user's email and password ...");
        this.#br.pause(340); // so less risk Azure thinks this is a computer?
        // This is over at Azure, and, as username, one can type one's email.
        this.waitAndSetValue(emailInputSelector, ps.email);
        this.#br.pause(380);
        this.waitAndClick(emailNext);
        this.waitAndSetValue(passwordInputSelector, ps.password);
        this.#br.pause(280);
        this.waitAndClick(passwordNext);
        this.waitUntilTextIs('.text-title', "Stay signed in?");

        logMessage(`submitting Azure login dialog, and ps.staySignedIn: ${
                ps.staySignedIn} ...`);
        this.waitAndClick(ps.staySignedIn ?
                yesStaySignedInButton : noDontStaySignedInButton);

        // Sometimes also:  .consentHeader  "Permissions requested"
        // Then click:   grantPermsButton

        if (!ps.isInLoginPopupAlready && !ps.stayInPopup && !ps.fullScreenLogin) {
          logMessage("switching back to first tab...");
          this.switchBackToFirstTabOrWindow();
        }
      },

      checkLinkAccountsTextOk: (ps: { matchingEmail: St,
            talkyardUsername: St, azureFullName: St, idpName: St }) => {
        // Now there's some info text, and one needs to login again via the IDP,
        // to find out directly, if it works or not.
        this.assertTextIs('.e_EmAdr', ps.matchingEmail);
        this.assertTextIs('.e_TyUn', ps.talkyardUsername);
        this.assertTextIs('.e_NameAtIdp', ps.azureFullName);
        this.assertTextIs('.e_IdpName', ps.idpName);
      },

      clickYesLinkAccounts: () => {
        this.waitAndClick('.e_YesLnActsB');
      },

      clickLogInAgain: (ps: { isInPopupThatWillClose?: Bo } = {}) => {
        // If clicking quickly, won't work. Why not? This is just a plain
        // ordinary <a href=..>, no Javascript. Whatvever, just:  [E2EBUG]
        this.pause(444);
        this.waitAndClick('.e_LogInAgain');

        /*
        // There's some race, button clicked but nothing happens — so try a few times.)
        utils.tryUntilTrue("Login again, after linked accounts", 3, 'ExpBackoff', () => {
          return this.waitAndClick('.e_LogInAgain') === 'Clicked';
        });
        utils.tryUntilTrue("Login again, after linked accounts", 3, 'ExpBackoff', () => {
          this.waitAndClick('.e_LogInAgain');
          return this.waitUntilGone('.e_LogInAgain', {
                  timeoutMs: 500, timeoutIsFine: true });
        });
        */
      },

      loginPopupClosedBecauseAlreadyLoggedIn: (): boolean => {
        try {
          logMessage("checking if we got logged in instantly... [EdM2PG44Y0]");
          const yes = this.numWindowsOpen() === 1;// ||  // login tab was auto closed
              //this.isExisting('.e_AlreadyLoggedIn');    // server shows logged-in-already page
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

      waitAndClickOkInWelcomeDialog: () => {
        this.waitAndClick('#te_WelcomeLoggedIn .btn');
      },

      clickResetPasswordCloseDialogSwitchTab: () => {
        // This click opens a new tab.
        this.waitAndClick('.dw-reset-pswd');
        // The login dialog should close when we click the reset-password link. [5KWE02X]
        this.waitUntilModalGone();
        this.waitUntilLoadingOverlayGone();
        this.swithToOtherTabOrWindow();
        this.waitForVisible('#e2eRPP_emailI');
      },

      clickSubmit: () => {
        this.waitAndClick('#e2eSubmit');
      },

      clickCancel: () => {
        this.waitAndClick('#e2eLD_Cancel');
        this.waitUntilModalGone();
      },

      acceptTerms: (isForSiteOwner?: boolean) => {
        this.waitForVisible('#e_TermsL');
        this.waitForVisible('#e_PrivacyL');
        const termsLinkHtml = this.$('#e_TermsL').getHTML();
        const privacyLinkHtml = this.$('#e_PrivacyL').getHTML();
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
        this.setCheckbox('.s_TermsD_CB input', true);
        this.waitAndClick('.s_TermsD_B');
      },

      reopenToClearAnyError: () => {
        this.loginDialog.clickCancel();
        this.topbar.clickLogin();
      },
    };


    resetPasswordPage = {
      submitAccountOwnerEmailAddress: (emailAddress: string) => {
        logBoring(`Types email address ...`);
        this.resetPasswordPage.fillInAccountOwnerEmailAddress(emailAddress);
        this.rememberCurrentUrl();
        logBoring(`Submits ...`);
        this.resetPasswordPage.clickSubmit();
        logBoring(`Waits for confirmation that a password reset email got sent ...`);
        this.waitForNewUrl();
        this.waitForVisible('#e2eRPP_ResetEmailSent');
        logBoring(`... Done`);
      },

      fillInAccountOwnerEmailAddress: (emailAddress: string) => {
        this.waitAndSetValue('#e2eRPP_emailI', emailAddress);
      },

      clickSubmit: () => {
        this.waitAndClick('#e2eRPP_SubmitB');
      },
    };


    chooseNewPasswordPage = {
      typeAndSaveNewPassword: (password: string, opts: { oldPassword?: string } = {}) => {
        this.chooseNewPasswordPage.typeNewPassword(password);
        if (!opts.oldPassword) {
          // There's a <span> with the below class, just to show this test that there's
          // no type-old-password input field.
          assert(this.isExisting('.e_NoOldPwI'));
        }
        this.chooseNewPasswordPage.submit();
        this.chooseNewPasswordPage.waitUntilPasswordChanged();
      },

      typeNewPassword: (password: string) => {
        this.waitAndSetValue('#e2ePassword', password);
      },

      submit: () => {
        this.waitAndClick('.e_SbmNewPwB');
      },

      waitUntilPasswordChanged: () => {
        // Stays at the same url.
        this.waitForVisible("#e2eRPP_PasswordChanged");
      },

      navToHomepage: () => {
        logMessage("Following homepage link...");
        this.repeatUntilAtNewUrl(() => {
          this.waitAndClick('a[href="/"]');
        });
      },
    }


    pageTitle = {
      clickEdit: () => {
        this.waitAndClick('#e2eEditTitle');
      },

      editTitle: (title: string) => {
        this.waitAndSetValue('#e2eTitleInput', title);
      },

      save: () => {
        this.waitAndClick('.e_Ttl_SaveB');
        this.pageTitle.waitForVisible();
      },

      waitForVisible: () => {
        this.waitForVisible('.dw-p-ttl h1');
      },

      openAboutAuthorDialog: () => {
        const selector = '.dw-ar-p-hd .esP_By';
        this.waitForVisible(selector);
        this.topic.clickPostActionButton(selector);
        this.waitForVisible('.esUsrDlg');
      },

      assertMatches: (regex: string | RegExp) => {
        this.assertPageTitleMatches(regex);
      },

      // Also see this.assertWholePageHidden().
      assertPageHidden: () => {
        this.pageTitle.waitForVisible();
        assert(this.pageTitle.__isEyeOffVisible());
      },

      assertPageNotHidden: () => {
        this.pageTitle.waitForVisible();
        assert(!this.pageTitle.__isEyeOffVisible());
      },

      __isEyeOffVisible: (): Bo => this.isVisible('.dw-p-ttl .icon-eye-off'),


      __changePageButtonSelector: '.dw-p-ttl .dw-clickable',

      openChangePageDialog: () => {
        this.waitAndClick(this.pageTitle.__changePageButtonSelector);
        this.topic.waitUntilChangePageDialogOpen();
      },

      canBumpPageStatus: (): boolean => {
        return this.isVisible(this.pageTitle.__changePageButtonSelector);
      },
    }


    forumButtons = {
      clickEditIntroText: () => {
        this.waitAndClick('.esForumIntro_edit');
        this.waitAndClick('#e2eEID_EditIntroB');
        this.waitUntilModalGone();
      },

      clickRemoveIntroText: () => {
        this.waitAndClick('.esForumIntro_edit');
        this.waitAndClick('#e2eEID_RemoveIntroB');
        this.waitUntilModalGone();
      },

      clickViewCategories: () => {
        this.waitAndClick('#e_ViewCatsB');
      },

      viewTopics: (ps: { waitForTopics?: false } = {}) => {
        this.waitAndClick('#e2eViewTopicsB');
        if (ps.waitForTopics !== false) {
          this.forumTopicList.waitForTopics();
        }
      },

      clickViewNew: () => {
        this.waitAndClick('#e_SortNewB');
      },

      clickCreateCategory: () => {
        this.waitAndClick('#e2eCreateCategoryB');
      },

      clickEditCategory: () => {
        this.waitAndClick('.s_F_Ts_Cat_Edt');
        // Wait until slide-in animation done, otherwise subsequent clicks inside
        // the dialog might miss.
        this.waitForVisible('#t_CD_Tabs');
        this.waitUntilDoesNotMove('#t_CD_Tabs');
      },

      clickCreateTopic: () => {
        this.waitAndClick('#e2eCreateSth');
      },

      getCreateTopicButtonText: (): string => {
        return this.waitAndGetVisibleText('#e2eCreateSth');
      },

      assertNoCreateTopicButton: () => {
        // Wait until the button bar has loaded.
        this.waitForVisible('#e_ViewCatsB');
        assert(!this.isVisible('#e2eCreateSth'));
      },

      listDeletedTopics: () => {
        this.waitAndClick('.esForum_filterBtn');
        this.waitAndClick('.s_F_BB_TF_Dd');
        this.forumTopicList.waitForTopics();
      },
    }


    forumTopicList = {  // RENAME to topicList
      titleSelector: '.e2eTopicTitle a',  // <– remove, later: '.c_F_TsL_T_Title',  CLEAN_UP
      hiddenTopicTitleSelector: '.e2eTopicTitle a.icon-eye-off',

      goHere: (ps: { origin?: string, categorySlug?: string } = {}) => {
        const origin = ps.origin || '';
        this.go(origin + '/latest/' + (ps.categorySlug || ''));
      },

      waitUntilKnowsIsEmpty: () => {
        this.waitForVisible('#e2eF_NoTopics');
      },

      clickEditCategory: () => die('TyE59273',
            "Use forumButtons.clickEditCategory() instead"),

      waitForCategoryName: (name: string, ps: { isSubCat?: true } = {}) => {
        const selector = ps.isSubCat ? '.s_F_Ts_Cat_Ttl-SubCat' : '.s_F_Ts_Cat_Ttl';
        this.waitAndGetElemWithText(selector, name);
      },

      waitForTopics: (ps: { timeoutMs?: Nr, timeoutIsFine?: Bo } = {}) => {
        this.waitForVisible('.e2eF_T', ps);  // was timeoutMs: 1000 why?
      },

      waitForTopicVisible: (title: string) => {
        this.waitUntilAnyTextMatches(this.forumTopicList.titleSelector, title);
      },

      clickLoadMore: (opts: { mayScroll?: boolean } = {}) => {
        this.waitAndClick('.load-more', opts);
      },

      switchToCategory: (toCatName: string) => {
        this.waitAndClick('.esForum_catsDrop.s_F_Ts_Cat_Ttl');
        this.waitAndClickSelectorWithText('.s_F_BB_CsM a', toCatName);
        this.forumTopicList.waitForCategoryName(toCatName);
      },

      clickViewLatest: () => {
        this.waitAndClick('#e2eSortLatestB');
        this.waitUntilGone('.s_F_SI_TopB');
        // Means topics loaded.
        this.waitForVisible('.e_SrtOrdr-1'); // TopicSortOrder.BumpTime
      },

      viewNewest: () => {
        this.forumButtons.clickViewNew();
        this.waitUntilGone('.s_F_SI_TopB');
        // This means topics loaded:
        this.waitForVisible('.e_SrtOrdr-2'); // TopicSortOrder.CreatedAt
      },

      clickViewTop: () => {
        this.waitAndClick('#e2eSortTopB');
        this.waitForVisible('.s_F_SI_TopB');
        this.waitForVisible('.e_SrtOrdr-3'); // TopicSortOrder.ScoreAndBumpTime
      },

      openAboutUserDialogForUsername: (username: string) => {
        this.waitAndClickFirst(`.edAvtr[title^="${username}"]`);
      },

      goToTopic: (title: string) => {   // RENAME to navToTopic
        this.forumTopicList.navToTopic(title);
      },

      navToTopic: (title: string) => {
        this.rememberCurrentUrl();
        this.waitForThenClickText(this.forumTopicList.titleSelector, title);
        this.waitForNewUrl();
        this.assertPageTitleMatches(title);
      },

      assertNumVisible: (howMany: number, ps: { wait?: boolean } = {}) => {
        if (ps.wait) {
          this.forumTopicList.waitForTopics();
        }
        this.assertExactly(howMany, '.e2eTopicTitle');
      },

      assertTopicTitlesAreAndOrder: (titles: string[]) => {
        const els = this.$$(this.forumTopicList.titleSelector);
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

      assertTopicVisible: (title: string) => {
        this.assertAnyTextMatches(this.forumTopicList.titleSelector, title);
        this.assertNoTextMatches(this.forumTopicList.hiddenTopicTitleSelector, title);
      },

      assertTopicNrVisible: (nr: number, title: string) => {
        this.assertNthTextMatches(this.forumTopicList.titleSelector, nr, title);
        this.assertNoTextMatches(this.forumTopicList.hiddenTopicTitleSelector, title);
      },

      assertTopicNotVisible: (title: string) => {
        this.assertNoTextMatches(this.forumTopicList.titleSelector, title);
      },

      assertTopicVisibleAsHidden: (title: string) => {
        this.assertAnyTextMatches(this.forumTopicList.hiddenTopicTitleSelector, title);
      },
    }


    forumCategoryList = {   // RENAME to categoryList
      categoryNameSelector: '.esForum_cats_cat .forum-title',
      subCategoryNameSelector: '.s_F_Cs_C_ChildCs_C',

      goHere: (origin?: string, opts: { shouldSeeAnyCats?: Bo } = {}) => {
        this.go((origin || '') + '/categories');
        this.forumCategoryList.waitForCategories(opts.shouldSeeAnyCats !== false);
      },

      waitForCategories: (shouldSeeAnyCats: Bo = true) => {
        if (shouldSeeAnyCats) {
          this.waitForVisible('.s_F_Cs');
        }
        else {
          this.waitForExist('.s_F_Cs');
          this.waitForAtMost(0, this.forumCategoryList.categoryNameSelector);
        }
      },

      waitForNumCategoriesVisible: (num: number) => {
        this.waitForAtLeast(num, this.forumCategoryList.categoryNameSelector);
      },

      namesOfVisibleCategories: (): string[] =>
        this.$$(this.forumCategoryList.categoryNameSelector).map(e => e.getText()),

      numCategoriesVisible: (): number =>
        this.$$(this.forumCategoryList.categoryNameSelector).length,

      numSubCategoriesVisible: (): number =>
        this.$$(this.forumCategoryList.subCategoryNameSelector).length,

      isCategoryVisible: (categoryName: string): boolean => {
        return this.isDisplayedWithText(
            this.forumCategoryList.categoryNameSelector, categoryName);
      },

      isSubCategoryVisible: (categoryName: string): boolean => {
        return this.isDisplayedWithText(
            this.forumCategoryList.subCategoryNameSelector, categoryName);
      },

      openCategory: (categoryName: string) => {
        this.forumCategoryList._openCategoryImpl(
            categoryName, this.forumCategoryList.categoryNameSelector);
      },

      openSubCategory: (categoryName: string) => {
        this.forumCategoryList._openCategoryImpl(
            categoryName, this.forumCategoryList.subCategoryNameSelector);
      },

      _openCategoryImpl: (categoryName: string, selector: string) => {
        this.repeatUntilAtNewUrl(() => {
          this.waitForThenClickText(selector, categoryName);
        });
        this.waitForVisible('.s_F_Ts_Cat_Ttl');
        const titleSelector = selector === this.forumCategoryList.subCategoryNameSelector
            ? '.s_F_Ts_Cat_Ttl-SubCat'
            : '.s_F_Ts_Cat_Ttl';
        this.assertTextMatches(titleSelector, categoryName);
      },

      // RENAME to setNotfLevelForCategoryNr?
      setCatNrNotfLevel: (categoryNr: number, notfLevel: PageNotfLevel) => {
        this.waitAndClickNth('.dw-notf-level', categoryNr);
        this.notfLevelDropdown.clickNotfLevel(notfLevel);
      },

      // MOVE to forumTopicList?
      assertCategoryNotFoundOrMayNotAccess: () => {
        this.assertAnyTextMatches('.dw-forum', '_TyE0CAT');
      }
    }


    categoryDialog = {
      fillInFields: (data: { name?: string, slug?: string,
            setAsDefault?: boolean, extId?: string }) => {
        if (data.name) {
          this.waitAndSetValue('#e2eCatNameI', data.name);
        }
        if (data.slug) {
          this.waitAndClick('#e2eShowCatSlug');
          this.waitAndSetValue('#e2eCatSlug', data.slug);
        }
        if (data.setAsDefault) {
          this.waitAndClick('#e2eSetDefCat');
        }
        if (data.extId) {
          this.waitAndClick('#te_ShowExtId');
          this.waitAndSetValue('#te_CatExtId', data.extId);
        }
      },

      setParentCategory: (catName: St) => {
        this.waitAndClick('.s_CD .e_SelCatB');
        this.waitAndClickSelectorWithText('.e_CatLs .esExplDrp_entry_title', catName)
        this.waitUntilTextIs('.s_CD .e_SelCatB', catName);
      },

      clearParentCategory: () => {
        this.waitAndClick('.s_CD_0SubCat');
        this.waitUntilTextIs('.s_CD .e_SelCatB', "None");
      },

      submit: () => {
        // ---- Some scroll-to-Save-button problem. So do a bit double scrolling.
        this.scrollIntoViewInPageColumn('#e2eSaveCatB')
        this.scrollToBottom();
        // ----
        this.waitAndClick('#e2eSaveCatB');
        this.waitUntilModalGone();
        this.waitUntilLoadingOverlayGone();
      },

      cancel: () => {
        this.waitAndClick('.e_CancelCatB');
        this.waitUntilGone('.s_CD');
        this.waitUntilModalGone();
        this.waitUntilLoadingOverlayGone();
      },

      setCategoryUnlisted: () => {
        this.waitAndClick('#e_ShowUnlRBs');
        this.waitAndClick('.e_UnlCatRB input');
      },

      setTopicsUnlisted: () => {
        this.waitAndClick('#e_ShowUnlRBs');
        this.waitAndClick('.e_UnlTpcsRB input');
      },

      setNotUnlisted: () => {
        this.waitAndClick('#e_ShowUnlRBs');
        this.waitAndClick('.e_DontUnlRB input');
      },

      deleteCategory: () => {
        this.waitAndClick('.s_CD_DelB');
        // Dismiss "Category deleted" message.
        this.stupidDialog.clickClose();
        this.categoryDialog.cancel();
      },

      undeleteCategory: () => {
        this.waitAndClick('.s_CD_UndelB');
        // Dismiss "Done, category undeleted" message.
        this.stupidDialog.clickClose();
        this.categoryDialog.cancel();
      },

      openSecurityTab: () => {
        this.waitAndClick('#t_CD_Tabs-tab-2');
        this.waitForVisible('.s_CD_Sec_AddB');
      },

      securityTab: {
        switchGroupFromTo: (fromGroupName: string, toGroupName: string) => {
          this.waitAndClickSelectorWithText('.s_PoP_Un .e_SelGrpB', fromGroupName);
          this.waitAndClickSelectorWithText(
              '.esDropModal_content .esExplDrp_entry', toGroupName);
        },

        removeGroup: (groupId: UserId) => {
          this.waitAndClick(`.s_PoP-Grp-${groupId} .s_PoP_Dl`);
          this.waitUntilGone(`.s_PoP-Grp-${groupId}`);
        },

        addGroup: (groupName: string) => {
          this.waitAndClick('.s_CD_Sec_AddB');
          this.waitAndClick('.s_PoP-Select-Grp .e_SelGrpB');
          this.waitAndClickSelectorWithText(
              '.esDropModal_content .esExplDrp_entry', groupName);
        },

        setMayCreate: (groupId: UserId, may: boolean) => {
          // For now, just click once
          this.waitAndClick(`.s_PoP-Grp-${groupId} .s_PoP_Ps_P_CrPg input`);
        },

        setMayReply: (groupId: UserId, may: boolean) => {
          // For now, just click once
          this.waitAndClick(`.s_PoP-Grp-${groupId} .s_PoP_Ps_P_Re input`);
        },

        setMayEditWiki: (groupId: UserId, may: boolean) => {
          // For now, just click once
          this.waitAndClick(`li.s_PoP:last-child .s_PoP_Ps_P_EdWk input`);  // for now
        },

        setMaySee: (groupId: UserId, may: boolean) => {
          // For now, just click once
          this.waitAndClick(`.s_PoP-Grp-${groupId} .s_PoP_Ps_P_See input`);
        },
      }
    }


    aboutUserDialog = {
      waitForLoaded: () => {
        this.waitUntilLoadingOverlayGone();
        this.waitForEnabled('.s_UD .e_CloseB');
        this.waitUntilDoesNotMove('.s_UD .e_CloseB');
      },

      getUsername: (): string => {
        this.aboutUserDialog.waitForLoaded();
        return this.waitAndGetVisibleText('.s_UD_Un');
      },

      close: () => {
        this.aboutUserDialog.waitForLoaded();
        this.waitAndClick('.s_UD .e_CloseB');
        this.waitForGone('.s_UD');
        this.waitUntilModalGone();
      },

      clickSendMessage: () => {
        this.aboutUserDialog.waitForLoaded();
        this.rememberCurrentUrl();
        this.waitAndClick('#e2eUD_MessageB');
        this.waitForNewUrl();
        /*  DO_AFTER having tested this in FF with Wdio 6.0: Remove this:
        // Wait until new-message title can be edited.
        // For some reason, FF is so fast, so typing the title now after new page load, fails
        // the first time  [6AKBR45] [E2EBUG] — but only in an invisible this.#br, and within
        // fractions of a second after page load, so hard to fix. As of 2019-01.
        utils.tryManyTimes("Clearing the title field", 2, () => {
          this.editor.editTitle('');
        }); */
      },

      clickViewProfile: () => {
        this.aboutUserDialog.waitForLoaded();
        this.rememberCurrentUrl();
        this.waitAndClick('#e2eUD_ProfileB');
        this.waitForNewUrl();
      },

      clickRemoveFromPage: () => {
        this.aboutUserDialog.waitForLoaded();
        this.waitAndClick('#e2eUD_RemoveB');
        // Later: this.#br.waitUntilModalGone();
        // But for now:  [5FKE0WY2]
        this.waitForVisible('.esStupidDlg');
        this.#br.refresh();
      },
    }


    addUsersToPageDialog = {
      focusNameInputField: () => {
        this.waitAndClick('#e2eAddUsD .Select-placeholder');
      },

      startTypingNewName: (chars: string) => {
        this.waitAndSetValue('#e2eAddUsD .Select-input > input', chars,
            { okayOccluders: '.Select-placeholder', checkAndRetry: true });
      },

      appendChars: (chars: string) => {
        this.$('#e2eAddUsD .Select-input > input').addValue(chars);
      },

      hitEnterToSelectUser: () => {
        // Might not work in Firefox. Didn't in wdio v4.
        // Doesn't work with DevTools; types the letters in "Return" instead. [E2EBUG]
        // But works with WebDriver / Selenium.
        logWarningIf(settings.useDevtoolsProtocol, `\n\n` +
              `this.#br.keys(['Return'])  won't work with DevTools!  ` +
              `Just types "Return" instead\n\n`);
        this.#br.keys(['Return']);
      },

      addOneUser: (username: string) => {
        this.addUsersToPageDialog.focusNameInputField();
        this.addUsersToPageDialog.startTypingNewName(
            // Clicking Return = complicated!  Only + \n  works in FF:  [E2EENTERKEY]
            // The Select input is special: the <input> is occluded, but still works fine.
            // Update: '\n' stopped working properly in Wdio v6?  Try with 'Enter' again.
            // username + '\n');
            username);

        this.addUsersToPageDialog.hitEnterToSelectUser();


        // Works in Chrome but not FF:
        // this.keys(['Return']);  — so we append \n above, work as a Return press.

        /* Need to?:
          if (this.#br.options.desiredCapabilities.browserName == "MicrosoftEdge")
            element.setValue(...);
            this.#br.keys("\uE007");
          others:
            element.setValue(`...\n`);
        } */

        // None of this works:  DELETE_LATER after year 2019?
        /*
        this.#br.keys(['Enter']);
        this.#br.keys('\n');
        this.#br.keys('(\ue007');
        this.#br.keys('\uE006');
        this.#br.actions([{
          "type": "key",
          //"id": "keyboard",
          "id": "keys",
          "actions": [
            { "type": "keyDown", "value": "Enter" },
            { "type": "keyUp", "value": "Enter" }
          ]
        }]);
        const result = this.#br.elementActive();
        const activeElement = result.value && result.value.ELEMENT;
        if(activeElement){
          this.#br.elementIdValue(activeElement, ['Return']);
        }
        const result = this.#br.elementActive();
        const activeElement = result.value && result.value.ELEMENT;
        if(activeElement){
          this.#br.elementIdValue(activeElement, '\uE006');
        } */

        // Weird. The react-select dropdown is open and needs to be closed, otherwise
        // a modal overlay hides everything? Can be closed like so:
        // No, now in rc.10 (instead of previous version, rc.3), the dropdown auto closes, after select.
        // this.#br.click('#e2eAddUsD_SubmitB');
      },

      submit: (ps: { closeStupidDialogAndRefresh?: true } = {}) => {
          // Sometimes the click fails (maybe the dialog resizes, once a member is selected, so
          // the Submit button moves a bit?). Then, the Add More Group Members button will
          // remain occluded.
        const submitSelector = '#e2eAddUsD_SubmitB';
        utils.tryManyTimes(`Submit members`, 2, () => {
          this.waitAndClick(submitSelector);
          const isGone = this.waitUntilGone(submitSelector, {
                  timeoutMs: 2000, timeoutIsFine: true });
          if (!isGone)
            throw `Not yet gone: ${submitSelector}`;
        });
        // Later: this.#br.waitUntilModalGone();
        // But for now:  [5FKE0WY2]
        if (ps.closeStupidDialogAndRefresh) {
          this.waitForVisible('.esStupidDlg');
          this.#br.refresh();
        }
      }
    };


    editor = {
      editTitle: (title: string, opts: { checkAndRetry?: true } = {}) => {
        this.waitAndSetValue('.esEdtr_titleEtc_title', title, opts);
      },

      isTitleVisible: () => {
        this.waitForDisplayed('.editor-area');
        return this.isVisible('.editor-area .esEdtr_titleEtc_title');
      },

      getTitle: (): string => {
        return this.$('.editor-area .esEdtr_titleEtc_title').getText();
      },

      waitForSimilarTopics: () => {
        this.waitForVisible('.s_E_SimlTpcs');
      },

      numSimilarTopics: (): number => {
        return this.count('.s_E_SimlTpcs_L_It');
      },

      isSimilarTopicTitlePresent: (title: string) => {
        const text = this.waitAndGetVisibleText('.s_E_SimlTpcs')
        return text.search(title) >= 0;
      },

      editText: (text: string, opts: {
          timeoutMs?: number, checkAndRetry?: true,
          append?: boolean, skipWait?: true } = {}) => {
        this.switchToEmbEditorIframeIfNeeded();
        this.waitAndSetValue('.esEdtr_textarea', text, opts);
      },

      getText: (): string => {
        return this.waitAndGetValue('.editor-area textarea');
      },

      openTopicTypeDropdown: () => {
        this.waitAndClick('.esTopicType_dropdown');
      },

      closeTopicTypeDropdown: () => {
        this.waitAndClick('.esDropModal_CloseB');
      },

      canClickShowMoreTopicTypes: (): Bo => {
        this.waitForDisplayed('#te_DiscO');
        return this.isVisible('.esPageRole_showMore');
      },

      setTopicType: (type: PageRole) => {
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
        this.editor.openTopicTypeDropdown();
        if (needsClickMore) {
          this.waitAndClick('.esPageRole_showMore');
        }
        this.waitAndClick(optionId);
        this.waitUntilModalGone();
      },

      uploadFile: (whichDir: 'TargetDir' | 'TestMediaDir', fileName: St,
            ps: { waitForBadExtErr?: Bo, waitForTooLargeErr?: Bo, allFine?: false } = {}
            ) => {
        //this.waitAndClick('.e_UplB');
        // There'll be a file <input> not interactable error, unless we change
        // its size to sth larger than 0 x 0.
        this.waitForExist('.e_EdUplFI');
        this.#br.execute(function() {
          var elem = document.querySelector('.e_EdUplFI');
          // Use ['style'] because this:  elem.style  causes a compilation error.
          elem['style'].width = '70px';
          elem['style'].height = '20px';
        });
        this.waitAndSelectFile('.e_EdUplFI', whichDir, fileName);
        if (ps.waitForBadExtErr) {
          // If there's no extension, then waitForExist(), not waitForVisibleText().
          const sel = '.s_UplErrD .s_UplErrD_UplNm';
          const lastIx = fileName.lastIndexOf('.')
          0 <= lastIx && lastIx <= fileName.length - 2
                ? this.waitForVisibleText(sel)
                : this.waitForExist(sel);
          this.stupidDialog.close();
        }
        else if (ps.waitForTooLargeErr) {
          this.waitForVisibleText('.s_UplErrD .e_FlTooLg');
          this.stupidDialog.close();
        }
        else if (ps.allFine !== false) {
          tyAssert.not(this.isVisible('.s_UplErrD'), `Unexpected file upload error`);
        }
      },

      cancelNoHelp: () => {  // REMOVE just use cancel() now, help dialog removed
        const buttonSelector = '#debiki-editor-controller .e_EdCancelB';
        this.waitAndClick(buttonSelector);
        // waitForGone won't work — the editor just gets display:none but is still there.
        logWarning(`Trying  this.waitUntilGone(buttonSelector)  although won't work?`);
        this.waitUntilGone(buttonSelector);  // waitForNotVisible
      },

      cancel: () => {
        this.editor.cancelNoHelp();
      },

      closeIfOpen: () => {
        if (this.isVisible('#debiki-editor-controller .e_EdCancelB')) {
          this.editor.cancel();
        }
      },

      switchToSimpleEditor: () => {
        this.waitAndClick('.e_EdCancelB'); // could use different class, weird name
        this.waitForVisible('.esC_Edtr');
      },

      save: () => {
        this.switchToEmbEditorIframeIfNeeded();
        this.editor.clickSave();
        this.waitUntilLoadingOverlayGone();
      },

      clickSave: () => {
        this.waitAndClick('.e_E_SaveB');
      },

      saveWaitForNewPage: () => {
        this.rememberCurrentUrl();
        this.editor.save();
        this.waitForNewUrl();
      },

      isDraftJustSaved: () => {
        this.isVisible('.e_DfSts-' + c.TestDraftStatus.Saved);
      },

      waitForDraftSaved: () => {
        this.waitForVisible('.e_DfSts-' + c.TestDraftStatus.Saved);
      },

      waitForDraftSavedInBrowser: () => {
        this.waitForVisible('.e_DfSts-' + c.TestDraftStatus.SavedInBrowser);
      },

      waitForDraftDeleted: () => {
        this.waitForVisible('.e_DfSts-' + c.TestDraftStatus.Deleted);
      },

      waitForDraftTitleToLoad: (text: string) => {
        this.waitUntilValueIs('.editor-area .esEdtr_titleEtc_title', text);
      },

      waitForDraftTextToLoad: (text: string) => {
        this.waitUntilValueIs('.editor-area textarea', text);
      },
    };


    linkPreview = {
      waitUntilLinkPreviewMatches: (ps: { postNr: PostNr, timeoutMs?: number,
            regex: string | RegExp, whichLinkPreviewSelector?: string,
            inSandboxedIframe: Bo, inDoubleIframe: Bo }) => {
        const linkPrevwSel = ' .s_LnPv' + (ps.whichLinkPreviewSelector || '');
        if (ps.inSandboxedIframe) {
          this.topic.waitForExistsInIframeInPost({ postNr: ps.postNr,
                iframeSelector: linkPrevwSel + ' iframe',
                yetAnotherIframeInside: ps.inDoubleIframe,
                textToMatch: ps.regex,
                timeoutMs: ps.timeoutMs });
        }
        else {
          const selector = this.topic.postBodySelector(ps.postNr) + linkPrevwSel;
          this.waitForExist(selector, { timeoutMs: ps.timeoutMs });
          if (ps.regex) {
            this.waitUntilTextMatches(selector, ps.regex);
          }
        }
      },
    };

    preview = {  // RENAME to editorPreview  ?
      __inPagePreviewSelector: '.s_P-Prvw',
      __inEditorPreviewSelector: '#t_E_Preview',

      exists: (selector: string, opts: { where: 'InEditor' | 'InPage' }): boolean => {
        return this.preview.__checkPrevw(opts, (prevwSelector: string) => {
          return this.isExisting(prevwSelector + selector);
        });
      },

      waitUntilGone: () => {
        this.waitForGone(this.preview.__inPagePreviewSelector);
        this.waitForGone(this.preview.__inEditorPreviewSelector);
      },

      waitForExist: (
            selector: string, opts: { where: 'InEditor' | 'InPage', howMany?: number }) => {
        this.preview.__checkPrevw(opts, (prevwSelector: string) => {
          this.waitForExist(prevwSelector + selector, { howMany: opts.howMany });
        });
      },

      waitForDisplayedInEditor: () => {
        this.waitForDisplayed(this.preview.__inEditorPreviewSelector);
      },

      waitUntilPreviewHtmlMatches: (text: string,
            opts: { where: 'InEditor' | 'InPage', whichLinkPreviewSelector?: string }) => {
        this.preview.__checkPrevw(opts, (prevwSelector: string) => {
          this.waitUntilHtmlMatches(prevwSelector, text);
        });
      },

      // ^--REMOVE, use --v  instead
      waitUntilPreviewTextMatches: (regex: string | RegExp,
            opts: { where: 'InEditor' | 'InPage', whichLinkPreviewSelector?: string,
                  inSandboxedIframe: Bo, inDoubleIframe?: Bo }) => {
        this.preview.__checkPrevw(opts, (prevwSelector: string) => {
          if (opts.inSandboxedIframe) {
            this.switchToFrame(`${prevwSelector}.s_LnPv iframe`);
            if (opts.inDoubleIframe) {
              this.switchToFrame('iframe');
            }
            this.waitUntilTextMatches('body', regex);
            if (opts.inDoubleIframe) {
              this.switchToTheParentFrame({ parentIs: IsWhere.UnknownIframe });
            }
            this.switchToTheParentFrame();
          }
          else {
            this.waitUntilTextMatches(`${prevwSelector}.s_LnPv`, regex);  // or just prevwSelector ?
          }
        });
      },

      __checkPrevw: <R>(opts: { where: 'InEditor' | 'InPage',
              whichLinkPreviewSelector?: string }, fn: (string) => R): R => {
        const lnPvSelector = opts.whichLinkPreviewSelector || '';
        if (opts.where === 'InEditor') {
          this.switchToEmbEditorIframeIfNeeded();
          return fn(`${this.preview.__inEditorPreviewSelector} ${lnPvSelector}`);
        }
        else {
          this.switchToEmbCommentsIframeIfNeeded();
          return fn(`${this.preview.__inPagePreviewSelector} ${lnPvSelector}`);
        }
      },
    };


    metabar = {   // RENAME to pagebar? [metabar_2_pagebar]
      __myName: '.s_MB_Name',
      __loginBtnSel: '.esMetabar .dw-a-login',
      __logoutBtnSel: '.esMetabar .dw-a-logout',
      __anyLogoutBtnSel: '.dw-a-logout',

      isVisible: (): boolean => {
        return this.isVisible('.dw-cmts-tlbr-summary');
      },

      waitForDisplayed: () => {
        this.waitForDisplayed('.dw-cmts-tlbr-summary');
      },

      isLoggedIn: (): Bo => {
        return this.isDisplayed(this.metabar.__myName);
      },

      isLogoutBtnDisplayed: (): Bo => {
        return this.isDisplayed(this.metabar.__anyLogoutBtnSel);
      },

      clickLogin: (opts: WaitAndClickPs = {}) => {
        this.waitAndClick(this.metabar.__loginBtnSel, opts);
      },

      waitForLoginButtonVisible: () => {
        this.waitForDisplayed(this.metabar.__loginBtnSel);
      },

      isLoginButtonDisplayed: (): Bo => {
        return this.isDisplayed(this.metabar.__loginBtnSel);
      },

      waitUntilLoggedIn: () => {
        this.waitForMyDataAdded();
        this.waitForVisible(this.metabar.__myName);
      },

      waitUntilNotLoggedIn: () => {
        this.waitForMyDataAdded();
        this.waitForGone(this.metabar.__myName);
      },

      getMyFullName: (): string => {
        return this.waitAndGetVisibleText('.s_MB_Name .esP_By_F');
      },

      getMyUsernameInclAt: (): string => {
        return this.waitAndGetVisibleText('.s_MB_Name .esP_By_U');
      },

      isMyUsernameVisible: (): Bo => {
        return this.isDisplayed('.s_MB_Name .esP_By_U');
      },

      openMyProfilePageInNewTab: () => {
        this.waitAndClick('.s_MB_Name');
        logBoring(`A new tab opens`);
        this.waitForMinBrowserTabs(2);
      },

      clickLogout: (ps: { waitForLoginButton?: Bo } = {}) => {
        const wasInIframe = this.isInIframe();
        this.waitAndClick('.esMetabar .dw-a-logout');
        this.waitUntilGone('.esMetabar .dw-a-logout');
        if (!ps.waitForLoginButton)
          return;

        // Is there a race? Any iframe might reload, after logout. Better re-enter it?
        // Otherwise the wait-for .esMetabar below can fail.
        if (wasInIframe) {
          this.switchToEmbeddedCommentsIrame();
        }
        this.waitForVisible('.esMetabar');
        this.waitForGone(this.metabar.__myName);  // later, move to above 'return',  [hide_authn_btns]
      },

      openMetabar: () => {
        this.waitAndClick('.dw-page-notf-level');
        this.waitForVisible('.esMB_Dtls_Ntfs_Lbl');
      },

      openMetabarIfNeeded: () => {
        if (!this.isVisible('.esMB_Dtls_Ntfs_Lbl')) {
          this.metabar.openMetabar();
        }
      },

      chooseNotfLevelWatchAll: () => {
        this.waitAndClick('.dw-notf-level');
        this.waitAndClick('.e_NtfAll');
        this.waitForGone('.e_NtfAll');
      },

      setPageNotfLevel: (notfLevel: PageNotfLevel) => {
        this.switchToEmbCommentsIframeIfNeeded();
        this.metabar.openMetabarIfNeeded();
        this.waitAndClick('.dw-notf-level');
        this.notfLevelDropdown.clickNotfLevel(notfLevel);
      },
    };


    topicTypeExpl = {
      isTopicTypeExplVisible: (): Bo => {
        this.waitForDisplayed('.dw-p-ttl');
        return this.isVisible('.s_Pg_TtlExpl');
      }
    };


    topic = {
      waitUntilPageDeleted: () => {
        this.waitForVisible('.s_Pg_DdInf');
      },

      waitUntilPageRestored: () => {
        this.waitUntilGone('.s_Pg_DdInf');
      },

      isPageDeletedButVisible: (): boolean => {
        return this.isVisible('.s_Pg_DdInf');
      },

      postHeaderSelector: (postNr: PostNr) => `#post-${postNr} .dw-p-hd`,

      postBodySelector: (postNr: PostNr) => `#post-${postNr} .dw-p-bd .dw-p-bd-blk`,

      forAllPostIndexNrElem: (fn: (index: number, postNr: PostNr, elem) => void) => {
        const postElems = this.$$('[id^="post-"]');
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

      clickHomeNavLink: () => {
        // this.waitAndClick() results in this error:
        //   Failed to execute 'querySelector' on 'Document':
        //   'a=Home' is not a valid selector.
        // Instead:  [EQSELEC]
        this.waitForDisplayed(`a=Home`);
        this.$("a=Home").click();
      },

      waitForLoaded: () => {
        this.waitForVisible('.dw-ar-t');
      },

      assertPagePendingApprovalBodyHidden: () => {
        this.topic.waitForLoaded();
        assert(this.topic._isTitlePendingApprovalVisible());
        assert(this.topic._isOrigPostPendingApprovalVisible());
        assert(!this.topic._isOrigPostBodyVisible());
      },

      assertPagePendingApprovalBodyVisible: () => {
        this.topic.waitForLoaded();
        assert(this.topic._isTitlePendingApprovalVisible());
        assert(this.topic._isOrigPostPendingApprovalVisible());
        assert(this.topic._isOrigPostBodyVisible());
      },

      assertPageNotPendingApproval: () => {
        this.topic.waitForLoaded();
        assert(!this.topic._isOrigPostPendingApprovalVisible());
        assert(this.topic._isOrigPostBodyVisible());
      },

      getCurCategoryName: (): St => {
        return this.waitAndGetVisibleText(this.topic.__getCurCatNameSelector());
      },

      movePageToOtherCategory: (catName: St) => {
        this.topic.openChangePageDialog();
        this.waitAndClick('.s_ChPgD .e_SelCatB');
        this.waitAndClickSelectorWithText('.e_CatLs .esExplDrp_entry_title', catName)
        this.topic.waitUntilParentCatIs(catName);
      },

      waitUntilParentCatIs: (catName: St) => {
        const sel = this.topic.__getCurCatNameSelector();
        this.waitUntilTextIs(sel, catName);
      },

      __getCurCatNameSelector: (): St => {
        const ancLn = ' .esTopbar_ancestors_link';
        const where = this.isVisible('.s_Tb ' + ancLn) ? '.s_Tb' : '.esPage';
        return where + ' .s_Tb_Pg_Cs_C:last-child ' + ancLn;
      },

      isPostNrDescendantOf: (postNr: PostNr, maybeParentNr: PostNr) => {
        this.switchToEmbCommentsIframeIfNeeded();
        return this.isVisible(
            `#post-${maybeParentNr} + .dw-p-as + .dw-single-and-multireplies #post-${postNr}`);
      },

      isPostNrVisible: (postNr: PostNr) => {
        this.switchToEmbCommentsIframeIfNeeded();
        return this.isVisible('#post-' + postNr);
      },

      clickShowMorePosts: (ps: { nextPostNr: PostNr }) => {
        // This would be fragile, because waitAndClickLast won't
        // scroll [05YKTDTH4]: (only scrolls to the *first* thing)
        //
        //   strangersBrowser.waitAndClickLast('.dw-x-show');
        //
        // Instead:

        const nxtNr = ps.nextPostNr;
        const nrs = `${nxtNr}, ${nxtNr + 1}, ${nxtNr + 2}`;
        const selector = `.s_X_Show-PostNr-${nxtNr}`;

        utils.tryUntilTrue(`show more posts: ${nrs} ...`, 3, (): boolean => {
          if (this.isVisible(selector)) {
            this.waitAndClick(selector, { maybeMoves: true });
          }
          return this.topic.waitForPostNrVisible(
              ps.nextPostNr, { timeoutMs: 1500, timeoutIsFine: true });
        });
      },

      waitForPostNrVisible: (postNr: PostNr, ps: { timeoutMs?: number,  // RENAME to ...VisibleText?
              timeoutIsFine?: boolean } = {}): boolean => {
        this.switchToEmbCommentsIframeIfNeeded();
        return this.waitForVisibleText('#post-' + postNr, ps);
      },

      waitForPostAssertTextMatches: (postNr: PostNr, text: string | RegExp) => {
        dieIf(!_.isString(text) && !_.isRegExp(text),
            "Test broken: `text` is not a string nor a regex [TyEJ53068MSK]");
        this.switchToEmbCommentsIframeIfNeeded();
        this.waitForVisibleText(this.topic.postBodySelector(postNr));
        this.topic.assertPostTextMatches(postNr, text);
      },

      // waitUntilPostTextMatches — see below

      waitUntilPostHtmlMatches: (postNr: PostNr, regexOrString: string | RegExp | any[]) => {
        const selector = this.topic.postBodySelector(postNr);
        this.waitUntilHtmlMatches(selector, regexOrString)
      },

      assertPostHtmlDoesNotMatch: (postNr: PostNr, regexOrString: string | RegExp | any[]) => {
        const selector = this.topic.postBodySelector(postNr);
        const html = this.$(selector).getHTML();
        const badMatch = this._findHtmlMatchMiss(html, false, regexOrString);
        if (badMatch) {
          assert(false,
              `Found text that shouldn't be there [TyE53DTEGJ4]:\n\n  ${badMatch}\n`);
        }
      },

      assertPostOrderIs: (expectedPostNrs: PostNr[], selector: string = '[id^="post-"]') => {
        dieIf(!expectedPostNrs || !expectedPostNrs.length, `No expected posts [TyEE062856]`);

        // Replace other dupl code with this fn.  [59SKEDT0652]
        this.switchToEmbCommentsIframeIfNeeded();
        this.waitForVisible(selector);

        const postElems = this.$$(selector);

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

      waitForExistsInPost: (postNr: PostNr, selector: string,
            ps: { timeoutMs?: number, howMany?: number } = {}) => {
        this.waitForExist(this.topic.postBodySelector(postNr) + ' ' + selector, ps);
      },

      // Enters an <iframe> in a post, looks for sth, then exits the iframe.
      waitForExistsInIframeInPost: (ps: { postNr: PostNr, iframeSelector: string,
            yetAnotherIframeInside?: Bo,
            thingInIframeSelector?: string, textToMatch?: string | RegExp,
            timeoutMs?: number, howMany?: number }) => {
        const complIfrSel = this.topic.postBodySelector(ps.postNr) + ' ' + ps.iframeSelector;
        this.switchToFrame(complIfrSel, { timeoutMs: ps.timeoutMs });
        if (ps.yetAnotherIframeInside)  {
          this.switchToFrame('iframe', { timeoutMs: ps.timeoutMs });
        }
        const thingInIframeSelector = ps.thingInIframeSelector || 'body';
        this.waitForExist(thingInIframeSelector, { timeoutMs: ps.timeoutMs });
        if (ps.textToMatch) {
          this.waitUntilTextMatches(thingInIframeSelector, ps.textToMatch);
        }
        if (ps.yetAnotherIframeInside)  {
          this.switchToTheParentFrame({ parentIs: IsWhere.UnknownIframe });
        }
        this.switchToTheParentFrame();
      },

      postNrContains: (postNr: PostNr, selector: string) => {
        return this.isExisting(this.topic.postBodySelector(postNr) + ' ' + selector);
      },

      assertPostNrContains: (postNr: PostNr, selector: string) => {
        if (!this.topic.postNrContains(postNr, selector)) {
          assert.fail(`Post ${postNr} doesn't contain selector:  ${selector}`);
        }
      },

      assertPostNrNotContains: (postNr: PostNr, selector: string) => {
        if (this.topic.postNrContains(postNr, selector)) {
          assert.fail(`Post ${postNr} contains, but should not, selector:  ${selector}`);
        }
      },

      postNrContainsVisible: (postNr: PostNr, selector: string) => {
        return this.isVisible(this.topic.postBodySelector(postNr) + ' ' + selector);
      },

      assertPostTextMatches: (postNr: PostNr, text: string | RegExp) => {
        this.assertTextMatches(this.topic.postBodySelector(postNr), text, 'regex')
      },

      assertPostTextIs: (postNr: PostNr, text: St, ps: { wait?: Bo } = {}) => {
        const s = this.topic.postBodySelector(postNr);
        if (ps.wait) this.waitForVisibleText(s);
        this.assertTextMatches(s, text, 'exact')
      },

      getPostText: (postNr: PostNr): string => {
        return this.waitAndGetVisibleText(this.topic.postBodySelector(postNr));
      },

      getPostHtml: (postNr: PostNr): string => {
        return this.waitAndGetVisibleHtml(this.topic.postBodySelector(postNr));
      },

      waitUntilPostTextIs: (postNr: PostNr, text: string,
              opts: { thingInPostSelector?: string } = {}) => {
        this.switchToEmbCommentsIframeIfNeeded();
        const selector =
            `${this.topic.postBodySelector(postNr)} ${opts.thingInPostSelector || ''}`;
        this.waitUntilTextIs(selector, text);
      },

      waitUntilPostTextMatches: (postNr: PostNr, regex: string | RegExp,
              opts: { thingInPostSelector?: string } = {}) => {
        this.switchToEmbCommentsIframeIfNeeded();
        const selector =
            `${this.topic.postBodySelector(postNr)} ${opts.thingInPostSelector || ''}`;
        this.waitUntilTextMatches(selector, regex);
      },

      refreshUntilPostNrAppears: (postNr: PostNr,
            ps: { isEmbedded?: true, isMetaPost?: true } = {}) => {
        if (ps.isEmbedded) this.switchToEmbeddedCommentsIrame();
        const selector = ps.isMetaPost
            ? `#post-${postNr} .s_MP_Text`
            : this.topic.postBodySelector(postNr);
        this.topic.refreshUntilAppears(selector, ps);
      },

      refreshUntilAppears: (selector: string, ps: { isEmbedded?: true } = {}) => {
        // Maybe use this.waitUntil()? But it's ok to call it from inside itself?
        let delayMs = RefreshPollMs;
        while (!this.isVisible(selector)) {
          logMessage(`Refreshing page until appears:  ${selector}  [TyE2EMREFRWAIT]`);
          this.#br.refresh();
          // Pause *after* the refresh, so there's some time for the post to get loaded & appear.
          this.#br.pause(delayMs);
          // Give the thing more and more time to appear, after page reresh, in case
          // for whatever reason it won't show up immediately.
          delayMs = expBackoff(delayMs);
          if (ps.isEmbedded) this.switchToEmbeddedCommentsIrame();
        }
      },

      refreshUntilPostTextMatches: (postNr: PostNr, regex: string | RegExp) => {
        regex = getRegExpOrDie(regex);
        while (true) {
          const text = this.waitAndGetVisibleText(this.topic.postBodySelector(postNr));
          if (text.match(regex)) {
            break;
          }
          this.#br.pause(200);
          this.#br.refresh();
        }
      },

      assertMetaPostTextMatches: (postNr: PostNr, text: string) => {
        this.assertTextMatches(`#post-${postNr} .s_MP_Text`, text)
      },

      topLevelReplySelector: '.dw-depth-1 > .dw-p',
      replySelector: '.dw-depth-1 .dw-p',
      allRepliesTextSelector: '.dw-depth-0 > .dw-single-and-multireplies > .dw-res',
      anyCommentSelector: '.dw-p',
      anyReplyButtonSelector: '.dw-a-reply',
      addProgressReplySelector: '.s_OpReB-Prg',
      previewSelector: '.dw-depth-1 .s_P-Prvw',

      waitForReplyButtonAssertCommentsVisible: () => {
        this.waitForVisible(this.topic.anyReplyButtonSelector);
        assert(this.isVisible(this.topic.anyCommentSelector));
      },

      waitForReplyButtonAssertNoComments: () => {
        this.waitForVisible(this.topic.anyReplyButtonSelector);
        assert(!this.isVisible(this.topic.anyCommentSelector));
      },

      countReplies: (ps: { skipWait?: boolean } = {}): NumReplies => {
        if (!ps.skipWait) {
          this.waitForMyDataAdded();
        }
        let numNormal = this.count(this.topic.replySelector);

        // One's own, pending mod (or maybe if is staff, then can see others').
        const ownUnapproved = this.count(this.topic.replySelector + ' .dw-p-pending-mod');
        // Others' unapproved posts.
        const othersUnapproved = this.count(this.topic.replySelector + '.dw-p-unapproved');
        // Total.
        const numUnapproved = othersUnapproved + ownUnapproved;

        const numPreviews = this.count(this.topic.previewSelector);
        const numDeleted = this.count(this.topic.replySelector + '.s_P-Dd');

        numNormal = numNormal - numPreviews - numUnapproved - numDeleted;
        return { numNormal, numPreviews, numUnapproved, numDeleted };
      },

      assertNumRepliesVisible: (num: number) => {
        this.waitForMyDataAdded();
        this.assertExactly(num, this.topic.replySelector);
      },

      assertNumOrigPostRepliesVisible: (num: number) => {
        this.waitForMyDataAdded();
        this.assertExactly(num, this.topic.topLevelReplySelector);
      },

      assertNoReplyMatches: (text: string | RegExp) => {
        this.waitForMyDataAdded();
        this.assertNoTextMatches(this.topic.allRepliesTextSelector, text);
      },

      assertSomeReplyMatches: (text: string | RegExp) => {
        this.waitForMyDataAdded();
        this.assertTextMatches(this.topic.allRepliesTextSelector, text);
      },

      assertNoAuthorMissing: () => {
        // There's this error code if a post author isn't included on the page.
        this.topic.assertNoReplyMatches("EsE4FK07_");
      },

      getTopicAuthorUsernameInclAt: (): string => {
        return this.waitAndGetVisibleText('.dw-ar-p-hd .esP_By_U');
      },

      getPostAuthorUsernameInclAt: (postNr: PostNr): St => {
        const sel = this.topic.postHeaderSelector(postNr);
        return this.waitAndGetVisibleText(sel + ' .esP_By_U');
      },

      clickFirstMentionOf: (username: string) => {
        // This:  this.waitAndClick(`a.esMention=@${username}`);
        // fails:
        //    Failed to execute 'querySelector' on 'Document':
        //      'a.esMention=@michael.lastname' is not a valid selector
        // because  scrollIntoViewInPageColumn()  sends Javascript to the browser,
        // but only Wdio, not the browser, understands these Wdio / WebDriver
        // "magic" selectors:  [EQSELEC]
        this.waitForDisplayed(`a.esMention=@${username}`);
        const elem = this.$(`a.esMention=@${username}`);
        elem.click();
      },

      clickReplyToOrigPost: (whichButton?: 'DiscussionSection') => {
        const selector = whichButton === 'DiscussionSection' ?
            '.s_OpReB-Dsc' : '.dw-ar-p + .esPA .dw-a-reply';
        this.topic.clickPostActionButton(selector);
      },

      clickReplyToEmbeddingBlogPost: () => {
        this.switchToEmbCommentsIframeIfNeeded();
        this.topic.clickPostActionButton('.dw-ar-t > .esPA .dw-a-reply');
      },

      clickReplyToPostNr: (postNr: PostNr) => {
        this.topic.clickPostActionButton(`#post-${postNr} + .esPA .dw-a-reply`);
      },

      clickAddProgressReply: () => {
        this._waitForClickable(this.topic.addProgressReplySelector);
        this.topic.clickPostActionButton(this.topic.addProgressReplySelector);
        // Dismiss any help dialog that explains what bottom comments are.
        this.#br.pause(150);
        if (this.isVisible('.e_HelpOk')) {
          this.waitAndClick('.e_HelpOk');
          this.waitUntilModalGone();
        }
      },

      wikifyPostNr: (postNr: PostNr, shallWikify: boolean) => {
        // Break out fn? (5936RKTL6)
        utils.tryManyTimes("Wikify post", 3, () => {
          if (!this.isVisible('.s_PA_WkB')) {
            this.topic.clickMoreForPostNr(postNr);
          }
          this.waitAndClick('.s_PA_WkB', { timeoutMs: 500 });
          this.waitAndClick(shallWikify ? '.e_MkWk' : '.e_UnWk', { timeoutMs: 500 });
          this.waitUntilTextMatches(`#post-${postNr} + .esPA .dw-a-edit`, "Wiki", {
                  timeoutMs: 500, invert: !shallWikify });
        });
      },

      canEditSomething: (): boolean => {
        return this.isVisible('.dw-a-edit');
      },

      canReplyToSomething: (): boolean => {
        return this.isVisible('.dw-a-reply');
      },

      canEditOrigPost: (): boolean => {
        return this.topic.canEditPostNr(c.BodyNr);
      },

      canEditPostNr: (postNr: number): boolean => {
        const selector = `#post-${postNr} + .esPA .dw-a-edit`;
        return this.isEnabled(selector);
      },

      clickEditOrigPost: () => {
        this.waitAndClick('.dw-ar-t > .dw-p-as .dw-a-edit');
      },

      clickEditoPostNr: (postNr: PostNr) => {
        this.topic.clickPostActionButton(`#post-${postNr} + .esPA .dw-a-edit`);
      },

      waitForViewEditsButton: (postNr: PostNr) => {
        this.waitForVisible(`#post-${postNr} .esP_viewHist`);
      },

      isViewEditsButtonVisible: (postNr: PostNr): boolean => {
        return this.isVisible(`#post-${postNr} .esP_viewHist`);
      },

      openEditHistory: (postNr: PostNr) => {
        this.waitAndClick(`#post-${postNr} .esP_viewHist`);
        this.editHistoryDialog.waitUntilVisible();
      },

      openAboutUserDialogForPostNr: (postNr: PostNr) => {
        this.waitAndClick(`#post-${postNr} .esP_By`);
        this.aboutUserDialog.waitForLoaded();
      },

      clickMoreForPostNr: (postNr: PostNr) => {  // RENAME to openMoreDialogForPostNr()?
        this.topic.clickPostActionButton(`#post-${postNr} + .esPA .dw-a-more`);
      },

      isPostMoreDialogVisible: (): boolean => {
        // This works for now.
        return this.isVisible(this.topic.__flagPostSelector);
      },

      closePostMoreDialog: () => {
        assert.ok(this.topic.isPostMoreDialogVisible());
        // Break out close dialog fn?  [E2ECLOSEDLGFN]
        this.waitAndClick('.esDropModal_CloseB');
        this.waitUntilGone('.esDropModal_CloseB');
        this.waitUntilModalGone();
      },

      openShareDialogForPostNr: (postNr: PostNr) => {
        this.topic.clickPostActionButton(`#post-${postNr} + .esPA .dw-a-link`);
        this.waitForVisible('.s_ShareD');
      },

      openMoveDialogForPostNr: (postNr: PostNr) => {
        // Break out fn? (5936RKTL6)
        // This always works, when the tests are visible and I look at them.
        // But can block forever, in an invisible this.#br. Just repeat until works.
        utils.tryManyTimes("Open move post dialog", 3, () => {
          if (!this.isVisible('.s_PA_MvB')) {
            this.topic.clickMoreForPostNr(postNr);
          }
          this.waitAndClick('.s_PA_MvB', { timeoutMs: 500 });
          this.waitForVisible('.s_MvPD', { timeoutMs: 500 });
        });
      },

      clickMoreVotesForPostNr: (postNr: PostNr) => {
        this.topic.clickPostActionButton(`#post-${postNr} + .esPA .dw-a-votes`);
      },

      makeLikeVoteSelector: (postNr: PostNr, ps: { byMe?: boolean } = {}): string => {
        // Embedded comments pages lack the orig post — instead, there's the
        // blog post, on the embedding page.
        const startSelector = this.#isOnEmbeddedCommentsPage && postNr === c.BodyNr
            ? '.dw-ar-t > ' :`#post-${postNr} + `;
        let result = startSelector + '.esPA .dw-a-like';
        if (ps.byMe) result += '.dw-my-vote';
        else if (ps.byMe === false)  result += ':not(.dw-my-vote)';
        return result;
      },

      clickLikeVote: (postNr: PostNr, opts: { logInAs? } = {}) => {
        const likeVoteSelector = this.topic.makeLikeVoteSelector(postNr);

        utils.tryUntilTrue("click Like", 3, () => {
          this.waitAndClick(likeVoteSelector);
          if (!opts.logInAs || !this.isInIframe())
            return true;
          // A login popup should open.
          return this.waitForMinBrowserTabs(2, {
                  timeoutMs: 1000, timeoutIsFine: true });
        });

        if (opts.logInAs) {
          this.switchToLoginPopupIfEmbedded();
          this.loginDialog.loginWithPassword(opts.logInAs);
          this.switchToEmbCommentsIframeIfNeeded();
        }
      },

      clickLikeVoteForBlogPost: () => {
        this.switchToEmbCommentsIframeIfNeeded();
        this.waitAndClick('.dw-ar-t > .esPA > .dw-a-like');
      },

      toggleLikeVote: (postNr: PostNr, opts: { logInAs? } = {}) => {
        const likeVoteSelector = this.topic.makeLikeVoteSelector(postNr);
        this.switchToEmbCommentsIframeIfNeeded();
        const isLikedBefore = this.isVisible(likeVoteSelector + '.dw-my-vote');
        // This click for some reason won't always work, here: [E2ECLICK03962]
        utils.tryUntilTrue(`toggle Like vote`, 3, () => {
          this.switchToEmbCommentsIframeIfNeeded();
          this.topic.clickLikeVote(postNr, opts);
          // Wait for the server to reply, and the page to get updated.
          const gotToggled = this.waitUntil(() => {
            const likedNow = this.isVisible(likeVoteSelector + '.dw-my-vote');
            //this.l(`isLikedBefore: ${isLikedBefore}  likedNow: ${likedNow}`)
            return isLikedBefore !== likedNow;
          }, {
            message: `Waiting for post ${postNr} to get like-voted = ${!isLikedBefore}`,
            timeoutMs: 2500,
            timeoutIsFine: true,
          });
          return gotToggled;
        });
      },

      isPostLikedByMe: (postNr: PostNr) => {
        return this.topic.isPostLiked(postNr, { byMe: true });
      },

      isPostLiked: (postNr: PostNr, ps: { byMe?: boolean } = {}) => {
        const likeVoteSelector = this.topic.makeLikeVoteSelector(postNr, ps);
        return this.isVisible(likeVoteSelector);
      },

      waitForLikeVote: (postNr: PostNr, ps: { byMe?: boolean } = {}) => {
        const likeVoteSelector = this.topic.makeLikeVoteSelector(postNr, ps);
        this.waitForVisible(likeVoteSelector);
      },

      toggleDisagreeVote: (postNr: PostNr) => {
        this.topic._toggleMoreVote(postNr, '.dw-a-wrong');
      },

      toggleBuryVote: (postNr: PostNr) => {
        this.topic._toggleMoreVote(postNr, '.dw-a-bury');
      },

      toggleUnwantedVote: (postNr: PostNr) => {
        this.topic._toggleMoreVote(postNr, '.dw-a-unwanted');
      },

      _toggleMoreVote: (postNr: PostNr, selector: string) => {
        this.topic.clickMoreVotesForPostNr(postNr);
        // The vote button appears in a modal dropdown.
        this.waitAndClick('.esDropModal_content ' + selector);
        this.waitUntilModalGone();
        this.waitUntilLoadingOverlayGone();
      },

      canVoteLike: (postNr: PostNr): boolean => {
        const likeVoteSelector = this.topic.makeLikeVoteSelector(postNr);
        return this.isVisible(likeVoteSelector);
      },

      canVoteUnwanted: (postNr: PostNr): boolean => {
        this.topic.clickMoreVotesForPostNr(postNr);
        this.waitForVisible('.esDropModal_content .dw-a-like');
        const canVote = this.isVisible('.esDropModal_content .dw-a-unwanted');
        assert(false); // how close modal? to do... later when needed
        return canVote;
      },

      __flagPostSelector: '.icon-flag',  // for now, later: e_...

      clickFlagPost: (postNr: PostNr) => {
        this.topic.clickMoreForPostNr(postNr);
        this.waitAndClick(this.topic.__flagPostSelector);
        // This opens  this.flagDialog.
      },

      __deletePostSelector: '.dw-a-delete',

      deletePost: (postNr: PostNr) => {
        this.topic.clickMoreForPostNr(postNr);
        this.waitAndClick(this.topic.__deletePostSelector);
        this.waitAndClick('.dw-delete-post-dialog .e_YesDel');
        this.waitUntilGone('.dw-delete-post-dialog');
        this.waitUntilLoadingOverlayGone();
        this.topic.waitForPostVisibleAsDeleted(postNr);
      },

      canDeletePost: (postNr: PostNr): boolean => {
        this.topic.clickMoreForPostNr(postNr);
        this.waitForVisible('.esDropModal_content .dw-a-flag');
        const canDelete = this.isVisible(this.topic.__deletePostSelector);
        this.topic.closePostMoreDialog();
        return canDelete;
      },

      canSelectAnswer: (): boolean => {
        return this.isVisible('.dw-a-solve');
      },

      selectPostNrAsAnswer: (postNr: PostNr) => {
        assert(!this.isVisible(this.topic._makeUnsolveSelector(postNr)));
        this.topic.clickPostActionButton(this.topic._makeSolveSelector(postNr));
        this.waitForVisible(this.topic._makeUnsolveSelector(postNr));
      },

      unselectPostNrAsAnswer: (postNr: PostNr) => {
        assert(!this.isVisible(this.topic._makeSolveSelector(postNr)));
        this.topic.clickPostActionButton(this.topic._makeUnsolveSelector(postNr));
        this.waitForVisible(this.topic._makeSolveSelector(postNr));
      },

      _makeSolveSelector(postNr: PostNr) {
        return `#post-${postNr} + .esPA .dw-a-solve`;
      },

      _makeUnsolveSelector(postNr: PostNr) {
        return `#post-${postNr} + .esPA .dw-a-unsolve`;
      },

      openChangePageDialog: () => {
        this.waitAndClick('.dw-a-change');
        this.topic.waitUntilChangePageDialogOpen();
      },

      __changePageDialogSelector: '.s_ChPgD .esDropModal_content',

      // Could break out to  changePageDialog: { ... } obj.
      waitUntilChangePageDialogOpen: () => {
        this.waitForVisible(this.topic.__changePageDialogSelector);
        this.waitForDisplayed('.modal-backdrop');
      },

      isChangePageDialogOpen: () => {
        return this.isVisible(this.topic.__changePageDialogSelector);
      },

      waitUntilChangePageDialogGone: () => {
        this.waitUntilGone(this.topic.__changePageDialogSelector);
        this.waitUntilGone('.modal-backdrop');
      },

      closeChangePageDialog: () => {
        dieIf(!this.topic.isChangePageDialogOpen(), 'TyE5AKTDFF2');
        // Don't: this.waitAndClick('.modal-backdrop');
        // That might block forever, waiting for the dialog that's in front of the backdrop
        // to stop occluding (parts of) the backdrop.
        // Instead:
        this.waitUntil(() => {
          // This no longer works, why not? Chrome 77. The click has no effect —
          // maybe it doesn't click at 10,10 any longer? Or what?
          //if (this.isVisible('.modal-backdrop')) {
          //  // Click the upper left corner — if any dialog is open, it'd be somewhere in
          //  // the middle and the upper left corner, shouldn't hit it.
          //  this.#br.leftClick('.modal-backdrop', 10, 10);
          //}
          // Instead: (and is this even slightly better?)
          // (Break out close dialog fn?  [E2ECLOSEDLGFN])
          if (this.isVisible('.esDropModal_CloseB')) {
            this.waitAndClick('.esDropModal_CloseB');
          }
          return !this.topic.isChangePageDialogOpen();
        }, {
          message: `Waiting for Change Page dialog to close`,
        });
        this.waitUntilModalGone();
      },

      closeTopic: () => {
        this.topic.openChangePageDialog();
        this.waitAndClick(this.topic._closeButtonSelector);
        this.topic.waitUntilChangePageDialogGone();
        this.waitForVisible('.dw-p-ttl .icon-block');
      },

      reopenTopic: () => {
        this.topic.openChangePageDialog();
        this.waitAndClick(this.topic._reopenButtonSelector);
        this.topic.waitUntilChangePageDialogGone();
        this.waitUntilGone('.dw-p-ttl .icon-block');
      },

      canCloseOrReopen: (): Bo => {
        return this.topic.__canSomething(() => {
          return this.isVisible(this.topic._closeButtonSelector) ||
                  this.isVisible(this.topic._reopenButtonSelector);
        });
      },

      __canSomething: (fn: () => Bo): Bo => {
        this.waitForDisplayed('.dw-a-more'); // so all buttons have appeared
        if (!this.isVisible('.dw-a-change'))
          return false;
        this.topic.openChangePageDialog();
        const result = fn();
        this.topic.closeChangePageDialog();
        return result;
      },

      setDoingStatus: (newStatus: 'New' | 'Planned' | 'Started' | 'Done') => {
        this.topic.openChangePageDialog();
        this.waitAndClick('.e_PgSt-' + newStatus);
        this.topic.waitUntilChangePageDialogGone();
      },

      _closeButtonSelector: '.s_ChPgD .e_ClosePgB',
      _reopenButtonSelector: '.s_ChPgD .e_ReopenPgB',

      deletePage: () => {
        this.topic.openChangePageDialog();
        this.waitAndClick(this.topic.__deletePageSelector);
        this.topic.waitUntilChangePageDialogGone();
        this.topic.waitUntilPageDeleted();
      },

      undeletePage: () => {
        this.topic.openChangePageDialog();
        this.waitAndClick(this.topic.__undeletePageSelector);
        this.topic.waitUntilChangePageDialogGone();
        this.topic.waitUntilPageRestored();
      },

      canDeleteOrUndeletePage: (): Bo => {
        return this.topic.__canSomething(() => {
          return this.isVisible(this.topic.__deletePageSelector) ||
                  this.isVisible(this.topic.__undeletePageSelector);
        });
      },

      __deletePageSelector: '.s_ChPgD .e_DelPgB',
      __undeletePageSelector: '.s_ChPgD .e_UndelPgB',

      refreshUntilBodyHidden: (postNr: PostNr) => {  // RENAME to refreshUntilPostBodyHidden
        this.waitUntil(() => {
          let isBodyHidden = this.topic.isPostBodyHidden(postNr);
          if (isBodyHidden) return true;
          this.#br.pause(RefreshPollMs);
          this.#br.refresh();
        }, {
          message: `Waiting for post nr ${postNr}'s body to hide`,
        });
      },

      refreshUntilPostPresentBodyNotHidden: (postNr: PostNr) => {
        this.waitUntil(() => {
          let isVisible = this.isVisible(`#post-${postNr}`);
          let isBodyHidden = this.topic.isPostBodyHidden(postNr);
          if (isVisible && !isBodyHidden) return true;
          this.#br.pause(RefreshPollMs);
          this.#br.refresh();
        }, {
          message: `Waiting for post nr ${postNr}: isVisible && !isBodyHidden`,
        });
      },

      isPostBodyHidden: (postNr: PostNr) => {
        return this.isVisible(`#post-${postNr}.s_P-Hdn`);
      },

      waitForPostVisibleAsDeleted: (postNr: PostNr) => {
        this.waitForDisplayed(`#post-${postNr}.s_P-Dd`);
      },

      assertPostHidden: (postNr: PostNr) => {
        assert(this.topic.isPostBodyHidden(postNr));
      },

      assertPostNotHidden: (postNr: PostNr) => {
        assert(!this.isVisible(`#post-${postNr}.s_P-Hdn`));
        assert(this.isVisible(`#post-${postNr}`));
        // Check -Hdn again, to prevent some races (but not all), namely that the post gets
        // loaded, and is invisible, but the first -Hdn check didn't find it because at that time
        // it hadn't yet been loaded.
        assert(!this.isVisible(`#post-${postNr}.s_P-Hdn`));
      },

      rejectPostNr: (postNr: PostNr) => {
        const selector = `#post-${postNr} + .esPA .s_PA_ModB-Rej`;
        this.waitAndClick(selector);
        this.stupidDialog.yesIAmSure();
        if (postNr === c.BodyNr) {
          // Then currently the page gets deleted instead
          // — the posts need an [ApprovedStatus] post field.
          this.topic.waitUntilPageDeleted();
          return;
        }
        this.waitUntilGone(selector);
        this.topic.waitForPostVisibleAsDeleted(postNr);
        assert(!this.topic._hasUnapprovedClass(postNr));
        assert(!this.topic._hasPendingModClass(postNr));
      },

      approvePostNr: (postNr: PostNr) => {
        const selector = `#post-${postNr} + .esPA .s_PA_ModB-Apr`;
        this.waitAndClick(selector);
        this.stupidDialog.yesIAmSure();
        this.waitUntilGone(selector);
        assert(!this.topic._hasUnapprovedClass(postNr));
        assert(!this.topic._hasPendingModClass(postNr));
      },

      assertPostNeedsApprovalBodyVisible: (postNr: PostNr) => {
        // Test visible = true first, else, race. [is_visible_1st]
        assert(this.topic._hasPendingModClass(postNr));
        assert(!this.topic._hasUnapprovedClass(postNr));
        assert(this.topic._isBodyVisible(postNr));
      },

      assertPostNeedsApprovalBodyHidden: (postNr: PostNr) => {
        // Test visible = true first, else, race. [is_visible_1st]
        assert(this.topic._hasUnapprovedClass(postNr));
        assert(!this.topic._hasPendingModClass(postNr));
        assert(!this.topic._isBodyVisible(postNr));
      },

      refreshUntilPostNotPendingApproval: (postNr: PostNr) => {
        this.waitUntil(() => {
          return this.topic.isPostNotPendingApproval(postNr);
        }, {
          refreshBetween: true,
          message: `Waiting for post nr ${postNr} to get approved`,
        });
      },

      assertPostNotPendingApproval: (postNr: PostNr, ps: { wait?: false } = {}) => {
        if (ps.wait !== false) {
          this.topic.waitForPostNrVisible(postNr);
        }
        assert(this.topic.isPostNotPendingApproval(postNr));
      },

      isPostNotPendingApproval: (postNr: PostNr) => {
        // Test visible = true first, else, race. [is_visible_1st]
        return this.topic._isBodyVisible(postNr) &&
            !this.topic._hasUnapprovedClass(postNr) &&
            !this.topic._hasPendingModClass(postNr);
      },

      // Not needed? Just use  waitAndClick()  instead?
      clickPostActionButton: (buttonSelector: string,
            opts: { clickFirst?: boolean } = {}) => {   // RENAME to this.scrollAndClick?
        this.switchToEmbCommentsIframeIfNeeded();
        this.waitAndClick(buttonSelector, opts);
        return;
        // DO_AFTER 2020-06-01: CLEAN_UP REMOVE the rest of this function.
        let hasScrolled = false;
        const isInIframe = this.isInIframe();

        // If the button is close to the bottom of the window, the fixed bottom bar might
        // be above it; then, if it's below the [Scroll][Back] buttons, it won't be clickable.
        // Or the button might be below the lower window edge.
        // If so, scroll down to the reply button.
        //
        // Why try twice? The scroll buttons aren't shown until a few 100 ms after page load.
        // So, `this.isVisible(this.scrollButtons.fixedBarSelector)` might evaluate to false,
        // and then we won't scroll down — but then just before `this.waitAndClick`
        // they appear, so the click fails. That's why we try once more.
        //
        this.waitForVisible(buttonSelector);
        for (let attemptNr = 1; attemptNr <= 2; ++attemptNr) {
          for (let i = 0; i < 20; ++i) {  // because FF sometimes won't realize it's done scrolling
            //OLD: const buttonLocation = this.#br.getLocationInView(buttonSelector);
            //  for unknown reasons, scrolls back to the top, at least in FF. Weird. Breaks everything.

            // If is array, could use [0] — but apparently the button locations are returned
            // in random order, with incorrect positions that never change regardless of how
            // one scrolls, and is sometimes 0 = obviously wrong. So, don't try to
            // pick [0] to click the first = topmost elem.
            // Chrome? Chromedriver? Webdriver? Selenium? buggy (as of June 29 2018).
            //OLD: dieIf(_.isArray(buttonLocation) && !opts.clickFirst, 'TyEISARRAYBKF');
            //if (opts.clickFirst)
            //  break; // cannot scroll, see above. Currently the tests don't need to scroll (good luck)

            die(`Fn gone: this.getRectOfFirst()`)
            const buttonRect: any = undefined; // = this.getRectOfFirst(buttonSelector);

            // E.g. the admin area, /-/admin.
            const isOnAutoPage = this.#br.getUrl().indexOf('/-/') >= 0;

            /*
            // ? Why did I add this can-scroll test ? Maybe, if can *not* scroll, this loop never got
            // happy with the current scroll position (0, 0?) and continued trying-to-scroll forever?
            let hasScrollBtns = this.isVisible(this.scrollButtons.fixedBarSelector);
            // If in admin area or user's profile, there're no scroll buttons, but can maybe
            // scroll anyway.
            const canScroll = hasScrollBtns || isOnAutoPage;
            if (!canScroll) {
              logMessage(`Cannot scroll: ${hasScrollBtns} ${isOnAutoPage},` +
                  ` won't try to scroll to: ${buttonSelector}`);
              break;
            } */

            let bottomY = this.getWindowHeight();
            if (true) { // hasScrollBtns) {
              // Need to place the button we want to click, above the scroll bar — otherwise,
              // the scroll buttons can be on top of the button, and steal the click.
              bottomY -= 35;  // scroll button height [6WRD25]
              // Or could:
              //   bottomY = this.getRectOfFirst(this.scrollButtons.fixedBarSelector).y;
            }

            const topY = isInIframe
                ? 0 : (    // no topbar
                  isOnAutoPage
                    ? 100  // fixed topbar, might float drop —> 90 px tall
                    : 60); // fixed topbar, about 40px tall

            // The this.#br clicks in the middle of the button?
            const buttonMiddleY = buttonRect.y + buttonRect.height / 2;
            const clickMargin = 5;
            if (buttonMiddleY > topY + clickMargin && buttonMiddleY < bottomY - clickMargin)
              break;

            // Not needed? Nowadays, _waitAndClickImpl() scrolls, if needed.
            logMessage(`Scrolling into view: ${buttonSelector}, topY = ${topY}, ` +
                `buttonRect = ${JSON.stringify(buttonRect)}, buttonMiddleY = ${buttonMiddleY}, ` +
                `bottomY: ${bottomY}`);
            const scrollMargin = clickMargin + 10;
            this.#br.execute(function(selector, topY, scrollMargin) {
              window['debiki2'].utils.scrollIntoViewInPageColumn(selector, {
                marginTop: topY + scrollMargin,
                marginBottom: 70 + scrollMargin,   // 70 > scroll button heights
                duration: 150,
              });
            }, buttonSelector, topY, scrollMargin);
            hasScrolled = true;
            this.#br.pause(150 + 100);
          }
          try {
            // If in iframe, we might not have scrolled anything above, and will
            // scroll later instead, so, then, the button will maybe be "moving" / scrolling.
            const maybeMoves = hasScrolled || isInIframe;
            const opts2 = { ...opts, maybeMoves };
            logMessage(`clickPostActionButton:  CLICK  ${buttonSelector}  ` +
                `${JSON.stringify(opts2)}  [TyME2ECLICK]`);
            this._waitAndClickImpl(buttonSelector, opts2);
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

      _isOrigPostBodyVisible: () => {
        return !!this.$('#post-1 > .dw-p-bd').getText();
      },

      _isTitlePendingApprovalVisible: () => {
        return this.isVisible('.dw-p-ttl .esPendingApproval');
      },

      _isOrigPostPendingApprovalVisible: () => {
        return this.isVisible('.dw-ar-t > .esPendingApproval');
      },

      _isBodyVisible: (postNr: PostNr) => {
        return this.isVisible(`#post-${postNr} .dw-p-bd`);
      },

      _hasPendingModClass: (postNr: PostNr) => {
        return this.isVisible(`#post-${postNr} .dw-p-pending-mod`);
      },

      _hasUnapprovedClass: (postNr: PostNr) => {
        return this.isVisible(`#post-${postNr}.dw-p-unapproved`);
      },


      backlinks: {
        __mkSelector: (pageId: PageId) => `.s_InLns_Ln[href="/-${pageId}"]`,

        countBacklinks: (): number => this.count('.s_InLns_Ln'),

        refreshUntilNum: (num: number) => {
          let numNow: number;
          this.waitUntil(() => {
            this.waitForMyDataAdded();
            numNow = this.topic.backlinks.countBacklinks();
            if (numNow === num) return true;
            this.refresh2();
          }, {
            message: () => `Waiting for ${num} backlinks, num now: ${numNow}`,
          });
        },

        isLinkedFromPageId: (pageId: PageId): boolean => {
          return this.isExisting(this.topic.backlinks.__mkSelector(pageId));
        },

        getLinkTitle: (pageId: PageId): string => {
          return this.waitAndGetText(this.topic.backlinks.__mkSelector(pageId));
        },

        clickBacklinkFrom: (pageId: PageId): void => {
          this.waitAndClick(this.topic.backlinks.__mkSelector(pageId));
        },
      },
    };


    chat = {
      joinChat: () => {
        this.waitAndClick('#theJoinChatB');
      },

      waitAndAssertPurposeMatches: (regex: RegExp | string) => {
        this.waitAndAssertVisibleTextMatches('.esChatChnl_about', regex);
      },

      waitAndAssertPurposeIs: (text: St) => {
        this.waitAndAssertVisibleTextIs('.esChatChnl_about .dw-p-bd', text);
      },

      addChatMessage: (text: string) => {
        this.chat.editChatMessage(text);
        this.chat.submitChatMessage();
        // could verify visible
      },

      __previewSelector: '.s_C_M-Prvw',

      editChatMessage: (text: string) => {
        this.waitAndSetValue('.esC_Edtr_textarea', text);
        // Wait for a message preview to appear — because it can push the submit button down,
        // so when we click it, when done editing, we'd miss it, if we click at
        // exacty the same time. (Happens like 1 in 5.)
        if (text) this.waitForVisible(this.chat.__previewSelector);
        else this.waitForGone(this.chat.__previewSelector);
      },

      getChatInputText: (): string => {
        return this.waitAndGetText('.esC_Edtr_textarea');
      },

      waitForDraftSaved: () => {
        this.waitForVisible('.e_DfSts-' + c.TestDraftStatus.Saved);
      },

      waitForDraftDeleted: () => {
        this.waitForVisible('.e_DfSts-' + c.TestDraftStatus.Deleted);
      },

      waitForDraftChatMessageToLoad: (text: string) => {
        this.waitUntilValueIs('.esC_Edtr textarea', text);
      },

      submitChatMessage: () => {
        this.waitAndClick('.esC_Edtr_SaveB');
        this.waitUntilLoadingOverlayGone();
        //this.waitForGone('.s_C_M-Prvw'); [DRAFTS_BUG] — add this, see if works?
      },

      waitForNumMessages: (howMany: Nr, exact?: 'Exactly') => {
        if (exact === 'Exactly') this.waitForExactly(howMany, '.esC_M');
        else this.waitForAtLeast(howMany, '.esC_M');
      },

      countMessages: (ps: { inclAnyPreview?: boolean } = {}): number =>
        this.count(
            `.esC_M${ps.inclAnyPreview === false ? '' : ':not(.s_C_M-Prvw)'}`),

      assertMessageNrMatches: (messageNr, regex: RegExp | string) => {
        const postNr = messageNr + 1;
        this.topic.waitForPostAssertTextMatches(postNr, regex);
      },

      openAdvancedEditor: () => {
        this.waitAndClick('.esC_Edtr_AdvB');
      },

      deleteChatMessageNr: (nr: PostNr) => {
        const postSelector = `#post-${nr}`;
        this.waitAndClick(`${postSelector} .s_C_M_B-Dl`);
        this.waitAndClick('.dw-delete-post-dialog .e_YesDel');
        this.waitUntilLoadingOverlayGone();
        this.waitForVisible(`${postSelector}.s_C_M-Dd`);
      },
    };


    customForm = {
      submit: () => {
        this.waitAndClick('form input[type="submit"]');
        this.waitAndAssertVisibleTextMatches('.esFormThanks', "Thank you");
      },

      assertNumSubmissionVisible: (num: number) => {
        this.waitForMyDataAdded();
        this.assertExactly(num, '.dw-p-flat');
      },
    };


    scrollButtons = {
      fixedBarSelector: '.esScrollBtns_fixedBar',
    };


    searchResultsPage = {
      waitForSearchInputField: () => {
        this.waitForVisible('.s_SP_QueryTI');
      },

      assertPhraseNotFound: (phrase: string) => {
        this.searchResultsPage.waitForResults(phrase);
        assert(this.isVisible('#e_SP_NothingFound'));
      },

      waitForAssertNumPagesFound: (phrase: string, numPages: number) => {
        this.searchResultsPage.waitForResults(phrase);
        // oops, search-search-loop needed ...
        // for now:
        this.waitForAtLeast(numPages, '.esSERP_Hit_PageTitle');
        this.assertExactly(numPages, '.esSERP_Hit_PageTitle');
      },

      searchForWaitForResults: (phrase: string) => {
        this.waitAndSetValue('.s_SP_QueryTI', phrase);
        this.searchResultsPage.clickSearchButton();
        // Later, with Nginx 1.11.0+, wait until a $request_id in the page has changed [5FK02FP]
        this.searchResultsPage.waitForResults(phrase);
      },

      searchForUntilNumPagesFound: (phrase: string, numResultsToFind: number) => {
        let numFound;
        this.waitUntil(() => {
          this.searchResultsPage.searchForWaitForResults(phrase);
          numFound = this.searchResultsPage.countNumPagesFound_1();
          if (numFound >= numResultsToFind) {
            tyAssert.eq(numFound, numResultsToFind);
            return true;
          }
          this.#br.pause(111);
        }, {
          message: `Waiting for ${numResultsToFind} pages found for search ` +
              `phrase:  "${phrase}"  found this far: ${numFound}`,
        });
      },

      clickSearchButton: () => {
        this.waitAndClick('.s_SP_SearchB');
      },

      waitForResults: (phrase: string) => {
        // Later, check Nginx $request_id to find out if the page has been refreshed
        // unique request identifier generated from 16 random bytes, in hexadecimal (1.11.0).
        this.waitUntilTextMatches('#e2eSERP_SearchedFor', phrase);
      },

      countNumPagesFound_1: (): number =>
        this.$$('.esSERP_Hit_PageTitle').length,

      assertResultPageTitlePresent: (title: string) => {
        this.waitAndGetElemWithText('.esSERP_Hit_PageTitle', title, { timeoutMs: 1 });
      },

      goToSearchResult: (linkText?: string) => {
        this.repeatUntilAtNewUrl(() => {
          if (!linkText) {
            this.waitAndClick('.esSERP_Hit_PageTitle a');
          }
          else {
            this.waitForThenClickText('.esSERP_Hit_PageTitle a', linkText);
          }
        });
      },
    };


    groupListPage = {
      goHere: (origin?: string) => {
        this.go((origin || '') + '/-/groups/');
        this.groupListPage.waitUntilLoaded();
      },

      waitUntilLoaded: () => {
        this.waitForVisible('.s_GP');
      },

      countCustomGroups: (): number => {
        return this.count('.s_Gs-Custom .s_Gs_G');
      },

      openTrustedMembersGroup: () => {
        this.waitForThenClickText('.s_Gs_G_Lk .esP_By', 'trusted_members');
        this.waitAndAssertVisibleTextMatches('.esUP_Un', "trusted_members");
      },

      createGroup: (ps: { username: string, fullName: string }) => {
        this.waitAndClick('.s_GP_CrGB');
        this.waitAndSetValue('#te_CrGD_Un', ps.username);
        this.waitAndSetValue('#te_CrGD_FN', ps.fullName);
        this.waitAndClick('.s_CrGD .btn-primary');
        this.waitForVisible('.e_AddMbrsB');
      },

      waitUntilGroupPresent: (ps: { username: string, fullName: string }) => {
        this.waitAndGetElemWithText('.s_Gs_G_Lk .esP_By_U', ps.username);
        this.waitAndGetElemWithText('.s_Gs_G_Lk .esP_By_F', ps.fullName);
      },

      openGroupWithUsername: (username: string) => {
        this.waitForThenClickText('.s_Gs_G_Lk .esP_By_U', username);
        this.userProfilePage.groupMembers.waitUntilLoaded();
      }
    };


    preferences = '';
    userPreferences = '';

    /*
    groupProfilePage
    groupsProfilePage
    usersProfilePage */
    userProfilePage = {
      avatarAboutButtonsSelector: '.s_UP_AvtrAboutBtns',

      waitUntilUsernameVisible: () => {
        this.waitForVisible('.esUP_Un');
      },

      waitUntilUsernameIs: (username) => {
        this.waitAndGetElemWithText('.esUP_Un', username);
      },

      waitAndGetUsername: (): string => {
        return this.waitAndGetVisibleText('.esUP_Un');
      },

      waitAndGetFullName: (): string => {
        return this.waitAndGetVisibleText('.esUP_FN');
      },

      waitUntilDeletedOrDeactivated: () => {
        this.waitForDisplayed('.e_ActDd');
      },

      navBackToGroups: () => {
        this.userProfilePage._navigateBackToUsersOrGroupsList(true);
      },

      _navigateBackToUsersOrGroupsList: (isGroup: boolean) => {
        this.repeatUntilAtNewUrl(() => {
          this.waitAndClick('.s_Tb_Ln-Grps');
        });
        if (this.urlPath().startsWith(c.GroupsUrlPrefix)) {
          assert(isGroup);
          this.groupListPage.waitUntilLoaded();
        }
        else {
          assert(!isGroup);
          // /-/users/ all users list not yet impl
        }
      },

      openActivityFor: (who: string | UserId, origin?: string) => {
        this.go((origin || '') + `/-/users/${who}/activity/posts`);
        this.waitUntilLoadingOverlayGone();
      },

      openNotfsFor: (who: string | UserId, origin?: string) => {
        this.go((origin || '') + `/-/users/${who}/notifications`);
        this.waitUntilLoadingOverlayGone();
      },

      openNotfPrefsFor: (who: string | UserId, origin?: string) => {  // oops, dupl (443300222), remove this
        this.go((origin || '') + `/-/users/${who}/preferences/notifications`);
        this.waitUntilLoadingOverlayGone();
      },

      openDraftsEtcFor: (who: string | UserId, origin?: string) => {
        this.go((origin || '') + `/-/users/${who}/drafts-etc`);
        this.waitUntilLoadingOverlayGone();
      },

      openPreferencesFor: (who: string | UserId, origin?: string) => {
        this.go((origin || '') + `/-/users/${who}/preferences`);
        this.waitUntilLoadingOverlayGone();
      },

      openPermissionsFor: (who: string | UserId, origin?: string) => {
        this.go((origin || '') + `/-/users/${who}/permissions`);
        this.waitUntilLoadingOverlayGone();
      },

      goToActivity: () => {
        this.waitAndClick('.e_UP_ActivityB');
        this.waitForVisible('.s_UP_Act_List');
        this.waitUntilLoadingOverlayGone();
      },

      tabToNotfs: () => {
        this.waitAndClick('.e_UP_NotfsB');
        this.userProfilePage.notfs.waitUntilSeesNotfs();
        this.waitUntilLoadingOverlayGone();
      },

      goToPreferences: () => {  // RENAME switchTo and goTo, for tabs, to  tabToNnn ?
        this.userProfilePage.clickGoToPreferences();
      },

      // rename
      clickGoToPreferences: () => {
        this.waitAndClick('#e2eUP_PrefsB');
        this.waitForVisible('.e_UP_Prefs_FN');
        this.waitUntilLoadingOverlayGone();
      },

      switchToInvites: () => {
        this.waitAndClick('.e_InvTabB');
        this.invitedUsersList.waitUntilLoaded();
      },

      waitForTabsVisible: () => {
        // The activity tab is always visible, if the notfs tab can possibly be visible.
        this.waitForVisible('.e_UP_ActivityB');
      },

      isInvitesTabVisible: () => {
        this.userProfilePage.waitForTabsVisible();
        return this.isVisible('.e_InvTabB');
      },

      isNotfsTabVisible: () => {
        this.userProfilePage.waitForTabsVisible();
        return this.isVisible('.e_UP_NotfsB');
      },

      isPrefsTabVisible: () => {
        this.userProfilePage.waitForTabsVisible();
        return this.isVisible('#e2eUP_PrefsB');
      },

      assertIsMyProfile: () => {
        this.waitForVisible('.esUP_Un');
        assert(this.isVisible('.esProfile_isYou'));
      },

      assertUsernameIs: (username: string) => {
        this.assertTextMatches('.esUP_Un', username);
      },

      assertFullNameIs: (name: string) => {
        this.assertTextMatches('.esUP_FN', name);
      },

      assertFullNameIsNot: (name: string) => {
        this.assertNoTextMatches('.esUP_FN', name);
      },

      clickSendMessage: () => {
        this.waitAndClick('.s_UP_SendMsgB');
      },

      _goHere: (username: string, ps: { isGroup?: true, origin?: string }, suffix: string) => {
        this.go(`${ps.origin || ''}/-/${ps.isGroup ? 'groups' : 'users'}/${username}${suffix}`);
      },

      groupMembers: {
        goHere: (username: string, ps: { isGroup?: true, origin?: string } = {}) => {
          this.userProfilePage._goHere(username, ps, '/members');
          this.userProfilePage.groupMembers.waitUntilLoaded();
        },

        waitUntilLoaded: () => {
          this.waitForExist('.s_G_Mbrs, .s_G_Mbrs-Dnd');
        },

        waitUntilMemberPresent: (username: string) => {
          this.waitUntilTextMatches('.s_G_Mbrs .esP_By_U', username);
        },

        getNumMembers: (): number => {
          return this.count('.s_G_Mbrs .esP_By_U');
        },

        openAddMemberDialog: () => {
          this.waitAndClick('.e_AddMbrsB');
        },

        addOneMember: (username: string) => {
          this.userProfilePage.groupMembers.openAddMemberDialog();
          this.addUsersToPageDialog.addOneUser(username);
          this.addUsersToPageDialog.submit();
          this.userProfilePage.groupMembers.waitUntilMemberPresent(username);
        },

        removeFirstMember: () => {
          this.waitAndClick('.s_G_Mbrs_Mbr .e_MngMbr');
          this.waitAndClick('.e_RmMbr');
          // (Could wait until 1 fewer member? or name gone?)
        }
      },

      activity: {
        switchToPosts: (opts: { shallFindPosts: boolean | 'NoSinceActivityHidden' }) => {
          this.waitAndClick('.s_UP_Act_Nav_PostsB');
          if (opts.shallFindPosts === 'NoSinceActivityHidden') {
            this.userProfilePage.activity.posts.waitForNothingToShow();
          }
          else if (opts.shallFindPosts) {
            this.waitForVisible('.s_UP_Act_Ps');
            this.waitForVisible('.s_UP_Act_Ps_P');
          }
          else {
            this.userProfilePage.activity.posts.waitForNoPosts();
          }
          this.waitUntilLoadingOverlayGone();
        },

        switchToTopics: (opts: { shallFindTopics: boolean | 'NoSinceActivityHidden' }) => {
          this.waitAndClick('.s_UP_Act_Nav_TopicsB');
          this.waitForVisible('.s_UP_Act_Ts');
          if (opts.shallFindTopics === 'NoSinceActivityHidden') {
            this.userProfilePage.activity.topics.waitForNothingToShow();
          }
          else if (opts.shallFindTopics) {
            this.waitForVisible('.e2eTopicTitle');
          }
          else {
            this.userProfilePage.activity.topics.waitForNoTopics();
          }
          this.waitUntilLoadingOverlayGone();
        },

        posts: {
          postSelector: '.s_UP_Act_Ps_P .dw-p-bd',

          waitForNothingToShow: () => {
            this.waitForVisible('.s_UP_Act_List .e_NothingToShow');
          },

          waitForNoPosts: () => {
            this.waitForVisible('.e_NoPosts');
          },

          assertExactly: (num: number) => {
            this.assertExactly(num, this.userProfilePage.activity.posts.postSelector);
          },

          // Do this separately, because can take rather long (suprisingly?).
          waitForPostTextsVisible: () => {
            this.waitForVisible(this.userProfilePage.activity.posts.postSelector);
          },

          assertPostTextVisible: (postText: string) => {
            let selector = this.userProfilePage.activity.posts.postSelector;
            this.assertAnyTextMatches(selector, postText);
          },

          assertPostTextAbsent: (postText: string) => {
            let selector = this.userProfilePage.activity.posts.postSelector;
            this.assertNoTextMatches(selector, postText);
          },
        },

        topics: {
          topicsSelector: '.s_UP_Act_Ts .e2eTopicTitle',

          waitForNothingToShow: () => {
            this.waitForVisible('.s_UP_Act_List .e_NothingToShow');
          },

          waitForNoTopics: () => {
            this.waitForVisible('.e_NoTopics');
          },

          assertExactly: (num: number) => {
            this.assertExactly(num, this.userProfilePage.activity.topics.topicsSelector);
          },

          waitForTopicTitlesVisible: () => {
            this.waitForVisible(this.userProfilePage.activity.topics.topicsSelector);
          },

          assertTopicTitleVisible: (title: string) => {
            let selector = this.userProfilePage.activity.topics.topicsSelector;
            this.assertAnyTextMatches(selector, title);
          },

          assertTopicTitleAbsent: (title: string) => {
            let selector = this.userProfilePage.activity.topics.topicsSelector;
            this.assertNoTextMatches(selector, title);
          },
        }
      },

      notfs: {
        waitUntilKnowsIsEmpty: () => {
          this.waitForVisible('.e_UP_Notfs_None');
        },

        waitUntilSeesNotfs: () => {
          this.waitForVisible('.esUP .esNotfs li a');
        },

        numNotfs: (): number => {
          return this.count('.esUP .esNotfs li a');
        },

        openPageNotfWithText: (text) => {
          this.repeatUntilAtNewUrl(() => {
            this.waitForThenClickText('.esNotf_page', text);
          });
        },

        assertMayNotSeeNotfs: () => {
          this.waitForVisible('.e_UP_Notfs_Err');
          this.assertTextMatches('.e_UP_Notfs_Err', 'EdE7WK2L_');
        }
      },

      draftsEtc: {
        waitUntilLoaded: () => {
          this.waitForExist('.s_Dfs');
        },

        refreshUntilNumDraftsListed: (numDrafts: number) => {
          // But this doesn't refresh the page? Hmm
          let numNow: number;
          this.waitUntil(() => {
            numNow = this.$$('.s_Dfs_Df').length;
            if (numNow === numDrafts)
              return true;
          }, {
            message: `Waiting for ${numDrafts} drafts, num now: ${numNow}`,
          });
        },

        waitUntilNumDraftsListed: (numDrafts: number) => {
          if (numDrafts === 0) {
            this.waitForDisplayed('.e_Dfs_None');
          }
          else {
            this.waitForAtLeast(numDrafts, '.s_Dfs_Df');
            this.assertExactly(numDrafts, '.s_Dfs_Df');
          }
        },

        openDraftIndex: (index: number) => {
          this.repeatUntilAtNewUrl(() => {
            this.waitAndClickNth('.s_Dfs_Df', index);
          });
        },
      },

      invites: {
        clickSendInvite: () => {
          this.waitAndClick('.e_SndInvB');
        }
      },

      preferences: {  // RENAME to prefs
        goHere: (username: string, ps: { isGroup?: true, origin?: string } = {}) => {
          this.userProfilePage._goHere(username, ps, '/preferences');
        },

        switchToEmailsLogins: () => {  // RENAME to tabToAccount
          this.waitAndClick('.s_UP_Prf_Nav_EmLgL');
          if (this.urlPath().startsWith(c.UsersUrlPrefix)) {
            // Wait for user emails loaded.
            this.waitForVisible('.s_UP_EmLg_EmL');
          }
          else {
            // Currently (May 2019) just this section with a delete button.
            this.waitForVisible('.s_UP_EmLg');
          }
          this.waitUntilLoadingOverlayGone();
        },

        switchToAbout: () => {
          this.waitAndClick('.s_UP_Prf_Nav_AbtL');
          this.waitForVisible('.e_UP_Prefs_FN');
        },

        switchToNotifications: () => {
          this.waitAndClick('.s_UP_Prf_Nav_NtfsL');
          this.waitForVisible('.dw-notf-level.btn');
        },

        switchToPrivacy: () => {
          this.waitAndClick('.e_UP_Prf_Nav_PrivL');
          this.waitForVisible('.e_HideActivityAllCB');
        },

        // ---- Should be wrapped in `about { .. }`:

        setFullName: (fullName: string) => {
          this.waitAndSetValue('.e_UP_Prefs_FN input', fullName);
        },

        startChangingUsername: () => {
          this.waitAndClick('.s_UP_Prefs_ChangeUNB');
          this.stupidDialog.close();
        },

        setUsername: (username: string) => {
          this.waitAndSetValue('.s_UP_Prefs_UN input', username);
        },

        setSummaryEmailsEnabled: (enabled: boolean) => {
          this.setCheckbox('#sendSummaryEmails', enabled);
        },

        clickChangePassword: () => {
          this.waitAndClick('.s_UP_Prefs_ChangePwB');
        },

        save: () => {
          this.userProfilePage.preferences.clickSave();
          this.waitUntilModalGone();
          this.waitUntilLoadingOverlayGone();
        },

        clickSave: () => {
          this.waitAndClick('#e2eUP_Prefs_SaveB');
        },
        // ---- /END should be wrapped in `about { .. }`.

        notfs: {  // this.userProfilePage.preferences.notfs

          goHere: (username: string, ps: { isGroup?: true, origin?: string } = {}) => {  // oops, dupl (443300222), keep this
            this.userProfilePage._goHere(username, ps, '/preferences/notifications');
          },

          setSiteNotfLevel: (notfLevel: PageNotfLevel) => {  // RENAME to setNotfLevelForWholeSite?
            this.userProfilePage.preferences.notfs.setNotfLevelForWholeSite(notfLevel);
          },

          setNotfLevelForWholeSite: (notfLevel: PageNotfLevel) => {
            this.waitAndClickFirst('.e_SiteNfLvB');
            this.notfLevelDropdown.clickNotfLevel(notfLevel);
            this.waitForDisplayed(`.e_SiteNfLvB.s_NfLv-${notfLevel}`);
          },

          setNotfLevelForTopicsRepliedTo: (notfLevel: PageNotfLevel) => {
            this.waitAndClickFirst('.e_ReToNfLvB');
            this.notfLevelDropdown.clickNotfLevel(notfLevel);
            this.waitForDisplayed(`.e_ReToNfLvB.s_NfLv-${notfLevel}`);
          },

          setNotfLevelForCategoryId: (categoryId: CategoryId, notfLevel: PageNotfLevel) => {
            this.waitAndClick(`.e_CId-${categoryId} .dw-notf-level`);
            this.notfLevelDropdown.clickNotfLevel(notfLevel);
          },
        },

        privacy: {
          setHideActivityForStrangers: (enabled: boolean) => {
            this.setCheckbox('.e_HideActivityStrangersCB input', enabled);
          },

          setHideActivityForAll: (enabled: boolean) => {
            this.setCheckbox('.e_HideActivityAllCB input', enabled);
          },

          savePrivacySettings: () => {
            dieIf(this.isVisible('.e_Saved'), 'TyE6UKHRQP4'); // unimplemented
            this.waitAndClick('.e_SavePrivacy');
            this.waitForVisible('.e_Saved');
          },
        },

        emailsLogins: {   // RENAME to `account`
          goHere: (username: St, ps: { isGroup?: true, origin?: St } = {}) => {
            this.userProfilePage._goHere(username, ps, '/preferences/account');
          },

          getEmailAddress: () => {
            return this.waitAndGetVisibleText('.s_UP_EmLg_EmL_It_Em');
          },

          waitUntilEmailAddressListed: (addrRegexStr: string,
                  opts: { shallBeVerified?: boolean } = {}) => {
            const verified = opts.shallBeVerified ? '.e_EmVerfd' : (
              opts.shallBeVerified === false ? '.e_EmNotVerfd' : '');
            this.waitUntilTextMatches('.s_UP_EmLg_EmL_It_Em' + verified, addrRegexStr);
          },

          waitAndAssertLoginMethod: (ps: { providerName: St, username?: St,
                    emailAddr?: St, index?: Nr }) => {
            const howSel = '.s_UP_EmLg_LgL_It_How';
            this.waitForDisplayed(howSel);
            this.assertNthTextMatches(howSel, ps.index || 1,
                    ps.providerName.toLowerCase(), undefined, { caseless: true });

            if (ps.username || ps.emailAddr) {
              dieIf(!!ps.index, 'unimpl TyE530RKTMD');
              const actualUsername = this.waitAndGetVisibleText('.s_UP_EmLg_LgL_It_Un');
              const actualEmail = this.waitAndGetVisibleText('.s_UP_EmLg_LgL_It_Em');
              // Don't convert to lowercase:
              tyAssert.eq(actualUsername, ps.username);
              tyAssert.eq(actualEmail, ps.emailAddr);
            }
          },

          addEmailAddress: (address) => {
            const emailsLogins = this.userProfilePage.preferences.emailsLogins;
            emailsLogins.clickAddEmailAddress();
            emailsLogins.typeNewEmailAddress(address);
            emailsLogins.saveNewEmailAddress();
          },

          clickAddEmailAddress: () => {
            this.waitAndClick('.e_AddEmail');
            this.waitForVisible('.e_NewEmail input');
          },

          typeNewEmailAddress: (emailAddress) => {
            this.waitAndSetValue('.e_NewEmail input', emailAddress);
          },

          saveNewEmailAddress: () => {
            this.waitAndClick('.e_SaveEmB');
            this.waitForVisible('.s_UP_EmLg_EmAdded');
          },

          canRemoveEmailAddress: (): boolean => {
            this.waitForVisible('.e_AddEmail');
            // Now any remove button should have appeared.
            return this.isVisible('.e_RemoveEmB');
          },

          removeFirstEmailAddrOutOf: (numCanRemoveTotal: number) => {
            for (let i = 0; this.count('.e_RemoveEmB') !== numCanRemoveTotal; ++i) {
              this.#br.pause(PollMs);
              if (i >= 10 && (i % 10) === 0) {
                logWarning(`Waiting for ${numCanRemoveTotal} remove buttons ...`);
              }
            }
            this.waitAndClick('.e_RemoveEmB', { clickFirst: true });
            while (this.count('.e_RemoveEmB') !== numCanRemoveTotal - 1) {
              this.#br.pause(PollMs);
            }
          },

          canMakeOtherEmailPrimary: (): boolean => {
            // Only call this function if another email has been added (then there's a Remove button).
            this.waitForVisible('.e_RemoveEmB');
            // Now the make-primary button would also have appeared, if it's here.
            return this.isVisible('.e_MakeEmPrimaryB');
          },

          makeOtherEmailPrimary: () => {
            this.waitAndClick('.e_MakeEmPrimaryB');
          },

          deleteAccount: () => {
            this.rememberCurrentUrl();
            this.waitAndClick('.e_DlAct');
            this.waitAndClick('.e_SD_SecB');
            this.waitForNewUrl();
          }
        }
      }
    };


    hasVerifiedSignupEmailPage = {
      clickContinue: () => {
        this.repeatUntilAtNewUrl(() => {
          this.waitAndClick('#e2eContinue');
        });
      }
    };


    hasVerifiedEmailPage = {  // for additional addresses, RENAME?
      waitUntilLoaded: (opts: { needToLogin: boolean }) => {
        this.waitForVisible('.e_HasVerifiedEmail');
        this.waitForVisible('.e_ViewProfileL');
        this.waitForVisible('.e_HomepageL');
        assert(opts.needToLogin === this.isVisible('.e_NeedToLogin'));
      },

      goToHomepage: () => {
        this.waitAndClick('.e_HomepageL');
      },

      goToProfile: () => {
        this.waitAndClick('.e_ViewProfileL');
      }
    };


    flagDialog = {
      waitUntilFadedIn: () => {
        this.waitUntilDoesNotMove('.e_FD_InaptRB');
      },

      clickInappropriate: () => {
        this.waitAndClick('.e_FD_InaptRB label');
      },

      submit: () => {
        this.waitAndClick('.e_FD_SubmitB');
        this.waitUntilLoadingOverlayGone();
        // Don't: this.waitUntilModalGone(), because now the stupid-dialog pop ups
        // and says "Thanks", and needs to be closed.
      },
    };


    stupidDialog = {
      yesIAmSure: () => {
        // It's the same.
        this.stupidDialog.close();
      },

      clickClose: () => {
        this.waitAndClick('.e_SD_CloseB');
      },

      close: () => {
        this.stupidDialog.clickClose();
        this.waitUntilModalGone();
      },
    };


    tips = {
      numTipsDisplayed: (): Nr => {
        return this.count(':not(.c_SrvAnns) > .dw-help');
      },
      hideATips: () => {
        this.waitAndClickFirst(':not(.c_SrvAnns) > .dw-help .dw-hide');
      },
      waitForExactlyNumTips: (num: Nr) => {
        this.waitForExactly(num, ':not(.c_SrvAnns) > .dw-help');
      },
      unhideAllTips: () => {
        this.topbar.openMyMenu();
        this.topbar.myMenu.unhideTips();
      },
      waitForPreviewTips: () => {
        this.waitForDisplayed('.dw-preview-help');
      },
      waitForPreviewTipsGone: () => {
        this.waitForGone('.dw-preview-help');
      },
      isPreviewTipsDisplayed: (): Bo => {
        return this.isDisplayed('.dw-preview-help');
      },

      numAnnouncementsDisplayed: (): Nr => {
        return this.count('.c_SrvAnns .dw-help');
      },
      hideAnAnnouncement: () => {
        this.waitAndClickFirst('.c_SrvAnns .dw-hide');
      },
      waitForExactlyNumAnnouncements: (num: Nr) => {
        this.waitForExactly(num, '.c_SrvAnns .dw-help');
      },
      unhideAllAnnouncements: () => {
        this.topbar.openMyMenu();
        this.topbar.myMenu.unhideAnnouncements();
      },
    };


    adminArea = {
      waitAssertVisible: () => {
        this.waitForVisible('h1.esTopbar_custom_title');
        this.assertTextMatches('h1', "Admin Area");
      },

      clickLeaveAdminArea: () => {
        this.repeatUntilAtNewUrl(() => {
          this.waitAndClick('.s_Tb_Ln-Bck');
        });
      },

      goToLoginSettings: (origin?: string, opts: { loginAs? } = {}) => {
        this.go((origin || '') + '/-/admin/settings/login');
        if (opts.loginAs) {
          this.loginDialog.loginWithPassword(opts.loginAs);
          this.adminArea.waitAssertVisible();
        }
      },

      goToUsersEnabled: (origin?: string) => {
        this.go((origin || '') + '/-/admin/users');
      },

      goToUser: (member: Member | UserId, origin?: string) => {
        const userId = _.isNumber(member) ? member : member.id;
        this.go((origin || '') + `/-/admin/users/id/${userId}`);
      },

      tabs: {
        navToApi: () => {
          this.repeatUntilAtNewUrl(() => {
            this.waitAndClick('.e_ApiB');
          });
        },
        isApiTabDisplayed: (): Bo => {
          return this.isDisplayed('.e_ApiB');
        },

        navToGroups: () => this.adminArea.navToGroups(),
      },

      navToGroups: () => {   // MOVE to inside tabs {}, see just above.
        this.repeatUntilAtNewUrl(() => {
          this.waitAndClick('.e_GrpsB');
        });
      },

      goToUsersInvited: (origin?: string, opts: { loginAs? } = {}) => {
        this.go((origin || '') + '/-/admin/users/invited');
        if (opts.loginAs) {
          this.loginDialog.loginWithPassword(opts.loginAs);
        }
        this.adminArea.users.invites.waitUntilLoaded();
      },

      goToBackupsTab: (origin?: string, opts: { loginAs? } = {}) => {
        this.adminArea._goToMaybeLogin(origin, '/-/admin/backup', opts);
        this.adminArea.backupsTab.waitUntilLoaded();
      },

      goToApi: (origin?: string, opts: { loginAs? } = {}) => {
        this.go((origin || '') + '/-/admin/api');
        if (opts.loginAs) {
          this.loginDialog.loginWithPassword(opts.loginAs);
        }
        this.adminArea.apiTab.waitUntilLoaded();
      },

      goToReview: (origin?: string, opts: { loginAs? } = {}) => {
        this.go((origin || '') + '/-/admin/review/all');
        if (opts.loginAs) {
          this.loginDialog.loginWithPassword(opts.loginAs);
        }
        this.adminArea.review.waitUntilLoaded();
      },

      _goToMaybeLogin: (origin: string, endpoint: string, opts: { loginAs? } = {}) => {
        this.go((origin || '') + endpoint);
        if (opts.loginAs) {
          this.loginDialog.loginWithPassword(opts.loginAs);
        }
      },

      goToAdminExtraLogin: (origin?: string) => {
        this.go((origin || '') + '/-/admin-login');
      },

      isReviewTabVisible: () => {
        return this.isVisible('.e_RvwB');
      },

      isUsersTabVisible: () => {
        return this.isVisible('.e_UsrsB');
      },

      numTabsVisible: () =>
        this.$$('.esAdminArea .dw-main-nav > li').length,

      settings: {
        clickSaveAll: (ps: { willFail?: Bo } = {}) => {
          this.scrollToBottom();
          this.waitAndClick('.esA_SaveBar_SaveAllB');
          this.waitUntilLoadingOverlayGone();
          if (!ps.willFail) {
            this.waitUntilGone('.esA_SaveBar_SaveAllB');
          }
        },

        clickLegalNavLink: () => {
          this.waitAndClick('#e2eAA_Ss_LegalL');
          this.waitForVisible('#e2eAA_Ss_OrgNameTI');
        },

        clickLoginNavLink: () => {
          this.waitAndClick('#e2eAA_Ss_LoginL');
          this.waitForVisible('#e2eLoginRequiredCB');
        },

        clickModerationNavLink: () => {
          this.waitAndClick('#e2eAA_Ss_ModL');
        },

        clickAnalyticsNavLink: () => {
          this.waitAndClick('#e2eAA_Ss_AnalyticsL');
        },

        clickAdvancedNavLink: () => {
          this.waitAndClick('#e2eAA_Ss_AdvancedL');
        },

        clickExperimentalNavLink: () => {
          this.waitAndClick('#e2eAA_Ss_ExpL');
        },

        legal: {
          editOrgName: (newName: string) => {
            this.waitAndSetValue('#e2eAA_Ss_OrgNameTI', newName);
          },

          editOrgNameShort: (newName: string) => {
            this.waitAndSetValue('#e2eAA_Ss_OrgNameShortTI', newName);
          },
        },

        login: {
          goHere: (origin?: St, opts: { loginAs? } = {}) => {
            this.adminArea.goToLoginSettings(origin, opts);
          },

          setRequireVerifiedEmail: (isRequired: boolean) => {
            this.setCheckbox('.e_A_Ss_S-RequireVerifiedEmailCB input', isRequired);
          },

          setLoginRequired: (isRequired: boolean) => {
            this.setCheckbox('#e2eLoginRequiredCB', isRequired);
          },

          setApproveUsers: (isRequired: boolean) => {
            this.setCheckbox('#e_ApproveUsersCB', isRequired);
          },

          clickAllowGuestLogin: () => {
            this.waitAndClick('#e2eAllowGuestsCB');
          },

          setExpireIdleAfterMinutes: (minutes: number) => {
            this.scrollIntoViewInPageColumn('.e_LgoIdlAftMins input');
            this.waitAndSetValue('.e_LgoIdlAftMins input', minutes, { checkAndRetry: true });
          },

          setEnableOidcDontSave: (enabled: Bo) => {
            const sel = '.e_A_Ss_S-OidcCB input';
            this.scrollIntoViewInPageColumn(sel);
            this.waitUntilDoesNotMove(sel);
            this.setCheckbox(sel, enabled);
          },

          setOnlyOidc: (only: Bo) => {
            const sel = '.e_A_Ss_S-OnlyOidcCB input';
            this.scrollIntoViewInPageColumn(sel);
            this.waitUntilDoesNotMove(sel);
            this.setCheckbox(sel, only);
          },

          configureIdps: (json: St) => {
            this.waitAndClick('.e_ConfIdpsB');
            this.waitAndSetValue('.s_CuIdpsEdr textarea', json, { checkAndRetry: true });
            this.waitAndClick('.s_CuIdpsEdr .btn');
          },

          setEmailDomainWhitelist: (text: string) => {
            this.scrollIntoViewInPageColumn('.e_EmailWhitelist textarea');
            this.waitAndSetValue('.e_EmailWhitelist textarea', text, { checkAndRetry: true });
          },

          setEmailDomainBlocklist: (text: string) => {
            this.scrollIntoViewInPageColumn('.e_EmailBlacklist textarea');
            this.waitAndSetValue('.e_EmailBlacklist textarea', text, { checkAndRetry: true });
          },

          typeSsoUrl: (url: string) => {
            this.scrollIntoViewInPageColumn('.e_SsoUrl input');
            this.waitUntilDoesNotMove('.e_SsoUrl input');
            this.waitAndSetValue('.e_SsoUrl input', url, { checkAndRetry: true });
          },

          setSsoLogoutUrl: (url: St) => {
            this.scrollIntoViewInPageColumn('.e_SsoLgoUrl input');
            this.waitUntilDoesNotMove('.e_SsoLgoUrl input');
            this.waitAndSetValue('.e_SsoLgoUrl input', url, { checkAndRetry: true });
          },

          setSsoLoginRequiredLogoutUrl: (url: string) => {
            this.scrollIntoViewInPageColumn('.e_SsoAftLgoUrl input');
            this.waitUntilDoesNotMove('.e_SsoAftLgoUrl input');
            this.waitAndSetValue('.e_SsoAftLgoUrl input', url, { checkAndRetry: true });
          },

          setEnableSso: (enabled: boolean) => {
            this.scrollIntoViewInPageColumn('.e_EnblSso input');
            this.waitUntilDoesNotMove('.e_EnblSso input');
            this.setCheckbox('.e_EnblSso input', enabled);
          },

          setShowEmbAuthnBtns: (enabled: Bo) => {
            this.scrollIntoViewInPageColumn('.e_EmbAuBs input');
            this.waitUntilDoesNotMove('.e_EmbAuBs input');
            this.setCheckbox('.e_EmbAuBs input', enabled);
          },

          generatePasetoV2LocalSecret: () => {
            this.waitAndClick('.e_EmbComSecr_GenB');
          },

          copyPasetoV2LocalSecret: (): St => {
            return this.waitAndGetValue('.e_EmbComSecr input');
          },

          goToSsoTestPage: () => {
            this.repeatUntilAtNewUrl(() => {
              this.waitAndClickFirst('.e_SsoTestL');
            });
          }
        },

        moderation: {
          goHere: (origin?: St, opts: { loginAs? } = {}) => {
            this.adminArea._goToMaybeLogin(origin, '/-/admin/settings/moderation', opts);
            this.waitForVisible('.e_NumFstAprBef');
          },

          setNumFirstToApproveBefore: (n: Nr) => {
            this.scrollAndSetValue('.e_NumFstAprBef input', n);
          },

          setApproveBeforeTrustLevel: (level: Nr) => {
            this.scrollAndSetValue('.e_AprBefTrLvl input', level);
          },

          setMaxNumPendingApproval: (n: Nr) => {
            this.scrollAndSetValue('.e_MxPndApr input', n);
          },

          setNumFirstToReviewAfter: (n: Nr) => {
            this.scrollAndSetValue('.e_NumFstRvwAft input', n);
          },

          setReviewAfterTrustLevel: (level: Nr) => {
            this.scrollAndSetValue('.e_RvwAftTrLvl input', level);
          },

          setMaxNumPendingReview: (n: Nr) => {
            this.scrollAndSetValue('.e_MxPndRvw input', n);
          },
        },

        features: {
          goHere: (origin?: string, opts: { loginAs? } = {}) => {
            this.adminArea._goToMaybeLogin(origin, '/-/admin/settings/features', opts);
          },

          setEnableApi: (enabled: boolean) => {
            // ---- Can remove, right
            this.scrollIntoViewInPageColumn('#te_EnblApi');
            this.waitUntilDoesNotMove('#te_EnblApi');
            // ----------------------
            this.setCheckbox('#te_EnblApi', enabled);
          },

          setEnableCors: (enabled: Bo) => {
            this.setCheckbox('.e_EnbCors input', enabled);
          },

          setCorsOrigins: (text: St) => {
            this.waitAndSetValue('.e_CorsFrm textarea', text);
          },
        },

        embedded: {
          goHere: (origin?: string) => {
            this.go((origin || '') + '/-/admin/settings/embedded-comments');
          },

          setAllowEmbeddingFrom: (value: string) => {
            this.waitAndSetValue('#e_AllowEmbFrom', value);
          },

          createSaveEmbeddingPage: (ps: { urlPath: string, discussionId?: string }) => {
            const htmlToPaste = this.waitAndGetVisibleText('#e_EmbCmtsHtml');
            const pageHtml = utils.makeEmbeddedCommentsHtml({
                htmlToPaste, discussionId: ps.discussionId,
                pageName: ps.urlPath, color: 'black', bgColor: '#a359fc' });
            fs.writeFileSync(`target/${ps.urlPath}`, pageHtml);
          },
        },

        advanced: {
          duplHostnamesSelector: '.s_A_Ss_S-Hostnames-Dupl pre',
          redirHostnamesSelector: '.s_A_Ss_S-Hostnames-Redr pre',

          getHostname: (): string => {
            return this.waitAndGetVisibleText('.esA_Ss_S_Hostname');
          },

          getDuplicatingHostnames: (): string => {
            return this.waitAndGetVisibleText(this.adminArea.settings.advanced.duplHostnamesSelector);
          },

          isDuplicatingHostnamesVisible: (): boolean => {
            return this.isVisible(this.adminArea.settings.advanced.duplHostnamesSelector);
          },

          getRedirectingHostnames: (): string => {
            return this.waitAndGetVisibleText(this.adminArea.settings.advanced.redirHostnamesSelector);
          },

          isRedirectingHostnamesVisible: (): boolean => {
            return this.isVisible(this.adminArea.settings.advanced.redirHostnamesSelector);
          },

          clickChangeSiteAddress: () => {
            this.waitAndClick('.e_ChAdrB');
          },

          typeNewSiteAddress: (newAddress: string) => {
            this.waitAndSetValue('.s_A_NewAdrD_HostnI input', newAddress);
          },

          saveNewSiteAddress: () => {
            this.waitAndClick('.s_A_NewAdrD .btn-primary');
          },

          waitForNewSiteRedirectLink: () => {
            this.waitForVisible('.e_NewSiteAddr');
          },

          followLinkToNewSiteAddr: () => {
            this.rememberCurrentUrl();
            this.waitAndClick('.e_NewSiteAddr');
            this.waitForNewOrigin();
          },

          clickRedirectOldSiteAddresses: () => {
            this.waitAndClick('.e_RedirOldAddrB');
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

        viewUser: (username: St | Member) => {
          this.go2('/-/admin/users/id/' + ((username as Member).username || username));
          this.adminArea.user.waitForLoaded();
        },

        waitForLoaded: () => {
          this.waitForVisible('.esA_Us_U_Rows');
        },

        viewPublProfile: () => {
          this.waitAndClick('.e_VwPblPrfB');
        },

        assertUsernameIs: (usernameOrMember: string | Member) => {
          const username = _.isString(usernameOrMember) ?
              usernameOrMember : (usernameOrMember as Member).username;
          this.waitAndAssertVisibleTextMatches('.e_A_Us_U_Username', username);
        },

        assertEnabled: () => {
          this.adminArea.user.waitForLoaded();
          assert(this.isVisible(this.adminArea.user.enabledSelector));
        },

        assertEmailVerified: () => {
          assert(this.isVisible(this.adminArea.user.setEmailNotVerifiedButtonSelector));
        },

        assertEmailNotVerified: () => {
          assert(this.isVisible(this.adminArea.user.setEmailVerifiedButtonSelector));
        },

        setEmailToVerified: (verified: boolean) => {
          const u = this.adminArea.user;
          this.waitAndClick(
              verified ? u.setEmailVerifiedButtonSelector : u.setEmailNotVerifiedButtonSelector);
          // Wait for the request to complete — then, the opposite buttons will be shown:
          this.waitForVisible(
              verified ? u.setEmailNotVerifiedButtonSelector : u.setEmailVerifiedButtonSelector);
        },

        resendEmailVerifEmail: () => {
          this.waitAndClick(this.adminArea.user.sendEmVerEmButtonSelector);
        },

        assertDisabledBecauseNotYetApproved: () => {
          this.adminArea.user.waitForLoaded();
          assert(this.isVisible(this.adminArea.user.disabledSelector));
          assert(this.isVisible(this.adminArea.user.disabledBecauseWaitingForApproval));
          // If email not verified, wouldn't be considered waiting.
          assert(!this.isVisible(this.adminArea.user.disabledBecauseEmailUnverified));
        },

        assertDisabledBecauseEmailNotVerified: () => {
          this.adminArea.user.waitForLoaded();
          assert(this.isVisible(this.adminArea.user.disabledSelector));
          assert(this.isVisible(this.adminArea.user.disabledBecauseEmailUnverified));
          // Isn't considered waiting, until after email approved.
          assert(!this.isVisible(this.adminArea.user.disabledBecauseWaitingForApproval));
        },

        assertApprovedInfoAbsent: () => {
          this.adminArea.user.waitForLoaded();
          assert(this.isExisting('.e_Appr_Info-Absent'));
        },

        assertApproved: () => {
          this.adminArea.user.waitForLoaded();
          assert(this.isVisible('.e_Appr_Yes'));
        },

        assertRejected: () => {
          this.adminArea.user.waitForLoaded();
          assert(this.isVisible('.e_Appr_No'));
        },

        assertWaitingForApproval: () => {   // RENAME to  assertApprovalUndecided
          this.adminArea.user.waitForLoaded();
          assert(this.isVisible('.e_Appr_Undecided'));
        },

        approveUser: () => {
          this.waitAndClick('.e_Appr_ApprB');
          this.waitForVisible('.e_Appr_Yes');
        },

        rejectUser: () => {
          this.waitAndClick('.e_Appr_RejB');
          this.waitForVisible('.e_Appr_No');
        },

        undoApproveOrReject: () => {
          this.waitAndClick('.e_Appr_UndoB');
          this.waitForVisible('.e_Appr_Undecided');
        },

        suspendUser: (opts: {
              days: number, reason: string } = { days: 10, reason: "Because." }) => {
          this.waitAndClick('.e_Suspend');
          this.waitUntilDoesNotMove('.e_SuspDays');
          this.waitAndSetValue('.e_SuspDays input', opts.days);
          this.waitAndSetValue('.e_SuspReason input', opts.reason);
          this.waitAndClick('.e_DoSuspendB');
          this.waitForVisible('.e_Unuspend');
        },

        unsuspendUser: () => {
          this.waitAndClick('.e_Unuspend');
          this.waitForVisible('.e_Suspend');
        },

        setTrustLevel: (trustLevel: TrustLevel) => {
          this.waitAndClick('.e_TruLvB');
          this.waitAndClick('.e_TruLv-' + trustLevel);
          this.waitForDisplayed('.e_TruLvLkd');
        },

        unlockTrustLevel: () => {
          this.waitAndClick('.e_TruLvB');
          this.waitAndClick('.e_UnlkTruLvB');
          this.waitForVisible('.e_TruLv0Lkd');
        },

        // RENAME to setTheatLevel(...)
        markAsNoThreat: () => {
          this.waitAndClick('.e_TrtLvB');
          this.waitAndClick('.e_HopfSafB');
          this.waitForVisible('.e_ThreatLvlIsLkd');
          this.waitForDisplayed('.e_TrtLv-3'); // HopefullySafe
        },

        markAsMildThreat: () => {
          this.waitAndClick('.e_TrtLvB');
          this.waitAndClick('.e_MildThreatB');
          this.waitForVisible('.e_ThreatLvlIsLkd');
          this.waitForDisplayed('.e_TrtLv-4'); // MildThreat
        },

        markAsModerateThreat: () => {
          this.waitAndClick('.e_TrtLvB');
          this.waitAndClick('.e_ModerateThreatB');
          this.waitForVisible('.e_ThreatLvlIsLkd');
          this.waitForDisplayed('.e_TrtLv-5'); // ModerateThreat
        },

        unlockThreatLevel: () => {
          this.waitAndClick('.e_TrtLvB');
          this.waitAndClick('.e_UnlockThreatB');
          this.waitForVisible('.e_ThreatLvlNotLkd');
        },

        grantAdmin: () => {
          this.waitForVisible('.e_Adm-No');
          this.waitAndClick('.e_ToggleAdminB');
          this.waitForVisible('.e_Adm-Yes');
        },

        revokeAdmin: () => {
          this.waitForVisible('.e_Adm-Yes');
          this.waitAndClick('.e_ToggleAdminB');
          this.waitForVisible('.e_Adm-No');
        },

        grantModerator: () => {
          this.waitForVisible('.e_Mod-No');
          this.waitAndClick('.e_ToggleModB');
          this.waitForVisible('.e_Mod-Yes');
        },

        revokeModerator: () => {
          this.waitForVisible('.e_Mod-Yes');
          this.waitAndClick('.e_ToggleModB');
          this.waitForVisible('.e_Mod-No');
        },

        startImpersonating: () => {
          this.repeatUntilAtNewUrl(() => {
            this.waitAndClick('#e2eA_Us_U_ImpersonateB');
          });
        },
      },

      users: {
        usernameSelector: '.dw-username',
        enabledUsersTabSelector: '.e_EnabledUsB',
        waitingUsersTabSelector: '.e_WaitingUsB',

        waitForLoaded: () => {
          this.waitForVisible('.e_AdminUsersList');
        },

        goToUser: (user: string | Member) => {
          const username = _.isString(user) ? user : user.username;
          this.rememberCurrentUrl();
          this.waitForThenClickText(this.adminArea.users.usernameSelector, username);
          this.waitForNewUrl();
          this.adminArea.user.assertUsernameIs(user);
        },

        assertUserListEmpty: () => {
          this.adminArea.users.waitForLoaded();
          assert(this.isVisible('.e_NoSuchUsers'));
        },

        assertUserListed: (member: { username: string }) => {
          this.adminArea.users.waitForLoaded();
          this.assertAnyTextMatches(this.adminArea.users.usernameSelector, member.username);
        },

        assertUserAbsent: (member: { username: string }) => {
          this.adminArea.users.waitForLoaded();
          this.assertNoTextMatches(this.adminArea.users.usernameSelector, member.username);
        },

        asserExactlyNumUsers: (num: number) => {
          this.adminArea.users.waitForLoaded();
          this.assertExactly(num, this.adminArea.users.usernameSelector);
        },

        // Works only if exactly 1 user listed.
        assertEmailVerified_1_user: (member: Member, verified: boolean) => {
          // for now:  --
          this.adminArea.users.assertUserListed(member);
          // later, check the relevant user row.
          // ------------
          if (verified) {
            assert(!this.isVisible('.e_EmNotVerfd'));
          }
          else {
            assert(this.isVisible('.e_EmNotVerfd'));
          }
        },

        switchToEnabled: () => {
          this.waitAndClick(this.adminArea.users.enabledUsersTabSelector);
          this.waitForVisible('.e_EnabledUsersIntro');
          this.adminArea.users.waitForLoaded();
        },

        switchToWaiting: () => {
          this.waitAndClick(this.adminArea.users.waitingUsersTabSelector);
          this.adminArea.users.waiting.waitUntilLoaded();
        },

        isWaitingTabVisible: () => {
          this.waitForVisible(this.adminArea.users.enabledUsersTabSelector);
          return this.isVisible(this.adminArea.users.waitingUsersTabSelector);
        },

        switchToNew: () => {
          this.waitAndClick('.e_NewUsB');
          this.waitForVisible('.e_NewUsersIntro');
          this.adminArea.users.waitForLoaded();
        },

        switchToStaff: () => {
          this.waitAndClick('.e_StaffUsB');
          this.waitForVisible('.e_StaffUsersIntro');
          this.adminArea.users.waitForLoaded();
        },

        switchToSuspended: () => {
          this.waitAndClick('.e_SuspendedUsB');
          this.waitForVisible('.e_SuspendedUsersIntro');
          this.adminArea.users.waitForLoaded();
        },

        switchToWatching: () => {
          this.waitAndClick('.e_WatchingUsB');
          this.waitForVisible('.e_ThreatsUsersIntro');
          this.adminArea.users.waitForLoaded();
        },

        switchToInvites: () => {
          this.waitAndClick('.e_InvitedUsB');
          this.adminArea.users.invites.waitUntilLoaded();
        },

        waiting: {
          undoSelector: '.e_UndoApprRjctB',

          waitUntilLoaded: () => {
            this.waitForVisible('.e_WaitingUsersIntro');
            this.adminArea.users.waitForLoaded();
          },

          approveFirstListedUser: () => {
            this.waitAndClickFirst('.e_ApproveUserB');
            this.waitForVisible(this.adminArea.users.waiting.undoSelector);
          },

          rejectFirstListedUser: () => {
            this.waitAndClickFirst('.e_RejectUserB');
            this.waitForVisible(this.adminArea.users.waiting.undoSelector);
          },

          undoApproveOrReject: () => {
            this.waitAndClickFirst(this.adminArea.users.waiting.undoSelector);
            this.waitUntilGone(this.adminArea.users.waiting.undoSelector);
          },
        },

        invites: {
          waitUntilLoaded: () => {
            // When this elem present, any invited-users-data has also been loaded.
            this.waitForExist('.s_InvsL');
          },

          clickSendInvite: () => {
            this.waitAndClick('.s_AA_Us_Inv_SendB');
          },
        }
      },

      interface: {
        goHere: (origin?: string, opts: { loginAs? } = {}) => {
          this.adminArea._goToMaybeLogin(origin, '/-/admin/customize/basic', opts);
        },

        waitUntilLoaded: () => {
          this.waitForVisible('.s_A_Ss_S');
          // Top tab pane unmount bug workaround apparently not needed here. [5QKBRQ] [E2EBUG]
          // Can be removed elsewhere too?
        },

        areTopicSectionSettingsVisible: () => {
          return this.isVisible('.e_DscPrgSct');
        },

        setSortOrder: (value: number) => {
          dieIf(value === 0, "Cannot set to default — that'd clear the value, " +
              "but this.#br drivers are buggy / weird, won't work with Webdriver v4 [TyE06KUDS]");
          // 0 = default.
          const valueOrEmpty = value === 0 ? '' : value;
          this.waitAndSetValue('.e_BlgSrtOdr input', valueOrEmpty, { checkAndRetry: true });
        },

        setBlogPostLikeVotes: (value: number) => {
          this.waitAndSetValue('.e_BlgPstVts input', value, { checkAndRetry: true });
        },

        setAddCommentBtnTitle: (title: string) => {
          this.waitAndSetValue('.e_AddCmtBtnTtl input', title, { checkAndRetry: true });
        },

      },

      backupsTab: {
        waitUntilLoaded: () => {
          this.waitForVisible('.s_A_Bkp');
        },

        clickRestore: () => {
          this.waitAndClick('.e_RstBkp');
        },

        selectFileToRestore: (fileNameInTargetDir: string) => {
          this.waitAndSelectFile('.e_SelFil', 'TargetDir', fileNameInTargetDir);
        },
      },

      apiTab: {
        waitUntilLoaded: () => {
          this.waitForVisible('.s_A_Api');
        },

        generateSecret: () => {
          this.waitAndClick('.e_GenSecrB');
        },

        showAndCopyMostRecentSecret: (): string => {
          this.waitAndClick('.e_ShowSecrB');
          return this.waitAndGetVisibleText('.esStupidDlg .e_SecrVal');
        },
      },

      review: {
        goHere: (origin?: string, opts: { loginAs? } = {}) => {
          this.adminArea.goToReview(origin, opts);
        },

        waitUntilLoaded: () => {
          this.waitForVisible('.s_A_Rvw');
          //----
          // Top tab pane unmount bug workaround, for e2e tests. [5QKBRQ].  [E2EBUG]
          // Going to the Settings tab, makes the Review tab pane unmount, and after that,
          // it won't surprise-unmount ever again (until page reload).
          this.waitAndClick('.e_UsrsB');
          this.waitAndClick('.e_RvwB');
          this.waitForVisible('.s_A_Rvw');
          //----
        },

        hideCompletedTasks: () => {
          this.setCheckbox('.e_HideCompl input', true);
          this.waitForGone('.e_TskDoneGone');
        },

        playTimePastUndo: () => {
          // Make the server and this.#br believe we've waited for the review timeout seconds.
          server.playTimeSeconds(c.ReviewDecisionUndoTimoutSeconds + 10);
          this.playTimeSeconds(c.ReviewDecisionUndoTimoutSeconds + 10);
        },

        // DEPRECATED  CLEAN_UP REFACTOR change to  { pageId?, postNr?, dontCareWhichPost? }
        // and require  dontCareWhichPost  to be true, or the others.
        // So won't create flappy tests!
        waitForServerToCarryOutDecisions: (pageId?: PageId, postNr?: PostNr) => {
          // Then wait for the server to actually do something.
          // The UI will reload the task list and auto-update itself [2WBKG7E], when
          // the review decisions have been carried out server side. Then the buttons
          // tested for below, hide.
          let buttonsNotGone;
          this.waitUntil(() => {
            this.#br.pause(c.JanitorThreadIntervalMs + 200);
            if (!pageId) {
              if (!this.isVisible('.s_A_Rvw_Tsk_UndoB'))
                return true;
            }
            else {
              // If we have a specific post in mind, then not only the Undo, but also
              // any Accept or Delete buttons elsewhere, for the same post, should
              // disappear, when the server is done.
              assert(_.isNumber(postNr));
              const pagePostSelector = '.e_Pg-Id-' + pageId + '.e_P-Nr-' + postNr;
              const stillVisible = this.filterVisible([
                      pagePostSelector + ' .s_A_Rvw_Tsk_UndoB',
                      pagePostSelector + ' .e_A_Rvw_Tsk_AcptB',
                      pagePostSelector + ' .e_A_Rvw_Tsk_RjctB'],
                      { keepVisible: true });
              if (!stillVisible.length)
                return true;

              buttonsNotGone = `Should disappear: ${JSON.stringify(stillVisible)}`;
            }
            //----
            // Top tab pane unmount bug workaround. [5QKBRQ].  [E2EBUG]  DO_AFTER 2021-02-01 REMOVE?  + other "unmount bug workaround" elsewhere.
            this.#br.refresh();
            this.adminArea.review.waitUntilLoaded();
            //----
          }, {
            message: () => buttonsNotGone,
            refreshBetween: true,
          });
          this.waitUntilLoadingOverlayGone();
        },

        goToPostForTaskIndex: (index: number) => {
          die("Won't work, opens in new tab [TyE5NA2953]");
          const numTabsBefore = this.numTabs();
          this.topic.clickPostActionButton(`.e_RT-Ix-${index} .s_A_Rvw_Tsk_ViewB`);
          this.waitForMinBrowserTabs(numTabsBefore + 1);
          this.swithToOtherTabOrWindow();  // ! but might be the wrong window
          // Need to find the newly appeared new win id?
          this.topic.waitForLoaded();
        },

        approvePostForMostRecentTask: () => {
          this.topic.clickPostActionButton('.e_A_Rvw_Tsk_AcptB', { clickFirst: true });
          this.waitUntilModalGone();
          this.waitUntilLoadingOverlayGone();
        },

        approvePostForTaskIndex: (index: number) => {
          this.topic.clickPostActionButton(`.e_RT-Ix-${index} .e_A_Rvw_Tsk_AcptB`);
          this.waitUntilModalGone();
          this.waitUntilLoadingOverlayGone();
        },

        rejectDeleteTaskIndex: (index: number) => {
          this.topic.clickPostActionButton(`.e_RT-Ix-${index} .e_A_Rvw_Tsk_RjctB`);
          this.waitUntilModalGone();
          this.waitUntilLoadingOverlayGone();
        },

        countReviewTasksFor: (pageId: PageId, postNr: PostNr,
              opts: { waiting: boolean }): number => {
          const pageIdPostNrSelector = '.e_Pg-Id-' + pageId + '.e_P-Nr-' + postNr;
          const waitingSelector = opts.waiting ? '.e_Wtng' : '.e_NotWtng';
          const selector = '.esReviewTask' + pageIdPostNrSelector + waitingSelector;
          const elems = this.$$(selector);
          logMessage(`Counted to ${elems.length} of these: ${selector}`);
          return elems.length;
        },

        isMoreStuffToReview: () => {
          return this.isVisible('.e_A_Rvw_Tsk_AcptB');
        },

        waitForTextToReview: (text: string | RegExp, ps: { index?: number } = {}) => {
          let selector = '.esReviewTask_it';
          if (ps.index !== undefined) {
            selector = `.e_RT-Ix-${ps.index} ${selector}`;
          }
          this.waitUntilTextMatches(selector, text);
        },

        // RENAME to countReviewTasks? and add countReviewTasksWaiting?
        countThingsToReview: (): number =>
          this.$$('.esReviewTask_it').length,

        isTasksPostDeleted: (taskIndex: number): boolean => {
          return this.isVisible(`.e_RT-Ix-${taskIndex}.e_P-Dd`);
        }
      },

      adminExtraLogin: {
        submitEmailAddress: (emailAddress: string) => {
          this.waitAndSetValue('.e_AdmEmI', emailAddress);
          this.waitAndClick('.e_SbmB');
          this.waitForGone('.e_SbmB');
        },

        assertIsBadEmailAddress: () => {
          this.assertPageHtmlSourceMatches_1('TyE0ADMEML_');
        },

        assertEmailSentMessage: () => {
          this.assertPageHtmlSourceMatches_1('Email sent');
        }
      }
    };


    inviteDialog = {
      waitUntilLoaded: () => {
        this.waitForVisible('.s_InvD');
      },

      typeAndSubmitInvite: (emailAddress: string, ps: { numWillBeSent?: number } = {}) => {
        this.inviteDialog.typeInvite(emailAddress);
        this.inviteDialog.clickSubmit();
        if (ps.numWillBeSent !== undefined) {
          this.inviteDialog.waitForCorrectNumSent(ps.numWillBeSent);
        }
        this.inviteDialog.closeResultsDialog();
      },

      typeInvite: (emailAddress: string) => {
        this.waitAndSetValue('.s_InvD textarea', emailAddress, { maybeMoves: true });
      },

      clickSubmit: () => {
        this.waitAndClick('.s_InvD .btn-primary');
      },

      cancel: () => {
        this.waitAndClick('.s_InvD .e_Cncl');
      },

      waitForCorrectNumSent: (num: number) => {
        this.waitForVisible('.e_Invd-' + num);
      },

      assertAlreadyJoined: (emailAddr: string) => {
        this.waitForVisible('.e_InvJoind');
        assert.equal(this.count('.e_InvJoind li'), 1);
        assert.equal(this.waitAndGetVisibleText('.e_InvJoind li'), emailAddr);
      },

      assertAlreadyInvited: (emailAddr: string) => {
        this.waitForVisible('.e_InvRtr');
        assert.equal(this.count('.e_InvRtr li'), 1);
        assert.equal(this.waitAndGetVisibleText('.e_InvRtr li'), emailAddr);
      },

      closeResultsDialog: () => {
        this.waitAndClick('.s_InvSentD .e_SD_CloseB', { maybeMoves: true });
      },

      isInviteAgainVisible: (): boolean => {
        this.waitForVisible('.s_InvD .btn-primary');
        return this.isVisible('.e_InvAgain');
      }
    };


    invitedUsersList = {
      invitedUserSelector: '.e_Inv_U',

      waitUntilLoaded: () => {
        // When this elem present, any invited-users-data has also been loaded.
        this.waitForExist('.s_InvsL');
      },

      setHideOld: (value: boolean) => {
        this.setCheckbox('.e_OnlPend input', value);
      },

      setShowOnePerUserOnly: (value: boolean) => {
        this.setCheckbox('.e_OnePerP input', value);
      },

      assertHasAcceptedInvite: (username: string) => {
        this.assertAnyTextMatches(this.invitedUsersList.invitedUserSelector, username);
      },

      assertHasNotAcceptedInvite: (username: string) => {
        this.assertNoTextMatches(this.invitedUsersList.invitedUserSelector, username);
      },

      waitAssertInviteRowPresent: (index: number, opts: {
            email: string, accepted?: boolean, acceptedByUsername?: string, sentByUsername?: string,
            deleted?: boolean }) => {

        dieIf(opts.accepted === false && !_.isUndefined(opts.acceptedByUsername), 'TyE06WKTJ3');
        dieIf(
            _.isUndefined(opts.deleted) &&
            _.isUndefined(opts.accepted) &&
            _.isUndefined(opts.acceptedByUsername), 'TyE502RKDL24');

        this.waitForAtLeast(index, '.s_InvsL_It');
        this.assertNthTextMatches('.e_Inv_Em', index, opts.email);
        if (opts.accepted === false) {
          this.assertNthTextMatches('.e_Inv_U', index, /^$/);
        }
        if (opts.deleted) {
          this.assertNthClassIncludes('.s_InvsL_It', index, 's_InvsL_It-Dd');
        }
        if (opts.acceptedByUsername) {
          this.assertNthTextMatches('.e_Inv_U', index, opts.acceptedByUsername);
        }
        if (opts.sentByUsername) {
          this.assertNthTextMatches('.e_Inv_SentByU', index, opts.sentByUsername);
        }
      },

      countNumInvited: (): number =>
        this.$$('.s_InvsL_It').length,
    };


    apiV0 = {
      loginWithSecret: (ps: { origin: string, oneTimeSecret: string, thenGoTo: string }): void => {
        this.go(ps.origin +
            `/-/v0/login-with-secret?oneTimeSecret=${ps.oneTimeSecret}&thenGoTo=${ps.thenGoTo}`);
      },
    };


    unsubscribePage = {
      confirmUnsubscription: () => {
        this.rememberCurrentUrl();
        this.waitAndClick('input[type="submit"]');
        this.waitForNewUrl();
        this.waitForDisplayed('#e2eBeenUnsubscribed');
      },
    };


    changePasswordDialog = {
      clickYesChange: () => {
        this.waitAndClick('.esStupidDlg .btn-primary');
      },
    };


    notfLevelDropdown = {
      clickNotfLevel: (notfLevel: PageNotfLevel) => {
        switch (notfLevel) {
          case c.TestPageNotfLevel.EveryPost:
            this.waitAndClick('.e_NtfAll');
            this.waitForGone('.e_NtfAll');
            break;
          case c.TestPageNotfLevel.TopicProgress:
            die('unimpl');
            break;
          case c.TestPageNotfLevel.TopicSolved:
            die('unimpl');
            break;
          case c.TestPageNotfLevel.NewTopics:
            this.waitAndClick('.e_NtfFst');
            this.waitForGone('.e_NtfFst');
            break;
          case c.TestPageNotfLevel.Tracking:
            die('unimpl');
            break;
          case c.TestPageNotfLevel.Normal:
            this.waitAndClick('.e_NtfNml');
            this.waitForGone('.e_NtfNml');
            break;
          case c.TestPageNotfLevel.Hushed:
            this.waitAndClick('.e_NtfHsh');
            this.waitForGone('.e_NtfHsh');
            break;
          case c.TestPageNotfLevel.Muted:
            this.waitAndClick('.e_NtfMtd');
            this.waitForGone('.e_NtfMtd');
            break;
          default:
            die('e2e bug');
        }
      },
    };


    shareDialog = {
      copyLinkToPost: () => {  // RENAME, append:  ...ToClipboard
        this.waitAndClick('.s_ShareD_Link');
      },

      getLinkUrl: (): St => {
        return this.waitAndGetValue('.s_ShareD_Link');
      },

      close: () => {
        this.waitAndClick('.esDropModal_CloseB');  // currently not inside .s_ShareD
      }
    };


    movePostDialog = {
      moveToOtherSection: () => {
        this.waitAndClick('.s_MPD_OtrSct .btn');
        this.waitAndClick('.esStupidDlg a');
      },

      pastePostLinkMoveToThere: () => {
        this.waitAndPasteClipboard('#te_MvPI');
        this.waitAndClick('.e_MvPB');
      }
    };


    editHistoryDialog = {
      close: () => {
        this.waitAndClick('.dw-edit-history .modal-footer .btn');
        this.waitUntilGone('.dw-edit-history');
      },

      countDiffs: (): number => {
        return this.count('.dw-edit-history pre');
      },

      waitUntilVisible: () => {
        this.waitForVisible('.dw-edit-history');
        this.waitUntilDoesNotMove('.dw-edit-history');
      },

      waitGetAuthorAndDiff: (editEntryNr: number): EditHistoryEntry => {
        dieIf(editEntryNr < 1, "First edit diff entry is nr 1, not 0 [TyE20KGUTf06]");
        // Nr 1 is a help text, nr 2 is the first diff entry — so add +1.
        const selector =
            `.dw-edit-history .modal-body > div > .ed-revision:nth-child(${editEntryNr + 1})`;
        this.waitForDisplayed(selector);
        const authorUsername = this.waitAndGetVisibleText(selector + ' .dw-username');
        const diffHtml = this.$(selector + ' pre').getHTML();
        return {
          authorUsername,
          diffHtml,
        }
      },
    };


    notFoundDialog = {
      waitAndAssertErrorMatches: (regex: St | RegExp, ifDevRegex?: St | RegExp) => {
        this.waitAndAssertVisibleTextMatches('body > pre', regex);
        if (!settings.prod && ifDevRegex) {
          this.waitAndAssertVisibleTextMatches('body > pre', ifDevRegex);
        }
      },

      clickHomeLink: () => {
        this.waitAndClick('.s_LD_NotFound_HomeL');
      }
    };


    serverErrorDialog = {
      isDisplayed: (): boolean => {
        return this.isVisible('.s_SED_Msg');
      },

      failTestAndShowDialogText: () => {
        tyAssert.ok(this.serverErrorDialog.isDisplayed());
        const title = this.waitAndGetText('.s_SED_Ttl');
        const text = this.$('.s_SED_Msg').getHTML();
        console.trace();
        assert.fail(
            `Unexpected error dialog: [TyEERRDLG]\n` +
            `title:  ${title}\n` +
            `text: --------------------------------------------------------------\n` +
            `${text}\n` +
            `--------------------------------------------------------------------\n`);
      },

      waitForNotLoggedInError: () => {
        this.waitUntilTextMatches('.s_SED_Msg', 'TyE0LGDIN_');
      },

      waitForNotLoggedInAsAdminError: () => {
        this.waitUntilTextMatches('.s_SED_Msg', 'TyE0LGIADM_');
      },

      waitForJustGotSuspendedError: () => {
        this.waitUntilTextMatches('.s_SED_Msg', 'TyESUSPENDED_|TyE0LGDIN_');
      },

      dismissReloadPageAlert: () => {
        // Seems this alert appears only in a visible browser (but not if invisible/headless).
        for (let i = 0; i < 3; ++i) {
          // Clicking anywhere triggers an alert about reloading the page, although has started
          // writing — because was logged out by the server (e.g. because user suspended)
          // and then som js tries to reload.
          this.$('.modal-body').click();
          const gotDismissed = this.dismissAnyAlert();
          if (gotDismissed) {
            logMessage("Dismissed got-logged-out but-had-started-writing related alert.");
            return;
          }
        }
        logMessage("Didn't get any got-logged-out but-had-started-writing related alert.");
      },

      waitAndAssertTextMatches: (regex: St | RegExp, ifDevRegex?: St | RegExp) => {
        this.waitAndAssertVisibleTextMatches('.s_SED_Msg', regex);
        if (!settings.prod && ifDevRegex) {
          this.waitAndAssertVisibleTextMatches('.s_SED_Msg', ifDevRegex);
        }
      },

      waitForBadEmailAddressError: () => {
        this.waitUntilTextMatches('.s_SED_Msg', 'TyEBADEMLADR_');
      },

      waitForBadEmailDomainError: () => {
        // Sometimes there's this error:
        //   stale element reference: element is not attached to the page document
        // Why? Maybe there's another dialog .modal-body that fades away and disappears
        // before the server error dialog's .modal-body appears?
        utils.tryManyTimes("waitForBadEmailDomainError", 2, () => {
          this.waitUntilTextMatches('.s_SED_Msg', 'TyEBADEMLDMN_');
        });
      },

      waitForTooManyInvitesError: () => {
        this.waitUntilTextMatches('.s_SED_Msg', 'TyETOOMANYBULKINV_');
      },

      waitForTooManyInvitesLastWeekError: () => {
        this.waitUntilTextMatches('.s_SED_Msg', 'TyINVMANYWEEK_');
      },

      waitForXsrfTokenExpiredError: () => {
        this.waitUntilTextMatches('.s_SED_Msg', 'TyEXSRFEXP_');
      },

      waitForIsRegistrationSpamError: () => {
        // The //s regex modifier makes '.' match newlines. But it's not available before ES2018.
        this.serverErrorDialog.waitAndAssertTextMatches(/spam.*TyEPWREGSPM_/s);
      },

      waitForFirstPostsNotApproved: () => {
        this.serverErrorDialog.waitAndAssertTextMatches(/approv.*_EsE6YKF2_/);
      },

      waitForTooManyPendingApproval: () => {
        this.serverErrorDialog.waitAndAssertTextMatches(/approv.*TyE2MNYPNDAPR_/);
      },

      waitForTooManyPendingReview: () => {
        this.serverErrorDialog.waitAndAssertTextMatches(/review.*TyE2MNYPNDRVW_/);
      },

      waitForTooManyPendingMaybeSpamPostsError: () => {
        // The //s regex modifier makes '.' match newlines. But it's not available before ES2018.
        this.serverErrorDialog.waitAndAssertTextMatches(/spam.*TyENEWMBRSPM_/s);
      },

      waitForCannotReplyPostDeletedError: () => {
        this.serverErrorDialog.waitAndAssertTextMatches(/has been deleted.*TyEM0REPLY_/s);
      },

      close: () => {
        this.waitAndClick('.e_SED_CloseB');
        this.waitUntilGone('.dw-server-error .modal-dialog');
      }
    };

    tour = {
      runToursAlthoughE2eTest: () => {
        this.#br.execute(function() {
          localStorage.setItem('runToursAlthoughE2eTest', 'true');
        });
      },

      assertTourStarts: (shallStart: boolean) => {
        // Wait for the tour to appear. (There's no other way to do that right now,
        // than just waiting for a while. It appears within about a second.
        // Note that this is also used to test that the tour *does* appear fast enough,
        // not only that it does *not* appear — to test, that this test, works.)
        this.waitUntil(() => this.isVisible('.s_Tour'), {
          timeoutMs: 3500,
          timeoutIsFine: true,
          message: `Will the intro tour start? ...`,
        });
        assert.equal(this.isVisible('.s_Tour'), shallStart);
      },

      clickNextForStepNr: (stepNr: number) => {
        // Don't scroll — the tour will scroll for us. (Scrolling here too, could scroll
        // too much, and the click might fail.)
        this.waitAndClick(`.s_Tour-Step-${stepNr} .s_Tour_D_Bs_NextB`, { mayScroll: false });
      },

      exitTour: () => {
        this.waitAndClick(`.s_Tour_D_Bs_ExitB`, { mayScroll: false });
      },
    };

    helpDialog = {
      waitForThenClose: (ps: { shallHaveBodyClass?: St } = {}) => {
        if (ps.shallHaveBodyClass) {
          this.waitForDisplayed(`.esHelpDlg ${ps.shallHaveBodyClass}`);
        }
        this.waitAndClick('.esHelpDlg .btn-primary');
        this.waitUntilModalGone();
      },
    };

    // REFACTOR  MOVE all these fns to the contexts where they can be called?
    // so autocomplete can be used
    complex = {
      waitUntilLoggedIn: () => {   // RENAME  use me.waitUntilLoggedIn()  instead
        this.waitUntil(() => {
          return this.#br.execute(function() {
            try {
              return window['debiki2'].ReactStore.getMe().isLoggedIn;
            }
            catch {
              return false;
            }
          });
        }, {
          message: `Waiting for theStore.me  TyT6503MES633`
        });

        if (this.metabar.isVisible()) {
          // Extra test, if in embedded comments iframe:
          this.metabar.waitUntilLoggedIn();
        }
        else if (this.topbar.isVisible()) {
          // Extra test, if on topic list pages or discussion pages, but not comments iframes:
          this.topbar.waitForMyMenuVisible();
        }
        else if (false) {  // if is in editor iframe
          // then what?
        }
      },


      waitForLoggedInInEmbeddedCommentsIrames: () => {
        this.switchToEmbeddedCommentsIrame();
        this.complex.waitUntilLoggedIn();
        this.switchToEmbeddedEditorIrame();
        this.complex.waitUntilLoggedIn();
        this.switchToAnyParentFrame();
      },

      waitForNotLoggedInInEmbeddedCommentsIframe: (
              ps: { willBeLoginBtn?: false } = {}) => {
        this.switchToEmbeddedCommentsIrame();
        this.waitForMyDataAdded();
        if (ps.willBeLoginBtn !== false) {
          this.metabar.waitForLoginButtonVisible();  // ok? or is this a race?
        }
        else {
          // Could do always, but looking for the login button (above) is enough.
          const me = this.me.waitAndGetMyself();
          tyAssert.not(me.isLoggedIn);
          tyAssert.not(me.id);
        }
        this.switchToAnyParentFrame();
      },

      loginWithPasswordViaTopbar: (username: string | Member | { username, password },
            optsOrPassword?: string | { resultInError?: boolean }) => {
        let password = optsOrPassword;
        let opts;
        console.log(`TyE2eApi: loginWithPasswordViaTopbar`);
        if (password && _.isObject(password)) {
          opts = <any> password;
          password = null;
        }
        this.topbar.clickLogin();
        const credentials = _.isObject(username) ?  // already { username, password } object
            username : { username: username, password: password };
        this.loginDialog.loginWithPassword(credentials, opts || {});
      },

      signUpAsMemberViaTopbar: (
            member: Member | { emailAddress: string, username: string, password: string }) => {
        this.topbar.clickSignUp();
        this.loginDialog.createPasswordAccount({
          username: member.username,
          emailAddress: member.emailAddress,
          password: member.password,
          willNeedToVerifyEmail: false,
        });
      },

      signUpAsGuestViaTopbar: (nameOrObj: string | { fullName, emailAddress }, email?: string) => {
        this.disableRateLimits();
        this.topbar.clickSignUp();
        let name: string;
        if (_.isObject(nameOrObj)) {
          assert(!email);
          name = nameOrObj.fullName;
          email = nameOrObj.emailAddress;
        }
        else {
          name = nameOrObj;
        }
        this.loginDialog.signUpAsGuest(name, email);
      },

      signUpAsGmailUserViaTopbar: ({ username }) => {
        this.disableRateLimits();
        this.topbar.clickSignUp();
        this.loginDialog.createGmailAccount({
            email: settings.gmailEmail, password: settings.gmailPassword, username });
      },

      logInAsGuestViaTopbar: (nameOrObj: string | { fullName, emailAddress }, email?: string) => {
        this.topbar.clickLogin();
        let name: string;
        if (_.isObject(nameOrObj)) {
          assert(!email);
          name = nameOrObj.fullName;
          email = nameOrObj.emailAddress;
        }
        else {
          name = nameOrObj;
        }
        this.loginDialog.logInAsGuest(name, email);
      },

      loginIfNeededViaMetabar: (ps: NameAndPassword) => {
        this.switchToEmbCommentsIframeIfNeeded();
        this.waitForMyDataAdded();
        if (!this.metabar.isLoggedIn()) {
          logMessage(`Need to log in, as @${ps.username
                } — session id cookie blocked? [TyM306MRKTJ]`);
          this.complex.loginWithPasswordViaMetabar(ps);
        }
      },

      loginWithPasswordViaMetabar: (ps: NameAndPassword) => {
        this.metabar.clickLogin();
        this.loginDialog.loginWithPasswordInPopup(ps);
      },

      snoozeNotifications: (ps: SnoozeTime = {}) => {
        this.topbar.openMyMenu();
        this.topbar.myMenu.snoozeNotfs(ps);
      },

      unsnoozeNotifications: () => {
        this.topbar.openMyMenu();
        this.topbar.myMenu.unsnooze();
      },

      closeSidebars: () => {
        if (this.isVisible('#esWatchbarColumn')) {
          this.watchbar.close();
        }
        if (this.isVisible('#esThisbarColumn')) {
          this.contextbar.close();
        }
      },

      createCategory: (ps: { name: string, extId?: string }) => {
        this.forumButtons.clickCreateCategory();
        this.categoryDialog.fillInFields(ps);
        this.categoryDialog.submit();
      },

      createAndSaveTopic: (data: { title: string, body: string, type?: PageRole,
            willBePendingApproval?: boolean,
            matchAfter?: boolean, titleMatchAfter?: string | false,
            bodyMatchAfter?: string | false, resultInError?: boolean }) => {
        this.forumButtons.clickCreateTopic();
        this.editor.editTitle(data.title);
        this.editor.editText(data.body);
        if (data.type) {
          this.editor.setTopicType(data.type);
        }
        this.complex.saveTopic(data);
      },

      saveTopic: (data: { title: St, body?: St, type?: PageRole,
            willBePendingApproval?: Bo,
            matchAfter?: Bo, titleMatchAfter?: St | false,
            bodyMatchAfter?: St | false, resultInError?: Bo }) => {
        this.rememberCurrentUrl();
        this.editor.save();
        if (!data.resultInError) {
          this.waitForNewUrl();
          if (data.willBePendingApproval) {
            this.waitForVisible('.dw-p-ttl .esPendingApproval');
            this.waitForVisible('.dw-ar-t .esPendingApproval');
          }

          // Only in the title text, not body text.
          const titlePend = data.willBePendingApproval ? "Page pending approval\n" : '';

          if (data.matchAfter !== false && data.titleMatchAfter !== false) {
            // if (data.titleMatchAfter)
            this.assertPageTitleMatches(data.titleMatchAfter || data.title);
            if (!data.titleMatchAfter) {
              this.topic.assertPostTextIs(c.TitleNr, titlePend + data.title);
            }
          }

          if (!data.body && !data.bodyMatchAfter) {
            // Noop. Nothing to compare the new topic Orig Post with.
          }
          else if (data.matchAfter !== false && data.bodyMatchAfter !== false) {
            if (data.type === c.TestPageRole.OpenChat) {
              // Then there's no page body, insetad:
              this.chat.waitAndAssertPurposeIs(data.body);
            }
            else {
              this.assertPageBodyMatches(data.bodyMatchAfter || data.body);
              if (!data.bodyMatchAfter) {
                this.topic.assertPostTextIs(c.BodyNr, data.body);
              }
            }
          }
        }
        this.waitUntilLoadingOverlayGone();
      },

      editPageTitle: (newTitle: string) => {
        this.pageTitle.clickEdit();
        this.pageTitle.editTitle(newTitle);
        this.pageTitle.save();
        this.topic.waitUntilPostTextMatches(c.TitleNr, newTitle);
        this.assertPageTitleMatches(newTitle);
      },

      editPageBody: (newText: string, opts: { append?: Bo, textAfterIs?: St,
              textAfterMatches?: St } = {}) => {
        this.topic.clickEditOrigPost();
        this.editor.editText(newText, opts);
        this.editor.save();
        if (opts.textAfterMatches || opts.textAfterIs) {
          if (opts.textAfterMatches) {
            this.topic.waitUntilPostTextMatches(c.BodyNr, opts.textAfterMatches);
          }
          if (opts.textAfterIs) {
            this.topic.waitUntilPostTextIs(c.BodyNr, opts.textAfterIs);
            this.topic.assertPostTextIs(c.BodyNr, newText);  // why this too?
          }
        }
        else if (opts.append) {
          this.topic.waitUntilPostTextMatches(c.BodyNr, newText);  // includes!
          this.assertPageBodyMatches(newText);  // includes!
        }
        else {
          this.topic.waitUntilPostTextIs(c.BodyNr, newText);
          this.topic.assertPostTextIs(c.BodyNr, newText);  // why this too?
        }
      },

      editPostNr: (postNr: PostNr, newText: string, opts: { append?: boolean } = {}) => {
        this.topic.clickEditoPostNr(postNr);
        this.editor.editText(newText, opts);
        this.editor.save();
        this.topic.waitUntilPostTextMatches(postNr, newText);
      },

      replyToOrigPost: (text: string, whichButton?: 'DiscussionSection') => {
        this.topic.clickReplyToOrigPost(whichButton);
        this.editor.editText(text);
        this.editor.save();
      },

      replyToEmbeddingBlogPost: (text: string,
            opts: { signUpWithPaswordAfterAs?, needVerifyEmail?: boolean } = {}) => {
        // Apparently, if FF cannot click the Reply button, now when in an iframe,
        // then FF says "all fine I clicked the button", but in fact does nothing,
        // also won't log any error or anything, so that later on, we'll block
        // forever when waiting for the editor.
        // So sometimes this neeeds to be in a retry loop, + timeoutMs below. [4RDEDA0]
        this.switchToEmbeddedCommentsIrame();
        logMessage("comments iframe: Clicking Reply ...");
        this.topic.clickReplyToEmbeddingBlogPost();
        //if (opts.loginWithPaswordBeforeAs) {
          //this.loginDialog.loginWithPasswordInPopup(opts.loginWithPaswordBeforeAs);
        //}
        this.switchToEmbeddedEditorIrame();
        logMessage("editor iframe: Composing a reply ...");
        // Previously, before retrying scroll-to-top, this could hang forever in FF.
        // Add a timeout here so the retry (see comment above) will work.
        this.editor.editText(text, { timeoutMs: 3000 });
        logMessage("editor iframe: Saving ...");
        this.editor.save();

        if (opts.signUpWithPaswordAfterAs) {
          logMessage("editor iframe: Switching to login popup to log in / sign up ...");
          this.swithToOtherTabOrWindow();
          this.disableRateLimits();
          this.loginDialog.createPasswordAccount(
              opts.signUpWithPaswordAfterAs, false,
              opts.needVerifyEmail === false ? 'THERE_WILL_BE_NO_VERIFY_EMAIL_DIALOG' : null);
          this.switchBackToFirstTabOrWindow();
        }

        logMessage("editor iframe: Done.");
        this.switchToEmbeddedCommentsIrame();
      },

      addProgressReply: (text: string) => {
        this.topic.clickAddProgressReply();
        this.editor.editText(text);
        this.editor.save();
      },

      replyToPostNr: (postNr: PostNr, text: string, opts: { isEmbedded?: true } = {}) => {
        if (opts.isEmbedded) this.switchToEmbeddedCommentsIrame();

        // Sometimes the click fails — maybe a sidebar opens, making the button move a bit? Or
        // the window scrolls, making the click miss? Or whatever. If the click misses the
        // button, most likely, the editor won't open. So, if after clicking, the editor
        // won't appear, then click again.
        this.topic.waitForPostNrVisible(postNr);
        this.#br.pause(50); // makes the first click more likely to succeed (without,
        // failed 2 times out of 4 at a place in unsubscribe.2browsers.test.ts — but with,
        // failed 2 times out of 20).
        for (let clickAttempt = 0; true; ++clickAttempt) {
          this.topic.clickReplyToPostNr(postNr);
          try {
            if (opts.isEmbedded) this.switchToEmbeddedEditorIrame();
            this.waitForVisible('.esEdtr_textarea', { timeoutMs: 5000 });
            break;
          }
          catch (ignore) {
            logUnusual("When clicking the Reply button, the editor didn't open. Trying again");
            dieIf(clickAttempt === 3, "Couldn't click Reply and write a reply [EdE7FKAC2]");
            if (opts.isEmbedded) this.switchToEmbeddedCommentsIrame();
          }
        }
        this.editor.editText(text);
        this.editor.save();
        if (opts.isEmbedded) this.switchToEmbeddedCommentsIrame();
      },

      flagPost: (postNr: PostNr, reason: 'Inapt' | 'Spam') => {
        this.topic.clickFlagPost(postNr);
        this.flagDialog.waitUntilFadedIn();
        if (reason === 'Inapt') {
          this.flagDialog.clickInappropriate();
        }
        else {
          die('Test code bug, only Inapt implemented in tests, yet [EdE7WK5FY0]');
        }
        this.flagDialog.submit();
        this.stupidDialog.close();
      },

      openPageAuthorProfilePage: () => {
        logMessage(`Open about author dialog...`);
        this.pageTitle.openAboutAuthorDialog();
        logMessage(`Click view profile...`);
        this.aboutUserDialog.clickViewProfile();
      },

      sendMessageToPageAuthor: (messageTitle: string, messageText: string) => {
        logMessage(`Opens page author's About dialog...`);
        this.pageTitle.openAboutAuthorDialog();
        this.complex.__sendMessageImpl(messageTitle, messageText);
      },

      sendMessageToPostNrAuthor: (postNr: PostNr, messageTitle: string, messageText: string) => {
        logMessage(`Opens post nr ${postNr} author's About dialog ...`);
        this.topic.openAboutUserDialogForPostNr(postNr);
        this.complex.__sendMessageImpl(messageTitle, messageText);
      },

      __sendMessageImpl: (messageTitle: string, messageText: string) => {
        logMessage(`Click Send Message...`);
        this.aboutUserDialog.clickSendMessage();
        logMessage(`Edit message title...`);
        this.editor.editTitle(messageTitle);
        logMessage(`Edit message text...`);
        this.editor.editText(messageText);
        logMessage(`Submit...`);
        this.editor.saveWaitForNewPage();
        logMessage(`Done, now at new page: ${this.urlPath()}`);
      },

      createChatChannelViaWatchbar: (
            data: { name: string, purpose: string, public_?: boolean }) => {
        this.watchbar.clickCreateChatWaitForEditor();
        this.editor.editTitle(data.name);
        this.editor.editText(data.purpose);
        if (data.public_ === false) {
          this.editor.setTopicType(c.TestPageRole.PrivateChat);
        }
        this.rememberCurrentUrl();
        this.editor.save();
        this.waitForNewUrl();
        this.assertPageTitleMatches(data.name);
      },

      addPeopleToPageViaContextbar: (usernames: string[]) => {
        this.contextbar.clickAddPeople();
        _.each(usernames, this.addUsersToPageDialog.addOneUser);
        this.addUsersToPageDialog.submit({ closeStupidDialogAndRefresh: true });
        _.each(usernames, this.contextbar.assertUserPresent);
      }
    }


  setCheckbox(selector: string, checked: boolean, opts: WaitAndClickPs = {}) {
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
    //   #sendSummaryEmails is checked: false      this.#br, no real mouse interactions possible)
    // So need to loop, ... until it stops undoing the click? Really weird.
    //
    // Update 2020-11-28:  Seems the problem was that for fractions of a second,
    // the UI still showed the previous user profile & settings, when switching
    // to a new user — before the new one had been loaded. [pat_prof_fields]
    // DO_AFTER 2021-03-01 REMOVE all weird stuff here (i.e. "Somehow once ... " below).
    //
    this.waitForVisible(selector, opts);
    let bugRetry = 0;
    const maxBugRetry = 2;
    for (; bugRetry <= maxBugRetry; ++bugRetry) {
      logMessage(selector + ' is visible, should be checked: ' + checked);
      for (let i = 0; i < 99; ++i) {
        let isChecked = this.$(selector).isSelected();
        logMessage(selector + ' is checked: ' + isChecked);
        if (isChecked === checked)
          break;
        this.waitAndClick(selector, opts);
        logMessage(selector + ' **click**');
      }
      // Somehow once this function exited with isChecked !== isRequired. Race condition?
      // Let's find out:
      let isChecked = this.$(selector).isSelected();
      let was = isChecked;
      logMessage(selector + ' is checked: ' + isChecked);
      this.#br.pause(300);
      isChecked = this.$(selector).isSelected();
      logMessage(selector + ' is checked: ' + isChecked);
      if (was !== isChecked) debugger;
      this.#br.pause(400);
      isChecked = this.$(selector).isSelected();
      /* maybe works better now? (many months later)
      logMessage(selector + ' is checked: ' + isChecked);
      if (was !== isChecked) debugger;
      this.#br.pause(500);
      isChecked = this.$(selector).isSelected();
      logMessage(selector + ' is checked: ' + isChecked);
      if (was !== isChecked) debugger;
      this.#br.pause(600);
      isChecked = this.$(selector).isSelected();
      logMessage(selector + ' is checked: ' + isChecked);
      if (was !== isChecked) debugger;
      this.#br.pause(700);
      isChecked = this.$(selector).isSelected();
      logMessage(selector + ' is checked: ' + isChecked);
      if (was !== isChecked) debugger; */
      if (isChecked === checked)
        break;
      logUnusual("Checkbox refuses to change state. Clicking it again.");
    }
    assert(bugRetry <= maxBugRetry, "Couldn't set checkbox to checked = " + checked);
  }
}

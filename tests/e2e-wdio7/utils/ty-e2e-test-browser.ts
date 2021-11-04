import * as _ from 'lodash';
import { IsWhere, isWhere_isInIframe } from '../test-types';
import { SiteType, NewSiteOwnerType } from '../test-constants';


// Why are many WebdriverIO's functions reimplemented here?
//
// Because the default ones are either 1) quiet, whilst waiting. No way to find out what's
// wrong, when a test times out. Or, 2) they log frustratingly much log messages, always,
// if you enable detailed log levels.
//
// Talkyards waitFor[Something](), though, logs nothing, *unless* after a short
// while Something hasn't happened. *Then* Talkyard starts logging what is
// being waited for. — More readable logs, when you need them.



// Assertions tests if Talkyard works, ...
import * as assert from 'assert';
import tyAssert from './ty-assert';

// ... Use die() and dieIf(), though, if an e2e test is broken
// (rather than Talkyard itself).
import { getOrCall, die, dieIf, logUnusual, logDebug, j2s,
    logError, logErrorNoTrace, logErrorIf,
    logWarning, logWarningIf,
    logException, logMessage, logMessageIf, logBoring,
    logServerRequest, printBoringToStdout } from './log-and-die';

import * as path from 'path';
import * as fs from 'fs';
import settings from './settings';
import server from './server';
import * as utils from '../utils/utils';
import c from '../test-constants';

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
type WElmArr = WebdriverIO.ElementArray;
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


async function tryOrIfWinCloses<R>(toTry: () => Pr<R>, ifWinCloses: R | U): Pr<R> {
  try {
    return await toTry();
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


// Later, change TyAllE2eTestBrowsers to a class / interface that
// only makes available the TyE2eTestBrowser methods that work with all
// browsers at once. (Like  allBrowsers.go(url) or
// allBrowsers.waitForVisible(a-new-reply)).
// But for now:
//
export type TyAllE2eTestBrowsers = TyE2eTestBrowser;


export class TyE2eTestBrowser {

  #br: WebdriverIOAsync.Browser;
  #name: St;

  constructor(aWdioBrowser: WebdriverIOAsync.Browser, name: 'brA' | 'brB' | 'brC' | 'brAll') {
    dieIf(!aWdioBrowser?.getPageSource,
        `Error creating Wdio browser '${name}', this is not a browser: ${
                JSON.stringify(aWdioBrowser)}  [TyE2E7J02SAD35]`
        + (name === 'brAll' ? '' :
            "\n\nTo use more than one browser, be sure to include '2br' or '3br' etc " +
            "when you type the test file name\n— otherwise just 1 browser gets created; " +
            "the other ones would be undefined"));
    this.#br = aWdioBrowser;
    this.#name = name;
  }

  async reloadSession(ps: { andGoTo?: St } = {}) {
    const whereToday = ps.andGoTo || await this.getUrl();
    await this.#br.reloadSession();
    await this.go2(whereToday);
  }

  // The global $ might be for the wrong this.#br somehow, so:

  async $(selector: St | Function | object): Pr<WElm> {
    // Webdriver doesn't show the bad selector in any error message.
    dieIf(!_.isString(selector),
          `Selector is not a string: ${typeAndAsString(selector)}  [TyEE2E506QKSG35]`);
    try {
      return await this.#br.$(selector);
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

  async $$(selector: St | Function): Pr<WebdriverIO.ElementArray> {
    dieIf(!_.isString(selector),
        `Selector is not a string: ${typeAndAsString(selector)}  [TyEE2E702RMJ40673]`);
    return await this.#br.$$(selector);
  }

  // This is short and nice, when debugging via log messages.
  l = logDebug as ((any) => void);

    // Short and nice.
  async d(anyMessage?: string | number | (() => string)) {
    if (_.isFunction(anyMessage)) anyMessage = anyMessage();
    if (anyMessage) logUnusual('' + anyMessage);
    await this.#br.debug();
  }

  #firstWindowHandle;
  #hostsVisited = {};
  #isWhere: IsWhere | U;
  #isOnEmbeddedCommentsPage = false;
  #useCommentsIframe: { discussionId: St } | U;

  isOnEmbeddedPage(): boolean {
    return this.#isWhere && IsWhere.EmbFirst <= this.#isWhere && this.#isWhere <= IsWhere.EmbLast;
  }


    async debug() {
      if (!settings.noDebug) { // doesn't seem to work, why not?
        await this.#br.debug();
      }
    }

    async origin(): Pr<St> {
      return await this._findOrigin();
    }

    // (Cannot replace this.#br.getUrl() — it's read-only.)
    async getUrl(): Pr<St> {
      const url = await this.#br.getUrl();
      dieIf(url.indexOf('chrome-error:') >= 0,  // wasn't matched here, although present, weird.
          `You forgot to start an e2e test help server?  [TyENOHELPSRVR]`);
      return url;
    }

    async waitUntilUrlIs(expectedUrl: St) {
      let urlNow: St;
      await this.waitUntil(async () => {
        urlNow = await this.getUrl();
        return urlNow === expectedUrl;
      }, {
        message: () => `Waiting for url: ${expectedUrl}  currently: ${urlNow}`,
      });
    }

    /** @deprecated */
    getSource = async (): Pr<St> => await this.#br.getPageSource();  // backw compat
    getPageSource = async (): Pr<St> => await this.#br.getPageSource();

    async host(): Pr<St> {
      const origin = await this.origin();
      return origin.replace(/https?:\/\//, '');
    }

    async _findOrigin(anyUrl?: St): Pr<St> {
      const url = anyUrl || await this.#br.getUrl();
      const matches = url.match(/(https?:\/\/[^\/]+)\//);
      if (!matches) {
        throw Error(`No_origin_ in url: ${url}  (anyUrl: ${anyUrl})`);
      }
      return matches[1];
    }

    async urlNoHash(): Pr<St> {
      return (await this.#br.getUrl()).replace(/#.*$/, '');;
    }

    async urlPathQueryHash(): Pr<St> {
      return await this.#br.execute(function() {
        return location.pathname + location.search + location.hash;
      });
    }

    async urlPath(): Pr<St> {
      return await this.#br.execute(function() {
        return location.pathname;
      });
    }

    async deleteCookie(cookieName: string) {
      await this.#br.deleteCookie(cookieName);
    }

    async deleteAllCookies() {
      await this.#br.deleteAllCookies();
    }

    async execute<T>(script: ((...args: any[]) => T), ...args: any[]): Pr<T> {
      return await this.#br.execute.apply(this.#br, arguments);
    }

    async executeAsync<T>(script: ((...args: any[]) => T), ...args: any[]): Pr<T> {
      return await this.#br.executeAsync.apply(this.#br, arguments);
    }

    async refresh() {
      await this.#br.refresh();
    }

    // Change all refresh() to refresh2, then remove '2' from name.
    // (Would need to add  waitForPageType: false  anywhere? Don't think so?)
    async refresh2(ps: { isWhere?: IsWhere } = {}) {
      await this.#br.refresh();
      if (ps.isWhere) {
        dieIf(isWhere_isInIframe(ps.isWhere),
              `Cannot be in iframe directly after page reload [TyE507MEW2]`);
        this.#isWhere = ps.isWhere;
      }
      else await this.__updateIsWhere();
    }

    async back() {
      await this.#br.back();
    }


    async newWindow(url: St, thenWhat: 'StayInCurWin' | 'SwitchToNewWin') {
      // It seemed as if different drivers had different opinions about which
      // window should be active, after having opened a new one.
      // DevTools seemed to stay in the orig win (2020-11-19) — or was I mistaken,
      // now it, like Selenium, switches to the new win.
      // The docs says the new win becomes active.
      // Anyway, the below code works reardless of what the drivers do.
      const curWinHandle = await this.#br.getWindowHandle();
      const handlesBefore: St[] = await this.#br.getWindowHandles();

      await this.#br.newWindow(url);

      const handlesAfter: St[] = await this.#br.getWindowHandles();
      const newCurHandle = await this.#br.getWindowHandle();
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
        await this.#br.switchToWindow(switchToWhat);
        logMessage(`Switched to ${switchToWhat}.`);
        const handleNow = await this.#br.getWindowHandle();
        dieIf(switchToWhat != handleNow,
              `Wrong handle after: ${handleNow} [TyE305MRKTM2]`);
      }
    }


    // Don't use. Change to go2 everywhere, then rename to 'go', and remove this old 'go'.
    async go(url: string, opts: { useRateLimits?: boolean } = {}) {
      await this.go2(url, { ...opts, waitForPageType: false });
    }

    async go2(url: string, opts: { useRateLimits?: boolean, waitForPageType?: false,
          isExternalPage?: true, willBeWhere?: IsWhere } = {}) {

      let shallDisableRateLimits = false;

      this.#firstWindowHandle = await this.#br.getWindowHandle();

      if (url[0] === '/') {
        // Local url, need to add origin.

        // Backw compat: wdio v4 navigated relative the top frame (but wdio v6 doesn't).
        await this.switchToAnyParentFrame();

        try { url = await this._findOrigin() + url; }
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
        await this.#br.navigateTo(url);
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
        await this.__updateIsWhere();
      }


      if (shallDisableRateLimits) {
        await this.disableRateLimits();
      }
    }


    isWhere(): IsWhere { return this.#isWhere }


    async updateIsWhere() {
      await this.__updateIsWhere();
    }


    async __updateIsWhere() {
      // .DW = discussion / topic list page.  .btn = e.g. a Continue-after-having-verified
      // -one's-email-addr page.
      // ('ed-comments' is old, deprecated, class name.)
      await this.waitForExist('.DW, .talkyard-comments, .ed-comments, .btn');
      this.#isOnEmbeddedCommentsPage =
          await (await this.$('.talkyard-comments')).isExisting() ||
          await (await this.$('.ed-comments')).isExisting();
      this.#isWhere = this.#isOnEmbeddedCommentsPage ? IsWhere.EmbeddingPage : IsWhere.Forum;
    }


    async goAndWaitForNewUrl(url: St) {
      logMessage("Go: " + url);
      await this.rememberCurrentUrl();
      await this.#br.url(url);
      await this.waitForNewUrl();
    }


    async disableRateLimits() {
      // Old, before I added the no-3rd-party-cookies tests.
      // Maybe instead always: server.skipRateLimits(siteId)  ?
      await this.#br.execute(function(pwd) {
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


    async pause(millis: number) {
      logBoring(`Pausing ${millis} ms...`);
      await this.#br.pause(millis);
    }


    // The real waitUntil doesn't work, the first test makes any  $('sth')
    // inside be just an empty obj {}.  — Mabe I forgot 'this'? Should be: this.$().
    // Anyway, this wait fn logs a message about what we're waiting for, can be nice.
    //
    // Returns true iff the event / condition happened, that is, if fn()
    // returned true before timeout.
    //
    async waitUntil(fn: () => Pr<Bo>, ps: WaitPs = {}): Pr<Bo> {

      let delayMs = PollMs;
      let elapsedMs = 0;
      const timeoutMs = makeTimeoutMs(ps.timeoutMs);
      const startMs = Date.now();
      let loggedAnything = false;
      let loggedError = false;
      const getMsg = () => getOrCall(ps.message) || "Waiting for something";

      try {
        do {
          const done = await fn();
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
          if (elapsedMs > 500 && !await waitingForServerError()
                && !ps.serverErrorDialogIsFine) {
            if (await this.serverErrorDialog.isDisplayed()) {
              loggedError = true;
              await this.serverErrorDialog.failTestAndShowDialogText();
            }
          }

          if (ps.refreshBetween) {
            // Good with the same amount of time before and after the refresh,
            // so the server gets time to do its things, and the browser gets time
            // to reload & repaint the page.
            await this.#br.pause(delayMs / 2);
            await this.refresh2();
            await this.#br.pause(delayMs / 2);
          }
          else {
            await this.#br.pause(delayMs);
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


    async getPageId(): Pr<PageId> {
      const result = await this.#br.execute(function() {
        return window['theStore'].currentPageId;
      });
      dieIf(!result,
          `Error getting page id, result: ${JSON.stringify(result)} [TyE503KTTHA24]`);
      return result;
    }


    async getSiteId(): Pr<SiteId> {
      return (await this.getSiteIds()).siteId;
    }


    async getPubSiteId(): Pr<PubSiteId> {
      return (await this.getSiteIds()).pubSiteId;
    }


    async getSiteIds(): Pr<{ siteId: SiteId, pubSiteId: PubSiteId }> {
      const result = await this.#br.execute(function() {
        return { siteId: window['eds'].siteId, pubSiteId: window['eds'].pubSiteId };
      });
      dieIf(!result || !result.siteId || !result.pubSiteId,
            `Error getting site ids, result: ${j2s(result)}  [TyE6MWE520R5MRS]`);
      dieIf(_.isNaN(result.siteId),
            `Error getting site ids: Site id is NaN: ${j2s(result)}  [TyE6MR20E456]`);
      return result;
    }



    me = {
      waitUntilLoggedIn: async () => {
        await this.complex.waitUntilLoggedIn();
      },

      waitUntilKnowsNotLoggedIn: async (): Pr<TestMyself> => {
        await this.waitForMyDataAdded();
        let me = {} as Partial<TestMyself>;
        await this.waitUntil(async () => {
          me = await this.me.waitAndGetMyself();
          return me && !me.isLoggedIn;
        }, {
          message: () =>
              `Waiting until not logged in, me now: ${me.username || me.fullName}`,
        });
        return me;
      },

      waitAndGetMyself: async (): Pr<TestMyself> => {
        return await this.waitUntil(async () => {
          return await this.#br.execute(function() {
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
      createNewSite: async (data: NewSiteData): Pr<NewSiteResult> => {
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
        await this.go2(url);
        await this.disableRateLimits();

        console.log("Fill in fields and submit...");
        await this.createSite.fillInFieldsAndSubmit(data);

        // New site; disable rate limits here too.
        await this.disableRateLimits();
        const siteId = await this.getSiteId();
        const talkyardSiteOrigin = await this.origin();

        return {
          data,
          testId: data.testId,
          siteId,
          talkyardSiteOrigin,
        }
      },


      signUpAsOwner: async (newSiteResult: NewSiteResult) => {
        const data = newSiteResult.data;
        const siteId = newSiteResult.siteId;

        console.log("Click sign up as owner ...");
        await this.createSite.clickOwnerSignupButton();

        console.log("... sign up as owner ...");
        switch (data.newSiteOwner) {
          case NewSiteOwnerType.OwenOwner:
            await this.loginDialog.createPasswordAccount(data, true);
            const email = await server.getLastEmailSenTo(siteId, data.email);
            const link = await utils.findFirstLinkToUrlIn(
                    data.origin + '/-/login-password-confirm-email', email.bodyHtmlText);
            await this.go(link);
            await this.waitAndClick('#e2eContinue');
            break;
          case NewSiteOwnerType.GmailAccount:
            await this.loginDialog.createGmailAccount({
              email: settings.gmailEmail,
              password: settings.gmailPassword,
              username: data.username,
            }, { shallBecomeOwner: true });
            break;
          case NewSiteOwnerType.FacebookAccount:
            await this.loginDialog.createFacebookAccount({
              email: settings.facebookAdminEmail,
              password: settings.facebookAdminPassword,
              username: data.username,
            }, { shallBecomeOwner: true });
            break;
          case NewSiteOwnerType.GitHubAccount:
            await this.loginDialog.createGitHubAccount({
                username: settings.githubUsernameMixedCase,
                password: settings.githubPassword,
                shallBecomeOwner: true,
                alreadyLoggedInAtGitHub: data.alreadyLoggedInAtIdProvider });
            break;
          case NewSiteOwnerType.LinkedInAccount:
            await this.loginDialog.createLinkedInAccount({
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


    async numWindowsOpen(): Pr<Nr> {
      return (await this.#br.getWindowHandles()).length;
    }


    async numTabs(): Pr<Nr> {
      const hs = await this.#br.getWindowHandles()
      return hs.length;
    }


    async waitForMinBrowserTabs(howMany: Nr, waitPs: WaitPs = {}): Pr<Bo> {
      let numNow = -1;
      const message = () => `Waiting for >= ${howMany} tabs, currently ${numNow} tabs...`;
      return await this.waitUntil(async () => {
        numNow = await this.numWindowsOpen();
        return numNow >= howMany;
      }, { ...waitPs, message });
    }


    async waitForMaxBrowserTabs(howMany: Nr) {
      let numNow = -1;
      const message = () => `Waiting for <= ${howMany} tabs, currently ${numNow} tabs...`;
      await this.waitUntil(async () => {
        // Cannot be 0, that'd mean the test made itself disappear?
        numNow = (await this.#br.getWindowHandles()).length;
        return numNow <= Math.max(1, howMany);
      }, { message, serverErrorDialogIsFine: true });
    }


    async closeWindowSwitchToOther() {
      await this.#br.closeWindow();
      // WebdriverIO would continue sending commands to the now closed window, unless:
      const handles = await this.#br.getWindowHandles();
      dieIf(!handles.length, 'TyE396WKDEG2');
      if (handles.length === 1) {
        await this.#br.switchToWindow(handles[0]);
      }
      if (handles.length >= 2) {
        // Maybe a developer has debug-opened other this.#br tabs?
        // Switch back to the original window, if possible.
        if (this.#firstWindowHandle && handles.indexOf(this.#firstWindowHandle)) {
          logUnusual(`There're ${handles.length} open windows — ` +
              `switching back to the original window...`);
          await this.#br.switchToWindow(this.#firstWindowHandle);
        }
        else {
          die(`Don't know which window to switch to now. The original window is gone. [TyE05KPES]`);
        }
      }
    }


    async swithToOtherTabOrWindow(isWhereAfter?: IsWhere) {
      for (let i = 0; i < 3; ++i) {
        logBoring("Waiting for other window to open, to avoid weird Selenium errors...");
        await this.#br.pause(1500);
        if (await this.numWindowsOpen() > 1)
          break;
      }
      const handles = await this.#br.getWindowHandles();
      const curHandle = await this.#br.getWindowHandle();
      for (let ix = 0; ix < handles.length; ++ix) {
        const handle = handles[ix];
        if (handle !== curHandle) {
          logMessage(`Calling this.#br.switchToWindow(handle = '${handle}')`);
          await this.#br.switchToWindow(handle);
          logMessage(`... done, win handle is now: ${await this.#br.getWindowHandle()}.`);
          if (isWhereAfter) {
            this.#isWhere = isWhereAfter;
          }
          else {
            await this.__updateIsWhere();
          }
          return;
        }
      }
      // Might be a login popup that got auto closed? [3GRQU5]
      logMessage("No other window to switch to. [TyM2WPDL0]");
    }


    async switchBackToFirstTabOrWindow() {
      // There should be no other windows, except for maybe a login popup.
      // Wait until it closes. However if a developer has opened more tabs and
      // does some experiments, so there're many open windows — then, continue anyway.
      let numWindows;
      await this.waitUntil(async () => {
        const ids = await this.#br.getWindowHandles();
        numWindows = ids.length;
        return numWindows <= 1;
      }, {
        message: () => `Waiting for any loging popup to auto close, to avoid ` +
              `invalid window ID errors. Num windows open: ${numWindows}`,
        timeoutMs: 3000,
        timeoutIsFine: true,
        serverErrorDialogIsFine: true,
      });

      const winIds = await this.#br.getWindowHandles();
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
        await this.#br.switchToWindow(switchToId);
      }
      catch (ex) {
        // A race? The window just closed itself? Google and Facebook auto closes
        // login popup tabs, [3GRQU5] if one is logged in already at their
        // websites. Try again.
        logError(`Error switching window [TyEE2ESWWIN]`, ex);
        const idsAgain = await this.#br.getWindowHandles();
        logMessage(`Trying again, switching to idsAgain[0]: ${idsAgain[0]} ...`);
        await this.#br.switchToWindow(idsAgain[0]);
        // Don't catch.
      }

      await this.__updateIsWhere();
    }


    _currentUrl = '';

    async rememberCurrentUrl() {
      this._currentUrl = await this.#br.getUrl();
    }


    async waitForNewUrl() {
      assert.ok(!!this._currentUrl, "Please call this.#br.rememberCurrentUrl() first [EsE7JYK24]");
      await this.waitUntil(async () => {
        return this._currentUrl !== await this.#br.getUrl();
      }, {
        message: `Waiting for new URL, currently at: ${this._currentUrl}`
      });
      delete this._currentUrl;
    }


    async repeatUntilAtNewUrl(fn: () => Pr<Vo>) {
      const urlBefore = await this.#br.getUrl();
      await fn();
      const initDelayMs = 250;
      let delayMs = initDelayMs;
      await this.#br.pause(delayMs);
      while (urlBefore === await this.#br.getUrl()) {
        logMessageIf(delayMs > initDelayMs,
            `Repeating sth until at new URL, currently at: ${urlBefore}`);
        // E2EBUG RACE: if the url changes right here, maybe fn() below won't work,
        // will block.
        await fn();
        delayMs = expBackoff(delayMs);
        await this.#br.pause(delayMs);
      }
    }


    async waitForNewOrigin(anyCurrentUrl?: St) {
      const currentUrl = anyCurrentUrl || this._currentUrl;
      assert.ok(!!currentUrl, "Please call this.#br.rememberCurrentUrl() first [TyE603RK54]");
      const curOrigin = await this._findOrigin(currentUrl);
      while (curOrigin === await this.origin()) {
        await this.#br.pause(250);
      }
      this._currentUrl = '';
    }


    async isInIframe(): Pr<Bo> {
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

      return await this.#br.execute(function() {
        return window['eds'] && window['eds'].isInIframe;
      });
    }


    frameParent() {
      die("Use switchToAnyParentFrame() instead [TyE306WKHJP2]");
    }


    async switchToAnyParentFrame() {
      if (await this.isInIframe()) {
        await this.switchToTheParentFrame();
      }
    }


    async switchToTheParentFrame(ps: { parentIs?: IsWhere } = {}) {
        dieIf(!await this.isInIframe(), `Cannot switch to parent frame, ` +
              `we're not in an iframe:  !this.isInIframe()  [TyE406RKH2]`);
        await this.#br.switchToParentFrame();
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


    async switchToFrame(selector: string, ps: { timeoutMs?: number } = {}) {
      logMessage(`Switching to frame ${selector}...`);
      await this.waitForExist(selector, ps);
      const iframe = await this.$(selector);
      await this.#br.switchToFrame(iframe);
      logMessage(` done, now in frame  ${selector}.\n`);
      this.#isWhere = IsWhere.UnknownIframe;
    }


    async switchToLoginPopupIfEmbedded() {
      if (await this.isOnEmbeddedPage()) {
        await this.swithToOtherTabOrWindow(IsWhere.LoginPopup);
      }
    }


    async switchBackToFirstTabIfNeeded() {
      if (this.#isWhere === IsWhere.LoginPopup) {
        await this.switchBackToFirstTabOrWindow();
      }
    }


    async waitForEmbeddedCommentsIframe() {
      // Can there be any emb comments iframe here?
      dieIf(this.#isWhere && this.#isWhere !== IsWhere.External &&
          this.#isWhere != IsWhere.EmbeddingPage,
          `No comments iframe here, this.#isWhere: ${this.#isWhere} [TyE6RKB2GR04]`);
      await this.waitForExist('iframe#ed-embedded-comments');
      if (this.#isWhere) this.#isWhere = IsWhere.EmbeddingPage;
    }


    async switchToEmbCommentsIframeIfNeeded() {
      if (!this.#isWhere || this.#isWhere == IsWhere.Forum)
        return;
      dieIf(!this.isOnEmbeddedPage(), `No embedded things here, this.#isWhere: ${this.#isWhere} [TyE703TKDLJ4]`);
      if (this.#isWhere !== IsWhere.EmbCommentsIframe) {
        await this.switchToEmbeddedCommentsIrame();
      }
    }


    useCommentsIframe(ps: { discussionId: St }) {
      this.#useCommentsIframe = ps;
    }
    useFirstCommentsIframe() {
      this.#useCommentsIframe = null;
    }


    async switchToEmbEditorIframeIfNeeded() {
      if (!this.#isWhere || this.#isWhere == IsWhere.Forum)
        return;
      dieIf(!this.isOnEmbeddedPage(), `No embedded things here, this.#isWhere: ${this.#isWhere} [TyE306WKH2]`);
      if (this.#isWhere !== IsWhere.EmbEditorIframe) {
        await this.switchToEmbeddedEditorIrame();
      }
    }


    async switchToEmbeddedCommentsIrame(ps: {
            waitForContent?: false, discId?: St, theresOnlyOne?: true } = {}) {
      if (ps.discId) {
        this.useCommentsIframe({ discussionId: ps.discId });
      }
      else if (ps.theresOnlyOne) {
        this.useFirstCommentsIframe();
      }
      await this.switchToAnyParentFrame();
      // Let's wait for the editor iframe, so Reply buttons etc will work.
      await this.waitForExist('iframe#ed-embedded-editor');
      let commentsIframeSelector = '';
      if (this.#useCommentsIframe?.discussionId) {
        commentsIframeSelector =
                `.talkyard-comments[data-discussion-id="${
                        this.#useCommentsIframe.discussionId}"] iframe`;
      }
      else {
        commentsIframeSelector = 'iframe#ed-embedded-comments';
      }
      await this.switchToFrame(commentsIframeSelector);
      if (ps.waitForContent !== false) {
        await this.waitForExist('.DW');
      }
      this.#isWhere = IsWhere.EmbCommentsIframe;
    }


    async switchToEmbeddedEditorIrame() {
      await this.switchToAnyParentFrame();
      // Let's wait for the comments iframe, so it can receive any messages from the editor iframe.
      await this.waitForExist('iframe#ed-embedded-comments');
      await this.switchToFrame('iframe#ed-embedded-editor');
      this.#isWhere = IsWhere.EmbEditorIframe;
    }


    async getBoundingClientRect(selector: string, opts: { mustExist?: boolean } = {}): Pr<ElemRect | U> {
      // Something like this might work too:
      //   const elemId: string = this.#br.findElement('css selector', selector);
      //   this.#br.getElementRect(elemId);  — how get the id?
      // But this already works:
      const result = await this.#br.execute(function(selector) {
        var elem = document.querySelector(selector);
        if (!elem) return undefined;
        var rect = elem.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      }, selector);

      dieIf(!result && opts.mustExist !== false,
            `Cannot find selector:  ${selector}  [TyE046WKSTH24]`);
      return result;
    }


    async getWindowHeight(): Pr<Nr> {
       // Webdriver.io v5, just this?:
      // return this.#br.getWindowRect().height
      const result = await this.#br.execute(function() {
        return window.innerHeight;
      });
      dieIf(!result, 'TyE7WKJP42');
      return result;
    }


    async getPageScrollY(): Pr<Nr> {
      return await this.#br.execute(function(): number {
        var pageColumn = document.getElementById('esPageColumn');
        // ?? this works inside execute()?
        if (!pageColumn) throw Error("No #esPageColumn on this page [TyE7KBAQ2]");
        return pageColumn.scrollTop;
      });
    }


    async getHtmlBodyScrollY(): Pr<Nr> {
      return await this.#br.execute(function(): Nr {
        return document.body.scrollTop;
      });
    }


    async scrollIntoViewInPageColumn(selector: St) {   // RENAME to  scrollIntoView
      dieIf(!selector, '!selector [TyE05RKCD5]');
      const isInPageColResult = await this.#br.execute(function(selector) {
        var pageColumn = document.getElementById('esPageColumn');
        if (!pageColumn)
          return false;
        var elem = document.querySelector(selector);
        return pageColumn.contains(elem);
      }, selector);
      if (isInPageColResult) {
        await this._real_scrollIntoViewInPageColumn(selector);
      }
      else {
        // Elem outside page column (e.g. modal dialog), or there is no page column.
        await this.waitForVisible(selector);
        const problem = await this.#br.execute(function(selector) {
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


    async _real_scrollIntoViewInPageColumn(selector: St) { // RENAME to _scrollIntoViewInPageColumn
      dieIf(!selector, '!selector [TyE5WKT02JK4]');
      await this.waitForVisible(selector);
      let lastScrollY = await this.getPageScrollY();
      for (let i = 0; i < 60; ++i) {   // try for a bit more than 10 seconds
        await this.#br.execute(function(selector) {
          // Not logMessage — we're in the this.#br.
          console.log(`Scrolling into view in page column: ${selector}`);
          window['debiki2'].utils.scrollIntoViewInPageColumn(
              selector, { marginTop: 100, marginBottom: 100, duration: 100 });
        }, selector);
        await this.#br.pause(150);
        const curScrollY = await this.getPageScrollY();
        if (lastScrollY === curScrollY) {
          // Done scrolling;
          return;
        }
        logMessage(`Scrolling <${selector}> into view in page column, scroll y: ${curScrollY} ...`);
        lastScrollY = curScrollY;
      }
      assert.fail(`Cannot scroll to: ${selector}`);
    }


    async scrollToTop() {
      // Sometimes, the this.#br won't scroll to the top. [E2ENEEDSRETRY]
      // Who knows why. So try trice.
      await utils.tryManyTimes('scrollToTop', 3, async () => {
        // // I think some browsers wants to scroll <body> others want to scroll <html>, so do both.
        // // And if we're viewing a topic, need to scroll the page column insetad.  (4ABKW20)
        // this.#br.scroll('body', 0, 0);
        // this.#br.scroll('html', 0, 0);
        await this.#br.execute(function() {
          window.scrollTo(0, 0);
          document.documentElement.scrollTop = 0; // not needed? but why not
          // If we're on a Talkyard page, scroll to its top.
          var pageElem = document.getElementById('esPageColumn');
          if (pageElem) pageElem.scrollTop = 0;
        });

        // Need to wait for the scroll to actually happen, otherwise Selenium/Webdriver
        // continues running subsequent test steps, without being at the top.
        let scrollTop;
        await this.#br.waitUntil(async () => {
          scrollTop = await this.#br.execute(function() {
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


    async scrollToBottom() {
      //this.#br.scroll('body', 0, 999*1000);
      //this.#br.scroll('html', 0, 999*1000);
      //if (this.isVisible('#esPageColumn')) {
      //  this.#br.execute(function() {
      //    document.getElementById('esPageColumn').scrollTop = 999*1000;
      //  });
      //}
      await this.#br.execute(function() {
        window.scrollTo(0, 999*1000);
        document.documentElement.scrollTop = 999*1000; // not needed? but why not
        // If we're on a Talkyard page, scroll to its bottom too.
        var pageElem = document.getElementById('esPageColumn');
        if (pageElem) pageElem.scrollTop = 999*1000;
      });

      // Need to wait for the scroll to actually happen. COULD instead maybe
      // waitUntil scrollTop = document height - viewport height?  but will probably be
      // one-pixel-too-litle-too-much errors? For now:
      await this.#br.pause(500);
    }


    async clickBackdrop() {
      await this.waitAndClick('.fade.in.modal');
    }


    async playTimeSeconds(seconds: number) {  // [4WKBISQ2]
      dieIf(!seconds, '!seconds [TyE503RKTSH25]');
      await this.#br.execute(function (seconds) {
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


    async waitForMyDataAdded() {
      await this.waitForVisible('.e2eMyDataAdded');
    }


    // Can be used to wait until a fade-&-scroll-in dialog is done scrolling in, for example.
    //
    async waitUntilDoesNotMove(buttonSelector: St, pollInterval?: Nr) {
      let problem;
      await this.waitUntil(async () => {
        const location = await this.getBoundingClientRect(buttonSelector, { mustExist: false });
        if (!location) {
          problem = `waitUntilDoesNotMove(..): Elem does not yet exist:  ${buttonSelector}`
          return false;
        }

        await this.#br.pause(pollInterval || 50);

        const locationLater = await this.getBoundingClientRect(buttonSelector, { mustExist: true });
        if (location.y !== locationLater.y || location.x !== locationLater.x) {
          problem = `Keeps moving and moving: '${buttonSelector}' [EdE7KFYU0]`;
          return false;
        }

        return true;
      }, {
        message: problem,
      });
    }


    async count(selector: St): Pr<Nr> {
      return await tryOrIfWinCloses(async () =>
              (await this.$$(selector)).length, undefined);
    }


    async isExisting(selector: St): Pr<Bo> {
      return await tryOrIfWinCloses(async () =>
              await (await this.$(selector)).isExisting(), undefined);
    }


    async isEnabled(selector: St): Pr<Bo> {
      const elem: WElm = await this.$(selector);
      // Sometimes these methods are missing, why?  [MISSINGFNS]
      const enabled = elem &&
              await elem.isExisting() &&  // was: (await elem?.isExisting?.()) &&
              await elem.isDisplayed() &&
              await elem.isEnabled();
      return !!enabled;
    }


    async isVisible(selector: St): Pr<Bo> {  // RENAME to isDisplayed, started, see below
      return await this.isDisplayed(selector);
    }

    async isDisplayed(selector: St): Pr<Bo> {
      // Sometimes the elem methods below are missing, weird.  [MISSINGFNS]
      // Maybe if win closed so elem gone?
      // CLEAN_UP remove comment, not a problem any more with  async ?

      const elem: WElm = await this.$(selector);
      // Skip isExisting()?
      const displayed = elem &&
              await elem.isExisting() &&   // was:  elem.isExisting?.()) &&
              await elem.isDisplayed();
      return !!displayed;
    }


    async assertDisplayed(selector: St) {
      if (!await this.isDisplayed(selector)) {
        tyAssert.fail(`Not displayed:  ${selector} `);
      }
    }


    async isDisplayedInViewport(selector: St): Pr<Bo> {
      // Sometimes the elem methods below are missing, weird.  [MISSINGFNS]
      const elem: WElm = await this.$(selector);
      const displayed = elem &&
              await elem.isExisting() &&    // was:  ?.()
              await elem.isDisplayedInViewport();
      return !!displayed;
    }


    async assertDisplayedInViewport(selector: St) {
      if (!await this.isDisplayedInViewport(selector)) {
        tyAssert.fail(`Not displayed in viewport:  ${selector} `);
      }
    }


    // Makes it simple to find out which, of many, selectors won't appear,
    // or won't go away.
    async filterVisible(selectors: St[],
            opts: { keepVisible?: true, exclVisible?: true } = {}): Pr<St[]> {
      dieIf(!!opts.keepVisible === !!opts.exclVisible, 'TyE60RKDNF5');
      const result = [];
      for (let s of selectors) {
        if (await this.isVisible(s) === !!opts.keepVisible) {
          result.push(s);
        }
      }
      return result;
    }


    async waitForMaybeDisplayed(selector: St, ps: WaitPsWithOptText = {}): Pr<Bo> {
      const what = ps.text ? `"${ps.text}" text` : selector
      const ps2 = {
        timeoutMs: 2000,
        timeoutIsFine: true,
        winClosedIsFine: true,
        message: `Waiting for any ${what}`,
      };
      if (ps.text) {
        return await this.waitUntilTextIs(selector, ps.text, ps2);
      }
      else {
        return await this.waitForDisplayed(selector, ps2);
      }
    }


    async waitForDisplayed(selector: St, ps: WaitPs = {}): Pr<Bo> {
      return await this.waitForVisible(selector, ps);
    }

    async waitForVisible(selector: St, ps: WaitPs = {}): Pr<Bo> {  // RENAME to waitForDisplayed() above
      return await this.waitUntil(async () => await this.isVisible(selector), {
        ...ps,
        message: `Waiting for visible:  ${selector}`,
      });
    }


    async waitForDisplayedInViewport(selector: St, ps: WaitPs = {}) {
      await this.waitUntil(async () => await this.isDisplayedInViewport(selector), {
        ...ps,
        message: `Waiting for dispalyed in viewport:  ${selector}`,
      });
    }


    // DEPRECATED use waitUntilGone  instead?
    async waitForNotVisible(selector: St, timeoutMillis?: Nr) {
      for (let elapsed = 0; elapsed < timeoutMillis || true ; elapsed += PollMs) {
        if (!await this.isVisible(selector))
          return;
        await this.#br.pause(PollMs);
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
    async isDisplayedWithText(selector: St, text: St): Pr<Bo> {
      // COULD_OPTIMIZE   test all at once — now the caller calls this fn many times instead.
      const elems = await this.$$(selector);
      for (let elem of elems) {
        if (!await elem.isDisplayed())
          continue;
        const actualText = await elem.getText();
        if (actualText.indexOf(text) >= 0)
          return true;
      }
      return false;
    }


    async waitForEnabled(selector: St, ps: WaitPs = {}) {
      await this.waitUntil(async () => await this.isEnabled(selector), {
        ...ps,
        message: `Waiting for visible:  ${selector}`,
      });
    }


    // Why not return the text instead!  Pr<false | St>
    // See [waitAndGetVisibleText].
    async waitForVisibleText(selector: St, ps: WaitPs = {}): Pr<Bo> {
      let problem: St | U;
      return await this.waitUntil(async () => {
        const elem: WebdriverIO.Element = await this.$(selector);
        try {
          // Oddly enough, sometimes isDisplayed is not a function, below. Maybe isExisting()
          // also isn't, sometimes? They're undefined, then, or what?  [MISSINGFNS]
          if (!elem) {
            problem = `this.$(selector) –> null`;
            return false;
          }
          if (!elem.isExisting) {
            problem = `elem.isExisting is absent, no such function`;  // [MISSINGFNS]
            return false;
          }
          const isExisting = await elem.isExisting();
          if (!isExisting) {
            problem = `isExisting() –> ${isExisting}`;
            return false;
          }
          if (!elem.isDisplayed) {
            // This happened sometimes with Webdriverio 6.  [MISSINGFNS]
            problem = `elem.isDisplayed is absent, no such function`;
            return false;
          }
          const isDisplayed = await elem.isDisplayed();
          if (!isDisplayed) {
            problem = `isDisplayed() –> ${isDisplayed}`;
            return false;
          }
          // This one blocks until the elem appears — so, need 'return' above.
          // Enable DEBUG WebdriverIO log level and you'll see:
          // """DEBUG webdriverio: command getText was called on an element ("#post-670")
          //       that wasn't found, waiting for it... """
          const text = await elem.getText();
          if (!text) {
            problem = `getText() –> ${_.isUndefined(text) ? 'undefined' : `"${text}"`}`;
            return false;
          }
          return true;
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
      }, {
        ...ps,
        serverErrorDialogIsFine: selector.indexOf('.s_SED_Msg') >= 0,
        message: () =>
            `Waiting for visible non-empty text, selector:  ${selector}\n` +
            `    problem: ${problem}`,
      });
    }

    async getWholePageJsonStrAndObj(): Pr<[St, Ay]> {
      // Chrome: The this.#br wraps the json response in a <html><body><pre> tag.
      // Firefox: Shows pretty json with expand/collapse sub trees buttons,
      // and we need click a #rawdata-tab to get a <pre> with json text to copy.
      return await utils.tryManyTimes("copy json", 3, async () => {
        await this.waitForVisible('#rawdata-tab, pre');
        if (await this.isVisible('#rawdata-tab')) {
          await this.waitAndClick('#rawdata-tab');
        }
        const jsonStr: string = await this.waitAndGetText('pre');
        const obj: any = JSON.parse(jsonStr);
        return [jsonStr, obj];
      });
    }


    async waitUntilTextIs(selector: St, desiredText: St, opts: WaitPs = {}): Pr<Bo> {
      return await this.__waitUntilTextOrVal(selector, 'text', desiredText, opts);
    }

    async waitUntilValueIs(selector: St, desiredValue: St, opts: WaitPs = {}): Pr<Bo> {
      return await this.__waitUntilTextOrVal(selector, 'value', desiredValue, opts);
    }

    async __waitUntilTextOrVal(selector: St, what: 'text' | 'value', desiredValue: St,
            opts: WaitPs): Pr<Bo> {
      let currentValue;
      await this.waitForVisible(selector, opts);
      return await this.waitUntil(async () => {
        const elem = await this.$(selector);
        currentValue = what === 'text' ? await elem.getText() : await elem.getValue();
        return currentValue === desiredValue;
      }, {
        ...pluckWaitPs(opts),
        message: `Waiting for ${what} of:  ${selector}  to be:  ${desiredValue}\n` +
        `  now it is: ${currentValue}`,
      });
    }

    async waitForExist(selector: string, ps: WaitPs & { howMany?: number } = {}) {
      await this.waitUntil(async () => {
        const elem = await this.$(selector);
        if (elem && await elem.isExisting())
          return true;
      }, {
        ...pluckWaitPs(ps),
        message: `Waiting until exists:  ${selector}`,
      });

      if (ps.howMany) {
        await this.waitForExactly(ps.howMany, selector);
      }
    }

    async waitForGone(selector: St, ps: WaitPs = {}) {
      await this.waitUntilGone(selector, ps);
    }

    async tryClickNow(selector: St): Pr<ClickResult> {
      if (!await this.isExisting(selector))
        return 'CouldNotClick';
      return await this.waitAndClick(selector, { timeoutMs: 500, timeoutIsFine: true });
    }

    async waitAndClick(selector: St, opts: WaitAndClickPs = {}): Pr<ClickResult> {
      return await this._waitAndClickImpl(selector, opts);
    }


    async waitAndClickFirst(selector: St, opts: WaitAndClickPs = {}): Pr<ClickResult> {
      return await this._waitAndClickImpl(selector, { ...opts, clickFirst: true });
    }


    async waitAndClickLast(selector: St): Pr<ClickResult> {
      return await this.waitAndClickNth(selector, -1);
    }


    // Clicks or throws an error — unless timeoutIsFine, then
    // returns 'CouldNotClick' instead of throwing error.
    //
    // Works with many browsers at the same time   — probably not any longer?
    //
    async _waitAndClickImpl(selector: St, ps: WaitAndClickPs = {}): Pr<ClickResult> {
      selector = selector.trim(); // so selector[0] below, works
      if (await this._waitForClickable(selector, ps) !== 'Clickable')
        return 'CouldNotClick';

      if (selector[0] !== '#' && !ps.clickFirst) {
        const elems = await this.$$(selector);
        dieIf(elems.length > 1,
            `Don't know which one of ${elems.length} elems to click. ` +
            `Selector:  ${selector} [TyE305KSU]`);
      }
     return await this.clickNow(selector);
    }


    async clickNow(selEl: SelOrEl): Pr<'Clicked'> {
      try {
        if (_.isString(selEl)) await (await this.$(selEl)).click();
        else await selEl.click();
        return 'Clicked';
      }
      catch (ex) {
        const what = _.isString(selEl) ? `'${selEl}'` : 'elem';
        logWarning(`Error clicking ${what}: ${ex.toString()}`);
        if (isClickInterceptedException(ex)) {
          // This can happen if server error dialog appeared.
          if (await this.serverErrorDialog.isDisplayed()) {
            await this.serverErrorDialog.failTestAndShowDialogText();
          }
        }
        throw ex;
      }
    }

    // For one this.#br at a time only.
    // n starts on 1 not 0. -1 clicks the last, -2 the last but one etc.
    async waitAndClickNth(selector: string, n: number): Pr<ClickResult> {   // BUG will only scroll the 1st elem into view [05YKTDTH4]
      dieIf(n <= 0, "n starts on 1, change from 0 to 1 please");
      logWarningIf(n !== 1,
          `n = ${n} !== 1, won't scroll into view before trying to click, maybe will miss:  ${selector} [05YKTDTH4]`);

      // Currently always throws if couldn't click — timeoutIsFine isn't set.
      if (await this._waitForClickable(selector) !== 'Clickable')
        return 'CouldNotClick';

      const elems = await this.$$(selector);
      tyAssert.ok(elems.length >= n, `Elem ${n} missing: Only ${elems.length} elems match: ${selector}`);
      const index = n > 0
          ? n - 1
          : elems.length - (-n); // count from the end

      const elemToClick = elems[index];
      dieIf(!elemToClick, selector + ' TyE36KT74356');
      return await this.clickNow(elemToClick);
    }


    // Throws, unless opts.timeoutIsFine.
    async _waitForClickable (selector: St,  // RENAME? to scrollToAndWaitUntilCanInteract
          opts: WaitAndClickPs = {}): Pr<WaitForClickableResult> {
      const clickable = await this.waitUntil(async () => {
        await this.waitForVisible(selector, { timeoutMs: opts.timeoutMs });
        await this.waitForEnabled(selector, { timeoutMs: opts.timeoutMs });
        if (opts.mayScroll !== false) {
          // fix sleeping? bugs: [E2EBUG] set maybeMoves to true if did actually scroll
          await this.scrollIntoViewInPageColumn(selector);
        }
        if (opts.maybeMoves) {
          await this.waitUntilDoesNotMove(selector);
        }

        // Sometimes, a not-yet-done-loading-data-from-server overlays the element and steals
        // any click. Or a modal dialog, or nested modal dialog, that is fading away, steals
        // the click. Unless:
        if (opts.waitUntilNotOccluded !== false) {
          const notOccluded = await this.waitUntilElementNotOccluded(
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
          await this.waitUntilLoadingOverlayGone();
          return true;
        }
      }, {
        ...pluckWaitPs(opts),
        message: `Waiting for  ${selector}  to be clickable`
      });
      return clickable ? 'Clickable' : 'NotClickable';
    }


    async waitUntilGone(what: St, ps: WaitPs = {}): Pr<Bo> {   // RENAME to waitUntilCannotSee ?
      const isGone = await this.waitUntil(async () => {
        try {
          const elem = await this.$(what);
          const gone = !elem || !await elem.isExisting() || !await elem.isDisplayed();
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

    async focus(selector: string, opts?: { maybeMoves?: true,
          timeoutMs?: number, okayOccluders?: string }) {
      await this._waitForClickable(selector, opts);
      await this.clickNow(selector);
    }

    // DEPRECATED  use waitUntil(...  refreshBetween: true) instead
    async refreshUntil(test: () => Pr<Bo>) {
      while (true) {
        if (await test())
          return;
        await this.#br.pause(PollMs / 3);
        await this.#br.refresh();
        await this.#br.pause(PollMs * 2 / 3);
      }
    }

    async refreshUntilGone(what: St, opts: { waitForMyDataAdded?: Bo } = {}) {
      while (true) {
        if (opts.waitForMyDataAdded) {
          await this.waitForMyDataAdded();
        }
        let resultsByBrowser = await this.isVisible(what);
        let isVisibleValues = allBrowserValues(resultsByBrowser);
        let goneEverywhere = !_.some(isVisibleValues);
        if (goneEverywhere) break;
        await this.#br.refresh();
        await this.#br.pause(250);
      }
    }

    __theLoadingOveraySelector = '#theLoadingOverlay';

    async waitUntilLoadingOverlayGone() {
      await this.waitUntilGone(this.__theLoadingOveraySelector);
    }

    async waitUntilLoadingOverlayVisible_raceCond () {
      // The loading overlay might disappear at any time, when done loading. (309362485)
      // So not impossible that e2e tests that use this fn, sometimes break
      // (that's fine, we'll just retry them).
      await this.waitForVisible(this.__theLoadingOveraySelector);
    }

    async isLoadingOverlayVisible_raceCond (): Pr<Bo> {
      // A race: It might disappear at any time. (309362485)
      return await this.isVisible(this.__theLoadingOveraySelector);
    }

    async waitUntilModalGone() {
      await this.#br.waitUntil(async () => {
        // Check for the modal backdrop (it makes the stuff not in the dialog darker).
        let resultsByBrowser = await this.isVisible('.modal-backdrop');
        let values = allBrowserValues(resultsByBrowser);
        let anyVisible = _.some(values, x => x);
        if (anyVisible)
          return false;
        // Check for the block containing the modal itself.
        // This sometimes fails, if waitUntilModalGone() is done in 'everyonesBrowser'.  [4JBKF20]
        // I suppose in one this.#br, the modal is present, but in another, it's gone... somehow
        // resulting in Selenium failing with a """ERROR: stale element reference: element
        // is not attached to the page document""" error.
        resultsByBrowser = await this.isVisible('.fade.modal');
        values = allBrowserValues(resultsByBrowser);
        anyVisible = _.some(values, x => x);
        return !anyVisible;
      });
      await this.waitUntilGone('.fade.modal');
    }

    // Returns true iff the elem is no longer occluded.
    //
    async waitUntilElementNotOccluded(selector: string, opts: {
          okayOccluders?: string, timeoutMs?: number, timeoutIsFine?: boolean } = {}): Pr<Bo> {
      dieIf(!selector, '!selector,  [TyE7WKSH206]');
      let result: [St, St] | true;
      return await this.waitUntil(async () => {
        result = await <[St, St] | true> this.#br.execute(function(selector, okayOccluders): [St, St] | Bo {
          var elem = document.querySelector(selector);
          if (!elem)
            return [`No elem matches:  ${selector}`, ''];

          var rect = elem.getBoundingClientRect();
          var middleX = rect.left + rect.width / 2;
          var middleY = rect.top + rect.height / 2;
          var elemAtTopOfCenter = document.elementFromPoint(middleX, middleY);
          if (!elemAtTopOfCenter) {
            // This happens if the elem is outside the viewport,  [e2e_win_size]
            // """ If the specified point is outside the visible bounds of the document
            // or either coordinate is negative, the result is null."""
            // https://developer.mozilla.org/en-US/docs/Web/API/Document/elementFromPoint
            var message =
                    elemAtTopOfCenter === null ?
                        "Element not in viewport:\n" : "Error finding element from point:\n";
            return [message +
                `    elementFromPoint(middleX = ${middleX}, middleY = ${middleY
                        })  returns: ${elemAtTopOfCenter},\n` +
                `    elem bottom, right; top, left; width, height: ${
                        rect.bottom}, ${rect.right}; ${
                        rect.top}, ${rect.left}; ${
                        rect.width}, ${rect.height}\n` +
                `    win innerHeight, innerWidth: ` +
                        `${window.innerHeight}, ${window.innerWidth}\n` +
                `--- elem.innerHTML.substr(0,150): ------------------------\n` +
                `${elem.innerHTML?.substr(0,150)}\n` +
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
            `waitUntilElementNotOccluded(): Waiting for [ ${selector} ] to not be occluded, ` +
                `okayOccluders: ${j2s(opts.okayOccluders)},\n` +
            `Problem: ${result[0]}\nAny occluder's text content: """${result[1]}"""`,

      });
    }

    async waitForAtLeast(num: number, selector: string): Pr<WElm[]> {
      return await this._waitForHowManyImpl(num, selector, '>= ');
    }

    async waitForAtMost(num: number, selector: string): Pr<WElm[]> {
      return await this._waitForHowManyImpl(num, selector, '<= ');
    }

    async waitForExactly(num: number, selector: string): Pr<WElm[]> {
      return await this._waitForHowManyImpl(num, selector, '');
    }

    async _waitForHowManyImpl(num: number, selector: string,
            compareHow: '>= ' | '<= ' | ''): Pr<WElm[]> {
      let numNow = 0;
      let elms: WElm[] = [];
      await this.waitUntil(async () => {
        elms = await this.$$(selector);
        numNow = elms.length;
        switch (compareHow) {
          case '>= ': return numNow >= num;
          case '<= ': return numNow <= num;
          default: return numNow === num;
        }
      }, {
        message: () => `Waiting for ${compareHow}${num}  ${selector}  there are: ${numNow}`
      });
      return elms;
    }

    async assertExactly(num: Nr, selector: St) {
      let errorString = '';
      const elems = await this.$$(selector);
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


    async keys(keyStrokes: St | St[]) {
      await this.#br.keys(keyStrokes);
    }

    async waitAndPasteClipboard(selector: St, opts?: { maybeMoves?: true,
          timeoutMs?: Nr, okayOccluders?: St }) {
      await this.focus(selector, opts);
      // Different keys:
      // https://w3c.github.io/webdriver/#keyboard-actions
      await this.#br.keys(['Control','v']);
    }


    async waitAndSelectFile(selector: St, whichDir: 'TargetDir' | 'TestMediaDir',
        fileName: St) {

      const pathToUpload = (whichDir === 'TargetDir'
          // Step up from  tests/e2e/utils/  to  tests/e2e/target/:
          ? path.join(__dirname, '..', 'target', fileName)
          // Step down-up from  tests/e2e/utils/  to  tests/test-media/.
          : path.join(__dirname, '..', '..', 'test-media', fileName));

      logMessage("Uploading file: " + pathToUpload.toString());
      logWarningIf(settings.useDevtoolsProtocol,
          `BUT this.#br.uploadFile() DOES NOT WORK WITH THIS PROTOCOL, 'DevTools' [TyEE2EBADPROTO]`);
      // Requires Selenium or Chromedriver; the devtools protocol ('webtools' service) won't work.
      const remoteFilePath = await this.#br.uploadFile(pathToUpload);
      const elm = await this.$(selector);
      await elm.setValue(remoteFilePath);
    }


    async scrollAndSetValue(selector: St, value: St | Nr,
            opts: { timeoutMs?: Nr, okayOccluders?: St, append?: Bo } = {}) {
      await this.scrollIntoViewInPageColumn(selector);
      await this.waitUntilDoesNotMove(selector);
      await this.waitAndSetValue(selector, value, { ...opts, checkAndRetry: true });
    }


    async waitAndSetValue(selector: St, value: St | Nr,
        opts: { maybeMoves?: true, checkAndRetry?: true, timeoutMs?: Nr,
            okayOccluders?: St, append?: Bo, skipWait?: true } = {}) {

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
        await this._waitForClickable(selector, opts);
      }

      let oldText;
      let desiredValue = null;

        // Sometimes, when starting typing, React does a refresh / unmount?
        // — maybe the mysterious unmount e2e test problem [5QKBRQ] ? [E2EBUG]
        // so the remaining characters gets lost. Then, try again.
      await this.waitUntil(async () => {
          // Old comment, DO_AFTER 2020-08-01: Delete this comment.
          // This used to work, and still works in FF, but Chrome nowadays (2018-12)
          // just appends instead — now works again, with Webdriverio v6.
          //this.#br.setValue(selector, value);
          // GitHub issue and a more recent & better workaround?:
          //  https://github.com/webdriverio/webdriverio/issues/3024#issuecomment-542888255
          
          const elem = await this.$(selector);
          oldText = await elem.getValue();

          if (desiredValue === null) {
            desiredValue = (opts.append ? oldText : '') + value;
          }
          if (desiredValue === oldText)
            return true;

          if (opts.append) {
            dieIf(!value, 'TyE29TKP0565');
            // Move the cursor to the end — it might be at the beginning, if text got
            // loaded from the server and inserted after [the editable elem had appeared
            // already, with the cursor at the beginning].
            await this.focus(selector);
            await this.#br.keys(Array('Control', 'End'));
            // Now we can append.
            await elem.addValue(value);
          }
          else if (_.isNumber(value)) {
            await elem.setValue(value);
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
            await elem.setValue('x');  // focus it without clicking (in case a placeholder above)
            await this.#br.keys(
                    Array(oldText.length + 1).fill('Backspace'));  // + 1 = the 'x'
          }
          else {
            // --------------------------------
            // With WebDriver, setValue *appends* :- (  But works fine with Puppeteer.
            // So, if WebDriver, first clear the value:
            // elem.clearValue(); — has no effect, with WebDriver. Works with Puppeteer.
            await elem.setValue('x');  // appends, and focuses it without clicking
                                  // (in case a placeholder text above)
            // Delete chars one at a time:
            await this.#br.keys(
                    Array(oldText.length + 1).fill('Backspace'));  // + 1 = the 'x'
            // This in rare cases leaves an 'x'. (A race condition?) So
            // we'll waitUntil()-try until we've also read back the correct new value.
            // --------------------------------
            await elem.setValue(value);
          }
      }, {
        message: () =>
            `   Couldn't set value to:  ${desiredValue}\n` +
            `   got back when reading:  ${oldText}\n` +
            `                selector:  ${selector}   — trying again... [TyME2E5MKSRJ2]`,
      });
    }


    async waitAndSetValueForId(id: St, value: St | Nr) {
      await this.waitAndSetValue('#' + id, value);
    }


    async waitAndClickSelectorWithText(selector: St, regex: St | RegExp) {
      await this.waitForThenClickText(selector, regex);
    }

    async waitForThenClickText(selector: St, regex: St | RegExp,
            opts: { tryNumTimes?: Nr } = {}) {   // RENAME to waitAndClickSelectorWithText (above)
      // [E2EBUG] COULD check if visible and enabled, and loading overlay gone? before clicking
      const numTries = opts.tryNumTimes || 3;
      await utils.tryManyTimes(`waitForThenClickText(${selector}, ${regex})`, numTries,
              async () => {
        const elem = await this.waitAndGetElemWithText(selector, regex);
        await this.clickNow(elem);
      });
    }


    async waitUntilTextMatches(selector: St, regex: St | RegExp,
            opts: { timeoutMs?: Nr, invert?: Bo } = {}) {
      await this.waitAndGetElemWithText(selector, regex, opts);
    }


    async waitUntilHtmlIncludes(selector: St, text: St, ps: { multiLine?: Bo } = {}) {
      let htmlNow = ''
      await this.waitForExist(selector);
      await this.waitUntil(async () => {
        htmlNow = await (await this.$(selector)).getHTML();
        if (htmlNow.indexOf(text) >= 0)
          return true;
      }, {
        message: () =>
            `Waiting for: ${selector}  to include: --------\n${
            text
            }\n---- but the html is currently: -----------------\n${
            htmlNow
            }\n-------------------------------------------------`,
      });
    }


    async waitUntilHtmlMatches(selector: St, regexOrStr: St | RegExp | Ay[]) {
      await this.waitForExist(selector);

      for (let i = 0; true; ++i) {
        const html = await (await this.$(selector)).getHTML();
        const anyMiss = this._findHtmlMatchMiss(html, true, regexOrStr);
        if (!anyMiss)
          break;

        await this.#br.pause(PollMs);
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


    async waitForTextVisibleAssertIs(selector: St, expected: St) {
      await this.waitAndAssertVisibleTextIs(selector, expected);
    }


    async waitAndAssertVisibleTextIs(selector: St, expected: St) {  // RENAME to waitForTextVisibleAssertIs?
      const actual = await this.waitAndGetVisibleText(selector);
      tyAssert.ok(actual === expected, '\n\n' +
          `  Text of element selected by:  ${selector}\n` +
          `            should be exactly:  "${expected}"\n` +
          `      but is: (between --- )\n` +
          `------------------------------------\n` +
          `${actual}\n` +
          `------------------------------------\n`);
    }


    async waitForTextVisibleAssertMatches(selector: St, stringOrRegex: St | RegExp) {
      await this.waitAndAssertVisibleTextMatches(selector, stringOrRegex);
    }


    async waitAndAssertVisibleTextMatches(selector: St, stringOrRegex: St | RegExp) {  // RENAME to waitForTextVisibleAssertMatches ?
      const regex = getRegExpOrDie(stringOrRegex);
      const text = await this.waitAndGetVisibleText(selector);
      // This is easy to read:  [E2EEASYREAD]
      tyAssert.ok(regex.test(text), '\n\n' +
          `  Text of element selected by:  ${selector}\n` +
          `                 should match:  ${regex.toString()}\n` +
          `      but is: (between --- )\n` +
          `------------------------------------\n` +
          `${text}\n` +
          `------------------------------------\n`);
    }


    async waitAndGetElemWithText(selector: St, stringOrRegex: St | RegExp,
          opts: { timeoutMs?: Nr, invert?: Bo } = {}): Pr<WebdriverIO.Element> {
      const regex = getRegExpOrDie(stringOrRegex);

      // Don't use this.#br.waitUntil(..) — exceptions in waitUntil apparently don't
      // propagade to the caller, and instead always break the test. E.g. using
      // a stale elem ref in an ok harmless way, apparently breaks the test.
      const startMs = Date.now();
      for (let pauseMs = PollMs; true; pauseMs *= PollExpBackoff) {
        const elems = await this.$$(selector);
        let texts = '';
        for (let i = 0; i < elems.length; ++i) {
          const elem = elems[i];
          const text = await elem.getText();
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

        await this.#br.pause(Math.min(pauseMs, PollMaxMs));
      }
    }


    async getText(selector: St): Pr<St> {  // RENAME to waitAndGetText
                                              // and thereafter, die(...) in this.getText().
      return await this.waitAndGetText(selector);
    }


    async waitAndGetText(selector: St): Pr<St> {
      // Maybe not visible, if empty text? So use  waitForExist() here — and,
      // in waitAndGetVisibleText() just below, we waitForVisible() instead.
      await this.waitForExist(selector);
      return await (await this.$(selector)).getText();
    }


    async waitAndGetValue(selector: St): Pr<St> {
      await this.waitForExist(selector);
      return await (await this.$(selector)).getValue();
    }


    async assertValueIs(selector: St, expected: St) {
      const actual = await this.waitAndGetValue(selector);
      // [E2EEASYREAD].
      tyAssert.ok(actual === expected, '\n' +
        `Value of elem selected by:  ${selector}\n` +
        `           does not match:  ${expected}\n` +
        `    actual value: (between ---)\n` +
        `-------------------------------------------\n` +
        `${actual}\n` +
        `-------------------------------------------\n`);
    }


    // COULD_OPTIMIZE_TESTS: Can optimize [waitAndGetVisibleText():
    // Have  waitAndGetVisibleText return the text, not just a Bo.
    async waitAndGetVisibleText(selector: St): Pr<St> {
      await this.waitForVisibleText(selector);
      return await (await this.$(selector)).getText();
    }


    async waitAndGetNthText(selector, n: Nr, ps: { notEmpty?: Bo } = {}): Pr<St> {
      let text = '';
      await this.waitUntil(async () => {
        const elms = await this.$$(selector);
        if (!elms || elms.length < n) return false;
        text = await elms[n - 1].getText();
        return ps.notEmpty ? !!text : _.isString(text);
      }, {
        message: () => `Waiting for text in: ${selector} nr ${n}`,
      })
      return text;
    }


    async waitUntilNthTextMatches(selector, n: Nr, toMatch: St | RegExp): Pr<St> {
      let textNow: StV;
      const regex = getRegExpOrDie(toMatch);
      await this.waitUntil(async () => {
        textNow = await this.waitAndGetNthText(selector, n);
        return regex.test(textNow);
      }, {
        message: () => `Waiting for text in: ${selector} nr: ${n
                } to match: ${regex}, text is now: "${textNow}"`,
      })
      return textNow as St;
    }


    async waitAndGetVisibleHtml(selector): Pr<St> {
      await this.waitForVisibleText(selector);
      return await (await this.$(selector)).getHTML();
    }


    async assertTextIs(selector: St, text: St) {
      await this.assertTextMatches(selector, text, 'exact');
    }


    async assertTextMatches(selector: string, regex: string | RegExp | (string | RegExp)[],
          how: 'regex' | 'exact' | 'includes' = 'regex') {
      await this._assertOneOrAnyTextMatches(false, selector, regex, how);
    }


    async waitUntilAnyTextMatches(selector: string, stringOrRegex: string | RegExp) {
      const regex = getRegExpOrDie(stringOrRegex);
      let num;
      await this.waitUntil(async () => {
        const items = await this.$$(selector);
        num = items.length;
        for (let item of items) {
          if (regex.test(await item.getText()))
            return true;
        }
      }, {
        message: `Waiting for any  ${selector}  (there are ${num}, now) to match:  ${regex}`
      })
    }


    async assertAnyTextMatches(selector: string, regex: string | RegExp | (string | RegExp)[],
            how: 'regex' | 'exact' | 'includes' = 'regex') {
      await this._assertOneOrAnyTextMatches(true, selector, regex, how);
    }


    // n starts on 1 not 0.
    // Also see:  assertNthClassIncludes
    async assertNthTextMatches(selector: string, n: number,
          stringOrRegex: string | RegExp, stringOrRegex2?: string | RegExp,
          ps?: { caseless?: Bo }) {
      const regex = getRegExpOrDie(stringOrRegex);
      const regex2 = getAnyRegExpOrDie(stringOrRegex2);

      assert.ok(n >= 1, "n starts on 1, change from 0 to 1 please");
      const items = await this.$$(selector);
      assert.ok(items.length >= n, `Elem ${n} missing: Only ${items.length} elems match: ${selector}`);

      let text = await items[n - 1].getText();
      if (ps?.caseless) {
        text = text.toLowerCase();
      }

      // Could reformat, make simpler to read [E2EEASYREAD].
      assert.ok(regex.test(text), '\n' +
        `Text of elem ${n} selected by:  ${selector}\n` +
        `            does not match:  ${regex.toString()}\n` +
        `    actual text: (between ---)\n` +
        `-------------------------------------------\n` +
        `${text}\n` +
        `-------------------------------------------\n`);
      // COULD use 'arguments' & a loop instead
      if (regex2) {
        assert.ok(regex2.test(text), "Elem " + n + " selected by '" + selector + "' doesn't match " +
            regex2.toString() + ", actual text: '" + text + "'");
      }
    }


    // n starts on 1 not 0.
    // Also see:  assertNthTextMatches
    async assertNthClassIncludes(selector: string, n: number, classToFind: string) {
      assert.ok(n >= 1, "n starts on 1, change from 0 to 1 please");
      const items = await this.$$(selector);
      assert.ok(items.length >= n, `Elem ${n} missing: Only ${items.length} elems match: ${selector}`);
      const item = getNthFromStartOrEnd(n, items);
      const actuallClassAttr = await item.getAttribute('class');
      const regex = new RegExp(`\\b${classToFind}\\b`);
      // Simple to read [E2EEASYREAD].
      assert.ok(regex.test(actuallClassAttr), '\n' +
        `       Elem ${n} selected by:  ${selector}\n` +
           `  doesn't have this class:  ${classToFind}\n` +
           `           instead it has:  ${actuallClassAttr}\n`);
    }


    async assertNoTextMatches(selector: string, regex: string | RegExp) {
      await this._assertAnyOrNoneMatches(selector, false, regex, 'regex');
    }


    async _assertOneOrAnyTextMatches (many, selector: string,
          stringOrRegex: string | RegExp | (string | RegExp)[],
          how: 'regex' | 'exact' | 'includes') {
      await this._assertAnyOrNoneMatches(selector, true, stringOrRegex, how);
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


    async _assertAnyOrNoneMatches (selector: string, shallMatch: boolean,
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

      const elems = await this.$$(selector);

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
        const isVisible = await elem.isDisplayed();
        if (!isVisible) {
          problems += `  Elem ix 0: Not visible\n`;
          continue;
        }
        const elemText = await elem.getText();
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


    async waitUntilIsOnHomepage() {
      await this.waitUntil(async () => {
        const url = await this.#br.getUrl();
        return /https?:\/\/[^/?#]+(\/latest|\/top|\/)?(#.*)?$/.test(url);
      });
    }


    // RENAME to assertPageTitlePostMatches
    async assertPageTitleMatches(regex: St | RegExp) {
      await this.waitForVisible('h1.dw-p-ttl');
      await this.waitUntilTextMatches('h1.dw-p-ttl', regex);
      //this.assertTextMatches('h1.dw-p-ttl', regex);
    }


    // RENAME to assertPageBodyPostMatches
    async assertPageBodyMatches(regex: St | RegExp) {
      await this.waitForVisible('.esOrigPost');
      //await this.waitUntilTextMatches('.esOrigPost', regex);
      await this.assertTextMatches('.esOrigPost', regex);
    }


    async assertPageHtmlSourceMatches_1 (toMatch: St | RegExp) {
      // _1 = only for 1 this.#br
      const source = await this.#br.getPageSource();
      const regex = getRegExpOrDie(toMatch);
      assert.ok(regex.test(source), "Page source does match " + regex);
    }


    /**
     * Useful if navigating to a new page, but don't know exactly when will have done that.
     */
    async waitUntilPageHtmlSourceMatches_1 (toMatch: St | RegExp) {
      // _1 = only for 1 this.#br
      const regex = await getRegExpOrDie(toMatch);
      await this.waitUntil(async () => {
        const source = await this.#br.getPageSource();
        return regex.test(source);
      }, {
        message: `Waiting for page source to match:  ${regex}`,
      });
    }


    async assertPageHtmlSourceDoesNotMatch(toMatch: St | RegExp) {
      const source = await this.#br.getPageSource();
      const regex = getRegExpOrDie(toMatch)
      assert.ok(!regex.test(source), `Page source *does* match: ${regex}`);
      //let resultsByBrowser = byBrowser(this.#br.getPageSource());
      //_.forOwn(resultsByBrowser, (text, browserName) => {
      //  assert(!regex.test(text), browserNamePrefix(browserName) + "Page source does match " + regex);
      //});
    }


    _pageNotFoundOrAccessDenied = 'Page not found, or Access Denied';

    /* CLEAN_UP  byBrowser probably doesn't work? if so,  REMOVE this.
    // Also see this.#br.pageTitle.assertPageHidden().  Dupl code [05PKWQ2A]
    async assertWholePageHidden() {
      let resultsByBrowser = byBrowser(await this.#br.getPageSource());
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
    async assertMayNotSeePage() {
      let resultsByBrowser = byBrowser(await this.#br.getPageSource());
      _.forOwn(resultsByBrowser, (text: any, browserName) => {
        if (settings.prod) {
          tyAssert.includes(text, this._pageNotFoundOrAccessDenied);
          //  browserNamePrefix(browserName) + "Page not hidden (no not-found or access-denied)");
        }
        else {
          tyAssert.includes(text, 'TyEM0SEE_'); /*, browserNamePrefix(browserName) +
              "User can see page. Or did you forget the --prod flag? (for Prod mode)");
          * /
        }
      });
    } */


    async assertMayNotLoginBecauseNotYetApproved() {
      await this.assertPageHtmlSourceMatches_1('TyM0APPR_-TyMAPPRPEND_');
    }


    async assertMayNotLoginBecauseRejected() {
      await this.assertPageHtmlSourceMatches_1('TyM0APPR_-TyMNOACCESS_');
    }


    async assertNotFoundError(ps: {
            whyNot?: 'CategroyDeleted' | 'MayNotCreateTopicsOrSeeCat' |
                'MayNotSeeCat' | 'PageDeleted' } = {}) {
      for (let i = 0; i < 20; ++i) {
        let source = await this.#br.getPageSource();
        // The //s regex modifier makes '.' match newlines. But it's not available before ES2018.
        let is404 = /404 Not Found.+TyE404_/s.test(source);
        if (!is404) {
          await this.#br.pause(250);
          await this.#br.refresh();
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


    async assertUrlIs(expectedUrl: St) {
      const url = await this.#br.getUrl();
      tyAssert.eq(url, expectedUrl);
    }

    async goToSearchPage(query?: string) {
      const q = query ? '?q=' + query : '';
      await this.go('/-/search' + q);
      await this.waitForVisible('.s_SP_QueryTI');
    }

    async acceptAnyAlert(howMany: Nr = 1): Pr<Bo> {
      return await this.dismissAcceptAnyAlert(howMany, true);
    }

    async dismissAnyAlert(howMany: number = 1): Pr<Bo> {
      return await this.dismissAcceptAnyAlert(howMany, false);
    }

    async dismissAcceptAnyAlert(howMany: Nr, accept: Bo): Pr<Bo> {
      let numDone = 0;
      await this.waitUntil(async () => {
        try {
          if (accept) await this.#br.acceptAlert();
          else await this.#br.dismissAlert();
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
      fillInFieldsAndSubmit: async (data: NewSiteData) => {
        if (data.embeddingUrl) {
          await this.waitAndSetValue('#e_EmbeddingUrl', data.embeddingUrl);
        }
        else {
          await this.waitAndSetValue('#dwLocalHostname', data.localHostname);
        }
        await this.waitAndClick('#e2eNext3');
        await this.waitAndSetValue('#e2eOrgName', data.orgName || data.localHostname);
        await this.waitAndClick('input[type=submit]');
        await this.waitForVisible('#t_OwnerSignupB');
        assert.equal(data.origin, await this.origin());
      },

      clickOwnerSignupButton: async () => {
        await this.waitAndClick('#t_OwnerSignupB');
      }
    };


    createSomething = {
      createForum: async (forumTitle: St) => {
        // Button gone, I'll add it back if there'll be Blog & Wiki too.
        // this.waitAndClick('#e2eCreateForum');
        await this.#br.pause(200); // [e2erace] otherwise it won't find the next input, in the
                            // create-site-all-logins @facebook test
        logMessage(`Typig forum title: "${forumTitle}" ...`);
        await this.waitAndSetValue('input[type="text"]', forumTitle, { checkAndRetry: true });
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
        await this.waitAndClick('.e_Next');

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
        await this.waitAndClick('#e2eDoCreateForum');
        logMessage(`Waiting for title ...`);
        const actualTitle = await this.waitAndGetVisibleText('h1.dw-p-ttl');
        logMessage(`Done? The forum title is: "${actualTitle}"`);
        tyAssert.eq(actualTitle, forumTitle);
      },
    };


    topbar = {
      isVisible: async (): Pr<Bo> => {
        return await this.isVisible('.esTopbar');
      },

      waitForVisible: async () => {  // old name? use waitForMyMenuVisible instead only?
        await this.topbar.waitForMyMenuVisible();
      },

      waitForMyMenuVisible: async () => {  // RENAME to waitForMyMenuButtonVisible?
        await this.waitForVisible('.esMyMenu');
      },

      clickBack: async () => {
        await this.repeatUntilAtNewUrl(async () => {
          await this.waitAndClick('.s_Tb_Ln-Bck');
        });
      },

      clickHome: async () => {
        if (await this.isVisible('.esLegal_home_link')) {
          await this.rememberCurrentUrl();
          await this.waitAndClick('.esLegal_home_link');
          await this.waitForNewUrl();
        }
        else {
          // (Already waits for new url.)
          await this.topbar.clickAncestor("Home");
        }
      },

      // MOVE to topic = ... ? because now in the topic by default
      // Next to: waitUntilParentCatIs(catName)
      clickAncestor: async (categoryName: St) => {
        await this.repeatUntilAtNewUrl(async () => {
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
          await utils.tryManyTimes("Clicking ancestor link", 2, async () => {
            const ancLn = ' .esTopbar_ancestors_link';
            const where = await this.isVisible('.s_Tb ' + ancLn) ? '.s_Tb' : '.esPage';
            await this.waitForThenClickText(where + ancLn, categoryName, { tryNumTimes: 2 });
          });
        });
      },

      // COULD FASTER_E2E_TESTS can set  wait:false at most places
      assertMyUsernameMatches: async (username: St, ps: { wait?: Bo } = {}) => {
        if (ps.wait !== false) {
          await this.waitForDisplayed('.esMyMenu .esAvtrName_name');
        }
        await this.assertTextMatches('.esMyMenu .esAvtrName_name', username);
      },

      waitForNumPendingUrgentReviews: async (numUrgent: IntAtLeastOne) => {
        assert.ok(numUrgent >= 1, "Zero tasks won't ever become visible [TyE5GKRBQQ2]");
        await this.waitUntilTextMatches('.esNotfIcon-reviewUrgent', '^' + numUrgent + '$');
      },

      waitForNumPendingOtherReviews: async (numOther: IntAtLeastOne) => {
        assert.ok(numOther >= 1, "Zero tasks won't ever become visible [TyE2WKBPJR3]");
        await this.waitUntilTextMatches('.esNotfIcon-reviewOther', '^' + numOther + '$');
      },

      isNeedsReviewUrgentVisible: async (): Pr<Bo> => {
        return await this.isVisible('.esNotfIcon-reviewUrgent');
      },

      isNeedsReviewOtherVisible: async (): Pr<Bo> => {
        return await this.isVisible('.esNotfIcon-reviewOther');
      },

      getMyUsername: async (): Pr<St> => {
        return await this.waitAndGetVisibleText('.esMyMenu .esAvtrName_name');
      },

      clickLogin: async () => {
        await this.waitAndClick('.esTopbar_logIn');
        await this.waitUntilLoadingOverlayGone();
      },

      clickSignUp: async () => {
        await this.waitAndClick('.esTopbar_signUp');
        await this.waitUntilLoadingOverlayGone();
      },

      clickLogout: async (options: { waitForLoginButton?: Bo,   // RENAME to logout
              waitForLoginDialog?: Bo } = {}) => {
        // Sometimes this scrolls to top, small small steps, annoying, [FASTER_E2E_TESTS]
        // and not needed, right.
        // Can speed up by calling scrollToTop() — done here: [305RKTJ205].
        await this.topbar.openMyMenu();
        await this.waitAndClick('#e2eMM_Logout');
        await this.waitAndClick('.e_ByeD .btn-primary');
        if (options.waitForLoginDialog) {
          await this.waitForDisplayed('.c_AuD');
        }
        else if (options.waitForLoginButton === false) {
          // Then a login dialog will probably have opened now in full screen, with a modal
          // backdrop, so don't wait for any backdrop to disappear.
          // Or we got redirected to an SSO login window.
        }
        else {
          await this.waitUntilModalGone();
          await this.topbar.waitUntilLoginButtonVisible();
        }
        // If on a users profile page, might start reloading something (because different user & perms).
        await this.waitUntilLoadingOverlayGone();
      },

      waitUntilLoginButtonVisible: async () => {
        await this.waitForVisible('.esTopbar_logIn');
      },

      openMyMenu: async () => {
        // We can click in the fixed topbar if it's present, instead of scrolling
        // all the way up to the static topbar.
        let sel = '.s_TbW-Fxd .esMyMenu';
        const fixedScrollbarVisible = await this.isVisible(sel);
        const opts = { mayScroll: !fixedScrollbarVisible };
        if (!fixedScrollbarVisible) {
          sel = '.esMyMenu';
        }
        await this.waitAndClick(sel, opts);
        await this.waitUntilLoadingOverlayGone();
        // Because of a bug in Chrome? Chromedriver? Selenium? Webdriver.io? wait-and-click
        // attempts to click instantly, before the show-menu anim has completed and the elem
        // has appeared. So pause for a short while. [E2EBUG]
        await this.#br.pause(333);
      },

      closeMyMenuIfOpen: async () => {
        if (await this.isVisible('.s_MM .esDropModal_CloseB')) {
          await this.waitAndClick('.s_MM .esDropModal_CloseB');
          await this.waitForGone('.s_MM .esDropModal_CloseB');
        }
      },

      clickGoToAdmin: async () => {
        await this.rememberCurrentUrl();
        await this.topbar.openMyMenu();
        await this.waitAndClick('.esMyMenu_admin a');
        await this.waitForNewUrl();
        await this.waitUntilLoadingOverlayGone();
      },

      navigateToGroups: async () => {
        await this.rememberCurrentUrl();
        await this.topbar.openMyMenu();
        await this.waitAndClick('#te_VwGrps');
        await this.waitForNewUrl();
        await this.groupListPage.waitUntilLoaded();
      },

      clickGoToProfile: async () => {
        await this.rememberCurrentUrl();
        await this.topbar.openMyMenu();
        await this.waitAndClick('#e2eMM_Profile');
        await this.waitForNewUrl();
        await this.waitForVisible(this.userProfilePage.avatarAboutButtonsSelector);
      },

      clickStopImpersonating: async () => {
        let oldName = await this.topbar.getMyUsername();
        let newName;
        await this.topbar.openMyMenu();
        await this.waitAndClick('.s_MM_StopImpB');
        // Wait for page to reload:
        await this.waitForGone('.s_MMB-IsImp');  // first, page reloads: the is-impersonating mark, disappears
        await this.waitForVisible('.esMyMenu');  // then the page reappears
        do {
          newName = await this.topbar.getMyUsername();
        }
        while (oldName === newName);
      },

      searchFor: async (phrase: string) => {
        await this.waitAndClick('.esTB_SearchBtn');
        // The search text field should grab focus, so we can just start typing:
        // But this causes a "RuntimeError" in Webdriver.io v4:
        // this.#br.keys(phrase);
        // This works though (although won't test if has focus):
        await this.waitAndSetValue('.c_SchD input[name="q"]', phrase);
        await this.waitAndClick('.e_SchB');
        await this.searchResultsPage.waitForResults(phrase);
      },

      assertNotfToMe: async () => {
        assert.ok(await this.isVisible('.esTopbar .esNotfIcon-toMe'));
      },

      notfsToMeClass: '.esTopbar .esNotfIcon-toMe',
      otherNotfsClass: '.esTopbar .esNotfIcon-toOthers',

      waitForNumDirectNotfs: async (numNotfs: IntAtLeastOne) => {
        assert.ok(numNotfs >= 1, "Zero notfs won't ever become visible [TyE5GKRBQQ03]");
        await this.waitUntilTextMatches(this.topbar.notfsToMeClass, '^' + numNotfs + '$');
      },

      waitForNoDirectNotfs: async () => {
        await this.waitForGone(this.topbar.notfsToMeClass);
      },

      waitForNumOtherNotfs: async (numNotfs: IntAtLeastOne) => {
        assert.ok(numNotfs >= 1, "Zero notfs won't ever become visible [TyE4ABKF024]");
        await this.waitUntilTextMatches(this.topbar.otherNotfsClass, '^' + numNotfs + '$');
      },

      refreshUntilNumOtherNotfs: async (desiredNumNotfs: Nr) => {
        const millisBetweenRefresh = 15*1000;  // should be > report to server interval [6AK2WX0G]
        let millisLeftToRefresh = millisBetweenRefresh;
        while (true) {
          let isWhat;
          if (desiredNumNotfs === 0) {
            if (!await this.isVisible(this.topbar.otherNotfsClass)) {
              break;
            }
            isWhat = '>= 1';
          }
          else {
            const text = await this.waitAndGetVisibleText(this.topbar.otherNotfsClass);
            const actualNumNotfs = parseInt(text);
            if (actualNumNotfs === desiredNumNotfs) {
              break;
            }
            isWhat = '' + actualNumNotfs;
          }
          const pauseMs = 1000;
          await this.#br.pause(pauseMs);

          // Because of some race condition, in rare cases, notifications won't get marked
          // as seen. Hard to reproduce, only happens 1 in 10 in invisible e2e tests.
          // For now, do this:
          millisLeftToRefresh -= pauseMs;
          if (millisLeftToRefresh < 0) {
            logUnusual(`Refreshing page. Num-other-notfs count is currently ${isWhat} ` +
                `and refuses to become ${desiredNumNotfs}...`);
            await this.#br.refresh();
            millisLeftToRefresh = millisBetweenRefresh;
          }
        }
      },

      waitForNoOtherNotfs: async () => {
        await this.waitForGone(this.topbar.otherNotfsClass);
      },

      openNotfToMe: async (options: { waitForNewUrl?: Bo } = {}) => {
        await this.topbar.openLatestNotf(options);
      },

      openLatestNotf: async (options: { waitForNewUrl?: Bo, toMe?: true } = {}) => {
        await this.topbar.openMyMenu();
        await this.rememberCurrentUrl();
        await this.waitAndClickFirst(
                '.s_MM .dropdown-menu ' + (options.toMe ? '.esNotf-toMe' : '.esNotf'));
        if (options.waitForNewUrl !== false) {
          await this.waitForNewUrl();
        }
      },

      viewAsStranger: async () => {
        await this.topbar.openMyMenu();
        await this.waitAndClick('.s_MM_ViewAsB');
        // Currently there's just one view-as button, namely to view-as-stranger.
        await this.waitAndClick('.s_VAD_Sbd button');
        // Now there's a warning, close it.
        await this.stupidDialog.clickClose();
        // Then another stupid-dialog appears. Wait for a while so we won't click the
        // button in the first dialog, before it has disappeared.
        await this.#br.pause(800);  // COULD give incrementing ids to the stupid dialogs,
                              // so can avoid this pause?
        await this.stupidDialog.close();
      },

      stopViewingAsStranger: async () => {
        await this.topbar.openMyMenu();
        await this.waitAndClick('.s_MM_StopImpB a');
      },

      myMenu: {
        goToAdminReview: async () => {
          await this.topbar.myMenu.goToImpl('#e2eMM_Review');
          await this.adminArea.review.waitUntilLoaded();
        },

        goToDraftsEtc: async () => {
          await this.topbar.myMenu.goToImpl('.e_MyDfsB');
          await this.userProfilePage.draftsEtc.waitUntilLoaded();
        },

        goToImpl: async (selector: St) => {
          await this.rememberCurrentUrl();
          await this.topbar.openMyMenu();
          await this.waitAndClick(selector);
          await this.waitForNewUrl();
        },

        _snoozeIcon: '.s_MMB_Snz .s_SnzI',

        snoozeNotfs: async (ps: SnoozeTime = {}) => {
          tyAssert.not(await this.isVisible(this.topbar.myMenu._snoozeIcon));  // ttt
          await this.waitAndClick('.s_MM_SnzB');
          if (ps.toWhen === 'TomorrowMorning9am') {
            await this.waitAndClickFirst('.s_SnzD_9amBs .btn');
          }
          await this.waitAndClick('.e_SnzB');
          await this.topbar.closeMyMenuIfOpen();
          await this.waitForVisible(this.topbar.myMenu._snoozeIcon);

          if (ps.hours && !ps.minutes) {
            await this.assertTextMatches('.s_MMB_Snz', `${ps.hours}h`);
          }
          if (!ps.hours && ps.minutes) {
            await this.assertTextMatches('.s_MMB_Snz', `${ps.minutes}m`);
          }
        },

        unsnooze: async () => {
          tyAssert.that(await this.isVisible(this.topbar.myMenu._snoozeIcon));  // ttt
          await this.waitAndClick('.s_MM_SnzB');
          await this.waitAndClick('.e_UnSnzB');
          await this.topbar.closeMyMenuIfOpen();
          await this.waitForGone(this.topbar.myMenu._snoozeIcon);
        },

        dismNotfsBtnClass: '.e_DismNotfs',

        markAllNotfsRead: async () => {
          await this.topbar.openMyMenu();
          await this.waitAndClick(this.topbar.myMenu.dismNotfsBtnClass);
        },

        isMarkAllNotfsReadVisibleOpenClose: async (): Pr<Bo> => {
          await this.topbar.openMyMenu();
          await this.waitForVisible('.s_MM_NotfsBs');  // (test code bug: sometimes absent — if 0 notfs)
          const isVisible = await this.isVisible(this.topbar.myMenu.dismNotfsBtnClass);
          await this.topbar.closeMyMenuIfOpen();
          return isVisible;
        },

        unhideTips: async () => {
          await this.waitAndClick('.e_UnhTps');
        },

        unhideAnnouncements: async () => {
          await this.waitAndClick('.e_UnhAnns');
        }
      },

      pageTools: {
        pinPage: async (where: 'Globally' | 'InCategory', ps: { willBeTipsAfter: Bo }) => {
          await this.topbar.pageTools.__openPinPageDialog();
          const pinWhereRadioBtn = where === 'Globally' ? '.e_PinGlb' : '.e_PinCat';
          await this.waitAndClick(pinWhereRadioBtn + ' input');
          await this.waitAndClick('.e_SavPinB');
          if (ps.willBeTipsAfter !== false) {
            await this.helpDialog.waitForThenClose({ shallHaveBodyClass: '.esPinnedOk' });
          }
          await this.waitUntilModalGone();
        },

        __openPinPageDialog: async () => {
          await this.waitAndClick('.dw-a-tools');
          await this.waitUntilDoesNotMove('.e_PinPg');
          await this.waitAndClick('.e_PinPg');
          await this.waitForDisplayed('input[name="pinWhere"]');
        },

        deletePage: async () => {
          await this.waitAndClick('.dw-a-tools');
          await this.waitUntilDoesNotMove('.e_DelPg');
          await this.waitAndClick('.e_DelPg');
          await this.waitUntilModalGone();
          await this.topic.waitUntilPageDeleted();
        },

        restorePage: async () => {
          await this.waitAndClick('.dw-a-tools');
          await this.waitUntilDoesNotMove('.e_RstrPg');
          await this.waitAndClick('.e_RstrPg');
          await this.waitUntilModalGone();
          await this.topic.waitUntilPageRestored();
        },
      },
    };


    watchbar = {
      titleSelector: '.esWB_T_Title',
      unreadSelector: '.esWB_T-Unread',

      open: async () => {
        await this.waitAndClick('.esOpenWatchbarBtn');
        await this.waitForVisible('#esWatchbarColumn');
      },

      openIfNeeded: async () => {
        if (!await this.isVisible('#esWatchbarColumn')) {
          await this.watchbar.open();
        }
      },

      close: async () => {
        await this.waitAndClick('.esWB_CloseB');
        await this.waitUntilGone('#esWatchbarColumn');
      },

      waitForTopicVisible: async (title: string) => {
        await this.waitUntilAnyTextMatches(this.watchbar.titleSelector, title);
      },

      assertTopicVisible: async (title: string) => {
        await this.waitForVisible(this.watchbar.titleSelector);
        await this.assertAnyTextMatches(this.watchbar.titleSelector, title);
      },

      assertTopicAbsent: async (title: St) => {
        await this.waitForVisible(this.watchbar.titleSelector);
        await this.assertNoTextMatches(this.watchbar.titleSelector, title);
      },

      asserExactlyNumTopics: async (num: number) => {
        if (num > 0) {
          await this.waitForVisible(this.watchbar.titleSelector);
        }
        await this.assertExactly(num, this.watchbar.titleSelector);
      },

      numUnreadTopics: async (): Pr<Nr> => {
        return await this.count('.esWB_T-Unread');
      },

      openUnreadTopic: async (index: number = 1) => {
        dieIf(index !== 1, 'unimpl [TyE6927KTS]');
        await this.repeatUntilAtNewUrl(async () => {
          await this.waitAndClick('.esWB_T-Unread');
        });
      },

      waitUntilNumUnreadTopics: async (num: number) => {
        assert.ok(num > 0, 'TyE0578WNSYG');
        await this.waitForAtLeast(num, '.esWB_T-Unread');
        await this.assertExactly(num, '.esWB_T-Unread');
      },

      goToTopic: async (title: St, opts: { isHome?: true, shouldBeUnread?: Bo } = {}) => {
        await this.rememberCurrentUrl();
        const selector = `${opts.shouldBeUnread ? this.watchbar.unreadSelector : ''
                } ${this.watchbar.titleSelector}`;
        const titleOrHome = opts.isHome ? c.WatchbarHomeLinkTitle : title;
        await this.waitForThenClickText(selector, titleOrHome);
        await this.waitForNewUrl();
        await this.assertPageTitleMatches(title);
      },

      clickCreateChat: async () => {
        await this.waitAndClick('#e2eCreateChatB');
      },

      clickCreateChatWaitForEditor: async () => {
        await this.waitAndClick('#e2eCreateChatB');
        await this.waitForVisible('.esEdtr_titleEtc');
      },

      clickViewPeople: async () => {
        await this.waitAndClick('.esWB_T-Current .esWB_T_Link');
        await this.waitAndClick('#e2eWB_ViewPeopleB');
        await this.waitUntilModalGone();
        await this.waitForVisible('.esCtxbar_list_title');
      },

      clickLeaveChat: async () => {
        await this.waitAndClick('.esWB_T-Current .esWB_T_Link');
        await this.waitAndClick('#e2eWB_LeaveB');
        await this.waitUntilModalGone();
        await this.waitForVisible('#theJoinChatB');
      },
    };


    contextbar = {
      openIfNeeded: async () => {
        if (!await this.isDisplayed('#esThisbarColumn')) {
          await this.contextbar.open();
        }
      },

      open: async () => {
        await this.waitAndClick('.esOpenPagebarBtn');
        await this.waitForDisplayed('#esThisbarColumn');
      },

      close: async () => {
        await this.waitAndClick('.esCtxbar_close');
        await this.waitUntilGone('#esThisbarColumn');
      },

      usersHere: {
        switchToThisTab: async () => {
          await this.waitAndClick('.e_CtxBarB');
          await this.waitForDisplayed('.esCtxbar_onlineCol');
        },

        waitFor: async (username: St, ps: { online?: Bo } = {}) => {
          await this.waitForVisible('.esCtxbar_list .esAvtrName_username');
          const onOfflineSel = ps.online
              ? '.esPresence-active'
              : (ps.online === false ? ':not(.esPresence-active)' : '');

          const sel = `.esCtxbar_list .esPresence${onOfflineSel} .esAvtrName_username`;
          await this.waitAndGetElemWithText(sel, username);
        },
      },

      clickAddPeople: async () => {
        await this.waitAndClick('#e2eCB_AddPeopleB');
        await this.waitForVisible('#e2eAddUsD');
      },

      clickUser: async (username: St) => {
        await this.waitForThenClickText('.esCtxbar_list .esAvtrName_username', username);
      },

      assertUserPresent: async (username: St) => {
        await this.waitForVisible('.esCtxbar_onlineCol');
        await this.waitForVisible('.esCtxbar_list .esAvtrName_username');
        const elems: WElm[] = await this.$$('.esCtxbar_list .esAvtrName_username');
        const usernamesPresentSoon: Pr<St>[] = elems.map(async (elem: WElm) => {
          return await elem.getText();
        });
        const usernamesPresent: St[] = await Promise.all(usernamesPresentSoon);
        const namesPresent = usernamesPresent.join(', ');
        logMessage(`Users present: ${namesPresent}`)
        assert.ok(usernamesPresent.length, "No users listed at all");
        assert.ok(_.includes(usernamesPresent, username), "User missing: " + username +
            ", those present are: " + namesPresent);
      },
    };


    createUserDialog = {
      isVisible: async () => {
        return await this.isVisible('.esCreateUser');
      },

      // Most other fns in loginDialog below,  move to here?
    };


    loginDialog = {
      isVisible: async (): Pr<Bo> => {
        return await this.isVisible('.dw-login-modal') &&
                await this.isVisible('.c_AuD');
      },

      refreshUntilFullScreen: async () => {
        let startMs = Date.now();
        let dialogShown = false;
        let lap = 0;
        while (Date.now() - startMs < settings.waitforTimeout) {
          await this.#br.refresh();
          // Give the page enough time to load:
          lap += 1;
          await this.#br.pause(200 * Math.pow(1.5, lap));
          dialogShown = await this.loginDialog.isVisible();
          if (dialogShown)
            break;
        }
        assert.ok(dialogShown, "The login dialog never appeared");
        await this.loginDialog.waitAssertFullScreen();
      },

      waitAssertFullScreen: async () => {
        await this.waitForVisible('.dw-login-modal');
        await this.waitForVisible('.c_AuD');
        // Forum not shown.
        tyAssert.not(await this.isVisible('.dw-forum'));
        tyAssert.not(await this.isVisible('.dw-forum-actionbar'));
        // No forum topic shown.
        tyAssert.not(await this.isVisible('h1'));
        tyAssert.not(await this.isVisible('.dw-p'));
        tyAssert.not(await this.isVisible('.dw-p-ttl'));
        // Admin area not shown.
        tyAssert.not(await this.isVisible('.s_Tb_Ln'));
        tyAssert.not(await this.isVisible('#dw-react-admin-app'));
        // User profile not shown.
        tyAssert.not(await this.isVisible(this.userProfilePage.avatarAboutButtonsSelector));
      },

      clickSingleSignOnButton: async () => {
        await this.waitAndClick('.s_LD_SsoB');
      },

      waitForSingleSignOnButton: async () => {
        await this.waitForDisplayed('.s_LD_SsoB');
      },

      createPasswordAccount: async (data: MemberToCreate | {
            fullName?: St,
            username: St,
            email?: St,
            emailAddress?: St,
            password: St,
            shallBecomeOwner?: true,       // default is false
            willNeedToVerifyEmail?: false, // default is true
           },
            // Legacy:
            shallBecomeOwner?: boolean,
            anyVerifyEmail?: 'THERE_WILL_BE_NO_VERIFY_EMAIL_DIALOG') => {

        // Switch from the guest login form to the create-real-account form, if needed.
        await this.waitForVisible('#e2eFullName');
        if (await this.isVisible('.c_AuD_2SgU')) {
          await this.waitAndClick('.c_AuD_2SgU .c_AuD_SwitchB');
          await this.waitForVisible('#e2ePassword');
        }

        // Dupl code (035BKAS20)

        logMessage('createPasswordAccount: fillInFullName...');
        if (data.fullName) await this.loginDialog.fillInFullName(data.fullName);
        logMessage('fillInUsername...');
        await this.loginDialog.fillInUsername(data.username);
        logMessage('fillInEmail...');
        const theEmail = data.email || data.emailAddress;
        if (theEmail) await this.loginDialog.fillInEmail(theEmail);
        logMessage('fillInPassword...');
        await this.loginDialog.fillInPassword(data.password);
        logMessage('clickSubmit...');
        // In headless Chrome (-i flag), the middle of the button is/can-be 0.2 pixels below
        // the lower edge of any login popup. So scroll to the bottom. [e2e_win_size]
        await this.scrollToBottom();
        await this.loginDialog.clickSubmit();
        logMessage('acceptTerms...');
        await this.loginDialog.acceptTerms(data.shallBecomeOwner || shallBecomeOwner);
        if (data.willNeedToVerifyEmail !== false &&
            anyVerifyEmail !== 'THERE_WILL_BE_NO_VERIFY_EMAIL_DIALOG') {
          logMessage('waitForNeedVerifyEmailDialog...');
          await this.loginDialog.waitForNeedVerifyEmailDialog();
        }
        logMessage('createPasswordAccount: done');
      },

      fillInFullName: async (fullName: St) => {
        await this.waitAndSetValue('#e2eFullName', fullName);
      },

      fillInUsername: async (username: St) => {
        await this.waitAndSetValue('#e2eUsername', username);
      },

      fillInEmail: async (emailAddress: St) => {
        await this.waitAndSetValue('#e2eEmail', emailAddress);
      },

      waitForNeedVerifyEmailDialog: async () => {
        await this.waitForVisible('#e2eNeedVerifyEmailDialog');
      },

      waitForAndCloseWelcomeLoggedInDialog: async () => {
        await this.waitForVisible('#te_WelcomeLoggedIn');
        await this.waitAndClick('#te_WelcomeLoggedIn button');
        await this.waitUntilModalGone();
      },

      fillInPassword: async (password: St) => {
        await this.waitAndSetValue('#e2ePassword', password);
      },

      waitForBadLoginMessage: async () => {
        await this.waitForVisible('.esLoginDlg_badPwd');
      },

      loginWithPassword: async (username: St | Member | { username: St, password: St },
            password?, opts?: { resultInError?: Bo }) => {

        if (!opts && password && _.isObject(password)) {
          opts = <any> password;
          password = null;
        }
        if (_.isObject(username)) {
          dieIf(_.isString(password), 'TyE2AKBF053');
          password = username.password;
          username = username.username;
        }
        const numTabs = await this.numTabs();

        await this.loginDialog.tryLogin(username, password);
        if (opts && opts.resultInError)
          return;
        if (this.#isWhere === IsWhere.LoginPopup) {
          // Wait for this login popup tab/window to close.
          await this.waitForMaxBrowserTabs(numTabs - 1);
          await this.switchBackToFirstTabIfNeeded();
        }
        else {
          await this.waitUntilModalGone();
          await this.waitUntilLoadingOverlayGone();
        }
      },

      loginWithEmailAndPassword: async (emailAddress: St, password: St, badLogin?: 'BAD_LOGIN') => {
        await this.loginDialog.tryLogin(emailAddress, password);
        if (badLogin !== 'BAD_LOGIN') {
          await this.waitUntilModalGone();
          await this.waitUntilLoadingOverlayGone();
        }
      },

      // Embedded discussions do all logins in popups.
      loginWithPasswordInPopup:
          async (username: St | NameAndPassword, password?: St) => {
        await this.swithToOtherTabOrWindow(IsWhere.LoginPopup);
        await this.disableRateLimits();
        if (_.isObject(username)) {
          password = username.password;
          username = username.username;
        }
        const numTabs = await this.numTabs();
        await this.loginDialog.tryLogin(username, password);
        // The popup auto closes after login.
        await this.waitForMaxBrowserTabs(numTabs - 1);
        await this.switchBackToFirstTabOrWindow();
      },

      loginButBadPassword: async (username: St, password: St) => {
        await this.loginDialog.tryLogin(username, password);
        await this.waitForVisible('.esLoginDlg_badPwd');
      },

      tryLogin: async (username: St, password: St) => {
        await this.loginDialog.switchToLoginIfIsSignup();
        await this.loginDialog.fillInUsername(username);
        await this.loginDialog.fillInPassword(password);
        await this.loginDialog.clickSubmit();
      },

      waitForEmailUnverifiedError: async () => {
        await this.waitUntilTextMatches('.modal-body', 'TyEEML0VERIF_');
      },

      waitForAccountSuspendedError: async () => {
        await this.waitUntilTextMatches('.modal-body', 'TyEUSRSSPNDD_');
      },

      waitForNotCreatedPasswordDialog: async () => {
        await this.waitForVisible('.e_NoPwD');
      },

      clickCreatePasswordButton: async () => {
        await this.waitAndClick('.e_NoPwD button');
      },

      signUpAsGuest: async (name: St, email?: St) => { // CLEAN_UP use createPasswordAccount instead? [8JTW4]
        logMessage('createPasswordAccount with no email: fillInFullName...');
        await this.loginDialog.fillInFullName(name);
        logMessage('fillInUsername...');
        const username = name.replace(/[ '-]+/g, '_').substr(0, 20);  // dupl code (7GKRW10)
        await this.loginDialog.fillInUsername(username);
        if (email) {
          logMessage('fillInEmail...');
          await this.loginDialog.fillInEmail(email);
        }
        else {
          logMessage('fillInEmail anyway, because for now, always require email [0KPS2J]');
          await this.loginDialog.fillInEmail(`whatever-${Date.now()}@example.com`);
        }
        logMessage('fillInPassword...');
        await this.loginDialog.fillInPassword("public1234");
        logMessage('clickSubmit...');
        await this.loginDialog.clickSubmit();
        logMessage('acceptTerms...');
        await this.loginDialog.acceptTerms();
        logMessage('waitForWelcomeLoggedInDialog...');
        await this.loginDialog.waitForAndCloseWelcomeLoggedInDialog();
        logMessage('createPasswordAccount with no email: done');
        // Took forever: waitAndGetVisibleText, [CHROME_60_BUG]? [E2EBUG] ?
        const nameInHtml = await this.waitAndGetText('.esTopbar .esAvtrName_name');
        tyAssert.eq(nameInHtml, username);
      },

      logInAsGuest: async (name: St, email_noLongerNeeded?: St) => { // CLEAN_UP [8JTW4] is just pwd login?
        const username = name.replace(/[ '-]+/g, '_').substr(0, 20);  // dupl code (7GKRW10)
        logMessage('logInAsGuest: fillInFullName...');
        await this.loginDialog.fillInUsername(name);
        logMessage('fillInPassword...');
        await this.loginDialog.fillInPassword("public1234");
        logMessage('clickSubmit...');
        await this.loginDialog.clickSubmit();
        logMessage('logInAsGuest with no email: done');
        const nameInHtml = await this.waitAndGetVisibleText('.esTopbar .esAvtrName_name');
        dieIf(nameInHtml !== username, `Wrong username in topbar: ${nameInHtml} [EdE2WKG04]`);
      },

      // For guests, there's a combined signup and login form.
      signUpLogInAs_Real_Guest: async (name: St, email?: St) => {  // RENAME remove '_Real_' [8JTW4]
        await this.loginDialog.fillInFullName(name);
        if (email) {
          await this.loginDialog.fillInEmail(email);
        }
        await this.loginDialog.clickSubmit();
        await this.loginDialog.acceptTerms(false);
      },

      clickCreateAccountInstead: async () => {
        await this.waitAndClick('.c_AuD_2SgU .c_AuD_SwitchB');
        await this.waitForVisible('.esCreateUser');
        await this.waitForVisible('#e2eUsername');
        await this.waitForVisible('#e2ePassword');
      },

      switchToLoginIfIsSignup: async () => {
        // Switch to login form, if we're currently showing the signup form.
        await this.waitUntil(async () => {
          if (await this.isVisible('.esCreateUser')) {
            await this.waitAndClick('.c_AuD_2LgI .c_AuD_SwitchB');
            // Don't waitForVisible('.dw-reset-pswd') — that can hang forever (weird?).
          }
          else if (await this.isVisible('.dw-reset-pswd')) {
            // Then the login form is shown, fine.
            return true;
          }
        }, {
          message: `Switching to login dialog`
        });
      },


      createGmailAccount: async (data: { email: St, password: St, username: St },
            ps: { isInPopupAlready?: true, shallBecomeOwner?: Bo,
                anyWelcomeDialog?: 'THERE_WILL_BE_NO_WELCOME_DIALOG',
                isInFullScreenLogin?: Bo } = {}) => {

        await this.loginDialog.loginWithGmail(
              data, ps.isInPopupAlready, { isInFullScreenLogin: ps.isInFullScreenLogin });
        // This should be the first time we login with Gmail at this site, so we'll be asked
        // to choose a username.
        // Not just #e2eUsername, then might try to fill in the username in the create-password-
        // user fields which are still visible for a short moment. Dupl code (2QPKW02)
        logMessage("filling in username ...");
        await this.waitAndSetValue('.esCreateUserDlg #e2eUsername',
                data.username, { checkAndRetry: true });
        await this.loginDialog.clickSubmit();
        logMessage("accepting terms ...");
        await this.loginDialog.acceptTerms(ps.shallBecomeOwner);

        if (ps.anyWelcomeDialog !== 'THERE_WILL_BE_NO_WELCOME_DIALOG') {
          logMessage("waiting for and clicking ok in welcome dialog...");
          await this.loginDialog.waitAndClickOkInWelcomeDialog();
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
          await this.waitUntilModalGone();
          await this.waitUntilLoadingOverlayGone();
        }
        logMessage("... done signing up with Gmail.");
      },

      loginWithGmail: async (data: { email: St, password: St },
            isInPopupAlready: Bo | U,
            ps?: { stayInPopup?: Bo, isInFullScreenLogin?: Bo, anyWelcomeDialog?: 'THERE_WILL_BE_NO_WELCOME_DIALOG' }) => {
        // Pause or sometimes the click misses the button. Is the this.#br doing some re-layout?
        await this.#br.pause(150);
        await this.waitAndClick('#e2eLoginGoogle');
        ps = ps || {};

        // Switch to a login popup window that got opened, for Google:
        if (!isInPopupAlready && !ps.isInFullScreenLogin) {
          logMessage(`Switching to login popup ...`);
          await this.swithToOtherTabOrWindow(IsWhere.External);
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
            const googleLoginDone = await this.isExisting('.dw-login-modal');
            logMessageIf(googleLoginDone,
                `Got logged in directly at Google`);

            const googleAndTalkyardLoginDone =
                    await this.isExisting('.esMyMenu .esAvtrName_name');
            logMessageIf(googleAndTalkyardLoginDone,
                `Got logged in directly at both Google and Talkyard`);

            if (googleLoginDone || googleAndTalkyardLoginDone)
              return;
          }
          else if (await this.loginDialog.loginPopupClosedBecauseAlreadyLoggedIn()) {
            // We're back in Talkyard.
            await this.switchBackToFirstTabOrWindow();
            return;
          }
          try {
            if (await this.isExisting(emailInputSelector)) {
              // That's a Gmail login widget. Continue with Gmail login.
              break;
            }
          }
          catch (dummy) {
            logMessage(`didn't find ${emailInputSelector}, ` +
                "tab closed? already logged in? [EdM5PKWT0B]");
          }
          await this.#br.pause(PollMs);
        }

        await this.#br.pause(250);
        logMessage(`typing Gmail email: ${data.email}...`);
        await this.waitAndSetValue(emailInputSelector, data.email, { checkAndRetry: true });

        await this.waitForMaybeDisplayed(emailNext, { timeoutMs: 1000 });
        if (await this.isExisting(emailNext)) {
          logMessage(`clicking ${emailNext}...`);
          await this.waitAndClick(emailNext);
        }

        await this.#br.pause(250);
        logMessage("typing Gmail password...");
        await this.waitAndSetValue(passwordInputSelector, data.password, { checkAndRetry: true });

        await this.waitForMaybeDisplayed(passwordNext, { timeoutMs: 1000 });
        if (await this.isExisting(passwordNext)) {
          logMessage(`clicking ${passwordNext}...`);
          await this.waitAndClick(passwordNext);
        }

        /*
        this.waitAndClick('#signIn');
        this.waitForEnabled('#submit_approve_access');
        this.waitAndClick('#submit_approve_access'); */

        // If you need to verify you're a human:
        // this.#br.deb ug();

        if (!isInPopupAlready && (!ps || !ps.stayInPopup)) {
          logMessage("switching back to first tab...");
          await this.switchBackToFirstTabOrWindow();
        }
      },


      createGitHubAccount: async (ps: { username: St, password: St, shallBecomeOwner: Bo,
            anyWelcomeDialog?: 'THERE_WILL_BE_NO_WELCOME_DIALOG',
            alreadyLoggedInAtGitHub: Bo }) => {

        // This should fill in email (usually) and username (definitely).
        await this.loginDialog.logInWithGitHub(ps);

        await this.loginDialog.clickSubmit();
        await this.loginDialog.acceptTerms(ps.shallBecomeOwner);
        if (ps.anyWelcomeDialog !== 'THERE_WILL_BE_NO_WELCOME_DIALOG') {
          await this.loginDialog.waitAndClickOkInWelcomeDialog();
        }
        await this.waitUntilModalGone();
        await this.waitUntilLoadingOverlayGone();
      },

      logInWithGitHub: async (ps: { username: St, password: St, alreadyLoggedInAtGitHub: Bo }) => {
        logMessage("Clicking GitHub login");
        await this.waitAndClick('#e2eLoginGitHub');

        if (ps.alreadyLoggedInAtGitHub) {
          // The GitHub login window will auto-log the user in an close directly.
          await this.waitForVisible('.esCreateUserDlg');
          return;
        }

        //if (!isInPopupAlready)
        logMessage("Switching to GitHub login popup...");
        await this.swithToOtherTabOrWindow(IsWhere.External);

        logMessage("Typing GitHub username ...");
        await this.waitForDisplayed('.auth-form-body');
        await this.waitAndSetValue('.auth-form-body #login_field', ps.username);
        await this.#br.pause(340); // so less risk GitHub think this is a computer?

        logMessage("Typing GitHub password ...");
        await this.waitAndSetValue('.auth-form-body #password', ps.password);
        await this.#br.pause(340); // so less risk GitHub think this is a computer?

        // GitHub might ask if we want cookies — yes we do.
        const cookieYesSelector =
                '.js-main-cookie-banner .js-cookie-consent-accept-all';
        if (await this.isExisting(cookieYesSelector)) {
          await this.waitAndClick(cookieYesSelector);
        }

        logMessage("Submitting GitHub login form ...");
        await this.waitAndClick('.auth-form-body input[type="submit"]');
        while (true) {
          await this.#br.pause(200);
          try {
            if (await this.isVisible('#js-oauth-authorize-btn')) {
              logMessage("Authorizing Talkyard to handle this GitHub login ... [TyT4ABKR02F]");
              await this.waitAndClick('#js-oauth-authorize-btn');
              break;
            }
          }
          catch (ex) {
            if (await isWindowClosedException(ex)) {
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
        await this.switchBackToFirstTabOrWindow();
      },


      createFacebookAccount: async (
            user: { email: St, password: St, username: St },
            ps: {
              shallBecomeOwner?: Bo,
              mustVerifyEmail?: Bo,
              //anyWelcomeDialog?: 'THERE_WILL_BE_NO_WELCOME_DIALOG',
            } = {}) => {

        await this.loginDialog.loginWithFacebook(user);

        // This should be the first time we login with Facebook at this site,
        // so we'll be asked to choose a username.
        // Not just #e2eUsername, then might try to fill in the username in the create-password-
        // user fields which are still visible for a short moment. Dupl code (2QPKW02)
        logMessage("typing Facebook user's new username...");
        await this.waitAndSetValue('.esCreateUserDlg #e2eUsername', user.username);
        await this.loginDialog.clickSubmit();
        await this.loginDialog.acceptTerms(ps.shallBecomeOwner);

        // (Optionally, could verify a "Welcome" or "Verify your email addr"
        // dialog pops up.)

        // Talkyard doesn't assume that FB verifies people's email addresses.
        // Need to click an email verif link:  (unless the site settings
        // don't require verified emails)
        if (ps.mustVerifyEmail !== false) {
          const siteId = await this.getSiteId();
          const link = await server.waitAndGetLastVerifyEmailAddressLinkEmailedTo(
                  siteId, user.email);
          await this.go2(link);
          await this.waitAndClick('#e2eContinue');
        }
      },

      loginWithFacebook: async (data: {
            email: string, password: string }, isInPopupAlready?: boolean) => {
        // Pause or sometimes the click misses the button. Is the this.#br doing some re-layout?
        await this.#br.pause(100);
        await this.waitAndClick('#e2eLoginFacebook');

        // In Facebook's login popup window:
        if (!isInPopupAlready)
          await this.swithToOtherTabOrWindow(IsWhere.External);

        // We'll get logged in immediately, if we're already logged in to Facebook. Wait for
        // a short while to find out what'll happen.
        while (true) {
          if (await this.loginDialog.loginPopupClosedBecauseAlreadyLoggedIn()) {
            await this.switchBackToFirstTabOrWindow();
            return;
          }
          try {
            if (await this.isExisting('#email'))
              break;
          }
          catch (dummy) {
            logMessage("didn't find #email, tab closed? already logged in? [EdM5PKWT0]");
          }
          await this.#br.pause(300);
        }

        // Facebook asks if we want cookies — yes we do. And Facebook sometimes
        // renames the ok-cookies button.
        //const cookieYesSelector = '[data-testid="cookie-policy-banner-accept"]';
        // (There's yet another cookie button, cookieYesBtn2, below.)
        const cookieYesBtn1 = '[data-testid="cookie-policy-dialog-accept-button"]';
        if (await this.isExisting(cookieYesBtn1)) {
          logMessage("Accepting cookies 1 ...");
          await this.waitAndClick(cookieYesBtn1);
        }

        logMessage("typing Facebook user's email and password...");
        await this.#br.pause(340); // so less risk Facebook think this is a computer?
        await this.waitAndSetValue('#email', data.email);
        await this.#br.pause(380);
        await this.waitAndSetValue('#pass', data.password);
        await this.#br.pause(280);

        // Facebook recently changed from <input> to <button>. So just find anything with type=submit.
        logMessage("submitting Facebook login dialog...");
        await this.waitAndClick('#loginbutton'); // or: [type=submit]');

        // Here Facebook sometimes asks:
        //   > You previously logged in to [localhost test app name] with Facebook.
        //   > Would you like to continue?
        // and we need to click Yes:
        const yesBtn = 'button[name="__CONFIRM__"]';

        // And asks about cookies a 2nd time:
        const cookieYesBtn2 = '[aria-label="Allow All Cookies"]';
        // (Or: div or span with the text 'Allow All Cookies' — but clicking it,
        // does nothing. Instead, clicking the ancestor aria-label=... works.)

        await this.waitUntil(async () => {
          if (await this.loginDialog.loginPopupClosedBecauseAlreadyLoggedIn()) {
            logMessage(`Popup closed, got no "Would you like to continue?" question.`);
            return true;
          }
          if (await this.createUserDialog.isVisible()) {
            logMessage(`Continuing at Talkyard, same window as Facebook login`);
            logWarningIf(!isInPopupAlready, `But this is the wrong win?`);
            return true;
          }
          try {
            // Suddenly, Sept 2021, FB has added a 2nd cookie button. Who knows why.
            // So let's accept cookies a 2nd time.
            if (await this.tryClickNow(cookieYesBtn2) === 'Clicked') {
              logMessage("Accepted FB cookies 2.");
              // Contiue looping afterwards, until the dialog closes or we see the
              // create-user Talkyard fields. Also, it seemed as if the first click
              // once didn't work, who cares why, just click more?
              return false;
            }
            // Previously, there was some confirmation button. Mayeb FB will
            // add it back?
            if (await this.tryClickNow(yesBtn) === 'Clicked') {
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
          await this.switchBackToFirstTabOrWindow();
        }
      },


      createLinkedInAccount: async (ps: { email: string, password: string, username: string,
        shallBecomeOwner: boolean, alreadyLoggedInAtLinkedIn: boolean }) => {
        await this.loginDialog.loginWithLinkedIn({
          email: ps.email,
          password: ps.password,
          alreadyLoggedIn: ps.alreadyLoggedInAtLinkedIn,
        });
        // This should be the first time we login with LinkedInd at this site, so we'll be asked
        // to choose a username.
        // Not just #e2eUsername, then might try to fill in the username in the create-password-
        // user fields which are still visible for a short moment. Dupl code (2QPKW02)
        logMessage("typing LinkedIn user's new username...");
        await this.waitAndSetValue('.esCreateUserDlg #e2eUsername', ps.username);
        await this.loginDialog.clickSubmit();
        await this.loginDialog.acceptTerms(ps.shallBecomeOwner);
        // LinkedIn email addresses might not have been verified (or?) so need
        // to click an email addr verif link.
        const siteId = await this.getSiteId();
        const link = await server.waitAndGetLastVerifyEmailAddressLinkEmailedTo(
                siteId, ps.email);
        await this.go2(link);
        await this.waitAndClick('#e2eContinue');
      },


      loginWithLinkedIn: async (data: { email: string, password: string,
            alreadyLoggedIn?: boolean, isInPopupAlready?: boolean }) => {
        // Pause or sometimes the click misses the button. Is the this.#br doing some re-layout?
        await this.#br.pause(100);
        await this.waitAndClick('#e2eLoginLinkedIn');

        // Switch to LinkedIn's login popup window.
        if (!data.isInPopupAlready)
          await this.swithToOtherTabOrWindow(IsWhere.External);

        // Wait until popup window done loading.
        while (true) {
          if (await this.loginDialog.loginPopupClosedBecauseAlreadyLoggedIn()) {
            await this.switchBackToFirstTabOrWindow();
            return;
          }
          try {
            if (await this.isExisting('input#username'))
              break;
          }
          catch (dummy) {
            logMessage("Didn't find input#username. Tab closed because already logged in?");
          }
          await this.#br.pause(300);
        }

        logMessage("typing LinkedIn user's email and password...");
        await this.#br.pause(340); // so less risk LinkedIn thinks this is a computer?
        // This is over at LinkedIn, and, as username, one can type one's email.
        await this.waitAndSetValue('#username', data.email);
        await this.#br.pause(380);
        await this.waitAndSetValue('#password', data.password);
        await this.#br.pause(280);

        logMessage("submitting LinkedIn login dialog...");
        await this.waitAndClick('button[type="submit"]');

        // If needed, confirm permissions: click an Allow button.
        try {
          for (let i = 0; i < 10; ++i) {
            if (await this.isVisible('#oauth__auth-form__submit-btn')) {
              await this.waitAndClick('#oauth__auth-form__submit-btn');
            }
            else {
              const url = await this.#br.getUrl();
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
          await this.switchBackToFirstTabOrWindow();
        }
      },


      clickLoginWithOidcAzureAd: async () => {
        // Maybe moves — the dialog might scroll in?
        await this.waitAndClick('#e2eLoginoidc\\/azure_test_alias', { maybeMoves: true });
      },


      loginWithOidcAzureAd: async (ps: { email: St, password: St,
            anyWelcomeDialog?: 'THERE_WILL_BE_NO_WELCOME_DIALOG',
            alreadyLoggedIn?: Bo, isInLoginPopupAlready?: Bo, stayInPopup?: Bo,
            fullScreenLogin?: Bo, staySignedIn?: Bo }) => {

        // Switch to LinkedIn's login popup window.
        if (!ps.isInLoginPopupAlready && !ps.fullScreenLogin)
          await this.swithToOtherTabOrWindow(IsWhere.External);

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
            const idpLoginDone =
                    await this.isExisting('.dw-login-modal');
            logMessageIf(idpLoginDone,
                `Got logged in directly at IDP (Azure)`);

            const idpAndTalkyardLoginDone =
                    await this.isExisting('.esMyMenu .esAvtrName_name');
            logMessageIf(idpAndTalkyardLoginDone,
                `Got logged in directly at both IDP (Azure) and Talkyard`);

            if (idpLoginDone || idpAndTalkyardLoginDone)
              return;
          }
          else if (await this.loginDialog.loginPopupClosedBecauseAlreadyLoggedIn()) {
            logMessage(`IDP (Azure) login done, back at Talkyard`);
            await this.switchBackToFirstTabOrWindow();
            return;
          }
          try {
            // Continue below once the IDP input fields appear.
            if (await this.isExisting(emailInputSelector))
              break;
          }
          catch (dummy) {
            logMessage(`Didn't find ${emailInputSelector
                  }. Login popup closed because already logged in?`);
          }
          await this.#br.pause(300);
        }

        logMessage("Typing Azure user's email and password ...");
        await this.#br.pause(340); // so less risk Azure thinks this is a computer?
        // This is over at Azure, and, as username, one can type one's email.
        await this.waitAndSetValue(emailInputSelector, ps.email);
        await this.#br.pause(380);
        await this.waitAndClick(emailNext);
        await this.waitAndSetValue(passwordInputSelector, ps.password);
        await this.#br.pause(280);
        await this.waitAndClick(passwordNext);
        await this.waitUntilTextIs('.text-title', "Stay signed in?");

        logMessage(`submitting Azure login dialog, and ps.staySignedIn: ${
                ps.staySignedIn} ...`);
        await this.waitAndClick(ps.staySignedIn ?
                yesStaySignedInButton : noDontStaySignedInButton);

        // Sometimes also:  .consentHeader  "Permissions requested"
        // Then click:   grantPermsButton

        if (!ps.isInLoginPopupAlready && !ps.stayInPopup && !ps.fullScreenLogin) {
          logMessage("switching back to first tab...");
          await this.switchBackToFirstTabOrWindow();
        }
      },

      checkLinkAccountsTextOk: async (ps: { matchingEmail: St,
            talkyardUsername: St, azureFullName: St, idpName: St }) => {
        // Now there's some info text, and one needs to login again via the IDP,
        // to find out directly, if it works or not.
        await this.assertTextIs('.e_EmAdr', ps.matchingEmail);
        await this.assertTextIs('.e_TyUn', ps.talkyardUsername);
        await this.assertTextIs('.e_NameAtIdp', ps.azureFullName);
        await this.assertTextIs('.e_IdpName', ps.idpName);
      },

      clickYesLinkAccounts: async () => {
        await this.waitAndClick('.e_YesLnActsB');
      },

      clickLogInAgain: async (ps: { isInPopupThatWillClose?: Bo } = {}) => {
        // If clicking quickly, won't work. Why not? This is just a plain
        // ordinary <a href=..>, no Javascript. Whatvever, just:  [E2EBUG]
        await this.pause(444);
        await this.waitAndClick('.e_LogInAgain');

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

      loginPopupClosedBecauseAlreadyLoggedIn: async (): Pr<Bo> => {
        try {
          logMessage("checking if we got logged in instantly... [EdM2PG44Y0]");
          const yes = await this.numWindowsOpen() === 1;// ||  // login tab was auto closed
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

      waitAndClickOkInWelcomeDialog: async () => {
        await this.waitAndClick('#te_WelcomeLoggedIn .btn');
      },

      clickResetPasswordCloseDialogSwitchTab: async () => {
        // This click opens a new tab.
        await this.waitAndClick('.dw-reset-pswd');
        // The login dialog should close when we click the reset-password link. [5KWE02X]
        await this.waitUntilModalGone();
        await this.waitUntilLoadingOverlayGone();
        await this.swithToOtherTabOrWindow();
        await this.waitForVisible('#e2eRPP_emailI');
      },

      clickSubmit: async () => {
        await this.waitAndClick('#e2eSubmit');
      },

      clickCancel: async () => {
        await this.waitAndClick('#e2eLD_Cancel');
        await this.waitUntilModalGone();
      },

      acceptTerms: async (isForSiteOwner?: Bo) => {
        await this.waitForVisible('#e_TermsL');
        await this.waitForVisible('#e_PrivacyL');
        const termsLinkHtml = await (await this.$('#e_TermsL')).getHTML();
        const privacyLinkHtml = await (await this.$('#e_PrivacyL')).getHTML();
        if (isForSiteOwner) {
          // In dev-test, the below dummy urls are defined [5ADS24], but not in prod.
          if (!settings.prod) {
            assert.ok(termsLinkHtml.indexOf('href="/e2e-test-siteOwnerTermsUrl"') >= 0);
            assert.ok(privacyLinkHtml.indexOf('href="/e2e-test-siteOwnerPrivacyUrl"') >= 0);
          }
        }
        else if (isForSiteOwner === false) {
          assert.ok(termsLinkHtml.indexOf('/-/terms-of-use') >= 0);
          assert.ok(privacyLinkHtml.indexOf('/-/privacy-policy') >= 0);
        }
        await this.setCheckbox('.s_TermsD_CB input', true);
        await this.waitAndClick('.s_TermsD_B');
      },

      reopenToClearAnyError: async () => {
        await this.loginDialog.clickCancel();
        await this.topbar.clickLogin();
      },
    };


    resetPasswordPage = {
      submitAccountOwnerEmailAddress: async (emailAddress: St) => {
        logBoring(`Types email address ...`);
        await this.resetPasswordPage.fillInAccountOwnerEmailAddress(emailAddress);
        await this.rememberCurrentUrl();
        logBoring(`Submits ...`);
        await this.resetPasswordPage.clickSubmit();
        logBoring(`Waits for confirmation that a password reset email got sent ...`);
        await this.waitForNewUrl();
        await this.waitForVisible('#e2eRPP_ResetEmailSent');
        logBoring(`... Done`);
      },

      fillInAccountOwnerEmailAddress: async (emailAddress: St) => {
        await this.waitAndSetValue('#e2eRPP_emailI', emailAddress);
      },

      clickSubmit: async () => {
        await this.waitAndClick('#e2eRPP_SubmitB');
      },
    };


    chooseNewPasswordPage = {
      typeAndSaveNewPassword: async (password: St, opts: { oldPassword?: St } = {}) => {
        await this.chooseNewPasswordPage.typeNewPassword(password);
        if (!opts.oldPassword) {
          // There's a <span> with the below class, just to show this test that there's
          // no type-old-password input field.
          assert.ok(await this.isExisting('.e_NoOldPwI'));
        }
        await this.chooseNewPasswordPage.submit();
        await this.chooseNewPasswordPage.waitUntilPasswordChanged();
      },

      typeNewPassword: async (password: St) => {
        await this.waitAndSetValue('#e2ePassword', password);
      },

      submit: async () => {
        await this.waitAndClick('.e_SbmNewPwB');
      },

      waitUntilPasswordChanged: async () => {
        // Stays at the same url.
        await this.waitForVisible("#e2eRPP_PasswordChanged");
      },

      navToHomepage: async () => {
        logMessage("Following homepage link...");
        await this.repeatUntilAtNewUrl(async () => {
          await this.waitAndClick('a[href="/"]');
        });
      },
    }


    pageTitle = {
      clickEdit: async () => {
        await this.waitAndClick('#e2eEditTitle');
      },

      editTitle: async (title: string) => {
        await this.waitAndSetValue('#e2eTitleInput', title);
      },

      save: async () => {
        await this.waitAndClick('.e_Ttl_SaveB');
        await this.pageTitle.waitForVisible();
      },

      waitForVisible: async () => {
        await this.waitForVisible('.dw-p-ttl h1');
      },

      openAboutAuthorDialog: async () => {
        const selector = '.dw-ar-p-hd .esP_By';
        await this.waitForVisible(selector);
        await this.topic.clickPostActionButton(selector);
        await this.waitForVisible('.esUsrDlg');
      },

      assertMatches: async (regex: string | RegExp) => {
        await this.assertPageTitleMatches(regex);
      },

      // Also see this.assertWholePageHidden().
      assertPageHidden: async () => {
        await this.pageTitle.waitForVisible();
        assert.ok(await this.pageTitle.__isEyeOffVisible());
      },

      assertPageNotHidden: async () => {
        await this.pageTitle.waitForVisible();
        assert.ok(!await this.pageTitle.__isEyeOffVisible());
      },

      __isEyeOffVisible: async (): Pr<Bo> =>
        await this.isVisible('.dw-p-ttl .icon-eye-off'),


      __changePageButtonSelector: '.dw-p-ttl .dw-clickable',

      openChangePageDialog: async () => {
        await this.waitAndClick(this.pageTitle.__changePageButtonSelector);
        await this.topic.waitUntilChangePageDialogOpen();
      },

      canBumpPageStatus: async (): Pr<Bo>=> {
        return await this.isVisible(this.pageTitle.__changePageButtonSelector);
      },
    }


    forumButtons = {
      clickEditIntroText: async () => {
        await this.waitAndClick('.esForumIntro_edit');
        await this.waitAndClick('#e2eEID_EditIntroB');
        await this.waitUntilModalGone();
      },

      clickRemoveIntroText: async () => {
        await this.waitAndClick('.esForumIntro_edit');
        await this.waitAndClick('#e2eEID_RemoveIntroB');
        await this.waitUntilModalGone();
      },

      clickViewCategories: async () => {
        await this.waitAndClick('#e_ViewCatsB');
      },

      viewTopics: async (ps: { waitForTopics?: false } = {}) => {
        await this.waitAndClick('#e2eViewTopicsB');
        if (ps.waitForTopics !== false) {
          await this.forumTopicList.waitForTopics();
        }
      },

      clickViewNew: async (): Pr<Vo> => {
        await this.waitAndClick('#e_SortNewB');
      },

      clickCreateCategory: async () => {
        await this.waitAndClick('#e2eCreateCategoryB');
      },

      clickEditCategory: async () => {
        await this.waitAndClick('.s_F_Ts_Cat_Edt');
        // Wait until slide-in animation done, otherwise subsequent clicks inside
        // the dialog might miss.
        await this.waitForVisible('#t_CD_Tabs');
        await this.waitUntilDoesNotMove('#t_CD_Tabs');
      },

      clickCreateTopic: async () => {
        await this.waitAndClick('#e2eCreateSth');
      },

      getCreateTopicButtonText: async (): Pr<St> => {
        return await this.waitAndGetVisibleText('#e2eCreateSth');
      },

      assertNoCreateTopicButton: async () => {
        // Wait until the button bar has loaded.
        await this.waitForVisible('#e_ViewCatsB');
        assert.ok(!await this.isVisible('#e2eCreateSth'));
      },

      listDeletedTopics: async () => {
        await this.waitAndClick('.esForum_filterBtn');
        await this.waitAndClick('.s_F_BB_TF_Dd');
        await this.forumTopicList.waitForTopics();
      },
    }


    forumTopicList = {  // RENAME to topicList
      titleSelector: '.e2eTopicTitle a',  // <– remove, later: '.esF_TsL_T_Title',  CLEAN_UP
      hiddenTopicTitleSelector: '.e2eTopicTitle a.icon-eye-off',

      goHere: async (ps: { origin?: St, categorySlug?: St } = {}) => {
        const origin = ps.origin || '';
        await this.go(origin + '/latest/' + (ps.categorySlug || ''));
      },

      waitUntilKnowsIsEmpty: async () => {
        await this.waitForVisible('#e2eF_NoTopics');
      },

      clickEditCategory: () => die('TyE59273',
            "Use forumButtons.clickEditCategory() instead"),

      waitForCategoryName: async (name: St, ps: { isSubCat?: true } = {}) => {
        const selector = ps.isSubCat ? '.s_F_Ts_Cat_Ttl-SubCat' : '.s_F_Ts_Cat_Ttl';
        await this.waitAndGetElemWithText(selector, name);
      },

      waitForTopics: async (ps: { timeoutMs?: Nr, timeoutIsFine?: Bo } = {}) => {
        await this.waitForVisible('.e2eF_T', ps);  // was timeoutMs: 1000 why?
      },

      waitForTopicVisible: async (title: St) => {
        await this.waitUntilAnyTextMatches(this.forumTopicList.titleSelector, title);
      },

      clickLoadMore: async (opts: { mayScroll?: Bo } = {}) => {
        await this.waitAndClick('.load-more', opts);
      },

      switchToCategory: async (toCatName: St) => {
        await this.waitAndClick('.esForum_catsDrop.s_F_Ts_Cat_Ttl');
        await this.waitAndClickSelectorWithText('.s_F_BB_CsM a', toCatName);
        await this.forumTopicList.waitForCategoryName(toCatName);
      },

      clickViewLatest: async () => {
        await this.waitAndClick('#e2eSortLatestB');
        await this.waitUntilGone('.s_F_SI_TopB');
        // Means topics loaded.
        await this.waitForVisible('.e_SrtOrdr-1'); // TopicSortOrder.BumpTime
      },

      viewNewest: async () => {
        await this.forumButtons.clickViewNew();
        await this.waitUntilGone('.s_F_SI_TopB');
        // This means topics loaded:
        await this.waitForVisible('.e_SrtOrdr-2'); // TopicSortOrder.CreatedAt
      },

      clickViewTop: async () => {
        await this.waitAndClick('#e2eSortTopB');
        await this.waitForVisible('.s_F_SI_TopB');
        await this.waitForVisible('.e_SrtOrdr-3'); // TopicSortOrder.ScoreAndBumpTime
      },

      openAboutUserDialogForUsername: async (username: St) => {
        // ~= matches whole words anywhere in the attr value.
        await this.waitAndClickFirst(`.edAvtr[title~="${username}"]`);
      },

      goToTopic: async (title: St) => {   // RENAME to navToTopic
        await this.forumTopicList.navToTopic(title);
      },

      navToTopic: async (title: St) => {
        await this.rememberCurrentUrl();
        await this.waitForThenClickText(this.forumTopicList.titleSelector, title);
        await this.waitForNewUrl();
        await this.assertPageTitleMatches(title);
      },

      assertNumVisible: async (howMany: Nr, ps: { wait?: Bo } = {}) => {
        if (ps.wait) {
          await this.forumTopicList.waitForTopics();
        }
        await this.assertExactly(howMany, '.e2eTopicTitle');
      },

      assertTopicTitlesAreAndOrder: async (titles: St[]) => {
        const els = await this.$$(this.forumTopicList.titleSelector);
        for (let i = 0; i < titles.length; ++i) {
          const titleShouldBe = titles[i];
          const actualTitleElem = els[i];
          if (!actualTitleElem) {
            assert.ok(false, `Title nr ${i} missing, should be: "${titleShouldBe}"`);
          }
          const actualTitle = await actualTitleElem.getText();
          if (titleShouldBe !== actualTitle) {
            assert.ok(false, `Title nr ${i} is: "${actualTitle}", should be: "${titleShouldBe}"`);
          }
        }
      },

      assertTopicVisible: async (title: St) => {
        await this.assertAnyTextMatches(this.forumTopicList.titleSelector, title);
        await this.assertNoTextMatches(this.forumTopicList.hiddenTopicTitleSelector, title);
      },

      assertTopicNrVisible: async (nr: Nr, title: St) => {
        await this.assertNthTextMatches(this.forumTopicList.titleSelector, nr, title);
        await this.assertNoTextMatches(this.forumTopicList.hiddenTopicTitleSelector, title);
      },

      assertTopicNotVisible: async (title: St) => {
        await this.assertNoTextMatches(this.forumTopicList.titleSelector, title);
      },

      assertTopicVisibleAsHidden: async (title: St) => {
        await this.assertAnyTextMatches(this.forumTopicList.hiddenTopicTitleSelector, title);
      },

      getTopicTags: async (ps: { topicUrlPath: St, howManyTags: Nr }): Pr<St[]> => {
        const topicSel = `.c_TpcTtl[href="${ps.topicUrlPath}"] + .dw-p-excerpt `;
        const tagListSel = `${topicSel} .c_TagL`;
        if (ps.howManyTags === 0) {
          // When the topic has appeared, tags should be there too.
          await this.waitForDisplayed(topicSel);
          await this.waitForGone(topicSel + this.widgets.tagList.tagListItemSelector);
          return [];
        }
        else {
          return await this.widgets.tagList.getTagTitles(tagListSel, ps.howManyTags);
        }
      },
    }


    forumCategoryList = {   // RENAME to categoryList
      categoryNameSelector: '.esForum_cats_cat .forum-title',
      subCategoryNameSelector: '.s_F_Cs_C_ChildCs_C',

      goHere: async (origin?: St, opts: { shouldSeeAnyCats?: Bo } = {}) => {
        await this.go((origin || '') + '/categories');
        await this.forumCategoryList.waitForCategories(opts.shouldSeeAnyCats !== false);
      },

      waitForCategories: async (shouldSeeAnyCats: Bo = true) => {
        if (shouldSeeAnyCats) {
          await this.waitForVisible('.s_F_Cs');
        }
        else {
          await this.waitForExist('.s_F_Cs');
          await this.waitForAtMost(0, this.forumCategoryList.categoryNameSelector);
        }
      },

      waitForNumCategoriesVisible: async (num: Nr) => {
        await this.waitForAtLeast(num, this.forumCategoryList.categoryNameSelector);
      },

      namesOfVisibleCategories: async (): Pr<St[]> => {
        const elms: WElm[] = await this.$$(this.forumCategoryList.categoryNameSelector);
        const namesPromises: Pr<St>[] = elms.map(async (e: WElm) => {
          return await e.getText();
        });
        const names: St[] = await Promise.all(namesPromises);
        return names;
      },

      numCategoriesVisible: async (): Pr<Nr> =>
        (await this.$$(this.forumCategoryList.categoryNameSelector)).length,

      numSubCategoriesVisible: async (): Pr<Nr> =>
        (await this.$$(this.forumCategoryList.subCategoryNameSelector)).length,

      isCategoryVisible: async (categoryName: St): Pr<Bo> => {
        return await this.isDisplayedWithText(
                this.forumCategoryList.categoryNameSelector, categoryName);
      },

      isSubCategoryVisible: async (categoryName: St): Pr<Bo> => {
        return await this.isDisplayedWithText(
            this.forumCategoryList.subCategoryNameSelector, categoryName);
      },

      openCategory: async (categoryName: St) => {
        await this.forumCategoryList._openCategoryImpl(
            categoryName, this.forumCategoryList.categoryNameSelector);
      },

      openSubCategory: async (categoryName: St) => {
        await this.forumCategoryList._openCategoryImpl(
            categoryName, this.forumCategoryList.subCategoryNameSelector);
      },

      _openCategoryImpl: async (categoryName: St, selector: St) => {
        await this.repeatUntilAtNewUrl(async () => {
          await this.waitForThenClickText(selector, categoryName);
        });
        await this.waitForVisible('.s_F_Ts_Cat_Ttl');
        const titleSelector = selector === this.forumCategoryList.subCategoryNameSelector
            ? '.s_F_Ts_Cat_Ttl-SubCat'
            : '.s_F_Ts_Cat_Ttl';
        await this.assertTextMatches(titleSelector, categoryName);
      },

      // RENAME to setNotfLevelForCategoryNr?
      setCatNrNotfLevel: async (categoryNr: Nr, notfLevel: PageNotfLevel) => {
        await this.waitAndClickNth('.dw-notf-level', categoryNr);
        await this.notfLevelDropdown.clickNotfLevel(notfLevel);
      },

      // MOVE to forumTopicList?
      assertCategoryNotFoundOrMayNotAccess: async () => {
        await this.assertAnyTextMatches('.dw-forum', '_TyE0CAT');
      }
    }


    categoryDialog = {
      fillInFields: async (data: { name?: St, slug?: St,
            setAsDefault?: Bo, extId?: St }) => {
        if (data.name) {
          await this.waitAndSetValue('#e2eCatNameI', data.name);
        }
        if (data.slug) {
          await this.waitAndClick('#e2eShowCatSlug');
          await this.waitAndSetValue('#e2eCatSlug', data.slug);
        }
        if (data.setAsDefault) {
          await this.waitAndClick('#e2eSetDefCat');
        }
        if (data.extId) {
          await this.waitAndClick('#te_ShowExtId');
          await this.waitAndSetValue('#te_CatExtId', data.extId);
        }
      },

      setParentCategory: async (catName: St) => {
        await this.waitAndClick('.s_CD .e_SelCatB');
        await this.waitAndClickSelectorWithText('.e_CatLs .esExplDrp_entry_title', catName);
        await this.waitUntilTextIs('.s_CD .e_SelCatB', catName);
      },

      clearParentCategory: async () => {
        await this.waitAndClick('.s_CD_0SubCat');
        await this.waitUntilTextIs('.s_CD .e_SelCatB', "None");
      },

      submit: async () => {
        // ---- Some scroll-to-Save-button problem. So do a bit double scrolling.
        await this.scrollIntoViewInPageColumn('#e2eSaveCatB')
        await this.scrollToBottom();
        // ----
        await this.waitAndClick('#e2eSaveCatB');
        await this.waitUntilModalGone();
        await this.waitUntilLoadingOverlayGone();
      },

      cancel: async () => {
        await this.waitAndClick('.e_CancelCatB');
        await this.waitUntilGone('.s_CD');
        await this.waitUntilModalGone();
        await this.waitUntilLoadingOverlayGone();
      },

      setCategoryUnlisted: async () => {
        await this.waitAndClick('#e_ShowUnlRBs');
        await this.waitAndClick('.e_UnlCatRB input');
      },

      setTopicsUnlisted: async () => {
        await this.waitAndClick('#e_ShowUnlRBs');
        await this.waitAndClick('.e_UnlTpcsRB input');
      },

      setNotUnlisted: async () => {
        await this.waitAndClick('#e_ShowUnlRBs');
        await this.waitAndClick('.e_DontUnlRB input');
      },

      deleteCategory: async () => {
        await this.waitAndClick('.s_CD_DelB');
        // Dismiss "Category deleted" message.
        await this.stupidDialog.clickClose();
        await this.categoryDialog.cancel();
      },

      undeleteCategory: async () => {
        await this.waitAndClick('.s_CD_UndelB');
        // Dismiss "Done, category undeleted" message.
        await this.stupidDialog.clickClose();
        await this.categoryDialog.cancel();
      },

      openSecurityTab: async () => {
        await this.waitAndClick('#t_CD_Tabs-tab-2');
        await this.waitForVisible('.s_CD_Sec_AddB');
      },

      securityTab: {
        switchGroupFromTo: async (fromGroupName: St, toGroupName: St) => {
          await this.waitAndClickSelectorWithText('.s_PoP_Un .e_SelGrpB', fromGroupName);
          await this.waitAndClickSelectorWithText(
              '.esDropModal_content .esExplDrp_entry', toGroupName);
        },

        removeGroup: async (groupId: UserId) => {
          await this.waitAndClick(`.s_PoP-Grp-${groupId} .s_PoP_Dl`);
          await this.waitUntilGone(`.s_PoP-Grp-${groupId}`);
        },

        addGroup: async (groupName: St) => {
          await this.waitAndClick('.s_CD_Sec_AddB');
          await this.waitAndClick('.s_PoP-Select-Grp .e_SelGrpB');
          await this.waitAndClickSelectorWithText(
              '.esDropModal_content .esExplDrp_entry', groupName);
        },

        setMayCreate: async (groupId: UserId, may: Bo) => {
          // For now, just click once
          await this.waitAndClick(`.s_PoP-Grp-${groupId} .s_PoP_Ps_P_CrPg input`);
        },

        setMayReply: async (groupId: UserId, may: Bo) => {
          // For now, just click once
          await this.waitAndClick(`.s_PoP-Grp-${groupId} .s_PoP_Ps_P_Re input`);
        },

        setMayEditWiki: async (groupId: UserId, may: Bo) => {
          // For now, just click once
          await this.waitAndClick(`li.s_PoP:last-child .s_PoP_Ps_P_EdWk input`);  // for now
        },

        setMaySee: async (groupId: UserId, may: Bo) => {
          // For now, just click once
          await this.waitAndClick(`.s_PoP-Grp-${groupId} .s_PoP_Ps_P_See input`);
        },
      }
    }


    aboutUserDialog = {
      waitForLoaded: async () => {
        await this.waitUntilLoadingOverlayGone();
        await this.waitForEnabled('.s_UD .e_CloseB');
        await this.waitUntilDoesNotMove('.s_UD .e_CloseB');
      },

      getUsername: async (): Pr<St> => {
        await this.aboutUserDialog.waitForLoaded();
        return await this.waitAndGetVisibleText('.s_UD_Un');
      },

      getBadgeTitles: async (howManyBadges: Nr): Pr<St[]> => {
        // scope more precisely! or might get post tags [precise_tag_sels]
        return this.widgets.tagList.getTagTitles('.s_UD', howManyBadges);
      },

      close: async () => {
        await this.aboutUserDialog.waitForLoaded();
        await this.waitAndClick('.s_UD .e_CloseB');
        await this.waitForGone('.s_UD');
        await this.waitUntilModalGone();
      },

      clickSendMessage: async () => {
        await this.aboutUserDialog.waitForLoaded();
        await this.rememberCurrentUrl();
        await this.waitAndClick('#e2eUD_MessageB');
        await this.waitForNewUrl();
        /*  DO_AFTER having tested this in FF with Wdio 6.0: Remove this:
        // Wait until new-message title can be edited.
        // For some reason, FF is so fast, so typing the title now after new page load, fails
        // the first time  [6AKBR45] [E2EBUG] — but only in an invisible this.#br, and within
        // fractions of a second after page load, so hard to fix. As of 2019-01.
        utils.tryManyTimes("Clearing the title field", 2, () => {
          this.editor.editTitle('');
        }); */
      },

      clickViewProfile: async () => {
        await this.aboutUserDialog.waitForLoaded();
        await this.rememberCurrentUrl();
        await this.waitAndClick('#e2eUD_ProfileB');
        await this.waitForNewUrl();
      },

      clickRemoveFromPage: async () => {
        await this.aboutUserDialog.waitForLoaded();
        await this.waitAndClick('#e2eUD_RemoveB');
        // Later: this.#br.waitUntilModalGone();
        // But for now:  [5FKE0WY2]
        await this.waitForVisible('.esStupidDlg');
        await this.#br.refresh();
      },
    }


    addUsersToPageDialog = {
      focusNameInputField: async () => {
        await this.waitAndClick('#e2eAddUsD .Select-placeholder');
      },

      startTypingNewName: async (chars: St) => {
        // Dupl code. [.react_select]
        await this.waitAndSetValue('#e2eAddUsD .Select-input > input', chars,
            { okayOccluders: '.Select-placeholder', checkAndRetry: true });
      },

      appendChars: async (chars: St) => {
        await (await this.$('#e2eAddUsD .Select-input > input')).addValue(chars);
      },

      hitEnterToSelectUser: async () => {
        // Dupl code. [.react_select]
        // Might not work in Firefox. Didn't in wdio v4.
        // Doesn't work with DevTools; types the letters in "Return" instead. [E2EBUG]
        // But works with WebDriver / Selenium.
        logWarningIf(settings.useDevtoolsProtocol, `\n\n` +
              `this.#br.keys(['Return'])  won't work with DevTools!  ` +
              `Just types "Return" instead\n\n`);
        await this.#br.keys(['Return']);
      },

      addOneUser: async (username: St) => {
        await this.addUsersToPageDialog.focusNameInputField();
        await this.addUsersToPageDialog.startTypingNewName(
            // Clicking Return = complicated!  Only + \n  works in FF:  [E2EENTERKEY]
            // The Select input is special: the <input> is occluded, but still works fine.
            // Update: '\n' stopped working properly in Wdio v6?  Try with 'Enter' again.
            // username + '\n');
            username);

        await this.addUsersToPageDialog.hitEnterToSelectUser();


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

      submit: async (ps: { closeStupidDialogAndRefresh?: true } = {}) => {
          // Sometimes the click fails (maybe the dialog resizes, once a member is selected, so
          // the Submit button moves a bit?). Then, the Add More Group Members button will
          // remain occluded.
        const submitSelector = '#e2eAddUsD_SubmitB';
        await utils.tryManyTimes(`Submit members`, 2, async () => {
          await this.waitAndClick(submitSelector);
          const isGone = await this.waitUntilGone(submitSelector, {
                  timeoutMs: 2000, timeoutIsFine: true });
          if (!isGone)
            throw `Not yet gone: ${submitSelector}`;
        });
        // Later: this.#br.waitUntilModalGone();
        // But for now:  [5FKE0WY2]
        if (ps.closeStupidDialogAndRefresh) {
          await this.waitForVisible('.esStupidDlg');
          await this.#br.refresh();
        }
      }
    };


    editor = {
      editTitle: async (title: St, opts: { checkAndRetry?: true } = {}) => {
        await this.waitAndSetValue('.esEdtr_titleEtc_title', title, opts);
      },

      isTitleVisible: async () => {
        await this.waitForDisplayed('.editor-area');
        return await this.isVisible('.editor-area .esEdtr_titleEtc_title');
      },

      getTitle: async (): Pr<St> => {
        return await (await this.$('.editor-area .esEdtr_titleEtc_title')).getText();
      },

      waitForSimilarTopics: async () => {
        await this.waitForVisible('.s_E_SimlTpcs');
      },

      numSimilarTopics: async (): Pr<Nr> => {
        return await this.count('.s_E_SimlTpcs_L_It');
      },

      isSimilarTopicTitlePresent: async (title: St): Pr<Bo> => {
        const text = await this.waitAndGetVisibleText('.s_E_SimlTpcs')
        return text.search(title) >= 0;
      },

      selectAllText: async () => {
        await this.editor.__setSelectionRange('SelectAll');
      },

      moveCursorToEnd: async () => {
        // Move cursor to the end.  This:
        //await this.#br.keys(Array('Control', 'End'));
        // Or:
        await this.editor.__setSelectionRange('MoveToEnd');
      },

      __setSelectionRange: async (doWhat: 'SelectAll' | 'MoveToEnd') => {
        await this.#br.execute(function(doWhat) {
          var textarea = document.querySelector('.esEdtr_textarea');
          var textLen = textarea['value'].length;
          const all = doWhat === 'SelectAll';
          textarea['setSelectionRange'](all ? 0 : textLen, textLen);
        }, doWhat);
      },

      /// Didn't need now, but maybe will be useful later?
      /*
      isCursorAtEnd: async (): Pr<Bo> => {
        return await this.#br.execute(function() {
          var textarea = document.querySelector('.esEdtr_textarea');
          var textLen = textarea['value'].length;
          var selStart = textarea['selectionStart'];
          return selStart === textLen;
        });
      }, */

      typeChar: async (char: St, ps: { append?: Bo } = {}) => {
        await this.switchToEmbEditorIframeIfNeeded();
        await this.focus('.esEdtr_textarea');
        if (ps.append) {
          await this.editor.moveCursorToEnd();
        }
        await this.#br.keys(Array(char));
      },

      editText: async (text: St, opts: {
          timeoutMs?: number, checkAndRetry?: true,
          append?: boolean, skipWait?: true } = {}) => {
        await this.switchToEmbEditorIframeIfNeeded();
        await this.waitAndSetValue('.esEdtr_textarea', text, opts);
      },

      getText: async (): Pr<St> => {
        return await this.waitAndGetValue('.editor-area textarea');
      },

      openTopicTypeDropdown: async () => {
        await this.waitAndClick('.esTopicType_dropdown');
      },

      closeTopicTypeDropdown: async () => {
        await this.waitAndClick('.esDropModal_CloseB');
      },

      canClickShowMoreTopicTypes: async (): Pr<Bo> => {
        await this.waitForDisplayed('#te_DiscO');
        return await this.isVisible('.esPageRole_showMore');
      },

      setTopicType: async (type: PageRole) => {
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
        await this.editor.openTopicTypeDropdown();
        if (needsClickMore) {
          await this.waitAndClick('.esPageRole_showMore');
        }
        await this.waitAndClick(optionId);
        await this.waitUntilModalGone();
      },

      uploadFile: async (whichDir: 'TargetDir' | 'TestMediaDir', fileName: St,
            ps: { waitForBadExtErr?: Bo, waitForTooLargeErr?: Bo, allFine?: false } = {}
            ) => {
        //this.waitAndClick('.e_UplB');
        // There'll be a file <input> not interactable error, unless we change
        // its size to sth larger than 0 x 0.
        await this.waitForExist('.e_EdUplFI');
        await this.#br.execute(function() {
          var elem = document.querySelector('.e_EdUplFI');
          // Use ['style'] because this:  elem.style  causes a compilation error.
          elem['style'].width = '70px';
          elem['style'].height = '20px';
        });
        await this.waitAndSelectFile('.e_EdUplFI', whichDir, fileName);
        if (ps.waitForBadExtErr) {
          // If there's no extension, then waitForExist(), not waitForVisibleText().
          const sel = '.s_UplErrD .s_UplErrD_UplNm';
          const lastIx = fileName.lastIndexOf('.')
          0 <= lastIx && lastIx <= fileName.length - 2
                ? await this.waitForVisibleText(sel)
                : await this.waitForExist(sel);
          await this.stupidDialog.close();
        }
        else if (ps.waitForTooLargeErr) {
          await this.waitForVisibleText('.s_UplErrD .e_FlTooLg');
          await this.stupidDialog.close();
        }
        else if (ps.allFine !== false) {
          tyAssert.not(await this.isVisible('.s_UplErrD'), `Unexpected file upload error`);
        }
      },

      cancelNoHelp: async () => {  // REMOVE just use cancel() now, help dialog removed
        const buttonSelector = '#debiki-editor-controller .e_EdCancelB';
        await this.waitAndClick(buttonSelector);
        // waitForGone won't work — the editor just gets display:none but is still there.
        logWarning(`Trying  this.waitUntilGone(buttonSelector)  although won't work?`);
        await this.waitUntilGone(buttonSelector);  // waitForNotVisible
      },

      cancel: async () => {
        await this.editor.cancelNoHelp();
      },

      closeIfOpen: async () => {
        if (await this.isVisible('#debiki-editor-controller .e_EdCancelB')) {
          await this.editor.cancel();
        }
      },

      switchToSimpleEditor: async () => {
        await this.waitAndClick('.e_EdCancelB'); // could use different class, weird name
        await this.waitForVisible('.esC_Edtr');
      },

      save: async () => {
        await this.switchToEmbEditorIframeIfNeeded();
        await this.editor.clickSave();
        await this.waitUntilLoadingOverlayGone();
      },

      clickSave: async () => {
        await this.waitAndClick('.e_E_SaveB');
      },

      saveWaitForNewPage: async () => {
        await this.rememberCurrentUrl();
        await this.editor.save();
        await this.waitForNewUrl();
      },

      isDraftJustSaved: async (): Pr<Bo> => {
        return await this.isVisible('.e_DfSts-' + c.TestDraftStatus.Saved);
      },

      waitForDraftSaved: async () => {
        await this.waitForVisible('.e_DfSts-' + c.TestDraftStatus.Saved);
      },

      waitForDraftSavedInBrowser: async () => {
        await this.waitForVisible('.e_DfSts-' + c.TestDraftStatus.SavedInBrowser);
      },

      waitForDraftDeleted: async () => {
        await this.waitForVisible('.e_DfSts-' + c.TestDraftStatus.Deleted);
      },

      waitForDraftTitleToLoad: async (text: St) => {
        await this.waitUntilValueIs('.editor-area .esEdtr_titleEtc_title', text);
      },

      waitForDraftTextToLoad: async (text: St) => {
        // Could wait for .e_LdDft to disappear, but not needed —
        // the editor textarea won't appear until any draft has been loaded.
        await this.waitUntilValueIs('.editor-area textarea', text);
      },
    };


    linkPreview = {
      waitUntilLinkPreviewMatches: async (ps: { postNr: PostNr, timeoutMs?: number,
            regex: string | RegExp, whichLinkPreviewSelector?: string,
            inSandboxedIframe: Bo, inDoubleIframe: Bo }) => {
        const linkPrevwSel = ' .s_LnPv' + (ps.whichLinkPreviewSelector || '');
        if (ps.inSandboxedIframe) {
          await this.topic.waitForExistsInIframeInPost({ postNr: ps.postNr,
                iframeSelector: linkPrevwSel + ' iframe',
                yetAnotherIframeInside: ps.inDoubleIframe,
                textToMatch: ps.regex,
                timeoutMs: ps.timeoutMs });
        }
        else {
          const selector: St = this.topic.postBodySelector(ps.postNr) + linkPrevwSel;
          await this.waitForExist(selector, { timeoutMs: ps.timeoutMs });
          if (ps.regex) {
            await this.waitUntilTextMatches(selector, ps.regex);
          }
        }
      },
    };

    preview = {  // RENAME to editorPreview  ?
      __inPagePreviewSelector: '.s_P-Prvw',
      __inEditorPreviewSelector: '#t_E_Preview',

      exists: async (selector: St, opts: { where: 'InEditor' | 'InPage' }): Pr<Bo> => {
        return await this.preview.__checkPrevw(opts, async (prevwSelector: St) => {
          return await this.isExisting(prevwSelector + selector);
        });
      },

      waitUntilGone: async () => {
        await this.waitForGone(this.preview.__inPagePreviewSelector);
        await this.waitForGone(this.preview.__inEditorPreviewSelector);
      },

      waitForExist: async (
            selector: St, opts: { where: 'InEditor' | 'InPage', howMany?: Nr }) => {
        await this.preview.__checkPrevw(opts, async (prevwSelector: St) => {
          await this.waitForExist(prevwSelector + selector, { howMany: opts.howMany });
        });
      },

      waitForDisplayedInEditor: async () => {
        await this.waitForDisplayed(this.preview.__inEditorPreviewSelector);
      },

      waitUntilPreviewHtmlIncludes: async (text: St,
            opts: { where: 'InEditor' | 'InPage', whichLinkPreviewSelector?: St }) => {
        await this.preview.__checkPrevw(opts, async (prevwSelector: St) => {
          await this.waitUntilHtmlIncludes(prevwSelector, text);
        });
      },

      waitUntilPreviewHtmlMatches: async (text: St,
            opts: { where: 'InEditor' | 'InPage', whichLinkPreviewSelector?: St }) => {
        await this.preview.__checkPrevw(opts, async (prevwSelector: St) => {
          await this.waitUntilHtmlMatches(prevwSelector, text);
        });
      },

      // ^--REMOVE, use --v  instead
      /// Matches text in 1) Ty's edits preview, and also in 2) link previews
      /// in Ty's edit perviews. So, if typing a reply with, say, a Twitter tweet link,
      /// there'll be a preview of the reply, and in the preview of the reply,
      /// there's a preview of the link.
      /// And this can appear either in the editor (which is the case, if creating
      /// a new page), or inside the current page (if it already exists), where
      /// the post will appear once saved.
      /// So, a links preview, in a post preview, either in the editor or
      /// in the discussion page.
      ///
      /// The link preview html might be in an iframe in an iframe, because some
      /// external websites include their own iframe, others don't. [dbl_ln_pv_iframe]
      ///
      waitUntilPreviewTextMatches: async (regex: St | RegExp,
            opts: { where: 'InEditor' | 'InPage', whichLinkPreviewSelector?: St,
                  inSandboxedIframe: Bo, inDoubleIframe?: Bo }) => {
        await this.preview.__checkPrevw(opts, async (prevwSelector: St) => {
          if (opts.inSandboxedIframe) {
            await this.switchToFrame(`${prevwSelector}.s_LnPv iframe`);
            if (opts.inDoubleIframe) {
              await this.switchToFrame('iframe');
            }
            await this.waitUntilTextMatches('body', regex);
            if (opts.inDoubleIframe) {
              await this.switchToTheParentFrame({ parentIs: IsWhere.UnknownIframe });
            }
            await this.switchToTheParentFrame();
          }
          else {
            await this.waitUntilTextMatches(`${prevwSelector}.s_LnPv`, regex);  // or just prevwSelector ?
          }
        });
      },

      __checkPrevw: async <R>(opts: { where: 'InEditor' | 'InPage',
              whichLinkPreviewSelector?: St }, fn: (selector: St) => Pr<R>): Pr<R> => {
        const lnPvSelector = opts.whichLinkPreviewSelector || '';
        if (opts.where === 'InEditor') {
          await this.switchToEmbEditorIframeIfNeeded();
          return await fn(`${this.preview.__inEditorPreviewSelector} ${lnPvSelector}`);
        }
        else {
          await this.switchToEmbCommentsIframeIfNeeded();
          return await fn(`${this.preview.__inPagePreviewSelector} ${lnPvSelector}`);
        }
      },
    };


    drafts = {   // or rename to page.postDrafts = ..  ?
      __draftSel: '.s_P-Prvw-NotEd',  // or topic.draftSelector

      assertNumDrafts: async (num: Nr) => {
        await this.assertExactly(num, this.drafts.__draftSel);
      },

      waitUntilNumDrafts: async (num: Nr) => {
        await this.waitForExactly(num, this.drafts.__draftSel);
      },

      waitForNthDraftWithText: async (n: Nr, text: St | RegExp) => {
        await this.waitUntilNthTextMatches(this.drafts.__draftSel, n, text);
      },

      assertNthDraftTextMatches: async (n: Nr, text: St) => {
        await this.assertNthTextMatches(this.drafts.__draftSel, n, text);
      },

      resumeNthDraft: async (n: Nr) => {
        await this.waitAndClickNth('.e_RsmDft', n);
        await this.waitForDisplayed('.s_T_YourPrvw');
        await this.waitForDisplayed('.s_P-Prvw-IsEd');
      },

      deleteNthDraft: async (n: Nr) => {
        const numBefore = await this.count('.e_DelDft');
        await this.waitAndClickNth('.e_DelDft', n);
        await this.stupidDialog.yesIAmSure();
        await this.waitForExactly(numBefore - 1, '.e_DelDft');
      },
    }


    metabar = {   // RENAME to pagebar? [metabar_2_pagebar]
      __myName: '.s_MB_Name',
      __loginBtnSel: '.esMetabar .dw-a-login',
      __logoutBtnSel: '.esMetabar .dw-a-logout',
      __anyLogoutBtnSel: '.dw-a-logout',

      isVisible: async (): Pr<Bo> => {
        return await this.isVisible('.dw-cmts-tlbr-summary');
      },

      waitForDisplayed: async () => {
        await this.waitForDisplayed('.dw-cmts-tlbr-summary');
      },

      isLoggedIn: async (): Pr<Bo> => {
        return await this.isDisplayed(this.metabar.__myName);
      },

      isLogoutBtnDisplayed: async (): Pr<Bo> => {
        return await this.isDisplayed(this.metabar.__anyLogoutBtnSel);
      },

      clickLogin: async (opts: WaitAndClickPs = {}) => {
        await this.waitAndClick(this.metabar.__loginBtnSel, opts);
      },

      waitForLoginButtonVisible: async () => {
        await this.waitForDisplayed(this.metabar.__loginBtnSel);
      },

      isLoginButtonDisplayed: async (): Pr<Bo> => {
        return await this.isDisplayed(this.metabar.__loginBtnSel);
      },

      waitUntilLoggedIn: async () => {
        await this.waitForMyDataAdded();
        await this.waitForVisible(this.metabar.__myName);
      },

      waitUntilNotLoggedIn: async () => {
        await this.waitForMyDataAdded();
        await this.waitForGone(this.metabar.__myName);
      },

      getMyFullName: async (): Pr<St> => {
        return await this.waitAndGetVisibleText('.s_MB_Name .esP_By_F');
      },

      getMyUsernameInclAt: async (): Pr<St> => {
        return await this.waitAndGetVisibleText('.s_MB_Name .esP_By_U');
      },

      isMyUsernameVisible: async (): Pr<Bo> => {
        return await this.isDisplayed('.s_MB_Name .esP_By_U');
      },

      openMyProfilePageInNewTab: async () => {
        await this.waitAndClick('.s_MB_Name');
        logBoring(`A new tab opens`);
        await this.waitForMinBrowserTabs(2);
      },

      clickLogout: async (ps: { waitForLoginButton?: Bo } = {}) => {
        const wasInIframe = await this.isInIframe();
        await this.waitAndClick('.esMetabar .dw-a-logout');
        await this.waitUntilGone('.esMetabar .dw-a-logout');
        if (!ps.waitForLoginButton)
          return;

        // Is there a race? Any iframe might reload, after logout. Better re-enter it?
        // Otherwise the wait-for .esMetabar below can fail.
        if (wasInIframe) {
          await this.switchToEmbeddedCommentsIrame();
        }
        await this.waitForVisible('.esMetabar');
        await this.waitForGone(this.metabar.__myName);  // later, move to above 'return',  [hide_authn_btns]
      },

      openMetabar: async () => {
        await this.waitAndClick('.dw-page-notf-level');
        await this.waitForVisible('.esMB_Dtls_Ntfs_Lbl');
      },

      openMetabarIfNeeded: async () => {
        if (!await this.isVisible('.esMB_Dtls_Ntfs_Lbl')) {
          await this.metabar.openMetabar();
        }
      },

      chooseNotfLevelWatchAll: async () => {
        await this.waitAndClick('.dw-notf-level');
        await this.waitAndClick('.e_NtfAll');
        await this.waitForGone('.e_NtfAll');
      },

      setPageNotfLevel: async (notfLevel: PageNotfLevel) => {
        await this.switchToEmbCommentsIframeIfNeeded();
        await this.metabar.openMetabarIfNeeded();
        await this.waitAndClick('.dw-notf-level');
        await this.notfLevelDropdown.clickNotfLevel(notfLevel);
      },

      assertPageNotfLevelIs: async (level: PageNotfLevel) => {
        await this.switchToEmbCommentsIframeIfNeeded();
        const actualLevelText = await this.waitAndGetVisibleText('.dw-page-notf-level');
        // Or, if metabar open:  `dw-notf-level s_NfLv-${level}`
        const selector = `.dw-page-notf-level.n_NfLv-${level}`;
        const isCorrectLevel = await this.isVisible(selector);
        if (!isCorrectLevel) {
          assert.fail(`Wrong notf level, expected: ${level} but is (in text): ${
                actualLevelText}`);
        }
      },
    };


    topicTypeExpl = {
      isTopicTypeExplVisible: async (): Pr<Bo> => {
        await this.waitForDisplayed('.dw-p-ttl');
        return await this.isVisible('.s_Pg_TtlExpl');
      }
    };


    topic = {
      waitUntilPageDeleted: async () => {
        await this.waitForVisible('.s_Pg_DdInf');
      },

      waitUntilPageRestored: async () => {
        await this.waitUntilGone('.s_Pg_DdInf');
      },

      isPageDeletedButVisible: async (): Pr<Bo> => {
        return await this.isVisible('.s_Pg_DdInf');
      },

      postHeaderSelector: (postNr: PostNr) => {
        if (postNr === c.BodyNr) return '.dw-ar-p-hd';
        else return `#post-${postNr} .dw-p-hd`;
      },

      postBodySelector: (postNr: PostNr) => {
        if (postNr === c.BodyNr) return '.dw-ar-p';  // +  .dw-p-bd-blk  ? [precise_tag_sels]
        else return `#post-${postNr} .dw-p-bd .dw-p-bd-blk`;
      },

      forAllPostIndexNrElem: async (fn: (index: Nr, postNr: PostNr, elem) => Pr<Vo>) => {
        const postElems: WElm[] = await this.$$('[id^="post-"]');
        for (let index = 0; index < postElems.length; ++index) {
          const elem: WElm = postElems[index];
          const idAttr = await elem.getAttribute('id');
          const postNrStr: string = idAttr.replace('post-', '');
          const postNr: PostNr = parseInt(postNrStr);
          logBoring(`post elem id attr: ${idAttr}, nr: ${postNr}`);
          tyAssert.eq(0, c.TitleNr);
          tyAssert.eq(1, c.BodyNr);
          tyAssert.eq(2, c.FirstReplyNr);
          // The title and body cannot be moved elsewhere on the page.
          if (postNr === c.TitleNr) tyAssert.eq(index, c.TitleNr);
          if (postNr === c.BodyNr) tyAssert.eq(index, c.BodyNr);
          await fn(index, postNr, elem);
        }
      },

      clickHomeNavLink: async () => {
        // this.waitAndClick() results in this error:
        //   Failed to execute 'querySelector' on 'Document':
        //   'a=Home' is not a valid selector.
        // Instead:  [EQSELEC]
        await this.waitForDisplayed(`a=Home`);
        await (await this.$("a=Home")).click();
      },

      waitForLoaded: async () => {
        await this.waitForVisible('.dw-ar-t');
      },

      assertPagePendingApprovalBodyHidden: async () => {
        await this.topic.waitForLoaded();
        assert.ok(await this.topic._isTitlePendingApprovalVisible());
        assert.ok(await this.topic._isOrigPostPendingApprovalVisible());
        assert.ok(!await this.topic._isOrigPostBodyVisible());
      },

      assertPagePendingApprovalBodyVisible: async () => {
        await this.topic.waitForLoaded();
        assert.ok(await this.topic._isTitlePendingApprovalVisible());
        assert.ok(await this.topic._isOrigPostPendingApprovalVisible());
        assert.ok(await this.topic._isOrigPostBodyVisible());
      },

      assertPageNotPendingApproval: async () => {
        await this.topic.waitForLoaded();
        assert.ok(!await this.topic._isOrigPostPendingApprovalVisible());
        assert.ok(await this.topic._isOrigPostBodyVisible());
      },

      getCurCategoryName: async (): Pr<St> => {
        return await this.waitAndGetVisibleText(
              await this.topic.__getCurCatNameSelector());
      },

      movePageToOtherCategory: async (catName: St) => {
        await this.topic.openChangePageDialog();
        await this.waitAndClick('.s_ChPgD .e_SelCatB');
        await this.waitAndClickSelectorWithText('.e_CatLs .esExplDrp_entry_title', catName)
        await this.topic.waitUntilParentCatIs(catName);
      },

      waitUntilParentCatIs: async (catName: St) => {
        const sel = await this.topic.__getCurCatNameSelector();
        await this.waitUntilTextIs(sel, catName);
      },

      __getCurCatNameSelector: async (): Pr<St> => {
        const ancLn = ' .esTopbar_ancestors_link';
        const where = await this.isVisible('.s_Tb ' + ancLn) ? '.s_Tb' : '.esPage';
        return where + ' .s_Tb_Pg_Cs_C:last-child ' + ancLn;
      },

      isPostNrDescendantOf: async (postNr: PostNr, maybeParentNr: PostNr): Pr<Bo> => {
        await this.switchToEmbCommentsIframeIfNeeded();
        return await this.isVisible(
            `#post-${maybeParentNr} + .dw-p-as + .dw-single-and-multireplies #post-${postNr}`);
      },

      isPostNrVisible: async (postNr: PostNr): Pr<Bo> => {
        await this.switchToEmbCommentsIframeIfNeeded();
        return await this.isVisible('#post-' + postNr);
      },

      clickShowMorePosts: async (ps: { nextPostNr: PostNr }) => {
        // This would be fragile, because waitAndClickLast won't
        // scroll [05YKTDTH4]: (only scrolls to the *first* thing)
        //
        //   strangersBrowser.waitAndClickLast('.dw-x-show');
        //
        // Instead:

        const nxtNr = ps.nextPostNr;
        const nrs = `${nxtNr}, ${nxtNr + 1}, ${nxtNr + 2}`;
        const selector = `.s_X_Show-PostNr-${nxtNr}`;

        await utils.tryUntilTrue(`show more posts: ${nrs} ...`, 3, async (): Pr<Bo> => {
          if (await this.isVisible(selector)) {
            await this.waitAndClick(selector, { maybeMoves: true });
          }
          return await this.topic.waitForPostNrVisible(
              ps.nextPostNr, { timeoutMs: 1500, timeoutIsFine: true });
        });
      },

      waitForPostNrVisible: async (postNr: PostNr, ps: { timeoutMs?: Nr,  // RENAME to ...VisibleText?
              timeoutIsFine?: Bo } = {}): Pr<Bo> => {
        await this.switchToEmbCommentsIframeIfNeeded();
        return await this.waitForVisibleText('#post-' + postNr, ps);
      },

      waitForPostAssertTextMatches: async (postNr: PostNr, text: St | RegExp) => {
        dieIf(!_.isString(text) && !_.isRegExp(text),
            "Test broken: `text` is not a string nor a regex [TyEJ53068MSK]");
        await this.switchToEmbCommentsIframeIfNeeded();
        await this.waitForVisibleText(this.topic.postBodySelector(postNr));
        await this.topic.assertPostTextMatches(postNr, text);
      },

      // waitUntilPostTextMatches — see below

      waitUntilPostHtmlMatches: async (postNr: PostNr, regexOrString: St | RegExp | Ay[]) => {
        const selector = this.topic.postBodySelector(postNr);
        await this.waitUntilHtmlMatches(selector, regexOrString)
      },

      assertPostHtmlDoesNotMatch: async (postNr: PostNr, regexOrString: St | RegExp | any[]) => {
        const selector = this.topic.postBodySelector(postNr);
        const html = await (await this.$(selector)).getHTML();
        const badMatch = this._findHtmlMatchMiss(html, false, regexOrString);
        if (badMatch) {
          assert.ok(false,
              `Found text that shouldn't be there [TyE53DTEGJ4]:\n\n  ${badMatch}\n`);
        }
      },

      assertPostOrderIs: async (expectedPostNrs: PostNr[], selector: St = '[id^="post-"]') => {
        dieIf(!expectedPostNrs || !expectedPostNrs.length, `No expected posts [TyEE062856]`);

        // Replace other dupl code with this fn.  [59SKEDT0652]
        await this.switchToEmbCommentsIframeIfNeeded();
        await this.waitForVisible(selector);

        const postElems: WElm[] = await this.$$(selector);

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
          const postElem: WElm = postElems[i];

          tyAssert.ok(postElem && await postElem.isExisting(),
              `Not enough posts on page to compare with ` +
              `expected post nr ${expectedNr} [TyEE2ETOOFEWPOSTSE]`);

          const idAttr = await postElem.getAttribute('id');
          logMessage(`id attr: ${idAttr}, expected nr: ${expectedNr}`);
          tyAssert.eq(idAttr, `post-${expectedNr}`);
        }
      },

      waitForExistsInPost: async (postNr: PostNr, selector: St,
            ps: { timeoutMs?: Nr, howMany?: Nr } = {}) => {
        await this.waitForExist(this.topic.postBodySelector(postNr) + ' ' + selector, ps);
      },

      // Enters an <iframe> in a post, looks for sth, then exits the iframe.
      waitForExistsInIframeInPost: async (ps: { postNr: PostNr, iframeSelector: St,
            yetAnotherIframeInside?: Bo,
            thingInIframeSelector?: St, textToMatch?: St | RegExp,
            timeoutMs?: Nr, howMany?: Nr }) => {
        const complIfrSel = this.topic.postBodySelector(ps.postNr) + ' ' + ps.iframeSelector;
        await this.switchToFrame(complIfrSel, { timeoutMs: ps.timeoutMs });
        if (ps.yetAnotherIframeInside)  {
          await this.switchToFrame('iframe', { timeoutMs: ps.timeoutMs });
        }
        const thingInIframeSelector = ps.thingInIframeSelector || 'body';
        await this.waitForExist(thingInIframeSelector, { timeoutMs: ps.timeoutMs });
        if (ps.textToMatch) {
          await this.waitUntilTextMatches(thingInIframeSelector, ps.textToMatch);
        }
        if (ps.yetAnotherIframeInside)  {
          await this.switchToTheParentFrame({ parentIs: IsWhere.UnknownIframe });
        }
        await this.switchToTheParentFrame();
      },

      postNrContains: async (postNr: PostNr, selector: St) => {
        return await this.isExisting(this.topic.postBodySelector(postNr) + ' ' + selector);
      },

      assertPostNrContains: async (postNr: PostNr, selector: St) => {
        if (!await this.topic.postNrContains(postNr, selector)) {
          assert.fail(`Post ${postNr} doesn't contain selector:  ${selector}`);
        }
      },

      assertPostNrNotContains: async (postNr: PostNr, selector: St) => {
        if (await this.topic.postNrContains(postNr, selector)) {
          assert.fail(`Post ${postNr} contains, but should not, selector:  ${selector}`);
        }
      },

      postNrContainsVisible: async (postNr: PostNr, selector: St): Pr<Bo> => {
        return await this.isVisible(this.topic.postBodySelector(postNr) + ' ' + selector);
      },

      assertPostTextMatches: async (postNr: PostNr, text: St | RegExp) => {
        await this.assertTextMatches(this.topic.postBodySelector(postNr), text, 'regex')
      },

      assertPostTextIs: async (postNr: PostNr, text: St, ps: { wait?: Bo } = {}) => {
        const s = this.topic.postBodySelector(postNr);
        if (ps.wait) await this.waitForVisibleText(s);
        await this.assertTextMatches(s, text, 'exact')
      },

      getPostText: async (postNr: PostNr): Pr<St> => {
        return await this.waitAndGetVisibleText(this.topic.postBodySelector(postNr));
      },

      getPostHtml: async (postNr: PostNr): Pr<St> => {
        return await this.waitAndGetVisibleHtml(this.topic.postBodySelector(postNr));
      },

      waitUntilPostTextIs: async (postNr: PostNr, text: St,
              opts: { thingInPostSelector?: St } = {}) => {
        await this.switchToEmbCommentsIframeIfNeeded();
        const selector =
            `${this.topic.postBodySelector(postNr)} ${opts.thingInPostSelector || ''}`;
        await this.waitUntilTextIs(selector, text);
      },

      waitUntilPostTextMatches: async (postNr: PostNr, regex: St | RegExp,
              opts: { thingInPostSelector?: St } = {}) => {
        await this.switchToEmbCommentsIframeIfNeeded();
        const selector =
            `${this.topic.postBodySelector(postNr)} ${opts.thingInPostSelector || ''}`;
        await this.waitUntilTextMatches(selector, regex);
      },

      refreshUntilPostNrAppears: async (postNr: PostNr,
            ps: { isEmbedded?: true, isMetaPost?: true } = {}) => {
        if (ps.isEmbedded) await this.switchToEmbeddedCommentsIrame();
        const selector = ps.isMetaPost
            ? `#post-${postNr} .s_MP_Text`
            : this.topic.postBodySelector(postNr);
        await this.topic.refreshUntilAppears(selector, ps);
      },

      refreshUntilAppears: async (selector: St, ps: { isEmbedded?: true } = {}) => {
        // Maybe use this.waitUntil()? But it's ok to call it from inside itself?
        let delayMs = RefreshPollMs;
        while (!await this.isVisible(selector)) {
          logMessage(`Refreshing page until appears:  ${selector}  [TyE2EMREFRWAIT]`);
          await this.#br.refresh();
          // Pause *after* the refresh, so there's some time for the post to get loaded & appear.
          await this.#br.pause(delayMs);
          // Give the thing more and more time to appear, after page reresh, in case
          // for whatever reason it won't show up immediately.
          delayMs = expBackoff(delayMs);
          if (ps.isEmbedded) await this.switchToEmbeddedCommentsIrame();
        }
      },

      refreshUntilPostTextMatches: async (postNr: PostNr, regex: St | RegExp) => {
        regex = getRegExpOrDie(regex);
        while (true) {
          const text = await this.waitAndGetVisibleText(
                  this.topic.postBodySelector(postNr));
          if (text.match(regex)) {
            break;
          }
          await this.#br.pause(200);
          await this.#br.refresh();
        }
      },

      assertMetaPostTextMatches: async (postNr: PostNr, text: St) => {
        await this.assertTextMatches(`#post-${postNr} .s_MP_Text`, text)
      },

      topLevelReplySelector: '.dw-depth-1 > .dw-p',
      replySelector: '.dw-depth-1 .dw-p',
      allRepliesTextSelector: '.dw-depth-0 > .dw-single-and-multireplies > .dw-res',
      anyCommentSelector: '.dw-p',
      anyReplyButtonSelector: '.dw-a-reply',
      addProgressReplySelector: '.s_OpReB-Prg',
      previewSelector: '.dw-depth-1 .s_P-Prvw:not(.s_P-Prvw-NotEd)',
      draftSelector: '.dw-depth-1 .s_P-Prvw.s_P-Prvw-NotEd',  // or drafts.__draftSel

      waitForReplyButtonAssertCommentsVisible: async () => {
        await this.waitForVisible(this.topic.anyReplyButtonSelector);
        assert.ok(await this.isVisible(this.topic.anyCommentSelector));
      },

      waitForReplyButtonAssertNoComments: async () => {
        await this.waitForVisible(this.topic.anyReplyButtonSelector);
        assert.ok(!await this.isVisible(this.topic.anyCommentSelector));
      },

      waitForPostPreviewDisplayed: async () => {
        await this.waitForDisplayed(this.topic.previewSelector);
      },

      waitForPostDraftDisplayed: async () => {
        await this.waitForDisplayed(this.topic.draftSelector);
      },

      waitForNumReplies: async (n: Partial<NumReplies>, ps: { skipWait?: Bo } = {}) => {
        if (!ps.skipWait) {
          await this.waitForMyDataAdded();
        }
        const numExpected = utils.numReplies(n);
        let numNow: NumReplies | U;
        await this.waitUntil(async () => {
          numNow = await this.topic.countReplies({ skipWait: true });
          return _.isEqual(numNow, numExpected);
        }, {
          message: () => `Waiting for replies: ${sfy(n)}, now: ${sfy(numNow)}`,
        })
      },

      countReplies: async (ps: { skipWait?: Bo } = {}): Pr<NumReplies> => {
        if (!ps.skipWait) {
          await this.waitForMyDataAdded();
        }
        let numNormal = await this.count(this.topic.replySelector);

        // Own unapproved posts, pending mod (or maybe if is staff, then can see others').
        const ownUnapproved = await this.count(this.topic.replySelector + ' .dw-p-pending-mod');
        // Others' unapproved posts (mods can see other's unapproved posts).
        const othersUnapproved = await this.count(this.topic.replySelector + '.dw-p-unapproved');
        // Total num unapproved.
        const numUnapproved = othersUnapproved + ownUnapproved;

        const numPreviews = await this.count(this.topic.previewSelector);
        const numDrafts = await this.count(this.topic.draftSelector);
        const numDeleted = await this.count(this.topic.replySelector + '.s_P-Dd');

        numNormal = numNormal - numPreviews - numDrafts - numUnapproved - numDeleted;
        return { numNormal, numPreviews, numDrafts, numUnapproved, numDeleted };
      },

      assertNumRepliesVisible: async (num: Nr) => {
        await this.waitForMyDataAdded();
        await this.assertExactly(num, this.topic.replySelector);
      },

      assertNumOrigPostRepliesVisible: async (num: Nr) => {
        await this.waitForMyDataAdded();
        await this.assertExactly(num, this.topic.topLevelReplySelector);
      },

      assertNoReplyMatches: async (text: St | RegExp) => {
        await this.waitForMyDataAdded();
        await this.assertNoTextMatches(this.topic.allRepliesTextSelector, text);
      },

      assertSomeReplyMatches: async (text: St | RegExp) => {
        await this.waitForMyDataAdded();
        await this.assertTextMatches(this.topic.allRepliesTextSelector, text);
      },

      assertNoAuthorMissing: async () => {
        // There's this error code if a post author isn't included on the page.
        await this.topic.assertNoReplyMatches("EsE4FK07_");
      },

      getTopicAuthorUsernameInclAt: async (): Pr<St> => {
        return await this.waitAndGetVisibleText('.dw-ar-p-hd .esP_By_U');
      },

      getPostAuthorUsernameInclAt: async (postNr: PostNr): Pr<St> => {
        const sel = this.topic.postHeaderSelector(postNr);
        return await this.waitAndGetVisibleText(sel + ' .esP_By_U');
      },

      getPostAuthorUsername: async (postNr: PostNr): Pr<St> => {
        const atUsername = await this.topic.getPostAuthorUsernameInclAt(postNr);
        dieIf(atUsername[0] !== '@', 'TyE3G3MEEGW2')
        return atUsername.substr(1);
      },

      getPostAuthorBadgeTitles: async (postNr: PostNr, howManyBadges: Nr | U): Pr<St[]> => {
        const sel = this.topic.postHeaderSelector(postNr) + ' .n_TagL-Pat ';
        if (howManyBadges === 0) {
          // When the username has appeared, tags should be there too?
          await this.topic.getPostAuthorUsernameInclAt(postNr);
          await this.waitForGone(sel + ' ' + this.widgets.tagList.tagListItemSelector);
          return [];
        }
        else {
          return await this.widgets.tagList.getTagTitles(sel, howManyBadges);
        }
      },

      clickFirstMentionOf: async (username: St) => {
        // This:  this.waitAndClick(`a.esMention=@${username}`);
        // fails:
        //    Failed to execute 'querySelector' on 'Document':
        //      'a.esMention=@michael.lastname' is not a valid selector
        // because  scrollIntoViewInPageColumn()  sends Javascript to the browser,
        // but only Wdio, not the browser, understands these Wdio / WebDriver
        // "magic" selectors:  [EQSELEC]
        await this.waitForDisplayed(`a.esMention=@${username}`);
        const elem = await this.$(`a.esMention=@${username}`);
        await elem.click();
      },

      clickReplyToOrigPost: async (whichButton?: 'DiscussionSection') => {
        const selector = whichButton === 'DiscussionSection' ?
            '.s_OpReB-Dsc' : '.dw-ar-p + .esPA .dw-a-reply';
        await this.topic.clickPostActionButton(selector);
      },

      clickReplyToEmbeddingBlogPost: async () => {
        await this.switchToEmbCommentsIframeIfNeeded();
        await this.topic.clickPostActionButton('.dw-ar-t > .esPA .dw-a-reply');
      },

      clickReplyToPostNr: async (postNr: PostNr) => {
        await this.topic.clickPostActionButton(`#post-${postNr} + .esPA .dw-a-reply`);
      },

      clickAddProgressReply: async () => {
        await this._waitForClickable(this.topic.addProgressReplySelector);
        await this.topic.clickPostActionButton(this.topic.addProgressReplySelector);
        // Dismiss any help dialog that explains what bottom comments are.
        await this.#br.pause(150);
        if (await this.isVisible('.e_HelpOk')) {
          await this.waitAndClick('.e_HelpOk');
          await this.waitUntilModalGone();
        }
      },

      wikifyPostNr: async (postNr: PostNr, shallWikify: Bo) => {
        // Break out fn? (5936RKTL6)
        await utils.tryManyTimes("Wikify post", 3, async () => {
          if (!await this.isVisible('.s_PA_WkB')) {
            await this.topic.clickMoreForPostNr(postNr);
          }
          await this.waitAndClick('.s_PA_WkB', { timeoutMs: 500 });
          await this.waitAndClick(shallWikify ? '.e_MkWk' : '.e_UnWk', { timeoutMs: 500 });
          await this.waitUntilTextMatches(`#post-${postNr} + .esPA .dw-a-edit`, "Wiki", {
                  timeoutMs: 500, invert: !shallWikify });
        });
      },

      canEditSomething: async (): Pr<Bo> => {
        return await this.isVisible('.dw-a-edit');
      },

      canReplyToSomething: async (): Pr<Bo> => {
        return await this.isVisible('.dw-a-reply');
      },

      canEditOrigPost: async (): Pr<Bo> => {
        return await this.topic.canEditPostNr(c.BodyNr);
      },

      canEditPostNr: async (postNr: Nr): Pr<Bo> => {
        const selector = `#post-${postNr} + .esPA .dw-a-edit`;
        return await this.isEnabled(selector);
      },

      clickEditOrigPost: async () => {
        await this.waitAndClick('.dw-ar-t > .dw-p-as .dw-a-edit');
      },

      clickEditPostNr: async (postNr: PostNr) => {
        await this.topic.clickPostActionButton(`#post-${postNr} + .esPA .dw-a-edit`);
      },

      waitForViewEditsButton: async (postNr: PostNr) => {
        await this.waitForVisible(`#post-${postNr} .esP_viewHist`);
      },

      isViewEditsButtonVisible: async (postNr: PostNr): Pr<Bo> => {
        return await this.isVisible(`#post-${postNr} .esP_viewHist`);
      },

      openEditHistory: async (postNr: PostNr) => {
        await this.waitAndClick(`#post-${postNr} .esP_viewHist`);
        await this.editHistoryDialog.waitUntilVisible();
      },

      openAboutUserDialogForPostNr: async (postNr: PostNr) => {
        await this.waitAndClick(`#post-${postNr} .esP_By`);
        await this.aboutUserDialog.waitForLoaded();
      },

      openAboutUserDialogForUsername: async (username: St) => {
        await this.waitAndClickFirst(`.esP_By[href="/-/users/${username}"]`);
        await this.aboutUserDialog.waitForLoaded();
      },

      clickMoreForPostNr: async (postNr: PostNr) => {  // RENAME to openMoreDialogForPostNr()?
        await this.topic.clickPostActionButton(`#post-${postNr} + .esPA .dw-a-more`);
      },

      isPostMoreDialogVisible: async (): Pr<Bo> => {
        // This works for now.
        return await this.isVisible(this.topic.__flagPostSelector);
      },

      closePostMoreDialog: async () => {
        assert.ok(await this.topic.isPostMoreDialogVisible());
        // Break out close dialog fn?  [E2ECLOSEDLGFN]
        await this.waitAndClick('.esDropModal_CloseB');
        await this.waitUntilGone('.esDropModal_CloseB');
        await this.waitUntilModalGone();
      },

      openShareDialogForPostNr: async (postNr: PostNr) => {
        await this.topic.clickPostActionButton(`#post-${postNr} + .esPA .dw-a-link`);
        await this.waitForVisible('.s_ShareD');
      },

      openMoveDialogForPostNr: async (postNr: PostNr) => {
        // Break out fn? (5936RKTL6)
        // This always works, when the tests are visible and I look at them.
        // But can block forever, in an invisible this.#br. Just repeat until works.
        await utils.tryManyTimes("Open move post dialog", 3, async () => {
          if (!await this.isVisible('.s_PA_MvB')) {
            await this.topic.clickMoreForPostNr(postNr);
          }
          await this.waitAndClick('.s_PA_MvB', { timeoutMs: 500 });
          await this.waitForVisible('.s_MvPD', { timeoutMs: 500 });
        });
      },

      clickMoreVotesForPostNr: async (postNr: PostNr) => {
        await this.topic.clickPostActionButton(`#post-${postNr} + .esPA .dw-a-votes`);
      },

      makeLikeVoteSelector: (postNr: PostNr, ps: { byMe?: Bo } = {}): St => {
        // Embedded comments pages lack the orig post — instead, there's the
        // blog post, on the embedding page.
        const startSelector = this.#isOnEmbeddedCommentsPage && postNr === c.BodyNr
            ? '.dw-ar-t > ' :`#post-${postNr} + `;
        let result = startSelector + '.esPA .dw-a-like';
        if (ps.byMe) result += '.dw-my-vote';
        else if (ps.byMe === false)  result += ':not(.dw-my-vote)';
        return result;
      },

      makeLikeVoteCountSelector: (postNr: PostNr): St => {
        return this.topic.makeLikeVoteSelector(postNr) + ' + .dw-vote-count';
      },

      __disagreeVoteSel: (postNr: PostNr): St => {
        return `#post-${postNr} + .esPA .e_WroVo`;
      },

      clickLikeVote: async (postNr: PostNr, opts: { logInAs? } = {}) => {
        const likeVoteSelector = this.topic.makeLikeVoteSelector(postNr);

        await utils.tryUntilTrue("click Like", 3, async () => {
          await this.waitAndClick(likeVoteSelector);
          if (!opts.logInAs || !await this.isInIframe())
            return true;
          // A login popup should open.
          return await this.waitForMinBrowserTabs(2, {
                  timeoutMs: 1000, timeoutIsFine: true });
        });

        if (opts.logInAs) {
          await this.switchToLoginPopupIfEmbedded();
          await this.loginDialog.loginWithPassword(opts.logInAs);
          await this.switchToEmbCommentsIframeIfNeeded();
        }
      },

      clickLikeVoteForBlogPost: async () => {
        await this.switchToEmbCommentsIframeIfNeeded();
        await this.waitAndClick('.dw-ar-t > .esPA > .dw-a-like');
      },

      toggleLikeVote: async (postNr: PostNr, opts: { logInAs? } = {}) => {
        const likeVoteSelector = this.topic.makeLikeVoteSelector(postNr);
        await this.switchToEmbCommentsIframeIfNeeded();
        const isLikedBefore = await this.isVisible(likeVoteSelector + '.dw-my-vote');
        // This click for some reason won't always work, here: [E2ECLICK03962]
        await utils.tryUntilTrue(`toggle Like vote`, 3, async () => {
          await this.switchToEmbCommentsIframeIfNeeded();
          await this.topic.clickLikeVote(postNr, opts);
          // Wait for the server to reply, and the page to get updated.
          const gotToggled = await this.waitUntil(async () => {
            const likedNow = await this.isVisible(likeVoteSelector + '.dw-my-vote');
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

      isPostLikedByMe: async (postNr: PostNr): Pr<Bo> => {
        return await this.topic.isPostLiked(postNr, { byMe: true });
      },

      isPostLiked: async (postNr: PostNr, ps: { byMe?: Bo } = {}): Pr<Bo> => {
        // We'll know if the post is liked byMe, by looking at the Like vote heart
        // button — if it's red, the post is liked byMe.
        // Otherwise, if there's any Like vote count, the post is liked by *someone*.
        const likeVoteSelector = ps.byMe
            ?  this.topic.makeLikeVoteSelector(postNr, ps)
            : this.topic.makeLikeVoteCountSelector(postNr);
        return await this.isVisible(likeVoteSelector);
      },

      waitForLikeVote: async (postNr: PostNr, ps: { byMe?: Bo } = {}) => {
        const likeVoteSelector = this.topic.makeLikeVoteCountSelector(postNr);
        await this.waitForVisible(likeVoteSelector);
      },

      toggleDisagreeVote: async (postNr: PostNr, opts: { waitForModalGone?: false } = {}) => {
        await this.topic._toggleMoreVote(postNr, '.dw-a-wrong', opts);
      },

      isPostDisagreVoted: async (postNr: PostNr): Pr<Bo> => {
        return await this.isDisplayed(this.topic.__disagreeVoteSel(postNr));
      },

      toggleBuryVote: async (postNr: PostNr) => {
        await this.topic._toggleMoreVote(postNr, '.dw-a-bury');
      },

      toggleUnwantedVote: async (postNr: PostNr) => {
        await this.topic._toggleMoreVote(postNr, '.dw-a-unwanted');
      },

      _toggleMoreVote: async (postNr: PostNr, selector: St,
              opts: { waitForModalGone?: false } = {}) => {
        await this.topic.clickMoreVotesForPostNr(postNr);
        // The vote button appears in a modal dropdown.
        await this.waitAndClick('.esDropModal_content ' + selector);
        if (opts.waitForModalGone !== false) {
          await this.waitUntilModalGone();
          await this.waitUntilLoadingOverlayGone();
        }
      },

      canVoteLike: async (postNr: PostNr): Pr<Bo> => {
        const likeVoteSelector = this.topic.makeLikeVoteSelector(postNr);
        return await this.isVisible(likeVoteSelector);
      },

      canVoteUnwanted: async (postNr: PostNr): Pr<Bo> => {
        await this.topic.clickMoreVotesForPostNr(postNr);
        await this.waitForVisible('.esDropModal_content .dw-a-like');
        const canVote = await this.isVisible('.esDropModal_content .dw-a-unwanted');
        assert.ok(false); // how close modal? to do... later when needed
        return canVote;
      },

      __flagPostSelector: '.icon-flag',  // for now, later: e_...

      clickFlagPost: async (postNr: PostNr, opts: { needToClickMore?: false } = {}) => {
        if (opts.needToClickMore !== false) {
          // Flag button is inside the More dialog.
          await this.topic.clickMoreForPostNr(postNr);
          await this.waitAndClick('.e_PAMoreD .dw-a-flag');
        }
        else {
          // Flag button already visible (this is the case if logged out).
          await this.waitAndClick(
                `#post-${postNr} + .esPA ${this.topic.__flagPostSelector}`);
        }
        // This opens  this.flagDialog.
      },

      __deletePostSelector: '.dw-a-delete',

      deletePost: async (postNr: PostNr) => {
        await this.topic.clickMoreForPostNr(postNr);
        await this.waitAndClick(this.topic.__deletePostSelector);
        await this.waitAndClick('.dw-delete-post-dialog .e_YesDel');
        await this.waitUntilGone('.dw-delete-post-dialog');
        await this.waitUntilLoadingOverlayGone();
        await this.topic.waitForPostVisibleAsDeleted(postNr);
      },

      canDeletePost: async (postNr: PostNr): Pr<Bo> => {
        await this.topic.clickMoreForPostNr(postNr);
        await this.waitForVisible('.esDropModal_content .dw-a-flag');
        const canDelete = await this.isVisible(this.topic.__deletePostSelector);
        await this.topic.closePostMoreDialog();
        return canDelete;
      },

      canSelectAnswer: async (): Pr<Bo> => {
        return await this.isVisible('.dw-a-solve');
      },

      selectPostNrAsAnswer: async (postNr: PostNr) => {
        assert.ok(!await this.isVisible(this.topic._makeUnsolveSelector(postNr)));
        await this.topic.clickPostActionButton(this.topic._makeSolveSelector(postNr));
        await this.waitForVisible(this.topic._makeUnsolveSelector(postNr));
      },

      unselectPostNrAsAnswer: async (postNr: PostNr) => {
        assert.ok(!await this.isVisible(this.topic._makeSolveSelector(postNr)));
        await this.topic.clickPostActionButton(this.topic._makeUnsolveSelector(postNr));
        await this.waitForVisible(this.topic._makeSolveSelector(postNr));
      },

      _makeSolveSelector(postNr: PostNr) {
        return `#post-${postNr} + .esPA .dw-a-solve`;
      },

      _makeUnsolveSelector(postNr: PostNr) {
        return `#post-${postNr} + .esPA .dw-a-unsolve`;
      },

      openTagsDialog: async (ps: { openHow?: 'ClickHeaderTags' | 'ViaMoreDropdown',
              forPostNr?: PostNr } = {}) => {
        const postNr = ps.forPostNr || c.BodyNr;
        if ((!ps.openHow && postNr === c.BodyNr) || ps.openHow === 'ClickHeaderTags') {
          // Make 'sel' more precise, so cannot click pat tags.  [precise_tag_sels]
          const sel = this.topic.postHeaderSelector(postNr) + ' .c_TagL_AddB';
          await this.waitAndClick(sel);
        }
        else {
          await this.topic.clickMoreForPostNr(postNr);
          await this.waitAndClick(' .dw-a.icon-plus');  // add real e_SthB class?  [precise_tag_sels]
        }
      },

      getTags: async (ps: { forPostNr?: PostNr, howManyTags: Nr, within?: Sel }): Pr<St[]> => {
        const postNr = ps.forPostNr || c.BodyNr;
        const sel =
                (ps.within || '') + ' ' +
                this.topic.postHeaderSelector(postNr) + ' .n_TagL-Po ';
        if (ps.howManyTags === 0) {
          // When the username has appeared, tags should be there too?
          await this.topic.getPostAuthorUsernameInclAt(postNr);
          await this.waitForGone(sel + this.widgets.tagList.tagListItemSelector);
          return [];
        }
        else {
          return await this.widgets.tagList.getTagTitles(sel, ps.howManyTags);
        }
      },

      openChangePageDialog: async () => {
        await this.waitAndClick('.dw-a-change');
        await this.topic.waitUntilChangePageDialogOpen();
      },

      __changePageDialogSelector: '.s_ChPgD .esDropModal_content',

      // Could break out to  changePageDialog: { ... } obj.
      waitUntilChangePageDialogOpen: async () => {
        await this.waitForVisible(this.topic.__changePageDialogSelector);
        await this.waitForDisplayed('.modal-backdrop');
      },

      isChangePageDialogOpen: async (): Pr<Bo> => {
        return await this.isVisible(this.topic.__changePageDialogSelector);
      },

      waitUntilChangePageDialogGone: async () => {
        await this.waitUntilGone(this.topic.__changePageDialogSelector);
        await this.waitUntilGone('.modal-backdrop');
      },

      closeChangePageDialog: async () => {
        dieIf(!await this.topic.isChangePageDialogOpen(), 'TyE5AKTDFF2');
        // Don't: this.waitAndClick('.modal-backdrop');
        // That might block forever, waiting for the dialog that's in front of the backdrop
        // to stop occluding (parts of) the backdrop.
        // Instead:
        await this.waitUntil(async () => {
          // This no longer works, why not? Chrome 77. The click has no effect —
          // maybe it doesn't click at 10,10 any longer? Or what?
          //if (this.isVisible('.modal-backdrop')) {
          //  // Click the upper left corner — if any dialog is open, it'd be somewhere in
          //  // the middle and the upper left corner, shouldn't hit it.
          //  this.#br.leftClick('.modal-backdrop', 10, 10);
          //}
          // Instead: (and is this even slightly better?)
          // (Break out close dialog fn?  [E2ECLOSEDLGFN])
          if (await this.isVisible('.esDropModal_CloseB')) {
            await this.waitAndClick('.esDropModal_CloseB');
          }
          return !await this.topic.isChangePageDialogOpen();
        }, {
          message: `Waiting for Change Page dialog to close`,
        });
        await this.waitUntilModalGone();
      },

      closeTopic: async () => {
        await this.topic.openChangePageDialog();
        await this.waitAndClick(this.topic._closeButtonSelector);
        await this.topic.waitUntilChangePageDialogGone();
        await this.waitForVisible('.dw-p-ttl .icon-block');
      },

      reopenTopic: async () => {
        await this.topic.openChangePageDialog();
        await this.waitAndClick(this.topic._reopenButtonSelector);
        await this.topic.waitUntilChangePageDialogGone();
        await this.waitUntilGone('.dw-p-ttl .icon-block');
      },

      canCloseOrReopen: async (): Pr<Bo> => {
        return await this.topic.__canSomething(async () => {
          return await this.isVisible(this.topic._closeButtonSelector) ||
                  await this.isVisible(this.topic._reopenButtonSelector);
        });
      },

      __canSomething: async (fn: () => Pr<Bo>): Pr<Bo> => {
        await this.waitForDisplayed('.dw-a-more'); // so all buttons have appeared
        if (!await this.isVisible('.dw-a-change'))
          return false;
        await this.topic.openChangePageDialog();
        const result = await fn();
        await this.topic.closeChangePageDialog();
        return result;
      },

      setDoingStatus: async (newStatus: 'New' | 'Planned' | 'Started' | 'Done') => {
        await this.topic.openChangePageDialog();
        await this.waitAndClick('.e_PgSt-' + newStatus);
        await this.topic.waitUntilChangePageDialogGone();
      },

      _closeButtonSelector: '.s_ChPgD .e_ClosePgB',
      _reopenButtonSelector: '.s_ChPgD .e_ReopenPgB',

      deletePage: async () => {
        await this.topic.openChangePageDialog();
        await this.waitAndClick(this.topic.__deletePageSelector);
        await this.topic.waitUntilChangePageDialogGone();
        await this.topic.waitUntilPageDeleted();
      },

      undeletePage: async () => {
        await this.topic.openChangePageDialog();
        await this.waitAndClick(this.topic.__undeletePageSelector);
        await this.topic.waitUntilChangePageDialogGone();
        await this.topic.waitUntilPageRestored();
      },

      canDeleteOrUndeletePage: async (): Pr<Bo> => {
        return await this.topic.__canSomething(async () => {
          return await this.isVisible(this.topic.__deletePageSelector) ||
                  await this.isVisible(this.topic.__undeletePageSelector);
        });
      },

      __deletePageSelector: '.s_ChPgD .e_DelPgB',
      __undeletePageSelector: '.s_ChPgD .e_UndelPgB',

      refreshUntilBodyHidden: async (postNr: PostNr) => {  // RENAME to refreshUntilPostBodyHidden
        await this.waitUntil(async () => {
          let isBodyHidden = await this.topic.isPostBodyHidden(postNr);
          if (isBodyHidden) return true;
          await this.#br.pause(RefreshPollMs);
          await this.#br.refresh();
        }, {
          message: `Waiting for post nr ${postNr}'s body to hide`,
        });
      },

      refreshUntilPostPresentBodyNotHidden: async (postNr: PostNr) => {
        await this.waitUntil(async () => {
          let isVisible = await this.isVisible(`#post-${postNr}`);
          let isBodyHidden = await this.topic.isPostBodyHidden(postNr);
          if (isVisible && !isBodyHidden) return true;
          await this.#br.pause(RefreshPollMs);
          await this.#br.refresh();
        }, {
          message: `Waiting for post nr ${postNr}: isVisible && !isBodyHidden`,
        });
      },

      isPostBodyHidden: async (postNr: PostNr): Pr<Bo> => {
        return await this.isVisible(`#post-${postNr}.s_P-Hdn`);
      },

      waitForPostVisibleAsDeleted: async (postNr: PostNr) => {
        await this.waitForDisplayed(`#post-${postNr}.s_P-Dd`);
      },

      assertPostHidden: async  (postNr: PostNr) => {
        assert.ok(await this.topic.isPostBodyHidden(postNr));
      },

      assertPostNotHidden: async (postNr: PostNr) => {
        assert.ok(!await this.isVisible(`#post-${postNr}.s_P-Hdn`));
        assert.ok(await this.isVisible(`#post-${postNr}`));
        // Check -Hdn again, to prevent some races (but not all), namely that the post gets
        // loaded, and is invisible, but the first -Hdn check didn't find it because at that time
        // it hadn't yet been loaded.
        assert.ok(!await this.isVisible(`#post-${postNr}.s_P-Hdn`));
      },

      rejectPostNr: async (postNr: PostNr) => {
        const selector = `#post-${postNr} + .esPA .s_PA_ModB-Rej`;
        await this.waitAndClick(selector);
        await this.stupidDialog.yesIAmSure();
        if (postNr === c.BodyNr) {
          // Then currently the page gets deleted instead
          // — the posts need an [ApprovedStatus] post field.
          await this.topic.waitUntilPageDeleted();
          return;
        }
        await this.waitUntilGone(selector);
        await this.topic.waitForPostVisibleAsDeleted(postNr);
        assert.ok(!await this.topic._hasUnapprovedClass(postNr));
        assert.ok(!await this.topic._hasPendingModClass(postNr));
      },

      approvePostNr: async (postNr: PostNr) => {
        const selector = `#post-${postNr} + .esPA .s_PA_ModB-Apr`;
        await this.waitAndClick(selector);
        await this.stupidDialog.yesIAmSure();
        await this.waitUntilGone(selector);
        assert.ok(!await this.topic._hasUnapprovedClass(postNr));
        assert.ok(!await this.topic._hasPendingModClass(postNr));
      },

      assertPostNeedsApprovalBodyVisible: async (postNr: PostNr) => {
        // Test visible = true first, else, race. [is_visible_1st]
        assert.ok(await this.topic._hasPendingModClass(postNr));
        assert.ok(!await this.topic._hasUnapprovedClass(postNr));
        assert.ok(await this.topic._isBodyVisible(postNr));
      },

      assertPostNeedsApprovalBodyHidden: async (postNr: PostNr) => {
        // Test visible = true first, else, race. [is_visible_1st]
        assert.ok(await this.topic._hasUnapprovedClass(postNr));
        assert.ok(!await this.topic._hasPendingModClass(postNr));
        assert.ok(!await this.topic._isBodyVisible(postNr));
      },

      refreshUntilPostNotPendingApproval: async (postNr: PostNr) => {
        await this.waitUntil(async () => {
          return await this.topic.isPostNotPendingApproval(postNr);
        }, {
          refreshBetween: true,
          message: `Waiting for post nr ${postNr} to get approved`,
        });
      },

      assertPostNotPendingApproval: async (postNr: PostNr, ps: { wait?: false } = {}) => {
        if (ps.wait !== false) {
          await this.topic.waitForPostNrVisible(postNr);
        }
        assert.ok(await this.topic.isPostNotPendingApproval(postNr));
      },

      isPostNotPendingApproval: async (postNr: PostNr): Pr<Bo> => {
        // Test visible = true first, else, race. [is_visible_1st]
        return await this.topic._isBodyVisible(postNr) &&
            !await this.topic._hasUnapprovedClass(postNr) &&
            !await this.topic._hasPendingModClass(postNr);
      },

      // Not needed? Just use  waitAndClick()  instead?
      clickPostActionButton: async (buttonSelector: St,
            opts: { clickFirst?: Bo } = {}) => {   // RENAME to this.scrollAndClick?
        await this.switchToEmbCommentsIframeIfNeeded();
        await this.waitAndClick(buttonSelector, opts);
        /*
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
            } * /

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
        }*/
      },

      _isOrigPostBodyVisible: async (): Pr<Bo> => {
        return !!await (await this.$('#post-1 > .dw-p-bd')).getText();
      },

      _isTitlePendingApprovalVisible: async (): Pr<Bo> => {
        return await this.isVisible('.dw-p-ttl .esPendingApproval');
      },

      _isOrigPostPendingApprovalVisible: async (): Pr<Bo> => {
        return await this.isVisible('.dw-ar-t > .esPendingApproval');
      },

      _isBodyVisible: async (postNr: PostNr): Pr<Bo> => {
        return await this.isVisible(`#post-${postNr} .dw-p-bd`);
      },

      _hasPendingModClass: async (postNr: PostNr): Pr<Bo> => {
        return await this.isVisible(`#post-${postNr} .dw-p-pending-mod`);
      },

      _hasUnapprovedClass: async (postNr: PostNr): Pr<Bo> => {
        return await this.isVisible(`#post-${postNr}.dw-p-unapproved`);
      },


      backlinks: {
        __mkSelector: (pageId: PageId) => `.s_InLns_Ln[href="/-${pageId}"]`,

        countBacklinks: async (): Pr<Nr> => await this.count('.s_InLns_Ln'),

        refreshUntilNum: async (num: Nr) => {
          let numNow: number;
          await this.waitUntil(async () => {
            await this.waitForMyDataAdded();
            numNow = await this.topic.backlinks.countBacklinks();
            if (numNow === num) return true;
            await this.refresh2();
          }, {
            message: () => `Waiting for ${num} backlinks, num now: ${numNow}`,
          });
        },

        isLinkedFromPageId: async (pageId: PageId): Pr<Bo> => {
          return await this.isExisting(this.topic.backlinks.__mkSelector(pageId));
        },

        getLinkTitle: async (pageId: PageId): Pr<St> => {
          return await this.waitAndGetText(this.topic.backlinks.__mkSelector(pageId));
        },

        clickBacklinkFrom: async (pageId: PageId) => {
          await this.waitAndClick(this.topic.backlinks.__mkSelector(pageId));
        },
      },
    };


    chat = {
      joinChat: async () => {
        await this.waitAndClick('#theJoinChatB');
      },

      waitAndAssertPurposeMatches: async (regex: RegExp | St) => {
        await this.waitAndAssertVisibleTextMatches('.esChatChnl_about', regex);
      },

      waitAndAssertPurposeIs: async (text: St) => {
        await this.waitAndAssertVisibleTextIs('.esChatChnl_about .dw-p-bd', text);
      },

      addChatMessage: async (text: St) => {
        await this.chat.editChatMessage(text);
        await this.chat.submitChatMessage();
        // could verify visible
      },

      __previewSelector: '.s_C_M-Prvw',

      editChatMessage: async (text: St) => {
        await this.waitAndSetValue('.esC_Edtr_textarea', text);
        // Wait for a message preview to appear — because it can push the submit button down,
        // so when we click it, when done editing, we'd miss it, if we click at
        // exacty the same time. (Happens like 1 in 5.)
        if (text) await this.waitForVisible(this.chat.__previewSelector);
        else await this.waitForGone(this.chat.__previewSelector);
      },

      getChatInputText: async (): Pr<St> => {
        return await this.waitAndGetText('.esC_Edtr_textarea');
      },

      waitForDraftSaved: async () => {
        await this.waitForVisible('.e_DfSts-' + c.TestDraftStatus.Saved);
      },

      waitForDraftDeleted: async () => {
        await this.waitForVisible('.e_DfSts-' + c.TestDraftStatus.Deleted);
      },

      waitForDraftChatMessageToLoad: async (text: St) => {
        await this.waitUntilValueIs('.esC_Edtr textarea', text);
      },

      submitChatMessage: async () => {
        await this.waitAndClick('.esC_Edtr_SaveB');
        await this.waitUntilLoadingOverlayGone();
        //this.waitForGone('.s_C_M-Prvw'); [DRAFTS_BUG] — add this, see if works?
      },

      waitForNumMessages: async (howMany: Nr, exact?: 'Exactly') => {
        if (exact === 'Exactly') await this.waitForExactly(howMany, '.esC_M');
        else await this.waitForAtLeast(howMany, '.esC_M');
      },

      countMessages: async (ps: { inclAnyPreview?: Bo } = {}): Pr<Nr> =>
        await this.count(
            `.esC_M${ps.inclAnyPreview === false ? '' : ':not(.s_C_M-Prvw)'}`),

      assertMessageNrMatches: async (messageNr, regex: RegExp | St) => {
        const postNr = messageNr + 1;
        await this.topic.waitForPostAssertTextMatches(postNr, regex);
      },

      openAdvancedEditor: async () => {
        await this.waitAndClick('.esC_Edtr_AdvB');
      },

      deleteChatMessageNr: async (nr: PostNr) => {
        const postSelector = `#post-${nr}`;
        await this.waitAndClick(`${postSelector} .s_C_M_B-Dl`);
        await this.waitAndClick('.dw-delete-post-dialog .e_YesDel');
        await this.waitUntilLoadingOverlayGone();
        await this.waitForVisible(`${postSelector}.s_C_M-Dd`);
      },
    };


    customForm = {
      submit: async () => {
        await this.waitAndClick('form input[type="submit"]');
        await this.waitAndAssertVisibleTextMatches('.esFormThanks', "Thank you");
      },

      assertNumSubmissionVisible: async (num: number) => {
        await this.waitForMyDataAdded();
        await this.assertExactly(num, '.dw-p-flat');
      },
    };


    scrollButtons = {
      fixedBarSelector: '.esScrollBtns_fixedBar',
    };


    searchResultsPage = {
      waitForSearchInputField: async () => {
        await this.waitForVisible('.s_SP_QueryTI');
      },

      assertPhraseNotFound: async (phrase: St) => {
        await this.searchResultsPage.waitForResults(phrase);
        assert.ok(await this.isVisible('#e_SP_NothingFound'));
      },

      waitForAssertNumPagesFound: async (phrase: St, numPages: Nr) => {
        await this.searchResultsPage.waitForResults(phrase);
        // oops, search-search-loop needed ...
        // for now:
        await this.waitForAtLeast(numPages, '.esSERP_Hit_PageTitle');
        await this.assertExactly(numPages, '.esSERP_Hit_PageTitle');
      },

      searchForWaitForResults: async (phrase: St) => {
        await this.waitAndSetValue('.s_SP_QueryTI', phrase);
        await this.searchResultsPage.clickSearchButton();
        // Later, with Nginx 1.11.0+, wait until a $request_id in the page has changed [5FK02FP]
        await this.searchResultsPage.waitForResults(phrase);
      },

      searchForUntilNumPagesFound: async (phrase: St, numResultsToFind: Nr) => {
        let numFound;
        await this.waitUntil(async () => {
          await this.searchResultsPage.searchForWaitForResults(phrase);
          numFound = await this.searchResultsPage.countNumPagesFound_1();
          if (numFound >= numResultsToFind) {
            tyAssert.eq(numFound, numResultsToFind);
            return true;
          }
          await this.#br.pause(111);
        }, {
          message: `Waiting for ${numResultsToFind} pages found for search ` +
              `phrase:  "${phrase}"  found this far: ${numFound}`,
        });
      },

      clickSearchButton: async () => {
        await this.waitAndClick('.s_SP_SearchB');
      },

      waitForResults: async (phrase: St) => {
        // Later, check Nginx $request_id to find out if the page has been refreshed
        // unique request identifier generated from 16 random bytes, in hexadecimal (1.11.0).
        await this.waitUntilTextMatches('#e2eSERP_SearchedFor', phrase);
      },

      countNumPagesFound_1: async (): Pr<Nr> =>
        (await this.$$('.esSERP_Hit_PageTitle')).length,

      assertResultPageTitlePresent: async (title: St) => {
        await this.waitAndGetElemWithText('.esSERP_Hit_PageTitle', title, { timeoutMs: 1 });
      },

      goToSearchResult: async (linkText?: St) => {
        await this.repeatUntilAtNewUrl(async () => {
          if (!linkText) {
            await this.waitAndClick('.esSERP_Hit_PageTitle a');
          }
          else {
            await this.waitForThenClickText('.esSERP_Hit_PageTitle a', linkText);
          }
        });
      },
    };


    groupListPage = {
      goHere: async (origin?: St) => {
        await this.go((origin || '') + '/-/groups/');
        await this.groupListPage.waitUntilLoaded();
      },

      waitUntilLoaded: async () => {
        await this.waitForVisible('.s_GP');
      },

      countCustomGroups: async (): Pr<Nr> => {
        return await this.count('.s_Gs-Custom .s_Gs_G');
      },

      openTrustedMembersGroup: async () => {
        await this.waitForThenClickText('.s_Gs_G_Lk .esP_By', 'trusted_members');
        await this.waitAndAssertVisibleTextMatches('.esUP_Un', "trusted_members");
      },

      createGroup: async (ps: { username: St, fullName: St }) => {
        await this.waitAndClick('.s_GP_CrGB');
        await this.waitAndSetValue('#te_CrGD_Un', ps.username);
        await this.waitAndSetValue('#te_CrGD_FN', ps.fullName);
        await this.waitAndClick('.s_CrGD .btn-primary');
        await this.waitForVisible('.e_AddMbrsB');
      },

      waitUntilGroupPresent: async (ps: { username: St, fullName: St }) => {
        await this.waitAndGetElemWithText('.s_Gs_G_Lk .esP_By_U', ps.username);
        await this.waitAndGetElemWithText('.s_Gs_G_Lk .esP_By_F', ps.fullName);
      },

      openGroupWithUsername: async (username: St) => {
        await this.waitForThenClickText('.s_Gs_G_Lk .esP_By_U', username);
        await this.userProfilePage.groupMembers.waitUntilLoaded();
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

      waitUntilUsernameVisible: async () => {
        await this.waitForVisible('.esUP_Un');
      },

      waitUntilUsernameIs: async (username: St) => {
        await this.waitAndGetElemWithText('.esUP_Un', username);
      },

      waitAndGetUsername: async (): Pr<St> => {
        return await this.waitAndGetVisibleText('.esUP_Un');
      },

      waitAndGetFullName: async (): Pr<St> => {
        return await this.waitAndGetVisibleText('.esUP_FN');
      },

      waitUntilDeletedOrDeactivated: async () => {
        await this.waitForDisplayed('.e_ActDd');
      },

      navBackToGroups: async () => {
        await this.userProfilePage._navigateBackToUsersOrGroupsList(true);
      },

      _navigateBackToUsersOrGroupsList: async (isGroup: Bo) => {
        await this.repeatUntilAtNewUrl(async () => {
          await this.waitAndClick('.s_Tb_Ln-Grps');
        });
        if ((await this.urlPath()).startsWith(c.GroupsUrlPrefix)) {
          assert.ok(isGroup);
          await this.groupListPage.waitUntilLoaded();
        }
        else {
          assert.ok(!isGroup);
          // /-/users/ all users list not yet impl
        }
      },

      openActivityFor: async (who: St | UserId, origin?: St) => {
        await this.go((origin || '') + `/-/users/${who}/activity/posts`);
        await this.waitUntilLoadingOverlayGone();
      },

      openNotfsFor: async (who: St | UserId, origin?: St) => {
        await this.go((origin || '') + `/-/users/${who}/notifications`);
        await this.waitUntilLoadingOverlayGone();
      },

      openNotfPrefsFor: async (who: St | UserId, origin?: St) => {  // oops, dupl (443300222), remove this
        await this.go((origin || '') + `/-/users/${who}/preferences/notifications`);
        await this.waitUntilLoadingOverlayGone();
      },

      openDraftsEtcFor: async (who: St | UserId, origin?: St) => {
        await this.go((origin || '') + `/-/users/${who}/drafts-etc`);
        await this.waitUntilLoadingOverlayGone();
      },

      openPreferencesFor: async (who: St | UserId, origin?: St) => {
        await this.go((origin || '') + `/-/users/${who}/preferences`);
        await this.waitUntilLoadingOverlayGone();
      },

      openPermissionsFor: async (who: St | UserId, origin?: St) => {
        await this.go((origin || '') + `/-/users/${who}/permissions`);
        await this.waitUntilLoadingOverlayGone();
      },

      goToActivity: async () => {
        await this.waitAndClick('.e_UP_ActivityB');
        await this.waitForVisible('.s_UP_Act_List');
        await this.waitUntilLoadingOverlayGone();
      },

      tabToNotfs: async () => {
        await this.waitAndClick('.e_UP_NotfsB');
        await this.userProfilePage.notfs.waitUntilSeesNotfs();
        await this.waitUntilLoadingOverlayGone();
      },

      goToPreferences: async () => {  // RENAME switchTo and goTo, for tabs, to  tabToNnn ?
        await this.userProfilePage.clickGoToPreferences();
      },

      // rename
      clickGoToPreferences: async () => {
        await this.waitAndClick('#e2eUP_PrefsB');
        await this.waitForVisible('.e_UP_Prefs_FN');
        await this.waitUntilLoadingOverlayGone();
      },

      switchToInvites: async () => {
        await this.waitAndClick('.e_InvTabB');
        await this.invitedUsersList.waitUntilLoaded();
      },

      waitForTabsVisible: async () => {
        // The activity tab is always visible, if the notfs tab can possibly be visible.
        await this.waitForVisible('.e_UP_ActivityB');
      },

      isInvitesTabVisible: async (): Pr<Bo> => {
        await this.userProfilePage.waitForTabsVisible();
        return await this.isVisible('.e_InvTabB');
      },

      isNotfsTabVisible: async (): Pr<Bo> => {
        await this.userProfilePage.waitForTabsVisible();
        return await this.isVisible('.e_UP_NotfsB');
      },

      isPrefsTabVisible: async (): Pr<Bo> => {
        await this.userProfilePage.waitForTabsVisible();
        return await this.isVisible('#e2eUP_PrefsB');
      },

      assertIsMyProfile: async () => {
        await this.waitForVisible('.esUP_Un');
        assert.ok(await this.isVisible('.esProfile_isYou'));
      },

      assertUsernameIs: async (username: St) => {
        await this.assertTextMatches('.esUP_Un', username);
      },

      assertFullNameIs: async (name: St) => {
        await this.assertTextMatches('.esUP_FN', name);
      },

      assertFullNameIsNot: async (name: St) => {
        await this.assertNoTextMatches('.esUP_FN', name);
      },

      clickSendMessage: async () => {
        await this.waitAndClick('.s_UP_SendMsgB');
      },

      _goHere: async (username: St, ps: { isGroup?: true, origin?: St }, suffix: St) => {
        await this.go((ps.origin || '') +
                `/-/${ps.isGroup ? 'groups' : 'users'}/${username}${suffix}`);
      },

      aboutPanel: {
        getBadgeTitles: async (howManyBadges: Nr): Pr<St[]> => {
          return this.widgets.tagList.getTagTitles('.s_UP_Ab', howManyBadges);
        },

        openBadgesDialog: async () => {
          await this.waitAndClick('.s_UP_Ab .c_TagL_AddB');
        },
      },

      groupMembers: {
        goHere: async (username: St, ps: { isGroup?: true, origin?: St } = {}) => {
          await this.userProfilePage._goHere(username, ps, '/members');
          await this.userProfilePage.groupMembers.waitUntilLoaded();
        },

        waitUntilLoaded: async () => {
          await this.waitForExist('.s_G_Mbrs, .s_G_Mbrs-Dnd');
        },

        waitUntilMemberPresent: async (username: St) => {
          await this.waitUntilTextMatches('.s_G_Mbrs .esP_By_U', username);
        },

        getNumMembers: async (): Pr<Nr> => {
          return await this.count('.s_G_Mbrs .esP_By_U');
        },

        openAddMemberDialog: async () => {
          await this.waitAndClick('.e_AddMbrsB');
        },

        addOneMember: async (username: St) => {
          await this.userProfilePage.groupMembers.openAddMemberDialog();
          await this.addUsersToPageDialog.addOneUser(username);
          await this.addUsersToPageDialog.submit();
          await this.userProfilePage.groupMembers.waitUntilMemberPresent(username);
        },

        removeFirstMember: async () => {
          await this.waitAndClick('.s_G_Mbrs_Mbr .e_MngMbr');
          await this.waitAndClick('.e_RmMbr');
          // (Could wait until 1 fewer member? or name gone?)
        }
      },

      activity: {
        switchToPosts: async (opts: { shallFindPosts: Bo | 'NoSinceActivityHidden' }) => {
          await this.waitAndClick('.s_UP_Act_Nav_PostsB');
          if (opts.shallFindPosts === 'NoSinceActivityHidden') {
            await this.userProfilePage.activity.posts.waitForNothingToShow();
          }
          else if (opts.shallFindPosts) {
            await this.waitForVisible('.s_UP_Act_Ps');
            await this.waitForVisible('.s_UP_Act_Ps_P');
          }
          else {
            await this.userProfilePage.activity.posts.waitForNoPosts();
          }
          await this.waitUntilLoadingOverlayGone();
        },

        switchToTopics: async (opts: { shallFindTopics: Bo | 'NoSinceActivityHidden' }) => {
          await this.waitAndClick('.s_UP_Act_Nav_TopicsB');
          await this.waitForVisible('.s_UP_Act_Ts');
          if (opts.shallFindTopics === 'NoSinceActivityHidden') {
            await this.userProfilePage.activity.topics.waitForNothingToShow();
          }
          else if (opts.shallFindTopics) {
            await this.waitForVisible('.e2eTopicTitle');
          }
          else {
            await this.userProfilePage.activity.topics.waitForNoTopics();
          }
          await this.waitUntilLoadingOverlayGone();
        },

        summary: {
          goHere: async(username: St, ps: { isGroup?: true, origin?: St } = {}) => {
            await this.userProfilePage._goHere(username, ps, '/activity/summary');
          },
        },

        posts: {
          postSelector: '.s_UP_Act_Ps_P .dw-p-bd',

          goHere: async(username: St, ps: { isGroup?: true, origin?: St } = {}) => {
            await this.userProfilePage._goHere(username, ps, '/activity/posts');
          },

          waitForNothingToShow: async () => {
            await this.waitForVisible('.s_UP_Act_List .e_NothingToShow');
          },

          waitForNoPosts: async () => {
            await this.waitForVisible('.e_NoPosts');
          },

          assertExactly: async (num: Nr) => {
            await this.assertExactly(num, this.userProfilePage.activity.posts.postSelector);
          },

          getTags: async (ps: { forPostNr: PostNr, howManyTags: Nr }): Pr<St[]> => {
            // Selector is:  .s_UP_Act_Ps_P .n_TagL-Po .c_TagL_Tag
            return await this.topic.getTags({
                    forPostNr: ps.forPostNr,
                    howManyTags: ps.howManyTags,
                    within: '.s_UP_Act_Ps_P' });
          },

          navToPost: async (ps: { anyOnPageId?: St, justClickFirst?: Bo } = {}) => {
            dieIf(!!ps.anyOnPageId === !!ps.justClickFirst, 'TyE06WEJPF3');
            const urlPath = ps.anyOnPageId && `/-${ps.anyOnPageId}`;
            // \b means word boundary — so won't match the start of a longer page id.
            // Eh, no, ^= is not a regex. So skip.
            const selector = '.s_UP_Act_Ps_P_Link' + (!urlPath ? '' : `[href^="${urlPath}"]`);
            await this.rememberCurrentUrl();
            await this.waitAndClickFirst(selector);
            await this.waitForNewUrl();
          },

          // Do this separately, because can take rather long (suprisingly?).
          waitForPostTextsVisible: async () => {
            await this.waitForVisible(this.userProfilePage.activity.posts.postSelector);
          },

          assertPostTextVisible: async (postText: St) => {
            let selector = this.userProfilePage.activity.posts.postSelector;
            await this.assertAnyTextMatches(selector, postText);
          },

          assertPostTextAbsent: async (postText: St) => {
            let selector = this.userProfilePage.activity.posts.postSelector;
            await this.assertNoTextMatches(selector, postText);
          },
        },

        topics: {
          topicsSelector: '.s_UP_Act_Ts .e2eTopicTitle',

          goHere: async(username: St, ps: { isGroup?: true, origin?: St } = {}) => {
            await this.userProfilePage._goHere(username, ps, '/activity/topics');
          },

          navToPage: async (ps: { pagePath: St }) => {
            // Not href^= because there's a 2nd link that ends with #post-... too,
            // and then Webdriverio wouldn't know which one to click.
            const selector = `.s_UP_Act_Ts .e2eF_T [href="${ps.pagePath}"]`;
            await this.rememberCurrentUrl();
            await this.waitAndClick(selector);
            await this.waitForNewUrl();
          },

          waitForPageLinkDisplayed: async (ps: { pagePath: St }) => {
            const selector = `.s_UP_Act_Ts .e2eF_T [href="${ps.pagePath}"]`;
            await this.waitForDisplayed(selector);
          },

          waitForNothingToShow: async () => {
            await this.waitForVisible('.s_UP_Act_List .e_NothingToShow');
          },

          waitForNoTopics: async () => {
            await this.waitForVisible('.e_NoTopics');
          },

          assertExactly: async (num: Nr) => {
            await this.assertExactly(
                    num, this.userProfilePage.activity.topics.topicsSelector);
          },

          waitForTopicTitlesVisible: async () => {
            await this.waitForVisible(
                    this.userProfilePage.activity.topics.topicsSelector);
          },

          assertTopicTitleVisible: async (title: St) => {
            let selector = this.userProfilePage.activity.topics.topicsSelector;
            await this.assertAnyTextMatches(selector, title);
          },

          assertTopicTitleAbsent: async (title: St) => {
            let selector = this.userProfilePage.activity.topics.topicsSelector;
            await this.assertNoTextMatches(selector, title);
          },
          
          getTags: async (ps: { forPagePath: PageId, howManyTags: Nr }): Pr<St[]> => {
            // Use .c_TagL-Po  instead, if always including tag type. [alw_tag_type] — yes? pass to 
            // this.widgets.tagList.getTagTitles(..)? to do  [precise_tag_sels]
            const sel = '.s_UP_Act_Ts .esF_TsT .e2eF_T .c_TagL ';
            if (ps.howManyTags === 0) {
              // When the page has appeared, any tags should be there too.
              await this.userProfilePage.activity.topics.waitForPageLinkDisplayed({
                      pagePath: ps.forPagePath });
              await this.waitForGone(sel + this.widgets.tagList.tagListItemSelector);
              return [];
            }
            else {  // incl page id in selector! Currently always just one page.  [precise_tag_sels]
              return await this.widgets.tagList.getTagTitles(sel, ps.howManyTags);
            }
          },


        }
      },

      notfs: {
        waitUntilKnowsIsEmpty: async () => {
          await this.waitForVisible('.e_UP_Notfs_None');
        },

        waitUntilSeesNotfs: async () => {
          await this.waitForVisible('.esUP .esNotfs li a');
        },

        numNotfs: async (): Pr<Nr> => {
          return await this.count('.esUP .esNotfs li a');
        },

        openPageNotfWithText: async (text: St) => {
          await this.repeatUntilAtNewUrl(async () => {
            await this.waitForThenClickText('.esNotf_page', text);
          });
        },

        assertMayNotSeeNotfs: async () => {
          await this.waitForVisible('.e_UP_Notfs_Err');
          await this.assertTextMatches('.e_UP_Notfs_Err', 'EdE7WK2L_');
        }
      },

      draftsEtc: {
        waitUntilLoaded: async () => {
          await this.waitForExist('.s_Dfs');
        },

        refreshUntilNumDraftsListed: async (numDrafts: Nr) => {
          // But this doesn't refresh the page? Hmm
          let numNow: Nr;
          await this.waitUntil(async () => {
            numNow = (await this.$$('.s_Dfs_Df')).length;
            if (numNow === numDrafts)
              return true;
          }, {
            message: `Waiting for ${numDrafts} drafts, num now: ${numNow}`,
          });
        },

        waitUntilNumDraftsListed: async (numDrafts: Nr) => {
          if (numDrafts === 0) {
            await this.waitForDisplayed('.e_Dfs_None');
          }
          else {
            await this.waitForAtLeast(numDrafts, '.s_Dfs_Df');
            await this.assertExactly(numDrafts, '.s_Dfs_Df');
          }
        },

        openDraftIndex: async (index: Nr) => {
          await this.repeatUntilAtNewUrl(async () => {
            await this.waitAndClickNth('.s_Dfs_Df', index);
          });
        },
      },

      invites: {
        clickSendInvite: async () => {
          await this.waitAndClick('.e_SndInvB');
        }
      },

      preferences: {  // RENAME to prefs
        goHere: async (username: St, ps: { isGroup?: true, origin?: St } = {}) => {
          await this.userProfilePage._goHere(username, ps, '/preferences');
        },

        switchToEmailsLogins: async () => {  // RENAME to tabToAccount
          await this.waitAndClick('.s_UP_Prf_Nav_EmLgL');
          if ((await this.urlPath()).startsWith(c.UsersUrlPrefix)) {
            // Wait for user emails loaded.
            await this.waitForVisible('.s_UP_EmLg_EmL');
          }
          else {
            // Currently (May 2019) just this section with a delete button.
            await this.waitForVisible('.s_UP_EmLg');
          }
          await this.waitUntilLoadingOverlayGone();
        },

        switchToAbout: async () => {
          await this.waitAndClick('.s_UP_Prf_Nav_AbtL');
          await this.waitForVisible('.e_UP_Prefs_FN');
        },

        switchToNotifications: async () => {
          await this.waitAndClick('.s_UP_Prf_Nav_NtfsL');
          await this.waitForVisible('.dw-notf-level.btn');
        },

        switchToPrivacy: async () => {
          await this.waitAndClick('.e_UP_Prf_Nav_PrivL');
          await this.waitForVisible('.e_HideActivityAllCB');
        },

        // ---- Should be wrapped in `about { .. }`:

        setFullName: async (fullName: St) => {
          await this.waitAndSetValue('.e_UP_Prefs_FN input', fullName);
        },

        startChangingUsername: async () => {
          await this.waitAndClick('.s_UP_Prefs_ChangeUNB');
          await this.stupidDialog.close();
        },

        setUsername: async (username: St) => {
          await this.waitAndSetValue('.s_UP_Prefs_UN input', username);
        },

        setSummaryEmailsEnabled: async (enabled: Bo) => {
          await this.setCheckbox('#sendSummaryEmails', enabled);
        },

        clickChangePassword: async () => {
          await this.waitAndClick('.s_UP_Prefs_ChangePwB');
        },

        save: async () => {
          await this.userProfilePage.preferences.clickSave();
          await this.waitUntilModalGone();
          await this.waitUntilLoadingOverlayGone();
        },

        clickSave: async () => {
          await this.waitAndClick('#e2eUP_Prefs_SaveB');
        },
        // ---- /END should be wrapped in `about { .. }`.

        notfs: {  // this.userProfilePage.preferences.notfs

          goHere: async (username: St, ps: { isGroup?: true, origin?: St } = {}) => {  // oops, dupl (443300222), keep this
            await this.userProfilePage._goHere(username, ps, '/preferences/notifications');
          },

          setSiteNotfLevel: async (notfLevel: PageNotfLevel) => {  // RENAME to setNotfLevelForWholeSite?
            await this.userProfilePage.preferences.notfs.setNotfLevelForWholeSite(notfLevel);
          },

          setNotfLevelForWholeSite: async (notfLevel: PageNotfLevel) => {
            await this.waitAndClickFirst('.e_SiteNfLvB');
            await this.notfLevelDropdown.clickNotfLevel(notfLevel);
            await this.waitForDisplayed(`.e_SiteNfLvB.s_NfLv-${notfLevel}`);
          },

          setNotfLevelForTopicsRepliedTo: async (notfLevel: PageNotfLevel) => {
            await this.waitAndClickFirst('.e_ReToNfLvB');
            await this.notfLevelDropdown.clickNotfLevel(notfLevel);
            await this.waitForDisplayed(`.e_ReToNfLvB.s_NfLv-${notfLevel}`);
          },

          setNotfLevelForCategoryId: async (categoryId: CategoryId, notfLevel: PageNotfLevel) => {
            await this.waitAndClick(`.e_CId-${categoryId} .dw-notf-level`);
            await this.notfLevelDropdown.clickNotfLevel(notfLevel);
          },
        },

        privacy: {
          setHideActivityForStrangers: async (enabled: Bo) => {
            await this.setCheckbox('.e_HideActivityStrangersCB input', enabled);
          },

          setHideActivityForAll: async (enabled: Bo) => {
            await this.setCheckbox('.e_HideActivityAllCB input', enabled);
          },

          savePrivacySettings: async () => {
            dieIf(await this.isVisible('.e_Saved'), 'TyE6UKHRQP4'); // unimplemented
            await this.waitAndClick('.e_SavePrivacy');
            await this.waitForVisible('.e_Saved');
          },
        },

        emailsLogins: {   // RENAME to `account`
          goHere: async (username: St, ps: { isGroup?: true, origin?: St } = {}) => {
            await this.userProfilePage._goHere(username, ps, '/preferences/account');
          },

          getEmailAddress: async (): Pr<St> => {
            return await this.waitAndGetVisibleText('.s_UP_EmLg_EmL_It_Em');
          },

          waitUntilEmailAddressListed: async (addrRegexStr: St,
                  opts: { shallBeVerified?: Bo } = {}) => {
            const verified = opts.shallBeVerified ? '.e_EmVerfd' : (
              opts.shallBeVerified === false ? '.e_EmNotVerfd' : '');
            await this.waitUntilTextMatches('.s_UP_EmLg_EmL_It_Em' + verified, addrRegexStr);
          },

          waitAndAssertLoginMethod: async (ps: { providerName: St, username?: St,
                    emailAddr?: St, index?: Nr }) => {
            const howSel = '.s_UP_EmLg_LgL_It_How';
            await this.waitForDisplayed(howSel);
            await this.assertNthTextMatches(howSel, ps.index || 1,
                    ps.providerName.toLowerCase(), undefined, { caseless: true });

            if (ps.username || ps.emailAddr) {
              dieIf(!!ps.index, 'unimpl TyE530RKTMD');
              const actualUsername = await this.waitAndGetVisibleText('.s_UP_EmLg_LgL_It_Un');
              const actualEmail = await this.waitAndGetVisibleText('.s_UP_EmLg_LgL_It_Em');
              // Don't convert to lowercase:
              tyAssert.eq(actualUsername, ps.username);
              tyAssert.eq(actualEmail, ps.emailAddr);
            }
          },

          addEmailAddress: async (address: St) => {
            const emailsLogins = this.userProfilePage.preferences.emailsLogins;
            await emailsLogins.clickAddEmailAddress();
            await emailsLogins.typeNewEmailAddress(address);
            await emailsLogins.saveNewEmailAddress();
          },

          clickAddEmailAddress: async () => {
            await this.waitAndClick('.e_AddEmail');
            await this.waitForVisible('.e_NewEmail input');
          },

          typeNewEmailAddress: async (emailAddress: St) => {
            await this.waitAndSetValue('.e_NewEmail input', emailAddress);
          },

          saveNewEmailAddress: async () => {
            await this.waitAndClick('.e_SaveEmB');
            await this.waitForVisible('.s_UP_EmLg_EmAdded');
          },

          canRemoveEmailAddress: async (): Pr<Bo> => {
            await this.waitForVisible('.e_AddEmail');
            // Now any remove button should have appeared.
            return await this.isVisible('.e_RemoveEmB');
          },

          removeFirstEmailAddrOutOf: async (numCanRemoveTotal: Nr) => {
            for (let i = 0; await this.count('.e_RemoveEmB') !== numCanRemoveTotal; ++i) {
              await this.#br.pause(PollMs);
              if (i >= 10 && (i % 10) === 0) {
                logWarning(`Waiting for ${numCanRemoveTotal} remove buttons ...`);
              }
            }
            await this.waitAndClick('.e_RemoveEmB', { clickFirst: true });
            while (await this.count('.e_RemoveEmB') !== numCanRemoveTotal - 1) {
              await this.#br.pause(PollMs);
            }
          },

          canMakeOtherEmailPrimary: async (): Pr<Bo> => {
            // Only call this function if another email has been added (then there's a Remove button).
            await this.waitForVisible('.e_RemoveEmB');
            // Now the make-primary button would also have appeared, if it's here.
            return await this.isVisible('.e_MakeEmPrimaryB');
          },

          makeOtherEmailPrimary: async () => {
            await this.waitAndClick('.e_MakeEmPrimaryB');
          },

          deleteAccount: async () => {
            await this.rememberCurrentUrl();
            await this.waitAndClick('.e_DlAct');
            await this.waitAndClick('.e_SD_SecB');
            await this.waitForNewUrl();
          }
        }
      }
    };


    hasVerifiedSignupEmailPage = {
      clickContinue: async () => {
        await this.repeatUntilAtNewUrl(async () => {
          await this.waitAndClick('#e2eContinue');
        });
      }
    };


    hasVerifiedEmailPage = {  // for additional addresses, RENAME?
      waitUntilLoaded: async (opts: { needToLogin: Bo }) => {
        await this.waitForVisible('.e_HasVerifiedEmail');
        await this.waitForVisible('.e_ViewProfileL');
        await this.waitForVisible('.e_HomepageL');
        assert.ok(opts.needToLogin === await this.isVisible('.e_NeedToLogin'));
      },

      goToHomepage: async () => {
        await this.waitAndClick('.e_HomepageL');
      },

      goToProfile: async () => {
        await this.waitAndClick('.e_ViewProfileL');
      }
    };


    flagDialog = {
      waitUntilFadedIn: async () => {
        await this.waitUntilDoesNotMove('.e_FD_InaptRB');
      },

      clickInappropriate: async () => {
        await this.waitAndClick('.e_FD_InaptRB label');
      },

      submit: async () => {
        await this.waitAndClick('.e_FD_SubmitB');
        await this.waitUntilLoadingOverlayGone();
        // Don't: this.waitUntilModalGone(), because now the stupid-dialog pop ups
        // and says "Thanks", and needs to be closed.
      },
    };


    stupidDialog = {
      yesIAmSure: async () => {
        // It's the same.
        await this.stupidDialog.close();
      },

      clickClose: async () => {
        await this.waitAndClick('.e_SD_CloseB');
      },

      close: async () => {
        await this.stupidDialog.clickClose();
        await this.waitUntilModalGone();
      },
    };


    tips = {
      numTipsDisplayed: async (): Pr<Nr> => {
        return await this.count(':not(.c_SrvAnns) > .dw-help');
      },
      hideATips: async () => {
        await this.waitAndClickFirst(':not(.c_SrvAnns) > .dw-help .dw-hide');
      },
      waitForExactlyNumTips: async (num: Nr) => {
        await this.waitForExactly(num, ':not(.c_SrvAnns) > .dw-help');
      },
      unhideAllTips: async () => {
        await this.topbar.openMyMenu();
        await this.topbar.myMenu.unhideTips();
      },
      waitForPreviewTips: async () => {
        await this.waitForDisplayed('.dw-preview-help');
      },
      waitForPreviewTipsGone: async () => {
        await this.waitForGone('.dw-preview-help');
      },
      isPreviewTipsDisplayed: async (): Pr<Bo> => {
        return await this.isDisplayed('.dw-preview-help');
      },

      numAnnouncementsDisplayed: async (): Pr<Nr> => {
        return await this.count('.c_SrvAnns .dw-help');
      },
      hideAnAnnouncement: async () => {
        await this.waitAndClickFirst('.c_SrvAnns .dw-hide');
      },
      waitForExactlyNumAnnouncements: async (num: Nr) => {
        await this.waitForExactly(num, '.c_SrvAnns .dw-help');
      },
      assertAnnouncementDisplayed: async (dotClassName: St) => {
        await this.assertDisplayed('.c_SrvAnns .dw-help ' + dotClassName);
      },
      unhideAllAnnouncements: async () => {
        await this.topbar.openMyMenu();
        await this.topbar.myMenu.unhideAnnouncements();
      },
    };


    adminArea = {
      waitAssertVisible: async () => {
        await this.waitForVisible('h1.esTopbar_custom_title');
        await this.assertTextMatches('h1', "Admin Area");
      },

      clickLeaveAdminArea: async () => {
        await this.repeatUntilAtNewUrl(async () => {
          await this.waitAndClick('.s_Tb_Ln-Bck');
        });
      },

      goToLoginSettings: async (origin?: St, opts: { loginAs? } = {}) => {
        await this.go2((origin || '') + '/-/admin/settings/login');
        if (opts.loginAs) {
          await this.loginDialog.loginWithPassword(opts.loginAs);
          await this.adminArea.waitAssertVisible();
        }
      },

      goToUsersEnabled: async (origin?: St) => {
        await this.go2((origin || '') + '/-/admin/users');
      },

      goToUser: async (member: Member | UserId, origin?: St) => {
        const userId = _.isNumber(member) ? member : member.id;
        await this.go2((origin || '') + `/-/admin/users/id/${userId}`);
      },

      tabs: {
        navToApi: async () => {
          await this.repeatUntilAtNewUrl(async () => {
            await this.waitAndClick('.e_ApiB');
          });
        },
        isApiTabDisplayed: async (): Pr<Bo> => {
          return await this.isDisplayed('.e_ApiB');
        },

        navToGroups: async () => await this.adminArea.navToGroups(),
      },

      navToGroups: async () => {   // MOVE to inside tabs {}, see just above.
        await this.repeatUntilAtNewUrl(async () => {
          await this.waitAndClick('.e_GrpsB');
        });
      },

      goToUsersInvited: async (origin?: St, opts: { loginAs? } = {}) => {
        await this.go((origin || '') + '/-/admin/users/invited');
        if (opts.loginAs) {
          await this.loginDialog.loginWithPassword(opts.loginAs);
        }
        await this.adminArea.users.invites.waitUntilLoaded();
      },

      goToBackupsTab: async (origin?: St, opts: { loginAs? } = {}) => {
        await this.adminArea._goToMaybeLogin(origin, '/-/admin/backup', opts);
        await this.adminArea.backupsTab.waitUntilLoaded();
      },

      goToApi: async (origin?: St, opts: { loginAs? } = {}) => {
        await this.go((origin || '') + '/-/admin/api');
        if (opts.loginAs) {
          await this.loginDialog.loginWithPassword(opts.loginAs);
        }
        await this.adminArea.apiTab.waitUntilLoaded();
      },

      goToReview: async (origin?: St, opts: { loginAs? } = {}) => {
        await this.go((origin || '') + '/-/admin/review/all');
        if (opts.loginAs) {
          await this.loginDialog.loginWithPassword(opts.loginAs);
        }
        await this.adminArea.review.waitUntilLoaded();
      },

      _goToMaybeLogin: async (origin: St, endpoint: St, opts: { loginAs? } = {}) => {
        await this.go((origin || '') + endpoint);
        if (opts.loginAs) {
          await this.loginDialog.loginWithPassword(opts.loginAs);
        }
      },

      goToAdminExtraLogin: async (origin?: St) => {
        await this.go((origin || '') + '/-/admin-login');
      },

      isReviewTabVisible: async (): Pr<Bo> => {
        return await this.isVisible('.e_RvwB');
      },

      isUsersTabVisible: async (): Pr<Bo> => {
        return await this.isVisible('.e_UsrsB');
      },

      numTabsVisible: async (): Pr<Nr> =>
        (await this.$$('.esAdminArea .dw-main-nav > li')).length,

      settings: {
        clickSaveAll: async (ps: { willFail?: Bo } = {}) => {
          await this.scrollToBottom();
          await this.waitAndClick('.esA_SaveBar_SaveAllB');
          await this.waitUntilLoadingOverlayGone();
          if (!ps.willFail) {
            await this.waitUntilGone('.esA_SaveBar_SaveAllB');
          }
        },

        clickLegalNavLink: async () => {
          await this.waitAndClick('#e2eAA_Ss_LegalL');
          await this.waitForVisible('#e2eAA_Ss_OrgNameTI');
        },

        clickLoginNavLink: async () => {
          await this.waitAndClick('#e2eAA_Ss_LoginL');
          await this.waitForVisible('#e2eLoginRequiredCB');
        },

        clickModerationNavLink: async () => {
          await this.waitAndClick('#e2eAA_Ss_ModL');
        },

        clickAnalyticsNavLink: async () => {
          await this.waitAndClick('#e2eAA_Ss_AnalyticsL');
        },

        clickAdvancedNavLink: async () => {
          await this.waitAndClick('#e2eAA_Ss_AdvancedL');
        },

        clickExperimentalNavLink: async () => {
          await this.waitAndClick('#e2eAA_Ss_ExpL');
        },

        legal: {
          editOrgName: async (newName: St) => {
            await this.waitAndSetValue('#e2eAA_Ss_OrgNameTI', newName);
          },

          editOrgNameShort: async (newName: St) => {
            await this.waitAndSetValue('#e2eAA_Ss_OrgNameShortTI', newName);
          },
        },

        login: {
          goHere: async (origin?: St, opts: { loginAs? } = {}) => {
            await this.adminArea.goToLoginSettings(origin, opts);
          },

          setRequireVerifiedEmail: async (isRequired: Bo) => {
            await this.setCheckbox('.e_A_Ss_S-RequireVerifiedEmailCB input', isRequired);
          },

          setLoginRequired: async (isRequired: Bo) => {
            await this.setCheckbox('#e2eLoginRequiredCB', isRequired);
          },

          setApproveUsers: async (isRequired: Bo) => {
            await this.setCheckbox('#e_ApproveUsersCB', isRequired);
          },

          clickAllowGuestLogin: async () => {
            await this.waitAndClick('#e2eAllowGuestsCB');
          },

          setExpireIdleAfterMinutes: async (minutes: Nr) => {
            await this.scrollIntoViewInPageColumn('.e_LgoIdlAftMins input');
            await this.waitAndSetValue('.e_LgoIdlAftMins input', minutes, { checkAndRetry: true });
          },

          setEnableOidcDontSave: async (enabled: Bo) => {
            const sel = '.e_A_Ss_S-OidcCB input';
            await this.scrollIntoViewInPageColumn(sel);
            await this.waitUntilDoesNotMove(sel);
            await this.setCheckbox(sel, enabled);
          },

          setOnlyOidc: async (only: Bo) => {
            const sel = '.e_A_Ss_S-OnlyOidcCB input';
            await this.scrollIntoViewInPageColumn(sel);
            await this.waitUntilDoesNotMove(sel);
            await this.setCheckbox(sel, only);
          },

          configureIdps: async (json: St) => {
            await this.waitAndClick('.e_ConfIdpsB');
            await this.waitAndSetValue('.s_CuIdpsEdr textarea', json, { checkAndRetry: true });
            await this.waitAndClick('.s_CuIdpsEdr .btn');
          },

          setEmailDomainWhitelist: async (text: St) => {
            await this.scrollIntoViewInPageColumn('.e_EmailWhitelist textarea');
            await this.waitAndSetValue('.e_EmailWhitelist textarea', text, { checkAndRetry: true });
          },

          setEmailDomainBlocklist: async (text: St) => {
            await this.scrollIntoViewInPageColumn('.e_EmailBlacklist textarea');
            await this.waitAndSetValue('.e_EmailBlacklist textarea', text, { checkAndRetry: true });
          },

          typeSsoUrl: async (url: St) => {
            await this.scrollIntoViewInPageColumn('.e_SsoUrl input');
            await this.waitUntilDoesNotMove('.e_SsoUrl input');
            await this.waitAndSetValue('.e_SsoUrl input', url, { checkAndRetry: true });
          },

          setSsoLogoutUrl: async (url: St) => {
            await this.scrollIntoViewInPageColumn('.e_SsoLgoUrl input');
            await this.waitUntilDoesNotMove('.e_SsoLgoUrl input');
            await this.waitAndSetValue('.e_SsoLgoUrl input', url, { checkAndRetry: true });
          },

          setSsoLoginRequiredLogoutUrl: async (url: St) => {
            await this.scrollIntoViewInPageColumn('.e_SsoAftLgoUrl input');
            await this.waitUntilDoesNotMove('.e_SsoAftLgoUrl input');
            await this.waitAndSetValue('.e_SsoAftLgoUrl input', url, { checkAndRetry: true });
          },

          setEnableSso: async (enabled: Bo) => {
            await this.scrollIntoViewInPageColumn('.e_EnblSso input');
            await this.waitUntilDoesNotMove('.e_EnblSso input');
            await this.setCheckbox('.e_EnblSso input', enabled);
          },

          setShowEmbAuthnBtns: async (enabled: Bo) => {
            await this.scrollIntoViewInPageColumn('.e_EmbAuBs input');
            await this.waitUntilDoesNotMove('.e_EmbAuBs input');
            await this.setCheckbox('.e_EmbAuBs input', enabled);
          },

          generatePasetoV2LocalSecret: async () => {
            await this.waitAndClick('.e_EmbComSecr_GenB');
          },

          copyPasetoV2LocalSecret: async (): Pr<St> => {
            return await this.waitAndGetValue('.e_EmbComSecr input');
          },

          goToSsoTestPage: async () => {
            await this.repeatUntilAtNewUrl(async () => {
              await this.waitAndClickFirst('.e_SsoTestL');
            });
          }
        },

        moderation: {
          goHere: async (origin?: St, opts: { loginAs? } = {}) => {
            await this.adminArea._goToMaybeLogin(origin, '/-/admin/settings/moderation', opts);
            await this.waitForVisible('.e_NumFstAprBef');
          },

          setNumFirstToApproveBefore: async (n: Nr) => {
            await this.scrollAndSetValue('.e_NumFstAprBef input', n);
          },

          setApproveBeforeTrustLevel: async (level: Nr) => {
            await this.scrollAndSetValue('.e_AprBefTrLvl input', level);
          },

          setMaxNumPendingApproval: async (n: Nr) => {
            await this.scrollAndSetValue('.e_MxPndApr input', n);
          },

          setNumFirstToReviewAfter: async (n: Nr) => {
            await this.scrollAndSetValue('.e_NumFstRvwAft input', n);
          },

          setReviewAfterTrustLevel: async (level: Nr) => {
            await this.scrollAndSetValue('.e_RvwAftTrLvl input', level);
          },

          setMaxNumPendingReview: async (n: Nr) => {
            await this.scrollAndSetValue('.e_MxPndRvw input', n);
          },
        },

        features: {
          goHere: async (origin?: St, opts: { loginAs? } = {}) => {
            await this.adminArea._goToMaybeLogin(origin, '/-/admin/settings/features', opts);
          },

          setEnableApi: async (enabled: Bo) => {
            // ---- Can remove, right
            await this.scrollIntoViewInPageColumn('#te_EnblApi');
            await this.waitUntilDoesNotMove('#te_EnblApi');
            // ----------------------
            await this.setCheckbox('#te_EnblApi', enabled);
          },

          setEnableCors: async (enabled: Bo) => {
            await this.setCheckbox('.e_EnbCors input', enabled);
          },

          setCorsOrigins: async (text: St) => {
            await this.waitAndSetValue('.e_CorsFrm textarea', text);
          },
        },

        embedded: {
          goHere: async (origin?: St) => {
            await this.go((origin || '') + '/-/admin/settings/embedded-comments');
          },

          setAllowEmbeddingFrom: async (value: St) => {
            await this.waitAndSetValue('#e_AllowEmbFrom', value);
          },

          createSaveEmbeddingPage: async (ps: { urlPath: St, discussionId?: St }) => {
            const htmlToPaste = await this.waitAndGetVisibleText('#e_EmbCmtsHtml');
            const pageHtml = utils.makeEmbeddedCommentsHtml({
                htmlToPaste, discussionId: ps.discussionId,
                pageName: ps.urlPath, color: 'black', bgColor: '#a359fc' });
            fs.writeFileSync(`target/${ps.urlPath}`, pageHtml);
          },
        },

        advanced: {
          duplHostnamesSelector: '.s_A_Ss_S-Hostnames-Dupl pre',
          redirHostnamesSelector: '.s_A_Ss_S-Hostnames-Redr pre',

          getHostname: async (): Pr<St> => {
            return await this.waitAndGetVisibleText('.esA_Ss_S_Hostname');
          },

          getDuplicatingHostnames: async (): Pr<St> => {
            return await this.waitAndGetVisibleText(this.adminArea.settings.advanced.duplHostnamesSelector);
          },

          isDuplicatingHostnamesVisible: async (): Pr<Bo> => {
            return await this.isVisible(this.adminArea.settings.advanced.duplHostnamesSelector);
          },

          getRedirectingHostnames: async (): Pr<St> => {
            return await this.waitAndGetVisibleText(this.adminArea.settings.advanced.redirHostnamesSelector);
          },

          isRedirectingHostnamesVisible: async (): Pr<Bo> => {
            return await this.isVisible(this.adminArea.settings.advanced.redirHostnamesSelector);
          },

          clickChangeSiteAddress: async () => {
            await this.waitAndClick('.e_ChAdrB');
          },

          typeNewSiteAddress: async (newAddress: St) => {
            await this.waitAndSetValue('.s_A_NewAdrD_HostnI input', newAddress);
          },

          saveNewSiteAddress: async () => {
            await this.waitAndClick('.s_A_NewAdrD .btn-primary');
          },

          waitForNewSiteRedirectLink: async () => {
            await this.waitForVisible('.e_NewSiteAddr');
          },

          followLinkToNewSiteAddr: async () => {
            await this.rememberCurrentUrl();
            await this.waitAndClick('.e_NewSiteAddr');
            await this.waitForNewOrigin();
          },

          clickRedirectOldSiteAddresses: async () => {
            await this.waitAndClick('.e_RedirOldAddrB');
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

        viewUser: async (username: St | Member) => {
          await this.go2('/-/admin/users/id/' + ((username as Member).username || username));
          await this.adminArea.user.waitForLoaded();
        },

        waitForLoaded: async () => {
          await this.waitForVisible('.esA_Us_U_Rows');
        },

        viewPublProfile: async () => {
          await this.waitAndClick('.e_VwPblPrfB');
        },

        assertUsernameIs: async (usernameOrMember: St | Member) => {
          const username = _.isString(usernameOrMember) ?
              usernameOrMember : (usernameOrMember as Member).username;
          await this.waitAndAssertVisibleTextMatches('.e_A_Us_U_Username', username);
        },

        assertEnabled: async () => {
          await this.adminArea.user.waitForLoaded();
          assert.ok(await this.isVisible(this.adminArea.user.enabledSelector));
        },

        assertEmailVerified: async () => {
          assert.ok(await this.isVisible(this.adminArea.user.setEmailNotVerifiedButtonSelector));
        },

        assertEmailNotVerified: async () => {
          assert.ok(await this.isVisible(this.adminArea.user.setEmailVerifiedButtonSelector));
        },

        setEmailToVerified: async (verified: Bo) => {
          const u = this.adminArea.user;
          await this.waitAndClick(
              verified ? u.setEmailVerifiedButtonSelector : u.setEmailNotVerifiedButtonSelector);
          // Wait for the request to complete — then, the opposite buttons will be shown:
          await this.waitForVisible(
              verified ? u.setEmailNotVerifiedButtonSelector : u.setEmailVerifiedButtonSelector);
        },

        resendEmailVerifEmail: async () => {
          await this.waitAndClick(this.adminArea.user.sendEmVerEmButtonSelector);
        },

        assertDisabledBecauseNotYetApproved: async () => {
          await this.adminArea.user.waitForLoaded();
          assert.ok(await this.isVisible(this.adminArea.user.disabledSelector));
          assert.ok(await this.isVisible(this.adminArea.user.disabledBecauseWaitingForApproval));
          // If email not verified, wouldn't be considered waiting.
          assert.ok(!await this.isVisible(this.adminArea.user.disabledBecauseEmailUnverified));
        },

        assertDisabledBecauseEmailNotVerified: async () => {
          await this.adminArea.user.waitForLoaded();
          assert.ok(await this.isVisible(this.adminArea.user.disabledSelector));
          assert.ok(await this.isVisible(this.adminArea.user.disabledBecauseEmailUnverified));
          // Isn't considered waiting, until after email approved.
          assert.ok(!await this.isVisible(this.adminArea.user.disabledBecauseWaitingForApproval));
        },

        assertApprovedInfoAbsent: async () => {
          await this.adminArea.user.waitForLoaded();
          assert.ok(await this.isExisting('.e_Appr_Info-Absent'));
        },

        assertApproved: async () => {
          await this.adminArea.user.waitForLoaded();
          assert.ok(await this.isVisible('.e_Appr_Yes'));
        },

        assertRejected: async () => {
          await this.adminArea.user.waitForLoaded();
          assert.ok(await this.isVisible('.e_Appr_No'));
        },

        assertWaitingForApproval: async () => {   // RENAME to  assertApprovalUndecided
          await this.adminArea.user.waitForLoaded();
          assert.ok(await this.isVisible('.e_Appr_Undecided'));
        },

        approveUser: async () => {
          await this.waitAndClick('.e_Appr_ApprB');
          await this.waitForVisible('.e_Appr_Yes');
        },

        rejectUser: async () => {
          await this.waitAndClick('.e_Appr_RejB');
          await this.waitForVisible('.e_Appr_No');
        },

        undoApproveOrReject: async () => {
          await this.waitAndClick('.e_Appr_UndoB');
          await this.waitForVisible('.e_Appr_Undecided');
        },

        suspendUser: async (opts: {
              days: Nr, reason: St } = { days: 10, reason: "Because." }) => {
          await this.waitAndClick('.e_Suspend');
          await this.waitUntilDoesNotMove('.e_SuspDays');
          await this.waitAndSetValue('.e_SuspDays input', opts.days);
          await this.waitAndSetValue('.e_SuspReason input', opts.reason);
          await this.waitAndClick('.e_DoSuspendB');
          await this.waitForVisible('.e_Unuspend');
        },

        unsuspendUser: async () => {
          await this.waitAndClick('.e_Unuspend');
          await this.waitForVisible('.e_Suspend');
        },

        setTrustLevel: async (trustLevel: TrustLevel) => {
          await this.waitAndClick('.e_TruLvB');
          await this.waitAndClick('.e_TruLv-' + trustLevel);
          await this.waitForDisplayed('.e_TruLvLkd');
        },

        unlockTrustLevel: async () => {
          await this.waitAndClick('.e_TruLvB');
          await this.waitAndClick('.e_UnlkTruLvB');
          await this.waitForVisible('.e_TruLv0Lkd');
        },

        // RENAME to setTheatLevel(...)
        markAsNoThreat: async () => {
          await this.waitAndClick('.e_TrtLvB');
          await this.waitAndClick('.e_HopfSafB');
          await this.waitForVisible('.e_ThreatLvlIsLkd');
          await this.waitForDisplayed('.e_TrtLv-3'); // HopefullySafe
        },

        markAsMildThreat: async () => {
          await this.waitAndClick('.e_TrtLvB');
          await this.waitAndClick('.e_MildThreatB');
          await this.waitForVisible('.e_ThreatLvlIsLkd');
          await this.waitForDisplayed('.e_TrtLv-4'); // MildThreat
        },

        markAsModerateThreat: async () => {
          await this.waitAndClick('.e_TrtLvB');
          await this.waitAndClick('.e_ModerateThreatB');
          await this.waitForVisible('.e_ThreatLvlIsLkd');
          await this.waitForDisplayed('.e_TrtLv-5'); // ModerateThreat
        },

        unlockThreatLevel: async () => {
          await this.waitAndClick('.e_TrtLvB');
          await this.waitAndClick('.e_UnlockThreatB');
          await this.waitForVisible('.e_ThreatLvlNotLkd');
        },

        grantAdmin: async () => {
          await this.waitForVisible('.e_Adm-No');
          await this.waitAndClick('.e_ToggleAdminB');
          await this.waitForVisible('.e_Adm-Yes');
        },

        revokeAdmin: async () => {
          await this.waitForVisible('.e_Adm-Yes');
          await this.waitAndClick('.e_ToggleAdminB');
          await this.waitForVisible('.e_Adm-No');
        },

        grantModerator: async () => {
          await this.waitForVisible('.e_Mod-No');
          await this.waitAndClick('.e_ToggleModB');
          await this.waitForVisible('.e_Mod-Yes');
        },

        revokeModerator: async () => {
          await this.waitForVisible('.e_Mod-Yes');
          await this.waitAndClick('.e_ToggleModB');
          await this.waitForVisible('.e_Mod-No');
        },

        startImpersonating: async () => {
          await this.repeatUntilAtNewUrl(async () => {
            await this.waitAndClick('#e2eA_Us_U_ImpersonateB');
          });
        },
      },

      users: {
        usernameSelector: '.dw-username',
        enabledUsersTabSelector: '.e_EnabledUsB',
        waitingUsersTabSelector: '.e_WaitingUsB',

        waitForLoaded: async () => {
          await this.waitForVisible('.e_AdminUsersList');
        },

        goToUser: async (user: St | Member) => {
          const username = _.isString(user) ? user : user.username;
          await this.rememberCurrentUrl();
          await this.waitForThenClickText(this.adminArea.users.usernameSelector, username);
          await this.waitForNewUrl();
          await this.adminArea.user.assertUsernameIs(user);
        },

        assertUserListEmpty: async () => {
          await this.adminArea.users.waitForLoaded();
          assert.ok(await this.isVisible('.e_NoSuchUsers'));
        },

        assertUserListed: async (member: { username: St }) => {
          await this.adminArea.users.waitForLoaded();
          await this.assertAnyTextMatches(this.adminArea.users.usernameSelector, member.username);
        },

        assertUserAbsent: async (member: { username: St }) => {
          await this.adminArea.users.waitForLoaded();
          await this.assertNoTextMatches(this.adminArea.users.usernameSelector, member.username);
        },

        asserExactlyNumUsers: async (num: Nr) => {
          await this.adminArea.users.waitForLoaded();
          await this.assertExactly(num, this.adminArea.users.usernameSelector);
        },

        // Works only if exactly 1 user listed.
        assertEmailVerified_1_user: async (member: Member, verified: Bo) => {
          // for now:  --
          await this.adminArea.users.assertUserListed(member);
          // later, check the relevant user row.
          // ------------
          if (verified) {
            assert.ok(!await this.isVisible('.e_EmNotVerfd'));
          }
          else {
            assert.ok(await this.isVisible('.e_EmNotVerfd'));
          }
        },

        switchToEnabled: async () => {
          await this.waitAndClick(this.adminArea.users.enabledUsersTabSelector);
          await this.waitForVisible('.e_EnabledUsersIntro');
          await this.adminArea.users.waitForLoaded();
        },

        switchToWaiting: async () => {
          await this.waitAndClick(this.adminArea.users.waitingUsersTabSelector);
          await this.adminArea.users.waiting.waitUntilLoaded();
        },

        isWaitingTabVisible: async (): Pr<Bo> => {
          await this.waitForVisible(this.adminArea.users.enabledUsersTabSelector);
          return await this.isVisible(this.adminArea.users.waitingUsersTabSelector);
        },

        switchToNew: async () => {
          await this.waitAndClick('.e_NewUsB');
          await this.waitForVisible('.e_NewUsersIntro');
          await this.adminArea.users.waitForLoaded();
        },

        switchToStaff: async () => {
          await this.waitAndClick('.e_StaffUsB');
          await this.waitForVisible('.e_StaffUsersIntro');
          await this.adminArea.users.waitForLoaded();
        },

        switchToSuspended: async () => {
          await this.waitAndClick('.e_SuspendedUsB');
          await this.waitForVisible('.e_SuspendedUsersIntro');
          await this.adminArea.users.waitForLoaded();
        },

        switchToWatching: async () => {
          await this.waitAndClick('.e_WatchingUsB');
          await this.waitForVisible('.e_ThreatsUsersIntro');
          await this.adminArea.users.waitForLoaded();
        },

        switchToInvites: async () => {
          await this.waitAndClick('.e_InvitedUsB');
          await this.adminArea.users.invites.waitUntilLoaded();
        },

        waiting: {
          undoSelector: '.e_UndoApprRjctB',

          waitUntilLoaded: async () => {
            await this.waitForVisible('.e_WaitingUsersIntro');
            await this.adminArea.users.waitForLoaded();
          },

          approveFirstListedUser: async () => {
            await this.waitAndClickFirst('.e_ApproveUserB');
            await this.waitForVisible(this.adminArea.users.waiting.undoSelector);
          },

          rejectFirstListedUser: async () => {
            await this.waitAndClickFirst('.e_RejectUserB');
            await this.waitForVisible(this.adminArea.users.waiting.undoSelector);
          },

          undoApproveOrReject: async () => {
            await this.waitAndClickFirst(this.adminArea.users.waiting.undoSelector);
            await this.waitUntilGone(this.adminArea.users.waiting.undoSelector);
          },
        },

        invites: {
          waitUntilLoaded: async () => {
            // When this elem present, any invited-users-data has also been loaded.
            await this.waitForExist('.s_InvsL');
          },

          clickSendInvite: async () => {
            await this.waitAndClick('.s_AA_Us_Inv_SendB');
          },
        }
      },

      interface: {
        goHere: async (origin?: St, opts: { loginAs? } = {}) => {
          await this.adminArea._goToMaybeLogin(origin, '/-/admin/customize/basic', opts);
        },

        waitUntilLoaded: async () => {
          await this.waitForVisible('.s_A_Ss_S');
          // Top tab pane unmount bug workaround apparently not needed here. [5QKBRQ] [E2EBUG]
          // Can be removed elsewhere too?
        },

        areTopicSectionSettingsVisible: async (): Pr<Bo> => {
          return await this.isVisible('.e_DscPrgSct');
        },

        setSortOrder: async (value: Nr) => {
          dieIf(value === 0, "Cannot set to default — that'd clear the value, " +
              "but this.#br drivers are buggy / weird, won't work with Webdriver v4 [TyE06KUDS]");
          // 0 = default.
          const valueOrEmpty = value === 0 ? '' : value;
          await this.waitAndSetValue('.e_BlgSrtOdr input', valueOrEmpty, { checkAndRetry: true });
        },

        setBlogPostLikeVotes: async (value: Nr) => {
          await this.waitAndSetValue('.e_BlgPstVts input', value, { checkAndRetry: true });
        },

        setAddCommentBtnTitle: async (title: St) => {
          await this.waitAndSetValue('.e_AddCmtBtnTtl input', title, { checkAndRetry: true });
        },

      },

      backupsTab: {
        waitUntilLoaded: async () => {
          await this.waitForVisible('.s_A_Bkp');
        },

        clickRestore: async () => {
          await this.waitAndClick('.e_RstBkp');
        },

        selectFileToRestore: async (fileNameInTargetDir: St) => {
          await this.waitAndSelectFile('.e_SelFil', 'TargetDir', fileNameInTargetDir);
        },
      },

      apiTab: {
        waitUntilLoaded: async () => {
          await this.waitForVisible('.s_A_Api');
        },

        generateSecret: async () => {
          await this.waitAndClick('.e_GenSecrB');
        },

        showAndCopyMostRecentSecret: async (): Pr<St> => {
          await this.waitAndClick('.e_ShowSecrB');
          return await this.waitAndGetVisibleText('.esStupidDlg .e_SecrVal');
        },
      },

      review: {
        goHere: async (origin?: St, opts: { loginAs? } = {}) => {
          await this.adminArea.goToReview(origin, opts);
        },

        waitUntilLoaded: async () => {
          await this.waitForVisible('.s_A_Rvw');
          //----
          // Top tab pane unmount bug workaround, for e2e tests. [5QKBRQ].  [E2EBUG]
          // Going to the Settings tab, makes the Review tab pane unmount, and after that,
          // it won't surprise-unmount ever again (until page reload).
          await this.waitAndClick('.e_UsrsB');
          await this.waitAndClick('.e_RvwB');
          await this.waitForVisible('.s_A_Rvw');
          //----
        },

        hideCompletedTasks: async () => {
          await this.setCheckbox('.e_HideCompl input', true);
          await this.waitForGone('.e_TskDoneGone');
        },

        playTimePastUndo: async () => {
          // Make the server and this.#br believe we've waited for the review timeout seconds.
          await server.playTimeSeconds(c.ReviewDecisionUndoTimoutSeconds + 10);
          await this.playTimeSeconds(c.ReviewDecisionUndoTimoutSeconds + 10);
        },

        // DEPRECATED  CLEAN_UP REFACTOR change to  { pageId?, postNr?, dontCareWhichPost? }
        // and require  dontCareWhichPost  to be true, or the others.
        // So won't create flappy tests!
        waitForServerToCarryOutDecisions: async (pageId?: PageId, postNr?: PostNr) => {
          // Then wait for the server to actually do something.
          // The UI will reload the task list and auto-update itself [2WBKG7E], when
          // the review decisions have been carried out server side. Then the buttons
          // tested for below, hide.
          let buttonsNotGone;
          await this.waitUntil(async () => {
            await this.#br.pause(c.JanitorThreadIntervalMs + 200);
            if (!pageId) {
              if (!await this.isVisible('.s_A_Rvw_Tsk_UndoB'))
                return true;
            }
            else {
              // If we have a specific post in mind, then not only the Undo, but also
              // any Accept or Delete buttons elsewhere, for the same post, should
              // disappear, when the server is done.
              assert.ok(_.isNumber(postNr));
              const pagePostSelector = '.e_Pg-Id-' + pageId + '.e_P-Nr-' + postNr;
              const stillVisible = await this.filterVisible([
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
            await this.#br.refresh();
            await this.adminArea.review.waitUntilLoaded();
            //----
          }, {
            message: () => buttonsNotGone,
            refreshBetween: true,
          });
          await this.waitUntilLoadingOverlayGone();
        },

        goToPostForTaskIndex: async (index: Nr) => {
          die("Won't work, opens in new tab [TyE5NA2953]");
          const numTabsBefore = await this.numTabs();
          await this.topic.clickPostActionButton(`.e_RT-Ix-${index} .s_A_Rvw_Tsk_ViewB`);
          await this.waitForMinBrowserTabs(numTabsBefore + 1);
          await this.swithToOtherTabOrWindow();  // ! but might be the wrong window
          // Need to find the newly appeared new win id?
          await this.topic.waitForLoaded();
        },

        approvePostForMostRecentTask: async () => {
          await this.topic.clickPostActionButton('.e_A_Rvw_Tsk_AcptB', { clickFirst: true });
          await this.waitUntilModalGone();
          await this.waitUntilLoadingOverlayGone();
        },

        approvePostForTaskIndex: async (index: Nr) => {
          await this.topic.clickPostActionButton(`.e_RT-Ix-${index} .e_A_Rvw_Tsk_AcptB`);
          await this.waitUntilModalGone();
          await this.waitUntilLoadingOverlayGone();
        },

        rejectDeleteTaskIndex: async (index: Nr) => {
          await this.topic.clickPostActionButton(`.e_RT-Ix-${index} .e_A_Rvw_Tsk_RjctB`);
          await this.waitUntilModalGone();
          await this.waitUntilLoadingOverlayGone();
        },

        countReviewTasksFor: async (pageId: PageId, postNr: PostNr,
              opts: { waiting: Bo }): Pr<Nr> => {
          const pageIdPostNrSelector = '.e_Pg-Id-' + pageId + '.e_P-Nr-' + postNr;
          const waitingSelector = opts.waiting ? '.e_Wtng' : '.e_NotWtng';
          const selector = '.esReviewTask' + pageIdPostNrSelector + waitingSelector;
          const elems: WElm[] = await this.$$(selector);
          logMessage(`Counted to ${elems.length} of these: ${selector}`);
          return elems.length;
        },

        isMoreStuffToReview: async (): Pr<Bo> => {
          return await this.isVisible('.e_A_Rvw_Tsk_AcptB');
        },

        waitForTextToReview: async (text: St | RegExp, ps: { index?: Nr } = {}) => {
          let selector = '.esReviewTask_it';
          if (ps.index !== undefined) {
            selector = `.e_RT-Ix-${ps.index} ${selector}`;
          }
          await this.waitUntilTextMatches(selector, text);
        },

        // RENAME to countReviewTasks? and add countReviewTasksWaiting?
        countThingsToReview: async (): Pr<Nr> =>
          (await this.$$('.esReviewTask_it')).length,

        isTasksPostDeleted: async (taskIndex: Nr): Pr<Bo> => {
          return await this.isVisible(`.e_RT-Ix-${taskIndex}.e_P-Dd`);
        }
      },

      adminExtraLogin: {
        submitEmailAddress: async (emailAddress: St) => {
          await this.waitAndSetValue('.e_AdmEmI', emailAddress);
          await this.waitAndClick('.e_SbmB');
          await this.waitForGone('.e_SbmB');
        },

        assertIsBadEmailAddress: async () => {
          await this.assertPageHtmlSourceMatches_1('TyE0ADMEML_');
        },

        assertEmailSentMessage: async () => {
          await this.assertPageHtmlSourceMatches_1('Email sent');
        }
      }
    };


    inviteDialog = {
      waitUntilLoaded: async () => {
        await this.waitForVisible('.s_InvD');
      },

      typeAndSubmitInvite: async (emailAddress: St, ps: { numWillBeSent?: Nr } = {}) => {
        await this.inviteDialog.typeInvite(emailAddress);
        await this.inviteDialog.clickSubmit();
        if (ps.numWillBeSent !== undefined) {
          await this.inviteDialog.waitForCorrectNumSent(ps.numWillBeSent);
        }
        await this.inviteDialog.closeResultsDialog();
      },

      typeInvite: async (emailAddress: St) => {
        await this.waitAndSetValue('.s_InvD textarea', emailAddress, { maybeMoves: true });
      },

      clickSubmit: async () => {
        await this.waitAndClick('.s_InvD .btn-primary');
      },

      cancel: async () => {
        await this.waitAndClick('.s_InvD .e_Cncl');
      },

      waitForCorrectNumSent: async (num: Nr) => {
        await this.waitForVisible('.e_Invd-' + num);
      },

      assertAlreadyJoined: async (emailAddr: St) => {
        await this.waitForVisible('.e_InvJoind');
        tyAssert.eq(await this.count('.e_InvJoind li'), 1);
        tyAssert.eq(await this.waitAndGetVisibleText('.e_InvJoind li'), emailAddr);
      },

      assertAlreadyInvited: async (emailAddr: St) => {
        await this.waitForVisible('.e_InvRtr');
        tyAssert.eq(await this.count('.e_InvRtr li'), 1);
        tyAssert.eq(await this.waitAndGetVisibleText('.e_InvRtr li'), emailAddr);
      },

      closeResultsDialog: async () => {
        await this.waitAndClick('.s_InvSentD .e_SD_CloseB', { maybeMoves: true });
      },

      isInviteAgainVisible: async (): Pr<Bo> => {
        await this.waitForVisible('.s_InvD .btn-primary');
        return await this.isVisible('.e_InvAgain');
      }
    };


    invitedUsersList = {
      invitedUserSelector: '.e_Inv_U',

      waitUntilLoaded: async () => {
        // When this elem present, any invited-users-data has also been loaded.
        await this.waitForExist('.s_InvsL');
      },

      setHideOld: async (value: Bo) => {
        await this.setCheckbox('.e_OnlPend input', value);
      },

      setShowOnePerUserOnly: async (value: Bo) => {
        await this.setCheckbox('.e_OnePerP input', value);
      },

      assertHasAcceptedInvite: async (username: St) => {
        await this.assertAnyTextMatches(this.invitedUsersList.invitedUserSelector, username);
      },

      assertHasNotAcceptedInvite: async (username: St) => {
        await this.assertNoTextMatches(this.invitedUsersList.invitedUserSelector, username);
      },

      waitAssertInviteRowPresent: async (index: Nr, opts: {
            email: St, accepted?: Bo, acceptedByUsername?: St, sentByUsername?: St,
            deleted?: Bo }) => {

        dieIf(opts.accepted === false && !_.isUndefined(opts.acceptedByUsername), 'TyE06WKTJ3');
        dieIf(
            _.isUndefined(opts.deleted) &&
            _.isUndefined(opts.accepted) &&
            _.isUndefined(opts.acceptedByUsername), 'TyE502RKDL24');

        await this.waitForAtLeast(index, '.s_InvsL_It');
        await this.assertNthTextMatches('.e_Inv_Em', index, opts.email);
        if (opts.accepted === false) {
          await this.assertNthTextMatches('.e_Inv_U', index, /^$/);
        }
        if (opts.deleted) {
          await this.assertNthClassIncludes('.s_InvsL_It', index, 's_InvsL_It-Dd');
        }
        if (opts.acceptedByUsername) {
          await this.assertNthTextMatches('.e_Inv_U', index, opts.acceptedByUsername);
        }
        if (opts.sentByUsername) {
          await this.assertNthTextMatches('.e_Inv_SentByU', index, opts.sentByUsername);
        }
      },

      countNumInvited: async (): Pr<Nr> =>
        (await this.$$('.s_InvsL_It')).length,
    };


    apiV0 = {
      loginWithSecret: async (ps: { origin: St, oneTimeSecret: St, thenGoTo: St }) => {
        await this.go2(ps.origin +
            `/-/v0/login-with-secret?oneTimeSecret=${ps.oneTimeSecret}&thenGoTo=${ps.thenGoTo}`);
      },
    };


    unsubscribePage = {
      confirmUnsubscription: async () => {
        await this.rememberCurrentUrl();
        await this.waitAndClick('input[type="submit"]');
        await this.waitForNewUrl();
        await this.waitForDisplayed('#e2eBeenUnsubscribed');
      },
    };


    changePasswordDialog = {
      clickYesChange: async () => {
        await this.waitAndClick('.esStupidDlg .btn-primary');
      },
    };


    notfLevelDropdown = {
      clickNotfLevel: async (notfLevel: PageNotfLevel) => {
        switch (notfLevel) {
          case c.TestPageNotfLevel.EveryPost:
            await this.waitAndClick('.e_NtfAll');
            await this.waitForGone('.e_NtfAll');
            break;
          case c.TestPageNotfLevel.TopicProgress:
            die('unimpl');
            break;
          case c.TestPageNotfLevel.TopicSolved:
            die('unimpl');
            break;
          case c.TestPageNotfLevel.NewTopics:
            await this.waitAndClick('.e_NtfFst');
            await this.waitForGone('.e_NtfFst');
            break;
          case c.TestPageNotfLevel.Tracking:
            die('unimpl');
            break;
          case c.TestPageNotfLevel.Normal:
            await this.waitAndClick('.e_NtfNml');
            await this.waitForGone('.e_NtfNml');
            break;
          case c.TestPageNotfLevel.Hushed:
            await this.waitAndClick('.e_NtfHsh');
            await this.waitForGone('.e_NtfHsh');
            break;
          case c.TestPageNotfLevel.Muted:
            await this.waitAndClick('.e_NtfMtd');
            await this.waitForGone('.e_NtfMtd');
            break;
          default:
            die('e2e bug');
        }
      },
    };


    tagsDialog = {
      createAndAddTag: async (tagName: St, ps: { numAfterwards: Nr }) => {
        await this.waitAndSetValue('.e_CrTgI input', tagName);
        await this.waitAndClick('.e_CrTgB');
        await this.widgets.reactSelect('.e_AdTg').waitUntilNumItems(ps.numAfterwards);
      },

      addExistingTag: async (tagName: St, ps: { numAfterwards: Nr }) => {
        await this.widgets.reactSelect('.e_AdTg').startTypingItemName(tagName);
        await this.widgets.reactSelect('.e_AdTg').hitEnterToSelectItem();
        await this.widgets.reactSelect('.e_AdTg').waitUntilNumItems(ps.numAfterwards);
      },

      removeNthTag: async (n: Nr, ps: { numAfterwards: Nr }) => {
        await this.widgets.reactSelect('.e_AdTg').removeNthItem(n);
        await this.widgets.reactSelect('.e_AdTg').waitUntilNumItems(ps.numAfterwards);
      },

      saveAndClose: async () => {
        // More preciise selector? So knows is the correct dialog  [precise_tag_sels]
        await this.waitAndClick('.modal-footer .btn-primary');
      },
    };


    shareDialog = {
      copyLinkToPost: async () => {  // RENAME, append:  ...ToClipboard
        await this.waitAndClick('.s_ShareD_Link');
      },

      getLinkUrl: async (): Pr<St> => {
        return await this.waitAndGetValue('.s_ShareD_Link');
      },

      close: async () => {
        await this.waitAndClick('.esDropModal_CloseB');  // currently not inside .s_ShareD
      }
    };


    movePostDialog = {
      moveToOtherSection: async () => {
        await this.waitAndClick('.s_MPD_OtrSct .btn');
        await this.waitAndClick('.esStupidDlg a');
      },

      pastePostLinkMoveToThere: async () => {
        await this.waitAndPasteClipboard('#te_MvPI');
        await this.waitAndClick('.e_MvPB');
      }
    };


    editHistoryDialog = {
      close: async () => {
        await this.waitAndClick('.dw-edit-history .modal-footer .btn');
        await this.waitUntilGone('.dw-edit-history');
      },

      countDiffs: async (): Pr<Nr> => {
        return await this.count('.dw-edit-history pre');
      },

      waitUntilVisible: async () => {
        await this.waitForVisible('.dw-edit-history');
        await this.waitUntilDoesNotMove('.dw-edit-history');
      },

      waitGetAuthorAndDiff: async (editEntryNr: Nr): Pr<EditHistoryEntry> => {
        dieIf(editEntryNr < 1, "First edit diff entry is nr 1, not 0 [TyE20KGUTf06]");
        // Nr 1 is a help text, nr 2 is the first diff entry — so add +1.
        const selector =
            `.dw-edit-history .modal-body > div > .ed-revision:nth-child(${editEntryNr + 1})`;
        await this.waitForDisplayed(selector);
        const authorUsername = await this.waitAndGetVisibleText(selector + ' .dw-username');
        const diffHtml = await (await this.$(selector + ' pre')).getHTML();
        return {
          authorUsername,
          diffHtml,
        }
      },
    };


    notFoundDialog = {
      waitAndAssertErrorMatches: async (regex: St | RegExp, ifDevRegex?: St | RegExp) => {
        await this.waitAndAssertVisibleTextMatches('body > pre', regex);
        if (!settings.prod && ifDevRegex) {
          await this.waitAndAssertVisibleTextMatches('body > pre', ifDevRegex);
        }
      },

      clickHomeLink: async () => {
        await this.waitAndClick('.s_LD_NotFound_HomeL');
      }
    };


    serverErrorDialog = {
      isDisplayed: async (): Pr<Bo> => {
        return await this.isVisible('.s_SED_Msg');
      },

      failTestAndShowDialogText: async () => {
        tyAssert.ok(await this.serverErrorDialog.isDisplayed());
        const title = await this.waitAndGetText('.s_SED_Ttl');
        const text = await (await this.$('.s_SED_Msg')).getHTML();
        console.trace();
        assert.fail(
            `Unexpected error dialog: [TyEERRDLG]\n` +
            `title:  ${title}\n` +
            `text: --------------------------------------------------------------\n` +
            `${text}\n` +
            `--------------------------------------------------------------------\n`);
      },

      waitForNotLoggedInError: async () => {
        await this.waitUntilTextMatches('.s_SED_Msg', 'TyE0LGDIN_');
      },

      waitForNotLoggedInAsAdminError: async () => {
        await this.waitUntilTextMatches('.s_SED_Msg', 'TyE0LGIADM_');
      },

      waitForJustGotSuspendedError: async () => {
        await this.waitUntilTextMatches('.s_SED_Msg', 'TyESUSPENDED_|TyE0LGDIN_');
      },

      dismissReloadPageAlert: async () => {
        // Seems this alert appears only in a visible browser (but not if invisible/headless).
        for (let i = 0; i < 3; ++i) {
          // Clicking anywhere triggers an alert about reloading the page, although has started
          // writing — because was logged out by the server (e.g. because user suspended)
          // and then som js tries to reload.
          await (await this.$('.modal-body')).click();
          const gotDismissed = await this.dismissAnyAlert();
          if (gotDismissed) {
            logMessage("Dismissed got-logged-out but-had-started-writing related alert.");
            return;
          }
        }
        logMessage("Didn't get any got-logged-out but-had-started-writing related alert.");
      },

      waitAndAssertTextMatches: async (regex: St | RegExp, ifDevRegex?: St | RegExp) => {
        await this.waitAndAssertVisibleTextMatches('.s_SED_Msg', regex);
        if (!settings.prod && ifDevRegex) {
          await this.waitAndAssertVisibleTextMatches('.s_SED_Msg', ifDevRegex);
        }
      },

      waitForBadEmailAddressError: async () => {
        await this.waitUntilTextMatches('.s_SED_Msg', 'TyEBADEMLADR_');
      },

      waitForBadEmailDomainError: async () => {
        // Sometimes there's this error:
        //   stale element reference: element is not attached to the page document
        // Why? Maybe there's another dialog .modal-body that fades away and disappears
        // before the server error dialog's .modal-body appears?
        await utils.tryManyTimes("waitForBadEmailDomainError", 2, async () => {
          await this.waitUntilTextMatches('.s_SED_Msg', 'TyEBADEMLDMN_');
        });
      },

      waitForTooManyInvitesError: async () => {
        await this.waitUntilTextMatches('.s_SED_Msg', 'TyETOOMANYBULKINV_');
      },

      waitForTooManyInvitesLastWeekError: async () => {
        await this.waitUntilTextMatches('.s_SED_Msg', 'TyINVMANYWEEK_');
      },

      waitForXsrfTokenExpiredError: async () => {
        await this.waitUntilTextMatches('.s_SED_Msg', 'TyEXSRFEXP_');
      },

      waitForIsRegistrationSpamError: async () => {
        // The //s regex modifier makes '.' match newlines. But it's not available before ES2018.
        await this.serverErrorDialog.waitAndAssertTextMatches(/spam.*TyEPWREGSPM_/s);
      },

      waitForFirstPostsNotApproved: async () => {
        await this.serverErrorDialog.waitAndAssertTextMatches(/approv.*_EsE6YKF2_/);
      },

      waitForTooManyPendingApproval: async () => {
        await this.serverErrorDialog.waitAndAssertTextMatches(/approv.*TyE2MNYPNDAPR_/);
      },

      waitForTooManyPendingReview: async () => {
        await this.serverErrorDialog.waitAndAssertTextMatches(/review.*TyE2MNYPNDRVW_/);
      },

      waitForTooManyPendingMaybeSpamPostsError: async () => {
        // The //s regex modifier makes '.' match newlines. But it's not available before ES2018.
        await this.serverErrorDialog.waitAndAssertTextMatches(/spam.*TyENEWMBRSPM_/s);
      },

      waitForCannotReplyPostDeletedError: async () => {
        await this.serverErrorDialog.waitAndAssertTextMatches(/has been deleted.*TyEM0REPLY_/s);
      },

      close: async () => {
        await this.waitAndClick('.e_SED_CloseB');
        await this.waitUntilGone('.dw-server-error .modal-dialog');
      }
    };

    tour = {
      runToursAlthoughE2eTest: async () => {
        await this.#br.execute(function() {
          localStorage.setItem('runToursAlthoughE2eTest', 'true');
        });
      },

      assertTourStarts: async (shallStart: Bo) => {
        // Wait for the tour to appear. (There's no other way to do that right now,
        // than just waiting for a while. It appears within about a second.
        // Note that this is also used to test that the tour *does* appear fast enough,
        // not only that it does *not* appear — to test, that this test, works.)
        await this.waitUntil(async () => await this.isVisible('.s_Tour'), {
          timeoutMs: 3500,
          timeoutIsFine: true,
          message: `Will the intro tour start? ...`,
        });
        tyAssert.eq(await this.isVisible('.s_Tour'), shallStart);
      },

      clickNextForStepNr: async (stepNr: Nr) => {
        // Don't scroll — the tour will scroll for us. (Scrolling here too, could scroll
        // too much, and the click might fail.)
        await this.waitAndClick(
                `.s_Tour-Step-${stepNr} .s_Tour_D_Bs_NextB`, { mayScroll: false });
      },

      exitTour: async () => {
        await this.waitAndClick(`.s_Tour_D_Bs_ExitB`, { mayScroll: false });
      },
    };

    helpDialog = {
      waitForThenClose: async (ps: { shallHaveBodyClass?: St } = {}) => {
        if (ps.shallHaveBodyClass) {
          await this.waitForDisplayed(`.esHelpDlg ${ps.shallHaveBodyClass}`);
        }
        await this.waitAndClick('.esHelpDlg .btn-primary');
        await this.waitUntilModalGone();
      },
    };

    // REFACTOR  MOVE all these fns to the contexts where they can be called?
    // so autocomplete can be used
    complex = {
      waitUntilLoggedIn: async () => {   // RENAME  use me.waitUntilLoggedIn()  instead
        await this.waitUntil(async () => {
          return await this.#br.execute(function() {
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

        if (await this.metabar.isVisible()) {
          // Extra test, if in embedded comments iframe:
          await this.metabar.waitUntilLoggedIn();
        }
        else if (await this.topbar.isVisible()) {
          // Extra test, if on topic list pages or discussion pages, but not comments iframes:
          await this.topbar.waitForMyMenuVisible();
        }
        else if (false) {  // if is in editor iframe
          // then what?
        }
      },


      waitForLoggedInInEmbeddedCommentsIrames: async () => {
        await this.switchToEmbeddedCommentsIrame();
        await this.complex.waitUntilLoggedIn();
        await this.switchToEmbeddedEditorIrame();
        await this.complex.waitUntilLoggedIn();
        await this.switchToAnyParentFrame();
      },

      waitForNotLoggedInInEmbeddedCommentsIframe: async (
              ps: { willBeLoginBtn?: false } = {}) => {
        await this.switchToEmbeddedCommentsIrame();
        await this.waitForMyDataAdded();
        if (ps.willBeLoginBtn !== false) {
          await this.metabar.waitForLoginButtonVisible();  // ok? or is this a race?
        }
        else {
          // Could do always, but looking for the login button (above) is enough.
          const me = await this.me.waitAndGetMyself();
          tyAssert.not(me.isLoggedIn);
          tyAssert.not(me.id);
        }
        await this.switchToAnyParentFrame();
      },

      loginWithPasswordViaTopbar: async (username: St | Member | { username, password },
            optsOrPassword?: St | { resultInError?: Bo }) => {
        let password = optsOrPassword;
        let opts;
        console.log(`TyE2eApi: loginWithPasswordViaTopbar`);
        if (password && _.isObject(password)) {
          opts = <any> password;
          password = null;
        }
        await this.topbar.clickLogin();
        const credentials = _.isObject(username) ?  // already { username, password } object
            username : { username: username, password: password };
        await this.loginDialog.loginWithPassword(credentials, opts || {});
      },

      signUpAsMemberViaTopbar: async (
            member: Member | { emailAddress: string, username: string, password: string }) => {
        await this.topbar.clickSignUp();
        await this.loginDialog.createPasswordAccount({
          username: member.username,
          emailAddress: member.emailAddress,
          password: member.password,
          willNeedToVerifyEmail: false,
        });
      },

      signUpAsGuestViaTopbar: async (nameOrObj: string | { fullName, emailAddress }, email?: string) => {
        await this.disableRateLimits();
        await this.topbar.clickSignUp();
        let name: string;
        if (_.isObject(nameOrObj)) {
          assert.ok(!email);
          name = nameOrObj.fullName;
          email = nameOrObj.emailAddress;
        }
        else {
          name = nameOrObj;
        }
        await this.loginDialog.signUpAsGuest(name, email);
      },

      signUpAsGmailUserViaTopbar: async ({ username }) => {
        await this.disableRateLimits();
        await this.topbar.clickSignUp();
        await this.loginDialog.createGmailAccount({
            email: settings.gmailEmail, password: settings.gmailPassword, username });
      },

      logInAsGuestViaTopbar: async (nameOrObj: string | { fullName, emailAddress }, email?: string) => {
        await this.topbar.clickLogin();
        let name: string;
        if (_.isObject(nameOrObj)) {
          assert.ok(!email);
          name = nameOrObj.fullName;
          email = nameOrObj.emailAddress;
        }
        else {
          name = nameOrObj;
        }
        await this.loginDialog.logInAsGuest(name, email);
      },

      loginIfNeededViaMetabar: async (ps: NameAndPassword) => {
        await this.switchToEmbCommentsIframeIfNeeded();
        await this.waitForMyDataAdded();
        if (!await this.metabar.isLoggedIn()) {
          logMessage(`Need to log in, as @${ps.username
                } — session id cookie blocked? [TyM306MRKTJ]`);
          await this.complex.loginWithPasswordViaMetabar(ps);
        }
      },

      loginWithPasswordViaMetabar: async (ps: NameAndPassword) => {
        await this.metabar.clickLogin();
        await this.loginDialog.loginWithPasswordInPopup(ps);
      },

      snoozeNotifications: async (ps: SnoozeTime = {}) => {
        await this.topbar.openMyMenu();
        await this.topbar.myMenu.snoozeNotfs(ps);
      },

      unsnoozeNotifications: async () => {
        await this.topbar.openMyMenu();
        await this.topbar.myMenu.unsnooze();
      },

      closeSidebars: async () => {
        if (await this.isVisible('#esWatchbarColumn')) {
          await this.watchbar.close();
        }
        if (await this.isVisible('#esThisbarColumn')) {
          await this.contextbar.close();
        }
      },

      createCategory: async (ps: { name: string, extId?: string }) => {
        await this.forumButtons.clickCreateCategory();
        await this.categoryDialog.fillInFields(ps);
        await this.categoryDialog.submit();
      },

      createAndSaveTopic: async (data: { title: St, body: St, type?: PageRole,
            willBePendingApproval?: Bo,
            matchAfter?: Bo, titleMatchAfter?: St | false,
            bodyMatchAfter?: St | false, resultInError?: Bo }) => {
        await this.forumButtons.clickCreateTopic();
        await this.editor.editTitle(data.title);
        await this.editor.editText(data.body);
        if (data.type) {
          await this.editor.setTopicType(data.type);
        }
        await this.complex.saveTopic(data);
      },

      saveTopic: async (data: { title: St, body?: St, type?: PageRole,
            willBePendingApproval?: Bo,
            matchAfter?: Bo, titleMatchAfter?: St | false,
            bodyMatchAfter?: St | false, resultInError?: Bo }) => {
        await this.rememberCurrentUrl();
        await this.editor.save();
        if (!data.resultInError) {
          await this.waitForNewUrl();
          if (data.willBePendingApproval) {
            await this.waitForVisible('.dw-p-ttl .esPendingApproval');
            await this.waitForVisible('.dw-ar-t .esPendingApproval');
          }

          // Only in the title text, not body text.
          const titlePend = data.willBePendingApproval ? "Page pending approval\n" : '';

          if (data.matchAfter !== false && data.titleMatchAfter !== false) {
            // if (data.titleMatchAfter)
            await this.assertPageTitleMatches(data.titleMatchAfter || data.title);
            if (!data.titleMatchAfter) {
              await this.topic.assertPostTextIs(c.TitleNr, titlePend + data.title);
            }
          }

          if (!data.body && !data.bodyMatchAfter) {
            // Noop. Nothing to compare the new topic Orig Post with.
          }
          else if (data.matchAfter !== false && data.bodyMatchAfter !== false) {
            if (data.type === c.TestPageRole.OpenChat) {
              // Then there's no page body, insetad:
              await this.chat.waitAndAssertPurposeIs(data.body);
            }
            else {
              await this.assertPageBodyMatches(data.bodyMatchAfter || data.body);
              if (!data.bodyMatchAfter) {
                await this.topic.assertPostTextIs(c.BodyNr, data.body);
              }
            }
          }
        }
        await this.waitUntilLoadingOverlayGone();
      },

      editPageTitle: async (newTitle: string) => {
        await this.pageTitle.clickEdit();
        await this.pageTitle.editTitle(newTitle);
        await this.pageTitle.save();
        await this.topic.waitUntilPostTextMatches(c.TitleNr, newTitle);
        await this.assertPageTitleMatches(newTitle);
      },

      editPageBody: async (newText: string, opts: { append?: Bo, textAfterIs?: St,
              textAfterMatches?: St } = {}) => {
        await this.topic.clickEditOrigPost();
        await this.editor.editText(newText, opts);
        await this.editor.save();
        if (opts.textAfterMatches || opts.textAfterIs) {
          if (opts.textAfterMatches) {
            await this.topic.waitUntilPostTextMatches(c.BodyNr, opts.textAfterMatches);
          }
          if (opts.textAfterIs) {
            await this.topic.waitUntilPostTextIs(c.BodyNr, opts.textAfterIs);
            await this.topic.assertPostTextIs(c.BodyNr, newText);  // why this too?
          }
        }
        else if (opts.append) {
          await this.topic.waitUntilPostTextMatches(c.BodyNr, newText);  // includes!
          await this.assertPageBodyMatches(newText);  // includes!
        }
        else {
          await this.topic.waitUntilPostTextIs(c.BodyNr, newText);
          await this.topic.assertPostTextIs(c.BodyNr, newText);  // why this too?
        }
      },

      editPostNr: async (postNr: PostNr, newText: string, opts: { append?: boolean } = {}) => {
        await this.topic.clickEditPostNr(postNr);
        await this.editor.editText(newText, opts);
        await this.editor.save();
        await this.topic.waitUntilPostTextMatches(postNr, newText);
      },

      replyToOrigPost: async (text: string, whichButton?: 'DiscussionSection') => {
        await this.topic.clickReplyToOrigPost(whichButton);
        await this.editor.editText(text);
        await this.editor.save();
      },

      startReplyingToEmbBlogPost: async (text: St) => {
        await this.complex.startReplyingToPostNr(c.BodyNr, text);
      },

      startReplyingToPostNr: async (postNr: PostNr, text?: St) => {
        if (postNr === c.BodyNr) await this.topic.clickReplyToEmbeddingBlogPost();
        else await this.topic.clickReplyToPostNr(postNr);
        await this.switchToEmbeddedEditorIrame();
        if (!_.isUndefined(text)) {
          await this.editor.editText(text, { timeoutMs: 3000 });
        }
      },

      replyToEmbeddingBlogPost: async (text: string,
            opts: { signUpWithPaswordAfterAs?, needVerifyEmail?: boolean } = {}) => {
        // Apparently, if FF cannot click the Reply button, now when in an iframe,
        // then FF says "all fine I clicked the button", but in fact does nothing,
        // also won't log any error or anything, so that later on, we'll block
        // forever when waiting for the editor.
        // So sometimes this neeeds to be in a retry loop, + timeoutMs below. [4RDEDA0]
        await this.switchToEmbeddedCommentsIrame();
        logMessage("comments iframe: Clicking Reply ...");
        await this.topic.clickReplyToEmbeddingBlogPost();
        //if (opts.loginWithPaswordBeforeAs) {
          //this.loginDialog.loginWithPasswordInPopup(opts.loginWithPaswordBeforeAs);
        //}
        await this.switchToEmbeddedEditorIrame();
        logMessage("editor iframe: Composing a reply ...");
        // Previously, before retrying scroll-to-top, this could hang forever in FF.
        // Add a timeout here so the retry (see comment above) will work.
        await this.editor.editText(text, { timeoutMs: 3000 });
        logMessage("editor iframe: Saving ...");
        await this.editor.save();

        if (opts.signUpWithPaswordAfterAs) {
          logMessage("editor iframe: Switching to login popup to log in / sign up ...");
          await this.swithToOtherTabOrWindow();
          await this.disableRateLimits();
          await this.loginDialog.createPasswordAccount(
              opts.signUpWithPaswordAfterAs, false,
              opts.needVerifyEmail === false ? 'THERE_WILL_BE_NO_VERIFY_EMAIL_DIALOG' : null);
          await this.switchBackToFirstTabOrWindow();
        }

        logMessage("editor iframe: Done.");
        await this.switchToEmbeddedCommentsIrame();
      },

      addProgressReply: async (text: string) => {
        await this.topic.clickAddProgressReply();
        await this.editor.editText(text);
        await this.editor.save();
      },

      replyToPostNr: async (postNr: PostNr, text: string, opts: { isEmbedded?: true } = {}) => {
        if (opts.isEmbedded) {
          await this.switchToEmbeddedCommentsIrame();
        }

        // Sometimes the click fails — maybe a sidebar opens, making the button move a bit? Or
        // the window scrolls, making the click miss? Or whatever. If the click misses the
        // button, most likely, the editor won't open. So, if after clicking, the editor
        // won't appear, then click again.
        await this.topic.waitForPostNrVisible(postNr);
        await this.#br.pause(50); // makes the first click more likely to succeed (without,
        // failed 2 times out of 4 at a place in unsubscribe.2browsers.test.ts — but with,
        // failed 2 times out of 20).
        for (let clickAttempt = 0; true; ++clickAttempt) {
          await this.topic.clickReplyToPostNr(postNr);
          try {
            if (opts.isEmbedded) {
              await this.switchToEmbeddedEditorIrame();
            }
            await this.waitForVisible('.esEdtr_textarea', { timeoutMs: 5000 });
            break;
          }
          catch (ignore) {
            logUnusual("When clicking the Reply button, the editor didn't open. Trying again");
            dieIf(clickAttempt === 3, "Couldn't click Reply and write a reply [EdE7FKAC2]");
            if (opts.isEmbedded) {
              await this.switchToEmbeddedCommentsIrame();
            }
          }
        }
        await this.editor.editText(text);
        await this.editor.save();
        if (opts.isEmbedded) {
          await this.switchToEmbeddedCommentsIrame();
        }
      },

      flagPost: async (postNr: PostNr, reason: 'Inapt' | 'Spam') => {
        await this.topic.clickFlagPost(postNr);
        await this.flagDialog.waitUntilFadedIn();
        if (reason === 'Inapt') {
          await this.flagDialog.clickInappropriate();
        }
        else {
          die('Test code bug, only Inapt implemented in tests, yet [EdE7WK5FY0]');
        }
        await this.flagDialog.submit();
        await this.stupidDialog.close();
      },

      openPageAuthorProfilePage: async () => {
        logMessage(`Open about author dialog...`);
        await this.pageTitle.openAboutAuthorDialog();
        logMessage(`Click view profile...`);
        await this.aboutUserDialog.clickViewProfile();
      },

      sendMessageToPageAuthor: async (messageTitle: St, messageText: St) => {
        logMessage(`Opens page author's About dialog...`);
        await this.pageTitle.openAboutAuthorDialog();
        await this.complex.__sendMessageImpl(messageTitle, messageText);
      },

      sendMessageToPostNrAuthor: async (postNr: PostNr, messageTitle: St, messageText: St) => {
        logMessage(`Opens post nr ${postNr} author's About dialog ...`);
        await this.topic.openAboutUserDialogForPostNr(postNr);
        await this.complex.__sendMessageImpl(messageTitle, messageText);
      },

      __sendMessageImpl: async (messageTitle: St, messageText: St) => {
        logMessage(`Click Send Message...`);
        await this.aboutUserDialog.clickSendMessage();
        logMessage(`Edit message title...`);
        await this.editor.editTitle(messageTitle);
        logMessage(`Edit message text...`);
        await this.editor.editText(messageText);
        logMessage(`Submit...`);
        await this.editor.saveWaitForNewPage();
        logMessage(`Done, now at new page: ${await this.urlPath()}`);
      },

      createChatChannelViaWatchbar: async (
            data: { name: St, purpose: St, public_?: Bo }) => {
        await this.watchbar.clickCreateChatWaitForEditor();
        await this.editor.editTitle(data.name);
        await this.editor.editText(data.purpose);
        if (data.public_ === false) {
          await this.editor.setTopicType(c.TestPageRole.PrivateChat);
        }
        await this.rememberCurrentUrl();
        await this.editor.save();
        await this.waitForNewUrl();
        await this.assertPageTitleMatches(data.name);
      },

      addPeopleToPageViaContextbar: async (usernames: St[]) => {
        await this.contextbar.clickAddPeople();
        // was:  _.each(usernames, this.addUsersToPageDialog.addOneUser));
        for (const un of usernames) {
          await this.addUsersToPageDialog.addOneUser(un);
        }
        await this.addUsersToPageDialog.submit({ closeStupidDialogAndRefresh: true });
        // was:  _.each(usernames, this.contextbar.assertUserPresent);
        for (const un of usernames) {
          await this.contextbar.assertUserPresent(un);
        }
      }
    }


  async setCheckbox(selector: St, checked: Bo, opts: WaitAndClickPs = {}) {
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
    await this.waitForVisible(selector, opts);
    let bugRetry = 0;
    const maxBugRetry = 2;
    for (; bugRetry <= maxBugRetry; ++bugRetry) {
      logMessage(selector + ' is visible, should be checked: ' + checked);
      for (let i = 0; i < 99; ++i) {
        let isChecked = await (await this.$(selector)).isSelected();
        logMessage(selector + ' is checked: ' + isChecked);
        if (isChecked === checked)
          break;
        await this.waitAndClick(selector, opts);
        logMessage(selector + ' **click**');
      }
      // Somehow once this function exited with isChecked !== isRequired. Race condition?
      // Let's find out:
      let isChecked = await (await this.$(selector)).isSelected();
      let was = isChecked;
      logMessage(selector + ' is checked: ' + isChecked);
      await this.#br.pause(300);
      isChecked = await (await this.$(selector)).isSelected();
      logMessage(selector + ' is checked: ' + isChecked);
      if (was !== isChecked) debugger;
      await this.#br.pause(400);
      isChecked = await (await this.$(selector)).isSelected();
      /* maybe works better now? (many months later)
      ... yes, CLEAN_UP remove this, plus the comment above. Was a bug I've now fixed watn't it.
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
    tyAssert.ok(bugRetry <= maxBugRetry, "Couldn't set checkbox to checked = " + checked);
  }


  widgets = {
    tagList: {
      tagListItemSelector: '.c_TagL_Tag',

      // Instead, paramms?:  { within, howMany, forWhat: 'Pat' | 'Post' ?}  [precise_tag_sels]
      getTagTitles: async (selector: St, howManyTags: Nr | U): Pr<St[]> => {
        return await utils.tryManyTimes(`Getting tags/badges in: ${selector}`, 2,
                async (): Pr<St[]> => {
          const tagSel = selector + ' ' + this.widgets.tagList.tagListItemSelector;
          const elms: WElm[] = howManyTags === undefined
              ? await this.$$(tagSel)
              : await this.waitForExactly(howManyTags, tagSel);
          const titles: St[] = [];
          for (const el of elms) {
            const title: St = await el.getText();
            titles.push(title);
          }
          return titles;
        })
      }
    },

    reactSelect: (selector: St) => { return {
      startTypingItemName: async (chars: St) => {
        // Dupl code. [.react_select]
        await this.waitAndSetValue(`${selector} .Select-input > input`, chars,
            { okayOccluders: '.Select-placeholder', checkAndRetry: true });
      },

      appendChars: async (chars: St) => {
        await (await this.$(`${selector} .Select-input > input`)).addValue(chars);
      },

      hitEnterToSelectItem: async () => {
        // Dupl code. [.react_select]
        // Might not work in Firefox. Didn't in wdio v4.
        // Doesn't work with DevTools; types the letters in "Return" instead. [E2EBUG]
        // But works with WebDriver / Selenium.
        logWarningIf(settings.useDevtoolsProtocol, `\n\n` +
              `this.#br.keys(['Return'])  won't work with DevTools!  ` +
              `Just types "Return" instead\n\n`);
        await this.#br.keys(['Return']);
      },

      waitUntilNumItems: async (num: Nr) => {
        await this.waitForExactly(num, `${selector} .Select-value-label`);
      },

      removeNthItem: async (n: Nr) => {
        await this.waitAndClickNth(`${selector} .Select-value-icon`, n);
      },
    }},
  }
}

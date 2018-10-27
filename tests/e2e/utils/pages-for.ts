import _ = require('lodash');
import assert = require('assert');
import logAndDie = require('./log-and-die');
import settings = require('./settings');
import server = require('./server');
import c = require('../test-constants');
const logUnusual = logAndDie.logUnusual, die = logAndDie.die, dieIf = logAndDie.dieIf;
const logError = logAndDie.logError;
const logMessage = logAndDie.logMessage;

// Brekpoint debug help counters, use like so:  if (++ca == 1) debugger;
let ca = 0;
let cb = 0;
let cc = 0;


function count(elems): number {
  return elems && elems.value ? elems.value.length : 0;
}


function byBrowser(result) {  // dupl code [4WKET0] move all to here?
  if (!_.isObject(result) || _.isArray(result) || result.value) {
    // This is the results from one single browser. Create a dummy by-browser
    // result map.
    return { onlyOneBrowser: result };
  }
  else {
    // This is an object like:
    //    { browserA: { ..., value: ... }, browserB: { ..., value: ... } }
    // or like:
    //    { browserA: "text-found", browserB: "other-text-found" }
    // That's what we want.
    return result;
  }
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


// There might be many browsers, when using Webdriver.io's multiremote testing, so
// `browser` is an argument.
//
function pagesFor(browser) {
  const origWaitForVisible = browser.waitForVisible;
  const origWaitForEnabled = browser.waitForEnabled;
  const origWaitForText = browser.waitForText;
  const origWaitForExist = browser.waitForExist;

  const hostsVisited = {};

  const api = {

    origin: (): string => {
      return api._findOrigin();
    },

    host: (): string => {
      const origin = api.origin();
      return origin.replace(/https?:\/\//, '');
    },

    _findOrigin: (): string => {
      const url = browser.url().value;
      const matches = url.match(/(https?:\/\/[^\/]+)\//);
      if (!matches) {
        throw Error('NoOrigin');
      }
      return matches[1];
    },

    urlPathQueryHash: (): string => {
      const result = browser.execute(function() {
        return location.pathname + location.search + location.hash;
      });
      dieIf(!result || !result.value, 'TyE5ABKRHNS02');
      return result.value;
    },


    go: (url, opts: { useRateLimits?: boolean } = {}) => {
      let shallDisableRateLimits = false;

      if (url[0] === '/') {
        // Local url, need to add origin.
        try { url = api._findOrigin() + url; }
        catch (ex) {
          dieIf(ex.message === 'NoOrigin',
              `When opening the first page: ${url}, you need to specify the server origin [TyE7UKHW2]`);
          throw ex;
        }
      }
      else if (!opts.useRateLimits) {
        const parts = url.split('/');
        const host = parts[2];
        if (!hostsVisited[host]) {
          shallDisableRateLimits = true;
          hostsVisited[host] = true;
        }
      }

      logMessage(`Go: ${url}${shallDisableRateLimits ? " & disable rate limits" : ''}`);
      browser.url(url);

      if (shallDisableRateLimits) {
        browser.disableRateLimits();
      }
    },


    goAndWaitForNewUrl: function(url) {
      logMessage("Go: " + url);
      api.rememberCurrentUrl();
      browser.url(url);
      api.waitForNewUrl();
    },


    disableRateLimits: function() {
      browser.setCookie({ name: 'esCoE2eTestPassword', value: settings.e2eTestPassword });
    },


    getSiteId: function(): string {
      const result = browser.execute(function() {
        return window['eds'].siteId;
      });
      dieIf(!result || _.isNaN(parseInt(result.value)),
          "Error getting site id, result: " + JSON.stringify(result));
      return result.value;
    },


    swithToOtherTabOrWindow: function() {
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
          logMessage("Calling browser.switchTab(id), id = " + id);
          browser.switchTab(id);
          return;
        }
      }
      // Might be a login popup that got auto closed? [3GRQU5]
      logMessage("Didn't find any other window to switch to. [EdM2WPDL0]");
    },


    switchBackToFirstTabOrWindow: function() {
      // If no id specified, will switch to the first tab.
      browser.pause(500);
      let ids = browser.getTabIds();
      if (ids.length > 1) {
        // I've tested "everything else", nothing works.
        logMessage("Waiting for any OAuth loging popup to auto close, to prevent weird " +
            "invalid window ID errors");
        browser.pause(2000);
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
        browser.pause(2500);
        const idsAgain = browser.getTabIds();
        browser.switchTab(idsAgain[0]);
      }
    },


    _currentUrl: '',

    rememberCurrentUrl: function() {
      // Weird, url() returns:
      // {"state":"success","sessionId":"..","hCode":...,"value":"http://server/path","class":"org.openqa.selenium.remote.Response","status":0}
      // is that a bug?
      api._currentUrl = browser.url().value;
    },

    waitForNewUrl: function() {
      assert(!!api._currentUrl, "Please call browser.rememberCurrentUrl() first [EsE7JYK24]");
      while (api._currentUrl === browser.url().value) {
        browser.pause(250);
      }
    },



    switchToFrame: function(selector) {
      console.log(`switching to frame ${selector}...`);
      api.waitForExist(selector);
      const iframe = browser.element(selector).value;
      browser.frame(iframe);
    },


    switchToEmbeddedCommentsIrame: function() {
      // These pause() avoids: "FAIL: Error: Remote end send an unknown status code", in Chrome, [E2EBUG]
      // here: [6UKB2FQ]
      browser.pause(75);
      browser.frameParent();
      browser.pause(75);
      api.switchToFrame('iframe#ed-embedded-comments');
    },


    switchToEmbeddedEditorIrame: function() {
      browser.frameParent();
      api.switchToFrame('iframe#ed-embedded-editor');
    },


    getPageScrollY: (): number => {
      const result = browser.execute(function() {
        return document.getElementById('esPageColumn').scrollTop;
      });
      console.log(`Page scroll: ${result.value}`);
      return parseInt(result.value);
    },


    scrollIntoViewInPageColumn: (selector: string) => {
      api.waitForVisible(selector);
      let lastScrollY = api.getPageScrollY();
      for (let i = 0; i < 60; ++i) {   // try for a bit more than 10 seconds
        browser.execute(function(selector) {
          window['debiki2'].utils.scrollIntoViewInPageColumn(
            selector, { marginTop: 100, marginBottom: 100, duration: 100 });
        }, selector);
        browser.pause(220);
        const curScrollY = api.getPageScrollY();
        if (lastScrollY === curScrollY) {
          // Done scrolling;
          return;
        }
        lastScrollY = curScrollY;
      }
      assert.fail(`Cannot scroll to: ${selector}`);
    },


    scrollToTop: function() {
      // I think some browsers wants to scroll <body> others want to scroll <html>, so do both.
      // And if we're viewing a topic, need to scroll the page column insetad.  (4ABKW20)
      browser.scroll('body', 0, 0);
      browser.scroll('html', 0, 0);
      if (browser.isVisible('#esPageColumn')) {
        // Doesn't work: browser.scroll('#esPageColumn', 0, 0);
        // Instead:
        browser.execute(function() {
          document.getElementById('esPageColumn').scrollTop = 0;
        });
      }
      // Apparently takes a short while for the scroll to happen. I couldn't find any getScroll
      // function to poll and test when the scrolling is done, so just do this:
      // (200 ms is too short; then sometimes the stuff at the top won't be visible, when this
      // function returns.)
      browser.pause(500);
    },


    scrollToBottom: function() {
      browser.scroll('body', 0, 999*1000);
      browser.scroll('html', 0, 999*1000);
      if (browser.isVisible('#esPageColumn')) {
        browser.execute(function() {
          document.getElementById('esPageColumn').scrollTop = 999*1000;
        });
      }
      browser.pause(500);
    },


    // Workaround for bug(s) in Chrome? Chromedriver? Selenium? Webdriver?
    // 1) browser.refresh() causes a weird cannot-find-elem problem. Perhaps because of  [E2EBUG]
    //    some incompatibility between webdriver.io and Chrome? Recently there was a stale-
    //    element bug after refresh(), fixed in Webdriver.io 4.3.0. Instead:
    // 2) Sometimes waitForVisible stops working = blocks forever, although isVisible returns true
    //    (because the elem is visible already).
    toGoogleAndBack: function() {
      let url = browser.url().value;
      api.go('http://www.google.com');
      api.go(url);
    },


    playTimeSeconds: function(seconds: number) {  // [4WKBISQ2]
      browser.execute(function (seconds) {
        console.log("Playing time, seconds: " + seconds);
        window['debiki2'].testExtraMillis = window['debiki2'].testExtraMillis + seconds * 1000;
        console.log("Time now: " + window['debiki2'].testExtraMillis);
      }, seconds);
    },


    waitForMyDataAdded: function() {
      api.waitForVisible('.e2eMyDataAdded');
    },


    // Can be used to wait until a fade-&-scroll-in dialog is done scrolling in, for example.
    //
    waitUntilDoesNotMove: function(buttonSelector: string, pollInterval?: number) {
      for (let attemptNr = 1; attemptNr <= 30; ++attemptNr) {
        let location = browser.getLocationInView(buttonSelector);
        browser.pause(pollInterval || 50);
        let locationLater = browser.getLocationInView(buttonSelector);
        if (location.y === locationLater.y && location.x === locationLater.x)
          return;
      }
      die(`Never stops moving: '${buttonSelector}' [EdE7KFYU0]`);
    },


    count: (selector: string): number => {
      const elems = browser.elements(selector).value;
      return elems.length;
    },


    // Make `api.waitForVisible()` work in this file — I'd forget to do: `browser.waitForVisible()`.
    waitForVisible: function(selector: string, timeoutMillis?: number) {
      origWaitForVisible.apply(browser, arguments);
    },

    waitForNotVisible: function(selector: string, timeoutMillis?: number) {
      // API is: browser.waitForVisible(selector[,ms][,reverse])
      console.log(`browser.waitForVisible('${selector}', timeoutMillis || true, timeoutMillis ? true : undefined);`);
      console.log(`BUG just waits forever [2ABKRP83]`);
      assert(false);
      browser.waitForVisible(selector, timeoutMillis || true, timeoutMillis ? true : undefined);
    },

    waitForEnabled: function(selector: string, timeoutMillis?: number) {
      origWaitForEnabled.apply(browser, arguments);
    },

    waitForText: function(selector: string, timeoutMillis?: number) {
      origWaitForText.apply(browser, arguments);
    },

    waitUntilValueIs: function(selector: string, value: string) {
      browser.waitForVisible(selector);
      while (true) {
        const currentValue = browser.getValue(selector);
        if (currentValue === value)
          break;
        browser.pause(125);
      }
    },

    waitForExist: function(selector: string, timeoutMillis?: number) {
      origWaitForExist.apply(browser, arguments);
    },

    waitForGone: function(selector: string, timeoutMillis?: number) {
      // True reverses, i.e. wait until not visible
      origWaitForExist.call(browser, selector, timeoutMillis, true);
    },

    waitAndClick: function(selector: string, opts: { maybeMoves?: boolean, clickFirst?: boolean } = {}) {
      api._waitAndClickImpl(selector, opts);
    },


    waitAndClickFirst: function(selector: string) {
      api._waitAndClickImpl(selector, { clickFirst: true });
    },


    waitAndClickLast: function(selector: string) {
      api.waitAndClickNth(selector, -1);
    },


    // Works with many browsers at the same time.
    _waitAndClickImpl: function(selector: string, opts: { clickFirst?: boolean, maybeMoves?: boolean } = {}) {
      selector = selector.trim(); // so selector[0] below, works
      api._waitForClickable(selector, opts);
      if (selector[0] !== '#' && !opts.clickFirst) {
        let errors = '';
        let length = 1;
        const byBrowserResults = byBrowser(browser.elements(selector));
        _.forOwn(byBrowserResults, (result, browserName) => {
          const elems = result.value;
          if (elems.length !== 1) {
            length = elems.length;
            errors += browserNamePrefix(browserName) + "Bad num elems to click: " +
              JSON.stringify(elems) +
              ", should be 1. Elems matches selector: " + selector + " [EsE5JKP82]\n";
          }
        });
        assert.equal(length, 1, errors);
      }
      // Oddly enough, sometimes the overlay covers the page here, although
      // we just waited for it to go away.  [7UKDWP2] [7JUKDQ4].
      // Happens in FF only (May 2018) — maybe FF is so fast so the first test
      // somehow happens before it has been created?
      api.waitUntilLoadingOverlayGone();
      browser.click(selector);
    },


    // For one browser at a time only.
    // n starts on 1 not 0. -1 clicks the last, -2 the last but one etc.
    waitAndClickNth: function(selector, n) {
      assert(n !== 0, "n starts on 1, change from 0 to 1 please");
      api._waitForClickable(selector);
      const items = browser.elements(selector).value;
      assert(items.length >= n, `Elem ${n} missing: Only ${items.length} elems match: ${selector}`);
      let response;
      if (n > 0) {
        response = browser.elementIdClick(items[n - 1].ELEMENT);
      }
      else {
        response = browser.elementIdClick(items[items.length + n].ELEMENT);
      }
      assert(isResponseOk(response), "Bad response._status: " + response._status +
        ", state: " + response.state);
    },


    _waitForClickable: function(selector, opts: { maybeMoves?: boolean } = {}) {
      // Without pause(..), the tests often break when run in an *invisible* browser, but works
      // just fine when run in a *visible* browser. Meaning, it's very hard to fix any race
      // conditions, because only fails when I cannot see. So for now, pause(100).
      browser.pause(100);
      api.waitForVisible(selector);
      api.waitForEnabled(selector);
      api.waitUntilLoadingOverlayGone();
      if (opts.maybeMoves) {
        api.waitUntilDoesNotMove(selector);
      }
    },


    waitAndClickLinkToNewPage: function(selector: string, refreshBetweenTests?: boolean) {
      // Keep the debug stuff, for now — once, the click failed, although visible already, weird.
      let delay = 30;
      //let count = 0;
      //console.log(`waitAndClickLinkToNewPage ${selector} ...`);
      api.waitUntilLoadingOverlayGone();
      while (true) {
        api.waitForMyDataAdded();
        browser.pause(delay);
        //console.log(`waitAndClickLinkToNewPage ${selector} testing:`);
        if (browser.isVisible(selector) && browser.isEnabled(selector)) {
          //console.log(`waitAndClickLinkToNewPage ${selector} —> FOUND and ENABLED`);
          // count += 1;
          // if (count >= 6)
          break;
        }
        else {
          //console.log(`waitAndClickLinkToNewPage ${selector} —> NOT found...`);
          if (refreshBetweenTests) browser.refresh();
          delay *= 1.67;
        }
      }
      api.rememberCurrentUrl();
      api.waitAndClick(selector);
      api.waitForNewUrl();
    },


    waitUntilGone: function(what) {
      browser.waitUntil(function () {
        const resultsByBrowser = browser.isVisible(what);
        const values = allBrowserValues(resultsByBrowser);
        return _.every(values, x => !x );
      });
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

    waitUntilLoadingOverlayGone: function() {
      api.waitUntilGone('#theLoadingOverlay');
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
    },

    waitForAtLeast: function(num, selector) {
      browser.waitUntil(function () {
        const elemsList = allBrowserValues(browser.elements(selector));
        return _.every(elemsList, (elems) => {
          return count(elems) >= num;
        });
      });
    },

    waitForAtMost: function(num, selector) {
      browser.waitUntil(function () {
        const elems = browser.elements(selector);
        return count(elems) <= num;
      });
    },

    assertExactly: function(num, selector) {
      let errorString = '';
      let resultsByBrowser = byBrowser(browser.elements(selector));
      _.forOwn(resultsByBrowser, (result, browserName) => {
        if (result.value.length !== num) {
          errorString +=browserNamePrefix(browserName) + "Selector '" + selector + "' matches " +
              result.value.length + " elems, but there should be exactly " + num + "\n";
        }
      });
      assert.ok(!errorString, errorString);
    },


    waitAndSetValue: (selector: string, value: string | number,
        opts: { maybeMoves?: true, checkAndRetry?: true } = {}) => {
      browser.pause(30); // for FF else fails randomly [E2EBUG] but Chrome = fine
                          // (maybe add waitUntilDoesNotMove ?)
      api.waitForVisible(selector);
      api.waitForEnabled(selector);
      api.waitUntilLoadingOverlayGone();
      if (opts.maybeMoves) {
        api.waitUntilDoesNotMove(selector);
      }
      if (value) {
        // Sometimes, when starting typing, React does a refresh / unmount?
        // — maybe the mysterious unmount e2e test problem [5QKBRQ] ? [E2EBUG]
        // so the remaining characters gets lost. Then, try again.
        while (true) {
          browser.setValue(selector, value);
          if (!opts.checkAndRetry) break;
          browser.pause(200);
          const valueReadBack = browser.getValue(selector);
          if (('' + value) === valueReadBack) {
            break;
          }
          console.log(`Couldn't set value, got back when reading: '${valueReadBack}', trying again`);
          browser.pause(300);
        }
      }
      else {
        // This is weird, both setValue('') and clearElement() somehow bypasses all React.js
        // events so React's state won't get updated and it's as if the edits were never made.
        // Anyway, so far, can just do  setValue(' ') instead and since currently the relevant
        // code (namely saving drafts, Aug -18) calls trim(), setting to ' ' is the same
        // as clearValue or setValue('').
        // oops this was actually in use, cannot die() here :-P
        //die('TyE7KWBA20', "setValue('') and clearElement() don't work, use setValue(' ') instead?");
        browser.clearElement(selector);
      }
    },


    waitAndSetValueForId: function(id, value) {
      api.waitAndSetValue('#' + id, value);
    },


    waitForThenClickText: function(selector, regex) {
      const elemId = api.waitAndGetElemIdWithText(selector, regex);
      browser.elementIdClick(elemId);
    },


    waitUntilTextMatches: function(selector, regex) {
      api.waitAndGetElemIdWithText(selector, regex);
    },


    waitAndAssertVisibleTextMatches: function(selector, regex) {
      if (_.isString(regex)) regex = new RegExp(regex);
      const text = api.waitAndGetVisibleText(selector);
      assert(regex.test(text), "'Elem selected by " + selector + "' didn't match " + regex.toString() +
          ", actual text: '" + text + "'");
    },


    waitAndGetElemIdWithText: function(selector, regex) {
      if (_.isString(regex)) {
        regex = new RegExp(regex);
      }
      let elemIdFound;
      browser.waitUntil(() => {
        const elemsWrap = browser.elements(selector);
        if (!elemsWrap.value) {
          die("No value. Many browsers specified? Like 'everyone.sth(..)'? Not implemented. [TyE5KJ7W1]");
        }
        const elems = elemsWrap.value;
        for (let i = 0; i < elems.length; ++i) {
          const elem = elems[i];
          const text = browser.elementIdText(elem.ELEMENT).value;
          const matches = regex.test(text);
          if (matches) {
            elemIdFound = elem.ELEMENT;
            return true;
          }
        }
        return false;
      });
      return elemIdFound;
    },


    waitAndGetVisibleText: function(selector) {
      api.waitForVisible(selector);
      api.waitForText(selector);
      return browser.getText(selector);
    },


    assertTextMatches: function(selector, regex, regex2?) {
      api._assertOneOrAnyTextMatches(false, selector, regex, regex2);
    },


    assertAnyTextMatches: function(selector, regex, regex2?, fast?) {
      api._assertOneOrAnyTextMatches(true, selector, regex, regex2, fast);
    },


    // n starts on 1 not 0.
    // Also see:  assertNthClassIncludes
    assertNthTextMatches: function(selector, n, regex, regex2?) {
      if (_.isString(regex)) {
        regex = new RegExp(regex);
      }
      if (_.isString(regex2)) {
        regex2 = new RegExp(regex2);
      }
      assert(n >= 1, "n starts on 1, change from 0 to 1 please");
      const items = browser.elements(selector).value;
      assert(items.length >= n, `Elem ${n} missing: Only ${items.length} elems match: ${selector}`);
      const response = browser.elementIdText(items[n - 1].ELEMENT);
      assert(isResponseOk(response), "Bad response._status: " + response._status +
          ", state: " + response.state);
      const text = response.value;
      assert(regex.test(text), "Elem " + n + " selected by '" + selector + "' doesn't match " +
          regex.toString() + ", actual text: '" + text + "'");
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
      const items = browser.elements(selector).value;
      assert(items.length >= n, `Elem ${n} missing: Only ${items.length} elems match: ${selector}`);
      const response = browser.elementIdAttribute(items[n - 1].ELEMENT, 'class');
      assert(isResponseOk(response), "Bad response._status: " + response._status +
          ", state: " + response.state);
      const regex = new RegExp(`\\b${classToFind}\\b`);
      const actuallClassAttr = response.value;
      assert(regex.test(actuallClassAttr), "Elem " + n + " selected by '" + selector +
          "' doesn't have this class: '" + classToFind + "', instead it has: " +
          actuallClassAttr + "'");
    },


    assertNoTextMatches: function(selector, regex) {
      api._assertAnyOrNoneMatches(selector, false, regex);
    },


    _assertOneOrAnyTextMatches: function(many, selector, regex, regex2?, fast?) {
      //process.stdout.write('■');
      if (fast === 'FAST') {
        // This works with only one browser at a time, so only use if FAST, or tests will break.
        api._assertAnyOrNoneMatches(selector, true, regex, regex2);
        //process.stdout.write('F ');
        return;
      }
      // With Chrome 60, this is suddenly *super slow* and the authz-view-as-stranger   [CHROME_60_BUG] because of (24DKR0)?
      // test takes 4 minutes and times out. Instead, use assertAnyOrNoneMatches (just above).
      if (_.isString(regex)) {
        regex = new RegExp(regex);
      }
      if (_.isString(regex2)) {
        regex2 = new RegExp(regex2);
      }
      // Log a friendly error, if the selector is absent — that'd be a test suite bug.
      // Without this assert...isVisible, Webdriver just prints "Error" and one won't know
      // what the problem is.
      assert(browser.isVisible(selector), `No text matches: ${selector} [EdE1WBPGY93]`);  // this could be the very-slow-thing (24DKR0) COULD_OPTIMIZE
      const textByBrowserName = byBrowser(browser.getText(selector));  // SLOW !!
      _.forOwn(textByBrowserName, function(text, browserName) {
        const whichBrowser = isTheOnly(browserName) ? '' : ", browser: " + browserName;
        if (!many) {
          assert(!_.isArray(text), "Broken e2e test. Select only 1 elem please [EsE4KF0W2]");
        }
        assert(regex.test(text), "Elem selected by '" + selector + "' didn't match " +
            regex.toString() + ", actual text: '" + text + whichBrowser);
        // COULD use 'arguments' & a loop instead
        if (regex2) {
          assert(regex2.test(text), "Elem selected by '" + selector + "' didn't match " +
              regex2.toString() + ", actual text: '" + text + whichBrowser);
        }
      });
      //process.stdout.write('S ');
    },


    _assertAnyOrNoneMatches: function(selector: string, shallMatch: boolean, regex, regex2?) {
      if (_.isString(regex)) {
        regex = new RegExp(regex);
      }
      if (_.isString(regex2)) {
        assert(shallMatch, `two regexps only supported if shallMatch = true`);
        regex2 = new RegExp(regex2);
      }
      const elems = browser.elements(selector).value;
      // If many browsers, we got back {browserName: ...., otherBrowserName: ...} instead.
      assert(elems, `assertAnyOrNoneMatches with many browsers at a time not implemented [EdE4KHA2QU]`);
      assert(!shallMatch || elems.length, `No elems found matching ` + selector);
      for (let i = 0; i < elems.length; ++i) {
        const elem = elems[i];
        const isVisible = browser.elementIdDisplayed(elem.ELEMENT);
        if (!isVisible)
          continue;
        const text = browser.elementIdText(elem.ELEMENT).value;
        const matchesRegex1 = regex.test(text);
        if (matchesRegex1) {
          assert(shallMatch, `Elem found matching '${selector}' and regex: ${regex.toString()}`);
          if (!regex2)
            return;
        }
        if (regex2) {
          assert(shallMatch, 'EdE2FKT0QRA');
          const matchesRegex2 = regex2.test(text);
          if (matchesRegex2 && matchesRegex1)
            return;
        }
      }
      assert(!shallMatch, `${elems.length} elems matches '${selector}', but none of them is visible and ` +
          `matches regex: ` + regex.toString() + (!regex2 ? '' : ` and regex2: ` + regex2.toString()));
    },


    waitUntilIsOnHomepage: function() {
      let delay = 20;
      while (true) {
        const url = browser.url().value;
        if (/https?:\/\/[^/?#]+(\/latest|\/top|\/)?(#.*)?$/.test(url)) {
          break;
        }
        delay *= 1.67;
        browser.pause(delay);
      }
    },


    assertPageTitleMatches: function(regex) {
      api.waitForVisible('h1.dw-p-ttl');
      api.waitUntilTextMatches('h1.dw-p-ttl', regex);
      //api.assertTextMatches('h1.dw-p-ttl', regex);
    },


    assertPageBodyMatches: function(regex) {
      api.waitForVisible('.esOrigPost');
      //api.waitUntilTextMatches('.esOrigPost', regex);
      api.assertTextMatches('.esOrigPost', regex);
    },


    assertPageHtmlSourceMatches_1: function(toMatch) {
      // _1 = only for 1 browser
      const source = browser.getSource();
      let regex = _.isString(toMatch) ? new RegExp(toMatch) : toMatch;
      assert(regex.test(source), "Page source does match " + regex);
    },


    assertPageHtmlSourceDoesNotMatch: function(toMatch) {
      let resultsByBrowser = byBrowser(browser.getSource());
      let regex = _.isString(toMatch) ? new RegExp(toMatch) : toMatch;
      _.forOwn(resultsByBrowser, (text, browserName) => {
        assert(!regex.test(text), browserNamePrefix(browserName) + "Page source does match " + regex);
      });
    },


    _pageNotFoundOrAccessDenied: /Page not found, or Access Denied/,

    // Also see browser.pageTitle.assertPageHidden().  Dupl code [05PKWQ2A]
    assertWholePageHidden: function() {
      let resultsByBrowser = byBrowser(browser.getSource());
      _.forOwn(resultsByBrowser, (text, browserName) => {
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
      let resultsByBrowser = byBrowser(browser.getSource());
      _.forOwn(resultsByBrowser, (text, browserName) => {
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
        let source = browser.getSource();
        let is404 = /404 Not Found[\s\S]+EsE404[\s\S].*/.test(source);
        if (!is404) {
          browser.pause(250);
          continue;
        }
        return;
      }
      die('EdE5FKW2', "404 Not Found never appears");
    },


    assertUrlIs: function(expectedUrl) {
      let url = browser.url().value;
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
      let numLeft = howMany;
      for (let i = 0; i < 20; ++i) {
        if (i % 10 === 0) console.log(`Waiting for ${howMany} alert(s) to dismiss ... [TyM74AKRWJ]`);
        try {
          if (accept) browser.alertAccept();
          else browser.alertDismiss();
          console.log(accept ? "Accepted." : "Dismissed.");
          numLeft -= 1;
          if (numLeft === 0)
            return true;
        }
        catch (e) {
          // Wait for alert, up to 20*50 = 1 000 ms.
          browser.pause(50);
        }
      }
      console.log("No alert found.");
      return false;
    },

    countLongPollingsDone: () => {
      const result = browser.execute(function() {
        return window['debiki2'].Server.testGetLongPollingNr();
      });
      dieIf(!result, "Error getting long polling count, result: " + JSON.stringify(result));
      const count = parseInt(result.value);
      dieIf(_.isNaN(count), "Long polling count is weird: " + JSON.stringify(result));
      return count;
    },

    createSite: {
      fillInFieldsAndSubmit: function(data) {
        if (data.embeddingUrl) {
          api.waitAndSetValue('#e_EmbeddingUrl', data.embeddingUrl);
        }
        else {
          api.waitAndSetValue('#dwLocalHostname', data.localHostname);
        }
        browser.click('#e2eNext3');
        browser.setValue('#e2eOrgName', data.orgName || data.localHostname);
        browser.click('input[type=submit]');
        api.waitForVisible('#t_OwnerSignupB');
        assert.equal(data.origin, api.origin());
      },

      clickOwnerSignupButton: () => {
        api.waitAndClick('#t_OwnerSignupB');
      }
    },


    createSomething: {
      createForum: function(forumTitle) {
        // Button gone, I'll add it back if there'll be Blog & Wiki too.
        // api.waitAndClick('#e2eCreateForum');
        browser.pause(200); // [e2erace] otherwise it won't find the next input, in the
                            // create-site-all-logins @facebook test
        api.waitAndSetValue('input[type="text"]', forumTitle);
        // Click Next, Next ... to accept all default choices.
        api.waitAndClick('.e_Next');
        browser.pause(200); // Wait for next button
        api.waitAndClick('.e_Next');
        browser.pause(200);
        api.waitAndClick('.e_Next');
        browser.pause(200);
        api.waitAndClick('.e_Next');
        browser.pause(200);
        api.waitAndClick('#e2eDoCreateForum');
        const actualTitle = api.waitAndGetVisibleText('h1.dw-p-ttl');
        assert.equal(actualTitle, forumTitle);
      },
    },


    topbar: {
      waitForVisible: function() {  // old name? use waitForMyMenuVisible instead only?
        api.topbar.waitForMyMenuVisible();
      },

      waitForMyMenuVisible: function() {  // RENAME to waitForMyMenuButtonVisible?
        api.waitForVisible('.esMyMenu');
      },

      clickBack: function() {
        api.rememberCurrentUrl();
        api.waitAndClick('.esTopbar_custom_backToSite');
        api.waitForNewUrl();
      },

      clickHome: function() {
        if (browser.isVisible('.esLegal_home_link')) {
          api.rememberCurrentUrl();
          browser.click('.esLegal_home_link');
          api.waitForNewUrl();
        }
        else {
          // (Already waits for new url.)
          api.topbar.clickAncestor("Home");
        }
      },

      clickAncestor: function(categoryName: string) {
        api.rememberCurrentUrl();
        api.waitForThenClickText('.esTopbar_ancestors_link', categoryName);
        api.waitForNewUrl();
      },

      assertMyUsernameMatches: function(username: string) {
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
        browser.waitForVisible('.esMyMenu .esAvtrName_name');
        return browser.getText('.esMyMenu .esAvtrName_name');
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
        api.waitForVisible(api.userProfilePage.avatarAboutButtonsSelector);
        do {
          newName = api.topbar.getMyUsername();
        }
        while (oldName === newName);
      },

      searchFor: function(phrase: string) {
        api.waitAndClick('.esTB_SearchBtn');
        api.waitAndSetValue('.esTB_SearchD input[name="q"]', phrase);
        browser.click('.e_SearchB');
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

      openNotfToMe: function(options?: { waitForNewUrl?: boolean }) {
        api.topbar.openMyMenu();
        api.rememberCurrentUrl();
        api.waitAndClickFirst('.s_MM .dropdown-menu .esNotf-toMe');
        if (options && options.waitForNewUrl !== false) {
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
        api.waitForVisible('.esWB_CloseB');
        browser.click('.esWB_CloseB');
        api.waitUntilGone('#esWatchbarColumn');
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

      goToTopic: function(title: string) {
        api.rememberCurrentUrl();
        api.waitForThenClickText(api.watchbar.titleSelector, title);
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
        api.waitForVisible('.esCtxbar_close');
        browser.click('.esCtxbar_close');
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
        var elems = browser.elements('.esCtxbar_list .esAvtrName_username').value;
        var usernamesPresent = elems.map((elem) => {
          return browser.elementIdText(elem.ELEMENT).value;
        });
        assert(usernamesPresent.length, "No users listed at all");
        assert(_.includes(usernamesPresent, username), "User missing: " + username +
            ", those present are: " + usernamesPresent.join(', '));
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

      createPasswordAccount: function(data: { fullName, username, email?, emailAddress?, password },
            shallBecomeOwner?: boolean, anyVerifyEmail?) {

        // Switch from the guest login form to the create-real-account form, if needed.
        api.waitForVisible('#e2eFullName');
        if (browser.isVisible('.s_LD_CreateAccount')) {
          api.waitAndClick('.s_LD_CreateAccount');
          api.waitForVisible('#e2ePassword');
        }

        console.log('createPasswordAccount: fillInFullName...');
        if (data.fullName) api.loginDialog.fillInFullName(data.fullName);
        console.log('fillInUsername...');
        api.loginDialog.fillInUsername(data.username);
        console.log('fillInEmail...');
        const theEmail = data.email || data.emailAddress;
        if (theEmail) api.loginDialog.fillInEmail(theEmail);
        console.log('fillInPassword...');
        api.loginDialog.fillInPassword(data.password);
        console.log('clickSubmit...');
        api.loginDialog.clickSubmit();
        console.log('acceptTerms...');
        api.loginDialog.acceptTerms(shallBecomeOwner);
        console.log('waitForNeedVerifyEmailDialog...');
        if (anyVerifyEmail !== 'THERE_WILL_BE_NO_VERIFY_EMAIL_DIALOG') {
          api.loginDialog.waitForNeedVerifyEmailDialog();
        }
        console.log('createPasswordAccount: done');
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

      loginWithPassword: function(username, password?, opts?: { resultInError?: boolean }) {
        if (!opts && password && _.isObject(password)) {
          opts = <any> password;
          password = null;
        }
        if (_.isObject(username)) {
          dieIf(_.isString(password), 'TyE2AKBF053');
          password = username.password;
          username = username.username;
        }
        api.loginDialog.tryLogin(username, password);
        if (opts && opts.resultInError)
          return;
        api.waitUntilModalGone();
        api.waitUntilLoadingOverlayGone();
      },

      loginWithEmailAndPassword: function(emailAddress: string, password: string, badLogin) {
        api.loginDialog.tryLogin(emailAddress, password);
        if (badLogin !== 'BAD_LOGIN') {
          api.waitUntilModalGone();
          api.waitUntilLoadingOverlayGone();
        }
      },

      // Embedded discussions do all logins in popups.
      loginWithPasswordInPopup: function(username, password?: string) {
        api.swithToOtherTabOrWindow();
        api.disableRateLimits();
        if (_.isObject(username)) {
          password = username.password;
          username = username.username;
        }
        api.loginDialog.tryLogin(username, password);
        // The popup auto closes after login.
        browser.waitUntil(function () {
          return browser.getTabIds().length === 1;
        });
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
        console.log('createPasswordAccount with no email: fillInFullName...');
        api.loginDialog.fillInFullName(name);
        console.log('fillInUsername...');
        const username = name.replace(/[ '-]+/g, '_').substr(0, 20);  // dupl code (7GKRW10)
        api.loginDialog.fillInUsername(username);
        if (email) {
          console.log('fillInEmail...');
          api.loginDialog.fillInEmail(email);
        }
        else {
          console.log('fillInEmail anyway, because for now, always require email [0KPS2J]');
          api.loginDialog.fillInEmail(`whatever-${Date.now()}@example.com`);
        }
        console.log('fillInPassword...');
        api.loginDialog.fillInPassword("public1234");
        console.log('clickSubmit...');
        api.loginDialog.clickSubmit();
        console.log('acceptTerms...');
        api.loginDialog.acceptTerms();
        console.log('waitForWelcomeLoggedInDialog...');
        api.loginDialog.waitForAndCloseWelcomeLoggedInDialog();
        console.log('createPasswordAccount with no email: done');
        // Took forever: waitAndGetVisibleText, [CHROME_60_BUG]?
        api.waitForVisible('.esTopbar .esAvtrName_name');
        const nameInHtml = browser.getText('.esTopbar .esAvtrName_name');
        assert(nameInHtml === username);
      },

      logInAsGuest: function(name: string, email_noLongerNeeded?: string) { // CLEAN_UP [8JTW4] is just pwd login?
        const username = name.replace(/[ '-]+/g, '_').substr(0, 20);  // dupl code (7GKRW10)
        console.log('logInAsGuest: fillInFullName...');
        api.loginDialog.fillInUsername(name);
        console.log('fillInPassword...');
        api.loginDialog.fillInPassword("public1234");
        console.log('clickSubmit...');
        api.loginDialog.clickSubmit();
        console.log('logInAsGuest with no email: done');
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
            api.waitForVisible('.dw-reset-pswd');
          }
          else if (browser.isVisible('.dw-reset-pswd')) {
            break;
          }
          browser.pause(100);
        }
      },


      createGmailAccount: function(data: { email: string, password: string, username: string },
            shallBecomeOwner?: boolean, anyWelcomeDialog?: string) {
        api.loginDialog.loginWithGmail(data);
        // This should be the first time we login with Gmail at this site, so we'll be asked
        // to choose a username.
        // Not just #e2eUsername, then might try to fill in the username in the create-password-
        // user fields which are still visible for a short moment. Dupl code (2QPKW02)
        api.waitAndSetValue('.esCreateUserDlg #e2eUsername', data.username);
        api.loginDialog.clickSubmit();
        api.loginDialog.acceptTerms(shallBecomeOwner);
        if (anyWelcomeDialog !== 'THERE_WILL_BE_NO_WELCOME_DIALOG') {
          api.loginDialog.waitAndClickOkInWelcomeDialog();
        }
        api.waitUntilModalGone();
        api.waitUntilLoadingOverlayGone();
      },

      loginWithGmail: function(data: { email: string, password: string }, isInPopupAlready?: boolean) {
        // Pause or sometimes the click misses the button. Is the browser doing some re-layout?
        browser.pause(150);
        api.waitAndClick('#e2eLoginGoogle');

        // Switch to a login popup window that got opened, for Google:
        if (!isInPopupAlready)
          api.swithToOtherTabOrWindow();

        const emailInputSelector = 'input[type="email"]';
        const emailNext = '#identifierNext';
        const passwordInputSelector = 'input[type="password"]';
        const passwordNext = '#passwordNext';

        // We'll get logged in immediately, if we're already logged in to one
        // (and only one) Gmail account in the current browser. Wait for a short while
        // to find out what'll happen.
        while (true) {
          if (api.loginDialog.loginPopupClosedBecauseAlreadyLoggedIn()) {
            api.switchBackToFirstTabOrWindow();
            return;
          }
          try {
            if (browser.isExisting(emailInputSelector))
              break;
          }
          catch (dummy) {
            console.log(`didn't find ${emailInputSelector}, ` +
                "tab closed? already logged in? [EdM5PKWT0B]");
          }
          browser.pause(500);
        }

        // Google does something weird here, need to wait. Why? Waiting until visible and
        // enabled = not enough.
        while (true) {
          try {
            browser.pause(250);
            console.log(`typing Gmail email: ${data.email}...`);
            api.waitAndSetValue(emailInputSelector, data.email);
            break;
          }
          catch (dummy) {
            // See the weird issue below: (7FUKBAQ2)
            console.log("... Error. Trying again.");
          }
        }

        browser.pause(500);
        if (browser.isExisting(emailNext)) {
          console.log(`clicking ${emailNext}...`);
          api.waitAndClick(emailNext);
        }

        // Google does something weird here too, hmm.
        api.waitForVisible(passwordInputSelector);
        while (true) {
          try {
            browser.pause(250);
            console.log("typing Gmail password...");
            api.waitAndSetValue(passwordInputSelector, data.password);
            break;
          }
          catch (dummy) {
            // As of July 29 2017, there's often this error:  (7FUKBAQ2)
            // """org.openqa.selenium.InvalidElementStateException: invalid element state:
            //  Element is not currently interactable and may not be manipulated"""
            // No idea why, because we do wait until visible & endabled.
            // Whatever. Just keep trying.
            console.log("... Error. Trying again.");
          }
        }

        browser.pause(500);
        if (browser.isExisting(passwordNext)) {
          console.log(`clicking ${passwordNext}...`);
          api.waitAndClick(passwordNext);
        }

        /*
        browser.click('#signIn');
        api.waitForEnabled('#submit_approve_access');
        browser.click('#submit_approve_access'); */

        if (!isInPopupAlready) {
          console.log("switching back to first tab...");
          api.switchBackToFirstTabOrWindow();
        }
      },


      createGitHubAccount: (ps: { username: string, password: string, shallBecomeOwner: boolean,
            anyWelcomeDialog?, alreadyLoggedInAtGitHub: boolean }) => {

        // This should fill in email (usually) and usernamea (definitely).
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
        console.log("Switching to GitHub login window...");
        api.swithToOtherTabOrWindow();

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
              console.log("Authorizing Talkyard to handle this GitHub login ... [TyT4ABKR02F]");
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
        console.log("Switching back to first window...");
        api.switchBackToFirstTabOrWindow();
      },


      createFacebookAccount: function(data: { email: string, password: string, username: string },
            shallBecomeOwner?: boolean, anyWelcomeDialog?) {
        api.loginDialog.loginWithFacebook(data);
        // This should be the first time we login with Facebook at this site, so we'll be asked
        // to choose a username.
        // Not just #e2eUsername, then might try to fill in the username in the create-password-
        // user fields which are still visible for a short moment. Dupl code (2QPKW02)
        console.log("typing Facebook user's new username...");
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
          api.swithToOtherTabOrWindow();

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
            console.log("didn't find #email, tab closed? already logged in? [EdM5PKWT0]");
          }
          browser.pause(300);
        }

        console.log("typing Facebook user's email and password...");
        browser.pause(340); // so less risk Facebook think this is a computer?
        api.waitAndSetValue('#email', data.email);
        browser.pause(380);
        api.waitAndSetValue('#pass', data.password);
        browser.pause(280);

        // Facebook recently changed from <input> to <button>. So just find anything with type=submit.
        console.log("submitting Facebook login dialog...");
        api.waitAndClick('#loginbutton'); // or: [type=submit]');

        // Facebook somehow auto accepts the confirmation dialog, perhaps because
        // I'm using a Facebook API test user. So need not do this:
        //b.waitForVisible('[name=__CONFIRM__]');
        //b.click('[name=__CONFIRM__]');

        if (!isInPopupAlready) {
          console.log("switching back to first tab...");
          api.switchBackToFirstTabOrWindow();
        }
      },


      loginPopupClosedBecauseAlreadyLoggedIn: () => {
        try {
          console.log("checking if we got logged in instantly... [EdM2PG44Y0]");
          const yes = browser.getTabIds().length === 1;// ||  // login tab was auto closed
              //browser.isExisting('.e_AlreadyLoggedIn');    // server shows logged-in-already page
              //  ^--- sometimes blocks forever, how is that possible?
          console.log(yes ? "yes seems so" : "no don't think so");
          return yes;
        }
        catch (dummy) {
          // This is usually/always (?) a """org.openqa.selenium.NoSuchWindowException:
          // no such window: target window already closed""" exception, which means we're
          // logged in already and the OAuth provider (Google/Facebook/etc) closed the login tab.
          console.log("apparently we got logged in directly [EdM2GJGQ03]");
          return true;
        }
      },

      waitAndClickOkInWelcomeDialog: function() {
        api.waitAndClick('#te_WelcomeLoggedIn .btn');
      },

      clickResetPasswordCloseDialogSwitchTab: function() {
        browser.click('.dw-reset-pswd');
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
          assert(termsLinkHtml.indexOf('/-/terms-for-site-owners') >= 0);
          assert(privacyLinkHtml.indexOf('/-/privacy-for-site-owners') >= 0);
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
        api.resetPasswordPage.fillInAccountOwnerEmailAddress(emailAddress);
        api.rememberCurrentUrl();
        api.resetPasswordPage.clickSubmit();
        api.waitForNewUrl();
        api.waitForVisible('#e2eRPP_ResetEmailSent');
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
    },


    pageTitle: {
      clickEdit: function() {
        api.waitAndClick('#e2eEditTitle');
      },

      editTitle: function(title: string) {
        api.waitAndSetValue('#e2eTitleInput', title);
      },

      save: function() {
        browser.click('.e2eSaveBtn');
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

      assertMatches: function(regex) {
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

      canBumpPageStatus: function() {
        return browser.isVisible('.dw-p-ttl .dw-clickable');
      },

      changeStatusToPlanned: function() {
        const selector = '.icon-idea.dw-clickable';
        api.waitForVisible(selector);
        api.topic.clickPostActionButton(selector);
        api.waitForVisible('.icon-check-dashed.dw-clickable');
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
        api.waitAndClick('#e2eViewCategoriesB');
      },

      clickViewTopics: function() {
        api.waitAndClick('#e2eViewTopicsB');
      },

      clickViewNew: function() {
        api.waitAndClick('#e_SortNewB');
      },

      clickCreateCategory: function() {
        api.waitAndClick('#e2eCreateCategoryB');
      },

      clickEditCategory: function() {
        api.waitAndClick('.esF_BB_EditCat');
      },

      clickCreateTopic: function() {
        api.waitAndClick('#e2eCreateSth');
      },

      assertNoCreateTopicButton: function() {
        // Wait until the button bar has loaded.
        api.waitForVisible('#e2eViewCategoriesB');
        assert(!browser.isVisible('#e2eCreateSth'));
      },

      listDeletedTopics: function() {
        api.waitAndClick('.esForum_filterBtn');
        api.waitAndClick('.s_F_BB_TF_Dd');
        api.forumTopicList.waitForTopics();
      },
    },


    forumTopicList: {
      titleSelector: '.e2eTopicTitle a',  // <– remove, later: '.esF_TsL_T_Title',  CLEAN_UP
      hiddenTopicTitleSelector: '.e2eTopicTitle a.icon-eye-off',

      waitUntilKnowsIsEmpty: function() {
        api.waitForVisible('#e2eF_NoTopics');
      },

      waitForTopics: function() {
        // This is in some cases really slow, often makes tests/e2e/specs/navigation-as-admin.test.ts
        // time out — unless runs selenium-standalone *with*  `-- -debug` logging. Weird. [E2EBUG]
        // Anyway, log something, so can see if fails because this ... for no reason ... takes long.
        process.stdout.write('\n<waitForTopics...');
        // api.waitForVisible('.e2eF_T'); — also takes "forever", in navigation-as-admin.test.ts
        // (only?), just like this:
        while (true) {
          try {
            api.waitForVisible('.e2eF_T', 1000);
            break;
          }
          catch (ignore) {
            process.stdout.write('■');
          }
        }
        process.stdout.write('/waitForTopics>');
      },

      clickLoadMore: () => {
        api.waitAndClick('.load-more');
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

      goToTopic: function(title: string) {
        api.rememberCurrentUrl();
        api.waitForThenClickText(api.forumTopicList.titleSelector, title);
        api.waitForNewUrl();
        api.assertPageTitleMatches(title);
      },

      assertNumVisible: function(howMany: number) {
        api.assertExactly(howMany, '.e2eTopicTitle');
      },

      assertTopicTitlesAreAndOrder: function(titles: string[]) {
        console.log('Not tested: assertTopicTitlesAreAndOrder');
        const els = <any> browser.$$(api.forumTopicList.titleSelector);
        for (let i = 0; i < titles.length; ++i) {
          const titleShouldBe = titles[i];
          const actualTitleElem = els[i];
          if (actualTitleElem) {
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


    forumCategoryList: {
      categoryNameSelector: '.esForum_cats_cat .forum-title',

      waitForCategories: function() {
        api.waitForVisible('.s_F_Cs');
      },

      numCategoriesVisible: function(): number {
        return count(browser.elements(api.forumCategoryList.categoryNameSelector));
      },

      isCategoryVisible: function(categoryName: string): boolean {
        return browser.isVisible(api.forumCategoryList.categoryNameSelector, categoryName);
      },

      openCategory: function(categoryName: string) {
        api.rememberCurrentUrl();
        api.waitForThenClickText(api.forumCategoryList.categoryNameSelector, categoryName);
        api.waitForNewUrl();
        api.waitForVisible('.esForum_catsDrop');
        api.assertTextMatches('.esForum_catsDrop', categoryName);
      },

      assertCategoryNotFoundOrMayNotAccess: function() {
        api.assertAnyTextMatches('.dw-forum', 'EdE0CAT');
      }
    },


    categoryDialog: {
      fillInFields: function(data) {
        api.waitAndSetValue('#e2eCatNameI', data.name);
        if (data.setAsDefault) {
          api.waitAndClick('#e2eSetDefCat');
        }
      },

      submit: function() {
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
        browser.waitForGone('.s_UD');
        api.waitUntilModalGone();
      },

      clickSendMessage: () => {
        api.aboutUserDialog.waitForLoaded();
        api.rememberCurrentUrl();
        api.waitAndClick('#e2eUD_MessageB');
        api.waitForNewUrl();
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
        api.waitAndSetValue('#e2eAddUsD .Select-input > input', username + '\n');

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

      submit: function() {
        browser.click('#e2eAddUsD_SubmitB');
        // Later: browser.waitUntilModalGone();
        // But for now:  [5FKE0WY2]
        api.waitForVisible('.esStupidDlg');
        browser.refresh();
      }
    },


    editor: {
      editTitle: function(title) {
        api.waitAndSetValue('.esEdtr_titleEtc_title', title);
      },

      isTitleVisible: function() {
        browser.waitForVisible('.editor-area');
        return browser.isVisible('.editor-area .esEdtr_titleEtc_title');
      },

      getTitle: function() {
        return browser.getText('.editor-area .esEdtr_titleEtc_title');
      },

      editText: function(text) {
        api.waitAndSetValue('.esEdtr_textarea', text);
      },

      getText: function() {
        return browser.getText('.editor-area textarea');
      },

      setTopicType: function(type: PageRole) {
        let optionId = null;
        let needsClickMore = false;
        switch (type) {
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

      cancelNoHelp: function() {
        browser.click('#debiki-editor-controller .e_EdCancelB');
        // doesn't work :-(  api.waitForNotVisible('#debiki-editor-controller');
        // just waits forever
      },

      cancel: function() {
        api.editor.cancelNoHelp();
        api.helpDialog.waitForThenClose();
      },

      switchToSimpleEditor: function() {
        api.waitAndClick('.e_EdCancelB'); // could use different class, weird name
        api.waitForVisible('.esC_Edtr');
      },

      save: function() {
        api.editor.clickSave();
        api.waitUntilLoadingOverlayGone();
      },

      clickSave: function() {
        browser.click('#debiki-editor-controller .e2eSaveBtn');
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


    metabar: {
      clickLogout: () => {
        api.waitAndClick('.esMetabar .dw-a-logout');
        api.waitUntilGone('.esMetabar .dw-a-logout');
        api.waitForVisible('.esMetabar');
      },

      openMetabar: () => {
        api.waitAndClick('.dw-page-notf-level');
        api.waitForVisible('.esMB_Dtls_Ntfs_Lbl');
      },

      chooseNotfLevelWatchAll: () => {
        api.waitAndClick('.dw-notf-level');
        api.waitAndClick('.e_NtfAll');
        api.waitForGone('.e_NtfAll');
      }
    },


    topic: {
      postBodySelector: (postNr: PostNr) => `#post-${postNr} .dw-p-bd`,

      clickHomeNavLink: function() {
        browser.click("a=Home");
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

      isPostNrVisible: function(postNr) {
        return browser.isVisible('#post-' + postNr);
      },

      waitForPostNrVisible: function(postNr) {
        api.waitForVisible('#post-' + postNr);
      },

      postNrContains: function(postNr: PostNr, selector: string) {
        return browser.isExisting(api.topic.postBodySelector(postNr) + ' ' + selector);
      },

      postNrContainsVisible: function(postNr: PostNr, selector: string) {
        return browser.isVisible(api.topic.postBodySelector(postNr) + ' ' + selector);
      },

      assertPostTextMatches: function(postNr: PostNr, text: string) {
        api.assertTextMatches(api.topic.postBodySelector(postNr), text)
      },

      waitUntilPostTextMatches: function(postNr: PostNr, text: string) {
        api.waitUntilTextMatches(api.topic.postBodySelector(postNr), text);
      },

      refreshUntilPostTextMatches: function(postNr: PostNr, regex) {
        if (_.isString(regex)) regex = new RegExp(regex);
        while (true) {
          const text = api.waitAndGetVisibleText(api.topic.postBodySelector(postNr));
          if (text.match(regex)) {
            break;
          }
          browser.pause(200);
          browser.refresh();
        }
      },

      waitUntilTitleMatches: function(text: string) {
        api.topic.waitUntilPostTextMatches(c.TitleNr, text);
      },

      assertMetaPostTextMatches: function(postNr: PostNr, text: string) {
        api.assertTextMatches(`#post-${postNr} .s_MP_Text`, text)
      },

      topLevelReplySelector: '.dw-depth-1 > .dw-p',
      replySelector: '.dw-depth-1 .dw-p',
      allRepliesTextSelector: '.dw-depth-0 > .dw-single-and-multireplies > .dw-res',
      anyCommentSelector: '.dw-p',
      anyReplyButtonSelector: '.dw-a-reply',
      addBottomCommentSelector: '.s_APAs_ACBB',

      waitForReplyButtonAssertCommentsVisible: function() {
        api.waitForVisible(api.topic.anyReplyButtonSelector);
        assert(browser.isVisible(api.topic.anyCommentSelector));
      },

      waitForReplyButtonAssertNoComments: function() {
        api.waitForVisible(api.topic.anyReplyButtonSelector);
        assert(!browser.isVisible(api.topic.anyCommentSelector));
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
        return browser.getText('.dw-ar-p-hd .esP_By_U');
      },

      clickReplyToOrigPost: function(whichButton) {
        const selector = whichButton === 'BottomButton' ?
            '.s_APAs_OPRB' : '.dw-ar-p + .esPA .dw-a-reply';
        api.topic.clickPostActionButton(selector);
      },

      clickReplyToEmbeddingBlogPost: function() {
        api.topic.clickPostActionButton('.dw-ar-t > .esPA .dw-a-reply');
      },

      clickReplyToPostNr: function(postNr: PostNr) {
        api.topic.clickPostActionButton(`#post-${postNr} + .esPA .dw-a-reply`);
      },

      clickAddBottomComment: function() {
        api._waitForClickable(api.topic.addBottomCommentSelector);
        api.topic.clickPostActionButton(api.topic.addBottomCommentSelector);
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

      clickMoreForPostNr: function(postNr: PostNr) {
        api.topic.clickPostActionButton(`#post-${postNr} + .esPA .dw-a-more`);
      },

      clickMoreVotesForPostNr: function(postNr: PostNr) {
        api.topic.clickPostActionButton(`#post-${postNr} + .esPA .dw-a-votes`);
      },

      makeLikeVoteSelector: (postNr: PostNr): string => {
        return `#post-${postNr} + .esPA .dw-a-like`;
      },

      clickLikeVote: function(postNr: PostNr) {
        const likeVoteSelector = api.topic.makeLikeVoteSelector(postNr);
        api.topic.clickPostActionButton(likeVoteSelector);
      },

      toggleLikeVote: function(postNr: PostNr) {
        const likeVoteSelector = api.topic.makeLikeVoteSelector(postNr);
        const isLikedBefore = browser.isVisible(likeVoteSelector + '.dw-my-vote');
        api.topic.clickLikeVote(postNr);
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
        const likeVoteSelector = api.topic.makeLikeVoteSelector(postNr);
        return browser.isVisible(likeVoteSelector + '.dw-my-vote');
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

      closeTopic: function() {
        api.waitAndClick(api.topic._closeButtonSelector);
        api.waitForVisible(api.topic._reopenButtonSelector);
      },

      reopenTopic: function() {
        api.waitAndClick(api.topic._reopenButtonSelector);
        api.waitForVisible(api.topic._closeButtonSelector);
      },

      _closeButtonSelector: '.dw-ar-t > .esPA > .dw-a-close.icon-block',
      _reopenButtonSelector: '.dw-ar-t > .esPA > .dw-a-close.icon-circle-empty',

      refreshUntilBodyHidden: function(postNr: PostNr) {
        while (true) {
          let isHidden = api.topic.isPostBodyHidden(postNr);
          if (isHidden) break;
          browser.refresh();
          browser.pause(250);
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
          browser.refresh(500);
        }
        die('EdEKW05Y', `Post nr ${postNr} never gets approved`);
      },

      assertPostNotPendingApproval: function(postNr: PostNr) {
        assert(api.topic.isPostNotPendingApproval(postNr));
      },

      isPostNotPendingApproval: function(postNr: PostNr) {
        return !api.topic._hasUnapprovedClass(postNr) &&
            !api.topic._hasPendingModClass(postNr) &&
            api.topic._isBodyVisible(postNr);
      },

      clickPostActionButton: function(buttonSelector: string, opts: { clickFirst?: boolean } = {}) {   // RENAME to api.scrollAndClick?
        // If the button is close to the bottom of the window, the fixed bottom bar might
        // be above it; then, if it's below the [Scroll][Back] buttons, it won't be clickable.
        // Or the button might be below the lower window edge.
        // If so, scroll down to the reply button.
        //
        // Why try twice? The scroll buttons aren't shown until a few 100 ms after page load.
        // So, `browser.isVisible(api.scrollButtons.fixedBarSelector)` might evaluate to false,
        // and then we won't scroll down — but then just before `browser.waitAndClick`
        // they appear, so the click fails. That's why we try once more.
        //
        api.waitForVisible(buttonSelector);
        for (let attemptNr = 1; attemptNr <= 2; ++attemptNr) {
          for (let i = 0; i < 20; ++i) {  // because FF sometimes won't realize it's done scrolling
            const buttonLocation = browser.getLocationInView(buttonSelector);

            // If is array, could use [0] — but apparently the button locations are returned
            // in random order, with incorrect positions that never change regardless of how
            // one scrolls, and is sometimes 0 = obviously wrong. So, don't try to
            // pick [0] to click the first = topmost elem.
            // Chrome? Chromedriver? Webdriver? Selenium? buggy (as of June 29 2018).
            dieIf(_.isArray(buttonLocation) && !opts.clickFirst, 'TyEISARRAYBKF');
            if (opts.clickFirst)
              break; // cannot scroll, see above. Currently the tests don't need to scroll (good luck)

            // E.g. the admin area, /-/admin.
            const isOnAutoPage = browser.url().value.indexOf('/-/') >= 0;

            // ? Why did I add this can-scroll test ? Maybe, if can *not* scroll, this loop never got
            // happy with the current scroll position (0, 0?) and continued trying-to-scroll forever?
            let hasScrollBtns = browser.isVisible(api.scrollButtons.fixedBarSelector);
            // If in admin area or user's profile, there're no scroll buttons, but can maybe
            // scroll anyway.
            const canScroll = hasScrollBtns || isOnAutoPage;
            if (!canScroll)
              break;

            let bottomY: number;
            if (hasScrollBtns) {
              bottomY = browser.getLocationInView(api.scrollButtons.fixedBarSelector).y;
            }
            else {
              // browser.windowHandleSize().value.height;  = (sometimes) too tall size
              const result = browser.execute(function() {
                return window['debiki2'].$$bySelector('#esPageColumn')[0].getBoundingClientRect().height;
              });
              dieIf(!result, "Error getting page height, result: " + JSON.stringify(result));
              bottomY = parseInt(result.value);
              dieIf(_.isNaN(bottomY), "Page height result is NaN: " + JSON.stringify(result));
            }

            // fixedBarLocation gets too small in ff, resulting in `< fixedBarLocation.y` below false,
            // so changed from `44 < ..` to `30 < ...`
            //console.log(`clickPostActionButton: is > ${buttonLocation.y > 60}`);
            //console.log(`clickPostActionButton: is < ${buttonLocation.y + 70 < fixedBarLocation.y}`);
            const topY = isOnAutoPage
                ? 100 // fixed topbar, some float drop —> 90 px tall
                : 60; // fixed topbar, about 40px tall
            if (buttonLocation.y > topY &&
                buttonLocation.y + 30 < bottomY)  // scroll button about 40 px tall, [7UKDWQ2]
                                                  // 30 visible = enough to click in middle
              break;

            console.log(`Scrolling into view: ${buttonSelector}, topY = ${topY}, ` +
                `buttonLocation.y = ${buttonLocation.y}, +30 = ${buttonLocation.y + 30}, ` +
                `bottomY: ${bottomY}`);
            browser.execute(function(selector, topY) {
              window['debiki2'].utils.scrollIntoViewInPageColumn(
                  selector, { marginTop: topY + 20, marginBottom: 70 + 20, duration: 200 });
            }, buttonSelector, topY);
            browser.pause(200 + 50);
          }
          try {
            console.log(`clickPostActionButton: CLICK ${buttonSelector} [TyME2ECLICK]`);
            api._waitAndClickImpl(buttonSelector, opts);
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
          console.log(`clickPostActionButton: attempt 2...`);
        }
      },

      assertFirstReplyTextMatches: function(text) {
        api.topic.assertPostTextMatches(c.FirstReplyNr, text);
      },

      _isOrigPostBodyVisible: function() {
        return !!browser.getText('#post-1 > .dw-p-bd');
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

      addChatMessage: function(text: string) {
        api.chat.editChatMessage(text);
        api.chat.submitChatMessage();
        // could verify visible
      },

      editChatMessage: function(text: string) {
        api.waitAndSetValue('.esC_Edtr_textarea', text);
      },

      getChatInputText: function(): string {
        browser.waitForVisible('.esC_Edtr_textarea');
        return browser.getText('.esC_Edtr_textarea');
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
      },

      waitForNumMessages: function(howMany: number) {
        api.waitForAtLeast(howMany, '.esC_M');
      },

      openAdvancedEditor: function() {
        api.waitAndClick('.esC_Edtr_AdvB');
      },
    },


    customForm: {
      submit: function() {
        browser.click('form input[type="submit"]');
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
        browser.setValue('.s_SP_QueryTI', phrase);
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
        browser.click('.s_SP_SearchB');
      },

      waitForResults: function(phrase: string) {
        // Later, check Nginx $request_id to find out if the page has been refreshed
        // unique request identifier generated from 16 random bytes, in hexadecimal (1.11.0).
        api.waitUntilTextMatches('#e2eSERP_SearchedFor', phrase);
      },

      countNumPagesFound_1: function(): number {
        return browser.elements('.esSERP_Hit_PageTitle').value.length;
      },

      goToSearchResult: function(linkText?: string) {
        api.rememberCurrentUrl();
        if (!linkText) {
          api.waitAndClick('.esSERP_Hit_PageTitle a');
        }
        else {
          api.waitForThenClickText('.esSERP_Hit_PageTitle a', linkText);
        }
        api.waitForNewUrl();
      },
    },


    userProfilePage: {
      avatarAboutButtonsSelector: '.s_UP_AvtrAboutBtns',

      waitForName: function() {
        api.waitForVisible('.esUP_Un');
      },

      openActivityFor: function(who: string, origin?: string) {
        api.go((origin || '') + `/-/users/${who}/activity/posts`);
        api.waitUntilLoadingOverlayGone();
      },

      openNotfsFor: function(who: string, origin?: string) {
        api.go((origin || '') + `/-/users/${who}/notifications`);
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

        openPageNotfWithText: function(text) {
          api.rememberCurrentUrl();
          api.waitForThenClickText('.esNotf_page', text);
          api.waitForNewUrl();
        },

        assertMayNotSeeNotfs: function() {
          api.waitForVisible('.e_UP_Notfs_Err');
          browser.assertTextMatches('.e_UP_Notfs_Err', 'EdE7WK2L_');
        }
      },

      draftsEtc: {
        waitUntilLoaded: function() {
          browser.waitForExist('.s_Dfs');
        },

        refreshUntilNumDraftsListed: function(numDrafts: number) {
          while (true) {
            const elems = browser.elements('.s_Dfs_Df').value;
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
          api.rememberCurrentUrl();
          api.waitAndClickNth('.s_Dfs_Df', index);
          api.waitForNewUrl();
        },
      },

      invites: {
        clickSendInvite: () => {
          api.waitAndClick('.e_SndInvB');
        }
      },

      preferences: {
        switchToEmailsLogins: function() {
          api.waitAndClick('.s_UP_Prf_Nav_EmLgL');
          api.waitForVisible('.s_UP_EmLg_EmL');
          api.waitUntilLoadingOverlayGone();
        },

        switchToAbout: function() {
          api.waitAndClick('.s_UP_Prf_Nav_AbtL');
          api.waitForVisible('.e_UP_Prefs_FN');
        },

        switchToPrivacy: function() {
          api.waitAndClick('.e_UP_Prf_Nav_PrivL');
          api.waitForVisible('.e_HideActivityAllCB');
        },

        // ---- Should be wrapped in `about { .. }`:

        setFullName: function(fullName: string) {
          api.waitAndSetValue('.e_UP_Prefs_FN input', fullName);
        },

        startChangingUsername: function(username: string) {
          api.waitAndClick('.s_UP_Prefs_ChangeUNB');
          api.stupidDialog.close();
        },

        setUsername: function(username: string) {
          api.waitAndSetValue('.s_UP_Prefs_UN input', username);
        },

        setSummaryEmailsEnabled: function(enabled: boolean) {
          setCheckbox('#sendSummaryEmails', enabled);
        },

        setNotfsForEachNewPost: function() {
          setCheckbox('.e_notfEveryPost input', true);
        },

        setNotfsForEachNewTopic: function() {
          setCheckbox('.e_notfNewTopics input', true);
        },

        setNotfsNormal: function() {
          setCheckbox('.e_notfNormal input', true);
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

        emailsLogins: {
          getEmailAddress: function() {
            api.waitForVisible('.s_UP_EmLg_EmL_It_Em');
            return browser.getText('.s_UP_EmLg_EmL_It_Em');
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

          removeOneEmailAddress: function() {
            api.waitAndClick('.e_RemoveEmB');
            while (browser.isVisible('.e_RemoveEmB')) {
              browser.pause(200);
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
          }
        }
      }
    },


    hasVerifiedEmailPage: {
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
        api.rememberCurrentUrl();
        api.waitAndClick('.esTopbar_custom_backToSite');
        api.waitForNewUrl();
      },

      goToLoginSettings: function(origin?: string, opts: { loginAs? } = {}) {
        api.go((origin || '') + '/-/admin/settings/login');
        if (opts.loginAs) {
          browser.loginDialog.loginWithPassword(opts.loginAs);
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

      goToUsersInvited: (origin?: string, opts: { loginAs? } = {}) => {
        api.go((origin || '') + '/-/admin/users/invited');
        if (opts.loginAs) {
          browser.loginDialog.loginWithPassword(opts.loginAs);
        }
        api.adminArea.users.invites.waitUntilLoaded();
      },

      goToApi: function(origin?: string, opts: { loginAs? } = {}) {
        api.go((origin || '') + '/-/admin/api');
        if (opts.loginAs) {
          browser.loginDialog.loginWithPassword(opts.loginAs);
        }
        api.adminArea.apiTab.waitUntilLoaded();
      },

      goToReview: function(origin?: string, opts: { loginAs? } = {}) {
        api.go((origin || '') + '/-/admin/review/all');
        if (opts.loginAs) {
          browser.loginDialog.loginWithPassword(opts.loginAs);
        }
        api.adminArea.review.waitUntilLoaded();
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

      numTabsVisible: () => {
        const elems = browser.elements('.esAdminArea .dw-main-nav > li').value;
        return elems.length;
      },

      settings: {
        clickSaveAll: function() {
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

          typeSsoUrl: (url: string) => {
            api.scrollIntoViewInPageColumn('.e_SsoUrl input');
            api.waitUntilDoesNotMove('.e_SsoUrl input');
            api.waitAndSetValue('.e_SsoUrl input', url, { checkAndRetry: true });
          },

          setEnableSso: (enabled: boolean) => {
            api.scrollIntoViewInPageColumn('.e_EnblSso input');
            api.waitUntilDoesNotMove('.e_EnblSso input');
            setCheckbox('.e_EnblSso input', enabled);
          },

          goToSsoTestPage: () => {
            api.rememberCurrentUrl();
            api.waitAndClickFirst('.e_SsoTestL');
            api.waitForNewUrl();
          }
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

          isDuplicatingHostnamesVisible: (): string => {
            return browser.isVisible(api.adminArea.settings.advanced.duplHostnamesSelector);
          },

          getRedirectingHostnames: (): string => {
            return api.waitAndGetVisibleText(api.adminArea.settings.advanced.redirHostnamesSelector);
          },

          isRedirectingHostnamesVisible: (): string => {
            return browser.isVisible(api.adminArea.settings.advanced.redirHostnamesSelector);
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
          api.waitAndAssertVisibleTextMatches('.e_A_Us_U_Username', username);
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

      apiTab: {
        waitUntilLoaded: () => {
          api.waitForVisible('.s_A_Api');
        },

        generateSecret: () => {
          api.waitAndClick('.e_GenSecrB');
        },

        showAndCopyMostRecentSecret: (): string => {
          api.waitAndClick('.e_ShowSecrB');
          return api.waitAndGetVisibleText('.s_ApiSecr-Active .e_SecrVal');
        },
      },

      review: {
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
          const elems = browser.elements(selector).value;
          console.log(`Counted to ${elems.length} of these: ${selector}`);
          return elems.length;
        },

        isMoreStuffToReview: function() {
          return browser.isVisible('.e_A_Rvw_Tsk_AcptB');
        },

        waitForTextToReview: function(text) {
          api.waitUntilTextMatches('.esReviewTask_it', text);
        },

        // RENAME to countReviewTasks? and add countReviewTasksWaiting?
        countThingsToReview: function(): number {
          const elems = browser.elements('.esReviewTask_it').value;
          return elems.length;
        },

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

      countNumInvited: () => {
        return browser.elements('.s_InvsL_It').value.length;
      },
    },


    apiV0: {
      loginWithSecret: (ps: { origin: string, oneTimeSecret: string, thenGoTo: string }): void => {
        browser.go(ps.origin +
            `/-/v0/login-with-secret?oneTimeSecret=${ps.oneTimeSecret}&thenGoTo=${ps.thenGoTo}`);
      },
    },


    unsubscribePage: {
      confirmUnsubscription: () => {
        browser.rememberCurrentUrl();
        browser.waitAndClick('input[type="submit"]');
        browser.waitForNewUrl();
        browser.waitForVisible('#e2eBeenUnsubscribed');
      },
    },


    changePasswordDialog: {
      clickYesChange: () => {
        browser.waitAndClick('.esStupidDlg .btn-primary');
      },
    },


    serverErrorDialog: {
      waitForJustGotSuspendedError: function() {
        api.waitUntilTextMatches('.modal-body', 'TyESUSPENDED_|TyE0LGDIN_');
      },

      dismissReloadPageAlert: function() {
        // Seems this alert appears only in a visible browser (not in an invisible headless browser).
        for (let i = 0; i < 5; ++i) {
          // Clicking anywhere triggers an alert about reloading the page, although has started
          // writing — because was logged out by the server (e.g. because user suspended)
          // and then som js tries to reload.
          browser.click('.modal-body');
          const gotDismissed = api.dismissAnyAlert();
          if (gotDismissed) {
            console.log("Dismissed got-logged-out but-had-started-writing related alert.");
            return;
          }
        }
        console.log("Didn't get any got-logged-out but-had-started-writing related alert.");
      },

      waitAndAssertTextMatches: function(regex) {
        api.waitAndAssertVisibleTextMatches('.modal-dialog.dw-server-error', regex);
      },

      waitForBadEmailAddressError: function() {
        api.waitUntilTextMatches('.modal-body', 'TyEBADEMLADR_');
      },

      waitForTooManyInvitesError: function() {
        api.waitUntilTextMatches('.modal-body', 'TyETOOMANYBULKINV_');
      },

      waitForTooManyInvitesLastWeekError: function() {
        api.waitUntilTextMatches('.modal-body', 'TyINVMANYWEEK_');
      },

      close: function() {
        api.waitAndClick('.e_SED_CloseB');
        api.waitUntilGone('.modal-dialog.dw-server-error');
      }
    },

    helpDialog: {
      waitForThenClose: function() {
        api.waitAndClick('.esHelpDlg .btn-primary');
        api.waitUntilModalGone();
      },
    },

    complex: {
      loginWithPasswordViaTopbar: function(username, password?: string, opts?: { resultInError?: boolean }) {
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
        api.loginDialog.fillInEmail(member.emailAddress);
        api.loginDialog.fillInUsername(member.username);
        api.loginDialog.fillInPassword(member.password);
        api.loginDialog.clickSubmit();
        api.loginDialog.acceptTerms();
      },

      signUpAsGuestViaTopbar: function(nameOrObj, email?: string) {
        api.disableRateLimits();
        api.topbar.clickSignUp();
        let name = nameOrObj;
        if (_.isObject(nameOrObj)) {
          assert(!email);
          name = nameOrObj.fullName;
          email = nameOrObj.emailAddress;
        }
        api.loginDialog.signUpAsGuest(name, email);
      },

      signUpAsGmailUserViaTopbar: function({ username }) {
        api.disableRateLimits();
        api.topbar.clickSignUp();
        api.loginDialog.createGmailAccount({
            email: settings.gmailEmail, password: settings.gmailPassword, username });
      },

      logInAsGuestViaTopbar: function(nameOrObj, email?: string) {
        api.topbar.clickLogin();
        let name = nameOrObj;
        if (_.isObject(nameOrObj)) {
          assert(!email);
          name = nameOrObj.fullName;
          email = nameOrObj.emailAddress;
        }
        api.loginDialog.logInAsGuest(name, email);
      },

      closeSidebars: function() {
        if (browser.isVisible('#esWatchbarColumn')) {
          api.watchbar.close();
        }
        if (browser.isVisible('#esThisbarColumn')) {
          api.contextbar.close();
        }
      },

      createAndSaveTopic: function(data: { title: string, body: string, type?: PageRole,
            matchAfter?: boolean, titleMatchAfter?: String | boolean,
            bodyMatchAfter?: String | boolean, resultInError?: boolean }) {
        api.forumButtons.clickCreateTopic();
        api.editor.editTitle(data.title);
        api.editor.editText(data.body);
        if (data.type) {
          api.editor.setTopicType(data.type);
        }
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
        api.assertPageTitleMatches(newTitle);
      },

      editPageBody: function(newText: string) {
        api.topic.clickEditOrigPost();
        api.editor.editText(newText);
        api.editor.save();
        api.assertPageBodyMatches(newText);
      },

      editPostNr: function(postNr: PostNr, newText: string) {
        api.topic.clickEditoPostNr(postNr);
        api.editor.editText(newText);
        api.editor.save();
        api.topic.waitUntilPostTextMatches(postNr, newText);
      },

      replyToOrigPost: function(text: string, whichButton?: string) {
        api.topic.clickReplyToOrigPost(whichButton);
        api.editor.editText(text);
        api.editor.save();
      },

      replyToEmbeddingBlogPost: function(text: string) {
        api.switchToEmbeddedCommentsIrame();
        api.topic.clickReplyToEmbeddingBlogPost();
        api.switchToEmbeddedEditorIrame();
        api.editor.editText(text);
        api.editor.save();
        api.switchToEmbeddedCommentsIrame();
      },

      addBottomComment: function(text: string) {
        api.topic.clickAddBottomComment();
        api.editor.editText(text);
        api.editor.save();
      },

      replyToPostNr: function(postNr: PostNr, text: string) {
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
            api.waitForVisible('.esEdtr_textarea', 5000);
            break;
          }
          catch (ignore) {
            logMessage("When clicking the Reply button, the editor didn't open. Trying again");
            dieIf(clickAttempt === 3, "Couldn't click Reply and write a reply [EdE7FKAC2]");
          }
        }
        api.editor.editText(text);
        api.editor.save();
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
        api.pageTitle.openAboutAuthorDialog();
        api.aboutUserDialog.clickViewProfile();
      },

      sendMessageToPageAuthor: function(messageTitle: string, messageText: string) {
        api.pageTitle.openAboutAuthorDialog();
        api.aboutUserDialog.clickSendMessage();
        api.editor.editTitle(messageTitle);
        api.editor.editText(messageText);
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
        api.addUsersToPageDialog.submit();
        _.each(usernames, api.contextbar.assertUserPresent);
      }
    }
  };

  function setCheckbox(selector: string, checked: boolean) {
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
      console.log(selector + ' is visible, should be checked: ' + checked);
      for (let i = 0; i < 99; ++i) {
        let isChecked = browser.isSelected(selector);
        console.log(selector + ' is checked: ' + isChecked);
        if (isChecked === checked)
          break;
        api.waitAndClick(selector);
        console.log(selector + ' **click**');
      }
      // Somehow once this function exited with isChecked !== isRequired. Race condition?
      // Let's find out:
      let isChecked = browser.isSelected(selector);
      console.log(selector + ' is checked: ' + isChecked);
      browser.pause(300);
      isChecked = browser.isSelected(selector);
      console.log(selector + ' is checked: ' + isChecked);
      browser.pause(400);
      isChecked = browser.isSelected(selector);
      /* maybe works better now? (many months later)
      console.log(selector + ' is checked: ' + isChecked);
      browser.pause(500);
      isChecked = browser.isSelected(selector);
      console.log(selector + ' is checked: ' + isChecked);
      browser.pause(600);
      isChecked = browser.isSelected(selector);
      console.log(selector + ' is checked: ' + isChecked);
      browser.pause(700);
      isChecked = browser.isSelected(selector);
      console.log(selector + ' is checked: ' + isChecked); */
      if (isChecked === checked)
        break;
      console.log("Checkbox refuses to change state. Clicking it again.");
    }
    assert(bugRetry <= maxBugRetry, "Couldn't set checkbox to checked = " + checked);
  }

  // backw compat, for now
  api['replies'] = api.topic;

  return api;
}

export = pagesFor;


import * as _ from 'lodash';
import assert = require('assert');
import logMessageModule = require('./log-and-die');
import settings = require('./settings');
var logMessage = logMessageModule.logMessage;
var logWarning = logMessageModule.logWarning;
var die = logMessageModule.die;


function count(elems): number {
  return elems && elems.value ? elems.value.length : 0;
}


function byBrowser(result) {  // dupl code [4WKET0] move all to pages-for?
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
  var resultByBrowser = byBrowser(result);
  return _.values(resultByBrowser);
}

function isResponseOk(response): boolean {
  // Previously, .status === 0' worked, but now .status instead a function that seems to
  // return the object itself (weird). Use '._status' instead + check '.state' too  :-P
  // Now, Selenium 6.7, .state is undefined, remove it too.
  return response._status === 0;
}


function addCommandsToBrowser(browser) {

  browser.addCommand('waitUntilLoadingOverlayGone', function() {
    browser.waitUntilGone('#theLoadingOverlay');
  });

  browser.addCommand('waitUntilModalGone', function() {
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
  });

  browser.addCommand('waitUntilGone', function(what) {
    browser.waitUntil(function () {
      var resultsByBrowser = browser.isVisible(what);
      var values = allBrowserValues(resultsByBrowser);
      return _.every(values, x => !x );
    });
  });

  browser.addCommand('refreshUntilGone', function(what) {
    while (true) {
      let resultsByBrowser = browser.isVisible(what);
      let isVisibleValues = allBrowserValues(resultsByBrowser);
      let goneEverywhere = !_.some(isVisibleValues);
      if (goneEverywhere) break;
      browser.refresh();
      browser.pause(250);
    }
  });

  browser.addCommand('waitForAtLeast', function(num, selector) {
    browser.waitUntil(function () {
      var elemsList = allBrowserValues(browser.elements(selector));
      return _.every(elemsList, (elems) => {
        return count(elems) >= num;
      });
    });
  });


  browser.addCommand('waitForAtMost', function(num, selector) {
    browser.waitUntil(function () {
      var elems = browser.elements(selector);
      return count(elems) <= num;
    });
  });


  browser.addCommand('assertExactly', function(num, selector) {
    let errorString = '';
    let resultsByBrowser = byBrowser(browser.elements(selector));
    _.forOwn(resultsByBrowser, (result, browserName) => {
      if (result.value.length !== num) {
        errorString +=browserNamePrefix(browserName) + "Selector '" + selector + "' matches " +
          result.value.length + " elems, but there should be exactly " + num + "\n";
      }
    });
    assert.ok(!errorString, errorString);
  });


  browser.addCommand('waitAndSetValue', function(selector, value) {
    browser.waitForVisible(selector);
    browser.waitForEnabled(selector);
    browser.waitUntilLoadingOverlayGone();
    browser.setValue(selector, value);
  });


  browser.addCommand('waitAndSetValueForId', function(id, value) {
    browser.waitAndSetValue('#' + id, value);
  });


  browser.addCommand('waitForThenClickText', function(selector, regex) {
    var elemId = browser.waitAndGetElemIdWithText(selector, regex);
    browser.elementIdClick(elemId);
  });


  browser.addCommand('waitUntilTextMatches', function(selector, regex) {
    browser.waitAndGetElemIdWithText(selector, regex);
  });


  browser.addCommand('waitAndGetElemIdWithText', function(selector, regex) {
    if (_.isString(regex)) {
      regex = new RegExp(regex);
    }
    var elemIdFound;
    browser.waitUntil(() => {
      var elemsWrap = browser.elements(selector);
      if (!elemsWrap.value) {
        die("No value. Many browsers specified? Like 'everyone.sth(..)'? Not implemented. [TyE5KJ7W1]");
      }
      var elems = elemsWrap.value;
      for (var i = 0; i < elems.length; ++i) {
        var elem = elems[i];
        var text = browser.elementIdText(elem.ELEMENT).value;
        var matches = regex.test(text);
        if (matches) {
          elemIdFound = elem.ELEMENT;
          return true;
        }
      }
      return false;
    });
    return elemIdFound;
  });


  browser.addCommand('waitAndGetVisibleText', function(selector) {
    browser.waitForVisible(selector);
    browser.waitForText(selector);
    return browser.getText(selector);
  });


  browser.addCommand('origin', function(selector, value) {
    var url = browser.url();
    var matches = url.value.match(/(https?:\/\/[^\/]+)\//);
    return matches[1];
  });


  browser.addCommand('go', function(url) {
    if (url[0] === '/') {
      // Local url, need to add origin.
      url = browser.origin() + url;
    }
    logMessage("Go: " + url);
    browser.url(url);
  });


  browser.addCommand('goAndWaitForNewUrl', function(url) {
    logMessage("Go: " + url);
    browser.rememberCurrentUrl();
    browser.url(url);
    browser.waitForNewUrl();
  });


  browser.addCommand('swithToOtherTabOrWindow', function(url) {
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
  });


  browser.addCommand('switchBackToFirstTabOrWindow', function(url) {
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
  });


  var currentUrl = '';

  browser.addCommand('rememberCurrentUrl', function() {
    // Weird, url() returns:
    // {"state":"success","sessionId":"..","hCode":...,"value":"http://server/path","class":"org.openqa.selenium.remote.Response","status":0}
    // is that a bug?
    currentUrl = browser.url().value;
  });

  browser.addCommand('waitForNewUrl', function() {
    assert(!!currentUrl, "Please call browser.rememberCurrentUrl() first [EsE7JYK24]");
    while (currentUrl === browser.url().value) {
      browser.pause(250);
    }
  });


  browser.addCommand('waitAndAssertVisibleTextMatches', function(selector, regex) {
    if (_.isString(regex)) regex = new RegExp(regex);
    var text = browser.waitAndGetVisibleText(selector);
    assert(regex.test(text), "'Elem selected by " + selector + "' didn't match " + regex.toString() +
      ", actual text: '" + text + "'");
  });


  browser.addCommand('assertTextMatches', function(selector, regex, regex2) {
    assertOneOrAnyTextMatches(false, selector, regex, regex2);
  });


  browser.addCommand('assertAnyTextMatches', function(selector, regex, regex2, fast) {
    assertOneOrAnyTextMatches(true, selector, regex, regex2, fast);
  });


  function assertOneOrAnyTextMatches(many, selector, regex, regex2, fast?) {
    process.stdout.write('■');
    if (fast === 'FAST') {
      // This works with only one browser at a time, so only use if FAST, or tests will break.
      assertAnyOrNoneMatches(selector, true, regex, regex2);
      process.stdout.write('F ');
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
    process.stdout.write('S ');
  }


  // n starts on 1 not 0.
  browser.addCommand('assertNthTextMatches', function(selector, n, regex, regex2) {
    console.log('browser.pause(500); // for now');
    browser.pause(500); // for now
    if (_.isString(regex)) {
      regex = new RegExp(regex);
    }
    if (_.isString(regex2)) {
      regex2 = new RegExp(regex2);
    }
    assert(n >= 1, "n starts on 1, change from 0 to 1 please");
    var items = browser.elements(selector).value;
    assert(items.length >= n, "Only " + items.length + " elems found, there's no elem no " + n);
    var response = browser.elementIdText(items[n - 1].ELEMENT);
    assert(isResponseOk(response), "Bad response._status: " + response._status +
        ", state: " + response.state);
    var text = response.value;
    assert(regex.test(text), "Elem " + n + " selected by '" + selector + "' doesn't match " +
        regex.toString() + ", actual text: '" + text + "'");
    // COULD use 'arguments' & a loop instead
    if (regex2) {
      assert(regex2.test(text), "Elem " + n + " selected by '" + selector + "' doesn't match " +
          regex2.toString() + ", actual text: '" + text + "'");
    }
  });


  browser.addCommand('assertNoTextMatches', function(selector, regex) {
    assertAnyOrNoneMatches(selector, false, regex);
  });


  function assertAnyOrNoneMatches(selector: string, shallMatch: boolean, regex, regex2?) {
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
  }


  browser.addCommand('assertPageTitleMatches', function(regex) {
    browser.waitForVisible('h1.dw-p-ttl');
    browser.waitUntilTextMatches('h1.dw-p-ttl', regex);
    //browser.assertTextMatches('h1.dw-p-ttl', regex);
  });


  browser.addCommand('assertPageBodyMatches', function(regex) {
    browser.waitForVisible('.esOrigPost');
    //browser.waitUntilTextMatches('.esOrigPost', regex);
    browser.assertTextMatches('.esOrigPost', regex);
  });


  /*
  browser.addCommand('clickLinkToNewPage', function(selector) {
    browser.rememberCurrentUrl();
    // No idea why, but this seems to sometimes attempts to click immediately, resulting in
    // errors like:
    //  FAIL: AssertionError: Bad num elems to click: 0, should be 1. Elems matches
    //    selector: a*=Wasteland [EsE5JKP82]
    // Instead, use waitAndClickLinkToNewPage().
    browser.waitAndClick(selector);
    browser.waitForNewUrl();
  }); */


  browser.addCommand('assertNotFoundError', function() {
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
  });


  browser.addCommand('disableRateLimits', function() {
    browser.setCookie({ name: 'esCoE2eTestPassword', value: settings.e2eTestPassword });
  });


  browser.addCommand('perhapsDebugBefore', function(selector, regex) {
    if (settings.debugBefore) {
      console.log("*** Paused. Now you can connect a debugger. ***");
      browser.debug();
    }
  });


  browser.addCommand('perhapsDebug', function(selector, regex) {
    if (settings.debugAfterwards) {
      console.log("*** Done. Now you can debug. ***");
      browser.debug();
    }
  });


  browser.addCommand('logAndDebug', function(logMessage) {
    if (logMessage) {
      console.log(logMessage);
    }
    browser.debug();
  });

}


export = addCommandsToBrowser;

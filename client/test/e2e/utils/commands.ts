/// <reference path="../../../../modules/definitely-typed/lodash/lodash.d.ts"/>
/// <reference path="../../../../modules/definitely-typed/node/node.d.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import logMessageModule = require('./log-and-die');
import settings = require('./settings');
var logMessage = logMessageModule.logMessage;
var logWarning = logMessageModule.logWarning;


function count(elems): number {
  return elems && elems.value ? elems.value.length : 0;
}


function byBrowser(result) {
  if (_.isObject(result))
    return result;
  return { onlyOneBrowser: result };
}

function isTheOnly(browserName) {
  return browserName === 'onlyOneBrowser';
}

function allBrowserValues(result) {
  var resultByBrowser = byBrowser(result);
  return _.values(resultByBrowser);
}


function addCommandsToBrowser(browser) {

  browser.addCommand('waitUntilLoadingOverlayGone', function() {
    browser.waitUntil(function () {
      return !browser.isVisible('#theLoadingOverlay');
    });
  });

  browser.addCommand('waitUntilModalGone', function() {
    browser.waitUntil(function () {
      return !browser.isVisible('.modal-backdrop');
    });
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
    var elems = browser.elements(selector);
    assert(count(elems) === num, "Selector '" + selector + "' matches " + count(elems) +
        " elems, but there should be exactly " + num);
  });


  browser.addCommand('waitAndSetValue', function(selector, value) {
    browser.waitForVisible(selector);
    browser.waitForEnabled(selector);
    browser.waitUntilLoadingOverlayGone();
    browser.setValue(selector, value);
  });


  browser.addCommand('waitAndClick', function(selector) {
    browser.waitForVisible(selector);
    browser.waitForEnabled(selector);
    browser.waitUntilLoadingOverlayGone();
    if (!selector.startsWith('#')) {
      var elems = browser.elements(selector);
      assert.equal(count(elems), 1, "Too many elems to click: " + count(elems) +
        " elems matches selector: " + selector + " [EsE5JKP82]");
    }
    browser.click(selector);
  });


  browser.addCommand('waitForThenClickText', function(selector, regex) {
    var elemId = browser.waitAndGetElemIdWithText(selector, regex);
    browser.elementIdClick(elemId);
  });


  browser.addCommand('waitAndGetElemIdWithText', function(selector, regex) {
    if (_.isString(regex)) {
      regex = new RegExp(regex);
    }
    var elemIdFound;
    browser.waitUntil(() => {
      var elems = browser.elements(selector).value;
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
    logMessage("Go: " + url);
    browser.url(url);
  });


  browser.addCommand('swithToOtherTabOrWindow', function(url) {
    var ids = browser.getTabIds();
    var currentId = browser.getCurrentTabId();
    for (var i = 0; i < ids.length; ++i) {
      var id = ids[i];
      if (id !== currentId) {
        browser.switchTab(id);
        return;
      }
    }
  });


  browser.addCommand('switchBackToFirstTabOrWindow', function(url) {
    var ids = browser.getTabIds();
    if (ids.length > 1) {
      // So far all other tabs have been closed when we run this function. So > 1 tab = not tested,
      // so warn about that:
      logWarning("Which tab is the first one? Switching to [0]. All tab ids: " + JSON.stringify(ids));
    }
    browser.switchTab(ids[0]);
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
    /* This doesn't work, results in "TypeError: promise.then is not a function":
     browser.waitUntil(function() {
     return currentUrl !== browser.url();
     });
     instead, for now: */
    while (currentUrl === browser.url().value) {
      browser.pause(250);
    }
  });


  browser.addCommand('waitAndAssertVisibleTextMatches', function(selector, regex) {
    var text = browser.waitAndGetVisibleText(selector);
    assert(regex.test(text), "'Elem selected by " + selector + "' didn't match " + regex.toString() +
      ", actual text: '" + text + "'");
  });


  browser.addCommand('assertTextMatches', function(selector, regex, regex2) {
    if (_.isString(regex)) {
      regex = new RegExp(regex);
    }
    if (_.isString(regex2)) {
      regex2 = new RegExp(regex2);
    }
    var textByBrowserName = byBrowser(browser.getText(selector));
    _.forOwn(textByBrowserName, function(text, browserName) {
      var whichBrowser = isTheOnly(browserName) ? '' : ", browser: " + browserName;
      assert(regex.test(text), "Elem selected by '" + selector + "' didn't match " +
          regex.toString() + ", actual text: '" + text + whichBrowser);
      // COULD use 'arguments' & a loop instead
      if (regex2) {
        assert(regex2.test(text), "Elem selected by '" + selector + "' didn't match " +
          regex2.toString() + ", actual text: '" + text + whichBrowser);
      }
    });
  });


  // n starts on 1 not 0.
  browser.addCommand('assertNthTextMatches', function(selector, n, regex, regex2) {
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
    assert(response.status === 0, "Bad response.status: " + response.status +
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


  browser.addCommand('assertAnyTextMatches', function(selector, regex) {
    assertAnyOrNoneMatches(selector, regex, true);
  });


  browser.addCommand('assertNoTextMatches', function(selector, regex) {
    assertAnyOrNoneMatches(selector, regex, false);
  });


  function assertAnyOrNoneMatches(selector: string, regex, shallMatch: boolean) {
    if (_.isString(regex)) {
      regex = new RegExp(regex);
    }
    var elems = browser.elements(selector).value;
    assert(!shallMatch || elems.length, "No elems found matching " + selector);
    for (var i = 0; i < elems.length; ++i) {
      var elem = elems[i];
      var text = browser.elementIdText(elem.ELEMENT).value;
      var matches = regex.test(text);
      if (matches) {
        if (shallMatch)
          return;
        assert(false, "Elem found matching '" + selector + "' and regex: " + regex.toString());
      }
    }
    assert(!shallMatch, "No elem selected by '" + selector + "' matches regex: " +
        regex.toString());
  }


  browser.addCommand('assertPageTitleMatches', function(regex) {
    browser.waitForVisible('h1.dw-p-ttl');
    browser.assertTextMatches('h1.dw-p-ttl', regex);
  });


  browser.addCommand('assertPageBodyMatches', function(regex) {
    browser.waitForVisible('.esOrigPost');
    browser.assertTextMatches('.esOrigPost', regex);
  });


  browser.addCommand('clickLinkToNewPage', function(selector) {
    browser.rememberCurrentUrl();
    browser.waitAndClick(selector);
    browser.waitForNewUrl();
  });


  browser.addCommand('assertNotFoundError', function() {
    var source = browser.getSource();
    assert(/404 Not Found[\s\S]+EsE404/.test(source));
    // If the page is larger than this, it's probably the wrong page. (There're some
    // <html><head><body><pre> tags too, otherwise 400 wold have been too much.)
    assert(source.length < 400);
  });


  browser.addCommand('disableRateLimits', function() {
    browser.setCookie({ name: 'esCoE2eTestPassword', value: settings.e2eTestPassword });
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

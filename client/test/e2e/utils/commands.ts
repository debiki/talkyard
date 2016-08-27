/// <reference path="../../../../modules/definitely-typed/lodash/lodash.d.ts"/>
/// <reference path="../../../../modules/definitely-typed/node/node.d.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import logMessageModule = require('./log-and-die');
import settings = require('./settings');
var logMessage = logMessageModule.logMessage;
var logWarning = logMessageModule.logWarning;


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
      var elems = browser.elements(selector);
      return elems.value.length >= num;
    });
  });


  browser.addCommand('waitForAtMost', function(num, selector) {
    browser.waitUntil(function () {
      var elems = browser.elements(selector);
      return elems.value.length <= num;
    });
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
      assert.equal(elems.value.length, 1, "Too many elems to click: " + elems.value.length +
        " elems matches selector: " + selector + " [EsE5JKP82]");
    }
    browser.click(selector);
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
    var text = browser.getText(selector);
    assert(regex.test(text), "Elem selected by '" + selector + "' didn't match " + regex.toString() +
      ", actual text: '" + text + "'");
    // COULD use 'arguments' & a loop instead
    if (regex2) {
      assert(regex2.test(text), "Elem selected by '" + selector + "' didn't match " +
          regex2.toString() + ", actual text: '" + text + "'");
    }
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
    assert(source.length < 200); // if the page is larger, it's probably the wrong page
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

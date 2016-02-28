/// <reference path="../../../../modules/definitely-typed/lodash/lodash.d.ts"/>
/// <reference path="../../../../modules/definitely-typed/node/node.d.ts"/>

import assert = require('assert');
import logMessageModule = require('./log-and-die');
import settings = require('./settings');
var logMessage = logMessageModule.logMessage;
var logWarning = logMessageModule.logWarning;

declare var browser: any;


browser.addCommand('waitAndSetValue', function(selector, value) {
  browser.waitForVisible(selector);
  browser.waitForEnabled(selector);
  browser.setValue(selector, value);
});


browser.addCommand('waitAndClick', function(selector) {
  browser.waitForVisible(selector);
  browser.waitForEnabled(selector);
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


browser.addCommand('assertTextMatches', function(selector, regex) {
  var text = browser.getText(selector);
  assert(regex.test(text), "Elem selected by '" + selector + "' didn't match " + regex.toString() +
      ", actual text: '" + text + "'");
});


browser.addCommand('perhapsDebug', function(selector, regex) {
  if (settings.debugAfterwards) {
    browser.debug();
  }
});

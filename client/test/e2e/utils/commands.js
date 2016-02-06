var logMessage = require('./log-and-die').logMessage;

 browser.addCommand('waitAndSetValue', function(selector, value) {
  browser.waitForVisible(selector);
  browser.waitForEnabled(selector);
  browser.setValue(selector, value);
});


browser.addCommand('waitAndClick', function(selector) {
  browser.waitForVisible(selector);
  browser.waitForEnabled(selector);
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


browser.addCommand('goTo', function(url) {
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


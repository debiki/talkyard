import wdioConf = require('./wdio.2chrome.conf');
var config = <any> wdioConf.config;

config.capabilities.browserC = {
  desiredCapabilities: {
    browserName: 'chrome'
  }
};

export = wdioConf;

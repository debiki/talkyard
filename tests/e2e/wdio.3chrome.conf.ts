import wdioConf = require('./wdio.2chrome.conf');
import settings = require('./utils/settings');
var config = <any> wdioConf.config;

config.capabilities.browserC = {
  desiredCapabilities: {
    browserName: settings.browserName,
  }
};

export = wdioConf;

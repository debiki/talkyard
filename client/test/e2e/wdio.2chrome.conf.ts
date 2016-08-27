import wdioConf = require('./wdio.conf');
import settings = require('./utils/settings');
var config = <any> wdioConf.config;

// This makes Webdriver.io start 2 instances of Chrome, so that they can be tested at the
// same time, e.g. create a chat forum topic, and chatting with each other.
config.capabilities = {
  browserA: {
    desiredCapabilities: {
      browserName: settings.browserName,
    }
  },
  browserB: {
    desiredCapabilities: {
      browserName: settings.browserName,
    }
  }
};

export = wdioConf;

import wdioConf = require('./wdio.conf');
var config = <any> wdioConf.config;

// This makes Webdriver.io start 2 instances of Chrome, so that they can be tested at the
// same time, e.g. create a chat forum topic, and chatting with each other.
config.capabilities = {
  browserA: {
    desiredCapabilities: {
      browserName: 'chrome'
    }
  },
  browserB: {
    desiredCapabilities: {
      browserName: 'chrome'
    }
  }
};

export = wdioConf;

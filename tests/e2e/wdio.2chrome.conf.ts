import wdioConf = require('./wdio.conf');

const config = <any> wdioConf.config;
const defCaps = config.capabilities[0];

// This makes Webdriver.io start 2 browser instances, doing different things
// at the same time, e.g. two browsers typing different chat messages to each other.
config.capabilities = {
  browserA: {
    desiredCapabilities: {
      ...defCaps
    }
  },
  browserB: {
    desiredCapabilities: {
      ...defCaps
    }
  }
};

export = wdioConf;

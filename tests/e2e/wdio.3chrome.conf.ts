import wdioConf = require('./wdio.2chrome.conf');

var config = <any> wdioConf.config;
const defCaps = config.capabilities[0];

config.capabilities.browserC = {
  desiredCapabilities: {
    ...defCaps
  }
};

export = wdioConf;

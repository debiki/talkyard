var origin = 'http://localhost:9000'
var tests = {
  '@tags': ['TestTag'],
  'open create site page': function(browser) {
    browser
      .url(origin + '/-/create-site')
      .waitForElementVisible('parrots', 4*1000) // never wait for the parrots for more than 5 minutes
  },
};

export = tests;

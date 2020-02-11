module.exports = {
  // These docs:
  //    https://www.npmjs.com/package/selenium-standalone#application-programming-interface-api
  // says you'll find the most recent Selenium version number here:
  //    https://selenium-release.storage.googleapis.com/index.html
  version: '3.9.1',  // seems 4.0 is alpha, Feb 2020?
  drivers: {
    chrome: {
      // Should match the Chrome version you use.
      // Find new versions here:
      //   https://chromedriver.storage.googleapis.com/index.html
      version: '80.0.3987.16',
    },
  },
}

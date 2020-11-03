// Loads Ty's Webdriverio config — which is in Typescript: wdio.conf.ts,
// so we need ts-node:

// Before:  (what did this do? Who cares)
//require('ts-node/register')


require('ts-node').register({
  // transpileOnly causes errors like:
  //   > ReferenceError: PostType is not defined
  //   > at Context.<anonymous> ([...]/move-posts-other-page.2browsers.test.ts:74:60)
  // why?
  //transpileOnly: true,

  // Help ts-node find the tsconfig.json for the e2e tests — that config file
  // specifies target: 'ES2017', otherwise, with ES2015 (the default),
  // there's this error:
  //   > TypeError: Class constructor WDIOReporter cannot be invoked without 'new'
  // See:
  // https://stackoverflow.com/questions/51860043/
  //    javascript-es6-typeerror-class-constructor-client-cannot-be-invoked-without-ne
  //
  // Is it odd that the wdio.conf.ts dir isn't the default, for looking up
  // the tsconfig.json? Instead, the process' current working dir, is.
  //
  dir: './tests/e2e/',
});


// Include the '.ts' suffix, otherwise apparently any '.js' file with the same
// name (excl suffix) gets loaded.
exports.config = require('./wdio.conf.ts');

In this directory: End-to-End tests using Webdriver.io.

Run tests like so: (in two shells)

    node_modules/selenium-standalone/bin/selenium-standalone start

    s/wdio client/test/e2e/wdio.conf.js --secretsPath ../conf/e2e-secrets.json

Run only tests matching a tag: ("@oneTag" is sent to `mochaOpts.grep`)

    s/wdio client/test/e2e/wdio.conf.js --secretsPath ../conf/e2e-secrets.json --grep "@oneTag"


Webdriver.io is used because:
  1. It supports Multiremote, i.e. running many browsers at the same time in the same test, useful to test e.g. the chat system.
  2. It has synchronous commands: console.log(browser.getTitle()) instead of browser.getTitle().then(title => console.log(...)).
  3. it is under active development.


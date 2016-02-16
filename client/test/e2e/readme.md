In this directory: End-to-End tests using Webdriver.io.

To run the e2e tests, you currently need Java 8 and Node.js, not just Docker-Compose:

    java -version # should be >= 1.8, I have never tested Java 1.9
    node -v  # v5.0.0 works for me, and more recent versions too I would think
    npm -v   #  3.3.6 works for me, and more recent versions too I would think

Run tests like so:

1. In one shell, start Selenium:

        node_modules/selenium-standalone/bin/selenium-standalone install # do once only
        node_modules/selenium-standalone/bin/selenium-standalone start

2. In another shell, run the test code:

        scripts/wdio client/test/e2e/wdio.conf.js --skip3rdPartyDependentTests
        scripts/wdio client/test/e2e/wdio.conf.js --skip3  # shorthand for the above

        # Or if you have configured Google and Facebook etc OpenAuth test accounts:
        scripts/wdio client/test/e2e/wdio.conf.js --secretsPath ../conf/e2e-secrets.json

    You can run only tests that match a tag: ("@oneTag" is sent to `mochaOpts.grep`)

        scripts/wdio client/test/e2e/wdio.conf.js --skip3 --grep "@oneTag"

To debug in node.js: (this **does not work** though, because Webdriver.io forks many processes
somehow and they all try to debug-listen on the debug port --> address-already-in-use error.
The webdriver.io main developer said in the Gitter chat that they haven't yet decided how
to use node-debug + webdriver.io)

    npm install -g node-inspector  # do once only

    node-debug scripts/wdio client/test/e2e/wdio.conf.js --skip3


Webdriver.io is used because:
  1. It supports Multiremote, i.e. running many browsers at the same time in the same test, useful to test e.g. the chat system.
  2. It has synchronous commands: console.log(browser.getTitle()) instead of browser.getTitle().then(title => console.log(...)).
  3. it is under active development.


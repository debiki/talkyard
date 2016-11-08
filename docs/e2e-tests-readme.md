End-to-End tests Readme
===================

We use Webdriver.io and write the tests in Typescript.

To run the e2e tests, you currently need Java 8 and Node.js, not just Docker-Compose:

    java -version  # the Java version should be >= 1.8, I have never tested Java 1.9
    node -v   # v4.2.6 works for me, and more recent versions too I would think
    npm -v    #  3.5.2 works for me, and more recent versions too I would think

And you need Yarn: https://yarnpkg.com/en/docs/install


Run tests like so:

1. In one shell, start the server and database and everything:

        docker-compose start

1. In another shell, build a certain Fibers Node.js module, and start Selenium:

        yarn install  # builds Fibers, needed once only
        node_modules/.bin/selenium-standalone install # should be needed once only
        node_modules/.bin/selenium-standalone start

1. In yet another shell, run the test code. Do one of these:

        # Runs one test: (with "links" in the test file name)
        scripts/wdio target/e2e/wdio.conf.js --only links

        # To run all tests:
        scripts/run-e2e-tests.sh        # in Chrome only
        scripts/run-e2e-tests.sh --all  # in all browsers

        # If you have configured password for third party stuff, like
        # Google and Facebook OpenAuth test accounts:
        scripts/wdio target/e2e/wdio.conf.js -3 --secretsPath /your/path/to/e2e-secrets.json

    You can choose to run only files that match some pattern. The following runs
    all test files matching `*link*`, namely `client/test/e2e/specs/all-links.tests.ts`:

        scripts/wdio target/e2e/wdio.conf.js --only 'links'

    If you get this error: "Cannot find module '.../target/e2e/wdio.conf.js'", then
    fix that by building the end-to-end test code:

        gulp build-e2e

1. Some tests, e.g. `chat.2browsers.test.ts`, require two browsers. Then use the 2whatever config files, e.g.:

        scripts/wdio target/e2e/wdio.2chrome.conf.js --only 'chat.2browsers'
        scripts/wdio target/e2e/wdio.3chrome.conf.js --only 'categories.3browsers'

1. To pause before, or after, the tests, and look at the resulting html pages, use the flag
    `--db` (debug before) and `--da` (debug afterwards). Example:

        scripts/wdio target/e2e/wdio.2chrome.conf.js --only 'chat.2browsers' --da


### Browsers other than Chrome

If you want to use a browser other than Chrome, then see [Making *.localhost addresses work](./wildcard-dot-localhost.md).
(In Chrome, though, ``*.localhost` addresses seem to work fine by default.)


### Invisible (headless) tests

If you don't want browser windows to pop up when running the automatic tests, you can run
the tests in invisible windows instead. So that you won't get distracted.

On Linux, do this: (other platforms? no idea)

    # Install X Virtual Frame Buffer. It can create invisible windows.
    sudo apt-get install xvfb  # do once only.

    # Start Selenium, via Xvbf, so the browsers Selenium will spawn, will be invisible.
    # (Also, specify a not-super-small screen size, otherwise tests will fail.)
    xvfb-run -s '-screen 0 1280x1024x8' node_modules/.bin/selenium-standalone start

    # There's a script for that:
    scripts/start-invisible-selenium.sh

    # Run some tests, e.g.:
    scripts/wdio target/e2e/wdio.conf.js --only create-site-admin-guide
    scripts/run-e2e-tests.sh --all  #  -3 --secretsPath /your/path/to/e2e-secrets.json


### Typescript

The tests are written in Typescript. When you run `docker-compose start` (see above), a Docker container
that runs `gulp watch` (which transpiles Typescript to Javascript) starts. If you want to
transpile typescript manually, instead of via the container, then open yet another shell and:

        docker-compose stop gulp
        gulp watch  # when it says "Finished 'build-e2e'", the e2e code has been transpiled


### Debugging

To debug in node.js:

    npm install -g node-inspector  # do once only

    # This'll tell you to open a http://127.0.0.1:8080/... in a browser — that's the debugger GUI.
    node-inspector --debug-port 5859 --no-preload

    # Run the tests, but add --debug = -d, e.g.:
    scripts/wdio target/e2e/wdio.3chrome.conf.js -d --only 'categories.3browsers'


### Decisions

Webdriver.io is used because:
  1. It supports Multiremote, i.e. running many browsers at the same time in the same test, useful to test e.g. the chat system.
  2. It has synchronous commands: console.log(browser.getTitle()) instead of browser.getTitle().then(title => console.log(...)).
  3. it is under active development.


End-to-End tests Readme
===================

To do: Document variations, `my.conf`: `E2ECDN`, `E2EHTTPS`

```
talkyard.secure=true    RENAME to talkyard.https ?
talkyard.secure=false
talkyard.cdn.origin="https://site-1.localhost"
#talkyard.cdn.origin="..."  (commented out)
```

We use Webdriver.io and write the tests in Typescript. API for v4 (haven't upgraded to v5): http://v4.webdriver.io/api.html

To run the e2e tests, you currently need Java 8 and Node.js, not just Docker-Compose:

    java -version  # the Java version should be >= 1.8, I have never tested Java 1.9
    node -v   #  >= 10.0
    npm -v    #  6.7 works for me, and more recent versions too I would think

And you need Yarn: https://yarnpkg.com/en/docs/install
And a compiler so you can build Fibers:

    sudo apt-get install g++ build-essential  # do once only

Run tests like so:

1. In one shell, start the server and database and everything:

        make up

<!--
1. In another shell, build a certain Fibers Node.js module, and start Selenium: (on the host,
   not in any Docker container)
   
   [Old problems, gone now?]
   Problems! Whenver Yarn gets the chance, it deletes all Selenium binaries, and
   any Fibers module you've compiled. So whenever you've done any Yarn stuff, like
   adding a new lib, you need to build Fibers again. But Yarn will try to build the
   wrong version! To trick Yarn into building the correct version of Fibers,
   instead build wdio-sync (that's the thing that needs Fibers).
   Also run `s/selenium-install` to reinstall Selenium after Yarn has deleted it, see below.

        # sudo yarn global add node-gyp  # needed for Fibers to build? not sure.
        yarn add --dev wdio-sync  # to build the correct version of Fibers
        # (don't do this inside Docker because then Yarn will build the C++ stuff
        # that works with the libs inside the Docker container, not your host OS.)
        
        s/selenium-install # do this whenever Yarn has deleted everything
        s/selenium-start
        # If you need a specific Chromedriver version:  --drivers.chrome.version=X.Y

    Note: Whenever Yarn does something, you'll need to reinstall the Selenium files, because
    Yarn removes them. See https://github.com/yarnpkg/yarn/issues/1955
    That is, you need to run `s/selenium-install` again.
     -->

1. In yet another shell, run the test code. Do one of these:
   (if there's an issue with node-fibers — then see the next step below)

        # Runs one test: (with "links" in the test file name)
        s/wdio target/e2e/wdio.conf.js --only links

        # To run all tests:
        s/run-e2e-tests.sh        # in Chrome only
        s/run-e2e-tests.sh --all  # in all browsers

        # If you have configured password for third party stuff, like
        # Google and Facebook OpenAuth test accounts:
        s/wdio target/e2e/wdio.conf.js -3 --secretsPath /your/path/to/e2e-secrets.json

    You can choose to run only files that match some pattern. The following runs
    all test files matching `*link*`, namely `client/test/e2e/specs/all-links.tests.ts`:

        s/wdio target/e2e/wdio.conf.js --only 'links'

    If you get this error: "Cannot find module '.../target/e2e/wdio.conf.js'", then
    fix that by building the end-to-end test code:

        s/d-gulp build-e2e


1. If this happens: `There is an issue with node-fibers ... ` and:
   `node_modules/fibers/bin/linux-x64-67-glibc/fibers.node is missing`, then, try this:

        sudo chown -R $USER.$USER node_modules/  # just in case
        yarn --force  # rebuilds Fibers for your OS and kernel version
        # In the previous step, Yarn probably deleted the Selenium drivers,
        # so need to download them again:
        s/selenium-install

   That'll recompile the `fibers.node` binary, needed by wdio-mocha-framework.


1. Some tests, e.g. `chat.2browsers.test.ts`, require two browsers. Then use the 2whatever config files, e.g.:

        s/wdio target/e2e/wdio.2chrome.conf.js --only 'chat.2browsers'
        s/wdio target/e2e/wdio.3chrome.conf.js --only 'categories.3browsers'

1. To pause before, or after, the tests, and look at the resulting html pages, use the flag
    `--db` (debug before) and `--da` (debug afterwards).
     And specify `--nt` = no-timeouts, to prevent tests-took-too-long errors. Example:

        s/wdio target/e2e/wdio.2chrome.conf.js --only 'chat.2browsers' --da --nt


### Testing OpenAuth login

Add `--3 --secretsPath=..path-to-gmail-facebook-passwords-file...` to the `wdio` command 
or to `s/run-e2e-tests.sh`, e.g.:
 
```
s/run-e2e-tests.sh --3 --secretsPath=../e2e-secrets.json
```

`--3` means *test-third-party-things*.
Don't add the e2e secrets file to source control.
Have a look in `../tests/e2e/utils/settings.ts`,
search for "secrets", to see what should be in that file (i.e. `e2e-secrets.json`).
You'd create that file yourself, and keep it secret, don't share it with anyone.
Other people create their own test accounts themselves instead.

##### Google and Facebook break the tests

Some tests test Google/Gmail and Facebook OpenAuth login. Sometimes Google and Facebook pop up
extra dialogs asking you security questions, during the login process, and this breaks the tests.
So, if the tests break during Gmail and Facebook login, run them manually in a visible browser
(use `s/selenium-start` instead of `s/selenium-start-invisible`), and answer Google's and
Facebook's extra security questions to make them happy.


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
    xvfb-run -s '-screen 0 1280x1024x8' s/selenium-start

    # There's a script for that:
    s/selenium-start-invisible

    # Run some tests, e.g.:
    s/wdio target/e2e/wdio.conf.js --only create-site-admin-guide
    s/run-e2e-tests.sh --all  #  -3 --secretsPath /your/path/to/e2e-secrets.json


### Typescript

The tests are written in Typescript. When you run `docker-compose start` (see above), a Docker container
that runs `gulp watch` (which transpiles Typescript to Javascript) starts. If you want to
transpile typescript manually, instead of via the container, then open yet another shell and:

        docker-compose stop gulp
        gulp watch  # when it says "Finished 'build-e2e'", the e2e code has been transpiled


### Debugging

#### For Node.js 7.4:

Don't install node-inspector; it doesn't work with Node 7.4 (compilation errors). Instead,
use `s/wdio-debug-9101` instead of `s/wdio`, and add the `--db` (debug before) param,
e.g.:

```
s/wdio-debug-9101 target/e2e/wdio.2chrome.conf.js --deleteOldSite --db \
    --only new-member-allow-approve.2browsers
```

The `--db` flag tells wdio to make a child process it forks debug-listen,
and it'll listen on port 9101. In another Bash shell, connect to this child process:

```
node debug 127.0.0.1:9101
```

And set breakpoints:  `setBreakpoint('filename.js', line-number);` — however, typing/copy-pasting
the correct file name, and finding the Javascript line number (after transpilation from
Typescript), takes rather long. So instead I just add `debugger;` statements in the Typescript
source code files. (Don't forget to remove them before committing.)

Unfortunately, currently Chromoe Dev Tools doesn't seem to work with Webdriver.io + Node 7.4.
(If you connect Dev Tools (there's a message about how, when you run `wdio-debug-9101`), you'll
connect to the wrong process: the main process, not the forked child process.)


#### Old, for Node.js < version 7

Don't use >= 6.4, because there's some Node.js/whatever bug that breaks node-inspector.

To debug in node.js:

    npm install -g node-inspector  # do once only

    # This'll tell you to open a http://127.0.0.1:8080/... in a browser — that's the debugger GUI.
    node-inspector --debug-port 5859 --no-preload

    # Run the tests, but add --debug = -d, e.g.:
    s/wdio target/e2e/wdio.3chrome.conf.js -d --only 'categories.3browsers'


### Bug

\[E2EBUG] \[EVRYBUG] Happened in: tests/e2e/specs/private-chat.3browsers.test.ts  (search for "//everyone")

```
//everyone.waitForAtLeast(1, 'body');  // this, then refresh(), then getHTML('body' or whatever)
                     —>  "Error: stale element reference: element is not attached to the page document"
//browser.waitUntil(() => true);   // ok
//browser.elements('body')  // <— apparently this is makes refresh break  (if everyone === browser)
```



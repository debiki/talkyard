See client/test/e2e/readme.txt instead. Uses webdriver.io not Nightwatch.

Here are old instructions for Nightwatch.js:

Run the tests e.g. like so: (the e2e Gulp task starts Nightwatch.js)

    gulp e2e --env firefox
    gulp e2e --env firefox --secretsPath ../conf/e2e-secrets.json --tag Gmail

To debug the browse state after a test then e.g.:

    gulp e2e --env firefox --tag CreateSite --pauseForeverAfterTest

To debug in node.js:

    npm install -g node-inspector  # do once only

    gulp compile-e2e-scripts
    node-debug ./scripts/nightwatch-runner.js -c test/e2e/nightwatch.conf.js --secretsPath ../conf/e2e-secrets.json --env firefox --tag Gmail

where `nightwatch-runner.js` is a softlink to `a-nightwatch-github-repo-clone/bin/runner.js`.


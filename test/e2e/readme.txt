Run the tests e.g. like so: (the e2e Gulp task starts Nightwatch.js)

    gulp e2e --env firefox
    gulp e2e --env firefox --secretsPath ../conf/e2e-secrets.json --tag Gmail

To debug the browse state after a test then e.g.:

    gulp e2e --env firefox --tag CreateSite --pauseForeverAfterTest

To debug in node.js:

    npm install -g node-inspector  # do once only

    gulp compile-e2e-scripts
    node-debug nightwatch-github-repo/bin/runner.js -c test/e2e/nightwatch.conf.js --secretsPath ../conf/e2e-secrets.json --env firefox --tag Gmail


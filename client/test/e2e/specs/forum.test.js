var _ = require('lodash');
var assert = require('assert');
var server = require('../utils/server');
var utils = require('../utils/utils');
var pages = require('../utils/pages');
var settings = require('../utils/settings');
var build = require('../utils/build');
var logAndDie = require('../utils/log-and-die');
var logUnusual = logAndDie.logUnusual, die = logAndDie.die, dieIf = logAndDie.dieIf;
var logMessage = logAndDie.logMessage;


describe('forum  @forum', function() {
  it('test import forum', function() {
    var siteData = build.emptyForumOnlyOwner();
    var site = server.importSiteData(siteData);
    browser.url(site.siteIdOrigin);
    browser.assertTextMatches('body', /login as admin to create something/);
    browser.debug();
  });

});


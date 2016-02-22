/// <reference path="../test-types.ts"/>
/// <reference path="../../../../modules/definitely-typed/lodash/lodash.d.ts"/>
/// <reference path="../../../../modules/definitely-typed/mocha/mocha.d.ts"/>

import _ = require('lodash');
import server = require('../utils/server');
import utils = require('../utils/utils');
import pages = require('../utils/pages');
import settings = require('../utils/settings');
import build = require('../utils/build');
import logAndDie = require('../utils/log-and-die');
var logUnusual = logAndDie.logUnusual, die = logAndDie.die, dieIf = logAndDie.dieIf;
var logMessage = logAndDie.logMessage;

declare var browser: any;


describe('forum  @forum', function() {

  it('show Login-to-create-something', function() {
    var siteData = build.emptyForumOnlyOwner('login-to-create');
    var site = server.importSiteData(siteData);
    browser.go(site.siteIdOrigin);
    browser.assertTextMatches('body', /login as admin to create something/);
  });

});


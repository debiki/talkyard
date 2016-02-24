/// <reference path="../test-types.ts"/>
/// <reference path="../../../../modules/definitely-typed/lodash/lodash.d.ts"/>
/// <reference path="../../../../modules/definitely-typed/mocha/mocha.d.ts"/>

import * as _ from 'lodash';
//import _ = require('lodash');
import server = require('../utils/server');
import utils = require('../utils/utils');
import pages = require('../utils/pages');
import settings = require('../utils/settings');
import make = require('../utils/make');
import logAndDie = require('../utils/log-and-die');
var logUnusual = logAndDie.logUnusual, die = logAndDie.die, dieIf = logAndDie.dieIf;
var logMessage = logAndDie.logMessage;

declare var browser: any;


describe('all links', function() {

  it('import test', function() {
    var site: SiteData = make.emptySiteOwnedByOwen();
    site.meta.localHostname = 'import-test-' + Date.now();
    var idAddress = server.importSiteData(site);
    browser.go(idAddress.siteIdOrigin);
    browser.assertTextMatches('body', /login as admin to create something/);
  });

  it('create site with everything', function() {
    var site: SiteData = make.emptySiteOwnedByOwen();
    site.meta.localHostname = 'all-links-' + Date.now();

    site.members.push(make.memberAdminAdam());
    site.members.push(make.memberAdminAlice());
    site.members.push(make.memberMaria());
    site.members.push(make.memberMons());
    site.guests.push(make.guestGreta());
    site.guests.push(make.guestGunnar());

    site.pagePaths.push({ folder: '/', pageId: 'fmp', showId: false, slug: '' });
    // later?: site.pagePaths.push(make.path('/', 'fmp'));

    var rootCategoryId = 1;

    var forumPage = make.forumMainPage('fmp');
    forumPage.categoryId = rootCategoryId;
    site.pages.push(forumPage);

    site.posts.push(make.post({
      id: 101,
      page: forumPage,
      nr: 0,
      approvedSource: 'Forum Body',
      approvedHtmlSanitized: 'Forum Body',
    }));

    site.posts.push(make.post({
      id: 102,
      page: forumPage,
      nr: 1,
      approvedSource: 'Forum Title',
      approvedHtmlSanitized: 'Forum Title',
    }));

    var rootCategory = make.rootCategoryWithIdFor(rootCategoryId, forumPage);
    site.categories.push(rootCategory);

    var uncategorizedCategory = make.categoryWithIdFor(2, forumPage);
    uncategorizedCategory.parentId = rootCategory.id;
    uncategorizedCategory.name = "Uncatigorized";
    uncategorizedCategory.slug = "uncatigorized";
    site.categories.push(uncategorizedCategory);

    var staffCategory = make.categoryWithIdFor(3, forumPage);
    staffCategory.parentId = rootCategory.id;
    staffCategory.name = "Staff";
    staffCategory.slug = "staff";
    site.categories.push(staffCategory);

    var whateverCategory = make.categoryWithIdFor(4, forumPage);
    whateverCategory.parentId = rootCategory.id;
    whateverCategory.name = "Whatever";
    whateverCategory.slug = "whatever";
    site.categories.push(whateverCategory);

    var idAddress = server.importSiteData(site);

    browser.go(idAddress.siteIdOrigin);
    // browser.assertTextMatches('body', /login as admin to create something/);

    browser.pause();
  });

});


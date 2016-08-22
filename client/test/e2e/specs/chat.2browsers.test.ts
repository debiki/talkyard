/// <reference path="../test-types.ts"/>
/// <reference path="../../../../modules/definitely-typed/lodash/lodash.d.ts"/>
/// <reference path="../../../../modules/definitely-typed/mocha/mocha.d.ts"/>

import * as _ from 'lodash';
import server = require('../utils/server');
import utils = require('../utils/utils');
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import make = require('../utils/make');
import logAndDie = require('../utils/log-and-die');
var logUnusual = logAndDie.logUnusual, die = logAndDie.die, dieIf = logAndDie.dieIf;
var logMessage = logAndDie.logMessage;

declare var browser: any;
declare var browserA: any;
declare var browserB: any;

var everyone;
var owen;
var owensPages;
var maria;
var mariasPages;


describe('chat', function() {

  it('create site with two members', function() {
    everyone = browser;
    owen = browserA;
    owensPages = pagesFor(owen);
    maria = browserB;
    mariasPages = pagesFor(maria);

    var site: SiteData = make.emptySiteOwnedByOwen();
    site.meta.localHostname = 'chat-' + Date.now();

    site.members.push(make.memberMaria());

    // Dupl test code below [6FKR4D0]
    var rootCategoryId = 1;

    var forumPage = make.page({
      id: 'fmp',
      role: <PageRole> 7,  // [commonjs] PageRole.Forum
      categoryId: rootCategoryId,
      authorId: -1,    // [commonjs] SystemUserId   [5KGEP02]
    });
    site.pages.push(forumPage);

    site.pagePaths.push({ folder: '/', pageId: forumPage.id, showId: false, slug: '' });

    site.posts.push(make.post({
      page: forumPage,
      nr: 0,
      approvedSource: "Forum Title",
      approvedHtmlSanitized: "Forum Title",
    }));

    site.posts.push(make.post({
      page: forumPage,
      nr: 1,
      approvedSource: "Forum intro text.",
      approvedHtmlSanitized: "<p>Forum intro text.</p>",
    }));

    var rootCategory = make.rootCategoryWithIdFor(rootCategoryId, forumPage);
    rootCategory.defaultChildId = 2;
    site.categories.push(rootCategory);

    var uncategorizedCategory = make.categoryWithIdFor(2, forumPage);
    uncategorizedCategory.parentId = rootCategory.id;
    uncategorizedCategory.name = "Uncatigorized";
    uncategorizedCategory.slug = "uncatigorized";
    uncategorizedCategory.description = "The uncategorized category";
    site.categories.push(uncategorizedCategory);

    var idAddress = server.importSiteData(site);
    everyone.go(idAddress.siteIdOrigin);
  });

  it("Owen logs in, creates a chat topic", function() {
    owen.waitAndClick('#e2eCreateChatB');
    owensPages.loginDialog.loginWithPassword({ username: 'owen_owner', password: 'publicOwen' });
    owen.waitAndSetValue('.esEdtr_titleEtc_title', "Chat channel title");
    owen.setValue('textarea', "Chat channel purpose");
    owen.rememberCurrentUrl();
    owen.waitAndClick('.e2eSaveBtn');
    owen.waitForNewUrl();
    owen.waitAndClick('#theJoinChatB');
  });

  it("Owen writes a chat message", function() {
    owen.waitAndSetValue('.esC_Edtr_textarea', "Hi, I'm Owen, and my name is Owen.");
    owen.waitAndClick('.esC_Edtr_SaveB');
    owen.waitForVisible('.esC_M');
    owen.assertTextMatches('.esC_M', /Owen/);
  });

  it("Maria opens the chat page, sees Owens message", function() {
    maria.go(owen.url().value);
    owen.assertTextMatches('.esC_M', /Owen/);
  });

  it("Maria joins the chat topic", function() {
    maria.waitAndClick('#theJoinChatB');
    mariasPages.loginDialog.loginWithPassword({ username: 'maria', password: 'publicMaria' });
  });

  it("Maria posts a chat message, and sees it", function() {
    maria.waitAndSetValue('.esC_Edtr_textarea', "Hi, I'm Maria.");
    maria.waitAndClick('.esC_Edtr_SaveB');
    maria.assertNthTextMatches('.esC_M', 2, /Maria/);
  });

  it("Owen sees it", function() {
    //owen.waitForVisible('.esC_M:nth-child(2)');  <-- nth-child apparently not yet supported
    //owen.assertTextMatches('.esC_M:nth-child(2)', /Maria/);
    owen.assertNthTextMatches('.esC_M', 2, /Maria/);
  });

  it("Owen posts a chat message, and sees it", function() {
    owen.waitAndSetValue('.esC_Edtr_textarea', "Hi, and is your name Maria?");
    owen.waitAndClick('.esC_Edtr_SaveB');
    owen.assertNthTextMatches('.esC_M', 3, /is your name/);
  });

  it("Maria sees it", function() {
    maria.assertNthTextMatches('.esC_M', 3, /is your name/);
  });

  it("Done?", function() {
    everyone.perhapsDebug();
  });
});


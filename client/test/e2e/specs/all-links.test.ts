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
import c = require('../test-constants');
var logUnusual = logAndDie.logUnusual, die = logAndDie.die, dieIf = logAndDie.dieIf;
var logMessage = logAndDie.logMessage;
var SystemUserId = 1;  // [commonjs]

declare var browser: any;


describe('all links', function() {


  it('create site with all links', function() {
    let site: SiteData = make.emptySiteOwnedByOwen();
    site.members.push(make.memberAdminAdam());
    site.members.push(make.memberAdminAlice());
    site.members.push(make.memberModeratorMons());
    site.members.push(make.memberMaria());
    site.guests.push(make.guestGreta());
    site.guests.push(make.guestGunnar());

    // later?: site.pagePaths.push(make.path('/', 'fmp'));

    // Dupl test code below [6FKR4D0]
    var rootCategoryId = 1;

    var forumPage = make.page({
      id: 'fmp',
      role: c.TestPageRole.Forum,
      categoryId: rootCategoryId,
      authorId: SystemUserId,
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
    rootCategory.defaultCategoryId = 2;
    site.categories.push(rootCategory);

    var uncategorizedCategory = make.categoryWithIdFor(2, forumPage);
    uncategorizedCategory.parentId = rootCategory.id;
    uncategorizedCategory.name = "Uncatigorized";
    uncategorizedCategory.slug = "uncatigorized";
    uncategorizedCategory.description = "The uncategorized category";
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


    var whateverTopic = make.page({
      id: 'whateverTopic',
      role: c.TestPageRole.Discussion,
      categoryId: whateverCategory.id,
      authorId: SystemUserId,
    });
    site.pages.push(whateverTopic);

    site.pagePaths.push({ folder: '/', pageId: whateverTopic.id, showId: true,
        slug: 'whatever-topic-title' });

    function addPost(data: NewTestPost) {
      site.posts.push(make.post(data));
    }
    addPost({ page: whateverTopic, nr: 0, approvedSource: "Whatever Topic Title", });  // title
    addPost({ page: whateverTopic, nr: 1, approvedSource: "Whatever topic text.", });  // body
    addPost({ page: whateverTopic, nr: 11, parentNr: 1, approvedSource: "Reply 11.", });
    addPost({ page: whateverTopic, nr: 111, parentNr: 11, approvedSource: "Reply 111." });
    addPost({ page: whateverTopic, nr: 12, parentNr: 1, approvedSource: "Reply 12.", });
    addPost({ page: whateverTopic, nr: 13, parentNr: 1, approvedSource: "Reply 13.", });
    addPost({ page: whateverTopic, nr: 14, parentNr: 1, approvedSource: "Reply 14.", });


    var questionTopic = make.page({
      id: 'questionTopic',
      role: c.TestPageRole.Question,
      categoryId: whateverCategory.id,
      authorId: SystemUserId,
      // answerPostId
    });
    site.pages.push(questionTopic);

    site.pagePaths.push({ folder: '/', pageId: questionTopic.id, showId: true,
      slug: 'question-topic-title' });

    addPost({ page: questionTopic, nr: 0, approvedSource: "Question?", });  // title
    addPost({ page: questionTopic, nr: 1, approvedSource: "Can this or what where why or no?", });
    addPost({ page: questionTopic, nr: 11, parentNr: 1, approvedSource: "Answer 11.", });
    addPost({ page: questionTopic, nr: 111, parentNr: 11, approvedSource: "Comment 111." });
    addPost({ page: questionTopic, nr: 12, parentNr: 1, approvedSource: "Answer 12.", });
    addPost({ page: questionTopic, nr: 13, parentNr: 1, approvedSource: "Answer 13.", });
    addPost({ page: questionTopic, nr: 14, parentNr: 1, approvedSource: "Answer 14.", });


    var idAddress = server.importSiteData(site);
    browser.go(idAddress.origin);
    // browser.assertTextMatches('body', /login as admin to create something/);

    browser.perhapsDebug();
  });

  describe("click all stuff on the forum page", function() {
    it("as a stranger", function() {
    });
    it("as a guest", function() {
    });
    it("as a member", function() {
    });
    it("as staff", function() {
    });
  });
});


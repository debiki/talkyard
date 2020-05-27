/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import server = require('../utils/server');
import assert = require('assert');
import utils = require('../utils/utils');
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import make = require('../utils/make');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');
const SystemUserId = 1;  // [commonjs]

let browser: TyE2eTestBrowser;


describe('all links', function() {


  it('create site with all links', function() {
    browser = new TyE2eTestBrowser(wdioBrowser);
    let site: SiteData = make.emptySiteOwnedByOwen();
    site.members.push(make.memberAdminAdam());
    site.members.push(make.memberAdminAlice());
    site.members.push(make.memberModeratorMons());
    site.members.push(make.memberMaria());
    site.guests.push(make.guestGreta());
    site.guests.push(make.guestGunnar());

    // later?: site.pagePaths.push(make.path('/', c.FirstPageId));

    // Dupl test code below [6FKR4D0]
    var rootCategoryId = 1;

    var forumPage = make.page({
      id: c.FirstPageId,
      role: c.TestPageRole.Forum,
      categoryId: rootCategoryId,
      authorId: SystemUserId,
    });
    site.pages.push(forumPage);

    site.pagePaths.push({ folder: '/', pageId: forumPage.id, showId: false, slug: '', canonical: true });

    site.posts.push(make.post({
      page: forumPage,
      nr: c.TitleNr,
      approvedSource: "Forum Title",
      approvedHtmlSanitized: "Forum Title",
    }));

    site.posts.push(make.post({
      page: forumPage,
      nr: c.BodyNr,
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
        slug: 'whatever-topic-title', canonical: true });

    function addPost(data: NewTestPost) {
      site.posts.push(make.post(data));
    }
    addPost({ page: whateverTopic, nr: c.TitleNr, approvedSource: "Whatever Topic Title", });
    addPost({ page: whateverTopic, nr: c.BodyNr, approvedSource: "Whatever topic text.", });
    addPost({ page: whateverTopic, nr: 11, parentNr: c.BodyNr, approvedSource: "Reply 11.", });
    addPost({ page: whateverTopic, nr: 111, parentNr: 11, approvedSource: "Reply 111." });
    addPost({ page: whateverTopic, nr: 12, parentNr: c.BodyNr, approvedSource: "Reply 12.", });
    addPost({ page: whateverTopic, nr: 13, parentNr: c.BodyNr, approvedSource: "Reply 13.", });
    addPost({ page: whateverTopic, nr: 14, parentNr: c.BodyNr, approvedSource: "Reply 14.", });


    var questionTopic = make.page({
      id: 'questionTopic',
      role: c.TestPageRole.Question,
      categoryId: whateverCategory.id,
      authorId: SystemUserId,
      // answerPostId
    });
    site.pages.push(questionTopic);

    site.pagePaths.push({ folder: '/', pageId: questionTopic.id, showId: true,
      slug: 'question-topic-title', canonical: true });

    addPost({ page: questionTopic, nr: c.TitleNr, approvedSource: "Question?", });
    addPost({ page: questionTopic, nr: c.BodyNr, approvedSource: "Can this or what where why or no?", });
    addPost({ page: questionTopic, nr: 11, parentNr: c.BodyNr, approvedSource: "Answer 11.", });
    addPost({ page: questionTopic, nr: 111, parentNr: 11, approvedSource: "Comment 111." });
    addPost({ page: questionTopic, nr: 12, parentNr: c.BodyNr, approvedSource: "Answer 12.", });
    addPost({ page: questionTopic, nr: 13, parentNr: c.BodyNr, approvedSource: "Answer 13.", });
    addPost({ page: questionTopic, nr: 14, parentNr: c.BodyNr, approvedSource: "Answer 14.", });


    var idAddress = server.importSiteData(site);
    browser.go(idAddress.origin);
    // browser.assertTextMatches('body', /login as admin to create something/);
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


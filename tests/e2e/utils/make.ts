/// <reference path="../test-types.ts"/>
/// <reference path="../../../modules/definitely-typed/lodash/lodash.d.ts"/>
/// <reference path="../../../modules/definitely-typed/node/node.d.ts"/>
import settings = require('./settings');
import log = require('./log-and-die');
declare function require(...whatever): any;

import _ = require('lodash');
import assert = require('assert');
import c = require('../test-constants');

var DefaultCreatedAtMs = 1449198824000;
var SystemUserId = 1; // [commonjs]

var nextPostId = 101;
function getAndBumpNextPostId() {
  nextPostId += 1;
  return nextPostId - 1;
}

var nextUserId = 101;
function getAndBumpNextUserId() {
  nextUserId += 1;
  return nextUserId - 1;
}

let localHostname = settings.localHostname || 'e2e-test-site';

let emptySite: SiteData = {
  meta: {
    id: null,
    name: localHostname + '-' + Date.now(),
    localHostname: localHostname,
    creatorEmailAddress: "e2e-test--owner@example.com",
    status: 2,
    createdAtMs: DefaultCreatedAtMs,
  },
  settings: {
    companyFullName: "E2E Test Org",
  },
  groups: [],
  members: [],
  identities: [],
  guests: [],
  blocks: [],
  invites: [],
  categories: [],
  pages: [],
  pagePaths: [],
  posts: [],
  emailsOut: [],
  notifications: [],
  uploads: [],
  auditLog: [],
  reviewTasks: [],
};


var make = {
  emptySiteOwnedByOwen: function(): SiteData {
    var site = _.cloneDeep(emptySite);
    var owner = make.memberOwenOwner();
    site.members.push(owner);
    site.meta.creatorEmailAddress = owner.emailAddress;
    return site;
  },

  memberOwenOwner: function(): Member {
    return {
      id: getAndBumpNextUserId(),
      username: "owen_owner",
      fullName: "Owen Owner",
      createdAtMs: DefaultCreatedAtMs,
      emailAddress: "e2e-test--owen-owner@example.com",
      emailVerifiedAtMs: DefaultCreatedAtMs,
      passwordHash: "cleartext:publicOwen123",
      password: "publicOwen123",
      isOwner: true,
      isAdmin: true,
    };
  },

  memberAdminAdam: function(): Member {
    return {
      id: getAndBumpNextUserId(),
      username: "admin_adam",
      fullName: "Admin Adam",
      createdAtMs: DefaultCreatedAtMs,
      emailAddress: "admin-adam@ex.com",
      emailVerifiedAtMs: DefaultCreatedAtMs,
      passwordHash: "cleartext:publicAdam123",
      password: "publicAdam123",
      isAdmin: true,
    };
  },

  memberAdminAlice: function(): Member {
    return {
      id: getAndBumpNextUserId(),
      username: "admin_alice",
      fullName: "Admin Alice",
      createdAtMs: DefaultCreatedAtMs,
      emailAddress: "admin-alice@ex.com",
      emailVerifiedAtMs: DefaultCreatedAtMs,
      passwordHash: "cleartext:publicAlice123",
      password: "publicAlice123",
      isAdmin: true,
    };
  },

  memberModeratorModya: function(): Member {
    return {
      id: getAndBumpNextUserId(),
      username: "mod_modya",
      fullName: "Mod Modya",
      createdAtMs: DefaultCreatedAtMs,
      emailAddress: "mod-modya@ex.com",
      emailVerifiedAtMs: DefaultCreatedAtMs,
      passwordHash: "cleartext:publicModya123",
      password: "publicModya123",
      isModerator: true,
    };
  },

  memberModeratorMons: function(): Member {
    return {
      id: getAndBumpNextUserId(),
      username: "mod_mons",
      fullName: "Mod Mons",
      createdAtMs: DefaultCreatedAtMs,
      emailAddress: "mod-mons@ex.com",
      emailVerifiedAtMs: DefaultCreatedAtMs,
      passwordHash: "cleartext:publicMons123",
      password: "publicMons123",
      isModerator: true,
    };
  },

  memberMaja: function(): Member {
    return {
      id: getAndBumpNextUserId(),
      username: "maja",
      fullName: "Maja Gräddnos",
      createdAtMs: DefaultCreatedAtMs,
      emailAddress: "e2e-test--maja@example.com",
      emailVerifiedAtMs: DefaultCreatedAtMs,
      passwordHash: "cleartext:publicMaja123",
      password: "publicMaja123",
    };
  },

  memberMaria: function(): Member {
    return {
      id: getAndBumpNextUserId(),
      username: "maria",
      fullName: "Maria",
      createdAtMs: DefaultCreatedAtMs,
      emailAddress: "e2e-test--maria@example.com",
      emailVerifiedAtMs: DefaultCreatedAtMs,
      passwordHash: "cleartext:publicMaria123",
      password: "publicMaria123",
    };
  },

  memberMichael: function(): Member {
    return {
      id: getAndBumpNextUserId(),
      username: "michael",
      fullName: "Michael",
      createdAtMs: DefaultCreatedAtMs,
      emailAddress: "e2e-test--michael@example.com",
      emailVerifiedAtMs: DefaultCreatedAtMs,
      passwordHash: "cleartext:publicMichael123",
      password: "publicMichael123",
    };
  },

  memberMallory: function(): Member {
    return {
      id: getAndBumpNextUserId(),
      username: "mallory",
      fullName: "Mallory",
      createdAtMs: DefaultCreatedAtMs,
      emailAddress: "mallory@ex.com",
      emailVerifiedAtMs: DefaultCreatedAtMs,
      passwordHash: "cleartext:publicMallory123",
      password: "publicMallory123",
    };
  },

  guestGunnar: function(): TestGuest {
    return {
      id: -10,
      fullName: "Guest Gunnar",
      createdAtMs: DefaultCreatedAtMs,
      emailAddress: "guest-gunnar@ex.com",
      isGuest: true,
    };
  },

  guestGreta: function(): TestGuest {
    return {
      id: -11,
      fullName: "Guest Greta",
      createdAtMs: DefaultCreatedAtMs,
      emailAddress: "guest-greta@ex.com",
      isGuest: true,
    };
  },

  page: function(values: NewPage): Page {
    return {
      id: values.id,
      role: values.role,
      categoryId: values.categoryId,
      authorId: values.authorId,
      createdAtMs: values.createdAtMs || DefaultCreatedAtMs,
      updatedAtMs: values.updatedAtMs || DefaultCreatedAtMs,
      numChildPages: values.numChildPages,
      numRepliesVisible: values.numRepliesVisible,
      numRepliesToReview: values.numRepliesToReview,
      numRepliesTotal: values.numRepliesTotal,
      numLikes: values.numLikes,
      numWrongs: values.numWrongs,
      numBuryVotes: values.numBuryVotes,
      numUnwantedVotes: values.numUnwantedVotes,
      numOpLikeVotes: values.numOpLikeVotes,
      numOpWrongVotes: values.numOpWrongVotes,
      numOpBuryVotes: values.numOpBuryVotes,
      numOpUnwantedVotes: values.numOpUnwantedVotes,
      numOpRepliesVisible: values.numOpRepliesVisible,
      version: values.version || 1,
    }
  },

  pagePath: function(pageId: PageId, folder: string, showId: boolean, slug?: string): PagePathWithId {
    return {
      folder: folder,
      pageId: pageId,
      showId: showId,
      slug: slug || '',
    };
  },

  rootCategoryWithIdFor: function(id: CategoryId, forumPage: Page): TestCategory {
    var category = make.categoryWithIdFor(id, forumPage);
    category.name = "(Root Category)";  // in Scala too [7UKPX5]
    category.slug = "(root-category)";  //
    return category;
  },

  categoryWithIdFor: function(id: CategoryId, forumPage: Page): TestCategory {
    return {
      id: id,
      sectionPageId: forumPage.id,
      parentId: undefined,
      defaultCategoryId: undefined,
      name: "Unnamed Category",
      slug: "unnamed-category",
      position: undefined,
      description: undefined,
      newTopicTypes: undefined,
      defaultTopicType: c.TestPageRole.Discussion,
      createdAtMs: forumPage.createdAtMs,
      updatedAtMs: forumPage.updatedAtMs,
      unlisted: false,
    };
  },

  /*
  category: function(): NewCategoryStuff {
    return {
      category: Category;
      aboutPage: Page;
      aboutPageTitlePost: Post;
      aboutPageBody: Post;
    }
  }, */

  post: function(values: NewTestPost): TestPost {
    var approvedHtmlSanitized = values.approvedHtmlSanitized;
    if (!approvedHtmlSanitized) {
      // Unless it's the title, wrap in <p>.
      approvedHtmlSanitized = values.nr === 0 ?
          values.approvedSource : `<p>${values.approvedSource}</p>`;
    }
    return {
      id: values.id || getAndBumpNextPostId(),
      pageId: values.page.id,
      nr: values.nr,
      parentNr: values.parentNr,
      multireply: undefined,
      createdAtMs: values.page.createdAtMs,
      createdById: values.page.authorId,
      currRevStartedAtMs: values.page.createdAtMs,
      currRevLastEditedAtMs: undefined,
      currRevById: values.page.authorId,
      lastApprovedEditAtMs: undefined,
      lastApprovedEditById: undefined,
      numDistinctEditors: 1,
      numEditSuggestions: undefined,
      lastEditSuggestionAtMs: undefined,
      safeRevNr: undefined,
      approvedSource: values.approvedSource,
      approvedHtmlSanitized: approvedHtmlSanitized,
      approvedAtMs: values.page.createdAtMs,
      approvedById: SystemUserId,
      approvedRevNr: 1,
      currRevSourcePatch: undefined,
      currRevNr: 1,
      deletedStatus: undefined,
      deletedAtMs: undefined,
      deletedById: undefined,
      numPendingFlags: undefined,
      numHandledFlags: undefined,
      numLikeVotes: undefined,
      numWrongVotes: undefined,
      numTimesRead: undefined,
      numBuryVotes: undefined,
      numUnwantedVotes: undefined,
      type: undefined,
      prevRevNr: undefined,
    };
  },

  findForumPage: function(pages: Page[]): Page {
    for (let i = 0; i < pages.length; ++i) {
      let page = pages[i];
      if (page.role === c.TestPageRole.Forum)
        return page;
    }
    log.die('EdE2KW055');
  },

  forumOwnedByOwen: function(name: string, options?): SiteData {
    let site: SiteData = make.emptySiteOwnedByOwen();
    let now = Date.now();
    site.meta.localHostname = site.meta.localHostname || 'e2e-test-' + now;
    site.meta.name = 'e2e-test-' + name + '-' + now;

    options = options || {};

    // Dupl test code below [6FKR4D0]
    var rootCategoryId = 1;

    var forumPage = make.page({
      id: 'fmp',
      role: c.TestPageRole.Forum,
      categoryId: rootCategoryId,
      authorId: 1,    // [commonjs] SystemUserId
    });
    site.pages.push(forumPage);

    site.pagePaths.push({ folder: '/', pageId: forumPage.id, showId: false, slug: '' });

    // Forum title and intro text page.
    site.posts.push(make.post({
      page: forumPage,
      nr: 0,
      approvedSource: options.title || "Forum Title",
      approvedHtmlSanitized: options.title || "Forum Title",
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
    uncategorizedCategory.name = "Uncategorized";
    uncategorizedCategory.slug = "uncategorized";
    uncategorizedCategory.description = "The default category.";
    site.categories.push(uncategorizedCategory);

    return site;
  },

  // Creates this:
  //
  // - owner Owen
  // - moderator Modya
  // - moderator Mons
  // - member Maria
  // - member Michael
  // - member Mallory
  // - guest Gunnar
  //
  // - category DeletedCategory
  //   - topic About-DeletedCategory
  //   - topic TopicInDeletedCategory-by-Owen
  //   - topic TopicInDeletedCategory-by-Modya
  //   - topic TopicInDeletedCategory-by-Maria (-reply-by-Michael)
  //   - topic TopicInDeletedCategory-by-Guest
  // - category UnlistedCategory
  //   - topic About-UnlistedCategory
  //   - topic TopicInUnlistedCategory-by-Owen
  //   - topic TopicInUnlistedCategory-by-Modya
  //   - topic TopicInUnlistedCategory-by-Maria (-reply-by-Michael)
  //   - topic TopicInUnlistedCategory-by-Guest — category was unlisted after topic created
  // - category StaffOnlyCategory
  //   - topic About-StaffOnlyCategory
  //   - topic TopicInStaffOnlyCategory-by-Owen
  //   - topic TopicInStaffOnlyCategory-by-Modya
  //   - topic TopicInStaffOnlyCategory-by-Maria (-reply-by-Michael)
  //   - topic TopicInStaffOnlyCategory-by-Guest — category made staff-only after topic created
  // - category CategoryA
  //   - topic About-CategoryA
  //   - topic TopicInCategoryA-by-Owen
  //   - topic TopicInCategoryA-by-Modya
  //   - topic TopicInCategoryA-by-Maria (-reply-by-Michael)
  //   - topic TopicInCategoryA-by-Guest
  //   - topic DeletedTopicInCategoryA-by-Maria (-reply-by-Michael)
  //   - topic FlaggedHiddenTopicInCategoryA-by-Mallory
  // - category CategoryB
  //   - topic About-CategoryB
  //   - topic TopicInCategoryB-by-Owen
  //   - topic TopicInCategoryB-by-Modya
  //   - topic TopicInCategoryB-by-Maria
  //   - topic TopicInCategoryB-by-Guest
  //
  // - private message from Maria to Michael
  // - private message from Maria to Modya   (only Modya and Owen can see it)
  //
  // - topic TopicInNoCategory-by-Michael
  //
  /*
  largeForumOwnedByOwen: function(name: string, options?): SiteBuilder {
    let site = make.forumOwnedByOwen(name, options);

    var modya = make.memberModeratorModya();
    site.members.push(modya);

    let rootCategoryId = 1;

    let deletedCategory = site_addCategory(site, {
      id: 3,
      parentId: rootCategoryId,
      name: 'DeletedCategory',
      slug: 'deleted-category',
      description: 'This category has been deleted.',
      deleted: true,
    });

    site_addPage(site, {
      categoryId: deletedCategory.id,
      pageId: '',
      pageRole: '',
      folder: '',
      slug: '',
      authorId: '',
      title: '',
      body: '',
    });

    return site;
  } */
};


export = make;

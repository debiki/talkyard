/// <reference path="../test-types.ts"/>
/// <reference path="../../../../modules/definitely-typed/lodash/lodash.d.ts"/>
/// <reference path="../../../../modules/definitely-typed/node/node.d.ts"/>
declare function require(...whatever): any;

import _ = require('lodash');
import assert = require('assert');

var DefaultCreatedAtMs = 1449198824000;
var SystemUserId = -1;

var nextPostId = 101;
function getAndBumpNextPostId() {
  nextPostId += 1;
  return nextPostId - 1;
}

var emptySite: SiteData = {
  meta: {
    id: null,
    localHostname: null,
    creatorEmailAddress: "e2e-test-owner@ex.com",
    status: 2,
    createdAtMs: DefaultCreatedAtMs,
  },
  settings: [],
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
      id: 101,
      username: "owen_owner",
      fullName: "Owen Owner",
      createdAtMs: DefaultCreatedAtMs,
      emailAddress: "owen-owner@ex.com",
      emailVerifiedAtMs: DefaultCreatedAtMs,
      passwordHash: "cleartext:publicOwen",
      isOwner: true,
      isAdmin: true,
    };
  },

  memberAdminAdam: function(): Member {
    return {
      id: 201,
      username: "admin_adam",
      fullName: "Admin Adam",
      createdAtMs: DefaultCreatedAtMs,
      emailAddress: "admin-adam@ex.com",
      emailVerifiedAtMs: DefaultCreatedAtMs,
      passwordHash: "cleartext:publicAdam",
      isAdmin: true,
    };
  },

  memberAdminAlice: function(): Member {
    return {
      id: 201,
      username: "admin_alice",
      fullName: "Admin Alice",
      createdAtMs: DefaultCreatedAtMs,
      emailAddress: "admin-alice@ex.com",
      emailVerifiedAtMs: DefaultCreatedAtMs,
      passwordHash: "cleartext:publicAlice",
      isAdmin: true,
    };
  },

  memberModeratorModya: function(): Member {
    return {
      id: 201,
      username: "mod_modya",
      fullName: "Mod Modya",
      createdAtMs: DefaultCreatedAtMs,
      emailAddress: "mod-modya@ex.com",
      emailVerifiedAtMs: DefaultCreatedAtMs,
      passwordHash: "cleartext:publicModya",
      isModerator: true,
    };
  },

  memberModeratorMons: function(): Member {
    return {
      id: 201,
      username: "mod_mons",
      fullName: "Mod Mons",
      createdAtMs: DefaultCreatedAtMs,
      emailAddress: "mod-mons@ex.com",
      emailVerifiedAtMs: DefaultCreatedAtMs,
      passwordHash: "cleartext:publicMons",
      isModerator: true,
    };
  },

  memberMaria: function(): Member {
    return {
      id: 201,
      username: "maria",
      fullName: "Maria",
      createdAtMs: DefaultCreatedAtMs,
      emailAddress: "maria@ex.com",
      emailVerifiedAtMs: DefaultCreatedAtMs,
      passwordHash: "cleartext:publicMaria",
    };
  },

  memberMichael: function(): Member {
    return {
      id: 201,
      username: "michael",
      fullName: "Michael",
      createdAtMs: DefaultCreatedAtMs,
      emailAddress: "michael@ex.com",
      emailVerifiedAtMs: DefaultCreatedAtMs,
      passwordHash: "cleartext:publicMichael",
    };
  },

  memberMallory: function(): Member {
    return {
      id: 201,
      username: "mallory",
      fullName: "Mallory",
      createdAtMs: DefaultCreatedAtMs,
      emailAddress: "mallory@ex.com",
      emailVerifiedAtMs: DefaultCreatedAtMs,
      passwordHash: "cleartext:publicMallory",
    };
  },

  guestGunnar: function(): TestGuest {
    return {
      id: 201,
      fullName: "Guest Gunnar",
      createdAtMs: DefaultCreatedAtMs,
      emailAddress: "guest-gunnar@ex.com",
      isGuest: true,
    };
  },

  guestGreta: function(): TestGuest {
    return {
      id: 201,
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
      defaultTopicType: 12, // PageRole.Discussion,
      createdAtMs: forumPage.createdAtMs,
      updatedAtMs: forumPage.updatedAtMs,
      hideInForum: false,
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
      approvedById: -1, // [commonjs]
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

  forumOwnedByOwen: function(namePrefix: string): SiteData {
    var site: SiteData = make.emptySiteOwnedByOwen();
    site.meta.localHostname = namePrefix + Date.now();

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

    // Forum title and intro text page.
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
    uncategorizedCategory.name = "Uncategorized";
    uncategorizedCategory.slug = "uncategorized";
    uncategorizedCategory.description = "The default category.";
    site.categories.push(uncategorizedCategory);

    return site;
  }
};


export = make;

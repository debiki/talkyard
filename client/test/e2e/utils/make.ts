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

  memberMons: function(): Member {
    return {
      id: 201,
      username: "mons",
      fullName: "Mons",
      createdAtMs: DefaultCreatedAtMs,
      emailAddress: "mons@ex.com",
      emailVerifiedAtMs: DefaultCreatedAtMs,
      passwordHash: "cleartext:publicMons",
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
      defaultChildId: undefined,
      name: "Unnamed Category",
      slug: "unnamed-category",
      position: undefined,
      description: undefined,
      newTopicTypes: undefined,
      defaultTopicType: PageRole.Discussion,
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
  }
};


export = make;

/// <reference path="../test-types2.ts"/>
/// <reference path="../../../to-talkyard/src/to-talkyard.d.ts" />

import * as log from './log-and-die';

import * as _ from 'lodash';
import c from '../test-constants';
import * as utils from './utils';


// This is 2015-12-04T03:13:44+00:00, hmm, why?
export const DefaultCreatedAtMs = 1449198824000;


let nextPostId = 101;
function getAndBumpNextPostId() {
  nextPostId += 1;
  return nextPostId - 1;
}


let nextUserId = 101;
function getAndBumpNextUserId() {
  nextUserId += 1;
  return nextUserId - 1;
}


function makeEmptySite(ps: { okInitEarly?: boolean } = {}): SiteData {
  log.dieAndExitIf(!(global as any).wdioBeforeHookHasRun && !ps.okInitEarly,
      "Calling makeEmptySite() before the wdio.conf.ts before() hook has run — " +
      "that means this spec hasn't been inited properly yet; variables might be " +
      "`undefined` [TyE8503SKDS46]");

  // Don't call getLocalHostname() too early (outside this function), because
  // it accesses global.__thisSpecLocalHostname which would be undefined.
  const localHostname = utils.getLocalHostname();

  return {
  meta: {
    id: undefined,
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
  permsOnPages: [],
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
}};


export function emptySiteOwnedByOwen(ps: { okInitEarly?: boolean } = {}): SiteData {
    const site = _.cloneDeep(makeEmptySite(ps));
    const owner = memberOwenOwner();
    site.members.push(owner);
    site.meta.creatorEmailAddress = owner.emailAddress;
    return site;
}


export function memberOwenOwner(template: Partial<Member> = {}): Member {
    return {
      ...template,
      id: getAndBumpNextUserId(),
      username: "owen_owner",
      fullName: "Owen Owner",
      createdAtMs: DefaultCreatedAtMs,
      emailAddress: "e2e-test--owen-owner@example.com",
      emailVerifiedAtMs: DefaultCreatedAtMs,
      passwordHash: "cleartext:pub-owe020",
      password: "pub-owe020",
      isOwner: true,
      isAdmin: true,
    };
}


export function memberAdminAdam(template: Partial<Member> = {}): Member {
    return {
      ...template,
      id: getAndBumpNextUserId(),
      username: "admin_adam",
      fullName: "Admin Adam",
      createdAtMs: DefaultCreatedAtMs,
      emailAddress: "e2e-test--admin-adam@example.com",
      emailVerifiedAtMs: DefaultCreatedAtMs,
      passwordHash: "cleartext:pub-ada020",
      password: "pub-ada020",
      isAdmin: true,
    };
}


export function memberAdminAlice(template: Partial<Member> = {}): Member {
    return {
      ...template,
      id: getAndBumpNextUserId(),
      username: "admin_alice",
      fullName: "Admin Alice",
      createdAtMs: DefaultCreatedAtMs,
      emailAddress: "e2e-test--admin-alice@example.com",
      emailVerifiedAtMs: DefaultCreatedAtMs,
      passwordHash: "cleartext:pub-ali020",
      password: "pub-ali020",
      isAdmin: true,
    };
}


export function memberModeratorModya(template: Partial<Member> = {}): Member {
    return {
      ...template,
      id: getAndBumpNextUserId(),
      username: "mod_modya",
      fullName: "Mod Modya",
      createdAtMs: DefaultCreatedAtMs,
      emailAddress: "e2e-test--mod-modya@example.com",
      emailVerifiedAtMs: DefaultCreatedAtMs,
      passwordHash: "cleartext:pub-mod020",
      password: "pub-mod020",
      isModerator: true,
    };
}


export function memberModeratorMons(template: Partial<Member> = {}): Member {
    return {
      ...template,
      id: getAndBumpNextUserId(),
      username: "mod_mons",
      fullName: "Mod Mons",
      createdAtMs: DefaultCreatedAtMs,
      emailAddress: "e2e-test--mod-mons@example.com",
      emailVerifiedAtMs: DefaultCreatedAtMs,
      passwordHash: "cleartext:pub-mon020",
      password: "pub-mon020",
      isModerator: true,
    };
}


export function memberMaja(template: Partial<Member> = {}): Member {
    return {
      ...template,
      id: getAndBumpNextUserId(),
      username: "maja",
      fullName: "Maja Gräddnos",
      createdAtMs: DefaultCreatedAtMs,
      emailAddress: "e2e-test--maja@example.com",
      emailVerifiedAtMs: DefaultCreatedAtMs,
      passwordHash: "cleartext:pub-maj020",
      password: "pub-maj020",
    };
}


export function memberMemah(template: Partial<Member> = {}): Member {
    return {
      ...template,
      id: getAndBumpNextUserId(),
      username: "memah",
      fullName: "Memah",
      createdAtMs: DefaultCreatedAtMs,
      emailAddress: "e2e-test--memah@example.com",
      emailVerifiedAtMs: DefaultCreatedAtMs,
      passwordHash: "cleartext:pub-mem020",
      password: "pub-mem020",
    };
}


export function memberMaria(template: Partial<Member> = {}): Member {
    return {
      ...template,
      id: getAndBumpNextUserId(),
      username: "maria",
      fullName: "Maria",
      createdAtMs: DefaultCreatedAtMs,
      emailAddress: "e2e-test--maria@example.com",
      emailVerifiedAtMs: DefaultCreatedAtMs,
      passwordHash: "cleartext:pub-mar020",
      password: "pub-mar020",
    };
}


export function memberMerche(template: Partial<Member> = {}): Member {
    return {
      ...template,
      id: getAndBumpNextUserId(),
      username: "merche",
      fullName: "Merche",
      createdAtMs: DefaultCreatedAtMs,
      emailAddress: "e2e-test--merche@example.com",
      emailVerifiedAtMs: DefaultCreatedAtMs,
      passwordHash: "cleartext:pub-mer020",
      password: "pub-mer020",
    };
}


export function memberMeilani(template: Partial<Member> = {}): Member {
    return {
      ...template,
      id: getAndBumpNextUserId(),
      username: "meilani",
      fullName: "Meilani",
      createdAtMs: DefaultCreatedAtMs,
      emailAddress: "e2e-test--meilani@example.com",
      emailVerifiedAtMs: DefaultCreatedAtMs,
      passwordHash: "cleartext:pub-mei020",
      password: "pub-mei020",
    };
}


export function memberMichael(template: Partial<Member> = {}): Member {
    return {
      ...template,
      id: getAndBumpNextUserId(),
      username: "michael",
      fullName: "Michael",
      createdAtMs: DefaultCreatedAtMs,
      emailAddress: "e2e-test--michael@example.com",
      emailVerifiedAtMs: DefaultCreatedAtMs,
      passwordHash: "cleartext:pub-mic020",
      password: "pub-mic020",
    };
}


export function memberTrillian(template: Partial<Member> = {}): Member {
    return {
      ...template,
      id: getAndBumpNextUserId(),
      username: "trillian",
      fullName: "Trillian Trusted Member",
      createdAtMs: DefaultCreatedAtMs,
      emailAddress: "e2e-test--trillian@example.com",
      emailVerifiedAtMs: DefaultCreatedAtMs,
      passwordHash: "cleartext:pub-tri020",
      password: "pub-tri020",
      trustLevel: c.TestTrustLevel.Trusted,
    };
}


export function memberRegina(template: Partial<Member> = {}): Member {
    return {
      ...template,
      id: getAndBumpNextUserId(),
      username: "regina",
      fullName: "Regina Regular Member",
      createdAtMs: DefaultCreatedAtMs,
      emailAddress: "e2e-test--regina@example.com",
      emailVerifiedAtMs: DefaultCreatedAtMs,
      passwordHash: "cleartext:pub-reg020",
      password: "pub-reg020",
      trustLevel: c.TestTrustLevel.Regular,
    };
}


export function memberCorax(template: Partial<Member> = {}): Member {
    return {
      ...template,
      id: getAndBumpNextUserId(),
      username: "Corax",
      fullName: "Corax Core Member",
      createdAtMs: DefaultCreatedAtMs,
      emailAddress: "e2e-test--corax@example.com",
      emailVerifiedAtMs: DefaultCreatedAtMs,
      passwordHash: "cleartext:pub-cor020",
      password: "pub-cor020",
      trustLevel: c.TestTrustLevel.CoreMember,
    };
}


export function memberMallory(template: Partial<Member> = {}): Member {
    return {
      ...template,
      id: getAndBumpNextUserId(),
      username: "mallory",
      fullName: "Malicious Mallory",
      createdAtMs: DefaultCreatedAtMs,
      emailAddress: "e2e-test--mallory@example.com",
      emailVerifiedAtMs: DefaultCreatedAtMs,
      passwordHash: "cleartext:pub-mal020",
      password: "pub-mal020",
    };
}


export function member(username: string, template: Partial<Member> = {}): Member {
    return {
      ...template,
      id: getAndBumpNextUserId(),
      username,
      fullName: undefined,
      createdAtMs: DefaultCreatedAtMs,
      emailAddress: `e2e-test--${username}@example.com`,
      emailVerifiedAtMs: DefaultCreatedAtMs,
      passwordHash: 'cleartext:pub-mem020',
      password: 'pub-mem020',
    };
}


export function minion(ps: { oneWordNameAndNumber: string,
          mixedCaseUsernameStartWithUpper: boolean }): Member {
    const nameLowercase = ps.oneWordNameAndNumber.toLowerCase();
    return {
      id: getAndBumpNextUserId(),
      username: ps.mixedCaseUsernameStartWithUpper
          ? `Minion_${ps.oneWordNameAndNumber}`
          : `minion_${nameLowercase}`,
      fullName: `Minion ${ps.oneWordNameAndNumber}`,
      createdAtMs: DefaultCreatedAtMs,
      emailAddress: `e2e-test--minion-${nameLowercase}@example.com`,
      emailVerifiedAtMs: DefaultCreatedAtMs,
      passwordHash: "cleartext:pub-min020",
      password: "pub-min020",
    };
}


export function guestGunnar(): TestGuest {
    return {
      id: -10,
      fullName: "Guest Gunnar",
      createdAtMs: DefaultCreatedAtMs,
      emailAddress: "e2e-test--guest-gunnar@example.com",
      guestBrowserId: 'guestBrowserIdGunnar',
      isGuest: true,
    };
}


export function guestGreta(): TestGuest {
    return {
      id: -11,
      fullName: "Guest Greta",
      createdAtMs: DefaultCreatedAtMs,
      emailAddress: "e2e-test--guest-greta@example.com",
      guestBrowserId: 'guestBrowserIdGreta',
      isGuest: true,
    };
}


export function page(values: PageToMake): Page {
    return <any> {
      id: values.id,
      role: values.role,
      categoryId: values.categoryId,
      authorId: values.authorId,
      createdAtMs: values.createdAtMs || DefaultCreatedAtMs,
      updatedAtMs: values.updatedAtMs || values.createdAtMs || DefaultCreatedAtMs,
      publishedAtMs: values.publishedAtMs,
      bumpedAtMs: values.bumpedAtMs,
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
    };
}


export function pagePath(pageId: PageId, folder: string, showId: boolean, slug?: string): PagePathWithId {
    return {
      folder: folder,
      pageId: pageId,
      showId: showId,
      slug: slug || '',
      canonical: true,
    };
}


export function rootCategoryWithIdFor(id: CategoryId, forumPage: PageIdWhen): TestCategory {
    const category = categoryWithIdFor(id, forumPage);
    category.name = "(Root Category)";    // in Scala too [7UKPX5]
    category.slug =  `__root_cat_${id}`; //
    return category;
}


export function categoryWithIdFor(id: CategoryId, forumPage: PageIdWhen): TestCategory {
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
      unlistCategory: false,
      unlistTopics: false,
    };
}


export function post(values: NewTestPost): TestPost {
    let approvedHtmlSanitized = values.approvedHtmlSanitized;
    if (!approvedHtmlSanitized) {
      // Unless it's the title, wrap in <p>.
      approvedHtmlSanitized = values.nr === c.TitleNr ?
          values.approvedSource : `<p>${values.approvedSource}</p>`;
    }
    const authorId = values.authorId || values.page.authorId;
    return {
      id: values.id || getAndBumpNextPostId(),
      pageId: values.page.id,
      nr: values.nr,
      parentNr: values.parentNr,
      multireply: undefined,
      createdAtMs: values.page.createdAtMs,
      createdById: authorId,
      currRevStartedAtMs: values.page.createdAtMs,
      currRevLastEditedAtMs: undefined,
      currRevById: authorId,
      lastApprovedEditAtMs: undefined,
      lastApprovedEditById: undefined,
      numDistinctEditors: 1,
      numEditSuggestions: undefined,
      lastEditSuggestionAtMs: undefined,
      safeRevNr: undefined,
      approvedSource: values.approvedSource,
      approvedHtmlSanitized: approvedHtmlSanitized,
      approvedAtMs: values.page.createdAtMs,
      approvedById: c.SystemUserId,
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
      postType: values.postType,
      prevRevNr: undefined,
    };
}


export function findForumPage(pages: Page[]): Page {
    for (let i = 0; i < pages.length; ++i) {
      const page = pages[i];
      if (page.role === c.TestPageRole.Forum)
        return page;
    }
    log.die('EdE2KW055');
}


export function forumOwnedByOwen(name: string, options?: { title?: string }): SiteData {
    const site: SiteData = emptySiteOwnedByOwen();
    const now = Date.now();
    site.meta.localHostname = site.meta.localHostname || 'e2e-test-' + now;
    site.meta.name = 'e2e-test-' + name + '-' + now;

    options = options || {};

    // Dupl test code below [6FKR4D0]
    const rootCategoryId = 1;

    const forumPage = page({
      id: c.FirstPageId,
      role: c.TestPageRole.Forum,
      categoryId: rootCategoryId,
      authorId: c.SystemUserId,
    });
    site.pages.push(forumPage);

    site.pagePaths.push(pagePath(forumPage.id, '/', false));

    // Forum title and intro text page.
    site.posts.push(post({
      page: forumPage,
      nr: c.TitleNr,
      approvedSource: options.title || "Forum Title",
      approvedHtmlSanitized: options.title || "Forum Title",
    }));
    site.posts.push(post({
      page: forumPage,
      nr: c.BodyNr,
      approvedSource: "Forum intro text.",
      approvedHtmlSanitized: "<p>Forum intro text.</p>",
    }));

    const rootCategory = rootCategoryWithIdFor(rootCategoryId, forumPage);
    rootCategory.defaultCategoryId = 2;
    site.categories.push(rootCategory);

    const uncategorizedCategory = categoryWithIdFor(2, forumPage);
    uncategorizedCategory.parentId = rootCategory.id;
    uncategorizedCategory.name = "Uncategorized";
    uncategorizedCategory.slug = "uncategorized";
    uncategorizedCategory.description = "The default category.";
    site.categories.push(uncategorizedCategory);

    site.permsOnPages.push({
      id: 1,
      forPeopleId: c.EveryoneId,
      onCategoryId: uncategorizedCategory.id,
      mayEditOwn: true,
      mayCreatePage: true,
      mayPostComment: true,
      maySee: true,
      maySeeOwn: true,
    });

    site.permsOnPages.push({
      id: 2,
      forPeopleId: c.StaffId,
      onCategoryId: uncategorizedCategory.id,
      mayEditPage: true,
      mayEditComment: true,
      mayEditWiki: true,
      mayEditOwn: true,
      mayDeletePage: true,
      mayDeleteComment: true,
      mayCreatePage: true,
      mayPostComment: true,
      maySee: true,
      maySeeOwn: true,
    });

    return site;
}

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
    let site = forumOwnedByOwen(name, options);

    var modya = memberModeratorModya();
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


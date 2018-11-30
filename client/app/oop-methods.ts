/*
 * Copyright (c) 2016-2017 Kaj Magnus Lindberg
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/// <reference path="prelude.ts" />
/// <reference path="utils/utils.ts" />
/// <reference path="store-getters.ts" />


/* Object Oriented Programming methods, like so: className_methodName(instance, args...),
 * just like in C.
 *
 * Some classes/things have lots of methods and have been broken out to separate files,
 * e.g. store-methods.ts.
 */

//------------------------------------------------------------------------------
   namespace debiki2 {
//------------------------------------------------------------------------------


export function urlPath_isToPageId(urlPath: string, pageId: PageId): boolean {
  const idPathRegex = new RegExp(`^.*/-${pageId}(/.*)?$`);  // [2WBG49]
  return idPathRegex.test(urlPath);
}


export function urlPath_isToForum(urlPath: string, forumPath: string): boolean {
  if (urlPath === forumPath)
    return true;
  // Look for forum-path + /active|/new|etc routes:
  const slash = forumPath[forumPath.length - 1] === '/' ? '' : '/';
  const latest = RoutePathLatest;
  const neew = RoutePathNew;
  const top = RoutePathTop;
  const cats = RoutePathCategories;
  const isToForumRegex = new RegExp(`^${forumPath}${slash}(${latest}|${neew}|${top}|${cats})(/.*)?$`);
  return isToForumRegex.test(urlPath);
}


export function topic_lastActivityAtMs(topic: Topic): number {
   return topic.bumpedAtMs || topic.createdAtMs;
}


/** Returns < 0, or > 0, or === 0, if t should be listed before t2, after t2, or if same position.
  */
export function topic_sortByLatestActivity(t: Topic, t2: Topic, categoryId: CategoryId)
      : number {
  if (t.pinWhere === PinPageWhere.Globally && t2.pinWhere === PinPageWhere.Globally) {
    if (t.pinOrder !== t2.pinOrder) {
      return t.pinOrder - t2.pinOrder; // lowest first
    }
  }
  else if (t.pinWhere === PinPageWhere.Globally) {
    return -1;
  }
  else if (t2.pinWhere === PinPageWhere.Globally) {
    return +1;
  }

  var pin1stInCategory = t.pinWhere === PinPageWhere.InCategory && t.categoryId === categoryId;
  var pin2ndInCategory = t2.pinWhere === PinPageWhere.InCategory && t2.categoryId === categoryId;
  if (pin1stInCategory && pin2ndInCategory) {
    if (t.pinOrder !== t2.pinOrder) {
      return t.pinOrder - t2.pinOrder; // lowest first
    }
  }
  else if (pin1stInCategory) {
    return -1;
  }
  else if (pin2ndInCategory) {
    return +1;
  }

  return topic_lastActivityAtMs(t2) - topic_lastActivityAtMs(t);
}


export function siteStatusToString(siteStatus: SiteStatus): string {
  return SiteStatusStrings[siteStatus - 1];
}


// Update-inserts a notf pref into a list of prefs.
//
export function pageNotfPrefs_copyWithUpdatedPref(
     prefs: PageNotfPref[], newNotfPref: PageNotfPref): PageNotfPref[] {
  const index = prefs.findIndex((p: PageNotfPref) => pageNotfPref_hasSameTarget(p, newNotfPref));
  if (index === -1) {
    return [...prefs, newNotfPref];
  }
  else {
    const clone = [...prefs];
    clone[index] = newNotfPref;
    return clone;
  }
}


function pageNotfPref_hasSameTarget(self: PageNotfPref, other: PageNotfPref): boolean {
  return (
      (self.pageId && self.pageId === other.pageId) ||
      (self.pagesInCategoryId && self.pagesInCategoryId === other.pagesInCategoryId) ||
      (self.wholeSite && other.wholeSite));
}


export function pageNotfPrefTarget_findEffPref(
      target: PageNotfPrefTarget, store: Store, ownPrefs: OwnPageNotfPrefs): EffPageNotfPref {
  // @ifdef DEBUG
  dieIf(oneIfDef(target.pageId) + oneIfDef(target.pagesInCategoryId) +
      oneIfDef(target.wholeSite) !== 1, 'TyE6SKDW207');
  // @endif

  const result: EffPageNotfPref = { ...target };

  // Check for notf prefs for this page.
  const myPageData: MyPageData | undefined =
      ownPrefs.myDataByPageId && ownPrefs.myDataByPageId[target.pageId];
  if (myPageData) {
    if (myPageData.myPageNotfPref) {
      result.notfLevel = myPageData.myPageNotfPref.notfLevel;
    }

    const maxGroupsPref = maxPref(myPageData.groupsPageNotfPrefs);
    if (maxGroupsPref) {
      result.inheritedNotfPref = maxGroupsPref;
      return result;
    }
  }

  // Check for notf prefs for a category, or, if the target is a page, for the category it is in.
  const page: Page | undefined = store.pagesById[target.pageId];
  const categoryId = page ? page.categoryId : target.pagesInCategoryId;
  if (categoryId) {
    const myPref = _.find(ownPrefs.myCatsTagsSiteNotfPrefs,
        (p: PageNotfPref) => p.pagesInCategoryId == categoryId);
    const groupsPrefs = _.filter(ownPrefs.groupsCatsTagsSiteNotfPrefs,
        (p: PageNotfPref) => p.pagesInCategoryId == categoryId);
    const maxGroupsPref = maxPref(groupsPrefs);

    if (target.pageId) {
      result.inheritedNotfPref = myPref || maxGroupsPref;
      if (result.inheritedNotfPref)
        return result;
    }
    else if (target.pagesInCategoryId) {
      if (myPref) {
        result.notfLevel = myPref.notfLevel;
      }
      if (maxGroupsPref) {
        result.inheritedNotfPref = maxGroupsPref;
        return result;
      }
    }
  }

  // Check prefs for the whole site.
  {
    const myPref = _.find(ownPrefs.myCatsTagsSiteNotfPrefs, (p: PageNotfPref) => p.wholeSite);
    const groupsPrefs = _.filter(ownPrefs.groupsCatsTagsSiteNotfPrefs, p => p.wholeSite);
    const maxGroupsPref = maxPref(groupsPrefs);
    if (!target.wholeSite) {
      result.inheritedNotfPref = myPref || maxGroupsPref;
      if (result.inheritedNotfPref)
        return result;
    }
    else {
      if (myPref) {
        result.notfLevel = myPref.notfLevel;
      }
      if (maxGroupsPref) {
        result.inheritedNotfPref = maxGroupsPref;
        return result;
      }
    }
  }

  // Default fallback.
  result.inheritedNotfPref = { notfLevel: PageNotfLevel.Normal, memberId: Groups.EveryoneId };
  return result;
}


function maxPref(prefs: PageNotfPref[]): PageNotfPref | undefined {  // [CHATTYPREFS]
  let maxPref;
  _.each(prefs, p => {
    // @ifdef DEBUG
    dieIf(!pageNotfPref_hasSameTarget(prefs[0], p), 'TyE2ABKS0648');
    // @endif
    if (!maxPref || p.notfLevel > maxPref.notfLevel) {
      maxPref = p;
    }
  });
  return maxPref;
}


export function notfPref_title(notfPref: EffPageNotfPref): string {
  const level =
      notfPref.notfLevel ||
      notfPref.inheritedNotfPref && notfPref.inheritedNotfPref.notfLevel ||
      PageNotfLevel.Normal;
  switch (level) {
    case PageNotfLevel.EveryPostAllEdits: return 'EveryPostAllEdits unimpl';
    case PageNotfLevel.EveryPost: return t.nl.EveryPost;
    case PageNotfLevel.TopicProgress: return 'TopicProgress unimpl';
    case PageNotfLevel.TopicSolved: return 'TopicSolved unimpl';
    case PageNotfLevel.NewTopics: // [2ABK05R8]
      if (notfPref.pageId) return t.nl.Normal;
      else return t.nl.NewTopics;
    case PageNotfLevel.Tracking: return t.nl.Tracking;
    case PageNotfLevel.Normal: return t.nl.Normal;
    case PageNotfLevel.Hushed: return t.nl.Hushed;
    case PageNotfLevel.Muted: return t.nl.Muted;
  }
  // @ifdef DEBUG
  die('TyE2AKS402');
  // @endif
  return '?';
}


export function notfLevel_descr(notfLevel: PageNotfLevel, effPref: EffPageNotfPref, store: Store): any {
  let descr;
  switch (notfLevel) {
    case PageNotfLevel.EveryPostAllEdits:
      descr = 'EveryPostAllEdits unimpl';
      break;
    case PageNotfLevel.EveryPost:
      if (effPref.pageId) descr = t.nl.EveryPostInTopic;
      else if (effPref.pagesInCategoryId) descr = t.nl.EveryPostInCat;
      //if (???) return t.nl.EveryPostInTopicsWithTag;
      else if (effPref.wholeSite) descr = t.nl.EveryPostWholeSite;
      break;
    case PageNotfLevel.TopicProgress:
      descr = 'TopicProgress unimpl';
      break;
    case PageNotfLevel.TopicSolved:
      descr = 'TopicSolved unimpl';
      break;
    case PageNotfLevel.NewTopics:
      if (effPref.pagesInCategoryId) descr = t.nl.NewTopicsInCat;
      //else if (effPref.forPagesWithTagId) descr = t.nl.NewTopicsWithTag;
      else if (effPref.wholeSite) descr = t.nl.NewTopicsWholeSite;
      else {
        // Inside a topic, watching New Topics works as Normal, because [2ABK05R8]
        // topic already created.
        descr = t.nl.NormalDescr;
      }
      // @ifdef DEBUG
      dieIf(effPref.pageId, 'TyE7WK20R');
      // @endif
      break;
    case PageNotfLevel.Tracking:
      descr = t.nl.Tracking;
      break;
    case PageNotfLevel.Normal:
      descr = t.nl.NormalDescr;
      break;
    case PageNotfLevel.Hushed:
      descr = t.nl.HushedDescr;
      break;
    case PageNotfLevel.Muted:
      descr = t.nl.MutedTopic;
      break;
  }

  // @ifdef DEBUG
  dieIf(!descr, 'TyE2AKS403');
  // @endif

  let explainWhyInherited;
  if (!effPref.inheritedNotfPref) {
    // This preference is not inherited from a group or ancestor category; nothing to explain.
  }
  else {
    // Treat watching-new-topics as Normal, when on a topic that exists already, [4WKBG0268]
    // because it makes no sense to use the NewTopics text, when we're in a topic
    // that exists already.
    const useNormalLevel =
        // If this is for a page (not a category or the whole site)...
        effPref.pageId &&
        // and we're creating text for the Normal level...
        notfLevel === PageNotfLevel.Normal &&
        // and inheriting PageNotfLevel.NewTopics — then use the Normal level text.
        effPref.inheritedNotfPref.notfLevel === PageNotfLevel.NewTopics;

    if (effPref.inheritedNotfPref.notfLevel !== notfLevel && !useNormalLevel) {
      // A notf level is inherited, but not this notf level.
    }
    else {
      // This notf level is inherited from a parent category, or from a group one is in.
      // Add a bit text that explains this — so people understand why this setting
      // is in use, or has the text "Default", although they didn't do anything themselves.
      explainWhyInherited = r.div({ className: 's_NotfPrefDD_WhyInh' },
          makeWhyInheritedExpl(notfLevel, effPref, store));
    }
  }

  return rFragment({}, descr, explainWhyInherited);
}


function makeWhyInheritedExpl(notfLevel: PageNotfLevel, effPref: EffPageNotfPref, store: Store) { // I18N
  const inhPref = effPref.inheritedNotfPref;
  const inheritedOrDefault = !effPref.notfLevel ? "Inherited" : "The default";
  const user = store.usersByIdBrief[inhPref.memberId];
  const fromUserName = user && !user.isGroup ? '' :
      ", from @" + (user && user.username || `#${inhPref.memberId}`);
  const forWholeSite = inhPref.wholeSite ? ", whole site setting" : '';
  const onCategory = inhPref.pagesInCategoryId ? ", category #" + inhPref.pagesInCategoryId : '';
  return inheritedOrDefault + fromUserName + forWholeSite + onCategory;
}


export function post_isDeleted(post: Post): boolean {   // dupl code [2PKQSB5]
  return post.isPostDeleted || post.isTreeDeleted;
}

export function post_isCollapsed(post) {
  return post.isTreeCollapsed || post.isPostCollapsed;
}

export function post_isDeletedOrCollapsed(post: Post): boolean {
  return post_isDeleted(post) || post_isCollapsed(post);
}

export function post_shallRenderAsDeleted(post: Post): boolean {
  return post_isDeleted(post) && _.isEmpty(post.sanitizedHtml);
}

export function post_shallRenderAsHidden(post: Post): boolean {
  return post.isBodyHidden && _.isEmpty(post.sanitizedHtml);
}


// Me
//----------------------------------

export function me_hasRead(me: Myself, post: Post) {
  // If not logged in, we have no idea.
  dieIf(!me.isLoggedIn, 'EdE2WKA0');
  // Title likely already read, before clicking some link to the page.
  if (post.nr === TitleNr) return true;
  const myPageData: MyPageData = me.myCurrentPageData;
  return myPageData.postNrsAutoReadLongAgo.indexOf(post.nr) >= 0 ||
      myPageData.postNrsAutoReadNow.indexOf(post.nr) >= 0;
}

export function me_copyWithNewPageData(me: Myself, newPageData: MyPageData): Myself {
  const newCurrentPageData = newPageData.pageId === me.myCurrentPageData.pageId
      ? newPageData  // then the new data, is for the current page, so point to the new data
      : me.myCurrentPageData;  // the new data, is *not* for the current page, so don't change
  const newDataByPageId = { ...me.myDataByPageId };
  newDataByPageId[newPageData.pageId] = newPageData;
  const newMe = {
    ...me,
    myCurrentPageData: newCurrentPageData,
    myDataByPageId: newDataByPageId,
  };
  return newMe;
}



// Users
//----------------------------------


export function user_isSuspended(user: MemberInclDetails, nowMs: WhenMs): boolean {
  return user.suspendedTillEpoch && ((user.suspendedTillEpoch * 1000) > nowMs);
}


export function user_threatLevel(user: MemberInclDetails): ThreatLevel {
  return user.lockedThreatLevel || user.threatLevel;
}


export function user_trustLevel(user: MemberInclDetails | Myself): TrustLevel {
  return (<MemberInclDetails> user).effectiveTrustLevel || user.lockedTrustLevel || user.trustLevel;
}


export function user_isTrustMinNotThreat(user: MemberInclDetails | Myself, trustLevel: TrustLevel): boolean {
  if (isStaff(user)) return true;
  // UX COULD check threat level too, that's done server side, not doing here can result in [5WKABY0]
  // annoying error messages (security though = server side).  Add a Myself.isThreat field?
  return user_trustLevel(user) >= trustLevel;
}


export function user_isGone(user: Myself | BriefUser | MemberInclDetails | UserAnyDetails): boolean {
  // These two casts work for UserAnyDetails too.
  const membInclDetails = <Myself | MemberInclDetails> user;
  const briefUser = <BriefUser> user;

  return briefUser.isGone || !!membInclDetails.deactivatedAt || !!membInclDetails.deletedAt;
}


// Settings
//----------------------------------


export function settings_showCategories(settings: SettingsVisibleClientSide, me: Myself) {
  // Later: by default, do as 'settings' say, but let user preferences override. [8WK4SD7]
  return settings.showCategories !== false;
}


export function settings_showFilterButton(settings: SettingsVisibleClientSide, me: Myself) {
  // Later: by default, do as 'settings' say, but let user preferences override. [8WK4SD7]
  return isStaff(me) || settings.showTopicFilterButton !== false;
}


export function settings_showTopicTypes(settings: SettingsVisibleClientSide, me: Myself) {
  // Later: by default, do as 'settings' say, but let user preferences override. [8WK4SD7]
  return settings.showTopicTypes !== false;
}


export function settings_selectTopicType(settings: SettingsVisibleClientSide, me: Myself) {
  // Later: by default, do as 'settings' say, but let user preferences override. [8WK4SD7]
  return isStaff(me) || settings.selectTopicType !== false;
}



// Store
//----------------------------------

export function store_isNoPage(store: Store): boolean {
  return !store.currentPageId || store.currentPageId === EmptyPageId;
}


export function store_isPageDeleted(store: Store): boolean {
  const page: Page = store.currentPage;
  return !!page.pageDeletedAtMs || _.some(page.ancestorsRootFirst, a => a.isDeleted);
}


export function store_mayICreateTopics(store: Store, category: Category): boolean {
  let may: boolean;
  let currentCategory = category;
  const me = store.me;

  me.permsOnPages.forEach((p: PermsOnPage) => {
    if (p.onWholeSite) {
      if (isDefined2(p.mayCreatePage)) {
        may = p.mayCreatePage;
      }
    }
  });

  if (category.isForumItself) {
    // May we create topics in *any* category in the whole forum?
    may = !!store_findCatsWhereIMayCreateTopics(store).length;
  }
  else {
    // May we create topics in this specific category?
    while (currentCategory) {
      me.permsOnPages.forEach((p: PermsOnPage) => {
        if (p.onCategoryId === currentCategory.id) {
          if (isDefined2(p.mayCreatePage)) {
            may = p.mayCreatePage;
          }
        }
      });
      // Latent BUG: should check cats starting at root, but here we start with the "childmost" cat.
      // Fix, before enabling child cats. [0GMK2WAL]
      currentCategory = _.find(store.currentCategories, c => c.id === currentCategory.parentId);
    }
  }

  return may;
}


// Some dupl code! (8FUZWY02Q60)
export function store_mayIReply(store: Store, post: Post): boolean {
  const page: Page = store.currentPage;
  // Each reply on a mind map page is a mind map node. Thus, by replying, one modifies the mind map
  // itself. So, one needs to be allowed to edit the *page*, to add (= reply) mind-map-posts. [7KUE20]
  if (page.pageRole === PageRole.MindMap)
    return store_mayIEditPage(store, post);

  let may: boolean;
  const ancestorCategories: Ancestor[] = page.ancestorsRootFirst;
  const me = store.me;

  // Later: [8PA2WFM] Perhaps let staff reply, although not approved. So staff can say
  // "If you please remove <sth that violates the site guidelines>, I'll approve the comment".
  // Or "I won't approve this comment. It's off-topic because ...".
  if (post_isDeletedOrCollapsed(post) || !post.isApproved)
    return false;

  if (page.pageMemberIds.indexOf(me.id) >= 0)
    may = true;

  me.permsOnPages.forEach((p: PermsOnPage) => {
    if (p.onWholeSite) {
      if (isDefined2(p.mayPostComment)) {
        may = p.mayPostComment;
      }
    }
  });

  // Here we loop through the cats in the correct order though, [0GMK2WAL].
  for (let i = 0; i < ancestorCategories.length; ++i) {
    const ancestor = ancestorCategories[i];
    me.permsOnPages.forEach((p: PermsOnPage) => {
      if (p.onCategoryId === ancestor.categoryId) {
        if (isDefined2(p.mayPostComment)) {
          may = p.mayPostComment;
        }
      }
    });
  }

  return may;
}


export function store_mayIEditPage(store: Store, post: Post): boolean {
  return store_mayIEditImpl(store, post, true);
}


export function store_mayIEditPost(store: Store, post: Post): boolean {
  return store_mayIEditImpl(store, post, false);
}


// Some dupl code! (8FUZWY02Q60)
function store_mayIEditImpl(store: Store, post: Post, isEditPage: boolean): boolean {
  if (post_isDeletedOrCollapsed(post))
    return false;

  const page: Page = store.currentPage;
  const me = store.me;
  const isMindMap = page.pageRole === PageRole.MindMap;
  const isOwnPage = store_thisIsMyPage(store);
  const isOnPostOrWikiPost =
      post.authorId === me.id ||
      (me.isAuthenticated && post.postType === PostType.CommunityWiki); // [05PWPZ24]

  let isOwn = isEditPage ? isOwnPage :
      isOnPostOrWikiPost ||
        // In one's own mind map, one may edit all nodes, even if posted by others. [0JUK2WA5]
        post.isApproved && isMindMap && isOwnPage;

  // Not present in server side checks. And not needed?
  //if (!post.isApproved && !may)
  //  return false;

  let may: boolean;

  // Direct messages aren't placed in any category and thus aren't affected by permissions.
  // Need this extra 'if':
  if (page.pageMemberIds.indexOf(me.id) >= 0 && isOwn)
    may = true;

  me.permsOnPages.forEach((p: PermsOnPage) => {
    if (p.onWholeSite) {
      if (isDefined2(p.mayEditPage)) {
        may = p.mayEditPage;
      }
      if (isDefined2(p.mayEditOwn) && isOwn) {
        may = p.mayEditOwn;
      }
    }
  });

  // Here we loop through the cats in the correct order though, [0GMK2WAL].
  const ancestorCategories: Ancestor[] = page.ancestorsRootFirst;
  for (let i = 0; i < ancestorCategories.length; ++i) {
    const ancestor = ancestorCategories[i];
    me.permsOnPages.forEach((p: PermsOnPage) => {
      if (p.onCategoryId === ancestor.categoryId) {
        if (isDefined2(p.mayEditPage)) {
          may = p.mayEditPage;
        }
        if (isDefined2(p.mayEditOwn) && isOwn) {
          may = p.mayEditOwn;
        }
      }
    });
  }

  // COULD check threat level here? May-not if is-severe-threat.

  return may;
}


export function store_findCatsWhereIMayCreateTopics(store: Store): Category[] {
  return _.filter(store.currentCategories, (c: Category) => {
    if (c.isForumItself) return false;
    return store_mayICreateTopics(store, c);
  });
}


export function category_isPublic(category: Category | undefined, store: Store): boolean {
  // REFACTOR? !category happens here: [4JKKQS20], for the root category (looked up by id).
  // Because the root cat isn't included in the store. Maybe should include it? Then 'category'
  // will never be missing here.
  if (!category || category.isForumItself) {
    // This is the All Categories category dropdown item.
    return true;
  }
  return _.some(store.publicCategories, (c: Category) => {
    return c.id === category.id;
  });
}


export function category_iconClass(category: Category | CategoryId, store: Store): string {
  // (Deleted and unlisted categories aren't included in the public categories list. [5JKWT42])
  const anyCategory: Category | undefined =
      _.isNumber(category) ? _.find(store.currentCategories, (c) => c.id === category) : category;

  const isPublic = category_isPublic(anyCategory, store);
  if (!isPublic) return (
      anyCategory.isDeleted ? 'icon-trash ' : (
        // Both category and topics unlisted? (Unlisting category means unlisting the topics too)
        anyCategory.unlistCategory ? 'icon-2x-unlisted ' : 'icon-lock '));

  // Ony topics unlisted?
  return anyCategory && anyCategory.unlistTopics ? 'icon-unlisted ' : '';
}


// Page
//----------------------------------


export function page_canChangeCategory(page: Page): boolean {
  const pageRole = page.pageRole;
  return (pageRole !== PageRole.Code
      && pageRole !== PageRole.SpecialContent
      && pageRole !== PageRole.Blog
      && pageRole !== PageRole.Forum
      && pageRole !== PageRole.About
      && pageRole !== PageRole.FormalMessage
      && pageRole !== PageRole.PrivateChat);
}


export function page_mostRecentPostNr(page: Page): number {
  // BUG not urgent. COULD incl the max post nr in Page, so even if not yet loaded,
  // we'll know its nr, and can load and scroll to it, from doUrlFragmentAction().
  let maxNr = -1;
  _.values(page.postsByNr).forEach((post: Post) => {  // COULD use _.reduce instead
    maxNr = Math.max(post.nr, maxNr);
  });
  // @ifdef DEBUG
  dieIf(maxNr < TitleNr, 'TyE5FKBQATS');
  // @endif
  return maxNr;
}


// Forum buttons
//----------------------------------

export function topPeriod_toString(period: TopTopicsPeriod): string {
  switch (period) {
    case TopTopicsPeriod.Day: return t.PastDay;
    case TopTopicsPeriod.Week: return t.PastWeek;
    case TopTopicsPeriod.Month: return t.PastMonth;
    case TopTopicsPeriod.Quarter: return t.PastQuarter;
    case TopTopicsPeriod.Year: return t.PastYear;
    case TopTopicsPeriod.All: return t.AllTime;
    default: return '' + period;
  }
}



// Trust and threat levels
//----------------------------------

export function trustLevel_toString(trustLevel: TrustLevel): string {
  switch (trustLevel) {
    case TrustLevel.New: return t.NewMember;
    case TrustLevel.Basic: return t.BasicMember;
    case TrustLevel.FullMember: return t.FullMember;
    case TrustLevel.Trusted: return t.TrustedMember;
    case TrustLevel.Regular: return t.RegularMember;
    case TrustLevel.CoreMember: return t.CoreMember;
    default:
      // Guests have no trust level.
      return t.Guest;
  }
}

export function threatLevel_toString(threatLevel: ThreatLevel): string {
  // (This is for admins, don't translate. [5JKBWS2])
  switch (threatLevel) {
    case ThreatLevel.HopefullySafe: return "Allow";
    case ThreatLevel.MildThreat: return "Review after";
    case ThreatLevel.ModerateThreat: return "Review before";
    case ThreatLevel.SevereThreat: return "Block completely";
    default: debiki2.die('EsE5PYK25')
  }
}


// User stats
//----------------------------------

export function userStats_totalNumPosts(stats: UserStats): number {
  return stats.numChatMessagesPosted + stats.numChatTopicsCreated +
      stats.numDiscourseRepliesPosted + stats.numDiscourseTopicsCreated;
}

export function userStats_totalNumPostsRead(stats: UserStats): number {
  return stats.numChatMessagesRead + stats.numChatTopicsEntered +
    stats.numDiscourseRepliesRead + stats.numDiscourseTopicsEntered;
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list

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


export function win_canUseCookies(win: MainWin): boolean {
  return (
      // This first test is if the server got no cookies, although it should have
      // gotten some cookie. Is this a bit fragile? Not sure if always works.
      !win.typs.xsrfTokenIfNoCookies &&
      // This is more reliable?
      win.typs.canUseCookies);
}


export function event_isCmdShiftClick(event): boolean {
  // I think on Mac, the Command key is the same as the Meta = Windows key on PC?
  // "Ctrl" on Linux seems to behave in the same way as Command on Mac, so
  // include it too.
  return event.ctrlKey || event.metaKey || event.shiftKey;
}


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
  dieIf(!ownPrefs.id, 'TyE305HD2');
  // @endif

  const result: EffPageNotfPref = { ...target, forMemberId: ownPrefs.id };

  // Check for notf prefs for this page.
  const myPageData: MyPageData | undefined =
      ownPrefs.myDataByPageId && ownPrefs.myDataByPageId[target.pageId];
  if (myPageData) {
    if (myPageData.myPageNotfPref) {
      result.notfLevel = myPageData.myPageNotfPref.notfLevel;
      // Continue below to find out if we're also inheriting a notf level
      // from a category or group. (If so, then it's not in use — since we've
      // now found a notf level explicitly for this page, on the line above).
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
      // When the target is a page, and we find a notf pref for a *category*, then
      // that pref is inherited, from one's own category notf pefs, or the category notf
      // prefs of a group one is in.
      result.inheritedNotfPref = myPref || maxGroupsPref;
      if (result.inheritedNotfPref)
        return result;
    }
    else if (target.pagesInCategoryId) {
      // If, however, the target is itself a category, then, if we have our own notf level
      // for this category, it's not inherited — it's explicitly for this category.
      if (myPref) {
        result.notfLevel = myPref.notfLevel;
      }
      // Maybe inheriting from a group? (And has no effect, if myPref.notLevel defined.)
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


export function notfLevel_descr(notfLevel: PageNotfLevel, effPref: EffPageNotfPref, ppsById: PpsById): any {
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
          makeWhyNotfLvlInheritedExpl(effPref, ppsById));
    }
  }

  return rFragment({}, descr, explainWhyInherited);
}


export function makeWhyNotfLvlInheritedExpl(effPref: EffPageNotfPref, ppsById: PpsById) {  // I18N
  const inhPref = effPref.inheritedNotfPref;
  const inhFromMember = ppsById[inhPref.memberId];

  const isInherited = !effPref.notfLevel;
  const inheritedOrDefault = isInherited ? "Inherited" : "The default";

  const fromUserName = effPref.forMemberId === inhPref.memberId ? '' :
      ", from group @" + (inhFromMember && inhFromMember.username || `#${inhPref.memberId}`);

  const forWholeSite = inhPref.wholeSite ? ", whole site setting" : '';
  const onCategory = inhPref.pagesInCategoryId ? ", category #" + inhPref.pagesInCategoryId : '';

  return inheritedOrDefault + fromUserName + forWholeSite + onCategory;
}

export function post_isWiki(post: Post): boolean {
  // Skip PostType.StaffWiki, using the permission system instead. [NOSTAFFWIKI]
  return post.postType === PostType.CommunityWiki;
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

export function me_isUser(me: Myself): boolean {
  return (!isGuest(me) && !me.isGroup &&
      // Don't need both these? Oh well.
      me.isAuthenticated && me_isAuthenticated(me));
}

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

export function me_uiPrefs(me: Myself): UiPrefs {
  return shallowMergeFirstItemLast(me.uiPrefsOwnFirst);
}


// Groups
//----------------------------------


// Members
//----------------------------------

export function member_isBuiltIn(member: Member): boolean {
  return member.id < LowestAuthenticatedUserId;
}



// Users
//----------------------------------


export function user_isSuspended(user: UserInclDetails, nowMs: WhenMs): boolean {
  return user.suspendedTillEpoch && ((user.suspendedTillEpoch * 1000) > nowMs);
}


export function user_threatLevel(user: UserInclDetails): ThreatLevel {
  return user.lockedThreatLevel || user.threatLevel;
}


export function user_trustLevel(user: UserInclDetails | Myself): TrustLevel {
  return (<UserInclDetails> user).effectiveTrustLevel || user.lockedTrustLevel || user.trustLevel;
}


export function user_isTrustMinNotThreat(user: UserInclDetails | Myself, trustLevel: TrustLevel): boolean {
  if (isStaff(user)) return true;
  // UX COULD check threat level too, that's done server side, not doing here can result in [5WKABY0]
  // annoying error messages (security though = server side).  Add a Myself.isThreat field?
  return user_trustLevel(user) >= trustLevel;
}


export function user_isGone(user: Myself | BriefUser | UserInclDetails | ParticipantAnyDetails): boolean {
  // These two casts work for ParticipantAnyDetails too.
  const membInclDetails = <Myself | UserInclDetails> user;
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
  if (settings.enableForum === false) return false;
  // Later: by default, do as 'settings' say, but let user preferences override. [8WK4SD7]
  return isStaff(me) || settings.showTopicFilterButton !== false;
}


export function settings_showTopicTypes(settings: SettingsVisibleClientSide, me: Myself) {
  if (settings.enableForum === false) return false;
  // Later: by default, do as 'settings' say, but let user preferences override. [8WK4SD7]
  return settings.showTopicTypes !== false;
}


export function settings_selectTopicType(settings: SettingsVisibleClientSide, me: Myself) {
  if (settings.enableForum === false) return false;
  // Later: by default, do as 'settings' say, but let user preferences override. [8WK4SD7]
  return isStaff(me) || settings.selectTopicType !== false;
}



// Store
//----------------------------------

export function store_mainSiteSection(store: Store): SiteSection {
  // Currently there's always just one sub site, namely the forum.
  // Edit: Actually, there're some old sites, with many sub sites — they
  // got created, before the sub site feature got disabled. In such a case,
  // use the sub site with the lowest root category id, because that one was
  // created by the server and should be the real one / the one actually in use.
  const siteSections: SiteSection[] = store.siteSections;
  let mainSiteSection: SiteSection;
  _.each(siteSections, ss => {
    if (!mainSiteSection || mainSiteSection.rootCategoryId > ss.rootCategoryId) {
      mainSiteSection = ss;
    }
  });
  return mainSiteSection;
}



export function store_isNoPage(store: Store): boolean {
  return !store.currentPageId || store.currentPageId === EmptyPageId;
}


export function store_isPageDeleted(store: Store): boolean {
  const page: Page = store.currentPage;
  return !!page.pageDeletedAtMs || _.some(page.ancestorsRootFirst, a => a.isDeleted);
}


export function store_mayICreateTopics(store: Store, category: Category | U): boolean {
  const settings: SettingsVisibleClientSide = store.settings;
  if (settings.enableForum === false || !category)
    return false;

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
  const isWiki = post_isWiki(post);
  const isOwnPage = store_thisIsMyPage(store);
  const isOwnPost = post.authorId === me.id;
  let isOwn = isEditPage ? isOwnPage :
      isOwnPost ||
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

  // Least specific: Whole site permissions. Can be overridden per category and
  // sub cats, in the ancestor categories loop below.
  me.permsOnPages.forEach((p: PermsOnPage) => {
    if (p.onWholeSite) {
      // --- What!? Can't all this just be:
      const simplerMay =
              p.mayEditPage ||
              p.mayEditWiki && isWiki ||
              p.mayEditOwn && isOwn;
      // And:
      // may = may || simplerMay
      // Hmm, but below, if !mayEditOwn, then, different. But why would
      // anyone ever config such permissions?
      // -----------------
      if (isDefined2(p.mayEditPage)) {
        may = p.mayEditPage;
      }
      if (isDefined2(p.mayEditWiki) && isWiki) {
        may = may || p.mayEditWiki;
      }
      if (isDefined2(p.mayEditOwn) && isOwn) {
        may = p.mayEditOwn;
      }
      // @ifdef DEBUG
      dieIf(simplerMay !== may, 'TyE35MRKTDJ35');
      // @endif
      void 0;
    }
  });

  // Here we loop through ancestor cateories, from root cat to sub cat. [0GMK2WAL].
  const ancestorCategories: Ancestor[] = page.ancestorsRootFirst;
  for (let i = 0; i < ancestorCategories.length; ++i) {
    const ancestor = ancestorCategories[i];
    me.permsOnPages.forEach((p: PermsOnPage) => {
      if (p.onCategoryId === ancestor.categoryId) {
        let mayThisCat: boolean | U;
        // This can change `may` from true to false — so, you can prevent people
        // from editing a sub category, even if they can edit the parent category.
        if (isDefined2(p.mayEditPage)) {
          mayThisCat = p.mayEditPage;
        }
        // But this is weird! What if one may edit all pages in the parent cat,
        // and this post is a wiki — but one may not edit wikis in this category?
        // Then, should be allowed to edit it.  isWiki should only *add* edit permissions,
        // never remove.
        // However, if the permission in the parent cat, was for *wiki*, then,
        // !mayEditWiki here, should cancel that. So, need to keep track of if
        // permissions are because is-wiki or not.  [subcats]
        // Fortunately, sub cats not so very implemented yet. So whatever is fine, now.
        if (isDefined2(p.mayEditWiki) && isWiki) {
          mayThisCat = mayThisCat || p.mayEditWiki
                || may;  // <—— so won't remove parent cat perms
        }
        if (isDefined2(p.mayEditOwn) && isOwn) {
          mayThisCat = p.mayEditOwn;
        }
        if (isDefined2(mayThisCat)) {
          may = mayThisCat;
        }
      }
    });
  }

  // COULD check threat level here? May-not if is-severe-threat.

  return may;
}


// Also see: store_getCurrOrDefaultCat(store) [GETACTDEFCAT]
//
export function store_findTheDefaultCategory(store: Store): Category | undefined {
  return _.find(store.currentCategories, (category: Category) => {
    return category.isDefaultCategory;
  });
}


export function store_ancestorsCategoriesCurrLast(
      store: Store, categoryId: CategoryId): Category[] {
  const ancestors = [];
  const cats: Category[] = store.currentCategories;
  let nextCatId = categoryId;
  // Stop at 10 in case of cycles. Should never be more than 2 (base cat, sub cat).
  for (let i = 0; i < 10; ++i) {
    const nextCat = _.find(cats, c => c.id === nextCatId);  // [On2]
    if (!nextCat) {
      // The prev cat is a top level cat, and root cats currently not incl in the
      // json sent to the browser, so we won't find the root cat. However
      // the root cat's id should be one of the SiteSection's root cat ids.
      // @ifdef DEBUG
      const siteSection = _.find(store.siteSections, s => s.rootCategoryId === nextCatId);
      dieIf(!siteSection, `No site section root cat found for cat ${categoryId}, ` +
          `root cat id ${nextCatId} [TyE036RKTHF2]`);
      // @endif
      break;
    }
    ancestors.unshift(nextCat);
    nextCatId = nextCat.parentId;
    if (!nextCatId)
      break;
  }
  return ancestors;
}


export function store_findCatsWhereIMayCreateTopics(store: Store): Category[] {
  return _.filter(store.currentCategories, (c: Category) => {
    if (c.isForumItself) return false;
    return store_mayICreateTopics(store, c);
  });
}


export function store_getPostId(store: Store, pageId: PageId, postNr: PostNr): PostId | U {
  // If we're on a blog bost with embedded comments, then, the Talkyard embedded
  // comments page might not yet have been created.
  if (!pageId)
    return undefined;

  // The page might not be the current page, if the editor is open and we've
  // temporarily jumped to a different page or user's profile maybe.
  const page: Page = store.pagesById[pageId];
  dieIf(!page, 'TyE603KWUDB4');

  const post = page.postsByNr[postNr];
  return post && post.uniqueId;
}


export function page_makePostPatch(page: Page, post: Post): StorePatch {
  const patch: StorePatch = {
    pageVersionsByPageId: {},
    postsByPageId: {},
  };
  patch.postsByPageId[page.pageId] = [post];
  patch.pageVersionsByPageId[page.pageId] = page.pageVersion;
  return patch;
}


export function store_makeDraftPostPatch(store: Store, page: Page, draft: Draft)
      : StorePatch {
  const draftPost = store_makePostForDraft(store, draft)
  return page_makePostPatch(page, draftPost);
}


export function store_makeNewPostPreviewPatch(store: Store, page: Page,
      parentPostNr: PostNr | undefined, safePreviewHtml: string,
      newPostType?: PostType): StorePatch {
  const previewPost = store_makePreviewPost({
      store, parentPostNr, safePreviewHtml, newPostType, isEditing: true });
  return page_makePostPatch(page, previewPost);
}


export function page_makeEditsPreviewPatch(
      page: Page, post: Post, safePreviewHtml: string): StorePatch {
  const previewPost: Post = {
    ...post,
    sanitizedHtml: safePreviewHtml,
    isPreview: true,
    isEditing: true,
  };
  return page_makePostPatch(page, previewPost);
}


export function draftType_toPostType(draftType: DraftType): PostType | undefined {
  switch (draftType) {
    case DraftType.Reply: return PostType.Normal;  // could also be ChatMessage
    case DraftType.ProgressPost: return PostType.BottomComment;
    default:
      return undefined;
  }
}


export function postType_toDraftType(postType: PostType): DraftType | undefined {
  switch (postType) {
    case PostType.Normal: return DraftType.Reply;
    case PostType.ChatMessage: return DraftType.Reply;
    case PostType.BottomComment: return DraftType.ProgressPost;
    default:
      return undefined;
  }
}


export function store_makePostForDraft(store: Store, draft: Draft): Post | null {
  const locator: DraftLocator = draft.forWhat;
  const parentPostNr = locator.postNr;

  const postType = draftType_toPostType(draft.forWhat.draftType);
  if (!postType)
    return null;  // then skip draft post, for now

  // It'd be nice if we saved a preview of the drafts, so can show nice preview html,
  // instead of just the CommonMark source. Cannot load the CommonMark engine here,
  // that'd make the page-load too slow I think. [DRAFTPRVW]
  // For now, use the CommonMark source instead.

  const previewPost = store_makePreviewPost({
      store, parentPostNr, unsafeSource: draft.text, newPostType: postType,
      isForDraftNr: draft.draftNr || true });
  return previewPost;
}


export function post_makePreviewIdNr(parentNr: PostNr, newPostType: PostType): PostNr & PostId {
  // So won't overlap with post nrs and ids.
  const previewOffset = -1000 * 1000;
  const previewPostIdNr =
      previewOffset -
      // We create one preview posts, per parent post we're replying to, so
      // inclue the parent post nr, so the preview posts won't overwrite each other,
      // in the page.postsByNr map.
      // Chat messages have no parent post; there can be only one preview
      // chat message [CHATPRNT].
      (parentNr || 0) * 100 -
      // We show different preview posts for 1) progress orig-post reply, and
      // 2) discussion orig-post reply. — If is editing, not replying, use 0.
      (newPostType || 0);
  return previewPostIdNr;
}


interface MakePreviewParams {
  store: Store;
  parentPostNr?: PostNr;
  safePreviewHtml?: string;
  unsafeSource?: string;
  newPostType: PostType;
  // Is true if the draft nr hasn't yet been decided (drafts in sessionStorage
  // haven't yet been assigned a draft nr by the server).
  isForDraftNr?: DraftNr | true;
  isEditing?: boolean;
}


function store_makePreviewPost({
    store, parentPostNr, safePreviewHtml, unsafeSource,
    newPostType, isForDraftNr, isEditing }: MakePreviewParams): Post {

  dieIf(!newPostType, "Don't use for edit previews [TyE4903KS]");

  const previewPostIdNr = post_makePreviewIdNr(parentPostNr, newPostType);

  const now = getNowMs();

  const previewPost: Post = {
    isPreview: true,
    isForDraftNr,
    isEditing,

    uniqueId: previewPostIdNr,
    nr: previewPostIdNr,
    parentNr: parentPostNr,
    multireplyPostNrs: [], //PostNr[];
    postType: newPostType,
    authorId: store.me.id,
    createdAtMs: now,
    //approvedAtMs?: number;
    //lastApprovedEditAtMs: number;
    numEditors: 1,
    numLikeVotes: 0,
    numWrongVotes: 0,
    numBuryVotes: 0,
    numUnwantedVotes: 0,
    numPendingEditSuggestions: 0,
    summarize: false,
    //summary?: string;
    squash: false,
    //isBodyHidden?: boolean;
    isTreeDeleted: false,
    isPostDeleted: false,
    isTreeCollapsed: false,
    isPostCollapsed: false,
    isTreeClosed: false,
    isApproved: false,
    pinnedPosition: 0,
    branchSideways: 0,
    likeScore: 0,
    childNrsSorted: [],
    unsafeSource: unsafeSource,
    sanitizedHtml: safePreviewHtml,
    //tags?: string[];
    //numPendingFlags?: number;
    //numHandledFlags?: number;
  };

  return previewPost;
}


/* Not in use, but maybe later? Instead, for now, this: [60MNW53].
export function store_makeDeleteDraftPostPatch(store: Store, draft: Draft): StorePatch {
  const draftPost = store_makePostForDraft(store, draft);
  return store_makeDeletePostPatch(draftPost);
} */


export function store_makeDeletePreviewPostPatch(store: Store, parentPostNr: PostNr,
      newPostType?: PostType): StorePatch {
  const previewPost: Post = store_makePreviewPost({
      store, parentPostNr, safePreviewHtml: '', newPostType });
  return store_makeDeletePostPatch(previewPost);
}


export function store_makeDeletePostPatch(post: Post): StorePatch {
  const postsByPageId = {};
  // This'll remove the post from `page`, since it got "moved" away from that page.
  postsByPageId['_no_page_'] = [post];
  return {
    postsByPageId,
  };
}



// Permissions
//----------------------------------


export function perms_join(pA: PermsOnPage, pB?: PermsOnPageNoIdOrPp): PermsOnPageNoIdOrPp {
  if (!pB) return pA;
  return {
    // id — omitted
    // forPeopleId — omitted
    onWholeSite: pA.onWholeSite || pB.onWholeSite,
    onCategoryId: pA.onCategoryId || pB.onCategoryId,
    onPageId: pA.onPageId || pB.onPageId,
    onPostId: pA.onPostId || pB.onPostId,
    // later: onTagId?: TagId;
    mayEditPage: pA.mayEditPage || pB.mayEditPage,
    mayEditComment: pA.mayEditComment || pB.mayEditComment,
    mayEditWiki: pA.mayEditWiki || pB.mayEditWiki,
    mayEditOwn: pA.mayEditOwn || pB.mayEditOwn,
    mayDeletePage: pA.mayDeletePage || pB.mayDeletePage,
    mayDeleteComment: pA.mayDeleteComment || pB.mayDeleteComment,
    mayCreatePage: pA.mayCreatePage || pB.mayCreatePage,
    mayPostComment: pA.mayPostComment || pB.mayPostComment,
    // later: mayPostProgressNotes ?
    maySee: pA.maySee || pB.maySee,
    maySeeOwn: pA.maySeeOwn || pB.maySeeOwn,
  };
}



// Category
//----------------------------------


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


export function page_isClosedNotDone(page: Page): boolean {
  return page.pageClosedAtMs && !page.pageAnswerPostUniqueId && !page.pageDoneAtMs
}

export function page_hasDoingStatus(page: Page): boolean {
  const pageType = page.pageRole;
  return pageType === PageRole.Problem || pageType === PageRole.Idea ||
        pageType === PageRole.ToDo || pageType === PageRole.UsabilityTesting;
}


export function page_isAlwaysFlatDiscourse(page: Page): boolean {
  const pageRole = page.pageRole;
  return (pageRole === PageRole.FormalMessage
      || pageRole === PageRole.Form);
}


export function page_isFlatProgress(page: Page): boolean {
  if (page_isAlwaysFlatDiscourse(page))
    return true;
  if (page.pageLayout === TopicLayout.FlatProgress)
    return true;
  /* Later, could:
  const pageRole = page.pageRole;
  return (pageRole === PageRole.Idea
      || pageRole === PageRole.Problem
      || pageRole === PageRole.ToDo);
  */
  // However, for now: (backw compat, so as not to upset people)
  return false;
}


export function page_isThreadedDiscussion(page: Page): boolean {
  if (page_isAlwaysFlatDiscourse(page))
    return false;
  if (page.pageLayout === TopicLayout.ThreadedDiscussion)
    return true;
  if (page.pageLayout === TopicLayout.SplitDiscussionProgress ||
      page.pageLayout === TopicLayout.FlatProgress)
    return false;
  /* Later, could:
  const pageRole = page.pageRole;
  return pageRole === PageRole.Question || pageRole === PageRole.Discussion ||
      pageRole === PageRole.EmbeddedComments;
  */
  // However, for now: (backw compat, to not upset people)
  return true;
}


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


/// Depth-first-search traverses all `posts` and their successors,
/// and calls `fn` — posts[0] and its successors, first.
/// Stops and returns after having visited stopAfter
/// posts (regardless of if they're successors or directly
/// in `posts`).
///
export function page_depthFirstWalk(page: Page, posts: Post[],
        stopAfter: number, fn: (p: Post) => void) {
  // @ifdef DEBUG
  // Maybe could cause performance problems?
  dieIf(stopAfter > 999, 'TyE051TKSEXSD');
  // @endif
  let numSeen = 0;
  traverse(posts);
  function traverse(ps: Post[]) {
    _.each(ps, (p: Post) => {
      if (!p || numSeen > stopAfter) return;
      numSeen += 1;
      fn(p);
      const childPosts = p.childNrsSorted.map((nr: PostNr) => page.postsByNr[nr]);
      traverse(childPosts);
    });
  }
}


export function page_deletePostInPlace(page: Page, post: Post) {
  delete page.postsByNr[post.nr];
  arr_deleteInPlace(page.parentlessReplyNrsSorted, post.nr);
  arr_deleteInPlace(page.progressPostNrsSorted, post.nr);
  page_removeFromParentInPlace(page, post);
}


export function page_removeFromParentInPlace(page: Page, post: Post) {
  const parent = page.postsByNr[post.parentNr];
  if (parent && parent.childNrsSorted) {
    arr_deleteInPlace(parent.childNrsSorted, post.nr);
  }
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


// Review
//----------------------------------

/*
function isReviewPostTask(reviewTask: ReviewTask): boolean {
  // See above. <<0 .. <<3 are for user types. <<4 ..<<19 are for review-post stuff.
  // And <<20 and up are for users. Later: uploads? groups? categories?
  return (1 << 4) <= reviewTask.reasonsLong && reviewTask.reasonsLong < (1 << 20);
}  */


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list

/*
 * Copyright (c) 2016 Kaj Magnus Lindberg
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
   module debiki2 {
//------------------------------------------------------------------------------


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


export function notfLevel_title(notfLevel: NotfLevel): string {
  switch (notfLevel) {
    case NotfLevel.WatchingAll: return "Watching Alll";
    case NotfLevel.WatchingFirst: return "Watching First";
    case NotfLevel.Tracking: return "Tracking";
    case NotfLevel.Normal: return "Normal";
    case NotfLevel.Muted: return "Muted";
    default: return "?";
  }
}

export function post_isDeletedOrCollapsed(post: Post): boolean {
  return post.isPostDeleted || post.isTreeDeleted || post.isPostCollapsed || post.isTreeCollapsed;
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
  return me.postNrsAutoReadLongAgo.indexOf(post.nr) >= 0 ||
      me.postNrsAutoReadNow.indexOf(post.nr) >= 0;
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

export function store_isPageDeleted(store: Store): boolean {
  return !!store.pageDeletedAtMs || _.some(store.ancestorsRootFirst, a => a.isDeleted);
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
      currentCategory = _.find(store.categories, c => c.id === currentCategory.parentId);
    }
  }

  return may;
}


// Some dupl code! (8FUZWY02Q60)
export function store_mayIReply(store: Store, post: Post): boolean {
  // Each reply on a mind map page is a mind map node. Thus, by replying, one modifies the mind map
  // itself. So, one needs to be allowed to edit the *page*, to add (= reply) mind-map-posts. [7KUE20]
  if (store.pageRole === PageRole.MindMap)
    return store_mayIEditPage(store, post);

  let may: boolean;
  const ancestorCategories: Ancestor[] = store.ancestorsRootFirst;
  const me = store.me;

  // Later: [8PA2WFM] Perhaps let staff reply, although not approved. So staff can say
  // "If you please remove <sth that violates the site guidelines>, I'll approve the comment".
  // Or "I won't approve this comment. It's off-topic because ...".
  if (post_isDeletedOrCollapsed(post) || !post.isApproved)
    return false;

  if (store.pageMemberIds.indexOf(me.id) >= 0)
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

  const me = store.me;
  const isMindMap = store.pageRole === PageRole.MindMap;
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
  if (store.pageMemberIds.indexOf(me.id) >= 0 && isOwn)
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
  const ancestorCategories: Ancestor[] = store.ancestorsRootFirst;
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
  return _.filter(store.categories, (c: Category) => {
    if (c.isForumItself) return false;
    return store_mayICreateTopics(store, c);
  });
}



// Forum buttons
//----------------------------------

export function topPeriod_toString(period: TopTopicsPeriod): string {
  switch (period) {
    case TopTopicsPeriod.Day: return "Past Day";
    case TopTopicsPeriod.Week: return "Past Week";
    case TopTopicsPeriod.Month: return "Past Month";
    case TopTopicsPeriod.Quarter: return "Past Quarter";
    case TopTopicsPeriod.Year: return "Past Year";
    case TopTopicsPeriod.All: return "All Time";
    default: return '' + period;
  }
}



// Trust and threat levels
//----------------------------------

export function trustLevel_toString(trustLevel: TrustLevel): string {
  let level;
  switch (trustLevel) {
    case TrustLevel.New: level = "New"; break;
    case TrustLevel.Basic: level = "Basic"; break;
    case TrustLevel.Member: level = "Full"; break;
    case TrustLevel.Helper: level = "Trusted"; break;
    case TrustLevel.Regular: level = "Regular"; break;
    case TrustLevel.CoreMember: level = "Core"; break;
    default:
      // Guests have no trust level.
      return "Guest";
  }
  return level + " member";
}

export function threatLevel_toString(threatLevel: ThreatLevel): string {
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

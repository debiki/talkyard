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
/// <reference path="me-getters.ts" />
/// <reference path="utils/utils.ts" />
/// <reference path="../typedefs/lodash/lodash.d.ts" />


/* This Flux store is perhaps a bit weird, not sure. I'll switch to Redux or
 * Flummox or Fluxxor or whatever later, and rewrite everything in a better way?
 * Also perhaps there should be more than one store, so events won't be broadcasted
 * to everyone all the time.
 */

//------------------------------------------------------------------------------
   module debiki2 {
//------------------------------------------------------------------------------


export function store_thisIsMyPage(store: Store): boolean {
  if (!store.allPosts) return false;
  var bodyOrTitle = store.allPosts[BodyId] || store.allPosts[TitleId];
  dieIf(!bodyOrTitle, 'EsE5YKF2');
  return store.me.userId === bodyOrTitle.authorIdInt;
}


export function store_getAuthorOrMissing(store: Store, post: Post): BriefUser {
  var user = store_getUserOrMissing(store, post.authorIdInt, false);
  if (user.isMissing) logError("Author " + post.authorIdInt + " missing, page: " +
      debiki.pageId + ", post: " + post.postId + " [EsE6TK2R0]");
  return user;
}


export function store_getUserOrMissing(store: Store, userId: UserId, errorCode2): BriefUser {
  var user = store.usersByIdBrief[userId];
  if (!user) {
    if (errorCode2) logError("User " + userId + " missing, page: " + debiki.pageId +
        ' [EsE38GT2R-' + errorCode2 + ']');
    return {
      id: userId,
      // The first char is shown in the avatar image. Use a square, not a character, so
      // it'll be easier to debug-find-out that something is amiss.
      fullName: "□ missing, id: " + userId + " [EsE4FK07_]",
      isMissing: true,
    };
  }
  return user;
}


export function store_isUserOnline(store: Store, userId: UserId): boolean {
  return store.userIdsOnline && store.userIdsOnline[userId];
}


export function store_getPageMembersList(store: Store): BriefUser[] {
  return store.pageMemberIds.map(id => store_getUserOrMissing(store, id, 'EsE4UY2S'));
}


export function store_getUsersOnThisPage(store: Store): BriefUser[] {
  var users: BriefUser[] = [];
  _.each(store.allPosts, (post: Post) => {
    if (_.every(users, u => u.id !== post.authorIdInt)) {
      var user = store_getAuthorOrMissing(store, post);
      users.push(user);
    }
  });
  return users;
}


export function store_getUsersOnline(store: Store): BriefUser[] {
  var users = [];
  // (Using userId:any, otherwise Typescript thinks it's a string)
  _.forOwn(store.userIdsOnline, (alwaysTrue, userId: any) => {
    dieIf(!alwaysTrue, 'EsE7YKW2');
    var user = store_getUserOrMissing(store, userId, 'EsE5GK0Y');
    if (user) users.push(user);
  });
  return users;
}


export function store_getUsersHere(store: Store): UsersHere {
  var isChat = page_isChatChannel(store.pageRole);
  var users: BriefUser[];
  var listMembers = isChat;
  var listUsersOnPage = !listMembers && page_isDiscussion(store.pageRole);
  if (listMembers) {
    users = store_getPageMembersList(store);
  }
  else if (listUsersOnPage) {
    users = store_getUsersOnThisPage(store);
  }
  else {
    users = store_getUsersOnline(store);
  }
  var numOnline = 0;
  var iAmHere = false;
  _.each(users, (user: BriefUser) => {
    numOnline += store_isUserOnline(store, user.id) ? 1 : 0;
    iAmHere = iAmHere || user.id === store.me.id;
  });
  return {
    users: users,
    areChatChannelMembers: listMembers,
    areTopicContributors: listUsersOnPage,
    numOnline: numOnline,
    iAmHere: iAmHere,
    onlyMeOnline: iAmHere && numOnline === 1,
  };
}


export function store_canDeletePage(store: Store): boolean {
  // For now, don't let people delete sections = their forum — that just makes them confused.
  return !store.pageDeletedAtMs && isStaff(store.me) &&
      store.pageRole && !isSection(store.pageRole);
}


export function store_canUndeletePage(store: Store): boolean {
  return store.pageDeletedAtMs && isStaff(store.me);
}


export function store_canSelectPosts(store: Store): boolean {
  return isStaff(store.me) && !store_isSection(store) && store.pageRole !== PageRole.CustomHtmlPage;
}


// Returns the current category, or if none, the default category.
//
export function store_getCurrOrDefaultCat(store: Store): Category {
  var currCat = _.find(store.categories, (c: Category) => c.id === store.categoryId);
  if (currCat)
    return currCat;

  // Apparently we're showing all categories, haven't selected any specific category.
  return _.find(store.categories, (c: Category) => c.isDefaultCategory);
}


export function store_isSection(store: Store): boolean {
  return store.pageRole !== PageRole.Blog && store.pageRole !== PageRole.Forum;
}


export function store_thereAreFormReplies(store: Store): boolean {
  return _.some(store.allPosts, (post: Post) => {
    return post.postType === PostType.CompletedForm;
  });
}


export function store_shallShowPageToolsButton(store: Store) {
  return store_canPinPage(store) || store_canDeletePage(store) || store_canUndeletePage(store);
}


export function store_canPinPage(store: Store) {
  return store.categoryId && store.pageRole !== PageRole.Forum;
}


// Use for responsive layout, when you need the page width (excluding watchbar and contextbar).
// Avoid $().width() or elem.getBoundingClientRect() because they force a layout reflow,
// which makes the initial rendering of the page take longer (about 30ms longer = 8% longer,
// as of September 2016, core i7 laptop).
//
// Could use https://github.com/marcj/css-element-queries/, but store_getApproxPageWidth() is
// probably faster (since doesn't need to ask the browser about anything, no layout
// reflows needed), and simpler too (a lot less code, in total).
//
export function store_getApproxPageWidth(store: Store) {   // [6KP024]
  if (isServerSide())
    return ServerSideWindowWidth;

  // outerWidth supposedly doesn't force a reflow (and I've verified in Chrome Dev Tools Timeline
  // that it doesn't). So use it instead of innerWidth — they might differ perhaps 10 pixels
  // because of browser window borders (or what else? There are no window scrollbars [6GKF0WZ]).
  var browserWidth = window.outerWidth;
  var width = browserWidth;
  if (store.isWatchbarOpen) {
    width -= WatchbarWidth;
  }
  if (store.isContextbarOpen) {
    var contextbarWidth = browserWidth * 0.25;  // 0.25 is dupl in css [5RK9W2]
    if (contextbarWidth < ContextbarMinWidth) {
      contextbarWidth = ContextbarMinWidth;
    }
    width -= contextbarWidth;
  }
  // This is not the exact width in pixels, unless the browser window is in full screen so that
  // there are no browser window borders.
  return width;
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list

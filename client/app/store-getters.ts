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
  var pageBody = store.allPosts[BodyId];
  dieIf(!pageBody, 'EsE5YKF2');
  return store.me.userId === pageBody.authorIdInt;
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
      fullName: "□ missing, id: " + userId + " [EsE4FK07]",
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
  return !store.pageDeletedAtMs && isStaff(store.me) && !isSection(store.pageRole);
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


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list

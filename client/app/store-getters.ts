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


export function store_authorOf(store: Store, post: Post): BriefUser {
  var user = store.usersByIdBrief[post.authorIdInt];
  dieIf(!user, "Author " + post.authorIdInt + " missing on page " + store.pageId + " [EsE5GK92]");
  return user;
}


export function store_isUserOnline(store: Store, userId: UserId): boolean {
  return store.userIdsOnline && store.userIdsOnline[userId];
}


export function store_getPageMembersList(store: Store): BriefUser[] {
  return store.pageMemberIds.map(id => {
    var user = store.usersByIdBrief[id];
    dieIf(!user, "Member " + id + " missing on page " + store.pageId + " [EsE5KW2]");
    return user;
  });
}


export function store_getUsersOnThisPage(store: Store): BriefUser[] {
  var users: BriefUser[] = [];
  _.each(store.allPosts, (post: Post) => {
    if (_.every(users, u => u.id !== post.authorIdInt)) {
      var user = store.usersByIdBrief[post.authorIdInt];
      dieIf(!user, "Author missing, post id " + post.uniqueId + " [EsE4UGY2]");
      users.push(user);
    }
  });
  return users;
}


export function store_getUsersOnline(store: Store): BriefUser[] {
  var users = [];
  _.forOwn(store.userIdsOnline, (alwaysTrue, userId) => {
    dieIf(!alwaysTrue, 'EsE7YKW2');
    var user = store.usersByIdBrief[userId];
    logErrorIf(!user, 'EsE5JYK02');
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


export function store_isSection(store: Store): boolean {
  return store.pageRole !== PageRole.Blog && store.pageRole !== PageRole.Forum;
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list

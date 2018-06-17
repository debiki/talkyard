/*
 * Copyright (c) 2016-2018 Kaj Magnus Lindberg
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

// In this file: Constructs links, e.g. to a user's profile page.
// Usage: MenuItemLink({ href: linkToCurrentUserProfilePage(store) }, "View your profile")

/// <reference path="prelude.ts"/>
/// <reference path="utils/utils.ts"/>

//------------------------------------------------------------------------------
   namespace debiki2 {
//------------------------------------------------------------------------------

// In embedded comments, need incl the Talkyard server url, otherwise links will [EMBCMTSORIG]
// resolve to the embeddING server.
// Hack. Currently there's always exactly one store, and it always has remoteOriginOrEmpty set.
function origin(): string {
  // This needs to happen in a function, so gets reevaluated server side, where the same script
  // engine gets reused, for rendering pages at different sites, different origins.
  return (<any> window).theStore.remoteOriginOrEmpty;  // [ONESTORE]
}


export function linkToPageId(pageId: PageId): string {
  return origin() + '/-' + pageId;
}


export function linkToPostNr(pageId: PageId, postNr: PostNr): string {
  return origin() + linkToPageId(pageId) + '#post-' + postNr;
}


export function linkToAdminPage(me: Myself): string {
  // By default, redirects to path not available to non-admins. So send non-admins to reviews section.
  const morePath = me.isAdmin ? '' : 'review/all';
  return origin() + '/-/admin/' + morePath;
}

export function linkToAdminPageAdvancedSettings(hostname?: string): string {
  const origin = hostname ? '//' + hostname : '';   // ?? or just reuse 'origin' from above ?
  return origin + '/-/admin/settings/advanced';
}

export function linkToUserInAdminArea(userId: UserId): string {
  return origin() + '/-/admin/users/id/' + userId;
}

export function linkToReviewPage(): string {
  return origin() + '/-/admin/review/all';
}


export function linkToUserProfilePage(user: Myself | User | UserId | string): UserId | string {
  // If Myself specified, should be logged in and thus have username or id.
  // @ifdef DEBUG
  dieIf(_.isObject(user) && !(<any> user).username && !(<any> user).id, 'TyE7UKWQT2');
  // @endif

  const idOrUsername = _.isObject(user) ? (<User> user).username || (<User> user).id : user;
  return origin() + UsersRoot + idOrUsername;
}

export function linkToUsersNotfs(userIdOrUsername: UserId | string): string {
  return linkToUserProfilePage(userIdOrUsername) + '/notifications';
}

export function linkToSendMessage(userIdOrUsername: UserId | string): string {
  return linkToUserProfilePage(userIdOrUsername) + '/activity/posts#writeMessage';
}

export function linkToInvitesFromUser(userId: UserId): string {
  return linkToUserProfilePage(userId) + '/invites';
}

export function linkToMyProfilePage(store: Store): string {
  return origin() + UsersRoot + store.me.id;
}


export function linkToNotificationSource(notf: Notification): string {
  if (notf.pageId && notf.postNr) {
    return origin() + '/-' + notf.pageId + '#post-' + notf.postNr;
  }
  else {
    die("Unknown notification type [EsE5GUKW2]")
  }
}


export function linkToRedirToAboutCategoryPage(categoryId: CategoryId): string {
  return origin() + '/-/redir-to-about?categoryId=' + categoryId;
}


export function linkToTermsOfUse(): string {
  return origin() + '/-/terms-of-use';
}

export function linkToAboutPage(): string {
  return origin() + '/about';
}


export function linkToUpload(origins: Origins, uploadsPath: string): string {
  // If there's a CDN, always access uploaded pics via the CDN. Or,
  // if we're in an embedded comments discussion, access the pics via the Talkyard
  // server's origin = the remote origin. Otherwise, no origin needed (empty string).
  const origin = origins.anyCdnOrigin || origins.remoteOriginOrEmpty;
  const uploadsUrlBasePath = '/-/u/';
  return origin + uploadsUrlBasePath + origins.pubSiteId + '/' + uploadsPath;
}


export function rememberBackUrl(url: string) {
  // Skip API pages — those are the ones we're returning *from*. (Don't require === 0 match;
  // there might be a hostname. Matching anywhere is ok, because the prefix is '/-/' and
  // that substring isn't allowed in other non-api paths.)
  if (url.search(ApiUrlPathPrefix) >= 0) {
    return;
  }
  debiki2.putInSessionStorage('returnToSiteUrl', url);
}


/**
 * Navigates back to the page that the user viewed before s/he entered the admin or
 * about-user area, or to the homepage ('/') if there's no previous page.
 */
export function goBackToSite() {
  // Hmm, could inline this instead. Was more complicated in the past, when using
  // an URL param instead of sessionStorage.
  const previousUrl = getFromSessionStorage('returnToSiteUrl') || '/';
  window.location.replace(previousUrl);
}


export function externalLinkToAdminHelp(): string {
  return 'https://www.talkyard.io/forum/latest/support';
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list

/*
 * Copyright (C) 2015 Kaj Magnus Lindberg
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY, without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

export interface IntfDecl {
  nubmer123: 123;  // has to be number 123
}

// why can define const in  d.ts  file??
// Or no, cannot, causes this weird error:
//   ERROR in ./client/serviceworker-wptest/service-worker.ts 9:0-46
//   Module not found: Error: Can't resolve './const-enums.wp' in '/home/kajmagnus/styd/d7/client/serviceworker-wptest'
// export const NotInlined = 'NotInlined_NotInlined';

// If the service worker js and the page js, are the same version, they'll
// accept each other's messages. Otherwise:
// 1) If the page js is newer, it registers a new up-to-date service worker [REGSW],
// and waits for it to claim the page. Thereafter the page and the service
// worker happily talk with each other.
// 2) If the sw js is newer, it'll reject messages from the page,
// and tell the page to show a dialog "Please refresh. New version available".
// This is a separate version number, so won't need to reinstall the service
// worker, if it didn't change. Hmm?
export declare const enum TyCs {
  TalkyardVersion = 'debug-build-0001',
  // @ifdef DEBUG
  // gulp-preprocess hasn't been configured to processes debug builds ...
  //'debug-build-0001',
  // @endif
  // ... only prod builds, so this'll work:
  // '/* @echo TALKYARD_VERSION */',


  ReactStartedClass = 'dw-react-started',

  EmptyPageId = '0',
  NumEmptyPageDummyPosts = 2, // orig post dummy title and body

// When self hosting, exactly one site is created, by default, and its id is FirstSiteId.
  FirstSiteId = 1,

  NoId = 0,
  NoCategoryId = 0,
  NoPermissionId = 0,

  NoPostId = -1,  // dupl in reply.js
  TitleNr = 0,
  BodyNr = 1,
  BodyNrStr = '1',
  FirstReplyNr = 2,
  NoDraftNr = 0,

// Posts nrs below this, are previews of reply drafts not yet published.
  MaxVirtPostNr = -1000_000,
  MinRealPostNr = TitleNr,

  NoUserId = 0,
  SystemUserId = 1,
  SysbotUserId = 2,
  MinMemberId = SystemUserId,
  LowestAuthenticatedUserId = 100,   // also in scala  [8PWK1Q2W]
  LowestNormalMemberId = 10,         // also in scala  [S7KPWG42]
  MaxUsernameLength = 20,            // in scala [6AKBR20Q]

  MaxGuestId = -2,
  UnknownUserId = -3,
//  CurrentUserNotLoggedInId = -1?  or  -4,  ?

  ReviewDecisionUndoTimoutSeconds = 12, // sync with Scala and test code [2PUKQB0]

  ManualReadMark = 1,
  YellowStarMark = 2,
  FirstStarMark = 2,
  BlueStarMark = 3,
  LastStarMark = 3,

// Sync with Scala, and an input error checker [6KG2W57]
  MaxNumFirstPosts = 10,

  MaxEmailsPerUser = 5,  // also in scala [4GKRDF0]

// If we try to load a user with this id, or a post with this nr, etc, then
// something is amiss. Can then show and error or do nothing.
  TooHighNumber = 100e6,  // [05RKVJWG2]

// Send back IgnoreThisError to the caller from an error callback, and the caller won't
// continue with its default error handling — it'll ignore the error.
// Send back undefined or anything else to the caller, and the error will be considered.
/*
type ErrorPolicy = number | void,

  IgnoreThisError: ErrorPolicy = -112233,
  ShowNoErrorDialog: ErrorPolicy = -112234,
  */

  UseBeacon = 'UseBeacon',

  /*
  SiteStatusStrings = [
  'NoAdmin',
  'Active',
  'ReadAndCleanOnly',
  'HiddenUnlessStaff',
  'HiddenUnlessAdmin',
  'Deleted',
  'Purged'],
  */


  ApiUrlPathPrefix = '/-/',
  UsersRoot = '/-/users/',
  GroupsRoot = '/-/groups/',
  SearchRootPath = '/-/search',
  AdminRoot = '/-/admin/',


  RoutePathLatest = 'latest',  // change to 'active'?  here too: [394SMDLW20] + 99 more places?
  RoutePathNew = 'new',
  RoutePathTop = 'top',
  RoutePathCategories = 'categories',


  ImpersonationCookieName = 'esCoImp',


// Some CSS and layout related constants. [6PFDS3]
  UseWideForumLayoutMinWidth = 1000,
  UseWidePageLayoutMinWidth = 750,
  WatchbarWidth = 230,  // dupl in css [7GYK42]
  ContextbarMinWidth = 270,  // dupl in css [4FK0ZD]

  ServerSideWindowWidthMobile = 500,
  ServerSideWindowWidthLaptop = 1200,


  //OriginRegex = /^https?:\/\/[^/]+/i,  // CLEAN_UP this regex not in use everywhere, some dupl regexs

  FragActionAndReplyToPost = '&replyToPost',
  FragActionAndEditPost = '&editPost',
  FragActionHashComposeTopic = '#composeTopic',
  FragActionHashComposeMessage = '#composeDirectMessage',
  FragActionHashScrollLatest = '#scrollToLatestPost',
  FragActionHashScrollToBottom  = '#scrollToBottom',  // rename to ...BottomButtons?


// The post nr param looks a bit different, '-' not '=', because it's used in urls to link to
// posts, so nice if it uses '-' like url tend to do. Whereas the other params are more like
// api request params to the Javascript code, so then they can look like code & url params?
  FragParamPostNr = '#post-',
  FragParamCommentNr = '#comment-',
  FragParamDraftNr = '&draftNr=',
  FragParamReplyType = '&replyType=',
  FragParamTopicType = '&topicType=',
  FragParamCategoryId = '&categoryId=',

}
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list

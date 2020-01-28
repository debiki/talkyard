/*
 * Copyright (C) 2015 Kaj Magnus Lindberg
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

// If the service worker js and the page js, are the same version, they'll
// accept each other's messages. Otherwise:
// 1) If the page js is newer, it registers a new up-to-date service worker [REGSW],
// and waits for it to claim the page. Thereafter the page and the service
// worker happily talk with each other.
// 2) If the sw js is newer, it'll reject messages from the page,
// and tell the page to show a dialog "Please refresh. New version available".
// This is a separate version number, so won't need to reinstall the service
// worker, if it didn't change. Hmm?
const TalkyardVersion =
  // @ifdef DEBUG
  // gulp-preprocess hasn't been configured to processes debug builds ...
  'debug-build-0001';
  // @endif
  // ... only prod builds, so this'll work:
  '/* @echo TALKYARD_VERSION */';


const ReactStartedClass = 'dw-react-started';

const EmptyPageId = '0';
const NumEmptyPageDummyPosts = 2; // orig post dummy title and body

// When self hosting, exactly one site is created, by default, and its id is FirstSiteId.
const FirstSiteId = 1;

const NoId = 0;
const NoCategoryId = 0;
const NoPermissionId = 0;

const NoPostId = -1;  // dupl in reply.js
const TitleNr = 0;
const BodyNr = 1;
const BodyNrStr = '1';
const FirstReplyNr = 2;
const NoDraftNr = 0;

// Posts nrs below this, are previews of reply drafts not yet published.
const MaxVirtPostNr = -1000 * 1000;
const MinRealPostNr = TitleNr;

const NoUserId = 0;
const SystemUserId = 1;
const SysbotUserId = 2;
const MinMemberId = SystemUserId;
const LowestAuthenticatedUserId = 100;   // also in scala  [8PWK1Q2W]
const LowestNormalMemberId = 10;         // also in scala  [S7KPWG42]
const MaxUsernameLength = 20;            // in scala [6AKBR20Q]

const MaxGuestId = -2;
const UnknownUserId = -3;
//const CurrentUserNotLoggedInId = -1?  or  -4;  ?

const ReviewDecisionUndoTimoutSeconds = 12; // sync with Scala and test code [2PUKQB0]

const ManualReadMark = 1;
const YellowStarMark = 2;
const FirstStarMark = 2;
const BlueStarMark = 3;
const LastStarMark = 3;

// Sync with Scala, and an input error checker [6KG2W57]
const MaxNumFirstPosts = 10;

const MaxEmailsPerUser = 5;  // also in scala [4GKRDF0]

// If we try to load a user with this id, or a post with this nr, etc, then
// something is amiss. Can then show and error or do nothing.
const TooHighNumber = 100e6;  // [05RKVJWG2]

// Send back IgnoreThisError to the caller from an error callback, and the caller won't
// continue with its default error handling — it'll ignore the error.
// Send back undefined or anything else to the caller, and the error will be considered.
type ErrorPolicy = number | void;

const IgnoreThisError: ErrorPolicy = -112233;
const ShowNoErrorDialog: ErrorPolicy = -112234;

const UseBeacon = 'UseBeacon';

const SiteStatusStrings = [
  'NoAdmin',
  'Active',
  'ReadAndCleanOnly',
  'HiddenUnlessStaff',
  'HiddenUnlessAdmin',
  'Deleted',
  'Purged'];


const ApiUrlPathPrefix = '/-/';
const UsersRoot = '/-/users/';
const GroupsRoot = '/-/groups/';
const SearchRootPath = '/-/search';


const RoutePathLatest = 'latest';  // change to 'active'?  here too: [394SMDLW20] + 99 more places?
const RoutePathNew = 'new';
const RoutePathTop = 'top';
const RoutePathCategories = 'categories';


const ImpersonationCookieName = 'esCoImp';


// Some CSS and layout related constants. [6PFDS3]
const UseWideForumLayoutMinWidth = 1000;
const UseWidePageLayoutMinWidth = 750;
const WatchbarWidth = 230;  // dupl in css [7GYK42]
const ContextbarMinWidth = 270;  // dupl in css [4FK0ZD]

const ServerSideWindowWidthMobile = 500;
const ServerSideWindowWidthLaptop = 1200;


const OriginRegex = /^https?:\/\/[^/]+/i;  // CLEAN_UP this regex not in use everywhere, some dupl regexs

const FragActionAndReplyToPost = '&replyToPost';
const FragActionAndEditPost = '&editPost';
const FragActionHashComposeTopic = '#composeTopic';
const FragActionHashComposeMessage = '#composeDirectMessage';
const FragActionHashScrollLatest = '#scrollToLatestPost';
const FragActionHashScrollToBottom  = '#scrollToBottom';  // rename to ...BottomButtons?


// The post nr param looks a bit different, '-' not '=', because it's used in urls to link to
// posts, so nice if it uses '-' like url tend to do. Whereas the other params are more like
// api request params to the Javascript code, so then they can look like code & url params?
const FragParamPostNr = '#post-';
const FragParamCommentNr = '#comment-';
const FragParamDraftNr = '&draftNr=';
const FragParamReplyType = '&replyType=';
const FragParamTopicType = '&topicType=';
const FragParamCategoryId = '&categoryId=';


// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list

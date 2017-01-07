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

var ReactStartedClass = 'dw-react-started';

var EmptyPageId = '0';
var FirstSiteId = '1';

var NoPostId = -1;  // dupl in reply.js
var TitleNr = 0;
var BodyNr = 1;
var FirstReplyNr = 2;

let NoUserId = 0;
var SystemUserId = -1;
var MinMemberId = SystemUserId;

var MaxGuestId = -2;
var UnknownUserId = -3;


var ManualReadMark = 1;
var YellowStarMark = 2;
var FirstStarMark = 2;
var BlueStarMark = 3;
var LastStarMark = 3;

// Sync with Scala, and an input error checker [6KG2W57]
var MaxNumFirstPosts = 10;


enum SiteStatus {
  NoAdmin = 1,
  Active = 2,
  ReadAndCleanOnly = 3,
  HiddenUnlessStaff = 4,
  HiddenUnlessAdmin = 5,
  Deleted = 6,
  Purged = 7,
}

var SiteStatusStrings = [
  'NoAdmin',
  'Active',
  'ReadAndCleanOnly',
  'HiddenUnlessStaff',
  'HiddenUnlessAdmin',
  'Deleted',
  'Purged'];

enum HostRole {
  Canonical = 1,
  Redirect = 2,
  Link = 3,
  Duplicate = 4,
}

enum PricePlan {  // [4GKU024S]
  Unknown = 0,
  NonCommercial = 1,
  Business = 2,
}

enum LoginReason {
  SignUp = 13,
  LoginToChat = 10,
  LoginToLike = 11,
  BecomeAdmin = 12,
}


enum PinPageWhere {
  InCategory = 1,
  Globally = 3,
}


enum PageRole { // dupl in client/e2e/test-types.ts [5F8KW0P2]
  CustomHtmlPage = 1,
  WebPage = 2,  // rename to Info?
  Code = 3,
  SpecialContent = 4,
  EmbeddedComments = 5,
  Blog = 6,
  Forum = 7,
  About = 9,
  Question = 10,
  Problem = 14,
  Idea = 15,
  ToDo = 13,  // remove? [4YK0F24]
  MindMap = 11,
  Discussion = 12,
  FormalMessage = 17,
  OpenChat = 18,
  PrivateChat = 19,
  // DirectMessage = 20,
  Form = 20,  // try to remove?
  Critique = 16, // [plugin]
  UsabilityTesting = 21, // [plugin]
}


enum PostType {
  Normal = 1,
  Flat = 2,
  StaffWiki = 11,
  CommunityWiki = 12,
  CompletedForm = 21,
}


// Could change to PageLayout bitmask. For now though:
enum TopicListLayout {
  TitleOnly = 1,
  TitleExcerptSameLine = 2,
  ExcerptBelowTitle = 3,
  ThumbnailLeft = 4,
  ThumbnailsBelowTitle = 5,
}


// Determines which write-post guidelines will be shown in the editor.
enum WritingWhat {
  NewPage = 1,
  ReplyToOriginalPost = 2,
  ReplyToNotOriginalPost = 3,
  ChatComment = 4,
}


enum Presence {
  Active = 1,
  Away = 2,
}


enum NotificationType {
  DirectReply = 1,
  Mention = 2,
  // Quote = 3,
  Message = 4,
  NewPost = 5,
  PostTagged = 6,
}


enum NotfLevel {
  WatchingAll = 1,
  WatchingFirst = 2,
  Tracking = 3,
  Normal = 4,
  Muted = 5,
}


enum WatchbarSection {
  RecentTopics = 1,
  Notifications = 2,
  ChatChannels = 3,
  DirectMessages = 4,
}


enum TrustLevel {
  New = 1,
  Basic = 2,
  Member = 3,
  Regular = 4,
  CoreMember = 5,
}


enum ThreatLevel {
  HopefullySafe = 3,
  MildThreat = 4,
  ModerateThreat = 5,
  SevereThreat = 6,
}


/** The review reasons are a 64 bit bitflag. See this Scala file for their meanings:
  *   modules/debiki-core/src/main/scala/com/debiki/core/ReviewReason.scala
  */
var ReviewReasons = {
  isByThreatUser: (reviewTask: ReviewTask) => reviewTask.reasonsLong & (1 << 0),
  isByNewUser: (reviewTask: ReviewTask) => reviewTask.reasonsLong & (1 << 1),
  newPost: (reviewTask: ReviewTask) => reviewTask.reasonsLong & (1 << 4),
  noBumpPost: (reviewTask: ReviewTask) => reviewTask.reasonsLong & (1 << 5),
  edit: (reviewTask: ReviewTask) => reviewTask.reasonsLong & (1 << 6),
  lateEdit: (reviewTask: ReviewTask) => reviewTask.reasonsLong & (1 << 7),
  postFlagged: (reviewTask: ReviewTask) => reviewTask.reasonsLong & (1 << 8),
  postUnpopular: (reviewTask: ReviewTask) => reviewTask.reasonsLong & (1 << 9),
  postIsSpam: (reviewTask: ReviewTask) => reviewTask.reasonsLong & (1 << 10),
  userCreated: (reviewTask: ReviewTask) => reviewTask.reasonsLong & (1 << 20),
  userNewAvatar: (reviewTask: ReviewTask) => reviewTask.reasonsLong & (1 << 21),
  userNameEdited: (reviewTask: ReviewTask) => reviewTask.reasonsLong & (1 << 22),
  userAboutTextEdited: (reviewTask: ReviewTask) => reviewTask.reasonsLong & (1 << 23),
};

function isReviewPostTask(reviewTask: ReviewTask): boolean {
  // See above. <<0 .. <<3 are for user types. <<4 ..<<19 are for review-post stuff.
  // And <<20 and up are for users. Later: uploads? groups? categories?
  return (1 << 4) <= reviewTask.reasonsLong && reviewTask.reasonsLong < (1 << 20);
}


var ApiUrlPathPrefix = '/-/';


var RoutePathLatest = 'latest';
var RoutePathTop = 'top';
var RoutePathCategories = 'categories';


var ImpersonationCookieName = 'esCoImp';


// Some CSS and layout related constants. [6PFDS3]
var UseWideForumLayoutMinWidth = 1000;
var UseWidePageLayoutMinWidth = 750;
var WatchbarWidth = 230;  // dupl in css [7GYK42]
var ContextbarMinWidth = 270;  // dupl in css [4FK0ZD]

// No idea what we're rendering for, but mobile phones are common, and slow, so
// let's help them by trying to give them the correct layout directly.
// Assume a horizontally tilted phone.
var ServerSideWindowWidth = 700;


// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list

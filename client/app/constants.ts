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

var BodyId = 1;
var NoPostId = -1;  // dupl in reply.js

var SystemUserId = -1;
var MinMemberId = SystemUserId;

var MaxGuestId = -2;
var UnknownUserId = -3;


var ManualReadMark = 1;
var YellowStarMark = 2;
var FirstStarMark = 2;
var BlueStarMark = 3;
var LastStarMark = 3;


enum LoginReason {
  LoginToChat = 10,
  LoginToLike = 11,
}


enum PinPageWhere {
  InCategory = 1,
  Globally = 3,
}


enum PageRole {
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
  ToDo = 13,
  MindMap = 11,
  Discussion = 12,
  OpenChat = 18,
  PrivateChat = 19,
  Message = 17,
  Critique = 16, // [plugin]
}


enum PostType {
  Normal = 1,
  Flat = 2,
  StaffWiki = 11,
  CommunityWiki = 12,
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
}


enum WatchbarSection {
  RecentTopics = 1,
  Notifications = 2,
  ChatChannels = 3,
  DirectMessages = 4,
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

// Enable some hard-to-use features for me only right now.
declare var debiki: any;
var IsEffectiveDiscussionsDotOrg = (typeof debiki !== 'undefined') && debiki.siteId === '3';

// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list

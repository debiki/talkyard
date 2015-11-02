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

/// <reference path="constants.ts" />

var TitleId = 0;
var BodyPostId = 1;


interface PostToModerate {
  pageId: string;
  pageName: string;
  id: number;
  status: string;
  type: string;
  cdati: string;
  approvedText?: string;
  unapprovedText?: string;
  userId: string;
  userDisplayName: string;
  numEditsToReview?: string;
  numHandledFlags?: number;
  numPendingFlags?: number;
  numPendingEditSuggestions?: number;
  pendingFlags?: any[];
  postHiddenAt?: string;
  postDeletedAt?: string;
  treeDeletedAt?: string;
}


interface Flag {
  flaggerId: number;
  flaggerDisplayName: string;
  flagType: string;
  flagReason?: string;
}


interface Post {
  uniqueId: number; // TODO rename to id
  postId: number;   // TODO rename to nr
  parentId: number;
  multireplyPostIds: number[];
  postType?: PostType;
  authorId: string; // COULD change to int and then rename authorIdInt below to authorId.
  authorIdInt: number;
  authorFullName: string;
  authorUsername: string;
  authorSuspendedTill?: any;
  createdAt: string;
  lastApprovedEditAt: string;
  numEditors: number;
  numLikeVotes: number;
  numWrongVotes: number;
  numBuryVotes: number;
  numUnwantedVotes: number;
  numPendingEditSuggestions: number;
  summarize: boolean;
  summary?: string;
  squash: boolean;
  isPostHidden?: boolean;
  isTreeDeleted: boolean;
  isPostDeleted: boolean;
  // === true means totally collapsed. === 'Truncated' means collapsed but parts of post shown.
  isTreeCollapsed: any; // COULD rename
  isPostCollapsed: boolean;
  isTreeClosed: boolean;
  isApproved: boolean;
  pinnedPosition: number;
  likeScore: number;
  childIdsSorted: number[];
  sanitizedHtml: string;
}


interface PostRevision {
  revisionNr: number;
  previousNr?: number;
  fullSource?: string;
  composedAtMs: number;
  composedById: number;
  approvedAtMs?: number;
  approvedById?: number;
  hiddenAtMs?: number;
  hiddenById?: number;
}


interface User {
  userId: number;
  isLoggedIn?: boolean;
  isAdmin?: boolean;
  isModerator?: boolean;
  isAuthenticated?: boolean;
  username?: string;
  fullName?: string;
  rolePageSettings: any;
  votes: any;
  unapprovedPosts: any;
  postIdsAutoReadLongAgo: number[];
  postIdsAutoReadNow: number[];
  marksByPostId: { [postId: number]: any };
  pageHelpMessage?: HelpMessage;
  closedHelpMessages?: { [id: string]: number };  // id --> closed version of message
}


interface HelpMessage {
  id: string;
  version: number;
  content: any;
}


interface Category {
  id: number;
  name: string;
  slug: string;
  newTopicTypes: PageRole[];
  position?: number;
  description: string;
  recentTopics?: Topic[];
  isTheUncategorizedCategory?: boolean;
  isForumItself?: boolean;
}


interface Topic {
  pageId: string;
  pageRole: PageRole;
  title: string;
  url: string;
  categoryId: number;
  pinOrder?: number;
  pinWhere?: PinPageWhere;
  excerpt?: string;
  numPosts: number;
  numLikes: number;
  numWrongs: number;
  createdEpoch: string;
  bumpedEpoch: string;
  lastReplyEpoch: string;
  numOrigPostReplies: number;
  numOrigPostLikes: number;
  answeredAtMs?: string;
  answerPostUniqueId?: number;
  plannedAtMs?: string;
  doneAtMs?: string;
  closedAtMs?: string;
  lockedAtMs?: string;
  frozenAtMs?: string;
}


enum TopicSortOrder { BumpTime = 1, LikesAndBumpTime };


interface OrderOffset {  // COULD rename to TopicQuery? (because includes filter too now)
  sortOrder: TopicSortOrder;
  time?: number;
  numLikes?: number;
  topicFilter?: string;
}


interface Store {
  now: number;
  siteStatus: string;
  guestLoginAllowed: boolean;
  userMustBeAuthenticated: boolean;
  userMustBeApproved: boolean;
  pageId: string;
  categoryId?: number;
  ancestorsRootFirst?: Ancestor[];
  hideForumIntro?: boolean;
  pageRole: PageRole;
  pagePath: string;
  pinOrder?: number;
  pinWhere?: PinPageWhere;
  pageAnsweredAtMs?: number;
  pageAnswerPostUniqueId?: number;
  pageAnswerPostNr?: number;
  pagePlannedAtMs?: number;
  pageDoneAtMs?: number;
  pageClosedAtMs?: number;
  pageLockedAtMs?: number;
  pageFrozenAtMs?: number;
  //pageDeletedAtMs: number;
  numPosts: number;
  numPostsRepliesSection: number;
  numPostsChatSection: number;
  numPostsExclTitle: number;
  maxUploadSizeBytes: number;
  isInEmbeddedCommentsIframe: boolean;
  categories: Category[];
  newCategoryId: string; // would like to remove. Later, when everything is one SPA and there's just one router available from everywhere. Then I can transition directly to the new category without this variable.
  newCategorySlug: string; // would like to remove
  user: User;
  userSpecificDataAdded?: boolean;
  newUserAccountCreated?: boolean;
  rootPostId: number;
  allPosts: { [postId: number]: Post };
  topLevelCommentIdsSorted: number[];
  horizontalLayout: boolean;
  is2dTreeDefault: boolean;
  socialLinksHtml: string;

  // If quickUpdate is true only posts in postsToUpdate will be updated.
  quickUpdate: boolean;
  postsToUpdate: { [postId: number]: boolean };
}


interface Ancestor {
  categoryId: number;
  title: string;
  path: string;
}


interface SettingFromServer<T> {
  name: string;
  defaultValue: T;
  anyAssignedValue?: T;
}


interface Setting {  // rename to SettingToSave
  type: string;  // 'WholeSite' or 'PageTree' or 'SinglePage'
  pageId?: string;
  name: string;
  newValue: any;
}


interface SpecialContent {
  rootPageId: string;
  contentId: string;
  defaultText: string;
  anyCustomText?: string;
}


interface Guest {
  id: any;  // TODO change to number, and User.userId too
  fullName: string;
  email: string;
  country: string;
  url: string;
}


interface CompleteUser {
  id: any;  // TODO change to number, and User.userId too
  createdAtEpoch: number;
  username: string;
  fullName: string;
  email: string;
  emailForEveryNewPost: boolean;
  country: string;
  url: string;
  isAdmin: boolean;
  isModerator: boolean;
  isApproved: boolean;
  approvedAtEpoch: number;
  approvedById: number;
  approvedByName: string;
  approvedByUsername: string;
  suspendedAtEpoch?: number;
  suspendedTillEpoch?: number;
  suspendedById?: number;
  suspendedByUsername?: string;
  suspendedReason?: string;
}


interface Invite {
  invitedEmailAddress: string;
  invitedById: number;
  createdAtEpoch: number;
  acceptedAtEpoch?: number;
  invalidatedAtEpoch?: number;
  deletedAtEpoch?: number;
  deletedById?: number;
  userId?: number;
  // Later:
  /*
  userFullName?: string;
  userUsername?: string;
  userLastSeenAtEpoch?: number;
  userNumTopicsViewed?: number;
  userNumPostsRead?: number;
  userReadTime?: number;
  userDayVisited?: number;
  userTrustLevel?: number;
  userThreatLevel?: number;
  */
}


interface Blocks {
  isBlocked: boolean;
  reason?: string;
  blockedForever?: boolean;
  blockedTillMs?: number;
  blocks?: Block[];
}


interface Block {
  ip?: string;
  browserIdCookie?: string;
  blockedById: number;
  blockedAtMs: number;
  blockedTillMs?: number;
}


// vim: et ts=2 sw=2 tw=0 fo=r list

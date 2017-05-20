/*
 * Copyright (C) 2015-2017 Kaj Magnus Lindberg
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

type PageId = string;
type PostId = number;
type PostNr = number;
type PageVersion = number;
type CategoryId = number;
type SiteId = String;
type SiteVersion = number;
type LoginId = String;
type UserId = number;
type PeopleId = UserId;
type PermissionId = number;
type NotificationId = number;
type ReviewTaskId = number;
type IdentityId = String;
type IpAddress = String;
type EmailId = String;
type AuditLogEntryId = number;
type TagLabel = string;
type DateMs = number;

type HttpRequest = XMLHttpRequest

// Send back IgnoreThisError to the caller from an error callback, and the caller won't
// continue with its default error handling — it'll ignore the error.
// Send back undefined or anything else to the caller, and the error will be considered.
type ErrorPolicy = number | void;



interface PostToModerate {
  pageId: string;
  pageName: string;
  id: number;   // rename to nr? CLEAN_UP
  status: string;
  type: string;
  cdati: string;
  approvedText?: string;
  unapprovedText?: string;
  userId: UserId;
  userDisplayName: string;
  numEditsToReview?: string;
  numHandledFlags?: number;
  numPendingFlags?: number;
  numPendingEditSuggestions?: number;
  pendingFlags?: any[];
  postHiddenAt?: string;  // change to millis
  postDeletedAt?: string;  // change to millis
  treeDeletedAt?: string;  // change to millis
}


interface ReviewTask {
  id: number;
  //causedBy: BriefUser;
  reasonsLong: number;
  createdAtMs: number;
  moreReasonsAtMs?: number;
  completedAtMs?: number;
  completedBy?: BriefUser;
  invalidatedAtMs?: number;
  //resolution?: ?;
  user?: BriefUser;
  pageId?: string;
  pageTitle?: string;
  post?: PostToReview;
}


interface PostToReview {
  pageId: PageId;
  nr: PostNr;
  uniqueId: PostId;
  createdBy?: UserId;
  currentSource: string;
  currRevNr: number;
  currRevComposedBy?: UserId;
  approvedSource?: string;
  approvedHtmlSanitized?: string;
  approvedRevNr?: number;
  // approvedRevComposedById
  //approvedRevApprovedById
  // better: post.lastApporvedRevision.approvedById
  bodyHiddenAtMs?: number;
  bodyHiddenById?: UserId;
  bodyHiddenReason?: string;
}


enum ReviewAction {
  Accept = 1,
  DeletePostOrPage = 2,
}


interface Flag {
  flaggerId: number;
  flaggerDisplayName: string;
  flagType: string;
  flagReason?: string;
}


interface Post {
  uniqueId: number; // CLEAN_UP RENAME to id
  nr: number;
  parentNr: number;
  multireplyPostNrs: number[];
  postType?: PostType;
  authorId: UserId;
  createdAtMs: number;
  lastApprovedEditAtMs: number;
  numEditors: number;
  numLikeVotes: number;
  numWrongVotes: number;
  numBuryVotes: number;
  numUnwantedVotes: number;
  numPendingEditSuggestions: number;
  summarize: boolean;
  summary?: string;
  squash: boolean;
  isBodyHidden?: boolean;
  isTreeDeleted: boolean;
  isPostDeleted: boolean;
  // === true means totally collapsed. === 'Truncated' means collapsed but parts of post shown.
  isTreeCollapsed: any; // COULD rename
  isPostCollapsed: boolean;
  isTreeClosed: boolean;
  isApproved: boolean;
  pinnedPosition: number;
  branchSideways: number;
  likeScore: number;
  childIdsSorted: number[];
  sanitizedHtml?: string;
  tags?: string[];
  numPendingFlags?: number;
  numHandledFlags?: number;
}


enum PostType {
  Normal = 1,
  Flat = 2,
  StaffWiki = 11,
  CommunityWiki = 12,
  CompletedForm = 21,
}


// Determines which write-post guidelines will be shown in the editor.
enum WritingWhat {
  NewPage = 1,
  ReplyToOriginalPost = 2,
  ReplyToNotOriginalPost = 3,
  ChatComment = 4,
}


interface PostWithPage extends Post {
  pageId: PageId;
  pageTitle: string;
  pageRole: PageRole;
}


interface PostSettings {
  branchSideways: number;
}

interface PostRevision {
  revisionNr: number;
  previousNr?: number;
  fullSource?: string;
  composedAtMs: number;
  composedBy: BriefUser;
  approvedAtMs?: number;
  approvedBy?: BriefUser;
  hiddenAtMs?: number;
  hiddenBy?: BriefUser;
}


interface Myself {
  id?: UserId;
  isLoggedIn?: boolean;
  isAdmin?: boolean;
  isModerator?: boolean;
  isAuthenticated?: boolean;  // change to !isGuest? — no, there are strangers too.
  username?: string;
  fullName?: string;
  avatarUrl?: string;
  rolePageSettings: PageUserSettings;
  trustLevel: TrustLevel;
  threatLevel: ThreatLevel;
  permsOnPages: PermsOnPage[];

  numUrgentReviewTasks: number;
  numOtherReviewTasks: number;

  numTalkToMeNotfs: number;
  numTalkToOthersNotfs: number;
  numOtherNotfs: number;
  thereAreMoreUnseenNotfs: boolean;
  notifications: Notification[];

  watchbarTopics?: WatchbarTopics;
  watchbar: Watchbar;

  restrictedTopics: Topic[];
  restrictedCategories: Category[];

  votes: any; // RENAME to votesByPostNr?   CLEAN_UP also see just below:  id or nr
  unapprovedPosts: { [id: number]: Post };
  unapprovedPostAuthors: BriefUser[];
  postNrsAutoReadLongAgo: number[];
  postNrsAutoReadNow: number[];
  marksByPostId: { [postId: number]: any }; // sleeping BUG: probably using with Nr (although the name implies ID), but should be ID
  readingProgress?: ReadingProgress;
  pageHelpMessage?: HelpMessage;
  closedHelpMessages: { [id: string]: number };  // id --> closed version of message   — id or nr?
}


interface PermsOnPage {
  id: PermissionId;
  forPeopleId: UserId;
  onWholeSite?: boolean;
  onCategoryId?: CategoryId;
  onPageId?: PageId;
  onPostId?: PostId;
  // later: onTagId?: TagId;
  mayEditPage?: boolean;
  mayEditComment?: boolean;
  mayEditWiki?: boolean;
  mayEditOwn?: boolean;
  mayDeletePage?: boolean;
  mayDeleteComment?: boolean;
  mayCreatePage?: boolean;
  mayPostComment?: boolean;
  maySee?: boolean;
  maySeeOwn?: boolean;
}


interface PageUserSettings {
  notfLevel: NotfLevel;
}


enum NotfLevel {
  WatchingAll = 1,
  WatchingFirst = 2,
  Tracking = 3,
  Normal = 4,
  Muted = 5,
}


interface Notification {
  id: number;
  type: NotificationType;
  createdAtMs: number;
  seen: boolean;
  byUser?: BriefUser;
  pageId?: string;
  pageTitle?: string;
  postNr?: number;
}


enum NotificationType {
  DirectReply = 1,
  Mention = 2,
  // Quote = 3,
  Message = 4,
  NewPost = 5,
  PostTagged = 6,
}


interface NotfSubject {
  tagLabel?: string;
  pageId?: PageId;
}


interface ReadingProgress {
  lastViewedPostNr: number;
}


interface HelpMessage {
  id: string;
  version: number;
  content: any;
  className?: string;
  alwaysShow?: boolean;
}


interface Category {
  id: CategoryId;
  parentId?: CategoryId;
  name: string;
  slug: string;
  defaultTopicType: PageRole,
  newTopicTypes?: PageRole[];  // [refactor] [5YKW294] delete, use defaultTopicType instead
  position?: number;
  description: string;
  recentTopics?: Topic[];
  unlisted?: boolean;
  isDefaultCategory?: boolean;
  isForumItself?: boolean;
  isDeleted?: boolean;
}


enum TopicListLayout {
  Default = 0,
  TitleOnly = 1,
  TitleExcerptSameLine = 2,
  ExcerptBelowTitle = 3,
  ThumbnailLeft = 4,
  ThumbnailsBelowTitle = 5,
}


enum CategoriesLayout {
  Default = 0,
}



interface Topic {
  pageId: string;
  pageRole: PageRole;
  title: string;
  url: string;
  categoryId: number;
  authorId: UserId;
  lastReplyerId?: UserId;
  frequentPosterIds: UserId[];
  pinOrder?: number;
  pinWhere?: PinPageWhere;
  excerpt?: string;
  firstImageUrls?: string[];
  popularRepliesImageUrls?: string[];
  popularityScore?: number;
  numPosts: number;
  numLikes: number;
  numWrongs: number;
  createdAtMs: number;
  bumpedAtMs: number;
  lastReplyAtMs: number;
  numOrigPostReplies: number;
  numOrigPostLikes: number;
  answeredAtMs?: number;
  answerPostUniqueId?: number;
  plannedAtMs?: number;
  doneAtMs?: number;
  closedAtMs?: number;
  lockedAtMs?: number;
  frozenAtMs?: number;
  hiddenAtMs?: number;
  deletedAtMs?: number;
}


enum TopicSortOrder {
  BumpTime = 1,
  ScoreAndBumpTime,
  // LikesAndBumpTime, — perhaps add back later?
}


enum TopTopicsPeriod {
  Day = 1,
  Week = 2,
  Month = 3,
  Quarter = 4,
  Year = 5,
  All = 6
}


interface OrderOffset {  // COULD rename to TopicQuery? (because includes filter too now)
  sortOrder: TopicSortOrder;

  // Latest first offset:
  bumpedAt?: number;

  // For sort-by-top-score offset & period:
  score?: number;
  period?: TopTopicsPeriod;

  // Most liked first offset:
  numLikes?: number;

  topicFilter?: string;
}


// Ought to use real field names instead of numbers. Later.
interface Watchbar {
  1: WatchbarTopic[]; // WatchbarSection.RecentTopics
  2: WatchbarTopic[]; // WatchbarSection.Notifications
  3: WatchbarTopic[]; // WatchbarSection.ChatChannels
  4: WatchbarTopic[]; // WatchbarSection.DirectMessages
}


enum WatchbarSection {
  RecentTopics = 1,
  Notifications = 2,
  ChatChannels = 3,
  DirectMessages = 4,
}


interface WatchbarTopic {
  pageId: PageId;
  title: string;
  url?: string;
  unread?: boolean;
  notfsToMe?: number;
  notfsToMany?: number;
  // pageType: PageRole;  // [4KW0Y2] add later
}


interface WatchbarTopics {
  recentTopics: WatchbarTopic[];
}


interface VolatileDataFromServer {
  usersOnline: BriefUser[];
  numStrangersOnline: number;
  me?: Myself;
}


interface Store {
  appVersion: string;
  pageVersion: PageVersion;
  now: number;
  siteStatus: SiteStatus;
  isFirstSiteAdminEmailMissing?: boolean;
  userMustBeAuthenticated: boolean;
  userMustBeApproved: boolean;
  settings: SettingsVisibleClientSide;
  pageMemberIds: UserId[];
  pageId: string;
  forumId?: string;
  categoryId?: number;
  ancestorsRootFirst?: Ancestor[];
  hideForumIntro?: boolean;
  pageRole: PageRole;
  pagePath: PagePath;
  pageLayout?: TopicListLayout;
  pageHtmlTagCssClasses?: string;
  pageHtmlHeadTitle?: string;
  pageHtmlHeadDescription?: string;
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
  pageHiddenAtMs?: number;
  pageDeletedAtMs?: number;
  numPosts: number;
  numPostsRepliesSection: number;
  numPostsChatSection: number;
  numPostsExclTitle: number;
  maxUploadSizeBytes: number;
  isInEmbeddedCommentsIframe: boolean;
  categories: Category[];
  newCategoryId: string; // would like to remove. Later, when everything is one SPA and there's just one router available from everywhere. Then I can transition directly to the new category without this variable.
  newCategorySlug: string; // would like to remove
  topics: Topic[];
  user: Myself; // try to remove, use 'me' instead:
  me: Myself;
  userSpecificDataAdded?: boolean; // is always false, server side
  newUserAccountCreated?: boolean;
  isImpersonating?: boolean;
  isViewingAs?: boolean;
  rootPostId: number;
  usersByIdBrief: { [userId: number]: BriefUser };
  postsByNr: { [postNr: number]: Post };
  topLevelCommentIdsSorted: number[];
  isWatchbarOpen: boolean;
  isContextbarOpen: boolean;
  shallSidebarsOverlayPage?: boolean;
  siteSections: SiteSection[];
  strangersWatchbar: Watchbar;
  horizontalLayout: boolean;
  is2dTreeDefault: boolean;
  socialLinksHtml: string;

  numOnlineStrangers?: number;
  userIdsOnline?: { [userId: number]: boolean }; // this is a set; all values are true

  // If quickUpdate is true only posts in postsToUpdate will be updated.
  quickUpdate: boolean;
  postsToUpdate: { [postId: number]: boolean };

  tagsStuff?: TagsStuff;
  superadmin?: SuperAdminStuff;
}


// Default settings: [8L4KWU02]
interface SettingsVisibleClientSide {
  inviteOnly?: boolean;                 // default: false
  allowSignup?: boolean;                // default: true
  allowLocalSignup?: boolean;           // default: true
  allowGuestLogin?: boolean;            // default: false
  requireVerifiedEmail?: boolean;       // default: true
  mayComposeBeforeSignup?: boolean;     // default: false
  doubleTypeEmailAddress?: boolean;     // default: false
  doubleTypePassword?: boolean;         // default: false
  forumMainView?: string;               // default: 'latest'
  forumTopicsSortButtons?: string;      // default: 'latest|top'
  forumCategoryLinks?: string;          // default: 'categories'
  forumTopicsLayout?: TopicListLayout;  // default: title only
  forumCategoriesLayout?: CategoriesLayout; // default: (there's only one as of Jan 2017)
  showExperimental?: boolean;           // default: false
  showCategories?: boolean;             // default: true
  showTopicFilterButton?: boolean;      // default: true
  showTopicTypes?: boolean;             // default: true
  selectTopicType?: boolean;            // default: true
}


interface PagePath {
  value: string;
  folder: string;
  showId: boolean;
  slug: string;
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


enum PinPageWhere {
  InCategory = 1,
  Globally = 3,
}


interface Ancestor {  // server side: [6FK02QFV]
  categoryId: number;
  title: string;
  path: string;
  unlisted?: boolean;
  isDeleted?: boolean;
}


interface SiteSection {
  pageId: PageId;
  path: string;
  pageRole: PageRole;
  name: string;
}


enum SiteStatus {
  NoAdmin = 1,
  Active = 2,
  ReadAndCleanOnly = 3,
  HiddenUnlessStaff = 4,
  HiddenUnlessAdmin = 5,
  Deleted = 6,
  Purged = 7,
}


interface TagAndStats {
  label: string;
  numTotal: number;
  numPages: number;
  numSubscribers?: number;
  numMuted?: number;
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
  id: UserId;
  fullName: string;
  email: string;
  country: string;
  isEmailUnknown?: boolean;
}


interface BriefUser {
  id: UserId;
  fullName: string;
  username?: string;
  isAdmin?: boolean;
  isModerator?: boolean;
  isGuest?: boolean;  // = !isAuthenticated
  isEmailUnknown?: boolean;
  avatarUrl?: string;
  isMissing?: boolean;
}


interface MemberInclDetails {
  id: UserId;
  createdAtEpoch: number;  // change to millis
  username: string;
  fullName: string;
  email: string;
  emailForEveryNewPost: boolean;
  about?: string;
  country: string;
  url: string;
  avatarUrl?: string;
  mediumAvatarUrl?: string;
  isAdmin: boolean;
  isModerator: boolean;
  isApproved: boolean;
  approvedAtEpoch: number;  // change to millis
  approvedById: number;
  approvedByName: string;
  approvedByUsername: string;
  suspendedAtEpoch?: number;  // change to millis
  suspendedTillEpoch?: number;
  suspendedById?: number;
  suspendedByUsername?: string;
  suspendedReason?: string;
  effectiveTrustLevel: TrustLevel;
  // Only included if caller is staff:
  trustLevel?: TrustLevel;
  lockedTrustLevel?: TrustLevel;
  threatLevel?: ThreatLevel;
  lockedThreatLevel?: ThreatLevel;
}


enum TrustLevel {
  Stranger = 0,
  New = 1,
  Basic = 2,
  Member = 3,
  Helper = 4,
  Regular = 5,
  CoreMember = 6,
}


enum ThreatLevel {
  SuperSafe = 1,
  SeemsSafe = 2,
  HopefullySafe = 3,
  MildThreat = 4,
  ModerateThreat = 5,
  SevereThreat = 6,
}



enum LoginReason {
  SignUp = 13,
  LoginToChat = 10,
  LoginToLike = 11,
  BecomeAdmin = 12,
}


enum Presence {
  Active = 1,
  Away = 2,
}


interface Group {
  id: UserId;
  username: string;
  fullName: string;
  // "grantsTrustLevel" — later
  avatarUrl?: string;
}


enum Groups {
  NoUserId = 0,
  EveryoneId = 10,
  NewMembersId = 11,
  BasicMembersId = 12,
  FullMembersId = 13,
  TrustedId = 14,
  RegularsId = 15,
  CoreMembersId = 16,
  StaffId = 17,
  ModeratorsId = 18,
  AdminsId = 19,
}


interface UserStats {
  userId: UserId;
  lastSeenAt: DateMs;
  lastPostedAt?: DateMs;
  lastEmailedAt?: DateMs;
  emailBounceSum: number;
  firstSeenAt: DateMs;
  firstNewTopicAt?: DateMs;
  firstDiscourseReplyAt?: DateMs;
  firstChatMessageAt?: DateMs;
  topicsNewSince: DateMs;
  notfsNewSinceId: NotificationId;
  numDaysVisited: number;
  numSecondsReading: number;
  numDiscourseRepliesRead: number;
  numDiscourseRepliesPosted: number;
  numDiscourseTopicsEntered: number;
  numDiscourseTopicsRepliedIn: number;
  numDiscourseTopicsCreated: number;
  numChatMessagesRead: number;
  numChatMessagesPosted: number;
  numChatTopicsEntered: number;
  numChatTopicsRepliedIn: number;
  numChatTopicsCreated: number;
  numLikesGiven: number;
  numLikesReceived: number;
  numSolutionsProvided: number;
}


interface UsersHere {
  users: BriefUser[];
  areChatChannelMembers: boolean;
  areTopicContributors: boolean;
  numOnline: number;
  iAmHere: boolean;
  onlyMeOnline: boolean;
}


interface Invite {
  invitedEmailAddress: string;
  invitedById: UserId;
  createdAtEpoch: number;  // change to millis
  createdById: UserId;
  acceptedAtEpoch?: number;  // change to millis
  invalidatedAtEpoch?: number;  // change to millis
  deletedAtEpoch?: number;  // change to millis
  deletedById?: UserId;
  userId?: UserId;
  // Later:
  /*
  userFullName?: string;
  userUsername?: string;
  userLastSeenAtEpoch?: number;  // change to millis
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
  ipBlock?: Block;
  browserBlock?: Block;
}


interface Block {
  threatLevel: ThreatLevel,
  ip?: string;
  browserIdCookie?: string;
  blockedById: number;
  blockedAtMs: number;
  blockedTillMs?: number;
}


interface SearchQuery {
  rawQuery: string;
  tags: string[];
  notTags: string[];
  categorySlugs: string[];
}


interface SearchResults {
  thisIsAll: boolean;
  pagesAndHits: PageAndHits[];
}


interface PageAndHits {
  pageId: PageId;
  pageTitle: string;
  hits: SearchHit[];
}


interface SearchHit {
  postId: PostId;
  postNr: PostNr;
  approvedRevisionNr: number;
  approvedTextWithHighligtsHtml: string[];
  currentRevisionNr: number;
}


/**
 * Describes how to update parts of the store. Can be e.g. a new chat message and the author.
 */
interface StorePatch {
  // Specified by the server, so old messages (that arive after the browser has been upgraded)
  // can be discarded.
  appVersion?: string;

  categories?: Category[];

  pageVersionsByPageId?: { [pageId: string]: PageVersion };
  postsByPageId?: { [pageId: string]: Post[] };
  // rename to postAuthorsBrief? So one sees they can be ignored if the posts are
  // ignored (because the page version is too old).
  usersBrief?: BriefUser[];
  superadmin?: SuperAdminStuff;
  me?: Myself;
  tagsStuff?: TagsStuff;
}


enum ContribAgreement {
  CcBy3And4 = 10,
  CcBySa3And4 = 40,
  CcByNcSa3And4 = 70,
  UseOnThisSiteOnly = 100
}

enum ContentLicense {
  CcBy4 = 10,
  CcBySa4 = 40,
  CcByNcSa4 = 70,
  AllRightsReserved = 100
}

interface Settings {
  // Signup and Login
  userMustBeAuthenticated: boolean;
  userMustBeApproved: boolean;
  inviteOnly: boolean;
  allowSignup: boolean;
  allowLocalSignup: boolean;
  allowGuestLogin: boolean;
  requireVerifiedEmail: boolean;
  mayComposeBeforeSignup: boolean;
  mayPostBeforeEmailVerified: boolean;
  doubleTypeEmailAddress: boolean;
  doubleTypePassword: boolean;
  begForEmailAddress: boolean;

  // Moderation
  numFirstPostsToAllow: number;
  numFirstPostsToApprove: number;
  numFirstPostsToReview: number;

  // Forum
  forumMainView: string;
  forumTopicsSortButtons: string;
  forumCategoryLinks: string;
  forumTopicsLayout: TopicListLayout
  forumCategoriesLayout: CategoriesLayout

  // Simpify
  showCategories: boolean;
  showTopicFilterButton: boolean;
  showTopicTypes: boolean;
  selectTopicType: boolean;

  // Spam
  numFlagsToHidePost: number;
  cooldownMinutesAfterFlaggedHidden: number;
  numFlagsToBlockNewUser: number;
  numFlaggersToBlockNewUser: number;
  notifyModsIfUserBlocked: boolean;
  regularMemberFlagWeight: number;
  coreMemberFlagWeight: number;

  horizontalComments: boolean;

  headStylesHtml: string;
  headScriptsHtml: string;
  endOfBodyHtml: string;

  headerHtml: string;
  footerHtml: string;

  socialLinksHtml: string;
  logoUrlOrHtml: string;

  companyDomain: string;
  companyFullName: string;
  companyShortName: string;
  contribAgreement: ContribAgreement;
  contentLicense: ContentLicense;

  googleUniversalAnalyticsTrackingId: string;

  showExperimental: boolean;
}


interface TagsStuff {
  tagsAndStats?: TagAndStats[];
  myTagNotfLevels?: { [tagLabel: string]: NotfLevel };
}


interface Host {
  hostname: string;
  role: HostRole;
}


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


interface SuperAdminStuff {
  firstSiteHostname?: string;
  baseDomain: string;
  sites: SASite[];
}


interface SASite {
  id: string;
  status: SiteStatus;
  name: string;
  canonicalHostname: string;
  createdAtMs: number;
}


interface Rect {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

// vim: et ts=2 sw=2 tw=0 fo=r list

/*
 * Copyright (c) 2015-2018 Kaj Magnus Lindberg
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
type DraftNr = number;
type PageVersion = number;
type CategoryId = number;
type SiteId = number;
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
type ApiSecretNr = number;
type DateMs = number;  // use When instead? sounds better since using When server side too
type WhenMs = number;

type HttpRequest = XMLHttpRequest;
type UseBeacon = 'UseBeacon';


interface CheckboxEvent {
  target: {
    checked: boolean;
  };
}


// Send back IgnoreThisError to the caller from an error callback, and the caller won't
// continue with its default error handling — it'll ignore the error.
// Send back undefined or anything else to the caller, and the error will be considered.
type ErrorPolicy = number | void;


// Tells if a user may do something, and why s/he may do that, or why not.
interface MayMayNot {
  value: boolean;
  do_: boolean;   // true = may do it, use like so: if (may.do_) ...
  not: boolean;   // true = may not, use like so:   if (may.not) ...
  yes: boolean;   // true = may do it  -- try to remove?
  no: boolean;    // true = may not    -- try to remove?
  reason?: string;
}


const enum MagicAnchor {
  ScrollToLatest = 1,
}


interface RedirPathProps {
  path: string;
  to: string | ((params: { [name: string]: string }) => string);
  exact: boolean;
  strict?: boolean;
}


/**
 * The URL #hash-fragment can tell us to do different things. Examples:
 *
 * #post-123: We'll scroll to post 123.
 *
 * #post-456&replyToPost&draftNr=7 — we'll scroll to post 456,
 * open the editor to reply, and load draft nr 7.
 *
 * /-/users/someone#composeDirectMessage[&draftNr=234] — we go to user @someone,
 * open the editor to write a direct message, and, if draft nr specified,
 * we load draft nr 234.
 */
interface FragAction {
  type: FragActionType;
  categoryId?: CategoryId;
  topicType?: PageRole;
  postNr?: PostNr;
  draftNr?: DraftNr;
  elemId?: string;
}


const enum FragActionType {
  // Javascript-scrolls to show the #hash-fragment, taking the topbar height into account.
  ScrollToElemId = 11,
  ScrollToPost = 12,
  ScrollToLatestPost = 13,
  ReplyToPost = 21,
  EditPost = 22,
  ComposeTopic = 31,
  ComposeDirectMessage = 32,
}


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
  //causedBy: Participant;
  reasonsLong: number;
  createdAtMs: WhenMs;
  createdById: UserId;
  moreReasonsAtMs?: WhenMs;
  decidedById?: UserId;
  decidedAtMs?: WhenMs;
  decision?: ReviewDecision;
  completedAtMs?: WhenMs;
  invalidatedAtMs?: WhenMs;
  pageId?: string;
  pageTitle?: string;
  post?: PostToReview;
  flags: Flag[];
}


interface PostToReview {
  pageId: PageId;
  nr: PostNr;
  uniqueId: PostId;
  createdById?: UserId;
  currentSource: string;
  currRevNr: number;
  currRevComposedById?: UserId;
  approvedSource?: string;
  approvedHtmlSanitized?: string;
  approvedRevNr?: number;
  lastApprovedEditById?: UserId;
  //lastApprovedById
  bodyHiddenAtMs?: number;
  bodyHiddenById?: UserId;
  bodyHiddenReason?: string;
  deletedAtMs?: WhenMs;
  deletedById?: UserId;
}


const enum ReviewDecision {
  // 1nnn = Accept.
  Accept = 1001,
  // 3nnn = Request changes.
  // 5nnn = Reject.
  DeletePostOrPage = 5001,
}


interface Flag {
  // COULD incl flag id = action id? or separate table for flags? [2PKRW08]
  flaggerId: number;
  flagType: FlagType;
  flaggedAt: number;
  flagReason?: string;
  uniqueId?: PostId;
  pageId?: PageId;
  postNr?: PostNr;
}


const enum FlagType {
  Spam = 51,
  Inapt = 52,
  Other = 53,
}


const enum DraftStatus {  // sync with test code [5ABXG20]
  NotLoaded = 0,
  NothingHappened = 1,
  EditsUndone = 2,
  Saved = 3,
  Deleted = 4,
  NeedNotSave = Deleted,
  ShouldSave = 5,
  SavingSmall = 6,
  SavingBig = 7,
  Deleting = 8,
  CannotSave = 10,
}


const enum DraftType {
  Scratch = 1,
  Topic = 2,
  DirectMessage = 3,
  Edit = 4,
  Reply = 5,
}


interface DraftLocator {
  draftType: DraftType;
  categoryId?: number;
  toUserId?: UserId;
  postId?: PostId;
  pageId?: PageId;
  // This is useful on embedded blog comments pages, if the Talkyard page hasn't yet
  // been created, so there's no page id. [BLGCMNT1]
  embeddingUrl?: string;
  postNr?: PostNr;
}


interface Draft {
  byUserId: UserId;
  draftNr: number;
  forWhat: DraftLocator;
  createdAt: WhenMs;
  lastEditedAt?: WhenMs;
  deletedAt?: WhenMs;
  topicType?: PageRole;
  postType?: PostType;
  title?: string;
  text: string;
}


interface Post {
  uniqueId: PostId; // CLEAN_UP RENAME to id
  nr: PostNr;
  parentNr: PostNr;
  multireplyPostNrs: PostNr[];
  postType?: PostType;
  authorId: UserId;
  createdAtMs: number;
  approvedAtMs?: number;
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
  childNrsSorted: number[];
  unsafeSource?: string;  // for titles, we insert the post source, as text (no html in titles)
  sanitizedHtml?: string;
  tags?: string[];
  numPendingFlags?: number;
  numHandledFlags?: number;
}


const enum PostType {   // sync with test code [26BKA01]
  Normal = 1,         // RENAME to NormalPost
  Flat = 2,           // CLEAN_UP remove
  ChatMessage = 3,
  BottomComment = 4,  // RENAME to ProgressPost
  StaffWiki = 11,
  CommunityWiki = 12,
  CompletedForm = 21,
  MetaMessage = 31,   // RENAME to MetaPost
}


const enum PostVoteType {
  Like = 41,
  Disagree = 42,
  Bury = 43,
  Unwanted = 44,
}


// Determines which write-post guidelines will be shown in the editor.
const enum WritingWhat {
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
  composedBy: Participant;
  approvedAtMs?: number;
  approvedBy?: Participant;
  hiddenAtMs?: number;
  hiddenBy?: Participant;
}


interface PagePostNrId {
  pageId: PageId;
  postNr: PostNr;
  postId: PostId;
}


interface MyPageData {
  dbgSrc?: string;
  pageId: PageId;
  // The user's own notification preference, for this page. Hen can change this setting.
  myPageNotfPref?: PageNotfPref;
  // Notification preferences, for the groups one is a member of, for this page. The user cannot change
  // these prefs. Only staff or a group manager, can do that.
  groupsPageNotfPrefs: PageNotfPref[];
  readingProgress?: ReadingProgress;
  votes: any; // RENAME to votesByPostNr?   CLEAN_UP also see just below:  id or nr
  unapprovedPosts: { [id: number]: Post };
  unapprovedPostAuthors: Participant[];
  postNrsAutoReadLongAgo: number[];
  postNrsAutoReadNow: number[];

  // For the current page only.
  marksByPostId: { [postId: number]: any }; // sleeping BUG: probably using with Nr (although the name implies ID), but should be ID
}


interface OwnPageNotfPrefs {
  id?: UserId;
  myDataByPageId?: { [id: string]: MyPageData };
  myCatsTagsSiteNotfPrefs: PageNotfPref[];
  groupsCatsTagsSiteNotfPrefs: PageNotfPref[];
}


interface Myself extends OwnPageNotfPrefs {
  dbgSrc?: string;
  id?: UserId;
  isGroup?: boolean; // currently always undefined (i.e. false)
  isLoggedIn?: boolean;
  isAdmin?: boolean;
  isModerator?: boolean;
  isAuthenticated?: boolean;  // change to !isGuest? — no, there are strangers too.
  deactivatedAt?: number;
  deletedAt?: number;
  username?: string;
  fullName?: string;
  avatarSmallHashPath?: string;
  lockedTrustLevel?: TrustLevel; // currently not set server side, hmm try make consistent [5ZKGJA2]
  trustLevel: TrustLevel;      // inconsistency: named effectiveTrustLevel in UserInclDetails  [5ZKGJA2]
  threatLevel: ThreatLevel;    // auto or effective? RENAME or repl w isThreat?
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
  restrictedTopicsUsers: Participant[];
  restrictedCategories: Category[];

  pageHelpMessage?: HelpMessage;
  closedHelpMessages: { [id: string]: number };  // id --> closed version of message   — id or nr?
  tourTipsSeen: TourTipsSeen;
  uiPrefsOwnFirst: UiPrefs[];

  myDataByPageId: { [id: string]: MyPageData };
  myCurrentPageData: MyPageData;

  // For all pages in the store / recent-posts-lists on the profile page.
  marksByPostId: { [postId: number]: any }; // sleeping BUG: probably using with Nr (although the name implies ID), but should be ID

  // So can avoid showing getting-started-guide for admins — it's not needed, for embedded comments sites.
  isEmbeddedCommentsSite?: boolean;
}


type MyselfPatch = Partial<Myself>;



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


interface PageNotfPrefTarget {
  pageId?: PageId;
  pagesInCategoryId?: CategoryId;
  wholeSite?: boolean;
}


interface EffPageNotfPref extends PageNotfPrefTarget {
  notfLevel?: PageNotfLevel;
  inheritedNotfPref?: PageNotfPref;
}


interface PageNotfPref extends PageNotfPrefTarget {
  memberId: UserId;
  notfLevel: PageNotfLevel;
}


const enum PageNotfLevel {
  EveryPostAllEdits = 9,
  EveryPost = 8,
  TopicProgress = 7,
  TopicSolved = 6,
  NewTopics = 5,
  Tracking = 4,
  Normal = 3,
  Hushed = 2,
  Muted = 1,
}


interface Notification {
  id: number;
  type: NotificationType;
  createdAtMs: number;
  seen: boolean;
  byUser?: Participant;
  pageId?: string;
  pageTitle?: string;
  postNr?: number;
}


const enum NotificationType {
  DirectReply = 1,
  Mention = 2,  // DirectMention
  // GroupMention =
  // Quote = 3,
  Message = 4,   // rename to DirectMessage
  NewPost = 5,
  // NewPage =      // Add
  PostTagged = 6,   // Change id
}



interface ReadingProgress {
  lastViewedPostNr: number;
}


interface HelpMessage {
  id: string;
  version: number;
  content: any;
  defaultHide?: boolean;
  doAfter?: () => void;
  type?: number;
  className?: string;
  alwaysShow?: boolean;
}



type TourId = string;
type TourTipsSeen = TourId[];

interface TalkyardTour {
  id: TourId;
  forWho: Myself;
  steps: TalkyardTourStep[];
}

interface TalkyardTourStep {
  doBefore?: () => void;
  pauseBeforeMs?: number;
  title: string;
  text: string;  // or React element also fine
  nextTitle?: string;
  placeAt: string;
  placeHow?: PlaceHow,
  waitForClick?: boolean;
  highlightPadding?: number;
  highlightOffsetX?: number;
  highlightOffsetY?: number;
}

const enum PlaceHow {
  ToTheLeft = 1,
  ToTheRight = 2,
  Above = 3,
  Below = 4,
  InTheMiddle = 5,
}

interface StaffTours {
  forumIntroForBlogComments: (me: Myself) => TalkyardTour;
  forumIntroForCommunity: (me: Myself) => TalkyardTour;
  adminAreaIntroForBlogComments: (me: Myself) => TalkyardTour;
  adminAreaIntroForCommunity: (me: Myself) => TalkyardTour;
}




interface Category {
  id: CategoryId;
  parentId?: CategoryId;
  sectionPageId?: any; // only when saving to server?
  name: string;
  slug: string;
  defaultTopicType: PageRole;
  newTopicTypes?: PageRole[];  // [refactor] [5YKW294] delete, use defaultTopicType instead
  position?: number;
  description: string;
  recentTopics?: Topic[];
  unlistCategory?: boolean;
  unlistTopics?: boolean;
  includeInSummaries?: IncludeInSummaries;
  isDefaultCategory?: boolean;
  isForumItself?: boolean;
  isDeleted?: boolean;
}


const enum IncludeInSummaries {
  Default = 0,
  YesFeatured = 1,
  NoExclude = 3
}


const enum TopicListLayout {
  Default = 0,
  TitleOnly = 1,
  TitleExcerptSameLine = 2,
  ExcerptBelowTitle = 3,
  ThumbnailLeft = 4,
  ThumbnailsBelowTitle = 5,
  NewsFeed = 6,
}


const enum CategoriesLayout {
  Default = 0,
}


const enum ShowAuthorHow {
  UsernameOnly = 1,
  UsernameThenFullName = 2,
  FullNameThenUsername = 3,  // the default
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
  startedAtMs?: number;
  doneAtMs?: number;
  closedAtMs?: number;
  lockedAtMs?: number;
  frozenAtMs?: number;
  hiddenAtMs?: number;
  deletedAtMs?: number;
}


const enum TopicSortOrder {
  BumpTime = 1,
  CreatedAt = 2,
  ScoreAndBumpTime = 3,
  // LikesAndBumpTime, — perhaps add back later?
}


const enum TopTopicsPeriod {
  Day = 1,
  Week = 2,
  Month = 3,
  Quarter = 4,
  Year = 5,
  All = 6
}


interface OrderOffset {  // COULD rename to TopicQuery? (because includes filter too now)
  sortOrder: TopicSortOrder;

  // For by-bump-time and newest-first first offset:
  olderThan?: number;

  // For sort-by-top-score offset & period:
  score?: number;
  period?: TopTopicsPeriod;

  // Most liked first offset:
  numLikes?: number;

  topicFilter?: string;
}


// Ought to use real field names instead of numbers. Later.
interface Watchbar {
  1: WatchbarTopic[]; // WatchbarSection.SubCommunities
  2: WatchbarTopic[]; // WatchbarSection.RecentTopics
  3: WatchbarTopic[]; // WatchbarSection.ChatChannels
  4: WatchbarTopic[]; // WatchbarSection.DirectMessages
}


const enum WatchbarSection {
  SubCommunities = 1,
  RecentTopics = 2,
  ChatChannels = 3,
  DirectMessages = 4,
}


interface WatchbarTopic {
  pageId: PageId;
  title: string;
  type: PageRole;
  unread?: boolean;
  notfsToMe?: number;
  notfsToMany?: number;
}


interface WatchbarTopics {
  recentTopics: WatchbarTopic[];
}


interface VolatileDataFromServer {
  usersOnline: Participant[];
  numStrangersOnline: number;
  me?: Myself;
  // Sometimes, on embedded comments pages, privacy tools and settings remove cookies.  [NOCOOKIES]
  // Then we include an xsrf token in the page json instead.
  xsrfTokenIfNoCookies?: string;
}


// An auto generated page, like a user's profile, or the search results page.
interface AutoPage {
  dbgSrc: string;
  ancestorsRootFirst?: Ancestor[];
  pageMemberIds: UserId[];
  postsByNr: { [postNr: number]: Post };
  pagePath: {};
}

// A page with real user written content, e.g. a discussion, chat, info page or homepage.
interface Page {
  dbgSrc: string;
  pageId: PageId;
  pageVersion: PageVersion;
  pageMemberIds: UserId[];
  forumId?: string;
  ancestorsRootFirst?: Ancestor[];
  categoryId?: number;
  pageRole: PageRole;
  pagePath: PagePath;
  pageLayout?: TopicListLayout;
  pageHtmlTagCssClasses?: string;
  pageHtmlHeadTitle?: string;
  pageHtmlHeadDescription?: string;
  pinOrder?: number;
  pinWhere?: PinPageWhere;
  doingStatus: PageDoingStatus;
  // REFACTOR [5RKT02] remove the At fields.
  // Use a PageDoingStatus enum: New/Planned/Doing/Done/Postponed enum
  // instead of all status fields.
  // And a ClosedStatus enum: Open/Closed/Locked/Frozen.
  // And a DeletedStatus enum: NotDeleted/Deleted/Purged.
  // And a HiddenStatus enum: Visible/Hidden.
  // And a Published status enum: PersonalPageDraft/SharedPageDraft/Published.
  // "PageDraft" so different from drafts for chat message, replies, posts drafts, which
  // live only inside the editor — but not saved as real topics.
  pageAnsweredAtMs?: number;
  pageAnswerPostUniqueId?: number;
  pageAnswerPostNr?: number;
  pagePlannedAtMs?: number;
  pageStartedAtMs?: number;
  pageDoneAtMs?: number;
  pageClosedAtMs?: number;
  pageLockedAtMs?: number;
  pageFrozenAtMs?: number;
  pageHiddenAtMs?: number;
  pageDeletedAtMs?: number;
  numPosts: number;
  numPostsRepliesSection: number;  // change and rename to numDiscussionReplies
  numPostsChatSection: number;     // change and rename to numProgressPosts
  numPostsExclTitle: number;
  postsByNr: { [postNr: number]: Post };
  parentlessReplyNrsSorted: number[];
  progressPostNrsSorted: number[];
  horizontalLayout: boolean;
  is2dTreeDefault: boolean;
}


interface PageMetaBrief {
  pageId: PageId;
  createdAtMs: WhenMs;
  createdById: UserId;
  lastReplyAtMs?: WhenMs;
  lastReplyById?: UserId;
  pageRole: PageRole;
  categoryId: CategoryId;
  embeddingPageUrl?: string;
  closedAtMs?: WhenMs;
  lockedAtMs?: WhenMs;
  frozenAtMs?: WhenMs;
  hiddenAtMs?: WhenMs;
  deletedAtMs?: WhenMs;
}


interface PageMeta {
  id: PageId;
  pageType: PageRole;
  version: number;
  createdAtMs: WhenMs;
  updatedAtMs: WhenMs;
  publishedAtMs?: WhenMs;
  bumpedAtMs?: WhenMs;
  lastApprovedReplyAt?: WhenMs;
  lastApprovedReplyById?: UserId;
  categoryId?: CategoryId;
  embeddingPageUrl?: string;
  authorId: UserId;
  frequentPosterIds: number[];
  layout: number; // e.g. TopicListLayout
  pinOrder?: number;
  pinWhere?: PinPageWhere;
  numLikes: number;
  numWrongs: number;
  numBurys: number;
  numUnwanteds: number;
  numRepliesVisible: number;
  numRepliesTotal: number;
  numPostsTotal: number;
  numOrigPostLikeVotes: number;
  numOrigPostWrongVotes: number;
  numOrigPostBuryVotes: number;
  numOrigPostUnwantedVotes: number;
  numOrigPostRepliesVisible: number;
  answeredAt?: WhenMs;
  answerPostId?: PostId;
  doingStatus: PageDoingStatus;
  plannedAt?: WhenMs;
  startedAt?: WhenMs;
  doneAt?: WhenMs;
  closedAt?: WhenMs;
  lockedAt?: WhenMs;
  frozenAt?: WhenMs;
  unwantedAt?: WhenMs;
  hiddenAt?: WhenMs;
  deletedAt?: WhenMs;
  htmlTagCssClasses: string;
  htmlHeadTitle: string;
  htmlHeadDescription: string;
}


interface Origins {
  remoteOriginOrEmpty: string;
  anyCdnOrigin?: string;
  pubSiteId: string;
}


interface Store extends Origins {
  widthLayout: WidthLayout;
  isEmbedded: boolean;
  appVersion: string;
  siteStatus: SiteStatus;
  siteOwnerTermsUrl?: string;
  siteOwnerPrivacyUrl?: string;
  isFirstSiteAdminEmailMissing?: boolean;
  // Only used when creating the site, to show messages for embedded comments.
  makeEmbeddedCommentsSite?: boolean;
  userMustBeAuthenticated: boolean;
  userMustBeApproved: boolean;
  settings: SettingsVisibleClientSide;
  hideForumIntro?: boolean;
  maxUploadSizeBytes: number;
  currentCategories: Category[];
  // For all site sections, loaded lazily, and updated in a hacky way, for now, so have a look,
  // and refactor (?), before using it for anything more.
  allCategoriesHacky?: Category[];
  publicCategories: Category[];
  newCategorySlug: string; // for temporarily highlighting a newly created category
  topics?: Topic[];
  user: Myself; // try to remove, use 'me' instead:
  me: Myself;
  userSpecificDataAdded?: boolean; // is always false, server side
  newUserAccountCreated?: boolean;
  isImpersonating?: boolean;
  isViewingAs?: boolean;
  rootPostId: number;
  usersByIdBrief: { [userId: number]: Participant };
  pageMetaBriefById: { [pageId: string]: PageMetaBrief };
  isWatchbarOpen: boolean;
  isContextbarOpen: boolean;
  shallSidebarsOverlayPage?: boolean;
  siteSections: SiteSection[];
  strangersWatchbar: Watchbar;
  socialLinksHtml: string;

  numOnlineStrangers?: number;
  userIdsOnline?: { [userId: number]: boolean }; // this is a set; all values are true

  // If quickUpdate is true only posts in postsToUpdate will be updated.
  quickUpdate: boolean;
  postsToUpdate: { [postId: number]: boolean };

  pagesById: { [pageId: string]: Page };
  currentPage?: Page;
  currentPageId?: PageId;
  debugStartPageId: string;

  tagsStuff?: TagsStuff;
  superadmin?: SuperAdminStuff;
}


// Default settings: [8L4KWU02]
interface SettingsVisibleClientSide {
  languageCode?: string;                // default: 'en_US'
  inviteOnly?: boolean;                 // default: false
  allowSignup?: boolean;                // default: true
  allowLocalSignup?: boolean;           // default: true
  allowGuestLogin?: boolean;            // default: false
  enableGoogleLogin: boolean;           // default: depends on config file
  enableFacebookLogin: boolean;         // default: depends on config file
  enableTwitterLogin: boolean;          // default: depends on config file
  enableGitHubLogin: boolean;           // default: depends on config file
  enableLinkedInLogin: boolean;         // default: depends on config file
  requireVerifiedEmail?: boolean;       // default: true
  mayComposeBeforeSignup?: boolean;     // default: false
  doubleTypeEmailAddress?: boolean;     // default: false
  doubleTypePassword?: boolean;         // default: false
  ssoUrl?: string;                      // default: undefined
  enableSso?: boolean;                  // default: undefined —> false
  minPasswordLength?: number;           // default: 10
  enableChat?: boolean;                 // default: true
  enableDirectMessages?: boolean;       // default: true
  showSubCommunities?: boolean;         // default: false
  forumMainView?: string;               // default: 'latest'
  forumTopicsSortButtons?: string;      // default: 'latest|top'
  forumCategoryLinks?: string;          // default: 'categories'
  forumTopicsLayout?: TopicListLayout;  // default: title only
  forumCategoriesLayout?: CategoriesLayout; // default: (there's only one as of Jan 2017)
  showExperimental?: boolean;           // default: false
  showCategories?: boolean;             // default: true
  showTopicFilterButton?: boolean;      // default: true
  showTopicTypes?: boolean;             // default: true
  showAuthorHow: ShowAuthorHow;         // default: FullNameThenUsername
  selectTopicType?: boolean;            // default: true
  watchbarStartsOpen?: boolean;         // default: true
  showSocialButtons?: boolean;          // default: undefined —> false
  facebookAppId?: string;               // default: undefined —> no FB insight statistics
}


const enum WidthLayout {
  Tiny = 1,
  Medium = 3,
}


interface PagePath {
  value: string;
  folder: string;
  showId: boolean;
  slug: string;
}


const enum PageRole { // dupl in client/e2e/test-types.ts [5F8KW0P2]
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
  ToDo = 13,  // Only used briefly when creating new topics. Gets converted to Idea with status Planned.
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


// Sync with Scala [5KBF02].
const enum PageDoingStatus {
  Discussing = 1,
  Planned = 2,
  Started = 3,
  Done = 4,
  // Available = 5, ? Thinking about software:
  // sometimes I've implemented a feature, but not updated the server.
  // So, it's been "done" / implemented — but is not yet "available" to others.
  // Hmm, hmm, hmm. Or is this "Available" status a can of worms? What about
  // available in various backported branches? Would it be better for
  // the community to use tags (and tag values?) to indcate where the thing
  // has yet been made available?  ... Also, which icon, for Available o.O
  // cannot think of any make-sense icon. Better skip this (!). Stop at Done.
}


const enum PinPageWhere {
  InCategory = 1,
  Globally = 3,
}


interface Ancestor {  // server side: [6FK02QFV]
  categoryId: number;
  title: string;
  path: string;
  unlistCategory?: boolean;
  isDeleted?: boolean;
}


interface Forum {
  pageId: PageId;
  path: string;
  title: string;
  description: string;
}


interface SiteSection {
  pageId: PageId;
  path: string;
  pageRole: PageRole;
}


const enum SiteStatus {
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


const enum AvatarSize {
  Tiny = 1, // the default
  Small = 2,
  Medium = 3,
}


type BriefUser = Participant;  // old name, CLEAN_UP RENAME all occurrences to Participant

interface Participant {   // Guest or Member, and Member = group or user
  id: UserId;
  fullName?: string;
  username?: string;
  isGroup?: boolean;
  isAdmin?: boolean;
  isModerator?: boolean;
  isGuest?: boolean;  // = !isAuthenticated
  isEmailUnknown?: boolean;
  avatarTinyHashPath?: string;
  avatarSmallHashPath?: string;
  isMissing?: boolean;
  isGone?: boolean;
}


interface Guest extends Participant {
  fullName: string;
  username?: undefined;
  email: string;
  isEmailUnknown?: boolean;
  isGuest: true;
  isAdmin?: false;
  isModerator?: false;
  avatarTinyHashPath?: undefined;
  avatarSmallHashPath?: undefined;
}


interface Member extends Participant {
  username: string;
  // but fullName is optional
  isGuest?: false;
}


interface Group extends Member {
  fullName: string;
  isGroup: true;
  isGuest?: false;
  // "grantsTrustLevel" — later
  avatarTinyHashPath?: string;
}


/** A member or group, including details. Or a guest; then, there are no details. */
type ParticipantAnyDetails = MemberInclDetails | Guest;


interface MemberInclDetails extends Member {
  avatarMediumHashPath?: string;
  // Only if requester is staff:
  summaryEmailIntervalMins?: number;
  summaryEmailIntervalMinsOwn?: number;
  summaryEmailIfActive?: boolean;
  summaryEmailIfActiveOwn?: boolean;
}


interface GroupInclDetails extends MemberInclDetails, Group {
  isGroup: true;
  //"createdAtEpoch" -> JsWhen(group.createdAt),
  fullName: string;
}


interface UserInclDetails extends MemberInclDetails {
  externalId?: string;
  createdAtEpoch: number;  // change to millis
  fullName: string;
  email: string;
  emailVerifiedAtMs?: WhenMs;
  // mailingListMode: undefined | true;  // default false  — later
  hasPassword?: boolean;
  about?: string;
  url: string;
  seeActivityMinTrustLevel?: TrustLevel;
  uiPrefs: UiPrefs;
  isAdmin: boolean;
  isModerator: boolean;
  isApproved: boolean;
  approvedAtMs: number;        // RENAME to reviewedAtMs
  approvedById: number;        // RENAME to reviewedById
  approvedByName: string;      // REMOVE (lookup via id instead)
  approvedByUsername: string;  // REMOVE
  suspendedAtEpoch?: number;   // change to mins? ms?
  suspendedTillEpoch?: number;
  suspendedById?: number;
  suspendedByUsername?: string;
  suspendedReason?: string;
  effectiveTrustLevel: TrustLevel;  // inconsistency: Not used for Myself [5ZKGJA2]
  // Only included if caller is staff:
  trustLevel?: TrustLevel;  // RENAME to autoTrustLevel? so won't use accidenally. Server side too?
  lockedTrustLevel?: TrustLevel;  // not set for Myself [5ZKGJA2]
  threatLevel?: ThreatLevel;  // RENAME to autoThreatLevel?
  lockedThreatLevel?: ThreatLevel;
  deactivatedAt?: number;
  deletedAt?: number;
}

interface UserInclDetailsWithStats extends UserInclDetails {
  // Mabye some old accounts lack stats?
  anyUserStats?: UserStats;
}


interface UiPrefs {
  fbs?: UiPrefsForumButtons;
  xls?: UiPrefsExternaLInks;
}

const enum UiPrefsForumButtons {
  CategoryDropdownFirst = 1,
  TopicFilterFirst = 2,
}

const enum UiPrefsExternaLInks {
  OpenInSameTab = 1,
  OpenInNewTab = 2,
}


const enum EditMemberAction {
  SetEmailVerified = 1,
  SetEmailUnverified = 2,

  SetApproved = 3,
  SetUnapproved = 4,
  ClearApproved = 5,

  SetIsAdmin = 6,
  SetNotAdmin = 7,

  SetIsModerator = 8,
  SetNotModerator = 9,
}


interface UserEmailAddress {
  emailAddress: string;
  addedAt: number;
  verifiedAt?: number;
  removedAt?: number;
}


interface UserLoginMethods {
  loginType: string;
  provider: string;
  email?: string;
}


const enum TrustLevel {
  Stranger = 0,
  New = 1,
  Basic = 2,
  FullMember = 3,
  Trusted = 4,
  Regular = 5,
  CoreMember = 6,
}


const enum ThreatLevel {
  SuperSafe = 1,
  SeemsSafe = 2,
  HopefullySafe = 3,
  MildThreat = 4,
  ModerateThreat = 5,
  SevereThreat = 6,
}



const enum LoginReason {
  SignUp = 13,
  LoginToChat = 10,
  LoginToLike = 11,
  BecomeAdmin = 12, // COULD rename to BecomeOwner
  TryToAccessNotFoundPage = 14,
  SubmitEditorText = 15,
  PostEmbeddedComment = 16,  // dupl [8UKBR2AD5]
}


const enum Presence {
  Active = 1,
  Away = 2,
}


const enum Groups {
  NoUserId = 0,
  EveryoneId = 10,
  NewMembersId = 11,  // RENAME to AllMembersId
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
  users: Participant[];
  areChatChannelMembers: boolean;
  areTopicContributors: boolean;
  numOnline: number;
  iAmHere: boolean;
  onlyMeOnline: boolean;
}


interface Invite {  // [REFINVFLDS]
  invitedEmailAddress: string;
  invitedById: UserId;
  createdAtEpoch: number;  // change to millis, remove "Epoch" suffix
  createdById: UserId;  // remove
  acceptedAtEpoch?: number;  // change to millis
  invalidatedAtEpoch?: number;  // change to millis
  deletedAtEpoch?: number;  // change to millis
  deletedById?: UserId;
  userId?: UserId;   // rename to becameUserId
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
  threatLevel: ThreatLevel;
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

  publicCategories?: Category[];
  restrictedCategories?: Category[];

  pageVersionsByPageId?: { [pageId: string]: PageVersion };
  postsByPageId?: { [pageId: string]: Post[] };
  // rename to postAuthorsBrief? So one sees they can be ignored if the posts are
  // ignored (because the page version is too old).
  usersBrief?: Participant[];
  pageMetasBrief?: PageMetaBrief[];
  superadmin?: SuperAdminStuff;
  me?: MyselfPatch;
  tagsStuff?: TagsStuff;

  // If doing something resulted in a new page being created, and we should continue on that page.
  // E.g. if posting the first reply, in an embedded comments discussion (then a page for the
  // discussion gets created, lazily).
  newlyCreatedPageId?: PageId;
}


const enum ContribAgreement {
  CcBy3And4 = 10,
  CcBySa3And4 = 40,
  CcByNcSa3And4 = 70,
  UseOnThisSiteOnly = 100
}

const enum ContentLicense {
  CcBy4 = 10,
  CcBySa4 = 40,
  CcByNcSa4 = 70,
  AllRightsReserved = 100
}

interface Settings {
  // Signup and Login
  expireIdleAfterMins: number;
  userMustBeAuthenticated: boolean;
  userMustBeApproved: boolean;
  inviteOnly: boolean;
  allowSignup: boolean;
  allowLocalSignup: boolean;
  allowGuestLogin: boolean;
  enableGoogleLogin: boolean;
  enableFacebookLogin: boolean;
  enableTwitterLogin: boolean;
  enableGitHubLogin: boolean;
  requireVerifiedEmail: boolean;
  emailDomainBlacklist: string;
  emailDomainWhitelist: string;
  mayComposeBeforeSignup: boolean;
  mayPostBeforeEmailVerified: boolean;
  doubleTypeEmailAddress: boolean;
  doubleTypePassword: boolean;
  begForEmailAddress: boolean;

  // Single Sign-On
  enableSso: boolean;
  ssoUrl: string;
  ssoNotApprovedUrl: string;

  // Moderation
  numFirstPostsToAllow: number;
  numFirstPostsToApprove: number;
  numFirstPostsToReview: number;

  // Forum
  forumMainView: string;
  forumTopicsSortButtons: string;
  forumCategoryLinks: string;
  forumTopicsLayout: TopicListLayout;
  forumCategoriesLayout: CategoriesLayout;

  // Simpify
  showCategories: boolean;
  showTopicFilterButton: boolean;
  showTopicTypes: boolean;
  selectTopicType: boolean;
  watchbarStartsOpen: boolean;
  showAuthorHow: ShowAuthorHow;

  // Spam
  numFlagsToHidePost: number;
  cooldownMinutesAfterFlaggedHidden: number;
  numFlagsToBlockNewUser: number;
  numFlaggersToBlockNewUser: number;
  notifyModsIfUserBlocked: boolean;
  regularMemberFlagWeight: number;  // RENAME to trustedMemberFlagWeight [RENREGLS]
  coreMemberFlagWeight: number;

  enableChat: boolean;
  enableDirectMessages: boolean;
  showSubCommunities: boolean;

  horizontalComments: boolean;

  faviconUrl: string;
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

  languageCode: string;
  googleUniversalAnalyticsTrackingId: string;

  showExperimental: boolean;
  featureFlags: string;

  allowEmbeddingFrom: string;
}


interface TagsStuff {
  tagsAndStats?: TagAndStats[];
  myTagNotfLevels?: { [tagLabel: string]: PageNotfLevel };
}


interface ShareOptions {
  title?: string;
  description?: string;
  souce?: string;
}


interface Host {
  hostname: string;
  role: HostRole;
}


const enum HostRole {
  Canonical = 1,
  Redirect = 2,
  Link = 3,
  Duplicate = 4,
}


const enum PricePlan {  // [4GKU024S]
  Unknown = 0,
  NonCommercial = 1,
  Business = 2,
  EmbeddedComments = 3,
}


interface ApiSecret {
  nr: ApiSecretNr;
  userId?: UserId;
  createdAt: WhenMs;
  deletedAt?: WhenMs;
  isDeleted: boolean,
  secretKey: string;
}


interface SuperAdminStuff {
  firstSiteHostname?: string;
  baseDomain: string;
  sites: SASite[];
}


interface SASite {
  id: number;
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



// ----- Server requests and responses


interface EditPageRequestData {
    //pageId: PageId; — filled in By Server.ts
    newTitle?: string;
    categoryId?: CategoryId;
    pageRole?: PageRole;
    doingStatus?: PageDoingStatus;
    folder?: string;
    slug?: string;
    showId?: boolean;
    pageLayout?: TopicListLayout;
    htmlTagCssClasses?: string;
    htmlHeadTitle?: string;
    htmlHeadDescription?: string;
}

interface EditPageResponse {
  newTitlePost;
  newAncestorsRootFirst;
  newUrlPath?: string;
  newPageMeta: PageMeta;
}


interface GuestLoginResponse {
  userCreatedAndLoggedIn: boolean;
  emailVerifiedAndLoggedIn: boolean;
  currentPageSessionId?: string;
}

interface LoadTopicsResponse {
  categoryId?: CategoryId;
  categoryParentId?: CategoryId;
  categoryName?: string;
  categoryDescr?: string;
  topics: Topic[];
  users: Participant[];
}


interface LoadCategoryResponse {
  category: Category;
  permissions: PermsOnPage[];
  groups: Group[];
}


interface SendInvitesResponse {
  willSendLater: boolean;
  invitesSent: Invite[];
  alreadyInvitedAddresses: string[];
  alreadyJoinedAddresses: string[];
  failedAddresses: string[];
}


interface UserAccountResponse {
  emailAddresses: UserAccountEmailAddr[];
  loginMethods: UserAccountLoginMethod[];
}

interface UserAccountEmailAddr {
  emailAddress: string;
  addedAt: WhenMs;
  verifiedAt?: WhenMs;
}

interface UserAccountLoginMethod {
  loginType: string;
  provider: string;
  email?: string;
  externalId?: string;
}


// COULD also load info about whether the user may apply and approve the edits.
interface LoadDraftAndTextResponse {
  pageId: PageId,
  postNr: PostNr,
  postUid: string; // CLEAN_UP RENAME to just postId.
  currentText: string;
  currentRevisionNr: number;
  draft?: Draft;
}

interface ListDraftsResponse {
  drafts: Draft[];
  pagePostNrsByPostId: { [postId: string]: [PageId, PostNr] };
  pageTitlesById: { [pageId: string]: string };
}

interface PageNotfPrefsResponse extends OwnPageNotfPrefs {
  // Later: Category and group names, so can lookup ther names, for display.
}


// ----- Service worker messages  [sw]


const enum SwDo {  // Service worker, do: ....
  SubscribeToEvents = 1,
}

//enum SwSays {  // Service worker says: ....
//  GotNotfs = 1,
//}

interface MessageToServiceWorker {
  doWhat: SwDo
}

//interface MesageFromServiceWorker {
//  saysWhat: SwSays,
//}


interface SubscribeToEventsSwMessage extends MessageToServiceWorker {
  doWhat: SwDo.SubscribeToEvents;
  siteId: SiteId,
  myId: UserId,
}



// ----- External things whose @types won't work

// Why won't work? Maybe because isn't using AMD / ES6 modules.

// Doesn't work:
// bash# yarn add @types/react-router-dom
// /// <reference path="../../../node_modules/@types/react-router/index.d.ts" />
// and then using RouteChildrenProps. Why won't work? Who cares. Instead:
interface RouteChildProps {
  match: RouteMatch,
  location: RouteLocation,
  history: RouteHistory,
  children: any,
}
interface RouteMatch {
  path: string;
  url: string;
  isExact: boolean;
  params: { [paramName: string]: string };
}
interface RouteLocation {
  pathname: string;
  search: string;
  hash: string;
}
interface RouteHistory {
  length: number;
  action: string;
  location: RouteLocation;
}



// ----- Public API


interface TalkyardApi {  // [5ABJH72]
  postElemPostProcessor?: (elem: any) => void;
}

// vim: et ts=2 sw=2 tw=0 fo=r list

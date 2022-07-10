/*
 * Copyright (c) 2015-2019 Kaj Magnus Lindberg
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

/// <reference path="./../types-and-const-enums.ts" />
/// <reference path="./../third-party/third-party-types.d.ts" />


interface PageSession  {
  xsrfTokenIfNoCookies?: St;

  // Initialized when the page loads, by checking navigator.cookieEnabled.
  canUseCookies?: Bo;

  // This session id is available to client side Javascript, and can be stolen
  // if there's an XSS vulnerability. So, it's going to have fewer capabilities
  // than a http-only session when the Talkyard site is opened as the main window
  // (rather than embedded in an iframe).
  //
  // It's needed because Safari and FF blocks 3rd party cookies, so
  // we need to remember the login session in a non-cookie somehow.
  //
  // ADD_TO_DOCS
  //
  weakSessionId?: St;  // RENAME to sid12Maybe3 ?

  // If the session is for an embedded comments iframe. REMOVE incl in sid instead, somehow.
  sessType?: SessionType.AutoTokenSiteCustomSso;
}


interface __TyWinInterface extends Window {
  tydyn?: { allIframePageIds: PageId[] };
  typs: PageSession;
  theStore: Store;
  eds: ServerVars;
}


// RENAME to DiscWin.
type MainWin = __TyWinInterface & typeof globalThis;
type DiscWin = MainWin;



type DateMs = WhenMs;  // use When instead? sounds better since using When server side too

type HttpRequest = XMLHttpRequest;
type UseBeacon = 'UseBeacon';


interface LinkTitleUrl {
  title: string;
  url: string;
}

interface CheckboxEvent {
  target: {
    checked: boolean;
  };
}

/// Either compares two items (if function.length === 2) or compares
/// a field value (if length === 1).
type ArrItemIsSameFn<Item> = ((a: Item, b: Item) => Bo) | ((it: Item) => any);

type ValueOk<T> = {
  value?: T;
  isOk?: boolean;
};


// Tells if a user may do something, and why s/he may do that, or why not.
interface MayMayNot {
  value: boolean;
  do_: boolean;   // true = may do it, use like so: if (may.do_) ...
  not: boolean;   // true = may not, use like so:   if (may.not) ...
  yes: boolean;   // true = may do it  -- try to remove?
  no: boolean;    // true = may not    -- try to remove?
  reason?: string;
}


/// See: https://reactrouter.com/web/api/location — but Ty's interface is safer?
/// — it hides some history object fields we sholudn't use. [.mut_hist]
///
interface ReactRouterProps {
  history: ReactRouterHistory;
  // Where we're now.
  location: ReactRouterLocation;
  // How this route path matched the URL.
  match: ReactRouterMatch;
}

interface ReactRouterHistory {
  // Don't use, changes at any time. Use location (below) instead. [.mut_hist]
  // length,
  // action,
  // location

  // But the functions are okay?:
  push: (path, state?) => Vo;
  replace: (path, state?) => Vo;
  go: (n: Nr) => Vo;
  goBack: () => Vo;        // same as go(-1)
  goForward: () => Vo;     // same as go(+1)
  block: (prompt)  => Vo;  // prevents navigation
}

interface ReactRouterLocation {
  // key: e.g. 'ac3df4', // absent if using HashHistory
  pathname: St; // e.g. '/some/page'
  search: St;  // e.g '?query=param'
  hash: St; // e.g. #hash-frag
  state: any; // e.g. a map
}

interface ReactRouterMatch {
  params: UrlParamsMap; // params in the URL path and query string
  isExact: Bo; // if the entire URL matches, no trailing chars
  path: St;
  url: St;
}


// Query params — but can also also be params in the url path?
type UrlParamsMap = { [paramName: string]: St };


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
 * open the editor to reply, and load draft nr 7
 * Actually, as of Jan 2020, I think loads whichever draft that replies to
 * post 456 — without looking at the draftNr. But, later, if there
 * happens to be many drafts, then could use draftNr to choose one.
 *
 * /-/users/someone#composeDirectMessage[&draftNr=234] — we go to user @someone,
 * open the editor to write a direct message, and, if draft nr specified,
 * we load draft nr 234.
 */
interface FragAction {
  type: FragActionType;
  category?: CategoryId | CategoryRef;
  topicType?: PageRole;
  replyType?: PostType;
  postNr?: PostNr;
  draftNr?: DraftNr;
  selector?: string;
}


const enum FragActionType {
  // Javascript-scrolls to show the #hash-fragment, taking the topbar height into account.
  ScrollToSelector = 11,
  ScrollToPost = 12,
  ScrollToLatestPost = 13,
  ReplyToPost = 21,
  EditPost = 22,
  ComposeTopic = 31,
  ComposeDirectMessage = 32,
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
  numLikeVotes: number;
  numWrongVotes: number;
  numBuryVotes: number;
  numUnwantedVotes: number;
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


interface DraftLocator {
  draftType: DraftType;
  categoryId?: number;
  toUserId?: UserId;
  postId?: PostId;
  // pageId + postNr says which post one is replying to.
  pageId?: PageId;
  // This is useful on embedded blog comments pages, if the Talkyard page hasn't yet
  // been created, so there's no page id. [BLGCMNT1]
  embeddingUrl?: string;
  discussionId?: St;
  postNr?: PostNr;
}


interface DraftDeletor {
  // Embedded comments pages get lazy created e.g. when the first reply gets
  // posted — until then, there's no page id.
  pageId?: PageId,
  forWhat: DraftLocator;
  // Only drafts saved server side have been assigned a draft nr.
  draftNr?: DraftNr;
}


interface Draft {
  byUserId: UserId;
  draftNr: DraftNr;
  forWhat: DraftLocator;
  createdAt: WhenMs;
  lastEditedAt?: WhenMs;
  deletedAt?: WhenMs;
  topicType?: PageRole;
  postType?: PostType;
  title?: string;
  text: string;
}


interface EditorIframeHeight {
  editorIframeHeightPx?: number;
}

interface ShowEditsPreviewParams extends EditorIframeHeight {
  scrollToPreview?: boolean;
  safeHtml: string;
  editorsPageId?: PageId;
  anyPostType?: PostType;
  replyToNr?: PostNr;
  editingPostNr?: PostNr;
  highlightPreview?: boolean; // default: true
}


interface HideEditorAndPreviewParams {
  anyDraft?: Draft;
  keepDraft?: boolean;
  keepPreview?: true;
  editorsPageId?: PageId;
  anyPostType?: PostType;
  replyToNr?: PostNr;
  editingPostNr?: PostNr;
}


type EditsDoneHandler = (
    wasSaved: boolean, text: string, draft: Draft | null, draftStatus: DraftStatus) => void;


interface CalcScrollOpts {
  // If you want to scroll to show only the 'height' upper pixels of something.
  height?: number;
  marginTop?: number;
  marginBottom?: number;
  marginRight?: number;
  marginLeft?: number;
  parent?: Element;
}

// The fields might be undefined, if !needsToScroll.
interface CalcScrollResult {
  actualWinTop?: number;
  actualWinLeft?: number;
  desiredParentTop?: number;
  desiredParentLeft?: number;
  needsToScroll: boolean;
}

interface ScrollIntoViewOpts extends CalcScrollOpts {
  duration?: number;
  onDone?: () => void;

  // If user defined selector, might cause an exception.
  maybeBadId?: boolean;
}


interface ShowPostOpts extends ScrollIntoViewOpts {
  showChildrenToo?: boolean;
  inFrame?: DiscWin;
}


interface Post {
  // Client side only ------
  // If this post / these changes don't yet exist — it's a preview.
  isPreview?: boolean;
  // Is a number if the draft has been saved server side (then the server has
  // assigned it a number).
  isForDraftNr?: DraftNr | true;
  // If we're editing this post right now.
  isEditing?: boolean;
  // -----------------------

  uniqueId: PostId; // CLEAN_UP RENAME to id
  nr: PostNr;
  parentNr?: PostNr; // undefined, for chat messages and sometimes embedded comments [CHATPRNT]
  multireplyPostNrs: PostNr[];
  postType?: PostType;
  authorId: UserId;
  createdAtMs: WhenMs;
  approvedAtMs?: WhenMs;
  lastApprovedEditAtMs?: WhenMs;
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
  currRevNr?: number;      // only if not approved
  approvedRevNr?: number;  //
  pinnedPosition: number;
  branchSideways: number;
  likeScore: number;
  childNrsSorted: number[];
  // For titles, we insert the post source, as text (no html in titles).
  // And for drafts, we show a <pre>the-source</pre>, for now. [DFTSRC]
  unsafeSource?: string;
  sanitizedHtml?: string;
  pubTags?: Tag[];
  numPendingFlags?: number;
  numHandledFlags?: number;
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
  myDrafts: Draft[];
  // The user's own notification preference, for this page. Hen can change this setting.
  myPageNotfPref?: PageNotfPref;
  // Notification preferences, for the groups one is a member of, for this page. The user cannot change
  // these prefs. Only staff or a group manager, can do that.
  groupsPageNotfPrefs: PageNotfPref[];
  readingProgress?: ReadingProgress;
  votes: any; // RENAME to votesByPostNr?   CLEAN_UP also see just below:  id or nr
  internalBacklinks?: Topic[];
  unapprovedPosts: { [id: number]: Post };
  unapprovedPostAuthors: Participant[];
  postNrsAutoReadLongAgo: number[];
  postNrsAutoReadNow: number[];

  // For the current page only.
  marksByPostId: { [postId: number]: any }; // sleeping BUG: probably using with Nr (although the name implies ID), but should be ID
}


/**
 * This is not the effective permissions on the current page, but instead
 * permissions configured for the page's ancestor categories, and groups
 * the user is in — so we can find out, client side, from where a setting
 * got inherited.  [DBLINHERIT]
 */
interface OwnPageNotfPrefs {  // RENAME to MembersPageNotfPrefs?
  id?: UserId;
  myDataByPageId?: { [id: string]: MyPageData };
  myCatsTagsSiteNotfPrefs: PageNotfPref[];
  groupsCatsTagsSiteNotfPrefs: PageNotfPref[];
}


// Extend Pat, set id to a new StrangerId if not logged in?
type Myself = Me; // renaming to Me
interface Me extends OwnPageNotfPrefs {   // + extends Pat?
  dbgSrc?: string;
  // This is not the whole session id — it's the first 16 chars only [sid_part1];
  // the remaining parts have (a lot) more entropy than necessary.
  mySidPart1?: St | N;
  id?: UserId;
  isStranger?: Bo;
  // missing?: isGuest?: Bo
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

  // "Notice" means info / a warning of something, especially to allow
  // preparations to be made. "Notification" though, is getting info about
  // something, need not be so important.
  // Currently only to admins.
  adminNotices?: Notice[];

  snoozeUntilMins?: WhenMins | false;

  watchbarTopics?: WatchbarTopics;
  watchbar: Watchbar;

  // --- Include in StuffForMe insted? ----
  restrictedTopics: Topic[];
  restrictedTopicsUsers: Participant[];
  restrictedCategories: Category[];
  // -----------------------------------

  // groupsMaySee: Group[]; // groups oneself may see [305STGW2]

  // Legacy: REMOVE
  closedHelpMessages: { [id: string]: number };  // id --> closed version of message   — id or nr?
  // Use instead, and rename to just 'tipsSeen':
  tourTipsSeen: TourTipsSeen;

  uiPrefsOwnFirst: UiPrefs[];

  myGroupIds: UserId[];
  // --- Include in StuffForMe insted? ----
  myDataByPageId: { [id: string]: MyPageData };
  myCurrentPageData: MyPageData;
  // -----------------------------------

  // For all pages in the store / recent-posts-lists on the profile page.
  marksByPostId: { [postId: number]: any }; // sleeping BUG: probably using with Nr (although the name implies ID), but should be ID

  pubTags?: Tag[];

  // So can avoid showing getting-started-guide for admins — it's not needed, for embedded comments sites.
  isEmbeddedCommentsSite?: boolean;

  // To know if to show certain admin announcements.
  siteCreatedAtMs?: WhenMs;


  effMaxUplBytes: Nr;
  effAlwUplExts: St[];
}


type MyselfPatch = Partial<Myself>;
type MePatch = MyselfPatch;  // renaming all 'Myself' to 'Me'


interface StuffForMe {
  tagTypes?: TagType[];
}


interface Session {
  patId: PatId;
  createdAt: WhenMs;
  version: Nr,
  startHeaders: { [name: St]: St };
  part1: St;
  deletedAt?: WhenMs;
  expiredAt?: WhenMs;
}


interface GroupPerms {
  maxUploadBytes?: Nr;
  allowedUplExts?: St;
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
  mayPostComment?: boolean;  // RENAME? to mayPostReplies
  // later: mayPostProgressNotes ?
  maySee?: boolean;
  maySeeOwn?: boolean;
  // later: maySeeReplies ?
}


type PermsOnPageNoIdOrPp = Omit<PermsOnPage, 'id' | 'forPeopleId'>


interface PageNotfPrefTarget {
  pageId?: PageId;
  pagesPatCreated?: true;
  pagesPatRepliedTo?: true;
  pagesInCategoryId?: CategoryId;
  wholeSite?: true;
}


interface EffPageNotfPref extends PageNotfPrefTarget {
  // Will be different from the user one is logged in as, if one is a staff member,
  // and edits another member's (e.g. a group's) notf settings.
  forMemberId: UserId;

  // Defined, if the member has specified a notf level directly for the PageNotfPrefTarget.
  // If undefined, `inheritedNotfPref` instead determines the notf level.
  notfLevel?: PageNotfLevel;
  myPref?: PageNotfPref;

  // Notf prefs are inherited structure wise: pages inherit from sub categories, and
  // sub categories from main categories. And people wise: members inherit from the groups
  // they're in.
  inheritedNotfPref?: PageNotfPref;
}


interface PageNotfPref extends PageNotfPrefTarget {
  memberId: UserId;
  notfLevel: PageNotfLevel;
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


interface Notice {
  id: NoticeId;
  toPatId: 19;  // always to admins, group 19, currently
  firstAtMins: WhenMins;
  lastAtMins: WhenMins,
  numTotal: Nr,
  noticeData?: Object,
}


interface ReadingProgress {
  lastViewedPostNr: number;
}


// MOVE to section "UI Widgets" below?
interface HelpMessage {
  id: string;  // leave out —> cannot close.  RENAME to closeId insetad? and remove alwaysShow?
  version: number;
  content: any;
  defaultHide?: boolean;
  doAfter?: () => void;
  type?: number;
  className?: string;
  isNice?: Bo;
  isWarning?: boolean;
  alwaysShow?: boolean;
  moreHelpAwaits?: boolean;
  okayText?: string;
}


// MOVE to section "UI Widgets" below?
interface StupidDialogStuff {  // RENAME from ...Stuff to ...Options
  dialogClassName?: string;
  body?: any;
  closeButtonTitle?: any;
  primaryButtonTitle?: any;
  secondaryButonTitle?: any;
  large?: Bo;
  small?: boolean;
  tiny?: boolean;
  // number = 1 if primary / okay button clicked, 2 if secondary button clicked, and
  // 0 if no button clicked, that is, if dialog closed by clicking x or outside.
  onCloseOk?: (number: number) => void;
  // If the user clicks the primary button. Not called, if hen clicks a secondary
  // button or closes the dialog e.g. by clicking outside.
  onPrimaryClick?: () => void;
  preventClose?: boolean;
  closeOnClickOutside?: boolean; // default true
  // Specify this to get a fn that closes the dialog.
  withCloseFn?: (closeFn: () => void) => void;
}


// MOVE the tour stuff to just above "UI Widgets" section below?
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
  placeHow?: PlaceHow;
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




type Category = Cat; // Too long name!

interface Cat extends DiscPropsSource {
  id: CategoryId;
  parentId?: CategoryId;  // RENAME to parCatId? simpler to grep and [concice_is_nice].
  sectionPageId?: any; // only when saving to server?   // RENAME to ixPgId? (index page id)
  name: string;
  slug: string;
  defaultTopicType: PageRole;
  newTopicTypes?: PageRole[];  // [refactor] [5YKW294] delete, use defaultTopicType instead
  doItVotesPopFirst?: Bo;
  position?: number;
  description: string;    // from the about category topic
  thumbnailUrl?: string;  // from the about category topic
  recentTopics?: Topic[];
  unlistCategory?: boolean;
  unlistTopics?: boolean;
  includeInSummaries?: IncludeInSummaries;
  isDefaultCategory?: boolean;
  isForumItself?: boolean;
  isDeleted?: boolean;
}


interface CategoryPatch extends Category {  // or Partial<Category>?
  extId?: ExtId;
}



interface TagType {
  id: TagTypeId;
  canTagWhat: ThingType;
  dispName: St;
}


interface TagTypeStats {
  tagTypeId: TagTypeId;
  numTotal: Nr;
  numPostTags: Nr;
  numPatBadges: Nr;
}


interface Tag {
  id: TagId;
  tagTypeId: TagTypeId;
  onPatId?: PatId;
  onPostId?: PostId;
}


// Previously, old tags:
/*
interface TagAndStats {
  label: string;
  numTotal: number;
  numPages: number;
  numSubscribers?: number;
  numMuted?: number;
}

interface TagsStuff {
  tagsAndStats?: TagAndStats[];
  myTagNotfLevels?: { [tagLabel: string]: PageNotfLevel };
}
*/


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
  pubTags?: Tag[];
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
  answeredAtMs?: number;  // RENAME to solvedAtMs
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


/// When loading new page html, this is included, as json, in a <script> tag in the page html.
///
interface VolatileDataFromServer {
  usersOnline: Pat[];
  numStrangersOnline: Nr;
  me?: Me;
  stuffForMe?: StuffForMe;
  // Sometimes, on embedded comments pages, privacy tools and settings remove cookies.  [NOCOOKIES]
  // Then we include an xsrf token in the page json instead.
  xsrfTokenIfNoCookies?: St;
}


/// For single-page-app-navigating to a new page — then, we don't need everything in
/// VolatileDataFromServer, only the below. And we get it from the server via a http request.
///
/// reactStoreJsonString includes things needed to show the page, e.g. page title,
/// orig post, replies, authors, etc — the same (exactly?) as the store json in the
/// <script id='thePageJson'> json incl in the page html.
///
interface PageJsonAndMe {
  reactStoreJsonString: St;
  // Actually only need .watchbar and .myDataByPageId. [load_less_me_data]
  me?: Me;
  stuffForMe?: StuffForMe;
}


interface PageJsonProblem {
  problemCode;
  problemMessage: St;
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
interface Page
    // For now, "inline" settings in the page. Later, keep separately,
    // like OwnPageNotfPrefs? [DBLINHERIT]
    // So we can see from where a setting comes — is it from some ancestor category
    // or group? Or the whole forum? Otherwise, hard to troubleshoot unexpected
    // effective settings.
    extends TopicInterfaceSettings, DiscPropsSource {
  dbgSrc: string;
  pageId: PageId;
  pageVersion: PageVersion;
  pageMemberIds: UserId[];
  forumId?: string;
  ancestorsRootFirst?: Ancestor[];
  categoryId?: number;
  internalBacklinks?: Topic[];
  externalBacklinks?: LinkTitleUrl[];
  pageRole: PageRole;
  pagePath: PagePath;
  //--------
  pageLayout?: PageLayout;  // REMOVE, move to TopicInterfaceSettings,
                            // no, let's have Page and Cat extend DiscLayout
                            // instead — done, see above.
      // Or rather, split into different objs and fields [disc_props_view_stats] [PAGETYPESETTNG]
  forumSearchBox?: ShowSearchBox;
  forumMainView?: Nr;
  forumCatsTopics?: Nr;
  //--------
  pageHtmlTagCssClasses?: string;
  // Overrides the title from the title Post.
  pageHtmlHeadTitle?: string;
  pageHtmlHeadDescription?: string;
  pinOrder?: number;
  pinWhere?: PinPageWhere;
  doingStatus: PageDoingStatus;
  // ? Refactor: [5RKT02] remove the At fields.
  // Use a PageDoingStatus enum: New/Planned/Doing/Done/Postponed enum
  // instead of all status fields.
  // And a ClosedStatus enum: Open/Closed/Locked/Frozen.
  // And a DeletedStatus enum: NotDeleted/Deleted/Purged.
  // And a HiddenStatus enum: Visible/Hidden.
  // And a Published status enum: PersonalPageDraft/SharedPageDraft/Published.
  // "PageDraft" so different from drafts for chat message, replies, posts drafts, which
  // live only inside the editor — but not saved as real topics.
  pageAnsweredAtMs?: number;  // RENAME to solvedAtMs, or, no, use PageDoingStatus instead? see just above.
  pageAnswerPostUniqueId?: number; // RENAME to solutionPostId
  pageAnswerPostNr?: number;  // RENAME to solutionPostNr
  pagePlannedAtMs?: number;   // RENAME to plannedAt
  pageStartedAtMs?: number;   // ... and the others below
  pageDoneAtMs?: number;
  pageClosedAtMs?: number;
  pageLockedAtMs?: number;
  pageFrozenAtMs?: number;
  pageHiddenAtMs?: number;
  pageDeletedAtMs?: number;
  numPosts: number;
  numRepliesVisible: Nr;
  numPostsRepliesSection: number;  // CLEAN_UP REMOVE server side too  [prgr_chat_sect]
  numPostsChatSection: number;     // REMOVE, don't: change and rename to numProgressPosts  [prgr_chat_sect]
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


interface PageMeta extends DiscPropsSource {
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
  layout: PageLayout;
  //comtOrder?: PostSortOrder; — in DiscPropsSource
  //comtNesting?: NestingDepth;
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


// Discussion ids, external id, embedding urls. And the canonical url path,
// plus any url paths that redirect to the canonical path.
//
interface PageIdsUrls {
  pageId: PageId;
  extId?: ExtId;
  title: string;
  canonUrlPath: string;
  redirdUrlPaths: string[];
  canonEmbUrl?: string;
  embeddingUrls: string[];
  discussionIds: string[];
}


interface Origins {
  embeddedOriginOrEmpty: string;
  anyCdnOrigin?: string;
  pubSiteId: string;
}


interface SessWinStore {
  me?: Myself;
  embeddedOriginOrEmpty: St;
}


/// Can be 1) the main ('top') browser win (incl topbar, editor, sidebars etc), or
/// 2) a copy of the store in an embedded comments iframe.  [many_embcom_iframes]
///
interface DiscStore extends SessWinStore {
  currentPage?: Page;
  currentPageId?: PageId;
  currentCategories: Cat[];   // RENAME [concice_is_nice] curCats
  usersByIdBrief: { [userId: number]: Pat };  // = PatsById
  pagesById: { [pageId: string]: Page };
}


interface Store extends Origins, DiscStore, PartialEditorStoreState {
  // Need to use the same layout settings as the server, on the first
  // render, when reusing (hydrating) html from the server.
  isHydrating?: Bo;
  widthLayout: WidthLayout; // RENAME to serverPageLayout, default mobile?

  isEmbedded: boolean;
  appVersion: string;

  // Maybe move these to a Site interface?
  siteStatus: SiteStatus;
  siteFeatureFlags?: St;    // use store_isFeatFlagOn; don't access directly
  serverFeatureFlags?: St;  //
  siteOwnerTermsUrl?: string;
  siteOwnerPrivacyUrl?: string;
  isFirstSiteAdminEmailMissing?: boolean;

  // Only used when creating the site, to show messages for embedded comments.
  makeEmbeddedCommentsSite?: boolean;
  userMustBeAuthenticated: boolean;
  userMustBeApproved: boolean;
  settings: SettingsVisibleClientSide;
  hideForumIntro?: boolean;

  // For all site sections, loaded lazily, and updated in a hacky way, for now, so have a look,
  // and refactor (?), before using it for anything more.
  allCategoriesHacky?: Category[];
  publicCategories: Category[];   // RENAME [concice_is_nice] pubCats
  newCategorySlug: string; // for temporarily highlighting a newly created category
  topics?: Topic[];
  user: Myself; // try to remove, use 'me' instead:
  me: Myself;
  userSpecificDataAdded?: boolean; // is always false, server side
  newUserAccountCreated?: boolean;
  isImpersonating?: boolean;
  isViewingAs?: boolean;
  rootPostId: number;

  // Maybe move to DiscStore?
  pageMetaBriefById: { [pageId: string]: PageMetaBrief };

  isEditorOpen?: boolean;  // default: false
  // From PartialEditorStoreState:
  // editorsPageId?: PageId;
  // replyingToPostNr?: PostNr;
  // editingPostId?: PostId;

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
  // Overrides quickUpdate.
  cannotQuickUpdate?: boolean;

  // Any page settings, e.g. layout or sort order, pat is currently editing and previewing.
  // Any fields here, overrides those in this.currentPage. But disappears on page reload
  // (unless saved).
  curPageTweaks?: Partial<Page>;

  debugStartPageId: string;

  tagTypesById?: TagTypesById;
  tagTypeStatsById?: { [tagTypeId: number]: TagTypeStats };

  superadmin?: SuperAdminStuff;
}


// Default settings: [8L4KWU02]
interface SettingsVisibleClientSide extends TopicInterfaceSettings {
  termsOfUseUrl?: string;               // default: undefined —> built-in
  privacyUrl?: string;                  // default: undefined —> built-in
  languageCode?: string;                // default: 'en_US'
  inviteOnly?: boolean;                 // default: false
  allowSignup?: boolean;                // default: true
  allowLocalSignup?: boolean;           // default: true
  allowGuestLogin?: boolean;            // default: false
  customIdps?: IdentityProviderPubFields[];   // default: undefined
  useOnlyCustomIdps?: boolean;          // default: false
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
  ssoShowEmbAuthnBtns?: ShowEmbAuthnBtnsBitf;  // default: undef —> All
  enableSso?: boolean;                  // default: undefined —> false
  ssoWillRedirAfterLogout?: Bo;         // default: undef —> false
  rememberEmbSess?: Bo;                 // default: undef —> true
  enableApi?: boolean;                  // default: undefined —> true
  minPasswordLength?: number;           // default: 10
  enableForum?: boolean;                // default: true
  enableTags?: boolean;                 // default: false for now, true later when impl.
  enableChat?: boolean;                 // default: true
  enableDirectMessages?: boolean;       // default: true
  enableSimilarTopics?: boolean;        // default: depends on config file, later: true
  showSubCommunities?: boolean;         // default: false
  navConf?: BrowserCode;                // default: {}
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


// Move some things from above to DiscLayout?
//
// Currently configured for all categories, and(optionally) per category and page.
// Maybe later: disc_layout_t.
// RENAME to DiscLayoutSource?
interface DiscPropsSource {
  comtOrder?: PostSortOrder;
  comtNesting?: NestingDepth;
}

// RENAME to DiscLayoutDerived?  There's an interface Layout too (below) merging all layouts.
interface DiscPropsDerived {
  comtOrder: PostSortOrder;
  // Says what thing (e.g. the current page, or the parent category) the comtOrder
  // layout setting is from, so the edit-layout dialog can tell the admin
  // where the default value is from, in case the admin would want to edit the
  // default setting. And ... makes it simpler for the Ty devs to troubleshoot any
  // layout inheritance bugs.
  comtOrderFrom: Ref; // LayoutFor;
  comtNesting: NestingDepth;   // not yet in use [max_nesting]
  comtNestingFrom: Ref; // LayoutFor;  //
}

// And extends TopicListLayout, KnowledgeBaseLayout etc, all layouts.
interface Layout extends DiscPropsDerived {
}



interface TopicInterfaceSettings {
  // --- Hmm these will be in DiscLayout instead: ------
  discussionLayout?: DiscussionLayout;  // default: threaded
  discPostNesting?: NestingDepth;       // default: infinite nesting depth
  discPostSortOrder?: PostSortOrder;    // default: oldest first
  // ---------------------------------------------------

  // And this is deprecated:
  progressLayout?: ProgressLayout;      // default: Visible

  // Currently for embedded comments: (later, can configure in disc_props_t.)
  origPostReplyBtnTitle?: string;       // default: t.AddComment
  origPostVotes?: OrigPostVotes;

  enableDisagreeVote?: Bo;              // default: true

  // Embedded comments:
  embComNesting?: NestingDepth;         // default: infinite nesting depth
  embComSortOrder?: PostSortOrder;      // default: best first
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


interface Ancestor {  // server side: [6FK02QFV].
  categoryId: number;
  title: string;
  path: string;
  unlistCategory?: boolean;
  isDeleted?: boolean;
}


interface Forum {  // extend SiteSection? (then the server needs to add pageRole) or replace with?
  pageId: PageId;
  path: string;
  title: string;
  description: string;
  rootCategoryId: CategoryId;
  defaultCategoryId: CategoryId;
}


interface SiteSection {  // also see interface Forum just above
  pageId: PageId;
  path: string;
  pageRole: PageRole;
  rootCategoryId: CategoryId;
  defaultCategoryId: CategoryId;
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


interface MemberIdName {
  id: UserId;
  username: string;
  fullName?: string;
}


// Store means  Store.me: Me,  i.e. the current user.
type Who = Pat | Me | Store | PatId | Username;

type BriefUser = Pat;    // CLEAN_UP RENAME to Pat
type Participant = Pat;  // RENAME to Pat


interface PatNameAvatar {
  id: UserId;
  fullName?: string;
  username?: string;
  avatarTinyHashPath?: St;
}


interface Pat extends PatNameAvatar {   // Guest or Member, and Member = group or user
  isGroup?: boolean;
  isAdmin?: boolean;
  isModerator?: boolean;

  isGuest?: boolean;  // = !isAuthenticated
  isAuthenticated?: Bo;  // = !isGuest, if is a user (but absent, if is a group)

  isEmailUnknown?: boolean;
  avatarSmallHashPath?: string;
  isMissing?: boolean;
  isGone?: boolean;
  // User badges that should be displayed almost always.
  pubTags?: Tag[];
}

type PpsById = { [ppId: number]: Participant };  // RENAME to PatsById


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


interface BioWebsiteLocation {
  bio?: string;
  websiteUrl?: string;
  location?: string;
}


interface GuestDetailed extends Guest, BioWebsiteLocation {
}


interface Member extends Participant, MemberIdName {
  username: string;
  // but fullName is optional
  isGuest?: false;
}


interface Group extends Member {
  isGroup: true;
  isGuest?: false;
  // "grantsTrustLevel" — later
  avatarTinyHashPath?: string;
}

interface GroupAndStats extends Group {
  // Some people (like strangers and new members) might not get to know details
  // about a group, only its name. Then no stats here.
  stats?: GroupStats;
}

interface GroupStats {
  numMembers: number;
}


/** A member or group, including details. Or a guest; then, there are no details. */
type ParticipantAnyDetails = MemberInclDetails | GuestDetailed;


interface MemberInclDetails extends Member {
  avatarMediumHashPath?: string;
  // Only if requester is staff:
  summaryEmailIntervalMins?: number;
  summaryEmailIntervalMinsOwn?: number;
  summaryEmailIfActive?: boolean;
  summaryEmailIfActiveOwn?: boolean;
}


type GroupInclDetails = GroupVb;
interface GroupVb extends MemberInclDetails, Group, GroupPerms {
  isGroup: true;
  //"createdAtEpoch" -> JsWhen(group.createdAt),
}

type UserInclDetails = PatVb; // old name, remove
// Split into PatVb, PatVbStaff, PaVbAdmin — with fields only staff/admins may see?
// ("Thin" and "Fat"? Maybe "PatFatStaff" isn't the best interface name
// "PatVbStaff" better?)
/// A Participant including verbose details, for the pat profile pages.
interface PatVb extends MemberInclDetails, BioWebsiteLocation {
  externalId?: string;
  createdAtEpoch: number;  // change to millis
  fullName?: string;
  email: string;
  emailVerifiedAtMs?: WhenMs;
  emailNotfPrefs: EmailNotfPrefs,
  // mailingListMode: undefined | true;  // default false  — later
  hasPassword?: boolean;
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
  blocked?: BlockedReason;
  effectiveTrustLevel: TrustLevel;  // inconsistency: Not used for Myself [5ZKGJA2]
  // Only included if caller is staff:
  trustLevel?: TrustLevel;  // RENAME to autoTrustLevel? so won't use accidenally. Server side too?
  lockedTrustLevel?: TrustLevel;  // not set for Myself [5ZKGJA2]
  threatLevel?: ThreatLevel;  // RENAME to autoThreatLevel?
  lockedThreatLevel?: ThreatLevel;
  deactivatedAt?: number;
  deletedAt?: number;
}

interface UserInclDetailsWithStats extends PatVb {   // REMOVE, instead, use PatVvb?
  // Mabye some old accounts lack stats?
  anyUserStats?: UserStats;
}

// A participant, Very VerBose: all fields, badges, stats and groups.
interface PatVvb extends UserInclDetailsWithStats {
  groupIdsMaySee: UserId[];
}
type UserDetailsStatsGroups = PatVvb; // old name

interface CreateUserParams {
  idpName?: St;
  idpHasVerifiedEmail?: Bo;
  username?: St;
  fullName?: St;
  email?: St;
  origNonceBack?: St;
  authDataCacheKey?: St;
  anyReturnToUrl?: St;
  // anyAfterloginCallback? (): U;
  preventClose?: true;
}


interface CreateUserDialogContentProps extends CreateUserParams {
  store: Store;
  afterLoginCallback?;
  closeDialog: (_?: 'CloseAllLoginDialogs') => Vo;
  loginReason?: LoginReason;
  isForGuest?: Bo;
  isForPasswordUser?: Bo;
}



interface UiPrefs {
  inp?: UiPrefsIninePreviews;
  fbs?: UiPrefsForumButtons;
  xls?: UiPrefsExternaLInks;
  kbd?: UiPrefsKeyboardShortcuts;
}

const enum UiPrefsIninePreviews {
  // Only an in-page preview, no in editor preview
  Show = 1, // RENAME to Only?
  // No in-page preview
  Skip = 2,
  // Both in-page and in-editor previews.
  Double = 3,
}

const enum UiPrefsForumButtons {
  CategoryDropdownFirst = 1,
  TopicFilterFirst = 2,
}

const enum UiPrefsExternaLInks {
  OpenInSameTab = 1,
  OpenInNewTab = 2,
}

const enum UiPrefsKeyboardShortcuts {
  Off = 0,
  On = 1,

  // Some people don't like Shift+Shift as a shortcut, look e.g. at this
  // long issue about disabling Shift+Shift:
  // > it's really annoying
  // https://youtrack.jetbrains.com/issue/IDEA-161094?_ga=2.55737643.1871123538.1608914152-691578293.1607148698
  // Not sure if, at that time, Shift+Shift had to be double clicked (typed) or not;
  // today (2020-12) seems needs to be < 500ms between.
  OnButNoDoubleShift = 2,
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


/// Sync w Scala: LoginReason.
/// Some reasons make a short text appear in the login dialog. [authn_reason_info]
const enum LoginReason {
  LoginToEdit = 9,
  LoginToChat = 10,
  LoginToLike = 11,
  LoginToDisagree = 25,
  LoginToFlag = 26,
  BecomeOwner = 12,
  SignUp = 13,
  TryToAccessNotFoundPage = 14,
  SubmitEditorText = 15,
  PostEmbeddedComment = 16,  // also in Scala code [8UKBR2AD5]
  PostProgressPost = 17,
  PostReply = 18,     // was: 'LoginToComment'
  CreateTopic = 19,   // was: 'LoginToCreateTopic'
  LoginToLogin = 20,  // was: 'LoginToLogin' RENAME to ClickedLoginBtn
  LoginBecauseNotFound = 21,
  AuthnRequiredToRead = 22,  // was: 'LoginToAuthenticate'
  NeedToBeAdmin = 23, // was: 'LoginAsAdmin'
  LoginToAdministrate = 24,
  // Last: 26, see above
}


const enum Presence {
  Active = 1,
  Away = 2,
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
  areTopicContributors: BoZ;
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
  pageType: PageRole;
  urlPath: string;
  hits: SearchHit[];
}


interface SearchHit {
  postId: PostId;
  postNr: PostNr;
  approvedRevisionNr: number;
  approvedTextWithHighlightsHtml: string[];
  currentRevisionNr: number;
}


/**
 * Describes how to update parts of the store. Can be e.g. a new chat message and the author.
 */
interface StorePatch
      extends EditorStorePatch, TagTypesStorePatch, PatsStorePatch, PageTweaksStorePatch {
  // Specified by the server, so old messages (that arive after the browser has been upgraded)
  // can be discarded.
  appVersion?: string;

  publicCategories?: Category[];
  restrictedCategories?: Category[];

  pageVersionsByPageId?: { [pageId: string]: PageVersion };
  postsByPageId?: { [pageId: string]: Post[] };

  pageMetasBrief?: PageMetaBrief[];
  superadmin?: SuperAdminStuff;
  me?: MyselfPatch;

  deletePageIds?: PageId[];
  deleteDraft?: DraftDeletor;

  allTagTypes?: TagType[];
  allTagTypeStatsById?: { [tagTypeId: string]: TagTypeStats };

  // Some pages get created lazily, namely embedded comments pages. They get
  // created when someone posts the first comment, or posts the first Like vote,
  // or configures page notf prefs (e.g. to be notified about commenst). We need
  // the lazy-created page's id, to continue doing things on that now *real* page.
  newlyCreatedPageId?: PageId;
  newlyCreatedOrigPostId?: PostId;
}

// So we know which post to highlight, to indicate it's being replied to.
interface PartialEditorStoreState {
  editorsPageId?: PageId;
  replyingToPostNr?: PostNr;  // on page editorsPageId
  editingPostId?: PostId;
}

interface EditorStorePatch extends PartialEditorStoreState {
  setEditorOpen?: boolean;
}

interface TagTypesStorePatch {
  tagTypes?: TagType[];
}

interface PatsStorePatch {
  usersBrief?: Pat[];
}

interface PageTweaksStorePatch {
  curPageTweaks?: Partial<Page>;
}


interface Settings extends TopicInterfaceSettings {
  // Signup and Login
  expireIdleAfterMins: number;
  userMustBeAuthenticated: boolean;
  userMustBeApproved: boolean;
  inviteOnly: boolean;
  allowSignup: boolean;
  enableCustomIdps: Bo;
  useOnlyCustomIdps: Bo;
  allowLocalSignup: boolean;
  allowGuestLogin: boolean;
  enableGoogleLogin: boolean;
  enableFacebookLogin: boolean;
  enableTwitterLogin: boolean;
  enableGitHubLogin: boolean;
  enableLinkedInLogin: boolean;
  requireVerifiedEmail: boolean;
  emailDomainBlacklist: string;
  emailDomainWhitelist: string;
  mayComposeBeforeSignup: boolean;
  mayPostBeforeEmailVerified: boolean;
  doubleTypeEmailAddress: boolean;
  doubleTypePassword: boolean;
  begForEmailAddress: boolean;



  // ----- Your own custom (Single) Sign-On

  enableSso: boolean;

  // ssoDisableAllOthers — later. Default to true, for old sites with  enableSso.
  // (If not set, then, can still login using other methods — then, the ssoButtonTitle
  // etc become relevant.)

  ssoUrl: string;
  ssoNotApprovedUrl: string;
  ssoLoginRequiredLogoutUrl: string;
  ssoLogoutRedirUrl: St;
  ssoShowEmbAuthnBtns: ShowEmbAuthnBtnsBitf;

  ssoPasetoV2LocalSecret: St;
  ssoPasetoV2PublicKey: St;
  ssoRefreshAuthnTokenUrl: St;
  rememberEmbSess: Bo;
  expireIdleEmbSessAfterMins: Nr;

  //ssoButtonTitle: St;
  //ssoButtonDescr: St;
  //ssoButtonImageUrl: St;
  //ssoPopupWinWidth: Nr;
  //ssoPopupWinHeight: Nr;
  //ssoPopupWinIconUrl: Nr;


  // Own email server
  enableOwnEmailServer: boolean;
  ownEmailServerConfig: string;

  // Moderation
  requireApprovalIfTrustLte: TrustLevel;  // RENAME to apprBeforeIfTrustLte  ?
  reviewAfterIfTrustLte: TrustLevel;
  maxPostsPendApprBefore: number;
  maxPostsPendRevwAftr: number;
  numFirstPostsToApprove: number;  // RENAME to ..ApprBefr, hmm, or ...ReqAppr ?
  numFirstPostsToReview: number;   // RENAME to ..RewvAftr
  enableStopForumSpam: boolean;
  enableAkismet: boolean;
  akismetApiKey: string;
  sendEmailToAkismet: boolean;

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

  // Topics — hmm these could be per category and topic type too:
  // Inherited from: TopicInterfaceSettings

  // Spam
  numFlagsToHidePost: number;
  cooldownMinutesAfterFlaggedHidden: number;
  numFlagsToBlockNewUser: number;
  numFlaggersToBlockNewUser: number;
  notifyModsIfUserBlocked: boolean;
  regularMemberFlagWeight: number;  // RENAME to trustedMemberFlagWeight [RENREGLS]
  coreMemberFlagWeight: number;

  // Features
  enableForum: boolean;
  enableApi: boolean;
  enableTags: boolean;
  enableChat: boolean;
  enableDirectMessages: boolean;
  enableSimilarTopics: boolean;
  enableCors: boolean;
  allowCorsFrom: String;
  allowCorsCreds: boolean;

  showSubCommunities: boolean;
  showExperimental: boolean;
  featureFlags: string;

  horizontalComments: boolean;

  faviconUrl: string;
  headStylesHtml: string;
  headScriptsHtml: string;
  startOfBodyHtml: string;
  endOfBodyHtml: string;

  headerHtml: string;
  navConf: BrowserCode;
  footerHtml: string;

  socialLinksHtml: string;
  logoUrlOrHtml: string;

  companyDomain: string;
  companyFullName: string;
  companyShortName: string;
  outboundEmailsFromName: St;
  termsOfUseUrl: string;
  privacyUrl: string;
  contribAgreement: ContribAgreement;
  contentLicense: ContentLicense;

  languageCode: string;
  googleUniversalAnalyticsTrackingId: string;

  allowEmbeddingFrom: string;
  embeddedCommentsCategoryId: number;
}


type PartialSettings = Partial<Settings>;


interface ShareOptions {
  title?: string;
  description?: string;
  souce?: string;
}


interface Host {
  hostname: string;
  role: HostRole;
}


type WebhookId = Nr;
type EventId = Nr;
type EventType = Nr; // later, an enum, see Scala: AuditLogEntryType
//pe EventSubtype = Nr;


// Sync w Scala:  def JsWebhook(webhook: Webhook).
//
interface Webhook {
  id: WebhookId,

  ownerId: PatId;
  runAsId?: PatId;

  enabled?: Bo,
  deleted?: Bo,

  descr?: St;
  sendToUrl: St;
  // checkDestCert: Bo,
  // sendEventTypes: EventType[];
  // sendEventSubTypes: EventSubtype[];
  apiVersion?: St;
  //extAppVersion?: St;
  //sendMaxReqsPerSec?: Nr;
  sendMaxEventsPerReq?: Nr;
  sendCustomHeaders?: Object;

  retryMaxSecs?: Nr;
  retryExtraTimes?: Nr;

  failedSince?: WhenMs;
  lastFailedHow?: Nr; // WebhookReqFailedHow
  lastErrMsgOrResp?: St;
  retriedNumTimes?: Nr;
  retriedNumSecs?: Nr;
  brokenReason?: Nr;  // WebhookBrokenReason

  sentUpToWhen?: WhenMs,
  sentUpToEventId?: EventId;
  numPendingMaybe?: Nr;
  doneForNow?: Bo;
  //retryEventIds?: EventId[];
}


// Sync w Scala:  def JsWebhookReqOut(webhook: Webhook).
//
interface WebhookReqOut {
  webhookId: Nr;
  reqNr: Nr;

  sentAt: WhenMs;
  sentToUrl?: St;
  sentByAppVer: St;  // talkyardVersion
  sentApiVersion: St,
  //sentToExtAppVersion?: St;
  sentEventTypes: EventType[];
  // sentEventSubTypes
  sentEventIds: EventId[];
  sentJson: Object;
  sentHeaders?: Object;

  retryNr?: Nr;

  failedAt?: WhenMs;
  failedHow?: St;
  errMsg?: St;

  respAt?: WhenMs;
  respStatus?: Nr;
  respStatusText?: St;
  respBody?: St;
  respHeaders?: Object;
}


interface ApiSecret {
  nr: ApiSecretNr;
  userId?: UserId;
  createdAt: WhenMs;
  deletedAt?: WhenMs;
  isDeleted: boolean;
  secretKey: string;
}


interface IdentityProviderPubFields {
  protocol: St;
  alias: St;
  displayName?: St;
  description?: St;
  // iconUrl?: St;  — later
  guiOrder?: Nr;
}


interface IdentityProviderSecretConf extends IdentityProviderPubFields {
  idpId: Nr;
  enabled: Bo;
  adminComments?: St;
  trustVerifiedEmail: Bo;
  emailVerifiedDomains?: St;
  linkAccountNoLogin: Bo;
  syncMode: Nr;
  oauAuthorizationUrl: St;
  oauAuthReqScope: St;
  oauAuthReqHostedDomain?: St;
  oauAccessTokenUrl: St;
  oauClientId: St;
  oauClientSecret: St;
  oauIssuer?: St;
  oidcUserInfoUrl: St;
  oidcUserInfoFieldsMap?: { [field: string]: string },
  oidcUserinfoReqSendUserIp?: Bo;
  oidcLogoutUrl?: St;
}




// =========================================================================
//  UI Widgets
// =========================================================================


/// For rendering a new page.
interface ShowNewPageParams {
  newPage: Page;  // | AutoPage;
  pubCats;
  pats: Pat[];
  // Is from the new page store, so it's tagTypesById, rather than StorePatch.tagTypes[].
  tagTypesById: TagTypesById;
  me?: Me;
  stuffForMe?: StuffForMe;
  history: ReactRouterHistory;
}


/// Authentication dialog
interface AuthnDlgIf {
  openToLogIn: (loginReason: LoginReason,
        anyReturnToUrl?: St, callback?: () => Vo, preventClose?: Bo) => Vo;
  openToSignUp: (loginReason: LoginReason, anyReturnToUrl?: St,
        callback?: () => Vo, preventClose?: Bo) => Vo;
  getDoAfter: () => [() => U | U, St | U];
  close: () => Vo;
}


/// For rendering category trees.
interface CatsTree {
  rootCats: CatsTreeCat[];
  baseCats: CatsTreeCat[];
  catsById: { [id: number]: CatsTreeCat };
}
interface CatsTreeCat extends Category {
  isRootCat?: Bo;
  isBaseCat?: Bo;
  isSubCat?: Bo;
  // isSubSubCat?: Bo; — later
  subCats?: CatsTreeCat[];
}


// For rendering a topic list.
interface TopicListProps {
  topics?: Topic[];
  store: Store;
  forumPath?: St;
  useTable?: Bo;
  useNarrowLayout?: Bo;
  minHeight: Nr;
  showLoadMoreButton: Bo;
  skipCatNameDescr?: Bo;
  loadMoreTopics: () => Vo;
  activeCategory?: Cat;
  setCategory?: (newCatSlug: St) => Vo;
  editCategory?: () => Vo;
  orderOffset: OrderOffset;
  topPeriod?: TopTopicsPeriod;
  setTopPeriod?: (period: TopTopicsPeriod) => Vo;
  linkCategories: Bo;
  sortOrderRoute?: St;
  setSortOrder: (sortOrder: St, remember: Bo, slashSlug: St) => Vo;
  explSetSortOrder?: St;

  // For the topic list sort and filter buttons. [reorder_forum_btns]
  location?: ReactRouterLocation;
  queryParams?: UrlParamsMap;
  history?: ReactRouterHistory;
}


interface TagListProps {
  store: Store;
  className?: St;
  tags?: Tag[];
  // tagTypesById?: TagTypesById; — maybe later
  forPost?: Post;
  forPat?: Pat;
  onClick?: () => Vo;
 }


interface TagListLiveProps {
  store: Store;
  className?: St;
  forPost?: Post;
  forPat?: Pat;
  live?: Bo; // default true
  onChanged?: () => Vo;
}


interface TagDiagProps {
  store: Store;
  forPost?: Post;
  forPat?: Pat;
  onChanged?: () => Vo;
}


interface DiscLayoutDropdownBtnProps {
  page?: Page;  // either...
  cat?: Cat;    // ...or.
  store: Store;
  layoutFor: LayoutFor;
  forCat?: Bo;  // isn't this.cat above enough?
  forEveryone?: Bo;
  onSelect: (newLayout: DiscPropsSource) => Vo;
}


interface DiscLayoutDiagState {
  atRect: Rect;
  layout: DiscPropsSource;
  default: DiscPropsDerived; // ? DiscPropsSource;
  forCat?: Bo;
  forEveryone?: Bo;
  onSelect: (newLayout: DiscPropsSource) => Vo ;
}


interface ExplainingTitleText {
  iconUrl?: St;
  title: St;
  text?: any;
  key?: any;
  subStuff?: any;
}

interface ExplainingTitleTextSelected extends ExplainingTitleText {
  eventKey: any;
}

interface ExplainingListItemProps extends ExplainingTitleText {
  id?: St;
  className?: St;
  onClick?: any;
  onSelect?: (item: ExplainingTitleText) => void;
  eventKey?: any;
  active?: Bo;
  activeEventKey?;
  disabled?: Bo;
}


interface TipsBoxProps {
  key?: St | Nr;
  message: HelpMessage;
  alwaysShow?: Bo;
  showUnhideTips?: Bo;
  className?: St;
  large?: Bo;
}


interface InputProps {
  id?: St;
  ref?;
  type?: 'text' | 'textarea' | 'number' | 'checkbox' | 'radio' | 'select' | 'custom';
  name?: St;
  bsClass?: St;
  className?: St;
  wrapperClassName?: St;
  disabled?: Bo;
  inputRef?;
  onChange?;
  onFocus?;
  onBlur?;
  tabIndex?: Nr;

  // Checkboxes and radio buttons:
  inline?: Bo;
  title?: Bo;
  label?: St;
  validationState?;
  checked?: Bo;
  defaultChecked?: Bo;

  labelFirst?: Bo;

  // Custom.
  labelClassName?: St;

  // Text and other inputs
  bsSize?;
  placeholder?: St;
  value?;
  defaultValue?;

  addonBefore?;
  help?; // St | RElm;

  children?;
}



// =========================================================================
//  Admin Area
// =========================================================================


interface AdminDashboard {
  siteStats: SiteStats;
}

interface SiteStats {
  dbStorageLimitBytes?: number;  // REMOVE
  rdbQuotaMiBs: Nr | Nl;         // CLEAN_UP [.6093456]
  dbStorageUsedBytes: number;
  fileStorageLimitBytes: number;  // REMOVE
  fileQuotaMiBs: Nr | Nl;         // CLEAN_UP [.6093456]
  fileStorageUsedBytes: number;
  numAuditRows: number;
  numGuests: number;
  numIdentities: number;
  numParticipants: number;
  numPages: number;
  numPageParticipants: number;
  numPosts: number;
  numPostTextBytes: number;
  numPostRevisions: number;
  numPostRevBytes: number;
  numPostsRead: number;
  numActions: number;
  numUploads: number;
  numUploadBytes: number;
  numNotfs: number;
  numEmailsSent: number;
}

interface AdminPanelProps {
  store: Store;
  loadAllSettingsIfNeeded: () => void;
  defaultSettings: Settings;
  currentSettings: Settings;
  editedSettings: PartialSettings;
  hosts: Host[];
  removeUnchangedSettings: (settings: PartialSettings) => void;
  setEditedSettings: (newSettings: PartialSettings) => void;
}



// =========================================================================
//  Super Admin
// =========================================================================


interface SuperAdminStuff {
  firstSiteHostname?: string;
  baseDomain: string;
  autoPurgeDelayDays?: Nr;
  sites: SASite[];
}


interface SASite {
  id: SiteId;
  status: SiteStatus;
  name: St;
  hostnames: St[];
  canonicalHostname: St;
  createdAtMs: Nr;
  deletedAtMs?: Nr;
  autoPurgeAtMs?: Nr;
  purgedAtMs?: Nr;
  staffUsers: PatVb[];
  stats: SiteStats;
  superStaffNotes?: St;
  // CLEAN_UP use also for display not only when saving. Remove from SiteStats [.6093456]
  rdbQuotaMiBs?: Nr;
  fileQuotaMiBs?: Nr;
  // --------------------
  readLimsMult: Nr | Nl;
  logLimsMult: Nr | Nl;
  createLimsMult: Nr | Nl;
  featureFlags: St;
}


interface Rect {
  top: number;
  left: number;
  right: number;
  bottom: number;
}



// =========================================================================
//  Extensions, plugins, themes
// =========================================================================


// Later, part of an extensions system.  DONT USE, rethink all this.
// For now: (too much config! Require cust nav to be on row 1 always? and
// always show page title, when has scrolled downn. Then can remove most of this.)
interface BrowserCode {
  // When, in pixels, the topbar is wide enough to fit in just one row,
  // in case using 2 rows on small screens.
  // When the topbar uses just one row, it has this class: s_Tb-1Rw
  // If using two rows, it has class: s_Tb-2Rws
  tb1Rw?: Nr;

  // When wide enough, in pixels, to add class s_Tb-Sm  (small width).
  // Otherwise class s_Tb-LtSm added (topbar less than small width).
  tbSm?: Nr;

  // When wide enough, in pixels, to add class s_Tb-Md  (medium width).
  tbMd?: Nr;

  // When wide enough, in pixels, to add class s_Tb-Lg  (large).
  tbLg?: Nr;

  // When wide enough, in pixels, to add class s_Tb-Xl  (extra large).
  tbXl?: Nr;

  // Topbar, when position: static, pat hasn't scrolled down.
  tbStc?: {
    logo?: St;
    nav?: St;
    nav2?: St;
  };
  // Topbar, when position: fixed at the top of the screen, pat has scrolled down.
  tbFxd?: {
    logo?: St;
    nav?: St;
    nav2?: St;
    tlRw2?: Bo;
  };
  topbarAtTopLogo?: string;   // RENAME to  topbarStaticLogo  or tbStcLogo .
  topbarAtTopNav?: string;    // tbStcNav
  topbarAtTopNav2Rows?: boolean;  // tbStcNv2: boolean | string
  topbarAtTopNavLine2?: string;
  topbarBitDownLogo?: string;  // RENAME to topbarFixedLogo  or tbFxdLgo
  topbarBitDownNav?: string;
  topbarBitDownNav2Rows?: boolean;
  topbarBitDownNavLine2?: string;

  // If page title should be shown on row 2, if has scrolled down, and 2 rows.
  topbarBitDownTitleRow2?: boolean;

  // Would make the topbar be 2 rows, also if wide screen and not really neede.
  // topbarAlw2Rows?: boolean;
}



// =========================================================================
//  Server requests and responses
// =========================================================================

type ErrCode = St;  // [opaque_type]

type OnDone = (() => void);
type OnDoneOrBeacon = OnDone | UseBeacon;
// Rename to RespErrHandler, which gets a RespErr { httpStatusCode, errCode, errMsg } ?
type ErrorStatusHandler = (httpStatusCode?: Nr, errCode?: ErrCode) => Vo;
type ErrorDetailsStatusHandler = (
        errorStatusCode: number | U, errorStatusText: string | U, details?) => void;


/// The browser gives you a Response, but that's not an object so { ...response } won't work.
/// This is however a real object, with the reponse payload included in 'responseText':
interface ResponseObj {
  headers: Headers; // does this still work, after being copied to other obj?
  ok: boolean;
  redirected: boolean;
  status: number;
  statusText: string;
  type: string;
  url: string;
  responseText: string;
}

// RENAME to AlterPageReqData?  "Edit" sounds wrong, since the Orig Post isn't edited.
// "Alter" means: "to make different without changing into something else"
// (so "alter" is also better thant "change", here).
interface EditPageRequestData extends DiscPropsSource {
    //pageId: PageId; — filled in By Server.ts
    newTitle?: string;
    categoryId?: CategoryId;
    pageRole?: PageRole;
    doingStatus?: PageDoingStatus;
    folder?: string;
    slug?: string;
    showId?: boolean;
    pageLayout?: PageLayout;
    htmlTagCssClasses?: string;
    htmlHeadTitle?: string;
    htmlHeadDescription?: string;
}

interface EditPageResponse {
  newTitlePost: Post;
  newAncestorsRootFirst: Ancestor[];
  newUrlPath?: string;
  newPageMeta: PageMeta;
}


interface LoginPopupLoginResponse {
  status: 'LoginOk' | 'LoginFailed';  // CLEAN_UP REMOVE no longer needed [J0935RKSDM]
  origNonceBack?: St;

  // Will have fewer capabilities than a "real" session when opening the Talkyard site
  // directly as the main window (rather than embedded somewhere).
  // Because there's a small risk that "foreign" Javascript on the embedding
  // page steals the session id (it'd be stored in sessionStorage or localStorage).
  //
  // Needed because Safari and FF block 3rd party cookies, see: docs/safari-itp-firefox-etp.md.
  //
  weakSessionId?: string;  // [NOCOOKIES]
}

interface AuthnResponse {
  // me?: Me  — or extend FetchMeResponse?  [incl_me_in_aun_rsp]
  // stuffForMe?: StuffForMe
  origNonceBack?: St;
  userCreatedAndLoggedIn: boolean;
  emailVerifiedAndLoggedIn: boolean;
  weakSessionId?: string;
}


/// If not logged in (maybe the session just expired or got deleted from another device),
/// `me` and `stuffForMe` would be null.
///
interface FetchMeResponse {
  me: Me | N;
  stuffForMe: StuffForMe | N;
}


type LoadPageIdsUrlsResponse = PageIdsUrls[];


type TagTypesById = { [tagTypeId: number]: TagType };

interface LoadTopicsResponse {
  topics: Topic[];
  storePatch: TagTypesStorePatch & PatsStorePatch;
}


interface LoadCategoryResponse {
  category: CategoryPatch;
  permissions: PermsOnPage[];
  groups: Group[];
}


interface SaveCategoryResponse {
  publicCategories: Category[];     // right type?
  restrictedCategories: Category[]; // right type?
  myNewPermissions: PermsOnPage[];  // right type?
  newCategoryId: CategoryId;
  newCategorySlug: string;
}


interface SendInvitesRequestBody {
  toEmailAddresses: string[];
  addToGroups?: UserId[];
  startAtUrl?: string;
  reinvite: boolean;
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
  emailAddress: St;
  addedAt: WhenMs;
  verifiedAt?: WhenMs;
  removedAt?:  WhenMs;
}

interface UserAccountLoginMethod {  // Maybe repl w Identity = Scala: JsIdentity?
  loginType: St;
  provider: St;  // change to providerName?
  idpAuthUrl?: St;
  idpUsername?: St;
  idpEmailAddr?: St;
  idpUserId?: St;
}


interface LoadPatVvbResponse {
  user: PatVvb;
  groupsMaySee: Group[];
  tagTypes: TagType[];
}


interface ListSessionsResponse {
  sessions: Session[];
}


interface TerminateSessionsResponse {
  terminatedSessions: Session[];
}


// COULD also load info about whether the user may apply and approve the edits.
interface LoadDraftAndTextResponse {
  pageId: PageId;
  postNr: PostNr;
  postUid: PostId; // CLEAN_UP RENAME to just postId.
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
  // Categories the member whose profile you're looking at, may see. Assuming you're
  // a staff user looking at another user's profile.
  categoriesMaySee: Category[];

  // Categories you may see but that the member whose profile you're looking at, may not see.
  // If you're looking at your own profle, this'll be empty.
  categoriesMayNotSee: Category[];

  // Only for displaying names of groups whose notf prefs are being inherited.
  groups: Group[];

  // Later: Category names too, so can display their names (not only group names).
}


/// Any title might not be available — then, safeTitleCont is "" (empty);
/// there'd be only safeHtml.
interface LinkPreviewResp {
  safeTitleCont: St;
  classAtr: St;
  safeHtml: St;
  errCode?: St;
}


/// If no title, then cannot render any inline link preview — because
/// the title is what we'd show.
interface InlineLinkPreview {
  safeTitleCont: St;
  classAtr: St;
}


interface IframeOffsetWinSize {
  top: number;
  height: number;
  iframeVisibleHeight?: number;
}


interface GenPasetoV2LocSecrResp {
  pasetoV2LocalSecret: St;
}


// =========================================================================
//  WebSocket messages
// =========================================================================


interface UserPresenceWsMsg {
  user: Pat;
  presence: Presence;
  storePatch: TagTypesStorePatch;
}



// =========================================================================
//  Server variables
// =========================================================================


// These variables are initialized in a certain <head><script>.  [5JWKA27]

interface ServerVars {
  doWhat: 'Noop' | 'StartPage' | 'ResetPwd';
  pubSiteId: string;
  siteId: SiteId;  // only in Dev mode  — repl w isFirstSite: boolean?
  secure: boolean;
  isDev: boolean;
  isTestSite: boolean;
  testNowMs: WhenMs | undefined;
  loadGlobalAdminScript: boolean;
  loadGlobalStaffScript: boolean;
  loadGlobalAllScript: boolean;

  // "js" or "min.js"  (but not ".js" or ".min.js").
  minMaxJs: St;

  // This field exists, but don't declare it, shouldn't be used at any more places. Use origin()
  // in links.ts instead.
  // const debugOrigin: string;

  pubSiteIdOrigin: St;
  cdnOriginOrEmpty: string;
  cdnOrServerOrigin: string;
  assetUrlPrefix: string;
  debugOrigin: St;

  // To be used only when rendering commonmark to html. (But when running React,
  // the store Origin fields should be used instead. There is, hovewer,
  // no store, when rendering commonmark to html, so then currently we use this.)
  // CLEAN_UP COULD send the upl prefix to replaceLinks(md) instead, so won't need this here? [5YKF02]
  uploadsUrlPrefixCommonmark: string;

  currentVersion: string;
  cachedVersion: string;

  wantsServiceWorker: boolean;
  useServiceWorker: boolean;  // if both wants it, and it's available

  pageDataFromServer: any;
  volatileDataFromServer: VolatileDataFromServer;

  isIos: boolean;
  isInLoginWindow: boolean;
  isInLoginPopup: boolean;
  isInIframe: boolean;
  isInAdminArea: boolean;
  isRtl: boolean;  // right-to-left language? then right-pull menus instead of left-pull

  // For embedded comments.
  isInEmbeddedCommentsIframe: boolean;
  isInEmbeddedEditor: boolean;

  embeddingScriptV?: Nr;
  embeddingOrigin?: string;

  // Wrap in an obj so they can be updated all at the same time?
  // ---------------
  // (In an embedded editor, they're updated dynamically, depending on which
  // blog comments iframe is active.  [many_embcom_iframes])
  embeddingUrl?: string;
  embeddedPageAltId?: string;  // RENAME to embeddedDiscussionId
  lazyCreatePageInCatId?: CategoryId;
  // Sometimes lazy-inited when the page gets lazy-created, when the first reply is posted. [4HKW28]
  embeddedPageId?: string;
  // ---------------

  // When creating new site.
  baseDomain?: string;

  newPasswordData?: NewPasswordData;

  // Is non-zero, if the server is read-only, because of maintenance work. The value
  // is the Unix second when the maintenance work is believed to be done, or 1 if unspecified.
  mainWorkUntilSecs?: number;
}


interface NewPasswordData {
  fullName: St;
  username: St;
  email: St;
  minLength: Nr;
  resetPasswordEmailId: St;
}



// =========================================================================
//  Service worker messages  [sw]
// =========================================================================


const enum SwDo {  // Service worker, do: ....
  TellMeYourVersion = 1,
  SubscribeToEvents = 2,
  StartMagicTime = 3,
  PlayTime = 4,  // sync with e2e tests [4092RMT5]
  KeepWebSocketAlive = 5,
  Disconnect = 6,
}

//enum SwSays {  // Service worker says: ....
//  GotNotfs = 1,
//}


interface MessageToServiceWorker {
  doWhat: SwDo;

  // For double checking that the service worker and the browser window
  // agrees who the current user is. (If not, that's a bug.)
  myId: UserId | U;

  // So the service worker knows if this page's js is old, and perhaps not
  // compatible with the service worker. Then the sw can reply "Please refresh the page".
  // This can happen if you open a browser page, wait some days until
  // a new service worker version is released, then open a 2nd page, which
  // installs the new service worker — and the new worker, would claim
  // the old tab [SWCLMTBS], but they might be incompatible.
  talkyardVersion: string;
}


interface TellMeYourVersionSwMessage extends MessageToServiceWorker {
  doWhat: SwDo.TellMeYourVersion;
}


interface SubscribeToEventsSwMessage extends MessageToServiceWorker {
  doWhat: SwDo.SubscribeToEvents;
  siteId: SiteId;
  myId: UserId;
  xsrfToken: string;
}


// This could include more data [VIAWS], or be sent less often,
// if we're sending other messages anyway.
interface WebSocketKeepAliveSwMessage extends MessageToServiceWorker {
  doWhat: SwDo.KeepWebSocketAlive;
  humanActiveAtMs: number;
}

// For e2e tests.
interface StartMagicTimeSwMessage extends MessageToServiceWorker {
  doWhat: SwDo.StartMagicTime;
  startTimeMs?: number;
}

// For e2e tests, keep in sync [4092RMT5].
interface PlayTimeSwMessage extends MessageToServiceWorker {
  doWhat: SwDo.PlayTime;
  extraTimeMs: number;
}


const enum SwSays {  // The service worker says: ....
  MyVersionIs = 1,
}

interface MessageFromServiceWorker {
  type: 'MyVersionIs' | 'connected' | 'disconnected' | 'eventsBroken';
  saysWhat: SwSays;
  //swJsVersion: string;
  talkyardVersion: string;
}

interface MyVersionIsMessageFromSw extends MessageFromServiceWorker {
}




// =========================================================================
//  External things whose @types won't work
// =========================================================================

// Why won't work? Maybe because isn't using AMD / ES6 modules.

// Doesn't work:
// bash# yarn add @types/react-router-dom
// /// <reference path="../../../node_modules/@types/react-router/index.d.ts" />
// and then using RouteChildrenProps. Why won't work? Who cares. Instead:
interface RouteChildProps {
  match: RouteMatch;
  location: RouteLocation;
  history: RouteHistory;
  children: any;
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



// =========================================================================
//  Public API  [PUB_API]
// =========================================================================

// This is used both by Talkyard's client side code, and by Talkyard admins who
// add LaTeX or code highlighting script tags.  (So cannot be placed in
// <root>/tests/e2e/pub-api.ts .)

interface TalkyardApi {  // [5ABJH72]
  postElemPostProcessor?: (elem: any) => void;
}

// vim: et ts=2 sw=2 tw=0 fo=r list

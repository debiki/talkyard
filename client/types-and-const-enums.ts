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

// It's so annoying to type e.g.:
//
//   const anyUser: User | undefined = Server.getUser(...);
//
// Look at this instead:
//
//   const anyUser: User | U = Server.getUser(...);
//
// And this or this — I think "boolean" is so long and distracting:
//
//   const shallFeedLion: boolean = countDaysSinceLastZebra() > 9.8 - lionSize - zebraYuminess;
//   const shallFeedLion: Bo = countDaysSinceLastZebra() > 9.8 - lionSize - zebraYuminess;
//
// And thanks to St and Nr, lots of line breaks in function signatures,
// can be avoided. — Really short names, for really frequently used things?
//
type U = undefined;
type Vo = void; // but not 'V' because that's sometimes a 'V'alue template param.
type V  = void; // ... hmm but really really not often. Let's use 'Va' for such templ params?
type Nl = null; // but not 'Nu' because that could be "Number".
type N = null;  // ... hmm I don't think so. One letter U and N for undef & null,
                // ... and 2 letters for "real" datatypes — easy to remember?
                // "Nl" is actually a bit hard to read! (the 'l')
type Ay = any;  // but not 'An' because that sounds like 'an'. Upd: Skip this. Use 'any',
                // should try to long term do away with all 'any' anyway.
type A = any;   // Why not A! Let's use 'A'.
type Bo = boolean;
type Nr = number;
type Ix = number; // zero based index into an array
type St = string;
type Bitfield = Nr;  // in Javascript, only 53? bits, the rest is for the exponent [make_opaque_type]

type Pr<R> = Promise<R>;

// Nullish and falsy values.
type Z = 0 | false | '' | null | undefined | void;  // don't incl [] or {}

// Statements like:  return anyObj && anyObj.field === 123;
//              or:  return anyObj && trueOrFalse(1, 2, 3, anyObj);
// can return null, undefined, '' or 0, if anyObj is any of those values,
// or can return a boolean. So, boolean or falsy:
type BoZ = Bo | Z;

// Void function.
type VoFn = () => Vo;

type NU  = null | undefined;
type NUV = null | undefined | void;

type StN = St | Nl;     // Many APIs return `string | null` e.g. HTMLElement.getAttribute.
type StV = St | NUV;    // 'V' for void-ish things, but not 0 or false
type NrV = Nr | NUV;    // A number or void-ish — but not '' or false


type HElm = HTMLElement;
type HInpElm = HTMLInputElement;
type HIframeElm = HTMLIFrameElement;
type Elm = Element;
// Also: type RElm = JSX.Element (React.js element).

type SiteData = any;   // [3SD5PB7]

// Many many [opaque_type]s!
type PageId = string;
type PostId = number;
type PostNr = number;
type DraftNr = number;
type PageVersion = number;
type CatId = number;
type CategoryId = number;   // too long name!
type CatRef = string;
type CategoryRef = string;  //
type TagTypeId = Nr;
type TagId = Nr;
type SiteId = number;
type PubSiteId = St;
type SiteVersion = number;
type LoginId = string;
type UserId = number;     // RENAME to PatId
type MembId = number;     // A user (not a guest or anon), group or pseudonym
type PatId = UserId;
type PatName = St;
type Username = St;
type PeopleId = UserId;   // REMOVE
type PermissionId = number;
type NotificationId = number;  // RENAME to NotfId
type NoticeId = Nr;
type ReviewTaskId = number;
type IdentityId = string;
type IpAddress = string;
type EmailId = string;
type AuditLogEntryId = number;
type TagLabel = string;
type ApiSecretNr = number;
type WhenMs = number;   // Unix time: milliseconds since 1970, needs 8 bytes
type WhenSecs = number; // Unix time: seconds since 1970, needs 8 bytes too
type WhenMins = number; // Unix time: minutes since 1970, needs just 4 bytes
type ExtId = string;
type ExtImpId = ExtId; // RENAME to ExtId

type Ref = string;   // e.g. 'rid:some-ref-id' or 'username:some_username'
type RefId = string; // e.g. 'some-ref-id',  i.e. the actual id only (no 'rid:' prefix)
type RefOrId = Ref | number;


const enum UrlPaths {
  AdminArea = '/-/admin/',
  AdminLogin = '/-/admin-login',
  AuthnRoot = '/-/authn/',
  Groups = '/-/groups/',
  SearchQ = '/-/search?q=',
  Tags = '/-/tags/',
}


// View bitfields like so:  Nr.toString(2) e.g. (2+4+16+256).toString(2) —> '100010110'.
//
const enum SessionType {
  /*
  // Enum:  — no, bitfield this too? In case 2FA or MFA?
  UsernamePassword = 1,
  ServerGlobalOAuth = 2,
  SiteCustomOAuth = 3,
  SiteCustomOSaml = 4,
  SiteCustomSso = 5,

  EmailSecret = 8,
  BackupCode = 9,

  // Combined with bitfield:
  // If pat got logged in without doing anything henself.
  // That's currently only for embedded comments, if the embedding page
  // includse a PASETO token in the HTML, which Talkyard then automatically
  // exchanges against a session id.
  UrlOneTimeSecret = 64
  AutoToken = 128,
  */

  AutoTokenSiteCustomSso = 72,  // AutoToken + SiteCustomSso, // = 72
}


const enum ShowEmbAuthnBtnsBitf {
  None = 0,
  // Join = 1
  // LoginReplyEtc = 2
  // Logout = 4
  All = 7,
}


const enum QueryParams {
  TopicFilter = 'filter',
}


/// Sync with TypeValueType in Scala:
const enum TypeValueType {
  //Null          = -3,
  //BoolTrue      = -2,
  //BoolFalse     = -1,

  NoValue         =  0,

  Int32           =  1,
  // Int53        =  2,
  // BigInt       =  3,
  // Flt32        =  4,
  Flt64           =  5,
  // BigDecimal   =  6,
  // Int32Range?
  // Int53Range?
  // BigIntRange?
  // Flt32Range?
  // Flt64Range?
  // BigDecRange?

  StrKwd          = 17,   // 2^4 + 1
  /*
  StrTxt          = 18,
  StrUrl          = 19,
  SemanticVersion = 2?,

  Date            = 33,   // 2^5 + 1
  DateRange       = 34,

  LocationLatLong = 49,   // 2^5 + 2^4 + 1

  Reminder ?      = 129,  // 2^7 + 1

  PostLink ?      = 193,  // 2^7 + 2^6 + 1
  */
}


const enum TopicFilters {
  ShowAll = 'ShowAll',
  ShowWaiting = 'ShowWaiting',
  ShowDeleted = 'ShowDeleted',
}


// Also see type FindWhat in tests/e2e-wdio7/pub-api.ts. [ty_things_types]
// And [ThingType_ids] in docs/design-docs/tags.dd.adoc.
//
const enum ThingType {  // or RENAME to TaggableThingType? no CHANGE to [ThingKind]?
  // Pats = 1 + 2 + 4 = guests, users, groups.
  Pats = 7,
  // Posts = Pages = 8, comments = 16, meta posts = 32
  Posts = 56,
  // Bookmarks = ?  (a post of type Bookmark)  [ThingKind]
  // Flags = ?  (later: a post of type Flag)
  // And: Post tags = 256? User badges (pat tags) = 512?
  //
  // Cats = 1024  ?

  // Bookmark = 78,  // what? why? Above instead

  All = Pats + Posts,  // RENAME to AllThatCanBeTagged
}


/*
const enum AllThingTypes {
  //Pats = 7,
  // 8  = meta posts (comments)
  // 16 = comments by pats
  // 32 = OrigPost = Pages,
  Pages    = 32,  // ?
  //Posts = 56,
  // And: Post tags = 64? Pat tags = 128?
  // And cats 256, then? For now.
  Cats = 256,
} */



const enum No {
  PageIdSt = '0',
  TagTypeId = 0,
  TagId = 0,
}


/// Sync w Scala class [NeverAlways] and the PostgreSQL custom domain 'never_always_d'.
///
const enum NeverAlways {
  /// Inherit from parent category or site settings or built-in default.
  /// (Not saved in the database, instead, field set to null.)
  Inherit = 0,

  //Never = 1,
  NeverButCanContinue = 2,
  Allowed = 3,
  //AllowedMustChoose = 4,
  //MustChoose = 5,
  //RecommendedMustChoose = 6,
  Recommended = 7,
  AlwaysButCanContinue = 8,
  //Always = 9,
}


const enum ReviewDecision {
  // 1nnn = Accept.
  Accept = 1001,
  InteractEdit = 1201,
  InteractReply = 1202,
  InteractAcceptAnswer = 1205,
  InteractWikify = 1207,
  // InteractTopicDoingStatus = 1221
  InteractLike = 1241,

  AcceptUnreviewedId = 1993,

  // 3nnn = Request changes.
  // 5nnn = Reject.
  DeletePostOrPage = 5001,
  DeleteAndBanSpammer = 5501,
}


const enum FlagType {
  Spam = 51,
  Inapt = 52,
  Other = 53,
}


const enum DeletedStatus {
  SelfBit = 1,
  SuccessorsBit = 2,
  TreeBits = SelfBit | SuccessorsBit,
  AncestorsBit = 4,
  AllBits = SelfBit | SuccessorsBit | AncestorsBit,
}


const enum DraftStatus {  // sync with test code [5ABXG20]
  NotLoaded = 0,
  NothingHappened = 1,
  EditsUndone = 2,
  SavedServerSide = 3,
  SavedInBrowser = 31,
  Deleted = 4,
  NeedNotSave = Deleted,
  ShouldSave = 5,
  SavingSmall = 6,
  SavingBig = 7,
  Deleting = 8,
  CannotSave = 10,
}


// draftType_toPostType() can convert to PostType.
const enum DraftType {
  Scratch = 1,
  Topic = 2,
  DirectMessage = 3,
  Edit = 4,
  Reply = 5,
  ProgressPost = 6,
}


// postType_toDraftType() can convert to DraftType.
const enum PostType {   // sync with test code [26BKA01]
  Normal = 1,         // RENAME to NormalPost
  Flat = 2,           // CLEAN_UP remove
  ChatMessage = 3,
  BottomComment = 4,  // RENAME to ProgressPost
  StaffWiki = 11,
  CommunityWiki = 12,
  CompletedForm = 21,
  MetaMessage = 31,   // RENAME to MetaPost
  Bookmark = 51,
}


const enum PostNrs {
  MaxPrivateNr = -1001,
  MinPublicNr = 0,
  TitleNr = 0,
  BodyNr = 1,
  FirstReplyNr = 2,
}


const enum PatPostRelType {
  AssignedTo = 11,
}


const enum PostVoteType {
  Like = 41,
  Disagree = 42,
  Bury = 43,
  Unwanted = 44,
}


/// See, and sync with, AnonStatus in Scala.
const enum AnonStatus {
  NotAnon = 0,
  IsAnonOnlySelfCanDeanon = 65535,
  IsAnonCanAutoDeanon = 2097151,
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


const enum NotificationType {
  DirectReply = 301,
  IndirectReply = 306,
  Mention = 302,  // DirectMention
  // GroupMention =
  // Quote = 3,
  Message = 304,   // rename to DirectMessage
  NewPost = 305,
  // NewPage =      // Add  — no? knows, since nr === BodyNr

  // [0clr_asgd_tagd_notfs]
  PostChangedMin = 400,
  PostChangedMax = 499,

  PostTagged = 406,

  AssigneesChanged = 451,
  Assigned = 453,
  Unassigned = 454,

  OneLikeVote = 501,
}


const enum EmailNotfPrefs {
  ReceiveAlways = 5,
  Receive = 1,
  DirectMessagesFromStaff = 6,
  // OnlyAboutAccount =
  DontReceive = 2,
  ForbiddenForever = 3,
  Unspecified = 4,
}


const enum IncludeInSummaries {
  Default = 0,
  YesFeatured = 1,
  NoExclude = 3
}


// Either a TopicListLayout enum value, or a CategoriesLayout, or a TopicLayout.
type PageLayout = number;


const enum TopicListLayout {
  Default = 0,  // currently same as title only [topicListLayout_getName]
  TitleOnly = 1,
  // This (same-line) isn't so user friendly: Clicking a title opens  [0_same_line_layout]
  // that page, but if clicking the same-line-brief-excerpt, then instead the excerpt
  // expands — however, if the excerpt is really short so there's not-much to expand,
  // then it can seem as if nothing happens, which has confused me, a few times.
  TitleExcerptSameLine = 2,
  ExcerptBelowTitle = 3,
  ThumbnailLeft = 4,
  ThumbnailsBelowTitle = 5,
  NewsFeed = 6,
}


const enum CategoriesLayout {
  Default = 0,
}


const enum CategoryDepth {
  RootCatDepth = 0,
  BaseCatDepth = 1,
  SubCatDepth = 2,
  SubSubCatDepth = 3,
}


const enum TopicLayout {
  Default = 0,  // then, depends on topic type. E.g. question-answers —> threaded discussion.
  ThreadedDiscussion = 1001,
  FlatProgress = 1002,
  SplitDiscussionProgress = 1003,
}


const enum ShowAuthorHow {
  UsernameOnly = 1,
  UsernameThenFullName = 2,
  FullNameThenUsername = 3,  // the default
}


const enum TopicSortOrder {
  BumpTime = 1,
  CreatedAt = 2,
  ScoreAndBumpTime = 3,
  // LikesAndBumpTime, — perhaps add back later?
}


const enum ScoreAlg {
  ByAllVotes = 1,
  ByDoItVotes = 2, // hmm but is named "OpLikeVotes" server side, what's best?
}

const enum TopTopicsPeriod {
  Day = 1,
  Week = 2,
  Month = 3,
  Quarter = 4,
  Year = 5,
  Triennial = 6,
  All = 7,

  Default = Year,  // Sync w Scala
}


const enum AutoPageType {
  NoAutoPage = 0,
  UserProfilePage = -1,
  GroupProfilePage = -2,
  AllGroupsPage = -3,
  SearchPage = -11,
  TagsList = -13,
  AboutOneTag = -14,
  //BadgesList = -15,
  //AboutOneBadge = -16,
  //StaffSpace = -21,
  AdminArea = -22,
  //SuperAdminArea = -23,
  ApiSomewhere = -99,
}


type PageType = PageRole;

const enum PageRole { // dupl in client/e2e/test-types.ts [5F8KW0P2]  RENAME to PageType
  CustomHtmlPage = 1,
  WebPage = 2,  // rename to Info?
  InfoPageMaxId = WebPage,
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
  JoinlessChat = 22,   // [JoinlessChat]   RENAME to AnyoneChat?
  OpenChat = 18,  // RENAME to StandardChat?
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


const enum DiscussionLayout {
  Default = 0,
}

type NestingDepth = number;
const InheritNesting: NestingDepth = 0;    // not stored (Null is stored instead in Postgres)
const InfiniteNesting: NestingDepth = -1;  // sync with Scala


/// Sync with Scala [PostSortOrder].
///
/// The 1st nibble says how replies to the orig post should be sorted,
/// the 2nd nibble says how to sort replies to replies (depth 2),
/// the 3rd nibble  says how to sort replies to replies to replies.
/// If 0 (unspecified), then, the prev nibble is used instead.
/// (For example, for NewestThenBest, the 1st and 2nd nibbles are set — and the
/// 2nd nibble, i.e. BestFirst, gets used for depth 2 and also 3, 4, 5 etc.)
/// If all nibbles are 0, then, any ancestor cat sort order is used,
/// and if unspecified there too, then, the site settings,
/// or, if unspecified everywhere: OldestFirst, but BestFirst for embedded comments.
///
const enum PostSortOrder {  // rename to [ComtOrder]? Since not for orig post and title post.
  Inherit = 0,   // Inherit from parent category or site settings or built-in default.
  BestFirst = 1, // Q&A sites, Reddit, StackOverflow
  NewestFirst = 2,
  OldestFirst = 3,  // all traditional forum software does this (e.g. phpBB, Discourse)
  //BestForMeFirst = _,   // what the current visitor likely wants to see
  //TrendingFirst = _,
  //ControversialFirst = _,
  //ProblematicFirst = _,
  //Random = _
  //BestThenOldest = BestFirst + (OldestFirst << 4),  // StackOverflow, if max nesting = 2
  NewestThenBest = NewestFirst + (BestFirst << 4),  // == 18
  // New flavor of theraded chat? Also, is what FB sometimes uses, but not for chatting.
  NewestThenOldest = NewestFirst + (OldestFirst << 4),  // 2 + 3*16 = 50
}

const enum ProgressLayout {
  Default = 0,
  Enabled = 1,
  MostlyDisabled = 2,
}

const enum OrigPostVotes {
  Default = 0,
  NoVotes = 1,
  LikeVotesOnly = 2,
  AllVotes = 3,
}

const enum ShowSearchBox {
  Default = 0, // or null / undefined
  No = 1,
  Yes = 2,
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


const enum TrustLevel {
  Min = 0,
  Stranger = Min,
  New = 1,
  Basic = 2,
  FullMember = 3,
  Trusted = 4,
  Regular = 5,
  CoreMember = 6,
  Max = CoreMember,
}

/// Any way to avoid repetition? (See TrustLevel above.)
/// Note that Max is different here though!
const enum TrustLevelOrStaff {
  Min = 0,
  Stranger = Min,
  New = 1,
  Basic = 2,
  FullMember = 3,
  // HelpfulMember, later? [new_trust_levels]
  Trusted = 4,
  Regular = 5,
  CoreMember = 6,
  Staff = 7,
  Admin = 8,
  Max = Admin,
}


const enum ThreatLevel {
  SuperSafe = 1,
  SeemsSafe = 2,
  HopefullySafe = 3,
  MildThreat = 4,
  ModerateThreat = 5,
  SevereThreat = 6,
}


const enum BlockedReason {  // [auto_block]
  // For the blocked person henself:
  UntoldReason = 1,
  // Details, available to staff only:
  MaybeSpammer = 2,
  ManyPostsFlagged = 4,
  ManyPostsUnpopular = 8,
  ManyPostsRejectedByStaff = 16,
  ManuallyBlockedByStaff = 32,
}


const enum Pats {
  FutureAnonId = -4,
  MaxGuestId = -2,
  NoPatId = 0,
  MinMemberId = 1,
  SystemId = 1,
  MinNotSysMemberId = 10,
  MinAuthnMemberId = 100,
}


const enum Users {
  SysbotId = 2,
}

const enum Groups {   // QUICK RENAME to Pats or PatIds?
  NoUserId = 0,
  EveryoneId = 10,
  AllMembersId = 11,
  BasicMembersId = 12,
  FullMembersId = 13,
  TrustedId = 14,
  RegularsId = 15,
  CoreMembersId = 16,
  MaxTrustLevelId = CoreMembersId,
  StaffId = 17,
  ModeratorsId = 18,
  AdminsId = 19,
  MaxBuiltInGroupId = AdminsId,
}


const enum Notices {
  TwitterLoginConfigured = 1001,
  TwitterLoginInUse = 1002,
  ChangeBlogCommentsOrigin = 1003,
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


const enum HostRole {
  Canonical = 1,
  Redirect = 2,
  Link = 3,
  Duplicate = 4,
}


const enum LayoutFor {   // or maybe ..From?
  PageWithTweaks = 1,
  PageNoTweaks   = PageWithTweaks + 1,
  Ancestors      = PageNoTweaks + 1,   // RENAME to Cats?
  SiteSettings   = Ancestors + 1,
}


const enum DiagFlavor {
  Dropdown = 1,
  Dialog   = 2,
}


const enum Verbosity {
  // Can be nice for [power_users], e.g. "T" or "TA" for "Temporarily Anonymous",
  // and they'd know what it means.
  //Letters = 1,
  VeryTerse = 2,
  Terse = 3,
  Brief = 4,
  Full = 6,
}


const enum Time {
  OneMinuteInMillis = 60 * 1000,
  OneHourInMillis = 60 * OneMinuteInMillis,
  OneDayInMillis = 24 * OneHourInMillis,
}


const enum Sizes {
  Kilobyte = 1000,   // kB
  Kibibyte = 1024,   // KiB
  Megabyte = 1000 * 1000,  // MB
  Mebibyte = 1024 * 1024,  // MiB
}


const enum RangeDir {
  Older = -1,
  // Around = 0, — later
  Newer = +1,
}


const enum WhichStorage {
  PageVar = 1,
  SessionStorage = 4,
  //CookieStorage = 8,
  LocalStorage = 12,
  //IndexDb = 16,
}


const enum StorageKeys {
  AuthnNonce = 'authnNonce',
}


const enum WidthsPx {
  DropModalDefWidth = 560,  // see CSS: [dropdown_width]
}


const enum WinDims {
}

/// Data structures and algorithms help constants.
const enum StructsAndAlgs {
  TooLongPath = 250,
}

// vim: et ts=2 sw=2 tw=0 fo=r list

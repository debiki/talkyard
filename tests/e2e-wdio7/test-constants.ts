
export const enum SiteType {
  Forum = 1,
  EmbeddedCommments = 2,
}


export const enum NewSiteOwnerType {
  OwenOwner = 1,
  GmailAccount = 2,
  FacebookAccount = 3,
  GitHubAccount = 4,
  LinkedInAccount = 5,
}



// Need to include here, for now, ? because client/app/ doesn't use any modules system,
// doesn't export any constants ?
// Name it 'TestPageRole' so name won't clash with enum 'PageRole' :-(
const TestPageRole = {  // dupl in client/app/constants.ts [5F8KW0P2]
  CustomHtmlPage: <PageRole> 1,
  WebPage: <PageRole> 2,  // rename to Info?
  Code: <PageRole> 3,
  SpecialContent: <PageRole> 4,
  EmbeddedComments: <PageRole> 5,
  Blog: <PageRole> 6,
  Forum: <PageRole> 7,
  About: <PageRole> 9,
  Question: <PageRole> 10,
  Problem: <PageRole> 14,
  Idea: <PageRole> 15,
  ToDo: <PageRole> 13,  // remove? [4YK0F24]
  MindMap: <PageRole> 11,
  Discussion: <PageRole> 12,
  FormalMessage: <PageRole> 17,
  JoinlessChat: <PageRole> 22,
  OpenChat: <PageRole> 18,
  PrivateChat: <PageRole> 19,
    // DirectMessage: 20,
  Form: <PageRole> 20,  // try to remove?
  Critique: <PageRole> 16, // [plugin] CLEAN_UP REMOVE
};

enum TestTopicListLayout {   // same as TopicListLayout
  Default = 0,
  TitleOnly = 1,
  TitleExcerptSameLine = 2,
  ExcerptBelowTitle = 3,
  ThumbnailLeft = 4,
  ThumbnailsBelowTitle = 5,
  NewsFeed = 6,
}

const TestTrustLevel = {
  New: <TrustLevel> 1,
  Basic: <TrustLevel> 2,
  FullMember: <TrustLevel> 3,
  Trusted: <TrustLevel> 4,
  Regular: <TrustLevel> 5,
  CoreMember: <TrustLevel> 6,
};

const TestDraftStatus = {  // sync with real code [5ABXG20]
  NothingHappened: 1,
  EditsUndone: 2,
  Saved: 3,
  SavedInBrowser: 31,
  Deleted: 4,
  NeedNotSave: 4,
  ShouldSave: 5,
  SavingSmall: 6,
  SavingBig: 7,
  Deleting: 8,
  CannotSave: 10,
};

const TestPostType = {  // sync with real code [26BKA01]
  Normal: 1,
  Flat: 2,
  ChatMessage: 3,
  BottomComment: 4,
  StaffWiki: 11,
  CommunityWiki: 12,
  CompletedForm: 21,
  MetaMessage: 31,
};

const TestPageNotfLevel = {
  EveryPostAllEdits: 9,
  EveryPost: 8,
  TopicProgress: 7,
  TopicSolved: 6,
  NewTopics: 5,
  Tracking: 4,
  Normal: 3,
  Hushed: 2,
  Muted: 1,
};


export default {
  MinUnixMillis: 100000000000,  // [MINMILLIS]
  LowestTempImpId: 2 * 1000 * 1000 * 1000 + 1, //2000000001,
  JanOne2020HalfPastFive: 1577900000 * 1000,  // 2020-01-01T17:33:20 can use in tests
  TestPageRole,
  TestTopicListLayout,
  TestPageNotfLevel,
  TestPostType,
  TestTrustLevel,
  TestDraftStatus,
  MaxUsernameLength: 20,  // sync with Scala [6AKBR20Q]
  TitleNr: 0,
  MaxTitleLength: 200,    // sync with Scala
  BodyNr: 1,
  FirstReplyNr: 2,  // [5FKF0F2]
  SecondReplyNr: 3,
  ThirdReplyNr: 4,
  FourthReplyNr: 5,
  UnknownUserId: -3,
  NoUserId: 0,
  SystemUserId: 1,
  SysbotUserId: 2,
  EveryoneFullName: 'Everyone',
  EveryoneId: 10,
  AllMembersId: 11,
  AllMembersUsername: 'all_members',
  BasicMembersId: 12,
  FullMembersId: 13,
  FullMembersFullName: 'Full Members',
  TrustedMembersId: 14,
  TrustedMembersFullName: 'Trusted Members',
  RegularMembersId: 15,
  //RegularMembersFullName: 'Regular Members', — or is it 'Trusted Regulars'?
  CoreMembersId: 16,
  StaffId: 17,
  ModeratorsId: 18,
  AdminsId: 19,
  DefaultDefaultCategoryId: 3,
  ReviewDecisionUndoTimoutSeconds: 12, // sync with Scala and React component [2PUKQB0]
  JanitorThreadIntervalMs: 250,  // [2YPBJ6L]
  MagicTimeoutPollMs: 500,  // [4GKB93RA]

  // The very first event is an AuditLogEntryType.ThisSiteCreated event.
  StartEventId: 2,

  // Including this in the hostname, tells the server to add a 3 seconds fake latency.
  Slow3gHostnamePart: 'slow-3g',

  SsoTestPath: '/-/sso-test',
  UsersUrlPrefix: '/-/users/',
  GroupsUrlPrefix: '/-/groups/',
  WatchbarHomeLinkTitle: 'Home',
  // ' --viagra-test-123--' makes Akismet always claim the post is spam.
  AlwaysSpamText: '--viagra-test-123--',
  AlwaysSpamEmailAddr: 'akismet-guaranteed-spam@example.com',
  SafeBrowsingMalwareLink: 'http://malware.testing.google.test/testing/malware/*',

  EmbCommentsJsonExport: 'target/emb-comments-site-dump.json',
  EmbCommentsJsonExportCopy: 'target/emb-comments-site-dump.COPY.json',
  EmbCommentsJsonExportCopyFileName: 'emb-comments-site-dump.COPY.json',

  // Nice to easily find xss related tests?
  ScriptTagName: 'script',
  javascript: 'javascript',

  FirstPageId: '1',
  SecondPageId: '2',

  SortOrderBestFirst: 1,
  SortOrderOldestFirst: 3,

  thirdParty: {
    ghostPort: 2368,
  },

  serverErrorCodes: {
    notAuthenticated: 'TyE0AUTHN_',
    accountSuspended: 'TyESUSPENDED_',
    accountSuspended2: 'TyEUSRSSPNDD_',
    notFound: 'TyE404_',
    mayNotSee: 'TyEM0SEE_',
    mayNotReplyBecauseMayNotSee: '-TyEM0RE0SEE_-TyMMBYSEE_',
    mayNotJoinChatBecauseMayNotSee: '-TyEM0SEEPG_-TyEM0SEE_-TyMMBYSEE_',
  },


  FiftyPrimes: [
    2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67,
    71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149,
    151, 157, 163, 167, 173, 179, 181, 191, 193, 197, 199, 211, 223, 227, 229],
};


/// <reference path="../../client/app-slim/constants.ts" />
/// <reference path="../../client/types-and-const-enums.ts" />


type BoolOrFn = boolean | (() => boolean);
type StringOrFn = string | (() => string);


interface TestSettings {
  debug: boolean;
  noDebug?: true;
  slow?: true;
  sloow?: true;
  slooow?: true;
  sloooow?: true;
  slooooow?: true;
  sloooooow?: true;
  slooooooow?: true;
  sloooooooow?: true;
  headless?: boolean;
  numBrowsers: number;
  specFileRetries?: Nr;
  staticServer8080?: boolean;
  staticServerGatsbyNew8000?: boolean;
  staticServerGatsbyOld8000?: boolean;
  useChromedriver?: boolean;
  useSelenium?: boolean;
  useDevtoolsProtocol?: boolean;
  parallel?: number;
  prod: boolean;
  https: Bo;  // alias for 'secure'; toggles 'secure' on
  secure: Bo;
  host: string;
  scheme: string;
  proto2Slash: St;
  block3rdPartyCookies?: boolean;
  reuseOldSite?: boolean;
  deleteOldSite: boolean;
  randomLocalHostname?: boolean;
  localHostname?: string; // must start with 'e2e-test-' (see settings.ts)
  testLocalHostnamePrefix: string;
  testEmailAddressPrefix: string;
  e2eTestPassword: string;
  forbiddenPassword: string;
  mainSiteOrigin: string;
  newSiteDomain: string;
  bail?: number;
  waitforTimeout: number;
  noTimeout?: boolean;
  // Should be: WebDriver.WebDriverLogTypes; — but missing in to-talkyard/.
  logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent';
  debugEachStep: boolean;
  debugBefore: boolean;
  debugAfterwards: boolean;
  debugIfError: boolean;
  include3rdPartyDependentTests?: boolean;
  // To test only one. E.g. 'google' (OAuth2) or 'reddit' (oEmbed link previews).
  only3rdParty?: string;
  // Facebook recently broke all Facebook login tests, by requiring https also
  // when running a localhost e2e test server. But one cannot get https certs for
  // localhost. So stop testing FB login, for now.
  // "Insecure Login Blocked: You can't get an access token or log in to
  // this app from an insecure page. Try re-loading the page as https://"
  // — Although I'm using a Facebook generated test user account, right.
  skipFacebook?: Bo;
  grep: string;
  only: string;
  isInProjBaseDir?: boolean;
  browserName: 'firefox' | 'chrome'; // won't work: Chromium, chromium


  // azureTalkyardLocalHostname?: St; — skip, instead, must be 'e2e-test-azure-oidc'
  azureOauAuthorizationUrl?: St;
  azureOauAccessTokenUrl?: St;
  azureOidcClientId?: St;
  azureOidcClientSecret?: St;
  azureOidcLogoutUrl?: St;
  azureEmailVerifiedDomains?: St;

  azureUser01UsernameAndEmail?: St;
  azureUser01Password?: St;
  azureUser01FullName?: St;

  azureUser02UsernameAndEmailDashDot?: St;
  azureUser02Password?: St;
  azureUser02FullName?: St;

  azureUser03UsernameAndEmail?: St;
  azureUser03Password?: St;

  azureUser04Username?: St;
  azureUser04Password?: St;
  azureUser04Email?: St;

  azureUser06Username?: St;
  azureUser06Password?: St;
  azureUser06Email?: St;

  azureUser11Username?: St;
  azureUser11Password?: St;
  azureUser11EmailWrongDomain?: St;
  azureUser11FullName?: St;

  azureUser12Username?: St;
  azureUser12Password?: St;
  azureUser12EmailWrongDomain?: St;

  azureUser13Username?: St;
  azureUser13Password?: St;
  azureUser13EmailWrongDomain?: St;
  azureUser13FullName?: St;

  azureUser14Username?: St;
  azureUser14Password?: St;
  azureUser14EmailWrongDomain?: St;
  azureUser14FullName?: St;


  gmailEmail?: string;
  gmailPassword?: string;
  githubUsernameMixedCase?: string;
  githubEmailMixedCase?: string;
  githubPassword?: string;
  facebookAdminPassword?: string;
  facebookAdminEmail?: string;
  facebookUserPassword?: string;
  facebookUserEmail?: string;
  linkedinPassword?: string;
  linkedinEmail?: string;
}


interface TestCounters {
  numReportedSpamFalsePositives: number;
  numReportedSpamFalseNegatives: number;
}



const enum SiteType {
  Forum = 1,
  EmbeddedCommments = 2,
}


interface NewSiteResult {
  data: NewSiteData;
  testId: string;
  siteId: number;
  talkyardSiteOrigin: string;
}


type NewSiteData = NewSiteDataForForum | NewSiteDataForEmbeddedComments;

interface NewSiteDataSharedFields {
  testId: string;
  siteType: SiteType;
  localHostname?: string;
  orgName?: string;
  origin?: string;
  embeddingUrl?: string;

  newSiteOwner: NewSiteOwnerType;
  alreadyLoggedInAtIdProvider?: boolean;

  fullName: string;
  email: string;
  username: string;
  password: string;
}


interface NewSiteDataForForum extends NewSiteDataSharedFields {
  siteType: SiteType.Forum;
  embeddingUrl?: undefined;
}


interface NewSiteDataForEmbeddedComments extends NewSiteDataSharedFields {
  siteType: SiteType.EmbeddedCommments;
  embeddingUrl: string;
}


const enum NewSiteOwnerType {
  OwenOwner = 1,
  GmailAccount = 2,
  FacebookAccount = 3,
  GitHubAccount = 4,
  LinkedInAccount = 5,
}



interface SiteData2 {   // [3SD5PB7]
  meta: SiteMeta;
  settings: TestSiteSettings;
  apiSecrets: TestApiSecret[];
  guests: TestGuest[];
  groups: GroupInclDetails[];
  groupPps: any[];
  members: Member[];
  ppStats: any[];
  ppVisitStats: any[];
  usernameUsages: any[];
  identities: any[];
  invites: any[];
  memberEmailAddresses: any[];
  blocks: any;
  categories: TestCategory[];
  pagePopularityScores: any[];
  pageNotfPrefs: any[];
  pageParticipants: any[];
  pages: Page[];
  pagePaths: PagePathWithId[];
  pageIdsByAltIds: { [lookupId: string]: string };
  permsOnPages: any[]; // PermsOnPage[];
  drafts: any[];
  posts: TestPost[];
  postActions: any[];
  emailsOut: any;
  notifications: any[];
  //uploads: any[];
  //auditLog: any[];
  reviewTasks: any[];
  isTestSiteOkDelete?: boolean;
  isTestSiteIndexAnyway?: boolean;
}


interface TestSiteSettings {
  companyFullName: string;
  allowEmbeddingFrom?: string;
  // inviteOnly?: boolean;
  allowSignup?: boolean;
  // allowLocalSignup?: boolean;
  allowGuestLogin?: boolean;
  userMustBeAuthenticated?: boolean;  // = loginRequired
  requireVerifiedEmail?: boolean;
  emailDomainBlacklist?: string;
  emailDomainWhitelist?: string;
  mayComposeBeforeSignup?: boolean;
  mayPostBeforeEmailVerified?: boolean;
  requireApprovalIfTrustLte?: TrustLevel;  // RENAME to apprBeforeIfTrustLte  ?
  reviewAfterIfTrustLte?: TrustLevel;
  numFirstPostsToReview?: number;
  numFirstPostsToApprove?: number;
  maxPostsPendApprBefore?: number;
  maxPostsPendRevwAftr?: number;
  numFlagsToHidePost?: number;
  numFlagsToBlockNewUser?: number;
  numFlaggersToBlockNewUser?: number;
  enableApi?: boolean;
  ssoUrl?: string;
  enableSso?: boolean;

  discussionLayout?: Nr;
  discPostNesting?: Nr;
  discPostSortOrder?: Nr;
  progressLayout?: Nr;
  origPostReplyBtnTitle?: St;
  origPostVotes?: Nr;
  embComNesting?: Nr;
  embComSortOrder?: Nr;
}


interface TestApiSecret {
  nr: ApiSecretNr;
  userId?: UserId;
  createdAt: WhenMs;
  deletedAt?: WhenMs;
  isDeleted: boolean;
  secretKey: string;
}


interface TestApiSecret {
  nr: ApiSecretNr;
  userId?: UserId;
  createdAt: WhenMs;
  deletedAt?: WhenMs;
  isDeleted: boolean;
  secretKey: string;
}


interface GroupInclDetails {
  id: UserId;
  createdAtMs: WhenMs;
  isGroup: true;
  username: string;
  fullName?: string;
  summaryEmailIntervalMins?: number;
  summaryEmailIfActive?: boolean;
}


interface SiteMeta {
  id?: string;
  pubId: string;
  name: string;
  localHostname: string;
  creatorEmailAddress: string;
  status: SiteStatus;
  featureFlags?: St;
  createdAtMs: number;
}


interface TestMyself {
  isLoggedIn?: Bo;
  id?: PatId;
  username?: St;
  fullName?: St;
}

interface Member {   // see also TestGuest below
  id: number;
  ssoId?: St;
  username: string;
  fullName?: string;
  createdAtMs: number;
  emailAddress?: string;
  emailVerifiedAtMs?: number;
  emailNotfPrefs?: EmailNotfPrefs;
  passwordHash?: string;
  password?: string;
  bio?: string;
  websiteUrl?: string;
  location?: string;
  isOwner?: boolean;
  isAdmin?: boolean;
  isModerator?: boolean;
  trustLevel?: TrustLevel;
  threatLevel?: ThreatLevel;
}

type WellKnownMemberUsername =
      'owen' | 'adam' | 'alice' | 'mons' | 'modya' | 'corax' |
      'regina' | 'trillian' | 'memah' | 'maria' | 'maja' | 'michael' |
      'mallory'  ;

interface NameAndPassword {
  username: string;
  password?: string;
}

interface UserWithPassword extends Member {
  password: string;
}

interface MemberToCreate extends Member {
  email?: string;
  shallBecomeOwner?: true;
  willNeedToVerifyEmail?: true;
}

interface TestGuest {  // try to rename to Guest?  See also  Member  above
  id: UserId;
  extId?: ExtId;
  fullName: string;
  emailAddress?: string;
  // emailNotfPrefs = EmailNotfPrefs.Unspecified
  createdAtMs: WhenMs;
  isGuest?: true;
  guestBrowserId?: string;
  bio?: string;
  websiteUrl?: string;
  location?: string;
  lockedThreatLevel?: ThreatLevel;
}


interface TestCategory {  // try to merge with Category in model.ts?
  id: number;
  extId?: string;
  sectionPageId: string;
  parentId?: number;
  defaultCategoryId?: number;
  name: string;
  slug: string;
  position?: number;
  description?: string;
  newTopicTypes?: number[]; // currently ignored, server side [962MRYPG]
  defaultTopicType: number;
  createdAtMs: number;
  updatedAtMs: number;
  lockedAtMs?: number;
  frozenAtMs?: number;
  deletedAtMs?: number;
  unlistCategory?: boolean;
  unlistTopics?: boolean;
}

interface SimpleCategory extends TestCategory {
  urlPaths: {
    activeTopics: string;
    topTopics: string;
    newTopics: string;
  };
}

interface TestCategoryPatch {  // or Partial<TestCategory>?
  id: number;
  extId?: ExtId;
  //sectionPageId: string;
  parentId?: number;
  parentRef?: string;
  defaultCategoryId?: number;
  name: string;
  slug: string;
  position?: number;
  description?: string;
  defaultTopicType: number;
}


interface PageToMake {
  id: PageId;
  role: PageRole;
  categoryId?: CategoryId;
  authorId: UserId;
  createdAtMs?: WhenMs;
  updatedAtMs?: WhenMs;  // remove? use bumpedAtMs instead
  publishedAtMs?: WhenMs;
  bumpedAtMs?: WhenMs;
  numChildPages?: number;
  numRepliesVisible?: number;
  numRepliesToReview?: number;
  numRepliesTotal?: number;
  numLikes?: number;
  numWrongs?: number;
  numBuryVotes?: number;
  numUnwantedVotes?: number;
  numOpLikeVotes?: number;
  numOpWrongVotes?: number;
  numOpBuryVotes?: number;
  numOpUnwantedVotes?: number;
  numOpRepliesVisible?: number;
  version?: number;
}


interface CategoryJustAdded {
  id: number;
  extId?: ExtId;
  parentId: number;
  name: string;
  slug: string;
  unlistCategory?: boolean;
  unlistTopics?: boolean;
  deletedAtMs?: number;
  aboutPageText?: string;
  aboutPage?: PageJustAdded;
  defaultTopicType?: PageRole;
}


interface PageJustAdded {
  id: string;
  folder: string;
  showId: boolean;
  slug: string;
  role: number;
  title: string;
  body: string;
  categoryId: number;
  authorId: number;
  createdAtMs: number;
  updatedAtMs: number;
}


interface PageIdWhen {
  id: string;
  createdAtMs: number;
  updatedAtMs: number;
}


interface Page {
  id: string;
  role: PageRole;      // deprecated ...
  pageType: PageRole;  // ... changing to this instead
  categoryId?: number;
  embeddingPageUrl?: string;
  authorId: number;
  createdAtMs: number;
  updatedAtMs: number;
  publishedAtMs?: number;
  bumpedAtMs?: number;
  lastReplyAtMs?: number;
  numChildPages?: number;
  numRepliesVisible?: number;
  numRepliesToReview?: number;
  numRepliesTotal?: number;
  pinOrder?: number;
  pinWhere?: PinPageWhere;
  numLikes?: number;
  numWrongs?: number;
  numBuryVotes?: number;
  numUnwantedVotes?: number;
  numOpLikeVotes?: number;
  numOpWrongVotes?: number;
  numOpBuryVotes?: number;
  numOpUnwantedVotes?: number;
  numOpRepliesVisible?: number;
  answeredAtMs?: number;
  answerPostId?: number;
  doneAtMs?: number;
  closedAtMs?: number;
  lockedAtMs?: number;
  frozenAt?: number;
  deletedAtMs?: number;
  deletedById?: number;
  unwantedAt?: number;
  plannedAt?: number;
  version: number;
  lastReplyById?: number;
  frequentPoster1Id?: number;
  frequentPoster2Id?: number;
  frequentPoster3Id?: number;
  frequentPoster4Id?: number;
}


interface PagePathWithId {
  folder: string;
  pageId: string;
  showId: boolean;
  slug: string;
  canonical: boolean;
}


/*
interface NewTestPost {
  id?: number;
  // Not just page id, because needs author, creation date, etc.
  page: Page | PageJustAdded;
  authorId?: UserId; // if absent, will be the page author
  nr: number;
  parentNr?: number;
  approvedSource: string;
  approvedHtmlSanitized?: string;
}*/


interface TestPost {  // later: try to unify with Post?
  id: number;
  pageId: string;
  nr: number;
  parentNr?: number;
  multireply?: string;
  createdAtMs: number;
  createdById: number;
  currRevStartedAtMs: number;
  currRevLastEditedAtMs?: number;
  currRevById: number;
  lastApprovedEditAtMs?: number;
  lastApprovedEditById?: number;
  numDistinctEditors: number;
  numEditSuggestions: number;
  lastEditSuggestionAtMs?: number;
  safeRevNr?: number;
  approvedSource?: string;
  approvedHtmlSanitized?: string;
  approvedAtMs?: number;
  approvedById?: number;
  approvedRevNr?: number;
  currRevSourcePatch?: string;
  currRevNr: number;
  /*
  collapsedStatus         | smallint                    | not null
  collapsed_at             | timestamp without time zone |
  collapsed_by_id          | integer                     |
  closed_status            | smallint                    | not null
  closed_at                | timestamp without time zone |
  closed_by_id             | integer                     |
  hidden_at                | timestamp without time zone |
  hidden_by_id             | integer                     |
  hidden_reason            | character varying           |
  */
  deletedStatus: number;
  deletedAtMs?: number;
  deletedById?: number;
  /*
  pinned_position          | smallint                    |
  pinned_at                | timestamp without time zone |
  pinned_by_id             | integer                     |
  */
  numPendingFlags?: number;
  numHandledFlags?: number;
  numLikeVotes: number;
  numWrongVotes: number;
  numTimesRead: number;
  numBuryVotes: number;
  numUnwantedVotes: number;
  postType?: number;
  prevRevNr?: number;
}


interface NumReplies {
  numNormal: number;
  numPreviews: number;
  numUnapproved: number;
  numDeleted: number;
}


interface EditHistoryEntry {
  authorUsername?: string;
  authorFullName?: string;
  diffHtml: string;
}


interface IdAddress {
  id: SiteId;
  pubId: string;
  origin?: string;      // e.g. https://kittens-forum.example.com
  siteIdOrigin: string; // e.g. https://site-123.example.com
  cdnOriginOrEmpty: St; // e.g. https://test-cdn.example.com  or ''
  cdnOrSiteOrigin?: St; // e.g. https://test-cdn.example.com or https://kittens.ex.co
}


interface EmailSubjectBody {
  subject: string;
  bodyHtmlText: string;
}


interface EmptyTestForum {
  siteData: SiteData;
  forumPage: any;
  members: {
    owen?: Member;
    adam?: Member;
    alice?: Member;
    mons?: Member;
    modya?: Member;
    corax?: Member;
    regina?: Member;
    trillian?: Member;
    memah?: Member;
    maria?: Member;
    maja?: Member;
    michael?: Member;
    mallory?: Member;
    // If adding really many users.
    minions?: Member[];
  };
  guests: {
  };
  topics: {};
  categories: {
    rootCat: { id: Nr },
    rootCategory: { id: number },
    catA: CategoryJustAdded;
    categoryA: CategoryJustAdded;
  };
}


interface TwoCatsTestForum extends EmptyTestForum {
  topics: {
    aboutCategoryA: { title: string };
    aboutStaffCat: { title: St };
    aboutStaffOnlyCategory: { title: string };
  };
  categories: {
    rootCat: { id: Nr },
    rootCategory: { id: number },
    catA: CategoryJustAdded;
    categoryA: CategoryJustAdded;
    staffCat: CategoryJustAdded;
    staffOnlyCategory: CategoryJustAdded;
  };
}


interface CatABTestForum extends TwoCatsTestForum {
  topics: {
    aboutCategoryA: { title: string };
    aboutStaffCat: { title: St };
    aboutStaffOnlyCategory: { title: string };
  };
  categories: {
    rootCat: { id: Nr },
    rootCategory: { id: number },
    catA: CategoryJustAdded;
    categoryA: CategoryJustAdded;
    catB: CategoryJustAdded;
    staffCat: CategoryJustAdded;
    staffOnlyCategory: CategoryJustAdded;
  };
}


interface TwoPagesTestForum extends TwoCatsTestForum {
  topics: {
    byMariaCatA: PageJustAdded;
    byMariaCategoryA: PageJustAdded;
    byMichaelCatA: PageJustAdded;
    byMichaelCategoryA: PageJustAdded;
    aboutCatA: { title: string };
    aboutCategoryA: { title: string };
    aboutStaffCat: { title: string };
    aboutStaffOnlyCategory: { title: string };
  };
  categories: {
    rootCat: { id: Nr },
    rootCategory: { id: number },
    catA: CategoryJustAdded;
    categoryA: CategoryJustAdded;
    staffCat: CategoryJustAdded;
    staffOnlyCategory: CategoryJustAdded;
    specificCat: CategoryJustAdded;
    specificCategory: CategoryJustAdded;
  };
}


interface LargeTestForum extends EmptyTestForum {
  topics: {
    byMariaCategoryA: PageJustAdded;
    byMariaCategoryANr2: PageJustAdded;
    byMariaCategoryANr3: PageJustAdded;
    byMariaCategoryB: PageJustAdded;
    byMariaStaffOnlyCat: PageJustAdded;
    byMariaUnlistedCat: PageJustAdded;
    byMariaDeletedCat: PageJustAdded;
    byMichaelCategoryA: PageJustAdded;
    aboutCatA: { title: St };
    aboutCategoryA: { title: string };
    aboutCatB: { title: St };
    aboutCategoryB: { title: string };
    aboutUnlistedCat: { title: St };
    aboutUnlistedCategory: { title: string };
    aboutStaffCat: { title: St };
    aboutStaffOnlyCategory: { title: string };
    aboutDeletedCat: { title: St };
    aboutDeletedCategory: { title: string };
  };
  categories: {
    rootCat: { id: Nr },
    rootCategory: { id: number },
    catA: CategoryJustAdded;
    categoryA: CategoryJustAdded;
    catB: CategoryJustAdded;
    categoryB: CategoryJustAdded;
    staffCat: CategoryJustAdded;
    staffOnlyCategory: CategoryJustAdded;
    unlistedCat: CategoryJustAdded;
    unlistedCategory: CategoryJustAdded;
    deletedCat: CategoryJustAdded;
    deletedCategory: CategoryJustAdded;
  };
}


// QUICK RENAME to SingleSignOnUser?  Because ExternalUser is instead nowadays for upserting
// users via API — might possibly evolve a bit differently from the SSO api.
interface ExternalUser {   // sync with Scala [7KBA24Y]
  ssoId: string;
  extId?: string;
  //externalUserId: string; //  deprecated, 2019-08-18, earlier name for ssoId (not extId)
  primaryEmailAddress: string;
  isEmailAddressVerified: boolean;
  username?: string;
  fullName?: string;
  avatarUrl?: string;
  aboutUser?: string;
  isAdmin?: boolean;
  isModerator?: boolean;
}


interface LinkPreviewProvider {
  name: St;
  inSandboxedIframe: Bo;  // default true
  inDoubleIframe?: Bo;    // default false
  lnPvClassSuffix?: St;
}


interface EmailMatchResult {
  matchedEmail: EmailSubjectBody;
  matchingString?: string;
  matchingStrings: string[];
}


// Right now, constraints like >= 1 aren't supported in Typescript, but this works, and, in test
// cases, probably won't ever need larger numbers?
type IntAtLeastOne = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19;

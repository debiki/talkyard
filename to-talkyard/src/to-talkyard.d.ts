/// <reference path="../../client/types-and-const-enums.ts" />

//type SiteData = any;   // try moving `interface SiteData` [3SD5PB7] to here


interface CategoryDumpV0 {
  id: CategoryId;
  extImpId?: ExtImpId;
  sectionPageId?: PageId;
  parentId?: CategoryId;
  defaultSubCatId?: CategoryId;
  name: string;
  slug: string;
  position?: number;
  description?: string;
  defaultTopicType?: PageRole;  // ?
  unlistCategory?: boolean;
  unlistTopics?: boolean;
  includeInSummaries?: IncludeInSummaries;
  createdAtMs: WhenMs;
  updatedAtMs?: WhenMs;  // default to createdAt? or remove from db?
  lockedAtMs?: WhenMs;
  frozenAtMs?: WhenMs;
  deletedAtMs?: WhenMs;
}


interface PageToAdd {
  dbgSrc?: string;
  id: string;
  extId?: ExtId;  // deprecated
  refId?: ExtId;  // use instead
  altIds?: string[];
  extImpId?: ExtImpId;
  folder?: string;
  showId?: boolean;
  slug?: string;
  role: number;// PageRole;
  layout?: PageLayout;
  title: string;
  body: string;
  categoryId?: number;// CategoryId;
  authorId: number;// UserId;
  createdAtMs?: number;// WhenMs;
  bumpedAtMs?: number;// WhenMs;
}


interface PageDumpV0 {
  dbgSrc?: string;
  id: PageId;
  extImpId?: ExtImpId; // RENAME to just  extId? because not *importing* when *upserting*
  //altIds: PageId[];
  pageType: PageRole;
  version: number;
  createdAt: WhenMs;
  updatedAt: WhenMs;
  publishedAt?: WhenMs;
  bumpedAt?: WhenMs;
  lastApprovedReplyAt?: WhenMs;
  lastApprovedReplyById?: UserId;
  categoryId?: CategoryId;
  embeddingPageUrl?: string;
  authorId: UserId;
  frequentPosterIds?: UserId[];
  layout?: number;
  pinOrder?: number;
  pinWhere?: PinPageWhere;
  numLikes?: number;
  numWrongs?: number;
  numBurys?: number;
  numUnwanteds?: number;
  numRepliesVisible?: number;
  numRepliesTotal?: number;
  numPostsTotal?: number;
  numOrigPostLikeVotes?: number;
  numOrigPostWrongVotes?: number;
  numOrigPostBuryVotes?: number;
  numOrigPostUnwantedVotes?: number;
  numOrigPostRepliesVisible?: number;
  answeredAt?: WhenMs;
  answerPostId?: PostId;
  plannedAt?: WhenMs;
  startedAt?: WhenMs;
  doneAt?: WhenMs;
  closedAt?: WhenMs;
  lockedAt?: WhenMs;
  frozenAt?: WhenMs;
  //unwantedAt?:
  hiddenAt?: WhenMs;
  deletedAt?: WhenMs;
  htmlTagCssClasses?: string;
  htmlHeadTitle?: string;
  htmlHeadDescription?: string;
}


interface PagePathDumpV0 {
  folder: string;
  pageId: PageId,
  showId: boolean;
  slug: string;
  canonical: boolean;
}


interface NewTestPost {   // RENAME to PostToAdd  and move to  /tests/e2e/..somewhere..
  id?: number;

  // Not just page id, because needs author, creation date, etc.
  // Ignored if importing external things — then, extPageImpId used instead.
  page?: any;// Page | PageJustAdded;

  authorId?: number;// UserId; // if absent, will be the page author

  // If importing additional things to an already existing site,
  // these are ignored; instead, the extImpId and parentExtImpId are used.
  nr?: number;
  parentNr?: number;

  // If re-importing the same things, we'll update posts by external import id,
  // insted of creating new. Also, when importing, we don't know what the parent
  // nr will be, so, in the import, we reference the parent via its external
  // import id. — Exactly what the external import id is, depends on what you're
  // importing. WordPress commets has a `wp_comment_id` field for example.
  extImpId?: ExtImpId;
  extPageImpId?: string;
  extParentImpId?: string;

  postType?: number;
  approvedSource: string;
  approvedHtmlSanitized?: string;
  postedFromIp?: string;
  postedAtUtcStr?: string;
  postedAtMs?: number;// WhenMs;
  approvedAtMs?: number; // WhenMs;
}


interface PostDumpV0 {   // RENAME to PostPatchV0
  id: PostId;
  extImpId?: ExtImpId;
  pageId: PageId;
  nr: PostNr;
  parentNr?: PostNr;
  postType: PostType,
  createdAt: WhenMs;
  createdById: UserId;
  currRevById: UserId;
  currRevStartedAt: WhenMs;
  currRevLastEditedAt?: WhenMs;
  currRevSourcePatch?: string;
  currRevNr: number;
  prevRevNr?: number;
  lastApprovedEditAt?: WhenMs;
  lastApprovedEditById?: UserId;
  numDistinctEditors?: number;
  safeRevNr?: number;
  approvedSource?: string;
  approvedHtmlSanitized?: string;
  approvedAt?: WhenMs;
  approvedById?: UserId;
  approvedRevNr?: number;
  //collapsedStatus?: any;
  collapsedAt?: WhenMs;
  collapsedById?: UserId;
  //closedStatus?: any;
  closedAt?: WhenMs;
  closedById?: UserId;
  hiddenAt?: WhenMs;
  hiddenById?: UserId;
  hiddenReason?: string;
  //deletedStatus?: any;
  deletedAt?: WhenMs;
  deletedById?: UserId;
  deletedStatus?: DeletedStatus;
  pinnedPosition?: number;
  branchSideways?: boolean;
  numPendingFlags?: number;
  numHandledFlags?: number;
  numEditSuggestions?: number;
  numLikeVotes?: number;
  numWrongVotes?: number;
  numBuryVotes?: number;
  numUnwantedVotes?: number;
  numTimesRead?: number;
}

interface GuestDumpV0 {   // RENAME to GuestPatchV0
  id: UserId;
  extImpId?: ExtImpId;
  createdAt: WhenMs;
  fullName?: string;
  guestBrowserId?: string;
  emailAddress?: string;
  lockedThreatLevel?: ThreatLevel;
  //postedFromIp: string;
  //createdTheLatestAtUtcStr?: string;   // what?
  //url?: string;
}


interface SaxTag {
  name: string;
  isSelfClosing: boolean;
  attributes: { [key: string]: string };
}


interface WpBlogPostAndComments {
  title?: string;
  link?: string;
  pubDate?: string;
  guid?: string;
  description?: string;
  contentEncoded?: string;
  excerptEncoded?: string;
  wp_post_id?: number;  // e.g. 3469
  wp_post_date?: string; // e.g. 2016-01-09 21:53:01
  wp_post_date_gmt?: string;    // e.g. 2016-01-10 03:53:01
  wp_comment_status?: string;   // e.g. open
  wp_ping_status?: string;      // e.g. open
  wp_post_name?: string;        // e.g. public-talks-h2-2016
  wp_status?: string;           // e.g. publish
  wp_post_parent?: number;      // e.g. 0
  wp_menu_order?: number;       // e.g. 0
  wp_post_type?: string;        // e.g. post
  wp_is_sticky?: number;        // e.g. 0
  category?: string;            // e.g. Announcement
  comments: WpComment[];
}


interface WpComment {
  wp_comment_id?: number;       // e.g. 267390
  wp_comment_author?: string;   // e.g. Jane
  wp_comment_author_email?: string;  // e.g. jane@example.com
  wp_comment_author_url?: string;
  wp_comment_author_ip?: string;  // e.g. 112.113.114.115
  wp_comment_date?: string;     // e.g. 2016-01-09 23:30:16
  wp_comment_date_gmt?: string; // e.g. 2016-01-10 05:30:16
  wp_comment_content?: string;  // Sarah, are you conducting any seminars this month? Please let me know.
  wp_comment_approved?: number; // e.g. 1
  wp_comment_type?: any;        // e.g. 'pingback' or 'trackback' or '' (normal comment)
  wp_comment_parent?: number;   // e.g. 0 = replies to blog post, or 267390 = replies to wp_comment_id.
  wp_comment_user_id?: number;  // e.g. 0  or 2
  //metas: CommentMeta[];
}


// Example meta:
// akismet_history -> a:3:{s:4:"time";d:1453589774.1832039356231689453125;s:5:"event";s:15:"status-approved";s:4:"user";s:6:"tanelp";}
// akismet_result -> false
// (many items with same key = yes can happen)
interface CommentMeta {
  wp_meta_key?: string;
  wp_meta_value?: string;
}


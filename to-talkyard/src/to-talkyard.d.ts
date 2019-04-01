/// <reference path="../../client/app-slim/constants.ts" />


type SiteData = any;   // try moving `interface SiteData` [3SD5PB7] to here


interface PageToAdd {
  dbgSrc?: string;
  id: string;
  altIds?: string[];
  folder?: string;
  showId?: boolean;
  slug?: string;
  role: PageRole;
  title: string;
  body: string;
  categoryId?: CategoryId;
  authorId: UserId;
  createdAtMs?: WhenMs;
  bumpedAtMs?: WhenMs;
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
  authorId: number,
  createdAtMs: number;
  updatedAtMs: number;
}


interface NewTestPost {   // RENAME to PostToAdd
  id?: number;
  // Not just page id, because needs author, creation date, etc.
  page: Page | PageJustAdded;
  authorId?: UserId; // if absent, will be the page author
  nr: number;
  parentNr?: number;
  type?: number; // PostType
  approvedSource: string;
  approvedHtmlSanitized?: string;
  postedFromIp?: string;
  postedAtUtcStr?: string;
  postedAtMs?: WhenMs;
  isApproved?: boolean;
}


interface GuestToAdd {
  email: string;
  fullName: string;
  postedFromIp: string;
  createdTheLatestAtUtcStr: string;
  url: string;
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


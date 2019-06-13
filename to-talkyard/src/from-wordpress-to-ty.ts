/// <reference path="to-talkyard.d.ts" />


import * as _ from 'lodash';
import * as sax from 'sax';

import { buildSite } from '../../tests/e2e/utils/site-builder';
import c from '../../tests/e2e/test-constants';
const strict = true; // set to false for html-mode
const parser = sax.parser(strict, {});

let verbose: boolean | undefined;


const wpPosts: WpBlogPostAndComments[] = [];

let curWpBlogPost: WpBlogPostAndComments | undefined = undefined;
let curWpComment: WpComment | undefined = undefined;
let curWpTagName: string | undefined = undefined;

const tySiteData: SiteData = {
  guests: [],
  pages: [],
  pagePaths: [],
  posts: [],
};


const builder = buildSite(tySiteData);

const WordPressIdSuffix = ':wp';


function addBlogPostAndComments(wpBlogPostAndComments: WpBlogPostAndComments) {
  if (!wpBlogPostAndComments.link) {
    // What's this? An unreachable blog post? Skip.
    return;
  }

  const urlNoOrigin = wpBlogPostAndComments.link.replace(/https?:\/\/[^/]+\//, '');  // dupl [305MBKR52]

  const pageUrl = wpBlogPostAndComments.link;

  const pageToAdd: PageToAdd = {
    dbgSrc: 'ToTy',
    id: '?',
    extImpId: wpBlogPostAndComments.wp_post_id + WordPressIdSuffix,
    altIds: [urlNoOrigin],
    folder: '/',
    showId: true,
    slug: 'imported-from-wordpress',
    role: c.TestPageRole.Discussion,
    title: "Comments for " + wpBlogPostAndComments.title,
    body: `Comments for <a href="${pageUrl}">${pageUrl}</a>`,
    categoryId: c.DefaultDefaultCategoryId,
    authorId: c.SystemUserId,
  };

  const pageJustAdded: PageJustAdded = builder.addPage(pageToAdd);

  // To do: add dummy title and body posts.  [307K740]


  const guestsByEmailNameUrl: { [ipEmailNameUrl: string]: GuestToAdd } = {};
  const postsByWpNr: { [wpPostId: number]: NewTestPost } = {};

  // Create posts and guests.
  _.each(wpBlogPostAndComments.comments, (wpComment: WpComment) => {
    const guest: GuestToAdd = {
      fullName: wpComment.wp_comment_author,
      email: wpComment.wp_comment_author_email,
      postedFromIp: wpComment.wp_comment_author_ip,
      createdTheLatestAtUtcStr: wpComment.wp_comment_date_gmt,
      url: wpComment.wp_comment_author_url,
    };

    // Same email, name and URL means it's most likely the same person.
    // (Remember that email addresses are fairly private: different commenters don't know each
    // others' emails. If someone really did know someone else's email, and impersonated him/her
    // and wrote weird things, pretending to be hen — then maybe the way to deal with that, is that
    // the blog owner just deletes those weird comments, after imported to Talkyard. Or maybe
    // creates a new user named Weird Guest and assigns ownership of the weird comments
    // to that user.  [change-author])
    const emailNameUrl = `${guest.email || ''}|${guest.fullName || ''}|${guest.url || ''}`;

    guestsByEmailNameUrl[emailNameUrl] = guest;

    // There are different WordPress comment types.
    //
    // Normal comments, example:  (comment_approved: 0 means not approved, 1 means yes approved)
    //
    // <wp:comment>
    // <wp:comment_id>344634</wp:comment_id>
    // <wp:comment_author><![CDATA[Author Name]]></wp:comment_author>
    // <wp:comment_author_email><![CDATA[author-email@example.com]]></wp:comment_author_email>
    // <wp:comment_author_url></wp:comment_author_url>
    // <wp:comment_author_IP><![CDATA[111.111.111.111]]></wp:comment_author_IP>
    // <wp:comment_date><![CDATA[2001-12-31 23:59:59]]></wp:comment_date>
    // <wp:comment_date_gmt><![CDATA[2001-12-31 23:59:59]]></wp:comment_date_gmt>
    // <wp:comment_content><![CDATA[Hi there. So very hello! Greetings. Bye.]]></wp:comment_content>
    // <wp:comment_approved><![CDATA[0]]></wp:comment_approved>
    // <wp:comment_type><![CDATA[]]></wp:comment_type>
    // <wp:comment_parent>0</wp:comment_parent>
    // <wp:comment_user_id>0</wp:comment_user_id>
    // </wp:comment>
    //
    // And pingbacks and trackbacks. They have a remote blog post title, as author name.
    // And the author url, is the url to that remote blog post. There's no email address.
    //
    // Pingback example:
    //
    // <wp:comment>
    // <wp:comment_id>4709</wp:comment_id>
    // <wp:comment_author><![CDATA[Pingback Blog Post Title]]></wp:comment_author>
    // <wp:comment_author_email><![CDATA[]]></wp:comment_author_email>
    // <wp:comment_author_url>http://www.example.com/blog-post-title.html</wp:comment_author_url>
    // <wp:comment_author_IP><![CDATA[111.111.111.111]]></wp:comment_author_IP>
    // <wp:comment_date><![CDATA[2001-12-31 23:59:59]]></wp:comment_date>
    // <wp:comment_date_gmt><![CDATA[2001-12-31 23:59:59]]></wp:comment_date_gmt>
    // <wp:comment_content><![CDATA[[...] Blah blah, is so very blah blah yes yes this
    //    can be a whole paragraph long [...]]]></wp:comment_content>
    // <wp:comment_approved><![CDATA[1]]></wp:comment_approved>
    // <wp:comment_type><![CDATA[pingback]]></wp:comment_type>
    // <wp:comment_parent>0</wp:comment_parent>
    // <wp:comment_user_id>0</wp:comment_user_id>
    // </wp:comment>
    //
    // Trackback example:
    //
    // <wp:comment>
    // <wp:comment_id>36708</wp:comment_id>
    // <wp:comment_author><![CDATA[Some blog post title]]></wp:comment_author>
    // <wp:comment_author_email><![CDATA[]]></wp:comment_author_email>
    // <wp:comment_author_url>http://blog2.example.com/topic-title</wp:comment_author_url>
    // <wp:comment_author_IP><![CDATA[222.222.222.222]]></wp:comment_author_IP>
    // <wp:comment_date><![CDATA[2001-01-31 23:59:59]]></wp:comment_date>
    // <wp:comment_date_gmt><![CDATA[2001-01-31 23:59:59]]></wp:comment_date_gmt>
    // <wp:comment_content><![CDATA[<strong>Something something</strong>
    //
    // Then usually a blank line (see above), then just a little bit more text]]></wp:comment_content>
    // <wp:comment_approved><![CDATA[1]]></wp:comment_approved>
    // <wp:comment_type><![CDATA[trackback]]></wp:comment_type>
    // <wp:comment_parent>0</wp:comment_parent>
    // <wp:comment_user_id>0</wp:comment_user_id>
    // </wp:comment>

    // To do, for pingback and trackbacks:
    //  - Set name to the hostname of the blog, not the blog post title.
    //  - Add a post title field to Talkyard's database, for the blog post title.
    //  - Add post types:  Pingback and Trackback, and Webmention too.
    //  - Add remote url field = the url to the pingback/trackback remote blog post.

    const isApproved = wpComment.wp_comment_approved === 1;
    if (!isApproved)
      return; // not yet supported

    const postedAtMs = Date.parse(wpComment.wp_comment_date_gmt);

    const postToAdd: NewTestPost = {
      // Not in use when importing things:
      page: undefined,
      nr: undefined,
      parentNr: undefined,
      // Instead, these three:
      extImpId: wpComment.wp_comment_id + WordPressIdSuffix,
      extPageImpId: pageToAdd.extImpId,
      extParentImpId: wpComment.wp_comment_parent + WordPressIdSuffix,
      authorId: c.SystemUserId,
      approvedSource: wpComment.wp_comment_content,
      postedFromIp: wpComment.wp_comment_author_ip,
      postedAtMs,
      approvedAtMs: postedAtMs,
    };

    postsByWpNr[wpComment.wp_comment_id] = postToAdd;
  });

  _.each(guestsByEmailNameUrl, builder.addGuest);
  _.each(postsByWpNr, builder.addPost);
}


parser.onopentag = function (tag: SaxTag) {
  curWpTagName = tag.name;
  //let numInterestingAttrsDbg = 0;
  //let interestingAttrsDbgStr = '';
  let addNewline = false;

  if (tag.name === 'item') {
    if (curWpBlogPost) {} // log error: nested posts
    else if (curWpComment) {} // log error: post in comment
    else curWpBlogPost = { comments: [] };
    addNewline = true;
  }
  else if (tag.name === 'wp:comment') {
    if (!curWpBlogPost) {} // log error: comment outside post
    else if (curWpComment) {} // log error: comment inside comment
    else curWpComment = {};
  }
  else {
    return;
  }

  // For debugging.
  if (verbose) {
    const attrStr =   //numInterestingAttrsDbg ? ' ' + numInterestingAttrsDbg :
        _.isEmpty(tag.attributes) ? '' : ' …';
    const newline = addNewline ? '\n' : '';
    process.stdout.write(`${newline}<${tag.name + attrStr}>`);
  }
};


parser.onclosetag = function (tagName: string) {
  if (tagName === 'item' && curWpBlogPost) {
    wpPosts.push(curWpBlogPost);
    addBlogPostAndComments(curWpBlogPost);
    curWpBlogPost = undefined;
  }
  else if (tagName === 'wp:comment' && curWpBlogPost && curWpComment) {
    curWpBlogPost.comments.push(curWpComment);
    curWpComment = undefined;
  }
  else {
    return;
  }
  if (verbose) process.stdout.write(`</${tagName}>`);
};


parser.oncdata = handleText;
parser.ontext = handleText;


function handleText(textOrCdata: string) {
  // Blog post fields.
  if (!curWpComment && curWpBlogPost) switch (curWpTagName) {
    case 'title':
      curWpBlogPost.title =
          curWpBlogPost.title || textOrCdata;
      break;
    case 'link':
      curWpBlogPost.link =
          curWpBlogPost.link || textOrCdata;
      break;
    case 'pubDate':
      curWpBlogPost.pubDate =
          curWpBlogPost.pubDate || textOrCdata;
      break;
    case 'dc:creator':
      //curWpBlogPost. ?? = textOrCdata;
      break;
    case 'guid':
      curWpBlogPost.guid =
          curWpBlogPost.guid || textOrCdata;
      break;
    case 'description':
      curWpBlogPost.description =
          curWpBlogPost.description || textOrCdata;
      break;
    case 'content:encoded':
      curWpBlogPost.contentEncoded =
          curWpBlogPost.contentEncoded || textOrCdata;
      break;
    case 'excerpt:encoded':
      curWpBlogPost.excerptEncoded =
          curWpBlogPost.excerptEncoded || textOrCdata;
      break;
    case 'wp:post_id':
      curWpBlogPost.wp_post_id =
          curWpBlogPost.wp_post_id || parseInt(textOrCdata);
      break;
    case 'wp:post_date':
      curWpBlogPost.wp_post_date =
          curWpBlogPost.wp_post_date || textOrCdata;
      break;
    case 'wp:post_date_gmt':
      curWpBlogPost.wp_post_date_gmt =
          curWpBlogPost.wp_post_date_gmt || textOrCdata;
      break;
    case 'wp:comment_status':
      curWpBlogPost.wp_comment_status =
          curWpBlogPost.wp_comment_status || textOrCdata;
      break;
    case 'wp:ping_status':
      curWpBlogPost.wp_ping_status =
          curWpBlogPost.wp_ping_status || textOrCdata;
      break;
    case 'wp:post_name':
      curWpBlogPost.wp_post_name =
          curWpBlogPost.wp_post_name || textOrCdata;
      break;
    case 'wp:status':
      curWpBlogPost.wp_status =
          curWpBlogPost.wp_status || textOrCdata;
      break;
    case 'wp:post_parent':
      curWpBlogPost.wp_post_parent =
          curWpBlogPost.wp_post_parent || parseInt(textOrCdata);
      break;
    case 'wp:menu_order':
      curWpBlogPost.wp_menu_order =
          curWpBlogPost.wp_menu_order || parseInt(textOrCdata);
      break;
    case 'wp:post_type':
      curWpBlogPost.wp_post_type =
          curWpBlogPost.wp_post_type || textOrCdata;
      break;
    case 'wp:post_password':
      // Exclude.
      break;
    case 'wp:is_sticky':
      // 0 or 1
      curWpBlogPost.wp_is_sticky =
          curWpBlogPost.wp_is_sticky || parseInt(textOrCdata);
      break;
    case 'category':
      curWpBlogPost.category =
          curWpBlogPost.category || textOrCdata;
      break;
    default:
      // Ignore.
  }

  // Comment fields.
  if (curWpComment) switch (curWpTagName) {
    case 'wp:comment_id':
      curWpComment.wp_comment_id =
          curWpComment.wp_comment_id || parseInt(textOrCdata);
      break;
    case 'wp:comment_author':
      curWpComment.wp_comment_author =
          curWpComment.wp_comment_author || textOrCdata;
      break;
    case 'wp:comment_author_email':
      curWpComment.wp_comment_author_email =
          curWpComment.wp_comment_author_email || textOrCdata;
      break;
    case 'wp:comment_author_url':
      curWpComment.wp_comment_author_url =
          curWpComment.wp_comment_author_url || textOrCdata;
      break;
    case 'wp:comment_author_IP':
      curWpComment.wp_comment_author_ip =
          curWpComment.wp_comment_author_ip || textOrCdata;
      break;
    case 'wp:comment_date':
      curWpComment.wp_comment_date =
          curWpComment.wp_comment_date || textOrCdata;
      break;
    case 'wp:comment_date_gmt':
      curWpComment.wp_comment_date_gmt =
          curWpComment.wp_comment_date_gmt || textOrCdata;
      break;
    case 'wp:comment_content':
      curWpComment.wp_comment_content =
          curWpComment.wp_comment_content || textOrCdata;
      break;
    case 'wp:comment_approved':
      // 0 or 1
      curWpComment.wp_comment_approved =
          curWpComment.wp_comment_approved || parseInt(textOrCdata);
      break;
    case 'wp:comment_type':
      curWpComment.wp_comment_type =
          curWpComment.wp_comment_type || textOrCdata;
      break;
    case 'wp:comment_parent':
      curWpComment.wp_comment_parent =
          curWpComment.wp_comment_parent || parseInt(textOrCdata);
      break;
    case 'wp:comment_user_id':
      curWpComment.wp_comment_user_id =
          curWpComment.wp_comment_user_id || parseInt(textOrCdata);
      break;
    default:
      // Ignore.
  }
}


parser.onattribute = function (attr: { name: string, value: string }) {
};


let errors = false;

parser.onerror = function (error: any) {
  errors = true;
  console.error(`Error: ${error} [ToTyEPARSER]`);
};


parser.onend = function () {
};


export default function(fileText: string, ps: { verbose?: boolean }): [SiteData, boolean] {
  verbose = ps.verbose;
  parser.write(fileText).close();
  return [builder.getSite(), errors];
}


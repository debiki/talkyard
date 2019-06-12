/// <reference path="to-talkyard.d.ts" />

// look at:
// https://help.disqus.com/developer/comments-export
// https://gist.github.com/evert/3332e6cc73848aefe36fd9d0a30ac390
// https://gitlab.com/commento/commento/blob/master/api/domain_import_disqus.go


import * as _ from 'lodash';
import * as sax from 'sax';
import { dieIf, logMessage } from '../../tests/e2e/utils/log-and-die';

import { buildSite } from '../../tests/e2e/utils/site-builder';
import c from '../../tests/e2e/test-constants';
const strict = true; // set to false for html-mode
const parser = sax.parser(strict, {});


let verbose: boolean | undefined;
let errors = false;




interface DisqusThread {
  disqusThreadId?: string;
  link?: string;
  title?: string;
  createdAtIsoString?: string;
  author: DisqusAuthor;
  ipAddr?: string;
  isClosed?: boolean;
  isDeleted?: boolean;
  posts: DisqusPost[];
}


interface DisqusPost {
  disqusThreadId?: string;
  disqusPostId?: string;
  disqusParentPostId?: string;
  message?: string;
  createdAtIsoString?: string;
  author: DisqusAuthor;
  ipAddr?: string;
  isClosed?: boolean;
  isDeleted?: boolean;
  isSpam?: boolean;
}


interface DisqusAuthor {
  email?: string;
  name?: string;
  isAnonymous?: boolean;
  username?: string;
}

let depth = 0;
let numCategories = 0;
let curTagName: string;

let curCategory: any;
let curThread: DisqusThread;
let curPost: DisqusPost;

const threadsByDisqusId: { [id: string]: DisqusThread } = {};
const postsByDisqusId: { [id: string]: DisqusPost } = {};

const DisqusIdSuffix = ':dsq';


parser.onopentag = function (tag: SaxTag) {
  console.debug(`onopentag '${tag.name}': ${JSON.stringify(tag)}`);
  depth += 1;
  curTagName = tag.name;
  const anyDisqusId = tag.attributes['dsq:id'];
  let openedThing;

  switch (tag.name) {
    case 'disqus':
      // The document opening tag. Ignore.
      break;
    case 'category':
      if (depth > 2) return;
      openedThing = curCategory = {};
      ++numCategories;
      dieIf(numCategories > 1,
          "More than one Disqus category found — not upported. [ToTyE503MRTJ63]");
      break;
    case 'thread':
      if (curPost) {
        dieIf(depth !== 2 + 1, 'TyE305MBRDK5');
        curPost.disqusThreadId = anyDisqusId;
      }
      else {
        openedThing = curThread = {
          disqusThreadId: anyDisqusId,
          author: {},
          posts: <DisqusPost[]> [],
        };
      }
      break;
    case 'post':
      openedThing = curPost = {
        disqusPostId: anyDisqusId,
        author: {},
      };
      break;
    case 'parent':
      dieIf(!curPost, 'ToTyE205MBRKDG');
      dieIf(depth !== 2 + 1, 'TyE7MTK05RK');
      curPost.disqusParentPostId = anyDisqusId;
      break;
  }

  console.debug(`new thing: ${JSON.stringify(openedThing)}`);
};


parser.oncdata = handleText;
parser.ontext = handleText;


function handleText(textOrCdata: string) {
  console.debug(`handleText: "${textOrCdata}"`);
  if (curCategory)
    return;
  const postOrThread = curPost || curThread;
  const author: DisqusAuthor | undefined = postOrThread ? postOrThread.author : undefined;
  switch (curTagName) {
    case 'link':
      dieIf(!curThread, 'ToTyE20MKDK5');
      curThread.link = textOrCdata;
      break;
    case 'title':
      dieIf(!curThread, 'ToTyE20MK506MSRK5');
      curThread.title = (curThread.title || '') + textOrCdata;
      break;
    case 'message':
      dieIf(!curPost, 'ToTyE6AMBS20NS');
      curPost.message = (curPost.message || '') + textOrCdata;
      break;
    case 'createdAt':
      dieIf(!postOrThread, 'ToTyE5BSKW05');
      postOrThread.createdAtIsoString = textOrCdata;
      break;
    case 'ipAddress':
      dieIf(!postOrThread, 'ToTyE5BMR0256');
      postOrThread.ipAddr = textOrCdata;
      break;
    case 'email':
      dieIf(!author, 'ToTyE7DMRNJ20');
      author.email = textOrCdata;
      break;
    case 'name':
      dieIf(!author, 'ToTyE5BMRGW02');
      author.name = textOrCdata;
      break;
    case 'username':
      dieIf(!author, 'ToTyE8PMD026Q');
      author.username = textOrCdata;
      break;
    case 'isAnonymous':
      dieIf(!author, 'ToTyE5BFP20ZC');
      author.isAnonymous = textOrCdata === 'true';
      break;
    case 'isDeleted':
      dieIf(!postOrThread, 'ToTyE7MSSD4');
      postOrThread.isDeleted = textOrCdata === 'true';
      break;
    case 'isClosed':
      dieIf(!postOrThread, 'ToTyE4ABMF025');
      postOrThread.isClosed = textOrCdata === 'true';
      break;
    case 'isSpam':
      dieIf(!curPost, 'ToTyE5MSBWG03');
      curPost.isSpam = textOrCdata === 'true';
      break;
  }
}


parser.onclosetag = function (tagName: string) {
  depth -= 1;
  console.debug(`onclosetag: ${tagName}`);
  let closedThing;
  switch (tagName) {
    case 'category':
      // (No effect, if undefined already.)
      closedThing = curCategory;
      curCategory = undefined;
      break;
    case 'thread':
      if (curPost) return;
      dieIf(!curThread, 'ToTyE305MBRS');
      dieIf(!curThread.disqusThreadId, 'ToTyE5BM205');
      threadsByDisqusId[curThread.disqusThreadId] = curThread;
      closedThing = curThread;
      curThread = undefined;
      break;
    case 'post':
      dieIf(!curPost, 'ToTyE607MASK53');
      const threadId = curPost.disqusThreadId;
      dieIf(!threadId, 'ToTyE2AMJ037R');
      const thread = threadsByDisqusId[threadId];
      dieIf(!thread,
          `Thread ${threadId} for post ${curPost.disqusPostId} missing [ToTyE0MJHF56]`);
      thread.posts.push(curPost);
      closedThing = curPost;
      curPost = undefined;
      break;
    default:
      // Ignore.
  }
  curTagName = undefined;

  logMessage(`Closed '${tagName}': ${JSON.stringify(closedThing)}`);
};


parser.onerror = function (error: any) {
  errors = true;
};


parser.onend = function () {
};


function buildTalkyardSite(threadsByDisqusId: { [id: string]: DisqusThread }): SiteData {
  const tySiteData: SiteData = {
    guests: [],
    pages: [],
    pagePaths: [],
    posts: [],
  };

  // Even if the Disqus user has a real username account, we'll insert
  // it into Talkyard as a guest. Too complicated to find out if
  // hens email has been verified and if someone who logs in to Talkyard
  // with the same email is indeed the same person or not.
  const guestsByKey: { [guestKey: string]: GuestToAdd } = {};

  const builder = buildSite(tySiteData);

  Object.keys(threadsByDisqusId).forEach(threadDisqusId => {

    // ----- Page

    const thread: DisqusThread = threadsByDisqusId[threadDisqusId];
    const pageCreatedAtMs = Date.parse(thread.createdAtIsoString);
    const tyPage: PageToAdd = {
      dbgSrc: 'ToTy',
      id: '?',
      altIds: [thread.link],
      extImpId: threadDisqusId + DisqusIdSuffix,
      folder: '/',
      showId: true,
      slug: 'imported-from-disqus',
      role: c.TestPageRole.Discussion,
      title: "Comments for " + thread.title,
      body: "Comments for " + thread.link,
      categoryId: c.DefaultDefaultCategoryId,
      authorId: c.SystemUserId,
    };

    // ----- Title and body

    // Disqus doesn't include any title or body post in the xml dump, so here we
    // generate our own title and body post:

    const tyTitle: NewTestPost = {
      extPageId: tyPage.extImpId,
      nr: c.TitleNr,
      extImpId: threadDisqusId + ':title' + DisqusIdSuffix,
      authorId: c.SystemUserId,
      approvedSource: tyPage.title,
      postedFromIp: '127.0.0.1',
      postedAtMs: pageCreatedAtMs,
      isApproved: true,
    };

    const tyBody: NewTestPost = {
      extPageId: tyPage.extImpId,
      nr: c.BodyNr,
      extImpId: threadDisqusId + ':body' + DisqusIdSuffix,
      authorId: c.SystemUserId,
      approvedSource: tyPage.title,
      postedFromIp: '127.0.0.1',
      postedAtMs: pageCreatedAtMs,
      isApproved: true,
    };

    // ----- Comments and authors

    const tyComments: NewTestPost[] = thread.posts.map((post: DisqusPost) => {
      const disqParentId = post.disqusParentPostId;
      const parentPost = postsByDisqusId[post.disqusParentPostId];
      const postCreatedAtMs = Date.parse(post.createdAtIsoString);
  
      if (post.disqusParentPostId) {
        dieIf(!parentPost,
          `Cannot find parent post w Diqus id '${disqParentId}' in all posts ToTyE2KS70W`);
        const parentAgain = thread.posts.find(p => p.disqusPostId === post.disqusParentPostId);
        dieIf(!parentAgain,
          `Cannot find parent post w Diqus id '${disqParentId}' in thread ToTyE50MRXV2`);
      }

      const author = post.author;
      // Same email, name and URL means it's most likely the same person.
      const authorKey = author.username ||
          `${author.email || ''}|${author.name || ''}|${author.isAnonymous || ''}`;
      const duplGuest = guestsByKey[authorKey];

      const guest: GuestToAdd = {
        extImpId: authorKey + DisqusIdSuffix,
        fullName: author.name,
        email: author.email,
        postedFromIp: post.ipAddr,
        // Use the earliest known post date, as the user's created-at date.
        createdAtMs: Math.min(duplGuest.createdAtMs || Infinity, postCreatedAtMs)
      };

      guestsByKey[authorKey] = guest;

      const tyPost: NewTestPost = {
        extPageId: post.disqusThreadId + DisqusIdSuffix,
        nr: c.FirstReplyNr, // ignored
        parentNr: undefined, // ignored
        extImpId: post.disqusPostId + DisqusIdSuffix,
        parentExtImpId: post.disqusParentPostId + DisqusIdSuffix,
        authorId: c.SystemUserId,  // for now
        approvedSource: '', // ??wpComment.wp_comment_content,
        postedFromIp: post.ipAddr,
        postedAtMs: postCreatedAtMs,
        isApproved: !post.isSpam,
        isDeleted: post.isDeleted,
        isSpam: !post.isSpam,
      };

      return tyPost;
    });

    // ----- Add to site

    builder.addPage(tyPage);
    builder.addPosts(tyComments);
  });

  builder.addGuests(_.values(guestsByKey));
}


export default function(fileText: string, ps: { verbose?: boolean }): [SiteData, boolean] {
  verbose = ps.verbose;
  parser.write(fileText).close();
  const site = buildTalkyardSite(threadsByDisqusId);
  return [site, errors];
}


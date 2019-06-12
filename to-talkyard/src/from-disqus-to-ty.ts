/// <reference path="to-talkyard.d.ts" />

// look at:
// https://help.disqus.com/developer/comments-export
// https://gist.github.com/evert/3332e6cc73848aefe36fd9d0a30ac390
// https://gitlab.com/commento/commento/blob/master/api/domain_import_disqus.go


import * as _ from 'lodash';
import * as sax from 'sax';
import { dieIf, logMessage } from '../../tests/e2e/utils/log-and-die';
import c from '../../tests/e2e/test-constants';

const strict = true; // set to false for html-mode
const parser = sax.parser(strict, {});


let verbose: boolean | undefined;
let errors = false;


/**
 * I think this is for "advanced" bloggers who split their blog comments in
 * different blog topic categories.
 */
interface DisqusCategory {
}


/**
 * There's one Disqus thread per blog posts. Each Disqus comment is in one thread.
 */
interface DisqusThread {
  disqusThreadId?: string;
  link?: string;
  title?: string;
  createdAtIsoString?: string;
  author: DisqusAuthor;
  ipAddr?: string;
  isClosed?: boolean;
  isDeleted?: boolean;
  posts: DisqusComment[];
  // category:  Skip. Mirroring Disqus comments categories to Talkyard seems
  // complicated and no one has asked for that.
  // message: Skip. Seems to be always empty.
}


interface DisqusComment {
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

let curCategory: DisqusCategory;
let curThread: DisqusThread;
let curPost: DisqusComment;

const threadsByDisqusId: { [id: string]: DisqusThread } = {};
const commentsByDisqusId: { [id: string]: DisqusComment } = {};

const DisqusIdSuffix = ':dsq';


parser.onopentag = function (tag: SaxTag) {
  console.debug(`onopentag '${tag.name}': ${JSON.stringify(tag)}`);
  depth += 1;
  curTagName = tag.name;
  const anyDisqusId = tag.attributes['dsq:id'];
  let openedThing: DisqusCategory | DisqusThread | DisqusComment;

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
        dieIf(depth !== 2 + 1, 'ToTyE305MBRDK5');
        curPost.disqusThreadId = anyDisqusId;
      }
      else {
        openedThing = curThread = {
          disqusThreadId: anyDisqusId,
          author: {},
          posts: <DisqusComment[]> [],
        };
      }
      break;
    case 'post':
      dieIf(!!curThread, 'ToTyE502MBKRG6');
      openedThing = curPost = {
        disqusPostId: anyDisqusId,
        author: {},
      };
      break;
    case 'parent':
      dieIf(!curPost, 'ToTyE205MBRKDG');
      dieIf(depth !== 2 + 1, 'ToTyE7MTK05RK');
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
      if (curPost) {
        // This tag tells to which already-creted-thread a post belongs
        // — we shouldn't try to create a new thread here.
        // Example:
        //   <post dsq:id="...">
        //     ...
        //     <thread dsq:id="..." />
        //   </post>
        return;
      }
      dieIf(!curThread, 'ToTyE305MBRS');
      dieIf(!curThread.disqusThreadId, 'ToTyE5BM205');
      threadsByDisqusId[curThread.disqusThreadId] = curThread;
      closedThing = curThread;
      curThread = undefined;
      break;
    case 'post':
      dieIf(!!curThread, 'ToTyE5RD0266');
      dieIf(!curPost, 'ToTyE607MASK53');
      const threadId = curPost.disqusThreadId;
      dieIf(!threadId, 'ToTyE2AMJ037R');
      const thread = threadsByDisqusId[threadId];
      dieIf(!thread,
          `Thread ${threadId} for post ${curPost.disqusPostId} missing [ToTyE0MJHF56]`);
      thread.posts.push(curPost);
      commentsByDisqusId[curPost.disqusPostId] = curPost;
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


function buildTalkyardSite(threadsByDisqusId: { [id: string]: DisqusThread }): any {
  let nextPageId  =  c.LowestExtImpId;
  let nextPostId  =  c.LowestExtImpId;
  let nextGuestId = -c.LowestExtImpId;
  const categoryImpId = c.LowestExtImpId;

  const tySiteData: any = {
    groups: [],
    members: [],
    guests: [],
    pages: [],
    pagePaths: [],
    pageIdsByAltIds: {},
    posts: [],
    categories: [],
    permsOnPages: [],
  };

  // Even if the Disqus user has a real username account, we'll insert
  // it into Talkyard as a guest. Too complicated to find out if
  // hens email has been verified and if someone who logs in to Talkyard
  // with the same email is indeed the same person or not.
  const guestsByImpId: { [guestImpId: string]: GuestDumpV0 } = {};

  Object.keys(threadsByDisqusId).forEach(threadDisqusId => {


    // ----- Page

    const pageId: PageId = '' + nextPageId;
    nextPageId += 1;

    const thread: DisqusThread = threadsByDisqusId[threadDisqusId];
    const pageCreatedAt: WhenMs = Date.parse(thread.createdAtIsoString);
    const urlInclOrigin = thread.link;
    const urlPath = urlInclOrigin.replace(/https?:\/\/[^/]+\//, '/')  // dupl [305MBKR52]
        .replace(/[#?].*$/, '');

    const tyPage: PageDumpV0 = {
      dbgSrc: 'ToTy',
      id: pageId,
      extImpId: threadDisqusId + DisqusIdSuffix,
      pageType: c.TestPageRole.EmbeddedComments,
      version: 1,
      createdAt: pageCreatedAt,
      updatedAt: pageCreatedAt,
      publishedAt: pageCreatedAt,
      categoryId: categoryImpId,
      embeddingPageUrl: thread.link,
      authorId: c.SystemUserId,
    };

    const tyPagePath: PagePathDumpV0 = {
      folder: '/',
      pageId: tyPage.id,
      showId: true,
      slug: 'imported-from-disqus',
      canonical: true,
    };


    // ----- Title and body  [307K740]

    // Disqus doesn't have any title or body post, so we generate our own
    // title and body post.

    const tyTitle: PostDumpV0 = {
      id: nextPostId,
      extImpId: threadDisqusId + ':title' + DisqusIdSuffix,
      pageId: tyPage.id,
      nr: c.TitleNr,
      postType: PostType.Normal,
      createdAt: pageCreatedAt,
      createdById: c.SystemUserId,
      currRevById: c.SystemUserId,
      currRevStartedAt: pageCreatedAt,
      currRevNr: 1,
      approvedSource: "Comments for " + thread.title,
      approvedAt: pageCreatedAt,
      approvedById: c.SystemUserId,
      approvedRevNr: 1,
    };

    nextPostId += 1;

    const tyBody: PostDumpV0 = {
      id: nextPostId,
      extImpId: threadDisqusId + ':body' + DisqusIdSuffix,
      pageId: tyPage.id,
      nr: c.BodyNr,
      postType: PostType.Normal,
      createdAt: pageCreatedAt,
      createdById: c.SystemUserId,
      currRevById: c.SystemUserId,
      currRevStartedAt: pageCreatedAt,
      currRevNr: 1,
      approvedSource: `Comments for <a href="${thread.link}">${thread.link}</a>`,
      approvedAt: pageCreatedAt,
      approvedById: c.SystemUserId,
      approvedRevNr: 1,
    };

    nextPostId += 1;


    // ----- Comments and authors

    let nextPostNr = c.LowestExtImpId;
    const tyComments: PostDumpV0[] = [];

    thread.posts.forEach((post: DisqusComment) => {
      const disqParentId = post.disqusParentPostId;
      const parentPost = commentsByDisqusId[post.disqusParentPostId];
      const postCreatedAt = Date.parse(post.createdAtIsoString);

      if (post.disqusParentPostId) {
        dieIf(!parentPost,
          `Cannot find parent post w Diqus id '${disqParentId}' in all posts ToTyE2KS70W`);
        const parentAgain = thread.posts.find(p => p.disqusPostId === post.disqusParentPostId);
        dieIf(!parentAgain,
          `Cannot find parent post w Diqus id '${disqParentId}' in thread ToTyE50MRXV2`);
      }

      const disqusAuthor = post.author;

      // Same email, name and URL means it's most likely the same person.
      const guestExtImpId = (
          disqusAuthor.username ||
          `${disqusAuthor.email || ''}|${disqusAuthor.name || ''}|${disqusAuthor.isAnonymous || ''}`)
              + DisqusIdSuffix;

      const anyDuplGuest = guestsByImpId[guestExtImpId];
      const anyDuplGuestCreatedAt = anyDuplGuest ? anyDuplGuest.createdAt : undefined;

      const thisGuestId = anyDuplGuest ? anyDuplGuest.id : nextGuestId;

      if (thisGuestId === nextGuestId) {
        // (Guest ids are < 0 so decrement the ids.)
        nextGuestId -= 1;
      }

      const guest: GuestDumpV0 = {
        id: thisGuestId,
        extImpId: guestExtImpId,  // TODO delete, if deleting user — contains name
        // Use the earliest known post date, as the user's created-at date.
        createdAt: Math.min(anyDuplGuestCreatedAt || Infinity, postCreatedAt),
        fullName: disqusAuthor.name,
        emailAddress: disqusAuthor.email,
        //postedFromIp: post.ipAddr
      };

      guestsByImpId[guestExtImpId] = guest;

      const tyPost: PostDumpV0 = {
        id: nextPostId,
        extImpId: post.disqusPostId + DisqusIdSuffix,
        pageId: tyPage.id,
        nr: nextPostNr,
        parentNr: undefined, // updated below
        postType: PostType.Normal,
        createdAt: postCreatedAt,
        createdById: guest.id,
        currRevById: guest.id,
        currRevStartedAt: postCreatedAt,
        currRevNr: 1,
        approvedSource: post.message,
        approvedAt: postCreatedAt,
        approvedById: c.SystemUserId,
        approvedRevNr: 1,
      };

      // We need to incl also deleted comments, because people might have replied
      // to them before they got deleted, so they are needed in the replies tree structure.
      if (post.isDeleted || post.isSpam) {
        tyPost.deletedAt = postCreatedAt; // date unknown
        tyPost.deletedById = c.SystemUserId;
        tyPost.deletedStatus = DeletedStatus.SelfBit;  // but not SuccessorsBit
        // Skip this; a db constraint [40HKTPJ] wants either approved source, or a source patch,
        // and it's compliated to construct a patch?
        //if (post.isSpam) {
        //  delete tyPost.approvedSource;
        //  delete tyPost.approvedAt;
        //  delete tyPost.approvedById;
        //  delete tyPost.approvedRevNr;
        //}
      }

      nextPostId += 1;
      nextPostNr += 1;

      tyComments.push(tyPost);
    });


    // ----- Fill in parent post nrs

    tyComments.forEach(tyComment => {
      const disqusId: string = tyComment.extImpId.slice(0, -DisqusIdSuffix.length);
      const disqusComment: DisqusComment = commentsByDisqusId[disqusId];
      dieIf(!disqusComment, 'ToTyE305DMRTK6');
      const disqusParentId = disqusComment.disqusParentPostId;
      if (disqusParentId) {
        const disqusParent = commentsByDisqusId[disqusParentId];
        dieIf(!disqusParent,
            `Parent Disqus comment not found, Disqus id: '${disqusParentId}' ` +
            `[ToTyEDSQ0DSQPRNT]`);
        const parentExtImpId = disqusParentId + DisqusIdSuffix;
        const tyParent = tyComments.find(c => c.extImpId === parentExtImpId);
        dieIf(!tyParent,
            `Parent of Talkyard post nr ${tyComment.nr} w Disqus id '${disqusId}' not found, ` +
            `parent's ext imp id: '${parentExtImpId}' ` +
            '[ToTyEDSQ0PRNT]');
        tyComment.parentNr = tyParent.nr;
      }
    });


    // ----- Add to site

    tySiteData.pages.push(tyPage);
    tySiteData.pagePaths.push(tyPagePath);
    tySiteData.pageIdsByAltIds[urlInclOrigin] = tyPage.id;
    tySiteData.pageIdsByAltIds[urlPath] = tyPage.id;
    tySiteData.posts.push(tyTitle);
    tySiteData.posts.push(tyBody);
    tyComments.forEach(c => tySiteData.posts.push(c));

    // A dummy category that maps the category import id to [the category
    // in the database with ext id 'embedded_comments'].
    tySiteData.categories.push({
      id: categoryImpId,
      extId: 'embedded_comments',
    });
  });

  _.values(guestsByImpId).forEach(g => tySiteData.guests.push(g));

  return tySiteData;
}


export default function(fileText: string, ps: { verbose?: boolean }): [SiteData, boolean] {
  verbose = ps.verbose;
  parser.write(fileText).close();
  const site = buildTalkyardSite(threadsByDisqusId);
  return [site, errors];
}


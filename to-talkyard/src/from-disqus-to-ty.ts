/// <reference path="to-talkyard.d.ts" />

// Docs about the Disqus comments export XML file:
// https://help.disqus.com/developer/comments-export


import * as _ from 'lodash';
import * as sax from 'sax';
import { die, dieIf, logMessage } from '../../tests/e2e/utils/log-and-die';
import c from '../../tests/e2e/test-constants';
import { URL } from 'url';


/**
 * Categories are for "advanced" bloggers who split their blog comments in
 * different blog topic categories? Skip for now. Maybe some time later,
 * can auto-upsert Disqus categories into Talkyard categories?
 */
interface DisqusCategory {
}


/**
 * There's one Disqus thread per blog post. Each Disqus comment is in one thread.
 * <thread dsq:id="...">....</thread>
 *
 * Currently ignored:
 * <forum>(string)     — all comments need to be from the same Disqus "forum",
 * <category dsq:id="..."/>   — ... and from the same Disqus category, for now.
 * <id>
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
  comments: DisqusComment[];
  message?: string;
  // category:  Skip (205AKS5). Mirroring Disqus comments categories to Talkyard seems
  // complicated and no one has asked for that.
}


/**
 * A Disqus comment, represented by a <post> in the Disqus xml.
 *
 * There's a Disqus <id> elem, e.g. <id>wp_id=123</id>, however it's usually
 * empty: <id />. I suppose it's defined only if the comment was imported from
 * WordPress to Disqus, or whatever-else from Disqus, and that Disqus
 * uses it to avoid duplicating comments if importing the same things many times?
 * Just like Talkyard uses extId:s for this.
 *
 * Looking at https://help.disqus.com/en/articles/1717164-comments-export,
 * <parent> can reference <id>. However, in practice, when exporting
 * a Disqus xml dump, <parent> is instead always like: <parent dsq:id="..." />,
 * that is, references the parent comment via dsq:id, not <id>.
 * So, Talkyard looks at the dsq:id attributes but not any contents
 * of <id> or <parent>.
 */
interface DisqusComment {
  // <thread dsq:id="...">
  disqusThreadId?: string;
  // The dsq:id="..." attribute on the <post> itself.
  disqusCommentId?: string;
  // <parent dsq:id="...">
  disqusParentCommentId?: string;
  message?: string;
  createdAtIsoString?: string;
  // Weird: In Disqus XSD, this author elem isn't required. But with no comment
  // author, then, who posted the comment? Seems in practice it's always
  // present though. The XSD: http://disqus.com/api/schemas/1.0/disqus.xsd
  author: DisqusAuthor;
  ipAddr?: string;
  isClosed?: boolean;
  isDeleted?: boolean;
  isSpam?: boolean;

  // Talkyard currently ignores these three. They're in the XSD though.
  // -------------------
  // What's this for? Maybe if a comment got incorrectly flagged as spam,
  // but the blog author reclassified (approved) it as not spam?
  isApproved?: boolean;
  isFlagged?: boolean;
  // What's this? I can only guess.
  isHighlighted?: boolean;
  // -------------------
}


/**
 * <author> in the Disqus xml.
 */
interface DisqusAuthor {
  email?: string;
  name?: string;
  isAnonymous?: boolean;
  username?: string;
  // Talkyard currently ignores this field. It's in the XSD though.
  link?: string; // an URI
}



let depth = 0;
let numCategories = 0;
let curTagName: string;

let curCategory: DisqusCategory;
let curThread: DisqusThread;
let curComment: DisqusComment;

const threadsByDisqusId: { [id: string]: DisqusThread } = {};
const commentsByDisqusId: { [id: string]: DisqusComment } = {};

const DisqusThreadSuffix = ':thr';
const DisqusTitleSuffix = ':ttl';
const DisqusBodySuffix = ':bdy';
const DisqusCommentSuffix = ':cmt';
const DisqusAuthorSuffix = ':ath';
const DisqusExtIdSuffix = ':dsq';


let verbose: boolean | undefined;
let primaryOrigin: string | undefined;
let errors = false;

const strict = true; // set to false for html-mode
const parser = sax.parser(strict, {});

function logVerbose(message: string) {
  if (!verbose) return;
  logMessage(message);
}


parser.onopentag = function (tag: SaxTag) {
  logVerbose(`onopentag '${tag.name}': ${JSON.stringify(tag)}`);
  if (!verbose) process.stdout.write('.');

  depth += 1;
  curTagName = tag.name;
  const anyDisqusId = tag.attributes['dsq:id'];
  let openedThing: DisqusCategory | DisqusThread | DisqusComment;

  switch (tag.name) {
    case 'disqus':
      // The document opening tag. Ignore.
      break;
    case 'category':
      if (depth > 2) {
        // We're in a <thread> or <post>. Since multiple categories isn't supported
        // right now (205AKS5), the category is always the same, so just ignore it.
        return;
      }
      openedThing = curCategory = {};
      ++numCategories;
      dieIf(numCategories > 1,  // (205AKS5)
          "More than one Disqus category found — not supported. [ToTyE503MRTJ63]");
      break;
    case 'thread':
      dieIf(!!curThread, 'ToTyE5W8T205TF');
      if (curComment) {
        // We should be in a <disqus><post><thread>, i.e. depth 3.
        dieIf(depth !== 3, 'ToTyE305MBRDK5');
        curComment.disqusThreadId = anyDisqusId;
      }
      else {
        // We should be in a <disqus><thread>, depth 2.
        dieIf(depth !== 2, 'ToTyE6301WKTS4');
        openedThing = curThread = {
          disqusThreadId: anyDisqusId,
          author: {},
          comments: <DisqusComment[]> [],
        };
      }
      break;
    case 'post':
      // We should now be in a <disqus><post>, i.e. depth 2.
      dieIf(depth !== 2, 'ToTyE6AKST204A');
      dieIf(!!curComment, 'ToTyE7KRTRART24');
      dieIf(!!curThread, 'ToTyE502MBKRG6');
      openedThing = curComment = {
        disqusCommentId: anyDisqusId,
        author: {},
      };
      break;
    case 'parent':
      // We should be in a <disqus><post><parent>, i.e. depth 3.
      dieIf(depth !== 3, 'ToTyE7MTK05RK');
      dieIf(!!curThread, 'ToTyE8AGPSR2K0');
      dieIf(!curComment, 'ToTyE205MBRKDG');
      curComment.disqusParentCommentId = anyDisqusId;
      break;
  }

  logVerbose(`new thing: ${JSON.stringify(openedThing)}`);
};


parser.oncdata = handleText;
parser.ontext = handleText;


function handleText(textOrCdata: string) {
  logVerbose(`handleText: "${textOrCdata}"`);
  if (curCategory)
    return;
  const postOrThread = curComment || curThread;
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
      dieIf(!postOrThread, 'ToTyE6AMBS20NS');
      postOrThread.message = (postOrThread.message || '') + textOrCdata;
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
      dieIf(!curComment, 'ToTyE5MSBWG03');
      curComment.isSpam = textOrCdata === 'true';
      break;
    case 'isApproved':
      dieIf(!curComment, 'ToTyE8FKRCF31');
      curComment.isApproved = textOrCdata === 'true';
      break;
    case 'isFlagged':
      dieIf(!curComment, 'ToTyE2AKRP34U');
      curComment.isFlagged = textOrCdata === 'true';
      break;
    case 'isHighlighted':
      dieIf(!curComment, 'ToTyE9RKP2XZ');
      curComment.isHighlighted = textOrCdata === 'true';
      break;
  }
}


parser.onclosetag = function (tagName: string) {
  depth -= 1;
  logVerbose(`onclosetag: ${tagName}`);
  let closedThing;
  switch (tagName) {
    case 'category':
      // (No effect, if undefined already.)
      closedThing = curCategory;
      curCategory = undefined;
      break;
    case 'thread':
      if (curComment) {
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
      dieIf(!curComment, 'ToTyE607MASK53');
      const threadId = curComment.disqusThreadId;
      dieIf(!threadId, 'ToTyE2AMJ037R');
      const thread = threadsByDisqusId[threadId];
      dieIf(!thread,
          `Thread ${threadId} for post ${curComment.disqusCommentId} missing [ToTyE0MJHF56]`);
      thread.comments.push(curComment);
      commentsByDisqusId[curComment.disqusCommentId] = curComment;
      closedThing = curComment;
      curComment = undefined;
      break;
    default:
      // Ignore.
  }
  curTagName = undefined;

  logVerbose(`Closed '${tagName}': ${JSON.stringify(closedThing)}`);
};


parser.onerror = function (error: any) {
  errors = true;
};


parser.onend = function () {
};


function buildTalkyardSite(threadsByDisqusId: { [id: string]: DisqusThread }): any {
  let nextPageId  =  c.LowestTempImpId;
  let nextPostId  =  c.LowestTempImpId;
  let nextGuestId = -c.LowestTempImpId;
  const categoryImpId = c.LowestTempImpId;

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
    const thread: DisqusThread = threadsByDisqusId[threadDisqusId];

    // Disqus creates threads also for blog posts with no comments; don't import those.
    // Instead, let Talkyard lazy-creates pages when needed.
    if (!thread.comments.length)
      return;


    // ----- Page

    // Create a Talkyard EmbeddedComments discussion page for this Disqus
    // thread, i.e. blog post with comments.

    const pageId: PageId = '' + nextPageId;
    nextPageId += 1;

    const pageCreatedAt: WhenMs = Date.parse(thread.createdAtIsoString);
    const urlInclOrigin = thread.link;
    const urlObj = new URL(urlInclOrigin);
    const urlPath = urlObj.pathname;

    // Old, so complicated:
    // The url might be just an origin: https://ex.co, with no trailing slash '/'.
    // urlInclOrigin.replace(/https?:\/\/[^/?&#]+\/?/, '/')  // dupl [305MBKR52]
    //   .replace(/[#?].*$/, '');

    const tyPage: PageDumpV0 = {
      dbgSrc: 'ToTy',
      id: pageId,
      extImpId: threadDisqusId + DisqusThreadSuffix + DisqusExtIdSuffix,
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
      extImpId: threadDisqusId + DisqusThreadSuffix + DisqusTitleSuffix + DisqusExtIdSuffix,
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
      ...tyTitle,
      id: nextPostId,
      extImpId: threadDisqusId + DisqusThreadSuffix + DisqusBodySuffix + DisqusExtIdSuffix,
      nr: c.BodyNr,
      approvedSource: `Comments for <a href="${thread.link}">${thread.link}</a>`,
    };

    nextPostId += 1;


    // ----- Comments and authors

    let nextPostNr = c.LowestTempImpId;
    const tyComments: PostDumpV0[] = [];

    thread.comments.forEach((comment: DisqusComment) => {
      const disqParentId = comment.disqusParentCommentId;
      if (disqParentId) {
        const parentComment = commentsByDisqusId[disqParentId];
        dieIf(!parentComment,
          `Cannot find parent comment w Diqus id '${disqParentId}' in all comments [ToTyE2KS70W]`);
        const parentAgain = thread.comments.find(p => p.disqusCommentId === disqParentId);
        dieIf(!parentAgain,
          `Cannot find parent comment w Diqus id '${disqParentId}' in thread [ToTyE50MRXV2]`);
      }

      const disqAuthor = comment.author;

      // Abort if username or email addr contains '|', can otherwise mess up the ext ids
      // and cause duplication (e.g. if a username has '|' in a way that makes it look
      // like:  email-address|is-anonymous|name, which could match a no-username user).
      dieIf(disqAuthor.username && disqAuthor.username.indexOf('|') >= 0,
        `Username contains '|': '${disqAuthor.username}' [ToTyE40WKSTG]`);
      dieIf(disqAuthor.email && disqAuthor.email.indexOf('|') >= 0,
        `Email contains '|': '${disqAuthor.email}' [ToTyE7KAT204ZS]`);
      dieIf(disqAuthor.name && disqAuthor.name.indexOf('|') >= 0,   // (259RT24)
        `Name contains '|': '${disqAuthor.name}' [ToTyE7KAT204Z7]`);

      function makeNoUsernameExtId() {
        // If the email and name are the same, let's assume it's the same person.
        // Ext ids can be any graphical characters (posix: [[:graph:]]), plus, spaces ' '
        // are allowed inside an id, so, using the Disqus comment author names as part
        // of the id, is fine. See db fn  is_valid_ext_id()   [05970KF5].
        return (
            (disqAuthor.email || '')            + '|' +
            (disqAuthor.isAnonymous ? 'a' : '') + '|' +
            (disqAuthor.name || ''));  // maybe later, can contain '|' ?  So place last.
      }                                // but right now, cannot (259RT24)

      const guestExtId =
          (disqAuthor.username || makeNoUsernameExtId()) +
          DisqusAuthorSuffix + DisqusExtIdSuffix;
      const anyDuplGuest = guestsByImpId[guestExtId];
      const anyDuplGuestCreatedAt = anyDuplGuest ? anyDuplGuest.createdAt : undefined;

      const thisGuestId = anyDuplGuest ? anyDuplGuest.id : nextGuestId;

      if (thisGuestId === nextGuestId) {
        // (Guest ids are < 0 so decrement the ids.)
        nextGuestId -= 1;
      }

      const commentCreatedAt = Date.parse(comment.createdAtIsoString);

      const guest: GuestDumpV0 = {
        id: thisGuestId,
        extImpId: guestExtId,  // PRIVACY SHOULD GDPR delete, if deleting user — contains name [03KRP5N2]
        // Use the earliest known post date, as the user's created-at date.
        createdAt: Math.min(anyDuplGuestCreatedAt || Infinity, commentCreatedAt),
        fullName: disqAuthor.name,
        emailAddress: disqAuthor.email,
        // guestBrowserId — there is no such thing in the Disqus xml dump. [494AYDNR]
        //postedFromIp: post.ipAddr
      };

      // If the guest has a username, and has changed hens name or email,
      // this might also change the name or email.
      // COULD remember the most recent email addr and name use that?
      guestsByImpId[guestExtId] = guest;

      const tyPost: PostDumpV0 = {
        id: nextPostId,
        extImpId: comment.disqusCommentId + DisqusCommentSuffix + DisqusExtIdSuffix,
        pageId: tyPage.id,
        nr: nextPostNr,
        parentNr: undefined, // updated below
        postType: PostType.Normal,
        createdAt: commentCreatedAt,
        createdById: guest.id,
        currRevById: guest.id,
        currRevStartedAt: commentCreatedAt,
        currRevNr: 1,
        approvedSource: comment.message,
        approvedAt: commentCreatedAt,
        approvedById: c.SystemUserId,
        approvedRevNr: 1,
      };

      // We need to incl also deleted comments, because people might have replied
      // to them before they got deleted, so they are needed in the replies tree structure.
      if (comment.isDeleted || comment.isSpam) {
        tyPost.deletedAt = commentCreatedAt; // date unknown
        tyPost.deletedById = c.SystemUserId;
        tyPost.deletedStatus = DeletedStatus.SelfBit;  // but not SuccessorsBit
        // Skip this; a db constraint [40HKTPJ] wants either approved source, or a source patch,
        // and it's compliated to construct a patch from any approved source,
        // to the current source?
        //if (comment.isSpam) {
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
      const suffixLength = DisqusCommentSuffix.length + DisqusExtIdSuffix.length;
      const disqusId: string = tyComment.extImpId.slice(0, - suffixLength);
      const disqusComment: DisqusComment = commentsByDisqusId[disqusId];
      dieIf(!disqusComment, 'ToTyE305DMRTK6');
      const disqusParentId = disqusComment.disqusParentCommentId;
      if (disqusParentId) {
        const disqusParent = commentsByDisqusId[disqusParentId];
        dieIf(!disqusParent,
            `Parent Disqus comment not found, Disqus id: '${disqusParentId}' ` +
            `[ToTyEDSQ0DSQPRNT]`);
        const parentExtId = disqusParentId + DisqusCommentSuffix + DisqusExtIdSuffix;
        const tyParent = tyComments.find(c => c.extImpId === parentExtId);
        dieIf(!tyParent,
            `Parent of Talkyard post nr ${tyComment.nr} w Disqus id '${disqusId}' not found, ` +
            `parent's ext id: '${parentExtId}' ` +
            '[ToTyEDSQ0PRNT]');
        tyComment.parentNr = tyParent.nr;
      }
    });


    // ----- Add to site

    logVerbose(`Adding discussion at: '${urlInclOrigin}', url path '${urlPath}', ` +
        `with ${thread.comments.length} comments, ` +
        `to Talkyard page with temp imp id ${tyPage.id} ...`);
    if (!verbose)
      process.stdout.write('.');

    tySiteData.pages.push(tyPage);
    tySiteData.pagePaths.push(tyPagePath);

    // This cannot happen? Disqus never maps the same full URL to different threads.
    const duplPageIdByUrlInclOrig = tySiteData.pageIdsByAltIds[urlInclOrigin];
    dieIf(duplPageIdByUrlInclOrig,
        `Full URL ${urlInclOrigin} maps to both tyPage.id ${duplPageIdByUrlInclOrig} ` +
        `and ${tyPage.id} [ToTyEDUPLURL]`);

    tySiteData.pageIdsByAltIds[urlInclOrigin] = tyPage.id;

    // This happens though, if a Disqus export file has comments for blog two posts
    // on different domains, but with the same url path. Then, typically,
    // it's the same blog, just that it's been hosted on differet domains, and
    // people posted comments on the first domain, creating a Disqus thread there,
    // and then on the 2nd domain, creating a duplicated thread for the in fact
    // same blog post, there.
    // For now, if this happens let's require the human to choose one of
    // the dommains, via --primaryOrigin. Later, maybe there could be advanced
    // params to merge the different (duplicated?) discussions together to
    // one single discussion (so no comments are lost).
    const duplPageIdByUrlPath = tySiteData.pageIdsByAltIds[urlPath];
    let skipPath = false;
    if (duplPageIdByUrlPath) {
      if (primaryOrigin) {
        skipPath = !urlInclOrigin.startsWith(primaryOrigin + '/') &&
            urlInclOrigin != primaryOrigin;
      }
      else {
        const otherSimilarUrls = _.filter(
            _.keys(tySiteData.pageIdsByAltIds), url => {
              if (!url.startsWith('http:') && !url.startsWith('https:'))
                return false;
              if (url === urlInclOrigin)
                return false;
              const urlObj = new URL(url);
              return urlObj.pathname === urlPath;
            });
        // TESTS_MISSING
        die(`URL path '${urlPath}' maps to both tyPage.id ${duplPageIdByUrlPath} ` +
            `and ${tyPage.id}. Your Disqus XML file includes blog posts ` +
            `from different domains, but with the same URL path? ` +
            `I'm looking at this URL: '${urlInclOrigin}', ` +
            `and previous similar urls I've seen are: ${JSON.stringify(otherSimilarUrls)} —` +
            `note that they end with the same URL path. ` +
            `To solve this, add --primaryOrigin https://one.of.your.blog.addresses, ` +
            `to the command line options, and then I'll use the Disqus comments ` +
            `from that origin, whenever the same URL path maps to ` +
            `different discussions from different domains. [ToTyEDUPLPATH]`);
      }
    }
    if (!skipPath) {
      tySiteData.pageIdsByAltIds[urlPath] = tyPage.id;
    }

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


export default function(fileText: string,
      ps: { verbose?: boolean, primaryOrigin?: string }): [SiteData, boolean] {
  verbose = ps.verbose;
  primaryOrigin = ps.primaryOrigin;
  console.log("Parsing ...");
  parser.write(fileText).close(); // this updates threadsByDisqusId
  console.log("\nDone parsing. Converting to Talkyard JSON ...");
  const site = buildTalkyardSite(threadsByDisqusId);
  console.log("\nDone converting to Talkyard.");
  return [site, errors];
}


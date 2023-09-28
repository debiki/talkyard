/*
 * Copyright (C) 2014, 2017 Kaj Magnus Lindberg
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

/// <reference path="../ReactStore.ts" />

/**
 * Tracks which posts you've read, and also how long you've spent reading the page in total.
 * Every now and then, reports reading progress to the server, so it can remember
 * which posts you've read, and perhaps bump your trust level when you've spent enough
 * time reading.
 *
 * If reading the same page more than once, total-seconds-spent-reading-that-page increases
 * further, but posts already reported as read, won't be reported again.
 *
 * But won't clear notifications about assignees-changed or post-tagged — such changes
 * are harder to notice (also when looking at the page).  [0clr_asgd_tagd_notfs]
 */
//------------------------------------------------------------------------------
   namespace debiki2.page.PostsReadTracker {
//------------------------------------------------------------------------------

let debug = false;
// @ifdef DEBUG
debug = !!location.hash.match("debug=(t|true|all|trackReadingActivity)"); // [2FG6MJ9]
// @endif

export let debugIntervalHandler = null;

interface ReadState {
  postNr: number;
  mark?: number;
  charsRead?: number;
  hasBeenRead?: boolean;
  textLength?: number;
}


let readStatesByPostNr: { [postNr: number]: ReadState };
let postNrsVisibleLastTick: { [postNr: number]: boolean };
let pageId;
let postNrsJustRead: PostNr[];
let wentToTopAtMs: number;

// After having read one post, wait a short while before posting to the server, because usually
// the next few seonds, a bunch of more posts will also get considered read. Better then,
// to post them all at the same time. Also makes e2e tests run faster (not time out).
const AfterReadThenWaitMillis = 3000;

// Most people read 200 words per minute with a reading comprehension of 60%.
// 0.1% read 1 000 wpm with a comprehension of 85%.
// A speed reading test article was 3692 chars, 597 words (www.readingsoft.com)
// and a speed of 200 wpm means 3692 / 597.0 * 200 / 60 = 20.6 chars per second.
// So 40 chars per second is fast, = 400 wpm, but on the other hand people frequently don't
// read text online so very carefully (?) so might make sense. Anyway better err on the side of
// assuming people read too fast, than too slow, because never-marking-a-post-as-read although
// the user did read it, seems more annoying, than marking-as-read posts when the user has read
// parts-of-it or most-of-it-but-not-all.
const charsReadPerSecond = 40;
const contextSwitchCostChars = charsReadPerSecond * 0.5;

// People usually (?) don't read everything in a long comment, so mark a comment as read after
// some seconds.
const maxCharsReadPerPost = charsReadPerSecond * 5;

const secondsBetweenTicks = 1;
let secondsSpentReading = 0;
const secondsLostPerNewPostInViewport = 0.4;
const maxConfusionSeconds = 1.2;
const localStorageKey = 'debikiPostNrsReadByPageId';

const TooFewSeconds = 3;

// Report more frequently, if the browser cannot send a beacon before the page gets closed.
const ReportToServerIntervalSeconds: number =
  debug ? 10 : 30; // dupl constant, in Scala too [6AK2WX0G]

let storeChanged = true;

let lastUserId: number;
let lastScrolledAtMs: number;
let lastScrollLeft: number;
let lastScrollTop: number;
let lastReportedToServerAtMs: number;
let lastViewedPostNr: PostNr;
let currentlyViewingPostNr: PostNr;
let unreportedSecondsReading: number;
let unreportedPostsRead: Post[];
let firstUnreportedPostReadAtMs: number | undefined;
let maxSecondsSinceLastScroll: number;
let talksWithSererAlready: boolean;
let isOldPageWithRandomPostNrs: boolean;

export function reset() {
  readStatesByPostNr = {};
  postNrsVisibleLastTick = {};
  pageId = debiki2.ReactStore.getPageId();
  postNrsJustRead = [];
  wentToTopAtMs = undefined;

  lastScrolledAtMs = Date.now();
  lastScrollLeft = -1;
  lastScrollTop = -1;
  lastReportedToServerAtMs = Date.now();
  unreportedSecondsReading = 0;
  unreportedPostsRead = [];
  firstUnreportedPostReadAtMs = undefined;
  maxSecondsSinceLastScroll = 3 * 60;
  talksWithSererAlready = false;
  storeChanged = true;
}

let visibleUnreadPostsStats = [];
let postsVisibleThisTick: { [postNr: number]: boolean } = {};
let hadFocus = false;

export function start() {
  reset();
  debugIntervalHandler = setInterval(trackReadingActivity, secondsBetweenTicks * 1000);
  window.addEventListener('unload', sendAnyRemainingDataWithBeacon, false);
  ReactStore.addChangeListener(function() {
    storeChanged = true;
  });
}


export function getPostNrsAutoReadLongAgo(): number[] {
  if (!canUseLocalStorage())
    return [];

  let postNrsReadByPageId = getFromLocalStorage(localStorageKey) || {};
  return postNrsReadByPageId[pageId] || [];
}


// @ifdef DEBUG
function toNrs(posts: Post[]): PostNr[] {
  return posts.map(post => post.nr);
}
// @endif


function sendAnyRemainingDataWithBeacon(unloadEventIgnored) {
  sendAnyRemainingData(null);
}


export function sendAnyRemainingData(success: () => void | null) {
  let skip = false;
  if (talksWithSererAlready) {
    skip = true;
  }
  else if (!unreportedSecondsReading ||
      unreportedSecondsReading <= TooFewSeconds ||
      // It's undef, if haven't looked at the page for long enough. (5AKBR02)
      _.isUndefined(lastViewedPostNr)) {
    skip = true;
  }

  if (skip) {
    // @ifdef DEBUG
    if (debug) logD(
        `*Not* sending remaining post nrs read via beacon: ${toNrs(unreportedPostsRead)},` +
        ` ${unreportedSecondsReading} seconds reading, lastViewedPostNr: ${lastViewedPostNr}, ` +
        `talksWithSererAlready: ${talksWithSererAlready}`);
    // @endif
    return;
  }

  // @ifdef DEBUG
  const viaWhat = success === null ? "via beacon" : "via normal request";
  if (debug) logD(
      `Sending remaining posts nrs read ${viaWhat}: ${toNrs(unreportedPostsRead)}, ` +
      `${unreportedSecondsReading} seconds reading`);
  // @endif

  // Don't include any 'success' callback —> sendBeacon will get used.
  Server.trackReadingProgress(lastViewedPostNr, unreportedSecondsReading, unreportedPostsRead,
      success);
  lastReportedToServerAtMs = Date.now();

  // If navigating to new page, it'll reset everything.
}


function trackReadingActivity() {
  const store: Store = ReactStore.allData();
  const page: Page = store.currentPage;

  // Skip auto-pages, e.g. user profile pages and the admin area — they have zero posts.
  // (This'll also skip not-yet-created pages for embedded discussions.)
  if (!page.numPosts)
    return;

  const me: Myself = store.me;

  if (me.id !== lastUserId) {
    reset();
    lastUserId = me.id;
  }

  // Don't track guests. [8PLKW46]
  if (!user_isMember(me))
    return;

  // Back compat with old pages with random post nrs. Don't track readnig stats, because
  // post nrs are a lot larger than # posts —> the server says 'error'.
  if (_.isUndefined(isOldPageWithRandomPostNrs)) {
    // Large nrs = most likely random nrs, and 6 digits = large nrs.
    const apparentlyRandomNrs = _.keysIn(page.postsByNr).filter(nr => nr.length >= 6);
    isOldPageWithRandomPostNrs = !!apparentlyRandomNrs.length && _(page.postsByNr).size() < 10000;
  }
  if (isOldPageWithRandomPostNrs)
    return;

  // Don't remove posts read one tick ago until now, so they get time to fade away slowly.
  const hasReadMorePosts = postNrsJustRead.length;
  // @ifdef DEBUG
  !debug || !hasReadMorePosts || logD(`Marking as read: ${postNrsJustRead}`);
  // @endif
  _.each(postNrsJustRead, postNr => {
    debiki2.ReactActions.markPostAsRead(postNr, false);
  });
  postNrsJustRead = [];

  const nowMs = Date.now();

  let hasScrolled = false;
  const pageColumnElem = $byId('esPageColumn');
  const curScrollLeft = pageColumnElem.scrollLeft;
  const curScrollTop = pageColumnElem.scrollTop;

  if (lastScrollTop > 200 && curScrollTop <= 100) {
    wentToTopAtMs = nowMs;
  }
  if (wentToTopAtMs) {
    const secondsSinceWentToTop = (nowMs - wentToTopAtMs) / 1000;
    if (lastViewedPostNr > BodyNr && (curScrollTop > 100 || secondsSinceWentToTop >= 4)) {
      // The user scrolled to the top of the page, but then didn't click any top nav link.
      // Instead s/he scrolled down a bit, or stayed there quite long.
      // So apparently the user isn't interested in continuing reading at lastViewedPostNr.
      // @ifdef DEBUG
      !debug || logD(`Resetting lastViewedPostNr (was: ${lastViewedPostNr})`);
      // @endif
      lastViewedPostNr = BodyNr;
    }
  }

  if (lastScrollLeft != curScrollLeft || lastScrollTop != curScrollTop) {
    // @ifdef DEBUG
    !debug || logD(`Scroll detected, at ms: ${nowMs}`);
    // @endif
    lastScrollLeft = curScrollLeft;
    lastScrollTop = curScrollTop;
    lastScrolledAtMs = nowMs;
    hasScrolled = true;
  }

  const millisSinceLastScroll = nowMs - lastScrolledAtMs;
  if (millisSinceLastScroll > 2500) {
    // Now the user has been looking at that post for a while, so the next time we reopen
    // this page, focus that same post.
    // @ifdef DEBUG
    !debug || lastViewedPostNr === currentlyViewingPostNr ||
        logD(`Setting lastViewedPostNr to: ${currentlyViewingPostNr}`);
    // @endif
    lastViewedPostNr = currentlyViewingPostNr;
    wentToTopAtMs = undefined;
  }

  const hasStoppedReading = millisSinceLastScroll > maxSecondsSinceLastScroll * 1000;
  if (!hasStoppedReading) {
    unreportedSecondsReading += secondsBetweenTicks;
  }
  // @ifdef DEBUG
  !debug || !hasStoppedReading || logD(`Not reading, at ms: ${lastScrolledAtMs}`);
  // @endif

  let millisSinceLastReport = nowMs - lastReportedToServerAtMs;
  let millisSinceFirstNewRead = nowMs - firstUnreportedPostReadAtMs;

  if (!talksWithSererAlready &&
      // It's undef, if haven't looked at the page for long enough. (5AKBR02)
      lastViewedPostNr &&
      // Don't report uninteresting just-a-few-seconds.
      (unreportedSecondsReading > TooFewSeconds) &&
      // After has seen a new post, wait a few seconds, because likely sees even more, the
      // next few seconds.
      (millisSinceFirstNewRead > AfterReadThenWaitMillis) &&
      // Only report something, if there's something to report.
      (unreportedPostsRead.length ||
          millisSinceLastReport > ReportToServerIntervalSeconds * 1000)) {

    // @ifdef DEBUG
    !debug || logD(`Reporting to server: lastViewedPostNr: ${lastViewedPostNr}, ` +
        `${unreportedSecondsReading} seconds reading, these post nrs: ${toNrs(unreportedPostsRead)}`);
    // @endif

    talksWithSererAlready = true;
    // BUG this won't retry, if there's a netw disconnection. Instead, somehow merge with
    // the pubsub (long-polling / websocket) requests? which auto-retries, if reconnects.
    // See subscribeToServerEvents().
    // Later, send via WebSocket [VIAWS]. COULD_OPTIMIZE
    Server.trackReadingProgress(lastViewedPostNr, unreportedSecondsReading,
        unreportedPostsRead, () => {
      talksWithSererAlready = false;
      // In case the server is slow because under heavy load, better reset this here in
      // the done-callback, when the response arrives, rather than when the request is being sent.
      lastReportedToServerAtMs = Date.now();
    });

    // (Don't do this inside the callback above — that could overwrite values
    // that got set while the request was in-flight.)
    unreportedSecondsReading = 0;
    unreportedPostsRead = [];
    firstUnreportedPostReadAtMs = undefined;
  }

  const hasFocus = document.hasFocus();
  if (hasStoppedReading || !hasFocus) {
    secondsSpentReading = -maxConfusionSeconds;
    return;
  }

  // PERFORMANCE COULD optimize: check top level threads first, only check posts in
  // thread if parts of the thread is inside the viewport? isInViewport() takes
  // really long if there are > 200 comments (not good for mobile phones' battery?).

  // @ifdef DEBUG
  const unreadPosts: Post[] = [];
  _.each(page.postsByNr, (post: Post) => {
    if (!me_hasRead(me, post)) {
      unreadPosts.push(post);
    }
  });
  !debug || logD(`Num unread posts = ${unreadPosts.length}`);
  // @endif

  const shallRefreshVisiblePosts = hasScrolled || storeChanged || (!hadFocus && hasFocus);
  storeChanged = false;

  if (shallRefreshVisiblePosts) {
    visibleUnreadPostsStats = [];
    postsVisibleThisTick = {};
    currentlyViewingPostNr = 0;

    // Only post bodies below .dw-page, so won't include stuff in the sidebar.
    const postBodyElems = $all('.dw-page .dw-p-bd');

    _.each(postBodyElems, function(postBodyElem: HTMLElement) {
      if (!isInViewport(postBodyElem))
        return;

      const postElem = postBodyElem.parentElement;
      const postNr = parsePostNr(postElem);
      if (!postNr ||        // in Javascript, !NaN is true
          postNr < BodyNr)  // skip preview posts and the page title
        return;

      if (!currentlyViewingPostNr) {
        // For now, pick the topmost one in the viewport. COULD later: pick the one in the
        // middle — that's more likely to be the one the user is viewing?
        // + when scrolling to it, place it in the middle again [8GKF204].
        currentlyViewingPostNr = postNr;
      }

      postsVisibleThisTick[postNr] = true;

      let progress: ReadState = readStatesByPostNr[postNr];
      if (!progress) {
        progress = { postNr: postNr, charsRead: 0 };
        readStatesByPostNr[postNr] = progress;
      }

      if (progress.hasBeenRead)
        return;

      if (!progress.textLength) {
        progress.textLength = postBodyElem.textContent.replace(/\s/g, '').length;
      }

      visibleUnreadPostsStats.push(progress);
    });
  }

  let numPostsScrolledIntoViewport = 0;
  for (let i$ = 0, len$ = visibleUnreadPostsStats.length; i$ < len$; ++i$) {
    let stats: ReadState = visibleUnreadPostsStats[i$];
    if (!postNrsVisibleLastTick[stats.postNr]) {
      numPostsScrolledIntoViewport += 1;
    }
  }

  postNrsVisibleLastTick = postsVisibleThisTick;
  secondsSpentReading +=
      secondsBetweenTicks - numPostsScrolledIntoViewport * secondsLostPerNewPostInViewport;

  if (secondsBetweenTicks < secondsSpentReading) {
    secondsSpentReading = secondsBetweenTicks;
  }

  if (secondsSpentReading < -maxConfusionSeconds) {
    secondsSpentReading = -maxConfusionSeconds;
  }

  let charsLeftThisTick = Math.max(0, charsReadPerSecond * secondsSpentReading);

  for (let i$ = 0, len$ = visibleUnreadPostsStats.length; i$ < len$; ++i$) {
    let stats: ReadState = visibleUnreadPostsStats[i$];
    let charsToRead = contextSwitchCostChars + Math.min(maxCharsReadPerPost, stats.textLength);
    let charsReadNow = Math.min(charsLeftThisTick, charsToRead - stats.charsRead);

    // Let's read all posts at the same time instead. We don't know which one the user is
    // reading anyway, and feels a bit annoying to see reading-progress advancing for *the wrong*
    // post. — Often the user scrolls into view only one post at a time? And then this approach
    // will give ok results I think. Also, both Discourse and Gitter.im advance reading-progress
    // for all posts on screen at once.
    // So, don't:  charsLeftThisTick -= charsReadNow;

    stats.charsRead += charsReadNow;
    if (stats.charsRead >= charsToRead) {
      stats.hasBeenRead = true;
      rememberHasBeenRead(stats.postNr);
    }

    let fractionRead = !charsToRead ? 1.0 : stats.charsRead / charsToRead;
    if (fractionRead) {
      fadeUnreadMark(stats.postNr, fractionRead);
    }

    if (fractionRead >= 1) {
      // @ifdef DEBUG
      !debug || logD(`Just read post nr ${stats.postNr}`);
      // @endif
      // Don't remove until next tick, so a fade-out animation gets time to run. [8LKW204R]
      postNrsJustRead.push(stats.postNr);
      const post = page.postsByNr[stats.postNr];
      if (post) {
        unreportedPostsRead.push(post);
      }
      if (!firstUnreportedPostReadAtMs) {
        firstUnreportedPostReadAtMs = nowMs;
      }
    }
  }
}


function rememberHasBeenRead(postNr: number) {
  if (!canUseLocalStorage())
    return;

  let postNrsReadByPageId = getFromLocalStorage(localStorageKey) || {};
  let postNrsRead = postNrsReadByPageId[pageId] || [];
  postNrsReadByPageId[pageId] = postNrsRead;
  postNrsRead.push(postNr);
  putInLocalStorage(localStorageKey, postNrsReadByPageId);
}


/**
 * Customized is-in-viewport test to find out if a post, or at least
 * the start of it, is visible. Takes mobile phones into account: If the
 * post spans the whole viewport (from top to bottom) it's considered
 * visible.
 */
function isInViewport(postBody){
  let bounds = postBody.getBoundingClientRect();
  // 100 px is 3-4 rows text. If that much is visible, feels OK to mark the post as read.
  let aBitDown = Math.min(bounds.bottom, bounds.top + 100);
  let windowHeight = window.innerHeight;
  let windowWidth = window.innerWidth;
  let inViewportY = bounds.top >= 0 && aBitDown <= windowHeight;
  let inViewportX = bounds.left >= 0 && bounds.right <= windowWidth;
  let spansViewportY = bounds.top <= 0 && bounds.bottom >= windowHeight;
  return (inViewportY || spansViewportY) && inViewportX;
}


function fadeUnreadMark(postNr, fractionRead) {
  // Map fractionRead to one of 10,30,50,70,90 %:
  let percent = Math.floor(fractionRead * 5) * 20 + 10;
  percent = Math.min(90, percent);
  let selector = postNr === BodyNr ? '.dw-ar-p-hd' : '#post-' + postNr;
  const postElem = $first(selector);
  if (postElem) {
    const unreadMarkElem = postElem.querySelector('.s_P_H_Unr');
    $h.addClasses(unreadMarkElem, 's_P_H_Unr-' + percent);  // [8LKW204R]
  }
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list

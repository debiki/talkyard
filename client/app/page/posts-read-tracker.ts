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

/// <reference path="../plain-old-javascript.d.ts" />
/// <reference path="../ReactStore.ts" />

/**
 * Tracks which posts you've read, and also how long you've spent reading the page in total.
 * Every now and then, reports reading progress to the server, so it can remember
 * which posts you've read, and perhaps bump your trust level when you've spent enough
 * time reading.
 *
 * If reading the same page more than once, total-seconds-spent-reading-that-page increases
 * further, but posts already reported as read, won't be reported again.
 */
//------------------------------------------------------------------------------
   namespace debiki2.page.PostsReadTracker {
//------------------------------------------------------------------------------

let d = { i: debiki.internal, u: debiki.v0.util };
let $: any = d.i.$;

// @ifdef DEBUG
let debug = location.hash.match("debug=(t|true|all|trackReadingActivity)");
// @endif

export let debugIntervalHandler = null;

interface ReadState {
  postNr: number;
  mark?: number;
  charsRead?: number;
  hasBeenRead?: boolean;
  textLength?: number;
}


let readStatesByPostNr: { [postNr: number]: ReadState } = {};
let postNrsVisibleLastTick: { [postNr: number]: boolean } = {};
let pageId = debiki2.ReactStore.getPageId();
let postNrsJustRead = [];

// Most people read 200 words per minute with a reading comprehension of 60%.
// 0.1% read 1 000 wpm with a comprehension of 85%.
// A speed reading test article was 3692 chars, 597 words (www.readingsoft.com)
// and a speed of 200 wpm means 3692 / 597.0 * 200 / 60 = 20.6 chars per second.
// So 40 chars per second is fast, = 400 wpm, but on the other hand people frequently don't
// read text online so very carefully (?) so might make sense. Anyway better err on the side of
// assuming people read too fast, than too slow, because never-marking-a-post-as-read although
// the user did read it, seems more annoying, than marking-as-read posts when the user has read
// parts-of-it or most-of-it-but-not-all.
let charsReadPerSecond = 40;
let contextSwitchCostChars = charsReadPerSecond * 0.5;

// People usually (?) don't read everything in a long comment, so mark a comment as read after
// some seconds.
let maxCharsReadPerPost = charsReadPerSecond * 5;

let secondsBetweenTicks = 1;
let secondsSpentReading = 0;
let secondsLostPerNewPostInViewport = 0.4;
let maxConfusionSeconds = 1.2;
let localStorageKey = 'debikiPostNrsReadByPageId';

const TooFewSeconds = 3;

// Report more frequently, if the browser cannot send a beacon before the page gets closed.
const ReportToServerIntervalSeconds: number =
  navigator['sendBeacon'] ? 30 : 10; // dupl constant, in Scala too [6AK2WX0G]

let storeChanged = true;

let lastUserId: number;
let lastScrolledAtMs: number;
let lastScrollLeft: number;
let lastScrollTop: number;
let lastReportedToServerAtMs: number;
let lastViewedPostNr: PostNr;
let currentlyViewingPostNr: PostNr;
let unreportedSecondsReading: number;
let unreportedPostNrsRead: PostNr[];
let maxSecondsSinceLastScroll: number;
let talksWithSererAlready: boolean;
let isOldPageWithRandomPostNrs: boolean;

function reset() {
  lastScrolledAtMs = Date.now();
  lastScrollLeft = -1;
  lastScrollTop = -1;
  lastReportedToServerAtMs = Date.now();
  unreportedSecondsReading = 0;
  unreportedPostNrsRead = [];
  maxSecondsSinceLastScroll = 3 * 60;
  talksWithSererAlready = false;
  storeChanged = true;
}

let visibleUnreadPostsStats = [];
let postsVisibleThisTick: { [postNr: number]: boolean } = {};

export function start() {
  reset();
  debugIntervalHandler = setInterval(trackReadingActivity, secondsBetweenTicks * 1000);
  window.addEventListener('unload', sendAnyRemainingData, false);
  ReactStore.addChangeListener(function() {
    storeChanged = true;
  });
}


export function getPostNrsAutoReadLongAgo(): number[] {
  if (!localStorage)
    return [];

  let postNrsReadByPageId = getFromLocalStorage(localStorageKey) || {};
  return postNrsReadByPageId[pageId] || [];
}


function sendAnyRemainingData() {
  if (talksWithSererAlready || !lastViewedPostNr || !unreportedSecondsReading ||
      unreportedSecondsReading <= TooFewSeconds)
    return;

  // @ifdef DEBUG
  !debug || console.debug(`Sending remaining data via beacon: ${unreportedPostNrsRead.length} ` +
      `posts, ${unreportedSecondsReading} seconds reading`);
  // @endif

  // Don't include any 'success' callback —> sendBeacon will get used.
  Server.trackReadingProgress(lastViewedPostNr, unreportedSecondsReading, unreportedPostNrsRead);
  lastReportedToServerAtMs = Date.now();
}


function trackReadingActivity() {
  let store: Store = ReactStore.allData();
  let me: Myself = store.me;

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
    const apparentlyRandomNrs = _.keysIn(store.postsByNr).filter(nr => nr.length >= 6);
    isOldPageWithRandomPostNrs = !!apparentlyRandomNrs.length && _(store.postsByNr).size() < 10000;
  }
  if (isOldPageWithRandomPostNrs)
    return;

  // Don't remove posts read one tick ago until now, so they get time to fade away slowly.
  let hasReadMorePosts = postNrsJustRead.length;
  // @ifdef DEBUG
  !debug || !hasReadMorePosts || console.debug(`Marking as read: ${postNrsJustRead}`);
  // @endif
  _.each(postNrsJustRead, postNr => {
    debiki2.ReactActions.markPostAsRead(postNr, false);
  });
  postNrsJustRead = [];

  let nowMs = Date.now();

  let hasScrolled = false;
  let $pageColumn = $('#esPageColumn');
  let curScrollLeft = $pageColumn.scrollLeft();
  let curScrollTop = $pageColumn.scrollTop();
  if (lastScrollLeft != curScrollLeft || lastScrollTop != curScrollTop) {
    // @ifdef DEBUG
    !debug || console.debug(`Scroll detected, at ms: ${nowMs}`);
    // @endif
    lastScrollLeft = curScrollLeft;
    lastScrollTop = curScrollTop;
    lastScrolledAtMs = nowMs;
    hasScrolled = true;
  }

  let millisSinceLastScroll = nowMs - lastScrolledAtMs;
  if (millisSinceLastScroll > 3000) {
    // Now the user has been looking at that post for a while, so the next time we reopen
    // this page, focus that same post.
    lastViewedPostNr = currentlyViewingPostNr;
  }

  let hasStoppedReading = millisSinceLastScroll > maxSecondsSinceLastScroll * 1000;
  if (!hasStoppedReading) {
    unreportedSecondsReading += secondsBetweenTicks;
  }
  // @ifdef DEBUG
  !debug || !hasStoppedReading || console.debug(`Not reading, at ms: ${lastScrolledAtMs}`);
  // @endif

  let millisSinceLastReport = nowMs - lastReportedToServerAtMs;
  if (!talksWithSererAlready && lastViewedPostNr && unreportedSecondsReading > TooFewSeconds && (
        hasReadMorePosts || millisSinceLastReport > ReportToServerIntervalSeconds * 1000)) {
    // @ifdef DEBUG
    !debug || console.debug(`Reporting to server: ${unreportedSecondsReading} seconds, ` +
        `these posts: ${unreportedPostNrsRead}`);
    // @endif
    talksWithSererAlready = true;
    Server.trackReadingProgress(lastViewedPostNr, unreportedSecondsReading,
        unreportedPostNrsRead, () => {
      talksWithSererAlready = false;
      // In case the server is slow because under heavy load, better reset this here in
      // the done-callback, when the response arrives, rather than when the request is being sent.
      lastReportedToServerAtMs = Date.now();
    });
    unreportedSecondsReading = 0;
    unreportedPostNrsRead = [];
  }

  if (hasStoppedReading || !document.hasFocus()) {
    secondsSpentReading = -maxConfusionSeconds;
    return;
  }

  // PERFORMANCE COULD optimize: check top level threads first, only check posts in
  // thread if parts of the thread is inside the viewport? isInViewport() takes
  // really long if there are > 200 comments (not good for mobile phones' battery?).

  let unreadPosts: Post[] = [];
  _.each(store.postsByNr, (post: Post) => {
    if (!me_hasRead(me, post)) {
      unreadPosts.push(post);
    }
  });

  // @ifdef DEBUG
  !debug || console.debug(`Num unread posts = ${unreadPosts.length}`);
  // @endif

  let shallRefreshVisiblePosts = hasScrolled || storeChanged;
  storeChanged = false;

  if (shallRefreshVisiblePosts) {
    visibleUnreadPostsStats = [];
    postsVisibleThisTick = {};
    currentlyViewingPostNr = 0;

    let $postBodies = $('.dw-p-bd, .dw-ar-p-bd');

    $postBodies.each(function() {
      if (!isInViewport(this))
        return;

      let $postBody = $(this);
      let postNr = $postBody.closest('.dw-p, .esC_M').dwPostId();
      if (!postNr)
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
        progress.textLength = $postBody.text().replace(/\s/g, '').length;
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
      !debug || console.debug(`Just read post nr ${stats.postNr}`);
      // @endif
      // Don't remove until next tick, so a fade-out animation gets time to run. [8LKW204R]
      postNrsJustRead.push(stats.postNr);
      unreportedPostNrsRead.push(stats.postNr);
    }
  }
}


function rememberHasBeenRead(postNr: number) {
  if (!localStorage)
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
  let windowHeight = debiki.window.height();
  let windowWidth = debiki.window.width();
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
  $(selector).find('.s_P_H_Unr').addClass('s_P_H_Unr-' + percent);  // [8LKW204R]
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list

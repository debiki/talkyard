/*
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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

/// <reference path="../../typedefs/react/react.d.ts" />
/// <reference path="../../typedefs/lodash/lodash.d.ts" />
/// <reference path="../../shared/plain-old-javascript.d.ts" />
/// <reference path="../ReactStore.ts" />

//------------------------------------------------------------------------------
   module debiki2.sidebar.UnreadCommentsTracker {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var $: any = d.i.$;

export var debugIntervalHandler = null;

interface ReadState {
  postId: number;
  mark?: number;
  charsRead?: number;
  hasBeenRead?: boolean;
  textLength?: number;
}


var readStatesByPostId: { [postId: number]: ReadState } = {};
var postsVisibleLastTick: { [postId: number]: boolean } = {};

var pageId = debiki2.ReactStore.getPageId();
var charsReadPerSecond = 35;
var maxCharsReadPerPost = charsReadPerSecond * 4.5;
var secondsBetweenTicks = 0.33;
var secondsSpentReading = 0;
var secondsLostPerNewPostInViewport = 0.5;
var maxConfusionSeconds = -1;
var localStorageKey = 'debikiPostIdsReadByPageId';
var brightnessWhenRead = 175; // 0-255

var postIdsReadLongAgo: number[] = getPostIdsAutoReadLongAgo();

export function start() {
  debugIntervalHandler = setInterval(trackUnreadComments, secondsBetweenTicks * 1000);
  //setInitialReadMarkColors();
}


export function getPostIdsAutoReadLongAgo(): number[] {
  if (!localStorage)
    return [];

  var postIdsReadByPageIdString = localStorage.getItem(localStorageKey) || '{}';
  var postIdsReadByPageId = JSON.parse(postIdsReadByPageIdString);
  var postIdsRead = postIdsReadByPageId[pageId] || [];
  return postIdsRead;
}


function setInitialReadMarkColors() {
  var allMarkClasses =
      '.dw-p-auto-read, .dw-p-mark-read, .dw-p-mark-gray-star, .dw-p-mark-yellow-star';
  $('.dw-p:not(' + allMarkClasses + ') .dw-p-mark').each(function() {
    setColorOfMark($(this), 0); // 0 means 0% read
  });
}


function trackUnreadComments() {
  if (!document.hasFocus()) {
    secondsSpentReading = maxConfusionSeconds;
    return;
  }

  var visibleUnreadPostsStats = [];
  var numVisibleUnreadChars = 0;
  var postsVisibleThisTick: { [postId: number]: boolean } = {};

  $('.dw-p[id]').each(function() {
    var post = $(this);
    var postBody = post.children('.dw-p-bd');
    if (!postBody.length || !isInViewport(postBody))
      return;

    var postId: number = post.dwPostId();
    postsVisibleThisTick[postId] = true;

    var progress = readStatesByPostId[postId];

    if (!progress && postIdsReadLongAgo.indexOf(postId) !== -1) {
      progress = {
        postId: postId,
        hasBeenRead: true,
      };
      readStatesByPostId[postId] = progress;
    }

    if (!progress) {
      progress = {
        postId: postId,
        charsRead: 0
      };
      readStatesByPostId[postId] = progress;
    }

    if (progress.hasBeenRead)
      return;

    if (!progress.textLength) {
      progress.textLength = postBody.text().replace(/\s/g, '').length;
    }

    visibleUnreadPostsStats.push(progress);
    numVisibleUnreadChars += progress.textLength;
  });

  var numPostsScrolledIntoViewport = 0;
  for (var i$ = 0, len$ = visibleUnreadPostsStats.length; i$ < len$; ++i$) {
    var stats = visibleUnreadPostsStats[i$];
    if (!postsVisibleLastTick[stats.postId]) {
      numPostsScrolledIntoViewport += 1;
    }
  }

  postsVisibleLastTick = postsVisibleThisTick;
  secondsSpentReading += secondsBetweenTicks - numPostsScrolledIntoViewport * secondsLostPerNewPostInViewport;

  if (secondsBetweenTicks < secondsSpentReading) {
    secondsSpentReading = secondsBetweenTicks;
  }

  if (secondsSpentReading < maxConfusionSeconds) {
    secondsSpentReading = maxConfusionSeconds;
  }

  var charsReadThisTick = Math.max(0, charsReadPerSecond * secondsSpentReading);
  var charsLeftThisTick = charsReadThisTick;

  for (i$ = 0, len$ = visibleUnreadPostsStats.length; i$ < len$; ++i$) {
    stats = visibleUnreadPostsStats[i$];
    var charsToRead = Math.min(maxCharsReadPerPost, stats.textLength);
    var charsReadNow = Math.min(charsLeftThisTick, charsToRead - stats.charsRead);
    charsLeftThisTick -= charsReadNow;
    stats.charsRead += charsReadNow;
    if (stats.charsRead >= charsToRead) {
      stats.hasBeenRead = true;
      rememberHasBeenRead(stats.postId);
    }

    var fractionRead = !charsToRead ? 1.0 : stats.charsRead / charsToRead;
    if (fractionRead >= 1) {
      debiki2.ReactActions.markPostAsRead(stats.postId, false);
    }
    else {
      setColorOfPost(stats.postId, fractionRead);
    }
  }
}


function rememberHasBeenRead(postId: number) {
  if (!localStorage)
    return;

  var postIdsReadByPageIdString = localStorage.getItem(localStorageKey) || '{}';;
  var postIdsReadByPageId = JSON.parse(postIdsReadByPageIdString);
  var postIdsRead = postIdsReadByPageId[pageId] || [];
  postIdsReadByPageId[pageId] = postIdsRead;
  postIdsRead.push(postId);
  localStorage.setItem(localStorageKey, JSON.stringify(postIdsReadByPageId));
}


/**
 * Customized is-in-viewport test to find out if a post, or at least
 * the start of it, is visible. Takes mobile phones into account: If the
 * post spans the whole viewport (from top to bottom) it's considered
 * visible.
 */
function isInViewport($postBody){
  var myOffs = $postBody.offset();
  var myTop = myOffs.top;
  var myBottomAlmost = myTop + Math.min($postBody.height(), 600);
  var myLeft = myOffs.left;
  var myRight = myLeft + $postBody.width();
  var $win = $(window);
  var winTop = $win.scrollTop();
  var winHeight = $win.height();
  var winBottom = winTop + winHeight;
  var winLeft = $win.scrollLeft();
  var winWidth = $win.width();
  var winRight = winLeft + winWidth;
  var inViewportY = winTop <= myTop && myBottomAlmost <= winBottom;
  var inViewportX = winLeft <= myLeft && myRight <= winRight;
  var spansViewportY = myTop <= winTop && winBottom <= myBottomAlmost;
  return (inViewportY || spansViewportY) && inViewportX;
}


function setColorOfPost(postId, fractionRead) {
  var mark = $('#post-' + postId).find('.dw-p-mark');
  setColorOfMark(mark, fractionRead);
}


function setColorOfMark(mark, fractionRead) {
  var fractionLeft = 1.0 - fractionRead;
  // First black, then gray:
  var whiteness = brightnessWhenRead - Math.ceil(brightnessWhenRead * fractionLeft);
  var colorHex = whiteness.toString(16);
  colorHex = ('0' + colorHex).slice(-2); // pad left with 0
  var colorString = '#' + colorHex + colorHex + colorHex;
  mark.css('border-color', colorString);

  /* This outlines unread post ids in red, and the ones you've read in blue:
  var outlineThickness = Math.max(0, Math.ceil(7 * fractionLeft));
  var colorChange = Math.ceil(100 * fractionLeft);
  var redColor = (155 + colorChange).toString(16);
  var greenColor = colorChange.toString(16);
  var blueColor = Math.ceil(80 + 100 * fractionRead).toString(16);
  var color = '#' + redColor + greenColor + blueColor;
  var link = $('#post-' + stats.postId).find('> .dw-p-hd > .dw-p-link');
  link.css('outline', outlineThickness + "px " + color + " solid");
  if (stats.hasBeenRead) {
    link.css('outline', '2px blue solid');
  }
  */
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list

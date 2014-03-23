/* Draws arrows from comment to replies. Uses CSS borders and PNG images.
 * Copyright (C) 2010 - 2013 Kaj Magnus Lindberg (born 1979)
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

/**
 * This file contains an arrow drawer that is used if there's no SVG support.
 * Well, currently it's always used, actually, because it was too
 * tedious to keep the SVG arrows version up-to-date, and performance
 * is much better with this border & PNG arrows drawer.
 *
 * (There's a certain SVG Web library, with a Flash renderer
 * but it seems far too slow when resizing the Flash screen to e.g.
 * 2000x2000 pixels. And scrolldrag stops working (no idea why). Seems easier
 * to add these images of arrows instead.)
 */


var d = { i: debiki.internal, u: debiki.v0.util };
var $ = d.i.$;


function $clearAndRedrawArrows() {
  var $thread = $(this).closest('.dw-t');
  if ($thread.is('.dw-hz.dw-depth-0')) {
    clearAndRedrawArrowsHorizontally($thread);
  }
  else {
    clearAndRedrawArrowsVertically($thread);
  }
};


function clearAndRedrawArrowsHorizontally($thread) {
  $thread.find('> .dw-t-vspace > .dw-arw').remove();
  $thread.find('> .dw-res > li > .dw-t > .dw-arw').remove();
  drawHzArrowToReplyButton($thread);
  drawHzArrowsToReplies($thread);
};


function drawHzArrowToReplyButton($thread) {
  var arrowHtml;
  var numChildren = $thread.find('> .dw-res > li').length;
  if (numChildren == 1) {
    // Use solo arrow.
    arrowHtml = '<div class="dw-arw dw-arw-hz-curve-to-reply-btn"></div>';
  }
  else {
    // Use branching arrow (it branches out to the replies).
    arrowHtml = '<div class="dw-arw dw-arw-hz-branch-to-reply-btn"></div>';
  }
  $thread.find('> .dw-t-vspace').prepend(arrowHtml);
};


function drawHzArrowsToReplies($thread) {
  var $childThreads = $thread.find('> .dw-res > li > .dw-t');
  $childThreads.each(function() {
    $childThread = $(this);

    // Draw arrow to child thread.
    $childThread.prepend(
      '<div class="dw-arw dw-arw-hz-line-to-this"></div>' +
      '<div class="dw-arw dw-arw-hz-curve-to-this"></div>');

    // Draw line above child thread, to next thread.
    var $listItem = $childThread.parent();
    if (!$listItem.is(':last-child')) {
      $childThread.prepend(
        '<div class="dw-arw dw-arw-hz-line-to-sibling"></div>');
    }
  });
};


function clearAndRedrawArrowsVertically($thread) {

  // (Always draw arrow from "Closed Threads" header to the closed
  // threads, even if there's only one. I think it's then easier to
  // understand that the closed threads are actually replies to
  // the original post.)
  var thisIsHzClosedSection =
    $thread.is('.dw-t-closed') &&
    $thread.parent().closest('.dw-t').is('.dw-hz');

  var $childThreads = $thread.find('> .dw-res > .dw-t');

  $thread.removeClass('dw-t-exactly-one-reply');
  if ($childThreads.length === 1 && !thisIsHzClosedSection) {
    // We're inside a thread that does't branch. It's rendered
    // as a flat thread, without any arrows, so add a CSS class
    // that reduces the space between replies.
    $thread.addClass('dw-t-exactly-one-reply');
  }

  // Remove old threads.
  $childThreads.children('.dw-arw').remove();

  // Add new threads, if needed: (the rest of this function)

  // Single replies are placed directly below their parent,
  // as if using a flat layout (rather than a threaded layout).
  // Then, need draw no arrows; people are used to flat layouts.
  //
  // This is how it looks:
  //
  //
  // Explanation                                 Illustration
  // -----------                                 ------------
  //
  // A parent comment with only one reply,       +-----—-———————----+
  // "child comment".                            |parent comment    |
  //                                             |text…             |
  //                                             +------------------+
  //
  // This arrow is shown only sometimes, namely  \
  // if whole page uses single column layout.     v
  //
  // The child comment. I hope no arrow          +-----—------------+
  // is needed above, because it should be       |the only child    |
  // obvious that the child replies to the       |comment text…     |
  // parent comment.                             +------------------+

  if ($childThreads.length == 0)
    return;

  if ($childThreads.length == 1 && !thisIsHzClosedSection) {
    // However, sometimes the child comment illustrated above is
    // indented, namely if we're using a single column layout
    // for the whole page. Then we need this arrow: (it's hidden by
    // CSS if not needed). Also see [90kfHW2] in debiki.styl.
    $($childThreads[0]).prepend(
      '<div class="dw-arw dw-arw-vt-curve-to-this"></div>');
    return;
  }

  // Let me explain how I draw arrows to each $childThread:
  //
  //
  // Explanation                                 Illustration
  // -----------                                 ------------
  //
  // A parent comment with 3 replies.            +-----—-———————----+
  //                                             |parent comment    |
  //                                             |text…             |
  //                                         __  +------------------+
  // This part >--------->---------->-------/    |
  // is "dw-arw-vt-line-to-sibling-1"       \    |
  //                                         \_  |
  // This line >----------->------->----->   /   |`-> +-----—-------+
  // is "dw-arw-vt-curve-to-this"           /    |    |child comment|
  //                                       /     |    |text…        |
  // This part >---------->-------->------/----  |    +-------------+
  // is "dw-arw-vt-line-to-sibling-2"       /    |
  //                                       /     |
  // And here is >---------->-------->----/----  |`-> +-----------—-+
  // is "dw-arw-vt-line-to-sibling-1",           |    |child comment|
  // again.                                      |    |text…        |
  //                                             |    +-------------+
  //                                             \
  // This very last line to the :last-child -->   v
  // is "dw-arw-vt-curve-to-this", again.        +-----—------------+
  //                                             |:last-child       |
  //                                             |comment text…     |
  //                                             +------------------+

  $childThreads.each(function() {
    $childThread = $(this);

    //                             \
    // Draw the `-> part:  (or the  v  part, it's the same image)
    $childThread.prepend(
      '<div class="dw-arw dw-arw-vt-curve-to-this"></div>');

    //          |
    // Draw the | parts:
    var isLastChild = $childThread.is(':last-child');
    if (!isLastChild) {
      $childThread.prepend(
        '<div class="dw-arw dw-arw-vt-line-to-sibling-1"></div>' +
        '<div class="dw-arw dw-arw-vt-line-to-sibling-2"></div>');
    }
  });
};


function $highlightOn() {
  // COULD replace arrow image with a highlighted version
};


function $highlightOff() {
  // COULD replace arrow image with a highlighted version
};


debiki.internal.makeFakeDrawer = function($) {
  return {
    $clearAndRedrawArrows: $clearAndRedrawArrows,
    initRootDrawArrows: function() {},
    $initPostSvg: function() {},
    $drawPost: function() {},
    $drawTree: function() {},
    $drawParents: function() {},
    $drawParentsAndTree: function() {},
    drawEverything: function() {},
    $highlightOn: $highlightOn,
    $highlightOff: $highlightOff
  };
};


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

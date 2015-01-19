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

/*
 * This file draws arrows between comments to illustrate parent child relationships.
 * It draws PNG arrows.
 *
 * There is old outdated jQuery soup code that draws arrows in SVG, here:
 *   client/app/old/arrows/arrows-svg-unused.js
 * There are problems with SVG though: rendering SVG arrows takes rather long,
 * especially problematic on mobile phones. And keeping the SVG arrows correctly stretched
 * when something is resized, is prone to errors. (The PNG arrows use `border: ...` and
 * resize automatically.) Also, I haven't yet made SVG avoid indenting deeply nested
 * replies "too much".
 */

/// <reference path="../../shared/plain-old-javascript.d.ts" />
/// <reference path="../../typedefs/react/react.d.ts" />
/// <reference path="../../typedefs/moment/moment.d.ts" />

//------------------------------------------------------------------------------
  module debiki2.renderer {
//------------------------------------------------------------------------------

var React = window['React']; // TypeScript file doesn't work
var r = React.DOM;


var TitleId = 0;
var BodyPostId = 1;


export function drawHorizontalArrowFromRootPost(rootPost) {
  var arrowToChildren;
  if (rootPost.childIdsSorted.length === 1) {
    arrowToChildren = r.div({ className: 'dw-arw dw-arw-hz-curve-to-reply-btn' });
  }
  else if (rootPost.childIdsSorted.length >= 2) {
    arrowToChildren = r.div({ className: 'dw-arw dw-arw-hz-branch-to-reply-btn' });
  }
  return r.div({ className: 'dw-t-vspace' }, arrowToChildren);
}


export function drawArrowsFromParent(allPosts, parentPost, depth: number,
      index: number, horizontalLayout: boolean, rootPostId: number) {

  var numRemainingNonMultireplies = 0;
  if (parentPost) {
    for (var i = index + 1; i < parentPost.childIdsSorted.length; ++i) {
      var siblingId = parentPost.childIdsSorted[i];
      var sibling = allPosts[siblingId];
      if (sibling.multireplyPostIds.length) {
        break;
      }
      numRemainingNonMultireplies += 1;
    }
  }

  if (parentPost && horizontalLayout && parentPost.postId === rootPostId) {
    return drawHorizontalArrows(index === 0, numRemainingNonMultireplies);
  }

  if (parentPost) {
    // In vertical layout, don't draw arrows to top level replies.
    if (!horizontalLayout && depth === 1)
      return [];

    return drawVerticalArrows(depth, index === 0, horizontalLayout, numRemainingNonMultireplies);
  }

  return [];
}


function drawHorizontalArrows(isFirstChild, numRemainingNonMultireplies) {
  // We're rendering a top level reply in its own column. Draw horizontal arrows from
  // the root post. First, and arrow to this thread. Then, if there are any sibling
  // therad columns to the right, arrows to them too. But if this thread is the very
  // first child, then skip some arrows because there's already a special arrow
  // from the root post to this thread.
  var arrows = [];

  if (!isFirstChild) {
    arrows.push(
        r.div({ className: 'dw-arw dw-arw-hz-curve-to-this' }));
  }

  if (numRemainingNonMultireplies > 0) {
    if (!isFirstChild) {
      arrows.push(
         r.div({ className: 'dw-arw dw-arw-hz-line-to-this' }));
    }
    arrows.push(
        r.div({ className: 'dw-arw dw-arw-hz-line-to-sibling' }));
  }

  return arrows;
}


function drawVerticalArrows(depth: number, isFirstChild: boolean,
    horizontalLayout: boolean, numRemainingNonMultireplies: number) {

  // Single replies (without any siblings) are placed directly below their parent,
  // as if using a flat layout (rather than a threaded layout). Then, need draw
  // no arrows; people are used to flat layouts.
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
  //                                              \
  //                                               v
  // The child comment.                          +-----—------------+
  //                                             |the only child    |
  //                                             |comment text…     |
  //                                             +------------------+

  var isOnlyChild = isFirstChild && numRemainingNonMultireplies === 0;
  if (isOnlyChild) {
    return (
      r.div({ className: 'dw-arw dw-arw-vt-curve-to-this' }));
  }

  // Let me explain how I draw arrows to this thread from the parent:
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
  // is "dw-arw-vt-curve-to-unindented".         +-----—------------+
  // Here, numRemainingNonMultireplies is 0.     |:last-child       |
  //                                             |comment text…     |
  //                                             +------------------+

  var arrows = [];

  // Draw the `-> part:
  if (numRemainingNonMultireplies >= 1) {
    arrows.push(
        r.div({ className: 'dw-arw dw-arw-vt-curve-to-this' }));
  }

  // Start or continue an arrow to the siblings below, but not to
  // multireplies, since we don't know if they reply to the current post,
  // or to posts elsewhere in the tree.
  if (numRemainingNonMultireplies >= 1) {
    arrows.push(
        r.div({ className: 'dw-arw dw-arw-vt-line-to-sibling-1' }));
    arrows.push(
        r.div({ className: 'dw-arw dw-arw-vt-line-to-sibling-2' }));

    //          \
    // Draw the  v  arrow to the very last non-multireply:
    if (numRemainingNonMultireplies === 1) {
      if (!horizontalLayout && depth === 2) {
        arrows.push(
          r.div({ className: 'dw-arw dw-arw-vt-curve-to-last-sibling-indented' }));
      }
      else {
        arrows.push(
          r.div({ className: 'dw-arw dw-arw-vt-curve-to-last-sibling-unindented' }));
      }
    }

    // Add a clickable handle that scrolls to the parent post and highlights it.
    arrows.push(
        r.div({ className: 'dw-arw-vt-handle' }));
  }

  return arrows;
}

//------------------------------------------------------------------------------
  }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list

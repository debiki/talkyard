/* Copyright (c) 2010 - 2013 Kaj Magnus Lindberg. All rights reserved. */


debiki.internal.makeFakeDrawer = function($) {
  // No SVG support. There's a certain SVG Web library, with a Flash renderer
  // but it seems far too slow when resizing the Flash screen to e.g.
  // 2000x2000 pixels. And scrolldrag stops working (no idea why). Seems easier
  // to add these images of arrows instead.

  function initialize() {
    $drawTree.call($('.dw-t.dw-depth-0'));
  };

  function $drawTree() {

    var $startThread = $(this);

    // Vertical layout
    // ---------------

    // Find threads with child threads and threads with replies collapsed,
    // and draw vertical lines towards those children / collapsed replies.
    var $meIfVerticalParent = $startThread.filter(':not(.dw-depth-0)');
    $startThread.find('.dw-t').add($meIfVerticalParent)
        .has('.dw-t, .dw-res.dw-zd').each(function() {
      $(this).prepend("<div class='dw-arw dw-svg-fake-varrow'/>");
      $(this).prepend("<div class='dw-arw dw-svg-fake-varrow-hider-hi'/>");
      $(this).prepend("<div class='dw-arw dw-svg-fake-varrow-hider-lo'/>");
    });

    //        \ 
    // Draw a  `->  arrow to child threads and collapsed replies.

    // Find child threads laid out vertically: depth > 1. (COULD use .dw-hor
    // instead?)
    var $childSearchStart =
      $startThread.closest('.dw-depth-1').length ?
        $startThread : $startThread.find('.dw-depth-1');

    var $childThreads = $childSearchStart.find('.dw-t:not(.dw-i-t)');
    var $collapsedReplies = $childSearchStart.find('.dw-res.dw-zd > li');

    // Include $startThread, unless it's laid out horizontally (depth <= 1)
    var $meIfVerticalChild = $startThread.filter(
        ':not(.dw-depth-0, .dw-depth-1, .dw-i-t)');
    $childThreads = $childThreads.add($meIfVerticalChild);


    $childThreads.add($collapsedReplies).each(function() {
      $(this).prepend('<div class="dw-arw dw-svg-fake-vcurve-short"/>');
    });

    // For each last child, then just below the `-> we just added,
    // the vertical line from which `-> originates continues downwards.
    // Hide the remaining part of that vertical line.
    $childThreads.filter(':last-child').each(function() {
      $(this).prepend("<div class='dw-arw dw-svg-fake-varrow-hider-left'/>");
    });

    // BUG: If adding new reply, and it's the parent's first reply, the parent
    // thread currently has no vertical line pointing downwards to the replies.
    // COULD add such a line. (Currently only the \   line to the reply
    // is added, above.)                           `->

    // BUG: If adding new reply, and it's *not* the parent's first reply,
    // another earlier reply is the last one, and it has a 
    // dw-svg-fake-varrow-hider-left, which hides part of the vertical line
    // to this new reply.

    // COULD fix: Inline threads:  .dw-t:not(.dw-hor) > .dw-i-ts > .dw-i-t
    // COULD fix: First one: .dw-t:not(.dw-hor) > .dw-i-ts > .dw-i-t:first-child
    // COULD fix: Root post's inline threads:  .dw-t.dw-hor > .dw-i-ts > .dw-i-t
  }

  // Horizontal layout
  // -----------------

  // Points on the Reply button, and continues eastwards, spans all replies.
  var replyBtnBranchingArrow =
      '<div class="dw-arw dw-svg-fake-hcurve-start"/>' + // branches out
      '<div class="dw-arw dw-svg-fake-harrow"></div>';  // extends branch

  var horizListItemEndArrow =
      '<div class="dw-arw dw-svg-fake-hcurve"/>';

  // Draw arrows to reply button and child threads.
  function $initPostSvg() {
    var $post = $(this).filter('.dw-p').dwBugIfEmpty('DwE2KR3');
    var $thread = $post.closest('.dw-t');
    var $parentThread = $thread.parent().closest('.dw-t');

    // Draw arrow to reply button, i this is a horizontally laid out thread
    // (with an always visible Reply button).
    if ($thread.is('.dw-hor')) {
      var childCount = $thread.find('.dw-res > li').length;
      var arrowsHtml = childCount === 1 ?
          '<div class="dw-arw dw-svg-fake-hcurve-start-solo"/>' :
          replyBtnBranchingArrow;
      $thread.children('.dw-t-vspace').append(arrowsHtml);
    }

    // Draw arrow to this thread from any horizontally laid out parent thread.
    if ($parentThread.is('.dw-hor')) {
      // There's a horizontal line above that spans this thread and all
      // siblings; make the line branch out to this thread.
      $thread.prepend(horizListItemEndArrow);

      // If this is the last child thread, hide the tail of the horizontal
      // line (since there's nothing more to the right).
      var $listItem = $thread.parent().dwCheckIs('li', 'DwE90dk2');
      if ($listItem.is(':last-child')) {
        // CSS makes these <div>s actually hide the line.
        $thread.prepend('<div class="dw-svg-fake-harrow"></div>');
      }
    } else {
      // vertical arrow, already handled above.
      // COULD fix: Not handled above, for *new* threads, no arrows to them :(
      // BUG arrows should be drawn here, for replies to inline threads.
    }
  }

  // COULD rename to $animateParentsAndTree? Need do nothing.
  function $drawParentsAndTree() {
  }

  function $drawParents() {
    // Need do nothing, because the browser resize horizontal/vertical
    // "arrows" automatically (they are colored borders actually).
  }

  function $drawPost() {
    // COULD fix: If any SVG native support: draw arrows to inline threads?
    // Or implement via fake .png arrows?
    // COULD draw arrows to new vertical replies
  }

  function $highlightOn() {
    // COULD replace arrow image with a highlighted version
  }

  function $highlightOff() {
    // COULD replace arrow image with a highlighted version
  }

  return {
    initRootDrawArrows: initialize,
    $initPostSvg: $initPostSvg,
    $drawPost: $drawPost,
    $drawTree: $drawTree,
    $drawParents: $drawParents,
    $drawParentsAndTree: $drawParentsAndTree,
    drawEverything: function() {},
    $highlightOn: $highlightOn,
    $highlightOff: $highlightOff
  };
};


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

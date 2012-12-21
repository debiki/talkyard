/* Copyright (c) 2010 - 2012 Kaj Magnus Lindberg. All rights reserved. */


debiki.internal.makeFakeDrawer = function($) {
  // No SVG support. There's a certain SVG Web library, with a Flash renderer
  // but it seems far too slow when resizing the Flash screen to e.g.
  // 2000x2000 pixels. And scrolldrag stops working (no idea why). Seems easier
  // to add these images of arrows instead.

  function initialize() {
    // Vertical layout
    // ---------------

    $('.dw-depth-0 .dw-t:has(.dw-t)').each(function(){
      $(this).prepend("<div class='dw-arw dw-svg-fake-varrow'/>");
      $(this).prepend("<div class='dw-arw dw-svg-fake-varrow-hider-hi'/>");
      $(this).prepend("<div class='dw-arw dw-svg-fake-varrow-hider-lo'/>");
    });

    // Draw a  `-> arrow to $(this).
    $('.dw-depth-1 .dw-t:not(.dw-i-t)').each(function(){
      $(this).prepend('<div class="dw-arw dw-svg-fake-vcurve-short"/>');
    });

    // If this is the last child, then just below the `-> we just added,
    // the vertical line from which `-> originates continues downwards.
    // Hide the remaining part of that line.
    $('.dw-depth-1 .dw-t:not(.dw-i-t):last-child').each(function(){
      $(this).prepend("<div class='dw-arw dw-svg-fake-varrow-hider-left'/>");
    });

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

  function $drawParentsAndTree() {}  // ?? do I need to do something?

  function $drawParents() {}  // ?? do I need to do something?

  function $drawTree() {} // COULD implement?

  function $drawPost() {
    // COULD fix: If any SVG native support: draw arrows to inline threads?
    // Or implement via fake .png arrows?
    // COULD draw arrows to new vertical replies
  }

  function drawArrowsToReplyForm($formParent) {
    var arws = $formParent.closest('.dw-t').is('.dw-hor')
        ? replyBtnBranchingArrow
        : '<div class="dw-svg-fake-vcurve-short"/>'; // dw-png-arw-vt-curve-end?
    $formParent.prepend(arws);
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
    drawArrowsToReplyForm: drawArrowsToReplyForm,
    $highlightOn: $highlightOn,
    $highlightOff: $highlightOff
  };
};


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

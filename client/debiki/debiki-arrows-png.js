/* Copyright (c) 2010 - 2012 Kaj Magnus Lindberg. All rights reserved. */


debiki.internal.makeFakeDrawer = function($) {
  // No SVG support. There's a certain SVG Web library, with a Flash renderer
  // but it seems far too slow when resizing the Flash screen to e.g.
  // 2000x2000 pixels. And scrolldrag stops working (no idea why). Seems easier
  // to add these images of arrows instead.

  function initialize() {
    // North-south arrows: (for vertical layout)
    $('.dw-depth-0 .dw-t:has(.dw-t)').each(function(){
      $(this).prepend("<div class='dw-arw dw-svg-fake-varrow'/>");
      $(this).prepend("<div class='dw-arw dw-svg-fake-varrow-hider-hi'/>");
      $(this).prepend("<div class='dw-arw dw-svg-fake-varrow-hider-lo'/>");
    });
    $('.dw-depth-1 .dw-t:not(.dw-i-t)').each(function(){
      var hider = $(this).filter(':last-child').length ?
                    ' dw-svg-fake-arrow-hider' : '';
      $(this).prepend(
          '<div class="dw-arw dw-svg-fake-vcurve-short'+ hider +'"/>');
    });
    $('.dw-depth-1 .dw-t:not(.dw-i-t):last-child').each(function(){
      $(this).prepend("<div class='dw-arw dw-svg-fake-varrow-hider-left'/>");
    });
    // TODO: Inline threads:  .dw-t:not(.dw-hor) > .dw-i-ts > .dw-i-t
    // TODO: First one:  .dw-t:not(.dw-hor) > .dw-i-ts > .dw-i-t:first-child
    // TODO: Root post's inline threads:  .dw-t.dw-hor > .dw-i-ts > .dw-i-t
  }

  // Points on the Reply button, and branches out to the replies to the
  // right of the button.
  var replyBtnBranchingArrow =
      '<div class="dw-arw dw-svg-fake-hcurve-start"/>' + // branches out
      '<div class="dw-arw dw-svg-fake-harrow"></div>';  // extends branch

  var horizListItemEndArrow =
      '<div class="dw-arw dw-svg-fake-hcurve"/>';

  // Arrows to each child thread.
  function $initPostSvg() {
    var $post = $(this).filter('.dw-p').dwBugIfEmpty();
    var $thread = $post.closest('.dw-t');
    var $parentThread = $thread.parent().closest('.dw-t');
    // If this is a horizontally laid out thread that has an always visible
    // Reply button, draw an arrow to that button.
    if ($thread.is('.dw-hor')) {
      var childCount = $thread.find('.dw-res > li').length;
      var arrowsHtml = childCount === 1 ?
          '<div class="dw-arw dw-svg-fake-hcurve-start-solo"/>' :
          replyBtnBranchingArrow;
      $thread.children('.dw-t-vspace').append(arrowsHtml);
    }

    if ($parentThread.is('.dw-hor')) {
      // There's a horizontal line above; make it branch out to this thread.
      $thread.prepend(horizListItemEndArrow);
      if ($thread.is(':last-child')) {
        // The line above continues above this thread although there is
        // no threads to the right. So hide the end of that horizontal line.
        // (CSS makes these three <div>s actually hide it).
        $thread.prepend(
            '<div class="dw-svg-fake-harrow"></div>' +
            '<div class="dw-svg-fake-harrow-end"></div>');
      }
    } else {
      // vertical arrow, already handled above.
      // TODO not handled above, for *new* threads, no arrows to them :(
      // BUG arrows should be drawn here, for replies to inline threads.
    }
  }

  function $drawParentsAndTree() {}  // ?? do I need to do something?

  function $drawParents() {}  // ?? do I need to do something?

  function $drawTree() {} // TODO

  function $drawPost() {
    // TODO: If any SVG native support: draw arrows to inline threads?
    // Or implement via fake .png arrows?
    // TODO draw arrows to new vertical replies
  }

  function drawArrowsToReplyForm($formParent) {
    var arws = $formParent.closest('.dw-t').is('.dw-hor')
        ? replyBtnBranchingArrow
        : '<div class="dw-svg-fake-vcurve-short"/>'; // dw-png-arw-vt-curve-end?
    $formParent.prepend(arws);
  }

  function $highlightOn() {
    // TODO replace arrow image with a highlighted version
  }

  function $highlightOff() {
    // TODO replace arrow image with a highlighted version
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

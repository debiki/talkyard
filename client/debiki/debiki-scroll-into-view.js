/* Copyright (c) 2010 - 2012 Kaj Magnus Lindberg. All rights reserved. */

jQuery.fn.dwScrollIntoView = function(options) {
  var $ = jQuery;
  if (!options) options = {};
  var duration = options.duration || 'slow';
  var marginTop = options.marginTop || 15;
  var marginBottom = options.marginBottom || 15;
  var marginLeft = options.marginLeft || 15;
  var marginRight = options.marginRight || 15;

  var myTop = this.offset().top - marginTop;
  var myBottom = myTop + this.outerHeight() + marginTop + marginBottom;
  var myLeft = this.offset().left - marginLeft;
  var myRight = myLeft + this.outerWidth() + marginLeft + marginRight;
  var winTop = $(window).scrollTop();
  var winHeight = $(window).height();
  var winBottom = winTop + winHeight;
  var winLeft = $(window).scrollLeft();
  var winWidth = $(window).width();
  var winRight = winLeft + winWidth;

  var desiredWinTop = winTop;
  var desiredWinLeft = winLeft;

  // Calculate vertical scroll.
  if (myTop < winTop) {
    // Make myTop visible (scroll up).
    desiredWinTop = myTop;
  }
  else if (winBottom < myBottom) {
    // Make myBottom visible (scroll down).
    desiredWinTop = myBottom - winHeight;
    // If viewport is small, prefer to show myTop rather than myBottom.
    if (myTop < desiredWinTop) desiredWinTop = myTop;
  }

  // Calculate horizontal scroll.
  if (myLeft < winLeft) {
    // Make myLeft visible (scroll left).
    desiredWinLeft = myLeft;
  }
  else if (winRight < myRight) {
    // Make myRight visible (scroll right).
    desiredWinLeft = myRight - winWidth;
    // If viewport is small, prefer to show myLeft rather than myRight.
    if (myLeft < desiredWinLeft) desiredWinLeft = myLeft;
  }

  // Scroll.
  if (winTop !== desiredWinTop || winLeft !== desiredWinLeft) {
    // IE animates 'html' but not 'body', Chrome vice versa.
    $('html, body').animate({
      'scrollTop': desiredWinTop,
      'scrollLeft': desiredWinLeft
    }, duration, 'swing').queue(function(next) {
      // On my Android phone, `animate` sometimes won't scroll
      // all the way to the desired offset, therefore:
      if (Modernizr.touch)
        helpMobileScroll(desiredWinLeft, desiredWinTop);
      next();
    });
  }

  function helpMobileScroll(left, top) {
    // On my Android phone, calling scrollTop and scrollLeft at the
    // same time *sometimes* does not work (scrollLeft has no effect).
    // So call them again after a while — and call scrollLeft first.
    $('html, body').scrollTop(top).scrollLeft(left);
    setTimeout(function() {
      $('html, body').scrollLeft(left).scrollTop(top);
    }, 250);
  }
  return this;
};


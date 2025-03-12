/**
 * License: The MIT License (MIT)
 * Copyright (C) 2013 Dustan Kasten
 * Parts copyright (C) 2020, 2025 Kaj Magnus Lindberg
 *
 * This is smoothscroll-polyfill but with all polyfill stuff removed, I (KajMagnus) have kept
 * only the smoothScroll function, to keep down the amount of js code.
 *
 * You'll find all source code here: https://github.com/iamdustan/smoothscroll
 *
 * (Don't change the indentation below — keep it 4 spaces so it'll be easier to run a diff
 * against the original.)
 *
 * I added these param:  durationMs,  and onDone,  and  1 pixel = fine (6284AKST4).
 * /KajMagnus
 *
 */
(function(w, d) {
  'use strict';

  /*
   * aliases
   * w: window global object
   * d: document
   */


    // return when scrollBehavior interface is supported
    // NO DON'T — some scroll code & also e2e tests uses window.smoothScroll  /KajMagnus
    // SMALLER_BUNDLE later when all browsers implement smooth scroll behavior, start using it
    // everywhere and remove this smoothscroll-tiny.js file.
    /*
    if ('scrollBehavior' in d.documentElement.style) {
      return;
    }*/

    var SCROLL_TIME = 468;

    /*
     * object gathering original scroll methods
     */
    var original = {
      scroll: w.scroll || w.scrollTo,
    };

    /*
     * define timing method
     */
    var now = w.performance && w.performance.now
      ? w.performance.now.bind(w.performance) : Date.now;

    /**
     * changes scroll position inside an element
     * @method scrollElement
     * @param {Number} x
     * @param {Number} y
     */
    function scrollElement(x, y) {
      this.scrollLeft = x;
      this.scrollTop = y;
    }

    /**
     * returns result of applying ease math function to a number
     * @method ease
     * @param {Number} k
     * @returns {Number}
     */
    function ease(k) {
      return 0.5 * (1 - Math.cos(Math.PI * k));
    }

    /**
     * self invoked function that, given a context, steps through scrolling
     * @method step
     * @param {Object} context
     */
    function step(context) {
      var time = now();
      var value;
      var currentX;
      var currentY;
      var elapsed = (time - context.startTime) / (context.durationMs || SCROLL_TIME);

      // avoid elapsed times higher than one
      elapsed = elapsed > 1 ? 1 : elapsed;

      // apply easing to elapsed time
      value = ease(elapsed);

      currentX = context.startX + (context.x - context.startX) * value;
      currentY = context.startY + (context.y - context.startY) * value;

      // Done scrolling? (6284AKST4) But it's enough to be within 1 pixel, otherwise
      // the scroll animation will run, also if we don't really need to scroll
      //— because seems there's always (?) small floating point differences, e.g.
      // when starting scrolling, we might have:
      //    currentY  = 1132.000000211447
      //    context.y = 1132.78125
      // — then, let's just call onDone directly.
      var distX = Math.abs(currentX - context.x);
      var distY = Math.abs(currentY - context.y);
      if (distX < 1.0 && distY < 1.0) {
        if (context.onDone) {
          context.onDone();
        }
        return;
      }

      // Scroll.
      // (This'll generate another 'scroll' event — so, we can't call `onDone()` until
      // the next animation frame.)
      context.method.call(context.scrollable, currentX, currentY);

      // Continue scrolling until at (context.x, y).  (We never cancel this new frame,
      // because we need to call `onDone()` afterwards.)
      w.requestAnimationFrame(step.bind(w, context));
    }

    /**
     * scrolls window with a smooth behavior
     * @method smoothScroll
     * @param {Object|Node} el
     * @param {Number} x
     * @param {Number} y
     * @param {Number} durationMs — optional
     * @param {Function} onDone — optional
     */
    w.smoothScroll = function(el, x, y, durationMs, onDone) {
      var scrollable;
      var startX;
      var startY;
      var method;
      var startTime = now();

      // define scroll context
      if (el === d.body) {
        scrollable = w;
        startX = w.scrollX || w.pageXOffset;
        startY = w.scrollY || w.pageYOffset;
        method = original.scroll;
      } else {
        scrollable = el;
        startX = el.scrollLeft;
        startY = el.scrollTop;
        method = scrollElement;
      }

      // scroll looping over a frame
      step({
        scrollable: scrollable,
        method: method,
        startTime: startTime,
        startX: startX,
        startY: startY,
        x: x,
        y: y,
        durationMs: durationMs,
        onDone: onDone,
      });
    }

})(window, document);

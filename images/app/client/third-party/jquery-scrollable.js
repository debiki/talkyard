/**
 * jQuery ':scrollable' selector that finds scrollable elements.
 *
 * Copyright (c) 2011 Robert Koritnik
 *
 * Licensed under the terms of the MIT license
 * http://www.opensource.org/licenses/mit-license.php
 *
 * Put together by me, KajMagnus:
 *
 * This file is an excerpt from a certain 'scrollintoview'
 * jQuery plugin by Robert Koritnik. I've extracted this ':scrollable'
 * selector, because I'm using it in more than one of my own
 * plugins, and then it's better that it'd be in a separate file.
 *
 * Please find the original source code here:
 *   https://github.com/litera/jquery-scrollintoview/blob/master/
 *      jquery.scrollintoview.js
 *   Commit: fa1a3e028e66bdf369d5bef02a826747d177de20
 *   Date: Jul 14, 2011
 *
 * /KajMagnus, 2012-02-29
 */

//----------------------------------------
  (function($) {
//----------------------------------------

$.extend($.expr[":"], {
  scrollable: function (element, index, meta, stack) {
    var converter = {
      vertical: { x: false, y: true },
      horizontal: { x: true, y: false },
      both: { x: true, y: true },
      x: { x: true, y: false },
      y: { x: false, y: true }
    };
    var rootrx = /^(?:html)$/i;
    var scrollValue = {
      auto: true,
      scroll: true,
      visible: false,
      hidden: false
    };
    var direction =
        converter[typeof (meta[3]) === "string" && meta[3].toLowerCase()] ||
        converter.both;
    var styles =
        (document.defaultView && document.defaultView.getComputedStyle ?
         document.defaultView.getComputedStyle(element, null) :
         element.currentStyle);
    var overflow = {
      x: scrollValue[styles.overflowX.toLowerCase()] || false,
      y: scrollValue[styles.overflowY.toLowerCase()] || false,
      isRoot: rootrx.test(element.nodeName)
    };

    // check if completely unscrollable (exclude HTML element
    // because it's special)
    if (!overflow.x && !overflow.y && !overflow.isRoot)
      return false;

    var size = {
      height: {
        scroll: element.scrollHeight,
        client: element.clientHeight
      },
      width: {
        scroll: element.scrollWidth,
        client: element.clientWidth
      },
      // check overflow.x/y because iPad (and possibly other tablets)
      // don't dislay scrollbars
      scrollableX: function () {
        return (overflow.x || overflow.isRoot) &&
            this.width.scroll > this.width.client;
      },
      scrollableY: function () {
        return (overflow.y || overflow.isRoot) &&
            this.height.scroll > this.height.client;
      }
    };
    return direction.y && size.scrollableY() ||
        direction.x && size.scrollableX();
  }
});

//----------------------------------------
  })(jQuery);
//----------------------------------------

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list


/* Debiki Utterscroll — dragscroll everywhere, adjusted to run in an <iframe> too.
 * http://www.debiki.com/dev/utterscroll
 *
 * Copyright (c) 2012 - 2013 Kaj Magnus Lindberg (born 1979)
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, see <http://www.gnu.org/licenses/>.
 */

//----------------------------------------
  (function($){
//----------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };

if (!debiki.Utterscroll) debiki.Utterscroll = {};



/**
 * Utterscroll. API:
 *
 * `enable(options)` enables Utterscroll.  Options:
 *  scrollstoppers:
 *    jQuery selectors, e.g. '.CodeMirror, div.your-class'.
 *    Dragging the mouse inside a scrollstopper never results in scrolling.
 *
 * `enable()` (with no options specified) enables Utterscroll and remembers
 *   any option you specified the last time you did specify options.
 *
 * `disable()`
 *
 * `isEnabled()`
 *
 * `isScrolling()` is true iff the user is currently dragscrolling.
 */
debiki.Utterscroll = (function(options) {

  // Don't call console.debug in IE 9 (and 7 & 8); it's not available unless
  // the dev tools window is open. Use this safe wrapper instead of
  // console.log. (COULD make separate Prod and Dev builds, filter out logging)
  var debug = (typeof console === 'undefined' || !console.debug) ?
      function() {} : function() { console.debug.apply(console, arguments); };

  var defaults = {
    defaultScrollstoppers: 'a, area, button, command, input, keygen, label,'+
        ' option, select, textarea, video',  // ?? canvas, embed, object
    scrollstoppers: '',
    onMousedownOnWinVtclScrollbar: function() {},
    onMousedownOnWinHztlScrollbar: function() {},
    onHasUtterscrolled: function() {}
  };

  var enabled;
  var settings;
  var allScrollstoppers;

  var $elemToScroll;
  var startPos;
  var lastPos;

  var hasCoveredIframes = false;


  // Avoids firing onHasUtterscrolled twice.
  var hasFiredHasUtterscrolled = false;
  // We fire onHasUtterscrolled, when the user has scrolled more than this.
  var fireHasUtterscrolledMinDist = 15;  // pixels

  // Helps detect usage of the browser window scrollbars.
  var $viewportGhost =
      $('<div style="width: 100%; height: 100%;' +
        ' position: fixed; top: 0; left: 0; z-index: -999"></div>')
      .appendTo(document.body);

  $(document).mousedown(startScrollPerhaps);
  $(document).mousemove(checkIfMissedMousedown);

  var lastButtons = 0;
  var mousedownNoticed = false;


  /**
   * Firefox bug workaround.
   *
   * When Debiki Utterscroll is used both in an <iframe> and in the parent
   * window, and cooperates via postMessage, then mousedown and mouseup events
   * are sometimes lost, in Firefox 26 (and Kubuntu Linux) at least.
   * This function checks `event.buttons` to find out if a mousedown event was
   * missed, and, if so, starts scrolling.
   */
  function checkIfMissedMousedown(event) {
    if (!enabled)
      return;

    if (lastButtons === 0 && event.buttons === 1 && !mousedownNoticed) {
      // There was a mousedown that we never noticed, because of some browser
      // bug/issue probably related to <iframe>s. So fake a click and perhaps
      // start scrolling.
      lastButtons = event.buttons;
      event.which = 1;
      debug('Mousedown event missed, calling startScroll(event)');
      // We don't know where the mouse was when it was clicked. However since
      // the mousedown event was lost, no text selection has started? And it's
      // better to start scrolling, as far as I've experienced.
      startScroll(event);
      return false;
    }
  };


  function startScrollPerhaps(event) {
    mousedownNoticed = true;

    if (!enabled)
      return;

    // Only left button drag-scrolls.
    if (event.which !== 1 )
      return;

    // Never scroll, when mouse down on certain elems.
    var $target = $(event.target);
    var $noScrollElem = $target.closest(allScrollstoppers);
    if ($noScrollElem.length > 0)
      return;

    // Fire event and cancel, on browser window scrollbar click.
    // - In Chrome, IE and FF, but not in Opera, when you mousedown on
    // a scrollbar, a mousedown event happens.
    // - The subsequent fix (for scrollbars in general) cannot handle the
    // *window* scrollbar case, because the <html> elem can be smaller
    // than the viewport, so checking that the mousedown
    // didn't happen inside the <html> elem won't work. We need
    // $viewportGhost, which always covers the whole viewport.
    if (event.pageX > $viewportGhost.offset().left + $viewportGhost.width()) {
      // Vertical scrollbar mousedown:ed.
      settings.onMousedownOnWinVtclScrollbar();
      return;
    }
    if (event.pageY > $viewportGhost.offset().top + $viewportGhost.height()) {
      // Horizontal scrollbar mousedown:ed.
      settings.onMousedownOnWinHztlScrollbar();
      return;
    }

    // Cancel if scrollbar clicked (other than the browser window scrollbars).
    // - Related: In Chrome, "Scrollbar triggers onmousedown, but fails to
    // trigger onmouseup". (Also mousemove won't happen!)
    // See http://code.google.com/p/chromium/issues/detail?id=14204.
    // - The workaround: Place a wigth & height 100% elem, $ghost,
    // inside $target, and if the mousedown position is not iside $ghost,
    // then the scrollbars were clicked.
    // (What about overflow === 'inherit'? Would anyone ever use that?)
    if ($target.css('overflow') === 'auto' ||
        $target.css('overflow') === 'scroll') {
      // Okay, scrollbars might have been clicked, in Chrome.
      var $ghost = $('<div style="width: 100%; height: 100%; ' +
          'position: absolute;"></div>');
      // Specify top and left, so $ghost fills up the visible part of
      // $target, even if $target contains scrollbars that have been scrolled.
      $ghost.css({ top: $target.scrollTop(), left: $target.scrollLeft() });
      var targetPosOrig = $target.css('position');
      $target.css('position', 'relative');
      $target.prepend($ghost)
      // Now $ghost fills up $target, up to the scrollbars.
      // Check if the click happened outside $ghost.
      var isScrollbar = false;
      if (event.pageX > $ghost.offset().left + $ghost.width())
        isScrollbar = true; // vertical scrollbar clicked, don't dragscroll
      if (event.pageY > $ghost.offset().top + $ghost.height())
        isScrollbar = true; // horizontal scrollbar clicked
      $ghost.remove();
      $target.css('position', targetPosOrig);
      if (isScrollbar)
        return;
    }

    // Find the closest elem with scrollbars.
    // If the ':scrollable' selector isn't available, scroll the window.
    // Also don't scroll `html' and `body' — scroll `window' instead, that
    // works better across all browsers.
    $elemToScroll = $.expr[':'].scrollable ?
        $target.closest(':scrollable:not(html, body)').add($(window)).first() :
        $(window);


    // Scroll, unless the mouse down is a text selection attempt:
    // -----

    // If there's no text in the event.target, then start scrolling.
    var hasText = containsText($target, 0);
    debug(event.target.nodeName +' hasText: '+ hasText);
    if (!hasText)
      return startScroll(event);

    function containsText($elem, recursionDepth) {
      if (recursionDepth > 6)
        return false;
      // Don't use $elem.contents() to loop through all children, because that
      // might result in an "accessing a cross-origin frame" error, for iframes.
      var childNodes = $elem[0].childNodes;
      for (var index = 0; index < childNodes.length; ++index) {
        var child = childNodes[index];
        // Is it a true text node with text?
        // BUG? What about CDATA? Isn't that text? (node type 4)
        if (child.nodeType === 3) {  // 3 is text
          var onlyWhitespace = child.data.match(/^\s*$/);
          if (onlyWhitespace)
            continue;
          else
            return true;
        }
        // Skip comments (or script dies in FF)
        if (child.nodeType === 8)  // 8 is comment
          continue;
        // COULD skip some more node types? Which?
        // And should also test and verify afterwards.

        // Recurse into inline elems — I think they often contain
        // text? E.g. <li><a>...</a></li> or <p><small>...</small></p>.
        var $child = $(child);
        if ($child.css('display') === 'inline') {
          var foundText = containsText($child, recursionDepth + 1);
          if (!foundText)
            continue;
          else
            return true;
        }
        // Here, skip (ignore) block level children. If text in them is to be selected,
        // the user needs to click on those blocks. (Recursing into
        // block level elems could search the whole page, should you
        // click the <html> elem!)
      }
      return false;
    };

    // Start scrolling if mouse press happened not very close to text.
    var dist = distFromTextToEvent($target, event);
    debug('Approx dist from $target text to mouse: '+ dist);
    if (dist === -1 || dist > 55)
      return startScroll(event);

    // Don't scroll and don't event.preventDefault(). — The user should be able
    // to e.g. click buttons and select text.
  };


  /**
   * Finds the approximate closest distance from text in $elem to event.
   */
  function distFromTextToEvent($elem, event) {
    // I don't think there's any built in browser support that helps
    // us to find the distance.
    // Therefore, place many magic marks inside $elem, and check the
    // distance from each mark to the mousedown evenet. Then return
    // the shortest distance.
    // We have no idea where the text line-wraps, so we cannot be
    // clever about where to insert the marks.

    // {{{ Two vaguely related StackOverflow questions.
    //  <http://stackoverflow.com/questions/1589721/
    //      how-can-i-position-an-element-next-to-user-text-selection>
    //  <http://stackoverflow.com/questions/2031518/
    //      javascript-selection-range-coordinates> }}}

    // Add marks to a copy of $elem's inner html.
    var $parent = $elem;
    var innerHtmlBefore = $parent.html();
    var mark = '<span class="utrscrlhlpr"/>';
    // First replace all html tags with a placeholder.
    // (When we add marks, we don't want to add them inside tags.)
    // (It seems any '<' in attribute values have been escaped to '&lt;')
    var savedTags = [];
    var innerHtmlNoTags =
        innerHtmlBefore.replace(/<[^>]*>/g, function($0) {
      savedTags.push($0);
      return '·'; // COULD find a rarer utf-8 char? (Also update TagDog)
    });
    // For now, insert a mark between every two chars. We need frequent
    // marks if the font size is huge. Could check font size of
    // all elems in $target, and reduce num chars between marks.
    // (For one single elem: parseInt($elem.css('font-size')); )
    // But not needed? Performance is fine, on my computer :-)
    var htmlWithMarksNoTags = mark + innerHtmlNoTags.replace(
        /(\s*.{0,2})/g, '$1'+ mark);
    // Put back all html tags.
    var savedTagsIx = 0;
    var htmlWithMarks = htmlWithMarksNoTags.replace(/·/g, function() {
      savedTagsIx += 1;
      return savedTags[savedTagsIx - 1];
    });

    // Clone $parent, and insert the marks into the clone.
    // We won't modify $parent itself — doing that would 1) destroy any
    // text selection object (but other Javascript code might need it),
    // and perhaps 2) break other related Javascript code and event
    // bindings in other ways.
    // {{{ You might wonder what happens if $parent is the <html> and the page
    // is huge. This isn't likely to happen though, because we only run
    // this code for elems that contains text or inline elems with text,
    // and such blocks are usually small. Well written text contains
    // reasonably small paragraphs, no excessively huge blocks of text? }}}
    var $parentClone = $parent.clone();
    $parentClone.html(htmlWithMarks);

    // Replace the parent with the clone, so we can use the clone in
    // distance measurements. But don't remove the parent — that would
    // destroy any text selection.
    // One minor (?) issues/bug:
    //  If the $parent is positioned via CSS like :last-child or
    //  :only-child, that CSS wouldn't be applied to the clone, so distance
    //  measurement might become inaccurate.
    //  Is this unavoidable? We cannot remove the real $parent, or we'd
    //  destroy the text selection (if there is one).
    $parentClone.insertBefore($parent);

    // {{{ Alternative approach
    // Place with 'position: absolute' the clone on the parent.
    //
    // However, if the start of the parent isn't at the parent's upper
    // left corner, word wrapping in the parent and the clone won't be
    // identical. Example:
    //     |text text text text text text text text text text text|
    //     |text text text text text text text<small>parent parent|
    //     |parent parent</small>                                 |
    // If you clone <small> and 'position: absolute' the clone on
    // the original <small>, the clone will have no line wraps,
    // but look like so:
    //     |text text text text text text text text text text text|
    //  —> |<small>parent parent parent parent</small>xt text text|
    //     |parent parent</small>                                 |
    // Possible solution: Find the closest elem with display: block,
    // and clone it. Then word wraps should become identical?
    //
    //$parentClone
    //    .css({
    //      width: $parent.width(),
    //      height: $parent.height(),
    //      position: 'absolute'
    //    })
    //    .insertBefore($parent)
    //    .position({ my: 'left top', at: 'left top', of: $parent });
    //
    // }}}

    // Find mousedown position relative document.
    // (This is supposedly cross browser compatible, see e.g.
    // http://stackoverflow.com/a/4430498/694469.)
    var mouseOffs;
    if (event.pageX || event.pageY) {
      mouseOffs = { x: event.pageX, y: event.pageY };
    }
    else {
      var d = document;
      mouseOffs = {
        x: event.screenX + d.body.scrollLeft + d.documentElement.scrollLeft,
        y: event.screenY + d.body.scrollTop + d.documentElement.scrollTop
      };
    }

    // Find min distance from [the marks inside the clone] to the mouse pos.
    var minDist2 = 999999999;
    $parentClone.find('.utrscrlhlpr').each(function() {
      var myOffs = $(this).offset();
      var distX = mouseOffs.x - myOffs.left;
      var distY = mouseOffs.y - myOffs.top;
      var dist2 = distX * distX + distY * distY;
      if (dist2 < minDist2) {
        minDist2 = dist2;
        // debug('New max dist from: '+ myOffs.left +','+ myOffs.top +
        //  ' to: '+ mouseOffs.x +','+ mouseOffs.y +' is: '+ dist2);
      }
    });

    $parentClone.remove();

    return Math.sqrt(minDist2);
  };


  function startScroll(event) {
    $(document).mousemove(doScroll);
    $(document).mouseup(stopScroll);
    $(document.body).css('cursor', 'move');

    // Y is the distance to the top.
    startPos = { x: event.screenX, y: event.screenY };
    lastPos = { x: event.screenX, y: event.screenY };

    if (d.i.isInIframe)
      window.parent.postMessage(
          JSON.stringify(['startUtterscrolling', cloneEvent(event)]), '*');

    return false;
  };


  function doScroll(event) {
    // Not sure how this can happen — but did happen once, when I clicked a Chrome extension
    // that popped up a dialog, and then I clicked outside the dialog and then suddenly
    // $elemToScroll was undefined (although stopScroll() had *not* been called, because
    // startPost & lastPos etc were *not* undefined).
    if (!$elemToScroll) {
      stopScroll(event);
      return;
    }

    // <iframe> FireFox issue workaround: (FF version 26 on Ubuntu Linux at least)
    // Sometimes the mouseup event never happens, if Debiki runs in an <iframe>.
    // Neither in the <iframe> nor in the parent window. Therefore, detect if the mouse
    // button has actually been released and we should stop scrolling, like so:
    // (And reproduce the issue by opening a HTML page with Debiki embedded
    // comments in Firefox, then open Firebug, and dragscrolling so the
    // mouse enters the Firebug window, then release the mouse and move the
    // mouse back over the html window. Now you'll still be scrolling although
    // you've released the mouse button — were it not for this workaround.)
    if ($.browser && $.browser.mozilla && event.buttons === 0)
      return stopScroll(event);

    if (d.i.isInIframe) {
      // Message to parent sent by other `document.onmousemove`, see the end of
      // this file.
      return;
    }

    // Find movement since mousedown, and since last scroll step.
    var distTotal = {
      x: Math.abs(event.screenX - startPos.x),
      y: Math.abs(event.screenY - startPos.y)
    };
    var distNow = {
      x: event.screenX - lastPos.x,
      y: event.screenY - lastPos.y
    };

    // Sometimes we should scroll in one direction only.
    if ($elemToScroll[0] === window) {
      // $(window).css('overflow-x') and '...-y' results in an error:
      //  "Cannot read property 'defaultView' of undefined"
      // therefore, always scroll, if window viewport too small.
    } else {
      if ($elemToScroll.css('overflow-y') === 'hidden') distNow.y = 0;
      if ($elemToScroll.css('overflow-x') === 'hidden') distNow.x = 0;
    }

    var hasScrolledABit = distTotal.x * distTotal.x + distTotal.y * distTotal.y >
        fireHasUtterscrolledMinDist * fireHasUtterscrolledMinDist;

    if (hasScrolledABit && !hasCoveredIframes) {
      // Don't let iframes steal mouse move events. But don't do this too early because then
      // if the user actually intended to click, the click event might hit the cover instead.
      // (COULD cover only iframes instead, instead of everything.)
      coverIframes();
    }

    // Trigger onHasUtterscrolled(), if scrolled > min distance.
    if (!hasFiredHasUtterscrolled && hasScrolledABit) {
      hasFiredHasUtterscrolled = true;
      settings.onHasUtterscrolled();
    }

    // var origDebug = ' orig: '+ distNow.x +', '+ distNow.y;

    // Scroll faster, if you've scrolled far.
    // Then you can easily move viewport
    // large distances, and still retain high precision when
    // moving small distances. (The calculations below are just
    // heuristics that works well on my computer.)
    // Don't move too fast for Opera though: it re-renders the screen
    // slowly (unbearably slowly if there're lots of SVG arrows!) and
    // the reported mouse movement distances would becom terribly huge,
    // e.g. 1000px, and then the viewport jumps randomly.
    var mul;
    if (distTotal.x > 9){
      mul = Math.log((distTotal.x - 9) / 3);
      if (mul > 1.7 && $.browser && $.browser.opera) mul = 1.7;  // see comment above
      if (mul > 1) distNow.x *= mul;
    }
    if (distTotal.y > 5){
      mul = Math.log((distTotal.y - 5) / 2);
      if (mul > 1.3 && $.browser && $.browser.opera) mul = 1.3;
      if (mul > 1) distNow.y *= mul;
    }

    /*
    debug(
      ' clnt: '+ event.clientX +', '+ event.clientY +
      ' strt: '+ startPos.x +', '+ startPos.y +
      origDebug +
      ' totl: '+ distTotal.x +', '+ distTotal.y +
      ' rslt: '+ distNow.x +', '+ distNow.y);
    */

    if (d.i.isInIframe) {
      window.parent.postMessage(
          JSON.stringify(['doUtterscroll', cloneEvent(event)]), '*');
    }
    else {
      $elemToScroll.scrollLeft($elemToScroll.scrollLeft() - distNow.x);
      $elemToScroll.scrollTop($elemToScroll.scrollTop() - distNow.y);
    }

    lastPos = {
      x: event.screenX,
      y: event.screenY
    };

    return false;
  };


  function stopScroll(event) {
    $elemToScroll = undefined;
    startPos = undefined;
    lastPos = undefined;
    lastButtons = 0;
    mousedownNoticed = false;
    $(document.body).css('cursor', '');  // cancel 'move' cursor
    $.event.remove(document, 'mousemove', doScroll);
    $.event.remove(document, 'mouseup', stopScroll);
    uncoverIframes();

    if (d.i.isInIframe)
      window.parent.postMessage(
          JSON.stringify(['stopUtterscrolling', cloneEvent(event)]), '*');

    return false;
  };


  // When scrolling and dragging the mouse over an iframe, it'll steal the mouse
  // move events. Unless we cover the iframe with something else.
  function coverIframes() {
    $('<div class="utterscroll-iframe-cover" ' +
        'style="z-index:9999999; position: fixed; left: 0; top: 0; bottom: 0; right: 0">')
        .appendTo('body');
    hasCoveredIframes = true;
  };


  function uncoverIframes() {
    $('.utterscroll-iframe-cover').remove();
    hasCoveredIframes = false;
  };


  function cloneEvent(event) {
    // This is all Utterscroll in this <iframe>'s parent window needs.
    return {
      screenX: event.screenX,
      screenY: event.screenY
    };
  };

  // If any iframe parent starts utterscrolling, help it continue scrolling when
  // the mouse is over the iframe, by posting these events to the parent that it
  // can use instead of e.g. the onmousemove event (which goes to the iframe
  // only).
  if (d.i.isInIframe) {
    var origOnMouseMove = document.onmousemove;
    var origOnMouseUp = document.onmouseup;

    document.onmousemove = function(event) {
      window.parent.postMessage(
          JSON.stringify(['onMouseMove', cloneEvent(event)]), '*');
      if (origOnMouseMove)
        return origOnMouseMove(event);
    }

    document.onmouseup = function(event) {
      var returnValue = undefined;
      if (origOnMouseUp)
        returnValue = origOnMouseUp(event);

      window.parent.postMessage(
          JSON.stringify(['stopUtterscrolling', cloneEvent(event)]), '*');
      return returnValue;
    }
  }


  var api = {
    enable: function(options) {
      enabled = true;

      // If no options specified, remember any options specified last time
      // Utterscroll was enabled.
      if (!options && settings)
        return;

      settings = $.extend({}, defaults, options);
      allScrollstoppers = settings.defaultScrollstoppers;
      if (settings.scrollstoppers.length > 0)
        allScrollstoppers += ', '+ options.scrollstoppers;
    },

    disable: function() {
      enabled = false;
    },

    isEnabled: function() {
      return enabled;
    },

    isScrolling: function() {
      return !!startPos;
    }
  };


  return api;
})();

//----------------------------------------
  })(jQuery);
//----------------------------------------

// vim: fdm=marker et ts=2 sw=2 tw=0 list

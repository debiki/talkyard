/*
 * Debiki Utterscroll — dragscroll everywhere
 *
 * Utterscroll enables dragscroll everywhere, on the whole page.
 * Then you can press-and-dragscroll anywhere, instead of
 * using the scrollbars (or scroll wheel — but you usually cannot
 * scroll horizontally with the scroll wheel?).
 * You won't scroll when you click buttons, inputs and links
 * etcetera. And not when you select text.
 *
 *
 * Copyright (c) 2012 Kaj Magnus Lindberg
 *
 * From 2013-06-01 and onwards, licensed under the GNU Lesser General Public
 * License version 3 or any later version:
 *   http://www.gnu.org/licenses/lgpl.txt
 *
 *
 * Use like so: (for example)
 *
 *    <script type='text/javascript' src='debiki-utterscroll.js'></script>
 *
 *    if (!Modernizr.touch)  // if not a smartphone
 *      Debiki.v0.utterscroll({
 *          scrollstoppers: '.CodeMirror, .ui-resizable-handle' });
 *
 *
 * Utterscroll scrolls the closest scrollable element, or the window.
 * However, scrolling anything but the window, depends on a jQuery selector,
 * ':scrollable', being available. (Otherwise, the window is always scrolled.)
 * There should be a file jquery.scrollable.js included in this
 * distribution (which defines the ':scrollable' selector).
 * That file is actually an excerpt from:
 *   https://github.com/litera/jquery-scrollintoview/blob/master/
 *      jquery.scrollintoview.js
 *
 *
 * As of today (2012-02-29), tested with jQuery 1.6.4 and recent versions
 * of Google Chrome, Firefox and Opera, and IE 6, 7, 8 and 9.
 * (Scrolling the window has been tested; scrolling other elems has not
 * been thoroughly tested.)
 *
 * Known issues:
 * - If you start selecting text at the very the end of an element,
 *   then Utterscroll thinks you intend to scroll. So you'll scroll,
 *   rather than selecting text. For more details, search for
 *   "Fixable BUG" in this document.
 *
 *
 * Find in the rest of this file:
 * - jQuery extensions: jQuery.dwEnableSelection and dwDisableSelection
 * - Debiki Utterscroll
 *
 */



// dwEnableSelection and jQuery.dwDisableSelection
// =======================================
// Create a jQuery extension that Enable/Disable text selection.
// — There's a function jQuery.disableSelection, but it won't cancel
// a selection that has already started.
// — There's a jQuery plugin, jquery.disable.text.select.js,
// with creates a function $.fn.disableTextSelect,
// but it's not able to cancel a selection that has already
// started (it doesn't specify -webkit-user-select).
// — Regrettably, in Opera, dwDisableSelection won't cancel any
// current selection.
//----------------------------------------
  (function($) {
//----------------------------------------

$.fn.dwEnableSelection = function() {
  return this.each(function() {  // ?? is `this.each' really needed
    $(this)
        .attr('unselectable', 'off')
        .css({
          'user-select': '',
          '-ms-user-select': '',
          '-moz-user-select': '',
          '-webkit-user-select': '',
          '-o-user-select': '',
          '-khtml-user-select': ''
        })
        .each(function() {  // for IE
          this.onselectstart = function() { return true; };
        });
  });
};

$.fn.dwDisableSelection = function() {
  // This function is based on answers to this question:
  //  <http://stackoverflow.com/questions/2700000/
  //      how-to-disable-text-selection-using-jquery>
  //  namely this answer: <http://stackoverflow.com/a/2700029/694469>
  //  and this: <http://stackoverflow.com/a/7254601/694469>.

  return this.each(function() {  // ?? is `this.each' really needed
    $(this)
        .attr('unselectable', 'on')
        .css({
          'user-select': 'none',
          '-ms-user-select': 'none',
          '-moz-user-select': 'none',
          '-webkit-user-select': 'none',
          '-o-user-select': 'none',
          '-khtml-user-select': 'none'
        })
        .each(function() {  // for IE
          this.onselectstart = function() { return false; };
        });
  });
};

//----------------------------------------
  })(jQuery);
//----------------------------------------



// Debiki-Utterscroll
// =======================================
//----------------------------------------
  (function($){
//----------------------------------------

// (v0 is a namespace version number.)
if (!window.Debiki)
  window.Debiki = { v0: {} };

// Options:
//  scrollstoppers:
//    jQuery selectors, e.g. '.CodeMirror, div.your-class'.
//    Dragging the mouse inside a scrollstopper never results in scrolling.
Debiki.v0.utterscroll = function(options) {

  var defaults = {
    defaultScrollstoppers: 'a, area, button, command, input, keygen, label,'+
        ' option, select, textarea, video',  // ?? canvas, embed, object
    scrollstoppers: '',
    onMousedownOnWinVtclScrollbar: function() {},
    onMousedownOnWinHztlScrollbar: function() {},
    onHasUtterscrolled: function() {}
  };

  var settings = $.extend({}, defaults, options);
  var allScrollstoppers = settings.defaultScrollstoppers;
  if (settings.scrollstoppers.length > 0)
    allScrollstoppers += ', '+ options.scrollstoppers;

  var $elemToScroll;
  var startPos;
  var lastPos;

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


  function startScrollPerhaps(event) {
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
          'position: absolute; top: 0; left: 0;"></div>');
      $target.prepend($ghost)
      // Now $ghost fills up $target, up to the scrollbars.
      // Check if the click happened outside $ghost.
      var isScrollbar = false;
      if (event.pageX > $ghost.offset().left + $ghost.width())
        isScrollbar = true; // vertical scrollbar clicked, don't dragscroll
      if (event.pageY > $ghost.offset().top + $ghost.height())
        isScrollbar = true; // horizontal scrollbar clicked
      $ghost.remove();
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
    var containsText = searchForTextIn($target);
    console.log(event.target.nodeName +' containsText: '+ containsText);
    if (!containsText) {
      startScroll(event);
      return true;
    }

    function searchForTextIn($elem, recursionDepth) {
      if (recursionDepth > 3)
        return false;
      var $textElems = $elem.contents().filter(function(ix, child, ar) {
        // Is it a true text node with text?
        if (child.nodeType === 3) {  // 3 is text
          var onlyWhitespace = child.data.match(/^\s*$/);
          return !onlyWhitespace;
        }
        // Recurse into inline elems — I think they often contain
        // text? E.g. <li><a>...</a></li> or <p><small>...</small></p>.
        var $child = $(child);
        if ($child.css('display') === 'inline') {
          var foundText = searchForTextIn($child, recursionDepth + 1);
          return foundText;
        }
        // Skip block level children. If text in them is to be selected,
        // the user needs to click on those blocks. (Recursing into
        // block level elems could search the whole page, should you
        // click the <html> elem!)
        return false;
      });
      return $textElems.length > 0;
    }

    // Start scrolling if mouse press happened not very close to text.
    var dist = distFromTextToEvent($target, event);
    console.log('Approx dist from $target text to mouse: '+ dist);
    if (dist === -1 || dist > 55) {
      startScroll(event);
      return true;
    }

    // Don't event.preventDefault(). — The user should be able
    // to e.g. click buttons and select text.
  }


  /**
   * Finds the approximate closest distance from text in $elem to event.
   */
  function distFromTextToEvent($elem, event) {
    // I don't think there's any built in browser support that helps
    // us to find the distance.
    // Therefore, place magic marks inbetween words, and check the
    // distance from each mark to the mousedown evenet. Then return
    // the shortest distance.
    // We have no idea where the text line wraps, so we cannot be
    // clever about where we insert the marks.

    // {{{ Two vaguely related StackOverflow questions.
    //  <http://stackoverflow.com/questions/1589721/
    //      how-can-i-position-an-element-next-to-user-text-selection>
    //  <http://stackoverflow.com/questions/2031518/
    //      javascript-selection-range-coordinates> }}}

    var $parent = $elem;
    var innerHtmlBefore = $parent.html();

    // Clone $parent, and insert into the clone an invisible magic <a/>
    // after each word, but not inside <tags>.
    // We won't modify $parent itself — doing that would 1) destroy
    // the selection object (but other Javascript code might need it),
    // and perhaps 2) break other related Javascript code and event
    // bindings in other ways.
    // {{{ You might wonder what happens if $parent is the <html> and the page
    // is huge. This isn't likely to happen though, because we only run
    // this code for elems that contains text or inline elems with text,
    // and such blocks are usually small. Well written text contains
    // reasonably small paragraphs, no excessively huge blocks of text. }}}
    var mark = '<a class="utrscrlhlpr"/>';

    // Explanation of below regex:
    //   ((<[^>]+>)*)    Match consecutive tags
    //     ([^<]*?)(\s)  Match one word (*? is non-greedy) and a whitespace.
    //                     But fail if new tag starts.
    // Explanation of the space appended to innerHtmlBefore:
    //   Without it, if innerHtmlBefore ends with e.g. the text
    //   '<a attr>', that text won't match the regex. So the engine
    //   drops '<' and tests with 'a attr>' instead and finds a match,
    //   and inserts a mark inside the tag (bad!).
    //   Fix this, by appending a space that changes '<a attr>'
    //   to  '<a attr> ' which matches directly.
    // BUG: If there's any  <a attr>nospace</a>, then the same situation
    // arises (as with no end ' ' and the regex inserts a tag in the <a attr>.
    // However this is somewhat :-) because we're *inside* the tag with lots
    // of text nearby, so we'll find some text anyway close to the mouse.
    // REAL SOLUTION?: Replace all tags with placeholders. Then add marks.
    // Then put back tags. That is, apply 3 regexs not just 1.
    var htmlWithMarks = (innerHtmlBefore + ' ').replace(
        /((<[^>]+>)*)([^<]*?)(\s)/g, '$1$3'+ mark + '$4');
    var htmlWithMarks = mark + htmlWithMarks;
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
    //  destroy the selection.
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
        x: event.clientX + d.body.scrollLeft + d.documentElement.scrollLeft,
        y: event.clientY + d.body.scrollTop + d.documentElement.scrollTop
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
        // console.log('New max dist from: '+ myOffs.left +','+ myOffs.top +
        //  ' to: '+ mouseOffs.x +','+ mouseOffs.y +' is: '+ dist2);
      }
    });

    $parentClone.remove();

    return Math.sqrt(minDist2);
  }


  function startScroll(event) {
    $(document).mousemove(doScroll);
    $(document).mouseup(stopScroll);
    $(document.body).css('cursor', 'move');

    // Y is the distance to the top.
    startPos = { x: event.clientX, y: event.clientY };
    lastPos = { x: event.clientX, y: event.clientY }; 

    // Don't select text whilst dragging.
    // It's terribly annoying if scrolling results in selecting text.
    // Emptying the selection from doScroll results in a
    // flickering fledgling selection. (The selection starts, is
    // emptied, starts again, is emptied, and so on.) So disable
    // selections completely. — But don't use jQuery's disableSelection,
    // because it won't cancel an already existing selection. (There might
    // be one, because if you keep the mouse button down for a while,
    // on text (then the browser thinks you have selected an empty string),
    // without moving the mouse, then you start scrolling.)
    $(document.body).dwDisableSelection();
    // (If doesn't work, could try:  $(document.body).focus()?
    // see: http://stackoverflow.com/questions/113750/ )
    emptyWindowSelection();
  }

  function doScroll(event) {
    // Find movement since mousedown, and since last scroll step.
    var distTotal = {
      x: Math.abs(event.clientX - startPos.x),
      y: Math.abs(event.clientY - startPos.y)
    };
    var distNow = {
      x: event.clientX - lastPos.x,
      y: event.clientY - lastPos.y
    };

    // Trigger onHasUtterscrolled(), if scrolled > min distance.
    if (!hasFiredHasUtterscrolled &&
        (distTotal.x * distTotal.x + distTotal.y * distTotal.y >
        fireHasUtterscrolledMinDist * fireHasUtterscrolledMinDist)) {
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
      if (mul > 1.7 && $.browser.opera) mul = 1.7;  // see comment above
      if (mul > 1) distNow.x *= mul;
    }
    if (distTotal.y > 5){
      mul = Math.log((distTotal.y - 5) / 2);
      if (mul > 1.3 && $.browser.opera) mul = 1.3;
      if (mul > 1) distNow.y *= mul;
    }

    /*
    console.log(
      ' clnt: '+ event.clientX +', '+ event.clientY +
      ' strt: '+ startPos.x +', '+ startPos.y +
      origDebug +
      ' totl: '+ distTotal.x +', '+ distTotal.y +
      ' rslt: '+ distNow.x +', '+ distNow.y);
    */

    $elemToScroll.scrollLeft($elemToScroll.scrollLeft() - distNow.x);
    $elemToScroll.scrollTop($elemToScroll.scrollTop() - distNow.y);

    lastPos = {
      x: event.clientX,
      y: event.clientY
    };

    // In Opera, dwDisableSelection doesn't clear any existing selection.
    // So clear the selection each scroll step instead. (It's very
    // annoying if you select text when you scrolldrag.)
    if ($.browser.opera)
      emptyWindowSelection();
  }

  function stopScroll(event) {
    $elemToScroll = undefined;
    startPos = undefined;
    lastPos = undefined;
    $(document.body).dwEnableSelection();
    $(document.body).css('cursor', '');  // cancel 'move' cursor
    $.event.remove(document, 'mousemove', doScroll);
    $.event.remove(document, 'mouseup', stopScroll);

    // On mousedown, `false' was perhaps not returned, so we should probably
    // *not* return false here? Anyway, if we `return false', Opera sometimes
    // won't clear an existing selection. Result: Many disjoint sections
    // coexisting at the same time. Only Opera — an Opera bug? That
    // bug happens now too, without `return false', hmm.
    // But the bug happens infrequently, it's a fairly harmless issue I think.
  }

  function emptyWindowSelection() {
    // Based on <http://groups.google.com/group/jquery-ui-layout/
    //    browse_thread/thread/875b5f2ae68821b6>
    if (window.getSelection) {
      if (window.getSelection().empty) {
        // Chrome
        window.getSelection().empty();
      } else if (window.getSelection().removeAllRanges) {
        // Old FF versions?
        window.getSelection().removeAllRanges();
      }
    } else if (document.selection) {
      // IE
      document.selection.empty();
    }
  }

};

//----------------------------------------
  })(jQuery);
//----------------------------------------

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

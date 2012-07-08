/**
 * Debiki Utterscroll — dragscroll everywhere
 *
 * Copyright (c) 2012 Kaj Magnus Lindberg. All rights reserved.
 *
 * Find in the rest of this file:
 * - jQuery extensions: jQuery.dwEnableSelection and dwDisableSelection
 *     (Hmm perhaps they can be removed now, when I stop event propagation
 *     early, so no text is ever selected, if you start scrolling.
 *     Everything should work anyway, but I'd get rid of some code.)
 * - Debiki Utterscroll
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



// Debiki Utterscroll
// =======================================
//----------------------------------------
  (function($){
//----------------------------------------

if (!window.debiki) window.debiki = {};
if (!debiki.Utterscroll) debiki.Utterscroll = {};

/**
 * Enables Utterscroll.
 *
 * Options:
 *  scrollstoppers:
 *    jQuery selectors, e.g. '.CodeMirror, div.your-class'.
 *    Dragging the mouse inside a scrollstopper never results in scrolling.
 */
debiki.Utterscroll.enable = function(options) {

  // Don't call console.debug in IE 9 (and 7 & 8); it's not available unless
  // the dev tools window is open. Use this safe wrapper instead of
  // console.log. (COULD make separate Prod and Dev builds, filter out logging)
  var debug = (typeof console === 'undefined' || !console.debug) ?
      function() {} : function() { console.debug.apply(console, arguments); }

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
    var containsText = searchForTextIn($target, 0);
    debug(event.target.nodeName +' containsText: '+ containsText);
    if (!containsText)
      return startScroll(event);

    function searchForTextIn($elem, recursionDepth) {
      if (recursionDepth > 6)
        return false;
      var $textElems = $elem.contents().filter(function(ix, child, ar) {
        // Is it a true text node with text?
        // BUG? What about CDATA? Isn't that text? (node type 4)
        if (child.nodeType === 3) {  // 3 is text
          var onlyWhitespace = child.data.match(/^\s*$/);
          return !onlyWhitespace;
        }
        // Skip comments (or script dies in FF)
        if (child.nodeType === 8)  // 8 is comment
          return false;
        // COULD skip some more node types? Which?
        // And should also test and verify afterwards.

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
    debug('Approx dist from $target text to mouse: '+ dist);
    if (dist === -1 || dist > 55)
      return startScroll(event);

    // Don't scroll and don't event.preventDefault(). — The user should be able
    // to e.g. click buttons and select text.
  }


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
      return '·'; // TODO find a rarer utf-8 char? (Also update TagDog)
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
        // debug('New max dist from: '+ myOffs.left +','+ myOffs.top +
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
    return false;
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
    debug(
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

    return false;
  }

  function stopScroll(event) {
    $elemToScroll = undefined;
    startPos = undefined;
    lastPos = undefined;
    $(document.body).dwEnableSelection();
    $(document.body).css('cursor', '');  // cancel 'move' cursor
    $.event.remove(document, 'mousemove', doScroll);
    $.event.remove(document, 'mouseup', stopScroll);
    return false;
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

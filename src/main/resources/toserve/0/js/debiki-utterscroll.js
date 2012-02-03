/*
 * Debiki Utterscroll — dragscroll everywhere
 *
 * Utterscroll enables dragscroll everywhere, on the whole page.
 * Then you can press-and-dragscroll anywhere, instead of
 * using the awkward scrollbars.
 * But you won't scroll when you click buttons, inputs and links
 * etcetera. And not when you select text.
 *
 *
 * Copyright (c) 2012 Kaj Magnus Lindberg
 *
 * From 2013-06-01 and onwards, dual licensed under the MIT and GPL licenses:
 *   http://www.opensource.org/licenses/mit-license.php
 *   http://www.gnu.org/licenses/gpl.html
 *
 *
 * Use like so: (for example)
 *
 *    <script type='text/javascript' src='debiki-utterscroll.js'></script>
 *
 *    if (!Modernizr.touch)  // if not a smartphone
 *      Debiki.v0.utterscroll({ scrollstoppers: '.CodeMirror' });
 *
 *
 * As of today (2012-02-03), tested with jQuery 1.6.4 and Google Chrome
 * and a recent version of Firefox.
 * Never tested with IE 6.
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
    defaultScrollstoppers: 'a, area, button, command, input, keygen,'+
        ' option, select, textarea, video',  // ?? canvas, embed, object
    scrollstoppers: ''
  };

  var settings = $.extend({}, defaults, options);
  allScrollstoppers = settings.defaultScrollstoppers;
  if (settings.scrollstoppers.length > 0)
    allScrollstoppers += ', '+ options.scrollstoppers;

  var startPos = null;
  var lastPos = null;
  var tryLaterHandle = null;
  $(document).mousedown(startScrollPerhaps);
  $(document).mouseup(clearTryLaterCallback)

  function clearTryLaterCallback() {
    if (!tryLaterHandle) return;
    clearTimeout(tryLaterHandle);
    tryLaterHandle = null;
  }

  function startScrollPerhaps(event) {
    // Only left button drag-scrolls.
    if (event.which !== 1 )
      return false;

    // Never scroll, when mouse down on certain elems.
    var $noScrollElem = $(event.target).closest(allScrollstoppers);
    if ($noScrollElem.length > 0)
      return true;

    // Scroll, unless the mouse down is a text selection attempt:
    // -----

    // If there's no text in the event.target, then start scrolling.
    // Disregard whitespace "text" though.
    var textElems = $(event.target).contents().filter(function(ix, elem, ar) {
      if (elem.nodeType !== 3)  // is it a text node?
        return false;
      if (elem.data.match(/^[ \t\r\n]*$/))  // is it whitespace?
        return false;
      return true;  // it is real text
    });
    if (textElems.length === 0) {
      startScroll(event);
      event.preventDefault();
      /*
      console.log('$(event.target).contents(): ---------------');
      console.log($(event.target).contents());
      console.log('-------------------------------------------');
      */
      return false;
    }

    // window.getSelection is missing in IE 7 and 8 — so we don't know
    // if the user clicked text. Don't scroll then, for now.
    // COULD check some MS specific selection functions instead.
    // document.selection?
    if (!window.getSelection)
      return true;

    // Also start scrolling unless the user clicks text:
    // Test with window.getSelection — but right now, in this *mousedown*
    // handler, window.getSelection returns no selection. After
    // a while though, the browser seems to always return a selection
    // if the cursor is on text.
    setTimeout(function() {
      startScrollUnlessMightSelectText(event);
    }, 0);

    // If the user selects no text, but just holds down the mouse
    // button, then start scrolling. — This enable scrolldrag
    // also on pages almost covered with text.
    tryLaterHandle = setTimeout(function() {
      // (Would be better to use the mouse pos as of the timeout,
      // not the original mousedown? To avoid that the screen jumps
      // if you've moved the mose.)
      startScrollUnlessHasSelectedText(event);
    }, 300);

    // Don't event.preventDefault(). — The user should be able
    // to e.g. click buttons and select text.
    return true;
  }

  // Starts scrolling unless the user is selecting text.
  function startScrollUnlessMightSelectText(event) {
    // This happens a tiny while after the mousedown event, and now
    // the browser knows if any text is selected/mouse-down:ed.
    var sel = window.getSelection();
    /*
    console.log('startScrollUnlessMightSelectText:\n sel: ');
    console.log(sel);
    console.log('sel.anchorNode: ');
    console.log(sel.anchorNode);
    */
    if (!sel.anchorNode || !sel.anchorNode.data ||
        sel.anchorNode.data.substr(sel.anchorOffset, 1).length === 0) {
      /*
      if (sel.anchorNode) {
        console.log('sel.anchorNode.data:');
        console.log(sel.anchorNode.data);
      }
      console.log('No text under cursor');
      */
      // No text under mouse cursor. The user probably doesn't try to
      // select text, and no other elem has captured the event.
      startScroll(event);
      clearTimeout(tryLaterHandle);
    } else {
      // The user might be selecting text to copy to the clipboard.
      // Don't scroll.
      return; //breakpoint
    }
  }

  // Starts scrolling, unless already scrolling, and unless the user
  // has selected text.
  function startScrollUnlessHasSelectedText(event) {
    if (startPos) return; // already scrolling
    var selectedText = window.getSelection().toString();
    if (selectedText.length > 0)
      return;
    startScroll(event);
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

    window.scrollTo(
        $(window).scrollLeft() - distNow.x,
        $(window).scrollTop() - distNow.y);

    lastPos = {
      x: event.clientX,
      y: event.clientY
    };

    event.preventDefault();
    return false;
  }

  function stopScroll(event) {
    startPos = null;
    lastPos = null;
    clearTryLaterCallback();
    $(document.body).dwEnableSelection();
    $(document.body).css('cursor', '');  // cancel 'move' cursor
    $.event.remove(document, 'mousemove', doScroll);
    $.event.remove(document, 'mouseup', stopScroll);
    event.preventDefault();
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

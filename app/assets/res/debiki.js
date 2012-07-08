/* Copyright (c) 2010 - 2012 Kaj Magnus Lindberg. All rights reserved. */

// In this file:
// - jQuery extension functions, prefixed with "dw" to avoid name clashes
// - The implementation of the Debiki module
// - A jQuery onload handler

// Google Closure Linter: Run like so:
//  gjslint src/main/resources/toserve/js/debiki.js | egrep -v 'E:0002:'

/*{{{ Bug avoidance notes

For an <a>, use this.hash not $(this).attr('href'), because in IE 7
attr() prepends 'http://server/.../page' to the href.  Related:
  http://goo.gl/OF16Q  — the JavaScript Bible page 603
  http://webmasters.stackexchange.com/questions/20621/
                    okay-to-use-the-hash-dom-node-property

}}}*/
/* {{{ Misc naming notes

 dwCoSid:
  "dw" is a prefix, avoids name clashes.
  "Co" means "Cookie".
  "Sid" is the cookie name.

 dwEvLoggedInOut:
  "Ev" means "event".
  "LoggedInOut" is the event.

 So you can do: grep dwCo, grep dwEv

 HTML5 data attributes names:  ??
 Like the CSS class names, but underscore not hyphen, so as to aovid
 uppercase/hyphen conversion. (E.g. 'data-variable-name' is converted to
 variableName (no hyphen, uppercase 'N'), and back, according to the html5
 spec: <http://www.w3.org/TR/html5/elements.html#
          embedding-custom-non-visible-data-with-the-data-attributes>
 Using underscoer ensures the data names in the html doc matches
 the names in the Javascript source code which avoids confusion.
 Example:  zd_t_id  means:  folded (zd, 'z' is fold)  thread (t)  id (id).
 But don't use:  zd-t-id, that'd be converted to 'zdTId' I think.
 If the data is only set and read via Javascript (never serialized to html),
 then please use 'dwDataName' (then you know you need only consider the
 javascript files (this file) should you want to rename it).)

 Let names of functions that return a jQuery object end with $.
 Let names of functions that should be passed to jQuery.each start with $.
 Let jQuery objects start with $.
 Currently jQuery extensions are prefixed by 'dw', e.g. $post.dwAuthorId().
 Example:
   var $header = getPostHeader$(postId);
   $header.each($doSomething);

}}}*/

var html_sanitizer_bundle =
    require('html_sanitizer_bundle') ||  // prod builds
    { googleCajaSanitizeHtml: googleCajaSanitizeHtml };  // dev builds

if (!window.debiki) window.debiki = {};
if (!debiki.v0) debiki.v0 = {};
if (!debiki.internal) debiki.internal = {};


//========================================
   (function(){
//========================================
"use strict";

var UNTESTED; // Indicates that a piece of code has not been tested.

//----------------------------------------
//  Helpers
//----------------------------------------

var KEYCODE_ENTER = 13;
var KEYCODE_ESC = 27;
var VIEWPORT_MIN_WIDTH = 320; // okay with Modern Android and iPhone mobiles

function trunc(number) {
  return number << 0;  // bitwise operations convert to integer
}

function isBlank(str) {
  return !str || !/\S/.test(str);
  // (!/\S/ is supposedly much faster than /^\s*$/,
  // see http://zipalong.com/blog/?p=287)
}

// Converts markdown to sanitized html.
function markdownToSafeHtml(markdownSrc, hostAndPort, sanitizerOptions) {
  var htmlTextUnsafe = markdownToUnsafeHtml(markdownSrc, hostAndPort);
  var htmlTextSafe = sanitizeHtml(htmlTextUnsafe, sanitizerOptions);
  return htmlTextSafe;
}

function markdownToUnsafeHtml(markdownSrc, hostAndPort) {
  var converter = new Showdown.converter();
  var htmlTextUnsafe = converter.makeHtml(markdownSrc, hostAndPort);
  return htmlTextUnsafe;
}

/**
 * Calls Google Caja JsHtmlSanitizer to sanitize the html.
 *
 * options.allowClassAndIdAttr = true/false
 * options.allowDataAttribs = true/false
 */
function sanitizeHtml(htmlTextUnsafe, options) {
  var htmlTextSafe = html_sanitizer_bundle.googleCajaSanitizeHtml(
      htmlTextUnsafe, options.allowClassAndIdAttr, options.allowDataAttr);
  return htmlTextSafe;
}

// Converts an ISO 8601 date string to a milliseconds date since 1970,
// and handles MSIE 7 and 8 issues (they don't understand ISO strings).
function isoDateToMillis(dateStr) {
  if (!dateStr) return NaN;
  // For IE 7 and 8, change from e.g. '2011-12-15T11:34:56Z' to
  // '2011/12/15 11:34:56Z'.
  if (jQuery.browser.msie && jQuery.browser.version < '9') {
    dateStr = dateStr.replace('-', '/').replace('T', ' ');
  }
  return Date.parse(dateStr);
}

/**
 * Creates dummy console.log etcetera functions, if console.log doesn't
 * exist. Otherwise scripts break in IE (IE9 at least), where there is
 * no console.log unless the dev tools window has been opened (click F12).
 * Some scripts (e.g. jQuery UI) actually make calls to console.log
 * in release builds, so I cannot simply remove all calls to console.log.
 */
if (typeof console === 'undefined' || !console.log) {
  window.console = {
    debug: function() {},
    trace: function() {},
    log: function() {},
    info: function() {},
    warn: function() {},
    error: function() {}
  };
}


//----------------------------------------
// jQuery object extensions
//----------------------------------------


(function() {
  jQuery.fn.dwDisable = function() {
    return _dwEnableDisableImpl(this, true);
  };

  jQuery.fn.dwEnable = function() {
    return _dwEnableDisableImpl(this, false);
  };

  function _dwEnableDisableImpl(self, disabled) {
    // (Radio buttons and checkboxes have the
    // .ui-helper-hidden-accessible class – jQuery UI places
    // .ui-button on the related <label>, not the <input>.)
    if (self.filter('input, button')
        .is('.ui-button, .ui-helper-hidden-accessible'))
      self.button('option', 'disabled', disabled);
    else self.prop('disabled', disabled);
    return self;
  }
})();


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


//----------------------------------------
// Customizable functions: Default implementations
//----------------------------------------

var Settings = {};

Settings.makeRatePostUrl = function(debateId, rootPostId, postId) {
  // Default:
  // (Firefox doesn't accept an Ajax post request "" (i.e. the same page);
  // nsIXMLHttpRequest.open fails with NS_ERROR_ILLEGAL_VALUE.)
  return '?';
};

Settings.replyFormLoader = function(debateId, rootPostId, postId, complete) {
  // Simply clone a hidden reply form template.
  var $replyForm = jQuery('#dw-hidden-templates .dw-fs-re').clone(true);
  complete($replyForm);
};

Settings.replyFormSubmitter = function(debateId, rootPostId, postId) {
  // By default, post no reply.
  alert("Cannot post reply. [error DwE85ei23rnir]");
};

Settings.editFormLoader = function(debateId, postId, complete) {
  alert('Edits not implemented. [error DwE239sx8]');
};

Settings.editFormSubmitter = function($form, debateId, rootPostId,
    postId, complete) {
  // By default, post no reply.
  alert("Edits not implemented. [error DwE19x3g35]");
};


//----------------------------------------
// Customizable functions: Export setters
//----------------------------------------

debiki.v0.setRatePostUrl = function(urlBuilder) {
  Settings.makeRatePostUrl = urlBuilder;
};

debiki.v0.setReplyFormLoader = function(loader) {
  Settings.replyFormLoader = loader;
};

debiki.v0.setReplyFormSubmitter = function(submitter) {
  Settings.replyFormSubmitter = submitter;
};

debiki.v0.setEditFormLoader = function(loader) {
  Settings.editFormLoader = loader;
};

debiki.v0.setEditFormSubmitter = function(submitter) {
  Settings.editFormSubmitter = submitter;
};


// Onload
//----------------------------------------
   jQuery.noConflict()(function($){
//----------------------------------------

// ------- Export functions

// Shows all comments, which should have been hidden via the
// DebateHtml$ hideCommentsStyle, in html.scala.
// Only do this if the article itself is shown though.
debiki.v0.showInteractionsOnClick = function() {
  // Always show comments if the page body is not the root post.
  // (That is, if the article isn't shown, but a plain comment.
  // Otherwise people could create "fake" pages, by creating 
  // a comment and linking it with ?view=<comment-id> and it would
  // seem to be a page itself!)
  if ($('.dw-ar-p').length === 0) {  // article post not present?
    $('html').removeClass('dw-hide-interactions');
    return;
  }

  var numComments = $('.dw-p').length - 1;  // don't count the article
  if ($('.dw-p-ttl').length) numComments -= 1; // don't count article title
  var text = numComments > 1 ?  'Visa '+ numComments +' kommentarer' : // i18n
     (numComments == 1 ?  'Visa 1 kommentar' : 'Lämna en kommentar');
  var $showBtn = $(
      '<div class="dw-as dw-hor-a">' +
      '<a class="dw-a dw-a-show-interactions"></a></div>');
  $showBtn.find('a')
      .text(text)  // xss safe
      .css('font-size', '80%')
      .end()
      .insertBefore('.dw-ar-t > .dw-res')
      .click(function() {
    $showBtn.remove();
    $('html').removeClass('dw-hide-interactions');
    SVG.drawEverything(); // *sometimes* needed
  });
};

function showInteractionsIfHidden() {
  // If they're hidden, there's a button that shows them.
  $('.dw-a-show-interactions').click();
}


// ------- Variables

var internal = debiki.internal;

// Debiki convention: Dialog elem tabindexes should vary from 101 to 109.
// HTML generation code assumes this, too. See Debiki for Developers, #7bZG31.
var DEBIKI_TABINDEX_DIALOG_MAX = 109;

var diffMatchPatch = new diff_match_patch();
diffMatchPatch.Diff_Timeout = 1; // seconds
diffMatchPatch.Match_Distance = 100*1000; // for now

var didResize = false;
// Set to true if a truncated post was clicked and expanded.
var didExpandTruncated = false;

var rateFormTemplate = $("#dw-hidden-templates .dw-fs-r");
var debateId = $('.debiki').attr('id');

var rootPostId = $('.dw-depth-0');
rootPostId = rootPostId.length ?
    rootPostId.attr('id').substr(5) : undefined; // drops initial `dw-t-'

// When forms are loaded from the server, they might have ID fields.
// If the same form is loaded twice (e.g. to reply twice to the same comment),
// their ids would clash. So their ids are made unique by appending a form no.
var idSuffixSequence = 0;

var $lastInlineMenu = $();

// Remembers which .dw-loginsubmit-on-click button (e.g. "Post as...")
// was clicked when a login dialog is shown.
var loginOnClickBtnClicked = null;

// True iff the user is to be asked whether or not s/he wants to be
// notified via email e.g. of replies.
var continueLoginAskAboutEmail = false;

// Reset all per click state variables when a new click starts.
$.event.add(document, "mousedown", function() {
  didExpandTruncated = false;
  //didResize = false; -- currently handled in another mousedown
});

// If there's no SVG support, we'll use images instead.
var nativeSvgSupport = Modernizr.inlinesvg;

var SVG = nativeSvgSupport && document.URL.indexOf('svg=false') === -1 ?
    makeSvgDrawer() : makeFakeDrawer();

var svgns = "http://www.w3.org/2000/svg";

var Me = makeCurUser();



// ------- Android zoom bug workaround

/**
 * Works around an Android viewport dimension bug. Call on
 * page load. Also, perhaps the viewport's initial-scale must be 1.0.
 *
 * The bug: On text input focus, Android auto zooms that text input.
 * But when auto zooming, Android won't update these viewport dimension
 * related values:  (they're unchanged, as if still zoomed out)
 * screen.width and height, window.innerWidth and innerHeight,
 * document.documentElement.clientWidth and clientHeight,
 * window.pageXOffset and pageYOffset.
 *
 * The workaround: Whenever a text input is focused, reset zoom
 * to 1.0. Then all above values are updated correctly, by Android.
 * When zoom has been reset (this might take some 100 ms), scroll back
 * to the focused text input.
 * Here I found info on an (the?) Android bug:
 *   http://code.google.com/p/android/issues/detail?id=10775#c26
 *   By stephen....@carisenda.com, Jun 27, 2011
 *   "innerWidth is reported incorrectly after a page zoom on some but
 *   not all devices running Android, it seems to be device rather than
 *   android version dependent. For example the bug appears in Samsung Galaxy S
 *   and Tab but not on HTC Evo or Hero (this is after adding in a viewport
 *   meta tag (see comment 20))."
 *   (Without the viewport meta tag, viewport dimenstions are *always*
 *   wrong on my Android (and some of theirs).)
 */
function workAroundAnyAndroidZoomBug() {

  // Cancel if not Android, or if bug fixed in this Android version.
  var androidVersion = window.navigator.userAgent.match(/Android\s+([\d\.]+)/);
  if (!androidVersion) return;
  androidVersion = androidVersion[1];
  // Should find out in which versions the bug is present:
  // if (androidVersion == ... || androidVersion > ...) return;

  // Remember window dimensions, initially when the viewport's initial-scale
  // is 1.0. Then we can work around certain Android bugs later.
  var windowInnerWidthUnscaled = window.innerWidth;
  var windowInnerHeightUnscaled = window.innerHeight;

  // Returns a $.Deferred, and resolves it when zoom has been reset
  // (or somewhat later). However if zoom hasn't been reset after
  // a while, rejects the $.Deferred.
  function resetMobileZoom() {
    var resetStatus = $.Deferred();

    if (!Modernizr.touch || isZoomReset())
      return resetStatus.resolve();

    console.debug('Resetting zoom to initial-scale=1.0...');
    $('meta[name=viewport]').attr('content',
       'initial-scale=1.0, maximum-scale=0.05');

    var pollHandle = setInterval(pollZoomResolveStatus, 100);
    pollZoomResolveStatus();

    // If zoom not reset within two seconds, something is amiss?
    var failHandle = setTimeout(function() {
      resetStatus.reject();
      clearInterval(pollHandle);
      console.debug('Cancelled zoom reset polling.');
    }, 2000);

    function pollZoomResolveStatus() {
      if (!isZoomReset()) return;
      console.debug('Zoom has been reset.');
      resetStatus.resolve();
      clearInterval(pollHandle);
      clearTimeout(failHandle);
    }

    return resetStatus;
  }

  // Returns true if zoom has been, or need not be, reset.
  function isZoomReset() {
    // If portrait orientation initially, and portrait now, or if
    // landscape initially, landscape now, then, when zoom reset:
    //   window.innerWidth === windowInnerWidthUnscaled
    //   window.innerHeight === windowInnerHeightUnscaled
    //   — however, don't require that heights match,
    //   because sometimes the width isn't scaled, but only the
    //   height — and then it's better not to reset zoom, because
    //   resetting zoom causes the viewport to move to 0,0 and
    //   when dwScrollIntoView scrolls back again, everything looks
    //   jerky.
    // If portrait initially, but landscape now, or
    // landscape initially, but portrait now:
    //   window.innerWidth === windowInnerHeightUnscaled
    //   window.innerHeight === windowInnerWidthUnscaled
    return (window.innerWidth === windowInnerWidthUnscaled) ||
      (window.innerWidth === windowInnerHeightUnscaled &&
        window.innerHeight === windowInnerWidthUnscaled);
  }

  $(document).on('focus', 'textarea, input[type=text]', function() {
    console.log('');
    var $input = $(this);
    if (!isZoomReset()) resetMobileZoom().done(function() {
      // $input.blur().focus() won't scroll $input into view on my Android.
      $input.dwScrollIntoView(
          { marginRight: 20, marginBottom: 100, duration: 0 });
    });
  });
}



// ------- Zoom event

var zoomListeners = [];
var zoomListenerHandle_dbg;

(function(){
  // Poll the pixel width of the window; invoke zoom listeners
  // if the width has been changed.
  var lastWidth = 0;
  function pollZoomFireEvent() {
    var i;
    var widthNow = jQuery(window).width();
    if (lastWidth === widthNow) return;
    lastWidth = widthNow;
    // Length changed, user must have zoomed, invoke listeners.
    for (i = zoomListeners.length - 1; i >= 0; --i) {
      zoomListeners[i]();
    }
  }
  zoomListenerHandle_dbg = setInterval(pollZoomFireEvent, 100);
}());


// ------- jQuery dialogs

/**
 * Debiki's default jQuery UI dialog settings.
 */
var jQueryDialogDefault = {
  autoOpen: false,
  autoResize: true,
  modal: true,
  resizable: false,
  // Should use CSS instead of this, but for now:
  width: VIEWPORT_MIN_WIDTH - 20, // ok with modern mobiles
  zIndex: 1190,  // the default, 1000, is lower than <form>s z-index

  /**
   * Adds tabindex to any jQuery buttons, if needed (if any elem
   * in the dialog already has tabindex).
   *
   * And fixes two issues I (KajMagnus) am encountering on my Android phone:
   * 1) The dialog appears outside the <html> elem. — If so, move it to
   * inside the <html> elem (or parts of it will never be visible).
   * 2) Sometimes the dialog does not appear inside the viewport, or
   * only parts of the dialog appear inside the viewport. — If so,
   * scroll the dialog's upper left corner into view.
   *
   * (Might as well run this code on desktop browsers too — simplifies
   * debugging, if nothing else.)
   */
  open: function(event, ui) {
    var $dialog = $(event.target);
    var $dialogFrame = $dialog.parent();

    // If stuff in this dialog is tabbable, add tabindex to any OK and
    // Cancel buttons, or they won't be tabbable.
    if ($dialog.find('[tabindex]:enabled:visible')) {
      $dialog.find('.ui-dialog-buttonpane .ui-button')
          .attr('tabindex', DEBIKI_TABINDEX_DIALOG_MAX);
    }

    // Move dialog into the <html> elem.
    var offs = $dialogFrame.offset();
    if (offs.left < 0 || offs.top < 0) {
      $dialogFrame.offset({
        left: Math.max(offs.left, 0),
        top: Math.max(offs.top, 0)
      });
    }

    $dialogFrame.dwScrollIntoView(
        { marginTop: 5, marginLeft: 5, marginRight: 5, duration: 0 });
  }
};


/**
 * Resets input fields on close.
 */
var jQueryDialogReset = $.extend({}, jQueryDialogDefault, {
  close: function() {
    $(this).find('input[type="text"], textarea')
        .val('').removeClass('ui-state-error');
  }
});


/**
 * Has no close button and doesn't close on Esc key.
 * Use if the user must click e.g. an OK button to close the dealog,
 * perhaps because of some event handler attached to that button.
 * E.g. a "You have been logged in. [OK]" dialog.
 */
var jQueryDialogNoClose = $.extend({}, jQueryDialogDefault, {
  closeOnEscape: false,
  open: function(event, ui) {
    jQueryDialogDefault.open.call(this, event, ui);
    $(this).parent().find('.ui-dialog-titlebar-close').hide();
  }
});


function mobileWidthOr(desktopWidth) {
  return Modernizr.touch ? jQueryDialogDefault.width : desktopWidth;
}



// ------- Traversing etcetera

function getPostHeader$(postId) {
  return $('#post-'+ postId +' > .dw-p-hd');
}

jQuery.fn.dwPostId = function() {
  // Drop initial "post-".
  return this.dwCheckIs('.dw-p').attr('id').substr(5, 999);
};

jQuery.fn.dwPostFindHeader = function() {
  return this.dwCheckIs('.dw-p').children('.dw-p-hd');
};

jQuery.fn.dwPostHeaderFindStats = function() {
  return this.dwCheckIs('.dw-p-hd').children('.dw-p-flgs-all, .dw-p-r-all');
};

jQuery.fn.dwPostHeaderFindExactTimes = function() {
  return this.dwCheckIs('.dw-p-hd')
      .find('> .dw-p-at, > .dw-p-hd-e > .dw-p-at');
};

jQuery.fn.dwLastChange = function() {
  var maxDate = '0';
  this.dwCheckIs('.dw-p')
      .children('.dw-p-hd').find('.dw-date').each(function(){
    var date = jQuery(this).attr('title'); // creation or last modification date
    if (date > maxDate)
      maxDate = date;
  });
  return maxDate;
};

// The user id of the author of a post.
jQuery.fn.dwAuthorId = function() {
  var uid = this.dwCheckIs('.dw-p')
      .find('> .dw-p-hd > .dw-p-by').attr('data-dw-u-id');
  return uid;
};

// The root post need not be the article (if ?view=something-else specified).
$.fn.dwIsRootPost = function() {
  return this.dwCheckIs('.dw-p').parent().is('.dw-depth-0');
}

$.fn.dwIsArticlePost = function() {
  return this.dwCheckIs('.dw-p').is('.dw-ar-p');
}

$.fn.dwIsReply = function() {
  // 1 char IDs are reserved (1 is page body, 2 title, 3 template).
  var id = this.dwPostId();
  return id.length > 1;
}

$.fn.dwIsUnauReply = function() {
  var isReply = this.dwIsReply();
  // Unauthenticated users have '-' in their user ids.
  var unauAuthor = this.dwAuthorId().indexOf('-') !== -1;
  return isReply && unauAuthor;
}


// ------- Open/close


function $threadToggleFolded() {
  // In case the thread will be wider than the summary, prevent float drop.
  resizeRootThreadExtraWide();
  var $thread = $(this).closest('.dw-t');
  // Don't hide the toggle-folded-link and arrows pointing *to* this thread.
  var $childrenToFold = $thread.children(':not(.dw-z, .dw-arw)');
  var $foldLink = $thread.children('.dw-z');
  // {{{ COULD make the animation somewhat smoother, by sliting up the
  // thread only until it's as high as the <a> and then hide it and add
  // .dw-zd, because otherwie when the <a>'s position changes from absolute
  // to static, the thread height suddenly changes from 0 to the highht
  // of the <a>). }}}
  if ($thread.is('.dw-zd')) {
    // Thread is folded, open it.
    $childrenToFold.each($slideDown);
    $thread.removeClass('dw-zd');
    $foldLink.text('[–]'); // not a '-', but an en dash, \u2013,
  } else {
    // Fold thread.
    var postCount = $thread.find('.dw-p').length;
    $childrenToFold.each($slideUp).queue(function(next) {
      $foldLink.text('[+] Click to show '+  // COULD add i18n
          postCount +' posts');
      $thread.addClass('dw-zd');
      next();
    });
  }
  return false; // don't follow any <a> link
}


// ------- Outlining

// Outline new posts
/*
(function(){
  var myLastVersion = $.cookie('myLastPageVersion'); // cookie no longer exists
  if (!myLastVersion) return;
  var newPosts = posts.filter(function(index){ // BUG?…
    //… relied on posts = $('.debiki .dw-p-bd') but use '*.dw-p' instead?
    return $(this).dwLastChange() > myLastVersion;
  })
  newPosts.closest('.dw-t').addClass('dw-m-t-new');
  // TODO: sometimes .dw-m-p-edited instead of -new
})()
*/


/**
 * Highlights and outlines $tag, for a little while. If there're opaque
 * elems inside, you can list them in the `opt_backgroundSelector`
 * and then background highlighting is placed on them instead of on $tag.
 */
function highlightBriefly($tag, opt_backgroundSelector) {
  var duration = 2500;
  var $background = opt_backgroundSelector ?
      $tag.find(opt_backgroundSelector) : $tag;
  $background.effect('highlight',
      { easing: 'easeInExpo', color: 'yellow' }, duration);
  $tag.css('outline', 'solid thick #f0a005');
  // Remove the outline quickly (during 500 ms). Otherwise it looks
  // jerky: removing 1px at a time, slowly, is very noticeable!
  setTimeout(function() {
    $tag.animate({ outlineWidth: '0px' }, 400);
  }, Math.max(duration - 550, 0));
  /// This won't work, jQuery plugin doesn't support rgba animation:
  //$post.animate(
  //    { outlineColor: 'rgba(255, 0, 0, .5)' }, duration, 'easeInExpo');
  /// There's a rgba color support plugin though:
  /// http://pioupioum.fr/sandbox/jquery-color/
}


/**
 * Scrolls to `this`, then highlights `$tag`.
 */
jQuery.fn.dwScrollToThenHighlight = function($tag, options) {
  this.dwScrollIntoView(options).queue(function(next) {
    highlightBriefly($tag);
    next();
  });
  return this;
};


/**
 * Scrolls to and highlights `this`.
 */
jQuery.fn.dwScrollToHighlighted = function(options) {
  return this.dwScrollToThenHighlight(this);
};


function showAndHighlightPost($post, options) {
  $post.dwScrollIntoView(options).queue(function(next) {
    highlightBriefly($post, '.dw-p-bd, .dw-p-hd');
    next();
  });
}


function scrollToUrlAnchorPost() {
  var $anchorPost = $(location.hash).filter('.dw-p');
  if (!$anchorPost.length) return;
  showAndHighlightPost($anchorPost, { marginRight: 200, marginBottom: 300 });
  $anchorPost.parent().addClass('dw-m-t-new');  // outlines it
}


// Adds class 'debiki-current-site-section' to the navigation
// menu link that matches the current window.location.
// However, unless you are on the home page, links to the home page
// (which is assumed to be '/') are ignored, because *everything* is below
// the homepage, so homepage links would otherwise always be marked.
function showCurLocationInSiteNav() {
  function $isCurSectionLink() {
    var link = $(this).attr('href');
    var linkPathStart =
      link.search('https?://') === 0 ? link.indexOf('/', 8) : 0;
    // Same protocol, host and port, a.k.a. origin?
    var linkOrigin = link.substr(0, linkPathStart);
    if (linkOrigin.length !== 0 && linkOrigin !== location.origin)
      return false;
    // Exact path match? (include home page links)
    var linkPath = link.substr(linkPathStart);
    if (linkPath === location.pathname)
      return true;
    // Ignore links to the home page.
    if (linkPath === '/')
      return false;
    // Ignore links with query string or hash parts.
    // {{{ Then I can include in the site <nav> links to a certain
    // Subscribe part of my homepage ,without that link being
    // considered a separate site section. }}}
    if (linkPath.search(/[?#]/) !== -1)
      return false;
    // Does `location' start with `linkPath'?
    // But ingore any page name part of `linkPath'. Only folder paths
    // constitute site sections, I've decided.
    // {{{ So you can have <nav> links like this one: site/folder/path/-<guid>,
    // that is, reference the section "index" page via guid,
    // so redirects will work, should you redesign your site and
    // move sections elsewhere (to site/another/path/-<but-same-guid>). }}}
    var linkFolderPath = linkPath.substr(0, linkPath.lastIndexOf('/') + 1);
    var locStartsWithLink = location.pathname.search(linkFolderPath) === 0;
    return locStartsWithLink;
  }

  $('.debiki-0-mark-current-site-section a[href]')
      .filter($isCurSectionLink)
      .addClass('debiki-0-current-site-section');
}



// ------- Resizing


// Makes the root thread wide enough to contain all its child posts.
// Unless this is done e.g. when child posts are resized or stacked eastwards,
// or a reply/rate/edit form is shown/resized, the east-most threads
// will float-drop below the other threads.
// Had IE7 supported display: table-cell, none of this would have been needed?
function resizeRootThreadImpl(extraWidth) {
  // Let the root thead, which floats: left, expand eastwards as much as
  // it needs to — by making its parent very very wide.
  var $rootThread = $('.dw-depth-0');
  var $parent = $rootThread.parent();
  $parent.width(200200);

  // Now check how wide the parent actually needs to be, to prevent the
  // eastmost root post child threads from float dropping.
  // Also add 200px, because when you zoom in and out the width of
  // the root post might change a few pixels (this caused float
  // drop in Opera, at least before I started calling resizeRootThread
  // on zoom in/out).
  // {{{ Old comment
  // If a user drag-resizes a form quicker than this amount of pixels
  // per browser refresh, div-drop might happen anyway, because
  // this function isn't invoked until after the
  // browser has decided to float-drop the divs?
  // Also, zooming in/out might cause float drop (it seems all elems
  // aren't scaled exactly in the same way), if too small.
  // Hence it's a rather wide value. (Otherwise = 50 would do.)
  // }}}
  $rootThread.width('auto'); // cancel below bug workaround
  var requiredWidth = $rootThread.width();
  // Change from 2200:200 to 2700:700. 200 causes float drop, if
  // browser window is narrow, and you add a root post reply (why!?).
  $parent.width(requiredWidth + (extraWidth ? 2700 : 700));

  // Browser (?) bug workaround:
  // Oddly enough, in very very few situations, the browser (Chrome v19)
  // resizes $rootThread so the last <li> actually float drops! However
  // if I add just 10px to that $rootThread.width(), then there is no
  // more float drop (so it seems to me that the browser does a 10px error
  // — if the browser didn't attempt to avoid float drop at all,
  // adding 10px wouldn't suffice? A thread <li> is perhaps 200px wide.)
  // However, after adding 100px here, I've never observed any more
  // float drop.
  // This also requires us to add 100px in debiki.css, see [3krdi2].
  $rootThread.width(requiredWidth + 100);
}


// Makes the root thread wide enough to contain all its child posts.
// Is this not done e.g. when child posts are resized or stacked eastwards,
// or a reply/rate/edit form is shown/resized, the east-most threads
// will float-drop below the other threads.
function resizeRootThread() {
  resizeRootThreadImpl();
}

// Resizes the root thread so it becomes extra wide.
// This almost avoids all float drops, when quickly resizing an element
// (making it larger).
function resizeRootThreadExtraWide() {
  resizeRootThreadImpl(true);
}

// After an elem has been resized, the root thread is resized by
// a call to resizeRootThread(). However, it seems the browser
// (Google Chrome) calls that function before all elements
// are in their final position, in some weird manner, causing
// floats to drop, as if resizeRootThread() had not been called.
// This can be fixed by calling resizeRootThread() again,
// after a while when the browser is (probably) done
// doing its layout stuff.
var resizeRootThreadNowAndLater = (function(){
  var handle;
  return function() {
    resizeRootThread();
    if (handle) clearTimeout(handle);
    handle = setTimeout(resizeRootThread, 1500);
  };
}());

// Makes [threads layed out vertically] horizontally resizable.
function $makeEastResizable() {
  $(this).resizable({
    resize: function() {
      resizeRootThreadExtraWide();
      SVG.$drawParentsAndTree.apply(this);
    },
    handles: 'e',
    stop: function(event, ui) {
      // jQuery has added `height: ...' to the thread's style attribute.
      // Unless removed, the therad won't resize itself when child
      // threads are opened/closed.
      $(this).css('height', '');
      resizeRootThreadNowAndLater();
    }
  });
}

// Make posts and threads resizable.
// Currently not in use, except for when I test to resize posts.
//   $('.dw-p').each($makePostResizable);
// Fails with a TypeError on Android: Cathching it and ignoring it.
// (On Android, posts and threads won't be resizable.)
function $makePostResizable() {
  var arrowsRedrawn = false;
  function drawArrows(where) {
    if (arrowsRedrawn) return;
    SVG.$drawParentsAndTree.apply(where);
    arrowsRedrawn = true;
  }
  var $expandSouth = function() {
    // Expand post southwards on resize handle click. But not if
    // the resize handle was dragged and the post thus manually resized.
    if (didResize) return;
    $(this).closest('.dw-p')
        .css('height', '').removeClass('dw-p-rez-s');
    drawArrows(this);
  };
  var $expandEast = function() {
    // Expand post eastwards on resize east handle click.
    if (didResize) return;
    $(this).closest('.dw-p')
        .css('width', '').removeClass('dw-p-rez-e');
    drawArrows(this);
  };
  var $expandSouthEast = function() {
    $expandSouth.apply(this);
    $expandEast.apply(this);
  };

  try {
  // Indicate which posts are cropped, and make visible on click.
  $(this)
    .filter('.dw-x-s')
    .append(
      '<div class="dw-x-mark">. . . truncated</div>')
    // Expand truncated posts on click.
    .click(function(){
      if ($(this).filter('.dw-x-s').length > 0) {
        // This post is truncated (because it is rather long).
        if (didExpandTruncated) {
          // Some other nested post (an inline comment thread?) has already
          // handled this click, and expanded itself. Ignore click.
          // SHOULD let the outer thread consume the first click. Hardly
          // matters though, since nested posts are rarely visible when the
          // parent post is cropped.
        }
        else {
          $(this).removeClass('dw-x-s')
              .children('.dw-x-mark').remove();
          didExpandTruncated = true;
          $(this).closest('.dw-t').each(SVG.$drawParentsAndTree);
        }
      }
    })
  .end()
  .resizable({  // TODO don't make non-root-thread inline posts resizable-e.
      autoHide: true,
      start: function(event, ui) {
        // Remember that this post is being resized, so heigh and width
        // are not removed on mouse up.
        didResize = true;
      },
      resize: function(event, ui) {
        $(this).closest('.dw-t').each(SVG.$drawParentsAndTree);
      },
      stop: function(event, ui) {
        // Add classes that draw east and south borders, so one can tell
        // from looking at the post that its size has been fixed by the user.
        $(this).closest('.dw-p').addClass('dw-p-rez-e dw-p-rez-s');
      }
     })
  .find('.ui-resizable-se')
    // Make the resize grip larger.
    .removeClass('.ui-icon-gripsmall-diagonal-se')  // exchange small grip...
    .addClass('ui-icon-grip-diagonal-se')  // ...against the normal one
  .end()
  // Expand east/south/southeast on east/south/southeast resize handle
  // *clicks*, by removing height and width restrictions on mouse *up* on
  // resize handles.  (These triggers are shortcuts to reveal the whole post
  // - only triggered if *clicking* the resize handle, but not dragging it.)
  .find('.ui-resizable-e').mouseup($expandEast).end()
  .find('.ui-resizable-s').mouseup($expandSouth).end()
  .find('.ui-resizable-se').mouseup($expandSouthEast).end()
  .find('.ui-resizable-handle')
    .mousedown(function(){
      arrowsRedrawn = false;
      didResize = false;
    })
  .end();
  }
  catch (e) {
    if (e.name === 'TypeError') console.log(e.name +': Failed to make '+
        'post resizable. Ignoring error (this is a smartphone?)');
    else throw e;
  }
}

// ------- Update

// Finds new/updated versions of posts/edits in newDebateHtml,
// adds them / replaces [the currently displayed but out-of-date versions].
// Highlights the changes done.
// Does not reorder elems currently shown (even if their likeability have
// changed significantly), to avoid surprising the user (by
// shuffling everything around).
// Returns the user's own new post, if any (otherwise, returns undefined).
// {{{ COULD include SHA1:s of each thread, and avoid reloading threads whose
// SHA1 is the same in the server's reply. The server need not upload
// those threads at all — that would require the server to generate
// unique replies to each client.
// The server COULD check SHA1:s from the client, and find all threads
// that has been changed (since the client got its version), and add
// all those threads in an <ul> and upload it. The client would then
// replace threads with the never versions in the <ul> — but keeping old
// subtrees whose SHA1 hadn't been changed.
// The server COULD include a <del data-what='thread-id, thread-id, ...'></del>
// but perhaps not needed — [the parent of each deleted thread] will have
// a new SHA1 and it'll be reloaded automatically.
// }}}
function updateDebate(newDebateHtml) {
  // Need to rewrite:
  // 1. Find all new **threads** (ancestors only, don't count subthreads
  //    of new threads).
  // X. Find all recently deleted posts. Threads?! Could ignore for now?
  //    only delete threads on reload?
  // 2. Find all old edited posts.
  // 3. Find all old posts that the user has just rated.
  // 4. Init all new threads. Redraw exactly all SVG arrows?
  //    Or $drawTree for each new thread, and find the union of all
  //    their ancestor threads and redraw them.
  // Y. Also find new flags. (Could ignore for now, only show new flags
  //    on complete reload.)
  // 5. Mark edits, mark own ratings.
  var $curDebate = $('.dw-debate');
  var $newDebate = buildTagFind(newDebateHtml, '.dw-debate');
  var $myNewPost;
  $newDebate.find('.dw-t').each(function(){
      var $i = $(this);
      var parentId = $i.parents('.dw-t').attr('id');
      var $oldParent = parentId ? $curDebate.find('#'+ parentId) : $curDebate;
      var $oldThis = $curDebate.find('#'+ this.id);
      var isNewThread = $oldThis.length === 0;
      var isSubThread = !$oldParent.length;  // BUG, $oldParent might be a
      // recently added *new* thread, but if this is a sub thread of another
      // *new* thread, isSubThread should be true.
      // Effect: new sub threads aren't inited properly it seems, or inits
      // their parents many times.
      var isInline = $i.filter('.dw-i-t').length === 1;
      var $oldPost = $oldThis.children('.dw-p');
      var $newPost = $i.children('.dw-p');
      var oldDate = $oldPost.dwLastChange();
      var newDate = $newPost.dwLastChange();
      var isPostEdited = !isNewThread && newDate > oldDate;
      // You can undo changes to a post, and revert it to an earlier version,
      // too. COULD use as newDate the point in time when the post was
      // reverted, so newDate would be > oldDate. Otherwise people might
      // reply to a newer version, but then it's reverted to an old version,
      // and the *old* date wold be shown, causing confusion: the replies
      // would seemingly reply to the *old* version. For now though:
      var isPostReverted = !isNewThread && newDate < oldDate;
      // BUG: If >= 2 edits were applied at the same time, newDate won't be
      // affected if you revert just one of them, so isPostReverted will
      // be false and the changes won't take effect until after page reload.
      // (Don't fix that bug. I'll probably rewrite, so one can undo only
      // the last edit applied, and not revert, but *reverse*, other edits,
      // I mean, apply it again but "inverted" so it undoes itself. Then
      // the modification date would always increase and the bug is no more.)
      var oldRatsModTime =
          $oldPost.find('> .dw-p-hd > .dw-p-r-all').attr('data-mtime');
      var newRatsModTime =
          $newPost.find('> .dw-p-hd > .dw-p-r-all').attr('data-mtime');
      var hasNewRatings =
          (!oldRatsModTime ^ !newRatsModTime) ||
          (newRatsModTime > oldRatsModTime);
      if (isPostEdited || isPostReverted) {
        $newPost
          .replaceAll($oldPost)
          .addClass('dw-m-p-edited'); // outlines it
        // BUG? New/edited child posts aren't added? Can't simply replace
        // them with newer versions — what would then happen if the user
        // has opened an edit form for those posts?
        $newPost.each($initPost);
      }
      else if (isNewThread && !isSubThread) {
        // (A thread that *is* a sub-thread of another new thread, is added
        // automatically when that other new thread is added.)
        // BUG: isSubThread might be false, although the thread is a sub
        // thread of a new thread. So below code is sometimes (depending on
        // which thread is first found) incorrectly run
        // on sub threads.

        // Indicate that this is a new thread.
        $i.addClass('dw-m-t-new') // outlines all posts in thread

        // Place the new thread, $i, next to the thread to the left.
        // But we need to look it up, so we get the one in the document
        // (rather than the one in the html from the server).
        var prevId = $i.prev().attr('id');
        if (prevId) {
          var $prevThread = $('#'+ prevId);
          $prevThread.after($i)
        }
        else {
          // There's no thread to the left of $i, so append $i
          // to the parent thread's .dw-res.
          var $res = $oldParent.children('.dw-res');
          if (!$res.length) {
            // This is the first reply; create the reply list.
            $res = $("<ol class='dw-res'/>").appendTo($oldParent);
          }
          $i.appendTo($res);
        }

        if (isInline) {
          // Place this inline thread inside its parent, by
          // undoing the parent's inline thread placement and doing
          // it again, with the new thread included.
          $oldParent.children('.dw-p')  // BUG $oldParent might be a new thread
            .each($undoInlineThreads)   // (see below)
            .each($initPost);
          // BUG: $oldParent might be a new thread, because when
          // 
          // BUG add an inline reply to an inline child post (i.e. add an
          // inline grandchild), and then $oldParent won't be redrawn.
        }
        // COULD avoid redrawing the same posts over and over again,
        // by inserting stuff to redraw in a map? and remove from the
        // map all posts whose parents are already in the map.
        // (Currently e.g. arrows from the root post are redrawn once
        // per new thread, since $drawParents is used below.)
        $i.each(SVG.$drawTree); // not $drawPost; $i might have child threads
        $newPost.each($initPostsThread);
        // Draw arrows from the parent post to its new child post,
        // *after* $newPost has been initialized, because $newPost' size
        // changes somewhat when it's inited. If some parent is an inline
        // post, *its* parent might need to be redrawn. So redraw all parents.
        $newPost.each(SVG.$drawParents);
        if (Me.getUserId() === $newPost.dwAuthorId()) {
          $myNewPost = $newPost;
        }
      } else if (hasNewRatings) {
        // Update rating info for this post.
        // - All branches above automatically update ratings.
        // - The old post might have no rating info at all (if there were
        //   no ratings). So don't attempt to replace old elems with new
        //   ones; instead remove any old elems and append the new ones to
        //   the post creation timestamp, .dw-p-at, which exists for sure.
        // - Show() the new .dw-p-r-all, so the user notices his/her own
        //   ratings, highlighted.
        var $newHdr = $newPost.children('.dw-p-hd');
        $oldPost.children('.dw-p-hd')
            .children('.dw-p-r-top, .dw-p-r-all').remove().end()
            .children('.dw-p-at').after(
                $newHdr.children('.dw-p-r-top').show()).end()
            .append(
                $newHdr.children('.dw-p-r-all').show());
      }
      else {
        // This post has not been changed, keep it as is.
      }

      // BUG $initPost is never called on child threads (isSubThread true).
      // So e.g. the <a ... class="dw-as">React</a> link isn't replaced.
      // BUG <new-post>.click($showReplyForm) won't happen
    });

  return $myNewPost;
}

// ------- Tag Dog

// The tag dog searches text inside html tags, without being so very
// confused by tags and attributes.
var tagDog = (function(){
  var sniffAndMem;
  return {
    maxMatchLength: new diff_match_patch().Match_MaxBits,
    sniffHtml: function($tag) {
      var htmlText = $tag.html();
      sniffAndMem = TagDog.sniffHtml(htmlText);
      return sniffAndMem.sniffedHtml;
    },
    barkHtml: function(sniffedHtml) {
      sniffAndMem.sniffedHtml = sniffedHtml;
      var htmlText = TagDog.barkHtml(sniffAndMem);
      return htmlText;
    }
  };
}());

// ------- Posts

// Inits a post and its parent thread.
// Makes posts resizable, activates mouseenter/leave functionality,
// draws arrows to child threads, etc.
// Initing a thread is done in 4 steps. This function calls all those 4 steps.
// (The initialization is split into steps, so everything need not be done
// at once on page load.)
// Call on posts.
function $initPostsThread() {
  $initPostsThreadStep1.apply(this);
  $initPostsThreadStep2.apply(this);
  $initPostsThreadStep3.apply(this);
  $initPostsThreadStep4.apply(this);
}

function $initPostsThreadStep1() {
  var $thread = $(this).closest('.dw-t');

  // Find or add action buttons.
  var $actions = $thread.children('.dw-res').children('.dw-p-as');
  if ($actions.length) {
    // This thread is laid out horizontally and the action links have
    // already been placed somewhere in the child thread <ol>.
  } else {
    $actions = $('#dw-action-menu')
        .clone()
        .removeAttr('id')
        .css('visibility', 'hidden');
    $thread.find('> .dw-as').replaceWith($actions);
    // Touch devices cannot show-on-mouse-hover.
    if (Modernizr.touch)
      $actions.children('.dw-a-reply, .dw-a-rate')
          .css('visibility', 'visible');
  }

  // {{{ On delegating events for reply/rate/edit.
  // Placing a jQuery delegate on e.g. .debiki instead, entails that
  // these links are given excessively low precedence on Android:
  // on a screen touch, any <a> nearby that has a real click event
  // is clicked instead of the <a> with a delegate event. The reply/
  // reply/rate/edit links becomes virtually unclickable (if event
  // delegation is used instead). }}}
  $actions.children('.dw-a-reply').click($showReplyForm);
  $actions.children('.dw-a-rate').click($showRatingForm);
  $actions.children('.dw-a-more').click(function() {
    $(this).closest('.dw-p-as').find('.dw-a')
        .show()
        .end().end().remove();
  });
  //$actions.children('.dw-a-link').click($showLinkForm); — not implemented
  $actions.children('.dw-a-edit').click($showEditsDialog);
  $actions.children('.dw-a-flag').click($showFlagForm);
  $actions.children('.dw-a-delete').click($showDeleteForm);

  // Open/close threads if the fold link is clicked.
  $thread.children('.dw-z').click($threadToggleFolded);
}

// Things that can be done a while after page load.
function $initPostsThreadStep2() {
  var $thread = $(this).closest('.dw-t');
  var $post = $thread.filter(':not(.dw-depth-0)').children('.dw-p');

  // When hovering a post, show actions, and make it resizable.
  // But always show the leftmost Reply, at depth-0, that creates a new column.
  // (Better avoid delegates for frequent events such as mouseenter.)
  $post.mouseenter(function() {
    var $i = $(this);

    // If actions are already shown for an inline child post, ignore event.
    // (Sometimes the mouseenter event is fired first for an inline child
    // post, then for its parent — and then actions should be shown for the
    // child post; the parent should ignore the event.)
    var inlineChildActionsShown = $i.find('#dw-p-as-shown').length;

    // If the post is being edited, show no actions.
    // (It's rather confusing to be able to Reply to the edit <form>.)
    var isBeingEdited = $i.children('.dw-f-e:visible').length;

    if (isBeingEdited)
      hideActions();
    else if (!inlineChildActionsShown)
      $i.each($showActions);
    // else leave actions visible, below the inline child post.

    // {{{ Resizing of posts — disabled
    // This takes really long (700 ms on my 6 core 2.8 GHz AMD) if done
    // for all posts at once. Don't do it at all, unless hovering post.
    // (Resizing of posts oesn't work on touch devices (Android), and
    // the resize handles steal touch events.)
    // But! If done like this, when you hover a post, jQuery UI won't show
    // the resize handles until the mouse *leaves* the post an enters it
    // *again*. So this doesn't work well. I think I might as well disable
    // resizing of posts. It isn't very useful, *and* it does not work on
    // mobile devices (Android). If I disable it, then browsers will work
    // like mobile devices do and I will automatically build something
    // that works on mobile devices.
    //
    // If you comment in this code, please note:
    // $makeEastResizable must be called before $makePostResizable,
    // or $makeEastResizable has no effect. Search for
    // "each($makeEastResizable)" to find more info.
    //
    // if (!Modernizr.touch && !$i.children('.ui-resizable-handle').length)
    //   $i.each($makePostResizable);
    // }}}
  });

  $thread.mouseleave(function() {
    // If this is an inline post, show the action menu for the parent post
    // since we're hovering that post now.
    $(this).closest('.dw-p').each($showActions);
  });

  $initPostStep1.apply(this);
}

function $initPostsThreadStep3() {
  $initPostStep2.apply(this);
}

function $initPostsThreadStep4() {
  var $thread = $(this).closest('.dw-t');

  // Make replies to the root thread resizable horizontally. (Takes
  // perhaps 100 ms on my 6 core 2.8 GHz AMD, 24 depth-1 reply columns.)
  // (But skip inline replies; they expand eastwards regardless.)
  // $makeEastResizable must be called before $makePostResizable (not in
  // use though!), or $makeEastResizable has no effect. No idea
  // why -- my guess is some jQuery code does something similar to
  // `$.find(..)', and finds the wrong resizable stuff,
  // if the *inner* tag is made resizable before the *outer* tag.
  //
  // However for touch devises, don't enable resizing of posts: it doesn't
  // work, and the resize handles steal touch events from buttons nearby.
  if (!Modernizr.touch)
    $thread.filter(function() {
      var $i = $(this);
      return !$i.is('.dw-i-t') && $i.parent().closest('.dw-t').is('.dw-hor');
    }).each($makeEastResizable);

  showCurLocationInSiteNav();
}

// Inits a post, not its parent thread.
function $initPost() {
  $initPostStep1.apply(this);
  $initPostStep2.apply(this);
}

function $initPostStep1() {
  var $i = $(this),
      $hdr = $i.find('.dw-p-hd'),
      $postedAt = $hdr.children('.dw-p-at'),
      postedAtTitle = $postedAt.attr('title'),
      postedAt = isoDateToMillis(postedAtTitle),
      $editedAt = $hdr.find('> .dw-p-hd-e > .dw-p-at'),
      editedAtTitle = $editedAt.attr('title'),
      editedAt = isoDateToMillis(editedAtTitle),
      now = new Date();  // COULD cache? e.g. when initing all posts

  // If this post has any inline thread, place inline marks and split
  // the single .dw-p-bd-blk into many blocks with inline threads
  // inbetween.
  // (This takes rather long (120 ms for 110 posts, of which 20 are inlined,
  // on my 6 core 2.8 GHz AMD) but should nevertheless be done quite early,
  // because it rearranges threads and posts, and that'd better not happen
  // after a while when the user thinks the page has already finished
  // loading.)
  if ($i.parent().children('.dw-res').children('.dw-i-t').length) {
    $i.each($placeInlineMarks)
      .each($splitBodyPlaceInlines);
  }

  function timeAgoAbbr(title, then, now) {
    return $('<abbr title="'+ title +'">'+ prettyTimeBetween(then, now) +
        '</abbr>');
  };

  // Show pretty how-long-ago info. (The $posted/editedAt are already hidden.)
  $postedAt.before(timeAgoAbbr(postedAtTitle, postedAt, now));
  $editedAt.before(timeAgoAbbr(editedAtTitle, editedAt, now));

  // If you clicks the header, show detailed rating and flags info.
  // If you click again, show exact creation date and edit date.
  // On a third click, hide everything again.
  if ($hdr.dwPostHeaderFindStats().length
      ) $hdr.css('cursor', 'help').click(function(event) {
    if ($(event.target).is('a'))
      return;  // don't expand header on link click
    var $i = $(this);
    var $stats = $i.dwPostHeaderFindStats();
    var $times = $i.dwPostHeaderFindExactTimes();
    if ($stats.is(':hidden')) {
      $stats.show();
    }
    /// Skip this for now, rewrite so dates are appended, don't
    /// insert in the middle.
    // else if ($times.is(':hidden')) {
    //  $times.show();
    else {
      $times.hide();
      $stats.hide();
    }
    // This might have expanded the post, so redraw arrows.
    $i.closest('.dw-p').each(SVG.$drawParents);
  });

  // When hovering an inline mark or thread, highlight the corresponding
  // thread or mark.
  // TODO don't remove the highlighting until hovering something else?
  //  So one can follow the svg path to the inline thread.
  // When hovering an inline thread, highlight the mark.
  // COULD highlight arrows when hovering any post, not just inline posts?
  $('> .dw-p-bd', this)
      .find('> .dw-p-bd-blk .dw-i-m-start')
        .hover($inlineMarkHighlightOn, $inlineMarkHighlightOff)
      .end()
      .find('> .dw-i-ts > .dw-i-t > .dw-p')
        .hover($inlineThreadHighlightOn, $inlineThreadHighlightOff);
}

function $initPostStep2() {
  // $initPostSvg takes rather long (190 ms on my 6 core 2.8 GHz AMD, for
  // 100 posts), and  need not be done until just before SVG is drawn.
  SVG.$initPostSvg.apply(this);
}

// Extracts markup source from html.
function $htmlToMarkup() {
  var mup = '';
  $(this).find('p').each(function(){ mup += $(this).text() +'\n\n'; });
  return mup.trim() +'\n';
}

// Moves inline child threads back to the thread's list of child threads,
// and removes inline marks and undoes wrapping of -bd contents into
// -bd-blk:s. That is, undoes $placeInlineMarks and $splitBodyPlaceInlines.
// Call on posts.
function $undoInlineThreads() {
  // Remove inline marks and unwrap block contents.
  var $post = $(this);
  var $body = $post.children('.dw-p-bd');
  // The post body contents is placed in various <div .dw-p-bd-blk>
  // with inline threads, <div .dw-i-ts>, inbetween.
  // Move the contents back to a single <div .dw-p-bd-blk>,
  // and also remove inline marks.
  var $bodyBlock = $('<div class="dw-p-bd-blk"></div>');
  $body.children('.dw-p-bd-blk').each(function() {
    var $block = $(this);
    $block.find('.dw-i-m-start').remove();
    $block.contents().appendTo($bodyBlock);
    $block.remove();
  });
  $body.append($bodyBlock);
  // Move inline threads back to the thread's list of child threads.
  var $inlineThreads = $body.find('> .dw-i-ts .dw-i-t');
  $inlineThreads.detach();
  $body.children('.dw-i-ts').remove();
  $post.parent().children(".dw-res").prepend($inlineThreads);
}

// Places marks where inline threads are to be placed.
// This is a mark:  <a class='dw-i-m-start' href='#dw-t-(thread_id)' />
// Better do this before splitBodyPlaceInlines, so as not to confuse the
// TagDog unnecessarily much (it'd be confused by the -bd-blk:s).
// Call on posts.
function $placeInlineMarks() {
  $(this).parent().find('> .dw-res > .dw-i-t', this).each(function(){
    // Search the parent post for the text where this mark starts.
    // Insert a mark (i.e. an <a/> tag) and render the parent post again.
    var markStartText = $(this).attr('data-dw-i-t-where');
    var $parentThread = $(this).parent().closest('.dw-t');
    var $bodyBlock = $parentThread.find(
        '> .dw-p > .dw-p-bd > .dw-p-bd-blk');
    bugIf($bodyBlock.length !== 1, 'error DwE6kiJ08');
    var tagDogText = tagDog.sniffHtml($bodyBlock);
    var loc = 10; // TODO should be included in the data attr
    if (markStartText.length > tagDog.maxMatchLength) {
      // Avoid a `Pattern too long for this browser' error (in case
      // corrupt/too-long matches were sent by the server, the whole
      // page would otherwise be messed up).
      markStartText = markStartText.substr(0, tagDog.maxMatchLength);
    }
    var match = diffMatchPatch.match_main(tagDogText, markStartText, loc);
    var arrow = $parentThread.filter('.dw-hor').length ?
        'ui-icon-arrow-1-e' : 'ui-icon-arrow-1-s';
    // TODO When possible to mark a text range: Underline matched text?
    // COULD add i18n, here and in $(mark) below.
    var mark =
        '<a id="dw-i-m_'+ this.id +'" class="dw-i-m-start ui-icon '+
        arrow +'" href="#'+ this.id +'" title="Contextual comment" />';
    if (match === -1) {
      // Text not found. Has the parent post been edited since the mark
      // was set? Should diffMatchPatch.Match_Distance and other settings
      // be tweaked?
      // To indicate that no match was found, appen the mark to the post body.
      // Then there's no text to the right of the mark — no text, no match.
      $(mark).attr('title',
          'Contextual comment, but the context text was not found, '+
          'so this comment was placed at the end of the post.'
          ).appendTo($bodyBlock);
      return;
    }
    var beforeMatch = tagDogText.substring(0, match);
    var afterMatch = tagDogText.substring(match, 999999);
    var tagDogTextWithMark = [beforeMatch, mark, afterMatch].join('');
    var blockWithMarks =
        ['<div class="dw-p-bd-blk">',
          tagDog.barkHtml(tagDogTextWithMark),
          '</div>'].join('');
    $bodyBlock.replaceWith(blockWithMarks);

    // Or simply:
    // var htmlWithMark = tagDogsniffAndMark(markStartText, $bodyBlock);
    // $bodyBlock.replace($(htmlWithMark));
  });
}

// Splits the single .dw-p-bd-blk into many -bd-blk:s,
// and places inline threads inbetween, in <ol .dw-i-ts> tags.
// Call on posts.
function $splitBodyPlaceInlines() {
  // Groups .dw-p-bd child elems in groups around/above 200px high, and
  // wrap them in a .dw-p-bd-blk. Gathers all inline threads for each
  // .dw-p-bd-blk, and places them in an <ol> to the right of the
  // .dw-p-bd-blk.
  var $placeToTheRight = function() {
    // Height calculation issue:
    //  After a .dw-p-bd-blk and an <ol> have been added, there are
    //  elems before [the current block to wrap in a .dw-p-bd-blk] that
    //  float left. The height of the block includes the height of these
    //  floating blocks. So the current block might be excessively high!
    //  Therefore, read the height of the *next* block, which has its
    //  correct height, since there's a non-floating currunt elem
    //  immediately in front of it. Save the result in `nextHeight'.
    var nextHeight = null;
    var accHeight = 0;
    var elems = [];
    $(this).children().each(function(){
      accHeight += nextHeight || $(this).outerHeight(true);
      nextHeight = $(this).next().outerHeight(true); // null if no next
      elems.push(this);
      if (accHeight < 270 && nextHeight) // COULD make 270 configurable?
        return;
      // The total height of all accElemes is above the threshold;
      // wrap them in a .dw-p-bd-blk, and any inline replies to them will
      // float to the right of that -body-block.
      var $block = $('<div class="dw-p-bd-blk"></div>').insertBefore(elems[0]);
      $block.prepend(elems);
      // Create an <ol> into which $block's inline threads will be placed.
      var $inlineThreads = $('<ol class="dw-i-ts"></ol>').insertAfter($block);
      var accHeightInlines = 0;
      var numInlines = 0;
      $block.find('.dw-i-m-start').each(function(){
        // TODO change from <li> to <div>
        var $inline = $(this.hash); // this.hash is '#dw-t-<id>'
        $inline.appendTo($inlineThreads);
        accHeightInlines += $inline.outerHeight(true);
        numInlines += 1;
      });
      // If the inline replies <ol> is higher than the -bd-blk, there'll
      // be empty space between this -bd-blk and the next one (because a
      // -bd-blk clears floats). Avoid this, by reducing the height of
      // each inline thread.
      if (accHeightInlines > accHeight) {
        // TODO // For now, simply set the height to accHeight / numInlines.
      }
      accHeight = 0;
      elems = [];
    });
  };

  var $placeInside = function() {
    // There are some .dw-i-m-start that are direct children of this .dw-p-bd.
    // They are inline marks for which no matching text was found, and are
    // currently placed at the end of this .dw-p-bd. Wrap them in a single
    // .dw-p-bd-blk, and their threads in an <ol>.
    var $bdyBlkMatchless = $('<div class="dw-p-bd-blk"></div>');
    var $inlineThreadsMatchless = $('<ol class="dw-i-ts"></ol>');

    $(this).children().each(function(){
      if ($(this).filter('.dw-i-m-start').length) {
        // This is a mark with no matching text. Place it in the trailing
        // Matchless block. (We wouldn't find this mark, when searching
        // for ``$('.dw-i-m-start', this)'' below.)
        $bdyBlkMatchless.append(this);
        $inlineThreadsMatchless.append($(this.hash)); // hash is '#dw-t-<id>'
        return;
      }
      // Wrap the elem in a -blk and append an <ol> into which inline
      // threads will be placed.
      var $bdyBlk = $(this).wrap('<div class="dw-p-bd-blk"></div>').parent();
      var $inlineThreads = $('<ol class="dw-i-ts"></ol>').insertAfter($bdyBlk);
      $('.dw-i-m-start', this).each(function(){
        var $inline = $(this.hash); // TODO change from <li> to <div>
        $inline.appendTo($inlineThreads);
      });
    });

    // Append any inline marks and threads that matched no text.
    if ($bdyBlkMatchless.length) {
      $(this).append($bdyBlkMatchless).append($inlineThreadsMatchless);
    } else {
      $bdyBlkMatchless.remove();
      $inlineThreadsMatchless.remove();
    }
  };

  // Group body elems in body-block <div>s. In debiki.css, these divs are
  // placed to the left and inline threads in a <ol> to the right, or
  // below (between) the body blocks.
  $(this).find('> .dw-p-bd > .dw-p-bd-blk').each(function(){
    var $placeFun = $(this).closest('.dw-t').filter('.dw-hor').length ?
        $placeToTheRight : $placeInside;
    $placeFun.apply(this);
    // Now there should be one <div .dw-p-bd-blk> with many
    // <div .dw-p-bd-blk> and <div .dw-i-ts> inside. Unwrap that single
    // parent <div .dw-p-bd-blk>.
    $(this).replaceWith($(this).contents());
  });
}

function $showInlineReply() {
  /*
  Could design a Page Object API that allows me to write:
    var thread = Thread.fromHash(this.hash);
    if (thread.isFolded()) thread.unfold()
    thread.getPost().scrollIntoView().highlight();
  Or simply:
    Post.fromThreadHash(this.hash).showAndHighlight();
  — Later, when I've ported to Play 2 and can use Coffeescript :-)
  */
  var $thread = $(this.hash);
  var postHash = '#post-'+ this.hash.substr(6, 999); // drops '#dw-t-'
  var $post = $(postHash);
  // Ensure inline thread not folded.
  if ($thread.is('.dw-zd')) {
    $thread.children('.dw-z').click();
  }
  showAndHighlightPost($post);
  return false;
}

function $inlineMarkHighlightOn() {
  var threadId = this.hash.substr(1, 999); // drops '#'
  toggleInlineHighlight(threadId, true);
}

function $inlineMarkHighlightOff() {
  var threadId = this.hash.substr(1, 999); // drops '#'
  toggleInlineHighlight(threadId, false);
}

function $inlineThreadHighlightOn() {
  var threadId = $(this).closest('.dw-t').attr('id');
  toggleInlineHighlight(threadId, true);
}

function $inlineThreadHighlightOff() {
  var threadId = $(this).closest('.dw-t').attr('id');
  toggleInlineHighlight(threadId, false);
}

function toggleInlineHighlight(threadId, on) {
  var inlineMarkId = 'dw-i-m_'+ threadId; // i.e. 'dw-i-m_dw-t-<thread-id>'
  var svgCurveId = 'dw-svg-c_'+ inlineMarkId;
  var $markAndPost = $('#'+ inlineMarkId +", #"+ threadId +" > .dw-p");
  var $arrow = $('#'+ svgCurveId);
  if (on) {
    $markAndPost.addClass('dw-highlight');
    $arrow.each(SVG.$highlightOn);
  } else {
    $markAndPost.removeClass('dw-highlight');
    $arrow.each(SVG.$highlightOff);
  }
}


// ------- Inline actions

function $hideInlineActionMenu(event) {
  $lastInlineMenu.remove();
}

// Opens a menu with Inline Reply and Edit endries.
// Does currently not work (does nothing) in IE 7 and 8.
function $showInlineActionMenu(event) {
  var $menu;
  var $target = $(event.target);
  if ($target.closest('.dw-fs').length) {
    // A form was clicked. Ignore click.
    return;
  }
  if (event.which === 2 || event.which === 3) {
    return; // ignore middle and right mouse buttons
    // (What is `which' for touch events? This works fine on Android anyhow.)
  }
  if (didExpandTruncated) {
    // The post is truncated. This click expands it; don't
    // let the click result in a reply form appearing, too.
    return;
  }

  // {{{ Could use ierange-m2.js (http://code.google.com/p/ierange/)
  // for this to work in IE 7 and 8, if the user has actually selected
  // a text range — mouse clicks, however, generate no range in IE 8 (and 7?)
  // (with ierange-m2). But mouse clicks are what is interesting, so skip
  // ierange for now. How find the *clicked* node and offset in IE 7 and 8? }}}
  if (!window.getSelection) return;  // IE 7 and 8
  var sel = window.getSelection();
  if (!sel.anchorNode || !sel.anchorNode.data ||
      sel.anchorNode.data.substr(sel.anchorOffset, 1).length === 0) {
    // No text clicked. Ignore.
    return;
  }

  // Find out what piece of text was cliced or selected.
  // See: http://stackoverflow.com/questions/3968520/
  //      how-to-use-jquery-prevall-to-select-nearby-text-nodes/3968929#3968929

  // If the user clicked e.g. inside a short <b> tag, the range might be only a 
  // few characters long, and these few characters might occur somewhere else
  // in the same post. This could result in Google's diff-match-patch finding 
  // the wrong occurrance.
  // jQuery(window.getSelection().anchorNode).parent().parent().contents()

  // TODO: Find out where to show the menu. And show menu.
  // TODO: Show a mark where the click was? See insertNodeAtCursor here:
  //  http://stackoverflow.com/questions/2213376/
  //    how-to-find-cursor-position-in-a-contenteditable-div/2213514#2213514
  // Use event.clientX, event.clientY.

  // Remember the clicked node and, if it's a text node, its parent
  // non-text node.
  // Later, when finding the closest .dw-p-bd-blk, we must start searching
  // from a non-text node, because jQuery(text-node) results in TypeError:
  //  Object #<a Text> has no method 'getAttribute'.
  var isTextNode = sel.focusNode.nodeType === 3;  // 3 is text
  var focusText = isTextNode ? sel.focusNode : undefined;
  var $focusNonText = $(isTextNode ? sel.focusNode.parentNode : sel.focusNode);
  var $post = $target.closest('.dw-p');
  var $postBody = $post.children('.dw-p-bd');

  if (!isTextNode) {
    // Finding the text clicked, when !isTextNode, is not implemented.
    // So right now, no inline menu will appear.
    // Seems to happen if you select a <li> or <p>,
    // by selecting a line end just before such an elem.
    // Or if you release the mouse button inside a .dw-i-m-start.
    return;
  }

  // When the user clicks a menu button, `sel' will refer to this new click,
  // so copy the old click forever:
  var sel = {
    focusOffset: sel.focusOffset,
    focusNode: sel.focusNode,
    anchorNode: sel.anchorNode,
    anchorOffset: sel.anchorOffset
  };

  // Finds the text just after the click. For example, if you click
  // somewhere on 'cows' in a post with this text:
  //    'All <strong>crazy cows</strong> eagerly eat running rabbits'
  // I think it finds ' eagerly eat running rabbits'.
  // (It does this without being so very confused by html tags,
  // because it converts tags to single characters and then uses
  // google-diff-match-patch to do a fussy search for the start
  // of the clicked text.)
  var placeWhereFunc = function() {
    // Find out where to place the relevant form.
    // This must be done when the -bd has been split into -bd-blks.
    var elem = $focusNonText.closest('.dw-p-bd-blk')
          .dwBugIfEmpty('error DwE6u5962rf3')
          .next('.dw-i-ts')
          .dwBugIfEmpty('error DwE17923xstq');

    if (isTextNode) {
      // Insert a magic token where the mouse was clicked.
      // Convert the whole post to text, and find the text just
      // after the magic token. That text (after the token) is
      // where the inline mark should be placed.
      // The *whole* post body is converted to text. If only
      // the clicked node was considered, the text just after
      // the click could be very short, e.g. only "You"
      // if the node is <h1>Hey You</h1> and "you" could have many
      // matches in the post (and when inline marks are placed
      // the whole post is considered).
      var origText = focusText.nodeValue;
      var textAfterFocus = origText.substr(sel.focusOffset);
      // "Move" the focus to the end of the clicked word, so the inline
      // mark won't split the word in two.
      var charsToEndOfWord = textAfterFocus.search(
          / |!|"|'|\)|\*|\+|\-|\/|<|>|\]|`|\||\}/i)
      if (charsToEndOfWord === -1) {
        // The user clicked the last word in the text node.
        // Place the mark after this last word.
        charsToEndOfWord = textAfterFocus.length;
      }
      var endOfWordOffs = sel.focusOffset + charsToEndOfWord;
      var textBefore = origText.substr(0, endOfWordOffs);
      var textAfter = origText.substr(endOfWordOffs);
      var token = '_magic_'+ Math.random() +'_'+ Math.random() +'_';
      var textWithToken = textBefore + token + textAfter;
      focusText.nodeValue = textWithToken; // this destroys `sel'
      sel = null;
      // Copy the post body, with the magic token, but skip inline threads.
      var $clean = $('<div></div>');
      $postBody.children('.dw-p-bd-blk').each(function() {
        $clean.append($(this).children().clone());  // .dw-i-ts skipped
      });
      // Undo the changes to the focused node.
      focusText.nodeValue = origText;
      // Remove all inline marks and threads from the copy.
      $clean.find('.dw-i-m-start').remove();
      var cleanHtmlWithMark = $clean.html();
      var sniff = TagDog.sniffHtml(cleanHtmlWithMark);
      // Find the text just after the mark.
      var tokenOffs = sniff.sniffedHtml.search(token);
      var justAfterMark = sniff.sniffedHtml.substr(
                            tokenOffs + token.length, tagDog.maxMatchLength);
      return {
        textStart: justAfterMark,
        // Currently not possible to mark a range of chars:
        textEnd: justAfterMark,
        elem: elem
      };
    } else {
      die('[error DwE09k12rs52]'); // dead code
    }
  };

  // Entitle the edit button `Suggest Edit' or `Edit', depending on
  // whether or not it's the user's post.
  var authorId = $post.dwAuthorId();
  var curUserId = Me.getUserId();

  // Open a menu, with Edit, Reply and Cancel buttons. CSS: '-i' means inline.
  $menu = $(  // TODO i18n
      '<ul class="dw-as-inline">' +
        '<li><a class="dw-a-edit-i">Improve</a></li>' +
        // Disable inline replies for now, until I've made them work better,
        //'<li><a class="dw-a-reply-i">Reply inline</a></li>' +
        //'<li><a class="dw-a-mark-i">Mark</a></li>' + // COULD implement
      '</ul>');
  $menu.find('a').button();//"option", "disabled", true);

  // Place the center of the menu on the mouse click. Then the
  // user needs move the mouse only a tiny amount up/dow or
  // northeast/nw/se/sw, to click the relevant button (if there are
  // <= 4 menu buttons). — no, then a double click causes a button click,
  // instead of selecting a word.
  var $thread = $post.closest('.dw-t');
  var threadOfs = $thread.offset();
  $thread.append($menu);
  var menuHeight = $menu.outerHeight(true);  // after append

  $menu.css('left', event.pageX - threadOfs.left - 50)  // 50 px to the left
      .css('top', event.pageY - threadOfs.top - menuHeight - 10); // above click

  // Fill in the `where' form field with the text where the
  // click/selection was made. Google's diff-match-patch can match
  // only 32 chars so specify only 32 chars.
  // (All selected text:
  //    sel.getRangeAt(0).toString().substr(0,32);
  // but we're interested in the start and end of the selection/click.)
  // TODO Consider using http://code.google.com/p/ierange/, so this stuff
  // works also with IE (6)/7/8.
  // BUG: Next line: Uncaught TypeError: Cannot read property 'data' of null

  // Preload dependencies, in case user opens editor:
  $post.each($loadEditorDependencies);

  // Bind actions.
  $menu.find('.dw-a-edit-i').click(function(){
    showInteractionsIfHidden();
    $post.each($showEditForm);
    $menu.remove();
  });

  $menu.find('.dw-a-reply-i').click(function(){
    // To have somewhere to place the reply form, split the block into
    // smaller .dw-p-bd-blk:s, and add .dw-i-ts, if not already
    // done (which is the case if this post has no inline replies).
    if (!$postBody.children('.dw-i-ts').length) {
      // This rearranging of elems destroys `sel', e.g. focusNode becomes null.
      $post.each($splitBodyPlaceInlines);
    }
    // Find the text that was clicked. Cannot be done until now, because
    // this destroys the selection, `sel', and it wouldn't be possible
    // to select text at all, were this done directly when the $menu was
    // created. (Because your selection wound be destroyed when you made it.)
    var placeWhere = placeWhereFunc();

    // Showing interactions, if hidden, might result in [the paragraph
    // that was clicked] being moved downwards, because inline threads
    // are inserted. This'll be fixed later, when inline threads are
    // shrinked, so the root post won't be affected by them being shown.
    showInteractionsIfHidden(); // might move `placeWhere' to elsewhere
    $showReplyForm.apply(this, [event, placeWhere]);
    $menu.remove();
  });

  // Remove the menu after any action has been taken, and on Cancel click.
  $menu.mouseleave(function(){
    $menu.remove();
  });

  // If the user doesn't use the menu, remove it…
  var removeMenuTimeout = setTimeout(function(){
    $menu.remove();
  }, 1500);

  //… but cancel the remove-unused-menu timeout on mouseenter.
  $menu.mouseenter(function(){
    clearTimeout(removeMenuTimeout);
  });

  $lastInlineMenu = $menu;
}


// ------- Forms and actions

function confirmClosePage() {
  // If there're any reply forms with non-empty replies (textareas),
  // or any edit forms, then return a confirm close message.
  // (COULD avoid counting unchanged edits too.)
  // Count only :visible forms — non-visible forms are 1) hidden template
  // forms and 2) forms the user has closed. They aren't removed, because
  // it's nice to have your text reappear should you accidentally close
  // a form, but open it again.
  var replyCount = $('.dw-fs-re:visible').filter(function() {
    return $(this).find('textarea').val().length > 0;
  }).length;
  var editCount = $('.dw-f-e:visible').length;
  var msg = replyCount + editCount > 0 ?  // i18n
    'You have started writing but not saved your work. Really close page?' :
    undefined;  // don't return null, or IE asks roughly `confirm null?'
  return msg;
}

// Shows actions for the current post, or the last post hovered.
function $showActions() {
  // Hide any action links already shown; show actions for one post only.
  hideActions();
  // Show links for the the current post.
  $(this).closest('.dw-t').children('.dw-as')
    .css('visibility', 'visible')
    .attr('id', 'dw-p-as-shown');
}

function hideActions() {
  $('#dw-p-as-shown')
      .css('visibility', 'hidden')
      .removeAttr('id');
}

function $slideUp() {
  // COULD optimize: Be a $ extension that loops many elems then lastNow
  // would apply to all those (fewer calls to $drawParentsAndTree).
  var $i = $(this);
  var $post = $(this).closest('.dw-t').children('.dw-p');
  var lastNow = -1;
  var props = {
    height: 0,
    paddingTop: 0,
    paddingBottom: 0,
    marginTop: 0,
    marginBottom: 0
  };
  $i.animate(props, {
    duration: 530,
    step: function(now, fx) {
      // This callback is called once per animated property, but
      // we only need to redraw arrows once.
      if (lastNow === now) return;
      lastNow = now;
      $post.each(SVG.$drawParentsAndTree);
    }
  }).queue(function(next) {
    $i.hide();
    // Clear height etc, so $slideDown works properly.
    $.each(props, function(prop, val) {
      $i.css(prop, '');
    });
    next();
  });
}

function $slideDown() {
  // COULD optimize: See $slideUp(…).
  var $i = $(this);
  var $post = $i.closest('.dw-t').children('.dw-p');
  var realHeight = $i.height();
  $i.height(0).show().animate({height: realHeight}, {
    duration: 530,
    step: function(now, fx) {
      $post.each(SVG.$drawParentsAndTree);
    }
  });
  // Clear height and width, so $i adjusts its size after its child elems.
  $i.queue(function(next) {
    $(this).css('height', '').css('width', '');
    next();
  });
}

function $slideToggle() {
  if ($(this).is(':visible')) {
    $(this).each($slideUp);
  } else {
    $(this).each($slideDown);
  }
}

function fold($elem, how) {
  var $post = $elem.closest('.dw-t').children('.dw-p');
  $elem.animate(how.firstProps, {
    duration: how.firstDuration,
    step: function(now, fx) {
      $post.each(SVG.$drawParentsAndTree);
    }
  }).animate(how.lastProps, {
    duration: how.lastDuration,
    step: function(now, fx) {
      $post.each(SVG.$drawParentsAndTree);
    }
  });
}

function $foldInLeft() {
  // COULD optimize: See $slideUp(…), but pointless right now.
  var $i = $(this);
  var realHeight = $i.height();
  var realWidth = $i.width();
  $i.height(30).width(0).show();
  fold($i, {
    firstProps: {width: realWidth},
    firstDuration: 400,
    lastProps: {height: realHeight},
    lastDuration: 400
  });
  // Clear height and width, so $i adjusts its size after its child elems.
  $i.queue(function(next) {
    $(this).css('height', '').css('width', '');
    next();
  });
}

function $foldOutLeft() {
  // IE 7 and 8 bug fix: $.fold leaves the elem folded up
  // (the subsequent fold-left won't happen).
  if ($.browser.msie && $.browser.version < '9') {
    $(this).hide();
    return;
  }
  // COULD optimize: See $slideUp(…), but pointless right now.
  fold($(this), {
    firstProps: {height: 30},
    firstDuration: 400,
    lastProps: {width: 0, margin: 0, padding: 0},
    lastDuration: 400
  });
  // COULD clear CSS, so the elem gets its proper size should it be folded out
  // again later. Currently all elems that are folded out are also
  // $.remove()d though.
}

function removeInstantly($form) {
  var $thread = $form.closest('.dw-t');
  $form.remove();
  // Refresh SVG threads. When the last animation step callback was
  // invoked, the $form had not yet been remove()d.
  $thread.each(SVG.$drawPost).each(SVG.$drawParents);
  resizeRootThread();
}

// Action <form> cancel button -- won't work for the Edit form...?
function slideAwayRemove($form, opt_complete) {
  // Slide away <form> and remove it.
  var $thread = $form.closest('.dw-t');
  function rm(next) {
    if (opt_complete) opt_complete();
    removeInstantly($form);
    next();
  }
  // COULD elliminate dupl code that determines whether to fold or slide.
  if ($thread.filter('.dw-hor, .dw-debate').length &&  // COULD rm .dw-debate?
      !$form.closest('ol').filter('.dw-i-ts').length) {
    $form.each($foldOutLeft).queue(rm);
  }
  else {
    $form.each($slideUp).queue(rm);
  }
}


function $removeClosestForms() {
  // Sometimes the form is of class .dw-f, sometimes threre's a form parent
  // with class .dw-fs. Remove that parent if possible.
  var $formSetOrForm = $(this).closest('.dw-fs').add($(this).closest('.dw-f'));
  slideAwayRemove($formSetOrForm.first());
}


// Slide in reply, edit and rate forms -- I think it's
// easier to understand how they are related to other elems
// if they slide in, instead of just appearing abruptly.
// If $where is specified, $form is appended to the thread 
// $where.closest('.dw-t'), otherwise it is assumed that it has
// alread been inserted appropriately.
function slideInActionForm($form, $where) {
  if ($where) {
    // Insert before the first .dw-fs, or the .dw-res, or append.
    var $thread = $where.closest('.dw-t');
    var $oldFormOrCmts = $thread.children('.dw-fs, .dw-res').filter(':eq(0)');
    if ($oldFormOrCmts.length) $oldFormOrCmts.before($form);
    else $thread.append($form);
  }
  else $where = $form.closest('.dw-t');
  // Extra width prevents float drop.
  resizeRootThreadExtraWide();
  // Slide in from left, if <form> siblings ordered horizontally.
  // Otherwise slide down (siblings ordered vertically).
  if ($where.filter('.dw-hor, .dw-debate').length && // COULD rm .dw-debate?
      !$form.closest('ol').filter('.dw-i-ts').length) {
    $form.each($foldInLeft);
  } else {
    $form.each($slideDown);
  }

  // Scroll form into view, and cancel extra width.
  // Or add even more width, to prevent float drops
  // -- needs to be done also when sliding downwards, since that sometimes
  // makes the root thread child threads wider.
  $form.queue(function(next){
      resizeRootThreadNowAndLater();
      $form.dwScrollIntoView();
      next();
    });
}


/**
 * Changes this form to a HoverSubmit form, if there's a mouse.
 * Always adds a login-and-submit-on-click handler to the form.
 *
 * A hoversubmit form is a "Don't click just point" interface,
 * that is, if you point with the mouse on something, that triggers
 * a click. — This confuses new users, but is much faster, once
 * you've figured out how it works. (Since you don't need to stop and
 * click on any button, instead just do a quick mouse gesture and
 * you're done.)
 *
 * Currently used by the Rate form only (because you're supposed
 * to rate very many posts, and then that'd better be something
 * you do very quickly?).
 *
 * options.onLoginOut(username/undefined) — Called on login/logout.
 */
function makeHoverSubmitForm($formParent, event, options) {
  var settings = $.extend({}, options);

  // For touch devices, change nothing; use the Cancel and Submit buttons.
  if (Modernizr.touch) { UNTESTED;
    $formParent.find('input[type="submit"]').each(
        $loginSubmitOnClick(settings.onLoginOut));
    return;
  }

  var $overlay =
      $('<div class="dw-hoversubmit-overlay ui-widget-overlay"></div>')
      .appendTo($formParent);  // now removed when form removed

  var $form = $formParent.children('form');

  // On mouseenter, non-submit inputs: Simulate a click :-)
  // For now, implement this for checkboxes only (that's the only
  // non-submit/cancel input in the Rate form).
  $form.find('input[type="checkbox"]').each(function() {
    // Click the input when the mouse enters its graphical representation
    // (which is the input's label, not the input itself, for jQuery UI
    // checkboxes).
    var $btn = $(this);
    $btn.button('widget').mouseenter(function() {
      $btn.click();
      // Since the click has already happened, the hover state means
      // nothing — the hover colors however obscure the fact that the
      // input has already changed state.
      $(this).removeClass('ui-state-hover');
    });
  });

  // On mouseenter: Cancel button: Cancel.
  // Submit button: Optionally, login and call
  // settings.onLoginOut. Then submit form.
  $form.addClass('dw-hoversubmit')
      .find('.dw-fi-submit').click(function() {
        // Don't submit on click. (Instead, submit on mouseenter.)
        return false;
      })
      .each($loginSubmitOnMouseenter(settings.onLoginOut)).end()
      .find('.dw-fi-cancel').mouseenter(function() {
        cancelForm();
      });

  // Enter and Esc shortcuts. (Since this form is the only thing visible,
  // everyone should understand what happens should they click Enter or Esc.)
  $form.keyup(function(event) {
    if (event.keyCode === KEYCODE_ENTER) $form.submit();
    else if (event.keyCode === KEYCODE_ESC) cancelForm();
    else return;
    return false;
  });

  // Removes the form, and shows 'Cancelled.' for a short while, because
  // new users might not realize that the Cancel click happens on hover.
  function cancelForm() {
    var $info = $('#dw-hidden-templates .dw-inf-cancelled-form').clone();
    $formParent.replaceWith($info);

    // Any parent .dw-p-as is visible on hover only. Make it visible always,
    // until the $info has been removed.
    var $parentActionList = $info.parent('.dw-p-as');
    var withTipsClass = 'dw-p-as-with-tips';
    $parentActionList.addClass(withTipsClass);

    // Remove info after a while.
    setTimeout(removeInfo, 2000);
    $info.click(function() {
      removeInfo();
      // If the Reply etc buttons suddenly becomes invisible,
      // because withTipsClass is removed, the user would be confused?
      $parentActionList.each($showActions);
    });

    function removeInfo() {
      $info.fadeOut(function() {
        $info.remove();
        $parentActionList.removeClass(withTipsClass);
      });
    }
  }

  // Weird focus behavior workaround.
  // For some reason, whenever you toggle a checkbox in the $form,
  // focus moves to [something unknown and invisible, outside the form].
  // This breaks the above keyboard Enter and Esc shortcuts.
  // For now, work around that, by moving focus back to the form.
  $form.mouseup(function() {
    $form.find('.dw-fi-submit:enabled, .dw-fi-cancel').first().focus();
  });

  // Place the form where the mouse click happened, and inside the viewport.
  // 'fit fit' has no effect if outside the left and top viewport
  // borders though (but works for the bottom and right borders).
  var offsetY = 20;
  $form.position({ of: event, collision: 'fit fit', offset: '0 -'+ offsetY });

  // Place the cancel button above the form (instead of below it),
  // if the mouse is below the form midpoint — so you don't need to move
  // the mouse over the Cancel button (which submits on mouseenter).
  // This happens if the button you clicked is close to the lower edge
  // of the window — then $.position moves the form upwards so it fits
  // in the viewport.
  var okDistFromMidpoint = offsetY + 1;
  var formMidpOffsY = $form.offset().top + $form.outerHeight()/2;
  if (formMidpOffsY + okDistFromMidpoint < event.pageY) {
    // Mouse cursor below form midpoint.
    $form.find('.dw-fi-cancel').addClass('dw-flip');
  }

  die2If(!$formParent.is(':visible')); // or focus() would have no effect
  $form.find('input.dw-fi-cancel').focus();
}



// ------- Templates and notifications

// Returns $(an-error-message-in-a-<div>), which you can .insertAfter
// something, to indicate e.g. the server refused to accept the
// suggested edits.
// COULD remove this function! And let the server reply via
// FormHtml._responseDialog, and use (a modified version of?)
// showServerResponseDialog() (below) to construct an error info box.
// Then this would work with javascript disabled, and i18n would be
// handled server side.
function notifErrorBox$(error, message, details) {
  var when = '' // (Does toISOString exist in all browsers?)
  try { when = (new Date).toISOString(); } catch (e) {}
  var $box = $(
      '<div class="ui-widget dw-ntf">' +
        '<div class="ui-state-error ui-corner-all">' +
          '<a class="ui-dialog-titlebar-close ui-corner-all" role="button">' +
            '<span class="ui-icon ui-icon-closethick">close</span>' +
          '</a>' +
          '<span class="ui-icon ui-icon-alert" ' +
                'style="float: left; margin-right: .3em;"></span>' +
          '<div class="dw-ntf-bd">' +
            '<div class="dw-ntf-sts"></div> ' +
            '<div class="dw-ntf-msg"></div>' +
            '<div class="dw-ntf-at">'+ when +'</div>' +
            (details ?
               '<br><a class="dw-ntf-shw">Show details</a>' +
               '<pre class="dw-ntf-dtl"></pre>' : '') +
          '</div>' +
        '</div>' +
      '</div>');
  var $showDetails = $box.find('a.dw-ntf-shw');
  var $details = $box.find('.dw-ntf-dtl');
  error = error ? error +':' : ''
  // I don't use jQuery's .tmpl: .text(...) is xss safe, .tmpl(...) is not?
  $box.find('.dw-ntf-sts').text(error).end()
      .find('.dw-ntf-msg').text(message).end()
      .find('.dw-ntf-dtl').text(details || '').hide().end()
      .find('.dw-ntf-shw').click(function() {
        $details.toggle();
        $showDetails.text(
            $details.filter(':visible').length ?
               'Hide details' : 'Show details');
      }).end()
      .find('a.ui-dialog-titlebar-close').click(function() {
        $box.remove();
      });
  return $box;
}


$.fn.dwActionLinkEnable = function() {
  setActionLinkEnabled(this, true);
  return this;
}


$.fn.dwActionLinkDisable = function() {
  setActionLinkEnabled(this, false);
  return this;
}


function setActionLinkEnabled($actionLink, enabed) {
  if (!$actionLink.length) return;
  bugIf(!$actionLink.is('.dw-a'));
  if (!enabed) {
    // (Copy the event list; off('click') destroys the original.)
    var handlers = $actionLink.data('events')['click'].slice();
    $actionLink.data('DisabledHandlers', handlers);
    $actionLink.addClass('dw-a-disabled').off('click');
  } else {
    var handlers = $actionLink.data('DisabledHandlers');
    $actionLink.removeData('DisabledHandlers');
    $.each(handlers, function(index, handler) { 
      $actionLink.click(handler);
    });
    $actionLink.removeClass('dw-a-disabled');
  }
}


function disableSubmittedForm($form) {
  $form.children().css('opacity', '0.7').find('input').dwDisable();
  // Show a 'Submitting ...' tips. CSS places it in the middle of the form.
  var $info = $('#dw-hidden-templates .dw-inf-submitting-form').clone();
  $form.append($info);
}


// Builds a function that shows an error notification and enables
// inputs again (e.g. the submit-form button again, so the user can
// fix the error, after having considered the error message,
// and attempt to submit again).
function showErrorEnableInputs($form) {
  return function(jqXHR, errorType, httpStatusText) {
    var $submitBtns = $form.find('.dw-submit-set');
    var $thread = $form.closest('.dw-t');
    var err = jqXHR.status ? (jqXHR.status +' '+ httpStatusText) : 'Error'
    var msg = (jqXHR.responseText || errorType || 'Unknown error');
    notifErrorBox$(err, msg).insertAfter($submitBtns).dwScrollToHighlighted();
    $thread.each(SVG.$drawParentsAndTree); // because of the notification
    // For now, simply enable all inputs always.
    $form.children().css('opacity', '');
    $form.find('input, button').dwEnable();
    $form.children('.dw-inf-submitting-form').remove();
  };
}


// Constructs and shows a dialog, from either 1) a servers html response,
// which should contain certain html elems and classes, or 2)
// a jQuery jqXhr object.
function showServerResponseDialog(jqXhrOrHtml, opt_errorType,
                                  opt_httpStatusText, opt_continue) {
  var $html, title, width;
  var html, plainText;

  // Find html or plain text.
  if (!jqXhrOrHtml.getResponseHeader) {
    html = jqXhrOrHtml;
  }
  else {
    var contentType = jqXhrOrHtml.getResponseHeader('Content-Type');
    if (!contentType) {
      plainText = '(no Content-Type header)';
      if (jqXhrOrHtml.state && jqXhrOrHtml.state() == 'rejected') {
        plainText = plainText + '\n($.Deferred was rejected)';
      }
    }
    else if (contentType.indexOf('text/html') !== -1) {
      html = jqXhrOrHtml.responseText;
    }
    else if (contentType.indexOf('text/plain') !== -1) {
      plainText = jqXhrOrHtml.responseText;
    }
    else {
      die2('DwE94ki3');
    }
  }

  // Format dialog contents.
  if (html) {
    var $allHtml = $(html);
    $html = $allHtml.filter('.dw-dlg-rsp');
    if (!$html.length) $html = $allHtml.find('.dw-dlg-rsp');
    if ($html.length) {
      title = $html.children('.dw-dlg-rsp-ttl').text();
      width = jQueryDialogDefault.width;
    } else {
      plainText = 'Internal server error.';
    }
  }

  if (plainText) {
    // Set title to something like "403 Forbidden", and show the
    // text message inside the dialog.
    title = jqXhrOrHtml.status ?
              (jqXhrOrHtml.status +' '+ opt_httpStatusText) : 'Error'
    $html = $('<pre class="dw-dlg-rsp"></pre>');
    width = 'auto'; // avoids scrollbars in case of any long <pre> line
    // Use text(), not plus (don't: `... + text + ...'), to prevent xss issues.
    $html.text(plainText || opt_errorType || 'Unknown error');
  }
  else if (!html) {
    die2('DwE05GR5');
  }

  // Show dialog.
  $html.children('.dw-dlg-rsp-ttl').remove();
  $html.dialog($.extend({}, jQueryDialogNoClose, {
    title: title,
    autoOpen: true,
    width: width,
    buttons: {
      OK: function() {
        $(this).dialog('close');
        if (opt_continue) opt_continue();
      }
    }
  }));
}


// ------- User properties

// Updates cookies and elements to show the user name, email etc.
// as appropriate. Unless !propsUnsafe, throws if name or email missing.
// Fires the dwEvLoggedInOut event on all .dw-loginsubmit-on-click elems.
// Parameters:
//  props: {name, email, website}, will be sanitized unless
//  sanitize: unless `false', {name, email, website} will be sanitized.
function fireLogout() {
  Me.refreshProps();
  $('#dw-u-info').hide();
  $('#dw-a-logout').hide();
  $('#dw-a-login').show();

  // Clear all xsrf tokens. They are invalid now after logout, because
  // the server instructed the browser to delete the session id cookie.
  $('input.dw-fi-xsrf').attr('value', '');

  // Let `Post as <username>' etc buttons update themselves:
  // they'll replace <username> with `...'.
  $('.dw-loginsubmit-on-click, .dw-loginsubmit-on-mouseenter')
      .trigger('dwEvLoggedInOut', [undefined]);

  Me.clearMyPageInfo();
}


function fireLogin() {
  Me.refreshProps();
  $('#dw-u-info').show()
      .find('.dw-u-name').text(Me.getName());
  $('#dw-a-logout').show();
  $('#dw-a-login').hide();

  // Update all xsrf tokens in any already open forms (perhaps with
  // draft texts, we shuldn't close them). Their xsrf prevention tokens
  // need to be updated to match the new session id cookie issued by
  // the server on login.
  var token = $.cookie('dwCoXsrf');
  //$.cookie('dwCoXsrf', null, { path: '/' }); // don't send back to server
  // ^ For now, don't clear the dwCoXsrf cookie, because then if the user
  // navigates back to the last page, after having logged out and in,
  // the xsrf-inputs would need to be refreshed from the cookie, because
  // any token sent from the server is now obsolete (after logout/in).
  $('input.dw-fi-xsrf').attr('value', token);

  // Let Post as ... and Save as ... buttons update themselves:
  // they'll replace '...' with the user name.
  $('.dw-loginsubmit-on-click, .dw-loginsubmit-on-mouseenter')
      .trigger('dwEvLoggedInOut', [Me.getName()]);

  Me.clearMyPageInfo();
  Me.loadAndMarkMyPageInfo();
}


// Returns a user object, with functions refreshProps, getName,
// isLoggedIn, getLoginId and getUserId.
function makeCurUser() {
  // Cache user properties — parsing the session id cookie over and
  // over again otherwise takes 70 - 80 ms on page load, but only
  // 2 ms when cached. (On my 6 core 2.8 GHz AMD, for a page with
  // 100 posts. The user id is checked frequently, to find out which
  // posts have the current user written.)
  var userProps;
  var emailPrefs = undefined;
  var emailSpecified = false;
  var permsOnPage = {};

  function refreshProps() {
    parseSidCookie();
    parseConfigCookie();
  }

  // Warning: Never use the user's name as html, that'd allow xss attacks.
  // (loginId and userId are generated by the server.)
  function parseSidCookie() {
    // sid example:
    //   Y1pBlH7vY4JW9A.23.11.Magnus.1316266102779.15gl0p4xf7
    var sid = $.cookie('dwCoSid');
    if (!sid) {
      userProps = { loginId: undefined, userId: undefined, name: undefined };
      return;
    }
    var arr = sid.split('.');
    userProps = {
      // [0] is a hash
      loginId: arr[1],
      userId: arr[2],
      name: arr[3].replace('_', '.')
      // [4] is login time
      // [5] is a random value
    };
  }

  function parseConfigCookie() {
    var val = $.cookie('dwCoConf');
    emailPrefs = undefined;
    emailSpecified = false;
    if (!val) return;
    if (val.indexOf('EmNtR') !== -1) emailPrefs = 'Receive';
    if (val.indexOf('EmNtN') !== -1) emailPrefs = 'DontReceive';
    if (val.indexOf('EmNtF') !== -1) emailPrefs = 'ForbiddenForever';
    if (val.indexOf('EmSp') !== -1) emailSpecified = true;
  }

  function fireLoginIfNewSession(opt_loginIdBefore) {
    // Sometimes an event object is passed instead of a login id.
    var loginIdBefore = typeof opt_loginIdBefore == 'string' ?
        opt_loginIdBefore : userProps.loginId;
    Me.refreshProps();
    if (loginIdBefore !== userProps.loginId) {
      if (Me.isLoggedIn()) fireLogin();
      else fireLogout();
      // If the login/logout happened in another browser tab:
      // COULD pop up a modal dialog informing the user that s/he has
      // been logged in/out, because of something s/he did in *another* tab.
      // And that any posts s/he submits will be submitted as the new user.
    }
  }

  /**
   * Clears e.g. highlightings of the user's own posts and ratings.
   */
  function clearMyPageInfo() {
    $('.dw-p-by-me').removeClass('dw-p-by-me');
    $('.dw-p-r-by-me').remove();
    permsOnPage = {};
  }

  /**
   * Highlights e.g. the user's own posts and ratings.
   *
   * Loads user specific info from the server, e.g. info on
   * which posts the current user has authored or rated,
   * and the user's permissions on this page.
   *
   * If, however, the server has already included the relevant data
   * in a certain hidden .dw-data-yaml node on the page, then use
   * that data, but only once (thereafter always query the server).
   * — So the first invokation happens synchronously, subsequent
   * invokations happens asynchronously.
   */
  function loadAndMarkMyPageInfo() {
    // Avoid a roundtrip by using any yaml data already inlined on the page.
    // Then delete it because it's only valid on page load.
    var hiddenYamlTag = $('.dw-data-yaml');
    if (hiddenYamlTag.length) {
      parseYamlMarkActions(hiddenYamlTag.text());
      hiddenYamlTag.hide().removeClass('dw-data-yaml');
    }
    else {
      // Query the server.
      // On failure, do what? Post error to non existing server error
      // reporting interface?
      $.get('?page-info&user=me', 'text')
          .fail(showServerResponseDialog)  // for now
          .done(function(yamlData) {
        parseYamlMarkActions(yamlData);
      });
    }

    function parseYamlMarkActions(yamlData) {
      var pageInfo = YAML.eval(yamlData);
      permsOnPage = pageInfo.permsOnPage;
      markMyActions(pageInfo);
    }

    function markMyActions(actions) {
      if (actions.ratings) $.each(actions.ratings, showMyRatings);
      if (actions.authorOf) $.each(actions.authorOf, function(ix, postId) {
        markMyPost(postId);
      });
    }
  }

  return {
    // Call whenever the SID changes: on page load, on login and logout.
    refreshProps: refreshProps,
    clearMyPageInfo: clearMyPageInfo,
    loadAndMarkMyPageInfo: loadAndMarkMyPageInfo,
    // Call when a re-login might have happened, e.g. if focusing
    // another browser tab and then returning to this tab.
    fireLoginIfNewSession: fireLoginIfNewSession,

    // Warning: Never ever use this name as html, that'd open for
    // xss attacks. E.g. never do: $(...).html(Me.getName()), but the
    // following should be okay though: $(...).text(Me.getName()).
    getName: function() { return userProps.name; },
    isLoggedIn: function() { return userProps.loginId ? true : false; },
    getLoginId: function() { return userProps.loginId; },
    getUserId: function() { return userProps.userId; },
    mayEdit: function($post) {
      return userProps.userId === $post.dwAuthorId() ||
          permsOnPage.editPage ||
          (permsOnPage.editAnyReply && $post.dwIsReply()) ||
          (permsOnPage.editUnauReply && $post.dwIsUnauReply());
    },
    getEmailNotfPrefs: function() { return emailPrefs; },
    isEmailKnown: function() { return emailSpecified; }
  };
}


function showMyRatings(postId, ratings) {
  var $header = getPostHeader$(postId);
  var $myRatings = $(  // i18n
    '<span>. <span class="dw-p-r-by-me">You rated it <em></em></span></span>');
  $myRatings.find('em').text(ratings.join(', '));
  $header.children('.dw-p-r-by-me').remove(); // remove any old
  // Insert after authorship, flags and ratings info.
  $header.children('.dw-p-r-top, .dw-p-flgs-top, .dw-p-at')
      .last().after($myRatings);
  // Remove outer <span>.
  $myRatings = $myRatings.children().unwrap();
  return $myRatings;
}


function markMyPost(postId) {
  var $header = getPostHeader$(postId);
  $header.children('.dw-p-by').addClass('dw-p-by-me');
}


// ------- Logout

// COULD refactor jQuery UI dialog usage: a function that creates a default
// Debiki dialog. E.g. hide the submit input, and set defaut properties.

function showLogout() {
  initLogout();
  $('#dw-fs-lgo').dialog('open');
}

function initLogout() {
  var $logout = $('#dw-fs-lgo');
  if ($logout.is('.ui-dialog-content'))
    return; // already inited

  var $logoutForm = $logout.find('form');
  $logout.find('input').hide(); // Use jQuery UI's dialog buttons instead
  $logout.dialog($.extend({}, jQueryDialogDefault, {
    height: 180,
    width: 280,
    buttons: {
      Cancel: function() {
        $(this).dialog('close');
      },
      'Log out': function() {
        $(this).dialog('close');
        $logoutForm.submit();
      }
    }
  }));
  $logoutForm.submit(function() {
    // Don't clear the user name and email cookies until the server has
    // indeed logged out the user.
    var postData = $logoutForm.serialize();
    $.post($logoutForm.attr("action"), postData, function() {
      // The server has now logged out the user.
      fireLogout();
    }, 'html');
    return false;
  });
}

// ------- Login result

function showLoginOkay(opt_continue) {
  initLoginResultForms(opt_continue);
  $('#dw-fs-lgi-ok-name').text(Me.getName());
  $('#dw-fs-lgi-ok').dialog('open');
}

function showLoginFailed(errorMessage) {
  initLoginResultForms();
  $('#dw-fs-lgi-failed-errmsg').text(errorMessage);
  $('#dw-fs-lgi-failed').dialog('open');
}

var initLoginResultForms = (function() {
  var continueClbk;
  return function(opt_continue) {  // COULD remove this function?...
          // ...No longer called on login OK? Is it called on failure?
    continueClbk = opt_continue;
    if ($('#dw-fs-lgi-ok.ui-dialog-content').length)
      return; // login-ok and -failed already inited

    var $loginResult = $('#dw-fs-lgi-ok, #dw-fs-lgi-failed');
    var $loginResultForm = $loginResult.find('form');
    $loginResult.find('input').hide(); // Use jQuery UI's dialog buttons instead
    $loginResult.dialog($.extend({}, jQueryDialogNoClose, {
      buttons: {
        'OK': function() {
          $(this).dialog('close');
          !continueClbk || continueClbk();
        }
      }
    }));
  }
})();


// ------- Login, simple

function initLoginSimple() {
  var $login = $('#dw-fs-lgi-simple');
  if ($login.is('.ui-dialog-content'))
    return; // already inited

  var $loginForm = $login.find('form');
  $login.find('.dw-fi-submit').hide();  // don't show before name known
  // Use jQueryDialogReset so email is not remembered, in case
  // this is a public computer, e.g. in a public library.
  // Usually (?) the browser itself helps you fill in form fields, e.g.
  // suggests your email address?
  $login.dialog($.extend({}, jQueryDialogReset, {
    width: 452,
    buttons: {
      Submit: function() {
        $loginForm.submit();
      },
      Cancel: function() {
        $(this).dialog('close');
      }
    }
  }));

  $loginForm.submit(function() {
    // COULD show a "Logging in..." message — the roundtrip
    // might take a second if the user is far away?
    $.post($loginForm.attr("action"), $loginForm.serialize(), 'html')
        .done(function(data) {
          // Warning: Somewhat dupl code, see internal.handleLoginResponse.
          // User info is now available in cookies.
          $login.dialog('close');
          fireLogin();
          // Show response dialog, and continue with whatever caused
          // the login to happen.
          // {{{ If the login happens because the user submits a reply,
          // then, if the reply is submitted (from within
          // continueAnySubmission) before the dialog is closed, then,
          // when the browser moves the viewport to focus the new reply,
          // the welcome dialog might no longer be visible in the viewport.
          // But the viewport will still be dimmed, because the welcome
          // dialog is modal. So don't continueAnySubmission until
          // the user has closed the response dialog. }}}
          showServerResponseDialog(data, null, null, continueAnySubmission);
        })
        .fail(showServerResponseDialog)
        .always(function() {
          // COULD hide any "Logging in ..." dialog.
        });
    return false;
  });

  $login.find('.dw-a-login-openid')
      .button().click(function() {
        showLoginOpenId();
        return false;
      });
}


function $loginSubmitOnClick(loginEventHandler, data) {
  return _$loginSubmitOn('click', loginEventHandler, data);
}


function $loginSubmitOnMouseenter(loginEventHandler, data) {
  return _$loginSubmitOn('mouseenter', loginEventHandler, data);
}


function _$loginSubmitOn(eventType, loginEventHandler, data) {
  return function() {
    var $i = $(this);
    $i.addClass('dw-loginsubmit-on-'+ eventType);
    !loginEventHandler || $i.bind('dwEvLoggedInOut', loginEventHandler);
    $i.on(eventType, null, data, $loginThenSubmit)
  };
}


// Invoke on a .login-on-click submit <input>. After the login
// has been completed, the button will be submitted, see
// continueAnySubmission(). If already logged in, submits immediately.
function $loginThenSubmit(event) {
  loginOnClickBtnClicked = this;
  continueLoginAskAboutEmail = event.data && event.data.askAboutEmailNotfs;
  if (!Me.isLoggedIn()) {
    // Will call continueAnySubmission(), after login.
    // {{{ Hmm, could add a `continue' callback to showLogin() instead!?
    // But initLoginSimple/OpenId runs once only, so the very first
    // anonymous function is the only one considered, so a somewhat
    // global callback-to-invoke-state is needed anyway.
    // Better move login stuff to a separate module (with a module
    // local "global" callback state).}}}
    showLoginSimple();
  } else {
    continueAnySubmission();
  }
  return false;  // skip default action; don't submit until after login
}


/**
 * Continues any form submission that was interrupted by the
 * user having to log in.
 */
function continueAnySubmission() {
  // Configure email notification prefs, unless already done.
  // (This is useful e.g. if the user submits a reply but hasn't
  // specified her email prefs. We want her to subscribe to
  // email notfs, and right now her motivation is at its peak?)
  var emailQuestion = $.Deferred().resolve();
  if (continueLoginAskAboutEmail) {
    continueLoginAskAboutEmail = false;
    if (!Me.getEmailNotfPrefs()) {
      emailQuestion = configEmailPerhapsRelogin();
    }
  }

  // If the login was initiated via a click on a
  // .dw-loginsubmit-on-click button, continue the submission
  // process that button is supposed to start.
  emailQuestion.done(function() {
    $(loginOnClickBtnClicked).closest('form').submit();
  }).always(function() {
    loginOnClickBtnClicked = null;
  });
}


var configEmailPerhapsRelogin = (function() {
  var dialogStatus;

  return function() {
    dialogStatus = $.Deferred();

    var $form = $('#dw-f-eml-prf');
    var $emailAddrDiv = $form.find('.dw-f-eml-prf-adr');
    var $dontRecvBtn = $form.find('#dw-fi-eml-prf-rcv-no');
    var $yesRecvBtn = $form.find('#dw-fi-eml-prf-rcv-yes');

    // Init dialog, do once only.
    if (!$form.parent().is('.ui-dialog')) {
      $form.dialog($.extend({}, jQueryDialogDefault, {
        close: function() {
          dialogStatus.reject();
          // Better not remember email addr. Perhaps this is a public
          // computer, e.g. in a public library.
          jQueryDialogReset.close.apply(this);
        }
      }));
      $('#dw-f-eml-prf').find('input[type="radio"], input[type="submit"]')
          .button();

      $dontRecvBtn.click(submitForm); // always
      $form.submit(function() {
        $yesRecvBtn.button('enable'); // or value not posted

        // When you change your email address, this triggers a re-login,
        // if you use an unauthenticated identity — because the email is
        // part of that identity. We need to know if a login happens.
        var loginIdBefore = Me.getLoginId();

        $.post($form.attr('action'), $form.serialize(), 'html')
            .done(function(responseHtml) {
              // Fire login event, to update xsrf tokens, if the server
              // created a new login session (because we changed email addr).
              Me.fireLoginIfNewSession(loginIdBefore);

              dialogStatus.resolve();
              $form.dialog('close');
              // (Ignore responseHtml; it's empty, or a Welcome message.)
            })
            .fail(showServerResponseDialog);
        return false;
      });
    }

    // Hide email input, if email addr already specified,
    // and submit directly on Yes/No click.
    function submitForm() {
      $form.submit();
      return false;
    }
    function showEmailAddrInp() {
      $emailAddrDiv.show();
      $yesRecvBtn.button('disable');
    }
    $emailAddrDiv.hide();
    $yesRecvBtn.button('enable');
    if (Me.isEmailKnown()) {
      // Submit directly; need not ask for email addr.
      $yesRecvBtn.click(submitForm);
      $yesRecvBtn.off('click', showEmailAddrInp);
    } else {
      // Ask for email addr; submit via Done button.
      $yesRecvBtn.click(showEmailAddrInp);
      $yesRecvBtn.off('click', submitForm);
    }

    $form.dialog('open');
    return dialogStatus;
  }
})();


function showLoginSimple() {
  initLoginSimple();
  $('#dw-fs-lgi-simple').dialog('open');  // BUG Tag absent unless…
          //… a debate is shown, so the dw-hidden-templates included.
  // Preload OpenID resources, in case user clicks OpenID login button.
  loadOpenIdResources();
}



// ------- Login, OpenID


function showLoginOpenId() {
  loadOpenIdResources().done(function() {
    initLoginOpenId();
    $('#dw-fs-openid-login').dialog('open');
  });
}


var loadOpenIdResources = (function() {
  var loadStatus;
  return function() {
    if (loadStatus)
      return loadStatus;
    loadStatus = $.Deferred();
    // (COULD load these files directly in the <head>, on desktops,
    // and load a single .min.js.gz on mobiles. And load one at a time
    // in Dev builds. But that'd be 3 different cases! Postpone...)
    Modernizr.load({
      load: [
        '/-/res/openid-selector/css/openid.css',
        '/-/res/openid-selector/js/openid-jquery.js',
        '/-/res/openid-selector/js/openid-en.js',
        '/-/res/popuplib.js'],
      complete: function() {
        loadStatus.resolve();
      }
    });
    return loadStatus;
  }
})();


function initLoginOpenId() {
  var $openid = $('#dw-fs-openid-login');
  if ($openid.is('.ui-dialog-content'))
    return; // already inited

  openid.img_path = '/-/res/openid-selector/images/';
  openid.submitInPopup = submitLoginInPopup;
  // Keep default openid.cookie_expires, 1000 days
  // — COULD remove cookie on logout?
  openid.init('openid_identifier');

  // Use jQueryDialogReset, so OpenID cleared on close,
  // in case this is a public computer?
  $openid.dialog($.extend({}, jQueryDialogReset, {
    width: 670,
    height: 410, // (incl. extra space for 'Enter your OpenID' input field)
    // Place above guest login dialog.
    zIndex: jQueryDialogDefault.zIndex + 10,
    buttons: {
      Cancel: function() {
        $(this).dialog('close');
      }
    }
  }));
}


// Submits an OpenID login <form> in a popup. Dims the window and
// listens for the popup to close.
function submitLoginInPopup($openidLoginForm) {
  // Based on popupManager.createPopupOpener, from popuplib.js,
  // in this folder.

  var width = 450;
  var height = 500;
  var coordinates = popupManager.getCenteredCoords(width, height);

  // Here is described how to configure the popup window:
  // http://svn.openid.net/repos/specifications/user_interface/1.0/trunk
  //    /openid-user-interface-extension-1_0.html
  var popupWindow = window.open('', 'LoginPopup',
      'width='+ width +',height='+ height +
      ',status=1,location=1,resizable=yes'+
      ',left='+ coordinates[0] +',top='+ coordinates[1]);

  // Check to perform at each execution of the timed loop. It also triggers
  // the action that follows the closing of the popup
  var waitCallback = window.setInterval(waitForPopupClose, 80);
  function waitForPopupClose() {
    if (popupWindow && !popupWindow.closed) return;
    popupWindow = null;
    var darkCover = window.document.getElementById(
        window.popupManager.constants['darkCover']);
    if (darkCover) {
      darkCover.style.visibility = 'hidden';
    }
    if (internal.handleLoginResponse !== null) {
      internal.handleLoginResponse({status: 'LoginFailed'});
    }
    if (waitCallback !== null) {
      window.clearInterval(waitCallback);
      waitCallback = null;
    }
  }

  // This callback is called from the return_to page:
  internal.handleLoginResponse = function(result) {
    internal.handleLoginResponse = null;
    var errorMsg;
    if (/openid\.mode=cancel/.test(result.queryString)) {
      // This seems to happen if the user clicked No Thanks in some
      // login dialog; when I click "No thanks", Google says:
      // "openid.mode=cancel&
      //  openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0"
      errorMsg = 'You cancelled the login process? [error DwE89GwJm43]';
    } else if (result.status === 'LoginFailed') {
      // User closed popup window?
      errorMsg = 'You closed the login window? [error DwE5k33rs83k0]';
    } else if (result.status !== 'LoginOk') {
      errorMsg = 'Unknown login problem [error DwE3kirsrts12d]';
    } else {
      // Login OK
      // {{{ The queryString is e.g. …
      // openid.ns=http://specs.openid.net/auth/2.0
      // openid.mode=id_res
      // openid.op_endpoint=https://www.google.com/accounts/o8/ud
      // openid.response_nonce=2011-04-10T20:14:19Zwq0i9rEOAN0QsA
      // openid.return_to=http://10.42.43.10:8080/openid/response
      // openid.assoc_handle=AOQobUdh75yilxlGb-KbwvcLIocAG...
      // openid.signed=op_endpoint,claimed_id,identity,return_to,
      //    response_nonce,assoc_handle,ns.ext1,ext1.mode,ext1.type.first,
      //    ext1.value.first,ext1.type.email,ext1.value.email,
      //    ext1.type.country,ext1.value.country
      // openid.sig=jlCF7WrP99%2Be1Ee8eq1s03JUE0h4wILx37FHZkv/KlA=
      // openid.identity=https://www.google.com/accounts/o8/id?id=AItOaw...
      // openid.claimed_id=https://www.google.com/accounts/o8/id?id=AItO...
      // openid.ns.ext1=http://openid.net/srv/ax/1.0
      // openid.ext1.mode=fetch_response
      // openid.ext1.type.first=http://axschema.org/namePerson/first
      // openid.ext1.value.first=Kaj+Magnus
      // openid.ext1.type.email=http://axschema.org/contact/email
      // openid.ext1.value.email=someone@example.com
      // openid.ext1.type.country=http://axschema.org/contact/country/home
      // openid.ext1.value.country=SE
      // }}}

      // Warning: Somewhat dupl code, compare w initLoginSimple.
      $('#dw-fs-openid-login').dialog('close');
      $('#dw-fs-lgi-simple').dialog('close');
      fireLogin();
      showLoginOkay(continueAnySubmission);
      return;
    }

    showLoginFailed(errorMsg);
  }

  // TODO dim the main win, open a modal dialog: "Waiting for you to log in",
  // and a Cancel button, which closes the popup window.
  // — Then the user can continue also if the popup gets lost (perhaps
  // lots of windows open).

  // Make the default submit action submit the login form in the popup window.
  $openidLoginForm.attr('target', 'LoginPopup');
}


// ------- Rating

function $showRatingForm(event) {
  var $thread = $(this).closest('.dw-t');
  clearfix($thread); // ensures the rating appears nested inside the thread
  var $post = $thread.children('.dw-p');
  var $formParent = rateFormTemplate.clone(true);
  var $rateForm = $formParent.children('form');
  var $rateAction = $thread.find(' > .dw-p-as > .dw-a-rate');
  var $submitBtn = $rateForm.find('input[type="submit"]');
  var $cancelBtn = $rateForm.find('input.dw-fi-cancel');
  var postId = $post.dwPostId();

  // The rating-value inputs are labeled checkboxes. Hence they
  // have ids --- which right now remain the same as the ids
  // in the rateFormTemplate. Make the cloned ids unique:
  makeIdsUniqueUpdateLabels($formParent);

  // If the user has already rated the $post, show a
  // you're-changing-your-ratings tips, instead of
  // the you-can-select-many-tags tips.
  if ($post.find('.dw-p-hd > .dw-p-r-by-me').length) {
    $rateForm.find('.dw-f-r-inf-many').hide();
    $rateForm.find('.dw-f-r-inf-changing').css('display', 'block');
  }

  // People sometimes unintentionally open many rating forms, unless:
  $rateAction.dwActionLinkDisable();
  $cancelBtn.click(function() { $rateAction.dwActionLinkEnable(); });

  // Enable submit *button* when ratings specified
  $formParent.find("input[type='checkbox']").click(function(){
    var numChecked = $rateForm.find('.ui-button.ui-state-active').length;
    $submitBtn.button('option', 'disabled', numChecked == 0)
    if (numChecked > 0) $rateForm.find('input.dw-fi-submit').focus();
  });

  // Ajax-post ratings on submit.
  //  - Disable form until request completed.
  //  - When completed, highlight the user's own ratings.
  $formParent.submit(function(){
    // Find selected rating tags, so they can be highlighted later.
    var ratedTags = $formParent.find("input:checked").map(function(){
      return $(this).val().toLowerCase();
    }).get();

    $.post(Settings.makeRatePostUrl(debateId, rootPostId, postId),
          $rateForm.serialize(), 'html')
        .done(function(recentChangesHtml) {
      slideAwayRemove($formParent);
      $rateAction.dwActionLinkEnable();
      updateDebate(recentChangesHtml);
      var $ratings = showMyRatings(postId, ratedTags);
      // Minor bug: On my Android phone, when I rate a post at the very
      // bottom of the page, then, since the `slideAwayRemove` animation
      // plays at the same time as the below `dwScrollToThenHighlight`
      // animation, the dwScrollIntoView animation is distorted, and
      // the ratings won't be properly scrolled into view.
      $post.dwPostFindHeader().dwScrollToThenHighlight($ratings);
      $post.each(SVG.$drawParentsAndTree);
    });

    disableSubmittedForm($rateForm);
    return false;
  });

  // Fancy fancy
  // Seems this must be done *after* the rateFormTemplate has been
  // copied --- otherwise, if the Cancel button is clicked,
  // the rateFormTemplate itself has all its jQueryUI markup removed.
  // (Is that a jQuery bug? Only the *clone* ought to be affected?)
  $formParent.find('.dw-r-tag-set input, .dw-submit-set input').button();
  // Disable the submit button (until any checkbox clicked)
  $formParent.find("input[type='submit']").button("option", "disabled", true);
  $formParent.find('.dw-show-more-r-tags').
    button().addClass('dw-ui-state-default-linkified');

  var $actionBtns = $thread.children('.dw-p-as');

  $formParent.insertAfter($actionBtns).show()
      .find('input[type="submit"]').each($loginSubmitOnClick());
  $post.each(SVG.$drawParentsAndTree);

  $rateForm.dwScrollIntoView();
}


function $showMoreRatingTags() {
  $(this).hide().
      closest('form').find('.dw-more-r-tags').show();
}


// ------- Flagging

// warning: dupl code, see initDeleteForm,
// and initLogout/initLoginSimple/initLoginOpenId etc.
// COULD break out some common dialog init/show functions?
function initFlagForm() {
  var $form = $('#dw-f-flg');
  var $parent = $form.parent();
  if ($parent.is('.ui-dialog-content'))
    return; // already inited

  $form.find('.dw-submit-set input').hide(); // use jQuery UI's buttons instead
  $form.find('.dw-f-flg-rsns').buttonset();
  $parent.dialog($.extend({}, jQueryDialogReset, {
    width: mobileWidthOr(430),
    buttons: {
      'Cancel': function() {
        $(this).dialog('close');
      },
      'Submit': function() {
        // COULD ensure details specified if "Others" reason selected.
        // COULD show a "Submitting..." message.
        if (!Me.isLoggedIn())
          $form.each($loginThenSubmit)
        else
          $form.submit();
      }
    }
    /* buttons: [ // {{{ weird, this results in button titles '0' and '1'
      { text: 'Cancel', click: function() {
        $(this).dialog('close');
      }},
      { id: 'dw-fi-flg-submit', text: 'Submit', disabled: 'disabled',
          click: function() {
        // COULD ensure details specified if "Others" reason selected.
        // COULD show a "Submitting..." message.
        if (!Me.isLoggedIn())
          $form.each($loginThenSubmit)
        else
          $form.submit();
      }}],   }}} */
  }));

  // {{{ How to enable the submit button on radio button click?
  // Below button(option ...) stuff results in:
  //    Uncaught TypeError: Object function () {
  //       $('#dw-fi-flg-submit').button('option', 'disabled', false);
  //     } has no method 'split'
  //$('#dw-fi-flg-submit').button('option', 'disabled', true);
  //$form.find('.dw-f-flg-rsns label').one(function() {
  //  $('#dw-fi-flg-submit').button('option', 'disabled', false);
  //});
  // }}}

  $form.submit(function() {
    $.post($form.attr("action"), $form.serialize(), 'html')
        .done(function(responseHtml) {
          $parent.dialog('close');
          // Don't show already submitted text if reopening form,
          // and leave the reason radio buttons unchecked.
          $form.find('textarea').val('').end()
              .find('input:checked')
                .prop('checked', false).button('refresh');
          showServerResponseDialog(responseHtml);
        })
        .fail(showServerResponseDialog);
    return false;
  });
}

// warning, dupl code, see $showDeleteCommentForm.
function $showFlagForm() {
  initFlagForm();
  var $i = $(this);
  var $t = $i.closest('.dw-t');
  var $post = $t.children('.dw-p');
  var postId = $post.dwPostId();
  var $flagForm = $('#dw-f-flg');
  $flagForm
      .attr('action', '?flag='+ postId)
      .parent().dialog('open');  //parent().position({
      //my: 'center top', at: 'center bottom', of: $post, offset: '0 40'});
}


// ------- Replying


// Shows a reply form, either below the relevant post, or inside it,
// if the reply is an inline comment -- whichever is the case is determined
// by event.target.
function $showReplyForm(event, opt_where) {
  // Warning: Some duplicated code, see .dw-r-tag click() above.
  var $thread = $(this).closest('.dw-t');
  var $replyAction = $thread.find('> .dw-p-as > .dw-a-reply');
  var $post = $thread.children('.dw-p');
  clearfix($thread); // ensures the reply appears nested inside the thread
  var postId = $post.dwPostId();
  var horizLayout = $thread.is('.dw-hor');
  var replyCountBefore = $thread.find('> .dw-res > .dw-t').length;

  $replyAction.dwActionLinkDisable();

  function showSortOrderTipsLater($newPost, delay) {
    setTimeout(function() {
      var $tips = $('#dw-tps-sort-order');
      $tips.appendTo($newPost)
          .dwScrollIntoView()
          .click(function() {
        $tips.hide();
        showRateOwnCommentTipsLater($newPost, 400);
      });
    }, delay);
  }

  // (Could use http://www.lullabot.com/files/bt/bt-latest/DEMO/index.html
  // to draw arrow from tips to Rate button.)
  function showRateOwnCommentTipsLater($newPost, delayMillis) {
    var rateOwnPostClass = 'dw-tps-rate-own-post';
    var withTipsClass = 'dw-p-as-with-tips';
    var $tips = $('#dw-tps-rate-own-comment');
    var $newThread = $newPost.closest('.dw-t');
    var $actions = $newThread.children('.dw-p-as');
    var $rateAction = $actions.children('.dw-a-rate');
    var timeoutHandler;

    function removeOrCancelTips(opt_event) {
      $rateAction.unbind('click', removeOrCancelTips);
      $tips.unbind('click');
      if (timeoutHandler) clearTimeout(timeoutHandler);
      else $tips.fadeOut(function() {
        $tips.removeClass(rateOwnPostClass);
        $actions.removeClass(withTipsClass);
        // Show the action buttons for $newPost, or people will be
        // very confused when they're hidden now when the tips is
        // dismissed (since `withTipsClass' was just removed).
        $newPost.each($showActions);
      });
    }

    $rateAction.click(removeOrCancelTips);
    timeoutHandler = setTimeout(function() {
      timeoutHandler = null;
      $actions.addClass(withTipsClass);
      $tips.addClass(rateOwnPostClass).show().insertAfter($rateAction)
          .dwScrollIntoView()
          .click(removeOrCancelTips);
    }, delayMillis);
  }

  // Create a reply form, or Ajax-load it (depending on the Web framework
  // specifics).
  Settings.replyFormLoader(debateId, rootPostId, postId,
      function($replyFormParent) {

    var $replyForm = $replyFormParent.children('form');
    makeIdsUniqueUpdateLabels($replyForm);
    $replyForm.resizable({
        alsoResize: $replyForm.find('textarea'),
        resize: function() {
          resizeRootThreadExtraWide(); // TODO rm textarea width?
          $post.each(SVG.$drawParents);
        },
        stop: resizeRootThreadNowAndLater,
        minHeight: 180,  // or lower parts of form might overflow
        minWidth: 210  // or Cancel button might float drop
      });

    var $anyHorizReplyBtn = $();
    var $submitBtn = $replyForm.find('.dw-fi-submit');
    var $cancelBtn = $replyForm.find('.dw-fi-cancel');

    $cancelBtn.click(function() {
      $replyAction.dwActionLinkEnable();
    });

    var setSubmitBtnTitle = function(event, userName) {
      var text = userName ?  'Post as '+ userName : 'Post as ...';  // i18n
      $submitBtn.val(text);
    }
    setSubmitBtnTitle(null, Me.getName());
    $submitBtn.each($loginSubmitOnClick(setSubmitBtnTitle,
          { askAboutEmailNotfs: true }));

    // Ajax-post reply on submit.
    $replyForm.submit(function() {
      Settings.replyFormSubmitter($replyForm, debateId, rootPostId, postId)
        .fail(showErrorEnableInputs($replyForm))
        .done(function(newDebateHtml) {
          // The server has replied. Merge in the data from the server
          // (i.e. the new post) in the debate.
          // Remove the reply form first — if you do it afterwards,
          // a .dw-t:last-child might fail (be false), because the form
          // would be the last child, resulting in a superfluous
          // dw-svg-fake-harrow.
          removeInstantly($replyFormParent);
          $replyAction.dwActionLinkEnable();
          var $myNewPost = updateDebate(newDebateHtml);
          markMyPost($myNewPost.dwPostId());
          // Any horizontal reply button has been hidden.
          $anyHorizReplyBtn.show();

          // Don't show any tips instantly, because if
          // the new comment and the tips appear at the same time,
          // the user will be confused? S/he won't know where to look?
          // So wait a few seconds.
          // Don't show sort order tips if there are few replies,
          // then nothing is really being sorted anyway.
          var delayMillis = 3500;
          var showSortTips = horizLayout && replyCountBefore >= 2;
          if (showSortTips) showSortOrderTipsLater($myNewPost, 2050);
          else showRateOwnCommentTipsLater($myNewPost, delayMillis);

          showAndHighlightPost($myNewPost,
              { marginRight: 300, marginBottom: 300 });
          $showActions($myNewPost);
        });

      disableSubmittedForm($replyForm);
      return false;
    });

    // Fancy fancy
    $replyForm.find('.dw-submit-set input').button();
    $replyForm.find('label').addClass(
      // color and font matching <input> buttons
      'dw-ui-state-default-color dw-ui-widget-font');

    if (opt_where) {
      // The user replies to a specific piece of text inside the post.
      // Place the reply inline, and fill in the `where' form field with
      // the text where the click/selection was made.
      $replyFormParent.prependTo(opt_where.elem);
      $replyForm.find('input[id^="dw-fi-reply-where"]')
          .val(opt_where.textStart);
    } else if ($thread.is('.dw-hor')) {
      // Place the form in the child thread list, to the right
      // of the Reply button.
      var $actionsListItem = $thread.find('> ol.dw-res > li.dw-p-as');
      $actionsListItem.after($replyFormParent);
    }
    else {
      // Place the form below the post, in the .dw-res list
      var $res = $thread.children('.dw-res');
      if (!$res.length) {
        // This is the first reply; create the reply list.
        $res = $("<ol class='dw-res'/>").appendTo($thread);
      }
      $res.prepend($replyFormParent);
    }

    // For horizontal threads, hide the reply button, to give the impression
    // that the reply form replaces the reply button. Adjust the reply
    // form min-width so it starts with a width equal to the reply
    // button width — then the stuff to the right won't jump leftwards when
    // $anyHorizReplyBtn is hidden/shown and the $replyForm is shown/removed.
    if (horizLayout) {
      $anyHorizReplyBtn =
          $replyFormParent.prev().filter('.dw-hor-a').dwBugIfEmpty().hide();
      $replyForm.find('.dw-submit-set .dw-fi-cancel').click(function() {
        slideAwayRemove($replyFormParent, function() {
          $anyHorizReplyBtn.show();
        });
        // Cancel delegate, which also calls slideAwayRemove().
        return false;
      });
      $replyFormParent.css('min-width', $anyHorizReplyBtn.outerWidth(true));
    }

    SVG.drawArrowsToReplyForm($replyFormParent); // is this needed?
    slideInActionForm($replyFormParent);
  });
}

// ------- Inline edits

var EditTabIdEdit = 0;
var EditTabIdDiff = 1;
var EditTabIdPreview = 2;
var EditTabIdLast = EditTabIdPreview;
var EditTabCount = 3;


var $loadEditorDependencies = (function() {
  // COULD use 2 loadStatus, and load Code Mirror only iff `this`
  // is the root post.
  var loadStatus;
  return function() {
    if (loadStatus)
      return loadStatus;
    loadStatus = $.Deferred();
    var loadCodeMirror = !Modernizr.touch;
    Modernizr.load({
      test: loadCodeMirror,
      yep: [
        '/-/res/codemirror/lib/codemirror.css',
        '/-/res/codemirror/lib/util/dialog.css', // search dialogs
        '/-/res/codemirror-2.25-custom.min.js'],
      both: [
        '/-/res/wmd/showdown.js'],
      complete: function() {
        loadStatus.resolve();
      }
    })
    return loadStatus;
  }
})();


/**
 * Loads editor resources and opens the edit form.
 */
function $showEditForm() {
  var i = this;
  $loadEditorDependencies.call(i).done(function() {
    _$showEditFormImpl.call(i);
  });
}


function _$showEditFormImpl() {
  var $post = $(this);
  var $postBody = $post.children('.dw-p-bd');
  var postId = $post.dwPostId();
  var isRootPost = $post.parent().is('.dw-depth-0');

  // It's confusing with Reply/Rate/etc below the edit form.
  hideActions();

  // COULD move function to debiki-lift.js:
  var editFormLoader = function(debateId, rootPostId, postId, complete) {
    // see comments in setReplyFormLoader above on using datatype text
    $.get('?edit='+ postId +'&view='+ rootPostId, function(editFormText) {
      // Concerning filter(…): [0] and [2] are text nodes.
      var $editForm = $(editFormText).filter('form');
      makeIdsUniqueUpdateLabels($editForm, '#dw-e-tab-');
      complete($editForm)
    }, 'text');
  };

  function $disableSubmitBtn() {
    $(this).find('input.dw-fi-submit').button({ disabled: true }).end()
        .find('.dw-f-e-prvw-info').show();
  }

  function scrollPostIntoView() {
    $post.dwScrollIntoView({ marginLeft: 40, marginTop: -35 });
  }

  // If the edit form has already been opened, but hidden by a Cancel click,
  // reuse the old hidden form, so any edits aren't lost.
  var $oldEditForm = $post.children('.dw-f-e');
  if ($oldEditForm.length) {
    $oldEditForm.each($disableSubmitBtn);
    $oldEditForm.find('.dw-e-tabs').tabs('select' , EditTabIdEdit);
    $oldEditForm.show();
    $postBody.hide();
    scrollPostIntoView();
    return;
  }

  editFormLoader(debateId, rootPostId, postId, function($editForm) {
    var $panels = $editForm.find('.dw-e-tab');
    var $editPanel = $panels.filter('[id^="dw-e-tab-edit"]');
    var $diffPanel = $panels.filter('[id^="dw-e-tab-diff"]');
    var $previewPanel = $panels.filter('[id^="dw-e-tab-prvw"]');
    var $submitBtn = $editForm.find('input.dw-fi-submit');
    var $cancelBtn = $editForm.find('input.dw-fi-cancel');

    var $clickPreviewHelp = $editForm.find('.dw-f-e-prvw-info');
    var $suggestOnlyHelp = $editForm.find('.dw-f-e-sugg-info');

    var $editTabs = $editForm.children('.dw-e-tabs');
    var $tabPanelLinks = $editTabs.find('> ul > li > a');
    var $editTabLink = $tabPanelLinks.filter('a[href^="#dw-e-tab-edit"]');
    var $diffTabLink = $tabPanelLinks.filter('a[href^="#dw-e-tab-diff"]');
    var $previewTabLink = $tabPanelLinks.filter('a[href^="#dw-e-tab-prvw"]');

    var codeMirrorEditor = null;

    $submitBtn.button({ disabled: true }); // you need to preview before submit
    $cancelBtn.button();

    $editForm.insertBefore($postBody);
    $postBody.hide();
    $cancelBtn.click(function() {
      $postBody.show();
      $editForm.hide();
      $post.each(SVG.$drawParents);
    });

    // Find the post's current (old) source text, and store in
    // .dw-e-src-old, so it's easily accessible to $updateEditFormDiff(…).
    if (!$editForm.data('dw-e-src-old')) {
      var oldSrc = $editForm.find('.dw-e-src-old');
      if (oldSrc.length) {
        oldSrc = oldSrc.text();
      }
      else {
        // html.scala excluded .dw-e-src-old, if the textarea's text
        // is identical to the old src. (To save bandwidth.)
        oldSrc = $editPanel.find('textarea').val();
      }
      $editForm.data('dw-e-src-old', oldSrc);
    }

    // Don't show until Submit button visible. (Would be too much to read,
    // because the 'Click Preview then Save' help text is alo visible.)
    $suggestOnlyHelp.hide();

    var enableSubmitBtn = function() {
      $submitBtn.button({ disabled: false });
      $clickPreviewHelp.hide();
      // Notify the user if s/he is making an edit suggestion only.
      var hideOrShow = Me.mayEdit($post) ? 'hide' : 'show';
      $suggestOnlyHelp[hideOrShow]();
      $editForm.children('.dw-submit-set').dwScrollIntoView();
    }

    // Update the preview, if the markup type is changed.
    $editForm.find('select[name="dw-fi-e-mup"]').change(function() {
      $editForm.each($updateEditFormPreview);
    });

    // If CodeMirror has been loaded, use it.
    // For now, use CodeMirror on the root post only — because if
    // the other posts are resized, CodeMirror's interal width
    // gets out of sync and the first character you type appears on
    // the wrong row. (But the root post is always full size.)
    if (typeof CodeMirror !== 'undefined' && isRootPost) {
      codeMirrorEditor = CodeMirror.fromTextArea(
          $editPanel.children('textarea')[0], {
        lineNumbers: true, //isRootPost,
        lineWrapping: true,
        mode: "text/html", // for now
        tabMode: "indent"
      });
    }

    // Always activate the editor on mouse/touch clicks on the tab.
    // — However if the user navigates using the keyboard, s/he might
    // not want to start editing, but only view the source text.
    // Then it's annoying if the editor grabs focus. So, if this is
    // a keyboard click, we require another Enter click, before we
    // focus the editor (see the next code paragraph.)
    // — Oddly enough, keyboard Enter click generates a click event
    // with event.which set to 1, i.e. mouse button 1. Weird.
    // So use `mouseup' instead of `click.'
    // — Don't use mousedown though — because then we'd focus the editor
    // *before* jQuery UI gives focus to the tab link (which seems to
    // happen on mouse*up* when the click is over).
    // — I guess all this doesn't really matter for touch devices.
    $editTabLink.mouseup(function(event, ui) {
      focusEditor();
    });

    // Enter the editor, if the editor *panel* is shown and
    // the user clicks Enter on the editor *tab link*.
    $editTabLink.keydown(function(event) {
      if (event.which !== $.ui.keyCode.ENTER) return;
      if ($editTabs.tabs('option', 'selected') !== EditTabIdEdit) {
        // Only activate the editor if the user clicks when the panel is
        // already  visible. Instead, let jQuery UI handle the click
        // — it will show the edit panel.
        return;
      }
      focusEditor();
    });

    function focusEditor() {
      // jQuery UI shows the panel on Enter click — but right now,
      // the edit panel *might* not yet be visible. If it is not,
      // the editor cannot be given focus right now.
      setTimeout(function() {
        // Now (later) the editor panel should be visible.
        if (codeMirrorEditor) {
          codeMirrorEditor.refresh();
          codeMirrorEditor.focus();
        }
        else $editPanel.find('textarea').focus();
      }, 0);
    }

    // Sometimes we'll make the panels at least as tall as
    // the post itself (below). But not large enough to push the
    // Submit/Cancel buttons of screen, if editing the root post
    // and the page title is visible (at the top of the page).
    var approxTitleAndBtnsHeight = 260; // page title + tabs + submit buttons
    var maxPanelHeight = Math.max(
        140, $(window).height() - approxTitleAndBtnsHeight);
    var minPanelHeight = Math.max(140, $postBody.height() + 60);
    if (minPanelHeight > maxPanelHeight) minPanelHeight = maxPanelHeight;

    // Place the edit/diff/preview tabs below the content, close to the Submit
    // button. Otherwise people (my father) tend not to notice the tabs,
    // if the edit form is tall (then there'd be lots of space & text
    // between the tabs and the submit & cancel button).
    // Clearfix the tabs, because .dw-p-bd makes the preview tab float left.
    $editTabs.addClass('dw-ui-tabs-bottom ui-helper-clearfix').tabs({
      selected: EditTabIdEdit,
      show: function(event, ui) {
        // Sync the edit panel <textarea> with any codeMirrorEditor,
        // so the diff and preview tabs will work correctly.
        if (codeMirrorEditor) codeMirrorEditor.save();

        // Update the tab to be shown.
        var $panel = $(ui.panel);
        switch (ui.panel.id) {
          case $editPanel.attr('id'):
            $editTabLink.focus();
            break;
          case $diffPanel.attr('id'):
            $diffTabLink.focus();
            $(this).each($updateEditFormDiff);
            break;
          case $previewPanel.attr('id'):
            $previewTabLink.focus();
            $(this).each($updateEditFormPreview);
            enableSubmitBtn();
            break;
          default: die('[error DwE4krERS]');
        };

        // Resize the root post dynamically, fix size of other posts.
        // Then e.g. CodeMirror can make the root post editor taller
        // dynamically, and the preview panel adjusts its size.
        $panel.height('auto');

        // But don't push the Submit/Cancel buttons of screen.
        $panel.css('max-height', maxPanelHeight +'px');

        // If CodeMirror isn't enabled and thus auto-resize the <textarea>,
        // then resize it manually, so it's as tall as the other panels.
        // {{{ Also don't shrink any panel
        // because: (and old comment of mine follows)
        //  "Don't reduce the form heigt, because if the form is at the
        //  very bottom of the screen, everything would jump downwards
        //  when the browser window shrinks."
        //  [[later: Jump downwards, and vanish outside the browser window?
        //  was that what happened?]]
        // And: (another old hard to understand comment)
        //  "jQuery UI shows the panels before the `show' event is triggered,
        //  so unless the other panels are resized *before* one of them is
        //  shown, that other panel might be smaller than the current one,
        //  causing the window to shrink and everything to jump downwards
        //  (if you're viewing the bottom of the page).
        //  So change the height of all panels — then they won't shrink
        //  later, when shown."  }}}
        if (!codeMirrorEditor) {
          if (minPanelHeight < $panel.height())
            minPanelHeight = $panel.height();
          else
            $panels.height(minPanelHeight);
        }
      }
    });

    // Prevent tab float drop.
    // If the $editForm is narrow, the tabs will float drop. Since they're
    // placed below the form, they'll actually float drop *upwards*, and
    // be hidden below the form. One way to avoid this, is making
    // the .tabs-nav very wide. (This is a stupid fix — it'll break
    // should you add perhaps two more tabs.)
    var $tabsNav = $editTabs.children('.ui-tabs-nav');
    $tabsNav.css('min-width', '300px');

    // Flip rounded corner placement — because tabs placed below contents.
    // (See jqueryui.com/demos/tabs/#bottom)
    $tabsNav.children().andSelf()
        .removeClass('ui-corner-all ui-corner-top')
        .addClass('ui-corner-bottom');

    // Show help info.
    // It might not be obvious that you can scroll down and click a Save
    // button. (Neither my mom nor dad found it! when it was off screen.)
    // For now, simply write a tips if it perhaps is off screen.
    if ($editForm.height() > 650)
      $editForm.children('.dw-f-e-inf-save').show();

    // When clicking the Save button, open a login dialog, unless logged in.
    $submitBtn.each($loginSubmitOnClick(function(event, userName) {
      var text = userName ?  'Save as '+ userName : 'Save as ...';  // i18n
      $(this).val(text);
    }));

    // Redraw SVG arrows, since the edit form is larger than the post.
    $post.each(SVG.$drawParents);

    // Ajax-post edit on submit, and update the page with all recent changes.
    $editForm.submit(function() {
      // Ensure any text edited with CodeMirror gets submitted.
      if (codeMirrorEditor) codeMirrorEditor.save();

      Settings.editFormSubmitter($editForm, debateId, rootPostId, postId)
          .fail(showErrorEnableInputs($editForm))
          .done(function(newDebateHtml) {
        slideAwayRemove($editForm);
        // If the edit was a *suggestion* only, the post body has not been
        // changed. Unless we make it visible again, it'll remain hidden
        // because updateDebate ignores it (since it hasn't changed).
        $postBody.show();
        updateDebate(newDebateHtml);
      });

      disableSubmittedForm($editForm);
      return false;
    });

    // Provide an interface to internal stuff.
    $editForm.data("dwEditFormInterface", {
      focusEditor: focusEditor
    });

    // Finally,
    activateShortcutReceiver($editForm);
    focusEditor();
    scrollPostIntoView();
  });
}

// Call on a .dw-f-e, to update the diff tab.
function $updateEditFormDiff() {
  // Find the closest post
  var $editForm = $(this).closest('.dw-f-e');
  var $editTab = $(this).find('div.dw-e-tab[id^="dw-e-tab-edit"]');
  var $diffTab = $(this).find('div.dw-e-tab[id^="dw-e-tab-diff"]');
  var $textarea = $editTab.find('textarea');

  // Find the current draft text, and the old post text.
  var newSrc = $textarea.val();
  var oldSrc = $editForm.data('dw-e-src-old');

  // Run new diff.
  var diff = diffMatchPatch.diff_main(oldSrc, newSrc);
  diffMatchPatch.diff_cleanupSemantic(diff);
  var htmlString = prettyHtmlFor(diff);
  // Remove any old diff.
  $diffTab.children('.dw-p-diff').remove();
  // Show the new diff.
  $diffTab.append('<div class="dw-p-diff">'+ htmlString +'</div>\n');
}

// Call on a .dw-f-e, to update the preview tab.
function $updateEditFormPreview() {
  var $i = $(this);
  var $editForm = $i.closest('.dw-f-e');
  var $editTab = $editForm.find('div.dw-e-tab[id^="dw-e-tab-edit"]');
  var $previewTab = $editForm.find('div.dw-e-tab[id^="dw-e-tab-prvw"]');
  var $textarea = $editTab.find('textarea');
  var $selectedMarkup =
    $editForm.find('select[name="dw-fi-e-mup"] > option:selected');
  var markupType = $selectedMarkup.val();
  var markupSrc = $textarea.val();
  var htmlSafe = '';
  var $post = $i.closest('.dw-p');
  var isForTitle = $post.is('.dw-p-ttl');
  var sanitizerOptions = {
    allowClassAndIdAttr: $post.dwIsArticlePost(),
    allowDataAttr: $post.dwIsArticlePost()
  };

  switch (markupType) {
    case "para":
      // Convert to paragraphs, but for now simply show a <pre> instead.
      // The Scala implementation changes \n\n to <p>...</p> and \n to <br>.
      htmlSafe = $(isForTitle ? '<h1></h1>' : '<pre></pre>').text(markupSrc);
      break;
    case "dmd0":
      // Debiki flavored Markdown version 0.
      if (isForTitle) markupSrc = '<h1>'+ markupSrc +'</h1>';
      var hostAndPort = location.origin.replace(/https?:\/\//, '');
      htmlSafe = markdownToSafeHtml(markupSrc, hostAndPort, sanitizerOptions);
      break;
    case "code":
      // (No one should use this markup for titles, insert no <h1>.)
      htmlSafe = $('<pre class="prettyprint"></pre>').text(markupSrc);
      break;
    case "html":
      if (isForTitle) markupSrc = '<h1>'+ markupSrc +'</h1>';
      htmlSafe = sanitizeHtml(markupSrc, sanitizerOptions);
      break;
    default:
      die("Unknown markup [error DwE0k3w25]");
  }

  $previewTab.children('.dw-p-bd-blk').html(htmlSafe);
}


// ------- Edit suggestions and history

function $showEditsDialog() {
  var $thread = $(this).closest('.dw-t');
  var $post = $thread.children('.dw-p');
  var $postBody = $post.children('.dw-p-bd');
  var postId = $post.dwPostId();

  $.get('?viewedits='+ postId +'&view='+ rootPostId, 'text')
      .fail(showServerResponseDialog)
      .done(function(editsHtml) {
    var $editDlg = $(editsHtml).filter('form#dw-e-sgs'); // filter out text node
    var buttons = {
      Cancel: function() {
        $(this).dialog('close');
      }
    };
    if ($editDlg.is('.dw-e-sgs-may-edit')) buttons.Save = function() {
      // COULD show "Saving..." dialog and close when done.
      // Otherwise the new html might arrive when the user has started
      // doing something else.
      $(this).submit().dialog('close');
    };
    $editDlg.dialog($.extend({}, jQueryDialogDefault, {
      width: 1000,
      height: 600,
      buttons: buttons,
      close: function() {
        // Need to remove() this, so ids won't clash should a new form
        // be loaded later.
        $(this).remove();
      }
    }));

    initSuggestions($editDlg); // later:? .find('#dw-e-tb-sgs'));
    // For now, open directly, discard on close and
    // load a new one, if "Edit" clicked again later.
    $editDlg.dialog('open');

    // Don't focus the first checkbox input — jQuery UI's focus color makes
    // it impossible to tell whether it has focus only, or if it's actually
    // selected. TODO change jQuery UI's focus colors — the Theme Roller,
    // change the Clickable: hover state.
    // (By default, jQuery UI focuses the :first:tabbable element in the
    // .ui-dialog-content, rather than the .ui-dialog-buttonpane.)
    $editDlg.parent().find('.ui-dialog-buttonpane :tabbable:first').focus();
  });

  var appdelSeqNo = 0;

  function initSuggestions($form) {
    // Update diff and preview, when hovering a suggestion.
    $form.find('li.dw-e-sg').mouseenter(function() {
      // Compute the text of the post as of when this edit
      // was *suggested*. This shows the *intentions* of the one
      // who suggested the changes.
      // COULD also show the results of applying the patch to
      // the current text (as of now).
      // - When hovering the edit <li>, show the intentions.
      // - But when hovering the Apply/Undo button, show the results
      //   of applying/undoing.
      // - Add tabs at the top of the edit, which one can click,
      //   to decide which diff to show.
      var suggestionDate = $(this).find('.dw-e-sg-dt').attr('title');
      var curSrc = textAsOf(suggestionDate);
      var patchText = $(this).find('.dw-e-text').text();

      // Make a nice html diff.
      // (I don't know how to convert patches to diffs, without
      // actually applying the patch first, and calling diff_main.)
      var patches = diffMatchPatch.patch_fromText(patchText);
      // COULD check [1, 2, 3, …] to find out if the patch applied
      // cleanaly. (The result is in [0].)
      var newSrc = diffMatchPatch.patch_apply(patches, curSrc)[0];
      var diff = diffMatchPatch.diff_main(curSrc, newSrc); // <- how to avoid?
      diffMatchPatch.diff_cleanupSemantic(diff);
      var diffHtml = prettyHtmlFor(diff);

      // Remove any old diff and show the new one.
      var $diff = $form.find('#dw-e-sgs-diff-text');
      $diff.children('.dw-x-diff').remove();
      $diff.append('<div class="dw-x-diff">'+ diffHtml +'</div>\n');
      // Update the preview.
      // COULD make this work with other types of markdown than `dmd0'.
      // See $updateEditFormPreview(), which handles other markup types.
      var html = markdownToSafeHtml(newSrc);
      $form.find('#dw-e-sgs-prvw-html').html(html);
    });

    // Applies all edits up to, but not including, the specified date.
    // Returns the resulting text.
    // Keep in sync with textAsOf in debate.scala (renamed to page.scala?).
    // SHOULD find the markup type in use too. Would require that the
    // markup type be sent by the server.
    // TODO also consider edit suggestions marked for application.
    // TODO consider skipping edit-apps marked for undo.
    // TODO when showing the changes *intended*, take into account
    // edit appls that were not deleted at the point in time when the
    // suggestion was made (but perhaps were deleted later)
    // (Otherwise, if [some patch that was in effect when the suggestion
    // was made] has been reverted, it might not be possible to understand
    // the intention of the patch.)
    function textAsOf(dateIso8601) {
      // The edit apps should already be sorted: most recent first,
      // see html.scala.
      var eapps = $form.find('#dw-e-sgs-applied li').filter(function() {
        var eappDate = $(this).find('.dw-e-ap-dt').attr('title');
        return eappDate < dateIso8601;
      });
      var origText = $form.find('#dw-e-sgs-org-src').text();
      var curText = origText;
      eapps.each(function() {
        var patchText = $(this).find('.dw-e-text').text();
        var patches = diffMatchPatch.patch_fromText(patchText);
        // COULD check [1, 2, 3, …] to find out if the patch applied
        // cleanaly. (The result is in [0].)
        var newText = diffMatchPatch.patch_apply(patches, curText)[0];
        curText = newText;
      });
      return curText;
    }

    $form.find('input').button().click(function() {
      // Update a sequence number at the start of the input value,
      // e.g. change '10-delete-r0m84610qy' to '15-delete-r0m84610qy'.
      var v = $(this).val();
      appdelSeqNo += 1;
      var v2 = v.replace(/^\d*-/, appdelSeqNo +'-');
      $(this).val(v2);
      // TODO update save-diff and preview.
    });

    $form.submit(function() {
      var postData = $form.serialize();
      $.post($form.attr('action'), postData, 'html')
          .fail(showServerResponseDialog)
          .done(function(recentChangesHtml) {
        updateDebate(recentChangesHtml);
        $form.dialog('close');
      });
      return false;
    });
  }
}


// ------- Editing

// Invoke this function on a textarea or an edit suggestion.
// It hides the closest post text and shows a diff of the-text-of-the-post
// and $(this).val() or .text(). $removeEditDiff shows the post again.
function $showEditDiff() {
  // Find the closest post
  var $post = $(this).closest('.dw-t').children('.dw-p');
  var height = $post.height();
  // Remove any old diff
  var $oldDiff = $post.children('.dw-p-diff');
  $oldDiff.remove();
  // Extract the post's current text.
  var $postBody = $post.children('.dw-p-bd');
  var oldText = $postBody.map($htmlToMarkup)[0]; // TODO exclude inline threads
  // Try both val() and text() -- `this' might be a textarea or
  // an elem with text inside.
  var newText = $(this).val();
  if (newText === '') newText = $(this).text();
  newText = newText.trim() +'\n';  // $htmlToMarkup trims in this way
  // Run diff
  var diff = diffMatchPatch.diff_main(oldText, newText);
  diffMatchPatch.diff_cleanupSemantic(diff);
  var htmlString = prettyHtmlFor(diff);
  // Hide the post body, show the diff instead.
  $postBody.hide();
  $postBody.after('<div class="dw-p-diff">'+ htmlString +'</div>\n');
  // Fix the height of the post, so it won't change when showing
  // another diff, causing everything below to jump up/down.

  // For now, make it somewhat higher than its current height,
  // so there's room for <ins> elems.
  //$post.css('height', '');
  //$post.css('height', $post.height() + 50 +'px');
  //$post.height(height + ($oldDiff.length ? 0 : 75));
  $post.height(height);
  $post.css('overflow-y', 'auto');

  // COULD make inline comments point to marks in the diff.
}

// Removes any diff of the closest post; shows the post text instead.
function $removeEditDiff() {
  var $post = $(this).closest('.dw-t').children('.dw-p');
  $post.children('.dw-p-diff').remove();
  $post.children('.dw-p-bd').show();
  $post.css('overflow-y', 'hidden');
}

// Converts a google-diff-match-patch diff array into a pretty HTML report.
// Based on diff_match_patch.prototype.diff_prettyHtml(), here:
//  http://code.google.com/p/google-diff-match-patch/source/browse/
//    trunk/javascript/diff_match_patch_uncompressed.js
// @param {!Array.<!diff_match_patch.Diff>} diffs Array of diff tuples.
// @return {string} HTML representation.
function prettyHtmlFor(diffs) {
  var html = [];
  var x, i = 0;
  var pattern_amp = /&/g;
  var pattern_lt = /</g;
  var pattern_gt = />/g;
  var pattern_para = /\n/g;
  for (x = 0; x < diffs.length; x++) {
    var op = diffs[x][0];    // Operation (insert, delete, equal)
    var data = diffs[x][1];  // Text of change.
    var text = data.replace(pattern_amp, '&amp;').replace(pattern_lt, '&lt;')
        .replace(pattern_gt, '&gt;').replace(pattern_para, '¶<br />');
    switch (op) {
      case DIFF_INSERT:
        html[x] = '<ins>' + text + '</ins>';
        break;
      case DIFF_DELETE:
        html[x] = '<del>' + text + '</del>';
        break;
      case DIFF_EQUAL:
        html[x] = '<span>' + text + '</span>';
        break;
    }
    if (op !== DIFF_DELETE) {
      i += data.length;
    }
  }
  return html.join('');
}


// ------- Delete comments

// warning: dupl code, see initFlagForm.
function initDeleteForm() {
  var $form = $('#dw-f-dl');
  var $parent = $form.parent();
  if ($parent.is('.ui-dialog-content'))
    return; // already inited

  $form.find('.dw-submit-set input').hide(); // use jQuery UI's buttons instead
  // Don't make a button of -tree, because then it's a tiny bit
  // harder to realize wethere it's checked or not, and this is a
  // rather important button.
  // Skip: $form.find('#dw-fi-dl-tree').button();
  $parent.dialog($.extend({}, jQueryDialogReset, {
    width: mobileWidthOr(360),
    buttons: {
      Cancel: function() {
        $(this).dialog('close');
      },
      Delete: function() {
        // COULD ensure details specified if "Others" reason selected.
        // COULD show a "Submitting..." message.
        if (!Me.isLoggedIn())
          $form.each($loginThenSubmit)
        else
          $form.submit();
      }
    }
  }));

  $form.submit(function() {
    $.post($form.attr("action"), $form.serialize(), 'html')
        .done(function(responseHtml) {
          $parent.dialog('close');
          // Don't show already submitted deletion reason,
          // if reopening form, and clear the delete-all-replies
          // checkbox.
          $form.find('textarea').val('').end()
              .find('input:checked')
                .prop('checked', false).button('refresh');
          showServerResponseDialog(responseHtml);
        })
        .fail(showServerResponseDialog);
    return false;
  });
}

// warning: dupl code, see $showFlagForm.
function $showDeleteForm() {
  initDeleteForm();
  var $i = $(this);
  var $t = $i.closest('.dw-t');
  var $post = $t.children('.dw-p');
  var postId = $post.dwPostId();
  var $deleteForm = $('#dw-f-dl');
  $deleteForm
      .attr('action', '?delete='+ postId)
      .parent().dialog('open');  //.parent().position({
      //my: 'center top', at: 'center bottom', of: $post, offset: '0 40'});
}


// ------- Create page

// This is for the ?create-page (e.g. GET /some/folder/page?create-page).
// COULD REFACTOR: Export $loginSubmitOnClick, and place initCreateForm() in
// debiki-lift.js, so no ?create-page code is in here.
function initCreateForm() {
  var $submitBtn = $('form.dw-f-cr .dw-fi-submit');
  $submitBtn.button().each($loginSubmitOnClick(function(event, userName) {
    var text = userName ? 'Create as '+ userName : 'Create as ...';  // i18n
    $(this).val(text);
  }));
}


// ------- SVG

/* {{{ SVG commands

See e.g. http://tutorials.jenkov.com/svg/path-element.html

Cmd Params          Name      Description
M   x,y             moveto    Moves pen to x,y without drawing.
m   x,y             moveto    Relative coordinates (to current pen location).

L   x,y             lineto    Draws a line from current pen location to x,y.
l   x,y             lineto    Relative coordinates.

C   x1,y1 x2,y2 x,y curveto   Draws a cubic Bezier curve from current pen point
                              to x,y. x1,y1 and x2,y2 are start and end control
                              points of the curve, controlling how it bends.
c   x1,y1 x2,y2 x,y curveto   Relative coordinates.

}}} */

// Returns an object with functions that draws SVG arrows between threads,
// to illustrate their relationships. The arrows are drawn in whitespace
// between threads, e.g. on the visibility:hidden .dw-t-vspace elems.
function makeSvgDrawer() {

  function $createSvgRoot() {
    var svg = document.createElementNS(svgns, 'svg');
    this.appendChild(svg);
    $(this).addClass('dw-svg-parent');
  }

  function initRootSvg() {
    // Poll for zoom in/out events, and redraw arrows if zoomed,
    // because svg and html are not resized in the same manner: Unless
    // arrows redrawn, their ends are incorrectly offsett.
    zoomListeners.push(drawEverything);

    // (In the future, here will probably be created a global full window SVG
    // that can draw arrows between any elems.)
  }

  function $initPostSvg() {
    var $i = $(this);
    // Do not draw SVG for title posts. (In the future, could create
    // a SVG elem for inline replies only, though.)
    if ($i.is('.dw-p-ttl'))
      return;

    // Create root for contextual replies.
    // An inline thread is drawn above its parent post's body,
    // so an SVG tag is needed in each .dw-p-bd with any inline thread.
    // (For simplicity, create a <svg> root in all .dw-p-bd:s.)
    $i.children('.dw-p-bd').each($createSvgRoot);

    // Create root for whole post replies.
    // (Never do this for title posts, they have no whole post replies.)
    var $p = $i.parent();
    var $vspace = $p.children('.dw-t-vspace');
    if ($vspace.length) {
      // Place the root in the .dw-t-vspace before the reply list.
      $p.addClass('dw-svg-gparnt');
      $vspace.each($createSvgRoot);
    } else {
      $p.each($createSvgRoot);
    }
  }

  function findClosestRoot($elem) {
    var $root = $elem.closest('.dw-svg-parent').children('svg');
    if (!$root.length)
      $root = $elem.closest('.dw-svg-gparnt').find('> .dw-svg-parent > svg');
    dieIf(!$root.length, 'No SVG root found [error DwE84362qwkghd]');
    return $root;
  }

  // Draws an arrow from a mark to an inline thread.
  function arrowFromMarkToInline($mark, $inlineThread, cache) {
    // COULD make use of `cache'. See arrowFromThreadToReply(…).
    var $bdyBlk = $mark.closest('.dw-p-bd-blk');
    var $thread = $bdyBlk.closest('.dw-t');
    var horizontalLayout = $thread.is('.dw-hor');
    var $svgRoot = findClosestRoot($mark);
    // Do not use $svgRoot.offset() as offset, because that seems to be the
    // offset of the northwest-most SVG element in the <svg> tag. Instead,
    // use the parent elem's offset, which works fine since the <svg> has
    // position:absolute, and top = left = 0.
    // Details: When the first <path> is added to the $svgRoot, (at least)
    // Chrome and FireFox change the offset of the <svg> tag to the offset
    // of the <path>. Is that weird?
    var svgOffs = $svgRoot.parent().offset();
    var from = $mark.offset();
    var to = $inlineThread.offset();
    var r = document.createElementNS(svgns, 'path');
    var xs = from.left - svgOffs.left; // start
    var ys = from.top - svgOffs.top;
    var xe = to.left - svgOffs.left; // end
    var ye = to.top - svgOffs.top;
    var strokes;
    if (horizontalLayout) {
      // Change x-start to the right edge of the .dw-p-bd-blk in which
      // the mark is placed, so the curve won't be drawn over the -blk itself.
      xs = $bdyBlk.offset().left - svgOffs.left + $bdyBlk.outerWidth(false);
      // Move the curve a bit downwards, so it starts and ends in the middle
      // of the lines of text (12-13 px high).
      ys += 9;
      ye += 6;
      // Leave some space between the -blk and the curve, and the curve and
      // the iniline thread.
      xs += 10;
      xe -= 10;
      var dx = 60;
      strokes = 'M '+ xs +' '+ ys +
               ' C '+ (xe-dx) +' '+ (ys) +  // draw     --.
                 ' '+ (xe-dx) +' '+ (ye) +  // Bezier      \
                 ' '+ (xe) +' '+ (ye) +     // curve,       `--
               ' l -6 -6 m 6 6 l -6 6';     // arrow end:  >
    } else {
      // Move y-start to below the .dw-p-bd-blk in which the mark is placed.
      ys = $bdyBlk.offset().top - svgOffs.top + $bdyBlk.outerHeight(false) + 3;
      // Always start the curve at the same x position, or arrows to
      // different inline threads might overlap (unless the inline threads are
      // sorted by the mark's x position — but x changes and wraps around when
      // the thread width changes).
      xs = $bdyBlk.offset().left - svgOffs.left + 30;
      // Leave space between the arrow head and the inline thread.
      xe -= 13;
      // Make arrow point at middle of [-] (close/open thread button).
      ye += 9;
      // Arrow starting below the .dw-p-bd-blk, pointing on the inline thread.
      strokes = 'M '+ xs +' '+ ys +
               ' C '+ (xs) +' '+ (ye) +     // draw        |
                 ' '+ (xs+1) +' '+ (ye) +   // Bezier      \
                 ' '+ (xe) +' '+ (ye) +     // curve,       `-
               ' l -6 -6 m 6 6 l -6 6';     // arrow end:  >
    }
    r.setAttribute('d', strokes);
    // The mark ID includes the thread ID. The curve ID will be:
    // 'dw-svg-c_dw-i-m_dw-t-<thread-id>'.
    r.setAttribute('id', 'dw-svg-c_'+ $mark.attr('id'));
                                        // +'_'+ $inlineThread.attr('id'));
    $svgRoot.append(r);
    r = false;
  }

  function arrowFromThreadToReply($thread, $to, cache) {
    // Performance note: It seems the very first call to offset() is very
    // slow, but subsequent calls are fast. So caching the offsets only
    // helps a few percent.
    if (cache.is === undefined) {
      cache.is = 'filled';
      cache.$svgRoot = findClosestRoot($thread);
      // Do not use $svgRoot.offset() — see comment somewhere above, search
      // for "$svgRoot.offset()". COULD merge this somewhat duplicated code?
      cache.svgOffs = cache.$svgRoot.parent().offset();
      cache.horizontalLayout = $thread.is('.dw-hor');
      // The root post has a -vspace, in which SVG is drawn.
      cache.from = $thread.children('.dw-t-vspace').add($thread)
          .last() // not first() — $.add() sorts in document order
          .offset();
    }
    var to = $to.offset();
    var r = document.createElementNS(svgns, 'path');
    var xs = cache.from.left - cache.svgOffs.left; // start
    var ys = cache.from.top - cache.svgOffs.top;
    var xe = to.left - cache.svgOffs.left; // end
    var ye = to.top - cache.svgOffs.top;
    var strokes;
    if (cache.horizontalLayout && $thread.is('.dw-depth-0')) {
      // This is the root thread, and it is (always) laid out horizontally,
      // so draw west-east curve:  `------.
      // There's a visibility:hidden div that acts as a placeholder for this
      // curve, and it's been resized properly by the caller.
      xs = cache.from.left - cache.svgOffs.left + 10;
      ys = cache.from.top - cache.svgOffs.top + 3;

      // All curves start in this way.
      var curveStart = function(xs, ys, dx, dy) {
        return 'M '+ xs +' '+ ys +             // draw Bezier   |
              ' C '+ (xs+ 8) +' '+ (ys+dy) +   // curve start   \
                ' '+ (xs+dx) +' '+ (ys+dy);    //                `
      };

      if (xe < xs) {
        // $to is to the left of the arrow start. This happens e.g.
        // for [the arrow to the root post's Reply button].
        // Draw a special north-south curve, that starts just like the west-east
        // curve in the `else' block just below.
        // There might be stuff to the right of $to though,
        // so must start the arrow in the same way as the arrows that
        // point on the stuff to the right.
        xe += Math.min(24, $to.width() * 0.67);
        ye -= 13;
        var dx = 40 - 10;
        var dy = 28;
                                                // draw         \
        strokes = curveStart(xs, ys, dx, dy) +  // Bezier        |
                 ' '+ xe +' '+ ye +             // curve        /
                 ' l -5 -7 m 5 7 l 8 -4';   // arrow end       v
      } else {
        // $to is placed to the right of $thread. Draw west-east curve.
        xe += 10;
        ye -= 13;
        var dx = 40;
        var xm = (xe - xs - dx) / 2;
        var dy = 28;
        var dx2 = 70;
        if (dx2 > xe - xs - dx) {
          // The second Bezier curve would start to the left of where
          // the first one ends. Adjust dx and dx2.
          dx2 = xe - xs - dx + 10;
          dx -= 10;
        }

        strokes = curveStart(xs, ys, dx, dy) +// Bezier   \
                 ' '+ (xs+dx) +' '+ (ys+dy) + // curve     `--
               ' C '+ (xe-dx2) +' '+ (ys+dy+5) +  // 2nd curve
                 ' '+ (xe-9) +' '+ (ye-55) +  //             ------.
                 ' '+ xe +' '+ ye +           //                    \
               ' l -7 -4 m 8 4 l 5 -7'; // arrow end: _|             v
      }
    } else if (cache.horizontalLayout && cache.itemIndex == 0 &&
        cache.itemCount == 1) {
      // This is an inline thread, which is layed out horizontally,
      // and we're drawing an arrow to the reply button (which is always
      // present), and there are no replies. Draw a nice looking arrow
      // for this special case.
      //
      //       [Here's the post body]
      //       [blah bla...         ]
      //  x0,y0 |
      //        \
      //         \  curve 1, from x0,y0 to x1,y1
      //          |
      //   x1,y1  v
      //       [Here's the  ]      (no replies here, only
      //       [reply button]       the reply button is present)

      var x0 = xs +  8;
      var y0 = ye - 50; // (but not ys + …)
      var x1 = xe + 18;
      var y1 = ye -  8;
      strokes = 'M '+ (x0     ) +' '+ (y0     ) +
               ' C '+ (x0 -  4) +' '+ (y1 - 15) +
                 ' '+ (x1 +  3) +' '+ (y1 - 15) +
                 ' '+ (x1     ) +' '+ (y1     ) +
                 ' l -6 -5 m 7 5 l 6 -7';  // arrow end

    } else if (cache.horizontalLayout) {
      // This is an inline thread, which is layed out horizontally.
      // Draw 2 Bezier curves and an arrow head at the end:
      //
      // x0,y0 [Here's the post body]
      //   /   [...                 ]
      //   |
      //   | curve 1, from x0,y0 to x1,y1
      //   \
      //    `- x1,y1 ------. curve 2      -----------.  (another curve)
      //       |            \                         \
      //       /    arrow    x2,y2                    |
      //      v     head —>  v                        v
      //     [Reply ]       [Here's the reply]       (Another reply)
      //     [button]       [...             ]

      var x0 = xs +  8;
      var y0 = ys + 30;
      var x1 = x0 + 27;
      var y1 = ye - 30;
      var x2 = xe + 35;
      var y2 = ye - 13;

      if (cache.itemIndex == 0) {
        // This is an arrow to the Reply button or a reply that's been
        // nailed as child no. 0 (and the Reply button is somewhere
        // to the right).
        strokes =
                'M '+ (x0     ) +' '+ (y0     ) +  //   /
               ' C '+ (x0 -  4) +' '+ (y1 - 15) +  //   |
                 ' '+ (x0 +  5) +' '+ (y1     ) +  //   \
                 ' '+ (x1     ) +' '+ (y1     );   //    `-
      } else {
        // The first Bezier curve to this reply was drawn when
        // we drew the itemIndex == 0 arrow. Start at x1,y1 instead.
        strokes =
                'M '+ (x1     ) +' '+ (y1     );
      }
      strokes = strokes +
               ' C '+ (x2 - 20) +' '+ (y1     ) +  //    -----.
                 ' '+ (x2     ) +' '+ (y1 -  5) +  //          \
                 ' '+ (x2     ) +' '+ (y2     ) +  //          |
               ' l -7 -4 m 8 4 l 5 -7';  // arrow end: _|      v
    } else {
      // Draw north-south curve.
      var ym = (ys + ye) / 2;
      strokes = 'M '+ (xs+5) +' '+ (ys+30) +
               ' C '+ xs +' '+ ym +            // curve to child post  |
                 ' '+ xs +' '+ (ye-30) +       //                      \
                 ' '+ (xe-7) +' '+ (ye + 4) +  //                       \
               ' l -8 -1 m 9 1 l 0 -8'; // arrow end: _|                 `>
    }
    r.setAttribute('d', strokes);
    r.setAttribute('id', 'dw-svg-c_'+ $thread.attr('id') +'_'+ $to.attr('id'));
    cache.$svgRoot.append(r);
    r = false;
  }

  function $drawParentsAndTree() {
    $drawParents.apply(this);
    $drawTree.apply(this);
  }

  function $drawParents() {
    $(this).parents('.dw-t').each(function() {
      $drawPost.apply(this);
    });
  }

  // Draw curves from threads to children
  function $drawTree() {
    $('.dw-t', this).add(this).each($drawPost);
  }

  function $drawPost() {
    // This function is a HOTSPOT (shows the Chrome profiler).
    // {{{ Performance notes
    // - $elem.width(…) .height(…) are slow, so <svg> elems are
    //   made excessively wide, in the .css file, so there's no need
    //   to resize them, even if their parent elem is expanded.
    // - The :has filter is slow, so I rewrote to find(...).parent() instead.
    // - The :hidden filter is slow, so I removed it — don't think it's
    //   needed now when arrows are placed in a per thread/post <svg>.
    //   [2012-02: Hmm, now I just added a :visible filter, will that be
    //   slow too? And in which statement was the :hidden filter included?]
    // - arrowFrom...() are SLOW! because they use $.offset.
    // }}}
    var $i = $(this);
    var $bdy = $('> .dw-p > .dw-p-bd', this);
    // Remove old curves
    $i.add('> .dw-t-vspace', this).add($bdy).children('svg').each(function() {
      $(this).find('path').remove();
    });
    // Draw arrows to whole post replies, and to thread summaries but
    // skip the not :visible summazrized threads. For horizontal layout,
    // draw an arrow to the Reply button (it's an <li>).
    var $childItems = $i.find('> .dw-res > li:visible');
    var cache = { itemCount: $childItems.length };
    $childItems.each(function(index){
      cache.itemIndex = index;
      arrowFromThreadToReply($i, $(this), cache);
    });
    // Draw arrows to inline replies.
    $bdy.children('.dw-p-bd-blk').each(function() {
      var cache = {};
      $(this).find('.dw-i-m-start').each(function() {
        var $mark = $(this);
        var $inlineThread = $(this.hash);
        if ($inlineThread.length) {
          arrowFromMarkToInline($mark, $inlineThread, cache);
        }
      });
    });
  }

  function drawEverything() {
    $('.dw-debate').each(SVG.$drawTree);
  }

  function $highlightOn() {
    // Add highlighting from the SVG path. However, addClass doesn't work
    // with SVG paths, so I've hardcoded the styling stuff here, for now.
    // COULD define dummy invisible SVG tags, with and w/o highlight.
    // And read the values of those tags here. Then I could still specify
    // all CSS stuff in the CSS file, instead of duplicating & hardcoding
    // styles here.
    this.style.stroke = '#f0a005';
    this.style.strokeWidth = 4;
  }

  function $highlightOff() {
    // Remove highlighting from the SVG path.
    // WARNING dupl code: the stroke color & width below is also in debiki.css.
    // See $highlightOn() for more info.
    this.style.stroke = '#dbdbdb';
    this.style.strokeWidth = 3;
  }

  return {
    // DO NOT FORGET to update the fake SVG drawer too!
    // And test both with and without SVG enabled.
    initRootSvg: initRootSvg,
    $initPostSvg: $initPostSvg,
    $drawPost: $drawPost,
    $drawTree: $drawTree,
    $drawParents: $drawParents,
    $drawParentsAndTree: $drawParentsAndTree,
    drawEverything: drawEverything,
    drawArrowsToReplyForm: function() {},
    $highlightOn: $highlightOn,
    $highlightOff: $highlightOff
  };
}

function makeFakeDrawer() {
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

  function drawEverything() {}

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
    initRootSvg: initialize,
    $initPostSvg: $initPostSvg,
    $drawPost: $drawPost,
    $drawTree: $drawTree,
    $drawParents: $drawParents,
    $drawParentsAndTree: $drawParentsAndTree,
    drawEverything: drawEverything,
    drawArrowsToReplyForm: drawArrowsToReplyForm,
    $highlightOn: $highlightOn,
    $highlightOff: $highlightOff
  };
}



// ------- Utterscroll and Tooltips


function initUtterscroll() {
  bugIf(Modernizr.touch);
  // Activate Utterscroll, and show tips if people use the window scrollbars,
  // hide it on utterscroll.
  var hasUtterscrolled = false;
  var $utterscrollTips;
  debiki.Utterscroll.enable({
    scrollstoppers: '.CodeMirror,'+
        ' .ui-draggable, .ui-resizable-handle, .dw-p-hd',
    onMousedownOnWinHztlScrollbar: function() {
      if (hasUtterscrolled || $utterscrollTips)
        return;
      var $tips = $('#dw-tps-utterscroll');
      $tips.show()
          // Place tips in the middle of the viewport.
          // (The tips has position: fixed.)
          .css('top', ($(window).height() - $tips.height()) / 2)
          .css('left', ($(window).width() - $tips.width()) / 2)
          .click(function() { $tips.hide(); });
      $utterscrollTips = $tips;
    },
    onHasUtterscrolled: function() {
      hasUtterscrolled = true;
      if ($utterscrollTips) $utterscrollTips.hide();
    }
  });
}


function $makePostHeadTooltips() {  // i18n
  if (!$.fn.tooltip) return; // tooltips not loaded
  var $postHead = $(this);
  if ($postHead.find('[data-original-title]').length)
    return; // tooltips already added

  // Tooltips explaining '?' and '??' login type indicators.
  $postHead.find('.dw-lg-t-spl').each(function() {
    var tip;
    var $i = $(this);
    if ($i.text() == '??') {
      tip = '<b>??</b> means that the user has not logged in,'+
          ' so <i>anyone</i> can pretend to be this user&nbsp;(!),'+
          ' and not specified any email address.'
      // better?: does not receive email notifications.'
    }
    else if ($i.text() == '?') {
      tip = '<b>?</b> means that the user has not logged in,'+
          ' so <i>anyone</i> can pretend to be this user&nbsp;(!),'+
          ' but has specified an email address.'
        // and receives email notifications.'
    }
    else die();
    $i.tooltip({
      title: tip,
      placement: 'right' // or '?' cursor hides tooltip arrow
    });
  });
}


// ------- Keyboard shortcuts

// Alternatively, could define shortcuts next to the components that
// they control. But I think it's nice to have all shortcuts here
// in one place, or I'll easily forget what shortcuts I've defined.

// COULD add WordPress style comment moderation shortcuts, see:
// http://codex.wordpress.org/Keyboard_Shortcuts

// Misc notes: Cannot intercept Ctrl+Tab — Chrome has reserved that
// combination, and probably e.g. Ctrl+W and Ctrl+PageDown too. (So buggy
// Web apps never prevent users from closing/switching browser tab).

// SHOULD !!! use this scheme everywhere: A single Ctrl click opens a
// context sensitive shortcut menu (a modal dialog that lists all
// available shortcuts) — with lots of 1 char buttons :-)
// E.g.  first Ctrl then 'E' would focus the editor, Ctrl then S
// would focus the Save button and the preview. Ctrl then Tab
// tabs to the right, Shift+Tab to the left.
// (The modal dialog: Click '?' in Gmail, and you'll find an example.)
// — However, don't place the `enter tab' logic here, instead
// place it close to where the tab is constructed.

// Overall strategy:
// 1) When you navigate with the tab key, clicking enter on a
// jQuery UI Tab first opens the tab panel. If you click Enter
// again, only then will you actually enter the panel.
// (That is, the first elem inside the panel gains focus.)
// So, you can tab to a tab, and click Enter to view its contents,
// and then you can either a) click tab again to navigate to the next tab,
// or b) you can click enter, to enter the tab.
// 2) See the [Ctrl *click*, **followed by** another single key click]
// shortcut discussion just above.

// Call e.g. activateShortcutReceiver(<some-form>) to outline and
// activate a shortcut receiver (e.g. the edit form).
var activateShortcutReceiver;

function initKeybdShortcuts() {

  // No shortcuts for touch devices. They don't have no keyboard?
  // I'd guess all shortcut code would cause nothing but troubles.
  if (Modernizr.touch)
    return;

  function handleEditFormKeys(event, $editForm) {

    // Return quickly if there's nothing to do.
    if (event.which !== $.ui.keyCode.ESCAPE &&
        event.which !== $.ui.keyCode.TAB &&
        !event.ctrlKey)
      return false;

    var whichChar = String.fromCharCode(event.which);
    var anyModifierDown = event.shiftKey || event.ctrlKey || event.altKey;
    var onlyCtrlDown = !event.shiftKey && event.ctrlKey && !event.altKey;
    var $activeElem = $(document.activeElement);
    var $anyFocusedTab = $activeElem.closest('.dw-e-tab');
    var $tabPanelLinks = $editForm.find('.dw-e-tabs > ul > li > a');
    var $editTabLink = $tabPanelLinks.filter('[href^="#dw-e-tab-edit"]');
    var $diffTabLink = $tabPanelLinks.filter('[href^="#dw-e-tab-diff"]');
    var $previewTabLink = $tabPanelLinks.filter('[href^="#dw-e-tab-prvw"]');

    var editFormIf = $editForm.data("dwEditFormInterface");

    // Let Ctrl+S show the Save button and the Preview tab.
    if (whichChar === 'S' && onlyCtrlDown) {
      $editForm.tabs('select', EditTabIdPreview);
      var $submitBtn = $editForm.find('input.dw-fi-submit');
      $submitBtn.focus(); // don't click, user should review changes
      return true;
    }

    // Let Ctrl+E activate the editor.
    if (whichChar === 'E' && onlyCtrlDown) {
      $editTabLink.focus().click();
      editFormIf.focusEditor();
      return true;
    }

    // Let Ctrl+D show the diff tab panel.
    if (whichChar === 'D' && onlyCtrlDown) {
      $diffTabLink.focus().click();
      return true;
    }

    // Let Ctrl+P show the preview tab panel.
    if (whichChar === 'P' && onlyCtrlDown) {
      $previewTabLink.focus().click();
      return true;
    }

    // Let Escape exit the editor and focus the tab nav.
    if (event.which === $.ui.keyCode.ESCAPE && !anyModifierDown &&
        $anyFocusedTab.is('.dw-e-tab-edit')) {
      $editTabLink.focus();
      // (Now, the next time you click Tab, you'll focus the next *tab*,
      // which shows its releated *panel* on focus, see $showEditForm().)
      return true;
    }

    return false;
  }

  // Remembers which <form> should handle key presses (shortcuts),
  // even when focus is lost (e.g. when you select text in the
  // edit diff tab, then focus will be lost — the document body will
  // be focused. But the edit <form> should still handle keyboard
  // shortcuts.)
  var $currentRecvr = $();
  var possibleRecvrs = '.dw-f-e';
  var $lastFocus = $();

  function switchRecvr($newRecvr) {
    $currentRecvr.removeClass('dw-keyrecvr');
    $currentRecvr = $newRecvr;
    $currentRecvr.addClass('dw-keyrecvr');
  }

  // Export a shortcut receiver activation function.
  activateShortcutReceiver = switchRecvr;

  // When a new <form> appears, indicate it is the keyboard shortcut receiver.
  $(document).delegate(possibleRecvrs, 'focusin', function(event) {
    switchRecvr($(this));
  });

  // Remember the last focused elem — we'll use that instead,
  // if the browser tries to focus the booring document.body.
  $(document).focusout(function(event) {
    if (event.target !== document.body)
      $lastFocus = $(event.target);
  });

  // Override focus on Tab click, if the browser focuses the boring
  // document.body.
  $(document).keydown(function(event) {
    // (Need not check Alt and Ctrl — the browser eats Alt-Tab and
    // Ctrl-Tab anyway?)
    if (event.which !== $.ui.keyCode.TAB)
      return;
    if (document.activeElement === document.body)
      $lastFocus.focus();
  });

  // Clear or change receiver if you tab away from the current one.
  // But not on the blur event — it happens too easily, e.g. if
  // you scrolldrag or select text inside the current recevier.
  $(document).keyup(function(event) {
    // (Need not check Alt and Ctrl — the browser eats Alt-Tab and
    // Ctrl-Tab anyway?)
    if (event.which !== $.ui.keyCode.TAB)
      return;
    var $newRecvr = $(document.activeElement).closest(possibleRecvrs);
    if (!$newRecvr.length || $newRecvr[0] !== $currentRecvr[0]) {
      switchRecvr($newRecvr);
    }
  });

  // Clear or change the receiver on click.
  // If the click doesn't change focus, then don't change receiver though.
  // If the click is inside a possible receiver, activate it.
  // (But only on *click*, not on *drag* — ignore e.g. scrolldrag and text
  // selections — otherwise the reciver would be lost e.g. if you select
  // text *inside* the current receiver <form>!)
  $('.debiki').click(function(event) {
    var $perhapsFocusedRecvr =
      $(document.activeElement).closest(possibleRecvrs);
    var $perhapsClickedRecvr =
      $(event.target).closest(possibleRecvrs)
          .filter(':visible');  // perhaps Cancel button hid the form

    var $newRecvr = $perhapsFocusedRecvr;
    if (!$newRecvr.length) {
      // A new receiver was clicked. Activate it and focus some input or
      // tab link inside.
      // (This looses CodeMirrors caret position though!
      // Should do codeMirrorEditor.focus() instead.)
      $newRecvr = $perhapsClickedRecvr;
      $perhapsClickedRecvr.find(
          'input:visible, button:visible, a:visible').first().focus();
    }

    switchRecvr($newRecvr);
  });

  // Handle keyboard shortcuts.
  $(document).keydown(function(event) {
    if (!$currentRecvr.length)
      return;

    var consumeEvent = false;
    if ($currentRecvr.is('.dw-f-e')) {
      consumeEvent = handleEditFormKeys(event, $currentRecvr);
    } else {
      // (in the future, check other possible event targets)
    }

    if (consumeEvent) {
      event.preventDefault();
      event.stopPropagation();
    }
  });
}


// ------- Miscellaneous

// Don't use. Use die2 instead. Could rewrite all calls to die() to use
// die2 instead, and then rename die2 to die and remove the original die().
function die(message) {
  throw new Error(message);
}

function die2(errorCode, message) {
  var mess2 = message ? message +' ' : '';
  var err2 = errorCode ? ' '+ errorCode : '';
  throw new Error(mess2 + '[error'+ err2 +']');
}

function dieIf(test, message) {
  if (test) throw new Error(message);
}

function die2If(test, errorCode, message) {
  if (test) die2(errorCode, message);
}

function bugIf(test, errorGuid) {
  if (test) throw new Error('Internal error ['+ errorGuid +']');
}

jQuery.fn.dwCheckIs = function(selector, errorCode) {
  var $ok = this.filter(selector);
  die2If(this.length !== $ok.length, errorCode || 'DwE093k2', $ok.length +
      ' of '+ this.length +' elems is: '+ selector);
  return this;
};

jQuery.fn.dwBugIfEmpty = function(errorGuid) {
  bugIf(!this.length, errorGuid);
  return this;
};

// Applies the clearfix fix to `thread' iff it has no child threads.
function clearfix(thread) {
  if (!thread.find(':has(.dw-t)').length) {
    thread.addClass('ui-helper-clearfix');
  }
}

// Finds all tags with an id attribute, and (hopefully) makes
// the ids unique by appending a unique (within this Web page) number to
// the ids. Updates any <label> `for' attributes to match the new ids.
// If hrefStart specified, appends the unique number to hrefs that starts
// with hrefStart.  (This is useful e.g. if many instances of a jQuery UI
// widget is to be instantiated, and widget internal stuff reference other
// widget internal stuff via ids.)
function makeIdsUniqueUpdateLabels(jqueryObj, hrefStart) {
  var seqNo = '_sno-'+ (++idSuffixSequence);
  jqueryObj.find("*[id]").each(function(ix) {
      $(this).attr('id', $(this).attr('id') + seqNo);
    });
  jqueryObj.find('label').each(function(ix) {
      $(this).attr('for', $(this).attr('for') + seqNo);
    });
  jqueryObj.find('*[href^='+ hrefStart + ']').each(function(ix) {
    $(this).attr('href', this.hash + seqNo);
  });
}

function buildTagFind(html, selector) {
  if (selector.indexOf('#') !== -1) die('Cannot lookup by ID: '+
      'getElementById might return false, so use buildTagFindId instead');
  // From jQuery 1.4.2, jQuery.fn.load():
  var $wrap =
      // Create a dummy div to hold the results
      jQuery('<div />')
      // inject the contents of the document in, removing the scripts
      // to avoid any 'Permission Denied' errors in IE
      .append(html.replace(/<script(.|\s)*?\/script>/gi, ''));
  var $tag = $wrap.find(selector);
  return $tag;
}

// Builds HTML tags from `html' and returns the tag with the specified id.
// Works also when $.find('#id') won't (because of corrupt XML?).
function buildTagFindId(html, id) {
  if (id.indexOf('#') !== -1) die('Include no # in id [error DwE85x2jh]');
  var $tag = buildTagFind(html, '[id="'+ id +'"]');
  return $tag;
}

// `then' and `now' can be Date:s or milliseconds.
// Consider using: https://github.com/rmm5t/jquery-timeago.git, supports i18n.
function prettyTimeBetween(then, now) {  // i18n
  var thenMillis = then.getTime ? then.getTime() : then;
  var nowMillis = now.getTime ? now.getTime() : now;
  var diff = nowMillis - thenMillis;
  var second = 1000;
  var minute = second * 60;
  var hour = second * 3600;
  var day = hour * 24;
  var week = day * 7;
  var month = day * 31 * 30 / 2;  // integer
  var year = day * 365;
  // I prefer `30 hours ago' to `1 day ago', but `2 days ago' to `50 hours ago'.
  if (diff > 2 * year) return trunc(diff / year) +" years ago";
  if (diff > 2 * month) return trunc(diff / month) +" months ago";
  if (diff > 2 * week) return trunc(diff / week) +" weeks ago";
  if (diff > 2 * day) return trunc(diff / day) +" days ago";
  if (diff > 2 * hour) return trunc(diff / hour) +" hours ago";
  if (diff > 2 * minute) return trunc(diff / minute) +" minutes ago";
  if (diff > 1 * minute) return "1 minute ago";
  if (diff > 2 * second) return trunc(diff / second) +" seconds ago";
  if (diff > 1 * second) return "1 second ago";
  return "0 seconds ago";
}


// ------- Initialization functions

function registerEventHandlersFireLoginOut() {
  $('#dw-a-login').click(showLoginSimple);
  $('#dw-a-logout').click(showLogout);

  // On post text click, open the inline action menu.
  // But hide it on mousedown, so the inline action menu disappears when you
  // start the 2nd click of a double click, and appears first when the 2nd
  // click is completed. Otherwise the inline menu gets in the
  // way when you double click to select whole words. (Or triple click to
  // select paragraphs.)
  $('.debiki').delegate('.dw-p-bd-blk', 'mouseup', $showInlineActionMenu)
      .delegate('.dw-p-bd-blk', 'mousedown', $hideInlineActionMenu);

  // Remove new-reply and rating forms on cancel, but 
  // the edit form has some own special logic.
  $('.debiki').delegate(
      '.dw-fs-re .dw-fi-cancel, ' +
      '.dw-fs-r .dw-fi-cancel',
      'click', $removeClosestForms);

  // Show the related inline reply, on inline mark click.
  $('.debiki').delegate('a.dw-i-m-start', 'click', $showInlineReply);

  // Add tooltips lazily.
  $('.debiki').delegate('.dw-p-hd', 'mouseenter', $makePostHeadTooltips);


  window.onbeforeunload = confirmClosePage;

  // Hide all action forms, since they will be slided in.
  $('#dw-hidden-templates .dw-fs').hide();

  // Show more rating tags when clicking the "More..." button.
  rateFormTemplate.find('.dw-show-more-r-tags').click($showMoreRatingTags);


  // Show a change diff instead of the post text, when hovering an edit
  // suggestion.
  $('.debiki')
      .delegate('.dw-e-sg', 'mouseenter', function(){
        // COULD move find(...) to inside $showEditDiff?
        // (Don't want such logic placed down here.)
        $(this).find('.dw-e-text').each($showEditDiff);
      })
      .delegate('.dw-e-sgs', 'mouseleave', $removeEditDiff);

  initCreateForm();

  // Fire the dwEvLoggedInOut event, so all buttons etc will update
  // their text with the correct user name.
  // {{{ Details:
  // Firing the dwEvLoggedInOut event causes the user name to be updated
  // to the name of the logged in user, everywhere. This needs to be done
  // in JavaScript, cannot be done only server side — because when the user
  // logs in/out using JavaScript, and uses the browser's *back* button to
  // return to an earlier page, that page might not be fetched again
  // from the server, but this javascript code updates the page to take
  // into account that the user name (and related cookies) has changed
  // (since the user logged in/out).
  // Do this when everything has been inited, so all dwEvLoggedInOut event
  // listeners have been registered. }}}

  $('.dw-loginsubmit-on-click').click($loginThenSubmit);
  $('.dw-loginsubmit-on-mouseenter').mouseenter($loginThenSubmit);
  if (Me.isLoggedIn()) fireLogin();
  else fireLogout();

  // If the user switches browser tab, s/he might logout and login
  // in another tab. That'd invalidate all xsrf tokens on this page,
  // and user specific permissions and ratings info (for this tab).
  // Therefore, when the user switches back to this tab, check
  // if a new session has been started.
  $(window).on('focus', Me.fireLoginIfNewSession);
  //{{{ What will work w/ IE?
  // See http://stackoverflow.com/a/5556858/694469
  // But: "This script breaks down in IE(8) when you have a textarea on the
  // page.  When you click on the textarea, the document and window both
  // lose focus"
  //// IE EVENTS
  //$(document).bind('focusin', function(){
  //    alert('document focusin');
  //});
  //if (/*@cc_on!@*/false) { // check for Internet Explorer
  //  document.onfocusin = onFocus;
  //  document.onfocusout = onBlur;
  //} else {
  //  window.onfocus = onFocus;
  //  window.onblur = onBlur;
  //}
  //
  // http://stackoverflow.com/a/6184276/694469
  //window.addEventListener('focus', function() {
  //  document.title = 'focused';
  //});
  //window.addEventListener('blur', function() {
  //    document.title = 'not focused';
  //});
  //}}}
}


function initAndDrawSvg() {
  // Don't draw SVG until all html tags has been placed, or the SVG
  // arrows might be offset incorrectly.
  // Actually, drawing SVG takes long, so wait for a while,
  // don't do it on page load.
  SVG.initRootSvg();
  SVG.drawEverything();
}


// ------- Actually render the page

// Render the page step by step, to reduce page loading time. (When the first
// step is done, the user should conceive the page as mostly loaded.)

function renderPageEtc() {
  var $posts = $('.debiki .dw-p:not(.dw-p-ttl)');
  function initPostsThreadStep1() {
    $posts.each($initPostsThreadStep1);
    $('html').removeClass('dw-render-actions-pending');
  }
  function initPostsThreadStep2() { $posts.each($initPostsThreadStep2) }
  function initPostsThreadStep3() { $posts.each($initPostsThreadStep3) }
  function initPostsThreadStep4() { $posts.each($initPostsThreadStep4) }

  workAroundAnyAndroidZoomBug();

  // IE 6, 7 and 8 specific elems (e.g. upgrade-to-newer-browser info)
  // (Could do this on the server instead, that'd work also with Javascript
  // disabled. But people who know what javascript is and disable it,
  // probably don't use IE 6 and 7? So this'll be fine for now.)
  var $body =  $('body');
  if ($.browser.msie) {
    if ($.browser.version < '8') $body.addClass('dw-ua-lte-ie7');
    if ($.browser.version < '9') $body.addClass('dw-ua-lte-ie8');
  }

  Me.refreshProps();

  // When you zoom in or out, the width of the root thread might change
  // a few pixels — then its parent should be resized so the root
  // thread fits inside with no float drop.
  zoomListeners.push(resizeRootThread);

  var steps = [];
  steps.push(initPostsThreadStep1);
  steps.push(initPostsThreadStep2);
  steps.push(initPostsThreadStep3);
  // COULD fire login earlier; it's confusing that the 'Login' link
  // is visible for rather long, when you load a *huge* page.
  steps.push(registerEventHandlersFireLoginOut);
  steps.push(initPostsThreadStep4);
  steps.push(initAndDrawSvg);
  steps.push(scrollToUrlAnchorPost);
  // Resize the article, now when the page has been rendered, and all inline
  // threads have been placed and can be taken into account.
  steps.push(function() {
    resizeRootThread();
    $('html').removeClass('dw-render-layout-pending');
    debiki.scriptLoad.resolve();
  });
  if (!Modernizr.touch) steps.push(function() {
    initKeybdShortcuts();
    initUtterscroll();
  });

  function runNextStep() {
    steps[0]();
    steps.shift();
    if (steps.length > 0)
      setTimeout(runNextStep, 70);
  }

  setTimeout(runNextStep, 60);
}


// Dont render page, if there is no root post, or some error happens,
// which kills other Javascript that runs on page load.
if (rootPostId) renderPageEtc();


//----------------------------------------
   }); // end jQuery onload
//----------------------------------------

//========================================
   }()); // end Debiki module
//========================================


// For now, inline former debiki-lift.js here.
// For unknown reasons, I could never get Play Framework RC3 to route
// to that file.
//----------------------------------------
   jQuery.noConflict()(function($){
//----------------------------------------

"use strict;"

// Don't remove the doctype comment below!
/*
debiki.v0.setReplyFormLoader(function(debateId, postId, complete) {

  // Use datatype "text", because, in at least Chrome 9.0.597.19 beta:
  // 1. If data type "xml" is specified, the error
  // "WRONG_DOCUMENT_ERR: DOM Exception 4" occurs.
  // 2. If data typ "text" is specified, and an XML header <?xml version...?>
  // is included in replyData, the error "WRONG_DOCUMENT_ERR: DOM Exception 4"
  // happens.
  // 3. If no data type is specified, an error happens in jquery-1.4.2.js line
  // 4187: "Uncaught TypeError: Cannot call method 'replace' of undefined".
  // Here: (innerHTML is undefined, no idea why)
  //  html: function( value ) {
  //      if ( value === undefined ) {
  //          return this[0] && this[0].nodeType === 1 ?
  //  --->        this[0].innerHTML.replace(rinlinejQuery, "") :
  //              null;
  // Therefore: data type "text" is specified below. (And the server uploads
  // no XML header.)

  $.get('/-'+ debateId +'/'+ postId +'.xml?reply', function(replyText) {
    var $replyForm = $(replyText).find('.dw-fs-re');
    complete($replyForm)
  }, 'text');
});

debiki.v0.setEditFormLoader(function(debateId, rootPostId, postId, complete) {
  // see comments in setReplyFormLoader above on using datatype text
  $.get('?edit='+ postId +'&view='+ rootPostId, function(editFormText) {
    var $editForm = $(editFormText).find('.dw-fs-ed');
    complete($editForm)
  }, 'text');
});
*/

debiki.v0.setReplyFormSubmitter(function($form, debateId, rootPostId, postId) {
  return $.post('?reply='+ postId +'&view='+ rootPostId,
      $form.serialize(), 'html');
});

debiki.v0.setEditFormSubmitter(function($form, debateId, rootPostId, postId) {
  return $.post('?edit='+ postId +'&view='+ rootPostId, $form.serialize(),
      'html');
});

debiki.v0.setRatePostUrl(function(debateId, rootPostId, postId) {
  return '?rate='+ postId +'&view='+ rootPostId;
});

//----------------------------------------
   })
//----------------------------------------

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

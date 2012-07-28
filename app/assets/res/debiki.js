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
   var $header = d.i.findPostHeader$(postId);
   $header.each($doSomething);

}}}*/


//========================================
   (function(){
//========================================
//----------------------------------------
   jQuery.noConflict()(function($){
//----------------------------------------

"use strict";

// Import namespaces as `d.i` and `d.u`.
var d = { i: debiki.internal, u: debiki.v0.util };

// Import terribly frequently used functions.
var die = d.u.die;
var die2 = d.u.die2;
var dieIf = d.u.dieIf;
var die2If = d.u.die2If;
var bugIf = d.u.bugIf;


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

d.i.showInteractionsIfHidden = function() {
  // If they're hidden, there's a button that shows them.
  $('.dw-a-show-interactions').click();
};


// ------- Variables

// Debiki convention: Dialog elem tabindexes should vary from 101 to 109.
// HTML generation code assumes this, too. See Debiki for Developers, #7bZG31.
var DEBIKI_TABINDEX_DIALOG_MAX = 109;

var hostAndPort = location.origin.replace(/https?:\/\//, '');

var rootPostId = $('.dw-depth-0');
rootPostId = rootPostId.length ?
    rootPostId.attr('id').substr(5) : undefined; // drops initial `dw-t-'

// If there's no SVG support, we'll use images instead.
var nativeSvgSupport = Modernizr.inlinesvg;

var SVG = nativeSvgSupport && document.URL.indexOf('svg=false') === -1 ?
    d.i.makeSvgDrawer($) : d.i.makeFakeDrawer($);

var Me = d.i.makeCurUser();



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
};


function $initPostsThreadStep1() {
  d.i.createActionLinksForPost(this);
  // Open/close threads if the fold link is clicked.
  var $thread = $(this).closest('.dw-t');
  $thread.children('.dw-z').click(d.i.$threadToggleFolded);
};


function $initPostsThreadStep2() {
  d.i.shohwActionLinksOnHoverPost(this);
  $initPostStep1.apply(this);
};


function $initPostsThreadStep3() {
  $initPostStep2.apply(this);
};


function $initPostsThreadStep4() {
  d.i.makeThreadResizableForPost(this);
  d.i.showCurLocationInSiteNav();
};


// Inits a post, not its parent thread.
function $initPost() {
  $initPostStep1.apply(this);
  $initPostStep2.apply(this);
};


function $initPostStep1() {
  d.i.placeInlineThreadsForPost(this);
  d.i.makeHeaderPrettyForPost(this);
};


function $initPostStep2() {
  // $initPostSvg takes rather long (190 ms on my 6 core 2.8 GHz AMD, for
  // 100 posts), and  need not be done until just before SVG is drawn.
  SVG.$initPostSvg.apply(this);
};



// -------


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
};



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
};



// ------- Initialization functions


function registerEventHandlersFireLoginOut() {

  window.onbeforeunload = confirmClosePage;

  // Hide all action forms, since they will be slided in.
  $('#dw-hidden-templates .dw-fs').hide();

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

  // COULD move this to debiki-login.js
  $('.dw-loginsubmit-on-click').click(d.i.$loginThenSubmit);

  if (d.i.Me.isLoggedIn()) d.i.Me.fireLogin();
  else d.i.Me.fireLogout();

  // If the user switches browser tab, s/he might logout and login
  // in another tab. That'd invalidate all xsrf tokens on this page,
  // and user specific permissions and ratings info (for this tab).
  // Therefore, when the user switches back to this tab, check
  // if a new session has been started.
  $(window).on('focus', d.i.Me.fireLoginIfNewSession);
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
};


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

  (d.u.workAroundAndroidZoomBug || function() {})($);

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
  d.u.zoomListeners.push(d.i.resizeRootThread);

  var steps = [];
  steps.push(initPostsThreadStep1);
  steps.push(initPostsThreadStep2);
  steps.push(initPostsThreadStep3);
  // COULD fire login earlier; it's confusing that the 'Login' link
  // is visible for rather long, when you load a *huge* page.
  steps.push(registerEventHandlersFireLoginOut);
  steps.push(initPostsThreadStep4);

  // Don't draw SVG until all html tags has been placed, or the SVG
  // arrows might be offset incorrectly.
  // Actually, drawing SVG takes long, so wait for a while,
  // don't do it on page load.
  steps.push(SVG.initRootDrawArrows);

  steps.push(d.i.scrollToUrlAnchorPost);
  // Resize the article, now when the page has been rendered, and all inline
  // threads have been placed and can be taken into account.
  steps.push(function() {
    d.i.resizeRootThread();
    $('html').removeClass('dw-render-layout-pending');
    debiki.scriptLoad.resolve();
  });
  if (!Modernizr.touch) steps.push(function() {
    d.i.initKeybdShortcuts($);
    initUtterscroll();
  });

  function runNextStep() {
    steps[0]();
    steps.shift();
    if (steps.length > 0)
      setTimeout(runNextStep, 70);
  }

  setTimeout(runNextStep, 60);
};


// Export stuff.
d.i.$initPostsThread = $initPostsThread;
d.i.$initPost = $initPost;
d.i.DEBIKI_TABINDEX_DIALOG_MAX = DEBIKI_TABINDEX_DIALOG_MAX;
d.i.hostAndPort = hostAndPort;
d.i.Me = Me;
d.i.SVG = SVG;
d.i.rootPostId = rootPostId;


// Dont render page, if there is no root post, or some error happens,
// which kills other Javascript that runs on page load.
if (rootPostId) renderPageEtc();


//----------------------------------------
   }); // end jQuery onload
//----------------------------------------
//========================================
   }()); // end Debiki module
//========================================


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

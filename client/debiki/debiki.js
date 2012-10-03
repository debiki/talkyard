/* Copyright (c) 2010 - 2012 Kaj Magnus Lindberg. All rights reserved. */


//========================================
   (function(){
//========================================
//----------------------------------------
   jQuery.noConflict()(function($){
//----------------------------------------

"use strict";

var d = { i: debiki.internal, u: debiki.v0.util };


// Debiki convention: Dialog elem tabindexes should vary from 101 to 109.
// HTML generation code assumes this, too. See Debiki for Developers, #7bZG31.
d.i.DEBIKI_TABINDEX_DIALOG_MAX = 109;

d.i.rootPostId = $('.dw-depth-0');
d.i.rootPostId = d.i.rootPostId.length ?
    d.i.rootPostId.attr('id').substr(5) : undefined; // drops initial `dw-t-'

// If there's no SVG support, use PNG arrow images instead.
// Also use PNG arrows on mobiles; rendering SVG arrows takes rather long.
d.i.SVG = !Modernizr.touch && Modernizr.inlinesvg &&
      document.URL.indexOf('svg=false') === -1 ?
    d.i.makeSvgDrawer($) : d.i.makeFakeDrawer($);

d.i.Me = d.i.makeCurUser();


// Inits a post and its parent thread.
// Makes posts resizable, activates mouseenter/leave functionality,
// draws arrows to child threads, etc.
// Initing a thread is done in 4 steps. This function calls all those 4 steps.
// (The initialization is split into steps, so everything need not be done
// at once on page load.)
// Call on posts.
d.i.$initPostsThread = function() {
  $initPostsThreadStep1.apply(this);
  $initPostsThreadStep2.apply(this);
  $initPostsThreadStep3.apply(this);
  $initPostsThreadStep4.apply(this);
};


function $initPostsThreadStep1() {
  // Binding click events to action links takes rather long (100 ms on my
  // 6 core 2.8 GHz AMD for 200 posts) and could be split out to a separate
  // step, done as late as possible.
  d.i.createAndBindActionLinksForPost(this);

  // Open/close threads if the fold link is clicked.
  var $thread = $(this).closest('.dw-t');
  $thread.children('.dw-z').click(d.i.$threadToggleFolded);
};


function $initPostsThreadStep2() {
  d.i.shohwActionLinksOnHoverPost(this);
  d.i.placeInlineThreadsForPost(this);
  d.i.makeHeaderPrettyForPost(this);
};


function $initPostsThreadStep3() {
  // $initPostSvg takes rather long (190 ms on my 6 core 2.8 GHz AMD, for
  // 100 posts), and  need not be done until just before SVG is drawn.
  d.i.SVG.$initPostSvg.apply(this);
};


function $initPostsThreadStep4() {
  d.i.makeThreadResizableForPost(this);
};


// Inits a post, not its parent thread.
d.i.$initPost = function() {
  // ? Should I call createAndBindActionLinksForPost and
  // shohwActionLinksOnHoverPost from here, sometimes ?
  d.i.placeInlineThreadsForPost(this);
  d.i.makeHeaderPrettyForPost(this);
  d.i.SVG.$initPostSvg.apply(this);
};


function registerEventHandlersFireLoginOut() {

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


// Render the page step by step, to reduce page loading time. (When the first
// step is done, the user should conceive the page as mostly loaded.)

function renderPageEtc() {

  // XSRF token refresh, and
  // JSON vulnerability protection
  // ((Details: Strip a certain reply prefix. This prevents the JSON
  // from being parsed as Javascript from a <script> tag. This'd otherwise
  // allow third party websites to turn your JSON resource URL into JSONP
  // request under some conditions, see:
  //   http://docs.angularjs.org/api/ng.$http, the "JSON Vulnerability
  // Protection" section.))
  $.ajaxSetup({
    dataFilter: function (response, type) {
      // Don't know why, but `type` is alwyas undefined, so won't work:
      // if (type !== 'json') return response;
      // Sometimes, in FF (at least) and when the server replies 200 OK
      // with no body it seems, `response` is the `document` itself,
      // oddly enough, not a string.
      if (typeof response === 'string')
        response = response.replace(/^\)\]}',\n/, '');
      return response;
    },
    complete: function() {
      // Refresh <form> xsrf tokens, in case the server set a new cookie
      // (that happens e.g. if I change certain server side XSRF code, or
      // perhaps I'll some day decide that XSRF tokens will be valid for
      // one month only).
      var token = $.cookie('dwCoXsrf');
      $('input.dw-fi-xsrf').attr('value', token);
    }
  });

  var $posts = $('.debiki .dw-p:not(.dw-p-ttl)');

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

  d.i.Me.refreshProps();
  d.i.showCurLocationInSiteNav();

  if (!Modernizr.touch) {
    d.i.initKeybdShortcuts($);
    d.i.initUtterscrollAndTips();
  }

  // When you zoom in or out, the width of the root thread might change
  // a few pixels — then its parent should be resized so the root
  // thread fits inside with no float drop.
  d.u.zoomListeners.push(d.i.resizeRootThread);

  var steps = [];

  steps.push(function() {
    $posts.each($initPostsThreadStep1);
    $('html').removeClass('dw-render-actions-pending');
  });

  steps.push(function() {
    $posts.each($initPostsThreadStep2)
  });

  steps.push(function() {
    $posts.each($initPostsThreadStep3);
    registerEventHandlersFireLoginOut();
  });

  // COULD fire login earlier; it's confusing that the 'Login' link
  // is visible for rather long, when you load a *huge* page.
  steps.push(function() {
    $posts.each($initPostsThreadStep4)
  });

  // Don't draw SVG until all html tags has been placed, or the SVG
  // arrows might be offset incorrectly.
  // Actually, drawing SVG takes long, so wait for a while,
  // don't do it on page load.
  steps.push(d.i.SVG.initRootDrawArrows);

  steps.push(d.i.scrollToUrlAnchorPost);

  // Resize the article, now when the page has been rendered, and all inline
  // threads have been placed and can be taken into account.
  steps.push(function() {
    d.i.resizeRootThread();
    $('html').removeClass('dw-render-layout-pending');
    debiki.scriptLoad.resolve();
  });

  function runNextStep() {
    steps[0]();
    steps.shift();
    if (steps.length > 0)
      setTimeout(runNextStep, 70);
  }

  setTimeout(runNextStep, 60);
};


// Dont render page, if there is no root post, or some error happens,
// which kills other Javascript that runs on page load.
if (!d.i.rootPostId)
  return;

renderPageEtc();


//----------------------------------------
   }); // end jQuery onload
//----------------------------------------
//========================================
   }()); // end Debiki module
//========================================


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

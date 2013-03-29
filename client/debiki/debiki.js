/* Copyright (c) 2010-2013 Kaj Magnus Lindberg. All rights reserved. */


//========================================
   (function(){
//========================================
//----------------------------------------
   jQuery.noConflict()(function($){
//----------------------------------------

"use strict";

// Import LiveScript's prelude, http://gkz.github.com/prelude-ls/.
prelude.installPrelude(window);

var d = { i: debiki.internal, u: debiki.v0.util };


// Remembers grandparent openers even if the parent opener is closed.
d.i.windowOpeners = (function() {
  var curOpener = window.opener;
  var openers = [];
  while (curOpener) {
    openers.push(curOpener);
    curOpener = curOpener.opener;
  }
  return openers;
})();


// Debiki convention: Dialog elem tabindexes should vary from 101 to 109.
// HTML generation code assumes this, too. See Debiki for Developers, #7bZG31.
d.i.DEBIKI_TABINDEX_DIALOG_MAX = 109;

d.i.rootPostId = $('.dw-depth-0');
d.i.rootPostId = d.i.rootPostId.length ?
    d.i.rootPostId.attr('id').substr(5) : undefined; // drops initial `dw-t-'

d.i.Me = d.i.makeCurUser();


// Activates mouseenter/leave functionality, draws arrows to child threads, etc.
// Initing a thread is done in 4 steps. This function calls all those 4 steps.
// (The initialization is split into steps, so everything need not be done
// at once on page load.)
// Call on posts.
d.i.$initPostAndParentThread = function() {
  $initStep1.apply(this);
  d.i.$initPost.apply(this);
  $initStep4.apply(this);
};


/**
 * Inits a post, not its parent thread. Call when a post has been replaced
 * e.g. after having been edited, but when the parent thread hasn't been
 * replaced.
 */
d.i.$initPost = function() {
  $initStep2.apply(this);
  $initStep3.apply(this);
};


function $initStep1() {
  // Binding click events to action links takes rather long (100 ms on my
  // 6 core 2.8 GHz AMD for 200 posts) and could be split out to a separate
  // step, done as late as possible.
  d.i.createAndBindActionLinksForPost(this);
};


function $initStep2() {
  d.i.shohwActionLinksOnHoverPost(this);
  d.i.placeInlineThreadsForPost(this);
  d.i.makePostHeaderPretty($(this).children('.dw-p-hd'));
};


function $initStep3() {
  // $initPostSvg takes rather long (190 ms on my 6 core 2.8 GHz AMD, for
  // 100 posts), and  need not be done until just before SVG is drawn.
  d.i.SVG.$initPostSvg.apply(this);
};


function $initStep4() {
  d.i.makeThreadResizableForPost(this);
};


function fireLoginOrLogout() {
  if (d.i.Me.isLoggedIn())
    d.i.Me.fireLogin();
  else
    d.i.Me.fireLogout();
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

  fireLoginOrLogout();

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


/**
 * XSRF token refresh, and JSON vulnerability protection
 * ((Details: Strips a certain reply prefix. This prevents the JSON
 * from being parsed as Javascript from a <script> tag. This'd otherwise
 * allow third party websites to turn your JSON resource URL into JSONP
 * request under some conditions, see:
 *   http://docs.angularjs.org/api/ng.$http, the "JSON Vulnerability
 * Protection" section.))
 */
function configureAjaxRequests() {
  $.ajaxSetup({
    // There're questions at StackOverflow asking why `cache: false`
    // doesn't work with IE8. Does it not? I've not yet tested.
    cache: false,
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
      var token = $.cookie('XSRF-TOKEN');
      $('input.dw-fi-xsrf').attr('value', token);
    }
  });
};


/**
 * Renders the page, step by step, to reduce page loading time. (When the
 * first step is done, the user should conceive the page as mostly loaded.)
 */
function renderPageEtc() {

  configureAjaxRequests();

  var $posts = $('.debiki .dw-p:not(.dw-p-ttl)');

  // If there's no SVG support, use PNG arrow images instead.
  // Also use PNG arrows on mobiles; rendering SVG arrows takes rather long.
  // And use PNG arrows if there are many comments, because then rendering
  // takes too long also on desktops.
  d.i.SVG = !Modernizr.touch && Modernizr.inlinesvg &&
        document.URL.indexOf('svg=false') === -1 &&
        $posts.length < 15 ?
      d.i.makeSvgDrawer($) : d.i.makeFakeDrawer($);


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

  d.i.makePostHeaderPretty($('.dw-ar-p-hd'));

  var steps = [];

  steps.push(function() {
    d.i.layoutThreads();
    $posts.each($initStep1);
    $('html').removeClass('dw-render-actions-pending');
  });

  steps.push(function() {
    $posts.each($initStep2)
  });

  steps.push(function() {
    $posts.each($initStep3);
    registerEventHandlersFireLoginOut();
  });

  // COULD fire login earlier; it's confusing that the 'Login' link
  // is visible for rather long, when you load a *huge* page.
  steps.push(function() {
    $posts.each($initStep4)
  });

  // Don't draw SVG until all html tags has been placed, or the SVG
  // arrows might be offset incorrectly.
  // Actually, drawing SVG takes long, so wait for a while,
  // don't do it on page load.
  steps.push(d.i.SVG.initRootDrawArrows);

  steps.push(d.i.scrollToUrlAnchorPost);

  // Disable for now, I'll rewrite it to consider timestamps.
  //steps.push(d.i.startNextUnreadPostCycler);

  steps.push(function() {
    debiki.scriptLoad.resolve();
    d.i.startReadingProgresMonitor();
  });

  function runNextStep() {
    steps[0]();
    steps.shift();
    if (steps.length > 0)
      setTimeout(runNextStep, 70);
  }

  setTimeout(runNextStep, 60);
};


/**
 * Use this function if there is no root post on the page, but only meta info.
 * (Otherwise, if you use `renderPageEtc()`, some error happens, which kills
 * other Javascript that runs on page load.)
 */
function renderEmptyPage() {
  // (Don't skip all steps, although the page is empty. For example, the admin
  // dashbar depends on login/logout events, and it's shown even if there's no
  // root post — e.g. on blog list pages, which list child pages only but no
  // main title or article.)
  configureAjaxRequests();
  d.i.Me.refreshProps();
  if (!Modernizr.touch) {
    d.i.initKeybdShortcuts($);
    d.i.initUtterscrollAndTips();
  }
  fireLoginOrLogout();
};


if (!d.i.rootPostId) {
  // Skip most of the rendering step, since there is no root post.
  renderEmptyPage();
  return;
}

renderPageEtc();


//----------------------------------------
   }); // end jQuery onload
//----------------------------------------
//========================================
   }()); // end Debiki module
//========================================


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

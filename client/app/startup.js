/* Bootstraps Debiki's browser stuff.
 * Copyright (C) 2010-2013 Kaj Magnus Lindberg (born 1979)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

"use strict";

var d = { i: debiki.internal, u: debiki.v0.util };

d.i.TitleId = 0;
d.i.BodyId = 1;


// Debiki convention: Dialog elem tabindexes should vary from 101 to 109.
// HTML generation code assumes this, too. See Debiki for Developers, #7bZG31.
d.i.DEBIKI_TABINDEX_DIALOG_MAX = 109;


function $initStep4() {
  d.i.makeThreadResizableForPost(this);
};


function fireLoginOrLogout() {
  if (debiki2.ReactStore.getUser().isLoggedIn) {
    d.i.refreshFormXsrfTokens();
  }
};


function handleLoginInOtherBrowserTab() {
  var currentUser = debiki2.ReactStore.getUser();
  var sessionId = $.cookie('dwCoSid');
  if (currentUser.isLoggedIn) {
    if (sessionId) {
      // Session id example: (parts: hash, user id, name, login time, random value)
      // 'Y1pBlH7vY4JW9A.11.Magnus.1316266102779.15gl0p4xf7'
      var parts = sessionId.split('.');
      var newUserId = parts[1];
      if (currentUser.userId !== newUserId) {
        // We've logged in as another user in another browser tab.
        debiki2.ReactActions.login();
      }
    }
    else {
      // We've logged out in another browser tab.
      debiki2.ReactActions.logout();
    }
  }
  else if (sessionId) {
    // We've logged in in another browser tab.
    debiki2.ReactActions.login();
  }
}


function registerEventHandlersFireLoginOut() {

  // Hide all action forms, since they will be slided in.
  $('#dw-hidden-templates .dw-fs').hide();

  fireLoginOrLogout();

  // If the user switches browser tab, s/he might logout and login
  // in another tab. That'd invalidate all xsrf tokens on this page,
  // and user specific permissions and ratings info (for this tab).
  // Therefore, when the user switches back to this tab, check
  // if a new session has been started.
  $(window).on('focus', handleLoginInOtherBrowserTab);

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
 * Protection" section, and:
 *   http://haacked.com/archive/2008/11/20/anatomy-of-a-subtle-json-vulnerability.aspx/ ))
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
      // Refresh <form> xsrf tokens, in case the server set a new cookie.
      // (That happens if the user logs in, or if I change certain server
      // side XSRF code, or perhaps I'll some day decide that XSRF tokens
      /// will be valid for one month only.)
      d.i.refreshFormXsrfTokens();
    }
  });
};



d.i.refreshFormXsrfTokens = function() {
  var token = $.cookie('XSRF-TOKEN');
  $('input.dw-fi-xsrf').attr('value', token);
};



function runSiteConfigScripts() {
  var configScripts = $('head script[type="text/x-debiki-config"]');
  configScripts.each(function() {
    var javascriptCode = $(this).text();
    eval(javascriptCode);
  });
};



/**
 * Renders the page, step by step, to reduce page loading time. (When the
 * first step is done, the user should conceive the page as mostly loaded.)
 */
function renderDiscussionPage() {

  configureAjaxRequests();

  var $posts = $('.debiki .dw-p:not(.dw-p-ttl)');

  (d.u.workAroundAndroidZoomBug || function() {})($);

  // IE 6, 7 and 8 specific elems (e.g. upgrade-to-newer-browser info)
  // (Could do this on the server instead, that'd work also with Javascript
  // disabled. But people who know what javascript is and disable it,
  // probably don't use IE 6 and 7? So this'll be fine for now.)
  var $body =  $('body');
  if ($.browser.msie && $.browser.version.length == 1) {
    if ($.browser.version < '8') $body.addClass('dw-ua-lte-ie7');
    if ($.browser.version < '9') $body.addClass('dw-ua-lte-ie8');
  }

  d.i.showCurLocationInSiteNav();

  // Do this before rendering the page.
  d.i.layout = d.i.chooseLayout();
  d.i.layoutThreads();

  //debiki2.renderer.renderTitleBodyComments();
  renderTitleBodyComments();

  var steps = [];

  steps.push(function() {
    debiki2.initAllReactRoots();

    $('html').removeClass('dw-render-actions-pending');

    if (d.i.layout === 'TreeLayout' && !Modernizr.touch) {
      d.i.initUtterscrollAndTips();
    }

    // Show root post actions initially.
    $('.dw-depth-0 > .dw-p-as').addClass('dw-p-as-shown').attr('id', 'dw-p-as-shown');
    // Don't dim any horizontal root post reply button.
    $('.dw-p-as-hz-reply').addClass('dw-p-as-shown');
  });

  steps.push(function() {
    registerEventHandlersFireLoginOut();
  });

  // COULD fire login earlier; it's confusing that the 'Login' link
  // is visible for rather long, when you load a *huge* page.
  steps.push(function() {
    $posts.each($initStep4)
  });

  // If #post-X is specified in the URL, ensure all posts leading up to
  // and including X have been loaded. Then scroll to X.
  steps.push(function() {
    d.i.ensureAnyAnchorPostLoaded(function() {
      d.i.scrollToUrlAnchorPost();
      debiki2.postnavigation.renderPostNavigationPanel();
    });
  });

  // Disable for now, I'll rewrite it to consider timestamps.
  //steps.push(d.i.startNextUnreadPostCycler);

  steps.push(function() {
    d.i.makePinsDragsortable();
    debiki2.ReactStore.activateUserSpecificData(); // do before registerEventHandlersFireLoginOut?
  });

  steps.push(function() {
    debiki.scriptLoad.resolve();
    runSiteConfigScripts();
  });

  steps.push(function() {
    debiki2.sidebar.UnreadCommentsTracker.start();
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
 * (Otherwise, if you use `renderDiscussionPage()`, some error happens, which kills
 * other Javascript that runs on page load.)
 */
d.i.renderEmptyPage = function() {
  // (Don't skip all steps, although the page is empty. For example, the admin
  // dashbar depends on login/logout events, and it's shown even if there's no
  // root post — e.g. on blog list pages, which list child pages only but no
  // main title or article.)
  configureAjaxRequests();
  if (!Modernizr.touch) {
    d.i.initUtterscrollAndTips();
  }
  debiki2.initAllReactRoots();
  debiki2.ReactStore.activateUserSpecificData();
  fireLoginOrLogout();
};


d.i.startDiscussionPage = function() {
  $(function() {
    // Import LiveScript's prelude, http://gkz.github.com/prelude-ls/.
    prelude.installPrelude(window);

    if ($('.dw-page').length) {
      renderDiscussionPage();
    }
    else {
      // Skip most of the rendering step, since there is no Debiki page present.
      d.i.renderEmptyPage();
    }
  });
};


d.i.startEmbeddedEditor = function() {
  configureAjaxRequests();
  debiki2.editor.createEditor();
};


// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list

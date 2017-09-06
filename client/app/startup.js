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

var scriptLoadDoneCallbacks = [];
debiki.scriptLoad = {  // RENAME to ed.whenStarted(...) ?
  done: function(callback) {
    scriptLoadDoneCallbacks.push(callback);
  }
};

debiki.FirstSiteId = '1';
debiki.debug = window.location.search.indexOf('debug=true') >= 0;
d.i.TitleNr = 0;
d.i.BodyNr = 1;

var allPostsNotTitleSelector = '.debiki .dw-p:not(.dw-p-ttl)';

// Debiki convention: Dialog elem tabindexes should vary from 101 to 109.
// HTML generation code assumes this, too. See Debiki for Developers, #7bZG31.
d.i.DEBIKI_TABINDEX_DIALOG_MAX = 109;


// Tell KeyMaster to handle Escape clicks also inside <input>s.
keymaster.filter = function(event) {
  if (event.keyCode === 27) // escape is 27
    return true;
  var tagName = (event.target || event.originalTarget).tagName;
  return !(tagName == 'INPUT' || tagName == 'SELECT' || tagName == 'TEXTAREA');
};


function handleLoginInOtherBrowserTab() {
  var currentUser = debiki2.ReactStore.getMe();
  var sessionId = getSetCookie('dwCoSid');
  if (currentUser.isLoggedIn) {
    if (sessionId) {
      // Session id example: (parts: hash, user id, name, login time, random value)
      // 'Y1pBlH7vY4JW9A.11.Magnus.1316266102779.15gl0p4xf7'
      var parts = sessionId.split('.');
      var newUserIdString = parts[1];
      if (currentUser.userId !== parseInt(newUserIdString)) {
        // We've logged in as another user in another browser tab.
        debiki2.ReactActions.loadMyself();
      }
    }
    else {
      // We've logged out in another browser tab. The server should already know about this.
      debiki2.ReactActions.logoutClientSideOnly();
    }
  }
  else if (sessionId) {
    // We've logged in in another browser tab.
    debiki2.ReactActions.loadMyself();
  }
}


function registerEventHandlersFireLoginOut() {
  // If the user switches browser tab, s/he might logout and login
  // in another tab. That'd invalidate all xsrf tokens on this page,
  // and user specific permissions and ratings info (for this tab).
  // Therefore, when the user switches back to this tab, check
  // if a new session has been started.
  Bliss.events(window, { 'focus': handleLoginInOtherBrowserTab });
}


/**
 * If the URL query string contains 2d=true/false, enables/disables
 * horizontal comments. If the screen is narrow, forces one-column-layout.
 * Returns the layout type in use: 'OneColumnLayout' or 'TreeLayout'.
 */
function chooseInitialLayout() {
  var queryString = window.location.search;
  var shallEnable2d = queryString.search('2d=true') !== -1;
  var shallDisable2d = queryString.search('2d=false') !== -1 ||
      // use window.outerWidth — it doesn't force a layout reflow (and it's fine that it might
      // be a bit inexact because of browser window borders).
      Math.max(window.outerWidth, window.outerHeight) < 1000;
  var is2dEnabled = debiki2.ReactStore.allData().horizontalLayout;
  if (is2dEnabled && shallDisable2d) {
    disableHzComments();
    return 'OneColumnLayout';
  }
  if (!is2dEnabled && shallEnable2d) {
    enableHzComments();
    return 'TreeLayout';
  }

  var htmlElemClasses = document.documentElement.classList;

  function disableHzComments(){
    htmlElemClasses.remove('dw-hz');
    htmlElemClasses.add('dw-vt');
    _.each(debiki2.$$all('.dw-depth-0'), function(threadElem) {
      debiki2.$h.removeClasses(threadElem, 'dw-hz');
    });
    debiki2.ReactActions.setHorizontalLayout(false);
  }

  function enableHzComments(){
    htmlElemClasses.remove('dw-vt');
    htmlElemClasses.add('dw-hz');
    _.each(debiki2.$$all('.dw-depth-0'), function(threadElem) {
      debiki2.$h.addClasses(threadElem, 'dw-hz');
    });
    debiki2.ReactActions.setHorizontalLayout(true);
  }

  if (is2dEnabled) {
    return 'TreeLayout';
  }
  else {
    return 'OneColumnLayout';
  }
}



/**
 * Renders the page, step by step, to reduce page loading time. (When the
 * first step is done, the user should conceive the page as mostly loaded.)
 */
function renderDiscussionPage() {
  // Do this before rendering the page.
  var _2dLayout = chooseInitialLayout() === 'TreeLayout';
  if (_2dLayout) {
    debiki2.utils.onMouseDetected(debiki2.Server.load2dScriptsBundleStart2dStuff);
  }

  // Make it possible to test React.js performance in the browser.
  if (location.search.indexOf('breakReactChecksums=true') !== -1) {
    var reactRoots = debiki2.$bySelector('[data-react-checksum]');
    _.each(reactRoots, function(root) {
      root.setAttribute('data-react-checksum', 'wrong-checksum-EdMRERNDR1');
    });
    console.log("I've altered the React.js checksums, everything will be rerendered. [EdMRERNDR2]");
  }

  var Perf = location.search.indexOf('reactPerf=true') !== -1 ? React.addons.Perf : null;
  !Perf || Perf.start();
  var timeBefore = performance.now();

  debiki2.renderTitleBodyComments();

  var timeAfterBodyComments = performance.now();
  if (Perf) {
    Perf.stop();
    console.log('Perf.printInclusive:');
    Perf.printInclusive();
    console.log('Perf.printExclusive:');
    Perf.printExclusive();
    console.log('Perf.printWasted:');
    Perf.printWasted();
    console.log('You could also:  Perf.printDOM()');
  }

  var posts = debiki2.$bySelector(allPostsNotTitleSelector);
  var numPosts = posts.length;
  var timeBeforeTimeAgo = performance.now();
  // Only process the header right now if there are many posts.
  debiki2.processTimeAgo(numPosts > 20 ? '.dw-ar-p-hd' : '');
  var timeAfterTimeAgo = performance.now();

  debiki2.ReactStore.initialize();
  debiki2.ReactStore.activateVolatileData();
  var timeAfterUserData = performance.now();

  debiki2.startRemainingReactRoots();
  var timeAfterRemainingRoots = performance.now();

  console.log("Millis to render page: " + (timeAfterBodyComments - timeBefore) +
    ", time-ago: " + (timeAfterTimeAgo - timeBeforeTimeAgo) +
    ", user data: " + (timeAfterUserData - timeAfterTimeAgo) +
    ", remaining roots: " + (timeAfterRemainingRoots - timeAfterUserData) + " [DwM2F51]");
  console.log("Cached html version: <" + debiki.cachedVersion +
      ">, current: <" + debiki.currentVersion + "> [DwM4KGE8]");
  if (debiki.currentVersion.split('|')[1] !== debiki.cachedVersion.split('|')[1]) {
    console.log("Cached html is stale. React.js might have logged a " +
        "'checksum was invalid' warning above (in dev builds) [DwM5KJG4]");
  }

  document.documentElement.classList.add(ReactStartedClass);

  debiki2.page.activateLikeButtons(debiki2.ReactStore.allData().settings);

  setTimeout(runNextStep, 60);


  var steps = [];

  steps.push(function() {
    registerEventHandlersFireLoginOut();
    debiki2.utils.startDetectingMouse();
  });

  steps.push(function() {
    debiki2.ReactActions.loadAndScrollToAnyUrlAnchorPost();
    debiki2.form.activateAnyCustomForm();
  });

  // Disable for now, I'll rewrite it to consider timestamps.
  //steps.push(d.i.startNextUnreadPostCycler);

  /* Post pins disabled right now, after I ported to React.
  steps.push(function() {
    d.i.makePinsDragsortable();
  }); */

  steps.push(function() {
    // Process any remaining time-ago:s, in case we didn't do all at once earlier.
    // Plus add collapse-thread buttons, for tall threads.
    debiki2.page.Hacks.processPosts();
    _.each(scriptLoadDoneCallbacks, function(c) { c(); });
    debiki2.page.PostsReadTracker.start();
  });

  function runNextStep() {
    debiki2.dieIf(!steps.length, "steps is empty [DwE5KPEW2]");
    steps[0]();
    steps.shift();
    if (steps.length > 0)
      setTimeout(runNextStep, 70);
  }
}


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
  debiki2.utils.onMouseDetected(debiki2.Server.load2dScriptsBundleStart2dStuff);
  debiki2.ReactStore.initialize();
  debiki2.startRemainingReactRoots();
  debiki2.ReactStore.activateVolatileData();
  document.documentElement.classList.add(ReactStartedClass);
  debiki2.utils.startDetectingMouse();
};


d.i.startDiscussionPage = function() {
  Bliss.ready().then(function() {
    if (debiki.getPageId()) {
      renderDiscussionPage();
    }
    else {
      // Skip most of the rendering step, since there is no Debiki page present.
      d.i.renderEmptyPage();
    }
  });
};


if (location.pathname.search(ApiUrlPathPrefix) !== 0) {
  debiki2.putInSessionStorage('returnToSiteUrl', window.location.toString());
}

// Later, when there's a single router for everything, bind this to router events instead:
debiki2.utils.highlightActiveLinkInHeader();

// Replace gifs with static images that won't play until clicked.
Gifffer();

// Show large images on click.
StupidLightbox.start('.dw-p-bd', '.giffferated, .no-lightbox');


// Open about-user dialog if one clicks a @username mention (instead of navigating away to
// the about-user page).
debiki2.ifEventOnNotThen('click', 'a.esMention', '', function(linkElem, event) {
  event.preventDefault();
  var username = linkElem.href.replace(/^.*\/-\/users\//, '');
  debiki2.morebundle.openAboutUserDialog(username, linkElem);
});


d.u.addZoomOrResizeListener(debiki2.page.Hacks.addCanScrollHintsSoon);


debiki2.dieIf(location.port && debiki.internal.serverOrigin.indexOf(':' + location.port) === -1,
    "Wrong port or origin? The server thinks its origin is " + debiki.internal.serverOrigin +
    " and it'll use that address when sending POST requests and loading scripts. " +
    "But you're accessing the server via " + location.host + ". [EsE7YGK2]");

// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list

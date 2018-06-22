/*
 * Copyright (c) 2010-2017 Kaj Magnus Lindberg
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

/// <reference path="prelude.ts" />
/// <reference path="init-all-react-roots.ts" />

const d = { i: debiki.internal };

const scriptLoadDoneCallbacks = [];
debiki.scriptLoad = {  // RENAME to ed.whenStarted(...) ?
  done: function(callback) {
    scriptLoadDoneCallbacks.push(callback);
  }
};

const allPostsNotTitleSelector = '.debiki .dw-p:not(.dw-p-ttl)';


function handleLoginInOtherBrowserTab() {
  const currentUser = debiki2.ReactStore.getMe();
  const sessionId = getSetCookie('dwCoSid');
  if (currentUser.isLoggedIn) {
    if (sessionId) {
      // Session id example: (parts: hash, user id, name, login time, random value)
      // 'Y1pBlH7vY4JW9A.11.Magnus.1316266102779.15gl0p4xf7'
      const parts = sessionId.split('.');
      const newUserIdString = parts[1];
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
  const queryString = window.location.search;
  const shallEnable2d = queryString.search('2d=true') !== -1;
  const shallDisable2d = queryString.search('2d=false') !== -1 ||
      // use window.outerWidth — it doesn't force a layout reflow (and it's fine that it might
      // be a bit inexact because of browser window borders).
      Math.max(window.outerWidth, window.outerHeight) < 1000;
  const store: Store = debiki2.ReactStore.allData();
  const page: Page = store.currentPage;
  const is2dEnabled = page.horizontalLayout;
  if (is2dEnabled && shallDisable2d) {
    disableHzComments();
    return 'OneColumnLayout';
  }
  if (!is2dEnabled && shallEnable2d) {
    enableHzComments();
    return 'TreeLayout';
  }

  const htmlElemClasses = document.documentElement.classList;

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


// REFACTOR rename this file to render-page-in-browser.ts? [7VUBWR45]

/**
 * Renders the page, step by step, to reduce page loading time. (When the
 * first step is done, the user should conceive the page as mostly loaded.)
 */
function renderPageInBrowser() {
  debiki2.ReactStore.initialize();
  const _2dLayout = chooseInitialLayout() === 'TreeLayout';
  if (_2dLayout) {
    debiki2.utils.onMouseDetected(debiki2.Server.load2dScriptsBundleStart2dStuff);
  }

  // Later, when having tested for a bit, use 'hydrate' by default.
  // ReactDOM.hydrate() reuses server generated html, whereas render() ignores it, rerenders everything.
  let reactRenderMethod: 'render' | 'hydrate' = 'render';

  // @ifdef DEBUG
  reactRenderMethod = 'hydrate';
  let isServerHtmlStale = false;
  let htmlBefore;
  let htmlAfter;
  // @endif

  console.log("Cached html version: <" + eds.cachedVersion +
      ">, current: <" + eds.currentVersion + "> [TyMPAGEVER]");

  const store: Store = debiki2.ReactStore.allData();
  if (store.currentPage && store.currentPage.pageRole === PageRole.Forum) {
    // Maybe there's a topic list offset, or non-default different sort order, so we cannot
    // reuse the html from the server. [7TMW4ZJ5]
    reactRenderMethod = 'render';
  }
  else if (location.pathname.search('/-/') === 0) {
    // This isn't rendered server side, so there's no html to reuse.
    reactRenderMethod = 'render';
  }
  else if (eds.currentVersion.split('|')[1] !== eds.cachedVersion.split('|')[1]) {
    console.log("Cached React store json and html is stale. I will rerender. [TyMRERENDER]");
    reactRenderMethod = 'render';
    // @ifdef DEBUG
    isServerHtmlStale = true;
    htmlBefore = document.getElementById('dwPosts').innerHTML;
    // @endif
  }

  if (location.search.indexOf('&hydrate=false') >= 0) {
    console.log("Will use ReactDOM.render, because '&hydrate=false'. [TyMFORCRNDR]");
    reactRenderMethod = 'render';
  }

  if (location.search.indexOf('&hydrate=true') >= 0) {
    console.log("Will use ReactDOM.hydrate, because '&hydrate=true'. [TyMFORCHYDR]");
    reactRenderMethod = 'hydrate';
  }

  const timeBefore = performance.now();

  debiki2.startMainReactRoot(reactRenderMethod);

  const timeAfterPageContent = performance.now();

  // @ifdef DEBUG
  if (isServerHtmlStale) {
    htmlAfter = document.getElementById('dwPosts').innerHTML;
    (<any> window).isServerHtmlStale = true;
    (<any> window).htmlFromServer = htmlBefore;
    (<any> window).htmlAfterReact = htmlAfter;
    console.log("*** React store checksum mismatch. *** Compare window.htmlFromServer " +
        "with htmlAfterReact to find out what the problem (if any) maybe is.")
  }
  // @endif

  const posts = debiki2.$bySelector(allPostsNotTitleSelector);
  const numPosts = posts.length;
  const timeBeforeTimeAgo = performance.now();
  // Only process the header right now if there are many posts.
  debiki2.processTimeAgo(numPosts > 20 ? '.dw-ar-p-hd' : '');
  const timeAfterTimeAgo = performance.now();

  debiki2.ReactStore.activateVolatileData();
  const timeAfterUserData = performance.now();

  // Skip sidebars, when (rendering as if we were) inside an iframe — they'd become sidebars
  // inside the iframe, which would look weird, + the watchbar doesn't make sense;
  // it'd try to navigate inside the iframe.
  let timeAfterRemainingRoots = NaN;
  if (!store.isEmbedded) {
    debiki2.createSidebar();
    debiki2.watchbar.createWatchbar();
    timeAfterRemainingRoots = performance.now();
  }

  console.log(`Millis to ReactDOM.${reactRenderMethod} page: ${timeAfterPageContent - timeBefore}` +
    ", time-ago: " + (timeAfterTimeAgo - timeBeforeTimeAgo) +
    ", user data: " + (timeAfterUserData - timeAfterTimeAgo) +
    ", remaining roots: " + (timeAfterRemainingRoots - timeAfterUserData) + " [TyMRNDRPERF]");

  document.documentElement.classList.add(ReactStartedClass);

  debiki2.page.activateLikeButtons(debiki2.ReactStore.allData().settings);

  setTimeout(runNextStep, 60);


  const steps = [];

  steps.push(function() {
    registerEventHandlersFireLoginOut();
    debiki2.utils.startDetectingMouse();
    debiki2.ReactActions.loadAndScrollToAnyUrlAnchorPost();
  });

  steps.push(function() {
    debiki2.form.activateAnyCustomForm();
    debiki2.page.Hacks.reactRouterLinkifyTopHeaderLinks();
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


d.i.renderPageInBrowser = function() {
  Bliss.ready().then(renderPageInBrowser);
};


// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list

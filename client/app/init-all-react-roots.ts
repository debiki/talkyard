/*
 * Copyright (c) 2014, 2017 Kaj Magnus Lindberg
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

/// <reference path="widgets.ts" />
/// <reference path="sidebar/sidebar.ts" />
/// <reference path="watchbar/watchbar.ts" />
/// <reference path="page/metabar.ts" />
/// <reference path="page/hacks.ts" />
/// <reference path="react-elements/name-login-btns.ts" />
/// <reference path="more-bundle-already-loaded.d.ts" />
/// <reference path="staff-bundle-already-loaded.d.ts" />

//------------------------------------------------------------------------------
   namespace debiki2 {
//------------------------------------------------------------------------------

// REFACTOR rename this file to render-page-in-browser.ts? and combine with start-page.ts? [7VUBWR45]


export function startRemainingReactRoots() {
  if (eds.isInEmbeddedCommentsIframe) {
    // Skip sidebars, when inside an iframe — they'd become sidebars inside the iframe, which
    // would look weird, + the watchbar doesn't make sense, would try to navigate inside the iframe.
  }
  else {
    const topbarElem = document.getElementById('theTopbar');
    if (topbarElem)
      ReactDOM.render(
          topbar.TopBar({}), topbarElem);

    createSidebar();
    watchbar.createWatchbar();
  }
}


export function startMainReactRoot(reactRenderMethodName: 'render' | 'hydrate') {
  // /-/admin/*
  // app/views/adminPage.scala.html
  // <div id="esPageColumn">
  // <div id="esPageScrollable">
  // <div id="@appId"></div>   and appId = "dw-react-admin-app"
  const adminAppElem = document.getElementById('dw-react-admin-app');
  if (adminAppElem) {
    ReactDOM.render(
        Router({}, admin.routes()), adminAppElem);
    return;
  }

  // /-/superadmin/*clientRoute
  // adminPage.scala.html, appId = "theSuperAdminApp"
  const superAdminAppElem = document.getElementById('theSuperAdminApp');
  if (superAdminAppElem) {
    ReactDOM.render(
        Router({}, superadmin.routes()), superAdminAppElem);
    return;
  }

  // /-/tags/*
  // adminPage.scala.html, appId = "theTagsApp"
  const tagsAppElem = document.getElementById('theTagsApp');
  if (tagsAppElem) {
    ReactDOM.render(
        Router({}, tags.routes()), tagsAppElem);
    return;
  }

  // / (server root) if not created
  // app/views/specialpages/createSomethingHerePage.scala.html
  // <div class="container">
  // <div id="dw-non-existing-page">
  const nonExistingPageElem = document.getElementById('dw-non-existing-page');
  if (nonExistingPageElem) {
    $h.addClasses(document.documentElement, 's_NoPage');
    ReactDOM.render(
        nopage.NonExistingPage({}), nonExistingPageElem);
    return;
  }

  // /-/create-site(/website | /embedded-comments)
  // /-/create-test-site
  // app/views/createsite/createSitePage.scala.html
  // <div class="container" style="padding:30px 0 40px">
  // @if(isTest) {
  //   <div class="esTestSiteWarning alert-warning icon-warning">
  //       You're creating a test site, it will be <b>deleted</b> later
  //   </div>
  // }
  // <div id="dw-react-create-site"></div>
  const createSiteElem = document.getElementById('dw-react-create-site');
  if (createSiteElem) {
    ReactDOM.render(
        Router({}, createsite.routes()), createSiteElem);
    return;
  }

  // The rest below is for the main React app: the forum topic list, topic pages, user profile
  // pages, the search page.

  const pageElem = document.getElementById('dwPosts');

  const renderOrHydrate = ReactDOM[reactRenderMethodName];

  if (location.pathname === '/-/embedded-comments') {
    // No router needed; cannot jump between topics in the emb comments iframe. [1FBZQ4]
    // Topbar and scroll buttons also not needed.
    renderOrHydrate(PageWithState(), pageElem);
  }
  else {
    // Compare with [2FKB5P].

    const isEmbCmts: boolean = eds.isInEmbeddedCommentsIframe;  // [EMBLINKSOK] always false?

    // A route for about-user pages and the staff area.
    const sectionsAndPages = [
      // If starting on one of the routes that need more-bundle.js, that bundle is
      // included directly in a <script> tag. Good for performance? [5WKE24]
      Route({ path: '/-/', component: MoreScriptsRoutesComponent })];

    // Routes for the forum, or maybe many forums (if there're different sub communities).
    const store: Store = ReactStore.allData();
    for (let i = 0; i < store.siteSections.length; ++i) {
      const section: SiteSection = store.siteSections[i];
      if (section.pageRole === PageRole.Forum) {
        const forumRootSlash = section.path;
        const forumDefaultPath = forumRootSlash + (store.settings.forumMainView || RoutePathLatest);

        // This redirects e.g. '/forum/' and '/forum' to '/forum/latest':
        sectionsAndPages.push(Redirect({ path: forumRootSlash, to: forumDefaultPath, exact: true }));

        const fc = forum.ForumComponent;
        sectionsAndPages.push(Route({ path: forumRootSlash + RoutePathLatest, component: fc }));
        sectionsAndPages.push(Route({ path: forumRootSlash + RoutePathNew, component: fc }));
        sectionsAndPages.push(Route({ path: forumRootSlash + RoutePathTop, component: fc }));
        sectionsAndPages.push(Route({ path: forumRootSlash + RoutePathCategories, component: fc }));
      }
      // else ?? — currently cannot happen.
    }

    // Routes for single pages, e.g. chat channels or discussion topics.
    sectionsAndPages.push(Route({ path: '/', component: PageWithStateComponent }));

    // Sync with server side rendering code [7UKTWR].
    renderOrHydrate(
        Router({},
          rFragment({},
            Route({ render: debiki2.topbar.TopBar }),
            isEmbCmts ? null : debiki2.page.ScrollButtons(),
            isEmbCmts ? null : Route({ component: debiki2.page.Hacks.ExtReactRootNavComponent }),
            Switch({ children: sectionsAndPages }))),
      pageElem);
  }
}


const MoreScriptsRoutesComponent = createReactClass(<any> {  // dupl code [4WKBTP0]
  displayName: 'MoreScriptsRoutesComponent',

  componentWillMount: function() {
    Server.loadMoreScriptsBundle(() => {
      if (this.isGone) return;
      ReactActions.showNewPage(makeAutoPage(), [], [], null, this.props.history);
      this.setState({ moreScriptsLoaded: true });
    });
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  render: function() {
    if (!this.state)
      return r.p({}, "Loading...");

    return Switch({},
      users.usersRoute(),
      search.searchRoute());
  }
});


export function createSidebar() {
  const sidebarElem = document.getElementById('dw-any-sidebar');
  if (sidebarElem)
    sidebar.createContextbar(sidebarElem);
}


export function removeSidebar() {
  ReactDOM.unmountComponentAtNode(document.getElementById('dw-any-sidebar'));
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list

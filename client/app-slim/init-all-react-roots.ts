/*
 * Copyright (c) 2014-2018 Kaj Magnus Lindberg
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
/// <reference path="../app-more/more-bundle-already-loaded.d.ts" />
/// <reference path="../app-staff/staff-bundle-already-loaded.d.ts" />

//------------------------------------------------------------------------------
   namespace debiki2 {
//------------------------------------------------------------------------------

// REFACTOR rename this file to render-page-in-browser.ts? and combine with start-page.ts? [7VUBWR45]


export function startMainReactRoot(reactRenderMethodName: 'render' | 'hydrate'
        ): U | 'SkipTheRest' {
  // /-/admin/ *
  // app/views/adminPage.scala.html
  // <div id="esPageColumn">
  // <div id="esPageScrollable">
  // <div id="@appId"></div>   and appId = "dw-react-admin-app"
  const adminAppElem = document.getElementById('dw-react-admin-app');
  if (adminAppElem) {
    ReactDOM.render(
        Router({},
          rFr({},
            // (The admin app already includes the topbar.)
            admin.staffRoutes(),
            // Make LinkButton work also in the admin app:
            Route({ component: debiki2.page.Hacks.ExtReactRootNavComponent }),
            )),
      adminAppElem);
    return;
  }

  // /-/superadmin/ *clientRoute
  // adminPage.scala.html, appId = "theSuperAdminApp"
  const superAdminAppElem = document.getElementById('theSuperAdminApp');
  if (superAdminAppElem) {
    ReactDOM.render(
        Router({}, superadmin.routes()), superAdminAppElem);
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

  // Any place to place a rendered page?
  const pageElem = document.getElementById('dwPosts');

  // ... If none, we're in a login popup (always?). Then, don't run any of the
  // normal page subsequent steps.
  // ((In fact, if continuing in renderPageInBrowser() (the only caller), then,
  // activateVolatileData() wouldn't work: the login popup contents would disappear.
  // There is no volatile data in the login popups. — Previously, this function
  // "exited" because of a React no-elem error when pageElem was null, but by
  // returning here, we can avoid a harmless error log message. A bit hacky? Oh well.))
  if (!pageElem)
    return 'SkipTheRest';

  // The rest below is for the main React app: the forum topic list, topic pages, user profile
  // pages, the search page.

  const renderOrHydrate = ReactDOM[reactRenderMethodName];

  const store: Store = ReactStore.allData();

  // So we'll reuse the server's width and layout setting.  [1st_rndr_hydr]
  // (Set to true also if isn't)
  store.isHydrating = true;

  if (location.pathname === '/-/embedded-comments') {
    // No router needed; cannot jump between topics in the emb comments iframe. [1FBZQ4]
    // Topbar and scroll buttons also not needed.
    renderOrHydrate(PageWithState(), pageElem);
  }
  else {
    // Compare with [2FKB5P].

    // (Currently always false, however maybe start using, if adding options for hiding
    // nav buttons, if in emb forum iframe?)
    const isEmbCmts: boolean = eds.isInEmbeddedCommentsIframe;
    // @ifdef DEBUG
    //dieIf(isEmbCmts, 'TyE2RKBP3');
    // @endif

    // A route for about-user pages and the staff area.
    const sectionsAndPages = [
      // If starting on one of the routes that need more-bundle.js, that bundle is
      // included directly in a <script> tag. Good for performance? [5WKE24]
      Route({ path: ApiUrlPathPrefix, component: MoreScriptsRoutesComponent })];

    // Routes for the forum, or maybe many forums (if there're different sub communities).
    for (let i = 0; i < store.siteSections.length; ++i) {
      const section: SiteSection = store.siteSections[i];
      if (section.pageRole === PageRole.Forum) {
        // Dupl lines. [what_rootPathView]
        const forumRootSlash = section.path;
        const forumDefaultPath = forumRootSlash + (store.settings.forumMainView || RoutePathLatest);

        // This redirects e.g. '/forum/' and '/forum' to '/forum/latest':
        sectionsAndPages.push(RedirPath({ path: forumRootSlash, to: forumDefaultPath, exact: true }));

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
          rFr({},
            Route({ render: debiki2.topbar.TopBar }),
            Switch({ children: sectionsAndPages })),
            isEmbCmts ? null : debiki2.page.ScrollButtons(),
            isEmbCmts ? null : Route({
                  component: debiki2.page.Hacks.ExtReactRootNavComponent }),
            ),
      pageElem);
  }

  store.isHydrating = false;
}


/// User and group profile pages, and search resutls page,
/// edit tags, list tags pages.
///
const MoreScriptsRoutesComponent = createReactClass(<any> {  // dupl code [4WKBTP0]
  displayName: 'MoreScriptsRoutesComponent',

  UNSAFE_componentWillMount: function() {
    Server.loadMoreScriptsBundle(() => {
      if (this.isGone) return;
      ReactActions.showNewPage({
        newPage: makeAutoPage(),
        pubCats: [],
        pats: [],
        me: null,
        tagTypesById: {},
        history: this.props.history,
      });
      this.setState({ moreScriptsLoaded: true });
    });
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  render: function() {
    if (!this.state)
      return r.h1({}, t.Loading + ' ...');

    return Switch({},
      Route({ path: UrlPaths.Tags, component: tags.TagsAppComponent }),
      Route({ path: UsersRoot, component: users.UsersHomeComponent }),
      Route({ path: GroupsRoot, component: users.UsersHomeComponent }),
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

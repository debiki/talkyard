/*
 * Copyright (c) 2014-2016 Kaj Magnus Lindberg
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

/// <reference path="../prelude.ts" />
/// <reference path="../utils/utils.ts" />
/// <reference path="../utils/react-utils.ts" />
/// <reference path="../help/help.ts" />
/// <reference path="../help/serverAnnouncements.ts" />
/// <reference path="../rules.ts" />
/// <reference path="discussion.ts" />
/// <reference path="chat.ts" />
/// <reference path="scroll-buttons.ts" />

// Wrapping in a module causes an ArrayIndexOutOfBoundsException: null error, see:
//  http://stackoverflow.com/questions/26189940/java-8-nashorn-arrayindexoutofboundsexception
// The bug has supposedly been fixed in Java 8u40. Once I'm using that version,
// remove `var exports = {};` from app/debiki/Nashorn.  CLEAN_UP do this. Or done already?
//------------------------------------------------------------------------------
   namespace debiki2 {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;

// UX COULD reset if logs out.
const scrollXyByPageId = {};

function rememberScrollPosition(pageId: PageId) {
  const pageCol = $byId('esPageColumn');
  scrollXyByPageId[pageId] = [pageCol.scrollLeft, pageCol.scrollTop];
}

// UX BUG SHOULD the first time for each new page, scroll to the last read post, ...
// (i.e. ReadingProgress.lastViewedPostNr in model.ts)
function scrollToLastPosition(pageId: PageId) {
  const xy = scrollXyByPageId[pageId] || [0, 0];   // ... instead of always 0,0 first
  const pageCol = $byId('esPageColumn');
  pageCol.scrollLeft = xy[0];
  pageCol.scrollTop = xy[1];
}


interface PageWithStateComponentState {
  store: Store

  // What does isMaybePrevPage mean? Let's say we're in the forum. Then we click a link
  // to /some-page. The URL will update immediately to /some-page, and React will activate
  // the route to that page, i.e. this component, PageWithStateComponent.
  // And we'll run this code — but we haven't yet loaded the new page. The current page
  // is still the forum page. We'd render the forum, as a normal page, instead of as a topic list.
  // That'd result in "a flash of the forum rendered incorrectly" and doesn't look nice.
  // Instead, until we've loaded the new page, render nothing.
  isMaybePrevPage?: Bo
}


export const PageWithStateComponent = createReactClass(<any> {
  displayName: 'PageWithStateComponent',
  mixins: [debiki2.StoreListenerMixin],

  getInitialState: function() {
    const state = this.makeState();
    this.scrollPageId = state.store.currentPageId;
    return state;
  },


  onChange: function() {
    this.setState(this.makeState());
  },


  makeState: function() {
    // @ifdef DEBUG
    logD(`PageWithStateComponent.makeState`);
    // @endif
    const store: Store = ReactStore.allData();
    const isMaybePrevPage = this._isMaybePrevPage(this.props.location, store);
    return { store, isMaybePrevPage } satisfies PageWithStateComponentState;
  },


  // When going to a new page, the url is updated before the page has been loaded. This
  // fn says if the `store.currentPage` is in fact the page we were showing at the *previous*
  // url path — then it's too soon to render the new url path (we'd show the wrong page,
  // possibly of a different type e.g. trying to render a forum index page
  // as a discussion page).
  //
  _isMaybePrevPage: function(location, store: Store): Bo | U {

    // Is undef if on an embedded comments page (then, no router).
    if (!location)
      return undefined;

    const curPage: Page = store.currentPage;
    const curPagePath: St = curPage.pagePath.value;
    let isMaybePrevPage = location.pathname !== curPagePath;

    // We can get to here, if curPage is a *deleted* site section page  [subcomms]
    // (e.g. a deleted forum) — because then it wouldn't be included in
    // store.siteSections (since deleted), instead it'd be handled as an
    // ordinary page. However there might be a url path suffix like RoutePathLatest
    // or RoutePathNew, and then it'd seem as if curPage didn't match the current URL,
    // and we'd show just a blank page — instead of a deleted page.
    // Which can be confusing. Instead, show the deleted page.
    const isSectionPage = isSection(curPage);
    if (isSectionPage && location.pathname.startsWith(curPagePath)) {
      // (Maybe check if curPagePath + RoutePathLatest or RoutePathNew etc
      // becomes pathname?)
      isMaybePrevPage = false;
    }

    // @ifdef DEBUG
    logD(`PageWithStateComponent._isMaybePrevPage  props.location.pathname=${location.pathname
            } & store.currentPage.pagePath=${store.currentPage.pagePath.value
            }  —> isMaybePrevPage=${isMaybePrevPage}`);
    // @endif

    return isMaybePrevPage;
  },


  componentDidMount: function() {
    const state: PageWithStateComponentState = this.state;
    const store: Store = state.store;
    ReactActions.maybeLoadAndShowNewPage(store, this.props.history, this.props.location);
    if (!state.isMaybePrevPage) {
      scrollToLastPosition(store.currentPageId);
    }
  },


  UNSAFE_componentWillReceiveProps: function(nextProps) {
    const location = this.props.location;
    if (!location)
      return;

    // If we're about to show another page, remember the current page's scroll offset.
    const state: PageWithStateComponentState = this.state;
    const store: Store = state.store;
    const nextUrlPath = nextProps.location.pathname;
    if (nextUrlPath !== location.pathname && !urlPath_isToPageId(nextUrlPath, store.currentPageId)) {
      rememberScrollPosition(store.currentPageId);
    }

    // @ifdef DEBUG
    logD(`PageWithStateComponent.UNSAFE_componentWillReceiveProps  props.location.pathname=${
            location.pathname
            }  state.store.currentPage.pagePath.value=${store.currentPage.pagePath.value
            }  state.isMaybePrevPage=${state.isMaybePrevPage
            }  nextProps.location.pathname=${nextProps.location.pathname}
        calling ReactActions.maybeLoadAndShowNewPage ...`);
    // @endif

    ReactActions.maybeLoadAndShowNewPage(store, this.props.history, location, nextProps.location);

    // @ifdef DEBUG
    logD(`... ReactActions.maybeLoadAndShowNewPage done.`);
    // @endif
  },


  /* Never called. Needs to be static, but this is not a class.
   * Using componentDidUpdate() just below, instead.
  getDerivedStateFromProps: function(props, state) {
    logD(`PageWithStateComponent.getDerivedStateFromProps`);
    const isMaybePrevPage = this._isMaybePrevPage(props.location, state.store);
    return { isMaybePrevPage };
  }, */


  componentDidUpdate: function(oldProps, oldState) {
    const state: PageWithStateComponentState = this.state;
    // @ifdef DEBUG
    logD(`PageWithStateComponent.componentDidUpdate  props.location.pathname=${
        this.props.location?.pathname
        }  state.store.currentPage.pagePath.value=${state.store.currentPage.pagePath.value
        }  state.isMaybePrevPage=${state.isMaybePrevPage}`);
    // @endif

    // Have we loaded the new page, so store.currentPage is the page for the new url path?
    const isMaybePrevPage = this._isMaybePrevPage(this.props.location, state.store);
    if (state.isMaybePrevPage && isMaybePrevPage === false) {
      // Now `store.currentPage` matches the current url path.
      // @ifdef DEBUG
      logD(`PageWithStateComponent.componentDidUpdate setState({ isMaybePrevPage: false })`);
      // @endif
      this.setState({ isMaybePrevPage: false });

      // Wait until the page has been rendered, before updating the scroll position.
      // (Otherwise the page might be too short; the scroll position would be truncated.)
      return;
    }

    // Update scroll position, but just once after a navigation.
    const store: Store = state.store;
    if (this.scrollPageId !== store.currentPageId && !state.isMaybePrevPage) {
      this.scrollPageId = store.currentPageId;
      const hash = location.hash;
      // Magic hash params start with &, like &param=value or &debug. [2FG6MJ9]
      const anyAndIndex = hash.indexOf('&');
      const isScrollTarget = hash && anyAndIndex !== 1;  // '#' is at 0 so '#&...' = index 1
      if (isScrollTarget) {
        // Then scroll to the scroll target, probably #post-123, instead of to the last position.
      }
      else {
        // Apparently some re-layout is still happening, so don't scroll until after that's been done.
        // For example, inserting YouTube videos might take a while, for the browser? and afterwards
        // it modifies the scroll offset to compensate for the size of the video? which results in
        // the wrong scroll offset.
        // Try three times, once immediately, so looks good. And once, quickly, hopefully will work.
        // And once, even slower, works always, so far.
        // BUG UX SHOULD make this work with just 1 scroll call, and immediately. Can do that (?)
        // by remembering the page size, and forcing that min-height directly when switching page.
        // So the total page size won't change, just because the browser inserts stuff it
        // lazy-loads / lazy-inserts-sizes, like the above-mentioned videos ??
        function updateScroll() { scrollToLastPosition(store.currentPageId); }
        setTimeout(updateScroll);
        setTimeout(updateScroll, 50);
        setTimeout(updateScroll, 300);
      }
    }
  },


  componentWillUnmount: function() {
    // @ifdef DEBUG
    logD(`PageWithStateComponent.componentWillUnmount`);
    // @endif
    // Close any [scroll locally on the current page] scroll dialog the user might
    // have opened — we're leaving the current page.
    page.closeAnyScrollButtons();
  },


  render: function() {
    const state: PageWithStateComponentState = this.state;
    // @ifdef DEBUG
    logD(`PageWithStateComponent.render  isMaybePrevPage=${state.isMaybePrevPage}`);
    // @endif

    // 1. If `store.currentPage` is still from the previous url path, don't render
    // anything yet — we'd render the wrong (previous) page using React components
    // for the new url, which might look funny (e.g. trying to render a topic list
    // as a discussion page with comments).
    // 2. About ...this.props: That sends router props to the new page.
    return state.isMaybePrevPage ? null : Page({ store: state.store, ...this.props });
  }
});


export const PageWithState = reactCreateFactory(<any> PageWithStateComponent);



const Page = createComponent({
  displayName: 'Page',

  getInitialState: function() {
    return {
      useWideLayout: this.isPageWide(),
    };
  },

  componentDidMount: function() {
    // A tiny bit dupl code though, perhaps break out... what? a mixin? [5KFEWR7]
    this.timerHandle = setInterval(this.checkSizeChangeLayout, 500);
  },

  componentWillUnmount: function() {
    this.isGone = true;
    clearInterval(this.timerHandle);
  },

  checkSizeChangeLayout: function() {
    // Dupl code [5KFEWR7]
    if (this.isGone) return;
    const isWide = this.isPageWide();
    if (isWide !== this.state.useWideLayout) {
      this.setState({ useWideLayout: isWide });
    }
  },

  isPageWide: function(): boolean {
    const store: Store = this.props.store;
    return store_getApproxPageWidth(store) > UseWidePageLayoutMinWidth;
  },

  render: function() {
    const store: Store = this.props.store;
    const page: Page = store.currentPage;
    const content = page_isChat(page.pageRole)
        ? debiki2.page.ChatMessages({ store: store })
        : debiki2.page.TitleBodyComments({ store: store });
    const compactClass = this.state.useWideLayout ? '' : ' esPage-Compact'; // BUG React rendering: Was missing server side, present in browser
    const pageTypeClass = ' s_PT-' + page.pageRole;  // REFACTOR place here: [5J7KTW2] instead
    const isChat = page_isChat(page.pageRole);
    // @ifdef DEBUG
    logD(`Page.render  page id: ${page.pageId}`);
    // @endif

    return rFragment({},
      isChat ? r.div({ id: 'theChatVspace' }) : null,
      r.div({ className: 'esPage' + compactClass + pageTypeClass },
        r.div({ className: 'container' },
          debiki2.help.getServerAnnouncements(store),
          r.article({},
            content))));
  }
});


// REFACTOR break out to new file render-page-server-side.ts? [7VUBWR45]
export function renderPageServerSideToString() {
  debiki2.avatar.resetAvatars();

  // Comment in the next line to skip React server side and debug in browser only.
  //return '<p class="dw-page" data-reactid=".123" data-react-checksum="123">react_skipped [BRWSRDBG]</p>'

  // Compare with [2FKB5P].
  const store: Store = debiki2.ReactStore.allData();
  const page: Page = store.currentPage;
  if (page.pageRole === PageRole.Forum) {
    const defaultPath = page.pagePath.value + (store.settings.forumMainView || RoutePathLatest);
    // Otherwise rendering the categories dropdown button results in a null error:
    store.currentCategories = store.publicCategories;
    const forumRoute = Route({ path: defaultPath, component: forum.ForumComponent });
    // In the future, when using the HTML5 history API to update the URL when navigating
    // inside the forum, we can use `store.pagePath` below. But for now:
    const path = page.pagePath.value + 'latest';

    // Sync with client side rendering code [7UKTWR], otherwise React will do mistakes when
    // trying to reuse the server side html, resulting in CSS classes ending up on the wrong
    // elements and a somewhat broken page.
    return ReactDOMServer.renderToString(
        Router({ location: path },
          rFr({},
            Route({ render: debiki2.topbar.TopBar }),
            forumRoute,
            null, // would be ScrollButtons, and its render() returns null initially
            null, // would be ExtReactRootNavComponent, and its render() returns null
            )));
  }
  else if (store.isEmbedded && page.pageRole === PageRole.EmbeddedComments) {
    // Then we don't include any top bar or scroll buttons [1FBZQ4]
    return ReactDOMServer.renderToString(
        Page({ store }));
  }
  else {
    // Sync with client side rendering code. [7UKTWR]
    return ReactDOMServer.renderToString(
        Router({},
          rFr({},
            Route({ render: debiki2.topbar.TopBar }),
            Page({ store }),
            null, // would be ScrollButtons, and its render() returns null initially
            null, // would be ExtReactRootNavComponent, and its render() returns null
            )));
  }
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list

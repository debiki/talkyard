/*
 * Copyright (c) 2015-2021 Kaj Magnus Lindberg
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
/// <reference path="../links.ts" />
/// <reference path="../utils/react-utils.ts" />
/// <reference path="../utils/utils.ts" />
/// <reference path="../utils/window-zoom-resize-mixin.ts" />
/// <reference path="../util/ExplainingDropdown.ts" />
/// <reference path="../Server.ts" />
/// <reference path="../ServerApi.ts" />
/// <reference path="../page/discussion.ts" />
/// <reference path="../page/scroll-buttons.ts" />
/// <reference path="../widgets.ts" />
/// <reference path="../login/login-if-needed.ts" />
/// <reference path="../more-bundle-not-yet-loaded.ts" />
/// <reference path="../editor-bundle-not-yet-loaded.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.forum {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const ModalDropdownButton = utils.ModalDropdownButton;
const ExplainingListItem = util.ExplainingListItem;
const HelpMessageBox = help.HelpMessageBox;

/** Keep in sync with app/controllers/ForumController.NumTopicsToList. */
const NumNewTopicsPerRequest = 40;

const FilterShowAll = 'ShowAll';
const FilterShowWaiting = 'ShowWaiting';
const FilterShowDeleted = 'ShowDeleted';



export const ForumScrollBehavior = {
  updateScrollPosition: function(position, actionType) {
    // Never change scroll position when switching between last/top/categories
    // in the forum. Later on I might find this behavior useful:
    //   https://github.com/rackt/react-router/blob/master/behaviors/ImitateBrowserBehavior.js
    //   https://github.com/rackt/react-router/blob/master/docs/api/components/Route.md#ignorescrollbehavior
    //   https://github.com/rackt/react-router/blob/master/docs/api/create.md#scrollbehavior
    //   https://github.com/rackt/react-router/pull/388
    return;
  }
};


let lastScrollYByPath = {};
let scrollToWhenCommentsLoaded;

function scrollToLastPositionSoon() {
  const resetTo = scrollToWhenCommentsLoaded || 0;
  scrollToWhenCommentsLoaded = 0;
  function resetScroll() {
    $byId('esPageColumn').scrollTop = resetTo;
  }
  // If doesn't wait some millis before resetting scroll, then, maybe 1 in 5 times, the browser
  // somehow scrolls to scrollTop = 0 = page top (it does even *before* a 0ms timeout). TyT5WG7AB02
  // The browser still does — so reset twice: Once soon, looks better. And once more just in case.
  setTimeout(resetScroll, 40);
  setTimeout(resetScroll, 160);
}



interface ForumComponentProps extends ReactRouterProps {
}


interface ForumComponentState {
  store: Store;
  topicsInStoreMightBeOld: Bo;
  // Or combine these two into a WinWidth enum? [5KFEWR7]
  // { Watch, MobilePortrait, MobileLandscapeOrTabletPortrait,
  //   TabletLandscapeOrLaptopSmall, LaptopMediumOrDesktopSmall, DesktopMedium,
  //   WideScreen }
  useWideLayout: Bo;
  useNarrowLayout: Bo
  explSetSortOrder?: St;
  topPeriod: TopTopicsPeriod;
}


export const ForumComponent = createReactClass(<any> {
  displayName: 'ForumComponent',
  mixins: [StoreListenerMixin, utils.PageScrollMixin],

  getInitialState: function() {
    const store: Store = ReactStore.allData();
    const [useNarrowLayout, useWideLayout] = this.isPageNarrowWide(store);
    return {
      store,
      topicsInStoreMightBeOld: false,
      useNarrowLayout,
      useWideLayout,
      topPeriod: TopTopicsPeriod.Month,
    }
  },

  onChange: function() {
    this.setState({
      store: ReactStore.allData(),
      // Now some time has passed since this page was loaded, so:
      topicsInStoreMightBeOld: true,
    });
  },

  componentDidMount: function() {
    const props: ForumComponentProps = this.props;
    const state: ForumComponentState = this.state;
    ReactActions.maybeLoadAndShowNewPage(state.store, props.history, props.location);
    scrollToWhenCommentsLoaded = lastScrollYByPath[props.location.pathname] || 0;
    lastScrollYByPath = {};
    // Dupl code [5KFEWR7]
    this.timerHandle = setInterval(this.checkSizeChangeLayout, 500);
  },

  componentWillUnmount: function() {
    this.isGone = true;
    clearInterval(this.timerHandle);
  },

  onScroll: function() {
    // Remember scroll only for the current sort order, otherwise, if there's a scroll position
    // remembered for each possible combination of categories and sort orders, the user will get
    // confused, because hen won't remember that stuff, henself, and wonder "why not starts at top?".
    const props: ForumComponentProps = this.props;
    lastScrollYByPath = {};
    lastScrollYByPath[props.location.pathname] = $byId('esPageColumn').scrollTop;
  },

  checkSizeChangeLayout: function() {
    const state: ForumComponentState = this.state;
    // Dupl code [5KFEWR7]
    if (this.isGone) return;
    const [useNarrowLayout, useWideLayout] = this.isPageNarrowWide();
    if (useNarrowLayout !== state.useNarrowLayout ||
          useWideLayout !== state.useWideLayout) {
      this.setState({ useNarrowLayout, useWideLayout } as ForumComponentState);
    }
  },

  isPageNarrowWide: function(store?: Store): [Bo, Bo] {
    const state: ForumComponentState = this.state;
    const width = store_getApproxPageWidth(store || state.store);
    return [width <= UseNarrowForumLayoutMaxWidth, UseWideForumLayoutMinWidth <= width];
  },

  setTopPeriod: function(topPeriod: TopTopicsPeriod) {
    this.setState({ topPeriod });
  },


  setSortOrder: function (sortOrder: St, remember: Bo, slashSlug: St): Vo {
    const props: ForumComponentProps = this.props;
    const state: ForumComponentState = this.state;

    const explSetSortOrder = remember &&
            // If it's the same, then we're toggling off the explicitly set sort order.
            sortOrder !== state.explSetSortOrder ? sortOrder : null;
    const newState: Partial<ForumComponentState> = { explSetSortOrder };
    this.setState(newState);

    const [forumPath, routes]: [St, St[]] = this.getForumPathAndRoutes();
    // @ifdef DEBUG
    const currentSlug: St = routes[1] || '';
    if (slashSlug && currentSlug) {
      dieIf('/' + currentSlug !== slashSlug, 'TyE603MSEJ5');
    }
    // @endif

    props.history.push({
      pathname: forumPath + sortOrder + slashSlug,
      search: props.location.search,
    });
  },


  getActiveCategory: function(currentCategorySlug: St): Cat | U {
    const state: ForumComponentState = this.state;
    const store: Store = state.store;
    const forumPage: Page = store.currentPage;
    let activeCategory: Cat | U;
    const activeCategorySlug = currentCategorySlug;
    if (activeCategorySlug) {
      activeCategory = _.find(store.currentCategories, (category: Category) => {
        return category.slug === activeCategorySlug;
      });
      // If `activeCategory` is null here, that's probably because the category is
      // included in user specific data that hasn't been activated yet. (6KEWM02)
    }
    else {
      activeCategory = {
        name: t.fb.AllCats,
        id: forumPage.categoryId, // the forum root category
        isForumItself: true,
        newTopicTypes: [],
        slug: '',
        description: '',
        // Whatever: (cannot create topics in this cat anyway)
        defaultTopicType: PageRole.Discussion,
      };
    }
    return activeCategory;
  },

  setCategory: function(newCatSlug?: St, newCat?: Cat) {
    // @ifdef DEBUG
    dieIf(newCatSlug && newCat && newCatSlug !== newCat.slug, 'TyE4MJLC027');
    // @endif
    const state: ForumComponentState = this.state;
    const [forumPath, routes] = this.getForumPathAndRoutes();
    const sortOrderRoute = routes[0];

    let nextPath = sortOrderRoute === RoutePathCategories ?
          RoutePathLatest : state.explSetSortOrder || RoutePathLatest;

    // Do-it votes categories are sorted by popular-first (unless pat has
    // clicked another sort order button).
    if (!state.explSetSortOrder && nextPath !== RoutePathTop &&
            newCat && newCat.doItVotesPopFirst) {
      nextPath = RoutePathTop;
    }

    const slashSlug = newCatSlug ? '/' + newCatSlug : '';
    const props: ForumComponentProps = this.props;
    props.history.push({
      pathname: forumPath + nextPath + slashSlug,  // dupl [.cat_ln]
      search: props.location.search,
    });
  },

  editCategory: function() {
    const [forumPath, routes] = this.getForumPathAndRoutes();
    const currentCategorySlug = routes[1];
    const activeCategory: Cat | U = this.getActiveCategory(currentCategorySlug);
    morebundle.getEditCategoryDialog(dialog => {
      if (this.isGone) return;
      dialog.open(activeCategory.id, (serverResponse: SaveCategoryResponse) => {
        const slugAfter = serverResponse.newCategorySlug;
        if (slugAfter !== currentCategorySlug) {
          this.setCategory(slugAfter);  // [7AFDW01]
        }
      });
    });
  },

  getForumPathAndRoutes: function(): [string, string[]] {
    const props: ForumComponentProps = this.props;
    const state: ForumComponentState = this.state;
    const store: Store = state.store;
    const page: Page = store.currentPage;
    const forumPath = page.pagePath.value;
    // This is done this way because of how React-Router v3 was working. It was simpler
    // do do this than to totally-rewrite. Maybe refactor-&-simplify some day?
    // Remove e.g. a '/forum/' prefix to the 'top/ideas' or 'new/bugs' whatever suffix:
    const pathRelForumPage = props.location.pathname.replace(forumPath, '');
    // This becomes e.g. ['new', 'ideas']:
    const routes = pathRelForumPage.split('/');
    return [forumPath, routes];
  },

  render: function() {
    const state: ForumComponentState = this.state;
    const store: Store = state.store;
    const page: Page = store_curPage(store);

    if (page.pageRole !== PageRole.Forum) {
      // We're navigating from a discussion topic to the forum page (= topic list page).
      // The url was just updated to show the addr of the forum page, but we're not yet
      // done updating React's state: `page` is still the discussion topic. Wait
      // until `page` becomes the forum page.
      return r.div({ className: 'container dw-forum' }, t.Loading + ' [TyM2EPKB04]');
    }

    const [forumPath, routes]: [St, St[]] = this.getForumPathAndRoutes();

    const sortOrderRoute: St = routes[0];
    switch (sortOrderRoute) {
      case RoutePathLatest: break;
      case RoutePathNew: break;
      case RoutePathTop: break;
      case RoutePathCategories: break;
      default:
        return r.p({}, `Bad route in the URL: '${sortOrderRoute}' [EdE2WKB4]`);
    }
    const currentCategorySlug = routes[1];
    const activeCategory: Cat | U = this.getActiveCategory(currentCategorySlug);
    const layout: PageLayout = page.pageLayout;

    /* Remove this? Doesn't look nice & makes the categories page look complicated.
    var topsAndCatsHelp = this.props.sortOrderRoute === RoutePathCategories
      ? HelpMessageBox({ message: topicsAndCatsHelpMessage, className: 'esForum_topicsCatsHelp' })
      : null; */

    const linkWapper =
            store_isFeatFlagOn(store, 'ffNav') ? r.nav : (
                store_isFeatFlagOn(store, 'ffAside') ? r.aside : (
                    store_isFeatFlagOn(store, 'ffSection') ? r.section : r.div));

    const rootSlash = forumPath;
    const childRoutes = r.div({},
      Switch({},
        RedirToNoSlash({ path: rootSlash + RoutePathLatest + '/' }),
        RedirToNoSlash({ path: rootSlash + RoutePathNew + '/' }),
        RedirToNoSlash({ path: rootSlash + RoutePathTop + '/' }),
        RedirToNoSlash({ path: rootSlash + RoutePathCategories + '/' }),
        // [React_Router_v51] skip render(), use hooks and useParams instead.
        Route({ path: rootSlash + RoutePathCategories, exact: true, strict: true,
                  render: (routerProps: ReactRouterProps) => {
          const childProps: ForumButtonsProps & LoadAndListCatsProps = {
            store,
            forumPath,
            activeCategory,
            isCategoriesRoute: true,
            sortOrderRoute,
            setSortOrder: this.setSortOrder,
            explSetSortOrder: state.explSetSortOrder,
            queryParams: parseQueryString(routerProps.location.search),
            ...routerProps,
          };
          // Don't use <div> — then DuckDuckGo and Bing can mistake this
          // topic/category list page, from being a contents page, and show it
          // in the search results, instead of the real contents page.
          // MDN: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/nav
          //  >  <nav> element represents a section of a page whose purpose is
          //  >  to provide navigation links
          // And that's what the topic / category list is — providing links
          // to the actual topics / categories.
          //
          // Configurable, for now — just trying with <nav>.
          //
          return linkWapper({},  // or <aside> or <section> ?
            ForumButtons(childProps),
            LoadAndListCategories(childProps));
        }}),
        Route({ path: rootSlash + ':sortOrder?/:categorySlug?', strict: true,
                render: (routerProps: ReactRouterProps) => {
          const childProps: ForumButtonsProps & LoadAndListTopicsProps = { // [.btn_props]
            store,
            forumPath,
            useTable: state.useWideLayout && layout != TopicListLayout.NewsFeed,
            useNarrowLayout: state.useNarrowLayout,
            activeCategory,
            setCategory: this.setCategory,
            editCategory: this.editCategory,
            sortOrderRoute,
            setSortOrder: this.setSortOrder,
            explSetSortOrder: state.explSetSortOrder,
            topPeriod: state.topPeriod,
            setTopPeriod: this.setTopPeriod,
            queryParams: parseQueryString(routerProps.location.search),
            ...routerProps,
          };
          return linkWapper({},
            // Moving the buttons to after the category title — just keeping this,
            // in case anyone complains and wants to improve something somehow.
            !store_isFeatFlagOn(store, 'ffBtnsBefCat') ? null : ForumButtons(childProps),
            LoadAndListTopics(childProps));
        }})));
    /* SHOULD instead of the below, throw? show? some error, if invalid sort order or bad cat name
        Route({ path: rootSlash, component: LoadAndListTopics }),
        Route({ path: rootSlash + RoutePathLatest, component: LoadAndListTopics }),
        Route({ path: rootSlash + RoutePathNew, component: LoadAndListTopics }),
        Route({ path: rootSlash + RoutePathTop, component: LoadAndListTopics })));
        */

    const navConf: BrowserCode = store.settings.navConf || {};

    const searchBox = page.forumSearchBox !== ShowSearchBox.Yes ? null :
            topbar.SearchForm();

    return (
      r.div({ className: 'container dw-forum' },
        debiki2.help.getServerAnnouncements(store),
        debiki2.page.Title({ store }),
        ForumIntroText({ store }),
        searchBox,
        //topsAndCatsHelp,
        childRoutes));
  }
});


/* CLEAN_UP  Remove this old out commented code?  + class .esForum_topicsCatsHelp
const topicsAndCatsHelpMessage = {
  id: 'EsH4YKG81',
  version: 1,
  content: r.span({},
    "A ", r.i({}, r.b({}, "category")), " is a group of topics. " +
    "A ", r.i({}, r.b({}, "topic")), " is a discussion or question."),
}; */


const ForumIntroText = createComponent({
  displayName: 'ForumIntroText',

  render: function() {
    const store: Store = this.props.store;
    const settings: SettingsVisibleClientSide = store.settings;
    const page: Page = store_curPage(store);
    const user: Myself = store.me;
    const introPost = page.postsByNr[BodyNr];
    if (!introPost || introPost.isBodyHidden)
      return null;

    const anyEditIntroBtn = user.isAdmin
        ? r.a({ className: 'esForumIntro_edit icon-edit',
              onClick: morebundle.openEditIntroDialog }, t.fi.Edit)
        : null;

    const anyForumIntroButtons = settings.enableForum === false ? null :
      r.div({ className: 'esForumIntro_btns' },
        anyEditIntroBtn,
        r.a({ className: 'esForumIntro_close', onClick: () => ReactActions.showForumIntro(false) },
          r.span({ className: 'icon-cancel' }, t.fi.Hide_1),  // "Hide ..."
          r.span({ className: 'esForumIntro_close_reopen' },
            t.fi.Hide_2, r.span({ className: 'icon-info-circled dw-forum-intro-show' }), // "click"
              t.fi.Hide_3)));  // "... to reopen"

    return (
        // The intro text is typically self-contained content, a brief summary
        // of the purpose with the forum. — So use the <article> tag.
        r.div({ className: 'esForumIntro' },
          r.article({ dangerouslySetInnerHTML: { __html: introPost.sanitizedHtml }}),
          anyForumIntroButtons));
  }
});



interface ForumButtonsProps {
  store: Store;
  forumPath: St;
  activeCategory?: Cat;
  isCategoriesRoute?: Bo;
  sortOrderRoute: St;
  setSortOrder: (sortOrder: St, remember: Bo, slashSlug: St) => Vo;
  explSetSortOrder?: St;
  useNarrowLayout?: Bo;
  queryParams: { [paramName: string]: St };
  location: ReactRouterLocation;
  history: ReactRouterHistory;
}

interface ForumButtonsState {
  compact: Bo;
}

const wideMinWidth = 801;

const ForumButtons = createComponent({
  displayName: 'ForumButtons',
  mixins: [utils.WindowZoomResizeMixin],

  getInitialState: function() {
    return {
      compact: window.innerWidth < wideMinWidth,
    } as ForumButtonsState;
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  onWindowZoomOrResize: function() {
    const state: ForumButtonsState = this.state;
    const newCompact = window.innerWidth < wideMinWidth;
    if (state.compact !== newCompact) {
      this.setState({ compact: newCompact });
    }
  },

  // Refactor: Move to static fn.
  getSortOrderName: function(sortOrderRoutePath?: string) {
    const props: ForumButtonsProps = this.props;
    if (!sortOrderRoutePath) {
      sortOrderRoutePath = props.sortOrderRoute;
    }
    const store: Store = props.store;
    const showTopicFilter = settings_showFilterButton(store.settings, store.me);
    // If there's no topic filter button, the text "All Topics" won't be visible to the
    // right of the Latest / Top sort order buttons, which makes it hard to understand what
    // Latest / Top means? Therefore, if `!showTopicFilter`, type "Latest topics" instead of
    // just "Latest". (Also, since the filter button is absent, there's more space for this.)
    switch (sortOrderRoutePath) {
      case RoutePathLatest: return t.fb.Active;
      case RoutePathNew: return t.fb.New;
      case RoutePathTop: return t.fb.Top;
      default: return null;
    }
  },

  setTopicFilter: function(entry: ExplainingTitleTextSelected) {
    const props: ForumButtonsProps = this.props;
    const newQuery: any = { ...props.queryParams };
    if (entry.eventKey === FilterShowAll) {
      delete newQuery.filter;
    }
    else {
      newQuery.filter = entry.eventKey;
    }
    props.history.push({
      pathname: props.location.pathname,
      search: stringifyQueryString(newQuery),
    });
  },

  /* If using a filter dropdown + full search text field like GitHub does:
  onActivateFilter: function(event, filterKey: string) {
    this.setState({
      searchFilterKey: filterKey,
      searchText: this.searchTextForFilter(filterKey),
    });
  },

  searchTextForFilter: function(filterKey: string) {
    switch (filterKey) {
      case FilterShowAll: return '';
      case FilterShowWaiting: return 'is:open is:question-or-todo';
      case FilterShowDeleted: ...
    }
  },

  updateSearchText: function(event) {
    this.setState({ searchText: event.target.value });
  }, */

  createCategory: function() {
    morebundle.getEditCategoryDialog(dialog => {
      if (this.isGone) return;
      dialog.open();
    });
  },

  createTopic: function(category: Category) {
    const anyReturnToUrl = window.location.toString().replace(/#/, '__dwHash__');
    login.loginIfNeeded(LoginReason.CreateTopic, anyReturnToUrl, () => {
      if (this.isGone) return;
      const newTopicTypes = category.newTopicTypes || [];
      if (newTopicTypes.length === 0) {
        debiki2.editor.editNewForumPage(category.id, PageRole.Discussion);
      }
      else if (newTopicTypes.length === 1) {
        debiki2.editor.editNewForumPage(category.id, newTopicTypes[0]);
      }
      else {
        // There are many topic types specified for this category, because previously there
        // was a choose-topic-type dialog. But I deleted that dialog; it made people confused.
        // Right now, just default to Discussion instead. Later, change newTopicTypes from
        // a collection to a defaultTopicType field; then this else {} can be deleted. [5YKW294]
        debiki2.editor.editNewForumPage(category.id, PageRole.Discussion);
      }
    }, true);
  },


  render: function() {
    const state: ForumButtonsState = this.state;
    const props: ForumButtonsProps = this.props;
    const store: Store = props.store;
    const settings: SettingsVisibleClientSide = store.settings;
    const me: Myself = store.me;
    const showsCategoryTree: Bo = props.isCategoriesRoute;
    const activeCategory: Cat | U = props.activeCategory;
    // Backw compat, if buttons before cat title & descr ('ffBtnsBefCat').
    if (!activeCategory)
      return CatNotFound(store);

    const queryParams = props.queryParams;
    const showsTopicList = !showsCategoryTree;

    const showFilterButton = settings_showFilterButton(settings, me);
    const topicFilterFirst = true; // CLEAN_UP remove me_uiPrefs(me).fbs !== UiPrefsForumButtons.CategoryDropdownFirst; CLEAN_UP

    // A tester got a little bit confused in the categories view, because it starts with
    // the filter-*topics* button. So insert this title, before, instead.
    const anyPageTitle = showsCategoryTree || (topicFilterFirst && !showFilterButton) ?
        r.div({ className: 'esF_BB_PageTitle' },
          showsCategoryTree ? t.Categories : t.Topics) : null;

    // @ifdef DEBUG
    dieIf(!showsCategoryTree && !props.setSortOrder, 'TyE60MREJ35');
    // @endif

    // The root cat has no slug.
    const anyActCatSlug: St | U = props.activeCategory.slug;
    const slashSlug = anyActCatSlug ? '/' + anyActCatSlug : '';

    const makeCategoryLink = (order: St, rememberSortOrder: Bo, slashSlug: St,
            text: St, linkId: St, extraClass?: St) => {
      const explSelected = props.explSetSortOrder === order ? 'n_ExplSel ' : '';
      return NavLink({
          // The onClick handler will remember that we set the sort order explicitly,
          // so it'll stay, when jumping between categories ...
          onClick: () => props.setSortOrder(order, rememberSortOrder, slashSlug),
          // ... whilst this <a> link let's us middle mouse click to open in new tab.
          to: { pathname: props.forumPath + order + slashSlug,  // dupl [.cat_ln]
                search: props.location.search },
          id: linkId,
          className: 'btn esForum_catsNav_btn ' + explSelected + (extraClass || ''),
          activeClassName: 'active' }, text);
    };

    let omitCategoryStuff = showsCategoryTree || !settings_showCategories(store.settings, me);
    let categoryTreeLink = omitCategoryStuff ? null :
            makeCategoryLink(RoutePathCategories, false, '', t.fb.ViewCategories,
                'e_ViewCatsB', 'esForum_navLink');

    // COULD remember which topics were listed previously and return to that view.
    // Or would a Back btn somewhere be better?
    const topicListLink = showsTopicList ? null :
            makeCategoryLink(RoutePathLatest, false, '', t.fb.TopicList,
                'e2eViewTopicsB', 'esForum_navLink');

    // The Latest/Top/Categories buttons, but use a dropdown if there's not enough space.
    const currentSortOrderPath = props.sortOrderRoute;
    let latestNewTopButton;
    if (showsCategoryTree) {
      // Then hide the sort order buttons.
    }
    else if (state.compact) {
      latestNewTopButton =
          ModalDropdownButton({ className: 'esForum_catsNav_btn esF_BB_SortBtn', pullLeft: true,
            title: rFragment({}, this.getSortOrderName() + ' ', r.span({ className: 'caret' })) },
          r.ul({},
            // Active topics, followed by Popular, are the most useful buttons I think.
            // Mainly staff are interested in new topics? — so place the New button last.
            // Maybe these should be links too? I.e. use makeCategoryLink?
            ExplainingListItem({ onClick: () => props.setSortOrder(RoutePathLatest, true, slashSlug),
                active: currentSortOrderPath === RoutePathLatest,
                title: this.getSortOrderName(RoutePathLatest),
                text: t.fb.ActiveDescr }),
            ExplainingListItem({ onClick: () => props.setSortOrder(RoutePathTop, true, slashSlug),
                active: currentSortOrderPath === RoutePathTop,
                title: this.getSortOrderName(RoutePathTop),
                text: t.fb.TopDescr }),
            ExplainingListItem({ onClick: () => props.setSortOrder(RoutePathNew, true, slashSlug),
              active: currentSortOrderPath === RoutePathNew,
              title: this.getSortOrderName(RoutePathNew),
              text: t.fb.NewDescr })));
    }
    else {
      latestNewTopButton =
          r.ul({ className: 'nav esForum_catsNav_sort' },
            makeCategoryLink(RoutePathLatest, true, slashSlug,
                  this.getSortOrderName(RoutePathLatest), 'e2eSortLatestB'),
            makeCategoryLink(RoutePathTop, true, slashSlug,
                  this.getSortOrderName(RoutePathTop), 'e2eSortTopB'),
            makeCategoryLink(RoutePathNew, true, slashSlug,
                  this.getSortOrderName(RoutePathNew), 'e_SortNewB'));
    }

    // ------ The filter topics select.

    const topicFilterValue = queryParams.filter || FilterShowAll;
    function makeTopicFilterText(filter) {
      switch (filter) {
        case FilterShowAll: return t.fb.AllTopics;
        case FilterShowWaiting: return t.fb.WaitingTopics;
        case FilterShowDeleted: return t.fb.ShowDeleted;
      }
      die('EsE4JK85');
    }

    const showDeletedFilterItem = !isStaff(me) || !showFilterButton ? null :   // [2UFKBJ73]
      ExplainingListItem({ onSelect: this.setTopicFilter, className: 's_F_BB_TF_Dd',
        activeEventKey: topicFilterValue, eventKey: FilterShowDeleted,
        title: makeTopicFilterText(FilterShowDeleted),
        text: t.fb.ShowDeletedDescr });

    const topicFilterButton = !showFilterButton ? null :
      ModalDropdownButton({ className: 'esForum_filterBtn esForum_catsNav_btn', pullLeft: true,
          title: rFragment({},
            makeTopicFilterText(topicFilterValue) + ' ', r.span({ className: 'caret' })) },
        r.ul({},
          ExplainingListItem({ onSelect: this.setTopicFilter, className: 's_F_BB_TF_All',
              activeEventKey: topicFilterValue, eventKey: FilterShowAll,
              title: t.fb.ShowAllTopics,
              text: t.fb.ShowAllTopicsDescr }),
          ExplainingListItem({ onSelect: this.setTopicFilter, className: 's_F_BB_TF_Wait',
              activeEventKey: topicFilterValue, eventKey: FilterShowWaiting,
              title: makeTopicFilterText(FilterShowWaiting),
              text: r.span({},
                t.fb.OnlyWaitingDescr_1,  // "shows only ..."
                r.b({}, r.i({}, t.fb.OnlyWaitingDescr_2)),  // "waiting"
                t.fb.OnlyWaitingDescr_3 ) }), // "for a solution ..."
          showDeletedFilterItem));

    /* A filter dropdown and search box instead of the <select> above:
    var makeFilterItemProps = (key: string) => {
      var props: any = { eventKey: key };
      if (this.state.searchFilterKey === key) {
        props.className = 'dw-active';
      }
      return props;
    }
    var topicsFilterButton =
        DropdownButton({ title: "Filter", onSelect: this.onActivateFilter, id: ... },
          MenuItem(makeFilterItemProps(FilterShowAll), "Show everything"),
          MenuItem(makeFilterItemProps(FilterShowWaiting), "Show waiting"));
    var topicFilter =
        r.div({ className: 'dw-filter' },
          Input({ type: 'text', buttonBefore: topicsFilterButton, value: this.state.searchText,
              onChange: this.updateSearchText,
              // ElasticSearch disabled server side, and is:* not supported anyway.
              disabled: true, title: "Not completely implemented" }));
    */

    // If the All Categories dummy category is active, that's not where new topics
    // get placed. Instead they get placed in a default category. Find out which
    // one that is, so can show the correct create topic button title (depends
    // on the default topic type in the default category).
    const activeOrDefCat: Cat | U =
        activeCategory.isForumItself ?
            store_findTheDefaultCategory(store) : activeCategory;
    // @ifdef DEBUG
    // But this can happen, if the default category is private — then it won't be
    // included in the json from the server. How handle that, UX wise? [TyT0DEFCAT]
    //dieIf(!isServerSide() && !activeOrDefCat,
    //    "No active or default category [TyE0DEFCAT]");
    // @endif

    let createTopicBtn;
    const mayCreateTopics = store_mayICreateTopics(store, activeOrDefCat);
    if (mayCreateTopics && activeOrDefCat) {
      // TESTS_MISSING iff showsCategoryTree.
      createTopicBtn = PrimaryButton({
          onClick: () => this.createTopic(activeOrDefCat), id: 'e2eCreateSth',
          className: 'esF_BB_NewTpcB'},
        createTopicBtnTitle(activeOrDefCat));
    }

    let createCategoryBtn;
    if (showsCategoryTree && me.isAdmin) {
      createCategoryBtn = Button({ onClick: this.createCategory, id: 'e2eCreateCategoryB',
         className: 's_F_BB_NewCatB' },
        t.fb.CreateCat);
    }

    const whatClass = showsCategoryTree ? 's_F_BB-Cats' : 's_F_BB-Topics';

    const filterAndSortButtons = /*topicFilterFirst  CLEAN_UP remove this comment block
        ? r.div({ className: 'esForum_catsNav s_F_BB-Topics_Filter' },
            anyPageTitle,
            topicFilterButton,
            latestNewTopButton,
            categoryTreeLink,
            topicListLink)
        :*/ r.div({ className: 'esForum_catsNav s_F_BB-Topics_Filter' },
            anyPageTitle,
            topicFilterButton,
            latestNewTopButton,
            categoryTreeLink,
            topicListLink);

    return (
        r.div({ className: 'dw-forum-actionbar clearfix ' + whatClass },
          filterAndSortButtons,
          createTopicBtn,
          createCategoryBtn));
  }
});




interface LoadAndListTopicsProps {
  store: Store;
  activeCategory: Cat;
  topicsInStoreMightBeOld?: Bo;
  queryParams: UrlParamsMap;
  sortOrderRoute: St;
  setSortOrder: (sortOrder: St, remember: Bo, slashSlug: St) => Vo;
  explSetSortOrder?: St;
  location: ReactRouterLocation;
  match: ReactRouterMatch;
  //history: ReactRouterHistory; present, but not in use

  forumPath: St;
  useTable: Bo;
  useNarrowLayout: Bo;
  setCategory: (newCatSlug?: St, newCat?: Cat) => Vo;
  editCategory: () => Vo;
  topPeriod: TopTopicsPeriod;
  setTopPeriod: (period: TopTopicsPeriod) => Vo;
}

interface LoadAndListTopicsState {
  topics?: Topic[];
  minHeight?: Nr;
  showLoadMoreButton?: Bo;
}


const LoadAndListTopics = createFactory({
  displayName: 'LoadAndListTopics',
  mixins: [debiki2.StoreListenerMixin],

  getInitialState: function(): any {
    // The server has included in the Flux store a list of the most recent topics, and we
    // can use that lis when rendering the topic list server side, or for the first time
    // in the browser (but not after that, because then new topics might have appeared).
    if (this.canUseTopicsInScriptTag()) {
      const props: LoadAndListTopicsProps = this.props;
      const store: Store = props.store;
      return {
        topics: store.topics,
        showLoadMoreButton: store.topics && store.topics.length >= NumNewTopicsPerRequest
      };
    }
    else {
      return {};
    }
  },

  onChange: function() {
    // REFACTOR should probably use the store, for the topic list, so need not do this.

    if (this.isLoading) {
      // This is a the-store-got-patched change event [2WKB04R]. Ignore it — we'll update
      // in a moment, in the done-loading callback instead (4AB2D).
      // (If we continued here, we'd call scrollToLastPositionSoon() below and might
      // incorrectly reset the scroll position to 0.)
      return;
    }

    this.maybeRunTour();

    if (!this.canUseTopicsInScriptTag())
      return;

    // We're still using a copy of the topics list in the store, so update the copy,
    // maybe new user-specific data has been added.
    const props: LoadAndListTopicsProps = this.props;
    const store: Store = props.store;
    const category: Cat = props.activeCategory;
    let topics: Topic[];
    if (category) {
      topics = _.clone(store.topics);
      topics.sort((t: Topic, t2: Topic) => topic_sortByLatestActivity(t, t2, category.id));
    }
    else {
      // A restricted category, we may not see it?
      topics = [];
    }
    this.setState({ topics });
    scrollToLastPositionSoon();
  },

  canUseTopicsInScriptTag: function() {
    const props: LoadAndListTopicsProps = this.props;
    const store: Store = props.store;
    if (!store.topics || props.topicsInStoreMightBeOld)
      return false;

    const topicFilter = props.queryParams.filter;

    // The server includes topics for the active-topics sort order, all categories.
    return props.sortOrderRoute === RoutePathLatest &&
        (!topicFilter || topicFilter === FilterShowAll) &&
        !props.match.params.categorySlug;
  },

  componentDidMount: function() {
    // This happens when navigating back to the lates-topics list after having shown
    // all categories (plus on initial page load).
    this.loadTopics(this.props, false);
    this.maybeRunTour();
  },

  maybeRunTour: function() {
    const props: LoadAndListTopicsProps = this.props;
    const store: Store = props.store;
    const me: Myself = store.me;
    if (me.isAdmin && !this.tourMaybeStarted) {
      this.tourMaybeStarted = true;
      debiki2.staffbundle.loadStaffTours((tours) => {
        if (this.isGone) return;
        const tour = isBlogCommentsSite() ?
            tours.forumIntroForBlogComments(me) : tours.forumIntroForCommunity(me);
        debiki2.utils.maybeRunTour(tour);
      });
    }
  },

  UNSAFE_componentWillReceiveProps: function(nextProps) {
    // This happens when switching category or showing top topics instead of latest topics.
    this.loadTopics(nextProps, false);
  },

  componentDidUpdate: function() {
    rememberBackUrl();
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  loadMoreTopics: function() {
    this.loadTopics(this.props, true);
  },

  loadTopics: function(nextProps: LoadAndListTopicsProps, loadMore) {
    if (!nextProps.activeCategory) {
      // Probably a restricted category, won't be available until user-specific-data
      // has been activated (by ReactStore.activateMyself). (6KEWM02)
      return;
    }

    const curProps: LoadAndListTopicsProps = this.props;
    const isNewView =
            curProps.location.pathname !== nextProps.location.pathname ||
            curProps.location.search !== nextProps.location.search ||
            curProps.topPeriod !== nextProps.topPeriod;

    const store: Store = nextProps.store;
    let currentPageIsForumPage;
    _.each(store.pagesById, (page: Page) => {
      if (page.pagePath.value !== curProps.forumPath)
        return;
      if (page.pageId === store.currentPageId) {
        currentPageIsForumPage = true;
      }
    });

    if (!currentPageIsForumPage) {
      // Then it's too soon, now, to load topics. The store hasn't currently been updated
      // to use the forum page. The current page is some other page, with the wrong category id.
      // It might take a HTTP request, before the forum page has been loaded & is in use.
      return;
    }

    // Avoid loading the same topics many times:
    // - On page load, componentDidMount() and UNSAFE_componentWillReceiveProps()
    //   both loads topics.
    // - When we're refreshing the page because of Flux events, don't load the same topics again.
    if (!isNewView && !loadMore && (this.state.topics || this.isLoading))
      return;

    const orderOffset: OrderOffset = this.getOrderOffset(nextProps);
    orderOffset.topicFilter = nextProps.queryParams.filter;
    if (isNewView) {
      const thisElem = <HTMLElement> ReactDOM.findDOMNode(this);
      this.setState({
        // Sometimes, there's no elem — happens if changing a category's slug. [7AFDW01]
        // What do then? Hmm, min height 400px should fit in most devices?
        minHeight: thisElem ? thisElem.clientHeight : 400,
        topics: null,
        showLoadMoreButton: false
      });
      // Load from the start, no offset. Keep any topic filter though.
      delete orderOffset.olderThan;
      delete orderOffset.score;
    }
    const categoryId = nextProps.activeCategory.id;

    this.isLoading = true;

    // Prevent Chrome from jumping to the bottom of the page, once the new topics
    // have been loaded.
    // I think Chrome scroll-anchors the "Load more" button, so, after all new
    // topics have been loaded, Chrome adjusts the scroll position so "Load more" is
    // still visible — that is, Chrome scrolls past all newly loaded topics. But
    // that's wrong; instead, the scroll position is to stay the same, so one
    // can continue reading at the top of the newly loaded topics.
    $byId('esPageColumn').classList.add('s_NoScrlAncr');

    Server.loadForumTopics(categoryId, orderOffset, (response: LoadTopicsResponse) => { // (4AB2D)
      if (this.isGone) return;
      let topics: any = isNewView ? [] : (this.state.topics || []);
      const newlyLoadedTopics: Topic[] = response.topics;
      topics = topics.concat(newlyLoadedTopics);
      // `topics` includes at least the last old topic twice.
      topics = _.uniqBy(topics, 'pageId');
      this.isLoading = false;
      const newState: LoadAndListTopicsState = {
        minHeight: null,
        topics: topics,
        showLoadMoreButton: newlyLoadedTopics.length >= NumNewTopicsPerRequest
      };
      this.setState(newState);

      // Only scroll to last position once, when opening the page. Not when loading more topics.
      if (!loadMore) {
        scrollToLastPositionSoon();
      }
      setTimeout(function() {
        // Re-enable scroll anchoring.
        $byId('esPageColumn').classList.remove('s_NoScrlAncr');
      })
    });
  },

  getOrderOffset: function(nextProps?: LoadAndListTopicsProps): OrderOffset {
    const props: LoadAndListTopicsProps = nextProps || this.props;
    let lastBumpedAt: number;
    let lastScore: number;
    let lastCreatedAt: number;
    const lastTopic: any = _.last(this.state.topics);
    if (lastTopic) {
      // If we're loading more topics, we should continue with this offset.
      lastBumpedAt = lastTopic.bumpedAtMs || lastTopic.createdAtMs;
      lastCreatedAt = lastTopic.createdAtMs;
      lastScore = lastTopic.popularityScore;  // always absent, currently [7IKA2V]
    }

    const orderOffset: OrderOffset = { sortOrder: -1 };
    if (props.sortOrderRoute === RoutePathTop) {
      orderOffset.sortOrder = TopicSortOrder.ScoreAndBumpTime;
      orderOffset.olderThan = lastBumpedAt;
      orderOffset.score = lastScore;
      orderOffset.period = props.topPeriod;
    }
    else if (props.sortOrderRoute === RoutePathNew) {
      orderOffset.sortOrder = TopicSortOrder.CreatedAt;
      orderOffset.olderThan = lastCreatedAt;
    }
    else {
      orderOffset.sortOrder = TopicSortOrder.BumpTime;
      orderOffset.olderThan = lastBumpedAt;
    }
    return orderOffset;
  },

  render: function() {
    const props: LoadAndListTopicsProps = this.props;
    const state: LoadAndListTopicsState = this.state;

    // The category might not exist, or might be access restricted, and,
    // if pat may see it, will then appear in a moment, once pat specific data
    // has been activated (and then we'll continue below).
    if (!props.activeCategory)
      return CatNotFound(props.store);

    const topicListProps: TopicListProps = {
      topics: state.topics,
      store: props.store,
      forumPath: props.forumPath,
      useTable: props.useTable,
      useNarrowLayout: props.useNarrowLayout,
      minHeight: state.minHeight,
      showLoadMoreButton: state.showLoadMoreButton,
      loadMoreTopics: this.loadMoreTopics,
      activeCategory: props.activeCategory,
      setCategory: props.setCategory,
      editCategory: props.editCategory,
      orderOffset: this.getOrderOffset(),
      topPeriod: props.topPeriod,
      setTopPeriod: props.setTopPeriod,
      linkCategories: true,
      sortOrderRoute: props.sortOrderRoute,
      setSortOrder: props.setSortOrder,
      explSetSortOrder: props.explSetSortOrder,

      // For the topic list buttons [.reorder_forum_btns] — props included [.btn_props].
      location: (props as any as ForumButtonsProps).location,
      queryParams: (props as any as ForumButtonsProps).queryParams,
      history: (props as any as ForumButtonsProps).history,
    };

    return TopicsList(topicListProps);
  },
});



export const TopicsList = createComponent({
  displayName: 'TopicsList',

  getInitialState: function() {
    return {};
  },

  componentDidMount: function() {
    // Sometimes the relevant topics are cached / loaded already, and will be
    // rendered directly when mounting. Then need to process time ago, here directly
    // (rather than in ..DidUpdate(), which runs after done loading from server.)
    processTimeAgo();
  },

  componentDidUpdate: function() {
    processTimeAgo();
  },

  openIconsHelp: function() {
    this.setState({ helpOpened: true });
    ReactActions.showSingleTipsClientSide(IconHelpMessage.id);
  },

  render: function() {
    const props: TopicListProps = this.props;
    const store: Store = props.store;
    const me: Myself = store.me;
    const isLoading = !props.topics;
    const topics: Topic[] = props.topics || [];
    const activeCategory: Cat | U = props.activeCategory;

    const useTable: Bo = props.useTable;
    const orderOffset: OrderOffset = props.orderOffset;

    const doItVotesPopFirst = activeCategory && activeCategory.doItVotesPopFirst;

    const topicElems = topics.map((topic: Topic) => {
      const topicRowProps: TopicRowProps = {
          store, topic,
          activeCatId: activeCategory?.id, orderOffset,
          key: topic.pageId, sortOrderRoute: props.sortOrderRoute,
          doItVotesPopFirst, inTable: useTable, useNarrowLayout: props.useNarrowLayout,
          forumPath: props.forumPath, history: props.history };
      return TopicRow(topicRowProps);
    });

    // Insert an icon explanation help message in the topic list. Anywhere else, and
    // people won't see it at the right time, won't understand what the icons mean.
    // It'll be closed by default (click to open) if there are only a few topics.
    // (Because if people haven't seen some icons and started wondering "what's that",
    // they're just going to be annoyed by the icon help tips?)
    const numFewTopics = 10;
    const iconsHelpClosed = !this.state.helpOpened; /* always start closed, for now,
                                                    because doesn't look nice otherwise
        [refactor] So remove this stuff then:
        // User has clicked Hide?
        help.isHelpMessageClosed(store, IconHelpMessage) ||
        // Too few topics, then right now no one cares about the icons?
        (topics.length < numFewTopics && !this.state.helpOpened);
        */
    const iconsHelpStuff = !topics.length ? null : (
        iconsHelpClosed || help.isHelpMessageClosed(store, IconHelpMessage)
          ? r.a({ className: 'esForum_topics_openIconsHelp icon-info-circled',
                onClick: this.openIconsHelp }, t.ft.ExplIcons)
          : HelpMessageBox({ message: IconHelpMessage, showUnhideTips: false }));

    topicElems.splice(Math.min(topicElems.length, numFewTopics), 0,
      useTable
        ? r.tr({ key: 'ExplIcns' }, r.td({ colSpan: 5 }, iconsHelpStuff))
        : r.li({ key: 'ExplIcns', className: 'c_F_TsL_T clearfix' }, iconsHelpStuff));

    let loadMoreTopicsBtn: RElm;
    if (props.showLoadMoreButton) {
      const queryString = '?' + debiki2.ServerApi.makeForumTopicsQueryParams(orderOffset);
      loadMoreTopicsBtn =
        r.div({},
          r.a({ className: 'load-more', href: queryString, onClick: (event) => {
            event.preventDefault();
            props.loadMoreTopics();
          } }, t.LoadMore));
    }

    let topTopicsPeriodButton: RElm;
    if (orderOffset.sortOrder === TopicSortOrder.ScoreAndBumpTime) {
      const makeTopPeriodListItem = (period: TopTopicsPeriod, text?: string) => {
        return ExplainingListItem({ onSelect: () => props.setTopPeriod(period),
          activeEventKey: props.topPeriod, eventKey: period,
          title: topPeriod_toString(period),
          text: text });
      };

      topTopicsPeriodButton = r.div({},
          r.span({ className: 'esForum_sortInfo' }, t.ft.PopularTopicsComma),
          ModalDropdownButton({ className: 'esForum_sortInfo s_F_SI_TopB', pullLeft: true,
              title: r.span({},
                topPeriod_toString(props.topPeriod) + ' ', r.span({ className: 'caret' })) },
            r.ul({ className: 'dropdown-menu' },
              makeTopPeriodListItem(TopTopicsPeriod.All,
                t.ft.TopFirstAllTime),
              makeTopPeriodListItem(TopTopicsPeriod.Day,
                t.ft.TopFirstPastDay),
              makeTopPeriodListItem(TopTopicsPeriod.Week),
              makeTopPeriodListItem(TopTopicsPeriod.Month),
              makeTopPeriodListItem(TopTopicsPeriod.Quarter),
              makeTopPeriodListItem(TopTopicsPeriod.Year))));
    }

    const forumPage: Page = store_curPage(store);
    const oneLinePerTopic = forumPage.pageLayout <= TopicListLayout.TitleExcerptSameLine;
    const oneLineClass = oneLinePerTopic ? ' c_F_TsT-OneLine' : '';

    const catDeld = activeCategory && activeCategory.isDeleted;
    const deletedClass = !catDeld ? '' : ' s_F_Ts-CatDd';
    const anyDeletedCross = !catDeld ? null : r.div({ className: 's_Pg_DdX' });
    const categoryDeletedInfo = !catDeld ? null :
      r.p({ className: 'icon-trash s_F_CatDdInfo' },
        t.ft.CatHasBeenDeleted);

    let topicsHeaderText = t.Topics;
    switch (orderOffset.sortOrder) {
      case TopicSortOrder.BumpTime: topicsHeaderText = t.ft.TopicsActiveFirst; break;
      case TopicSortOrder.CreatedAt: topicsHeaderText = t.ft.TopicsNewestFirst; break;
    }

    const categoryHeader = !settings_showCategories(store.settings, me) ? null :
        r.th({ className: 's_F_Ts_T_CN' }, t.Category);

    const activityHeaderText =
        orderOffset.sortOrder === TopicSortOrder.CreatedAt ? t.Created : t.Activity;

    const topicsTable = !useTable ? null :
        r.table({ className: 'esF_TsT s_F_Ts-Wide dw-topic-list' + deletedClass + oneLineClass },
          r.thead({},
            r.tr({},
              doItVotesPopFirst ? r.th({ className: 'c_F_TsT_T_DvoTH' }, "Votes") : null,    // I18N
              r.th({}, topicsHeaderText),
              categoryHeader,
              r.th({ className: 's_F_Ts_T_Avs' }, t.Users),
              r.th({ className: 'num dw-tpc-replies' }, t.Replies),
              r.th({ className: 'num' }, activityHeaderText))),
              // skip for now:  r.th({ className: 'num' }, "Feelings"))),  [8PKY25]
          r.tbody({},
            topicElems));

    const topicList = useTable ? null :
        r.ol({ className: 'c_F_TsL s_F_Ts-Nrw' + deletedClass },
          topicElems);

    // Show a category title and description.
    // Otherwise people tend to not notice that they are inside a category.
    // And they typically do *not* see any about-category pinned topic
    // (like Discourse does — don't do that).
    let categoryNameDescr = !activeCategory || !settings_showCategories(store.settings, me) ||
        props.skipCatNameDescr ? null :
      CatNameDescr({ store, forumPath: props.forumPath,
          activeCategory, setCategory: this.props.setCategory,
          editCategory: this.props.editCategory });

    const showForumBtns = activeCategory && !store_isFeatFlagOn(store, 'ffBtnsBefCat');
    const forumButtonProps: ForumButtonsProps = !showForumBtns ? null : {
      store,
      forumPath: props.forumPath,
      activeCategory,
      isCategoriesRoute: false,  // we're in a topic list, not a categories tree
      sortOrderRoute: props.sortOrderRoute,
      setSortOrder: props.setSortOrder,
      explSetSortOrder: props.explSetSortOrder,
      useNarrowLayout: props.useNarrowLayout,

      // [.reorder_forum_btns]
      location: props.location,
      queryParams: props.queryParams,
      history: props.history,
    }
    const forumButtons = !showForumBtns ? null : ForumButtons(forumButtonProps);

    // Dim the topics list until topics loaded. UNTESTED after code moved to here  !.
    // Looks better than just removing it completely.
    // -- Is this still needed?: -------
    // The min height preserves scrollTop, even though the topic list becomes empty
    // for a short while (which would otherwise reduce the windows height which
    // in turn might reduce scrollTop).
    // COULD make minHeight work when switching to the Categories view too? But should
    // then probably scroll the top of the categories list into view.
    // COULD use store.topics, used when rendering server side, but for now:
    // ---------------------------------
    const loadingStyle = !isLoading ? {} : {
      minHeight: props.minHeight ,
      pointerEvents: 'none',
      opacity: '0.8',
    }

    return (
      r.div({ className: 's_F_Ts e_SrtOrdr-' + orderOffset.sortOrder,
              style: loadingStyle },
        categoryDeletedInfo,
        showForumBtns ? null :
              // Legacy. Then the forum buttons are just above, instead of inside this
              // component — and then it makes sense to show the trending topics
              // period at the top of this component (so they appear just below
              // the forum buttons).
              topTopicsPeriodButton,
        r.div({ style: { position: 'relative' }},
          anyDeletedCross,
          categoryNameDescr,
          forumButtons,
          showForumBtns ? topTopicsPeriodButton : null,
          isLoading ? t.Loading : null,
          topicsTable || topicList),
        isLoading || topics.length ? null :
          r.div({ className: 's_F_Ts_NoTopics', id: 'e2eF_NoTopics' }, t.NoTopics),
        loadMoreTopicsBtn));
  }
});


function CatNameDescr(props: { store: Store, forumPath: St, activeCategory: Cat,
      setCategory: (newCatSlug?: St, newCat?: Cat) => Vo, editCategory }) {
  const store: Store = props.store;
  const me: Myself = store.me;
  const activeCategory: Cat = props.activeCategory;

  const catsActiveLast = store_ancestorCatsCurLast(store, activeCategory.id);

  // catsActiveLast is empty, if we haven't selected any category. Then, currently,
  // activeCategory is a dummy category for the whole site section. (What about
  // using the root category (include it in the json from the server) instead?)
  const baseCat: Cat = catsActiveLast[0] || activeCategory;
  const anySubCat: Cat | U = catsActiveLast[1];
  const totalDepth = catsActiveLast.length;
  // @ifdef DEBUG
  dieIf(totalDepth >= 3, '3 level cats not yet impl [TyE0GKRH]');
  // @endif

  const baseCats =
      store.currentCategories.filter(c =>
          // If we're showing all categories, the active category id is the root category,
          // then need to compare c.parnetId with the root category id:
          // Otherwise, we want the siblings to baseCat, that is, the same parentId.
          activeCategory.isForumItself
              ? c.parentId === activeCategory.id
              : c.parentId === baseCat.parentId);

  const subCats = activeCategory.isForumItself
      ? []  // (otherwise would include all base cats again — the All Cats dummy id is the root id)
      : store.currentCategories.filter(c =>
          // (Cannot use `=== anySubCat.parentId` — maybe we haven't selected any sub cat.)
          c.parentId === baseCat.id);

  arr_sortAlphaInPlace(subCats, c => c.name);  // [sort_cats]

  const baseCatDropdown = makeCatDropdown(store, '', baseCats, baseCat, false, !subCats.length);
  const anySubCatDropdown = makeCatDropdown(store, baseCat.slug, subCats, anySubCat, true, true);


  function makeCatDropdown(store: Store, parentCatSlug: string,
        catsSameLevel: Cat[], thisCat: Cat, isSubCat: boolean, isLastCat: boolean) {

    if (!catsSameLevel.length)
      return null;

    const categoryMenuItems = catsSameLevel.map((category: Cat) => {
      const sortOrderPath = category.doItVotesPopFirst ? RoutePathTop : RoutePathLatest;
      return MenuItem({ key: category.id, active: thisCat && thisCat.id === category.id,
          href: props.forumPath + sortOrderPath + '/' + category.slug, // dupl [.cat_ln]
          onClick: () => props.setCategory(category.slug, category) },
            r.span({ className: category_iconClass(category, store) }, category.name));
    });
    categoryMenuItems.unshift(
        MenuItem({ key: -1,
          active: thisCat && thisCat.isForumItself, // (this won't work for sub cats, barely matters)
          onClick: () => props.setCategory(parentCatSlug) }, t.fb.AllCats));

    const activeCategoryIcon = !thisCat ? null : category_iconClass(thisCat, store);
    const subCatClass = isSubCat ? ' s_F_Ts_Cat_Ttl-SubCat' : '';

    const categoriesDropdownButton =
        ModalDropdownButton({
            className: 'esForum_catsDrop active s_F_Ts_Cat_Ttl' + subCatClass, pullLeft: true,
            title: r.span({ className: activeCategoryIcon },
                  thisCat ? thisCat.name : (isSubCat ? t.fcs.All : t.fb.AllCats),
                  isLastCat ? r.span({ className: 'caret' }) : null) },
          r.ul({ className: 'dropdown-menu s_F_BB_CsM' },
              categoryMenuItems));

    return categoriesDropdownButton;
  }

  const editCatButton = activeCategory.isForumItself || !me.isAdmin ? null :
      r.a({ className: 's_F_Ts_Cat_Edt icon-edit', onClick: props.editCategory },
        t.fb.EditCat);

  return (
    r.div({ className: 's_F_Ts_Cat' },
      r.div({ className: 's_F_Ts_Cat_SelectCatBs' },
        baseCatDropdown,
        anySubCatDropdown),
      r.p({ className: 's_F_Ts_Cat_Abt' }, activeCategory.description),
      editCatButton));
}


const IconHelpMessage = {
  id: '5KY0W347',
  version: 1,
  content:
    r.div({ className: 'esTopicIconHelp' },
      r.p({ className: 'esTopicIconHelp_intro' }, t.ft.IconExplanation),
      r.ul({},
        r.li({},
          r.span({ className: 'icon-comment' },
            t.ft.ExplGenDisc)),
        r.li({},
          r.span({ className: 'icon-help-circled' },
            t.ft.ExplQuestion)),
        r.li({},
          r.span({ className: 'icon-ok' },
            t.ft.ExplAnswer)),
        r.li({},
          r.span({ className: 'icon-idea' },
            t.ft.ExplIdea)),
        r.li({},
          r.span({ className: 'icon-attention-circled' },
            t.ft.ExplProblem)),
        r.li({},
          r.span({ className: 'icon-check-empty' },
            t.ft.ExplPlanned)),
        r.li({},
          r.span({ className: 'icon-check' },
            t.ft.ExplDone)),
        /* r.li({}, disable mind maps [NOMINDMAPS]
          r.span({ className: 'icon-sitemap' },
            "A mind map.")),  */
        r.li({},
          r.span({ className: 'icon-block' },
            t.ft.ExplClosed)),
        r.li({},
          r.span({ className: 'icon-pin' },
            t.ft.ExplPinned)))),
};



interface TopicRowProps {
  store: Store;
  topic: Topic;
  activeCatId?: CatId;
  sortOrderRoute: St;
  forumPath: St;
  orderOffset: OrderOffset;
  doItVotesPopFirst: Bo;
  inTable: Bo;
  useNarrowLayout?: Bo;
  key: St | Nr;
  history?: ReactRouterHistory;
}


const TopicRow = createComponent({
  displayName: 'TopicRow',

  getInitialState: function() {
    return {
      showMoreExcerpt: false,
    };
  },

  showMoreExcerpt: function() {
    this.setState({ showMoreExcerpt: true });
  },

  // Currently not in use, see [8PKY25].
  styleFeeeling: function(num, total): any {
    if (!total)
      return null;

    // What we're interested in is the probability that people feel something for this
    // topic? The probability that they like it, or think it's wrong. One weird way to somewhat
    // estimate this, which takes into account uncertainty for topics with very few posts,
    // might be to consider num and total the outome of a binomial proportion test,
    // and use the lower bound of a confidence interval:
    // COULD give greater weight to posts that are shown on page load (when loading the topic).

    // Usually there are not more than `total * 2` like votes, as far as I've seen
    // at some popular topics @ meta.discourse.org. However, Discourse requires login;
    // currently Debiki doesn't.
    let fraction = 1.0 * num / total / 2;
    if (fraction > 1) {
      fraction = 1;
    }
    if (!this.minProb) {
      this.minProb = this.binProbLowerBound(0, 0) + 0.01;
    }
    const probabilityLowerBound = this.binProbLowerBound(total, fraction);
    if (probabilityLowerBound <= this.minProb)
      return null;

    const size = 8 + 6 * probabilityLowerBound;
    const saturation = Math.min(100, 100 * probabilityLowerBound);
    const brightness = Math.max(50, 70 - 20 * probabilityLowerBound);
    const color = 'hsl(0, ' + saturation + '%, ' + brightness + '%)' ; // from gray to red
    return {
      fontSize: size,
      color: color,
    };
  },

  binProbLowerBound: function(sampleSize: number, proportionOfSuccesses: number): number {
    // This is a modified version of the Agresti-Coull method to calculate upper and
    // lower bounds of a binomial proportion. Unknown confidence interval size, I just
    // choose 1.04 below because it feels okay.
    // For details, see: modules/debiki-core/src/main/scala/com/debiki/core/statistics.scala
    const defaultProbability = Math.min(0.5, proportionOfSuccesses);
    const adjustment = 4;
    const n_ = sampleSize + adjustment;
    const p_ = (proportionOfSuccesses * sampleSize + adjustment * defaultProbability) / n_;
    const z_unknownProb = 1.04;
    const square = z_unknownProb * Math.sqrt(p_ * (1 - p_) / n_);
    const lowerBound = p_ - square;
    const upperBound = p_ + square;
    return lowerBound;
  },

  makeCategoryLink: function(category: Category, skipQuery?: boolean) {
    const props: TopicRowProps = this.props;
    const sortOrderPath = props.sortOrderRoute;
    // this.props.queryParams — later: could convert to query string, unless skipQuery === true
    return props.forumPath + sortOrderPath + '/' + category.slug;
  },

  render: function() {
    const props: TopicRowProps = this.props;
    const store: Store = props.store;
    const forumPage: Page = store_curPage(store);
    const me = store.me;
    const settings = store.settings;
    const topic: Topic = props.topic;
    const category: Category = _.find(store.currentCategories, (category: Category) => {
      return category.id === topic.categoryId;
    });

    /* Skip Feelings for now, mostly empty anyway, doesn't look good. Test to add back  [8PKY25]
    later if people start using Like and Wrong fairly much.
    var feelingsIcons = [];
    var heartStyle = this.styleFeeeling(topic.numLikes, topic.numPosts);
    if (heartStyle) {
      feelingsIcons.push(
          r.span({ className: 'icon-heart', style: heartStyle, key: 'h' }));
    }
    var wrongStyle = this.styleFeeeling(topic.numWrongs, topic.numPosts);
    if (wrongStyle) {
      feelingsIcons.push(
          r.span({ className: 'icon-warning', style: wrongStyle, key: 'w' }));
    }

    var feelings;
    if (feelingsIcons.length) {
      var title =
          topic.numLikes + ' like votes\n' +
          topic.numWrongs + ' this-is-wrong votes';
      feelings =
        r.span({ title: title }, feelingsIcons);
    }
     */

    // COULD change to:
    //  "Created " + debiki.prettyDuration(topic.createdAtMs, Date.now()) + ", on <exact date>"
    // but that won't work server side, because Date.now() changes all the time.
    // Would instead need to generate the tooltip dynamically (rather than include it in the html).
    // [compress]
    let activityTitle = t.ft.CreatedOn + whenMsToIsoDate(topic.createdAtMs);

    if (topic.lastReplyAtMs) {
      activityTitle += t.ft.LastReplyOn + whenMsToIsoDate(topic.lastReplyAtMs);
    }
    if (topic.bumpedAtMs && topic.bumpedAtMs !== topic.lastReplyAtMs) {
      activityTitle += t.ft.EditedOn + whenMsToIsoDate(topic.bumpedAtMs);
    }

    let anyPinOrHiddenIconClass = topic.pinWhere ? 'icon-pin' : undefined;
    if (topic.hiddenAtMs) {
      anyPinOrHiddenIconClass = 'icon-eye-off';
    }

    const tags = settings.enableTags === false ? null :
        TagList({ tags: topic.pubTags, store });  // or forPage: topic?

    let mabyeTagsAfterTitle: RElm | U;
    let excerptMaybeTags: RElm | U;  // [7PKY2X0]
    const showExcerptAsParagraph =
        topic.pinWhere === PinPageWhere.Globally ||
        (topic.pinWhere && topic.categoryId === props.activeCatId) ||
        forumPage.pageLayout >= TopicListLayout.ExcerptBelowTitle;
    if (showExcerptAsParagraph) {
      excerptMaybeTags =
          r.div({ className: 'dw-p-excerpt' }, topic.excerpt, tags);
          // , r.a({ href: topic.url }, 'read more')); — no, better make excerpt click open page?
    }
    else if (forumPage.pageLayout === TopicListLayout.TitleExcerptSameLine) {
      excerptMaybeTags =
          r.div({ className: 's_F_Ts_T_Con_B' }, topic.excerpt, tags);
    }
    else {
      mabyeTagsAfterTitle = tags;
      // No excerpt.
      dieIf(forumPage.pageLayout && forumPage.pageLayout !== TopicListLayout.TitleOnly,
          'EdE5FK2W8');
    }

    let anyThumbnails;
    if (forumPage.pageLayout === TopicListLayout.ThumbnailLeft) {
      die('Unimplemented: thumbnail left [EdE7KW4024]')
    }
    else if (forumPage.pageLayout >= TopicListLayout.ThumbnailsBelowTitle) {
      let thumbnailUrls = topic_mediaThumbnailUrls(topic);
      let imgIndex = 0;
      anyThumbnails = _.isEmpty(thumbnailUrls) ? null :
        r.div({ className: 's_F_Ts_T_Tmbs' },
          thumbnailUrls.map(url => r.img({ src: url, key: ++imgIndex })));
    }

    let showCategories = settings_showCategories(settings, me);
    let categoryName;
    if (category && showCategories) {
      categoryName = Link({ to: this.makeCategoryLink(category),
          className: category_iconClass(category, store) + 'esF_Ts_T_CName' }, category.name);
    }

    // Avatars: Original Poster, some frequent posters, most recent poster. [7UKPF26]
    const author = store_getUserOrMissing(store, topic.authorId, 'EsE5KPF0');
    const userAvatars = [
        avatar.Avatar({ key: 'OP', user: author, origins: store, title: t.ft.createdTheTopic })];
    for (let i = 0; i < topic.frequentPosterIds.length; ++i) {
      const poster = store_getUserOrMissing(store, topic.frequentPosterIds[i], 'EsE2WK0F');
      userAvatars.push(avatar.Avatar({ key: poster.id, user: poster, origins: store,
            title: t.ft.frequentPoster }));
    }
    // Don't show last replyer, if same as topic author, and no other avatar is shown.
    const lastReplyerIsOp = topic.lastReplyerId === topic.authorId;
    if (topic.lastReplyerId && !(lastReplyerIsOp && userAvatars.length === 1)) {
      const lastReplyer = store_getUserOrMissing(store, topic.lastReplyerId, 'EsE4GTZ7');
      userAvatars.push(avatar.Avatar({ key: 'MR', user: lastReplyer, origins: store,
            title: t.ft.mostRecentPoster }));
    }

    // DO_AFTER 2021-12-01: CLEAN_UP: Nowadays always Link and r.div, can move into makeTitle;
    // and contentLinkUrl no longer in use.
    let titleLinkTag = Link;
    let titleCellTag = r.div;
    let contentLinkUrl: St | U;
    let manyLinesClass = '';  // remove, place on table insted?, see oneLineClass somewhere above.
    let onTitleCellClick = () => {
        props.history.push(topic.url);
      };
    if (showExcerptAsParagraph) {
      manyLinesClass = ' s_F_Ts_T_Con-Para';
      // Make the whole title and paragraph block a link, not just the title.
      //titleLinkTag = r.span;
      //titleCellTag = Link;
      //contentLinkUrl = topic.url;
    }
    else if (this.state.showMoreExcerpt) {
      manyLinesClass = ' s_F_Ts_T_Con-More';
    }
    else {
      manyLinesClass = ' s_F_Ts_T_Con-OneLine';
      onTitleCellClick = this.showMoreExcerpt;
    }

    const orderOffset: OrderOffset = props.orderOffset;

    const activeAt = Link({ to: topic.url + FragActionHashScrollLatest },
        prettyLetterTimeAgo(
          orderOffset.sortOrder === TopicSortOrder.CreatedAt
            ? topic.createdAtMs
            : topic.bumpedAtMs || topic.createdAtMs));

    // We use a table layout, only for wide screens, because table columns = spacy.
    if (props.inTable) return (
      r.tr({ className: 'esForum_topics_topic e2eF_T' },  // (update BJJ CSS before renaming 'esForum_topics_topic' (!))
        !props.doItVotesPopFirst ? null :
              r.td({ className: 'c_F_TsT_T_Dvo' },
                TopicUpvotes(topic, true /*iconFirst*/)),
        r.td({ className: 'dw-tpc-title e2eTopicTitle' },
          titleCellTag({ className: 's_F_Ts_T_Con' + manyLinesClass,
              onClick: onTitleCellClick }, // , to: contentLinkUrl },
            makeTitle(topic, 's_F_Ts_T_Con_Ttl ' + anyPinOrHiddenIconClass,
                settings, me, titleLinkTag),
            mabyeTagsAfterTitle, 
            excerptMaybeTags),
          anyThumbnails),
        !showCategories ? null : r.td({ className: 's_F_Ts_T_CN' }, categoryName),
        r.td({ className: 's_F_Ts_T_Avs' }, userAvatars),
        r.td({ className: 'num dw-tpc-replies' }, topic.numPosts - 1),
        r.td({ className: 'num dw-tpc-activity', title: activityTitle }, activeAt)));
        // skip for now:  r.td({ className: 'num dw-tpc-feelings' }, feelings)));  [8PKY25]
    else return (
      r.li({ className: 'c_F_TsL_T e2eF_T' },
        !props.doItVotesPopFirst || props.useNarrowLayout ? null :
            r.div({ className: 'n_Col1' },
              TopicUpvotes(topic, true /*iconFirst*/)),
        r.div({ className: 'n_Col2' },
          r.div({ className: 'n_Row1' },
            r.div({ className: 'c_F_TsL_T_Title e2eTopicTitle' },
              makeTitle(topic, anyPinOrHiddenIconClass, settings, me)),
            r.div({ className: 'c_F_TsL_T_Stats'},
              !props.doItVotesPopFirst || !props.useNarrowLayout ? null :
                    TopicUpvotes(topic, false /*iconFirst*/),
              r.span({ className: 'c_F_TsL_T_NumRepls' },
                topic.numPosts - 1, r.span({ className: 'icon-comment-empty' })))),
          excerptMaybeTags,
          r.div({ className: 'n_Row2' },
            r.div({ className: 'c_F_TsL_T_Users' },
              userAvatars),
            !showCategories ? null : r.div({ className: 'c_F_TsL_T_Cat' },
              r.span({ className: 'c_F_TsL_T_Cat_Expl' }, t.ft.inC), categoryName),
            r.span({ className: 'c_F_TsL_T_When' }, activeAt)),
          anyThumbnails)));
  }
});


function TopicUpvotes(topic: Topic, iconFirst: Bo): RElm {
  // Does log2 grow fast enough? 32 –> 4, 64 –> 5 etc. There're colors up to 11 –> 2048.
  const logLikes = Math.trunc(Math.log2(topic.numOrigPostLikes + 1));
  const votesColorClass = Math.min(logLikes, 11);  // [max_log_likes]

  // Later, if DoVoteStyle is DoIt/AndDoNot, instead of a Like icon, there'll be
  // up and down arrows.
  const upvoteIcon = r.span({ className: 'icon-heart' });
  const upvoteCount = r.span({ className: 'c_TpDiVo_Ttl' }, topic.numOrigPostLikes);
  return (
      r.span({ className: 'c_TpDvo c_DiVo-' + votesColorClass },
        // In vertical layout, the icon is above the vote count, then, icon first here.
        // Otherwise, the number is before the icon, e.g. 5 <like-icon>  (and the icons
        // right aligned).
        iconFirst ? upvoteIcon : null,
        upvoteCount,
        !iconFirst ? upvoteIcon : null));
}


function topic_mediaThumbnailUrls(topic: Topic): string[] {
  let bodyUrls = topic.firstImageUrls || [];
  let allUrls = bodyUrls.concat(topic.popularRepliesImageUrls || []);
  let noGifs = _.filter(allUrls, (url) => url.toLowerCase().indexOf('.gif') === -1);
  return _.uniq(noGifs);
}



interface LoadAndListCatsProps {
  store: Store;
  queryParams: UrlParamsMap;
  location: ReactRouterLocation;
  forumPath: St;
}


const LoadAndListCategories = createFactory({
  displayName: 'LoadAndListCategories',

  getInitialState: function() {
    return {};
  },

  componentDidMount: function() {
    this.loadCategories(this.props);
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  UNSAFE_componentWillReceiveProps: function(nextProps: LoadAndListCatsProps) {
    this.loadCategories(nextProps);
  },

  componentDidUpdate: function() {
    processTimeAgo();
  },

  loadCategories: function(props: LoadAndListCatsProps) {
    const store: Store = props.store;
    Server.loadForumCategoriesTopics(store.currentPageId, props.queryParams.filter,
        (categories: Category[]) => {
      if (this.isGone) return;
      this.setState({ categories: categories });
    });
  },

  render: function() {
    const props: LoadAndListCatsProps = this.props;
    const store: Store = props.store;
    const categories: Category[] = this.state.categories;
    if (!categories)
      return r.p({}, t.Loading);

    const siteSection: SiteSection =
        store.siteSections.find(s => s.pageId === store.currentPageId);

    const topLevelCats = categories.filter(c => c.parentId === siteSection.rootCategoryId);

    const categoryRows = topLevelCats.map((category: Category) => {
      const childCategories = categories.filter(c => c.parentId === category.id);
      arr_sortAlphaInPlace(childCategories, c => c.name);
      return CategoryRow({ store: props.store, location: props.location,
          forumPath: props.forumPath, category: category, childCategories, siteSection,
          key: category.id });
    });

    let recentTopicsColumnTitle;
    switch (props.queryParams.filter) {
      case FilterShowWaiting:
        recentTopicsColumnTitle = t.fc.RecentTopicsWaiting;
        break;
      case FilterShowDeleted:
        recentTopicsColumnTitle = t.fc.RecentTopicsInclDel;
        break;
      default:
        recentTopicsColumnTitle = t.fc.RecentTopics;
    }

    return (
      r.table({ className: 'forum-table table' },
        r.thead({},
          r.tr({},
            r.th({}, t.Category),
            r.th({}, recentTopicsColumnTitle))),
        r.tbody({ className: 's_F_Cs' },
          categoryRows)));
    }
});



const CategoryRow = createComponent({
  displayName: 'CategoryRow',

  componentDidMount: function() {
    const store: Store = this.props.store;
    // If this is a newly created category, scroll it into view. [7KFWIQ2]
    if (this.props.category.slug === store.newCategorySlug) {
      utils.scrollIntoViewInPageColumn(<Element> ReactDOM.findDOMNode(this));
    }
  },

  render: function() {
    const store: Store = this.props.store;
    const me: Myself = store.me;
    const category: Category = this.props.category;
    const childCategories: Category[] = this.props.childCategories;
    const siteSection: SiteSection = this.props.siteSection;
    const forumPath = this.props.forumPath;
    const location = this.props.location;

    const childCatsList = childCategories.map((childCat: Category) =>
      r.li({ key: childCat.id },
        CatLink({ category: childCat, forumPath, location,
            className: 's_F_Cs_C_ChildCs_C' })));

    const recentTopicRows = category.recentTopics.map((topic: Topic) => {
      const pinIconClass = topic.pinWhere ? ' icon-pin' : '';
      const numReplies = topic.numPosts - 1;
      return (
        r.tr({ key: topic.pageId },
          r.td({},
            // CLEAN_UP use 'c_TpcTtl' instead of 'topic-title'.
            makeTitle(topic, 'topic-title' + pinIconClass, store.settings, me),
            r.span({ className: 'topic-details' },
              r.span({ title: numReplies + t.fc._replies },
                numReplies, r.span({ className: 'icon-comment-empty' })),
              prettyLetterTimeAgo(topic.bumpedAtMs || topic.createdAtMs)))));
    });

    // This will briefly highlight a newly created category.
    const isNewClass = category.slug === store.newCategorySlug ?
      ' esForum_cats_cat-new' : '';

    let isDeletedClass = category.isDeleted ? ' s_F_Cs_C-Dd' : '';
    let isDeletedText = category.isDeleted ?
        r.small({}, t.fc._deleted) : null;

    const isDefaultText = category.id === siteSection.defaultCategoryId && isStaff(me) ?
        r.small({}, t.fc._defCat) : null;

    const categoryIconClass = category_iconClass(category, store);

    const anyNotfLevel = !me.isLoggedIn ? null : r.div({ className: ' s_F_Cs_C_Ntfs' },
        r.span({}, t.Notifications + ': '),
        notfs.PageNotfPrefButton({ store, target: { pagesInCategoryId: category.id }, ownPrefs: me }));

    return (
      r.tr({ className: 'esForum_cats_cat' + isNewClass + isDeletedClass },
        r.td({ className: 'forum-info' }, // [rename] to esForum_cats_cat_meta
          !category.thumbnailUrl ? null :
            r.div({ className: 's_F_Cs_C_IcoWrp' },
              r.img({ src: category.thumbnailUrl })),
          r.div({ className: 's_F_Cs_C_TxtWrp' },
            r.div({ className: 'forum-title-wrap' },
              CatLink({ category, forumPath, location, isDefaultText,
                  className: categoryIconClass + 'forum-title', }),
              isDeletedText),
            r.p({ className: 'forum-description' }, category.description),
            anyNotfLevel,
            r.ol({ className: 's_F_Cs_C_ChildCs' },
              childCatsList))),
        r.td({},  // class to esForum_cats_cat_topics?
          r.table({ className: 'topic-table-excerpt table table-condensed' },
            r.tbody({},
              recentTopicRows)))));
    }
});


function CatLink(props: { category: Category, forumPath: string, location,
      className: string, isDefaultText? }) {
  const forumPath = props.forumPath;
  const category = props.category;
  const sortOrderPath = category.doItVotesPopFirst ? RoutePathTop : RoutePathLatest;
  return Link({ to: {  // dupl [.cat_ln]
      pathname: forumPath + sortOrderPath + '/' + category.slug,
      search: props.location.search }, className: props.className },
    category.name, props.isDefaultText);
}


function makeTitle(topic: Topic, className: string, settings: SettingsVisibleClientSide,
      me: Myself, reactTag?) {
  let title: any = topic.title;
  let iconClass = '';
  let tooltip;
  let showIcons = settings_showTopicTypes(settings, me);

  if (page_isClosedUnfinished(topic)) {
    tooltip = page.makePageClosedTooltipText(topic.pageRole);
    const closedIcon = r.span({ className: 'icon-block' });
    title = r.span({}, closedIcon, title);
  }
  else if (topic.pageRole === PageRole.Question) {
    tooltip = topic.answeredAtMs ? t.d.TooltipQuestSolved : t.d.TooltipQuestUnsolved;
    let questionIconClass;
    if (topic.answeredAtMs) {
      questionIconClass = 'icon-ok';
    }
    else if (!showIcons) {
      // Then only show, if answered.
    }
    else {
      questionIconClass = 'icon-help-circled';
    }
    /* Skip this — feels like unneeded. The reply counts column is enough?
    var answerIcon;
    var answerCount;
    // (Don't show answer count if question already solved — too much clutter.)
    if (!topic.answeredAtMs && topic.numOrigPostReplies > 0) {
      /* Skip this answer count stuff for now (or permanently?), too much clutter.
      answerIcon = r.span({ className: 'icon-info-circled dw-icon-inverted' }, ' ');
      answerCount = r.span({ className: 'dw-qa-ans-count' }, topic.numOrigPostReplies);

      tooltip += " with " + topic.numOrigPostReplies;
      if (topic.numOrigPostReplies > 1) tooltip += " answers";
      else tooltip += " answer";
    } */
    if (questionIconClass) {
      title = r.span({}, r.span({ className: questionIconClass }), title);
    }
  }
  else if (topic.pageRole === PageRole.Problem || topic.pageRole === PageRole.Idea) {
    // (Previously some dupl code, see [5KEFEW2] in discussion.ts.
    if (topic.doneAtMs) {
      tooltip = topic.pageRole === PageRole.Problem
        ? t.ft.TitleFixed
        : t.ft.TitleDone;
      iconClass = 'icon-check';
    }
    else if (topic.pageRole === PageRole.Problem && topic.answerPostUniqueId) {
      // A problem with a solution post — similar to a question plus answer.
      // UX COULD use a "Problem solved" tooltip text instead of "Question ...".
      tooltip = t.d.TooltipQuestSolved;
      // Use the same icon as for Question topics with an answer selected
      // — in most cases, Problem topics with a solution accepted,
      // might as well have been posted as questions + answers; using different
      // icons just adds extra clutter & "brain noise"? [ans_solved_icon]
      iconClass = 'icon-ok';
    }
    else if (!showIcons) {
      // Then don't show icons, unless done/fixed.
    }
    else if (topic.startedAtMs) {
      tooltip = topic.pageRole === PageRole.Problem ?
          t.ft.TitleStartedFixing : t.ft.TitleStarted;
      iconClass = 'icon-check-empty';
    }
    else if (!topic.plannedAtMs) {
      tooltip = topic.pageRole === PageRole.Problem
          ? t.ft.TitleUnsolved
          : t.ft.TitleIdea;
      iconClass = topic.pageRole === PageRole.Problem ? 'icon-attention-circled' : 'icon-idea';
    }
    else {
      tooltip = topic.pageRole === PageRole.Problem
          ? t.ft.TitlePlanningFix
          : t.ft.TitlePlanningDo;
      iconClass = 'icon-check-dashed';
    }
    if (iconClass) {
      title = r.span({}, r.span({ className: iconClass }, title));
    }
  }
  else if (
          topic.pageRole === PageRole.UsabilityTesting) {  // [plugin]
    if (topic.doneAtMs) {
      iconClass = 'icon-check';
      tooltip = topic.pageRole === PageRole.UsabilityTesting ? // [plugin]
          "Testing and feedback done." : "This has been done or fixed";
    }
    else if (showIcons) {
      iconClass = 'icon-check-empty';
      tooltip = topic.pageRole === PageRole.UsabilityTesting ? // [plugin]
          "Waiting for feedback" : "This is something to do or to fix";
    }
    if (iconClass) {
      title = r.span({}, r.span({ className: iconClass }, title));
    }
  }
  else if (page_isOpenChat(topic.pageRole)) {
    if (showIcons) {
      tooltip = t.ft.TitleChat;
      title = r.span({}, r.span({ className: 'icon-chat' }), title);
    }
  }
  else if (topic.pageRole === PageRole.PrivateChat) {
    tooltip = t.ft.TitlePrivateChat;
    title = r.span({}, r.span({ className: 'icon-lock' }), title);
  }
  else if (topic.pageRole === PageRole.MindMap) {
    if (showIcons) {
      tooltip = "This is a mind map";
      title = r.span({}, r.span({className: 'icon-sitemap'}), title);
    }
  }
  else if (topic.pageRole === PageRole.FormalMessage) {
    tooltip = t.ft.TitlePrivateMessage;
    title = r.span({}, r.span({ className: 'icon-mail' }), title);
  }
  else if (topic.pageRole === PageRole.WebPage || topic.pageRole === PageRole.CustomHtmlPage) {
    // These are special & "rare" pages (e.g. the site's About page), usually editable by staff only.
    // Make them easier to find/recognize, by always showing icons.
    tooltip = t.ft.TitleInfoPage;
    title = r.span({}, r.span({ className: 'icon-doc-text' }), title);
  }
  else {
    if (showIcons) {
      title = r.span({}, r.span({className: 'icon-comment-empty'}), title);
      tooltip = t.ft.TitleDiscussion;
    }
  }

  if (topic.deletedAtMs) {
    title = r.span({ className: 'esForum_topics_topic-deleted' },
        r.span({ className: 'icon-trash' }), title);
  }

  if (topic.pinWhere) {
    tooltip += topic.pinWhere == PinPageWhere.Globally ?
        t.ft.IsPinnedGlobally : t.ft.IsPinnedInCat;
  }

  // COULD remove the HTML for the topic type icon, if topic pinned — because showing both
  // the pin icon, + topic type icon, looks ugly. But for now, just hide the topic type
  // icon in CSS instead: [6YK320W].
  const toUrl = reactTag && reactTag !== Link ? undefined : topic.url;
  return (
      (reactTag || Link)({
          to: toUrl, title: tooltip, className: className + ' c_TpcTtl' },
        title));
}


function createTopicBtnTitle(category: Cat) {
  let title = t.fb.CreateTopic;
  if (_.isEqual([PageRole.Idea], category.newTopicTypes)) {
    title = t.fb.PostIdea;
  }
  else if (_.isEqual([PageRole.Question], category.newTopicTypes)) {
    title = t.fb.AskQuestion;
  }
  else if (_.isEqual([PageRole.Problem], category.newTopicTypes)) {
    title = t.fb.ReportProblem;
  }
  else if (_.isEqual([PageRole.MindMap], category.newTopicTypes)) {
    title = t.fb.CreateMindMap;
  }
  else if (areWebPages(category.newTopicTypes)) {
    title = t.fb.CreatePage;
  }
  function areWebPages(topicTypes: PageRole[]): boolean {
    return isWebPage(topicTypes[0]) && (
        topicTypes.length === 1 || (topicTypes.length === 2 && isWebPage(topicTypes[1])));
  }
  function isWebPage(pageType: PageRole): boolean {
    return pageType === PageRole.CustomHtmlPage || pageType === PageRole.WebPage;
  }
  return title;
}


function CatNotFound(store: Store) {
  // Can happen if 1) pat types a non-existing category slug in the URL.
  // Or if 2) hen has just created a category, clicked a link to another page,
  // and then clicked Back in the browser, and thus navigated back to the forum page
  // — then, the browser reloads the forum page, but uses cached forum page HTML
  // which includes JSON in which the newly created category is missing (wasn't
  // created, when the forum page was first loaded).
  // However, if 3) user-specific-data hasn't yet been activated, the reason the cat
  // seems missing, can be that it's access restricted, and will get added to the
  // store's category list in a moment, when user specific data gets activated (6KEWM02).
  // Or 4) pat may indeed not see the cat.
  // So, let's wait until user specific data added, before showing any not-found error.
  return !store.userSpecificDataAdded ? null : (
    r.div({ className: 'c_F_0Cat' },
      r.h3({}, "Category not found."),
      r.p({},
      "Did you just create it? Or renamed it?", r.br(),
      "Or you may not access it? Maybe it doesn't exist? [_TyE0CAT]"),
      r.br(),
      PrimaryLinkButton({ href: '/' }, "Go to Homepage"),
      Button({ onClick: () => location.reload() }, "Reload page")));
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list

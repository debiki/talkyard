/*
 * Copyright (c) 2015-2018 Kaj Magnus Lindberg
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


export const ForumComponent = createReactClass(<any> {
  displayName: 'ForumComponent',
  mixins: [StoreListenerMixin, utils.PageScrollMixin],

  getInitialState: function() {
    const store: Store = ReactStore.allData();
    return {
      store,
      topicsInStoreMightBeOld: false,
      useWideLayout: this.isPageWide(store),
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
    ReactActions.maybeLoadAndShowNewPage(this.state.store, this.props.history, this.props.location);
    scrollToWhenCommentsLoaded = lastScrollYByPath[this.props.location.pathname] || 0;
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
    lastScrollYByPath = {};
    lastScrollYByPath[this.props.location.pathname] = $byId('esPageColumn').scrollTop;
  },

  checkSizeChangeLayout: function() {
    // Dupl code [5KFEWR7]
    if (this.isGone) return;
    const isWide = this.isPageWide();
    if (isWide !== this.state.useWideLayout) {
      this.setState({ useWideLayout: isWide });
    }
  },

  isPageWide: function(store?: Store) {
    return store_getApproxPageWidth(store || this.state.store) > UseWideForumLayoutMinWidth;
  },

  setTopPeriod: function(period: TopTopicsPeriod) {
    this.setState({ topPeriod: period });
  },

  getActiveCategory: function(currentCategorySlug: string) {
    const store: Store = this.state.store;
    const forumPage: Page = store.currentPage;
    let activeCategory: any;
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
      };
    }
    return activeCategory;
  },

  setCategory: function(newCategorySlug) {
    const [forumPath, routes] = this.getForumPathAndRoutes();
    const sortOrderRoute = routes[0];
    const currentPath = sortOrderRoute;
    const nextPath = currentPath === RoutePathCategories ? RoutePathLatest : currentPath;
    const slashSlug = newCategorySlug ? '/' + newCategorySlug : '';
    this.props.history.push({
      pathname: forumPath + nextPath + slashSlug,
      search: this.props.location.search,
    });
  },

  editCategory: function() {
    const [forumPath, routes] = this.getForumPathAndRoutes();
    const currentCategorySlug = routes[1];
    const activeCategory = this.getActiveCategory(currentCategorySlug);
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
    const store: Store = this.state.store;
    const page: Page = store.currentPage;
    const forumPath = page.pagePath.value;
    // This is done this way because of how React-Router v3 was working. It was simpler
    // do do this than to totally-rewrite. Maybe refactor-&-simplify some day?
    // Remove e.g. a '/forum/' prefix to the 'top/ideas' or 'new/bugs' whatever suffix:
    const pathRelForumPage = this.props.location.pathname.replace(forumPath, '');
    // This becomes e.g. ['new', 'ideas']:
    const routes = pathRelForumPage.split('/');
    return [forumPath, routes];
  },

  render: function() {
    const store: Store = this.state.store;
    const page: Page = store.currentPage;

    if (page.pageRole !== PageRole.Forum) {
      // We're navigating from a discussion topic to the forum page (= topic list page).
      // The url was just updated to show the addr of the forum page, but we're not yet
      // done updating React's state: `page` is still the discussion topic. Wait
      // until `page` becomes the forum page.
      return r.div({ className: 'container dw-forum' }, t.Loading + ' [TyM2EPKB04]');
    }

    const [forumPath, routes] = this.getForumPathAndRoutes();

    const sortOrderRoute = routes[0];
    switch (sortOrderRoute) {
      case RoutePathLatest: break;
      case RoutePathNew: break;
      case RoutePathTop: break;
      case RoutePathCategories: break;
      default:
        return r.p({}, `Bad route in the URL: '${sortOrderRoute}' [EdE2WKB4]`);
    }
    const currentCategorySlug = routes[1];
    const activeCategory = this.getActiveCategory(currentCategorySlug);
    const layout = store.currentPage.pageLayout;

    const childProps = _.assign({}, {
      store: store,
      forumPath,
      useTable: this.state.useWideLayout && layout != TopicListLayout.NewsFeed,
      sortOrderRoute,
      queryParams: parseQueryString(this.props.location.search),
      activeCategory: activeCategory,
      setCategory: this.setCategory,
      editCategory: this.editCategory,
      topPeriod: this.state.topPeriod,
      setTopPeriod: this.setTopPeriod,
    });

    /* Remove this? Doesn't look nice & makes the categories page look complicated.
    var topsAndCatsHelp = this.props.sortOrderRoute === RoutePathCategories
      ? HelpMessageBox({ message: topicsAndCatsHelpMessage, className: 'esForum_topicsCatsHelp' })
      : null; */

    const rootSlash = forumPath;
    const childRoutes = r.div({},
      Switch({},
        RedirToNoSlash({ path: rootSlash + RoutePathLatest + '/' }),
        RedirToNoSlash({ path: rootSlash + RoutePathNew + '/' }),
        RedirToNoSlash({ path: rootSlash + RoutePathTop + '/' }),
        RedirToNoSlash({ path: rootSlash + RoutePathCategories + '/' }),
        // [React_Router_v51] skip render(), use hooks and useParams instead.
        Route({ path: rootSlash + RoutePathCategories, exact: true, strict: true, render: (props) => {
          const propsWithRouterStuff = { ...childProps, ...props, isCategoriesRoute: true };
          return r.div({},
            ForumButtons(propsWithRouterStuff),
            LoadAndListCategories(propsWithRouterStuff));
        }}),
        Route({ path: rootSlash + ':sortOrder?/:categorySlug?', strict: true, render: (props) => {
          const propsWithRouterStuff = { ...childProps, ...props };
          return r.div({},
            ForumButtons(propsWithRouterStuff),
            LoadAndListTopics(propsWithRouterStuff));
        }})));
    /* SHOULD instead of the below, throw? show? some error, if invalid sort order or bad cat name
        Route({ path: rootSlash, component: LoadAndListTopics }),
        Route({ path: rootSlash + RoutePathLatest, component: LoadAndListTopics }),
        Route({ path: rootSlash + RoutePathNew, component: LoadAndListTopics }),
        Route({ path: rootSlash + RoutePathTop, component: LoadAndListTopics })));
        */

    const navConf: BrowserCode = store.settings.navConf || {};

    return (
      r.div({ className: 'container dw-forum' },
        debiki2.page.Title({ store }),
        ForumIntroText({ store }),
        //topsAndCatsHelp,
        childRoutes));
  }
});


/* ? Remove ?
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
    const page: Page = store.currentPage;
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
        r.div({ className: 'esForumIntro' },
          r.div({ dangerouslySetInnerHTML: { __html: introPost.sanitizedHtml }}),
          anyForumIntroButtons));
  }
});


const wideMinWidth = 801;

const ForumButtons = createComponent({
  displayName: 'ForumButtons',
  mixins: [utils.WindowZoomResizeMixin],

  getInitialState: function() {
    return {
      compact: window.innerWidth < wideMinWidth,
    };
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  onWindowZoomOrResize: function() {
    const newCompact = window.innerWidth < wideMinWidth;
    if (this.state.compact !== newCompact) {
      this.setState({ compact: newCompact });
    }
  },

  setSortOrder: function(newPath: string) {
    const store: Store = this.props.store;
    this.props.history.push({
      pathname: this.props.forumPath + newPath + this.slashCategorySlug(),
      search: this.props.location.search,
    });
  },

  getSortOrderName: function(sortOrderRoutePath?: string) {
    if (!sortOrderRoutePath) {
      sortOrderRoutePath = this.props.sortOrderRoute;
    }
    const store: Store = this.props.store;
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
    const newQuery: any = { ...this.props.queryParams };
    if (entry.eventKey === FilterShowAll) {
      delete newQuery.filter;
    }
    else {
      newQuery.filter = entry.eventKey;
    }
    this.props.history.push({
      pathname: this.props.location.pathname,
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

  slashCategorySlug: function() {
    const slug = this.props.activeCategory.slug;
    return slug ? '/' + slug : '';
  },

  render: function() {
    const state = this.state;
    const store: Store = this.props.store;
    const settings: SettingsVisibleClientSide = store.settings;
    const me: Myself = store.me;
    const showsCategoryTree: boolean = this.props.isCategoriesRoute;
    const activeCategory: Category = this.props.activeCategory;
    if (!activeCategory) {
      // The user has typed a non-existing category slug in the URL. Or she has just created
      // a category, opened a page and then clicked Back in the browser. Then this page
      // reloads, and the browser then uses cached HTML including JSON in which the new
      // category does not yet exist. Let's try to reload the category list page:
      // (However, if user-specific-data hasn't yet been activated, the "problem" is probably
      // just that we're going to show a restricted category, which isn't available before
      // user specific data added. (6KEWM02). )
      // Or hen is not allowed to access the category.
      return !store.userSpecificDataAdded ? null : r.p({},
          r.br(),
          "Category not found. Did you just create it? Or renamed it? Or you may not " +
          "access it? Maybe it doesn't exist? [_TyE0CAT]",  // (4JKSWX2)
          r.br(), r.br(),
          PrimaryLinkButton({ href: '/' }, "Go to the homepage"));
    }

    const queryParams = this.props.queryParams;
    const showsTopicList = !showsCategoryTree;

    const showFilterButton = settings_showFilterButton(settings, me);
    const topicFilterFirst = true; //me_uiPrefs(me).fbs !== UiPrefsForumButtons.CategoryDropdownFirst; CLEAN_UP

    // A tester got a little bit confused in the categories view, because it starts with
    // the filter-*topics* button. So insert this title, before, instead.
    const anyPageTitle = showsCategoryTree || (topicFilterFirst && !showFilterButton) ?
        r.div({ className: 'esF_BB_PageTitle' },
          showsCategoryTree ? t.Categories : t.Topics) : null;

    const makeCategoryLink = (where, text, linkId, extraClass?) => NavLink({
      to: { pathname: this.props.forumPath + where, search: this.props.location.search },
      id: linkId,
      className: 'btn esForum_catsNav_btn ' + (extraClass || ''),
      activeClassName: 'active' }, text);

    let omitCategoryStuff = showsCategoryTree || !settings_showCategories(store.settings, me);
    let categoryTreeLink = omitCategoryStuff ? null :
      makeCategoryLink(RoutePathCategories, t.fb.ViewCategories, 'e_ViewCatsB', 'esForum_navLink');

    // COULD remember which topics were listed previously and return to that view.
    // Or would a Back btn somewhere be better?
    const topicListLink = showsTopicList ? null :
      makeCategoryLink(RoutePathLatest, t.fb.TopicList, 'e2eViewTopicsB', 'esForum_navLink');

    // The Latest/Top/Categories buttons, but use a dropdown if there's not enough space.
    const currentSortOrderPath = this.props.sortOrderRoute;
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
            ExplainingListItem({ onClick: () => this.setSortOrder(RoutePathLatest),
                active: currentSortOrderPath === RoutePathLatest,
                title: this.getSortOrderName(RoutePathLatest),
                text: t.fb.ActiveDescr }),
            ExplainingListItem({ onClick: () => this.setSortOrder(RoutePathTop),
                active: currentSortOrderPath === RoutePathTop,
                title: this.getSortOrderName(RoutePathTop),
                text: t.fb.TopDescr }),
            ExplainingListItem({ onClick: () => this.setSortOrder(RoutePathNew),
              active: currentSortOrderPath === RoutePathNew,
              title: this.getSortOrderName(RoutePathNew),
              text: t.fb.NewDescr })));
    }
    else {
      const slashSlug = this.slashCategorySlug();
      latestNewTopButton =
          r.ul({ className: 'nav esForum_catsNav_sort' },
            makeCategoryLink(RoutePathLatest + slashSlug, this.getSortOrderName(RoutePathLatest),
                'e2eSortLatestB'),
            makeCategoryLink(RoutePathTop + slashSlug, this.getSortOrderName(RoutePathTop),
                'e2eSortTopB'),
            makeCategoryLink(RoutePathNew + slashSlug, this.getSortOrderName(RoutePathNew),
                'e_SortNewB'));
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
    const activeOrDefCat: Category | U =
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

    const filterAndSortButtons = /*topicFilterFirst
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



const LoadAndListTopics = createFactory({
  displayName: 'LoadAndListTopics',
  mixins: [debiki2.StoreListenerMixin],

  getInitialState: function(): any {
    // The server has included in the Flux store a list of the most recent topics, and we
    // can use that lis when rendering the topic list server side, or for the first time
    // in the browser (but not after that, because then new topics might have appeared).
    if (this.canUseTopicsInScriptTag()) {
      const store: Store = this.props.store;
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
    const store: Store = this.props.store;
    const category: Category = this.props.activeCategory;
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
    const store: Store = this.props.store;
    if (!store.topics || this.props.topicsInStoreMightBeOld)
      return false;

    const topicFilter = this.props.queryParams.filter;

    // The server includes topics for the active-topics sort order, all categories.
    return this.props.sortOrderRoute === RoutePathLatest &&
        (!topicFilter || topicFilter === FilterShowAll) &&
        !this.props.match.params.categorySlug;
  },

  componentDidMount: function() {
    // This happens when navigating back to the lates-topics list after having shown
    // all categories (plus on initial page load).
    this.loadTopics(this.props, false);
    this.maybeRunTour();
  },

  maybeRunTour: function() {
    const store: Store = this.props.store;
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

  loadTopics: function(nextProps, loadMore) {
    if (!nextProps.activeCategory) {
      // Probably a restricted category, won't be available until user-specific-data
      // has been activated (by ReactStore.activateMyself). (6KEWM02)
      return;
    }

    const isNewView =
      this.props.location.pathname !== nextProps.location.pathname ||
      this.props.location.search !== nextProps.location.search ||
      this.props.topPeriod !== nextProps.topPeriod;

    const store: Store = nextProps.store;
    let currentPageIsForumPage;
    _.each(store.pagesById, (page: Page) => {
      if (page.pagePath.value !== this.props.forumPath)
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
      this.setState({
        minHeight: null,
        categoryId: response.categoryId,
        categoryParentId: response.categoryParentId,
        topics: topics,
        showLoadMoreButton: newlyLoadedTopics.length >= NumNewTopicsPerRequest
      });

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

  getOrderOffset: function(nextProps?) {
    const props = nextProps || this.props;
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
    return TopicsList({
      categoryId: this.state.categoryId,              // why this, (406826)
      categoryParentId: this.state.categoryParentId,  //
      topics: this.state.topics,
      store: this.props.store,
      forumPath: this.props.forumPath,
      useTable: this.props.useTable,
      minHeight: this.state.minHeight,
      showLoadMoreButton: this.state.showLoadMoreButton,
      loadMoreTopics: this.loadMoreTopics,
      activeCategory: this.props.activeCategory,   // and also this? (406826)
      setCategory: this.props.setCategory,
      editCategory: this.props.editCategory,
      orderOffset: this.getOrderOffset(),
      topPeriod: this.props.topPeriod,
      setTopPeriod: this.props.setTopPeriod,
      linkCategories: true,
      sortOrderRoute: this.props.sortOrderRoute,
    });
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
    ReactActions.showSingleHelpMessageAgain(IconHelpMessage.id);
  },

  render: function() {
    const store: Store = this.props.store;
    const me: Myself = store.me;
    const topics: Topic[] = this.props.topics;
    const activeCategory: Category = this.props.activeCategory;
    if (!activeCategory) {
      // The category doesn't exist, or it's restricted, and maybe included in the
      // user specific json. When the user specific json has been activated, either the
      // category will exist and we won't get to here again, or a "category not found" message
      // will be displayed (4JKSWX2). — But don't show any "Loading..." message here.
      return null;
    }
    if (!topics) {
      // The min height preserves scrollTop, even though the topic list becomes empty
      // for a short while (which would otherwise reduce the windows height which
      // in turn might reduce scrollTop).
      // COULD make minHeight work when switching to the Categories view too? But should
      // then probably scroll the top of the categories list into view.
      // COULD use store.topics, used when rendering server side, but for now:
      return r.p({ style: { minHeight: this.props.minHeight } }, t.Loading);
    }

    const useTable = this.props.useTable;
    const orderOffset: OrderOffset = this.props.orderOffset;

    const topicElems = topics.map((topic: Topic) => {
      return TopicRow({
          store, topic, categories: store.currentCategories, activeCategory, orderOffset,
          key: topic.pageId, sortOrderRoute: this.props.sortOrderRoute,
          inTable: useTable, forumPath: this.props.forumPath });
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
        : r.li({ key: 'ExplIcns', className: 'esF_TsL_T clearfix' }, iconsHelpStuff));

    let loadMoreTopicsBtn;
    if (this.props.showLoadMoreButton) {
      const queryString = '?' + debiki2.ServerApi.makeForumTopicsQueryParams(orderOffset);
      loadMoreTopicsBtn =
        r.div({},
          r.a({ className: 'load-more', href: queryString, onClick: (event) => {
            event.preventDefault();
            this.props.loadMoreTopics();
          } }, t.LoadMore));
    }

    let topTopicsPeriodButton;
    if (orderOffset.sortOrder === TopicSortOrder.ScoreAndBumpTime) {
      const makeTopPeriodListItem = (period: TopTopicsPeriod, text?: string) => {
        return ExplainingListItem({ onSelect: () => this.props.setTopPeriod(period),
          activeEventKey: this.props.topPeriod, eventKey: period,
          title: topPeriod_toString(period),
          text: text });
      };

      topTopicsPeriodButton = r.div({},
          r.span({ className: 'esForum_sortInfo' }, t.ft.PopularTopicsComma),
          ModalDropdownButton({ className: 'esForum_sortInfo s_F_SI_TopB', pullLeft: true,
              title: r.span({},
                topPeriod_toString(this.props.topPeriod) + ' ', r.span({ className: 'caret' })) },
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

    const deletedClass = !activeCategory.isDeleted ? '' : ' s_F_Ts-CatDd';
    const anyDeletedCross = !activeCategory.isDeleted ? null : r.div({ className: 's_Pg_DdX' });
    const categoryDeletedInfo = !activeCategory.isDeleted ? null :
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
        r.table({ className: 'esF_TsT s_F_Ts-Wide dw-topic-list' + deletedClass },
          r.thead({},
            r.tr({},
              r.th({}, topicsHeaderText),
              categoryHeader,
              r.th({ className: 's_F_Ts_T_Avs' }, t.Users),
              r.th({ className: 'num dw-tpc-replies' }, t.Replies),
              r.th({ className: 'num' }, activityHeaderText))),
              // skip for now:  r.th({ className: 'num' }, "Feelings"))),  [8PKY25]
          r.tbody({},
            topicElems));

    const topicRows = useTable ? null :
        r.ol({ className: 'esF_TsL s_F_Ts-Nrw' + deletedClass },
          topicElems);

    // Show a category title and description.
    // Otherwise people tend to not notice that they are inside a category.
    // And they typically do *not* see any about-category pinned topic
    // (like Discourse does — don't do that).
    let categoryNameDescr = !settings_showCategories(store.settings, me) ||
        this.props.skipCatNameDescr ? null :
      CatNameDescr({ store, activeCategory, setCategory: this.props.setCategory,
          editCategory: this.props.editCategory });

    return (
      r.div({ className: 's_F_Ts e_SrtOrdr-' + orderOffset.sortOrder },
        categoryDeletedInfo,
        topTopicsPeriodButton,
        r.div({ style: { position: 'relative' }},
          anyDeletedCross,
          categoryNameDescr,
          topicsTable || topicRows),
        topics.length ? null :
          r.div({ className: 's_F_Ts_NoTopics', id: 'e2eF_NoTopics' }, t.NoTopics),
        loadMoreTopicsBtn));
  }
});


function CatNameDescr(props: { store: Store, activeCategory: Category,
      setCategory, editCategory }) {
  const store: Store = props.store;
  const me: Myself = store.me;
  const activeCategory: Category = props.activeCategory;

  const catsActiveLast = store_ancestorsCategoriesCurrLast(store, activeCategory.id);

  // catsActiveLast is empty, if we haven't selected any category. Then, currently,
  // activeCategory is a dummy category for the whole site section. (What about
  // using the root category (include it in the json from the server) instead?)
  const baseCat: Category = catsActiveLast[0] || activeCategory;
  const anySubCat: Category | undefined = catsActiveLast[1];
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
        catsSameLevel: Category[], thisCat: Category, isSubCat: boolean, isLastCat: boolean) {

    if (!catsSameLevel.length)
      return null;

    const categoryMenuItems = catsSameLevel.map((category: Category) => {
      return MenuItem({ key: category.id, active: thisCat && thisCat.id === category.id,
          onClick: () => props.setCategory(category.slug) },
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
    const store: Store = this.props.store;
    const sortOrderPath = this.props.sortOrderRoute;
    // this.props.queryParams — later: could convert to query string, unless skipQuery === true
    return this.props.forumPath + sortOrderPath + '/' + category.slug;
  },

  render: function() {
    const store: Store = this.props.store;
    const page: Page = store.currentPage;
    const me = store.me;
    const settings = store.settings;
    const topic: Topic = this.props.topic;
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

    let excerpt;  // [7PKY2X0]
    const showExcerptAsParagraph =
        topic.pinWhere === PinPageWhere.Globally ||
        (topic.pinWhere && topic.categoryId === this.props.activeCategory.id) ||
        page.pageLayout >= TopicListLayout.ExcerptBelowTitle;
    if (showExcerptAsParagraph) {
      excerpt =
          r.p({ className: 'dw-p-excerpt' }, topic.excerpt);
          // , r.a({ href: topic.url }, 'read more')); — no, better make excerpt click open page?
    }
    else if (page.pageLayout === TopicListLayout.TitleExcerptSameLine) {
      excerpt =
          r.span({ className: 's_F_Ts_T_Con_B' }, topic.excerpt);
    }
    else {
      // No excerpt.
      dieIf(page.pageLayout && page.pageLayout !== TopicListLayout.TitleOnly,
          'EdE5FK2W8');
    }

    let anyThumbnails;
    if (page.pageLayout === TopicListLayout.ThumbnailLeft) {
      die('Unimplemented: thumbnail left [EdE7KW4024]')
    }
    else if (page.pageLayout >= TopicListLayout.ThumbnailsBelowTitle) {
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

    let titleReactFn = Link;
    let contentReactFn = r.div;
    let contentLinkUrl;
    let manyLinesClass = '';
    let showMoreClickHandler;
    if (showExcerptAsParagraph) {
      manyLinesClass = ' s_F_Ts_T_Con-Para';
      // Make the whole title and paragraph block a link, not just the title.
      titleReactFn = r.span;
      contentReactFn = Link;
      contentLinkUrl = topic.url;
    }
    else if (this.state.showMoreExcerpt) {
      manyLinesClass += ' s_F_Ts_T_Con-More';
    }
    else {
      manyLinesClass += ' s_F_Ts_T_Con-OneLine';
      showMoreClickHandler = this.showMoreExcerpt;
    }

    const orderOffset: OrderOffset = this.props.orderOffset;

    const activeAt = Link({ to: topic.url + FragActionHashScrollLatest },
        prettyLetterTimeAgo(
          orderOffset.sortOrder === TopicSortOrder.CreatedAt
            ? topic.createdAtMs
            : topic.bumpedAtMs || topic.createdAtMs));

    // We use a table layout, only for wide screens, because table columns = spacy.
    if (this.props.inTable) return (
      r.tr({ className: 'esForum_topics_topic e2eF_T' },  // (update BJJ CSS before renaming 'esForum_topics_topic' (!))
        r.td({ className: 'dw-tpc-title e2eTopicTitle' },
          contentReactFn({ className: 's_F_Ts_T_Con' + manyLinesClass,
              onClick: showMoreClickHandler, to: contentLinkUrl },
            makeTitle(topic, 's_F_Ts_T_Con_Ttl ' + anyPinOrHiddenIconClass,
                settings, me, titleReactFn),
            excerpt),
          anyThumbnails),
        !showCategories ? null : r.td({ className: 's_F_Ts_T_CN' }, categoryName),
        r.td({ className: 's_F_Ts_T_Avs' }, userAvatars),
        r.td({ className: 'num dw-tpc-replies' }, topic.numPosts - 1),
        r.td({ className: 'num dw-tpc-activity', title: activityTitle }, activeAt)));
        // skip for now:  r.td({ className: 'num dw-tpc-feelings' }, feelings)));  [8PKY25]
    else return (
      r.li({ className: 'esF_TsL_T e2eF_T' },
        r.div({ className: 'esF_TsL_T_Title e2eTopicTitle' },
          makeTitle(topic, anyPinOrHiddenIconClass, settings, me)),
        r.div({ className: 'esF_TsL_T_NumRepls' },
          topic.numPosts - 1, r.span({ className: 'icon-comment-empty' })),
        excerpt,
        r.div({ className: 'esF_TsL_T_Row2' },
          r.div({ className: 'esF_TsL_T_Row2_Users' }, userAvatars),
          !showCategories ? null : r.div({ className: 'esF_TsL_T_Row2_Cat' },
            r.span({ className: 'esF_TsL_T_Row2_Cat_Expl' }, t.ft.inC), categoryName),
          r.span({ className: 'esF_TsL_T_Row2_When' }, activeAt)),
        anyThumbnails));
  }
});


function topic_mediaThumbnailUrls(topic: Topic): string[] {
  let bodyUrls = topic.firstImageUrls || [];
  let allUrls = bodyUrls.concat(topic.popularRepliesImageUrls || []);
  let noGifs = _.filter(allUrls, (url) => url.toLowerCase().indexOf('.gif') === -1);
  return _.uniq(noGifs);
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

  UNSAFE_componentWillReceiveProps: function(nextProps) {
    this.loadCategories(nextProps);
  },

  componentDidUpdate: function() {
    processTimeAgo();
  },

  loadCategories: function(props) {
    const store: Store = props.store;
    Server.loadForumCategoriesTopics(store.currentPageId, props.queryParams.filter,
        (categories: Category[]) => {
      if (this.isGone) return;
      this.setState({ categories: categories });
    });
  },

  render: function() {
    const store: Store = this.props.store;
    const categories: Category[] = this.state.categories;
    if (!categories)
      return r.p({}, t.Loading);

    const siteSection: SiteSection =
        store.siteSections.find(s => s.pageId === store.currentPageId);

    const topLevelCats = categories.filter(c => c.parentId === siteSection.rootCategoryId);

    const categoryRows = topLevelCats.map((category: Category) => {
      const childCategories = categories.filter(c => c.parentId === category.id);
      arr_sortAlphaInPlace(childCategories, c => c.name);
      return CategoryRow({ store: this.props.store, location: this.props.location,
          forumPath: this.props.forumPath, category: category, childCategories, siteSection,
          key: category.id });
    });

    let recentTopicsColumnTitle;
    switch (this.props.queryParams.filter) {
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
  return Link({ to: {
      pathname: forumPath + RoutePathLatest + '/' + category.slug,
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
  else if (topic.pageRole === PageRole.OpenChat) {
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
          to: toUrl, title: tooltip, className: className },
        title));
}


function createTopicBtnTitle(category: Category) {
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


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list

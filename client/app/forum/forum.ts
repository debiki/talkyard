/*
 * Copyright (c) 2015-2017 Kaj Magnus Lindberg
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
/// <reference path="../more-bundle-not-yet-loaded.ts" />
/// <reference path="../editor-bundle-not-yet-loaded.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.forum {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const ModalDropdownButton = utils.ModalDropdownButton;
const ExplainingListItem = util.ExplainingListItem;
type ExplainingTitleText = util.ExplainingTitleText;
const HelpMessageBox = debiki2.help.HelpMessageBox;

const MaxWaitingForCritique = 10; // for now only [plugin]

/** Keep in sync with app/controllers/ForumController.NumTopicsToList. */
const NumNewTopicsPerRequest = 40;

const FilterShowAll = 'ShowAll';
const FilterShowWaiting = 'ShowWaiting';
const FilterShowDeleted = 'ShowDeleted';


/*
export function buildServerSideForumRoute(forumPath: string) {
  const store: Store = ReactStore.allData();
  const rootSlash = forumPath;
  const defaultPath = rootSlash + (store.settings.forumMainView || RoutePathLatest);

  // later, COULD incl top period in URL, perhaps: top/ —> top-past-day/
  // Or  /top/bugs/past-day/ or /top/bugs?period=PastDay

  return Route({ path: rootSlash, component: ForumComponent });

  /* Old:
  return Switch({},
    // This redirects e.g. '/forum/' and '/forum' to '/forum/latest':  <— not needed? This is server side
    Redirect({ path: rootSlash, to: defaultPath, exact: true }),
    Route({ path: rootSlash, component: ForumComponent })); * /
} */


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
  setTimeout(function() {
    $byId('esPageColumn').scrollTop = scrollToWhenCommentsLoaded || 0;
    scrollToWhenCommentsLoaded = 0;
  });
}


export const ForumComponent = createReactClass(<any> {
  displayName: 'ForumComponent',
  mixins: [StoreListenerMixin, utils.PageScrollMixin],

  getInitialState: function() {
    const store: Store = debiki2.ReactStore.allData();
    return {
      store: store,
      topicsInStoreMightBeOld: false,
      useWideLayout: this.isPageWide(store),
      topPeriod: TopTopicsPeriod.Month,
    }
  },

  onChange: function() {
    this.setState({
      store: debiki2.ReactStore.allData(),
      // Now some time has passed since this page was loaded, so:
      topicsInStoreMightBeOld: true,
    });
  },

  componentDidMount: function() {
    ReactActions.maybeLoadAndShowNewPage(this.state.store, this.props.history, this.props.location);
    scrollToWhenCommentsLoaded = lastScrollYByPath[this.props.location.pathname] || 0;
    lastScrollYByPath = {};
    // Dupl code [5KFEWR7]
    this.timerHandle = setInterval(this.checkSizeChangeLayout, 200);
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
        name: "All categories",
        id: forumPage.categoryId, // the forum root category
        isForumItself: true,
        newTopicTypes: [],
      };
    }
    return activeCategory;
  },

  makeHelpMessage: function(category: Category): any {
    const store: Store = this.state.store;
    const me: Myself = store.me;
    if (!_.isEqual(category.newTopicTypes, [PageRole.Critique])) // [plugin] ...
      return null;

    if (!me.isAuthenticated)
      return { id: 'EdHKEW21', version: 1, content: r.span({},
          r.p({}, "Click ", r.b({}, "Log In"), ", to the right just above.")) };

    // For now only.  [85SKW32]
    if (this.state.numWaitingForCritique >= MaxWaitingForCritique) //  [plugin]
      return { id: 'Es5GUPM2', version: 1, alwaysShow: true, isWarning: true, content: r.span({},
        r.p({}, r.b({}, "You cannot currently ask for critique"),
          " — too many topics waiting for critique already."),
        r.p({}, "Check back later. Or send an email to me, kaj.magnus.lindberg at gmail dot com, " +
          "and tell me to notify you when you can ask for critique again.")) };

    // if too-few-topics then
    return { id: 'EdH4KBP2', version: 1, content: r.span({},  // [plugin]
        r.p({}, "You can click ", r.b({}, "Ask for Critique"), " (to the right just below)."),
        r.p({}, "(Normally, you would need to first help others and gather credits, " +
          "before you can ask for critique yourself. But right now there are few " +
          "open topics here, so you can ask directly instead.)")) };

    // enough credits: [plugin]:
    // return { id: 'EdH8PU01', version: 1, content: r.span({}, "Click Ask for Critique") };
    // else:
    // return { id: 'EdH4KGU0', version: 1, content:
    //   Select a topic that you'd like to critique:
    //    (You need credits, before you can ask for critique yourself — and you get credits, by
    //    critiquing to others.)
    // }
  },

  render: function() {
    const store: Store = this.state.store;
    const forumPath = store.currentPage.pagePath.value;

    // This is done this way because of how React-Router v3 was working. It was simpler
    // do do this than to totally-rewrite. Maybe refactor-&-simplify some day?
    // Remove e.g. a '/forum/' prefix to the 'top/ideas' or 'new/bugs' whatever suffix:
    const pathRelForumPage = this.props.location.pathname.replace(forumPath, '');
    // This becomes e.g. ['new', 'ideas']:

    const routes = pathRelForumPage.split('/');
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

    let helpMessage = activeCategory ? this.makeHelpMessage(activeCategory) : null;
    helpMessage = helpMessage
        ? debiki2.help.HelpMessageBox({ message: helpMessage })
        : null;

    const childProps = _.assign({}, {
      store: store,
      forumPath,
      useTable: this.state.useWideLayout,
      sortOrderRoute,
      queryParams: parseQueryString(this.props.location.search),
      activeCategory: activeCategory,
      topPeriod: this.state.topPeriod,
      setTopPeriod: this.setTopPeriod,
      numWaitingForCritique: this.state.numWaitingForCritique,  // for now only [plugin]
      setNumWaitingForCritique: (numWaiting) => {               // for now only [plugin]
        if (this.state.numWaitingForCritique !== numWaiting)
          this.setState({ numWaitingForCritique: numWaiting });
      },
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

    return (
      r.div({ className: 'container dw-forum' },
        // Include .dw-page to make renderDiscussionPage() in startup.js run: (a bit hacky)
        r.div({ className: 'dw-page' }),
        ForumIntroText({ store: store }),
        helpMessage,
        //topsAndCatsHelp,
        childRoutes));
  }
});


const topicsAndCatsHelpMessage = {
  id: 'EsH4YKG81',
  version: 1,
  content: r.span({},
    "A ", r.i({}, r.b({}, "category")), " is a group of topics. " +
    "A ", r.i({}, r.b({}, "topic")), " is a discussion or question."),
};


const ForumIntroText = createComponent({
  displayName: 'ForumIntroText',

  render: function() {
    const store: Store = this.props.store;
    const page: Page = store.currentPage;
    const user: Myself = store.me;
    const introPost = page.postsByNr[BodyNr];
    if (!introPost || introPost.isBodyHidden)
      return null;

    const anyEditIntroBtn = user.isAdmin
        ? r.a({ className: 'esForumIntro_edit icon-edit',
              onClick: morebundle.openEditIntroDialog }, "Edit")
        : null;

    return r.div({ className: 'esForumIntro' },
      r.div({ dangerouslySetInnerHTML: { __html: introPost.sanitizedHtml }}),
      r.div({ className: 'esForumIntro_btns' },
        anyEditIntroBtn,
        r.a({ className: 'esForumIntro_close', onClick: () => ReactActions.showForumIntro(false) },
          r.span({ className: 'icon-cancel' }, "Hide"),
          r.span({ className: 'esForumIntro_close_reopen' },
            ", click ", r.span({ className: 'icon-info-circled dw-forum-intro-show' }),
              " to reopen"))));
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

  setCategory: function(newCategorySlug) {
    const store: Store = this.props.store;
    const currentPath = this.props.sortOrderRoute;
    const nextPath = currentPath === RoutePathCategories ? RoutePathLatest : currentPath;
    const slashSlug = newCategorySlug ? '/' + newCategorySlug : '';
    this.props.history.push({
      pathname: this.props.forumPath + nextPath + slashSlug,
      search: this.props.location.search,
    });
  },

  findTheDefaultCategory: function() {
    const store: Store = this.props.store;
    return _.find(store.currentCategories, (category: Category) => {
      return category.isDefaultCategory;
    });
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
      case RoutePathLatest: return showTopicFilter ? "Active" : "Active topics";
      case RoutePathNew: return showTopicFilter ? "New" : "New topics";
      case RoutePathTop: return showTopicFilter ? "Top" : "Popular topics";
      default: return null;
    }
  },

  setTopicFilter: function(entry: ExplainingTitleText) {
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

  editCategory: function() {
    morebundle.getEditCategoryDialog(dialog => {
      if (this.isGone) return;
      dialog.open(this.props.activeCategory.id);
      // BUG needs to call this.setCategory(edited-category.slug), if slug changed. [7AFDW01]
    });
  },

  createCategory: function() {
    morebundle.getEditCategoryDialog(dialog => {
      if (this.isGone) return;
      dialog.open();
    });
  },

  createTopic: function() {
    const anyReturnToUrl = window.location.toString().replace(/#/, '__dwHash__');
    morebundle.loginIfNeeded('LoginToCreateTopic', anyReturnToUrl, () => {
      if (this.isGone) return;
      let category: Category = this.props.activeCategory;
      if (category.isForumItself) {
        category = this.findTheDefaultCategory();
        dieIf(!category, "No Uncategorized category [DwE5GKY8]");
      }
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
      // Or hen renamed the slug of an existing category. [7AFDW01]
      // Or hen is not allowed to access the category.
      return !store.userSpecificDataAdded ? null : r.p({},
          r.br(),
          "Category not found. Did you just create it? Or renamed it? Or you're not allowed " +
          "to access it? Or perhaps it doesn't exist? [EdE0CAT]",  // (4JKSWX2)
          r.br(), r.br(),
          PrimaryLinkButton({ href: '/' }, "Go to the homepage"));
    }

    const queryParams = this.props.queryParams;
    const showsTopicList = !showsCategoryTree;

    // A tester got a little bit confused in the categories view, because it starts with
    // the filter-*topics* button. So insert this title, before, instead.
    const anyPageTitle = showsCategoryTree ?
        r.div({ className: 'esF_BB_PageTitle' }, "Categories") : null;

    const makeCategoryLink = (where, text, linkId, extraClass?) => NavLink({
      to: { pathname: this.props.forumPath + where, search: this.props.location.search },
      id: linkId,
      className: 'btn esForum_catsNav_btn ' + (extraClass || ''),
      activeClassName: 'active' }, text);

    let omitCategoryStuff = showsCategoryTree || !settings_showCategories(store.settings, me);
    let categoryTreeLink = omitCategoryStuff ? null :
      makeCategoryLink(RoutePathCategories, "Categories", 'e2eViewCategoriesB', 'esForum_navLink');

    // COULD remember which topics were listed previously and return to that view.
    // Or would a Back btn somewhere be better?
    const topicListLink = showsTopicList ? null :
      makeCategoryLink(RoutePathLatest, "Topic list", 'e2eViewTopicsB', 'esForum_navLink');

    const categoryMenuItems = store.currentCategories.map((category: Category) => {
      return MenuItem({ key: category.id, active: activeCategory.id === category.id,
          onClick: () => this.setCategory(category.slug) },
            r.span({ className: category_iconClass(category, store) }, category.name));
    });

    const listsTopicsInAllCats =
        // We list topics?
        !showsCategoryTree &&
        // No category selected?
        activeCategory.isForumItself;

    categoryMenuItems.unshift(
        MenuItem({ key: -1, active: listsTopicsInAllCats,
          onClick: () => this.setCategory('') }, "All categories"));

    const activeCategoryIcon = category_iconClass(activeCategory, store);

    let categoriesDropdownButton = omitCategoryStuff ? null :
        ModalDropdownButton({ className: 'esForum_catsNav_btn esForum_catsDrop active', pullLeft: true,
            title: r.span({ className: activeCategoryIcon },
                activeCategory.name + ' ', r.span({ className: 'caret' })) },
          r.ul({ className: 'dropdown-menu s_F_BB_CsM' },
              categoryMenuItems));

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
            ExplainingListItem({ onClick: () => this.setSortOrder(RoutePathLatest),
                active: currentSortOrderPath === RoutePathLatest,
                title: this.getSortOrderName(RoutePathLatest),
                text: "Shows recently active topics first" }),
            ExplainingListItem({ onClick: () => this.setSortOrder(RoutePathNew),
              active: currentSortOrderPath === RoutePathNew,
              title: this.getSortOrderName(RoutePathNew),
              text: "Shows newest topics first" }),
            ExplainingListItem({ onClick: () => this.setSortOrder(RoutePathTop),
                active: currentSortOrderPath === RoutePathTop,
                title: this.getSortOrderName(RoutePathTop),
                text: "Shows popular topics first" })));
    }
    else {
      const slashSlug = this.slashCategorySlug();
      latestNewTopButton =
          r.ul({ className: 'nav esForum_catsNav_sort' },
            makeCategoryLink(RoutePathLatest + slashSlug, this.getSortOrderName(RoutePathLatest),
                'e2eSortLatestB'),
            makeCategoryLink(RoutePathNew + slashSlug, this.getSortOrderName(RoutePathNew),
                'e_SortNewB'),
            makeCategoryLink(RoutePathTop + slashSlug, this.getSortOrderName(RoutePathTop),
                'e2eSortTopB'));
    }

    // ------ The filter topics select.

    const showFilterButton = settings_showFilterButton(settings, me);

    const topicFilterValue = queryParams.filter || FilterShowAll;
    function makeTopicFilterText(filter) {
      switch (filter) {
        case FilterShowAll: return "All topics";
        case FilterShowWaiting: return "Only waiting";
        case FilterShowDeleted: return "Show deleted";
      }
      die('EsE4JK85');
    }

    const showDeletedFilterItem = !isStaff(me) || !showFilterButton ? null :
      ExplainingListItem({ onSelect: this.setTopicFilter,
        activeEventKey: topicFilterValue, eventKey: FilterShowDeleted,
        title: makeTopicFilterText(FilterShowDeleted),
        text: "Shows all topics, including deleted topics" });

    const topicFilterButton = !showFilterButton ? null :
      ModalDropdownButton({ className: 'esForum_filterBtn esForum_catsNav_btn', pullLeft: true,
          title: rFragment({},
            makeTopicFilterText(topicFilterValue) + ' ', r.span({ className: 'caret' })) },
        r.ul({},
          ExplainingListItem({ onSelect: this.setTopicFilter,
              activeEventKey: topicFilterValue, eventKey: FilterShowAll,
              title: "Show all topics",
              text: "Shows all forum topics" }),
          ExplainingListItem({ onSelect: this.setTopicFilter,
              activeEventKey: topicFilterValue, eventKey: FilterShowWaiting,
              title: makeTopicFilterText(FilterShowWaiting),
              text: r.span({},
                "Shows only questions ", r.b({}, r.i({}, "waiting")), " for a solution, " +
                "plus ideas and problems not yet handled" ) }),
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

    let createTopicBtn;
    const mayCreateTopics = store_mayICreateTopics(store, activeCategory);
    if (!showsCategoryTree && mayCreateTopics) {
     if (this.props.numWaitingForCritique < MaxWaitingForCritique)  // for now only [plugin]
      createTopicBtn = PrimaryButton({ onClick: this.createTopic, id: 'e2eCreateSth',
          className: 'esF_BB_CreateBtn'},
        createTopicBtnTitle(activeCategory));
    }

    let createCategoryBtn;
    if (showsCategoryTree && me.isAdmin) {
      createCategoryBtn = PrimaryButton({ onClick: this.createCategory, id: 'e2eCreateCategoryB' },
        "Create Category");
    }

    let editCategoryBtn;
    if (!activeCategory.isForumItself && me.isAdmin) {
      editCategoryBtn = Button({ onClick: this.editCategory, className: 'esF_BB_EditCat' },
        "Edit Category");
    }

    const whatClass = showsCategoryTree ? 's_F_BB-Cats' : 's_F_BB-Topics';

    return (
        r.div({ className: 'dw-forum-actionbar clearfix ' + whatClass },
          r.div({ className: 'esForum_catsNav' },
            anyPageTitle,
            categoriesDropdownButton,
            latestNewTopButton,
            topicFilterButton,
            categoryTreeLink,
            topicListLink),
          createTopicBtn,
          createCategoryBtn,
          editCategoryBtn));
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
    const store: Store = this.props.store;
    if (this.state.isLoading === undefined) {
      if (!this.canUseTopicsInScriptTag())
        return;

      // We're still using a copy of the topics list in the store, so update the copy,
      // maybe new user-specific data has been added.
      const category: Category = this.props.activeCategory;
      let topics;
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
    }
  },

  canUseTopicsInScriptTag: function() {
    const store: Store = this.props.store;
    if (!store.topics || this.props.topicsInStoreMightBeOld)
      return false;

    // The server includes topics for the active-topics sort order, all categories.
    return this.props.sortOrderRoute === RoutePathLatest &&
        !this.props.match.params.categorySlug;
  },

  componentDidMount: function() {
    // This happens when navigating back to the lates-topics list after having shown
    // all categories (plus on initial page load).
    this.loadTopics(this.props, false);
  },

  componentWillReceiveProps: function(nextProps) {
    // This happens when switching category or showing top topics instead of latest topics.
    this.loadTopics(nextProps, false);
  },

  componentDidUpdate: function() {
    rememberBackUrl(location.toString());
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  onLoadMoreTopicsClick: function(event) {
    this.loadTopics(this.props, true);
    event.preventDefault();
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

    this.countTopicsWaitingForCritique(); // for now only

    // Avoid loading the same topics many times:
    // - On page load, componentDidMount() and componentWillReceiveProps() both loads topics.
    // - When we're refreshing the page because of Flux events, don't load the same topics again.
    if (!isNewView && !loadMore && (this.state.topics || this.isLoading))
      return;

    const orderOffset: OrderOffset = this.getOrderOffset(nextProps);
    orderOffset.topicFilter = nextProps.queryParams.filter;
    if (isNewView) {
      this.setState({
        minHeight: ReactDOM.findDOMNode(this).clientHeight,
        topics: null,
        showLoadMoreButton: false
      });
      // Load from the start, no offset. Keep any topic filter though.
      delete orderOffset.olderThan;
      delete orderOffset.score;
    }
    const categoryId = nextProps.activeCategory.id;
    // Don't use this.state.isLoading, because the state change doesn't happen instantly,
    // so componentWillReceiveProps() would get called first, and it would call loadTopics again
    // while this.state.isLoading was still false, resulting in an unneeded server request.
    this.isLoading = true;
    debiki2.Server.loadForumTopics(categoryId, orderOffset, (newlyLoadedTopics: Topic[]) => {
      if (this.isGone) return;
      let topics: any = isNewView ? [] : (this.state.topics || []);
      topics = topics.concat(newlyLoadedTopics);
      // `topics` includes at least the last old topic twice.
      topics = _.uniqBy(topics, 'pageId');
      this.isLoading = false;
      this.setState({
        minHeight: null,
        topics: topics,
        showLoadMoreButton: newlyLoadedTopics.length >= NumNewTopicsPerRequest
      });
      this.countTopicsWaitingForCritique(topics); // for now only
      scrollToLastPositionSoon();
    });
  },

  countTopicsWaitingForCritique: function(topics?) { // for now only  [plugin]
    if (!this.props.activeCategory) return;
    topics = topics || this.state.topics;
    let numWaitingForCritique = 0;
    if (_.isEqual(this.props.activeCategory.newTopicTypes, [PageRole.Critique])) {
      const waitingTopics = _.filter(topics, (topic: Topic) =>
        !topic.closedAtMs && topic.pageRole === PageRole.Critique);
      numWaitingForCritique = waitingTopics.length;
      console.log(numWaitingForCritique + " topics waiting for critique. [EsM8PMU21]");
    }
    this.props.setNumWaitingForCritique(numWaitingForCritique);
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
      topics: this.state.topics,
      store: this.props.store,
      useTable: this.props.useTable,
      minHeight: this.state.minHeight,
      showLoadMoreButton: this.state.showLoadMoreButton,
      activeCategory: this.props.activeCategory,
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
      return r.p({ style: { minHeight: this.props.minHeight } }, "Loading...");
    }

    if (!topics.length)
      return r.p({ id: 'e2eF_NoTopics' }, 'No topics.');

    const useTable = this.props.useTable;
    const orderOffset: OrderOffset = this.props.orderOffset;

    const topicElems = topics.map((topic: Topic) => {
      return TopicRow({
          store, topic, categories: store.currentCategories, activeCategory, now: store.now, orderOffset,
          key: topic.pageId, sortOrderRoute: this.props.sortOrderRoute,
          inTable: useTable });
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
    const iconsHelpStuff = iconsHelpClosed || help.isHelpMessageClosed(store, IconHelpMessage)
        ? r.a({ className: 'esForum_topics_openIconsHelp icon-info-circled',
              onClick: this.openIconsHelp }, "Explain icons...")
        : HelpMessageBox({ message: IconHelpMessage, showUnhideTips: false });
    topicElems.splice(Math.min(topicElems.length, numFewTopics), 0,
      useTable
        ? r.tr({ key: 'ExplIcns' }, r.td({ colSpan: 5 }, iconsHelpStuff))
        : r.li({ key: 'ExplIcns', className: 'esF_TsL_T clearfix' }, iconsHelpStuff)); // (update BJJ CSS before changin this (!))

    let loadMoreTopicsBtn;
    if (this.props.showLoadMoreButton) {
      const queryString = '?' + debiki2.ServerApi.makeForumTopicsQueryParams(orderOffset);
      loadMoreTopicsBtn =
        r.div({},
          r.a({ className: 'load-more', onClick: this.onLoadMoreTopicsClick,
              href: queryString }, 'Load more ...'));
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
          r.span({ className: 'esForum_sortInfo' }, "Popular topics, "),
          ModalDropdownButton({ className: 'esForum_sortInfo s_F_SI_TopB', pullLeft: true,
              title: r.span({},
                topPeriod_toString(this.props.topPeriod) + ' ', r.span({ className: 'caret' })) },
            r.ul({ className: 'dropdown-menu' },
              makeTopPeriodListItem(TopTopicsPeriod.All,
                "Shows the most popular topics first, all time."),
              makeTopPeriodListItem(TopTopicsPeriod.Day,
                "Shows topics popular during the past day."),
              makeTopPeriodListItem(TopTopicsPeriod.Week),
              makeTopPeriodListItem(TopTopicsPeriod.Month),
              makeTopPeriodListItem(TopTopicsPeriod.Quarter),
              makeTopPeriodListItem(TopTopicsPeriod.Year))));
    }

    const deletedClass = !activeCategory.isDeleted ? '' : ' s_F_Ts-CatDd';
    const categoryDeletedInfo = !activeCategory.isDeleted ? null :
      r.p({ className: 'icon-trash s_F_CatDdInfo' },
        "This category has been deleted");

    let topicsHeaderText = "Topics";
    switch (orderOffset.sortOrder) {
      case TopicSortOrder.BumpTime: topicsHeaderText = "Topics, recently active first"; break;
      case TopicSortOrder.CreatedAt: topicsHeaderText = "Topics, newest first"; break;
    }

    const categoryHeader = !settings_showCategories(store.settings, me) ? null :
        r.th({ className: 's_F_Ts_T_CN' }, "Category");

    const activityHeaderText =
        orderOffset.sortOrder === TopicSortOrder.CreatedAt ? "Created" : "Activity";

    const topicsTable = !useTable ? null :
        r.table({ className: 'esF_TsT s_F_Ts-Wide dw-topic-list' + deletedClass },
          r.thead({},
            r.tr({},
              r.th({}, topicsHeaderText),
              categoryHeader,
              r.th({ className: 's_F_Ts_T_Avs' }, "Users"),
              r.th({ className: 'num dw-tpc-replies' }, "Replies"),
              r.th({ className: 'num' }, activityHeaderText))),
              // skip for now:  r.th({ className: 'num' }, "Feelings"))),  [8PKY25]
          r.tbody({},
            topicElems));

    const topicRows = useTable ? null :
        r.ol({ className: 'esF_TsL s_F_Ts-Nrw' + deletedClass },
          topicElems);

    return (
      r.div({},
        categoryDeletedInfo,
        topTopicsPeriodButton,
        topicsTable || topicRows,
        loadMoreTopicsBtn));
  }
});


const IconHelpMessage = {
  id: '5KY0W347',
  version: 1,
  content:
    r.div({ className: 'esTopicIconHelp' },
      r.p({ className: 'esTopicIconHelp_intro' }, "Icon explanation:"),
      r.ul({},
        r.li({},
          r.span({ className: 'icon-comment' },
            "A general discussion.")),
        r.li({},
          r.span({ className: 'icon-help-circled' },
            "A question with no accepted answer.")),
        r.li({},
          r.span({ className: 'icon-ok' },
            "A question with an accepted answer.")),
        r.li({},
          r.span({ className: 'icon-idea' },
            "An idea / suggestion.")),
        r.li({},
          r.span({ className: 'icon-attention-circled' },
            "A problem.")),
        r.li({},
          r.span({ className: 'icon-check-empty' },
            "Something we're planning to do or fix.")),
        r.li({},
          r.span({ className: 'icon-check' },
            "Something that's been done or fixed.")),
        /* r.li({}, disable mind maps [NOMINDMAPS]
          r.span({ className: 'icon-sitemap' },
            "A mind map.")),  */
        r.li({},
          r.span({ className: 'icon-block' },
            "Topic closed.")),
        r.li({},
          r.span({ className: 'icon-pin' },
            "Topic always listed first (perhaps only in its own category).")))),
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
    let activityTitle = "Created on " + whenMsToIsoDate(topic.createdAtMs);

    if (topic.lastReplyAtMs) {
      activityTitle += '\nLast reply on ' + whenMsToIsoDate(topic.lastReplyAtMs);
    }
    if (topic.bumpedAtMs && topic.bumpedAtMs !== topic.lastReplyAtMs) {
      activityTitle += '\nEdited on ' + whenMsToIsoDate(topic.bumpedAtMs);
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
    else if (page.pageLayout === TopicListLayout.ThumbnailsBelowTitle) {
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
        avatar.Avatar({ key: 'OP', tiny: true, user: author, title: "created the topic" })];
    for (let i = 0; i < topic.frequentPosterIds.length; ++i) {
      const poster = store_getUserOrMissing(store, topic.frequentPosterIds[i], 'EsE2WK0F');
      userAvatars.push(avatar.Avatar({ key: poster.id, tiny: true, user: poster,
            title: "frequent poster" }));
    }
    if (topic.lastReplyerId) {
      const lastReplyer = store_getUserOrMissing(store, topic.lastReplyerId, 'EsE4GTZ7');
      userAvatars.push(avatar.Avatar({ key: 'MR', tiny: true, user: lastReplyer,
            title: "most recent poster" }));
    }

    let manyLinesClass = '';
    let showMoreClickHandler;
    if (showExcerptAsParagraph) {
      manyLinesClass = ' s_F_Ts_T_Con-Para';
    }
    else if (this.state.showMoreExcerpt) {
      manyLinesClass += ' s_F_Ts_T_Con-More';
    }
    else {
      manyLinesClass += ' s_F_Ts_T_Con-OneLine';
      showMoreClickHandler = this.showMoreExcerpt;
    }

    const orderOffset: OrderOffset = this.props.orderOffset;
    const activeAt = prettyLetterTimeAgo(orderOffset.sortOrder === TopicSortOrder.CreatedAt ?
        topic.createdAtMs : topic.bumpedAtMs || topic.createdAtMs);

    // We use a table layout, only for wide screens, because table columns = spacy.
    if (this.props.inTable) return (
      r.tr({ className: 'esForum_topics_topic e2eF_T' },  // (update BJJ CSS before renaming 'esForum_topics_topic' (!))
        r.td({ className: 'dw-tpc-title e2eTopicTitle' },
          r.div({ className: 's_F_Ts_T_Con' + manyLinesClass, onClick: showMoreClickHandler },
            makeTitle(topic, anyPinOrHiddenIconClass, settings, me),
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
            r.span({ className: 'esF_TsL_T_Row2_Cat_Expl' }, "in: "), categoryName),
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

  componentWillUnmount: function(nextProps) {
    this.isGone = true;
  },

  componentWillReceiveProps: function(nextProps) {
    this.loadCategories(nextProps);
  },

  componentDidUpdate: function() {
    processTimeAgo();
  },

  loadCategories: function(props) {
    const store: Store = props.store;
    debiki2.Server.loadForumCategoriesTopics(store.currentPageId, props.queryParams.filter,
        (categories: Category[]) => {
      if (this.isGone) return;
      this.setState({ categories: categories });
    });
  },

  render: function() {
    if (!this.state.categories)
      return r.p({}, "Loading...");

    const categoryRows = this.state.categories.map((category: Category) => {
      return CategoryRow({ store: this.props.store, location: this.props.location,
          forumPath: this.props.forumPath, category: category, key: category.id });
    });

    let recentTopicsColumnTitle;
    switch (this.props.queryParams.filter) {
      case FilterShowWaiting:
        recentTopicsColumnTitle = "Recent topics (those waiting)";
        break;
      case FilterShowDeleted:
        recentTopicsColumnTitle = "Recent topics (including deleted)";
        break;
      default:
        recentTopicsColumnTitle = "Recent topics";
    }

    return (
      r.table({ className: 'forum-table table' },
        r.thead({},
          r.tr({},
            r.th({}, "Category"),
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
      utils.scrollIntoViewInPageColumn(ReactDOM.findDOMNode(this));
    }
  },

  render: function() {
    const store: Store = this.props.store;
    const me: Myself = store.me;
    const category: Category = this.props.category;
    const recentTopicRows = category.recentTopics.map((topic: Topic) => {
      const pinIconClass = topic.pinWhere ? ' icon-pin' : '';
      const numReplies = topic.numPosts - 1;
      return (
        r.tr({ key: topic.pageId },
          r.td({},
            makeTitle(topic, 'topic-title' + pinIconClass, store.settings, me),
            r.span({ className: 'topic-details' },
              r.span({ title: numReplies + " replies" },
                numReplies, r.span({ className: 'icon-comment-empty' })),
              prettyLetterTimeAgo(topic.bumpedAtMs || topic.createdAtMs)))));
    });

    // This will briefly highlight a newly created category.
    const isNewClass = category.slug === store.newCategorySlug ?
      ' esForum_cats_cat-new' : '';

    let isDeletedClass = category.isDeleted ? ' s_F_Cs_C-Dd' : '';
    let isDeletedText = category.isDeleted ?
        r.small({}, " (deleted)") : null;

    const isDefault = category.isDefaultCategory && isStaff(me) ?
        r.small({}, " (default category)") : null;

    const categoryIconClass = category_iconClass(category, store);

    return (
      r.tr({ className: 'esForum_cats_cat' + isNewClass + isDeletedClass },
        r.td({ className: 'forum-info' }, // [rename] to esForum_cats_cat_meta
          r.div({ className: 'forum-title-wrap' },
            Link({ to: {
                pathname: this.props.forumPath + RoutePathLatest + '/' + this.props.category.slug,
                search: this.props.location.search }, className: categoryIconClass + 'forum-title' },
              category.name, isDefault), isDeletedText),
          r.p({ className: 'forum-description' }, category.description)),
        r.td({},  // class to esForum_cats_cat_topics?
          r.table({ className: 'topic-table-excerpt table table-condensed' },
            r.tbody({},
              recentTopicRows)))));
    }
});



function makeTitle(topic: Topic, className: string, settings: SettingsVisibleClientSide,
      me: Myself) {
  let title: any = topic.title;
  let iconClass = '';
  let tooltip;
  let showIcons = settings_showTopicTypes(settings, me);

  if (topic.closedAtMs && !isDone(topic) && !isAnswered(topic)) {
    tooltip = page.makePageClosedTooltipText(topic.pageRole);
    const closedIcon = r.span({ className: 'icon-block' });
    title = r.span({}, closedIcon, title);
  }
  else if (topic.pageRole === PageRole.Question) {
    tooltip = page.makeQuestionTooltipText(topic.answeredAtMs);
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
        ? "This has been fixed"
        : "This has been done";
      iconClass = 'icon-check';
    }
    else if (!showIcons) {
      // Then don't show icons, unless done/fixed.
    }
    else if (topic.startedAtMs) {
      const fixing = topic.pageRole === PageRole.Problem ? 'fixing' : '';
      tooltip = `We've started ${fixing} this`;
      iconClass = 'icon-check-empty';
    }
    else if (!topic.plannedAtMs) {
      tooltip = topic.pageRole === PageRole.Problem
          ? "This is an unsolved problem"
          : "This is an idea";
      iconClass = topic.pageRole === PageRole.Problem ? 'icon-attention-circled' : 'icon-idea';
    }
    else {
      tooltip = topic.pageRole === PageRole.Problem
          ? "We're planning to fix this"
          : "We're planning to do this";
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
      tooltip = "This is a chat channel";
      title = r.span({}, r.span({ className: 'icon-chat' }), title);
    }
  }
  else if (topic.pageRole === PageRole.PrivateChat) {
    tooltip = "This is a private chat channel";
    title = r.span({}, r.span({ className: 'icon-lock' }), title);
  }
  else if (topic.pageRole === PageRole.MindMap) {
    if (showIcons) {
      tooltip = "This is a mind map";
      title = r.span({}, r.span({className: 'icon-sitemap'}), title);
    }
  }
  else if (topic.pageRole === PageRole.FormalMessage) {
    tooltip = "A private message";
    title = r.span({}, r.span({ className: 'icon-mail' }), title);
  }
  else if (topic.pageRole === PageRole.WebPage || topic.pageRole === PageRole.CustomHtmlPage) {
    // These are special & "rare" pages (e.g. the site's About page), usually editable by staff only.
    // Make them easier to find/recognize, by always showing icons.
    tooltip = "This is an info page";
    title = r.span({}, r.span({ className: 'icon-doc-text' }), title);
  }
  else {
    if (showIcons) {
      title = r.span({}, r.span({className: 'icon-comment-empty'}), title);
      tooltip = "A discussion";
    }
  }

  if (topic.deletedAtMs) {
    title = r.span({ className: 'esForum_topics_topic-deleted' },
        r.span({ className: 'icon-trash' }), title);
  }

  if (topic.pinWhere) {
    tooltip += topic.pinWhere == PinPageWhere.Globally
      ? "\nIt has been pinned, so it's listed first."
      : "\nIt has been pinned in its category, so is listed first, in its category.";
  }

  // COULD remove the HTML for the topic type icon, if topic pinned — because showing both
  // the pin icon, + topic type icon, looks ugly. But for now, just hide the topic type
  // icon in CSS instead: [6YK320W].
  return (
      Link({ to: topic.url, title: tooltip, className: className }, title));
}


function createTopicBtnTitle(category: Category) {
  let title = "Create Topic";
  if (_.isEqual([PageRole.Idea], category.newTopicTypes)) {
    title = "Post an Idea";
  }
  else if (_.isEqual([PageRole.Question], category.newTopicTypes)) {
    title = "Ask a Question";
  }
  else if (_.isEqual([PageRole.Problem], category.newTopicTypes)) {
    title = "Report a Problem";
  }
  else if (_.isEqual([PageRole.MindMap], category.newTopicTypes)) {
    title = "Create Mind Map";
  }
  else if (_.isEqual([PageRole.Critique], category.newTopicTypes)) {
    title = "Ask for Critique"; // [plugin]
  }
  else if (areWebPages(category.newTopicTypes)) {
    title = "Create Page";
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


// Some dupl code, see  [4KEPW2].
function isDone(topic: Topic): boolean {
  return topic.doneAtMs && (topic.pageRole === PageRole.Problem ||
      topic.pageRole === PageRole.Idea || topic.pageRole === PageRole.ToDo ||
        topic.pageRole === PageRole.UsabilityTesting);  // [plugin]
}


// Some dupl code, see  [4KEPW2].
function isAnswered(topic: Topic): boolean {
  return topic.answeredAtMs && topic.pageRole === PageRole.Question;
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list

/*
 * Copyright (c) 2015-2016 Kaj Magnus Lindberg
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

/// <reference path="../../typedefs/react/react.d.ts" />
/// <reference path="../../typedefs/lodash/lodash.d.ts" />
/// <reference path="../prelude.ts" />
/// <reference path="../constants.ts" />
/// <reference path="../utils/react-utils.ts" />
/// <reference path="../utils/utils.ts" />
/// <reference path="../utils/window-zoom-resize-mixin.ts" />
/// <reference path="../utils/DropdownModal.ts" />
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

var r = React.DOM;
var DropdownModal = utils.DropdownModal;
var ExplainingListItem = util.ExplainingListItem;
type ExplainingTitleText = util.ExplainingTitleText;
var HelpMessageBox = debiki2.help.HelpMessageBox;

var MaxWaitingForCritique = 10; // for now only [plugin]

/** Keep in sync with app/controllers/ForumController.NumTopicsToList. */
var NumNewTopicsPerRequest = 40;

// The route with path 'latest' or 'top' or 'categories'. It determines the sort order
// (latest first, or best first).
var SortOrderRouteIndex = 1;

var FilterShowAll = 'ShowAll';
var FilterShowWaiting = 'ShowWaiting';
var FilterShowDeleted = 'ShowDeleted';


export function buildForumRoutes() {
  var store: Store = ReactStore.allData();
  var rootSlash = store.pagePath.value;
  var rootNoSlash = rootSlash.substr(0, rootSlash.length - 1);
  var defaultPath = rootSlash + (store.showForumCategories ? RoutePathCategories : RoutePathLatest);

  return [
    Redirect({ key: 'redirA', from: rootSlash, to: defaultPath }),
    Redirect({ key: 'redirB', from: rootNoSlash, to: defaultPath }),
    Route({ key: 'theRoutes', path: rootSlash, component: ForumComponent },
      Redirect({ from: RoutePathLatest + '/', to: rootSlash + RoutePathLatest }),
      Redirect({ from: RoutePathTop + '/', to: rootSlash + RoutePathTop }),
      Redirect({ from: RoutePathCategories + '/', to: rootSlash + RoutePathCategories }),
      Route({ path: RoutePathLatest, component: LoadAndListTopicsComponent },
        IndexRoute({ component: LoadAndListTopicsComponent }),
        Route({ path: ':categorySlug', component: LoadAndListTopicsComponent })),
      Route({ path: RoutePathTop, component: LoadAndListTopicsComponent },
        IndexRoute({ component: LoadAndListTopicsComponent }),
        Route({ path: ':categorySlug', component: LoadAndListTopicsComponent })),
      Route({ path: RoutePathCategories, component: LoadAndListCategoriesComponent }))];
}


export var ForumScrollBehavior = {
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


var ForumComponent = React.createClass(<any> {
  mixins: [debiki2.StoreListenerMixin],

  getInitialState: function() {
    var store: Store = debiki2.ReactStore.allData();
    return {
      store: store,
      topicsInStoreMightBeOld: false,
      useWideLayout: this.isPageWide(store),
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
    // Dupl code [5KFEWR7]
    this.timerHandle = setInterval(this.checkSizeChangeLayout, 200);
  },

  componentWillUnmount: function() {
    this.isGone = true;
    clearInterval(this.timerHandle);
  },

  checkSizeChangeLayout: function() {
    // Dupl code [5KFEWR7]
    if (this.isGone) return;
    var isWide = this.isPageWide();
    if (isWide !== this.state.useWideLayout) {
      this.setState({ useWideLayout: isWide });
    }
  },

  isPageWide: function(store?: Store) {
    return store_getApproxPageWidth(store || this.state.store) > UseWideForumLayoutMinWidth;
  },

  getActiveCategory: function() {
    var store: Store = this.state.store;
    var activeCategory: any;
    var activeCategorySlug = this.props.params.categorySlug;
    if (activeCategorySlug) {
      activeCategory = _.find(store.categories, (category: Category) => {
        return category.slug === activeCategorySlug;
      });
      // If `activeCategory` is null here, that's probably because the category is
      // included in user specific data that hasn't been activated yet. (6KEWM02)
    }
    else {
      activeCategory = {
        name: "All categories",
        id: store.categoryId, // the forum root category id
        isForumItself: true,
        newTopicTypes: [],
      };
    }
    return activeCategory;
  },

  makeHelpMessage: function(category: Category): any {
    var store: Store = this.state.store;
    var me: Myself = store.me;
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
    var store: Store = this.state.store;
    var activeCategory = this.getActiveCategory();
    var helpMessage = activeCategory ? this.makeHelpMessage(activeCategory) : null;
    helpMessage = helpMessage
        ? debiki2.help.HelpMessageBox({ message: helpMessage })
        : null;

    var childProps = _.assign({}, {
      store: store,
      useTable: this.state.useWideLayout,
      route: this.props.route,
      location: this.props.location,
      activeCategory: activeCategory,
      numWaitingForCritique: this.state.numWaitingForCritique,  // for now only [plugin]
      setNumWaitingForCritique: (numWaiting) => {               // for now only [plugin]
        if (this.state.numWaitingForCritique !== numWaiting)
          this.setState({ numWaitingForCritique: numWaiting });
      },
    });

    // Should I use named components instead of manually passing all route stuff to ForumButtons?
    // https://github.com/rackt/react-router/blob/v2.0.0-rc5/docs/API.md#named-components
    var forumButtonProps = _.assign({}, childProps, {
      route: this.props.route,
      routes: this.props.routes,
      location: this.props.location,
      params: this.props.params,
    });

    var topsAndCatsHelp = this.props.routes[SortOrderRouteIndex].path === RoutePathCategories
      ? HelpMessageBox({ message: topicsAndCatsHelpMessage, className: 'esForum_topicsCatsHelp' })
      : null;

    return (
     r.div({},
      debiki2.reactelements.TopBar({}),
      debiki2.page.ScrollButtons(),
      r.div({ className: 'container dw-forum' },
        // Include .dw-page to make renderDiscussionPage() in startup.js run: (a bit hacky)
        r.div({ className: 'dw-page' }),
        ForumIntroText({ store: store }),
        helpMessage,
        ForumButtons(forumButtonProps),
        topsAndCatsHelp,
        React.cloneElement(this.props.children, childProps))));
  }
});


var topicsAndCatsHelpMessage = {
  id: 'EsH4YKG81',
  version: 1,
  content: r.span({},
    "A ", r.i({}, r.b({}, "category")), " is a group of topics. " +
    "A ", r.i({}, r.b({}, "topic")), " is a discussion or question."),
};


var ForumIntroText = createComponent({
  render: function() {
    var store: Store = this.props.store;
    var user: Myself = store.me;
    var introPost = store.postsByNr[BodyNr];
    if (!introPost || introPost.isBodyHidden)
      return null;

    var anyEditIntroBtn = user.isAdmin
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



var ForumButtons = createComponent({
  mixins: [utils.WindowZoomResizeMixin],

  contextTypes: {
    router: React.PropTypes.object.isRequired
  },

  getInitialState: function() {
    return {
      compact: false,
      // [refactor] use ModalDropdownButton instead of all these 3 x open/X/Y fields.
      isCategoryDropdownOpen: false,
      categoryDropdownX: -1,
      categoryDropdownY: -1,
      isSortOrderDropdownOpen: false,
      sortOrderDropdownX: -1,
      sortOrderDropdownY: -1,
      isTopicFilterDropdownOpen: false,
      topicFilterX: -1,
      topicFilterY: -1,
    };
  },

  onWindowZoomOrResize: function() {
    var newCompact = $(window).width() < 801;
    if (this.state.compact !== newCompact) {
      this.setState({ compact: newCompact });
    }
  },

  openCategoryDropdown: function() {
    var rect = ReactDOM.findDOMNode(this.refs.selectCategoryButton).getBoundingClientRect();
    this.setState({ isCategoryDropdownOpen: true, categoryDropdownX: rect.left,
      categoryDropdownY: rect.bottom });
  },

  closeCategoryDropdown: function() {
    this.setState({ isCategoryDropdownOpen: false });
  },

  setCategory: function(newCategorySlug) {
    var store: Store = this.props.store;
    dieIf(this.props.routes.length < 2, 'EsE6YPKU2');
    this.closeCategoryDropdown();
    var currentPath = this.props.routes[SortOrderRouteIndex].path;
    var nextPath = currentPath === RoutePathCategories ? RoutePathLatest : currentPath;
    var slashSlug = newCategorySlug ? '/' + newCategorySlug : '';
    this.context.router.push({
      pathname: store.pagePath.value + nextPath + slashSlug,
      query: this.props.location.query,
    });
  },

  findTheDefaultCategory: function() {
    var store: Store = this.props.store;
    return _.find(store.categories, (category: Category) => {
        return category.isDefaultCategory;
    });
  },

  openSortOrderDropdown: function() {
    var rect = ReactDOM.findDOMNode(this.refs.sortOrderButton).getBoundingClientRect();
    this.setState({ isSortOrderDropdownOpen: true, sortOrderDropdownX: rect.left,
      sortOrderDropdownY: rect.bottom });
  },

  closeSortOrderDropdown: function() {
    this.setState({ isSortOrderDropdownOpen: false });
  },

  setSortOrder: function(newPath: string) {
    var store: Store = this.props.store;
    this.closeSortOrderDropdown();
    this.context.router.push({
      pathname: store.pagePath.value + newPath + this.slashCategorySlug(),
      query: this.props.location.query,
    });
  },

  getSortOrderName: function(sortOrderRoutePath?: string) {
    if (!sortOrderRoutePath) {
      sortOrderRoutePath = this.props.routes[SortOrderRouteIndex].path;
    }
    let store: Store = this.props.store;
    let showTopicFilter = settings_showFilterButton(store.settings, store.me);
    // If there's no topic filter button, the text "All Topics" won't be visible to the
    // right of the Latest / Top sort order buttons, which makes it hard to understand what
    // Latest / Top means? Therefore, if `!showTopicFilter`, type "Latest topics" instead of
    // just "Latest". (Also, since the filter button is absent, there's more space for this.)
    switch (sortOrderRoutePath) {
      case RoutePathLatest: return showTopicFilter ? "Latest" : "Latest topics";
      case RoutePathTop: return showTopicFilter ? "Top" : "Popular topics";
      default: return null;
    }
  },

  setTopicFilter: function(entry: ExplainingTitleText) {
    var newQuery = _.clone(this.props.location.query);
    if (entry.eventKey === FilterShowAll) {
      delete newQuery.filter;
    }
    else {
      newQuery.filter = entry.eventKey;
    }
    this.closeTopicFilterDropdown();
    this.context.router.push({ pathname: this.props.location.pathname, query: newQuery });
  },

  openTopicFilterDropdown: function() {
    var rect = ReactDOM.findDOMNode(this.refs.topicFilterButton).getBoundingClientRect();
    this.setState({ isTopicFilterDropdownOpen: true, topicFilterX: rect.left,
        topicFilterY: rect.bottom });
  },

  closeTopicFilterDropdown: function() {
    this.setState({ isTopicFilterDropdownOpen: false });
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
      if (this.isMounted()) {
        dialog.open(this.props.activeCategory.id);
      }
    });
  },

  createCategory: function() {
    morebundle.getEditCategoryDialog(dialog => {
      if (this.isMounted()) {
        dialog.open();
      }
    });
  },

  createTopic: function() {
    var anyReturnToUrl = window.location.toString().replace(/#/, '__dwHash__');
    morebundle.loginIfNeeded('LoginToCreateTopic', anyReturnToUrl, () => {
      var category: Category = this.props.activeCategory;
      if (category.isForumItself) {
        category = this.findTheDefaultCategory();
        dieIf(!category, "No Uncategorized category [DwE5GKY8]");
      }
      var newTopicTypes = category.newTopicTypes || [];
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
    });
  },

  slashCategorySlug: function() {
    return this.props.params.categorySlug ? '/' + this.props.params.categorySlug : '';
  },

  render: function() {
    let state = this.state;
    let store: Store = this.props.store;
    let settings: SettingsVisibleClientSide = store.settings;
    let me: Myself = store.me;
    let activeCategory: Category = this.props.activeCategory;
    if (!activeCategory) {
      // The user has typed a non-existing category slug in the URL. Or she has just created
      // a category, opened a page and then clicked Back in the browser. Then this page
      // reloads, and the browser then uses cached HTML including JSON in which the new
      // category does not yet exist. Let's try to reload the category list page:
      // (However, if user-specific-data hasn't yet been activated, the "problem" is probably
      // just that we're going to show a restricted category, which isn't available before
      // user specific data added. (6KEWM02). )
      return !store.userSpecificDataAdded ? null : r.p({},
        "Category not found. Did you just create it? Then reload the page please. [EsE04PK27]");
    }

    var showsCategoryTree = this.props.routes[SortOrderRouteIndex].path === RoutePathCategories;
    var showsTopicList = !showsCategoryTree;

    // A tester got a little bit confused in the categories view, because it starts with
    // the filter-*topics* button. So insert this title, before, instead.
    var anyPageTitle = showsCategoryTree ?
        r.div({ className: 'esF_BB_PageTitle' }, "Categories") : null;

    var makeCategoryLink = (where, text, linkId, extraClass?) => Link({
      to: { pathname: store.pagePath.value + where, query: this.props.location.query },
      id: linkId,
      className: 'btn esForum_catsNav_btn ' + (extraClass || ''),
      activeClassName: 'active' }, text);

    let omitCategoryStuff = showsCategoryTree || !settings_showCategories(store.settings, me);
    let categoryTreeLink = omitCategoryStuff ? null :
      makeCategoryLink(RoutePathCategories, "Categories", 'e2eViewCategoriesB', 'esForum_navLink');

    // COULD remember which topics were listed previously and return to that view.
    // Or would a Back btn somewhere be better?
    var topicListLink = showsTopicList ? null :
      makeCategoryLink(RoutePathLatest, "Topic list", 'e2eViewTopicsB', 'esForum_navLink');

    var categoryMenuItems = store.categories.map((category: Category) => {
      return MenuItem({ key: category.id, active: activeCategory.id === category.id,
          onClick: () => this.setCategory(category.slug) }, category.name);
    });

    var listsTopicsInAllCats =
        // We list topics? (We're not on the Categories route? which lists categories)
        this.props.routes[SortOrderRouteIndex].path !== RoutePathCategories &&
        // No category selected?
        activeCategory.isForumItself;

    categoryMenuItems.unshift(
        MenuItem({ key: -1, active: listsTopicsInAllCats,
          onClick: () => this.setCategory('') }, "All categories"));

    // [refactor] use ModalDropdownButton instead
    let categoriesDropdownButton = omitCategoryStuff ? null :
        Button({ onClick: this.openCategoryDropdown,
            className: 'esForum_catsNav_btn esForum_catsDrop active',
            ref: 'selectCategoryButton' },
          activeCategory.name + ' ', r.span({ className: 'caret' }));

    var categoriesDropdownModal =
        DropdownModal({ show: state.isCategoryDropdownOpen, pullLeft: true,
            onHide: this.closeCategoryDropdown, atX: state.categoryDropdownX,
            atY: state.categoryDropdownY },
          r.ul({ className: 'dropdown-menu' },
            categoryMenuItems));

    // The Latest/Top/Categories buttons, but use a dropdown if there's not enough space.
    var currentSortOrderPath = this.props.routes[SortOrderRouteIndex].path;
    var latestTopButton;
    var latestTopDropdownModal;
    if (showsCategoryTree) {
      // Then hide the sort topics buttons.
    }
    else if (state.compact) {
      // [refactor] use ModalDropdownButton instead
      latestTopButton =
          Button({ onClick: this.openSortOrderDropdown, ref: 'sortOrderButton',
              className: 'esForum_catsNav_btn esF_BB_SortBtn' },
            this.getSortOrderName() + ' ', r.span({ className: 'caret' }));
      latestTopDropdownModal =
        DropdownModal({ show: state.isSortOrderDropdownOpen, pullLeft: true,
            onHide: this.closeSortOrderDropdown, atX: state.sortOrderDropdownX,
            atY: state.sortOrderDropdownY },
          r.ul({},
            ExplainingListItem({ onClick: () => this.setSortOrder(RoutePathLatest),
                active: currentSortOrderPath === RoutePathLatest,
                title: this.getSortOrderName(RoutePathLatest),
                text: "Shows latest topics first" }),
            ExplainingListItem({ onClick: () => this.setSortOrder(RoutePathTop),
                active: currentSortOrderPath === RoutePathTop,
                title: this.getSortOrderName(RoutePathTop),
                text: "Shows popular topics first" })));
    }
    else {
      var slashSlug = this.slashCategorySlug();
      latestTopButton =
          r.ul({ className: 'nav esForum_catsNav_sort' },
            makeCategoryLink(RoutePathLatest + slashSlug, this.getSortOrderName(RoutePathLatest),
                'e2eSortLatestB'),
            makeCategoryLink(RoutePathTop + slashSlug, this.getSortOrderName(RoutePathTop),
                'e2eSortTopB'));
    }

    // ------ The filter topics select.

    let showFilterButton = settings_showFilterButton(settings, me);

    var topicFilterValue = this.props.location.query.filter || FilterShowAll;
    function makeTopicFilterText(filter) {
      switch (filter) {
        case FilterShowAll: return "All topics";
        case FilterShowWaiting: return "Only waiting";
        case FilterShowDeleted: return "Show deleted";
      }
      die('EsE4JK85');
    }

    // [refactor] use ModalDropdownButton instead
    var topicFilterButton = !showFilterButton ? null :
      Button({ onClick: this.openTopicFilterDropdown,
          className: 'esForum_filterBtn esForum_catsNav_btn', ref: 'topicFilterButton' },
        makeTopicFilterText(topicFilterValue) + ' ', r.span({ className: 'caret' }));

    var showDeletedFilterItem = !isStaff(me) || !showFilterButton ? null :
      ExplainingListItem({ onSelect: this.setTopicFilter,
        activeEventKey: topicFilterValue, eventKey: FilterShowDeleted,
        title: makeTopicFilterText(FilterShowDeleted),
        text: "Shows all topics, including deleted topics" });

    var topicFilterDropdownModal = !showFilterButton ? null :
      DropdownModal({ show: state.isTopicFilterDropdownOpen, pullLeft: true,
          onHide: this.closeTopicFilterDropdown, atX: state.topicFilterX,
          atY: state.topicFilterY },
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
    var sortOrderRoutePath = this.props.routes[SortOrderRouteIndex].path;

    var createTopicBtn;
    if (sortOrderRoutePath !== RoutePathCategories && !(
          activeCategory.onlyStaffMayCreateTopics && !isStaff(me))) {
     if (this.props.numWaitingForCritique < MaxWaitingForCritique)  // for now only [plugin]
      createTopicBtn = PrimaryButton({ onClick: this.createTopic, id: 'e2eCreateSth',
          className: 'esF_BB_CreateBtn'},
        createTopicBtnTitle(activeCategory));
    }

    var createCategoryBtn;
    if (sortOrderRoutePath === RoutePathCategories && me.isAdmin) {
      createCategoryBtn = PrimaryButton({ onClick: this.createCategory, id: 'e2eCreateCategoryB' },
        "Create Category");
    }

    var editCategoryBtn;
    if (!activeCategory.isForumItself && me.isAdmin) {
      editCategoryBtn = Button({ onClick: this.editCategory, className: 'esF_BB_EditCat' },
        "Edit Category");
    }

    return (
        r.div({ className: 'dw-forum-actionbar clearfix' },
          r.div({ className: 'esForum_catsNav' },
            anyPageTitle,
            categoriesDropdownButton,
            categoriesDropdownModal,
            latestTopButton,
            latestTopDropdownModal,
            topicFilterButton,
            topicFilterDropdownModal,
            categoryTreeLink,
            topicListLink),
          createTopicBtn,
          createCategoryBtn,
          editCategoryBtn));
  }
});



var LoadAndListTopicsComponent = React.createClass(<any> {
  getInitialState: function(): any {
    // The server has included in the Flux store a list of the most recent topics, and we
    // can use that lis when rendering the topic list server side, or for the first time
    // in the browser (but not after that, because then new topics might have appeared).
    let store: Store = this.props.store;
    // If we're authenticated, the topic list depends a lot on our permissions & groups.
    // Then, send a request, to get the correct topic list (otherwise,
    // as of 2016-12, hidden topics won't be included even if they should be [7RIQ29]).
    let me: Myself = (debiki.volatileDataFromServer || {}).me;
    let canUseTopicsInScriptTag = !me || !me.isAuthenticated;
    if (!this.props.topicsInStoreMightBeOld && this.isAllLatestTopicsView() &&
        canUseTopicsInScriptTag) {
      return {
        topics: store.topics,
        showLoadMoreButton: store.topics.length >= NumNewTopicsPerRequest
      };
    }
    else {
      return {};
    }
  },

  isAllLatestTopicsView: function() {
    dieIf(this.props.routes.length < 2, 'EsE5YPFK23');
    return this.props.routes[SortOrderRouteIndex].path === RoutePathLatest &&
        !this.props.params.categorySlug;
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

    var isNewView =
      this.props.location.pathname !== nextProps.location.pathname ||
      this.props.location.search !== nextProps.location.search;

    this.countTopicsWaitingForCritique(); // for now only

    // Avoid loading the same topics many times:
    // - On page load, componentDidMount() and componentWillReceiveProps() both loads topics.
    // - When we're refreshing the page because of Flux events, don't load the same topics again.
    if (!isNewView && !loadMore && (this.state.topics || this.isLoading))
      return;

    var orderOffset: OrderOffset = this.getOrderOffset(nextProps);
    orderOffset.topicFilter = nextProps.location.query.filter;
    if (isNewView) {
      this.setState({
        minHeight: $(ReactDOM.findDOMNode(this)).height(),
        topics: null,
        showLoadMoreButton: false
      });
      // Load from the start, no offset. Keep any topic filter though.
      delete orderOffset.whenMs;
      delete orderOffset.numLikes;
    }
    var categoryId = nextProps.activeCategory.id;
    // Don't use this.state.isLoading, because the state change doesn't happen instantly,
    // so componentWillReceiveProps() would get called first, and it would call loadTopics again
    // while this.state.isLoading was still false, resulting in an unneeded server request.
    this.isLoading = true;
    debiki2.Server.loadForumTopics(categoryId, orderOffset, (newlyLoadedTopics: Topic[]) => {
      if (!this.isMounted())
        return;

      var topics: any = isNewView ? [] : (this.state.topics || []);
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
    });
  },

  countTopicsWaitingForCritique: function(topics?) { // for now only  [plugin]
    if (!this.props.activeCategory) return;
    topics = topics || this.state.topics;
    var numWaitingForCritique = 0;
    if (_.isEqual(this.props.activeCategory.newTopicTypes, [PageRole.Critique])) {
      var waitingTopics = _.filter(topics, (topic: Topic) =>
        !topic.closedAtMs && topic.pageRole === PageRole.Critique);
      numWaitingForCritique = waitingTopics.length;
      console.log(numWaitingForCritique + " topics waiting for critique. [EsM8PMU21]");
    }
    this.props.setNumWaitingForCritique(numWaitingForCritique);
  },

  getOrderOffset: function(nextProps?) {
    var props = nextProps || this.props;
    var anyTimeOffset: number;
    var anyLikesOffset: number;
    var anyLastTopic: any = _.last(this.state.topics);
    if (anyLastTopic) {
      // If we're loading more topics, we should continue with this offset.
      anyTimeOffset = anyLastTopic.bumpedAtMs || anyLastTopic.createdAtMs;
      anyLikesOffset = anyLastTopic.numLikes;
    }
    var orderOffset: OrderOffset = { sortOrder: -1 };
    if (props.routes[SortOrderRouteIndex].path === RoutePathTop) {
      orderOffset.sortOrder = TopicSortOrder.LikesAndBumpTime;
      orderOffset.whenMs = anyTimeOffset;
      orderOffset.numLikes = anyLikesOffset;
    }
    else {
      orderOffset.sortOrder = TopicSortOrder.BumpTime;
      orderOffset.whenMs = anyTimeOffset;
    }
    return orderOffset;
  },

  render: function() {
    return ListTopicsComponent({
      topics: this.state.topics,
      store: this.props.store,
      useTable: this.props.useTable,
      minHeight: this.state.minHeight,
      showLoadMoreButton: this.state.showLoadMoreButton,
      activeCategory: this.props.activeCategory,
      orderOffset: this.getOrderOffset(),
      // `routes` and `location` needed because category clickable. [7FKR0QA]
      // COULD try to find some other way to link categories to URL paths, that works
      // also in the user-activity.more.ts topic list. [7FKR0QA]
      linkCategories: true,
      routes: this.props.routes,
      location: this.props.location,
    });
  },
});



export var ListTopicsComponent = createComponent({
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
    let store: Store = this.props.store;
    let me: Myself = store.me;
    let topics: Topic[] = this.props.topics;
    if (!topics) {
      // The min height preserves scrollTop, even though the topic list becomes empty
      // for a short while (which would otherwise reduce the windows height which
      // in turn might reduce scrollTop).
      // COULD make minHeight work when switching to the Categories view too? But should
      // then probably scroll the top of the categories list into view.
      // COULD use store.topics, used when rendering server side, but for now:
      return r.p({ style: { minHeight: this.props.minHeight } }, 'Loading...');
    }

    if (!topics.length)
      return r.p({ id: 'e2eF_NoTopics' }, 'No topics.');

    let useTable = this.props.useTable;

    let activeCategory: Category = this.props.activeCategory;
    let topicElems = topics.map((topic: Topic) => {
      return TopicRow({
          store: store, topic: topic, categories: store.categories,
          activeCategory: activeCategory, now: store.now,
          key: topic.pageId, routes: this.props.routes, location: this.props.location,
          pagePath: store.pagePath, inTable: useTable });
    });

    // Insert an icon explanation help message in the topic list. Anywhere else, and
    // people won't see it at the right time, won't understand what the icons mean.
    // It'll be closed by default (click to open) if there are only a few topics.
    // (Because if people haven't seen some icons and started wondering "what's that",
    // they're just going to be annoyed by the icon help tips?)
    var numFewTopics = 10;
    var iconsHelpClosed = !this.state.helpOpened; /* always start closed, for now,
                                                    because doesn't look nice otherwise
        [refactor] So remove this stuff then:
        // User has clicked Hide?
        help.isHelpMessageClosed(store, IconHelpMessage) ||
        // Too few topics, then right now no one cares about the icons?
        (topics.length < numFewTopics && !this.state.helpOpened);
        */
    var iconsHelpStuff = iconsHelpClosed || help.isHelpMessageClosed(store, IconHelpMessage)
        ? r.a({ className: 'esForum_topics_openIconsHelp icon-info-circled',
              onClick: this.openIconsHelp }, "Explain icons...")
        : HelpMessageBox({ message: IconHelpMessage, showUnhideTips: false });
    topicElems.splice(Math.min(topicElems.length, numFewTopics), 0,
      useTable
        ? r.tr({ key: 'ExplIcns' }, r.td({ colSpan: 5 }, iconsHelpStuff))
        : r.li({ key: 'ExplIcns', className: 'esF_TsL_T clearfix' }, iconsHelpStuff));

    let loadMoreTopicsBtn;
    let orderOffset = this.props.orderOffset;
    if (this.props.showLoadMoreButton) {
      var queryString = '?' + debiki2.ServerApi.makeForumTopicsQueryParams(orderOffset);
      loadMoreTopicsBtn =
        r.div({},
          r.a({ className: 'load-more', onClick: this.onLoadMoreTopicsClick,
              href: queryString }, 'Load more ...'));
    }

    let sortingHowTips;
    if (orderOffset.sortOrder === TopicSortOrder.LikesAndBumpTime) {
      sortingHowTips =
          r.p({ className: 'esForum_sortInfo e_F_SI_Top' }, "Topics with the most Like votes:");
    }

    let deletedClass = !activeCategory.isDeleted ? '' : ' s_F_Ts-CatDd';
    let categoryDeletedInfo = !activeCategory.isDeleted ? null :
      r.p({ className: 'icon-trash s_F_CatDdInfo' },
        "This category has been deleted");

    let categoryHeader = !settings_showCategories(store.settings, me) ? null :
        r.th({ className: 's_F_Ts_T_CN' }, "Category");

    var topicsTable = !useTable ? null :
        r.table({ className: 'esF_TsT s_F_Ts-Wide dw-topic-list' + deletedClass },
          r.thead({},
            r.tr({},
              r.th({}, "Topic"),
              categoryHeader,
              r.th({ className: 's_F_Ts_T_Avs' }, "Users"),
              r.th({ className: 'num dw-tpc-replies' }, "Replies"),
              r.th({ className: 'num' }, "Activity"))),
              // skip for now:  r.th({ className: 'num' }, "Feelings"))),  [8PKY25]
          r.tbody({},
            topicElems));

    var topicRows = useTable ? null :
        r.ol({ className: 'esF_TsL s_F_Ts-Nrw' + deletedClass },
          topicElems);

    return (
      r.div({},
        categoryDeletedInfo,
        sortingHowTips,
        topicsTable || topicRows,
        loadMoreTopicsBtn));
  }
});


var IconHelpMessage = {
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
        r.li({},
          r.span({ className: 'icon-sitemap' },
            "A mind map.")),
        r.li({},
          r.span({ className: 'icon-block' },
            "Topic closed.")),
        r.li({},
          r.span({ className: 'icon-pin' },
            "Topic always listed first (perhaps only in its own category).")))),
};



var TopicRow = createComponent({
  contextTypes: {
    router: React.PropTypes.object.isRequired
  },

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
    var fraction = 1.0 * num / total / 2;
    if (fraction > 1) {
      fraction = 1;
    }
    if (!this.minProb) {
      this.minProb = this.binProbLowerBound(0, 0) + 0.01;
    }
    var probabilityLowerBound = this.binProbLowerBound(total, fraction);
    if (probabilityLowerBound <= this.minProb)
      return null;

    var size = 8 + 6 * probabilityLowerBound;
    var saturation = Math.min(100, 100 * probabilityLowerBound);
    var brightness = Math.max(50, 70 - 20 * probabilityLowerBound);
    var color = 'hsl(0, ' + saturation + '%, ' + brightness + '%)' ; // from gray to red
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
    var defaultProbability = Math.min(0.5, proportionOfSuccesses);
    var adjustment = 4;
    var n_ = sampleSize + adjustment;
    var p_ = (proportionOfSuccesses * sampleSize + adjustment * defaultProbability) / n_;
    var z_unknownProb = 1.04;
    var square = z_unknownProb * Math.sqrt(p_ * (1 - p_) / n_);
    var lowerBound = p_ - square;
    var upperBound = p_ + square;
    return lowerBound;
  },

  makeCategoryLink: function(category: Category, skipQuery?: boolean) {
    var store: Store = this.props.store;
    dieIf(this.props.routes.length < 2, 'EdE5U2ZG');  // [7FKR0QA]
    var sortOrderPath = this.props.routes[SortOrderRouteIndex].path;
    // this.props.location.query — later: could convert to query string, unless skipQuery === true
    return store.pagePath.value + sortOrderPath + '/' + category.slug;
  },

  makeOnCategoryClickFn: function(category: Category) {
    return (event) => {
      event.preventDefault();
      let urlPath = this.makeCategoryLink(category, true);
      this.context.router.push({
        pathname: urlPath,
        query: this.props.location.query,  // [7FKR0QA]
      });
    };
  },

  render: function() {
    let store: Store = this.props.store;
    let me = store.me;
    let settings = store.settings;
    let topic: Topic = this.props.topic;
    let category: Category = _.find(store.categories, (category: Category) => {
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
    var activityTitle = "Created on " + whenMsToIsoDate(topic.createdAtMs);

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
    let showExcerptAsParagraph =
        topic.pinWhere === PinPageWhere.Globally ||
        (topic.pinWhere && topic.categoryId === this.props.activeCategory.id) ||
        store.pageLayout >= TopicListLayout.ExcerptBelowTitle;
    if (showExcerptAsParagraph) {
      excerpt =
          r.p({ className: 'dw-p-excerpt' }, topic.excerpt);
          // , r.a({ href: topic.url }, 'read more')); — no, better make excerpt click open page?
    }
    else if (store.pageLayout === TopicListLayout.TitleExcerptSameLine) {
      excerpt =
          r.span({ className: 's_F_Ts_T_Con_B' }, topic.excerpt);
    }
    else {
      // No excerpt.
      dieIf(store.pageLayout && store.pageLayout !== TopicListLayout.TitleOnly,
          'EdE5FK2W8');
    }

    let anyThumbnails;
    if (store.pageLayout === TopicListLayout.ThumbnailLeft) {
      die('Unimplemented: thumbnail left [EdE7KW4024]')
    }
    else if (store.pageLayout === TopicListLayout.ThumbnailsBelowTitle) {
      let thumbnailUrls = topic_mediaThumbnailUrls(topic);
      let imgIndex = 0;
      anyThumbnails = _.isEmpty(thumbnailUrls) ? null :
        r.div({ className: 's_F_Ts_T_Tmbs' },
          thumbnailUrls.map(url => r.img({ src: url, key: ++imgIndex })));
    }

    let showCategories = settings_showCategories(settings, me);
    let categoryName = !category || !showCategories ? null :
      r.a({ href: this.makeCategoryLink(category), className: 'esF_Ts_T_CName',
            onClick: this.makeOnCategoryClickFn(category) },
        category.name);

    var activityAgo = prettyLetterTimeAgo(topic.bumpedAtMs || topic.createdAtMs);

    // Avatars: Original Poster, some frequent posters, most recent poster. [7UKPF26]
    var author = store_getUserOrMissing(store, topic.authorId, 'EsE5KPF0');
    var userAvatars = [
        avatar.Avatar({ key: 'OP', tiny: true, user: author, title: "created the topic" })];
    for (var i = 0; i < topic.frequentPosterIds.length; ++i) {
      var poster = store_getUserOrMissing(store, topic.frequentPosterIds[i], 'EsE2WK0F');
      userAvatars.push(avatar.Avatar({ key: poster.id, tiny: true, user: poster,
            title: "frequent poster" }));
    }
    if (topic.lastReplyerId) {
      var lastReplyer = store_getUserOrMissing(store, topic.lastReplyerId, 'EsE4GTZ7');
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

    // We use a table layout, only for wide screens, because table columns = spacy.
    if (this.props.inTable) return (
      r.tr({ className: 'esForum_topics_topic e2eF_T' },
        r.td({ className: 'dw-tpc-title e2eTopicTitle' },
          r.div({ className: 's_F_Ts_T_Con' + manyLinesClass, onClick: showMoreClickHandler },
            makeTitle(topic, anyPinOrHiddenIconClass, settings, me),
            excerpt),
          anyThumbnails),
        !showCategories ? null : r.td({ className: 's_F_Ts_T_CN' }, categoryName),
        r.td({ className: 's_F_Ts_T_Avs' }, userAvatars),
        r.td({ className: 'num dw-tpc-replies' }, topic.numPosts - 1),
        r.td({ className: 'num dw-tpc-activity', title: activityTitle }, activityAgo)));
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
          r.span({ className: 'esF_TsL_T_Row2_When' },
            prettyLetterTimeAgo(topic.bumpedAtMs || topic.createdAtMs))),
          anyThumbnails));
  }
});


function topic_mediaThumbnailUrls(topic: Topic): string[] {
  let bodyUrls = topic.firstImageUrls || [];
  let allUrls = bodyUrls.concat(topic.popularRepliesImageUrls || []);
  let noGifs = _.filter(allUrls, (url) => url.toLowerCase().indexOf('.gif') === -1);
  return _.uniq(noGifs);
}


var LoadAndListCategoriesComponent = React.createClass(<any> {
  getInitialState: function() {
    return {};
  },

  componentDidMount: function() {
    this.loadCategories(this.props);
  },

  componentWillUnmount: function(nextProps) {
    this.ignoreServerResponse = true;
  },

  componentWillReceiveProps: function(nextProps) {
    this.loadCategories(nextProps);
  },

  componentDidUpdate: function() {
    processTimeAgo();
  },

  loadCategories: function(props) {
    var store: Store = props.store;
    debiki2.Server.loadForumCategoriesTopics(store.pageId, props.location.query.filter,
        (categories: Category[]) => {
      if (this.ignoreServerResponse) return;
      this.setState({ categories: categories });
    });
  },

  render: function() {
    if (!this.state.categories)
      return r.p({}, 'Loading...');

    var categoryRows = this.state.categories.map((category: Category) => {
      return CategoryRow({ store: this.props.store, location: this.props.location,
          category: category, key: category.id });
    });

    var recentTopicsColumnTitle;
    switch (this.props.location.query.filter) {
      case FilterShowWaiting:
        recentTopicsColumnTitle = "Recent topics (those waiting)";
        break;
      case FilterShowDeleted:
        recentTopicsColumnTitle = "Recent topics (including deleted)";
        break;
      default:
        recentTopicsColumnTitle = "Recent topics (no filter)";
    }

    return (
      r.table({ className: 'forum-table table' },
        r.thead({},
          r.tr({},
            r.th({}, 'Category'),
            r.th({}, recentTopicsColumnTitle))),
        r.tbody({},
          categoryRows)));
    }
});



var CategoryRow = createComponent({
  componentDidMount: function() {
    var store: Store = this.props.store;
    // If this is a newly created category, scroll it into view.
    if (this.props.category.slug === store.newCategorySlug) {
      utils.scrollIntoViewInPageColumn(ReactDOM.findDOMNode(this));
    }
  },

  render: function() {
    var store: Store = this.props.store;
    var me: Myself = store.me;
    var category: Category = this.props.category;
    var recentTopicRows = category.recentTopics.map((topic: Topic) => {
      var pinIconClass = topic.pinWhere ? ' icon-pin' : '';
      var numReplies = topic.numPosts - 1;
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
    var isNewClass = category.slug === store.newCategorySlug ?
      ' esForum_cats_cat-new' : '';

    let isDeletedClass = category.isDeleted ? ' s_F_Cs_C-Dd' : '';
    let isDeletedText = category.isDeleted ?
        r.small({}, " (deleted)") : null;

    var isDefault = category.isDefaultCategory && isStaff(me) ?
        r.small({}, " (default category)") : null;

    return (
      r.tr({ className: 'esForum_cats_cat' + isNewClass + isDeletedClass },
        r.td({ className: 'forum-info' }, // [rename] to esForum_cats_cat_meta
          r.div({ className: 'forum-title-wrap' },
            Link({ to: {
                pathname: store.pagePath.value + RoutePathLatest + '/' + this.props.category.slug,
                query: this.props.location.query }, className: 'forum-title' },
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
  let title = topic.title;
  let iconClass = '';
  let tooltip;
  let showIcons = settings_showTopicTypes(settings, me);

  if (topic.closedAtMs && !isDone(topic) && !isAnswered(topic)) {
    tooltip = page.makePageClosedTooltipText(topic.pageRole);
    var closedIcon = r.span({ className: 'icon-block' });
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
      iconClass = 'icon-check-empty';
    }
    if (iconClass) {
      title = r.span({}, r.span({ className: iconClass }, title));
    }
  }
  else if (topic.pageRole === PageRole.ToDo) {
    if (topic.doneAtMs) {
      iconClass = 'icon-check';
      tooltip = "This has been done or fixed";
    }
    else if (showIcons) {
      iconClass = 'icon-check-empty';
      tooltip = "This is something to do or to fix";
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
      r.a({ href: topic.url, title: tooltip, className: className }, title));
}


function createTopicBtnTitle(category: Category) {
  var title = "Create Topic";
  if (_.isEqual([PageRole.Idea], category.newTopicTypes)) {
    title = "Post an Idea";
  }
  else if (_.isEqual([PageRole.Question], category.newTopicTypes)) {
    title = "Ask a Question";
  }
  else if (_.isEqual([PageRole.Problem], category.newTopicTypes)) {
    title = "Report a Problem";
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
      topic.pageRole === PageRole.Idea || topic.pageRole === PageRole.ToDo);
}


// Some dupl code, see  [4KEPW2].
function isAnswered(topic: Topic): boolean {
  return topic.answeredAtMs && topic.pageRole === PageRole.Question;
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list

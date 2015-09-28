/*
 * Copyright (C) 2015 Kaj Magnus Lindberg (born 1979)
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
/// <reference path="../utils/react-utils.ts" />
/// <reference path="../editor/editor.ts" />
/// <reference path="../utils/window-zoom-resize-mixin.ts" />
/// <reference path="../react-elements/topbar.ts" />
/// <reference path="../Server.ts" />
/// <reference path="../ServerApi.ts" />
/// <reference path="../model.ts" />

//------------------------------------------------------------------------------
   module debiki2.forum {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var reactCreateFactory = React['createFactory'];
var ReactBootstrap: any = window['ReactBootstrap'];
var Button = reactCreateFactory(ReactBootstrap.Button);
var DropdownButton = reactCreateFactory(ReactBootstrap.DropdownButton);
var MenuItem = reactCreateFactory(ReactBootstrap.MenuItem);
var Input = reactCreateFactory(ReactBootstrap.Input);

var ReactRouter = window['ReactRouter'];
var Route = reactCreateFactory(ReactRouter.Route);
var Redirect = reactCreateFactory(ReactRouter.Redirect);
var DefaultRoute = reactCreateFactory(ReactRouter.DefaultRoute);
var NotFoundRoute = reactCreateFactory(ReactRouter.NotFoundRoute);
var RouteHandler = reactCreateFactory(ReactRouter.RouteHandler);
var RouterNavigationMixin = ReactRouter.Navigation;
var RouterStateMixin = ReactRouter.State;


/** Keep in sync with app/controllers/ForumController.NumTopicsToList. */
var NumNewTopicsPerRequest = 40;

export function buildForumRoutes() {
  return (
    Route({ name: 'ForumRoute', path: '/', handler: ForumComponent },
      Redirect({ from: '/', to: '/latest/' }),
      Redirect({ from: '/latest', to: '/latest/' }),
      Route({ name: 'ForumRouteLatest', path: 'latest/:categorySlug?',
          handler: ForumTopicListComponent }),
      Route({ name: 'ForumRouteTop', path: 'top/:categorySlug?',
          handler: ForumTopicListComponent }),
      Route({ name: 'ForumRouteCategories', path: 'categories',
          handler: ForumCategoriesComponent })));
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


var ForumComponent = React.createClass({
  mixins: [debiki2.StoreListenerMixin],

  onChange: function() {
    this.setState(debiki2.ReactStore.allData());
    // Now some time has passed since this page was loaded, so:
    this.setState({ topicsInStoreMightBeOld: true });
  },

  render: function() {
    return (
      r.div({ className: 'container dw-forum' },
        debiki2.reactelements.TopBar({}),
        // Include .dw-page to make renderDiscussionPage() in startup.js run: (a bit hacky)
        r.div({ className: 'dw-page' }),
        ForumIntroText(this.state || this.props),
        CategoriesAndTopics(this.state || this.props)));
  }
});



var ForumIntroText = createComponent({
  render: function() {
    var introPost = this.props.allPosts[BodyId];
    if (!introPost || introPost.isPostHidden)
      return null;

    return r.div({ className: 'dw-forum-intro' },
      r.div({ dangerouslySetInnerHTML: { __html: introPost.sanitizedHtml }}),
      r.a({ className: 'icon-cancel dw-forum-intro-close',
          onClick: () => ReactActions.showForumIntro(false) }, "Hide intro"));
  }
});



var CategoriesAndTopics = createComponent({
  mixins: [RouterNavigationMixin, RouterStateMixin, utils.WindowZoomResizeMixin],

  getInitialState: function() {
    return {
      compact: false,
    };
  },

  onWindowZoomOrResize: function() {
    var newCompact = $(window).width() < 801;
    if (this.state.compact !== newCompact) {
      this.setState({ compact: newCompact });
    }
  },

  componentWillReceiveProps: function(nextProps) {
    // If we just created a new category, transition to the latest topics view for
    // that category.
    var newCatSlug = nextProps.newCategorySlug;
    if (newCatSlug && newCatSlug !== this.state.newCategorySlug) {
      this.setState({ newCategorySlug: newCatSlug });
      this.transitionTo('ForumRouteLatest', { categorySlug: newCatSlug }, this.getQuery());
    }
  },

  switchCategory: function(newCategorySlug) {
    var routes = this.getRoutes();
    var nextRouteName = routes[routes.length - 1].name;
    if (nextRouteName === 'ForumRouteCategories' || nextRouteName === 'ForumRouteDefault') {
      nextRouteName = 'ForumRouteLatest';
    }
    this.transitionTo(nextRouteName, { categorySlug: newCategorySlug }, this.getQuery());
  },

  getActiveCategory: function() {
    var activeCategory: any;
    var activeCategorySlug = this.getParams().categorySlug;
    if (activeCategorySlug) {
      // Don't know why, but sometimes after having edited or created a category and
      // then transitioned to its edited/new slug, then getParams().categorySlug
      // still points to the old previous slug. Therefore, if we didn't find
      // activeCategorySlug, try this.state.newCategorySlug instead.
      activeCategory = _.find(this.props.categories, (category: Category) => {
        return category.slug === activeCategorySlug;
      });
      if (!activeCategory) {
        activeCategory = _.find(this.props.categories, (category: Category) => {
          return category.slug === this.state.newCategorySlug;
        });
      }
    }
    if (!activeCategory) {
      activeCategory = {
        name: 'All Categories',  // [i18n]
        id: this.props.categoryId, // the forum root category id
        isForumItself: true,
      };
    }
    return activeCategory;
  },

  findTheUncategorizedCategory: function() {
    return _.find(this.props.categories, (category: Category) => {
        return category.isTheUncategorizedCategory;
    });
  },

  switchSortOrder: function(newRouteName: string) {
    this.transitionTo(newRouteName, this.getParams(), this.getQuery());
  },

  getSortOrderName: function(routeName?: string) {
    if (!routeName) {
      routeName = this.getCurrentRouteName();
    }
    switch (routeName) {
      case 'ForumRouteLatest': return "Latest";
      case 'ForumRouteTop': return "Top";
      case 'ForumRouteCategories': return "Categories";
    }
    console.error("Unknown route [DwE5KFIW2]");
  },

  getCurrentRouteName: function() {
    return _.last(this.getRoutes())['name'];
  },

  setTopicFilter: function(event) {
    var newQuery = _.clone(this.getQuery());
    if (event.target.value === 'ShowAll') {
      delete newQuery.filter;
    }
    else {
      newQuery.filter = event.target.value;
    }
    this.replaceWith(this.getCurrentRouteName(), this.getParams(), newQuery);
  },

  /* If using a filter dropdown + full search text field like GitHub does:
  activateFilter: function(filterKey: string) {
    this.setState({
      searchFilterKey: filterKey,
      searchText: this.searchTextForFilter(filterKey),
    });
  },

  searchTextForFilter: function(filterKey: string) {
    switch (filterKey) {
      case 'ShowAll': return '';
      case 'ShowWaiting': return 'is:open is:question-or-todo';
    }
  },

  updateSearchText: function(event) {
    this.setState({ searchText: event.target.value });
  }, */

  editCategory: function() {
    debiki2.forum['getEditCategoryDialog']().open(this.getActiveCategory().id);
  },

  createCategory: function() {
    debiki2.forum['getEditCategoryDialog']().open();
  },

  createTopic: function() {
    var anyReturnToUrl = window.location.toString().replace(/#/, '__dwHash__');
    d.i.loginIfNeeded('LoginToCreateTopic', anyReturnToUrl, () => {
      var category: Category = this.getActiveCategory();
      if (category.isForumItself) {
        category = this.findTheUncategorizedCategory();
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
        forum['getCreateTopicDialog']().open(category);
      }
    });
  },

  render: function() {
    var props: Store = this.props;
    var user = props.user;
    var activeCategory = this.getActiveCategory();
    if (!activeCategory) {
      // The user has typed a non-existing category slug in the URL. Or she has just created
      // a category, opened a page and then clicked Back in the browser. Then this page
      // reloads, and the browser then uses cached HTML including JSON in which the new
      // category does not yet exist. Let's try to reload the category list page:
      console.log("Category not found, navigating to forum index page [DwM5KPE2]");
      location.assign(location.pathname); // works right now when using hash fragment routing [hashrouting]
      return null;
    }

    var categoryMenuItems =
        props.categories.map((category: Category) => {
          return MenuItem({ eventKey: category.slug, key: category.id }, category.name);
        });
    categoryMenuItems.unshift(
      MenuItem({ eventKey: null, key: -1 }, 'All Categories'));

    var categoriesDropdown =
        r.div({ className: 'dw-main-category-dropdown' },
        DropdownButton({ title: activeCategory.name, onSelect: this.switchCategory },
          categoryMenuItems));

    var activeRoute = this.getRoutes()[this.getRoutes().length - 1];

    // The Latest/Top/Categories buttons, but use a dropdown if there's not enough space.
    var latestTopCategories;
    if (this.state.compact) {
      latestTopCategories =
        r.div({ className: 'dw-sort-order' },
          DropdownButton({ title: this.getSortOrderName(), onSelect: this.switchSortOrder },
            MenuItem({ eventKey: 'ForumRouteLatest' }, this.getSortOrderName('ForumRouteLatest')),
            MenuItem({ eventKey: 'ForumRouteTop' }, this.getSortOrderName('ForumRouteTop')),
            MenuItem({ eventKey: 'ForumRouteCategories' },
              this.getSortOrderName('ForumRouteCategories'))));
    }
    else {
      latestTopCategories =
          r.ul({ className: 'nav nav-pills dw-sort-order' },
            NavButton({ routeName: 'ForumRouteLatest' }, 'Latest'),
            NavButton({ routeName: 'ForumRouteTop' }, 'Top'),
            NavButton({ routeName: 'ForumRouteCategories' }, 'Categories'));
    }

    // The filter topics select.
    var topicFilterValue = this.getQuery().filter || 'ShowAll';
    var topicFilterInput =
        r.div({ className: 'dw-filter' },
          Input({ type: 'select', ref: 'topicFilterInput', onChange: this.setTopicFilter,
              value: topicFilterValue },
            r.option({ value: 'ShowAll' }, "Show all"),
            r.option({ value: 'ShowWaiting' }, "Show waiting")));
                                                      // or "Questions and todos"?

    /* A filter dropdown and search box instead of the <select> above:
    var makeFilterItemProps = (key: string) => {
      var props: any = { eventKey: key };
      if (this.state.searchFilterKey === key) {
        props.className = 'dw-active';
      }
      return props;
    }
    var topicsFilterButton =
        DropdownButton({ title: "Filter", onSelect: this.activateFilter },
          MenuItem(makeFilterItemProps('ShowAll'), "Show everything"),
          MenuItem(makeFilterItemProps('ShowWaiting'), "Show waiting"));
    var topicFilter =
        r.div({ className: 'dw-filter' },
          Input({ type: 'text', buttonBefore: topicsFilterButton, value: this.state.searchText,
              onChange: this.updateSearchText,
              // ElasticSearch disabled server side, and is:* not supported anyway.
              disabled: true, title: "Not completely implemented" }));
    */

    var createTopicBtn;
    if (activeRoute.name !== 'ForumRouteCategories') {
      createTopicBtn  = Button({ onClick: this.createTopic }, 'Create Topic');
    }

    var createCategoryBtn;
    if (activeRoute.name === 'ForumRouteCategories' && user.isAdmin) {
      createCategoryBtn = Button({ onClick: this.createCategory }, 'Create Category');
    }

    var editCategoryBtn;
    if (!activeCategory.isForumItself && user.isAdmin) {
      editCategoryBtn = Button({ onClick: this.editCategory }, 'Edit Category');
    }

    var viewProps = _.extend({}, this.props, {
      activeCategory: activeCategory,
      activeRoute: activeRoute,
      topicFilter: topicFilterValue,
    });

    return (
      r.div({},
        r.div({ className: 'dw-forum-actionbar clearfix' },
          categoriesDropdown,
          latestTopCategories,
          topicFilterInput,
          createTopicBtn,
          createCategoryBtn,
          editCategoryBtn),
        RouteHandler(viewProps)));
  }
});



var NavButton = createComponent({
  mixins: [RouterNavigationMixin, RouterStateMixin],
  onClick: function() {
    this.transitionTo(this.props.routeName, this.getParams(), this.getQuery());
  },
  render: function() {
    var isActive = this.isActive(this.props.routeName);
    var classes = isActive ? 'active' : '';
    return Button({ className: classes, onClick: this.onClick }, this.props.children);
  }
});



var ForumTopicListComponent = React.createClass({
  mixins: [RouterStateMixin],

  getInitialState: function() {
    // The server has included in the Flux store a list of the most recent topics, and we
    // can use that lis when rendering the topic list server side, or for the first time
    // in the browser (but not after that, because then new topics might have appeared).
    if (!this.props.topicsInStoreMightBeOld && this.isAllLatestTopicsView()) {
      return {
        topics: this.props.topics,
        showLoadMoreButton: this.props.topics.length >= NumNewTopicsPerRequest
      };
    }
    else {
      return {};
    }
  },

  isAllLatestTopicsView: function() {
    return this.getRoutes().length === 2 &&
        this.getRoutes()[1].name === 'ForumRouteLatest' &&
        !this.getParams().categorySlug;
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
    var isNewView =
        this.props.activeCategory.id !== nextProps.activeCategory.id ||
        this.props.activeRoute.name !== nextProps.activeRoute.name ||
        this.props.topicFilter !== nextProps.topicFilter;

    // Avoid loading the same topics many times:
    // - On page load, componentDidMount() and componentWillReceiveProps() both loads topics.
    // - When we're refreshing the page because of Flux events, don't load the same topics again.
    if (!isNewView && !loadMore && (this.state.topics || this.state.isLoading))
      return;

    var orderOffset: OrderOffset = this.getOrderOffset();
    orderOffset.topicFilter = nextProps.topicFilter;
    if (isNewView) {
      this.setState({
        minHeight: $(this.getDOMNode()).height(),
        topics: null,
        showLoadMoreButton: false
      });
      // Load from the start, no offset. Keep any topic filter though.
      delete orderOffset.time;
      delete orderOffset.numLikes;
    }
    var categoryId = nextProps.activeCategory.id;
    this.setState({ isLoading: true });
    debiki2.Server.loadForumTopics(categoryId, orderOffset, (newlyLoadedTopics: Topic[]) => {
      if (!this.isMounted())
        return;

      var topics = isNewView ? [] : (this.state.topics || []);
      topics = topics.concat(newlyLoadedTopics);
      // `topics` includes at least the last old topic twice.
      topics = _.uniq(topics, 'pageId');
      this.setState({
        minHeight: null,
        isLoading: false,
        topics: topics,
        showLoadMoreButton: newlyLoadedTopics.length >= NumNewTopicsPerRequest
      });
    });
  },

  getOrderOffset: function() {
    var anyTimeOffset: number;
    var anyLikesOffset: number;
    var anyLastTopic: any = _.last(this.state.topics);
    if (anyLastTopic) {
      // If we're loading more topics, we should continue with this offset.
      anyTimeOffset = anyLastTopic.bumpedEpoch || anyLastTopic.createdEpoch;
      anyLikesOffset = anyLastTopic.numLikes;
    }
    var orderOffset: OrderOffset = { sortOrder: -1 };
    if (this.isActive('ForumRouteTop')) {
      orderOffset.sortOrder = TopicSortOrder.LikesAndBumpTime;
      orderOffset.time = anyTimeOffset;
      orderOffset.numLikes = anyLikesOffset;
    }
    else {
      orderOffset.sortOrder = TopicSortOrder.BumpTime;
      orderOffset.time = anyTimeOffset;
    }
    return orderOffset;
  },

  render: function() {
    if (!this.state.topics) {
      // The min height preserves scrollTop, even though the topic list becomes empty
      // for a short while (which would otherwise reduce the windows height which
      // in turn might reduce scrollTop).
      // COULD make minHeight work when switching to the Categories view too? But should
      // then probably scroll the top of the categories list into view.
      // COULD use this.props.topics, used when rendering server side, but for now:
      return r.p({ style: { minHeight: this.state.minHeight } }, 'Loading...');
    }

    if (!this.state.topics.length)
      return r.p({}, 'No topics.');

    var topics = this.state.topics.map((topic: Topic) => {
      return TopicRow({ topic: topic, categories: this.props.categories,
          activeCategory: this.props.activeCategory, now: this.props.now,
          key: topic.pageId });
    });

    var loadMoreTopicsBtn;
    if (this.state.showLoadMoreButton) {
      var orderOffset = this.getOrderOffset();
      var queryString = '?' + debiki2.ServerApi.makeForumTopicsQueryParams(orderOffset);
      loadMoreTopicsBtn =
        r.div({},
          r.a({ className: 'load-more', onClick: this.onLoadMoreTopicsClick,
              href: queryString }, 'Load more ...'));
    }

    return (
      r.div({},
        r.table({ id: 'dw-topic-list' },
          r.thead({},
            r.tr({},
              r.th({}, 'Topic'),
              r.th({}, 'Category'),
              r.th({ className: 'num dw-tpc-replies' }, 'Replies'),
              r.th({ className: 'num' }, 'Activity'),
              r.th({ className: 'num' }, 'Feelings'))),
          r.tbody({},
            topics)),
        loadMoreTopicsBtn));
  }
});



var TopicRow = createComponent({
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

  render: function() {
    var topic: Topic = this.props.topic;
    var category = _.find(this.props.categories, (category: Category) => {
      return category.id === topic.categoryId;
    });

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

    var activityTitle =
      'Created on ' + dateTimeFix(topic.createdEpoch);

    if (topic.lastReplyEpoch) {
      activityTitle += '\nLast reply on ' + dateTimeFix(topic.lastReplyEpoch);
    }
    if (topic.bumpedEpoch && topic.bumpedEpoch !== topic.lastReplyEpoch) {
      activityTitle += '\nEdited on ' + dateTimeFix(topic.bumpedEpoch);
    }

    var anyPinIcon = topic.pinWhere ? 'icon-pin' : undefined;
    var showExcerpt = topic.pinWhere === PinPageWhere.Globally ||
        (topic.pinWhere && topic.categoryId === this.props.activeCategory.id);
    var excerptIfPinned = showExcerpt
        ? r.p({ className: 'dw-p-excerpt' }, topic.excerpt, r.a({ href: topic.url }, 'read more'))
        : null;

    var title = makeTitle(topic);

    var categoryName = category ? category.name : '';
    var activityAgo = timeAgo(topic.bumpedEpoch || topic.createdEpoch);
    return (
      r.tr({},
        r.td({ className: 'dw-tpc-title' },
          r.a({ href: topic.url, className: anyPinIcon }, title),
          excerptIfPinned),
        r.td({}, categoryName),
        r.td({ className: 'num dw-tpc-replies' }, topic.numPosts - 1),
        r.td({ className: 'num dw-tpc-activity', title: activityTitle }, activityAgo),
        r.td({ className: 'num dw-tpc-feelings' }, feelings)));
  }
});



var ForumCategoriesComponent = React.createClass({
  getInitialState: function() {
    return {};
  },

  componentDidMount: function() {
    this.loadCategories(this.props);
  },

  componentWillReceiveProps: function(nextProps) {
    this.loadCategories(nextProps);
  },

  loadCategories: function(props) {
    debiki2.Server.loadForumCategoriesTopics(this.props.pageId, props.topicFilter,
        (categories: Category[]) => {
      if (!this.isMounted())
        return;
      this.setState({ categories: categories });
    });
  },

  render: function() {
    if (!this.state.categories)
      return r.p({}, 'Loading...');

    var categoryRows = this.state.categories.map((category: Category) => {
      return CategoryRow({ category: category, key: category.id });
    });

    return (
      r.table({ className: 'forum-table table' },
        r.thead({},
          r.tr({},
            r.th({}, 'Category'),
            r.th({}, 'Recent Topics'))),
        r.tbody({},
          categoryRows)));
    }
});



var CategoryRow = createComponent({
  mixins: [RouterNavigationMixin, RouterStateMixin],

  onCategoryClick: function() {
    var newParams = { categorySlug: this.props.category.slug };
    this.transitionTo('ForumRouteLatest', newParams, this.getQuery());
  },

  render: function() {
    var category: Category = this.props.category;
    var recentTopicRows = category.recentTopics.map((topic: Topic) => {
      var pinIconClass = topic.pinWhere ? ' icon-pin' : '';
      var title = makeTitle(topic);
      return (
        r.tr({ key: topic.pageId },
          r.td({},
            r.a({ className: 'topic-title' + pinIconClass, href: topic.url }, title),
            r.span({ className: 'topic-details' },
              ' – ' + topic.numPosts + ' posts, ',
              timeAgo(topic.bumpedEpoch || topic.createdEpoch)))));
    });

    var description = category.isTheUncategorizedCategory
        ? null
        : r.p({ className: 'forum-description' }, category.description);

    return (
      r.tr({},
        r.td({ className: 'forum-info' },
          r.div({ className: 'forum-title-wrap' },
            r.a({ className: 'forum-title', onClick: this.onCategoryClick }, category.name)),
          description),
        r.td({},
          r.table({ className: 'topic-table-excerpt table table-condensed' },
            r.tbody({},
              recentTopicRows)))));
    }
});



function makeTitle(topic: Topic) {
  var title = topic.title;
  if (topic.closedAtMs && !isDone(topic) && !isAnswered(topic)) {
    var tooltip = makePageClosedTooltipText(topic.pageRole);
    var closedIcon = r.span({ className: 'icon-cancel-circled-empty' });
    title = r.span({ title: tooltip }, closedIcon, title);
  }
  else if (topic.pageRole === PageRole.Question) {
    var tooltip = makeQuestionTooltipText(topic.answeredAtMs);
    var questionIconClass = topic.answeredAtMs ? 'icon-ok-circled-empty' : 'icon-help-circled';
    var questionIcon = r.span({ className: questionIconClass });
    var answerIcon;
    var answerCount;
    // (Don't show answer count if question already solved — too much clutter.)
    if (!topic.answeredAtMs && topic.numOrigPostReplies > 0) {
      /* Skip this answer count stuff for now (or permanently?), too much clutter.
      answerIcon = r.span({ className: 'icon-info-circled dw-icon-inverted' }, ' ');
      answerCount = r.span({ className: 'dw-qa-ans-count' }, topic.numOrigPostReplies);
      */
      tooltip += " with " + topic.numOrigPostReplies;
      if (topic.numOrigPostReplies > 1) tooltip += "answers";
      else tooltip += "answer";
    }
    title = r.span({ title: tooltip }, questionIcon, answerCount, answerIcon, title);
  }
  else if (topic.pageRole === PageRole.Problem || topic.pageRole === PageRole.Idea) {
    // (Some dupl code, see [5KEFEW2] in posts.ts.
    if (!topic.plannedAtMs) {
      tooltip = topic.pageRole === PageRole.Problem
          ? "This is a new problem"
          : "This is a new idea";
      iconClass = topic.pageRole === PageRole.Problem ? 'icon-attention-circled' : 'icon-idea';
    }
    else if (!topic.doneAtMs) {
      tooltip = topic.pageRole === PageRole.Problem
          ? "We're planning to fix this"
          : "We're planning to do this";
      iconClass = 'icon-check-empty';
    }
    else {
      tooltip = topic.pageRole === PageRole.Problem
          ? "This has been fixed"
          : "This has been done";
      iconClass = 'icon-check';
    }
    title = r.span({ title: tooltip }, r.span({ className: iconClass }, title));
  }
  else if (topic.pageRole === PageRole.ToDo) {
    var iconClass = topic.doneAtMs ? 'icon-check' : 'icon-check-empty';
    var tooltip = topic.doneAtMs
        ? "This has been done or fixed"
        : "This is something to do or to fix";
    title = r.span({ title: tooltip }, r.span({ className: iconClass }, title));
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

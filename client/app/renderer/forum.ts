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

/// <reference path="../../shared/plain-old-javascript.d.ts" />
/// <reference path="../../typedefs/react/react.d.ts" />
/// <reference path="../../typedefs/moment/moment.d.ts" />
/// <reference path="../../typedefs/lodash/lodash.d.ts" />
/// <reference path="../editor/editor.ts" />
/// <reference path="../react-elements/topbar.ts" />
/// <reference path="../Server.ts" />
/// <reference path="../ServerApi.ts" />
/// <reference path="model.ts" />

//------------------------------------------------------------------------------
   module debiki2.renderer {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var reactCreateFactory = React['createFactory'];
var ReactBootstrap: any = window['ReactBootstrap'];
var Button = reactCreateFactory(ReactBootstrap.Button);
var DropdownButton = reactCreateFactory(ReactBootstrap.DropdownButton);
var MenuItem = reactCreateFactory(ReactBootstrap.MenuItem);

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
      r.div({ className: 'container' },
        debiki2.reactelements.TopBar({}),
        // Include .dw-page to make renderDiscussionPage() in startup.js run: (a bit hacky)
        r.div({ className: 'dw-page' }),
        CategoriesAndTopics(this.state || this.props)));
  }
});



var CategoriesAndTopics = createComponent({
  mixins: [RouterNavigationMixin, RouterStateMixin],

  getInitialState: function() {
    return {};
  },

  componentWillReceiveProps: function(nextProps) {
    // If we just created a new category, transition to the latest topics view for
    // that category.
    var newCatSlug = nextProps.newCategorySlug;
    if (newCatSlug && newCatSlug !== this.state.lastCreatedCategorySlug) {
      this.setState({ lastCreatedCategorySlug: newCatSlug });
      this.transitionTo('ForumRouteLatest', { categorySlug: newCatSlug });
    }
  },

  switchCategory: function(newCategorySlug) {
    var routes = this.getRoutes();
    var nextRouteName = routes[routes.length - 1].name;
    if (nextRouteName === 'ForumRouteCategories' || nextRouteName === 'ForumRouteDefault') {
      nextRouteName = 'ForumRouteLatest';
    }
    this.transitionTo(nextRouteName, { categorySlug: newCategorySlug });
  },

  getActiveCategory: function() {
    var activeCategorySlug = this.getParams().categorySlug;
    var activeCategory: any = {
      name: 'All Categories',
      pageId: this.props.pageId, // this is the forum id
      isForumItself: true,
    };
    if (activeCategorySlug) {
      activeCategory = _.find(this.props.categories, (category: Category) => {
        return category.slug === activeCategorySlug;
      });
    }
    return activeCategory;
  },

  editCategory: function() {
    location.href = '/-' + this.getActiveCategory().pageId;
  },

  createCategory: function() {
    this.createChildPage(PageRole.Category);
  },

  createTopic: function() {
    this.createChildPage(PageRole.Discussion);
  },

  createChildPage: function(role: PageRole) {
    var anyReturnToUrl = window.location.toString().replace(/#/, '__dwHash__');
    d.i.loginIfNeeded('LoginToCreateTopic', anyReturnToUrl, () => {
      var parentPageId = this.getActiveCategory().pageId;
      debiki2.editor.editNewForumPage(parentPageId, role);
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
      location.assign(location.pathname); // works right now when using hash fragment routing [hashrouting]
    }

    var categoryMenuItems =
        props.categories.map((category: Category) => {
          return MenuItem({ eventKey: category.slug, key: category.pageId }, category.name);
        });
    categoryMenuItems.unshift(
      MenuItem({ eventKey: null, key: -1 }, 'All Categories'));

    var categoriesDropdown =
        r.div({ className: 'dw-main-category-dropdown' },
        DropdownButton({ title: activeCategory.name, onSelect: this.switchCategory },
          categoryMenuItems));

    var activeRoute = this.getRoutes()[this.getRoutes().length - 1];

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

    var viewProps = _.clone(this.props);
    viewProps.activeCategory = activeCategory;
    viewProps.activeRoute = activeRoute;

    return (
      r.div({},
        r.div({ className: 'dw-forum-actionbar clearfix' },
          categoriesDropdown,
          createTopicBtn,
          createCategoryBtn,
          editCategoryBtn,
          r.ul({ className: 'nav nav-pills' },
            NavButton({ routeName: 'ForumRouteLatest' }, 'Latest'),
            NavButton({ routeName: 'ForumRouteTop' }, 'Top'),
            NavButton({ routeName: 'ForumRouteCategories' }, 'Categories'))),
        RouteHandler(viewProps)));
  }
});



var NavButton = createComponent({
  mixins: [RouterNavigationMixin, RouterStateMixin],
  onClick: function() {
    this.transitionTo(this.props.routeName, this.getParams());
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
        this.props.activeCategory.pageId !== nextProps.activeCategory.pageId ||
        this.props.activeRoute.name !== nextProps.activeRoute.name;

    // Avoid loading the same topics many times:
    // - On page load, componentDidMount() and componentWillReceiveProps() both loads topics.
    // - When we're refreshing the page because of Flux events, don't load the same topics again.
    if (!isNewView && !loadMore && (this.state.topics || this.state.isLoading))
      return;

    var orderOffset: OrderOffset = this.getOrderOffset();
    if (isNewView) {
      this.setState({
        topics: null,
        showLoadMoreButton: false
      });
      // Load from the start, no offset.
      delete orderOffset.time;
      delete orderOffset.numLikes;
    }
    var categoryId = nextProps.activeCategory.pageId;
    this.setState({ isLoading: true });
    debiki2.Server.loadForumTopics(categoryId, orderOffset, (newlyLoadedTopics: Topic[]) => {
      if (!this.isMounted())
        return;

      var topics = isNewView ? [] : (this.state.topics || []);
      topics = topics.concat(newlyLoadedTopics);
      // `topics` includes at least the last old topic twice.
      topics = _.uniq(topics, 'pageId');
      this.setState({
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
      // COULD use this.props.topics, used when rendering server side, but for now:
      return r.p({}, 'Loading...');
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
      return category.pageId === topic.categoryId;
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
      'Created on ' + new Date(topic.createdEpoch).toUTCString();

    if (topic.lastReplyEpoch) {
      activityTitle += '\nLast reply on ' + new Date(topic.lastReplyEpoch).toUTCString();
    }
    if (topic.bumpedEpoch && topic.bumpedEpoch !== topic.lastReplyEpoch) {
      activityTitle += '\nEdited on ' + new Date(topic.bumpedEpoch).toUTCString();
    }

    var anyPinIcon = topic.pinWhere ? 'icon-pin' : undefined;
    var showExcerpt = topic.pinWhere === PinPageWhere.Globally ||
        (topic.pinWhere && (
            topic.categoryId === this.props.activeCategory.pageId ||
            topic.pageId === this.props.activeCategory.pageId)); // hack, will vanish when forum
                                                // categories have their own db table [forumcategory]
    var excerptIfPinned = showExcerpt
        ? r.p({ className: 'dw-p-excerpt' }, topic.excerpt, r.a({ href: topic.url }, 'read more'))
        : null;

    var title = topic.title;

    if (topic.pageRole === PageRole.Question) {
      var tooltip = "This is an unsolved question or problem"
      var questionIcon = r.span({ className: 'icon-help-circled' });
      var answerIcon;
      var answerCount;
      if (topic.numOrigPostReplies > 0) {
        answerIcon = r.span({ className: 'icon-info-circled dw-icon-inverted' }, ' ');
        answerCount = r.span({ className: 'dw-qa-ans-count' }, topic.numOrigPostReplies);
        tooltip += " with " + topic.numOrigPostReplies + " answers";
      }
      title = r.span({ title: tooltip }, questionIcon, answerCount, answerIcon, title);
    }

    if (topic.pageRole === PageRole.ToDo) {
      var iconClass = topic.doneAtMs ? 'icon-check' : 'icon-check-empty';
      var tooltip = topic.doneAtMs
          ? "This has been done or fixed"
          : "This is something to do or to fix, not yet done";
      title = r.span({ title: tooltip }, r.span({ className: iconClass }, title));
    }

    var categoryName = category ? category.name : '';
    var activityAgo = moment(topic.bumpedEpoch || topic.createdEpoch).from(this.props.now);
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
    this.loadCategories();
  },

  componentWillReceiveProps: function() {
    this.loadCategories();
  },

  loadCategories: function() {
    debiki2.Server.loadForumCategoriesTopics(this.props.pageId, (categories: Category[]) => {
      if (!this.isMounted())
        return;
      this.setState({ categories: categories });
    });
  },

  render: function() {
    if (!this.state.categories)
      return r.p({}, 'Loading...');

    var categoryRows = this.state.categories.map((category: Category) => {
      return CategoryRow({ category: category, key: category.pageId });
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
    this.transitionTo('ForumRouteLatest', { categorySlug: this.props.category.slug });
  },

  render: function() {
    var category: Category = this.props.category;
    var recentTopicRows = category.recentTopics.map((topic: Topic) => {
      var pinIconClass = topic.pinWhere ? ' icon-pin' : '';
      return (
        r.tr({ key: topic.pageId },
          r.td({},
            r.a({ className: 'topic-title' + pinIconClass, href: topic.url }, topic.title),
            r.span({ className: 'topic-details' },
              ' – ' + topic.numPosts + ' posts, ',
              moment(topic.bumpedEpoch || topic.createdEpoch).from(this.props.now)))));
    });
    return (
      r.tr({},
        r.td({ className: 'forum-info' },
          r.div({ className: 'forum-title-wrap' },
            r.a({ className: 'forum-title', onClick: this.onCategoryClick }, category.name)),
          r.p({ className: 'forum-description' }, category.description),
          r.p({ className: 'topic-count' }, category.numTopics + ' topics')),
        r.td({},
          r.table({ className: 'topic-table-excerpt table table-condensed' },
            r.tbody({},
              recentTopicRows)))));
    }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list

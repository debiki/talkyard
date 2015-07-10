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
/// <reference path="../Server.ts" />
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
var Navigation = ReactRouter.Navigation;
var State = ReactRouter.State;
var RouteHandler = ReactRouter.RouteHandler;
var Route = ReactRouter.Route;
var Redirect = ReactRouter.Redirect;
var DefaultRoute = ReactRouter.DefaultRoute;

/** Keep in sync with app/controllers/ForumController.NumTopicsToList. */
var NumNewTopicsPerRequest = 40;

export function buildForumRoutes() {
  return (
    Route({ name: 'ForumRoute', path: '/', handler: Forum },
      Redirect({ from: '/', to: '/latest/' }),
      Route({ name: 'ForumRouteLatest', path: 'latest/:categorySlug?', handler: ForumTopicList }),
      Route({ name: 'ForumRouteTop', path: 'top/:categorySlug?', handler: ForumTopicList }),
      Route({ name: 'ForumRouteCategories', path: 'categories', handler: ForumCategories })));
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


export var Forum = createComponent({
  mixins: [debiki2.StoreListenerMixin],

  onChange: function() {
    this.setState(debiki2.ReactStore.allData());
  },

  render: function() {
    return (
      r.div({},
        // Include .dw-page to make renderDiscussionPage() in startup.js run: (hacky...)
        r.div({ className: 'dw-page' }),
        CategoriesAndTopics(this.state || this.props)));
  }
});



export var CategoriesAndTopics = createComponent({
  mixins: [Navigation, State],

  getInitialState: function() {
    return {};
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
    this.createChildPage('ForumCategory');
  },

  createTopic: function() {
    this.createChildPage('ForumTopic');
  },

  createChildPage: function(role: string) {
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

    var categoryMenuItems =
        props.categories.map((category) => {
          return MenuItem({ eventKey: category.slug }, category.name);
        });
    categoryMenuItems.unshift(
      MenuItem({ eventKey: null }, 'All Categories'));

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
    if (activeRoute.name === 'ForumRouteCategories' && user.isAdmin
          && false) {  // disable for now, until I auto create about-this-category topics a la Discourse
                      // When uncommenting
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
  mixins: [Navigation, State],
  onClick: function() {
    this.transitionTo(this.props.routeName, this.getParams());
  },
  render: function() {
    var isActive = this.isActive(this.props.routeName);
    var classes = isActive ? 'active' : '';
    return Button({ className: classes, onClick: this.onClick }, this.props.children);
  }
});



export var ForumTopicList = createComponent({
  mixins: [State],

  getInitialState: function() {
    return {};
  },

  componentDidMount: function() {
    this.loadTopics(this.props.activeCategory.pageId, false);
  },

  componentWillReceiveProps: function(nextProps) {
    var keepCurrentTopics =
        this.props.activeCategory.pageId === nextProps.activeCategory.pageId &&
        this.props.activeRoute.name === nextProps.activeRoute.name;
    this.loadTopics(nextProps.activeCategory.pageId, keepCurrentTopics);
  },

  onLoadMoreTopicsClick: function() {
    this.loadTopics(this.props.activeCategory.pageId, true);
  },

  loadTopics: function(categoryId, keepCurrentTopics) {
    var anyLastTopic;
    var anyTimeOffset: number;
    var anyLikesOffset: number;
    if (!keepCurrentTopics) {
      this.setState({
        topics: null,
        showLoadMoreButton: false
      });
    }
    else {
      anyLastTopic = _.last(this.state.topics);
      if (anyLastTopic) {
        anyTimeOffset = anyLastTopic.bumpedEpoch || anyLastTopic.createdEpoch;
        anyLikesOffset = anyLastTopic.numLikes;
      }
    }

    var orderOffset: OrderOffset = { sortOrder: null };
    if (this.isActive('ForumRouteTop')) {
      orderOffset.sortOrder = TopicSortOrder.LikesAndBumpTime;
      orderOffset.time = anyTimeOffset;
      orderOffset.numLikes = anyLikesOffset;
    }
    else {
      orderOffset.sortOrder = TopicSortOrder.BumpTime;
      orderOffset.time = anyTimeOffset;
    }
    debiki2.Server.loadForumTopics(categoryId, orderOffset, (topics: Topic[]) => {
      if (!this.isMounted())
        return;

      var newTopics = keepCurrentTopics ? (this.state.topics || []) : [];
      newTopics = newTopics.concat(topics);
      // `newTopics` includes at least the last old topic twice.
      newTopics = _.uniq(newTopics, 'pageId');
      this.setState({
        topics: newTopics,
        showLoadMoreButton: topics.length >= NumNewTopicsPerRequest
      });
    });
  },

  render: function() {
    if (!this.state.topics) {
      // COULD use this.props.topics, used when rendering server side, but for now:
      return r.p({}, 'Loading...');
    }

    if (!this.state.topics.length)
      return r.p({}, 'No topics.');

    var topics = this.state.topics.map((topic) => {
      return TopicRow({ topic: topic, categories: this.props.categories, now: this.props.now });
    });

    var loadMoreTopicsBtn;
    if (this.state.showLoadMoreButton) {
      loadMoreTopicsBtn =
        r.div({},
          r.a({ className: 'load-more', onClick: this.onLoadMoreTopicsClick }, 'Load more ...'));
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
          r.span({ className: 'icon-heart', style: heartStyle }));
    }
    var wrongStyle = this.styleFeeeling(topic.numWrongs, topic.numPosts);
    if (wrongStyle) {
      feelingsIcons.push(
          r.span({ className: 'icon-warning', style: wrongStyle }));
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

    var categoryName = category ? category.name : '';
    var activityAgo = moment(topic.bumpedEpoch || topic.createdEpoch).from(this.props.now);
    return (
      r.tr({},
        r.td({}, r.a({ href: topic.url }, topic.title)),
        r.td({}, categoryName),
        r.td({ className: 'num dw-tpc-replies' }, topic.numPosts - 1),
        r.td({ className: 'num dw-tpc-activity', title: activityTitle }, activityAgo),
        r.td({ className: 'num dw-tpc-feelings' }, feelings)));
  }
});



export var ForumCategories = createComponent({
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
    debiki2.Server.loadForumCategories(this.props.pageId, (categories: Category[]) => {
      if (!this.isMounted())
        return;
      this.setState({ categories: categories });
    });
  },

  render: function() {
    if (!this.state.categories)
      return r.p({}, 'Loading...');

    var categoryRows = this.state.categories.map((category) => {
      return CategoryRow({ category: category });
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
  mixins: [Navigation, State],

  onCategoryClick: function() {
    this.transitionTo('ForumRouteLatest', { categorySlug: this.props.category.slug });
  },

  render: function() {
    var category = this.props.category;
    var recentTopicRows = category.recentTopics.map((topic) => {
      return (
        r.tr({},
          r.td({},
            r.a({ className: 'topic-title', href: topic.url }, topic.title),
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

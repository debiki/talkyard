/**
 * Copyright (C) 2016 Kaj Magnus Lindberg
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
/// <reference path="../slim-bundle.d.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.users {
//------------------------------------------------------------------------------

let r = React.DOM;
let Nav = rb.Nav;
let NavItem = rb.NavItem;
let Post = page.Post;


export let UsersActivityComponent = React.createClass(<any> {
  contextTypes: {
    router: React.PropTypes.object.isRequired
  },

  transitionTo: function(what) {
    this.props.transitionTo('activity/' + what);
  },

  render: function() {
    let childProps = {
      store: this.props.store,
      user: this.props.user,
      reloadUser: this.props.loadCompleteUser,
    };
    let activeRouteName = this.props.routes[3].path;

    return (
     r.div({ style: { display: 'table', width: '100%' }},
       r.div({ style: { display: 'table-row' }},
         r.div({ className: 's_UP_Act_Nav' },
           Nav({ bsStyle: 'pills', activeKey: activeRouteName,
               onSelect: this.transitionTo, className: 'dw-sub-nav nav-stacked' },
             NavItem({ eventKey: 'posts' }, "Posts"),
             NavItem({ eventKey: 'topics' }, "Topics"))),
             //NavItem({ eventKey: 'likes-given' }, "Likes Given"),
             //NavItem({ eventKey: 'likes-received' }, "Likes Received"))),
         r.div({ className: 's_UP_Act_List' },
           React.cloneElement(this.props.children, childProps)))));
  }
});



export let PostsComponent = React.createClass(<any> {
  getInitialState: function() {
    return { posts: null };
  },

  componentDidMount: function() {
    let user: CompleteUser = this.props.user;
    this.loadPosts(user.id);
  },

  componentWillReceiveProps: function(nextProps) {
    // a bit dupl code [5AWS2E9]
    let me: Myself = this.props.store.me;
    let user: CompleteUser = this.props.user;
    let nextMe: Myself = nextProps.store.me;
    let nextUser: CompleteUser = nextProps.user;
    // If we log in as someone else, which posts we may see might change.
    if (me.userId !== nextMe.userId || user.id !== nextUser.id) {
      this.loadPosts(nextUser.id);
    }
  },

  loadPosts: function(userId: number) {
    let me: Myself = this.props.store.me;
    Server.loadPostsByAuthor(userId, (response: any) => {
      this.setState({
        posts: response.posts,
        author: response.author,
      });
    }, () => {
      // Forget all posts, in case we're no longer allowed to view the posts.
      this.setState({ error: true, posts: null });
    });
  },

  render: function() {
    let store: Store = this.props.store;
    let me: Myself = store.me;
    let posts: PostWithPage[] = this.state.posts;
    let author: BriefUser = this.state.author;
    if (!_.isArray(posts))
      return (
        r.p({}, "Loading ..."));

    let postElems = posts.map((post: PostWithPage) => {
      return (
        r.li({ key: post.postId, className: 's_UP_Act_Ps_P' },
          r.a({ href: linkToPostNr(post.pageId, post.postId),
              className: 's_UP_Act_Ps_P_Link ' + pageRole_iconClass(post.pageRole) },
            post.pageTitle),
          avatar.Avatar({ user: author }),
          Post({ post: post,  me: me, author: author }))); // author: [4WKA8YB]
    });

    return (
      r.ol({ className: 's_UP_Act_Ps' }, postElems));
  }
});



export let TopicsComponent = React.createClass(<any> {
  getInitialState: function() {
    return { topics: null };
  },

  componentDidMount: function() {
    let user: CompleteUser = this.props.user;
    this.loadTopics(user.id);
  },

  componentWillReceiveProps: function(nextProps) {
    // a bit dupl code [5AWS2E9]
    let me: Myself = this.props.store.me;
    let user: CompleteUser = this.props.user;
    let nextMe: Myself = nextProps.store.me;
    let nextUser: CompleteUser = nextProps.user;
    // If we log in as someone else, which topics we may see might change.
    if (me.userId !== nextMe.userId || user.id !== nextUser.id) {
      this.loadTopics(nextUser.id);
    }
  },

  loadTopics: function(userId: number) {
    Server.loadTopicsByUser(userId, (topics: Topic[]) => {
      this.setState({ topics: topics });
    });
  },

  render: function() {
    let store: Store = this.props.store;
    let me: Myself = store.me;
    let topics: Topic[] = this.state.topics;
    if (!_.isArray(topics))
      return (
        r.p({}, "Loading ..."));

    let topicsElems = forum.ListTopicsComponent({
      topics: this.state.topics,
      store: this.props.store,
      useTable: true,
      minHeight: 300,
      showLoadMoreButton: false,
      activeCategory: {},
      orderOffset: <OrderOffset> { sortOrder: TopicSortOrder.BumpTime },
      // `routes` and `location` only needed if making categories clickable. [7FKR0QA]
      linkCategories: false,
      routes: null,
      location: null,
    });

    return (
      r.ol({ className: 's_UP_Act_Ts' },
        topicsElems));
  }
});



export let LikesGivenComponent = React.createClass(<any> {
  render: function() {
    return (
      r.p({}, "Not yet implemented 4"));
  }
});



export let LikesReceivedComponent = React.createClass(<any> {
  render: function() {
    return (
      r.p({}, "Not yet implemented 5"));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list

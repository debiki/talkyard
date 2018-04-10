/**
 * Copyright (c) 2016, 2017 Kaj Magnus Lindberg
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

/// <reference path="../slim-bundle.d.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.users {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const Post = page.Post;
const UsersPathSlash = UsersRoot;
const SlashActivitySlash = '/activity/';  // dupl [4GKQST20]


export const UsersActivity = createFactory({
  displayName: 'UsersActivity',

  render: function() {
    const user: MemberInclDetails = this.props.user;
    const me: Myself = this.props.store.me;
    const isStaffOrSelf = isStaff(me) || user.id === me.id;
    const hiddenForMe = user.seeActivityMinTrustLevel > me.trustLevel && !isStaffOrSelf;

    const hiddenForSomeText = !isStaffOrSelf ? null : (
        user.seeActivityMinTrustLevel >= TrustLevel.CoreMember ?
          "Only staff and trusted core members, can see this." : (
            user.seeActivityMinTrustLevel >= TrustLevel.FullMember ?
              "Only people who have been active members for a while can see this." : null));

    const hiddenForSomeElem = hiddenForSomeText ?
        r.p({ className: 's_UP_Act_Hdn' }, hiddenForSomeText) : null;

    const childProps = {
      store: this.props.store,
      user: this.props.user,
      reloadUser: this.props.loadCompleteUser,
    };

    const childRoute = hiddenForMe ? null : Switch({},
      Route({ path: '(.*)/posts', exact: true, render: () => UsersPosts(childProps) }),
      Route({ path: '(.*)/topics', exact: true, render: () => UsersTopics(childProps) }));
      // (.*)/mentions? Flarum includes mentions *of* the user, but wouldn't it make more sense
      // to include mentions *by* the user? Discourse shows: (but -received in the notfs tab)
      //Route({ path: 'likes-given', component: LikesGivenComponent }),
      //Route({ path: 'likes-received', component: LikesReceivedComponent })

    const uap = UsersPathSlash + this.props.match.params.usernameOrId + SlashActivitySlash;

    return (
      // Without table-layout: fixed, the table can become 5000 px wide, because otherwise the
      // default layout is width = as wide as the widest cell wants to be.
      r.div({ style: { display: 'table', width: '100%', tableLayout: 'fixed' }},
        r.div({ style: { display: 'table-row' }},
          r.div({ className: 's_UP_Act_Nav' },
            r.ul({ className: 'dw-sub-nav nav-stacked nav nav-pills' },
              LiNavLink({ to: uap + 'posts', className: 's_UP_Act_Nav_PostsB' }, "Posts"),
              LiNavLink({ to: uap + 'topics', className: 's_UP_Act_Nav_TopicsB' }, "Topics"))),
              //LiNavLink({ to: uap + 'likes-given' }, "Likes Given"),
              //LiNavLink({ to: uap + 'likes-received' }, "Likes Received"))),
          r.div({ className: 's_UP_Act_List' },
            hiddenForSomeElem,
            childRoute))));
  }
});



const UsersPosts = createFactory({
  displayName: 'UsersPosts',

  getInitialState: function() {
    return { posts: null };
  },

  componentDidMount: function() {
    let user: MemberInclDetails = this.props.user;
    this.loadPosts(user.id);
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  componentWillReceiveProps: function(nextProps) {
    // a bit dupl code [5AWS2E9]
    const store: Store = this.props.store;
    const nextStore: Store = nextProps.store;
    let me: Myself = store.me;
    let user: MemberInclDetails = this.props.user;
    let nextMe: Myself = nextStore.me;
    let nextUser: MemberInclDetails = nextProps.user;
    // If we log in as someone else, which posts we may see might change.
    if (me.id !== nextMe.id || user.id !== nextUser.id) {
      this.loadPosts(nextUser.id);
    }
  },

  loadPosts: function(userId: UserId) {
    if (this.nowLoading === userId) return;
    this.nowLoading = userId;
    Server.loadPostsByAuthor(userId, (response: any) => {
      this.nowLoading = null;
      if (this.isGone) return;
      this.setState({
        posts: response.posts,
        author: response.author,
      });
    });
  },

  render: function() {
    let store: Store = this.props.store;
    let posts: PostWithPage[] = this.state.posts;
    let author: BriefUser = this.state.author;
    if (!_.isArray(posts))
      return (
        r.p({}, "Loading ..."));

    if (_.isEmpty(posts))
      return (
        r.p({}, "No posts."));

    let postElems = posts.map((post: PostWithPage) => {
      return (
        r.li({ key: post.uniqueId, className: 's_UP_Act_Ps_P' },
          Link({ to: linkToPostNr(post.pageId, post.nr),
              className: 's_UP_Act_Ps_P_Link ' + pageRole_iconClass(post.pageRole) },
            post.pageTitle),
          avatar.Avatar({ user: author, size: AvatarSize.Small }),
          Post({ post, store, author }))); // author: [4WKA8YB]
    });

    return (
      r.ol({ className: 's_UP_Act_Ps' }, postElems));
  }
});



const UsersTopics = createFactory({
  displayName: 'UsersTopics',

  getInitialState: function() {
    return { topics: null };
  },

  componentDidMount: function() {
    let user: MemberInclDetails = this.props.user;
    this.loadTopics(user.id);
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  componentWillReceiveProps: function(nextProps) {
    // a bit dupl code [5AWS2E9]
    const store: Store = this.props.store;
    const nextStore: Store = nextProps.store;
    let me: Myself = store.me;
    let user: MemberInclDetails = this.props.user;
    let nextMe: Myself = nextStore.me;
    let nextUser: MemberInclDetails = nextProps.user;
    // If we log in as someone else, which topics we may see might change.
    if (me.id !== nextMe.id || user.id !== nextUser.id) {
      this.loadTopics(nextUser.id);
    }
  },

  loadTopics: function(userId: UserId) {
    if (this.nowLoading === userId) return;
    this.nowLoading = userId;
    Server.loadTopicsByUser(userId, (topics: Topic[]) => {
      this.nowLoading = null;
      if (this.isGone) return;
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

    let topicsElems = forum.TopicsList({
      topics: this.state.topics,
      store: this.props.store,
      useTable: true,
      minHeight: 300,
      showLoadMoreButton: false,
      activeCategory: {},
      orderOffset: <OrderOffset> { sortOrder: TopicSortOrder.CreatedAt },
      linkCategories: false,
    });

    return (
      r.ol({ className: 's_UP_Act_Ts' },
        topicsElems));
  }
});



export let LikesGivenComponent = createReactClass(<any> {
  render: function() {
    return (
      r.p({}, "Not yet implemented 4"));
  }
});



export let LikesReceivedComponent = createReactClass(<any> {
  render: function() {
    return (
      r.p({}, "Not yet implemented 5"));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list

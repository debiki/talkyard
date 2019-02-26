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

/// <reference path="../more-prelude.more.ts" />
/// <reference path="user-summary.more.ts" />

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
    const store: Store = this.props.store;
    const user: MemberInclDetails = this.props.user;
    const me: Myself = store.me;

    const childProps = {
      store,
      user,
      me,
      stats: this.props.stats, // for the Summary page
      reloadUser: this.props.loadCompleteUser,
    };

    const childRoute = Switch({},
      // Why Summary here, in 2nd level nav? Not in 1st level nav like Discourse does?
      // The user summary is really an acctivity summary, and should be here.
      // It's about as easy to find here, because Activity|Posts is the default tab,
      // meaning, Summary will be visible just above.
      // And having it here, means there'll be fewer 1st level navs, which is
      // good in Talkyards case, since Ty has the Drafts 1st level tab.
      Route({ path: '(.*)/summary', exact: true, render: () => UserSummary(childProps) }),
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
              user.isGroup ? null :
                  LiNavLink({ to: uap + 'summary', className: 'e_ActSmryB' }, t.Summary),
              LiNavLink({ to: uap + 'posts', className: 's_UP_Act_Nav_PostsB' },
                t.upp.Posts),
              LiNavLink({ to: uap + 'topics', className: 's_UP_Act_Nav_TopicsB' },
                t.upp.Topics))),
              //LiNavLink({ to: uap + 'likes-given' }, "Likes Given"),
              //LiNavLink({ to: uap + 'likes-received' }, "Likes Received"))),
          r.div({ className: 's_UP_Act_List', id: 't_UP_Act_List' },
            childRoute))));
  }
});



function isHiddenForMe(me: Myself, user: MemberInclDetails): boolean[] {
  const isStaffOrSelf = isStaff(me) || user.id === me.id;
  const hiddenForMe = user.seeActivityMinTrustLevel > me.trustLevel && !isStaffOrSelf;
  return [isStaffOrSelf, hiddenForMe];
}



function makeMaybeHiddenInfo(me: Myself, user: MemberInclDetails) {
  const [isStaffOrSelf, hiddenForMe] = isHiddenForMe(me, user);
  const hiddenForSomeText = !isStaffOrSelf ? null : (
      user.seeActivityMinTrustLevel >= TrustLevel.CoreMember ?
        t.upp.OnlyStaffCanSee : (
          user.seeActivityMinTrustLevel >= TrustLevel.FullMember ?
            t.upp.OnlyMbrsCanSee : null));

  const hiddenForSomeElem = hiddenForSomeText ?
      r.p({ className: 's_UP_Act_Hdn' }, hiddenForSomeText) : null;

  // Instead of "No posts" or "No topics", write "Nothing to show" — because maybe
  // there *are* posts and topics, it's just that the activity is hidden.
  const nothingToShow = !hiddenForMe ? null :
    r.p({ className: 'e_NothingToShow' }, t.upp.Nothing);

  return rFragment({}, hiddenForSomeElem, nothingToShow);
}



const UsersPosts = createFactory({
  displayName: 'UsersPosts',

  getInitialState: function() {
    return { posts: null };
  },

  componentDidMount: function() {
    const me: Myself = this.props.store.me;
    const user: MemberInclDetails = this.props.user;
    this.loadPosts(me, user);
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  componentWillReceiveProps: function(nextProps) {
    // a bit dupl code [5AWS2E9]
    const store: Store = this.props.store;
    const nextStore: Store = nextProps.store;
    const me: Myself = this.props.me;  // not store.me, it's been modif in-place [redux]
    const user: MemberInclDetails = this.props.user;
    const nextMe: Myself = nextStore.me;
    const nextUser: MemberInclDetails = nextProps.user;
    // If we log in as someone else, which posts we may see might change.
    if (me.id !== nextMe.id || user.id !== nextUser.id) {
      this.loadPosts(nextMe, nextUser);
    }
  },

  loadPosts: function(me: Myself, user: MemberInclDetails) {
    // a bit dupl code [5AWS2E8]
    const [isStaffOrSelf, hiddenForMe] = isHiddenForMe(me, user);
    if (hiddenForMe) {
      this.setState({ posts: [], author: null });
      return;
    }
    if (this.nowLoading === user.id) return;
    this.nowLoading = user.id;
    Server.loadPostsByAuthor(user.id, (response: any) => {
      this.nowLoading = null;
      if (this.isGone) return;
      this.setState({
        posts: response.posts,
        author: response.author,
      }, () => {
        // BUG but rather harmless. Runs processPosts (e.g. MathJax) also on topic titles,
        // although that's not done in the forum topic list or full page title.
        // BUG (but not really my bug): MathJax also runs on topics in the watchbar.
        // Should instead iterate over all posts, give to processPosts one at a time?
        // (Right now, MathJax would process math like `\[....\]` inside titles, here, which
        // might look a bit funny.)
        debiki2.page.Hacks.processPosts('t_UP_Act_List');
      });
    });
  },

  render: function() {
    const store: Store = this.props.store;
    const me: Myself = this.props.me;
    const user: MemberInclDetails = this.props.user;
    const posts: PostWithPage[] = this.state.posts;
    const author: BriefUser = this.state.author;
    if (!_.isArray(posts))
      return (
        r.p({}, t.Loading));

    const noPostsClass = _.isEmpty(posts) ? ' e_NoPosts' : '';

    const postElems = posts.map((post: PostWithPage) => {
      return (
        r.li({ key: post.uniqueId, className: 's_UP_Act_Ps_P' },
          Link({ to: linkToPostNr(post.pageId, post.nr),
              className: 's_UP_Act_Ps_P_Link ' + pageRole_iconClass(post.pageRole) },
            post.pageTitle),
          avatar.Avatar({ user: author, origins: store, size: AvatarSize.Small }),
          Post({ post, store, author }))); // author: [4WKA8YB]
    });

    return rFragment({},
      makeMaybeHiddenInfo(me, user),
      r.ol({ className: 's_UP_Act_Ps' + noPostsClass }, postElems));
  }
});



const UsersTopics = createFactory({
  displayName: 'UsersTopics',

  getInitialState: function() {
    return { topics: null };
  },

  componentDidMount: function() {
    const me: Myself = this.props.store.me;
    const user: MemberInclDetails = this.props.user;
    this.loadTopics(me, user);
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  componentWillReceiveProps: function(nextProps) {
    // a bit dupl code [5AWS2E9]
    const store: Store = this.props.store;
    const nextStore: Store = nextProps.store;
    const me: Myself = this.props.me;  // not store.me, it's been modif in-place [redux]
    const user: MemberInclDetails = this.props.user;
    const nextMe: Myself = nextStore.me;
    const nextUser: MemberInclDetails = nextProps.user;
    // If we log in as someone else, which topics we may see might change.
    if (me.id !== nextMe.id || user.id !== nextUser.id) {
      this.loadTopics(nextMe, nextUser);
    }
  },

  loadTopics: function(me: Myself, user: MemberInclDetails) {
    // a bit dupl code [5AWS2E8]
    const [isStaffOrSelf, hiddenForMe] = isHiddenForMe(me, user);
    if (hiddenForMe) {
      this.setState({ topics: [] });
      return;
    }
    if (this.nowLoading === user.id) return;
    this.nowLoading = user.id;
    Server.loadTopicsByUser(user.id, (topics: Topic[]) => {
      this.nowLoading = null;
      if (this.isGone) return;
      this.setState({ topics: topics });
    });
  },

  render: function() {
    const store: Store = this.props.store;
    const user: MemberInclDetails = this.props.user;
    const me: Myself = store.me;
    const topics: Topic[] = this.state.topics;
    if (!_.isArray(topics))
      return (
        r.p({}, t.Loading));

    const noTopicsClass = _.isEmpty(topics) ? ' e_NoTopics' : '';

    const topicsElems = forum.TopicsList({
      topics: this.state.topics,
      store: this.props.store,
      useTable: true,
      minHeight: 300,
      showLoadMoreButton: false,
      activeCategory: {},
      orderOffset: <OrderOffset> { sortOrder: TopicSortOrder.CreatedAt },
      linkCategories: false,
    });

    return rFragment({},
      makeMaybeHiddenInfo(me, user),
      r.ol({ className: 's_UP_Act_Ts' + noTopicsClass },
        topicsElems));
  }
});



export const LikesGivenComponent = createReactClass(<any> {
  render: function() {
    return (
      r.p({}, "Not impl 4"));
  }
});



export const LikesReceivedComponent = createReactClass(<any> {
  render: function() {
    return (
      r.p({}, "Not impl 5"));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list

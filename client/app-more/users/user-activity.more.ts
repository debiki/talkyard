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
const SlashActivitySlash = '/activity/';


export const UsersActivity = createFactory<PatStatsPanelProps, any>({
  displayName: 'UsersActivity',

  render: function() {
    const props: PatStatsPanelProps = this.props;
    const store: Store = props.store;
    const user: UserDetailsStatsGroups = props.user;
    const me: Myself = store.me;

    const childProps: PatStatsPanelProps = {
      store,
      user,
      me,
      stats: props.stats, // for the Summary page (UserSummary() below)
      // CLEAN_UP, REMOVE, not needed here?
      //reloadUser: props.loadCompleteUser,
    };

    const childRoute = Switch({},
      // Why Summary here, in 2nd level nav? Not in 1st level nav like Discourse does?
      // Because: The user summary is sort of an activity summary, and should be here.
      // It's also easy to find here, because Activity|Posts is the default tab,
      // meaning, the Summary is visible just above.
      // And having it here, means there'll be fewer 1st level navs, which is
      // good in Talkyard's case, since Ty has an "extra" 1st level tab: "Drafts etc".
      //
      // [React_Router_v51] skip render(), use hooks and useParams instead.
      Route({ path: '(.*)/summary', exact: true, render: () => UserSummary(childProps) }),
      Route({ path: '(.*)/posts', exact: true, render: () => UsersPosts(childProps) }),
      Route({ path: '(.*)/topics', exact: true, render: () => UsersTopics(childProps) }));
      // (.*)/mentions? Flarum includes mentions *of* the user, but wouldn't it make more sense
      // to include mentions *by* the user? Discourse shows: (but -received in the notfs tab)
      //Route({ path: 'likes-given', component: LikesGivenComponent }),
      //Route({ path: 'likes-received', component: LikesReceivedComponent })

    const uap = pathTo(user) + SlashActivitySlash;

    // REFACTOR, break out fn, dupl code. [post_list_dupl_html]  SMALLER_BUNDLE
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



function isHiddenForMe(me: Myself, user: UserInclDetails): boolean[] {
  // There's also a server side check: [THRACTIPRV].
  const isStaffOrSelf = isStaff(me) || user.id === me.id;
  // [some_pub_priv_prefs]
  const hiddenForMe = user.maySeeMyActivityTrLv > me.trustLevel && !isStaffOrSelf;
  return [isStaffOrSelf, hiddenForMe];
}



function makeMaybeHiddenInfo(me: Myself, user: UserInclDetails) {
  const [isStaffOrSelf, hiddenForMe] = isHiddenForMe(me, user);
  const hiddenForSomeText = !isStaffOrSelf ? null : (
      user.maySeeMyActivityTrLv >= TrustLevel.CoreMember ?
        t.upp.OnlyStaffCanSee : (
          user.maySeeMyActivityTrLv >= TrustLevel.FullMember ?
            t.upp.OnlyMbrsCanSee : null));

  const hiddenForSomeElem = hiddenForSomeText ?
      r.p({ className: 's_UP_Act_Hdn' }, hiddenForSomeText) : null;

  // Instead of "No posts" or "No topics", write "Nothing to show" — because maybe
  // there *are* posts and topics, it's just that the activity is hidden.
  const nothingToShow = !hiddenForMe ? null :
    r.p({ className: 'e_NothingToShow' }, t.upp.Nothing);

  return rFragment({}, hiddenForSomeElem, nothingToShow);
}



// MOVE to new file: PostList, which takes a PostQuery.
// Or move only PostList (it's below)? See:  OneTagPanel (in ../tags/tags-app.more.ts),
// not all code makes sense to share?
//
export const UsersPosts = React.createFactory<PatPostsPanelProps>(function(props) {
  //displayName: 'UsersPosts',

  const pat: UserInclDetails = props.user;
  const store: Store = props.store;

  // Not store.me, it's been modif in-place? [redux]  — myIdRef.current === me.id
  // wouldn't work?
  const me: Me = props.me;

  const myIdRef = React.useRef(me.id);
  const patIdRef = React.useRef(props.user.id);
  const onlyOpenRef = React.useRef(props.onlyOpen);

  const [loadingPostsForPatId, setLoadingFor] = React.useState<PatId | N>(null);
  const [postsNullOrFalse, setPosts] = usePostList();

  React.useEffect(() => {
    myIdRef.current = me.id;
    patIdRef.current = props.user.id;
    onlyOpenRef.current = props.onlyOpen;
    loadPatsPosts();
    return () => {
      myIdRef.current = null;
      patIdRef.current = null;
      onlyOpenRef.current = null;
    }
  }, [me.id, pat.id, props.onlyOpen]);

  // If we updated the posts list, then, re-process the dates.
  // BUG but rather harmless. Runs processPosts (e.g. MathJax) also on topic titles,
  // although that's not done in the forum topic list or full page title.
  // BUG (but not really my bug): MathJax also runs on topics in the watchbar.
  // Should instead iterate over all posts, give to processPosts one at a time?
  // (Right now, MathJax would process math like `\[....\]` inside titles, here, which
  // might look a bit funny.)
  // (Maybe use useLayoutEffect instead?)
  React.useEffect(() => {
    debiki2.page.Hacks.processPosts('t_UP_Act_List');
  }, [postsNullOrFalse]);

  function loadPatsPosts() {
    // a bit dupl code [5AWS2E8]
    const [isStaffOrSelf, hiddenForMe] = isHiddenForMe(me, pat);
    if (hiddenForMe) {
      setPosts([]);  // or false? Means access denied, see below
      return;
    }
    if (loadingPostsForPatId === pat.id) return;
    setLoadingFor(pat.id);
    Server.loadPostsByAuthor(pat.id, props.showWhat, props.onlyOpen,
            (posts: PostWithPage[]) => {
      setLoadingFor(null);
      // Similar to: [5AWS2E9]
      if (myIdRef.current !== me.id || patIdRef.current !== pat.id ||
            onlyOpenRef.current !== props.onlyOpen) {
        // The response is for an old request about a different user or
        // different onlyOpen, or we've logged in as sbd else — so ignore it.
        return;
      }
      setPosts(posts);
    });
  }

  // Bit dupl code, see the posts-with-tag list. [dupl_list_posts]
  if (postsNullOrFalse === null)
    return r.p({}, t.Loading);

  if (!postsNullOrFalse)
    return r.p({ className: 's_TagsP_Dnd' },
        "Access denied"); // I18N, see: t.gpp.MayNotListMembers

  const posts: PostWithPage[] = postsNullOrFalse;

  const postList = PostList({ store, posts });

  return rFr({},
      makeMaybeHiddenInfo(me, pat),
      postList);
});


interface PostListProps {
  store: Store;
  posts: PostWithPage[] | NU;
}

// REFACTOR; MOVE to where? A new file app-more/talk/posts.ts  maybe?
export const PostList = React.createFactory<PostListProps>(function(props) {
  const store: Store = props.store;
  const posts: PostWithPage[] = props.posts;
  const noPostsClass = _.isEmpty(posts) ? ' e_NoPosts' : '';

  const postElems = posts.map((post: PostWithPage) => {
      const author = store.usersByIdBrief[post.authorId];
      return (
        r.li({ key: post.uniqueId, className: 's_UP_Act_Ps_P' },
          Link({ to: linkToPostNr(post.pageId, post.nr),
              // UX SHOULD use  makeTitle() from forum.ts  instead, [same_title_everywhere]
              // so planned-doing-done/answerded/closed icons are shown.
              className: 's_UP_Act_Ps_P_Link ' + pageRole_iconClass(post.pageRole) },
            post.pageTitle),
          avatar.Avatar({ user: author, origins: store, size: AvatarSize.Small }),
          Post({ post, store, author, live: false }))); // author: [4WKA8YB]
  });

  return r.ol({ className: 's_UP_Act_Ps' + noPostsClass }, postElems);
});



const UsersTopics = createFactory<any, any>({
  displayName: 'UsersTopics',

  getInitialState: function() {
    return { topics: null };
  },

  componentDidMount: function() {
    const me: Myself = this.props.store.me;
    const user: UserInclDetails = this.props.user;
    this.loadTopics(me, user);
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  UNSAFE_componentWillReceiveProps: function(nextProps) {
    // a bit dupl code [5AWS2E9]  (UNSAFE_.. fixed above)
    const store: Store = this.props.store;
    const nextStore: Store = nextProps.store;
    const me: Myself = this.props.me;  // not store.me, it's been modif in-place [redux]
    const user: UserInclDetails = this.props.user;
    const nextMe: Myself = nextStore.me;
    const nextUser: UserInclDetails = nextProps.user;
    // If we log in as someone else, which topics we may see might change.
    if (me.id !== nextMe.id || user.id !== nextUser.id) {
      this.loadTopics(nextMe, nextUser);
    }
  },

  loadTopics: function(me: Myself, user: UserInclDetails) {
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
    const user: UserInclDetails = this.props.user;
    const me: Myself = store.me;
    const topics: Topic[] = this.state.topics;
    if (!_.isArray(topics))
      return (
        r.p({}, t.Loading));

    const noTopicsClass = _.isEmpty(topics) ? ' e_NoTopics' : '';

    const topicElmsProps: TopicListProps = {
      topics: this.state.topics,
      store: this.props.store,
      skipCatNameDescr: true,
      useTable: true,
      minHeight: 300,
      showLoadMoreButton: false,
      loadMoreTopics: () => {}, // implement later, there're no buttons for
      setSortOrder: (...ignored) => {},  // .. this, here, currently anyway.
      orderOffset: <OrderOffset> { sortOrder: TopicSortOrder.CreatedAt },
      linkCategories: false,
    };
    const topicsElems = forum.TopicsList(topicElmsProps);

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

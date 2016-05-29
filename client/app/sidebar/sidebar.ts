/*
 * Copyright (C) 2014-2015 Kaj Magnus Lindberg
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
/// <reference path="../../typedefs/keymaster/keymaster.d.ts" />
/// <reference path="../plain-old-javascript.d.ts" />
/// <reference path="../ReactStore.ts" />
/// <reference path="../page/discussion.ts" />
/// <reference path="../help/help.ts" />
/// <reference path="../avatar/AvatarAndName.ts" />
/// <reference path="minimap.ts" />
//xx <reference path="unread-comments-tracker.ts" />

//------------------------------------------------------------------------------
   module debiki2.sidebar {
//------------------------------------------------------------------------------

var keymaster: Keymaster = window['keymaster'];
var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var reactCreateFactory = React['createFactory'];
var ReactCSSTransitionGroup = reactCreateFactory(React.addons.CSSTransitionGroup);
var ReactBootstrap: any = window['ReactBootstrap'];
var DropdownButton = reactCreateFactory(ReactBootstrap.DropdownButton);
var MenuItem = reactCreateFactory(ReactBootstrap.MenuItem);

var SidebarNumCommentsLimit = 5 + 1;  // 5 + page body


export var Sidebar = createComponent({
  mixins: [debiki2.StoreListenerMixin],

  getInitialState: function() {
    var store: Store = debiki2.ReactStore.allData();
    var me = store.me;
    // Show sidebar by default, in 1D layout, otherwise people will never notice
    // that it exists.

    // Move this elsewhere? To where?
    /*
    var showSidebar = false;
    if (!store.horizontalLayout && localStorage) {
      var setting = localStorage.getItem('debikiShowSidebar');
      if (store.numPosts <= SidebarNumCommentsLimit) {
        // Sidebar not needed — navigating only this few comments with not sidebar, is okay.
      }
      else if (!setting || setting === 'true') {
        showSidebar = true;
        $('html').addClass('dw-sidebar-open');
      }
    }

    and:
     localStorage.setItem('debikiShowSidebar', this.state.showSidebar ? 'true' : 'false');
    */

    // If is admin, show the admin guide, unless the admin has clicked away from it.
    // If is chat, then we want to see online users (however, showing recent comments makes no
    // sense, because the chat messages (= comments) are already sorted chronologically).
    var commentsType = me.isAdmin && getFromLocalStorage('showAdminGuide') !== 'false'
        ? 'AdminGuide'
        : isPageWithComments(store.pageRole) && !page_isChatChannel(store.pageRole)
          ? 'Recent'
          : 'Users';

    return {
      store: store,
      lastLoadedOnlineUsersAsId: null,
      commentsType: commentsType,
      // showPerhapsUnread: false,
    };
  },

  onChange: function() {
    var newStore: Store = debiki2.ReactStore.allData();
    this.setState({
      store: newStore,
    });
    if (newStore.isContextbarOpen && newStore.me.id &&
        newStore.me.id !== this.state.lastLoadedOnlineUsersAsId) {
      this.loadOnlineUsers();
    }
  },

  showRecent: function() {
    this.setState({ commentsType: 'Recent' });
  },

  /*
  showUnread: function() {
    this.setState({ commentsType: 'Unread' });
  },*/

  showStarred: function() {
    this.setState({ commentsType: 'Starred' });
  },

  /*
  togglePerhapsUnread: function() {
    this.setState({ showPerhapsUnread: !this.state.showPerhapsUnread });
  }, */

  showUsers: function() {
    this.setState({ commentsType: 'Users' });
  },

  showAdminGuide: function() {
    this.setState({ commentsType: 'AdminGuide' });
  },

  componentDidMount: function() {
    var store: Store = this.state.store;
    keymaster('s', this.toggleSidebarOpen);
    if (store.isContextbarOpen && this.state.lastLoadedOnlineUsersAsId !== store.me.id) {
      this.loadOnlineUsers();
    }
  },

  componentWillUnmount: function() {
    keymaster.unbind('s', 'all');
  },

  componentWillUpdate: function(newProps, newState) {
    // Stop always-showing-the-admin-guide-on-page-load if the admin clicks away from it.
    var store: Store = this.state.store;
    if (store.me.isAdmin && this.state.commentsType !== newState.commentsType) {
      putInLocalStorage(
          'showAdminGuide', newState.commentsType === 'AdminGuide' ? 'true' : 'false');
    }
  },

  componentDidUpdate: function() {
    // if is-2d then: this.updateSizeAndPosition2d(event);
  },

  loadOnlineUsers: function() {
    this.setState({ lastLoadedOnlineUsersAsId: this.state.store.me.id });
    // Skip for now, because now I'm including all online users are included in the page html.
    //Server.loadOnlineUsers();
  },

  updateSizeAndPosition2d: function(event) {
    /* Try to remove. Or does this do sth useful for the minimap? Test if it's broken, to find out.
    var win = debiki.window;
    var nextState = '' + win.width() + ',' + win.height() + ':' + (event ? event.type : null);
    if (this.lastState === nextState && event && event.type === 'scroll') {
      // Need do nothing.
      return;
    }
    this.lastState = nextState;

    var padding = $('#dw-sidebar-padding');
    if (this.state.showSidebar) {
      this.sidebar.height(win.height());
      this.updateCommentsScrollbar();

      // When the window viewport is at the right doc edge, we don't want the sidebar
      // to overlap the rightmost comments. So add some horizontal padding after the
      // rightmost comment column, as wide as the sidebar.
      if (!padding.length) {
        padding =  $('<li id="dw-sidebar-padding"><div ' +
            'style="height: 1px; background-color: transparent;"></div></li>');
        padding.appendTo($('.dw-t.dw-depth-0 > .dw-single-and-multireplies > .dw-res'));
      }
      // The <li> has display: table-cell, so need to (?) set width on something inside.
      padding.children('div').width(this.sidebar.width());
    }
    else {
      padding.remove();
    } */
  },

  toggleSidebarOpen: function() {
    ReactActions.togglePagebarOpen();
  },

  openSidebar: function() {
    ReactActions.setPagebarOpen(true);
  },

  closeSidebar: function() {
    ReactActions.setPagebarOpen(false);
  },

  findComments: function() {
    var store: Store = this.state.store;
    var unreadComments = [];
    var recentComments = [];
    var starredComments = [];

    // Find 1) all unread comments, sorted in the way they appear on the page
    // And 2) all visible comments.
    var addRecursively = (postIds: number[]) => {
      _.each(postIds, (postId) => {
        var post: Post = store.allPosts[postId];
        if (post) {
          addPost(post);
          addRecursively(post.childIdsSorted);
        }
      });
    };

    var addPost = (post: Post) => {
      if (isDeleted(post))
        return;

      var postId = post.postId;
      recentComments.push(post);
      if (this.isStarred(postId)) {
        starredComments.push(post);
      }

      /* Unread? Skip for now, not saved anywhere anyway
      // Do include comments that where auto-read right now — it'd be annoying
      // if they suddenly vanished from the sidebar just because the computer
      // suddenly automatically thought you've read them.
      var autoReadLongAgo = store.user.postIdsAutoReadLongAgo.indexOf(postId) !== -1;
      // No do include comments auto-read just now. Otherwise it's impossible to
      // figure out how the Unread tab works and the 'Let computer determine' checkbox.
      autoReadLongAgo = autoReadLongAgo || store.user.postIdsAutoReadNow.indexOf(postId) !== -1;
      var hasReadItForSure = this.manuallyMarkedAsRead(postId);
      var ownPost = post.authorId === store.user.userId;
      if (!ownPost && !hasReadItForSure) {
        if (!autoReadLongAgo || this.state.showPerhapsUnread) {
          unreadComments.push(post);
        }
      }
      */
    };

    var rootPost = store.allPosts[store.rootPostId];
    addRecursively(rootPost.childIdsSorted);

    _.each(store.allPosts, (child: Post, childId) => {
      if (child.postType === PostType.Flat) {
        addPost(child);
      }
    });

    recentComments.sort((a, b) => {
      if (a.createdAt < b.createdAt)
        return +1;

      if (a.createdAt < b.createdAt)
        return -1;

      return a.postId < b.postId ? +1 : -1;
    });
    recentComments = _.take(recentComments, 50);

    return { unread: unreadComments, recent: recentComments, starred: starredComments };
  },

  manuallyMarkedAsRead: function(postId: number): boolean {
    var mark = this.state.store.user.marksByPostId[postId];
    return !!mark; // any mark means it's been read already.
  },

  isStarred: function(postId: number) {
    var mark = this.state.store.user.marksByPostId[postId];
    return mark === BlueStarMark || mark === YellowStarMark;
  },

  onPostClick: function(post: Post) {
    this.focusPost(post);
  },

  focusPost: function(post: Post) {
    var store: Store = this.state.store;
    this.setState({
      currentPostId: post.postId
    });
    ReactActions.loadAndShowPost(post.postId);
    if (store.shallSidebarsOverlayPage) {
      // Won't see the post unless we first close the contextbar.
      ReactActions.closePagebar();
    }
  },

  render: function() {
    var store: Store = this.state.store;
    var me: Myself = store.me;

    var minimapProps = $.extend({ ref: 'minimap' }, store);
    var commentsFound = isPageWithComments(store.pageRole) ? this.findComments() : null;
    var isChat = page_isChatChannel(store.pageRole);

    var sidebarClasses = '';
    if (store.horizontalLayout) {
      sidebarClasses += ' dw-sidebar-fixed';
    }

    var usersHere = store_getUsersHere(store);

    // If the current user is the only active user, write "you" instead of "1"
    // because it'd be so boring to see "1" online user and click the Users tab only
    // to find out that it's oneself. (Also, skip spaces around '/' if number not "you")
    var numOnlineTextSlash = usersHere.onlyMeOnline ? "you / " : usersHere.numOnline + "/";

    //var unreadBtnTitle = commentsFound ? 'Unread (' + commentsFound.unread.length + ')' : null;
    var starredBtnTitle = commentsFound ? 'Bookmarks (' + commentsFound.starred.length + ')' : null;
    var usersBtnTitle = usersHere.areChatChannelMembers || usersHere.areTopicContributors
        ? "Users (" + numOnlineTextSlash + usersHere.users.length + ")"
        : "Users (" + usersHere.numOnline + ")";

    var title;
    var unreadClass = '';
    var recentClass = '';
    var starredClass = '';
    var usersClass = '';
    var adminGuideActiveClass = '';
    var listItems: any[];
    switch (this.state.commentsType) {
      case 'Recent':
        title = commentsFound.recent.length ?
            'Recent comments in this topic:' : 'No comments.';
        recentClass = ' active';
        listItems = makeCommentsContent(commentsFound.recent, this.state.currentPostId, store,
            this.onPostClick);
        break;
      /*
      case 'Unread':
        title = commentsFound.unread.length ?
            'Unread Comments: (click to show)' : 'No unread comments found.';
        unreadClass = ' active';
        comments = commentsFound.unread;
        break;
        */
      case 'Starred':
        title = "Your bookmarks:";
        starredClass = ' active';
        listItems = makeCommentsContent(commentsFound.starred, this.state.currentPostId, store,
            this.onPostClick);
        break;
      case 'Users':
        var title;
        var numOnlineStrangers = store.numOnlineStrangers;
        if (store.pageRole === PageRole.Forum) {
          title = "Users online in this forum:";
        }
        else if (!usersHere.areChatChannelMembers && !usersHere.areTopicContributors) {
          title = "Users online:";
        }
        else {
          title = r.div({},
            "Users in this " + (isChat ? "chat: " : "topic:"),
            r.span({ className: 'esCtxbar_onlineCol' }, "Online"));
          // Don't show num online strangers, when listing post authors for the current topic only.
          numOnlineStrangers = 0;
        }
        usersClass = ' active';
        listItems = makeUsersContent(store, usersHere.users, store.me.id, numOnlineStrangers);
        break;
      case 'AdminGuide':
        title = "Getting Started Guide";
        adminGuideActiveClass = ' active';
        break;
      default:
        console.error('[DwE4PM091]');
    }

    var tipsGuideOrExtraConfig;
    if (this.state.commentsType === 'Recent') {
      /* Skip this, I think people won't read it anyway and it makes the page look very
          cluttered and complicated.
      tipsOrExtraConfig =
          r.p({}, 'Find listed below the beginning of every comment, newest comments first. ' +
              'Click a comment to view it in full in the threaded view to the left. ' +
              'A black star means that you have not yet read that comment. Gray means ' +
              'the computer thinks you have read it.');
      */
    }
    if (this.state.commentsType === 'Starred') {
      tipsGuideOrExtraConfig =
        r.div({},
          r.p({}, "Not implemented.")); /*
          r.p({}, "You have not bookmarked any comments on this page."),
          r.p({}, 'To bookmark a comment, click the star in its upper left ' +
            "corner, so the star turns blue or yellow. (You can use these two colors in " +
            'any way you want.)'));
            */
    }
    /*
    else if (this.state.commentsType === 'Unread') {
      var tips = this.state.showPerhapsUnread
          ? r.p({}, 'Find listed below all comments that you have not marked as ' +
              'read. To mark a comment as read, click anywhere inside it, in the ' +
              "threaded view **to the left**. (Then the star in the comment's " +
              'upper left corner will turn white.)')
          : r.p({}, 'The computer thinks you have not read these comments:');
      tipsOrExtraConfig =
        r.div({},
          r.label({ className: 'checkbox-inline' },
            r.input({ type: 'checkbox', checked: !this.state.showPerhapsUnread,
                onChange: this.togglePerhapsUnread }),
            'Let the computer try to determine when you have read a comment.'),
          tips);
    }*/
    else if (this.state.commentsType === 'AdminGuide') {
      tipsGuideOrExtraConfig = TheAdminGuide;
    }

    var wide = ($(window).width() > 1010);
    var recentButton;
    var starredButton;
    var unreadButton;
    var adminGuideButton;
    if (commentsFound) {
      if (wide) {
        recentButton = isChat ? null :
            r.button({ className: 'btn btn-default' + recentClass, onClick: this.showRecent },
              'Recent');
        //unreadButton =
        // r.button({ className: 'btn btn-default' + unreadClass, onClick: this.showUnread },
        //   unreadBtnTitle);
        starredButton =
            r.button({ className: 'btn btn-default' + starredClass, onClick: this.showStarred },
              starredBtnTitle);
      }
      else {
        recentButton = isChat ? null : MenuItem({ eventKey: 'showRecent' }, 'Recent');
        //unreadButton = MenuItem({ eventKey: 'showUnread' }, 'Unread'),
        starredButton = MenuItem({ eventKey: 'showStarred' }, starredBtnTitle);
      }
    }

    if (me.isAdmin) {
      if (wide) {
        adminGuideButton = r.button({ className: 'btn btn-default' + adminGuideActiveClass,
          onClick: this.showAdminGuide }, "Guide");
      }
      else {
        adminGuideButton = MenuItem({ eventKey: 'showAdminGuide' }, "Admin Guide");
      }
    }

    var tabButtons;
    if (wide) {
      tabButtons =
        r.div({},
          recentButton,
          unreadButton,
          starredButton,
          r.button({ className: 'btn btn-default' + usersClass, onClick: this.showUsers },
              usersBtnTitle),
          adminGuideButton);
    }
    else {
      tabButtons =
        DropdownButton({ title: this.state.commentsType, key: 'showRecent', pullRight: true,
            onSelect: (event, key) => { this[key](); }, id: '2wu4bg7' },
          recentButton,
          unreadButton,
          starredButton,
          MenuItem({ eventKey: 'showUsers' }, usersBtnTitle),
          adminGuideButton);
    }

    // Show four help messages: first no. 1, then 2, 3, 4, one at a time, which clarify
    // how the sidebar recent-comments list works.
    var helpMessageBoxOne;
    var helpMessageBoxTwo;
    var helpMessageBoxTree;
    var helpMessageBoxFour;
    var dimCommentsStyle: { opacity: string; };
    if (this.state.commentsType === 'Recent' && listItems.length >= 6) {
      // People think 4 tips are too many, and the first two are a bit redundant, so
      // remove them for now.
      /*
      helpMessageBoxOne =
          help.HelpMessageBox({ className: 'es-editor-help-one', message: helpMessageOne });
      if (help.isHelpMessageClosed(this.state.store, helpMessageOne)) {
        helpMessageBoxTwo =
            help.HelpMessageBox({ className: 'es-editor-help-two', message: helpMessageTwo });
      }
      if (help.isHelpMessageClosed(this.state.store, helpMessageTwo)) {
      */
      helpMessageBoxTree =
            help.HelpMessageBox({ className: 'es-editor-help-three', message: helpMessageThree });
      if (help.isHelpMessageClosed(this.state.store, helpMessageThree)) {
        helpMessageBoxFour =
            help.HelpMessageBox({ className: 'es-editor-help-four', message: helpMessageFour });
      }
      // Dim the comments list until all help messages have been closed.
      var dimCommentsStyle = help.isHelpMessageClosed(this.state.store, helpMessageFour) ?
          null : { opacity: '0.6' };
    }

    sidebarClasses += adminGuideActiveClass ? ' esCtxbar-adminGuide' : '';

    return (
      r.div({ className: 'dw-sidebar-z-index' },
      r.div({ id: 'dw-minimap-holder', className: 'dw-sidebar-is-open' },
        r.div({ className: 'dw-upper-right-corner' },
          MiniMap(minimapProps))),
      r.div({ id: 'dw-sidebar', className: 'esCtxbar' + sidebarClasses, ref: 'sidebar' },
        r.div({ className: 'esCtxbar_btns' },
          CloseSidebarButton({ onClick: this.closeSidebar }),
          tabButtons),
        r.div({ className: 'dw-comments esCtxbar_list' },
          helpMessageBoxOne,
          helpMessageBoxTwo,
          helpMessageBoxTree,
          helpMessageBoxFour,
          r.div({ style: dimCommentsStyle },
            r.div({ ref: 'commentsScrollable' },
              r.h3({ className: 'esCtxbar_list_title' }, title),
              tipsGuideOrExtraConfig,
              r.div({},
                ReactCSSTransitionGroup({ transitionName: 'comment', key: this.state.commentsType,
                    // Is 600 correct? Haven't checked, could do later
                    transitionAppearTimeout: 600, transitionEnterTimeout: 600,
                    transitionLeaveTimeout: 600 },
                  listItems))))))));
  }
});


function makeCommentsContent(comments: Post[], currentPostId: PostId, store: Store, onPostClick) {
  var smallScreen = Math.min(debiki.window.width(), debiki.window.height()) < 500;
  var abbreviateHowMuch = smallScreen ? 'Much' : 'ABit';
  return comments.map((post: Post, index) => {
    var postProps: any = _.clone(store);
    postProps.post = post;
    postProps.onClick = (event) => onPostClick(post);
    postProps.abbreviate = abbreviateHowMuch;
    if (post.postId === currentPostId) {
      postProps.className = 'dw-current-post';
    }
    return (
        r.div({ key: post.postId },
            page.Post(postProps)));
  });
}


function makeUsersContent(store: Store, users: BriefUser[], myId: UserId,
      numOnlineStrangers: number) {
  // List the current user first, then online users, then others.
  // COULD: list alphabetically, so one can scan and find one's friends by name easily
  users.sort((a, b) => {
    if (a.id === myId) return -1;
    if (b.id === myId) return +1;
    if (store_isUserOnline(store, a.id) === store_isUserOnline(store, b.id)) {
      if (user_isMember(a) === user_isMember(b)) return 0;
      return user_isMember(a) ? -1 : +1;
    }
    return store_isUserOnline(store, a.id) ? -1 : +1;
  });
  var currentUserIsStranger = true;
  var listItems = users.map((user: BriefUser) => {
    var thatsYou = user.id === myId ?
        r.span({ className: 'esPresence_thatsYou' }, " — that's you") : null;
    currentUserIsStranger = currentUserIsStranger && user.id !== myId;
    var isUserOnline = store_isUserOnline(store, user.id);
    var presenceClass = isUserOnline ? 'active' : 'away';
    var presenceTitle = isUserOnline ? 'Active' : 'Away';
    return (
        r.div({ key: user.id, className: 'esPresence esPresence-' + presenceClass,
            onClick: () => pagedialogs.getAboutUserDialog().openForUserId(user.id) },
          avatar.AvatarAndName({ user: user, ignoreClicks: true }),
          thatsYou,
          r.span({ className: 'esPresence_icon', title: presenceTitle })));
  });

  if (numOnlineStrangers) {
    var numOtherStrangers = numOnlineStrangers - (currentUserIsStranger ? 1 : 0);
    var plus = listItems.length ? '+ ' : '';
    var youAnd = currentUserIsStranger ? "You, and " : '';
    var people = numOtherStrangers === 1 ? " person" : " people";
    var have = numOtherStrangers === 1 ? "has" : "have";
    var strangers = numOtherStrangers === 0 && currentUserIsStranger
      ? (listItems.length ? "you" : "Only you, it seems")
      : youAnd + numOtherStrangers + people + " who " + have + " not logged in";
    listItems.push(
        r.div({ key: 'strngrs', className: 'esPresence esPresence-strangers' }, plus + strangers));
  }

  return listItems;
}


/*
var helpMessageOne = {
  id: 'EsH2QMUW1',
  version: 1,
  content: r.span({}, "This is a list of ", r.b({}, "the most recent comments"), " on this page."),
  okayText: "I understand",
  moreHelpAwaits: true,
};

var helpMessageTwo = {
  id: 'EsH5GPMU2',
  version: 1,
  content: r.span({}, "Don't try to read them here — only the first words are shown."),
  okayText: "I won't",
  moreHelpAwaits: true,
}; */

var helpMessageThree = {
  id: 'EsH7UGY2',
  version: 1,
  content: r.span({}, "Click a comment in this list, to focus it in the main view " +
      "to the left — and read it ", r.i({}, "there"), " instead."),
  okayText: "Okay",
  moreHelpAwaits: true,
};

var helpMessageFour = {
  id: 'EsH6GJYu8',
  version: 1,
  content: r.span({}, "The comments to the left are sorted by best-first. " +
      "But you can use this list to find the newest comments."),
  okayText: "Thanks, bye",
  moreHelpAwaits: false,
};


var CloseSidebarButton = createComponent({
  render: function() {
    return (
      r.button({ className: 'esCtxbar_close esCloseCross', onClick: this.props.onClick,
          title: "Close (keyboard shortcut: S)" }));
  }
});


// The admin guide is placed in the sidebar [8YKFW32], because then it'll be accessible from
// everywhere, and the admin can read & look in the guide at the same time as s/he looks at
// the admin buttons and settings to the left.
var TheAdminGuide =
  r.div({ className: 'esAdminGuide' },
    r.p({}, "Welcome! You're an admin, and as an admin, you can edit forum settings, define what this community is about, and invite people."),
    r.h2({}, "Edit settings"),
    r.p({}, "Go to the admin area by clicking ", r.span({ className: 'icon-menu' }), " to the upper left, then click ", r.strong({}, "Admin"), ". Have a look at the settings, in case there's something you'd like to change. You can edit the settings in the ", r.strong({}, "Login"), " section, to make the forum private. And edit colors and fonts in the ", r.strong({}, "Customize"), " section."),
    /*  Tooo much text! I'm afraid people won't read. At least one usability tester totally didn't.
    r.h4({}, "Copyright"),
    r.p({}, "By default, people may copy material from the forum, and they must then give credit to the authors, and indicate if they have modified it. They must also in turn allow others to copy and edit their modified material. This is ", r.a({ href: 'http://creativecommons.org/licenses/by-sa/4.0/', target: '_blank' }, "Creative Commons' CC BY-SA 4.0", r.span({ className: 'icon-link-ext' })), ". — All this is a bit configurable, in the ", r.strong({}, "Legal"), " settings section."),
    r.h4({}, "Private or public?"),
    r.p({}, "You can make the forum private, by enabling these: ", r.em({}, "Login required"), " and ", r.em({}, "Approve users"), ", in the ", r.strong({}, "Login"), " settings section."),
    r.h4({}, "Customize colors and logo"),
    r.p({}, "In the ", r.strong({}, "Customize"), " section, you can customize colors, add a logo and a top navigation bar. ", r.strong({}, "However"), ", your customizations might break in the future, because this functionality is a bit experimental right now. Also, right now you need to know some CSS and HTML, unfortunately."),
    */
    r.h2({}, "Clarify what this community is about"),
    r.p({}, "On ", r.a({ href: "/" }, "the forum main page"), ", edit the forum intro text (just below the forum title). And edit the ", r.em({}, "Welcome to this community"), " topic. And ", r.a({ href: '/about' }, "the about page"), "."),
    r.h2({}, "Create categories"),
    r.p({}, "On ", r.a({ href: "/" }, "the forum main page"), ", click ", r.strong({}, "Categories"), ", then ", r.strong({}, "Create Category"), ". Edit the about-this-category topic that you'll find in each category you create. Don't create too many categories (if you do, they might look rather empty)."),
    r.h2({}, "Build your community"),
    r.p({}, "Building a community is hard. Before launching:"),
    r.ul({},
      r.li({}, "Make sure people will understand what this community is about — see the ", r.em({}, "Clarify what this community is about"), " section above."),
      r.li({}, "Create some interesting topics, so people won't find an empty forum."),
      r.li({}, "Set aside time to visit your forum regularly and participate in the discussions."),
      r.li({}, "Tell a few people to have a look at your forum. Ask if they understand its purpose. Edit the forum intro text and the welcome topic, until everything is clear.")),
    r.p({}, "Then start promoting your community: link to it on the Internet, and tell people about it. You can invite people via email: click your name at the top of this page, then click ", r.strong({}, "View Profile"), " then ", r.strong({}, "Invite")),
    r.h2({}, "Need help?"),
    r.p({}, "For help, go to EffectiveDiscussion's ", r.a({ href: 'http://www.effectivediscussions.org/forum/latest/support', target: '_blank' }, "support forum", r.span({ className: 'icon-link-ext' })), ". Over there, there's an ", r.em({}, "Ideas"), " category too, and you're welcome to make suggestions."));

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list

/*
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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
/// <reference path="minimap.ts" />
/// <reference path="unread-comments-tracker.ts" />

// Staying at the bottom: http://blog.vjeux.com/2013/javascript/scroll-position-with-react.html

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

var TopBarHegiht = 44; // [KP43WV3]
var SidebarNumCommentsLimit = 5 + 1;  // 5 + page body

var lastMouseDownMs = null;
var lastNiceScrollMs = null;


export var Sidebar = createComponent({
  mixins: [debiki2.StoreListenerMixin],

  getInitialState: function() {
    var store = debiki2.ReactStore.allData();
    // Show sidebar by default, in 1D layout, otherwise people will never notice
    // that it exists.
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
    return {
      store: store,
      showSidebar: showSidebar,
      commentsType: 'Recent',
      // showPerhapsUnread: false,
    };
  },

  onChange: function() {
    this.setState({
      store: debiki2.ReactStore.allData(),
      showSidebar: this.state.showSidebar,
    });
  },

  showRecent: function() {
    this.setState({
      commentsType: 'Recent'
    });
  },

  /*
  showUnread: function() {
    this.setState({
      commentsType: 'Unread'
    });
  },*/

  showStarred: function() {
    this.setState({
      commentsType: 'Starred'
    });
  },

  /*
  togglePerhapsUnread: function() {
    this.setState({
      showPerhapsUnread: !this.state.showPerhapsUnread
    });
  }, */

  componentDidMount: function() {
    // COULD find a safer way to do this? Breaks if CSS class renamed / HTML
    // structure changed.
    this.commentSection = $('.dw-cmts-tlbr + .dw-single-and-multireplies');
    this.sidebar = $(this.refs.sidebar ? this.refs.sidebar.getDOMNode() : null);
    this.openButton = $(this.refs.openButton ? this.refs.openButton.getDOMNode() : null);

    if (!isPageWithSidebar(this.state.store.pageRole))
      return;

    window.addEventListener('scroll', this.updateSizeAndPosition, false);
    debiki.v0.util.addZoomOrResizeListener(this.updateSizeAndPosition);
    this.updateSizeAndPosition();
    keymaster('s', this.toggleSidebarOpen);
    this.createAnyScrollbars();
  },

  componentWillUnmount: function() {
    if (!isPageWithSidebar(this.state.store.pageRole))
      return;

    window.removeEventListener('scroll', this.updateSizeAndPosition, false);
    debiki.v0.util.removeZoomOrResizeListener(this.updateSizeAndPosition);
    keymaster.unbind('s', 'all');
  },

  componentWillUpdate: function(nextProps, nextState) {
    if (!isPageWithSidebar(this.state.store.pageRole))
      return;

    if (this.state.showSidebar && !nextState.showSidebar) {
      this.getCommentsViewport()['getNiceScroll']().remove();
    }
  },

  componentDidUpdate: function() {
    this.sidebar = $(this.refs.sidebar ? this.refs.sidebar.getDOMNode() : null);
    this.openButton = $(this.refs.openButton ? this.refs.openButton.getDOMNode() : null);

    if (!isPageWithSidebar(this.state.store.pageRole))
      return;

    this.updateSizeAndPosition();
    this.createAnyScrollbars();

    if (!this.state.store.horizontalLayout && localStorage) {
      localStorage.setItem('debikiShowSidebar', this.state.showSidebar ? 'true' : 'false');
    }
  },

  getCommentsViewport: function() {
    return $(this.refs.commentsViewport.getDOMNode());
  },

  createAnyScrollbars: function() {
    if (!this.state.showSidebar)
      return;

    var scrollableElem = this.refs.commentsScrollable.getDOMNode();
    var $viewport = this.getCommentsViewport();
    var niceScroll = $viewport['niceScroll'](scrollableElem, {
      cursorwidth: '12px',
      cursorcolor: '#aaa',
      cursorborderradius: 0,
      bouncescroll: false,
      // This enables dragscroll with the mouse, and disables the scroll wheel (unless 2d layout)
      // — the wheel will scroll the whole window instead; having it scroll the sidebar is very
      // confusing, because people then think the whole-window-scrolling is broken; they didn't
      // notice they placed the mouse in the sidebar. — So let them scroll by touch-scrolling,
      // or mouse-dragging the scrollbar, or dragscrolling with the mouse.
      // (2D layout however, then one usually dragscrolls instead of using the wheel, so then
      // it's ok to let the wheel scroll the sidebar instead.)
      touchbehavior: true,
      preventmultitouchscrolling: false,
      enablemousewheel: this.state.store.horizontalLayout,
      mousescrollstep: 100, // for 2d layout. Default is only 40. 140 = too fast: skips posts in FF.
    });

    // We want to know if we scrolled or clicked something. Therefore:
    // (without updating this.state and triggering a rerendering)
    // Doesn't work, never triggered:
    //niceScroll.scrollstart((event) => {
    //  niceScrollStartMs = Date.now();
    //  niceScrollEndMs = null;
    //})
    // Also doesn't work: *always* trigggered, even for a pure click:
    //niceScroll.scrollend((event) => {
    //  niceScrollEndMs = Date.now();
    //});
    // Instead:
    $viewport.on('scroll', (event) => {
      lastNiceScrollMs = Date.now();
    });
    // React onMouseDown also doesn't work, so instead:
    $viewport.on('mousedown', (event) => {
      lastMouseDownMs = Date.now();
    });
  },

  updateSizeAndPosition: function(event) {
    if (this.state.store.horizontalLayout) {
      this.updateSizeAndPosition2d(event);
    } else {
      this.updateSizeAndPosition1d(event);
    }
  },

  updateSizeAndPosition2d: function(event) {
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
    }
  },

  updateSizeAndPosition1d: function(event) {
    // This function is run frequently, each frame when scrolling. Profiling has
    // shown it's been worth optimizing it a bit, see `nextState` below, and
    // the $(elems) that I've cached in `this`.

    var sidebar = this.sidebar;
    var openButton = this.openButton;
    var win = debiki.window;
    var commentSection = this.commentSection;
    var commentSectionBounds = this.commentSection[0].getBoundingClientRect();
    var commentSectionHeight = win.height() - commentSectionBounds.top;

    var nextState = '' + win.width() + ',' + win.height() + ':';
    if (commentSectionBounds.top <= TopBarHegiht) {
      nextState += 'below:' + this.state.showSidebar;
      if (nextState === this.lastState) {
        return;
      }

      // We've scrolled down; let the sidebar span from top to bottom.
      sidebar.css('top', TopBarHegiht);
      sidebar.css('position', 'fixed');
      if (this.state.showSidebar) {
        sidebar.addClass('dw-sidebar-fixed');
        sidebar.height(win.height());
        openButton.css('position', 'relative');
      }
      else {
        sidebar.height(0);
        openButton.css('position', 'absolute');
      }
    }
    else {
      nextState += 'above:' + (this.state.showSidebar ? commentSectionHeight : -1);
      if (nextState === this.lastState) {
        return;
      }

      // (Use `offset({ top: ... })` not `css('top', ...)` because `css` for some
      // weird reason places the elem 30 extra pixels down.)

      // We're reading the article. Let the sidebar stay down together with
      // the comments, so it won't occlude the article. COULD skip this if
      // the browser window is very wide and we can safely show the whole sidebar
      // at the right edge, without occluding the article.
      sidebar.removeClass('dw-sidebar-fixed');
      sidebar.css('position', 'absolute');
      sidebar.offset({ top: win.scrollTop() + commentSectionBounds.top, left: undefined });
      if (this.state.showSidebar) {
        sidebar.height(commentSectionHeight);
        openButton.css('position', 'relative');
      } else {
        sidebar.height(0);
        openButton.css('position', 'absolute');
      }
    }

    this.lastState = nextState;
    this.updateCommentsScrollbar();

    if (this.state.showSidebar) {
      var sidebarLeft = sidebar[0].getBoundingClientRect().left;
      var space = win.width() < 830 ? 13 : 30;
      var commentsMaxWidth = sidebarLeft - space - commentSectionBounds.left;
      commentSection.css('max-width', commentsMaxWidth);
    }
    else {
      commentSection.css('max-width', '');
    }
  },

  updateCommentsScrollbar: function() {
    if (this.state.showSidebar) {
      var commentsViewport = this.getCommentsViewport();
      var bounds = commentsViewport[0].getBoundingClientRect();
      var height = debiki.window.height() - bounds.top;
      commentsViewport.height(height);
      commentsViewport['getNiceScroll']().resize();
    }
  },

  toggleSidebarOpen: function() {
    this.setSidebarOpen(!this.state.showSidebar);
  },

  openSidebar: function() {
    this.setSidebarOpen(true);
  },

  closeSidebar: function() {
    this.setSidebarOpen(false);
  },

  setSidebarOpen: function(showSidebar) {
    this.setState({ showSidebar: showSidebar });
    if (showSidebar) {
      $('html').addClass('dw-sidebar-open')
    }
    else {
      $('html').removeClass('dw-sidebar-open');
    }
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
    }

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
    if (lastMouseDownMs && lastNiceScrollMs && lastNiceScrollMs > lastMouseDownMs) {
      // Not a real click — we just scrolled the recent comments list.
    }
    else {
      this.focusPost(post);
    }
  },

  focusPost: function(post: Post) {
    this.setState({
      currentPostId: post.postId
    });
    ReactActions.loadAndShowPost(post.postId);
  },

  render: function() {
    var store: Store = this.state.store;

    if (!isPageWithSidebar(store.pageRole))
      return null;

    var minimapProps = $.extend({ ref: 'minimap' }, store);
    var commentsFound = this.findComments();

    // If sidebar hidden, show only minimap (if 2d layout) and toggle sidebar button.
    if (!this.state.showSidebar) {
      var unreadAndNewCounts = commentsFound.unread.length === 0 ? null :
        r.div({ id: 'dw-comment-counts' },
          commentsFound.unread.length + ' unread');
          // later:
          // r.br({}),
          // commentsFound.new.length + ' new');
      if (store.horizontalLayout) {
        return (
          r.div({ className: 'dw-sidebar-z-index' },
            r.div({ id: 'dw-minimap-holder', style: { width: '100%' }},
              r.div({ className: 'dw-upper-right-corner' },
                MiniMap(minimapProps),
                r.div({ id: 'dw-toggle-sidebar-and-comment-counts', ref: 'openButton' },
                  ToggleSidebarButton({ isSidebarOpen: false, onClick: this.openSidebar }),
                  unreadAndNewCounts)))));
      }
      else {
        return (
          r.div({},
            r.div({ id: 'dw-sidebar', className: sidebarClasses, ref: 'sidebar' },
              r.div({ id: 'dw-toggle-sidebar-and-comment-counts', ref: 'openButton' },
                ToggleSidebarButton({ isSidebarOpen: false, onClick: this.openSidebar }),
                unreadAndNewCounts))));
      }
    }

    var sidebarClasses = '';
    if (store.horizontalLayout) {
      sidebarClasses += ' dw-sidebar-fixed';
    }

    //var unreadBtnTitle = 'Unread (' + commentsFound.unread.length + ')';
    var starredBtnTitle = 'Starred (' + commentsFound.starred.length + ')';

    var title;
    var unreadClass = '';
    var recentClass = '';
    var starredClass = '';
    var comments: Post[];
    switch (this.state.commentsType) {
      case 'Recent':
        title = commentsFound.recent.length ?
            'Recent Comments: (click to show)' : 'No comments.';
        recentClass = ' active';
        comments = commentsFound.recent;
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
        title = commentsFound.starred.length ?
            'Starred Comments: (click to show)' : 'No starred comments.';
        starredClass = ' active';
        comments = commentsFound.starred;
        break;
      default:
        console.error('[DwE4PM091]');
    }

    var tipsOrExtraConfig;
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
      tipsOrExtraConfig =
          r.p({}, 'To star a comment, click the star in its upper left ' +
            "corner, so the star turns blue or yellow. (You can use these two colors in " +
            'any way you want.)');
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

    var smallScreen = Math.min(debiki.window.width(), debiki.window.height()) < 500;
    var abbreviateHowMuch = smallScreen ? 'Much' : 'ABit';
    var commentsElems = comments.map((post, index) => {
      var postProps: any = _.clone(store);
      postProps.post = post;
      // onMouseDown/Capture doesn't work, even with niceScroll removed, no idea why:
      // postProps.onMouseDown = (event) => { lastMouseDownMs = Date.now(); },
      // postProps.onMouseDownCapture =
      postProps.onClick = (event) => this.onPostClick(post),
      postProps.abbreviate = abbreviateHowMuch;
      if (post.postId === this.state.currentPostId) {
        postProps.className = 'dw-current-post';
      }
      return (
        r.div({ key: post.postId },
          Post(postProps)));
    });

    var tabButtons;
    if ($(window).width() > 800 && $(window).height() > 600) {
      tabButtons =
        r.div({},
          /*
          r.button({ className: 'btn btn-default' + unreadClass, onClick: this.showUnread },
              unreadBtnTitle), */
          r.button({ className: 'btn btn-default' + recentClass, onClick: this.showRecent },
              'Recent'),
          r.button({ className: 'btn btn-default' + starredClass, onClick: this.showStarred },
              starredBtnTitle));
    }
    else {
      tabButtons =
        DropdownButton({ title: this.state.commentsType, key: 'showRecent', pullRight: true,
            onSelect: (key) => { this[key](); } },
          // MenuItem({ eventKey: 'showUnread' }, 'Unread'),
          MenuItem({ eventKey: 'showRecent' }, 'Recent'),
          MenuItem({ eventKey: 'showStarred' }, 'Starred'));
    }

    return (
      r.div({ className: 'dw-sidebar-z-index' },
      r.div({ id: 'dw-minimap-holder', className: 'dw-sidebar-is-open' },
        r.div({ className: 'dw-upper-right-corner' },
          MiniMap(minimapProps))),
      r.div({ id: 'dw-sidebar', className: sidebarClasses, ref: 'sidebar' },
        ToggleSidebarButton({ isSidebarOpen: true, onClick: this.closeSidebar, ref: 'openButton' }),
        tabButtons,
        r.div({ className: 'dw-comments' },
          r.div({ ref: 'commentsViewport' },
            r.div({ ref: 'commentsScrollable' },
              r.h3({}, title),
              tipsOrExtraConfig,
              r.div({},
                ReactCSSTransitionGroup({ transitionName: 'comment', key: this.state.commentsType },
                  commentsElems))))))));
  }
});


function isPageWithSidebar(pageRole: PageRole): boolean {
  return pageRole === PageRole.About ||
      pageRole === PageRole.Question || pageRole === PageRole.ToDo ||
      pageRole === PageRole.MindMap || pageRole === PageRole.Discussion ||
      pageRole === PageRole.WebPage || pageRole === PageRole.EmbeddedComments;
}


var ToggleSidebarButton = createComponent({
  render: function() {
    return (
      r.button({ id: 'dw-toggle-sidebar', onClick: this.props.onClick,
            title: 'Keyboard shortcut: S' },
        r.span({ className: this.props.isSidebarOpen ? 'icon-right-open' : 'icon-left-open' })));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list

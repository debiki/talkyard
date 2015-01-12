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
/// <reference path="../../shared/plain-old-javascript.d.ts" />
/// <reference path="../ReactStore.ts" />
/// <reference path="minimap.ts" />
/// <reference path="unread-comments-tracker.ts" />

// Staying at the bottom: http://blog.vjeux.com/2013/javascript/scroll-position-with-react.html

//------------------------------------------------------------------------------
   module debiki2.sidebar {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var ReactCSSTransitionGroup = React.addons.CSSTransitionGroup;


export var Sidebar = createComponent({
  mixins: [debiki2.StoreListenerMixin],

  getInitialState: function() {
    var store = debiki2.ReactStore.allData();
    // Show sidebar by default, in 1D layout, otherwise people will never notice
    // that it exists.
    var showSidebar = false;
    if (!store.horizontalLayout && localStorage) {
      var setting = localStorage.getItem('debikiShowSidebar');
      if (!setting || setting === 'true') {
        showSidebar = true;
      }
    }
    return {
      store: store,
      showSidebar: showSidebar,
      commentsType: 'Recent',
      showPerhapsUnread: false,
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

  showUnread: function() {
    this.setState({
      commentsType: 'Unread'
    });
  },

  showStarred: function() {
    this.setState({
      commentsType: 'Starred'
    });
  },

  togglePerhapsUnread: function() {
    this.setState({
      showPerhapsUnread: !this.state.showPerhapsUnread
    });
  },

  componentDidMount: function() {
    if (!isPageWithSidebar(this.state.store.pageRole))
      return;

    window.addEventListener('scroll', this.updateSizeAndPosition, false);
    debiki.v0.util.addZoomOrResizeListener(this.updateSizeAndPosition);
    this.updateSizeAndPosition();
    key('s', this.toggleSidebarOpen);
    this.createAnyScrollbars();
  },

  componentWillUnmount: function() {
    if (!isPageWithSidebar(this.state.store.pageRole))
      return;

    window.removeEventListener('scroll', this.updateSizeAndPosition, false);
    debiki.v0.util.removeZoomOrResizeListener(this.updateSizeAndPosition);
    key.unbind('s', this.toggleSidebarOpen);
  },

  componentWillUpdate: function(nextProps, nextState) {
    if (!isPageWithSidebar(this.state.store.pageRole))
      return;

    if (this.state.showSidebar && !nextState.showSidebar) {
      this.getCommentsViewport()['getNiceScroll']().remove();
    }
  },

  componentDidUpdate: function() {
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

    this.getCommentsViewport()['niceScroll']('#dw-sidebar-comments-scrollable', {
      cursorwidth: '12px',
      cursorcolor: '#aaa',
      cursorborderradius: 0,
      bouncescroll: false,
      mousescrollstep: 100, // default is only 40. 140 is too fast, skips posts in FF.
      // Make the mouse scrollwheel *not* scroll the the main window instead of
      // the comments viewport.
      preservenativescrolling: false,
      // After having scrolled to the top or to the bottom, don't start scrolling
      // the main window instead.
      nativeparentscrolling: false
    });
  },

  updateSizeAndPosition: function() {
    if (this.state.store.horizontalLayout) {
      this.updateSizeAndPosition2d();
    } else {
      this.updateSizeAndPosition1d();
    }
  },

  updateSizeAndPosition2d: function() {
    var padding = $('#dw-sidebar-padding');
    if (this.state.showSidebar) {
      var sidebar = $(this.refs.sidebar.getDOMNode());
      var windowTop = $(window).scrollTop();
      var windowBottom = windowTop + $(window).height();
      sidebar.height(windowBottom - windowTop);
      this.updateCommentsScrollbar(windowBottom);

      // When the window viewport is at the right doc edge, we don't want the sidebar
      // to overlap the rightmost comments. So add some horizontal padding after the
      // rightmost comment column, as wide as the sidebar.
      if (!padding.length) {
        padding =  $('<li id="dw-sidebar-padding"><div ' +
            'style="height: 1px; background-color: transparent;"></div></li>');
        padding.appendTo($('.dw-t.dw-depth-0 > .dw-single-and-multireplies > .dw-res'));
      }
      // The <li> has display: table-cell, so need to (?) set width on something inside.
      padding.children('div').width(sidebar.width());
    }
    else {
      padding.remove();
    }
  },

  updateSizeAndPosition1d: function() {
    // COULD find a safer way to do this? Breaks if CSS class renamed / HTML
    // structure changed.
    var commentSection = $('.dw-cmts-tlbr + .dw-single-and-multireplies');
    var commentSectionOffset = commentSection.offset();
    var commentSectionTop = commentSectionOffset.top;
    var windowTop = $(window).scrollTop();
    var windowBottom = windowTop + $(window).height();
    var sidebar = $(this.refs.sidebar.getDOMNode());
    var openButton = $(this.refs.openButton.getDOMNode());

    if (commentSectionTop <= windowTop) {
      // We've scrolled down; let the sidebar span from top to bottom.
      if (this.state.showSidebar) {
        sidebar.addClass('dw-sidebar-fixed');
        sidebar.css('top', 0);
        sidebar.css('position', 'fixed');
        sidebar.height(windowBottom - windowTop);
      }
      else {
        openButton.css('top', 0);
        openButton.css('position', 'fixed');
      }
    }
    else {
      // (Use `offset({ top: ... })` not `css('top', ...)` because `css` for some
      // weird reason places the elem 30 extra pixels down.)

      // We're reading the article. Let the sidebar stay down together with
      // the comments, so it won't occlude the article. COULD skip this if
      // the browser window is very wide and we can safely show the whole sidebar
      // at the right edge, without occluding the article.
      sidebar.removeClass('dw-sidebar-fixed');
      sidebar.offset({ top: commentSectionTop, left: undefined });
      sidebar.css('position', 'absolute');
      sidebar.css('right', 0);
      if (this.state.showSidebar) {
        sidebar.height(windowBottom - commentSectionTop);
        sidebar.css('overflow', 'hidden');
        openButton.css('position', 'relative');
      } else {
        sidebar.height(0);
        sidebar.css('overflow', 'visible'); // else open button not shown
        openButton.css('position', 'absolute');
        openButton.css('top', 0);
        openButton.css('right', 0);
      }
    }

    this.updateCommentsScrollbar(windowBottom);

    if (this.state.showSidebar) {
      var sidebarLeft = sidebar.offset().left;
      var commentsMaxWidth = sidebarLeft - 30 - commentSectionOffset.left;
      commentSection.css('max-width', commentsMaxWidth);
    }
    else {
      commentSection.css('max-width', '');
    }
  },

  updateCommentsScrollbar: function(windowBottom) {
    if (this.state.showSidebar) {
      var commentsViewport = this.getCommentsViewport();
      var commentsViewportTop = commentsViewport.offset().top;
      commentsViewport.height(windowBottom - commentsViewportTop);
      commentsViewport['getNiceScroll']().resize();
    }
  },

  toggleSidebarOpen: function() {
    this.setState({
      showSidebar: !this.state.showSidebar
    });
  },

  openSidebar: function() {
    this.state.showSidebar = true;
    this.setState(this.state);
  },

  closeSidebar: function() {
    this.state.showSidebar = false;
    this.setState(this.state);
  },

  findComments: function() {
    var store: Store = this.state.store;
    var unreadComments = [];
    var recentComments = [];
    var starredComments = [];

    // Find 1) all unread comments, sorted in the way they appear on the page
    // And 2) all visible comments.
    var addComments = (postIds: number[], ancestorCollapsed: boolean) => {
      _.each(postIds, (postId) => {
        var post: Post = store.allPosts[postId];
        if (isDeleted(post))
          return;

        if (!ancestorCollapsed) {
          // Do include comments that where auto-read right now — it'd be annoying
          // if they suddenly vanished from the sidebar just because the computer
          // suddenly automatically thought you've read them.
          var autoReadLongAgo = store.user.postIdsAutoReadLongAgo.indexOf(postId) !== -1;
          // No do include comments auto-read just now. Otherwise it's impossible to
          // figure out how the Unread tab works and the 'Let computer determine' checkbox.
          autoReadLongAgo =
              autoReadLongAgo || store.user.postIdsAutoReadNow.indexOf(postId) !== -1;

          var hasReadItForSure = this.manuallyMarkedAsRead(postId);
          var ownPost = post.authorId === store.user.userId;
          if (!ownPost && !hasReadItForSure) {
            if (!autoReadLongAgo || this.state.showPerhapsUnread) {
              unreadComments.push(post);
            }
          }

          recentComments.push(post);
        }

        if (this.isStarred(postId)) {
          starredComments.push(post);
        }

        addComments(post.childIdsSorted, ancestorCollapsed || isCollapsed(post));
      });
    };

    var rootPost = store.allPosts[store.rootPostId];
    addComments(rootPost.childIdsSorted, false);

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

  focusPost: function(post: Post, index: number) {
    this.setState({
      currentPostId: post.postId
    });
    d.i.showAndHighlightPost($('#post-' + post.postId));
  },

  render: function() {
    var store = this.state.store;

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
          r.div({},
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
              r.div({ ref: 'openButton' },
                ToggleSidebarButton({ isSidebarOpen: false, onClick: this.openSidebar }),
                unreadAndNewCounts))));
      }
    }

    var sidebarClasses = '';
    if (store.horizontalLayout) {
      sidebarClasses += ' dw-sidebar-fixed';
    }

    var unreadBtnTitle = 'Unread (' + commentsFound.unread.length + ')';
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
      case 'Unread':
        title = commentsFound.unread.length ?
            'Unread Comments: (click to show)' : 'No unread comments found.';
        unreadClass = ' active';
        comments = commentsFound.unread;
        break;
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
    }

    var commentsElems = comments.map((post, index) => {
      var postProps = _.clone(store);
      postProps.post = post;
      postProps.onClick = (event) => this.focusPost(post, index),
      postProps.abbreviate = true;
      if (post.postId === this.state.currentPostId) {
        postProps.className = 'dw-current-post';
      }
      return (
        r.div({ key: post.postId },
          Post(postProps)));
    });

    return (
      r.div({},
      r.div({ id: 'dw-minimap-holder', className: 'dw-sidebar-is-open' },
        r.div({ className: 'dw-upper-right-corner' },
          MiniMap(minimapProps))),
      r.div({ id: 'dw-sidebar', className: sidebarClasses, ref: 'sidebar' },
        ToggleSidebarButton({ isSidebarOpen: true, onClick: this.closeSidebar, ref: 'openButton' }),
        r.button({ className: 'btn btn-default' + unreadClass, onClick: this.showUnread }, unreadBtnTitle),
        r.button({ className: 'btn btn-default' + recentClass, onClick: this.showRecent }, 'Recent'),
        r.button({ className: 'btn btn-default' + starredClass, onClick: this.showStarred }, starredBtnTitle),
        r.div({ className: 'dw-comments' },
          r.h3({}, title),
          r.div({ id: 'dw-sidebar-comments-viewport', ref: 'commentsViewport' },
            r.div({ id: 'dw-sidebar-comments-scrollable' },
              tipsOrExtraConfig,
              r.div({ className: 'dw-recent-comments' },
                ReactCSSTransitionGroup({ transitionName: 'comment', key: this.state.commentsType },
                  commentsElems))))))));
  }
});


function isPageWithSidebar(pageRole) {
  return pageRole === 'BlogPost' || pageRole === 'ForumTopic' || pageRole === 'WebPage';
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

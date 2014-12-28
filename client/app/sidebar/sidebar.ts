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
/// <reference path="minimap.ts" />
/// <reference path="toggle-sidebar-button.ts" />
/// <reference path="unread-comments-tracker.ts" />

// Staying at the bottom: http://blog.vjeux.com/2013/javascript/scroll-position-with-react.html

//------------------------------------------------------------------------------
   module debiki2.sidebar {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;

var MinimapHeight = 160;

// For now only. Should get this data from the ReactStore, but currently it's kept
// in the HTML5 local storage only, not saved in the database. So, for now, when prototyping:
var postIdsReadLongAgo: number[] = UnreadCommentsTracker.getPostIdsReadLongAgo();



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
      commentsType: 'Recent'
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

  componentDidMount: function() {
    if (!isPageWithSidebar(this.state.store.pageRole))
      return;

    window.addEventListener('scroll', this.updateSizeAndPosition, false);
    debiki.v0.util.addZoomOrResizeListener(this.updateSizeAndPosition);
    this.updateSizeAndPosition();
    key('s', this.toggleSidebarOpen);
    this.resizeMinimap();
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
    this.resizeMinimap();
    this.createAnyScrollbars();

    if (!this.state.store.horizontalLayout && localStorage) {
      localStorage.setItem('debikiShowSidebar', this.state.showSidebar ? 'true' : 'false');
    }
  },

  getCommentsViewport: function() {
    return $(this.refs.commentsViewport.getDOMNode());
  },

  resizeMinimap: function() {
    if (this.refs.minimap && this.state.showSidebar) {
      this.refs.minimap.redrawMinimap($(this.getDOMNode()).width());
    }
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
    var sidebar = $(this.getDOMNode());

    if (this.state.showSidebar) {
      var windowTop = $(window).scrollTop();
      var windowBottom = windowTop + $(window).height();
      sidebar.height(windowBottom - windowTop);
      this.updateCommentsScrollbar(windowBottom);
    }
    else {
      sidebar.height(0);
      var openButton = $(this.refs.openButton.getDOMNode());
      var minimap = $(this.refs.minimap.getDOMNode());
      openButton.css('top', minimap.height());
    }

    // When the window viewport is at the right edge, we don't want the sidebar to
    // overlap the rightmost comments. So add some horizontal padding after the
    // rightmost comment column, as wide as the sidebar.
    var padding = $('#dw-sidebar-padding');
    if (this.state.showSidebar) {
      if (!padding.length) {
        padding =  $('<li id="dw-sidebar-padding"><div ' +
            'style="height: 100px; background-color: greenyellow;"></div></li>');
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
    var sidebar = $(this.getDOMNode());
    var openButton = this.refs.openButton ? $(this.refs.openButton.getDOMNode()) : null;

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
      } else {
        sidebar.height(0);
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
    var store = this.state.store;
    var unreadComments = [];
    var recentComments = [];

    // Find 1) all unread comments, sorted in the way they appear on the page
    // And 2) all visible comments.
    var addComments = (postIds: number[]) => {
      _.each(postIds, (postId) => {
        var post: Post = store.allPosts[postId];
        if (isDeleted(post))
          return;

        var alreadyRead = postIdsReadLongAgo.indexOf(postId) !== -1 ||
            post.authorId === store.user.userId;
        if (!alreadyRead) {
          unreadComments.push(post);
        }
        recentComments.push(post);

        if (!isCollapsed(post)) {
          addComments(post.childIdsSorted);
        }
      });
    };

    var rootPost = store.allPosts[store.rootPostId];
    addComments(rootPost.childIdsSorted);

    recentComments.sort((a, b) => {
      if (a.createdAt < b.createdAt)
        return +1;

      if (a.createdAt < b.createdAt)
        return -1;

      return a.postId < b.postId ? +1 : -1;
    });
    recentComments = _.take(recentComments, 50);

    return { unread: unreadComments, recent: recentComments };
  },

  render: function() {
    var store = this.state.store;

    if (!isPageWithSidebar(store.pageRole))
      return null;

    // In 2D layout, show a small minimap, even if sidebar hidden.
    if (!this.state.showSidebar) {
      var minimapProps = $.extend({ isSidebarOpen: false, ref: 'minimap' }, store);
      return (
        r.div({},
          MiniMap(minimapProps),
          ToggleSidebarButton({ isSidebarOpen: false, onClick: this.openSidebar,
              ref: 'openButton' })));
    }

    var minimapProps = $.extend({
      isSidebarOpen: true,
      ref: 'minimap',
    }, store);

    var sidebarClasses = '';
    if (store.horizontalLayout) {
      sidebarClasses += ' dw-sidebar-fixed';
    }

    var unreadAndRecentComments = this.findComments();
    var unreadComments = unreadAndRecentComments.unread;
    var recentComments = unreadAndRecentComments.recent;
    var unreadBtnTitle = 'Unread (' + unreadComments.length + ')';

    var title;
    var unreadClass = '';
    var recentClass = '';
    var comments;
    switch (this.state.commentsType) {
      case 'Recent':
        title = 'Recent Comments:';
        recentClass = ' active';
        comments = recentComments;
        break;
      case 'Unread':
        title = 'Unread Comments:';
        unreadClass = ' active';
        comments = unreadComments;
        break;
      default:
        console.error('[DwE4PM091]');
    }

    var commentsElems = comments.map((post) => {
      var scrollToPost = (event) => {
        d.i.showAndHighlightPost($('#post-' + post.postId));
      }
      return (
        Post({ post: post, user: store.user, allPosts: store.allPosts,
          onClick: scrollToPost, skipIdAttr: true }));
    });

    return (
      r.div({ id: 'dw-sidebar', className: sidebarClasses },
        MiniMap(minimapProps),
        r.div({ className: 'dw-sidebar-btns' },
          r.button({ className: 'btn btn-default' + unreadClass, onClick: this.showUnread }, unreadBtnTitle),
          r.button({ className: 'btn btn-default' + recentClass, onClick: this.showRecent }, 'Recent')),
        ToggleSidebarButton({ isSidebarOpen: true, onClick: this.closeSidebar }),
        r.div({ className: 'dw-comments' },
          r.h3({}, title),
          r.div({ id: 'dw-sidebar-comments-viewport', ref: 'commentsViewport' },
            r.div({ id: 'dw-sidebar-comments-scrollable' },
              r.div({ className: 'dw-recent-comments' },
                commentsElems))))));
  }
});


function isPageWithSidebar(pageRole) {
  return pageRole === 'BlogPost' || pageRole === 'ForumTopic' || pageRole === 'WebPage';
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list

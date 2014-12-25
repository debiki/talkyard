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
    window.addEventListener('scroll', this.updateSizeAndPosition, false);
    debiki.v0.util.addZoomOrResizeListener(this.updateSizeAndPosition);
    this.updateSizeAndPosition();
    key('s', this.toggleSidebarOpen);
    this.createAnyScrollbars();
  },

  componentWillUnmount: function() {
    window.removeEventListener('scroll', this.updateSizeAndPosition, false);
    debiki.v0.util.removeZoomOrResizeListener(this.updateSizeAndPosition);
    key.unbind('s', this.toggleSidebarOpen);
  },

  componentWillUpdate: function(nextProps, nextState) {
    if (this.state.showSidebar && !nextState.showSidebar) {
      this.getCommentsViewport()['getNiceScroll']().remove();
    }
  },

  componentDidUpdate: function() {
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
    var windowTop = $(window).scrollTop();
    var windowBottom = windowTop + $(window).height();
    var sidebar = $(this.getDOMNode());
    sidebar.height(windowBottom - windowTop);
    this.updateCommentsScrollbar(windowBottom);

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

    if (commentSectionTop <= windowTop) {
      // We've scrolled down and the comments fill the whole browser window.
      sidebar.addClass('dw-sidebar-fixed');
      sidebar.css('top', '');
      sidebar.css('position', 'fixed');
      sidebar.height(windowBottom - windowTop);
    }
    else {
      // We're reading the article. Let the sidebar stay down together with
      // the comments, so it won't occlude the article. COULD skip this if
      // the browser window is very wide and we can safely show the whole sidebar
      // at the right edge, without occluding the article.
      sidebar.removeClass('dw-sidebar-fixed');
      sidebar.css('top', commentSectionOffset.top);
      sidebar.css('position', 'absolute');
      sidebar.height(windowBottom - commentSectionOffset.top);
    }

    this.updateCommentsScrollbar(windowBottom);

    var sidebarLeft = sidebar.offset().left;
    var commentsMaxWidth = sidebarLeft - 30 - commentSectionOffset.left;
    commentSection.css('max-width', commentsMaxWidth);
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

  findRecentComments: function() {
    var commentsByTimeDesc: Post[] = [];
    _.each(this.state.store.allPosts, (post: Post) => {
      if (post.postId !== TitleId || post.postId !== BodyPostId) {
        commentsByTimeDesc.push(post);
      }
    });

    commentsByTimeDesc.sort((a, b) => {
      if (a.createdAt < b.createdAt)
        return +1;

      if (a.createdAt < b.createdAt)
        return -1;

      return a.postId < b.postId ? +1 : -1;
    });

    commentsByTimeDesc = _.take(commentsByTimeDesc, 50);
    return commentsByTimeDesc;
  },

  findUnreadComments: function() {
    var unreadComments = [];

    // Find all unread comments, sorted in the way they appear on the page
    // (which tends to be most interesting ones first).
    var addUnreadComments = (postIds: number[]) => {
      _.each(postIds, (postId) => {
        var post: Post = this.state.store.allPosts[postId];
        var alreadyRead =
            postIdsReadLongAgo.indexOf(postId) !== -1 ||
            post.authorId === this.state.store.user.userId;
        if (!alreadyRead) {
          unreadComments.push(post);
        }
        addUnreadComments(post.childIdsSorted);
      });
    };

    var rootPost = this.state.store.allPosts[this.state.store.rootPostId];
    addUnreadComments(rootPost.childIdsSorted);
    return unreadComments;
  },

  render: function() {
    var store = this.state.store;

    if (!isPageWithSidebar(store.pageRole))
      return null;

    // In 2D layout, show a small minimap, even if sidebar hidden.
    if (!this.state.showSidebar) {
      var props = $.extend({
        isSidebarOpen: false,
        onOpenSidebarClick: this.openSidebar,
      }, store);
      return MiniMap(props);
    }

    var minimapProps = $.extend({
      isSidebarOpen: true,
    }, store);


    var sidebarClasses = '';
    if (store.horizontalLayout) {
      sidebarClasses += ' dw-sidebar-fixed';
    }

    var unreadComments = this.findUnreadComments();
    var unreadBtnTitle = 'Unread (' + unreadComments.length + ')';

    var title;
    var unreadClass = '';
    var recentClass = '';
    var comments;
    switch (this.state.commentsType) {
      case 'Recent':
        title = 'Recent Comments:';
        recentClass = ' active';
        comments = this.findRecentComments();
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

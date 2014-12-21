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
/// <reference path="../../shared/plain-old-javascript.d.ts" />
/// <reference path="minimap.ts" />
/// <reference path="toggle-sidebar-button.ts" />

//------------------------------------------------------------------------------
   module debiki2.sidebar {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;

var MinimapHeight = 160;


export var Sidebar = createComponent({
  mixins: [debiki2.StoreListenerMixin],

  getInitialState: function() {
    return {
      store: debiki2.ReactStore.allData(),
      showSidebar: false,
    };
  },

  onChange: function() {
    this.setState({
      store: debiki2.ReactStore.allData(),
      showSidebar: this.state.showSidebar,
    });
  },

  componentDidMount: function() {
    window.addEventListener('scroll', this.updateSizeAndPosition, false);
    debiki.v0.util.zoomListeners.push(this.updateSizeAndPosition);
    this.updateSizeAndPosition();
  },

  componentDidUpdate: function() {
    this.updateSizeAndPosition();
  },

  componentWillUnmount: function() {
    // TODO unregister update function.
  },

  updateSizeAndPosition: function() {
    if (!this.state.store.horizontalLayout) {
      this.updateSizeAndPosition1d();
    }
  },

  updateSizeAndPosition1d: function() {
    // COULD find a safer way to do this? Breaks if CSS class renamed / HTML
    // structure changed.
    var commentSectionOffset = $('.dw-cmts-tlbr + .dw-single-and-multireplies').offset();
    var commentSectionTop = commentSectionOffset.top;
    var windowTop = $(window).scrollTop();
    var sidebar = $(this.getDOMNode());

    if (commentSectionTop <= windowTop) {
      // We've scrolled down and the comments fill the whole browser window.
      sidebar.addClass('dw-sidebar-fixed');
      sidebar.css('top', '');
      sidebar.css('position', 'fixed');
    }
    else {
      // We're reading the article. Let the sidebar stay down together with
      // the comments, so it won't occlude the article. COULD skip this if
      // the browser window is very wide and we can safely show the whole sidebar
      // at the right edge, without occluding the article.
      sidebar.removeClass('dw-sidebar-fixed');
      sidebar.css('top', commentSectionOffset.top);
      sidebar.css('position', 'absolute');
    }
  },

  openSidebar: function() {
    this.state.showSidebar = true;
    this.setState(this.state);
  },

  closeSidebar: function() {
    this.state.showSidebar = false;
    this.setState(this.state);
  },

  render: function() {
    // In 2D layout, show a small minimap, even if sidebar hidden.
    if (!this.state.showSidebar) {
      var props = $.extend({
        isSidebarOpen: false,
        onOpenSidebarClick: this.openSidebar,
      }, this.state.store);
      return MiniMap(props);
    }

    var minimapProps = $.extend({
      isSidebarOpen: true,
    }, this.state.store);


    var sidebarClasses = '';
    if (this.state.store.horizontalLayout) {
      sidebarClasses += ' dw-sidebar-fixed';
    }

    return (
      r.div({ id: 'dw-sidebar', className: sidebarClasses },
        MiniMap(minimapProps),
        ToggleSidebarButton({ isSidebarOpen: true, onClick: this.closeSidebar }),
        RecentComments(this.state.store)));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list

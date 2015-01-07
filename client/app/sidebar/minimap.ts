/* Shows a minimap of the discussion; a rectangle marks current viewport.
 * Copyright (C) 2013 Kaj Magnus Lindberg (born 1979)
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

/* This file shows a minimap in which the article and all
 * comments are shown. The boundaries of the viewport are outlined too.
 * If you click and drag in the minimap, you'll scroll the viewport.
 */

/// <reference path="../../typedefs/react/react.d.ts" />
/// <reference path="../../typedefs/lodash/lodash.d.ts" />
/// <reference path="toggle-sidebar-button.ts" />

//------------------------------------------------------------------------------
   module debiki2.sidebar {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var $window = $(window);
var $document = $(document);


// Move to where?
var PageScrollMixin = {
  componentDidMount: function() {
    window.addEventListener('scroll', this.__onScroll, false);
    this.checkIsScrollingHandle = setInterval(this.__checkIsScrolling, 100);
    this.isScrolling = false;
    this.lastScrollTime = 0;
  },
  componentWillUnmount: function() {
    window.removeEventListener('scroll', this.__onScroll, false);
    clearInterval(this.checkIsScrollingHandle);
  },
  __checkIsScrolling: function() {
    if (Date.now() - this.lastScrollTime > 200 && this.isScrolling) {
      this.isScrolling = false;
      if (this.onScrollStop) {
        this.onScrollStop();
      }
    }
  },
  __onScroll: function() {
    if (!this.isScrolling) {
      this.isScrolling = true;
      if (this.onScrollStart) {
        this.onScrollStart();
      }
    }
    if (this.onScroll) {
      this.onScroll();
    }
    this.lastScrollTime = Date.now();
  }
};


var ShowMinimapMinLeft = 80;
var ShowMinimapMinTop = 200;
var TooFewPosts = 5 + 2; // + title and body


export var MiniMap = createComponent({
  mixins: [PageScrollMixin],

  componentDidMount: function() {
    this.redrawMinimap();
    this.showOrHide();
  },

  componentDidUpdate: function() {
    // Don't redraw until any sidebar padding has been removed (or added) and
    // the document resized. Otherwise, when closing the sidebar, the posts will be
    // offset a little bit to the left, because they'd be drawn with the sidebar
    // padding still present.
    setTimeout(this.redrawMinimap);
  },

  redrawMinimap: function(anyWidth) {
    this.showOrHide();
    if (!this.refs.canvas)
      return;

    if (this.props.isSidebarOpen) {
      if (!anyWidth)
        return; // hack: wait until invoked from sidebar.ts

      // Adjust minimap size so it fits in the sidebar.
      this.width = anyWidth;
      this.height = this.calculateMinimapSize(this.width).height;
      this.height = Math.min($(window).height() / 9, this.height);
      var canvas = $(this.refs.canvas.getDOMNode());
      canvas.attr('width', this.width);
      canvas.attr('height', this.height);
    }

    var canvasContext = this.refs.canvas.getDOMNode().getContext('2d');
    this.canvasContext = canvasContext;
    this.numPostsDrawn = this.props.numPosts;

    drawAllPostsInMinimap(this, canvasContext);
    this.cachedMinimap = canvasContext.getImageData(0, 0, this.width, this.height);

    drawViewport(canvasContext, this.width, this.height);
  },

  calculateMinimapSize: function(width?: number): any {
    if (!width) {
      var maxMinimapWidth = Math.min($window.width() / 3, 500);
      width = Math.min(maxMinimapWidth, $document.width() / 12);
      // Make the minimap smaller if there aren't very many comments.
      var veryManyComments = 300;
      width = 50 + Math.max(0, width - 50) * (Math.log(this.props.numPostsExclTitle) /
          Math.log(veryManyComments));
    }
    var aspectRatio = $document.width() / Math.max($document.height(), 1);
    var height = width / aspectRatio;
    return {
      width: width,
      height: height
    };
  },

  shallShowMinimap: function() {
    return !this.props.horizontalLayout || this.props.isSidebarOpen ||
        $window.scrollLeft() >= ShowMinimapMinLeft ||
        $window.scrollTop() >= ShowMinimapMinTop;
  },

  showOrHide: function() {
    if (!this.getDOMNode())
      return;

    // Don't show minimap and open-sidebar-button directly when loading page, only
    // after scrolling a bit.
    if (this.shallShowMinimap()) {
      $(this.getDOMNode()).show();
    }
    // Don't show the minimap when one has scrolled back to the upper left corner,
    // because it would occlude stuff in the top nav bar.
    else if (!this.isScrollingInViewport) {
      $(this.getDOMNode()).hide();
    }
  },

  onScroll: function(event) {
    if (this.canvasContext) {
      this.canvasContext.clearRect(0, 0, this.width, this.height);
      this.canvasContext.putImageData(this.cachedMinimap, 0, 0);
      drawViewport(this.canvasContext, this.width, this.height);
    }
    this.showOrHide();
  },

  startScrollingInViewport: function(event) {
    event.preventDefault();
    this.isScrollingInViewport = true;
    $(window).on('mousemove', this.scrollInViewport);
    $(window).on('mouseup', this.stopScrollingInViewport);
    $(window).on('mouseleave', this.stopScrollingInViewport);
    this.scrollInViewport(event);
  },

  stopScrollingInViewport: function(event) {
    event.preventDefault()
    this.isScrollingInViewport = false;
    $(window).off('mousemove', this.scrollInViewport);
    $(window).off('mouseup', this.stopScrollingInViewport);
    $(window).off('mouseleave', this.stopScrollingInViewport);
    if (!this.shallShowMinimap()) {
      $(this.getDOMNode()).hide();
    }
  },

  scrollInViewport: function(event) {
    if (!this.isScrollingInViewport)
      return;

    event.preventDefault();
    var canvasOffset = $(this.refs.canvas.getDOMNode()).offset();
    var docPosClickedX = (event.pageX - canvasOffset.left) / this.width * $document.width();
    var docPosClickedY = (event.pageY - canvasOffset.top) / this.height * $document.height();
    var newDocCornerX = docPosClickedX - $window.width() / 2;
    var newDocCornerY = docPosClickedY - $window.height() / 2;
    $window[0]['scrollTo'](newDocCornerX, newDocCornerY)
  },

  render: function() {
    if (!this.props.horizontalLayout || !isPageWithMinimap(this.props.pageRole) ||
        this.props.numPosts <= TooFewPosts)
      return null;

    var size = this.calculateMinimapSize(this.props.width);
    this.width = size.width;
    this.height = size.height;
    return (
      r.canvas({ id: 'dw-minimap', width: this.width, height: this.height,
          ref: 'canvas', onMouseDown: this.startScrollingInViewport }));
  }
});


function isPageWithMinimap(pageRole) {
  return pageRole === 'BlogPost' || pageRole === 'ForumTopic' || pageRole === 'WebPage';
}


function drawAllPostsInMinimap(minimap, canvasContext) {
  canvasContext.clearRect(0, 0, minimap.width, minimap.height);
  // Only draw comments inside .dw-page, or the ones inside any open sidebar would be drawn too.
  $('.dw-page .dw-p-bd-blk').each(function () {
    drawSinglePost($(this), canvasContext, minimap.width, minimap.height);
  });
}


function drawSinglePost(bodyBlock, context, minimapWidth, minimapHeight) {
  var offset = bodyBlock.offset();
  var height = bodyBlock.height();
  var width = bodyBlock.width();
  var x = minimapWidth * offset.left / $document.width();
  var w = minimapWidth * width / $document.width();
  var y = minimapHeight * offset.top / $document.height();
  var h = minimapHeight * height / $document.height();
  // Make very short comments visiible by setting min size.
  var w = Math.max(3, w);
  var h = Math.max(1, h);
  context.fillStyle = 'hsl(0, 0%, 15%)';
  context.fillRect(x, y, w, h);
}


function drawViewport(context, minimapWidth, minimapHeight) {
  var x = minimapWidth * $window.scrollLeft() / $document.width();
  var w = minimapWidth * $window.width() / $document.width();
  var y = minimapHeight * $window.scrollTop() / $document.height();
  var h = minimapHeight * $window.height() / $document.height()
  context.beginPath();
  context.strokeStyle = 'hsl(210, 100%, 35%)';
  context.lineWidth = 2;
  context.rect(x, y, w, h);
  context.stroke();
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
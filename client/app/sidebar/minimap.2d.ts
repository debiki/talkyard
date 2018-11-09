/* Shows a minimap of the discussion; a rectangle marks current viewport.
 * Copyright (C) 2013 Kaj Magnus Lindberg
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

/// <reference path="../utils/page-scroll-mixin.ts" />
/// <reference path="../../../node_modules/@types/jquery/index.d.ts" />


//------------------------------------------------------------------------------
   namespace debiki2.sidebar {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
var $window = $(window);
var $document = $(document);


var ShowMinimapMinLeft = 80;
var ShowMinimapMinTop = 200;
var TooFewPosts = 5 + 2; // + 2 becaus of title and body


export var MiniMap = createComponent({
  mixins: [utils.PageScrollMixin],

  componentDidMount: function() {
    this.redrawMinimap();
    this.showOrHide();
  },

  componentDidUpdate: function() {
    // Don't redraw until any #dw-sidebar-padding has been removed (or added) and
    // the document resized. Otherwise, when closing the sidebar, the posts will be
    // offset a little bit to the left, because they'd be drawn with the sidebar
    // padding still present.
    setTimeout(this.redrawMinimap);
  },

  redrawMinimap: function() {
    this.showOrHide();
    if (!this.refs.canvas)
      return;

    var canvasContext = this.refs.canvas.getContext('2d');
    this.canvasContext = canvasContext;
    this.numPostsDrawn = this.props.numPosts;

    drawAllPostsInMinimap(this, canvasContext);
    this.cachedMinimap = canvasContext.getImageData(0, 0, this.width, this.height);

    drawViewport(canvasContext, this.width, this.height);
  },

  calculateMinimapSize: function(): any {
    var maxMinimapWidth = Math.min($window.width() / 3, 500);
    var width = Math.min(maxMinimapWidth, $document.width() / 12);
    var minWidth = 40;

    // Make the minimap smaller if there aren't very many comments.
    var veryManyComments = 300;
    width = minWidth + Math.max(0, width - 50) * (Math.log(this.props.numPostsExclTitle) /
        Math.log(veryManyComments));

    var aspectRatio = $document.width() / Math.max($document.height(), 1);
    var height = width / aspectRatio;

    var maxHeight = $(window).height() / 6;
    if (height > maxHeight) {
      width = Math.max(minWidth, maxHeight * aspectRatio);
      height = maxHeight;
    }

    return {
      width: width,
      height: height
    };
  },

  shallShowMinimap: function() {
    return !this.props.horizontalLayout ||
        $window.scrollLeft() >= ShowMinimapMinLeft ||
        $window.scrollTop() >= ShowMinimapMinTop;
  },

  showOrHide: function() {
    if (!this.refs.canvas)
      return;

    // Don't show minimap and open-sidebar-button directly when loading page, only
    // after scrolling a bit.
    if (this.shallShowMinimap()) {
      $(this.refs.canvas).show();
    }
    // Don't show the minimap when one has scrolled back to the upper left corner,
    // because it would occlude stuff in the top nav bar.
    else if (!this.isScrollingInViewport) {
      $(this.refs.canvas).hide();
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
    this.showOrHide();
  },

  scrollInViewport: function(event) {
    if (!this.isScrollingInViewport)
      return;

    event.preventDefault();
    var canvasOffset = $(this.refs.canvas).offset();
    var docPosClickedX = (event.pageX - canvasOffset.left) / this.width * $document.width();
    var docPosClickedY = (event.pageY - canvasOffset.top) / this.height * $document.height();
    var newDocCornerX = docPosClickedX - $window.width() / 2;
    var newDocCornerY = docPosClickedY - $window.height() / 2;
    window.scrollTo(newDocCornerX, newDocCornerY)
  },

  render: function() {
    if (!this.props.horizontalLayout || !isPageWithMinimap(this.props.pageRole) ||
        this.props.numPosts <= TooFewPosts) {
      // Stil show placeholder, so toggle-sidebar button wil be pushed down from
      // the top so it wont overlap the top bar.
      return (
        r.div({},
          r.div({ id: 'dw-minimap-placeholder', ref: 'placeholder',
              style: { height: 100 }})));
    }

    var size = this.calculateMinimapSize();
    this.width = size.width;
    this.height = size.height;
    return (
      r.div({},
        r.div({ id: 'dw-minimap-placeholder', ref: 'placeholder', style: { height: this.height }}),
        r.canvas({ id: 'dw-minimap', width: this.width, height: this.height,
            ref: 'canvas', onMouseDown: this.startScrollingInViewport })));
  }
});


function isPageWithMinimap(pageRole: PageRole): boolean {
  return pageRole === PageRole.About ||
      pageRole === PageRole.Question || pageRole === PageRole.ToDo ||
      pageRole === PageRole.UsabilityTesting ||  // [plugin]
      pageRole === PageRole.MindMap || pageRole === PageRole.Discussion ||
      pageRole === PageRole.WebPage;
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
  var documentWidth = Math.max(1, $document.width() - anySidebarPaddingWidth());
  var x = minimapWidth * offset.left / documentWidth;
  var w = minimapWidth * width / documentWidth;
  var y = minimapHeight * offset.top / $document.height();
  var h = minimapHeight * height / $document.height();
  // Make very short comments visiible by setting min size.
  var w = Math.max(3, w);
  var h = Math.max(1, h);
  context.fillStyle = 'hsl(0, 0%, 25%)';
  context.fillRect(x, y, w, h);
}


function drawViewport(context, minimapWidth, minimapHeight) {
  var paddingWidth = anySidebarPaddingWidth();
  var windowWidth = Math.max(1, $window.width() - paddingWidth);
  var documentWidth = Math.max(1, $document.width() - paddingWidth);
  var x = minimapWidth * $window.scrollLeft() / documentWidth;
  var w = minimapWidth * windowWidth / documentWidth - 1;
  var y = minimapHeight * $window.scrollTop() / $document.height();
  var h = minimapHeight * $window.height() / $document.height() - 1;
  context.beginPath();
  context.strokeStyle = 'hsl(210, 100%, 35%)';
  context.lineWidth = 2;
  context.rect(x, y, w, h);
  context.stroke();
}


function anySidebarPaddingWidth() {
  var sidebarPadding = $('#dw-sidebar-padding');
  return sidebarPadding.length ? sidebarPadding.width() : 0;
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list

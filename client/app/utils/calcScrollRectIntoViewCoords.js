/* Scrolls something into view, with some margin.
 * Copyright (c) 2010-2015, 2017 Kaj Magnus Lindberg
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

var d = { i: debiki.internal };


d.i.calcScrollRectIntoViewCoords = function(rect, options) {
  var marginTop = options.marginTop || 15;
  var marginBottom = options.marginBottom || 15;
  var marginLeft = options.marginLeft || 15;
  var marginRight = options.marginRight || 15;

  var winHeight = window.innerHeight;
  var winWidth = window.innerWidth;

  var marginRect = {
    top: rect.top - marginTop,
    bottom: rect.bottom + marginBottom,
    left: rect.left - marginLeft,
    right: rect.right + marginRight
  };

  // One can override the height, in case cares about showing only the upper part of the thing.
  if ((typeof options.height) === 'number') {  // (_.isNumber not incl in embeddedJsFiles in gulpfile.js)
    marginRect.bottom = marginRect.top + options.height + marginBottom;
  }

  var parentScrollTop = options.parent.scrollTop;
  var desiredParentTop = parentScrollTop;
  if (marginRect.top < 0) {
    desiredParentTop = parentScrollTop + marginRect.top;
  }
  else if (marginRect.bottom > winHeight) {
    var distToScroll = marginRect.bottom - winHeight;
    desiredParentTop = parentScrollTop + distToScroll;
    // If viewport is small, prefer to show the top not the bottom.
    if (marginRect.top - distToScroll < 0) {
      desiredParentTop = parentScrollTop + marginRect.top;
    }
  }

  var parentScrollLeft = options.parent.scrollLeft;
  var desiredParentLeft = parentScrollLeft;
  if (marginRect.left < 0) {
    desiredParentLeft = parentScrollLeft + marginRect.left;
  }
  else if (marginRect.right > winWidth) {
    var distToScroll = marginRect.right - winWidth;
    desiredParentLeft = parentScrollLeft + distToScroll;
    // If viewport is small, prefer to show the left side rather than the right.
    if (marginRect.left - distToScroll < 0) {
      desiredParentLeft = parentScrollLeft + marginRect.left;
    }
  }

  return {
    actualWinTop: parentScrollTop,
    actualWinLeft: parentScrollLeft,
    desiredParentTop: desiredParentTop,
    desiredParentLeft: desiredParentLeft,
    needsToScroll: parentScrollTop !== desiredParentTop || parentScrollLeft !== desiredParentLeft
  };
};

// vim: fdm=marker et ts=2 sw=2 tw=100 list

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

//------------------------------------------------------------------------------
   module debiki2.utils {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var $ = d.i.$;


export function calcScrollIntoViewCoordsInPageColumn(what, options?) {
  // Warning: dupl code, see [5GUKF24] below.
  if (what && _.isString(what)) {
    what = $first(what);
  }
  if (!what)
    return { needsToScroll: false };
  if (!options) {
    options = {};
  }
  debiki2.dieIf(options.parent, 'EsE77KF28');
  options.parent = $byId('esPageColumn');
  return d.i.calcScrollIntoViewCoords(what, options);
}


export function scrollIntoViewInPageColumn(what, options?) {
  // Warning: dupl code, see [5GUKF24] above.
  if (what && _.isString(what)) {
    what = $first(what);
  }
  if (!what)
    return;
  if (!options) {
    options = {};
  }
  debiki2.dieIf(options.parent, 'EsE5GKF23');
  options.parent = $byId('esPageColumn');
  scrollIntoView(what, options);
}


d.i.elemIsVisible = function(elem) {
  var coords = d.i.calcScrollIntoViewCoords(elem, {
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0 ,
    parent: $byId('esPageColumn'), // (could make configurable, probably not needed though)
  });
  return !coords.needsToScroll;
};


d.i.calcScrollIntoViewCoords = function(elem, options) {
  debiki2.dieIf(!options, 'EsE2PUJK5');

  var marginTop = options.marginTop || 15;
  var marginBottom = options.marginBottom || 15;
  var marginLeft = options.marginLeft || 15;
  var marginRight = options.marginRight || 15;

  var winHeight = window.innerHeight;
  var winWidth = window.innerWidth;

  var elemRect = elem.getBoundingClientRect();
  var marginRect = {
    top: elemRect.top - marginTop,
    bottom: elemRect.bottom + marginBottom,
    left: elemRect.left - marginLeft,
    right: elemRect.right + marginRight,
  };

  // One can override the height, in case cares about showing only the upper part of the thing.
  if (_.isNumber(options.height)) {
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
    needsToScroll: parentScrollTop !== desiredParentTop || parentScrollLeft !== desiredParentLeft,
  };
};


export function scrollIntoView(elem, options, onDone?: () => void) {
  if (!options) options = {};
  var duration = options.duration || 600;

  if (!options.parent) {
    options.parent = $byId('esPageColumn');
  }

  var coords = d.i.calcScrollIntoViewCoords(elem, options);
  if (coords.needsToScroll) {
    smoothScroll(options.parent, coords.desiredParentLeft, coords.desiredParentTop);
  }
  // For now, call immediately. Did before, works ok, currently.
  if (onDone) {
    onDone();
  }
}

d.i.scrollIntoView = scrollIntoView;


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=100 list

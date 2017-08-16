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
   namespace debiki2.utils {
//------------------------------------------------------------------------------

const d = { i: debiki.internal };


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
  const coords = d.i.calcScrollIntoViewCoords(elem, {
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0 ,
    parent: $byId('esPageColumn'), // (could make configurable, probably not needed though)
  });
  return !coords.needsToScroll;
};


d.i.calcScrollIntoViewCoords = function(elem, options) {
  const rect = elem.getBoundingClientRect();
  return d.i.calcScrollRectIntoViewCoords(rect, options);
};


export function scrollIntoView(elem, options, onDone?: () => void) {
  options = options ? _.clone(options) : {};
  const duration = options.duration || 600;

  if (d.i.isInEmbeddedCommentsIframe) {
    delete options.parent;
    const rect = cloneRect(elem.getBoundingClientRect());
    window.parent.postMessage(JSON.stringify(['scrollComments', [rect, options]]), '*');
  }
  else {
    if (!options.parent) {
      options.parent = $byId('esPageColumn');
    }
    const coords = d.i.calcScrollIntoViewCoords(elem, options);
    if (coords.needsToScroll) {
      smoothScroll(options.parent, coords.desiredParentLeft, coords.desiredParentTop);
    }
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

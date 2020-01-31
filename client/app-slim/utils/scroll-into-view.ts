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
   namespace debiki2.utils {   // RENAME to Scroll?  [SCRL-NSP]
//------------------------------------------------------------------------------

const d = { i: debiki.internal };


export function calcScrollIntoViewCoordsInPageColumn(
    elemOrSelector: Element | string, options: CalcScrollOpts = {}): CalcScrollResult {
  // Warning: dupl code, see [5GUKF24] below.
  let what: Element;
  if (elemOrSelector && _.isString(elemOrSelector)) {
    what = $first(elemOrSelector);
  }
  else {
    what = <Element> elemOrSelector;
  }

  if (!what) {
    // This is fine — maybe something just got unmounted / removed from the page.
    return { needsToScroll: false };
  }

  debiki2.dieIf(options.parent, 'EsE77KF28');
  options.parent = $byId('esPageColumn');

  if (!options.parent.contains(what)) {
    // But this is a bug? Shouldn't try to scroll something that's not inside the page.
    // @ifdef DEBUG
    die('TyE4062KUPTHA2');
    // @endif
    return { needsToScroll: false };
  }

  return calcScrollIntoViewCoords(what, options);
}


export function scrollIntoViewInPageColumn(
    elemOrSelector: Element | string, options: ScrollIntoViewOpts = {}): boolean | undefined {
  // Warning: dupl code, see [5GUKF24] above.
  let what: Element;
  if (elemOrSelector && _.isString(elemOrSelector)) {
    try {
      what = $first(elemOrSelector);
    }
    catch (ex) {
      if (options.maybeBadId) return; // expected error
      throw ex;
    }
  }
  else {
    what = <Element> elemOrSelector;
  }
  if (!what)
    return;
  debiki2.dieIf(options.parent, 'EsE5GKF23');
  options.parent = $byId('esPageColumn');
  if (!options.parent.contains(what))
    return false;
  return scrollIntoView(what, options);
}


export function elemIsVisible(elem: Element): boolean {
  const coords = calcScrollIntoViewCoords(elem, {
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0 ,
    parent: $byId('esPageColumn'), // (could make configurable, probably not needed though)
  });
  return !coords.needsToScroll;
}

d.i.elemIsVisible = elemIsVisible;


function calcScrollIntoViewCoords(elem: Element, options: CalcScrollOpts): CalcScrollResult {
  const rect = elem.getBoundingClientRect();
  return d.i.calcScrollRectIntoViewCoords(rect, options);
};


export function scrollIntoView(elem, options: ScrollIntoViewOpts,
      // remove — now incl in 'options'
      onDone?: () => void): boolean | undefined {
  options = options ? _.clone(options) : {};
  onDone = onDone || options.onDone;

  let needsToScroll: boolean | undefined;
  if (eds.isInEmbeddedCommentsIframe) {
    delete options.parent;
    const rect = cloneRect(elem.getBoundingClientRect());
    window.parent.postMessage(JSON.stringify(['scrollComments', [rect, options]]), eds.embeddingOrigin);
  }
  else {
    if (!options.parent) {
      options.parent = $byId('esPageColumn');
    }

    // Here could be a good place to add extra margin, if topbar open?  [306KDRGFG2]

    const coords = calcScrollIntoViewCoords(elem, options);
    needsToScroll = coords.needsToScroll;
    if (needsToScroll) {
      smoothScroll(
          options.parent, coords.desiredParentLeft, coords.desiredParentTop,
          options.duration, onDone);
    }
  }

  if (onDone && !needsToScroll) {
    onDone();
  }

  return needsToScroll;
}

d.i.scrollIntoView = scrollIntoView;


export function makeShowPostFn(currentPostNr: PostNr, postToShowNr: PostNr) {
  // Combine this? [306KUGSTRR3]  <a href='#post-..'>  + onClick preventDefault?
  return function(event) {
    event.preventDefault();
    event.stopPropagation();
    debiki2.page.addVisitedPosts(currentPostNr, postToShowNr);
    debiki2.ReactActions.loadAndShowPost(postToShowNr);
  }
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=100 list

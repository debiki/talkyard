/*
 * Copyright (c) 2016 Kaj Magnus Lindberg
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

/// <reference path="../utils/react-utils.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.page.Hacks {
//------------------------------------------------------------------------------


/**
 * React roots outside the main root, can use this hacky function to
 * make navigation happen properly, in the main React root.
 * This single-page-app navigation only works if ExtReactRootNavComponent has
 * been mounted though — and then, this fn returns true; then the caller
 * should skip any default click event action.
 *
 * CLEAN_UP REFACTOR maybe not needed? Supposedly, if creating different Router:s in separate
 * react roots, but one gives them the same History object, they'll know what the others
 * are doing and update their own routes proprely, when navigation happens in another React root...
 *
 * ...But still a bit needed, for any non-React links in the custom-html-top-header.
 */
export function navigateTo(path: string): boolean {
  return doNavigate(path);
}

let doNavigate: (string) => boolean = function() {
  return false;
};

export const ExtReactRootNavComponent = createReactClass({
  displayName: 'ExtReactRootNavComponent',

  componentWillMount: function() {
    doNavigate = (path: string) => {
      if (this.props.location.pathname !== path) {
        this.props.history.push(path);
        return true;
      }
    }
  },

  render: function() {
    return null;
  }
});


export function reactRouterLinkifyTopHeaderLinks() {
  Bliss.delegate(document, 'click', '.esPageHeader a[href]', function(event) {
    const elem = <HTMLLinkElement> event.target;
    if (!elem || !elem.href || !elem.href.length) return;
    // Try internal single-page-app navigation, if it's a link to a page here on the same site.
    const href = elem.href;
    let newUrlPath;
    if (href.search('//') === -1) {
      if (href[0] === '/') {
        // And absolute url path, like '/some/page'.
        newUrlPath = href;
      }
      else {
        // A relative link, like 'some/page', weird. Don't try SPA navigation.
        return;
      }
    }
    else if (href.search(location.origin) === 0) {
      // Something like 'https://this.server.com/page/path' — keep '/page/path' only.
      newUrlPath = href.substr(location.origin.length)
    }
    else if (href.search(`//${location.hostname}/`) === 0) {
      // Something like '//this.server.com/page/path' — keep '/page/path' only.
      newUrlPath = href.substr(location.hostname.length + 2);
    }
    else {
      // External link.
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    navigateTo(newUrlPath)
  });
}


export function processPosts() {
  processTimeAgo();
  hideShowCollapseButtons();
  addCanScrollHintsSoon();
}


// Finds all tall posts and unhides their collapse button, which by default
// is hidden by CSS. [4KY0S2]
//
function hideShowCollapseButtons() {
  const collapseBtns = $$all('.dw-a-clps');
  _.each(collapseBtns,function(collapseBtn) {
    // Three steps up: dw-p-hd —> .dw-p —> .dw-t, we'll find the .closest('.dw-t').  IE11 doesn't
    // support .closest.
    const threadElem = collapseBtn.parentElement.parentElement.parentElement;
    if (!threadElem) return;
    const rect = threadElem.getBoundingClientRect();  // ooops, FORCED_REFLOW caused by this line
    if (rect.height > 170) {
      $h.addClasses(collapseBtn, 'esP_Z-Show');       // ... and this
    }
    else {
      $h.removeClasses(collapseBtn, 'esP_Z-Show');    // ... and this
    }
  });
}


function addCanScrollHintsImpl() {
  // Remove scroll hints for elemes that no longer need it.
  const elemsWithHint = $$all('.dw-p-bd.esScrollHint-X');
  _.each(elemsWithHint,function(elem) {
    const overflowsX = elem.scrollWidth > elem.clientWidth;
    if (!overflowsX) {
      // (Some of these will be checked again in the 2nd $('.dw-p-bd...') call below.)
      $h.removeClasses(elem, 'esScrollHint-X');
    }
  });
  // Add scroll hints for elemes that need it.
  const elemsNoHint = $$all('.dw-p-bd:not(.esScrollHint-X)');
  _.each(elemsNoHint,function(elem) {
    const overflowsX = elem.scrollWidth > elem.clientWidth;
    if (overflowsX) {
      $h.addClasses(elem, 'esScrollHint-X');
    }
  });
}

export const addCanScrollHintsSoon = _.debounce(addCanScrollHintsImpl, 1100);


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list

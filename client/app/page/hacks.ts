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

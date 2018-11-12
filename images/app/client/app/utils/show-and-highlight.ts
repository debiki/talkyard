/* Scrolls into view and highlights comments.
 * Copyright (C) 2010-2012, 2017 Kaj Magnus Lindberg
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

/// <reference path="scroll-into-view.ts" />

//------------------------------------------------------------------------------
   namespace debiki2 {
//------------------------------------------------------------------------------

// CLEAN_UP merge-rename with scroll-into-view.ts to scroll-and-show.ts?

/**
 * There might be a position: fixed sidebar to the right. This hacky
 * function ensures the sidebar won't hide the elem we scroll to,
 * by adding some options.marginRight.
 * Find the sidebar in client/app/sidebar/sidebar.ts.
 */
function addAnySidebarWidth(options) {
  options = options || {};
  var sidebar = debiki2.$byId('dw-sidebar');
  if (!sidebar || !sidebar.querySelector('.dw-comments')) {
    // Sidebar is closed.
    return options;
  }
  var marginRight = options.marginRight || 15;
  marginRight += sidebar.offsetWidth;
  options.marginRight = marginRight;
  return options;
}


debiki.internal.showAndHighlightPost = function(postElem, options) {
  if (!postElem) {
    logError('Got no post [EdE7JKWD20]');
    return;
  }
  options = addAnySidebarWidth(options);
  // Add space for position-fixed stuff at the top: Forw/Back btns and open-sidebar btn.
  options.marginTop = options.marginTop || 60;
  options.marginBottom = options.marginBottom || 300;
  utils.scrollIntoView(postElem, options, function() {
    highlightPostBriefly(postElem);
  });
};


function highlightPostBriefly(postElem) {
  const head = postElem.querySelector('.dw-p-hd');
  const body = postElem.querySelector('.dw-p-bd');
  const highlightOnClass = 'dw-highlight-on';
  const highlightOffClass = 'dw-highlight-off';
  const allClasses = highlightOnClass + ' ' + highlightOffClass;
  const $h = debiki2.$h;
  // On mind map pages, there're no post headers (except for for the original post).
  if (head) $h.addClasses(head, highlightOnClass);
  $h.addClasses(body, highlightOnClass);
  setTimeout(function() {
    if (head) $h.addClasses(head, highlightOffClass);
    $h.addClasses(body, highlightOffClass);
    // At least Chrome returns 'Xs', e.g. '1.5s', regardles of the units in the CSS file.
    const durationSeconds = 4; // dupl constant, also in css [2DKQ7AM]
                               // doesn't work: parseFloat(head.style.transitionDuration);  (it's "")
    setTimeout(function() {
      if (head) $h.removeClasses(head, allClasses);
      $h.removeClasses(body, allClasses);
    }, durationSeconds * 1000);
  }, 700);
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list

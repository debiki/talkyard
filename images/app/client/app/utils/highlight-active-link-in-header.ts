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


//------------------------------------------------------------------------------
   namespace debiki2.utils {
//------------------------------------------------------------------------------


export function highlightActiveLinkInHeader() {
  const className = 'esActiveHeaderLink';
  $h.removeClasses($first('.' + className), className);
  if (location.pathname.search('/-/') === 0) {
    // We're in the user profile area, or some other special place.
    return;
  }
  let activeLinkElem;
  let longestMatch = 0;
  _.each($all('.esPageHeader a'), function(linkElem: HTMLElement) {
    const href = linkElem.getAttribute('href');
    if (!href) return;
    const currentHref = href.indexOf('://') === -1
      ? location.pathname + location.search + location.hash
      : location.href.toString();
    const isActive = currentHref.indexOf(href) === 0;
    if (isActive && href.length >= longestMatch) {
      longestMatch = href.length;
      activeLinkElem = linkElem;
    }
  });
  $h.addClasses(activeLinkElem, className);
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list

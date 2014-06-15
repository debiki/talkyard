/**
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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
   module debiki2.admin {
//------------------------------------------------------------------------------


/**
 * Navigates back to the page that the user viewed before s/he opened the admin app,
 * or to the homepage ('/') if that's not possible.
 */
export function goBackToSite() {
  // The return-to-URL-path must start with '/' so we know it refers to something
  // in the same site. Allowing links to other sites would be a security issue.
  var anyReturnToPathHits = location.toString().match(/\?returnTo=(\/[^#]+)/);
  if (anyReturnToPathHits) {
    var returnToPath = anyReturnToPathHits[1];
    window.location.replace(returnToPath);
  }
  else {
    window.location.replace('/');
  }
};


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list

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

var numStepsBack = undefined;


/**
 * Navigates back to the page that the user viewed before s/he opened the admin app,
 * or to the homepage ('/') if that's not possible.
 */
export function goBackToSite() {
  if (!numStepsBack) {
    window.location.replace('/');
  }
  else {
    history.go(-numStepsBack);
  }
};


// Increment `numStepsBack` when the HTML5 pushState method is invoked.
try {
  var origPushState = history.pushState;
  history.pushState = function() {
    if (!numStepsBack) {
      numStepsBack = 1;
    }
    numStepsBack += 1;
    return origPushState.apply(history, arguments);
  }
}
catch (error) {
  // Leave `numStepsBack` undefined; go to '/' when clicking 'Back to site'.
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list

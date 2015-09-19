/* Login and logout related code, and email config dialog.
 * Copyright (C) 2012-2012 Kaj Magnus Lindberg (born 1979)
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

/**
 * This file: Login and logout control flow, and dialogs for
 * email, login ok and login failure.
 * (Find guest login and OpenID login dialogs in other files.)
 */

var d = { i: debiki.internal, u: debiki.v0.util };
var $ = d.i.$;


// Any callback to call after login.
var onLoginCallback = null;


/**
 * Logs in and then calls the callback.
 */
d.i.loginIfNeeded = function(reason, anyReturnToUrl, callback) {
  if (debiki2.ReactStore.getUser().isLoggedIn) {
    callback();
  }
  else {
    onLoginCallback = callback;
    debiki2.login.getLoginDialog().open(reason, anyReturnToUrl);
  }
};


/**
 * Continues any form submission that was interrupted by the
 * user having to log in.
 */
d.i.continueAnySubmission = function() {
  if (onLoginCallback) {
    onLoginCallback();
    onLoginCallback = null;
  }
};


d.i.showLoginFailed = function(errorMessage) {
  // For now:
  alert('Login failed: ' + errorMessage);
};




// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list

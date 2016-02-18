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

/// <reference path="../../typedefs/react/react.d.ts" />
/// <reference path="../plain-old-javascript.d.ts" />
/// <reference path="../utils/react-utils.ts" />
/// <reference path="login-dialog.ts" />

//------------------------------------------------------------------------------
   module debiki2.login {
//------------------------------------------------------------------------------


 /**
  * Logs in and calls success(). Or, if verification email needed, then afterwards returns to
  * this page + the url hash, and the user should then click the button (or whatever) again.
  */
export function loginIfNeededReturnToHash(
      // Later: convert all string login reason to enum values.
      loginReason: LoginReason | string, hash: string, success: () => void) {
  var returnToUrl = debiki.internal.makeReturnToPageHashForVerifEmail(hash);
  loginIfNeeded(loginReason, returnToUrl, success);
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list

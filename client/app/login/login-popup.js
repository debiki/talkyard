/* Shows some OAuth login dialog.
 * Copyright (c) 2010-2012, 2017 Kaj Magnus Lindberg
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


var d = { i: debiki.internal, u: debiki.v0.util };


d.i.createLoginPopup = function(url) {
  // Based on popupManager.createPopupOpener, from popuplib.js.

  var width = 450;
  var height = 500;
  var coordinates = popupManager.getCenteredCoords(width, height);
  var windowName = 'LoginPopup';

  // For now. Fixes # in return-to-url.
  var url = url.replace(/#/, '__dwHash__');
  var anyProtocol = d.i.isInIframe ? (d.i.secure ? 'https:' : 'http:') : '';

  // Here is described how to configure the popup window:
  // http://svn.openid.net/repos/specifications/user_interface/1.0/trunk
  //    /openid-user-interface-extension-1_0.html
  var popupWindow = window.open(anyProtocol + url, windowName,
      'width='+ width +',height='+ height +
      ',status=1,location=1,resizable=yes'+
      ',left='+ coordinates[0] +',top='+ coordinates[1]);

  // A check to perform at each execution of the timed loop. It also triggers
  // the action that follows the closing of the popup
  var waitCallback = window.setInterval(waitForPopupClose, 80);
  function waitForPopupClose() {
    if (popupWindow && !popupWindow.closed) return;
    popupWindow = null;
    var darkCover = window.document.getElementById(
        window.popupManager.constants['darkCover']);
    if (darkCover) {
      darkCover.style.visibility = 'hidden';
    }
    if (d.i.handleLoginResponse !== null) {
      d.i.handleLoginResponse({status: 'LoginFailed'});
    }
    if (waitCallback !== null) {
      window.clearInterval(waitCallback);
      waitCallback = null;
    }
  }

  // This callback is called from the return_to page, or by `loginAndContinue`
  // in debiki-login-dialog.ls in a login popup window, see [509KEF31].
  d.i.handleLoginResponse = function(result) {
    d.i.handleLoginResponse = null;
    var errorMsg;
    if (/openid\.mode=cancel/.test(result.queryString)) {
      // This seems to happen if the user clicked No Thanks in some
      // login dialog; when I click "No thanks", Google says:
      // "openid.mode=cancel&
      //  openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0"
      errorMsg = 'You cancelled the login process? [error DwE89GwJm43]';
    } else if (result.status === 'LoginFailed') {
      console.debug('User closed popup window?');
      return;
    } else if (result.status !== 'LoginOk') {
      errorMsg = 'Unknown login problem [error DwE3kirsrts12d]';
    } else {
      // Login OK.
      // (Find queryString example at the end of this file.)
      debiki2.login.continueAfterLogin();
      return;
    }

    alert('Login failed: ' + errorMsg); // should use fancy dialog
  };

  // COULD dim the main win, open a modal dialog: "Waiting for you to log in",
  // and a Cancel button, which closes the popup window.
  // — Then the user can continue also if the popup gets lost (perhaps
  // lots of windows open).

  return windowName;
};


// {{{ The result.queryString in handleLoginResponse() is e.g. for OpenID:
// openid.ns=http://specs.openid.net/auth/2.0
// openid.mode=id_res
// openid.op_endpoint=https://www.google.com/accounts/o8/ud
// openid.response_nonce=2011-04-10T20:14:19Zwq0i...
// openid.return_to=http://10.42.43.10:8080/openid/response
// openid.assoc_handle=AOQobUdh75yi...
// openid.signed=op_endpoint,claimed_id,identity,return_to,
//    response_nonce,assoc_handle,ns.ext1,ext1.mode,ext1.type.first,
//    ext1.value.first,ext1.type.email,ext1.value.email,
//    ext1.type.country,ext1.value.country
// openid.sig=jlCF7WrP...
// openid.identity=https://www.google.com/accounts/o8/id?id=AItOaw...
// openid.claimed_id=https://www.google.com/accounts/o8/id?id=AItO...
// openid.ns.ext1=http://openid.net/srv/ax/1.0
// openid.ext1.mode=fetch_response
// openid.ext1.type.first=http://axschema.org/namePerson/first
// openid.ext1.value.first=Kaj+Magnus
// openid.ext1.type.email=http://axschema.org/contact/email
// openid.ext1.value.email=someone@example.com
// openid.ext1.type.country=http://axschema.org/contact/country/home
// openid.ext1.value.country=SE
// }}}

// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list

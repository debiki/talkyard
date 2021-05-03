/* Shows some OAuth login dialog.
 * Copyright (c) 2010-2012, 2017, 2019 Kaj Magnus Lindberg
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

(function() {

var d = { i: debiki.internal };


d.i.createLoginPopup = function(url) {
  // Based on popupManager.createPopupOpener, from popuplib.js.

  var width = 560;
  var height = 670;
  var coordinates = popupManager.getCenteredCoords(width, height);
  var windowName = 'TyLoginPopup';

  // For now. Fixes # in return-to-url.
  var url = url.replace(/#/, '__dwHash__');
  var anyProtocol = /^https?:/.test(url) ? '' : (
      eds.isInIframe ? (eds.secure ? 'https:' : 'http:') : '');

  // Window features:
  // https://developer.mozilla.org/en-US/docs/Web/API/Window/open#window_features
  // For boolean features, '1' and 'yes' and '0' and 'no' means true and false.
  var popupWindow = window.open(anyProtocol + url, windowName,
      'width='+ width +',height='+ height +
      ',status=1,location=1,resizable=1'+
      ',left='+ coordinates[0] +',top='+ coordinates[1]);

  // If !popupWindow — maybe login window blocked by a popup blocker.
  // However typically won't happen, since the open-window code runs only when
  // the human clicks a login button — and then popup blockers realize that the human
  // wants the popup window to open.
  if (!popupWindow) {
    // use logW instead  CLEAN_UP  and change this file to Typescript
    console.warn("Error opening login popup window. A malfunctioning popup blocker?");
    // Continue anyway, so waitForPopupClose() below gets to clean up any
    // login UI widgets / styles.
  }

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
      d.i.handleLoginResponse = null;
      console.debug('User closed the login popup window?');
      // (If instead the user colsed the main window, but kept this login popup
      // window open, see:  [authn_win_gone].)
      // d.i.handleLoginResponse({status: 'LoginFailed'});  [J0935RKSDM]
    }

    if (waitCallback !== null) {
      window.clearInterval(waitCallback);
      waitCallback = null;
    }
  }

  // Called from app/views/login/loginPopupCallback.scala.html html page,
  // if we're getting logged in directly via OpenAuth.
  // Or from a login popup window, in login-if-needed.ts.
  // COULD RENAME to handleLoginPopupResult?
  //
  d.i.handleLoginResponse = function(result /* : LoginPopupLoginResponse */) {
    // SECURITY SHOULD compare result.origNonceBack (if any) with  [br_authn_nonce]
    // our local storage nonce.
    // If mismatch, then, delete any session id cookie and ignore result.weakSessionId,
    // show a warning dialog?
    try {
      // Sometimes we've remembered any weakSessionId already, namely if
      // we sent a create-new-user ajax request from the login popup — then we got back
      // any weakSessionId and could remember it directly.
      // Then weakSessionId is undefined here, [5028KTDN306] and then don't
      // overwrite the main win's session id with undefined.
      if (result.weakSessionId) {
        // Remember the session in getMainWin().typs.weakSessionId:
        debiki2.Server.makeUpdNoCookiesTempSessionIdFn(function() {})(result); // [NOCOOKIES]
      }
    }
    catch (ex) {
      console.warn("Error remembering weakSessionId [TyE04KS4M]", ex);
    }

    d.i.handleLoginResponse = null;
    var errorMsg;
    if (result.status === 'LoginFailed') {  // can remove this block?  [J0935RKSDM]
      console.debug('User closed popup window?');
      return;
    } else if (result.status !== 'LoginOk') {
      errorMsg = 'Unknown login problem [error DwE3kirsrts12d]';
    } else {
      // Login OK.
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


})();
// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list

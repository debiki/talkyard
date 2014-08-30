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


// Remembers which .dw-loginsubmit-on-click button (e.g. "Post as...")
// was clicked when a login dialog is shown.
var loginOnClickBtnClicked = null;


// Any callback to call after login.
var onLoginCallback = null;


/**
 * Logs in and then calls the callback.
 */
d.i.loginIfNeeded = function(reason, anyReturnToUrl, callback) {
  if (d.i.Me.isLoggedIn()) {
    callback();
  }
  else {
    onLoginCallback = callback;
    d.i.showLoginSubmitDialog(reason, anyReturnToUrl);
  }
};


/**
 * `anyLoginReason` is optional and influences button titles in login dialogs.
 * It can one of 'LoginToComment', 'LoginToLogin' and 'LoginToSubmit'.
 */
d.i.$loginSubmitOnClick = function(loginEventHandler, anyLoginReason) {
  return function() {
    var $i = $(this);
    $i.addClass('dw-loginsubmit-on-click');
    !loginEventHandler || $i.bind('dwEvLoggedInOut', loginEventHandler);
    $i.on('click', null, { mode: anyLoginReason }, d.i.$loginThenSubmit);
  };
};


// Invoke on a .login-on-click submit <input>. After the login
// has been completed, the button will be submitted, see
// continueAnySubmission(). If already logged in, submits immediately.
d.i.$loginThenSubmit = function(event) {
  loginOnClickBtnClicked = this;
  if (!d.i.Me.isLoggedIn()) {
    // Will call continueAnySubmission(), after login.
    // {{{ Hmm, could add a `continue' callback to showLogin() instead!?
    // But initLoginSimple/OpenId runs once only, so the very first
    // anonymous function is the only one considered, so a somewhat
    // global callback-to-invoke-state is needed anyway.
    // Better move login stuff to a separate module (with a module
    // local "global" callback state).}}}
    d.i.showLoginSubmitDialog(event.data ? event.data.mode : undefined);
  } else {
    d.i.continueAnySubmission();
  }
  return false;  // skip default action; don't submit until after login
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
  else if (loginOnClickBtnClicked) {
    // If the login was initiated via a click on a
    // .dw-loginsubmit-on-click button, continue the submission
    // process that button is supposed to start.
    $(loginOnClickBtnClicked).closest('form').submit();
    loginOnClickBtnClicked = null;
  }
};


d.i.showLoginFailed = function(errorMessage) {
  initLoginResultForms();
  $('#dw-fs-lgi-failed-errmsg').text(errorMessage);
  $('#dw-fs-lgi-failed').dialog('open');
};


var initLoginResultForms = (function() {
  var continueClbk;
  return function(opt_continue) {  // COULD remove this function?...
          // ...No longer called on login OK? Is it called on failure?
    continueClbk = opt_continue;
    if ($('#dw-fs-lgi-ok.ui-dialog-content').length)
      return; // login-ok and -failed already inited

    var $loginResult = $('#dw-fs-lgi-ok, #dw-fs-lgi-failed');
    var $loginResultForm = $loginResult.find('form');
    $loginResult.find('input').hide(); // Use jQuery UI's dialog buttons instead
    $loginResult.dialog($.extend({}, d.i.jQueryDialogNoClose, {
      buttons: [{
        text: 'OK',
        id: 'dw-f-lgi-ok-ok',
        click: function() {
          $(this).dialog('close');
          !continueClbk || continueClbk();
        }
      }]
    }));
  }
})();


$(function() {
  $('.dw-a-login').click(function() {
    d.i.showLoginDialog('LoginToLogin');
  });

  $('.dw-a-logout').click(function() {
    d.u.postJson({ url: d.i.serverOrigin + '/-/logout' })
      .fail(d.i.showServerResponseDialog)
      .done(d.i.Me.fireLogout)
  });
});


// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list

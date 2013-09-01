/* Shows guest login dialog.
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


var d = { i: debiki.internal, u: debiki.v0.util };
var $ = d.i.$;


d.i.showLoginSubmitDialog = function() {
  showLoginSimple('Submit');
};


function showLoginSimple(mode) {
  initLoginSimple();
  var $dialog = $('#dw-fs-lgi-simple');

  // If the user is logging in to submit a comment, use button title
  // 'Login & Submit', otherwise 'Login' only.
  var $guestLoginBtnText = $('#dw-f-lgi-spl-submit .ui-button-text');
  var $openidDialogBtnText = $dialog.find('.dw-a-login-openid .ui-button-text');
  if (mode === 'Submit') {
    $guestLoginBtnText.text('Login and Submit');
    $openidDialogBtnText.text('Login and Submit');
  }
  else {
    $guestLoginBtnText.text('Login');
    $openidDialogBtnText.text('Login');
  }

  $dialog.dialog('open');  // BUG Tag absent unless…
          //… a debate is shown, so the dw-hidden-templates included.
  // Preload OpenID resources, in case user clicks OpenID login button.
  d.i.loadOpenIdResources();
};


function initLoginSimple() {
  var $login = $('#dw-fs-lgi-simple');
  if ($login.is('.ui-dialog-content'))
    return; // already inited

  var $loginForm = $login.find('form');
  $login.find('.dw-fi-submit').hide();  // don't show before name known
  // Use jQueryDialogReset so email is not remembered, in case
  // this is a public computer, e.g. in a public library.
  // Usually (?) the browser itself helps you fill in form fields, e.g.
  // suggests your email address?
  $login.dialog($.extend({}, d.i.jQueryDialogReset, {
    width: 452,
    buttons: [{
      text: 'Submit',
      id: 'dw-f-lgi-spl-submit',
      click: function() {
        $loginForm.submit();
      }
    }, {
      text: 'Cancel',
      id: 'dw-f-lgi-spl-cancel',
      click: function() {
        $(this).dialog('close');
      }
    }]
  }));

  $loginForm.submit(function() {
    // COULD show a "Logging in..." message — the roundtrip
    // might take a second if the user is far away?
    $.post($loginForm.attr("action"), $loginForm.serialize(), 'html')
        .done(function(data) {
          // Warning: Somewhat dupl code, see d.i.handleLoginResponse.
          // User info is now available in cookies.
          $login.dialog('close');
          d.i.Me.fireLogin();
          // Show response dialog, and continue with whatever caused
          // the login to happen.
          // {{{ If the login happens because the user submits a reply,
          // then, if the reply is submitted (from within
          // continueAnySubmission) before the dialog is closed, then,
          // when the browser moves the viewport to focus the new reply,
          // the welcome dialog might no longer be visible in the viewport.
          // But the viewport will still be dimmed, because the welcome
          // dialog is modal. So don't continueAnySubmission until
          // the user has closed the response dialog. }}}
          d.i.showServerResponseDialog(
              data, null, null, d.i.continueAnySubmission);
        })
        .fail(d.i.showServerResponseDialog)
        .always(function() {
          // COULD hide any "Logging in ..." dialog.
        });
    return false;
  });

  $login.find('.dw-a-login-openid')
      .button().click(function() {
        d.i.showLoginOpenId();
        return false;
      });
};


$(function() {
  $('#dw-a-login').click(showLoginSimple);
});


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

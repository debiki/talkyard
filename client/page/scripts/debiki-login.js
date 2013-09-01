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

(function() {

var d = { i: debiki.internal, u: debiki.v0.util };
var $ = d.i.$;


// Remembers which .dw-loginsubmit-on-click button (e.g. "Post as...")
// was clicked when a login dialog is shown.
var loginOnClickBtnClicked = null;

// True iff the user is to be asked whether or not s/he wants to be
// notified via email e.g. of replies.
var continueLoginAskAboutEmail = false;


d.i.$loginSubmitOnClick = function(loginEventHandler, data) {
  return function() {
    var $i = $(this);
    $i.addClass('dw-loginsubmit-on-click');
    !loginEventHandler || $i.bind('dwEvLoggedInOut', loginEventHandler);
    $i.on('click', null, data, d.i.$loginThenSubmit)
  };
};


// Invoke on a .login-on-click submit <input>. After the login
// has been completed, the button will be submitted, see
// continueAnySubmission(). If already logged in, submits immediately.
d.i.$loginThenSubmit = function(event) {
  loginOnClickBtnClicked = this;
  continueLoginAskAboutEmail = event.data && event.data.askAboutEmailNotfs;
  if (!d.i.Me.isLoggedIn()) {
    // Will call continueAnySubmission(), after login.
    // {{{ Hmm, could add a `continue' callback to showLogin() instead!?
    // But initLoginSimple/OpenId runs once only, so the very first
    // anonymous function is the only one considered, so a somewhat
    // global callback-to-invoke-state is needed anyway.
    // Better move login stuff to a separate module (with a module
    // local "global" callback state).}}}
    d.i.showLoginSubmitDialog();
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
  // Configure email notification prefs, unless already done.
  // (This is useful e.g. if the user submits a reply but hasn't
  // specified her email prefs. We want her to subscribe to
  // email notfs, and right now her motivation is at its peak?)
  var emailQuestion = $.Deferred().resolve();
  if (continueLoginAskAboutEmail) {
    continueLoginAskAboutEmail = false;
    if (!d.i.Me.getEmailNotfPrefs()) {
      emailQuestion = configEmailPerhapsRelogin();
    }
  }

  // If the login was initiated via a click on a
  // .dw-loginsubmit-on-click button, continue the submission
  // process that button is supposed to start.
  emailQuestion.done(function() {
    $(loginOnClickBtnClicked).closest('form').submit();
  }).always(function() {
    loginOnClickBtnClicked = null;
  });
};


var configEmailPerhapsRelogin = (function() {
  var dialogStatus;

  return function() {
    dialogStatus = $.Deferred();

    var $form = $('#dw-f-eml-prf');
    var $emailAddrDiv = $form.find('.dw-f-eml-prf-adr');
    var $dontRecvBtn = $form.find('#dw-fi-eml-prf-rcv-no');
    var $yesRecvBtn = $form.find('#dw-fi-eml-prf-rcv-yes');

    // Init dialog, do once only.
    if (!$form.parent().is('.ui-dialog')) {
      $form.dialog($.extend({}, d.i.jQueryDialogReset));
      $('#dw-f-eml-prf').find('input[type="radio"], input[type="submit"]')
          .button();

      // Always submit form on No click.
      // (However, on Yes click, we submit the form directly only
      // if email known — otherwise we show an email input field.)
      $dontRecvBtn.click(submitForm);

      $form.submit(function() {
        $yesRecvBtn.button('enable'); // or value not posted

        // When you change your email address, this triggers a re-login,
        // if you use an unauthenticated identity — because the email is
        // part of that identity. We need to know if a login happens.
        var loginIdBefore = d.i.Me.getLoginId();

        $.post($form.attr('action'), $form.serialize(), 'html')
            .done(function(responseHtml) {

              // Fire login event, to update xsrf tokens, if the server
              // created a new login session (because we changed email addr).
              d.i.Me.fireLoginIfNewSession(loginIdBefore);

              // Delay dialogStatus.resolve() so any new XSRF token has been
              // applied before, via jQuery ajaxSetup.complete.
              // Temporary (?) fix of [bug#9kie35].
              setTimeout(function() {
                dialogStatus.resolve();
              }, 1);

              $form.dialog('close');
              // (Ignore responseHtml; it's empty, or a Welcome message.)
            })
            .fail(function(jqXhrOrHtml, errorType, httpStatusText) {
              d.i.showServerResponseDialog(
                  jqXhrOrHtml, errorType, httpStatusText);
              dialogStatus.reject();
            })
        return false;
      });
    }

    // Now, hide email input, if email addr already specified,
    // and submit directly on Yes/No click.

    function submitForm() {
      $form.submit();
      return false;
    };

    function showEmailAddrInp() {
      $emailAddrDiv.show();
      $yesRecvBtn.button('disable');
    };

    $emailAddrDiv.hide();
    $yesRecvBtn.button('enable');

    $yesRecvBtn.off('click');
    if (d.i.Me.isEmailKnown()) {
      // Submit directly; need not ask for email addr.
      $yesRecvBtn.click(submitForm);
    } else {
      // Ask for email addr; submit via Done button.
      $yesRecvBtn.click(showEmailAddrInp);
    }

    $form.dialog('open');
    return dialogStatus;
  };
})();


d.i.showLoginOkay = function(opt_continue) {
  initLoginResultForms(opt_continue);
  $('#dw-fs-lgi-ok-name').text(d.i.Me.getName());
  $('#dw-fs-lgi-ok').dialog('open');
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


})();

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

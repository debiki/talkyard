/* Copyright (c) 2010 - 2012 Kaj Magnus Lindberg. All rights reserved. */

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
    d.i.showLoginSimple();
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
      $form.dialog($.extend({}, d.i.jQueryDialogDefault, {
        close: function() {
          dialogStatus.reject();
          // Better not remember email addr. Perhaps this is a public
          // computer, e.g. in a public library.
          d.i.jQueryDialogReset.close.apply(this);
        }
      }));
      $('#dw-f-eml-prf').find('input[type="radio"], input[type="submit"]')
          .button();

      $dontRecvBtn.click(submitForm); // always
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

              dialogStatus.resolve();
              $form.dialog('close');
              // (Ignore responseHtml; it's empty, or a Welcome message.)
            })
            .fail(d.i.showServerResponseDialog);
        return false;
      });
    }

    // Hide email input, if email addr already specified,
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
    if (d.i.Me.isEmailKnown()) {
      // Submit directly; need not ask for email addr.
      $yesRecvBtn.click(submitForm);
      $yesRecvBtn.off('click', showEmailAddrInp);
    } else {
      // Ask for email addr; submit via Done button.
      $yesRecvBtn.click(showEmailAddrInp);
      $yesRecvBtn.off('click', submitForm);
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
      buttons: {
        'OK': function() {
          $(this).dialog('close');
          !continueClbk || continueClbk();
        }
      }
    }));
  }
})();


})();

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

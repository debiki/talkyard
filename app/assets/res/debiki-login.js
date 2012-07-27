/* Copyright (c) 2010 - 2012 Kaj Magnus Lindberg. All rights reserved. */


(function() {

var d = { i: debiki.internal, u: debiki.v0.util };
var $ = d.i.$;


function $loginSubmitOnClick(loginEventHandler, data) {
  return _$loginSubmitOn('click', loginEventHandler, data);
}


function _$loginSubmitOn(eventType, loginEventHandler, data) {
  return function() {
    var $i = $(this);
    $i.addClass('dw-loginsubmit-on-'+ eventType);
    !loginEventHandler || $i.bind('dwEvLoggedInOut', loginEventHandler);
    $i.on(eventType, null, data, $loginThenSubmit)
  };
}


// Invoke on a .login-on-click submit <input>. After the login
// has been completed, the button will be submitted, see
// continueAnySubmission(). If already logged in, submits immediately.
function $loginThenSubmit(event) {
  loginOnClickBtnClicked = this;
  continueLoginAskAboutEmail = event.data && event.data.askAboutEmailNotfs;
  if (!Me.isLoggedIn()) {
    // Will call continueAnySubmission(), after login.
    // {{{ Hmm, could add a `continue' callback to showLogin() instead!?
    // But initLoginSimple/OpenId runs once only, so the very first
    // anonymous function is the only one considered, so a somewhat
    // global callback-to-invoke-state is needed anyway.
    // Better move login stuff to a separate module (with a module
    // local "global" callback state).}}}
    showLoginSimple();
  } else {
    continueAnySubmission();
  }
  return false;  // skip default action; don't submit until after login
}


/**
 * Continues any form submission that was interrupted by the
 * user having to log in.
 */
function continueAnySubmission() {
  // Configure email notification prefs, unless already done.
  // (This is useful e.g. if the user submits a reply but hasn't
  // specified her email prefs. We want her to subscribe to
  // email notfs, and right now her motivation is at its peak?)
  var emailQuestion = $.Deferred().resolve();
  if (continueLoginAskAboutEmail) {
    continueLoginAskAboutEmail = false;
    if (!Me.getEmailNotfPrefs()) {
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
}


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
        var loginIdBefore = Me.getLoginId();

        $.post($form.attr('action'), $form.serialize(), 'html')
            .done(function(responseHtml) {
              // Fire login event, to update xsrf tokens, if the server
              // created a new login session (because we changed email addr).
              Me.fireLoginIfNewSession(loginIdBefore);

              dialogStatus.resolve();
              $form.dialog('close');
              // (Ignore responseHtml; it's empty, or a Welcome message.)
            })
            .fail(showServerResponseDialog);
        return false;
      });
    }

    // Hide email input, if email addr already specified,
    // and submit directly on Yes/No click.
    function submitForm() {
      $form.submit();
      return false;
    }
    function showEmailAddrInp() {
      $emailAddrDiv.show();
      $yesRecvBtn.button('disable');
    }
    $emailAddrDiv.hide();
    $yesRecvBtn.button('enable');
    if (Me.isEmailKnown()) {
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
  }
})();


function showLoginOkay(opt_continue) {
  initLoginResultForms(opt_continue);
  $('#dw-fs-lgi-ok-name').text(Me.getName());
  $('#dw-fs-lgi-ok').dialog('open');
}


function showLoginFailed(errorMessage) {
  initLoginResultForms();
  $('#dw-fs-lgi-failed-errmsg').text(errorMessage);
  $('#dw-fs-lgi-failed').dialog('open');
}


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


// Updates cookies and elements to show the user name, email etc.
// as appropriate. Unless !propsUnsafe, throws if name or email missing.
// Fires the dwEvLoggedInOut event on all .dw-loginsubmit-on-click elems.
// Parameters:
//  props: {name, email, website}, will be sanitized unless
//  sanitize: unless `false', {name, email, website} will be sanitized.
function fireLogout() {
  Me.refreshProps();
  $('#dw-u-info').hide();
  $('#dw-a-logout').hide();
  $('#dw-a-login').show();

  // Clear all xsrf tokens. They are invalid now after logout, because
  // the server instructed the browser to delete the session id cookie.
  $('input.dw-fi-xsrf').attr('value', '');

  // Let `Post as <username>' etc buttons update themselves:
  // they'll replace <username> with `...'.
  $('.dw-loginsubmit-on-click, .dw-loginsubmit-on-mouseenter')
      .trigger('dwEvLoggedInOut', [undefined]);

  Me.clearMyPageInfo();
}


function fireLogin() {
  Me.refreshProps();
  $('#dw-u-info').show()
      .find('.dw-u-name').text(Me.getName());
  $('#dw-a-logout').show();
  $('#dw-a-login').hide();

  // Update all xsrf tokens in any already open forms (perhaps with
  // draft texts, we shuldn't close them). Their xsrf prevention tokens
  // need to be updated to match the new session id cookie issued by
  // the server on login.
  var token = $.cookie('dwCoXsrf');
  //$.cookie('dwCoXsrf', null, { path: '/' }); // don't send back to server
  // ^ For now, don't clear the dwCoXsrf cookie, because then if the user
  // navigates back to the last page, after having logged out and in,
  // the xsrf-inputs would need to be refreshed from the cookie, because
  // any token sent from the server is now obsolete (after logout/in).
  $('input.dw-fi-xsrf').attr('value', token);

  // Let Post as ... and Save as ... buttons update themselves:
  // they'll replace '...' with the user name.
  $('.dw-loginsubmit-on-click, .dw-loginsubmit-on-mouseenter')
      .trigger('dwEvLoggedInOut', [Me.getName()]);

  Me.clearMyPageInfo();
  Me.loadAndMarkMyPageInfo();
}


})();

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

/* Copyright (c) 2010 - 2012 Kaj Magnus Lindberg. All rights reserved. */


(function() {

var d = { i: debiki.internal, u: debiki.v0.util };
var $ = d.i.$;


d.i.showLoginSimple = function() {
  initLoginSimple();
  $('#dw-fs-lgi-simple').dialog('open');  // BUG Tag absent unless…
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
    buttons: {
      Submit: function() {
        $loginForm.submit();
      },
      Cancel: function() {
        $(this).dialog('close');
      }
    }
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


$('#dw-a-login').click(d.i.showLoginSimple);

})();

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

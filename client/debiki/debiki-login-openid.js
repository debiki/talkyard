/* Copyright (c) 2010 - 2012 Kaj Magnus Lindberg. All rights reserved. */


(function() {

var d = { i: debiki.internal, u: debiki.v0.util };
var $ = d.i.$;


d.i.showLoginOpenId = function() {
  d.i.loadOpenIdResources().done(function() {
    initLoginOpenId();
    $('#dw-fs-openid-login').dialog('open');
  });
};


d.i.loadOpenIdResources = (function() {
  var loadStatus;
  return function() {
    if (loadStatus)
      return loadStatus;
    loadStatus = $.Deferred();
    // (COULD load these files directly in the <head>, on desktops,
    // and load a single .min.js.gz on mobiles. And load one at a time
    // in Dev builds. But that'd be 3 different cases! Postpone...)
    Modernizr.load({
      load: [
        '/-/res/openid-selector/css/openid.css',
        '/-/res/openid-selector/js/openid-jquery.js',
        '/-/res/openid-selector/js/openid-en.js'],
        // /-/res/popuplib.js is included in combined-debiki-*.js.
      complete: function() {
        loadStatus.resolve();
      }
    });
    return loadStatus;
  }
})();


function initLoginOpenId() {
  var $openid = $('#dw-fs-openid-login');
  if ($openid.is('.ui-dialog-content'))
    return; // already inited

  openid.img_path = '/-/res/openid-selector/images/';
  openid.submitInPopup = submitLoginInPopup;
  // Keep default openid.cookie_expires, 1000 days
  // — COULD remove cookie on logout?
  openid.init('openid_identifier');

  // Use jQueryDialogReset, so OpenID cleared on close,
  // in case this is a public computer?
  $openid.dialog($.extend({}, d.i.jQueryDialogReset, {
    width: 670,
    height: 410, // (incl. extra space for 'Enter your OpenID' input field)
    // Place above guest login dialog.
    zIndex: d.i.jQueryDialogDefault.zIndex + 10,
    buttons: {
      Cancel: function() {
        $(this).dialog('close');
      }
    }
  }));
};


// Submits an OpenID login <form> in a popup. Dims the window and
// listens for the popup to close.
function submitLoginInPopup($openidLoginForm) {
  // Based on popupManager.createPopupOpener, from popuplib.js.

  var width = 450;
  var height = 500;
  var coordinates = popupManager.getCenteredCoords(width, height);

  // Here is described how to configure the popup window:
  // http://svn.openid.net/repos/specifications/user_interface/1.0/trunk
  //    /openid-user-interface-extension-1_0.html
  var popupWindow = window.open('', 'LoginPopup',
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

  // This callback is called from the return_to page:
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
      // User closed popup window?
      errorMsg = 'You closed the login window? [error DwE5k33rs83k0]';
    } else if (result.status !== 'LoginOk') {
      errorMsg = 'Unknown login problem [error DwE3kirsrts12d]';
    } else {
      // Login OK.
      // (Find queryString example at the end of this file.)

      // Warning: Somewhat dupl code, compare w initLoginSimple.
      $('#dw-fs-openid-login').dialog('close');
      $('#dw-fs-lgi-simple').dialog('close');
      d.i.Me.fireLogin();
      d.i.showLoginOkay(d.i.continueAnySubmission);
      return;
    }

    d.i.showLoginFailed(errorMsg);
  }

  // COULD dim the main win, open a modal dialog: "Waiting for you to log in",
  // and a Cancel button, which closes the popup window.
  // — Then the user can continue also if the popup gets lost (perhaps
  // lots of windows open).

  // Make the default submit action submit the login form in the popup window.
  $openidLoginForm.attr('target', 'LoginPopup');
};


})();


// {{{ The result.queryString in handleLoginResponse() is e.g. …
// openid.ns=http://specs.openid.net/auth/2.0
// openid.mode=id_res
// openid.op_endpoint=https://www.google.com/accounts/o8/ud
// openid.response_nonce=2011-04-10T20:14:19Zwq0i9rEOAN0QsA
// openid.return_to=http://10.42.43.10:8080/openid/response
// openid.assoc_handle=AOQobUdh75yilxlGb-KbwvcLIocAG...
// openid.signed=op_endpoint,claimed_id,identity,return_to,
//    response_nonce,assoc_handle,ns.ext1,ext1.mode,ext1.type.first,
//    ext1.value.first,ext1.type.email,ext1.value.email,
//    ext1.type.country,ext1.value.country
// openid.sig=jlCF7WrP99%2Be1Ee8eq1s03JUE0h4wILx37FHZkv/KlA=
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

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

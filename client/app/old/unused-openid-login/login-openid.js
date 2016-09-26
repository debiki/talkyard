/* Shows OpenID login dialog.
 * Copyright (C) 2010-2012 Kaj Magnus Lindberg (born 1979)
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

/*
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
    yepnope({
      load: [
        d.i.assetsUrlPathStart + 'openid-selector/css/openid.css',
        d.i.assetsUrlPathStart + 'openid-selector/js/openid-jquery.js',
        d.i.assetsUrlPathStart + 'openid-selector/js/openid-en.js'],
        // d.i.assetsUrlPathStart + 'popuplib.js' are included in slim-bundle.js.
      complete: function() {
        loadStatus.resolve();
      }
    });
    return loadStatus;
  }
})();


function initLoginOpenId() {
  var $openid = d.i.newOpenidLoginDialog();
  $('body').append($openid); // so the Javascript OpenID selector finds certain elems

  openid.img_path = d.i.assetsUrlPathStart + 'openid-selector/images/';
  openid.submitInPopup = d.i.createOpenIdLoginPopup;
  openid.signin_text =
      '<span class="dw-login-to-submit">Login and submit</span>' +
      '<span class="dw-login-to-post-comment">Login and post comment</span>' +
      '<span class="dw-login-to-create-topic">Login and create topic</span>' +
      '<span class="dw-login-to-login">Login</span>';

  $openid.dialog(d.i.newModalDialogSettings({
    width: 540, // avoids float drop; there are some large buttons
    height: 410, // (incl. extra space for 'Enter your OpenID' input field)
    // Place above guest login dialog.
    zIndex: d.i.jQueryDialogDefault.zIndex + 10,
    buttons: {
      Cancel: function() {
        $(this).dialog('close');
      }
    }
  }));

  // Call `init` *after* $().dialog(), otherwise the dialog will be displayed at the end
  // of the document.body, sometimes causing the viewport to move to the very bottom.
  // (Keep default openid.cookie_expires, 1000 days — COULD remove cookie on logout?)
  openid.init('openid_identifier');
};


/**
 * Submits an OpenID login <form> in a popup.
 *
d.i.createOpenIdLoginPopup = function($openidLoginForm) {
  var windowName = d.i.createLoginPopup();
  // Make the default submit action submit the login form in the popup window.
  $openidLoginForm.attr('target', windowName);
};



// {{{ The result.queryString in handleLoginResponse() is e.g. …
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
*/

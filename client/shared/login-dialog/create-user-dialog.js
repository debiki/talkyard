/* Shows a create user dialog, then continues the login process.
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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

var AjaxFriendlyRedirectStatusCode = 278;


d.i.showCreateUserDialog = function(userData) {
  //if d.i.isInIframe
  //  d.i.createLoginPopup("#{d.i.serverOrigin}/-/login-popup?mode=#mode")
  //  return

  var dialog = createUserDialogHtml();
  dialog.dialog(d.i.newModalDialogSettings({
    width: 413,
    closeOnEscape: !d.i.isInLoginPopup
  }));

  dialog.find('#new-user-name').val(userData.name);

  if (userData.email.length) {
    dialog.find('#new-user-email').val(userData.email);
    // Email already provided by OpenAuth or OpenID provider, don't let the user change it.
    dialog.find('#new-user-email').attr('disabled', 'disabled');
  }

  dialog.find('.submit').click(function() {
    var data = {
      name: dialog.find('#new-user-name').val(),
      email: dialog.find('#new-user-email').val(),
      username: dialog.find('#new-user-username').val(),
      authDataCacheKey: userData.authDataCacheKey
    };
    d.u.postJson({ url: d.i.serverOrigin + '/-/login-create-user', data: data })
      .fail(d.i.showServerResponseDialog)
      .done(function(data, textStatus, result) {
        // Session cookies should now have been set.
        if (result.status === AjaxFriendlyRedirectStatusCode) {
          // This is our custom Redirect status code that doesn't result in the
          // ajax request itself being redirected (like status 302 and 303 do).
          // (We want to redirect here, if we've signed up in order to create a
          // new site — then the next page should be the next step in the site
          // creation wizard.)
          var continueToUrl = result.getResponseHeader('Location');
          window.location = continueToUrl;
          return;
        }
        // If this is an embedded comments site, we're currently executing in
        // a create user login popup window, not in the <iframe> on the embedding
        // page. If so, only window.opener has loaded the code that we're
        // about to execute.
        var di;
        if (d.i.isInLoginPopup) {
          // We're in a login popup window for an embedded comments site.
          di = window.opener.debiki.internal;
        }
        else {
          // This is not an embedded comments site, we're not in a popup; we can
          // execute the subsequent code directly here in the main window.
          di = debiki.internal;
        }
        di.Me.fireLogin();
        di.continueAnySubmission();
        dialog.dialog('close');
      });
  });

  dialog.find('.cancel').click(function() {
    dialog.dialog('close');
    d.i.showLoginDialog();
  });

  dialog.dialog('open');
};



function createUserDialogHtml() {
  return $(
    '<div class="dw-fs" title="Create New Account">' +
    '<div class="form-group">' +
    '  <label for="new-user-name">Your name: (the long version)</label>' +
    '  <input type="text" class="form-control" id="new-user-name" placeholder="Enter your name">' +
    '</div>' +
    '<div class="form-group">' +
    '  <label for="new-user-email">Email: (will be kept private)</label>' +
    '  <input type="email" class="form-control" id="new-user-email" placeholder="Enter email">' +
    '</div>' +
    '<div class="form-group">' +
    '  <label for="new-user-username">Username:</label>' +
    '  <input type="text" class="form-control" id="new-user-username" placeholder="Enter username">' +
    '  <p>Your <code>@username</code> must be unique, short, no spaces.</p>' +
    '</div>' +
    '<div>' +
    '  <a class="submit btn btn-default">Create user</a>' +
    '  <a class="cancel btn btn-default">Cancel</a>' +
    '</div>' +
    '</div>');
}


// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list

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


d.i.makeReturnToPostUrlForVerifEmail = function(postId) {
  // The magic string tells the server to use the return-to-URL only if it
  // needs to send an email address verification email (it'd include the return
  // to URL on a welcome page show via a link in the email).
  return '_RedirFromVerifEmailOnly_' +
    window.location.toString().replace(/#.*/, '') +
    '#post-' + postId;
};


/**
 * Prefix `RedirFromVerifEmailOnly` to the return-to-url, to indicate that
 * the redirect should happen only if an email address verification email is sent,
 * and via a link in that email.
 */
d.i.showCreateUserDialog = function(userData, anyReturnToUrl) {
  var dialog = createUserDialogHtml();
  dialog.dialog(d.i.newModalDialogSettings({
    width: 380,
    closeOnEscape: !d.i.isInLoginPopup
  }));

  dialog.find('#new-user-name').val(userData.name);

  if (userData.createPasswordUser) {
    dialog.find('.form-group.password').show();
  }

  if (userData.email && userData.email.length) {
    dialog.find('#new-user-email').val(userData.email);
    // Email already provided by OpenAuth or OpenID provider, don't let the user change it.
    dialog.find('#new-user-email').attr('disabled', 'disabled');
  }

  dialog.find('.submit').click(function() {
    var data = {
      name: dialog.find('#new-user-name').val(),
      email: dialog.find('#new-user-email').val(),
      username: dialog.find('#new-user-username').val(),
      password: dialog.find('#new-user-password').val(),
      returnToUrl: anyReturnToUrl,
      authDataCacheKey: userData.authDataCacheKey
    };

    var url = d.i.serverOrigin;
    if (userData.authDataCacheKey) {
      // Any return-to-URL is remembered in a cookie.
      url += '/-/login-oauth-create-user';
    }
    else if (userData.createPasswordUser) {
      url += '/-/login-password-create-user';
    }
    else {
      throw 'Bad new user data: ' + JSON.stringify(userData) + ' [DwE5DF06]';
    }

    d.u.postJson({ url: url, data: data })
      .fail(d.i.showServerResponseDialog)
      .done(function(data, textStatus, result) {
        closeLoginDialogs();
        if (!data.emailVerifiedAndLoggedIn) {
          showAddressVerificationEmailSentDialog();
        }
        else if (anyReturnToUrl) {
          window.location = anyRedirectUrl;
        }
        else {
          continueOnSamePage();
        }
      });
  });

  dialog.find('.cancel').click(function() {
    closeLoginDialogs();
    d.i.showLoginDialog(); // show main login dialog again
  });

  function closeLoginDialogs() {
    dialog.dialog('close');
    $('#dw-lgi').dialog('close');
  }

  dialog.dialog('open');
};


function continueOnSamePage() {
  // If this is an embedded comments site, we're currently executing in
  // a create user login popup window, not in the <iframe> on the embedding
  // page. If so, only window.opener has loaded the code that we're
  // about to execute.
  var debikiInternal;
  if (window.opener && window.opener.debiki) {
    // We're in a login popup window for an embedded comments site.
    debikiInternal = window.opener.debiki.internal;
  }
  else {
    // This is not an embedded comments site, we're not in a popup window;
    // we can execute the subsequent code directly here in the main window.
    debikiInternal = debiki.internal;
  }
  // We should be on some kind of a discussion page.
  debikiInternal.Me.fireLogin();
  // This continues e.g. submitting any reply the user intended to post before
  // s/he was asked to login and create a user.
  debikiInternal.continueAnySubmission();
}


function showAddressVerificationEmailSentDialog() {
  var dialog = createConfirmYourEmailAddressDialogHtml();
  dialog.dialog(d.i.newModalDialogSettings({
    width: 350,
    closeOnEscape: false
  }));
  dialog.find('button.continue').click(function() {
    dialog.dialog('close');
  });
  dialog.dialog('open');
}


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
    '<div class="form-group password">' +
    '  <label for="new-user-password">Password:</label>' +
    '  <input type="password" class="form-control" id="new-user-password" placeholder="Enter password">' +
    '</div>' +
    '<div>' +
    '  <a class="submit btn btn-default">Create user</a>' +
    '  <a class="cancel btn btn-default">Cancel</a>' +
    '</div>' +
    '</div>');
}


function createConfirmYourEmailAddressDialogHtml(anyNewPostId) {
  return $(
    '<div class="dw-fs" title="Confirm Your Email Address">' +
    '  <p>Almost done! We have sent an activation email to you. Please click the' +
    '  link in the email to activate your account. You can close this page.</p>' +
    '<div>' +
    '  <button class="continue btn btn-default">Okay</button>' +
    '</div>' +
    '</div>');
}


// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list

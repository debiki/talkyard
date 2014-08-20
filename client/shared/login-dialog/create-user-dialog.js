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

  var emailVerified = false;

  if (userData.email && userData.email.length) {
    emailVerified = true;
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
        var anyContinueDoneCallback = null;
        redirectOrContinueOnSamePage(anyReturnToUrl, emailVerified);
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


function redirectOrContinueOnSamePage(anyRedirectUrl, emailVerified) {
  // Session cookies should already have been set by the server.

  if (anyRedirectUrl && emailVerified) {
    window.location = anyRedirectUrl;
    return;
  }

  // Send an email address confirmation email, or continue logging in
  // on the same page.

  // If this is an embedded comments site, we're currently executing in
  // a create user login popup window, not in the <iframe> on the embedding
  // page. If so, only window.opener has loaded the code that we're
  // about to execute.
  var di;
  if (window.opener && window.opener.debiki) {
    // We're in a login popup window for an embedded comments site.
    di = window.opener.debiki.internal;
  }
  else {
    // This is not an embedded comments site, we're not in a popup window;
    // we can execute the subsequent code directly here in the main window.
    di = debiki.internal;
  }

  if (di.Me) {
    // We're on some kind of a discussion page.
    di.Me.fireLogin();
    // This continues e.g. submitting any reply the user intended to post before
    // s/he was asked to login and create a user.
    di.continueAnySubmission(sendEmailAddressConfirmationEmail);
  }
  else {
    // We're in a create-new-site wizard.
    if (!emailVerified) {
      // A continue-to-anyRedirectUrl link will be included in the email.
      sendEmailAddressConfirmationEmail(null);
    }
    else if (anyRedirectUrl) {
      // We can redirect directly, need not send any email.
      window.location = anyRedirectUrl;
    }
    else {
      console.error('Nothing to do [DwE9FK2215]');
    }
  }

  function sendEmailAddressConfirmationEmail(continueDoneData) {
    var postData = {};
    if (anyRedirectUrl) {
      postData.returnToUrl = anyRedirectUrl;
    }
    else if (continueDoneData.threadsByPageId) {
      // It seems we've submitted a new post. Tell the server to link to it from the page
      // the user ends up on after having confirmed his/her email address.
      try {
        if (window.opener && window.opener.debiki) {
          // This is an embedded comments site, and we're in a login popup window.
          // Link to the *embedding* page.
          postData.returnToUrl = window.opener.debiki.internal.iframeBaseUrl;
          postData.viewPostId =
            continueDoneData.threadsByPageId[window.opener.debiki.internal.pageId][0].id;
        }
        else {
          postData.returnToUrl = '/-' + d.i.pageId;
          postData.viewPostId = continueDoneData.threadsByPageId[d.i.pageId][0].id;
        }
      }
      catch (error) {
        console.warn('Unsupported continueDoneData: ' + JSON.stringify(continueDoneData) +
            '\n\nError: ' + JSON.stringify(error));
      }
    }

    d.u.postJson({ url: '/-/login-password-send-address-confirmation-email', data: postData })
      .fail(d.i.showServerResponseDialog)
      .done(function(data, textStatus, result) {
        // Now any new comment has been saved and an email address confirmation email
        // has been sent. (The comment won't be shown until email confirmed though.)
        var dialog = createConfirmYourEmailAddressDialogHtml(postData.viewPostId);
        dialog.dialog(d.i.newModalDialogSettings({
          width: 350,
          closeOnEscape: false
        }));
        dialog.find('button.continue').click(function() {
          dialog.dialog('close');
        });
        dialog.dialog('open');
      });
  }
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
  var newPostMessage = anyNewPostId ? ', and have your new post appear' : '';
  return $(
    '<div class="dw-fs" title="Confirm Your Email Address">' +
    '  <p>Almost done! We have sent an activation email to you. Please click the' +
    '  link in the email to activate your account' + newPostMessage + '.' +
    '  You can close this page.</p>' +
    '<div>' +
    '  <button class="continue btn btn-default">Okay</button>' +
    '</div>' +
    '</div>');
}


// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list

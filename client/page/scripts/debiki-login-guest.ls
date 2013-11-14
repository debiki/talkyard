/* Shows a logout dialog.
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


d = i: debiki.internal, u: debiki.v0.util
$ = d.i.$;



d.i.showLoginSubmitDialog = !->
  showLoginSimple 'Submit'



!function showLoginSimple(mode)

  dialog = loginGuestDialogHtml()
  dialog.dialog d.i.newModalDialogSettings({ width: 430 })
  dialog.find('#dw-lgi-accordion').collapse()
  passwordLoginForm = dialog.find('#dw-lgi-pswd')

  tweakButtonTitles dialog, mode

  dialog.find('.dw-a-login-openid').click ->
    d.i.showLoginOpenId()
    false

  dialog.find('.dw-fi-cancel').click ->
    dialog.dialog 'close'
    false

  dialog.find('#dw-f-lgi-spl-submit').click ->
    data =
      name: dialog.find('#dw-fi-lgi-name').val!
      email: dialog.find('#dw-fi-lgi-email').val!
      url: dialog.find('#dw-fi-lgi-url').val!
    d.u.postJson { url: '/-/login-guest', data }
      .fail d.i.showServerResponseDialog
      .done loginAndContinue
      .always !-> dialog.dialog 'close'
    false

  passwordLoginForm.find('#dw-lgi-pswd-submit').click ->
    data =
      email: passwordLoginForm.find('input[name=email]').val!
      password: passwordLoginForm.find('input[name=password]').val!
    d.u.postJson { url: '/-/login-password', data }
      .fail d.i.showServerResponseDialog
      .done loginAndContinue
      .always !-> dialog.dialog 'close'
    false

  !function loginAndContinue(data)
    d.i.Me.fireLogin()
    # Show response dialog, and continue with whatever caused
    # the login to happen.
    # {{{ If the login happens because the user submits a reply,
    # then, if the reply is submitted (from within
    # continueAnySubmission) before the dialog is closed, then,
    # when the browser moves the viewport to focus the new reply,
    # the welcome dialog might no longer be visible in the viewport.
    # But the viewport will still be dimmed, because the welcome
    # dialog is modal. So don't continueAnySubmission until
    # the user has closed the response dialog. }}}
    showLoggedInDialog(d.i.continueAnySubmission)

  # Preload OpenID resources, in case user clicks OpenID login button.
  d.i.loadOpenIdResources()

  dialog.dialog 'open'



!function tweakButtonTitles(dialog, mode)
  # If the user is logging in to submit a comment, use button title
  # 'Login & Submit', otherwise 'Login' only.
  guestLoginBtn = $('#dw-f-lgi-spl-submit')
  openidDialogLink = dialog.find('.dw-a-login-openid')
  if mode == 'Submit'
    guestLoginBtn.val 'Login and Submit'
    openidDialogLink.text 'Login and Submit'
  else
    guestLoginBtn.val 'Login'
    openidDialogLink.text 'Login'



!function showLoggedInDialog(opt_continue)
  html = $('''
      <p>You have been logged in, welcome <span id="dw-lgi-name"></span></p>
    ''')
  html.find('#dw-lgi-name').text(d.i.Me.getName!)
  html.dialog $.extend({}, d.i.jQueryDialogNoClose,
      title: 'Welcome'
      autoOpen: true
      buttons: [
        text: 'OK'
        id: 'dw-dlg-rsp-ok'
        click: !->
          # Remove the dialog, so the OK button id can be reused
          # — then it's easier to write automatic tests.
          $(this).dialog('destroy').remove()
          if opt_continue
            opt_continue()
      ])



/**
 * (Old obsolete comment from year 2011: (Android bug gone now?)
 * """Don't initially focus a text input -- that'd cause Android to auto
 * zoom that input, which triggers certain Android bugs and my workarounds,
 * but the workarounds results in the dialog title appearing off screen,
 * so better not trigger the-bug-and-the-workarounds on dialog open.
 * See debiki.js: resetMobileZoom() and jQueryDialogDefault.open.""")
 */
# I have no idea why, but if I wrap the below "forms" in an actual <form>, then
# everything in the <form> becomes frozen, cannot be interacted with, for example
# you cannot type into the inputs. So don't use any <form> tags. We're posting
# JSON anyway, not form-data.
function loginGuestDialogHtml
  $('''
    <div class="dw-fs" title="Who are you?" id="dw-lgi">
    <div class="panel-group" id="dw-lgi-accordion">

    <div class="panel panel-default">
      <div class="panel-heading">
        <h4 class="panel-title">
          <a data-toggle="collapse" data-parent="#dw-lgi-accordion" href="#dw-lgi-guest">
            Login as Guest
          </a>
        </h4>
      </div>
      <div id="dw-lgi-guest" class="panel-collapse collapse">
        <div class="panel-body">

          <div class="form-group">
            <label for="dw-fi-lgi-name">Enter your name:</label><br>
            <input id="dw-fi-lgi-name" type="text" size="30" maxlength="100" name="dw-fi-lgi-name" value="Anonymous" tabindex="102">
          </div>
          <div class="form-group">
            <label for="dw-fi-lgi-email">Email: (optional, not shown)</label><br>
            <input id="dw-fi-lgi-email" type="text" size="30" maxlength="100" name="dw-fi-lgi-email" value="" tabindex="103">
          </div>
          <div class="form-group">
            <label for="dw-fi-lgi-url" id="dw-fi-lgi-url-lbl">Website: (optional)</label><br>
            <input id="dw-fi-lgi-url" type="text" size="30" maxlength="200" name="dw-fi-lgi-url" value="" tabindex="104">
          </div>
          <br>
          <div>
            <input id="dw-f-lgi-spl-submit" class="btn btn-default" type="submit" value="Login" tabindex="105">
          </div>

        </div>
      </div>
    </div>

    <div class="panel panel-default">
      <div class="panel-heading">
        <h4 class="panel-title">
          <a data-toggle="collapse" data-parent="#dw-lgi-accordion" href="#dw-lgi-pswd">
            Login with Email and Password
          </a>
        </h4>
      </div>
      <div id="dw-lgi-pswd" class="panel-collapse collapse">
        <div class="panel-body">

          <div class="form-group">
            <label for="dw-lgi-pswd-email">Email:</label><br>
            <input type="text" id="dw-lgi-pswd-email" name="email" value="" class="input-xlarge">
          </div>

          <div class="form-group">
            <label for="dw-lgi-pswd-password">Password:</label><br>
            <input type="password" id="dw-lgi-pswd-password" name="password" class="input-xlarge">
          </div>

          <br>
          <button type="submit" id="dw-lgi-pswd-submit" class="btn btn-default">Login</button>

          <br>
          <a href="/-/reset-password" target="_blank">Did you forget your password?</a>

        </div>
      </div>
    </div>

    <p id="dw-lgi-or-login-using">Or login using your account (if any) at:</p>
    <h4 id="dw-lgi-other-sites">
      <a>Google</a> <a>Facebook</a> <a>Yahoo!</a>
    </h4>

    <div class="panel panel-default">
      <div class="panel-heading">
        <h4 class="panel-title">
          <a data-toggle="collapse" data-parent="#dw-lgi-accordion" href="#dw-lgi-more">
            More options...
          </a>
        </h4>
      </div>
      <div id="dw-lgi-more" class="panel-collapse collapse">
        <div class="panel-body">
          (OpenID stuf ...)
        </div>
      </div>
    </div>

    </div>

    <input class="btn btn-default dw-fi-cancel" type="button" value="Cancel" tabindex="106">
    </div>
    ''')



$(!->
  $('#dw-a-login').click showLoginSimple)



# vim: fdm=marker et ts=2 sw=2 fo=tcqwn list

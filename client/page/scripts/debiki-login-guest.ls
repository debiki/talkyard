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
  showLoginDialog 'Submit'



!function showLoginDialog(mode)

  dialog = loginDialogHtml()
  dialog.dialog d.i.newModalDialogSettings({ width: 413 })
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


  dialog.find('a#dw-lgi-google').click ->
    openid.signin('google')
    false

  /*
  passwordLoginForm.find('#dw-lgi-pswd-submit').click ->
    data =
      email: passwordLoginForm.find('input[name=email]').val!
      password: passwordLoginForm.find('input[name=password]').val!
    d.u.postJson { url: '/-/login-password', data }
      .fail d.i.showServerResponseDialog
      .done loginAndContinue
      .always !-> dialog.dialog 'close'
    false
    */

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



function loginDialogHtml
  $('''
    <div class="dw-fs" title="Who are you?" id="dw-lgi">
      <a id="dw-lgi-guest" class="btn btn-default" tabindex="101">Login as Guest</a>
      <a id="dw-lgi-pswd" class="btn btn-default" tabindex="102">Login with Email and Password</a>

      <p id="dw-lgi-or-login-using">Or login using your account (if any) at:</p>
      <div id="dw-lgi-other-sites">
        <a id="dw-lgi-google" class="btn btn-default" tabindex="103">
          <span class="icon-google-plus"></span>Google
        </a>
        <a id="dw-lgi-facebook" class="btn btn-default" tabindex="104">
          <span class="icon-facebook"></span>
          Facebook
        </a>
        <a id="dw-lgi-yahoo" class="btn btn-default" tabindex="105">
          <span class="icon-yahoo"></span>
          Yahoo!
        </a>
      </div>

      <a id="dw-lgi-more" class="dw-a-login-openid btn btn-default" tabindex="106">
        <span class="icon-openid"></span>
        More options...
      </a>

      <input class="btn btn-default dw-fi-cancel" type="button" value="Cancel" tabindex="107">
    </div>
    ''')



$(!->
  $('#dw-a-login').click showLoginDialog)



# vim: fdm=marker et ts=2 sw=2 fo=tcqwn list

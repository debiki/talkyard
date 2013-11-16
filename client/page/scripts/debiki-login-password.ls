/* Shows a login-with-email-and-password dialog.
 * Copyright (C) 2013 Kaj Magnus Lindberg (born 1979)
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



d.i.showPasswordLoginDialog = !(mode, loginAndContinue) ->

  dialog = passwordLoginDialogHtml()
  dialog.dialog d.i.newModalDialogSettings({ width: 350 })

  #tweakButtonTitles dialog, mode

  dialog.find('#dw-lgi-pswd-submit').click ->
    data =
      email: dialog.find('input[name=email]').val!
      password: dialog.find('input[name=password]').val!
    d.u.postJson { url: '/-/login-password', data }
      .fail d.i.showServerResponseDialog
      .done loginAndContinue
      .always !-> dialog.dialog 'close'
    false

  dialog.find('.dw-fi-cancel').click ->
    dialog.dialog 'close'
    false

  dialog.dialog('open')



function passwordLoginDialogHtml
  $('''
    <div class="dw-fs" id="dw-lgi-pswd" title="Login with Email and Password">

      <div class="form-group">
        <label for="dw-lgi-pswd-email">Email:</label><br>
        <input type="email" id="dw-lgi-pswd-email" name="email" value="" class="form-control" tabindex="110">
      </div>

      <div class="form-group">
        <label for="dw-lgi-pswd-password">Password:</label><br>
        <input type="password" id="dw-lgi-pswd-password" name="password" class="form-control" tabindex="120">
      </div>

      <br>
      <button type="submit" id="dw-lgi-pswd-submit" class="btn btn-default" tabindex="130">Login</button>
      <input class="btn btn-default dw-fi-cancel" type="button" value="Cancel" tabindex="140">

      <br>
      <a href="/-/reset-password" target="_blank" class="dw-reset-pswd" tabindex="150">Did you forget your password?</a>

    </div>
    ''')



# vim: fdm=marker et ts=2 sw=2 fo=tcqwn list

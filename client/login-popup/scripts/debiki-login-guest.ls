/* Shows a login-as-guest dialog.
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



d.i.showGuestLoginDialog = !(loginAndContinue) ->

  dialog = guestLoginDialogHtml()
  dialog.dialog d.i.newModalDialogSettings({ width: 350 })

  dialog.find('#dw-lgi-guest-submit').click ->
    data =
      name: dialog.find('#dw-fi-lgi-name').val!
      email: dialog.find('#dw-fi-lgi-email').val!
      url: dialog.find('#dw-fi-lgi-url').val!
    d.u.postJson { url: "#{d.i.serverOrigin}/-/login-guest", data }
      .fail d.i.showServerResponseDialog
      .done loginAndContinue
      .always !-> dialog.dialog 'close'
    false

  dialog.find('.dw-fi-cancel').click ->
    dialog.dialog 'close'
    false

  dialog.dialog('open')



/**
 * The email field should be type="email" but ScalaTest doesn't currently
 * support that, so use type="text" for now :-(
 */
function guestLoginDialogHtml
  $('''
    <div class="dw-fs" id="dw-lgi-guest-dlg" title="Login as Guest">
      <div class="form-group">
        <label for="dw-fi-lgi-name">Enter your name</label><br>
        <input id="dw-fi-lgi-name" type="text" size="30" maxlength="100"
            name="dw-fi-lgi-name" value="Anonymous" tabindex="110" class="form-control">
      </div>
      <div class="form-group">
        <label for="dw-fi-lgi-email">Email (optional, not shown)</label><br>
        <p>If you want to be notified of replies to your comments:</p>
        <input id="dw-fi-lgi-email" type="text" size="30" maxlength="100"
            name="dw-fi-lgi-email" value="" tabindex="120" class="form-control">
      </div>
      <div class="form-group">
        <label for="dw-fi-lgi-url" id="dw-fi-lgi-url-lbl">Website (optional)</label><br>
        <input id="dw-fi-lgi-url" type="text" size="30" maxlength="200"
            name="dw-fi-lgi-url" value="" tabindex="130" class="form-control">
      </div>
      <br>
      <div>
        <button id="dw-lgi-guest-submit" class="btn btn-default" type="submit" tabindex="140">
          <span class="dw-login-to-submit">Login and submit</span>
          <span class="dw-login-to-post-comment">Login and post comment</span>
          <span class="dw-login-to-login">Login</span>
        </button>
        <input class="btn btn-default dw-fi-cancel" type="button" value="Cancel" tabindex="150">
      </div>
    </div>
    ''')



# vim: fdm=marker et ts=2 sw=2 fo=tcqwn list

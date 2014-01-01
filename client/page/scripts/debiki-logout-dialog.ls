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


function showLogoutDialog

  $dialog = logoutDialogHtml()
  $dialog.dialog d.i.newModalDialogSettings()

  $dialog.find('.dw-fi-cancel').click !->
    $dialog.dialog 'close'

  $dialog.find('input[type=submit]').click ->
    d.u.postJson { url: "#{d.i.serverOrigin}/-/logout" }
      .fail d.i.showServerResponseDialog
      .done !-> d.i.Me.fireLogout()
      .always !-> $dialog.dialog 'close'
    false # prevent default

  $dialog.dialog 'open'



function logoutDialogHtml
  $('''
    <div class="dw-fs" id="dw-fs-lgo" title="Log out">
      <form method="post">
        <p>Are you sure?</p>
        <div class="dw-submit-set">
          <input class="dw-fi-submit btn btn-default" type="submit" value="Log out"/>
          <input class="dw-fi-cancel btn btn-default" type="button" value="Cancel"/>
        </div>
      </form>
    </div>
    ''')


$(!->
  $('.dw-a-logout').click showLogoutDialog)



# vim: fdm=marker et ts=2 sw=2 fo=tcqwn list

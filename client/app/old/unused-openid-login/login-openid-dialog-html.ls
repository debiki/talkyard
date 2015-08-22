/* HTML for OpenID login dialog. Didn't want this in JS or server side code.
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

/**
 *  The login form below is based on this JavaScript OpenID Selector
 *  example file:
 *    debiki-core/src/main/resources/toserve/lib/openid-selector/demo.html

d.i.xx_newOpenidLoginDialog = ->
  $('''
  <div class='dw-fs' id='dw-fs-openid-login' title="Sign In or Create New Account">
    <form action="/-/api/login-openid" method='post' id='openid_form'>
      <input type='hidden' name='action' value='verify' />
      <div id='openid_choice'>
        <p>Please click your account provider:</p>
        <div id='openid_btns'></div>
      </div>
      <div id='openid_input_area'>
        <input id='openid_identifier' name='openid_identifier' type='text'
            value='https://' />
        <input id='openid_submit' type='submit' value='Sign-In'/>
      </div>
      <noscript>
        <p>OpenID is a service that allows you to log-on to many different
        websites using a single indentity. Find out
        <a href='http://openid.net/what/'>more about OpenID</a>
        and <a href='http://openid.net/get/'>how to get an OpenID enabled
        account</a>.</p>
      </noscript>
    </form>
  </div>''')
*/

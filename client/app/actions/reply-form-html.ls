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


d = i: debiki.internal, u: debiki.v0.util
$ = d.i.$;


d.i.newReplyFormHtml = ->
  $('''
  <li class="dw-fs dw-fs-re">
    <div class="dw-arw dw-arw-hz-line-to-sibling"></div>
    <form>
      <input type="hidden" id="dw-fi-reply-where" name="dw-fi-reply-where" value="" />
      <div>
        <label for="dw-fi-reply-text">Your reply:</label><br/>
        <textarea id="dw-fi-reply-text" name="dw-fi-reply-text" rows="13"
          cols="38"></textarea>
      </div>
      <div class="dw-submit-set">
        <input class="dw-fi-cancel" type="button" value="Cancel"/>
        <input class="dw-fi-submit" type="submit" value="Post as..."/>
      </div>
    </form>
  </li>''')


# vim: fdm=marker et ts=2 sw=2 fo=tcqwn list

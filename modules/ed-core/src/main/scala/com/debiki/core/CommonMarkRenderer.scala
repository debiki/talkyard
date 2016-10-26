/**
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

package com.debiki.core


trait CommonMarkRenderer {

  def renderAndSanitizeCommonMark(commonMarkSource: String,
        allowClassIdDataAttrs: Boolean, followLinks: Boolean): String

  def sanitizeHtml(text: String): String

  def slugifyTitle(title: String): String


  def renderSanitizeCommonMarkReturnSource(source: String, allowClassIdDataAttrs: Boolean,
        followLinks: Boolean): CommonMarkSourceAndHtml = {
    val html = renderAndSanitizeCommonMark(source, allowClassIdDataAttrs = allowClassIdDataAttrs,
      followLinks = followLinks)
    CommonMarkSourceAndHtml(source, html)
  }
}


case class CommonMarkSourceAndHtml(source: String, html: String)


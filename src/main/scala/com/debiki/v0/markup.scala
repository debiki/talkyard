/**
 * Copyright (C) 2012 Kaj Magnus Lindberg (born 1979)
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

package com.debiki.v0


object Markup {
  val Para = Markup("para", "None (plain text)")
  val Dmd0 = Markup("dmd0", "Debiki Markdown v.0")
  val Html = Markup("html", "HTML")
  val Code = Markup("code", "Code (e.g. CSS, Javascript)")
  val All = List(Para, Dmd0, Html, Code)

  val DefaultForComments = Dmd0

  def defaultForPageBody(pageRole: PageRole) = pageRole match {
    case PageRole.Code => Code
    case _ => Dmd0
  }

  // Currently only plain text (para) is possible, because
  // postTitleXml in _showComment in html.scala inlines post.text as is.
  val DefaultForPageTitle = Para

  val Safe = "para"  // use if someone seems evil
}

case class Markup(id: String, prettyName: String)



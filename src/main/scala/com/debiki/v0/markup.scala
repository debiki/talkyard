/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package com.debiki.v0


object Markup {
  val Para = Markup("para", "None (plain text)")
  val Dmd0 = Markup("dmd0", "Debiki Markdown v.0")
  val Html = Markup("html", "HTML")
  val Code = Markup("code", "Code (e.g. CSS, Javascript)")
  val All = List(Para, Dmd0, Html, Code)

  val DefaultForComments = Dmd0
  val DefaultForPageBody = Dmd0

  // Currently only plain text (para) is possible, because
  // postTitleXml in _showComment in html.scala inlines post.text as is.
  val DefaultForPageTitle = Para

  val Safe = "para"  // use if someone seems evil
}

case class Markup(id: String, prettyName: String)



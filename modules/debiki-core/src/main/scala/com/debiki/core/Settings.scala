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



case class Setting[A](name: String, value: A, default: A)



object PageSettings {
  val Default = PageSettings(Nil)
}


case class PageSettings(sectionSettings: Seq[SectionSettings]) {


  def siteName: Setting[String] = setting("site_name", default = "Untitled Page")

  def imageUrl: Setting[String] = setting("image_url", default = "/favicon.ico")

  def horizontalComments: Setting[String] = setting("horizontal_comments", default = "F")


  private def setting[A](name: String, default: A): Setting[A] = {
    var effectiveValue: A = default
    var i = 0
    while (i < sectionSettings.size) {
      val settings = sectionSettings(i)
      i += 1
      val anyAssignedValue = settings.valuesByName.get(name)
      anyAssignedValue foreach { value =>
        effectiveValue = value.asInstanceOf[A]
        i = 999999 // break loop, value found
      }
    }
    Setting(name, effectiveValue, default = default)
  }

}



case class SectionSettings(
  targetSection: Section,
  namesAndValues: Seq[SettingNameValue[_]]) {

  val valuesByName: Map[String, Any] = namesAndValues.toMap
}



/** Identifies a section of all pages, e.g. a forum, a subforum, a blog, or a single page.
  * Used to clarify what pages a setting should affect.
  */
sealed abstract class Section

object Section {
  case object WholeSite extends Section
  case class PageTree(rootPageId: PageId) extends Section
  case class SinglePage(id: PageId) extends Section
}


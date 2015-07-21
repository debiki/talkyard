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

package debiki

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.DebikiHttp.throwNotFound
import java.{util => ju, lang => jl}
import play.api._
import requests.PageRequest


object TemplateRenderer { // try to delete


  def renderTemplate(pageReq: PageRequest[_], appendToBody: xml.NodeSeq = Nil): String = {

    val tpi = new TemplateProgrammingInterface(pageReq, appendToBody)

    if (!pageReq.pageExists && pageReq.pageRole != Some(PageRole.EmbeddedComments)) {
      if (pageReq.pagePath.value == HomepageUrlPath) {
        return views.html.specialpages.createSomethingHerePage(tpi).body
      }
      else {
        throwNotFound("DwE00404", "Page not found")
      }
    }

    val template =
      pageReq.thePageRole match {
        case PageRole.HomePage => "homepage" // try to delete
        case PageRole.Blog => "blog" // try to delete
        case PageRole.EmbeddedComments => "embeddedComments"
        case _ => "page"
      }

    renderThemeTemplate(template, tpi::Nil)
  }


  def renderThemeTemplate(template: String, arguments: Seq[AnyRef]): String = {
    // WOULD remove this dynamic stuff, no longer needed, templates can no longer be edited/added.
    val viewClassName = s"views.html.templates.$template"
    try {
      val viewClass : Class[_] = Play.current.classloader.loadClass(viewClassName)
      val renderMethod: jl.reflect.Method =
        viewClass.getMethods.find(_.getName == "apply") getOrDie "DwE74hG0X3"
      val result = renderMethod.invoke(viewClass, arguments: _*)
      val htmlText = result.asInstanceOf[templates.Html].body
      htmlText
    }
    catch {
      case ex: jl.ClassNotFoundException =>
        throw DebikiException(
          "DwE7F3X9", s"Template not found: `$template'")
      case ex: jl.NoSuchMethodException =>
        throw new DebikiException(
          "DwE68St8", o"""Template '$template.scala.html' is broken.
          The method declaration at the top of the file (that is,
          the "@(....) line) is probably incorrect? I got these parameter types:
           ${arguments.map(_.getClass.getSimpleName)}; please compare them to the
           signature of the template (that is, the "@(...)" line).""")
      case wrappingException: jl.reflect.InvocationTargetException =>
        val originalException = wrappingException.getCause
        throw originalException
    }
  }

}

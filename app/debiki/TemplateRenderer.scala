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


object TemplateRenderer {


  def renderTemplate(pageReq: PageRequest[_], appendToBody: xml.NodeSeq = Nil)
        : String =
    try {
      renderTemplateImpl(pageReq, appendToBody)
    }
    catch {
      case ex: PageConfigException =>
        views.html.specialpages.brokenPage(ex).body
      case ex: BadTemplateException =>
        views.html.specialpages.brokenPage(ex).body
      case ex: WebsiteConfigException =>
        views.html.specialpages.brokenPage(ex).body
    }


  private def renderTemplateImpl(
        pageReq: PageRequest[_], appendToBody: xml.NodeSeq): String = {

    val tpi = new TemplateProgrammingInterface(pageReq, appendToBody)

    if (pageReq.pageRoot == Some(PageParts.ConfigPostId) || pageReq.pagePath.isConfigPage) {
      // Use a page that we know for sure is not broken, so it's possible
      // to fix errors. And do this before loading any config values,
      // since a config file might be corrupted (exception thrown).
      val isPageSettings = pageReq.pageRoot == Some(PageParts.ConfigPostId)
      return views.html.specialpages.template(tpi, isPageSettings).body
    }

    if (!pageReq.pageExists) {
      if (pageReq.pagePath.value == "/") {
        return views.html.specialpages.createSomethingHerePage(tpi).body
      }
      else {
        throwNotFound("DwE00404", "Page not found")
      }
    }

    val template = tpi.pageConfigValue("template") orIfEmpty {
      pageReq.thePageRole match {
        case PageRole.BlogPost => "blogPost"
        case PageRole.Blog => "blog"
        case PageRole.Forum => "forum"
        case PageRole.ForumCategory => "editForumCategory"
        case PageRole.ForumTopic => "forumTopic"
        case PageRole.Code => "codePage"
        case PageRole.EmbeddedComments => "embeddedComments"
        case _ =>
        // A blog post template works well for most pages?
        "blogPost"
      }
    }

    renderThemeTemplate(template, tpi::Nil)
  }


  def renderThemeTemplate(template: String, arguments: Seq[AnyRef]): String = {
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
        throw PageConfigException(
          "DwE7F3X9", s"Template not found: `$template'")
      case ex: jl.NoSuchMethodException =>
        throw new PageConfigException(
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


  class PageConfigException(errorCode: String, details: String)
    extends DebikiException(errorCode, details)

  object PageConfigException {
    def apply(errorCode: String, details: String) =
      new PageConfigException(errorCode, details)
  }


  class BadTemplateException(errorCode: String, details: String)
    extends DebikiException(errorCode, details)

  object BadTemplateException {
    def apply(errorCode: String, details: String) =
      new BadTemplateException(errorCode, details)
  }

}

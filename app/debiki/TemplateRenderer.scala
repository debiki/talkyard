/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0._
import controllers.PageRequest
import java.{util => ju, lang => jl}
import play.api._
import Prelude._


object TemplateRenderer {


  def renderTemplate(pageReq: PageRequest[_], appendToBody: xml.NodeSeq = Nil)
        : String =
    try {
      renderTemplateImpl(pageReq, appendToBody)
    }
    catch {
      case ex: PageConfigException =>
        views.html.themes.specialpages.brokenPage(ex).body
      case ex: BadTemplateException =>
        views.html.themes.specialpages.brokenPage(ex).body
    }


  private def renderTemplateImpl(
        pageReq: PageRequest[_], appendToBody: xml.NodeSeq): String = {

    val tpi = new TemplateProgrammingInterface(pageReq, appendToBody)

    if (pageReq.pageRoot.isPageTemplate || pageReq.pagePath.isTemplatePage) {
      // Use a page that we know for sure is not broken, so it's possible
      // to fix errors. And do this before loading any config values,
      // since a config file might be corrupted (exception thrown).
      return views.html.themes.specialpages.template(
        tpi, isPageSettings = pageReq.pageRoot.isPageTemplate).body
    }

    // Handle page config values.
    //if (commentVisibility == CommentVisibility.ShowOnClick) {
    //  curHeadTags = curHeadTags ++ HtmlPageSerializer.tagsThatHideShowInteractions
    //}

    // Might have to add ng-app to <html>, for AngularJS to work?

    //  <html class={classes}>
    //    <head>{curHeadTags}</head>
    //    {<body>{curBodyTags ++ appendToBody}</body> % curBodyAttrs}
    //  </html> % curHtmlAttrs

    // For now, use the same template for all websites.
    // In the future: Create more templates, and check which one to use
    // in a `/.site.conf` file.
    // In the distant future, implement my ideas in play-thoughts.txt.



    val theme = {
      val themeUnsafe = tpi.websiteConfigValue("theme") orIfEmpty "default20121009"
      val themeNoDelims = themeUnsafe filterNot (ch => ch == '.' || ch == '-')
      // Don't allow anyone to use the www.debiki.com template:
      if (themeNoDelims == "wwwdebikicom" && !pageReq.host.endsWith("debiki.com")
          && !pageReq.host.startsWith("localhost:"))
        "default20121009"
      else
        themeNoDelims
    }

    import pageReq.{pageMeta}
    val template =
      tpi.pageConfigValue("template") orIfEmpty {
        // Select template based on page role.
        if (pageMeta.pageRole == PageRole.BlogArticle) {
          "blogPost"
        } else if (pageMeta.pageRole == PageRole.BlogMainPage) {
          "blogMainPage"
        } else if (pageMeta.pageRole == PageRole.ForumMainPage) {
          if (pageMeta.parentPageId isEmpty) "forumMainPage"
          else "subforum"
        } else if (pageMeta.pageRole == PageRole.ForumThread) {
          // For now:
          "blogPost"
        } else {
          // A blog post template works well for most pages?
          "blogPost"
        }
      }

    renderThemeTemplate(theme, template, tpi)
  }


  private def renderThemeTemplate(theme: String, template: String,
        tpi: TemplateProgrammingInterface): String = {
    val viewClassName = s"views.html.themes.$theme.$template"
    try {
      val viewClass : Class[_] = Play.current.classloader.loadClass(viewClassName)
      val renderMethod: jl.reflect.Method = viewClass.getDeclaredMethod(
        "apply", classOf[TemplateProgrammingInterface])
      val result = renderMethod.invoke(viewClass, tpi)
      val htmlText = result.asInstanceOf[templates.Html].body
      htmlText
    }
    catch {
      case ex: jl.ClassNotFoundException =>
        throw PageConfigException(
          "DwE0b3X9", s"Template not found: `$template', theme: `$theme'")
      case ex: jl.NoSuchMethodException =>
        throw new PageConfigException(
          "DwE68St8", o"""Template `$template', theme: `$theme', is broken.
          Does it not start with `@(tpi: TemplateProgrammingInterface)'?""")
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
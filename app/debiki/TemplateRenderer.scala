/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0._
import controllers.PageRequest
import java.{util => ju}
import Prelude._


case class TemplateRenderer(
  pageReq: PageRequest[_],
  appendToBody: xml.NodeSeq = Nil) {


  def renderTemplate(): String = {

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

    val tpi = new TemplateProgrammingInterface(pageReq, appendToBody)

    import pageReq.{pagePath, pageMeta}
    import views.html.themes
    import views.html.themes._

    val theme = tpi.websiteConfigValue("theme")

    val renderedPage =
      if (pagePath.isTemplatePage)
        themes.specialpages.template(tpi).body
      else theme match {
        // Should this be rewritten? Lookup package via Scala 2.10's reflection,
        // somehow. But there's no common superclass for all packages, hmm.
        // Can I use Scala's Structural Typing?
        // — Or does which templates exist vary by theme? Should *not* rewrite?

        // For page config posts (?view=3), use the `blogPost` template,
        // because it e.g. doesn't list any child pages (which a
        // `blogPostList` template however does).

        // Don't allow anyone to use www.debiki.com's templates.
        case "www.debiki.com" if pageReq.host.endsWith("debiki.com") ||
              pageReq.host.startsWith("localhost:") =>
          if (pageReq.pageRoot.isPageTemplate)
            wwwdebikicom.blogPost(tpi).body // see comment above
          else if (pageMeta.pageRole == PageRole.BlogArticle)
            wwwdebikicom.blogPost(tpi).body
          else if (pageMeta.pageRole == PageRole.BlogMainPage)
            wwwdebikicom.blogPostList(tpi).body
          else if (pageMeta.pageRole == PageRole.Homepage)
            wwwdebikicom.homepage(tpi).body
          else
            // For now, fallback to the blog post template.
            wwwdebikicom.blogPost(tpi).body

        case "default-2012-10-09" | _ =>
          if (pageReq.pageRoot.isPageTemplate)
            default20121009.blogPost(tpi).body
          else if (pageMeta.pageRole == PageRole.BlogArticle)
            default20121009.blogPost(tpi).body
          else if (pageMeta.pageRole == PageRole.BlogMainPage)
            default20121009.blogPostList(tpi).body
          else if (pageMeta.pageRole == PageRole.Homepage)
            default20121009.homepage(tpi).body
          else
            // For now, fallback to the blog post template.
            default20121009.blogPost(tpi).body
      }

    renderedPage
  }

}


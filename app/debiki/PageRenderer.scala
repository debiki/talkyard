/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0._
import controllers.PageRequest
import play.{api => p}
import PageRenderer._
import Prelude._


case class PageRenderer(pageReq: PageRequest[_], pageCache: PageCache,
        appendToBody: xml.NodeSeq = Nil) {


  val commentVisibility = CommentVisibility.Visible // for now


  def renderPageTitleAndBodyAndComments() =
    pageCache.get(pageReq, commentVisibility)


  def renderPage(): String = {

    // Handle page config values.
    //if (commentVisibility == CommentVisibility.ShowOnClick) {
    //  curHeadTags = curHeadTags ++ HtmlSerializer.tagsThatHideShowInteractions
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

    val tpi = TemplateProgrammingInterface(this)

    import pageReq.pagePath
    val renderedPage: String =
      if (pagePath.isTemplatePage)
        views.html.themes.specialpages.template(tpi).body
      else if (_isBlogArticle(pagePath))
        views.html.themes.default20121009.blogPost(tpi).body
      else if (_isBlogArticleListPage(pagePath))
        views.html.themes.default20121009.blogPostList(tpi).body
      else if (_isHomepage(pagePath))
        views.html.themes.default20121009.homepage(tpi).body
      else
        // For now, fallback to the blog post template.
        views.html.themes.default20121009.blogPost(tpi).body

    renderedPage
  }
}


object PageRenderer {

  private def _isBlogArticle(pagePath: PagePath) = {
    // A blog article has a page slug; index pages cannot be blog articles.
    _IsBlogRegex.matches(pagePath.folder) && !pagePath.isFolderOrIndexPage
  }


  private def _isBlogArticleListPage(pagePath: PagePath) = {
    // A blog article list is an index page.
    _IsBlogRegex.matches(pagePath.folder) && pagePath.isFolderOrIndexPage
  }


  private def _isHomepage(pagePath: PagePath) = {
    _IsHomepageRegex.matches(pagePath.folder) && pagePath.isFolderOrIndexPage
  }


  private val _IsBlogRegex = """.*/blog/|.*/[0-9]{4}/[0-9]{2}/[0-9]{2}/""".r
  private val _IsHomepageRegex = """/|\./drafts/""".r

}


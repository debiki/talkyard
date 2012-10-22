/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0._
import controllers.PageRequest
import play.{api => p}
import PageRenderer._
import Prelude._


// COULD rename to TemplateRenderer?
case class PageRenderer(pageReq: PageRequest[_], pageCache: Option[PageCache],
        appendToBody: xml.NodeSeq = Nil) {


  val commentVisibility = CommentVisibility.Visible // for now


  // COULD break out to class ArticleRenderer?
  // (Also see *object* PageRenderer's renderArticleAndComments().)
  def renderPageTitleAndBodyAndComments() = pageCache match {
    case Some(cache) =>
      cache.get(pageReq, commentVisibility)
    case None =>
      PageRenderer.renderArticleAndComments(
        pageReq.page_!, pageReq.pageVersion, pageReq.pagePath,
        pageReq.pageRoot, hostAndPort = pageReq.host, showComments = true)
  }


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

  // COULD break out to class ArticleRenderer?
  def renderArticleAndComments(page: Debate, pageVersion: PageVersion,
        pagePath: PagePath, pageRoot: PageRoot, hostAndPort: String,
        showComments: Boolean): xml.NodeSeq = {

    if (page.body.map(_.someVersionApproved) != Some(true)) {
      // Regrettably, currently the page is hidden also for admins (!).
      // But right now only admins can create new pages and they are
      // auto approved (well, will be, in the future.)
      return <p>This page is pending approval.</p>
    }

    val (pageDesiredVersion, tooRecentActions) =
        page.partitionByVersion(pageVersion)
    val config = DebikiHttp.newUrlConfig(hostAndPort)

    // Hmm, HtmlSerializer and pageTrust should perhaps be wrapped in
    // some PageRendererInput class, that is handled to PageCache,
    // so PageCache don't need to know anything about how to render
    // a page. But for now:
    val pageTrust = PageTrust(pageDesiredVersion)

    // layoutPage() takes long, because markup source is converted to html.
    val nodes = HtmlSerializer(pageDesiredVersion, pageTrust, pagePath, config,
      showComments = showComments).layoutPage(pageRoot)

    nodes map { html =>
    // The html is serialized here only once, then it's added to the
    // page cache (if pageRoot is the Page.body -- see get() below).
      xml.Unparsed(liftweb.Html5.toString(html))
    }
  }


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


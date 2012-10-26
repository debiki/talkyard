/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0._
import controllers.{AppCreatePage, PageRequest}
import java.{util => ju}
import PageRenderer._
import Prelude._


// COULD rename to TemplateRenderer?
case class PageRenderer(pageReq: PageRequest[_], pageCache: Option[PageCache],
        appendToBody: xml.NodeSeq = Nil) {


  val commentVisibility = CommentVisibility.Visible // for now


  // COULD break out to class ArticleRenderer?
  // (Also see *object* PageRenderer's renderArticle().)
  def renderArticle(showComments: Boolean) = pageCache match {
    case Some(cache) =>
      val commentVisibility =
        if (showComments) CommentVisibility.Visible
        else CommentVisibility.Hidden
      cache.get(pageReq, commentVisibility)
    case None =>
      val page = PageStuff(pageReq.pageMeta, pageReq.pagePath, pageReq.page_!)
      PageRenderer.renderArticle(page, pageReq.pageVersion,
        pageReq.pageRoot, hostAndPort = pageReq.host,
        showComments = showComments)
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

    import pageReq.{pagePath, pageMeta}
    val renderedPage: String =
      if (pagePath.isTemplatePage)
        views.html.themes.specialpages.template(tpi).body
      else if (pageMeta.pageRole == PageRole.BlogArticle)
        views.html.themes.default20121009.blogPost(tpi).body
      else if (pageMeta.pageRole == PageRole.BlogMainPage)
        views.html.themes.default20121009.blogPostList(tpi).body
      else if (pageMeta.pageRole == PageRole.Homepage)
        views.html.themes.default20121009.homepage(tpi).body
      else
        // For now, fallback to the blog post template.
        views.html.themes.default20121009.blogPost(tpi).body

    renderedPage
  }
}


object PageRenderer {

  // COULD break out to class ArticleRenderer?
  def renderArticle(page: PageStuff, pageVersion: PageVersion,
        pageRoot: PageRoot, hostAndPort: String, showComments: Boolean)
        : xml.NodeSeq = {

    val actions = page.actions

    if (actions.body.map(_.someVersionApproved) == Some(false) ||
        actions.title.map(_.someVersionApproved) == Some(false)) {
      // Regrettably, currently the page is hidden also for admins (!).
      // But right now only admins can create new pages and they are
      // auto approved (well, will be, in the future.)
      return <p>This page is pending approval.</p>
    }

    val (actionsDesiredVersionStuffMissing, tooRecentActions) =
      actions.partitionByVersion(pageVersion)

    val actionsDesiredVersion =
      _addMissingTitleBodyConfigTo(actionsDesiredVersionStuffMissing)

    val config = DebikiHttp.newUrlConfig(hostAndPort)

    // Hmm, HtmlSerializer and pageTrust should perhaps be wrapped in
    // some PageRendererInput class, that is handled to PageCache,
    // so PageCache don't need to know anything about how to render
    // a page. But for now:
    val pageTrust = PageTrust(actionsDesiredVersion)

    // layoutPage() takes long, because markup source is converted to html.
    val pageDesiredVersion = page.copy(actions = actionsDesiredVersion)
    val nodes = HtmlSerializer(pageDesiredVersion, pageTrust, config,
      showComments = showComments).layoutPage(pageRoot)

    nodes map { html =>
    // The html is serialized here only once, then it's added to the
    // page cache (if pageRoot is the Page.body -- see get() below).
      xml.Unparsed(liftweb.Html5.toString(html))
    }
  }


  /**
   * Adds an empty title, an empty page body, and a config text, if they
   * don't yet exist, so there is something to edit.
   */
  private def _addMissingTitleBodyConfigTo(pageNoDummies: Debate): Debate = {
    val addDummyTitle = pageNoDummies.title.isEmpty
    val addDummyBody = pageNoDummies.body.isEmpty
    val addDummyConfig = pageNoDummies.pageTemplatePost.isEmpty

    var pageWithDummies = pageNoDummies

    if (addDummyTitle || addDummyBody || addDummyConfig)
      pageWithDummies = pageWithDummies + DummyAuthor

    if (addDummyTitle) pageWithDummies = pageWithDummies + DummyTitle
    if (addDummyBody) pageWithDummies = pageWithDummies + DummyBody
    if (addDummyConfig) pageWithDummies = pageWithDummies + DummyConfig

    pageWithDummies
  }


  // COULD move dummy stuff below to ArticleRenderer too
  // COULD have Dao require that user/idty/login id never be "1".

  val DummyAuthorUser = User(id = "1", displayName = "(dummy author)",
    email = "", emailNotfPrefs = EmailNotfPrefs.DontReceive, country = "",
    website = "", isAdmin = false, isOwner = false)


  val DummyAuthorIdty = IdentitySimple(id = "1", userId = DummyAuthorUser.id,
    name = "(dummy author)", email = "", location = "", website = "")


  val DummyAuthorLogin = Login(id = "1", prevLoginId = None, ip = "?.?.?.?",
    date = new ju.Date, identityId = DummyAuthorIdty.id)


  val DummyAuthor = People(
    List(DummyAuthorLogin), List(DummyAuthorIdty), List(DummyAuthorUser))


  val DummyTitle = Post(
    id = Page.TitleId,
    parent = Page.TitleId,
    ctime = new ju.Date,
    loginId = DummyAuthorLogin.id,
    newIp = None,
    text = AppCreatePage.DummyTitleText,
    markup = Markup.DefaultForPageTitle.id,
    approval = Some(Approval.Preliminary),
    tyype = PostType.Text)


  val DummyBody = DummyTitle.copy(
    id = Page.BodyId, parent = Page.BodyId, text = AppCreatePage.DummyPageText,
    markup = Markup.DefaultForPageBody.id)


  val DummyConfig = DummyBody.copy(
    id = Page.TemplateId, parent = Page.TemplateId, text = "Click to edit",
    markup = Markup.Code.id)


  private def _isHomepage(pagePath: PagePath) = {
    _IsHomepageRegex.matches(pagePath.folder) && pagePath.isFolderOrIndexPage
  }


  private val _IsBlogRegex = """.*/blog/|.*/[0-9]{4}/[0-9]{2}/[0-9]{2}/""".r
  private val _IsHomepageRegex = """/|\./drafts/""".r

}


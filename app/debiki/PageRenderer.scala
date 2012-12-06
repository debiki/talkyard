/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0._
import controllers.{AppCreatePage, PageRequest}
import java.{util => ju}
import PageRenderer._
import Prelude._



object PageRenderer {   // COULD rename to DummyPage


  /**
   * A page with "This page is pendig approval" body.
   */
  def emptyUnapprovedPage = unimplemented
    // Regrettably, currently the page is hidden also for admins (!).
    // But right now only admins can create new pages and they are
    // auto approved (well, will be, in the future.)
    //return <p>This page is pending approval.</p>


  /**
   * Adds an empty title, an empty page body, and a config text, if they
   * don't yet exist, so there is something to edit.
   */
  def addMissingTitleBodyConfigTo(pageNoDummies: Debate): Debate = {
    val addDummyTitle = pageNoDummies.title.isEmpty
    val addDummyBody = pageNoDummies.body.isEmpty
    val addDummyConfig = pageNoDummies.pageTemplatePost.isEmpty

    var pageWithDummies = pageNoDummies

    if (addDummyTitle || addDummyBody || addDummyConfig)
      pageWithDummies = pageWithDummies ++ DummyAuthor

    if (addDummyTitle) pageWithDummies = pageWithDummies + DummyTitle
    if (addDummyBody) pageWithDummies = pageWithDummies + DummyBody
    if (addDummyConfig) pageWithDummies = pageWithDummies + DummyConfig

    pageWithDummies
  }


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


  private val ConfigPageDummyText = """
    |This is an empty configuration page.
    |
    |Click this text to edit.
    |""".stripMargin


  val DummyConfig = DummyBody.copy(
    id = Page.TemplateId, parent = Page.TemplateId, text = ConfigPageDummyText,
    markup = Markup.Code.id)


  private def _isHomepage(pagePath: PagePath) = {
    _IsHomepageRegex.matches(pagePath.folder) && pagePath.isFolderOrIndexPage
  }


  private val _IsBlogRegex = """.*/blog/|.*/[0-9]{4}/[0-9]{2}/[0-9]{2}/""".r
  private val _IsHomepageRegex = """/|\./drafts/""".r

}


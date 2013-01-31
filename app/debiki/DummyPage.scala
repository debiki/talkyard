/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0._
import java.{util => ju}
import Prelude._


object DummyPage {

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
  def addMissingTitleBodyConfigTo(pageNoDummies: Debate, pageRole: PageRole): Debate = {
    val addDummyTitle = pageNoDummies.title.isEmpty
    val addDummyBody = pageNoDummies.body.isEmpty
    val addDummyConfig = pageNoDummies.pageConfigPost.isEmpty

    var pageWithDummies = pageNoDummies

    if (addDummyTitle || addDummyBody || addDummyConfig)
      pageWithDummies = pageWithDummies ++ DummyAuthor

    val texts: Texts = pageRole match {
      case PageRole.BlogPost => BlogPostTexts
      case PageRole.ForumGroup => ForumGroupTexts
      case PageRole.Forum => ForumTexts
      case PageRole.ForumTopic => ForumTopicTexts
      case PageRole.Code => CodeTexts
      case _ => DefaultTexts
    }

    if (addDummyTitle) pageWithDummies = pageWithDummies + dummyTitle(texts)
    if (addDummyBody) pageWithDummies = pageWithDummies + dummyBody(texts, pageRole)
    if (addDummyConfig) pageWithDummies = pageWithDummies + dummyConfig(texts)

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


  private def dummyTitle(texts: Texts) = Post(
    id = Page.TitleId,
    parent = Page.TitleId,
    ctime = new ju.Date,
    loginId = DummyAuthorLogin.id,
    newIp = None,
    text = texts.titleText,
    markup = Markup.DefaultForPageTitle.id,
    approval = Some(Approval.Preliminary),
    tyype = PostType.Text)


  private def dummyBody(texts: Texts, pageRole: PageRole) = dummyTitle(texts).copy(
    id = Page.BodyId, parent = Page.BodyId, text = texts.bodyText,
    markup = Markup.defaultForPageBody(pageRole).id)


  private def dummyConfig(texts: Texts) = dummyTitle(texts).copy(
    id = Page.ConfigPostId, parent = Page.ConfigPostId, text = texts.configText,
    markup = Markup.Code.id)


  private abstract class Texts {
    def titleText: String
    def bodyText: String
    def configText: String
  }


  private object DefaultTexts extends DefaultTexts


  private class DefaultTexts extends Texts {

    def titleText =
      "New Page (click to edit)"

    def bodyText = i"""
      |Page body.
      |
      |Click to edit, and select *Improve* in the menu that appears.
      |"""

    def configText = i"""
      |This is an empty configuration page.
      |
      |Click this text to edit.
      |"""
  }


  private object BlogPostTexts extends DefaultTexts {

    override val titleText =
      "New Blog Post (click to edit)"

    override val bodyText = i"""
      |Blog post text.
      |
      |Click to edit; select *Improve* in the menu that appears.
      |"""
  }


  private trait ForumBodyText {
    self: DefaultTexts =>

    override val bodyText = i"""
      |Optional forum info (instead of sticky topics).
      |
      |Click to edit; select *Improve* in the menu that appears.
      |"""
  }


  private object ForumGroupTexts extends DefaultTexts with ForumBodyText {
    override val titleText =
      "New Forum Group Title (click to edit)"
  }


  private object ForumTexts extends DefaultTexts with ForumBodyText {
    override val titleText =
      "New Forum Title (click to edit)"
  }


  private object ForumTopicTexts extends DefaultTexts {

    override val titleText =
      "Forum topic title (click to edit)"

    override val bodyText = i"""
      |Forum topic text.
      |
      |Click to edit; select *Improve* in the menu that appears.
      |"""
  }


  private object CodeTexts extends DefaultTexts {

    override val bodyText = i"""
      |This is a code page. For example, a configuration page,
      |or Javascript or CSS.
      |
      |Click to edit. Select *Improve* in the menu that appears.
      |"""
  }

}


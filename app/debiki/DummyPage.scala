/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0._
import java.{util => ju}
import Prelude._


object DummyPage {


  /**
   * Adds an empty title, an empty page body, and a config text, if they
   * don't yet exist, so there is something to edit.
   */
  def addMissingTitleBodyConfigTo(
        pageSplitByVersion: PageSplitByVersion, pageRole: PageRole): Debate = {

    val pageNoDummies = pageSplitByVersion.desired
    val pageInclUnapproved = pageSplitByVersion.inclUnapproved

    val addDummyTitle = pageNoDummies.title.isEmpty
    val addDummyBody = pageNoDummies.body.isEmpty
    val addDummyConfig = pageNoDummies.pageConfigPost.isEmpty

    val isTitleUnapproved = addDummyTitle && pageInclUnapproved.title.isDefined
    val isBodyUnapproved = addDummyBody && pageInclUnapproved.body.isDefined

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

    if (addDummyTitle) pageWithDummies += dummyTitle(texts, isTitleUnapproved)
    if (addDummyBody) pageWithDummies += dummyBody(texts, isBodyUnapproved, pageRole)
    if (addDummyConfig) pageWithDummies += dummyConfig(texts)

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


  private def dummyTitle(texts: Texts, absentSinceUnapproved: Boolean) = PostActionDto(
    id = Page.TitleId,
    postId = Page.TitleId,
    creationDati = new ju.Date,
    loginId = DummyAuthorLogin.id,
    userId = DummyAuthorUser.id,
    newIp = None,
    payload = PostActionPayload.CreatePost(
      parentPostId = Page.TitleId,
      text = if (absentSinceUnapproved) texts.unapprovedTitleText else texts.noTitleText,
      markup = Markup.DefaultForPageTitle.id,
      approval = Some(Approval.Preliminary)))


  private def dummyBody(texts: Texts, absentSinceUnapproved: Boolean, pageRole: PageRole) = {
    val prototype = dummyTitle(texts, false)
    prototype.copy(id = Page.BodyId, postId = Page.BodyId,
      payload = prototype.payload.copy(
        parentPostId = Page.BodyId,
        text = if (absentSinceUnapproved) texts.unapprovedBodyText else texts.noBodyText,
        markup = Markup.defaultForPageBody(pageRole).id))
  }


  private def dummyConfig(texts: Texts) = {
    val prototype = dummyTitle(texts, false)
    prototype.copy(id = Page.ConfigPostId, postId = Page.ConfigPostId,
      payload = prototype.payload.copy(
        parentPostId = Page.ConfigPostId,
        text = texts.configText,
        markup = Markup.Code.id))
  }


  private abstract class Texts {
    def noTitleText: String
    def unapprovedTitleText: String
    def noBodyText: String
    def unapprovedBodyText: String
    def configText: String
  }


  private object DefaultTexts extends DefaultTexts


  private class DefaultTexts extends Texts {

    def noTitleText = "New Page Title (click to edit)"

    def unapprovedTitleText = "(Title pending approval)"

    def noBodyText = i"""
      |Page body.
      |
      |$ClickToEditSelectImprove
      |"""

    def unapprovedBodyText = "(Text pending approval.)"

    def configText = i"""
      |This is an empty configuration page.
      |
      |$ClickToEditSelectImprove
      |"""
  }


  private object BlogPostTexts extends DefaultTexts {

    override val noTitleText =
      "New Blog Post Title (click to edit)"

    override val noBodyText = i"""
      |Blog post text.
      |
      |$ClickToEditSelectImprove
      |"""
  }


  private trait ForumBodyText {
    self: DefaultTexts =>

    override val noBodyText = i"""
      |Optional forum info (instead of sticky topics).
      |
      |$ClickToEditSelectImprove
      |"""
  }


  private object ForumGroupTexts extends DefaultTexts with ForumBodyText {
    override val noTitleText =
      "New Forum Group Title (click to edit)"
  }


  private object ForumTexts extends DefaultTexts with ForumBodyText {
    override val noTitleText =
      "New Forum Title (click to edit)"
  }


  private object ForumTopicTexts extends DefaultTexts {

    override val noTitleText =
      "Forum topic title (click to edit)"

    override val noBodyText = i"""
      |Forum topic text.
      |
      |$ClickToEditSelectImprove
      |"""
  }


  private object CodeTexts extends DefaultTexts {

    override val noBodyText = i"""
      |This is a code page. For example, a configuration page,
      |or Javascript or CSS.
      |
      |$ClickToEditSelectImprove
      |"""
  }


  private val ClickToEditSelectImprove =
    "Click to edit. Select *Improve* in the menu that appears."

}


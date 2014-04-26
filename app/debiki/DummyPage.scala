/**
 * Copyright (C) 2012-2013 Kaj Magnus Lindberg (born 1979)
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
import java.{util => ju}
import Prelude._


object DummyPage {


  /**
   * Adds an empty title, an empty page body, and a config text, if they
   * don't yet exist, so there is something to edit.
   */
  def addMissingTitleBodyConfigTo(pageParts: PageParts, pageRole: PageRole): PageParts = {

    val addDummyTitle = pageParts.title.isEmpty
    val addDummyBody = pageParts.body.isEmpty
    val addDummyConfig = pageParts.pageConfigPost.isEmpty

    var pageWithDummies = pageParts

    if (addDummyTitle || addDummyBody || addDummyConfig)
      pageWithDummies = pageWithDummies ++ DummyAuthor

    val texts: Texts = pageRole match {
      case PageRole.BlogPost => BlogPostTexts
      case PageRole.Forum => ForumTexts
      case PageRole.ForumCategory => ForumCategoryTexts
      case PageRole.ForumTopic => ForumTopicTexts
      case PageRole.Code => CodeTexts
      case _ => DefaultTexts
    }

    if (addDummyTitle) pageWithDummies += dummyTitle(texts)
    if (addDummyBody) pageWithDummies += dummyBody(texts, pageRole)
    if (addDummyConfig) pageWithDummies += dummyConfig(texts)

    pageWithDummies
  }


  // COULD have Dao require that user/idty/login id never be "2".
  // (Id "1" is the SystemUser, in debiki-core user.scala.)

  val DummyAuthorUser = User(id = "2", displayName = "(dummy author)",
    email = "", emailNotfPrefs = EmailNotfPrefs.DontReceive, country = "",
    website = "", isAdmin = false, isOwner = false)


  val DummyAuthorIdty = IdentitySimple(id = "2", userId = DummyAuthorUser.id,
    name = "(dummy author)", email = "", location = "", website = "")


  val DummyAuthorLogin = Login(id = "2", prevLoginId = None, ip = "?.?.?.?",
    date = new ju.Date, DummyAuthorIdty.reference)

  val DummyAuthorIdData = UserIdData(
    loginId = Some(DummyAuthorLogin.id),
    userId = DummyAuthorUser.id,
    ip = DummyAuthorLogin.ip,
    browserIdCookie = None,
    browserFingerprint = 0)


  val DummyAuthor = People(
    List(DummyAuthorLogin), List(DummyAuthorIdty), List(DummyAuthorUser))


  private def dummyTitle(texts: Texts) = PostActionDto(
    id = PageParts.TitleId,
    postId = PageParts.TitleId,
    creationDati = new ju.Date,
    userIdData = DummyAuthorIdData,
    payload = PostActionPayload.CreatePost(
      parentPostId = None,
      text = texts.noTitleText,
      markup = Markup.DefaultForPageTitle.id,
      approval = Some(Approval.Preliminary)))


  private def dummyBody(texts: Texts, pageRole: PageRole) = {
    val prototype = dummyTitle(texts)
    prototype.copy(id = PageParts.BodyId, postId = PageParts.BodyId,
      payload = prototype.payload.copy(
        parentPostId = None,
        text = texts.noBodyText,
        markup = Markup.defaultForPageBody(pageRole).id))
  }


  private def dummyConfig(texts: Texts) = {
    val prototype = dummyTitle(texts)
    prototype.copy(id = PageParts.ConfigPostId, postId = PageParts.ConfigPostId,
      payload = prototype.payload.copy(
        parentPostId = None,
        text = texts.configText,
        markup = Markup.Code.id))
  }


  private abstract class Texts {
    def noTitleText: String
    def noBodyText: String
    def configText: String
  }


  private object DefaultTexts extends DefaultTexts


  private class DefaultTexts extends Texts {

    def noTitleText = "New Page Title (click to edit)"

    def noBodyText = i"""
      |Page body.
      |
      |$ClickToEditSelectImprove
      |"""

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
      |Forum description here. What is this forum about?
      |
      |$ClickToEditSelectImprove
      |"""
  }


  private object ForumTexts extends DefaultTexts with ForumBodyText {
    override val noTitleText =
      "New Forum Title (click to edit)"
  }


  private object ForumCategoryTexts extends DefaultTexts with ForumBodyText {
    override val noTitleText =
      "Category Name (click to edit)"

    override val noBodyText = i"""
      |[Replace this first paragraph with a short description of this category.
      |Please keep it short — the text will appear on the category list page.]
      |
      |Here, after the first paragraph, you can add a longer description, with
      |for example category guidelines or rules.
      |
      |Below in the comments section, you can discuss this category. For example,
      |should it be merged with another category? Or should it be split
      |into many categories?
      |"""
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


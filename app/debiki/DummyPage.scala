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
      case PageRole.ForumGroup => ForumGroupTexts
      case PageRole.Forum => ForumTexts
      case PageRole.ForumTopic => ForumTopicTexts
      case PageRole.Code => CodeTexts
      case _ => DefaultTexts
    }

    if (addDummyTitle) pageWithDummies += dummyTitle(texts)
    if (addDummyBody) pageWithDummies += dummyBody(texts, pageRole)
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
    date = new ju.Date, DummyAuthorIdty.reference)


  val DummyAuthor = People(
    List(DummyAuthorLogin), List(DummyAuthorIdty), List(DummyAuthorUser))


  private def dummyTitle(texts: Texts) = PostActionDto(
    id = PageParts.TitleId,
    postId = PageParts.TitleId,
    creationDati = new ju.Date,
    loginId = DummyAuthorLogin.id,
    userId = DummyAuthorUser.id,
    newIp = None,
    payload = PostActionPayload.CreatePost(
      parentPostId = PageParts.TitleId,
      text = texts.noTitleText,
      markup = Markup.DefaultForPageTitle.id,
      approval = Some(Approval.Preliminary)))


  private def dummyBody(texts: Texts, pageRole: PageRole) = {
    val prototype = dummyTitle(texts)
    prototype.copy(id = PageParts.BodyId, postId = PageParts.BodyId,
      payload = prototype.payload.copy(
        parentPostId = PageParts.BodyId,
        text = texts.noBodyText,
        markup = Markup.defaultForPageBody(pageRole).id))
  }


  private def dummyConfig(texts: Texts) = {
    val prototype = dummyTitle(texts)
    prototype.copy(id = PageParts.ConfigPostId, postId = PageParts.ConfigPostId,
      payload = prototype.payload.copy(
        parentPostId = PageParts.ConfigPostId,
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


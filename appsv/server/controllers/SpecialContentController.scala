/**
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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

package controllers

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.EdHttp._
import talkyard.server.{TyContext, TyController}
import talkyard.server.http._
import javax.inject.Inject
import play.api.libs.json.{JsString, JsValue, Json}
import play.api.mvc.{Action, ControllerComponents}



/** Edits special content pages, e.g. a page with a content-license text that
  * is automatically included on the terms-of-use page.
  */
@deprecated("now?", "come up with something better instead?")
class SpecialContentController @Inject()(cc: ControllerComponents, edContext: TyContext)
  extends TyController(cc, edContext) {

  /** If the special content has not yet been edited, returns a default text (depending
    * on the page id). For example, if the forum owner hasn't edited the content license
    * special-content text, then a default content license is returned if you request
    * the contentId = "_tou_content_license" special content (but now year 2016 I just removed it).
    */
  def loadContent(rootPageId: PageId, contentId: PageId): Action[Unit] = GetAction {
        request: GetRequest =>
    if (!request.theUser.isAdmin)
      throwForbidden("DwE55RK0", "Please login as admin")

    val pageId = s"$rootPageId$contentId"
    val anyContent = request.dao.loadSpecialContentPage(pageId)
    val defaultContent = SpecialContentPages.lookup(contentId) getOrElse throwBadReq(
      "DwE77GHE0", s"Bad content id: `$contentId'")

    var json = Json.obj(
      "rootPageId" -> rootPageId,
      "contentId" -> contentId,
      "defaultText" -> defaultContent.text)

    anyContent foreach { content =>
      if (content.text == SpecialContentPages.UseDefaultContentMark) {
        // Let the browser fallback to the default text.
      }
      else {
        json += "anyCustomText" -> JsString(content.text)
      }
    }

    OkSafeJson(json)
  }


  def saveContent: Action[JsValue] = AdminPostJsonAction(maxBytes = MaxPostSizeJsCss) {
        request: JsonPostRequest =>
    val rootPageId = (request.body \ "rootPageId").as[PageId]
    val contentId = (request.body \ "contentId").as[PageId]
    val useDefaultText = (request.body \ "useDefaultText").as[Boolean]
    val anyNewText = (request.body \ "anyCustomText").asOptStringNoneIfBlank

    request.dao.saveSpecialContent(rootPageId, contentId, anyNewText, useDefaultText,
      editorId = request.theUserId)
    Ok
  }

}


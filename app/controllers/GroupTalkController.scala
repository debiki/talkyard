/**
 * Copyright (c) 2015 Kaj Magnus Lindberg
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
import ed.server.{EdContext, EdController}
import ed.server.http._
import javax.inject.Inject
import play.api.mvc._
import play.api.libs.json.{JsString, JsValue}


/** Starts discussions for a group of people: chat channels, or personal messages.
  *
  * Read more about how to build a good message handling system here:
  *   https://meta.discourse.org/t/discourse-as-a-private-email-support-portal/34444
  */
class GroupTalkController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) {


  def sendMessage: Action[JsValue] = PostJsonAction(RateLimits.PostReply, maxBytes = MaxPostSize) {
        request: JsonPostRequest =>
    val body = request.body
    val title = (body \ "title").as[String].trim
    val text = (body \ "text").as[String].trim
    val toUserIds = (body \ "userIds").as[Set[UserId]]
    val sender = request.theUser
    val pageRoleInt = (body \ "pageRole").as[Int]
    val pageRole = PageRole.fromInt(pageRoleInt) getOrElse throwBadRequest(
      "EsE4KGP0W", "No page role specified")

    throwBadRequestIf(!pageRole.isPrivateGroupTalk, "EsE5PK0R", s"Not private group talk: $pageRole")
    throwBadRequestIf(request.isGuest, "EsE6PGKB2", "Guests may not send private messages")
    throwBadRequestIf(title.isEmpty, "EsE2FKUp8", "No message title")
    throwBadRequestIf(text.trim.isEmpty, "EsE5JGU8", "Empty message")
    // Private chat members can be added later, but a formal message starts by clicking "Message"
    // on an about-user dialog or page, so then there'll always be a receiver.
    throwBadRequestIf(toUserIds.isEmpty && pageRole != PageRole.PrivateChat,   // test
      "EsE7GMUW2", "No recipient")
    throwBadRequestIf(toUserIds.size > 5, "EsE3FKT5", "More than 5 recipients") // safest, for now
    throwBadRequestIf(toUserIds contains sender.id, "EsE7UKF2", "Cannot send message to yourself")
    throwEntityTooLargeIf(!sender.isStaff && text.length > MaxPostSizeForAuUsers,
      "EsE9PU0", "Message too long")
    throwForbiddenIf(sender.id == SystemUserId, "EsE4GK8F4",
      "The System user cannot send private messages")

    // Don't follow links inside a chat; chats don't work well with search engines anyway, and
    // higher risk people say/write/link-to weird things, because chats = chatty = less moderated.
    val bodyTextAndHtml = textAndHtmlMaker.forBodyOrComment(text,
      allowClassIdDataAttrs = true, followLinks = false)
    val titleTextAndHtml = textAndHtmlMaker.forTitle(title)

    val pagePath = request.dao.startGroupTalk(
      titleTextAndHtml, bodyTextAndHtml, pageRole, toUserIds, sentByWho = request.who,
      request.spamRelatedStuff)

    OkSafeJson(JsString(pagePath.pageId.getOrDie("DwE5JKY2")))
  }

}

/**
 * Copyright (C) 2012 Kaj Magnus Lindberg (born 1979)
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

package views

import com.debiki.v0._
import debiki.dao.TenantDao
import java.{util => ju}
import Prelude._
import scala.xml.{NodeSeq, Text}


/**
 * Generates HTML for email notifications, e.g. "You have a reply" or
 * "Your comment was approved".
 *
 * 1. Include only one link per notification? Otherwise people will (I guess)
 * not click the link to the actual reply. I'd guess they instead would
 * click the visually *largest* link, e.g. to the page (which would be larger,
 * because the page title is usually fairly long), and then not find
 * the new reply, and feel annoyed. (The new-reply-link highlights
 * the reply, but the page link doest not.)
 *
 * 2. For now, don't bother about the redirect from "/-pageId#..."
 * to the actual page path.
 *
 * COULD remove columns from DW1_NOTFS_PAGE_ACTIONS because now I'm
 * loading the page + comment from here anyway!
 */
case class NotfHtmlRenderer(siteDao: TenantDao, origin: String) {

  import NotfOfPageAction.Type._


  private def pageUrl(notf: NotfOfPageAction) =
    s"$origin/-${notf.pageId}"

  private def postUrl(notf: NotfOfPageAction) =
    s"${pageUrl(notf)}#post-${notf.eventActionId}"


  def render(notfs: Seq[NotfOfPageAction]): NodeSeq = {
    var result = Nil: NodeSeq
    for (notf <- notfs)
      result ++= (notf.eventType match {
        case PersonalReply => personalReply(notf)
        case MyPostApproved => myPostApproved(notf)
      })

    result
  }


  private def personalReply(notf: NotfOfPageAction): NodeSeq = {
    assert(notf.eventType == PersonalReply)

    val page = siteDao.loadPage(notf.pageId) getOrElse {
      return Nil
    }
    val post = page.getPost(notf.eventActionId) getOrElse {
      return Nil
    }
    val markupSource = post.approvedText getOrElse {
      return Nil
    }

    val date = toIso8601Day(post.creationDati)

    // Don't include HTML right now. I do sanitize the HTML, but nevertheless
    // I'm a bit worried that there's any bug that results in XSS attacks,
    // which would then target the user's email account (!).
    //val (html, _) = HtmlPageSerializer._markupTextOf(post, origin)
    val html = Text(markupSource)

    <p>
      You have a reply, <a href={postUrl(notf)}>here</a>, on page <i>{notf.pageTitle}</i>,<br/>
      written by <i>{notf.eventUserDispName}</i>. On {date}, he or she wrote:
    </p>
    <blockquote>{html}</blockquote>
  }


  private def myPostApproved(notf: NotfOfPageAction): NodeSeq = {
    assert(notf.eventType == MyPostApproved)
    <p>
      <a href={postUrl(notf)}>Your post</a> has been approved,<br/>
      on page <i>{notf.pageTitle}</i>.
    </p>
  }

}



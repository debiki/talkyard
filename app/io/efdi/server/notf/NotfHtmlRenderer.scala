/**
 * Copyright (C) 2012-2015 Kaj Magnus Lindberg
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

package io.efdi.server.notf

import com.debiki.core.Prelude._
import com.debiki.core._
import debiki.dao.SiteDao
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
case class NotfHtmlRenderer(siteDao: SiteDao, anyOrigin: Option[String]) {

  /*
  private def pageUrl(notf: NotfOfPageAction): Option[String] =
    anyOrigin map { origin =>
      s"$origin/-${notf.pageId}"
    }*/


  private def postUrl(pageMeta: PageMeta, post: Post): Option[String] =
    pageMeta.embeddingPageUrl match {
      case Some(url) =>
        // Include both topic and comment id, because it's possible to embed
        // many different discussions (topics) on the same page.
        Some(s"$url#debiki-topic-${pageMeta.pageId}-comment-${post.nr}")
      case None =>
        // The page is hosted by Debiki so its url uniquely identifies the topic.
        anyOrigin map { origin =>
          val pageUrl = s"$origin/-${post.pageId}"
          s"$pageUrl#post-${post.nr}"
        }
    }


  def render(notfs: Seq[Notification]): NodeSeq = {
    require(notfs.nonEmpty, "DwE7KYG3")
    siteDao.readOnlyTransaction { transaction =>
      val postIds: Seq[PostId] = notfs flatMap {
        case notf: Notification.NewPost => Some(notf.uniquePostId)
        case _ => None
      }
      val postsById = transaction.loadPostsByUniqueId(postIds)
      val pageIds = postsById.values.map(_.pageId)
      val pageStuffById = siteDao.loadPageStuffById(pageIds, transaction)
      val maxNotificationLength = Notifier.MaxEmailBodyLength / notfs.length
      // Later: do support reply-via-email.
      var result: NodeSeq = <p>(If you want to reply, click the links below — but don't reply to this email.)</p>
      for (notf <- notfs) {
        val anyHtmlNotf = notf match {
          case newPostNotf: Notification.NewPost =>
            postsById.get(newPostNotf.uniquePostId) map { post =>
              val pageTitle = pageStuffById.get(post.pageId).map(_.title).getOrElse(
                "No title [EsM7YKF2]")
              renderNewPostNotf(newPostNotf, post, pageTitle, maxNotificationLength, transaction)
            }
        }
        anyHtmlNotf.foreach(result ++= _)
      }
      result
    }
  }


  private def renderNewPostNotf(notf: Notification.NewPost, post: Post, pageTitle: String,
        maxNotificationLength: Int, transaction: SiteTransaction): NodeSeq = {
    val pageMeta = transaction.loadPageMeta(post.pageId) getOrElse {
      return Nil
    }
    val markupSource = post.approvedSource getOrElse {
      return Nil
    }
    SECURITY ; SHOULD // indicate if is guest's name, so cannot pretend to be any @username.
    val byUserName = transaction.loadUser(notf.byUserId).map(_.usernameOrGuestName) getOrElse
      "(unknown user name)"

    val date = toIso8601Day(post.createdAt)

    COULD // instead add a /-/view-notf?id=... endpoint that redirects to the correct
    // page & post nr, even if the post has been moved to another page. And tells the user if
    // the post was deleted or heavily edited or whatever.
    val url = postUrl(pageMeta, post) getOrElse {
      // Not an embedded discussion, and the site has no canonical host, so we
      // cannot construct any address.
      return Nil
    }

    // Don't include HTML right now. I do sanitize the HTML, but nevertheless
    // I'm a bit worried that there's any bug that results in XSS attacks,
    // which would then target the user's email account (!).
    //val (html, _) = HtmlPageSerializer._markupTextOf(post, origin)
    val ellipsis = (markupSource.length > maxNotificationLength) ? "..." | ""
    val html = Text(markupSource.take(maxNotificationLength) + ellipsis)

    val (whatHappened, dotOrComma, inPostWrittenBy) = notf.notfType match {
      case NotificationType.Message =>
        ("You have been sent a personal message", ",", "from")
      case NotificationType.Mention =>
        ("You have been mentioned", ",", "in a post written by")
      case NotificationType.DirectReply =>
        ("You have a reply", ",", "written by")
      case NotificationType.NewPost =>
        if (post.nr == PageParts.BodyNr)
          ("A new topic has been started", ",", "by")
        else
          ("A new comment has been posted", ",", "by")
      case NotificationType.NewPost =>
        if (post.nr == PageParts.BodyNr)
          ("A topic has been tagged with a tag you're watching", ".", "The topic was written by")
        else
          ("A comment has been tagged with a tag you're watching", ".", "The comment was written by")
    }

    <p>
      { whatHappened }, <a href={url}>here</a>, on page <i>{pageTitle}</i>{dotOrComma}<br/>
      { inPostWrittenBy } <i>{byUserName}</i>. On {date}, he or she wrote:
    </p>
    <blockquote>{html}</blockquote>
  }


  /*
  private def myPostApproved(notf: NotfOfPageAction): NodeSeq = {
    assert(notf.eventType == MyPostApproved)
    val pageMeta = siteDao.loadPageMeta(notf.pageId) getOrElse {
      return Nil
    }
    val url = postUrl(pageMeta, notf) getOrElse {
      // Not an embedded discussion, and the site has no canonical host, so we
      // cannot construct any address.
      return Nil
    }
    <p>
      <a href={url}>Your post</a> has been approved,<br/>
      on page <i>{pageName(pageMeta)}</i>.
    </p>
  }*/

}

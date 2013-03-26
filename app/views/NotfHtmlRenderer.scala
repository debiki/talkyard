/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package views

import com.debiki.v0._
import java.{util => ju}
import Prelude._
import scala.xml.{NodeSeq}


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
 */
case class NotfHtmlRenderer(origin: String) {

  import NotfOfPageAction.Type._


  def pageUrl(notf: NotfOfPageAction) =
    s"$origin/-${notf.pageId}"

  def postUrl(notf: NotfOfPageAction) =
    s"${pageUrl(notf)}#post-${notf.eventActionId}"


  def render(notfs: Seq[NotfOfPageAction]): NodeSeq = {
    (for (notf <- notfs) yield {
      (notf.eventType match {
        case PersonalReply => personalReply(notf)
        case MyPostApproved => myPostApproved(notf)
      })
    })
  }


  def personalReply(notf: NotfOfPageAction) = {
    assert(notf.eventType == PersonalReply)
    <p>
      You have a reply, <a href={postUrl(notf)}>here</a>,<br/>
      on page <i>{notf.pageTitle}</i>,<br/>
      written by <i>{notf.eventUserDispName}</i>.
    </p>
  }


  def myPostApproved(notf: NotfOfPageAction) = {
    assert(notf.eventType == MyPostApproved)
    <p>
      <a href={postUrl(notf)}>Your post</a> has been approved,<br/>
      on page <i>{notf.pageTitle}</i>.
    </p>
  }

}



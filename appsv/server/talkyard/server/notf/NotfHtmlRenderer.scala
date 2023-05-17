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

package talkyard.server.notf

import com.debiki.core.Prelude._
import com.debiki.core._
import debiki.dao.SiteDao
import scala.xml.{NodeSeq, Text}
import NotfHtmlRenderer._


case class RenderNotfsResult(
  html: NodeSeq,
  newRepliesOrMentions: Boolean,
  newMessagesToYou: Boolean,
  newLikeVotes: Boolean,
  newTopics: Boolean,
  newPosts: Boolean,
  newModTasks: Boolean)

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


  def postUrl(pageMeta: PageMeta, post: Post): String =
    pageMeta.embeddingPageUrl match {
      case Some(url) =>
        // If many different discussions (topics) on the same page, would need to include
        // discussion id too (i.e. `${pageMeta.pageId}`)
        s"$url#comment-${post.nr - 1}"  // see [2PAWC0] for 'comment-' instead of 'post-', and for -1
      case None =>
        // The page is hosted by Debiki so its url uniquely identifies the topic.
        val origin = anyOrigin getOrElse siteDao.globals.siteByIdOrigin(siteDao.siteId)
        val pageUrl = s"$origin/-${post.pageId}"
        s"$pageUrl#post-${post.nr}"
    }


  def renderNotfs(notfs: Seq[Notification]): RenderNotfsResult = {
    require(notfs.nonEmpty, "DwE7KYG3")
    siteDao.readTx { tx =>
      val postIds: Seq[PostId] = notfs flatMap {
        case notf: Notification.NewPost => Some(notf.uniquePostId)
        case _ => None
      }
      val postsById = tx.loadPostsByUniqueId(postIds)
      val pageIds = postsById.values.map(_.pageId)
      val pageStuffById = siteDao.loadPageStuffById(pageIds, tx)
      val maxNotificationLength = NotifierActor.MaxEmailBodyLength / notfs.length

      var newRepliesOrMentions = false
      var newMessagesToYou = false
      var newLikeVotes = false
      var newTopics = false
      var newPosts = false
      var newModTasks = false

      var htmlNodes: NodeSeq = NodeSeq.Empty

      for (notf <- notfs) {
        val anyHtmlNotf = notf match {
          case newPostNotf: Notification.NewPost =>
            postsById.get(newPostNotf.uniquePostId) map { post =>
              // If title not yet approved, this notf is to staff, about a new
              // topic for them to approve. It's ok, then, to incl an unapproved title.
              val anyPageStuff = pageStuffById.get(post.pageId)
              val pageTitle = anyPageStuff.flatMap(_.titleMaybeUnapproved).getOrElse(
                    "No title [TyE2S7YKF2]")

              if (notf.tyype == NotfType.NewPostReviewTask) {
                newModTasks = true
              }
              else if (notf.tyype == NotfType.Message) {
                newMessagesToYou = true
              }
              else if (notf.tyype == NotfType.DirectReply
                    || notf.tyype == NotfType.Mention) {
                newRepliesOrMentions = true
              }
              else if (notf.tyype == NotfType.OneLikeVote) {
                newLikeVotes = true
              }
              else if (notf.tyype == NotfType.NewPost
                    || notf.tyype == NotfType.IndirectReply
                    || notf.tyype == NotfType.PostTagged) {
                if (post.isOrigPost) newTopics = true
                else newPosts = true
              }
              else if (notf.tyype == NotfType.Assigned
                    || notf.tyype == NotfType.Unassigned
                    || notf.tyype == NotfType.AssigneesChanged) {
                // Noop.
              }

              renderNewPostNotf(newPostNotf, post, pageTitle, maxNotificationLength, tx)
            }
        }
        anyHtmlNotf.foreach(htmlNodes ++= _)
      }

      if (newRepliesOrMentions || newMessagesToYou || newTopics || newPosts) {
        // (People sometimes reply to the email anyway, in spite of the text below.)
        htmlNodes =
                <p>Do <b>not</b> reply to this email.
                  Click <i>Reply</i> below, instead.</p> ++
                htmlNodes
      }
      else {
        // There're only Like votes and mod tasks — nothing to reply to.
      }

      RenderNotfsResult(htmlNodes,
            newRepliesOrMentions = newRepliesOrMentions,
            newMessagesToYou = newMessagesToYou,
            newLikeVotes = newLikeVotes,
            newTopics = newTopics,
            newPosts = newPosts,
            newModTasks = newModTasks)
    }
  }


  private def renderNewPostNotf(notf: Notification.NewPost, post: Post, pageTitle: St,
        maxNotificationLength: i32, tx: SiteTx): NodeSeq = {
    val pageMeta = tx.loadPageMeta(post.pageId) getOrElse {
      return Nil
    }

    val postText = post.approvedHtmlSanitized.map(htmlText => {
      val doc = org.jsoup.Jsoup.parse(htmlText)
      doc.body().text()
    }) getOrElse {
      if (notf.notfType == NotfType.NewPostReviewTask) {
        post.currentSource
      }
      else {
        // Weird.
        return Nil
      }
    }

    SECURITY ; SHOULD // indicate if is guest's name, so cannot pretend to be any @username.
    val byUserName = tx.loadParticipant(notf.byUserId).map(_.usernameOrGuestName) getOrElse
      "(unknown user name)"

    val date = toIso8601Day(post.createdAt)

    COULD // instead add a /-/view-notf?id=... endpoint that redirects to the correct
    // page & post nr, even if the post has been moved to another page. And tells the user if
    // the post was deleted or heavily edited or whatever.
    val url = postUrl(pageMeta, post)

    // Don't include HTML right now. I do sanitize the HTML, but nevertheless
    // I'm a bit worried that there's any bug that results in XSS attacks,
    // which would then target the user's email account (!).
    //val (html, _) = HtmlPageSerializer._markupTextOf(post, origin)

    // Sometimes a single char expands to many chars, e.g. '"' expands to '&quot;'
    // — take this into account, when truncating the email so it won't get
    // too long for the database. Because sometimes people post JSON snippets
    // (e.g. in a community about software) and then there can be *really*
    // many '"' quotes, making the text almost 2 times longer in one case, look:
    // """
    // I have made a macro:
    // {&quot;command&quot;:{&quot;data&quot;:{&quot;root&quot;:{&quot;
    // _type&quot;:&quot;BlockNode&quot; ...
    // """
    //
    // Later, maybe there're better ways to do this? Escape less (don't need
    // to escape quotes?) or find out the actual length, after html
    // encoding, and don't "extra truncate" unless actually needed?
    // But for now:
    val maxLenBeforeEscapes = maxNotificationLength / "&quot;".length

    val ellipsis = (postText.length > maxLenBeforeEscapes) ? "..." | ""
    val html = Text(postText.take(maxLenBeforeEscapes) + ellipsis)

    // I18N: Email notifications — lots of stuff here to translate.

    var showReplyButton = false
    val (
      whatHappened,
      dotOrComma,
      inPostWrittenBy,
      cssE2eTestClass,
    ) = notf.notfType match {

      case NotfType.Message =>
        showReplyButton = true
        ("You have been sent a personal message", ",", "from", "e_NfEm_DirMsg")
      case NotfType.Mention =>
        showReplyButton = true
        ("You have been mentioned", ",", "in a post written by", "e_NfEm_Mentn")
      case NotfType.DirectReply =>
        showReplyButton = true
        ("You have a reply", ",", "written by", "e_NfEm_Re")
      case NotfType.IndirectReply =>
        showReplyButton = true
        ("A new reply in a thread by you", ",", "written by", "e_NfEm_IndRe")
      case NotfType.NewPost =>
        showReplyButton = true
        if (post.nr == PageParts.BodyNr)
          ("A new topic has been started", ",", "by", "e_NfEm_NwPg")
        else
          ("A new comment has been posted", ",", "by", "e_NfEm_NwPo")
      case NotfType.OneLikeVote =>
        return {
          if (post.nr == PageParts.BodyNr)
            <p class="e_NfEm_PgLikeVt"
              ><i>{byUserName}</i> likes <a href={url} >your topic</a
                >: "<i>{pageTitle}</i>".</p>
          else
            <p class="e_NfEm_PoLikeVt"
              ><i>{byUserName}</i> likes <a href={url}>your reply</a
                >, on page "<i>{pageTitle}</i>".</p>
        }
      case NotfType.Assigned | NotfType.Unassigned =>
        val (assigned: St, to: St, e2eClass: St) =
              if (notf.notfType == NotfType.Assigned) ("assigned", "to", "e_NfEm_Asgd")
              else ("un-assigned", "from", "e_NfEm_0Asgd")
        val aCommentOn =
              if (post.nr == PageParts.BodyNr) ""
              else " a comment on"
        return <p class={e2eClass}
                >You've been {assigned} by <i>{byUserName}</i> {to}{aCommentOn} page <a
                href={url}>"<i>{pageTitle}</i>"</a>.</p>
      case NotfType.AssigneesChanged =>
        UX; SHOULD // list their usernames, if pat may see. [private_pats]
        val (names: St, have: St, assigned: St, to: St) = {
          val assignees: Seq[Pat] = tx.loadParticipants(post.assigneeIds)
          val haveHas = if (assignees.length <= 1) "has" else "have"
          if (assignees.isEmpty) ("Everyone", haveHas, "unassigned", "from")
          else (assignees.map(_.usernameOrGuestName)
                  // UX COULD use ", ... , ... and" instead of only "and",  I18N
                  // but almost never are >= 3 people assigned together?
                  .mkString(" and "), haveHas, "assigned", "to")
        }
        val aCommentOn =
              if (post.nr == PageParts.BodyNr) ""
              else " a comment on"
        return <p class="e_NfEm_AsgsX"
                >{names} {have} been {assigned} by <i>{byUserName}</i
                > {to}{aCommentOn} page <a href={url}>"<i>{pageTitle}</i>"</a>.</p>
      case NotfType.PostTagged =>
        // Skip <blockquote>?
        if (post.nr == PageParts.BodyNr)
          ("A topic has been tagged with a tag you're watching", ".",
            "The topic was written by", "e_NfEm_PgTgd")
        else
          ("A comment has been tagged with a tag you're watching", ".",
            "The comment was written by", "e_NfEm_PoTgd")
      case NotfType.NewPostReviewTask =>
        val itIsShownOrHidden =
          if (post.isSomeVersionApproved)
            "It's been preliminarily approved, and is visible to others"
          else
            "It's currently hidden"
        val what = (post.nr == PageParts.BodyNr) ? "topic" | "reply"
        (s"A new $what for you to review", ".",
          s"$itIsShownOrHidden. It was posted by", "e_NfEm_ModTsk")
    }


    // Email clients apparently add  target="_blank" (rel="noopener")  themselves.

    <p class={cssE2eTestClass}>
      { whatHappened }, <a href={url}>here</a>, on page "<i>{pageTitle}</i>"{dotOrComma}
      { inPostWrittenBy } <i>{byUserName}</i>, on {date}:
    </p>
    <hr/>
    <p style="padding-left: 2em">{
      // Don't wrap this in a <blockquote>. FastMail thinks any <blockquote> is part of
      // some previous email in an email thread, and collapses the quote, one needs to click
      // to open. But the text is the *main* part of the message, shouldn't be collapsed.
      // FastMail is somewhat popular as of 2022-12, so let's care about FastMail.
      // (Gmail doesn't collapse <blockquote>.)
      html
    }</p>
    <hr/>
    <div>{
    if (showReplyButton)
      <a href={url} style={replyBtnStyles} class="e_EmReB" >Reply</a>
    else
      xml.Null
    }</div>
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

object NotfHtmlRenderer {

  UX; COULD // sync reply btn color w CSS; see $uiHue in variables.styl [site_prim_col].
  val replyBtnStyles = o"""
        display: inline-block !important;
        padding: 8px 18px 6px !important;
        margin: 0.3em 0 1.4em !important;
        background: hsl(207, 100%, 56%) !important;
        ${/*
        Gmail maybe doesn't like box-shadow?
        Or it just doesn't like:  rgb(0 0 0 / 55%)
        Anyway, *something* in these styles makes Gmail ignore them ail.
        So let's try with excluding box-shadow, for a start.
        box-shadow: 3px 3px 7px rgba(0, 0, 0, 0.55) !important;
        */ ""}
        color: #fff !important;
        font-weight: bold !important;
        font-size: 16px !important;
        letter-spacing: 0.3px !important;
        text-decoration: none !important;
        cursor: pointer !important;
        """
}

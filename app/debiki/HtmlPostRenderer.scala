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
//import com.twitter.ostrich.stats.Stats
import java.{util => ju, io => jio}
import scala.collection.JavaConversions._
import _root_.scala.xml.{NodeSeq, Node, Elem, Text, XML, Attribute}
import Prelude._
import HtmlUtils._
import HtmlPostRenderer._



case class RenderedPost(
  headAndBodyHtml: Node,
  actionsHtml: Elem)


case class RenderedPostHeader(
  html: NodeSeq)


case class RenderedPostBody(
  html: NodeSeq,
  replyBtnText: NodeSeq)



sealed abstract class ShowUnapproved {
  def shallShow(post: Post): Boolean
}


object ShowUnapproved {

  case object None extends ShowUnapproved {
    override def shallShow(post: Post) = false
  }

  case object All extends ShowUnapproved {
    override def shallShow(post: Post) = true
  }

  case class WrittenByUser(userId: String) extends ShowUnapproved {
    override def shallShow(post: Post) =
      post.userId == userId
  }
}



case class HtmlPostRenderer(
  page: PageParts,
  hostAndPort: String,
  nofollowArticle: Boolean = true,
  showUnapproved: ShowUnapproved = ShowUnapproved.None) {


  def renderPost(postId: ActionId, uncollapse: Boolean = false): RenderedPost = {
    val post = page.getPost(postId) getOrElse
       assErr("DwE209X5", "post id "+ postId +" on page "+ page.id)

    if (post.isTreeDeleted) {
      renderDeletedTree(post)
    }
    else if (post.isTreeCollapsed && !uncollapse) {
      renderCollapsedTree(post)
    }
    else if (post.isPostDeleted) {
      renderDeletedComment(post)
    }
    else if (post.isPostCollapsed && !uncollapse) {
      renderCollapsedComment(post)
    }
    else if (post.id == PageParts.TitleId) {
      val titleHtml = renderPageTitle(post, showUnapproved)
      RenderedPost(titleHtml, actionsHtml = <span></span>)
    }
    else {
      renderPostImpl(post, nofollowArticle)
    }
  }


  private def renderPostImpl(post: Post, nofollowArticle: Boolean): RenderedPost = {
    val multireplyPosts = post.multireplyPostIds.map(page.getPost_! _).toSeq
    val anyMultireplyReceivers = renderMultireplyReceivers(multireplyPosts)
    val postHeader =
      if (post.id == PageParts.BodyId) {
        // Body author and date info rendered separately, for the page body.
        RenderedPostHeader(Nil)
      }
      else {
        renderPostHeader(post)
      }

    val postBody = renderPostBody(post, hostAndPort, nofollowArticle,
      showUnapproved = showUnapproved)

    val anyPendingApprovalText: NodeSeq =
      if (showUnapproved.shallShow(post)) makePendingApprovalText(post)
      else Nil

    val long = false // post.approvedText.length > 10 * 100 // ten lines
    val cutS = if (long) " dw-x-s" else ""
    val cssArtclPost = if (post.id != PageParts.BodyId) "" else " dw-ar-p"

    val commentHtml =
      <div id={htmlIdOf(post)} class={"dw-p" + cssArtclPost + cutS}>{
        anyMultireplyReceivers ++
        anyPendingApprovalText ++
        postHeader.html ++
        postBody.html
      }</div>

    RenderedPost(commentHtml, actionsHtml = renderActionLinks(post))
  }

}



object HtmlPostRenderer {


  private def renderDeletedTree(post: Post): RenderedPost = {
    renderDeletedComment(post, wholeTree = true)
  }


  private def renderDeletedComment(post: Post, wholeTree: Boolean = false): RenderedPost = {
    val deleterUserId =
      if (wholeTree) post.treeDeletedById.get
      else post.postDeletedById.get
    // COULD add itemscope and itemtype attrs, http://schema.org/Comment
    val byWhom =
      if (post.userId == deleterUserId) "comment author"
      else "a moderator"
    val html =
      <div id={htmlIdOf(post)} class='dw-p dw-p-dl'>
        <div class='dw-p-hd'>{
          if (wholeTree) "Thread" else "1 comment" } deleted by { byWhom }{/*
          For now, don't show name of deleter, because then Mallory could choose
           a terribly illegal name that would be shown also after the post had
           been deleted.  by { _linkTo(deleter.user_!)
          COULD include details, shown on click:
            Posted on ...,, rated ... deleted on ..., reasons for deletion: ...
            X flags: ... -- but perhaps better / easier with a View link,
            that opens the deleted post, incl. details, in a new browser tab?  */}
        </div>
      </div>
    RenderedPost(html, actionsHtml = renderActionsForDeleted(post))
  }


  private def renderCollapsedTree(post: Post): RenderedPost = {
    // Include the post id, so Javascript finds the post and inits action links,
    // e.g. links that uncollapses the thread.
    RenderedPost(<div id={htmlIdOf(post)} class="dw-p"></div>,
      actionsHtml = renderActionsForCollapsed(post))
  }


  private def renderCollapsedComment(post: Post): RenderedPost = {
    val html =
      <div id={htmlIdOf(post)} class="dw-p dw-zd">
        <a class="dw-z">Click to show this comment</a>
      </div>
    RenderedPost(html, actionsHtml = renderActionsForCollapsed(post))
  }


  def renderMultireplyReceivers(multireplyPosts: Seq[Post]) = {
    if (multireplyPosts.isEmpty) Nil
    else {
      <div><span class="dw-multireply-prefix">In reply to:</span> {
        multireplyPosts.map({ post =>
          <a href={s"#post-${post.id}"} class="dw-multireply-to">
            <span class="icon-reply dw-mirror"></span>
            <span>{post.theUser.displayName} (post {post.id})</span>
          </a>
        })
      }</div>
    }
  }


  /** Renders a .dw-p-hd tag reading:
    *  "By (author) (date), improved by (editor)."
    */
  def renderPostHeader(post: Post): RenderedPostHeader = {
    def page = post.debate
    val author = post.user_!

    val editInfo =
      // If closed: <span class='dw-p-re-cnt'>{count} replies</span>
      if (post.lastEditAppliedAt.isEmpty) Nil
      else {
        val editorsCount = post.numDistinctEditors
        lazy val editor = page.people.user_!(post.lastEditorId getOrDie "DwE94IR7")
        <span class='dw-p-hd-e'>{
            Text(", improved ") ++
            (if (editorsCount > 1) {
              Text("by ") ++ <a>various people</a>
            } else if (editor.id != author.id) {
              Text("by ") ++ _linkTo(editor)
            } else {
              // Edited by the author. Don't repeat his/her name.
              Nil
            })
          } {dateAbbr(post.textLastEditedAt, "dw-p-at")
        }</span>
      }

    val permalink =
      if (PageParts.isArticleOrConfigPostId(post.id)) scala.xml.Null
      else <a class="dw-p-link">#{post.id}</a>

    val anyPin =
      if (post.pinnedPosition.isEmpty) scala.xml.Null
      else <a class="dw-p-pin icon-pin"></a>

    val cssArticlePostHeader =
      if (post.id == PageParts.BodyId) " dw-ar-p-hd"
      else ""

    val likeVotes = if (post.isArticleOrConfig) Nil else post.numLikeVotes match {
      case 0 => scala.xml.Null
      case 1 => <x>. <a class="dw-num-likes">1 person</a> likes this comment</x>.child
      case x => <x>. <a class="dw-num-likes">{x} people</a> like this comment</x>.child
    }

    var thisComment = if (likeVotes.nonEmpty) "it" else "this comment"

    val isWrongVotes = if (post.isArticleOrConfig) Nil else post.numWrongVotes match {
      case 0 => scala.xml.Null
      case 1 =>
        <x>. <a class="dw-num-wrongs">1 {if (likeVotes.nonEmpty) "" else "person"}</a
          > thinks {thisComment} is wrong</x>.child
      case x =>
        <x>. <a class="dw-num-wrongs">{x} {if (likeVotes.nonEmpty) "" else "people"}</a
          >think {thisComment} is wrong</x>.child
    }

    if (isWrongVotes.nonEmpty) thisComment = "it"

    val offTopicVotes = if (post.isArticleOrConfig) Nil else post.numOffTopicVotes match {
      case 0 => ""
      case 1 =>
        <x>. <a class="dw-num-offtopics">1 person</a> thinks {thisComment} is off-topic</x>.child
      case x =>
        <x>. <a class="dw-num-offtopics">{x} people</a> think {thisComment} is off-topic</x>.child
    }

    val commentHtml =
      <div class={"dw-p-hd" + cssArticlePostHeader}>
        { anyPin }{ permalink }
        By { _linkTo(author)}{ dateAbbr(post.creationDati, "dw-p-at")
        }{ editInfo }{ likeVotes }{ isWrongVotes }{ offTopicVotes }.
      </div>

    RenderedPostHeader(html = commentHtml)
  }


  private def renderPageTitle(titlePost: Post, showUnapproved: ShowUnapproved): Node = {
    // The title is a post, itself.
    // Therefore this XML is almost identical to the XML
    // for the post that this title entitles.
    // In the future, I could make a recursive call to
    // _renderPost, to render the title. Then it would be
    // possible to reply-inline to the title.
    // (Don't wrap the <h1> in a <header>; there's no need to wrap single
    // tags in a <header>.)
      <div id={htmlIdOf(titlePost)} class='dw-p dw-p-ttl'>
        <div class='dw-p-bd'>
          <div class='dw-p-bd-blk'>
            <h1 class='dw-p-ttl'>{
              if (showUnapproved.shallShow(titlePost)) titlePost.currentText
              else titlePost.approvedText getOrElse "(Page title not yet approved)"
            }</h1>
          </div>
        </div>
      </div>
  }


  private def htmlIdOf(post: Post) = s"post-${post.id}"


  private def _linkTo(user: User) = HtmlPageSerializer.linkTo(user)


  private def renderPostBody(post: Post, hostAndPort: String, nofollowArticle: Boolean,
        showUnapproved: ShowUnapproved): RenderedPostBody = {
    val cssArtclBody = if (post.id != PageParts.BodyId) "" else " dw-ar-p-bd"
    val isBody = post.id == PageParts.BodyId
    val xmlTextInclTemplCmds =
      HtmlPageSerializer._markupTextOf(post, hostAndPort, nofollowArticle,
        showUnapproved = showUnapproved)

    // Find any customized reply button text.
    var replyBtnText: NodeSeq = xml.Text("Reply")
    if (isBody) {
      HtmlPageSerializer.findChildrenOfNode(
        withClass = "debiki-0-reply-button-text",
        in = xmlTextInclTemplCmds) foreach { replyBtnText = _ }
    }

    val xmlText: NodeSeq = xmlTextInclTemplCmds // old rename

    val postBodyHtml =
      <div class={"dw-p-bd"+ cssArtclBody}>
        <div class='dw-p-bd-blk'>{ xmlText
          // (Don't  place a .dw-i-ts here. Splitting the -bd into
          // -bd-blks and -i-ts is better done client side, where the
          // heights of stuff is known.)
        }</div>
      </div>

    RenderedPostBody(html = postBodyHtml, replyBtnText = replyBtnText)
  }


  private def renderActionLinks(post: Post): Elem = {

    var moreActionLinks: NodeSeq = Nil
    var suggestionsOld: NodeSeq = Nil
    var suggestionsNew: NodeSeq = Nil

    // ----- Reply and Like and Wrong links

    val replyLikeWrongLinks = {
      if (post.isDeletedSomehow) Nil
      else {
        // They float right, so they're placed in reverse order.
        <a class="dw-a dw-a-wrong icon-warning" title="Click if you think this post is wrong">Wrong</a>
        <a class="dw-a dw-a-like icon-heart" title="Like this">Like</a> ++
        <a class="dw-a dw-a-reply icon-reply">Reply</a>
      }
    }

    // ----- Off-topic link

    moreActionLinks ++=
      <a class="dw-a dw-a-offtopic icon-split" title="Click if you think this post is off-topic"
        >Off-Topic</a>

    /*
    // ----- Flag links
    // No, don't show. The hive mind tendency might cause people to flag just because others
    // have already flagged. Or, if flags are shown, people might use them as downvotes.

    if (post.numFlags > 0) {
      val pendingClass = if (post.numPendingFlags == 0) "" else " dw-a-pending-review"
      val html = <a class={"dw-a dw-a-flag-suggs icon-flag" + pendingClass}
                    title="View flags, e.g. if flagged as spam">×{ post.numFlags }</a>
      if (post.numPendingFlags == 0) suggestionsOld ++= html
      else suggestionsNew ++= html
    }
    */

    moreActionLinks ++= <a class="dw-a dw-a-flag icon-flag">Report</a>

    // ----- Pin link

    moreActionLinks ++= <a class="dw-a dw-a-pin icon-pin">Pin</a>

    // ----- Edit suggestions

    if (post.numPendingEditSuggestions > 0)
      suggestionsNew ++= <a class="dw-a dw-a-edit icon-edit dw-a-pending-review"
           title="View edit suggestions">×{post.numPendingEditSuggestions}</a>

    // ----- Collapse links

    suggestionsNew ++= renderUncollapseSuggestions(post)

    if (!post.isPostCollapsed && post.numCollapsePostVotesPro > 0)
      suggestionsNew ++=
        <a class="dw-a dw-a-collapse-suggs icon-collapse-post dw-a-pending-review"
          title="Vote for or against collapsing this comment">×{
            post.numCollapsePostVotesPro}–{post.numCollapsePostVotesCon}</a>

    if (!post.isTreeCollapsed && post.numCollapseTreeVotesPro > 0)
      suggestionsNew ++=
        <a class="dw-a dw-a-collapse-suggs icon-collapse-tree dw-a-pending-review"
          title="Vote for or against collapsing this whole thread">×{
            post.numCollapseTreeVotesPro}–{post.numCollapseTreeVotesCon}</a>

    // People should upvote any already existing suggestion, not create
    // new ones, so don't include any action link for creating a new suggestion,
    // if there is one already. Instead, show a link you can click to upvote
    // the existing suggestion:

    if (!post.isTreeCollapsed && post.numCollapseTreeVotesPro == 0)
      moreActionLinks ++= <a class="dw-a dw-a-collapse-tree icon-collapse">Collapse tree</a>

    if (!post.isPostCollapsed && post.numCollapsePostVotesPro == 0)
      moreActionLinks ++= <a class="dw-a dw-a-collapse-post icon-collapse">Collapse post</a>

    if (post.isTreeCollapsed && post.numUncollapseTreeVotesPro == 0)
      moreActionLinks ++= <a class="dw-a dw-a-uncollapse-tree">Uncollapse tree</a>

    if (post.isPostCollapsed && post.numUncollapsePostVotesPro == 0)
      moreActionLinks ++= <a class="dw-a dw-a-uncollapse-post">Uncollapse post</a>

    // ----- Close links

    if (post.isTreeClosed)
      moreActionLinks ++= <a class="dw-a dw-a-reopen-tree">Reopen</a>
    else
      moreActionLinks ++= <a class="dw-a dw-a-close-tree icon-archive">Close</a>

    // ----- Move links

    // ? <a class="dw-a dw-a-move">Move</a>

    // ----- Delete links

    if (!post.isPostDeleted && post.numDeletePostVotesPro > 0)
      suggestionsNew ++= <a class="dw-a dw-a-delete-suggs icon-delete-post dw-a-pending-review"
          title="Vote for or against deleting this comment">×{
            post.numDeletePostVotesPro }–{ post.numDeletePostVotesCon }</a>

    if (!post.isTreeDeleted && post.numDeleteTreeVotesPro > 0)
      suggestionsNew ++= <a class="dw-a dw-a-delete-suggs icon-delete-tree dw-a-pending-review"
          title="Vote for or against deleting this whole thread">×{
            post.numDeleteTreeVotesPro }–{ post.numDeleteTreeVotesCon }</a>

    if (post.numDeleteTreeVotesPro == 0 || post.numDeletePostVotesPro == 0)
      moreActionLinks ++= <a class="dw-a dw-a-delete icon-trash">Delete</a>


    def moreDropdown =
      // '.navbar-right' prevents the dropdown from overflowing to the right.
      <span class="dropdown navbar-right dw-a">
        <a class="dw-a-more" data-toggle="dropdown" data-target="#">More</a>
        <div class="dropdown-menu dw-p-as-more">
          { moreActionLinks }
        </div>
      </span>

    // Everything floats right. New not-yet-decided-on suggestions are always
    // visible, and are hence placed to the very right (they need to appear first in
    // the list below). Old suggestions are only shown when you hover the post with
    // the mouse (so as not to clutter the GUI) (ignore touch devices for now),
    // and are thus placed to the left of the new not-yet-decided-on suggestions.
    <div class="dw-p-as dw-as">{
      // Things float right, so they're placed in reverse order.
      }{ suggestionsNew
      }{ suggestionsOld
      }{ moreDropdown
      }{ replyLikeWrongLinks
    }</div>
  }

  private def renderActionsForCollapsed(post: Post): Elem = {
    // Only show suggestions — don't show actions until the reader has
    // opened the comment and had a chance to read it.
    <div class="dw-p-as dw-as">
      { renderUncollapseSuggestions(post) }
    </div>
  }


  private def renderActionsForDeleted(post: Post): Elem = {
    <div class="dw-p-as dw-as"></div> // for now
  }


  private def renderUncollapseSuggestions(post: Post): NodeSeq = {
    var suggestions: NodeSeq = Nil
    if (post.isTreeCollapsed) {
      if (post.numUncollapseTreeVotesPro > 0)
        suggestions ++=
          <a class="dw-a dw-a-uncollapse-tree-suggs dw-a-pending-review"
                >Uncollapse × {post.numUncollapseTreeVotesPro} – {
              post.numUncollapseTreeVotesCon }</a>
    }
    else if (post.isPostCollapsed) {
      // Only show these uncollapse-post actions if the whole *tree* is not already
      // collapsed (if it is, the post itself isn't visible at all).
      if (post.numUncollapsePostVotesPro > 0)
        suggestions ++=
          <a class="dw-a dw-a-uncollapse-post-suggs dw-a-pending-review"
            >Uncollapse × {post.numUncollapsePostVotesPro} – {
              post.numUncollapsePostVotesCon
            }</a>
    }

    suggestions
  }


  private def makePendingApprovalText(post: Post): NodeSeq = {
    if (post.currentVersionApproved)
      return Nil

    val text =
      if (post.someVersionApproved) {
        if (post.currentVersionRejected) {
          "Edits rejected: a moderator refused to approve the edits."
        }
        else {
          "Edits pending approval."
        }
      }
      else {
        // 1. This must be a new (possibly edited) comment, or a new page, since no
        // previous version has been approved.
        // 2. Use the word "Text" not "Comment" because this might be a page title
        // or a blog post article (need not be a comment).
        if (post.currentVersionRejected) {
          "Text rejected: a moderator refused to approve it."
        }
        else {
          "Text pending approval."
        }
      }

    <div class="dw-p-pending-mod">{text}</div>
  }

}


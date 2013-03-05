/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0._
//import com.twitter.ostrich.stats.Stats
import java.{util => ju, io => jio}
import scala.collection.JavaConversions._
import _root_.scala.xml.{NodeSeq, Node, Elem, Text, XML, Attribute}
import FlagReason.FlagReason
import Prelude._
import HtmlUtils._
import HtmlPostRenderer._



case class RenderedPost(
  html: Node,
  replyBtnText: NodeSeq,
  topRatingsText: Option[String])


case class RenderedPostHeader(
  html: NodeSeq,
  topRatingsText: Option[String])


case class RenderedPostBody(
  html: NodeSeq,
  approxLineCount: Int,
  replyBtnText: NodeSeq)



case class HtmlPostRenderer(
  page: Debate,
  pageStats: PageStats,
  hostAndPort: String) {


  def renderPost(postId: String, uncollapse: Boolean = false): RenderedPost = {
    val post = page.vipo(postId) getOrElse
       assErr("DwE209X5", "post id "+ postId +" on page "+ page.id)

    if (post.isTreeDeleted) {
      renderDeletedTree(post)
    }
    else if (post.isTreeCollapsed && !uncollapse) {
      renderCollapsedTree(post)
    }
    else if (post.isDeleted) {
      renderDeletedComment(post)
    }
    else if (post.isOnlyPostCollapsed && !uncollapse) {
      renderCollapsedComment(post)
    }
    else if (post.id == Page.TitleId) {
      val titleHtml = renderPageTitle(post)
      RenderedPost(titleHtml, replyBtnText = Nil,
        topRatingsText = None)
    }
    else {
      renderPostImpl(post)
    }
  }


  private def renderPostImpl(post: Post): RenderedPost = {
    val postHeader =
      if (post.id == Page.BodyId) {
        // Body author and date info rendered separately, for the page body.
        RenderedPostHeader(Nil, None)
      }
      else {
        renderPostHeader(post, Some(pageStats))
      }

    val postBody = renderPostBody(post, hostAndPort)

    val long = postBody.approxLineCount > 9
    val cutS = if (long) " dw-x-s" else ""

    val cssArtclPost = if (post.id != Page.BodyId) "" else " dw-ar-p"
    val commentHtml =
      <div id={htmlIdOf(post)} class={"dw-p" + cssArtclPost + cutS}>{
        postHeader.html ++
        postBody.html
      }</div>

    RenderedPost(html = commentHtml, replyBtnText = postBody.replyBtnText,
      topRatingsText = postHeader.topRatingsText)
  }

}



object HtmlPostRenderer {


  def renderDeletedTree(post: Post): RenderedPost = {
    renderDeletedComment(post, wholeTree = true)
  }


  def renderDeletedComment(post: Post, wholeTree: Boolean = false): RenderedPost = {
    val page = post.debate
    val deletion = post.firstDelete.get
    val deleter = page.people.authorOf_!(deletion)
    // COULD add itemscope and itemtype attrs, http://schema.org/Comment
    val html =
      <div id={htmlIdOf(post)} class='dw-p dw-p-dl'>
        <div class='dw-p-hd'>{
          if (wholeTree) "Thread" else "1 comment"
          } deleted by { _linkTo(deleter)
          /* COULD show flagsTop, e.g. "flagged spam".
            COULD include details, shown on click:
            Posted on ...,, rated ... deleted on ..., reasons for deletion: ...
            X flags: ... -- but perhaps better / easier with a View link,
            that opens the deleted post, incl. details, in a new browser tab?  */}
        </div>
      </div>
    RenderedPost(html, replyBtnText = Nil, topRatingsText = None)
  }


  def renderCollapsedTree(post: Post): RenderedPost = {
    // Include the post id, so Javascript finds the post and inits action links,
    // e.g. links that uncollapses the thread.
    RenderedPost(<div id={htmlIdOf(post)} class="dw-p"></div>, Nil, None)
  }


  def renderCollapsedComment(post: Post): RenderedPost = {
    val html =
      <div id={htmlIdOf(post)} class="dw-p dw-zd">
        <a class="dw-z">Click to show this comment</a>
      </div>
    RenderedPost(html, replyBtnText = Nil, topRatingsText = None)
  }


  /**
   * Renders a .dw-p-hd tag reading:
   *  "By (author) (date), improved by (editor)
   *    Flagged (top flags) Rated (top ratings)"
   * If anyPageStats is None, skips "Flagged ... Rated ..." statistics/info.
   */
  def renderPostHeader(post: Post, anyPageStats: Option[PageStats])
        : RenderedPostHeader = {
    if (post.loginId == DummyPage.DummyAuthorLogin.id)
      return RenderedPostHeader(Nil, None)

    def page = post.debate
    val editsApplied: List[Patch] = post.editsAppliedDescTime
    val lastEditApplied = editsApplied.headOption
    val author = page.people.authorOf_!(post.post)

    val (flagsTop: NodeSeq, flagsDetails: NodeSeq) =
      if (anyPageStats.isDefined) renderFlags(post)
      else (Nil: NodeSeq, Nil: NodeSeq)

    val (topTagsAsText: Option[String],
        ratingTagsTop: NodeSeq,
        ratingTagsDetails: NodeSeq) =
      if (anyPageStats.isDefined) renderRatings(post, anyPageStats.get)
      else (None, Nil: NodeSeq, Nil: NodeSeq)

    val editInfo =
      // If closed: <span class='dw-p-re-cnt'>{count} replies</span>
      if (editsApplied.isEmpty) Nil
      else {
        val lastEditDate = post.modificationDati
        // ((This identity count doesn't take into account that a user
        // can have many identities, e.g. Twitter, Facebook and Gmail. So
        // even if many different *identities* have edited the post,
        // perhaps only one single actual *user* has edited it. Cannot easily
        // compare users though, because IdentitySimple maps to no user!))
        val editorsCount =
          editsApplied.map(edAp => page.vied_!(edAp.id).identity_!.id).
          distinct.length
        lazy val editor =
          page.people.authorOf_!(page.editsById(lastEditApplied.get.id))
        <span class='dw-p-hd-e'>{
            Text(", improved ") ++
            (if (editorsCount > 1) {
              Text("by ") ++ <a>various people</a>
            } else if (editor.identity_!.id != author.identity_!.id) {
              Text("by ") ++ _linkTo(editor)
            } else {
              // Edited by the author. Don't repeat his/her name.
              Nil
            })
          }{dateAbbr(lastEditDate, "dw-p-at")}
        </span>
      }

    val cssArticlePostHeader =
      if (post.id == Page.BodyId) " dw-ar-p-hd"
      else ""

    val commentHtml =
      <div class={"dw-p-hd" + cssArticlePostHeader}>
        By { _linkTo(author)}{ dateAbbr(post.creationDati, "dw-p-at")
        }{ flagsTop }{ ratingTagsTop }{ editInfo }{ flagsDetails
        }{ ratingTagsDetails }
      </div>

    RenderedPostHeader(html = commentHtml, topRatingsText = topTagsAsText)
  }


  private def renderFlags(post: Post): (NodeSeq, NodeSeq) = {
    if (post.flags isEmpty)
      return (Nil: NodeSeq, Nil: NodeSeq)

    import HtmlForms.FlagForm.prettify
    val mtime = toIso8601T(post.lastFlag.get.ctime)
    val fbr = post.flagsByReasonSorted

    val topFlags =
      <span class='dw-p-flgs-top'>, flagged <em>{
        prettify(fbr.head._1).toLowerCase
      }</em></span>

    val allFlagListItems =
      for ((r: FlagReason, fs: List[Flag]) <- fbr) yield
        <li class="dw-flg">{
          // The `×' is the multiplication sign, "\u00D7".
          prettify(r).toLowerCase +" × "+ fs.length.toString
        } </li>

    val allFlags =
      <div class='dw-p-flgs-all' data-mtime={mtime}>{
        post.flags.length } flags: <ol class='dw-flgs'>{
          allFlagListItems
        }</ol>
      </div>

    (topFlags, allFlags)
  }


  private def renderRatings(post: Post, pageStats: PageStats) = {
    val postRatingStats: PostRatingStats = pageStats.ratingStatsFor(post.id)
    // Sort the rating tags by their observed fittingness, descending
    // (the most popular tags first).
    val tagStatsSorted = postRatingStats.tagStats.toList.sortBy(
        -_._2.fitness.observedMean)
    val topTags = if (tagStatsSorted isEmpty) Nil else {
      // If there're any really popular tags ([the lower confidence limit on
      // the probability that they're used] is > 0.4),
      // show all those. Otherwise, show only the most popular tag(s).
      // (Oops, need not be `max' -- they're sorted by the *measured* prob,
      // not the lower conf limit -- well, hardly matters.)
      val maxLowerConfLimit = tagStatsSorted.head._2.fitness.lowerLimit
      val minLower = math.min(0.4, maxLowerConfLimit)
      tagStatsSorted.takeWhile(_._2.fitness.lowerLimit >= minLower)
    }

    val topTagsAsText: Option[String] = {
      def showRating(tagAndStats: Pair[String, TagStats]): String = {
        val tagName = tagAndStats._1
        val tagFitness = tagAndStats._2.fitness
        // A rating tag like "important!!" means "really important", many
        // people agree. And "important?" means "perhaps somewhat important",
        // some people agree.
        // COULD reduce font-size of ? to 85%, it's too conspicuous.
        val mark =
          if (tagFitness.lowerLimit > 0.9) "!!"
          else if (tagFitness.lowerLimit > 0.7) "!"
          else if (tagFitness.lowerLimit > 0.3) ""
          else "?"
        tagName + mark
        // COULD reduce font size of mark to 85%, or it clutters the ratings.
      }
      if (topTags isEmpty) None
      else Some(topTags.take(3).map(showRating(_)).mkString(", "))
    }

    val (ratingTagsTop: NodeSeq, ratingTagsDetails: NodeSeq) = {
      val rats = tagStatsSorted
      if (rats.isEmpty) (Nil: NodeSeq, Nil: NodeSeq)
      else {
        // List popular rating tags. Then all tags and their usage percents,
        // but those details are shown only if one clicks the post header.
        val topTagsAsHtml =
          if (topTagsAsText isEmpty) Nil
          else <span class='dw-p-r dw-p-r-top'>, rated <em>{
            topTagsAsText.get}</em></span>

        val tagDetails = <div class='dw-p-r-all'
             data-mtime={toIso8601T(postRatingStats.lastRatingDate)}>{
          postRatingStats.ratingCountUntrusty} ratings:
          <ol class='dw-p-r dw-rs'>{
          // Don't change whitespace, or `editInfo' perhaps won't
          // be able to append a ',' with no whitespace in front.
          for ((tagName: String, tagStats: TagStats) <- rats) yield
          <li class="dw-r" data-stats={
              ("lo: %.0f" format (100 * tagStats.fitness.lowerLimit)) +"%, "+
              "sum: "+ tagStats.countWeighted}> {
            tagName +" %.0f" format (
               100 * tagStats.fitness.observedMean)}% </li>
        }</ol></div>

        (topTagsAsHtml, tagDetails)
      }
    }

    (topTagsAsText, ratingTagsTop, ratingTagsDetails)
  }


  def renderPageTitle(titlePost: Post): Node = {
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
            <h1 class='dw-p-ttl'>{titlePost.text}</h1>
          </div>
        </div>
      </div>
  }


  def htmlIdOf(post: Post) = s"post-${post.id}"


  def _linkTo(nilo: NiLo) = HtmlPageSerializer.linkTo(nilo)


  def renderPostBody(post: Post, hostAndPort: String): RenderedPostBody = {
    val cssArtclBody = if (post.id != Page.BodyId) "" else " dw-ar-p-bd"
    val isBodyOrArtclQstn = post.id == Page.BodyId // || post.meta.isArticleQuestion
    val (xmlTextInclTemplCmds, approxLineCount) =
      HtmlPageSerializer._markupTextOf(post, hostAndPort)

    // Find any customized reply button text.
    var replyBtnText: NodeSeq = xml.Text("Reply")
    if (isBodyOrArtclQstn) {
      HtmlPageSerializer.findChildrenOfNode(
        withClass = "debiki-0-reply-button-text",
        in = xmlTextInclTemplCmds) foreach { replyBtnText = _ }
    }

    val xmlText: NodeSeq = xmlTextInclTemplCmds // old rename
    //if (!isRootOrArtclQstn) (Nil, xmlTextInclTemplCmds)
    //else partitionChildsWithDataAttrs(in = xmlTextInclTemplCmds)

    val postBodyHtml =
      <div class={"dw-p-bd"+ cssArtclBody}>
        <div class='dw-p-bd-blk'>{ xmlText
          // (Don't  place a .dw-i-ts here. Splitting the -bd into
          // -bd-blks and -i-ts is better done client side, where the
          // heights of stuff is known.)
        }</div>
      </div>

    RenderedPostBody(html = postBodyHtml, approxLineCount = approxLineCount,
      replyBtnText = replyBtnText)
  }
}


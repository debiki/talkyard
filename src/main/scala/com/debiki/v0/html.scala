// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package com.debiki.v0

import java.{util => ju, io => jio}
import scala.collection.JavaConversions._
import collection.{mutable => mut, immutable => imm}
import _root_.net.liftweb.common.{Box, Full, Empty, EmptyBox, Failure}
import _root_.net.liftweb.util.ControlHelpers.tryo
import _root_.scala.xml.{NodeSeq, Node, Elem, Text, XML, Attribute}
import FlagReason.FlagReason
import Prelude._


abstract class HtmlConfig {
  def termsOfUseUrl: String

  // If a form action is the empty string, the browser POSTS to the current
  // page, says the URI spec: http://www.apps.ietf.org/rfc/rfc3986.html#sec-5.4
  // COULD rename replyAction -> replyUrl (or reactUrl -> reactAction).
  def replyAction = "?reply"
  def rateAction = "?rate"
  def flagAction = "?flag"
  def loginActionSimple = ""
  def loginActionOpenId = ""
  def loginOkAction = ""
  def loginFailedAction = ""
  def logoutAction = ""

  /** A function from debate-id and post-id to a react URL.
   */
  def reactUrl(debateId: String, postId: String) = "?act="+ postId

  /** Constructs a URL to more info on a certain user,
   *  adds "http://" if needed.
   */
  def userUrl(nilo: NiLo) = {
    "" // for now, since OpenID users cannot specify url, fix ...
    /*
    // Lift-Web or Java? escapes cookie values, so unescape `://'.
    // Scala 1.9? val ws = user.website.replaceAllLiterally("%3A%2F%2F", "://")
    val ws = user.website.replaceAll("%3A%2F%2F", "://")
    if (ws isEmpty) {
      ""
    } else if (ws.startsWith("http://") ||
                ws.startsWith("https://")) {
      ws
    } else {
      "http://"+ ws
    } */
  }

  /** Whether or not to show edit suggestions. */
  def showEdits_? = false  // doesn't work at all right now
  def hostAndPort = "localhost"

}


object DebateHtml {

  def apply(debate: Debate, pageTrust: PageTrust) =
    new DebateHtml(debate, pageTrust)

  /** Converts text to xml, returns (html, approx-line-count).
   *
   * Splits into <p>:s and <br>:s at newlines, does nothing else.
   */
  private[v0]
  def textToHtml(text: String, charsPerLine: Int = 80)
      : Tuple2[NodeSeq, Int] = {
    var lineCount = 0
    val xml =
      // Two newlines end a paragraph.
      for (para <- text.split("\n\n").toList)
      yield {
        // One newline results in a row break.
        val lines = para.split("\n").zipWithIndex.flatMap(lineAndIndex => {
          lineCount += 1 + lineAndIndex._1.length / charsPerLine
          if (lineAndIndex._2 == 0) Text(lineAndIndex._1)
          else <br/> ++ Text(lineAndIndex._1)
        })
        <p>{lines}</p>
      }
    (xml, lineCount)
  }

  private[v0]
  def ifThen(condition: Boolean, html: NodeSeq): NodeSeq =
    if (condition) html else Nil

  // COULD move Showdown to markup.scala
  // COULD compile javascripts, see:
  // http://www.java2s.com/Code/Java/JDK-6/WorkingwithCompilableScripts.htm
  // http://javasourcecode.org/html/open-source/jdk/jdk-6u23/
  //                  com/sun/script/javascript/RhinoCompiledScript.html
  // http://www.javalobby.org/java/forums/t87870.html

  // A markdown parser, in JavaScript, namely Showdown.
  private val _jsShowdown = new javax.script.ScriptEngineManager()
        .getEngineByName("js")
  private def _showdown = toserve.DebikiCoreResourceBase.getClass
        .getResourceAsStream("js/wmd/showdown.js")
  _jsShowdown.eval(new jio.InputStreamReader(_showdown))

  // A html sanitizer, in JavaScript, from google-caja.
  // Should move it to a separate module.
  // -----
  private val _jsSanitizer = new javax.script.ScriptEngineManager()
        .getEngineByName("js")
  private def _cajaSanitizer = toserve.DebikiCoreResourceBase.getClass
        .getResourceAsStream("js/html-sanitizer-minified.js")
  _jsSanitizer.eval(new jio.InputStreamReader(_cajaSanitizer))

  // Configure the sanitizer.
  // 1. html-sanitizer.js's function sanitizeAttribs by default allows
  // only the http/https/mailto URI schemes, and relative URLs
  // (but not e.g. `javascript:'). This is reasonably safe?
  // Could prevent URLS with any '?' though.
  // 2. sanitizeAttribs by default allows all id and class attributes.
  // We don't want anyone to be able to use the .dw-* classes/ids though,
  // so filter them out. Allow `debiki-' though, that's the public CSS API.
  _jsSanitizer.eval("""
      |function uriPolicy(url) {
      |  return url;
      |}
      |function classAndIdPolicy(token) {
      |  return /^dw-/.test(token) ? '' : token;
      |}
      |""".stripMargin)
  private val _jsUrlX = _jsSanitizer.get("uriPolicy")
  private val _jsIdX = _jsSanitizer.get("classAndIdPolicy")
  // -----

  /** Converts markdown to xml.
   */
  def markdownToSafeHtml(source: String, hostAndPort: String): NodeSeq = {
    val htmlTextUnsafe = _jsShowdown.asInstanceOf[javax.script.Invocable]
          .invokeMethod(_jsShowdown.eval("new Showdown.converter()"),
          "makeHtml", source, hostAndPort).toString
    sanitizeHtml(htmlTextUnsafe)
  }

  def sanitizeHtml(htmlTextUnsafe: String): NodeSeq = {
    var htmlTextSafe = _jsSanitizer.asInstanceOf[javax.script.Invocable]
          .invokeFunction("html_sanitize", htmlTextUnsafe, _jsUrlX, _jsIdX)
          .toString

    // As of 2011-08-18 the sanitizer strips target='_blank',
    // (Seems to be a bug:
    // `Issue 1296: target="_blank" is allowed, but cleared by html_sanitize()'
    // http://code.google.com/p/google-caja/issues/detail?id=1296  )
    // Add target _blank here, and also make the links nofollow,
    // so Google won't wipe out my site in case someone posts spam.
    htmlTextSafe = htmlTextSafe.replace("<a ",
          "<a target='_blank' rel='nofollow' ")

    // Use a HTML5 parser; html_sanitize outputs HTML5, which Scala's XML
    // parser don't understand (e.g. an <img src=…> tag with no </img>).
    // Lift-Web uses a certain nu.validator HTML5 parser; use it.
    // (html_sanitize, from Google Caja, also uses the very same parser.
    // So html_sanitize probably generates html that Lift-Web's version
    // of the nu.validator parser understands.)
    // Wrap the html text in a dummy tag to avoid a SAXParseException.
    net.liftweb.util.Html5.parse("<div>"+ htmlTextSafe +"</div>").open_!.child
  }

  /** Replaces spaces with the Unicode representation of non-breaking space,
   *  which is interpreted as {@code &nbsp;} by Web browsers.
   */
  private[v0]
  def spaceToNbsp(text: String): String = text.replace(' ', '\u00a0')

  private[v0]
  def dateAbbr(date: ju.Date, cssClass: String): NodeSeq = {
    val dateStr = toIso8601(date)
    <abbr class={"dw-date "+ cssClass} title={toIso8601T(dateStr)}>, {
      dateStr}</abbr>
  }

  /** Shows a link to the user represented by NiLo.
   */
  def linkTo(nilo: NiLo, config: HtmlConfig): NodeSeq = {
    var url = config.userUrl(nilo)
    // TODO: investigate: `url' is sometimes the email address!!
    // When signed in @gmail.com, it seems.
    // For now: (this is actually a good test anyway, in case someone
    // accidentally enters his email in the website field?)
    if (url.contains('@') || url.containsSlice("%40")) {
      System.err.println(
        "URL contains email? It contains `@' or `%40': "+ url)
      url = ""
    }
    val nameElem: NodeSeq = nilo.identity_! match {
      case s: IdentitySimple =>
        // Indicate that the user was not logged in, that we're not sure
        // about his/her identity, by appending "??". If however s/he
        // provided an email address then only append one "?", because
        // other people probaably don't know what is it, so it's harder
        // for them people to impersonate her.
        // (Well, at least if I some day in some way indicate that two
        // persons with the same name actually have different emails.)
        xml.Text(nilo.displayName) ++
            <span class='dw-lg-t-spl'>{
              if (s.email isEmpty) "??" else "?"}</span>
      case _ => xml.Text(nilo.displayName)
    }
    val userLink = if (url nonEmpty) {
      <a class='dw-p-by' href={url} data-dw-u-id={nilo.user_!.id}
         rel='nofollow' target='_blank'>{nameElem}</a>
    } else {
      <span class='dw-p-by' data-dw-u-id={nilo.user_!.id}>{nameElem}</span>
    }
    userLink
  }

  /** XML for the user name and login/out links.
   */
  def loginInfo(userName: Option[String]): NodeSeq = {
    // COULD remove the "&nbsp;&nbsp;|&nbsp;&nbsp;" (below) from the link,
    // but then it'd always be visible, as of right now.
    <span id='dw-u-info'>
      <span class='dw-u-name'>{userName.getOrElse("")}</span>
    </span>
    <span class='dw-u-lgi-lgo'>
      <a id='dw-a-login'>Logga in</a>
      <a id='dw-a-logout'>Logga ut</a>
    </span>
  }

  /** A <style> that hides comments,
   *  and a <script> that shows them on click.
   *  COULD change this to a CSS class one adds to the <body>?
   */
  val tagsThatHideShowInteractions = (
    <script type="text/javascript">
    jQuery(document).ready(function($) {{
      Debiki.v0.showInteractionsOnClick();
    }});
    </script>
  )

  private def _attrEq(name: String, value: String)(node: Node) =
    node.attribute(name).filter(_.text == value).isDefined

  def findChildrenOfNode(withClass: String, in: NodeSeq): Option[NodeSeq] =
    (in \\ "_").filter(_attrEq("class", withClass)).
        headOption.map(_.child)

}


class DebateHtml(val debate: Debate, val pageTrust: PageTrust) {

  import DebateHtml._

  private var config: HtmlConfig = _  // COULD let be a ctor param

  private lazy val pageStats = new PageStats(debate, pageTrust)

  private def lastChange: Option[String] =
    debate.lastChangeDate.map(toIso8601(_))

  def configure(conf: HtmlConfig): DebateHtml = {
    this.config = conf
    this
  }


  /** The results from layoutPosts doesn't depend on who the user is
   *  and can thus be cached.
   */
  def layoutPage(pageRoot: PageRoot): NodeSeq = {

    val cssArtclThread =
      if (pageRoot.id == Page.BodyId) " dw-ar-t" else ""
    val rootPostsReplies = pageRoot.findChildrenIn(debate)
    val rootPost: ViPo = pageRoot.findOrCreatePostIn(debate) getOrElse {
      return (
        <div id={debate.guid}>
          <div>Not found: {pageRoot.id}.</div>
        </div>)
    }

    // (The root thread, .dw-depth-0, floats left, so clearfix its parent
    // <div>, otherwise any <footer> margin-top will have no effect.)
    val cssThreadId = "dw-t-"+ rootPost.id
    <div id={debate.guid} class="debiki dw-debate ui-helper-clearfix">
      <div class="dw-debate-info">{
        if (lastChange isDefined) {
          <p class="dw-last-changed">Last changed on
          <abbr class="dw-date"
                title={toIso8601T(lastChange.get)}>{lastChange.get}</abbr>
          </p>
        }
      }
      </div>
      <div id={cssThreadId}
           class={"dw-t"+ cssArtclThread +" dw-depth-0 dw-hor"}>
      {
        val renderedComment = _showComment(
          rootPost.id, rootPost, horizontal = true)
        val replyBtn = _replyBtnListItem(renderedComment.replyBtnText)
        renderedComment.html ++
        <div class='dw-t-vspace'/>
        <ol class='dw-res ui-helper-clearfix'>{
          _layoutComments(rootPost.id, 1, replyBtn, rootPostsReplies)
        }
        </ol>
      }
      </div>
    </div>
  }

  private def _replyBtnListItem(replyBtnText: NodeSeq): NodeSeq = {
    // Don't show the Rate and Flag buttons. An article-question
    // cannot be rated/flaged separately (instead, you flag the
    // article).
    <li class='dw-hor-a dw-p-as dw-as'>{/* COULD remove! dw-hor-a */}
      <a class='dw-a dw-a-reply'>{replyBtnText}</a>{/*
      COULD remove More... and Edits, later when article questions
      are merged into the root post, so that there's only one Post
      to edit (but >= 1 posts are created when the page is
      rendered) */}
      <a class='dw-a dw-a-more'>More...</a>
      <a class='dw-a dw-a-edit'>Edits</a>
    </li>
  }

  private def _layoutComments(rootPostId: String, depth: Int,
                              parentReplyBtn: NodeSeq,
                              posts: List[Post]): NodeSeq = {
    // COULD let this function return Nil if posts.isEmpty, and otherwise
    // wrap any posts in <ol>:s, with .dw-ts or .dw-i-ts CSS classes
    // — this would reduce dupl wrapping code.
    val vipos = posts.map(p => debate.vipo_!(p.id))
    var replyBtnPending = parentReplyBtn.nonEmpty

    var comments: NodeSeq = Nil
    for {
      // Could skip sorting inline posts, since sorted by position later
      // anyway, in javascript. But if javascript disabled?
      p <- vipos.sortBy(p => p.ctime.getTime). // the oldest first
                sortBy(p => -pageStats.ratingStatsFor(p.id).
                                fitnessDefaultTags.lowerLimit).
                sortBy(p => p.meta.fixedPos.getOrElse(999999))
      cssThreadId = "dw-t-"+ p.id
      cssDepth = "dw-depth-"+ depth
      isInlineThread = p.where.isDefined
      isInlineNonRootChild = isInlineThread && depth >= 2
      cssInlineThread = if (isInlineThread) " dw-i-t" else ""
      replies = debate.repliesTo(p.id)
      vipo = p // debate.vipo_!(p.id)
      isRootOrArtclQstn = vipo.id == rootPostId || vipo.meta.isArticleQuestion
      // Layout replies horizontally, if this is an inline reply to
      // the root post, i.e. depth is 1 -- because then there's unused space
      // to the right. However, the horizontal layout results in a higher
      // thread if there's only one reply. So only do this if there's more
      // than one reply.
      horizontal = (p.where.isDefined && depth == 1 && replies.length > 1) ||
                    isRootOrArtclQstn
      (cssHoriz, cssClearfix) =
          // Children will float, if horizontal. So clearafix .dw-res.
          if (horizontal) (" dw-hor", " ui-helper-clearfix")
          else ("", "")
      cssThreadDeleted = if (vipo.isTreeDeleted) " dw-t-dl" else ""
      cssArticleQuestion = if (isRootOrArtclQstn) " dw-p-art-qst" else ""
      postFitness = pageStats.ratingStatsFor(p.id).fitnessDefaultTags
      // For now: If with a probability of 90%, most people find this post
      // boring/faulty/off-topic, and if, on average,
      // more than two out of three people think so too, then fold it.
      // Also fold inline threads (except for root post inline replies)
      // -- they confuse people (my father), in their current shape.
      shallFoldPost = (postFitness.upperLimit < 0.5f &&
         postFitness.observedMean < 0.333f) || isInlineNonRootChild
    }
    yield {
      val renderedComment: RenderedComment =
        if (vipo.isTreeDeleted) _showDeletedTree(vipo)
        else if (vipo.isDeleted) _showDeletedComment(vipo)
        else _showComment(rootPostId, vipo, horizontal = horizontal)

      val myReplyBtn =
        if (!isRootOrArtclQstn) Nil
        else _replyBtnListItem(renderedComment.replyBtnText)

      val (cssFolded, foldLinkText) =
        if (shallFoldPost)
          (" dw-zd", "[+] Click to show more replies" +
             renderedComment.topRatingsText.map(", rated "+ _).getOrElse(""))
        else
          ("", "[–]") // the – is an `em dash' not a minus

      val foldLink =
        if (isRootOrArtclQstn || vipo.isTreeDeleted) Nil
        else <a class='dw-z'>{foldLinkText}</a>

      val repliesHtml =
        if (replies.isEmpty && myReplyBtn.isEmpty) Nil
        // COULD delete only stuff *older* than the tree deletion.
        else if (vipo.isTreeDeleted) Nil
        else <ol class={"dw-res"+ cssClearfix}>
          { _layoutComments(rootPostId, depth + 1, myReplyBtn, replies) }
        </ol>

      var thread =
        <li id={cssThreadId} class={"dw-t "+ cssDepth + cssInlineThread +
               cssFolded + cssHoriz + cssThreadDeleted + cssArticleQuestion}>{
          foldLink ++
          renderedComment.html ++
          repliesHtml
        }</li>

      // For inline comments, add info on where to place them.
      // COULD rename attr to data-where, that's search/replace:able enough.
      if (p.where isDefined) thread = thread % Attribute(
        None, "data-dw-i-t-where", Text(p.where.get), scala.xml.Null)

      // Place the Reply button just after the last fixed-position comment.
      // Then it'll be obvious (?) that if you click the Reply button,
      // your comment will appear to the right of the fixed-pos comments.
      if (replyBtnPending && p.meta.fixedPos.isEmpty) {
        replyBtnPending = false
        comments ++= parentReplyBtn
      }
      comments ++= thread
    }

    if (replyBtnPending) comments ++ parentReplyBtn
    else comments
  }

  private def _showDeletedTree(vipo: ViPo): RenderedComment = {
    _showDeletedComment(vipo, wholeTree = true)
  }

  private def _showDeletedComment(vipo: ViPo, wholeTree: Boolean = false
                                     ): RenderedComment = {
    val cssPostId = "dw-post-"+ vipo.id
    val deletion = vipo.firstDelete.get
    val deleter = debate.authorOf_!(deletion)
    val html =
    <div id={cssPostId} class='dw-p dw-p-dl'>
      <div class='dw-p-hd'>{
        if (wholeTree) "Thread" else "1 comment"
        } deleted by { _linkTo(deleter)
        /* TODO show flagsTop, e.g. "flagged spam".
        COULD include details, shown on click:
        Posted on ...,, rated ... deleted on ..., reasons for deletion: ...
        X flags: ... -- but perhaps better / easier with a View link,
        that opens the deleted post, incl. details, in a new browser tab?  */}
      </div>
    </div>
    RenderedComment(html, replyBtnText = Nil, topRatingsText = None)
  }


  case class RenderedComment(
    html: NodeSeq,
    replyBtnText: NodeSeq,
    topRatingsText: Option[String]
  )


  private def _showComment(rootPostId: String, vipo: ViPo, horizontal: Boolean
                              ): RenderedComment = {
    def post = vipo.post
    val editsAppld: List[(Edit, EditApp)] = vipo.editsAppdDesc
    val lastEditApp = editsAppld.headOption.map(_._2)
    val cssPostId = "dw-post-"+ post.id
    val (cssArtclPost, cssArtclBody) =
      if (post.id != Page.BodyId) ("", "")
      else (" dw-ar-p", " dw-ar-p-bd")
    val sourceText = vipo.text
    val isRootOrArtclQstn = vipo.id == rootPostId ||
        vipo.meta.isArticleQuestion

    // COULD move to class Markup?
    val (xmlText, numLines) = vipo.markup match {
      case "dmd0" =>
        // Debiki flavored markdown.
        (markdownToSafeHtml(sourceText, config.hostAndPort), -1)
      case "para" =>
        textToHtml(sourceText)
      /*
      case "link" =>
        textToHtml(sourceText) and linkify-url:s, w/ rel=nofollow)
      case "img" =>
        // Like "link", but also accept <img> tags and <pre>.
        // But nothing that makes text stand out, e.g. skip <h1>, <section>.
        */
      case "html" =>
        (sanitizeHtml(sourceText), -1)
      case "code" =>
        (<pre class='prettyprint'>{sourceText}</pre>,
          sourceText.count(_ == '\n'))
      /*
      case c if c startsWith "code" =>
        // Wrap the text in:
        //     <pre class="prettyprint"><code class="language-javascript">
        //  That's an HTML5 convention actually:
        // <http://dev.w3.org/html5/spec-author-view/
        //     the-code-element.html#the-code-element>
        // Works with: http://code.google.com/p/google-code-prettify/
        var lang = c.dropWhile(_ != '-')
        if (lang nonEmpty) lang = " lang"+lang  ; UNTESTED // if nonEmpty
        (<pre class={"prettyprint"+ lang}>{sourceText}</pre>,
          sourceText.count(_ == '\n'))
        // COULD include google-code-prettify js and css, and
        // onload="prettyPrint()".
        */
      case _ =>
        // Default to Debiki flavored markdown, for now.
        // (Later: update database, change null/'' to "dmd0" for the page body,
        // change to "para" for everything else.
        // Then warnDbgDie-default to "para" here not "dmd0".)
        (markdownToSafeHtml(sourceText, config.hostAndPort), -1)
    }

    var replyBtnText: NodeSeq = xml.Text("Reply")
    if (isRootOrArtclQstn) {
       findChildrenOfNode(withClass = "debiki-0-reply-button-text",
           in = xmlText) foreach { replyBtnText = _ }
    }
    val long = numLines > 9
    val cutS = if (long && post.id != rootPostId) " dw-x-s" else ""
    val author = debate.authorOf_!(post)

    val (flagsTop: NodeSeq, flagsDetails: NodeSeq) = {
      if (vipo.flags isEmpty) (Nil: NodeSeq, Nil: NodeSeq)
      else {
        import FormHtml.FlagForm.prettify
        val mtime = toIso8601T(vipo.lastFlag.get.ctime)
        val fbr = vipo.flagsByReasonSorted
        (<span class='dw-p-flgs-top'>, flagged <em>{
            prettify(fbr.head._1).toLowerCase}</em></span>,
        <div class='dw-p-flgs-all' data-mtime={mtime}>{
          vipo.flags.length} flags: <ol class='dw-flgs'>{
            for ((r: FlagReason, fs: List[Flag]) <- fbr) yield
              <li class="dw-flg">{
                // The `×' is the multiplication sign, "\u00D7".
                prettify(r).toLowerCase +" × "+ fs.length.toString
              } </li>
          }</ol>
        </div>)
      }
    }

    val postRatingStats = pageStats.ratingStatsFor(post.id)
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
      val minLower = Math.min(0.4, maxLowerConfLimit)
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

    val editInfo =
      // If closed: <span class='dw-p-re-cnt'>{count} replies</span>
      if (editsAppld.isEmpty) Nil
      else {
        val lastEditDate = editsAppld.head._2.ctime
        // ((This identity count doesn't take into account that a user
        // can have many identities, e.g. Twitter, Facebook and Gmail. So
        // even if many different *identities* have edited the post,
        // perhaps only one single actual *user* has edited it. Cannot easily
        // compare users though, because IdentitySimple maps to no user!))
        val editorsCount =
          editsAppld.map(edAp => debate.vied_!(edAp._1.id).identity_!.id).
          distinct.length
        lazy val editor =
          debate.authorOf_!(debate.editsById(lastEditApp.get.editId))
        <div class='dw-p-hd-e'>{
            Text(if (post.id == rootPostId) {
              // Via CSS, edit info is placed on the same line as author info.
              ", edited "
            } else {
              // Edit info will appear on a separate line.
              "Edited "
            }) ++
            (if (editorsCount > 1) {
              Text("by ") ++ <a>various people</a>
            } else if (editor.identity_!.id != author.identity_!.id) {
              Text("by ") ++ _linkTo(editor)
            } else {
              // Edited by the author. Don't repeat his/her name.
              Nil
            })
          }{dateAbbr(lastEditDate, "dw-p-at")}
        </div>
      }

    // Make a title for this post.
    val postTitleXml: NodeSeq = {
      // Currently only the page body can have a title.
      if (post.id != Page.BodyId) Nil
      else debate.titlePost map { titlePost =>
        // The title is a post, itself.
        // Therefore this XML is almost identical to the XML
        // for the post that this title entitles.
        // In the future, I could make a recursive call to
        // _renderPost, to render the title. Then it would be
        // possible to reply-inline to the title.
        <div id={"dw-post-"+ titlePost.id} class='dw-p dw-p-ttl'>
          <div class='dw-p-bd'>
            <div class='dw-p-bd-blk'>
              <header class='dw-p-ttl'><h1>{titlePost.text}</h1></header>
            </div>
          </div>
        </div>
      } getOrElse Nil
    }

    // Make he root post wrap its (floating) children,
    // (Don't know if this is needed or other horizontal threads.)
    val clearfix = if (horizontal) " ui-helper-clearfix" else ""

    val commentHtml =
    <div id={cssPostId} class={"dw-p" + cssArtclPost + cutS + clearfix}>
      { postTitleXml }
      <div class='dw-p-hd'>
        By { _linkTo(author)}{ dateAbbr(post.ctime, "dw-p-at")
        }{ flagsTop }{ ratingTagsTop }{ editInfo }{ flagsDetails
        }{ ratingTagsDetails }
      </div>
      <div class={"dw-p-bd"+ cssArtclBody}>
        <div class='dw-p-bd-blk'>
        { xmlText
        // (Don't  place a .dw-i-ts here. Splitting the -bd into
        // -bd-blks and -i-ts is better done client side, where the
        // heights of stuff is known.)
        }
        </div>
      </div>
    </div> ++ (
      if (isRootOrArtclQstn) Nil
      else <a class='dw-as' href={config.reactUrl(debate.guid, post.id) +
                  "&view="+ rootPostId}>React</a>)

    RenderedComment(html = commentHtml, replyBtnText = replyBtnText,
       topRatingsText = topTagsAsText)
  }

  def _linkTo(nilo: NiLo) = linkTo(nilo, config)
}


object FormHtml {

  def apply(config: HtmlConfig, xsrfToken: String,
        pageRoot: PageRoot, permsOnPage: PermsOnPage) =
    new FormHtml(config, xsrfToken, pageRoot, permsOnPage)

  val XsrfInpName = "dw-fi-xsrf"

  object Reply {
    object InputNames {
      val Text = "dw-fi-reply-text"
      val Where = "dw-fi-reply-where"
    }
  }

  object Rating {
    object InputNames {
      val Tag = "dw-fi-r-tag"
    }
  }

  object FlagForm {
    object InputNames {
      val Reason = "dw-fi-flg-reason"
      val Details = "dw-fi-flg-details"
    }
    import FlagReason._
    def prettify(reason: FlagReason): String = (reason match {  // i18n
      case CopyVio => "Copyright Violation"
      case x => x.toString
    })
  }

  object Edit {
    object InputNames {
      val Markup = "dw-fi-e-mup"
      val Text = "dw-fi-e-txt"
    }
  }

  object Delete {
    object InputNames {
      val Reason = "dw-fi-dl-reason"
      val DeleteTree = "dw-fi-dl-tree"
    }
  }

  def respDlgOk(title: String, summary: String, details: String) =
    _responseDialog(
      title, summary, details, debikiErrorCode = "", tyype = "dw-dlg-type-ok")

  def respDlgError(title: String, summary: String, details: String,
                   debikiErrorCode: String) =
    _responseDialog(
      title, summary, details, debikiErrorCode, tyype = "dw-dlg-type-err")

  private def _responseDialog(title: String, summary: String, details: String,
                              debikiErrorCode: String, tyype: String
                                 ): NodeSeq = {
    <div class={"dw-dlg-rsp "+ tyype}>
      <h1 class='dw-dlg-rsp-ttl'>{title}</h1>{
      (if (summary nonEmpty)
        <strong class='dw-dlg-rsp-smr'>{summary} </strong> else Nil) ++
      (if (details nonEmpty)
        <span class='dw-dlg-rsp-dtl'>{details} </span> else Nil) ++
      (if (debikiErrorCode nonEmpty)
        <span class='dw-dlg-rsp-err'>[error {debikiErrorCode}]</span> else Nil)
    }</div>
  }
}


class FormHtml(val config: HtmlConfig, xsrfToken: String,
    val pageRoot: PageRoot, val permsOnPage: PermsOnPage) {

  import FormHtml._
  import DebateHtml._

  val ccWikiLicense =
    <a rel="license" href="http://creativecommons.org/licenses/by/3.0/"
       target="_blank">CC BY-SA 3.0</a>

  def dialogTemplates =
    <div id="dw-hidden-templates">
    { actionMenu ++
      loginForms ++
      replyForm("", "") ++
      ratingForm ++
      flagForm ++
      deleteForm(None) }
    </div>

  def loginForms =
    loginFormSimple ++
    loginFormOpenId ++
    loginOkForm() ++
    loginFailedForm() ++
    logoutForm

  def actionMenu =
      <div id='dw-action-menu' class='dw-as dw-p-as'>
        <a class='dw-a dw-a-reply'>Reply</a>
        <a class='dw-a dw-a-rate'>Rate</a>
        <a class='dw-a dw-a-more'>More...</a>
        {/*<a class='dw-a dw-a-link'>Link</a>*/}
        <a class='dw-a dw-a-edit'>Edits</a>
        <a class='dw-a dw-a-flag'>Report</a>
        { ifThen(permsOnPage.deleteAnyReply, // hide for now only
            <a class='dw-a dw-a-delete'>Delete</a>) }
        {/*  Disable the Edit form and link for now,
        doesn't work very well right now, or not at all.
        <a class='dw-a dw-a-edit'>Edit</a>
        */}
      </div>
      // Could skip <a>Edit</a> for now, and teach people to
      // use the inline menu instead?

  /** A query string param that remembers which part of a page we are
   *  currently viewing.
   */
  private def _viewRoot = {
    // The page body is the default, need not be specified.
    if (pageRoot.id == Page.BodyId) ""
    else "&view="+ pageRoot.id
  }


  private def _xsrfToken = {
    <input type='hidden' class={XsrfInpName}
           name={XsrfInpName} value={xsrfToken}/>
  }


  def confirmationForm(question: String, answer: String) = {
    // They can click the browser's Back button to cancel.
    <form action='' method='POST'>
      { _xsrfToken }
      <div>{question}</div>
      <input type='submit' value={answer}/>
    </form>
  }

  /**
   *  The login form below is based on this JavaScript OpenID Selector
   *  example file:
   *    debiki-core/src/main/resources/toserve/lib/openid-selector/demo.html
   */
  def loginFormSimple =
      <div class='dw-fs' id='dw-fs-login-simple' title='Who are you?'>
        <form action={config.loginActionSimple} method='post'>
          { _xsrfToken }
          <div id='dw-login'>
           <div class='dw-login-openid'>
             <div class='dw-login-openid-info'>
               Login with Gmail, OpenID, Yahoo, etcetera:
             </div>
             <a class='dw-a dw-a-login-openid'>Log in</a>
             <div class='dw-login-openid-why'>
               <small>
               In the future, logging in will enable functionality
               not available to unauthenticated users.
               </small>
             </div>
           </div>
           {/*<div class='dw-login-or-wrap'>
             <div class='dw-login-or-word'>Or</div>
           </div>*/}
           <div class='dw-login-simple'>
            <div class='dw-login-simple-info'>
              Alternatively,
            </div>
            <div>
             <label for='dw-fi-login-name'>Enter your name:</label>
             <input id='dw-fi-login-name' type='text' size='40' maxlength='100'
                  name='dw-fi-login-name' value='Anonymous'/>
             <small><b>'?'</b> will be appended to your name,
               to indicate that you were not authenticated.
             </small>
            </div>
            <div>
             <label for='dw-fi-login-email'
                >Email: (optional, not shown)</label>
             <input id='dw-fi-login-email' type='text' size='40'
                  maxlength='100' name='dw-fi-login-email' value=''/>
             <input id='dw-fi-lgi-spl-email-ntf' type='checkbox'
                   name='dw-fi-lgi-spl-email-ntf' value='yes'/>
             <label for='dw-fi-lgi-spl-email-ntf'
                  id='dw-fi-lgi-spl-email-ntf-lbl'>
               <b>Be notified</b> via email on replies to your comments.
               <small>Not yet implemented.</small>
             </label>
            </div>
            <div>
             <label for='dw-fi-login-url' id='dw-fi-login-url-lbl'
                >Website: (optional)</label>
             <input id='dw-fi-login-url' type='text' size='40' maxlength='200'
                  name='dw-fi-login-url' value=''/>
             <!-- COULD add tabindex='...' -->
            </div>
           </div>
          </div>
        </form>
      </div>

  def loginFormOpenId =
      <div class='dw-fs' id='dw-fs-openid-login'
            title="Sign In or Create New Account">
        <form action={config.loginActionOpenId} method='post' id='openid_form'>
          { _xsrfToken }
          <input id='dw-fi-lgi-oid-email-ntf' type='checkbox'
              name='dw-fi-lgi-oid-email-ntf' value='yes'/>
          <label for='dw-fi-lgi-oid-email-ntf'
              id='dw-fi-lgi-oid-email-ntf-lbl'
            ><strong>Be notified</strong>
            via email on replies to your comments
          </label><br/>
          <input type='hidden' name='action' value='verify' />
          <div id='openid_choice'>
            <p>Please click your account provider:</p>
            <div id='openid_btns'></div>
          </div>
          <div id='openid_input_area'>
            <input id='openid_identifier' name='openid_identifier' type='text'
                value='http://' />
            <input id='openid_submit' type='submit' value='Sign-In'/>
          </div>
          <noscript>
            <p>OpenID is a service that allows you to log-on to many different
            websites using a single indentity. Find out
            <a href='http://openid.net/what/'>more about OpenID</a>
            and <a href='http://openid.net/get/'>how to get an OpenID enabled
            account</a>.</p>
          </noscript>
        </form>
      </div>

  def loginOkForm(name: String = "Anonymous") =
      <div class='dw-fs' id='dw-fs-login-ok' title='Welcome'>
        <form action={config.loginOkAction} method='post'>
          { _xsrfToken }
          <p>You have been logged in, welcome
            <span id='dw-fs-login-ok-name'>{name}</span>!
          </p>
          <div class='dw-submit-set'>
            <input class='dw-fi-submit' type='submit' value='OK'/>
          </div>
        </form>
      </div>

  def loginFailedForm(error: String = "unknown error") =
      <div class='dw-fs' id='dw-fs-login-failed' title='Login Error'>
        <form action={config.loginFailedAction} method='post'>
          { _xsrfToken }
          <p>Login failed:
            <span id='dw-fs-login-failed-errmsg'>{error}</span>
          </p>
          <div class='dw-submit-set'>
            <input class='dw-fi-submit' type='submit' value='OK'/>
          </div>
        </form>
      </div>

  def logoutForm =
      <div class='dw-fs' id='dw-fs-logout' title='Log out'>
        <form action={config.logoutAction} method='post'>
          { _xsrfToken }
          <p>Are you sure?</p>
          <div class='dw-submit-set'>
            <input class='dw-fi-cancel' type='button' value='Cancel'/>
            <input class='dw-fi-submit' type='submit' value='Log out'/>
          </div>
        </form>
      </div>

  def actLinks(pid: String) = {
    val safePid = safe(pid)  // Prevent xss attacks.
    // COULD check permsOnPage.replyHidden/Visible etc.
    <ul>
     <li><a href={"?reply=" + safePid + _viewRoot}>Reply to post</a></li>
     <li><a href={"?rate="  + safePid + _viewRoot}>Rate it</a></li>
     <li><a href={"?edit="  + safePid + _viewRoot}>Suggest edit</a></li>
     <li><a href={"?flag="  + safePid + _viewRoot}>Report spam or abuse</a></li>
     <li><a href={"?delete="+ safePid + _viewRoot}>Delete</a></li>
    </ul>
  }

  def replyForm(replyToPostId: String, text: String) = {
      import Reply.{InputNames => Inp}
    val submitButtonText = "Post as ..." // COULD read user name from `config'
      <li class='dw-fs dw-fs-re'>
        <form
            action={config.replyAction +"="+ replyToPostId + _viewRoot}
            accept-charset='UTF-8'
            method='post'>
          { _xsrfToken }
          {/* timeWaistWarning("reply", "is") */}
          <input type='hidden' id={Inp.Where} name={Inp.Where} value='' />
          <p>
            <label for={Inp.Text}>Your reply:</label><br/>
            <textarea id={Inp.Text} name={Inp.Text} rows='13'
              cols='38'>{text}</textarea>
          </p>
          { termsAgreement("Post as ...") }
          <div class='dw-submit-set'>
            <input class='dw-fi-cancel' type='button' value='Cancel'/>
            <input class='dw-fi-submit' type='submit' value={submitButtonText}/>
          </div>
         <!-- TODO on click, save draft, map to '#dw-a-login' in some way?
          e.g.: href='/users/login?returnurl=%2fquestions%2f10314%2fiphone-...'
          -->
        </form>
      </li>
  }

  def ratingForm =
      <div class='dw-fs dw-fs-r'>
        <form
            action={config.rateAction + _viewRoot}
            accept-charset='UTF-8'
            method='post'>
          { _xsrfToken }
          {
            var boxCount = 1
            def rateBox(value: String) = {
              val name = Rating.InputNames.Tag
              val id = name +"-"+ boxCount
              boxCount += 1
              <input id={id} type='checkbox' name={name} value={value} />
              <label for={id}>{value}</label>
            }
            {/* Don't show *all* available values immediately -- that'd
            be too many values, people can't keep them all in mind. Read this:
            en.wikipedia.org/wiki/The_Magical_Number_Seven,_Plus_or_Minus_Two
            although 3 - 5 items is probably much better than 7 - 9. */}
            <div>
              {/* temporary layout hack */}
              <div class='dw-r-tag-set'>{
                rateBox("interesting") ++
                rateBox("funny") ++
                rateBox("off-topic")
              }</div>
              <div class='dw-r-tag-set'>{
                rateBox("boring") ++
                rateBox("stupid")
              }</div>
              {/* One can report (flag) a comment as spam, so there's
              no need for a spam tag too. I don't think the troll tag is
              really needed? "Stupid + Boring" would work instead?
              Or flag as Offensive (if I add such a flag option).

              <a class='dw-show-more-r-tags'>More...</a>
              <div class='dw-r-tag-set dw-more-r-tags'>{
                rateBox("spam") ++
                rateBox("troll")
              }</div>  */}
            </div>
          }
          <div class='dw-submit-set'>
            <input class='dw-fi-submit' type='submit' value='Submit'/>
            <input class='dw-fi-cancel' type='button' value='Cancel'/>
          </div>
        </form>
      </div>

  def flagForm = {
    import FlagForm.{InputNames => Inp}
    <div class='dw-fs' title='Report Comment'>
      <form id='dw-f-flg' action={config.flagAction + _viewRoot}
            accept-charset='UTF-8' method='post'>
        { _xsrfToken }
        <div class='dw-f-flg-rsns'>{
          def input(idSuffix: String, r: FlagReason) = {
            val id = "dw-fi-flgs-"+ idSuffix
            <input type='radio' id={id} name={Inp.Reason} value={r.toString}/>
            <label for={id}>{FlagForm.prettify(r)}</label>
          }
          import FlagReason._
          input("spam", Spam) ++
          input("copy", CopyVio) ++
          input("ilgl", Illegal) ++
          input("othr", Other)
        }</div>
        <div>
          <label for={Inp.Details}>Details (optional)</label><br/>
          <textarea id={Inp.Details} rows='2' cols='30'
                 name={Inp.Details} value=''/>
        </div>
        <div class='dw-submit-set'>
          <input class='dw-fi-submit' type='submit' value='Submit'/>
          <input class='dw-fi-cancel' type='button' value='Cancel'/>
        </div>
      </form>
    </div>
  }

  /**
   * Lists improvement suggestions and improvements already applied.
   *
   * When submitted, posts a list of values like:
   * 0-delete-093k25, 1-apply-0932kx3, ...
   * "delete" means that an EditApp is to be deleted, that is, that
   * the-edit-that-was-applied should be reverted. The id is an edit app id.
   * "apply" means that an edit should be applied. The id is an edit id.
   * The initial sequence number ("0-", "1-", ...) is the order in
   * which the changes should be made.
   */
  def editsDialog(nipo: ViPo, page: Debate, userName: Option[String],
                  mayEdit: Boolean): NodeSeq = {
    def xmlFor(edit: Edit, eapp: Option[EditApp]): NodeSeq = {
      val applied = eapp isDefined
      val editor = page.authorOf_!(edit)
      def applier_! = page.authorOf_!(eapp.get)
      <li class='dw-e-sg'>
        <div class='dw-e-sg-e'>{
            <div>{
              (if (applied) "Suggested by " else "By ") ++
              linkTo(editor, config) ++
              dateAbbr(edit.ctime, "dw-e-sg-dt")
              }</div> ++
            (if (!applied) Nil
            else <div>Applied by { linkTo(applier_!, config) ++
              dateAbbr(eapp.get.ctime, "dw-e-ap-dt") }</div>
            )
          }
          <div class='dw-as'>{
            val name = "dw-fi-appdel"
            // The checkbox value is e.g. "10-delete-r0m84610qy",
            // i.e. <seq-no>-<action>-<edit-id>. The sequence no
            // is added by javascript; it specifies in which order the
            // changes are to be made.
            // (Namely the order in which the user checks/unchecks the
            // checkboxes.)
            if (!mayEdit) {
              // For now, show no Apply/Undo button. COULD show *vote*
              // buttons instead.
              Nil
            }
            else if (!applied) {
              val aplVal = "0-apply-"+ edit.id
              val delVal = "0-delete-"+ edit.id
              val aplId = name +"-apply-"+ edit.id
              val delId = name +"-delete-"+ edit.id
              <label for={aplId}>Apply</label>
              <input id={aplId} type='checkbox' name={name} value={aplVal}/>
              //<label for={delId}>Delete</label>
              //<input id={delId} type='checkbox' name={name} value={delVal}/>
            }
            else {
              val delVal = "0-delete-"+ eapp.get.id
              val undoId = name +"-delete-"+ edit.id
              <label for={undoId}>Undo</label>
              <input id={undoId} type='checkbox' name={name} value={delVal}/>
            }
          }</div>
          <pre class='dw-e-text'>{edit.text}</pre>
          { eapp.map(ea => <pre class='dw-e-rslt'>{ea.result}</pre>).toList }
        </div>
      </li>
    }

    val pending = nipo.editsPending
          // Better keep sorted by time? and if people don't like them,
          // they'll be deleted (faster)?
          //.sortBy(e => -pageStats.likingFor(e).lowerBound)
    // Must be sorted by time, most recent first (debiki.js requires this).
    val applied = nipo.editsAppdDesc
    val cssMayEdit = if (mayEdit) "dw-e-sgs-may-edit" else ""
    val cssArtclBody = if (nipo.id == Page.BodyId) " dw-ar-p-bd" else ""

    <form id='dw-e-sgs' action={"?applyedits"+ _viewRoot}
          class={cssMayEdit} title='Improvements'>
      { _xsrfToken }
      <div id='dw-e-sgss'>
        <div>Improvement suggestions:</div>
        <div id='dw-e-sgs-pending'>
          <ol class='dw-e-sgs'>{
            for (edit <- pending) yield xmlFor(edit, None)
          }</ol>
        </div>
        <div>Improvements already applied:</div>
        <div id='dw-e-sgs-applied'>
          <ol class='dw-e-sgs'>{
            for ((edit, editApp) <- applied) yield xmlFor(edit, Some(editApp))
          }</ol>
        </div>
        {/* cold show original text on hover.
        <div id='dw-e-sgs-org-lbl'>Original text</div> */}
        <pre id='dw-e-sgs-org-src'>{nipo.textInitially}</pre>
      </div>
      <div id='dw-e-sgs-diff'>{/* COULD rename to -imp-diff */}
        <div>This improvement:</div>
        <div id='dw-e-sgs-diff-text'>
        </div>
      </div>
      <div id='dw-e-sgs-save-diff'>
        <div>Changes to save:</div>
        <div id='dw-e-sgs-save-diff-text'>
        </div>
      </div>
      <div id='dw-e-sgs-prvw'>
        <div>Preview:</div>
        <div class={"dw-p-bd"+ cssArtclBody}>
          <div id='dw-e-sgs-prvw-html' class='dw-p-bd-blk'/>
        </div>
      </div>
    </form>
  }

  def editForm(postToEdit: ViPo, newText: String, userName: Box[String]) = {
    import Edit.{InputNames => Inp}
    val isForTitle = postToEdit.id == Page.TitleId
    val cssArtclBody =
      if (postToEdit.id == Page.BodyId) " dw-ar-p-bd"
      else ""
    val submitBtnText = "Submit as "+ userName.openOr("...")
    <form class='dw-f dw-f-e ui-helper-clearfix'
          action={"?edit="+ postToEdit.id + _viewRoot}
          accept-charset='UTF-8'
          method='post'>
      { _xsrfToken }
      {/* timeWaistWarning("edits", "are") */}
      <div class='dw-f-e-inf-save'>Scroll down and click Submit when done.</div>
      <div class='dw-f-e-mup'>
        <label for={Inp.Markup}>Markup: </label>
        <select id={Inp.Markup} name={Inp.Markup}>{
          // List supported markup languages.
          // Place the current markup first in the list.
          val markupsSorted =
            Markup.All.sortWith((a, b) => a.id == postToEdit.markup)
          val current = markupsSorted.head
          <option value={current.id} selected='selected'>{
            current.prettyName +" – in use"}</option> ++
          (markupsSorted.tail map { mup =>
            <option value={mup.id} >{mup.prettyName}</option>
          })
        }
        </select>
      </div>
      <div id='dw-e-tabs' class='dw-e-tabs'>
        <ul>
          <li><a href='#dw-e-tab-edit'>Edit</a></li>
          <li><a href='#dw-e-tab-diff'>Diff</a></li>
          <li><a href='#dw-e-tab-prvw'>Preview</a></li>
        </ul>
        <div id='dw-e-tab-edit' class='dw-e-tab dw-e-tab-edit'>
          <textarea id='dw-fi-edit-text' name={Inp.Text}
                    rows={if (isForTitle) "2" else "7"} cols='38'>{
            newText
          }</textarea>
        </div>
        <div id='dw-e-tab-prvw'
             class={"dw-e-tab dw-e-tab-prvw dw-p-bd"+ cssArtclBody}>
          <div class='dw-p-bd-blk'/>
        </div>
        <div id='dw-e-tab-diff' class='dw-e-tab dw-e-tab-diff'>
        </div>
        { // In debiki.js, updateEditFormDiff() uses textarea.val()
          // (i.e. newText) if there's no .dw-e-src-old tag.
          if (postToEdit.text == newText) Nil
          else <pre class='dw-e-src-old'>{postToEdit.text}</pre> }
      </div>
      { termsAgreement("Submit as ...") }
      <div class='dw-f-e-prvw-info'>To submit, first click <em>Preview</em>
        (just above).
      </div>
      <div class='dw-f-e-sugg-info'>You are submitting a
        <strong>suggestion</strong>.</div>
      <div class='dw-submit-set'>
       <input type='submit' class='dw-fi-submit' value={submitBtnText}/>
       <input type='button' class='dw-fi-cancel' value='Cancel'/>
      </div>
    </form>
  }

  def deleteForm(postToDelete: Option[ViPo]): NodeSeq = {
    val deleteAction =
      if (postToDelete.isDefined) "?delete="+ postToDelete.get.id
      else "" // Javascript will fill in post id, do nothing here

    <div class='dw-fs' title='Delete Comment'>
      <form id='dw-f-dl' action={deleteAction + _viewRoot}
            accept-charset='UTF-8' method='post'>{
        import Delete.{InputNames => Inp}
        val deleteTreeLabel = "Delete replies too"
        _xsrfToken ++
        <div>
          <label for={Inp.Reason}>Reason for deletion? (optional)</label><br/>
          <textarea id={Inp.Reason} rows='2' cols='33'
                 name={Inp.Reason} value=''/>
        </div>
        <div>
          <label for={Inp.DeleteTree}>{deleteTreeLabel}</label>
          <input id={Inp.DeleteTree} type='checkbox'
                 name={Inp.DeleteTree} value='t' />
        </div>
        <div class='dw-submit-set'>
          <input class='dw-fi-submit' type='submit' value='Delete'/>
          <input class='dw-fi-cancel' type='button' value='Cancel'/>
        </div>
      }
      </form>
    </div>
  }

  /*
  def timeWaistWarning(action: String, is: String): NodeSeq = {
    import IntrsAllowed._
    intrsAllowed match {
      case VisibleTalk => Nil
      case HiddenTalk =>  // COULD fix nice CSS and show details on hover only
        <div>
        <em>Time waist warning: On this page, your {action} {is} shown
         only to people who explicitly choose to view user comments.
        </em>
        </div>
    }
  }*/

  /** Does a terms agreement in each Reply and Edit form give a litigious
   *  impression? That the website cares only about legal stuff and so on?
   *  Anyway, any terms agreement must be customizable,
   *  since it would be unique for each tenant. No time to fix that now,
   *  so disable this, for now.
  */
  def termsAgreement(submitBtnText: String) = Nil  /*
    <div class='dw-user-contrib-license'>By clicking <em>{submitBtnText}</em>,
      you agree to release your contributions under the {ccWikiLicense}
      license, and you agree to the
      <a href={config.termsOfUseUrl} target="_blank">Terms of Use</a>.
    </div> */
    /* This short version might be better?
    <div id='tos' style='padding-top: 1ex; font-size: 80%; color: #555;'>
    Please read the <span style='text-decoration: underline;'>
      Terms of Use</span>.</div> */
}


object UserHtml {
  def renderInbox(items: Seq[InboxItem]): NodeSeq = {
    if (items.isEmpty)
      return  <div class='dw-ibx'><div class='dw-ibx-ttl'/></div>;

    <div class='dw-ibx'>
      <div class='dw-ibx-ttl'>Your inbox:</div>
      <ol> {
        for (i <- items.take(20)) yield {
          // COULD look up address in PATHS table when loading
          // InboxItem from database -- to get rid of 1 unnecessary redirect.
          val pageAddr = "/-"+ i.pageId
          val postAddr = pageAddr +"#dw-post-"+ i.pageActionId
          // The page title (i.e. `i.title') is currently unknown.
          //<li>1 reply on <a class='dw-ibx-pg-ttl' href={pageAddr}>{
          //  i.title}</a>:<br/>
          <li>1 reply: <a class='dw-ibx-p-bd' href={postAddr}>{i.summary}</a>
          </li>
        }
      }
      </ol>
    </div>
  }
}


object PageListHtml {
  def renderPageList(pagePathsDetails: Seq[(PagePath, PageDetails)]
                        ): NodeSeq = {
    <ol>{
      for ((pagePath, details) <- pagePathsDetails) yield {
        <li><a href={"/"+ pagePath.path}>{pagePath.path}</a></li>
      }
    }</ol>
  }
}


object AtomFeedXml {

  /**
   * See http://www.atomenabled.org/developers/syndication/.
   * Include in HTML e.g. like so:
   *   <link href="path/to/atom.xml" type="application/atom+xml"
   *        rel="alternate" title="Sitewide ATOM Feed" />
   *
   * feedId: Identifies the feed using a universally unique and
   * permanent URI. If you have a long-term, renewable lease on your
   * Internet domain name, then you can feel free to use your website's
   * address.
   * feedTitle: a human readable title for the feed. Often the same as
   * the title of the associated website.
   * feedMtime: Indicates the last time the feed was modified
   * in a significant way.
   */
  def renderFeed(hostUrl: String, feedId: String, feedTitle: String,
                 feedUpdated: ju.Date, pathsAndPages: Seq[(PagePath, Debate)]
                    ): Node = {
    // Based on:
    //   http://exploring.liftweb.net/master/index-15.html#toc-Section-15.7

    if (!hostUrl.startsWith("http"))
      warnDbgDie("Bad host URL: "+ safed(hostUrl))

    val baseUrl = hostUrl +"/"
    def urlTo(pp: PagePath) = baseUrl + pp.path.dropWhile(_ == '/')

    def pageToAtom(pathAndPage: (PagePath, Debate)): NodeSeq = {
      val pagePath = pathAndPage._1
      val page = pathAndPage._2
      val pageBody = page.body.getOrElse {
        warnDbgDie("Page "+ safed(page.guid) +
              " lacks a root post [error DwE09k14p2]")
        return Nil
      }
      val pageTitle = page.titleText getOrElse pagePath.slugOrIdOrQustnMark
      val pageBodyAuthor =
            pageBody.user.map(_.displayName) getOrElse "(Author name unknown)"
      val hostAndPort = hostUrl.stripPrefix("https://").stripPrefix("http://")
      val urlToPage =  urlTo(pagePath)

      // This takes rather long and should be cached.
      // Use the same cache for both plain HTML pages and Atom and RSS feeds?
      val rootPostHtml =
        DebateHtml.markdownToSafeHtml(pageBody.text, hostAndPort)

      <entry>{
        /* Identifies the entry using a universally unique and
        permanent URI. */}
        <id>{urlToPage}</id>{
        /* Contains a human readable title for the entry. */}
        <title>{pageTitle}</title>{
        /* Indicates the last time the entry was modified in a
        significant way. This value need not change after a typo is
        fixed, only after a substantial modification.
        COULD introduce a page's updatedTime?
        */}
        <updated>{toIso8601T(pageBody.ctime)}</updated>{
        /* Names one author of the entry. An entry may have multiple
        authors. An entry must [sometimes] contain at least one author
        element [...] More info here:
          http://www.atomenabled.org/developers/syndication/
                                                #recommendedEntryElements  */}
        <author><name>{pageBodyAuthor}</name></author>{
        /* The time of the initial creation or first availability
        of the entry.  -- but that shouldn't be the ctime, the page
        shouldn't be published at creation.
        COULD indroduce a page's publishedTime? publishing time?
        <published>{toIso8601T(ctime)}</published> */
        /* Identifies a related Web page. */}
        <link rel="alternate" href={urlToPage}/>{
        /* Contains or links to the complete content of the entry. */}
        <content type="xhtml">
          <div xmlns="http://www.w3.org/1999/xhtml">
            { rootPostHtml }
          </div>
        </content>
      </entry>
    }

     // Could add:
     // <link>: Identifies a related Web page
     // <author>: Names one author of the feed. A feed may have multiple
     // author elements. A feed must contain at least one author
     // element unless all of the entry elements contain at least one
     // author element.
    <feed xmlns="http://www.w3.org/2005/Atom">
      <title>{feedTitle}</title>
      <id>{feedId}</id>
      <updated>{toIso8601T(feedUpdated)}</updated>
      { pathsAndPages.flatMap(pageToAtom) }
    </feed>
  }
}


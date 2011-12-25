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
  def replyAction = ""
  def rateAction = ""
  def flagAction = ""
  def editAction = ""
  def deleteAction = ""
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

  def xsrfToken: String
}


object DebateHtml {

  def apply(debate: Debate) = new DebateHtml(debate)

  /** Converts text to xml, returns (html, approx-line-count).
   */
  private[v0]
  def textToHtml(text: String, charsPerLine: Int = 80)
      : Tuple2[NodeSeq, Int] = {
    var lines = 0
    val xml =
      // Two newlines ends a paragraph.
      for (par <- text.split("\n\n").toList)
      yield {
        lines += 1 + par.length / charsPerLine
        <p>{par}</p>
      }
    (xml, lines)
  }

  private[v0]
  def ifThen(condition: Boolean, html: NodeSeq): NodeSeq =
    if (condition) html else Nil

  // COULD compile javascripts, see:
  // http://www.java2s.com/Code/Java/JDK-6/WorkingwithCompilableScripts.htm
  // http://javasourcecode.org/html/open-source/jdk/jdk-6u23/
  //                  com/sun/script/javascript/RhinoCompiledScript.html
  // http://www.javalobby.org/java/forums/t87870.html

  // A markdown parser, in JavaScript, namely Showdown.
  private val _jsShowdown = new javax.script.ScriptEngineManager()
        .getEngineByName("js")
  private def _showdown = toserve.DebikiCoreResourceBase.getClass
        .getResourceAsStream("0/js/wmd/showdown.js")
  _jsShowdown.eval(new jio.InputStreamReader(_showdown))

  // A html sanitizer, in JavaScript, from google-caja.
  private val _jsSanitizer = new javax.script.ScriptEngineManager()
        .getEngineByName("js")
  private def _cajaSanitizer = toserve.DebikiCoreResourceBase.getClass
        .getResourceAsStream("0/js/html-sanitizer-minified.js")
  _jsSanitizer.eval(new jio.InputStreamReader(_cajaSanitizer))
  _jsSanitizer.eval("""
      |function urlX(url) { if(/^https?:\/\//.test(url)) { return url }}
      |function idX(id) { return id }
      |""".stripMargin)
  private val _jsUrlX = _jsSanitizer.get("urlX")
  private val _jsIdX = _jsSanitizer.get("idX")

  /** Converts markdown to xml.
   */
  def markdownToHtml(source: String, hostAndPort: String): NodeSeq = {
    val htmlTextUnsafe = _jsShowdown.asInstanceOf[javax.script.Invocable]
          .invokeMethod(_jsShowdown.eval("new Showdown.converter()"),
          "makeHtml", source, hostAndPort).toString
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
    <span id='dw-login-info'>
      <span class='dw-login-name'>{userName.getOrElse("")}</span>
    </span>
    <a id='dw-a-login'>Logga in</a>
    <a id='dw-a-logout'>&nbsp;&nbsp;|&nbsp;&nbsp;Logga ut</a>
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


class DebateHtml(val debate: Debate) {

  import DebateHtml._

  private var config: HtmlConfig = _  // COULD let be a ctor param

  private lazy val pageStats = new PageStats(debate)

  private def lastChange: Option[String] =
    debate.lastChangeDate.map(toIso8601(_))

  def configure(conf: HtmlConfig): DebateHtml = {
    this.config = conf
    this
  }

  def layoutPageAndTemplates(permsOnPage: PermsOnPage): NodeSeq = {
    layoutPage() ++ FormHtml(config, permsOnPage).dialogTemplates
  }

  /** The results from layoutPosts doesn't depend on who the user is
   *  and can thus be cached.
   */
  def layoutPage(): NodeSeq = {
    val rootPosts = debate.repliesTo(Debate.RootPostId)
    val rootPost = debate.vipo(Debate.RootPostId)
    val cssThreadId = "dw-t-"+ Debate.RootPostId
    <div id={debate.guid} class="debiki dw-debate">
      <div class="dw-debate-info">{
        if (lastChange isDefined) {
          <p class="dw-last-changed">Last changed on
          <abbr class="dw-date"
                title={toIso8601T(lastChange.get)}>{lastChange.get}</abbr>
          </p>
        }
      }
      </div>
      <div id={cssThreadId} class='dw-t dw-depth-0 dw-hor'>
      {
        // If there's no root post, use a dummy empty one, so an (empty)
        // <div .dw-p> is created. It's required
        // because JavaScript elsewhere finds .dw-t:s by finding .dw-p parents.
        val (comment, replyBtnText) = _showComment(
            rootPost.getOrElse(unimplemented), horizontal = true)
        val replyBtn = _replyBtnListItem(replyBtnText)
        comment ++
        <div class='dw-t-vspace'/>
        <ol class='dw-res ui-helper-clearfix'>{
          _layoutComments(1, replyBtn, rootPosts)
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

  private def _layoutComments(depth: Int, parentReplyBtn: NodeSeq,
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
      p <- vipos.sortBy(p => p.date.getTime). // the oldest first
                sortBy(p => -pageStats.scoreFor(p.id).liking).
                sortBy(p => p.meta.fixedPos.getOrElse(999999))
      cssThreadId = "dw-t-"+ p.id
      cssDepth = "dw-depth-"+ depth
      cssInlineThread = if (p.where isDefined) " dw-i-t" else ""
      replies = debate.repliesTo(p.id)
      vipo = p // debate.vipo_!(p.id)
      // Layout replies horizontally, if this is an inline reply to
      // the root post, i.e. depth is 1 -- because then there's unused space
      // to the right. However, the horizontal layout results in a higher
      // thread if there's only one reply. So only do this if there's more
      // than one reply.
      horizontal = (p.where.isDefined && depth == 1 && replies.length > 1) ||
                    vipo.meta.isArticleQuestion
      (cssHoriz, cssClearfix) =
          // Children will float, if horizontal. So clearafix .dw-res.
          if (horizontal) (" dw-hor", " ui-helper-clearfix")
          else ("", "")
      cssThreadDeleted = if (vipo.isTreeDeleted) " dw-t-dl" else ""
      cssArticleQuestion = if (vipo.meta.isArticleQuestion) " dw-p-art-qst"
                          else ""
    }
    yield {
      var li =
        <li id={cssThreadId} class={"dw-t "+ cssDepth + cssInlineThread +
            cssHoriz + cssThreadDeleted + cssArticleQuestion}>
        {
          if (vipo.isTreeDeleted) _showDeletedTree(vipo)
          else {
            val (comment, replyBtnText) =
              if (vipo.isDeleted) (_showDeletedComment(vipo), xml.Text("Reply"))
              else _showComment(vipo, horizontal = horizontal)

            val myReplyBtn =
              if (vipo.meta.isArticleQuestion) _replyBtnListItem(replyBtnText)
              else Nil
            comment ++ (
              if (replies.isEmpty && myReplyBtn.isEmpty) Nil
              else <ol class={"dw-res"+ cssClearfix}>
                { _layoutComments(depth + 1, myReplyBtn, replies) }
              </ol>
            )
          }
        }
        </li>
      // For inline comments, add info on where to place them.
      // COULD rename attr to data-where, that's search/replace:able enough.
      if (p.where isDefined) li = li % Attribute(
          None, "data-dw-i-t-where", Text(p.where.get), scala.xml.Null)

      // Place the Reply button just after the last fixed-position comment.
      // Then it'll be obvious (?) that if you click the Reply button,
      // your comment will appear to the right of the fixed-pos comments.
      if (replyBtnPending && p.meta.fixedPos.isEmpty) {
        replyBtnPending = false
        comments ++= parentReplyBtn
      }
      comments ++= li
    }

    if (replyBtnPending) comments ++ parentReplyBtn
    else comments
  }

  private def _showDeletedTree(vipo: ViPo): NodeSeq = {
    _showDeletedComment(vipo, wholeTree = true)
  }

  private def _showDeletedComment(vipo: ViPo, wholeTree: Boolean = false
                                     ): NodeSeq = {
    val cssPostId = "dw-post-"+ vipo.id
    val deletion = vipo.firstDelete.get
    val deleter = debate.authorOf_!(deletion)
    (if (wholeTree) Nil else <a class='dw-z'>[–]</a>) ++
    <div id={cssPostId} class='dw-p dw-p-dl'>
      <div class='dw-p-hdr'>{
        if (wholeTree) "Thread" else "1 comment"
        } deleted by { _linkTo(deleter)
        /* TODO show flagsTop, e.g. "flagged spam".
        COULD include details, shown on click:
        Posted on ...,, rated ... deleted on ..., reasons for deletion: ...
        X flags: ... -- but perhaps better / easier with a View link,
        that opens the deleted post, incl. details, in a new browser tab?  */}
      </div>
    </div>
  }

  /** Returns the comment and the Reply button text.
   */
  private def _showComment(vipo: ViPo, horizontal: Boolean
                              ): (NodeSeq, NodeSeq) = {
    def post = vipo.post
    val editsAppld: List[(Edit, EditApp)] = vipo.editsAppdDesc
    val lastEditApp = editsAppld.headOption.map(_._2)
    val cssPostId = "dw-post-"+ post.id
    val sourceText = vipo.text
    // Concerning post.markup:
    // `code' - wrap the text in <code class="prettyprint">...</code>
    // `code-javascript' - wrap the text in:
    //     <pre class="prettyprint"><code class="language-javascript">
    //     This is a HTML5 convention:
    //     <http://dev.w3.org/html5/spec-author-view/
    //         the-code-element.html#the-code-element>
    //     Works with: http://code.google.com/p/google-code-prettify/
    // `plain' - change `http://...' to `<a rel=nofollow href=...>...</a>'
    //             and change "\n\n" to <p>:s.
    // `dfmd-0' - Debiki flavored markdown version 0
    val (xmlText, numLines) = post.markup match {
      //case "" => (xml.Text(sourceText), sourceText.count(_ == '\n'))
      //case "plain" => textToHtml(sourceText)
      //case "dfmd-0" => // Debiki flavored markdown
      case _ => // for now
        (markdownToHtml(sourceText, config.hostAndPort), -1)
        // COULD convert only <img> & <pre> tags,
        //… but nothing that makes text stand out, e.g. skip <h1>, <section>.
        // For the root post, allow everything but javascript though.
      /*
      case c if c startsWith "code" =>
        var lang = c.dropWhile(_ != '-')
        if (lang nonEmpty) lang = " lang"+lang  ; UNTESTED // if nonEmpty
        (<pre class={"prettyprint"+ lang}>{sourceText}</pre>,
          sourceText.count(_ == '\n'))
        // COULD include google-code-prettify js and css, and
        // onload="prettyPrint()".
      case x => unimplemented("Markup of "+ safed(x))
       */
    }
    var replyBtnText: NodeSeq = xml.Text("Reply")
    if (vipo.meta.isArticleQuestion) {
       findChildrenOfNode(withClass = "debiki-0-reply-button-text",
           in = xmlText) foreach { replyBtnText = _ }
    }
    val long = numLines > 9
    val cutS = if (long && post.id != Debate.RootPostId) " dw-x-s" else ""
    val author = debate.authorOf_!(post)

    val (flagsTop: NodeSeq, flagsDetails: NodeSeq) = {
      if (vipo.flags isEmpty) (Nil: NodeSeq, Nil: NodeSeq)
      else {
        import FormHtml.FlagForm.prettify
        val mtime = toIso8601T(vipo.lastFlag.get.date)
        val fbr = vipo.flagsByReasonSorted
        (<span class='dw-p-flgs-top'>, flagged <i>{
            prettify(fbr.head._1).toLowerCase}</i></span>,
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

    val score = pageStats.scoreFor(post.id)
    val ratStatsSorted = score.labelStatsSorted
    val topTags = if (ratStatsSorted isEmpty) Nil else {
      // If there're any really popular tags (lower liking bound > 0.4),
      // show all those. Otherwise, show only the most popular tag(s).
      val minLower = Math.min(0.4, ratStatsSorted.head._2.fractionLowerBound)
      ratStatsSorted.takeWhile(_._2.fractionLowerBound >= minLower)
    }
    val (ratsTop: NodeSeq, ratsDetails: NodeSeq) = {
      val rats = ratStatsSorted
      if (rats.isEmpty) (Nil: NodeSeq, Nil: NodeSeq)
      else {
        def showRating(tagAndStats: Pair[String, LabelStats]): String = {
          val tag = tagAndStats._1
          val likingLowerBound = tagAndStats._2.fractionLowerBound
          // A rating tag like "important!!" means "really important", many
          // people agree. And "important?" means "perhaps somewhat important",
          // some people agree.
          // COULD reduce font-size of ? to 85%, it's too conspicuous.
          val mark =
            if (likingLowerBound > 0.9) "!!"
            else if (likingLowerBound > 0.7) "!"
            else if (likingLowerBound > 0.3) ""
            else "?"
          tag + mark
          // COULD reduce font size of mark to 85%, or it clutters the ratings.
        }
        // List popular rating tags. Then all tags and their usage percents,
        // but those details are shown only if one clicks the post header.
        ((if (topTags isEmpty) Nil
        else <span class='dw-p-ra dw-p-ra-top'>, rated <i>{
          topTags.take(3).map(showRating(_)).mkString(", ") }</i></span>
        ),
        <div class='dw-p-ra-all'
             data-mtime={toIso8601T(score.lastRatingDate)}>{
          score.ratingCount} ratings:
          <ol class='dw-p-ra dw-rats'>{
          // Don't change whitespace, or `editInfo' perhaps won't
          // be able to append a ',' with no whitespace in front.
          for ((tag: String, stats: LabelStats) <- rats) yield
          <li class="dw-rat" data-stats={
              ("lo: %.0f" format (100 * stats.fractionLowerBound)) +"%, "+
              "sum: "+ stats.sum}> {
            tag +" %.0f" format (100 * stats.fraction)}% </li>
        }</ol></div>)
      }
    }

    val editInfo =
      // If closed: <span class='dw-p-re-cnt'>{count} replies</span>
      if (editsAppld.isEmpty) Nil
      else {
        val lastEditDate = editsAppld.head._2.date
        <div class='dw-p-hdr-ed'>Edited by {
            // This identityt test doesn't take into account that a user
            // can have many identities (e.g. Twitter, Facebook, Gmail), so
            // even if many different identities have edited the post,
            // perhaps only one single user has edited it. Cannot easily
            // compare users though, because IdentitySimple maps to no user!
            if (editsAppld.map(edAp => debate.vied_!(edAp._1.id).identity_!.id).
                distinct.length > 1) {
              <a>various people</a>
            } else {
              val editor = debate.authorOf_!(debate.editsById(
                           lastEditApp.get.editId))
              _linkTo(editor)
            }
          }{dateAbbr(lastEditDate, "dw-p-at")}
        </div>
      }

    // Make he root post wrap its (floating) children,
    // (Don't know if this is needed or other horizontal threads.)
    val clearfix = if (horizontal) " ui-helper-clearfix" else ""

    // COULD find a better name for the two data-p-by-...-sh attrs below.
    // Also, perhaps they should be part of the .dw-p-by <a>?
    // the – on the next line is an `en dash' not a minus
    (<a class='dw-z'>[–]</a>
    <div id={cssPostId} class={"dw-p" + cutS + clearfix}
         data-p-by-ip-sh={vipo.ipSaltHash_!}>
      <div class='dw-p-hdr'>
        By { _linkTo(author)}{ dateAbbr(post.date, "dw-p-at")
        }{ flagsTop }{ ratsTop }{ editInfo }{ flagsDetails }{ ratsDetails }
      </div>
      <div class='dw-p-bdy'><div class='dw-p-bdy-blk'>
        { xmlText
        // (Don't  place a .dw-i-ts here. Splitting the -bdy into
        // -bdy-blks and -i-ts is better done client side, where the
        // heights of stuff is known.)
        }
      </div></div>
    </div> ++ (
      if (vipo.meta.isArticleQuestion) Nil
      else <a class='dw-as' href={config.reactUrl(debate.guid, post.id)}
            >React</a>),
    replyBtnText)
  }

  def _linkTo(nilo: NiLo) = linkTo(nilo, config)
}


object FormHtml {

  def apply(config: HtmlConfig, permsOnPage: PermsOnPage) =
    new FormHtml(config, permsOnPage)

  val XsrfInpName = "dw-fi-xsrf"

  object Reply {
    object InputNames {
      val Text = "dw-fi-reply-text"
      val Where = "dw-fi-reply-where"
    }
  }

  object Rating {
    object InputNames {
      val Tag = "dw-fi-rat-tag"
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
      val Text = "dw-fi-ed-txt"
      val Preview = "dw-fi-ed-preview"
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
        <span class='dw-dlg-rsp-err'>{debikiErrorCode}</span> else Nil)
    }</div>
  }
}


class FormHtml(val config: HtmlConfig, val permsOnPage: PermsOnPage) {

  import FormHtml._
  import DebateHtml._

  val ccWikiLicense =
    <a rel="license" href="http://creativecommons.org/licenses/by/3.0/"
       target="_blank">CC BY-SA 3.0</a>

  private[v0]
  def dialogTemplates =
    <div id="dw-hidden-templates">
    { actionMenu ++
      loginForms ++
      replyForm() ++
      ratingForm ++
      flagForm ++
      deleteForm }
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

  private def _xsrfToken = {
    val tkn = config.xsrfToken
    <input type='hidden' class={XsrfInpName} name={XsrfInpName} value={tkn}/>
  }

  /**
   *  The login form below is based on this JavaScript OpenID Selector
   *  example file:
   *    debiki-core/src/main/resources/toserve/0/lib/openid-selector/demo.html
   */
  def loginFormSimple =
      <div class='dw-fs' id='dw-fs-login-simple' title='Who are you?'>
        <form action={config.loginActionSimple} method='post'>
          { _xsrfToken }
          <div id='dw-login'>
           <div class='dw-login-openid'>
             <div class='dw-login-openid-info'>
               Login with e.g. Gmail, OpenID, Yahoo:
             </div>
             <a class='dw-a dw-a-login-openid'>Log in</a>
           </div>
           <div class='dw-login-or-wrap'>
             <div class='dw-login-or-word'>or</div>
           </div>
           <div class='dw-login-simple'>
            <div class='dw-login-simple-info'>
              Login with username and<br/>
              email (no password):
            </div>
            <div>
             <label for='dw-fi-login-name'>Name</label><br/>
             <input id='dw-fi-login-name' type='text' size='40' maxlength='100'
                  name='dw-fi-login-name' value='Anonymous'/>
             <br/>
            </div>
            <div>
             <label for='dw-fi-login-email'
                >Email (optional, not shown)</label><br/>
             <input id='dw-fi-login-email' type='text' size='40'
                  maxlength='100' name='dw-fi-login-email' value=''/><br/>
             <input id='dw-fi-lgi-spl-email-ntf' type='checkbox'
                   name='dw-fi-lgi-spl-email-ntf' value='yes'/>
             <label for='dw-fi-lgi-spl-email-ntf'
                  id='dw-fi-lgi-spl-email-ntf-lbl'
                >Notify me via email if someone replies to my comments</label
                ><br/>
            </div>
            <div>
             <label for='dw-fi-login-url' id='dw-fi-login-url-lbl'
                >Website (optional)</label><br/>
             <input id='dw-fi-login-url' type='text' size='40' maxlength='200'
                  name='dw-fi-login-url' value=''/><br/>
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
            >Notify me via email if someone replies to my comments</label
            ><br/>
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
     <li><a href={"?reply="+ safePid}>Reply to post</a></li>
     <li><a href={"?rate="+ safePid}>Rate it</a></li>
     <li><a href={"?edit="+ safePid}>Suggest edit</a></li>
     <li><a href={"?flag="+ safePid}>Report spam or abuse</a></li>
     <li><a href={"?delete="+ safePid}>Delete</a></li>
    </ul>
  }

  def replyForm(text: String = "") = {
      import Reply.{InputNames => Inp}
    val submitButtonText = "Post as ..." // COULD read user name from `config'
      <li class='dw-fs dw-fs-re'>
        <form
            action={config.replyAction}
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
      <div class='dw-fs dw-fs-rat'>
        <form
            action={config.rateAction}
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
              <div class='dw-rat-tag-set'>{
                rateBox("interesting") ++
                rateBox("funny") ++
                rateBox("off-topic")
              }</div>
              <div class='dw-rat-tag-set'>{
                rateBox("boring") ++
                rateBox("stupid")
              }</div>
              {/* One can report (flag) a comment as spam, so there's
              no need for a spam tag too. I don't think the troll tag is
              really needed? "Stupid + Boring" would work instead?
              Or flag as Offensive (if I add such a flag option).

              <a class='dw-show-more-rat-tags'>More...</a>
              <div class='dw-rat-tag-set dw-more-rat-tags'>{
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
      <form id='dw-f-flg' action={config.flagAction} accept-charset='UTF-8'
            method='post'>
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

  def editsDialog(nipo: ViPo, page: Debate, userName: Option[String],
                  mayEdit: Boolean): NodeSeq = {
    def xmlFor(edit: Edit, eapp: Option[EditApp]): NodeSeq = {
      val applied = eapp isDefined
      val editor = page.authorOf_!(edit)
      def applier_! = page.authorOf_!(eapp.get)
      <li class='dw-es'>
        <div class='dw-es-ed'>{
            <div>{
              (if (applied) "Suggested by " else "By ") ++
              linkTo(editor, config) ++
              dateAbbr(edit.date, "dw-e-sg-dt")
              }</div> ++
            (if (!applied) Nil
            else <div>Applied by { linkTo(applier_!, config) ++
              dateAbbr(eapp.get.date, "dw-e-ap-dt") }</div>
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
          <pre class='dw-ed-text'>{edit.text}</pre>
          { eapp.map(ea => <pre class='dw-ed-rslt'>{ea.result}</pre>).toList }
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

    <form id='dw-e-sgs' action='?applyedits' class={cssMayEdit}
          title='Improvement Suggestions'>
      { _xsrfToken }
      <div id='dw-e-sgss'>
        <div>Improvement suggestions:</div>
        <div id='dw-e-sgs-pending'>
          <ol class='dw-ess'>{
            for (edit <- pending) yield xmlFor(edit, None)
          }</ol>
        </div>
        <div>Improvements already applied:</div>
        <div id='dw-e-sgs-applied'>
          <ol class='dw-ess'>{
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
        <div id='dw-e-sgs-prvw-html'>
        </div>
      </div>
    </form>
  }

  def editForm(newText: String = "", oldText: String = "",
               userName: Box[String]) = {
    import Edit.{InputNames => Inp}
    val submitBtnText = "Save as "+ userName.openOr("...")
    <form class='dw-f dw-f-ed'
          action={config.editAction}
          accept-charset='UTF-8'
          method='post'>
      { _xsrfToken }
      {/* timeWaistWarning("edits", "are") */}
      <div class='dw-f-e-inf-save'>Scroll down and click Save when done.</div>
      <div id='dw-ed-tabs'>
        <ul>
          <li><a href='#dw-ed-tab-edit'>Edit</a></li>
          <li><a href='#dw-ed-tab-diff'>Diff</a></li>
          <li><a href='#dw-ed-tab-preview'>Preview</a></li>
        </ul>
        <div id='dw-ed-tab-edit' class='dw-ed-tab dw-ed-tab-edit'>
          <textarea id='dw-fi-edit-text' name={Inp.Text} rows='7' cols='38'>{
            newText
          }</textarea>
        </div>
        <div id='dw-ed-tab-preview' class='dw-ed-tab dw-ed-tab-preview'>
        </div>
        <div id='dw-ed-tab-diff' class='dw-ed-tab dw-ed-tab-diff'>
        </div>
        { // In debiki.js, updateEditFormDiff() uses textarea.val()
          // (i.e. newText) if there's no .dw-ed-src-old tag.
          if (oldText == newText) Nil
          else <pre class='dw-ed-src-old'>{oldText}</pre> }
      </div>
      { termsAgreement("Save as ...") }
      <div class='dw-submit-set'>
       <input type='button' class={Inp.Preview} name={Inp.Preview}
              value='Preview and save ...'/>
       <input type='submit' class='dw-fi-submit' value={submitBtnText}/>
       <input type='button' class='dw-fi-cancel' value='Cancel'/>
      </div>
      <div class='dw-f-ed-sugg-info'>You are submitting an edit
        <strong>suggestion</strong> — hopefully someone will review it
        and accept it.</div>
    </form>
  }

  def deleteForm =
    <div class='dw-fs' title='Delete Comment'>
      <form id='dw-f-dl' action={config.deleteAction}
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

  /*
  def timeWaistWarning(action: String, is: String): NodeSeq = {
    import IntrsAllowed._
    intrsAllowed match {
      case VisibleTalk => Nil
      case HiddenTalk =>  // COULD fix nice CSS and show details on hover only
        <div><i>Time waist warning: On this page, your {action} {is} shown
        only to people who explicitly choose to view user comments.
        </i></div>
    }
  }*/

  def termsAgreement(submitBtnText: String) =
    <div class='dw-user-contrib-license'>By clicking <i>{submitBtnText}</i>,
      you agree to release your contributions under the {ccWikiLicense}
      license, and you agree to the
      <a href={config.termsOfUseUrl} target="_blank">Terms of Use</a>.
    </div>
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
          val pageAddr = "/0/-"+ i.pageId
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


// where should I place this?
sealed abstract class PageSortOrder
case object SortPageByPath extends PageSortOrder
case object SortPageByCtime extends PageSortOrder

object PageListHtml {
  def renderPageList(pagePaths: Seq[PagePath]): NodeSeq = {
    <ol>{
      for (pagePath <- pagePaths) yield {
        <li><a href={"/0/"+ pagePath.path}>{pagePath.path}</a></li>
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

    val baseUrl = hostUrl +"/0/"
    def urlTo(pp: PagePath) = baseUrl + pp.path.dropWhile(_ == '/')

    def pageToAtom(pathAndPage: (PagePath, Debate)): NodeSeq = {
      val pagePath = pathAndPage._1
      val page = pathAndPage._2
      val rootPost = page.vipo(Debate.RootPostId).getOrElse {
        warnDbgDie("Page "+ safed(page.guid) +
              " lacks a root post [debiki_error_09k14p2]")
        return Nil
      }
      val ctime = rootPost.date
      val rootPostAuthorName =
            rootPost.user.map(_.displayName) getOrElse "(Author name unknown)"
      val hostAndPort = hostUrl.stripPrefix("https://").stripPrefix("http://")
      val urlToPage =  urlTo(pagePath)

      // This takes rather long and should be cached.
      // Use the same cache for both plain HTML pages and Atom and RSS feeds?
      val rootPostHtml = DebateHtml.markdownToHtml(rootPost.text, hostAndPort)

      <entry>{
        /* Identifies the entry using a universally unique and
        permanent URI. */}
        <id>{urlToPage}</id>{
        /* Contains a human readable title for the entry. */}
        <title>{pagePath.nameOrGuidOrQustnMark}</title>{
        /* Indicates the last time the entry was modified in a
        significant way. This value need not change after a typo is
        fixed, only after a substantial modification.
        COULD introduce a page's updatedTime?
        */}
        <updated>{toIso8601T(ctime)}</updated>{
        /* Names one author of the entry. An entry may have multiple
        authors. An entry must [sometimes] contain at least one author
        element [...] More info here:
          http://www.atomenabled.org/developers/syndication/
                                                #recommendedEntryElements  */}
        <author><name>{rootPostAuthorName}</name></author>{
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


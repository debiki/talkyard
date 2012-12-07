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
import DebikiHttp._
import HtmlUtils._


object HtmlConfig {

  /**
   * A function from debate-id and post-id to a react URL.
   */
  def reactUrl(debateId: String, postId: String) = "?act="+ postId
}


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


object HtmlPageSerializer {


  def markupTextOf(post: ViPo, hostAndPort: String): String =
    _markupTextOf(post, hostAndPort)._1.toString


  // COULD move to HtmlPostSerializer.
  def _markupTextOf(post: ViPo, hostAndPort: String): (NodeSeq, Int) = {

    val isArticle = post.id == Page.BodyId

    // Use nofollow links in people's comments, so Google won't punish
    // the website if someone posts spam.
    def isArticeOrArticleQuestion = isArticle || post.meta.isArticleQuestion
    val makeNofollowLinks = !isArticeOrArticleQuestion

    post.markup match {
      case "dmd0" =>
        // Debiki flavored markdown.
        val html = markdownToSafeHtml(
          post.text, hostAndPort, makeNofollowLinks,
          allowClassIdDataAttrs = isArticle)
        (html, -1)
      case "para" =>
        textToHtml(post.text)
      /*
    case "link" =>
      textToHtml(post.text) and linkify-url:s, w/ rel=nofollow)
    case "img" =>
      // Like "link", but also accept <img> tags and <pre>.
      // But nothing that makes text stand out, e.g. skip <h1>, <section>.
      */
      case "html" =>
        (sanitizeHtml(post.text, makeNofollowLinks,
          allowClassIdDataAttrs = isArticle), -1)
      case "code" =>
        (<pre class='prettyprint'>{post.text}</pre>,
           post.text.count(_ == '\n'))
      /*
    case c if c startsWith "code" =>
      // Wrap the text in:
      //     <pre class="prettyprint"><code class="language-javascript">
      //  That's an HTML5 convention actually:
      // <http://dev.w3.org/html5/spec-author-view/
      //     the-code-element.html#the-code-element>
      // Works with: http://code.google.com/p/google-code-prettify/
      var lang = c.dropWhile(_ != '-')
      if (lang nonEmpty) lang = " lang"+lang  ; UN TESTED // if nonEmpty
      (<pre class={"prettyprint"+ lang}>{post.text}</pre>,
        post.text.count(_ == '\n'))
      // COULD include google-code-prettify js and css, and
      // onload="prettyPrint()".
      */
      case _ =>
        // Default to Debiki flavored markdown, for now.
        // (Later: update database, change null/'' to "dmd0" for the page body,
        // change to "para" for everything else.
        // Then warnDbgDie-default to "para" here not "dmd0".)
        (markdownToSafeHtml(post.text, hostAndPort,
          makeNofollowLinks, allowClassIdDataAttrs = isArticle), -1)
    }
  }


  /** Converts text to xml, returns (html, approx-line-count).
   *
   * Splits into <p>:s and <br>:s at newlines, does nothing else.
   */
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


  /**
   * Converts markdown to xml.
   */
  def markdownToSafeHtml(source: String, hostAndPort: String,
        makeLinksNofollow: Boolean, allowClassIdDataAttrs: Boolean): NodeSeq
        = /*Stats.time("markdownToSafeHtml")*/ {
    val htmlTextUnsafe =
       (new compiledjs.ShowdownJsImpl()).makeHtml(source, hostAndPort)
    sanitizeHtml(htmlTextUnsafe, makeLinksNofollow, allowClassIdDataAttrs)
  }


  def sanitizeHtml(htmlTextUnsafe: String,
        makeLinksNofollow: Boolean, allowClassIdDataAttrs: Boolean): NodeSeq = {

    var htmlTextSafe: String =
      (new compiledjs.HtmlSanitizerJsImpl()).googleCajaSanitizeHtml(
        htmlTextUnsafe,
        // Cannot specify param names, regrettably, since we're calling
        // Java / compiled Javascript code.
        allowClassIdDataAttrs, // allowClassAndIdAttr
        allowClassIdDataAttrs) // allowDataAttr

    // As of 2011-08-18 the Google Caja js html sanitizer strips
    // target='_blank', (Seems to be a bug:
    // `Issue 1296: target="_blank" is allowed, but cleared by html_sanitize()'
    // http://code.google.com/p/google-caja/issues/detail?id=1296  )
    // Add target _blank here - not needed any more, I ask "do you really
    // want to close the page?" if people have started writing.
    //   htmlTextSafe = htmlTextSafe.replace("<a ", "<a target='_blank' ")

    if (makeLinksNofollow)
      htmlTextSafe = htmlTextSafe.replace("<a ", "<a rel='nofollow' ")

    // Use a HTML5 parser; html_sanitize outputs HTML5, which Scala's XML
    // parser don't understand (e.g. an <img src=…> tag with no </img>).
    // Lift-Web uses a certain nu.validator HTML5 parser; use it.
    // (html_sanitize, from Google Caja, also uses the very same parser.
    // So html_sanitize probably generates html that Lift-Web's version
    // of the nu.validator parser understands.)
    // Wrap the html text in a dummy tag to avoid a SAXParseException.
    liftweb.Html5.parse("<div>"+ htmlTextSafe +"</div>").get.child
  }


  /** Replaces spaces with the Unicode representation of non-breaking space,
   *  which is interpreted as {@code &nbsp;} by Web browsers.
   */
  def spaceToNbsp(text: String): String = text.replace(' ', '\u00a0')


  /**
   * Shows a link to the user represented by NiLo.
   */
  def linkTo(nilo: NiLo, config: HtmlConfig): NodeSeq = linkTo(nilo)  // for now


  // COULD move to object HtmlPostSerializer
  def linkTo(nilo: NiLo): NodeSeq = {
    var url = ""  // since not implemented anyway: config.userUrl(nilo)

    // COULD investigate: `url' is sometimes the email address!!
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

  /**
   * A script tag that hides comments and shows them on click.
   */
  val tagsThatHideShowInteractions = (
    <script type="text/javascript">
    jQuery('html').addClass('dw-hide-interactions');
    debiki.scriptLoad.done(function() {{
      debiki.v0.showInteractionsOnClick();
    }});
    </script>
  )

  private def _attrEq(name: String, value: String)(node: Node) =
    node.attribute(name).filter(_.text == value).isDefined

  // COULD move to HtmlPostSerializer
  def findChildrenOfNode(withClass: String, in: NodeSeq): Option[NodeSeq] =
    (in \\ "_").filter(_attrEq("class", withClass)).
        headOption.map(_.child)

  case class SerializedSingleThread(
    prevSiblingId: Option[String],
    htmlNodes: NodeSeq)


  def wrapInPageTag(page: PageStuff)(body: NodeSeq): NodeSeq =
    wrapInPageTag(page.meta, page.path)(body)


  def wrapInPageTag(pageMeta: PageMeta, pagePath: PagePath)(body: NodeSeq): NodeSeq = {
    <div id={"page-"+ pageMeta.pageId} class='debiki dw-debate dw-page'
        data-page_exists={pageMeta.pageExists.toString}
        data-page_path={pagePath.path}
        data-page_role={pageMeta.pageRole.toString}
        data-parent_page_id={pageMeta.parentPageId.map(_.toString) getOrElse ""}>
      { body }
    </div>
  }

}



case class HtmlPageSerializer(
  pageStuff : PageStuff,
  pageTrust: PageTrust,
  pageRoot: PageRoot,
  config: HtmlConfig,
  showComments: Boolean) {

  import HtmlPageSerializer._

  // COULD rename some of these weirdly named fields.
  private def debate = pageStuff.actions
  private def page = pageStuff.actions
  private def pagePath = pageStuff.path
  private def pageRole = pageStuff.role
  private def parentPageId = pageStuff.parentPageId


  private lazy val pageStats = new PageStats(debate, pageTrust)

  private def lastChange: Option[String] =
    debate.lastOrLaterChangeDate.map(toIso8601(_))


  private def postRenderer =
    HtmlPostRenderer(pageStuff.actions, pageStats, config.hostAndPort)


  def serializeSingleThread(postId: String)
        : Option[SerializedSingleThread] = {
    page.vipo(postId) map { post =>
      val html = _layoutComments(depth = post.depth,
         parentReplyBtn = Nil,
         posts = post::Nil)
      val siblingsSorted = _sortPostsDescFitness(post.siblingsAndMe)
      var prevSibling: Option[ViPo] = None
      siblingsSorted.takeWhile(_.id != postId).foreach { sibling =>
        prevSibling = Some(sibling)
      }
      SerializedSingleThread(prevSibling.map(_.id), html)
    }
  }


  /**
   * The results from layoutPosts doesn't depend on who the user is
   * and can thus be cached. If a user has rated comment or has written
   * comments that are pending approval, then info on that stuff is
   * appended at the end of the server's reply (in a special <div>), and
   * client side Javascript update the page with user specific stuff.
   */
  def layoutPage(): NodeSeq = /*Stats.time("layoutPage")*/ {

    val cssArtclThread =
      if (pageRoot.subId == Page.BodyId) " dw-ar-t" else ""
    val rootPostsReplies = pageRoot.findChildrenIn(debate)
    val rootPost: ViPo = pageRoot.findOrCreatePostIn(debate) getOrElse
       throwNotFound("DwE0PJ404", "Post not found: "+ pageRoot.subId)

    wrapInPageTag(pageStuff) {
      <div class="dw-debate-info">{
        if (lastChange isDefined) {
          <p class="dw-last-changed">Last changed on
          <abbr class="dw-date"
                title={toIso8601T(lastChange.get)}>{lastChange.get}</abbr>
          </p>
        }
      }
      </div>
      <div id={"dw-t-"+ rootPost.id}
           class={"dw-t"+ cssArtclThread +" dw-depth-0 dw-hor"}>
      {
        val renderedRoot = postRenderer.renderPost(rootPost.id)
        renderedRoot.html ++
        ifThen(showComments, {
          val replyBtn = _replyBtnListItem(renderedRoot.replyBtnText)
          <div class='dw-t-vspace'/>
          <ol class='dw-res'>{
            _layoutComments(1, replyBtn, rootPostsReplies)
          }
          </ol>
        })
      }
      </div>
    }
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


  private def _sortPostsDescFitness(posts: List[ViPo]): List[ViPo] = {
    // Sort by: 1) Fixed position, 2) deleted? (see below)
    // 3) fitness, descending, 4) time, ascending.
    // Concerning deleted posts: Place them last, since they're rather
    // uninteresting. Sort by num replies (to the deleted comment).
    // COULD sort by *subthread* ratings instead (but not by rating of
    // deleted comment, since it's not visible).
    // Could skip sorting inline posts, since sorted by position later
    // anyway, in javascript. But if javascript disabled?
    posts.sortBy(p => p.creationDati.getTime) // the oldest first
      .sortBy(p => -pageStats.ratingStatsFor(p.id)
          .fitnessDefaultTags.lowerLimit)
      .sortBy(p => if (p.isDeleted) -p.replyCount else Int.MinValue)
      .sortBy(p => p.meta.fixedPos.getOrElse(Int.MaxValue))
  }


  private def _layoutComments(depth: Int,
                              parentReplyBtn: NodeSeq,
                              posts: List[ViPo]): NodeSeq = {
    // COULD let this function return Nil if posts.isEmpty, and otherwise
    // wrap any posts in <ol>:s, with .dw-ts or .dw-i-ts CSS classes
    // — this would reduce dupl wrapping code.
    var replyBtnPending = parentReplyBtn.nonEmpty

    var comments: NodeSeq = Nil
    for {
      post <- _sortPostsDescFitness(posts)
      p = post // COULD remove
      cssThreadId = "dw-t-"+ p.id
      cssDepth = "dw-depth-"+ depth
      isInlineThread = p.where.isDefined
      isInlineNonRootChild = isInlineThread && depth >= 2
      cssInlineThread = if (isInlineThread) " dw-i-t" else ""
      replies = p.replies
      vipo = p // debate.vipo_!(p.id)
      isRootOrArtclQstn =
          vipo.id == pageRoot.subId || vipo.meta.isArticleQuestion
      // Layout replies horizontally, if this is an inline reply to
      // the root post, i.e. depth is 1 -- because then there's unused space
      // to the right. However, the horizontal layout results in a higher
      // thread if there's only one reply. So only do this if there's more
      // than one reply.
      horizontal = (p.where.isDefined && depth == 1 && replies.length > 1) ||
                    isRootOrArtclQstn
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
    } {
      val renderedComment: RenderedPost = postRenderer.renderPost(vipo.id)

      val (myReplyBtn, actionLink) =
        if (isRootOrArtclQstn)
           (_replyBtnListItem(renderedComment.replyBtnText), Nil)
        else
          (Nil,
            <a class='dw-as' href={HtmlConfig.reactUrl(debate.guid, post.id) +
              "&view="+ pageRoot.subId}>React</a>)

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
        else <ol class='dw-res'>
          { _layoutComments(depth + 1, myReplyBtn, replies) }
        </ol>

      var thread = {
        val cssHoriz = if (horizontal) " dw-hor" else ""
        <li id={cssThreadId} class={"dw-t "+ cssDepth + cssInlineThread +
               cssFolded + cssHoriz + cssThreadDeleted + cssArticleQuestion}>{
          foldLink ++
          renderedComment.html ++
          actionLink ++
          repliesHtml
        }</li>
      }

      val horizontalLayout = parentReplyBtn.nonEmpty
      if (horizontalLayout) {
        // Make this thread resizable, eastwards, by wrapping it in a <div>.
        // The <li> has display: table-cell and cannot be resized, so we'll
        // resize the <div> instead.
        thread = thread.copy(label = "div")
        thread = <li>{ thread }</li>
      }

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
}



object UserHtml {

  def renderInbox(notfs: Seq[NotfOfPageAction]): NodeSeq = {
    if (notfs.isEmpty)
      return  <div class='dw-ibx'><div class='dw-ibx-ttl'/></div>;

    <div class='dw-ibx'>
      <div class='dw-ibx-ttl'>Your inbox:</div>
      <ol> {
        for (notf <- notfs.take(20)) yield {
          val pageAddr = "/-"+ notf.pageId
          val postAddr = pageAddr +"#post-"+ notf.recipientActionId

          notf.eventType match {
            case NotfOfPageAction.Type.PersonalReply =>
              // COULD look up address in PATHS table when loading
              // InboxItem from database -- to get rid of 1 unnecessary redirect.
              <li><a href={postAddr}>1 reply on {notf.pageTitle}</a>,
                by <em>{notf.eventUserDispName}</em>
              </li>

            case _ =>
              // I won't forget to fix this later, when I add more notf types.
              <li><a href={postAddr}>1 something on {notf.pageTitle}</a>,
                by <em>{notf.eventUserDispName}</em>
              </li>
          }
        }
      }
      </ol>
    </div>
  }
}



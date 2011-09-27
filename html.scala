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
import _root_.scala.xml.{NodeSeq, Elem, Text, XML, Attribute}
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

  /** XML for the user name and login/out links.
   */
  def loginInfo(userName: Option[String]): NodeSeq = {
    <div id='dw-login-info'>
      <div class='dw-login-lgd-in-as'>Logged in as</div>
      <div class='dw-login-name'>{
        userName match {
          case Some(name) => Text("Logged in as "+ name)
          case None => Nil
        }
      }</div>
    </div>
    <a id='dw-a-login'>Log in</a>
    <a id='dw-a-logout'>Log out</a>
  }
}


class DebateHtml(val debate: Debate) {

  import DebateHtml._

  private var config: HtmlConfig = _  // COULD let be a ctor param

  private lazy val statscalc: StatsCalc = new StatsCalc(debate)
  private var lastChange: Option[String] = null

  def configure(conf: HtmlConfig): DebateHtml = {
    this.config = conf
    this
  }

  def layoutDebate(permsOnPage: PermsOnPage): NodeSeq = {
    this.lastChange = debate.lastChangeDate.map(toIso8601(_))
    layoutPosts ++ FormHtml(config, permsOnPage).menus
  }

  private def layoutPosts(): NodeSeq = {
    val rootPosts = debate.repliesTo(Debate.RootPostId)
    val rootPost = debate.post(Debate.RootPostId)
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
        // If there's no root post, add an empty <div .dw-p>. It's required
        // because JavaScript elsewhere finds .dw-t:s by finding .dw-p parents.
        rootPost.map(comment(_)).getOrElse(
            <div id={"dw-t-"+ Debate.RootPostId} class={"dw-p"} />) ++
        <div class='dw-t-vspace'/>
        <div class='dw-hor-a'>
          <a class='dw-a dw-a-reply'>Reply</a>
        </div>
        <ol class='dw-res ui-helper-clearfix'>{
          _layoutPosts(1, rootPosts)
        }
        </ol>
      }
      </div>
    </div>
  }

  private def _layoutPosts(depth: Int, posts: List[Post]): NodeSeq = {
    // COULD rename to _layoutReplies.
    // COULD let this function return Nil if posts.isEmpty, and otherwise
    // wrap any posts in <ol>:s, with .dw-ts or .dw-i-ts CSS classes
    // — this would reduce dupl wrapping code.
    for {
      // Could skip sorting inline posts, since sorted by position later
      // anyway, in javascript. But if javascript disabled?
      p <- posts.sortBy(p => p.date.getTime). // the oldest first
                sortBy(p => -statscalc.scoreFor(p.id).liking)
      cssThreadId = "dw-t-"+ p.id
      cssDepth = "dw-depth-"+ depth
      cssInlineThread = if (p.where isDefined) " dw-i-t" else ""
    }
    yield {
      var li =
        <li id={cssThreadId} class={"dw-t "+ cssDepth + cssInlineThread}>
        {
          comment(p) ++
          (if (debate.repliesTo(p.id).isEmpty) Nil
          else
            <ol class='dw-res'>
              { _layoutPosts(depth + 1, debate.repliesTo(p.id)) }
            </ol>)
        }
        </li>
      // For inline comments, add info on where to place them.
      if (p.where isDefined) li = li % Attribute(
          None, "data-dw-i-t-where", Text(p.where.get), scala.xml.Null)
      li
    }
  }

  private def comment(post: Post): NodeSeq = {
    val vipo = debate.vipo_!(post.id)
    val count = debate.successorsTo(post.id).length + 1
    val editApps = debate.editsAppliedTo(post.id)
    val lastEditApp = editApps.headOption
    val cssPostId = "dw-post-"+ post.id
    val sourceText = lastEditApp.map(_.result).getOrElse(post.text)
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
    val long = numLines > 9
    val cutS = if (long && post.id != Debate.RootPostId) " dw-x-s" else ""
    val author = debate.authorOf_!(post)

    def tryLinkTo(nilo: NiLo): NodeSeq = {
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
      // Include user id if present.
      //nilo.user.foreach { u =>
      //  link % Attribute(None, "data-uid", Text(u.id), xml.Null)
      //}
      userLink
    }

    val score = statscalc.scoreFor(post.id)
    val ratStatsSorted = score.labelStatsSorted
    val topTags = if (ratStatsSorted isEmpty) Nil else {
      // If there're any really popular tags (lower liking bound > 0.4),
      // show all those. Otherwise, show only the most popular tag(s).
      val minLower = Math.min(0.4, ratStatsSorted.head._2.fractionLowerBound)
      ratStatsSorted.takeWhile(_._2.fractionLowerBound >= minLower)
    }
    val rats = ratStatsSorted
    val ratsList: NodeSeq =
      if (rats.isEmpty) Nil
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
        (if (topTags isEmpty) Nil
        else <span class='dw-p-ra dw-p-ra-top'>, rated <i>{
          topTags.take(3).map(showRating(_)).mkString(", ") }</i></span>) ++
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
        }</ol></div>
      }
    val editInfo =
      // If closed: <span class='dw-p-re-cnt'>{count} replies</span>
      if (editApps.isEmpty) Nil
      else {
        val lastEditDate = editApps.head.date
        <div class='dw-p-hdr-ed'>Edited by {
            // This identityt test doesn't take into account that a user
            // can have many identities (e.g. Twitter, Facebook, Gmail), so
            // even if many different identities have edited the post,
            // perhaps only one single user has edited it. Cannot easily
            // compare users though, because IdentitySimple maps to no user!
            if (editApps.map(a => debate.vied_!(a.editId).identity_!.id).
                distinct.length > 1) {
              <a>various people</a>
            } else {
              val editor = debate.authorOf_!(debate.editsById(
                           lastEditApp.get.editId))
              tryLinkTo(editor)
            }
          }{dateAbbr(lastEditDate, "dw-p-at")}
        </div>
      }
    val editSuggestions: NodeSeq =
      if (!config.showEdits_?) Nil
      else {
        def xmlFor(edit: Edit): NodeSeq = {
          <li class='dw-es'>
            <div class='dw-es-vs' />
            <div class='dw-es-ed'>
              <div class='dw-ed-desc'>
                {textToHtml(edit.desc)._1}
              </div>
              — { // (the dash is an em dash no a minus)
                val editor = debate.authorOf_!(edit)
                tryLinkTo(editor)
              }{ dateAbbr(edit.date, "dw-ed-at") }
              <pre class='dw-ed-text'>{edit.text}</pre>
            </div>
          </li>
        }
        val suggestions = debate.editsPendingFor(post.id)
                          .sortBy(e => -statscalc.likingFor(e).lowerBound)
        <ul class='dw-ess'>
          { for (edit <- suggestions) yield xmlFor(edit) }
        </ul>
        <a class='dw-a dw-a-edit-new'>Suggest edit</a>
      }

    // COULD find a better name for the two data-p-by-...-sh attrs below.
    // Also, perhaps they should be part of the .dw-p-by <a>?
    // the – on the next line is an `en dash' not a minus
    <a class='dw-z'>[–]</a>
    <div id={cssPostId} class={"dw-p" + cutS}
         data-p-by-email-sh={""/* author.emailSaltHash - consider security*/}
         data-p-by-ip-sh={vipo.ipSaltHash_!}>
      <div class='dw-p-hdr'>
        By { tryLinkTo(author)}{ dateAbbr(post.date, "dw-p-at")
        }{ ratsList }{ editInfo }
      </div>
      <div class='dw-p-bdy'>
        { xmlText }
      </div>
    </div> ++ (
      if (post.id == Debate.RootPostId) Nil // actions already added by caller
      else <a class='dw-as' href={config.reactUrl(debate.guid, post.id)}
            >React</a> ) ++
     { editSuggestions // could skip for now, too complicated for the end user
      }
  }
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

  val ccWikiLicense =
    <a rel="license" href="http://creativecommons.org/licenses/by/3.0/"
       target="_blank">CC BY-SA 3.0</a>

  private[v0]
  def menus =
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
        {/*<a class='dw-a dw-a-edit'>Edit</a>*/}
        <a class='dw-a dw-a-flag'>Report</a>
        <a class='dw-a dw-a-delete'>Delete</a>
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
             <label for='dw-fi-login-email'>Email (optional)</label><br/>
             <input id='dw-fi-login-email' type='text' size='40'
                  maxlength='100' name='dw-fi-login-email' value=''/><br/>
             <!-- <span class='edit-field-overlay'
                >required, but never shown</span> -->
            </div>
            <div>
             <label for='dw-fi-login-url'>Website (optional)</label><br/>
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
                rateBox("funny")
              }</div>
              <div class='dw-rat-tag-set'>{
                rateBox("boring") ++
                rateBox("stupid")
              }</div>
              <a class='dw-show-more-rat-tags'>More...</a>
              <div class='dw-rat-tag-set dw-more-rat-tags'>{
                rateBox("off-topic") ++
                rateBox("spam") ++
                rateBox("troll")
              }</div>
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
    import Flag._
    val r = Inp.Reason
    <div class='dw-fs' title='Report Comment'>
      <form id='dw-f-flg' action={config.flagAction} accept-charset='UTF-8'
            method='post'>
        { _xsrfToken }
        <div class='dw-f-flg-rsns'>{
          def input(idSuffix: String, value: String, text: String) = {
            val id = "dw-fi-flgs-"+ idSuffix
              <input type='radio' id={id} name={r} value={value}/>
              <label for={id}>{text}</label>
          }
          input("spam", Spam.toString, "Spam") ++
          input("copy", Copyright.toString, "Copyright Violation") ++
          input("ilgl", Illegal.toString, "Illegal") ++
          input("othr", Other.toString, "Other")
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
                 name={Inp.DeleteTree} value={deleteTreeLabel} />
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

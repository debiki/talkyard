// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package com.debiki.v0

import java.{util => ju, io => jio}
import scala.collection.JavaConversions._
import collection.{mutable => mut, immutable => imm}
import _root_.net.liftweb.common.{Box, EmptyBox, Failure}
import _root_.net.liftweb.util.ControlHelpers.tryo
import _root_.scala.xml.{NodeSeq, Elem, Text, XML, Attribute}
import Prelude._


private[debiki]
object Paths {
  val EditsProposed = "edits/proposed/post/"
}


class HtmlConfig {
  // If a form action is the empty string, the browser POSTS to the current
  // page, says the URI spec: http://www.apps.ietf.org/rfc/rfc3986.html#sec-5.4
  // COULD rename replyAction -> replyLink (or reactLink -> reactAction).
  def replyAction = ""
  def rateAction = ""
  def editAction = ""
  def loginActionSimple = ""
  def loginActionOpenId = ""
  def loginOkAction = ""
  def loginFailedAction = ""
  def logoutAction = ""

  /** A function from debate-id and post-id to a react URL.
   */
  def reactLink(debateId: String, postId: String) = "?act="+ postId

  /** Constructs a URL to more info on a certain user,
   *  adds "http://" if needed.
   */
  def userLink(user: User) = {
    if (user.website isEmpty) {
      ""
    } else if ("https\\?://".r.findFirstIn(user.website) isDefined) {
      user.website
    } else {
      "http://"+ user.website
    }
  }

  /** Whether or not to show edit suggestions. */
  def showEdits_? = true
  def hostAndPort = "localhost"
  def people = new People()
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
  def dateToAbbr(date: ju.Date, cssClass: String): NodeSeq =
    <abbr class={"dw-date "+ cssClass} title={toIso8601(date)} />

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

  private var config = new HtmlConfig

  private lazy val statscalc: StatsCalc = new StatsCalc(debate)
  private var lastChange: Option[String] = null

  def configure(conf: HtmlConfig): DebateHtml = {
    this.config = conf
    this
  }

  def layoutDebate(intrsAllowed: IntrsAllowed): NodeSeq = {
    this.lastChange = debate.lastChangeDate.map(toIso8601(_))
    layoutPosts ++ FormHtml(config, intrsAllowed).menus
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
                title={lastChange.get}>{lastChange.get}</abbr>
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
      // COULD sort inline posts by position, not score.
      p <- posts.sortBy(p => -statscalc.scoreFor(p.id).liking)
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
    val count = debate.successorsTo(post.id).length + 1
    val dateCreated = toIso8601(post.date)
    val editApps = debate.editsAppliedTo(post.id)
    val lastEditApp = editApps.headOption
    val lastEditDate = editApps.headOption.map(ea => toIso8601(ea.date))
    val cssPostId = "dw-post-"+ post.id
    val sourceText = lastEditApp.map(_.result).getOrElse(post.text)
    val (xmlText, numLines) =
        // Apply markup to the root post (e.g. blog entry).
        //if (post.id == Debate.RootPostId) (markdownToHtml(sourceText), -1)
        //else textToHtml(sourceText)
        (markdownToHtml(sourceText, config.hostAndPort), -1)
        // COULD convert only <img> & <pre> tags,
        //… but nothing that makes text stand out, e.g. skip <h1>, <section>.
        // For the root post, allow everything but javascript though.
    val long = numLines > 9
    val cutS = if (long && post.id != Debate.RootPostId) " dw-x-s" else ""
    val author = config.people.authorOf(post) openOr {
      // COULD remember an error somewhere?
      User.unknown
    }

    def tryLinkTo(user: User) = {
      val url = config.userLink(user)
      if (url nonEmpty) {
        SECURITY // `url' is sometimes the email address!!
        // When signed in @gmail.com, it seems.
        <a class='dw-p-by' href={url}
          rel='nofollow' target='_blank'>{user.name}</a>
      } else {
        <span class='dw-p-by'>{user.name}</span>
      }
    }

    val score = statscalc.scoreFor(post.id)
    val ratStatsSorted = score.labelStatsSorted
    val rats = ratStatsSorted //.takeWhile(_.fractionLowerBound > 0.25)
    val ratsList =
      if (rats.isEmpty) Nil
      else
        <br/> ++ Text(rats.length +" ratings:") ++
        <ol class='dw-rats'>{
          // Don't change whitespace, or `editInfo' perhaps won't
          // be able to append a ',' with no whitespace in front.
          for ((tag: String, stats: LabelStats) <- rats) yield
          <li class="dw-rat" data-stats={
              ("lo: %.0f" format (100 * stats.fractionLowerBound)) +"%, "+
              "sum: "+ stats.sum}> {
            tag +" %.0f" format (100 * stats.fraction)}% </li>
        }</ol>
    val editInfo =
      // If closed: <span class='dw-p-re-cnt'>{count} replies</span>
      if (editApps.isEmpty) Nil
      else
        <div class='dw-p-hdr-ed'><b>Edited</b> by {
            if (editApps.map(a => debate.editsById(a.editId).by).
                distinct.length > 1) {
              <a>various people</a>
            } else {
              val editor = config.people.authorOf(debate.editsById(
                           lastEditApp.get.editId)) openOr User.unknown
              tryLinkTo(editor)
            }
          }, <abbr class='dw-p-at dw-date' title={lastEditDate.get}>{
              lastEditDate.get}</abbr>
        </div>
    val editSuggestions: NodeSeq =
      if (!config.showEdits_?) Nil
      else {
        def xmlFor(edit: Edit): NodeSeq = {
          val dateCreated = toIso8601(edit.date)
          <li class='dw-es'>
            <div class='dw-es-vs' />
            <div class='dw-es-ed'>
              <div class='dw-ed-desc'>
                {textToHtml(edit.desc)._1}
              </div>
              — { // (the dash is an em dash no a minus)
                val editor = config.people.authorOf(edit) openOr User.unknown
                tryLinkTo(editor)
              },
              <abbr class='dw-ed-at dw-date'
                  title={dateCreated}>{dateCreated}</abbr>
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
         data-p-by-email-sh={author.emailSaltHash}
         data-p-by-ip-sh={post.ipSaltHash}>
      <div class='dw-p-hdr'>
        By { tryLinkTo(author) },
        <abbr class='dw-p-at dw-date'
            title={dateCreated}>{dateCreated}</abbr>{
        ratsList }{
        editInfo }
      </div>
      <div class='dw-p-bdy'>
        { xmlText }
      </div>
    </div> ++ (
      if (post.id == Debate.RootPostId) Nil // actions already added by caller
      else <a class='dw-as' href={config.reactLink(debate.guid, post.id)}
            >React</a> ) ++
     { editSuggestions // could skip for now, too complicated for the end user
      }
  }
}


object FormHtml {

  def apply(config: HtmlConfig, intrsAllowed: IntrsAllowed) =
    new FormHtml(config, intrsAllowed)

  object Reply {
    object InputNames {
      val Text = "dw-fi-reply-text"
      val Where = "dw-fi-reply-where"
    }
  }

  object Edit {
    object InputNames {
      val Text = "dw-fi-ed-txt"
      val Preview = "dw-fi-ed-preview"
    }
  }
}


class FormHtml(val config: HtmlConfig, val intrsAllowed: IntrsAllowed) {

  import FormHtml._

  val ccWikiLicense =
    <a rel="license" href="http://creativecommons.org/licenses/by/3.0/"
       target="_blank">
      Creative Commons Attribution 3.0 Unported License
    </a>

  private[v0]
  def menus =
    <div id="dw-hidden-templates">
    { actionMenu ++
      loginForms ++
      replyForm() ++
      ratingForm }
    </div>

  def loginForms =
    loginFormSimple ++
    loginFormOpenId ++
    loginOkForm() ++
    loginFailedForm() ++
    logoutForm

  def actionMenu =
      <div id='dw-action-menu'>
        <a class='dw-a dw-a-reply'>Reply</a>
        <a class='dw-a dw-a-rate'>Rate</a>
        <a class='dw-a dw-a-edit'>Edit</a>
      </div>
      // Could skip <a>Edit</a> for now, and teach people to
      // use the inline menu instead?

  /**
   *  The login form below is based on this JavaScript OpenID Selector
   *  example file:
   *    debiki-core/src/main/resources/toserve/0/lib/openid-selector/demo.html
   */
  def loginFormSimple =
      <div class='dw-fs' id='dw-fs-login-simple' title='Who are you?'>
        <form action={config.loginActionSimple} method='post'>
          <div id='dw-login'>
           <div class='dw-login-a-wrap'>
            <a class='dw-a dw-a-login-openid'>Log in</a>
            <div class='dw-login-or-word'>or</div>
           </div>
           <div class='dw-login-fields'>
            <div>
             <label for='dw-fi-login-name'>Name</label><br/>
             <input id='dw-fi-login-name' type='text' size='40' maxlength='100'
                  name='dw-fi-login-name' value='Anonymous'/>
             <br/>
            </div>
            <div>
             <label for='dw-fi-login-email'>Email</label><br/>
             <input id='dw-fi-login-email' type='text' size='40'
                  maxlength='100' name='dw-fi-login-email' value=''/><br/>
             <!-- <span class='edit-field-overlay'
                >required, but never shown</span> -->
            </div>
            <div>
             <label for='dw-fi-login-url'>Website</label><br/>
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
          <p>Are you sure?</p>
          <div class='dw-submit-set'>
            <input class='dw-fi-cancel' type='button' value='Cancel'/>
            <input class='dw-fi-submit' type='submit' value='Log out'/>
          </div>
        </form>
      </div>

  def actLinks(pid: String) = {
    val safePid = safe(pid)  // Prevent xss attacks.
    // In the future, perhaps match on `intrsAllowed'.
    <ul>
     <li><a href={"?reply="+ safePid}>Reply to post</a></li>
     <li><a href={"?rate="+ safePid}>Rate it</a></li>
     <li><a href={"?edit="+ safePid}>Suggest edit</a></li>
    </ul>
  }

  def replyForm(text: String = "", extraInputs: NodeSeq = Nil) = {
      import Reply.{InputNames => Inp}
    val submitButtonText = "Post as ..." // COULD read user name from `config'
      <li class='dw-fs dw-fs-re'>
        <form
            action={config.replyAction}
            accept-charset='UTF-8'
            method='post'>
          { extraInputs }
          { timeWaistWarning("reply is") }
          <input type='hidden' id={Inp.Where} name={Inp.Where} value='' />
          <p>
            <label for={Inp.Text}>Your reply:</label><br/>
            <textarea id={Inp.Text} name={Inp.Text} rows='13'
              cols='38'>{text}</textarea>
          </p>
          <p class='dw-user-contrib-license'>
            By clicking <i>{submitButtonText}</i>, you agree to license
            the text you submit under the {ccWikiLicense}.
            {/* TODO "irrecoverably agree to ... sufficient attribution ...
            URL in the history/change log page ... name OR alias ...
            printed version" */}
          </p>
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
          <input type='hidden' name='dw-fi-action' value='rate'/>
          <input type='hidden' name='dw-fi-post' value='?'/>
          <input type='hidden' name='dw-fi-by' value='?'/>
          {
            var boxCount = 1
            def rateBox(value: String) = {
              val name = "dw-fi-rat-tag"
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

  def editForm(newText: String = "", oldText: String = "",
               userName: Box[String],
              extraInputs: NodeSeq = Nil) = {
    import Edit.{InputNames => Inp}
    val submitBtnText = "Save as "+ userName.openOr("...")
    <form class='dw-f dw-f-ed'
          action={config.editAction}
          accept-charset='UTF-8'
          method='post'>
      { extraInputs /* Or *require* a XSRF token also/instead? */ }
      { timeWaistWarning("edits are") }
      <div id='dw-ed-tabs'>
        <ul>
          <li><a href='#dw-ed-tab-edit'>Edit</a></li>
          <li><a href='#dw-ed-tab-diff'>Diff</a></li>
          <li><a href='#dw-ed-tab-preview'>Preview</a></li>
        </ul>
        <div id='dw-ed-tab-edit' class='dw-ed-tab'>
          <textarea id='dw-fi-edit-text' name={Inp.Text} rows='7' cols='38'>{
            newText
          }</textarea>
        </div>
        <div id='dw-ed-tab-preview' class='dw-ed-tab'>
        </div>
        <div id='dw-ed-tab-diff' class='dw-ed-tab'>
        </div>
        { // In debiki.js, updateEditFormDiff() uses textarea.val()
          // (i.e. newText) if there's no .dw-ed-src-old tag.
          if (oldText == newText) Nil
          else <pre class='dw-ed-src-old'>{oldText}</pre> }
      </div>

      <div class='dw-submit-set'>
       {/* License agreement !! */}
       <input type='button' class={Inp.Preview} name={Inp.Preview}
              value='Preview and save ...'/>
       <input type='submit' class='dw-fi-submit' value={submitBtnText}/>
       <input type='button' class='dw-fi-cancel' value='Cancel'/>
      </div>
    </form>
  }

  def timeWaistWarning(action_is: String): NodeSeq = {
    import IntrsAllowed._
    intrsAllowed match {
      case VisibleTalk => Nil
      case HiddenTalk =>  // COULD fix nice CSS and show details on hover only
        <div><i>Time waist warning: Your {action_is} shown only to
        people who explicitly choose to view user interactions.
        Perhaps no one will ever notice your contributions!
        </i></div>
    }
  }
}

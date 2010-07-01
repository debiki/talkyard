// vim: ts=2 sw=2 et
/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package com.debiki.v0

import java.{util => ju}
import collection.{mutable => mut, immutable => imm}
import _root_.scala.xml.{NodeSeq, Elem}
import Prelude._

// Should be a LayoutManager static class, but how can I then acces
// it from Java?
class LayoutConfig {
  // These default form action values (the empty string) reload the current
  // page, says this RFC: http://www.apps.ietf.org/rfc/rfc3986.html#sec-5.4
  var replyAction = ""
  var voteAction = ""
}

class LayoutVariables {
  var lastPageVersion: Option[ju.Date] = None
  var newReply: Option[String] = None
}

object LayoutManager {

  /** Digs a {@code Reply} or a {@code Vote} out of a 
   *  {@code javax.servlet.ServletRequest.getParameterMap()}.
   *
   *  If {@code userName} specifies, ignores {@code dw-fi-author}
   *  and {@code dw-fi-voter}.
   *
   *  If {@code date} is {@code None}, uses the current date-time.
   *
   *  The param map maps input-names to input-value-arrays. This function
   *  searches the map for Debiki specific input/value data,
   *  and constructs a vote or a reply or nothing.
   */
  def digServletRequestParamMap(
        map: ju.Map[String, Array[String]],
        userName: Option[String],
        date: Option[ju.Date]): Option[Object] = {

    def hasValues(arr: Array[String]) = arr != null && !arr.isEmpty

    // Check the form-input-action map entry, to find out how to interpret
    // other map entries.
    map.get("dw-fi-action") match {
      case Array("reply") =>
        val posts = map.get("dw-fi-reply-to")
        val replyTexts = map.get("dw-fi-reply-text")
        val authors = map.get("dw-fi-reply-author")
        require(hasValues(posts), "Found no reply-to post")
        require(posts.length == 1, "More than one reply-to post")
        require(hasValues(replyTexts), "Found no reply text")
        require(replyTexts.length == 1, "More than one reply text")
        require(userName.isDefined || hasValues(authors), "Found no author")
        require(userName.isDefined || authors.length == 1,
                "Found more than one author")
        Some(Post(
                id = "?", // illegal id, only a-z allowed
                parent = posts.head,
                date = date.getOrElse(new ju.Date),
                owner = userName.orElse(Some(authors.head)),
                text = replyTexts.head))
      case Array("vote") =>
        val posts = map.get("dw-fi-vote-on")
        val values = map.get("dw-fi-vote-value")
        val voters = map.get("dw-fi-voter")
        require(hasValues(posts), "Found no vote-on post")
        require(posts.length == 1, "Found more than one vote-on post")
        require(hasValues(values), "Found no vote value")
        require(values.length < 100, "Less than 100 vote values") // safer?
        require(userName.isDefined || hasValues(voters), "Found no voter")
        require(userName.isDefined || voters.length == 1,
                "Found more than one voter")
        Some(Vote(
                postId = posts.head,
                voterId = voters.head,
                date = date.getOrElse(new ju.Date),
                values = values.toList))
      case Array(value) =>
        throw new IllegalArgumentException(
                  "Unknown dw-fi-action value ["+ safe(value) +"]")
      case Array(_, _, _*) =>
        throw new IllegalArgumentException("Too many action values")
      case _ =>
        None
    }
  }

  /** Converts text to xml, returns (html, approx-line-count).
   */
  private[v0]
  def textToHtml(text: String, charsPerLine: Int): Tuple2[Elem, Int] = {
    var lines = 0
    val xml =
        <div class="dw-text">{
          // Two newlines ends a paragraph.
          for (par <- text.split("\n\n").toList)
          yield {
            lines += 1 + par.length / charsPerLine
            <p>{par}</p>
          }
        }
        </div>
    (xml, lines)
  }

  /** Replaces spaces with the Unicode representation of non-breaking space,
   *  which is interpreted as {@code &nbsp;} by Web browsers.
   */
  private[v0]
  def spaceToNbsp(text: String): String = text.replace(' ', '\u00a0')

  private[v0]
  def dateToAbbr(date: ju.Date, cssClass: String): NodeSeq =
    <abbr class={"dw-date "+ cssClass} title={toIso8601(date)} />

  /** WARNING: XSS / DoS attacks possible?
   */
  private[v0]
  def optionToJsVar[E](o: Option[E], varName: String): String =
    "\n"+ varName +" = "+ (o match {
      case None => "undefined"
      case Some(null) => "null"
      case Some(d: ju.Date) => "'"+ toIso8601(d) +"'"
      case Some(x) => "'"+ x.toString +"'"
    }) +";"

  /** WARNING: XSS / DoS attacks possible?
   *  All available options:
   *    "expires: 7, path: '/', domain: 'jquery.com', secure: true"
   */
  private[v0]
  def optionToJsCookie[E](
          o: Option[E], cookieName: String, options: String = ""): String =
    if (o.isEmpty) ""  // do nothing with cookie
    else
      "\njQuery.cookie('"+ cookieName +"', "+
      ((o: @unchecked) match {
        case Some(null) => "null"  // delete cookie
        case Some(d: ju.Date) => "'"+ toIso8601(d) +"'"
        case Some(x) => "'"+ x.toString + "'"
      }) +
      (if (options.isEmpty) "" else ", {"+ options +"}") +
      ");"

}

import LayoutManager._

abstract class LayoutManager {

  def configure(conf: LayoutConfig)
  def layout(debate: Debate,
             vars: LayoutVariables = new LayoutVariables): NodeSeq

}

class SimpleLayoutManager extends LayoutManager {

  private var config = new LayoutConfig

  private var debate: Debate = null
  private var scorecalc: ScoreCalculator = null
  private var lastChange: Option[String] = null
  private var vars: LayoutVariables = null

  override def configure(conf: LayoutConfig) { this.config = conf }

  def layout(debate: Debate, vars: LayoutVariables): NodeSeq = {
    this.debate = debate
    this.vars = vars
    this.scorecalc = new ScoreCalculator(debate)
    this.lastChange = debate.lastChangeDate.map(toIso8601(_))
    layoutPosts ++ menus ++ variables
  }

  private def layoutPosts(): NodeSeq = {
    <div class="debiki dw-debate">
      <div class="dw-debate-info">{
        if (lastChange isDefined) {
          <p class="dw-last-changed">Last changed on
          <abbr class="dw-date"
                title={lastChange.get}>{lastChange.get}</abbr>
          </p>
        }
      }
      </div>
      { _layoutChildren(0, debate.RootPostId) }
    </div>
  }

  private def _layoutChildren(depth: Int, post: String): NodeSeq = {
    val childPosts: List[Post] = debate.repliesTo(post)
    for {
      c <- childPosts.sortBy(p => -scorecalc.scoreFor(p.id).score)
      cssThreadId = "dw-thread-"+ c.id
      cssDepth = "dw-depth-"+ depth
    }
    yield
      <div id={cssThreadId} class={cssDepth + " dw-thread"}>
        { threadInfoXml(c) }
        { postXml(c) }
        { _layoutChildren(depth + 1, c.id) }
      </div>
  }

  private def threadInfoXml(post: Post): NodeSeq = {
    val count = debate.successorsTo(post.id).length + 1
    if (count == 1)
      <ul class="dw-thread-info">
        <li class="dw-post-count">1 reply</li>
      </ul>
    else
      <ul class="dw-thread-info">
        <li class="dw-post-count">{count} replies</li>
        <li class="dw-vote">interesting</li>
        <li class="dw-vote">funny</li>
      </ul>
  }

  private def postXml(p: Post): NodeSeq = {
    val cssPostId = "dw-post-"+ p.id
    val (xmlText, numLines) = textToHtml(p.text, charsPerLine = 80)
    val long = numLines > 9
    val cropped_s = if (long) " dw-cropped-s" else ""
    val date = toIso8601(p.date)
    <div id={cssPostId} class={"dw-post dw-cropped-e" + cropped_s}>
      <div class='dw-post-info'>
        <div class='dw-owner-info'>By&#160;<span class="dw-owner">{
              spaceToNbsp(p.owner.getOrElse("whom?"))}</span></div>
        <div class="dw-vote-score">{ scorecalc.scoreFor(p.id).score }</div>
        <ul class='dw-vote-info'>{
          for ((value: String, sum: Float) <-
                  scorecalc.scoreFor(p.id).valueSumsSorted) yield
            <li class="dw-vote-is">
              <span class="dw-vote">{value}</span>
              <span class="dw-count">{"%.2f" format sum}</span>
            </li>
        }</ul>
        <ul class='dw-vote-info-non-weighted'>{
          // **Only for debugging**, css display is `none'.
          for ((value: String, sum: Int) <- debate.voteSumsFor(p.id)) yield
            <li class="dw-vote-is">
              <span class="dw-vote">{value}</span>
              <span class="dw-count">{sum}</span>
            </li>
        }</ul>
        <div class="dw-last-changed">
          <abbr class="dw-date" title={date}>
            {/* Show date on one line (10 chars), time on another. */}
            {date.take(10)}<br/>at {date.drop(11)}</abbr>
        </div>
      </div>
      { xmlText }
    </div>
  }

  val ccWikiLicense =
    <a rel="license" href="http://creativecommons.org/licenses/by/3.0/"
       target="_blank">
      Creative Commons Attribution 3.0 Unported License
    </a>

  private val submitButtonText = "Submit reply"

  /**
   *  Naming notes:
   *   - Form input names and ids always starts with "dw-fi-"
   *     ("fi" is for "form input").
   *  Security notes:
   *   - Only send [<form>s with side effects] using the POST
   *     method (never GET), to make XSRF attacks harder.
   */
  private def menus = {
    <div id="dw-hidden-menus">
      <div id='dw-action-menu' class='ui-state-default'>
        <div class='dw-reply'>Reply</div>
        <div class='dw-vote'>Vote</div>
      </div>
      <div class='dw-reply-template'>
        <div class='dw-depth-3 dw-thread dw-reply dw-preview'>
          <div class='dw-post'>
            <div class='dw-owner'><i>Your reply</i></div>
          </div>
          <form class='dw-reply'
              action={config.replyAction}
              accept-charset='UTF-8'
              method='post'>
            <input type='hidden' name='dw-fi-action' value='reply'/>
            <input type='hidden' name='dw-fi-reply-to' value='?'/>
            <textarea name='dw-fi-reply-text' rows='10' cols='34'
              >The cat was playing in the garden.</textarea><br/>
            <label for='dw-fi-reply-author'>Your name or alias:</label>
            <input id='dw-fi-reply-author' type='text'
                  name='dw-fi-reply-author' value='Anonymous'/><br/>
            <p class='dw-user-contrib-license'>
              By clicking <i>{submitButtonText}</i>, you agree to license
              the text you submit under the {ccWikiLicense}.
            </p>
            <input class='dw-submit' type='submit' value={submitButtonText}/>
            <button class='dw-cancel' type='button'>Cancel</button>
          </form>
        </div>
      </div>
      <div class='dw-vote-template'>
        <form class='dw-vote'
            action={config.voteAction}
            accept-charset='UTF-8'
            method='post'>
          <input type='hidden' name='dw-fi-action' value='vote'/>
          <input type='hidden' name='dw-fi-vote-on' value='?'/>
          <input type='hidden' name='dw-fi-voter' value='?'/> {/* for now */}
          {
            var boxCount = 1
            def voteBox(value: String) = {
              val name = "dw-fi-vote-value"
              val id = name +"-"+ boxCount
              boxCount += 1
              <input id={id} type='checkbox' name={name} value={value} />
              <label for={id}>{value}</label><br/>
            }

            {/* temporary layout hack */}
            <div class='dw-vote-column-1'>{
              voteBox("interesting") ++
              voteBox("boring") ++
              voteBox("funny")
            }</div>
            <div class='dw-vote-column-2'>{
              voteBox("insightful") ++
              voteBox("faulty")
              /* <a class='dw-show-more-votes'>More...</a> */
            }</div>
            <div class='dw-vote-column dw-more-votes'>{
              voteBox("off-topic") ++
              voteBox("spam") ++
              voteBox("troll")
            }</div>
          }
          <input class='dw-submit' type='submit' value='Submit votes'
              disabled='disabled'/> {/* enabled on checkbox click */}
          <input class='dw-cancel' type='button' value='Cancel'/>
        </form>
      </div>
    </div>
  }

  private def variables: NodeSeq =
    <script class='dw-js-variables'>{
      // TODO: Could this open for XSS attacks?
      optionToJsCookie(vars.lastPageVersion, "myLastPageVersion",
                          "expires: 370") +
      optionToJsCookie(lastChange, "myCurrentPageVersion") +
      optionToJsCookie(vars.newReply, "myNewReply")
    }</script>

}


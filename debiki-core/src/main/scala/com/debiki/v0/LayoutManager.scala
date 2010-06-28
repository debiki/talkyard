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

private[v0]
object LayoutManager {

  /** Converts text to xml, returns (html, approx-line-count).
   */
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
  def spaceToNbsp(text: String): String = text.replace(' ', '\u00a0')

  def dateToAbbr(date: ju.Date, cssClass: String): NodeSeq =
    <abbr class={"dw-date "+ cssClass} title={toIso8601(date)} />

  /** WARNING: XSS / DoS attacks possible?
   */
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
  def optionToJsCookie[E](
          o: Option[E], cookieName: String, options: String = ""): String =
    if (o.isEmpty) ""  // do nothing with cookie
    else
      "\njQuery.cookie('"+ cookieName +"', "+
      (o match {
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
      <ul class="dw-post-info">
        <li>By&#160;<span class="dw-owner">{
              spaceToNbsp(p.owner.getOrElse("Unknown"))}</span></li>
        <li class="dw-vote-score">{ scorecalc.scoreFor(p.id).score }</li>
        <li class="dw-vote-is">
          <span class="dw-vote">interesting</span>
          <span class="dw-count">3</span>
        </li>
        <li class="dw-vote-is">
          <span class="dw-vote">funny</span>
          <span class="dw-count">1</span>
        </li>
        <li class="dw-last-changed">
          {/* Show date on one line (10 chars), time on another. */}
          <abbr class="dw-date" title={date}>
            {date.take(10)}<br/>at {date.drop(11)}</abbr>
        </li>
      </ul>
      { xmlText }
    </div>
  }

  val ccWikiLicense =
    <a rel="license" href="http://creativecommons.org/licenses/by/3.0/"
       target="_blank">
      Creative Commons Attribution 3.0 Unported License
    </a>

  private val submitButtonText = "Submit reply"

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
          <form class='dw-agree dw-reply'
              action={config.replyAction}
              accept-charset='UTF-8'
              method='post'>
            <input type='hidden' name='parent' value='a'/>
            <textarea name='reply' rows='10' cols='34'
              >The cat was playing in the garden.</textarea><br/>
            <label for='dw-reply-author'>Your name or alias:</label>
            <input type='text' name='author'
                  value='Anonymous' id='dw-reply-author'/><br/>
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
          <input type='hidden' name='post' value='?'/>
          <fieldset>
            <input type='radio' name='vote' value='up' id='dw-vote-up'/>
            <label for='dw-vote-up'>Vote up</label><br/>
            <input type='radio' name='vote' value='down' id='dw-vote-down'/>
            <label for='dw-vote-down'>Vote down</label><br/>
          </fieldset>
          <input class='dw-submit' type='submit' value='Submit votes'
              disabled='disabled'/> {/* enabled on radio button click */}
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


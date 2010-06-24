// vim: ts=2 sw=2 et
/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package com.debiki.v0

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

}

import LayoutManager._

abstract class LayoutManager {

  def configure(conf: LayoutConfig)
  def layout(debate: Debate): NodeSeq
  def menus: NodeSeq

}

class SimpleLayoutManager extends LayoutManager {

  private var config = new LayoutConfig

  private var debate: Debate = null
  private var scorecalc: ScoreCalculator = null;

  override def configure(conf: LayoutConfig) { this.config = conf }

  def layout(debate: Debate): NodeSeq = {
    this.debate = debate
    this.scorecalc = new ScoreCalculator(debate)
    <div class="debiki dw-debate">
      { _layoutChildren(0, debate.RootPostId) }
    </div>
  }

  private def _layoutChildren(depth: Int, post: String): NodeSeq = {
    val childPosts: List[Post] = debate.repliesTo(post)
    for {
      c <- childPosts.sortBy(p => -scorecalc.scoreFor(p.id).score)
      cssThreadId = "dw-thread-"+ c.id
      cssFloat = if (depth <= 1) "dw-left " else ""
      cssDepth = "dw-depth-"+ depth
    }
    yield
      <div id={cssThreadId} class={cssFloat + cssDepth + " dw-thread"}>
        { threadSummaryXml(c) }
        { postXml(c) }
        { _layoutChildren(depth + 1, c.id) }
      </div>
  }

  private def threadSummaryXml(post: Post): NodeSeq = {
    val count = debate.successorsTo(post.id).length + 1
    if (count == 1)
      <ul class="dw-thread-summary">
        <li class="dw-post-count">1 post</li>
      </ul>
    else
      <ul class="dw-thread-summary">
        <li class="dw-post-count">{count} posts</li>
        <li class="dw-vote-score">score -1..+2..+5</li>
        <li class="dw-vote">interesting</li>
        <li class="dw-vote">funny</li>
      </ul>
  }

  private def postXml(p: Post): NodeSeq = {
    val cssPostId = "dw-post-"+ p.id
    val (xmlText, numLines) = textToHtml(p.text, charsPerLine = 80)
    val long = numLines > 9
    val cropped_s = if (long) " dw-cropped-s" else ""
    <div id={cssPostId} class={"dw-post dw-cropped-e" + cropped_s}>
      <ul class="dw-vote-summary">
        <li class="dw-vote-score">{ scorecalc.scoreFor(p.id).score }</li>
        <li class="dw-vote-is">
          <span class="dw-vote">interesting</span>
          <span class="dw-count">3</span>
        </li>
        <li class="dw-vote-is">
          <span class="dw-vote">funny</span>
          <span class="dw-count">1</span>
        </li>
        {/* <li class="dw-vote-it">agrees<span class="dw-count">2</span></li> */}
        <li>by&#160;<span class="dw-owner">{
              spaceToNbsp(p.owner.getOrElse("Unknown"))}</span></li>
      </ul>
      <div class="dw-date">{toIso8601(p.date)}</div>
      { xmlText }
    </div>
  }

  val ccWikiLicense =
    <a rel="license" href="http://creativecommons.org/licenses/by/3.0/">
      Creative Commons Attribution 3.0 Unported License
    </a>

  val submitButtonText = "Submit reply"

  val menus =
    <div id="dw-hidden-menus">
      <div id='dw-action-menu' class='ui-state-default'>
        <div class='dw-reply'>Reply</div>
        <div class='dw-vote'>Vote</div>
      </div>
      <ul id="dw-vote-menu" class="dw-menu">
        <li class="dw-up">Vote&nbsp;up</li>
        <li class="dw-down">Vote&nbsp;down</li>
        <li class="dw-it">It...
          <ul class="dw-sub dw-menu">
            <li>Agrees&nbsp;(with&nbsp;the&nbsp;<span
                  class="dw-parent-ref">parent</span>&nbsp;post,
              <i>but not necessarily with you</i>)</li>
            <li>Disagrees</li>
          </ul>
        </li>
        <li class="dw-it-is">It is...
          <ul class="dw-sub dw-menu">
            <li>Interesting</li>
            <li>Obvious</li>
            <li>Insightsful</li>
            <li>Stupid</li>
            <li>Funny</li>
            <li>Off topic</li>
            <li>Troll</li>
          </ul>
        </li>
        <li class="dw-suggestions">Vote&nbsp;on&nbsp;suggestions...
          <ul class="dw-sub dw-menu">
            <li>Show&nbsp;all</li>
          </ul>
        </li>
      </ul>
      <ul id="dw-reply-menu" class="dw-menu">
        <li>Just&nbsp;reply</li>
        <li>Agree</li>
        <li>Dissent</li>
        <li>Off&nbsp;topic</li>
      </ul>
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
            {/* <legend>Up or down</legend> -- what a silly legend */}
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

  // Triggers compiler bug: -- in Scala 2.8.0-Beta1. Fixed in RC2 obviously.
  //private def test: NodeSeq = {
  //  for (i <- 1 to 2)
  //  yield
  //    <div>
  //      <div>
  //    </div>
  //}
}


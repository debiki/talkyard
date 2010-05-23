// vim: ts=2 sw=2 et
/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package com.debiki.v0

import collection.{mutable => mut, immutable => imm}
import _root_.scala.xml.{NodeSeq, Elem}

object LayoutManager {

  /** Converts text to xml, returns (html, approx-line-count).
   */
  def textToHtml(text: String, charsPerLine: Int): Tuple2[Elem, Int] = {
    var lines = 0
    val xml =
        <div class="text">{
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

  def layout(debate: Debate): NodeSeq

}

class SimpleLayoutManager extends LayoutManager {

  private var debate: Debate = null

  def layout(debate: Debate): NodeSeq = {
    this.debate = debate
    <div class="debiki debate">
      { _layoutChildren(0, debate.RootPostId) }
    </div>
  }

  private def _layoutChildren(depth: Int, post: String): NodeSeq = {
    val childPosts: List[Post] = debate.repliesTo(post)
    for {
      c <- childPosts.sortBy(p => debate.postScore(p.id))
      cssThreadId = "thread-"+ c.id
      cssFloat = if (depth <= 1) "left " else ""
      cssDepth = "depth-"+ depth
    }
    yield
      <div id={cssThreadId} class={cssFloat + cssDepth + " thread"}>
        { threadSummaryXml(c) }
        { postXml(c) }
        { _layoutChildren(depth + 1, c.id) }
      </div>
  }

  private def threadSummaryXml(post: Post): NodeSeq = {
    val count = debate.successorsTo(post.id).length + 1
    if (count == 1)
      <ul class="thread-summary">
        <li class="post-count">1 post</li>
      </ul>
    else
      <ul class="thread-summary">
        <li class="post-count">{count} posts</li>
        <li class="vote-score">score -1..+2..+5</li>
        <li class="vote">interesting</li>
        <li class="vote">funny</li>
      </ul>
  }

  private def postXml(p: Post): NodeSeq = {
    val cssPostId = "post-"+ p.id
    val (xmlText, numLines) = textToHtml(p.text, charsPerLine = 80)
    val long = numLines > 9
    val cropped_s = if (long) " cropped-s" else ""
    <div id={cssPostId} class={"post cropped-e" + cropped_s}>
      <ul class="vote-summary">
        <li class="vote-score">+X</li>
        <li class="vote-is">
          <span class="vote">interesting</span>
          <span class="count">3</span>
        </li>
        <li class="vote-is">
          <span class="vote">funny</span>
          <span class="count">1</span>
        </li>
        {/* <li class="vote-it">agrees<span class="count">2</span></li> */}
        <li>by&#160;<span class="owner">{
              spaceToNbsp(p.owner.getOrElse("Unknown"))}</span></li>
      </ul>
      <div class="time">April 1, 2010, 00:01</div>
      { xmlText }
    </div>
  }

  // Triggers compiler bug: -- in Scala 2.8.0-Beta1. Fixed in RC2 obviously.
  //private def test: NodeSeq = {
  //  for (i <- 1 to 2)
  //  yield
  //    <div>
  //      <div>
  //    </div>
  //}
}

// Intresting
// http://www.dailykos.com/story/2010/4/1/853138/-Kaptur:-More-Agents-Needed-for-Financial-Prosecutions#c35


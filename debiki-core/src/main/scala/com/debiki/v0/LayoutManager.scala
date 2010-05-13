// vim: ts=2 sw=2 et
/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package com.debiki.v0

import collection.{mutable => mut, immutable => imm}
import _root_.scala.xml.{NodeSeq, Elem}

object LayoutManager {

  def textToHtml(text: String): Elem =
    <div class="text">{
      // Two newlines ends a paragraph.
      for (par <- text.split("\n\n").toList)
        yield <p>{par}</p>
    }
    </div>

}

import LayoutManager._

abstract class LayoutManager {

  def layout(debate: Debate): NodeSeq

}

class SimpleLayoutManager extends LayoutManager {

  private var debate: Debate = null

  def layout(debate: Debate): NodeSeq = {
    this.debate = debate
    <div class="debate">
      { _layoutChildren(0, debate.RootPostId) }
    </div>
  }

  private def _layoutChildren(depth: Int, post: String): NodeSeq = {
    val childPosts: List[Post] = debate.repliesTo(post)
    for {
      c <- childPosts.sortBy(p => debate.postScore(p.id))
      cssThreadId = "thread-"+ c.id
      cssPostId = "post-"+ c.id
      cssFloat = if (depth <= 1) "left " else ""
      cssDepth = "depth-"+ depth
    }
    yield
      <div id={cssThreadId} class={cssFloat + cssDepth + " thread"}>
        { threadSummary(c) }
        <div id={cssPostId} class="post">
          { voteSummary(c) }
          <div class="owner">{c.owner}</div>
          <div class="time">April 1, 2010, 00:01</div>
          <div class="reply">Reply</div>
          <div class="vote">Vote</div>
          <div class="edit">Edit</div>
          { textToHtml(c.text) }
        </div>
        { _layoutChildren(depth + 1, c.id) }
      </div>
  }

  private def threadSummary(post: Post): NodeSeq = {
    val count = debate.successorsTo(post.id).length + 1
    if (count == 1)
      <ul class="thread-summary">
        <li class="post-count">1 post</li>
      </ul>
    else
      <ul class="thread-summary">
        <li class="post-count">{count} posts</li>
        <li class="summary-score">score -1..+2..+5</li>
        <li class="summary-is">interesting</li>
        <li class="summary-is">funny</li>
      </ul>
  }

  private def voteSummary(p: Post): NodeSeq =
    <ul class="vote-summary">
      <li class="vote-score">+X</li>
      <li class="vote-it">agrees<span class="count">2</span></li>
      <li class="vote-is">interesting<span class="count">3</span></li>
      <li class="vote-is">funny<span class="count">1</span></li>
    </ul>

  // Triggers compiler bug:
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


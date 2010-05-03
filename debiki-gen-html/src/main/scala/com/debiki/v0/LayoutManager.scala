// vim: ts=2 sw=2 et
/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package com.debiki.v0

import collection.{mutable => mut}
import _root_.scala.xml.{NodeSeq, Elem}

object LayoutManager {

  def postToMeta(p: Post, depth: Int): Elem =
    <pre class="meta">{
      "id: "+ p.id +"  parent: "+ p.parent +"  depth: "+ depth
    }</pre>

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
    val childPosts: mut.Set[Post] = debate.childrenOf(post)
    for {
      c <- childPosts.toStream
      cssThreadId = "thread-"+ c.id
      cssPostId = "post-"+ c.id
      cssFloat = if (depth <= 1) "left " else ""
      cssDepth = "depth-"+ depth
    }
    yield
      <div id={cssThreadId} class={cssFloat + cssDepth + " thread"}>
        <div id={cssPostId} class="post">
          { postToMeta(c, depth) }
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


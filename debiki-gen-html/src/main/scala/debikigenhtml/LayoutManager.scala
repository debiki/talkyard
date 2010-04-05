// vim: ts=2 sw=2 et
/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package debikigenhtml

import _root_.scala.xml.{NodeSeq, Text, MetaData}

abstract class LayoutManager {

  def layout(debate: Debate): NodeSeq

}

class SimpleLayoutManager extends LayoutManager {

  private var debate: Debate = null

  def layout(debate: Debate): NodeSeq = {
    this.debate = debate
    _layoutChildren(Debate.RootPost)
  }

  private def _layoutChildren(post: String): NodeSeq = {
    val childPosts = debate.layout.get(post).get
    <div class="thread">{
      for (c <- childPosts)
      yield {
          val p = debate.posts.get(c).get
          <div class="left">{p.text}</div> ++ { _layoutChildren(c) }
      }
    }</div>
  }
}

// Intresting
// http://www.dailykos.com/story/2010/4/1/853138/-Kaptur:-More-Agents-Needed-for-Financial-Prosecutions#c35


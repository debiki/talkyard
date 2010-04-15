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
    _layoutChildren(debate.RootPostId)
  }

  private def _layoutChildren(post: String): NodeSeq = {
    val childPosts = debate.childrenOf(post)
    <div class="thread">{
      for (c <- childPosts)
      yield {
          <div class="left">{c.text}</div> ++ { _layoutChildren(c.id) }
      }
    }</div>
  }
}

// Intresting
// http://www.dailykos.com/story/2010/4/1/853138/-Kaptur:-More-Agents-Needed-for-Financial-Prosecutions#c35


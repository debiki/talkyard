// vim: ts=2 sw=2 et
/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package debikigenhtml

import collection.{mutable => mut}
import _root_.scala.xml.{NodeSeq}

abstract class LayoutManager {

  def layout(debate: Debate): NodeSeq

}

class SimpleLayoutManager extends LayoutManager {

  private var debate: Debate = null

  def layout(debate: Debate): NodeSeq = {
    this.debate = debate
    _layoutChildren(0, debate.RootPostId)
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
          <pre class="meta">{
            "id: "+ c.id +"  parent: "+ c.parent +"  depth: "+ depth
          }</pre>
          <pre class="text">{
            c.text
          }</pre>
        </div>
        { _layoutChildren(depth + 1, c.id) }
      </div>
  }
}

// Intresting
// http://www.dailykos.com/story/2010/4/1/853138/-Kaptur:-More-Agents-Needed-for-Financial-Prosecutions#c35


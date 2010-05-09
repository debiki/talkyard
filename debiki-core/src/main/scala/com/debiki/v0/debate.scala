// vim: ts=2 sw=2 et


package com.debiki.v0

import collection.{immutable => imm, mutable => mut}
import Prelude._

package object debate {
  type ID = String
}

case class Forum private[debiki] (
  id: String
)

case class Debate private[debiki] (
  val id: String,
  private val posts: List[Post]
){
  val RootPostId = "root"

  private lazy val postsById =
      imm.Map[String, Post](posts.map(x => (x.id, x)): _*)

  private lazy val postsByParentId: imm.Map[String, imm.Set[Post]] = {
    // Add post -> replies mappings to a mutable multimap.
    var mmap = mut.Map[String, mut.Set[Post]]()
    for (p <- posts)
      mmap.getOrElse(
        p.parent, { val s = mut.Set[Post](); mmap.put(p.parent, s); s }) += p
    // Copy to an immutable version.
    imm.Map[String, Set[Post]](
        (for ((parentId, children) <- mmap)
          yield (parentId, imm.Set[Post](children.toList: _*))).toList: _*)
  }

  /** Value {@code (post)(parent)} is the votes received by {@code post}
   *  when it was a child of {@code parent}.
   */
  private val postVotes = mut.Map[String, mut.Map[String, PostVotes]]()

  /** Value {@code (post)} is the changelog for {@code post}.
   */
  private val postLogs = mut.Map[String, List[LogEntry]]()

  def postCount = posts.length

  def post(id: String): Option[Post] = postsById.get(id)

  def repliesTo(id: String): imm.Set[Post] =
    postsByParentId.getOrElse(id, imm.Set.empty)

  def + (post: Post): Debate = copy(posts = post :: posts)
  def - (post: Post): Debate = copy(posts = posts filter (_ != post))

  /*
  def voteOnAt(postId: String, parentId: String, votes: PostVotes) {
    postVotes.getOrElse(
      postId, mut.Map[String, PostVotes]()).update(parentId, votes)
  }

  def logPostEvent(postId: String, event: LogEntry) {
    postLogs.put(postId, event :: logFor(postId))
  }

  def logFor(postId: String): List[LogEntry] =
    postLogs.getOrElse(postId, Nil)
  */

  lazy val nextFreePostId: String = {
    var nextFree = 0
    for {
      post <- posts
      num: Int = Base26.toInt(post.id)
      if num + 1 > nextFree
    }{
      nextFree = num + 1
    }
    Base26.fromInt(nextFree)
  }

}

case class LogEntry {
}

class PostVotes {
  val move = mut.Map[Move, Int]()
  val topics = mut.Map[String, Int]()
  val contents = mut.Map[String, Int]()
  val relations = mut.Map[Relation, Int]()
}

case class Post(
  id: String,
  parent: String,
  owner: Option[String],
  text: String
)

sealed class Move
object Move {
  case object Up extends Move
  case object Down extends Move
}

sealed class Relation
object Relation {
  case class Aggrees(postId: String) extends Relation
  case class Dissents(postId: String) extends Relation
}


/*
class VoteCategory extends Enumeration {
  val Placement, Relations, Content, Topic = Value
  type VoteCategory = Value
}

import reflect.BeanProperty

object Log {
  class EntryBean {
  }
}

class LogBean{
  import Log._
  @BeanProperty var id = ""
  @BeanProperty var log: java.util.List[EntryBean] = null
}

object DebateBean {
  class Props {
    @BeanProperty var id = ""
  }
  class Layout {
    @BeanProperty var id = ""
  }
  class Log extends LogBean {
  }
}

object PostBean {
  class Props {
    @BeanProperty var id = ""
  }
  class Text {
    @BeanProperty var id = ""
    @BeanProperty var text = ""
  }
  class Log extends LogBean {
  }
}
*/

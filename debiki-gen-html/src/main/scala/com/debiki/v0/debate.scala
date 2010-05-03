// vim: ts=2 sw=2 et


package debikigenhtml

import collection.{mutable => mut}
import Prelude._

package object debate {
  type ID = String
}

case class Forum(
  id: String
)

class Debate (
  val id: String
){
  val RootPostId = "root"

  var log = List[LogEntry]()

  val postsById = mut.Map[String, Post]()

  private val childrenByParent = mut.Map[String, mut.Set[Post]]()

  private def siblingsTo(post: Post): mut.Set[Post] =
        childrenByParent.getOrElse(post.parent, mut.Set[Post]())

  /** Value {@code (post)(parent)} is the votes received by {@code post}
   *  when it was a child of {@code parent}.
   */
  private val postVotes = mut.Map[String, mut.Map[String, PostVotes]]()

  /** Value {@code (post)} is the changelog for {@code post}.
   */
  private val postLogs = mut.Map[String, List[LogEntry]]()

  def add(posts: Post*) {
    for (p <- posts) {
      postsById(p.id) = p
      childrenOf(p.parent) += p
    }
  }

  def voteOnAt(postId: String, parentId: String, votes: PostVotes) {
    postVotes.getOrElse(
      postId, mut.Map[String, PostVotes]()).update(parentId, votes)
  }

  def logPostEvent(postId: String, event: LogEntry) {
    postLogs.put(postId, event :: logFor(postId))
  }

  def logFor(postId: String): List[LogEntry] =
    postLogs.getOrElse(postId, Nil)

  def remove(postId: String): Option[Post] = {
    val postOpt = postsById.get(postId)
    if (postOpt.isEmpty) return None
    val post = postOpt.get
    val siblings = siblingsTo(post) - post
    unimplemented("Should children be removed?")
  }

  def get(post: String): Option[Post] = postsById.get(post)

  def childrenOf(post: String): mut.Set[Post] = {
    if (!childrenByParent.contains(post))
      childrenByParent(post) = mut.Set[Post]()
    childrenByParent(post)
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

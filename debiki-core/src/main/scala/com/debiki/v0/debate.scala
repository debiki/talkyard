// vim: ts=2 sw=2 et

package com.debiki.v0

import java.{util => ju}
import collection.{immutable => imm, mutable => mut}
import Prelude._

object Debate {

  def empty(id: String) = Debate(id, Nil, Nil)

}

case class Debate (
  val id: String,
  private[debiki] val posts: List[Post],
  private[debiki] val votes: List[Vote]
){
  val RootPostId = "root"

  private lazy val postsById =
      imm.Map[String, Post](posts.map(x => (x.id, x)): _*)

  private lazy val postsByParentId: imm.Map[String, List[Post]] = {
    // Add post -> replies mappings to a mutable multimap.
    var mmap = mut.Map[String, mut.Set[Post]]()
    for (p <- posts)
      mmap.getOrElse(
        p.parent, { val s = mut.Set[Post](); mmap.put(p.parent, s); s }) += p
    // Copy to an immutable version.
    imm.Map[String, List[Post]](
        (for ((parentId, children) <- mmap)
          yield (parentId, children.toList)).toList: _*)
  }

  private class VoteCacheItem {
    var votes: List[Vote] = Nil
    var valueSums: imm.Map[String, Int] = null
  }

  private lazy val voteCache: mut.Map[String, VoteCacheItem] = {
    val cache = mut.Map[String, VoteCacheItem]()
    // Gather votes
    for (v <- votes) {
      var ci = cache.get(v.postId)
      if (ci.isEmpty) {
        cache(v.postId) = new VoteCacheItem
        ci = cache.get(v.postId)
      }
      ci.get.votes = v :: ci.get.votes
    }
    // Sum vote values
    for ((postId, ci) <- cache) ci.valueSums = {
      val mutmap = mut.Map[String, Int]()
      for (vote <- ci.votes; value <- vote.values) {
        val sum = mutmap.getOrElse(value, 0)
        mutmap(value) = sum + 1
      }
      imm.Map[String, Int](mutmap.toSeq: _*)
    }
    cache
  }

  def postCount = posts.length

  def post(id: String): Option[Post] = postsById.get(id)

  def votesOn(postId: String): List[Vote] = {
    val ci = voteCache.get(postId)
    if (ci.isDefined) ci.get.votes else Nil
  }

  def voteSumsFor(postId: String): imm.Map[String, Int] = {
    val ci = voteCache.get(postId)
    if (ci.isDefined) ci.get.valueSums else imm.Map.empty
  }

  def repliesTo(id: String): List[Post] =
    postsByParentId.getOrElse(id, Nil)

  def successorsTo(postId: String): List[Post] = {
    val res = repliesTo(postId)
    res.flatMap(r => successorsTo(r.id)) ::: res
  }

  def + (post: Post): Debate = copy(posts = post :: posts)
  def - (post: Post): Debate = copy(posts = posts filter (_ != post))

  def + (vote: Vote): Debate = copy(votes = vote :: votes)
  def - (vote: Vote): Debate = copy(votes = votes filter (_ != vote))

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

  lazy val lastChangeDate: Option[ju.Date] = {
    def maxDate(a: ju.Date, b: ju.Date) = if (a.compareTo(b) > 0) a else b
    val allDates: Iterator[ju.Date] = votes.iterator.map(_.date) ++
                                        posts.iterator.map(_.date)
    if (allDates isEmpty) None
    else Some(allDates reduceLeft (maxDate(_, _)))
  }

  /* With structural typing (I think this is very verbose code):
  def max(d1: ju.Date, d2: ju.Date) =
      if (d1.compareTo(d2) > 0) d1 else d2
  private def maxDate(list: List[{ def date: ju.Date }]): Option[ju.Date] = {
    if (list isEmpty) None
    else {
      val maxDate = (list.head.date /: list.tail)((d, o) => max(d, o.date))
            // ((d: ju.Date, o: WithDate) => max(d, o.date))
            // Results in: missing arguments for method foldLeft in
            // trait LinearSeqOptimized;
            // follow this method with `_' if you want to treat it
            // as a partially applied function
      // Date is mutable so return a copy
      Some(maxDate.clone.asInstanceOf[ju.Date])
    }
  }
  lazy val lastChangeDate = {
    val dateOpts = List(maxDate(votes), maxDate(posts)).filter (!_.isEmpty)
    if (dateOpts isEmpty) None
    else dateOpts.tail.foldLeft(dateOpts.head.get)((d, o) => max(d, o.get))
  }
 */

}

case class Vote private[debiki] (
  postId: String,
  voterId: String,
  date: ju.Date,
  values: List[String]
)

case class Post(
  id: String,
  parent: String,
  date: ju.Date,
  owner: Option[String],
  text: String
)

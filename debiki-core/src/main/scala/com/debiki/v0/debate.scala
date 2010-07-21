// vim: ts=2 sw=2 et

package com.debiki.v0

import java.{util => ju}
import collection.{immutable => imm, mutable => mut}
import Prelude._

object Debate {

  def empty(id: String) = Debate(id)

}

case class Debate (
  val id: String,
  private[debiki] val posts: List[Post] = Nil,
  private[debiki] val ratings: List[Rating] = Nil,
  private[debiki] val edits: List[Edit] = Nil,
  private[debiki] val editVotes: List[EditVote] = Nil,
  private[debiki] val editsApplied: List[EditApplied] = Nil
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

  private class RatingCacheItem {
    var ratings: List[Rating] = Nil
    var valueSums: imm.Map[String, Int] = null
  }

  private lazy val ratingCache: mut.Map[String, RatingCacheItem] = {
    val cache = mut.Map[String, RatingCacheItem]()
    // Gather ratings
    for (r <- ratings) {
      var ci = cache.get(r.postId)
      if (ci.isEmpty) {
        cache(r.postId) = new RatingCacheItem
        ci = cache.get(r.postId)
      }
      ci.get.ratings = r :: ci.get.ratings
    }
    // Sum rating tags
    for ((postId, cacheItem) <- cache) cacheItem.valueSums = {
      val mutmap = mut.Map[String, Int]()
      for (r <- cacheItem.ratings; value <- r.tags) {
        val sum = mutmap.getOrElse(value, 0)
        mutmap(value) = sum + 1
      }
      imm.Map[String, Int](mutmap.toSeq: _*)
    }
    cache
  }

  def postCount = posts.length

  def post(id: String): Option[Post] = postsById.get(id)

  def postsWithEditProposals: List[Post] =
    posts.filter(p => editProposalsByPostId.contains(p.id))

  def ratingsOn(postId: String): List[Rating] = {
    val ci = ratingCache.get(postId)
    if (ci.isDefined) ci.get.ratings else Nil
  }

  def ratingSumsFor(postId: String): imm.Map[String, Int] = {
    val ci = ratingCache.get(postId)
    if (ci.isDefined) ci.get.valueSums else imm.Map.empty
  }

  def repliesTo(id: String): List[Post] =
    postsByParentId.getOrElse(id, Nil)

  def successorsTo(postId: String): List[Post] = {
    val res = repliesTo(postId)
    res.flatMap(r => successorsTo(r.id)) ::: res
  }

  private lazy val editProposalsByPostId: imm.Map[String, List[Edit]] =
    edits.groupBy(_.postId)

  def editsProposedFor(postId: String): List[Edit] =
    editProposalsByPostId.getOrElse(postId, Nil)

  def + (post: Post): Debate = copy(posts = post :: posts)
  //def - (post: Post): Debate = copy(posts = posts filter (_ != post))

  def + (rating: Rating): Debate = copy(ratings = rating :: ratings)
  //def - (rating: Rating): Debate = copy(ratings = ratings filter
  //                                                            (_ != rating))

  def + (edit: Edit): Debate = copy(edits = edit :: edits)
  //def - (edit: Edit): Debate = copy(edits = edits filter (_ != edit))

  def + (vote: EditVote): Debate = copy(editVotes = vote :: editVotes)
  //def - (vote: EditVote): Debate = copy(editVotes = editVotes filter
  //                                                              (_ != vote))

  def + (ea: EditApplied): Debate = copy(editsApplied = ea :: editsApplied)

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
    val allDates: Iterator[ju.Date] = ratings.iterator.map(_.date) ++
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
    val dateOpts = List(maxDate(ratings), maxDate(posts)).filter (!_.isEmpty)
    if (dateOpts isEmpty) None
    else dateOpts.tail.foldLeft(dateOpts.head.get)((d, o) => max(d, o.get))
  }
 */

}

case class Rating private[debiki] (
  postId: String,
  by: String,
  date: ju.Date,
  tags: List[String]
)

case class Post(
  id: String,
  parent: String,
  date: ju.Date,
  by: Option[String],
  text: String
)

case class Edit(
  id: String,
  postId: String,
  date: ju.Date,
  by: String,
  text: String
)

case class EditVote(
  editId: String,
  voterId: String,
  date: ju.Date,
  value: Int
){
  require(value == 0 || value == 1)
}

case class EditApplied (
  editId: String,
  date: ju.Date,
  debug: String = ""
)

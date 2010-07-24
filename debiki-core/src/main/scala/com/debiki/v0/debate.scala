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

  // -------- Posts

  def postCount = posts.length

  def post(id: String): Option[Post] = postsById.get(id)

  // -------- Ratings

  def ratingsOn(postId: String): List[Rating] = {
    val ci = ratingCache.get(postId)
    if (ci.isDefined) ci.get.ratings else Nil
  }

  def ratingSumsFor(postId: String): imm.Map[String, Int] = {
    val ci = ratingCache.get(postId)
    if (ci.isDefined) ci.get.valueSums else imm.Map.empty
  }

  // -------- Replies

  def repliesTo(id: String): List[Post] =
    postsByParentId.getOrElse(id, Nil)

  def successorsTo(postId: String): List[Post] = {
    val res = repliesTo(postId)
    res.flatMap(r => successorsTo(r.id)) ::: res
  }

  // -------- Edits

  private lazy val editsById: imm.Map[String, Edit] = {
    val m = edits.groupBy(_.id)
    m.mapValues(list => {
      errorIf(list.tail.nonEmpty,
              "Two ore more Edit:s with this id: "+ list.head.id)
      list.head
    })
  }

  private lazy val editsAppliedById: imm.Map[String, EditApplied] = {
    val m = editsApplied.groupBy(_.editId)
    m.mapValues(list => {
      errorIf(list.tail.nonEmpty, "Two ore more EditApplied:s with "+
              "same edit id: "+ list.head.editId)
      list.head
    })
  }

  private lazy val editsPendingByPostId: imm.Map[String, List[Edit]] =
    edits.filterNot(editsAppliedById contains _.id).groupBy(_.postId)

  private lazy val editsAppliedByPostId
      : imm.Map[String, List[EditApplied]] =
    editsApplied.groupBy(ea => editsById(ea.editId).postId)

  def editsFor(postId: String): List[Edit] =
    edits.filter(_.postId == postId)

  def editsPendingFor(postId: String): List[Edit] =
    editsPendingByPostId.getOrElse(postId, Nil)

  /** Edits applied to the specified post, sorted chronologically.
   */
  def editsAppliedTo(postId: String): List[EditApplied] =
    editsAppliedByPostId.getOrElse(postId, Nil).sortBy(_.date.getTime)

  // -------- Construction

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

  // -------- Misc

  def assignIdTo(p: Post): Post = p.copy(id = nextFreePostId)
  def assignIdTo(e: Edit): Edit = e.copy(id = nextFreeEditId(e.postId))

  private lazy val nextFreePostId: String = {
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

  private def nextFreeEditId(editeeId: String): String = {
    UNTESTED
    // Edit id format: <baseId> 'E' <subid>
    // Don't change the <baseId>. By not changing it, we can easily
    // identify what thing is being edited (the item with id = base-id).
    // By including 'E' between the base-id and the sub-id, we know,
    // only from looking at the ID, that the id identifies an Edit.
    val edits: List[Edit] = editsFor(editeeId)
    var nextFree = 0
    for {
      edit <- edits
      lastUpperIx: Int = edit.id.lastIndexWhere(_.isUpper)
      val (baseid, subid) = if (lastUpperIx == -1) ("", edit.id)
                            else edit.id splitAt lastUpperIx
      num: Int = Base26.toInt(subid drop 1) // drop 'E'
      if num + 1 > nextFree
    }{
      require(lastUpperIx == -1 || edit.id(lastUpperIx) == 'E',
              "Invalid Edit id, last upper is not `E': "+ safe(edit.id))
      require(editeeId == baseid, "Found bad id, when checking free ids: "+
              "Edit id ["+ safe(edit.id) + "] not prefixed by editee id ["+
              safe(editeeId) +"]")
      //else if (allBaseId != baseId) error("Different base id's: ["+
      //                        safe(allBaseId) +"] and ["+ safe(baseId) +"]")
      nextFree = num + 1
    }
    //if (allBaseId == null) allBaseId = ""
    editeeId +"E"+ Base26.fromInt(nextFree)
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
  ip: String,
  date: ju.Date,
  tags: List[String]
)

case class Post(
  id: String,
  parent: String,
  date: ju.Date,
  by: String,
  ip: String,
  text: String
)

case class Edit(
  id: String,
  postId: String,
  date: ju.Date,
  by: String,
  ip: String,
  text: String
)

case class EditVote(
  editId: String,
  by: String,
  ip: String,
  date: ju.Date,
  value: Int
){
  require(value == 0 || value == 1)
}

case class EditApplied (
  editId: String,
  date: ju.Date,

  /** The text after the edit was applied. Needed, in case an `Edit'
   *  contains a diff, not the resulting text itself. Then we'd better not
   *  find the resulting text by applying the diff to the previous
   *  version, more than once -- that wouldn't be future compatible: the diff
   *  algorithm might functioni differently depending on software version
   *  (e.g. because of bugs).
   *  So, only apply the diff algorithm once, to find the EddidApplied.result,
   *  and thereafter always use EditApplied.result.
   */
  result: String,

  debug: String = ""
)

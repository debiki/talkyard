/**
 * Copyright (c) 2015-2021 Kaj Magnus Lindberg
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

package com.debiki.core

import Prelude._
import java.{util => ju}
import scala.collection.immutable


sealed abstract class DoVoteStyle(val IntVal: i32) { def toInt: i32 = IntVal }
object DoVoteStyle {
  case object Disabled extends DoVoteStyle(0)
  case object Likes extends DoVoteStyle(1)
  /** The Like looks like an arrow up symbol, on the topic list page
    * — technically it's still a Like vote. */
  case object LikesUpIcon extends DoVoteStyle(2)
  /** Same as LikesUpIcon, but there's also a down icon for Do-Not votes. */
  case object LikesUpIconAndDoNot extends DoVoteStyle(3)
  /** Only Do-It votes, counted separately from Like votes. */
  case object DoIt extends DoVoteStyle(4)
  case object DoItAndDoNot extends DoVoteStyle(5)

  def fromOptInt32(value: Opt[i32]): Opt[DoVoteStyle] =
    fromInt32(value getOrElse { return None })

  def fromInt32(value: i32): Opt[DoVoteStyle] = Some(value match {
    case Disabled.IntVal => Disabled
    case Likes.IntVal => Likes
    case LikesUpIcon.IntVal => LikesUpIcon
    case LikesUpIconAndDoNot.IntVal => LikesUpIconAndDoNot
    case DoIt.IntVal => DoIt
    case DoItAndDoNot.IntVal => DoItAndDoNot
    case _ => return None
  })
}


sealed abstract class IncludeInSummaries(val IntVal: Int) { def toInt: Int = IntVal }
object IncludeInSummaries {
  case object Default extends IncludeInSummaries(0)
  // Later. To feature a specific page, or Announcements category.
  //case object YesFeatured extends IncludeInSummaries(1)
  case object NoExclude extends IncludeInSummaries(3)

  def fromInt(value: Int): Option[IncludeInSummaries] = Some(value match {
    case Default.IntVal => Default
    //case YesFeatured.IntVal => YesFeatured
    case NoExclude.IntVal => NoExclude
    case _ => return None
  })
}


/** A category. Each page is placed in exactly one, or no, category.
  *
  * Does not know if it's a base category, sub cat or sub sub cat
  * — because if a cat gets moved to another depth, that field would have had
  * to get updated in all descendant cats, but doing that for a whole
  * tree of cats could be bad for performance (sometimes 500+ sub cats).
  *
  * But does know if its a root cat — then, parentId is None. There can be
  * many root cats in a Talkyard site. Each cat tree is then a different
  * "site section", e.g. a forum, or a wiki, or blog, or another forum,
  * a bit like you can have subreddits over at Reddit.
  *
  * [exp] In the db, but not needed:
  *  - updatedAt — who cares
  *  - staff_only — use page perms instead
  *  - only_staff_may_create_topics  — use page perms instead
  *  - default_topic_type — not in use, always 12, delete
  *
  * @param id
  * @param sectionPageId
  * @param parentId — is empty, for root categories.
  * @param defaultSubCatId — if creating a topic in this category (typically, a forum root
  *  category), then, if no category specified, the new topic will be placed in this sub category.
  * @param name
  * @param slug
  * @param position
  * @param newTopicTypes
  * @param unlistCategory — this category won't be shown on the category page
  * @param unlistTopics — topics from this category won't be listed in the main topic list
  * @param includeInSummaries
  * @param createdAt
  * @param updatedAt
  * @param lockedAt
  * @param frozenAt
  * @param deletedAt
  */
case class Category( // [exp] ok use   too long name! use Cat instead
  id: CategoryId,
  extImpId: Option[ExtId] = None, // RENAME to extId
  sectionPageId: PageId,
  // Later when adding child categories, see all: [0GMK2WAL] (currently parentId is just for the
  // root category).
  parentId: Option[CategoryId],
  defaultSubCatId: Option[CategoryId],
  name: String,
  slug: String,
  position: Int,
  description: Option[String], // REMOVE [502RKDJWF5]
  // [refactor] [5YKW294] [rename] Should no longer be a list. Change db too, from "nnn,nnn,nnn" to single int.
  newTopicTypes: immutable.Seq[PageType],
  // None —> inherited from parent cat (not impl though)
  defaultSortOrder: Opt[PageOrderOffset] = None, // RENAME to pageOrder
  comtOrder: Opt[PostSortOrder] = None,
  comtNesting: Opt[ComtNesting_later] = None,
  comtsStartHidden: Opt[NeverAlways] = None,
  comtsStartAnon: Opt[NeverAlways] = None,
  opStartsAnon: Opt[NeverAlways] = None,
  newAnonStatus: Opt[AnonStatus] = None,
  doVoteStyle: Opt[DoVoteStyle] = None,
  // Not impl though. [vote_from_tp_ls]
  doVoteInTopicList: Opt[Bo] = None,
  // REFACTOR these two should be one field?: Unlist.Nothing = 0, Unlist.Topics = 1, Unlist.Category = 2?
  unlistCategory: Boolean, // also unlists topics
  unlistTopics: Boolean,
  //  -----------

  includeInSummaries: IncludeInSummaries = IncludeInSummaries.Default,
  createdAt: ju.Date,
  updatedAt: ju.Date,
  lockedAt: Option[ju.Date] = None,
  frozenAt: Option[ju.Date] = None,
  deletedAt: Option[ju.Date] = None,
  )
  extends DiscPropsSource with SectPropsSource with HasInt32Id {

  import Category._

  // Don't check for weird chars here — that might prevent loading [categories that
  // already include weird chars] from the database. Instead, check when saving: [05970KF5]
  require(slug.nonEmpty, "EsE6MPFK2")
  require(slug.length <= MaxSlugLength, "EsE4ZXW2")

  require(name.nonEmpty, "EsE8GKP6")
  require(name.length <= MaxNameLength, "EsE2KPE8")
  require(!isRoot || defaultSubCatId.isDefined,
    s"No defult category specified for root category '$name' with id $id [EsE7GJIK10]")
  require(!description.exists(_.isEmpty), "EsE2KPU7")
  require(!description.exists(_.length > MaxDescriptionLength), "EsE2PFU4")
  require(updatedAt.getTime >= createdAt.getTime, "EsE8UF9")
  require(!lockedAt.exists(_.getTime < createdAt.getTime), "EsE5MPK2")
  require(!frozenAt.exists(_.getTime < createdAt.getTime), "EsE2KPU4c")
  require(!deletedAt.exists(_.getTime < createdAt.getTime), "EsE7GUM4")

  require(comtNesting.isEmpty, "TyE60MREG26")

  /** Each site section has its own category tree, starting with a "tree root category",
    * which itself has no parent category. See tyworld.adoc [subcoms_and_cats]
    */
  def isTreeRoot: Bo = parentId.isEmpty
  def isRoot: Boolean = parentId.isEmpty  ; RENAME // to isTreeRoot above
  def isLocked: Boolean = lockedAt.isDefined
  def isFrozen: Boolean = frozenAt.isDefined
  def isDeleted: Boolean = deletedAt.isDefined

  def idName: St = s"""$id "$name""""

  def doItVotesEnabled: Bo = doVoteStyle isSomethingButNot DoVoteStyle.Disabled
}


object Category {
  val MinId = 1
  val FirstRootCatId = 1
  val MaxNameLength = 50
  val MaxSlugLength = 50
  val MaxDescriptionLength = 1000
  val DescriptionExcerptLength = 280
  val DefaultPosition = 50 // also in Typescript [7KBYW2]
}


// For root cats, could also remember rootCat.sectionPageId & path & role, & def cat id?
case class CategoryStuff(
  category: Category,
  childCats: ImmSeq[CategoryStuff],
  descriptionBriefPlainText: String,
  // Later: Don't allow external urls? Those could point to large images, making the page slow.
  anyThumbnails: immutable.Seq[String]  // later: Seq[UploadRef] — then cannot be external.
  // Later:
  // Statistics, e.g. num new topics per day / week / or month.
  // (Total num topics?)
  )


case class CategoryPatch(
  id: Option[CategoryId],
  extImpId: Option[ExtId] = None,
  parentRef: Option[String],
  name: Option[String],
  slug: Option[String],
  description: Option[String],
  position: Option[Int]) {

  // -------Check cat slug, name, ext id: [05970KF5]----------------
  // (dupl code, the *other* code will disappear when replacing CategoryToSave with CategoryPatch)

  require(id.forall(_ >= Category.MinId), "TyE7KRDGTS25")

  name.flatMap(Validation.findCategoryNameProblem) foreach { problem =>
    throwIllegalArgument("TyE702RKDTW01", s"Bad category name: $problem")
  }

  slug.flatMap(Validation.findCategorySlugProblem) foreach { problem =>
    throwIllegalArgument("TyE702RKDTW02", s"Bad category slug: $problem")
  }

  extImpId.flatMap(Validation.findExtIdProblem) foreach { problem =>
    throwIllegalArgument("TyE702RKDTW03", s"Bad category extId: $problem")
  }
  // ---------------------------------------------------------------
}
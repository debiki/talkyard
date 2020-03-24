/**
 * Copyright (C) 2015 Kaj Magnus Lindberg
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


/** [exp] In the db, but not needed:
  *  - updatedAt — who cares
  *  - staff_only — use page perms instead
  *  - only_staff_may_create_topics  — use page perms instead
  *  - default_topic_type — not in use, always 12, delete
  *
  * @param id
  * @param sectionPageId
  * @param parentId
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
case class Category(  // [exp] ok use
  id: CategoryId,
  extImpId: Option[ExtId] = None,  // RENAME to extId
  sectionPageId: PageId,
  // Later when adding child categories, see all: [0GMK2WAL] (currently parentId is just for the
  // root category).
  parentId: Option[CategoryId],
  defaultSubCatId: Option[CategoryId],
  name: String,
  slug: String,
  position: Int,
  description: Option[String],  // REMOVE [502RKDJWF5]
  // [refactor] [5YKW294] [rename] Should no longer be a list. Change db too, from "nnn,nnn,nnn" to single int.
  newTopicTypes: immutable.Seq[PageType],
  // REFACTOR these two should be one field?: Unlist.Nothing = 0, Unlist.Topics = 1, Unlist.Category = 2?
  unlistCategory: Boolean,  // also unlists topics
  unlistTopics: Boolean,
  //  -----------
  includeInSummaries: IncludeInSummaries = IncludeInSummaries.Default,
  createdAt: ju.Date,
  updatedAt: ju.Date,
  lockedAt: Option[ju.Date] = None,
  frozenAt: Option[ju.Date] = None,
  deletedAt: Option[ju.Date] = None) {

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

  def isRoot: Boolean = parentId.isEmpty
  def isLocked: Boolean = lockedAt.isDefined
  def isFrozen: Boolean = frozenAt.isDefined
  def isDeleted: Boolean = deletedAt.isDefined

}


object Category {
  val MinId = 1
  val MaxNameLength = 50
  val MaxSlugLength = 50
  val MaxDescriptionLength = 1000
  val DescriptionExcerptLength = 280
  val DefaultPosition = 50 // also in Typescript [7KBYW2]
}


case class CategoryStuff(
  category: Category,
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
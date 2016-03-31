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

import com.debiki.core.Prelude._
import java.{util => ju}
import scala.collection.immutable


case class Category(
  id: CategoryId,
  sectionPageId: PageId,
  parentId: Option[CategoryId],
  name: String,
  slug: String,
  position: Int,
  description: Option[String],
  newTopicTypes: immutable.Seq[PageRole],
  unlisted: Boolean,
  staffOnly: Boolean,
  createdAt: ju.Date,
  updatedAt: ju.Date,
  lockedAt: Option[ju.Date] = None,
  frozenAt: Option[ju.Date] = None,
  deletedAt: Option[ju.Date] = None) {

  import Category._

  require(slug.nonEmpty, "EsE6MPFK2")
  require(slug.length <= MaxSlugLength, "EsE4ZXW2")
  require(name.nonEmpty, "EsE8GKP6")
  require(name.length <= MaxNameLength, "EsE2KPE8")
  require(!description.exists(_.isEmpty), "EsE2KPU7")
  require(!description.exists(_.length > MaxDescriptionLength), "EsE2PFU4")
  require(newTopicTypes.size <= MaxTopicTypes, "EsE7MJKF2")
  require(updatedAt.getTime >= createdAt.getTime, "EsE8UF9")
  require(!lockedAt.exists(_.getTime < createdAt.getTime), "EsE5MPK2")
  require(!frozenAt.exists(_.getTime < createdAt.getTime), "EsE2KPU4c")
  require(!deletedAt.exists(_.getTime < createdAt.getTime), "EsE7GUM4")

  def isRoot = parentId.isEmpty
  def isTheUncategorizedCategory = description.contains(Category.UncategorizedDescription)
  def isLocked = lockedAt.isDefined
  def isFrozen = frozenAt.isDefined
  def isDeleted = deletedAt.isDefined

}


object Category {
  val MaxNameLength = 50
  val MaxSlugLength = 50
  val MaxDescriptionLength = 1000
  val MaxTopicTypes = 20
  val DescriptionExcerptLength = 280
  val UncategorizedDescription = "__uncategorized__"
  val DefaultPosition = 50 // also in Typescript [7KBYW2]
}


case class CreateEditCategoryData(
  sectionPageId: PageId,
  parentId: CategoryId,
  name: String,
  slug: String,
  position: Int,
  newTopicTypes: immutable.Seq[PageRole],
  unlisted: Boolean,
  staffOnly: Boolean,
  anyId: Option[CategoryId] = None) { // Some() if editing

  def makeCategory(id: CategoryId, createdAt: ju.Date) = Category(
    id = id,
    sectionPageId = sectionPageId,
    parentId = Some(parentId),
    name = name,
    slug = slug,
    position = position,
    description = None,
    newTopicTypes = newTopicTypes,
    unlisted = unlisted,
    staffOnly = staffOnly,
    createdAt = createdAt,
    updatedAt = createdAt)

}


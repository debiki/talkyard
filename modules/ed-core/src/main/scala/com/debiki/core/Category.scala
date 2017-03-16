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

import java.{util => ju}
import scala.collection.immutable


case class Category(
  id: CategoryId,
  sectionPageId: PageId,
  // Later when adding child categories, see all: [0GMK2WAL] (currently parentId is just for the
  // root category).
  parentId: Option[CategoryId],
  defaultCategoryId: Option[CategoryId],
  name: String,
  slug: String,
  position: Int,
  description: Option[String],
  // [refactor] [5YKW294] [rename] Should no longer be a list. Change db too, from "nnn,nnn,nnn" to single int.
  newTopicTypes: immutable.Seq[PageRole],
  unlisted: Boolean,  // rename to isUnlisted
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
  require(!isRoot || defaultCategoryId.isDefined,
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
  val MaxNameLength = 50
  val MaxSlugLength = 50
  val MaxDescriptionLength = 1000
  val DescriptionExcerptLength = 280
  val DefaultPosition = 50 // also in Typescript [7KBYW2]
}



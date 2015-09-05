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
  numTopics: Int,
  numPosts: Int,
  newTopicTypes: immutable.Seq[PageRole],
  createdAt: ju.Date,
  updatedAt: ju.Date,
  lockedAt: Option[ju.Date] = None,
  frozenAt: Option[ju.Date] = None,
  deletedAt: Option[ju.Date] = None) {

  def isRoot = parentId.isEmpty

}


object Category {
  val DescriptionExcerptLength = 300
}


case class CreateEditCategoryData(
  sectionPageId: PageId,
  parentId: CategoryId,
  name: String,
  slug: String,
  position: Int,
  newTopicTypes: immutable.Seq[PageRole],
  anyId: Option[CategoryId] = None) { // Some() if editing

  def makeCategory(id: CategoryId, createdAt: ju.Date) = Category(
    id = id,
    sectionPageId = sectionPageId,
    parentId = Some(parentId),
    name = name,
    slug = slug,
    position = position,
    description = None,
    numTopics = 0,
    numPosts = 0,
    newTopicTypes = newTopicTypes,
    createdAt = createdAt,
    updatedAt = createdAt)

}


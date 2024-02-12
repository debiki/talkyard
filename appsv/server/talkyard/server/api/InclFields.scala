/**
  * Copyright (c) 2024 Kaj Magnus Lindberg
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
  * along with this program.  If not, see <https://www.gnu.org/licenses/>.
  */

package talkyard.server.api

import com.debiki.core._


trait InclFields {
  def id: Bo
  def refId: Bo
}

trait InclItems {
  def fields: InclFields
}



// ----- Participants


case class InclPatFields(
  id: Bo = false,
  refId: Bo = false,

  username: Bo = false,
  fullName: Bo = false,

) extends InclFields


case object InclPatFields {
  val Default: InclPatFields = InclPatFields(
        id = true,
        refId = false,
        username = true,
        fullName = true,
        )
}



// ----- Categories


case class InclCatFields(
  id: Bo = false,
  refId: Bo = false,
  name: Bo = false,
  urlPath: Bo = false,
) extends InclFields


object InclCatFields {
  val Default: InclCatFields = InclCatFields(
        id = true,
        refId = false,
        name = true,
        urlPath = true,
        )
}



// ----- Tags

case class InclTagFields(
  id: Bo = false,
  tagType: Bo = false, // later: Opt[TagTypeFields]
  tagTypeId: Bo = false,
  tagTypeRefId: Bo = false,
  valType: Bo = false,
  valInt32: Bo = false,
  valFlt64: Bo = false,
  valStr: Bo = false,
)



// ----- Pages


case class InclPageFields(
  id: Bo = false,
  refId: Bo = false,
  urlPath: Bo = false,

  categoryId: Bo = false,
  categoryRefId: Bo = false,
  categoriesMainFirst: Bo = false, // later:  Opt[InclCatFields],

  pageType: Bo = false,
  answerPostId: Bo = false,
  doingStatus: Bo = false,
  closedStatus: Bo = false,
  deletedStatus: Bo = false,

  numOpDoItVotes: Bo = false,
  numOpDoNotVotes: Bo = false,
  numOpLikeVotes: Bo = false,
  numTotRepliesVisible: Bo = false,

  title: Bo = false,
  excerpt: Bo = false,
  origPost: Bo = false, // later: InclPostFields,
  author: Bo = false,

  posts: Bo = false, // later: Opt[InclPosts] = None,

  tags: Bo = false, // later: Opt[InclTagFields] = None,

) extends InclFields


object InclPageFields {

  /** Reply & Like vote counts is typically what's needed for blog comments
    * (to show on a blog posts index page: title, excerpt, X comments, Y likes).
    */
  val DefaultForBlogComments: InclPageFields = InclPageFields(
        numOpDoItVotes = true,
        numOpDoNotVotes = true,
        numOpLikeVotes = true,
        numTotRepliesVisible = true)

  // See [def_pg_fields], backw compat.
  val Default: InclPageFields = DefaultForBlogComments.copy(
        id = true, // + pageId if inclOldPageIdField
        refId = true,
        title = true,
        urlPath = true,
        excerpt = true,
        author = true,
        categoriesMainFirst = true,
        pageType = true,
        answerPostId = true,
        doingStatus = true,
        closedStatus = true,
        deletedStatus = true)
}


// ----- Posts


case class InclPosts(
  origPost: Bo = false,
  numTopComments: i32 = 0,
  numLatest: i32 = 0,
  fields: InclPostFields = InclPostFields.Default,
) extends InclItems


case class InclPostFields(
  id: Bo = false,
  refId: Bo = false,
  nr: Bo = false,
  parentNr: Bo = false,

  pageId: Bo = false,
  pageRefId: Bo = false,

  isPageTitle: Bo = false,
  isPageBody: Bo = false,

  approvedHtmlSanitized: Bo = false,

  authorIds: Bo = false,
  author: Opt[InclPatFields] = None,

  assigneeIds: Bo = false,
  assignees: Opt[InclPatFields] = None,

) extends InclFields


case object InclPostFields {
  val Default = InclPostFields(
        id = true,
        refId = false,
        nr = true,
        parentNr = true,
        approvedHtmlSanitized = true,
        isPageTitle = false,
        )
}
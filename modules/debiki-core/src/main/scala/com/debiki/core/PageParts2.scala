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
import com.debiki.core.{PostActionPayload => PAP}
import com.debiki.core.PostActionPayload.EditPost
import scala.{collection => col}
import scala.collection.{immutable, mutable}
import Prelude._
import PageParts._



/** The parts of a page are 1) posts: any title post, any body post, and any comments,
  * and 2) people, namely those who have authored or edited the posts.
  */
trait PageParts2 extends People2 {

  private def dummyDate = new ju.Date
  def pageId = "dummy"
  def theUser(userId: UserId) = User(
    id = userId,
    displayName = s"$userId-disp-name",
    username = Some(s"$userId-username"),
    createdAt = Some(new ju.Date),
    email = "ab@ex.com",
    emailNotfPrefs = EmailNotfPrefs.DontReceive)
  def titlePost: Option[Post2] = None
  def loadAllPosts() {}
  def topLevelComments: Seq[Post2] = Nil
  def allPosts: Seq[Post2] = Vector(
    Post2(
      siteId = "dummy",
      pageId = "dummy",
      id = PageParts.BodyId,
      parentId = None,
      multireplyPostIds = Set.empty,
      createdAt = dummyDate,
      createdById = "1",
      lastEditedAt = dummyDate,
      lastEditedById = "1",
      lastApprovedEditAt = None,
      lastApprovedEditById = None,
      lastApprovedEditApprovedAt = None,
      lastApprovedEditApprovedById = None,
      numDistinctEditors = 1,
      approvedSource = Some("**hello**"),
      approvedHtmlSanitized = Some("<b>hello</b>"),
      approvedAt = Some(dummyDate),
      approvedById = Some("1"),
      approvedVersion = Some(1),
      currentSourcePatch = None,
      currentVersion = 1,
      collapsedStatus = None,
      collapsedAt = None,
      collapsedById = None,
      closedStatus = None,
      closedAt = None,
      closedById = None,
      deletedStatus = None,
      deletedAt = None,
      deletedById = None,
      pinnedPosition = None,
      numPendingFlags = 0,
      numHandledFlags = 0,
      numPendingEditSuggestions = 0,
      numLikeVotes = 0,
      numWrongVotes = 0,
      numTimesRead = 0))
}

trait People2 {

  def theUser(id: UserId): User

}

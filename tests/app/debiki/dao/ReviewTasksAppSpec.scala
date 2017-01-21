/**
 * Copyright (c) 2015 Kaj Magnus Lindberg
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

package debiki.dao

import com.debiki.core._
import debiki.Globals
import java.{util => ju}
import scala.collection.immutable


class ReviewTasksAppSpec extends DaoAppSuite {

  "ReviewTasksDao can" - {
    val now = new ju.Date()

    "find no tasks when there are none" in {
      val dao = Globals.siteDao(Site.FirstSiteId)
      val (stuff, usersById) = dao.loadReviewStuff(olderOrEqualTo = now, limit = 999)
      stuff.length mustBe 0
      usersById.size mustBe 0

      val counts = dao.readOnlyTransaction(_.loadReviewTaskCounts(isAdmin = true))
      counts.numUrgent mustBe 0
      counts.numOther mustBe 0
    }

    "create, find, count tasks" in {
      val dao = Globals.siteDao(Site.FirstSiteId)
      val createdByUser = createPasswordUser("revwTaskMkr", dao)
      val createdByUser2 = createPasswordUser("revwTaskMkr2", dao)
      val completedByUser = createPasswordUser("taskCompleter", dao)
      val maybeBadUser = createPasswordUser("maybeBadUser", dao)
      val urgentReasons = immutable.Seq(ReviewReason.PostFlagged)
      val otherReasons = immutable.Seq(ReviewReason.LateEdit)
      dao.readWriteTransaction { transaction =>

        info("create an urgent task")
        transaction.upsertReviewTask(ReviewTask(
          id = 1,
          reasons = urgentReasons,
          createdById = createdByUser.id,
          createdAt = transaction.currentTime,
          maybeBadUserId = maybeBadUser.id))

        info("count the urgent task")
        var counts = transaction.loadReviewTaskCounts(isAdmin = true)
        counts.numUrgent mustBe 1
        counts.numOther mustBe 0

        info("create a not urgent task")
        transaction.upsertReviewTask(ReviewTask(
          id = 2,
          reasons = otherReasons,
          createdById = createdByUser2.id,
          createdAt = transaction.currentTime,
          maybeBadUserId = maybeBadUser.id))

        info("count the not urgent task")
        counts = transaction.loadReviewTaskCounts(isAdmin = true)
        counts.numUrgent mustBe 1
        counts.numOther mustBe 1 // was 0, now 1
      }

      info("find the tasks")
      val (stuff, usersById) = dao.loadReviewStuff(olderOrEqualTo = new ju.Date(), limit = 999)
      stuff.length mustBe 2
      // (Most recent first.)
      stuff.head.createdBy.id mustBe createdByUser2.id
      stuff.head.maybeBadUser.id mustBe maybeBadUser.id
      stuff.head.reasons mustBe otherReasons
      stuff.last.createdBy.id mustBe createdByUser.id
      stuff.last.reasons mustBe urgentReasons
      stuff.last.maybeBadUser.id mustBe maybeBadUser.id
    }

    "update tasks, complete, delete, etc, etc" in {
      pending
    }
  }

}

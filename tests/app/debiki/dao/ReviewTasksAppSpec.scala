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
import java.{util => ju}
import scala.collection.immutable


class ReviewTasksAppSpec extends DaoAppSuite {

  "ReviewTasksDao can" - {
    val now = new ju.Date()

    "find no tasks when there are none" in {
      globals.systemDao.getOrCreateFirstSite()
      val dao = globals.siteDao(Site.FirstSiteId)
      val (stuff, taskCounts, usersById, pageMetaById) = dao.loadReviewStuff(
          olderOrEqualTo = None, limit = 999, forWho = Who.System)
      stuff.length mustBe 0

      taskCounts.numUrgent mustBe 0
      taskCounts.numOther mustBe 0

      usersById.size mustBe 0
      pageMetaById.size mustBe 0

      // (Already done via loadReviewStuff() above, well, again, then, here.)
      val counts = dao.readOnlyTransaction(_.loadReviewTaskCounts(isAdmin = true))
      counts.numUrgent mustBe 0
      counts.numOther mustBe 0
    }

    "create, find, count tasks" in {
      val dao = globals.siteDao(Site.FirstSiteId)
      createPasswordOwner("rev_st_ower", dao)
      val createdByUser = createPasswordUser("revw_task_mkr", dao)
      val createdByUser2 = createPasswordUser("revw_task_mkr2", dao)
      val completedByUser = createPasswordUser("task_completer", dao)
      val maybeBadUser = createPasswordUser("maybe_bad_user", dao)
      val urgentReasons = immutable.Seq(ReviewReason.PostFlagged)
      val otherReasons = immutable.Seq(ReviewReason.LateEdit)
      dao.readWriteTransaction { transaction =>

        info("create an urgent task")
        transaction.upsertReviewTask(ReviewTask(
          id = 1,
          reasons = urgentReasons,
          createdById = createdByUser.id,
          createdAt = transaction.now.toJavaDate,
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
          createdAt = transaction.now.toJavaDate,
          maybeBadUserId = maybeBadUser.id))

        info("count the not urgent task")
        counts = transaction.loadReviewTaskCounts(isAdmin = true)
        counts.numUrgent mustBe 1
        counts.numOther mustBe 1 // was 0, now 1

        TESTS_MISSING // add task with decidedBy user, verify hen loaded — usersById then mustBe 4 below.
      }

      info("find the tasks")
      val (stuff, taskCounts, usersById, pageMetaById) =
        dao.loadReviewStuff(olderOrEqualTo = None, limit = 999, forWho = Who.System)
      taskCounts.numUrgent mustBe 1
      taskCounts.numOther mustBe 1
      stuff.length mustBe 2
      // (Most recent first.)
      stuff.head.createdBy.id mustBe createdByUser2.id
      stuff.head.maybeBadUser.id mustBe maybeBadUser.id
      stuff.head.reasons mustBe otherReasons
      stuff.last.createdBy.id mustBe createdByUser.id
      stuff.last.reasons mustBe urgentReasons
      stuff.last.maybeBadUser.id mustBe maybeBadUser.id
      usersById.size mustBe 3
      usersById.get(createdByUser.id) mustBe defined
      usersById.get(createdByUser2.id) mustBe defined
      usersById.get(maybeBadUser.id) mustBe defined
      pageMetaById.size mustBe 0
    }

    "update tasks, complete, delete, etc, etc" in {
      pending
    }
  }

}

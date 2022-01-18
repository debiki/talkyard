/**
 * Copyright (C) 2017 Kaj Magnus Lindberg
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

package  talkyard.server.dao

import com.debiki.core._
import debiki._
import debiki.dao.{CreateForumResult, DaoAppSuite, SiteDao}


class SiteTxNoticesAppSpec extends DaoAppSuite(startTime = DaoAppSuite.Jan2020) {

  private def mkNotice(siteId: SiteId, id: i32): Notice =
    Notice(
      siteId = siteId,
      toPatId = Group.AdminsId,
      noticeId = id,
      firstAt = DaoAppSuite.Jan2020.toWhenMins,
      lastAt = DaoAppSuite.Jan2020.toWhenMins,
      numTotal = 1,
      noticeData = None)

  "SiteTx can manage admin notices" - {
      var daoSite1: SiteDao = null
      var admin: Participant = null
      var userA: Participant = null

      var daoSite2: SiteDao = null

      "Prepare: Create sites and users" in {
        globals.systemDao.getOrCreateFirstSite()
        daoSite1 = globals.siteDao(Site.FirstSiteId)

        daoSite2 = createSite("other-site")._2

        admin = createPasswordOwner(s"poc_adm", daoSite1)
        userA = createPasswordUser(s"poc_u_a", daoSite1)
      }


      "Find no admin notices when there are none" in {
        daoSite1.readTx { tx =>
          val notices = tx.loadAdminNotices()
          notices.length mustBe 0
        }
      }


      "Save admin notices" in {
        daoSite1.addAdminNotice(Notice.TwitterLoginConfigured)
      }


      "Now finds one notice" in {
        daoSite1.readTx { tx =>
          val notices = tx.loadAdminNotices()
          notices.length mustBe 1
          notices mustBe Seq(
                mkNotice(siteId = daoSite1.siteId, Notice.TwitterLoginConfigured))
        }
      }

      "Saves another notice" in {
        daoSite1.addAdminNotice(Notice.TwitterLoginUsed)
      }


      "Now finds two notices" in {
        daoSite1.readTx { tx =>
          val notices = tx.loadAdminNotices()
          notices.length mustBe 2
          notices mustBe Seq(
                mkNotice(siteId = daoSite1.siteId, Notice.TwitterLoginConfigured),
                mkNotice(siteId = daoSite1.siteId, Notice.TwitterLoginUsed))
        }
      }


      "The other site still has not admin notices" in {
        daoSite2.readTx { tx =>
          val notices = tx.loadAdminNotices()
          notices.length mustBe 0
        }
      }

      "The other site saves an admin notice" in {
        daoSite2.addAdminNotice(Notice.TwitterLoginUsed)
      }

      "Now the other site finds one notice" in {
        daoSite2.readTx { tx =>
          val notices = tx.loadAdminNotices()
          notices.length mustBe 1
          notices mustBe Seq(
                mkNotice(siteId = daoSite2.siteId,
                Notice.TwitterLoginUsed))
        }
      }
  }

}

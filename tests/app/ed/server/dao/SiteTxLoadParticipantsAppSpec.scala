/**
 * Copyright (c) 2019 Kaj Magnus Lindberg
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

package ed.server.dao

import com.debiki.core._
import debiki._
import debiki.dao.{CreateForumResult, DaoAppSuite, SiteDao}


class SiteTxLoadParticipantsAppSpec extends DaoAppSuite {


  "SiteTransaction can load participants" - {
    var dao: SiteDao = null
    var admin: Participant = null
    var group: Group = null
    var userA: Participant = null
    var userADetails: UserInclDetails = null
    var userB: Participant = null
    var userBDetails: UserInclDetails = null
    var guest: Participant = null

    val userBExtId = "u_b_ext_id space .,:;-?^#! chars"

    "prepare: create site and users" in {
      globals.systemDao.getOrCreateFirstSite()
      dao = globals.siteDao(Site.FirstSiteId)
    }

    "find no participants when there are none" - {
      "by id" in {
        dao.readOnlyTransaction { tx =>
          info("with details")
          tx.loadParticipantsInclDetailsByIdsAsMap_wrongGuestEmailNotfPerf(
            Nil) mustBe Map.empty
          tx.loadParticipantsInclDetailsByIdsAsMap_wrongGuestEmailNotfPerf(
            Seq(100, 101, 102)) mustBe Map.empty

          info("no details")
          tx.loadParticipantsAsMap(Nil) mustBe Map.empty
          tx.loadParticipantsAsMap(Seq(100, 101, 102)) mustBe Map.empty
        }
      }

      "by ext id" in {
        dao.readOnlyTransaction { tx =>
          tx.loadParticipantsInclDetailsByExtIdsAsMap_wrongGuestEmailNotfPerf(
            Nil) mustBe Map.empty
          tx.loadParticipantsInclDetailsByExtIdsAsMap_wrongGuestEmailNotfPerf(
            Seq("id_one", "id_two", userBExtId)) mustBe Map.empty
        }
      }
    }


    "prepare 2: create participants" in {
      admin = createPasswordOwner(s"poc_adm", dao)
      group = createGroup(dao, "poc_grp", fullName = None)
      userA = createPasswordUser(s"poc_u_a", dao)
      userADetails = dao.loadTheUserInclDetailsById(userA.id)
      userB = createPasswordUser(s"poc_u_b", dao, extId = Some(userBExtId))
      userBDetails = dao.loadTheUserInclDetailsById(userB.id)
      guest = dao.loginAsGuest(GuestLoginAttempt(ip = "2.2.2.2", globals.now().toJavaDate,
        name = "Guestellina", guestBrowserId = "guestellinacookie"))
    }


    "load groups" in {
      dao.readOnlyTransaction { tx =>
        info("with details")
        tx.loadParticipantsInclDetailsByIdsAsMap_wrongGuestEmailNotfPerf(
          Seq(group.id)) mustBe Map(group.id -> group)

        info("no details")
        tx.loadParticipantsAsMap(Seq(group.id)) mustBe Map(group.id -> group)
      }
    }


    "load users" - {
      "by id" in {
        dao.readOnlyTransaction { tx =>
          info("with details")
          tx.loadParticipantsInclDetailsByIdsAsMap_wrongGuestEmailNotfPerf(
            Seq(userA.id)) mustBe Map(userA.id -> userADetails)

          info("no details")
          tx.loadParticipantsAsMap(Seq(userB.id)) mustBe Map(userB.id -> userB)
        }
      }

      "by ext id" in {
        dao.readOnlyTransaction { tx =>
          tx.loadParticipantsInclDetailsByExtIdsAsMap_wrongGuestEmailNotfPerf(
            Seq("id_one", "id_two", userBExtId)) mustBe Map(
              userBExtId -> userBDetails)
        }
      }
    }


    "load guests" in {
      dao.readOnlyTransaction { tx =>
        tx.loadParticipantsInclDetailsByIdsAsMap_wrongGuestEmailNotfPerf(
          Seq(guest.id)) mustBe Map(guest.id -> guest)

        info("no details")
        tx.loadParticipantsAsMap(Seq(guest.id)) mustBe Map(guest.id -> guest)
      }
    }


    "load all: groups, users, guests" in {
      dao.readOnlyTransaction { tx =>
        info("with details")
        tx.loadParticipantsInclDetailsByIdsAsMap_wrongGuestEmailNotfPerf(
          Seq(guest.id, userB.id, group.id)) mustBe Map(
            group.id -> group,
            guest.id -> guest,
            userB.id -> userBDetails)

        info("no details")
        tx.loadParticipantsAsMap(
          Seq(guest.id, userB.id, group.id)) mustBe Map(
          group.id -> group,
          guest.id -> guest,
          userB.id -> userB)
      }
    }
  }

}

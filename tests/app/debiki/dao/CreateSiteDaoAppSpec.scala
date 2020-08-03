/**
 * Copyright (c) 2016 Kaj Magnus Lindberg
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

import com.debiki.core.DbDao._
import com.debiki.core._


class CreateSiteDaoAppSpec extends DaoAppSuite(maxSitesTotal = Some(75)) {

  private def createOneSite(user: User, prefix: Int, number: Int,
        ip: String = null, browserIdCookie: String = null,
        browserFingerprint: Int = -1,
        localHostname: Option[String] = None, hostname: Option[String] = None,
        pubId: Option[String] = None, name: Option[String] = None,
        isTestSite: Boolean = false): Site = {
    require(prefix % 20 == 0) // else prefix + number just below won't be a nice looking number
    val theFingerprint = if (browserFingerprint == -1) prefix + number else browserFingerprint
    val thePrefix = s"e2e-test-crst-$prefix-$number"
    val theLocalHostname = localHostname getOrElse thePrefix
    val theHostname = hostname getOrElse s"$theLocalHostname.example.com"
    val theIdCookie = if (browserIdCookie eq null) s"$thePrefix-cookie" else browserIdCookie
    val theIp = if (ip eq null) s"$prefix.0.0.$number" else ip
    globals.systemDao.createAdditionalSite(
      anySiteId = None, pubId = pubId getOrElse s"createsitepubid-$thePrefix",
      name = name getOrElse theLocalHostname, status = SiteStatus.Active,
      hostname = Some(theHostname),
      embeddingSiteUrl = None, organizationName = s"Org Name $thePrefix", creatorId = user.id,
      BrowserIdData(ip = theIp, idCookie = Some(theIdCookie), fingerprint = theFingerprint),
      isTestSiteOkayToDelete = isTestSite, skipMaxSitesCheck = false,
      createdFromSiteId = Some(FirstSiteId))
  }

  var siteOneowner: User = _

  "CreateSiteDao and SystemTransaction can" - {

    "create sites" in {
      globals.systemDao.getOrCreateFirstSite()
      val dao = globals.siteDao(Site.FirstSiteId)
      siteOneowner = createPasswordOwner("555uuyyww", dao)
      val user = createPasswordUser("qq33yy55ee", dao)

      info("a real site")
      val realSite = createOneSite(user, 20, 1)
      realSite.id must be > 0

      info("a test site")
      val testSite = createOneSite(user, 40, 1, isTestSite = true)
      testSite.id must be <= MaxTestSiteId
    }


    "reject weird sites" in {
      val dao = globals.siteDao(Site.FirstSiteId)
      val user = createPasswordUser("gg99yy22cc", dao)

      info("Weird local hostname")
      intercept[Exception] {
        createOneSite(user, 0, 123, localHostname = Some("weird Hostname"))
      }.getMessage must include("EsE7UZF2_")

      info("Weird complete hostname")
      pending

      info("Weird email address")
      pending

      info("Weird browser id cookie?")
      pending
    }

    lazy val sitePubId1000 = createOneSite(siteOneowner, 100, 1, pubId = Some("pubid1000"))
    lazy val siteLocalHostnameAabb = createOneSite(
          siteOneowner, 100, 2, name = Some("aabb"), hostname = Some("aabb.ex.co"))

    "create more sites, different names" in {
      sitePubId1000
      siteLocalHostnameAabb
    }

    "lookup site by public id, name and hostname" in {
      globals.systemDao.writeTxLockAllSites { tx =>
        info("by public id")
        tx.loadSiteByPubId(sitePubId1000.pubId).map(_.id) mustBe Some(sitePubId1000.id)

        info("by wrong public id — finds nothing")
        tx.loadSiteByPubId("wroooong") mustBe None

        info("by hostname")
        tx.loadSiteByHostname("aabb.ex.co") mustBe Some(siteLocalHostnameAabb)

        info("by wrong hostname — finds nothing")
        tx.loadSiteByHostname("aabb.ex.org") mustBe None

        info("by name")
        tx.loadSiteByName("aabb") mustBe Some(siteLocalHostnameAabb)

        info("by wrong name — finds nothing")
        tx.loadSiteByName("wrongname") mustBe None
      }
    }

    "lookup many sites" in {
      globals.systemDao.writeTxLockAllSites { tx =>
        tx.loadSitesByIds(Nil).length mustBe 0
        tx.loadSitesByIds(Seq(345678)).length mustBe 0

        val sites = tx.loadSitesByIds(Seq(
              sitePubId1000.id, siteLocalHostnameAabb.id, 234567))

        sites.length mustBe 2
        sites.exists(_.id == sitePubId1000.id) mustBe true
        sites.exists(_.id == siteLocalHostnameAabb.id) mustBe true
      }
    }

    "update and read back" in {
      globals.systemDao.writeTxLockAllSites { tx =>
        tx.updateSites(Seq(SuperAdminSitePatch(
              sitePubId1000.id, SiteStatus.HiddenUnlessAdmin,
              newNotes = Some("notes_notes"),
              featureFlags = "ffTestFlagOne ffTestFlag2")))
      }
      globals.systemDao.writeTxLockAllSites { tx =>
        val site = tx.loadSiteInclDetailsById(sitePubId1000.id).get
        site.superStaffNotes mustBe Some("notes_notes")
        site.featureFlags mustBe "ffTestFlagOne ffTestFlag2"
        site.status mustBe SiteStatus.HiddenUnlessAdmin
      }
    }

    "load all sites incl details, and staff" in {
      globals.systemDao.writeTxLockAllSites { tx =>
        // Just run the queries? for now

        info("all sites")
        tx.loadAllSitesInclDetails()

        info("staff for all sites")
        tx.loadStaffForAllSites()
      }
    }

    "not create too many sites per person" in {
      val dao = globals.siteDao(Site.FirstSiteId)
      val user = createPasswordUser("pp55ww99zz", dao)

      info("per ip")
      var numCreated = 0
      intercept[TooManySitesCreatedByYouException] {
        while (numCreated < 99) {
          createOneSite(user, 120, numCreated, ip = "223.224.225.226")
          numCreated += 1
        }
      }
      numCreated mustBe globals.config.createSite.maxSitesPerPerson

      SECURITY // restrict site creation per ip
      /*
      info("per browser id cookie")
      numCreated = 0
      intercept[TooManySitesCreatedByYouException] {
        while (numCreated < 99) {
          createOneSite(user, 140, numCreated, browserIdCookie = "the_same_cookie")
          numCreated += 1
        }
      }
      numCreated mustBe globals.config.createSite.maxSitesPerPerson

      info("per browser fingerprint")
      numCreated = 0
      intercept[TooManySitesCreatedByYouException] {
        while (numCreated < 99) {
          createOneSite(user, 160, numCreated, browserFingerprint = 224455)
          numCreated += 1
        }
      }
      numCreated mustBe globals.config.createSite.maxSitesPerPerson
      */
    }


    "not create too many sites in total" in {
      val dao = globals.siteDao(Site.FirstSiteId)
      val user = createPasswordUser("22ff44bbuu", dao)
      var numCreated = 0
      intercept[Exception] {
        while (numCreated < 99) {
          createOneSite(user, 220, numCreated)
          numCreated += 1
        }
      } match {
        case TooManySitesCreatedInTotalException =>
          numCreated must be > 10
        case wrong: Exception =>
          fail("Wrong exception", wrong)
      }
    }
  }

}

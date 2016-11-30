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
import debiki.Globals


class CreateSiteDaoAppSpec extends DaoAppSuite(maxSitesTotal = Some(75)) {

  private def createOneSite(dao: SiteDao, user: Member, prefix: Int, number: Int,
        ip: String = null, browserIdCookie: String = null,
        browserFingerprint: Int = -1, email: Option[String] = None,
        localHostname: Option[String] = None, hostname: Option[String] = None,
        isTestSite: Boolean = false): Site = {
    require(prefix % 20 == 0) // else prefix + number just below won't be a nice looking number
    val theFingerprint = if (browserFingerprint == -1) prefix + number else browserFingerprint
    val thePrefix = s"crst-$prefix-$number"
    val theLocalHostname = localHostname getOrElse thePrefix
    val theHostname = hostname getOrElse s"$theLocalHostname.example.com"
    val theEmail = email getOrElse s"$thePrefix@example.com"
    val theIdCookie = if (browserIdCookie eq null) s"$thePrefix-cookie" else browserIdCookie
    val theIp = if (ip eq null) s"$prefix.0.0.$number" else ip
    dao.createSite(name = theLocalHostname, status = SiteStatus.Active, hostname = theHostname,
      embeddingSiteUrl = None, organizationName = s"Org Name $thePrefix",
      creatorEmailAddress = theEmail, creatorId = user.id,
      BrowserIdData(ip = theIp, idCookie = theIdCookie, fingerprint = theFingerprint),
      isTestSiteOkayToDelete = isTestSite, skipMaxSitesCheck = false,
      deleteOldSite = false, pricePlan = "Unknown")
  }


  "CreateSiteDao can" - {

    "create sites" in {
      val dao = Globals.siteDao(Site.FirstSiteId)
      val user = createPasswordUser("qq33yy55ee", dao)

      info("a real site")
      val realSite = createOneSite(dao, user, 20, 1)
      realSite.id mustNot include(Site.TestIdPrefix)

      info("a test site")
      val testSite = createOneSite(dao, user, 40, 1, isTestSite = true)
      testSite.id must startWith(Site.TestIdPrefix)
    }


    "reject weird sites" in {
      val dao = Globals.siteDao(Site.FirstSiteId)
      val user = createPasswordUser("gg99YY22cc", dao)

      info("Weird local hostname")
      intercept[Exception] {
        createOneSite(dao, user, 0, 123, localHostname = Some("weird Hostname"))
      }.getMessage must include("EsE7UZF2_")

      info("Weird complete hostname")
      pending

      info("Weird email address")
      pending

      info("Weird browser id cookie?")
      pending
    }


    "not create too many sites per person" in {
      val dao = Globals.siteDao(Site.FirstSiteId)
      val user = createPasswordUser("pp55WW99zz", dao)

      info("per ip")
      var numCreated = 0
      intercept[TooManySitesCreatedByYouException] {
        while (numCreated < 99) {
          createOneSite(dao, user, 120, numCreated, ip = "223.224.225.226")
          numCreated += 1
        }
      }
      numCreated mustBe Globals.config.createSite.maxSitesPerPerson

      SECURITY // restrict site creation per ip
      /*
      info("per browser id cookie")
      numCreated = 0
      intercept[TooManySitesCreatedByYouException] {
        while (numCreated < 99) {
          createOneSite(dao, user, 140, numCreated, browserIdCookie = "the_same_cookie")
          numCreated += 1
        }
      }
      numCreated mustBe Globals.config.createSite.maxSitesPerPerson

      info("per browser fingerprint")
      numCreated = 0
      intercept[TooManySitesCreatedByYouException] {
        while (numCreated < 99) {
          createOneSite(dao, user, 160, numCreated, browserFingerprint = 224455)
          numCreated += 1
        }
      }
      numCreated mustBe Globals.config.createSite.maxSitesPerPerson
      */
    }


    "not create too many sites in total" in {
      val dao = Globals.siteDao(Site.FirstSiteId)
      val user = createPasswordUser("22FF44bbUU", dao)
      var numCreated = 0
      intercept[Exception] {
        while (numCreated < 99) {
          createOneSite(dao, user, 220, numCreated)
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

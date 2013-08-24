/**
 * Copyright (C) 2012 Kaj Magnus Lindberg (born 1979)
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

package debiki

import com.debiki.core._
import controllers.{AppCreatePage, AppCreateWebsite}
import debiki.dao.SiteDao
import java.{util => ju}
import org.scalatest._
import org.scalatest.matchers.MustMatchers
import play.api.{test => pt}
import pt.Helpers.testServerPort
import scala.reflect.{ClassTag, classTag}
import test.e2e.code.StuffCreator
import Prelude._



abstract class RunningServerSpec(additionalConfiguration: Map[String, _ <: Any] = Map.empty)
  extends FreeSpec with BeforeAndAfterAll {
  self: Suite =>

  lazy val testServer = pt.TestServer(testServerPort,
    pt.FakeApplication(additionalConfiguration = additionalConfiguration))

  protected def emptyDatabaseBeforeAll = true


  override def beforeAll() {
    testServer.start()
    if (emptyDatabaseBeforeAll)
      Globals.systemDao.emptyDatabase()
  }


  override def afterAll() {
    testServer.stop()
  }

}



/**
* Adds `currentTestName` that you can use inside a FreeSpec test.
*
* To understand the implementation, see FreeSpecStringWrapper in
* class org.scalatest.FreeSpec.scala.
*/
trait RichFreeSpec extends FreeSpec {

  private var _currentTestName: Option[String] = None
  def currentTestName = _currentTestName getOrDie "DwE90RXP2"

  protected override def runTest(testName: String, args: org.scalatest.Args): Status = {
    _currentTestName = Some(testName)
    super.runTest(testName, args)
  }
}



/**
 * Runs the QuotaChargerSpec suite, in SBT:  test-only debiki.QuotaChargerSpecRunner
 */
class QuotaChargerSpecRunner extends Suites(new QuotaChargerSpec {})



/** Tests the quota charger.
  */
@DoNotDiscover
@test.tags.SlowTest
class QuotaChargerSpec
  extends RunningServerSpec(Map("new.site.freeDollars" -> 1))
  with RichFreeSpec with MustMatchers {

  import Globals.siteDao


  "QuotaCharger can" - {

    "charge and decline consumers:" - {

      // Let's charge quota from an IP, a role, a site and a global IP,
      // for creating pages.

      var site: Tenant = null

      "allow creation of a website" in {
        site = createSite(fromIp = nextIp())
      }

      "charge an IP (a guest user with fix IP)" in {
        val siteAndIp = SiteAndIp(site.id, nextIp())
        val loginGrant = loginNewGuestUser("GuestTest", siteAndIp)
        val dao = tenantDao(site.id, nextIp())
        loopUntilDeclined[QuotaConsumer.PerTenantIp](min = 20, max = 100) {
          // We're charging the same site-id and IP all the time, so the IP
          // will run out of quota, for `site.id`.
          createPage(loginGrant.login.id, loginGrant.user, dao)
        }
      }

      "charge a role, uses fix IP" in {
        val siteAndIp = SiteAndIp(site.id, nextIp())
        val loginGrant = loginNewOpenIdUser("RoleTestFixIp", siteAndIp)
        val dao = tenantDao(siteAndIp, Some(loginGrant.user.id))
        loopUntilDeclined[QuotaConsumer.PerTenantIp](min = 20, max = 100) {
          // We're charging the same site-id and IP and *role* all the time.
          // The role should run out of quota, for `site.id`, before the IP?
          // because when you login and get a role, the IP quota is larger than
          // if you're not logged in? (Or how did I implement this?)
          createPage(loginGrant.login.id, loginGrant.user, dao)
        }
      }

      "charge a role, varying IP" in {
        val loginGrant = loginNewOpenIdUser("RoleTestVaryingIp", site.id, ip = nextIp())
        loopUntilDeclined[QuotaConsumer.Role](min = 20, max = 100) {
          // We're charging the same site-id and role all the time, but a different IP.
          // The role should run out of quota.
          val dao = tenantDao(site.id, ip = nextIp(), roleId = Some(loginGrant.user.id))
          createPage(loginGrant.login.id, loginGrant.user, dao)
        }
      }

      "charge a moderator" in {
        // Moderators should have more quota than other users?
        pending
      }

      "charge an admin" in {
        // Admins should have even more quota than moderators?
        pending
      }

      "charge a site" in {
        // This charges the same site all the time, but different guest user ips.
        // So we're testing that the site can run out of quota.

        val pagesPerLap = 10
        loopUntilDeclined[QuotaConsumer.Tenant](min = 200, max = 1000, perLap = pagesPerLap) {
          // Try to charge for pages only, so all these "charge a ..." tests
          // are somewhat comparable. — Quota for one login grant per 10 pages
          // should be negligible?
          val siteAndIp = SiteAndIp(site.id, nextIp())
          val loginGrant = loginNewGuestUser("GuestTest", siteAndIp)
          for (i <- 1 to pagesPerLap)
            createPage(loginGrant.login.id, loginGrant.user, tenantDao(siteAndIp))
        }
      }

      "charge a global IP number" in {
        // 1. Create many sites.
        // 2. For each site, consume resources from a certain IP, but different
        // users, and  not enough resources for the IP to be blocked at that
        // particular site.
        // 3. Eventually, the IP should not be allowed to do anything at
        // *any* site, because requests from that IP will be rejected globally,
        // because when considering all sites together the IP has consumed too
        // much resources.

        val fixIp = nextIp()
        val numSites = 10
        val siteGuestDaos =
          for (i <- 1 to numSites)
          yield {
            val site = createSite(fromIp = nextIp())
            val guestDao = siteDao(site.id, fixIp)
            val guestLoginGrant = loginNewGuestUser("GuestTest", SiteAndIp(site.id, fixIp))
            (site, guestLoginGrant, guestDao)
          }

        loopUntilDeclined[QuotaConsumer.GlobalIp](min = 10, max = 100, perLap = numSites) {
          var siteIds = Set[String]()
          for ((site, guestLoginGrant, guestDao) <- siteGuestDaos) {

            // Test test suite.
            if (siteIds.contains(guestDao.siteId))
              fail("Broken test: Not testing one IP accessing many sites")
            siteIds += guestDao.siteId

            // Test quota charger.
            createPage(guestLoginGrant.login.id, guestLoginGrant.user, guestDao)
          }
        }
      }

    }


    "charge for and decline various actions:" - {

      "creating guest users" in {
        //val site = createSite()
        //loopUntilDeclined(min = 100, max = 200) {
        //  loginNewGuestUser(site)
        //}
        pending
      }

      "creating authorized users" in {
        //val site = createSite()
        //loopUntilDeclined(min = 100, max = 200) {
        //  createOpenIdUser(site)
        //}
        pending
      }

      "logging in" in {
        //val site = createSite()
        //val loginGrant = loginNewGuestUser(site)
        //loopUntilDeclined(min = 100, max = 200) {
        //  login(site, user)
        //}
        pending
      }

      "creating pages" in {
        pending
      }

      "posting comments" in {
        pending
      }

      "reviewing" in {
        pending
      }

      "rating" in {
        pending
      }

      "editing" in {
        pending
      }

      "applying edits" in {
        pending
      }

      "flagging" in {
        pending
      }

      "deleting" in {
        pending
      }

      "sending email notifications" in {
        pending
      }
    }


    "accumulate free quota day by bay" in {
      pending
    }


    "allow pilfering" in {
      pending
    }

  }


  val stuffCreator = new StuffCreator {}

  var nextSiteNo = 0
  var nextOpenIdUserNo = 0
  var nextGuestUserNo = 0
  var nextIpNo = 0


  case class SiteAndIp(siteId: String, ip: String)


  def nextIp() = {
    nextIpNo += 1
    s"0.0.0.$nextIpNo"
  }


  def tenantDao(siteId: String, ip: String): SiteDao =
    tenantDao(SiteAndIp(siteId, ip), None)


  def tenantDao(siteId: String, ip: String, roleId: Option[String]): SiteDao =
    tenantDao(SiteAndIp(siteId, ip), roleId)


  def tenantDao(siteAndIp: SiteAndIp, roleId: Option[String] = None): SiteDao =
    siteDao(siteAndIp.siteId, ip = siteAndIp.ip, roleId = roleId)


  def createSite(fromIp: String): Tenant =
    createSiteAndOwner(fromIp)._1


  def createSiteAndOwner(fromIp: String): (Tenant, User) = {
    nextSiteNo += 1

    // We'll create the new site via stuffCreator.firstSite. So, first
    // create a new user at firstSite. Then let that user create the new site.
    // The user will become the owner of the new site. Then create the new site.

    val loginGrant = loginNewOpenIdUser(
      s"Site${nextSiteNo}Owner", SiteAndIp(stuffCreator.firstSiteId, fromIp))
    val siteName = s"quota-charger-site-$nextSiteNo"
    val anyNewSiteAndOwner: Option[(Tenant, User)] = AppCreateWebsite.createWebsite(
      dao = stuffCreator.firstSiteDao,
      creationDati = loginGrant.login.date,
      name = siteName,
      host = s"$siteName.${stuffCreator.firstSiteHost}",
      ownerIp = loginGrant.login.ip,
      ownerLoginId = loginGrant.login.id,
      ownerIdentity = loginGrant.identity.asInstanceOf[IdentityOpenId],
      ownerRole = loginGrant.user)

    anyNewSiteAndOwner match {
      case Some(newSiteAndOwner) => newSiteAndOwner
      case None => fail("Test broken? Site already exists?")
    }
  }


  def loginNewOpenIdUser(namePrefix: String, siteId: String, ip: String): LoginGrant =
    loginNewOpenIdUser(namePrefix, SiteAndIp(siteId, ip))


  def loginNewOpenIdUser(namePrefix: String, siteAndIp: SiteAndIp): LoginGrant = {
    nextOpenIdUserNo += 1
    val identity = IdentityOpenId(id = "?i", userId = "?",
      oidEndpoint = "provider.example.com/endpoint", oidVersion = "2",
      oidRealm = "example.com", oidClaimedId = s"claimed-id-$nextOpenIdUserNo.example.com",
      oidOpLocalId = s"provider.example.com/local/id/$nextOpenIdUserNo",
      firstName = s"$namePrefix-OpenIdUser$nextOpenIdUserNo",
      email = s"openid-user-$nextOpenIdUserNo@example.com", country = "Sweden")
    loginNewUser(namePrefix, siteAndIp, identity)
  }


  def loginNewGuestUser(namePrefix: String, siteAndIp: SiteAndIp): LoginGrant = {
    nextGuestUserNo += 1
    val identity = IdentitySimple(id = "?i", userId = "?",
        name = s"$namePrefix-GuestUser$nextGuestUserNo",
        email = s"guest-email-$nextGuestUserNo@example.com", location = "", website = "")
    loginNewUser(namePrefix, siteAndIp, identity)
  }


  def loginNewUser(namePrefix: String, siteAndIp: SiteAndIp, identity: Identity)
        : LoginGrant = {
    val loginNoId = Login(
      id = "?",
      prevLoginId = None,
      ip = siteAndIp.ip,
      date = new ju.Date(), identityId = "?i")

    val loginReq = LoginRequest(loginNoId, identity)
    tenantDao(siteAndIp).saveLogin(loginReq)
  }


  def createPage(loginId: String, author: User, dao: SiteDao) = {
    val creationDati = new ju.Date
    val pageId = AppCreatePage.generateNewPageId()
    val pageRole = PageRole.Generic
    val pageBody = PostActionDto.forNewPageBody("Page body.", creationDati, pageRole,
      loginId = loginId, userId = author.id, approval = Some(Approval.Preliminary))
    val actions = PageParts(pageId, actionDtos = List(pageBody))

    dao.createPage(Page(
      PageMeta.forNewPage(
        pageRole, author, actions, creationDati, publishDirectly = true),
      PagePath(dao.siteId, folder = "/",
        pageId = Some(pageId), showId = true, pageSlug = "test-page"),
      ancestorIdsParentFirst = Nil,
      actions))
  }


  /**
   * Does something until over quota. Prints progress to System.out,
   * since these tests might take very long.
   */
  def loopUntilDeclined[T: ClassTag](min: Int, max: Int, perLap: Int = 1)(block: => Unit)
        : OverQuotaException = {
    var count = 0
    println(o"""Starting decline loop: min: $min, max: $max, per lap: $perLap,
     test: ``$currentTestName''""")

    val overQuotaException = try {
      while (true) {
        block
        count += perLap
        if ((count / perLap) % 10 == 0) println(s"... $count")
        if (count > max) println(s"... Ooops! Broke the max limit ($max)")
        count must be <= max
      }
      // Make the compiler happy:
      null: OverQuotaException
    }
    catch {
      case ex: OverQuotaException => ex
    }

    println(o"""... ${classNameOf(overQuotaException.consumer)} over quota
      after $count things.""")

    val correctConsumerDeclined =
      classTag[T].runtimeClass.isInstance(overQuotaException.consumer)

    val ok =
    if (count < min) println(s"... Ooops! Didn't reach the min limit ($min)")
    if (!correctConsumerDeclined)
      println(o"""... Ooops! Wrong consumer declined, should have been:
        ${classTag[T].runtimeClass}""")

    if (count < min || !correctConsumerDeclined)
      println(i"""
        |   ==> The OverQuotaException:
        |    consumer: ${overQuotaException.consumer}
        |    stateNow: ${overQuotaException.stateNow}
        |    stateAfter: ${overQuotaException.stateAfter}
        |    outstanding: ${overQuotaException.outstanding}
        |    message: ${overQuotaException.message}
        """)

    count must be >= min
    assert(correctConsumerDeclined, "The wrong consumer was decined")
    overQuotaException
  }

}


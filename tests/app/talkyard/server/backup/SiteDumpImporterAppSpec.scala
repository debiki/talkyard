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

package talkyard.server.backup

import java.io.RandomAccessFile
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.EdHttp.ResultException
import debiki.dao.DaoAppSuite
import org.scalatest._
import java.{io => jio}


class SiteDumpImporterAppSpec extends DaoAppSuite(disableScripts = false) {


  def createSite(id: String): Site = {
    globals.systemDao.createAdditionalSite(
      pubId = s"imptest_$id", name = s"imp-test-$id", status = SiteStatus.Active,
      hostname = Some(s"imp-test-$id"),
      embeddingSiteUrl = None, organizationName = s"Imp Test Org $id",
      creatorId = SystemUserId, // not in use when createdFromSiteId is None
      browserIdData, isTestSiteOkayToDelete = true, skipMaxSitesCheck = true,
      deleteOldSite = false, pricePlan = "Unknown", createdFromSiteId = None)
  }


  def upsert(siteId: SiteId, dump: SiteBackup) {
    val importer = SiteBackupImporterExporter(globals)
    importer.upsertIntoExistingSite(siteId, dump, browserIdData)
  }


  "SiteDumpImporter can" - {

    "import nothing into an empty site" - {
      var site: Site = null
      "import" in {
        site = createSite("empty-5079267")
        upsert(site.id, SiteBackup.empty)
      }
      "read back, it's empty" in {
        val dump = SiteBackupMaker(context = context).loadSiteDump(site.id)
        dump mustBe SiteBackup.empty
      }
    }

    "import one item of each type into an empty site" - {
      "import the items" in {
      }

      "now they're all there" in {
      }

      "re-import the items has no effect" in {
      }
    }

    "re-import a dump with old and new items, upserts only the new items" in {
    }

    "two sites can share the same upload" in {
      /*
      val dao = globals.siteDao(Site.FirstSiteId)

      info("create user, site 1")
      val magic = "site1_6kmf2"
      val user = dao.createPasswordUserCheckPasswordStrong(NewPasswordUserData.create(
        name = Some(s"User $magic"), username = s"user_$magic", email = s"user-$magic@x.co",
        password = Some(magic), createdAt = globals.now(), isAdmin = true, isOwner = false).get,
        browserIdData)

      info("create site 2")
      val site2 = globals.systemDao.createAdditionalSite(
        pubId = "dummy56205", name = "site-two-name", status = SiteStatus.Active,
        hostname = Some("site-two"),
        embeddingSiteUrl = None, organizationName = "Test Org Name", creatorId = user.id,
        browserIdData, isTestSiteOkayToDelete = true, skipMaxSitesCheck = true,
        deleteOldSite = false, pricePlan = "Unknown", createdFromSiteId = None)

      info("create user (owner), site 2")
      val dao2 = globals.siteDao(site2.id)
      val user2 = dao2.createPasswordUserCheckPasswordStrong(NewPasswordUserData.create(
        name = Some(s"User $magic"), username = s"user_$magic", email = s"user-$magic@x.co",
        password = Some(magic), createdAt = globals.now(), isAdmin = true, isOwner = true).get,
        browserIdData) */
    }

  }

}

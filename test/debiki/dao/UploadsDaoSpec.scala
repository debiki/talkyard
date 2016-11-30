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

import java.io.RandomAccessFile

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.DebikiHttp.ResultException
import debiki.{TextAndHtml, Globals}
import org.scalatest._
import java.{io => jio}


class UploadsDaoSpec extends FreeSpec with MustMatchers {

  "UploadsDao can" - {

    "not change the hash length" in {
      UploadsDao.HashLength mustBe 33
    }

    "calc size4kBlocksBase4" in {
      val k = 1000
      an [IllegalArgumentException] must be thrownBy UploadsDao.sizeKiloBase4(-1)
      UploadsDao.sizeKiloBase4(0) mustBe 0
      UploadsDao.sizeKiloBase4(1) mustBe 0
      UploadsDao.sizeKiloBase4(100) mustBe 0
      UploadsDao.sizeKiloBase4(3999) mustBe 0
      UploadsDao.sizeKiloBase4(4*k) mustBe 1
      UploadsDao.sizeKiloBase4(10*k    ) mustBe 1
      UploadsDao.sizeKiloBase4(16*k - 1) mustBe 1
      UploadsDao.sizeKiloBase4(16*k) mustBe 2
      UploadsDao.sizeKiloBase4(64*k - 1) mustBe 2
      UploadsDao.sizeKiloBase4(64*k    ) mustBe 3
      UploadsDao.sizeKiloBase4(256*k - 1) mustBe 3
      UploadsDao.sizeKiloBase4(256*k    ) mustBe 4
      UploadsDao.sizeKiloBase4(1024*k - 1) mustBe 4
      UploadsDao.sizeKiloBase4(1024*k    ) mustBe 5
      UploadsDao.sizeKiloBase4(4096*k - 1) mustBe 5
      UploadsDao.sizeKiloBase4(4096*k    ) mustBe 6
      UploadsDao.sizeKiloBase4(16384*k - 1) mustBe 6
      UploadsDao.sizeKiloBase4(16384*k    ) mustBe 7
      UploadsDao.sizeKiloBase4(20*k*k    ) mustBe 7
      UploadsDao.sizeKiloBase4(60*k*k    ) mustBe 7
      UploadsDao.sizeKiloBase4(100*k*k    ) mustBe 8
      UploadsDao.sizeKiloBase4(300*k*k    ) mustBe 9
      UploadsDao.sizeKiloBase4(k*k*k    ) mustBe 9
      UploadsDao.sizeKiloBase4(1048576*k - 1) mustBe 9
      UploadsDao.sizeKiloBase4(1048576*k    ) mustBe 10
    }

    "make hash paths" in {
      UploadsDao.makeHashPath(16000, "abczzwwqq", ".jpg") mustBe "2/a/bc/zzwwqq.jpg"
      UploadsDao.makeHashPath(16000, "abczzwwqq", "") mustBe "2/a/bc/zzwwqq"
      UploadsDao.makeHashPath(0, "abczzwwqq", ".tgz") mustBe "0/a/bc/zzwwqq.tgz"
      UploadsDao.makeHashPath(3999, "abczzwwqq", ".tgz") mustBe "0/a/bc/zzwwqq.tgz"
      UploadsDao.makeHashPath(4000, "abczzwwqq", ".tgz") mustBe "1/a/bc/zzwwqq.tgz"
    }
  }

}


class UploadsDaoAppSpec extends DaoAppSuite(disableScripts = false) {

  case class FileNameRef(name: String, file: jio.File, ref: UploadRef)

  def makeRandomFile(name: String, dotSuffix: String, sizeBytes: Int): FileNameRef = {
    val fileName = s"$name-" + System.currentTimeMillis() + dotSuffix
    val file = new jio.File(s"$tempFileDir/$fileName")
    val raf = new RandomAccessFile(file, "rw")
    raf.setLength(sizeBytes)
    val ref = UploadRef(Globals.uploadsUrlPath, UploadsDao.makeHashPath(file, ".jpg"))
    FileNameRef(fileName, file, ref)
  }

  val tempFileDir = "/tmp/UploadsDaoAppSpec"
  new jio.File(s"$tempFileDir/dummy").getParentFile.mkdirs()


  "The app and UploadsDao can" - {

    "use no quota" in {
      val dao = Globals.siteDao(Site.FirstSiteId)

      var resourceUsage = dao.loadResourceUsage()
      resourceUsage.numUploads mustBe 0
      resourceUsage.numUploadBytes mustBe 0

      dao.setUserAvatar(SystemUserId, tinyAvatar = None, smallAvatar = None, mediumAvatar = None,
        browserIdData)

      resourceUsage = dao.loadResourceUsage()
      resourceUsage.numUploads mustBe 0
      resourceUsage.numUploadBytes mustBe 0
    }


    "upload an image, use it as avatar" in {
      val tinyAvatar = makeRandomFile("tiny-avatar", ".jpg", 1021)
      val smallAvatar = makeRandomFile("small-avatar", ".jpg", 2031)
      val mediumAvatar = makeRandomFile("med-avatar", ".jpg", 3041)
      val dao = Globals.siteDao(Site.FirstSiteId)
      var resourceUsage: ResourceUse = null

      info("create user")
      val magic = "55JMU2456"
      val user = dao.createPasswordUserCheckPasswordStrong(NewPasswordUserData.create(
        name = Some(s"User $magic"), username = s"user_$magic", email = s"user-$magic@x.c",
        password = magic, isAdmin = false, isOwner = false).get)

      info("upload avatar images, no quota used")
      dao.addUploadedFile(tinyAvatar.name, tinyAvatar.file, user.id, browserIdData)
      dao.addUploadedFile(smallAvatar.name, smallAvatar.file, user.id, browserIdData)
      dao.addUploadedFile(mediumAvatar.name, mediumAvatar.file, user.id, browserIdData)
      resourceUsage = dao.loadResourceUsage()
      resourceUsage.numUploads mustBe 0
      resourceUsage.numUploadBytes mustBe 0

      info("start using avatar, now quota consumed")
      dao.setUserAvatar(user.id, tinyAvatar = Some(tinyAvatar.ref),
        smallAvatar = Some(smallAvatar.ref), mediumAvatar = Some(mediumAvatar.ref), browserIdData)
      resourceUsage = dao.loadResourceUsage()
      resourceUsage.numUploads mustBe 3
      resourceUsage.numUploadBytes mustBe (1021 + 2031 + 3041)

      info("stop using avatar, quota freed")
      dao.setUserAvatar(user.id, tinyAvatar = None, smallAvatar = None, mediumAvatar = None,
        browserIdData)
      resourceUsage = dao.loadResourceUsage()
      resourceUsage.numUploads mustBe 0
      resourceUsage.numUploadBytes mustBe 0
    }


    "set avatar image refs, but upload image afterwards, i.e. wrong order" in {
      val tinyAvatar = makeRandomFile("tiny-avatar", ".jpg", 1020)
      val smallAvatar = makeRandomFile("small-avatar", ".jpg", 2030)
      val mediumAvatar = makeRandomFile("med-avatar", ".jpg", 3040)
      val dao = Globals.siteDao(Site.FirstSiteId)
      var resourceUsage: ResourceUse = null

      info("create user")
      val magic = "77PKW2PKW2"
      val user = dao.createPasswordUserCheckPasswordStrong(NewPasswordUserData.create(
        name = Some(s"User $magic"), username = s"user_$magic", email = s"user-$magic@x.c",
        password = magic, isAdmin = false, isOwner = false).get)

      info("set avatar")
      dao.setUserAvatar(user.id, tinyAvatar = Some(tinyAvatar.ref),
        smallAvatar = Some(smallAvatar.ref), mediumAvatar = Some(mediumAvatar.ref), browserIdData)
      resourceUsage = dao.loadResourceUsage()
      resourceUsage.numUploads mustBe 0
      resourceUsage.numUploadBytes mustBe 0

      info("upload tiny image")
      dao.addUploadedFile(tinyAvatar.name, tinyAvatar.file, user.id, browserIdData)
      resourceUsage = dao.loadResourceUsage()
      resourceUsage.numUploads mustBe 1
      resourceUsage.numUploadBytes mustBe 1020

      info("upload small image")
      dao.addUploadedFile(smallAvatar.name, smallAvatar.file, user.id, browserIdData)
      resourceUsage = dao.loadResourceUsage()
      resourceUsage.numUploads mustBe 2
      resourceUsage.numUploadBytes mustBe (1020 + 2030)

      info("upload medium image")
      dao.addUploadedFile(mediumAvatar.name, mediumAvatar.file, user.id, browserIdData)
      resourceUsage = dao.loadResourceUsage()
      resourceUsage.numUploads mustBe 3
      resourceUsage.numUploadBytes mustBe (1020 + 2030 + 3040)

      info("unset avatar, get quota back")
      dao.setUserAvatar(user.id, tinyAvatar = None, smallAvatar = None, mediumAvatar = None,
        browserIdData)
      resourceUsage = dao.loadResourceUsage()
      resourceUsage.numUploads mustBe 0
      resourceUsage.numUploadBytes mustBe 0
    }


    "upload a file, include it in a new page, edit, unlink" in {
      val sunImage = makeRandomFile("the-sun", ".jpg", 1040)
      val moonImage = makeRandomFile("the-moon", ".jpg", 2050)
      val dao = Globals.siteDao(Site.FirstSiteId)
      var resourceUsage: ResourceUse = null

      info("create user")
      val magic = "7GMYK253"
      val user = dao.createPasswordUserCheckPasswordStrong(NewPasswordUserData.create(
        name = Some(s"User $magic"), username = s"user_$magic", email = s"user-$magic@x.c",
        password = magic, isAdmin = true, isOwner = false).get)

      info("upload files, no quota used")
      dao.addUploadedFile(sunImage.name, sunImage.file, user.id, browserIdData)
      dao.addUploadedFile(moonImage.name, moonImage.file, user.id, browserIdData)
      resourceUsage = dao.loadResourceUsage()
      resourceUsage.numUploads mustBe 0
      resourceUsage.numUploadBytes mustBe 0

      info("create page, link first file, now some quota used")
      val titleTextAndHtml = TextAndHtml("Planets", isTitle = true)
      val bodyTextAndHtml = TextAndHtml(s"[The sun](${sunImage.ref.url})", isTitle = false)
      val pagePath = dao.createPage(PageRole.Discussion, PageStatus.Published,
        anyCategoryId = None, anyFolder = None, anySlug = None,
        titleTextAndHtml = titleTextAndHtml, bodyTextAndHtml = bodyTextAndHtml,
        showId = true, Who(user.id, browserIdData), dummySpamRelReqStuff)

      resourceUsage = dao.loadResourceUsage()
      resourceUsage.numUploads mustBe 1
      resourceUsage.numUploadBytes mustBe 1040

      info("edit page: add second file, more quota used")
      val newTextAndHtml = bodyTextAndHtml.append(s"\n[The moon](${moonImage.ref.url})")
      dao.editPostIfAuth(pagePath.thePageId, PageParts.BodyNr, Who(user.id, browserIdData),
        dummySpamRelReqStuff, newTextAndHtml)

      resourceUsage = dao.loadResourceUsage()
      resourceUsage.numUploads mustBe 2
      resourceUsage.numUploadBytes mustBe (1040 + 2050)

      info("edit page: remove second file, quota freed")
      dao.editPostIfAuth(pagePath.thePageId, PageParts.BodyNr, Who(user.id, browserIdData),
        dummySpamRelReqStuff, bodyTextAndHtml)

      resourceUsage = dao.loadResourceUsage()
      resourceUsage.numUploads mustBe 1
      resourceUsage.numUploadBytes mustBe 1040

      info("edit page: remove the first file, remaining quota freed")
      dao.editPostIfAuth(pagePath.thePageId, PageParts.BodyNr, Who(user.id, browserIdData),
        dummySpamRelReqStuff, TextAndHtml("empty", isTitle = false))

      resourceUsage = dao.loadResourceUsage()
      resourceUsage.numUploads mustBe 0
      resourceUsage.numUploadBytes mustBe 0
    }


    "link an upload from a post, then upload it, i.e. wrong order" in {
      val sunImage = makeRandomFile("the-sun", ".jpg", 1060)
      val dao = Globals.siteDao(Site.FirstSiteId)
      var resourceUsage: ResourceUse = null

      info("create user")
      val magic = "6J35MK21"
      val user = dao.createPasswordUserCheckPasswordStrong(NewPasswordUserData.create(
        name = Some(s"User $magic"), username = s"user_$magic", email = s"user-$magic@x.c",
        password = magic, isAdmin = true, isOwner = false).get)

      info("create page, link missing file, no quota used")
      val titleTextAndHtml = TextAndHtml("The Sun", isTitle = true)
      val bodyTextAndHtml = TextAndHtml(s"[The sun](${sunImage.ref.url})", isTitle = false)
      val pagePath = dao.createPage(PageRole.Discussion, PageStatus.Published,
        anyCategoryId = None, anyFolder = None, anySlug = None,
        titleTextAndHtml = titleTextAndHtml, bodyTextAndHtml = bodyTextAndHtml,
        showId = true, Who(user.id, browserIdData), dummySpamRelReqStuff)

      resourceUsage = dao.loadResourceUsage()
      resourceUsage.numUploads mustBe 0
      resourceUsage.numUploadBytes mustBe 0

      info("upload the file, now quota gets used")
      dao.addUploadedFile(sunImage.name, sunImage.file, user.id, browserIdData)
      resourceUsage = dao.loadResourceUsage()
      resourceUsage.numUploads mustBe 1
      resourceUsage.numUploadBytes mustBe 1060

      info("edit page: remove link, quota freed")
      dao.editPostIfAuth(pagePath.thePageId, PageParts.BodyNr, Who(user.id, browserIdData),
        dummySpamRelReqStuff, TextAndHtml("empty", isTitle = false))

      resourceUsage = dao.loadResourceUsage()
      resourceUsage.numUploads mustBe 0
      resourceUsage.numUploadBytes mustBe 0
    }


    "two sites can share the same upload" in {
      val sharedFileSize = 1300
      val site1FileSize = 1001
      val site2FileSize = 1010
      val sharedFile = makeRandomFile("shared", ".jpg", sharedFileSize)
      val site1File = makeRandomFile("site-1", ".jpg", site1FileSize)
      val site2File = makeRandomFile("site-2", ".jpg", site2FileSize)
      val dao = Globals.siteDao(Site.FirstSiteId)
      var resourceUsage: ResourceUse = null

      info("create user, site 1")
      val magic = "Site1_6KMF2"
      val user = dao.createPasswordUserCheckPasswordStrong(NewPasswordUserData.create(
        name = Some(s"User $magic"), username = s"user_$magic", email = s"user-$magic@x.c",
        password = magic, isAdmin = true, isOwner = false).get)

      info("create site 2")
      val site2 = dao.createSite("site-two-name", status = SiteStatus.Active, hostname = "site-two",
        embeddingSiteUrl = None, organizationName = "Test Org Name",
        creatorEmailAddress = "t@x.c", creatorId = user.id, browserIdData: BrowserIdData,
        isTestSiteOkayToDelete = false, skipMaxSitesCheck = true,
        deleteOldSite = false, pricePlan = "Unknown")

      info("create user (owner), site 2")
      val dao2 = Globals.siteDao(site2.id)
      val user2 = dao2.createPasswordUserCheckPasswordStrong(NewPasswordUserData.create(
        name = Some(s"User $magic"), username = s"user_$magic", email = s"user-$magic@x.c",
        password = magic, isAdmin = true, isOwner = true).get)

      info("upload files, no quota used")

      dao.addUploadedFile(sharedFile.name, sharedFile.file, user.id, browserIdData)
      dao.addUploadedFile(site1File.name, site1File.file, user.id, browserIdData)
      dao2.addUploadedFile(site2File.name, site2File.file, user2.id, browserIdData)

      resourceUsage = dao.loadResourceUsage()
      resourceUsage.numUploads mustBe 0
      resourceUsage.numUploadBytes mustBe 0

      resourceUsage = dao2.loadResourceUsage()
      resourceUsage.numUploads mustBe 0
      resourceUsage.numUploadBytes mustBe 0

      info("create page, site 1 and 2, link files, now quota used")

      // COULD speed up by writing html, not commonmark, and passing a noop CommonmarRenderer
      // to TextAndHtml (see its function signature).
      val titleTextAndHtml = TextAndHtml("Planets", isTitle = true)
      val bodyTextAndHtmlSite1 = TextAndHtml(
        s"[Shared](${sharedFile.ref.url}), [site-one](${site1File.ref.url})", isTitle = false)
      val bodyTextAndHtmlSite2 = TextAndHtml(
        s"[Shared](${sharedFile.ref.url}), [site-two](${site2File.ref.url})", isTitle = false)

      val pagePath1 = dao.createPage(PageRole.Discussion, PageStatus.Published,
        anyCategoryId = None, anyFolder = None, anySlug = None,
        titleTextAndHtml = titleTextAndHtml, bodyTextAndHtml = bodyTextAndHtmlSite1,
        showId = true, Who(user.id, browserIdData), dummySpamRelReqStuff)

      dao2.createPage(PageRole.Discussion, PageStatus.Published,
        anyCategoryId = None, anyFolder = None, anySlug = None,
        titleTextAndHtml = titleTextAndHtml, bodyTextAndHtml = bodyTextAndHtmlSite2,
        showId = true, Who(user2.id, browserIdData), dummySpamRelReqStuff)

      resourceUsage = dao.loadResourceUsage()
      resourceUsage.numUploads mustBe 2
      resourceUsage.numUploadBytes mustBe (sharedFileSize + site1FileSize)

      resourceUsage = dao2.loadResourceUsage()
      resourceUsage.numUploads mustBe 2
      resourceUsage.numUploadBytes mustBe (sharedFileSize + site2FileSize)

      info("edit site 1 page: remove links, remaining quota freed, site 1 only")

      dao.editPostIfAuth(pagePath1.thePageId, PageParts.BodyNr, Who(user.id, browserIdData),
        dummySpamRelReqStuff, TextAndHtml("empty", isTitle = false))

      resourceUsage = dao2.loadResourceUsage()
      resourceUsage.numUploads mustBe 2
      resourceUsage.numUploadBytes mustBe (sharedFileSize + site2FileSize)

      resourceUsage = dao.loadResourceUsage()
      resourceUsage.numUploads mustBe 0
      resourceUsage.numUploadBytes mustBe 0
    }


    "prevent people from uploading too many large files" in {
      val fileOne = makeRandomFile("file-one", ".jpg", UploadsDao.MaxBytesPerDayMember / 3)
      val fileTwo = makeRandomFile("file-two", ".jpg", UploadsDao.MaxBytesPerDayMember / 3)
      val fileThree = makeRandomFile("file-three", ".jpg", UploadsDao.MaxBytesPerDayMember / 2)
      val fileTiny = makeRandomFile("file-tiny", ".jpg", 130)

      val dao = Globals.siteDao(Site.FirstSiteId)
      var resourceUsage: ResourceUse = null

      info("create user")
      val magic = "7MPFKU23"
      val user = dao.createPasswordUserCheckPasswordStrong(NewPasswordUserData.create(
        name = Some(s"User $magic"), username = s"user_$magic", email = s"user-$magic@x.c",
        password = magic, isAdmin = false, isOwner = false).get)

      info("upload files, as long as haven't uploaded too much")
      dao.addUploadedFile(fileOne.name, fileOne.file, user.id, browserIdData)
      dao.addUploadedFile(fileTwo.name, fileTwo.file, user.id, browserIdData)

      // The audit log is used to detect too-many-big-files-uploaded. Not the quota system.
      resourceUsage = dao.loadResourceUsage()
      resourceUsage.numUploads mustBe 0
      resourceUsage.numUploadBytes mustBe 0

      info("not be allowed to upload too much data")
      val exception = intercept[ResultException] {
        dao.addUploadedFile(fileThree.name, fileThree.file, user.id, browserIdData)
      }
      exception.statusCode mustBe play.api.http.Status.REQUEST_ENTITY_TOO_LARGE

      info("but may upload one more file, if it's small enough")
      dao.addUploadedFile(fileTiny.name, fileTiny.file, user.id, browserIdData)
    }
  }

}

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

import java.awt.Image
import java.awt.image.BufferedImage

import com.debiki.core._
import com.debiki.core.Prelude._
import com.google.{common => guava}
import debiki.DebikiHttp._
import java.{io => jio}
import java.nio.{file => jf}
import debiki.{ImageUtils, ReactRenderer}
import org.jsoup.Jsoup
import play.{api => p}
import play.api.Play
import UploadsDao._

import scala.collection.mutable.ArrayBuffer


/** Moves temp files into the uploads directory and adds metadata about the uploaded files.
  */
trait UploadsDao {
  self: SiteDao =>


  /** Returns the hash-path-suffix to the file after it has been copied into the uploads
    * directory, or CDN. E.g. returns "x/y/zwq...abc.jpg" where "xyzwq...abc" is the hash.
    * The reason for the slashes is that then all uploads won't end up in the same
    * directory, if stored on localhost (some file systems don't want 99999 files in a
    * single directory).
    */
  def addUploadedFile(uploadedFileName: String, tempFile: jio.File, uploadedById: UserId,
        browserIdData: BrowserIdData): UploadRef = {

    val publicUploadsDir = anyPublicUploadsDir getOrElse throwForbidden(
      "DwE5KFY9", "File uploads disabled, config value missing: " +
        LocalhostUploadsDirConfigValueName)

    val uploadedDotSuffix = '.' + checkAndGetFileSuffix(uploadedFileName)

    val origFileSize = tempFile.length
    if (origFileSize >= maxUploadSizeBytes)
      throwForbidden("DwE5YFK2", s"File too large, more than $origFileSize bytes")

    var tempCompressedFile: Option[jio.File] = None
    var dimensions: Option[(Int, Int)] = None

    // Try to convert the file to an image and then compress it. If this works and if
    // the compressed file is smaller, then use it instead.
    val (optimizedFile, optimizedDotSuffix) = {
      val anyImage: Option[BufferedImage] =
        try Option(javax.imageio.ImageIO.read(tempFile))
        catch {
          case _: jio.IOException =>
            None // not an image, fine
        }
      anyImage match {
        case None =>
          (tempFile, uploadedDotSuffix)
        case Some(image) =>
          dimensions = Some((image.getWidth, image.getHeight))
          tempCompressedFile = Some(new jio.File(tempFile.toPath + ".compressed.jpg"))
          ImageUtils.convertToCompressedJpeg(image, tempCompressedFile.get)
          if (tempCompressedFile.get.length < tempFile.length) {
            (tempCompressedFile.get, ".jpg")
          }
          else {
            tempCompressedFile.get.delete()
            tempCompressedFile = None
            (tempFile, uploadedDotSuffix)
          }
      }
    }

    val mimeType = java.nio.file.Files.probeContentType(optimizedFile.toPath.toAbsolutePath)
    val sizeBytes = {
      val sizeAsLong = optimizedFile.length
      if (sizeAsLong >= maxUploadSizeBytes) {
        throwForbidden("DwE5YFK2", s"Optimized file too large, more than $maxUploadSizeBytes bytes")
      }
      sizeAsLong.toInt
    }

    // (It's okay to truncate the hash, see e.g.:
    // http://crypto.stackexchange.com/questions/9435/is-truncating-a-sha512-hash-to-the-first-160-bits-as-secure-as-using-sha1 )
    val hashCode = guava.io.Files.hash(optimizedFile, guava.hash.Hashing.sha256)
    val hashString = base32lowercaseEncoder.encode(hashCode.asBytes) take HashLength

    val hashPathSuffix =
      s"${hashString.head}/${hashString.charAt(1)}/${hashString drop 2}$optimizedDotSuffix"

    val destinationFile = new java.io.File(s"$publicUploadsDir$hashPathSuffix")
    destinationFile.getParentFile.mkdirs()

    // Remember this new file and who uploaded it.
    // (Do this before moving the it into the uploads directory, in case the server
    // crashes. We don't want any files with missing metadata in the uploads directory
    // — but it's okay with metadata for which the actual files are missing: we can just
    // delete the metadata entries later. [9YMU2Y])
    readWriteTransaction { transaction =>
      // The file will be accessible on localhost, it hasn't yet been moved to e.g. any CDN.
      val uploadRef = UploadRef(localhostUploadsBaseUrl, hashPathSuffix)
      transaction.insertUploadedFileMeta(uploadRef, sizeBytes, mimeType, dimensions)
      insertAuditLogEntry(AuditLogEntry(
        siteId = siteId,
        id = AuditLogEntry.UnassignedId,
        didWhat = AuditLogEntryType.UploadFile,
        doerId = uploadedById,
        doneAt = transaction.currentTime,
        browserIdData = browserIdData,
        uploadHashPathSuffix = Some(hashPathSuffix),
        uploadFileName = Some(uploadedFileName),
        sizeBytes = Some(sizeBytes)), transaction)
    }

    // (Don't do this inside the transaction above, because then the file might be moved
    // in place, but the transaction might fail —> metadata never created.)
    try jf.Files.move(optimizedFile.toPath, destinationFile.toPath)
    catch {
      case _: jf.FileAlreadyExistsException =>
        // Fine. Same name -> same hash -> same content.
      case ex: Exception =>
        p.Logger.error(o"""Error moving file into place, name: $uploadedFileName, file path:
          ${optimizedFile.getPath}, destination: ${destinationFile.getPath} [DwE8MF2]""", ex)
        throw ex
    }

    // COULD wrap in try...finally, so will be deleted for sure.
    tempCompressedFile.foreach(_.delete)

    UploadRef(localhostUploadsBaseUrl, hashPathSuffix)
  }

}


object UploadsDao {

  import play.api.Play.current

  val MaxSuffixLength = 12

  val base32lowercaseEncoder = guava.io.BaseEncoding.base32().lowerCase()

  /** We don't need all 51.2 base32 sha256 chars (51 results in rather long file names).
    * SHA-1 is 32 chars in base32 — let's keep 33 chars so people won't mistake this
    * for SHA-1.
    * Don't change this — that would invalidate all hashes in the database.
    */
  val HashLength = 33

  val LocalhostUploadsDirConfigValueName = "debiki.uploads.localhostDir"

  val maxUploadSizeBytes = Play.configuration.getInt("debiki.uploads.maxKiloBytes").map(_ * 1000)
    .getOrElse(3*1000*1000)

  val MaxAvatarTinySizeBytes = 1*1000
  val MaxAvatarSmallSizeBytes = 5*1000
  val MaxAvatarMediumSizeBytes = 100*1000

  val anyUploadsDir = {
    val value = Play.configuration.getString(LocalhostUploadsDirConfigValueName)
    val pathWithSlash = if (value.exists(_.endsWith("/"))) value else value.map(_ + "/")
    pathWithSlash match {
      case None =>
        p.Logger.warn( s"""Config value $LocalhostUploadsDirConfigValueName missing;
          file uploads disabled. [DwE74W2]""")
        None
      case Some(path) =>
        // SECURITY COULD test more dangerous dirs. Or whitelist instead?
        if (path == "/" || path.startsWith("/etc/") || path.startsWith("/bin/")) {
          p.Logger.warn(s"""Config value $LocalhostUploadsDirConfigValueName specifies
            a dangerous path: $path — file uploads disabled. [DwE0GM2]""")
          None
        }
        else {
          pathWithSlash
        }
    }
  }

  val anyPublicUploadsDir = anyUploadsDir.map(_ + "public/")

  val localhostUploadsBaseUrl = controllers.routes.UploadsController.servePublicFile("").url

  val HashPathSuffixRegex = """^[a-z0-9]/[a-z0-9]/[a-z0-9]+\.[a-z0-9]+$""".r


  def findUploadRefsInText(html: String): Set[UploadRef] = {
    // COULD reuse TextAndHtml — it also finds links
    TESTS_MISSING
    val document = Jsoup.parse(html)
    val anchorElems: org.jsoup.select.Elements = document.select("a[href]")
    val mediaElems: org.jsoup.select.Elements = document.select("[src]")
    val references = ArrayBuffer[UploadRef]()

    import scala.collection.JavaConversions._

    for (linkElem: org.jsoup.nodes.Element <- anchorElems) {
      val url = linkElem.attr("href")
      if ((url ne null) && url.nonEmpty) {
        addUrlIfReferencesUploadedFile(url)
      }
    }

    for (mediaElem: org.jsoup.nodes.Element <- mediaElems) {
      val url = mediaElem.attr("src")
      if ((url ne null) && url.nonEmpty) {
        addUrlIfReferencesUploadedFile(url)
      }
    }

    def addUrlIfReferencesUploadedFile(urlString: String) {
      val urlPath =
        if (urlString startsWith "/") urlString
        else {
          val url = new java.net.URL(urlString)
          try url.getPath
          catch {
            case _: java.net.MalformedURLException =>
              return
          }
        }
      if (urlPath startsWith localhostUploadsBaseUrl) {
        val hashPathSuffix = urlPath drop localhostUploadsBaseUrl.length
        if (HashPathSuffixRegex matches hashPathSuffix) {
          // Don't add any hostname, because files stored locally are accessible from any hostname
          // that maps to this server — only the file content hash matters.
          references.append(UploadRef(localhostUploadsBaseUrl, hashPathSuffix))
        }
      }
      /* Later, if serving uploads via a CDN:
      else if (urlPath starts with cdn-hostname) {
        if (HashPathSuffixRegex matches hashPathSuffix) {
          ...
          val baseUrl = url.getHost + "/"
          ...
        }
      }*/
    }

    references.toSet
  }


  def findUploadRefsInPost(post: Post): Set[UploadRef] = {
    val approvedRefs = post.approvedHtmlSanitized.map(findUploadRefsInText) getOrElse Set.empty
    val currentRefs = findUploadRefsInText(post.currentHtmlSanitizedToFindLinks(ReactRenderer))
    approvedRefs ++ currentRefs
  }


  def checkAndGetFileSuffix(fileName: String): String = {
    // For now, require exactly 1 dot. Later: don't store the suffix at all?
    // Instead, derive it based on the mime type. Could use Apache Tika.
    // See: http://stackoverflow.com/questions/13650372/
    //        how-to-determine-appropriate-file-extension-from-mime-type-in-java
    // the answer: MimeTypes.getDefaultMimeTypes().forName("image/jpeg").getExtension()
    // and: need include xml file from Tika jar, it has all mime definitions.

    if (fileName.contains(".tar.")) throwForbidden(
      "DwE8PMU2", o"""Please change the suffix from e.g. ".tar.gz" to ".tgz", because only the "
      characters after the very last dot are used as the suffix""")

    if (fileName.count(_ == '.') > 1) throwForbidden(
      "DwE2FPYU0", o"""The file name should have exactly one dot, otherwise I don't know where
           the file suffix starts""")

    if (!fileName.exists(_ == '.'))
      throwForbidden("DwE6UPM5", "The file has no suffix")

    // (Convert to lowercase, don't want e.g. both .JPG and .jpg.)
    val suffix = fileName.takeRightWhile(_ != '.').toLowerCase

    if (suffix.length > MaxSuffixLength)
      throwBadRequest("DwE7F3P5", o"""File has too long suffix: '$fileName'
        (max $MaxSuffixLength chars)""")

    if (suffix.isEmpty)
      throwForbidden("DwE2WUMF", "Empty file suffix, nothing after the dot in the file name")

    suffix
  }

}

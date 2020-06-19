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
import com.debiki.core.Prelude._
import com.google.{common => guava}
import debiki.{Globals, ImageUtils, TextAndHtmlMaker}
import debiki.EdHttp._
import ed.server.UploadsUrlBasePath
import java.{io => jio, lang => jl, util => ju}
import java.awt.image.BufferedImage
import java.nio.{file => jf}
import java.nio.file.{attribute => jfa}
import org.jsoup.Jsoup
import play.{api => p}
import UploadsDao._
import com.google.common.io.BaseEncoding
import scala.collection.mutable.ArrayBuffer
import scala.util.matching.Regex


/** Moves temp files into the uploads directory and adds metadata about the uploaded files.
  */
trait UploadsDao {
  self: SiteDao =>

  import context.globals

  /** Returns the hash-path-suffix to the file after it has been copied into the uploads
    * directory, or CDN. E.g. returns "x/y/zwq...abc.jpg" where "xyzwq...abc" is the hash.
    * The reason for the slashes is that then all uploads won't end up in the same
    * directory, if stored on localhost (some file systems don't want 99999 files in a
    * single directory).
    */
  def addUploadedFile(uploadedFileName: String, tempFile: jio.File, uploadedById: UserId,
        browserIdData: BrowserIdData): UploadRef = {

    // Over quota?
    val siteStats = loadResourceUsage()
    siteStats.fileStorageLimitBytes foreach { maxBytes =>
      throwForbiddenIf(siteStats.fileStorageUsedBytes > maxBytes,
          "TyEUPLDQUOTA", o"""Over quota: Too much disk used by uploaded files.
              MBs used: ${siteStats.numUploadBytes / 1000 / 1000
              }, limit: ${maxBytes / 1000 / 1000}""")
    }

    def maxUploadSizeBytes = globals.maxUploadSizeBytes

    val publicUploadsDir = globals.anyPublicUploadsDir getOrElse throwForbidden(
      "DwE5KFY9", "File uploads disabled, config value missing: " +
        Globals.LocalhostUploadsDirConfValName)

    val uploadedDotSuffix = '.' + checkAndGetFileSuffix(uploadedFileName)

    // java.nio.file.Files.probeContentType doesn't work in Alpine Linux + JRE 8. Instead, use Tika.
    // (This detects mime type based on actual document content, not just the suffix.) dupl [7YKW23]
    val tika = new org.apache.tika.Tika()

    val origMimeType: String = tika.detect(tempFile.toPath.toAbsolutePath)
    val origSize = tempFile.length
    if (origSize >= maxUploadSizeBytes)
      throwForbidden("DwE5YFK2", s"File too large, more than $origSize bytes")


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
          case ex: jl.ArrayIndexOutOfBoundsException =>
            val message = ex.getMessage
            if (message == "4096") {
              // Bug in ImageIO, with stack trace: (happens for a few apparently a bit rare gifs)
              // java.lang.ArrayIndexOutOfBoundsException: 4096
              //   at com.sun.imageio.plugins.gif.GIFImageReader.read (GIFImageReader.java:984)
              //   at debiki.dao.UploadsDao.liftedTree1$1 (UploadsDao.scala:80)
              //   at debiki.dao.UploadsDao.addUploadedFile (UploadsDao.scala:80)
              // caused by this Java bug:
              //   https://bugs.openjdk.java.net/browse/JDK-7132728
              // there's a maybe-workaround, but doesn't seem to generate a BufferedImage:
              //   https://stackoverflow.com/a/23851091/694469 —>
              //   —> https://github.com/DhyanB/Open-Imaging
              logger.warn(o"""Java ArrayIndexOutOfBoundsException: '4096' bug when reading
                  uploaded image, site: $siteId, file name: $uploadedFileName, user: $uploadedById""")
              None
            }
            else throw ex
        }
      anyImage match {
        case None =>
          (tempFile, uploadedDotSuffix)
        case Some(image) =>
          dimensions = Some((image.getWidth, image.getHeight))
          if (origMimeType == ImageUtils.MimeTypeJpeg && origSize < MaxSkipImageCompressionBytes) {
            // Don't compress, so small already.
            (tempFile, ".jpg")
          }
          else {
            tempCompressedFile = Some(new jio.File(tempFile.toPath + ".compressed.jpg"))
            ImageUtils.convertToCompressedJpeg(image, origSize.toInt, tempCompressedFile.get)
            val compressedSize = tempCompressedFile.get.length
            val tempFileSize = tempFile.length
            if (compressedSize < tempFileSize) {
              (tempCompressedFile.get, ".jpg")
            }
            else {
              tempCompressedFile.get.delete()
              tempCompressedFile = None
              (tempFile, simplifySuffix(uploadedDotSuffix))
            }
          }
      }
    }

    val mimeType: String = tika.detect(optimizedFile)
    val sizeBytes = {
      val sizeAsLong = optimizedFile.length
      if (sizeAsLong >= maxUploadSizeBytes) {
        throwForbidden("DwE5YFK2", s"Optimized file too large, more than $maxUploadSizeBytes bytes")
      }
      sizeAsLong.toInt
    }

    throwIfUploadedTooMuchRecently(uploadedById, sizeBytes = sizeBytes)

    val hashPathSuffix = makeHashPath(optimizedFile, optimizedDotSuffix)
    val destinationFile = new java.io.File(s"$publicUploadsDir$hashPathSuffix")
    destinationFile.getParentFile.mkdirs()

    // Remember this new file and who uploaded it.
    // (Do this before moving the it into the uploads directory, in case the server
    // crashes. We don't want any files with missing metadata in the uploads directory
    // — but it's okay with metadata for which the actual files are missing: we can just
    // delete the metadata entries later. [9YMU2Y])
    readWriteTransaction { transaction =>
      // The file will be accessible on localhost, it hasn't yet been moved to e.g. any CDN.
      val uploadRef = UploadRef(UploadsUrlBasePath, hashPathSuffix)
      transaction.insertUploadedFileMeta(uploadRef, sizeBytes, mimeType, dimensions)
      insertAuditLogEntry(AuditLogEntry(
        siteId = siteId,
        id = AuditLogEntry.UnassignedId,
        didWhat = AuditLogEntryType.UploadFile,
        doerId = uploadedById,
        doneAt = transaction.now.toJavaDate,
        browserIdData = browserIdData,
        uploadHashPathSuffix = Some(hashPathSuffix),
        uploadFileName = Some(uploadedFileName),
        sizeBytes = Some(sizeBytes)), transaction)
    }

    // (Don't do this inside the transaction above, because then the file might be moved
    // in place, but the transaction might fail —> metadata never created.)
    try {
      // Let Nginx read this file so it can be served directly from the file system.
      val anyoneMayRead = new ju.HashSet[jfa.PosixFilePermission]()
      anyoneMayRead.add(jfa.PosixFilePermission.OWNER_READ)
      anyoneMayRead.add(jfa.PosixFilePermission.GROUP_READ)
      anyoneMayRead.add(jfa.PosixFilePermission.OTHERS_READ)
      java.nio.file.Files.setPosixFilePermissions(optimizedFile.toPath, anyoneMayRead)
      // Prevent people from accidentally modifying the file contents.
      optimizedFile.setReadOnly()
      // The last thing we do:
      jf.Files.move(optimizedFile.toPath, destinationFile.toPath)
    }
    catch {
      case _: jf.FileAlreadyExistsException =>
        // Fine. Same name -> same hash -> same content.
      case ex: Exception =>
        logger.error(o"""Error moving file into place, name: $uploadedFileName, file path:
          ${optimizedFile.getPath}, destination: ${destinationFile.getPath} [DwE8MF2]""", ex)
        throw ex
    }

    // COULD wrap in try...finally, so will be deleted for sure.
    tempCompressedFile.foreach(_.delete)

    UploadRef(UploadsUrlBasePath, hashPathSuffix)
  }


  def fileHasBeenUploaded(hashPath: String): Boolean = {
    readOnlyTransaction { tx =>
      tx.isSiteIdUsingUpload(siteId, UploadRef(UploadsUrlBasePath, hashPath))
    }
  }


  def simplifySuffix(dotSuffix: String): String = {
    dotSuffix match {
      case ".jpeg" => ".jpg"
      case _ => dotSuffix
    }
  }


  def findUploadRefsInPost(post: Post): Set[UploadRef] = {   // find mentions at the same time? [4WKAB02]
    val pubId = thePubSiteId()
    val approvedRefs = post.approvedHtmlSanitized.map(
      h => findUploadRefsInText(h, pubId)) getOrElse Set.empty
    val currentRefs =
      if (post.nr == PageParts.TitleNr) Nil
      else {
        val renderResult = context.nashorn.renderAndSanitizeCommonMark(
            post.currentSource, pubSiteId = pubId, embeddedOriginOrEmpty = "",
            allowClassIdDataAttrs = false, followLinks = false)
        findUploadRefsInText(renderResult.safeHtml, pubId)
      }
    approvedRefs ++ currentRefs
  }


  private def throwIfUploadedTooMuchRecently(uploaderId: UserId, sizeBytes: Int): Unit = {
    readOnlyTransaction { transaction =>
      val user = transaction.loadParticipant(uploaderId) getOrElse throwForbidden(
        "EsE7KMW2", "Strangely enough, your user account just disappeared")

      // God mode.
      if (user.isAdmin)
        return

      val nowMs = transaction.now.millis
      val entries = transaction.loadAuditLogEntriesRecentFirst(userId = uploaderId,
        tyype = Some(AuditLogEntryType.UploadFile), limit = MaxUploadsLastWeek, inclForgotten = true)

      // Check if the user has uploaded more than MaxUploadsLastWeek uploads the last 7 days
      // — that'd feel fishy.
      if (entries.length >= MaxUploadsLastWeek) {
        entries.lastOption foreach { oldest =>
          val timeAgoMs = nowMs - oldest.doneAt.getTime
          if (timeAgoMs < OneWeekInMillis)
            throwTooManyRequests(
              "Sorry but you've uploaded too many files the last 7 days [EsE5GM2]")
        }
      }

      var bytesUploadedLastWeek = sizeBytes
      var bytesUploadedLastDay = sizeBytes

      entries foreach { entry =>
        val doneAtMs = entry.doneAt.getTime
        if (nowMs - doneAtMs < OneDayInMillis) {
          bytesUploadedLastDay += entry.sizeBytes getOrElse 0
        }
        if (nowMs - doneAtMs < OneWeekInMillis) {
          bytesUploadedLastWeek += entry.sizeBytes getOrElse 0
        }
      }

      val uplConf = globals.config.uploads
      val maxBytesWeek = user.isStaff ? uplConf.maxBytesPerWeekStaff | uplConf.maxBytesPerWeekMember
      val maxBytesDay = user.isStaff ? uplConf.maxBytesPerDayStaff | uplConf.maxBytesPerDayMember

      def throwIfTooMuch(actual: Int, max: Int, lastWhat: String): Unit = {
        if (actual > max)
          throwEntityTooLarge("EsE4MPK02", o"""Sorry but you've uploaded too much stuff the
              last $lastWhat. You can upload at most ${(max - actual) / 1000} more kilobytes""")
      }
      throwIfTooMuch(bytesUploadedLastWeek, maxBytesWeek, "7 days")
      throwIfTooMuch(bytesUploadedLastDay, maxBytesDay, "24 hours")
    }
  }
}


object UploadsDao {

  val MaxSuffixLength = 12

  val base32lowercaseEncoder: BaseEncoding = guava.io.BaseEncoding.base32().lowerCase()

  /** We don't need all 51.2 base32 sha256 chars (51 results in rather long file names).
    * SHA-1 is 32 chars in base32 — let's keep 33 chars so people won't mistake this
    * for SHA-1.
    * Don't change this — that would invalidate all hashes in the database.
    */
  val HashLength = 33

  val MaxUploadsLastWeek = 700

  val MaxAvatarTinySizeBytes: Int = 2*1000
  val MaxAvatarSmallSizeBytes: Int = 5*1000
  val MaxAvatarMediumSizeBytes: Int = 100*1000

  val MaxSkipImageCompressionBytes: Int = 5 * 1000


  // Later: Delete this in July 2016? And:
  // - delete all old images that use this regex in the database
  //   (that's ok, not many people use this right now).
  // - remove this regex from the psql function `is_valid_hash_path(varchar)`
  // - optionally, recalculate disk quotas (since files deleted)
  val OldHashPathSuffixRegex: Regex = """^[a-z0-9]/[a-z0-9]/[a-z0-9]+\.[a-z0-9]+$""".r

  // CLEAN_UP remove video/ later, currently no longer added.
  val HashPathSuffixRegex: Regex =
    """^(video/)?[0-9][0-9]?/[a-z0-9]/[a-z0-9]{2}/[a-z0-9]+\.[a-z0-9]+$""".r

  val HlsVideoMediaSegmentsSuffix = ".m3u8"

  private val Log4 = math.log(4)


  def makeHashPath(file: jio.File, dotSuffix: String): String = {
    // (It's okay to truncate the hash, see e.g.:
    // http://crypto.stackexchange.com/questions/9435/is-truncating-a-sha512-hash-to-the-first-160-bits-as-secure-as-using-sha1 )
    val hashCode = guava.io.Files.hash(file, guava.hash.Hashing.sha256)
    val hashString = base32lowercaseEncoder.encode(hashCode.asBytes) take HashLength
    makeHashPath(file.length().toInt, hashString, dotSuffix)
  }


  /** The hash path starts with floor(log4(size-in-bytes / 1000)), i.e. 0 for < 4k files,
    * 1 for < 16k files, 2 for < 64k, 3 for < 256k, 4 for <= 1M, 5 < 4M, 6 < 16M, .. 9 <= 1G.
    * This lets us easily backup small files often, and large files infrequently. E.g.
    * backup directories with < 1M files hourly, but larger files only daily?
    * Or keep large files on other types of disks?
    *
    * For a while I prefixed video files with video/, to avoid regexes in Nginx because
    * handling videos differently (special Nginx video directives), but this didn't result in
    * any easily measurable performance improvements, so I removed it. Another reason
    * to place videos in videos/ is that then Google Cloud Engine's (GCE) load balancer can
    * do content based load balancing, in this case we could serve all video uploads from
    * a dedicated video server. But I think the size digit (floor-log-size) can be used for
    * this as well: just send all requests > X MB to a video streaming server,
    * because large files = videos, usually (and the video server will have to serve the
    * occasional large image, should be just fine). (GCE can cache stuff < 4MB in its CDN.)
    */
  def makeHashPath(sizeBytes: Int, hash: String, dotSuffix: String): String = {
    val sizeDigit = sizeKiloBase4(sizeBytes)
    val (hash0, hash1, hash2, theRest) = (hash.head, hash.charAt(1), hash.charAt(2), hash.drop(3))
    s"$sizeDigit/$hash0/$hash1$hash2/$theRest$dotSuffix"
  }


  /** Returns floor(log4(size-in-bytes / 1000)), and 0 if you give it 0.
    */
  def sizeKiloBase4(sizeBytes: Int): Int = {
    require(sizeBytes >= 0, "EsE7YUG2")
    if (sizeBytes < 4000) return 0
    val fourKiloBlocks = sizeBytes / 1000
    (math.log(fourKiloBlocks) / Log4).toInt
  }


  def findUploadRefsInText(html: String, pubSiteId: String): Set[UploadRef] = {
    // Tested here:  tests/app/debiki/dao/UploadsDaoSpec.scala

    val links: Seq[String] = TextAndHtmlMaker.findLinks(html)
    val references = ArrayBuffer[UploadRef]()

    links foreach addUrlIfReferencesUploadedFile

    def addUrlIfReferencesUploadedFile(urlString: String): Unit = {
      val urlPath =
        if (urlString startsWith "/") urlString
        else {
          try new java.net.URL(urlString).getPath
          catch {
            case _: java.net.MalformedURLException =>
              return
          }
        }

      // Don't care about the port and hostname. Instead, if the url *path* matches, then
      // consider any upload with the specified location as being referenced.
      // (Otherwise refs might be overlooked, if adding/removing a CDN origin,
      // or moving the server to a new address.)
      if (urlPath startsWith UploadsUrlBasePath) {
        val maybeSiteIdHashPathSuffix = urlPath drop UploadsUrlBasePath.length
        // The publ site id is only maybe included — require an exact match, so one site
        // cannot reference an upload at *another* site and prevent it from getting deleted.
        val oldMatch = OldHashPathSuffixRegex.matches(maybeSiteIdHashPathSuffix)
        val hashPathSuffix = maybeSiteIdHashPathSuffix.replaceAllLiterally(pubSiteId + '/', "")
        val newMatch = HashPathSuffixRegex.matches(hashPathSuffix)
        if (oldMatch || newMatch) {
          // Don't add any hostname, because files stored locally are accessible from any hostname
          // that maps to this server — only the file content hash matters.
          references.append(UploadRef(UploadsUrlBasePath, hashPathSuffix))
        }
      }
    }

    references.toSet
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

    // (Convert to lowercase, don't want e.g. both .JPG and .jpg.)
    val suffix = fileName.takeRightWhile(_ != '.').toLowerCase

    // Common image file formats:
    // (https://www.library.cornell.edu/preservation/tutorial/presentation/table7-1.html)
    if ("tif tiff gif jpeg jpg jif jfif jp2 jpx j2k j2c fpx pcd png pdf".contains(suffix))
      return suffix

    // Common movie file formats: (https://en.wikipedia.org/wiki/Video_file_format)
    if ("webm mkv ogv ogg gifv mp4 m4v".contains(suffix))
      return suffix

    if (!fileName.exists(_ == '.'))
      throwForbidden("DwE6UPM5", "The file has no suffix")

    if (suffix.length > MaxSuffixLength)
      throwBadRequest("DwE7F3P5", o"""File has too long suffix: '$fileName'
        (max $MaxSuffixLength chars)""")

    if (suffix.isEmpty)
      throwForbidden("DwE2WUMF", "Empty file suffix, nothing after the dot in the file name")

    suffix
  }

}

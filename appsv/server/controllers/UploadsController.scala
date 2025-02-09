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

package controllers

import scala.collection.Seq
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.EdHttp._
import debiki.dao.UploadsDao._
import talkyard.server.{TyContext, TyController}
import talkyard.server.http.ApiRequest
import java.{io => jio}
import javax.inject.Inject
import play.api._
import play.api.libs.Files
import play.api.libs.json.{JsString, JsValue, Json}
import play.api.mvc._
import play.api.mvc.MultipartFormData.FilePart

/** Uploads files and serves uploaded files.
  */
class UploadsController @Inject()(cc: ControllerComponents, edContext: TyContext)
  extends TyController(cc, edContext) {

  import context.safeActions.ExceptionAction
  import context.globals.config.uploads.maxBytesLargeFile
  //import context.globals.anyPublicUploadsDir
  //import Globals.LocalhostUploadsDirConfValName

  val MaxAvatarUploadSizeBytes: i32 =
    MaxAvatarTinySizeBytes + MaxAvatarSmallSizeBytes + MaxAvatarMediumSizeBytes



  def intReq_mayUploadFile(sizeBytes: i32): Action[U] = GetAction { request =>
    // Tests: upload-images-and-files.test.ts  TyT50E6KTDU7.TyTE2ESVUPLCK

    // We won't get to here at all, if the request body is larger than our
    // Ngnix conf val TY_NGX_LIMIT_REQ_BODY_SIZE(_UPLOADS),
    // see images/web/Dockerfile.

    // Add 1000 bytes, because the request body includes a multipart/form-data
    // boundary, can be around 300 bytes.
    COULD // check the file extension / mime type here — but then would need to
    // parse the form-data in Nginx + Lua?  [pre_chk_upl_ext]
    _throwForbiddenMaybe(anyFileName = None,
          sizeBytes = sizeBytes + 1000, request)
    Ok
  }



  private def _throwForbiddenMaybe(anyFileName: Opt[St], sizeBytes: i64,
          request: ApiRequest[_]): U = {
    import request.dao

    // COULD disable the file upload dialog for guests. And refuse to receive any data at
    // all (not create any temp file) if not authenticated.  [may_unau_upl]
    if (!request.theUser.isAuthenticated)
      throwForbidden("TyE0ANONUPL", o"""Please create an account — only authenticated
            users (but not guests) may upload files.""")

    val perms: EffPatPerms =
          dao.deriveEffPatPerms(request.authzContext.groupIdsEveryoneLast)

    // Check size.
    val maxUploadSizeBytes = perms.maxUploadSizeBytes
    throwForbiddenIf(sizeBytes > maxUploadSizeBytes,  // [upl_sz_ck]
          "TyESVUPLSZCK_", s"File too large: ${sizeBytes.toFloat / Mebibyte
              } MiB; max size is ${maxUploadSizeBytes.toFloat / Mebibyte} MiB")

    // Check file type.  [ck_upl_ftp]

    // For now, just look at the extension — maybe later look at mime type too.
    // Then need to make mime type configurable too.
    // '** matches alnum and punctuation.  "*" would match alnum only — that is,
    // '*' would allow files with no '.ext' dot-extension.  [tyglobs]

    if (perms.allowedUploadExtensions contains  "**")
      return

    val fileName = anyFileName getOrElse {
      return
    }
    // Check the last dot part, i.e. the real extension, against the
    // allowedUploadExtensions allowlist:
    SECURITY // Later: Check any other dot "." separated parts against a blocklist?
    val fileExt = fileName.takeRightWhile(_ != '.')
    val isOk = perms.allowedUploadExtensions contains fileExt.toLowerCase
    throwForbiddenIf(!isOk, "TyE503RMT2",
          s"Not an allowed file extension: '$fileExt' in file name: '$fileName'")
  }



  def uploadPublicFile: Action[Either[
            MaxSizeExceeded, MultipartFormData[Files.TemporaryFile]]] =
        PostFilesAction(RateLimits.UploadFile, maxBytes = maxBytesLargeFile) { request =>
    import request.dao

    // This handles many uploaded files.
    // (For uploading just one file, see: [5039RKJW45])

    // COULD try to detect if the client cancelled the upload. Currently, if the browser
    // called xhr.abort(), we'll still get to here, and `data` below will be the data
    // uploaded thus far, i.e. not the whole file. Fortunately, it'll never get used
    // because the request has been aborted, so the client won't receive the content hash
    // that we send back. And, since unused, eventually the uploaded file will be deleted.
    val multipartFormData = request.body match {
      case Left(maxExceeded: mvc.MaxSizeExceeded) =>
        throwForbidden("DwE403FTL0", o"""File too large: I got ${maxExceeded.length} bytes,
            but size limit is $maxBytesLargeFile bytes""")
      case Right(data) =>
        data
    }

    val numFilesUploaded = multipartFormData.files.length
    if (numFilesUploaded != 1)
      throwBadRequest("EdE6KPW2", s"Upload exactly one file please — I got $numFilesUploaded files")

    val files = multipartFormData.files.filter(_.key == "file")
    if (files.length != 1)
      throwBadRequest("EdE7UYMF3", s"Use the multipart form data key name 'file' please")

    val filePart: FilePart[Files.TemporaryFile] = files.head

    // This far, in this endpoint, we've verified only that size <= maxBytesLargeFile.
    // However, the upload limit might be lower, for this user or this site.
    // We've checked this already [upl_sz_ck] — let's double check, and this
    // time, there're no form-data boundaries.

    _throwForbiddenMaybe(Some(filePart.filename), sizeBytes = filePart.fileSize, request)

    val file: jio.File = filePart.ref.path.toFile

    val uploadRef = dao.addUploadedFile(
          filePart.filename, file, request.theReqerTrueId, request.theBrowserIdData)

    // Delete the temporary file. (It will be gone already, if we couldn't optimize it,
    // i.e. make it smaller, because then we've moved it to the uploads dir (rather than
    // a smaller compressed copy). Deleting file ref although gone already, doesn't do anything.)
    filePart.ref.delete()

    // Don't use OkSafeJson here because Dropzone doesn't understand the safe-JSON prefix.
    Ok(JsString(uploadRef.url)) as JSON
  }


  def removeAvatar: Action[JsValue] = PostJsonAction(RateLimits.UploadFile, maxBytes = 200) { request =>
    request.dao.setUserAvatar(request.theReqerId, tinyAvatar = None, smallAvatar = None,
      mediumAvatar = None, request.theBrowserIdData)
    Ok
  }


  /** (Theoretically it's possible that the user uploads 3 completely different images,
    * for the tiny, small and medium avatars. Oh well.)
    */
  def uploadAvatar(userId: UserId)
        : Action[Either[MaxSizeExceeded, MultipartFormData[Files.TemporaryFile]]] =
        PostFilesAction(RateLimits.UploadFile, maxBytes = MaxAvatarUploadSizeBytes) { request =>

    if (!request.theUser.isAuthenticated)
      throwForbidden("EdE8YWM2", o"""Only authenticated users (but not guests) may upload avatars.
        Please login via for example Google or Facebook, or create a password account""")

    if (request.theUserId != userId && !request.theUser.isStaff)
      throwForbidden("EdE7KF20F", o"""Only staff may change other users' avatars""")

    val multipartFormData = request.body match {
      case Left(maxExceeded: mvc.MaxSizeExceeded) =>
        throwForbidden("EdE0FY24", o"""Avatar image request too large: I got ${maxExceeded.length}
          bytes, but you may send at most $MaxAvatarUploadSizeBytes bytes""")
      case Right(data) =>
        data
    }

    val numFilesUploaded = multipartFormData.files.length
    if (numFilesUploaded != 3)
      throwBadRequest("EdE35UY0", o"""Upload three images please: a tiny, a small and a medium
        sized avatar image — instead I got $numFilesUploaded files""")

    val fileParts: Seq[FilePart[Files.TemporaryFile]] =
          multipartFormData.files

    val tinyFilePart = fileParts.find(_.key == "images[tiny]") getOrElse {
      throwBadRequest("EdE8GYF2", o"""Upload a tiny size avatar image please""")
    }

    val smallFilePart = fileParts.find(_.key == "images[small]") getOrElse {
      throwBadRequest("EdE4YF21", o"""Upload a small size avatar image please""")
    }

    val mediumFilePart = fileParts.find(_.key == "images[medium]") getOrElse {
      throwBadRequest("EdE8YUF2", o"""Upload a medium size avatar image please""")
    }

    val tinyFile = tinyFilePart.ref.path.toFile
    val smallFile = smallFilePart.ref.path.toFile
    val mediumFile = mediumFilePart.ref.path.toFile

    def throwIfTooLarge(whichFile: String, file: jio.File, maxBytes: Int): Unit = {
      val length = file.length
      if (length > maxBytes)
        throwForbidden("DwE7YMF2", s"The $whichFile is too large: $length bytes, max is: $maxBytes")
    }

    throwIfTooLarge("tiny avatar image", tinyFile, MaxAvatarTinySizeBytes)
    throwIfTooLarge("small avatar image", smallFile, MaxAvatarSmallSizeBytes)
    throwIfTooLarge("medium avatar image", mediumFile, MaxAvatarMediumSizeBytes)

    ImageUtils.throwUnlessJpegWithSideBetween(tinyFile, "Tiny", 20, 35)
    ImageUtils.throwUnlessJpegWithSideBetween(smallFile, "Small", 40, 60)
    ImageUtils.throwUnlessJpegWithSideBetween(mediumFile, "Medium", 150, 800)

    // First add metadata entries for the files and move them in place.
    // Then, if there were no errors, update the user so that it starts using the new
    // images. — If the server dies, we'll save image file metadata and the files,
    // but they won't be used. Then, after a while, some background thread deletes them
    // (since they're unused) — deleting them is not yet implemented though [9YMU2Y].

    val tinyAvatarRef = request.dao.addUploadedFile(
      tinyFilePart.filename, tinyFile, request.theReqerTrueId, request.theBrowserIdData)

    val smallAvatarRef = request.dao.addUploadedFile(
      smallFilePart.filename, smallFile, request.theReqerTrueId, request.theBrowserIdData)

    val mediumAvatarRef = request.dao.addUploadedFile(
      mediumFilePart.filename, mediumFile, request.theReqerTrueId, request.theBrowserIdData)

    // Delete the temporary files.
    tinyFilePart.ref.delete()
    smallFilePart.ref.delete()
    mediumFilePart.ref.delete()

    // Now the images are in place in the uploads dir, and we've created metadata entries.
    // We just need to link the user to the images:
    request.dao.setUserAvatar(userId, tinyAvatar = Some(tinyAvatarRef),
      smallAvatar = Some(smallAvatarRef), mediumAvatar = Some(mediumAvatarRef),
      request.theBrowserIdData)

    // Use OkSafeJson?
    Ok(Json.obj(
      "avatarSmallHashPath" -> JsString(smallAvatarRef.hashPath),
      "avatarMediumHashPath" -> JsString(mediumAvatarRef.hashPath))) as JSON
  }


  def authUpload(publSiteId: String, hashPath: String) = ExceptionAction { request: mvc.Request[_] =>
    // (Original request available in:  request.headers.get("X-Original-URI") )
    val siteId = context.globals.systemDao.getSiteIdByPubId(publSiteId) getOrElse {
      throwForbidden("TyESITEPUBID", s"No site with publ id '$publSiteId'")
    }
    val siteDao: debiki.dao.SiteDao = context.globals.siteDao(siteId)
    val hashPathNoSlash = hashPath drop 1 // otherwise starts with slash
    BUG; PRIVACY // for site owners. Won't find files until a post linking to them has been *saved*
    // — but whilst composing the post, the file will be 404 Not Found, so preview = broken.
    // The fix: Remember per site which files have been uploaded? (Not just *referenced*.)
    // And if some staff member deleted it.
    // For now, just comment this out (accessible via /-/u/hash-path anyway).
    // When fixing this, also fix [5UKFBQW2]?
    /*
    val hasBeenUplToSite = siteDao.fileHasBeenUploaded(hashPathNoSlash)
    if (!hasBeenUplToSite)
      throwNotFound("TyE404NUPL", "File not found")
      */

    Ok
  }


  /** These files are to be cached by a CDN, or nginx could be configured to serve them
    * directly from the file system (bypassing Play), so don't bother about trying
    * to optimize this.
    */
  def servePublicFile(relativePath: String) = ExceptionAction { (request: mvc.Request[_]) =>
    die("TyE4GKQR20", "Talk with Nginx instead")
    // previously: servePublicFileImpl(relativePath, request)
  }

  /* Right now uploads are served directly by Nginx.
     But keep the handlers below, for now — maybe want Play ot serve files again, in the future?

  def servePublicFileLong(relativePath: String) = ExceptionAction { (request: mvc.Request[_]) =>
    servePublicFileImpl(relativePath, request)
  }

  def servePublicFileImpl(relativePath: String, request: mvc.Request[_]) = {
    val publicUploadsDir = anyPublicUploadsDir getOrElse throwNotFound(
      "DwE8MEF2", o"""File not found because config value $LocalhostUploadsDirConfValName
        missing""")

    val p = relativePath
    if (p.contains("..") || p.startsWith("/") || p.startsWith(".") ||
        p.contains("//") || p.contains("/."))
      throwBadRequest("DwE6YMF2", "Bad file path: " + relativePath)

    try {
      Ok.sendFile(
        content = new jio.File(s"$publicUploadsDir$relativePath"),
        inline = true)(context.executionContext, context.mimeTypes)
    }
    catch {
      case _: jio.FileNotFoundException =>
        NotFoundResult("DwE404FNF0", "File not found")
    }
  } */

}


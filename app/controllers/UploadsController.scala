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

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.EdHttp._
import debiki.dao.UploadsDao._
import ed.server.{EdContext, EdController}
import java.{io => jio}
import javax.inject.Inject
import play.api._
import play.api.libs.Files
import play.api.libs.json.{JsString, JsValue, Json}
import play.api.mvc._


/** Uploads files and serves uploaded files.
  */
class UploadsController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) {

  import context.safeActions.ExceptionAction
  import context.globals.{maxUploadSizeBytes, anyPublicUploadsDir}
  import Globals.LocalhostUploadsDirConfValName

  val MaxAvatarUploadSizeBytes: UnixDays =
    MaxAvatarTinySizeBytes + MaxAvatarSmallSizeBytes + MaxAvatarMediumSizeBytes


  def uploadPublicFile: Action[Either[MaxSizeExceeded, MultipartFormData[Files.TemporaryFile]]] =
        PostFilesAction(RateLimits.UploadFile, maxBytes = maxUploadSizeBytes) { request =>

    // COULD disable the file upload dialog for guests. And refuse to receive any data at
    // all (not create any temp file) if not authenticated.
    if (!request.theUser.isAuthenticated)
      throwForbidden("DwE7UMF2", o"""Only authenticated users (but not guests) may upload files.
          Please login via for example Google or Facebook, or create a password account""")

    // [5039RKJW45]

    // COULD try to detect if the client cancelled the upload. Currently, if the browser
    // called xhr.abort(), we'll still get to here, and `data` below will be the data
    // uploaded thus far, i.e. not the whole file. Fortunately, it'll never get used
    // because the request has been aborted, so the client won't receive the content hash
    // that we send back. And, since unused, eventually the uploaded file will be deleted.
    val multipartFormData = request.body match {
      case Left(maxExceeded: mvc.MaxSizeExceeded) =>
        throwForbidden("DwE403FTL0", o"""File too large: I got ${maxExceeded.length} bytes,
            but size limit is $maxUploadSizeBytes bytes""")
      case Right(data) =>
        data
    }

    val numFilesUploaded = multipartFormData.files.length
    if (numFilesUploaded != 1)
      throwBadRequest("EdE6KPW2", s"Upload exactly one file please — I got $numFilesUploaded files")

    val files = multipartFormData.files.filter(_.key == "file")
    if (files.length != 1)
      throwBadRequest("EdE7UYMF3", s"Use the multipart form data key name 'file' please")

    val file = files.head

    val uploadRef = request.dao.addUploadedFile(
      file.filename, file.ref.file, request.theUserId, request.theBrowserIdData)

    // Delete the temporary file. (It will be gone already, if we couldn't optimize it,
    // i.e. make it smaller, because then we've moved it to the uploads dir (rather than
    // a smaller compressed copy). Deleting file ref although gone already, doesn't do anything.)
    file.ref.delete()

    // Don't use OkSafeJson here because Dropzone doesn't understand the safe-JSON prefix.
    Ok(JsString(uploadRef.url)) as JSON
  }


  def removeAvatar: Action[JsValue] = PostJsonAction(RateLimits.UploadFile, maxBytes = 200) { request =>
    request.dao.setUserAvatar(request.theUserId, tinyAvatar = None, smallAvatar = None,
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

    val tinyFile = multipartFormData.files.find(_.key == "images[tiny]") getOrElse {
      throwBadRequest("EdE8GYF2", o"""Upload a tiny size avatar image please""")
    }

    val smallFile = multipartFormData.files.find(_.key == "images[small]") getOrElse {
      throwBadRequest("EdE4YF21", o"""Upload a small size avatar image please""")
    }

    val mediumFile = multipartFormData.files.find(_.key == "images[medium]") getOrElse {
      throwBadRequest("EdE8YUF2", o"""Upload a medium size avatar image please""")
    }

    def throwIfTooLarge(whichFile: String, file: jio.File, maxBytes: Int): Unit = {
      val length = file.length
      if (length > maxBytes)
        throwForbidden("DwE7YMF2", s"The $whichFile is too large: $length bytes, max is: $maxBytes")
    }

    throwIfTooLarge("tiny avatar image", tinyFile.ref.file, MaxAvatarTinySizeBytes)
    throwIfTooLarge("small avatar image", smallFile.ref.file, MaxAvatarSmallSizeBytes)
    throwIfTooLarge("medium avatar image", mediumFile.ref.file, MaxAvatarMediumSizeBytes)

    ImageUtils.throwUnlessJpegWithSideBetween(tinyFile.ref.file, "Tiny", 20, 35)
    ImageUtils.throwUnlessJpegWithSideBetween(smallFile.ref.file, "Small", 40, 60)
    ImageUtils.throwUnlessJpegWithSideBetween(mediumFile.ref.file, "Medium", 150, 800)

    // First add metadata entries for the files and move them in place.
    // Then, if there were no errors, update the user so that it starts using the new
    // images. — If the server dies, we'll save image file metadata and the files,
    // but they won't be used. Then, after a while, some background thread deletes them
    // (since they're unused) — deleting them is not yet implemented though [9YMU2Y].

    val tinyAvatarRef = request.dao.addUploadedFile(
      tinyFile.filename, tinyFile.ref.file, request.theUserId, request.theBrowserIdData)

    val smallAvatarRef = request.dao.addUploadedFile(
      smallFile.filename, smallFile.ref.file, request.theUserId, request.theBrowserIdData)

    val mediumAvatarRef = request.dao.addUploadedFile(
      mediumFile.filename, mediumFile.ref.file, request.theUserId, request.theBrowserIdData)

    // Delete the temporary files.
    tinyFile.ref.delete()
    smallFile.ref.delete()
    mediumFile.ref.delete()

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
    val siteId = context.globals.systemDao.getSiteIdByPublId(publSiteId) getOrElse {
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


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

import actions.ApiActions._
import actions.SafeActions.ExceptionAction
import com.debiki.core._
import com.debiki.core.Prelude._
import com.google.{common => guava}
import debiki._
import debiki.DebikiHttp._
import java.{io => jio}
import play.api._
import play.api.libs.json.JsString
import debiki.dao.UploadsDao._


/** Uploads files and serves uploaded files.
  */
object UploadsController extends mvc.Controller {


  def uploadPublicFile = PostFilesAction(RateLimits.UploadFile, maxLength = maxUploadSizeBytes) {
        request =>

    // COULD disable the file upload dialog for guests. And refuse to receive any data at
    // all (not create any temp file) if not authenticated.
    if (!request.theUser.isAuthenticated)
      throwForbidden("DwE7UMF2", o"""Only authenticated users (but not guests) may upload files.
          Please login via for example Google or Facebook, or create a password account""")

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

    val files = multipartFormData.files.filter(_.key == "file")
    if (files.length != 1)
      throwBadRequest("DwE6KPW2", s"Upload exactly one file please — I got ${files.length} files")

    val file = files.head

    val relativePath = request.dao.addUploadedFile(
      file.filename, file.ref.file, request.theUserId, request.theBrowserIdData)

    // Delete the temporary file.
    file.ref.clean()

    // Don't use OkSafeJson here because Dropzone doesn't understand the safe-JSON prefix.
    Ok(JsString(relativePath)) as JSON
  }


  /** These files are to be cached by a CDN, or nginx could be configured to serve them
    * directly from the file system (bypassing Play), so don't bother about trying
    * to optimize this.
    */
  def servePublicFile(relativePath: String) = ExceptionAction { request =>
    val publicUploadsDir = anyPublicUploadsDir getOrElse throwNotFound(
      "DwE8MEF2", o"""File not found because config value $LocalhostUploadsDirConfigValueName
        missing""")

    val p = relativePath
    if (p.contains("..") || p.startsWith("/") || p.startsWith(".") ||
        p.contains("//") || p.contains("/."))
      throwBadRequest("DwE6YMF2", "Bad file path: " + relativePath)

    try {
      Ok.sendFile(
        content = new jio.File(s"$publicUploadsDir$relativePath"),
        inline = true)
    }
    catch {
      case _: jio.FileNotFoundException =>
        NotFoundResult("DwE404FNF0", "File not found")
    }
  }

}


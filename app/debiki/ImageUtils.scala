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

package debiki

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.DebikiHttp._
import java.awt.image.BufferedImage
import java.{io => jio}
import javax.imageio.{IIOImage, ImageWriteParam, ImageWriter, ImageIO}
import javax.imageio.stream.FileImageOutputStream
import play.{api => p}


object ImageUtils {

  /** 1.0 is max. */
  val JpgCompressionQuality = 0.75f

  // For now only!
  private val Mutex = new Object


  def isProcessableImageSuffix(suffix: String): Boolean = {
    // Skip SVG, cannot do anything with svg server side anyway?
    // Skip tif & tiff, ImageIO.read() returns null.
    val s = suffix.dropWhile(_ == '.')
    s == "jpg" || s == "png" || s == "gif" || s == "bmp" || s == "mpo"
  }


  def canCompress(suffix: String): Boolean = {
    // Which formats?
    // .gif might be animated, would be destroyed if converted?
    // .mpo is a 3d image, would be destroyed too I suppose.
    val s = suffix.dropWhile(_ == '.')
    s == "png" || s == "bmp"
  }


  /** Makes images smaller so they won't waste disk space.
    * Based on: http://stackoverflow.com/a/26319958/694469
    *
    * Might not work with transparent images? See:
    * http://stackoverflow.com/a/1545417/694469
    * fix like so: (sets background to white)
    * bufferedImage.createGraphics().drawImage(image, 0, 0, width, height, Color.WHITE, null);
    */
  def convertToCompressedJpeg(image: BufferedImage, destination: jio.File) {
    var writer: ImageWriter = null
    if (destination.exists)
      die("DwE6MPF2", "Destination image file already exists: " + destination.toPath.toString)

    // Apparently (see http://info.michael-simons.eu/2012/01/25/the-dangers-of-javas-imageio/ )
    // the image classes open temporary files which they might not close fast enough,
    // so might run out of file handles. So dispose() directly when done.

    // For now: Syncronize this, in case the image classes aren't thread safe.
    // COULD find out if they're thread safe, and remove the mutex, or
    // create an async actor (?) that does image stuff, perhaps many images at once.
    Mutex.synchronized {
      try {
        writer = ImageIO.getImageWritersByFormatName("jpg").next()
        val params: ImageWriteParam = writer.getDefaultWriteParam

        // I think that without explicit mode, the compression quality will be ignored.
        params.setCompressionMode(ImageWriteParam.MODE_EXPLICIT)
        params.setCompressionQuality(JpgCompressionQuality)

        val outputStream = new FileImageOutputStream(destination)
        writer.setOutput(outputStream)
        val ioImage = new IIOImage(image, null, null)
        writer.write(null, ioImage, params)
      }
      catch {
        case ex: jio.IOException =>
          if (writer ne null) {
            writer.abort()
          }
          throw ex
      }
      finally {
        if (writer ne null) {
          writer.dispose()
        }
      }
    }
  }


  val MimeTypeJpeg = "image/jpeg"

  def throwUnlessJpegWithSideBetween(file: jio.File, minSide: Int, maxSide: Int) {
    val mimeType = java.nio.file.Files.probeContentType(file.toPath.toAbsolutePath)
    if (mimeType != MimeTypeJpeg)
      throwForbidden("DwE2YUF0", s"Not a jpeg image")

    val image: BufferedImage = javax.imageio.ImageIO.read(file)
    val (width, height) = (image.getWidth, image.getHeight)

    if (width < minSide)
      throwForbidden("DwE8FMEF2", s"Image too small: width is $width, min is: $minSide")

    if (height < minSide)
      throwForbidden("DwE8FMEF2", s"Image too small: height is $height, min is: $minSide")

    if (width > maxSide)
      throwForbidden("DwE8FMEF2", s"Image too wide: width is $width, max is: $maxSide")

    if (height > maxSide)
      throwForbidden("DwE8FMEF2", s"Image too tall: height is $height, max is: $maxSide")
  }
}

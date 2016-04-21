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


/** COULD instead compress client side. And only verify server side that compression level > X
  * has been used? Hmm, I think, compress first client side, so can upload small file.
  * Then compress server side too, just in case hasn't already been done client side.
  * Read:
  *
  * resize img, make loook good:
  * http://stackoverflow.com/questions/2303690/resizing-an-image-in-an-html5-canvas
  * http://stackoverflow.com/questions/18922880/html5-canvas-resize-downscale-image-high-quality?rq=1
  *
  * check compression level: (just compare width*height*pixels with actual size)
  * http://stackoverflow.com/questions/14757270/java-reading-compression-ratio-of-an-jpeg-gif
  *
  * resize:
  * http://stackoverflow.com/questions/15558202/how-to-resize-image-in-java
  * http://stackoverflow.com/questions/3967731/how-to-improve-the-performance-of-g-drawimage-method-for-resizing-images
  * https://today.java.net/pub/a/today/2007/04/03/perils-of-image-getscaledinstance.html
  *
  * http://odyniec.net/projects/imgareaselect/
  * http://rubaxa.github.io/jquery.fileapi/
  * https://github.com/mailru/FileAPI/network
  * http://stackoverflow.com/questions/4998908/convert-data-uri-to-file-then-append-to-formdata
  * https://scotch.io/tutorials/use-the-html5-file-api-to-work-with-files-locally-in-the-browser
  */
object ImageUtils {

  // For now only!
  private val Mutex = new Object


  /** Estimates the image size. Assumes 65k colors, seems to work okay when combined
    * with jpgCompressionQualityForSizeBytes(the-size) just below.
    */
  def imageSizeBytes(image: BufferedImage) =
    image.getWidth * image.getHeight * 2 // * 2 means 2 bytes per pixel = 65536 = 65k colors


  /** Compresses large files more.
    */
  def jpgCompressionQualityForSizeBytes(sizeBytes: Int): Float = {
    // Don't know how much sense these numbers make.
    val Kilobytes = 1000
    if (sizeBytes > 7000 * Kilobytes) 0.30f
    else if (sizeBytes > 5000 * Kilobytes) 0.35f
    else if (sizeBytes > 4000 * Kilobytes) 0.40f
    else if (sizeBytes > 3000 * Kilobytes) 0.50f
    else if (sizeBytes > 2100 * Kilobytes) 0.60f
    else if (sizeBytes > 1500 * Kilobytes) 0.70f
    else if (sizeBytes > 1000 * Kilobytes) 0.75f
    else if (sizeBytes > 600 * Kilobytes) 0.80f
    else if (sizeBytes > 400 * Kilobytes) 0.85f
    else if (sizeBytes > 40 * Kilobytes) 0.90f
    else 0.95f
  }


  /** Makes images smaller so they won't waste disk space.
    * Based on: http://stackoverflow.com/a/26319958/694469
    */
  def convertToCompressedJpeg(imagePerhapsAlpha: BufferedImage, destination: jio.File) {
    var writer: ImageWriter = null
    if (destination.exists)
      die("DwE6MPF2", "Destination image file already exists: " + destination.toPath.toString)

    // Remove alpha channel, because jpg doesn't support transparency, but png images might include
    // transparency. Then when encoding to jpg, the alpha channel gets used instead of the blue
    // channel, so all blue disappears, which gives the impression that the image turned red.
    // See: http://stackoverflow.com/questions/17755036/imgscalr-with-background-red
    // and: http://stackoverflow.com/a/1545417/694469
    val imageRgb = new BufferedImage(imagePerhapsAlpha.getWidth, imagePerhapsAlpha.getHeight,
      BufferedImage.TYPE_INT_RGB)
    val done = imageRgb.getGraphics.drawImage(imagePerhapsAlpha, 0, 0, null)
    if (!done) play.api.Logger.warn(o"""Not done removing alpha, will the image be broken?
      Destination: ${destination.toPath.toString}""")

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
        val approxSizeBytes = imageSizeBytes(imageRgb)
        params.setCompressionQuality(jpgCompressionQualityForSizeBytes(approxSizeBytes))

        val outputStream = new FileImageOutputStream(destination)
        writer.setOutput(outputStream)
        val ioImage = new IIOImage(imageRgb, null, null)
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

  def throwUnlessJpegWithSideBetween(file: jio.File, which: String, minSide: Int, maxSide: Int) {
    val mimeType = java.nio.file.Files.probeContentType(file.toPath.toAbsolutePath)
    if (mimeType != MimeTypeJpeg)
      throwBadRequest("DwE2YUF0", s"Not a jpeg image")

    val image: BufferedImage = javax.imageio.ImageIO.read(file)
    val (width, height) = (image.getWidth, image.getHeight)

    if (width < minSide)
      throwBadRequest("DwE8FMEF1", s"$which image too small: width is $width, min is: $minSide")

    if (height < minSide)
      throwBadRequest("DwE8FMEF2", s"$which image too small: height is $height, min is: $minSide")

    if (width > maxSide)
      throwBadRequest("DwE8FMEF3", s"$which image too wide: width is $width, max is: $maxSide")

    if (height > maxSide)
      throwBadRequest("DwE8FMEF4", s"$which image too tall: height is $height, max is: $maxSide")
  }
}

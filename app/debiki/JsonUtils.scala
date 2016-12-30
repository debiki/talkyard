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

import com.debiki.core.Prelude._
import java.{util => ju}
import play.api.libs.json._


/** Parses JSON. Throws human friendly IllegalArgumentException:s. Is,a bit more concise
  * than Play's built in stuff.
  */
object JsonUtils {

  class BadJsonException(message: String) extends IllegalArgumentException(message)


  // This is year 5138 in Unix time in seconds, but year 1973 in milliseconds.
  // If we see any unix time greater than this, we'll assume it's in millis, otherwise, seconds.
  private val UnixMillisSomeDayIn1973 = 100000000000L


  def readJsObject(json: JsValue, fieldName: String): JsObject =
    (json \ fieldName).toOption.getOrElse(throwMissing("EsE1FY90", fieldName)) match {
      case o: JsObject => o
      case bad =>
        throwBadJson(
          "EsE2YMP7", s"'$fieldName' is not a JsObject, but a ${classNameOf(bad)}")
    }


  def readJsArray(json: JsValue, fieldName: String): JsArray =
    (json \ fieldName).toOption.getOrElse(throwMissing("EsE5GUMK", fieldName)) match {
      case o: JsArray => o
      case bad =>
        throwBadJson(
          "EsE4GLK3", s"'$fieldName' is not a JsArray, but a ${classNameOf(bad)}")
    }


  def readString(json: JsValue, fieldName: String): String =
    readOptString(json, fieldName) getOrElse throwMissing("EsE7JTB3", fieldName)


  def readOptString(json: JsValue, fieldName: String): Option[String] =
    (json \ fieldName).validateOpt[String] match {
      case JsSuccess(value, _) => value.map(_.trim)
      case JsError(errors) =>
        // Will this be readable? Perhaps use json.value[fieldName] match ... instead, above.
        throwBadJson("EsE5GUMK", s"'$fieldName' is not a string: " + errors.toString())
    }


  def readOptByte(json: JsValue, fieldName: String): Option[Byte] = {
    readOptLong(json, fieldName) map { valueAsLong =>
      if (valueAsLong > Byte.MaxValue)
        throwBadJson("EsE4GK2W0", s"$fieldName is too large for a Byte: $valueAsLong")
      if (valueAsLong < Byte.MinValue)
        throwBadJson("EsE4GKUP02", s"$fieldName is too small for a Byte: $valueAsLong")
      valueAsLong.toByte
    }
  }


  def readInt(json: JsValue, fieldName: String): Int =
    readOptInt(json, fieldName) getOrElse throwMissing("EsE5KPU3", fieldName)


  def readOptInt(json: JsValue, fieldName: String): Option[Int] = {
    readOptLong(json, fieldName) map { valueAsLong =>
      if (valueAsLong > Int.MaxValue)
        throwBadJson("EsE5YKP02", s"$fieldName is too large for an Int: $valueAsLong")
      if (valueAsLong < Int.MinValue)
        throwBadJson("EsE2PK6S3", s"$fieldName is too small for an Int: $valueAsLong")
      valueAsLong.toInt
    }
  }


  def readLong(json: JsValue, fieldName: String): Long =
    readOptLong(json, fieldName) getOrElse throwMissing("EsE6Y8FW2", fieldName)


  def readOptLong(json: JsValue, fieldName: String): Option[Long] =
    (json \ fieldName).validateOpt[Long] match {
      case JsSuccess(value, _) => value
      case JsError(errors) =>
        // Will this be readable? Perhaps use json.value[fieldName] match ... instead, above.
        throwBadJson("EsE3GUK7", s"'$fieldName' is not an integer: " + errors.toString())
    }


  def readBoolean(json: JsValue, fieldName: String): Boolean =
    readOptBool(json, fieldName) getOrElse throwMissing("EsE4GUY8", fieldName)


  def readOptBool(json: JsValue, fieldName: String): Option[Boolean] =
    (json \ fieldName).validateOpt[Boolean] match {
      case JsSuccess(value, _) => value
      case JsError(errors) =>
        // Will this be readable? Perhaps use json.value[fieldName] match ... instead, above.
        throwBadJson("EsE2GKU8", s"'$fieldName' is not a boolean: " + errors.toString())
    }


  def readDateMs(json: JsValue, fieldName: String): ju.Date =
    readOptDateMs(json, fieldName) getOrElse throwMissing("EsE2PKU0", fieldName)


  def readOptDateMs(json: JsValue, fieldName: String): Option[ju.Date] =
    (json \ fieldName).validateOpt[Long] match {
      case JsSuccess(value, _) =>
        val dateMs = value getOrElse {
          return None
        }
        if (dateMs < UnixMillisSomeDayIn1973) {
          throwBadJson("EsE7UMKW2", o"""'$fieldName' looks like a unix time in seconds,
              should be milliseconds""")
        }
        Some(new ju.Date(dateMs))
      case JsError(errors) =>
        // Will this be readable? Perhaps use json.value[fieldName] match ... instead, above.
        throwBadJson("EsE5YYW2", s"'$fieldName' is not a number: " + errors.toString())
    }


  private def throwBadJson(errorCode: String, message: String) =
    throw new BadJsonException(s"$message [$errorCode]")


  private def throwMissing(errorCode: String, fieldName: String) =
    throwBadJson(errorCode, s"'$fieldName' field missing")

}

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
import com.debiki.core.{Bo, ErrMsg, Opt, ParsedRef, St, i32, i64, When, WhenDay}
import java.{util => ju}
import org.scalactic.{Bad, Or}
import play.api.libs.json._


/** Parses JSON. Throws human friendly IllegalArgumentException:s. Is,a bit more concise
  * than Play's built in stuff.
  */
object JsonUtils {

  class BadJsonException(message: String) extends IllegalArgumentException(message)


  // This is year 5138 in Unix time in seconds, but year 1973 in milliseconds.
  // If we see any unix time greater than this, we'll assume it's in millis, otherwise, seconds.
  private val UnixMillisSomeDayIn1973 = 100000000000L  // [MINMILLIS]

  def tryParseGoodBad[R](block: => R Or ErrMsg): R Or ErrMsg = {
    try block
    catch {
      case ex: BadJsonException =>
        Bad(ex.getMessage)
    }
  }

  def asJsObject(json: JsValue, what: St): JsObject =
    json match {
      case o: JsObject => o
      case _ => throwBadJson("TyE0JSOBJ", s"$what is not a JsObject")
    }

  def readJsObject(json: JsValue, fieldName: String): JsObject =
    readOptJsObject(json, fieldName).getOrElse(throwMissing("EsE1FY90", fieldName))

  def parseOptJsObject(json: JsValue, fieldName: St): Opt[JsObject] =
    readOptJsObject(json, fieldName)

  def readOptJsObject(json: JsValue, fieldName: String): Option[JsObject] =
    (json \ fieldName).toOption map {
      case o: JsObject => o
      case bad =>
        throwBadJson(
          "EsE2YMP7", s"'$fieldName' is not a JsObject, but a ${classNameOf(bad)}")
    }

  // Add a 2nd fn, or a param: all elems be of the same type? See below: [PARSEJSARR]
  def readJsArray(json: JsValue, fieldName: String, optional: Boolean = false): JsArray = {
    val array = (json \ fieldName).toOption getOrElse {
      if (optional) return JsArray()
      throwMissing("TyE0JSFIELD", fieldName)
    }
    array match {
      case o: JsArray => o
      case bad =>
        throwBadJson(
          "EsE4GLK3", s"'$fieldName' is not a JsArray, but a ${classNameOf(bad)}")
    }
  }

  /*
  // No way to shorten this?  [PARSEJSARR]
  (jsObj \ "newTopicTypes").asOpt[Seq[JsValue]] match {
    case Some(list) if list.isInstanceOf[JsArray] =>
      // Should be only one topic type. [5YKW294]
      list.asInstanceOf[JsArray].value.headOption match {
        case Some(jsValue) =>
          jsValue match {
            case JsNumber(number) => PageType.fromInt(number.toInt).toVector
            case _ => Nil
          }
        case _ => Nil
      }
    case _ => Nil
  } */


  def parseSt(json: JsValue, fieldName: St, altName: St = ""): St =
    parseOptSt(json, fieldName, altName) getOrElse throwMissing("TyE5S204RTE", fieldName)

  def readString(json: JsValue, fieldName: String): String =
    readOptString(json, fieldName) getOrElse throwMissing("EsE7JTB3", fieldName)


  def parseOptSt(json: JsValue, fieldName: St, altName: St = ""): Opt[St] =
    readOptString(json, fieldName, altName)

  def readOptString(json: JsValue, fieldName: St, altName: St = ""): Opt[St] = {
    val primaryResult = readOptStringImpl(json, fieldName)
    if (primaryResult.isDefined || altName.isEmpty) primaryResult
    else readOptStringImpl(json, altName)
  }

  private def readOptStringImpl(json: JsValue, fieldName: String): Option[String] =
    (json \ fieldName).validateOpt[String] match {
      case JsSuccess(value, _) => value.map(_.trim)
      case JsError(errors) =>
        // Will this be readable? Perhaps use json.value[fieldName] match ... instead, above.
        throwBadJson("EsE5GUMK", s"'$fieldName' is not a string: " + errors.toString())
    }


  def readParsedRef(json: JsValue, fieldName: String, allowParticipantRef: Boolean): ParsedRef = {
    val refStr = readString(json, fieldName)
    com.debiki.core.parseRef(refStr, allowParticipantRef = allowParticipantRef) getOrIfBad { problem =>
      throwBadJson("TyEBADREFFLD", s"Field '$fieldName': Bad ref: '$refStr', the problem: $problem")
    }
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


  def readFloat(json: JsValue, fieldName: String, altName: String = "", default: Option[Float] = None): Float =
    readOptFloat(json, fieldName, altName = altName).orElse(default)
      .getOrElse(throwMissing("TyE06KA2P2", fieldName))


  def readOptFloat(json: JsValue, fieldName: String, altName: String = ""): Option[Float] = {
    readOptDouble(json, fieldName).orElse(readOptDouble(json, altName)) map { valAsDouble =>
      if (valAsDouble > Float.MaxValue)
        throwBadJson("TyE603WMDC7", s"$fieldName is too large for a Float: $valAsDouble")
      if (valAsDouble < Float.MinValue)
        throwBadJson("TyE20XKD38", s"$fieldName is too small for a Float: $valAsDouble")
      valAsDouble.toFloat
    }
  }


  def readDouble(json: JsValue, fieldName: String, altName: String = "",
        default: Option[Double] = None): Double =
    readOptDouble(json, fieldName).orElse(readOptDouble(json, altName)).orElse(default)
      .getOrElse(throwMissing("TyE078RVF3", fieldName))


  def readOptDouble(json: JsValue, fieldName: String): Option[Double] = {
    (json \ fieldName).validateOpt[Double] match {
      case JsSuccess(value, _) => value
      case JsError(errors) =>
        throwBadJson("TyE603RMDJV", s"'$fieldName' is not a Double: " + errors.toString())
    }
  }


  def readInt(json: JsValue, fieldName: String, altName: String = "",
        default: Option[Int] = None): Int =
    readOptInt(json, fieldName).orElse(readOptInt(json, altName)).orElse(default)
      .getOrElse(throwMissing("EsE5KPU3", fieldName))


  def readOptInt(json: JsValue, fieldName: String, altName: String = ""): Option[Int] = {
    readOptLong(json, fieldName).orElse(readOptLong(json, altName)) map { valueAsLong =>
      if (valueAsLong > Int.MaxValue)
        throwBadJson("EsE5YKP02", s"$fieldName is too large for an Int: $valueAsLong")
      if (valueAsLong < Int.MinValue)
        throwBadJson("EsE2PK6S3", s"$fieldName is too small for an Int: $valueAsLong")
      valueAsLong.toInt
    }
  }


  def readLong(json: JsValue, fieldName: String): Long =
    readOptLong(json, fieldName) getOrElse throwMissing("EsE6Y8FW2", fieldName)


  def parseOptLong(json: JsValue, fieldName: St): Opt[i64] =
    readOptLong(json, fieldName)

  def readOptLong(json: JsValue, fieldName: String): Option[Long] =
    (json \ fieldName).validateOpt[Long] match {
      case JsSuccess(value, _) => value
      case JsError(errors) =>
        // Will this be readable? Perhaps use json.value[fieldName] match ... instead, above.
        throwBadJson("EsE3GUK7", s"'$fieldName' is not an integer: " + errors.toString())
    }


  def parseBo(json: JsValue, fieldName: St, default: Bo): Bo =
    readOptBool(json, fieldName) getOrElse default

  def readBoolean(json: JsValue, fieldName: String): Boolean =
    readOptBool(json, fieldName) getOrElse throwMissing("EsE4GUY8", fieldName)


  def parseOptBo(json: JsValue, fieldName: St): Opt[Bo] =
    readOptBool(json, fieldName)

  def readOptBool(json: JsValue, fieldName: String): Option[Boolean] =
    (json \ fieldName).validateOpt[Boolean] match {
      case JsSuccess(value, _) => value
      case JsError(errors) =>
        // Will this be readable? Perhaps use json.value[fieldName] match ... instead, above.
        throwBadJson("EsE2GKU8", s"'$fieldName' is not a boolean: " + errors.toString())
    }


  def readWhen(json: JsValue, fieldName: String): When =
    When.fromDate(readDateMs(json, fieldName: String))


  def readWhenDay(json: JsValue, fieldName: String): WhenDay =
    WhenDay.fromDate(readDateMs(json, fieldName: String))


  def readOptWhen(json: JsValue, fieldName: String): Option[When] =
    readOptDateMs(json, fieldName).map(When.fromDate)


  def readDateMs(json: JsValue, fieldName: String): ju.Date =
    readOptDateMs(json, fieldName) getOrElse throwMissing("EsE2PKU0", fieldName)


  def readOptDateMs(json: JsValue, fieldName: String): Option[ju.Date] = {
    // Backw compat: support both ...AtMs  and  ...At
    val jsValue: JsLookupResult = {
      (json \ fieldName).orElse({
        if (fieldName.endsWith("AtMs")) json \ fieldName.dropRight(2)
        else JsUndefined(s"Field missing: $fieldName")
      })
    }
    jsValue.validateOpt[Long] match {
      case JsSuccess(value, _) =>
        val dateMs = value getOrElse {
          return None
        }
        if (dateMs < UnixMillisSomeDayIn1973 && dateMs != 0) {
          throwBadJson("EsE7UMKW2", o"""'$fieldName' looks like a unix time in seconds,
              should be milliseconds""")
        }
        Some(new ju.Date(dateMs))
      case JsError(errors) =>
        // Will this be readable? Perhaps use json.value[fieldName] match ... instead, above.
        throwBadJson("EsE5YYW2", s"'$fieldName' is not a number: " + errors.toString())
    }
  }

  private def throwBadJson(errorCode: String, message: String) =
    throw new BadJsonException(s"$message [$errorCode]")


  private def throwMissing(errorCode: String, fieldName: String) =
    throwBadJson(errorCode, s"'$fieldName' field missing")

}

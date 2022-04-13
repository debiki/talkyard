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
import com.debiki.core._
import com.debiki.core
import java.{util => ju}
import org.scalactic.{Good, Or, Bad}
import play.api.libs.json._



// Move to  talkyard.server.parse.ParseText?
object ParseText {
  def parseFloat64(text: St, fieldName: St): f64 = {
    try text.toDouble
    catch {
      case _: java.lang.NumberFormatException =>
        // throwBadData instead?
        JsonUtils.throwBadJson("TyE06MPGN2", s"Field $fieldName is not a number")
      case _: java.lang.NullPointerException =>
        JsonUtils.throwBadJson("TyE06MPGN3", s"Field $fieldName is null")
    }
  }
}



/** Parses JSON. Throws human friendly IllegalArgumentException:s. Is,a bit more concise
  * than Play's built in stuff.
  */
object JsonUtils {   MOVE // to talkyard.server.parser.JsonParSer

  RENAME // to BadDataEx? And change TyJson, TyMap, TyPaseto so they get
  // an extra param: inclStackTraceInErrors: Bo = false.
  // If no stack trace, throw BadInpDataEx.
  // Otherwise, throw BadDataEx *with* a stack trace.
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

  def tryParse[R](block: => R): R Or ErrMsg = {
    try Good(block)
    catch {
      case ex: BadJsonException =>
        Bad(ex.getMessage)
    }
  }

  def parseJson(jsonSt: St): JsValue = {
    // Play uses JacksonJson.parseJsValue, see: play.api.libs.json.
    // which throws: IOException, JsonParseException, JsonMappingException,
    // and the latter are subclasses of IOException.
    try Json.parse(jsonSt)
    catch {
      case ex: java.io.IOException =>
        throwBadJson("TyEPARSJSN", s"Cannot parse text as json: ${ex.getMessage}")
    }
  }

  def asJsObject(json: JsValue, what: St): JsObject =
    json match {
      case o: JsObject => o
      case x => throwBadJson("TyE0JSOBJ", s"$what is not a JsObject, it is a: ${classNameOf(x)}")
    }

  def asJsArray(json: JsValue, what: St): Seq[JsValue] =
    json match {
      case a: JsArray => a.value
      case x => throwBadJson("TyE0JSARR", s"$what is not a JsArray, it is a: ${classNameOf(x)}")
  }

  def asString(json: JsValue, what: St): St =
    json match {
      case n: JsString => n.value
      case x =>
        throwBadJson("TyE0JSSTR", s"$what is not a string, it is a: ${classNameOf(x)}")
    }

  def asInt64(json: JsValue, what: St): i64 =
    json match {
      case n: JsNumber =>
        try n.value.toLongExact
        catch {
          case _: java.lang.ArithmeticException =>
            throwBadJson("TyE0JSINT64", s"$what does not fit in a 64 bit integer")
        }
      case x =>
        throwBadJson("TyE0JSNUM", s"$what is not a JsNumber, it is a: ${classNameOf(x)}")
    }

  def asInt32(json: JsValue, what: St, min: Opt[i32] = None,
          max: Opt[i32] = None): i32 = {
    val int64 = asInt64(json, what)
    int64To32ThrowIfOutOfRange(int64, what, min = min, max = max)
  }

  def parseJsObject(json: JsValue, fieldName: St): JsObject =
    readJsObject(json, fieldName)

  def readJsObject(json: JsValue, fieldName: St): JsObject =
    readOptJsObject(json, fieldName).getOrElse(throwMissing("EsE1FY90", fieldName))

  def parseOptJsObject(json: JsValue, fieldName: St, emptyAsNone: Bo = false): Opt[JsObject] = {
    val anyObj = readOptJsObject(json, fieldName)
    if (emptyAsNone && anyObj.exists(_.value.isEmpty)) None
    else anyObj
  }

  def readOptJsObject(json: JsValue, fieldName: St): Opt[JsObject] =
    (json \ fieldName).toOption map {
      case o: JsObject => o
      case JsNull => return None
      case bad =>
        throwBadJson(
            "TyE2YMP73T", s"'$fieldName' is not an object, but a ${classNameOf(bad)}")
    }

  def parseJsArray(json: JsValue, fieldName: St, optional: Bo = false): Seq[JsValue] =
    readJsArray(json, fieldName, optional).value

  // Add a 2nd fn, or a param: all elems be of the same type? See below: [PARSEJSARR]
  // RENAME 'optional' to 'emptyIfAbsent'?
  def readJsArray(json: JsValue, fieldName: St, optional: Bo = false): JsArray = {
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

  def parseOptJsArray(jv: JsValue, fieldName: St): Opt[IndexedSeq[JsValue]] =
    (jv \ fieldName).toOption map {
      case a: JsArray => a.value
      case JsNull => return None
      case bad =>
        throwBadJson(
            "TyE4MGJ28RP", s"'$fieldName' is not an array, but a ${classNameOf(bad)}")
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

  def parseStOrNrAsSt(json: JsValue, fieldName: St, altName: St = ""): St =
    parseStOrNrAsOptSt(json, fieldName, altName) getOrElse throwMissing(
          "TyE60RMP25R", fieldName)

  def parseStOrNrAsOptSt(json: JsValue, fieldName: St, altName: St = ""): Opt[St] =
    (json \ fieldName).asOpt[JsValue].orElse((json \ altName).asOpt[JsValue]) map {
      case n: JsNumber => n.value.toString
      case s: JsString => s.value
      case bad =>
        throwBadJson("TyE503MRG",
            s"'$fieldName' is not a string or number, it is a: ${classNameOf(bad)}")
    }



  def parseSt(json: JsValue, fieldName: St, altName: St = ""): St =
    parseOptSt(json, fieldName, altName) getOrElse throwMissing(
          "TyE5S204RTE", fieldName)

  def readString(json: JsValue, fieldName: St, maxLen: i32 = -1): St =
    readOptString(json, fieldName, maxLen = maxLen) getOrElse throwMissing(
          "EsE7JTB3", fieldName)


  /** If noneIfLongerThan is >= 0, returns None if the value is longer than that.
    */
  def parseOptSt(json: JsValue, fieldName: St, altName: St = "",
        noneIfLongerThan: i32 = -1, cutAt: i32 = -1): Opt[St] = {
    var anySt = readOptString(json, fieldName, altName)
    dieIf(noneIfLongerThan >= 0 && cutAt >= 0,
          "TyE7PM506RP", "Both noneIfLongerThan and cutAt specified")
    if (cutAt >= 0) {
      anySt = anySt.map(_.take(cutAt))
    }
    if (noneIfLongerThan >= 0) {
      anySt foreach { value =>
        if (value.length > noneIfLongerThan)
          return None
      }
    }
    anySt
  }

  def readOptString(json: JsValue, fieldName: St, altName: St = "",
          maxLen: i32 = -1): Opt[St] = {
    val primaryResult = readOptStringImpl(json, fieldName, maxLen = maxLen)
    if (primaryResult.isDefined || altName.isEmpty) primaryResult
    else readOptStringImpl(json, altName, maxLen = maxLen)
  }

  private def readOptStringImpl(json: JsValue, fieldName: St, maxLen: i32 = -1)
          : Opt[St] =
    (json \ fieldName).validateOpt[String] match {
      case JsSuccess(value, _) =>
        value map { textUntrimmed =>
          val text = textUntrimmed.trim
          throwBadJsonIf(0 <= maxLen && maxLen < text.length,
                "TyE7MW3RMJ5", s"'$fieldName' is too long: ${text.length
                } chars, only $maxLen allowed")
          text
        }
      case JsError(errors) =>
        // Will this be readable? Perhaps use json.value[fieldName] match ... instead, above.
        throwBadJson("EsE5GUMK", s"'$fieldName' is not a string: " + errors.toString())
    }

  def parsePageRef(json: JsObject, fieldName: St): PageRef = {
    parseOptPageRef(json, fieldName) getOrElse {
      throwMissing("TyEJSN0PGREF", fieldName)
    }
  }

  def parseOptPageRef(json: JsObject, fieldName: St): Opt[PageRef] = Some {
    val rawRef = parseOptSt(json, fieldName) getOrElse {
      return None
    }
    core.parsePageRef(rawRef) getOrIfBad { errMsg =>
      throwBadJson("TyEJSBADPGREF",
            s"Field '$fieldName': Not a page ref: '$rawRef', problem: $errMsg")
    }
  }

  /*   id: / postid: / nr: / extid:  pageidpostnr/idnr:123,456  ?
  def parsePostRef(json: JsValue, fieldName: St): PageRef = {
    parseOptPostRef(json, fieldName) getOrElse {
      throwMissing("TyEJSN0POREF", fieldName)
    }
  }

  def parseOptPostRef(json: JsValue, fieldName: St): Opt[PostRef] = Some {
    val rawRef = parseOptSt(json, fieldName) getOrElse {
      return None
    }
    core.parsePostRef(rawRef) getOrIfBad { errMsg =>
      throwBadJson("TyEJSBADPOREF", s"Not a post ref: '$rawRef', problem: $errMsg")
    }
  } */


  // RENAME! to just parseRef
  def readParsedRef(json: JsObject, fieldName: St, allowPatRef: Bo): ParsedRef = {
    val refStr = readString(json, fieldName)
    core.parseRef(refStr, allowPatRef = allowPatRef) getOrIfBad { problem =>
      throwBadJson("TyEBADREFFLD",
            s"Field '$fieldName': Bad ref: '$refStr', the problem: $problem")
    }
  }


  def parsePostVoteType(json: JsObject, fieldName: St): PostVoteType = {
    val voteTypeSt = parseSt(json, fieldName)
    PostVoteType.apiV0_fromStr(voteTypeSt) getOrElse {
      throwBadJson("TyEJSNPOVOTY", s"$fieldName: Unsupported vote type: '$voteTypeSt'")
    }
  }


  def parseNotfLevel(json: JsObject, fieldName: St): NotfLevel = {
    val whatLevelSt = parseSt(json, fieldName)
    NotfLevel.fromSt_apiV0(whatLevelSt) getOrElse {
      throwBadJson("TyEJSNNOTFLV",
            s"$fieldName: Unsupported notification level: '$whatLevelSt'")
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


  def parseF32(json: JsValue, field: St, alt: St = "", default: Opt[f32] = None): f32 =
    readFloat(json, field, alt, default)


  def readFloat(json: JsValue, fieldName: String, altName: String = "", default: Option[Float] = None): Float =
    readOptFloat(json, fieldName, altName = altName).orElse(default)
      .getOrElse(throwMissing("TyE06KA2P2", fieldName))


  def parseOptFloat32(json: JsValue, fieldName: String, altName: String = ""): Opt[f32] =
    readOptFloat(json, fieldName, altName = altName)

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
    parseFloat64(json, fieldName = fieldName, altName = altName, default = default)


  def parseFloat64(json: JsValue, fieldName: St, altName: St = "",
        default: Opt[f64] = None): f64 =
    readOptDouble(json, fieldName).orElse(readOptDouble(json, altName)).orElse(default)
      .getOrElse(throwMissing("TyE078RVF3", fieldName))


  def readOptDouble(json: JsValue, fieldName: String): Option[Double] = {
    (json \ fieldName).validateOpt[Double] match {
      case JsSuccess(value, _) => value
      case JsError(errors) =>
        throwBadJson("TyE603RMDJV", s"'$fieldName' is not a Double: " + errors.toString())
    }
  }


  /*
  def parseInt16(json: JsValue, field: St, alt: St = "", default: Opt[i16] = None,
        min: Opt[i16] = None, max: Opt[i16] = None): i16 =
    parseOptInt16(json, field, alt, min = min, max = max).orElse(default) getOrElse {
      throwMissing("TyE06MWET", field)
    }


  def parseOptInt16(json: JsValue, fieldName: St, altName: St = "",
          min: Opt[i16] = None, max: Opt[i16] = None): Opt[i16] = {
    val firstFieldValue = readOptLong(json, fieldName)
    firstFieldValue.orElse(readOptLong(json, altName)) map { valueAsLong =>
      val usedName = if (firstFieldValue.isDefined) fieldName else altName
      val theMin = Some(math.max(Short.MinValue.toInt, (min getOrElse Short.MinValue).toInt))
      val theMax = Some(math.min(Short.MaxValue.toInt, (max getOrElse Short.MaxValue).toInt))
      int64To32ThrowIfOutOfRange(valueAsLong, usedName, min = theMin, max = theMax).toShort
    }
  } */


  def parseInt32(json: JsValue, field: St, alt: St = "", default: Opt[i32] = None,
        min: Opt[i32] = None, max: Opt[i32] = None): i32 =
    readInt(json, fieldName = field, altName = alt, default = default,
          min = min, max = max)


  CLEAN_UP // remove-rename all I32 and Int to Int32, and 64, etc,
  // and "read" to "parse", this whole file.
  def parseI32(json: JsValue, field: St, alt: St = "", default: Opt[i32] = None): i32 =
    readInt(json, field, alt, default)


  def readInt(json: JsValue, fieldName: String, altName: String = "",
        default: Option[Int] = None, min: Opt[i32] = None, max: Opt[i32] = None): Int =
    readOptInt(json, fieldName, min = min, max = max)
        .orElse(readOptInt(json, altName, min = min, max = max))
        .orElse(default)
        .getOrElse(throwMissing("EsE5KPU3", fieldName))


  def parseOptI32(json: JsValue, field: St, altField: St = "",
        min: Opt[i32] = None, max: Opt[i32] = None): Opt[i32] =
     readOptInt(json, field, altName = altField, min = min, max = max)


  def parseOptInt32(json: JsValue, field: St, altField: St = ""): Opt[i32] =
     readOptInt(json, fieldName = field, altName = altField)


  def readOptInt(json: JsValue, fieldName: String, altName: String = "",
          min: Opt[i32] = None, max: Opt[i32] = None): Option[Int] = {
    val firstFieldValue = readOptLong(json, fieldName)
    firstFieldValue.orElse(readOptLong(json, altName)) map { valueAsLong =>
      val usedName = if (firstFieldValue.isDefined) fieldName else altName
      int64To32ThrowIfOutOfRange(valueAsLong, usedName, min = min, max = max)
    }
  }

  private def int64To32ThrowIfOutOfRange(valueAsLong: i64, name: St, min: Opt[i32] = None,
        max: Opt[i32] = None): i32 = {
    val maxVal = max getOrElse Int.MaxValue
    val minVal = min getOrElse Int.MinValue
    if (valueAsLong > maxVal)
      throwBadJson("TyEJSNGTMX", s"$name too large: $valueAsLong, max is: $maxVal")
    if (valueAsLong < minVal)
      throwBadJson("TyEJSNLTMN", s"$name too small: $valueAsLong, min is: $minVal")
    valueAsLong.toInt
  }

  def readLong(json: JsValue, fieldName: String): Long =
    parseInt64(json, fieldName)

  def parseInt64(json: JsValue, fieldName: St): i64 =
    readOptLong(json, fieldName) getOrElse throwMissing("EsE6Y8FW2", fieldName)

  def parseOptLong(json: JsValue, fieldName: St): Opt[i64] =
    readOptLong(json, fieldName)

  def parseOptInt64(json: JsValue, fieldName: St): Opt[i64] =
    readOptLong(json, fieldName = fieldName)

  def readOptLong(json: JsValue, fieldName: String): Option[Long] =
    (json \ fieldName).validateOpt[Long] match {
      case JsSuccess(value, _) => value
      case JsError(errors) =>
        // Will this be readable? Perhaps use json.value[fieldName] match ... instead, above.
        throwBadJson("EsE3GUK7", s"'$fieldName' is not an integer: " + errors.toString())
    }


  def parseBo(json: JsValue, fieldName: St, default: Opt[Bo] = None): Bo =
    readOptBool(json, fieldName).orElse(default) getOrElse throwMissing(
          "TyE603MFE67", fieldName)

  def parseBoDef(json: JsValue, fieldName: St, default: Bo): Bo =
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

  def parseWhen(json: JsValue, fieldName: St): When =
    readWhen(json, fieldName)

  def readWhen(json: JsValue, fieldName: String): When =
    When.fromDate(readDateMs(json, fieldName))


  def readWhenDay(json: JsValue, fieldName: String): WhenDay =
    WhenDay.fromDate(readDateMs(json, fieldName))

  def parseOptWhen(json: JsValue, fieldName: St): Opt[When] =
    readOptWhen(json, fieldName)

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

  private def throwBadJsonIf(test: => Bo, errCode: St, message: St): U =
    if (test) throwBadJson(errCode, message)

  def throwBadJson(errorCode: String, message: String) =
    throw new BadJsonException(s"$message [$errorCode]")


  private def throwMissing(errorCode: String, fieldName: String) =
    throwBadJson(errorCode, s"'$fieldName' field missing")

}

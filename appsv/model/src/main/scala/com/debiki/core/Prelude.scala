/**
 * Copyright (C) 2011-2013 Kaj Magnus Lindberg (born 1979)
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

package com.debiki.core

import org.apache.commons.codec.binary.Hex

import java.{util => ju}
import java.{security => js}
import org.apache.commons.codec.{binary => acb}
import org.scalactic.{ErrorMessage, Or}
import play.api.libs.json._

import scala.collection.mutable
import scala.util.Try
import scala.util.matching.Regex
import scala.collection.immutable


object Prelude {   CLEAN_UP; RENAME // to BugDie and re-export the interesting
  // things from core package obj?
  // E.g. export  isProd and dieIf etc, but not setIsProdForever().

  def isProd: Boolean = _isProd
  def isDevOrTest: Boolean = !isProd

  /** One cannot change from Prod to Dev or Test, or from Dev or Test to Prod,
    * so we can safely remember isProd, forever.
    * (However, is-Dev and is-Test might change, depending on what
    * commands one types in the Scala cli.)
    */
  def setIsProdForever(prod: Boolean): Unit = {
    dieIf(hasSet && prod != _isProd, "TyE502ARKT4")
    _isProd = prod
    hasSet = true
  }

  private var _isProd = true
  private var hasSet = false


  // Logs an error in release mode, but throws an AssertionError in debug
  // mode -- this makes errors obvious during development and recoverable
  // in production mode. [Code Complete p. 206: Use Offensive Programming]
  // The caller should fail gracefully (e.g. use a reasonable fallback
  // instead of the corrupted database data).
  // CLEAN_UP COULD move to some DebikiLogger class and check if we're in debug
  // or release mode.

  // Should get rid of this version:
  def warnDbgDie(errorMsg: String): Unit = { warnDbgDie("", errorMsg) }

  def warnDevDieIf(test: => Bo, errorCode: St, details: St = ""): U =
    warnDbgDieIf(test, errorCode, details)

  RENAME // to ..DevDie..?
  def warnDbgDieIf(test: => Bo, errorCode: St, details: St = ""): U = {
    if (test) {
      warnDbgDie(errorCode, details)
    }
  }

  def devDieIf(test: => Bo, errorCode: St, details: St = ""): U = {
    if (!isProd && test) {
      devDie(errorCode, details)
    }
  }

  def devDie(errorCode: St, details: St = ""): U = {
    if (!isProd) {
      warnDevDie(errorCode, details)
    }
  }

  def warnDevDieUnless(test: => Bo, errorCode: St, details: St = ""): U = {
    if (!test) {
      warnDbgDie(errorCode, details)
    }
  }

  def warnDbgDie(errorCode: St, warningMsg: St): U = {
    warnDevDie(errorCode, warningMsg)
  }

  def warnDevDie(errorCode: St, warningMsg: St = ""): U = {
    if (true) {
      // Fail hard in debug mode so this error will be fixed.
      throw new AssertionError(s"$warningMsg [$errorCode]")
    }
    else {
      // Only log a warning in release mode.
    }
  }

  // Should get rid of this version:
  def errDbgDie(errorMsg: String): Unit = { errDbgDie("", errorMsg) }

  def errDbgDie(errorCode: String, errorMsg: String): Unit = {
    if (true) {
      throw new AssertionError(errorMsg)
    }
    else {
      // Log error
    }
  }


  def stringifyExceptionAndCauses(ex: Exception): String = {
    var message = ex.getMessage
    if (message eq null) message = "(No exception message)"
    var currentCause = ex.getCause
    val seenCauses = mutable.ArrayBuffer[Object]()
    var count = 0
    while ((currentCause ne null) && !seenCauses.exists(_ eq currentCause) &&
        // Extra safety, in case 'eq' above won't work:
        count < 20) {
      message += "\nCaused by: " + currentCause.getMessage
      count += 1
      seenCauses.append(currentCause)
      currentCause = currentCause.getCause
    }
    message
  }


  def getRootCause(thr: Throwable): Throwable = {
    var rootCause = thr
    // This limit should be enough: (stringifyExceptionAndCauses() above is overkill?)
    var loopLimit = 99
    while ((rootCause.getCause ne null) && loopLimit > 0) {
      rootCause = rootCause.getCause
      loopLimit -= 1
    }
    rootCause
  }


  /** Converts from a perhaps-{@code null} reference to an {@code Option}.
   */
  def ?[A <: AnyRef](x: A): Option[A] = if (x eq null) None else Some(x)

  import java.lang.{UnsupportedOperationException => UOE}

  implicit class GetOrDie[A](val underlying: Option[A]) {
    def getOrDie(errorCode: String, message: => String = ""): A = underlying.getOrElse(
      throw new ju.NoSuchElementException(
        if (message.nonEmpty) s"$message [$errorCode]"
        else s"Element missing: None.get [$errorCode]"))

    def getOrAbort(mab: MessAborter, errCode: St, msg: => St = ""): A =
      underlying getOrElse {
        mab.abort(errCode, msg)
      }

    def logBugIfEmpty(errorCode: String, message: => String = ""): Opt[A] = {
      if (underlying.isEmpty) {} // log bug  [better_logging]
      underlying
    }
  }

  implicit class GetOrDieMap[K, V](val underlying: Map[K, V]) {
    def getOrDie(key: K, errorCode: String, message: => String = ""): V = underlying.getOrElse(key,
      throw new ju.NoSuchElementException(
        if (message.nonEmpty) s"$message [$errorCode]"
        else s"Element missing: Map.get [$errorCode]"))
  }

  // Error codes should be formatted like so:
  // "DwE<number><alnum x 3><number>", e.g. "DwE8kR32".

  def unsupported = throw new UOE
  def unsupported(what: String) = throw new UOE(what)
  def unsupported(what: String, errorCode: String) =
    throw new UOE(s"$what [$errorCode]")
  def unimplemented = throw new UOE("Not implemented")
  def unimpl(what: String) = unimplemented(what)  // yes
  def unimplemented(what: String) = throw new UOE("Not implemented: "+ what)  // too long!
  def unimplemented(what: String, errorCode: String) =
    throw new UOE(s"Not implemented: $what [$errorCode]")
  def unimplIf(condition: Boolean, what: String): Unit =
    if (condition) unimplemented(what)
  def unimplementedIf(condition: Boolean, what: String): Unit =  // too long name CLEAN_UP rename to unimplIf
    if (condition) unimplemented(what)

  /** Useful code but currently not in use. Abort, so I'll notice, and test it again before
    * starting using it again.
    */
  def unused(errorCode: String, what: => String = "") =
    throw new UOE(s"Not in use: $what [$errorCode]")

  def untested(errorCode: String, what: => String = "") =
    throwUntested(errorCode, what)

  // Via "throwUntested" you can find some UNTESTED code if any.
  def throwUntested(errorCode: St, what: => St = ""): Nothing =
    throw new UOE(s"Not tested: $what [$errorCode]")

  def untestedIf(condition: Boolean, errorCode: String, what: => String = ""): Unit =
    throwUntestedIf(condition, errCode = errorCode, what)

  def throwUntestedIf(condition: Bo, errCode: St, what: => St = ""): U =
    if (condition) untested(errCode, what)

  def throwNoSuchElem(errorCode: String, message: => String) =
    throw new NoSuchElementException(s"$message [$errorCode]")



  def throwBadReqIfAny(anyErrMsg: Opt[St], errCode: St, msgPrefix: => St = ""): U = {
    anyErrMsg map { errMsg =>
      throw new BadRequestEx(msgPrefix + errMsg + s" [$errCode]")
    }
  }

  def throwBadReq3(errCode: St, errMsg: => St = ""): U = {
    throw new BadRequestEx(errMsg + s" [$errCode]")
  }

  def throwUnimpl(msg: St): Nothing = {
    throw new UnimplementedEx(msg)
  }

  def throwUnimplIf(test: Bo, msg: => St): U = {
    if (test) throwUnimpl(msg)
  }

  CLEAN_UP; MOVE // up to package core, no need to wrap in Prelude.
  /// Checks that all is fine. If it's a mess, aborts, in the right way:
  /// - If parsing user provided data from a HTTP request, throws a
  ///   Bad Request exception, or Forbidden or Not Found, if the data is bad
  ///   or some other problem.
  /// - When doing server internal things, calls die() which aborts and
  ///   logs an internal error — there's no one to reply to.
  ///
  /// See  [mess_aborter] for places to improve how it's used.
  ///
  sealed abstract class MessAborter {
    def check(test: Bo, errCode: St, errMsg: => St = "Error"): U = {
      if (!test) abort(errCode, errMsg)
    }
    def abortIf(test: Bo, errCode: St, errMsg: => St = "Error"): U = {
      if (test) abort(errCode, errMsg)
    }
    def abort(errCode: St, errMsg: => St = ""): Nothing = {
      die(errCode, errMsg)
    }
    /** Same as abort(), but can be overridden to show a Forbidden message,
      * instead of a Bad Request or Internal Server Error message.
      */
    def abortDeny(errCode: St, errMsg: => St = "Forbidden"): Nothing = {
      abort(errCode, errMsg)
    }
    def abortDenyIf(test: Bo, errCode: St, errMsg: => St = "Forbidden"): U = {
      if (test) abortDeny(errCode, errMsg)
    }
    /** Same as abort(), but can show a Not Found message.
      */
    def abortNotFound(errCode: St, errMsg: => St = "Not Found"): Nothing = {
      abort(errCode, errMsg)
    }
    def abortNotFoundIf(test: Bo, errCode: St, errMsg: => St = "Not Found"): U = {
      if (test) abortNotFound(errCode, errMsg)
    }
  }

  /// For internal errors.
  RENAME // to IfMessDie ?
  object IfBadDie extends MessAborter

  /// For HTTP requests with bad data or that try to access forbidden things.
  RENAME // to IfMessAbortReq ?
  SECURITY; COULD // add an `indistinguishableNotFound: Bo` param? [abrt_indist_404]
  // which would be set by default, unless one is admin? or moderator?
  object IfBadAbortReq extends MessAborter {
    override def abort(errCode: St, errMsg: => St = ""): Nothing = {
      throw new BadRequestEx(s"$errMsg [$errCode]")
    }
    override def abortDeny(errCode: St, errMsg: => St = ""): Nothing = {
      throw new ForbiddenEx(s"$errMsg [$errCode]")
    }
    override def abortNotFound(errCode: St, errMsg: => St = ""): Nothing = {
      throw new NotFoundEx(s"$errMsg [$errCode]")
    }
  }

  object IfBadThrowBadJson extends MessAborter {
    override def abort(errCode: St, errMsg: => St = ""): Nothing = {
      throw new BadJsonEx(s"$errMsg [$errCode]")
    }
  }

  def die(errorCode: String, problem: => String = null, cause: => Throwable = null): Nothing = {
    // Don't throw AssertionError — that makes things like Akka's actor system shutdown
    // and the server becomes a zombie server (half dead).
    throw new RuntimeException(formatErrorMessage(errorCode, problem), cause)
  }

  def requireIf(condition: Boolean, test: => Boolean, message: => String): Unit = {
    if (condition) {
      require(test, message)
    }
  }


  def formatErrorMessage(errorCode: St, details: St): St = {
    if (errorCode ne null) {
      (if ((details eq null) || details.isEmpty) "" else details + " ") + s"[$errorCode]"
    }
    else {
      details  // then this should include an err code already
    }
  }

  def dieIf(condition: Boolean, errorCode: String, problem: => Any = null): Unit =
    if (condition) die(errorCode, if (problem != null) problem.toString else null)

  def dieIfAny[T](things: Iterable[T], condition: T => Boolean,
        errorCode: String, problem: T => Any = null): Unit = {
    things.find(condition) foreach { badThing =>
      val details = if (problem ne null) problem(badThing).toString else null
      die(errorCode, details)
    }
  }

  def dieUnless(condition: Boolean, errorCode: String, problem: => String = null): Unit =
    if (!condition) die(errorCode, problem)

  def dieIfBad[A](value: A Or ErrorMessage, errorCode: String, mkMessage: ErrorMessage => String = null)
        : Unit =
    if (value.isBad) die(errorCode, if (mkMessage ne null) mkMessage(value.swap.get) else null)

  def throwIllegalArgumentIf(condition: Boolean, errorCode: String,
        problem: => String = null): Unit = {
    if (condition)
      illArgErr(errorCode, problem)
  }

  def throwIllegalArgument(errorCode: String, problem: => String = null): Nothing =
    illArgErr(errorCode, problem)

  @deprecated("now", "use throwIllegalArgument() instead")
  def illArgErr(errorCode: String, problem: => String = null): Nothing =
    throw new IllegalArgumentException(formatErrorMessage(errorCode, problem))

  def forbid(condition: Boolean, message: => String): Unit =
    require(!condition, message)

  @deprecated("now", "use forbid() instead")
  def illArgIf(condition: Boolean, errorCode: String, problem: => String = null): Unit =
    if (condition) illArgErr(errorCode, problem)

  @deprecated("now", "use forbid() instead")
  def illArgErrIf(condition: Boolean, errorCode: String, problem: => String): Unit =
    if (condition) illArgErr(errorCode, problem)

  // COULD remove
  @deprecated("now", "use forbid() instead")
  def illArgErrIf3(condition: Boolean, errorCode: String, problem: => String): Unit =
    if (condition) illArgErr(errorCode, problem)

  def throwBadDatabaseData(errorCode: String, problem: => String): Nothing =
    throw new BadDatabaseDataException(formatErrorMessage(errorCode, problem))

  class BadDatabaseDataException(message: String) extends RuntimeException(message)


  /** Converts {@code text} to a single line printable ASCII, not very long,
   *  so it can be included in an error message even if it is end user defined
   *  (i.e. possible destructive were it not made safe).
   */
  def safe(obj: AnyRef): String = {
    val str =
      if (obj eq null) "(null)"
      else if (obj.isInstanceOf[String]) obj.asInstanceOf[String]
      else obj.toString
    str // for now
  }


  // Copied from: http://stackoverflow.com/a/106223/694469
  // Supposedly adheres to http://tools.ietf.org/html/rfc952.
  // I appended "(:\d+)?" for the port number, so e.g. localhost:9000 works.
  private val ValidHostAndPortRegexStr: String =
    """(([a-zA-Z]|[a-zA-Z][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z]|[A-Za-z][A-Za-z0-9\-]*[A-Za-z0-9])(:\d+)?"""

  private val ValidHostAndPortRegex: Regex = s"""^$ValidHostAndPortRegexStr$$""".r

  def isValidHostAndPort(hostAndPort: String): Boolean =
    ValidHostAndPortRegex.pattern.matcher(hostAndPort).matches


  def urlIsToDifferentOrigin(url: String, thisServerOrigin: String): Boolean = {
    val urlUri = new java.net.URI(url)

    require(thisServerOrigin.contains("//"),
      s"Not an origin: '$thisServerOrigin' [TyE02WKL62GJ]")

    // Only an URL path? Then it's the same server.
    if (urlUri.getHost == null) {
      assert(urlUri.getScheme == null)
      assert(urlUri.getPort == -1)
      return false
    }

    val thisUri = new java.net.URI(thisServerOrigin)
    if (urlUri.getHost != thisUri.getHost)
      return true

    if (urlUri.getScheme != null && urlUri.getScheme != thisUri.getScheme)
      return true
    // Else: The browser will default to the same scheme, i.e. use thisUri's scheme.

    def getPortOrDefault(uri: java.net.URI): Int = {
      if (uri.getPort != -1) uri.getPort
      else {
        if (uri.getScheme == "http") 80
        else if (uri.getScheme == "https") 443
        else -1
      }
    }

    val urlPort = getPortOrDefault(urlUri)
    val thisPort = getPortOrDefault(thisUri)

    val thisUsesStandardPort =
      (thisPort == 80 && thisUri.getScheme == "http") ||
        (thisPort == 443 && thisUri.getScheme == "https")

    if (urlUri.getScheme == null && urlPort == -1 && thisUsesStandardPort)
      return false  // then will default to same port

    if (urlPort != thisPort)
      return true

    false
  }


  /**
   * Strips "http(s)://server:port" from an URL. Returns None if "htt(s)://server"
   * was absent, or if there was nothing after the origin.
   */
  def stripOrigin(url: St): Opt[St] = url match {
    case StripOriginRegex(_, _, path) => Option(path)
    case _ => None
  }

  def startsWithHttpOrHttps(url: St): Bo =
    url.startsWith("https://") || url.startsWith("http://")

  def stripSchemeSlashSlash(url: St): St =
    url.replaceFirst("https://", "").replaceFirst("http://", "")

  /** Returns '/' if there's no url path or the url is weird. */
  def extractUrlPath(url: St): St =
    stripOrigin(url).getOrElse("/").takeWhile(c => c != '#' && c != '&');

  // This should match too much, if something is wrong/weird, rather than too little
  // (so don't use ValidHostAndPortRegexStr).
  private val StripOriginRegex: Regex = "^((https?:)?//[^/]+)?(/.*)$".r

  val GetOriginRegex: Regex = "^(https?://[^/]+).*$".r
  val GetHostnameRegex: Regex = "^https?://([^/:]+)?.*$".r


  // For now, IPv4 only.
  val IsIpAddrRegex: Regex = """\d+\.\d+\.\d+\.\d+(:\d+)?""".r


  /** Like {@code safe}, but wraps the string between start and end
   * *d*elimiters "`" and "'", like so: <i>`the-dangerous-string'</i>
   *  -- unless it's null, then returns "(null)".
   */
  def safed(obj: AnyRef): String =
    if (obj eq null) "(null)" else "`"+ safe(obj) +"'"

  /** Replaces any non-breaking space (i.e. \u00a0) with a real space.
   *  Removes all carriage returns '\r'.
   */
  def convertBadChars(text: String): String = {
    // !! Find any Unicode c2a0 (utf8, 00a0 in utf16) token, i.e. a
    // real non-breaking-space (rather than a &nbsp;). If such a token
    // is inside a template's <head>, the parser ends the <head> right there
    // and starts the <body> instead! I've been troubleshooting this for
    // some hours now.
    // Here is a non-breaking space: ' '. (To verify, e.g. copy it to Vim,
    // place the carret on it and type 'ga' or 'g8', and Vim shows its
    // utf-16 or utf-8 representation (00a0 and c2a0).
    // -- Also remove e.g. form feed? new page? and other weird Unicode tokens?
    text  // for now, COULD implement it (convertBadChars) some day.
  }

  def classNameOf(x: Any): String = (x: @unchecked) match {
    case x: AnyRef => x.getClass.getSimpleName
    case _: Int => "Int"
    case _: Long => "Long"
    case _: Char => "Char"
    case _: Byte => "Byte"
    case _: Any => "Any"
    case null => "null"
  }

  def stripStartEndBlanks(text: String): String = {
    val start = text.indexWhere(_ > ' ')
    if (start == -1) return ""
    var end = text.lastIndexWhere(_ > ' ')
    text.slice(start, end + 1)
  }

  // E.g. "2011-12-03T10:15:30Z". Thread safe.
  private val timeFormatterIsoSecondsUtc =
    java.time.format.DateTimeFormatter.ISO_INSTANT.withZone(
      java.time.ZoneOffset.UTC)

  def toIso8601T(millis: Long): String =
    timeFormatterIsoSecondsUtc.format(java.time.Instant.ofEpochMilli(millis))

  def toIso8601T(date: ju.Date): String = toIso8601T(date.getTime)

  /** Returns the date formatted according to ISO 8601,
    * e.g. "2010-06-23 11:37:15Z", with a space not a 'T' between the
    * date and time.
    */
  def toIso8601NoT(millis: Long): String =
    toIso8601T(millis).replaceAllLiterally("T", " ")

  def toIso8601NoT(date: ju.Date): String =
    toIso8601NoT(date.getTime)


  // E.g. "2011-12-03". Thread safe.
  private val timeFormatterIsoDayUtc =
    java.time.format.DateTimeFormatter.ISO_LOCAL_DATE.withZone(
      java.time.ZoneOffset.UTC)

  def toIso8601Day(millis: Long): String =
    timeFormatterIsoDayUtc.format(java.time.Instant.ofEpochMilli(millis))

  def toIso8601Day(date: ju.Date): String = toIso8601Day(date.getTime)


  /** A date like "2015-12-31 23:59Z", i.e. no T and no seconds.
    *
    * 1) It is permitted, in ISO 8601, to omit the 'T' character by mutual agreement of
    * the partners in information interchange (i.e. this server and the JS code in
    * the browser).
    *
    * 2) Don't add a quote "'" before the 'Z' or moment.js says "Invalid date".
    */
  def toIso8601NoSecondsNoT(date: ju.Date): String = {
    // Don't include 'Z' in the format string, it gets replaced by "+0000". Append later instead.
    // SimpleDateFormat is not thread safe.
    val sdf = new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm")
    sdf.setTimeZone(_timezoneUtc)
    sdf.format(date) + "Z"
  }

  /* javax.xml.bind not incl in Java 11. This fn not needed anyway.
     Use the "new" java.time instead?:   [can_use_java_time]
     https://docs.oracle.com/javase/tutorial/datetime/index.html
  def parseIso8601DateTime(dateTime: String): ju.Date = {
    val calendar: ju.Calendar =
       javax.xml.bind.DatatypeConverter.parseDateTime(dateTime)
    val calendarUtc = _convertToUtc(calendar)
    calendarUtc.getTime
  } */

  private val _timezoneUtc = ju.TimeZone.getTimeZone("UTC")

  private def _convertToUtc(calendar: ju.Calendar): ju.Calendar = {
    // Create another Calendar, calendarUtc, with time zone UTC (GMT) and
    // add [the time zone offset in milliseconds between `calendarUtc` and
    // `calendar`] to `calendarUtc`.
    val dati: ju.Date = calendar.getTime
    val millis: Long = dati.getTime
    // The offset depends on the date (daylight saving time).
    val timeZone: ju.TimeZone = calendar.getTimeZone
    val offsetFromUtc: Int = timeZone.getOffset(millis)
    val calendarUtc = ju.Calendar.getInstance(ju.TimeZone.getTimeZone("UTC"))
    calendarUtc.setTime(dati)
    calendarUtc.add(ju.Calendar.MILLISECOND, offsetFromUtc)
    calendarUtc
  }

  /* Comment in and test, if needed.
  def anyMax[T <: math.Ordered](a: Option[T], b: Option[T]): Option[T] = {
    if (a.isEmpty && b.isEmpty) None
    else if (a.isEmpty) b
    else if (b.isEmpty) a
    else if (a.get < b.get) b
    else a
  }*/

  def addUpToMaxInt16(value: i32, toAdd: i32): i32 = {
    val result = value.toLong + toAdd.toLong
    if (result > Short.MaxValue) Short.MaxValue
    else if (result < Short.MinValue) Short.MinValue
    else result.toShort
  }

  def clampToInt(value: f64): i32 = {
    if (value >= Int.MaxValue.toDouble) return Int.MaxValue
    if (value <= Int.MinValue.toDouble) return Int.MinValue
    clampToInt(value.toLong)
  }

  def clampToInt(value: i64): i32 = {
    if (value >= Int.MaxValue) Int.MaxValue
    else if (value <= Int.MinValue) Int.MinValue
    else value.toInt
  }

  def castToInt32(value: i64, mab: MessAborter): i32 = {
    if (value > Int.MaxValue) mab.abort("TyECASTP64T32", s"Cannot cast $value to i32")
    if (value < Int.MinValue) mab.abort("TyECASTM64T32", s"Cannot cast $value to i32")
    value.toInt
  }

  def anyMaxDate(a: Option[ju.Date], b: Option[ju.Date]): Option[ju.Date] = {
    if (a.isEmpty) b
    else if (b.isEmpty) a
    else if (a.get.getTime < b.get.getTime) b
    else a  // greater or equal
  }

  def maxOfAnyInt32(a: Opt[i32], b: Opt[i32]): Opt[i32] = {
    _minOrMaxOfAnyInt32(a, b, min = false)
  }

  def minOfAnyInt32(a: Opt[i32], b: Opt[i32]): Opt[i32] = {
    _minOrMaxOfAnyInt32(a, b, min = true)
  }

  private def _minOrMaxOfAnyInt32(a: Opt[i32], b: Opt[i32], min: Bo): Opt[i32] = {
    if (a.isEmpty) b
    else if (b.isEmpty) a
    else if (a.get < b.get) { if (min) a else b }
    else if (a.get > b.get) { if (min) b else a }
    else a  // both same
  }

  def orMaskOfAnyInt32(a: Opt[i32], b: Opt[i32]): Opt[i32] = {
    if (a.isEmpty) b
    else if (b.isEmpty) a
    else Some(a.get | b.get)
  }


  // Is thread safe.
  private val _random = new java.security.SecureRandom();

  def nextRandomAzLetter(): Char = ('a' + _random.nextInt(26)).toChar

  def nextRandomLong(min: Int = 0): Long = {
    require(min < Long.MaxValue / 2, "TyE4KGKRY")
    var result = 0L
    do {
      result = _random.nextLong()
    }
    while (result < min)
    result
  }


  /** Generates a by default 130 bits entropy string, almost 26 chars long since
    * each char in a 32 chars alphabet has 5 bits (but we use 36 chars here).
    * Wikipedia says: "128-bit keys are commonly used and considered very strong".
    * Here: http://en.wikipedia.org/wiki/Key_(cryptography)
    */
  def nextRandomString(bitsEntropy: i32 = 130, base36: Bo = true,
          base64UrlSafe: Bo = false): St = {
    require(base36 != base64UrlSafe)
    if (base36) {
      // Hmm the resulting length is a bit random — if the BigInteger happens to start
      // with 0, the base 36 encoding will be shorter (leading zeroes are excluded).
      val bigInt = new java.math.BigInteger(bitsEntropy, _random)
      bigInt.toString(36) // 0..9, a..z
    }
    else {
      assert(base64UrlSafe)
      // Divisible by 8, so byte aligned — _random operates on bytes.
      assert(bitsEntropy % 8 == 0)
      // Divisible by 6, so always result in same length Base64 repr.
      assert(bitsEntropy % 6 == 0)
      val numBytes = bitsEntropy / 8
      val bytesArray = new Array[Byte](numBytes)
      _random.nextBytes(bytesArray)
      val res = acb.Base64.encodeBase64URLSafeString(bytesArray)
      assert(res.length * 6 == bitsEntropy)
      res
    }
  }

  // COULD split this in a random string function, and other id generation
  // functions, with string length adjusted, depending on how the random
  // string will be used.
  def nextRandomPageId(): String = {  // TODO exclude vowels, so no bad words
    var s = nextRandomString()
    // Remove vowels to reduce the possibility of ugly bad words.
    // Keep vowels "uy" though, so there are 32 chars in total.
    // "uy" are the least common vowels.
    s = s filterNot ("aoei" contains _)

    // 10 chars doesn't look nice! ...
    //s = s take 10 // this'll do for now, the database will ensure
                  // uniqueness? If I use a nosql database, then perhaps
                  // use 15 instead?  (32^10 is huge: 1 million billions!)

    // ... instead take 3 chars only and start and end with a digit, always.
    // Then people'll understand it's an ID? Since it ends with a digit?
    def randomDigit = (java.lang.Math.random() * 10).toInt.toString
    s = randomDigit + s.take(3) + randomDigit

    // It's the responsibility of database not to overwrite anything,
    // but rather fail, and the caller could retry with a new id.
    // 10 * 32 * 32 * 32 * 10 = 3 000 000.

    s
    /*
    // Or use Apache Commons, org.apache.commons.lang.RandomStringUtils:
    RandomStringUtils.random(10 /*count*/, 0 /*start*/, 32 /*end*/,
      false /*letters only*/, false /*numbers only*/,
      // Characters to pick from. Alphanumeric, but all vowels except for "uy"
      // removed. This results in 32 characters, and (since most vowels are
      // removed) virtually no possibility of ugly words, like "yourfatrat".
      "bcdfghjklmnpqrstuvwxyz0123456789", _random)
    */
  }

  /* Hmm, old stuff. REMOVE?

  // This isn't really a secret salt. A secret salt should be kept secret
  // in the database, fetched via Dao.secretSalt and specified via useSalt().
  // I think the salt better be fairly long, otherwise it'd be possible to
  // find out what is the salt, since you might guess that a salt + email
  // is hashed to the dwCoUserEmailSH cookie, and you have your hash and
  // your email and can thus do a brute force attack.
  private var _hashSalt = "94k2xIf1AoVkbx928_"

  /** Sets the salt used when hashing (no related to the random numbers). */
  def setHashSalt(salt: String): Unit = { _hashSalt = salt }

  def saltAndHash(hashLength: Int)(text: String): String = {
    val saltAndText = _hashSalt + text
    hashSha1Base64UrlSafe(saltAndText) take hashLength
  }

  val hashLengthEmail = 20
  val hashLengthIp = 20

  def saltAndHashEmail: St => St = saltAndHash(hashLengthEmail) _
  def saltAndHashIp: St => St = saltAndHash(hashLengthIp) _
  */

  SECURITY; COULD_OPTIMIZE // use BLAKE3 instead.
  private def mdSha1: js.MessageDigest = js.MessageDigest.getInstance("SHA-1") // not thread safe

  /// SHA-512/256 is faster and stronger than SHA-224 (not in a way that matters, but anyway).
  /// And BLAKE3 has a 256 bits output too by default.
  private def mdSha512: js.MessageDigest =
    js.MessageDigest.getInstance("SHA-512") // not thread safe

  def hashSha1Base64UrlSafe(text: String): String =
    acb.Base64.encodeBase64URLSafeString(mdSha1.digest(text.getBytes("UTF-8")))

  def hashSha512FirstHalf32Bytes(text: St): Array[i8] = {
    // I think this isn't the real SHA512/256, but this'll be ok too.
    // SHA-512/256 not incl in Java 8.
    // Later: Use BLAKE3, the Rust implementation, call from Java.
    val res = mdSha512.digest(text.getBytes("UTF-8"))
    assert(res.length == 32 * 2)
    res take 32
  }


  /* ------  Move to a 'security' package?    [406MRED256]
  def base32EncodeSecretKey(key: javax.crypto.SecretKey): St = {
    val b32 = new acb.Base32(99999)  // "unlimited" line length
    b32.encodeToString(key.getEncoded)
  }

  def base32DecodeSecretKey(keyInBase32: St): javax.crypto.SecretKey = {
    val b32 = new acb.Base32(99999)
    val keyBytes = b32.decode(keyInBase32)
    dev.paseto.jpaseto.lang.Keys.secretKey(keyBytes)
  }

  def hexDecodeSecretKey(keyInHex: St): javax.crypto.SecretKey = {
    val keyBytes = acb.Hex.decodeHex(keyInHex)
    dev.paseto.jpaseto.lang.Keys.secretKey(keyBytes)
  }

  def generateSecretKey(): javax.crypto.SecretKey = {
    // This uses java.security.SecureRandom.
    dev.paseto.jpaseto.lang.Keys.secretKey()
  }
  // ------ */

  def hideEmailLocalPart(emailAddress: String): String =
    if (emailAddress.isEmpty) ""
    else DotDotDot + emailAddress.dropWhile(_ != '@')

  def isEmailLocalPartHidden(emailAddress: String): Boolean =
    emailAddress startsWith DotDotDot

  private val DotDotDot = "..."


  // ------ Diff, match, patch

  def makePatch(from: String, to: String): String = {
    val dmp = new name.fraser.neil.plaintext.diff_match_patch
    var diffs = dmp.diff_main(from, to)
    dmp.diff_cleanupSemantic(diffs)
    val patches = dmp.patch_make(from, diffs)
    val patchText = dmp.patch_toText(patches)
    patchText
  }

  def applyPatch(patchText: String, to: String): String = {
    val textToPatch = to
    // COULD check [1, 2, 3, …] to find out if the patch applied
    // cleanaly. (The result is in [0].)
    val dmp = new name.fraser.neil.plaintext.diff_match_patch
    type P = name.fraser.neil.plaintext.diff_match_patch.Patch
    val patches: ju.List[P] = dmp.patch_fromText(patchText) // silly API, ...
    val p2 = patches.asInstanceOf[ju.LinkedList[P]] // returns List but needs...
    val result = dmp.patch_apply(p2, textToPatch) // ...a LinkedList
    val newText = result(0).asInstanceOf[String]
    newText
  }


  // ------ Utilities

  // The ternary operator: `if (p) a else b'  <-->  `p ? a | b'
  class IfTrue[A](b: => Boolean, t: => A) { def |(f: => A) = if (b) t else f }
  class MakeIfTrue(b: => Boolean) { def ?[A](t: => A) = new IfTrue[A](b,t) }
  implicit def autoMakeIfTrue(b: => Boolean) = new MakeIfTrue(b)


  /**
   * Pimps `Regex` with `matches(text): Boolean` and `misses(text): Boolean`.
   */
  implicit def regexToRichRegex(r: Regex) = new RichRegex(r)
  class RichRegex(underlying: Regex) {
    def matches(s: String) = underlying.pattern.matcher(s).matches
    def misses(s: String) = !matches(s)
  }

  implicit class RegexToFindGroup(regex: scala.util.matching.Regex) {
    def findGroupInAny(anyText: Opt[St]): Opt[St] =
      anyText flatMap findGroupIn

    def findGroupIn(text: St): Opt[St] =
      text match {
        case regex(firstGroup) =>
          Option(firstGroup)
        case _ =>
          None
      }

    def findTwoGroupsIn(text: St): Opt[(St, St)] =
      text match {
        case regex(firstGroup, secondGroup) =>
          Some((firstGroup, secondGroup))
        case _ =>
          None
      }
  }

  implicit class RichOption[T](underlying: Opt[T]) {
    def oneIfDefined: i32 = if (underlying.isDefined) 1 else 0
    def is(value: T): Bo = underlying.contains(value)
    def isNot(value: T): Bo = !underlying.contains(value)
    def isSomethingButNot(value: T): Bo = underlying.isDefined && !underlying.contains(value)
    def isEmptyOr(value: T): Bo = underlying.isEmpty || underlying.contains(value)
  }

  /*
  implicit class RichIntOption[T](underlying: Opt[i32]) {
    def ifZeroNoneOrElse(other: Opt[i32]): Opt[i32] = {   — confusing name? Better inline the if-else?
      if (underlying is 0) None
      else underlying.orElse(other)
    }
  } */

  implicit class RichOptionEq[T <: AnyRef](underlying: Option[T]) {
    def isEq(value: T): Boolean = underlying.exists(_ eq value)
    def isNotEq(value: T): Boolean = underlying.forall(_ ne value)
    def isSomethingNotEq(value: T): Boolean = underlying.isDefined && isNotEq(value)
  }

  // Doesn't work, causes error: maxOptBy is not a member of Seq[com.debiki.core.Post]
  implicit class RichSeq[T](underlying: scala.collection.Seq[T]) {
    def maxOptBy[B](f: T => B)(implicit cmp: Ordering[B]): Option[T] = {
      if (underlying.isEmpty) None
      else Some(underlying.maxBy(f))
    }
  }
  // ... but this works:
  def maxOptBy[T, B](underlying: scala.collection.Seq[T])(f: T => B)(
          implicit cmp: Ordering[B]): Option[T] = {
      if (underlying.isEmpty) None
      else Some(underlying.maxBy(f))
    }

  implicit class BlankStringToNone(underlying: Option[String]) {
    def noneIfBlank: Option[String] =
      if (underlying.exists(_.trim.isEmpty)) None
      else underlying  // <—— not trimmed

    def trimNoneIfBlank: Option[String] =
      underlying.map(_.trim) match {
        case Some("") => None
        case x => x  // <—— trimmed
      }

    def isEmptyOrContainsBlank: Boolean =
      underlying.isEmpty || underlying.get.trim.isEmpty
  }


  private val AToZUnderscoreRegex = "^[a-zA-Z_]*$".r
  private val VariableNameRegex = "^[a-zA-Z_][a-zA-Z0-9_]*$".r
  private val AlNumWithAl = "^[a-zA-Z0-9_]*[a-zA-Z_][a-zA-Z0-9_]*$".r
  private val AlNumDashRegex = "^[a-zA-Z0-9_-]*$".r

  /** Checks that all fields names are okay variable names,
    * and that all values are numbers, or also okay variable names.
    * Just to avoid any unexpected things like some kind of injection.
    */
  def anyWeirdJsObjField(obj: JsObject, maxLength: i32,
           allowHeaderNameValues: Bo = false): Opt[St] = {
    unimplIf(allowHeaderNameValues, "TyE50MFEDJ4601")
    for ((fieldName, fieldValue) <- obj.fields) {
      if (fieldName.isEmpty)
        return Some("Empty field name")

      if (allowHeaderNameValues) {
        if (!fieldName.isOkHeaderName)
          return Some(s"Weird header name: '$fieldName' [TyE0HDRNAME]")
      }
      else {
        if (!fieldName.isOkVariableName)
          return Some(s"Weird field name: '$fieldName' [TyE0VARNAME]")
      }

      if (fieldName.length > maxLength)
        return Some(s"Too long field name: '$fieldName' [TyE2LNGFLDNM]")

      fieldValue match {
        case _: JsNumber =>
          // Fine
        case s: JsString =>
          if (s.value.isEmpty)
            return Some(s"Empty value for field $fieldName")

          if (allowHeaderNameValues) {
            // Don't allow newlines in value?
            unimpl("TyE50MFEDJ4602")
          }
          else if (!s.value.isOkVariableName) {
            return Some(s"Bad value for field $fieldName: '$fieldValue'")
          }

          if (s.value.length > maxLength)
            return Some(s"Too long field value, $fieldName: '$fieldValue'")

        case _ =>
          return Some(s"Value of field $fieldName is not a nummer or string; it is a ${
            classNameOf(fieldValue)} [TyEFIELDVALTYP]")
      }
    }
    None
  }

  /** Default value doesn't work with anyJsonObj.flatMap(anyWeirdJsObjField)
    */
  def anyWeirdJsObjField(obj: JsObject): Option[String] =
    anyWeirdJsObjField(obj, maxLength = 100)

  def jsObjectSize(obj: JsObject, depth: i32 = 0): i32 = {
    TESTS_MISSING
    var size = 0
    for ((fieldName, value) <- obj.fields) {
      size += fieldName.length + jsValueSize(value, depth = depth + 1)
    }
    size
  }

  private def jsValueSize(value: JsValue, depth: i32 = 0): i32 = {
    TESTS_MISSING
    if (depth > 10)
      return Int.MaxValue // for now
    value match {
      case JsNull => 4
      case _: JsBoolean => 4
      case _: JsNumber => 4 // let's just guess 4 bytes. Or log-10?
      case s: JsString => s.value.length
      case _: JsArray =>
        // What about infinitely deeply nested empty arrays in arrays! Would be size 0 :-(
        Int.MaxValue // for now
        // a.value.foldLeft(0)((len, v) => {
        //   jsValueSize(v, sizeThisFar + len, maxAllowedSize, depth = depth + 1)
        // })
      case _: JsObject =>
        Int.MaxValue // for now
        //jsObjectSize(o)
      case _ =>
        // What's this?
        assert(false)
        Int.MaxValue
    }
  }

  // Move to where?
  val JsEmptyObj2: JsObject = JsObject(Nil)

  /*
  def mapKeyValuesTotalLength(map: Map[St, Any], depth: i32 = 0): i32 = {
    var size = 0
    for ((fieldName, value) <- map) {
      size += fieldName.length + jsValueSize(value, depth = depth + 1)
      // or:   + value match { case n: some-number: ...  case s: St => s.length  case _ => no! }
    }
    size
  } */


  implicit class JsObjectHelpers(jOb: JsObject) {
    def addAnyBo(fieldName: St, anyValue: Opt[Bo]): JsObject = {
      val value: Bo = anyValue getOrElse {
        return jOb
      }
      jOb + (fieldName -> JsBoolean(value))
    }

    def addAnyInt32(fieldName: St, anyValue: Opt[HasInt32]): JsObject = {
      val value: HasInt32 = anyValue getOrElse {
        return jOb
      }
      jOb + (fieldName -> JsNumber(value.toInt))
    }

    def addAnySt(fieldName: St, anyValue: Opt[St]): JsObject = {
      val value: St = anyValue getOrElse {
        return jOb
      }
      jOb + (fieldName -> JsString(value))
    }
  }


  /**
   * Pimps `String` with `matches(regex): Boolean` and `misses(regex)`
   * and `dropRightWhile(Char => Boolean)` and `takeRightWhile`.
   */
  implicit def stringToRichString(s: String): RichString = new RichString(s)

  class RichString(underlying: String) {

    def matches(regex: Regex): Boolean = regex.pattern.matcher(underlying).matches
    def misses(regex: Regex): Boolean = !matches(regex)

    def dropRightWhile(f: Char => Boolean): String = {
      val keepIx = underlying.lastIndexWhere(!f(_))
      if (keepIx == -1) return ""
      val kept = underlying.dropRight(underlying.length - 1 - keepIx)
      kept
    }

    def takeRightWhile(f: Char => Boolean): String = {
      val dropIx = underlying.lastIndexWhere(!f(_))
      if (dropIx == -1) return underlying
      val kept = underlying.takeRight(underlying.length - 1 - dropIx)
      kept
    }

    def toIntOption: Option[Int] =
      Try(underlying.toInt).toOption

    def toInt64Option: Opt[i64] =
      Try(underlying.toLong).toOption

    def toFloatOption: Option[Float] =
      Try(underlying.toFloat).toOption

    def toFloat64Option: Opt[f64] =
      Try(underlying.toDouble).toOption

    def orIfEmpty[A >: String](other: => A): A = {
      if (underlying nonEmpty) underlying
      else other
    }

    def trimNoneIfEmpty: Option[String] = {   RENAME // to noneIfBlank?
      val trimmed = underlying.trim
      if (trimmed.isEmpty) None
      else Some(trimmed)
    }

    def noneIfEmpty: Opt[St] = {
      if (underlying.isEmpty) None
      else Some(underlying)
    }

    REFACTOR // move all these to Check instead?

    def isAToZUnderscoreOnly: Boolean =
      AToZUnderscoreRegex.pattern.matcher(underlying).matches

    def isOkVariableName: Boolean =
      VariableNameRegex.pattern.matcher(underlying).matches

    def isOkHeaderName: Bo =
      underlying.nonEmpty && AlNumDashRegex.pattern.matcher(underlying).matches

    def isAlNum: Bo =
      underlying.forall(charIsAzOrNum)

    def isAzLowerOrNum: Bo =
      underlying.forall(charIsAzLowerOrNum)

    def isAzLowerNumUn: Bo =
      underlying.forall(charIsAzLowerNumUn)

    def isAlNumWithAl: Bo =
      AlNumWithAl.pattern.matcher(underlying).matches

    def obviouslyBadUrl: Bo =
      underlying.exists(c => " \n\t\r\"'<>".contains(c)) || underlying.isEmpty

  }

  def charIsAzNumOrUnderscore(c: Char): Boolean =
    charIsAzOrNum(c) || c == '_'

  def charIsAzLower(c: Char): Bo =
    c >= 'a' && c <= 'z'

  def charIsAz(c: Char): Bo =
    charIsAzLower(c) || (c >= 'A' && c <= 'Z')

  def charIsAzUnderscore(c: Char): Boolean =
    charIsAz(c) || c == '_'

  def charIsAzOrNum(c: Char): Boolean =
    charIsAz(c) || charIsNum(c)

  def charIsAzLowerOrNum(c: Char): Bo =
    charIsAzLower(c) || charIsNum(c)

  def charIsAzLowerNumUn(c: Char): Bo =
    charIsAzLower(c) || charIsNum(c) || c == '_'

  def charIsNumOrDotDash(c: Char): Boolean = charIsNum(c) || c == '.' || c == '-'

  def charIsNum(c: Char): Boolean = c >= '0' && c <= '9'

  /**
   * It's impossible to place breakpoints in Specs test suites, so
   * instead I place a breakpoint in this function, and call it from
   * the test suite, on the line where I'd like to have a "breakpoint".
   */
  def debugBreakpointA: Unit = {
    println("debugBreakpointA")
  }

  def debugBreakpointB: Unit = {
    println("debugBreakpointA")
  }


  /**
   * Indents arguments that should be indented. For example:
   * {{{
   * t"""
   *   |Hello
   *   |   $name"""
   * }}}
   * would result in e.g.:
   * """
   * Hello
   *    Planet
   *    Earth"""
   *
   * BUT Somewhat BROKEN because this doesn't work:
    scala> val ir = """(.*)""".r
    ir: scala.util.matching.Regex = (.*)

    scala> "aa\n   " match { case ir(a) => a; case y => "noo" }
    res22: String = noo
   */
  implicit class StripIndentStringInterpolator(val stringContext: StringContext) {
    // Find test cases in StringInterpolatorsTest.

    def i(args: Any*): String = {
      stringContext.checkLengths(args)
      val stringBuilder = new StringBuilder()

      for ((partNotStripped, arg) <- stringContext.parts zip args) {
        val part = stripped(partNotStripped)
        stringBuilder append part

        val argIndented = part match {
          case IndentationRegex(indentation) =>
            arg.toString.replaceAll("\n", "\n" + indentation)
          case _ =>
            arg.toString
        }

        stringBuilder append argIndented
      }

      if (stringContext.parts.size > args.size)
        stringBuilder append stripped(stringContext.parts.last)

      stringBuilder.toString
    }

    private def stripped(string: String): String =
      StripRegex.replaceAllIn(string, "\n")

    private val StripRegex = """\n\s*\|""".r
    private val IndentationRegex = """\n(\s+)$""".r
  }


  implicit class OneLineStringInterpolator(val stringContext: StringContext) {
    // Find test cases in StringInterpolatorsTest.

    // One line: everything on one line, newlines converted to spaces.
    def o(args: Any*): String = {
      stringContext.checkLengths(args)
      val stringBuilder = new StringBuilder()
      stringBuilder append withSpacesCollapsed(trimLeft(stringContext.parts.head))
      for ((part, arg) <- stringContext.parts.tail zip args) {
        stringBuilder append arg.toString
        stringBuilder append withSpacesCollapsed(part)
      }
      stringBuilder.toString
    }

    private def trimLeft(string: String): String =
      TrimLeftRegex.replaceAllIn(string, "")

    private def withSpacesCollapsed(string: String): String =
      CollapseSpacesRegex.replaceAllIn(string, " ")

    private val TrimLeftRegex = """^\s*""".r
  }

  val CollapseSpacesRegex: Regex = """\s\s*""".r


  implicit class RichJavaUri(val underlying: j_URI) extends AnyVal {
    def getHostOrNone: Opt[St] = {
      val h = underlying.getHost
      if (h eq null) None
      else Some(h)
    }

    def getPathEmptyNotNull: St = {
      // Java's getPath() can return null, don't know how to reproduce that though.
      // Edit: an origin without any url path, then, getPath returns null?
      val path = underlying.getPath
      if (path eq null) "" else path
    }

    def getQueryEmptyNotNull: St = {
      val queryString = underlying.getQuery
      if (queryString eq null) "" else queryString
    }

    def getHashFragEmptyNotNull: St = {
      // Java's getFragment() can return null.
      val hashFrag = underlying.getFragment
      if (hashFrag eq null) "" else hashFrag
    }
  }


  implicit class RichLinkedHashMap[K, V](val underlying: mutable.LinkedHashMap[K, V])
      extends AnyVal {

    def removeWhile(predicate: ((K, V)) => Boolean): Unit = {
      val keysToRemove = underlying.iterator.takeWhile(predicate).map(_._1)
      keysToRemove.foreach(underlying.remove)
    }

    def removeAtMostWhile(howMany: Int, predicate: ((K, V)) => Boolean): Unit = {
      var numGone = 0
      removeWhile(kv => {
        if (numGone >= howMany) false
        else {
          val removeThisOne = predicate(kv)
          if (removeThisOne) numGone += 1
          removeThisOne
        }
      })
    }

    def removeWhileValue(predicate: V => Boolean): Unit = {
      val keysToRemove = underlying.iterator.takeWhile(entry => predicate(entry._2)).map(_._1)
      keysToRemove.foreach(underlying.remove)
    }

    def removeWhileKey(predicate: K => Boolean): Unit = {
      val keysToRemove = underlying.keysIterator.takeWhile(predicate)
      keysToRemove.foreach(underlying.remove)
    }
  }

}


// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list


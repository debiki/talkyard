package com.debiki.core

import com.debiki.core.Prelude._
import play.api.libs.json.JsObject


case class TySessionInDbMaybeBad(
  patId: PatId,
  createdAt: When,
  deletedAt: Opt[When],
  expiredAt: Opt[When],
  version: i32,
  startIp: Opt[IpAdr],
  startBrowserId: Opt[BrowserIdSt],
  startHeaders: JsObject,
  part1CompId: St,
  //part2ForEmbgStorage: St,
  part2HashForEmbgStorage: Array[i8],
  //part3ForDirJs: Opt[St],
  part3HashForDirJs: Array[i8],
  //part4HttpOnly: Opt[St],
  part4HashHttpOnly: Array[i8],
  //part5Strict: Opt[St],
  part5HashStrict: Array[i8]) {

  def isValidNow(now: When, expireIdleAfterMins: i32): Bo =
    wasValidJustRecently && !expiresNow(now, expireIdleAfterMins = expireIdleAfterMins)

  def wasValidJustRecently: Bo = !isDeleted && !hasExpired

  def isDeleted: Bo = deletedAt.isDefined
  def hasExpired: Bo = expiredAt.isDefined

  def expiresNow(now: When, expireIdleAfterMins: i32): Bo = {
    val expiresAt = createdAt.millis + expireIdleAfterMins * MillisPerMinute
    expiresAt <= now.millis
  }


  /// We lookup the session by part 1, and part 2 is required — so 1 and 2 are never absent.
  def copyAsValid(part2: St, part3: Opt[St], part4: Opt[St], part5: Opt[St])
          : TySession = {
    dieIf(expiredAt.isDefined || deletedAt.isDefined, "TyESESS0VALID")
    TySession(
          patId = patId,
          createdAt = createdAt,
          version = version,
          startIp = startIp,
          startBrowserId = startBrowserId,
          startHeaders = startHeaders,
          part1CompId = part1CompId,
          part2ForEmbgStorage = part2,
          part2Hash = part2HashForEmbgStorage,
          part3ForDirJs = part3,
          part3Hash = part3HashForDirJs,
          part4HttpOnly = part4,
          part4Hash = part4HashHttpOnly,
          part5Strict = part5,
          part5Hash = part5HashStrict)
  }

  /*
  def toVersionJsonSt: St = {
    var jsonOb = Json.obj(
          "patId" -> patId,
          "createdAtMs" -> createdAtMs)
    if (isDeleted) jsonOb += "deletedAtMs" -> JsNumber(deletedAtMs)
    if (isEmbedded) jsonOb += "isEmb" -> JsTrue
    if (wasAutoAuthn) jsonOb += "wasAuAu" -> JsTrue
    if (isOldUpgraded) jsonOb += "isOldUpgraded" -> JsTrue
    if (hasExpired) jsonOb += "hasExpired" -> JsTrue
    s"v$sessVer:${jsonOb.toString}"
  } */
}


/** Later, more fields, see:
  * https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#session-id-content-or-value
  *
  * @param patId
  * @param createdAt
  * @param version
  * @param part1CompId
  * @param part2ForEmbgStorage
  * @param part2Hash
  * @param part3ForDirJs
  * @param part3Hash
  * @param part4HttpOnly
  * @param part4Hash
  * @param part5Strict
  * @param part5Hash
  * @param isApiCall COULD split TySession into ClientSession and SingleApiReqSession maybe?
  */
case class TySession(
  patId: PatId,
  createdAt: When,
  version: i32,
  startIp: Opt[IpAdr],
  startBrowserId: Opt[BrowserIdSt],
  startHeaders: JsObject,
  part1CompId: St,
  part2ForEmbgStorage: St,
  part2Hash: Array[i8],
  part3ForDirJs: Opt[St],
  part3Hash: Array[i8],
  part4HttpOnly: Opt[St],
  part4Hash: Array[i8],
  part5Strict: Opt[St],
  part5Hash: Array[i8],
  isApiCall: Bo = false) {

  import TySession._
  require(version >= 1, "TyE30MFEW25MMR")

  require(jsObjectSize(startHeaders) < MaxSessionHeadersSize, "TyE4MW2AP7J")

  require(part1CompId.length  == SidLengthCharsPart1, s"Len pt 1: ${part1CompId.length}")

  require(part2Hash.length == SidHashLengthBytes, s"Len pt 2 hash: ${part2Hash.length}")
  require(part2ForEmbgStorage.length == SidLengthCharsPart2,
        s"Len pt 2: ${part2ForEmbgStorage.length}")

  require(part3Hash.length == SidHashLengthBytes, s"Len pt 3 hash: ${part3Hash.length}")
  require(part3ForDirJs.forall(_.length == SidLengthCharsPart3),
        s"Len pt 3: ${part3ForDirJs.map(_.length)}")

  require(part4Hash.length == SidHashLengthBytes, s"Len pt 4 hash: ${part4Hash.length}")
  require(part4HttpOnly.forall(_.length == SidLengthCharsPart3),
        s"Len pt 4: ${part4HttpOnly.map(_.length)}")

  require(part5Hash.length == SidHashLengthBytes, s"Len pt 5 hash: ${part5Hash.length}")
  require(part5Strict.forall(_.length   == SidLengthCharsPart5),
        s"Len pt 5: ${part5Strict.map(_.length)}")

  def part1And2: St = part1CompId + part2ForEmbgStorage

  def part3Absent: Bo = part3ForDirJs.isEmpty
  def part4Absent: Bo = part4HttpOnly.isEmpty
  def part5Absent: Bo = part5Strict.isEmpty
}



object TySession {

  val CurVersion = 1

  // A random Base64 char is 6 bits entropy (if perfect rand gen).
  val SidEntropyPerChar: i32 = 6
  val SidCharsetBase: i32 = 64

  // Such a long session id might seem like a bit overkill — OWASP writes that 64 bits
  // entropy is enough, that's about 11 chars in Base64.  [sid_part1]
  // https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#session-id-entropy
  //
  // However, parts 1, 2 are for embedded comments, and for optionally saving in
  // the localStorage of embedding pages (e.g. blog posts) which is more risky.
  // If indeed parts 1 and 2 get compromised, we can still rely on part 3 alone
  // — it's 144 bits entropy > 64  (with a good cryptographically secure pseudo random
  // number generator CSPRNG).
  //
  val SidLengthCharsPart1: i32 = 16
  val SidLengthCharsPart2: i32 = 24
  val SidLengthCharsPart3: i32 = 24
  val SidLengthCharsPart4: i32 = 24
  val SidLengthCharsPart5: i32 = 16

  val SidLengthCharsPart12: i32 =
      SidLengthCharsPart1 +
      SidLengthCharsPart2

  val SidLengthCharsPart123: i32 =
      SidLengthCharsPart12 +
      SidLengthCharsPart3

  val SidLengthCharsTotal: i32 =
        SidLengthCharsPart123 +
        SidLengthCharsPart4 +
        SidLengthCharsPart5

  val ApiSecretPart1 = "TyE_API_SID_PT_1"
  val ApiSecretPart2 = "TyE_API_SID_PT_2_pad_24_"
  val ApiSecretPart12: St = ApiSecretPart1 + ApiSecretPart2

  // BLAKE3 and SHA-512/256 have 256 bits output size = 32 bytes.
  val SidHashLengthBytes = 32

  val DummyHash: Array[i8] = Array.fill(SidHashLengthBytes)(0.asInstanceOf[i8])
  val DummyHashPart2: Array[i8] = hashSha512_256ToBytesLen32(ApiSecretPart12)

  val MaxSessionHeadersSize = 1000

  def singleApiCallSession(asPatId: PatId): TySession =
    TySession(
          patId = asPatId,
          // Maybe use now() instead? Shouldn't ever matter.
          createdAt = When.Genesis,
          version = CurVersion,
          startIp = None,
          startBrowserId = None,
          startHeaders = JsObject.empty,
          // Should never see these anywhere, so prefix with the error code prefix.
          part1CompId = ApiSecretPart1,
          part2ForEmbgStorage = ApiSecretPart2,
          part2Hash = DummyHashPart2,
          part3ForDirJs = None, // Some("TyE_API_SID_PT_3_pad_24_"),
          part3Hash = DummyHash,
          part4HttpOnly = None, // Some("TyE_API_SID_PT_4_pad_24_"),
          part4Hash = DummyHash,
          part5Strict = None, // Some("TyE_API_SID_PT_5"),
          part5Hash = DummyHash,
          isApiCall = true)

  /*
  val Version = 1

  val StatusValid = 1
  val StatusDeleted = 2
  val StatusExpired = 3

  val NotDeleted: i64 = -1

  def parse(sessionSt: St): TySessionMaybeBad Or ErrMsg = {
    val versionPrefix = s"v$Version:"
    if (!sessionSt.startsWith(versionPrefix)) return Bad("Bad version prefix")
    val jsonSt = sessionSt drop versionPrefix.length
    jps.tryParse {
      val jVal = jps.parseJson(jsonSt)
      val jOb = jps.asJsObject(jVal, "Session")
      val patId = jps.parseInt32(jOb, "patId")
      val createdAtMs = jps.parseInt64(jOb, "createdAtMs")
      val deletedAtMs = jps.parseOptInt64(jOb, "deletedAtMs") getOrElse NotDeleted
      val isEmbedded = jps.parseOptBo(jOb, "isEmb") getOrElse false
      val wasAutoAuthn = jps.parseOptBo(jOb, "wasAuAu") getOrElse false
      val isOldUpgraded = jps.parseOptBo(jOb, "isOldUpgraded") getOrElse false
      val hasExpired = jps.parseOptBo(jOb, "hasExpired") getOrElse false
      if (deletedAtMs == NotDeleted && !hasExpired) {
        TySession(
              sessVer = Version,
              patId = patId,
              createdAtMs = createdAtMs,
              isEmbedded = isEmbedded,
              wasAutoAuthn = wasAutoAuthn,
              isOldUpgraded = isOldUpgraded)
      }
      else {
        TySessionBad(
              sessVer = Version,
              patId = patId,
              createdAtMs = createdAtMs,
              deletedAtMs = deletedAtMs,
              isEmbedded = isEmbedded,
              wasAutoAuthn = wasAutoAuthn,
              isOldUpgraded = isOldUpgraded,
              hasExpired = hasExpired)
      }
    }
  } */

}

package com.debiki.core

import com.debiki.core.Prelude._
import play.api.libs.json.JsObject


/** The session id is split into 5 parts in 3 cookies: a not-HttpOnly cookie,
  * a HttpOnly and a HttpOnly SameSite=Strict cookie.  [cookie_theory]
  *
  * Each one of the 5 parts is, entropy wise, strong enough, on its own.
  * To do more "important" things, more parts are needed. Whilst
  * the first parts, not-HttpOnly, make Talkyard work also in blog comments iframes
  * where cookies tend to not work.
  *
  * If expiredAt or deletedAt is set, the session cannot be used.
  * A session can be both expired and deleted (if it gets deleted just when it expires).
  *
  * @param patId
  * @param createdAt
  * @param deletedAt
  * @param expiredAt — updated lazily, on use. So, even if the
  *   current time is past the createdAt + expiration time, expiredAt might be unset
  *   — but when pat tries to use the session again, the server will notice it has
  *   expired, and update expiredAt, thereby terminating the session.
  * @param version
  * @param startIp — where the user was, when hen started the session.
  * @param startBrowserId
  * @param startHeaders — some relevant headers from the request that created the session.
  * @param part1CompId — comparation id, not really secret.
  * @param part2HashForEmbgStorage
  * @param part3HashForDirJs
  * @param part4HashHttpOnly
  * @param part5HashStrict
  */
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
  part2HashForEmbgStorage: Array[i8],
  part3HashForDirJs: Array[i8],
  part4HashHttpOnly: Array[i8],
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
  require(version == 1, "TyE30MFEW25MMR")

  require(jsObjectSize(startHeaders) < MaxSessionHeadersSize, "TyE4MW2AP7J")

  require(part1CompId.length  == SidLengthCharsPart1, s"Len pt 1: ${part1CompId.length}")

  require(part2Hash.length == SidHashLengthBytes, s"Len pt 2 hash: ${part2Hash.length}")
  require(part2ForEmbgStorage.length == SidLengthCharsPart2,
        s"Len pt 2: ${part2ForEmbgStorage.length}")

  require(part3Hash.length == SidHashLengthBytes, s"Len pt 3 hash: ${part3Hash.length}")
  require(part3ForDirJs.forall(_.length == SidLengthCharsPart3),
        s"Len pt 3: ${part3ForDirJs.map(_.length)}")

  require(part4Hash.length == SidHashLengthBytes, s"Len pt 4 hash: ${part4Hash.length}")
  require(part4HttpOnly.forall(_.length == SidLengthCharsPart4),
        s"Len pt 4: ${part4HttpOnly.map(_.length)}")

  require(part5Hash.length == SidHashLengthBytes, s"Len pt 5 hash: ${part5Hash.length}")
  require(part5Strict.forall(_.length == SidLengthCharsPart5),
        s"Len pt 5: ${part5Strict.map(_.length)}")

  if (com.debiki.core.isDevOrTest) {
    import com.debiki.core.Prelude.{hashSha512FirstHalf32Bytes => hash}
    dieIf(!hash(part2ForEmbgStorage).sameElements(part2Hash), "TyEBADHASH02")
    dieIf(part3ForDirJs.exists(!hash(_).sameElements(part3Hash)), "TyEBADHASH03")
    dieIf(part4HttpOnly.exists(!hash(_).sameElements(part4Hash)), "TyEBADHASH04")
    dieIf(part5Strict.exists(!hash(_).sameElements(part5Hash)), "TyEBADHASH05")
  }

  def part1And2: St = part1CompId + part2ForEmbgStorage

  def part3Absent: Bo = part3ForDirJs.isEmpty
  def part4Absent: Bo = part4HttpOnly.isEmpty
  def part4Present: Bo = !part4Absent
  def part5Absent: Bo = part5Strict.isEmpty

  def copyAsMaybeBad: TySessionInDbMaybeBad = TySessionInDbMaybeBad(
        patId = patId,
        createdAt = createdAt,
        deletedAt = None,
        expiredAt = None,
        version = version,
        startIp = startIp,
        startBrowserId = startBrowserId,
        startHeaders = startHeaders,
        part1CompId = part1CompId,
        part2HashForEmbgStorage = part2Hash,
        part3HashForDirJs = part3Hash,
        part4HashHttpOnly = part4Hash,
        part5HashStrict = part5Hash)
}



object TySession {

  val CurVersion = 1

  // A random Base64 char is 6 bits entropy (with a good rand gen).
  val SidEntropyPerChar: i32 = 6
  val SidCharsetBase: i32 = 64

  // These long session ids might seem like a bit overkill — OWASP writes that 64 bits
  // entropy is enough, that's about 11 chars in Base64.  [sid_part1]
  // https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#session-id-entropy
  //
  // However, parts 1, 2 are for embedded comments, and for optionally saving in
  // the localStorage of embedding pages (e.g. blog posts) which is more risky.
  // If indeed parts 1 and 2 get compromised, we can still rely on part 3 alone
  // — it's 144 bits entropy > 64.
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

  val ApiSecretPart1 = "API_SID_PT_1_pad"          // 16 chars
  val ApiSecretPart2 = "API_SID_PT_2_pad_24_abcd"  // 24 chars
  val ApiSecretPart12: St = ApiSecretPart1 + ApiSecretPart2

  // BLAKE3 and SHA-512/256 have 256 bits output size = 32 bytes.
  val SidHashLengthBytes = 32

  // (Part 3, 4, 5 not included in an API call TySession, so the hashes
  // can be set to whatever. But part 2 is always included; the real hash is needed.)
  val DummyHash: Array[i8] = Array.fill(SidHashLengthBytes)(0.asInstanceOf[i8])
  val DummyHashPart2: Array[i8] = hashSha512FirstHalf32Bytes(ApiSecretPart2)

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
          part1CompId = ApiSecretPart1,
          part2ForEmbgStorage = ApiSecretPart2,
          part2Hash = DummyHashPart2,
          part3ForDirJs = None,
          part3Hash = DummyHash,
          part4HttpOnly = None,
          part4Hash = DummyHash,
          part5Strict = None,
          part5Hash = DummyHash,
          isApiCall = true)

}

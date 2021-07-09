package talkyard.server.security

import com.debiki.core._
import play.api.libs.json._
import org.scalactic.{Or, Bad}
import debiki.{JsonUtils => jps}


trait TySessionMaybeBad {
  def sessVer: i32
  def patId: PatId
  def createdAtMs: i64
  def deletedAtMs: i64 = TySession.NotDeleted
  def isEmbedded: Bo
  def wasAutoAuthn: Bo
  def isOldUpgraded: Bo

  def isValid: Bo = deletedAtMs == TySession.NotDeleted
  def isDeleted: Bo = deletedAtMs >= 0

  def toVersionJsonSt: St = {
    var jsonOb = Json.obj(
          "patId" -> patId,
          "createdAtMs" -> createdAtMs)
    if (isDeleted) jsonOb += "deletedAtMs" -> JsNumber(deletedAtMs)
    if (isEmbedded) jsonOb += "isEmb" -> JsTrue
    if (wasAutoAuthn) jsonOb += "wasAuAu" -> JsTrue
    if (isOldUpgraded) jsonOb += "isOldUpgraded" -> JsTrue
    s"v$sessVer:${jsonOb.toString}"
  }
}


case class TySession(
  sessVer: i32,
  patId: PatId,
  createdAtMs: i64,
  isEmbedded: Bo,
  wasAutoAuthn: Bo,
  isOldUpgraded: Bo) extends TySessionMaybeBad {
}


case class TySessionBad(
  sessVer: i32,
  patId: PatId,
  createdAtMs: i64,
  override val deletedAtMs: i64,
  isEmbedded: Bo,
  wasAutoAuthn: Bo,
  isOldUpgraded: Bo) extends TySessionMaybeBad  {

  require(deletedAtMs != TySession.NotDeleted, "TyE306MRE3")
}


object TySession {

  val Version = 1
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
      if (deletedAtMs != NotDeleted) {
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
              isOldUpgraded = isOldUpgraded)
      }
    }
  }

}

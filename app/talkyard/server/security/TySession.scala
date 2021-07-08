package talkyard.server.security

import com.debiki.core._
import play.api.libs.json.Json
import org.scalactic.{Good, Or, Bad}
import debiki.{JsonUtils => jps}




case class TySession(
  sessVer: i32,
  patId: PatId,
  createdAtMs: i64,
  isEmbedded: Bo,
  wasAutoAuthn: Bo,
) {

  def toVersionJsonSt: St = {
    val versionPrefix = s"v$sessVer:"
    val jsonOb = Json.obj(
          "patId" -> patId,
          "createdAtMs" -> createdAtMs,
          "isEmb" -> isEmbedded,
          "wasAuAu" -> wasAutoAuthn)
    versionPrefix + jsonOb.toString
  }

}


object TySession {

  val Version = 1

  def fromSt(sessionSt: St): TySession Or ErrMsg = {
    val versionPrefix = s"v$Version:"
    if (!sessionSt.startsWith(versionPrefix)) return Bad("Bad version prefix")
    val jsonSt = sessionSt drop versionPrefix.length
    jps.tryParse {
    java.io.IOException
      val jVal = jps.parseJson(jsonSt)
      val jOb = jps.asJsObject(jVal, "Session")
      val patId = jps.parseInt32(jOb, "patId")
      val createdAtMs = jps.parseInt64(jOb, "createdAtMs")
      val isEmbedded = jps.parseOptBo(jOb, "isEmb") getOrElse false
      val wasAutoAuthn = jps.parseOptBo(jOb, "wasAuAu") getOrElse false
      TySession(
            sessVer = Version,
            patId = patId,
            createdAtMs = createdAtMs,
            isEmbedded = isEmbedded,
            wasAutoAuthn = wasAutoAuthn)
    }
  }

}

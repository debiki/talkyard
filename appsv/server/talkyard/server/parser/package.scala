package talkyard.server

import com.debiki.core._
import com.debiki.core.Prelude.dieIf
import debiki.JsonUtils.parseOptJsObject
import org.scalactic.{Bad, Good, Or}
import play.api.libs.json.JsObject


/** Parsers and serializers, e.g. from-to JSON or from PASETO token claims.
  *
  * Package name "parser" = "*par*se and *ser*ialize".
  *
  */
package object parser {


  def throwBadInpDataIf(test: Bo, errCode: ErrCode, message: => St): U =
    if (test)
      throwBadInpData(errCode, message = message)

  def throwBadInpData(errCode: ErrCode, message: St) =
    throw new BadInpDataEx(s"$message [$errCode]")


  class BadInpDataEx(message: ErrMsg) extends QuickException {
    override def getMessage: St = message
  }


  /** How to serialize things to JSON — different flags, for backw compat.
    *
    * @param v0_1 — just "id" instead of "pageId" and "ppId".
    */
  case class JsonConf(v0_0: Bo = false, v0_1: Bo = false) {
    dieIf(!v0_0 && !v0_1, "TyE7MRKRD3067A")
    dieIf(v0_0 && v0_1, "TyE7MRKRD3067B")
    def inclOldPageIdField: Bo = v0_0
    def inclOldPpIdField: Bo = v0_0
    def inclOldCategoryIdField: Bo = v0_0
  }

  object JsonConf {
    val v0_0: JsonConf = JsonConf(v0_0 = true)
    val v0_1: JsonConf = JsonConf(v0_1 = true)
  }



  def parseWhichAnonJson(jsOb: JsObject): Opt[WhichAnon] Or ErrMsg = {
    import debiki.JsonUtils.parseOptInt32
    val doAsJsOb = parseOptJsObject(jsOb, "doAsAnon") getOrElse {
      return Good(None)
    }
    val sameAnonId = parseOptInt32(doAsJsOb, "sameAnonId")
    val newAnonStatus = parseOptInt32(doAsJsOb, "newAnonStatus").flatMap(AnonStatus.fromInt)
    if (sameAnonId.isDefined && newAnonStatus.isDefined) {
      Bad("Both sameAnonId and newAnonStatus specified")
    }
    else Good {
      if (sameAnonId.isDefined) {
        Some(WhichAnon.SameAsBefore(sameAnonId.get))
      }
      else if (newAnonStatus.isDefined) {
        Some(WhichAnon.NewAnon(newAnonStatus.get))
      }
      else {
        None
      }
    }
  }
}

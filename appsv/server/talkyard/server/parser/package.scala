package talkyard.server

import com.debiki.core._
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

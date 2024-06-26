package talkyard.server

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.JsonUtils.{parseOptBo, parseOptInt32, parseOptJsObject}
import org.scalactic.{Bad, Good, Or}
import play.api.libs.json.{JsObject, JsValue, JsFalse}


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
  case class JsonConf(v0_0: Bo = false, v0_1: Bo = false, pretty: Bo = false) {
    dieIf(!v0_0 && !v0_1, "TyE7MRKRD3067A")
    dieIf(v0_0 && v0_1, "TyE7MRKRD3067B")

    def inclOldPageIdField: Bo = v0_0
    def inclOldPpIdField: Bo = v0_0
    def inclOldCategoryIdField: Bo = v0_0
  }

  object JsonConf {
    private val _v0_0: JsonConf = JsonConf(v0_0 = true)
    private val _v0_1: JsonConf = JsonConf(v0_1 = true)

    def v0_0(pretty: Bo = false): JsonConf =
      if (!pretty) _v0_0
      else _v0_0.copy(pretty = pretty)

    def v0_1(pretty: Bo = false): JsonConf =
      if (!pretty) _v0_1
      else _v0_1.copy(pretty = pretty)
  }


  val DoAsAnonFieldName = "doAsAnon"


  def parseDoAsAnonField(jOb: JsObject): Opt[WhichAliasId] Or ErrMsg = {
    import play.api.libs.json.JsDefined
    (jOb \ DoAsAnonFieldName) match {
      case jsDef: JsDefined => parseWhichAliasIdJson(jsDef.value)
      case _ => Good(None)
    }
  }


  /** Sync w  parseWhichAliasId(..)  in com.debiki.dao.rdb. */
  def parseWhichAliasIdJson(jsVal: JsValue): Opt[WhichAliasId] Or ErrMsg = {
    val doAsJsOb: JsObject = jsVal match {
      case jOb: JsObject => jOb
      case JsFalse => return Good(Some(WhichAliasId.Oneself))  // [oneself_0_false]
      case x => return Bad(s"Bad persona json, got a: ${classNameOf(x)}  [TyEPERSJSN]")
    }

    val numFields = doAsJsOb.value.size
    if (numFields > 2)
      return Bad(s"Too many which-persona json fields: ${doAsJsOb.toString}  [TyEPERSFIELDS1]")

    val self: Opt[Bo] = parseOptBo(doAsJsOb, "self")
    if (self is true) {
      // Any ambiguities because of unknown fields?
      if (numFields > 1)
        return Bad(s"Too many fields in a { self: true } which-persona json object, this: ${
                  doAsJsOb.toString}  [TyEPERSFIELDS2]")
      return Good(Some(WhichAliasId.Oneself))
    }

    val sameAnonId: Opt[AnonId] = parseOptInt32(doAsJsOb, "sameAnonId")
    val lazyCreate: Bo = parseOptBo(doAsJsOb, "lazyCreate") getOrElse false
    val createNew_tst: Bo = parseOptBo(doAsJsOb, "createNew_tst") getOrElse false

    // Later, when pseudonyms implemented, anonStatus might be absent. [pseudonyms_later]
    val anyAnonStatus: Opt[AnonStatus] = parseOptInt32(doAsJsOb, "anonStatus") map { int =>
      if (int == AnonStatus.NotAnon.IntVal) {
        if (numFields > 1)
          return Bad(s"Anon fields, but anonStatus is NotAnon  [TyEPERS0ANON]")

        return Good(None)
      }

      AnonStatus.fromInt(int) getOrElse {
        return Bad(s"Invalid anonStatus: $int  [TyEPERSANONSTS]")
      }
    }

    anyAnonStatus match {
      case None =>
        if (numFields > 0)
          return Bad("anonStatus missing but there are anon fields  [TyEPERS0ANONSTS]")

        return Good(None)

      case Some(anonStatus) =>
        if (sameAnonId.isDefined) {
          val id = sameAnonId.get
          if (id > Pat.MaxAnonId)
            return Bad(s"Bad anon id: $id, it's > MaxAnonId = ${Pat.MaxAnonId}  [TyEPERSANONID]")

          COULD // remember anonStatus and verify later, when looking up the anon,
          // that it has the same anonStatus. [chk_alias_status]
          Good(Some(WhichAliasId.SameAnon(id)))
        }
        else if (lazyCreate) {
          Good(Some(WhichAliasId.LazyCreatedAnon(anonStatus)))
        }
        else if (createNew_tst) {
          Bad("Unimplemented: createNew_tst  [TyEPERSUNIMP]")
        }
        else {
          Bad("Anon fields missing: Reuse or create anon?  [TyEPERS0FLDS]")
        }
    }
  }
}

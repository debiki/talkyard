/**
 * Copyright (c) 2023 Kaj Magnus Lindberg
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
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

package com.debiki.core

import com.debiki.core.Prelude._

// RENAME  to just Type or CustType
/** A custom type.  Tags and badges, and custom relationships, all have their own
  * custom type.
  *
  * For example, for a tag, its type tells you the name of the tag, e.g. "Priority",
  * and if the tag can have any values and of what type, e.g. TypeValueType.Int32,
  * and then you can tag your posts with Priority: 123.
  */
case class TagType(
  id: TagTypeId,
  refId: Opt[RefId],
  canTagWhat: i32,
  urlSlug: Opt[St],
  dispName: St,
  createdById: PatId,
  wantsValue: Opt[NeverAlways],
  valueType: Opt[TypeValueType],
)(mab: MessAborter) extends HasInt32Id {
  import mab.check
  // The id is NoTagTypeId when getting created, before has an id.
  assert(NoTagTypeId == 0, "TyE603MESGW")
  check(id >= NoTagTypeId, "TyE4MR507")
  check(dispName.isTrimmedNonEmpty, "TyE06MWEP3")
  check(canTagWhat == TagType.CanTagAllPats || canTagWhat == TagType.CanTagAllPosts,
    "TyE4062MW5", s"canTagWhat must be ${TagType.CanTagAllPats} or ${
      TagType.CanTagAllPosts}")

  urlSlug foreach { slug =>  // [dupl_slug_checks]
    check(slug.length <= PagePath.MaxSlugLength,
      "TyETYPESLUGLEN", s"Too long type slug — max ${PagePath.MaxSlugLength} characters")
    check(PagePath.isOkaySlug(slug),
      "TyETYPESLUGCHARS", s"Bad slug: '$slug', should be like: 'some-type-name'")
  }

  check(wantsValue.forall(_.isNeverMaybeCanContinue) || valueType.isDefined,
    "TyETYPEVAL0TYPE", "Tag wants value, but value type not specified")
}


object TagType {
  val CanTagAllPats = 7
  val CanTagAllPosts = 56
}



sealed abstract class TypeValueType(val IntVal: i32) { def toInt: i32 = IntVal }


object TypeValueType {

  // Sync w db constr: value_type_d_c_lt3000_for_now.
  // Sync w db constr: value_type_d_c_gtem3_nz
  // Sync w Typescript enum TypeValueType.
  // case object BoolTrue extends TypeValueType(-2)
  // case object BoolFalse extends TypeValueType(-1)
  case object Int32 extends TypeValueType(1)
  case object Flt64 extends TypeValueType(5)
  case object StrKwd extends TypeValueType(17)

  def fromInt(value: i32): Opt[TypeValueType] = Some(value match {
    case Int32.IntVal => Int32
    case Flt64.IntVal => Flt64
    case StrKwd.IntVal => StrKwd
    case _ => return None
  })

  def fromStr_apiV0(value: St): Opt[TypeValueType] = Some(value match {
    case "Int32" => Int32
    case "Flt64" => Flt64
    case "StrKwd" => StrKwd
    case _ => return None
  })
}



/** Can check if the custom value of a tag/badge/relationship is valid.
  * E.g. if the value type is Int32, then the valInt32 field is defined.
  */
trait MaybeValue {
  def valType: Opt[TypeValueType]
  def valInt32: Opt[i32]
  def valFlt64: Opt[f64]
  def valStr: Opt[St]

  protected def _anyValueAndValueTypeErr: Opt[ErrMsgCode] = {
    // Sync w db constr tags_c_valtype_has_val. The db constraint is intentionally
    // more lax, so we won't need to run db migrations all the time (to relax
    // any constraint).
    val theType = valType getOrElse {
      return {
        if (_numValueFieldsSet == 0) None
        else Some(ErrMsgCode(
          "A value specified, but no value type", "TyEVAL0TYPE"))
      }
    }
    val isOk = theType match {
      case TypeValueType.Int32 => valInt32.nonEmpty && _numValueFieldsSet == 1
      case TypeValueType.Flt64 => valFlt64.nonEmpty && _numValueFieldsSet == 1
      case TypeValueType.StrKwd => valStr.nonEmpty && _numValueFieldsSet == 1
    }
    return {
      if (isOk) None
      else if (_numValueFieldsSet == 0) Some(ErrMsgCode(
        "A value type specified, but no value", "TyEVALTYPE0VAL"))
      else Some(ErrMsgCode(
        "Too many value fields specified, need just one", "TyETYPE2MANYVALS"))
    }
  }

  private def _numValueFieldsSet: i32 =
    valInt32.oneIfDefined + valFlt64.oneIfDefined + valStr.oneIfDefined
}

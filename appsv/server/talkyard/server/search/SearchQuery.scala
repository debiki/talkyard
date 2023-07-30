/**
 * Copyright (c) 2016, 2023 Kaj Magnus Lindberg
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

package talkyard.server.search

import com.debiki.core._
import com.debiki.core.Prelude._


case class SearchQuery(
  fullTextQuery: St, // RENAME to rawQuery
  queryWithoutParams: St,
  tagTypeNames: Set[St],
  tagTypeIds: Set[TagTypeId],
  tagValComps: Seq[(TagType, CompOpVal)],
  notTagTypeNames: Set[St],
  notTagTypeIds: Set[TagTypeId],
  catNames: Set[St],
  catIds: Set[CatId],
  authorUsernames: Set[St],
  authorIds: Set[PatId],
  sortOrder: ImmSeq[SortHitsBy],
  warnings: Vec[ErrMsgCode],
) {

  require(queryWithoutParams.trim == queryWithoutParams, "TyE0TRIMD6372")
  require(tagTypeNames.forall(_.nonEmpty), "TyESE0PARAMS01")
  // (Some types might not have been found, then, fewer ids.)
  require(tagTypeNames.size >= tagTypeIds.size, "TyESEPARMSIZE01")
  require(tagTypeNames.size >= tagValComps.size, "TyESEPARMSIZE07")
  require(notTagTypeNames.forall(_.nonEmpty), "TyESE0PARAMS02")
  require(notTagTypeNames.size >= notTagTypeIds.size, "TyESEPARMSIZE02")
  require(catNames.forall(_.nonEmpty), "TyESE0PARAMS03")
  require(catNames.size >= catIds.size, "TyESEPARMSIZE03")
  require(authorUsernames.forall(_.nonEmpty), "TyESE0PARAMS04")
  require(authorUsernames.size >= authorIds.size, "TyESE0PARAMS04")

  def isEmpty: Bo =
    queryWithoutParams.isEmpty && catIds.isEmpty &&
         tagTypeIds.isEmpty && tagValComps.isEmpty && authorIds.isEmpty

  /** For now, quick fix, for tests — they still expects a tag type id, not a tag type. */
  def typeIdComps: Seq[(TagTypeId, CompOpVal)] = tagValComps map { case (tagType, compOpVal) =>
    tagType.id -> compOpVal
  }
}


case class CompOpVal(compOp: CompOp, compWith: CompVal)


sealed trait CompVal {
  def value: Any
  def valueAsObj: Object = value.asInstanceOf[Object]
}

object CompVal {
  case class Int32(value: i32) extends CompVal
  case class Flt64(value: f64) extends CompVal
  case class StrKwd(value: St) extends CompVal
}



sealed abstract class CompOp(val Op: St) {
  def op: St = Op
}

object CompOp {
  case object Eq extends CompOp("=")
  case object Lt extends CompOp("<")
  case object Lte extends CompOp("<=")
  case object Gt extends CompOp(">")
  case object Gte extends CompOp(">=")

  def fromStr(st: St): Opt[CompOp] = Some(st match {
    case Eq.Op => Eq
    case Lt.Op => Lt
    case Lte.Op => Lte
    case Gt.Op => Gt
    case Gte.Op => Gte
    case _ => return None
  })
}


sealed abstract class SortHitsBy { def asc: Bo; def desc: Bo = !asc }

object SortHitsBy {
  case class TagVal(tagType: TagType, asc: Bo) extends SortHitsBy {
    require(tagType.valueType.isDefined, "TyE0TAGVAL5928")
    // But  wantsValue.isEmpty is ok. [no_wantsValue]
  }
}


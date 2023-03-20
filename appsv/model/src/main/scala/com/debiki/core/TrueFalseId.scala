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

// RENAME this file to   TrueId.scala
sealed trait TrueId {
  def curId: PatId
  def anyTrueId: Opt[MembId]

  require(curId != 0, "curId is 0 [TyE8SKFWW5]")
  require(anyTrueId.forall(_ > LowestTalkToMemberId),
        o"""Bad ids: $this, anyTrueId is for a guest or anon — it's < 0.
        But guests and anons can't have their own anons. [TyEANONWANON]""")

  final def trueId: PatId = anyTrueId getOrElse curId
  final def isGuestOrAnon: Bo = curId <= MaxGuestOrAnonId

  /* Guests cannot have true ids, only anonyms can. */
  final def isGuest: Bo = isGuestOrAnon && anyTrueId.isEmpty

  // If an anon is made unrecoverably-anon, then, its true id could be set
  // to -3 = UnknownUserId? Then, we'd still know it's an anon (not a guest).
  final def isAnon: Bo = isGuestOrAnon && anyTrueId.isDefined

  /** Pseudonyms are "real" accounts: their names can be edited, there can be a bio,
    * etc, and thus they have ids > 0, unlike guests and anons which have ids < 0.  */
  final def isPseudonym: Bo = LowestTalkToMemberId <= curId && anyTrueId.isDefined

}


object TrueId {
  def apply(curId: PatId, anyTrueId: Opt[MembId] = None): TrueId =
    TrueIdImpl(curId, anyTrueId = anyTrueId)

  def forMember(membId: MembId): TrueId = {
    dieIf(membId < Pat.LowestMemberId, "TyE0MEMBID0357", s"Member id < 0, not allowed: $membId")
    TrueIdOnly(membId)
  }
}


private case class TrueIdImpl(curId: PatId, anyTrueId: Opt[MembId] = None) extends TrueId


/** For doing things where one may not use an anonym or pseudonym. */
case class TrueIdOnly(curId: PatId) extends TrueId {
  def anyTrueId: Opt[MembId] = None
}



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


sealed trait TrueId {
  def curId: PatId
  def anyTrueId: Opt[MembId] = None

  require(curId != 0, "curId is 0 [TyE8SKFWW5]")
  require(anyTrueId.forall(_ > LowestTalkToMemberId),
        o"""Bad ids: $this, anyTrueId is for a guest or anon — it's < 0.
        But guests and anons can't have their own anons. [TyEANONWANON]""")

  final def toTrueIdOnly: Opt[TrueIdOnly] = Some {
    if (anyTrueId isSomethingButNot curId) return None
    TrueIdOnly(curId)
  }

  final def trueId: PatId = anyTrueId getOrElse curId
  final def isGuestOrAnon: Bo = curId <= MaxGuestOrAnonId

  /* Guests cannot have true ids, only anonyms can. */
  final def isGuest: Bo = curId <= MaxGuestOrAnonId && anyTrueId.isEmpty

  // If an anon is made unrecoverably-anon, then, its true id could be set
  // to -3 = UnknownUserId? Then, we'd still know it's an anon (not a guest).
  final def isAnon: Bo = curId <= MaxGuestOrAnonId && anyTrueId.isDefined

  /** Pseudonyms are "real" accounts: their names can be edited, there can be a bio,
    * etc, and thus they have ids > 0 (unlike guests and anons, < 0).  */
  final def isPseudonym: Bo = LowestTalkToMemberId <= curId && anyTrueId.isDefined
 }

CONT_HERE
  /** Assert that the id is a guest id. */
  final def curIdCheckGuest__not_in_use__remove: PatId = {
    dieIf(curId > MaxGuestOrAnonId || anyTrueId.isDefined, "TyE0GUESTID",
          s"Not a guest id: $this")
    curId
  }

  /*
  final def isSameAs__not_in_use__remove(other: TrueFalseId): Bo = {
    if (trueId != other.trueId)
      return false

    // Now we know it's the same person. But pseudonyms and anonyms
    // aren't always considered the same ...

    // Two different anons, even if they're for the same preson, are never considered
    // the same. Because 1) that'd just make me confused, and also, 2) the
    // software doesn't let you "switch to" an anonym account, instead
    // you keep doing things using your main account, Ty just sets
    // the author or upvoter to an anonym, when you want to be anonymous —
    // in fact, if both this and other are anonyms, there is? might-be? a bug.
    if (isAnon && other.isAnon) {
      warnDevDie("TyECMP2ANONS", o"""Checking if two different anons are the same
            — should never need to do that?""")
      return false
    }

    // Two different pseudonyms are never the same, even if they're for the same
    // person. — Otherwise there'd be a risk that one did sth using the wrong
    // pseudonym? (If the permission system allowed this.)
    if (isPseudonym && other.isPseudonym && curId != other.curId)
      return false

    // To do something as a pseudonym, one needs to switch to that account.
    // And to do sth using one's main account, one needs to switch back.
    if (isPseudonym != other.isPseudonym)
      return false

    // For now, pseudonyms can't use anons. Maybe allow later (would be the same
    // as using an anon via one's main account) but for now, feels confusing.
    if (isPseudonym && other.isAnon || isAnon && other.isPseudonym)
      return false

    // This should mean one of:
    // - Pat is doing sth as henself,
    // - Pat is doing sth as an anonym (via hens main account, not via a pseudonym)
    // - Pat has switched to a pseudonym and is doing things as that pseudonym.
    true
  } */
}


object TrueId {
  def apply(curId: PatId, anyTrueId: Opt[MembId] = None): TrueId =
    TrueIdImpl(curId, anyTrueId = anyTrueId)

  def of___not_needed_delete(pat: Pat): TrueId = pat match {
    case a: Anonym =>
      TrueId(a.id, anyTrueId = Some(a.anonForPatId))
    case _ =>
      TrueIdOnly(pat.id)
  }

  def forMember(membId: MembId): TrueId = {
    dieIf(membId < Pat.LowestMemberId, "TyE0MEMBID0357", s"Member id < 0, not allowed: $membId")
    TrueIdOnly(membId)
  }
}


private case class TrueIdImpl (
  curId: PatId,
  override val anyTrueId: Opt[MembId] = None,
) extends TrueId {

  private def andCurIdIs: St = s" (and curId: $curId)"
}



/** For doing things where one may not use an anonym or pseudonym. */
case class TrueIdOnly(curId: PatId) extends TrueId {
}


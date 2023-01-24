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


sealed trait TrueFalseId {
  def curId: PatId
  def anyTrueId: Opt[MembId] = None
  def oldFalseId: Opt[PatId] = None

  require(curId != 0, "curId is 0 [TyE8SKFWW5]")
  require(anyTrueId.forall(_ > LowestTalkToMemberId),
        o"""Bad ids: $this, anyTrueId is for a guest or anon — it's < 0.
        But guests and anons can't have their own anons. [TyEANONWANON]""")

  final def trueId: PatId = anyTrueId getOrElse curId
  final def isGuestOrAnon: Bo = curId <= MaxGuestOrAnonId

  final def isGuest: Bo = curId <= MaxGuestOrAnonId && anyTrueId.isEmpty

  // If an anon is made unrecoverably-anon, then, its true id could be set
  // to -3 = Unknown? Then, we'd still know it's an anon (not a guest).
  final def isAnon: Bo = curId <= MaxGuestOrAnonId && anyTrueId.isDefined

  final def isPseudonym: Bo = LowestTalkToMemberId <= curId && anyTrueId.isDefined

  /** Assert that the id is indeed for a member (but not a guest or anon). */
  final def curIdCheckMember: MembId = {  // IfBadAbortReq, default IfBadDie?
    dieIf(curId < Pat.LowestNormalMemberId, "TyE0MEMBID", s"Not a member id: $this")
    dieIf(anyTrueId.isDefined, "TyEPSEUDON", s"Pseudonyms not yet supported: $this")
    curId
  }

  /** Assert that the id is a guest id. */
  final def curIdCheckGuest: PatId = {
    dieIf(curId > MaxGuestOrAnonId || anyTrueId.isDefined, "TyE0GUESTID",
          s"Not a guest id: $this")
    curId
  }

  final def isSameAs(other: TrueFalseId): Bo = {
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
  }
}


object TrueFalseId {
  def apply(curId: PatId, anyTrueId: Opt[MembId] = None, oldFalseId: Opt[PatId] = None)
        : TrueFalseId =
    TrueFalseIdImpl(curId, anyTrueId = anyTrueId, oldFalseId = oldFalseId)

  def of(pat: Pat): TrueFalseId = pat match {
    case a: Anonym =>
      TrueFalseId(a.id, anyTrueId = Some(a.anonForPatId))
    case _ =>
      TrueIdOnly(pat.id)
  }
}


private case class TrueFalseIdImpl (
  curId: PatId,
  override val anyTrueId: Opt[MembId] = None,
  override val oldFalseId: Opt[PatId] = None,
) extends TrueFalseId {

  require(curId > MaxGuestOrAnonId || oldFalseId.isEmpty,
        o"""Anons or guests (ids < $MaxGuestOrAnonId) cannot have their own anons
        or pseudonyms, but oldFalseId is: $oldFalseId rather than None, and curId
        is: $curId which is < $MaxGuestOrAnonId  [TyEANONANON]""")
  require(oldFalseId.forall(id => id <= MaxGuestOrAnonId || LowestTalkToMemberId <= id),
        s"Bad oldFalseId: $oldFalseId $andCurIdIs [TyE3MWKJR05]")
  require(anyTrueId.isEmpty || oldFalseId.isEmpty,
        s"Got both anyTrueId: $anyTrueId and oldFalseId: ${oldFalseId
        } $andCurIdIs [TyE7RSKSEWJ35]")

  private def andCurIdIs: St = s" (and curId: $curId)"
}


/** Audit log, review tasks and spam check tasks never see any old-false-id. */
case class TrueId(curId: PatId, override val anyTrueId: Opt[MembId] = None)
  extends TrueFalseId {
}


/** For doing things where one may not use an anonym or pseudonym. */
case class TrueIdOnly(curId: PatId) extends TrueFalseId {
}


/* object TrueIdConversions {
  import scala.language.implicitConversions
  implicit def fromTrueIdToCurId(id: TrueId): PatId = id.curId
  implicit def fromTrueIdToCurIdBigDec(id: TrueId): BigDecimal = BigDecimal(id.curId)
  implicit def fromTrueFalseIdToCurId(id: TrueFalseId): PatId = id.curId
  implicit def fromTrueFalseIdToCurIdBigDec(id: TrueFalseId): BigDecimal = BigDecimal(id.curId)
} */



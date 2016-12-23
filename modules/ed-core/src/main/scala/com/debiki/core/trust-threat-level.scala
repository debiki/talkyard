/**
 * Copyright (c) 2016 Kaj Magnus Lindberg
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
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

package com.debiki.core



sealed abstract class TrustLevel(val IntVal: Int) { def toInt = IntVal }

/** The same as Discourse's trust levels. */
object TrustLevel {
  case object New extends TrustLevel(1)
  case object Basic extends TrustLevel(2)
  case object Member extends TrustLevel(3) // rename to Full/Normal/Complete/Common-Member? or NowAndThenMember? OccasionalMember? Or just Occasional.
  case object Regular extends TrustLevel(4)
  case object CoreMember extends TrustLevel(5)

  def fromInt(value: Int): Option[TrustLevel] = Some(value match {
    case TrustLevel.New.IntVal => TrustLevel.New
    case TrustLevel.Basic.IntVal => TrustLevel.Basic
    case TrustLevel.Member.IntVal => TrustLevel.Member
    case TrustLevel.Regular.IntVal => TrustLevel.Regular
    case TrustLevel.CoreMember.IntVal => TrustLevel.CoreMember
    case _ => return None
  })
}



sealed abstract class ThreatLevel(val IntVal: Int) {
  def toInt = IntVal
  def isSevereOrWorse = false
}

object ThreatLevel {

  //case object SuperSafe extends ThreatLevel(1)

  //case object SeemsSafe extends ThreatLevel(2)

  /** The default. */
  case object HopefullySafe extends ThreatLevel(3)

  /** All comments will be published directly, but also added to the moderation queue for review. */
  case object MildThreat extends ThreatLevel(4)

  /** Comments won't be published until they've been approved by a moderator. */
  case object ModerateThreat extends ThreatLevel(5)

  /** May not post any comments at all. */
  case object SevereThreat extends ThreatLevel(6) {
    override def isSevereOrWorse = true
  }

  def fromInt(value: Int): Option[ThreatLevel] = Some(value match {
    case ThreatLevel.HopefullySafe.IntVal => ThreatLevel.HopefullySafe
    case ThreatLevel.MildThreat.IntVal => ThreatLevel.MildThreat
    case ThreatLevel.ModerateThreat.IntVal => ThreatLevel.ModerateThreat
    case ThreatLevel.SevereThreat.IntVal => ThreatLevel.SevereThreat
    case _ => return None
  })
}


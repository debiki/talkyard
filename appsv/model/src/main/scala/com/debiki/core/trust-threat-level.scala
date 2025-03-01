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

import com.debiki.core.ThreatLevel.{MildThreat, SevereThreat}

trait HasInt32 {
  def toInt: i32
}

/** Works only up to Core Member, but it's sometimes better to think of mods & admins
  * as their own trust levels. — Try to start using TrustLevel2 instead.
  *
  * But don't set anyone's trust level directly to mod or admin — instead, those are flags:
  * an admin doesn't have to also be a moderator. But the admin's trust level is higher.
  * See: `effectiveTrustLevel2`.
  */
sealed abstract class TrustLevel(val IntVal: Int) extends HasInt32 {
  def toInt: Int = IntVal

  def isBelow(other: TrustLevel): Bo =
    toInt < other.toInt

  def isAbove(other: TrustLevel): Bo =
    toInt > other.toInt

  def isAtMost(level: TrustLevel): Bo =
    toInt <= level.toInt

  def isAtLeast(level: TrustLevel): Bo =
    toInt >= level.toInt

  def isStrangerOrNewMember: Bo = IntVal <= TrustLevel.NewMember.IntVal
}


/** This works also with mods & admins — but TrustLevel (without 2) works only
  * up to Core Member, which is sometimes annoying.
  */
sealed abstract class TrustLevel2(val IntVal2: i32)
    extends TrustLevel(if (IntVal2 > 6) 6 /* CoreMember is max */ else IntVal2)
    with HasInt32 {

  def toInt2: i32 = IntVal2

  def isBelow2(other: TrustLevel2): Bo =
    toInt2 < other.toInt2

  def isAbove2(other: TrustLevel2): Bo =
    toInt2 > other.toInt2

  def isAtMost2(level: TrustLevel2): Bo =
    toInt2 <= level.toInt2

  def isAtLeast2(level: TrustLevel2): Bo =
    toInt2 >= level.toInt2
}


/** The same as Discourse's trust levels, plus one more level: the helpful member,
  *
  * Discourse's trust levels:
  * https://meta.discourse.org/t/what-do-user-trust-levels-do/4924/6
  *
  * About the additional trust level:
  * https://meta.discourse.org/t/a-new-trust-level-the-helpful-member/56894
  */
object TrustLevel {
  case object Stranger extends TrustLevel2(0)   ; REFACTOR // bump all 1, so won't start at 0
                                      // 0 is easily buggy-mistaken for undefined, in Javascript.
  //se object [StrangerWithSecret] — if someone doesn't yet have a real account, but via a secret link  [new_trust_levels]
  //      has been invited to look at an otherwise private discussion?
  //      Or has been invited to a private community, and then can view "public" topics, there.
  //      Should id be < 0? And if creating a real account, gets a > 0 id?
  //      Maybe different secret links, some let one create a real account,
  //      others just lets one view sth, for a limited time maybe. And could have a link-max-use-count.

  case object NewMember extends TrustLevel2(1)   // has created a real account
  case object BasicMember extends TrustLevel2(2)
  case object FullMember extends TrustLevel2(3)

  //se object [GoodMember] extends TrustLevel(_)   — the software promotes up to here only
  //       or DecentMember or WellBehavedMember or Soft(ware)Trusted or BitTrustedMember?
  //se object HelpfulMember extends TrustLevel2(_)  <—— maybe this is best/least-bad after all?

  case object TrustedMember extends TrustLevel2(4)  // requires manual review, maybe not much but a bit
  case object RegularMember extends TrustLevel2(5)   ; RENAME // to Trusted Regular, no, remove, and let visit frequency be another dimension, don't conflate with trust level
  //se object TrustedVeteran extends TrustLevel(_) — trusted members who have been around for long,
  //                and know the community and domain inside and out?
  //                (Most people who have been along for long, would be FullMembers
  //                or GoodMembers,  not Trusted-*.)
  case object CoreMember extends TrustLevel2(6)

  // + Mod, [mods_are_core_membs][new_trust_levels]
  // + ModOfMods (can resolve disagreements between mods)
  // + Admin,
  // (AdminOfAdmins — the site owner is *by default* AdminOfAdmins? Other admins cannot depose hen)

  // But let is-site-owner be a flag, not visible to others. Not  trust level. — Better not
  // needlessly show which account to hack, to try to take control over the site.


  // Not real trust levels, but sometimes simpler to remember just one digit, say 7,
  // instead of 3 things: level + isStaff + isModerator.
  REFACTOR // Actually, *do* change to real trust levels — see Mod, ModOfMods, Admin above.
  val StrangerDummyLevel = 0  // But there's already a Stranger level above?

  val StaffDummyLevel = 7
  case object Staff extends TrustLevel2(7)

  val AdminDummyLevel = 8
  case object Admin extends TrustLevel2(8)

  def fromOptInt(value: Opt[i32]): Opt[TrustLevel] = value.flatMap(fromInt)

  def fromInt(value: Int): Option[TrustLevel] = Some(value match {
    case TrustLevel.Stranger.IntVal => TrustLevel.Stranger
    case TrustLevel.NewMember.IntVal => TrustLevel.NewMember
    case TrustLevel.BasicMember.IntVal => TrustLevel.BasicMember
    case TrustLevel.FullMember.IntVal => TrustLevel.FullMember
    case TrustLevel.TrustedMember.IntVal => TrustLevel.TrustedMember
    case TrustLevel.RegularMember.IntVal => TrustLevel.RegularMember
    case TrustLevel.CoreMember.IntVal => TrustLevel.CoreMember
    case _ => return None
  })

  def fromBuiltInGroupId(groupId: Int): Option[TrustLevel] = Some(groupId match {
    case Group.EveryoneId => TrustLevel.Stranger
    case Group.AllMembersId => TrustLevel.NewMember
    case Group.BasicMembersId => TrustLevel.BasicMember
    case Group.FullMembersId => TrustLevel.FullMember
    case Group.TrustedMembersId => TrustLevel.TrustedMember
    case Group.RegularMembersId => TrustLevel.RegularMember
    case Group.CoreMembersId => TrustLevel.CoreMember
    case _ =>
      // Skip: Group.ModeratorsId, AdminsId, because StrangerDummyLevel and
      // moderators and admins aren't trust levels. [COREINCLSTAFF]
      // Staff members can have trust level just Basic or Core Member or whatever.
      // Edit: Now there's TrustLevel2 with Staff and Admin trust levels,
      // but right now, this works fine anyway.
      return None
  })

  def minOfAny(a: Opt[TrustLevel], b: Opt[TrustLevel]): Opt[TrustLevel] = {
    if (a.isEmpty) return b
    if (b.isEmpty) return a
    if (a.get.toInt < b.get.toInt) a else b
  }

  def maxOfAny(a: Opt[TrustLevel], b: Opt[TrustLevel]): Opt[TrustLevel] = {
    if (a.isEmpty) return b
    if (b.isEmpty) return a
    if (a.get.toInt > b.get.toInt) a else b
  }
}



/** How likely someone is to cause troubles, e.g. post toxic comments
  * or start a flame war.
  */
sealed abstract class ThreatLevel(val IntVal: Int) {
  def toInt: Int = IntVal
  def isSevereOrWorse: Boolean = toInt >= SevereThreat.toInt
  def isThreat: Boolean = toInt >= MildThreat.toInt
}


object ThreatLevel {

  case object SuperSafe extends ThreatLevel(1)

  case object SeemsSafe extends ThreatLevel(2)

  /** The default. */
  case object HopefullySafe extends ThreatLevel(3)

  /** All comments will be published directly, but also added to the moderation queue for review. */
  case object MildThreat extends ThreatLevel(4)

  /** Comments won't be published until they've been approved by a moderator.
    *
    * At most N comments (say, 5) may be pending review (if more, additional post
    * are rejected) — not impl though.
    *
    * Ought to automatically find these threat users: those whose posts
    * get classified as spam, by spam check services. And/or whose posts the
    * staff rejects and deletes. Partly impl, see [DETCTHR].
    */
  case object ModerateThreat extends ThreatLevel(5)

  /** May not post any comments at all. */
  case object SevereThreat extends ThreatLevel(6)

  def fromInt(value: Int): Option[ThreatLevel] = Some(value match {
    case ThreatLevel.HopefullySafe.IntVal => ThreatLevel.HopefullySafe
    case ThreatLevel.MildThreat.IntVal => ThreatLevel.MildThreat
    case ThreatLevel.ModerateThreat.IntVal => ThreatLevel.ModerateThreat
    case ThreatLevel.SevereThreat.IntVal => ThreatLevel.SevereThreat
    case _ => return None
  })
}


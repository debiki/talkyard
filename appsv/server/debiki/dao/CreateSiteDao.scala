/**
 * Copyright (c) 2015 Kaj Magnus Lindberg
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

package debiki.dao

import com.debiki.core._
import com.debiki.core.Prelude._



/** Create-new-site helper methods.
  */
object CreateSiteDao {  RENAME // but to what. & move, but to where?


  def createSystemUser(tx: SiteTransaction): Unit = {
    createSysUserImpl(SystemUserId, fullName = SystemUserFullName, username = SystemUserUsername, tx)
  }

  def createSysbotUser(tx: SiteTransaction): Unit = {
    createSysUserImpl(SysbotUserId, fullName = SysbotUserFullName, username = SysbotUserUsername, tx)
  }

  def createSysUserImpl(id: UserId, fullName: String, username: String, tx: SiteTransaction): Unit = {
    val sysUser = UserInclDetails(
      id = id,
      ssoId = None,
      fullName = Some(fullName),
      username = username,
      createdAt = tx.now,
      isApproved = None,
      reviewedAt = None,
      reviewedById = None,
      primaryEmailAddress = "",
      emailNotfPrefs = EmailNotfPrefs.DontReceive,
      emailVerifiedAt = None,
      summaryEmailIntervalMins = Some(SummaryEmails.DoNotSend),
      isAdmin = true)
    tx.insertMember(sysUser)
    tx.insertUsernameUsage(UsernameUsage(
      sysUser.usernameLowercase,  // [CANONUN]
      inUseFrom = tx.now, userId = sysUser.id))
    tx.upsertUserStats(UserStats.forNewUser(
      id, firstSeenAt = tx.now, emailedAt = None))
  }


  def createUnknownUser(tx: SiteTransaction): Unit = {
    tx.createUnknownUser()
    tx.upsertUserStats(UserStats.forNewUser(
      UnknownUserId, firstSeenAt = tx.now, emailedAt = None))
  }


  def makeDefaultGroups(now: When): Vector[Group] = {
    import Group._

    // Don't let anonymous blog commenters upload anything, not even images,
    // by default.
    val Everyone = Group(
      EveryoneId, "everyone", Some("Everyone"), createdAt = now) // , grantsTrustLevel = Stranger)

    // But people who create a real account can upload images.
    val New = Group(
      AllMembersId, "all_members", Some("All Members"), createdAt = now, // , grantsTrustLevel = Some(TrustLevel.NewMember))
      perms = PatPerms.create(IfBadDie,
            maxUploadBytes = Some(1 * Mebibyte),
            allowedUplExts = Some("jpeg jpg png gif")))

    val Basic = Group(
      BasicMembersId, "basic_members", Some("Basic Members"), createdAt = now) // , grantsTrustLevel = Some(TrustLevel.BasicMember))
    val Full = Group(
      FullMembersId, "full_members", Some("Full Members"), createdAt = now) // , grantsTrustLevel = Some(TrustLevel.FullMember))
    val Trusted = Group(
      TrustedMembersId, "trusted_members", Some("Trusted Members"), createdAt = now) // , grantsTrustLevel = Some(TrustLevel.TrustedMember))
    val Regular = Group(
      // RENAME to  "Trusted Regulars"  [RENREGLS]
      RegularMembersId, "regular_members", Some("Regular Members"), createdAt = now) // , grantsTrustLevel = Some(TrustLevel.RegularMember))
    val Core = Group(
      CoreMembersId, "core_members", Some("Core Members"), createdAt = now) // , grantsTrustLevel = Some(TrustLevel.CoreMember))
    val Staff = Group(
      StaffId, "staff", Some("Staff"), createdAt = now) // , grantsTrustLevel = None)
    val Moderators = Group(
      ModeratorsId, "moderators", Some("Moderators"), createdAt = now) // , grantsTrustLevel = None)
    val Admins = Group(
      AdminsId, "admins", Some("Admins"), createdAt = now) // , grantsTrustLevel = None)

    Vector(
      Everyone, New, Basic, Full, Trusted, Regular, Core, Staff, Moderators, Admins)
  }


  def createDefaultGroupsAndPermissions(tx: SiteTransaction): Unit = {
    val groups = makeDefaultGroups(tx.now)
    groups foreach { g =>
      insertGroupAndUsernameUsage(g, tx)
    }
  }


  private def insertGroupAndUsernameUsage(group: Group, tx: SiteTransaction): Unit = {
    tx.insertGroup(group)
    tx.insertUsernameUsage(UsernameUsage(
      usernameLowercase = group.theUsername.toLowerCase,  // [CANONUN]
      tx.now, userId = group.id))
  }

}


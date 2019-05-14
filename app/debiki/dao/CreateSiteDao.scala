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



/** Create-new-site helper methods.
  */
object CreateSiteDao {  RENAME // but to what. & move, but to where?


  def createSystemUser(tx: SiteTransaction) {
    createSysUserImpl(SystemUserId, fullName = SystemUserFullName, username = SystemUserUsername, tx)
  }

  def createSysbotUser(tx: SiteTransaction) {
    createSysUserImpl(SysbotUserId, fullName = SysbotUserFullName, username = SysbotUserUsername, tx)
  }

  def createSysUserImpl(id: UserId, fullName: String, username: String, tx: SiteTransaction) {
    val sysUser = UserInclDetails(
      id = id,
      externalId = None,
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


  def createUnknownUser(tx: SiteTransaction) {
    tx.createUnknownUser()
    tx.upsertUserStats(UserStats.forNewUser(
      UnknownUserId, firstSeenAt = tx.now, emailedAt = None))
  }


  def createDefaultGroupsAndPermissions(tx: SiteTransaction) {
    import Group._
    val now = tx.now

    val Everyone = Group(
      EveryoneId, "everyone", Some("Everyone"), createdAt = now, grantsTrustLevel = None)
    val New = Group(
      AllMembersId, "all_members", Some("All Members"), createdAt = now, grantsTrustLevel = Some(TrustLevel.NewMember))
    val Basic = Group(
      BasicMembersId, "basic_members", Some("Basic Members"), createdAt = now, grantsTrustLevel = Some(TrustLevel.BasicMember))
    val Full = Group(
      FullMembersId, "full_members", Some("Full Members"), createdAt = now, grantsTrustLevel = Some(TrustLevel.FullMember))
    val Trusted = Group(
      TrustedMembersId, "trusted_members", Some("Trusted Members"), createdAt = now, grantsTrustLevel = Some(TrustLevel.TrustedMember))
    val Regular = Group(
      // RENAME to  "Trusted Regulars"  [RENREGLS]
      RegularMembersId, "regular_members", Some("Regular Members"), createdAt = now, grantsTrustLevel = Some(TrustLevel.RegularMember))
    val Core = Group(
      CoreMembersId, "core_members", Some("Core Members"), createdAt = now, grantsTrustLevel = Some(TrustLevel.CoreMember))
    val Staff = Group(
      StaffId, "staff", Some("Staff"), createdAt = now, grantsTrustLevel = None)
    val Moderators = Group(
      ModeratorsId, "moderators", Some("Moderators"), createdAt = now, grantsTrustLevel = None)
    val Admins = Group(
      AdminsId, "admins", Some("Admins"), createdAt = now, grantsTrustLevel = None)

    insertGroupAndUsernameUsage(Everyone, tx)
    insertGroupAndUsernameUsage(New, tx)
    insertGroupAndUsernameUsage(Basic, tx)
    insertGroupAndUsernameUsage(Full, tx)
    insertGroupAndUsernameUsage(Trusted, tx)
    insertGroupAndUsernameUsage(Regular, tx)
    insertGroupAndUsernameUsage(Core, tx)
    insertGroupAndUsernameUsage(Staff, tx)
    insertGroupAndUsernameUsage(Moderators, tx)
    insertGroupAndUsernameUsage(Admins, tx)
  }


  private def insertGroupAndUsernameUsage(group: Group, tx: SiteTransaction) {
    tx.insertGroup(group)
    tx.insertUsernameUsage(UsernameUsage(
      usernameLowercase = group.theUsername.toLowerCase,  // [CANONUN]
      tx.now, userId = group.id))
  }

}


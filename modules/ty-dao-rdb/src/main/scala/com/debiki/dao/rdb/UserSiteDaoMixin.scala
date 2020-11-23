/**
 * Copyright (C) 2011-2015 Kaj Magnus Lindberg (born 1979)
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

package com.debiki.dao.rdb

import com.debiki.core._
import com.debiki.core.Prelude._
import com.debiki.core.Participant.{LowestNonGuestId, LowestAuthenticatedUserId}
import _root_.java.{util => ju, io => jio}
import java.{sql => js}
import scala.collection.immutable
import scala.collection.mutable.ArrayBuffer
import Rdb._
import RdbUtil._


/** Creates and updates users and identities.  Docs [8KFUT20].
  */
trait UserSiteDaoMixin extends SiteTransaction {  // RENAME; QUICK // to UserSiteTxMixin
  self: RdbSiteTransaction =>

  val IsOwnerOrStaff = o"""(
     is_owner is not null and is_owner or
     is_admin is not null and is_admin or
     is_moderator is not null and is_moderator)"""


  def insertInvite(invite: Invite) {
    val statement = """
      insert into invites3(
        site_id,
        secret_key,
        email_address,
        start_at_url,
        add_to_group_id,
        created_by_id,
        created_at)
      values (?, ?, ?, ?, ?, ?, ?)
      """
    val values = List(
      siteId.asAnyRef,
      invite.secretKey,
      invite.emailAddress,
      invite.startAtUrl.orNullVarchar,
      invite.addToGroupIds.headOption.orNullInt, // [05WMKG42]
      invite.createdById.asAnyRef,
      invite.createdAt.asTimestamp)

    runUpdate(statement, values)
  }


  def updateInvite(invite: Invite): Boolean = {
    val statement = """
      update invites3 set
        accepted_at = ?,
        user_id = ?,
        deleted_at = ?,
        deleted_by_id = ?,
        invalidated_at = ?
      where
        site_id = ? and
        secret_key = ?
      """
    val values = List(
      invite.acceptedAt.orNullTimestamp,
      invite.userId.orNullInt,
      invite.deletedAt.orNullTimestamp,
      invite.deletedById.orNullInt,
      invite.invalidatedAt.orNullTimestamp,
      siteId.asAnyRef,
      invite.secretKey)
    runUpdateSingleRow(statement, values)
  }


  def forgetInviteEmailSentToAddress(userId: UserId, replaceWithAddr: String) {
    TESTS_MISSING
    val statement = """
      update invites3 set email_address = ?
      where
        site_id = ? and
        user_id = ?
      """
    val values = List(replaceWithAddr, siteId.asAnyRef, userId.asAnyRef)
    runUpdate(statement, values)
  }


  def loadInviteBySecretKey(secretKey: String): Option[Invite] = {
    val query = s"""
      select $InviteSelectListItems
      from invites3
      where site_id = ? and secret_key = ?
      """
    val values = List(siteId.asAnyRef, secretKey)
    runQueryFindOneOrNone(query, values, rs => {
      getInvite(rs)
    }, "EdEB2KD0F")
  }


  def loadInvitesSentTo(emailAddress: String): immutable.Seq[Invite] = {
    loadInvitesImpl(sentToAddr = Some(emailAddress), limit = 999)
  }


  def loadInvitesCreatedBy(createdById: UserId): immutable.Seq[Invite] = {
    loadInvitesImpl(createdById = Some(createdById), limit = 999)
  }


  def loadAllInvites(limit: Int): immutable.Seq[Invite] = {
    loadInvitesImpl(limit = limit)
  }


  private def loadInvitesImpl(createdById: Option[UserId] = None, sentToAddr: Option[String] = None,
        limit: Int): immutable.Seq[Invite] = {
    val values = ArrayBuffer[AnyRef](siteId.asAnyRef)
    val andTest = createdById.map({ id =>
      values.append(id.asAnyRef)
      "and created_by_id = ?"
    }).getOrElse(sentToAddr.map({ addr =>
      values.append(addr)
      "and email_address = ?"
    }).getOrElse({
      ""
    }))

    val query = s"""
      select $InviteSelectListItems
      from invites3
      where site_id = ? $andTest
      order by created_at desc, email_address """ //  [inv_sort_odr]

    runQueryFindMany(query, values.toList, rs => {
      getInvite(rs)
    })
  }


  def loadGroupMembers(groupId: UserId): Vector[Participant] = {
    // In e2e test: TyT4AWJL208R
    groupId match {
      case Group.AdminsId =>
        loadMembersOfBuiltInGroup(adminsOnly = true)
      case Group.ModeratorsId =>
        loadMembersOfBuiltInGroup(modsOnly = true)
      case Group.StaffId =>
        loadMembersOfBuiltInGroup(staffOnly = true)
      case Group.EveryoneId =>
        // Bug fix: Previously one could configure notifications for Everyone,
        // but that triggered an unimplementedIf(...) below  [502RKGWT50].
        // Instead, load the AllMembers group, which should be the same.
        // Don't: loadMembersOfBuiltInGroup(everyone = true)
        loadMembersOfBuiltInGroup(builtInGroup = Some(Group.AllMembersId))
      case trustLevelGroupId if trustLevelGroupId >= Group.AllMembersId
                              && trustLevelGroupId <= Group.CoreMembersId =>
        loadMembersOfBuiltInGroup(builtInGroup = Some(trustLevelGroupId))
      case _ =>
        loadMembersOfCustomGroup(groupId)
    }
  }


  private def loadMembersOfBuiltInGroup(
        adminsOnly: Boolean = false, modsOnly: Boolean = false, staffOnly: Boolean = false,
        everyone: Boolean = false,
        builtInGroup: Option[UserId] = None): Vector[Participant] = {

    import Group.{AdminsId, ModeratorsId => ModsId}

    // Currently no good reason to load everyone incl *guests*. [502RKGWT50]
    unimplementedIf(everyone || builtInGroup.is(Group.EveryoneId),
      "Loading Everyone group members [TyE2ABKR05]")

    val values = ArrayBuffer[AnyRef](siteId.asAnyRef)
    val isStaffTest = s"(u.is_admin or u.is_moderator) and u.user_id not in ($AdminsId, $ModsId)"

    val conditions =
      // <> AdminsId means don't-load-the-Admins-*group*.
      if (adminsOnly) s"u.is_admin and u.user_id <> $AdminsId"
      else if (modsOnly)  s"u.is_moderator and u.user_id <> $ModsId"
      else if (staffOnly) isStaffTest
      else {
        val groupId = builtInGroup getOrDie "TyE3QKB05W"
        val trustLevel = TrustLevel.fromBuiltInGroupId(groupId) getOrElse {
          return Vector.empty
        }
        values.append(trustLevel.toInt.asAnyRef)
        // The NewMembers *trust level* means the All Members *group*, which includes all members,
        // also basic members, full members, ect, and staff. The group has a different name
        // ("All Members") from the trust level ("New Members"), because it'd be confusing
        // if a group named New Members also included e.g. long time full members.
        // Staff members are included in all groups [COREINCLSTAFF], regardless
        // of their trust levels.
        s"coalesce(u.locked_trust_level, u.trust_level) >= ?  or  ($isStaffTest)"
      }

    val query = s"""
      select $UserSelectListItemsNoGuests
      from users3 u
      where u.site_id = ?
        and user_id >= ${Participant.LowestNormalMemberId}
        and deleted_at is null
        and ($conditions)"""

    runQueryFindMany(query, values.toList, rs => {
      val user = getParticipant(rs)
      dieIf(user.isGuest, "TyE5ABK20A2")
      user
    })
  }


  private def loadMembersOfCustomGroup(groupId: UserId): Vector[Participant] = {
    val values = ArrayBuffer[AnyRef](siteId.asAnyRef, groupId.asAnyRef)

    val query = s"""
      select $UserSelectListItemsNoGuests
      from group_participants3 gp inner join users3 u
        on gp.site_id = u.site_id and
           gp.participant_id = u.user_id
      where
        gp.site_id = ? and
        gp.group_id = ? and
        gp.is_member
      """

    runQueryFindMany(query, values.toList, rs => {
      val user = getParticipant(rs)
      dieIf(user.isGuest, "TyE603KRJL")
      user
    })
  }


  def loadGroupParticipantsAllCustomGroups(): Vector[GroupParticipant] = {
    // (We need not filter away anything here, because:
    // Membership in built-in trust level groups and staff groups isn't stored
    // in the group_participants3 table — instead, it's just a trust_level field
    // in the users3 table, and the is_admin / is_moderator fields.)
    val query = s"""
      select * from group_participants3
      where site_id = ?
      """
    runQueryFindMany(query, List(siteId.asAnyRef), rs => {
      GroupParticipant(
        groupId = getInt(rs, "group_id"),
        ppId = getInt(rs, "participant_id"),
        isMember = getBool(rs, "is_member"),
        isManager = getBool(rs, "is_manager"),
        isAdder = getBool(rs, "is_adder"),
        isBouncer = getBool(rs, "is_bouncer"))
    })
  }


  def addGroupMembers(groupId: UserId, memberIdsToAdd: Set[UserId]): Set[UserId] = {
    dieIf(groupId < Participant.LowestAuthenticatedUserId, "TyE5RKMZ25")
    val idsAdded = ArrayBuffer[UserId]()
    memberIdsToAdd foreach { newMemberId =>
      val sql = """
        insert into group_participants3(site_id, group_id, participant_id, is_member)
        values (?, ?, ?, true)
        on conflict do nothing
        """
      val values = List(siteId.asAnyRef, groupId.asAnyRef, newMemberId.asAnyRef)
      val numRowsInserted = runUpdate(sql, values)
      if (numRowsInserted == 1) {
        idsAdded += newMemberId
      }
    }
    idsAdded.toSet
  }


  def removeGroupMembers(groupId: UserId, memberIdsToRemove: Set[UserId]) {
    dieIf(groupId < Participant.LowestAuthenticatedUserId, "TyE205RHM63")
    if (memberIdsToRemove.isEmpty) return
    val sql = s"""
      delete from group_participants3
        where site_id = ?
          and group_id = ?
          and participant_id in (${makeInListFor(memberIdsToRemove)})
          and is_member
      """
    val values = siteId.asAnyRef :: groupId.asAnyRef :: memberIdsToRemove.map(_.asAnyRef).toList
    runUpdate(sql, values)
  }


  def removeAllGroupParticipants(groupId: UserId) {
    dieIf(groupId < Participant.LowestAuthenticatedUserId, "TyE5AKT2E7")
    val sql = s"""
      delete from group_participants3
        where site_id = ?
          and group_id = ?
      """
    val values = List(siteId.asAnyRef, groupId.asAnyRef)
    runUpdate(sql, values)
  }


  def removeDeletedMemberFromAllGroups(memberId: UserId): Unit = {
    dieIf(memberId < Participant.LowestAuthenticatedUserId, "TyE5DMWG05")
    val statement = s"""
      delete from group_participants3
      where site_id = ?
        and participant_id = ?
      """
    val values = List(siteId.asAnyRef, memberId.asAnyRef)
    runUpdate(statement, values)
  }


  def insertGroup(group: Group) {
    val sql = """
      insert into users3(
        site_id,
        user_id,
        ext_id,
        username,
        full_name,
        created_at,
        summary_email_interval_mins,
        summary_email_if_active,
        -- grants_trust_level,  — later
        ui_prefs,
        is_group)
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, true)
      """
    val values = List(
      siteId.asAnyRef,
      group.id.asAnyRef,
      group.extId.orNullVarchar,
      group.theUsername,
      group.name.orNullVarchar,
      group.createdAt.asTimestamp,
      group.summaryEmailIntervalMins.orNullInt,
      group.summaryEmailIfActive.orNullBoolean,
      //group.grantsTrustLevel.map(_.toInt).orNullInt,
      group.uiPrefs.orNullJson)
    runUpdateExactlyOneRow(sql, values)
  }


  def deleteGroup(groupId: UserId) {
    dieIf(groupId < LowestAuthenticatedUserId, "TyE205ARGN3")
    val randomNumber = Prelude.nextRandomLong().toString.take(10)
    val sql = s"""
      update users3
      set deleted_at = ?,
          -- The constraint `participants_c_username_len_deleted` makes it possible
          -- to make the username longer, by appending here, when a member is deleted.
          username = username || '${Member.DeletedUsernameSuffix}_$randomNumber'
      where is_group
        and site_id = ?
        and user_id = ?
        and user_id >= $LowestAuthenticatedUserId
      """
    val values = List(now.asTimestamp, siteId.asAnyRef, groupId.asAnyRef)
    runUpdateExactlyOneRow(sql, values)
  }


  def updateGroup(group: Group) {
    val statement = """
      update users3 set
        updated_at = now_utc(),
        ext_id = ?,
        full_name = ?,
        username = ?,
        summary_email_interval_mins = ?,
        summary_email_if_active = ?,
        -- grants_trust_level = ?,  — later
        ui_prefs = ?
      where site_id = ?
        and user_id = ?
      """

    val values = List(
      group.extId.orNullVarchar,
      group.anyName.orNullVarchar,
      group.theUsername,
      group.summaryEmailIntervalMins.orNullInt,
      group.summaryEmailIfActive.orNullBoolean,
      //group.grantsTrustLevel.map(_.toInt).orNullInt,
      group.uiPrefs.orNullJson,
      siteId.asAnyRef,
      group.id.asAnyRef)

    try runUpdateSingleRow(statement, values)
    catch {
      case ex: js.SQLException if isUniqueConstrViolation(ex) && uniqueConstrViolatedIs(
        "dw1_users_site_usernamelower__u", ex) =>
        throw DuplicateUsernameException(group.theUsername)
    }
  }


  def loadGroupIdsMemberIdFirst(ppt: Participant): Vector[UserId] = {
    val builtInGroups = ppt match {
      case _: Guest | UnknownParticipant => return Vector(Group.EveryoneId)
      case u: User => getBuiltInGroupIdsForUser(u)
      case g: Group => getBuiltInGroupIdsForGroup(g)
    }

    val customGroups = loadCustomGroupsFor(ppt.id)
    // More specific first: the user henself, then custom groups. And AllMembers and Everyone
    // last — the least specific groups.
    ppt.id +: (customGroups ++ builtInGroups)
  }


  private def loadCustomGroupsFor(pptId: UserId): Vector[UserId] = {
    val query = s"""
        select group_id
        from group_participants3
        where site_id = ?
          and participant_id = ?
          and is_member
        """
    runQueryFindMany(query, List(siteId.asAnyRef, pptId.asAnyRef), rs => {
      rs.getInt("group_id")
    })
  }


  private def getBuiltInGroupIdsForUser(member: User): Vector[UserId] = {
    val G = Group

    if (member.isAdmin)
      return Vector(G.AdminsId, G.StaffId, G.CoreMembersId, G.RegularMembersId,
        G.TrustedMembersId, G.FullMembersId, G.BasicMembersId, G.AllMembersId, G.EveryoneId)

    if (member.isModerator)
      return Vector(G.ModeratorsId, G.StaffId, G.CoreMembersId, G.RegularMembersId,
        G.TrustedMembersId, G.FullMembersId, G.BasicMembersId, G.AllMembersId, G.EveryoneId)

    member.effectiveTrustLevel match {
      case TrustLevel.Stranger =>
        // Cannot happen — members always >= NewMember. But incl this
        // anyway — in case will refactor in the future, so can be Stranger.
        Vector(G.EveryoneId)
      case TrustLevel.NewMember =>
        Vector(G.AllMembersId, G.EveryoneId)
      case TrustLevel.BasicMember =>
        Vector(G.BasicMembersId, G.AllMembersId, G.EveryoneId)
      case TrustLevel.FullMember =>
        Vector(G.FullMembersId, G.BasicMembersId, G.AllMembersId, G.EveryoneId)
      case TrustLevel.TrustedMember =>
        Vector(G.TrustedMembersId,
          G.FullMembersId, G.BasicMembersId, G.AllMembersId, G.EveryoneId)
      case TrustLevel.RegularMember =>
        Vector(G.RegularMembersId, G.TrustedMembersId,
          G.FullMembersId, G.BasicMembersId, G.AllMembersId, G.EveryoneId)
      case TrustLevel.CoreMember =>
        Vector(G.CoreMembersId, G.RegularMembersId, G.TrustedMembersId,
          G.FullMembersId, G.BasicMembersId, G.AllMembersId, G.EveryoneId)
    }
  }


  private def getBuiltInGroupIdsForGroup(group: Group): Vector[UserId] = {
    val G = Group
    group.id match {
      case G.EveryoneId =>
        Vector(G.EveryoneId)
      case G.AllMembersId =>
        Vector(G.AllMembersId, G.EveryoneId)
      case G.BasicMembersId =>
        Vector(G.BasicMembersId, G.AllMembersId, G.EveryoneId)
      case G.FullMembersId =>
        Vector(G.FullMembersId, G.BasicMembersId, G.AllMembersId, G.EveryoneId)
      case G.TrustedMembersId =>
        Vector(G.TrustedMembersId, G.FullMembersId, G.BasicMembersId, G.AllMembersId, G.EveryoneId)
      case G.RegularMembersId =>
        Vector(G.RegularMembersId, G.TrustedMembersId,
          G.FullMembersId, G.BasicMembersId, G.AllMembersId, G.EveryoneId)
      case G.CoreMembersId =>
        Vector(G.CoreMembersId, G.RegularMembersId, G.TrustedMembersId,
          G.FullMembersId, G.BasicMembersId, G.AllMembersId, G.EveryoneId)
      case G.StaffId =>
        Vector(G.StaffId, G.CoreMembersId, G.RegularMembersId,
          G.TrustedMembersId, G.FullMembersId, G.BasicMembersId, G.AllMembersId, G.EveryoneId)
      case G.ModeratorsId =>
        Vector(G.ModeratorsId, G.StaffId, G.CoreMembersId, G.RegularMembersId,
          G.TrustedMembersId, G.FullMembersId, G.BasicMembersId, G.AllMembersId, G.EveryoneId)
      case G.AdminsId =>
        Vector(G.AdminsId, G.StaffId, G.CoreMembersId, G.RegularMembersId,
          G.TrustedMembersId, G.FullMembersId, G.BasicMembersId, G.AllMembersId, G.EveryoneId)
      case _ =>
        // Custom groups are members, so should be in the all-members group, right.
        Vector(G.AllMembersId, G.EveryoneId)
    }
  }


  def nextGuestId: UserId = {
    val query = s"""
      select least(min(user_id) - 1, ${Participant.MaxCustomGuestId})
      from users3
      where site_id = ?
      """
    runQueryFindExactlyOne(query, List(siteId.asAnyRef), _.getInt(1))
  }


  def nextMemberId: UserId = {
    val query = s"""
      select max(user_id) max_id from users3
      where site_id = ? and user_id >= $LowestAuthenticatedUserId
      """
    runQueryFindExactlyOne(query, List(siteId.asAnyRef), rs => {
      val maxId = rs.getInt("max_id")
      math.max(LowestAuthenticatedUserId, maxId + 1)
    })
  }


  def insertGuest(guest: Guest) {
    val statement = s"""
      insert into users3(
        site_id,
        user_id,
        ext_id,
        created_at,
        full_name,
        guest_browser_id,
        guest_email_addr,
        email_notfs,
        about,
        website,
        country,
        locked_threat_level)
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      """
    val values = List(siteId.asAnyRef, guest.id.asAnyRef, guest.extId.orNullVarchar,
      guest.createdAt.asTimestamp, guest.guestName.trim,
      guest.guestBrowserId.orNullVarchar,  // absent if importing Disqus user [494AYDNR]
      e2d(guest.email),
      _toFlag(guest.emailNotfPrefs),  // change to Int [7KABKF2]
      guest.about.trimOrNullVarchar,
      guest.website.trimOrNullVarchar,
      guest.country.trimOrNullVarchar,
      guest.lockedThreatLevel.map(_.toInt).orNullInt)
    runUpdateSingleRow(statement, values)
  }


  def insertMember(user: UserInclDetails) {
    try {
      runUpdate("""
        insert into users3(
            SITE_ID, USER_ID, ext_id, sso_id, full_name, USERNAME, CREATED_AT,
            primary_email_addr, EMAIL_NOTFS, EMAIL_VERIFIED_AT, EMAIL_FOR_EVERY_NEW_POST, PASSWORD_HASH,
            IS_APPROVED, APPROVED_AT, APPROVED_BY_ID,
            IS_OWNER, IS_ADMIN, IS_MODERATOR,
            about, website, country,
            see_activity_min_trust_level,
            trust_level, locked_trust_level, threat_level, locked_threat_level,
            deactivated_at, deleted_at)
        values (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        List[AnyRef](
          siteId.asAnyRef,
          user.id.asAnyRef,
          user.extId.orNullVarchar,
          user.ssoId.orNullVarchar,
          user.fullName.orNullVarchar,
          user.username,
          user.createdAt.asTimestamp,
          user.primaryEmailAddress.trimNullVarcharIfBlank,
          _toFlag(user.emailNotfPrefs),
          o2ts(user.emailVerifiedAt),
          user.mailingListMode.asTrueOrNull,
          user.passwordHash.orNullVarchar,
          user.isApproved.orNullBoolean,
          user.reviewedAt.orNullTimestamp,
          user.reviewedById.orNullInt,
          user.isOwner.asTrueOrNull,
          user.isAdmin.asTrueOrNull,
          user.isModerator.asAnyRef,
          user.about.trimOrNullVarchar,
          user.website.trimOrNullVarchar,
          user.country.trimOrNullVarchar,
          user.seeActivityMinTrustLevel.map(_.toInt).orNullInt,
          user.trustLevel.toInt.asAnyRef,
          user.lockedTrustLevel.map(_.toInt).orNullInt,
          user.threatLevel.toInt.asAnyRef,
          user.lockedThreatLevel.map(_.toInt).orNullInt,
          user.deactivatedAt.orNullTimestamp,
          user.deletedAt.orNullTimestamp))
    }
    catch {
      case ex: js.SQLException =>
        if (!isUniqueConstrViolation(ex))
          throw ex

        if (uniqueConstrViolatedIs("users_site_primaryemail_u", ex))
          throw DbDao.DuplicateUserEmail(user.primaryEmailAddress)

        if (uniqueConstrViolatedIs("DW1_USERS_SITE_USERNAMELOWER__U", ex))
          throw DbDao.DuplicateUsername(user.username)

        throw ex
    }
  }


  def loadUserByPrimaryEmailOrUsername(emailOrUsername: String): Option[User] = {
    loadMemberByPrimaryEmailOrUsernameImpl(emailOrUsername, maybeEmail = true).map(_.toUserOrThrow)
  }


  def loadMemberByUsername(username: String): Option[Member] = {
    dieIf(username contains '@', "TyE2ABKJ40", s"Got an email address")
    loadMemberByPrimaryEmailOrUsernameImpl(username, maybeEmail = false)
  }


  private def loadMemberByPrimaryEmailOrUsernameImpl(emailOrUsername: St, maybeEmail: Bo)
        : Opt[Member] = {
    val values = MutArrBuf[AnyRef](siteId.asAnyRef, emailOrUsername)
    val emailEqOr = if (!maybeEmail) "" else {
      values.append(emailOrUsername)
      // Talkyard already converts email to lowercase before storing in the database,
      // (see db fn email_seems_ok())
      // — so do a case insensitive comparison here. Also see [email_casing].
      "u.primary_email_addr = lower(?) or"
    }

    // [UNPUNCT]
    val query = s"""
      select $UserSelectListItemsNoGuests
      from users3 u
      where u.SITE_ID = ?
        and u.USER_ID >= $LowestNonGuestId
        and ($emailEqOr lower(u.USERNAME) = lower(?))
      """
    runQueryFindOneOrNone(query, values.toList, rs => {
      val user = getParticipant(rs)
      dieIf(user.isGuest, "TyE2AKB7F3")
      user.asInstanceOf[Member]
    })
  }


  def loadUserInclDetailsBySsoId(ssoId: String): Option[UserInclDetails] = {
    loadMemberInclDetailsImpl("sso_id", ssoId)
  }


  def loadUserInclDetailsByExtId(externalId: String): Option[UserInclDetails] = {
    loadMemberInclDetailsImpl("ext_id", externalId)
  }


  def loadUserInclDetailsByEmailAddr(emailAddress: String): Option[UserInclDetails] = {
    loadMemberInclDetailsImpl("primary_email_addr", emailAddress)
  }


  def loadMemberInclDetailsImpl(columnName: String, value: AnyRef): Option[UserInclDetails] = {
    val query = s"""
      select $CompleteUserSelectListItemsWithUserId
      from users3 u
      where u.site_id = ?
        and u.$columnName = ?
        and u.user_id >= $LowestTalkToMemberId"""
    runQueryFindOneOrNone(query, List(siteId.asAnyRef, value.asAnyRef), getUserInclDetails)
  }


  def loadParticipant(userId: UserId): Option[Participant] =
    loadUsersAsSeq(userId::Nil).headOption


  def loadParticipants(userIds: Iterable[UserId]): immutable.Seq[Participant] =
    loadUsersAsSeq(userIds.toList)


  def loadUsersAsSeq(userIds: immutable.Seq[UserId]): List[Participant] = {
    val usersBySiteAndId = asSystem.loadUsers(Map(siteId -> userIds))
    usersBySiteAndId.values.toList
  }


  def loadParticipantsAsMap(userIds: Iterable[UserId]): Map[UserId, Participant] = {
    val usersBySiteAndId = asSystem.loadUsers(Map(siteId -> userIds.toSet.toVector))
    usersBySiteAndId map { case (siteAndUserId, user) =>
      siteAndUserId._2 -> user
    }
  }


  def loadPageRepliers(pageId: PageId, usersOnly: Bo): Seq[User] = {
    unimplIf(!usersOnly, "Must be usersOnly [TyE7AMT05MRKT]")
    val sql = s"""
          select distinct $UserSelectListItemsNoGuests
          from posts3 p inner join users3 u
            on p.site_id = u.site_id
            and p.created_by_id = u.user_id
            and not u.is_group
            and u.user_id >= $LowestTalkToMemberId
          where p.site_id = ? and p.page_id = ?
          """
    val values = List(siteId.asAnyRef, pageId.asAnyRef)
    runQueryFindMany(sql, values, getUser)
  }


  // See also:  listUsernamesOnPage(pageId): Seq[NameAndUsername]
  //
  def loadUsersWithUsernamePrefix(usernamePrefix: String,
        caseSensitive: Boolean, limit: Int): immutable.Seq[User] = {
    // There's an index on username lowercase: dw1_users_site_usernamelower__u
    // but not mixed case. Currently, we do only lowercase matching though.
    dieIf(caseSensitive, "TyE062KDS40", "No index for case sensitive username lookup")

    // Better to have Postgres do 'lower(?)' rather than in the JVM?
    // So both done in the same way? Doesn't matter I suppose.
    val andUsernameLike = usernamePrefix.isEmpty ?
      "" | " and lower(u.username) like lower(?)"

    COULD_OPTIMIZE // Usually don't need all fields — only the name and avatar url. [ONLYNAME]
    val query = i"""
      select $UserSelectListItemsNoGuests
      from users3 u
      where u.site_id = ? $andUsernameLike
        and u.user_id >= $LowestTalkToMemberId
        and u.trust_level is not null  -- or  u.is_group nowadays?
      order by lower(u.username)
      limit $limit
      """
    val values = ArrayBuffer(siteId.asAnyRef)
    if (andUsernameLike.nonEmpty) {
      values.append(usernamePrefix + '%')
    }
    runQueryFindMany(query, values.toList, getUser)
  }


  def loadAllGuests(): immutable.Seq[Guest] = {
    val query = i"""
      select $UserSelectListItemsWithGuests
      from users3 u
      left join guest_prefs3 e   -- should join like this, also here: [_wrongGuestEmailNotfPerf]
        on u.guest_email_addr = e.EMAIL and u.SITE_ID = e.SITE_ID
      where
        u.SITE_ID = ? and u.user_id <= ${Participant.MaxGuestId}
      """
    runQueryFindMany(query, List(siteId.asAnyRef), rs => {
      val p = getParticipant(rs)
      dieIf(!p.isInstanceOf[Guest], "TyE4AKS05")
      p.asInstanceOf[Guest]
    })
  }


  def loadAllGuestEmailNotfPrefsByEmailAddr(): Map[String, EmailNotfPrefs] = {
    val query = i"""
      select email, email_notfs from guest_prefs3
      where site_id = ?
      """
    runQueryBuildMap(query, List(siteId.asAnyRef), rs => {
      val emailAddr = rs.getString("email")
      val notfPref = _toEmailNotfs(rs.getString("email_notfs"))
      emailAddr -> notfPref
    })
  }


  def loadAllUsersInclDetails(): immutable.Seq[UserInclDetails] = {
    val query = s"""
      select $CompleteUserSelectListItemsWithUserId
      from users3
      where site_id = ?
        and user_id >= ${Participant.LowestMemberId}
        and trust_level is not null -- means is user, not group
      """
    runQueryFindMany(query, List(siteId.asAnyRef), rs => {
      getUserInclDetails(rs)
    })
  }


  def loadAllGroupsAsSeq(): Vector[Group] = {
    val query = i"""
      select $GroupSelectListItems
      -- should use index: participants_groups_i
      from users3
      where site_id = ?
        and is_group
        and deleted_at is null
      """
    runQueryFindMany(query, List(siteId.asAnyRef), getGroup)
  }


  def loadMemberInclDetailsByUsername(username: String): Option[MemberInclDetails] = {
    loadMemberOrGroupInclDetailsImpl("lower(username)", username.toLowerCase)
  }


  def loadMemberInclDetailsById(userId: UserId): Option[MemberInclDetails] = {
    require(Participant.isRoleId(userId), "DwE5FKE2")
    loadMemberOrGroupInclDetailsImpl("user_id", userId.asAnyRef)
  }


  def loadOwner(): Option[UserInclDetails] = {
    loadMemberOrGroupInclDetailsImpl("is_owner", true.asAnyRef) map {
      case member: UserInclDetails => member
      case group: Group => die("EdE2QYTK05", s"Owner ${group.id}@$siteId is a group")
    }
  }


  private def loadMemberOrGroupInclDetailsImpl(field: String, value: AnyRef)
        : Option[MemberInclDetails] = {
    val sql = s"""
      select $CompleteUserSelectListItemsWithUserId
      from users3
      where site_id = ? and $field = ?
      """
    runQueryFindOneOrNone(sql, List(siteId.asAnyRef, value), rs => {
      getMemberInclDetails(rs)
    })
  }


  def loadMembersAndGroupsInclDetailsById(userIds: Iterable[UserId])
        : immutable.Seq[MemberInclDetails] = {
    if (userIds.isEmpty) return Nil
    val query = s"""
      select $CompleteUserSelectListItemsWithUserId
      from users3
      where site_id = ? and user_id in (${makeInListFor(userIds)})
      """
    val values = siteId.asAnyRef :: userIds.toList.map(_.asAnyRef)
    runQueryFindMany(query, values, rs => {
      getMemberInclDetails(rs)
    })
  }


  def loadParticipantsInclDetailsByIdsAsMap_wrongGuestEmailNotfPerf(
        ids: Iterable[UserId]): immutable.Map[UserId, ParticipantInclDetails] = {
    loadParticipantsInclDetails_wrongGuestEmailNotfPerf_Impl[UserId](
      ids.map(_.asAnyRef), "user_id", _.id)
  }


  def loadParticipantsInclDetailsByExtIdsAsMap_wrongGuestEmailNotfPerf(
        extImpIds: Iterable[ExtId])
        : immutable.Map[ExtId, ParticipantInclDetails] = {
    loadParticipantsInclDetails_wrongGuestEmailNotfPerf_Impl[ExtId](
      extImpIds, "ext_id", _.extId.getOrDie("TyE205HKSD63"))
  }


  def loadParticipantsInclDetails_wrongGuestEmailNotfPerf_Impl[ID](
        ids: Iterable[AnyRef], columnName: String, idFn: ParticipantInclDetails => ID)
        : immutable.Map[ID, ParticipantInclDetails] = {
    if (ids.isEmpty) return Map.empty
    val query = s"""
      select $CompleteUserSelectListItemsWithUserId
      from users3
      -- Should join w guest_prefs3 here to get guests' email notf prefs [_wrongGuestEmailNotfPerf]
      where site_id = ? and $columnName in (${makeInListFor(ids)})
      """
    val values = siteId.asAnyRef :: ids.toList
    runQueryBuildMap(query, values, rs => {
      val pp = getParticipantInclDetails_wrongGuestEmailNotfPerf(rs)
      idFn(pp) -> pp
    })
  }



  def loadUsersInclDetailsAndStats(peopleQuery: PeopleQuery)
        : immutable.Seq[(UserInclDetails, Option[UserStats])] = {
    val order = peopleQuery.orderOffset
    val filter = peopleQuery.peopleFilter

    TESTS_MISSING // so many possible combinations

    val andEmailVerified =
      if (filter.onlyWithVerifiedEmail) s"and (email_verified_at is not null or $IsOwnerOrStaff)"
      else ""

    val andIsApprovedOrWaiting =
      if (filter.onlyPendingApproval) s"and (is_approved is null and not $IsOwnerOrStaff)"
      else if (filter.onlyApproved) s"and (is_approved = true or $IsOwnerOrStaff)"
      else ""

    val andIsStaff =
      if (filter.onlyStaff) s"and $IsOwnerOrStaff"
      else ""

    // Do include staff, maybe a moderator got banned?
    val andIsSuspended =
      if (filter.onlySuspended) s"and (suspended_at is not null)"
      else ""

    /*val andIsSilenced =
      if (filter.onlySilenced) s"and (silenced_at is not null)"
      else "" */

    val andIsThreat =
      if (filter.onlyThreats) s"""
        and ((
          locked_threat_level is not null
          and locked_threat_level >= ${ThreatLevel.MildThreat.toInt}
        ) or (
          locked_threat_level is null and
          threat_level is not null and
          threat_level >= ${ThreatLevel.MildThreat.toInt}
        ))"""
      else ""

    val orderBy =
      if (order == PeopleOrderOffset.BySignedUpAtDesc) "order by created_at desc, user_id desc"
      else "order by username, full_name, user_id"

    val query = s"""
      select u.user_id, $CompleteUserSelectListItemsNoUserId, $UserStatsSelectListItems
      from users3 u left join user_stats3 s
          on u.site_id = s.site_id and u.user_id = s.user_id
      where
        u.site_id = ? and
        u.user_id >= ${Participant.LowestAuthenticatedUserId} and
        not u.is_group
        $andEmailVerified
        $andIsApprovedOrWaiting
        $andIsStaff
        $andIsSuspended
        $andIsThreat
        $orderBy
      """

    runQueryFindMany(query, List(siteId.asAnyRef), rs => {
      // Don't remember if maybe there are old users, with no stats data created yet?
      val anyLastSeen = getOptWhen(rs, "last_seen_at")
      val anyStats = if (anyLastSeen.isEmpty) None else Some(getUserStats(rs))

      val user = getMemberInclDetails(rs) match {
        case m: UserInclDetails => m
        case g: Group => throw GotAGroupException(g.id)
      }

      (user, anyStats)
    })
  }


  def updateUserInclDetails(user: UserInclDetails): Boolean = {
    val statement = """
      update users3 set
        ext_id = ?,
        sso_id = ?,
        updated_at = now_utc(),
        full_name = ?,
        username = ?,
        primary_email_addr = ?,
        email_verified_at = ?,
        email_for_every_new_post = ?,
        email_notfs = ?,
        summary_email_interval_mins = ?,
        summary_email_if_active = ?,
        password_hash = ?,
        country = ?,
        website = ?,
        about = ?,
        see_activity_min_trust_level = ?,
        avatar_tiny_base_url = ?,
        avatar_tiny_hash_path = ?,
        avatar_small_base_url = ?,
        avatar_small_hash_path = ?,
        avatar_medium_base_url = ?,
        avatar_medium_hash_path = ?,
        ui_prefs = ?,
        is_approved = ?,
        approved_at = ?,
        approved_by_id = ?,
        suspended_at = ?,
        suspended_till = ?,
        suspended_by_id = ?,
        suspended_reason = ?,
        trust_level = ?,
        locked_trust_level = ?,
        threat_level = ?,
        locked_threat_level = ?,
        is_owner = ?,
        is_admin = ?,
        is_moderator = ?,
        deactivated_at = ?,
        deleted_at = ?
      where site_id = ? and user_id = ?
      """

    val values = List(
      user.extId.orNullVarchar,
      user.ssoId.orNullVarchar,
      user.fullName.orNullVarchar,
      user.username,
      user.primaryEmailAddress.trimNullVarcharIfBlank,
      user.emailVerifiedAt.orNullTimestamp,
      user.mailingListMode.asAnyRef,
      _toFlag(user.emailNotfPrefs),
      user.summaryEmailIntervalMins.orNullInt,
      user.summaryEmailIfActive.orNullBoolean,
      user.passwordHash.orNullVarchar,
      user.country.trimOrNullVarchar,
      user.website.trimOrNullVarchar,
      user.about.trimOrNullVarchar,
      user.seeActivityMinTrustLevel.map(_.toInt).orNullInt,
      user.tinyAvatar.map(_.baseUrl).orNullVarchar,
      user.tinyAvatar.map(_.hashPath).orNullVarchar,
      user.smallAvatar.map(_.baseUrl).orNullVarchar,
      user.smallAvatar.map(_.hashPath).orNullVarchar,
      user.mediumAvatar.map(_.baseUrl).orNullVarchar,
      user.mediumAvatar.map(_.hashPath).orNullVarchar,
      user.uiPrefs.orNullJson,
      user.isApproved.orNullBoolean,
      user.reviewedAt.orNullTimestamp,
      user.reviewedById.orNullInt,
      user.suspendedAt.orNullTimestamp,
      user.suspendedTill.orNullTimestamp,
      user.suspendedById.orNullInt,
      user.suspendedReason.orNullVarchar,
      user.trustLevel.toInt.asAnyRef,
      user.lockedTrustLevel.map(_.toInt).orNullInt,
      user.threatLevel.toInt.asAnyRef,
      user.lockedThreatLevel.map(_.toInt).orNullInt,
      user.isOwner.asTrueOrNull,
      user.isAdmin.asTrueOrNull,
      user.isModerator.asTrueOrNull,
      user.deactivatedAt.orNullTimestamp,
      user.deletedAt.orNullTimestamp,
      siteId.asAnyRef,
      user.id.asAnyRef)

    try runUpdateSingleRow(statement, values)
    catch {
      case ex: js.SQLException if isUniqueConstrViolation(ex) && uniqueConstrViolatedIs(
          "dw1_users_site_usernamelower__u", ex) =>
        throw DuplicateUsernameException(user.username)
    }
  }


  def updateGuest(user: Guest): Boolean = {
    val statement = """
      update users3 set
        updated_at = now_utc(),
        full_name = ?,
        locked_threat_level = ?
      where site_id = ? and user_id = ?
      """
    val values = List(user.guestName, user.lockedThreatLevel.map(_.toInt).orNullInt,
      siteId.asAnyRef, user.id.asAnyRef)

    try runUpdateSingleRow(statement, values)
    catch {
      case ex: js.SQLException =>
        if (isUniqueConstrViolation(ex) && (
            uniqueConstrViolatedIs("pps_u_site_guest_no_browser_id", ex)
            || uniqueConstrViolatedIs("pps_u_site_guest_w_browser_id", ex)))
          throw DbDao.DuplicateGuest
        else
          throw ex
    }
  }


  // See also:  loadUsersWithUsernamePrefix(usernamePrefix, ...): Seq[User]
  //
  def listUsernamesOnPage(pageId: PageId): Seq[NameAndUsername] = {
    val sql = """
      select distinct u.user_id, u.full_name, u.USERNAME
      from posts3 p inner join users3 u
         on p.SITE_ID = u.SITE_ID
        and p.CREATED_BY_ID = u.USER_ID
        and u.USERNAME is not null
      where p.SITE_ID = ? and p.PAGE_ID = ?"""
    val values = List(siteId.asAnyRef, pageId)
    val result = ArrayBuffer[NameAndUsername]()
    db.queryAtnms(sql, values, rs => {
      while (rs.next()) {
        val userId = rs.getInt("user_id")
        val fullName = Option(rs.getString("full_name")) getOrElse ""
        val username = rs.getString("USERNAME")
        dieIf(username eq null, "DwE5BKG1")
        result += NameAndUsername(userId, fullName = fullName, username = username)
      }
    })
    result.to[immutable.Seq]
  }


  def configIdtySimple(ctime: ju.Date, emailAddr: String, emailNotfPrefs: EmailNotfPrefs) {
    transactionCheckQuota { implicit connection =>
      // SECURITY should stop remembering old rows, or prune table if too many old rows. And after that,
      // start allowing over quota here (since will be an update only).

      // Mark the current row as 'O' (old) -- unless EMAIL_NOTFS is 'F'
      // (Forbidden Forever). Then leave it as is, and let the insert
      // below fail.
      // COULD check # rows updated? No, there might be no rows to update.
      db.update("""
          update guest_prefs3
          set VERSION = 'O' -- old
          where SITE_ID = ? and EMAIL = ? and VERSION = 'C'
            and EMAIL_NOTFS != 'F'
          """,
          List(siteId.asAnyRef, emailAddr))

      // Create a new row with the desired email notification setting.
      // Or, for now, fail and throw some SQLException if EMAIL_NOTFS is 'F'
      // for this `emailAddr' -- since there'll be a primary key violation,
      // see the update statement above.
      db.update("""
          insert into guest_prefs3 (
              SITE_ID, CTIME, VERSION, EMAIL, EMAIL_NOTFS)
          values (?, ?, 'C', ?, ?)
          """,
          List(siteId.asAnyRef, d2ts(ctime), emailAddr, _toFlag(emailNotfPrefs)))
    }
  }

}




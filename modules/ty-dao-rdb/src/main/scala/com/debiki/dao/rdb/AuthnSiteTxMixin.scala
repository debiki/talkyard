/**
 * Copyright (C) 2011-2015, 2020 Kaj Magnus Lindberg
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
trait AuthnSiteTxMixin extends SiteTransaction {
  self: RdbSiteTransaction =>


  def nextIdentityId: IdentityId = {
    val query = s"""
      select max(id) max_id from identities3
      where site_id = ?
      """
    runQueryFindExactlyOne(query, List(siteId.asAnyRef), rs => {
      val maxId = rs.getInt("max_id")
      (maxId + 1).toString
    })
  }


  def deleteAllUsersIdentities(userId: UserId) {
    TESTS_MISSING
    val statement =
      "delete from identities3 where user_id = ? and site_id = ?"
    val values = List[AnyRef](userId.asAnyRef, siteId.asAnyRef)
    runUpdate(statement, values)
  }


  def insertIdentity(identity: Identity) {
    identity match {
      case x: IdentityOpenId =>
        die("TyE306WKUD5", "This cannot happen? OpenID 1.0 is since long gone")
      case x: OpenAuthIdentity =>
        insertOpenAuthIdentity(siteId, x)
      case x =>
        die("DwE8UYM0", s"Unknown identity type: ${classNameOf(x)}")
    }
  }


  private def insertOpenAuthIdentity(
        otherSiteId: SiteId, identity: OpenAuthIdentity) {
    val sql = """
        insert into identities3(
            ID, SITE_ID, USER_ID, USER_ID_ORIG,
            FIRST_NAME, LAST_NAME, FULL_NAME, EMAIL, AVATAR_URL,
            AUTH_METHOD, SECURESOCIAL_PROVIDER_ID, SECURESOCIAL_USER_ID)
        values (
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?)"""
    val ds = identity.openAuthDetails
    val method = "OAuth" // should probably remove this column
    val values = List[AnyRef](
      identity.id.toInt.asAnyRef, otherSiteId.asAnyRef, identity.userId.asAnyRef,
      identity.userId.asAnyRef,
      ds.firstName.orNullVarchar, ds.lastName.orNullVarchar,
      ds.fullName.orNullVarchar, ds.email.orNullVarchar, ds.avatarUrl.orNullVarchar,
      method, ds.providerId, ds.providerKey)
    runUpdate(sql, values)
  }


  private[rdb] def updateOpenAuthIdentity(identity: OpenAuthIdentity)
        (implicit connection: js.Connection) {
    val sql = """
      update identities3 set
        USER_ID = ?, AUTH_METHOD = ?,
        FIRST_NAME = ?, LAST_NAME = ?, FULL_NAME = ?, EMAIL = ?, AVATAR_URL = ?
      where ID = ? and SITE_ID = ?"""
    val ds = identity.openAuthDetails
    val method = "OAuth" // should probably remove this column
    val values = List[AnyRef](
      identity.userId.asAnyRef, method, ds.firstName.orNullVarchar, ds.lastName.orNullVarchar,
      ds.fullName.orNullVarchar, ds.email.orNullVarchar, ds.avatarUrl.orNullVarchar,
      identity.id.toInt.asAnyRef, siteId.asAnyRef)
    db.update(sql, values)
  }


  def loadAllIdentities(): immutable.Seq[Identity] = {
    loadIdentitiesImpl(userId = None)
  }


  def loadIdentities(userId: UserId): immutable.Seq[Identity] = {
    loadIdentitiesImpl(Some(userId))
  }


  private def loadIdentitiesImpl(userId: Option[UserId]): immutable.Seq[Identity] = {
    val values = ArrayBuffer(siteId.asAnyRef)
    val andIdEq = userId.map(id => {
      values.append(id.asAnyRef)
      "and i.user_id = ?"
    }) getOrElse ""
    val query = s"""
        select $IdentitySelectListItems
        from identities3 i
        where i.site_id = ? $andIdEq"""
    runQueryFindMany(query, values.toList, rs => {
      val identity = readIdentity(rs)
      dieIf(userId.exists(_ != identity.userId), "TyE2WKBGE5")
      identity
    })
  }


  def loadOpenAuthIdentity(openAuthKey: OpenAuthProviderIdKey): Option[OpenAuthIdentity] = {
    val query = s"""
        select $IdentitySelectListItems
        from identities3 i
        where i.site_id = ?
          and i.securesocial_provider_id = ?
          and i.securesocial_user_id = ?"""
    val values = List(siteId.asAnyRef, openAuthKey.providerId, openAuthKey.providerKey)
    // There's a unique key.
    runQueryFindOneOrNone(query, values, rs => {
      val identity = readIdentity(rs)
      dieIf(!identity.isInstanceOf[OpenAuthIdentity], "TyE5WKB2A1", "Bad class: " + classNameOf(identity))
      val openAuthIdentity = identity.asInstanceOf[OpenAuthIdentity]
      dieIf(openAuthIdentity.openAuthDetails.providerId != openAuthKey.providerId, "TyE2KWB01")
      dieIf(openAuthIdentity.openAuthDetails.providerKey != openAuthKey.providerKey, "TyE2KWB02")
      openAuthIdentity
    })
  }


  private val IdentitySelectListItems = i"""
     |id identity_id,
     |user_id,
     |oid_claimed_id,
     |oid_op_local_id,
     |oid_realm,
     |oid_endpoint,
     |oid_version,
     |securesocial_user_id,
     |securesocial_provider_id,
     |auth_method,
     |first_name i_first_name,
     |last_name i_last_name,
     |full_name i_full_name,
     |email i_email,
     |country i_country,
     |avatar_url i_avatar_url
   """


  def readIdentity(rs: js.ResultSet): Identity = {
    val identityId = rs.getInt("identity_id").toString
    val userId = rs.getInt("user_id")

    val email = Option(rs.getString("i_email"))
    val anyClaimedOpenId = Option(rs.getString("OID_CLAIMED_ID"))
    val anyOpenAuthProviderId = Option(rs.getString("SECURESOCIAL_PROVIDER_ID"))

    val identityInDb = {
      if (anyClaimedOpenId.nonEmpty) {
        IdentityOpenId(
          id = identityId,
          userId = userId,
          // COULD use d2e here, or n2e if I store Null instead of '-'.
          OpenIdDetails(
            oidEndpoint = rs.getString("OID_ENDPOINT"),
            oidVersion = rs.getString("OID_VERSION"),
            oidRealm = rs.getString("OID_REALM"),
            oidClaimedId = anyClaimedOpenId.get,
            oidOpLocalId = rs.getString("OID_OP_LOCAL_ID"),
            firstName = rs.getString("i_first_name"),
            email = email,
            country = rs.getString("i_country")))
      }
      else if (anyOpenAuthProviderId.nonEmpty) {
        OpenAuthIdentity(
          id = identityId,
          userId = userId,
          openAuthDetails = OpenAuthDetails(
            providerId = anyOpenAuthProviderId.get,
            providerKey = rs.getString("SECURESOCIAL_USER_ID"),
            firstName = Option(rs.getString("i_first_name")),
            lastName = Option(rs.getString("i_last_name")),
            fullName = Option(rs.getString("i_full_name")),
            email = email,
            avatarUrl = Option(rs.getString("i_avatar_url"))))
      }
      else {
        die("TyE77GJ2", s"s$siteId: Unknown identity type, id: $identityId, user: $userId")
      }
    }
    identityInDb
  }


  def upsertIdentityProvider(identityProvider: IdentityProvider): AnyProblem = {
    val sql = """
          insert into identity_providers_t(
            site_id_c,
            id_c,
            protocol_c,
            alias_c,
            display_name_c,
            description_c,
            enabled_c,
            trust_verified_email_c,
            link_account_no_login_c,
            gui_order_c,
            sync_mode_c,
            idp_authorization_url_c,
            idp_access_token_url_c,
            idp_user_info_url_c,
            idp_logout_url_c,
            idp_client_id_c,
            idp_client_secret_c,
            idp_issuer_c,
            idp_scopes_c,
            idp_hosted_domain_c,
            idp_send_user_ip_c)
          values (
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          on conflict (site_id_c, id_c) do update set
            protocol_c = excluded.protocol_c,
            alias_c = excluded.alias_c,
            display_name_c = excluded.display_name_c,
            description_c = excluded.description_c,
            enabled_c = excluded.enabled_c,
            trust_verified_email_c = excluded.trust_verified_email_c,
            link_account_no_login_c = excluded.link_account_no_login_c,
            gui_order_c = excluded.gui_order_c,
            sync_mode_c = excluded.sync_mode_c,
            idp_authorization_url_c = excluded.idp_authorization_url_c,
            idp_access_token_url_c = excluded.idp_access_token_url_c,
            idp_user_info_url_c = excluded.idp_user_info_url_c,
            idp_logout_url_c = excluded.idp_logout_url_c,
            idp_client_id_c = excluded.idp_client_id_c,
            idp_client_secret_c = excluded.idp_client_secret_c,
            idp_issuer_c = excluded.idp_issuer_c,
            idp_scopes_c = excluded.idp_scopes_c,
            idp_hosted_domain_c = excluded.idp_hosted_domain_c,
            idp_send_user_ip_c = excluded.idp_send_user_ip_c  """

    // TODO: UK on proto & alias

    val p = identityProvider
    dieIf(p.site_id_c != siteId, "TyE50250RKD53")

    val values = List[AnyRef](
          siteId.asAnyRef,
          p.id_c.asAnyRef,
          p.protocol_c,
          p.alias_c,
          p.display_name_c.orNullVarchar,
          p.description_c.orNullVarchar,
          p.enabled_c.asAnyRef,
          p.trust_verified_email_c.asAnyRef,
          p.link_account_no_login_c.asAnyRef,
          p.gui_order_c.orNullInt,
          p.sync_mode_c.asAnyRef,
          p.idp_authorization_url_c,
          p.idp_access_token_url_c,
          p.idp_user_info_url_c,
          p.idp_logout_url_c.orNullVarchar,
          p.idp_client_id_c,
          p.idp_client_secret_c,
          p.idp_issuer_c.orNullVarchar,
          p.idp_scopes_c.orNullVarchar,
          p.idp_hosted_domain_c.orNullVarchar,
          p.idp_send_user_ip_c.orNullBoolean)

    runUpdate(sql, values)

    SHOULD // capture UK error
    Fine
  }


  def loadIdentityProviderByAlias(protocol: String, alias: String): Option[IdentityProvider] = {
    val query = """
          select * from identity_providers_t
          where site_id_c = ? and protocol_c = ? and alias_c = ? """
    val values = List(siteId.asAnyRef, protocol, alias)
    runQueryFindOneOrNone(query, values, rs => {
      readIdentityProvider(rs)
    })
  }


  def loadAllIdentityProviders(): Seq[IdentityProvider] = {
    val query = """
          select * from identity_providers_t
          where site_id_c = ? """
    runQueryFindMany(query, List(siteId.asAnyRef), rs => {
      readIdentityProvider(rs)
    })
  }


  private def readIdentityProvider(rs: js.ResultSet): IdentityProvider = {
    IdentityProvider(
          site_id_c = rs.getInt("site_id_c"),
          id_c = rs.getInt("id_c"),
          protocol_c = rs.getString("protocol_c"),
          alias_c = rs.getString("alias_c"),
          display_name_c = getOptString(rs, "display_name_c"),
          description_c = getOptString(rs, "description_c"),
          enabled_c = getBool(rs, "enabled_c"),
          trust_verified_email_c = getBool(rs, "trust_verified_email_c"),
          link_account_no_login_c = getBool(rs, "link_account_no_login_c"),
          gui_order_c = getOptInt(rs, "gui_order_c"),
          sync_mode_c = rs.getInt("sync_mode_c"),  //  int not null,
          idp_authorization_url_c = rs.getString("idp_authorization_url_c"),
          idp_access_token_url_c = rs.getString("idp_access_token_url_c"),
          idp_user_info_url_c = rs.getString("idp_user_info_url_c"),
          idp_logout_url_c = getOptString(rs, "idp_logout_url_c"),
          idp_client_id_c = rs.getString("idp_client_id_c"),
          idp_client_secret_c = rs.getString("idp_client_secret_c"),
          idp_issuer_c = getOptString(rs, "idp_issuer_c"),
          idp_scopes_c = getOptString(rs, "idp_scopes_c"),
          idp_hosted_domain_c = getOptString(rs, "idp_hosted_domain_c"),
          idp_send_user_ip_c = getOptBool(rs, "idp_send_user_ip_c"))
  }

}




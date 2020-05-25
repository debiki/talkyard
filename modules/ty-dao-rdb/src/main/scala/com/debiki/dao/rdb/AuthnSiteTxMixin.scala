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
      select max(idty_id_c) max_id from identities3
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
      "delete from identities3 where user_id_c = ? and site_id = ?"
    val values = List[AnyRef](userId.asAnyRef, siteId.asAnyRef)
    runUpdate(statement, values)
  }


  def insertIdentity(identity: Identity) {
    identity match {
      case x: OpenAuthIdentity =>
        insertOpenAuthIdentity(x)
      case x =>
        die("TyE5Q8UYM0", s"Unsupported identity type: ${classNameOf(x)}")
    }
  }


  private def insertOpenAuthIdentity(identity: OpenAuthIdentity) {
    val sql = """
        insert into identities3(
            site_id,
            idty_id_c,
            user_id_c,
            user_id_orig_c,
            conf_file_idp_id_c,
            idp_site_id_c,
            idp_id_c,
            idp_user_id_c,
            idp_user_json_c,
            idp_username_c,
            FIRST_NAME, LAST_NAME, FULL_NAME, EMAIL, AVATAR_URL,
            AUTH_METHOD)
        values (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) """

    val ds = identity.openAuthDetails
    val method = "OAuth" ; CLEAN_UP ; REMOVE // this column

    unimplIf(ds.idpSiteId isSomethingButNot siteId, "TyE204MWKTD2")

    val values = List[AnyRef](
          siteId.asAnyRef,
          identity.id.toInt.asAnyRef,
          identity.userId.asAnyRef,
          identity.userId.asAnyRef,
          ds.confFileIdpId.trimOrNullVarchar,
          ds.idpSiteId.orNullInt,
          ds.idpId.orNullInt,
          ds.idpUserId,
          ds.userInfoJson.orNullJson,
          ds.username.orNullVarchar,
          ds.firstName.orNullVarchar,
          ds.lastName.orNullVarchar,
          ds.fullName.orNullVarchar,
          ds.email.orNullVarchar,
          ds.avatarUrl.orNullVarchar,
          method)

    runUpdate(sql, values)
  }


  private[rdb] def updateOpenAuthIdentity(identity: OpenAuthIdentity) {
    val sql = """
          update identities3 set
            user_id_c = ?,
            idp_user_json_c = ?,
            idp_username_c = ?,
            FIRST_NAME = ?, LAST_NAME = ?, FULL_NAME = ?, EMAIL = ?, AVATAR_URL = ?
          where idty_id_c = ? and site_id = ?"""

    val ds = identity.openAuthDetails

    unimplIf(ds.idpSiteId isSomethingButNot siteId, "TyE204MWKTD3")

    val values = List[AnyRef](
          identity.userId.asAnyRef,
          ds.userInfoJson.orNullJson,
          ds.username.orNullVarchar,
          ds.firstName.orNullVarchar,
          ds.lastName.orNullVarchar,
          ds.fullName.orNullVarchar,
          ds.email.orNullVarchar,
          ds.avatarUrl.orNullVarchar,
          identity.id.toInt.asAnyRef,
          siteId.asAnyRef)

    runUpdate(sql, values)
  }


  def loadAllIdentities(): immutable.Seq[Identity] = {
    loadIdentitiesImpl(userId = None)
  }


  def loadIdentities(userId: UserId): immutable.Seq[Identity] = {
    loadIdentitiesImpl(Some(userId))
  }


  private def loadIdentitiesImpl(userId: Opt[UserId]): immutable.Seq[Identity] = {
    val values = ArrayBuffer(siteId.asAnyRef)
    val andIdEq = userId.map(id => {
      values.append(id.asAnyRef)
      "and i.user_id_c = ?"
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


  def loadOpenAuthIdentity(openAuthKey: OpenAuthProviderIdKey): Opt[OpenAuthIdentity] = {
    val values = MutArrBuf[AnyRef](siteId.asAnyRef)

    val idpIdIsWhat = openAuthKey.confFileIdpId match {
      case Some(confFileIdpId) =>
        values.append(confFileIdpId)
        // ix: idtys_u_conffileidpid_idpusrid
        "i.conf_file_idp_id_c = ?"
      case None =>
        values.append(openAuthKey.idpSiteId.getOrDie("TyE305MRKT2").asAnyRef)
        values.append(openAuthKey.idpId.getOrDie("TyE705MRK41").asAnyRef)
        // ix: idtys_u_idpsiteid_idpid_idpuserid
        "( i.idp_site_id_c = ?  and  i.idp_id_c = ? )"
    }

    val query = s"""
        select $IdentitySelectListItems
        from identities3 i
        where i.site_id = ?
          and $idpIdIsWhat
          and i.idp_user_id_c = ? """

    values.append(openAuthKey.idpUserId)

    runQueryFindOneOrNone(query, values.toList, rs => {
      val identity = readIdentity(rs)
      dieIf(!identity.isInstanceOf[OpenAuthIdentity],
            "TyE5WKB2A1", s"Bad class: ${classNameOf(identity)}")
      val idty = identity.asInstanceOf[OpenAuthIdentity]
      dieIf(idty.openAuthDetails.confFileIdpId != openAuthKey.confFileIdpId, "TyE2KWB01")
      dieIf(idty.openAuthDetails.idpSiteId != openAuthKey.idpSiteId, "TyE2KW503G")
      dieIf(idty.openAuthDetails.idpId != openAuthKey.idpId, "TyE2KW503R")
      dieIf(idty.openAuthDetails.idpUserId != openAuthKey.idpUserId, "TyE2KWB02")
      unimplIf(idty.openAuthDetails.idpSiteId isSomethingButNot siteId, "TyE2KW40ST7")
      idty
    })
  }


  private val IdentitySelectListItems = i"""
     |idty_id_c,
     |user_id_c,
     |conf_file_idp_id_c,
     |idp_site_id_c,
     |idp_id_c,
     |idp_user_id_c,
     |idp_user_json_c,  -- for now, for debugging
     |oid_claimed_id,
     |oid_op_local_id,
     |oid_realm,
     |oid_endpoint,
     |oid_version,
     |auth_method,
     |idp_username_c,
     |first_name i_first_name,
     |last_name i_last_name,
     |full_name i_full_name,
     |email i_email,
     |country i_country,
     |avatar_url i_avatar_url
   """


  def readIdentity(rs: js.ResultSet): Identity = {
    val identityId = rs.getInt("idty_id_c").toString
    val userId = rs.getInt("user_id_c")

    val email = Option(rs.getString("i_email"))
    val anyClaimedOpenId = Option(rs.getString("OID_CLAIMED_ID"))
    val anyConfFileIdpId = getOptString(rs, "conf_file_idp_id_c")
    val anyIdpSiteId = getOptInt(rs, "idp_site_id_c")
    val anyIdpId = getOptInt(rs, "idp_id_c")

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
      else if (anyConfFileIdpId.isDefined || anyIdpId.isDefined) {
        OpenAuthIdentity(
          id = identityId,
          userId = userId,
          openAuthDetails = OpenAuthDetails(
            confFileIdpId = anyConfFileIdpId,
            idpSiteId = anyIdpSiteId,
            idpId = anyIdpId,
            idpUserId = getOptString(rs, "idp_user_id_c").getOrElse(""),
            username = getOptString(rs, "idp_username_c"),
            firstName = getOptString(rs, "i_first_name"),
            lastName = getOptString(rs, "i_last_name"),
            fullName = getOptString(rs, "i_full_name"),
            email = email,
            avatarUrl = getOptString(rs, "i_avatar_url")))
      }
      else {
        die("TyE77GJ2", s"s$siteId: Unknown identity type, id: $identityId, user: $userId")
      }
    }
    identityInDb
  }


  def upsertIdentityProvider(identityProvider: IdentityProvider): AnyProblem = {
    val sql = """
          insert into idps_t(
            site_id_c,
            idp_id_c,
            protocol_c,
            alias_c,
            enabled_c,
            display_name_c,
            description_c,
            admin_comments_c,
            trust_verified_email_c,
            link_account_no_login_c,
            gui_order_c,
            sync_mode_c,
            idp_authorization_url_c,
            idp_access_token_url_c,
            idp_access_token_auth_method_c,
            idp_user_info_url_c,
            idp_user_info_fields_map_c,
            idp_logout_url_c,
            idp_client_id_c,
            idp_client_secret_c,
            idp_issuer_c,
            auth_req_scope_c,
            auth_req_hosted_domain_c,
            userinfo_req_send_user_ip_c)
          values (
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          on conflict (site_id_c, idp_id_c) do update set
            protocol_c = excluded.protocol_c,
            alias_c = excluded.alias_c,
            enabled_c = excluded.enabled_c,
            display_name_c = excluded.display_name_c,
            description_c = excluded.description_c,
            admin_comments_c = excluded.admin_comments_c,
            trust_verified_email_c = excluded.trust_verified_email_c,
            link_account_no_login_c = excluded.link_account_no_login_c,
            gui_order_c = excluded.gui_order_c,
            sync_mode_c = excluded.sync_mode_c,
            idp_authorization_url_c = excluded.idp_authorization_url_c,
            idp_access_token_url_c = excluded.idp_access_token_url_c,
            idp_access_token_auth_method_c = excluded.idp_access_token_auth_method_c,
            idp_user_info_url_c = excluded.idp_user_info_url_c,
            idp_user_info_fields_map_c = excluded.idp_user_info_fields_map_c,
            idp_logout_url_c = excluded.idp_logout_url_c,
            idp_client_id_c = excluded.idp_client_id_c,
            idp_client_secret_c = excluded.idp_client_secret_c,
            idp_issuer_c = excluded.idp_issuer_c,
            auth_req_scope_c = excluded.auth_req_scope_c,
            auth_req_hosted_domain_c = excluded.auth_req_hosted_domain_c,
            userinfo_req_send_user_ip_c = excluded.userinfo_req_send_user_ip_c  """

    val p = identityProvider

    val values = List[AnyRef](
          siteId.asAnyRef,
          p.idpId.getOrDie("TyEIDP0CUST2802").asAnyRef,
          p.protocol_c,
          p.alias_c,
          p.enabled_c.asAnyRef,
          p.display_name_c.orNullVarchar,
          p.description_c.orNullVarchar,
          p.admin_comments_c.orNullVarchar,
          p.trust_verified_email_c.asAnyRef,
          p.link_account_no_login_c.asAnyRef,
          p.gui_order_c.orNullInt,
          p.sync_mode_c.asAnyRef,
          p.idp_authorization_url_c,
          p.idp_access_token_url_c,
          p.idp_access_token_auth_method_c.orNullVarchar,
          p.idp_user_info_url_c,
          p.idp_user_info_fields_map_c.orNullJson,
          p.idp_logout_url_c.orNullVarchar,
          p.idp_client_id_c,
          p.idp_client_secret_c,
          p.idp_issuer_c.orNullVarchar,
          p.auth_req_scope_c.orNullVarchar,
          p.auth_req_hosted_domain_c.orNullVarchar,
          p.userinfo_req_send_user_ip_c.orNullBoolean)

    runUpdateExactlyOneRow(sql, values)

    SHOULD // capture UK error
    Fine
  }


  def deleteIdentityProviderById(idpId: IdpId): Bo = {
    val sql = "delete from idps_t where site_id_c = ? and idp_id_c = ?"
    val values = List(siteId.asAnyRef, idpId.asAnyRef)
    runUpdateSingleRow(sql, values)
  }


  def loadIdentityProviderByAlias(protocol: St, alias: St): Opt[IdentityProvider] = {
    val query = """
          select * from idps_t
          where site_id_c = ? and protocol_c = ? and alias_c = ? """
    val values = List(siteId.asAnyRef, protocol, alias)
    runQueryFindOneOrNone(query, values, rs => {
      readIdentityProvider(rs)
    })
  }


  def loadAllIdentityProviders(): Seq[IdentityProvider] = {
    // Later: How know which IDPs to load from any authn site?
    // Maybe could be a link column?  idty_id_c
    // Can load via this index:  idtys_u_idpsiteid_idpid_idpuserid
    // i.e. site_id, fk site id, fk idp id.
    // Won't be more than a handful: Gmail, FB, Twitter, ...  .
    //   +  is_enabled_c and is_server_global_c.

    val query = """
          select * from idps_t
          where site_id_c = ? """
    runQueryFindMany(query, List(siteId.asAnyRef), rs => {
      readIdentityProvider(rs)
    })
  }


  private def readIdentityProvider(rs: js.ResultSet): IdentityProvider = {
    IdentityProvider(
          idpSiteId = Some(siteId),
          idpId = Some(getInt(rs, "idp_id_c")),
          protocol_c = rs.getString("protocol_c"),
          alias_c = rs.getString("alias_c"),
          enabled_c = getBool(rs, "enabled_c"),
          display_name_c = getOptString(rs, "display_name_c"),
          description_c = getOptString(rs, "description_c"),
          admin_comments_c = getOptString(rs, "admin_comments_c"),
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
          auth_req_scope_c = getOptString(rs, "auth_req_scope_c"),
          auth_req_hosted_domain_c = getOptString(rs, "auth_req_hosted_domain_c"),
          userinfo_req_send_user_ip_c = getOptBool(rs, "userinfo_req_send_user_ip_c"))
  }

}




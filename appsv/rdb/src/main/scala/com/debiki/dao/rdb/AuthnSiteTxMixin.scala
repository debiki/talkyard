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

import scala.collection.Seq
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


  def deleteAllUsersIdentities(userId: UserId): Unit = {
    TESTS_MISSING
    val statement =
      "delete from identities3 where user_id_c = ? and site_id = ?"
    val values = List[AnyRef](userId.asAnyRef, siteId.asAnyRef)
    runUpdate(statement, values)
  }


  def insertIdentity(identity: Identity): Unit = {
    identity match {
      case x: OpenAuthIdentity =>
        insertOpenAuthIdentity(x)
      case x =>
        die("TyE5Q8UYM0", s"Unsupported identity type: ${classNameOf(x)}")
    }
  }


  private def insertOpenAuthIdentity(identity: OpenAuthIdentity): Unit = {
    val sql = """
        insert into identities3 (
            site_id,
            idty_id_c,
            inserted_at_c,
            user_id_c,
            user_id_orig_c,
            conf_file_idp_id_c,
            idp_id_c,
            idp_user_id_c,
            idp_realm_id_c,
            idp_realm_user_id_c,
            issuer_c,
            pref_username_c,
            nickname_c,
            first_name_c,
            middle_name_c,
            last_name_c,
            full_name_c,
            email_adr_c,
            is_email_verified_by_idp_c,
            phone_nr_c,
            is_phone_nr_verified_by_idp_c,
            profile_url_c,
            website_url_c,
            picture_url_c,
            gender_c,
            birthdate_c,
            time_zone_info_c,
            country_c,
            locale_c,
            is_realm_guest_c,
            last_updated_at_idp_at_sec_c,
            idp_user_json_c)
        values (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) """

    val ds = identity.openAuthDetails

    val values = List[AnyRef](
          siteId.asAnyRef,
          identity.id.toInt.asAnyRef,
          now.asTimestamp,
          identity.userId.asAnyRef,
          identity.userId.asAnyRef,
          ds.confFileIdpId.trimOrNullVarchar,
          ds.idpId.orNullInt,
          ds.idpUserId,
          ds.idpRealmId.trimOrNullVarchar,
          ds.idpRealmUserId.trimOrNullVarchar,
          ds.issuer.trimOrNullVarchar,
          ds.username.trimOrNullVarchar,
          ds.nickname.trimOrNullVarchar,
          ds.firstName.trimOrNullVarchar,
          ds.middleName.trimOrNullVarchar,
          ds.lastName.trimOrNullVarchar,
          ds.fullName.trimOrNullVarchar,
          ds.email.trimOrNullVarchar,
          ds.isEmailVerifiedByIdp.orNullBoolean,
          ds.phoneNumber.trimOrNullVarchar,
          ds.isPhoneNumberVerifiedByIdp.orNullBoolean,
          ds.profileUrl.trimOrNullVarchar,
          ds.websiteUrl.trimOrNullVarchar,
          ds.avatarUrl.trimOrNullVarchar,
          ds.gender.trimOrNullVarchar,
          ds.birthdate.trimOrNullVarchar,
          ds.timeZoneInfo.trimOrNullVarchar,
          ds.country.trimOrNullVarchar,
          ds.locale.trimOrNullVarchar,
          ds.isRealmGuest.orNullBoolean,
          ds.lastUpdatedAtIdpAtSec.orNullI64,
          ds.userInfoJson.orNullJson)

    runUpdate(sql, values)
  }


  /** Updates an external identity, e.g. Gmail user, with more recent data
    * (e.g. the user changed hens name) from the OAuth authentication process
    * the caller would be handling.
    */
  private[rdb] def updateOpenAuthIdentity(identity: OpenAuthIdentity): Unit = {
    // About idpId, idpUserId:
    // They should have been used when looking up this user identity
    // — and should never need to get changed.
    // Maybe should fail with an error, if they're different?
    //
    // These: idpRealmId, idpRealmUserId
    // They also shouldn't change. Unless the OIDC settings get changed completely:
    // new client id, or new OIDC realm, e.g. connects to a different Azure AD or
    // Keycloak realm.

    val sqlStmt = """
          update identities3 set
            user_id_c = ?,
            conf_file_idp_id_c = ?,
            idp_id_c = ?,
            idp_user_id_c = ?,
            idp_realm_id_c = ?,
            idp_realm_user_id_c = ?,
            issuer_c = ?,
            pref_username_c = ?,
            nickname_c = ?,
            first_name_c = ?,
            middle_name_c = ?,
            last_name_c = ?,
            full_name_c = ?,
            email_adr_c = ?,
            is_email_verified_by_idp_c = ?,
            phone_nr_c = ?,
            is_phone_nr_verified_by_idp_c = ?,
            profile_url_c = ?,
            website_url_c = ?,
            picture_url_c = ?,
            gender_c = ?,
            birthdate_c = ?,
            time_zone_info_c = ?,
            country_c = ?,
            locale_c = ?,
            is_realm_guest_c = ?,
            last_updated_at_idp_at_sec_c = ?,
            idp_user_json_c = ?
          where idty_id_c = ? and site_id = ?"""

    val ds = identity.openAuthDetails

    val values = List[AnyRef](
          identity.userId.asAnyRef,
          ds.confFileIdpId.orNullVarchar,
          ds.idpId.orNullInt,
          ds.idpUserId,
          ds.idpRealmId.orNullVarchar,
          ds.idpRealmUserId.orNullVarchar,
          ds.issuer.orNullVarchar,
          ds.username.orNullVarchar,
          ds.nickname.orNullVarchar,
          ds.firstName.orNullVarchar,
          ds.middleName.orNullVarchar,
          ds.lastName.orNullVarchar,
          ds.fullName.orNullVarchar,
          ds.email.orNullVarchar,
          ds.isEmailVerifiedByIdp.orNullBoolean,
          ds.phoneNumber.orNullVarchar,
          ds.isPhoneNumberVerifiedByIdp.orNullBoolean,
          ds.profileUrl.orNullVarchar,
          ds.websiteUrl.orNullVarchar,
          ds.avatarUrl.orNullVarchar,
          ds.gender.orNullVarchar,
          ds.birthdate.orNullVarchar,
          ds.timeZoneInfo.orNullVarchar,
          ds.country.orNullVarchar,
          ds.locale.orNullVarchar,
          ds.isRealmGuest.orNullBoolean,
          ds.lastUpdatedAtIdpAtSec.orNullI64,
          ds.userInfoJson.orNullJson,
          identity.id.toInt.asAnyRef,
          siteId.asAnyRef)

    runUpdate(sqlStmt, values)
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
      "and user_id_c = ?"
    }) getOrElse ""
    val query = s"""
        select $IdentitySelectListItems
        from identities3
        where site_id = ? $andIdEq"""
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
        "conf_file_idp_id_c = ?"
      case None =>
        values.append(openAuthKey.idpId.getOrDie("TyE705MRK41").asAnyRef)
        // ix: idtys_u_idpid_idpuserid
        "idp_id_c = ?"
    }

    val query = s"""
        select $IdentitySelectListItems
        from identities3
        where site_id = ?
          and $idpIdIsWhat
          and idp_user_id_c = ? """

    values.append(openAuthKey.idpUserId)

    runQueryFindOneOrNone(query, values.toList, rs => {
      val identity = readIdentity(rs)
      dieIf(!identity.isInstanceOf[OpenAuthIdentity],
            "TyE5WKB2A1", s"Bad class: ${classNameOf(identity)}")
      val idty = identity.asInstanceOf[OpenAuthIdentity]
      dieIf(idty.openAuthDetails.confFileIdpId != openAuthKey.confFileIdpId, "TyE2KWB01")
      dieIf(idty.openAuthDetails.idpId != openAuthKey.idpId, "TyE2KW503R")
      dieIf(idty.openAuthDetails.idpUserId != openAuthKey.idpUserId, "TyE2KWB02")
      idty
    })
  }


  COULD_OPTIMIZE // don't need all columns
  private val IdentitySelectListItems = "*"    /* i"""
     |idty_id_c,
     |user_id_c,
     |conf_file_idp_id_c,
     |idp_id_c,
     |idp_user_id_c,
     |idp_user_json_c,  -- for now, for debugging
     |oid_claimed_id,
     |oid_op_local_id,
     |oid_realm,
     |oid_endpoint,
     |oid_version,
     |idp_username_c,
     |first_name_c,
     |last_name_c,
     |full_name_c,
     |email_adr_c,
     |country_c,
     |picture_url_c
     |""" */


  private def readIdentity(rs: js.ResultSet): Identity = {
    val identityId = rs.getInt("idty_id_c").toString
    val userId = rs.getInt("user_id_c")

    val email = Option(rs.getString("email_adr_c"))
    val anyClaimedOpenId = Option(rs.getString("OID_CLAIMED_ID"))
    val anyConfFileIdpId = getOptString(rs, "conf_file_idp_id_c")
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
            firstName = rs.getString("first_name_c"),
            email = email,
            country = rs.getString("country_c")))
      }
      else if (anyConfFileIdpId.isDefined || anyIdpId.isDefined) {
        OpenAuthIdentity(
          id = identityId,
          userId = userId,
          openAuthDetails = OpenAuthDetails(
            confFileIdpId = anyConfFileIdpId,
            idpId = anyIdpId,
            idpUserId = getOptString(rs, "idp_user_id_c").getOrElse(""),
            idpRealmId = getOptString(rs, "idp_realm_id_c"),
            idpRealmUserId = getOptString(rs, "idp_realm_user_id_c"),
            issuer = getOptString(rs, "issuer_c"),
            username = getOptString(rs, "pref_username_c"),
            nickname = getOptString(rs, "nickname_c"),
            firstName = getOptString(rs, "first_name_c"),
            middleName = getOptString(rs, "middle_name_c"),
            lastName = getOptString(rs, "last_name_c"),
            fullName = getOptString(rs, "full_name_c"),
            email = email,
            isEmailVerifiedByIdp = getOptBo(rs, "is_email_verified_by_idp_c"),
            phoneNumber = getOptString(rs, "phone_nr_c"),
            isPhoneNumberVerifiedByIdp = getOptBo(rs, "is_phone_nr_verified_by_idp_c"),
            profileUrl = getOptString(rs, "profile_url_c"),
            websiteUrl = getOptString(rs, "website_url_c"),
            avatarUrl = getOptString(rs, "picture_url_c"),
            gender = getOptString(rs, "gender_c"),
            birthdate = getOptString(rs, "birthdate_c"),
            timeZoneInfo = getOptString(rs, "time_zone_info_c"),
            country = getOptString(rs, "country_c"),
            locale = getOptString(rs, "locale_c"),
            isRealmGuest = getOptBo(rs, "is_realm_guest_c"),
            lastUpdatedAtIdpAtSec = getOptI64(rs, "last_updated_at_idp_at_sec_c")))
      }
      else {
        die("TyE77GJ2", s"s$siteId: Unknown identity type, id: $identityId, user: $userId")
      }
    }
    identityInDb
  }


  def upsertIdentityProvider(idp: IdentityProvider): AnyProblem = {
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
            email_verified_domains_c,
            link_account_no_login_c,
            gui_order_c,
            sync_mode_c,
            oau_authorization_url_c,
            oau_auth_req_scope_c,
            oau_auth_req_claims_c,
            oau_auth_req_hosted_domain_c,
            oau_access_token_url_c,
            oau_access_token_auth_method_c,
            oau_client_id_c,
            oau_client_secret_c,
            oau_issuer_c,
            oidc_user_info_url_c,
            oidc_user_info_fields_map_c,
            oidc_userinfo_req_send_user_ip_c,
            oidc_logout_url_c)
          values (
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?, ?, ?)
          on conflict (site_id_c, idp_id_c) do update set
            protocol_c = excluded.protocol_c,
            alias_c = excluded.alias_c,
            enabled_c = excluded.enabled_c,
            display_name_c = excluded.display_name_c,
            description_c = excluded.description_c,
            admin_comments_c = excluded.admin_comments_c,
            trust_verified_email_c = excluded.trust_verified_email_c,
            email_verified_domains_c = excluded.email_verified_domains_c,
            link_account_no_login_c = excluded.link_account_no_login_c,
            gui_order_c = excluded.gui_order_c,
            sync_mode_c = excluded.sync_mode_c,
            oau_authorization_url_c = excluded.oau_authorization_url_c,
            oau_auth_req_scope_c = excluded.oau_auth_req_scope_c,
            oau_auth_req_claims_c = excluded.oau_auth_req_claims_c,
            oau_auth_req_hosted_domain_c = excluded.oau_auth_req_hosted_domain_c,
            oau_access_token_url_c = excluded.oau_access_token_url_c,
            oau_access_token_auth_method_c = excluded.oau_access_token_auth_method_c,
            oau_client_id_c = excluded.oau_client_id_c,
            oau_client_secret_c = excluded.oau_client_secret_c,
            oau_issuer_c = excluded.oau_issuer_c,
            oidc_user_info_url_c = excluded.oidc_user_info_url_c,
            oidc_user_info_fields_map_c = excluded.oidc_user_info_fields_map_c,
            oidc_userinfo_req_send_user_ip_c = excluded.oidc_userinfo_req_send_user_ip_c,
            oidc_logout_url_c = excluded.oidc_logout_url_c  """

    val values = List[AnyRef](
          siteId.asAnyRef,
          idp.idpId.getOrDie("TyEIDP0CUST2802").asAnyRef,
          idp.protocol,
          idp.alias,
          idp.enabled.asAnyRef,
          idp.displayName.orNullVarchar,
          idp.description.orNullVarchar,
          idp.adminComments.orNullVarchar,
          idp.trustVerifiedEmail.asAnyRef,
          idp.emailVerifiedDomains.orNullVarchar,
          idp.linkAccountNoLogin.asAnyRef,
          idp.guiOrder.orNullInt,
          idp.syncMode.asAnyRef,
          idp.oauAuthorizationUrl,
          idp.oauAuthReqScope.orNullVarchar,
          idp.oauAuthReqClaims.orNullJson,
          idp.oauAuthReqHostedDomain.orNullVarchar,
          idp.oauAccessTokenUrl,
          idp.oauAccessTokenAuthMethod.orNullVarchar,
          idp.oauClientId,
          idp.oauClientSecret,
          idp.oauIssuer.orNullVarchar,
          idp.oidcUserInfoUrl,
          idp.oidcUserInfoFieldsMap.orNullJson,
          idp.oidcUserinfoReqSendUserIp.orNullBoolean,
          idp.oidcLogoutUrl.orNullVarchar)

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


  def loadAllSiteCustomIdentityProviders(): Seq[IdentityProvider] = {
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
    val rsSiteId = getInt(rs, "site_id_c")
    dieIf(rsSiteId != siteId, "TyE4056MAKST2")
    IdentityProvider(
          confFileIdpId = None,
          idpId = Some(getInt(rs, "idp_id_c")),
          protocol = rs.getString("protocol_c"),
          alias = rs.getString("alias_c"),
          enabled = getBool(rs, "enabled_c"),
          displayName = getOptString(rs, "display_name_c"),
          description = getOptString(rs, "description_c"),
          adminComments = getOptString(rs, "admin_comments_c"),
          trustVerifiedEmail = getBool(rs, "trust_verified_email_c"),
          emailVerifiedDomains = getOptString(rs, "email_verified_domains_c"),
          linkAccountNoLogin = getBool(rs, "link_account_no_login_c"),
          guiOrder = getOptInt(rs, "gui_order_c"),
          syncMode = rs.getInt("sync_mode_c"),  //  int not null,
          oauAuthorizationUrl = rs.getString("oau_authorization_url_c"),
          oauAuthReqScope = getOptString(rs, "oau_auth_req_scope_c"),
          oauAuthReqClaims = getOptJsObject(rs, "oau_auth_req_claims_c"),
          oauAuthReqHostedDomain = getOptString(rs, "oau_auth_req_hosted_domain_c"),
          oauAccessTokenUrl = rs.getString("oau_access_token_url_c"),
          oauAccessTokenAuthMethod = getOptString(rs, "oau_access_token_auth_method_c"),
          oauClientId = rs.getString("oau_client_id_c"),
          oauClientSecret = rs.getString("oau_client_secret_c"),
          oauIssuer = getOptString(rs, "oau_issuer_c"),
          oidcUserInfoUrl = rs.getString("oidc_user_info_url_c"),
          oidcUserInfoFieldsMap = getOptJsObject(rs, "oidc_user_info_fields_map_c"),
          oidcUserinfoReqSendUserIp = getOptBool(rs, "oidc_userinfo_req_send_user_ip_c"),
          oidcLogoutUrl = getOptString(rs, "oidc_logout_url_c"))
  }

}




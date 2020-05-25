/**
 * Copyright (c) 2020 Kaj Magnus Lindberg
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

package talkyard.server.auth   // MOVE to  authn

import com.debiki.core._
import debiki.dao.{DaoAppSuite, SiteDao}


class AuthOidcAppSpec extends DaoAppSuite {     RENAME // to IdentityProviderAppSpec

  val when: When = When.fromMillis(3100010001000L)
  val createdAt: When = when.minusMillis(10001000)

  lazy val daoSite1: SiteDao = {
    globals.systemDao.getOrCreateFirstSite()
    globals.siteDao(Site.FirstSiteId)
  }

  lazy val forumId: PageId = daoSite1.createForum(
        title = "Forum to delete", folder = "/", isForEmbCmts = false,
        Who(SystemUserId, browserIdData)).get.pagePath.pageId

  lazy val (site2, daoSite2) = createSite("site2")

  lazy val forumSite2Id: PageId = daoSite2.createForum(
        title = "Forum site 2", folder = "/", isForEmbCmts = false,
        Who(SystemUserId, browserIdData)).get.pagePath.pageId


  /*
  def makeAndUpsertStats(dao: SiteDao, userId: UserId, minutes: Int): UserStats = {
    val stats = UserStats(
      userId,
      lastSeenAt = when,
      firstSeenAtOr0 = when minusDays 10,
      topicsNewSince = when,
      nextSummaryEmailAt = Some(when plusMinutes minutes),
      tourTipsSeen = Some(Vector.empty))  // [7AKBR24] change Null in db and None here, to empty array?
    dao.readWriteTransaction(_.upsertUserStats(stats))
    stats
  } */


  "prepare: create site 1 and 2" in {
    daoSite1 // creates site 1
    daoSite2 // creates site 2, incl owner
  }


  lazy val oidcProvider = IdentityProvider(
        idpSiteId = Some(daoSite1.siteId),
        idpId = Some(1),
        protocol_c = "oidc",
        alias_c = "odic_alias_site_1",
        enabled_c = true,
        display_name_c = Some("OIDC Displ Name"),
        description_c = Some("description_c"),
        admin_comments_c = None,
        trust_verified_email_c = true,
        link_account_no_login_c = false,
        gui_order_c = None,
        sync_mode_c = 1,  // for now, always 1 = ImportOnFirstLogin, later, also: SyncOnAllLogins
        idp_authorization_url_c = "op_authorization_url_c",
        idp_access_token_url_c = "op_access_token_url_c",
        idp_user_info_url_c = "op_user_info_url_c",
        idp_logout_url_c = None,
        idp_client_id_c = "op_client_id_c",
        idp_client_secret_c = "op_client_secret_c",
        idp_issuer_c = Some("op_issuer_c"),
        auth_req_scope_c = Some("openid auth_req_scope_c"),
        auth_req_hosted_domain_c = Some("auth_req_hosted_domain_c"),
        userinfo_req_send_user_ip_c = None)

  lazy val oidcProviderEdited = IdentityProvider(
        idpSiteId = oidcProvider.idpSiteId,
        idpId = oidcProvider.idpId,
        protocol_c = "oauth2",
        alias_c = oidcProvider.alias_c + "_edited",
        enabled_c = !oidcProvider.enabled_c,
        display_name_c = oidcProvider.display_name_c.map(_ + " Edited"),
        description_c = oidcProvider.description_c.map(_ + " Edited"),
        admin_comments_c = Some("Some comments"),
        trust_verified_email_c = !oidcProvider.trust_verified_email_c,
        link_account_no_login_c = !oidcProvider.link_account_no_login_c,
        gui_order_c = Some(123),
        sync_mode_c = 2,
        idp_authorization_url_c = oidcProvider.idp_authorization_url_c + "_edited",
        idp_access_token_url_c = oidcProvider.idp_access_token_url_c + "_edited",
        idp_user_info_url_c = oidcProvider.idp_user_info_url_c + "_edited",
        idp_logout_url_c = Some("idp_logout_url_c"),
        idp_client_id_c = oidcProvider.idp_client_id_c + "_edited",
        idp_client_secret_c = oidcProvider.idp_client_secret_c + "_edited",
        idp_issuer_c = oidcProvider.idp_issuer_c.map(_ + "_edited"),
        auth_req_scope_c = oidcProvider.auth_req_scope_c.map(_ + "_edited"),
        auth_req_hosted_domain_c = oidcProvider.auth_req_hosted_domain_c.map(_ + "_edited"),
        userinfo_req_send_user_ip_c = Some(true))


  "insert, find, update, find AuthN providers" - {
    "insert" in {
      daoSite1.writeTx { (tx, _) =>
        tx.upsertIdentityProvider(oidcProvider)
      }
    }

    "read back" in {
      daoSite1.readTx { tx =>
        val x = tx.loadIdentityProviderByAlias(oidcProvider.protocol_c, oidcProvider.alias_c)
        x.get mustBe oidcProvider
      }
    }

    "update" in {
      daoSite1.writeTx { (tx, _) =>
        tx.upsertIdentityProvider(oidcProviderEdited)
      }
    }

    "read back after update" in {
      daoSite1.readTx { tx =>
        // The original one is gone.
        tx.loadIdentityProviderByAlias(
              oidcProvider.protocol_c, oidcProvider.alias_c) mustBe None

        // New:
        tx.loadAllIdentityProviders() mustBe Seq(oidcProviderEdited)

        // New:
        tx.loadIdentityProviderByAlias(
              oidcProviderEdited.protocol_c, oidcProviderEdited.alias_c
              ) mustBe Some(oidcProviderEdited)
      }
    }

    "delete" in {
      daoSite1.writeTx { (tx, _) =>
        tx.deleteIdentityProviderById(oidcProviderEdited.idpId.get)
        tx.loadAllIdentityProviders() mustBe Nil
      }
    }

    "re-insert the now deleted IDP, the + '_edited' version" in {
      daoSite1.writeTx { (tx, _) =>
        tx.upsertIdentityProvider(oidcProviderEdited)
      }
    }

    "find it again" in {
      daoSite1.readTx { tx =>
        tx.loadAllIdentityProviders() mustBe Seq(oidcProviderEdited)
      }
    }
  }

}

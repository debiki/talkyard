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

package talkyard.server.auth

import com.debiki.core._
import debiki.dao.{DaoAppSuite, SiteDao}


class AuthOidcAppSpec extends DaoAppSuite {

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
  }


  "prepare: create site 1 and 2" in {
    daoSite1 // creates site 1
    daoSite2 // creates site 2, incl owner
  }


  lazy val oidcProvider = IdentityProvider(
        site_id_c = daoSite1.siteId,
        id_c = 1,
        protocol_c = "oidc",
        alias_c = "odic_alias_site_1",
        display_name_c = Some("OIDC Displ Name"),
        description_c = Some("description_c"),
        enabled_c = true,
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
        idp_scopes_c = Some("op_scopes_c"),
        idp_hosted_domain_c = Some("op_hosted_domain_c"),
        idp_send_user_ip_c = None)

  lazy val oidcProviderEdited = IdentityProvider(
        site_id_c = oidcProvider.site_id_c,
        id_c = oidcProvider.id_c,
        protocol_c = "oauth2",
        alias_c = oidcProvider.alias_c + "_edited",
        display_name_c = oidcProvider.display_name_c.map(_ + " Edited"),
        description_c = oidcProvider.description_c.map(_ + " Edited"),
        enabled_c = !oidcProvider.enabled_c,
        trust_verified_email_c = !oidcProvider.trust_verified_email_c,
        link_account_no_login_c = !oidcProvider.link_account_no_login_c,
        gui_order_c = oidcProvider.gui_order_c.map(_ + 1),
        sync_mode_c = 1,
        idp_authorization_url_c = oidcProvider.idp_authorization_url_c + "_edited",
        idp_access_token_url_c = oidcProvider.idp_access_token_url_c + "_edited",
        idp_user_info_url_c = oidcProvider.idp_user_info_url_c + "_edited",
        idp_logout_url_c = oidcProvider.idp_logout_url_c.map(_ + "_edited"),
        idp_client_id_c = oidcProvider.idp_client_id_c + "_edited",
        idp_client_secret_c = oidcProvider.idp_client_secret_c + "_edited",
        idp_issuer_c = oidcProvider.idp_issuer_c.map(_ + "_edited"),
        idp_scopes_c = oidcProvider.idp_scopes_c.map(_ + "_edited"),
        idp_hosted_domain_c = oidcProvider.idp_hosted_domain_c.map(_ + "_edited"),
        idp_send_user_ip_c = oidcProvider.idp_send_user_ip_c.map(!_))


  "insert, find, update, find AuthN providers" - {
    "insert" in {
      daoSite1.readWriteTransaction { tx =>
        tx.upsertIdentityProvider(oidcProvider)
      }
    }

    "read back" in {
      daoSite1.readOnlyTransaction { tx =>
        val x = tx.loadIdentityProviderByAlias(oidcProvider.protocol_c, oidcProvider.alias_c)
        x.get mustBe oidcProvider
      }
    }

    "update" in {
      daoSite1.readWriteTransaction { tx =>
        tx.upsertIdentityProvider(oidcProviderEdited)
      }
    }

    "read back after update" in {
      daoSite1.readWriteTransaction { tx =>
        // The original one is gone.
        tx.loadIdentityProviderByAlias(
              oidcProvider.protocol_c, oidcProvider.alias_c) mustBe None

        // New:
        tx.loadIdentityProviderByAlias(
              oidcProviderEdited.protocol_c, oidcProviderEdited.alias_c
              ) mustBe Some(oidcProviderEdited)
      }
    }
  }

}

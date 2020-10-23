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
        protocol = "oidc",
        alias = "odic_alias_site_1",
        enabled = true,
        displayName = Some("OIDC Displ Name"),
        description = Some("description_c"),
        adminComments = None,
        trustVerifiedEmail = true,
        linkAccountNoLogin = false,
        guiOrder = None,
        syncMode = 1,  // for now, always 1 = ImportOnFirstLogin, later, also: SyncOnAllLogins
        oauAuthorizationUrl = "op_authorization_url_c",
        oauAuthReqScope = Some("openid oau_auth_req_scope_c"),
        oauAuthReqHostedDomain = Some("oau_auth_req_hosted_domain_c"),
        oauAccessTokenUrl = "op_access_token_url_c",
        oauClientId = "op_client_id_c",
        oauClientSecret = "op_client_secret_c",
        oauIssuer = Some("op_issuer_c"),
        oidcUserInfoUrl = "op_user_info_url_c",
        oidcUserinfoReqSendUserIp = None,
        oidcLogoutUrl = None)

  lazy val oidcProviderEdited = IdentityProvider(
        idpSiteId = oidcProvider.idpSiteId,
        idpId = oidcProvider.idpId,
        protocol = "oauth2",
        alias = oidcProvider.alias + "_edited",
        enabled = !oidcProvider.enabled,
        displayName = oidcProvider.displayName.map(_ + " Edited"),
        description = oidcProvider.description.map(_ + " Edited"),
        adminComments = Some("Some comments"),
        trustVerifiedEmail = !oidcProvider.trustVerifiedEmail,
        linkAccountNoLogin = !oidcProvider.linkAccountNoLogin,
        guiOrder = Some(123),
        syncMode = 2,
        oauAuthorizationUrl = oidcProvider.oauAuthorizationUrl + "_edited",
        oauAuthReqScope = oidcProvider.oauAuthReqScope.map(_ + "_edited"),
        oauAuthReqHostedDomain = oidcProvider.oauAuthReqHostedDomain.map(_ + "_edited"),
        oauAccessTokenUrl = oidcProvider.oauAccessTokenUrl + "_edited",
        oauClientId = oidcProvider.oauClientId + "_edited",
        oauClientSecret = oidcProvider.oauClientSecret + "_edited",
        oauIssuer = oidcProvider.oauIssuer.map(_ + "_edited"),
        oidcUserInfoUrl = oidcProvider.oidcUserInfoUrl + "_edited",
        oidcUserinfoReqSendUserIp = Some(true),
        oidcLogoutUrl = Some("oidc_logout_url_c"))


  "insert, find, update, find AuthN providers" - {
    "insert" in {
      daoSite1.writeTx { (tx, _) =>
        tx.upsertIdentityProvider(oidcProvider)
      }
    }

    "read back" in {
      daoSite1.readTx { tx =>
        val x = tx.loadIdentityProviderByAlias(oidcProvider.protocol, oidcProvider.alias)
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
              oidcProvider.protocol, oidcProvider.alias) mustBe None

        // New:
        tx.loadAllIdentityProviders() mustBe Seq(oidcProviderEdited)

        // New:
        tx.loadIdentityProviderByAlias(
              oidcProviderEdited.protocol, oidcProviderEdited.alias
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

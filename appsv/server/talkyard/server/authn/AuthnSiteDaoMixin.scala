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

package talkyard.server.authn

import scala.collection.Seq
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.dao.{MemCacheKey, SiteDao}
import com.github.scribejava.core.oauth.{OAuth20Service => sj_OAuth20Service}
import com.github.scribejava.core.builder.{ServiceBuilder => sj_ServiceBuilder}
import com.github.scribejava.core.builder.api.{DefaultApi20 => sj_DefaultApi20}
import com.github.scribejava.core.oauth2.clientauthentication.{RequestBodyAuthenticationScheme => sj_RequestBodyAuthenticationScheme}
import org.scalactic.{Good, Bad, Or}



trait AuthnSiteDaoMixin {
  self: SiteDao =>



  // ----- Identity Providers


  def upsertSiteCustomIdentityProviders(idps: Seq[IdentityProvider]): AnyProblem = {
    writeTx { (tx, staleStuff) =>
      idps foreach { idp =>
        tx.upsertIdentityProvider(idp) ifProblem { problem =>
          // Abort the transaction.
          return problem
        }
      }

      // Custom IDP settings are incl in cached html (IDP name shown in login dialog)
      // — and that's visible client side, so need to uncache all pages.
      COULD_OPTIMIZE // A separate bundle for the authn provider config?
      // So won't need to uncache everything.
      SMALLER_BUNDLE // then too.
      staleStuff.addAllPages()
    }

    // Later: Uncache only those that actually got changed.
    uncacheScribeJavaAuthnServices(idps)
    uncacheSiteCustomIdentityProviders(idps)

    Fine
  }


  def getSiteCustomIdentityProviderByAlias(protocol: St, alias: St)
        : Opt[IdentityProvider] = {
    getSiteCustomIdentityProviders(onlyEnabled = false) find { idp =>
      idp.protocol == protocol && idp.alias == alias
    }
  }


  def getSiteCustomIdentityProviderById(id: IdpId): Opt[IdentityProvider] = {
    // Later: lookup server global idps too — but then this fn needs  [srv_glb_idp]
    // more than just an id?
    getSiteCustomIdentityProviders(onlyEnabled = false).find { idp =>
      idp.idpId.is(id)
    }
  }


  def getIdentityProviderNameFor(identity: OpenAuthDetails): Opt[St] = {
    identity.idpId match {
      case Some(id) =>
        // Race: Could be missing, if an admin removed the IDP just now.
        getSiteCustomIdentityProviderById(id).map(_.nameOrAlias)
      case None =>
        // Use the IDs defined by Silhouette, e.g. "google" or "facebook" lowercase :-|
        identity.confFileIdpId
    }
  }


  def getSiteCustomIdentityProviders(onlyEnabled: Bo): Seq[IdentityProvider] = {
    val idps = memCache.lookup(
          idpsCacheKey,
          orCacheAndReturn = Some {
            readOnlyTransaction(_.loadAllSiteCustomIdentityProviders())
          }).get
    if (onlyEnabled) idps.filter(_.enabled)
    else idps
  }


  def loadAllSiteCustomIdentityProviders(): Seq[IdentityProvider] = {
    readOnlyTransaction(_.loadAllSiteCustomIdentityProviders())
  }


  def uncacheSiteCustomIdentityProviders(idps: Seq[IdentityProvider]): U = {
    memCache.remove(idpsCacheKey)
  }


  private val idpsCacheKey: MemCacheKey = MemCacheKey(siteId, "Idps")


  // ----- User Identities



  // ----- ScribeJava services


  def uncacheScribeJavaAuthnServices(idpsToUncache: Seq[IdentityProvider]): U = {
    idpsToUncache foreach { idp =>
      memCache.remove(scribeJavaAuthnServicesKey(idp))
    }
  }


  def getScribeJavaAuthnService(origin: St, idp: IdentityProvider, mayCreate: Bo = true)
          : sj_OAuth20Service Or ErrMsg = {

    val redirBackUrl =
          if (idp.isOpenIdConnect || idp.isSiteCustom) {
            // New and nice.
            origin + s"/-/authn/${idp.protocol}/${idp.alias}/redirback"
          }
          else {
            // Old, backw compat with urls when Silhouette was in use.
            // Some day, remove this — but then need everyone to upd
            // their redir back urls, over at the IDPs.
            // How know if they've done that or not already??
            // Maybe look at server installation date somehow?
            origin + s"/-/login-auth-callback/${idp.alias}"
          }

    val service = memCache.lookup(
          scribeJavaAuthnServicesKey(idp),
          orCacheAndReturn = Some {
            // As of 2020-10, all per site custom OAuth2 IDPs behave like OIDC,
            // until the very end of the authn flow, when they return non-standard
            // user info json. So, using OIDC here works fine (as of now)
            // — we just need to read the right user info json fields, later,
            // with the help of oidc_user_info_fields_map_c.
            if (idp.isOpenIdConnect || idp.isSiteCustom)
              Good(createScribeJavaOidcService(idp, redirBackUrl))
            else
              tryCreateScribeJavaOAuth2Service(idp, redirBackUrl)
          },
          //expireAfterSeconds = Some(3600)  // unimpl though — need a 2nd Coffeine cache? [mem_cache_exp_secs]
          ).get.getOrIfBad { errMsg =>
            return Bad(errMsg)
          }

    // Check if is the same IDP config settings:

    // (The redirBackUrl includes both the protocol and IDP alias, and the
    // client id and secret are very unique too.)

    def hasCorrectOAuth2Config: Bo = service.getApi match {
      case oidcApi: TyOidcScribeJavaApi20 =>
        val apiAuthUrlInclQuerySt = oidcApi.getAuthorizationUrl(
              "", "", "", "", "", new java.util.HashMap())
        val sameAuthUrl = (
              apiAuthUrlInclQuerySt.startsWith(idp.oauAuthorizationUrl + '?')
                  && oidcApi.getAccessTokenEndpoint == idp.oauAccessTokenUrl)
        val sameTokenAuthMethod = (
              service.getApi.getClientAuthentication ==
                    sj_RequestBodyAuthenticationScheme.instance()
                ) == idp.oauAccessTokenAuthMethod.is("client_secret_post")
        sameAuthUrl && sameTokenAuthMethod
      case _: sj_DefaultApi20 =>
        // This is a ScribeJava built-in IDP, e.g. Gmail or FB, with the correct
        // auth config hardcoded in ScribeJava.  We've verified that this IDP
        // enabled [ck_glob_idp_enb].
        true
      case weirdApi =>
        // Only OAuth2 and OIDC supported.
        // Twitter uses OAuth1 though :- (
        bugWarn("TyE3B5MA05MR", s"Weird API: ${classNameOf(weirdApi)}")
        false
    }

    if (idp.oauAuthReqScope.isSomethingButNot(service.getDefaultScope)
        || service.getCallback != redirBackUrl
        || service.getApiKey != idp.oauClientId
        || service.getApiSecret != idp.oauClientSecret
        || !hasCorrectOAuth2Config) {
      // Different config. An admin recently reconfigured the IDP?
      // Remove old, create new.
      uncacheScribeJavaAuthnServices(Seq(idp))

      // No eternal recursion.
      if (!mayCreate)
        return Bad("Error creating ScribeJava service: Recursion [TyE8R30M4]")

      return getScribeJavaAuthnService(origin, idp, mayCreate = false)
    }

    Good(service)
  }


  private def createScribeJavaOidcService(idp: IdentityProvider, redirBackUri: St)
          : sj_OAuth20Service = {
    new sj_ServiceBuilder(idp.oauClientId)
          .apiSecret(idp.oauClientSecret)
          .defaultScope(idp.oauAuthReqScope getOrElse "openid")
          .callback(redirBackUri)
          .debug()
          .build(TyOidcScribeJavaApi20(idp))
  }


  private def tryCreateScribeJavaOAuth2Service(idp: IdentityProvider, redirBackUri: St)
          : sj_OAuth20Service Or ErrMsg = {
    import com.github.scribejava.{apis => sj}
    import idp.protoAlias

    dieIf(!idp.isOAuth2NotOidc, "TyE305MARKP24")

    val wellKnownIdpImpl = idp.wellKnownIdpImpl getOrElse {
      return Bad(s"No well known IDP impl specified for $protoAlias [TyE602MRKD6]")
    }

    val (idpApi: sj_DefaultApi20, idpDefaultScopes: St) = wellKnownIdpImpl match {
      case WellKnownIdpImpl.Facebook =>
        // Facebook Graph user fields documented here:  [fb_oauth_user_fields]
        // https://developers.facebook.com/docs/graph-api/reference/user
        (sj.FacebookApi.instance(), "email picture profile_pic")  // picture?

      case WellKnownIdpImpl.GitHub =>
        (sj.GitHubApi.instance(), "read:user,user:email")

      case WellKnownIdpImpl.Google =>
        (sj.GoogleApi20.instance(), "profile email")

      case WellKnownIdpImpl.LinkedIn =>
        (sj.LinkedInApi20.instance(), "r_liteprofile r_emailaddress")

      case WellKnownIdpImpl.Twitter =>
        return Bad(s"Twitter authn not yet impl via ScribeJava")

      case _ =>
        return Bad(s"Identity Provider (IDP) not yet supported: ${
              wellKnownIdpImpl.name}, $protoAlias [TyE0IDPIMPL]")
    }

    val service = new sj_ServiceBuilder(idp.oauClientId)
          .apiSecret(idp.oauClientSecret)
          .defaultScope(idp.oauAuthReqScope getOrElse idpDefaultScopes)
          .callback(redirBackUri)
          .debug()
          // ?? .httpClientConfig(clientConfig)
          .build(idpApi)

    Good(service)
  }


  private def scribeJavaAuthnServicesKey(idp: IdentityProvider): MemCacheKey =
    MemCacheKey(siteId, idp.theId + "|AzN")

}

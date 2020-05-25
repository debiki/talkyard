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

import com.debiki.core._
import com.github.scribejava.core.builder.api.{DefaultApi20 => sj_DefaultApi20}
import com.github.scribejava.core.extractors.{TokenExtractor => sj_TokenExtractor}
import com.github.scribejava.core.model.{OAuth2AccessToken => sj_OAuth2AccessToken}
import com.github.scribejava.apis.openid.{OpenIdJsonTokenExtractor => sj_OpenIdJsonTokenExtractor}
import com.github.scribejava.core.oauth2.clientauthentication.{ClientAuthentication => sj_ClientAuthentication, HttpBasicAuthenticationScheme => sj_HttpBasicAuthenticationScheme, RequestBodyAuthenticationScheme => sj_RequestBodyAuthenticationScheme}



private case class TyOidcScribeJavaApi20(idp: IdentityProvider) extends sj_DefaultApi20 {

  // e.g.:  "http://keycloak:8080" + "/auth/realms/" + realm
  override def getAccessTokenEndpoint: St =
    idp.idp_access_token_url_c

  override def getAuthorizationBaseUrl: St =
    idp.idp_authorization_url_c

  override def getAccessTokenExtractor: sj_TokenExtractor[sj_OAuth2AccessToken] =
    sj_OpenIdJsonTokenExtractor.instance

  override def getClientAuthentication: sj_ClientAuthentication = {
    // See:  https://openid.net/specs/openid-connect-core-1_0.html#ClientAuthentication
    // Access method 'client_secret_post' includes this:
    // "...&client_id=...&client_secret=..."
    // in a form-data encoded request body. Whilst the other,
    // 'client_secret_basic', uses a Basic Auth HTTP header — that's better,
    // then, not in the post data, so is the default.
    /*
    if (idp.idp_access_token_auth_method_c == "client_secret_post")
      sj_RequestBodyAuthenticationScheme.instance()
    else */
    sj_HttpBasicAuthenticationScheme.instance()

    // There's also:
    // - client_secret_jwt  relies on HMAC SHA,
    // - private_key_jwt
    // - none (for Implicit Flow and public clients).
  }

}


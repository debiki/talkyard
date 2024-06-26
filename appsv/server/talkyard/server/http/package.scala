/**
 * Copyright (c) 2013-2015, 2021 Kaj Magnus Lindberg
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

package talkyard.server

import com.debiki.core._
import com.debiki.core.Prelude.devDieIf
import debiki.dao.SiteDao
import talkyard.server.security.{BrowserId, SidStatus, XsrfOk}
import play.api.http.{HeaderNames => play_HeaderNames}
import play.api.libs.json.{JsValue, JsObject, JsArray, JsString}
import com.debiki.core.Prelude.JsEmptyObj2
import play.api.mvc.{Request => p_Request, Result => p_Result, RequestHeader => p_RequestHeader}



package object http {

  val UserAgentHeaderNormalLength = 100


  object HeaderNamesLowercase {

    val UserAgent: St = play_HeaderNames.USER_AGENT.toLowerCase

    val AcceptCH = "accept-ch"

    // ----- User Agent

    // The user agent related headers are:
    // - User-Agent
    // - Sec-CH-UA-Mobile    e.g. "?0"
    // - Sec-CH-UA-Platform  e.g. "Linux"
    // - Sec-CH-UA     e.g. "Google Chrome";v="95", "Chromium";v="95", ";Not A Brand";v="99"

    // Sec-CH-UA, e.g. "Google Chrome";v="95", "Chromium";v="95", ";Not A Brand";v="99"
    val ClientHintUserAgent = "sec-ch-ua"

    // Sec-CH-UA-Mobile: "?0" or "?1"
    val ClientHintUaMobile = "sec-ch-ua-mobile"

    // Sec-CH-UA-Platform: e.g. "Linux"
    val ClientHintUaPlatform = "sec-ch-ua-platform"

    val ClientHintHeaders: Vec[St] = Vec(
          ClientHintUserAgent,
          ClientHintUaMobile,
          ClientHintUaPlatform)

    val ClientHintHeadersAndUserAgent: Vec[St] =
          ClientHintHeaders :+ UserAgent

    // ----- Network related

    val SaveData = "save-data"

    // Effective connection type: slow-2g, 2g, 3g, 4g.
    val Ect = "ect"

    // Approximate round trip time in millis, including application server processing time.
    val Rtt = "rtt"

    // Approximate bandwidth of the client's connection to the server, in Mbps.
    val Downlink = "downlink"
  }



  def OkSafeJson(json: JsObject): p_Result =
    _root_.controllers.Utils.OkApiJson(json)


  case class AuthnReqHeaderImpl(
    site: SiteBrief,
    anyTySession: Opt[TySession],
    sid: SidStatus,
    xsrfToken: XsrfOk,
    browserId: Opt[BrowserId],
    user: Opt[Pat],
    dao: SiteDao,
    request: p_RequestHeader) extends AuthnReqHeader {
  }


  case class ApiRequest[A](   // RENAME to AuthnReqImpl
    site: SiteBrief,
    anyTySession: Opt[TySession],
    sid: SidStatus,
    xsrfToken: XsrfOk,
    browserId: Opt[BrowserId],
    user: Opt[Pat],
    dao: SiteDao,
    request: p_Request[A],
    )(private val _aliasPat: Opt[WhichAliasPat], private val mayUseAlias: Bo)
     extends DebikiRequest[A] {

    private var _aliasRead: Bo = false

    def aliasRead: Bo = _aliasRead

    override def anyAliasPat: Opt[WhichAliasPat] = {
      devDieIf(!mayUseAlias, "TyEALIASREAD1", "Trying to use an alias, not allowed here")
      _aliasRead = true
      _aliasPat
    }
  }


  /** A request with no post data. */
  type GetRequest = ApiRequest[Unit]

  type PageGetRequest = PageRequest[Unit]

  /** A request with form data.
    *
    * @deprecated Use ApiRequest[JsonOrFormDataBody] instead — no, use JsonPostRequest.
    */
  type FormDataPostRequest = ApiRequest[Map[String, Seq[String]]]

  type JsonPostRequest = ApiRequest[JsValue]

  def headersToJsonSingleMap(headers: Map[String, String]): JsObject = {
    JsObject(headers mapValues JsString)
  }

  def headersToJsonMultiMap(headers: Map[String, Seq[String]]): JsObject = {
    JsObject(headers.mapValues(vs => JsArray(vs map JsString)))
  }

}

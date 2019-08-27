/**
 * Copyright (c) 2019 Kaj Magnus Lindberg
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

package controllers

import com.debiki.core.CategoryId
import org.scalatest._


class LoginWithSecretControllerSpec extends FreeSpec with MustMatchers {


  "LoginWithSecretController can" - {

    "ensure a redirect url is to an allow-embedding-from site" - {  // [305KSTTH2]
      import LoginWithSecretController.isAllowedRedirectUrl

      def isAllowed(url: String, okSources: Seq[String],
          serverOrigin: String = "", secure: Boolean = true): Boolean =
        isAllowedRedirectUrl(url, serverOrigin = serverOrigin, okSources, secure = secure)

      "accept empty url or just /" in {
        isAllowed("", Nil) mustBe true
        isAllowed("/", Nil) mustBe true
        isAllowed("/", Seq("https://abcd")) mustBe true
      }

      "accept url paths" in {
        isAllowed("/path", Nil) mustBe true
        isAllowed("/path", Seq("https://abcd")) mustBe true
        isAllowed("/path", Nil, serverOrigin = "https://server.io") mustBe true
        isAllowed("/-/admin/page", Nil) mustBe true
        isAllowed("/-1234", Nil) mustBe true
        isAllowed("/-567/page-with-id", Nil) mustBe true
      }

      "accept the server origin" in {
        val origin = "https://www.example.com"
        val wrong = "https://www.wrong.com"
        isAllowed(origin + "/path", Nil, serverOrigin = origin) mustBe true
        isAllowed(origin + "/", Nil, serverOrigin = origin) mustBe true
        isAllowed(origin + "/?query", Nil, serverOrigin = origin) mustBe true
        isAllowed(origin + "/#hash", Nil, serverOrigin = origin) mustBe true
        isAllowed(origin + "/path?query#hash", Nil, serverOrigin = origin) mustBe true
        isAllowed(origin, Nil, serverOrigin = origin) mustBe true
        info("but not the wrong origin")
        isAllowed(origin, Nil, serverOrigin = wrong) mustBe false
        isAllowed(origin + "/path", Nil, serverOrigin = wrong) mustBe false
        isAllowed(origin + ".evil.com", Nil, serverOrigin = origin) mustBe false
        isAllowed(origin + "evil2", Nil, serverOrigin = origin) mustBe false
      }

      "reject the wrong origins" in {
        val httpsOtherCom = "https://other.com"
        val httpsWrongCom = "https://wrong.com"
        isAllowed(httpsOtherCom, Nil) mustBe false
        isAllowed(httpsOtherCom, Seq(httpsOtherCom)) mustBe true
        isAllowed(httpsOtherCom + "weird", Seq(httpsOtherCom)) mustBe false
        isAllowed(httpsOtherCom, Seq(httpsWrongCom)) mustBe false
        isAllowed(httpsOtherCom, Seq(httpsWrongCom, httpsOtherCom)) mustBe true

        isAllowed(httpsOtherCom + "/path", Nil) mustBe false
        isAllowed(httpsOtherCom + "/path", Seq(httpsOtherCom)) mustBe true
        isAllowed(httpsOtherCom + "/path", Seq(httpsWrongCom)) mustBe false
        isAllowed(httpsOtherCom + "/xy", Seq(httpsWrongCom, httpsOtherCom)) mustBe true
      }

      "prefix scheme-less sources with https://, and, if not secure, http://" in {
        val otherCom = "other.com"
        val httpsOtherCom = s"https://$otherCom"
        val httpOtherCom = s"http://$otherCom"
        val wrongCom = "wrong.com"
        val httpsWrongCom = s"https://$wrongCom"

        info("only https if secure")
        isAllowed(httpsOtherCom, Seq(otherCom)) mustBe true
        isAllowed(httpsOtherCom + ".evil", Seq(otherCom)) mustBe false
        isAllowed(httpsOtherCom + "evil2", Seq(otherCom)) mustBe false
        isAllowed(httpsOtherCom, Seq(wrongCom)) mustBe false
        isAllowed(httpsOtherCom, Seq(wrongCom, otherCom)) mustBe true
        isAllowed(httpsOtherCom + "/ab/cd", Seq(wrongCom, otherCom)) mustBe true

        info("but not http")
        isAllowed(httpOtherCom, Seq(wrongCom, otherCom)) mustBe false

        info("both http and https, if not secure")
        isAllowed(httpOtherCom, Seq(wrongCom, otherCom), secure = false) mustBe true
        isAllowed(httpOtherCom + "/path", Seq(wrongCom, otherCom), secure = false) mustBe true
        isAllowed(httpOtherCom + ".evil", Seq(wrongCom, otherCom), secure = false) mustBe false
        isAllowed(httpOtherCom + "evil2", Seq(wrongCom, otherCom), secure = false) mustBe false
        isAllowed(httpsOtherCom + "/path", Seq(wrongCom, otherCom), secure = false) mustBe true
      }

      "work with ports" in {
        val httpsOtherCom = "https://other.com"
        val httpsOtherCom123 = "https://other.com:123"
        val httpsWrongCom = "https://wrong.com"
        val httpsWrongCom123 = "https://wrong.com:123"
        isAllowed(httpsOtherCom123, Seq(httpsOtherCom)) mustBe false
        isAllowed(httpsOtherCom, Seq(httpsOtherCom123)) mustBe false
        isAllowed(httpsOtherCom123, Seq(httpsOtherCom123)) mustBe true
        isAllowed(httpsOtherCom123, Seq(httpsWrongCom123)) mustBe false
        isAllowed(httpsOtherCom123 + "/", Seq(httpsOtherCom123)) mustBe true
        isAllowed(httpsOtherCom123 + "/", Seq(httpsWrongCom123)) mustBe false
      }

      "work with ports and no scheme" in {
        val httpsOtherCom123 = "https://other.com:123"
        val otherCom123 = "other.com:123"
        val wrongCom123 = "wrong.com:123"
        val otherButWrongPort = otherCom123 + "4"
        isAllowed(httpsOtherCom123, Seq(otherCom123)) mustBe true
        isAllowed(httpsOtherCom123, Seq(wrongCom123)) mustBe false
        isAllowed(httpsOtherCom123, Seq(otherButWrongPort)) mustBe false
      }

      "keeps query and hash" in {
        val otherCom = "other.com"
        val httpsOtherCom = s"https://$otherCom"
        val httpOtherCom = s"http://$otherCom"
        val query = "?query&param=value"
        val hash = "#hash-frag&men=t"

        info("in url paths")
        isAllowed(query, Seq(httpsOtherCom)) mustBe true
        isAllowed(hash, Seq(httpsOtherCom)) mustBe true
        isAllowed(s"/page/path$query$hash", Seq(httpsOtherCom)) mustBe true

        info("also if origin included")
        isAllowed(s"$httpsOtherCom/?#", Seq(httpsOtherCom)) mustBe true
        isAllowed(s"$httpsOtherCom/$query", Seq(httpsOtherCom)) mustBe true
        isAllowed(s"$httpsOtherCom/$hash", Seq(httpsOtherCom)) mustBe true
        isAllowed(s"$httpsOtherCom/$query$hash", Seq(httpsOtherCom)) mustBe true
        isAllowed(s"$httpOtherCom/$query$hash", Seq(httpsOtherCom)) mustBe false

        info("combined with adding https:// to the source")
        isAllowed(s"$httpsOtherCom/$query$hash", Seq(otherCom)) mustBe true

        info("... but not http:// — because secure")
        isAllowed(s"$httpOtherCom/$query$hash", Seq(otherCom)) mustBe false

        info("combined with port")
        isAllowed(s"$httpsOtherCom:8080/$query$hash", Seq(s"$httpsOtherCom:8080")) mustBe true
        isAllowed(s"$httpOtherCom:8080/$query$hash", Seq(s"$httpsOtherCom:8080")) mustBe false

        info("combined with adding the https:// scheme to the source, and port number")
        isAllowed(s"$httpsOtherCom:8080/$query$hash", Seq(s"$otherCom:8080")) mustBe true
        isAllowed(s"$httpOtherCom:8080/$query$hash", Seq(s"$otherCom:8080")) mustBe false
      }

      "wildcards not yet supported" in {
        val otherCom = "other.com"
        val httpsOtherCom = "https://other.com"
        isAllowed(s"https://sub.$otherCom", Seq("*." + otherCom)) mustBe false
        isAllowed(s"https://sub.$otherCom", Seq("https://*." + otherCom)) mustBe false
        isAllowed(httpsOtherCom, Seq(httpsOtherCom + ":*")) mustBe false
      }
    }
  }

}


/**
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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

import com.debiki.core._
import com.debiki.core.Prelude._
import org.scalatest._
import EmbeddedTopicsController._


@Ignore
class EmbeddedTopicsControllerSpec extends FreeSpec with MustMatchers {


  "EmbeddedTopicsController can" - {

    "generate ids from urls" in {
      assert(hashSha1Base64UrlSafe("") == "2jmj7l5rSw0yVb_vlWAYkK_YBwk")
      deriveTopicIdFromUrl("") mustBe "2jmj7l5rSw0yVbvl"

      // Verify works when no '-' or '_' present in base 64 encoded SHA1.
      assert(hashSha1Base64UrlSafe("xyzw") == "ObagQbH2T2BVzoksR19teY0963A")
      deriveTopicIdFromUrl("xyzw") mustBe "ObagQbH2T2BVzoks"

      // Verify strips '-'.
      assert(hashSha1Base64UrlSafe("xyz") == "ZrJ0F9N-AkxGUmwvbTWKdU_FUvM")
      deriveTopicIdFromUrl("xyz") mustBe "ZrJ0F9NAkxGUmwvb"

      // Verify strips '_'.
      assert(hashSha1Base64UrlSafe("xyzwå") == "RNQkvfTUxa_jT8zkY5_IPc-Hn6A")
      deriveTopicIdFromUrl("xyzwå") mustBe "RNQkvfTUxajT8zkY"

      // Verify strips both '-' and '_'.
      assert(hashSha1Base64UrlSafe("abcde") == "A95sVwv-JL_DKMzXyka3bq2vQzQ")
      deriveTopicIdFromUrl("abcde") mustBe "A95sVwvJLDKMzXyk"

      // '=' might appear at the end but it's hard to come up with a test that
      // verifies it's being stripped.
    }

    "strip http:// and https:// and // when generating ids" in {
      deriveTopicIdFromUrl("http://example.com") mustBe deriveTopicIdFromUrl("example.com")
      deriveTopicIdFromUrl("https://example.com") mustBe deriveTopicIdFromUrl("example.com")
      deriveTopicIdFromUrl("//example.com") mustBe deriveTopicIdFromUrl("example.com")
    }

  }

}


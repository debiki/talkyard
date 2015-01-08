/**
 * Copyright (C) 2013 Kaj Magnus Lindberg (born 1979)
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

package com.debiki.core

import org.specs2.mutable._
import java.{util => ju}
import Util._

/*
class PageTrustTest extends Specification {

  def date(seconds: Int) = new ju.Date(seconds * 1000)

  val GuestUser = User("-1001", "GuestUser", "guest@example.com", EmailNotfPrefs.Receive)
  val GuestUser2 = User("-1002", "GuestUser2", "guest2@example.com", EmailNotfPrefs.Receive)
  val GuestUser3 = User("-1003", "GuestUser3", "guest3@example.com", EmailNotfPrefs.Receive)

  val GuestLogin = Login("2001", prevLoginId = None, ip = "1.0.0.1", date = date(0),
    identityRef = IdentityRef.Guest("1101"))
  val GuestLogin2 = Login("2002", prevLoginId = None, ip = "1.0.0.2", date = date(1),
    identityRef = IdentityRef.Guest("1102"))
  val GuestLogin3 = Login("2003", prevLoginId = None, ip = "1.0.0.3", date = date(1),
    identityRef = IdentityRef.Guest("1103"))

  val body = PageTestValues.bodySkeletonAutoApproved.copy(
    userIdData = UserIdData.newTest(GuestLogin.id, userId = GuestUser.id))

  val basePage = PageParts("pageId") + body +
    GuestUser + GuestUser2 + GuestUser3 +
    GuestLogin + GuestLogin2 + GuestLogin3

  val someLikedTag = PostRatingStats.DefaultLikedTags.head

  val ownGoodRatingOfBody = Rating(1001, postId = body.id,
    UserIdData.newTest(body.loginId, userId = body.userId),
    ctime = new ju.Date(60), tags = List(someLikedTag))

  val ownBadRatingOfBody = ownGoodRatingOfBody.copy(tags = List("boring"))

  val guest2sRatingOfBody = ownGoodRatingOfBody.copy(
    id = 1002, userIdData = UserIdData.newTest(GuestLogin2.id, userId = GuestUser2.id))


  "PageTrust" can {

    "handle ratings on own post" >> {
      "downweight good ratings" in {
        val page = basePage + ownGoodRatingOfBody
        PageTrust(page).trustinessOf(ownGoodRatingOfBody) must_== 0.1f
      }

      "accept bad ratings as is" in {
        val page = basePage + ownBadRatingOfBody
        PageTrust(page).trustinessOf(ownBadRatingOfBody) must_== 1f
      }
    }

    "downweight many guest user ratings from same IP" in {
      val ratingA = ownGoodRatingOfBody.copy(
        id = 21, userIdData = UserIdData(GuestLogin2.id, userId = GuestUser2.id, ip = "2.0.0.2"))
      val ratingB = ownGoodRatingOfBody.copy(
        id = 22, userIdData = UserIdData.newTest(
          GuestLogin3.id, userId = GuestUser3.id, newIp = Some("2.0.0.2"))
      val page = basePage + ratingA + ratingB
      PageTrust(page).trustinessOf(ratingA) must_== (1f / 2)
    }

    "not downweight non-guest user ratings from same IP" in {
      /*
      val ip = Some("2.0.0.1")
      val ratingA = ratingOfBody.copy(id = 21, userId = ??, loginId = ??, newIp = ip)
      val ratingB = ratingA.copy(id = 22, userId = ??, loginId = ??)
      val page = basePage + ratingA + ratingB
      PageTrust(page).trustinessOf(ratingA) must_== (1f / 2)
      */
      pending
    }

    "handle single rating from unique IP" in {
      val page = basePage + guest2sRatingOfBody
      PageTrust(page).trustinessOf(guest2sRatingOfBody) must_== 1f
    }
  }
}
*/


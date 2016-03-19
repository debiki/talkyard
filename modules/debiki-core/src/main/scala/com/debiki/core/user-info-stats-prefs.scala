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

package com.debiki.core

import java.{util => ju}


/** Info about a user, for example his/her display name and when it was created
  * and statistics on how many posts s/he has posted, how s/he has voted,
  * number of replies, number of likes received etcetera.
  */
case class UserInfoAndStats(
  info: User,
  stats: UserStats)


case class UserStats(
  numPages: Int,
  numPosts: Int,
  numReplies: Int,
  numLikesGiven: Int,
  numLikesReceived: Int,
  numWrongsGiven: Int,
  numWrongsReceived: Int,
  numBurysGiven: Int,
  numBurysReceived: Int)


object UserStats {

  val Zero = UserStats(0, 0, 0, 0, 0, 0, 0, 0, 0)

}


case class UserPreferences(
  userId: UserId,
  fullName: Option[String],
  username: String,
  emailAddress: String,
  url: String = "",
  emailForEveryNewPost: Boolean = false) {

  require(!fullName.map(_.trim).contains(""), "DwE4FUKW049")
  require(userId >= User.LowestNonGuestId, "DwE56KX2")
}


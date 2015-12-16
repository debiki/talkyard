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


/** Data on by which [guest ips] and roles each post on a certain page has been read.
  */
case class PostsReadStats(
  guestIpsByPostNr: Map[PostNr, Set[String]],
  roleIdsByPostNr: Map[PostNr, Set[RoleId]]) {

  def readCountFor(postNr: PostNr) = {
    val numGuestIps = guestIpsByPostNr.get(postNr).map(_.size) getOrElse 0
    val numRoleIds = roleIdsByPostNr.get(postNr).map(_.size) getOrElse 0
    numGuestIps + numRoleIds
  }

}


object PostsReadStats {
  val None = PostsReadStats(Map.empty, Map.empty)
}

/**
 * Copyright (C) 2016 Kaj Magnus Lindberg
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

package io.efdi

import com.debiki.core._


package object server {

  case class Who(id: UserId, browserIdData: BrowserIdData) {
    def ip: String = browserIdData.ip
    def idCookie: String = browserIdData.idCookie
    def browserFingerprint = browserIdData.fingerprint
    def isGuest = User.isGuestId(id)
  }

  case class UserAndLevels(user: User, trustLevel: TrustLevel, threatLevel: ThreatLevel) {
    def id = user.id
    def isStaff = user.isStaff
  }

}


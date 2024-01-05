/**
 * Copyright (c) 2023 Kaj Magnus Lindberg
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
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

package talkyard.server.security

import com.debiki.core._


sealed trait WhatApiSecret { def isServerSecret: Bo = false }

object WhatApiSecret {

  case object SiteSecret extends WhatApiSecret

  case class ServerSecretFor(basicAuthUsername: St) extends WhatApiSecret {
    // Bit dupl constants, for now, just to catch bugs. [Scala_3] Have the type system
    // verify this instead, at compile time, somehow?
    assert(Seq("emailwebhooks", "createsite", "sysmaint") contains basicAuthUsername,
          "TyE502MMJS4")

    override def isServerSecret: Bo = true
  }

}


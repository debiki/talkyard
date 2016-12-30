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

package ed.server.spam

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.dao._
import debiki.DebikiHttp.throwForbidden
import QuickSpamCheckDao._



trait QuickSpamCheckDao {
  this: SiteDao =>


  def quickCheckIfSpamThenThrow(who: Who, textAndHtml: TextAndHtml,
        spamRelReqStuff: SpamRelReqStuff) {

    val user = getUser(who.id) getOrElse {
      throwForbidden("EdE5FK7X2", s"Unknown user: $siteId:${who.id}")
    }

    throwForbiddenIfLooksSpammy(user, textAndHtml)
  }

}


object QuickSpamCheckDao {

  /** Does some simple tests to try to fend off spam.
    */
  def throwForbiddenIfLooksSpammy(user: User, textAndHtml: TextAndHtml) {
    def throwIfTooManyLinks(maxNumLinks: Int) {
      if (textAndHtml.links.length > maxNumLinks)
        throwForbidden("EdE4KFY2_", o"""Your text includes more than $maxNumLinks links —
           that makes me nervous about spam. Can you please remove some links?""")
    }
    if (user.isStaff) {
      // Ok.
    }
    else if (user.isAuthenticated) {
      throwIfTooManyLinks(7)
    }
    else {
      throwIfTooManyLinks(3)
    }
  }

}

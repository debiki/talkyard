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
import debiki.EdHttp.throwForbidden
import QuickSpamCheckDao._



trait QuickSpamCheckDao {
  this: SiteDao =>


  def quickCheckIfSpamThenThrow(who: Who, textAndHtml: TextAndHtml,
        spamRelReqStuff: SpamRelReqStuff): Unit = {

    val user = getParticipant(who.id) getOrElse {
      throwForbidden("EdE5FK7X2", s"Unknown user: $siteId:${who.id}")
    }

    throwForbiddenIfLooksSpammy(user, textAndHtml)
  }

}


object QuickSpamCheckDao {

  /** Does some simple tests to try to fend off spam.
    */
  def throwForbiddenIfLooksSpammy(user: Participant, textAndHtml: TextAndHtml): Unit = {
    def throwIfTooManyLinks(maxNumLinks: Int): Unit = {
      if (textAndHtml.links.length > maxNumLinks)
        throwForbidden("EdE4KFY2_", o"""Your text includes more than $maxNumLinks links —
           that makes me nervous about spam. Can you please remove some links?""")
    }
    if (user.isStaffOrMinTrustNotThreat(TrustLevel.TrustedMember)) {
      // Ok.
      SECURITY; SHOULD // throwIfTooManyLinks(50) if siteId != FirstSiteId  — so cannot SELF_DOS
    }
    else if (user.isStaffOrMinTrustNotThreat(TrustLevel.FullMember)) {
      throwIfTooManyLinks(25)
    }
    else if (user.isStaffOrMinTrustNotThreat(TrustLevel.BasicMember)) {
      throwIfTooManyLinks(15)
    }
    else if (user.isAuthenticated) {
      throwIfTooManyLinks(10)
    }
    else {
      throwIfTooManyLinks(5)
    }
  }

}

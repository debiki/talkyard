/**
 * Copyright (c) 2017 Kaj Magnus Lindberg
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

package ed.server.pop

import com.debiki.core._
import debiki._


trait PagePopularityDao {   // could remove, and keep the below object only

  def updatePagePopularity(pageParts: PageParts, tx: SiteTransaction) {
    PagePopularityDao.updatePagePopularity(pageParts, tx)
  }
}



object PagePopularityDao {

  def updatePagePopularity(pageParts: PageParts, tx: SiteTransaction) {
    SHOULD_OPTIMIZE // if is chat, only load the last 1000 'things'? because topic might be too long.
    val actions = tx.loadActionsOnPage(pageParts.pageId)
    COULD_OPTIMIZE // only load total num visits per period & trust level — don't load each row.
    val visits = tx.loadPageVisitTrusts(pageParts.pageId)
    val popStats = PagePopularityCalculator.calcPopStatsNowAndThen(
      tx.now, pageParts, actions, visits)
    val popScore = PagePopularityCalculator.calcPopularityScores(popStats)
    tx.upsertPagePopularityScore(popScore)
  }

}


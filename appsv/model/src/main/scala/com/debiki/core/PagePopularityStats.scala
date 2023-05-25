/**
 * Copyright (C) 2015 Kaj Magnus Lindberg
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

import com.debiki.core.Prelude._
import java.{util => ju}


/** Tells how popular a page is, so it can be shown first (or 2nd... or last... or not at all)
  * in the Top forum topics view. Scores can perhaps be < 0 if there're many Unwanted votes.
  *
  * @param scoreAlgorithm Pages with old algorithm versions, should gradually be refreshed
  *   to have their score calculated using the latest algorithm, because the daily/weekly/etc
  *   scores are otherwise not comparable to scores from the latest algorithm version.
  * @param dayScore How much more popular the topic has become, the last day. Also includes
  *   topics created long ago — perhaps something happened, that makes them
  *   popular today, although no one cared, before.
  */
case class PagePopularityScores(
  pageId: PageId,
  updatedAt: When,
  scoreAlgorithm: PageScoreAlg,
  dayScore: Float,
  weekScore: Float,
  monthScore: Float,
  quarterScore: Float,
  yearScore: Float,
  allScore: Float) {

  def toPrettyString: String = {
    i"""
      |updatedAt: ${toIso8601NoSecondsNoT(updatedAt.toJavaDate)},
      |scoreAlgorithm: $scoreAlgorithm,
      |dayScore: $dayScore,
      |weekScore: $weekScore,
      |monthScore: $monthScore,
      |quarterScore: $quarterScore,
      |yearScore: $yearScore,
      |allScore: $allScore
      |"""
  }
}


// RENAME to [TrendingPeriod]
sealed abstract class TopTopicsPeriod(val IntVal: Int) { def toInt = IntVal }

object TopTopicsPeriod {
  // later, maybe: Now = 6 hours?
  case object Day extends TopTopicsPeriod(1)
  // later: 2Days or 3Days?
  // Or change Day to  1.5  days?
  // Then:  1.5 * 4 = 6  ~ 1 week,  1 w * 4 = 28 ~ 1 month,  1 mo * 3 = 1 quarter,  * 4 = 1y
  // that is, each period is 3 – 4 times the previous period.
  case object Week extends TopTopicsPeriod(2)
  // later: 2Weeks  — makes sense since there's every-2nd-week summary emails.
  case object Month extends TopTopicsPeriod(3)
  case object Quarter extends TopTopicsPeriod(4)
  // later: HalfYear
  case object Year extends TopTopicsPeriod(5)
  case object All extends TopTopicsPeriod(6)

  val Default = Year  // Sync w Typescript

  def fromOptInt(value: Opt[i32]): Option[TopTopicsPeriod] =
    fromInt(value getOrElse { return None })

  def fromInt(value: i32): Option[TopTopicsPeriod] = Some(value match {
    case Day.IntVal => Day
    case Week.IntVal => Week
    case Month.IntVal => Month
    case Quarter.IntVal => Quarter
    case Year.IntVal => Year
    case All.IntVal => All
    case _ => return None
  })

  def fromIntString(value: String): Option[TopTopicsPeriod] = Some(value match {
    case "1" => Day
    case "2" => Week
    case "3" => Month
    case "4" => Quarter
    case "5" => Year
    case "6" => All
    case _ => return None
  })
}



/** Used for calculating popularity scores.
  *
  * @param sinceYesterday How much more popular the page has become, since about one day ago.
  */
case class PagePopStatsNowAndThen(
  pageId: PageId,
  sinceYesterday: PagePopularityStats,
  sinceLastWeek: PagePopularityStats,
  sinceLastMonth: PagePopularityStats,
  sinceLastQuarter: PagePopularityStats,
  sinceLastYear: PagePopularityStats,
  sinceGenesis: PagePopularityStats) {

  require(pageId == sinceYesterday.pageId, "EdE8GKYW2A")
  require(pageId == sinceLastWeek.pageId, "EdE8GKYW2B")
  require(pageId == sinceLastMonth.pageId, "EdE8GKYW2C")
  require(pageId == sinceLastQuarter.pageId, "EdE8GKYW2D")
  require(pageId == sinceLastYear.pageId, "EdE8GKYW2E")
  require(pageId == sinceGenesis.pageId, "EdE8GKYW20")

  require(sinceYesterday.to == sinceLastWeek.to, "EdEJ2GRA01")
  require(sinceYesterday.to == sinceLastMonth.to, "EdE6JGRA02")
  require(sinceYesterday.to == sinceLastQuarter.to, "EdEJ2GRA03")
  require(sinceYesterday.to == sinceLastYear.to, "EdEJ2GRA04")
  require(sinceYesterday.to == sinceGenesis.to, "EdEJ2GRA05")

  require(sinceYesterday.from isAfter sinceLastWeek.from, "EdEZ2GKF01")
  require(sinceLastWeek.from isAfter sinceLastMonth.from, "EdEZ2GKF02")
  require(sinceLastMonth.from isAfter sinceLastQuarter.from, "EdEZ2GKF03")
  require(sinceLastQuarter.from isAfter sinceLastYear.from, "EdEZ2GKF04")
  require(sinceLastYear.from isAfter sinceGenesis.from, "EdEZ2GKF05")

  def toPrettyString: String = {
    i"""
      |pageId: $pageId
      |sinceYesterday: ${sinceYesterday.toPrettyString}
      |sinceLastWeek: ${sinceLastWeek.toPrettyString}
      |sinceLastMonth: ${sinceLastMonth.toPrettyString}
      |sinceLastQuarter: ${sinceLastQuarter.toPrettyString}
      |sinceLastYear: ${sinceLastYear.toPrettyString}
      |sinceGenesis: ${sinceGenesis.toPrettyString}
      |"""
  }
}


case class PagePopularityStats(
  pageId: PageId,
  from: When,
  to: When,
  numPosts: Int,
  numPostsInclOld: Int,
  numViewsByStrangers: Int,
  numViewsByMembers: Int,
  numViewsByTrusted: Int,
  numViewsByCore: Int,
  numLikesTotal: Int,
  numLikesByTrusted: Int,
  numLikesByCore: Int,
  numDisagreesTotal: Int,
  numDisagreesByTrusted: Int,
  numDisagreesByCore: Int,
  numUnwantedTotal: Int,
  numUnwantedByTrusted: Int,
  numUnwantedByCore: Int,
  // Later. For now, using Like votes instead. [do_it_votes]
  numOpDoItTotal: i32 = 0,
  numOpDoItByTrusted: i32 = 0,
  numOpDoItByCore: i32 = 0,
  numOpDoNotTotal: i32 = 0,
  numOpDoNotByTrusted: i32 = 0,
  numOpDoNotByCore: i32 = 0,
  numOpLikesTotal: Int,
  numOpLikesByTrusted: Int,
  numOpLikesByCore: Int,
  numOpDisagreesTotal: Int,
  numOpDisagreesByTrusted: Int,
  numOpDisagreesByCore: Int,
  numOpUnwantedTotal: Int,
  numOpUnwantedByTrusted: Int,
  numOpUnwantedByCore: Int,
  topmostLikeScoreTotal: Float,
  topmostLikeScoreByTrusted: Float,
  topmostLikeScoreByCore: Float,
  topmostDisagreeScoreTotal: Float,
  topmostDisagreeScoreByTrusted: Float,
  topmostDisagreeScoreByCore: Float,
  // Skip? Instead, just set Like & Disagree score to 0, for Unwanted posts?
  topmostUnwantedScoreTotal: Float,
  topmostUnwantedScoreByTrusted: Float,
  topmostUnwantedScoreByCore: Float) {

  require(numPosts >= 0, "DwE2JT0Q1")
  require(numPostsInclOld >= 0, "DwE2JT0Z8")
  require(numViewsByStrangers >= 0, "EdE5KY01")
  require(numViewsByMembers >= numViewsByTrusted, "EdE5KY02")
  require(numViewsByTrusted >= numViewsByCore, "EdE5KY03")
  require(numViewsByCore >= 0, "EdE5KY04")
  require(numLikesTotal >= numLikesByTrusted, "EdE5KY05")
  require(numLikesByTrusted >= numLikesByCore, "EdE5KY06")
  require(numLikesByCore >= 0, "EdE5KY07")
  require(numDisagreesTotal >= numDisagreesByTrusted, "EdE5KY08")
  require(numDisagreesByTrusted >= numDisagreesByCore, "EdE5KY09")
  require(numDisagreesByCore >= 0, "EdE5KY10")
  require(numUnwantedTotal >= numUnwantedByTrusted, "EdE5KY11")
  require(numUnwantedByTrusted >= numUnwantedByCore, "EdE5KY12")
  require(numUnwantedByCore >= 0, "EdE5KY13")
  require(numOpDoItTotal >= 0, "TyEPOPVOTECNT61")
  require(numOpDoItByTrusted >= 0, "TyEPOPVOTECNT62")
  require(numOpDoItByCore >= 0, "TyEPOPVOTECNT63")
  require(numOpDoNotTotal >= 0, "TyEPOPVOTECNT65")
  require(numOpDoNotByTrusted >= 0, "TyEPOPVOTECNT66")
  require(numOpDoNotByCore >= 0, "TyEPOPVOTECNT67")
  require(numOpLikesTotal >= numOpLikesByTrusted, "EdE5KY14")
  require(numOpLikesByTrusted >= numOpLikesByCore, "EdE5KY15")
  require(numOpLikesByCore >= 0, "EdE5KY16")
  require(numOpDisagreesTotal >= numOpDisagreesByTrusted, "EdE5KY17")
  require(numOpDisagreesByTrusted >= numOpDisagreesByCore, "EdE5KY18")
  require(numOpDisagreesByCore >= 0, "EdE5KY19")
  require(numOpUnwantedTotal >= numOpUnwantedByTrusted, "EdE5KY20")
  require(numOpUnwantedByTrusted >= numOpUnwantedByCore, "EdE5KY21")
  require(numOpUnwantedByCore >= 0, "EdE5KY22")
  require(topmostLikeScoreTotal >= topmostLikeScoreByTrusted, "EdE5KY23")
  require(topmostLikeScoreByTrusted >= topmostLikeScoreByCore, "EdE5KY24")
  require(topmostLikeScoreByCore >= 0f, "EdE5KY25")
  require(topmostDisagreeScoreTotal >= topmostDisagreeScoreByTrusted, "EdE5KY26")
  require(topmostDisagreeScoreByTrusted >= topmostDisagreeScoreByCore, "EdE5KY27")
  require(topmostDisagreeScoreByCore >= 0f, "EdE5KY28")
  require(topmostUnwantedScoreTotal >= topmostUnwantedScoreByTrusted, "EdE5KY29")
  require(topmostUnwantedScoreByTrusted >= topmostUnwantedScoreByCore, "EdE5KY30")
  require(topmostUnwantedScoreByCore >= 0f, "EdE5KY31")

  def toPrettyString: String = {
    i"""
      |from: ${toIso8601NoSecondsNoT(from.toJavaDate)}
      |to: ${toIso8601NoSecondsNoT(to.toJavaDate)}
      |numPosts: $numPosts
      |numPostsInclOld: $numPostsInclOld
      |numViewsByStrangers: $numViewsByStrangers
      |numViewsByMembers: $numViewsByMembers
      |numViewsByTrusted: $numViewsByTrusted
      |numViewsByCore: $numViewsByCore
      |numLikesTotal: $numLikesTotal
      |numLikesByTrusted: $numLikesByTrusted
      |numLikesByCore: $numLikesByCore
      |numDisagreesTotal: $numDisagreesTotal
      |numDisagreesByTrusted: $numDisagreesByTrusted
      |numDisagreesByCore: $numDisagreesByCore
      |numUnwantedTotal: $numUnwantedTotal
      |numUnwantedByTrusted: $numUnwantedByTrusted
      |numUnwantedByCore: $numUnwantedByCore
      |numOpLikesTotal: $numOpLikesTotal
      |numOpLikesByTrusted: $numOpLikesByTrusted
      |numOpLikesByCore: $numOpLikesByCore
      |numOpDisagreesTotal: $numOpDisagreesTotal
      |numOpDisagreesByTrusted: $numOpDisagreesByTrusted
      |numOpDisagreesByCore: $numOpDisagreesByCore
      |numOpUnwantedTotal: $numOpUnwantedTotal
      |numOpUnwantedByTrusted: $numOpUnwantedByTrusted
      |numOpUnwantedByCore: $numOpUnwantedByCore
      |topmostLikeScoreTotal: $topmostLikeScoreTotal
      |topmostLikeScoreByTrusted: $topmostLikeScoreByTrusted
      |topmostLikeScoreByCore: $topmostLikeScoreByCore
      |topmostDisagreeScoreTotal: $topmostDisagreeScoreTotal
      |topmostDisagreeScoreByTrusted: $topmostDisagreeScoreByTrusted
      |topmostDisagreeScoreByCore: $topmostDisagreeScoreByCore
      |topmostUnwantedScoreTotal: $topmostUnwantedScoreTotal
      |topmostUnwantedScoreByTrusted: $topmostUnwantedScoreByTrusted
      |topmostUnwantedScoreByCore: $topmostUnwantedScoreByCore
      |"""
  }

}


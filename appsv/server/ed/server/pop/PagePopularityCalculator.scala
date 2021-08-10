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
import scala.collection.{immutable, mutable}
import Prelude._



object PagePopularityCalculator {

  val CurrentAlgorithmVersion = 1


  /** How do votes affect the score:
    *  - Like votes —> plus score.
    *  - Disagree votes *if* the post also has many Like votes (in comparison to num-Disagree)
    *    —> small plus score.
    *    Because if many people like something, but fairly many disagree, then that's usually
    *    more interesting, than something that everyone agrees about, right.
    *  - Many disagree votes, with *no* Like votes —> nothing, ignored.
    *  - Bury votes —> nothing, ignored.
    *  - Unwanted votes —> minus score (so total score can perhaps be negative?).
    *
    * How does num-visits affect the score:
    *  - Visits by strangers = plus score (because they cannot upvote things).
    *  - Visits by *members* = *dilutes* like votes, slightly reduces the score. Not impl though.
    *    Because members *can* upvote things — and if they just visit, without upvoting — that
    *   slightly indicates that the page is not so interesting.
    *
    * How does num-posts affect:
    *  - Many posts dilutes the total-Like-score. However, won't dilute the topmost-like-score
    *    because it's based on the topmost comments only. So if people start chatting, the
    *    topmost score won't be affected.
    *  - Many posts also *adds* a score (not impl — use mat.log()?), because something people
    *    talk about is probably a bit interesting.
    *
    * @param stats
    * @return
    */
  def calcPopularityScores(stats: PagePopStatsNowAndThen): PagePopularityScores = {
    PagePopularityScores(
      pageId = stats.pageId,
      updatedAt = stats.sinceYesterday.to,
      algorithmVersion = CurrentAlgorithmVersion,
      dayScore = calcPopScore(stats.sinceYesterday),
      weekScore = calcPopScore(stats.sinceLastWeek),
      monthScore = calcPopScore(stats.sinceLastMonth),
      quarterScore = calcPopScore(stats.sinceLastQuarter),
      yearScore = calcPopScore(stats.sinceLastYear),
      allScore = calcPopScore(stats.sinceGenesis))
  }


  private def calcPopScore(stats: PagePopularityStats): Float = {
    var score = 0f

    // Like votes increase the page score — especially upvoted posts that can be
    // seen without scrolling down "a lot".
    // However, now Ty sorts OP replies by time, by default, so this makes less
    // sense now.
    score += stats.topmostLikeScoreTotal

    // What! Skip this. It's confusing, and also, for the forum staff, it's
    // more interesting to know what ordinary members like,
    // than what they themselves like. ?  [dont_4x_staff_likes]
    /*
    score += stats.topmostLikeScoreByTrusted // means x 2, since incl in Total
    score += stats.topmostLikeScoreByCore * 2f // means x 4, since incl in Total and Trusted too
    */

    // Disagree votes also increase the page score, a little bit. Because if people
    // disagree about something, it's probably more important,
    // than something everyone agrees about.  [tywd_disagree_fine]
    val DisagreeWeight = 0.25f
    score += DisagreeWeight * stats.topmostDisagreeScoreTotal
    /* Skip, see above. [dont_4x_staff_likes]
    score += DisagreeWeight * stats.topmostDisagreeScoreByTrusted
    score += DisagreeWeight * stats.topmostDisagreeScoreByCore * 2f
    */

    // Likes "hidden" further down the page doesn't matter that much? Because one is less likely
    // to scroll down and find them? + the non-topmost comments might be a bit more like chat.
    val TotalLikesWeight = 1.0f // 0.5f
    val numPostsInclOld = math.max(1, stats.numPostsInclOld)
    score += TotalLikesWeight * stats.numLikesTotal / numPostsInclOld
    /* Skip, see above. [dont_4x_staff_likes]
    score += TotalLikesWeight * stats.numLikesByTrusted / numPostsInclOld  // x 2
    score += TotalLikesWeight * stats.numLikesByCore * 2f / numPostsInclOld  // x 4
     */

    // Skip total disagrees — Disagree votes are only interesting, if there are Like votes too.
    // Right now ... we don't keep track of that though.
    // COULD change from stats.numDisagreesTotal to stats.numLikeDisagreesTotal?
    // that is, count only Disagree votes, if there are, say, min >= 0.25 Like votes per Disagree?

    // All other fields ... skip for now.

    // COULD add log(numViewsByStrangers) or sth like that, because strangers cannot cast Like
    // votes. So attention by them doesn't dilute the Like votes, just shows the page is popular.
    // (However, visits, but no Like votes, by members, indicates the page is boring. Since
    // they didn't upvote anything.)

    score
  }


  def calcPopStatsNowAndThen(now: When, pageParts: PageParts, actions: immutable.Seq[PostAction],
        visitsByUserId: Map[UserId, VisitTrust]): PagePopStatsNowAndThen = {

    /*
    def popularityInThePast(millisAgo: Long): PagePopularityStats = {
      val includeUpTo = now.minusMillis(millisAgo)
      val posts = pageParts.allPosts.filter(_.createdAtMillis < includeUpTo.millis)
      val actions = actions filter { _ match {
        case _ => false
      }}
      calcOnePopStats(
          includeUpTo, new PreLoadedPageParts(pageParts.pageId, posts), actions, visitsByUserId)
    } */

    // Add some more hours & days, so less risk one won't see a popular topic.
    // For example, last day = 24 + 12 hours —> I view last day's stuff on Tuesday noon, then I'll
    // see things from Monday morning, not just after Monday noon — and I would probably want to
    // include Monday morning stuff.
    val popDaily = calcOnePopStats(now.minusHours(36), now, pageParts, actions, visitsByUserId)
    val popWeekly = calcOnePopStats(now.minusDays(8), now, pageParts, actions, visitsByUserId)
    val popMonthly = calcOnePopStats(now.minusDays(32), now, pageParts, actions, visitsByUserId)
    val popQuarterly = calcOnePopStats(now.minusDays(100), now, pageParts, actions, visitsByUserId)
    val popYearly = calcOnePopStats(now.minusDays(367), now, pageParts, actions, visitsByUserId)
    val popSinceGenesis = calcOnePopStats(When.Genesis, now, pageParts, actions, visitsByUserId)
    /*
    val popDaily = popularityInThePast(36 * OneHourInMillis)
    val popWeekly = popularityInThePast(8 * OneDayInMillis)
    val popMonthly = popularityInThePast(32 * OneDayInMillis)
    val popQuarterly = popularityInThePast(100 * OneDayInMillis)
    val popYearly = popularityInThePast(367 * OneDayInMillis)
    */

    PagePopStatsNowAndThen(
      pageId = pageParts.pageId,
      sinceYesterday = popDaily,
      sinceLastWeek = popWeekly,
      sinceLastMonth = popMonthly,
      sinceLastQuarter = popQuarterly,
      sinceLastYear = popYearly,
      sinceGenesis = popSinceGenesis)
  }


  def calcOnePopStats(from: When, to: When, pageParts: PageParts,
        actions: immutable.Seq[PostAction], visitsByUserId: Map[UserId, VisitTrust])
        : PagePopularityStats = {

    val topmostFractionByPostNr = mutable.Map[PostNr, Float]()
    val topmostSecondsSpent = treeSearchForTopmostPosts(pageParts, topmostFractionByPostNr)

    var numPosts = 0
    var numPostsInclOld = 0
    var numViewsByStrangers = 0
    var numViewsByMembers = 0
    var numViewsByTrusted = 0
    var numViewsByCore = 0
    var numLikesTotal = 0
    var numLikesByTrusted = 0
    var numLikesByCore = 0
    var numDisagreesTotal = 0
    var numDisagreesByTrusted = 0
    var numDisagreesByCore = 0
    var numUnwantedTotal = 0
    var numUnwantedByTrusted = 0
    var numUnwantedByCore = 0
    var numOpLikesTotal = 0
    var numOpLikesByTrusted = 0
    var numOpLikesByCore = 0
    var numOpDisagreesTotal = 0
    var numOpDisagreesByTrusted = 0
    var numOpDisagreesByCore = 0
    var numOpUnwantedTotal = 0
    var numOpUnwantedByTrusted = 0
    var numOpUnwantedByCore = 0
    var topmostLikeScoreTotal = 0f
    var topmostLikeScoreByTrusted = 0f
    var topmostLikeScoreByCore = 0f
    var topmostDisagreeScoreTotal = 0f
    var topmostDisagreeScoreByTrusted = 0f
    var topmostDisagreeScoreByCore = 0f
    var topmostUnwantedScoreTotal = 0f
    var topmostUnwantedScoreByTrusted = 0f
    var topmostUnwantedScoreByCore = 0f

    val visiblePosts = mutable.Set[PostId]()
    for {
      post <- pageParts.allPosts
      if post.isVisible
    } {
      visiblePosts += post.id
      if (post.createdWhen.isBefore(to)) {
        numPostsInclOld += 1
      }
      if (post.createdWhen.isBetween(from, to)) {
        numPosts += 1
      }
    }

    for {
      visit <- visitsByUserId.values
      visitedAt = When.fromMinutes(visit.visitMinute)
      if visitedAt.isBetween(from, to)
    } {
      numViewsByMembers += 1
      if (visit.trustLevelInt >= TrustLevel.TrustedMember.toInt) {
        numViewsByTrusted += 1
      }
      if (visit.trustLevelInt >= TrustLevel.CoreMember.toInt) {
        numViewsByCore += 1
      }
    }

    for {
      action <- actions
      if action.doneAt.isBetween(from, to)
      if visiblePosts.contains(action.uniqueId)
    } {
      // No visit might have been recorded, if the visitor didn't stay long enough (a few seconds).
      // COULD load those users explicitly.
      val visit = visitsByUserId.getOrElse(action.doerId, VisitTrust.UnknownMember)
      val isOrigPost = action.postNr == PageParts.BodyNr
      val isByTrusted = visit.trustLevelInt >= TrustLevel.TrustedMember.toInt
      val isByCore = visit.trustLevelInt >= TrustLevel.CoreMember.toInt
      val topmostFraction = topmostFractionByPostNr.getOrElse(action.postNr, 0f)
      val isTopmost = topmostFraction > 0.01f

      action.actionType match {
        case PostVoteType.Like =>
          numLikesTotal += 1
          if (isByTrusted) numLikesByTrusted += 1
          if (isByCore) numLikesByCore += 1
          if (isOrigPost) numOpLikesTotal += 1
          if (isOrigPost && isByTrusted) numOpLikesByTrusted += 1
          if (isOrigPost && isByCore) numOpLikesByCore += 1
          if (isTopmost) topmostLikeScoreTotal += 1f
          if (isTopmost && isByTrusted) topmostLikeScoreByTrusted += 1f
          if (isTopmost && isByCore) topmostLikeScoreByCore += 1f
        case PostVoteType.Wrong =>
          numDisagreesTotal += 1
          if (isByTrusted) numDisagreesByTrusted = 0
          if (isByCore) numDisagreesByCore = 0
          if (isOrigPost) numOpDisagreesTotal = 0
          if (isOrigPost && isByTrusted) numOpDisagreesByTrusted = 0
          if (isOrigPost && isByCore) numOpDisagreesByCore = 0
          if (isTopmost) topmostDisagreeScoreTotal += 1f
          if (isTopmost && isByTrusted) topmostDisagreeScoreByTrusted += 1f
          if (isTopmost && isByCore) topmostDisagreeScoreByCore += 1f
        case PostVoteType.Unwanted =>
          numUnwantedTotal += 1
          if (isByTrusted) numUnwantedByTrusted = 0
          if (isByCore) numUnwantedByCore = 0
          if (isOrigPost) numOpUnwantedTotal = 0
          if (isOrigPost && isByTrusted) numOpUnwantedByTrusted = 0
          if (isOrigPost && isByCore) numOpUnwantedByCore = 0
          if (isTopmost) topmostUnwantedScoreTotal += 1f
          if (isTopmost && isByTrusted) topmostUnwantedScoreByTrusted += 1f
          if (isTopmost && isByCore) topmostUnwantedScoreByCore += 1f
        case _ =>
          // skip
      }
    }

    PagePopularityStats(
      pageId = pageParts.pageId,
      from = from,
      to = to,
      numPosts = numPosts,
      numPostsInclOld = numPostsInclOld,
      numViewsByStrangers = numViewsByStrangers,
      numViewsByMembers = numViewsByMembers,
      numViewsByTrusted = numViewsByTrusted,
      numViewsByCore = numViewsByCore,
      numLikesTotal = numLikesTotal,
      numLikesByTrusted = numLikesByTrusted,
      numLikesByCore = numLikesByCore,
      numDisagreesTotal = numDisagreesTotal,
      numDisagreesByTrusted = numDisagreesByTrusted,
      numDisagreesByCore = numDisagreesByCore,
      numUnwantedTotal = numUnwantedTotal,
      numUnwantedByTrusted = numUnwantedByTrusted,
      numUnwantedByCore = numUnwantedByCore,
      numOpLikesTotal = numOpLikesTotal,
      numOpLikesByTrusted = numOpLikesByTrusted,
      numOpLikesByCore = numOpLikesByCore,
      numOpDisagreesTotal = numOpDisagreesTotal,
      numOpDisagreesByTrusted = numOpDisagreesByTrusted,
      numOpDisagreesByCore = numOpDisagreesByCore,
      numOpUnwantedTotal = numOpUnwantedTotal,
      numOpUnwantedByTrusted = numOpUnwantedByTrusted,
      numOpUnwantedByCore = numOpUnwantedByCore,
      topmostLikeScoreTotal = topmostLikeScoreTotal,
      topmostLikeScoreByTrusted = topmostLikeScoreByTrusted,
      topmostLikeScoreByCore = topmostLikeScoreByCore,
      topmostDisagreeScoreTotal = topmostDisagreeScoreTotal,
      topmostDisagreeScoreByTrusted = topmostDisagreeScoreByTrusted,
      topmostDisagreeScoreByCore = topmostDisagreeScoreByCore,
      topmostUnwantedScoreTotal = topmostUnwantedScoreTotal,
      topmostUnwantedScoreByTrusted = topmostUnwantedScoreByTrusted,
      topmostUnwantedScoreByCore = topmostUnwantedScoreByCore)
  }


  private def treeSearchForTopmostPosts(pageParts: PageParts,
        topmostFractionByPostNr: mutable.Map[PostNr, Float]): Int = {

    // For now, just this quick stuff: (not sure how much sense this makes)

    val MaxSeconds = 90
    var secondsSpent = 0
    val origPost = pageParts.postByNr(PageParts.BodyNr) getOrElse {
      return 0
    }
    topmostFractionByPostNr(origPost.nr) = 1f
    secondsSpent += 15  // for now. Could make depend on post length.

    val origChildrenSorted = pageParts.childrenSortedOf(origPost.nr)

    val firstOpReply = origChildrenSorted.headOption getOrElse {
      return secondsSpent
    }
    secondsSpent += addBranch(firstOpReply, pageParts, topmostFractionByPostNr,
        MaxSeconds - secondsSpent, 6)

    val secondOpReply = origChildrenSorted.drop(1).headOption getOrElse {
      return secondsSpent
    }
    secondsSpent += addBranch(secondOpReply, pageParts, topmostFractionByPostNr,
        MaxSeconds - secondsSpent, 5)

    val thirdOpReply = origChildrenSorted.drop(2).headOption getOrElse {
      return secondsSpent
    }
    secondsSpent += addBranch(thirdOpReply, pageParts, topmostFractionByPostNr,
        MaxSeconds - secondsSpent, 4)

    secondsSpent
  }


  private def addBranch(post: Post, pageParts: PageParts,
        topmostFractionByPostNr: mutable.Map[PostNr, Float],
        secondsLeft: Int, depthLeft: Int): Int = {
    if (secondsLeft <= 0 || depthLeft <= 0)
      return 0

    // For now, just this quick stuff: (not sure how much sense this makes)

    var timeSpentHere = 0
    if (post.numLikeVotes == 0) {
      timeSpentHere = 5 // boring comment, pretend we just skip it
    }
    else if (post.numUnwantedVotes > 0) {
      timeSpentHere = 10 // we read it but it's no good, unwanted
    }
    else {
      timeSpentHere = 10
      topmostFractionByPostNr(post.nr) = 1f
      val childrenSorted = pageParts.childrenSortedOf(post.nr)
      val firstReply = childrenSorted .headOption getOrElse {
        return timeSpentHere
      }
      timeSpentHere += addBranch(firstReply, pageParts, topmostFractionByPostNr,
          secondsLeft - timeSpentHere, depthLeft - 1)
    }

    timeSpentHere
  }
}


/**
 * Copyright (C) 2017 Kaj Magnus Lindberg
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

package talkyard.server.plugins.utx

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.dao.CreatePageResult
import debiki.EdHttp._
import talkyard.server._
import talkyard.server.http.ApiRequest
import talkyard.server.authz.Authz
import javax.inject.Inject
import play.api.libs.json.JsValue
import play.api.mvc.{Action, ControllerComponents, DiscardingCookie, Result}
import scala.collection.mutable


/** Saves Usability Testing Exchange tasks, and picks the next task to do.  [plugin]
  */
class UsabilityTestingExchangeController @Inject()(cc: ControllerComponents, tyCtx: TyContext)
  extends TyController(cc, tyCtx) {


  private def checkIsUtx(req: ApiRequest[_]): U = {
    throwForbiddenIf(!req.site.featureFlags.contains("ffIsUtx"), "TyENOTUTXEX",
          "This endpoint is for Usability Testing Exchange only")
  }


  def handleUsabilityTestingForm: Action[JsValue] = PostJsonAction(
        RateLimits.PostReply, maxBytes = MaxPostSize) { request =>
    import request.dao
    checkIsUtx(request)

    val pageTypeIdString = (request.body \ "pageTypeId").as[String]
    val pageTypeId = pageTypeIdString.toIntOption.getOrThrowBadArgument("EsE6JFU02", "pageTypeId")
    val pageType = PageType.fromInt(pageTypeId).getOrThrowBadArgument("EsE39PK01", "pageTypeId")

    val addressOfWebsiteToTest: String = {
      val address = (request.body \ "websiteAddress").as[String]
      if (address.matches("^https?://.*")) address else s"http://$address"
    }
    if (addressOfWebsiteToTest.count(_ == ':') > 1)
      throwBadRequest("EdE7FKWU0", "Too many protocols (':') in website address")
    if (addressOfWebsiteToTest.exists("<>[](){}'\"\n\t\\ " contains _))
      throwBadRequest("EdE2WXBP6", "Weird character(s) in website address")

    val titleText = addressOfWebsiteToTest.replaceFirst("https?://", "")

    // This'll be sanitized.
    val instructions = (request.body \ "instructionsToTester").as[String]
    val bodyText = i"""
       |**Go here:** <a href="$addressOfWebsiteToTest" target="_blank" rel="nofollow">$titleText</a>
       |
       |**Then answer these questions:**
       |
       |$instructions
       """

    val titleSourceAndHtml = TitleSourceAndHtml(titleText)
    val bodyTextAndHtml = dao.textAndHtmlMaker.forBodyOrCommentAsPlainTextWithLinks(bodyText)

    val categorySlug = (request.body \ "categorySlug").as[String]
    val category = request.dao.getCategoryBySlug(categorySlug).getOrThrowBadArgument(
      "EsE0FYK42", s"No category with slug: $categorySlug")

    val res: CreatePageResult = dao.createPageIfAuZ(
          pageType,
          PageStatus.Published,
          inCatId = Some(category.id),
          withTags = Nil,
          anyFolder = None,
          anySlug = None,
          title = titleSourceAndHtml,
          bodyTextAndHtml = bodyTextAndHtml,
          showId = true,
          deleteDraftNr = None,
          reqrAndCreator = request.reqrTargetSelf,
          spamRelReqStuff = request.spamRelatedStuff,
          doAsAnon = None,
          discussionIds = Set.empty,
          embeddingUrl = None,
          refId = None)

    Ok
  }


  /**
    * This is an a bit expensive query? Full-text-search is, too, so let's use its rate limits.
    */
  def pickTask(categorySlug: String): Action[Unit] =
        GetActionRateLimited(RateLimits.FullTextSearch) { request =>
    checkIsUtx(request)
    doPickTask(categorySlug, request)
  }


  /** Finds the user with the highest get-feedback-credits, and then
    * picks hens open topic with the least number of feedbacks received.
    *
    * Later: more accurate algorithm:
    *
    * for all open tofics in text-exchange category,
    * find authors,
    * calculate credits, dynamically:
    *
    * for each author A
    *
    *   load all topics created by A + where A has made a top-level-reply.
    *
    * 	loop:
    * 	  if not-unwanted top level reply, to other than A:
    * 			credits +=
    * 				num chars in reply, excl quotes
    * 			 — no, tiny bug! Should loop through posts in created-at order, not *topic*-created-at
    *
    *     if A's topic:
    * 		  find all not-unwanted top level replies, by other than A
    * 			credits -=
	  *			num chars in those replies, excl quotes
    *
    *    if (credits < 0)
	  *		  credits = 0
    *
    */
  private def doPickTask(categorySlug: String, request: http.GetRequest): Result = {
    import request.{dao, theRequester}

    val category = dao.getCategoryBySlug(categorySlug).getOrThrowBadArgument(
      "EsE0FYK42", s"No category with slug: $categorySlug")

    val topicIdsToSkip: Set[PageId] =
          tyCtx.security.urlDecodeCookie("edCoUtxSkip", request.request) match {
      case None => Set.empty
      case Some(pageIdCommaList) =>
        val pageIds = pageIdCommaList.split(",")  // split() excludes trailing empty strings
        Set(pageIds: _*)
    }

    val authzCtx = dao.getForumAuthzContext(Some(theRequester))

    // Def-in-depth extra access check.  (dao.loadPagesCanSeeInCatIds() below does too.)
    {
      val catsRootLast = dao.getAncestorCategoriesRootLast(category.id, inclSelfFirst = true)
      val may = Authz.maySeeCategory(authzCtx, catsRootLast = catsRootLast)
      throwForbiddenIf(may.maySee isNot true, "TyEUTXBADCAT", "Bad UTX category slug")
    }

    // (Don't include deleted topics, to mitigate the below DoS attack. Ban people who post stuff
    // that the staff then deletes.)
    val pageQuery = PageQuery(PageOrderOffset.ByCreatedAt(None),
      PageFilter(PageFilterType.AllTopics, includeDeleted = false),
      includeAboutCategoryPages = false)

    val topicsWithAboutPage = dao.loadPagesCanSeeInCatIds(
          Vec(category.id), pageQuery, limit = 1000, authzCtx) ;SECURITY // UTX DoS attack, fairly harmless. If topics created too fast.

    // Filter away any topics that for some reason are of the wrong type (maybe was moved manually).
    val usabilityTestingTopics =
      topicsWithAboutPage.filter(_.pageType == PageType.UsabilityTesting)

    val feedbackByPageId = dao.readOnlyTransaction { tx =>
      tx.loadApprovedOrigPostAndRepliesByPage(usabilityTestingTopics.map(_.pageId))
    }

    val creditsByUserId = mutable.Map[UserId, Float]()

    val topicsOldestFirst = usabilityTestingTopics.sortBy(_.meta.createdAt.getTime)
    for (topic <- topicsOldestFirst) {
      val authorId = topic.meta.authorId
      val authorCredits: Float = creditsByUserId.getOrElse(authorId, 0f)
      val feedbacks: Seq[Post] = feedbackByPageId.getOrElse(topic.pageId, Nil).filter(_.isOrigPostReply)
      //System.out.println(s"Topic ${topic.pageId}, num feedbacks: ${feedbacks.length}, author $authorId with credits: $authorCredits")
      var creditsConsumedByAuthor = 0f
      var numFeedbackPostsToAuthor = 0 // nice to see if debugging
      // Tiny bug: here we have in effect sorted the feedback posts by when the *topic* was created
      // rather than when the feedback was given. Barely matters, perhaps better to never "fix".
      for (feedback: Post <- feedbacks) {
        val feedbackLength = feedback.approvedSource.map(_.length) getOrElse 0
        // Credits should be proportional to log(x * feedback-length),
        // but not directly proportional to the feedback length, because
        // a short piece of feedback probably contains the most interesting & important
        // stuff, whereas a longer piece of feedback contains that, + also other stuff that is
        // useful, but slightly less important.
        // This looks fine:   Plot[1000 * Log[x/1000 + 0.999], {x, 0, 5000}]
        // (where x = feedback length, in characters)
        // Here you can look at the graph:
        //   http://www.wolframalpha.com/input/?source=nav&i=logarithms
        // That formula results in this:
        // 100 chars —> 94 credits
        // 500 chars —> 400 credits
        // 1000 chars —> 700 credits
        // 2000 chars —> 1100 credits
        // 5000 chars —> 1800 credits
        // 10000 chars —> 2400 credits
        // — this makes it better to give feedback-of-length-2000 to three different people,
        // rather than writing a 10 000 chars essay to one single person.
        val credits = 1000f * math.max(0f, math.log(feedbackLength / 1000f + 0.999f).toFloat)
        //System.out.println(s"Topic ${topic.pageId}: feedbackLength: $feedbackLength = $credits credits")
        creditsConsumedByAuthor += credits
        numFeedbackPostsToAuthor += 1
        val testersCredits: Float = creditsByUserId.getOrElse(feedback.createdById, 0f)
        creditsByUserId(feedback.createdById) = testersCredits + credits
      }
      // No?
      //val newAuthorCredits = math.max(0, authorCredits - creditsConsumedByAuthor)
      // because then the author's negative credits gets reset to 0, even if hen got lots
      // of feedback after his/her topic. And hen will get + credits for feedback hen gave, later.
      // Instead:
      val newAuthorCredits = authorCredits - creditsConsumedByAuthor

      //System.out.println(s"Topic ${topic.pageId}: author $authorId credits -= $creditsConsumedByAuthor —> = $newAuthorCredits")
      creditsByUserId(authorId) = newAuthorCredits
    }

    val allFeedback = feedbackByPageId.values.flatten.filter(_.isOrigPostReply)

    // Don't give more feedback to people who have gotten fairly much more feedback
    // than what they have given.
    val okUserIdsAndCredits = creditsByUserId.toVector.filter(_._2 > -1500)

    // Iterate through all people who have given feedback, ordered by most feedback given minus gotten,
    // first. And select for feedback, the first such person, who has asked for help
    // unless the requester has helped hen already. (Usually simply the first person.)
    // If hen has created many topics, select among the still active ones, the topic with the
    // fewest number of replies.
    val userIdsSortedByCreditsDesc = okUserIdsAndCredits.sortBy(-_._2).map(_._1)
    for (userId <- userIdsSortedByCreditsDesc ; if userId != theRequester.id) {
      val topicsByUser = usabilityTestingTopics.filter(_.meta.authorId == userId)
      val openTopics = topicsByUser.filter(_.meta.closedAt.isEmpty)
      val openTopicIds = openTopics.map(_.pageId)
      val numRepliesByTopicId = mutable.Map[PageId, Int](openTopicIds.map(_ -> 0): _*)
      for (feedback: Post <- allFeedback) {
        if (openTopicIds.contains(feedback.pageId)) {
          val numFeedbacks = numRepliesByTopicId(feedback.pageId)
          numRepliesByTopicId(feedback.pageId) = numFeedbacks + 1
        }
      }
      val topicIdsSortedNumRepliesAsc = numRepliesByTopicId.toVector.sortBy(_._2)
      for (topicIdAndNumReplies <- topicIdsSortedNumRepliesAsc) {
        val topicId: PageId = topicIdAndNumReplies._1
        // This is the topic with the least feedbacks given, created by the user with the most
        // unused credits, which the requester hasn't skipped or given feedback too already.
        val shallSkipThisTopic = topicIdsToSkip contains topicId
        val feedbackThisTopic: Seq[Post] = feedbackByPageId.getOrElse(topicId, Nil)
        val alreadyGivenFeedback = feedbackThisTopic.exists(_.createdById == theRequester.id)
        if (!shallSkipThisTopic && !alreadyGivenFeedback) {
          val topic = usabilityTestingTopics.find(_.pageId == topicId) getOrDie "EdE8GKC1"
          return TemporaryRedirect(topic.path.value)
        }
      }
      // Either the requester wants to skip all tasks by this user, or the user has *given*
      // feedback only, not asked for any UX testing help henself. Pick a task from
      // the next user instead ... by looping another lap.
    }

    TemporaryRedirect(s"/nothing-more-to-do")
        .discardingCookies(DiscardingCookie(tyCtx.globals.cookiePrefix + "edCoUtxSkip"))
  }

}

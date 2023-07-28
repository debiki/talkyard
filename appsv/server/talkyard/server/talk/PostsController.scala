/**
 * Copyright (c) 2014-2023 Kaj Magnus Lindberg
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

package talkyard.server.talk

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.dao.{LoadPostsResult, SiteDao}
import debiki.EdHttp._
import talkyard.server.http._
import play.api.mvc
import play.api.libs.json._
import play.api.mvc.{Action, ControllerComponents}
import scala.collection.{mutable => mut}
import talkyard.server.{TyContext, TyController}
import javax.inject.Inject
import talkyard.server.JsX._
import talkyard.server.TyLogging


/** Handles requests related to posts (pages, comments, later: flags?).
  */
class PostsController @Inject()(cc: ControllerComponents, edContext: TyContext)
  extends TyController(cc, edContext) with TyLogging {

  import context.security.{throwNoUnless, throwIndistinguishableNotFound}
  import context.globals


  def listTopicsByUser(userId: PatId): Action[U] = GetAction { request =>
    import request.{dao, requester}

    val isStaff = requester.exists(_.isStaff)
    val isStaffOrSelf = isStaff || requester.exists(_.id == userId)
    // Return Not Found directly, using the cache, if no such user.
    dao.getTheParticipant(userId)

    throwForbiddenIfActivityPrivate(userId, requester, dao)

    // Later, include, if reqr is the author henself. [list_anon_posts]
    val inclAnonPosts = false

    val topicsInclForbidden = dao.loadPagesByUser(
      userId, isStaffOrSelf = isStaffOrSelf, inclAnonPosts = inclAnonPosts, limit = 200)
    val topics = topicsInclForbidden filter { page: PagePathAndMeta =>
      dao.maySeePageUseCache(page.meta, requester, maySeeUnlisted = isStaffOrSelf).maySee
    }
    controllers.ForumController.makeTopicsResponse(topics, dao)
  }


  def listPostsByUser(authorId: UserId, relType: Opt[Int], which: Opt[Int]): Action[U] =
          GetActionRateLimited() { req: GetRequest =>
    relType match {
      case None =>
        // Later, will use PostQuery here too, just like below (and this match-case
        // branch maybe then no longer needed).
        listPostsImpl(authorId, all = false, req)
      case Some(relTypeInt) =>

        // Tests:
        //    - assign-to-basic.2br.d  TyTASSIGN01

        RENAME // authorId param to: relToPatId, later.
        val relToPatId = authorId
        val relType = PatNodeRelType.fromInt(relTypeInt).getOrThrowBadRequest(
              "TyE502SMJ", "Only Assigned-To has been implemented")

        val reqrIsStaff = req.requester.exists(_.isStaff)
        val reqrIsStaffOrSelf = reqrIsStaff || req.requester.exists(_.id == relToPatId)

        val onlyOpen = which is 678321  // for now
        val query = PostQuery.PostsRelatedToPat(
              reqrInf = req.reqrInf,
              relatedPatId = relToPatId,
              relType = relType,
              onlyOpen = onlyOpen,
              // Later, incl anon posts, if is PatNodeRelType.AssignedTo? [list_anon_posts]
              inclAnonPosts = false,
              inclTitles = false,
              inclUnapproved = reqrIsStaffOrSelf,
              inclUnlistedPagePosts =
                    // Not listing pat's assignments, would be confusing? [.incl_unl]
                    relType == PatNodeRelType.AssignedTo || reqrIsStaffOrSelf,
              limit = 100,
              orderBy = OrderBy.MostRecentFirst)

        _listPostsImpl2(query, req.dao)
    }
  }


  private def listPostsImpl(authorId: UserId, all: Boolean, request: GetRequest): mvc.Result = {
    import request.dao
    import request.{dao, requester}

    val requesterIsStaff = requester.exists(_.isStaff)
    val requesterIsStaffOrAuthor = requesterIsStaff || requester.exists(_.id == authorId)

     /*/ Later: Throw if the reqr may not see `authorId`. [private_pats]
    val author = dao.getParticipant(authorId) getOrElse throwNotFound("EdE2FWKA9", "Author not found")
     */

    throwForbiddenIfActivityPrivate(authorId, requester, dao)

    // For now. LATER: if really many posts, generate an archive in the background.
    // And if !all, and > 100 posts, add a load-more button.
    val limit = all ? 9999 | 100

    _listPostsImpl2(
          PostQuery.PostsByAuthor(
                reqrInf = request.reqrInf,
                orderBy = OrderBy.MostRecentFirst,
                limit = limit,
                // Later, include, if reqr is the author henself. [list_anon_posts]
                inclAnonPosts = false,
                // One probably wants to see one's own not-yet-approved posts.
                inclUnapproved = requesterIsStaffOrAuthor,
                inclTitles = false,
                // Can this cause confusion? But unlisted posts aren't supposed
                // to be listed. Also see [.incl_unl] above.
                inclUnlistedPagePosts = requesterIsStaffOrAuthor,
                authorId = authorId), dao)
  }


  private def _listPostsImpl2(query: PostQuery, dao: SiteDao): mvc.Result = {
    val LoadPostsResult(postsOneMaySee, pageStuffById) =
          // This excludes any stuff the requester may not see. [downl_own_may_see]
          dao.loadPostsMaySeeByQuery(query)

    val posts = postsOneMaySee

    val patIds = mut.Set[PatId]()
    posts.foreach(_.addVisiblePatIdsTo(patIds))

    // Bit dupl code. [pats_by_id_json]
    val patsById: Map[PatId, Pat] = dao.getParticipantsAsMap(patIds)


    COULD_OPTIMIZE // cache tags per post? And badges per pat?
    // What about [assignees_badges]? Currently not shown.
    val tagsAndBadges: TagsAndBadges = dao.readTx(_.loadPostTagsAndAuthorBadges(posts.map(_.id)))
    val tagTypes = dao.getTagTypes(tagsAndBadges.tagTypeIds)

    val patsJsArr = JsArray(patsById.values.toSeq map { pat =>
      JsPat(pat, tagsAndBadges,
            toShowForPatId = Some(query.reqr.id))  // Maybe use Opt[Pat] instead, hmm
    })

    val postsJson = posts flatMap { post =>
      val pageStuff = pageStuffById.get(post.pageId) getOrDie "EdE2KW07E"
      val pageMeta = pageStuff.pageMeta
      var postJson = dao.jsonMaker.postToJsonOutsidePage(post, pageMeta.pageType,
            showHidden = true,
            // Really need to specify this again?
            includeUnapproved = query.reqrIsStaffOrObject,
            tagsAndBadges)

      pageStuffById.get(post.pageId) map { pageStuff =>
        postJson += "pageId" -> JsString(post.pageId)
        postJson += "pageTitle" -> JsString(pageStuff.title)
        postJson += "pageRole" -> JsNumber(pageStuff.pageRole.toInt)
        if (query.reqr.isStaff && (post.numPendingFlags > 0 || post.numHandledFlags > 0)) {
          postJson += "numPendingFlags" -> JsNumber(post.numPendingFlags)
          postJson += "numHandledFlags" -> JsNumber(post.numHandledFlags)
        }
        postJson
      }
    }

    OkSafeJson(Json.obj(  // Typescript: LoadPostsResponse
      "posts" -> JsArray(postsJson),
      "patsBrief" -> patsJsArr,
      "tagTypes" -> JsArray(tagTypes map JsTagType)))
  }


  def downloadUsersContent(authorId: UserId): Action[Unit] = GetActionRateLimited(
        RateLimits.DownloadOwnContentArchive) { request: GetRequest =>
    // These responses can be huge; don't prettify the json.
    listPostsImpl(authorId, all = true, request)
  }


  private def throwForbiddenIfActivityPrivate(
          userId: UserId, requester: Opt[Pat], dao: SiteDao): U = {
    // Also browser side [THRACTIPRV]
    // Related idea: [private_pats].
    throwForbiddenIf(!maySeeActivity(userId, requester, dao),
          "TyE4JKKQX3", "Not allowed to list activity for this user")
  }


  private def maySeeActivity(userId: UserId, requester: Option[Participant], dao: SiteDao): Boolean = {
    // Guests cannot hide their activity. One needs to create a real account.
    if (!Participant.isMember(userId))
      return true

    // Staff and the user henself can view hens activity.
    if (requester.exists(r => r.isStaff || r.id == userId))
      return true

    COULD_OPTIMIZE // Use cache
    val memberInclDetails = dao.loadTheMemberInclDetailsById(userId)
    memberInclDetails.privPrefs.seeActivityMinTrustLevel match {
      case None => true
      case Some(minLevel) =>
        requester.exists(_.effectiveTrustLevel.toInt >= minLevel.toInt)
    }
  }

}


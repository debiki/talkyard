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
import debiki.dao.{LoadPostsResult, SiteDao, PageStuff}
import debiki.EdHttp._
import talkyard.server.http._
import play.api.mvc
import play.api.libs.json._
import play.api.mvc.{Action, ControllerComponents}
import scala.collection.{mutable => mut}
import talkyard.server.authn.MinAuthnStrength
import talkyard.server.{TyContext, TyController}
import talkyard.server.authz.{PatAndPrivPrefs}
import javax.inject.Inject
import talkyard.server.JsX._
import talkyard.server.TyLogging


/** Handles requests related to posts (pages, comments, later: flags?).
  */
class PostsController @Inject()(cc: ControllerComponents, edContext: TyContext)
  extends TyController(cc, edContext) with TyLogging {

  import context.security.{throwNoUnless, throwIndistinguishableNotFound}
  import context.globals


  def listTopicsByUser(userId: PatId): Action[U] = GetActionRateLimited(
        minAuthnStrength = MinAuthnStrength.EmbeddingStorageSid12,  // [if_emb_forum]
        ) { request =>
    import request.{dao, requesterOrUnknown, requester}

    // Return Not Found directly, using the cache, if no such user.  Bit dupl [_6827]
    val targetUser: Pat =
          dao.getParticipant(userId) getOrElse {
            throwIndistinguishableNotFound("TyE0PAT020764")
          }

    _throwIfMayNotSeeActivity(requesterOrUnknown, targetUser, dao)

    val isSelf = requester.exists(_.id == userId)
    val isStaff = requester.exists(_.isStaff)
    val isStaffOrSelf = isStaff || isSelf

    // Later, include, if reqr is the author henself. [list_anon_posts]
    val inclAnonPosts = false

    val topicsInclForbidden = dao.loadPagesByUser(
      userId, isStaffOrSelf = isStaffOrSelf, inclAnonPosts = inclAnonPosts, limit = 200)
    val topics = topicsInclForbidden filter { page: PagePathAndMeta =>
      dao.maySeePageUseCache(page.meta, requester, maySeeUnlisted = isStaffOrSelf).maySee
    }

    controllers.ForumController.makeTopicsResponse(topics, dao)
  }


  def listPostsByUser(authorId: UserId, postType: Opt[i32], relType: Opt[Int],
          which: Opt[Int]): Action[U] =
        GetActionRateLimited(
            minAuthnStrength = MinAuthnStrength.EmbeddingStorageSid12,  // [if_emb_forum]
            ) { req: GetRequest =>
    import req.{dao, requesterOrUnknown}

    // Return Not Found directly, using the cache, if no such user.  Bit dupl [_6827]
    val targetUser: Pat =
          dao.getParticipant(authorId) getOrElse {
            throwIndistinguishableNotFound("TyE0PAT020764")
          }

    // (_Double_check 1/2, if calling _listPostsImpl(), oh well.)
    _throwIfMayNotSeeActivity(requesterOrUnknown, targetUser, dao)

    val postType2 = postType.map(t => PostType.fromInt(t).getOrThrowBadRequest(
          "TyEPOSTTY037", s"Bad post type: $t"))
    val onlyOpen = which is 678321  // for now

    relType match {
      case None =>
        if (postType2 is PostType.Bookmark) {
          TESTS_MISSING  // TyTBOOKMLS
          // For now, can't list other's bookmarks. Maybe will be shared bookmarks some day.
          // Others' bookmarks are filtered away here: [own_bookmarks]  but mabye there's
          // a way to find out if other bookarks exist, see:  [others_bookmarks]
          // So, for now, to prevent that, abort directly.
          throwForbiddenIf(req.reqrInf.id != authorId,
                "TyE0YOURBOOKMS", "Can't list other people's bookmarks")

          val query = PostQuery.PatsBookmarks(
                reqrInf = req.reqrInf,
                bookmarkerId = authorId,
                limit = 100, // UX, [to_paginate]
                orderBy = OrderBy.MostRecentFirst)
          OkSafeJson(
                _listPostsImpl2(query, req.dao))
        }
        else if (postType2.isDefined) {
          // This is probably totally fine, just that it's currently dead code,
          // never invoked by the current Ty browser client.
          // Later: Simply remove this `else-if`, keep the `else` below.
          TESTS_MISSING
          throwUntested("TyETYPE0BOKM", "postType != bookmarks")
        }
        else {
          // Later, will use PostQuery here too, just like below (and this match-case
          // branch maybe then no longer needed).
          _listPostsImpl(authorId, onlyPostType = postType2, all = false, req)
        }
      case Some(relTypeInt) =>

        // Tests:
        //    - assign-to-basic.2br.d  TyTASSIGN01

        RENAME // authorId param to: relToPatId, later.
        val relToPatId = authorId
        val relType = PatNodeRelType.fromInt(relTypeInt).getOrThrowBadRequest(
              "TyE502SMJ", "Only Assigned-To has been implemented")

        val reqrIsStaff = req.requester.exists(_.isStaff)
        val reqrIsStaffOrSelf = reqrIsStaff || req.requester.exists(_.id == relToPatId)

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
              limit = 100, // UX, [to_paginate]
              orderBy = OrderBy.MostRecentFirst)

        OkSafeJson(
            _listPostsImpl2(query, req.dao))
    }
  }


  def listPostsWithTag(typeIdOrSlug: St): Action[U] = GetActionRateLimited(
          RateLimits.ReadsFromDb,
          MinAuthnStrength.EmbeddingStorageSid12,  // [if_emb_forum]
          ) { req =>
    import req.dao
    // Later, excl private tags (once implemented). [priv_tags]

    val reqrIsStaff = req.requester.exists(_.isStaff)

    val tagTypeId = typeIdOrSlug.toIntOption getOrElse {
      val tagType = dao.getTagTypesBySlug().getOrElse(typeIdOrSlug,
            throwNotFound("TyETYPESLUG", s"There's no type with URL slug '$typeIdOrSlug'"))
      tagType.id
    }

    /* [sort_tag_vals_in_pg]
    val orderBy2: PostsWithTagOrder = orderBy match {
      case None => PostsWithTagOrder.ByPublishedAt(desc = true)
      case Some(str) =>
        if (str == "value:asc") PostsWithTagOrder.ByTagValue(desc = false)
        else if (str == "value:desc") PostsWithTagOrder.ByTagValue(desc = true)
        else throwBadRequest("TyEBADSORT502", s"Unsupported sort order: $str")
    } */

    val query = PostQuery.PostsWithTag(
          reqrInf = req.reqrInf,
          tagTypeId: TagTypeId,
          // UX; COULD: Show one's own unapproved posts with this tag, also if isn't staff.
          inclUnapproved = reqrIsStaff,
          // Pages that aren't listed in a category, also shouldn't be listed if
          // listing by tag? (Otherwise, what's the point with Unlisted)  [.incl_unl]
          // `inclUnlistedPagePosts` doesn't make sense here, because this is a tags query,
          // but `inclUnlistedPagePosts` isn't a tags prop but a pages prop, hmm.
          // Maybe change value from true/false to:
          //   Never / Always / If-Requester-Is-Author-And-Page-Not-Deleted,  hmm.
          // For now:
          inclUnlistedPagePosts = reqrIsStaff,
          limit = 100, // UX, [to_paginate]
          orderBy = OrderBy.MostRecentFirst)

    var res = _listPostsImpl2(query, dao)

    // If we're looking up the tag type by url slug, then, the client might not know
    // the id of the tag type.
    res += "typeId" -> JsNumber(tagTypeId)

    OkSafeJson(res)
  }


  private def _listPostsImpl(authorId: UserId, onlyPostType: Opt[PostType], all: Bo,
          request: GetRequest): mvc.Result = {
    import request.dao
    import request.{dao, requester, requesterOrUnknown}

    untestedIf(onlyPostType.isDefined, "TyEONLYTYPE", "onlyPostType")

    // Return Not Found directly, using the cache, if no such user.  Bit dupl [_6827]
    val targetUser: Pat =
          dao.getParticipant(authorId) getOrElse {
            throwIndistinguishableNotFound("TyE0PAT020764")
          }

    // (_Double_check 2/2, if caller is listPostsByUser(), oh well.)
    _throwIfMayNotSeeActivity(requesterOrUnknown, targetUser, dao)

    val requesterIsStaff = requester.exists(_.isStaff)
    val requesterIsStaffOrAuthor = requesterIsStaff || requester.exists(_.id == authorId)

    // For now. LATER: if really many posts, generate an archive in the background.
    // And if !all, and > 100 posts, add a load-more button.  UX, [to_paginate]
    val limit = all ? 9999 | 100

    val res = _listPostsImpl2(
          PostQuery.PostsByAuthor(
                reqrInf = request.reqrInf,
                onlyPostType = onlyPostType,
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
    OkSafeJson(res)
  }


  private def _listPostsImpl2(query: PostQuery, dao: SiteDao): JsObject = {
    val LoadPostsResult(
          postsOneMaySee,
          pageStuffById,
          bookmarksMaySee) =
              // This excludes any stuff the requester may not see. [downl_own_may_see]
              dao.loadPostsMaySeeByQuery(query)

    val posts = postsOneMaySee

    // Bit dupl code. [posts_2_json]

    val patIds = mut.Set[PatId]()
    posts.foreach(_.addVisiblePatIdsTo(patIds))

    // Bit dupl code. [pats_by_id_json]
    val patsById: Map[PatId, Pat] = dao.getParticipantsAsMap(patIds)

    val anyTypeIdInQuery = query match {
      case q: PostQuery.PostsWithTag => Set(q.tagTypeId)
      case _ => Set.empty
    }

    COULD_OPTIMIZE // cache tags per post? And badges per pat?
    // What about [assignees_badges]? Currently not shown.
    val tagsAndBadges: TagsAndBadges = dao.readTx(_.loadPostTagsAndAuthorBadges(posts.map(_.id)))
    val tagTypes = dao.getTagTypes(tagsAndBadges.tagTypeIds ++ anyTypeIdInQuery)

    val patsJsArr = JsArray(patsById.values.toSeq map { pat =>
      JsPat(pat, tagsAndBadges,
            )  // skip!  toShowForPatId = Some(query.reqr.id))  // Maybe use Opt[Pat] instead, hmm
    })

    val bookmarksJson: ImmSeq[JsObject] = bookmarksMaySee map { post =>
      dao.jsonMaker.postToJsonOutsidePage(post, PageType.Discussion /* doesn't matter */,
            showHidden = true,
            // Bookmars don't get approved by anyone.
            includeUnapproved = true,
            // Some day, it'll be possible to tag one's bookmarks? [tagd_bokms]
            // But these tags are for the *bookmarked* posts only. Need to incl bookmark posts
            // (not only bookmarked posts) when calling loadPostTagsAndAuthorBadges() above.
            tagsAndBadges,
            // Bookmarks are usually on different pages, need to know which, so can jump
            // to the correct page (in the browser) when clicking a bookmark.
            inclPageId = true)
    }

    val postsJson: ImmSeq[JsObject] = posts map { post =>
      val pageStuff = pageStuffById.get(post.pageId) getOrDie "EdE2KW07E"
      val pageMeta = pageStuff.pageMeta
      var postJson = dao.jsonMaker.postToJsonOutsidePage(post, pageMeta.pageType,
            showHidden = true,
            // Really need to specify this again?
            includeUnapproved = query.reqrIsStaffOrObject,
            tagsAndBadges,
            inclPageId = true)

      if (query.reqr.isStaff && (post.numPendingFlags > 0 || post.numHandledFlags > 0)) {
        postJson += "numPendingFlags" -> JsNumber(post.numPendingFlags)
        postJson += "numHandledFlags" -> JsNumber(post.numHandledFlags)
      }

      // Since these posts aren't wrapped in a page, but rather listed separately
      // outside their parent pages, it's nice to have the page title available
      // to show in the browser. And page id, see `inclPageId` above.  [posts_0_page_json]
      // Typescript: PostWithPage
      assert(JsonUtils.parseOptSt(postJson, "pageId") == Some(pageStuff.pageId))
      postJson += "pageTitle" -> JsString(pageStuff.title)
      postJson += "pageRole" -> JsNumber(pageStuff.pageRole.toInt)
      postJson
    }

    Json.obj(  // Typescript: LoadPostsResponse
            "posts" -> JsArray(postsJson),
            "bookmarks" -> JsArray(bookmarksJson),
            "storePatch" -> Json.obj(
              // RENAME  to patsBr? (for "brief", Ty standard abbreviation)
              "patsBrief" -> patsJsArr,
              // RENAME  to tagsBr?  no!,  "typesBr" ?
              "tagTypes" -> JsTagTypeArray(tagTypes, inclRefId = query.reqr.isStaff)))
  }


  def downloadUsersContent(authorId: UserId): Action[Unit] = GetActionRateLimited(
        RateLimits.DownloadOwnContentArchive,
        // But don't reduce  minAuthnStrength, even if embedded forum.
        ) { request: GetRequest =>
    // These responses can be huge; don't prettify the json.
    _listPostsImpl(authorId, onlyPostType = None, all = true, request)
  }


  private def _throwIfMayNotSeeActivity(requester: Pat, targetUser: Pat, dao: SiteDao): U = {
    // Also browser side [THRACTIPRV]
    val isSelf = requester.id == targetUser.id
    val isStaff = requester.isStaff
    val isStaffOrSelf = isStaff || isSelf

    val allGroups: Vec[Group] = dao.getAllGroups()
    val targetStuff: PatAndPrivPrefs = dao.getPatAndPrivPrefs(targetUser, allGroups)
    val targetsPrivPrefs = targetStuff.privPrefsOfPat

    // Can be good if e.g. mods can see someone's post history, even if they can't
    // see any of hans profile page details. So they can know if han is well-behaved or not.
    // So, it's enough if `maySeeActivity` allows, `maySeeMyProfileTrLv` not required.
    // [see_activity_0_profile]
    val maySeeActivity = isStaffOrSelf || targetsPrivPrefs.seeActivityMinTrustLevel.forall(
          _.isAtMost(requester.effectiveTrustLevel))
    val maySeeProfilePage = isSelf || targetsPrivPrefs.maySeeMyProfileTrLv.forall(
          _.isAtMost(requester.effectiveTrustLevel))

    if (!maySeeActivity) {
      if (!maySeeProfilePage) {
        throwIndistinguishableNotFound("TyEM0SEEPROF053")
      }
      throwForbidden("TyEM0LISTACT1", "Cannot list activity for this user")
    }
  }

}


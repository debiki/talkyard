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

package com.debiki.dao.rdb

import collection.immutable
import collection.mutable.ArrayBuffer
import com.debiki.core._
import com.debiki.core.PageParts.TitleNr
import com.debiki.core.Prelude._
import java.{sql => js}
import Rdb._
import RdbUtil._
import PostsSiteDaoMixin._


/** Loads and saves posts.
  */
trait PostsSiteDaoMixin extends SiteTransaction {
  self: RdbSiteTransaction =>

  override def loadPost(uniquePostId: PostId): Option[Post] =
    loadPostsById(Seq(uniquePostId)).headOption


  override def loadPost(pageId: PageId, postNr: PostNr): Option[Post] =
    loadPostsOnPageImpl(pageId, postNr = Some(postNr), siteId = None).headOption


  override def loadPostsOnPage(pageId: PageId, siteId: Option[SiteId]): immutable.Seq[Post] =
    loadPostsOnPageImpl(pageId, postNr = None, siteId = None)


  def loadPostsOnPageImpl(pageId: PageId, postNr: Option[PostNr], siteId: Option[SiteId])
        : immutable.Seq[Post] = {
    var query = "select * from posts3 where SITE_ID = ? and PAGE_ID = ?"
    val values = ArrayBuffer[AnyRef](siteId.getOrElse(this.siteId).asAnyRef, pageId)
    postNr foreach { id =>
      // WOULD simplify: remove this block, use loadPosts(Iterable[PagePostId]) instead.
      query += " and post_nr = ?"
      values.append(id.asAnyRef)
    }
    runQueryFindMany(query, values.toList, rs => {
      readPost(rs, pageId = Some(pageId))
    })
  }


  override def loadOrigPostAndLatestPosts(pageId: PageId, limit: Int): Seq[Post] = {
    require(limit > 0, "EsE7GK4W0")
    // Use post_nr, not created_at, because 1) if a post is moved from another page to page pageId,
    // then its created_at might be long-ago, although its post_nr will become the highest
    // on this page once it's been added. Also 2) there's an index on pageid, post_nr.
    val query = s"""
      select * from posts3 where site_id = ? and page_id = ? and
          post_nr in (${PageParts.TitleNr}, ${PageParts.BodyNr})
      union
      select * from (
        select * from posts3 where site_id = ? and page_id = ?
        order by post_nr desc limit $limit) required_subquery_alias
      """
    runQueryFindMany(query, List(siteId.asAnyRef, pageId.asAnyRef, siteId.asAnyRef,
        pageId.asAnyRef), rs => {
      readPost(rs, pageId = Some(pageId))
    })
  }


  private def loadPostsById(postIds: Iterable[PostId]): immutable.Seq[Post] = {
    if (postIds.isEmpty)
      return Nil
    val values = ArrayBuffer[AnyRef](siteId.asAnyRef)
    val queryBuilder = new StringBuilder(127, "select * from posts3 where SITE_ID = ? and (")
    var first = true
    for (postId <- postIds) {
      if (first) first = false
      else queryBuilder.append(" or ")
      queryBuilder.append("unique_post_id = ?")
      values.append(postId.asAnyRef)
    }
    queryBuilder.append(")")
    var results = ArrayBuffer[Post]()
    runQuery(queryBuilder.toString, values.toList, rs => {
      while (rs.next()) {
        val post = readPost(rs)
        results += post
      }
    })
    results.to[immutable.Seq]
  }


  def loadPosts(pagePostNrs: Iterable[PagePostNr]): immutable.Seq[Post] = {
    if (pagePostNrs.isEmpty)
      return Nil

    val values = ArrayBuffer[AnyRef](siteId.asAnyRef)
    val queryBuilder = new StringBuilder(256, "select * from posts3 where SITE_ID = ? and (")
    var nr = 0
    for (pagePostNr: PagePostNr <- pagePostNrs.toSet) {
      if (nr >= 1) queryBuilder.append(" or ")
      nr += 1
      queryBuilder.append("(page_id = ? and post_nr = ?)")
      values.append(pagePostNr.pageId, pagePostNr.postNr.asAnyRef)
    }
    queryBuilder.append(")")

    runQueryFindMany(queryBuilder.toString, values.toList, rs => {
      readPost(rs)
    })
  }


  def loadPostsByUniqueId(postIds: Iterable[PostId]): immutable.Map[PostId, Post] = {
    loadPostsBySomeId("unique_post_id", postIds, _.id)
  }


  def loadPostsByExtImpIdAsMap(extImpIds: Iterable[ExtImpId]): immutable.Map[ExtImpId, Post] = {
    loadPostsBySomeId("ext_id", extImpIds, _.extImpId.getOrDie("TyE2GKGCU7L"))
  }


  private def loadPostsBySomeId[T](fieldName: String, someIds: Iterable[T], getId: Post => T)
        : immutable.Map[T, Post] = {
    if (someIds.isEmpty)
      return Map.empty

    val query = i"""
      select * from posts3 where site_id = ? and $fieldName in (${makeInListFor(someIds)})
      """
    val values = siteId.asAnyRef :: someIds.map(_.asAnyRef).toList
    runQueryBuildMap(query, values, rs => {
      val post = readPost(rs)
      getId(post) -> post
    })
  }


  def loadAllPosts(): immutable.Seq[Post] = {
    val query = i"""
      select * from posts3 where site_id = ?
      """
    runQueryFindMany(query, List(siteId.asAnyRef), rs => readPost(rs, pageId = None))
  }


  def loadAllUnapprovedPosts(pageId: PageId, limit: Int): immutable.Seq[Post] = {
    loadUnapprovedPostsImpl(pageId, None, limit)
  }


  def loadUnapprovedPosts(pageId: PageId, by: UserId, limit: Int): immutable.Seq[Post] = {
    loadUnapprovedPostsImpl(pageId, Some(by), limit)
  }


  private def loadUnapprovedPostsImpl(pageId: PageId, by: Option[UserId], limit: Int)
        : immutable.Seq[Post] = {
    var query = s"""
      select * from posts3
      where site_id = ?
        and page_id = ?
        and (type is null or type <> ${PostType.CompletedForm.toInt})
      """

    var values = ArrayBuffer[AnyRef](siteId.asAnyRef, pageId.asAnyRef)

    if (by.isDefined) {
      query += " and created_by_id = ? "
      values += by.get.asAnyRef
    }

    query += s" order by created_at desc limit $limit"

    runQueryFindMany(query, values.toList, rs => {
      readPost(rs, pageId = Some(pageId))
    })
  }


  def loadCompletedForms(pageId: PageId, limit: Int): immutable.Seq[Post] = {
    val query = s"""
      select * from posts3
      where site_id = ?
        and page_id = ?
        and type = ${PostType.CompletedForm.toInt}
      order by created_at desc
      limit $limit
      """
    runQueryFindMany(query, List(siteId.asAnyRef, pageId.asAnyRef), rs => {
      readPost(rs, pageId = Some(pageId))
    })
  }


  /*
  def loadPosts(authorId: UserId, includeTitles: Boolean, includeChatMessages: Boolean,
        limit: Int, orderBy: OrderBy, onPageId: Option[PageId], onlyUnapproved: Boolean)
        : immutable.Seq[Post] = {

    val values = ArrayBuffer(siteId, authorId.asAnyRef)

    val andSkipTitles = includeTitles ? "" | s"and post_nr <> $TitleNr"
    val andSkipChat = includeChatMessages ?
      "" | s"and (type is null or type <> ${PostType.ChatMessage.toInt})"
    val andOnlyUnapproved = onlyUnapproved ? "curr_rev_nr > approved_rev_nr" | ""

    val andOnCertainPage = onPageId map { pageId =>
      values.append(pageId)
      s"and page_id = ?"
    } getOrElse ""

    val query = i"""
      select * from posts3 where site_id = ? and created_by_id = ? $andSkipTitles
          $andSkipChat $andOnCertainPage $andOnlyUnapproved
      order by created_at ${descOrAsc(orderBy)} limit ?
      """
    runQueryFindMany(query, List(siteId, authorId.asAnyRef, limit.asAnyRef), rs => {
      readPost(rs)
    })
  } */


  def loadPostsSkipTitles(limit: Int, orderBy: OrderBy, byUserId: Option[UserId])
        : immutable.Seq[Post] = {
    dieIf(orderBy != OrderBy.MostRecentFirst, "EdE1DRJ7Y", "Unimpl")

    val values = ArrayBuffer[AnyRef](siteId.asAnyRef)

    val andAuthorEq = byUserId match {
      case None => ""
      case Some(authorId) =>
        values.append(authorId.asAnyRef)
        "and created_by_id = ?"
    }

    val query = s"""
      select * from posts3 where site_id = ? $andAuthorEq and post_nr <> $TitleNr
      order by created_at desc limit $limit
      """
    runQueryFindMany(query, values.toList, rs => {
      readPost(rs)
    })
  }


  def loadPopularPostsByPage(pageIds: Iterable[PageId], limitPerPage: Int)
        : Map[PageId, immutable.Seq[Post]] = {
    if (pageIds.isEmpty)
      return Map.empty

    // Finds the `limitPerPage` most like-voted replies on each page.
    val query = s"""
      select * from (
        select
          row_number() over (partition by page_id order by num_like_votes desc) as rownum,
          p.*
        from posts3 p
        where p.site_id = ?
          and p.page_id in (${makeInListFor(pageIds)})
          and p.post_nr >= ${PageParts.FirstReplyNr}
          and length(p.approved_html_sanitized) > 20
          and p.collapsed_status = 0
          and p.closed_status = 0
          and p.hidden_at is null
          and p.deleted_status = 0
          and p.num_pending_flags = 0
          and p.num_unwanted_votes <= p.num_like_votes / 20
        ) by_page
      where by_page.rownum <= $limitPerPage
      """
    val values = siteId.asAnyRef :: pageIds.toList

    runQueryBuildMultiMap(query, values, rs => {
      val post = readPost(rs)
      (post.pageId, post)
    })
  }



  def loadApprovedOrigPostAndRepliesByPage(pageIds: Iterable[PageId]): Map[PageId, immutable.Seq[Post]] = {
    if (pageIds.isEmpty)
      return Map.empty

    val query = s"""
      select * from posts3 p
        where p.site_id = ?
          and p.page_id in (${makeInListFor(pageIds)})
          and p.post_nr <> ${PageParts.TitleNr}
          and p.approved_at is not null
          and (p.type is null or p.type not in (
            ${PostType.BottomComment.toInt},  -- [2GYKFS4]
            ${PostType.MetaMessage.toInt},
            ${PostType.ChatMessage.toInt}))
          and p.closed_status = 0
          and p.hidden_at is null
          and p.deleted_status = 0
          and p.parent_nr = ${PageParts.BodyNr}
      """
    val values = siteId.asAnyRef :: pageIds.toList

    runQueryBuildMultiMap(query, values, rs => {
      val post = readPost(rs)
      (post.pageId, post)
    })
  }



  def loadPostsToReview(): immutable.Seq[Post] = {
    val flaggedPosts = loadPostsToReviewImpl("""
      deleted_status = 0 and
      num_pending_flags > 0
      """)
    val unapprovedPosts = loadPostsToReviewImpl("""
      deleted_status = 0 and
      num_pending_flags = 0 and
      (approved_rev_nr is null or approved_rev_nr < curr_rev_nr)
      """)
    val postsWithSuggestions = loadPostsToReviewImpl("""
      deleted_status = 0 and
      num_pending_flags = 0 and
      approved_rev_nr = curr_rev_nr and
      num_edit_suggestions > 0
      """)
    (flaggedPosts ++ unapprovedPosts ++ postsWithSuggestions).to[immutable.Seq]
  }


  private def loadPostsToReviewImpl(whereTests: String): ArrayBuffer[Post] = {
    val query = s"select * from posts3 where site_id = ? and $whereTests"
    val values = List(siteId.asAnyRef)
    var results = ArrayBuffer[Post]()
    runQuery(query, values, rs => {
      while (rs.next()) {
        val post = readPost(rs)
        results += post
      }
    })
    results
  }


  override def nextPostId(): PostId = {
    val query = """
      select max(unique_post_id) max_id from posts3 where site_id = ?
      """
    runQuery(query, List(siteId.asAnyRef), rs => {
      rs.next()
      val maxId = rs.getInt("max_id") // null becomes 0, fine
      maxId + 1
    })
  }


  override def insertPost(post: Post) {
    val statement = """
      insert into posts3(
        site_id,
        unique_post_id,
        ext_id,
        page_id,
        post_nr,
        parent_nr,
        multireply,
        type,

        created_at,
        created_by_id,

        curr_rev_started_at,
        curr_rev_by_id,
        curr_rev_last_edited_at,
        curr_rev_source_patch,
        curr_rev_nr,

        last_approved_edit_at,
        last_approved_edit_by_id,
        num_distinct_editors,

        safe_rev_nr,
        approved_source,
        approved_html_sanitized,
        approved_at,
        approved_by_id,
        approved_rev_nr,

        collapsed_status,
        collapsed_at,
        collapsed_by_id,

        closed_status,
        closed_at,
        closed_by_id,

        hidden_at,
        hidden_by_id,
        hidden_reason,

        deleted_status,
        deleted_at,
        deleted_by_id,

        pinned_position,
        branch_sideways,

        num_pending_flags,
        num_handled_flags,
        num_edit_suggestions,

        num_like_votes,
        num_wrong_votes,
        num_bury_votes,
        num_unwanted_votes,
        num_times_read)

      values (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?)"""

    val values = List[AnyRef](
      siteId.asAnyRef, post.id.asAnyRef, post.extImpId.orNullVarchar, post.pageId, post.nr.asAnyRef,
      post.parentNr.orNullInt, toDbMultireply(post.multireplyPostNrs),
      (post.tyype != PostType.Normal) ? post.tyype.toInt.asAnyRef | NullInt,

      d2ts(post.createdAt),
      post.createdById.asAnyRef,

      post.currentRevStaredAt,
      post.currentRevisionById.asAnyRef,
      post.currentRevLastEditedAt.orNullTimestamp,
      post.currentRevSourcePatch.orNullVarchar,
      post.currentRevisionNr.asAnyRef,

      o2ts(post.lastApprovedEditAt),
      post.lastApprovedEditById.orNullInt,
      post.numDistinctEditors.asAnyRef,

      post.safeRevisionNr.orNullInt,
      post.approvedSource.orNullVarchar,
      post.approvedHtmlSanitized.orNullVarchar,
      o2ts(post.approvedAt),
      post.approvedById.orNullInt,
      post.approvedRevisionNr.orNullInt,

      post.collapsedStatus.underlying.asAnyRef,
      o2ts(post.collapsedAt),
      post.collapsedById.orNullInt,

      post.closedStatus.underlying.asAnyRef,
      o2ts(post.closedAt),
      post.closedById.orNullInt,

      o2ts(post.bodyHiddenAt),
      post.bodyHiddenById.orNullInt,
      post.bodyHiddenReason.orNullVarchar,

      post.deletedStatus.underlying.asAnyRef,
      o2ts(post.deletedAt),
      post.deletedById.orNullInt,

      post.pinnedPosition.orNullInt,
      post.branchSideways.orNullInt,

      post.numPendingFlags.asAnyRef,
      post.numHandledFlags.asAnyRef,
      post.numPendingEditSuggestions.asAnyRef,

      post.numLikeVotes.asAnyRef,
      post.numWrongVotes.asAnyRef,
      post.numBuryVotes.asAnyRef,
      post.numUnwantedVotes.asAnyRef,
      post.numTimesRead.asAnyRef)

    runUpdate(statement, values)
  }


  def updatePost(post: Post) {
    val statement = """
      update posts3 set
        page_id = ?,
        post_nr = ?,
        parent_nr = ?,
        multireply = ?,
        type = ?,

        curr_rev_started_at = ?,
        curr_rev_by_id = ?,
        curr_rev_last_edited_at = ?,
        curr_rev_source_patch = ?,
        curr_rev_nr = ?,
        prev_rev_nr = ?,

        last_approved_edit_at = ?,
        last_approved_edit_by_id = ?,
        num_distinct_editors = ?,

        safe_rev_nr = ?,
        approved_source = ?,
        approved_html_sanitized = ?,
        approved_at = ?,
        approved_by_id = ?,
        approved_rev_nr = ?,

        collapsed_status = ?,
        collapsed_at = ?,
        collapsed_by_id = ?,

        closed_status = ?,
        closed_at = ?,
        closed_by_id = ?,

        hidden_at = ?,
        hidden_by_id = ?,
        hidden_reason = ?,

        deleted_status = ?,
        deleted_at = ?,
        deleted_by_id = ?,

        pinned_position = ?,
        branch_sideways = ?,

        num_pending_flags = ?,
        num_handled_flags = ?,
        num_edit_suggestions = ?,

        num_like_votes = ?,
        num_wrong_votes = ?,
        num_bury_votes = ?,
        num_unwanted_votes = ?,
        num_times_read = ?

      where site_id = ? and unique_post_id = ?"""

    val values = List[AnyRef](
      post.pageId,
      post.nr.asAnyRef,
      post.parentNr.orNullInt,
      toDbMultireply(post.multireplyPostNrs),
      (post.tyype != PostType.Normal) ? post.tyype.toInt.asAnyRef | NullInt,

      post.currentRevStaredAt,
      post.currentRevisionById.asAnyRef,
      post.currentRevLastEditedAt.orNullTimestamp,
      post.currentRevSourcePatch.orNullVarchar,
      post.currentRevisionNr.asAnyRef,
      post.previousRevisionNr.orNullInt,

      post.lastApprovedEditAt.orNullTimestamp,
      post.lastApprovedEditById.orNullInt,
      post.numDistinctEditors.asAnyRef,

      post.safeRevisionNr.orNullInt,
      post.approvedSource.orNullVarchar,
      post.approvedHtmlSanitized.orNullVarchar,
      o2ts(post.approvedAt),
      post.approvedById.orNullInt,
      post.approvedRevisionNr.orNullInt,

      post.collapsedStatus.underlying.asAnyRef,
      o2ts(post.collapsedAt),
      post.collapsedById.orNullInt,

      post.closedStatus.underlying.asAnyRef,
      o2ts(post.closedAt),
      post.closedById.orNullInt,

      o2ts(post.bodyHiddenAt),
      post.bodyHiddenById.orNullInt,
      post.bodyHiddenReason.orNullVarchar,

      post.deletedStatus.underlying.asAnyRef,
      o2ts(post.deletedAt),
      post.deletedById.orNullInt,

      post.pinnedPosition.orNullInt,
      post.branchSideways.orNullInt,

      post.numPendingFlags.asAnyRef,
      post.numHandledFlags.asAnyRef,
      post.numPendingEditSuggestions.asAnyRef,

      post.numLikeVotes.asAnyRef,
      post.numWrongVotes.asAnyRef,
      post.numBuryVotes.asAnyRef,
      post.numUnwantedVotes.asAnyRef,
      post.numTimesRead.asAnyRef,

      siteId.asAnyRef, post.id.asAnyRef)

    runUpdate(statement, values)
  }


  private def readPost(rs: js.ResultSet, pageId: Option[PageId] = None): Post = {
    Post(
      id = rs.getInt("UNIQUE_POST_ID"),
      extImpId = getOptString(rs, "ext_id"),
      pageId = pageId.getOrElse(rs.getString("PAGE_ID")),
      nr = rs.getInt("post_nr"),
      parentNr = getOptionalInt(rs, "parent_nr"),
      multireplyPostNrs = fromDbMultireply(rs.getString("MULTIREPLY")),
      tyype = PostType.fromInt(rs.getInt("TYPE")).getOrElse(PostType.Normal),
      createdAt = getDate(rs, "CREATED_AT"),
      createdById = rs.getInt("CREATED_BY_ID"),
      currentRevStaredAt = getDate(rs, "curr_rev_started_at"),
      currentRevisionById = rs.getInt("curr_rev_by_id"),
      currentRevLastEditedAt = getOptionalDate(rs, "curr_rev_last_edited_at"),
      currentRevSourcePatch = Option(rs.getString("curr_rev_source_patch")),
      currentRevisionNr = rs.getInt("curr_rev_nr"),
      previousRevisionNr = getOptInt(rs, "prev_rev_nr"),
      lastApprovedEditAt = getOptionalDate(rs, "LAST_APPROVED_EDIT_AT"),
      lastApprovedEditById = getOptInt(rs, "LAST_APPROVED_EDIT_BY_ID"),
      numDistinctEditors = rs.getInt("NUM_DISTINCT_EDITORS"),
      safeRevisionNr = getOptInt(rs, "safe_rev_nr"),
      approvedSource = Option(rs.getString("APPROVED_SOURCE")),
      approvedHtmlSanitized = Option(rs.getString("APPROVED_HTML_SANITIZED")),
      approvedAt = getOptionalDate(rs, "APPROVED_AT"),
      approvedById = getOptInt(rs, "APPROVED_BY_ID"),
      approvedRevisionNr = getOptInt(rs, "approved_rev_nr"),
      collapsedStatus = new CollapsedStatus(rs.getInt("COLLAPSED_STATUS")),
      collapsedAt = getOptionalDate(rs, "COLLAPSED_AT"),
      collapsedById = getOptInt(rs, "COLLAPSED_BY_ID"),
      closedStatus = new ClosedStatus(rs.getInt("CLOSED_STATUS")),
      closedAt = getOptionalDate(rs, "CLOSED_AT"),
      closedById = getOptInt(rs, "CLOSED_BY_ID"),
      bodyHiddenAt = getOptionalDate(rs, "HIDDEN_AT"),
      bodyHiddenById = getOptInt(rs, "HIDDEN_BY_ID"),
      bodyHiddenReason = getOptionalStringNotEmpty(rs, "hidden_reason"),
      deletedStatus = new DeletedStatus(rs.getInt("DELETED_STATUS")),
      deletedAt = getOptionalDate(rs, "DELETED_AT"),
      deletedById = getOptionalInt(rs, "DELETED_BY_ID"),
      pinnedPosition = getOptionalInt(rs, "PINNED_POSITION"),
      branchSideways = getOptionalByte(rs, "branch_sideways"),
      numPendingFlags = rs.getInt("NUM_PENDING_FLAGS"),
      numHandledFlags = rs.getInt("NUM_HANDLED_FLAGS"),
      numPendingEditSuggestions = rs.getInt("NUM_EDIT_SUGGESTIONS"),
      numLikeVotes = rs.getInt("NUM_LIKE_VOTES"),
      numWrongVotes = rs.getInt("NUM_WRONG_VOTES"),
      numBuryVotes = rs.getInt("NUM_BURY_VOTES"),
      numUnwantedVotes = rs.getInt("NUM_UNWANTED_VOTES"),
      numTimesRead = rs.getInt("NUM_TIMES_READ"))
  }


  def deleteVote(pageId: PageId, postNr: PostNr, voteType: PostVoteType, voterId: UserId)
        : Boolean = {
    val statement = """
      delete from post_actions3
      where site_id = ? and page_id = ? and post_nr = ? and type = ? and created_by_id = ?
      """
    val values = List[AnyRef](siteId.asAnyRef, pageId, postNr.asAnyRef, toActionTypeInt(voteType),
      voterId.asAnyRef)
    val numDeleted = runUpdate(statement, values)
    dieIf(numDeleted > 1, "DwE4YP24", s"Too many actions deleted: numDeleted = $numDeleted")
    numDeleted == 1
  }


  def insertVote(uniquePostId: PostId, pageId: PageId, postNr: PostNr, voteType: PostVoteType, voterId: UserId) {
    insertPostAction(uniquePostId, pageId, postNr, actionType = voteType, doerId = voterId)
  }


  def loadVoterIds(postId: PostId, voteType: PostVoteType): Seq[UserId] = {
    TESTS_MISSING
    val query = """
      select created_by_id
      from post_actions3
      where site_id = ? and unique_post_id = ? and type = ?
      """
    val values = List[AnyRef](siteId.asAnyRef, postId.asAnyRef, voteType.toInt.asAnyRef)
    runQueryFindMany(query, values, rs => {
      rs.getInt("created_by_id")
    })
  }


  def loadActionsOnPage(pageId: PageId): immutable.Seq[PostAction] = {
    loadActionsOnPageImpl(pageId, userId = None)
  }


  def loadActionsByUserOnPage(userId: UserId, pageId: PageId): immutable.Seq[PostAction] = {
    loadActionsOnPageImpl(pageId, userId = Some(userId))
  }


  private def loadActionsOnPageImpl(pageId: PageId, userId: Option[UserId])
        : immutable.Seq[PostAction] = {
    val values = ArrayBuffer[AnyRef](siteId.asAnyRef, pageId)
    val andCreatedBy = userId match {
      case None => ""
      case Some(id) =>
        values.append(id.asAnyRef)
        "and created_by_id = ?"
    }
    val query = s"""
      select unique_post_id, post_nr, type, created_at, created_by_id
      from post_actions3
      where site_id = ? and page_id = ? $andCreatedBy
      """
    runQueryFindMany(query, values.toList, rs => {
      val theUserId = rs.getInt("created_by_id")
      PostAction(
        uniqueId = rs.getInt("unique_post_id"),
        pageId = pageId,
        postNr = rs.getInt("post_nr"),
        doneAt = getWhen(rs, "created_at"),
        doerId = theUserId,
        actionType = fromActionTypeInt(rs.getInt("type")))
    })
  }


  def loadActionsDoneToPost(pageId: PageId, postNr: PostNr): immutable.Seq[PostAction] = {
    val query = """
      select unique_post_id, type, created_at, created_by_id
      from post_actions3
      where site_id = ? and page_id = ? and post_nr = ?
      """
    val values = List[AnyRef](siteId.asAnyRef, pageId, postNr.asAnyRef)
    runQueryFindMany(query, values, rs => {
      PostAction(
        uniqueId = rs.getInt("unique_post_id"),
        pageId = pageId,
        postNr = postNr,
        doneAt = getWhen(rs, "created_at"),
        doerId = rs.getInt("created_by_id"),
        actionType = fromActionTypeInt(rs.getInt("type")))
    })
  }


  def loadFlagsFor(pagePostNrs: Iterable[PagePostNr]): immutable.Seq[PostFlag] = {
    if (pagePostNrs.isEmpty)
      return Nil

    val queryBuilder = new StringBuilder(256, s"""
      select unique_post_id, page_id, post_nr, type, created_at, created_by_id
      from post_actions3
      where site_id = ?
        and type in ($FlagValueSpam, $FlagValueInapt, $FlagValueOther)
        and (
      """)
    val values = ArrayBuffer[AnyRef](siteId.asAnyRef)
    var first = true
    pagePostNrs foreach { pagePostNr =>
      if (!first) {
        queryBuilder.append(" or ")
      }
      first = false
      queryBuilder.append("(page_id = ? and post_nr = ?)")
      values.append(pagePostNr.pageId, pagePostNr.postNr.asAnyRef)
    }
    val query = queryBuilder.append(")").toString
    runQueryFindMany(query, values.toList, rs => {
      val postAction = PostFlag(
        uniqueId = rs.getInt("unique_post_id"),
        pageId = rs.getString("page_id"),
        postNr = rs.getInt("post_nr"),
        doneAt = getWhen(rs, "created_at"),
        flaggerId = rs.getInt("created_by_id"),
        flagType = fromActionTypeIntToFlagType(rs.getInt("type")))
      dieIf(!postAction.actionType.isInstanceOf[PostFlagType], "DwE2dpg4")
      postAction
    })
  }


  def insertFlag(uniquePostId: PostId, pageId: PageId, postNr: PostNr, flagType: PostFlagType, flaggerId: UserId) {
    insertPostAction(uniquePostId, pageId, postNr, actionType = flagType, doerId = flaggerId)
  }


  def clearFlags(pageId: PageId, postNr: PostNr, clearedById: UserId) {
    val statement = s"""
      update post_actions3
      set deleted_at = now_utc(), deleted_by_id = ?, updated_at = now_utc()
      where site_id = ? and page_id = ? and post_nr = ? and deleted_at is null
      """
    val values = List(clearedById.asAnyRef, siteId.asAnyRef, pageId, postNr.asAnyRef)
    runUpdate(statement, values)
  }


  def insertPostAction(uniquePostId: PostId, pageId: PageId, postNr: PostNr, actionType: PostActionType, doerId: UserId) {
    val statement = """
      insert into post_actions3(site_id, unique_post_id, page_id, post_nr, type, created_by_id,
          created_at, sub_id)
      values (?, ?, ?, ?, ?, ?, now_utc(), 1)
      """
    val values = List[AnyRef](siteId.asAnyRef, uniquePostId.asAnyRef, pageId, postNr.asAnyRef,
      toActionTypeInt(actionType), doerId.asAnyRef)
    val numInserted =
      try { runUpdate(statement, values) }
      catch {
        case ex: js.SQLException if isUniqueConstrViolation(ex) =>
          throw DbDao.DuplicateVoteException
      }
    dieIf(numInserted != 1, "DwE9FKw2", s"Error inserting action: numInserted = $numInserted")
  }


  def loadLastPostRevision(postId: PostId): Option[PostRevision] =
    loadPostRevisionImpl(postId, PostRevision.LastRevisionMagicNr)


  def loadPostRevision(postId: PostId, revisionNr: Int): Option[PostRevision] =
    loadPostRevisionImpl(postId, revisionNr)


  private def loadPostRevisionImpl(postId: PostId, revisionNr: Int): Option[PostRevision] = {
    var query = s"""
      select
        revision_nr, previous_nr, source_patch, full_source, title,
        composed_at, composed_by_id,
        approved_at, approved_by_id,
        hidden_at, hidden_by_id
      from post_revisions3
      where site_id = ? and post_id = ? and revision_nr = """
    var values = List(siteId.asAnyRef, postId.asAnyRef)

    if (revisionNr == PostRevision.LastRevisionMagicNr) {
      query += s"""(
        select max(revision_nr) from post_revisions3
        where site_id = ? and post_id = ?
        )"""
      values = values ::: List(siteId.asAnyRef, postId.asAnyRef)
    }
    else {
      query += "?"
      values = values ::: List(revisionNr.asAnyRef)
    }

    runQuery(query, values, rs => {
      if (!rs.next)
        return None

      Some(PostRevision(
        postId = postId,
        revisionNr = rs.getInt("revision_nr"),
        previousNr = getOptInt(rs, "previous_nr"),
        sourcePatch = Option(rs.getString("source_patch")),
        fullSource = Option(rs.getString("full_source")),
        title = Option(rs.getString("title")),
        composedAt = getDate(rs, "composed_at"),
        composedById = rs.getInt("composed_by_id"),
        approvedAt = getOptionalDate(rs, "approved_at"),
        approvedById = getOptInt(rs, "approved_by_id"),
        hiddenAt = getOptionalDate(rs, "hidden_at"),
        hiddenById = getOptInt(rs, "hidden_by_id")))
    })
  }


  def insertPostRevision(revision: PostRevision) {
    val statement = """
      insert into post_revisions3(
        site_id, post_id,
        revision_nr, previous_nr,
        source_patch, full_source, title,
        composed_at, composed_by_id,
        approved_at, approved_by_id,
        hidden_at, hidden_by_id)
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      """
    val values = List[AnyRef](
      siteId.asAnyRef, revision.postId.asAnyRef,
      revision.revisionNr.asAnyRef, revision.previousNr.orNullInt,
      revision.sourcePatch.orNullVarchar, revision.fullSource.orNullVarchar,
      revision.title.orNullVarchar,
      revision.composedAt, revision.composedById.asAnyRef,
      revision.approvedAt.orNullTimestamp, revision.approvedById.orNullInt,
      revision.hiddenAt.orNullTimestamp, revision.hiddenById.orNullInt)
    runUpdateExactlyOneRow(statement, values)
  }


  def updatePostRevision(revision: PostRevision) {
    UNTESTED
    val statement = """
      update post_revisions3 set
        source_patch = ?, full_source = ?, title = ?,
        composed_at = ?, combosed_by_id = ?,
        approved_at = ?, approved_by_id = ?,
        hidden_at = ?, hidden_by_id = ?
      where site_id = ? and post_id = ? and revision_nr = ?
      """
    val values = List[AnyRef](
      revision.sourcePatch.orNullVarchar, revision.fullSource.orNullVarchar,
      revision.title.orNullVarchar,
      revision.composedAt, revision.composedById.asAnyRef,
      revision.approvedAt.orNullTimestamp, revision.approvedById.orNullInt,
      revision.hiddenAt.orNullTimestamp, revision.hiddenById.orNullInt,
      siteId.asAnyRef, revision.postId.asAnyRef, revision.revisionNr.asAnyRef)
    runUpdateExactlyOneRow(statement, values)
  }

}


object PostsSiteDaoMixin {

  // dupl numbers [2PKWQUT0]
  private val VoteValueLike = 41
  private val VoteValueWrong = 42
  private val VoteValueBury = 43
  private val VoteValueUnwanted = 44
  private val FlagValueSpam = 51
  private val FlagValueInapt = 52
  private val FlagValueOther = 53


  def toActionTypeInt(actionType: PostActionType): AnyRef = (actionType match {
    case PostVoteType.Like => VoteValueLike
    case PostVoteType.Wrong => VoteValueWrong
    case PostVoteType.Bury => VoteValueBury
    case PostVoteType.Unwanted => VoteValueUnwanted
    case PostFlagType.Spam => FlagValueSpam
    case PostFlagType.Inapt => FlagValueInapt
    case PostFlagType.Other => FlagValueOther
  }).asAnyRef


  def fromActionTypeInt(value: Int): PostActionType = value match {
    case VoteValueLike => PostVoteType.Like
    case VoteValueWrong => PostVoteType.Wrong
    case VoteValueBury => PostVoteType.Bury
    case VoteValueUnwanted => PostVoteType.Unwanted
    case FlagValueSpam => PostFlagType.Spam
    case FlagValueInapt => PostFlagType.Inapt
    case FlagValueOther => PostFlagType.Other
  }

  def fromActionTypeIntToFlagType(value: Int): PostFlagType = {
    val tyype = fromActionTypeInt(value)
    require(tyype.isInstanceOf[PostFlagType], "DwE4GKP52")
    tyype.asInstanceOf[PostFlagType]
  }

}

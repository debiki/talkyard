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
    loadPostsOnPageImpl(pageId, postNr = Some(postNr)).headOption


  override def loadPostsOnPage(pageId: PageId): Vec[Post] =
    loadPostsOnPageImpl(pageId, postNr = None)

  private val select__posts_po__leftJoin__patPostRels_pa: St = s"""
        select po.*,
               array_agg(array[pa.rel_type_c, pa.from_pat_id_c])
                    filter (where pa.rel_type_c is not null)
                    pat_rels
        from posts3 po
        left outer join post_actions3 pa   -- pat_post_rels_t [AuthorOf]
            on  pa.site_id = po.site_id
            and pa.to_post_id_c = po.unique_post_id
            and pa.rel_type_c in (  ${
                PatRelType_later.VotedOn.toInt}, ${  // just for now, testing
                PatRelType_later.AuthorOf.toInt}, ${
                PatRelType_later.OwnerOf.toInt}, ${
                PatRelType_later.AssignedTo.toInt}) """

  // It's enough to specify the posts3 primary key.
  private val groupBy__siteId_postId: St = s"""
          group by po.site_id, po.unique_post_id """

  private val groupBy_orderBy__siteId_postId: St = s"""
          $groupBy__siteId_postId
          order by po.site_id, po.unique_post_id """

  private def loadPostsOnPageImpl(pageId: PageId, postNr: Opt[PostNr]): Vec[Post] = {
    // Similar to:  loadPostsByNrs(_: Iterable[PagePostNr])
    val values = ArrayBuffer[AnyRef](siteId.asAnyRef, pageId)
    val andPostNrEq = postNr map { id =>
      values.append(id.asAnyRef)
      "and po.post_nr = ?"
    } getOrElse ""

    val query = s"""
          $select__posts_po__leftJoin__patPostRels_pa
          where po.site_id = ? and
                po.page_id = ?
                $andPostNrEq
          $groupBy_orderBy__siteId_postId """

    runQueryFindMany(query, values.toList, rs => {
      readPost(rs, pageId = Some(pageId), inclAggs = true)
    })
  }


  override def loadOrigPostAndLatestPosts(pageId: PageId, limit: Int): Seq[Post] = {
    require(limit > 0, "EsE7GK4W0")
    // Use post_nr, not created_at, because 1) if a post is moved from another page to page pageId,
    // then its created_at might be long-ago, although its post_nr will become the highest
    // on this page once it's been added. Also 2) there's an index on pageid, post_nr.

    val query = s"""
        $select__posts_po__leftJoin__patPostRels_pa
        where po.site_id = ? and
              po.page_id = ? and
              po.post_nr in (${PageParts.TitleNr}, ${PageParts.BodyNr})
        $groupBy__siteId_postId
        union
        select * from (
            $select__posts_po__leftJoin__patPostRels_pa
            where po.site_id = ? and
                  po.page_id = ? and
                  po.post_nr not in (${PageParts.TitleNr}, ${PageParts.BodyNr})
            $groupBy__siteId_postId
            order by post_nr desc limit $limit
            ) required_subquery_alias  """

    runQueryFindMany(query, List(siteId.asAnyRef, pageId.asAnyRef, siteId.asAnyRef,
        pageId.asAnyRef), rs => {
      readPost(rs, pageId = Some(pageId))
    })
  }


  private def loadPostsById(postIds: Iterable[PostId]): immutable.Seq[Post] = {
    if (postIds.isEmpty)
      return Nil
    val values = ArrayBuffer[AnyRef](siteId.asAnyRef)
    val queryBuilder = new StringBuilder(1024, s"""
       $select__posts_po__leftJoin__patPostRels_pa  -- select * from posts3
       where po.site_id = ? and (""")  // + pat_post_rels_t [AuthorOf]
    var first = true
    for (postId <- postIds) {
      if (first) first = false
      else queryBuilder.append(" or ")
      queryBuilder.append("po.unique_post_id = ?")
      values.append(postId.asAnyRef)
    }
    queryBuilder.append(s""")
          $groupBy_orderBy__siteId_postId
          """)
    var results = ArrayBuffer[Post]()
    runQuery(queryBuilder.toString, values.toList, rs => {
      while (rs.next()) {
        val post = readPost(rs)
        results += post
      }
    })
    results.to[immutable.Seq]
  }


  def loadPostsByNrs(pagePostNrs: Iterable[PagePostNr]): immutable.Seq[Post] = {
    // Similar to: loadPostsOnPageImpl(pageId, postNr)
    if (pagePostNrs.isEmpty)
      return Nil

    val values = ArrayBuffer[AnyRef](siteId.asAnyRef)
    val queryBuilder = new StringBuilder(1024,
          s""" -- loadPostsByNrs
          $select__posts_po__leftJoin__patPostRels_pa   --  + pat_post_rels_t [AuthorOf]
          where po.site_id = ? and (""")
    var nr = 0
    for (pagePostNr: PagePostNr <- pagePostNrs.toSet) {
      if (nr >= 1) queryBuilder.append(" or ")
      nr += 1
      queryBuilder.append("(po.page_id = ? and po.post_nr = ?)")
      values.append(pagePostNr.pageId, pagePostNr.postNr.asAnyRef)
    }
    queryBuilder.append(s""")
          $groupBy__siteId_postId
          """)

    runQueryFindMany(queryBuilder.toString, values.toList, rs => {
      readPost(rs)
    })
  }


  def loadPostsByUniqueId(postIds: Iterable[PostId]): immutable.Map[PostId, Post] = {
    loadPostsBySomeId("unique_post_id", postIds, _.id)
  }


  def loadPostsByExtIdAsMap(extImpIds: Iterable[ExtId]): immutable.Map[ExtId, Post] = {
    loadPostsBySomeId("ext_id", extImpIds, _.extImpId.getOrDie("TyE2GKGCU7L"))
  }


  private def loadPostsBySomeId[T](fieldName: String, someIds: Iterable[T], getId: Post => T)
        : immutable.Map[T, Post] = {
    if (someIds.isEmpty)
      return Map.empty

    val query = i""" -- loadPostsBySomeId
      $select__posts_po__leftJoin__patPostRels_pa
      -- select * from posts3   -- + pat_post_rels_t [AuthorOf]
      where po.site_id = ? and po.$fieldName in (${makeInListFor(someIds)})
      $groupBy__siteId_postId
      """
    val values = siteId.asAnyRef :: someIds.map(_.asAnyRef).toList
    runQueryBuildMap(query, values, rs => {
      val post = readPost(rs)
      getId(post) -> post
    })
  }


  def loadAllPosts(): immutable.Seq[Post] = {
    val query = i""" -- loadAllPosts
      $select__posts_po__leftJoin__patPostRels_pa
      -- select * from posts3
      where po.site_id = ?   -- + pat_post_rels_t [AuthorOf]
      $groupBy__siteId_postId
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
    var query = s""" -- loadUnapprovedPostsImpl
      -- select * from posts3  -- + pat_post_rels_t [AuthorOf]
      $select__posts_po__leftJoin__patPostRels_pa
      where po.site_id = ?
        and po.page_id = ?
        and po.approved_at is null
        and (po.type is null or po.type <> ${PostType.CompletedForm.toInt})
      $groupBy__siteId_postId
      """

    var values = ArrayBuffer[AnyRef](siteId.asAnyRef, pageId.asAnyRef)

    if (by.isDefined) {
      query += " and po.created_by_id = ? "
      values += by.get.asAnyRef
    }

    query += s" order by po.created_at desc limit $limit"

    runQueryFindMany(query, values.toList, rs => {
      readPost(rs, pageId = Some(pageId))
    })
  }


  def loadCompletedForms(pageId: PageId, limit: Int): immutable.Seq[Post] = {
    val query = s"""
      -- select * from posts3  -- + pat_post_rels_t [AuthorOf]
      $select__posts_po__leftJoin__patPostRels_pa
      where po.site_id = ?
        and po.page_id = ?
        and po.type = ${PostType.CompletedForm.toInt}
      $groupBy__siteId_postId
      order by po.created_at desc
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
      "" | s"and (po.type is null or po.type <> ${PostType.ChatMessage.toInt})"
    val andOnlyUnapproved = onlyUnapproved ? "po.curr_rev_nr > approved_rev_nr" | ""

    val andOnCertainPage = onPageId map { pageId =>
      values.append(pageId)
      s"and po.page_id = ?"
    } getOrElse ""

    val query = i"""
      -- select * from posts3  -- + pat_post_rels_t [AuthorOf]
      $select__posts_po__leftJoin__patPostRels_pa
      where po.site_id = ? and po.created_by_id = ? $andSkipTitles
          $andSkipChat $andOnCertainPage $andOnlyUnapproved
      $groupBy__siteId_postId
      order by po.created_at ${descOrAsc(orderBy)} limit ?
      """
    runQueryFindMany(query, List(siteId, authorId.asAnyRef, limit.asAnyRef), rs => {
      readPost(rs)
    })
  } */


  def loadPostsByQuery(limit: Int, orderBy: OrderBy, byUserId: Option[UserId],
        includeTitlePosts: Boolean, includeUnapproved: Boolean,
        inclUnlistedPagePosts_unimpl: Boolean): immutable.Seq[Post] = {
    dieIf(orderBy != OrderBy.MostRecentFirst, "EdE1DRJ7Y", "Unimpl")

    val values = ArrayBuffer[AnyRef](siteId.asAnyRef)

    val andAuthorEq = byUserId match {
      case None => ""
      case Some(authorId) =>
        values.append(authorId.asAnyRef)
        "and po.created_by_id = ?"
    }

    val andNotTitle = includeTitlePosts ? "" | s"and po.post_nr <> $TitleNr"

    val andSomeVersionApproved = includeUnapproved ?
          "" | "and po.approved_at is not null"

    // This'll require a join w pages3 and categories3.
    val andPageNotUnlisted_unimpl = !inclUnlistedPagePosts_unimpl ? "" | ""

    val query = s"""
          -- select * from posts3  -- + pat_post_rels_t [AuthorOf]
          $select__posts_po__leftJoin__patPostRels_pa
          where po.site_id = ?
              $andAuthorEq -- !  + pat_post_rels_t [AuthorOf]  needs new sub query?
              $andNotTitle
              $andSomeVersionApproved
              $andPageNotUnlisted_unimpl
          $groupBy__siteId_postId
          order by po.created_at desc,
             -- Page title and body have the same creation time.
             -- Consider the title created before the page body.
             po.page_id desc, po.post_nr desc
          limit $limit """

    runQueryFindMany(query, values.toList, rs => {
      readPost(rs)
    })
  }


  def loadEmbeddedCommentsApprovedNotDeleted(limit: Int, orderBy: OrderBy): immutable.Seq[Post] = {
    dieIf(orderBy != OrderBy.MostRecentFirst, "TyE60RKTJF4", "Unimpl")
    val query = s"""
      -- select po.* from posts3 po   -- + pat_post_rels_t [AuthorOf]
      $select__posts_po__leftJoin__patPostRels_pa  -- OOOPS bad join order? Force
      inner join pages3 pg using (site_id, page_id)  -- this inner join first?
      where pg.site_id = ?
        and pg.page_role = ${PageType.EmbeddedComments.toInt}
        and po.post_nr <> $TitleNr
        and po.post_nr <> $BodyNr
        and (po.type is null or po.type = ${PostType.Normal.toInt})
        and po.deleted_at is null
        and po.hidden_at is null
        and po.approved_at is not null
      $groupBy__siteId_postId
      order by po.created_at desc limit $limit
      """
    runQueryFindMany(query, List(siteId.asAnyRef), rs => {
      readPost(rs)
    })
  }


  def loadPopularPostsByPage(pageIds: Iterable[PageId], limitPerPage: Int, exclOrigPost: Boolean)
        : Map[PageId, immutable.Seq[Post]] = {
    if (pageIds.isEmpty)
      return Map.empty

    // Finds the `limitPerPage` most like-voted replies on each page.
    val query = s""" -- loadPopularPostsByPage
      select * from (
        -- select__posts_po__leftJoin__patPostRels_pa
        select
          row_number() over (partition by page_id order by num_like_votes desc) as rownum,
          p.*
        from posts3 p  --  + pat_post_rels_t [AuthorOf] todo ?
        where p.site_id = ?
          and p.page_id in (${makeInListFor(pageIds)})
          and p.post_nr >= ${exclOrigPost ? PageParts.FirstReplyNr | PageParts.BodyNr}
          and length(p.approved_html_sanitized) > 20
          and p.collapsed_status = 0
          and p.closed_status = 0
          and p.hidden_at is null
          and p.deleted_status = 0
          and p.num_pending_flags = 0
          and p.num_unwanted_votes = 0
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
      -- select * from posts3 p   -- + pat_post_rels_t [AuthorOf]
      $select__posts_po__leftJoin__patPostRels_pa
        where po.site_id = ?
          and po.page_id in (${makeInListFor(pageIds)})
          and po.post_nr <> ${PageParts.TitleNr}
          and po.approved_at is not null
          and (po.type is null or po.type not in (
            ${PostType.BottomComment.toInt},  -- [2GYKFS4]
            ${PostType.MetaMessage.toInt},
            ${PostType.ChatMessage.toInt}))
          and po.closed_status = 0
          and po.hidden_at is null
          and po.deleted_status = 0
          and po.parent_nr = ${PageParts.BodyNr}
      $groupBy__siteId_postId
      """
    val values = siteId.asAnyRef :: pageIds.toList

    runQueryBuildMultiMap(query, values, rs => {
      val post = readPost(rs)
      (post.pageId, post)
    })
  }



  def loadPostsToReview(): immutable.Seq[Post] = {
    val flaggedPosts = loadPostsToReviewImpl("""
      po.deleted_status = 0 and
      po.num_pending_flags > 0
      """)
    val unapprovedPosts = loadPostsToReviewImpl("""
      po.deleted_status = 0 and
      po.num_pending_flags = 0 and
      (po.approved_rev_nr is null or po.approved_rev_nr < po.curr_rev_nr)
      """)
    val postsWithSuggestions = loadPostsToReviewImpl("""
      po.deleted_status = 0 and
      po.num_pending_flags = 0 and
      po.approved_rev_nr = curr_rev_nr and
      po.num_edit_suggestions > 0
      """)
    (flaggedPosts ++ unapprovedPosts ++ postsWithSuggestions).to[immutable.Seq]
  }


  private def loadPostsToReviewImpl(whereTests: String): ArrayBuffer[Post] = {
    val query = s"""
          -- select * from posts3  //  + pat_post_rels_t [AuthorOf]
          $select__posts_po__leftJoin__patPostRels_pa
          where po.site_id = ? and $whereTests
          $groupBy__siteId_postId
          """
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
        created_by_true_id,
        old_false_id,

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
        num_times_read,

        smtp_msg_id_prefix_c
        )
      values (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?)"""

    val values = List[AnyRef](
      siteId.asAnyRef, post.id.asAnyRef, post.extImpId.orNullVarchar, post.pageId, post.nr.asAnyRef,
      post.parentNr.orNullInt, toDbMultireply(post.multireplyPostNrs),
      (post.tyype != PostType.Normal) ? post.tyype.toInt.asAnyRef | NullInt,

      d2ts(post.createdAt),
      post.createdByTrueId.curId.asAnyRef,
      post.createdByTrueId.anyTrueId.orNullInt,
      post.createdByTrueId.oldFalseId.orNullInt,

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
      post.numTimesRead.asAnyRef,

      post.smtpMsgIdPrefix.orNullVarchar,
      )

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
        num_times_read = ?,

        smtp_msg_id_prefix_c = ?

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

      post.smtpMsgIdPrefix.orNullVarchar,

      siteId.asAnyRef, post.id.asAnyRef)

    runUpdate(statement, values)
  }


  private def readPost(rs: js.ResultSet, pageId: Option[PageId] = None,
          inclAggs: Bo = false): Post = {

    val anyVecOfPatRelVecs: Opt[Vec[Vec[Int]]] =
          if (!inclAggs) None
          else getOptArrayOfArrayOfInt32(rs, "pat_rels")

    val (ownerIds: Vec[Int], authorIds: Vec[Int], assignedToIds: Vec[Int]) =
            anyVecOfPatRelVecs match {
      case None =>
         (Vec.empty, Vec.empty, Vec.empty)
      case Some(vecOfPatRelVecs: Vec[Vec[Int]]) =>
        val ownerIds = MutArrBuf[Int]()  // why won't PatId work, it's just type = i32 = Int
        val authorIds = MutArrBuf[Int]()
        val assignedToIds = MutArrBuf[Int]()
        for (patRelVec: Vec[Int] <- vecOfPatRelVecs) {
          dieIf(patRelVec.size != 2, "TyE50MTEAKR2", s"Pat rel vec len: ${patRelVec.size}")
          val relTypeInt = patRelVec(0)
          val patId = patRelVec(1)
          // Or, hmm, move to object PatRelType_later?
          relTypeInt match {
            case PatRelType_later.OwnerOf.IntVal =>
              ownerIds.append(patId)
            case PatRelType_later.AuthorOf.IntVal |
                      /* just testing: */ PatRelType_later.VotedOn.IntVal =>
              authorIds.append(patId)
            case PatRelType_later.AssignedTo.IntVal =>
              assignedToIds.append(patId)
            case x =>
              die("TyE7MWJC21", s"Unexpected rel_type_c: $x")
          }
        }
        (ownerIds.to[Vec], authorIds.to[Vec], assignedToIds.to[Vec])
    }

    Post(
      id = rs.getInt("UNIQUE_POST_ID"),
      extImpId = getOptString(rs, "ext_id"),
      pageId = pageId.getOrElse(rs.getString("PAGE_ID")),
      nr = rs.getInt("post_nr"),
      parentNr = getOptionalInt(rs, "parent_nr"),
      multireplyPostNrs = fromDbMultireply(rs.getString("MULTIREPLY")),
      tyype = PostType.fromInt(rs.getInt("TYPE")).getOrElse(PostType.Normal),
      createdAt = getDate(rs, "CREATED_AT"),
      createdByTrueId = TrueFalseId(
            rs.getInt("CREATED_BY_ID"),
            anyTrueId = getOptInt32(rs, "created_by_true_id_c"),
            oldFalseId = getOptInt32(rs, "created_by_old_false_id_c")),
      ownerIds = ownerIds,
      authorIds = authorIds,
      assignedToIds = assignedToIds,
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
      numTimesRead = rs.getInt("NUM_TIMES_READ"),
      smtpMsgIdPrefix = getOptString(rs, "smtp_msg_id_prefix_c"),
      )
  }


  def loadAuthorIdsByPostId(postIds: Set[PostId]): Map[PostId, UserId] = {
    // Tested here: TyT5086XJW2 (the e2e test api-search-full-text.test.ts)
    if (postIds.isEmpty)
      return Map.empty

    val query = s"""
      select unique_post_id, created_by_id
      from posts3    -- + pat_post_rels_t [AuthorOf]  todo
      -- select__posts_po__leftJoin__patPostRels_pa
      where site_id = ?
        and unique_post_id in(${makeInListFor(postIds)}) """

    val values = ArrayBuffer(siteId)
    values.append(postIds.toSeq: _*)

    runQueryBuildMap(query, values.toList.map(_.asAnyRef), rs => {
      val postId = rs.getInt("unique_post_id")
      val authorId = rs.getInt("created_by_id")
      postId -> authorId
    })
  }


  def deleteVote(pageId: PageId, postNr: PostNr, voteType: PostVoteType, voterId: UserId)
        : Boolean = {
    val statement = """
      delete from post_actions3
      where site_id = ? and page_id = ? and post_nr = ? and rel_type_c = ? and from_pat_id_c = ?
      """
    val values = List[AnyRef](siteId.asAnyRef, pageId, postNr.asAnyRef, toActionTypeInt(voteType),
      voterId.asAnyRef)
    val numDeleted = runUpdate(statement, values)
    dieIf(numDeleted > 1, "DwE4YP24", s"Too many actions deleted: numDeleted = $numDeleted")
    numDeleted == 1
  }


  def loadVoterIds(postId: PostId, voteType: PostVoteType): Seq[UserId] = {
    TESTS_MISSING
    val query = """
      select from_pat_id_c
      from post_actions3
      where site_id = ? and to_post_id_c = ? and rel_type_c = ?
      """
    val values = List[AnyRef](siteId.asAnyRef, postId.asAnyRef, voteType.toInt.asAnyRef)
    runQueryFindMany(query, values, rs => {
      rs.getInt("from_pat_id_c")
    })
  }


  def loadActionsOnPage(pageId: PageId): immutable.Seq[PostAction] = {
    loadActionsOnPageImpl(Some(pageId), userId = None)
  }


  def loadActionsByUserOnPage(userId: UserId, pageId: PageId): immutable.Seq[PostAction] = {
    loadActionsOnPageImpl(Some(pageId), userId = Some(userId))
  }


  def loadAllPostActions(): immutable.Seq[PostAction] = {
    loadActionsOnPageImpl(pageId = None, userId = None)
  }


  private def loadActionsOnPageImpl(pageId: Option[PageId], userId: Option[UserId])
        : immutable.Seq[PostAction] = {
    val values = ArrayBuffer[AnyRef](siteId.asAnyRef)
    val andPageIdEq = pageId match {
      case None => ""
      case Some(id) =>
        values.append(id)
        s"and page_id = ?"
    }
    val andCreatedBy = userId match {
      case None => ""
      case Some(id) =>
        values.append(id.asAnyRef)
        "and from_pat_id_c = ?"
    }
    val query = s"""
      select to_post_id_c, page_id, post_nr, rel_type_c, created_at,
            from_pat_id_c, from_true_id_c, from_old_false_id_c
      from post_actions3
      where site_id = ? $andPageIdEq $andCreatedBy
      """
    runQueryFindMany(query, values.toList, rs => {
      PostAction(
        uniqueId = rs.getInt("to_post_id_c"),
        pageId = rs.getString("page_id"),
        postNr = rs.getInt("post_nr"),
        doneAt = getWhen(rs, "created_at"),
        doerTrueId = _getTrueId(rs)),
        actionType = fromActionTypeInt(rs.getInt("rel_type_c")))
    })
  }


  def loadActionsDoneToPost(pageId: PageId, postNr: PostNr): immutable.Seq[PostAction] = {
    val query = """
      select to_post_id_c, rel_type_c, created_at, from_pat_id_c
      from post_actions3
      where site_id = ? and page_id = ? and post_nr = ?
      """
    val values = List[AnyRef](siteId.asAnyRef, pageId, postNr.asAnyRef)
    runQueryFindMany(query, values, rs => {
      PostAction(
        uniqueId = rs.getInt("to_post_id_c"),
        pageId = pageId,
        postNr = postNr,
        doneAt = getWhen(rs, "created_at"),
        doerTrueId = _getTrueId(rs)),
        actionType = fromActionTypeInt(rs.getInt("rel_type_c")))
    })
  }


  def loadFlagsFor(pagePostNrs: Iterable[PagePostNr]): immutable.Seq[PostFlag] = {
    if (pagePostNrs.isEmpty)
      return Nil

    val queryBuilder = new StringBuilder(256, s"""
      select to_post_id_c, page_id, post_nr, rel_type_c, created_at, from_pat_id_c
      from post_actions3
      where site_id = ?
        and rel_type_c in ($FlagValueSpam, $FlagValueInapt, $FlagValueOther)
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
        uniqueId = rs.getInt("to_post_id_c"),
        pageId = rs.getString("page_id"),
        postNr = rs.getInt("post_nr"),
        doneAt = getWhen(rs, "created_at"),
        flaggerId = _getTrueId(rs)),
        flagType = fromActionTypeIntToFlagType(rs.getInt("rel_type_c")))
      dieIf(!postAction.actionType.isInstanceOf[PostFlagType], "DwE2dpg4")
      postAction
    })
  }


  def clearFlags(pageId: PageId, postNr: PostNr, clearedById: UserId) {
    BUG // Doesn't this delete votes and other things too? See deleteVote(), use instead?
    // Need to incl:  and rel_type_c = Flag?
    val statement = s"""
      update post_actions3
      set deleted_at = now_utc(), deleted_by_id = ?, updated_at = now_utc()
      where site_id = ? and page_id = ? and post_nr = ? and deleted_at is null
      """
    val values = List(clearedById.asAnyRef, siteId.asAnyRef, pageId, postNr.asAnyRef)
    runUpdate(statement, values)
  }


  def insertPostAction(postAction: PostAction) {
    postAction match {
      case vote: PostVote =>
        insertPostActionImpl(
              postId = vote.uniqueId, pageId = vote.pageId, postNr = vote.postNr,
              vote.voteType, vote.doerTrueId, doneAt = vote.doneAt)
      case flag: PostFlag =>
        insertPostActionImpl(
              postId = flag.uniqueId, pageId = flag.pageId, postNr = flag.postNr,
              flag.flagType, flag.doerTrueId, doneAt = flag.doneAt)
      // case AuthorOf => ...
      // case OwnerOf => ...
    }
  }


  private def insertPostActionImpl(postId: PostId, pageId: PageId, postNr: PostNr,
        actionType: PostActionType, doerTrueId: TrueId, doneAt: When) {
    val statement = """
          insert into post_actions3(
              site_id,
              to_post_id_c,
              page_id,
              post_nr,
              rel_type_c,
              from_pat_id_c,
              from_true_id_c,
              from_old_false_id_c,
              created_at,
              sub_type_c)
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)  """

    val values = List[AnyRef](
          siteId.asAnyRef,
          postId.asAnyRef,
          pageId,
          postNr.asAnyRef,
          toActionTypeInt(actionType),
          doerTrueId.curId.asAnyRef,
          doerTrueId.anyTrueId.orNullInt,
          doerTrueId.oldFalseId.orNullInt,
          doneAt.asTimestamp)
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
        composed_at, composed_by_id, composed_by_true_id_c, composed_by_old_false_id_c,
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
        composedByTrueId = TrueFalseId(
              rs.getInt("composed_by_id"),
              anyTrueId = getOptInt(rs, "composed_by_true_id_c"),
              oldFalseId = getOptInt(rs, "composed_by_old_false_id_c")),
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
            composed_at,
            composed_by_id,
            composed_by_true_id_c,
            composed_by_old_false_id_c,
            approved_at, approved_by_id,
            hidden_at, hidden_by_id)
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) """

    val values = List[AnyRef](
          siteId.asAnyRef, revision.postId.asAnyRef,
          revision.revisionNr.asAnyRef, revision.previousNr.orNullInt,
          revision.sourcePatch.orNullVarchar, revision.fullSource.orNullVarchar,
          revision.title.orNullVarchar,
          revision.composedAt,
          revision.composedByTrueId.curId.asAnyRef,
          revision.composedByTrueId.anyTrueId.orNullInt,
          revision.composedByTrueId.oldFalseId.orNullInt,
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

  private def _getTrueId(rs: js.ResultSet): TrueId = {
    TrueFalseId(
          curId = rs.getInt("from_pat_id_c"),
          anyTrueId = getOptInt(rs, "from_true_id_c"),
          oldFalseId = getOptInt(rs, "from_old_false_id_c")
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


  REFACTOR // move to:  PostActionType.from(Int): PostActionType  [402KTHRNPQw]
  def fromActionTypeInt(value: Int, mab: MessAborter = IfBadDie): PostActionType =
    fromAnyActionTypeInt(value).getOrAbort(mab, "TyE0ACTTYPE", s"Not a post action type: $value")

  def fromAnyActionTypeInt(value: Int): Opt[PostActionType] = Some(value match {
    case VoteValueLike => PostVoteType.Like
    case VoteValueWrong => PostVoteType.Wrong
    case VoteValueBury => PostVoteType.Bury
    case VoteValueUnwanted => PostVoteType.Unwanted
    case FlagValueSpam => PostFlagType.Spam
    case FlagValueInapt => PostFlagType.Inapt
    case FlagValueOther => PostFlagType.Other
    case _ => return None
  })

  COULD // use MessAborter, if wrong type?
  def fromActionTypeIntToFlagType(value: Int): PostFlagType = {
    val tyype = fromActionTypeInt(value)
    require(tyype.isInstanceOf[PostFlagType], "DwE4GKP52")
    tyype.asInstanceOf[PostFlagType]
  }

  def postActionTypeIntToOptVoteType(value: i32): Opt[PostVoteType] = {
    val tyype = fromAnyActionTypeInt(value) getOrElse { return None }
    if (!tyype.isInstanceOf[PostVoteType]) return None
    Some(tyype.asInstanceOf[PostVoteType])
  }

}

/**
 * Copyright (c) 2015 Kaj Magnus Lindberg
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

import scala.collection.Seq
import com.debiki.core._
import com.debiki.core.Prelude._
import java.{sql => js}
import scala.collection.immutable
import scala.collection.mutable.ArrayBuffer
import scala.util.Try
import Rdb._
import RdbUtil._
import com.debiki.core.PageOrderOffset.ByScoreAndBumpTime


/** Loads and saves categories, and lists all pages in a category or all categories.
  */
trait CategoriesSiteDaoMixin extends SiteTransaction {
  self: RdbSiteTransaction =>


  def loadCategory(categoryId: CategoryId): Option[Category] = {
    loadCategoryMap().get(categoryId)
  }


  def loadCategoryMap(): Map[CategoryId, Category] = {
    val query = """ -- loadCategoryMap
      select * from categories3 where site_id = ?
      """
    runQueryBuildMap(query, List(siteId.asAnyRef), rs => {
      val category = getCategory(rs)
      category.id -> category
    })
  }


  def loadCategoryPathRootLast(categoryId: CatId, inclSelfFirst: Bo): ImmSeq[Cat] = {
    unimplIf(!inclSelfFirst, "TyE3J06MRFK2")
    val categoriesById = loadCategoryMap()
    val ancestors = ArrayBuffer[Category]()
    var nextCategory = categoriesById.get(categoryId)
    var laps = 0
    while (nextCategory.isDefined) {
      laps += 1
      dieIf(laps > 100, "EsE7YKGW3", s"Category cycle? Around category ${nextCategory.get.id}")
      ancestors += nextCategory.get
      nextCategory = nextCategory.get.parentId.flatMap(categoriesById.get)
    }
    ancestors.to(immutable.Seq)
  }


  def loadPagesByUser(userId: UserId, isStaffOrSelf: Boolean, limit: Int): Seq[PagePathAndMeta] = {
    val andNotGone = isStaffOrSelf ? "" | "and hidden_at is null and deleted_at is null"
    val query = i""" -- loadPagesByUser
        select
          t.parent_folder,
          t.page_id,
          t.show_id,
          t.page_slug,
          ${_PageMetaSelectListItems}
        from pages3 g inner join page_paths3 t
          on g.site_id = t.site_id and g.page_id = t.page_id
          and t.canonical = 'C'
        where
          g.site_id = ? and
          g.author_id = ?
          $andNotGone
        order by g.published_at desc
        limit $limit
        """
    val values = List(siteId.asAnyRef, userId.asAnyRef)
    runQueryFindMany(query, values, rs => {
      val pagePath = _PagePath(rs, siteId)
      val pageMeta = _PageMeta(rs, pagePath.pageId.get)
      PagePathAndMeta(pagePath, pageMeta)
    })
  }


  def loadPagesInCategories(categoryIds: Seq[CategoryId], pageQuery: PageQuery, limit: Int)
        : Vec[PagePathAndMeta] = {
    pageQuery.orderOffset match {
      case _: ByScoreAndBumpTime =>
        loadPagesInCategoriesByScore(categoryIds, pageQuery, limit)
      case other =>
        loadPagesInCategoriesNoScore(categoryIds, pageQuery, limit)
    }
  }


  private def loadPagesInCategoriesByScore(categoryIds: Seq[CatId], pageQuery: PageQuery,
        limit: i32) : Vec[PagePathAndMeta] = {
    if (categoryIds.isEmpty || limit <= 0)
      return Vec.empty

    // Some dupl code. (8KREQY0)

    val scoreOrder = pageQuery.orderOffset.asInstanceOf[ByScoreAndBumpTime]
    val values = ArrayBuffer[AnyRef](siteId.asAnyRef)
    values ++= categoryIds.map(_.asAnyRef)

    val andNotDeleted =
      pageQuery.pageFilter.includeDeleted ? "" | " and g.deleted_at is null"

    // (Don't do s"${period}_score" — then cannot search and find all usages of the column.)
    val periodScore = scoreOrder.period match {
      case TopTopicsPeriod.Day => "day_score"
      case TopTopicsPeriod.Week => "week_score"
      case TopTopicsPeriod.Month => "month_score"
      case TopTopicsPeriod.Quarter => "quarter_score"
      case TopTopicsPeriod.Year => "year_score"
      case TopTopicsPeriod.Triennial => "triennial_score_c"
      case TopTopicsPeriod.All => "all_score"
    }

    val offsetTestAnd =
      scoreOrder.offset  match {
      case None => ""
      case Some(maxScore) =>
        values += maxScore.asAnyRef
        s"(pps.$periodScore <= ?) and"
    }

    val pageFilterAnd = makePageFilterTestsAnd(pageQuery)

    // Currently there's no / not-much data, from algorithms other than 1.
    // Let's fallback to the old all-votes alg 1 — by loading both alg
    // 2 and 1, and sorting alg 2 rows before alg 1 rows.
    val scoreAlgs: St = if (scoreOrder.scoreAlg == 1) "1" else "1, 2"

    COULD_OPTIMIZE
    // Add column: dormant_status_c  to table  page_popularity_scores3
    // and incl in index, so can skip deleted or not-yet-approved or unlisted
    // pages? — Not important right now though.

    val sql = s""" -- loadPagesInCategoriesByScore
        select
          t.parent_folder,
          t.page_id,
          t.show_id,
          t.page_slug,
          ${_PageMetaSelectListItems}
        from page_popularity_scores3 pps
          inner join pages3 g
          on pps.site_id = g.site_id and
             pps.page_id = g.page_id
          inner join page_paths3 t
          on g.site_id = t.site_id and
             g.page_id = t.page_id and
             t.canonical = 'C'
        where
          pps.site_id = ? and
          pps.score_alg_c in ($scoreAlgs) and
          g.category_id in (${ makeInListFor(categoryIds) }) and
          $offsetTestAnd
          $pageFilterAnd
          -- exclude category descr topics [4AKBR02]
          g.page_role not in (${PageType.Forum.toInt}, ${PageType.AboutCategory.toInt})
          $andNotDeleted
        order by
            -- Score alg needed only until there're entries for all algorithms — but
            -- currently, often there's a row only for algorithm id 1, which we
            -- can thus use as fallback. 1 is the lowest id, so sorting by
            -- alg id desc, gives any data from the alg we do want to use, precedence.
            -- (We might get back two rows for some pages — the then redundant
            -- row for alg id 1 is excluded by Scala code [.excl_def_score_alg].)
            -- (Probably some way to do this via SQL but Scala is simpler.)
            pps.score_alg_c desc,
            pps.$periodScore desc,
            g.bumped_at desc
        limit $limit"""

    // Currently some pages return two rows — an additional row, with the falback sort order
    // & score. Let's exclude the duplicates here, for simplicity.  [.excl_def_score_alg]
    // We want the first row only, if there're two.
    val results = ArrayBuffer[PagePathAndMeta]()
    val idsAdded = MutHashSet[PageId]()

    runQueryAndForEachRow(sql, values.toList, rs => {
      val pagePath = _PagePath(rs, siteId)
      if (!idsAdded.contains(pagePath.pageId.get)) {
        idsAdded.add(pagePath.pageId.get)
        val pageMeta = _PageMeta(rs, pagePath.pageId.get)
        results append PagePathAndMeta(pagePath, pageMeta)
      }
    })
    results.toVector
  }


  private def loadPagesInCategoriesNoScore(categoryIds: Seq[CatId], pageQuery: PageQuery,
        limit: i32) : Vec[PagePathAndMeta] = {
    // Some dupl code. (8KREQY0)

    require(limit >= 1, "DwE5KGW2")
    if (categoryIds.isEmpty)
      return Vec.empty

    var values = Vector[AnyRef]()

    val (orderBy, offsetTestAnd) = pageQuery.orderOffset match {
      //case PageOrderOffset.Any =>
        //("", "")
      case PageOrderOffset.ByPublTime =>
        ("order by g.published_at desc", "")
      case PageOrderOffset.ByBumpTime(anyDate) =>
        val offsetTestAnd = anyDate match {
          case None => ""
          case Some(date) =>
            values :+= d2ts(date)
            "g.bumped_at <= ? and"
        }
        // bumped_at is never null (it defaults to publ date or creation date).
        (s"order by g.bumped_at desc", offsetTestAnd)
      case PageOrderOffset.ByCreatedAt(anyDate) =>
        val offsetTestAnd = anyDate match {
          case None => ""
          case Some(date) =>
            values :+= d2ts(date)
            "g.created_at <= ? and"
        }
        (s"order by g.created_at desc", offsetTestAnd)
      case PageOrderOffset.ByPinOrderLoadOnlyPinned =>
        (s"order by g.pin_order", "g.pin_where is not null and")
      case PageOrderOffset.ByLikesAndBumpTime(anyLikesAndDate) =>
        val offsetTestAnd = anyLikesAndDate match {
          case None => ""
          case Some((maxNumLikes, date)) =>
            values :+= maxNumLikes.asAnyRef
            values :+= d2ts(date)
            values :+= maxNumLikes.asAnyRef
            """((g.num_likes <= ? and g.bumped_at <= ?) or
                (g.num_likes < ?)) and"""
        }
        ("order by g.num_likes desc, bumped_at desc", offsetTestAnd)
      case _ =>
        unimplemented(s"Sort order unsupported: ${pageQuery.orderOffset} [DwE2GFU06]")
    }

    values :+= siteId.asAnyRef

    val pageFilterAnd = makePageFilterTestsAnd(pageQuery)

    values = values ++ categoryIds.map(_.asAnyRef)

    val andNotDeleted =
      pageQuery.pageFilter.includeDeleted ? "" | " and g.deleted_at is null"

    WOULD_OPTIMIZE // Could do this for all categories in just one query, by using PARTITION BY:
    // with q as (
    //   select
    //     ...
    //     row_number() over (partition by base_cat_id_t $orderBy, t.page_id desc) as row_num
    // )
    // select * from q ... where row_num < $limit
    //
    // However, then a new category_t column, base_cat_id_t, is needed — because
    // this query is used to look up all topics in a base category incl its sub, sub sub
    // etc categories.
    //
    // Not important, currently. Simply in-memory caching the result is better.
    // But maybe some day.

    val sql = s""" -- loadPagesInCategoriesNoScore
        select
          t.parent_folder,
          t.page_id,
          t.show_id,
          t.page_slug,
          ${_PageMetaSelectListItems}
        from pages3 g inner join page_paths3 t
          on g.site_id = t.site_id and g.page_id = t.page_id
          and t.canonical = 'C'
        where
          $offsetTestAnd
          $pageFilterAnd
          g.site_id = ? and
          -- exclude category descr topics [4AKBR02]
          g.page_role not in (${PageType.Forum.toInt}, ${PageType.AboutCategory.toInt}) and
          g.category_id in (${ makeInListFor(categoryIds) })
          $andNotDeleted
        -- Also sort by id, so things API upserted with the same time stamp
        -- get a consistent sort order.
        $orderBy, t.page_id desc
        limit $limit"""

    runQueryFindMany(sql, values.toList, rs => {
      val pagePath = _PagePath(rs, siteId)
      val pageMeta = _PageMeta(rs, pagePath.pageId.get)
      PagePathAndMeta(pagePath, pageMeta)
    })
  }


  private def makePageFilterTestsAnd(pageQuery: PageQuery): String = {
    import PageType._
    pageQuery.pageFilter.filterType match {
      case PageFilterType.ForActivitySummaryEmail =>
        s"""
            g.author_id <> $SystemUserId and  -- excl auto created pages (by system) in summary [EXCLSYS]
            g.page_role in (
              ${Question.toInt}, ${Problem.toInt}, ${Idea.toInt}, ${ToDo.toInt},
              ${MindMap.toInt}, ${Discussion.toInt},
              ${Critique.toInt}, ${UsabilityTesting.toInt}) and  -- [plugin]
            """
      case PageFilterType.WaitingTopics =>
        s"""
            g.page_role in (
              ${Question.toInt}, ${Problem.toInt}, ${Idea.toInt}, ${ToDo.toInt},
              ${Critique.toInt}, ${UsabilityTesting.toInt}) and  -- [plugin]
            g.closed_at is null and
            """
      case _ =>
        if (pageQuery.includeAboutCategoryPages) ""
        else s" g.page_role <> ${AboutCategory.toInt} and "
    }
  }


  override def nextCategoryId(): PostId = {
    val query = """ -- nextCategoryId
      select max(id) max_id from categories3 where site_id = ?
      """
    runQuery(query, List(siteId.asAnyRef), rs => {
      rs.next()
      val maxId = rs.getInt("max_id") // null becomes 0, fine
      maxId + 1  // Hack. Other code knows starts at 1. [8UWKQXN45]
    })
  }


  override def insertCategoryMarkSectionPageStale(category: Cat, mab: MessAborter): Unit = {
    val statement = """
        insert into categories3 (
            site_id,
            id,
            ext_id,
            page_id,
            parent_id,
            default_category_id,
            name,
            slug,
            position,
            description,
            new_topic_types,
            def_sort_order_c,
            comt_order_c,
            comt_nesting_c,
            comts_start_hidden_c,
            comts_start_anon_c,
            op_starts_anon_c,
            new_anon_status_c,
            def_score_alg_c,
            def_score_period_c,
            do_vote_style_c,
            do_vote_in_topic_list_c,
            unlist_category,
            unlist_topics,
            incl_in_summaries,
            created_at,
            updated_at,
            deleted_at)
        values (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?)  """

    val values = List[AnyRef](
          siteId.asAnyRef,
          category.id.asAnyRef,
          category.extImpId.orNullVarchar,
          category.sectionPageId,
          category.parentId.orNullInt,
          category.defaultSubCatId.orNullInt,
          category.name,
          category.slug,
          category.position.asAnyRef,
          category.description.orNullVarchar,
          topicTypesToVarchar(category.newTopicTypes),
          category.defaultSortOrder.map(_.toInt).orNullInt,
          category.comtOrder.map(_.toInt).orNullInt,
          category.comtNesting.orNullInt,
          category.comtsStartHidden.map(_.toInt).orNullInt,
          category.comtsStartAnon.map(_.toInt).orNullInt,
          category.opStartsAnon.map(_.toInt).orNullInt,
          category.newAnonStatus.map(_.toInt).orNullInt,
          catSortOrderScoreAlg(category).orNullInt,
          catSortOrderScorePeriodInt(category).orNullInt,
          category.doVoteStyle.map(_.toInt).orNullInt,
          category.doVoteInTopicList.orNullBo,
          category.unlistCategory.asAnyRef,
          category.unlistTopics.asAnyRef,
          category.includeInSummaries.toInt.asAnyRef,
          category.createdAt.asTimestamp,
          category.updatedAt.asTimestamp,
          category.deletedAt.orNullTimestamp)
    tryInsUpdCat(category, mab) {
      runUpdateSingleRow(statement, values)
    }
    markSectionPageContentHtmlAsStale(category.id)
  }


  override def updateCategoryMarkSectionPageStale(category: Category, mab: MessAborter): Unit = {
    val statement = """
      update categories3 set
        page_id = ?, parent_id = ?, default_category_id = ?,
        ext_id = ?,
        name = ?, slug = ?, position = ?,
        description = ?,   -- REFACTOR CLEAN_UP no longer needed, instead: [502RKDJWF5]
        new_topic_types = ?,
        def_sort_order_c = ?,
        comt_order_c = ?,
        comt_nesting_c = ?,
        comts_start_hidden_c = ?,
        comts_start_anon_c = ?,
        op_starts_anon_c = ?,
        new_anon_status_c = ?,
        def_score_alg_c = ?,
        def_score_period_c = ?,
        do_vote_style_c = ?,
        do_vote_in_topic_list_c = ?,
        unlist_category = ?, unlist_topics = ?, incl_in_summaries = ?,
        created_at = ?, updated_at = ?,
        deleted_at = ?
      where site_id = ? and id = ?"""
    val values = List[AnyRef](
      category.sectionPageId, category.parentId.orNullInt, category.defaultSubCatId.orNullInt,
      category.extImpId.orNullVarchar,
      category.name, category.slug, category.position.asAnyRef,
      category.description.orNullVarchar, topicTypesToVarchar(category.newTopicTypes),
      category.defaultSortOrder.map(_.toInt).orNullInt,
      category.comtOrder.map(_.toInt).orNullInt,
      category.comtNesting.orNullInt,
      category.comtsStartHidden.map(_.toInt).orNullInt,
      category.comtsStartAnon.map(_.toInt).orNullInt,
      category.opStartsAnon.map(_.toInt).orNullInt,
      category.newAnonStatus.map(_.toInt).orNullInt,
      catSortOrderScoreAlg(category).orNullInt,
      catSortOrderScorePeriodInt(category).orNullInt,
      category.doVoteStyle.map(_.toInt).orNullInt,
      category.doVoteInTopicList.orNullBo,
      category.unlistCategory.asAnyRef, category.unlistTopics.asAnyRef, category.includeInSummaries.toInt.asAnyRef,
      category.createdAt.asTimestamp, category.updatedAt.asTimestamp,
      category.deletedAt.orNullTimestamp,
      siteId.asAnyRef, category.id.asAnyRef)
    tryInsUpdCat(category, mab) {
      runUpdateSingleRow(statement, values)
    }
    // In the future: mark any old section page html as stale too, if moving to new section.
    markSectionPageContentHtmlAsStale(category.id)
  }


  private def tryInsUpdCat(cat: Cat, mab: MessAborter)(block: => U): U = {
    try block
    catch {
      case ex: java.sql.SQLException if isUniqueConstrViolation(ex) =>
        var errMsg = ""
        val thereIs = "There is already a category with that "

        if (uniqueConstrViolatedIs("categories_u_extid", ex)) {
          errMsg = thereIs + s"external id, namely: '${cat.extImpId getOrElse ""}'"
        }
        else if (uniqueConstrViolatedIs("dw2_cats_page_slug__u", ex)) {
          errMsg = thereIs + s"name, namely: '${cat.slug
                }' (same URL slug as another category)"
        }
        else if (uniqueConstrViolatedIs("dw2_cats_parent_slug__u", ex)) {
          // This currently cannot/doesn't happen — instead, the unique constraint
          // just above: dw2_cats_page_slug__u, fails instead.
          errMsg = thereIs + s"name, namely: '${cat.slug
                }' (same URL slug as another sub category)"
        }

        if (errMsg.isEmpty) throw ex
        else mab.abort("TyECATSLUG0UNQ", errMsg)
    }
  }


  def catSortOrderScoreAlg(cat: Cat): Opt[i32] = {
    cat.defaultSortOrder.flatMap({
      case byScore: PageOrderOffset.ByScoreAndBumpTime => Some(byScore.scoreAlg)
      case _ => None
    })
  }

  def catSortOrderScorePeriodInt(cat: Cat): Opt[i32] = {
    cat.defaultSortOrder.flatMap({
      case byScore: PageOrderOffset.ByScoreAndBumpTime => Some(byScore.period.toInt)
      case _ => None
    })
  }

  override def loadAboutCategoryPageId(categoryId: CategoryId): Option[PageId] = {
    val query = s""" -- loadAboutCategoryPageId
      select page_id from pages3
      where site_id = ?
        and category_id = ?
        and page_role = ${PageType.AboutCategory.toInt}
      """
    runQueryFindOneOrNone(query, List(siteId.asAnyRef, categoryId.asAnyRef), rs => {
      rs.getString("page_id")
    })
  }


  private def getCategory(rs: js.ResultSet): Category = {
    Category(
      id = rs.getInt("id"),
      extImpId = getOptString(rs, "ext_id"),
      sectionPageId = rs.getString("page_id"),
      parentId = getOptionalInt(rs, "parent_id"),
      defaultSubCatId = getOptionalInt(rs, "default_category_id"),
      position = rs.getInt("position"),
      name = rs.getString("name"),
      slug = rs.getString("slug"),
      description = Option(rs.getString("description")),
      newTopicTypes = getNewTopicTypes(rs),
      defaultSortOrder = PageOrderOffset.fromOptVals(
            orderInt = getOptInt32(rs, "def_sort_order_c"),
            scoreAlgInt = getOptInt32(rs, "def_score_alg_c"),
            scorePeriodInt = getOptInt32(rs, "def_score_period_c")),
      comtOrder = PostSortOrder.fromOptVal(getOptInt32(rs, "comt_order_c")),
      comtNesting = getOptInt32(rs, "comt_nesting_c"),
      comtsStartHidden = NeverAlways.fromOptInt(getOptInt32(rs, "comts_start_hidden_c")),
      comtsStartAnon = NeverAlways.fromOptInt(getOptInt32(rs, "comts_start_anon_c")),
      opStartsAnon = NeverAlways.fromOptInt(getOptInt32(rs, "op_starts_anon_c")),
      newAnonStatus = AnonStatus.fromOptInt(getOptInt32(rs, "new_anon_status_c")),
      doVoteStyle = DoVoteStyle.fromOptInt32(getOptInt32(rs, "do_vote_style_c")),
      doVoteInTopicList = getOptBool(rs, "do_vote_in_topic_list_c"),
      unlistCategory = rs.getBoolean("unlist_category"),
      unlistTopics = rs.getBoolean("unlist_topics"),
      includeInSummaries = IncludeInSummaries.fromInt(rs.getInt("incl_in_summaries"))
          .getOrElse(IncludeInSummaries.Default),
      createdAt = getDate(rs, "created_at"),
      updatedAt = getDate(rs, "updated_at"),
      lockedAt = getOptionalDate(rs, "locked_at"),
      frozenAt = getOptionalDate(rs, "frozen_at"),
      deletedAt = getOptionalDate(rs, "deleted_at"))
  }


  private def topicTypesToVarchar(topicTypes: Seq[PageType]): AnyRef =
    topicTypes.map(_.toInt).mkString(",") orIfEmpty NullVarchar


  private def getNewTopicTypes(rs: js.ResultSet): immutable.Seq[PageType] = {
    // This is a comma separated topic type list, like: "5,3,11".
    val newTopicTypes: immutable.Seq[PageType] = Option(rs.getString("new_topic_types")) match {
      case Some(text) if text.nonEmpty =>
        val topicTypeIdStrings = text.split(',')
        var typeIds = Vector[PageType]()
        for (typeIdString <- topicTypeIdStrings) {
          // COULD log an error instead of silently ignoring errors here?
          Try(typeIdString.toInt) foreach { typeIdInt =>
            PageType.fromInt(typeIdInt) foreach { pageRole: PageType =>
              typeIds :+= pageRole
            }
          }
        }
        typeIds
      case _ =>
        Nil
    }
    newTopicTypes
  }

}


/*
Old code that recursively finds all ancestor pages of a page  [sub_pages]. Was in use
before I created the categories table. Perhaps it'll be useful again in the future
if there'll be really many categories sometimes, so one doesn't want to load all of them?
def batchLoadAncestorIdsParentFirst(pageIds: List[PageId])(connection: js.Connection)
    : collection.Map[PageId, List[PageId]] = {
  // This complicated stuff will go away when I create a dedicated category table,
  // and add forum_id, category_id, sub_cat_id columns to the pages table and the
  // category page too? Then everything will be available instantly.
  // (O.t.o.h. one will need to keep the above denormalized fields up-to-date.)

  val pageIdList = makeInListFor(pageIds)

  val sql = s"""
    with recursive ancestor_page_ids(child_id, parent_id, site_id, path, cycle) as (
        select
          page_id::varchar child_id,
          parent_page_id::varchar parent_id,
          site_id,
          -- `|| ''` needed otherwise conversion to varchar[] doesn't work, weird
          array[page_id || '']::varchar[],
          false
        from pages3 where site_id = ? and page_id in ($pageIdList)
      union all
        select
          page_id::varchar child_id,
          parent_page_id::varchar parent_id,
          pages3.site_id,
          path || page_id,
          parent_page_id = any(path) -- aborts if cycle, don't know if works (never tested)
        from pages3 join ancestor_page_ids
        on pages3.page_id = ancestor_page_ids.parent_id and
           pages3.site_id = ancestor_page_ids.site_id
        where not cycle
    )
    select path from ancestor_page_ids
    order by array_length(path, 1) desc
    """

  // If asking for ids for many pages, e.g. 2 pages, the result migth look like this:
  //  path
  //  -------------------
  //  {61bg6,1f4q9,51484}
  //  {1f4q9,51484}
  //  {61bg6,1f4q9}
  //  {1f4q9}
  //  {61bg6}
  // if asking for ancestors of page 1f4q9 and 61bg6.
  // I don't know if it's possible to group by the first element in an array,
  // and keep only the longest array in each group? Instead, for now,
  // for each page, simply use the longest path found.

  val result = mut.Map[PageId, List[PageId]]()
  db.withConnection { implicit connection =>
    db.query(sql, siteId :: pageIds, rs => {
      while (rs.next()) {
        val sqlArray: java.sql.Array = rs.getArray("path")
        val pageIdPathSelfFirst = sqlArray.getArray.asInstanceOf[Array[PageId]].toList
        val pageId::ancestorIds = pageIdPathSelfFirst
        // Update `result` if we found longest list of ancestors thus far, for pageId.
        val lengthOfStoredPath = result.get(pageId).map(_.length) getOrElse -1
        if (lengthOfStoredPath < ancestorIds.length) {
          result(pageId) = ancestorIds
        }
      }
    })
  }
  result
}
  */



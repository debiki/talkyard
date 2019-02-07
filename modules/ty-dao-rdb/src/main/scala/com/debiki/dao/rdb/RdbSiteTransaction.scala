/**
 * Copyright (C) 2011-2013 Kaj Magnus Lindberg (born 1979)
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

import com.debiki.core._
import com.debiki.core.Prelude._
import _root_.java.{util => ju}
import java.{sql => js}
import scala.collection.immutable
import scala.collection.mutable.ArrayBuffer
import DbDao._
import Rdb._
import RdbUtil._
import java.sql.ResultSet


/** A relational database Data Access Object, for a specific website.
  *
  * Could/should split it into many smaller mixins, like
  * FullTextSearchSiteDaoMixin. But not very important, because
  * it doesn't have any mutable state.
  */
class RdbSiteTransaction(var siteId: SiteId, val daoFactory: RdbDaoFactory, val now: When)
  extends SiteTransaction
  // SHOULD REFACTOR RENAME all these ...SiteDaoMixin  to SiteTxMixin. The Dao is instead in the main project (!).
  with PagesSiteDaoMixin
  with PostsSiteDaoMixin
  with DraftsSiteDaoMixin
  with TagsSiteDaoMixin
  with PageUsersSiteDaoMixin
  with UploadsSiteDaoMixin
  with CategoriesSiteDaoMixin
  with SearchSiteDaoMixin
  with SpamCheckQueueDaoMixin
  with UserSiteDaoMixin
  with EmailAddressesSiteDaoMixin
  with UsernamesSiteDaoMixin
  with LoginSiteDaoMixin
  with PostsReadStatsSiteDaoMixin
  with NotificationsSiteDaoMixin
  with PageNotfPrefsSiteTxMixin
  with SettingsSiteDaoMixin
  with BlocksSiteDaoMixin
  with ReviewTasksSiteDaoMixin
  with PermsOnPagesRdbMixin
  with ApiSecretsSiteDaoMixin
  with AuditLogSiteDaoMixin {


  def db: Rdb = daoFactory.db

  /** Lets us call SystemTransaction functions, in the same transaction.
    */
  lazy val asSystem: RdbSystemTransaction = {
    val transaction = new RdbSystemTransaction(daoFactory, now)
    transaction.setTheOneAndOnlyConnection(theOneAndOnlyConnection)
    transaction
  }

  def setSiteId(newId: SiteId) {
    siteId = newId
  }


  /** If set, should be the only connection that this dao uses. Some old code doesn't
    * create it though, then different connections are used instead :-(
    * I'll rename it to 'connection', when all that old code is gone and there's only
    * one connection always.
    */
  def anyOneAndOnlyConnection: Option[js.Connection] =
    _theOneAndOnlyConnection

  // COULD move to new superclass?
  def theOneAndOnlyConnection: js.Connection = {
    if (transactionEnded)
      throw new IllegalStateException("Transaction has ended [DwE4GKP53]")
    _theOneAndOnlyConnection getOrElse {
      die("DwE83KV21")
    }
  }

  private var _theOneAndOnlyConnection: Option[js.Connection] = None

  // COULD move to new superclass?
  private var transactionEnded = false
  var hasBeenRolledBack = false

  // COULD move to new superclass?
  def createTheOneAndOnlyConnection(readOnly: Boolean, mustBeSerializable: Boolean) {
    require(_theOneAndOnlyConnection.isEmpty)
    _theOneAndOnlyConnection = Some(db.getConnection(
      readOnly = readOnly, mustBeSerializable = mustBeSerializable))
  }

  // COULD move to new superclass?
  def setTheOneAndOnlyConnection(connection: js.Connection) {
    require(_theOneAndOnlyConnection.isEmpty)
    _theOneAndOnlyConnection = Some(connection)
  }

  // COULD move to new superclass?
  def commit() {
    if (_theOneAndOnlyConnection.isEmpty)
      throw new IllegalStateException("No permanent connection created [DwE5KF2]")
    theOneAndOnlyConnection.commit()
    db.closeConnection(theOneAndOnlyConnection)
    transactionEnded = true
  }


  // COULD move to new superclass?
  def rollback() {
    if (_theOneAndOnlyConnection.isEmpty)
      throw new IllegalStateException("No permanent connection created [DwE2K57]")
    theOneAndOnlyConnection.rollback()
    db.closeConnection(theOneAndOnlyConnection)
    transactionEnded = true
    hasBeenRolledBack = true
  }


  def transactionCheckQuota[T](f: (js.Connection) => T): T = {
    anyOneAndOnlyConnection foreach { connection =>
      // In this case I've moved the over quota check to com.debiki.core.DbDao2.
      return f(connection)
    }
    die("anyOneAndOnlyConnection is empty [EsE5MPKW2]") /*
    systemDaoSpi.db.transaction { connection =>
      val result = f(connection)
      val resourceUsage = loadResourceUsage(connection)
      resourceUsage.quotaLimitMegabytes foreach { limit =>
        val quotaExceededBytes = resourceUsage.estimatedBytesUsed - limit * 1000L * 1000L
        if (quotaExceededBytes > 0)
          throw OverQuotaException(siteId, resourceUsage)
      }
      result
    } */
  }


  def transactionAllowOverQuota[T](f: (js.Connection) => T): T = {
    anyOneAndOnlyConnection foreach { connection =>
      return f(connection)
    }
    die("anyOneAndOnlyConnection is empty [EsE7GJMU23]") /*
    systemDaoSpi.db.transaction(f)
    */
  }


  def makeSqlArrayOfStringsUnique(values: Iterable[String]): js.Array = {
    val distinctValues = values.toVector.sorted.distinct
    theOneAndOnlyConnection.createArrayOf("varchar", distinctValues.toArray[Object])
  }


  // COULD move to new superclass?
  def runQuery[R](query: String, values: List[AnyRef], resultSetHandler: js.ResultSet => R): R = {
    db.query(query, values, resultSetHandler)(theOneAndOnlyConnection)
  }


  def runQueryAndForEachRow(query: String, values: List[AnyRef],
        singleRowHandler: js.ResultSet => Any) {
    runQuery(query, values, rs => {
      while (rs.next) {
        singleRowHandler(rs)
      }
    })
  }


  // COULD move to new superclass? Dupl code [8FKW20Q]
  def runQueryFindExactlyOne[R](query: String, values: List[AnyRef],
        singleRowHandler: js.ResultSet => R): R = {
    runQuery(query, values, rs => {
      dieIf(!rs.next(), "EsE6MPUK2")
      val result = singleRowHandler(rs)
      dieIf(rs.next(), "DwE4GYK8")
      result
    })
  }


  // COULD move to new superclass? Dupl code [8FKW20Q]
  def runQueryFindOneOrNone[R](query: String, values: List[AnyRef],
        singleRowHandler: js.ResultSet => R, debugCode: String = null): Option[R] = {
    runQuery(query, values, rs => {
      if (!rs.next()) {
        None
      }
      else {
        val result = singleRowHandler(rs)
        dieIf(rs.next(), "DwE6GMY2" + (if (debugCode eq null) "" else '-' + debugCode))
        Some(result)
      }
    })
  }


  // To merge runQueryFindMany just below, and this ...AsSet, into one single
  // function [C, C[R]] that returns a generic collection C[R], see:
  // http://stackoverflow.com/a/5734615/694469 and linked from there:
  // http://stackoverflow.com/questions/5410846/how-do-i-apply-the-enrich-my-library-pattern-to-scala-collections
  def runQueryFindManyAsSet[R](query: String, values: List[AnyRef],
        singleRowHandler: js.ResultSet => R): immutable.Set[R] = {
    runQueryFindMany(query, values, singleRowHandler).toSet
  }


  def runQueryFindMany[R](query: String, values: List[AnyRef],
        singleRowHandler: js.ResultSet => R): immutable.Seq[R] = {
    val results = ArrayBuffer[R]()
    runQuery(query, values, rs => {
      while (rs.next) {
        val result = singleRowHandler(rs)
        results.append(result)
      }
    })
    results.toVector
  }


  def runQueryBuildMap[K, V](query: String, values: List[AnyRef],
    singleRowHandler: js.ResultSet => (K, V)): immutable.Map[K, V] = {
    var valuesByKey = immutable.HashMap[K, V]()
    runQuery(query, values, rs => {
      while (rs.next) {
        val (key, value) = singleRowHandler(rs)
        valuesByKey += key -> value
      }
    })
    valuesByKey
  }


  // Dupl code [9UFK2Q7]
  def runQueryBuildMultiMap[K, V](query: String, values: List[AnyRef],
        singleRowHandler: js.ResultSet => (K, V)): immutable.Map[K, immutable.Seq[V]] = {
    var valuesByKey = immutable.HashMap[K, immutable.Seq[V]]()
    runQuery(query, values, rs => {
      while (rs.next) {
        val (key: K, value: V) = singleRowHandler(rs)
        var values = valuesByKey.getOrElse(key, Vector.empty)
        values :+= value
        valuesByKey += key -> values
      }
    })
    valuesByKey
  }


  // For backw compat with old non-transactional stuff.
  def runQueryPerhapsAtnms[R](query: String, values: List[AnyRef],
        resultSetHandler: js.ResultSet => R): R = {
    if (_theOneAndOnlyConnection.isDefined) {
      runQuery(query, values, resultSetHandler)
    }
    else {
      db.queryAtnms(query, values, resultSetHandler)
    }
  }

  // COULD move to new superclass?
  def runUpdate(statement: String, values: List[AnyRef] = Nil): Int = {
    db.update(statement, values)(theOneAndOnlyConnection)
  }


  def runUpdateSingleRow(statement: String, values: List[AnyRef] = Nil): Boolean = {
    val numRowsUpdated = runUpdate(statement, values)
    dieIf(numRowsUpdated > 1, "TyE4KBW2L0", o"""This statement modified $numRowsUpdated rows
         but should have touched one row only: $statement""")
    numRowsUpdated == 1
  }


  def runUpdateExactlyOneRow(statement: String, values: List[AnyRef] = Nil) {
    val numRowsUpdated = runUpdate(statement, values)
    dieIf(numRowsUpdated != 1, "DwE8FUM1", o"""This statement modified $numRowsUpdated rows
        but should have touched exactly one row: $statement""")
  }


  def runUpdateExactNumRows(correctNumRows: Int, statement: String, values: List[AnyRef] = Nil) {
    val numRowsUpdated = runUpdate(statement, values)
    dieIf(numRowsUpdated != correctNumRows, "EsE2GYU7", o"""This statement modified $numRowsUpdated
        rows but should have modified $correctNumRows rows: $statement""")
  }


  def deferConstraints() {
    runUpdate("set constraints all deferred", Nil)
  }


  def loadResourceUsage() = loadResourceUsage(theOneAndOnlyConnection)


  def loadResourceUsage(connection: js.Connection): ResourceUse = {
    val sql = """
      select * from sites3 where ID = ?
      """
    db.query(sql, List(siteId.asAnyRef), rs => {
      rs.next()
      dieUnless(rs.isLast, "DwE59FKQ2")
      ResourceUse(
        quotaLimitMegabytes = getOptionalInt(rs, "QUOTA_LIMIT_MBS"),
        numGuests = rs.getInt("NUM_GUESTS"),
        numIdentities = rs.getInt("NUM_IDENTITIES"),
        numRoles = rs.getInt("NUM_ROLES"),
        numRoleSettings = rs.getInt("NUM_ROLE_SETTINGS"),
        numPages = rs.getInt("NUM_PAGES"),
        numPosts = rs.getInt("NUM_POSTS"),
        numPostTextBytes = rs.getLong("NUM_POST_TEXT_BYTES"),
        numPostRevisions = rs.getInt("num_post_revisions"),
        numPostRevisionBytes = rs.getLong("num_post_rev_bytes"),
        numPostsRead = rs.getInt("NUM_POSTS_READ"),
        numActions = rs.getInt("NUM_ACTIONS"),
        numUploads = rs.getInt("num_uploads"),
        numUploadBytes = rs.getLong("num_upload_bytes"),
        numNotfs = rs.getInt("NUM_NOTFS"),
        numEmailsSent = rs.getInt("NUM_EMAILS_SENT"))
    })(connection)
  }


  /** Some SQL operations might cause harmless errors, then we try again.
    *
    * One harmless error: Generating random ids and one happens to clash with
    * an existing id. Simply try again with another id.
    * Another harmless error (except w.r.t. performance) is certain deadlocks.
    * See the implementation of savePageActions() for details -- no, now it's been
    * deleted. Instead see below, just below, at [BKFF321]. And also:
    * see: http://www.postgresql.org/message-id/1078934613.17553.66.camel@coppola.ecircle.de
    * and: < http://postgresql.1045698.n5.nabble.com/
    *         Foreign-Keys-and-Deadlocks-tp4962572p4967236.html >
    *
    *  [BKFF321]: Old comment from former savePageActions:
    * """Try many times, because harmless deadlocks might abort the first attempt.
    * Example: Editing a row with a foreign key to table R result in a shared lock
    * on the referenced row in table R — so if two sessions A and B insert rows for
    * the same page into DW1_PAGE_ACTIONS and then update pages3 aftewards,
    * the update statement from session A blocks on the shared lock that
    * B holds on the pages3 row, and then session B blocks on the exclusive
    * lock on the pages3 row that A's update statement is trying to grab.
    * An E2E test that fails without `tryManyTimes` here is `EditActivitySpec`."""
    */
  private def tryManyTimes[T](numTimes: Int)(sqlBlock: => T): T = {
    for (i <- 2 to numTimes) {
      try {
        return sqlBlock
      }
      catch {
        case ex: js.SQLException =>
          // log.warning(...
          println(s"SQLException caught but I will try again: $ex")
      }
    }
    // Don't catch exceptions during very last attempt.
    sqlBlock
  }


  def nextPageId(): PageId = {
    transactionCheckQuota { connection =>
      nextPageIdImpl(connection)
    }
  }


  private def nextPageIdImpl(implicit connecton: js.Connection): PageId = {
    val sql = """{? = call INC_NEXT_PAGE_ID(?) }"""
    var nextPageIdInt =
      db.call(sql, List(siteId.asAnyRef), js.Types.INTEGER, result => {
        val nextId = result.getInt(1)
        nextId
      })
    nextPageIdInt.toString
  }


  def loadAllPageMetas(): immutable.Seq[PageMeta] =
    loadPageMetaImpl(pageIds = Nil, all = true).values.to[immutable.Seq]


  def loadPageMetas(pageIds: Iterable[PageId]): immutable.Seq[PageMeta] =
    loadPageMetaImpl(pageIds, all = false).values.to[immutable.Seq]


  def loadPageMeta(pageId: PageId): Option[PageMeta] =
    loadPageMeta(pageId, anySiteId = None)


  def loadPageMeta(pageId: PageId, anySiteId: Option[SiteId]): Option[PageMeta] =
    loadPageMetasAsMap(pageId::Nil, anySiteId) get pageId


  def loadPageMetasAsMap(pageIds: Iterable[PageId], anySiteId: Option[SiteId] = None)
        : Map[PageId, PageMeta] = {
    if (pageIds.isEmpty) return Map.empty
    loadPageMetaImpl(pageIds, all = false, anySiteId)
  }


  def loadPageMetaImpl(pageIds: Iterable[PageId], all: Boolean = false,
        anySiteId: Option[SiteId] = None): Map[PageId, PageMeta] = {
    if (!all && pageIds.isEmpty)
      return Map.empty

    val values: List[AnyRef] =
      if (all) List(anySiteId.getOrElse(siteId).asAnyRef)
      else anySiteId.getOrElse(siteId).asAnyRef :: pageIds.toList
    var sql = s"""
        select g.PAGE_ID, ${_PageMetaSelectListItems}
        from pages3 g
        where g.SITE_ID = ?
        """
    if (!all) {
      sql += s" and g.PAGE_ID in (${ makeInListFor(pageIds) })"
    }
    var metaByPageId = Map[PageId, PageMeta]()
    runQuery(sql, values, rs => {
      while (rs.next) {
        val pageId = rs.getString("PAGE_ID")
        val meta = _PageMeta(rs, pageId = pageId)
        dieIf(meta.pageId != pageId, "EdE7KFUW02")
        metaByPageId += pageId -> meta
      }
    })
    metaByPageId
  }

  /* UNT ESTED
  def loadPageMetaForAllSections(): Seq[PageMeta] = {
    import PageRole.{Forum, Blog}
    val sql = s"""
      select g.page_id, $_PageMetaSelectListItems from pages3 g
      where g.site_id = ? and g.page_role in ($Forum, $Blog)
      """
    runQueryFindMany(sql, Nil, rs => {
      val pageId = rs.getString("PAGE_ID")
      _PageMeta(rs, pageId = pageId)
    })
  }*/


  def updatePageMetaImpl(meta: PageMeta, oldMeta: PageMeta, markSectionPageStale: Boolean) {
    transactionCheckQuota { transaction =>
      if (markSectionPageStale) {
        oldMeta.categoryId.foreach(markSectionPageContentHtmlAsStale)
        if (meta.categoryId != oldMeta.categoryId) {
          meta.categoryId.foreach(markSectionPageContentHtmlAsStale)
        }
      }
      if (meta != oldMeta) {
        _updatePageMeta(meta, anyOld = Some(oldMeta))(transaction)
      }
    }
  }


  private def _updatePageMeta(newMeta: PageMeta, anyOld: Option[PageMeta])
        (implicit connection: js.Connection) {
    anyOld foreach { oldMeta =>
      dieIf(!oldMeta.pageRole.mayChangeRole && oldMeta.pageRole != newMeta.pageRole,
        "EsE7KPW24", s"Trying to change page role from ${oldMeta.pageRole} to ${newMeta.pageRole}")
    }
    val values = List(
      newMeta.version.asAnyRef,
      newMeta.pageRole.toInt.asAnyRef,
      newMeta.categoryId.orNullInt,
      newMeta.embeddingPageUrl.orNullVarchar,
      newMeta.authorId.asAnyRef,
      newMeta.publishedAt.orNullTimestamp,
      // Always write to bumped_at so SQL queries that sort by bumped_at works.
      newMeta.bumpedOrPublishedOrCreatedAt.asTimestamp,
      newMeta.lastReplyAt.orNullTimestamp,
      newMeta.lastReplyById.orNullInt,
      newMeta.frequentPosterIds.drop(0).headOption.orNullInt,
      newMeta.frequentPosterIds.drop(1).headOption.orNullInt,
      newMeta.frequentPosterIds.drop(2).headOption.orNullInt,
      newMeta.frequentPosterIds.drop(3).headOption.orNullInt,
      newMeta.layout.toInt.asAnyRef,
      newMeta.pinOrder.orNullInt,
      newMeta.pinWhere.map(_.toInt).orNullInt,
      newMeta.numLikes.asAnyRef,
      newMeta.numWrongs.asAnyRef,
      newMeta.numBurys.asAnyRef,
      newMeta.numUnwanteds.asAnyRef,
      newMeta.numRepliesVisible.asAnyRef,
      newMeta.numRepliesTotal.asAnyRef,
      newMeta.numPostsTotal.asAnyRef,
      newMeta.numOrigPostLikeVotes.asAnyRef,
      newMeta.numOrigPostWrongVotes.asAnyRef,
      newMeta.numOrigPostBuryVotes.asAnyRef,
      newMeta.numOrigPostUnwantedVotes.asAnyRef,
      newMeta.numOrigPostRepliesVisible.asAnyRef,
      newMeta.answeredAt.orNullTimestamp,
      newMeta.answerPostUniqueId.orNullInt,
      newMeta.plannedAt.orNullTimestamp,
      newMeta.startedAt.orNullTimestamp,
      newMeta.doneAt.orNullTimestamp,
      newMeta.closedAt.orNullTimestamp,
      newMeta.lockedAt.orNullTimestamp,
      newMeta.frozenAt.orNullTimestamp,
      newMeta.hiddenAt.orNullTimestamp,
      newMeta.deletedAt.orNullTimestamp,
      newMeta.htmlTagCssClasses.orIfEmpty(NullVarchar),
      newMeta.htmlHeadTitle.orIfEmpty(NullVarchar),
      newMeta.htmlHeadDescription.orIfEmpty(NullVarchar),
      newMeta.numChildPages.asAnyRef,
      siteId.asAnyRef,
      newMeta.pageId)
    val sql = s"""
      update pages3 set
        version = ?,
        PAGE_ROLE = ?,
        category_id = ?,
        EMBEDDING_PAGE_URL = ?,
        author_id = ?,
        -- now_utc can otherwise be < created_at, because created_at is from the JVM,
        -- but now_utc from the database. COULD use the JVM's date here too, instead?
        UPDATED_AT = greatest(created_at, now_utc()),
        PUBLISHED_AT = ?,
        BUMPED_AT = ?,
        LAST_REPLY_AT = ?,
        last_reply_by_id = ?,
        frequent_poster_1_id = ?,
        frequent_poster_2_id = ?,
        frequent_poster_3_id = ?,
        frequent_poster_4_id = ?,
        layout = ?,
        PIN_ORDER = ?,
        PIN_WHERE = ?,
        NUM_LIKES = ?,
        NUM_WRONGS = ?,
        NUM_BURY_VOTES = ?,
        NUM_UNWANTED_VOTES = ?,
        NUM_REPLIES_VISIBLE = ?,
        NUM_REPLIES_TOTAL = ?,
        num_posts_total = ?,
        NUM_OP_LIKE_VOTES = ?,
        NUM_OP_WRONG_VOTES = ?,
        NUM_OP_BURY_VOTES = ?,
        NUM_OP_UNWANTED_VOTES = ?,
        NUM_OP_REPLIES_VISIBLE = ?,
        answered_at = ?,
        ANSWER_POST_ID = ?,
        PLANNED_AT = ?,
        started_at = ?,
        DONE_AT = ?,
        CLOSED_AT = ?,
        LOCKED_AT = ?,
        FROZEN_AT = ?,
        hidden_at = ?,
        deleted_at = ?,
        html_tag_css_classes = ?,
        html_head_title = ?,
        html_head_description = ?,
        NUM_CHILD_PAGES = ?
      where SITE_ID = ? and PAGE_ID = ?
      """

    val numChangedRows = db.update(sql, values)

    if (numChangedRows == 0)
      throw DbDao.PageNotFoundByIdException( siteId, newMeta.pageId)
    if (2 <= numChangedRows)
      die("DwE4Ikf1")
  }


  def movePages(pageIds: Seq[PageId], fromFolder: String, toFolder: String) {
    transactionCheckQuota { implicit connection =>
      _movePages(pageIds, fromFolder = fromFolder, toFolder = toFolder)
    }
  }


  private def _movePages(pageIds: Seq[PageId], fromFolder: String,
        toFolder: String)(implicit connection: js.Connection) {
    unimplemented("Moving pages and updating page_paths3.CANONICAL")
    /*
    if (pageIds isEmpty)
      return

    // Valid folder paths?
    PagePath.checkPath(folder = fromFolder)
    PagePath.checkPath(folder = toFolder)

    // Escape magic regex chars in folder name — we're using `fromFolder` as a
    // regex. (As of 2012-09-24, a valid folder path contains no regex chars,
    // so this won't restrict which folder names are allowed.)
    if (fromFolder.intersect(MagicRegexChars).nonEmpty)
      illArgErr("DwE93KW18", "Regex chars found in fromFolder: "+ fromFolder)
    val fromFolderEscaped = fromFolder.replace(".", """\.""")

    // Use Postgres' REGEXP_REPLACE to replace only the first occurrance of
    // `fromFolder`.
    val sql = """
      update page_paths3
      set PARENT_FOLDER = REGEXP_REPLACE(PARENT_FOLDER, ?, ?)
      where SITE_ID = ?
        and PAGE_ID in (""" + makeInListFor(pageIds) + ")"
    val values = fromFolderEscaped :: toFolder :: siteId :: pageIds.toList

    db.update(sql, values)
    */
  }


  def moveRenamePage(pageId: PageId,
        newFolder: Option[String], showId: Option[Boolean],
        newSlug: Option[String]): PagePath = {
    transactionCheckQuota { implicit connection =>
      moveRenamePageImpl(pageId, newFolder = newFolder, showId = showId,
         newSlug = newSlug)
    }
  }


  def loadSite(): Option[Site] = {
    asSystem.loadSitesWithIds(List(siteId)).headOption
  }


  def loadHostsInclDetails(): Seq[SiteHostInclDetails] = {
    val query = """
      select host, canonical, ctime
      from hosts3
      where site_id = ?
      """
    runQueryFindMany(query, List(siteId.asAnyRef), rs => {
      SiteHostInclDetails(
        rs.getString("host"),
        _toTenantHostRole(rs.getString("canonical")),
        getWhen(rs, "ctime"))
    })
  }


  def insertSiteHost(host: SiteHost) {
    asSystem.insertSiteHost(siteId, host)
  }


  def createUnknownUser() {
    val statement = s"""
      insert into users3(
        site_id, user_id, created_at, full_name, guest_email_addr, guest_browser_id)
      values (
        ?, $UnknownUserId, ?, '$UnknownUserName', '-', '$UnknownUserBrowserId')
      """
    runUpdate(statement, List(siteId.asAnyRef, now.toJavaDate))
  }


  def updateSite(changedSite: Site) {  // xx rm?
    val currentSite = loadSite().getOrDie("EsE7YKW2", s"Site $siteId not found")
    require(changedSite.id == this.siteId,
      "Cannot change site id [DwE32KB80]")
    require(changedSite.creatorIp == currentSite.creatorIp,
      "Cannot change site creator IP [DwE3BK777]")

    val sql = """
      update sites3
      set status = ?, NAME = ?
      where ID = ?"""
    val values =
      List(changedSite.status.toInt.asAnyRef, changedSite.name, siteId.asAnyRef)

    try runUpdate(sql, values)
    catch {
      case ex: js.SQLException =>
        if (!isUniqueConstrViolation(ex)) throw ex
        throw SiteAlreadyExistsException(changedSite)
    }
  }


  def updateHost(host: SiteHost) {
    val newRoleChar = host.role match {
      case SiteHost.RoleCanonical => "C"
      case SiteHost.RoleDuplicate => "D"
      case SiteHost.RoleRedirect => "R"
      case SiteHost.RoleLink => "L"
    }
    val statement = s"""
      update hosts3 set canonical = ?
      where site_id = ? and host = ?
      """
    runUpdateExactlyOneRow(statement, List(newRoleChar, siteId.asAnyRef, host.hostname))
  }


  def changeCanonicalHostRoleToExtra() {
    val statement = s"""
      update hosts3 set canonical = 'D'
      where site_id = ? and canonical = 'C'
      """
    runUpdateExactlyOneRow(statement, List(siteId.asAnyRef))
  }


  def changeExtraHostsRole(newRole: SiteHost.Role) {
    val letter =
      if (newRole == SiteHost.RoleDuplicate) "D"
      else if (newRole == SiteHost.RoleRedirect) "R"
      else die("EsE3KP34I6")
    val statement = s"""
      update hosts3 set canonical = ?
      where site_id = ? and canonical in ('D', 'R')
      """
    runUpdate(statement, List(letter, siteId.asAnyRef))
  }


  override def loadSiteVersion(): Int = {
    val query = s"""
      select version from sites3 where id = ?
      """
    runQuery(query, List(siteId.asAnyRef), rs => {
      if (!rs.next())
        die("DwE4KGY7")

      rs.getInt("version")
    })
  }


  def bumpSiteVersion() {
    val sql = """
      update sites3 set version = version + 1 where id = ?
      """
    transactionAllowOverQuota { implicit connection =>
      db.update(sql, List(siteId.asAnyRef))
    }
  }


  def checkPagePath(pathToCheck: PagePath): Option[PagePath] = {
    _findCorrectPagePath(pathToCheck)
  }

  def listPagePaths(
    pageRanges: PathRanges,
    includeStatuses: List[PageStatus],
    orderOffset: PageOrderOffset,
    limit: Int): Seq[PagePathAndMeta] = {

    require(1 <= limit)
    require(pageRanges.pageIds isEmpty) // for now

    val statusesToInclStr =
      includeStatuses.map(_toFlag).mkString("'", "','", "'")
    if (statusesToInclStr isEmpty)
      return Nil

    val orderByStr = orderOffset match {
      case PageOrderOffset.ByPath =>
        " order by t.PARENT_FOLDER, t.SHOW_ID, t.PAGE_SLUG"
      case PageOrderOffset.ByPublTime =>
        // For now: (CACHED_PUBL_TIME not implemented)
        " order by t.CDATI desc"
      case _ =>
        // now I've added a few new sort orders, but this function is
        // hardly used any more anyway, so don't impnement.
        unimplemented("DwE582WR0")
    }

    val (pageRangeClauses, pageRangeValues) = _pageRangeToSql(pageRanges)

    val filterStatusClauses =
      if (includeStatuses.contains(PageStatus.Draft)) "true"
      else "g.PUBLISHED_AT is not null"

    val values = siteId.asAnyRef :: pageRangeValues
    val sql = s"""
        select t.PARENT_FOLDER,
            t.PAGE_ID,
            t.SHOW_ID,
            t.PAGE_SLUG,
            ${_PageMetaSelectListItems}
        from page_paths3 t left join pages3 g
          on t.SITE_ID = g.SITE_ID and t.PAGE_ID = g.PAGE_ID
        where t.CANONICAL = 'C'
          and t.SITE_ID = ?
          and ($pageRangeClauses)
          and ($filterStatusClauses)
          and g.PAGE_ROLE <> 'SP' -- skip Special Content
        $orderByStr
        limit $limit"""

    var items = List[PagePathAndMeta]()

    runQuery(sql, values, rs => {
      while (rs.next) {
        val pagePath = _PagePath(rs, siteId)
        val pageMeta = _PageMeta(rs, pagePath.pageId.get)
        items ::= PagePathAndMeta(pagePath, pageMeta)
      }
    })
    items.reverse
  }


  def saveUnsentEmailConnectToNotfs(email: Email, notfs: Seq[Notification]) {
    // Allow over quota, so you're over quota emails get sent.
    transactionAllowOverQuota { implicit connection =>
      _saveUnsentEmail(email)
      updateNotificationConnectToEmail(notfs, Some(email))
    }
  }


  def saveUnsentEmail(email: Email) {
    // Allow over quota, so you're over quota emails get sent.
    transactionAllowOverQuota { _saveUnsentEmail(email)(_) }
  }


  private def _saveUnsentEmail(email: Email)
        (implicit connection: js.Connection) {
    require(email.id != "?")
    require(email.failureText isEmpty)
    require(email.providerEmailId isEmpty)
    require(email.sentOn isEmpty)

    val vals = List(siteId.asAnyRef, email.id, email.tyype.toInt.asAnyRef, email.sentTo,
      email.toUserId.orNullInt,
      d2ts(email.createdAt), email.subject, email.bodyHtmlText)

    db.update("""
      insert into emails_out3(
        SITE_ID, ID, TYPE, SENT_TO, TO_USER_ID, CREATED_AT, SUBJECT, BODY_HTML)
      values (
        ?, ?, ?, ?, ?, ?, ?, ?)
      """, vals)
  }


  def updateSentEmail(email: Email) {
    transactionAllowOverQuota { implicit connection =>
      val sentOn = email.sentOn.map(d2ts(_)) getOrElse NullTimestamp
      // 'O' means Other, use for now.
      val failureType = email.failureText.isDefined ?
         ("O": AnyRef) | (NullVarchar: AnyRef)
      val failureTime = email.failureText.isDefined ?
         (sentOn: AnyRef) | (NullTimestamp: AnyRef)

      val vals = List(
        sentOn, email.providerEmailId.orNullVarchar,
        failureType, email.failureText.orNullVarchar, failureTime,
        siteId.asAnyRef, email.id)

      db.update("""
        update emails_out3
        set SENT_ON = ?, PROVIDER_EMAIL_ID = ?,
            FAILURE_TYPE = ?, FAILURE_TEXT = ?, FAILURE_TIME = ?
        where SITE_ID = ? and ID = ?
        """, vals)
    }
  }

  val EmailSelectListItems: String = o"""
      id, TYPE, SENT_TO, TO_USER_ID, SENT_ON, CREATED_AT, SUBJECT,
        BODY_HTML, PROVIDER_EMAIL_ID, FAILURE_TEXT
      """

  def loadEmailById(emailId: String): Option[Email] = {
    val query = s"""
      select $EmailSelectListItems
      from emails_out3
      where SITE_ID = ? and ID = ?
      """
    runQueryFindOneOrNone(query, List(siteId.asAnyRef, emailId), rs => {
      getEmail(rs)
    })
  }


  def loadEmailsSentTo(userIds: Set[UserId], after: When, emailType: EmailType)
        : Map[UserId, Seq[Email]] = {
    if (userIds.isEmpty)
      return Map.empty

    val query = s"""
      select $EmailSelectListItems
      from emails_out3
      where site_id = ?
        and sent_on > ?
        and type = ?
        and to_user_id in (${makeInListFor(userIds)})
      """
    val values =
      siteId.asAnyRef :: after.toJavaDate :: emailType.toInt.asAnyRef ::
        userIds.map(_.asAnyRef).toList

    runQueryBuildMultiMap(query, values, rs => {
      val email = getEmail(rs)
      val toUserId = email.toUserId.getOrDie("EdE4JKR27")
      toUserId -> email
    })
  }


  private def getEmail(rs: ResultSet): Email = {
    val emailId = rs.getString("id")
    val emailTypeInt = rs.getInt("type")
    val emailType = EmailType.fromInt(emailTypeInt) getOrElse throwBadDatabaseData(
      "EdE840FSIE", s"Bad email type: $emailTypeInt, email id: $siteId:$emailId")
    Email(
      id = emailId,
      tyype = emailType,
      sentTo = rs.getString("sent_to"),
      toUserId = getOptInt(rs, "to_user_id"),
      sentOn = getOptionalDate(rs, "sent_on"),
      createdAt = getDate(rs, "created_at"),
      subject = rs.getString("subject"),
      bodyHtmlText = rs.getString("body_html"),
      providerEmailId = Option(rs.getString("provider_email_id")),
      failureText = Option(rs.getString("failure_text")))
  }


  def forgetEmailSentToAddress(userId: UserId, replaceWithAddr: String) {
    TESTS_MISSING
    val statement = """
      update emails_out3 set sent_to = ?
      where to_user_id = ? and site_id = ?
      """
    val values = List[AnyRef](replaceWithAddr, userId.asAnyRef, siteId.asAnyRef)
    runUpdate(statement, values)
  }


  def loadPagePath(pageId: PageId): Option[PagePath] =
    lookupPagePathImpl(pageId)


  def lookupPagePathImpl(pageId: PageId): Option[PagePath] =
    lookupPagePathsImpl(pageId, loadRedirects = false).headOption


  def lookupPagePathAndRedirects(pageId: PageId): List[PagePath] =
    lookupPagePathsImpl(pageId, loadRedirects = true)


  private def lookupPagePathsImpl(pageId: PageId, loadRedirects: Boolean): List[PagePath] = {
    val andOnlyCanonical = if (loadRedirects) "" else "and CANONICAL = 'C'"
    val values = List(siteId.asAnyRef, pageId)
    val sql = s"""
      select PARENT_FOLDER, SHOW_ID, PAGE_SLUG,
        -- For debug assertions:
        CANONICAL, CANONICAL_DATI
      from page_paths3
      where SITE_ID = ? and PAGE_ID = ? $andOnlyCanonical
      order by $CanonicalLast, CANONICAL_DATI asc"""

    var pagePaths = List[PagePath]()

    runQuery(sql, values, rs => {
      var debugLastIsCanonical = false
      var debugLastCanonicalDati = new ju.Date(0)
      while (rs.next) {
        // Assert that there are no sort order bugs.
        assert(!debugLastIsCanonical)
        debugLastIsCanonical = rs.getString("CANONICAL") == "C"
        val canonicalDati = getDate(rs, "CANONICAL_DATI")
        assert(canonicalDati.getTime > debugLastCanonicalDati.getTime)
        debugLastCanonicalDati = canonicalDati

        pagePaths ::= _PagePath(rs, siteId, pageId = Some(Some(pageId)))
      }
      assert(debugLastIsCanonical || pagePaths.isEmpty)
    })

    pagePaths
  }


  // Sort order that places the canonical row first.
  // ('C'anonical is before 'R'edirect.)
  val CanonicalFirst = "CANONICAL asc"

  val CanonicalLast = "CANONICAL desc"


  // Looks up the correct PagePath for a possibly incorrect PagePath.
  private def _findCorrectPagePath(pagePathIn: PagePath): Option[PagePath] = {
    var query = """
        select PARENT_FOLDER, PAGE_ID, SHOW_ID, PAGE_SLUG, CANONICAL
        from page_paths3
        where SITE_ID = ?
        """

    var binds = List[AnyRef](pagePathIn.siteId.asAnyRef)
    pagePathIn.pageId match {
      case Some(id) =>
        query += s" and PAGE_ID = ? order by $CanonicalFirst"
        binds ::= id.asAnyRef
      case None =>
        // SHOW_ID = 'F' means that the page page id must not be part
        // of the page url. ((So you cannot look up [a page that has its id
        // as part of its url] by searching for its url without including
        // the id. Had that been possible, many pages could have been found
        // since pages with different ids can have the same name.
        // Hmm, could search for all pages, as if the id hadn't been
        // part of their name, and list all pages with matching names?))
        query += """
            and SHOW_ID = 'F'
            and (
              (PARENT_FOLDER = ? and PAGE_SLUG = ?)
            """
        binds ::= pagePathIn.folder
        binds ::= e2d(pagePathIn.pageSlug)
        // Try to correct bad URL links.
        // COULD skip (some of) the two if tests below, if action is ?newpage.
        // (Otherwise you won't be able to create a page in
        // /some/path/ if /some/path already exists.)
        if (pagePathIn.pageSlug nonEmpty) {
          // Perhaps the correct path is /folder/page/ not /folder/page.
          // Try that path too. Choose sort orter so /folder/page appears
          // first, and skip /folder/page/ if /folder/page is found.
          query += s"""
              or (PARENT_FOLDER = ? and PAGE_SLUG = '-')
              )
            order by length(PARENT_FOLDER) asc, $CanonicalFirst
            """
          binds ::= pagePathIn.folder + pagePathIn.pageSlug +"/"
        }
        else if (pagePathIn.folder.count(_ == '/') >= 2) {
          // Perhaps the correct path is /folder/page not /folder/page/.
          // But prefer /folder/page/ if both pages are found.
          query += s"""
              or (PARENT_FOLDER = ? and PAGE_SLUG = ?)
              )
            order by length(PARENT_FOLDER) desc, $CanonicalFirst
            """
          val perhapsPath = pagePathIn.folder.dropRight(1)  // drop `/'
          val lastSlash = perhapsPath.lastIndexOf("/")
          val (shorterPath, nonEmptyName) = perhapsPath.splitAt(lastSlash + 1)
          binds ::= shorterPath
          binds ::= nonEmptyName
        }
        else {
          query += s"""
              )
            order by $CanonicalFirst
            """
        }
    }

    val (correctPath: PagePath, isCanonical: Boolean) =
      runQuery(query, binds.reverse, rs => {
        if (!rs.next)
          return None
        var correctPath = PagePath(
            siteId = pagePathIn.siteId,
            folder = rs.getString("PARENT_FOLDER"),
            pageId = Some(rs.getString("PAGE_ID")),
            showId = rs.getString("SHOW_ID") == "T",
            // If there is a root page ("serveraddr/") with no name,
            // it is stored as a single space; s2e removes such a space:
            pageSlug = d2e(rs.getString("PAGE_SLUG")))
        val isCanonical = rs.getString("CANONICAL") == "C"
        (correctPath, isCanonical)
      })

    if (!isCanonical) {
      // We've found a page path that's been inactivated and therefore should
      // redirect to the currently active path to the page. Find that other
      // path (the canonical path), by page id.
      dieIf(correctPath.pageId.isEmpty,
          "TyE31RG5", s"s$siteId: Page id not found when looking up $pagePathIn")
      return _findCorrectPagePath(correctPath)
    }

    Some(correctPath)
  }


  def insertPageMetaMarkSectionPageStale(pageMeta: PageMeta, isImporting: Boolean) {
    require(pageMeta.createdAt == pageMeta.updatedAt, "DwE2EGPF8")

    // Publ date can be in the future, also if creating new page.
    pageMeta.publishedAt.foreach(publAt =>
      require(pageMeta.createdAt.getTime <= publAt.getTime, "DwE6GKPE3"))

    if (isImporting) {
      pageMeta.bumpedAt.foreach(bumpedAt =>
        require(pageMeta.createdAt.getTime <= bumpedAt.getTime, "TyEBMPD924B4"))
    }
    else {
      // Page cannot have been bumped yet, since it's getting created now.
      require(pageMeta.bumpedAt.isEmpty, "TyE2AKB40F")
    }

    require(pageMeta.numOrigPostLikeVotes == 0, "DwE4KPE8")
    require(pageMeta.numOrigPostWrongVotes == 0, "DwE2PKFE9")
    require(pageMeta.numOrigPostBuryVotes == 0, "DwE44KP5")
    require(pageMeta.numOrigPostUnwantedVotes == 0, "DwE2WKU7")
    require(pageMeta.numOrigPostRepliesVisible == 0, "DwE5PWZ1")
    require(pageMeta.answeredAt.isEmpty, "DwE2KFY9")
    require(pageMeta.answerPostUniqueId.isEmpty, "DwE5FKEW0")
    // plannedAt is defined for to-do pages: they're an Idea, in planned status.
    require(pageMeta.startedAt.isEmpty, "EdE5RAQW0")
    require(pageMeta.doneAt.isEmpty, "DwE4KPW2")
    require(pageMeta.closedAt.isEmpty, "DwE8UKW2")
    require(pageMeta.lockedAt.isEmpty, "DwE3KWY2")
    require(pageMeta.frozenAt.isEmpty, "DwE3KFY2")

    val sql = """
      insert into pages3 (
         SITE_ID, PAGE_ID, version, PAGE_ROLE, category_id, EMBEDDING_PAGE_URL,
         CREATED_AT, UPDATED_AT, PUBLISHED_AT, BUMPED_AT, hidden_at, AUTHOR_ID,
         PLANNED_AT, num_posts_total, layout, PIN_ORDER, PIN_WHERE)
      values (
         ?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?, ?)"""

    val values = List[AnyRef](
      siteId.asAnyRef, pageMeta.pageId, pageMeta.version.asAnyRef,
      pageMeta.pageRole.toInt.asAnyRef,
      pageMeta.categoryId.orNullInt,
      pageMeta.embeddingPageUrl.orNullVarchar,
      pageMeta.createdAt.asTimestamp,
      pageMeta.updatedAt.asTimestamp,
      pageMeta.publishedAt.orNullTimestamp,
      pageMeta.bumpedOrPublishedOrCreatedAt.asTimestamp,
      pageMeta.hiddenAt.orNullTimestamp,
      pageMeta.authorId.asAnyRef,
      pageMeta.plannedAt.orNullTimestamp,
      pageMeta.numPostsTotal.asAnyRef,
      pageMeta.layout.toInt.asAnyRef,
      pageMeta.pinOrder.orNullInt,
      pageMeta.pinWhere.map(_.toInt).orNullInt)

    val numNewRows = runUpdate(sql, values)

    dieIf(numNewRows == 0, "DwE4GKPE21")
    dieIf(numNewRows > 1, "DwE45UL8")

    pageMeta.categoryId.foreach(markSectionPageContentHtmlAsStale)
  }


  def insertPagePath(pagePath: PagePath): Unit = {
    insertPagePathOrThrow(pagePath)(theOneAndOnlyConnection)
  }


  private def insertPagePathOrThrow(pagePath: PagePath)(
        implicit conn: js.Connection) {
    illArgErrIf3(pagePath.pageId.isEmpty, "DwE21UY9", s"No page id: $pagePath")
    val showPageId = pagePath.showId ? "T" | "F"
    try {
      db.update("""
        insert into page_paths3 (
          SITE_ID, PARENT_FOLDER, PAGE_ID, SHOW_ID, PAGE_SLUG, CANONICAL)
        values (?, ?, ?, ?, ?, 'C')
        """,
        List(pagePath.siteId.asAnyRef, pagePath.folder, pagePath.pageId.get,
          showPageId, e2d(pagePath.pageSlug)))(conn)
    }
    catch {
      case ex: js.SQLException if isUniqueConstrViolation(ex) =>
        val mess = ex.getMessage.toUpperCase
        if (mess.contains("DW1_PGPTHS_PATH_NOID_CNCL__U")) {
          // There's already a page path where we attempt to insert
          // the new path.
          throw PathClashException(
            pagePath.copy(pageId = None), newPagePath = pagePath)
        }
        if (ex.getMessage.contains("DW1_PGPTHS_TNT_PGID_CNCL__U")) {
          // Race condition. Another session just moved this page, that is,
          // inserted a new 'C'anonical row. There must be only one such row.
          // This probably means that two admins attempted to move pageId
          // at the same time (or that longer page ids should be generated).
          // Details:
          // 1. `moveRenamePageImpl` deletes any 'C'anonical rows before
          //  it inserts a new 'C'anonical row, so unless another session
          //  does the same thing inbetween, this error shouldn't happen.
          // 2 When creating new pages: Page ids are generated randomly,
          //  and are fairly long, unlikely to clash.
          throw new ju.ConcurrentModificationException(
            s"Another administrator/moderator apparently just added a path" +
            s" to this page: ${pagePath.value}, id `${pagePath.pageId.get}'." +
            s" (Or the server needs to generate longer page ids.)")
        }
        throw ex
    }
  }


  /* Currently no longer needed, but keep for a while?
  /**
   * Moves the page at pagePath to the location where it was placed before
   * it was moved to pagePath. Returns that location, or does nothing and
   * returns None, if there is no such location.
   */
  def movePageToItsPreviousLocation(pagePath: PagePath): Option[PagePath] = {
    transactionCheckQuota { implicit connection =>
      movePageToItsPreviousLocationImpl(pagePath)
    }
  }


  def movePageToItsPreviousLocationImpl(pagePath: PagePath)(
        implicit connection: js.Connection): Option[PagePath] = {
    val pageId = pagePath.pageId getOrElse {
      _findCorrectPagePath(pagePath).flatMap(_.pageId).getOrElse(
        throw PageNotFoundByPathException(pagePath))
    }
    val allPathsToPage = lookupPagePathsImpl(pageId, loadRedirects = true)
    if (allPathsToPage.length < 2)
      return None
    val allRedirects = allPathsToPage.tail
    val mostRecentRedirect = allRedirects.head
    moveRenamePageImpl(mostRecentRedirect)
    Some(mostRecentRedirect)
  }
   */


  private def moveRenamePageImpl(pageId: PageId,
        newFolder: Option[String], showId: Option[Boolean],
        newSlug: Option[String])
        (implicit conn: js.Connection): PagePath = {

    // Verify new path is legal.
    PagePath.checkPath(siteId = siteId, pageId = Some(pageId),
      folder = newFolder getOrElse "/", pageSlug = newSlug getOrElse "")

    val currentPath: PagePath = lookupPagePathImpl(pageId) getOrElse (
          throw PageNotFoundByIdException(siteId, pageId))

    val newPath = {
      var path = currentPath
      newFolder foreach { folder => path = path.copy(folder = folder) }
      showId foreach { show => path = path.copy(showId = show) }
      newSlug foreach { slug => path = path.copy(pageSlug = slug) }
      path
    }

    if (newPath != currentPath) {
      moveRenamePageImpl(newPath)

      val resultingPath = lookupPagePathImpl(pageId)
      dieIf(resultingPath isNot newPath,
        "TyE31ZB0", s"s$siteId: Resulting path: $resultingPath, and intended path: " +
          s"$newPath, are different")
    }

    newPath
  }


  def moveRenamePage(newPath: PagePath) {
    transactionCheckQuota { implicit connection =>
      moveRenamePageImpl(newPath)
    }
  }


  private def moveRenamePageImpl(newPath: PagePath)
        (implicit conn: js.Connection) {

    val pageId = newPath.pageId getOrElse
      illArgErr("DwE37KZ2", s"Page id missing: $newPath")

    // Lets do this:
    // 1. Set all current paths to pageId to CANONICAL = 'R'edirect
    // 2. Delete any 'R'edirecting path that clashes with the new path
    //    we're about to save (also if it points to pageId).
    // 3. Insert the new path.
    // 4. If the insertion fails, abort; this means we tried to overwrite
    //    a 'C'anonical path to another page (which we shouldn't do,
    //    because then that page would no longer be reachable).

    def changeExistingPathsToRedirects(pageId: PageId) {
      val vals = List(siteId.asAnyRef, pageId)
      val stmt = """
        update page_paths3
        set CANONICAL = 'R'
        where SITE_ID = ? and PAGE_ID = ?
        """
      val numRowsChanged = db.update(stmt, vals)
      if (numRowsChanged == 0)
        throw PageNotFoundByIdException(siteId, pageId, details = Some(
          "It seems all paths to the page were deleted moments ago"))
    }

    def deleteAnyExistingRedirectFrom(newPath: PagePath) {
      val showPageId = newPath.showId ? "T" | "F"
      var vals = List(siteId.asAnyRef, newPath.folder, e2d(newPath.pageSlug), showPageId)
      var stmt = """
        delete from page_paths3
        where SITE_ID = ? and PARENT_FOLDER = ? and PAGE_SLUG = ?
          and SHOW_ID = ? and CANONICAL = 'R'
        """
      if (newPath.showId) {
        // We'll find at most one row, and it'd be similar to the one
        // we intend to insert, except for 'R'edirect not 'C'anonical.
        stmt = stmt + " and PAGE_ID = ?"
        vals = vals ::: List(pageId)
      }
      val numRowsDeleted = db.update(stmt, vals)
      dieIf(1 < numRowsDeleted && newPath.showId, "TyE09IJ7")
    }

    changeExistingPathsToRedirects(pageId)
    deleteAnyExistingRedirectFrom(newPath)
    insertPagePathOrThrow(newPath)
  }

}




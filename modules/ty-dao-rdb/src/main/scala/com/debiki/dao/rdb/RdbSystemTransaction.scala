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
import org.flywaydb.core.Flyway
import scala.collection.{immutable, mutable}
import scala.collection.mutable.ArrayBuffer
import Rdb._
import RdbUtil._



class RdbSystemTransaction(
  val daoFactory: RdbDaoFactory,
  val now: When,
  val allSitesWriteLocked: Bo,
  )
  extends SystemTransaction with CreateSiteSystemDaoMixin {


  def db: Rdb = daoFactory.db


  /** If set, should be the only connection that this dao uses. Some old code doesn't
    * create it though, then different connections are used instead :-(
    * I'll rename it to 'connection', when all that old code is gone and there's only
    * one connection always.
    */
  // COULD move to new superclass?
  def theOneAndOnlyConnection: js.Connection = {
    if (transactionEnded)
      throw new IllegalStateException("Transaction has ended [DwE5KD3W2]")
    _theOneAndOnlyConnection getOrElse {
      die("DwE4HKG81")
    }
  }
  private var _theOneAndOnlyConnection: Option[js.Connection] = None

  // COULD move to new superclass?
  private var transactionEnded = false

  def setTheOneAndOnlyConnection(connection: js.Connection) {
    require(_theOneAndOnlyConnection.isEmpty, "DwE7PKF2")
    _theOneAndOnlyConnection = Some(connection)
  }

  def createTheOneAndOnlyConnection(readOnly: Boolean) {
    require(_theOneAndOnlyConnection.isEmpty, "DwE8PKW2")
    _theOneAndOnlyConnection = Some(
          db.getConnection(readOnly, mustBeSerializable = true))
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
  }


  // COULD move to new superclass?
  def runQuery[R](query: String, values: List[AnyRef], resultSetHandler: js.ResultSet => R): R = {
    db.query(query, values, resultSetHandler)(theOneAndOnlyConnection)
  }


  // COULD move to new superclass? Dupl code [8FKW20Q]
  def runQueryFindExactlyOne[R](query: String, values: List[AnyRef],
        singleRowHandler: js.ResultSet => R): R = {
    runQuery(query, values, rs => {
      dieIf(!rs.next(), "EsE5PLKW2")
      val result = singleRowHandler(rs)
      dieIf(rs.next(), "DwE4GYKZZ02")
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
        dieIf(rs.next(), "TyE6GMY9" + (if (debugCode eq null) "" else '-' + debugCode))
        Some(result)
      }
    })
  }


  // COULD move to new superclass? Dupl code [8FKW20Q]
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



  // COULD move to new superclass?
  def runUpdate(statement: String, values: List[AnyRef] = Nil): Int = {
    db.update(statement, values)(theOneAndOnlyConnection)
  }

  def runUpdateSingleRow(statement: String, values: List[AnyRef] = Nil): Boolean = {
    val numRowsUpdated = runUpdate(statement, values)
    dieIf(numRowsUpdated > 1, "TyE2KESW7", o"""This statement modified $numRowsUpdated rows
          but should have modified one row only: $statement""")
    numRowsUpdated == 1
  }


  override def siteTransaction(siteId: SiteId): SiteTransaction = {
    val siteTransaction = new RdbSiteTransaction(siteId, daoFactory, now)
    siteTransaction.setTheOneAndOnlyConnection(theOneAndOnlyConnection)
    siteTransaction
  }


  /** Creates a site specific dao. */
  def newSiteDao(siteId: SiteId): RdbSiteTransaction = {
    // The site dao should use the same transaction connection, if we have any;
    dieIf(_theOneAndOnlyConnection ne null, "DwE6KEG3")
    dieIf(transactionEnded, "EsE5MGUW2")
    new RdbSiteTransaction(siteId, daoFactory, now)
  }


  def loadUsers(userIdsByTenant: Map[SiteId, immutable.Seq[UserId]]): Map[(SiteId, UserId), Participant] = {
    var idCount = 0

    def incIdCount(ids: List[UserId]) {
      val len = ids.length
      idCount += len
    }

    def makeSingleSiteQuery(siteId: SiteId, idsAu: List[UserId]): (String, List[AnyRef]) = {
      incIdCount(idsAu)
      val inList = idsAu.map(_ => "?").mkString(",")
      val q = s"""
         select u.SITE_ID, $UserSelectListItemsWithGuests
         from users3 u
         left join guest_prefs3 e on u.site_id = e.site_id and u.guest_email_addr = e.email
         where u.SITE_ID = ?
         and u.USER_ID in (""" + inList +")"
      (q, siteId.asAnyRef :: idsAu.map(_.asAnyRef))
    }

    val totalQuery = mutable.StringBuilder.newBuilder
    var allValsReversed = List[AnyRef]()

    def growQuery(moreQueryAndVals: (String, List[AnyRef])) {
      if (totalQuery.nonEmpty)
        totalQuery ++= " union "
      totalQuery ++= moreQueryAndVals._1
      allValsReversed = moreQueryAndVals._2.reverse ::: allValsReversed
    }

    // Build query.
    for ((siteId, userIds) <- userIdsByTenant.toList) {
      if (userIds.nonEmpty) {
        growQuery(makeSingleSiteQuery(siteId, userIds.toList))
      }
    }

    if (idCount == 0)
      return Map.empty

    var usersByTenantAndId = Map[(SiteId, UserId), Participant]()

    runQuery(totalQuery.toString, allValsReversed.reverse, rs => {
      while (rs.next) {
        val siteId = rs.getInt("SITE_ID")
        val user = getParticipant(rs)
        usersByTenantAndId = usersByTenantAndId + ((siteId, user.id) -> user)
      }
    })

    usersByTenantAndId
  }


  def loadSiteByName(name: String): Option[Site] = {
    loadSiteByWhat(name = name)
  }


  def loadSiteByPubId(pubId: PubSiteId): Option[Site] = {
    loadSiteByWhat(pubId = pubId)
  }


  private def loadSiteByWhat(pubId: PubSiteId = null, name: String = null): Option[Site] = {
    val (what, value) =
          if (pubId ne null) ("publ_id", pubId)
          else if (name ne null) ("name", name)
          else die("TyE06#KSDKHR")

    val query = s"select * from sites3 where $what = ?"
    runQueryFindOneOrNone(query, List(value), rs => {
      val siteId = rs.getInt("id")
      val hostsBySiteId = loadHosts(Seq(siteId))
      val hosts = hostsBySiteId.getOrElse(siteId, Nil)
      getSite(rs, hosts)
    })
  }


  def loadSitesByIds(siteIds: Seq[SiteId]): Seq[Site] =
    loadSitesImpl(siteIds)


  private def loadHosts(siteIds: Seq[SiteId] = Nil, all: Boolean = false)
        : Map[SiteId, List[HostnameInclDetails]] = {
    if (siteIds.isEmpty && !all)
      return Map.empty

    require(siteIds.nonEmpty != all)

    var hostsBySiteId = Map[SiteId, List[HostnameInclDetails]]().withDefaultValue(Nil)
    var hostsQuery = "select SITE_ID, HOST, CANONICAL, ctime from hosts3"
    var hostsValues: List[AnyRef] = Nil
    if (!all) {
      hostsQuery += s" where site_id in (${ makeInListFor(siteIds) })"
      hostsValues = siteIds.map(_.asAnyRef).toList
    }
    runQuery(hostsQuery, hostsValues, rs => {
        while (rs.next) {
          val siteId = rs.getInt("SITE_ID")
          var hosts = hostsBySiteId(siteId)
          hosts ::= HostnameInclDetails(
             hostname = rs.getString("HOST"),
             role = _toTenantHostRole(rs.getString("CANONICAL")),
             addedAt = getWhen(rs, "ctime"))
          hostsBySiteId = hostsBySiteId.updated(siteId, hosts)
        }
      })
    hostsBySiteId
  }


  private def loadSitesImpl(siteIds: Seq[SiteId] = Nil, all: Bo = false): Seq[Site] = {
    if (siteIds.isEmpty && !all)
      return Nil

    require(siteIds.nonEmpty != all, "Both site ids and all = true [TyE40RKSH2]")

    val hostsBySiteId: Map[SiteId, List[HostnameInclDetails]] = loadHosts(siteIds, all)

    val (whereIdsIn, values) =
        if (all) ("", Nil)
        else (
          s"where id in (${ makeInListFor(siteIds) })",
          siteIds.toList.map(_.asAnyRef))

    var sitesQuery = s"""
      select
          id,
          publ_id,
          status,
          name,
          feature_flags_c,
          ctime,
          creator_ip,
          creator_email_address
      from sites3
      $whereIdsIn
      """

    runQueryFindMany(sitesQuery, values, rs => {
      val siteId = rs.getInt("ID")
      val hosts = hostsBySiteId(siteId)
      val site = getSite(rs, hosts)
      dieIf(site.id != siteId, "TyE60RKDHN5")
      site
    })
  }


  def loadAllSitesInclDetails(): immutable.Seq[SiteInclDetails] = {
    val hostsBySiteId: Map[SiteId, List[HostnameInclDetails]] = loadHosts(all = true)
    val query = "select * from sites3"
    runQueryFindMany(query, Nil, rs => {
      val siteId = rs.getInt("id")
      val hosts = hostsBySiteId(siteId)
      getSiteInclDetails(rs, hosts)
    })
  }


  def loadSitesDeletedNotPurged(): ImmSeq[SiteInclDetails] = {
    val query = s"select * from sites3 where status = ${SiteStatus.Deleted.toInt}"
    loadSitesAndHosts(query, values = Nil)
  }


  private def loadSitesAndHosts(query: St, values: List[AnyRef])
        : ImmSeq[SiteInclDetails] = {
    val sitesNoHosts: ImmSeq[SiteInclDetails] = runQueryFindMany(
          query, values, rs => {
      getSiteInclDetails(rs, hostnames = Nil)
    })
    val hostsBySiteId = loadHosts(sitesNoHosts.map(_.id))
    val sitesWithHosts = sitesNoHosts map { site =>
      site.copy(hostnames = hostsBySiteId.getOrElse(site.id, Nil))
    }
    sitesWithHosts
  }


  def loadSiteInclDetailsById(siteId: SiteId): Option[SiteInclDetails] = {
    val hosts = loadHosts(Seq(siteId)).values.headOption.getOrElse(Nil)
    val query = "select * from sites3 where id = ?"
    runQueryFindOneOrNone(query, List(siteId.asAnyRef), rs => {
      getSiteInclDetails(rs, hosts)
    })
  }


  def updateSites(sites: Seq[SuperAdminSitePatch]) {
    val statement = s"""
       update sites3 set
           status = ?,
           super_staff_notes = ?,
           feature_flags_c = ?
       where id = ?
       """
    for (patch <- sites) {
      val siteId = patch.siteId
      val values = List(
            patch.newStatus.toInt.asAnyRef,
            patch.newNotes.trimOrNullVarchar,
            patch.featureFlags.trimNullVarcharIfBlank,
            siteId.asAnyRef)
      val num = runUpdate(statement, values)
      dieIf(num != 1, "EsE24KF90", s"s$siteId: num = $num when changing site status")
    }
  }


  def lookupCanonicalHost(hostname: String): Option[CanonicalHostLookup] = {
    runQuery("""
        select t.SITE_ID TID,
            t.CANONICAL THIS_CANONICAL,
            c.HOST CANONICAL_HOST
        from hosts3 t -- this host, the one connected to
            left join hosts3 c  -- the cannonical host
            on c.SITE_ID = t.SITE_ID and c.CANONICAL = 'C'
        where t.HOST = ?
        """, List(hostname), rs => {
      if (!rs.next)
        return None

      return Some(CanonicalHostLookup(
        siteId = rs.getInt("TID"),
        thisHost = Hostname(
          hostname = hostname,
          role = _toTenantHostRole(rs.getString("THIS_CANONICAL"))),
        canonicalHost = Hostname(
          hostname = rs.getString("CANONICAL_HOST"),
          role = Hostname.RoleCanonical)))
    })
  }


  def loadStaffForAllSites(): Map[SiteId, Vector[UserInclDetails]] = {
    import Participant.LowestAuthenticatedUserId
    val query = s"""
      select u.site_id, $CompleteUserSelectListItemsWithUserId
      from users3 u
      where (u.is_admin or u.is_moderator)
        and not u.is_group
        and u.user_id >= $LowestAuthenticatedUserId
      """

    val staffBySiteId =
      new mutable.HashMap[SiteId, mutable.Set[UserInclDetails]]
        with mutable.MultiMap[SiteId, UserInclDetails]

    runQuery(query, Nil, rs => {
      while (rs.next) {
        val siteId = rs.getInt("site_id")
        val user = getUserInclDetails(rs)
        staffBySiteId.addBinding(siteId, user)
      }
    })
    Map(staffBySiteId.mapValues(_.toVector).iterator.toSeq: _*)
  }


  def loadStatsForUsersToMaybeEmailSummariesTo(now: When, limit: Int)
        : Map[SiteId, immutable.Seq[UserStats]] = {
    COULD_OPTIMIZE // if there are many sites, might load just one summary email, per site, for
    // 99999 sites —> won't get any batch processing efficiency. Instead, if many sites,
    // first load say 10 people, from all & any sites, ordered by next-summary-at.
    // Then, for the sites found, load 50 more summaries to send, per site.
    // Result: Both correct order (the most "urgenat" ones first), & batch processing benefits.

    // The next-date is set to long-into-the-future, for users that don't want summaries  [5KRDUQ0]
    // or have no email address.  (Don't send summaries to guests.)
    val query = s"""
      select * from user_stats3
      where user_id >= $LowestTalkToMemberId
        and (
          next_summary_maybe_at is null or
          next_summary_maybe_at <= ?)
      order by next_summary_maybe_at
      limit $limit
      """
    runQueryBuildMultiMap(query, List(now.asTimestamp), rs => {
      val siteId = rs.getInt("site_id")
      val stats: UserStats = getUserStats(rs)
      siteId -> stats
    })
  }


  def loadNotificationsToMailOut(delayInMinutes: Int, numToLoad: Int)
        : Map[SiteId, Seq[Notification]] =
    loadNotfsImpl(numToLoad, unseenFirst = false, onlyIfEmailVerifiedOrGuest = true,
        None, delayMinsOpt = Some(delayInMinutes))


  /**
   * Specify:
   * numToLoad + delayMinsOpt --> loads notfs to mail out, for all tenants
   * tenantIdOpt + userIdOpt --> loads that user's notfs
   * tenantIdOpt + emailIdOpt --> loads a single email and notf
   */
  def loadNotfsImpl(limit: Int, unseenFirst: Boolean, onlyIfEmailVerifiedOrGuest: Boolean,
        tenantIdOpt: Option[SiteId] = None,
        delayMinsOpt: Option[Int] = None,
        userIdOpt: Option[UserId] = None,
        emailIdOpt: Option[String] = None,
        skipReviewTaskNotfs: Boolean = false,
        skipDeletedPosts: Boolean = false,
        upToWhen: Option[ju.Date] = None)
        : Map[SiteId, Seq[Notification]] = {

    require(emailIdOpt.isEmpty, "looking up by email id not tested after rewrite")
    require(delayMinsOpt.isEmpty || userIdOpt.isEmpty)
    require(delayMinsOpt.isEmpty || emailIdOpt.isEmpty)
    require(userIdOpt.isEmpty || emailIdOpt.isEmpty)
    require(delayMinsOpt.isDefined != tenantIdOpt.isDefined)
    require(userIdOpt.isEmpty || tenantIdOpt.isDefined)
    require(emailIdOpt.isEmpty || tenantIdOpt.isDefined)
    require(limit > 0)
    require(emailIdOpt.isEmpty || limit == 1)
    require(upToWhen.isEmpty || emailIdOpt.isEmpty, "EsE6wVK8")

    unimplementedIf(upToWhen.isDefined, "Loading notfs <= upToWhen [EsE7GYKF2]")

    val andEmailVerifiedOrGuest =
      if (onlyIfEmailVerifiedOrGuest)
        "and (u.email_verified_at is not null or guest_email_addr is not null)"
      else
        ""

    val maybeSkipReviewTasksAnd =
      if (!skipReviewTaskNotfs) ""
      else s"n.notf_type > ${NotificationType.MaxReviewTaskNotfId} and "

    val (maybeLeftJoinPostsAndPages, maybeSkipDeletedPostsAnd) =  // [SKIPDDNTFS]
      if (!skipDeletedPosts) ("", "")
      else (
        """
         left join posts3 po on
            n.site_id = po.site_id and
            n.unique_post_id = po.unique_post_id
          left join pages3 pg on
            po.site_id = pg.site_id and
            po.page_id = pg.page_id""",
        """
         po.deleted_at is null and
         pg.deleted_at is null and""")

    val baseQueryOpenPara = s"""
      select
        n.site_id, n.notf_id, n.notf_type, n.created_at,
        n.unique_post_id, n.page_id, n.action_type, n.action_sub_id,
        n.by_user_id, n.to_user_id,
        n.email_id, n.email_status, n.seen_at
      from notifications3 n inner join users3 u
        on n.site_id = u.site_id
           and n.to_user_id = u.user_id
           $andEmailVerifiedOrGuest
        $maybeLeftJoinPostsAndPages
      where
        $maybeSkipReviewTasksAnd
        $maybeSkipDeletedPostsAnd ("""

    val (moreWhere, orderBy, values) = (userIdOpt, emailIdOpt) match {
      case (Some(uid), None) =>
        val orderHow =
          if (unseenFirst) {
            // Sync with index dw1_ntfs_seen_createdat__i, created just for this query.
            o"""case when n.seen_at is null then n.created_at + interval '100 years'
              else n.created_at end desc"""
          }
          else
            "n.created_at desc"
        val where = "n.site_id = ? and n.to_user_id = ?"
        val orderBy = s"order by $orderHow"
        val vals = List(tenantIdOpt.get.asAnyRef, uid.asAnyRef)
        (where, orderBy, vals)
      case (None, Some(emailId)) =>
        val where = "n.site_id = ? and n.email_id = ?"
        val vals = List(tenantIdOpt.get.asAnyRef, emailId)
        (where, "", vals)
      case (None, None) =>
        // Load notfs for which emails perhaps are to be sent, for all tenants.
        val where =
          o"""n.email_status = ${NotfEmailStatus.Undecided.toInt}
             and n.created_at <= ?"""
        val orderBy = "order by n.created_at asc"
        val someMinsAgo = new ju.Date(now.millis - delayMinsOpt.get.toLong * 60 * 1000)
        val vals = someMinsAgo::Nil
        (where, orderBy, vals)
      case _ =>
        die("DwE093RI3")
    }

    val query = s"$baseQueryOpenPara $moreWhere ) $orderBy limit $limit"
    var notfsByTenant =
       Map[SiteId, Vector[Notification]]().withDefaultValue(Vector.empty)

    runQuery(query, values, rs => {
      while (rs.next) {
        val siteId = rs.getInt("site_id")
        val notf = getNotification(rs)
        val notfsForTenant: Vector[Notification] = notfsByTenant(siteId)
        notfsByTenant = notfsByTenant + (siteId -> (notfsForTenant :+ notf))
      }
    })

    notfsByTenant
  }


  override def loadCachedPageVersion(sitePageId: SitePageId, renderParams: PageRenderParams)
        : Option[(CachedPageVersion, SitePageVersion)] = {
    val query = """
      select
          (select version from sites3 where id = ?) current_site_version,
          p.version current_page_version,
          h.site_version,
          h.page_version,
          h.app_version,
          h.is_embedded,
          h.width_layout,
          h.origin,
          h.cdn_origin,
          h.react_store_json_hash
      from pages3 p left join page_html3 h
          on p.site_id = h.site_id and p.page_id = h.page_id
      where p.site_id = ?
        and p.page_id = ?
        and h.is_embedded = ?
        and h.width_layout = ?
        and h.origin = ?
        and h.cdn_origin = ?
      """

    val values = List(sitePageId.siteId.asAnyRef, sitePageId.siteId.asAnyRef,
        sitePageId.pageId.asAnyRef, renderParams.isEmbedded.asAnyRef,
        renderParams.widthLayout.toInt.asAnyRef, renderParams.embeddedOriginOrEmpty,
        renderParams.cdnOriginOrEmpty)

    runQueryFindOneOrNone(query, values, rs => {
      val currentSitePageVersion = SitePageVersion(
        rs.getInt("current_site_version"),
        rs.getInt("current_page_version"))
      val cachedPageVersion = getCachedPageVersion(rs)
      (cachedPageVersion, currentSitePageVersion)
    })
  }


  override def loadPageIdsToRerender(limit: Int): Seq[PageIdToRerender] = {
    // In the distant future, will need to optimize the queries here,
    // e.g. add a pages-to-rerender queue table. Or just indexes somehow.

    // First find pages for which there is on cached content html.
    // But not very new pages (more recent than a few minutes) because those pages
    // will likely be rendered by a GET request handling thread any time soon, when
    // they're requested, the first time. See debiki.dao.RenderedPageHtmlDao [5KWC58].
    val pagesNotCached = mutable.Set[PageIdToRerender]()
    val neverRenderedQuery = s""" -- SLOW_QUERY: 4 ms @ Ty.io [rerndr_qry]
      select p.site_id, p.page_id, p.version current_version, h.page_version cached_version
      from pages3 p left join page_html3 h
          on p.site_id = h.site_id and p.page_id = h.page_id
          -- Skip pages that for some (weird) reason aren't reachable via a page path.
          -- (But do include any such pages in the `outOfDateQuery` below? Feels better
          -- to regenerate the html then, since something is there already.)
          inner join page_paths3 pp
              on p.site_id = pp.site_id and p.page_id = pp.page_id and pp.canonical = 'C'
      where h.page_id is null
      and p.created_at < now_utc() - interval '2' minute
      and p.page_role != ${PageType.SpecialContent.toInt}
      limit $limit
      """
    runQuery(neverRenderedQuery, Nil, rs => {
      while (rs.next()) {
        pagesNotCached += getPageIdToRerender(rs)
      }
    })

    // Then pages for which there is cached content html, but it's stale.  [RERENDERQ]
    // Skip pages that should be rerendered because of changed site settings
    // (i.e. site_version differs) or different app_version, because otherwise
    // we'd likely constantly be rerendering exactly all pages and we'd never
    // get done. — Only rerender a page with different site_version or app_version
    // if someone actually views it. This is done by RenderedPageHtmlDao sending
    // a message to the RenderContentService, if the page gets accessed. [4KGJW2]
    val pagesStale = mutable.Set[PageIdToRerender]()
    if (pagesNotCached.size < limit) {
      val outOfDateQuery = s""" -- SLOW_QUERY: 9 ms @ Ty.io  [rerndr_qry]
        select p.site_id, p.page_id, p.version current_version, h.page_version cached_version
        from pages3 p inner join page_html3 h
            on p.site_id = h.site_id and p.page_id = h.page_id and p.version > h.page_version
        -- Don't rerender embedded comments pages. It's a bit tricky to lookup their origin,
        -- which needs to be included [EMBCMTSORIG]. And it's ok if it takes a second extra to
        -- load an embedded comments page because it gets rendered on demand: the user will start
        -- with looking at the blog post/article, won't care about the comments until later, right.
        -- Do need to match the cdn origin though.
        where p.page_role <> ${PageType.EmbeddedComments.toInt}
          and h.is_embedded = false
          and width_layout in (${WidthLayout.Tiny.toInt}, ${WidthLayout.Medium.toInt})
          -- The server's origin needs to be specified only for embedded pages. [REMOTEORIGIN]
          and h.origin = ''
          and h.cdn_origin = ?
        limit $limit
        """
      runQuery(outOfDateQuery, List(daoFactory.cdnOrigin.getOrElse("")), rs => {
        while (rs.next()) {
          pagesStale += getPageIdToRerender(rs)
        }
      })
    }

    pagesNotCached.toVector ++ pagesStale.toVector
  }


  private def getPageIdToRerender(rs: js.ResultSet): PageIdToRerender = {
    PageIdToRerender(
      siteId = rs.getInt("site_id"),
      pageId = rs.getString("page_id"),
      currentVersion = rs.getInt("current_version"),
      cachedVersion = getOptInt(rs, "cached_version"))
  }


  def loadStuffToIndex(limit: Int): StuffToIndex = {
    val postIdsBySite = mutable.Map[SiteId, ArrayBuffer[PostId]]()
    // Hmm, use action_at or inserted_at? Normally, use inserted_at, but when
    // reindexing everything, everything gets inserted at the same time. Then should
    // instead use posts3.created_at, desc order, so most recent indexed first.
    val query = s"""
       select site_id, post_id from index_queue3 order by inserted_at limit $limit
       """

    runQuery(query, Nil, rs => {
      while (rs.next()) {
        val siteId = rs.getInt("site_id")
        val postId = rs.getInt("post_id")
        val postIds = postIdsBySite.getOrElseUpdate(siteId, ArrayBuffer[PostId]())
        postIds.append(postId)
      }
    })

    val entries: Vector[(SiteId, ArrayBuffer[PostId])] = postIdsBySite.iterator.toVector

    val sitePageIds = mutable.Set[SitePageId]()

    val postsBySite = Map[SiteId, immutable.Seq[Post]](
      entries.map(siteAndPosts => {
        val siteId = siteAndPosts._1
        val siteTrans = siteTransaction(siteId)
        val posts = siteTrans.loadPostsByUniqueId(siteAndPosts._2).values.toVector
        sitePageIds ++= posts.map(post => SitePageId(siteId, post.pageId))
        (siteId, posts)
      }): _*)

    val pagesBySitePageId = loadPagesBySitePageId(sitePageIds)
    val tagsBySitePostId = loadTagsBySitePostId(postsBySite)
    StuffToIndex(postsBySite, pagesBySitePageId, tagsBySitePostId)
  }


  def loadPagesBySitePageId(sitePageIds: collection.Set[SitePageId]): Map[SitePageId, PageMeta] = {
    COULD_OPTIMIZE // For now, load pages one at a time.
    Map[SitePageId, PageMeta](sitePageIds.toSeq.flatMap({ sitePageId =>
      siteTransaction(sitePageId.siteId).loadPageMeta(sitePageId.pageId) map { pageMeta =>
        sitePageId -> pageMeta
      }
    }): _*)
  }


  def loadTagsBySitePostId(postsBySite: Map[SiteId, immutable.Seq[Post]])
        : Map[SitePostId, Set[TagLabel]] = {
    COULD_OPTIMIZE // could load tags for all sites at once, instead of once per site
    var tagsBySitePostId = Map[SitePostId, Set[TagLabel]]()
    for ((siteId, posts) <- postsBySite) {

      val tagsByPostId: Map[PostId, Set[TagLabel]] =
        siteTransaction(siteId).loadTagsByPostId(posts.map(_.id))
      for ((postId, tags) <- tagsByPostId) {
        tagsBySitePostId += SitePostId(siteId, postId) -> tags
      }
    }
    tagsBySitePostId
  }


  def deleteFromIndexQueue(post: Post, siteId: SiteId) {
    val statement = s"""
      delete from index_queue3
      where site_id = ? and post_id = ? and post_rev_nr <= ?
      """
    // [85YKF30] Only approved posts currently get indexed. Perhaps I should add a rule that
    // a post's approvedRevisionNr is never decremented? Because if it is, then impossible?
    // to know if the index queue entry should be deleted or not.
    // But only-increment is a bit bad? because then one can no longer undo an accidental approval?
    // Or add another field, stateUpdateCountCountNr, which gets bumped whenever the post
    // gets updated in any way?
    // For now:
    val revNr = post.approvedRevisionNr.getOrElse(post.currentRevisionNr)
    runUpdate(statement, List(siteId.asAnyRef, post.id.asAnyRef, revNr.asAnyRef))
  }


  def addEverythingInLanguagesToIndexQueue(languages: Set[String]) {
    if (languages.isEmpty)
      return

    require(languages == Set("english"), s"Langs not yet impl: ${languages.toString} [EsE2PYK40]")

    // Later: COULD index also deleted and hidden posts, and make available to staff.
    val statement = s"""
      insert into index_queue3 (action_at, site_id, site_version, post_id, post_rev_nr)
      select
        posts3.created_at,
        sites3.id,
        sites3.version,
        posts3.unique_post_id,
        posts3.approved_rev_nr
      from posts3 inner join sites3
        on posts3.site_id = sites3.id
      where
        ${SearchSiteDaoMixin.PostShouldBeIndexedTests}
      ${SearchSiteDaoMixin.OnPostConflictAction}
      """

    runUpdate(statement, Nil)
  }


  def loadStuffToSpamCheck(limit: Int): immutable.Seq[SpamCheckTask] = {
    val query = s"""
      select * from spam_check_queue3
      where results_at is null
      -- and post_rev_nr = max(...), COULD load and check only the most recent post_rev_nr
      -- index: scq_actionat__i
      order by created_at asc limit $limit
      """
    runQueryFindMany(query, Nil, getSpamCheckTask)
  }


  def loadMisclassifiedSpamCheckTasks(limit: Int): immutable.Seq[SpamCheckTask] = {
    val query = s"""
      select * from spam_check_queue3
      where
          -- index: spamcheckqueue_next_miscl_i
          is_misclassified and
          misclassifications_reported_at is null
      order by results_at asc
      limit $limit
      """
    runQueryFindMany(query, Nil, getSpamCheckTask)
  }


  val SomeMonthsAgo = 5
  val SomeYearsAgo = 5

  def deletePersonalDataFromOldAuditLogEntries() {
    TESTS_MISSING

    // Forget the last octet fairly soon, so won't be possible to identify a
    // unique individial or household via the ip address. But so the ip can still
    // be used to block spammers etc who sign up from the roughly same ip
    // (maybe a single spammer, with a varying IP on the same class C subnet).

    // Remember region and city. That's useful for security purposes: if a member suddenly
    // logs in from far away, then one can ask "From which city do you
    // usually log in?" and if hen doesn't know — account probably hacked.
    // (Gmail asks this sometimes when I haven't enabled 2FA and login from another country)

    PRIVACY; COULD // make x months below configurable
    val deleteABitStatement = s"""
      update audit_log3 set
        ip = ip & inet '255.255.255.0',
        -- ip_randhash_2 =
        -- browser_id_cookie = hash(browser_id_cookie),
        -- browser_fingerprint = 0,
        forgotten = 1
      where
        forgotten = 0 and
        done_at < ?
      """
    runUpdate(deleteABitStatement, List(now.minusMonths(SomeMonthsAgo).asTimestamp))

    PRIVACY; COULD // make x years below configurable
    // Now no need to remember region and city any longer. (But remember which country.)
    val deleteMoreStatement = s"""
      update audit_log3 set
        ip = ip & inet '255.255.0.0',
        region = null,
        city = null,
        forgotten = 2
      where
        forgotten = 1 and
        done_at < ?
      """
    runUpdate(deleteMoreStatement, List(now.minusYears(SomeYearsAgo).asTimestamp))
  }


  def deletePersonalDataFromOldSpamCheckTasks() {
    // For now, just delete any old tasks. Later, could be nice to remember tasks
    // that resulted in spam actually being found — since that can result in the author
    // getting auto blocked; then, can be good to know why that happened.
    val deleteMoreStatement = s"""
      delete from spam_check_queue3
      where
        -- index: scq_actionat__i
        created_at < ?
      """
    runUpdate(deleteMoreStatement, List(now.minusMonths(SomeMonthsAgo).asTimestamp))
  }


  def loadReviewTaskIdsToExecute(): Map[SiteId, immutable.Seq[ReviewTaskId]] = {
    val query = """
      select site_id, id from review_tasks3
      where
        decided_at < ? and
        completed_at is null and
        invalidated_at is null
      order by decided_at asc"""
    val someSecondsAgo = now.minusSeconds(ReviewDecision.UndoTimoutSeconds).toJavaDate
    runQueryBuildMultiMap(query, List(someSecondsAgo), rs => {
      val siteId = rs.getInt("site_id")
      val taskId = rs.getInt("id")
      siteId -> taskId
    })
  }


  /** Finds all evolution scripts below src/main/resources/db/migration and applies them.
    */
  def applyEvolutions() {
    val flyway = new Flyway()

    // --- Temporarily, to initialize the production database -----
    flyway.setBaselineOnMigrate(!daoFactory.isTest)
    // ------------------------------------------------------------

    flyway.setLocations("classpath:db/migration")
    flyway.setDataSource(db.readWriteDataSource)
    flyway.setSchemas("public")
    // Default prefixes are uppercase "V" and "R" but I want files in lowercase, e.g. v1__name.sql.
    flyway.setSqlMigrationPrefix("v")
    flyway.setRepeatableSqlMigrationPrefix("r")
    // Warning: Don't clean() in production, could wipe out all data.
    flyway.setCleanOnValidationError(daoFactory.isTest)
    flyway.setCleanDisabled(!daoFactory.isTest)
    // Group all pending migrations together in the same transaction, so if
    // upgrading from version 3 to version 8, migrations 4,5,6,7,8 will either succeed
    // or fail all of them. This means that if there's any error, we'll be back at
    // version 3 again — rather than some other unknown version for which we don't
    // immediately know which *software* version to use.
    flyway.setGroup(true)
    // Make this DAO accessible to the Scala code in the Flyway migration.
    _root_.db.migration.MigrationHelper.systemDbDao = this
    _root_.db.migration.MigrationHelper.scalaBasedMigrations = daoFactory.migrations
    flyway.migrate()
  }


  override def emptyDatabase() {
    require(daoFactory.isTest)

    // There are foreign keys from sites3 to other tables and back.
    runUpdate("set constraints all deferred")

    // Dupl code [7KUW0ZT2]
    s"""
      delete from index_queue3
      delete from spam_check_queue3
      delete from links_t
      delete from link_previews_t
      delete from audit_log3
      delete from review_tasks3
      delete from perms_on_pages3
      delete from settings3
      delete from drafts3
      delete from post_read_stats3
      delete from notifications3
      delete from emails_out3
      delete from upload_refs3
      delete from uploads3
      delete from page_users3
      delete from page_notf_prefs3
      delete from tag_notf_levels3
      delete from post_tags3
      delete from post_actions3
      delete from post_revisions3
      delete from posts3
      delete from page_popularity_scores3
      delete from page_paths3
      delete from page_html3
      delete from alt_page_ids3
      delete from pages3
      delete from categories3
      delete from blocks3
      delete from guest_prefs3
      delete from identities3
      delete from idps_t
      delete from invites3
      delete from api_secrets3
      delete from user_visit_stats3
      delete from user_stats3
      delete from usernames3
      delete from user_emails3
      delete from group_participants3
      delete from users3
      delete from hosts3
      delete from sites3
      alter sequence DW1_TENANTS_ID restart
      """.trim.split("\n") foreach { runUpdate(_) }

    runUpdate("set constraints all immediate")
  }

}

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list


/**
 * Copyright (c) 2018 Kaj Magnus Lindberg
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
import java.{sql => js}
import Rdb._
import RdbUtil.makeInListFor
import scala.collection.mutable.ArrayBuffer


/** Loads and saves PageNotfPref:s.
  *
  * Tested here:  TyT8MKRD25
  */
trait PageNotfPrefsSiteTxMixin extends SiteTransaction {
  self: RdbSiteTransaction =>


  private def thingColumnNameValue(notfPref: PageNotfPref): (String, AnyRef) =
    if (notfPref.pageId.isDefined)
      "page_id" -> notfPref.pageId.get.asAnyRef
    else if (notfPref.pagesInCategoryId.isDefined)
      "pages_in_category_id" -> notfPref.pagesInCategoryId.get.asAnyRef
    else if (notfPref.wholeSite)
      "pages_in_whole_site" -> true.asAnyRef
    else if (notfPref.pagesPatCreated)
      "pages_pat_created" -> true.asAnyRef
    else if (notfPref.pagesPatRepliedTo)
      "pages_pat_replied_to" -> true.asAnyRef
    else
      die("TyE2ABK057")


  override def upsertPageNotfPref(notfPref: PageNotfPref) {
    // Normal level is the default. However, if is for a page or category, then in some cases
    // we should remember level Normal — in case it overrides a different level set on
    // a parent category, or the whole site, or a group the user is in (maybe site wide group prefs).
    // So, don't do this:
    /*
    if (notfPref.notfLevel == NotfLevel.Normal) {
      deletePageNotfPref(notfPref)
      return
    } */

    val (thingColumnName, _) = thingColumnNameValue(notfPref)

    val insertStatement = s"""
      insert into page_notf_prefs3 (
        site_id,
        people_id,
        notf_level,
        page_id,
        pages_pat_created,
        pages_pat_replied_to,
        pages_in_category_id,
        pages_in_whole_site)
        -- pages_with_tag_label_id,
      values (?, ?, ?, ?, ?, ?, ?, ?)
      -- There can be only one on-conflict clause.
      on conflict (site_id, $thingColumnName, people_id)
      do update set
        notf_level = excluded.notf_level
      """

    val values = List(
          siteId.asAnyRef,
          notfPref.peopleId.asAnyRef,
          notfPref.notfLevel.toInt.asAnyRef,
          notfPref.pageId.orNullVarchar,
          // Should be null or true, because of unique constraints.
          if (notfPref.pagesPatCreated) true.asAnyRef else NullBoolean,
          if (notfPref.pagesPatRepliedTo) true.asAnyRef else NullBoolean,
          notfPref.pagesInCategoryId.orNullInt,
          if (notfPref.wholeSite) true.asAnyRef else NullBoolean)

    runUpdateSingleRow(insertStatement, values)
  }


  override def deletePageNotfPref(notfPref: PageNotfPref): Boolean = {
    val (thingColumnName, thingColumnValue) = thingColumnNameValue(notfPref)
    val deleteStatement = s"""
      delete from page_notf_prefs3
      where site_id = ?
        and people_id = ?
        and $thingColumnName = ?
      """
    val values = List(siteId.asAnyRef, notfPref.peopleId.asAnyRef, thingColumnValue)
    runUpdateSingleRow(deleteStatement, values)
  }


  def loadPageNotfLevels(peopleId: UserId, pageId: PageId, categoryId: Option[CategoryId])  // [2RJW0047]
        : PageNotfLevels = {
    def selectNotfLevelWhere(what: Int) = s"""
      select notf_level, $what as what
      from page_notf_prefs3
      where site_id = ?
        and people_id = ?"""

    val query = s"""
      ${selectNotfLevelWhere(111)} and page_id = ?
      union
      ${selectNotfLevelWhere(222)} and pages_in_category_id = ?
      union
      ${selectNotfLevelWhere(333)} and pages_in_whole_site
      """

    val values = List(
        siteId.asAnyRef, peopleId.asAnyRef, pageId,
        siteId.asAnyRef, peopleId.asAnyRef, categoryId.getOrElse(NoCategoryId).asAnyRef,
        siteId.asAnyRef, peopleId.asAnyRef)

    var result = PageNotfLevels(None, None, None)

    runQueryFindMany(query, values, rs => {
      val notfLevelInt = getInt(rs, "notf_level")
      val notfLevel = NotfLevel.fromInt(notfLevelInt).getOrElse(NotfLevel.Normal)
      val what = getInt(rs, "what")
      what match {
        case 111 => result = result.copy(forPage = Some(notfLevel))
        case 222 => result = result.copy(forCategory = Some(notfLevel))
        case 333 => result = result.copy(forWholeSite = Some(notfLevel))
        case _ => die("TyE7KTW42")
      }
    })

    result
  }


  def loadAllPageNotfPrefs(): Seq[PageNotfPref] = {
    loadPageNotfPrefsOnSth(null, null)
  }

  def loadPageNotfPrefsOnPage(pageId: PageId): Seq[PageNotfPref] = {
    loadPageNotfPrefsOnSth("page_id", pageId)
  }

  def loadPageNotfPrefsOnCategory(categoryId: CategoryId): Seq[PageNotfPref] = {
    loadPageNotfPrefsOnSth("pages_in_category_id", categoryId.asAnyRef)
  }

  def loadPageNotfPrefsOnSite(): Seq[PageNotfPref] = {
    loadPageNotfPrefsOnSth("pages_in_whole_site", true.asAnyRef)
  }

  private def loadPageNotfPrefsOnSth(thingColumnName: String, thingColumnValue: AnyRef)
      : Seq[PageNotfPref] = {
    val values = ArrayBuffer(siteId.asAnyRef)
    val andThingEq =
      if (thingColumnName eq null) ""
      else {
        values.append(thingColumnValue)
        s"and $thingColumnName = ?"
      }
    val query = s"""
      select * from page_notf_prefs3
      where site_id = ? $andThingEq
      """
    runQueryFindMany(query, values.toList, readNotfPref)
  }


  def loadNotfPrefsForMemberAboutCatsTagsSite(memberIds: Seq[MemberId]): Seq[PageNotfPref] = {
    loadContentNotfPrefsForMemberImpl(pageId = None, memberIds)
  }


  def loadNotfPrefsForMemberAboutPage(pageId: PageId, memberIds: Seq[MemberId]): Seq[PageNotfPref] = {
    loadContentNotfPrefsForMemberImpl(pageId = Some(pageId), memberIds)
  }

  def loadNotfPrefsAboutPagesRepliedTo(memberIds: Seq[MemberId]): Seq[PageNotfPref] = {
    loadContentNotfPrefsForMemberImpl(pageId = None, memberIds, pagesRepliedTo = true)
  }

  private def loadContentNotfPrefsForMemberImpl(
        pageId: Opt[PageId], memberIds: Seq[MemberId], pagesRepliedTo: Bo = false)
        : Seq[PageNotfPref] = {
    if (memberIds.isEmpty)
      return Nil

    dieIf(pageId.isDefined & pagesRepliedTo, "TyE306RMTSKD2")

    val values = MutArrBuf[AnyRef](siteId.asAnyRef)
    values.appendAll(memberIds.map(_.asAnyRef))
    val andPageIdClause = pageId match {
      case None =>
        if (pagesRepliedTo)
          "and pages_pat_replied_to"  // unimpl:  pages_pat_created
        else
          "and page_id is null"
      case Some(id) =>
        values.append(id)
        "and page_id = ?"
    }
    val query = s"""
      select * from page_notf_prefs3
      where site_id = ?
        and people_id in (${makeInListFor(memberIds)})
        $andPageIdClause
      """
    runQueryFindMany(query, values.toList, readNotfPref)
  }


  private def readNotfPref(rs: js.ResultSet): PageNotfPref = {
    PageNotfPref(
          peopleId = getInt(rs, "people_id"),
          notfLevel = NotfLevel.fromInt(getInt(rs, "notf_level")).getOrElse(NotfLevel.Normal),
          pageId = getOptString(rs, "page_id"),
          pagesPatCreated = getOptBool(rs, "pages_pat_created").getOrElse(false),
          pagesPatRepliedTo = getOptBool(rs, "pages_pat_replied_to").getOrElse(false),
          pagesInCategoryId = getOptInt(rs, "pages_in_category_id"),
          wholeSite = getOptBool(rs, "pages_in_whole_site").getOrElse(false))
  }

}

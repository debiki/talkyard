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
trait PageNotfPrefsSiteTxMixin extends SiteTransaction {  // RENAME  DiscNotPrefs...
  self: RdbSiteTransaction =>


  private def thingColumnNameValue(notfPref: PageNotfPref): (String, AnyRef) =
    if (notfPref.pageId.isDefined)
      "page_id" -> notfPref.pageId.get.asAnyRef
    else if (notfPref.pagesInCategoryId.isDefined)
      "discs_in_cat_id_c" -> notfPref.pagesInCategoryId.get.asAnyRef
    else if (notfPref.wholeSite)
      "discs_in_whole_site_c" -> true.asAnyRef
    else if (notfPref.pagesPatCreated)
      "discs_pat_created_c" -> true.asAnyRef
    else if (notfPref.pagesPatRepliedTo)
      "discs_pat_replied_to" -> true.asAnyRef
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
      insert into disc_notf_prefs_t (
        site_id,
        pat_id_c,
        notf_level,
        page_id,
        discs_pat_created_c,
        discs_pat_replied_to,
        discs_in_cat_id_c,
        discs_in_whole_site_c)
        -- pages_with_tag_label_id,
      values (?, ?, ?, ?, ?, ?, ?, ?)
      -- There can be only one on-conflict clause.
      on conflict (site_id, $thingColumnName, pat_id_c)
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
      delete from disc_notf_prefs_t
      where site_id = ?
        and pat_id_c = ?
        and $thingColumnName = ?
      """
    val values = List(siteId.asAnyRef, notfPref.peopleId.asAnyRef, thingColumnValue)
    runUpdateSingleRow(deleteStatement, values)
  }


  def loadPageNotfLevels(peopleId: UserId, pageId: PageId, categoryId: Option[CategoryId])  // [2RJW0047]
        : PageNotfLevels = {
    def selectNotfLevelWhere(what: Int) = s"""
      select notf_level, $what as what
      from disc_notf_prefs_t
      where site_id = ?
        and pat_id_c = ?"""

    val query = s"""
      ${selectNotfLevelWhere(111)} and page_id = ?
      union
      ${selectNotfLevelWhere(222)} and discs_in_cat_id_c = ?
      union
      ${selectNotfLevelWhere(333)} and discs_in_whole_site_c
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
    loadPageNotfPrefsOnSth("discs_in_cat_id_c", categoryId.asAnyRef)
  }

  def loadPageNotfPrefsOnSite(): Seq[PageNotfPref] = {
    loadPageNotfPrefsOnSth("discs_in_whole_site_c", true.asAnyRef)
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
      select * from disc_notf_prefs_t
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
          "and discs_pat_replied_to"  // unimpl:  discs_pat_created_c
        else
          "and page_id is null"
      case Some(id) =>
        values.append(id)
        "and page_id = ?"
    }
    val query = s"""
      select * from disc_notf_prefs_t
      where site_id = ?
        and pat_id_c in (${makeInListFor(memberIds)})
        $andPageIdClause
      """
    runQueryFindMany(query, values.toList, readNotfPref)
  }


  private def readNotfPref(rs: js.ResultSet): PageNotfPref = {
    PageNotfPref(
          peopleId = getInt(rs, "pat_id_c"),
          notfLevel = NotfLevel.fromInt(getInt(rs, "notf_level")).getOrElse(NotfLevel.Normal),
          pageId = getOptString(rs, "page_id"),
          pagesPatCreated = getOptBool(rs, "discs_pat_created_c").getOrElse(false),
          pagesPatRepliedTo = getOptBool(rs, "discs_pat_replied_to").getOrElse(false),
          pagesInCategoryId = getOptInt(rs, "discs_in_cat_id_c"),
          wholeSite = getOptBool(rs, "discs_in_whole_site_c").getOrElse(false))
  }

}

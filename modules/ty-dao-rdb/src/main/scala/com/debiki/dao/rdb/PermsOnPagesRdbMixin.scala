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

package com.debiki.dao.rdb

import com.debiki.core._
import scala.collection.immutable
import java.{ sql => js }
import Rdb._
import RdbUtil.makeInListFor



trait PermsOnPagesRdbMixin extends SiteTransaction {
  self: RdbSiteTransaction =>


  def insertPermsOnPages(permsOnPages: PermsOnPages): PermsOnPages = {
    val statement = s"""
      insert into perms_on_pages3 (
        site_id,
        perm_id,
        for_people_id,
        on_whole_site,
        on_category_id,
        on_page_id,
        on_post_id,
        on_tag_id,
        may_edit_page,
        may_edit_comment,
        may_edit_wiki,
        may_edit_own,
        may_delete_page,
        may_delete_comment,
        may_create_page,
        may_post_comment,
        may_see,
        may_see_own)
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      """

    val id =
      if (permsOnPages.id >= PermissionAlreadyExistsMinId)
        permsOnPages.id
      else
        selectNextPerSitePermissionId() // [9P1U6E5]

    val poc = permsOnPages.copy(id = id)

    val values = List(
      siteId.asAnyRef, poc.id.asAnyRef, poc.forPeopleId.asAnyRef,
      poc.onWholeSite.orNullBoolean, poc.onCategoryId.orNullInt, poc.onPageId.orNullVarchar,
      poc.onPostId.orNullInt, poc.onTagId.orNullInt,
      poc.mayEditPage.orNullBoolean, poc.mayEditComment.orNullBoolean, poc.mayEditWiki.orNullBoolean,
      poc.mayEditOwn.orNullBoolean,
      poc.mayDeletePage.orNullBoolean, poc.mayDeleteComment.orNullBoolean,
      poc.mayCreatePage.orNullBoolean, poc.mayPostComment.orNullBoolean,
      poc.maySee.orNullBoolean, poc.maySeeOwn.orNullBoolean)
    runUpdateExactlyOneRow(statement, values)

    poc
  }


  private def selectNextPerSitePermissionId(): PermissionId = {
    // Let's start on 1000 so 1-999 will be available to me if I need to insert "hardcoded"
    // permissions for trust levels & staff groups, for each category, say 100 categories [B0GKWU52]
    // (100 categories * 10 levels-and-staff-groups per category = 1000).
    val query = """
      select coalesce(max(perm_id), 1000) + 1 next_id from perms_on_pages3 where site_id = ?
      """
    runQueryFindExactlyOne(query, List(siteId.asAnyRef), _.getInt("next_id"))
  }


  def updatePermsOnPages(permsOnPages: PermsOnPages) {
    val statement = s"""
      update perms_on_pages3 set
        for_people_id = ?,
        may_edit_page = ?,
        may_edit_comment = ?,
        may_edit_wiki = ?,
        may_edit_own = ?,
        may_delete_page = ?,
        may_delete_comment = ?,
        may_create_page = ?,
        may_post_comment = ?,
        may_see = ?,
        may_see_own = ?
      where site_id = ? and perm_id = ?
      """
    val pop = permsOnPages
    val values = List(
      pop.forPeopleId.asAnyRef,
      pop.mayEditPage.orNullBoolean, pop.mayEditComment.orNullBoolean, pop.mayEditWiki.orNullBoolean,
      pop.mayEditOwn.orNullBoolean,
      pop.mayDeletePage.orNullBoolean, pop.mayDeleteComment.orNullBoolean,
      pop.mayCreatePage.orNullBoolean, pop.mayPostComment.orNullBoolean,
      pop.maySee.orNullBoolean, pop.maySeeOwn.orNullBoolean,
      siteId.asAnyRef, pop.id.asAnyRef)
    runUpdateExactlyOneRow(statement, values)
  }


  def deletePermsOnPages(ids: Iterable[PermissionId]) {
    if (ids.isEmpty) return
    val statement = s"""
      delete from perms_on_pages3
      where site_id = ? and perm_id in (${ makeInListFor(ids) })
      """
    val values = siteId.asAnyRef :: ids.map(_.asAnyRef).toList
    runUpdate(statement, values)
  }


  def loadPermsOnPages(): immutable.Seq[PermsOnPages] = {
    val query = """
      select * from perms_on_pages3 where site_id = ?
      """
    runQueryFindMany(query, List(siteId.asAnyRef), readPermsOnPages)
  }


  private def readPermsOnPages(rs: js.ResultSet): PermsOnPages = {
    PermsOnPages(
      id = rs.getInt("perm_id"),
      forPeopleId = rs.getInt("for_people_id"),
      onWholeSite = getOptBool(rs, "on_whole_site"),
      onCategoryId = getOptInt(rs, "on_category_id"),
      onPageId = getOptString(rs, "on_page_id"),
      onPostId = getOptInt(rs, "on_post_id"),
      onTagId = getOptInt(rs, "on_tag_id"),
      mayEditPage = getOptBool(rs, "may_edit_page"),
      mayEditComment = getOptBool(rs, "may_edit_comment"),
      mayEditWiki = getOptBool(rs, "may_edit_wiki"),
      mayEditOwn = getOptBool(rs, "may_edit_own"),
      mayDeletePage = getOptBool(rs, "may_delete_page"),
      mayDeleteComment = getOptBool(rs, "may_delete_comment"),
      mayCreatePage = getOptBool(rs, "may_create_page"),
      mayPostComment = getOptBool(rs, "may_post_comment"),
      maySee = getOptBool(rs, "may_see"),
      maySeeOwn = getOptBool(rs, "may_see_own"))
  }

}

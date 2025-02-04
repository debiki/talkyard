/**
 * Copyright (c) 2016 Kaj Magnus Lindberg
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

import collection.mutable.ArrayBuffer
import com.debiki.core._
import com.debiki.core.Prelude._
import Rdb._
import RdbUtil._


/** Adds and removes post tags. Page tags = tags added to the page body post (post nr 1).
  */
@deprecated("now", "Use TagsRdbMixin instead")
trait TagsSiteDaoMixin extends SiteTransaction {  // CLEAN_UP REMOVE this whole file
  self: RdbSiteTransaction =>


  def loadAllTagsAsSet(): Set[TagLabel] = {
    val query = """
      select distinct tag from post_tags3 where site_id = ?
      """
    runQueryFindManyAsSet(query, List(siteId.asAnyRef), rs => rs.getString("tag"))
  }


  /*
  def loadTagsAndStats(): Seq[TagAndStats] = {
    val query = """
      select
        tag,
        count(*) num_total,
        sum(is_page::int) num_pages
      from post_tags3 where site_id = ? group by tag
      """
    runQueryFindMany(query, List(siteId.asAnyRef), rs => {
      TagAndStats(
        label = rs.getString("tag"),
        numTotal = rs.getInt("num_total"),
        numPages = rs.getInt("num_pages"),
        numSubscribers = -1,
        numMuted = -1)
    })
  } */


  def loadTagsByPostId(postIds: Iterable[PostId]): Map[PostId, Set[TagLabel]] = {
    if (postIds.isEmpty)
      return Map.empty.withDefaultValue(Set.empty)
    val query = s"""
      select tag, post_id from post_tags3
      where site_id = ? and post_id in (${ makeInListFor(postIds) })
      order by post_id
      """
    val tags = ArrayBuffer[String]()
    var currentPostId = NoPostId
    var tagsByPostId = Map[PostId, Set[TagLabel]]().withDefaultValue(Set.empty)
    runQueryAndForEachRow(query, siteId.asAnyRef :: postIds.toList.map(_.asAnyRef), rs => {
      val postId: PostId = rs.getInt("post_id")
      val tag: TagLabel = rs.getString("tag")
      if (currentPostId == NoPostId || currentPostId == postId) {
        currentPostId = postId
        tags += tag
      }
      else {
        tagsByPostId = tagsByPostId.updated(currentPostId, tags.toSet)
        tags.clear()
        tags += tag
        currentPostId = postId
      }
    })
    if (currentPostId != NoPostId) {
      tagsByPostId = tagsByPostId.updated(currentPostId, tags.toSet)
    }
    tagsByPostId
  }


  def removeTagsFromPost(tags: Set[Tag_old], postId: PostId): Unit = {
    if (tags.isEmpty)
      return
    val statement = s"""
      delete from post_tags3 where site_id = ? and post_id = ? and tag in (${makeInListFor(tags)})
      """
    val values = siteId.asAnyRef :: postId.asAnyRef :: tags.toList
    runUpdate(statement, values)
  }


  def addTagsToPost(tags: Set[TagLabel], postId: PostId, isPage: Boolean): Unit = {
    if (tags.isEmpty)
      return
    val rows = ("(?, ?, ?, ?), " * tags.size) dropRight 2 // drops last ", "
    val values = tags.toList.flatMap(List(siteId.asAnyRef, postId.asAnyRef, _, isPage.asAnyRef))
    val statement = s"""
      insert into post_tags3 (site_id, post_id, tag, is_page) values $rows
      """
    runUpdate(statement, values)
  }


  def renameTag(from: String, to: String): Unit = {
    die("EsE5KPU02SK3", "Unimplemented")
    // update post_tags3 ...
  }


  def setTagNotfLevel(userId: UserId, tagLabel: TagLabel, notfLevel: NotfLevel): Unit = {
    val statement = s"""
      insert into tag_notf_levels3 (site_id, user_id, tag, notf_level)
        values (?, ?, ?, ?)
      on conflict (site_id, user_id, tag) do update
        set notf_level = excluded.notf_level
      """
    val values = List(siteId.asAnyRef, userId.asAnyRef, tagLabel, notfLevel.toInt.asAnyRef)
    runUpdateExactlyOneRow(statement, values)
  }


  def loadTagNotfLevels(userId: UserId): Map[TagLabel, NotfLevel] = {
    val query = """
      select tag, notf_level
      from tag_notf_levels3
      where site_id = ? and user_id = ?
      """
    runQueryBuildMap(query, List(siteId.asAnyRef, userId.asAnyRef), rs => {
      val label = rs.getString("tag")
      val notfLevelInt = rs.getInt("notf_level")
      label -> NotfLevel.fromInt(notfLevelInt).getOrElse(NotfLevel.Normal)
    })
  }


  def listUsersWatchingTags(tags: Set[TagLabel]): Set[UserId] = {
    if (tags.isEmpty)
      return Set.empty
    val query = s"""
      select user_id, notf_level
      from tag_notf_levels3
      where site_id = ?
        and tag in (${ makeInListFor(tags) })
        and notf_level in (${ NotfLevel.WatchingFirst.toInt }, ${ NotfLevel.WatchingAll.toInt })
      """
    runQueryFindManyAsSet(query, siteId.asAnyRef :: tags.toList, rs => {
      val userId = rs.getInt("user_id")
      val notfLevelInt = rs.getInt("notf_level")
      userId
    })
  }
}

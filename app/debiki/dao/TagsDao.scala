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

package debiki.dao

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.ReactJson
import io.efdi.server.Who
import io.efdi.server.http._
import play.api.libs.json.JsValue
import TagsDao._


object TagsDao {
  val MaxNumTags = 200
  val MaxTagLength = 100
  val OkLabelRegex = """^[^\s,;|'"<>]+$""".r  // sync with SQL [7JES4R3]
}


trait TagsDao {
  this: SiteDao =>


  def loadAllTagsAsSet(): Set[TagLabel] =
    readOnlyTransaction(_.loadAllTagsAsSet())


  def loadTagsAndStats(): Seq[TagAndStats] =
    readOnlyTransaction(_.loadTagsAndStats())


  def loadTagsByPostId(postIds: Iterable[UniquePostId]) =
    readOnlyTransaction(_.loadTagsByPostId(postIds))


  def loadTagsForPost(postId: UniquePostId) =
    loadTagsByPostId(Seq(postId)).getOrElse(postId, Set.empty)


  def addRemoveTagsIfAuth(pageId: PageId, postId: UniquePostId, tags: Set[Tag], who: Who)
        : JsValue = {
    if (tags.size > MaxNumTags)
      throwForbidden2("EsE5KG0F3", s"Too many tags: ${tags.size}, max is $MaxNumTags")
    tags.find(_.length > MaxTagLength) foreach { tooLongTag =>
      throwForbidden2("EsE7KPU4R2", s"Tag label too long: '$tooLongTag'")
    }
    tags.find(tag => !tag.matches(OkLabelRegex)) foreach { badLabel =>
      throwForbidden2("EsE4GE8I2", s"Bad tag label: '$badLabel'")
    }

    readWriteTransaction { transaction =>
      val me = transaction.loadTheUser(who.id)
      val pageMeta = transaction.loadThePageMeta(pageId)
      val post = transaction.loadThePost(postId)

      throwForbiddenIf(post.nr == PageParts.TitleNr, "EsE5JK8S4", "Cannot tag page titles")

      throwForbiddenIf(post.createdById != me.id && !me.isStaff,
        "EsE2GKY5", "Not your post and you're not staff, so you may not edit tags")

      throwForbiddenIf(post.pageId != pageId,
        "EsE4GKU02", o"""Wrong page id: Post $postId is located on page ${post.pageId},
            not page $pageId — perhaps it was just moved""")

      val oldTags: Set[Tag] = transaction.loadTagsForPost(post.uniqueId)

      val tagsToAdd = tags -- oldTags
      val tagsToRemove = oldTags -- tags

      transaction.addTagsToPost(tagsToAdd, postId, isPage = post.isOrigPost)
      transaction.removeTagsFromPost(tagsToRemove, postId)
      transaction.updatePageMeta(pageMeta.copyWithNewVersion, oldMeta = pageMeta,
          markSectionPageStale = false)

      ReactJson.makeStorePatch2(postId, pageId, transaction)
    }
  }


  def setTagNotfLevelIfAuth(userId: UserId, tagLabel: TagLabel, notfLevel: NotfLevel,
        byWho: Who) {
    readWriteTransaction { transaction =>
      val me = transaction.loadTheMember(byWho.id)
      if (me.id != userId && !me.isStaff)
        throwForbidden2("EsE4GK9F7", "You may not change someone else's notification settings")

      transaction.setTagNotfLevel(userId, tagLabel, notfLevel)
    }
  }


  def loadTagNotfLevels(userId: UserId, byWho: Who): Map[TagLabel, NotfLevel] = {
    readOnlyTransaction { transaction =>
      val me = transaction.loadTheMember(byWho.id)
      if (me.id != userId && !me.isStaff)
        throwForbidden2("EsE8YHKP03", "You may not see someone else's notification settings")

      transaction.loadTagNotfLevels(userId)
    }
  }

}

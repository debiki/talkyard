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
import debiki.EdHttp.{throwForbidden, throwForbiddenIf}
import ed.server.notf.NotificationGenerator
import ed.server.pubsub.StorePatchMessage
import play.api.libs.json.JsValue
import TagsDao._
import scala.util.matching.Regex


object TagsDao {
  val MaxNumTags = 200
  val MaxTagLength = 100
  val OkLabelRegex: Regex = """^[^\s,;|'"<>]+$""".r  // sync with SQL [7JES4R3]
}


trait TagsDao {
  this: SiteDao =>


  def loadAllTagsAsSet(): Set[TagLabel] =
    readOnlyTransaction(_.loadAllTagsAsSet())


  def loadTagsAndStats(): Seq[TagAndStats] =
    readOnlyTransaction(_.loadTagsAndStats())


  def loadTagsByPostId(postIds: Iterable[PostId]) =
    readOnlyTransaction(_.loadTagsByPostId(postIds))


  def loadTagsForPost(postId: PostId) =
    loadTagsByPostId(Seq(postId)).getOrElse(postId, Set.empty)


  def addRemoveTagsIfAuth(pageId: PageId, postId: PostId, tags: Set[Tag], who: Who)
        : JsValue = {

    if (tags.size > MaxNumTags) {
      throwForbidden("EsE5KG0F3", s"Too many tags: ${tags.size}, max is $MaxNumTags")
    }
    tags.find(_.length > MaxTagLength) foreach { tooLongTag =>
      throwForbidden("EsE7KPU4R2", s"Tag label too long: '$tooLongTag'")
    }
    tags.find(tag => !tag.matches(OkLabelRegex)) foreach { badLabel =>
      throwForbidden("EsE4GE8I2", s"Bad tag label: '$badLabel'")
    }

    val (post, notifications, postAuthor) = readWriteTransaction { tx =>
      val me = tx.loadTheUser(who.id)
      val pageMeta = tx.loadThePageMeta(pageId)
      val post = tx.loadThePost(postId)
      val postAuthor = tx.loadTheUser(post.createdById)

      throwForbiddenIf(post.nr == PageParts.TitleNr, "EsE5JK8S4", "Cannot tag page titles")

      throwForbiddenIf(post.createdById != me.id && !me.isStaff,
        "EsE2GKY5", "Not your post and you're not staff, so you may not edit tags")

      throwForbiddenIf(post.pageId != pageId,
        "EsE4GKU02", o"""Wrong page id: Post $postId is located on page ${post.pageId},
            not page $pageId — perhaps it was just moved""")

      val oldTags: Set[Tag] = tx.loadTagsForPost(post.id)

      val tagsToAdd = tags -- oldTags
      val tagsToRemove = oldTags -- tags

      COULD_OPTIMIZE // return immediately if tagsToAdd.isEmpty and tagsToRemove.isEmpty.
      // (so won't reindex post)

      tx.addTagsToPost(tagsToAdd, postId, isPage = post.isOrigPost)
      tx.removeTagsFromPost(tagsToRemove, postId)
      tx.indexPostsSoon(post)
      tx.updatePageMeta(pageMeta.copyWithNewVersion, oldMeta = pageMeta,
          markSectionPageStale = false)

      val notifications = NotificationGenerator(tx, context.nashorn).generateForTags(post, tagsToAdd)
      tx.saveDeleteNotifications(notifications)

      (post, notifications, postAuthor)
    }

    refreshPageInMemCache(post.pageId)

    val storePatch = jsonMaker.makeStorePatch(post, postAuthor, showHidden = true)
    pubSub.publish(
      StorePatchMessage(siteId, pageId, storePatch, notifications), byId = postAuthor.id)
    storePatch
  }


  def setTagNotfLevelIfAuth(userId: UserId, tagLabel: TagLabel, notfLevel: NotfLevel,
        byWho: Who) {
    throwForbiddenIf(notfLevel != NotfLevel.WatchingFirst && notfLevel != NotfLevel.Normal,
      "EsE5GK02", s"Only ${NotfLevel.WatchingFirst} and ${NotfLevel.Normal} supported, for tags")
    readWriteTransaction { transaction =>
      val me = transaction.loadTheMember(byWho.id)
      if (me.id != userId && !me.isStaff)
        throwForbidden("EsE4GK9F7", "You may not change someone else's notification settings")

      transaction.setTagNotfLevel(userId, tagLabel, notfLevel)
    }
  }


  def loadTagNotfLevels(userId: UserId, byWho: Who): Map[TagLabel, NotfLevel] = {
    readOnlyTransaction { transaction =>
      val me = transaction.loadTheMember(byWho.id)
      if (me.id != userId && !me.isStaff)
        throwForbidden("EsE8YHKP03", "You may not see someone else's notification settings")

      transaction.loadTagNotfLevels(userId)
    }
  }

}

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
import ed.server.pubsub.StorePatchMessage
import play.api.libs.json.JsValue
import TagsDao._
import scala.util.matching.Regex


object TagsDao {
  val MinTagLength = 2
  val MaxNumTags = 200
  val MaxTagLength = 30

  val WhitespaceRegex: Regex = """.*[\s].*""".r

  // Old, don't use for now — better be a bit restrictive, initially.
  //val OkLabelRegex: Regex = """^[^\s,;|'"<>]+$""".r
  //
  // Instead:
  //
  // Java's  \p{Punct} chars are:  !"#$%&'()*+,-./:;<=>?@[\]^_`{|}~   = 32 chars: Discoure's plus  [_~:-]
  // Discourse disallows:  /?#[]@!$&'()*+,;=.%\`^|{}"<>    = 28 chars
  //
  // I'd like to allow also though:  .  so can type version numbers
  //
  // &&  means should be poth \p{Punct} *and* also not one of [_~:.-], which means Punct
  // but those allowed.
  // See:
  //  - https://stackoverflow.com/q/6279694/694469
  //  - https://docs.oracle.com/javase/6/docs/api/java/util/regex/Pattern.html
  val BadTagLabelCharsRegex: Regex = """.*[\p{Punct}&&[^_~:.-]].*""".r  // sync with SQL [7JES4R3]

  def findTagLabelProblem(tagLabel: TagLabel): Option[ErrorMessageCode] = {
    if (tagLabel.length < MinTagLength)
      return Some(ErrorMessageCode(s"Tag label too short: '$tagLabel'", "TyEMINTAGLEN_"))
    if (tagLabel.length > MaxTagLength)
      return Some(ErrorMessageCode(s"Tag label too long: '$tagLabel'", "TyEMAXTAGLEN_"))
    if (tagLabel.matches(WhitespaceRegex))
      return Some(ErrorMessageCode(s"Bad tag label, contains whitespace: '$tagLabel'", "TyETAGBLANK_"))
    BadTagLabelCharsRegex.findFirstIn(tagLabel) foreach { badChar =>
      return Some(ErrorMessageCode(
        s"Bad tag label: '$tagLabel', contains char: '$badChar'", "TyETAGPUNCT_"))
    }
    None
  }
}


trait TagsDao {
  this: SiteDao =>


  def loadAllTagsAsSet(): Set[TagLabel] =
    readOnlyTransaction(_.loadAllTagsAsSet())


  def loadTagsAndStats(): Seq[TagAndStats] =
    readOnlyTransaction(_.loadTagsAndStats())


  def loadTagsByPostId(postIds: Iterable[PostId]): Map[PostId, Set[TagLabel]] =
    readOnlyTransaction(_.loadTagsByPostId(postIds))


  def loadTagsForPost(postId: PostId): Set[TagLabel] =
    loadTagsByPostId(Seq(postId)).getOrElse(postId, Set.empty)


  def addRemoveTagsIfAuth(pageId: PageId, postId: PostId, tags: Set[Tag], who: Who)
        : JsValue = {

    throwForbiddenIf(tags.size > MaxNumTags,
      "EsE5KG0F3", s"Too many tags: ${tags.size}, max is $MaxNumTags")

    tags.foreach(tagLabel => {
      findTagLabelProblem(tagLabel) foreach { error =>
        throwForbidden(error.code, error.message)
      }
    })

    val (post, notifications, postAuthor) = readWriteTransaction { tx =>
      val me = tx.loadTheParticipant(who.id)
      val pageMeta = tx.loadThePageMeta(pageId)
      val post = tx.loadThePost(postId)
      val postAuthor = tx.loadTheParticipant(post.createdById)

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

      val notifications = notfGenerator(tx).generateForTags(post, tagsToAdd)
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
      val me = transaction.loadTheUser(byWho.id)
      if (me.id != userId && !me.isStaff)
        throwForbidden("EsE4GK9F7", "You may not change someone else's notification settings")

      transaction.setTagNotfLevel(userId, tagLabel, notfLevel)
    }
  }


  def loadTagNotfLevels(userId: UserId, byWho: Who): Map[TagLabel, NotfLevel] = {
    readOnlyTransaction { transaction =>
      val me = transaction.loadTheUser(byWho.id)
      if (me.id != userId && !me.isStaff)
        throwForbidden("EsE8YHKP03", "You may not see someone else's notification settings")

      transaction.loadTagNotfLevels(userId)
    }
  }

}

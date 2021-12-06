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
import talkyard.server.pubsub.StorePatchMessage
import play.api.libs.json.JsObject
import TagsDao._
import scala.util.matching.Regex
import scala.{collection => col}
import scala.collection.{mutable => mut}


object TagsDao {
  val MinTagLength = 2
  // Later: Use MaxLimits, instead of hardcoding here.
  val MaxNumTags = 200
  val MaxTagLength = 30

  // Java's  \p{Punct} chars are:  !"#$%&'()*+,-./:;<=>?@[\]^_`{|}~   = 32 chars,
  // Other software:
  // - StackOverflow: lowercase, '-' instead of space, "avoid punctuation" — but is
  //   it allowed? At least [-.#] are allowed (e.g. a 'c#' tag).
  // - GitHub allows "many" chars incl space and [:/].
  // - Discourse allows [_~:-] but disallows:  /?#[]@!$&'()*+,;=.%\`^|{}"<>
  //
  // See:
  //  - https://stackoverflow.com/q/6279694/694469
  //  - https://docs.oracle.com/javase/6/docs/api/java/util/regex/Pattern.html
  // Old regex: """.*[\p{Punct}&&[^/_~:.-]].*""".r
  private val BadTagNameCharsRegex: Regex =
    """.*[^\p{Alnum} '!?&#%_.:=/^~+*-].*""".r  // sync w SQL [ok_tag_chars]

  private val OnlyAlnumRegex: Regex =
    """[^\p{Alnum}]""".r  // sync w SQL [ok_tag_chars]

  def findTagLabelProblem(tagLabel: TagLabel): Option[ErrorMessageCode] = {
    if (tagLabel.length < MinTagLength)
      return Some(ErrorMessageCode(s"Tag name too short: '${tagLabel
            }', should be at least $MinTagLength", "TyEMINTAGLEN_"))

    // The db indexes primarily alnum chars, so equire at least 2, so there'll be
    // something to index.
    val alnumOnly = OnlyAlnumRegex.replaceAllIn(tagLabel, "")
    if (alnumOnly.length < MinTagLength)
      return Some(ErrorMessageCode(s"Tag name has too few alphanumeric chars: '${tagLabel
            }', should be at least $MinTagLength", "TyEMINTAGLEN2"))

    if (tagLabel.trim != tagLabel)
      return Some(ErrorMessageCode(s"Tag name cannot start or end with spaces", "TyETAG0TRIMD"))
    if (tagLabel.contains("  "))
      return Some(ErrorMessageCode(s"Tag name cannot have 2 spaces together", "TyETAG2SPACES"))
    if (tagLabel.length > MaxTagLength)
      return Some(ErrorMessageCode(s"Tag name too long: '$tagLabel', max length is ${
            MaxTagLength}", "TyEMAXTAGLEN_"))

    BadTagNameCharsRegex.findFirstIn(tagLabel) foreach { badChar =>
      return Some(ErrorMessageCode(
        s"Bad tag name: '$tagLabel', contains char: '$badChar'", "TyETAGPUNCT_"))
    }
    None
  }
}


trait TagsDao {
  this: SiteDao =>


  def getTagTypes(tagTypeIds: Set[TagTypeId]): ImmSeq[TagType] = {
    getAllTagTypesSeq().filter(tt => tagTypeIds.contains(tt.id))
  }


  def getTagTypesSeq(forWhat: Opt[i32], tagNamePrefix: Opt[St]): ImmSeq[TagType] = {
    getAllTagTypesSeq()  // for now
  }


  def getAllTagTypesSeq(): ImmSeq[TagType] = {
    val tagTypes = memCache.lookup[ImmSeq[TagType]](
          mkAllTagTypesKey,
          orCacheAndReturn = Some {
            readTx(_.loadAllTagTypes())
          })
    tagTypes getOrDie "TyE752WG36Y"
  }


  def getTagTypesForTags(tags: Seq[Tag]): Seq[TagType] = {
    // This should be faster than constructing a Set to get O(num-tags).
    // Is O(num-types * num-tags). [On2]. WOULD_OPTIMIZE
    val tagTypes = getAllTagTypesSeq()
    /* Could:
    if (tags.length * tagTypes.length > 2000) {
      val tagTypeIds = tags.map(_.tagTypeId).toSet
      tagTypes.filter(tt => tagTypeIds contains  tt.id)
    } */
    tagTypes.filter(tt => tags.exists(_.tagTypeId == tt.id))
  }


  def createTagType(tagTypeNoId: TagType)(mab: MessAborter): TagType = {
    import mab.{abort, abortIf}
    abortIf(tagTypeNoId.id != NoTagTypeId, "TyE603MWEJ5",
          "Specify tag type id 0")
    // Or call a TagType.validate() fn?  (Or validate(Thoroughly) ?) [mess_aborter]
    debiki.dao.TagsDao.findTagLabelProblem(tagTypeNoId.dispName) foreach { errMsg =>
      abort(errMsg.code, errMsg.message)
    }
    val numTagTypesBef = getAllTagTypesSeq()
    val maxTypes = getMaxLimits(UseCache).maxTagTypes
    abortIf(numTagTypesBef.length + 1 > maxTypes, "TyE4MF72WP3", s"Cannot create more than ${
          maxTypes} tag types")
    val tagType = writeTx { (tx, _) => {
      val nextId = tx.nextTagTypeId()
      val tagType = tagTypeNoId.copy(id = nextId)(IfBadDie)
      tx.upsertTagType(tagType)(mab)
      // Skip StaleStuff, just:
      memCache.remove(mkAllTagTypesKey)
      tagType
    }}
    tagType
  }


  def getTags(forPat: Opt[PatId] = None): ImmSeq[Tag] = {
    val key = mkTagsKey(forPat)
    val tags = memCache.lookup[ImmSeq[Tag]](
          key,
          orCacheAndReturn = Some {
            loadTags(forPat = forPat)
          })
    tags getOrDie "TyE752WG36X"
  }


  def getTagsByPatIds(patIds: Iterable[PatId]): col.Map[PatId, ImmSeq[Tag]] = {
    val tagsByPatId = mut.Map[PatId, ImmSeq[Tag]]()
    for (patId <- patIds) {
      val tags = getTags(forPat = Some(patId))
      tagsByPatId(patId) = tags
    }
    tagsByPatId.withDefaultValue(Nil)
  }


  private def loadTags(forPat: Opt[PatId]): ImmSeq[Tag] = {
    forPat foreach { patId =>
      return readTx(_.loadTagsByPatId(patId))
    }
    unimpl("TyE20EFMG64R")
  }


  @deprecated("Now", "")
  def loadAllTagsAsSet(): Set[TagLabel] =
    readOnlyTransaction(_.loadAllTagsAsSet())


  @deprecated("Now", "")
  def loadTagsByPostId(postIds: Iterable[PostId]): Map[PostId, Set[TagLabel]] =
    readOnlyTransaction(_.loadTagsByPostId(postIds))


  @deprecated("Now", "")
  def loadTagsForPost(postId: PostId): Set[TagLabel] =
    loadTagsByPostId(Seq(postId)).getOrElse(postId, Set.empty)


  def addRemoveTagsIfAuth(toAdd: Seq[Tag], toRemove: Seq[Tag], who: Who)(mab: MessAborter)
          : Set[PostId] = {
    import mab._
    writeTx { (tx, staleStuff) =>
      // (Remove first, maybe frees some ids.)
      tx.removeTags(toRemove)
      var nextTagId = tx.nextTagId()
      toAdd.foreach(tag => {
        // [mess_aborter] call validate(Thoroughly)?
        abortIf(tag.id != NoTagId, "TyETAGWID502", "Tags to add must not have id 0")
        val tagWithId = tag.copy(id = nextTagId)(IfBadDie)
        tx.addTag(tagWithId)
        nextTagId += 1
      })

      val postIdsDirectlyAffected: Set[PostId] =
            toAdd.flatMap(_.onPostId).toSet ++
            toRemove.flatMap(_.onPostId).toSet

      staleStuff.addPagesWithPostIds(postIdsDirectlyAffected, tx)

      val patIdsAffected: Set[PatId] =
            toAdd.flatMap(_.onPatId).toSet ++
            toRemove.flatMap(_.onPatId).toSet

      // For now, skip staleStuff, instead just:
      patIdsAffected.foreach(patId => {
        memCache.remove(mkTagsKey(forPat = Some(patId)))
      })
      // Maybe later:
      // staleStuff.addTagsFor(patIds = patIdsAffected, postIds = ..., pageIds = ...)

      // Pages indirectly affected.
      // Need to rerender cached html, since now some user badge texts should be
      // shown / removed, next to some author names.
      staleStuff.addPagesWithVisiblePostsBy(patIdsAffected, tx)

      // Posts currently not cached. Don't forget to uncache here, [if_caching_posts].

      // These are the only posts we'd need to rerender directly, if
      // the requester edited the current page/post tags.
      postIdsDirectlyAffected
    }
  }


  @deprecated("Now", "Use addRemoveTagsIfAuth(Seq[Tag].. ) instead")
  def addRemoveTagsIfAuth(pageId: PageId, postId: PostId, tags: Set[Tag_old], who: Who)
        : JsObject = {

    throwForbidden("TyE602MEEGJ33")

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

      val oldTags: Set[Tag_old] = tx.loadTagsForPost(post.id)

      val tagsToAdd = tags -- oldTags
      val tagsToRemove = oldTags -- tags

      COULD_OPTIMIZE // return immediately if tagsToAdd.isEmpty and tagsToRemove.isEmpty.
      // (so won't reindex post)

      tx.addTagsToPost(tagsToAdd, postId, isPage = post.isOrigPost)
      tx.removeTagsFromPost(tagsToRemove, postId)
      tx.indexPostsSoon(post)
      tx.updatePageMeta(pageMeta.copyWithNewVersion, oldMeta = pageMeta,
          markSectionPageStale = false)

      // [notfs_bug] Delete for removed tags — also if notf email already sent?
      // But don't re-send notf emails if toggling tag on-off-on-off.... [toggle_like_email]
      val notifications = notfGenerator(tx).generateForTags(post, tagsToAdd)
      tx.saveDeleteNotifications(notifications)

      (post, notifications, postAuthor)
    }

    refreshPageInMemCache(post.pageId)

    val storePatch = jsonMaker.makeStorePatchForPost(post, showHidden = true, reqerId = who.id)
    pubSub.publish(
      StorePatchMessage(siteId, pageId, storePatch, notifications), byId = postAuthor.id)
    storePatch
  }


  def setTagNotfLevelIfAuth(userId: UserId, tagLabel: TagLabel, notfLevel: NotfLevel,
        byWho: Who): Unit = {
    throwUnimpl("TyE5MW2RL5")
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
    throwUnimpl("TyE5MW2RL6")
    readOnlyTransaction { transaction =>
      val me = transaction.loadTheUser(byWho.id)
      if (me.id != userId && !me.isStaff)
        throwForbidden("EsE8YHKP03", "You may not see someone else's notification settings")

      transaction.loadTagNotfLevels(userId)
    }
  }

  // Tags not cached together with Pat:s or pages, to avoid races, [avoid_pat_cache_race]
  // in case a pat's name or a post gets edited by someone, at the same time as
  // tags get added or removed to that pat or post, by someone else.
  private def mkTagsKey(forPat: Opt[PatId]): MemCacheKey = {
    forPat foreach { patId =>
      return MemCacheKey(siteId, s"$patId|PatTgs")
    }
    /*
    forPost foreach { postId =>
      return MemCacheKey(siteId, s"$postId|PoTgs")
    } */
    unimpl("TyE4M6WE24R")
  }

  private def mkAllTagTypesKey: MemCacheKey =
    MemCacheKey(siteId, "AlTgTps")
}

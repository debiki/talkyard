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
import talkyard.server.authz.{MembReqrAndTgt, StaffReqrAndTgt}
import play.api.libs.json.JsObject
import TagsDao._
import scala.util.matching.Regex
import scala.{collection => col}
import scala.collection.{mutable => mut, immutable => imm}


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


case class TagTypesByX(types: ImmSeq[TagType]) {
  val byName: Map[St, TagType] = Map(types.map(t => t.dispName -> t): _*)
  val bySlug: Map[St, TagType] = Map(types.flatMap(t => t.urlSlug.map(_ -> t)): _*)
  val byId: Map[TagTypeId, TagType] = Map(types.map(t => t.id -> t): _*)
  val byRefId: Map[RefId, TagType] = Map(types.flatMap(t => t.refId.map(_ -> t)): _*)
}


trait TagsDao {
  this: SiteDao =>

  import context.security.throwIndistinguishableNotFound


  def getTagTypes(tagTypeIds: Set[TagTypeId]): ImmSeq[TagType] = {
    getAllTagTypesSeq().filter(tt => tagTypeIds.contains(tt.id))
  }


  def getTagTypesByNamesOrSlugs(namesOrSlugs: Iterable[St]): ImmSeq[Opt[TagType]] = {
    val byX = getAllTagTypesByX()
    namesOrSlugs.to[Vec] map { nameOrSlug =>
      // Maybe allow prefixes 'slug:' or 'name:'?  But what if a tag is named 'slug'?
      // And ':' is also used for ':desc' and ':asc', but that's maybe ok, that's
      // *after* the tag slug or name.  But what if one tag is named 'slug', another 'desc'
      // and someone writes:  tag:slug:desc — then, which tag does hen mean?
      val anyType = byX.bySlug.get(nameOrSlug) orElse byX.byName.get(nameOrSlug) orElse {
        // Try id too? As of Aug 2023, not all tag types have url slugs, and there might
        // be spaces in their names, which the search query parser currently
        // can't handle  [search_q_param_space].  So, w/o this, couldn't search
        // for such tags.
        nameOrSlug.toIntOption flatMap { maybeId =>
          byX.byId.get(maybeId)
        }
      }
      anyType
    }
  }


  def resolveTypeRefs(refs: Iterable[TypeRef]): ImmSeq[Opt[TagType]] = {
    val byX = getAllTagTypesByX()
    refs.to[Vec] map {
      case ParsedRef.ExternalId(refId) =>
        byX.byRefId.get(refId)
      case ParsedRef.Slug(slug) =>
        byX.bySlug.get(slug)
    }
  }


  def getTagTypesBySlug(): Map[St, TagType] = {
    getAllTagTypesByX().bySlug
  }


  def getTagTypesById(): Map[TagTypeId, TagType] = {
    getAllTagTypesByX().byId
  }


  def getTagTypesByRefId(): Map[RefId, TagType] = {
    getAllTagTypesByX().byRefId
  }


  def getTagTypesSeq(forWhat: Opt[i32], tagNamePrefix: Opt[St]): ImmSeq[TagType] = {
    getAllTagTypesSeq()  // for now
  }


  def getAllTagTypesSeq(): ImmSeq[TagType] = {
    getAllTagTypesByX().types
  }


  /** Types are added and modified infrequently, accessed much more often — so,
    * makes sense to cache in different ways.  Also, there aren't that many types
    * per site (see MaxLimits.maxTagTypes), so might as well cache all?
    */
  private def getAllTagTypesByX(): TagTypesByX = {
    val tagTypes = memCache.lookup[TagTypesByX](
          mkAllTagTypesKey,
          orCacheAndReturn = Some {
            val types = readTx(_.loadAllTagTypes())
            TagTypesByX(types)
          })
    tagTypes getOrDie "TyE752WG36Y"
  }


  def getTagTypesForTags(tags: Seq[Tag]): Seq[TagType] = {
    getTagTypesForIds(tags.map(_.tagTypeId).toSet)
  }


  def getTagTypesForIds(tagIds: Set[TagTypeId]): Seq[TagType] = {
    val tagTypes = getAllTagTypesSeq()
    /* Could:
    if (tags.length * tagTypes.length > 2000) {
      val tagTypeIds = tags.map(_.tagTypeId).toSet
      tagTypes.filter(tt => tagTypeIds contains  tt.id)
    } */
    tagTypes.filter(tt => tagIds.contains(tt.id))
  }


  def upsertTypeIfAuZ(tagTypeMaybeId: TagType, reqrTgt: MembReqrAndTgt)(
        mab: MessAborter): TagType = {
    import mab._

    require(tagTypeMaybeId.createdById == reqrTgt.target.id, "TyE602RDL5")

    // But can mods see / change refids?  Probably should be for admins only.  [who_sees_refid]
    abortDenyIf(!reqrTgt.targetIsCoreMember,
          "TyEDENYREQR05733", "Only core members can edit types")

    // Move this check to  ReqrAndTgt  instead?  [do_as_otr]
    abortDenyIf(reqrTgt.areNotTheSame && !reqrTgt.reqrIsAdmin,
          "TyE0ADM0386", "Only admins can upsert types on behalf of others")

    // Or call a TagType.validate() fn?  (Or validate(Thoroughly) ?) [mess_aborter]
    debiki.dao.TagsDao.findTagLabelProblem(tagTypeMaybeId.dispName) foreach { errMsg =>
      abort(errMsg.code, errMsg.message)
    }
    val numTagTypesBef = getAllTagTypesSeq()
    val maxTypes = getMaxLimits(UseCache(this)).maxTagTypes
    abortIf(numTagTypesBef.length + 1 > maxTypes, "TyE4MF72WP3", s"Cannot create more than ${
          maxTypes} tag types")
    val tagType = writeTx { (tx, _) => {
      // If we're updating, the type already has an id.
      val typeId: TagTypeId =
            if (tagTypeMaybeId.id != NoTagTypeId) {  // [type_id_or_ref_id]
              // If both Ty's internal id and a reference id has been specified, then update
              // the reference id, if it's changed. (Can't update Ty's internal ids though;
              // they're part of the primary key.)  So, ignore tagTypeMaybeId.refId.
              tagTypeMaybeId.id
            }
            else {
              // Either we're looking up by ref id to update something, ...
              val anyTypeByRefId = tagTypeMaybeId.refId flatMap { refId =>
                // The mem cache is unlikely to be stale — on any change, we _uncache_the_types.
                RACE // But theoretically it can be stale. Then, what can happen is that we'll
                // try to insert the same type again, with a new internal id? However,
                // since the ref id must also be unique, there'll be a unique key error.
                // That's ok, just not so user friendly, but in practice will never happen.
                getTagTypesByRefId().get(refId)
              }
              anyTypeByRefId.map(_.id) getOrElse {
                // ... or if there's no matching row, we're inserting a new type.
                tx.nextTagTypeId()
              }
            }
      val tagType = tagTypeMaybeId.copy(id = typeId)(IfBadDie)
      tx.upsertTagType(tagType)(mab)
      // Skip StaleStuff, just: _uncache_the_types
      memCache.remove(mkAllTagTypesKey)
      SHOULD_LOG
      tagType
    }}
    tagType
  }


  /** The tags might have values of the nowadays wrong types, if their tag types were
    * altered after the tags were added.
    */
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


  def updateTagsIfAuZ(toAdd: Seq[Tag], toRemove: Seq[Tag], toEdit: Seq[Tag],
          reqrAndTagger: MembReqrAndTgt)(
          mab: MessAborter): Set[PostId] = {
    import mab._

    val reqr: Pat = reqrAndTagger.reqr
    val tagger: Pat = reqrAndTagger.target

    abortDenyIf(!reqrAndTagger.targetIsFullMember,
          "TyETAGPERMS05", "Only full members can tag posts")

    // Only admins may edit tags on others' behalf.  (Move this check eleswhere? [do_as_otr])
    abortDenyIf(reqrAndTagger.areNotTheSame && !reqr.isAdmin,
          "TyETAGOTHRSPO", "Can't edit tags on other people's behalf")

    // Check that any tag values are of the correct type.
    // (Ok to do outside the tx below.  And, if there are already tags with values
    // of the wrong types, we just ignore that.)
    val tagTypesById = getTagTypesById()
    val toAddAndEdit = toAdd ++ toEdit
    for (t <- toAddAndEdit) {
      val tagType: TagType = tagTypesById.getOrElse(t.tagTypeId, {
        abort("TyE0TAGTYPE", s"Cannot create tag of tag-type-id ${t.tagTypeId
                }, there is no such tag type")
      })
      TESTS_MISSING // Open the add tag dialog, edit the type in another dialog,
      // then submit the first dialog?  TyTTAGVALBADTYPE
      abortIf(t.valType.isDefined && t.valType != tagType.valueType,
            "TyETAGTYPE", s"Tag value is of type ${t.valType
              } but should be of type ${tagType.valueType}")
    }

    writeTx { (tx, staleStuff) =>
      val postIdsDirectlyAffected: Set[PostId] =
            toAdd.flatMap(_.onPostId).toSet ++
            toRemove.flatMap(_.onPostId).toSet ++
            toEdit.flatMap(_.onPostId).toSet

      val postsById: Map[PostId, Post] =
            tx.loadPostsByUniqueId(postIdsDirectlyAffected)

      // (Don't:  postsById.values — then we wouldn't find out if a post wasn't found.)
      val postsAffected: Seq[Post] = postIdsDirectlyAffected.toSeq map { postId =>
        postsById.getOrElse(postId, {
          if (tagger.isStaff) abortNotFound("TyEPOST0FND025", s"No post with id $postId")
          else throwIndistinguishableNotFound("POST2TAG")  // [abrt_indist_404]
        })
      }

      val postIdsReqrAndTaggerMustSee = mut.Set[PostId]()
      toAdd.foreach(t => t.onPostId.foreach(postIdsReqrAndTaggerMustSee.add))
      toEdit.foreach(t => t.onPostId.foreach(postIdsReqrAndTaggerMustSee.add))

      postIdsReqrAndTaggerMustSee foreach { postId =>
        val post = postsById.getOrDie(postId, "TyE5028SP4")
        throwIfMayNotSeePost2(ThePost.Here(post), reqrAndTagger)(tx)
      }

      val postIdsOnlyReqrMustSee = toRemove.flatMap(_.onPostId)

      postIdsOnlyReqrMustSee foreach { postId =>
        val post = postsById.getOrDie(postId, "TyE5028SP5")
        throwIfMayNotSeePost2(ThePost.Here(post), reqrAndTagger, checkOnlyReqr = true)(tx)
      }

      // For now, trusted members can tag others' posts. [priv_tags] [ok_tag_own]
      // (Later, will be more fine grained [tag_perms].)
      // (Skip reqr here — we've already verified that reqr may act on tagger's behalf.)
      if (!tagger.isStaffOrTrustedNotThreat) {
        postsAffected foreach { post =>
          abortDenyIf(post.createdById != tagger.id, "TyETAG0YOURPOST",
                s"Can't tag other people's posts, post.createdById (${
                  post.createdById}) != tagger (${tagger.nameParaId})")
        }
      }

      // (Remove first, maybe frees some ids.)
      tx.deleteTags(toRemove)

      // (Update before inserting — trying to update one of the tags being inserted,
      // would likely be a bug? Or at least inefficient.)
      toEdit foreach { tag =>
        tx.updateTag(tag)
      }

      var nextTagId = tx.nextTagId()
      toAdd.foreach(tag => {
        // [mess_aborter] call validate(Thoroughly)?
        abortIf(tag.id != NoTagId, "TyETAGWID502", "Tags to add must not have id 0")
        val tagWithId = tag.copy(id = nextTagId)(IfBadDie)
        tx.insertTag(tagWithId)
        nextTagId += 1
      })

      staleStuff.addPagesWithPostIds(postIdsDirectlyAffected, tx)

      // Reindex the posts, since can search by tags.
      CLEAN_UP  // Use indexPostIdsSoon_unimpl instead, so won't need to
      // look up the posts. — BUT seems we need to look up anyway?  Maybe remove
      // indexPostIdsSoon_unimpl()?
      tx.indexPostsSoon(postsAffected: _*)

      val patIdsAffected: Set[PatId] =
            toAdd.flatMap(_.onPatId).toSet ++
            toRemove.flatMap(_.onPatId).toSet
            toEdit.flatMap(_.onPatId).toSet

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

      // Later, when re-implementing notifcations about tagged pages, see:  [tag_notfs]
      // and maybe PubSub too?  [tag_notfs]

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

      // [pseudonyms_later] Better err msg if one's true user may do this.
      throwForbiddenIf(post.createdById != me.id && !me.isStaff,  // [ok_tag_own]
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
      // Hmm should do this? No, not needed — staleStuff.addPagesWithPostIds()
      // is enough, uncaches the page from both the db & mem caches.
      tx.updatePageMeta(pageMeta.copyWithNewVersion, oldMeta = pageMeta,
          markSectionPageStale = false)

      // Later, when re-enabling notifcations about tagged pages: [tag_notfs]
      // [notfs_bug] Delete for removed tags — also if notf email already sent?
      // But don't re-send notf emails if toggling tag on-off-on-off.... [toggle_like_email]
      val notifications = notfGenerator(tx).generateForTags(
            post, postAuthor = postAuthor, tagsToAdd)
      tx.saveDeleteNotifications(notifications)

      (post, notifications, postAuthor)
    }

    refreshPageInMemCache(post.pageId)

    val storePatch = jsonMaker.makeStorePatchForPost(post, showHidden = true)
    // [tag_notfs]
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

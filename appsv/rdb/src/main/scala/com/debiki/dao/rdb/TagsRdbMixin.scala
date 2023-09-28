/**
 * Copyright (c) 2021 Kaj Magnus Lindberg
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
import Rdb._
import RdbUtil._
import java.sql.{ResultSet => j_ResultSet, SQLException => j_SQLException}
import collection.{mutable => mut}

import TagsRdbMixin._


/** Manages tags on posts and pats.
  */
trait TagsRdbMixin extends SiteTransaction {
  self: RdbSiteTransaction =>


  def nextTagTypeId(): i32 = {
    runQueryFindNextFreeInt32(tableName = "tagtypes_t", columnName = "id_c")
  }


  def loadAllTagTypes(): ImmSeq[TagType] = {
    val query = """
          select * from tagtypes_t where site_id_c = ? """
    runQueryFindMany(query, List(siteId.asAnyRef), parseTagType)
  }


  def loadTagTypeStats(): ImmSeq[TagTypeStats] = {
    /* UX: Load unused tag types too.
    // Would this work, to load alla tagtype fields too? Or does the 'group by'
    // need to list all tagtype fields?
    val query = """
          select tt.*,
            sum(one_unless_null(on_post_id_c)) num_post_tags,
            sum(one_unless_null(on_pat_id_c))  num_pat_badges
          from tagtypes_t tt left outer join tags_t t
              on tt.site_id_c = t.site_id_c
              and tt.id_c = t.tagtype_id_c
          where tt.site_id_c = ?
          group by tt.tagtype_id_c
          """ */
    val query = """ -- loadTagTypeStats
          select
            tagtype_id_c,
            count(*) num_total,
            sum(one_unless_null(on_post_id_c)) num_post_tags,
            sum(one_unless_null(on_pat_id_c))  num_pat_badges
          from tags_t
          where site_id_c = ?
          group by tagtype_id_c
          """
    runQueryFindMany(query, List(siteId.asAnyRef), rs => {
      TagTypeStats(
            tagTypeId = getInt32(rs, "tagtype_id_c"),
            numTotal = getInt32(rs, "num_total"),
            // How can any of these be null, in spite of one_unless_null() above,
            // which always returns 0 or 1? Anyway, let's just use getOpt... getOrElse 0.
            // (Note that we're selecting from tags_t, not joining with tagtypes_t.)
            numPostTags = getOptInt32(rs, "num_post_tags") getOrElse 0,
            numPatBadges = getOptInt32(rs, "num_pat_badges") getOrElse 0)
    })
  }


  def upsertTagType(tagType: TagType)(mab: MessAborter): U = {
    // Or:  tagType.validate(Thoroughly, IfBadDie)  instead of require()... here?  [mess_aborter]
    require(tagType.id >= 1, s"Bad tagtype id: ${tagType.id} [TyE03MFP64]")

    // If  adding fields long_name_c and abbr_name_c, make sure those, and disp_name_c,
    // are different from all other long, normal and abbr names?
    // So that no long_name_c anywhere is the same as any disp_name_c or
    // abbr_name_c, for example (and also isn't the same as any long_name_c of course,
    // but the database helps us with that — see the isUniqueConstrViolation()
    // try-catch below).
    val statement = s"""
          insert into tagtypes_t (
              site_id_c,
              id_c,
              ref_id_c,
              can_tag_what_c,
              url_slug_c,
              disp_name_c,
              created_by_id_c,
              wants_value_c,
              value_type_c)
          values (?, ?, ?, ?, ?, ?, ?, ?, ?)
          -- It's ok to always use id_c, not ref_id_c, see: [type_id_or_ref_id].
          on conflict (site_id_c, id_c) do update set
              ref_id_c = excluded.ref_id_c,
              can_tag_what_c = excluded.can_tag_what_c,
              url_slug_c = excluded.url_slug_c,
              disp_name_c = excluded.disp_name_c,
              -- leave created_by_id_c as is
              wants_value_c = excluded.wants_value_c,
              value_type_c = excluded.value_type_c
              """
    val values = List(
          siteId.asAnyRef,
          tagType.id.asAnyRef,
          tagType.refId.orNullVarchar,
          tagType.canTagWhat.asAnyRef,
          tagType.urlSlug.orNullVarchar,
          tagType.dispName,
          tagType.createdById.asAnyRef,
          tagType.wantsValue.map(_.toInt).orNullInt32,
          tagType.valueType.map(_.toInt).orNullInt32,
          )

    try runUpdateExactlyOneRow(statement, values)
    catch {
      case ex: j_SQLException if isUniqueConstrViolation(ex) =>
        var errMsg = ""
        val thereIs = "There is already a tag type with that "

        if (uniqueConstrViolatedIs("tagtypes_u_anypat_urlslug", ex)) {
          errMsg = thereIs + "url slug"
        }
        else if (uniqueConstrViolatedIs("tagtypes_u_anypat_dispname", ex)) {
          errMsg = thereIs + "name"
        }
        else if (uniqueConstrViolatedIs("tagtypes_u_anypat_longname", ex)) {
          errMsg = thereIs + "long name"
        }
        else if (uniqueConstrViolatedIs("tagtypes_u_anypat_abbrname", ex)) {
          errMsg = thereIs + "abbreviated name"
        }

        if (errMsg.isEmpty) throw ex
        else mab.abort("TyETAGTYPE0UNQ", errMsg)
    }
  }


  def hardDeleteTagType(tagType: TagType): Bo = {
    throwUntested("TyE62MSEGJ") // won't work if there're still tags (foreign keys)
    val statement = s"""
          delete from tagtypes_t where site_id_c = ? and id_c = ? """
    val values = List(siteId.asAnyRef, tagType.id.asAnyRef)
    runUpdateSingleRow(statement, values)
  }


  def loadTagsByPatId(patId: PatId): ImmSeq[Tag] = {
    val query = """
          select * from tags_t where site_id_c = ? and on_pat_id_c = ? """
    runQueryFindMany(query, List(siteId.asAnyRef, patId.asAnyRef), parseTag)
  }


  def loadTagsForPages(pageIds: Iterable[PageId]): Map[PageId, ImmSeq[Tag]] = {
    val values = siteId.asAnyRef :: pageIds.toList
    val query = s""" -- loadTagsForPages
          select po.page_id, t.* from tags_t t
              inner join posts3 po
                  on po.site_id = t.site_id_c
                  and po.site_id = ?  -- this and...
                  and po.page_id in (${ makeInListFor(pageIds) })
                  and po.unique_post_id = t.on_post_id_c
                  and po.post_nr = $BodyNr
          -- where t.site_id = ?  -- this should be equivalent [join_on_or_where]
          """
    runQueryBuildMultiMap(query, values, rs => {
      val pageId = getString(rs, "page_id")
      val tag = parseTag(rs)
      pageId -> tag
    })
  }


  def loadTagsToRenderSmallPage(pageId: PageId): Seq[Tag] = {
    // Small page, we can load all tags. [large_pages]
    // But if page large, say, 10 000+ posts, then maybe not.
    // Load both post tags and pat tags (post author user badges).
    val query = """ -- loadTagsToRenderSmallPage
          select t.* from tags_t t
              inner join posts3 po
                  on po.site_id = t.site_id_c
                  and po.site_id = ?  -- this and...
                  and po.page_id = ?
                  and (po.unique_post_id = t.on_post_id_c  or
                       po.created_by_id  = t.on_pat_id_c)
          -- where t.site_id = ?  -- this should be equivalent [join_on_or_where]
          """
    runQueryFindMany(query, List(siteId.asAnyRef, pageId.asAnyRef), parseTag)
  }


  def loadAllTags_forExport(): ImmSeq[Tag] = {
    val query = """ -- loadAllTags_forExport
          select * from tags_t where site_id_c = ?  """
    runQueryFindMany(query, List(siteId.asAnyRef), parseTag)
  }


  override def loadPostTagsAndAuthorBadges(postIds: Iterable[PostId]): TagsAndBadges = {
    if (postIds.isEmpty)
      return TagsAndBadges(
            Map.empty.withDefaultValue(Nil),
            Map.empty.withDefaultValue(Nil))

    val query = s""" -- loadPostTagsAndAuthorBadges
          -- Post tags
          select * from tags_t
          where site_id_c = ?
            and on_post_id_c in (${ makeInListFor(postIds) })
          union
          -- Post author user badges
          select t.*
          from tags_t t inner join posts3 po
            on t.site_id_c = po.site_id
            and t.on_pat_id_c = po.created_by_id
            and po.site_id = ?
            and po.unique_post_id in (${ makeInListFor(postIds) })
          """
    var values = siteId.asAnyRef :: postIds.toList.map(_.asAnyRef)
    values = values:::values

    val tagsByPostId = mut.Map[PostId, MutArrBuf[Tag]]()
    val tagsByPatId = mut.Map[PatId, MutArrBuf[Tag]]()

    runQueryAndForEachRow(query, values, rs => {
      val tag = parseTag(rs)
      if (tag.onPostId.isDefined) {
        val postId: PostId = tag.onPostId getOrDie "TyE4MFE6780"
        val anyTags: Opt[MutArrBuf[Tag]] = tagsByPostId.get(postId)
        val tags = anyTags getOrElse MutArrBuf[Tag]()
        tags.append(tag)
        if (anyTags.isEmpty) {
          tagsByPostId(postId) = tags
        }
      }
      else if (tag.onPatId.isDefined) {
        val patId = tag.onPatId getOrDie "TyEJ503MRE"
        val anyTags: Opt[MutArrBuf[Tag]] = tagsByPatId.get(patId)
        val tags = anyTags getOrElse MutArrBuf[Tag]()
        tags.append(tag)
        if (anyTags.isEmpty) {
          tagsByPatId(patId) = tags
        }
      }
      else {
        die("TyE0WME573")
      }
    })

    TagsAndBadges(
          tags = tagsByPostId.withDefaultValue(MutArrBuf[Tag]()),
          badges = tagsByPatId.withDefaultValue(MutArrBuf[Tag]()))
  }


  def nextTagId(): i32 = {
    runQueryFindNextFreeInt32(tableName = "tags_t", columnName = "id_c")
  }


  def insertTag(tag: Tag): U = {
    val statement = s"""
          insert into tags_t (
              site_id_c,
              id_c,
              tagtype_id_c,
              parent_tag_id_c,
              on_pat_id_c,
              on_post_id_c,
              val_type_c,
              val_i32_c,
              val_f64_c,
              val_str_c)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) """
    val values = List(
          siteId.asAnyRef,
          tag.id.asAnyRef,
          tag.tagTypeId.asAnyRef,
          tag.parentTagId_unimpl.orNullInt,
          tag.onPatId.orNullInt,
          tag.onPostId.orNullInt,
          tag.valType.map(_.toInt).orNullInt,
          tag.valInt32.orNullInt,
          tag.valFlt64.orNullFloat64,
          tag.valStr.trimOrNullVarchar)
    runUpdateExactlyOneRow(statement, values)
  }


  def updateTag(tag: Tag): U = {
    val statement = s"""
          update tags_t set
            val_type_c = ?,
            val_i32_c = ?,
            val_f64_c = ?,
            val_str_c = ?
          where site_id_c = ?
            and id_c = ? """
    val values = List(
          tag.valType.map(_.toInt).orNullInt,
          tag.valInt32.orNullInt,
          tag.valFlt64.orNullFloat64,
          tag.valStr.trimOrNullVarchar,
          siteId.asAnyRef,
          tag.id.asAnyRef)
    runUpdateExactlyOneRow(statement, values)
  }


  def deleteTags(tags: Seq[Tag]): U = {
    if (tags.isEmpty) return ()
    val statement = s"""
          delete from tags_t where site_id_c = ? and id_c in (${makeInListFor(tags)}) """
    val values = siteId.asAnyRef :: tags.map(_.id.asAnyRef).toList
    runUpdate(statement, values)
  }
}


object TagsRdbMixin {

  def parseTagType(rs: j_ResultSet): TagType = {
    TagType(
          id = getInt(rs, "id_c"),
          refId = getOptString(rs, "ref_id_c"),
          canTagWhat = getInt(rs, "can_tag_what_c"),
          urlSlug = getOptString(rs, "url_slug_c"),
          dispName = getString(rs, "disp_name_c"),
          createdById = getInt(rs, "created_by_id_c"),
          wantsValue = NeverAlways.fromOptInt(getOptInt(rs, "wants_value_c")),
          valueType = getOptInt(rs, "value_type_c").flatMap(TypeValueType.fromInt),
          )(IfBadDie)
  }


  def parseTag(rs: j_ResultSet): Tag = {
    Tag(id = getInt(rs, "id_c"),
          tagTypeId = getInt(rs, "tagtype_id_c"),
          parentTagId_unimpl = getOptInt32(rs, "parent_tag_id_c"),
          onPatId = getOptInt32(rs, "on_pat_id_c"),
          onPostId = getOptInt32(rs, "on_post_id_c"),
          valType = getOptInt32(rs, "val_type_c").flatMap(TypeValueType.fromInt),
          valInt32 = getOptInt32(rs, "val_i32_c"),
          valFlt64 = getOptFloat64(rs, "val_f64_c"),
          valStr = getOptString(rs, "val_str_c"),
          // val_url_c — later
          // val_jsonb_c
          )(IfBadDie)
  }

}

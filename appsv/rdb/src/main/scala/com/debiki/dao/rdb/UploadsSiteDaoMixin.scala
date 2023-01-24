/**
 * Copyright (c) 2015 Kaj Magnus Lindberg
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
import scala.collection.mutable.ArrayBuffer
import Rdb._


/** Saves metadata about file uploads. The files themselves are stored elsewhere, e.g.
  * in the filesystem or in Google Cloud Storage or Amazon S3 + a CDN.
  */
trait UploadsSiteDaoMixin extends SiteTransaction {
  self: RdbSiteTransaction =>


  def loadUploadedFileMeta(uploadRef: UploadRef): Option[(Int, String)] = {
    val query = """
      select size_bytes, mime_type from uploads3
      where base_url = ? and hash_path = ?
      """
    runQueryFindOneOrNone(query, List(uploadRef.baseUrl, uploadRef.hashPath), row => {
      (row.getInt("size_bytes"), row.getString("mime_type"))
    })
  }


  def insertUploadedFileMeta(uploadRef: UploadRef, sizeBytes: Int, mimeType: String,
        dimensions: Option[(Int, Int)]) {
    dieIf(mimeType eq null, "EsE5KY3U2")
    // COULD use `insert ... on conflict do nothing` here once have upgraded to Postgres 9.5.
    val (width, height) = dimensions match {
      case Some((w, h)) => (w.asAnyRef, h.asAnyRef)
      case None => (NullInt, NullInt)
    }
    val statement = """
      insert into uploads3(
        base_url, hash_path, original_hash_path,
        num_references, size_bytes, mime_type, width, height,
        uploaded_at, updated_at, unused_since)
      select
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        now_utc(), now_utc(), now_utc()
      -- For now, until Postgres 9.5 which will support `insert ... on conflict do nothing`:
      -- (Race condition: another session might insert just after the select – or does
      -- the serializable isolation level prevent that?)
      where not exists (
        select 1 from uploads3
        where base_url = ? and hash_path = ?)
      """
    val values = List(
      uploadRef.baseUrl, uploadRef.hashPath, uploadRef.hashPath,
      0.asAnyRef, sizeBytes.asAnyRef, mimeType, width, height,
      uploadRef.baseUrl, uploadRef.hashPath)

    // No point in handling unique errors — the transaction would be broken even if we detect them.
    runUpdateSingleRow(statement, values)

    // There might have been refs to this upload already, for some weird reason.
    updateUploadedFileReferenceCount(uploadRef)

    val siteIdsUsingUpload = loadSiteIdsUsingUpload(uploadRef)
    updateUploadQuotaUse(siteIdsUsingUpload, uploadRef, deltaUploads = 1,
      anyDeltaBytes = Some(sizeBytes))
  }


  def deleteUploadedFileMeta(uploadRef: UploadRef) {
    unimplemented("deleting uploaded file meta")
  }


  def insertUploadedFileReference(postId: PostId, uploadRef: UploadRef,
        addedByTrueId: TrueId) {
    val siteIdsUsingUploadBefore = loadSiteIdsUsingUpload(uploadRef)

    // COULD use `insert ... on conflict do nothing` here once have upgraded to Postgres 9.5.
    // Then remove `where not exists`
    val statement = """
      insert into upload_refs3(
        site_id, post_id, base_url, hash_path, added_by_id, added_by_true_id_c, added_at)
      select ?, ?, ?, ?, ?, ?, now_utc()
      where not exists (
        select 1 from upload_refs3
        where site_id = ? and post_id = ? and base_url = ? and hash_path = ?)
      """
    val values = List(
      siteId.asAnyRef, postId.asAnyRef, uploadRef.baseUrl, uploadRef.hashPath,
      addedByTrueId.curId.asAnyRef, addedByTrueId.anyTrueId.orNullInt,
      siteId.asAnyRef, postId.asAnyRef, uploadRef.baseUrl, uploadRef.hashPath)

    try runUpdateSingleRow(statement, values)
    catch {
      case ex: js.SQLException =>
        if (!isUniqueConstrViolation(ex) || !uniqueConstrViolatedIs("dw2_uplpst__p", ex))
          throw ex
      // Else: all fine: this post links to the uploaded file already.
    }

    updateUploadedFileReferenceCount(uploadRef)
    if (!siteIdsUsingUploadBefore.contains(siteId)) {
      updateUploadQuotaUse(Set(siteId), uploadRef, deltaUploads = 1)
    }
  }


  def deleteUploadedFileReference(postId: PostId, uploadRef: UploadRef): Boolean = {
    val statement = """
      delete from upload_refs3
      where site_id = ? and post_id = ? and base_url = ? and hash_path = ?
      """
    val values = List(siteId.asAnyRef, postId.asAnyRef, uploadRef.baseUrl,
      uploadRef.hashPath)
    val gone = runUpdateSingleRow(statement, values)
    updateUploadedFileReferenceCount(uploadRef)
    val siteIdsUsingUpload = loadSiteIdsUsingUpload(uploadRef)
    if (gone && !siteIdsUsingUpload.contains(siteId)) {
      updateUploadQuotaUse(Set(siteId), uploadRef, deltaUploads =  - 1)
    }
    gone
  }


  def loadUploadedFileReferences(postId: PostId): Set[UploadRef] = {
    val query = """
      select * from upload_refs3
      where site_id = ? and post_id = ?
      """
    val result = ArrayBuffer[UploadRef]()
    runQuery(query, List(siteId.asAnyRef, postId.asAnyRef), rs => {
      while (rs.next) {
        result.append(UploadRef(
          baseUrl = rs.getString("base_url"),
          hashPath = rs.getString("hash_path")))
      }
    })
    result.toSet
  }


  def filterUploadRefsInUse(uploadRefs: Iterable[UploadRef]): Set[UploadRef] = {
    if (uploadRefs.isEmpty)
      return Set.empty

    val values = ArrayBuffer[AnyRef]()
    val orUploadRefsTests = StringBuilder.newBuilder
    val orAvatarTinyRefsTests = StringBuilder.newBuilder
    val orAvatarSmallRefsTests = StringBuilder.newBuilder
    val orAvatarMediumRefsTests = StringBuilder.newBuilder

    uploadRefs foreach { ref =>
      orUploadRefsTests.append(" or (base_url = ? and hash_path = ?)")
      values.append(ref.baseUrl, ref.hashPath)
    }

    uploadRefs foreach { ref =>
      orAvatarTinyRefsTests.append(" or (avatar_tiny_base_url = ? and avatar_tiny_hash_path = ?)")
      values.append(ref.baseUrl, ref.hashPath)
    }

    uploadRefs foreach { ref =>
      orAvatarSmallRefsTests.append(
        " or (avatar_small_base_url = ? and avatar_small_hash_path = ?)")
      values.append(ref.baseUrl, ref.hashPath)
    }

    uploadRefs foreach { ref =>
      orAvatarMediumRefsTests.append(
        " or (avatar_medium_base_url = ? and avatar_medium_hash_path = ?)")
      values.append(ref.baseUrl, ref.hashPath)
    }

    val query = s"""
      select distinct base_url bu, hash_path hp from upload_refs3
        where false $orUploadRefsTests
      union
      select distinct avatar_tiny_base_url bu, avatar_tiny_hash_path hp from users3
        where false $orAvatarTinyRefsTests
      union
      select distinct avatar_small_base_url bu, avatar_small_hash_path hp from users3
        where false $orAvatarSmallRefsTests
      union
      select distinct avatar_medium_base_url bu, avatar_medium_hash_path hp from users3
        where false $orAvatarMediumRefsTests
      """
    val ids = runQueryFindMany[UploadRef](query, values.toList, row => {
      UploadRef(row.getString("bu"), row.getString("hp"))
    })
    ids.toSet
  }


  def loadSiteIdsUsingUploadImpl(ref: UploadRef, onlySiteId: Option[SiteId]): Set[SiteId] = {
    val siteIdEqAnd = onlySiteId.isDefined ? "site_id = ? and" | ""
    val query = s"""
      select distinct site_id from upload_refs3
        where $siteIdEqAnd base_url = ? and hash_path = ?
      union
      select distinct site_id from users3
        where (avatar_tiny_base_url = ? and avatar_tiny_hash_path = ?)
           or (avatar_small_base_url = ? and avatar_small_hash_path = ?)
           or (avatar_medium_base_url = ? and avatar_medium_hash_path = ?)
      """
    val values = onlySiteId.map(_.asAnyRef).toList ::: List(
      ref.baseUrl, ref.hashPath,
      ref.baseUrl, ref.hashPath,
      ref.baseUrl, ref.hashPath,
      ref.baseUrl, ref.hashPath)
    val ids = runQueryFindMany[SiteId](query, values, row => {
      row.getInt("site_id")
    })
    ids.toSet
  }


  def updateUploadedFileReferenceCount(uploadRef: UploadRef) {
    val statement = """select * from "update_upload_ref_count"(?, ?)"""
    val values = List(
      uploadRef.baseUrl, uploadRef.hashPath)
    runQuery(statement, values, rs => ())
  }


  def updateUploadQuotaUse(uploadRef: UploadRef, wasAdded: Boolean) =
    updateUploadQuotaUse(Set(siteId), uploadRef, deltaUploads = wasAdded ? 1 | -1)


  def updateUploadQuotaUse(siteIds: Set[SiteId], uploadRef: UploadRef,
        deltaUploads: Int, anyDeltaBytes: Option[Int] = None) {
    if (siteIds.isEmpty)
      return

    val deltaBytes: Int = anyDeltaBytes getOrElse {
      loadUploadedFileMeta(uploadRef) match {
        case Some((bytes, mimeType)) => math.signum(deltaUploads) * bytes
        case None =>
          COULD // log warning, since the file is gone so we cannot remove the quota it uses/used
          // Don't add/remove just deltaUploads though, because this might result in e.g.
          // 3 files that uses 0 bytes, or 0 files that uses 10 000 bytes.
          return
      }
    }
    dieIf((deltaUploads > 0) != (deltaBytes > 0), "EsE7YMK3")
    val statement = s"""
      update sites3 set
        num_uploads = num_uploads + ?,
        num_upload_bytes = num_upload_bytes + ?
      where id in (${ RdbUtil.makeInListFor(siteIds) })
      """
    val values = List(deltaUploads, deltaBytes) ::: siteIds.toList
    runUpdateExactNumRows(siteIds.size, statement, values.map(_.asAnyRef))
  }

}




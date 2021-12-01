/**
 * Copyright (C) 2012 Kaj Magnus Lindberg (born 1979)
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

package com.debiki.core

import Prelude._
import java.{util => ju}


case class OverQuotaException(
  siteId: SiteId,
  resourceUsage: ResourceUse)
  extends DebikiException("", "") {

  override def getMessage = {
    val diskBytes = resourceUsage.estimatedDbBytesUsed
    val diskMiB = diskBytes.toDouble / Mebibyte64
    //val diskMayUse = resourceUsage.quotaLimitMbs * Mebibyte64
    //val diskPercent = diskBytes.toDouble / diskMayUse.toDouble
    val fileBytes = resourceUsage.fileStorageUsedBytes
    val fileMiB = fileBytes.toDouble / Mebibyte64
    //val fileMayUse = resourceUsage.fileSysQuotaMiBs * Mebibyte64

    s"s$siteId: Disk quota exceeded, db uses ${diskBytes} bytes, fs ${
          fileBytes} bytes [TyE9Z53K7]"
    //s"fs: ${ resourceUsage.fileStorageUsedBytes} of ${resourceUsage.fileSysQuotaMiBs} MiB")
    //s"$details [TyE9Z53K7]"
  }

}


case class ResourceUse(
   quotaLimitMbs: Opt[i32] = None,     // RENAME rdbQuotaMiBs and move to Site
   fileSysQuotaMiBs: Opt[i32] = None,  // RENAME fileQuotaMiBs and move to Site
   numAuditRows: Int = 0,
   numGuests: Int = 0,
   numIdentities: Int = 0,
   numParticipants: Int = 0,
   numPages: Int = 0,
   numPageParticipants: Int = 0,
   numPosts: Int = 0,
   numPostTextBytes: Long = 0,
   numPostRevisions: Int = 0,
   numPostRevBytes: Long = 0,
   numPostsRead: Long = 0,
   numActions: Int = 0,
   // numCategories
   // numTagDefinitions
   // numTagSets
   // numTagInstances
   numUploads: Int = 0,
   numUploadBytes: Long = 0,
   numNotfs: Int = 0,
   numEmailsSent: Int = 0,
) {

  def databaseStorageLimitBytes: Opt[i64] = quotaLimitMbs.map(_.toLong * Mebibyte64)

  def rdbQuotaMiBs: Opt[i32] = quotaLimitMbs

  def fileStorageLimitBytes: Opt[i64] = fileSysQuotaMiBs.map(_.toLong * Mebibyte64)

  def fileQuotaMiBs: Opt[i32] = fileSysQuotaMiBs

  def fileStorageUsedBytes: i64 =
    numUploadBytes
    // later: also += num local backup bytes? private uploads bytes?
    // E.g. if generates a backup, it's saved on the local file system
    // — then, include here.

  override def toString = o"""
    ResourceUse(
     quotaLimitMbs: $quotaLimitMbs,
     numAuditRows: $numAuditRows,
     numGuests: $numGuests,
     numIdentities: $numIdentities,
     numParticipants: $numParticipants,
     numPages: $numPages,
     numPageParticipants: $numPageParticipants,
     numPosts: $numPosts,
     numPostTextBytes: $numPostTextBytes,
     numPostRevisions: $numPostRevisions,
     numPostRevBytes: $numPostRevBytes,
     numPostsRead: $numPostsRead,
     numActions: $numActions,
     numUploads: $numUploads,
     numUploadBytes: $numUploadBytes,
     numNotfs: $numNotfs,
     numEmailsSent: $numEmailsSent)"""

  // Let's guess 2kB if I don't know better, and multiply by 3 to stay on the
  // safe side (i.e. overestimate disk usage, so a site's estimated disk usage will
  // shrink in the future, when these estimates are adjusted).
  def estimatedDbBytesUsed: i64 =
    0L +
    numAuditRows      * 2000 * 3 +  // ??
    numGuests         * 2000 * 3 +  // ??
    numIdentities     * 2000 * 3 +  // ??
    numParticipants   * 2000 * 3 +  // ??
    numPages          * 2000 * 3 +  // ??
    numPageParticipants * 2000 * 3 +  // ??
    numPosts          * 2000 * 3 * 2 +  // ??, plus *2 for the full text search index
    numPostTextBytes  * 3 + // *3 because of the full text search index. I'm just guessing
    numPostRevisions  * 2000 * 3 +  // ??
    numPostRevBytes +
    numPostsRead      *  500 * 3 +  // ??
    numActions        *  500 * 3 +
    numUploads        * 1000 * 3 +  // ??
    //numUploadBytes +  — no, these files aren't stored in the database.
    numNotfs          * 2000 * 3 +  // ??
    numEmailsSent     * 2000 * 3

}


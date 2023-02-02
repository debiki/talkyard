/**
 * Copyright (c) 2020 Kaj Magnus Lindberg and Debiki AB
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

import com.debiki.core.Prelude._
import play.api.libs.json.JsValue


object LinkPreviewTypes {
  // Later:
  val MetaAndOpenGarphTags = 1 // <title> and <description>, and og: ... tags.

  // For now:
  val OEmbed = 3
}

/** Both link_url_c and fetched_from_url_c are part of the database primary key
  * — otherwise an attacker's website A could slightly mess upp the
  * LinkPreiew data for another website, see: [lnpv_t_pk].
  *
  * @param linkUrl: The thing to embed.
  * @param fetchedFromUrl:
  *  Previews for the same link url can get fetched with different oEmbed
  *  maxwidth=... etc params, for different device sizes / resolutions,
  *  and each params combination is then a different fetched_from_url_c.
  *  For OpenGraph, fetched_from_url_c is the same as link_url_c,
  *  but for oEmbed, it instead the oEmbed API endpoint.
  *
  * @param fetchedAt
  * @param cache_max_secs_c — thereafter, try to re-fetch the preview
  * @param statusCode: 0 if the request failed, e.g. couldn't connect to server.
  * @param previewType
  * @param firstLinkedById
  * @param contentJson — as of now: the oEmbed response.
  *   Later: could also be OpenGraph stuff or { title: ... descr: ... }
  *   from < title> and < descr> tags.  JsNull if the request failed.
  */
case class LinkPreview(
  linkUrl: String,
  fetchedFromUrl: String,
  fetchedAt: When,
  // cache_max_secs_c: Option[Int] — later
  statusCode: Int,
  previewType: Int, // always oEmbed, for now
  firstLinkedById: UserId,
  contentJson: JsValue) {

  // For now:
  require(previewType == LinkPreviewTypes.OEmbed, "TyE50RKSDJJ4")

  // Later:
  if (previewType != LinkPreviewTypes.OEmbed) {
    require(linkUrl == fetchedFromUrl, "TyE603MSKU74")
  }
}


case class Link(
  fromPostId: PostId,
  linkUrl: String,
  addedAt: When,
  addedById: UserId,
  isExternal: Boolean,
  toStaffSpace: Boolean = false,
  toPageId: Option[PageId] = None,
  toPostId: Option[PostId] = None,
  toPpId: Opt[PatId] = None,   // RENAME to toPatId
  toTagId: Option[TagDefId] = None,
  toCategoryId: Option[CategoryId] = None) {

  // Not impl (only to-page links impl)
  dieIf(toStaffSpace, "Staff/admin area links not impl [TyE5SKDJ02]")
  dieIf(toPostId.isDefined, "Post links not impl [TyE5SKDJ00]")
  dieIf(toPpId.isDefined, "Participant links not impl [TyE703WKTDL5]")
  dieIf(toTagId.isDefined, "Tag links not impl [TyE5928SK]")
  dieIf(toCategoryId.isDefined, "Category links not impl [TyE5603RDH6]")

  dieIf(isExternal.toZeroOne + toStaffSpace.toZeroOne + toPageId.oneIfDefined +
        toPostId.oneIfDefined + toPpId.oneIfDefined +
        toTagId.oneIfDefined + toCategoryId.oneIfDefined != 1, "TyE063KSUHD5")
}


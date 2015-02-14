/**
 * Copyright (C) 2013 Kaj Magnus Lindberg (born 1979)
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

package com.debiki


package object core {

  type ActionId = Int

  type PostId = ActionId

  type PageId = String

  type SiteId = String

  type LoginId = String

  type UserId = String

  type RoleId = String

  type IdentityId = String

  type IpAddress = String

  type EmailId = String


  /** Where to start rendering a page. The specified post and all its successors
    * will be included in the resulting page. If None, then all top level posts are
    * included (and their successors), that is, all posts with no parent posts.
    */
  type AnyPageRoot = Option[PostId]

  val DefaultPageRoot = Some(PageParts.BodyId)

  type SettingNameValue[A] = (String, A)

  /** Change this to a Long before year 2038. /KajMagnus, Jan 2015 */
  type UnixTime = Int

}


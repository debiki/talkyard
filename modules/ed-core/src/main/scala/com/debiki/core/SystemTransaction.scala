/**
 * Copyright (C) 2015 Kaj Magnus Lindberg (born 1979)
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

import scala.collection.immutable


trait SystemTransaction {
  def commit()
  def rollback()

  /** If test mode, deletes and recreates the database, if there's a validation error.
    */
  def applyEvolutions()

  // ----- Sites

  def siteTransaction(siteId: SiteId): SiteTransaction

  def loadSites(): immutable.Seq[Site]

  def loadSitesWithIds(tenantIds: Seq[SiteId]): Seq[Site]

  def loadSite(siteId: SiteId): Option[Site] =
    loadSitesWithIds(Seq(siteId)).headOption

  def updateSites(sites: Seq[(SiteId, SiteStatus)])

  def lookupCanonicalHost(hostname: String): Option[CanonicalHostLookup]

  def insertSiteHost(tenantId: String, host: SiteHost)
  def deleteAnyHostname(hostname: String): Boolean
  def deleteSiteByName(name: String): Boolean

  //def deleteSite(siteId: SiteId)

  // ----- Users

  def loadUser(siteId: SiteId, userId: UserId): Option[User]

  // ----- Notifications

  def loadNotificationsToMailOut(delayInMinutes: Int, numToLoad: Int)
  : Map[SiteId, Seq[Notification]]

  // ----- Pages

  def loadCachedPageVersion(sitePageId: SitePageId): Option[(CachedPageVersion, SitePageVersion)]
  def loadPageIdsToRerender(limit: Int): Seq[PageIdToRerender]

  // ----- Indexing

  def loadStuffToIndex(limit: Int): StuffToIndex
  def deleteFromIndexQueue(post: Post, siteId: SiteId)
  def addEverythingInLanguagesToIndexQueue(languages: Set[String])

  // ----- Spam check queue

  def loadStuffToSpamCheck(limit: Int): StuffToSpamCheck
  def deleteFromSpamCheckQueue(siteId: SiteId, postId: PostId, postRevNr: Int)

  // ----- Testing

  /** Deletes all data from the database. For example, for a RDBMS,
    * would delete all rows from all tables. (Except for some "static" data.)
    */
  def emptyDatabase()

}


case class DuplicateHostnameException(hostname: String) extends QuickMessageException(
  s"Hostname already exists: '$hostname'")

case class DuplicateUsernameException(username: String) extends QuickMessageException(
  s"Username already exists: '$username'")

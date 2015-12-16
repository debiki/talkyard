/**
 * Copyright (C) 2012-2013 Kaj Magnus Lindberg (born 1979)
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

import com.lambdaworks.crypto.SCryptUtil
import java.{util => ju}
import scala.concurrent.Future
import DbDao._
import EmailNotfPrefs.EmailNotfPrefs
import Prelude._


// SECURITY Todo: Only pass data to Dao via model class instances! (?)
// Never directly e.g. in a String.
// Let each model class validate itself, e.g. check that each String
// conforms to the required format (e.g. [a-z0-9_]+ for page ids).
// Search for "String" in this file -- no match must be found!
// Could actually add a build pipe step that searches this file for String
// and fails the build shoud any String be found?
// (Unless you use model classes, and only model classes, when passing
// data to/from the Dao, then eventually you will forget to validate
// and sanitaze input. That'd be an eventually inconsistent solution :-/ .)


/** Constructs database DAO:s, implemented by service providers,
  * (currently only debiki-dao-pgsql, for Postgres) and used by debiki-server.
  */
abstract class DbDaoFactory {
  def systemDbDao: SystemDbDao

  def migrations: ScalaBasedDatabaseMigrations
  def shutdown()

  final def newDbDao2(): DbDao2 =
    new DbDao2(this)

  protected[core] def newSiteTransaction(siteId: SiteId, readOnly: Boolean,
    mustBeSerializable: Boolean): SiteTransaction
  protected[core] def newSystemTransaction(readOnly: Boolean): SystemTransaction

  /** Helpful for search engine database tests. */
  def debugDeleteRecreateSearchEngineIndexes() {}

  /** Helpful when writing unit test: waits e.g. for ElasticSearch to enter yellow status. */
  def debugWaitUntilSearchEngineStarted() {}

  /** Helpful when writing unit test: waits until ElasticSearch is done indexing stuff. */
  def debugRefreshSearchEngineIndexer() {}

}


@deprecated("Use SystemTransaction instead", "Now")
abstract class SystemDbDao {

  def applyEvolutions()

  def close()  // remove? move to DbDaoFactory in some manner?

  def loadUser(siteId: SiteId, userId: UserId): Option[User]


  // ----- Websites (a.k.a. tenants)

  // COULD rename to loadWebsitesByIds
  def loadTenants(tenantIds: Seq[SiteId]): Seq[Site]

  def loadSite(siteId: SiteId): Option[Site] =
    loadTenants(Seq(siteId)).headOption

  def lookupCanonicalHost(hostname: String): Option[CanonicalHostLookup]


  // ----- Notifications

  def loadNotificationsToMailOut(delayInMinutes: Int, numToLoad: Int)
        : Map[SiteId, Seq[Notification]]


  // ----- Misc

  def checkRepoVersion(): Option[String]

  /** Used as salt when hashing e.g. email and IP, before the hash
   *  is included in HTML. */
  def secretSalt(): String


  // ----- Testing

  // These dangerous functions COULD be moved to a separate artifact,
  // debiki-core-test (?), that only SBT % "test" configs depend on.
  // So one cannot possibly call `emptyDatabase()` when Play.isProd.

  /**
   * Deletes all data from the database. For example, for a RDBMS,
   * would delete all rows from all tables.
   */
  def emptyDatabase()

}



/** Serializes write requests, per site: when one write request to site X is being served,
  * any other write requests block, for site X. I'll change this later to use actors and
  * asynchronous requests, so whole HTTP request handling threads won't be blocked.
  *
class SerializingSiteDbDao(private val _spi: SiteDbDao)
  extends SiteDbDao {


  // ----- Website (formerly "tenant")

  def siteId: SiteId = _spi.siteId

  private def serialize[R](block: =>R): R = {
    import SerializingSiteDbDao._
    var anyMutex = perSiteMutexes.get(siteId)
    if (anyMutex eq null) {
      perSiteMutexes.putIfAbsent(siteId, new java.lang.Object)
      anyMutex = perSiteMutexes.get(siteId)
    }
    anyMutex.synchronized {
      block
    }
  }

}*/


object SerializingSiteDbDao {

  private val perSiteMutexes = new ju.concurrent.ConcurrentHashMap[SiteId, AnyRef]()

}



object DbDao {

  case class SiteAlreadyExistsException(name: String) extends QuickException

  case class TooManySitesCreatedException(ip: String) extends QuickException {
    override def getMessage = "Website creation limit exceeded"
  }

  case class EmailNotFoundException(emailId: String)
    extends RuntimeException("No email with id: "+ emailId)

  case class BadEmailTypeException(emailId: String)
    extends RuntimeException(s"Email with id $emailId has no recipient user id")

  case class EmailAddressChangedException(email: Email, user: User)
    extends QuickException

  case object DuplicateUsername extends RuntimeException("Duplicate username")
  case object DuplicateUserEmail extends RuntimeException("Duplicate user email")
  case object DuplicateGuest extends RuntimeException("Duplicate guest")

  case class IdentityNotFoundException(message: String)
    extends RuntimeException(message)

  case object BadPasswordException extends RuntimeException("Bad password")

  case object EmailNotVerifiedException extends RuntimeException("Email not verified")

  case object DuplicateVoteException extends RuntimeException("Duplicate vote")

  class PageNotFoundException(message: String) extends RuntimeException(message)

  case class PageNotFoundByIdException(
    tenantId: SiteId,
    pageId: PageId,
    details: Option[String] = None)
    extends PageNotFoundException(
      s"Found no page with id: $pageId, tenant id: $tenantId" +
        prettyDetails(details))

  case class PageNotFoundByPathException(
    pagePath: PagePath,
    details: Option[String] = None)
    extends PageNotFoundException(
      s"Found no page at: ${pagePath.value}, tenant id: ${pagePath.tenantId}" +
        prettyDetails(details))

  case class PathClashException(
    existingPagePath: PagePath, newPagePath: PagePath)
    extends RuntimeException

  case class BadPageRoleException(details: String)
    extends RuntimeException

  private def prettyDetails(anyDetails: Option[String]) = anyDetails match {
    case None => ""
    case Some(message) => s", details: $message"
  }

  /** So we know which algorithm was used when hashing a password. */
  val ScryptPrefix = "scrypt:"

  /** Automatic test might use cleartext passwords. */
  val CleartextPrefix = "cleartext:"

  // This could be moved to debiki-server, so the dao won't have this
  // dependency on the password hashing algorithm? Just have the dao module load the
  // password hash, but don't actually check the hash inside the dao.
  def checkPassword(plainTextPassword: String, hash: String) = {
    if (hash.startsWith(ScryptPrefix)) {
      val hashNoPrefix = hash.drop(ScryptPrefix.length)
      SCryptUtil.check(plainTextPassword, hashNoPrefix)
    }
    else if (hash.startsWith(CleartextPrefix)) {
      val cleartext = hash.drop(CleartextPrefix.length)
      plainTextPassword == cleartext
    }
    else if (!hash.contains(':')) {
      die("EsE2PUY8", s"No password algorithm prefix in password hash")
    }
    else {
      val prefix = hash.takeWhile(_ != ':')
      die("EsE4PKUY1", s"Unknown password algorithm: '$prefix'")
    }
  }


  def saltAndHashPassword(plainTextPassword: String): String = {
    // This is what I was using for bcrypt previously: val logRounds = 13 // 10 is the default.
    // Now, scrypt though, with: n = 2^17 = 131072, r = 8, p = 1  -- no, use 2^16 = 65536
    // (2^14 was recommended in 2009 for web apps, and 2^20 for files
    // if waiting 5 seconds was okay. 2^17 is overkill I would think.)
    val hash = SCryptUtil.scrypt(plainTextPassword, 65536, 8, 1)
    s"$ScryptPrefix$hash"
  }

}


// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list

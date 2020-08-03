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
import Prelude._


/** Constructs database DAO:s, implemented by service providers,
  * (currently only debiki-dao-rdb, for Postgres) and used by debiki-server.
  */
abstract class DbDaoFactory {  CLEAN_UP; // Delete this class? And rename DbDao2 to DbTransactionFactory?

  def migrations: ScalaBasedDatabaseMigrations

  final def newDbDao2(): DbDao2 =
    new DbDao2(this)

  protected[core] def newSiteTransaction(siteId: SiteId, readOnly: Bo,
    mustBeSerializable: Bo): SiteTx

  protected[core] def newSystemTransaction(readOnly: Bo, allSitesWriteLocked: Bo): SysTx

}


object DbDao {

  case class SiteAlreadyExistsException(newSite: Site, message: String) extends QuickException

  case class TooManySitesCreatedByYouException(ip: String) extends QuickException {
    override def getMessage = "Website creation limit exceeded"
  }

  case object TooManySitesCreatedInTotalException extends QuickException

  case class EmailNotFoundException(emailId: String)
    extends RuntimeException("No email with id: "+ emailId)

  case class BadEmailTypeException(emailId: String)
    extends RuntimeException(s"Email with id $emailId has no recipient user id")

  case class EmailAddressChangedException(email: Email, user: Participant)
    extends QuickException

  case class DuplicateUsername(username: String) extends RuntimeException(s"Duplicate username: $username")
  case class DuplicateUserEmail(addr: String) extends RuntimeException(s"Duplicate user email: $addr")
  case object DuplicateGuest extends RuntimeException("Duplicate guest")

  object IdentityNotFoundException extends QuickMessageException("Identity not found")
  object NoSuchEmailOrUsernameException extends QuickMessageException("No user with that email or username")
  object EmailNotVerifiedException extends QuickMessageException("Email not verified")
  object MemberHasNoPasswordException extends QuickMessageException("User has no password")
  object BadPasswordException extends QuickMessageException("Bad password")
  object UserDeletedException extends QuickMessageException("User deleted")

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
      s"Found no page at ${pagePath.siteId}:${pagePath.value}" +
        prettyDetails(details))

  case class PathClashException(newPagePath: PagePathWithId)
    extends RuntimeException(s"newPagePath: $newPagePath, value: ${newPagePath.value}")

  case class BadPageRoleException(details: String)
    extends RuntimeException(details)

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
    // Notes:
    // 1) In Dockerfile [30PUK42] Java has been configured to use /dev/urandom — otherwise,
    // the first call to scrypt() here might block for up to 30 minutes, when scrypt
    // blocks when reading for /dev/random, which waits for "enough entropy" (but urandom is fine,
    // see the Dockerfile).
    // 2) This is what I was using for bcrypt previously: val logRounds = 13 // 10 is the default.
    // Now, scrypt though, with: n = 2^17 = 131072, r = 8, p = 1  -- no, use 2^16 = 65536
    // (2^14 was recommended in 2009 for web apps, and 2^20 for files
    // if waiting 5 seconds was okay. 2^17 is overkill I would think.)
    val hash = SCryptUtil.scrypt(plainTextPassword, 65536, 8, 1)
    s"$ScryptPrefix$hash"
  }

}


// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list

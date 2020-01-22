/**
 * Copyright (c) 2011-2016 Kaj Magnus Lindberg
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
import scala.collection.immutable
import scala.util.matching.Regex


object Site {

  /** This site id is returned for any IPv4 address that doesn't match anything,
    * so it'll be possible to access the first site before a domain name has been
    * connected.
    */
  val FirstSiteId: SiteId = 1

  /** So test suites know which id to use. */
  val FirstSiteTestPublicId = "firstsite"

  val GenerateTestSiteMagicId: SiteId = -1
  val MaxTestSiteId: SiteId = -2

  val MinPublSiteIdLength = 8
  val NewPublSiteIdLength = 10
  require(NewPublSiteIdLength >= MinPublSiteIdLength)

  val Ipv4AnyPortRegex: Regex = """(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(:\d+)?""".r

  def newPublId(): PublSiteId = nextRandomString() take NewPublSiteIdLength

  /** Must be a valid host name, not too long or too short (less than 6 chars),
    * no '.' and no leading or trailing '-'. See test suite in SiteCreatorSpec.
    */
  def isOkayName(siteName: String): Boolean =
    findNameProblem(siteName).isEmpty

  def findNameProblem(siteName: String): Option[String] = {
    if (siteName.length > MaxSiteNameLength)
      Some(s"Name too long, max $MaxSiteNameLength chars")
    else if (siteName.length <= 2)
      Some(s"Name too short")
    else if (!OkWebsiteNameRegex.matches(siteName))
      Some("Bad chars, only a-z 0-9 and '-' allowed, must start with a-z")
    else
      None
  }

  /** Shouldn't need more than 70 chars hostname? Even if 'comments-for-...(domain-with-dashes)'
    * local hostnames. — The e2e tests sometimes generate long names though [502KHSRG52]
    * so actually sometimes need 70 chars.
    */
  private val MaxSiteNameLength = 70

  private val OkWebsiteNameRegex = """[a-z][a-z0-9\-]*[a-z0-9]""".r

}


/**
  * @param hostname — doesn't include any port number.
  */
case class SiteBrief(id: SiteId, pubId: PublSiteId, hostname: Option[String], status: SiteStatus) {
  def isTestSite: Boolean = id <= Site.MaxTestSiteId
}



sealed abstract class SiteStatus(val IntValue: Int) {
  def toInt: Int = IntValue
  def mayAddAdmins: Boolean
  def mayAddModerators: Boolean
  def mayAddUsers: Boolean
  def isDeleted: Boolean = false
}


object SiteStatus {

  /** No site admin has been created.
    */
  case object NoAdmin extends SiteStatus(1) {
    def mayAddAdmins = true
    def mayAddModerators = false
    def mayAddUsers = false
  }

  /** "Normal" status. The site is in active use.
    */
  case object Active extends SiteStatus(2) {
    def mayAddAdmins = true
    def mayAddModerators = true
    def mayAddUsers = true
  }

  /** No content can be added, but content can be deleted, by staff, if it's reported as
    * offensive, for example. And more staff can be added, to help deleting any bad content.
    *
    * Useful for a site that's been shut down, but you don't want to remove it from
    * the Internet. Then, you leave it online, read-only — however, staff needs to
    * be able to login and delete any bad contents that might get flagged. So,
    * in addition to reading, one can also delete things.
    */
  case object ReadAndCleanOnly extends SiteStatus(3) {
    def mayAddAdmins = true
    def mayAddModerators = true
    def mayAddUsers = false
  }

  case object HiddenUnlessStaff extends SiteStatus(4) {
    def mayAddAdmins = true
    def mayAddModerators = true
    def mayAddUsers = false
  }

  case object HiddenUnlessAdmin extends SiteStatus(5) {
    def mayAddAdmins = true
    def mayAddModerators = false
    def mayAddUsers = false
  }

  /** Can be undeleted. Only visible to superadmins — others see 404 Not Found,
    * just as if the site had never been created.
    */
  case object Deleted extends SiteStatus(6) {
    def mayAddAdmins = false
    def mayAddModerators = false
    def mayAddUsers = false
    override def isDeleted = true
  }

  /** All contents has been erased from disk, except for a sites table entry.
    * Cannot be undeleted.
    */
  case object Purged extends SiteStatus(7) {
    def mayAddAdmins = false
    def mayAddModerators = false
    def mayAddUsers = false
    override def isDeleted = true
  }

  def fromInt(value: Int): Option[SiteStatus] = Some(value match {
    case SiteStatus.NoAdmin.IntValue => SiteStatus.NoAdmin
    case SiteStatus.Active.IntValue => SiteStatus.Active
    case SiteStatus.ReadAndCleanOnly.IntValue => SiteStatus.ReadAndCleanOnly
    case SiteStatus.HiddenUnlessStaff.IntValue => SiteStatus.HiddenUnlessStaff
    case SiteStatus.HiddenUnlessAdmin.IntValue => SiteStatus.HiddenUnlessAdmin
    case SiteStatus.Deleted.IntValue => SiteStatus.Deleted
    case SiteStatus.Purged.IntValue => SiteStatus.Purged
    case _ => return None
  })
}


/** A website.
  */
case class Site(  // delete? Use only SiteInclDetails instead?
  id: SiteId,
  pubId: PublSiteId,
  status: SiteStatus,
  name: String,
  createdAt: When,
  creatorIp: String,
  hostnames: List[Hostname]) {

  // Reqiure at most 1 canonical host.
  //require((0 /: hosts)(_ + (if (_.isCanonical) 1 else 0)) <= 1)

  def canonicalHostname: Option[Hostname] = hostnames.find(_.role == Hostname.RoleCanonical)
  def isTestSite: Boolean = id <= MaxTestSiteId

  def brief =
    SiteBrief(id, pubId, canonicalHostname.map(_.hostname), status)
}


// COULD split into SiteMeta and SiteStats?  So one can construct a SiteMeta even if
// one has not yet counted all pages and members etc.
//
case class SiteInclDetails(  // [exp] ok use
  id: SiteId,
  pubId: String,
  status: SiteStatus,
  name: String,
  createdAt: When,
  createdFromIp: Option[IpAddress],    // REMOVE move to audit log
  creatorEmailAddress: Option[String], // REMOVE move to audit log
  nextPageId: Int,
  quotaLimitMbs: Option[Int],
  hostnames: immutable.Seq[HostnameInclDetails],
  version: Int,  // >= 1,
  // >= 13 because of built-in members: System, Sysbot, Unknown, 10 groups Everyone .. Admins.
  numParticipants: Int = 0,
  numGuests: Int = 0,  // gone? delete
  numIdentities: Int = 0,
  // + numCategories?
  numPageUsers: Int = 0,
  numPages: Int = 0,
  numPosts: Int = 0,
  numPostTextBytes: Int = 0,
  numPostsRead: Int = 0,
  numActions: Int = 0,
  numNotfs: Int = 0,
  numEmailsSent: Int = 0,
  numAuditRows: Int = 0,
  numUploads: Int = 0,
  numUploadBytes: Long = 0,
  numPostRevisions: Int = 0,
  numPostRevBytes: Long = 0) {

  def canonicalHostname: Option[HostnameInclDetails] =
    hostnames.find(_.role == Hostname.RoleCanonical)

  def copyWithNewCanonicalHostname(hostname: String, addedAt: When, redirectOld: Boolean)
        : SiteInclDetails = {
    unimplementedIf(!redirectOld, "TyE4065KUTKFP2")
    // Could, but not tested:
    //if (hostnames.exists(hn => hn.hostname == hostname && hn.role == Hostname.RoleCanonical))
    //  return this
    val oldNoCanon = hostnames.filter(_.hostname != hostname).map(h => {
      if (h.role == Hostname.RoleCanonical) h.copy(role = Hostname.RoleRedirect)
      else h
    })
    val newCanon = HostnameInclDetails( hostname, Hostname.RoleCanonical, addedAt = addedAt)
    copy(hostnames = newCanon +: oldNoCanon)
  }
}



/** A server name that replies to requests to a certain website.
  * (Should be renamed to SiteHost.)
  */
object Hostname {
  sealed abstract class Role(val IntVal: Int) { def toInt: Int = IntVal }
  case object RoleCanonical extends Role(1)
  case object RoleRedirect extends Role(2)
  case object RoleLink extends Role(3)
  case object RoleDuplicate extends Role(4)

  case object Role {
    def fromInt(value: Int): Option[Role] = Some(value match {
      case RoleCanonical.IntVal => RoleCanonical
      case RoleRedirect.IntVal => RoleRedirect
      case RoleLink.IntVal => RoleLink
      case RoleDuplicate.IntVal => RoleDuplicate
      case _ => return None
    })
  }

  /** Should be used as prefix for both the hostname and the site name, for test sites. */
  val E2eTestPrefix = "e2e-test-"

  val EmbeddedCommentsHostnamePrefix = "comments-for-"   // also in info message [7PLBKA24]

  def isE2eTestHostname(hostname: String): Boolean =
    hostname.endsWith("example.com") ||
      hostname.startsWith(Hostname.E2eTestPrefix) ||
      hostname.startsWith(EmbeddedCommentsHostnamePrefix + E2eTestPrefix)
}


case class Hostname(
  hostname: String,
  role: Hostname.Role) {
  require(!hostname.contains("\""), "TyE6FK20R")
  require(!hostname.contains("'"), "TyE8FSW24")
}


case class HostnameInclDetails(
  hostname: String,
  role: Hostname.Role,
  addedAt: When) {

  def noDetails = Hostname(hostname, role)
}


/** The result of looking up a site by hostname.
  */
case class CanonicalHostLookup(
  siteId: SiteId,
  thisHost: Hostname,
  canonicalHost: Hostname)



abstract class NewSiteData {
  def name: String
  def address: String

  /** Some E2E tests rely on the first site allowing the creation of embedded
    * discussions, so we need to be able to specify an embedding site URL.
    */
  def embeddingSiteUrl: Option[String] = None

  def newSiteOwnerData: NewSiteOwnerData
}


case class NewSiteOwnerData(
  ownerIp: String,
  ownerLoginId: String,
  ownerIdentity: IdentityOpenId,
  ownerRole: Participant)

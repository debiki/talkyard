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

  val MinPubSiteIdLength = 8
  val NewPubSiteIdLength = 10
  require(NewPubSiteIdLength >= MinPubSiteIdLength)

  val Ipv4AnyPortRegex: Regex = """(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(:\d+)?""".r

  def newPubId(): PubSiteId = nextRandomString() take NewPubSiteIdLength

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


trait SiteTrait {
  def id: SiteId
  def pubId: PubSiteId
  def status: SiteStatus
  def featureFlags: St

  def isTestSite: Bo = id <= Site.MaxTestSiteId

  def isFeatureEnabled(ffName: St, serverFeatureFlags: St): Bo = {
    val offName = "0" + ffName  // zero  — same as when disabling options in Vim
    val enabledWholeServer = serverFeatureFlags.contains(ffName)
    val disabledWholeServer = serverFeatureFlags.contains(offName)
    val enabledThisSite = featureFlags.contains(ffName)
    val disabledThisSite = featureFlags.contains(offName)
    val enabledSomewhere = enabledWholeServer || enabledThisSite
    val disabledSomewhere = disabledWholeServer || disabledThisSite
    // By default a feature flag is not enabled, and can be enabled in a   [ff_on_off]
    // specific site only via this.featureFlags. So, if a feature has been
    // disabled explicitly in the whole server, then, that overrides
    // it being enabled per site (so it'll be disabled everywhere) (Otherwise
    // disabledWholeServer would be pointless.)
    // However, if a feature is enabled by default (for all sites), then,
    // a site can disable it.
    enabledSomewhere && !disabledSomewhere
  }
}


/**
  * @param hostname — doesn't include any port number.
  */
case class SiteBrief(
  id: SiteId,
  pubId: PubSiteId,
  hostname: Opt[St],
  status: SiteStatus,
  featureFlags: St,
) extends SiteTrait {
}



sealed abstract class SiteStatus(val IntValue: i32) {
  def toInt: i32 = IntValue
  def mayAddAdmins: Bo = IntValue < SiteStatus.DeletedStatusId
  def mayAddModerators: Bo = IntValue < SiteStatus.DeletedStatusId
  def mayAddUsers: Bo = IntValue < SiteStatus.DeletedStatusId
  def isDeleted: Bo = IntValue >= SiteStatus.DeletedStatusId
  def isPurged: Bo = IntValue >= SiteStatus.PurgedStatusId

  def isMoreDeletedThan(other: SiteStatus): Bo =
    isDeleted && IntValue > other.IntValue

}


case class SuperAdminSitePatch(
  siteId: SiteId,
  newStatus: SiteStatus,
  newNotes: Opt[St],
  rdbQuotaMiBs: Opt[i32],
  fileQuotaMiBs: Opt[i32],
  readLimitsMultiplier: Opt[f32],
  logLimitsMultiplier: Opt[f32],
  createLimitsMultiplier: Opt[f32],
  featureFlags: St) {

  def forSite(siteId: SiteId): SuperAdminSitePatch = copy(siteId = siteId)
}


object SuperAdminSitePatch {
  def empty(siteId: SiteId = NoSiteId): SuperAdminSitePatch =
    SuperAdminSitePatch(
          siteId = siteId, SiteStatus.Active, None, None, None, None, None, None, "")
}


object SiteStatus {

  val DeletedStatusId = 6
  val PurgedStatusId = 7

  /** No site admin has been created.
    */
  case object NoAdmin extends SiteStatus(1) {
    override def mayAddModerators = false
    override def mayAddUsers = false
  }

  /** "Normal" status. The site is in active use.
    */
  case object Active extends SiteStatus(2)

  /** No content can be added, but content can be deleted, by staff, if it's reported as
    * offensive, for example. And more staff can be added, to help deleting any bad content.
    *
    * Useful for "archiving" a site that is to be used no more, and that you don't want to
    * remove from the Internet. Then, you leave it online, read-only — however, staff needs
    * to login and delete any bad contents that might get flagged. So, in addition to reading,
    * staff can delete things.
    */
  case object ReadAndCleanOnly extends SiteStatus(3) {
    override def mayAddUsers = false
  }

  case object HiddenUnlessStaff extends SiteStatus(4) {
    override def mayAddUsers = false
  }

  case object HiddenUnlessAdmin extends SiteStatus(5) {
    override def mayAddModerators = false
    override def mayAddUsers = false
  }

  /** Can be undeleted. Only visible to superadmins — others see 404 Not Found,
    * just as if the site had never been created.
    */
  case object Deleted extends SiteStatus(DeletedStatusId)
  require(DeletedStatusId == 6)

  /** All contents have been erased from disk, except for a sites table entry
    * and soft deleted hostnames.  Cannot be undeleted.
    */
  case object Purged extends SiteStatus(PurgedStatusId)
  require(PurgedStatusId == 7)


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


case class SiteIdOrigins(
  siteId: SiteId, pubId: PubSiteId, siteOrigin: String, uploadsOrigin: String)


trait SiteIdHostnames {
  def id: SiteId
  def pubId: PubSiteId
  def canonicalHostnameStr: Option[String]
  def allHostnames: Seq[String]
}


trait SiteLimitsMultipliers {
  def readLimitsMultiplier: Opt[f32]
  def logLimitsMultiplier: Opt[f32]
  def createLimitsMultiplier: Opt[f32]
}


case class Site(  // Remove? Use SiteBrief or SiteDetailed instead?
  id: SiteId,
  pubId: PubSiteId,
  status: SiteStatus,
  featureFlags: St,
  name: String,
  createdAt: When,
  creatorIp: String,
  hostnames: Vector[Hostname],
  readLimitsMultiplier: Opt[f32],
  logLimitsMultiplier: Opt[f32],
  createLimitsMultiplier: Opt[f32],
  ) extends SiteIdHostnames with SiteLimitsMultipliers with SiteTrait {

  // Reqiure at most 1 canonical host.
  //require((0 /: hosts)(_ + (if (_.isCanonical) 1 else 0)) <= 1)

  def canonicalHostname: Option[Hostname] = hostnames.find(_.role == Hostname.RoleCanonical)
  def canonicalHostnameStr: Option[String] = canonicalHostname.map(_.hostname)

  def allHostnames: Seq[St] = hostnames.map(_.hostname)

  def brief: SiteBrief =
    SiteBrief(id, pubId, canonicalHostname.map(_.hostname), status,
          featureFlags = featureFlags)
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
  deletedAt: Opt[When] = None,
  autoPurgeAt: Opt[When] = None,
  purgedAt: Opt[When] = None,
  nextPageId: Int,
  hostnames: immutable.Seq[HostnameInclDetails],
  version: Int,  // >= 1,
  stats: ResourceUse,
  // Don't incl in json exports — it's for super staff only.
  superStaffNotes: Option[String] = None,
  featureFlags: St = "",  // incl or not in exports? Right now, no.
  readLimitsMultiplier: Opt[f32] = None,
  logLimitsMultiplier: Opt[f32] = None,
  createLimitsMultiplier: Opt[f32] = None,
) {

  require(deletedAt.isDefined == status.isDeleted,
        s"Bad site deleted status: $this [TyE306MRS]")
  require(autoPurgeAt.isEmpty || (status.toInt >= SiteStatus.Deleted.toInt),
        s"Bad site auto purge status: $this [TyE306MR7]")
  require(purgedAt.isDefined == (status.toInt >= SiteStatus.Purged.toInt),
        s"Bad site purged status: $this [TyE306MR6]")
  require(purgedAt.isEmpty ||
          deletedAt.getOrDie("TyE50RMP24").millis <= purgedAt.get.millis,
        s"Bad auto purge millis: $this [TyE306MR8]")

  def canonicalHostname: Option[HostnameInclDetails] =
    hostnames.find(_.role == Hostname.RoleCanonical)

  def canonicalHostnameSt: Opt[St] = canonicalHostname.map(_.hostname)

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
    val newCanon = HostnameInclDetails(hostname, Hostname.RoleCanonical, addedAt = addedAt)
    copy(hostnames = newCanon +: oldNoCanon)
  }

  def isDeleted: Bo = status.isDeleted
  def isPurged: Bo = status.isPurged

  def quotaLimitMbs: Option[Int] = stats.quotaLimitMbs

  /** numParticipants is >= 13 because of built-in members:
    * System, Sysbot, Unknown, 10 groups Everyone .. Admins. */
  def numParticipants: Int = stats.numParticipants
  def numGuests: Int = stats.numGuests
  def numIdentities: Int = stats.numIdentities
  def numPageUsers: Int = stats.numPageParticipants
  def numPages: Int = stats.numPages
  def numPosts: Int = stats.numPosts
  def numPostTextBytes: Long = stats.numPostTextBytes
  def numPostRevisions: Int = stats.numPostRevisions
  def numPostRevBytes: Long = stats.numPostRevBytes
  def numPostsRead: Long = stats.numPostsRead
  def numActions: Int = stats.numActions
  def numNotfs: Int = stats.numNotfs
  def numEmailsSent: Int = stats.numEmailsSent
  def numAuditRows: Int = stats.numAuditRows
  def numUploads: Int = stats.numUploads
  def numUploadBytes: Long = stats.numUploadBytes

  def toLogStBrief: St =
    o"""$id $canonicalHostnameSt"""

  def toLogSt: St = {
    o"""site $id: hostname $canonicalHostnameSt,
        $numParticipants pats,
        $numPages pages,
        $numPosts posts,
        $numEmailsSent emails sent,
        created on ${createdAt.toIso8601Day},
        deleted on ${deletedAt.map(_.toIso8601Day)},
        purged on ${purgedAt.map(_.toIso8601Day)}"""
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
  case object RoleDeleted extends Role(5)

  case object Role {
    def fromInt(value: Int): Option[Role] = Some(value match {
      case RoleCanonical.IntVal => RoleCanonical
      case RoleRedirect.IntVal => RoleRedirect
      case RoleLink.IntVal => RoleLink
      case RoleDuplicate.IntVal => RoleDuplicate
      case RoleDeleted.IntVal => RoleDeleted
      case _ => return None
    })
  }

  /** Should be used as prefix for both the hostname and the site name, for test sites. */
  val E2eTestPrefix = "e2e-test-"

  /** Prefix for sites people create to try out Talkyard, but won't use for real. */
  val TryOutTalkyardPrefix = "test--"

  val EmbeddedCommentsHostnamePrefix = "comments-for-"   // also in info message [7PLBKA24]

  def isE2eTestHostname(hostname: String): Boolean =
    hostname == "example.com" ||
      hostname.endsWith(".example.com") ||
      hostname.startsWith(Hostname.E2eTestPrefix) ||
      hostname.startsWith(Hostname.TryOutTalkyardPrefix) ||
      hostname.startsWith(EmbeddedCommentsHostnamePrefix + E2eTestPrefix)
}


/**
  * @param hostname — doesn't include scheme or port, but maybe should? [remember_port]
  *   Doesn't matter in real life, whatever is fine.
  */
case class Hostname(
  hostname: String,
  role: Hostname.Role) {
  require(!hostname.contains("\""), s"""Bad hostname, incl '"': '$hostname' TyE6FK20R""")
  require(!hostname.contains("'"), s"""Bad hostname, incl "'": "$hostname" TyE8FSW24""")
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

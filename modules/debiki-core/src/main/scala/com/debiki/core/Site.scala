/**
 * Copyright (C) 2011-2013 Kaj Magnus Lindberg (born 1979)
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


object Site {

  /** This site id is returned for any IPv4 address that doesn't match anything,
    * so it'll be possible to access the first site before a domain name has been
    * connected.
    */
  val FirstSiteId = "1"

  val Ipv4AnyPortRegex = """(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(:\d+)?""".r

}



sealed abstract class SiteStatus
object SiteStatus {
  case class OwnerCreationPending(ownerEmail: String) extends SiteStatus
  case object ContentCreationPending extends SiteStatus
  case object IsEmbeddedSite extends SiteStatus
  case object IsSimpleSite extends SiteStatus
}



/** A website. (Should be renamed to Site.)
  */
case class Tenant(
  id: String,
  name: String,
  creatorIp: String,
  creatorEmailAddress: String,
  embeddingSiteUrl: Option[String],
  hosts: List[TenantHost]
){
  // Reqiure at most 1 canonical host.
  //require((0 /: hosts)(_ + (if (_.isCanonical) 1 else 0)) <= 1)

  def chost: Option[TenantHost] = hosts.find(_.role == TenantHost.RoleCanonical)
  def chost_! = chost.get
}



/** A server name that replies to requests to a certain website.
  * (Should be renamed to SiteHost.)
  */
object TenantHost {
  sealed abstract class Role
  case object RoleCanonical extends Role
  case object RoleRedirect extends Role
  case object RoleLink extends Role
  case object RoleDuplicate extends Role
}


case class TenantHost(
  address: String,
  role: TenantHost.Role) {
}


/** The result of looking up a tenant by host name.
  * COULD rename to HostnameLookup
  */
case class TenantLookup(
  siteId: SiteId,
  thisHost: TenantHost,
  canonicalHost: TenantHost)


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
  ownerRole: User)

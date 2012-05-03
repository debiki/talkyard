/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package com.debiki.v0

import Prelude._


/**
 * There are four consumer types. They are, and are identified by:
 *  - IP numbers, global: ip
 *  - IP numbers, per tenant: ip + tenantId
 *  - Tenants: tenantId
 *  - Roles: tenantId + roleId
 */
case class QuotaConsumers(
  ip: Option[String] = None,
  tenantId: Option[String] = None,
  roleId: Option[String] = None) {

  // Forbid unauthenticated users.
  require(roleId.filter(_.startsWith("-")).isEmpty)
}



// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

package com.debiki.v0

import net.liftweb.common.Box

/** Debiki's Data Access Object interface.
 */
abstract class Dao {

  def create(tenantId: String, debate: Debate): Box[Debate]

  def save(tenantId: String, debateId: String, x: AnyRef): Box[AnyRef]

  def save[T](tenantId: String, debateId: String, xs: List[T]): Box[List[T]]

  def load(tenantId: String, debateId: String): Box[Debate]

}

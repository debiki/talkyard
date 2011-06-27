// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

package com.debiki.v0

import net.liftweb.common.Box

/** Debiki's Data Access Object interface.
 */
abstract class Dao {

  def create(where: PagePath, debate: Debate): Box[Debate]

  def close()

  // COULD use:  save(Guid(tenantId, pageGuid), xs)  instead?
  def save(tenantId: String, debateId: String, x: AnyRef): Box[AnyRef]

  def save[T](tenantId: String, debateId: String, xs: List[T]): Box[List[T]]

  def load(tenantId: String, debateId: String): Box[Debate]

  def checkPagePath(pathToCheck: PagePath): Box[PagePath]

  def checkAccess(pagePath: PagePath, userId: String, action: Action
                     ): Option[IntrsAllowed]

  def checkRepoVersion(): Box[String]

}

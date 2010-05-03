// vim: ts=2 sw=2 et

package com.debiki.v0

/** Debiki's Data Access Object interface.
 */
abstract class Dao {

  def getDebate(id: String): Debate

}

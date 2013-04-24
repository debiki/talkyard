/**
 * Copyright (c) 2012-2013 Kaj Magnus Lindberg (born 1979)
 */

package com.debiki.v0

import Prelude._


/**
 * Moderators and the computer review posts and might approve them
 * Only the `Manual` approval is done manually by a human,
 * all others happen automatically, done by the computer.
 * (Should I prefix them with 'Auto'?)
 *
 * @param isPermanent true iff the approval is not preliminary. (If not, it was made by
 * some trusted user, and moderators therefore won't be asked to review it — the approval
 * will most likely uphold forever.)
 * @param isAuthoritative true iff the post was approved by a moderator or admin.
 */
sealed abstract class Approval(
  val isPermanent: Boolean = false,
  val isAuthoritative: Boolean = false)



object Approval {

  /**
   * The first few posts of a new user are approved preliminarily.
   * (An admin is notified though and might decide to delete the posts.)
   */
  case object Preliminary extends Approval

  /**
   * A user that has posted many useful comments will have a few of
   * his/her next comments approved automatically, and no admin is nodified.
   */
  case object WellBehavedUser extends Approval(isPermanent = true)

  /**
   * Posts by admins and moderators are always automatically approved.
   */
  case object AuthoritativeUser extends Approval(isPermanent = true, isAuthoritative = true)

  /**
   * When an authoritative user manually approved something.
   */
  case object Manual extends Approval(isPermanent = true, isAuthoritative = true)


  def parse(text: String): Approval = text match {
    case "Preliminary" => Preliminary
    case "WellBehavedUser" => WellBehavedUser
    case "AuthoritativeUser" => AuthoritativeUser
    case "Manual" => Manual
    case _ => illArgErr("DwE931k35", s"Bad approval value: `$text'")
  }

}



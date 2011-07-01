/**
 * Copyright (c) 2011 Kaj Magnus Lindberg (born 1979)
 */

package com.debiki.v0

import Prelude._

// COULD rename this file to info? or meta? or actions?...

object PagePath {
  // COULD include the tenant id in Guid, because that'd simplify params to
  // Dao, and the tenantId is actually part of the guid.
  sealed abstract class Guid {
    def value: Option[String]
  }
  case class GuidInPath(guid: String) extends Guid {
    override val value = Some(guid)
  }
  case class GuidHidden(guid: String) extends Guid {
    override val value = Some(guid)
  }
  case object GuidUnknown extends Guid {
    override val value: Option[String] = None
  }
}

import PagePath._

/** Identifies a page, by guid or by path, and knows the path
 *  component in the URL to the page.
 */
case class PagePath(
  tenantId: String,
  parent: String,
  guid: Guid,
  name: String
){
  require(tenantId.nonEmpty)
  require(parent.startsWith("/"))
  require(parent.endsWith("/"))
  // In Oracle RDBMS, " " is stored instead of "", since Oracle
  // converts "" to null:
  require(name != " ")

  def path: String = guid match {
    case GuidInPath(g) =>
      if (name isEmpty) parent +"-"+ g
      else parent +"-"+ g +"-"+ name
    case _ => parent + name
  }

  /** True iff path ends with a `/'. Then this is a path to a  folder or
   *  a folder's index page (which is a page with an empty name).
   */
  def isFolderPath = path endsWith "/"
}

/** Things an end user can do.
 */
sealed abstract class Action

object Action {
  /*
  def fromText(text: String): Action = text match {
    // COULD find out how to do this automatically in Scala?
    //case "create" => Create  // was renamed to "newpage" in
                               // debiki-app-lift, Boot.scala
    case "reply" => Reply
    case "edit" => Edit
    case "view" => View
    case x => Unsupported(x)
  }*/

  case object Act extends Action
  case object Create extends Action
  case object Reply extends Action
  case object Edit extends Action
  case object View extends Action
  case class Unsupported(whatUnsafe: String) extends Action {
    override def toString: String = "Unsupported("+ safe(whatUnsafe) +")"
  }
}

/** Interactions allowed.
 *
 *  Example: If the user is about to post a reply, but is only allowed to do
 *  HiddenTalk, then s/he will be informed that only a few people will
 *  see his/her contribution.
 */
sealed abstract class IntrsAllowed

object IntrsAllowed {

  /**
   */
  case object VisibleTalk extends IntrsAllowed

  /**
   */
  case object HiddenTalk extends IntrsAllowed

  //case object HiddenFeedback extends AccessGranted
  //case object ViewAll extends AccessGranted
  //case object ViewHidden extends AccessGranted
  //case object ViewArticle extends AccessGranted

}

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
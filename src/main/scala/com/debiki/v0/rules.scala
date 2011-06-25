/**
 * Copyright (c) 2011 Kaj Magnus Lindberg (born 1979)
 */

package com.debiki.v0

// COULD rename this file to info? or meta? or ...

/**
 */
sealed abstract class PageInfo

object PageInfo {

  /**
   */
  case class Info(guid: String, path: String, rules: PageRules
                     ) extends PageInfo

  /** When looking up a page by guid, if the correct parent folder
   *  and page name was not specified, a BadPath is returned by the DAO.
   */
  case class BadPath(correctPath: String) extends PageInfo

  /**
   */
  case object Forbidden extends PageInfo
}

/**
 */
sealed abstract class PageRules

object PageRules {

  /**
   */
  case object AllOk extends PageRules

  /**
   */
  case object HiddenTalk extends PageRules

  //case object HiddenFeedback extends PageRules
  //case object ViewAll extends PageRules
  //case object ViewHidden extends PageRules
  //case object ViewArticle extends PageRules
}

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
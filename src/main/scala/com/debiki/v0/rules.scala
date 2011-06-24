/**
 * Copyright (c) 2011 Kaj Magnus Lindberg (born 1979)
 */

package com.debiki.v0

sealed abstract class PageRules

object PageRules {
  case object AllOk extends PageRules
  case object HiddenTalk extends PageRules
  //case object HiddenFeedback extends PageRules
  //case object ViewAll extends PageRules
  //case object ViewHidden extends PageRules
  //case object ViewArticle extends PageRules
  case object Forbidden extends PageRules
}

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
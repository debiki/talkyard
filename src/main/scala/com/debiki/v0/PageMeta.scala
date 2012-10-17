/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package com.debiki.v0


object PageStuff {

  def apply(path: PagePath, actions: Debate): PageStuff = {
    val emptyMeta = PageMeta(actions.id)
    PageStuff(emptyMeta, path, actions)
  }

}


case class PageStuff( // COULD reneame to Page? if I rename Page to PageActions
                          // (well, rather, if I rename Debate to PageActions)
  meta: PageMeta,
  path: PagePath,
  actions: Debate) {

  if (path.pageId.isDefined) require(meta.pageId == path.pageId.get)
  else require(meta.pageId == "?")

  require(meta.pageId == actions.id)

  def id = meta.pageId
  def tenantId = path.tenantId

  def folder = path.folder
  def slug = path.pageSlug
  def idShownInUrl = path.showId

  def role = meta.pageRole
  def parentPageId = meta.parentPageId

  def hasIdAssigned = id != "?"

  def copyWithNewId(newId: String) =
    PageStuff(
      meta.copy(pageId = newId), path = path.copy(pageId = Some(newId)),
      actions = actions.copy(guid = newId))

}



case class PageMeta(
  pageId: String,
  pageRole: PageRole = PageRole.Any,
  parentPageId: Option[String] = None) {
}



sealed abstract class PageRole

object PageRole {
  case object Any extends PageRole
  case object Homepage extends PageRole
  case object BlogMainPage extends PageRole
  case object BlogArticle extends PageRole
  case object ForumMainPage extends PageRole
  case object ForumThread extends PageRole
  case object WikiMainPage extends PageRole
  case object WikiPage extends PageRole
}


/* In the future: ?

sealed abstract class PageStatus

object PageStatus {
  case object Normal extends PageStatus
  case object Deleted extends PageStatus
  case object Purged extends PageStatus
}
*/


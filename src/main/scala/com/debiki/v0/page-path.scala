/**
 * Copyright (c) 2011-2012 Kaj Magnus Lindberg (born 1979)
 */

package com.debiki.v0

import _root_.java.{util => ju, io => jio}
import Prelude._

/**
 * Identifies a page, by id or by path, and knows the path
 * component in the URL to the page.
 *
 * (Cannot split into separate case classes for pages and folders?
 * /some/path/  might refer to a folder *or* a page -- the index page.)
 */
case class PagePath(  // COULD move to debate.scala.  Rename to RequestPath?
  tenantId: String,  // COULD be a Dao(parameter) instead?
  // This is either the page's parent folder, or, if no page was specified,
  // the actual target of the path.
  folder: String,
  pageId: Option[String], // COULD break out PageLookup, so would never be None
  showId: Boolean,
  pageSlug: String
){
  require(tenantId.nonEmpty)
  require(pageId != Some("?"))
  require(pageId != Some(""))
  require(folder.startsWith("/"))
  require(folder.endsWith("/"))
  // In Oracle RDBMS, "-" is stored instead of "", since Oracle
  // converts "" to null.
  require(pageSlug != "-")

  def path: String =
    if (showId) {
      val g = pageId.getOrElse(assErr( //Break out GuidLookup so cannot happen?
        "DwE23r124", "ID unknown."))
      if (pageSlug isEmpty) folder +"-"+ g
      else folder +"-"+ g +"-"+ pageSlug
    } else {
      folder + pageSlug
    }

  def slugOrIdOrQustnMark =
    if (pageSlug nonEmpty) pageSlug else pageId.map("-"+ _) getOrElse "?"

  /** True if the slug ends with e.g. `.template' or `.js' or `.css'.
   */
  def isCodePage =
    isTemplatePage ||
       (pageSlug endsWith ".js") ||
       (pageSlug endsWith ".css")

  def isTemplatePage = pageSlug endsWith ".template"

  /** Config pages, e.g. ".folder.template", and future
   *  security related config pages, are visible to admins only.
   */
  def isHiddenPage = pageSlug startsWith "."

  /** True iff path ends with a `/'. Then this is a path to a  folder or
   *  a folder's index page (which is a page with an empty slug and !showId).
   */
  def isFolderPath = path endsWith "/"   // COULD rename to isFolderOrIndex
}



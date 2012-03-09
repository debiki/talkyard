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

  def suffix: String = (pageSlug lastIndexOf '.') match {
    case -1 => ""
    case lastDot => pageSlug.substring(lastDot + 1)
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


object PagePath {

  sealed abstract class Parsed
  object Parsed {
    case class Good(value: PagePath) extends Parsed
    case class Corrected(path: String) extends Parsed
    case class Bad(error: String) extends Parsed
  }

  /**
   * Parses the path part of a URL into a PagePath.
   *
   * URL path examples:
   * - (server)/fold/ers/-pageId-page-name
   * - (server)/fold/ers/page-name (here, the pageId is not shown in the path).
   */
  def fromUrlPath(tenantId: String, path: String): PagePath.Parsed = {
    assert(path.head == '/')
    val lastSlash = path.lastIndexOf('/')
    val (folder, pageIdSlug) =
      if (lastSlash != -1) path.splitAt(lastSlash + 1)
      else (path, "")
    assert(folder.head == '/' && folder.last == '/')
    assert(!pageIdSlug.contains('/'))

    // Check for bad folder paths.
    folder match {
      case _BadTrailingSlashRegex() =>
        // Drop the trailing slash, to find the correct path.
        assErrIf3(pageIdSlug.nonEmpty,
          "DwE9020R3", "Page slug not empty: "+ pageIdSlug)
        val folderAndPageIdName = path.dropRight(1)
        return Parsed.Corrected(folderAndPageIdName)
      case _BadHyphenRegex() =>
        return Parsed.Bad("Hyphen in folder path")
      case _ =>
      // Fine
    }

    val (pageIdStr, pageSlug) = pageIdSlug match {
      case "" => ("", "")
      case _PageGuidAndSlugRegex(guid, name) => (guid, name)
      case _PageGuidRegex(guid) => (guid, "")  // can result in an empty guid
      case _PageSlugRegex(name) => ("", name)
      case _PageGuidCorruptSlug(guid) => return Parsed.Bad("Bad page name")
      case _ => return Parsed.Bad("Bad page id or name")
    }
    val (pageId, showId) =
      if (pageIdStr isEmpty) (None, false)
      else (Some(pageIdStr), true)

    val pagePath = PagePath(tenantId = tenantId, folder = folder,
      pageId = pageId, showId = showId, pageSlug = pageSlug)
    Parsed.Good(pagePath)
  }

  // If a folder ends with .../-something/, then `something' is in fact
  // a page guid and slug. The trailing slash should be removed.
  private val _BadTrailingSlashRegex = """.*/-[^/]+/""".r

  // Hyphens are not allowed in the folder path, because a hyphen means
  // that a page guid follows. For example: /-folder/page  (invalid path)
  private val _BadHyphenRegex = """.*/-.*""".r

  // Note: PageGuidPtrn:
  //  - The initial "-" is not part of the guid
  //  - An empty guid means the guid is not yet known, which is the
  //    case when you use this URL to request that a page be created
  //    and that a guid be generated:  /parent/-?create
  //      COULD: don't allow empty guids no more, not needed since
  //      creating pages like so now: /folder/?createpage
  // PageSlugPtrn:
  //  - PageSlugPtrn: "*+~" have special meanings
  //
  private val _PageGuidPtrn = "-([a-z0-9_]*)"  // empty guid ok, read above
  private val _PageSlugPtrn = "([^-*+~][^*+~]*)"
  private val _PageGuidAndSlugRegex = (_PageGuidPtrn +"-"+ _PageSlugPtrn).r
  private val _PageGuidRegex = _PageGuidPtrn.r
  private val _PageSlugRegex = _PageSlugPtrn.r
  // Catches corrupt page names iff used *after* PageGuidAndSlugRegex.
  private val _PageGuidCorruptSlug = (_PageGuidPtrn +"[^a-z0-9_].*").r

}

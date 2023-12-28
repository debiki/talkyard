/**
 * Copyright (C) 2011-2013 Kaj Magnus Lindberg (born 1979)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

package com.debiki.core

import Prelude._
import PagePath._


case class PagePathWithId(  // better than PagePath? Has no site id, and always a page id
  folder: String,
  pageId: PageId,
  showId: Boolean,
  pageSlug: String,
  canonical: Boolean) {

  // Check this path is valid, for now by converting it to the old PagePath class
  // which has all consistency checks.
  value

  def toOld(siteId: SiteId) = PagePath(
    siteId, folder, pageId = Some(pageId), showId = showId, pageSlug = pageSlug)

  /** The actual page path, e.g.  /any/folder/   or   /-1234/page-slug  (where 1234 is the id).
    */
  def value: String = toOld(9999999 /* dummy site id, won't be used */).value

  def copyNoId = PagePathNoId(folder, showId, slug = pageSlug)

  def toPostPath(postNr: PostNr): PostPathWithIdNr =
    PostPathWithIdNr(
      folder = folder,
      pageId = pageId,
      showId = showId,
      pageSlug = pageSlug,
      postNr = postNr,
      canonical = canonical)
}


object PagePathWithId {
  def fromIdOnly(pageId: PageId, canonical: Boolean): PagePathWithId = {
    PagePathWithId(folder = "/", pageId = pageId, showId = true, pageSlug = "",
      canonical = canonical)
  }
}


case class PagePathNoId(  // better than PagePath? Has no site id, and never a page id
  folder: String,
  showId: Boolean,
  slug: String)


/** Typically the page id is real (the page exists),
  * but the post might not exist (no post on pageId with nr postNr).
  */
case class PostPathWithIdNr(
  folder: St,
  pageId: PageId,
  showId: Bo,
  pageSlug: St,
  postNr: PostNr,
  canonical: Bo) {

  def value: St = {
   val pagePath = PagePathWithId(folder = folder, pageId = pageId, showId = showId,
          pageSlug = pageSlug, canonical = canonical)
    // Or do we sometimes want `CommentHashPrefixWithHash` instead?
    pagePath.value + (if (postNr == BodyNr) "" else PostHashPrefixWithHash + postNr)
  }

  require(postNr >= BodyNr, s"Bad post nr: $postNr, page id: $pageId [TyE7M05MRT]")
}



/**
 * Identifies a page, by id or by path, and knows the path
 * component in the URL to the page.
 *
 * (Cannot split into separate case classes for pages and folders?
 * /some/path/  might refer to a folder *or* a page -- the index page.)
 *
 * COULD split PagePath into PathLookup (which allows relative paths)
 * and PathResolved (which does not allow relative paths)?
 * Perhaps Path could have subclasses PagePath and FolderPath?
 * PathLookup would have an idOpt: Option[String],
 * but ResolvedPagePath (?) would have an id: String  and showId: Boolean.
 * (And PagePath could be an alias for ResolvedPagePath?)
 * ResolvedPath would be a class, PagePath and FolderPath case classes.
 * ((PathLookup could have a scheme and host name included?
 * But the ResolvedPath would have a tenant-id instead.
 * Or perhaps siteId should not be part of the PagePath?
 * "Path" implies host name & tenant-id does not belong here?))
 */
case class PagePath(  // COULD move to debate.scala.  Rename to RequestPath?  [exp] ok, rm cdati, skip canonical_dati
  siteId: SiteId,  // COULD be a Dao(parameter) instead?
  // This is either the page's parent folder, or, if no page was specified,
  // the actual target of the path.
  folder: String,
  pageId: Option[String], // COULD break out PageLookup, so would never be None
  showId: Boolean,
  pageSlug: String) {

  require(siteId != NoSiteId, "EdE73BJU8")
  require(siteId != Site.GenerateTestSiteMagicId, "EdE8GD5L7")
  require(!pageId.contains("?"), "EdE16ISL3")
  require(!pageId.contains(""), "EdE0BJ3X5")

  if (!folder.startsWith("/"))
    throw PagePathException(
      "DwE83RIK2", s"Folder does not start with '/': `$folder'")

  if (!folder.endsWith("/"))
    throw PagePathException(
      "DwE6IIJQ2", s"Folder does not end with '/': `$folder'")

  if (folder.contains("/-"))
    throw PagePathException("DwE7Ib3", s"Folder name starts with '-': `$folder'")

  if ((folder intersect _BadPunctFolder).nonEmpty)
    throw PagePathException(
      "DwE38IQ2", s"Bad punctuation chars in this folder: `$folder'")

  if (_AnyWhitespaceRegex matches folder)
    throw PagePathException(
      "DwE9IJb2", s"Folder contains whitespace: `$folder'")

  if (pageSlug.length > MaxSlugLength)
      throw PagePathException(
        "DwE4KE32", o"""Slug too long, length: ${pageSlug.length}, max: $MaxSlugLength,
            the slug: "$pageSlug"""")

  if (pageSlug startsWith "-")
    throw PagePathException("DwE2Yb35", s"Page slug starts with '-' `$pageSlug'")

  if (pageSlug startsWith ".")
    throw PagePathException("DwE5IF01", s"Page slug starts with '.': `$pageSlug'")

  if ((pageSlug intersect _BadPunctSlug).nonEmpty)
    throw PagePathException(
      "DwE093KG12", s"Bad punctuation chars in this page slug: `$pageSlug'")

  if (_AnyWhitespaceRegex matches pageSlug)
    throw PagePathException(
      "DwE37ZQU2", s"Page slug contains whitespace: `$pageSlug'")

  def thePageId: PageId = pageId getOrDie "EsE6JMY3"

  def toNew(canonical: Boolean): PagePathWithId = {
    PagePathWithId(
      folder,
      pageId = thePageId,
      showId = showId,
      pageSlug = pageSlug,
      canonical = canonical)
  }

  def value: String =
    if (showId) {
      val id = pageId.getOrDie( //Break out GuidLookup so cannot happen?
        "DwE23r124", "ID unknown.")
      if (pageSlug.isEmpty) s"$folder-$id"
      else s"$folder-$id/$pageSlug"
    } else {
      s"$folder$pageSlug"
    }


  def suffix: String = pageSlug.lastIndexOf('.') match {
    case -1 => ""
    case lastDot => pageSlug.substring(lastDot + 1)
  }


  def slugOrIdOrQustnMark: String =
    if (pageSlug.nonEmpty) pageSlug else pageId.map("-"+ _) getOrElse "?"


  def isScriptOrStyle: Boolean = pageSlug.endsWith(".js") || pageSlug.endsWith(".css")


  /**
   * Pages and folders that start with '_' are visible to admins only.
   *
   * For example, config pages, e.g. '_website-config.yaml', and any
   * '/_old/' folder. I chose '_' not '.', because if there will ever
   * be a file based DbDao, it will probably consider files that
   * start with '.' OS or tooling specific files, e.g. '.git' or '.gitignore',
   * if the filesystem DbDao is placed in a Git repo. (And such files
   * shouldn't be served to the browser.)
   */
  def isHiddenPage: Boolean =
    pageSlug.startsWith("_") ||
    folder.contains("/_")


  // COULD rename to isIndexPageOrFolder (it's never a "FolderPage")
  /** True iff path ends with a '/'. Then this is a path to a  folder or
   *  a folder's index page (which is a page with an empty slug and !showId).
   */
  def isFolderOrIndexPage: Boolean = pageSlug.isEmpty && !showId


  // Bad name: When asking for an index page, pageId is unknown and therefore
  // set to None, but this doesn't mean the PagePath is to a folder.
  // Solution?: Split PagePath in 2 classes: PathLookup and Path?
  // Whether or not Path is to a folder or a page would always be known.
  def isFolder: Boolean = isFolderOrIndexPage && pageId.isEmpty


  def parentFolder: Option[PagePath] = {  // COULD rename: parentFolderPagePath
    if (!isFolder)
      return Some(copy(pageSlug = "", showId = false, pageId = None))
    if (folder == "/")
      return None
    // Drop "last-folder/" from "/some/path/last-folder/".
    val grandparent = folder.dropRight(1).dropRightWhile(_ != '/')
    Some(copy(
      folder = grandparent, pageSlug = "", showId = false, pageId = None))
  }


  def sitePageId: Option[SitePageId] =
    pageId map (SitePageId(siteId, _))

}



case class PagePathException(errorCode: String,  message: String)
  extends IllegalArgumentException(message +" [error "+ errorCode +"]")



object PagePath {

  private val DummySiteId = 123456789

  private def _throw(errCode: String,  message: String) =
    throw PagePathException(errCode, message)


  def isOkayFolder(folder: String): Boolean = {
    // This is over complicated. Why did I throw exceptions everywhere instead of
    // returning Ok or Error from a test function?
    // '/-' means an id follows; ids must not be inside a folder.
    if (!folder.endsWith("/") || folder.contains("/-"))
      return false
    try {
      fromUrlPath(DummySiteId, folder) match {
        case Parsed.Good(_) => true
        case _ => false
      }
    }
    catch {
      case _: Exception => false
    }
  }


  // Discourse allows at least 100 chars. Sync with Typescript [MXPGSLGLN].
  val MaxSlugLength = 100

  private val SlugRegex = """[a-z0-9][a-z0-9-]*[a-z0-9]""".r

  def isOkaySlug(slug: String): Boolean = {
    // Over complicated, see isOkayFolder above.
    if (slug.isEmpty)
      return true
    if (!SlugRegex.matches(slug))
      return false
    if (slug.length > MaxSlugLength)
      return false
    // Now this isn't needed: ? after I added the if:s above
    try {
      fromUrlPath(DummySiteId, "/" + slug) match {
        case Parsed.Good(_) => true
        case _ => false
      }
    }
    catch {
      case _: Exception => false
    }
  }


  /**
   * Throws IllegalArgumentException if the path is not okay, or
   * if it needs to be corrected.
   */
  def checkPath(siteId: SiteId = DummySiteId, folder: String = "/",
        pageId: Option[String] = None, pageSlug: String = ""): Unit = {
    // Construct a PagePath, serialize it
    // and verify that the string can be parsed.
    val path = PagePath(siteId, folder, pageId, showId = false, pageSlug)
    fromUrlPath(path.siteId, path.value) match {
      case Parsed.Good(_) => ()
      case Parsed.Corrected(_) => _throw("DwE091IJ5", "Bad page path")
      case Parsed.Bad(error) => _throw("DwE56Ih5", "Bad page path: "+ error)
    }
  }


  sealed abstract class Parsed
  object Parsed {
    case class Good(value: PagePath) extends Parsed
    case class Corrected(path: String) extends Parsed
    case class Bad(error: String) extends Parsed
  }

  def fromIdOnly(siteId: SiteId, pageId: PageId): PagePath = {
    PagePath(siteId, folder = "/", pageId = Some(pageId), showId = true, pageSlug = "")
  }


  /** Parses the path part of a URL into a PagePath.
    *
    * URL path examples:
    * - (server)/fold/ers/-pageId [2WBG49]
    * - (server)/fold/ers/-pageId/page-slug
    * - (server)/fold/ers/page-slug (here, the pageId is not shown in the path).
    *
    * But also:
    * - (server)/forum/latest/bugs — and this should be changed to just /forum/. [5AQXJ2]
    */
  def fromUrlPath(siteId: SiteId, path: String): PagePath.Parsed = {
    // Some Java APIs return null.
    if (path eq null)
      return Parsed.Bad("URL path is null")

    // For now, quick hack to match all forum paths. Later, compare with in-mem cached forum paths.
    var adjustedPath = path
    // If a forum is located at /base-path/, but also a sort order is specified, e.g. /latest or /top:
    if (path.contains("/-")) {
      // It's a page, not a forum. Ok as is.
    }
    else if (path.endsWith("/categories") ||
        path.endsWith("/latest") || path.endsWith("/top") || path.endsWith("/new") ||
        path.endsWith("/unread")) {
      adjustedPath = path.dropRightWhile(_ != '/')
    }
    else if (path.contains("/latest/") || path.contains("/top/") ||
        path.contains("/new/") || path.contains("/unread/")) {
      // First drop the category name, then the last '/', then the sort order ('top'/'latest'/etc).
      adjustedPath = path.dropRightWhile(_ != '/').dropRight(1).dropRightWhile(_ != '/')
    }
    fromUrlPathImpl(siteId, adjustedPath)
  }


  private def fromUrlPathImpl(siteId: SiteId, path: String): PagePath.Parsed = {
    if (path.isEmpty)
      return Parsed.Bad("URL path is empty")

    if (path.head != '/')
      return Parsed.Bad("URL path does not start with '/'")

    // Split into folder and any-id-and-slug parts.
    val lastFolderSlash = {
      // The folder ends at the first "/-" because "/-" means the page id and slug follows.
      // If there's no "/-" then the last "/" is the end of the folder part.
      val slashHyphenIndex = path.indexOf("/-")
      if (slashHyphenIndex >= 0) slashHyphenIndex
      else path.lastIndexOf('/')
    }
    val (folder, pageIdSlug) =
      if (lastFolderSlash != -1) path.splitAt(lastFolderSlash + 1)
      else (path, "")

    assert(folder.head == '/' && folder.last == '/')
    if (pageIdSlug.nonEmpty && pageIdSlug.last == '-')
      return Parsed.Bad("Page-id-slug ends with '-'")

    // Check for bad folder paths.
    folder match {
      case _BadTrailingSlashRegex() =>
        // Drop the trailing slash, to find the correct path.
        dieIf(pageIdSlug.nonEmpty, "DwE9020R3", "Page slug not empty: "+ pageIdSlug)
        val folderAndPageIdName = path.dropRight(1)
        return Parsed.Corrected(folderAndPageIdName)
      case _BadHyphenRegex() =>
        return Parsed.Bad("Hyphen in folder path")
      case _ =>
      // Fine
    }

    // Split any-id-and-slug into id and slug.
    val (pageIdStr: String, pageSlug) = pageIdSlug match {
      case "" => ("", "")
      case _PageIdSlashSlugRegex(guid, name) => (guid, name)
      case _PageGuidRegex(guid) => (guid, "")  // can result in an empty guid
      case _PageSlugRegex(name) => ("", name)
      case _PageIdHyphenSlugRegex(id, slug) =>
        return Parsed.Corrected(PagePath(siteId, folder = folder, Some(id), showId = true, slug).value)
      case idSlugSlash if idSlugSlash.endsWith("/") =>
        return Parsed.Corrected(s"$folder${idSlugSlash dropRight 1}")
      case _BadIdPerhapsOkSlug(id) => return Parsed.Bad("Bad page id: "+ id)
      case _OkIdBadSlug(_, slug) => return Parsed.Bad("Bad page slug: "+ slug)
      case _ => return Parsed.Bad("Bad page id or slug")
    }

    // Construct the PagePath.
    val (pageId, showId) =
      if (pageIdStr.isEmpty) (None, false)
      else (Some(pageIdStr), true)

    // Needs to refactor this. I'm just duplicating the tests in the constructor.
    if (pageSlug.intersect(_BadPunctSlug).nonEmpty)
      return Parsed.Bad("Bad characters in page slug")

    if (pageSlug.length > MaxSlugLength)
      return Parsed.Bad("Slug too long")

    if (pageSlug startsWith ".")
      return Parsed.Bad("Page slug starts with dot")

    if (folder.intersect(_BadPunctFolder).nonEmpty)
      return Parsed.Bad("Bad characters in page folder")

    val pagePath = PagePath(siteId, folder = folder,
      pageId = pageId, showId = showId, pageSlug = pageSlug)
    Parsed.Good(pagePath)
  }

  // All punctuation chars:     """!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~"""
  private val _BadPunctSlug =   """!"#$%&'()*+,/:;<=>?@[\]^`{|}~""" // -._ ok
  private val _BadPunctFolder = """!"#$%&'()*+,.:;<=>?@[\]^`{|}~""" // -/_ OK...
  // ... Concerning disallowing '.' in folders: Perhaps '.' will mean
  // something magic, in the future. For example, if using a file based DbDao,
  // perhaps '/.folder/' could be a Git repo?! (/.git/) Then, better
  // ignore folders & files starting with '.', so /.git/ isn't served to
  // the browser.

  // If a folder ends with .../-something/, then `something' is in fact
  // a page guid and slug. The trailing slash should be removed.
  private val _BadTrailingSlashRegex = """.*/-[^/]+/""".r

  // Hyphens are not allowed in the folder path, because a hyphen means
  // that a page guid follows. For example: /-folder/page  (invalid path)
  private val _BadHyphenRegex = """.*/-.*""".r

  private val _AnyWhitespaceRegex = """.*\s.*""".r

  // Note: PageGuidPtrn:
  //  - The initial "-" is not part of the guid
  // PageSlugPtrn:
  //  - PageSlugPtrn: "*+~" have special meanings
  //
  private val _PageGuidPtrn = "-([a-zA-Z0-9_]+)"
  private val _PageSlugPtrn = "([^-*+~/][^*+~/]*)"
  private val _PageIdSlashSlugRegex = s"${_PageGuidPtrn}/${_PageSlugPtrn}".r
  private val _PageIdHyphenSlugRegex = s"${_PageGuidPtrn}-${_PageSlugPtrn}".r
  private val _PageGuidRegex = _PageGuidPtrn.r
  private val _PageSlugRegex = _PageSlugPtrn.r
  private val _BadIdPerhapsOkSlug = "-([a-zA-Z0-9]*[^a-zA-Z0-9-]+[^-/]*)[-/].*".r
  // Catches corrupt page names iff used *after* PageGuidAndSlugRegex.
  // (Broken and effectively not in use??)
  private val _OkIdBadSlug = (_PageGuidPtrn +"-(.*[^a-zA-Z0-9_].*)").r

}


@deprecated("I think isn't needed or used?", "2014")
case class PathRanges(
  folders: Seq[String] = Nil,
  trees: Seq[String] = Nil,
  pageIds: Seq[String] = Nil) {

  folders foreach _checkIsFolder
  trees foreach _checkIsFolder

  private def _checkIsFolder(path: String): Unit = {
    dieIf(!path.startsWith("/"), "DwE83JGF7")
    dieIf(!path.endsWith("/"), "DwE90kX2")
  }
}


object PathRanges {
  val Anywhere = PathRanges(trees = Seq("/"))
}


case class SitePageId(siteId: SiteId, pageId: PageId) {
  def toPrettyString = s"site $siteId, page $pageId"
}

case class SitePostId(siteId: SiteId, postId: PostId) {
  def toPrettyString = s"site $siteId, post $postId"
}

case class SiteIdAndPost(siteId: SiteId, post: Post) {
  def toPrettyString = s"site $siteId, Post ${post.id}"
}

case class SitePageIdVersion(siteId: String, pageId: PageId, version: PageVersion)

case class PageIdVersion(pageId: PageId, version: PageVersion)

case class PageIdToRerender(
  siteId: SiteId,
  pageId: PageId,
  currentVersion: i32,
  cachedVersion: Opt[CachedPageVersion]) {

  def sitePageId: SitePageId = SitePageId(siteId, pageId)
}



/** An URL path, relative a certain site.
  */
case class SitePath(siteId: SiteId, path: String)


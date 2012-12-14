/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0._
import java.{util => ju}
import Prelude._


/**
 * Resolves an URL to a PagePath; looks up any host name to find its website id.
 *
 * (Copy-edited from old DeprecatedTemplateEngine, Git commit 11c2a07792b, 2012-11-04.)
 */
object UrlToPagePathResolver {


  sealed abstract class Result
  object Result {
    case class HostNotFound(host: String) extends Result
    case object PageNotFound extends Result
    case class BadUrl(error: String) extends Result
    case class Ok(pagePath: PagePath) extends Result
  }


  /**
   * Constructs PagePaths to assets; resolves host names to tenant ids.
   * Example inputs:
   *   "http://other-tenant.com/themes/some-public-theme/nice.css"
   *   "/themes/local/theme.css"
   *
   * Throws Not Found if a host cannot be resolved to a tenant id.
   */
  def resolveUrl(url: String, basePage: PagePath, dao: TenantDao): Result = {

    // Parse URL, resolve host name to tenant id.
    val parsedUrl = parseUrl(url) match {
      case Right(parsedUrl) => parsedUrl
      case Left(errorMessage) => return Result.BadUrl(errorMessage)
    }

    val tenantId = parsedUrl.schemeHostOpt match {
      case None => basePage.tenantId
      case Some((scheme, host)) =>
        dao.lookupOtherTenant(scheme, host) match {
          case found: FoundChost => found.tenantId
          case found: FoundAlias => found.tenantId
          case FoundNothing => return Result.HostNotFound(host)
        }
    }

    // Handle relative folder paths.
    val folder =
      if (parsedUrl.folder startsWith "/") parsedUrl.folder
      else basePage.parentFolder + parsedUrl.folder

    val pagePathNoId = PagePath(tenantId = tenantId, folder = folder,
      pageId = None, showId = false, pageSlug = parsedUrl.page)

    val pagePath = dao.checkPagePath(pagePathNoId) getOrElse (
      return Result.PageNotFound)

    Result.Ok(pagePath)
  }


  private case class ParsedUrl(
    schemeHostOpt: Option[(String, String)],
    folder: String,
    page: String)


  /**
   * Extracts any scheme and host from an url, and parses the path component
   * into a PagePath. Verifies that any host name contains only valid chars.
   * --- Now I've changed it to return Left(error-message) instead of throwing. --
   *
   * Examples:
   * parseUrl("http://server/folder/page")
   * gives: ParsedUrl(Some((http,server)),/folder/,page)
   *
   * parseUrl("http://server/folder/")
   * gives: ParsedUrl(Some((http,server)),/folder/,)
   *
   * parseUrl("http://server/page")
   * gives: ParsedUrl(Some((http,server)),/,page)
   *
   * parseUrl("http://server/")
   * gives: ParsedUrl(Some((http,server)),/,)
   *
   * parseUrl("http://server")  throws error.
   *
   * parseUrl("folder/")  gives: ParsedUrl(None,folder/,)
   *
   * parseUrl("/page")  gives: ParsedUrl(None,/,page)
   *
   * parseUrl("page")  gives: ParsedUrl(None,,page)
   *
   */
  private def parseUrl(url: String): Either[String, ParsedUrl] = {
    if (url.contains("#")) return Left("URL contains '#'")
    if (url.contains("?")) return Left("URL contains '?'")

    val parsedUrl = url match {
      case OriginFolderPageRegex(scheme, host, relFolder_?, page) =>
        val folder = (relFolder_? eq null) ? "/" | "/"+ relFolder_?
        if (!isValidHostAndPort(host))
          return Left("Invalid host name: "+ host)
        ParsedUrl(Some((scheme, host)), folder, page)
      case AbsFolderPageRegex(folder, _, page) =>
        assert(page ne null)
        ParsedUrl(None, folder, page)
      case RelFolderPageRegex(folder_?, page) =>
        val folder = (folder_? eq null) ? "" | folder_?
        assert(page ne null)
        ParsedUrl(None, folder, page)
      case _ =>
        // COULD throw some exception that can be converted
        // to a 400 Bad Request?
        return Left("Bad URL")
    }

    // "http://server" is parsed incorrectly, reject it.
    if (parsedUrl.folder contains "://")
      return Left("Bad URL")
    if (parsedUrl.page contains "://")
      return Left("Bad URL")

    Right(parsedUrl)
  }


  private val OriginFolderPageRegex = """^(https?)://([^/]+)/(.*/)?([^/]*)$""".r
  private val AbsFolderPageRegex = """^(/(.*/)?)([^/]*)$""".r
  private val RelFolderPageRegex = """([^/].*/)?([^/]*)""".r

}


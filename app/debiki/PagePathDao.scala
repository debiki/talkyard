/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0._
import controllers._
import java.{util => ju}
import scala.xml.NodeSeq
import EmailNotfPrefs.EmailNotfPrefs
import Prelude._


trait PagePathDao {
  self: TenantDao =>


  def moveRenamePage(pageId: String, newFolder: Option[String] = None,
        showId: Option[Boolean] = None, newSlug: Option[String] = None)
        : PagePath =
    tenantDbDao.moveRenamePage(pageId = pageId, newFolder = newFolder,
      showId = showId, newSlug = newSlug)


  def checkPagePath(pathToCheck: PagePath): Option[PagePath] =
    tenantDbDao.checkPagePath(pathToCheck)


  def lookupPagePathByPageId(pageId: String): Option[PagePath] =
    tenantDbDao.lookupPagePathByPageId(pageId = pageId)

}



trait CachingPagePathDao extends PagePathDao {
  self: CachingTenantDao =>

}


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


trait ConfigValueDao {
  this: TenantDao =>


  def loadPageConfigMap(pageId: String): Map[String, Any] =
    _loadConfigMap(pageId, configPostId = Page.TemplateId)


  def loadWebsiteConfigMap(): Map[String, Any] = {
    val pagePathIdKnown = checkPagePath(websiteConfigPagePath)
    pagePathIdKnown match {
      case None => Map.empty
      case Some(pagePath) =>
        _loadConfigMap(pagePath.pageId.get, configPostId = Page.BodyId)
    }
  }


  private def _loadConfigMap(pageId: String, configPostId: String)
        : Map[String, Any] = {
    // Load the post as YAML into a map.
    loadPage(pageId) match {
      case None => return Map.empty
      case Some(page) =>
        val configText = page.vipo(configPostId) match {
          case None => return Map.empty
          case Some(post) => post.text
        }
        DebikiYaml.parseYamlToMap(configText)
    }
  }


  /**
   * A PagePath to /.website-config.yaml, but the page id is unknown and
   * needs to be looked up (via Dao.checkPagePath).
   *
   * The file starts with `.` because it should be accessible to admins only.
   *
   * COULD move to other module, but what module?
   */
  def websiteConfigPagePath = PagePath(
    tenantId = tenantId, folder = "/", pageId = None,
    showId = false, pageSlug = ".website-config.yaml")

}


trait CachingConfigValueDao extends ConfigValueDao {
  self: TenantDao =>

  // COULD override methods and cache stuff.

}


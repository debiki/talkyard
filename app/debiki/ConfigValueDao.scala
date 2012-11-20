/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0._
import java.{util => ju}
import Prelude._


trait ConfigValueDao {
  self: TenantDao =>


  def loadPageConfigMap(pageId: String): Map[String, Any] =
    loadConfigMap(pageId, configPostId = Page.TemplateId)


  def loadWebsiteConfigMap(): Map[String, Any] = {
    val pagePathIdKnown = checkPagePath(websiteConfigPagePath)
    pagePathIdKnown match {
      case None => Map.empty
      case Some(pagePath) =>
        loadConfigMap(pagePath.pageId.get, configPostId = Page.BodyId)
    }
  }


  protected def loadConfigMap(pageId: String, configPostId: String)
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
  self: TenantDao with CachingDao =>


  protected override def loadConfigMap(pageId: String, configPostId: String)
        : Map[String, Any] = {
    val key = pageConfigMapKey(pageId)
    val mapOpt = lookupInCache[Map[String, Any]](key)
    mapOpt match {
      case None =>
        val map = super.loadConfigMap(pageId, configPostId = configPostId)
        putInCache[Map[String, Any]](key, value = map)
        map
      case Some(map) =>
        map
    }
  }


  def pageConfigMapKey(pageId: String) = s"$pageId|$tenantId|ConfigMap"


  def uncacheConfigMap(pageId: String) {
    removeFromCache(pageConfigMapKey(pageId))
  }

}


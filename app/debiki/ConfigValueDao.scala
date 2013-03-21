/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0._
import java.{util => ju}
import Prelude._


/**
 * Provides config values for the website and for individual pages.
 *
 * Site wide config values are read from /_site.conf.
 * Page specific config values are read from any post with id Page.ConfigPostId.
 *
 * Site wide config values fallback to any other config file specified in _site.conf
 * like so: `extend: http://other-server/themes/some-theme/theme.conf`, recursively.
 */
trait ConfigValueDao {
  self: TenantDao =>


  def loadPageConfigMap(pageId: String): Map[String, Any] =
    loadConfigMap(SitePageId(tenantId, pageId), configPostId = Page.ConfigPostId)


  /**
   * Loads config values for the relevant website. First loads _site.conf,
   * then checks config values in any config-file-to-extend specified in _site.conf,
   * then in yet-another-config-file-to-extend, if another one is specified in
   * the first config-file-to-extend, and so on.
   *
   * Example:
   * In ./_site.conf:
   *   extend: www.debiki.com/themes/default-2012-10-21/theme.conf
   * Now config values will first be read from _site.conf,
   * and if absent, config values in theme.conf will be used instead.
   *
   * Throws WebsiteConfigException e.g. if a config page cannot be found.
   */
  def loadWebsiteConfig(): WebsiteConfig = {
    var leaves: List[WebsiteConfigLeaf] = Nil
    var nextLeafUrl: Option[String] = Some(websiteConfigPath)
    do {
      val nextLeaf: WebsiteConfigLeaf = loadWebsiteConfigLeaf(nextLeafUrl.get)
      leaves ::= nextLeaf
      nextLeafUrl = nextLeaf.anyConfigUrlToExtend
    } while (nextLeafUrl.isDefined)
    WebsiteConfig(leaves.reverse)
  }


  private def loadWebsiteConfigLeaf(url: String): WebsiteConfigLeaf = {
    import UrlToPagePathResolver.Result
    UrlToPagePathResolver.resolveUrl(
        url, this, baseSiteId = tenantId, baseFolder = "/") match {
      case Result.HostNotFound(host) =>
        throw WebsiteConfigException("DwE4Dc30", s"Host not found, url: `$url'")
      case Result.PageNotFound =>
        throw WebsiteConfigException("DwE7Ibx3", s"Config page not found: `$url'")
      case Result.BadUrl(error) =>
        throw WebsiteConfigException("DwE8PkF1", s"Bad URL: `$url'")
      case Result.Ok(pagePath) =>
        val configSitePageId = pagePath.sitePageId getOrDie "DwE0Bv3"
        val configMap = loadConfigMap(configSitePageId, configPostId = Page.BodyId)
        WebsiteConfigLeaf.fromSnakeYamlMap(configMap, configSitePageId)
    }
  }


  protected def loadConfigMap(sitePageId: SitePageId, configPostId: String)
        : Map[String, Any] = {
    // Load the post as YAML into a map.
    loadPageAnyTenant(sitePageId) match {
      case None => return Map.empty
      case Some(page) =>
        val configText = page.getPost(configPostId) match {
          case None => return Map.empty
          case Some(post) => post.text
        }
        DebikiYaml.parseYamlToMap(configText)
    }
  }


  /**
   * The location of the website config page.
   *
   * The file starts with `_` because it should be accessible to admins only.
   *
   * COULD move to other module, but what module?
   */
  val websiteConfigPath = "_site.conf"

}



trait CachingConfigValueDao extends ConfigValueDao {
  self: TenantDao with CachingDao =>


  onPageSaved { sitePageId =>
    // We don't know if the page is a config page, and its body was edited, or
    // if only the page's config post was edited. — Simply attempt to remove both
    // config values from cache.
    removeFromCache(configMapKey(sitePageId, Page.BodyId))
    removeFromCache(configMapKey(sitePageId, Page.ConfigPostId))
  }


  protected override def loadConfigMap(sitePageId: SitePageId, configPostId: String)
        : Map[String, Any] = {
    val key = configMapKey(sitePageId, configPostId)
    val mapOpt = lookupInCache[Map[String, Any]](key)
    mapOpt match {
      case None =>
        val map = super.loadConfigMap(sitePageId, configPostId = configPostId)
        putInCache[Map[String, Any]](key, value = map)
        map
      case Some(map) =>
        map
    }
  }


  // Include the config post id in the key, because otherwise when a config *page*
  // is reloaded, that config page's own *configuration post* will be cached, and
  // overwrite the cached value of the config map the page's body represents
  // (since they'd share the same keys, were `configPostId` not included in the key).
  private def configMapKey(sitePageId: SitePageId, configPostId: String) =
    s"${sitePageId.pageId}|${sitePageId.siteId}|$configPostId|ConfigMap"

}


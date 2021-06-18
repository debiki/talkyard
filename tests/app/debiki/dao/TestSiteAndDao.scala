package debiki.dao

import com.debiki.core._
import com.debiki.core.Prelude._


class TestSiteAndDao(
  val siteId: SiteId,
  val daoAppSuite: DaoAppSuite) {

  def globals: debiki.Globals = daoAppSuite.globals

  var site: Site = _
  var daoStale: Bo = false
  private var curDaoMaybeStale: SiteDao = _


  def id: SiteId = site.id

  def dao: SiteDao = {
    if (curDaoMaybeStale eq null) {
      if (siteId == Site.FirstSiteId) {
        site = globals.systemDao.getOrCreateFirstSite()
        curDaoMaybeStale = globals.siteDao(siteId)
      }
      else {
        val (newSite, newDao) = daoAppSuite.createSite(s"site-$siteId")
        site = newSite
        curDaoMaybeStale = newDao
      }
    }
    else if (daoStale) {
      curDaoMaybeStale = globals.siteDao(siteId)
      daoStale = false
    }

    curDaoMaybeStale
  }

}

/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0._
import java.{util => ju}
import play.{api => p}
import play.api.{cache => pc}
import play.api.Play.current
import scala.reflect.ClassTag
import Prelude._



abstract class RichDaoFactory {
  def systemDao: SystemDao
  def buildTenantDao(quotaConsumers: QuotaConsumers): RichTenantDao
}



object RichDaoFactory {

  def apply(dbDaoFactory: DbDaoFactory, quotaCharger: QuotaCharger)
        = new RichDaoFactory {
    private val _dbDaoFactory = dbDaoFactory
    private val _quotaCharger = quotaCharger

    def systemDao = _dbDaoFactory.systemDbDao

    def buildTenantDao(quotaConsumers: QuotaConsumers): RichTenantDao = {
      val spi = _dbDaoFactory.newTenantDbDao(quotaConsumers)
      new RichTenantDao(spi, _quotaCharger)
    }
  }
}



class RichTenantDao(tenantDbDao: TenantDbDao, quotaCharger: QuotaCharger)
  extends ChargingTenantDbDao(tenantDbDao, quotaCharger) {

}


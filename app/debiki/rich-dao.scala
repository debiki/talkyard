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



abstract class DaoFactory {
  def systemDao: SystemDao
  def newTenantDao(quotaConsumers: QuotaConsumers): TenantDao
}



object DaoFactory {

  def apply(dbDaoFactory: DbDaoFactory, quotaCharger: QuotaCharger)
        = new DaoFactory {
    private val _dbDaoFactory = dbDaoFactory
    private val _quotaCharger = quotaCharger

    def systemDao = _dbDaoFactory.systemDbDao

    def newTenantDao(quotaConsumers: QuotaConsumers): TenantDao = {
      val tenantDbDao = _dbDaoFactory.newTenantDbDao(quotaConsumers)
      new TenantDao(tenantDbDao, _quotaCharger)
    }
  }
}



class TenantDao(tenantDbDao: TenantDbDao, quotaCharger: QuotaCharger)
  extends ChargingTenantDbDao(tenantDbDao, quotaCharger) {

}


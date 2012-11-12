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

  def apply(daoSpiFactory: DaoSpiFactory, quotaCharger: QuotaCharger)
        = new RichDaoFactory {
    private val _daoSpiFactory = daoSpiFactory
    private val _quotaCharger = quotaCharger

    def systemDao = new SystemDao(_daoSpiFactory.systemDaoSpi)

    def buildTenantDao(quotaConsumers: QuotaConsumers): RichTenantDao = {
      val spi = _daoSpiFactory.buildTenantDaoSpi(quotaConsumers)
      new RichTenantDao(spi, _quotaCharger)
    }
  }
}



class RichTenantDao(spi: TenantDaoSpi, quotaCharger: QuotaCharger)
  extends TenantDao(spi, quotaCharger) {

}



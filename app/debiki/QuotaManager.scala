/**
 * Copyright (C) 2012 Kaj Magnus Lindberg (born 1979)
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

package debiki

import com.debiki.core._
import com.debiki.core.Prelude._
import com.google.common.{cache => ggc}
import com.google.common.{base => ggb}
import debiki.dao.SystemDao
import java.{util => ju, lang => jl}
import java.util.{concurrent => juc}
import scala.collection.{mutable => mut}
import scala.concurrent.duration._
import scala.concurrent.ExecutionContext.Implicits.global
import QuotaManager._


class QuotaManager(
  val actorSystem: akka.actor.ActorSystem,
  val systemDao: SystemDao,
  val freeDollarsToEachNewSite: Float,
  val unitTestTicker: Option[ggb.Ticker] = None) {

  private def _dao = systemDao

  private val log = play.api.Logger("app.quota")

  private def MaxCacheItemAgeSeconds = 20  // for now

  private case class CacheKeyAddition(consumer: QuotaConsumer, when: ju.Date)


  /**
   * Remembers when items were inserted into the quota usage cache,
   * and periodically removes old items from the cache and writes the
   * accumulated quota and resource usage to database.
   */
  private object CacheFlusher extends akka.actor.Actor {

    private var _cacheKeyAdditions = mut.Queue[CacheKeyAddition]()

    def receive = {
      case a: CacheKeyAddition => _cacheKeyAdditions.enqueue(a)
      case "FlushOldToDb" => _removeAndSaveOldCacheValues()
    }

    /**
     * Removes old items from the in memory quota cache, saves them in the db.
     */
    private def _removeAndSaveOldCacheValues() {
      log.trace("Saving to database any old cached states...")
      val longAgo = (new ju.Date).getTime - MaxCacheItemAgeSeconds*1000
      while (_cacheKeyAdditions.nonEmpty &&
         _cacheKeyAdditions.front.when.getTime < longAgo) {
        val keyAddition = _cacheKeyAdditions.dequeue
        _saveCachedQuotaState(keyAddition.consumer)
      }
    }
  }


  private val CacheFlusherRef = actorSystem.actorOf(akka.actor.Props(CacheFlusher),
     name = s"CacheFlusher-${jl.System.identityHashCode(this)}")


  /**
   * Schedules removal of old cache items.
   */
  def scheduleCleanups() {
    actorSystem.scheduler.schedule(20 seconds, 20 seconds, CacheFlusherRef,
       "FlushOldToDb")
  }


  /**
   * Restricts how much free quota we add to a consumer that has not used
   * the system for fairly long.
   *
   * For example, if you visit a tenant's Web site after a 5 month
   * absence, you won't get 5 month's worth of freeload quota.
   * Instead you'll get quota for NewFreeQuotaCapInDays.
   *
   * (This requires that the db limits be updated regularly,
   * otherwise free quota limits would freeze. But when you use quota,
   * the db will be updated, after a while (much faster than
   * NewFreeQuotaCapInDays), so this should not be an issue?)
   */
  val NewFreeQuotaCapInDays = 7


  private case class _CachedQuotaState(
     mtime: ju.Date,
     quotaStateOrig: QuotaState,
     foundInDb: Boolean,
     /** Accumulated quota usage, since `quotaStateOrig` was read/created. */
     accumQuotaUse: QuotaUse = QuotaUse(),
     accumResUse: ResourceUse = ResourceUse()) {

    /**
     * Adds `accumQuotaUse` to the db quota usage.
     */
    def quotaUseNow: QuotaUse = quotaStateOrig.quotaUse + accumQuotaUse

    /**
     * Adds `accumQuotaUse` and `accumResUse` to `quotaStateOrig`,
     * and adds `quotaDailyFree` and `quotaDailyFreeload`
     * to the limits (taking `time` into account).
     *
     * Could/should move to QuotaState?
     */
    def quotaStateAt(time: ju.Date): QuotaState = {
      val orig = quotaStateOrig
      // (Don't divide by oneDayInMs too early, or the quotient might become 0.)
      val oneDayInMs = 1000 * 3600 * 24
      // If the QuotaState was loaded from db after _charge was called,
      // `time - orig.mtime` might be < 0.
      var timeDiffInMs = math.max(0, time.getTime - orig.mtime.getTime)
      val plannedNewFree = orig.quotaDailyFree * timeDiffInMs / oneDayInMs
      val plannedNewFreeload =
         orig.quotaDailyFreeload * timeDiffInMs / oneDayInMs

      // Do not add excessively much free quota: there shouldn't be more than
      // NewFreeQuotaCapInDays' worth of free and freeload quota.
      val freeCap = orig.quotaDailyFree * NewFreeQuotaCapInDays
      val freeloadCap = orig.quotaDailyFreeload * NewFreeQuotaCapInDays
      val maxNewFree = math.max(0,
         freeCap - (orig.quotaLeftFree - accumQuotaUse.free))
      val maxNewFreeload = math.max(0,
         freeloadCap - (orig.quotaLeftFreeload - accumQuotaUse.freeload))

      val limitsDiff = QuotaUse(
        paid = 0,
        free = math.min(plannedNewFree, maxNewFree),
        freeload = math.min(plannedNewFreeload, maxNewFreeload))

      orig.copy(mtime = time)
        .useMoreQuota(accumQuotaUse)
        .pushLimits(limitsDiff)
        .useMoreResources(accumResUse)
    }
  }


  /**
   * Caches 1) quota and resource usage, and quota limits,
   * read from the database. That is, caches a `QuotaLimitsResUse`.
   * The cached value might be out of sync with the value in the db,
   * if other servers write to the database.
   * And caches 2) accumulated quota and resource usage since
   * the QuotaLimitsResUse (in 1 above) was read from the database.
   *
   * (If we were to use the Flyeweight pattern, and a key + value was 200 bytes
   * (currently the key is perhaps 50 bytes), then, with 200 MB heap,
   * we coulud remember statistics for 1 000 000 IP numbers. So it could be
   * hard for a botnet to do an out-of-memory DoS attack against this IP table?)
   */
  private val _quotaStateCache:
        ggc.LoadingCache[QuotaConsumer, _CachedQuotaState] =
    ggc.CacheBuilder.newBuilder()
      .ticker(unitTestTicker.getOrElse(ggb.Ticker.systemTicker))
      .build(
        new ggc.CacheLoader[QuotaConsumer, _CachedQuotaState] {
          override def load(key: QuotaConsumer) = _loadCacheValue(key)
        })


  private def _loadCacheValue(key: QuotaConsumer): _CachedQuotaState = {
    val stateByConsumer: Map[QuotaConsumer, QuotaState] =
       _dao.loadQuotaState(key::Nil)
    assert(stateByConsumer.size <= 1)
    val timeNow = new ju.Date
    val quotaStateInDb = stateByConsumer.get(key)
    val quotaState = quotaStateInDb.getOrElse(
       newQuotaStateWithLimits(timeNow, key, freeDollarsToEachNewSite))
    CacheFlusherRef ! CacheKeyAddition(key, timeNow)
    val state = _CachedQuotaState(mtime = timeNow, quotaStateOrig = quotaState,
       foundInDb = quotaStateInDb.nonEmpty)
    log.trace("Loaded: "+ key +" —> "+ state)
    state
  }


  private def _saveCachedQuotaState(consumer: QuotaConsumer) {
    val cached: _CachedQuotaState = _quotaStateCache.asMap.remove(consumer)
    if (cached eq null) return
    // Could:
    // if (cached.foundInDb && accumQuotaUse and accumResUse are 0) return

    val newLimits = cached.quotaStateAt(cached.mtime).quotaLimits
    val quotaDelta = QuotaDelta(
       mtime = cached.mtime,
       deltaQuota = cached.accumQuotaUse,
       deltaResources = cached.accumResUse,
       newFreeLimit = newLimits.free,
       newFreeloadLimit = newLimits.freeload,
       initialDailyFree = cached.quotaStateOrig.quotaDailyFree,
       initialDailyFreeload = cached.quotaStateOrig.quotaDailyFreeload,
       foundInDb = cached.foundInDb)

    log.trace("Saving: "+ consumer +" —> "+ quotaDelta)
    _dao.useMoreQuotaUpdateLimits(Map(consumer -> quotaDelta))
  }


  /**
   * Atomically adds `deltaQuota` and `deltaResources` to the  consumer's
   * accumulated quota and resource usage counters in the _quotaStateCache.
   */
  private def _updateCachedQuotaState(
        consumer: QuotaConsumer,
        lastKnownCachedValue: _CachedQuotaState,
        deltaQuota: QuotaUse,
        deltaResources: ResourceUse,
        timeNow: ju.Date) {

    var oldState = lastKnownCachedValue
    val concurrentMap = _quotaStateCache.asMap

    while (true) {
      val newState = oldState.copy(mtime = timeNow,
         accumQuotaUse = oldState.accumQuotaUse + deltaQuota,
         accumResUse = oldState.accumResUse + deltaResources)

      val replaced = concurrentMap.replace(consumer, oldState, newState)
      if (replaced) {
        log.trace("Updated: "+ consumer +" —> "+ newState)
        return
      }

      // Another thread replaced the cached value before us, or
      // the CacheFlusher has removed the entry. Read new value from
      // cache or db (use _quotaStateCache.get, not concurrentMap.get),
      // and add accum quotas and resources to it.
      oldState = _quotaStateCache.get(consumer)
    }
  }


  object QuotaChargerImpl extends QuotaCharger {
    override def chargeOrThrow(quotaConsumers: QuotaConsumers,
          resourceUse: ResourceUse, mayPilfer: Boolean) {
      _charge(quotaConsumers, resourceUse, mayPilfer, commit = true)
    }

    override def throwUnlessEnoughQuota(quotaConsumers: QuotaConsumers,
          resourceUse: ResourceUse, mayPilfer: Boolean) {
      _charge(quotaConsumers, resourceUse, mayPilfer, commit = false)
    }
  }


  private def _charge(quotaConsumers: QuotaConsumers,
        resourceUse: ResourceUse, mayPilfer: Boolean, commit: Boolean) {

    val quotaCost = _quotaCostFor(resourceUse)
    val timeNow = new ju.Date

    // Limit pilfering to roughly $0.005, that's enough for, say, 50 emails.
    val pilferLimit = mayPilfer ? (MicroQuotaPerDollar / 200) | 0

    // ----- Setup charge attempts.

    // Note: Currently only the chargeTenantAttempt is considered --
    // exceptions are (regrettably) thrown below, should this attempt fail.

    // Try to charge the tenant, and let other consumers (global ip,
    // per tenant ip, role) freeload on the tenant.
    val chargeTenantAttempt =
      (quotaConsumers.tenant,
       quotaConsumers.globalIp.toList :::
       quotaConsumers.perTenantIp.toList :::
       quotaConsumers.role.toList)

    // If the tenant is over quota, attempt to charge the role (if any).
    // (This can allow an admin to manage a tenant although the tenant
    // is over quota. E.g. clean up after Mallory's posting of 100 000
    // spam comments? Or make minor edits to an otherwise
    // closed-because-over-quota tenant.)
    val chargeRoleAttempt = quotaConsumers.role.map(role =>
      (role,
       quotaConsumers.tenant ::
       quotaConsumers.globalIp.toList :::
       quotaConsumers.perTenantIp.toList)).toList

    // Allow pilfering from the IP's quota. This makes sense if the tenant
    // is over quota -- it should still be possible to e.g. unsubscribe from
    // email notfs, for unauthenticated identities (then we cannot charge
    // any role).
    val chargeGlobalIpAttempt =
      quotaConsumers.globalIp.filter(_ => mayPilfer).map(globalIp =>
        (globalIp,
         quotaConsumers.tenant ::
         quotaConsumers.perTenantIp.toList :::
         quotaConsumers.role.toList)).toList

    val chargeAttempts =
       chargeTenantAttempt :: chargeRoleAttempt ::: chargeGlobalIpAttempt


    // ----- Actually charge.

    for (chargeAttempt <- chargeAttempts) {
      val (payer, freeloaders) = chargeAttempt

      // ----- Die if payer over quota.

      // This prevents DoS attacks against the tenant from bringing down
      // all other tenants. (The payer has either paid real money,
      // or been granted free quota, for some reason.)

      val payerCached = _quotaStateCache.get(payer)
      val payerStateNow = payerCached.quotaStateAt(timeNow)
      val (payerStateAfter, payerQuotaOutstanding) =
         payerStateNow.charge(quotaCost, pilferLimit = pilferLimit)

      // SHOULD not throw, instead, try with next payer!
      if (payerQuotaOutstanding > 0)
        throw OverQuotaException(payer, stateNow = payerStateNow,
          stateAfter = payerStateAfter, outstanding = payerQuotaOutstanding,
          message = o"""${_nameOf(payer)} over quota. Cannot pay $quotaCost
            microquota: if using up all remaining free and paid quota,
            $payerQuotaOutstanding microquota is outstanding [DwE48PB0]""")

      // ----- Die if any freeloader is over quota.

      // Checking per tenant IP and/or role quota prevents [DoS attacks
      // from a limited number of IPs and/or roles] from bringing down
      // a tenant.

      // Checking global IP prevents DoS attacks from a limited number
      // of IPs from bringing down all tenants.

      val freeloaderInfos =
        for (freeloader <- freeloaders) yield {
          val freeldrCached = _quotaStateCache.get(freeloader)
          val freeldrStateNow = freeldrCached.quotaStateAt(timeNow)
          val (freeldrStateAfter, freeldrOutstanding) =
            freeldrStateNow.freeload(quotaCost, pilferLimit = pilferLimit)

          // SHOULD not throw, instead, try with next payer!
          if (freeldrOutstanding > 0)
            throw OverQuotaException(freeloader, stateNow = freeldrStateNow,
              stateAfter = freeldrStateAfter, outstanding = freeldrOutstanding,
              message = o"""${_nameOf(freeloader)} over freeload quota.
                Cannot freeload $quotaCost microquota: if using up all
                remaining freeload quota, $freeldrOutstanding microquota
                is outstanding [DwE6CXJ7]""")

          (freeloader, freeldrCached, freeldrStateAfter)
        }

      // ----- Update in-mem cache

      if (commit) {
        val payerQuotaDelta =
           payerStateAfter.quotaUse - payerCached.quotaUseNow
        _updateCachedQuotaState(payer, payerCached, payerQuotaDelta,
           resourceUse, timeNow)

        for ((freeldr, freeldrCached, freeldrStateAfter) <- freeloaderInfos) {
          val quotaDelta =
            freeldrStateAfter.quotaUse - freeldrCached.quotaUseNow
          _updateCachedQuotaState(freeldr, freeldrCached, quotaDelta,
             resourceUse, timeNow)
        }
      }

      // Cancel remaining charge attempts; we successfully charged `payer`.
      return
    }

  }

}



object QuotaManager {

  def MicroQuotaPerDollar = 10 * 1000 * 1000

  /**
   * For now, grant 10 quota, i.e. roughly roughly $1, to a new tenant.
   * That should be enough for a popular blog for 1 month.
   * Allow each other consumer to freeload 1/100 of the tenant's quota each
   * day -- but the freeload quota accumulates over NewFreeQuotaCapInDays days
   * which is currently 7 days. Then it is capped,
   * so each consumer will be able to consume 7% of the tenant's quota
   * (and Mallory alone cannot DoS the tenant).
   *
   * Set the global quota higher than the per site quota. So even if an
   * IP runs out of quota at a certain site, it'll still be able to access
   * other sites.
   *
   * COULD read values from database, perhaps id = 'default' rows? Fix later...
   */
  def newQuotaStateWithLimits(
        time: ju.Date, consumer: QuotaConsumer, freeDollarsToEachNewSite: Float)
        : QuotaState = {
    val freeForOneSite = (MicroQuotaPerDollar * freeDollarsToEachNewSite).toInt
    val oneHundredth = freeForOneSite / 100
    val (freeQuota, freeloadPerDay) = consumer match {
      case _: QuotaConsumer.Tenant => (freeForOneSite, 0)
      case _: QuotaConsumer.PerTenantIp => (0, oneHundredth)
      case _: QuotaConsumer.GlobalIp => (0, 2 * oneHundredth)
      case _: QuotaConsumer.Role => (0, oneHundredth)
    }

    QuotaState(
       ctime = time,
       mtime = time,
       quotaUse = QuotaUse(),
       quotaLimits = QuotaUse(
          paid = 0, free = freeQuota, freeload = freeloadPerDay),
       quotaDailyFree = 0,
       quotaDailyFreeload = freeloadPerDay,
       resourceUse = ResourceUse())
  }


  private def _nameOf(consumer: QuotaConsumer) = consumer match {
    case tenantConsumer: QuotaConsumer.Tenant =>
      s"Site ${tenantConsumer.tenantId}"
    case tenantIpConsumer: QuotaConsumer.PerTenantIp =>
      s"IP ${tenantIpConsumer.ip} at site ${tenantIpConsumer.tenantId}"
    case globalIpConsumer: QuotaConsumer.GlobalIp =>
      s"IP ${globalIpConsumer.ip}, gobally,"
    case roleConsumer: QuotaConsumer.Role =>
      s"Role ${roleConsumer.roleId} at site ${roleConsumer.tenantId}"
  }


  /**
   * Converts resource usage to quota cost.
   *
   * For now, hardcode costs here, base it on Amazon's EC2 pricing,
   * and 10 quota <--> $1.
   * In the future: ask the SystemDao to load it from some db table?
   *
   * As of 2012-05-06:
   * Amazon EBS Volumes:
   *  - $0.10 per GB-month of provisioned storage
   *  - $0.10 per 1 million I/O requests
   * Email: $0.10 per thousand
   *
   * Assume 1kb for each login, role, page, action, notf, email.
   * But 10kb per identity, because OpenID identifiers are really long,
   * and duplicated because of table indexes.
   *
   * Assume we need to store everything duplicated 10 times, 10 years.
   * (So multiply monthly costs with 12*10*10.)
   */
  private def _quotaCostFor(resUse: ResourceUse): Long = {
    // Microquota per USD.
    val mqPerUsd = 10*1000*1000
    // Disk costs.
    val mqPerGb = mqPerUsd/10 * 12 * 10 * 10  // $0.1, 120 months dupl x 10
    val mqPerKb = mqPerGb / (1000*1000)   // = 1200
    val mqPer10Bytes = mqPerKb / 100  // = 12
    // IO costs (million IO reqs)
    val mqPerMio = 1000*1000
    // Of course num IOs per DAO read request could be just about anything,
    // frequently 0 if only in mem db buffers accessed.
    // Anyway, setting a low value stops certain DoS attacks?
    // I guess that perhaps 3 db index block reads and 2 table block
    // reads is a somewhat reasonable average value?
    val numIosPerDaoRead = 5  // --> each read req costs 5 mq
    // Writing to the db modifies tables, indexes, transaction logs,
    // backup files. Lets guess:
    val numIosPerDaoWrite = 100  // --> each write req costs 100 mq
    // Emails:
    val mqPerEmailSent = 1000*1000 / 1000  // = 1000

    resUse.numIdsUnau * mqPerKb +
       resUse.numIdsAu * mqPerKb * 10 +  // see "10kb" comment above
       resUse.numRoles * mqPerKb +
       resUse.numPages * mqPerKb +
       resUse.numActions * mqPerKb +
       // Count bytes in units of 10 (round up), for now, because
       // mqPer10Bytes is 12, cannot be made smaller (without converting
       // away from Long).
       (resUse.numActionTextBytes + 9) / 10 * mqPer10Bytes +
       resUse.numNotfs * mqPerKb +
       resUse.numEmailsOut * (mqPerKb + mqPerEmailSent) +
       resUse.numDbReqsRead * mqPerMio / (1000*1000) * numIosPerDaoRead +
       resUse.numDbReqsWrite * mqPerMio / (1000*1000) * numIosPerDaoWrite
  }

}


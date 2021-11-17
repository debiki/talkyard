/**
 * Copyright (c) 2021 Kaj Magnus Lindberg
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

package talkyard.server.sess

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.EdHttp.urlDecodeCookie
import debiki.dao.{MemCacheKey, MemCacheValueIgnoreVersion, SiteDao}
import talkyard.server.dao.StaleStuff
import org.apache.commons.codec.{binary => acb}



trait SessionSiteDaoMixin {
  self: SiteDao =>


  def listPatsSessions(patId: PatId): ImmSeq[TySessionInDbMaybeBad] = {
    val sessionsMaybeBad = readTx(_.loadActiveSessions(patId))
    SECURITY; COULD // also incl recently ended sessions:
    //val recentlyActiveSessions = readTx(_.loadRecentlyEndedSessions(patId, limit = 10)) ?

    // Lazy-mark as expired sessions that has just expired.  [lazy_expire_sessions]
    val settings = getWholeSiteSettings()
    val now = this.now()
    val (justExpiredSessions, activeSessions) = sessionsMaybeBad.partition(
          _.expiresNow(now, expireIdleAfterMins = settings.expireIdleAfterMins))
    for (session <- justExpiredSessions) {
      val sessionExpired = session.copy(expiredAt = Some(now))
      updateSession(sessionExpired)
    }

    activeSessions
  }


  def getSessionByPart1(part1Maybe2Or3: St): Opt[TySessionInDbMaybeBad] = {
    memCache.lookup[TySessionInDbMaybeBad](
          key = mkSessionPart1Key(part1Maybe2Or3),
          orCacheAndReturn = loadSessionByPart1(part1Maybe2Or3),
          // We don't want to reload all sessions from the database, just because
          // some site settings got changed.
          ignoreSiteCacheVersion = true)
  }


  def loadSessionByPart1(part1Maybe2Or3: St): Opt[TySessionInDbMaybeBad] = {
    readTx(_.loadSession(part1Maybe2Or3 = Some(part1Maybe2Or3)))
  }


  /*
  def getSessionByPart4MaybeActiveOnly(part4Hash: Array[i8]): Opt[TySessionInDbMaybeBad] = {
    memCache.lookup[TySessionInDbMaybeBad](
          key = mkSessionPart4Key(part4),
          orCacheAndReturn = loadSessionByPart4(part4, maybeActiveOnly = true),
          ignoreSiteCacheVersion = true)
  } */

  /// If maybeActiveOnly, won't load sessions that have been terminated for sure,
  /// but does load sessions that might have expired, but that has not yet been
  /// marked as expired in the database.
  ///
  def loadSessionByPart4(hash4: Array[i8], maybeActiveOnly: Bo): Opt[TySessionInDbMaybeBad] = {
    readTx(_.loadSession(hash4HttpOnly = Some(hash4), maybeActiveOnly = maybeActiveOnly))
  }


  def insertValidSession(session: TySession): U = {
    writeTx { (tx, _) =>
     tx.insertValidSession(session)
    }
    updateSessionInCache(session.copyAsMaybeBad)
  }


  def updateSession(session: TySessionInDbMaybeBad): U = {
    writeTx { (tx, _) =>
     tx.upsertSession(session)
    }
    updateSessionInCache(session)
  }


  private def updateSessionInCache(session: TySessionInDbMaybeBad): U = {
     memCache.put(
          mkSessionPart1Key(session.part1CompId),
          MemCacheValueIgnoreVersion(session))
    //memCache.put(
    //    mkSessionPart4HashKey(session.part4HashHttpOnly),
    //    MemCacheValueIgnoreVersion(session))
  }


  private def removeSessionFromCache(session: TySessionInDbMaybeBad): U = {
    memCache.remove(mkSessionPart1Key(session.part1CompId))
    //memCache.remove(mkSessionPart4HashKey(session.part4HashHttpOnly))
  }


  def terminateSessionForCurReq(req: play.api.mvc.RequestHeader): U = {
    REFACTOR // Move these cookie names — and their whole file — to this pkg.
    // Thereafter, can remove this import.
    import ed.server.security.EdSecurity._

    val sidPart12Maybe3FromHeader: Opt[St] = req.headers.get(SessionIdHeaderName)
    val sidPart123FromCookie: Opt[St] =
          urlDecodeCookie(SessionIdPart123CookieName, req)

    val sidPart4FromCookie: Opt[St] =
          urlDecodeCookie(SessionIdPart4HttpOnlyCookieName, req)

    // Maybe some day some bug can cause the browser to send two different
    // session part 1 values. Then we'd better delete both sessions.
    sidPart12Maybe3FromHeader foreach { partsInHeader =>
      val twoDifferentPart1 = sidPart123FromCookie.exists(!_.startsWith(partsInHeader))
      if (twoDifferentPart1) {
        AUDIT_LOG // Is this weird? A script might have has tampered with the cookie
        // or header?  For now, to catch bugs:
        warnDevDie("TyE70MWEPG246")
      }
      terminateAnySession(
            sidPart1Maybe2Or3 = Some(partsInHeader),
            sidPart4 = None)
    }

    terminateAnySession(
          sidPart1Maybe2Or3 = sidPart123FromCookie,
          sidPart4 = sidPart4FromCookie)
  }


  private def terminateAnySession(sidPart1Maybe2Or3: Opt[St], sidPart4: Opt[St]): U = {
    val hash4 = sidPart4 map hashSha512FirstHalf32Bytes
    val terminatedSessions = writeTx { (tx, _) =>
      val sessions = tx.loadOneOrTwoSessions(sidPart1Maybe2Or3, hash4HttpOnly = hash4,
            maybeActiveOnly = true)
      assert(sessions.forall(_.wasValidJustRecently))  // could remove the filter() below
      val terminatedSessions =
            sessions.filter(_.wasValidJustRecently)
                .map(_.copy(deletedAt = Some(tx.now)))
      terminatedSessions foreach tx.upsertSession
      terminatedSessions
    }
    // Alternatively, cache the terminated sessions for 10 seconds, in case of
    // any already in-flight requests, so those requests won't need to look in the db?
    // The response (from any current request) will delete all session cookies,
    // so no need to cache for longer than some seconds (maybe 10? more than enough).
    terminatedSessions foreach removeSessionFromCache
    AUDIT_LOG // 0, 1 or 2 sessions got terminated.
  }


  /// Returns any sessions that got terminated; isDeleted will be Some(current-time).
  /// This might include sessions that expired just moments ago — they'll
  /// be both expiredAt = Some(..) and deletedAt = Some(..).
  ///
  def terminateSessions(forPatId: PatId, thoseStartedAt: Seq[When] = Nil,
          allExceptFor: Opt[When] = None, all: Bo = false,
          anyTx: Opt[(SiteTx, StaleStuff)] = None)
          : ImmSeq[TySessionInDbMaybeBad] = {

    dieIf(all && thoseStartedAt.nonEmpty, "TyE60MWEPJ22")
    dieIf(all && allExceptFor.isDefined, "TyE60MWEPJ23")
    dieIf(thoseStartedAt.nonEmpty && allExceptFor.isDefined, "TyE60MWEPJ24")

    val sessionsMaybeBad = readTxTryReuse(anyTx.map(_._1))(_.loadActiveSessions(forPatId))
    val sessionsToEnd = sessionsMaybeBad filter { sess =>
      warnDevDieIf(!sess.wasValidJustRecently, "TyE5MWJY20X")
      all || thoseStartedAt.contains(sess.createdAt) ||
            allExceptFor.isSomethingButNot(sess.createdAt)
    }

    val now = anyTx.map(_._1.now) getOrElse this.now()
    val terminatedSessions = sessionsToEnd.map(_.copy(deletedAt = Some(now)))

    if (terminatedSessions.nonEmpty) {
      writeTxTryReuse(anyTx) { (tx, _) =>
        terminatedSessions foreach tx.upsertSession
      }
    }
    terminatedSessions foreach removeSessionFromCache

    AUDIT_LOG // >= 0 sessions got terminated.
    terminatedSessions
  }


  private def mkSessionPart1Key(part1Maybe23: St): MemCacheKey =
    MemCacheKey(siteId, s"${part1Maybe23 take TySession.SidLengthCharsPart1}|sid1")


  /*
  private def mkSessionPart4HashKey(hash4: Array[i8]): MemCacheKey = {
    val hashSt = acb.Base64.encodeBase64URLSafeString(hash4)
    MemCacheKey(siteId, s"$hashSt|sid1")
  } */

}

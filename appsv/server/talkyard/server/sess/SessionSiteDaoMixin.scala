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
import debiki.dao.SiteDao
import talkyard.server.dao.StaleStuff



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
    readTx(_.loadSession(part1Maybe2Or3 = Some(part1Maybe2Or3)))
     // + cache
  }


  /// If maybeActiveOnly, won't load sessions that have been terminated for sure,
  /// but does load sessions that might have expired, but that has not yet been
  /// marked as expired in the database.
  ///
  def getSessionByPart4HttpOnly(part4: St, maybeActiveOnly: Bo): Opt[TySessionInDbMaybeBad] = {
    readTx(_.loadSession(part4HttpOnly = Some(part4), maybeActiveOnly = maybeActiveOnly))
     // + cache
  }


  def insertValidSession(session: TySession): U = {
    writeTx { (tx, _) =>
     tx.insertValidSession(session)
     // + cache
    }
  }


  def updateSession(session: TySessionInDbMaybeBad): U = {
    writeTx { (tx, _) =>
     tx.upsertSession(session)

     // + uncache
    }
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
    writeTx { (tx, _) =>
      val sessions = tx.loadOneOrTwoSessions(sidPart1Maybe2Or3, part4HttpOnly = sidPart4,
            maybeActiveOnly = true)
      assert(sessions.forall(_.wasValidJustRecently))  // could remove the filter() below
      val terminatedSessions =
            sessions.filter(_.wasValidJustRecently)
                .map(_.copy(deletedAt = Some(tx.now)))
      terminatedSessions foreach tx.upsertSession

       // + uncache
    }
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

        // + uncache
      }
    }

    terminatedSessions
  }

}

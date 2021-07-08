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
import debiki.dao.{MemCacheKey, SiteDao}
import org.scalactic.{Good, Bad, Or}



trait SessionSiteDaoMixin {
  self: SiteDao =>


  def listPatsSessions(patId: PatId): ImmSeq[TySessionInDbMaybeBad] = {
    val sessionsMaybeBad = readTx(_.loadActiveSessions(patId))
    // Also incl recently ended sessions!
    //val recentlyActiveSessions = readTx(_.loadActiveSessions(patId))

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


  def getSessionByPart1ForJson(part1Maybe2Or3: St): Opt[TySessionInDbMaybeBad] = {
    readTx(_.loadSession(part1Maybe2Or3 = Some(part1Maybe2Or3)))
  }


  def getSessionByPart4HttpOnly(part4: St): Opt[TySessionInDbMaybeBad] = {
    readTx(_.loadSession(part4HttpOnly = Some(part4)))
  }


  def insertValidSession(session: TySession): U = {
    writeTx { (tx, _) =>
     tx.insertValidSession(session)
    }
  }


  def updateSession(session: TySessionInDbMaybeBad): U = {
    writeTx { (tx, _) =>
     tx.upsertSession(session)
    }
  }


  def terminateSessionForCurReq(req: play.api.mvc.RequestHeader): U = {
    REFACTOR // Move these cookie names — and their whole file — to this pkg.
    // Thereafter, can remove this imoprt.
    import ed.server.security.EdSecurity._

    val sidPart1FromHeader: Opt[St] = req.headers.get(SessionIdHeaderName)
    val sidPart1FromCookie: Opt[St] =
          urlDecodeCookie(SessionIdPart123CookieName, req)

    val sidPart4FromCookie: Opt[St] =
          urlDecodeCookie(SessionIdPart4HttpOnlyCookieName, req)

    // Maybe some day some bug can cause the browser to send two different
    // session part 1 values. Then we'd better delete both sessions.
    sidPart1FromHeader foreach { sid1Header =>
      val twoDifferentPart1 = sidPart1FromCookie isSomethingButNot sid1Header
      warnDbgDieIf(debiki.Globals.isDevOrTest && twoDifferentPart1, "TyE70MWEPG246")
      terminateAnySession(Some(sid1Header), None)
    }

    terminateAnySession(sidPart1FromCookie, sidPart4FromCookie)
  }


  def terminateAnySession(sidPart1Maybe2Or3: Opt[St], sidPart4: Opt[St]): U = {
    writeTx { (tx, _) =>
      val sessions = tx.loadOneOrTwoSessions(sidPart1Maybe2Or3, part4HttpOnly = sidPart4)
      val terminatedSessions =
            sessions.filter(_.wasValidJustRecently)
            .map(_.copy(deletedAt = Some(tx.now)))
       terminatedSessions foreach tx.upsertSession

       // + uncache
    }
  }


  /// Returns any terminated sessions; isDeleted will be Some(current-time).
  /// This might include sessions that expired just moments ago; they'll
  /// be both expiredAt = Some(..) and deletedAt = Some(..).
  ///
  def terminateSessions(forPatId: PatId, thoseStartedAt: Seq[When] = Nil,
          allExceptFor: Opt[When] = None, all: Bo = false): ImmSeq[TySessionInDbMaybeBad] = {

    dieIf(all && thoseStartedAt.nonEmpty, "TyE60MWEPJ22")
    dieIf(all && allExceptFor.isDefined, "TyE60MWEPJ23")
    dieIf(thoseStartedAt.nonEmpty && allExceptFor.isDefined, "TyE60MWEPJ24")

    val sessionsMaybeBad = readTx(_.loadActiveSessions(forPatId))
    val sessionsToEnd = sessionsMaybeBad filter { sess =>
      sess.wasValidJustRecently && all || {
        thoseStartedAt.contains(sess.createdAt) ||
              allExceptFor.isSomethingButNot(sess.createdAt)
      }
    }

    val now = this.now()
    val terminatedSessions = sessionsToEnd.map(_.copy(deletedAt = Some(now)))

    if (terminatedSessions.nonEmpty) {
      writeTx { (tx, _) =>
        for (s <- terminatedSessions) {
          tx.upsertSession(s)
        }
      }
    }

    terminatedSessions
  }

}

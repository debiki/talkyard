package talkyard.server

import com.debiki.core.SiteTx

package object dao {

  case class TxCtx(tx: SiteTx, staleStuff: StaleStuff)
  // + maxLimits, rateLimits?

}

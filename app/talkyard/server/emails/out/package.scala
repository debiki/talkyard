package talkyard.server.emails

import com.debiki.core._


package object out {

  // A bit more than a month.
  // Unsubscribe links had better work, also if someone was away on vacation
  // for a month, and, when back, wants to unsubscribe. So, 5 weeks?
  val MaxUnsubEmailAgeDays: i32 = 5 * 7

}

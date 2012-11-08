/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package com.debiki.v0

import collection.{mutable => mut}


/** Calculates the trustworthiness of each Rating on a Page.
 *
 *  For example, if a certain IP number has rated a post 10 times,
 *  then each rating has a trustiness of 0.1 only.
 *  Right now, however, if you authenticate yourself, your ratings always
 *  have a trustiness of 1.0.
 *
 *  In the future: Will take as input IpTrust, UserTrust,
 *  etcetera. Some kind of reputation system.
 */
case class PageTrust(page: Debate) {

  /** Analyzes number of ratings per IP and user, and returns a value
   *  between 0 and 1, where 1 means the rating is completely trustworthy.
   *
   *  Details on the current implementation:
   *  If you are logged in, your most recent rating of each post is
   *  trusty, all others are obsoleted by the most recent one, and "untrusty".
   *
   *  If you are not logged in, your most recent rating is divided by the
   *  number of other ratings from the same IP. So people cannot simply
   *  specify another name and rate again and again...
   *  ... now at least they'd need to create a new OpenID account. This'll do
   *  for now.
   */
  def trustinessOf(rating: Rating): Float = {
    val otherRatsSameActn: RatingsOnAction =
      page.ratingsByActionId(rating.postId) getOrElse {
        // Since `rating' exists, there should also be a RatingsOnAction.
        assert(false); return 0f
      }

    val curVersion = otherRatsSameActn.curVersionOf(rating)
    // Ignore old overwritten ratings.
    if (rating.id != curVersion.id) {
      return 0f
    }
    // `rating' is the most recent version.
    assert(curVersion == rating)

    // If you have authenticated yourelf, you are trusted. (As of right now.)
    if (page.smart(rating).user_!.isAuthenticated)
      return 1f

    // Otherwise, your rating's trust is divided by the total number of ratings
    // from the same ip.
    val ip = page.smart(rating).ip_!
    val otherRatsSameIp = otherRatsSameActn.allRecentByNonAuIp(ip)
    val ipCount = otherRatsSameIp.size
    if (ipCount == 0) { assert(false); return 0f }
    1f / ipCount
  }

}

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list



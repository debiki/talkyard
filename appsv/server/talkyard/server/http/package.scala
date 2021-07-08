package talkyard.server

import com.debiki.core._
import play.api.http.{HeaderNames => play_HeaderNames}

package object http {

  val UserAgentHeaderNormalLength = 100

  object HeaderNamesLowercase {
    val UserAgent = play_HeaderNames.USER_AGENT.toLowerCase

    val AcceptCH = "accept-ch"

    // ----- User Agent

    val userAgentHeaders = Seq(
          "User-Agent",
          "Sec-CH-UA-Mobile", // e.g. "?0"
          "Sec-CH-UA-Platform", // e.g. "Linux"
          "Sec-CH-UA") // e.g. "Google Chrome";v="95", "Chromium";v="95", ";Not A Brand";v="99"

    // Sec-CH-UA, e.g. "Google Chrome";v="95", "Chromium";v="95", ";Not A Brand";v="99"
    val ClientHintUserAgent = "sec-ch-ua"

    // Sec-CH-UA-Mobile: "?0" or "?1"
    val ClientHintUaMobile = "sec-ch-ua-mobile"

    // Sec-CH-UA-Platform: e.g. "Linux"
    val ClientHintUaPlatform = "sec-ch-ua-platform"

    val ClientHintHeaders: Vec[St] = Vec(
          ClientHintUserAgent,
          ClientHintUaMobile,
          ClientHintUaPlatform)

    val ClientHintHeadersAndUserAgent: Vec[St] =
          ClientHintHeaders :+ play_HeaderNames.USER_AGENT.toLowerCase

    // ----- Network related

    val SaveData = "save-data"

    // Effective connection type: slow-2g, 2g, 3g, 4g.
    val Ect = "ect"

    // Approximate round trip time in millis, including application server processing time.
    val Rtt = "rtt"

    // Approximate bandwidth of the client's connection to the server, in Mbps.
    val Downlink = "downlink"
  }
}

package talkyard.server

import com.debiki.core._


package object rendr {

  case class RenderParams(
    embeddedOriginOrEmpty: St,
    allowClassIdDataAttrs: Bo,
    followLinks: Bo,
    )

  case class NashornParams(
    siteIdHostnames: SiteIdHostnames,
    embeddedOriginOrEmpty: St,
    allowClassIdDataAttrs: Bo,
    followLinks: Bo,
    mayMention: Set[Username] => Map[Username, Bo],
    //mayMentionAll/Channel/...: Bo?
    ) {

  }

}

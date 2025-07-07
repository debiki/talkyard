package talkyard.server

import com.debiki.core._


package object rendr {

  case class RenderParams(
    embeddedOriginOrEmpty: St,
    allowClassIdDataAttrs: Bo,
    relFollowTo: Seq[St],
    )

  case class NashornParams(
    siteIdHostnames: SiteIdHostnames,
    embeddedOriginOrEmpty: St,
    allowClassIdDataAttrs: Bo,

    // Not included in the page json. Probably better if SEO hackers can't see a list of
    // all rel-follow domains.
    relFollowTo: Seq[St],

    // This isn't included in the page json. Can't list all users — could be many, and some might
    // be private users.
    mayMention: Set[Username] => Map[Username, Bo],
    //mayMentionAll/Channel/...: Bo?
    ) {

  }

}

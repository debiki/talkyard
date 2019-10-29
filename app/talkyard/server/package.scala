package talkyard

import com.debiki.core._

package object server {

  sealed abstract class DeleteWhatSite
  object DeleteWhatSite {
    case object NoSite extends DeleteWhatSite
    case object SameHostname extends DeleteWhatSite
    case class WithId(siteId: SiteId) extends DeleteWhatSite
    case class SameHostnameAndWithId(siteId: SiteId) extends DeleteWhatSite
  }

}

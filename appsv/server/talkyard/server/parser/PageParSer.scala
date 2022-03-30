package talkyard.server.parser

import com.debiki.core._
import talkyard.server.JsX

import play.api.libs.json._



object PageParSer {


  def pageTypeSt_apiV0(pageType: PageType): St = pageType match {
    case PageType.Idea => "Idea"
    case PageType.Question => "Question"
    case PageType.Problem => "Problem"
    case PageType.Discussion => "Discussion"
    case PageType.EmbeddedComments => "EmbeddedComments"
    case _ => "Other"
  }


  def pageDoingStatusSt_apiV0(doingStatus: PageDoingStatus): Opt[St] = Some(doingStatus match {
    case PageDoingStatus.Planned => "Planned"
    case PageDoingStatus.Started => "Started"
    case PageDoingStatus.Done => "Done"
    case _ => return None
  })


  def pageClosedStatusSt_apiV0(page: PageMeta): Opt[St] = Some {
    if (page.frozenAt.isDefined) "Frozen"
    else if (page.lockedAt.isDefined) "Locked"
    else if (page.closedAt.isDefined) "Closed"
    else return None
  }


  def pageDeletedStatusSt_apiV0(page: PageMeta): Opt[St] = Some {
    // if (page.hardDeleted) "HardDeleted"
    if (page.isDeleted) "Deleted"
    else return None
  }

}

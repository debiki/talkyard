package talkyard.server.api

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.dao.SiteDao
import debiki.EdHttp._
import collection.{mutable => mut}

case class ActionDoer(dao: SiteDao, reqerId: ReqrId) { // later, tags branch:  complain: DieOrComplain) {

  import dao.context.security.throwIndistinguishableNotFound

  private val pageIdsByRef = mut.Map[PageRef, Opt[PageMeta]]()

  private def getThePageByRef(ref: PageRef): PageMeta = {
    getAnyPageByRef(ref) getOrElse {
      if (reqerId.id == SysbotUserId) throwNotFound("TyE502MRGP4", s"No such page: $ref")
      else throwIndistinguishableNotFound("TyE7M4USI50")  // [non_adm_api_usr]
    }
  }

  private def getAnyPageByRef(ref: PageRef): Opt[PageMeta] = {
    pageIdsByRef.getOrElseUpdate(
          ref, dao.getPageMetaByParsedRef(ref.asParsedRef))
  }


  def doAction(action: ApiAction): AnyProblem = {
    action.doHow match {
      case params: SetVoteParams =>
        // Currently only for Like voting or un-voting.
        dieIf(action.doWhat != ActionType.SetVote, "TyEBADACTYP1")
        throwUnimplIf(params.whatVote != PostVoteType.Like,
              "TyE062MSE: Can only Like vote via the API, currently.")

        val page = getThePageByRef(params.whatPage)
        if (params.howMany == 1) {
          dao.addVoteIfAuZ(
                pageId = page.pageId,
                postNr = params.whatPostNr,
                voteType = params.whatVote,
                voterId = action.asWho.id,
                // The backend server IP is not interesting, right.
                voterIp = None,
                postNrsRead = Set(params.whatPostNr))
        }
        else if (params.howMany == 0) {
          dao.deleteVoteIfAuZ(
                pageId = page.pageId,
                postNr = params.whatPostNr,
                voteType = params.whatVote,
                voterId = action.asWho.id)
        }
        else {
          die("TyE4MWEGJ6702")
        }

      case params: SetNotfLevelParams =>
        // Currently only for setting the notf level to NewPosts for a specific page.
        dieIf(action.doWhat != ActionType.SetNotfLevel, "TyEBADACTYP2")
        val pageMeta = getThePageByRef(params.whatPage)
        val newNotfPref = PageNotfPref(
              peopleId = action.asWho.id,
              notfLevel = params.whatLevel,
              pageId = Some(pageMeta.pageId))
        dao.savePageNotfPrefIfAuZ(newNotfPref, reqerId)
    }
    Fine
  }

}

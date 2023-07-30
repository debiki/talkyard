package talkyard.server.api

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.dao.{SiteDao, CreatePageResult, InsertPostResult}
import debiki.EdHttp._
import debiki.{TextAndHtml, TitleSourceAndHtml}
import collection.{mutable => mut}
import play.api.libs.json._
import org.scalactic.{Good, Or, Bad}
import talkyard.server.authz.Authz


case class ActionDoer(dao: SiteDao, reqrInf: ReqrInf, mab: MessAborter) {

  import dao.context.security.{throwNoUnless, throwIndistinguishableNotFound}

  private val _pageIdsByRef = mut.Map[PageRef, Opt[PageMeta]]()

  private def _getThePageByRef(ref: PageRef): PageMeta = {
    _getAnyPageByRef(ref) getOrElse {
      _throwNotFound("TyE502MRGP4", s"No such page: $ref")
    }
  }

  private def _getAnyPageByRef(ref: PageRef): Opt[PageMeta] = {
    _pageIdsByRef.getOrElseUpdate(
          ref, dao.getPageMetaByParsedRef(ref.asParsedRef))
  }

  private def _getThePagePath(pageId: PageId): PagePathWithId = {
    dao.getPagePath2(pageId) getOrElse {
      _throwNotFound("TyE0PAGEPATH03", s"No path to page $pageId")
    }
  }

  private def _getCatByRef(ref: ParsedRef): Cat = {
    dao.getCategoryByParsedRef(ref) getOrElse {
      _throwNotFound("TyECATREF0404", s"No such category: $ref")
    }
  }

  private lazy val _site: Site = dao.theSite()

  def doAction(action: ApiAction): JsObject Or ErrMsg = Good {
    val doAsInf: ReqrInf = ReqrInf(action.asWho, reqrInf.browserIdData)
    action.doHow match {
      case params: UpsertTypeParams =>
        dieIf(action.doWhat != ActionType.UpsertType, "TyEDOA_BADACTYP_UPSTYP")
        val theType = params.toType(createdById = action.asWho.id)(mab)
        dao.upsertTypeIfAuZ(theType, doAsInf)(mab)
        JsEmptyObj2

      case params: CreatePageParams =>
        dieIf(action.doWhat != ActionType.CreatePage, "TyEDOA_BADACTYP_CRPG")

        // Similar to PageController.createPage. [create_page]
        val titleSourceAndHtml = TitleSourceAndHtml(params.title)
        val bodyTextAndHtml = _commmarkToHtml(params, params.pageType)
        val cat = _getCatByRef(params.inCategory)
        val tags: ImmSeq[TagTypeValue] = _resolveTagTypes(params.withTags, IfBadAbortReq)

        val userAndLevels = dao.readTx(dao.loadUserAndLevels(doAsInf.toWho, _))
        val categoriesRootLast = dao.getAncestorCategoriesRootLast(Some(cat.id))

        // [dupl_api_perm_check]  Maybe better to move this authz check to
        // dao.createPage2(), and rename it to  createPageIfAuZ?
        SECURITY; SLEEPING // ! Check if reqrInf can see the page. [check_see_page]  [api_do_as]
        // Change  createPage2()  to   createPageIfAuZ?
        throwNoUnless(Authz.mayCreatePage(
              userAndLevels, dao.getOnesGroupIds(userAndLevels.user),
              params.pageType, PostType.Normal, pinWhere = None,
              anySlug = params.urlSlug, anyFolder = None,
              inCategoriesRootLast = categoriesRootLast,
              tooManyPermissions = dao.getPermsOnPages(categories = categoriesRootLast)),
              "TyEDOA_CREATEPAGE_PERMS")

        val result: CreatePageResult =
              dao.createPage2(
                  params.pageType, PageStatus.Published, anyCategoryId = Some(cat.id), tags,
                  anyFolder = None, anySlug = params.urlSlug, titleSourceAndHtml,
                  bodyTextAndHtml, showId = true, deleteDraftNr = None, doAsInf.toWho,
                  spamRelReqStuff = SystemSpamStuff, doAsAnon = None, extId = params.refId)
        Json.obj(
            "pageId" -> result.path.pageId,
            "pagePath" -> result.path.value)

      case params: CreateCommentParams =>
        dieIf(action.doWhat != ActionType.CreateComment, "TyEDOA_BADACTYP_CRCOMT")
        val pageMeta = _getThePageByRef(params.whatPage)
        val pagePath = _getThePagePath(pageMeta.pageId)
        val textAndHtml = _commmarkToHtml(params, pageMeta.pageType)
        val tags: ImmSeq[TagTypeValue] = _resolveTagTypes(params.withTags, IfBadAbortReq)

        // See docs in docs/ty-security.adoc [api_do_as].
        // Maybe better to move this authz check to dao.insertReply(), and rename it
        // to  insertReplyIfAuZ? [dupl_api_perm_check]
        // throwNoUnless(Authz.mayPostReply(... asWhoInf ...))     // check both byWho
        // throwNoUnless(Authz.mayPostReply(... reqrInf ...))   // and reqer
        SECURITY; SLEEPING // [check_see_page]
        val result: InsertPostResult =
              dao.insertReply(
                  textAndHtml, pageId = pageMeta.pageId, replyToPostNrs = params.parentNr.toSet,
                  params.postType, deleteDraftNr = None, doAsInf.toWho,
                  spamRelReqStuff = SystemSpamStuff, anonHow = None, refId = params.refId,
                  tags)  // ooops forgot_to_use
        Json.obj(
            "postNr" -> result.post.nr,
            "postPath" -> s"${pagePath.value}${PostHashPrefixWithHash}${result.post.nr}",
            "pageId" -> pagePath.pageId,
            "pagePath" -> pagePath.value)

      case params: SetVoteParams =>
        // Currently only for Like voting or un-voting.
        dieIf(action.doWhat != ActionType.SetVote, "TyEDOA_BADACTYP_VOPA")
        throwUnimplIf(params.whatVote != PostVoteType.Like,
              "TyE062MSE: Can only Like vote via the API, currently.")

        //  Check if reqrInf may see the page,  maybe  ActionDoer should get an AuthnCtx?
        // addVoteIfAuZ checks only if action.asWho can see the page:
        //       throwIfMayNotSeePage(page, Some(voter))(tx)
        SECURITY; SLEEPING // [check_see_page]

        val page = _getThePageByRef(params.whatPage)
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
        JsEmptyObj2

      case params: SetNotfLevelParams =>
        // Currently only for setting the notf level to NewPosts for a specific page.
        dieIf(action.doWhat != ActionType.SetNotfLevel, "TyEDOA_BADACTYP_NOTFLV")
        val pageMeta = _getThePageByRef(params.whatPage)
        val newNotfPref = PageNotfPref(
              peopleId = action.asWho.id,
              notfLevel = params.whatLevel,
              pageId = Some(pageMeta.pageId))
        SECURITY; SLEEPING // [check_see_page]
        dao.savePageNotfPrefIfAuZ(newNotfPref, reqrInf)
        JsEmptyObj2
    }
  }


  private def _commmarkToHtml(params: WithBodySourceParams, pageType: PageType): TextAndHtml = {
    val renderSettings = dao.makePostRenderSettings(pageType)
    dao.textAndHtmlMakerNoTx(_site).forBodyOrComment(
          params.bodySource, embeddedOriginOrEmpty = renderSettings.embeddedOriginOrEmpty,
          allowClassIdDataAttrs = true, followLinks = pageType.shallFollowLinks)
  }

  private def _throwNotFound(code: St, msg: St): Nothing = {
    if (reqrInf.isAdmin) throwNotFound(code, msg)
    else throwIndistinguishableNotFound(code)  // [non_adm_api_usr]
  }

  private def _resolveTagTypes(tagParams: ImmSeq[CreateTagParams], mab: MessAborter)
          : ImmSeq[TagTypeValue] = {
    val types = dao.resolveTypeRefs(tagParams.map(_.tagType))
    var nr = 0
    tagParams.zip(types) map { case (params, anyType) =>
      nr += 1
      val theType = anyType getOrElse {
        mab.abort(s"Tag nr $nr: No such tag type: ${params.tagType}")
      }
      params.withTypeIdKnown(theType.id, mab)
    }
  }
}

package talkyard.server.api

import com.debiki.core
import com.debiki.core._
import com.debiki.core.Prelude._
import com.debiki.core.PageParts.MaxTitleLength
import debiki.dao.SiteDao
import talkyard.server.JsX
import play.api.libs.json.{JsObject, JsValue, JsArray, Json}
import org.scalactic.{Bad, Good, Or}
import debiki.JsonUtils._
import scala.util.Try

case class ActionParser(dao: SiteDao, mayDoOnlyAs: Opt[Pat], mab: MessAborter) {


  def parseAction(doWhatSt: St, actionJsOb: JsObject): ApiAction Or ErrMsg = {
    tryParse {
      // (parseActionImpl() might throw BadJsonException, instead of returning Bad.)
      parseActionImpl(doWhatSt, actionJsOb) getOrIfBad { errMsg =>
        return Bad(errMsg)
      }
    }
  }


  private def parseActionImpl(doWhatSt: St, actionJsOb: JsObject): ApiAction Or ErrMsg = {
    val actionType = ActionType.fromSt(doWhatSt) getOrElse {
      return Bad(s"Unknown API action type: $doWhatSt")
    }

    // Could cache asWhoSt –> pat?  would be the same, for all actions?
    // (Unless is a 'username:__' ref, and changes one's username in the middle
    // of a series of actions.)
    val asWhoSt = parseSt(actionJsOb, "asWho")
    val anyPat: Opt[Pat] = dao.getParticipantByRef(asWhoSt) getOrIfBad { problem =>
      return Bad(s"Bad asWho: $problem")
    }

    // Maybe `asWho` shouldn't be allowed at all, unless one is admin? So API invokers
    // cannot guess usernames & find out if such users exist?  [private_pats]
    // (Currently not an issue — private pats not yet impl.)
    val pat = anyPat getOrElse {
      return Bad(s"No such participant: $asWhoSt")
    }

    mayDoOnlyAs foreach { onlyAs: Pat =>  // [api_do_as]
      // Avoid including in the err msg: "${pat.nameParaId}" — maybe `pat`s name
      // isn't public. [private_pats]
      if (pat.id != onlyAs.id)
        return Bad(o"""You're calling the API as ${onlyAs.nameParaId},
              but you've set 'asWho' to a different user, that's not allowed
              (unless you call the API as sysbot).""")  // or as admin too?
    }

    if (pat.isSystemUser)
      return Bad(o"""You cannot use the System user when doing things via Talkyard's API
              — but you can use Sysbot, or an ordinary user [TyEAPIUSRSYS]""")

    // For now
    if (pat.isBuiltIn && !pat.isSysbot)
      return Bad(o"""Currently, built-in users other than Sysbot cannot do things via
            the API. Set asWho to a human's user account instead [TyEAPIUSRBLTIN]""")

    if (pat.isAnon)
      return Bad(o"""Anonyms don't call the API — instead, the real user does,
            and specifies that the actions should be done anonymously. [TyEAPIUSRANON]""")

    // Guests may not do lots of things.
    if (pat.isGuest) {
      actionType match {
        // Later, but first verify it's a Like vote:
        // case ActionType.SetVote =>
        //   // Fine, guests may Like vote.
        case _ =>
          return Bad(s"Participant $asWhoSt is a guest and therefore may not: ${
                doWhatSt} [TyEAPIUSRGGST]")
      }
    }

    // Groups also may not do lots of things. For now:
    if (pat.isGroup)
      return Bad(o"""Currently groups cannot do things via the API [TyEAPIUSRGROUP]""")

    dieUnless(pat.isUserNotGuest, "TyE502MSE6")

    val howJsOb: JsObject = parseJsObject(actionJsOb, "doHow")

    def anyRefId: Opt[RefId] = debiki.JsonUtils.parseOptSt(howJsOb, "refId")
    def pageRef: PageRef = debiki.JsonUtils.parsePageRef(howJsOb, "whatPage")
    def postRef: Opt[PostRef] = debiki.JsonUtils.parseOptPostRef(howJsOb, "whatPost")

    val params = actionType match {

      case ActionType.UpsertType =>
        JsX.parseUpsertTypeParams(howJsOb)(mab)

      case ActionType.CreatePage =>
        // Also see SitePatchParser.readSimplePagePatchOrBad().
        val anyPageType = parseOptSt(howJsOb, "pageType") map { st =>
          PageType.fromStr_apiV0(st) getOrElse {
            return Bad(s"Unsupported page type: '$st' [TyEPAGEJSN26]")
          }
        }
        val title = parseSt(howJsOb, "title").take(MaxTitleLength)
        val (bodySource, bodyFormat) = _parseBodySrcFmtOrThrow(howJsOb)
        val catRefSt = parseSt(howJsOb, "inCategory")
        val catRef: ParsedRef = core.parseRef(catRefSt, allowPatRef = false, allowTyId = false)
              .getOrIfBad(msg => return Bad(
                    s"Field 'inCategory': Bat category reference: $msg  [TyECATREF0295]"))
        val withTags = _parseTagParams(howJsOb, whatPage = None) getOrIfBad  { msg =>
          return Bad(s"Invalid tag: $msg  [TyENEWPAGETAG02]")
        }
        CreatePageParams(
              refId = anyRefId,
              pageType = anyPageType.getOrElse(PageType.Discussion),
              title = title,
              bodySource = bodySource,
              bodyFormat,
              inCategory = catRef,
              withTags)

      case ActionType.CreateComment =>
        // Also see SitePatchParser.readSimplePostPatchOrBad().
        val (bodySource, bodyFormat) = _parseBodySrcFmtOrThrow(howJsOb)
        val parentNr = parseOptInt32(howJsOb, "parentNr")
        val withTags = _parseTagParams(howJsOb, whatPage = None) getOrIfBad  { msg =>
          return Bad(s"Invalid tag: $msg  [TyENEWCOMTTAG02]")
        }
        CreateCommentParams(
              refId = anyRefId,
              postType = PostType.Normal,
              whatPage = pageRef,
              parentNr = parentNr,
              bodySource = bodySource,
              bodyFormat,
              withTags)

      case ActionType.SetVote =>
        val whatVote = parsePostVoteType(howJsOb, "voteType", altName = "whatVote")
        val howMany = parseInt32(howJsOb, "howMany", min = Some(0), max = Some(1))
        def postNr: PostNr = parseOptInt32(howJsOb, "postNr") getOrElse BodyNr
        SetVoteParams(whatVote, howMany = howMany,
              // Either a post ref,  or a  page ref + post nr:
              whatPost = postRef.map(Left.apply).getOrElse(Right(pageRef -> postNr)))(mab)

      case ActionType.SetNotfLevel =>
        val notfLevel = parseNotfLevel(howJsOb, "whatLevel")
        SetNotfLevelParams(whatLevel = notfLevel, whatPage = pageRef)
    }

    Good(ApiAction(
          asWho = pat,
          doWhat = actionType,
          doWhy = parseOptSt(actionJsOb, "doWhy").trimNoneIfBlank,
          doHow = params))
  }


  private def _parseBodySrcFmtOrThrow(jOb: JsObject): (St, MarkupLang) = {
    val bodySource = parseSt(jOb, "bodySrc")
    val formatName = parseSt(jOb, "bodyFmt")
    val format = MarkupLang.fromString_apiV0(formatName) getOrElse {
      throwBadJson("TyEUNKMARKLANG", s"bodyFmt: Unknown markup language: $formatName")
    }
    // Don't think HTML post source is currently supported? Would need an ok safe
    // way to [convert_html_to_commonmark] so can continue editing without surprises?
    // Here's one:  https://github.com/ProseMirror/prosemirror-markdown#MarkdownSerializer
    throwBadJsonIf(format == MarkupLang.Html,
          "TyEUSECOMMARK", "bodyFmt: Use 'CommonMark' instead of 'HTML', for now")

    (bodySource, format)
  }


  private def _parseTagParams(jOb: JsObject, whatPage: Opt[PageRef])
          : ImmSeq[CreateTagParams] Or ErrMsg = Good {
    val tagsArr = parseOptJsArray(jOb, "withTags") getOrElse { return Good(Nil) }
    var nr = 0
    tagsArr.map(jsVal => {
      nr += 1
      val jOb = asJsObject(jsVal, s"Tags array item nr $nr")
      Try(JsX.parseTagParam(jOb, whatPage)) getOrIfFailure { ex =>
        return Bad(s"Tag nr $nr: ${ex.getMessage}")
      }
    }).to(Vec)
  }

}

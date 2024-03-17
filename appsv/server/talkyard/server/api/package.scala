package talkyard.server

import com.debiki.core._
import com.debiki.core.Prelude._
import com.debiki.core.Prelude.RichOption // isSomethingButNot
import com.debiki.core.Prelude.MessAborter
import org.scalactic.{Good, Or, Bad}


package object api {


  sealed abstract class ApiTask

  // Later:
  // trait ApiQuery
  // case class ApiGetQuery
  // case class ApiListQuery
  // case class ApiSearchQuery

  case class ApiAction(
    asWho: Pat,
    doWhat: ActionType,
    doWhy: Opt[St],
    doHow: ActionParams,
    // later:
    // doWhen: ..
    // doIf: ..
  ) extends ApiTask



  sealed abstract class ActionType

  object ActionType {
    case object UpsertType extends ActionType
    case object CreatePage extends ActionType
    case object CreateComment extends ActionType
    case object SetVote extends ActionType
    case object SetNotfLevel extends ActionType

    def fromSt(st: St): Opt[ActionType] = Some(st match {
      case "UpsertType" => UpsertType
      case "CreatePage" => CreatePage
      case "CreateComment" => CreateComment
      case "SetVote" => SetVote
      case "SetNotfLevel" => SetNotfLevel
      case _ => return None
    })
  }



  sealed abstract class ActionParams

  case object NoActionParams extends ActionParams


  case class UpsertTypeParams(
        anyId: Opt[TagTypeId],
        refId: Opt[RefId],
        canTagWhat: i32,
        urlSlug: Opt[St],
        dispName: St,
        wantsValue: Opt[NeverAlways],
        valueType: Opt[TypeValueType],
        ) extends ActionParams
  {

    def toType(createdById: PatId)(mab: MessAborter): TagType = {
      TagType(
            id = anyId getOrElse NoTagTypeId,
            refId = refId,
            canTagWhat = canTagWhat,
            urlSlug = urlSlug,
            dispName = dispName,
            createdById = createdById,
            wantsValue = wantsValue,
            valueType = valueType)(mab)
    }
  }

  trait WithBodySourceParams {
    def bodySource: St
    def bodyFormat: MarkupLang
  }

  // Also see SitePatchParser.readSimplePagePatchOrBad, and  [ref_and_id_params].
  case class CreatePageParams(
        refId: Opt[RefId],
        pageType: PageType,
        title: St,
        bodySource: St,
        bodyFormat: MarkupLang,
        inCategory: ParsedRef, // CatRef,
        withTags: ImmSeq[CreateTagParams],
        ) extends ActionParams with WithBodySourceParams
  {
    def urlSlug: Opt[St] = None // for now
  }


  case class CreateCommentParams(
        refId: Opt[RefId],
        postType: PostType.Normal.type, // for now
        whatPage: PageRef,
        parentNr: Opt[PostNr],
        bodySource: St,
        bodyFormat: MarkupLang,
        withTags: ImmSeq[CreateTagParams],
        ) extends ActionParams with WithBodySourceParams
  {
  }


  case class SetVoteParams(
        whatVote: PostVoteType,
        howMany: i32,
        whatPost: Either[PostRef, (PageRef, PostNr)],
        )(mab: MessAborter) extends ActionParams
  {
    mab.check(howMany == 0 || howMany == 1, "TyE446MEP2")
  }


  case class SetNotfLevelParams(
        whatLevel: NotfLevel,
        whatPage: PageRef,
        ) extends ActionParams


  /**
    * @param parentTagId_unimpl — How reference a parent tag? By tag type?
    *   Works if there's just one tag of each tag type, but if can be many,
    *   then do tags need ref ids too?
    * @param whatPage – Not needed, if creating a page or post.
    * @param postNr – Same.
    */
  case class CreateTagParams(
        tagType: TypeRef,
        parentTagId_unimpl: None.type,
        whatPage: Opt[PageRef],
        onPostNr: Opt[PostNr],
        onPostRef: Opt[PostRef],
        valType: Opt[TypeValueType],
        valInt32: Opt[i32],
        valFlt64: Opt[f64],
        valStr: Opt[St],
        ) extends ActionParams
  {

    /** If tag created together with a post, then, the tag type internal id might
      * not yet be known (only its ref id),
      * and the tag id also wouldn't be known, yet  (tag not yet created).
      */
    def withTypeIdKnown(typeId: TagTypeId, mab: MessAborter): TagTypeValue =
      TagTypeValue(
            tagTypeId = typeId,
            // parentTagId_unimpl: Opt[TagId],
            valType = valType,
            valInt32 = valInt32,
            valFlt64 = valFlt64,
            valStr = valStr)(mab)

  }


  /** A few well-known feature flags. Don't rename, are part of the API. [price_flags]*/
  object FeatureFlags {

    /** This site is for a nonprofit (e.g. a tax-exempt charity). */
    val ff4Nnp = "ff4Nnp"

    /** This site is for a not-for-profit (e.g. a member organization). */
    val ff4Nfp = "ff4Nfp"

    /** This site is for education (e.g. a school). I suppose ff4Biz and ff4Edu can
      * co-exist, since there are for profit schools, e.g. coding bootcamps.
      */
    val ff4Edu = "ff4Edu"

    /** This site is for business. */
    val ff4Biz = "ff4Biz"

    /** This site provides embedded comments, usually for someone's blog. */
    val ff4EmCo = "ff4EmCo"

    /** This site provides embedded forums, usually for an organization's website. */
    // Maybe later
    // val ff4EmFo = "ff4EmFo"

    /** Price plan NN (names might change) maybe incl some bit flags with externally
      * defined meanings. */
    val ffPrPNNRegex: scala.util.matching.Regex = "ffPrP[0-9a-zA-Z_]{1,10}".r

    private val allowedNewSiteExactFlags = Vec(ff4Nnp, ff4Nfp, ff4Edu, ff4Biz, ff4EmCo)

    def removeBadNewSiteFlags(flagsStr: St): St = {
      // Tests: (manual)
      //   - create-site-password-run-admin-intro-tours.1br.d  TyT7BAWFPK9.TyTNEWSITEFFS
      val flagsMaybeBad = flagsStr.split(" ").to[Vec]
      val flagsOk = flagsMaybeBad.filter(flag =>
            allowedNewSiteExactFlags.contains(flag) || ffPrPNNRegex.matches(flag))
      flagsOk.mkString(" ")
    }
  }
}

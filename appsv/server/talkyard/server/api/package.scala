package talkyard.server

import com.debiki.core._
import com.debiki.core.Prelude.MessAborter


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

  // Also see SitePatchParser.readSimplePagePatchOrBad
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
        whatPage: PageRef,
        whatPostNr: PostNr,
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
        postNr: Opt[PostNr],
        valType: Opt[TypeValueType],
        valInt32: Opt[i32],
        valFlt64: Opt[f64],
        valStr: Opt[St],
        ) extends ActionParams
  {

    /** But tag id is not yet known  (tag not yet created).
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
}

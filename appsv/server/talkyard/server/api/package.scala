package talkyard.server

import com.debiki.core._


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
    case object SetVote extends ActionType
    case object SetNotfLevel extends ActionType

    def fromSt(st: St): Opt[ActionType] = Some(st match {
      case "SetVote" => SetVote
      case "SetNotfLevel" => SetNotfLevel
      case _ => return None
    })
  }



  sealed abstract class ActionParams

  case object NoActionParams extends ActionParams

  case class SetVoteParams(
        whatVote: PostVoteType,
        howMany: i32,
        whatPage: PageRef,
        whatPostNr: PostNr,
        ) extends ActionParams
  {
    require(howMany == 0 || howMany == 1, "TyE446MEP2")
  }

  case class SetNotfLevelParams(
        whatLevel: NotfLevel,
        whatPage: PageRef,
        ) extends ActionParams

}

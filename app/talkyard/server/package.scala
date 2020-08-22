package talkyard

import com.debiki.core._
import debiki.Globals

package object server {

  val ProdConfFilePath = "/opt/talkyard/conf/play-framework.conf"

  def isDevOrTest: Boolean = Globals.isDevOrTest

  // "tysvapp":  "ty" = Talkyard, "sv" = server, "app" = application.
  // (Later, more logging?:  tysvweb = web server logs,
  // tybrapp = browser app logs, tyanapp = android app, tyioapp = iOS app logs)
  //
  def TyLogger(name: String): play.api.Logger = play.api.Logger("tysvapp." + name)


  trait TyLogging {
    protected val logger: play.api.Logger = newLogger(getClass)

    protected def bugWarnIf(condition: Boolean, errorCode: String,
          problem: => String = ""): Boolean = {
      bugWarnDieIfThen(condition, errorCode, problem, thenDo = null)
    }

    protected def bugWarnDieIfThen(condition: Boolean, errorCode: String,
          problem: => String = "", thenDo: () => Unit): Boolean = {
      if (!condition)
        return false
      bugWarn(errorCode, problem)
      if (thenDo ne null) {
        thenDo()
      }
      true
    }

    protected def bugWarn(errorCode: String, problem: => String = "") {
      Prelude.dieIf(Globals.isDevOrTest, errorCode, problem)
      val message = Prelude.formatErrorMessage(errorCode, problem)
      logger.warn(s"BUG: $message")
    }


    implicit class GetOrBugWarn[V](val underlying: Option[V]) {
      def getOrBugWarn(errorCode: String, message: => String = "")(block: V => Unit): Unit =
        underlying match {
          case None =>
            bugWarn(errorCode, message)
          case Some(value: V) =>
            block(value)
        }
    }
  }


  def newLogger(clazz: Class[_]): play.api.Logger =
    TyLogger(clazz.getName.stripSuffix("$"))


  implicit class RichResult(val underlying: play.api.mvc.Result) {
    def statusCode: Int = underlying.header.status

    def bodyAsUtf8String: String = {
      import play.api.http.HttpEntity
      underlying.body match {
        case HttpEntity.Strict(byteString, _) =>
          byteString.utf8String
        case _: HttpEntity.Chunked =>
          "(chunked response)"
        case _: HttpEntity.Streamed =>
          "(streamed response)"
      }
    }
  }

}

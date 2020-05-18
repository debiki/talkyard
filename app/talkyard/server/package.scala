package talkyard

import com.debiki.core._

package object server {

  val ProdConfFilePath = "/opt/talkyard/conf/play-framework.conf"

  // "tysvapp":  "ty" = Talkyard, "sv" = server, "app" = application.
  // (Later, more logging?:  tysvweb = web server logs,
  // tybrapp = browser app logs, tyanapp = android app, tyioapp = iOS app logs)
  //
  def TyLogger(name: String): play.api.Logger = play.api.Logger("tysvapp." + name)

  trait TyLogging {
    protected val logger: play.api.Logger = newLogger(getClass)
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

package talkyard

import com.debiki.core._

package object server extends play.api.Logging {

  val ProdConfFilePath = "/opt/talkyard/conf/play-framework.conf"

  // "tysvapp":  "ty" = Talkyard, "sv" = server, "app" = application.
  // (Later, more logging?:  tysvweb = web server logs,
  // tybrapp = browser app logs, tyanapp = android app, tyioapp = iOS app logs)
  //
  def TyLogger(name: String): play.api.Logger = play.api.Logger("tysvapp." + name)

  trait TyLogging {
    protected val logger: play.api.Logger = TyLogger(getClass.getName.stripSuffix("$"))
  }

}

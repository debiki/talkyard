package ed.server

import play.api._

/** This is for backw compat, just in case any self hosted installation has:
  *
  *     play.application.loader = ed.server.EdAppLoader
  *
  * in their Play config file. — I don't think so, but it'd be sooo annoying for
  * them if their Ty server auto upgraded itself, and then didn't start. And for
  * the Ty devs who would need to figure out what was wrong.
  *
  * [ty_v1] Remove. Then people will do a new install, and test, before bringing
  * the new server live.
  */
class EdAppLoader extends ApplicationLoader {

  private val logger = talkyard.server.TyLogger("EdAppLoader")

  def load(context: ApplicationLoader.Context): Application = {
    val msg = "Starting via deprecated class ed.server.EdAppLoader," +
           "that's fine, but annoying. [TyM_OLD_HELLO]"
    logger.info(msg)  // logs nothing? Weird. But this works:
    System.out.println(msg)
    new talkyard.server.TyAppLoader(). load(context)
  }

}

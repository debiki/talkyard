package controllers

import com.debiki.v0
import com.debiki.v0.{PagePath, PageRoot}
import com.debiki.v0.Prelude._
import debiki._
import net.liftweb.common.{Box, Full, Empty, Failure}
import play.api._
import play.api.mvc._

object Application extends Controller {

  def editPost(pathIn: PagePath, pageRoot: PageRoot, postId: String) = Action {
    Ok("editPost("+ pathIn +", "+ pageRoot +", "+ postId +")")
  }

  def viewPost(pathIn: PagePath, postId: String) =
        RedirectBadPath(pathIn) { implicit request =>
    Ok("viewPost("+ pathIn +", "+ postId +")")
  }

  def feedNews(pathIn: PagePath) = Action {
    Ok("feedNews("+ pathIn +")")
  }

  def callApi(apiPath: String) = Action {
    Ok("callApi("+ apiPath +")")
  }

  def index = Action {
    Ok(views.html.index("index = Action"))
  }

  def RedirectBadPath(pathIn: PagePath)(f: Request[AnyContent] => Result)
        : Action[_] = Action { request =>
    DebikiDb.Dao.checkPagePath(pathIn) match {
      case Full(correct: PagePath) =>
        if (correct.path == pathIn.path) f(request)
        else Results.MovedPermanently(correct.path)
      case Empty => Results.NotFound("404 Page not found: "+ pathIn.path)
      case f: Failure => runErr("DwE03ki2", "Internal error"+ f.toString)
    }
  }

}

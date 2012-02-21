package controllers

import play.api._
import play.api.mvc._

object Application extends Controller {

  def editPost(pagePath: String) = Action {
    Ok("editPost("+ pagePath +")")
  }

  def viewPost(pagePath: String) = Action {
    Ok("viewPost("+ pagePath +")")
  }

  def callApi(apiPath: String) = Action {
    Ok("callApi("+ apiPath +")")
  }

  def index = Action {
    Ok(views.html.index("index = Action"))
  }

}

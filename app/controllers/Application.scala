/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package controllers

import com.debiki.v0._
import com.debiki.v0.Prelude._
import debiki._
import net.liftweb.common.{Box, Full, Empty, Failure}
import play.api._
import play.api.mvc.{Action => _, _}
import Actions._

object Application extends mvc.Controller {

  def viewPost(pathIn: PagePath, postId: String) = RedirBadPathAction(pathIn) {
        (pathOk, request) =>
    val requestInfo = RequestInfo(  // COULD rename to DebikiRequest?
      tenantId = pathIn.tenantId,
      ip = "?.?.?.?",
      loginId = None, // Option[String],
      identity = None, // Option[Identity],
      user = None, // Option[User],
      pagePath = pathOk,
      doo = null)
    val pageRoot = PageRoot.Real(postId)
    val pageHtml = Debiki.TemplateEngine.renderPage(requestInfo, pageRoot)
    Ok(pageHtml).as(HTML)
  }

  def rawBody(pathIn: PagePath) = RedirBadPathAction(pathIn) {
        (pathOk, request) =>
    Debiki.Dao.loadPage(pathOk.tenantId, pathOk.pageId.get) match {
      case Full(page) =>
        Ok(page.body_!.text) as (pathOk.suffix match {
          case "css" => CSS
          case _ => unimplemented
        })
      // The page might have been deleted, just after the access control step:
      case Empty => NotFound("Hmm")
      case f: Failure => unimplemented // COULD stop using boxes
    }
  }

  def feedNews(pathIn: PagePath) = mvc.Action {
    Ok("feedNews("+ pathIn +")")
  }

  def index = mvc.Action {
    Ok(views.html.index("index = Action"))
  }

}

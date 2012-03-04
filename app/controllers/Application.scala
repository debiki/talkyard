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


  def viewPost(pathIn: PagePath, postId: String) = PageGetAction(pathIn) {
        pageReq =>
    val pageHtml =
      Debiki.TemplateEngine.renderPage(pageReq, PageRoot.Real(postId))
    Ok(pageHtml).as(HTML)
  }


  def rawBody(pathIn: PagePath) = PageGetAction(pathIn) { pageReq =>
    val pageBody = pageReq.page_!.body_!
    val contentType = (pageReq.pagePath.suffix match {
      case "css" => CSS
      case _ => unimplemented
    })
    Ok(pageBody.text) as contentType
  }


  def feedNews(pathIn: PagePath) = mvc.Action {
    Ok("feedNews("+ pathIn +")")
  }

  def index = mvc.Action {
    Ok(views.html.index("index = Action"))
  }

  /**
   * Left to fix:
   * ?act=post-id --> formHtml.actLinks(post-id)
   */
}

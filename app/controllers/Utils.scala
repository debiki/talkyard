/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package controllers

import com.debiki.v0._
import debiki._
import debiki.DebikiHttp._
import java.{util => ju}
import net.liftweb.common.{Box, Full, Empty, Failure}
import play.api._
import play.api.data._
import play.api.data.Forms._
import play.api.mvc.{Action => _, _}
import Actions._
import Prelude._

object Utils extends Results with http.ContentTypes {


  def renderOrRedirect(pageReq: PageRequest[_], rootPost: PageRoot)
        : PlainResult = {
    if (isAjax(pageReq.request)) {
      val pageHtml = Debiki.TemplateEngine.renderPage(pageReq, rootPost)
      Ok(pageHtml) as HTML
    } else {
      val viewRoot =
        if (rootPost.isDefault) ""
        else "?view=" + rootPost.id
      Redirect(pageReq.pagePath.path + viewRoot)
    }
  }

}


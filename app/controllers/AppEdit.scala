/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package controllers

import com.debiki.v0._
import debiki._
import net.liftweb.common.{Box, Full, Empty, Failure}
import play.api._
import play.api.mvc.{Action => _, _}
import Actions._
import Prelude._

object AppEdit extends mvc.Controller {

  def editPost(pathIn: PagePath, pageRoot: PageRoot, postId: String)
        = PageReqAction(maxUrlEncFormBytes = 10 * 1000)(pathIn) {
      pageRequest =>

    /*
     if may-not-access-page Forbidden.
     if is-GET
       OK(get-or-create-post-to-edit, show-form)
     if is-POST
       OK(get-or-create-post-to-edit, save edit (and app))
    */

    Ok("editPost("+ pathIn +", "+ pageRoot +", "+ postId +")")
  }

}

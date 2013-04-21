/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package com.debiki.v0

import com.debiki.v0.{PostActionPayload => PAP}
import java.{util => ju}
import org.scalatest.{BeforeAndAfterAll, FreeSpec}
import org.scalatest.matchers.MustMatchers
import PostActionDto.copyCreatePost
import Prelude._


/** Tests deletion of comments and comment trees.
  *
  * Constructs these comments:
  *
  * gp -> p -> c
  * gp -> d
  * gp -> e
  *
  * Deletes the whole `p` tree, and the single comment `d`.
  */
class PagePartsDeletionTest extends FreeSpec with MustMatchers {

  private def time(when: Int) = new ju.Date(when)

  val gp = PostActionDto.forNewPost("gp", creationDati = time(100),
    loginId = SystemUser.Login.id, userId = SystemUser.User.id, newIp = None,
    parentPostId = "gp", text = "gp-text", markup = Markup.DefaultForComments.id,
    approval = Some(Approval.AuthoritativeUser))

  val p = copyCreatePost(gp, id = "p", parentPostId = "gp", text = "p-text")
  val c = copyCreatePost(gp, id = "c", parentPostId = "p", text = "c-text")

  val d = copyCreatePost(gp, id = "d", parentPostId = "gp", text = "d-text")
  val e = copyCreatePost(gp, id = "e", parentPostId = "gp", text = "e-text")

  val delete_p_tree = PostActionDto(
    "delete_p_tree", creationDati = time(101), postId = "p",
      loginId = SystemUser.Login.id, userId = SystemUser.User.id, newIp = None,
      payload = PAP.DeleteTree)

  val delete_d = delete_p_tree.copy(id = "delete_d", postId = "d", payload = PAP.DeletePost)

  val pageNoDeletes =
    PageParts("pnd", actionDtos = gp::p::c::d::e::Nil)

  val pageWithDeletes =
    PageParts("pwd", actionDtos = delete_p_tree::delete_d::pageNoDeletes.actionDtos)


  "PageParts' comments can be deleted:" - {

    "when nothing has been deleted, nothing is deleted" in {
      for (postId <- List(gp.id, p.id, c.id, d.id, e.id))
        pageNoDeletes.getPost_!(postId).isDeletedSomehow must be === false
    }

    "things that have not been deleted are not deleted" in {
      for (postId <- List(gp.id, c.id, e.id))
        pageWithDeletes.getPost_!(postId).isDeletedSomehow must be === false
    }

    "a tree can be deleted" in {
      val page = pageWithDeletes
      page.getPost_!(p.id).isDeletedSomehow must be === true
      page.getPost_!(p.id).isTreeDeleted must be === true
      page.getPost_!(p.id).isPostDeleted must be === false
    }

    "a single comment can be deleted" in {
      val page = pageWithDeletes
      page.getPost_!(d.id).isDeletedSomehow must be === true
      page.getPost_!(d.id).isTreeDeleted must be === false
      page.getPost_!(d.id).isPostDeleted must be === true
    }

  }

}


// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list

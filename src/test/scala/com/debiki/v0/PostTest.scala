/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package com.debiki.v0

import org.specs2.mutable._
import java.{util => ju}
import PostActionDto.copyCreatePost
import Prelude._


object PostTestValues extends PostTestValues


/**
 */
trait PostTestValues {

  val postSkeleton =
    PostActionDto(id = "?", postId = "?", creationDati = new ju.Date(1000),
      loginId = "101", userId = "?", newIp = None,
      payload = PostActionPayload.CreatePost(
        parentPostId = "?",
        text = "text-text-text",
        markup = "",
        approval = None))

  val rawBody = copyCreatePost(postSkeleton, id = PageParts.BodyId, parentPostId = PageParts.BodyId)
  val rawReply_a = copyCreatePost(postSkeleton, id = "a", parentPostId = rawBody.id)
  val rawReply_b = copyCreatePost(postSkeleton, id = "b", parentPostId = rawBody.id)

  val EmptyPage = PageParts("a")
  val PageWithBody = EmptyPage + rawBody
  val PageWithOneReply = PageWithBody + rawReply_a
  val PageWithTwoReplies = PageWithOneReply + rawReply_b

}



class PostTest extends Specification with PostTestValues {

  "A post can" can {

    "find its replies" >> {
      "when there are none" >> {
        PageWithBody.getPost_!(rawBody.id).replies must beEmpty
      }

      "when there is one" >> {
        PageWithOneReply.getPost_!(rawBody.id).replies must beLike {
          case List(reply) =>
            reply.id must_== rawReply_a.id
        }
      }
    }

    "find its siblings" >> {
      PageWithTwoReplies.getPost_!(rawReply_a.id).siblingsAndMe must beLike {
        case List(sibling1, sibling2) =>
          (sibling1.id == rawReply_a.id || sibling1.id == rawReply_b.id
             ) must beTrue
          (sibling2.id == rawReply_a.id || sibling2.id == rawReply_b.id
             ) must beTrue
      }
    }

    "know its depth" >> {
      "when there is no parent" >> {
        val post = PageWithOneReply.getPost_!(rawBody.id)
        post.depth must_== 0
      }

      "when there is one parent" >> {
        val post = PageWithOneReply.getPost_!(rawReply_a.id)
        post.depth must_== 1
      }
    }

  }

}



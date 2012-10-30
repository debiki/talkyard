// Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)

package com.debiki.v0

import org.specs2.mutable._
import Prelude._
import java.{util => ju}


/**
 */
trait PostTestValues {

  val postSkeleton =
    Post(id = "?", parent = "?", ctime = new ju.Date(1000),
        loginId = "101", newIp = None, text = "text-text-text",
        markup = "", approval = None, tyype = PostType.Text,
        where = None)

  val rawBody = postSkeleton.copy(id = "1", parent = "1")
  val rawReply_a = postSkeleton.copy(id = "a", parent = rawBody.id)
  val rawReply_b = postSkeleton.copy(id = "b", parent = rawBody.id)

  val EmptyPage = Debate("a")
  val PageWithBody = EmptyPage + rawBody
  val PageWithOneReply = PageWithBody + rawReply_a
  val PageWithTwoReplies = PageWithOneReply + rawReply_b

}



class PostTest extends Specification with PostTestValues {

  "A post can" can {

    "find its replies" >> {
      "when there are none" >> {
        PageWithBody.vipo_!(rawBody.id).replies must beEmpty
      }

      "when there is one" >> {
        PageWithOneReply.vipo_!(rawBody.id).replies must beLike {
          case List(reply) =>
            reply.id must_== rawReply_a.id
        }
      }
    }

    "find its siblings" >> {
      PageWithTwoReplies.vipo_!(rawReply_a.id).siblingsAndMe must beLike {
        case List(sibling1, sibling2) =>
          (sibling1.id == rawReply_a.id || sibling1.id == rawReply_b.id
             ) must beTrue
          (sibling2.id == rawReply_a.id || sibling2.id == rawReply_b.id
             ) must beTrue
      }
    }

    "know its depth" >> {
      "when there is no parent" >> {
        val post = PageWithOneReply.vipo_!(rawBody.id)
        post.depth must_== 0
      }

      "when there is one parent" >> {
        val post = PageWithOneReply.vipo_!(rawReply_a.id)
        post.depth must_== 1
      }
    }

  }

}



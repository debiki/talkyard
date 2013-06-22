/**
 * Copyright (C) 2012-2013 Kaj Magnus Lindberg (born 1979)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

package com.debiki.v0

import org.specs2.mutable._
import java.{util => ju}
import PostActionDto.copyCreatePost
import com.debiki.v0.{PostActionPayload => PAP}
import Prelude._


object PostTestValues extends PostTestValues


/**
 */
trait PostTestValues {

  val postSkeleton =
    PostActionDto(id = 101, postId = 101, creationDati = new ju.Date(1000),
      loginId = "101", userId = "?", newIp = None,
      payload = PostActionPayload.CreatePost(
        parentPostId = 101,
        text = "text-text-text",
        markup = "",
        approval = None))

  val rawBody = copyCreatePost(postSkeleton, id = PageParts.BodyId, parentPostId = PageParts.BodyId)
  val rawReply_a = copyCreatePost(postSkeleton, id = 102, parentPostId = rawBody.id)
  val rawReply_b = copyCreatePost(postSkeleton, id = 103, parentPostId = rawBody.id)
  val rawReply_a_a = copyCreatePost(postSkeleton, id = 104, parentPostId = rawReply_a.id)

  val EmptyPage = PageParts("a")
  val PageWithBody = EmptyPage + rawBody
  val PageWithOneReply = PageWithBody + rawReply_a
  val PageWithThreeComments = PageWithOneReply + rawReply_b + rawReply_a_a

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
      PageWithThreeComments.getPost_!(rawReply_a.id).siblingsAndMe must beLike {
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

    "list ancestors" >> {
      def ancestorIdsOf(postDto: PostActionDto[PAP.CreatePost]) =
        PageWithThreeComments.getPost_!(postDto.id).ancestorPosts.map(_.id)

      ancestorIdsOf(rawBody) must_== Nil
      ancestorIdsOf(rawReply_a) must_== List(rawBody.id)
      ancestorIdsOf(rawReply_a_a) must_== List(rawReply_a.id, rawBody.id)
    }
  }

}



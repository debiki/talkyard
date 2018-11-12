/**
 * Copyright (c) 2013 Kaj Magnus Lindberg
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

package com.debiki.core

import org.scalatest._
import java.{util => ju}

/*
class PinnedPositionCalcerSpec extends FreeSpec with ShouldMatchers {

  val PostSkeleton = PostTestValues.postSkeleton

  val Body = copyCreatePost(PostSkeleton, id = PageParts.BodyId, parentPostId = None)
  val RawReplyA = copyCreatePost(PostSkeleton, id = 102, parentPostId = Some(Body.id))
  val RawReplyB = copyCreatePost(PostSkeleton, id = 103, parentPostId = Some(Body.id))
  val RawReplyC = copyCreatePost(PostSkeleton, id = 104, parentPostId = Some(Body.id))
  val RawReplyD = copyCreatePost(PostSkeleton, id = 105, parentPostId = Some(Body.id))
  val RawReplyE = copyCreatePost(PostSkeleton, id = 106, parentPostId = Some(Body.id))
  val RawReplyF = copyCreatePost(PostSkeleton, id = 107, parentPostId = Some(Body.id))

  val PageWithBody = PageParts("a") + Body
  val PageWithOneReply = PageWithBody + RawReplyA
  val PageWithManyReplies =
    PageWithBody + RawReplyA + RawReplyB + RawReplyC + RawReplyD + RawReplyE + RawReplyF


  "PinnedPositionCalcer can" -{

    "Derive no pinned position when nothing has been pinned" in {
      val calcer = new PinnedPositionCalcer
      calcer.effectivePositionOf(PageWithBody.body_!) shouldBe None
    }

    "Derive position 1 when single post pinned" in {
      val calcer = new PinnedPositionCalcer
      val post = PageWithOneReply.getPost(RawReplyA.id) getOrElse fail()
      calcer.pinPost(post, 1)
      calcer.effectivePositionOf(post) shouldBe Some(1)
    }

    "Derive position 1 when single post pinned at position 2" in {
      val calcer = new PinnedPositionCalcer
      val post = PageWithOneReply.getPost(RawReplyA.id) getOrElse fail()
      calcer.pinPost(post, 2)
      calcer.effectivePositionOf(post) shouldBe Some(1)
    }

    "Derive position 1 when single post pinned at position 1 and then 1 again" in {
      val calcer = new PinnedPositionCalcer
      val post = PageWithOneReply.getPost(RawReplyA.id) getOrElse fail()
      calcer.pinPost(post, 1)
      calcer.pinPost(post, 1)
      calcer.effectivePositionOf(post) shouldBe Some(1)
    }

    "Derive positions 1 and 2 when two posts pinned at 1 and 2" in {
      val calcer = new PinnedPositionCalcer
      val postA = PageWithManyReplies.getPost(RawReplyA.id) getOrElse fail()
      val postB = PageWithManyReplies.getPost(RawReplyB.id) getOrElse fail()
      calcer.pinPost(postA, 1)
      calcer.pinPost(postB, 2)
      calcer.effectivePositionOf(postA) shouldBe Some(1)
      calcer.effectivePositionOf(postB) shouldBe Some(2)
    }

    "Derive positions 1 and 2 when two posts pinned at 1 and 1" in {
      val calcer = new PinnedPositionCalcer
      val postA = PageWithManyReplies.getPost(RawReplyA.id) getOrElse fail()
      val postB = PageWithManyReplies.getPost(RawReplyB.id) getOrElse fail()
      calcer.pinPost(postA, 1)
      calcer.pinPost(postB, 1) // this pushes A to position 2
      calcer.effectivePositionOf(postA) shouldBe Some(2)
      calcer.effectivePositionOf(postB) shouldBe Some(1)
    }

    "Derive positions 1, 3, 4, 2, 10 for 1, 2, 3, 2 (!), 10" in {
      val calcer = new PinnedPositionCalcer
      val postA = PageWithManyReplies.getPost(RawReplyA.id) getOrElse fail()
      val postB = PageWithManyReplies.getPost(RawReplyB.id) getOrElse fail()
      val postC = PageWithManyReplies.getPost(RawReplyC.id) getOrElse fail()
      val postD = PageWithManyReplies.getPost(RawReplyD.id) getOrElse fail()
      val postE = PageWithManyReplies.getPost(RawReplyE.id) getOrElse fail()
      val postF = PageWithManyReplies.getPost(RawReplyF.id) getOrElse fail()
      calcer.pinPost(postA, 1)
      calcer.pinPost(postB, 2)
      calcer.pinPost(postC, 3)
      calcer.pinPost(postD, 2) // this pushes B and C one step away, but shouldn't affect E
      calcer.pinPost(postE, 99) // it's placed just after all other posts, although 99 specified
      calcer.effectivePositionOf(postA) shouldBe Some(1)
      calcer.effectivePositionOf(postB) shouldBe Some(3) // shifted 1 step
      calcer.effectivePositionOf(postC) shouldBe Some(4) // shifted 1 step
      calcer.effectivePositionOf(postD) shouldBe Some(2) // was inserted
      calcer.effectivePositionOf(postE) shouldBe Some(5)
      calcer.effectivePositionOf(postF) shouldBe None
      calcer.effectivePositionOf(PageWithManyReplies.body_!) shouldBe None
    }

    "Handle a: position 1, b:2, c:3, c:2, c:3" in {
      val calcer = new PinnedPositionCalcer
      val postA = PageWithManyReplies.getPost(RawReplyA.id) getOrElse fail()
      val postB = PageWithManyReplies.getPost(RawReplyB.id) getOrElse fail()
      val postC = PageWithManyReplies.getPost(RawReplyC.id) getOrElse fail()
      calcer.pinPost(postA, 1) // [A]
      calcer.pinPost(postB, 2) // [A, B]
      calcer.pinPost(postC, 3) // [A, B, C]
      calcer.pinPost(postC, 2) // [A, C, B]
      calcer.effectivePositionOf(postA) shouldBe Some(1)
      calcer.effectivePositionOf(postB) shouldBe Some(3)
      calcer.effectivePositionOf(postC) shouldBe Some(2)

      calcer.pinPost(postC, 3) // [A, B, C]
      calcer.effectivePositionOf(postA) shouldBe Some(1)
      calcer.effectivePositionOf(postB) shouldBe Some(2)
      calcer.effectivePositionOf(postC) shouldBe Some(3)
    }

    "Handle a:1, b:2, a:2 —> b:1, a:2" in {
      val calcer = new PinnedPositionCalcer
      val postA = PageWithManyReplies.getPost(RawReplyA.id) getOrElse fail()
      val postB = PageWithManyReplies.getPost(RawReplyB.id) getOrElse fail()
      calcer.pinPost(postA, 1) // [A]
      calcer.pinPost(postB, 2) // [A, B]
      calcer.pinPost(postA, 2) // [B, A]
      calcer.effectivePositionOf(postA) shouldBe Some(2)
      calcer.effectivePositionOf(postB) shouldBe Some(1)
    }
  }
}*/



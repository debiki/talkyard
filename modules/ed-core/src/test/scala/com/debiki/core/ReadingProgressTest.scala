/**
 * Copyright (c) 2017 Kaj Magnus Lindberg
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


class ReadingProgressTest extends FreeSpec with MustMatchers {


  "ReadingProgress can" - {

    "convert low-post-nrs-read to bits" - {
      def bitsFor(postNrs: Set[PostNr]): Array[Byte] = ReadingProgress(
        firstVisitedAt = When.fromMillis(0),
        lastVisitedAt = When.fromMillis(0),
        lastReadAt = if (postNrs.isEmpty) None else Some(When.fromMillis(0)),
        lastPostNrsReadRecentFirst = postNrs.headOption.toVector,
        lowPostNrsRead = postNrs,
        secondsReading = 1234).lowPostNrsReadAsBitsetBytes

      "nothing read" in {
        bitsFor(Set.empty) mustBe Array[Byte]()
      }

      // 0000 1000 =  8
      // 0010 0000 = 32
      // 0100 0000 = 64
      // 1000 0000 = -128
      // 1100 0000 = -64

      "post no 1 read" in { bitsFor(Set(1)) mustBe Array[Byte](1) }
      "post no 2 read" in { bitsFor(Set(2)) mustBe Array[Byte](2) }
      "post no 3 read" in { bitsFor(Set(3)) mustBe Array[Byte](4) }
      "post no 4 read" in { bitsFor(Set(4)) mustBe Array[Byte](8) }
      "post no 5 read" in { bitsFor(Set(5)) mustBe Array[Byte](16) }
      "post no 6 read" in { bitsFor(Set(6)) mustBe Array[Byte](32) }
      "post no 7 read" in { bitsFor(Set(7)) mustBe Array[Byte](64) }
      "post no 8 read" in { bitsFor(Set(8)) mustBe Array[Byte](-128) }
      "post no 9 read" in { bitsFor(Set(9)) mustBe Array[Byte](0, 1) }
      "post no 10 read" in { bitsFor(Set(10)) mustBe Array[Byte](0, 2) }
      "post no 11 read" in { bitsFor(Set(11)) mustBe Array[Byte](0, 4) }
      "post no 12 read" in { bitsFor(Set(12)) mustBe Array[Byte](0, 8) }
      "post no 13 read" in { bitsFor(Set(13)) mustBe Array[Byte](0, 16) }
      "post no 14 read" in { bitsFor(Set(14)) mustBe Array[Byte](0, 32) }
      "post no 15 read" in { bitsFor(Set(15)) mustBe Array[Byte](0, 64) }
      "post no 16 read" in { bitsFor(Set(16)) mustBe Array[Byte](0, -128) }
      "post no 17 read" in { bitsFor(Set(17)) mustBe Array[Byte](0, 0, 1) }
      "post no 23 read" in { bitsFor(Set(23)) mustBe Array[Byte](0, 0, 64) }
      "post no 24 read" in { bitsFor(Set(24)) mustBe Array[Byte](0, 0, -128) }
      "post no 25 read" in { bitsFor(Set(25)) mustBe Array[Byte](0, 0, 0, 1) }
      "post no 32 read" in { bitsFor(Set(32)) mustBe Array[Byte](0, 0, 0, -128) }
      "post no 33 read" in { bitsFor(Set(33)) mustBe Array[Byte](0, 0, 0, 0, 1) }
      "post no 40 read" in { bitsFor(Set(40)) mustBe Array[Byte](0, 0, 0, 0, -128) }
      "post no 41 read" in { bitsFor(Set(41)) mustBe Array[Byte](0, 0, 0, 0, 0, 1) }
      "post no 48 read" in { bitsFor(Set(48)) mustBe Array[Byte](0, 0, 0, 0, 0, -128) }

      "post no 1 and 2 read" in {
        bitsFor(Set(1, 2)) mustBe Array[Byte](3)  // 1 + 2
      }

      "post no 1 and 3 read" in {
        bitsFor(Set(1, 3)) mustBe Array[Byte](5)  // 1 + 4
      }

      "post no 1, 3, 6 read" in {
        bitsFor(Set(1, 3, 6)) mustBe Array[Byte](37)  // 1 + 4 + 32
      }

      "post no 1 and 8 read" in {
        bitsFor(Set(1, 8)) mustBe Array[Byte](-127)  // 1 - 128
      }

      "post no 7 and 8 read" in {
        bitsFor(Set(7, 8)) mustBe Array[Byte](-64)  // 64 - 128
      }

      "post no 1..8 read" in {
        bitsFor(Set(1, 2, 3, 4, 5, 6, 7, 8)) mustBe Array[Byte](-1)  // -1 = bits 0xff
      }

      "post no 9..16 read" in {
        bitsFor(Set(9, 10, 11, 12, 13, 14, 15, 16)) mustBe Array[Byte](0, -1)
      }

      "post no 1, 9, 17, 25, 33, 41 read" in {
        bitsFor(Set(1, 9, 17, 25, 33, 41)) mustBe Array[Byte](1, 1, 1, 1, 1, 1)
      }

      "post no 1, 41 read" in {
        bitsFor(Set(1, 41)) mustBe Array[Byte](1, 0, 0, 0, 0, 1)
      }
    }

    "convert bits to low-post-nrs-read" - {
      def parse(bytes: Array[Byte]): Set[PostNr] =
        ReadingProgress.parseLowPostNrsReadBitsetBytes(bytes)

      "nothing as empty array" in {
        parse(Array.empty) mustBe Set.empty
      }

      "nothing as 0" in {
        parse(Array[Byte](0)) mustBe Set.empty
      }

      "post nr 1" in { parse(Array[Byte]((1 << 0).toByte)) mustBe Set(1) }
      "post nr 2" in { parse(Array[Byte]((1 << 1).toByte)) mustBe Set(2) }
      "post nr 3" in { parse(Array[Byte]((1 << 2).toByte)) mustBe Set(3) }
      "post nr 4" in { parse(Array[Byte]((1 << 3).toByte)) mustBe Set(4) }
      "post nr 5" in { parse(Array[Byte]((1 << 4).toByte)) mustBe Set(5) }
      "post nr 6" in { parse(Array[Byte]((1 << 5).toByte)) mustBe Set(6) }
      "post nr 7" in { parse(Array[Byte]((1 << 6).toByte)) mustBe Set(7) }
      "post nr 8" in { parse(Array[Byte]((1 << 7).toByte)) mustBe Set(8) }

      "post nr  9" in { parse(Array[Byte](0, (1 << 0).toByte)) mustBe Set(9) }
      "post nr 10" in { parse(Array[Byte](0, (1 << 1).toByte)) mustBe Set(10) }
      "post nr 11" in { parse(Array[Byte](0, (1 << 2).toByte)) mustBe Set(11) }
      "post nr 15" in { parse(Array[Byte](0, (1 << 6).toByte)) mustBe Set(15) }
      "post nr 16" in { parse(Array[Byte](0, (1 << 7).toByte)) mustBe Set(16) }

      "post nr 1, 3" in { parse(Array[Byte]((1 + (1 << 2)).toByte)) mustBe Set(1, 3) }
      "post nr 1, 8" in { parse(Array[Byte]((1 + (1 << 7)).toByte)) mustBe Set(1, 8) }
      "post nr 1, 3, 8" in { parse(Array[Byte]((1 + 4 - 128).toByte)) mustBe Set(1, 3, 8) }

      "post nr 1, 9, 17" in { parse(Array[Byte](1, 1, 1)) mustBe Set(1, 9, 17) }
      "post nr 8, 16, 24" in { parse(Array[Byte](-128, -128, -128)) mustBe Set(8, 16, 24) }
      "post nr 8, 24" in { parse(Array[Byte](-128, 0, -128)) mustBe Set(8, 24) }

      "post nr 8, 17,18,19,24 trailing 0s" in {
        parse(Array[Byte](-128, 0, (1 + 2 + 4 - 128).toByte, 0, 0)) mustBe Set(8, 17, 18, 19, 24)
      }
    }
  }

}


/**
 * Copyright (c) 2016 Kaj Magnus Lindberg
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


class WatchbarTest extends FreeSpec with MustMatchers {


  "Watchbar can" - {

    "become a compact string and go back again" - {
      "empty" in {
        val watchbar = BareWatchbar.empty
        val string = watchbar.toCompactBareWatchbarString
        string mustBe "|||"
        BareWatchbar.fromCompactString(string) mustBe watchbar
      }

      "one topic" in {
        val watchbar = BareWatchbar(Vector(WatchbarTopic("pageId", unread = false)), Nil, Nil, Nil)
        val string = watchbar.toCompactBareWatchbarString
        string mustBe "pageId|||"
        BareWatchbar.fromCompactString(string) mustBe watchbar
      }

      "one topic, last" in {
        val watchbar = BareWatchbar(Nil, Nil, Nil, Vector(WatchbarTopic("pageId", unread = false)))
        val string = watchbar.toCompactBareWatchbarString
        string mustBe "|||pageId"
        BareWatchbar.fromCompactString(string) mustBe watchbar
      }

      "an unread topic" in {
        val watchbar = BareWatchbar(
          Vector(WatchbarTopic("pageId", unread = true)), Nil, Nil, Nil)
        val string = watchbar.toCompactBareWatchbarString
        string mustBe "pageId:1|||"
        BareWatchbar.fromCompactString(string) mustBe watchbar
      }

      "many topics, all watchbar sections" in {
        val watchbar = BareWatchbar(
          Vector(WatchbarTopic("aa", unread = false), WatchbarTopic("bb", unread = false)),
          Vector(WatchbarTopic("xx", unread = false), WatchbarTopic("yy", unread = false)),
          Vector(WatchbarTopic("zz", unread = false)),
          Vector(WatchbarTopic("i", unread = false), WatchbarTopic("j", unread = false),
            WatchbarTopic("unread", unread = true)))
        val string = watchbar.toCompactBareWatchbarString
        string mustBe "aa,bb|xx,yy|zz|i,j,unread:1"
        BareWatchbar.fromCompactString(string) mustBe watchbar
      }
    }
  }

}


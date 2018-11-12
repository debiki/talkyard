/**
 * Copyright (C) 2012 Kaj Magnus Lindberg (born 1979)
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

package controllers

import com.debiki.core._
import com.debiki.core
import org.specs2.mutable._


class UtilsSpec extends Specification {


  "Utils.parsePathRanges" can {

    import Utils.parsePathRanges

    val baseFolder = "/folder/"

    "fallback to defaults" >> {
      val ranges = parsePathRanges(baseFolder, Map.empty)
      ranges must be_==(PathRanges(folders = Seq("/folder/"), trees = Nil))
    }

    "understand &in-folder and &for-folder" >> {
      val rangesIn = parsePathRanges(baseFolder, Map("in-folder" -> Seq("")))
      val rangesFor = parsePathRanges(baseFolder, Map("for-folder" -> Seq("")),
         "for")
      val key = PathRanges(folders = Seq("/folder/"), trees = Nil)
      rangesIn must be_==(key)
      rangesFor must be_==(key)
    }

    "understand &in-tree and &for-tree" >> {
      val rangesIn = parsePathRanges(baseFolder, Map("in-tree" -> Seq("")))
      val rangesFor = parsePathRanges(baseFolder, Map("for-tree" -> Seq("")),
         "for")
      val key = PathRanges(folders = Nil, trees = Seq("/folder/"))
      rangesIn must be_==(key)
      rangesFor must be_==(key)
    }

    "understand &in-folders=f/" >> {
      val ranges = parsePathRanges(baseFolder, Map("in-folders" -> Seq("f/")))
      ranges must be_==(PathRanges(folders = Seq("/folder/f/"), trees = Nil))
    }

    "understand &in-folders=f/,f2/&in-trees=t/,t2/" >> {
      val ranges = parsePathRanges(baseFolder, Map(
        "in-folders" -> Seq("f/,f2/"), "in-trees" -> Seq("t/,t2/")))
      ranges must be_==(PathRanges(folders = Seq("/folder/f/", "/folder/f2/"),
        trees = Seq("/folder/t/", "/folder/t2/")))
    }

    "understand absolute paths: /f/ and /t/" >> {
      val ranges = parsePathRanges(baseFolder, Map(
        "in-folders" -> Seq("/f/"), "in-trees" -> Seq("/t/")))
      ranges must be_==(PathRanges(folders = Seq("/f/"), trees = Seq("/t/")))
    }

    "understand &for-pages=aa,bb" >> {
      val ranges = parsePathRanges(baseFolder, Map("for-pages" -> Seq("aa,bb")))
      ranges must be_==(PathRanges(pageIds = Seq("aa", "bb")))
    }
  }

}


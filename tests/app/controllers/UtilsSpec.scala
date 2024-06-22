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
import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.must


class UtilsSpec extends AnyFreeSpec with must.Matchers {


  "Utils.parsePathRanges can" - {

    import Utils.parsePathRanges

    val baseFolder = "/folder/"

    "fallback to defaults" in {
      val ranges = parsePathRanges(baseFolder, Map.empty)
      ranges mustBe PathRanges(folders = Seq("/folder/"), trees = Nil)
    }

    "understand &in-folder and &for-folder" in {
      val rangesIn = parsePathRanges(baseFolder, Map("in-folder" -> Seq("")))
      val rangesFor = parsePathRanges(baseFolder, Map("for-folder" -> Seq("")),
         "for")
      val key = PathRanges(folders = Seq("/folder/"), trees = Nil)
      rangesIn mustBe key
      rangesFor mustBe key
    }

    "understand &in-tree and &for-tree" in {
      val rangesIn = parsePathRanges(baseFolder, Map("in-tree" -> Seq("")))
      val rangesFor = parsePathRanges(baseFolder, Map("for-tree" -> Seq("")),
         "for")
      val key = PathRanges(folders = Nil, trees = Seq("/folder/"))
      rangesIn mustBe key
      rangesFor mustBe key
    }

    "understand &in-folders=f/" in {
      val ranges = parsePathRanges(baseFolder, Map("in-folders" -> Seq("f/")))
      ranges mustBe PathRanges(folders = Seq("/folder/f/"), trees = Nil)
    }

    "understand &in-folders=f/,f2/&in-trees=t/,t2/" in {
      val ranges = parsePathRanges(baseFolder, Map(
        "in-folders" -> Seq("f/,f2/"), "in-trees" -> Seq("t/,t2/")))
      ranges mustBe PathRanges(folders = Seq("/folder/f/", "/folder/f2/"),
        trees = Seq("/folder/t/", "/folder/t2/"))
    }

    "understand absolute paths: /f/ and /t/" in {
      val ranges = parsePathRanges(baseFolder, Map(
        "in-folders" -> Seq("/f/"), "in-trees" -> Seq("/t/")))
      ranges mustBe PathRanges(folders = Seq("/f/"), trees = Seq("/t/"))
    }

    "understand &for-pages=aa,bb" in {
      val ranges = parsePathRanges(baseFolder, Map("for-pages" -> Seq("aa,bb")))
      ranges mustBe PathRanges(pageIds = Seq("aa", "bb"))
    }
  }


  "Utils.makeLocalHostnameFromEmbeddingAdr can" - {
    import Utils.makeLocalHostnameFromEmbeddingAdr
    "handle simple cases" in {
      makeLocalHostnameFromEmbeddingAdr("") mustBe ""
      makeLocalHostnameFromEmbeddingAdr("localhost") mustBe "localhost"
    }

    "remove simple TLDs" in {
      makeLocalHostnameFromEmbeddingAdr("example.com") mustBe "example"
      makeLocalHostnameFromEmbeddingAdr("example.org") mustBe "example"
    }

    "remove two part 'TLDs'" in {
      makeLocalHostnameFromEmbeddingAdr("example.co.uk") mustBe "example"
      makeLocalHostnameFromEmbeddingAdr("example.org.uk") mustBe "example"
    }

    "remove URL paths & query etc" in {
      makeLocalHostnameFromEmbeddingAdr("example.co.uk/ab") mustBe "example"
      makeLocalHostnameFromEmbeddingAdr("example.co.uk/ab/cd?ef=gh#ij") mustBe "example"
      makeLocalHostnameFromEmbeddingAdr("x.org?param") mustBe "x"
      makeLocalHostnameFromEmbeddingAdr("y.co#hash") mustBe "y"
    }

    "dots to dashes" in {
      makeLocalHostnameFromEmbeddingAdr("ex.am.ple.ventures") mustBe "ex-am-ple"
      makeLocalHostnameFromEmbeddingAdr("ex.am.ple.com") mustBe "ex-am-ple"
      makeLocalHostnameFromEmbeddingAdr("ex.am.ple.org.uk") mustBe "ex-am-ple"
      makeLocalHostnameFromEmbeddingAdr("www.ex.am.ple.org.uk") mustBe "www-ex-am-ple"
      makeLocalHostnameFromEmbeddingAdr("..www....ex.am.ple..org.uk..") mustBe "www-ex-am-ple"
      makeLocalHostnameFromEmbeddingAdr("dots..and--dash.feed-your.cat"
                                ) mustBe "dots-and-dash-feed-your"
    }

    "keeps 'e2e-test--' prefix (although two '-')" in {
      makeLocalHostnameFromEmbeddingAdr("e2e-test--brave--bat.--.cat"
            ) mustBe "e2e-test--brave-bat"
      makeLocalHostnameFromEmbeddingAdr("smoke-test--brave---rabbit.-.news"
            ) mustBe "smoke-test--brave-rabbit"
      makeLocalHostnameFromEmbeddingAdr("somethingelse-test--aa-bb.com"
            ) mustBe "somethingelse-test-aa-bb" // only one '-' after 'test'
    }

    "remove https://" in {
      makeLocalHostnameFromEmbeddingAdr("//example") mustBe "example"
      makeLocalHostnameFromEmbeddingAdr("http://example") mustBe "example"
      makeLocalHostnameFromEmbeddingAdr("https://example") mustBe "example"
    }

    "all at the same time" in {
      makeLocalHostnameFromEmbeddingAdr("blog.com.pany.com:8080") mustBe "blog-com-pany"
      makeLocalHostnameFromEmbeddingAdr("x.org.in?param") mustBe "x"
      makeLocalHostnameFromEmbeddingAdr("y.co#hash") mustBe "y"
      makeLocalHostnameFromEmbeddingAdr("https://blog.kittens.example.com:8080/ab?cd#e"
            ) mustBe "blog-kittens-example"
      makeLocalHostnameFromEmbeddingAdr("e2e-test--aa.bb--cc.co.uk:80#hmm"
            ) mustBe "e2e-test--aa-bb-cc"

    }
  }

}


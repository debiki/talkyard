/**
 * Copyright (c) 2019 Kaj Magnus Lindberg
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

package talkyard.server

import debiki.Config
import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.must


class GlobalConfigSpec extends AnyFreeSpec with must.Matchers {

  def makeConfig(keyValues: Map[String, String]): Config = {
    val playConf = play.api.Configuration.from(keyValues)
    new Config(playConf)
  }

  "The server global Config can provide config for" - {

    "disk usage limits" - {
      "via quotaLimitMegabytes" in {
        val conf = makeConfig(Map("talkyard.newSite.quotaLimitMegabytes" -> "100"))
        testWithOnlyForumSpecified(conf)
      }

      "via talkyard.newSite.quotaLimitMegabytesForum" in {
        val conf = makeConfig(Map("talkyard.newSite.quotaLimitMegabytesForum" -> "100"))
        testWithOnlyForumSpecified(conf)
      }

      def testWithOnlyForumSpecified(conf: Config) {
        import conf.createSite.quotaLimitMegabytes
        quotaLimitMegabytes(isForBlogComments = false, isTestSite = false) mustBe Some(100)
        quotaLimitMegabytes(isForBlogComments = false, isTestSite = true) mustBe Some(10)
        quotaLimitMegabytes(isForBlogComments = true, isTestSite = false) mustBe Some(10)
        quotaLimitMegabytes(isForBlogComments = true, isTestSite = true) mustBe Some(1)
      }

      "via talkyard.newSite.quotaLimitMegabytesForum and ...Blog" in {
        val conf = makeConfig(Map(
          "talkyard.newSite.quotaLimitMegabytesForum" -> "100",
          "talkyard.newSite.quotaLimitMegabytesBlogComments" -> "20"))
        import conf.createSite.quotaLimitMegabytes
        quotaLimitMegabytes(isForBlogComments = false, isTestSite = false) mustBe Some(100)
        quotaLimitMegabytes(isForBlogComments = false, isTestSite = true) mustBe Some(10)
        quotaLimitMegabytes(isForBlogComments = true, isTestSite = false) mustBe Some(20)
        quotaLimitMegabytes(isForBlogComments = true, isTestSite = true) mustBe Some(2)
      }

      "without quotaLimitMegabytes, then no limits" in {
        val conf = makeConfig(Map.empty)
        import conf.createSite.quotaLimitMegabytes
        quotaLimitMegabytes(isForBlogComments = false, isTestSite = false) mustBe None
        quotaLimitMegabytes(isForBlogComments = false, isTestSite = true) mustBe None
        quotaLimitMegabytes(isForBlogComments = true, isTestSite = false) mustBe None
        quotaLimitMegabytes(isForBlogComments = true, isTestSite = true) mustBe None
      }
    }


    "which sites may upsert patches" - {
      "no sites" in {
        val conf = makeConfig(Map())
        conf.mayPatchSite(123) mustBe false
        conf.mayPatchSite(456) mustBe false
      }

      "one site" in {
        val conf = makeConfig(Map("talkyard.mayPatchSiteIds" -> "123"))
        conf.mayPatchSite(123) mustBe true
        conf.mayPatchSite(456) mustBe false
      }

      "three sites" in {
        val conf = makeConfig(Map("talkyard.mayPatchSiteIds" -> "222,333,444"))
        conf.mayPatchSite(111) mustBe false
        conf.mayPatchSite(222) mustBe true
        conf.mayPatchSite(333) mustBe true
        conf.mayPatchSite(444) mustBe true
        conf.mayPatchSite(555) mustBe false
        conf.mayPatchSite(-222) mustBe false
        conf.mayPatchSite(-333) mustBe false
        conf.mayPatchSite(-444) mustBe false
      }

      "test sites, negative ids" in {
        val conf = makeConfig(Map("talkyard.mayPatchSiteIds" -> "-222,-333,-444"))
        conf.mayPatchSite(-111) mustBe false
        conf.mayPatchSite(-222) mustBe true
        conf.mayPatchSite(-333) mustBe true
        conf.mayPatchSite(-444) mustBe true
        conf.mayPatchSite(-555) mustBe false
        conf.mayPatchSite(+222) mustBe false
        conf.mayPatchSite(+333) mustBe false
        conf.mayPatchSite(+444) mustBe false
      }
    }
  }

}


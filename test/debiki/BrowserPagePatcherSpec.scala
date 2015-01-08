/**
 * Copyright (C) 2013 Kaj Magnus Lindberg (born 1979)
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

package debiki

import com.debiki.core._
import org.scalatest._
import org.scalatest.matchers.MustMatchers
import BrowserPagePatcher._



class BrowserPagePatcherSpec extends RichFreeSpec with ShouldMatchers {


  "BrowserPagePatcher can" - {

    "sort and merge TreePatchSpec:s" - {

      "sort nothing" in {
        BrowserPagePatcher.sortAndMerge(Nil).length shouldBe 0
      }

      "sort one spec" in {
        val spec = TreePatchSpec(16, false, false)
        val result = BrowserPagePatcher.sortAndMerge(Vector(spec))
        result.length shouldBe 1
        result.head shouldBe spec
      }

      "sort many specs correctly, incl page body, title and config posts" in {
        import PageParts._
        for (magicId <- Vector(BodyId, TitleId, ConfigPostId)) {
          val specsUnsorted = Vector[TreePatchSpec](
            TreePatchSpec(16, false, false),
            TreePatchSpec(18, true, false),
            TreePatchSpec(65535, true, false),
            TreePatchSpec(magicId, false, false),
            TreePatchSpec(3, true, false),
            TreePatchSpec(12, false, false))

          val specsSorted = BrowserPagePatcher.sortAndMerge(specsUnsorted)
          specsSorted shouldBe Vector[TreePatchSpec](
            TreePatchSpec(magicId, false, false),
            TreePatchSpec(3, true, false),
            TreePatchSpec(12, false, false),
            TreePatchSpec(16, false, false),
            TreePatchSpec(18, true, false),
            TreePatchSpec(65535, true, false))
        }
      }

      "merges specs" in {
        val specsMerged = BrowserPagePatcher.sortAndMerge(Vector(
          TreePatchSpec(1, false, false),
          TreePatchSpec(1, false, true),
          TreePatchSpec(2, true, false),
          TreePatchSpec(2, false, false),
          TreePatchSpec(3, false, false),
          TreePatchSpec(3, true, true),
          TreePatchSpec(4, false, false),
          TreePatchSpec(4, true, true),
          TreePatchSpec(4, true, true),
          TreePatchSpec(5, false, false),
          TreePatchSpec(5, false, false)))

        specsMerged shouldBe Vector(
          TreePatchSpec(1, false, true),
          TreePatchSpec(2, true, false),
          TreePatchSpec(3, true, true),
          TreePatchSpec(4, true, true),
          TreePatchSpec(5, false, false))
      }

    }
  }
}
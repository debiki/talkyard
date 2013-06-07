/**
 * Copyright (C) 2011-2012 Kaj Magnus Lindberg (born 1979)
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
import Prelude._


class PagePathTest extends Specification {

  "PagePath" should {

    "find its parent folder" >> {
      val rootFldr: PagePath = PagePath(tenantId = "tenantId", folder = "/",
         pageSlug = "", pageId = None, showId = false)
      val indexPage = rootFldr.copy(pageId = Some("abcd"))
      val idPage = indexPage.copy(showId = true)
      val slugPage = rootFldr.copy(pageSlug = "slug")
      val slugPageWithId = slugPage.copy(pageId = Some("abcd"), showId = true)
      val folder = rootFldr.copy(folder = "/folder/")
      val folderMuuPage = folder.copy(pageSlug = "MuuPage")
      val folderMuuIdPage = folderMuuPage.copy(
                              pageId = Some("muuid"), showId = true)
      val folderSubfolder = folder.copy(folder = "/folder/subfolder/")

      rootFldr.parentFolder must_== None
      indexPage.parentFolder must_== Some(rootFldr)
      idPage.parentFolder must_== Some(rootFldr)
      slugPage.parentFolder must_== Some(rootFldr)
      slugPageWithId.parentFolder must_== Some(rootFldr)
      folder.parentFolder must_== Some(rootFldr)
      folderMuuPage.parentFolder must_== Some(folder)
      folderMuuIdPage.parentFolder must_== Some(folder)
      folderSubfolder.parentFolder must_== Some(folder)
    }

    "find what parent?? for /double-slash//" >> {
      // COULD make folder = "/doudle-slash//" work too?
      // Currently that results in "/doudle-slash/" I think.
    }
  }

}

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list


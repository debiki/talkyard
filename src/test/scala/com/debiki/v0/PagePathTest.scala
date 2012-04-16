/**
 * Copyright (c) 2011-2012 Kaj Magnus Lindberg (born 1979)
 */

package com.debiki.v0


import org.specs._
import Prelude._


class PagePathTest extends SpecificationWithJUnit {

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


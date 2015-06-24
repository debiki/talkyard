/**
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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

/*
package com.debiki.tck.dao.specs

import com.debiki.core._
import com.debiki.core.Prelude._
import com.debiki.tck.dao._
import com.debiki.tck.dao.code._
import java.{util => ju}
import org.scalatest._


class ListUsernamesSpec(daoFactory: DbDaoFactory) extends DbDaoSpec(daoFactory) {

  lazy val utils = new TestUtils(daoFactory)
  lazy val site = utils.createFirstSite()
  lazy val siteUtils = new SiteTestUtils(site, daoFactory)


  "The site dao can" - {

    var page: Page = null
    var userA: User = null
    var userB: User = null

    "create two users with usernames" in {
      userA = siteUtils.createPasswordRole("NameA")
      userB = siteUtils.createPasswordRole("NameB")
    }

    "have one of the users create a page" in {
      val loginGrant = siteUtils.login(userA)
      page = siteUtils.createPageAndBody(loginGrant, PageRole.ForumTopic, "page text")
    }

    "list all usernames on the page" in {
      val names = siteUtils.dao.listUsernames(pageId = page.id, prefix = "")
      names mustBe Seq(NameAndUsername(userA.displayName, userA.username getOrDie "DwE75GKSE3"))
    }

    "lookup usernames by prefix" in {
      val names = siteUtils.dao.listUsernames(pageId = page.id, prefix = "Nam")
      names mustBe Seq(
        NameAndUsername(userA.displayName, userA.username getOrDie "DwE22GkEF0"),
        NameAndUsername(userB.displayName, userB.username getOrDie "DwE05KFS99"))
    }

    "find no users for wrong page id or prefix" in {
      siteUtils.dao.listUsernames(pageId = "wrongPageId", prefix = "") mustBe Nil
      siteUtils.dao.listUsernames(pageId = page.id, prefix = "NamXX") mustBe Nil
    }

  }

}

*/

/**
 * Copyright (c) 2018 Kaj Magnus Lindberg
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

package debiki.dao

import com.debiki.core._
import NotfLevel._

class PageNotfPrefTxSpec extends DaoAppSuite() {
  var dao: SiteDao = _
  var owner: Participant = _
  var userOne: Participant = _
  var userTwo: Participant = _

  var forumPageId: PageId = _
  var defCatId: CategoryId = _
  var otherCatId: CategoryId = _

  var pageIdOne: PageId = _
  var pageIdTwo: PageId = _
  var pageIdThree: PageId = _

  var ownersSitePref: PageNotfPref = _

  lazy val now: When = globals.now()


  "PageNotPref SiteTransaction fns can  TyT8MKRD25" - {

    "prepare" in {
      globals.systemDao.getOrCreateFirstSite()
      dao = globals.siteDao(Site.FirstSiteId)
      owner = createPasswordOwner("5kwu8f40", dao)
      userOne = createPasswordUser("pp22xxnn", dao, trustLevel = TrustLevel.BasicMember)
      userTwo = createPasswordUser("jjyyzz55", dao, trustLevel = TrustLevel.BasicMember)

      val createForumResult =
          dao.createForum("Forum", s"/notfs-tx-forum/", isForEmbCmts = false,
            Who(owner.id, browserIdData)).get

      defCatId = createForumResult.defaultCategoryId
      forumPageId = createForumResult.pagePath.pageId

      otherCatId = dao.readTx(_.nextCategoryId())
      dao.createCategory(
        CategoryToSave(
          anyId = Some(otherCatId),
          sectionPageId = createForumResult.pagePath.pageId,
          parentId = createForumResult.staffCategoryId,
          name = "Other Category",
          slug = "other-category",
          description = "Descr, other cat",
          position = 11,
          newTopicTypes = List(PageType.Discussion),
          shallBeDefaultCategory = false,
          unlistCategory = false,
          unlistTopics = false,
          includeInSummaries = IncludeInSummaries.NoExclude),
        Vector(ForumDao.makeEveryonesDefaultCategoryPerms(otherCatId)),
        Who.System)

      pageIdOne = createPage(PageType.Discussion, dao.textAndHtmlMaker.forTitle("Notfs Test One"),
        bodyTextAndHtml = dao.textAndHtmlMaker.forBodyOrComment("Text text one."),
        authorId = SystemUserId, browserIdData, dao,
        anyCategoryId = Some(defCatId))

      pageIdTwo = createPage(PageType.Discussion, dao.textAndHtmlMaker.forTitle("Notfs Test Two"),
        bodyTextAndHtml = dao.textAndHtmlMaker.forBodyOrComment("Text text two."),
        authorId = SystemUserId, browserIdData, dao,
        anyCategoryId = Some(defCatId))

      pageIdThree = createPage(PageType.Discussion, dao.textAndHtmlMaker.forTitle("Notfs Test Three"),
        bodyTextAndHtml = dao.textAndHtmlMaker.forBodyOrComment("Text text three."),
        authorId = SystemUserId, browserIdData, dao,
        anyCategoryId = Some(defCatId))

      ownersSitePref = PageNotfPref(owner.id, NotfLevel.WatchingAll, wholeSite = true)
    }


    "find no people watching" in {
      dao.readOnlyTransaction { tx =>
        tx.loadPageNotfPrefsOnPage(pageIdOne) mustBe Seq.empty
        tx.loadPageNotfPrefsOnCategory(defCatId) mustBe Seq.empty
      }
    }

    "... except for the owner, who watches the whole site by default" in {
      dao.readOnlyTransaction { tx =>
        tx.loadPageNotfPrefsOnSite() mustBe Seq(ownersSitePref)
      }
    }


    // ----- Pages


    "can config page notf prefs" - {
      var pref: PageNotfPref = null

      "insert notf prefs, for page" in {
        dao.readWriteTransaction { tx =>
          pref = PageNotfPref(
            userOne.id,
            pageId = Some(pageIdOne),
            notfLevel = EveryPostAllEdits)
          tx.upsertPageNotfPref(pref)
        }
      }

      "find again" in {
        dao.readOnlyTransaction { tx =>
          tx.loadPageNotfLevels(userOne.id, pageIdOne, Some(defCatId)) mustBe PageNotfLevels(
            forPage = Some(EveryPostAllEdits),
            forCategory = None,
            forWholeSite = None)

          tx.loadPageNotfPrefsOnPage(pageIdOne) mustBe Seq(pref)
          tx.loadPageNotfPrefsOnCategory(defCatId) mustBe Seq.empty
        }
      }

      "... not for the wrong user" in {
        dao.readOnlyTransaction { tx =>
          tx.loadPageNotfLevels(userTwo.id, pageIdOne, Some(defCatId)) mustBe PageNotfLevels(
            forPage = None,
            forCategory = None,
            forWholeSite = None)
        }
      }

      "... not for the wrong page" in {
        dao.readOnlyTransaction { tx =>
          tx.loadPageNotfLevels(userOne.id, pageIdTwo, Some(defCatId)) mustBe PageNotfLevels(
            forPage = None,
            forCategory = None,
            forWholeSite = None)
          tx.loadPageNotfPrefsOnPage(pageIdTwo) mustBe Seq.empty
        }
      }
    }


    "can config notfs prefs for many pages" - {
      "configure" in {
        dao.readWriteTransaction { tx =>
          tx.upsertPageNotfPref(PageNotfPref(
            userOne.id,
            pageId = Some(pageIdTwo),
            notfLevel = WatchingAll))
        }
      }

      "find again" in {
        dao.readOnlyTransaction { tx =>
          tx.loadPageNotfLevels(userOne.id, pageIdTwo, Some(defCatId)) mustBe PageNotfLevels(
            forPage = Some(WatchingAll),
            forCategory = None,
            forWholeSite = None)
        }
      }

      "didn't overwrite the 1st page's notf level" in {
        dao.readOnlyTransaction { tx =>
          tx.loadPageNotfLevels(userOne.id, pageIdOne, Some(defCatId)) mustBe PageNotfLevels(
            forPage = Some(EveryPostAllEdits),
            forCategory = None,
            forWholeSite = None)
        }
      }
    }


    "can edit page notf prefs" - {
      "upsert notf prefs, for page one" in {
        dao.readWriteTransaction { tx =>
          tx.upsertPageNotfPref(PageNotfPref(
            userOne.id,
            pageId = Some(pageIdOne),
            pagesInCategoryId = None,
            notfLevel = Hushed))
        }
      }

      "find again" in {
        dao.readOnlyTransaction { tx =>
          tx.loadPageNotfLevels(userOne.id, pageIdOne, Some(defCatId)) mustBe PageNotfLevels(
            forPage = Some(Hushed),
            forCategory = None,
            forWholeSite = None)
        }
      }

      "didn't overwrite the 2nd page's notf level" in {
        dao.readOnlyTransaction { tx =>
          tx.loadPageNotfLevels(userOne.id, pageIdTwo, Some(defCatId)) mustBe PageNotfLevels(
            forPage = Some(WatchingAll),
            forCategory = None,
            forWholeSite = None)
        }
      }
    }


    // ----- Categories


    "can config category notf prefs" - {
      var pref: PageNotfPref = null

      "insert notf prefs, for a category" in {
        dao.readWriteTransaction { tx =>
          pref = PageNotfPref(userOne.id, pagesInCategoryId = Some(defCatId), notfLevel = TopicProgress)
          tx.upsertPageNotfPref(pref)
        }
      }

      "find again" in {
        dao.readOnlyTransaction { tx =>
          tx.loadPageNotfLevels(userOne.id, pageIdThree, Some(defCatId)) mustBe PageNotfLevels(
            forPage = None,
            forCategory = Some(TopicProgress),
            forWholeSite = None)
          tx.loadPageNotfPrefsOnCategory(defCatId) mustBe Seq(pref)
        }
      }

      "... not for a page id" in {
        dao.readOnlyTransaction { tx =>
          tx.loadPageNotfPrefsOnPage(pageIdThree) mustBe Seq.empty
        }
      }

      "... not for the wrong user" in {
        dao.readOnlyTransaction { tx =>
          tx.loadPageNotfLevels(userTwo.id /*wrong*/, pageIdThree, Some(defCatId)) mustBe
            PageNotfLevels(
              forPage = None,
              forCategory = None,
              forWholeSite = None)
        }
      }

      "... not for the wrong category" in {
        dao.readOnlyTransaction { tx =>
          tx.loadPageNotfLevels(userOne.id, pageIdThree, Some(otherCatId) /* wrong */) mustBe
            PageNotfLevels(
              forPage = None,
              forCategory = None,
              forWholeSite = None)
          tx.loadPageNotfPrefsOnCategory(otherCatId) mustBe Seq.empty
        }
      }

      "... not for no category at all" in {
        dao.readOnlyTransaction { tx =>
          tx.loadPageNotfLevels(userOne.id, pageIdThree, None) mustBe PageNotfLevels(
            forPage = None,
            forCategory = None,
            forWholeSite = None)
        }
      }
    }


    "can config category notf prefs, for many cats" - {
      "configure" in {
        dao.readWriteTransaction { tx =>
          tx.upsertPageNotfPref(PageNotfPref(
            userOne.id,
            pagesInCategoryId = Some(otherCatId),
            notfLevel = TopicSolved))
        }
      }

      "find again" in {
        dao.readOnlyTransaction { tx =>
          tx.loadPageNotfLevels(userOne.id, pageIdThree, Some(otherCatId)) mustBe PageNotfLevels(
            forPage = None,
            forCategory = Some(TopicSolved),
            forWholeSite = None)
        }
      }

      "didn't overwrite the 1st cat's notf level" in {
        dao.readOnlyTransaction { tx =>
          tx.loadPageNotfLevels(userOne.id, pageIdThree, Some(defCatId)) mustBe PageNotfLevels(
            forPage = None,
            forCategory = Some(TopicProgress),
            forWholeSite = None)
        }
      }
    }


    "can edit category notf prefs" - {
      "insert notf prefs, for a category" in {
        dao.readWriteTransaction { tx =>
          tx.upsertPageNotfPref(PageNotfPref(
            userOne.id,
            pageId = None,
            pagesInCategoryId = Some(defCatId),
            notfLevel = WatchingFirst))
        }
      }

      "see the edits" in {
        dao.readOnlyTransaction { tx =>
          tx.loadPageNotfLevels(userOne.id, pageIdThree, Some(defCatId)) mustBe PageNotfLevels(
            forPage = None,
            forCategory = Some(WatchingFirst),
            forWholeSite = None)
        }
      }

      "didn't edit the 2nd cat's notf level" in {
        dao.readOnlyTransaction { tx =>
          tx.loadPageNotfLevels(userOne.id, pageIdThree, Some(otherCatId)) mustBe PageNotfLevels(
            forPage = None,
            forCategory = Some(NotfLevel.TopicSolved),
            forWholeSite = None)
        }
      }
    }


    // ----- Whole site


    "can config notf prefs, for whole site" - {
      var pref: PageNotfPref = null

      "insert notf prefs, for the whole site" in {
        dao.readWriteTransaction { tx =>
          pref = PageNotfPref(userOne.id, wholeSite = true, notfLevel = Muted)
          tx.upsertPageNotfPref(pref)
        }
      }

      "find again" in {
        dao.readOnlyTransaction { tx =>
          tx.loadPageNotfLevels(userOne.id, pageIdThree, None) mustBe PageNotfLevels(
            forPage = None,
            forCategory = None,
            forWholeSite = Some(Muted))
          tx.loadPageNotfPrefsOnSite().toSet mustBe Set(ownersSitePref, pref)
        }
      }

      "... not for the wrong user" in {
        dao.readOnlyTransaction { tx =>
          tx.loadPageNotfLevels(userTwo.id /* wrong */, pageIdThree, None) mustBe PageNotfLevels()
        }
      }

      "didn't overwrite any other notf prefs" in {
        checkDidntOverwritePageAndCatsPrefs(siteNotfLevel = Some(Muted))
      }
    }

    def checkDidntOverwritePageAndCatsPrefs(siteNotfLevel: Option[NotfLevel]) {
      dao.readOnlyTransaction { tx =>
        tx.loadPageNotfLevels(userOne.id, pageIdOne, None) mustBe PageNotfLevels(
          forPage = Some(Hushed),
          forWholeSite = siteNotfLevel)
        tx.loadPageNotfLevels(userOne.id, pageIdTwo, None) mustBe PageNotfLevels(
          forPage = Some(WatchingAll),
          forWholeSite = siteNotfLevel)
        tx.loadPageNotfLevels(userOne.id, pageIdThree, Some(defCatId)) mustBe PageNotfLevels(
          forCategory = Some(WatchingFirst),
          forWholeSite = siteNotfLevel)
        tx.loadPageNotfLevels(userOne.id, pageIdThree, Some(otherCatId)) mustBe PageNotfLevels(
          forCategory = Some(TopicSolved),
          forWholeSite = siteNotfLevel)
      }
    }

    "can edit site notf prefs" - {
      "update notf prefs, for the whole site" in {
        dao.readWriteTransaction { tx =>
          tx.upsertPageNotfPref(
              PageNotfPref(userOne.id, wholeSite = true, notfLevel = WatchingAll))
        }
      }

      "find again" in {
        dao.readOnlyTransaction { tx =>
          tx.loadPageNotfLevels(userOne.id, pageIdThree, None) mustBe PageNotfLevels(
            forWholeSite = Some(WatchingAll))
        }
      }

      "... not for the wrong user" in {
        dao.readOnlyTransaction { tx =>
          tx.loadPageNotfLevels(userTwo.id /* wrong */, pageIdThree, None) mustBe PageNotfLevels()
        }
      }

      "didn't overwrite any other notf prefs" in {
        checkDidntOverwritePageAndCatsPrefs(siteNotfLevel = Some(WatchingAll))
      }
    }


    // ----- All together


    "can load page, cat and whole site notf levels at once" - {
      "do load" in {
        dao.readOnlyTransaction { tx =>
          tx.loadPageNotfLevels(userOne.id, pageIdOne, Some(defCatId)) mustBe PageNotfLevels(
            forPage = Some(Hushed),
            forCategory = Some(WatchingFirst),
            forWholeSite = Some(WatchingAll))
        }
      }
    }


    // ----- Delete a notf pref


    "can delete a notf pref" in {
      dao.readWriteTransaction { tx =>
        tx.deletePageNotfPref(
          PageNotfPref(userOne.id, pagesInCategoryId = Some(defCatId),
            // The level doesn't matter.
            notfLevel = Muted))

        info("It's gone, when loading levels")
        tx.loadPageNotfLevels(userOne.id, pageIdOne, Some(defCatId)) mustBe PageNotfLevels(
          forPage = Some(Hushed),
          forCategory = None,   // was WatchingFirst, see above
          forWholeSite = Some(WatchingAll))
      }
    }

  }

}

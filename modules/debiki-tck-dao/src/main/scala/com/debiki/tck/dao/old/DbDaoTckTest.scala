/**
 * Copyright (C) 2011-2013 Kaj Magnus Lindberg (born 1979)
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

package com.debiki.tck.dao.old

import com.debiki.core
import com.debiki.core._
import com.debiki.core.DbDao._
import com.debiki.core.Prelude._
import com.debiki.core.{PostActionPayload => PAP}
import com.debiki.core.EmailNotfPrefs.EmailNotfPrefs
import java.{util => ju}
import org.specs2.execute.FailureException
import org.specs2.mutable._
import org.specs2.matcher.ThrownMessages
import org.specs2.execute.Failure
import scala.collection.{mutable => mut}
import scala.util.control.Breaks._
import DebikiSpecs._
import DbDaoTckTest._
import PageParts.UnassignedId
import PageParts.UnassignedId2
import PageParts.UnassignedId3
import PageParts.UnassignedId4


/*

======================================
 Technology Compatibility Kit (TCK)  -- OLD
======================================

---
Don't add any more tests to this huge monolithic test suite, add new test to
the ScalaTest based suites in the parent folder instead.
---

1. Dependent project configuration requirement:

By naming specs ChildSpec and including in debiki-dao-pgsqlq config file this snippet:

testOptions := Seq(Tests.Filter(s =>
  s.endsWith("Spec") && !s.endsWith("ChildSpec")))

we're telling Specs2 not to instantiate and run the ChildSpec:s many times.
(So I've added that snippet to build.sbt in debiki-dao-pgsql, for now.
I don't know how to place it here in debiki-tck-dao have it affect *dependent*
projects.


2. Test design, including tests of upgrades:

For each released database structure version:
  1. execute the test suite (for that old version)
  2. upgrade to the most recent version
  3. execute the test suite (for the most recent version)
      revert the upgrade (e.g. revert to a restore point) so the schema
      remains unchanged, although an upgrade was tested.

The test suite for a certain version requires two schemas:
  - One completely empty
  - One with fairly much contents (for performance tests)

Could test:
   Many server instances (i.e. many DAOs) access the database at the
   same time, only one DAO should do the upgrade.

*/


class TestContext(val dbDaoFactory: DbDaoFactory) {
  def shutdown() {
    dbDaoFactory.shutdown()
  }
}



trait TestContextBuilder {
  def buildTestContext(what: DbDaoTckTest.What, schemaVersion: String)
        : TestContext
}



object DbDaoTckTest {
  sealed class What
  case object EmptySchema extends What
  case object EmptyTables extends What
  case object TablesWithData extends What
}



abstract class DbDaoTckTest(builder: TestContextBuilder)
    extends Specification {

  sequential

  inline({
      // Need to empty the schema automatically before enabling this test?
      //new DaoSpecEmptySchema(builder),
      new DbDaoV002ChildSpec(builder)})
}



abstract class DbDaoChildSpec(
  builder: TestContextBuilder,
  val defSchemaVersion: String)
  extends Specification with ThrownMessages {

  sequential

  private var _ctx: TestContext = _
  def ctx = _ctx

  // Take a lazy TestContext so it's not created before any existing _ctx has been shutdown.
  def setNewTestContext(newTestContext: => TestContext) {
    if (_ctx ne null) _ctx.shutdown()
    _ctx = newTestContext
  }

  def newTenantDbDao(quotaConsumers: QuotaConsumers) =
    ctx.dbDaoFactory.newSiteDbDao(quotaConsumers)

  def systemDbDao = ctx.dbDaoFactory.systemDbDao

  def waitUntilSearchEngineStarted() {
    ctx.dbDaoFactory.debugWaitUntilSearchEngineStarted()
  }

  def refreshFullTextSearchIndexes() {
    ctx.dbDaoFactory.debugRefreshSearchEngineIndexer()
  }

  def now = new ju.Date

  // -------------
  // I've replaced this with `step`s in DaoSpecV002 below (but they don't work though).
  // -------------
  // "SUS" means Systems under specification, which is a
  // "The system" should { ...examples... } block.
  // See: <http://code.google.com/p/specs/wiki/DeclareSpecifications
  //        #Systems_under_specification>
  //def setup(what: What, version: String = defSchemaVersion) = new Context {
  //  beforeSus({
  //    ctx = builder(what, version)
  //  })
  //}

  // close the dao and any db connections after each tests.
  // see: <http://code.google.com/p/specs/wiki/declarespecifications
  //                #specification_context>
  // (without `close()', the specs test framework says:
  // "[error] could not run test com.debiki.core.oracledaotcktest:
  // org.specs.specification.pathexception: treepath(list(0, 0, 1))
  // not found for <the test name>")
  //new SpecContext {
  //  afterSus({
  //    if (ctx ne null) ctx.close()
  //  })
  //}
  // -------------
  // -------------

  //object SLog extends org.specs.log.ConsoleLog  // logs nothing! why?

}


/*
class DaoSpecEmptySchema(b: TestContextBuilder) extends DbDaoChildSpec(b, "0") {
  val schemaIsEmpty = setup(EmptySchema)

  "A DAO in a completely empty repo" when schemaIsEmpty should {
    "consider the version being 0" in {
      systemDbDao.checkRepoVersion() must_== Some("0")
    }
    "be able to upgrade to 0.0.2" in {
      // dao.upgrade()  currently done automatically, but ought not to.
      systemDbDao.checkRepoVersion() must_== Some("0.0.2")
    }
  }
} */



object Templates {

  val guestLoginAttempt = GuestLoginAttempt(
    ip = "1.1.1.1", date = new ju.Date,
    name = "Målligan", email = "no@email.no", location = "", website = "")

  val openIdLoginAttempt = OpenIdLoginAttempt(
    ip = "1.1.1.1", date = new ju.Date,
    OpenIdDetails(
      oidEndpoint = "provider.com/endpoint", oidVersion = "2",
      oidRealm = "example.com", oidClaimedId = "claimed-id.com",
      oidOpLocalId = "provider.com/local/id",
      firstName = "Laban", email = Some("oid@email.hmm"), country = "Sweden"))

  val post = RawPostAction.forNewPost(id = UnassignedId, creationDati = new ju.Date,
    userIdData = UserIdData.newTest(userId = "?"),
    parentPostId = Some(PageParts.BodyId),
    text = "", approval = None)

}



class DbDaoV002ChildSpec(testContextBuilder: TestContextBuilder)
    extends DbDaoChildSpec(testContextBuilder, "0.0.2") {

  sequential  // so e.g. loginId inited before used in ctors

  val T = Templates

  def throwFailure(x: String) =
    throw new FailureException(Failure(x))

  step {
    // It takes so terribly long to compile this huge file, so it's interesting
    // to know when:
    println("***** Starting tests *****")
    setNewTestContext(
      testContextBuilder.buildTestContext(EmptyTables, defSchemaVersion))
  }

  // COULD split into: 3 tests:
  // Login tests: guestLoginAttempt, openIdLoginAttempt.
  // Page tests: create page, reply, update.
  // Path tests: lookup GUID, handle missing/superfluous slash.

  "A DAO in an empty 0.0.2 repo" can {

    //sequential  // so e.g. loginId inited before used in ctors
    // Should be placed at start of Spec only?

    lazy val ex1_postText = "postText0-3kcvxts34wr"
    var testPage: PageNoPath = null
    var guestUser: User = null


    // -------- Create tenant

    val defaultTenantId = "1"

    "find no tenant for non-existing host test.ex.com" in {
      val lookup = systemDbDao.lookupTenant("http", "test.ex.com")
      lookup must_== FoundNothing
    }

    "find no tenant for non-existing tenant id" in {
      systemDbDao.loadTenants("non_existing_id"::Nil) must_== Nil
    }

    lazy val dao = newTenantDbDao(QuotaConsumers(tenantId = defaultTenantId))

    "lookup test tenant host test.ex.com" in {
      val lookup = systemDbDao.lookupTenant("http", "test.ex.com")
      lookup must_== FoundChost(defaultTenantId)
      val lookup2 = dao.lookupOtherTenant("http", "test.ex.com")
      lookup2 must_== FoundChost(defaultTenantId)
    }

    "lookup tenant by id, and find all hosts" in {
      val tenants = systemDbDao.loadTenants(defaultTenantId::Nil)
      tenants must be like {
        case List(tenant) =>
          tenant.id must_== defaultTenantId
          tenant.name must_== Some("Test")
          tenant.embeddingSiteUrl must_== None
          tenant.hosts must_== List(TenantHost(
             "test.ex.com", TenantHost.RoleCanonical, TenantHost.HttpsNone))
        case x =>
          ko(s"Found wrong tenants: $x")
      }
    }

    lazy val defaultPagePath = PagePath(defaultTenantId, "/folder/",
                                    None, false, "page-title")


    // -------- Generate page ids

    "generate next page id" in {
      val nextId = dao.nextPageId()
      val nextNextId = dao.nextPageId()
      nextId must_== "1"
      nextNextId must_== "2"
    }


    // -------- Simple logins

    "throw error for an invalid login id" in {
      val debateBadLogin = PageParts(guid = "?", rawActions =
          RawPostAction.copyCreatePost(T.post, id = PageParts.BodyId, parentPostId = None,
            userId = "99999")::Nil) // bad ids
      //SLog.info("Expecting ORA-02291: integrity constraint log message ------")
      dao.createPage(Page.newPage(
        PageRole.WebPage, defaultPagePath, debateBadLogin, author = SystemUser.User)
                    ) must throwAn[Exception]
      //SLog.info("------------------------------------------------------------")
    }

    "list no users when there are none" in {
      dao.listUsers(UserQuery()) must_== Nil
    }

    "save an IdentitySimple login" in {
      guestUser = dao.loginAsGuest(T.guestLoginAttempt).user
      guestUser must matchUser(
          displayName = "Målligan", email = "no@email.no")
      guestUser.id must startWith("-") // dummy user ids start with -
    }

    "list simple user" in {
      dao.listUsers(UserQuery()) must_== List((guestUser, List("Guest")))
    }

    lazy val globalUserId = guestUser.id

    "reuse the IdentitySimple and User" in {
      val loginReq = T.guestLoginAttempt.copy(date = new ju.Date) // same guest
      val guest2 = dao.loginAsGuest(loginReq).user
      guest2 must_== guestUser
    }

    "create a new dummy User for an IdentitySimple with different website" in {
      val loginReq = T.guestLoginAttempt.copy(date = new ju.Date, website = "weirdplace")
      val guest2 = dao.loginAsGuest(loginReq).user
      // New user because website changed.  COULD: create matchIdentity()
      guest2.id must_!= guestUser.id
      guest2.displayName must_== "Målligan"
      guest2.website must_== "weirdplace"
      guest2 must matchUser(guestUser, id = guest2.id, website = "weirdplace")
    }

    //"have exactly one user" in {  // no, 2??
    //}

    "create a new User for an IdentitySimple with different email" in {
      val loginAttempt = T.guestLoginAttempt.copy(date = new ju.Date, email = "other@email.yes")
      val guest2 = dao.loginAsGuest(loginAttempt).user
      // New user because email changed.
      guest2.id must_!= guestUser.id
      guest2.displayName must_== "Målligan"
      guest2.email must_== "other@email.yes"
      // New user because email has changed.
      // (For an IdentitySimple, email+name identifies the user.)
      guest2 must matchUser(guestUser, id = guest2.id, email = "other@email.yes")
     }

    "create a new User for an IdentitySimple with different name" in {
      val loginAttempt = T.guestLoginAttempt.copy(date = new ju.Date, name = "Spöket Laban")
      val guest2 = dao.loginAsGuest(loginAttempt).user
      // New user because name changed.
      guest2.id must_!= guestUser.id
      guest2.displayName must_== "Spöket Laban"
      guest2.email must_== "no@email.no"
      guest2 must matchUser(guestUser, id = guest2.id, displayName = "Spöket Laban")
    }

    // "create a new User for an IdentitySimple, for another tenant" in {
    // }


    // -------- List no pages

    "list no pages, if there are none" in {
      val pagePathsDetails = dao.listPagePaths(
        PathRanges(trees = Seq("/")),  // all pages
        include = PageStatus.All,
        orderOffset = PageOrderOffset.ByPath,
        limit = Int.MaxValue)
      pagePathsDetails.length must_== 0
    }


    "list no posts, when there are none" in {
      dao.loadPostsRecentlyActive(limit = 10, offset = 0)._1 must beEmpty
    }


    // -------- Page creation

    lazy val ex1_rootPost = RawPostAction.copyCreatePost(T.post,
      id = PageParts.BodyId, parentPostId = None,
      userId = globalUserId, text = ex1_postText)

    "create a debate with a root post" in {
      val debateNoId = PageParts(guid = "?", rawActions = ex1_rootPost::Nil)
      val page = dao.createPage(Page.newPage(
        PageRole.WebPage, defaultPagePath, debateNoId, publishDirectly = true,
        author = guestUser))
      val actions = page.parts
      testPage = page.withoutPath
      actions.postCount must_== 1
      actions.pageId must not(beEmpty)
      actions.pageId must not(be("?"))
      actions must havePostLike(ex1_rootPost)
      page.meta.cachedAuthorDispName must_== guestUser.displayName
      page.meta.cachedAuthorUserId must_== guestUser.id
      page.meta.cachedNumPosters must_== 0
      page.meta.cachedNumActions must_== 1
      page.meta.cachedNumPostsDeleted must_== 0
      page.meta.cachedNumRepliesVisible must_== 0
      page.meta.cachedNumPostsToReview must_== 1
      page.meta.cachedNumChildPages must_== 0
      page.meta.cachedLastVisiblePostDati must_== None
    }

    "find the debate and the post again" in {
      dao.loadPageParts(testPage.id) must beLike {
        case Some(d: PageParts) => {
          d must havePostLike(ex1_rootPost)
        }
      }
    }

    "find the debate and the login and user again" in {
      dao.loadPageParts(testPage.id) must beLike {
        case Some(page: PageParts) => {
          page.people.user(ex1_rootPost.userId) must beLike {
            case Some(user: User) =>
              user.id must_== ex1_rootPost.userId
              user must matchUser(displayName = "Målligan", email = "no@email.no")
          }
        }
      }
    }


    // -------- List one page

    "list the recently created page" in {
      val pagePathsDetails = dao.listPagePaths(
        PathRanges(trees = Seq("/")),
        include = PageStatus.All,
        orderOffset = PageOrderOffset.ByPath,
        limit = Int.MaxValue)
      pagePathsDetails must beLike {
        case List(PagePathAndMeta(pagePath, _, pageDetails)) =>
          pagePath must_== defaultPagePath.copy(pageId = pagePath.pageId)
          // When I've implemented Draft/Published status, Draft will be
          // the default:
          pageDetails.status must_== PageStatus.Published
          // There page currently has no title.
          // It's published by default though.
          pageDetails.cachedTitle must_== None
          pageDetails.pubDati must_!= None
          // Shouldn't the page body post affect the
          // significant-modification-time?
          // pageDetails.sgfntModDati must_== None  -- or Some(date)?
      }
    }

    "list nothing for an empty list" in {
      val pathsAndPages = dao.loadPageBodiesTitles(Nil)
      pathsAndPages must beEmpty
    }

    "list no body and title, for a non-existing page" in {
      dao.loadPageBodiesTitles("nonexistingpage"::Nil) must beEmpty
    }

    "list body and title, for a page that exists" in {
      val pathAndDetails = dao.listPagePaths(
        PathRanges(trees = Seq("/")),
        include = PageStatus.All,
        orderOffset = PageOrderOffset.ByPath,
        limit = Int.MaxValue)
      pathAndDetails.length must be_>=(1)
      val path: PagePath = pathAndDetails.head.path

      val pathsAndPages = dao.loadPageBodiesTitles(path.pageId.get::Nil)
      pathsAndPages.size must_== 1
      pathsAndPages.get(path.pageId.get) must be like { case Some(page) =>
        val bodyText = page.body.map(_.currentText)
        bodyText must beSome
        bodyText.get.length must be_>(0)
        page.body_!.user must beSome

        /* Currently there is no title for the test page.
        page.title must beSome
        page.titleText.get.length must be_>(0)
        page.title_!.user must beSome
        */
      }
    }


    "list the posts, it's recently active " in {
      dao.loadPostsRecentlyActive(limit = 10, offset = 0)._1 must beLike {
        case List(post: Post) =>
          post.id must_== ex1_rootPost.id
      }
    }


    // -------- Page meta info

    "create, load and save meta info" >> {

      var blogMainPageId = "?"
      var blogArticleId = "?"
      val blogUrl = "http://blog.example.com"

      "create a Blog" in {
        val pageNoId = Page(
          PageMeta.forNewPage(
            PageRole.Blog, guestUser, PageParts("?"), now, url = Some(blogUrl)),
          defaultPagePath.copy(
            showId = true, pageSlug = "role-test-blog-main"),
          ancestorIdsParentFirst = Nil,
          PageParts(guid = "?"))

        pageNoId.meta.pageExists must_== false
        val page = dao.createPage(pageNoId)

        page.meta.pageExists must_== true
        page.meta.pageRole must_== PageRole.Blog
        page.meta.parentPageId must_== None
        page.meta.embeddingPageUrl must_== Some(blogUrl)
        page.meta.pubDati must_== None

        val actions = page.parts
        blogMainPageId = actions.pageId
        actions.postCount must_== 0
        actions.pageId must not(beEmpty)
        actions.pageId must not(be("?"))
      }

      "look up meta info for the Blog, find no child pages" in {
        dao.loadPageMeta(blogMainPageId) must beLike {
          case Some(pageMeta: PageMeta) => {
            pageMeta.pageExists must_== true
            pageMeta.pageRole must_== PageRole.Blog
            pageMeta.parentPageId must_== None
            pageMeta.embeddingPageUrl must_== Some(blogUrl)
            pageMeta.pageId must_== blogMainPageId
            pageMeta.pubDati must_== None
            pageMeta.cachedNumChildPages must_== 0
          }
        }
      }

      "create a child BlogPost" in {
        val pageNoId = Page(
          PageMeta.forNewPage(PageRole.BlogPost, guestUser, PageParts("?"), now,
            parentPageId = Some(blogMainPageId)),
          defaultPagePath.copy(
            showId = true, pageSlug = "role-test-blog-article"),
          ancestorIdsParentFirst = blogMainPageId::Nil,
          PageParts(guid = "?"))
        val page = dao.createPage(pageNoId)
        val actions = page.parts
        blogArticleId = actions.pageId
        actions.postCount must_== 0
        actions.pageId must not(beEmpty)
        actions.pageId must not(be("?"))
      }

      "look up meta info for the Blog again, find one child page" in {
        dao.loadPageMeta(blogMainPageId) must beLike {
          case Some(pageMeta: PageMeta) => {
            pageMeta.pageId must_== blogMainPageId
            pageMeta.cachedNumChildPages must_== 1
          }
        }
      }

      "look up meta info for the BlogPost" in {
        dao.loadPageMeta(blogArticleId) must beLike {
          case Some(pageMeta: PageMeta) => {
            pageMeta.pageRole must_== PageRole.BlogPost
            pageMeta.parentPageId must_== Some(blogMainPageId)
            pageMeta.embeddingPageUrl must_== None
            pageMeta.pageId must_== blogArticleId
            pageMeta.pubDati must_== None
          }
        }
      }

      "find no child pages of a non-existing page" in {
        val childs = dao.listChildPages(Seq("doesNotExist"),
          PageOrderOffset.ByPublTime, limit = 10)
        childs.length must_== 0
      }

      "find no child pages of a page with no children" in {
        val childs = dao.listChildPages(Seq(blogArticleId),
          PageOrderOffset.ByPublTime, limit = 10)
        childs.length must_== 0
      }

      def testBlogArticleMeta(meta: PageMeta) = {
        meta.pageId must_== blogArticleId
        meta.pageRole must_== PageRole.BlogPost
        meta.parentPageId must_== Some(blogMainPageId)
      }

      def testFoundChild(childs: Seq[PagePathAndMeta]) {
        childs.length must_== 1
        childs must beLike {
          case List(PagePathAndMeta(pagePath, ancestorIdsParentFirst, pageMeta)) =>
            pagePath.pageId must_== Some(blogArticleId)
            testBlogArticleMeta(pageMeta)
            ancestorIdsParentFirst must_== List(blogMainPageId)
        }
      }

      "find child pages of the Blog" in {
        val childs = dao.listChildPages(Seq(blogMainPageId),
          PageOrderOffset.ByPublTime, limit = 10)
        testFoundChild(childs)
        ok
      }

      "find child pages also when page role specified" in {
        val childs = dao.listChildPages(Seq(blogMainPageId),
          PageOrderOffset.ByPublTime, limit = 10,
          filterPageRole = Some(PageRole.BlogPost))
        testFoundChild(childs)
        ok
      }

      "find no child pages of the wrong page role" in {
        val childs = dao.listChildPages(Seq(blogMainPageId),
          PageOrderOffset.ByPublTime, limit = 10,
          filterPageRole = Some(PageRole.ForumTopic))
        childs.length must_== 0
      }

      "can update meta info, and parent page child count"  in {
        val blogArticleMeta: PageMeta = dao.loadPageMeta(blogArticleId) match {
          case Some(pageMeta: PageMeta) =>
            testBlogArticleMeta(pageMeta) // extra test
            pageMeta
          case x => throwFailure(s"Bad meta: $x")
        }
        // Edit meta (but not page role, cannot be changed)
        val nextDay = new ju.Date(
          blogArticleMeta.modDati.getTime + 1000 * 3600 * 24)
        val newMeta = blogArticleMeta.copy(
          parentPageId = None,
          embeddingPageUrl = Some("http://new-blog-post-url.example.com"),
          modDati = nextDay,
          pubDati = Some(nextDay),
          // Use stupid incorrect values here, just for testing.
          cachedTitle = Some("NewCachedPageTitle"),
          cachedAuthorDispName = "cachedAuthorDispName",
          cachedAuthorUserId = "cachedAuthorUserId",
          cachedNumPosters = 11,
          cachedNumActions = 12,
          cachedNumPostsToReview = 13,
          cachedNumPostsDeleted = 14,
          cachedNumRepliesVisible = 15,
          cachedLastVisiblePostDati = Some(new ju.Date(12345)),
          cachedNumChildPages = 17)

        dao.updatePageMeta(newMeta, old = blogArticleMeta)

        // Reload and test
        dao.loadPageMeta(blogArticleId) must beLike {
          case Some(meta2: PageMeta) =>
            meta2 must_== newMeta
        }

        // The former parent page's meta should also have changed:
        dao.loadPageMeta(blogMainPageId) must beLike {
          case Some(pageMeta: PageMeta) => {
            pageMeta.pageId must_== blogMainPageId
            pageMeta.cachedNumChildPages must_== 0
          }
        }

        // Change parent back to the old one.
        val newMetaOldParent = newMeta.copy(parentPageId = blogArticleMeta.parentPageId)
        dao.updatePageMeta(newMetaOldParent, old = newMeta)

        // Now the former parent page's child count should be 1 again.
        dao.loadPageMeta(blogMainPageId) must beLike {
          case Some(pageMeta: PageMeta) => {
            pageMeta.pageId must_== blogMainPageId
            pageMeta.cachedNumChildPages must_== 1
          }
        }
      }

      "cannot change page role" in {
        val blogArticleMeta = dao.loadPageMeta(blogArticleId) match {
          case Some(pageMeta: PageMeta) => pageMeta
          case x => throwFailure(s"Bad meta: $x")
        }
        val newMeta = blogArticleMeta.copy(pageRole = PageRole.ForumCategory)
        dao.updatePageMeta(
          newMeta, old = blogArticleMeta) must throwA[PageNotFoundByIdAndRoleException]
      }

    }


    // -------- Forums

    "create forums and topics" >> {

      "pending after I changed ForumGroup+Forum to Forum+ForumCategory" in {
        pending
      }
      /*
      var forum: Page = null
      var topic: Page = null
      var forumGroup: Page = null

      def forumStuff(
            pageRole: PageRole,
            parentPageId: Option[String] = None,
            pageSlug: String = "forum-or-topic",
            showId: Boolean = true): Page =
        Page(
          PageMeta.forNewPage(pageRole, loginGrant.user, PageParts("?"), now,
            parentPageId = parentPageId),
          defaultPagePath.copy(folder = "/forum/", showId = showId, pageSlug = pageSlug),
          ancestorIdsParentFirst = parentPageId.toList,
          PageParts(guid = "?"))

      "create a forum" in {
        val forumNoId = forumStuff(PageRole.ForumCategory, pageSlug = "", showId = false)
        forum = dao.createPage(forumNoId)
        ok
      }

      "not create a forum in the forum" in {
        val subforumNoId = forumStuff(PageRole.ForumCategory, Some(forum.id))
        dao.createPage(subforumNoId) must throwAn[Exception]
      }

      "not create a forum group in the forum" in {
        val groupNoId = forumStuff(PageRole.Forum, Some(forum.id))
        dao.createPage(groupNoId) must throwAn[Exception]
      }

      "create a topic in the forum" in {
        val topicNoId = forumStuff(PageRole.ForumTopic, Some(forum.id))
        topic = dao.createPage(topicNoId)
        ok
      }

      "not create a topic in a topic" in {
        val topicInTopic = forumStuff(PageRole.ForumTopic, Some(topic.id))
        dao.createPage(topicInTopic) must throwAn[Exception]
      }

      "not create a forum in a topic" in {
        val forumInTopic = forumStuff(PageRole.ForumCategory, Some(topic.id))
        dao.createPage(forumInTopic) must throwAn[Exception]
      }

      "not create a forum group in a topic" in {
        val groupInTopic = forumStuff(PageRole.Forum, Some(topic.id))
        dao.createPage(groupInTopic) must throwAn[Exception]
      }

      "create a forum group P, place the original forum inside" in {
        var forumGroupNoId = forumStuff(PageRole.Forum, pageSlug = "forum-group")
        forumGroup = dao.createPage(forumGroupNoId)
        val forumBefore = forum
        forum = forumBefore.copyWithNewAncestors(forumGroup.id::Nil)
        dao.updatePageMeta(forum.meta, old = forumBefore.meta)
        ok
      }

      "not create a topic in a forum group" in {
        failure
      }.pendingUntilFixed()

      "create a forum group C, place in forum group P" in {
        failure
      }.pendingUntilFixed()

      "create a forum, place in forum group C" in {
        failure
      }.pendingUntilFixed()

      "find the forum, topic and forum group" in {
        dao.loadPageMeta(forum.id) must beLike {
          case Some(pageMeta) =>
            pageMeta.pageRole must_== PageRole.ForumCategory
            pageMeta.parentPageId must_== Some(forumGroup.id)
        }

        dao.loadPageMeta(topic.id) must beLike {
          case Some(pageMeta) =>
            pageMeta.pageRole must_== PageRole.ForumTopic
            pageMeta.parentPageId must_== Some(forum.id)
        }

        dao.loadPageMeta(forumGroup.id) must beLike {
          case Some(pageMeta) =>
            pageMeta.pageRole must_== PageRole.Forum
            pageMeta.parentPageId must_== None
        }
        ok
      }

      "can load ancestors of the forum group (there are none)" in {
        val ancestorIds = dao.loadAncestorIdsParentFirst(forumGroup.id)
        ancestorIds must_== Nil
      }

      "can load ancestors of the forum (i.e. the forum group)" in {
        val ancestorIds = dao.loadAncestorIdsParentFirst(forum.id)
        ancestorIds must_== List(forumGroup.id)
      }

      "can load ancestors of the forum topic (i.e. the forum and the forum group)" in {
        val ancestorIds = dao.loadAncestorIdsParentFirst(topic.id)
        ancestorIds must_== List(forum.id, forumGroup.id)
      }

      "can load ancestors, when listing child pages" in {
        val forumChilds = dao.listChildPages(Seq(forum.id), PageOrderOffset.ByPublTime, limit = 10)
        forumChilds.length must_== 1
        forumChilds must beLike {
          case List(PagePathAndMeta(_, ancestorIdsParentFirst, _)) =>
            ancestorIdsParentFirst must_== List(forum.id, forumGroup.id)
        }
        ok
      }

      /*
      "can batch load ancestors of the forum topic, the forum and the forum group" in {
        val ancestorIdsByPageId = dao.batchLoadAncestorIdsParentFirst(List(
          topic.id, forum.id, forumGroup.id)
        ancestorIdsByPageId.size() must_== 3
        ancestorIdsByPageId.get(topic.id) must_== Some(List(forum.id, forumGroup.id))
        ancestorIdsByPageId.get(forum.id) must_== Some(List(forumGroup.id))
        ancestorIdsByPageId.get(forumGrouop.id) must_== Some(Nil)
      } */
      */
    }


    // -------- Page settings

    "load and save page settings" >> {

      var forum: Page = null
      var topic: Page = null

      def forumPage(pageRole: PageRole, parentPageId: Option[String] = None): Page =
        Page(
          PageMeta.forNewPage(pageRole, guestUser, PageParts("?"), now, parentPageId),
          defaultPagePath.copy(folder = "/settings-forum/", showId = true,
            pageSlug = pageRole.toString),
          ancestorIdsParentFirst = parentPageId.toList,
          PageParts(guid = "?"))

      "create a forum and a topic" in {
        val forumNoId = forumPage(PageRole.ForumCategory)
        forum = dao.createPage(forumNoId)
        val topicNoId = forumPage(PageRole.ForumTopic, parentPageId = Some(forum.id))
        topic = dao.createPage(topicNoId)
        ok
      }

      "find no settings before any settings created" in {
        var rawSettings = Seq(dao.loadSiteSettings())
        rawSettings.head.valuesBySettingName.isEmpty must_== true

        rawSettings = dao.loadSettings(Seq(SettingsTarget.PageTree(forum.id)))
        rawSettings.length must_== 1
        rawSettings.head.valuesBySettingName.isEmpty must_== true

        rawSettings = dao.loadSettings(Seq(
          SettingsTarget.SinglePage(topic.id), SettingsTarget.PageTree(forum.id)))
        rawSettings.length must_== 2
        rawSettings.foreach { settings =>
          settings.valuesBySettingName.isEmpty must_== true
        }
        ok
      }

      "save and load site settings" >> {
        "of type text" in {
          dao.saveSetting(SettingsTarget.WholeSite, "SettingA" -> "TextValueA")
          dao.saveSetting(SettingsTarget.WholeSite, "SettingB" -> "TextValueB")
          val settings = dao.loadSiteSettings()
          settings.valuesBySettingName.get("SettingA") must_== Some("TextValueA")
          settings.valuesBySettingName.get("SettingB") must_== Some("TextValueB")
          settings.valuesBySettingName.get("AbsentSetting") must_== None
        }

        "of type integer" in {
          dao.saveSetting(SettingsTarget.WholeSite, "SettingC" -> 111)
          dao.saveSetting(SettingsTarget.WholeSite, "SettingD" -> 222)
          val settings = dao.loadSiteSettings()
          settings.valuesBySettingName.get("SettingC") must_== Some(111)
          settings.valuesBySettingName.get("SettingD") must_== Some(222)
        }

        "of type double" in {
          dao.saveSetting(SettingsTarget.WholeSite, "SettingE" -> 100.111)
          dao.saveSetting(SettingsTarget.WholeSite, "SettingF" -> 200.222)
          val settings = dao.loadSiteSettings()
          settings.valuesBySettingName.get("SettingE") must_== Some(100.111)
          settings.valuesBySettingName.get("SettingF") must_== Some(200.222)
        }

        "of type boolean" in {
          dao.saveSetting(SettingsTarget.WholeSite, "SettingTrue" -> true)
          dao.saveSetting(SettingsTarget.WholeSite, "SettingFalse" -> false)
          val settings = dao.loadSiteSettings()
          settings.valuesBySettingName.get("SettingTrue") must_== Some(true)
          settings.valuesBySettingName.get("SettingFalse") must_== Some(false)
        }
      }

      "save and load topic and section settings" >> {
        dao.saveSetting(SettingsTarget.SinglePage(topic.id), "SettingA" -> "PageTextValueA")
        dao.saveSetting(SettingsTarget.SinglePage(topic.id), "SettingC" -> 113)
        dao.saveSetting(SettingsTarget.SinglePage(topic.id), "SettingE" -> 100.113)
        dao.saveSetting(SettingsTarget.SinglePage(topic.id), "SettingTrue" -> true)
        dao.saveSetting(SettingsTarget.PageTree(forum.id), "SettingA" -> "ForumTextValueA")
        dao.saveSetting(SettingsTarget.PageTree(forum.id), "SettingC" -> 112)
        dao.saveSetting(SettingsTarget.PageTree(forum.id), "SettingE" -> 100.112)
        dao.saveSetting(SettingsTarget.PageTree(forum.id), "SettingFalse" -> false)
        val settings = dao.loadSettings(List(
          SettingsTarget.SinglePage(topic.id), SettingsTarget.PageTree(forum.id)))
        settings.length must_== 2
        settings.head.valuesBySettingName.get("SettingA") must_== Some("PageTextValueA")
        settings.head.valuesBySettingName.get("SettingC") must_== Some(113)
        settings.head.valuesBySettingName.get("SettingE") must_== Some(100.113)
        settings.head.valuesBySettingName.get("SettingTrue") must_== Some(true)
        settings.last.valuesBySettingName.get("SettingA") must_== Some("ForumTextValueA")
        settings.last.valuesBySettingName.get("SettingC") must_== Some(112)
        settings.last.valuesBySettingName.get("SettingE") must_== Some(100.112)
        settings.last.valuesBySettingName.get("SettingFalse") must_== Some(false)
      }

      "update settings" in {
        pending
      }

      "find no settings for non-existing page" in {
        val rawSettings = dao.loadSettings(Seq(SettingsTarget.PageTree("NonExistingPage")))
        rawSettings.length must_== 1
        rawSettings.head.valuesBySettingName.isEmpty must_== true
      }
    }


    // -------- Full text search

    "full text search forum contents" >> {

      var forumGroup: Page = null
      var categoryOne: Page = null
      var categoryTwo: Page = null
      var topicOne: Page = null
      var topicTwo: Page = null
      var genericPage: Page = null
      var forumWithHtml: Page = null

      val Aardvark = "aardvark"

      // Keep these four values in sync.
      val HtmlText = i"""
        |green grass
        |<small>tiny tools</small>
        |<img src="http://server/address">
        |crazy cat sleeps on mat
        |<mark>running mammoths</mark>
        |ignore &amp;"""
      val HtmlTagsAndAttributes = Seq(
        "small", "img", "src", "http", "server", "address", "mark", "amp")
      val HtmlExactPhrasesToFind = Seq(
        "green grass", "tiny tools", "crazy cats", "mammoths", "ignore")
      val HtmlInexactPhrasesToFind = Seq(
        "tool", "cats", "mats", "run", "runs", "mammoth", "ignores","ignoring", "ignored")

      def newPage(pageRole: PageRole, ancestorPageIds: List[PageId], pageSlug: String,
            posts: RawPostAction[PAP.CreatePost]*) =
        Page(
          PageMeta.forNewPage(pageRole, guestUser, PageParts("?"), now,
            parentPageId = ancestorPageIds.headOption),
          defaultPagePath.copy(folder = "/search-forum/", showId = true, pageSlug = pageSlug),
          ancestorIdsParentFirst = ancestorPageIds,
          PageParts(guid = "?", rawActions = posts.toList))

      def search(phrase: String, anyRootPageId: Option[PageId]): FullTextSearchResult = {
        import scala.concurrent.duration.Duration
        import scala.concurrent.Await
        val result = Await.result(
          dao.fullTextSearch(phrase, anyRootPageId),
          atMost = Duration(5, "sec"))
        result
      }

      "wait until search engine started" in {
        waitUntilSearchEngineStarted()
        ok
      }

      "create a forum, two categories with one topic each" in {
        val baseBody = RawPostAction.copyCreatePost(T.post,
          id = PageParts.BodyId, parentPostId = None, text = "search test forum body",
          userId = globalUserId, approval = Some(Approval.WellBehavedUser))

        val forumOneBody = RawPostAction.copyCreatePost(baseBody,
          text = s"SearchTest ForumOne, ForumPageBody, $Aardvark")

        val forumTwoBody = RawPostAction.copyCreatePost(baseBody,
          text = s"SearchTest ForumTwo, ForumPageBody, $Aardvark")

        val topicOneBody = RawPostAction.copyCreatePost(baseBody,
          text = s"SearchTest TopicOne, TopicPageBody, $Aardvark")

        val topicTwoBody = RawPostAction.copyCreatePost(baseBody,
          text = s"SearchTest TopicTwo, TopicPageBody, $Aardvark")

        val genericPageBody = RawPostAction.copyCreatePost(baseBody,
          text = s"SearchTest GenericPageBody, $Aardvark")

        val htmlForumBody = RawPostAction.copyCreatePost(baseBody,
          text = HtmlText)

        forumGroup = dao.createPage(newPage(
          PageRole.Forum, Nil, "forum"))

        categoryOne = dao.createPage(newPage(
          PageRole.ForumCategory, List(forumGroup.id), "category-one", forumOneBody))

        categoryTwo = dao.createPage(newPage(
          PageRole.ForumCategory, List(forumGroup.id), "category-two", forumTwoBody))

        topicOne = dao.createPage(newPage(
          PageRole.ForumTopic, List(categoryOne.id, forumGroup.id), "topic-one", topicOneBody))

        topicTwo = dao.createPage(newPage(
          PageRole.ForumTopic, List(categoryTwo.id, forumGroup.id), "topic-two", topicTwoBody))

        genericPage = dao.createPage(newPage(
          PageRole.WebPage, Nil, "web-page", genericPageBody))

        forumWithHtml = dao.createPage(newPage(
          PageRole.ForumCategory, Nil, "category-with-html", htmlForumBody))

        ok
      }

      "wait until everything has been indexed by the search engine" in {
        refreshFullTextSearchIndexes()
        ok
      }

      "search whole site" in {
        val result = search(Aardvark, anyRootPageId = None)
        result.hits.length must_== 5
        result.pageMetaByPageId.contains(categoryOne.id) must_== true
        result.pageMetaByPageId.contains(categoryTwo.id) must_== true
        result.pageMetaByPageId.contains(topicOne.id) must_== true
        result.pageMetaByPageId.contains(topicTwo.id) must_== true
        result.pageMetaByPageId.contains(genericPage.id) must_== true
      }

      "search forum, including two categories and two topics" in {
        val result = search(Aardvark, anyRootPageId = Some(forumGroup.id))
        result.hits.length must_== 4
        result.pageMetaByPageId.contains(categoryOne.id) must_== true
        result.pageMetaByPageId.contains(categoryTwo.id) must_== true
        result.pageMetaByPageId.contains(topicOne.id) must_== true
        result.pageMetaByPageId.contains(topicTwo.id) must_== true
      }

      "search one category, not find stuff in the other category" in {
        // Use same search phrase, but restrict the search to forumOne.
        val result = search(Aardvark, anyRootPageId = Some(categoryOne.id))
        result.hits.length must_== 2
        result.pageMetaByPageId.contains(topicOne.id) must_== true
        result.pageMetaByPageId.contains(categoryOne.id) must_== true

        val result2 = search(Aardvark, anyRootPageId = Some(categoryTwo.id))
        result2.hits.length must_== 2
        result2.pageMetaByPageId.contains(topicTwo.id) must_== true
        result2.pageMetaByPageId.contains(categoryTwo.id) must_== true
      }

      "find page title, page body and comments" in {
        pending
      }

      "not find unapproved posts" in {
        pending
      }

      "not find contents from other sites" in {
        pending
      }

      "not find unpublished pages" in {
        pending
      }

      def testSearchHtml(phrases: Seq[String], shallFind: Boolean) = {
        var errors = Vector[(String, Seq[PageId])]()
        for (phrase <- phrases) {
          val result = search(phrase, anyRootPageId = Some(forumWithHtml.id))
          def pageIds = result.hits.map(_.post.page.id)
          val ok =
            if (shallFind) result.hits.length == 1 && pageIds.head == forumWithHtml.id
            else result.hits.length == 0
          if (!ok)
            errors :+= ((phrase, pageIds))
        }

        if (errors.nonEmpty) {
          val errMess = errors map { case (phrase, pageIds) =>
            s"Found phrase ``$phrase'' on these pages: ${pageIds mkString ","}."
          } mkString "\n"
          fail(s"$errMess\nShould have been found on ${if (shallFind) 1 else 0} pages only.")
        }

        ok
      }

      "find exactly matching words in HTML text" in {
        testSearchHtml(HtmlExactPhrasesToFind, shallFind = true)
      }

      "find somewhat matching words in HTML text" in {
        testSearchHtml(HtmlInexactPhrasesToFind, shallFind = true)
      }

      "not find HTML tags and attributes" in {
        testSearchHtml(HtmlTagsAndAttributes, shallFind = false)
      }

      "automatically index posts that need to be indexed, in the background" in {
        // Unindex the posts, verify they are not found when searching, then wait
        // for a while until the server automatically indexes them in the background.

        // 1. Sometimes the server will happen to reindex the un-indexed posts
        // just after they were unindexed. Then we unindex them again, and again
        // try to verify that they aren't found. Hence the first while loop.
        // 2. It usually takes a while before the server has indexed them,
        // hence the second while loop.

        breakable {
          while (true) {
            dao.debugUnindexPosts(
              PagePostId(categoryOne.id, PageParts.BodyId),
              PagePostId(topicOne.id, PageParts.BodyId))

            val result = search(Aardvark, anyRootPageId = Some(categoryOne.id))
            val gone = result.hits.isEmpty
            if (gone)
              break
          }
        }

        // Now the posts are not indexed. Wait until some background
        // process indexes them again.
        breakable {
          while (true) {
            val result = search(Aardvark, anyRootPageId = Some(categoryOne.id))
            if (result.hits.length == 2) {
              result.pageMetaByPageId.contains(topicOne.id) must_== true
              result.pageMetaByPageId.contains(categoryOne.id) must_== true
              break
            }
          }
        }
        ok
      }
    }


    // -------- Paths

    // COULD: Find the Identity again, and the User.

    lazy val exPagePath = defaultPagePath.copy(pageId = Some(testPage.id))
    "recognize its correct PagePath" in {
      dao.checkPagePath(exPagePath) must be like {
        case Some(correctPath: PagePath) =>
          correctPath must matchPagePath(exPagePath)
        case p => ko(s"Bad path: $p")
      }
    }

    "correct an incorrect PagePath name" in {
      dao.checkPagePath(exPagePath.copy(pageSlug = "incorrect")) must be like {
        case Some(correctPath: PagePath) =>
          correctPath must matchPagePath(exPagePath)
        case p => ko(s"Bad path: $p")
      }
    }

    "correct an incorrect PagePath folder" in {
      dao.checkPagePath(exPagePath.copy(folder = "/incorrect/")) must be like {
        case Some(correctPath: PagePath) =>
          correctPath must matchPagePath(exPagePath)
        case p => ko(s"Bad path: $p")
      }
    }

    //"remove a superfluous slash in a no-guid path" in {
    //}

    //"add a missing slash to a folder index" in {
    //}

    // -------- Page actions

    lazy val ex2_emptyPost = RawPostAction.copyCreatePost(T.post,
      parentPostId = Some(PageParts.BodyId), text = "", userId = globalUserId)
    var ex2_id = PageParts.NoId
    "save an empty root post child post" in {
      testPage += guestUser
      dao.savePageActions(testPage, List(ex2_emptyPost)) must beLike {
        case (_, List(p: RawPostAction[PAP.CreatePost])) =>
          ex2_id = p.id
          p must matchPost(ex2_emptyPost, id = ex2_id)
      }
    }

    "find the empty post again" in {
      dao.loadPageParts(testPage.id) must beLike {
        case Some(d: PageParts) => {
          d must havePostLike(ex2_emptyPost, id = ex2_id)
        }
      }
    }


    // -------- Save approvals and rejections

    "Save and load an approval" in {
      testSaveLoadReview(isApproved = true)
      ok
    }

    "Save and load a rejection" in {
      //testSaveLoadReview(isApproved = false)
      pending
    }

    def testSaveLoadReview(isApproved: Boolean) {
      var reviewSaved: RawPostAction[PAP.ApprovePost] = null
      val approval = if (isApproved) Approval.AuthoritativeUser else ???
      val reviewNoId = RawPostAction.toApprovePost(
         UnassignedId, postId = ex1_rootPost.id,
        UserIdData.newTest(userId = globalUserId), ctime = now, approval = approval)
      dao.savePageActions(testPage, List(reviewNoId)) must beLike {
        case (_, List(review: RawPostAction[PAP.ApprovePost])) =>
          reviewSaved = review
          review must_== reviewNoId.copy(id = review.id)
      }

      dao.loadPageParts(testPage.id) must beLike {
        case Some(page: PageParts) => {
          val postReviewed = page.getPost_!(reviewSaved.postId)
          postReviewed.lastReviewDati must_== Some(reviewSaved.ctime)
          postReviewed.lastReviewWasApproval must_== Some(isApproved)
        }
      }
    }


    // -------- Pin posts and votes


    "Pin posts and votes" >> {

      "Pin post at position" in {
        val position = 1
        var savedPin: RawPostAction[_] = null
        val payload = PAP.PinPostAtPosition(position)
        val action = RawPostAction[PAP.PinPostAtPosition](
          id = PageParts.UnassignedId,
          creationDati = new ju.Date,
          payload = payload,
          postId = ex1_rootPost.id,
          userIdData = UserIdData.newTest(userId = globalUserId))

        dao.savePageActions(testPage, List(action)) must beLike {
          case (_, List(pinAction: RawPostAction[_])) =>
            savedPin = pinAction
            ok
        }

        dao.loadPageParts(testPage.id) must beLike {
          case Some(page: PageParts) =>
            val pinAction =
              page.rawActions.find(_.payload.isInstanceOf[PAP.PinPostAtPosition])
              .getOrElse(fail("No PinPostAtPosition found"))
              .asInstanceOf[RawPostAction[PAP.PinPostAtPosition]]
            pinAction.postId must_== ex1_rootPost.id
            pinAction.payload.position must_== position
            val pinnedPost = page.getPost_!(ex1_rootPost.id)
            pinnedPost.pinnedPosition must_== Some(position)
            ok
        }
      }

      "Pin votes to post" in {
        failure
      }.pendingUntilFixed()
    }


    // -------- Edit posts


    var exEdit_postId: ActionId = PageParts.NoId
    var exEdit_editId: ActionId = PageParts.NoId

    "create a post to edit" >> {
      // Make post creation action
      lazy val postNoId = RawPostAction.copyCreatePost(T.post,
        parentPostId = Some(PageParts.BodyId), text = "Initial text",
        userId = globalUserId)

      var post: RawPostAction[PAP.CreatePost] = null

      "save post" in {
        post = dao.savePageActions(testPage, List(postNoId))._2.head
          .asInstanceOf[RawPostAction[PAP.CreatePost]]
        post.payload.text must_== "Initial text"
        exEdit_postId = post.id
        testPage += post
        ok
      }

      val newText = "Edited text 054F2x"

      "edit the post" in {
        // Make edit actions
        val patchText = makePatch(from = post.payload.text, to = newText)
        val editNoId = RawPostAction.toEditPost(
          id = UnassignedId, postId = post.id, ctime = now,
          UserIdData.newTest(userId = globalUserId),
          text = patchText,
          approval = None, autoApplied = false)
        val publNoId = RawPostAction[PAP.EditApp](
          id = UnassignedId2, creationDati = now,
          payload = PAP.EditApp(editId = UnassignedId, approval = None),
          postId = post.id, userIdData = UserIdData.newTest(userId = globalUserId))

        // Save
        val List(edit: RawPostAction[PAP.EditPost], publ: RawPostAction[PAP.EditApp]) =
          dao.savePageActions(testPage, List(editNoId, publNoId))._2

        exEdit_editId = edit.id

        // Verify text changed
        dao.loadPageParts(testPage.id) must beLike {
          case Some(d: PageParts) => {
            val editedPost = d.getPost_!(post.id)
            editedPost.currentText must_== newText
          }
        }
      }
    }



    // -------- Load recent actions

    "load recent actions" >> {

      lazy val badIp = Some("99.99.99.99")
      lazy val ip = Some("1.1.1.1")

      "from IP, find nothing" in {
        val (actions, people) =
            dao.loadRecentActionExcerpts(fromIp = badIp, limit = 5)
        actions must beEmpty
        people must_== People.None
      }

      "from IP, find a post, and edits of that post" in {
        val (actions, people) =
           dao.loadRecentActionExcerpts(fromIp = ip, limit = 99)

        /* Not yet possible: logins etc not loaded.
        actions.length must be_>(0)
        actions foreach { action =>
          val ipMatches = action.login_!.ip == ip
          // val targetActionIpMatches = action.target.map(_.ip) == Some(ip)
          val targetActionIpMatches = true // not implemented :-(
          (ipMatches || targetActionIpMatches) must_== true
        }
        */
        pending
      }

      "from IP, find `limit`" in {
        val (actions, people) =
           dao.loadRecentActionExcerpts(fromIp = ip, limit = 2)
        //actions.length must be_>=(?)
        /*
        If `loadRecentActionExcerpts` loaded only own Post:s, and actions
        on them, e.g. this would be possible:
        val ownActions = actions filter { action =>
          action.login_!.ip == ip && action.action.isInstanceOf[Post]
        }
        ownActions.length must_== 2
        */
        pending
      }

      "by role id, find nothing" in {
        val (actions, people) = dao.loadRecentActionExcerpts(byRole = Some("99999"), limit = 99)
        actions must beEmpty
        people must_== People.None
      }

      "by identity id, find ..." in {
        // Not implemented, because no OpenID identity currently does anything.
        pending
      }

      "by path, find nothing, in non existing tree and folder" in {
        val (actions, people) = dao.loadRecentActionExcerpts(
          pathRanges = PathRanges(
            trees = Seq("/does/not/exist/"),
            folders = Seq("/neither/do/i/")),
          limit = 99)
        actions.length must_== 0
        people must_== People.None
      }

      "by path, find something, in root tree" in {
        val (actions, people) = dao.loadRecentActionExcerpts(
          pathRanges = PathRanges(trees = Seq("/")), limit = 99)
        actions.length must be_>(0)
        people.users.nonEmpty must beTrue
      }

      "by path, find something, in /folder/" in {
        val (actions, people) = dao.loadRecentActionExcerpts(
          pathRanges = PathRanges(folders = Seq(defaultPagePath.folder)),
          limit = 99)
        actions.length must be_>(0)
        people.users.nonEmpty must beTrue
      }

      "by page id, find nothing, non existing page" in {
        val (actions, people) = dao.loadRecentActionExcerpts(
          pathRanges = PathRanges(pageIds = Seq("nonexistingpage")),
          limit = 99)
        actions.length must_== 0
        people must_== People.None
      }

      "by page id, find something, when page exists" in {
        val (actions, people) = dao.loadRecentActionExcerpts(
          pathRanges = PathRanges(pageIds = Seq(testPage.id)),
          limit = 99)
        actions.length must be_>(0)
        people.users.nonEmpty must beTrue
      }

      "by page id, folder and tree, find something" in {
        val (actions, people) = dao.loadRecentActionExcerpts(
          pathRanges = PathRanges(
            pageIds = Seq(testPage.id),  // exists
            folders = Seq("/folder/"),  // there's a page in this folder
            trees = Seq("/")),  // everything
          limit = 99)
        actions.length must be_>(0)
        people.users.nonEmpty must beTrue
      }
    }



    // -------- OpenID login
    /* Disable for now, OpenID broken with Play Framework 2.3.

    var exOpenId_loginReq: LoginGrant = null
    var exOpenId_loginReq_openIdIdentity: IdentityOpenId = null
    def exOpenId_loginGrant: LoginGrant = exOpenId_loginReq  // correct name
    var exOpenId_userIds = mut.Set[String]()
    "save a new OpenID login and create a user" in {
      exOpenId_loginReq = dao.tryLogin(T.openIdLoginAttempt)
      exOpenId_loginReq_openIdIdentity = exOpenId_loginReq.identity.asInstanceOf[IdentityOpenId]
      for (id <- exOpenId_loginReq.identity.id ::
                  exOpenId_loginReq.user.id :: Nil) {
        id.contains("?") must_== false
        // weird! the compiler says: ';' expected but integer literal found
        // on the next row (if commented in).
        // id.length must be_> 1  // non-empty, and no weird 1 char id

        // Only dummy user ids (created for each IdentitySimple)
        // start with "-":
        id must not startWith("-")
      }
      exOpenId_loginReq.user.id must_== exOpenId_loginReq.identity.userId
      exOpenId_loginReq.user must matchUser(
          displayName = T.openIdLoginAttempt.openIdDetails.firstName,
          email = T.openIdLoginAttempt.openIdDetails.email.get,
          country = T.openIdLoginAttempt.openIdDetails.country,
          website = "",
          isSuperAdmin = Boolean.box(false))
      exOpenId_userIds += exOpenId_loginReq.user.id
      ok
    }

    "list OpenID user" in {
      val openIdEntry = dao.listUsers(UserQuery()).find(_._2 != List("Guest"))
      openIdEntry must_== Some(
        (exOpenId_loginGrant.user, List(T.openIdLoginAttempt.openIdDetails.oidEndpoint)))
    }

    "reuse the IdentityOpenId and User just created" in {
      val grant = dao.tryLogin(T.openIdLoginAttempt.copy(date = new ju.Date))
      grant.identity must_== exOpenId_loginReq.identity
      // The very same user should have been found.
      grant.user must matchUser(exOpenId_loginReq.user)
    }

    // COULD test to change name + email too, instead of only changing country.

    "update the IdentityOpenId, if attributes (country) changed" in {
      // Change the country attribute. The Dao should automatically save the
      // new value to the database, and use it henceforth.
      val loginAttempt = T.openIdLoginAttempt.copy(
        date = new ju.Date,
        openIdDetails = T.openIdLoginAttempt.openIdDetails.copy(country = "Norway"))
      val grant = dao.tryLogin(loginAttempt)
      grant.identity must_== exOpenId_loginReq_openIdIdentity.copy(
        openIdDetails =
          exOpenId_loginReq_openIdIdentity.openIdDetails.copy(country = "Norway"))
      // The user shouldn't have been changed, only the OpenID identity attrs.
      grant.user must matchUser(exOpenId_loginReq.user)
    }

    //"have exactly one user" in {  // or, 3? there're 2 IdentitySimple users?
    //}

    var exOpenId_loginAttempt_2: OpenIdLoginAttempt = null
    var exOpenId_loginGrant_2: LoginGrant = null

    // COULD test w/ new tenant but same claimed_ID, should also result in
    // a new User. So you can customize your user, per tenant.
    "create new IdentityOpenId and User for a new claimed_id" in {
      exOpenId_loginAttempt_2 = T.openIdLoginAttempt.copy(
        date = new ju.Date,
        openIdDetails = T.openIdLoginAttempt.openIdDetails.copy(oidClaimedId = "sth.else.com"))
      val grant = dao.tryLogin(exOpenId_loginAttempt_2)
      // A new id to a new user, but otherwise identical.
      grant.user.id must_!= exOpenId_loginReq.user.id
      grant.user must matchUser(exOpenId_loginReq.user, id = grant.user.id)
      exOpenId_userIds.contains(grant.user.id) must_== false
      exOpenId_userIds += grant.user.id
      exOpenId_loginGrant_2 = grant
      ok
    }

    var exGmailLoginGrant: LoginGrant = null

    "create new IdentityOpenId and User for a new claimed_id, Gmail addr" in {
      val loginAttempt = T.openIdLoginAttempt.copy(
        date = new ju.Date,
        openIdDetails = T.openIdLoginAttempt.openIdDetails.copy(
          oidEndpoint = IdentityOpenId.GoogleEndpoint,
          oidRealm = "some.realm.com",
          oidClaimedId = "google.claimed.id",
          email = Some("example@gmail.com")))
      exGmailLoginGrant = dao.tryLogin(loginAttempt)
      val grant = exGmailLoginGrant
      exOpenId_userIds.contains(grant.user.id) must_== false
      exOpenId_userIds += grant.user.id
      ok
    }

    "lookup OpenID identity, by login id" in {
      dao.loadUser(exGmailLoginGrant.user.id) must beLike {
        case Some(user) =>
          user must_== exGmailLoginGrant.user
      }
      ok
    }

    "lookup OpenID identity, by claimed id" in {
      // (Use _2 because the first one has had its country modified)
      val oidSaved = exOpenId_loginGrant_2.identity.asInstanceOf[IdentityOpenId]
      val partialIdentity = oidSaved.copy(id = "?", userId = "?")
      dao.loadIdtyDetailsAndUser(
          forOpenIdDetails = exOpenId_loginAttempt_2.openIdDetails) must beLike {
        case Some((identity, user)) =>
          identity must_== exOpenId_loginGrant_2.identity
          user must_== exOpenId_loginGrant_2.user
      }
    }

    "lookup OpenID identity, by email, for Gmail" in {
      val openIdDetails = OpenIdDetails(
         oidEndpoint = IdentityOpenId.GoogleEndpoint,
         oidVersion = "?", oidRealm = "?", oidClaimedId = "?",
         oidOpLocalId = "?", firstName = "?", email = Some("example@gmail.com"),
         country = "?")
      dao.loadIdtyDetailsAndUser(forOpenIdDetails = openIdDetails) must beLike {
        case Some((identity, user)) =>
          identity must_== exGmailLoginGrant.identity
          user must_== exGmailLoginGrant.user
      }
    }

    //"have exactly two users" in {  // no, 4? 2 + 2 = 4
    //}

    /*
    "create a new user, for a new tenant (but same claimed_id)" in {
      val loginAttempt = LoginAttempt(T.openIdLoginAttempt.copy(date = new ju.Date))
                              T.identityOpenId)
      val grant = dao.tryLogin("some-other-tenant-id", loginAttempt)
      grant.login.id must_!= exOpenId_loginReq.login.id
      grant.user must beLike {
        case None => false
        case Some(u) =>
          // A new id to a new user, but otherwise identical.
          u.id must_!= exOpenId_loginReq.user.id
          u must matchUser(exOpenId_loginReq.user, id = u.id)
          exOpenId_userIds += u.id
      }
    } */

    "save a post as an OpenID user" in {
      // Save a post, using the OpenID login.
      val newPost = RawPostAction.copyCreatePost(T.post,
        parentPostId = Some(PageParts.BodyId), text = "",
        userId = exOpenId_loginGrant.user.id)
      var postId = PageParts.NoId
      testPage += exOpenId_loginGrant.user
      dao.savePageActions(testPage, List(newPost)) must beLike {
        case (_, List(savedPost: RawPostAction[PAP.CreatePost])) =>
          postId = savedPost.id
          savedPost must matchPost(newPost, id = postId)
      }
      dao.loadPageParts(testPage.id) must beLike {
        case Some(d: PageParts) =>
          d must havePostLike(newPost, id = postId)
          d.people.user(exOpenId_loginReq.user.id) must beLike {
            case Some(user: User) =>
              user must_== exOpenId_loginReq.user
              ok
          }
      }
      ok
    }
     */


    // -------- OAuth identities

    "Login with a OAuth, create associated User" >> {

      val theFirstName = "SecureSocialFirstName1"
      val theLastName = "SecureSocialLastName"
      val theUsername = "oauth_username"
      val theUsername2 = "oauth_username2"
      val theUsername3 = "oauth_username3"
      val theEmail = "securesocial-user@ex.com"

      val theChangedFirstName = "NewSecureSocialFirstName1"
      val theChangedEmail = "changed-securesocial-user@ex.com"

      val the2ndEmail = "the-2nd-securesocial-user@ex.com"
      val the3rdEmail = "the-3rd-securesocial-user@ex.com"

      val theOpenAuthDetails = OpenAuthDetails(
        providerId = "providerId",
        providerKey = "userId",
        firstName = Some(theFirstName),
        lastName = Some(theLastName),
        fullName = Some("SecureSocialFirstName SecureSocialLastName"),
        email = Some(theEmail),
        avatarUrl = Some("http://avatar.url"))

      val theChangedOpenAuthDetails = theOpenAuthDetails.copy(
        firstName = Some(theChangedFirstName), email = Some(theChangedEmail))

      val the2ndOpenAuthDetails = theOpenAuthDetails.copy(
        providerKey = "newUserId", email = Some(the2ndEmail))

      val the3rdOpenAuthDetails = theOpenAuthDetails.copy(
        providerId = "newPrvdrId", email = Some(the3rdEmail))

      val newOauthUserData = NewOauthUserData.create(
        name = theFirstName,
        username = theUsername,
        email = theEmail,
        emailVerifiedAt = None,
        identityData = theOpenAuthDetails).get

      val newOauthUserData2 = NewOauthUserData.create(
        name = theFirstName,
        username = theUsername2,
        email = the2ndEmail,
        emailVerifiedAt = None,
        identityData = the2ndOpenAuthDetails).get

      val newOauthUserData3 = NewOauthUserData.create(
        name = theFirstName,
        username = theUsername3,
        email = the3rdEmail,
        emailVerifiedAt = None,
        identityData = the3rdOpenAuthDetails).get

      val theFirstLoginAttempt = OpenAuthLoginAttempt(
        ip = "1.2.3.4", date = now, theOpenAuthDetails)

      var theUser: User = null
      var theFirstLoginGrant: LoginGrant = null
      var theChangedLoginGrant: LoginGrant = null
      var the2ndUsersLoginGrant: LoginGrant = null
      var the3rdUsersLoginGrant: LoginGrant = null

      "create" in {
        theFirstLoginGrant = dao.createUserAndLogin(newOauthUserData)
        val theIdentity = theFirstLoginGrant.identity.get.asInstanceOf[OpenAuthIdentity]
        theIdentity.openAuthDetails must_== theOpenAuthDetails
        theUser = theFirstLoginGrant.user
        Some(theUser.displayName) must_== theOpenAuthDetails.firstName
        Some(theUser.email) must_== theOpenAuthDetails.email
        ok
      }

      "list SecureSocial user" in {
        pending // see same test but OpenID, above
      }

      "reuse the SecureSocialIdentity and User just created" in {
        val loginGrant = dao.tryLogin(theFirstLoginAttempt)
        loginGrant.identity must_== theFirstLoginGrant.identity
        loginGrant.user must_== theFirstLoginGrant.user
        ok
      }

      "update the SecureSocialIdentity, if attributes changed" in {
        val loginAttempt = theFirstLoginAttempt.copy(openAuthDetails = theChangedOpenAuthDetails)
        theChangedLoginGrant = dao.tryLogin(loginAttempt)
        theChangedLoginGrant.user must_== theFirstLoginGrant.user
        val ssIdentity = theChangedLoginGrant.identity.get.asInstanceOf[OpenAuthIdentity]
        ssIdentity.id must_== theFirstLoginGrant.identity.get.id
        ssIdentity.userId must_== theUser.id
        ssIdentity.openAuthDetails.copy(
            firstName = Some(theChangedFirstName), email = Some(theChangedEmail)) must_==
          theChangedOpenAuthDetails
        ok
      }

      "throw an IdentityNotFoundException for an unknown identity" in {
        try {
          dao.tryLogin(theFirstLoginAttempt.copy(openAuthDetails = the2ndOpenAuthDetails))
          fail(s"Was able to login with unseen credentials")
        }
        catch {
          case ex: IdentityNotFoundException => ()
        }
        ok
      }

      "create new SecureSocialIdentity and User for a new provider user id" in {
        the2ndUsersLoginGrant = dao.createUserAndLogin(newOauthUserData2)

        val loginGrant = the2ndUsersLoginGrant
        val ssIdentity = loginGrant.identity.get.asInstanceOf[OpenAuthIdentity]
        ssIdentity.id must_!= theFirstLoginGrant.identity.get.id
        ssIdentity.openAuthDetails must_== the2ndOpenAuthDetails

        loginGrant.user must_== theChangedLoginGrant.user.copy(
          id = loginGrant.user.id, username = Some(theUsername2), email = the2ndEmail,
          createdAt = loginGrant.user.createdAt)
        ok
      }

      "create new SecureSocialIdentity and User for a new provider id, same user id" in {
        the3rdUsersLoginGrant = dao.createUserAndLogin(newOauthUserData3)

        val loginGrant = the3rdUsersLoginGrant
        val ssIdentity = loginGrant.identity.get.asInstanceOf[OpenAuthIdentity]
        ssIdentity.id must_!= theFirstLoginGrant.identity.get.id
        ssIdentity.id must_!= the2ndUsersLoginGrant.identity.get.id
        ssIdentity.openAuthDetails must_== the3rdOpenAuthDetails

        loginGrant.user.id must_!= theFirstLoginGrant.user.id
        loginGrant.user.id must_!= the2ndUsersLoginGrant.user.id
        loginGrant.user must_== theChangedLoginGrant.user.copy(
          id = loginGrant.user.id, username = Some(theUsername3), email = the3rdEmail,
          createdAt = loginGrant.user.createdAt)
        ok
      }

      // Lookup by provider + user id already tested implicitly, when logging in with
      // existing identity, above.
      "lookup a SecureSocialIdentity, by login id" in {
        dao.loadUser(theChangedLoginGrant.user.id) must beLike {
          case Some(user) =>
            user must_== theChangedLoginGrant.user
        }
        ok
      }
    }


    // -------- Password identities

    var globalPasswordUser: User = null

    "create PasswordIdentity and User" >> {

      val theEmail = "psdw-test@ex.com"
      val thePassword = "ThePassword"
      val theNewPassword = "TheNewPswd"
      val theHash = DbDao.saltAndHashPassword(thePassword)
      val theNewHash = DbDao.saltAndHashPassword(theNewPassword)

      val newPasswordUserData = NewPasswordUserData.create(
        name = "PasswordUser", username = "PwdUsrUsername", email = theEmail,
        password = thePassword, isAdmin = false).get

      var theUser: User = null
      var loginGrant: LoginGrant = null

      "create" in {
        val user = dao.createPasswordUser(newPasswordUserData)
        val verifiedAt = Some(new ju.Date)
        dao.configRole(user.id, emailVerifiedAt = Some(verifiedAt))
        theUser = user.copy(emailVerifiedAt = verifiedAt)
        ok
      }

      "login" in {
        loginGrant = dao.tryLogin(PasswordLoginAttempt(
          ip = "1.2.3.4", date = new ju.Date(),
          email = theUser.email, password = thePassword))
        loginGrant.user must_== theUser
        loginGrant.identity must_== None
        ok
      }

      "load user by username and email" in {
        dao.loadUserByEmailOrUsername(theUser.username.get) match {
          case Some(userLoaded) =>
            userLoaded must_== theUser
          case _ => fail("User by username lookup faied")
        }
        dao.loadUserByEmailOrUsername(theEmail) match {
          case Some(userLoaded) =>
            userLoaded must_== theUser
          case _ => fail(s"User by email lookup failed")
        }
        ok
      }

      "change password" in {
        val passwordWasChanged = dao.changePassword(theUser, newPasswordSaltHash = theNewHash)
        passwordWasChanged must_== true
        ok
      }

      "reject the old password" in {
        try {
          dao.tryLogin(PasswordLoginAttempt(
            ip = "1.2.3.4", date = new ju.Date(),
            email = theUser.email, password = thePassword))
        }
        catch {
          case DbDao.BadPasswordException =>
        }
        ok
      }

      "login with new password" in {
        val newLoginGrant = dao.tryLogin(PasswordLoginAttempt(
          ip = "1.2.3.4", date = new ju.Date(),
          email = theUser.email, password = theNewPassword))
        newLoginGrant.user must_== theUser.copy(passwordHash = Some(theNewHash))
        newLoginGrant.identity must_== None
        ok
      }

      "remember global variables" in {
        globalPasswordUser = theUser
        ok
      }
    }


    // -------- Email

    var emailGuestUser: User = null
    var emailEx_email = "Imail@ex.com"

    // Test users, *after* they've been configured to receive email.
    var emailEx_UnauUser: User = null
    var emailEx_OpenIdUser: User = null

    "by default send no email to a new IdentitySimple" in {
      val loginReq = T.guestLoginAttempt.copy(
        date = new ju.Date, email = emailEx_email, name = "Imail")
      emailGuestUser = dao.loginAsGuest(loginReq).user
      val Some(loadedGuest) = dao.loadUser(emailGuestUser.id)
      loadedGuest.emailNotfPrefs must_== EmailNotfPrefs.Unspecified
      ok
    }

    "configure email to IdentitySimple" in {
      dao.configIdtySimple(
            ctime = new ju.Date, emailAddr = emailEx_email,
            emailNotfPrefs = EmailNotfPrefs.Receive)
      val Some(user) = dao.loadUser(emailGuestUser.id)
      user.emailNotfPrefs must_== EmailNotfPrefs.Receive
      emailEx_UnauUser = user  // save, to other test cases
      ok
    }

    "by default send no email to a new Role" in {
      val Some(user) = dao.loadUser(globalPasswordUser.id)
      user.emailNotfPrefs must_== EmailNotfPrefs.Unspecified
    }

    "configure email to a Role" in {
      // Somewhat dupl code, see `def testAdmin` test helper.
      dao.configRole(roleId = globalPasswordUser.id, emailNotfPrefs = Some(EmailNotfPrefs.Receive))
      val Some(userConfigured) = dao.loadUser(globalPasswordUser.id)
      userConfigured.emailNotfPrefs must_== EmailNotfPrefs.Receive
      emailEx_OpenIdUser = userConfigured  // remember, to other test cases
      ok
    }


    // -------- Emails


    "login by email id" >> {

      lazy val theGuestId = guestUser.id
      lazy val theRoleId = globalPasswordUser.id

      lazy val emailToSendToGuest = Email(
        id = "3kU001",
        tyype = EmailType.Notification,
        sentTo = "test@example.com",
        toUserId = Some(theGuestId),
        sentOn = None,
        createdAt = new ju.Date(),
        subject = "Test Subject",
        bodyHtmlText = "<i>Test content.</i>",
        providerEmailId = None)

      lazy val emailToSendToRole =
        emailToSendToGuest.copy(id = "3kU002", toUserId = Some(theRoleId))

      "save and send an email to a guest" in {
        dao.saveUnsentEmail(emailToSendToGuest)
        dao.updateSentEmail(emailToSendToGuest)
        ok
      }

      "login as guest by email id" in {
        val loginAttempt = EmailLoginAttempt(
          ip = "1.2.3.4", date = now, emailId = emailToSendToGuest.id)
        val loginGrant = dao.tryLogin(loginAttempt)
        loginGrant.user.id must_== theGuestId
        ok
      }

      "save and send an email to a role" in {
        dao.saveUnsentEmail(emailToSendToRole)
        dao.updateSentEmail(emailToSendToRole)
        ok
      }

      "login as role by email id" in {
        val loginAttempt = EmailLoginAttempt(
          ip = "1.2.3.4", date = now, emailId = emailToSendToRole.id)
        val loginGrant = dao.tryLogin(loginAttempt)
        loginGrant.user.id must_== theRoleId
        ok
      }

    }


    // -------- Admins

    "create and revoke admin privs" >> {

      def testAdmin(makeAdmin: Boolean, makeOwner: Option[Boolean]) = {
        // Somewhat dupl code, see "configure email to a Role" test.
        val userToConfig = globalPasswordUser
        dao.configRole(roleId = userToConfig.id,
          isAdmin = Some(makeAdmin), isOwner = makeOwner)
        val Some(userConfigured) = dao.loadUser(userToConfig.id)
        userConfigured.isAdmin must_== makeAdmin
        emailEx_OpenIdUser = userConfigured  // remember, to other test cases
        ok
      }

      "make a Role an administrator" in {
        testAdmin(true, makeOwner = None)
      }

      "change the Role back to a normal user" in {
        testAdmin(false, makeOwner = None)
      }

      "make a Role an admin and owner" in {
        testAdmin(true, makeOwner = Some(true))
      }

      "change the Role back to a normal user" in {
        testAdmin(false, makeOwner = Some(false))
      }
    }


    // -------- Move a page

    var allPathsCanonicalFirst: List[PagePath] = null

    "move and rename pages" >> {

      lazy val pagePath = dao.lookupPagePath(testPage.id).get

      var oldPaths: List[PagePath] = Nil
      var newPath: PagePath = null
      var previousPath: PagePath = null

      def testThat(pathCount: Int, oldPaths:  List[PagePath],
            redirectTo: PagePath) = {
        assert(pathCount == oldPaths.size) // test test suite
        val newPath = redirectTo
        for (oldPath <- oldPaths) {
          // If page id not shown in URL, remove id, or the path will be
          // trivially resolved.
          val pathPerhapsNoId =
            if (oldPath.showId == false) oldPath.copy(pageId = None)
            else oldPath
          dao.checkPagePath(pathPerhapsNoId) must_== Some(newPath)
        }
        ok
      }

      "leave a page as is" in {
        // No move/rename options specified:
        dao.moveRenamePage(pageId = testPage.id) must_== pagePath
        oldPaths ::= pagePath
        ok
      }

      "won't move a non-existing page" in {
        dao.moveRenamePage(
          pageId = "non_existing_page",
          newFolder = Some("/folder/"), showId = Some(false),
          newSlug = Some("new-slug")) must throwAn[Exception]
      }

      "move a page to another folder" in {
        newPath = dao.moveRenamePage(pageId = testPage.id,
          newFolder = Some("/new-folder/"))
        newPath.folder must_== "/new-folder/"
        newPath.pageSlug must_== pagePath.pageSlug
        newPath.showId must_== pagePath.showId
      }

      "and redirect one old path to new path" in {
        testThat(1, oldPaths, redirectTo = newPath)
      }

      "rename a page" in {
        oldPaths ::= newPath
        newPath = dao.moveRenamePage(
          pageId = testPage.id,
          newSlug = Some("new-slug"))
        newPath.folder must_== "/new-folder/"
        newPath.pageSlug must_== "new-slug"
        newPath.showId must_== pagePath.showId
      }

      "and redirect two old paths to new path" in {
        testThat(2, oldPaths, redirectTo = newPath)
      }

      "toggle page id visibility in URL" in {
        oldPaths ::= newPath
        newPath = dao.moveRenamePage(
          pageId = testPage.id,
          showId = Some(!pagePath.showId))
        newPath.folder must_== "/new-folder/"
        newPath.pageSlug must_== "new-slug"
        newPath.showId must_== !pagePath.showId
      }

      "and redirect three old paths to new path" in {
        testThat(3, oldPaths, redirectTo = newPath)
      }

      "move and rename a page at the same time" in {
        oldPaths ::= newPath
        previousPath = newPath // we'll move it back to here, soon
        newPath = dao.moveRenamePage(
          pageId = testPage.id,
          newFolder = Some("/new-folder-2/"),
          showId = Some(true), newSlug = Some("new-slug-2"))
        newPath.folder must_== "/new-folder-2/"
        newPath.pageSlug must_== "new-slug-2"
        newPath.showId must_== true
      }

      "and redirect four old paths to new path" in {
        testThat(4, oldPaths, redirectTo = newPath)
      }

      "list the page at the correct location" in {
        val pagePathsDetails = dao.listPagePaths(
          PathRanges(trees = Seq("/")),
          include = PageStatus.All,
          orderOffset = PageOrderOffset.ByPath,
          limit = Int.MaxValue)
        pagePathsDetails must beLike {
          case list: List[PagePathAndMeta] =>
            list.find(_.path == newPath) must beSome
        }
      }

      "move-rename to a location that happens to be its previous location" in {
        oldPaths ::= newPath
        newPath = dao.moveRenamePage(
          pageId = testPage.id,
          newFolder = Some(previousPath.folder),
          showId = Some(previousPath.showId),
          newSlug = Some(previousPath.pageSlug))
        newPath must_== previousPath
      }

      "and redirect five paths to the current (a previous) location" in {
        testThat(5, oldPaths, redirectTo = newPath)
        // For next test:
        allPathsCanonicalFirst = newPath :: oldPaths.filterNot(_ == newPath)
        ok
      }
    }


    // -------- List page paths


    "list page paths including redirects" in {
      val keys = allPathsCanonicalFirst
      val pageId = keys.head.pageId.get
      val pathsLoaded = dao.lookupPagePathAndRedirects(pageId)
      val keysFound = keys.filter(key => pathsLoaded.find(_ == key).isDefined)
      val superfluousPathsLoaded =
        pathsLoaded.filter(pathLoaded => keys.find(_ == pathLoaded).isEmpty)
      keysFound must_== keys
      superfluousPathsLoaded must_== Nil
      pathsLoaded.length must_== keys.length // Not needed? Feels safer.
      // The canonical path must be the first one listed.
      pathsLoaded.head must_== keys.head
    }

    "list no paths for a non-existing page" in {
      dao.lookupPagePathAndRedirects("badpageid") must_== Nil
    }


    // -------- Move page to previous location


    "move a page to its previous location" >> {

      "fail to move a non-existing page" in {
        val badPath = PagePath(defaultTenantId, "/folder/", None,
          showId = false, pageSlug = "non-existing-page-532853")
        dao.movePageToItsPreviousLocation(badPath) must
          throwA[PageNotFoundByPathException]
      }

      var origHomepage: Page = null
      var newHomepage: Page = null

      def homepagePathNoId = PagePath(defaultTenantId, "/", None, false, "")

      def homepagePathWithIdTo(page: Page) =
        homepagePathNoId.copy(pageId = Some(page.id))

      "create page /_old/homepage" in {
        origHomepage = createPage("/_old/homepage", showId = false)
        ok
      }

      "move it page to / (homepage)" in {
        val homepagePath = homepagePathWithIdTo(origHomepage)
        dao.moveRenamePage(homepagePath)
        val newPath = dao.checkPagePath(homepagePath.copy(pageId = None))
        newPath must_== Some(homepagePath)
      }

      "move it back to its previous location" in {
        val oldPath = PagePath(defaultTenantId, "/_old/",
          Some(origHomepage.id), showId = false, pageSlug = "homepage")
        val newPath = dao.movePageToItsPreviousLocation(homepagePathNoId)
        newPath must_== Some(oldPath)
      }

      "create a new homepage at /new-homepage" in {
        newHomepage = createPage("/new-homepage", showId = true)
        ok
      }

      "move the new homepage to /" in {
        val homepagePath = homepagePathWithIdTo(newHomepage)
        dao.moveRenamePage(homepagePath)
        val newPath = dao.checkPagePath(homepagePath.copy(pageId = None))
        newPath must_== Some(homepagePath)
      }

      "move new homepage back to its previous location" in {
        dao.movePageToItsPreviousLocation(homepagePathNoId) must be like {
          case Some(pagePath) =>
            pagePath.pageSlug must_== "new-homepage"
            pagePath.folder must_== "/"
            pagePath.showId must_== true
        }
      }

      "move the original homepage to / again" in {
        val homepagePath = homepagePathWithIdTo(origHomepage)
        dao.moveRenamePage(homepagePath)
        val newPath = dao.checkPagePath(homepagePath.copy(pageId = None))
        newPath must_== Some(homepagePath)
      }
   }



    // -------- Page path clashes


    def createPage(path: String, showId: Boolean = false): Page = {
      val pagePath =
        PagePath.fromUrlPath(defaultTenantId, path = path) match {
          case PagePath.Parsed.Good(path) => path.copy(showId = showId)
          case x => throwFailure(s"Test broken, bad path: $x")
        }
      dao.createPage(Page.newEmptyPage(PageRole.WebPage, pagePath, author = guestUser))
    }


    "not overwrite page paths, but overwrite redirects, when creating page" >> {

      var page_f_index: Page = null
      var page_f_page: Page = null

      "create page /f/ and /f/page" in {
        page_f_index = createPage("/f/")
        page_f_page = createPage("/f/page")
        ok
      }

      "reject new page /f/ and /f/page, since would overwrite paths" in {
        createPage("/f/") must throwA[PathClashException]
        createPage("/f/page") must throwA[PathClashException]
      }

      "create pages /f/-id, /f/-id-page and /f/-id2-page, since ids shown" in {
        createPage("/f/", showId = true)
        createPage("/f/page/", showId = true)
        createPage("/f/page/", showId = true) // ok, since different id
        ok
      }

      "move page /f/ to /f/former-index, redirect old path" in {
        dao.moveRenamePage(page_f_index.id, newSlug = Some("former-index"))
        val newPath = dao.checkPagePath(page_f_index.path.copy(pageId = None))
        newPath must_== Some(page_f_index.path.copy(pageSlug = "former-index"))
      }

      "move page /f/page to /f/former-page, redirect old path" in {
        dao.moveRenamePage(page_f_page.id, newSlug = Some("former-page"))
        val newPath = dao.checkPagePath(page_f_page.path.copy(pageId = None))
        newPath must_== Some(page_f_page.path.copy(pageSlug = "former-page"))
      }

      "create new page /f/, overwrite redirect to /f/former-index" in {
        val page_f_index_2 = createPage("/f/")
        page_f_index_2 must_!= page_f_index
        // Now the path that previously resolved to page_f_index
        // must instead point to page_f_index_2.
        val path = dao.checkPagePath(page_f_index.path.copy(pageId = None))
        path must_== Some(page_f_index_2.path)
      }

      "create new page /f/page, overwrite redirect to /f/page-2" in {
        val page_f_page_2 = createPage("/f/page")
        page_f_page_2 must_!= page_f_page
        // Now the path that previously resolved to page_f_page
        // must instead point to page_f_page_2.
        val path = dao.checkPagePath(page_f_page.path.copy(pageId = None))
        path must_== Some(page_f_page_2.path)
      }
    }



    "not overwrite page paths, when moving pages" >> {

      var page_g_index: Page = null
      var page_g_2: Page = null
      var page_g_page: Page = null
      var page_g_page_2: Page = null

      "create page /g/, /g/2, and /g/page, /g/page-2" in {
        page_g_index = createPage("/g/")
        page_g_2 = createPage("/g/2")
        page_g_page = createPage("/g/page")
        page_g_page_2 = createPage("/g/page-2")
        ok
      }

      "refuse to move /g/2 to /g/ — would overwrite path" in {
        dao.moveRenamePage(page_g_2.id, newSlug = Some("")) must
          throwA[PathClashException]
      }

      "refuse to move /g/page-2 to /g/page — would overwrite path" in {
        dao.moveRenamePage(page_g_page_2.id, newSlug = Some("page")) must
          throwA[PathClashException]
      }

      "move /g/ to /g/old-ix, redirect old path" in {
        val newPath = dao.moveRenamePage(page_g_index.id, newSlug = Some("old-ix"))
        val resolvedPath = dao.checkPagePath(page_g_index.path.copy(pageId = None))
        resolvedPath must_== Some(newPath)
        resolvedPath.map(_.pageSlug) must_== Some("old-ix")
      }

      "move /g/page to /g/former-page, redirect old path" in {
        val newPath = dao.moveRenamePage(page_g_page.id, newSlug = Some("old-page"))
        val resolvedPath = dao.checkPagePath(page_g_page.path.copy(pageId = None))
        resolvedPath must_== Some(newPath)
        resolvedPath.map(_.pageSlug) must_== Some("old-page")
      }

      "now move /g/2 to /g/ — overwrite redirect, fine" in {
        val newPath = dao.moveRenamePage(page_g_2.id, newSlug = Some(""))
        newPath must_== page_g_2.path.copy(pageSlug = "")
        // Now the path that previously resolved to page_g_index must
        // point to page_g_2.
        val resolvedPath = dao.checkPagePath(page_g_index.path.copy(pageId = None))
        resolvedPath must_== Some(newPath)
        // And page_g_2's former location must point to its new location.
        val resolvedPath2 = dao.checkPagePath(page_g_2.path.copy(pageId = None))
        resolvedPath2 must_== Some(newPath)
      }

      "and move /g/page-2 to /g/page — overwrite redirect" in {
        val newPath = dao.moveRenamePage(page_g_page_2.id, newSlug = Some("page"))
        newPath must_== page_g_page_2.path.copy(pageSlug = "page")
        // Now the path that previously resolved to page_g_page must
        // point to page_g_page_2.
        val resolvedPath = dao.checkPagePath(page_g_page.path.copy(pageId = None))
        resolvedPath must_== Some(newPath)
        // And page_g_page_2's former location must point to its new location.
        val resolvedPath2 = dao.checkPagePath(page_g_page_2.path.copy(pageId = None))
        resolvedPath2 must_== Some(newPath)
      }
    }



    // -------- Move many pages

    /*
    RdbSiteDao._movePages throws:
        unimplemented("Moving pages and updating DW1_PAGE_PATHS.CANONICAL")

    "move many pages" >> {

      "move Nil pages" in {
        dao.movePages(Nil, fromFolder = "/a/", toFolder = "/b/") must_== ()
      }

      "won't move non-existing pages" in {
        dao.movePages(List("nonexistingpage"), fromFolder = "/a/",
            toFolder = "/b/") must_== ()
      }

      "can move page to /move-pages/folder1/" in {
        val pagePath = dao.lookupPagePathByPageId(testPage.id).get
        testMovePages(pagePath.folder, "/move-pages/folder1/")
      }

      "can move page from /move-pages/folder1/ to /move-pages/f2/" in {
        testMovePages("/move-pages/folder1/", "/move-pages/f2/")
      }

      "can move page from /move-pages/f2/ to /_drafts/move-pages/f2/" in {
        testMovePages("/", "/_drafts/", "/_drafts/move-pages/f2/")
      }

      "can move page from /_drafts/move-pages/f2/ back to /move-pages/f2/" in {
        testMovePages("/_drafts/", "/", "/move-pages/f2/")
      }

      "won't move pages that shouldn't be moved" in {
        // If moving pages specified by id:
        // Check 1 page, same tenant but wrong id.
        // And 1 page, other tenant id but same id.
        // If moving all pages in a certain folder:
        // And 1 page, same tenand, wrong folder.
        // And 1 page, other tenand, correct folder.
      }

      "can move two pages, specified by id, at once" in {
      }

      "can move all pages in a folder at once" in {
      }

      "throws, if illegal folder names specified" in {
        testMovePages("no-slash", "/") must throwA[RuntimeException]
        testMovePages("/", "no-slash") must throwA[RuntimeException]
        testMovePages("/regex-*?[]-chars/", "/") must throwA[RuntimeException]
      }

      def testMovePages(fromFolder: String, toFolder: String,
            resultingFolder: String = null) {
        dao.movePages(pageIds = List(testPage.id),
          fromFolder = fromFolder, toFolder = toFolder)
        val pagePathAfter = dao.lookupPagePathByPageId(testPage.id).get
        pagePathAfter.folder must_== Option(resultingFolder).getOrElse(toFolder)
        pagePathAfter.pageId must_== Some(testPage.id)
      }
    }
    */


    // -------- Create more websites

    "create new websites" >> {

      val creatorIp = "123.123.123.123"

      lazy val creatorRole = globalPasswordUser

      var newWebsiteOpt: Tenant = null
      var newHost = TenantHost("website-2.ex.com", TenantHost.RoleCanonical,
         TenantHost.HttpsNone)

      def newWebsiteDao() =
        newTenantDbDao(QuotaConsumers(tenantId = newWebsiteOpt.id))

      var homepageId = "?"

      val homepageTitle = RawPostAction.forNewTitleBySystem(
        "Default Homepage", creationDati = now)

      def createWebsite(suffix: String): Option[(Tenant, User)] = {
        dao.createWebsite(
          name = Some("website-"+ suffix), address = Some("website-"+ suffix +".ex.com"),
          embeddingSiteUrl = None,
          ownerIp = creatorIp,
          ownerIdentity = None, ownerRole = creatorRole)
      }

      def createEmbeddedSite(embeddingSiteUrl: String): Option[(Tenant, User)] = {
        dao.createWebsite(
          name = None, address = None,
          embeddingSiteUrl = Some(embeddingSiteUrl),
          ownerIp = creatorIp,
          ownerIdentity = None, ownerRole = creatorRole)
      }

      "create a new website, from existing tenant" in {
        createWebsite("2") must beLike {
          case Some((site, user)) =>
            newWebsiteOpt = site
            ok
        }
      }

      "not create the same website again" in {
        createWebsite("2") must_== None
      }

      "lookup the new website, from existing tenant" in {
        systemDbDao.loadTenants(newWebsiteOpt.id::Nil) must beLike {
          case List(websiteInDb) =>
            websiteInDb must_== newWebsiteOpt.copy(hosts = List(newHost))
        }
      }

      "create embedded sites, find it by id" in {
        val embeddingSiteUrl = "embedding.exmple.com"
        createEmbeddedSite(embeddingSiteUrl) must beLike {
          case Some((site, user)) =>
            systemDbDao.loadSite(site.id) must be like {
              case Some(site) =>
                site.name must_== None
                site.hosts.length must_== 0
                site.embeddingSiteUrl must_== Some(embeddingSiteUrl)
          }
        }
        ok
      }

      "not create too many websites from the same IP" in {
        def create100Websites() {
          for (i <- 3 to 100)
            createWebsite(i.toString)
        }
        create100Websites() must throwA[TooManySitesCreatedException]
      }

      "create a default homepage, with a title authored by SystemUser" in {
        val emptyPage = PageParts(guid = "?")
        val pagePath = PagePath(newWebsiteOpt.id, "/", None, false, "")
        val dao = newWebsiteDao()
        val page = dao.createPage(Page.newPage(
          PageRole.WebPage, pagePath, emptyPage, author = SystemUser.User))
        homepageId = page.id
        dao.savePageActions(page.withoutPath, List(homepageTitle))
        ok
      }

      "load the homepage title by SystemUser" in {
        // Now the DbDao must use SystemUser._ stuff instead of creating
        // new login, identity and user.
        newWebsiteDao().loadPageParts(homepageId) must beLike {
          case Some(page: PageParts) =>
            page.title must be like {
              case Some(title) =>
                title.currentText must_== homepageTitle.payload.text
                title.user_! must_== SystemUser.User
            }
        }
      }
    }



    // -------- Qutoa

    "manage quota" >> {

      lazy val role = globalPasswordUser
      lazy val ip = "1.2.3.4"

      lazy val tenantConsumer = QuotaConsumer.Tenant(defaultTenantId)
      lazy val tenantIpConsumer = QuotaConsumer.PerTenantIp(defaultTenantId, ip)
      lazy val globalIpConsumer = QuotaConsumer.GlobalIp(ip)
      lazy val roleConsumer = QuotaConsumer.Role(defaultTenantId, roleId = role.id)

      lazy val consumers = List[QuotaConsumer](
         tenantConsumer, tenantIpConsumer, globalIpConsumer, roleConsumer)

      "find none, if there is none" in {
        val quotaStateByConsumer = systemDbDao.loadQuotaState(consumers)
        quotaStateByConsumer must beEmpty
      }

      "do nothin, if nothing to do" in {
        systemDbDao.useMoreQuotaUpdateLimits(Map[QuotaConsumer, QuotaDelta]())
          // ... should throw nothing
        pending
      }

      lazy val initialQuotaUse = QuotaUse(paid = 0, free = 200, freeload = 300)

      lazy val firstLimits = QuotaUse(0, 1002, 1003)

      lazy val initialResUse = ResourceUse(
         numIdsUnau = 2,
         numIdsAu = 3,
         numRoles = 4,
         numPages = 5,
         numActions = 6,
         numActionTextBytes = 7,
         numNotfs = 8,
         numEmailsOut = 9,
         numDbReqsRead = 10,
         numDbReqsWrite = 11)

      lazy val initialDeltaTenant = QuotaDelta(
         mtime = new ju.Date,
         deltaQuota = initialQuotaUse,
         deltaResources = initialResUse,
         newFreeLimit = firstLimits.free,
         newFreeloadLimit = firstLimits.freeload,
         initialDailyFree = 50,
         initialDailyFreeload = 60,
         foundInDb = false)

      lazy val initialDeltaTenantIp = initialDeltaTenant.copy(
         initialDailyFreeload = 61)

      lazy val initialDeltaGlobalIp = initialDeltaTenant.copy(
         initialDailyFreeload = 62)

      lazy val initialDeltaRole = initialDeltaTenant.copy(
         initialDailyFreeload = 63)

      lazy val initialDeltas = Map[QuotaConsumer, QuotaDelta](
         tenantConsumer -> initialDeltaTenant,
         tenantIpConsumer -> initialDeltaTenantIp,
         globalIpConsumer -> initialDeltaGlobalIp,
         roleConsumer -> initialDeltaRole)

      lazy val initialQuotaStateTenant = QuotaState(
         ctime = initialDeltaTenant.mtime,
         mtime = initialDeltaTenant.mtime,
         quotaUse = initialQuotaUse,
         quotaLimits = firstLimits,
         quotaDailyFree = 50,
         quotaDailyFreeload = 60,
         resourceUse = initialResUse)

      lazy val initialQuotaStateTenantIp = initialQuotaStateTenant.copy(
         quotaDailyFreeload = 61)

      lazy val initialQuotaStateGlobalIp = initialQuotaStateTenant.copy(
         quotaDailyFreeload = 62)

      lazy val initialQuotaStateRole = initialQuotaStateTenant.copy(
         quotaDailyFreeload = 63)

      "create new quota entries, when adding quota" in {
        systemDbDao.useMoreQuotaUpdateLimits(initialDeltas)
        val quotaStateByConsumer = systemDbDao.loadQuotaState(consumers)

        quotaStateByConsumer.get(tenantConsumer) must_==
           Some(initialQuotaStateTenant)

        quotaStateByConsumer.get(tenantIpConsumer) must_==
           Some(initialQuotaStateTenantIp)

        quotaStateByConsumer.get(globalIpConsumer) must_==
           Some(initialQuotaStateGlobalIp)

        quotaStateByConsumer.get(roleConsumer) must_==
           Some(initialQuotaStateRole)
      }

      var laterQuotaStateTenant: QuotaState = null
      var laterQuotaStateGlobalIp: QuotaState = null

      "add quota and resource deltas, set new limits" in {
        // Add the same deltas again, but with new limits and mtime.

        val laterTime = new ju.Date
        val newLimits = initialQuotaStateTenant.quotaLimits.copy(
           free = 2002, freeload = 2003)

        val laterDeltas = initialDeltas.mapValues(_.copy(
          mtime = laterTime,
          newFreeLimit = newLimits.free,
          newFreeloadLimit = newLimits.freeload,
          foundInDb = true))

        laterQuotaStateTenant = initialQuotaStateTenant.copy(
          mtime = laterTime,
          quotaUse = initialQuotaUse + initialQuotaUse,
          quotaLimits = newLimits,
          resourceUse = initialResUse + initialResUse)

        val laterQuotaStateTenantIp = laterQuotaStateTenant.copy(
          quotaDailyFreeload = 61)

        laterQuotaStateGlobalIp = laterQuotaStateTenant.copy(
          quotaDailyFreeload = 62)

        val laterQuotaStateRole = laterQuotaStateTenant.copy(
          quotaDailyFreeload = 63)

        systemDbDao.useMoreQuotaUpdateLimits(laterDeltas)
        val quotaStateByConsumer = systemDbDao.loadQuotaState(consumers)

        quotaStateByConsumer.get(tenantConsumer) must_==
           Some(laterQuotaStateTenant)

        quotaStateByConsumer.get(tenantIpConsumer) must_==
           Some(laterQuotaStateTenantIp)

        quotaStateByConsumer.get(globalIpConsumer) must_==
           Some(laterQuotaStateGlobalIp)

        quotaStateByConsumer.get(roleConsumer) must_==
           Some(laterQuotaStateRole)
      }

      "not lower limits or time" in {
        val lowerLimits = initialQuotaStateTenant.quotaLimits.copy(
          free = 502, freeload = 503)
        // Set time to 10 ms before current mtime.
        val earlierTime = new ju.Date(
           laterQuotaStateTenant.mtime.getTime - 10)

        val lowerLimitsDelta = QuotaDelta(
          // This mtime should be ignored, because it's older than db mtime.
          mtime = earlierTime,
          deltaQuota = QuotaUse(),
          deltaResources = ResourceUse(),
          // These 2 limits should be ignored: the Dao won't
          // lower the limits.
          newFreeLimit = lowerLimits.free,
          newFreeloadLimit = lowerLimits.freeload,
          // These 2 limits should not overwrite db values.
          initialDailyFree = 1,
          initialDailyFreeload = 2,
          foundInDb = true)

        // Keep mtime and limits unchanged.
        val unchangedQuotaState = laterQuotaStateTenant

        systemDbDao.useMoreQuotaUpdateLimits(
          Map(tenantConsumer -> lowerLimitsDelta))

        val quotaStateByConsumer =
           systemDbDao.loadQuotaState(tenantConsumer::Nil)

        quotaStateByConsumer.get(tenantConsumer) must_==
           Some(unchangedQuotaState)
      }

      "not complain if other server just created quota state entry" in {
        // Set foundInDb = false, for an entry that already exists.
        // The server will attempt to insert it, which causes a unique key
        // error. But the server should swallow it, and continue
        // creating entries for other consumers, and then add deltas.

        val timeNow = new ju.Date
        assert(!initialDeltaGlobalIp.foundInDb)
        val delta = initialDeltaGlobalIp.copy(mtime = timeNow)

        // First and Last are new consumers. Middle already exists.
        val globalIpConsumerFirst = QuotaConsumer.GlobalIp("0.0.0.0")
        val globalIpConsumerMiddle = globalIpConsumer
        val globalIpConsumerLast = QuotaConsumer.GlobalIp("255.255.255.255")
        val ipConsumers = List(
          globalIpConsumerFirst, globalIpConsumerMiddle, globalIpConsumerLast)

        val deltas = Map[QuotaConsumer, QuotaDelta](
           globalIpConsumerFirst -> delta,
           globalIpConsumerMiddle -> delta,  // causes unique key error
           globalIpConsumerLast -> delta)

        val resultingStateFirstLast = initialQuotaStateGlobalIp.copy(
           ctime = timeNow,
           mtime = timeNow)

        val resultingStateMiddle = laterQuotaStateGlobalIp.copy(
           mtime = timeNow,
           quotaUse = laterQuotaStateGlobalIp.quotaUse + initialQuotaUse,
           resourceUse = laterQuotaStateGlobalIp.resourceUse + initialResUse)

        // New entries sould be created for First and Last,
        // although new-entry-creation fails for Middle (already exists).
        systemDbDao.useMoreQuotaUpdateLimits(deltas)
        val quotaStateByConsumer = systemDbDao.loadQuotaState(ipConsumers)

        quotaStateByConsumer.get(globalIpConsumerFirst) must_==
           Some(resultingStateFirstLast)

        quotaStateByConsumer.get(globalIpConsumerMiddle) must_==
           Some(resultingStateMiddle)

        quotaStateByConsumer.get(globalIpConsumerLast) must_==
           Some(resultingStateFirstLast)
      }

    }


    // -------------
    //val ex3_emptyPost = RawPostAction.copyCreatePost(T.post,
    // parentPostId = Page.BodyId, text = "Lemmings!")
    //"create many many random posts" in {
    //  for (i <- 1 to 10000) {
    //    dao.savePageActions(
    //          "-"+ testPage.parts (what??), List(ex3_emptyPost)) must beLike {
    //      case List(p: Post) => ok
    //    }
    //  }
    //}
  }

  step {
    ctx.shutdown()
  }

}


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

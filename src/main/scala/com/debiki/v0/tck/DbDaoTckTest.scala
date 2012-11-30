/**
 * Copyright (c) 2011 Kaj Magnus Lindberg (born 1979)
 * Created on 2011-05-29.
 */

package com.debiki.v0.tck

import scala.collection.{mutable => mut}
import com.debiki.v0
import com.debiki.v0._
import com.debiki.v0.Prelude._
import org.specs2.mutable._
import java.{util => ju}
import DebikiSpecs._
import DbDaoTckTest._

/*

======================================
 Technology Compatibility Kit (TCK)
======================================


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


trait TestContext {
  def dbDaoFactory: DbDaoFactory
  def quotaManager: QuotaCharger
  // def close() // = daoFactory.systemDbDao.close()
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
  extends Specification {

  sequential

  // Inited in setup() below and closed in SpecContext below, after each test.
  var ctx: TestContext = _

  def newTenantDbDao(quotaConsumers: QuotaConsumers) =
    ctx.dbDaoFactory.newTenantDbDao(quotaConsumers)

  def systemDbDao = ctx.dbDaoFactory.systemDbDao

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
  // "[error] could not run test com.debiki.v0.oracledaotcktest:
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

  "A v0.DAO in a completely empty repo" when schemaIsEmpty should {
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
  val login = v0.Login(id = "?", prevLoginId = None, ip = "1.1.1.1",
    date = new ju.Date, identityId = "?i")
  val identitySimple = v0.IdentitySimple(id = "?i", userId = "?",
    name = "Målligan", email = "no@email.no", location = "", website = "")
  val identityOpenId = v0.IdentityOpenId(id = "?i", userId = "?",
    oidEndpoint = "provider.com/endpoint", oidVersion = "2",
    oidRealm = "example.com", oidClaimedId = "claimed-id.com",
    oidOpLocalId = "provider.com/local/id",
    firstName = "Laban", email = "oid@email.hmm", country = "Sweden")
  val post = v0.Post(id = "?", parent = "1", ctime = new ju.Date,
    loginId = "?", newIp = None, text = "", markup = "para",
    tyype = v0.PostType.Text, where = None, approval = None)
  val rating = v0.Rating(id = "?", postId = "1", loginId = "?",
    newIp = None, ctime = new ju.Date, tags = Nil)
}

class DbDaoV002ChildSpec(testContextBuilder: TestContextBuilder)
    extends DbDaoChildSpec(testContextBuilder, "0.0.2") {

  sequential  // so e.g. loginId inited before used in ctors

  import com.debiki.v0._
  import com.debiki.v0.PagePath._  // Guid case classes
  val T = Templates

  step {
    ctx = testContextBuilder.buildTestContext(EmptyTables, defSchemaVersion)
  }

  "A v0.DAO in an empty 0.0.2 repo" should {
    "find version 0.0.2" in {
      systemDbDao.checkRepoVersion() must_== Some("0.0.2")
    }
  }

  step {
    ctx = testContextBuilder.buildTestContext(EmptyTables, defSchemaVersion)
  }

  // COULD split into: 3 tests:
  // Login tests: IdentitySimle, IdentityOpenId.
  // Page tests: create page, reply, update.
  // Path tests: lookup GUID, handle missing/superfluous slash.

  "A v0.DAO in an empty 0.0.2 repo" can {

    //sequential  // so e.g. loginId inited before used in ctors
    // Should be placed at start of Spec only?

    lazy val ex1_postText = "postText0-3kcvxts34wr"
    var ex1_debate: Debate = null
    var loginGrant: LoginGrant = null

    // Why is this needed? There's a `step` above that does this and it should
    // be executed befor the tests below!
    ctx = testContextBuilder.buildTestContext(EmptyTables, defSchemaVersion)


    // -------- Create tenant

    var defaultTenantId = ""

    "find no tenant for non-existing host test.ex.com" in {
      val lookup = systemDbDao.lookupTenant("http", "test.ex.com")
      lookup must_== FoundNothing
    }

    "find no tenant for non-existing tenant id" in {
      systemDbDao.loadTenants("non_existing_id"::Nil) must_== Nil
    }

    "create a Test tenant" in {
      val tenant = systemDbDao.createTenant(name = "Test")
      tenant.name must_== "Test"
      tenant.id must_!= ""
      defaultTenantId = tenant.id
    }

    lazy val dao = newTenantDbDao(v0.QuotaConsumers(tenantId = defaultTenantId))

    "add and lookup host test.ex.com" in {
      dao.addTenantHost(TenantHost("test.ex.com",
         TenantHost.RoleCanonical, TenantHost.HttpsNone))
      val lookup = systemDbDao.lookupTenant("http", "test.ex.com")
      lookup must_== FoundChost(defaultTenantId)
      val lookup2 = dao.lookupOtherTenant("http", "test.ex.com")
      lookup2 must_== FoundChost(defaultTenantId)
    }

    "lookup tenant by id, and find all hosts" in {
      val tenants = systemDbDao.loadTenants(defaultTenantId::Nil)
      tenants must beLike {
        case List(tenant) =>
          tenant.id must_== defaultTenantId
          tenant.name must_== "Test"
          tenant.hosts must_== List(TenantHost(
             "test.ex.com", TenantHost.RoleCanonical, TenantHost.HttpsNone))
        case x => failure(s"Found wrong tenants: $x")
      }
    }

    lazy val defaultPagePath = v0.PagePath(defaultTenantId, "/folder/",
                                    None, false, "page-title")


    // -------- Simple logins

    "throw error for an invalid login id" in {
      val debateBadLogin = Debate(guid = "?", posts =
          T.post.copy(id = "1", loginId = "9999999")::Nil) // bad login id
      //SLog.info("Expecting ORA-02291: integrity constraint log message ------")
      dao.createPage(PageStuff.forNewPage(defaultPagePath, debateBadLogin)
                    ) must throwAn[Exception]
      //SLog.info("------------------------------------------------------------")
    }

    "save an IdentitySimple login" in {
      val loginReq = LoginRequest(T.login, T.identitySimple)
      loginGrant = dao.saveLogin(loginReq)
      loginGrant.login.id must_!= "?"
      loginGrant.user must matchUser(
          displayName = "Målligan", email = "no@email.no")
      loginGrant.user.id must startWith("-") // dummy user ids start with -
    }

    lazy val loginId = loginGrant.login.id

    "reuse the IdentitySimple and User" in {
      val loginReq = LoginRequest(T.login.copy(date = new ju.Date),
                            T.identitySimple)  // same identity
      var grant = dao.saveLogin(loginReq)
      grant.login.id must_!= loginGrant.login.id  // new login id
      grant.identity must_== loginGrant.identity  // same identity
      grant.user must matchUser(loginGrant.user)  // same user
    }

    "create a new dummy User for an IdentitySimple with different website" in {
      val loginReq = LoginRequest(T.login.copy(date = new ju.Date),
          T.identitySimple.copy(website = "weirdplace"))
      var grant = dao.saveLogin(loginReq)
      grant.login.id must_!= loginGrant.login.id  // new login id
      // New identity because website changed.  COULD: create matchIdentity()
      val si = grant.identity.asInstanceOf[IdentitySimple]
      si.id must_!= loginGrant.identity.id
      si.name must_== "Målligan"
      si.website must_== "weirdplace"
      // New user too. A new dummy user is created for each IdentitySimple.
      grant.user.id must_!= loginGrant.user.id
      grant.user must matchUser(loginGrant.user, id = grant.user.id,
                                website = "weirdplace")
    }

    //"have exactly one user" in {  // no, 2??
    //}

    "create a new User for an IdentitySimple with different email" in {
      val loginReq = LoginRequest(T.login.copy(date = new ju.Date),
        T.identitySimple.copy(email = "other@email.yes"))
      var grant = dao.saveLogin(loginReq)
      grant.login.id must_!= loginGrant.login.id  // new login id
      // New identity because email changed.
      val si = grant.identity.asInstanceOf[IdentitySimple]
      si.id must_!= loginGrant.identity.id
      si.name must_== "Målligan"
      si.email must_== "other@email.yes"
      // New user because email has changed.
      // (For an IdentitySimple, email+name identifies the user.)
      grant.user.id must_!= loginGrant.user.id
      grant.user must matchUser(loginGrant.user, id = grant.user.id,
                                email = "other@email.yes")
     }

    "create a new User for an IdentitySimple with different name" in {
      val loginReq = LoginRequest(T.login.copy(date = new ju.Date),
        T.identitySimple.copy(name = "Spöket Laban"))
      var grant = dao.saveLogin(loginReq)
      grant.login.id must_!= loginGrant.login.id  // new login id
      // New identity because name changed.
      val si = grant.identity.asInstanceOf[IdentitySimple]
      si.id must_!= loginGrant.identity.id
      si.name must_== "Spöket Laban"
      si.email must_== "no@email.no"
      // New user because email has changed.
      // (For an IdentitySimple, email+name identifies the user.)
      grant.user.id must_!= loginGrant.user.id
      //grant.user must matchUser(loginGrant.user, id = grant.user.id,
      // why this ok?
      grant.user must matchUser(loginGrant.user, id = grant.user.id,
        //email = "other@email.yes")
        displayName = "Spöket Laban")
    }

    // "create a new User for an IdentitySimple, for another tenant" in {
    // }


    // -------- List no pages

    "list no pages, if there are none" in {
      val pagePathsDetails = dao.listPagePaths(
        PathRanges(trees = Seq("/")),  // all pages
        include = v0.PageStatus.All,
        sortBy = v0.PageSortOrder.ByPath,
        limit = Int.MaxValue,
        offset = 0
      )
      pagePathsDetails.length must_== 0
    }


    // -------- Page creation

    lazy val ex1_rootPost = T.post.copy(
      id = "1", loginId = loginId, text = ex1_postText)

    "create a debate with a root post" in {
      val debateNoId = Debate(guid = "?", posts = ex1_rootPost::Nil)
      val page = dao.createPage(
        PageStuff.forNewPage(defaultPagePath, debateNoId))
      val actions = page.actions
      ex1_debate = actions
      actions.postCount must_== 1
      actions.guid.length must be_>(1)  // not = '?'
      actions must havePostLike(ex1_rootPost)
    }

    "find the debate and the post again" in {
      dao.loadPage(ex1_debate.guid) must beLike {
        case Some(d: Debate) => {
          d must havePostLike(ex1_rootPost)
        }
      }
    }

    "find the debate and the login and user again" in {
      dao.loadPage(ex1_debate.guid) must beLike {
        case Some(d: Debate) => {
          d.people.nilo(ex1_rootPost.loginId) must beLike {
            case Some(n: NiLo) =>  // COULD make separate NiLo test?
              n.login.id must_== ex1_rootPost.loginId
              n.login.identityId must_== n.identity_!.id
              n.identity_!.userId must_== n.user_!.id
              n.user_! must matchUser(displayName = "Målligan",
                                      email = "no@email.no")
          }
        }
      }
    }


    // -------- List one page

    "list the recently created page" in {
      val pagePathsDetails = dao.listPagePaths(
        PathRanges(trees = Seq("/")),
        include = v0.PageStatus.All,
        sortBy = v0.PageSortOrder.ByPath,
        limit = Int.MaxValue,
        offset = 0
      )
      pagePathsDetails must beLike {
        case List((pagePath, pageDetails)) =>
          pagePath must_== defaultPagePath.copy(pageId = pagePath.pageId)
          // When I've implemented Draft/Published status, Draft will be
          // the default:
          pageDetails.status must_== PageStatus.Published
          // There page currently has no title.
          // It's published by default though.
          pageDetails.cachedTitle must_== None
          pageDetails.cachedPublTime must_!= None
          // Shouldn't the page body post affect the
          // significant-modification-time?
          // pageDetails.cachedSgfntMtime must_== None  -- or Some(date)?
      }
    }

    "list nothing for an empty list" in {
      val pathsAndPages = dao.loadPageBodiesTitles(Nil)
      pathsAndPages must beEmpty
    }

    "list no body and title, for a non-existing page" in {
      val badPath = PagePath(
        tenantId = defaultTenantId,
        folder = "/",
        pageId = Some("nonexistingpage"),
        showId = true,
        pageSlug = "page-slug")
      val pathsAndPages = dao.loadPageBodiesTitles(List(badPath))
      pathsAndPages must beLike { case List(pathAndPage) =>
        pathAndPage._1 must_== badPath
        pathAndPage._2 must beEmpty
      }
    }

    "list body and title, for a page that exists" in {
      val pathAndDetails = dao.listPagePaths(
        PathRanges(trees = Seq("/")),
        include = v0.PageStatus.All,
        sortBy = v0.PageSortOrder.ByPath,
        limit = Int.MaxValue,
        offset = 0)
      pathAndDetails.length must be_>=(1)
      val path: PagePath = pathAndDetails.head._1

      val pathsAndPages = dao.loadPageBodiesTitles(path::Nil)
      pathsAndPages must beLike { case List(pathAndPage) =>
        pathAndPage._1 must_== path
        pathAndPage._2 must beLike { case Some(page) =>
          page.bodyText must beSome
          page.bodyText.get.length must be_>(0)
          page.body_!.user must beSome

          /* Currently there is no title for the test page.
          page.title must beSome
          page.titleText.get.length must be_>(0)
          page.title_!.user must beSome
          */
        }
      }
    }


    // -------- Page meta info

    "create, load and save meta info" >> {

      var blogMainPageId = "?"
      var blogArticleId = "?"

      "create a BlogMainPage" in {
        val pageNoId = PageStuff(
          PageMeta.forNewPage("?", now, PageRole.BlogMainPage,
            parentPageId = None),
          defaultPagePath.copy(
            showId = true, pageSlug = "role-test-blog-main"),
          Debate(guid = "?"))

        pageNoId.meta.pageExists must_== false
        val page = dao.createPage(pageNoId)

        page.meta.pageExists must_== true
        page.meta.pageRole must_== PageRole.BlogMainPage
        page.meta.parentPageId must_== None

        val actions = page.actions
        blogMainPageId = actions.pageId
        actions.postCount must_== 0
        actions.pageId.length must be_>(1)  // not = '?'
      }

      "look up meta info for the BlogMainPage" in {
        dao.loadPageMeta(blogMainPageId) must beLike {
          case Some(pageMeta: PageMeta) => {
            pageMeta.pageExists must_== true
            pageMeta.pageRole must_== PageRole.BlogMainPage
            pageMeta.parentPageId must_== None
            pageMeta.pageId must_== blogMainPageId
          }
        }
      }

      "create a child BlogArticle" in {
        val pageNoId = PageStuff(
          PageMeta(pageId = "?", pageRole = PageRole.BlogArticle,
            parentPageId = Some(blogMainPageId),
            creationDati = now, modificationDati = now),
          defaultPagePath.copy(
            showId = true, pageSlug = "role-test-blog-article"),
          Debate(guid = "?"))
        val page = dao.createPage(pageNoId)
        val actions = page.actions
        blogArticleId = actions.pageId
        actions.postCount must_== 0
        actions.pageId.length must be_>(1)  // not = '?'
      }

      "look up meta info for the BlogArticle" in {
        dao.loadPageMeta(blogArticleId) must beLike {
          case Some(pageMeta: PageMeta) => {
            pageMeta.pageRole must_== PageRole.BlogArticle
            pageMeta.parentPageId must_== Some(blogMainPageId)
            pageMeta.pageId must_== blogArticleId
          }
        }
      }

      "find no child pages of a non-existing page" in {
        val childs = dao.listChildPages("doesNotExist",
          PageSortOrder.ByPublTime, limit = 10)
        childs.length must_== 0
      }

      "find no child pages of a page with no children" in {
        val childs = dao.listChildPages(blogArticleId,
          PageSortOrder.ByPublTime, limit = 10)
        childs.length must_== 0
      }

      def testBlogArticleMeta(meta: PageMeta) = {
        meta.pageId must_== blogArticleId
        meta.pageRole must_== PageRole.BlogArticle
        meta.parentPageId must_== Some(blogMainPageId)
      }

      "find child pages of the BlogMainPage" in {
        val childs = dao.listChildPages(blogMainPageId,
          PageSortOrder.ByPublTime, limit = 10)
        childs.length must_== 1
        childs must beLike {
          case List((pagePath, pageMeta)) =>
            pagePath.pageId must_== Some(blogArticleId)
            testBlogArticleMeta(pageMeta)
        }
      }

      "update all BlogArticle meta info"  in {
        val blogArticleMeta = dao.loadPageMeta(blogArticleId) match {
          case Some(pageMeta: PageMeta) =>
            testBlogArticleMeta(pageMeta) // extra test
            pageMeta
          case x => failure(s"Bad meta: $x")
        }
        // Edit meta
        val nextDay = new ju.Date(
          blogArticleMeta.modificationDati.getTime + 1000 * 3600 * 24)
        val newMeta = blogArticleMeta.copy(
          pageRole = PageRole.Any,
          parentPageId = None,
          cachedTitle = Some("NewCachedPageTitle"),
          modificationDati = nextDay)
        dao.updatePageMeta(newMeta)
        // Reload and test
        dao.loadPageMeta(blogArticleId) must beLike {
          case Some(meta2: PageMeta) =>
            meta2 must_== newMeta
        }
      }
    }


    // -------- Paths

    // COULD: Find the Identity again, and the User.

    lazy val exPagePath = defaultPagePath.copy(pageId = Some(ex1_debate.guid))
    "recognize its correct PagePath" in {
      dao.checkPagePath(exPagePath) must beLike {
        case Some(correctPath: PagePath) =>
          correctPath must matchPagePath(exPagePath)
        case p => failure(s"Bad path: $p")
      }
    }

    "correct an incorrect PagePath name" in {
      dao.checkPagePath(exPagePath.copy(pageSlug = "incorrect")) must beLike {
        case Some(correctPath: PagePath) =>
          correctPath must matchPagePath(exPagePath)
        case p => failure(s"Bad path: $p")
      }
    }

    "correct an incorrect PagePath folder" in {
      dao.checkPagePath(exPagePath.copy(folder = "/incorrect/")) must beLike {
        case Some(correctPath: PagePath) =>
          correctPath must matchPagePath(exPagePath)
        case p => failure(s"Bad path: $p")
      }
    }

    //"remove a superfluous slash in a no-guid path" in {
    //}

    //"add a missing slash to a folder index" in {
    //}

    // -------- Page actions

    lazy val ex2_emptyPost = T.post.copy(parent = "1", text = "",
      loginId = loginId)
    var ex2_id = ""
    "save an empty root post child post" in {
      dao.savePageActions(ex1_debate.guid, List(ex2_emptyPost)) must beLike {
        case List(p: Post) =>
          ex2_id = p.id
          p must matchPost(ex2_emptyPost, id = ex2_id)
      }
    }

    "find the empty post again" in {
      dao.loadPage(ex1_debate.guid) must beLike {
        case Some(d: Debate) => {
          d must havePostLike(ex2_emptyPost, id = ex2_id)
        }
      }
    }

    var ex3_ratingId = ""
    lazy val ex3_rating = T.rating.copy(loginId = loginId,
        postId = "1",  tags = "Interesting"::"Funny"::Nil)  // 2 tags
    "save a post rating, with 2 tags" in {
      dao.savePageActions(ex1_debate.guid, List(ex3_rating)) must beLike {
        case List(r: Rating) =>
          ex3_ratingId = r.id
          r must matchRating(ex3_rating, id = ex3_ratingId, loginId = loginId)
      }
    }

    "find the rating again" in {
      dao.loadPage(ex1_debate.guid) must beLike {
        case Some(d: Debate) => {
          d must haveRatingLike(ex3_rating, id = ex3_ratingId)
        }
      }
    }

    var ex4_rating1Id = ""
    lazy val ex4_rating1 =
      T.rating.copy(id = "?1", postId = "1", loginId = loginId,
                    tags = "Funny"::Nil)
    var ex4_rating2Id = ""
    lazy val ex4_rating2 =
      T.rating.copy(id = "?2", postId = "1", loginId = loginId,
                    tags = "Boring"::"Stupid"::Nil)
    var ex4_rating3Id = ""
    lazy val ex4_rating3 =
      T.rating.copy(id = "?3", postId = "1", loginId = loginId,
                    tags = "Boring"::"Stupid"::"Funny"::Nil)
    "save 3 ratings, with 1, 2 and 3 tags" in {
      dao.savePageActions(ex1_debate.guid,
                List(ex4_rating1, ex4_rating2, ex4_rating3)
      ) must beLike {
        case List(r1: Rating, r2: Rating, r3: Rating) =>
          ex4_rating1Id = r1.id
          r1 must matchRating(ex4_rating1, id = ex4_rating1Id)
          ex4_rating2Id = r2.id
          r2 must matchRating(ex4_rating2, id = ex4_rating2Id)
          ex4_rating3Id = r3.id
          r3 must matchRating(ex4_rating3, id = ex4_rating3Id)
      }
    }

    "find the 3 ratings again" in {
      dao.loadPage(ex1_debate.guid) must beLike {
        case Some(d: Debate) => {
          d must haveRatingLike(ex4_rating1, id = ex4_rating1Id)
          d must haveRatingLike(ex4_rating2, id = ex4_rating2Id)
          d must haveRatingLike(ex4_rating3, id = ex4_rating3Id)
        }
      }
    }

    // -------- Entitle a Page

    /*
    "save a Title, load the article with the title" in {
      // Save a Title, for the root post.
      var postId = ""
      val postNoId = T.post.copy(tyype = PostType.Title, text = "Page-Title",
                                  loginId = loginId)
      dao.savePageActions(
            ex1_debate.guid, List(postNoId)) must beLike {
        case List(post: Post) =>
          postId = post.id
          post must_== postNoId.copy(id = postId)
      }

      // Load the root post, check its title.
      dao.loadPage(ex1_debate.guid) must beLike {
        case Some(d: Debate) => {
          d.titleText must_== Some("Page-Title")
          val body = d.body_!
          body.titleText must_== Some("Page-Title")
          body.titlePosts.length must_== 1
        }
      }
    } */


    // -------- Save approvals and rejections

    "Save and load an approval" in {
      testSaveLoadReview(isApproved = true)
    }

    "Save and load a rejection" in {
      testSaveLoadReview(isApproved = false)
    }

    def testSaveLoadReview(isApproved: Boolean) {
      var reviewSaved: Review = null
      val targetId = ex1_rootPost.id
      val approval = if (isApproved) Some(Approval.Manual) else None
      val reviewNoId = Review("?", targetId = targetId, loginId = loginId,
         newIp = None, ctime = now, approval = approval)
      dao.savePageActions(ex1_debate.guid, List(reviewNoId)) must beLike {
        case List(review: Review) =>
          reviewSaved = review
          review must_== reviewNoId.copy(id = review.id)
      }

      dao.loadPage(ex1_debate.guid) must beLike {
        case Some(page: Debate) => {
          val postReviewed = page.vipo_!(reviewSaved.targetId)
          postReviewed.lastReviewDati must_== Some(reviewSaved.ctime)
          postReviewed.lastReviewWasApproval must_== Some(isApproved)
        }
      }
    }


    // -------- Publish a Post

    "save a Publish, load the page body, and now it's published" in {
      // Save a Publ, for the root post.
      var postId = ""
      lazy val postNoId = T.post.copy(tyype = PostType.Publish, loginId = loginId)
      dao.savePageActions(ex1_debate.guid, List(postNoId)) must beLike {
        case List(post: Post) =>
          postId = post.id
          post must_== postNoId.copy(id = postId)
      }

      // Load the root post, verify that it is now published.
      dao.loadPage(ex1_debate.guid) must beLike {
        case Some(d: Debate) => {
          val body = d.body_!
          body.publd must_== Some(true)
          body.publs.length must_== 1
        }
      }
    }

    // -------- Meta info

    var ex2MetaEmpty_id = ""
    lazy val exMeta_ex2EmptyMetaTmpl = T.post.copy(parent = ex2_id,
        text = "", loginId = loginId, tyype = PostType.Meta)
    def exMeta_ex2EmptyMeta = exMeta_ex2EmptyMetaTmpl.copy(id = ex2MetaEmpty_id)
    "save an empty meta post" in {
      dao.savePageActions(ex1_debate.guid, List(exMeta_ex2EmptyMetaTmpl)
      ) must beLike {
        case List(p: Post) =>
          ex2MetaEmpty_id = p.id
          p must matchPost(exMeta_ex2EmptyMeta)
      }
    }

    "find the empty meta again, understand it's for post ex2" in {
      dao.loadPage(ex1_debate.guid) must beLike {
        case Some(d: Debate) => {
          d must havePostLike(exMeta_ex2EmptyMeta, id = ex2MetaEmpty_id)
          val postEx2 = d.vipo_!(ex2_id)
          postEx2.metaPosts must_== List(exMeta_ex2EmptyMeta)
          postEx2.meta.isArticleQuestion must_== false
        }
      }
    }

    var ex2MetaArtQst_id = ""
    lazy val exMeta_ex2ArtQstTmpl = T.post.copy(parent = ex2_id,
        text = "article-question", loginId = loginId, tyype = PostType.Meta)
    def exMeta_ex2ArtQst = exMeta_ex2ArtQstTmpl.copy(id = ex2MetaArtQst_id)
    "save another meta post, wich reads 'article-question'" in {
      dao.savePageActions(ex1_debate.guid,
        List(exMeta_ex2ArtQstTmpl)
      ) must beLike {
        case List(p: Post) =>
          ex2MetaArtQst_id = p.id
          p must matchPost(exMeta_ex2ArtQst)
      }
    }

    "find the article-question meta again, understand what it means" in {
      dao.loadPage(ex1_debate.guid) must beLike {
        case Some(d: Debate) => {
          d must havePostLike(exMeta_ex2ArtQst)
          val postEx2 = d.vipo_!(ex2_id)
          postEx2.metaPosts.length must_== 2
          postEx2.metaPosts.find(_.id == ex2MetaArtQst_id) must_==
                                                    Some(exMeta_ex2ArtQst)
          postEx2.meta.isArticleQuestion must_== true
        }
      }
    }


    var exEdit_postId: String = null
    var exEdit_editId: String = null

    "create a post to edit" >> {
      // Make post creation action
      lazy val postNoId = T.post.copy(parent = "1", text = "Initial text",
        loginId = loginId, markup = "dmd0")

      var post: Post = null

      "save post" in {
        post = dao.savePageActions(ex1_debate.guid, List(postNoId)).head
        post.text must_== "Initial text"
        post.markup must_== "dmd0"
        exEdit_postId = post.id
        ok
      }

      val newText = "Edited text 054F2x"

      "edit the post" in {
        // Make edit actions
        val patchText = makePatch(from = post.text, to = newText)
        val editNoId = Edit(
          id = "?x", postId = post.id, ctime = now, loginId = loginId,
          newIp = None, text = patchText, newMarkup = None,
          approval = None, autoApplied = false)
        val publNoId = EditApp(
          id = "?", editId = "?x", ctime = now,
          loginId = loginId, newIp = None, result = newText,
          approval = None)

        // Save
        val List(edit: Edit, publ: EditApp) =
          dao.savePageActions(ex1_debate.guid, List(editNoId, publNoId))

        exEdit_editId = edit.id

        // Verify text changed
        dao.loadPage(ex1_debate.guid) must beLike {
          case Some(d: Debate) => {
            val editedPost = d.vipo_!(post.id)
            editedPost.text must_== newText
            editedPost.markup must_== "dmd0"
          }
        }
      }

      "change the markup type" in {
        // Make edit actions
        val editNoId = Edit(
          id = "?x", postId = post.id, ctime = now, loginId = loginId,
          newIp = None, text = "", newMarkup = Some("html"),
          approval = None, autoApplied = false)
        val publNoId = EditApp(
          id = "?", editId = "?x", ctime = now,
          loginId = loginId, newIp = None, result = newText,
          approval = None)

        // Save
        val List(edit: Edit, publ: EditApp) =
          dao.savePageActions(ex1_debate.guid, List(editNoId, publNoId))

        // Verify markup type changed
        dao.loadPage(ex1_debate.guid) must beLike {
          case Some(d: Debate) => {
            val editedPost = d.vipo_!(post.id)
            editedPost.text must_== "Edited text 054F2x"
            editedPost.markup must_== "html"
          }
        }
      }
    }



    // -------- Load recent actions

    "load recent actions" >> {

      lazy val badIp = Some("99.99.99.99")
      lazy val ip = Some("1.1.1.1")

      def hasLoginsIdtysAndUsers(people: People) =
        people.logins.nonEmpty && people.identities.nonEmpty &&
        people.users.nonEmpty

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
      }

      "by identity id, find nothing" in {
        val (actions, people) = dao.loadRecentActionExcerpts(
           byIdentity = Some("9999999"), limit = 99)
        actions must beEmpty
        people must_== People.None
      }

      "by identity id, find ..." in {
        // Not implemented, because no OpenID identity currently does anything.
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
        hasLoginsIdtysAndUsers(people) must beTrue
      }

      "by path, find something, in /folder/" in {
        val (actions, people) = dao.loadRecentActionExcerpts(
          pathRanges = PathRanges(folders = Seq(defaultPagePath.folder)),
          limit = 99)
        actions.length must be_>(0)
        hasLoginsIdtysAndUsers(people) must beTrue
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
          pathRanges = PathRanges(pageIds = Seq(ex1_debate.id)),
          limit = 99)
        actions.length must be_>(0)
        hasLoginsIdtysAndUsers(people) must beTrue
      }

      "by page id, folder and tree, find something" in {
        val (actions, people) = dao.loadRecentActionExcerpts(
          pathRanges = PathRanges(
            pageIds = Seq(ex1_debate.id),  // exists
            folders = Seq("/folder/"),  // there's a page in this folder
            trees = Seq("/")),  // everything
          limit = 99)
        actions.length must be_>(0)
        hasLoginsIdtysAndUsers(people) must beTrue
      }
    }



    // -------- OpenID login

    var exOpenId_loginReq: LoginGrant = null
    def exOpenId_loginGrant: LoginGrant = exOpenId_loginReq  // correct name
    var exOpenId_userIds = mut.Set[String]()
    "save a new OpenID login and create a user" in {
      val loginReq = LoginRequest(T.login, T.identityOpenId)
      exOpenId_loginReq = dao.saveLogin(loginReq)
      for (id <- exOpenId_loginReq.login.id ::
                  exOpenId_loginReq.identity.id ::
                  exOpenId_loginReq.user.id :: Nil) {
        id.contains("?") must_== false
        // weird! the compiler says: ';' expected but integer literal found
        // on the next row (if commented in).
        // id.length must be_> 1  // non-empty, and no weird 1 char id

        // Only dummy user ids (created for each IdentitySimple)
        // start with "-":
        id must not startWith("-")
      }
      exOpenId_loginReq.identity.id must_==  exOpenId_loginReq.login.identityId
      exOpenId_loginReq.user.id must_== exOpenId_loginReq.identity.userId
      exOpenId_loginReq.user must matchUser(
          displayName = T.identityOpenId.firstName,
          email = T.identityOpenId.email,
          // Country info not available for all identity types and currently
          // not copied from a new Identity to the related new User.
          country = "", // T.identityOpenId.country,
          website = "",
          isSuperAdmin = Boolean.box(false))
      exOpenId_userIds += exOpenId_loginReq.user.id
      ok
    }

    "reuse the IdentityOpenId and User just created" in {
      val loginReq = LoginRequest(T.login.copy(date = new ju.Date),
          T.identityOpenId)
      val grant = dao.saveLogin(loginReq)
      grant.login.id must_!= exOpenId_loginReq.login.id
      grant.identity must_== exOpenId_loginReq.identity
      // The very same user should have been found.
      grant.user must matchUser(exOpenId_loginReq.user)
    }

    // COULD test to change name + email too, instead of only changing country.

    "update the IdentityOpenId, if attributes (country) changed" in {
      // Change the country attribute. The Dao should automatically save the
      // new value to the database, and use it henceforth.
      val loginReq = LoginRequest(T.login.copy(date = new ju.Date),
          T.identityOpenId.copy(country = "Norway"))
      val grant = dao.saveLogin(loginReq)
      grant.login.id must_!= exOpenId_loginReq.login.id
      grant.identity must_== exOpenId_loginReq.identity.
          asInstanceOf[IdentityOpenId].copy(country = "Norway")
      // The user shouldn't have been changed, only the OpenID identity attrs.
      grant.user must matchUser(exOpenId_loginReq.user)
    }

    //"have exactly one user" in {  // or, 3? there're 2 IdentitySimple users?
    //}

    var exOpenId_loginGrant_2: LoginGrant = null

    // COULD test w/ new tenant but same claimed_ID, should also result in
    // a new User. So you can customize your user, per tenant.
    "create new IdentityOpenId and User for a new claimed_id" in {
      val loginReq = LoginRequest(T.login.copy(date = new ju.Date),
        T.identityOpenId.copy(oidClaimedId = "something.else.com"))
      val grant = dao.saveLogin(loginReq)
      grant.login.id must_!= exOpenId_loginReq.login.id
      // A new id to a new user, but otherwise identical.
      grant.user.id must_!= exOpenId_loginReq.user.id
      grant.user must matchUser(exOpenId_loginReq.user, id = grant.user.id)
      exOpenId_userIds.contains(grant.user.id) must_== false
      exOpenId_userIds += grant.user.id
      exOpenId_loginGrant_2 = grant
    }

    var exGmailLoginGrant: LoginGrant = null

    "create new IdentityOpenId and User for a new claimed_id, Gmail addr" in {
      val loginReq = LoginRequest(T.login.copy(date = new ju.Date),
        T.identityOpenId.copy(
          oidEndpoint = IdentityOpenId.GoogleEndpoint,
          oidRealm = "some.realm.com",
          oidClaimedId = "google.claimed.id",
          email = "example@gmail.com"))
      exGmailLoginGrant = dao.saveLogin(loginReq)
      val grant = exGmailLoginGrant
      exOpenId_userIds.contains(grant.user.id) must_== false
      exOpenId_userIds += grant.user.id
      ok
    }

    "lookup OpenID identity, by login id" in {
      dao.loadIdtyDetailsAndUser(
          forLoginId = exGmailLoginGrant.login.id) must beLike {
        case Some((identity, user)) =>
          identity must_== exGmailLoginGrant.identity
          user must_== exGmailLoginGrant.user
      }
    }

    "lookup OpenID identity, by claimed id" in {
      // (Use _2 because the first one has had its country modified)
      val oidSaved = exOpenId_loginGrant_2.identity.asInstanceOf[IdentityOpenId]
      val partialIdentity = oidSaved.copy(id = "?", userId = "?")
      dao.loadIdtyDetailsAndUser(forIdentity = partialIdentity) must beLike {
        case Some((identity, user)) =>
          identity must_== exOpenId_loginGrant_2.identity
          user must_== exOpenId_loginGrant_2.user
      }
    }

    "lookup OpenID identity, by email, for Gmail" in {
      val partialIdentity = IdentityOpenId(
         id = "?", userId = "?", oidEndpoint = IdentityOpenId.GoogleEndpoint,
         oidVersion = "?", oidRealm = "?", oidClaimedId = "?",
         oidOpLocalId = "?", firstName = "?", email = "example@gmail.com",
         country = "?")
      dao.loadIdtyDetailsAndUser(forIdentity = partialIdentity) must beLike {
        case Some((identity, user)) =>
          identity must_== exGmailLoginGrant.identity
          user must_== exGmailLoginGrant.user
      }
    }

    //"have exactly two users" in {  // no, 4? 2 + 2 = 4
    //}

    /*
    "create a new user, for a new tenant (but same claimed_id)" in {
      val loginReq = LoginRequest(T.login.copy(date = new ju.Date),
                              T.identityOpenId)
      val grant = dao.saveLogin("some-other-tenant-id", loginReq)
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

    "load relevant OpenID logins, when loading a Page" in {
      // Save a post, using the OpenID login. Load the page and verify
      // the OpenID identity and user were loaded with the page.
      val newPost = T.post.copy(parent = "1", text = "",
                                loginId = exOpenId_loginReq.login.id)
      var postId = "?"
      dao.savePageActions(ex1_debate.guid, List(newPost)) must beLike {
        case List(savedPost: Post) =>
          postId = savedPost.id
          savedPost must matchPost(newPost, id = postId)
      }

      dao.loadPage(ex1_debate.guid) must beLike {
        case Some(d: Debate) =>
          d must havePostLike(newPost, id = postId)
          d.people.nilo(exOpenId_loginReq.login.id) must beLike {
            case Some(n: NiLo) =>  // COULD make separate NiLo test?
              n.login.id must_== exOpenId_loginReq.login.id
              n.login.identityId must_== n.identity_!.id
              // The OpenID country attr was changed from Sweden to Norway.
              n.identity_! must_== exOpenId_loginReq.identity.
                  asInstanceOf[IdentityOpenId].copy(country = "Norway",
                      // When a page is loaded, uninteresting OpenID details
                      // are not loaded, to save bandwidth. Instead they
                      // are set to "?".
                      oidEndpoint = "?", oidVersion = "?", oidRealm = "?",
                      oidClaimedId = "?", oidOpLocalId = "?")
              n.identity_!.asInstanceOf[IdentityOpenId].firstName must_==
                                                                      "Laban"
              n.identity_!.userId must_== n.user_!.id
              // Identity data no longer copied to User.
              //n.user_! must matchUser(displayName = "Laban",
              //                        email = "oid@email.hmm")
          }
      }
    }

    // -------- Email

    var emailEx_loginGrant: LoginGrant = null
    var emailEx_email = "Imail@ex.com"

    // Test users, *after* they've been configured to receive email.
    var emailEx_UnauUser: User = null
    var emailEx_OpenIdUser: User = null

    "by default send no email to a new IdentitySimple" in {
      val loginReq = LoginRequest(T.login.copy(date = new ju.Date),
        T.identitySimple.copy(email = emailEx_email, name = "Imail"))
      val grant = dao.saveLogin(loginReq)
      val Some((idty, user)) = dao.loadIdtyAndUser(forLoginId = grant.login.id)
      user.emailNotfPrefs must_== EmailNotfPrefs.Unspecified
      emailEx_loginGrant = grant
      ok
    }

    "configure email to IdentitySimple" in {
      def login = emailEx_loginGrant.login
      dao.configIdtySimple(loginId = login.id,
            ctime = new ju.Date, emailAddr = emailEx_email,
            emailNotfPrefs = EmailNotfPrefs.Receive)
      val Some((idty, user)) = dao.loadIdtyAndUser(
         forLoginId = emailEx_loginGrant.login.id)
      user.emailNotfPrefs must_== EmailNotfPrefs.Receive
      emailEx_UnauUser = user  // save, to other test cases
      ok
    }

    "by default send no email to a new Role" in {
      val login = exOpenId_loginGrant.login
      val Some((idty, user)) = dao.loadIdtyAndUser(forLoginId = login.id)
      user.emailNotfPrefs must_== EmailNotfPrefs.Unspecified
    }

    "configure email to a Role" in {
      val userToConfig = exOpenId_loginGrant.user
      val login = exOpenId_loginGrant.login
      dao.configRole(loginId = login.id,
         ctime = new ju.Date, roleId = userToConfig.id,
         emailNotfPrefs = EmailNotfPrefs.Receive)
      val Some((idty, userConfigured)) =
         dao.loadIdtyAndUser(forLoginId = login.id)
      userConfigured.emailNotfPrefs must_== EmailNotfPrefs.Receive
      emailEx_OpenIdUser = userConfigured  // remember, to other test casese
      ok
    }


    // -------- Notifications and emails

    // An unauthenticated user and an authenticated user.
    // They have already been inserted in the db, and want email notfs.
    lazy val unauUser = emailEx_UnauUser
    lazy val auUser = emailEx_OpenIdUser

    // A notification to the unauthenticated user.
    lazy val unauUserNotfSaved = NotfOfPageAction(
      ctime = new ju.Date,
      recipientUserId = unauUser.id,
      pageTitle = "EventPageForUnauUser",
      pageId = ex1_debate.guid,
      eventType = NotfOfPageAction.Type.PersonalReply,
      eventActionId = ex2_id,
      triggerActionId = ex2_id,
      recipientActionId = ex2_emptyPost.parent,
      recipientUserDispName = "RecipientUser",
      eventUserDispName = "EventUser",
      triggerUserDispName = None,
      emailPending = true)

    // A notification to the authenticated user.
    // (Shouldn't really be possible, because now one event+recipientActionId
    // maps to 2 notfs! But after I've added a PK to DW1_NOTFS_PAGE_ACTIONS,
    // that PK will allow only one. Then I'll have to fix/improve this test
    // case.)
    lazy val auUserNotfSaved = unauUserNotfSaved.copy(
      eventActionId = exEdit_editId,
      recipientActionId = exEdit_postId,
      // eventType = should-change-from-reply-to-edit
      recipientUserId = auUser.id,  // not correct but works for this test
      pageTitle = "EventPageForAuUser")

    "load and save notifications" >> {

      "find none, when there are none" in {
        dao.loadNotfByEmailId("BadEmailId") must_== None
        dao.loadNotfsForRole(unauUser.id) must_== Nil
        dao.loadNotfsForRole(unauUser.id) must_== Nil
        val notfsLoaded = systemDbDao.loadNotfsToMailOut(
                                          delayInMinutes = 0, numToLoad = 10)
        notfsLoaded.usersByTenantAndId must_== Map.empty
        notfsLoaded.notfsByTenant must_== Map.empty
      }

      "save one, to an unauthenticated user" >> {

        "load it, by user id" in {
          dao.saveNotfs(unauUserNotfSaved::Nil)

          val notfsLoaded = dao.loadNotfsForRole(unauUser.id)
          notfsLoaded must beLike {
            case List(notfLoaded: NotfOfPageAction) =>
              notfLoaded must_== unauUserNotfSaved
          }
        }

        "load it, by time, to mail out" in {
          val notfsToMail = systemDbDao.loadNotfsToMailOut(
             delayInMinutes = 0, numToLoad = 10)
          notfsToMail.usersByTenantAndId.get((defaultTenantId, unauUser.id)
             ) must_== Some(unauUser)
          val notfsByTenant = notfsToMail.notfsByTenant(defaultTenantId)
          notfsByTenant.length must_== 1
          notfsByTenant.head must_== unauUserNotfSaved
        }
      }

      "save one, to an authenticated user" >> {

        "load it, by user id" in {
          dao.saveNotfs(auUserNotfSaved::Nil)

          val notfsLoaded = dao.loadNotfsForRole(auUser.id)
          notfsLoaded must beLike {
            case List(notfLoaded: NotfOfPageAction) =>
              notfLoaded must_== auUserNotfSaved
          }
        }

        "load it, by time, to mail out" in {
          val notfsToMail = systemDbDao.loadNotfsToMailOut(
             delayInMinutes = 0, numToLoad = 10)
          notfsToMail.usersByTenantAndId.get((defaultTenantId, auUser.id)
             ) must_== Some(auUser)
          val notfsByTenant = notfsToMail.notfsByTenant(defaultTenantId)
          val notfFound = notfsByTenant.find(
             _.recipientUserId == auUserNotfSaved.recipientUserId)
          notfFound must_== Some(auUserNotfSaved)
        }
      }

      "not load any notf, when specifying another user's id " in {
        val notfsLoaded = dao.loadNotfsForRole("WrongUserId")
        notfsLoaded must_== Nil
      }

      "not load any notf, because they are too recent" in {
        val notfsLoaded =
          systemDbDao.loadNotfsToMailOut(delayInMinutes = 15, numToLoad = 10)
        notfsLoaded.usersByTenantAndId must_== Map.empty
        notfsLoaded.notfsByTenant must_== Map.empty
      }

    }


    def testLoginViaEmail(emailId: String, emailSentOk: Email)
          : LoginGrant  = {
      val loginNoId = Login(id = "?", prevLoginId = None, ip = "?.?.?.?",
         date = now, identityId = emailId)
      val loginReq = LoginRequest(loginNoId, IdentityEmailId(emailId))
      val loginGrant = dao.saveLogin(loginReq)
      lazy val emailIdty = loginGrant.identity.asInstanceOf[IdentityEmailId]
      emailIdty.email must_== emailSentOk.sentTo
      emailIdty.notf.flatMap(_.emailId) must_== Some(emailSentOk.id)
      emailIdty.notf.map(_.recipientUserId) must_== Some(loginGrant.user.id)
      loginGrant
    }


    "support emails, to unauthenticated users" >> {

      lazy val emailId = "10"

      lazy val emailToSend = Email(
        id = emailId,
        sentTo = "test@example.com",
        sentOn = None,
        subject = "Test Subject",
        bodyHtmlText = "<i>Test content.</i>",
        providerEmailId = None)

      lazy val emailSentOk = emailToSend.copy(
        sentOn = Some(now),
        providerEmailId = Some("test-provider-id"))

      lazy val emailSentFailed = emailSentOk.copy(
        providerEmailId = None,
        failureText = Some("Test failure"))

      def loadNotfToMailOut(userId: String): Seq[NotfOfPageAction] = {
        val notfsToMail = systemDbDao.loadNotfsToMailOut(
          delayInMinutes = 0, numToLoad = 10)
        val notfs = notfsToMail.notfsByTenant(defaultTenantId)
        val usersNotfs = notfs.filter(_.recipientUserId == userId)
        // All notfs loaded to mail out must have emails pending.
        usersNotfs.filterNot(_.emailPending).size must_== 0
        usersNotfs
      }

      "find the notification to mail out, to the unauth. user" in {
        val notfs: Seq[NotfOfPageAction] = loadNotfToMailOut(unauUser.id)
        notfs.size must_!= 0
        notfs must_== List(unauUserNotfSaved)
      }

      "save an email, connect it to the notification, to the unauth. user" in {
        dao.saveUnsentEmailConnectToNotfs(emailToSend, unauUserNotfSaved::Nil)
          // must throwNothing (how to test that?)
      }

      "skip notf, when loading notfs to mail out; email already created" in {
        val notfs: Seq[NotfOfPageAction] = loadNotfToMailOut(unauUser.id)
        notfs.size must_== 0
      }

      "load the saved email" in {
        val emailLoaded = dao.loadEmailById(emailToSend.id)
        emailLoaded must_== Some(emailToSend)
      }

      "load the notification, find it connected to the email" in {
        // BROKEN many notfs might map to 1 email!
        dao.loadNotfByEmailId(emailToSend.id) must beLike {
          case Some(notf) =>
            notf.emailId must_== Some(emailToSend.id)
          case None => failure("No notf found")
        }
      }

      "update the email, to sent status" in {
        dao.updateSentEmail(emailSentOk)
        // must throwNothing (how to test that?)
      }

      "load the email again, find it in okay status" in {
        val emailLoaded = dao.loadEmailById(emailToSend.id)
        emailLoaded must_== Some(emailSentOk)
      }

      "update the email, to failed status" in {
        dao.updateSentEmail(emailSentFailed)
        // must throwNothing (how to test that?)
      }

      "load the email again, find it in failed status" in {
        val emailLoaded = dao.loadEmailById(emailToSend.id)
        emailLoaded must_== Some(emailSentFailed)
      }

      "update the failed email to sent status (simulates a re-send)" in {
        dao.updateSentEmail(emailSentOk)
        // must throwNothing (how to test that?)
      }

      "load the email yet again, find it in sent status" in {
        val emailLoaded = dao.loadEmailById(emailToSend.id)
        emailLoaded must_== Some(emailSentOk)
      }

      "login and unsubscribe, via email" in {
        val loginGrant = testLoginViaEmail(emailId, emailSentOk)
        loginGrant.user.isAuthenticated must_== false
        dao.configIdtySimple(loginId = loginGrant.login.id,
          ctime = loginGrant.login.date, emailAddr = emailSentOk.sentTo,
          emailNotfPrefs = EmailNotfPrefs.DontReceive)
        // must throwNothing (how to test that?)
      }

      // COULD verify email prefs changed to DontReceive?
    }


    "support emails, to authenticated users" >> {

      lazy val emailId = "11"

      lazy val emailToSend = Email(
        id = emailId,
        sentTo = "test@example.com",
        sentOn = None,
        subject = "Test Subject",
        bodyHtmlText = "<i>Test content.</i>",
        providerEmailId = None)

      lazy val emailSentOk = emailToSend.copy(
        sentOn = Some(now),
        providerEmailId = Some("test-provider-id"))

      "save an email, connect it to a notification, to an auth. user" in {
        dao.saveUnsentEmailConnectToNotfs(emailToSend, auUserNotfSaved::Nil)
        // must throwNothing (how to test that?)
      }

      "load the notification, find it connected to the email" in {
        dao.loadNotfByEmailId(emailToSend.id) must beLike {
          case Some(notf) =>
            notf.emailId must_== Some(emailToSend.id)
          case None => failure("No notf found")
        }
      }

      "update the email, to sent status" in {
        dao.updateSentEmail(emailSentOk)
        // must throwNothing (how to test that?)
      }

      "load the email, find it in sent status" in {
        val emailLoaded = dao.loadEmailById(emailToSend.id)
        emailLoaded must_== Some(emailSentOk)
      }

      "login and unsubscribe, via email" in {
        val loginGrant = testLoginViaEmail(emailId, emailSentOk)
        loginGrant.user.isAuthenticated must_== true
        dao.configRole(loginId = loginGrant.login.id,
          ctime = loginGrant.login.date, roleId = loginGrant.user.id,
          emailNotfPrefs = EmailNotfPrefs.DontReceive)
        // must throwNothing (how to test that?)
      }

      // COULD verify email prefs changed to DontReceive?
    }



    // -------- Move a page

    "move and rename pages" >> {

      lazy val pagePath = dao.lookupPagePathByPageId(ex1_debate.guid).get
      var finalPath: PagePath = null

      "leave a page as is" in {
        // No move/rename options specified:
        dao.moveRenamePage(pageId = ex1_debate.guid) must_== pagePath
      }

      "won't move a non-existing page" in {
        dao.moveRenamePage(
          pageId = "non_existing_page",
          newFolder = Some("/folder/"), showId = Some(false),
          newSlug = Some("new-slug")) must throwAn[Exception]
      }

      "move a page to another folder" in {
        val newPath = dao.moveRenamePage(pageId = ex1_debate.guid,
          newFolder = Some("/new-folder/"))
        newPath.folder must_== "/new-folder/"
        newPath.pageSlug must_== pagePath.pageSlug
        newPath.showId must_== pagePath.showId
      }

      "rename a page" in {
        val newPath = dao.moveRenamePage(
          pageId = ex1_debate.guid,
          showId = Some(!pagePath.showId), // flip
          newSlug = Some("new-slug"))
        newPath.folder must_== "/new-folder/"
        newPath.pageSlug must_== "new-slug"
        newPath.showId must_== !pagePath.showId
      }

      "move and rename a page at the same time" in {
        val newPath = dao.moveRenamePage(
          pageId = ex1_debate.guid,
          newFolder = Some("/new-folder-2/"),
          showId = Some(true), newSlug = Some("new-slug-2"))
        newPath.folder must_== "/new-folder-2/"
        newPath.pageSlug must_== "new-slug-2"
        newPath.showId must_== true

        finalPath = newPath
      }

      "list the page at the correct location" in {
        val pagePathsDetails = dao.listPagePaths(
          PathRanges(trees = Seq("/")),
          include = v0.PageStatus.All,
          sortBy = v0.PageSortOrder.ByPath,
          limit = Int.MaxValue,
          offset = 0
        )
        pagePathsDetails must beLike {
          case list: List[(PagePath, PageMeta)] =>
            list.find(_._1 == finalPath) must beSome
        }
      }
    }



    // -------- Move many pages

    "move many pages" >> {

      "move Nil pages" in {
        dao.movePages(Nil, fromFolder = "/a/", toFolder = "/b/") must_== ()
      }

      "won't move non-existing pages" in {
        dao.movePages(List("nonexistingpage"), fromFolder = "/a/",
            toFolder = "/b/") must_== ()
      }

      "can move page to /move-pages/folder1/" in {
        val pagePath = dao.lookupPagePathByPageId(ex1_debate.guid).get
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
        dao.movePages(pageIds = List(ex1_debate.guid),
          fromFolder = fromFolder, toFolder = toFolder)
        val pagePathAfter = dao.lookupPagePathByPageId(ex1_debate.guid).get
        pagePathAfter.folder must_== Option(resultingFolder).getOrElse(toFolder)
        pagePathAfter.pageId must_== Some(ex1_debate.guid)
      }
    }


    // -------- Create more websites

    "create new websites" >> {

      lazy val creatorLogin = exOpenId_loginGrant.login
      lazy val creatorIdentity =
         exOpenId_loginGrant.identity.asInstanceOf[IdentityOpenId]
      lazy val creatorRole = exOpenId_loginGrant.user

      var newWebsiteOpt: Option[Tenant] = null
      var newHost = TenantHost("website-2.ex.com", TenantHost.RoleCanonical,
         TenantHost.HttpsNone)

      def createWebsite(suffix: String): Option[Tenant] = {
        dao.createWebsite(
          name = "website-"+ suffix, address = "website-"+ suffix +".ex.com",
          ownerIp = creatorLogin.ip, ownerLoginId = creatorLogin.id,
          ownerIdentity = creatorIdentity, ownerRole = creatorRole)
      }

      "create a new website, from existing tenant" in {
        newWebsiteOpt = createWebsite("2")
        newWebsiteOpt must beLike {
          case Some(tenant) => ok
        }
      }

      "not create the same website again" in {
        createWebsite("2") must_== None
      }

      "lookup the new website, from existing tenant" in {
        systemDbDao.loadTenants(newWebsiteOpt.get.id::Nil) must beLike {
          case List(websiteInDb) =>
            websiteInDb must_== newWebsiteOpt.get.copy(hosts = List(newHost))
        }
      }

      "not create too many websites from the same IP" in {
        def create100Websites() {
          for (i <- 3 to 100)
            createWebsite(i.toString)
        }
        create100Websites() must throwAn[OverQuotaException]
      }

    }



    // -------- Qutoa

    "manage quota" >> {

      lazy val role = exOpenId_loginGrant.user
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
      }

      lazy val initialQuotaUse = QuotaUse(paid = 0, free = 200, freeload = 300)

      lazy val firstLimits = QuotaUse(0, 1002, 1003)

      lazy val initialResUse = ResourceUse(
         numLogins = 1,
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
    //val ex3_emptyPost = T.post.copy(parent = "1", text = "Lemmings!")
    //"create many many random posts" in {
    //  for (i <- 1 to 10000) {
    //    dao.savePageActions(
    //          "-"+ ex1_debate.id, List(ex3_emptyPost)) must beLike {
    //      case List(p: Post) => ok
    //    }
    //  }
    //}
  }

}


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

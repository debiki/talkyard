package com.debiki.v0.tck

/**
 * Copyright (c) 2011 Kaj Magnus Lindberg (born 1979)
 * Created on 2011-05-29.
 */

import scala.collection.{mutable => mut}
import com.debiki.v0
import com.debiki.v0.Prelude._
import org.specs._
import org.specs.specification.PendingUntilFixed
import org.specs.specification.Context
import java.{util => ju}
import net.liftweb.common._

/*
======================================
 Technology Compatibility Kit (TCK)
======================================

Test design, including tests of upgrades:

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

import DebikiSpecs._

trait TestContext {
  def daoImpl: v0.DaoSpi
  def close() = dao.close()
  def createRestorePoint(): Unit
  def revertToRestorePoint(): Unit

  /** True if the database schema uses foreign key constraints.
   *  (Most likely an RDBMS.)
   */
  def hasRefConstraints: Boolean
  lazy val dao = new v0.NonCachingDao(daoImpl)
}

object DaoTckTest {
  sealed class What
  case object EmptySchema extends What
  case object EmptyTables extends What
  case object TablesWithData extends What

  type TestContextBuilder = Function2[What, String, TestContext]
}

import DaoTckTest._


abstract class DaoTckTest(builder: TestContextBuilder)
    extends SpecificationWithJUnit {

  "The Technology Compatibility Kit".isSpecifiedBy(
      // Need to empty the schema automatically before enabling this test?
      //new DaoSpecEmptySchema(builder),
      new DaoSpecV002(builder))
}


abstract class DaoSpec(builder: TestContextBuilder, defSchemaVersion: String)
    extends SpecificationWithJUnit {

  def now = new ju.Date

  // "SUS" means Systems under specification, which is a
  // "The system" should { ...examples... } block.
  // See: <http://code.google.com/p/specs/wiki/DeclareSpecifications
  //        #Systems_under_specification>
  def setup(what: What, version: String = defSchemaVersion) = new Context {
    beforeSus({
      ctx = builder(what, version)
    })
  }

  var ctx: TestContext = _  // the speccontext below closes it after each test
  def dao = ctx.dao

  // close the dao and any db connections after each tests.
  // see: <http://code.google.com/p/specs/wiki/declarespecifications
  //                #specification_context>
  // (without `close()', the specs test framework says:
  // "[error] could not run test com.debiki.v0.oracledaotcktest:
  // org.specs.specification.pathexception: treepath(list(0, 0, 1))
  // not found for <the test name>")
  new SpecContext {
    afterSus({
      if (ctx ne null) ctx.close()
    })
  }

  object SLog extends org.specs.log.ConsoleLog  // logs nothing! why?

}


class DaoSpecEmptySchema(b: TestContextBuilder) extends DaoSpec(b, "0") {
  val schemaIsEmpty = setup(EmptySchema)

  "A v0.DAO in a completely empty repo" when schemaIsEmpty should {
    "consider the version being 0" >> {
      dao.checkRepoVersion() must_== Full("0")
    }
    "be able to upgrade to 0.0.2" >> {
      // dao.upgrade()  currently done automatically, but ought not to.
      dao.checkRepoVersion() must_== Full("0.0.2")
    }
  }
}


object Templates {
  val login = v0.Login(id = "?", prevLoginId = None, ip = "?.?.?.?",
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
    tyype = v0.PostType.Text, where = None)
  val rating = v0.Rating(id = "?", postId = "1", loginId = "?",
    newIp = None, ctime = new ju.Date, tags = Nil)
}

class DaoSpecV002(b: TestContextBuilder) extends DaoSpec(b, "0.0.2") {
  val tablesAreEmpty = setup(EmptyTables)

  import com.debiki.v0._
  import com.debiki.v0.PagePath._  // Guid case classes
  val T = Templates

  "A v0.DAO in an empty 0.0.2 repo" when tablesAreEmpty should {
    "find version 0.0.2" >> {
      dao.checkRepoVersion() must_== Full("0.0.2")
    }
  }

  // COULD split into: 3 tests:
  // Login tests: IdentitySimle, IdentityOpenId.
  // Page tests: create page, reply, update.
  // Path tests: lookup GUID, handle missing/superfluous slash.

  "A v0.DAO in an empty 0.0.2 repo" when tablesAreEmpty can {
    setSequential()  // so e.g. loginId inited before used in ctors
    shareVariables()
    // -------------
    val ex1_postText = "postText0-3kcvxts34wr"
    var ex1_debate: Debate = null
    var loginGrant: LoginGrant = null


    // -------- Create tenant

    var defaultTenantId = ""

    "find no tenant for non-existing host test.ex.com" >> {
      val lookup = dao.lookupTenant("http", "test.ex.com")
      lookup must_== FoundNothing
    }

    "find no tenant for non-existing tenant id" >> {
      dao.loadTenants("non_existing_id"::Nil) must_== Nil
    }

    "create a Test tenant" >> {
      val tenant = dao.createTenant("Test")
      tenant.name must_== "Test"
      tenant.id must notBeEmpty
      defaultTenantId = tenant.id
    }

    "add and lookup host test.ex.com" >> {
      dao.addTenantHost(defaultTenantId, TenantHost("test.ex.com",
         TenantHost.RoleCanonical, TenantHost.HttpsNone))
      val lookup = dao.lookupTenant("http", "test.ex.com")
      lookup must_== FoundChost(defaultTenantId)
    }

    "lookup tenant by id, and find all hosts" >> {
      val tenants = dao.loadTenants(defaultTenantId::Nil)
      tenants must beLike {
        case List(tenant) =>
          tenant.id must_== defaultTenantId
          tenant.name must_== "Test"
          tenant.hosts must_== List(TenantHost(
             "test.ex.com", TenantHost.RoleCanonical, TenantHost.HttpsNone))
          true
        case _ => false
      }
    }

    val defaultPagePath = v0.PagePath(defaultTenantId, "/folder/",
                                    None, false, "page-title")


    // -------- Simple logins

    "throw error for an invalid login id" >> {
      val debateBadLogin = Debate(guid = "?", posts =
          T.post.copy(id = "1", loginId = "9999999")::Nil) // bad login id
      SLog.info("Expecting ORA-02291: integrity constraint log message ------")
      dao.createPage(defaultPagePath, debateBadLogin
                    ) must throwAn[Exception]
      SLog.info("------------------------------------------------------------")
    }

    "save an IdentitySimple login" >> {
      val loginReq = LoginRequest(T.login, T.identitySimple)
      loginGrant = dao.saveLogin(defaultTenantId, loginReq)
      loginGrant.login.id must_!= "?"
      loginGrant.user must matchUser(
          displayName = "Målligan", email = "no@email.no")
      loginGrant.user.id must startWith("-") // dummy user ids start with -
    }

    val loginId = loginGrant.login.id

    "reuse the IdentitySimple and User" >> {
      val loginReq = LoginRequest(T.login.copy(date = new ju.Date),
                            T.identitySimple)  // same identity
      var grant = dao.saveLogin(defaultTenantId, loginReq)
      grant.login.id must_!= loginGrant.login.id  // new login id
      grant.identity must_== loginGrant.identity  // same identity
      grant.user must matchUser(loginGrant.user)  // same user
    }

    "create a new dummy User for an IdentitySimple with different website" >> {
      val loginReq = LoginRequest(T.login.copy(date = new ju.Date),
          T.identitySimple.copy(website = "weirdplace"))
      var grant = dao.saveLogin(defaultTenantId, loginReq)
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

    //"have exactly one user" >> {  // no, 2??
    //}

    "create a new User for an IdentitySimple with different email" >> {
      val loginReq = LoginRequest(T.login.copy(date = new ju.Date),
        T.identitySimple.copy(email = "other@email.yes"))
      var grant = dao.saveLogin(defaultTenantId, loginReq)
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

    "create a new User for an IdentitySimple with different name" >> {
      val loginReq = LoginRequest(T.login.copy(date = new ju.Date),
        T.identitySimple.copy(name = "Spöket Laban"))
      var grant = dao.saveLogin(defaultTenantId, loginReq)
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

    // "create a new User for an IdentitySimple, for another tenant" >> {
    // }


    // -------- List no pages

    "list no pages, if there are none" >> {
      val pagePathsDetails = dao.listPagePaths(
        withFolderPrefix = "/",  // all pages
        tenantId = defaultTenantId,
        include = v0.PageStatus.All,
        sortBy = v0.PageSortOrder.ByPath,
        limit = Int.MaxValue,
        offset = 0
      )
      pagePathsDetails.length must_== 0
    }


    // -------- Page creation

    val ex1_rootPost = T.post.copy(
      id = "1", loginId = loginId, text = ex1_postText)

    "create a debate with a root post" >> {
      val debateNoId = Debate(guid = "?", posts = ex1_rootPost::Nil)
      dao.createPage(defaultPagePath, debateNoId) must beLike {
        case Full(d: Debate) =>
          ex1_debate = d
          d.postCount must_== 1
          d.guid.length must be_>(1)  // not = '?'
          d must havePostLike(ex1_rootPost)
          true
      }
    }

    "find the debate and the post again" >> {
      dao.loadPage(defaultTenantId, ex1_debate.guid) must beLike {
        case Full(d: Debate) => {
          d must havePostLike(ex1_rootPost)
          true
        }
      }
    }

    "find the debate and the login and user again" >> {
      dao.loadPage(defaultTenantId, ex1_debate.guid) must beLike {
        case Full(d: Debate) => {
          d.nilo(ex1_rootPost.loginId) must beLike {
            case Some(n: NiLo) =>  // COULD make separate NiLo test?
              n.login.id must_== ex1_rootPost.loginId
              n.login.identityId must_== n.identity_!.id
              n.identity_!.userId must_== n.user_!.id
              n.user_! must matchUser(displayName = "Målligan",
                                      email = "no@email.no")
              true
          }
          true
        }
      }
    }


    // -------- List one page

    "list the recently created page" >> {
      val pagePathsDetails = dao.listPagePaths(
        withFolderPrefix = "/",
        tenantId = defaultTenantId,
        include = v0.PageStatus.All,
        sortBy = v0.PageSortOrder.ByPath,
        limit = Int.MaxValue,
        offset = 0
      )
      pagePathsDetails match {
        case List((pagePath, pageDetails)) =>
          pagePath must_== defaultPagePath.copy(pageId = pagePath.pageId)
          pageDetails.status must_== PageStatus.Draft
          // There page currently has no title and it hasn't been published.
          pageDetails.cachedTitle must_== None
          pageDetails.cachedPublTime must_== None
          // Shouldn't the page body post affect the
          // significant-modification-time?
          // pageDetails.cachedSgfntMtime must_== None  -- or Some(date)?
          true
      }
    }


    // -------- Paths

    // COULD: Find the Identity again, and the User.

    val exPagePath = defaultPagePath.copy(pageId = Some(ex1_debate.guid))
    "recognize its correct PagePath" >> {
      dao.checkPagePath(exPagePath) must beLike {
        case Full(correctPath: PagePath) =>
          correctPath must matchPagePath(exPagePath)
          true
        case _ => false
      }
    }

    "correct an incorrect PagePath name" >> {
      dao.checkPagePath(exPagePath.copy(pageSlug = "incorrect")) must beLike {
        case Full(correctPath: PagePath) =>
          correctPath must matchPagePath(exPagePath)
          true
        case _ => false
      }
    }

    "correct an incorrect PagePath folder" >> {
      dao.checkPagePath(exPagePath.copy(folder = "/incorrect/")) must beLike {
        case Full(correctPath: PagePath) =>
          correctPath must matchPagePath(exPagePath)
          true
        case _ => false
      }
    }

    //"remove a superfluous slash in a no-guid path" >> {
    //}

    //"add a missing slash to a folder index" >> {
    //}

    // -------- Page actions

    val ex2_emptyPost = T.post.copy(parent = "1", text = "",
      loginId = loginId)
    var ex2_id = ""
    "save an empty root post child post" >> {
      dao.savePageActions(defaultTenantId, ex1_debate.guid, List(ex2_emptyPost)
                          ) must beLike {
        case Full(List(p: Post)) =>
          ex2_id = p.id
          p must matchPost(ex2_emptyPost, id = ex2_id)
          true
      }
    }

    "find the empty post again" >> {
      dao.loadPage(defaultTenantId, ex1_debate.guid) must beLike {
        case Full(d: Debate) => {
          d must havePostLike(ex2_emptyPost, id = ex2_id)
          true
        }
      }
    }

    var ex3_ratingId = ""
    val ex3_rating = T.rating.copy(loginId = loginId,
        postId = "1",  tags = "Interesting"::"Funny"::Nil)  // 2 tags
    "save a post rating, with 2 tags" >> {
      dao.savePageActions(defaultTenantId, ex1_debate.guid, List(ex3_rating)
                          ) must beLike {
        case Full(List(r: Rating)) =>
          ex3_ratingId = r.id
          r must matchRating(ex3_rating, id = ex3_ratingId, loginId = loginId)
          true
      }
    }

    "find the rating again" >> {
      dao.loadPage(defaultTenantId, ex1_debate.guid) must beLike {
        case Full(d: Debate) => {
          d must haveRatingLike(ex3_rating, id = ex3_ratingId)
          true
        }
      }
    }

    var ex4_rating1Id = ""
    val ex4_rating1 =
      T.rating.copy(id = "?1", postId = "1", loginId = loginId,
                    tags = "Funny"::Nil)
    var ex4_rating2Id = ""
    val ex4_rating2 =
      T.rating.copy(id = "?2", postId = "1", loginId = loginId,
                    tags = "Boring"::"Stupid"::Nil)
    var ex4_rating3Id = ""
    val ex4_rating3 =
      T.rating.copy(id = "?3", postId = "1", loginId = loginId,
                    tags = "Boring"::"Stupid"::"Funny"::Nil)
    "save 3 ratings, with 1, 2 and 3 tags" >> {
      dao.savePageActions(defaultTenantId, ex1_debate.guid,
                List(ex4_rating1, ex4_rating2, ex4_rating3)
      ) must beLike {
        case Full(List(r1: Rating, r2: Rating, r3: Rating)) =>
          ex4_rating1Id = r1.id
          r1 must matchRating(ex4_rating1, id = ex4_rating1Id)
          ex4_rating2Id = r2.id
          r2 must matchRating(ex4_rating2, id = ex4_rating2Id)
          ex4_rating3Id = r3.id
          r3 must matchRating(ex4_rating3, id = ex4_rating3Id)
          true
      }
    }

    "find the 3 ratings again" >> {
      dao.loadPage(defaultTenantId, ex1_debate.guid) must beLike {
        case Full(d: Debate) => {
          d must haveRatingLike(ex4_rating1, id = ex4_rating1Id)
          d must haveRatingLike(ex4_rating2, id = ex4_rating2Id)
          d must haveRatingLike(ex4_rating3, id = ex4_rating3Id)
          true
        }
      }
    }

    // -------- Entitle a Page

    /*
    "save a Title, load the article with the title" >> {
      // Save a Title, for the root post.
      var postId = ""
      val postNoId = T.post.copy(tyype = PostType.Title, text = "Page-Title",
                                  loginId = loginId)
      dao.savePageActions(
            defaultTenantId, ex1_debate.guid, List(postNoId)) must beLike {
        case Full(List(post: Post)) =>
          postId = post.id
          post must_== postNoId.copy(id = postId)
          true
      }

      // Load the root post, check its title.
      dao.loadPage(defaultTenantId, ex1_debate.guid) must beLike {
        case Full(d: Debate) => {
          d.titleText must_== Some("Page-Title")
          val body = d.body_!
          body.titleText must_== Some("Page-Title")
          body.titlePosts.length must_== 1
          true
        }
      }
    } */

    // -------- Publish a Post

    "save a Publish, load the page body, and now it's published" >> {
      // Save a Publ, for the root post.
      var postId = ""
      val postNoId = T.post.copy(tyype = PostType.Publish, loginId = loginId)
      dao.savePageActions(
        defaultTenantId, ex1_debate.guid, List(postNoId)) must beLike {
        case Full(List(post: Post)) =>
          postId = post.id
          post must_== postNoId.copy(id = postId)
          true
      }

      // Load the root post, verify that it is now published.
      dao.loadPage(defaultTenantId, ex1_debate.guid) must beLike {
        case Full(d: Debate) => {
          val body = d.body_!
          body.publd must_== Some(true)
          body.publs.length must_== 1
          true
        }
      }
    }

    // -------- Meta info

    var ex2MetaEmpty_id = ""
    val exMeta_ex2EmptyMetaTmpl = T.post.copy(parent = ex2_id,
        text = "", loginId = loginId, tyype = PostType.Meta)
    def exMeta_ex2EmptyMeta = exMeta_ex2EmptyMetaTmpl.copy(id = ex2MetaEmpty_id)
    "save an empty meta post" >> {
      dao.savePageActions(defaultTenantId, ex1_debate.guid,
        List(exMeta_ex2EmptyMetaTmpl)
      ) must beLike {
        case Full(List(p: Post)) =>
          ex2MetaEmpty_id = p.id
          p must matchPost(exMeta_ex2EmptyMeta)
          true
      }
    }

    "find the empty meta again, understand it's for post ex2" >> {
      dao.loadPage(defaultTenantId, ex1_debate.guid) must beLike {
        case Full(d: Debate) => {
          d must havePostLike(exMeta_ex2EmptyMeta, id = ex2MetaEmpty_id)
          val postEx2 = d.vipo_!(ex2_id)
          postEx2.metaPosts must_== List(exMeta_ex2EmptyMeta)
          postEx2.meta.isArticleQuestion must_== false
          true
        }
      }
    }

    var ex2MetaArtQst_id = ""
    val exMeta_ex2ArtQstTmpl = T.post.copy(parent = ex2_id,
        text = "article-question", loginId = loginId, tyype = PostType.Meta)
    def exMeta_ex2ArtQst = exMeta_ex2ArtQstTmpl.copy(id = ex2MetaArtQst_id)
    "save another meta post, wich reads 'article-question'" >> {
      dao.savePageActions(defaultTenantId, ex1_debate.guid,
        List(exMeta_ex2ArtQstTmpl)
      ) must beLike {
        case Full(List(p: Post)) =>
          ex2MetaArtQst_id = p.id
          p must matchPost(exMeta_ex2ArtQst)
          true
      }
    }

    "find the article-question meta again, understand what it means" >> {
      dao.loadPage(defaultTenantId, ex1_debate.guid) must beLike {
        case Full(d: Debate) => {
          d must havePostLike(exMeta_ex2ArtQst)
          val postEx2 = d.vipo_!(ex2_id)
          postEx2.metaPosts.length must_== 2
          postEx2.metaPosts.find(_.id == ex2MetaArtQst_id) must_==
                                                    Some(exMeta_ex2ArtQst)
          postEx2.meta.isArticleQuestion must_== true
          true
        }
      }
    }


    var exEdit_postId: String = null
    var exEdit_editId: String = null

    "create a post to edit" >> {
      // Make post creation action
      val postNoId = T.post.copy(parent = "1", text = "Initial text",
        loginId = loginId, markup = "dmd0")

      // Save post
      val Full(List(post: Post)) =
        dao.savePageActions(defaultTenantId, ex1_debate.guid, List(postNoId))

      post.text must_== "Initial text"
      post.markup must_== "dmd0"
      val newText = "Edited text 054F2x"

      exEdit_postId = post.id

      "edit the post" >> {
        // Make edit actions
        val patchText = makePatch(from = post.text, to = newText)
        val editNoId = Edit(
          id = "?x", postId = post.id, ctime = now, loginId = loginId,
          newIp = None, text = patchText, newMarkup = None)
        val publNoId = EditApp(
          id = "?", editId = "?x", ctime = now,
          loginId = loginId, newIp = None, result = newText)

        // Save
        val Full(List(edit: Edit, publ: EditApp)) =
          dao.savePageActions(defaultTenantId, ex1_debate.guid,
            List(editNoId, publNoId))

        exEdit_editId = edit.id

        // Verify text changed
        dao.loadPage(defaultTenantId, ex1_debate.guid) must beLike {
          case Full(d: Debate) => {
            val editedPost = d.vipo_!(post.id)
            editedPost.text must_== newText
            editedPost.markup must_== "dmd0"
            true
          }
        }
      }

      "change the markup type" >> {
        // Make edit actions
        val editNoId = Edit(
          id = "?x", postId = post.id, ctime = now, loginId = loginId,
          newIp = None, text = "", newMarkup = Some("html"))
        val publNoId = EditApp(
          id = "?", editId = "?x", ctime = now,
          loginId = loginId, newIp = None, result = newText)

        // Save
        val Full(List(edit: Edit, publ: EditApp)) =
          dao.savePageActions(defaultTenantId, ex1_debate.guid,
            List(editNoId, publNoId))

        // Verify markup type changed
        dao.loadPage(defaultTenantId, ex1_debate.guid) must beLike {
          case Full(d: Debate) => {
            val editedPost = d.vipo_!(post.id)
            editedPost.text must_== "Edited text 054F2x"
            editedPost.markup must_== "html"
            true
          }
        }
      }
    }

    // -------- OpenID login

    var exOpenId_loginReq: LoginGrant = null
    def exOpenId_loginGrant: LoginGrant = exOpenId_loginReq  // correct name
    var exOpenId_userIds = mut.Set[String]()
    "save a new OpenID login and create a user" >> {
      val loginReq = LoginRequest(T.login, T.identityOpenId)
      exOpenId_loginReq = dao.saveLogin(defaultTenantId, loginReq)
      for (id <- exOpenId_loginReq.login.id ::
                  exOpenId_loginReq.identity.id ::
                  exOpenId_loginReq.user.id :: Nil) {
        id.contains("?") must_== false
        // weird! the compiler says: ';' expected but integer literal found
        // on the next row (if commented in).
        // id.length must be_> 1  // non-empty, and no weird 1 char id

        // Only dummy user ids (created for each IdentitySimple)
        // start with "-":
        id must notStartWith("-")
      }
      exOpenId_loginReq.identity.id must_==  exOpenId_loginReq.login.identityId
      exOpenId_loginReq.user.id must_== exOpenId_loginReq.identity.userId
      exOpenId_loginReq.user must matchUser(
          // Identity data no longer copied to User.
          displayName = "", // T.identityOpenId.firstName,
          email = "", // T.identityOpenId.email,
          country = "", // T.identityOpenId.country,
          website = "",
          isSuperAdmin = Boolean.box(false))
      exOpenId_userIds += exOpenId_loginReq.user.id
    }

    "reuse the IdentityOpenId and User just created" >> {
      val loginReq = LoginRequest(T.login.copy(date = new ju.Date),
          T.identityOpenId)
      val grant = dao.saveLogin(defaultTenantId, loginReq)
      grant.login.id must_!= exOpenId_loginReq.login.id
      grant.identity must_== exOpenId_loginReq.identity
      // The very same user should have been found.
      grant.user must matchUser(exOpenId_loginReq.user)
    }

    // COULD test to change name + email too, instead of only changing country.

    "update the IdentityOpenId, if attributes (country) changed" >> {
      // Change the country attribute. The Dao should automatically save the
      // new value to the database, and use it henceforth.
      val loginReq = LoginRequest(T.login.copy(date = new ju.Date),
          T.identityOpenId.copy(country = "Norway"))
      val grant = dao.saveLogin(defaultTenantId, loginReq)
      grant.login.id must_!= exOpenId_loginReq.login.id
      grant.identity must_== exOpenId_loginReq.identity.
          asInstanceOf[IdentityOpenId].copy(country = "Norway")
      // The user shouldn't have been changed, only the OpenID identity attrs.
      grant.user must matchUser(exOpenId_loginReq.user)
    }

    //"have exactly one user" >> {  // or, 3? there're 2 IdentitySimple users?
    //}

    // COULD test w/ new tenant but same claimed_ID, should also result in
    // a new User. So you can customize your user, per tenant.
    "create new IdentityOpenId and User for a new claimed_id" >> {
      val loginReq = LoginRequest(T.login.copy(date = new ju.Date),
        T.identityOpenId.copy(oidClaimedId = "something.else.com"))
      val grant = dao.saveLogin(defaultTenantId, loginReq)
      grant.login.id must_!= exOpenId_loginReq.login.id
      // A new id to a new user, but otherwise identical.
      grant.user.id must_!= exOpenId_loginReq.user.id
      grant.user must matchUser(exOpenId_loginReq.user, id = grant.user.id)
      exOpenId_userIds.contains(grant.user.id) must_== false
      exOpenId_userIds += grant.user.id
    }

    //"have exactly two users" >> {  // no, 4? 2 + 2 = 4
    //}

    /*
    "create a new user, for a new tenant (but same claimed_id)" >> {
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
          true
      }
    } */

    "load relevant OpenID logins, when loading a Page" >> {
      // Save a post, using the OpenID login. Load the page and verify
      // the OpenID identity and user were loaded with the page.
      val newPost = T.post.copy(parent = "1", text = "",
                                loginId = exOpenId_loginReq.login.id)
      var postId = "?"
      dao.savePageActions(defaultTenantId, ex1_debate.guid, List(newPost)
                          ) must beLike {
        case Full(List(savedPost: Post)) =>
          postId = savedPost.id
          savedPost must matchPost(newPost, id = postId)
          true
      }

      dao.loadPage(defaultTenantId, ex1_debate.guid) must beLike {
        case Full(d: Debate) =>
          d must havePostLike(newPost, id = postId)
          d.nilo(exOpenId_loginReq.login.id) must beLike {
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
              true
          }
          true
      }
    }

    // -------- Email

    var emailEx_loginGrant: LoginGrant = null
    var emailEx_email = "Imail@ex.com"

    // Test users, *after* they've been configured to receive email.
    var emailEx_UnauUser: User = null
    var emailEx_OpenIdUser: User = null

    "by default send no email to a new IdentitySimple" >> {
      val loginReq = LoginRequest(T.login.copy(date = new ju.Date),
        T.identitySimple.copy(email = emailEx_email, name = "Imail"))
      val grant = dao.saveLogin(defaultTenantId, loginReq)
      val Some((idty, user)) = dao.loadIdtyAndUser(forLoginId = grant.login.id,
                                          tenantId = defaultTenantId)
      user.emailNotfPrefs must_== EmailNotfPrefs.Unspecified
      emailEx_loginGrant = grant
    }

    "configure email to IdentitySimple" >> {
      def login = emailEx_loginGrant.login
      dao.configIdtySimple(tenantId = defaultTenantId, loginId = login.id,
            ctime = new ju.Date, emailAddr = emailEx_email,
            emailNotfPrefs = EmailNotfPrefs.Receive)
      val Some((idty, user)) = dao.loadIdtyAndUser(
          forLoginId = emailEx_loginGrant.login.id,
          tenantId = defaultTenantId)
      user.emailNotfPrefs must_== EmailNotfPrefs.Receive
      emailEx_UnauUser = user  // save, to other test cases
    }

    "by default send no email to a new Role" >> {
      val login = exOpenId_loginGrant.login
      val Some((idty, user)) =
         dao.loadIdtyAndUser(forLoginId = login.id, tenantId = defaultTenantId)
      user.emailNotfPrefs must_== EmailNotfPrefs.Unspecified
    }

    "configure email to a Role" >> {
      val userToConfig = exOpenId_loginGrant.user
      val login = exOpenId_loginGrant.login
      dao.configRole(tenantId = defaultTenantId, loginId = login.id,
         ctime = new ju.Date, roleId = userToConfig.id,
         emailNotfPrefs = EmailNotfPrefs.Receive)
      val Some((idty, userConfigured)) =
         dao.loadIdtyAndUser(forLoginId = login.id, tenantId = defaultTenantId)
      userConfigured.emailNotfPrefs must_== EmailNotfPrefs.Receive
      emailEx_OpenIdUser = userConfigured  // remember, to other test casese
    }


    // -------- Notifications and emails

    // An unauthenticated user and an authenticated user.
    // They have already been inserted in the db, and want email notfs.
    val unauUser = emailEx_UnauUser
    val auUser = emailEx_OpenIdUser

    // A notification to the unauthenticated user.
    val unauUserNotfSaved = NotfOfPageAction(
      ctime = new ju.Date,
      recipientUserId = unauUser.id,
      pageTitle = "EventPageForUnauUser",
      pageId = ex1_debate.guid,
      eventType = NotfOfPageAction.Type.PersonalReply,
      eventActionId = ex2_id,
      targetActionId = None,
      recipientActionId = ex2_emptyPost.parent,
      recipientUserDispName = "RecipientUser",
      eventUserDispName = "EventUser",
      targetUserDispName = None,
      emailPending = true)

    // A notification to the authenticated user.
    // (Shouldn't really be possible, because now one event+recipientActionId
    // maps to 2 notfs! But after I've added a PK to DW1_NOTFS_PAGE_ACTIONS,
    // that PK will allow only one. Then I'll have to fix/improve this test
    // case.)
    val auUserNotfSaved = unauUserNotfSaved.copy(
      eventActionId = exEdit_editId,
      recipientActionId = exEdit_postId,
      // eventType = should-change-from-reply-to-edit
      recipientUserId = auUser.id,  // not correct but works for this test
      pageTitle = "EventPageForAuUser")

    "load and save notifications" >> {

      "find none, when there are none" >> {
        dao.loadNotfByEmailId(defaultTenantId, "BadEmailId") must_== None
        dao.loadNotfsForRole(defaultTenantId, unauUser.id) must_== Nil
        dao.loadNotfsForRole(defaultTenantId, unauUser.id) must_== Nil
        val notfsLoaded = dao.loadNotfsToMailOut(
                                          delayInMinutes = 0, numToLoad = 10)
        notfsLoaded.usersByTenantAndId must_== Map.empty
        notfsLoaded.notfsByTenant must_== Map.empty
      }

      "save one, to an unauthenticated user" >> {
        dao.saveNotfs(defaultTenantId, unauUserNotfSaved::Nil)

        "load it, by user id" >> {
          val notfsLoaded = dao.loadNotfsForRole(defaultTenantId, unauUser.id)
          notfsLoaded must beLike {
            case List(notfLoaded: NotfOfPageAction) =>
              notfLoaded must_== unauUserNotfSaved
              true
          }
        }

        "load it, by time, to mail out" >> {
          val notfsToMail = dao.loadNotfsToMailOut(
             delayInMinutes = 0, numToLoad = 10)
          notfsToMail.usersByTenantAndId.get((defaultTenantId, unauUser.id)
             ) must_== Some(unauUser)
          notfsToMail.notfsByTenant(defaultTenantId) match {
            case List(notfLoaded: NotfOfPageAction) =>
              notfLoaded must_== unauUserNotfSaved
              true
            case _ => false
          }
        }
      }

      "save one, to an authenticated user" >> {
        dao.saveNotfs(defaultTenantId, auUserNotfSaved::Nil)

        "load it, by user id" >> {
          val notfsLoaded = dao.loadNotfsForRole(defaultTenantId, auUser.id)
          notfsLoaded must beLike {
            case List(notfLoaded: NotfOfPageAction) =>
              notfLoaded must_== auUserNotfSaved
              true
          }
        }

        "load it, by time, to mail out" >> {
          val notfsToMail = dao.loadNotfsToMailOut(
             delayInMinutes = 0, numToLoad = 10)
          notfsToMail.usersByTenantAndId.get((defaultTenantId, auUser.id)
             ) must_== Some(auUser)
          notfsToMail.notfsByTenant(defaultTenantId) match {
            case List(notfLoaded: NotfOfPageAction) =>
              notfLoaded must_== auUserNotfSaved
              true
            case _ => false
          }
        }
      }

      "not load any notf, when specifying another user's id " >> {
        val notfsLoaded = dao.loadNotfsForRole(defaultTenantId, "WrongUserId")
        notfsLoaded must_== Nil
      }

      "not load any notf, because they are too recent" >> {
        val notfsLoaded =
          dao.loadNotfsToMailOut(delayInMinutes = 15, numToLoad = 10)
        notfsLoaded.usersByTenantAndId must_== Map.empty
        notfsLoaded.notfsByTenant must_== Map.empty
      }

    }


    def testLoginViaEmail(emailId: String, emailSentOk: EmailSent)
          : LoginGrant  = {
      val loginNoId = Login(id = "?", prevLoginId = None, ip = "?.?.?.?",
         date = now, identityId = emailId)
      val loginReq = LoginRequest(loginNoId, IdentityEmailId(emailId))
      val loginGrant = dao.saveLogin(defaultTenantId, loginReq)
      val emailIdty = loginGrant.identity.asInstanceOf[IdentityEmailId]
      emailIdty.email must_== emailSentOk.sentTo
      emailIdty.notf.flatMap(_.emailId) must_== Some(emailSentOk.id)
      emailIdty.notf.map(_.recipientUserId) must_== Some(loginGrant.user.id)
      loginGrant
    }


    "support emails, to unauthenticated users" >> {

      val emailId = "10"

      val emailToSend = EmailSent(
        id = emailId,
        sentTo = "test@example.com",
        sentOn = None,
        subject = "Test Subject",
        bodyHtmlText = "<i>Test content.</i>",
        providerEmailId = None)

      val emailSentOk = emailToSend.copy(
        sentOn = Some(now),
        providerEmailId = Some("test-provider-id"))

      val emailSentFailed = emailSentOk.copy(
        providerEmailId = None,
        failureText = Some("Test failure"))

      def loadNotfToMailOut(userId: String): Seq[NotfOfPageAction] = {
        val notfsToMail = dao.loadNotfsToMailOut(
          delayInMinutes = 0, numToLoad = 10)
        val notfs = notfsToMail.notfsByTenant(defaultTenantId)
        val usersNotfs = notfs.filter(_.recipientUserId == userId)
        // All notfs loaded to mail out must have emails pending.
        usersNotfs.filterNot(_.emailPending).size must_== 0
        usersNotfs
      }

      "find the notification to mail out, to the unauth. user" >> {
        val notfs: Seq[NotfOfPageAction] = loadNotfToMailOut(unauUser.id)
        notfs.size must_!= 0
        notfs must_== List(unauUserNotfSaved)
      }

      "save an email, connect it to the notification, to the unauth. user" >> {
        dao.saveUnsentEmailConnectToNotfs(
           defaultTenantId, emailToSend, unauUserNotfSaved::Nil)
          // must throwNothing (how to test that?)
      }

      "skip notf, when loading notfs to mail out; email already created" >> {
        val notfs: Seq[NotfOfPageAction] = loadNotfToMailOut(unauUser.id)
        notfs.size must_== 0
      }

      "load the saved email" >> {
        val emailLoaded = dao.loadEmailById(defaultTenantId, emailToSend.id)
        emailLoaded must_== Some(emailToSend)
      }

      "load the notification, find it connected to the email" >> {
        // BROKEN many notfs might map to 1 email!
        dao.loadNotfByEmailId(defaultTenantId, emailToSend.id) must beLike {
          case Some(notf) =>
            notf.emailId must_== Some(emailToSend.id)
            true
          case None => false
        }
      }

      "update the email, to sent status" >> {
        dao.updateSentEmail(defaultTenantId, emailSentOk)
        // must throwNothing (how to test that?)
      }

      "load the email again, find it in okay status" >> {
        val emailLoaded = dao.loadEmailById(defaultTenantId, emailToSend.id)
        emailLoaded must_== Some(emailSentOk)
      }

      "update the email, to failed status" >> {
        dao.updateSentEmail(defaultTenantId, emailSentFailed)
        // must throwNothing (how to test that?)
      }

      "load the email again, find it in failed status" >> {
        val emailLoaded = dao.loadEmailById(defaultTenantId, emailToSend.id)
        emailLoaded must_== Some(emailSentFailed)
      }

      "update the failed email to sent status (simulates a re-send)" >> {
        dao.updateSentEmail(defaultTenantId, emailSentOk)
        // must throwNothing (how to test that?)
      }

      "load the email yet again, find it in sent status" >> {
        val emailLoaded = dao.loadEmailById(defaultTenantId, emailToSend.id)
        emailLoaded must_== Some(emailSentOk)
      }

      "login and unsubscribe, via email" >> {
        val loginGrant = testLoginViaEmail(emailId, emailSentOk)
        loginGrant.user.isAuthenticated must_== false
        dao.configIdtySimple(defaultTenantId, loginId = loginGrant.login.id,
          ctime = loginGrant.login.date, emailAddr = emailSentOk.sentTo,
          emailNotfPrefs = EmailNotfPrefs.DontReceive)
        // must throwNothing (how to test that?)
      }

      // COULD verify email prefs changed to DontReceive?
    }


    "support emails, to authenticated users" >> {

      val emailId = "11"

      val emailToSend = EmailSent(
        id = emailId,
        sentTo = "test@example.com",
        sentOn = None,
        subject = "Test Subject",
        bodyHtmlText = "<i>Test content.</i>",
        providerEmailId = None)

      val emailSentOk = emailToSend.copy(
        sentOn = Some(now),
        providerEmailId = Some("test-provider-id"))

      "save an email, connect it to a notification, to an auth. user" >> {
        dao.saveUnsentEmailConnectToNotfs(
          defaultTenantId, emailToSend, auUserNotfSaved::Nil)
        // must throwNothing (how to test that?)
      }

      "load the notification, find it connected to the email" >> {
        dao.loadNotfByEmailId(defaultTenantId, emailToSend.id) must beLike {
          case Some(notf) =>
            notf.emailId must_== Some(emailToSend.id)
            true
          case None => false
        }
      }

      "update the email, to sent status" >> {
        dao.updateSentEmail(defaultTenantId, emailSentOk)
        // must throwNothing (how to test that?)
      }

      "load the email, find it in sent status" >> {
        val emailLoaded = dao.loadEmailById(defaultTenantId, emailToSend.id)
        emailLoaded must_== Some(emailSentOk)
      }

      "login and unsubscribe, via email" >> {
        val loginGrant = testLoginViaEmail(emailId, emailSentOk)
        loginGrant.user.isAuthenticated must_== true
        dao.configRole(defaultTenantId, loginId = loginGrant.login.id,
          ctime = loginGrant.login.date, roleId = loginGrant.user.id,
          emailNotfPrefs = EmailNotfPrefs.DontReceive)
        // must throwNothing (how to test that?)
      }

      // COULD verify email prefs changed to DontReceive?
    }


    // -------- List actions

    "list actions" >> {

      "list replies, edits, ratings etcetera" >> {
        val actionLocators = dao.listActions(
           tenantId = defaultTenantId,
           folderPrefix = "/",
           includePages = PageStatus.All,
           limit = 700, offset = 0)
        // For now:
        actionLocators.size must be_>=(0)
        // In the future, create dedicated pages, and search?
      }

    }


    // -------- Move a page

    "move and rename pages" >> {

      val pagePath = dao.lookupPagePathByPageId(defaultTenantId,
         ex1_debate.guid).get
      var finalPath: PagePath = null

      "leave a page as is" >> {
        // No move/rename options specified:
        dao.moveRenamePage(
          defaultTenantId, pageId = ex1_debate.guid) must_== pagePath
      }

      "won't move a non-existing page" >> {
        dao.moveRenamePage(
          defaultTenantId, pageId = "non_existing_page",
          newFolder = Some("/folder/"), showId = Some(false),
          newSlug = Some("new-slug")) must throwAn[Exception]
      }

      "move a page to another folder" >> {
        val newPath = dao.moveRenamePage(
          defaultTenantId, pageId = ex1_debate.guid,
          newFolder = Some("/new-folder/"))
        newPath.folder must_== "/new-folder/"
        newPath.pageSlug must_== pagePath.pageSlug
        newPath.showId must_== pagePath.showId
      }

      "rename a page" >> {
        val newPath = dao.moveRenamePage(
          defaultTenantId, pageId = ex1_debate.guid,
          showId = Some(!pagePath.showId), // flip
          newSlug = Some("new-slug"))
        newPath.folder must_== "/new-folder/"
        newPath.pageSlug must_== "new-slug"
        newPath.showId must_== !pagePath.showId
      }

      "move and rename a page at the same time" >> {
        val newPath = dao.moveRenamePage(
          defaultTenantId, pageId = ex1_debate.guid,
          newFolder = Some("/new-folder-2/"),
          showId = Some(true), newSlug = Some("new-slug-2"))
        newPath.folder must_== "/new-folder-2/"
        newPath.pageSlug must_== "new-slug-2"
        newPath.showId must_== true

        finalPath = newPath
      }

      "list the page at the correct location" >> {
        val pagePathsDetails = dao.listPagePaths(
          withFolderPrefix = "/",
          tenantId = defaultTenantId,
          include = v0.PageStatus.All,
          sortBy = v0.PageSortOrder.ByPath,
          limit = Int.MaxValue,
          offset = 0
        )
        pagePathsDetails match {
          case List((pagePath, pageDetails)) =>
            pagePath must_== finalPath
            true
        }
      }
    }

    // -------------
    //val ex3_emptyPost = T.post.copy(parent = "1", text = "Lemmings!")
    //"create many many random posts" >> {
    //  for (i <- 1 to 10000) {
    //    dao.savePageActions(defaultTenantId,
    //          "-"+ ex1_debate.id, List(ex3_emptyPost)) must beLike {
    //      case Full(List(p: Post)) => true
    //    }
    //  }
    //}
  }

}


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

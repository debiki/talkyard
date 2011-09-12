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

  val defaultTenantId = "default"
  val defaultPagePath = v0.PagePath(defaultTenantId, "/folder/",
                                    v0.PagePath.GuidUnknown, "page-title")
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
    date = new ju.Date, loginCredsId = "?x")
  val loginSimple = v0.LoginCredsSimple(id = "?", name = "Målligan",
    email = "no@email.no", location = "", website = "")
  val loginOpenId = v0.LoginCredsOpenId(id = "?",
    oidEndpoint = "provider.com/endpoint", oidVersion = "2",
    oidRealm = "example.com", oidClaimedId = "claimed-id.com",
    oidOpLocalId = "provider.com/local/id",
    firstName = "Laban", email = "no@email.no", country = "Sweden")
  val post = v0.Post(id = "?", parent = "0", date = new ju.Date,
    loginId = "?", newIp = None, text = "", markup = "", where = None)
  val rating = v0.Rating(id = "?", postId = "0", loginId = "?",
    newIp = None, date = new ju.Date, tags = Nil)
}

class DaoSpecV002(b: TestContextBuilder) extends DaoSpec(b, "0.0.2") {
  val tablesAreEmpty = setup(EmptyTables)

  import com.debiki.v0._
  import com.debiki.v0.Dao.LoginStuff
  import com.debiki.v0.PagePath._  // Guid case classes
  val T = Templates

  "A v0.DAO in an empty 0.0.2 repo" when tablesAreEmpty should {
    "find version 0.0.2" >> {
      dao.checkRepoVersion() must_== Full("0.0.2")
    }
  }

  "A v0.DAO in an empty 0.0.2 repo" when tablesAreEmpty can {
    setSequential()  // so e.g. loginId inited before used in ctors
    shareVariables()
    // -------------
    val ex1_postText = "postText0-3kcvxts34wr"
    var ex1_debate: Debate = null
    var loginStuff: LoginStuff = null
    var loginId = "?"

    "throw error for an invalid login id" >> {
      val debateBadLogin = Debate(guid = "?", posts =
          T.post.copy(id = "0", loginId = "9999999")::Nil) // bad login id
      SLog.info("Expecting ORA-02291: integrity constraint log message ------")
      dao.create(defaultPagePath, debateBadLogin
                ) must throwAn[Exception]
      SLog.info("------------------------------------------------------------")
    }

    "save a simple login" >> {
      val stuffNoId = LoginStuff(T.login, T.loginSimple, None)
      loginStuff = dao.saveLogin(defaultTenantId, stuffNoId)
      loginStuff.login.id must_!= "?"
      loginId = loginStuff.login.id
    }

    val ex1_rootPost = T.post.copy(
      id = "0", loginId = loginId, text = ex1_postText)

    "create a debate with a root post" >> {
      val debateNoId = Debate(guid = "?", posts = ex1_rootPost::Nil)
      dao.create(defaultPagePath, debateNoId) must beLike {
        case Full(d: Debate) =>
          ex1_debate = d
          d.postCount must_== 1
          d.guid.length must be_>(1)  // not = '?'
          d must havePostLike(ex1_rootPost)
          true
      }
    }

    "find the debate and the post again" >> {
      dao.load(defaultTenantId, ex1_debate.guid) must beLike {
        case Full(d: Debate) => {
          d must havePostLike(ex1_rootPost)
          true
        }
      }
    }

    "find the debate and the login again" >> {
      dao.load(defaultTenantId, ex1_debate.guid) must beLike {
        case Full(d: Debate) => {
          d.nilo(ex1_rootPost.loginId) must beLike {
            case Some(n: NiLo) =>
              n.login.id must_== ex1_rootPost.loginId
              true
          }
          true
        }
      }
    }

    // COULD: Find the LoginIdty again, and the User.

    val exPagePath = defaultPagePath.copy(guid = GuidInPath(ex1_debate.guid))
    "recognize its correct PagePath" >> {
      dao.checkPagePath(exPagePath) must beLike {
        case Full(correctPath: PagePath) =>
          correctPath must matchPagePath(exPagePath)
          true
        case _ => false
      }
    }

    "correct an incorrect PagePath name" >> {
      dao.checkPagePath(exPagePath.copy(name = "incorrect")) must beLike {
        case Full(correctPath: PagePath) =>
          correctPath must matchPagePath(exPagePath)
          true
        case _ => false
      }
    }

    "correct an incorrect PagePath folder" >> {
      dao.checkPagePath(exPagePath.copy(parent = "/incorrect/")) must beLike {
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

    val ex2_emptyPost = T.post.copy(parent = "0", text = "",
      loginId = loginId)
    var ex2_id = ""
    "save an empty root post child post" >> {
      dao.save(defaultTenantId, ex1_debate.guid, List(ex2_emptyPost)
              ) must beLike {
        case Full(List(p: Post)) =>
          ex2_id = p.id
          p must matchPost(ex2_emptyPost, id = ex2_id)
          true
      }
    }

    "find the empty post again" >> {
      dao.load(defaultTenantId, ex1_debate.guid) must beLike {
        case Full(d: Debate) => {
          d must havePostLike(ex2_emptyPost, id = ex2_id)
          true
        }
      }
    }

    var ex3_ratingId = ""
    val ex3_rating = T.rating.copy(loginId = loginId,
        postId = "0",  tags = "Interesting"::"Funny"::Nil)  // 2 tags
    "save a post rating, with 2 tags" >> {
      dao.save(defaultTenantId, ex1_debate.guid, List(ex3_rating)
              ) must beLike {
        case Full(List(r: Rating)) =>
          ex3_ratingId = r.id
          r must matchRating(ex3_rating, id = ex3_ratingId, loginId = loginId)
          true
      }
    }

    "find the rating again" >> {
      dao.load(defaultTenantId, ex1_debate.guid) must beLike {
        case Full(d: Debate) => {
          d must haveRatingLike(ex3_rating, id = ex3_ratingId)
          true
        }
      }
    }

    var ex4_rating1Id = ""
    val ex4_rating1 =
      T.rating.copy(id = "?1", postId = "0", loginId = loginId,
                    tags = "Funny"::Nil)
    var ex4_rating2Id = ""
    val ex4_rating2 =
      T.rating.copy(id = "?2", postId = "0", loginId = loginId,
                    tags = "Boring"::"Stupid"::Nil)
    var ex4_rating3Id = ""
    val ex4_rating3 =
      T.rating.copy(id = "?3", postId = "0", loginId = loginId,
                    tags = "Boring"::"Stupid"::"Funny"::Nil)
    "save 3 ratings, with 1, 2 and 3 tags" >> {
      dao.save(defaultTenantId, ex1_debate.guid,
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
      dao.load(defaultTenantId, ex1_debate.guid) must beLike {
        case Full(d: Debate) => {
          d must haveRatingLike(ex4_rating1, id = ex4_rating1Id)
          d must haveRatingLike(ex4_rating2, id = ex4_rating2Id)
          d must haveRatingLike(ex4_rating3, id = ex4_rating3Id)
          true
        }
      }
    }

    var exOpenId_stuff: LoginStuff = null
    var exOpenId_userIds = mut.Set[String]()
    "save a new OpenID login and create a user" >> {
      val stuffNoId = LoginStuff(T.login, T.loginOpenId, None)
      exOpenId_stuff = dao.saveLogin(defaultTenantId, stuffNoId)
      exOpenId_stuff.login.id must_!= "?"
      exOpenId_stuff.user must beLike {
        case None => false
        case Some(u) =>
          u.id must_!= "?"
          u.id must_!= ""
          exOpenId_userIds += u.id
          //u.id must_== stuff.creds. what! which user ???
          u must matchUser(
              displayName = T.loginOpenId.firstName,
              email = T.loginOpenId.email,
              country = T.loginOpenId.country,
              website = "",
              isSuperAdmin = Boolean.box(false))
          true
      }
    }

    "find the OpenID user just created" >> {
      val stuffNoId = LoginStuff(T.login.copy(date = new ju.Date),
          T.loginOpenId, None)
      val stuff = dao.saveLogin(defaultTenantId, stuffNoId)
      stuff.login.id must_!= exOpenId_stuff.login.id
      stuff.user must beLike {
        case None => false
        case Some(u) =>
          // The very same user should have been found.
          u must matchUser(exOpenId_stuff.user.get)
          true
      }
    }

    "create a new OpenID entry, if attributes changed, but reuse User" >> {
      // Change the country attribute. The Dao should automatically save the
      // new value to the database, and use it henceforth.
      val stuffNoId = LoginStuff(T.login.copy(date = new ju.Date),
          T.loginOpenId.copy(country = "Norway"), None)
      val stuff = dao.saveLogin(defaultTenantId, stuffNoId)
      stuff.login.id must_!= exOpenId_stuff.login.id
      stuff.user must beLike {
        case None => false
        case Some(u) =>
          // Note that u.id must refer to the old user.
          u must matchUser(exOpenId_stuff.user.get, country = "Norway")
          true
      }
    }

    //"have exactly one user" >> {
    //}

    "create a new user for a new claimed_id" >> {
      val stuffNoId = LoginStuff(T.login.copy(date = new ju.Date),
        T.loginOpenId.copy(oidClaimedId = "something.else.com"), None)
      val stuff = dao.saveLogin(defaultTenantId, stuffNoId)
      stuff.login.id must_!= exOpenId_stuff.login.id
      stuff.user must beLike {
        case None => false
        case Some(u) =>
          // A new id to a new user, but otherwise identical.
          u.id must_!= exOpenId_stuff.user.get.id
          u must matchUser(exOpenId_stuff.user.get, id = u.id)
          exOpenId_userIds.contains(u.id) must_== false
          exOpenId_userIds += u.id
          true
      }
    }

    //"have exactly two users" >> {
    //}

    /*
    "create a new user, for a new tenant (but same claimed_id)" >> {
      val stuffNoId = LoginStuff(T.login.copy(date = new ju.Date),
                              T.loginOpenId, None)
      val stuff = dao.saveLogin("some-other-tenant-id", stuffNoId)
      stuff.login.id must_!= exOpenId_stuff.login.id
      stuff.user must beLike {
        case None => false
        case Some(u) =>
          // A new id to a new user, but otherwise identical.
          u.id must_!= exOpenId_stuff.user.get.id
          u must matchUser(exOpenId_stuff.user.get, id = u.id)
          exOpenId_userIds += u.id
          true
      }
    } */

    // -------------

    //val ex3_emptyPost = T.post.copy(parent = "0", text = "Lemmings!")
    //"create many many random posts" >> {
    //  for (i <- 1 to 10000) {
    //    dao.save(defaultTenantId, "-"+ ex1_debate.id, List(ex3_emptyPost)
    //            ) must beLike {
    //      case Full(List(p: Post)) => true
    //    }
    //  }
    //}
  }

}


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
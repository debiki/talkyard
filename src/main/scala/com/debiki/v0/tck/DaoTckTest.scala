package com.debiki.v0.tck

/**
 * Copyright (c) 2011 Kaj Magnus Lindberg (born 1979)
 * Created on 2011-05-29.
 */

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
  lazy val dao = new v0.NonCachingDao(daoImpl)
}

object DaoTckTest {
  sealed class What
  case object EmptySchema extends What
  case object EmptyTables extends What
  case object TablesWithData extends What

  type TestContextBuilder = Function2[What, String, TestContext]

  val defaultTenantId = "default"
  val defaultPagePath = v0.PagePath(defaultTenantId, "/",
                                    v0.PagePath.GuidUnknown, "Title")
}

import DaoTckTest._


abstract class DaoTckTest(builder: TestContextBuilder)
    extends SpecificationWithJUnit {

  "The Technology Compatibility Kit".isSpecifiedBy(
      new DaoSpecEmptySchema(builder),
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
  val post = v0.Post(id = "?", parent = "", date = new ju.Date,
    by = "Author", ip = "?.?.?.?", text = "", markup = "")
  val rating = v0.Rating(id = "?", postId = "", by = "Author",
    ip = "?.?.?.?", date = new ju.Date, tags = Nil)
}

class DaoSpecV002(b: TestContextBuilder) extends DaoSpec(b, "0.0.2") {
  val tablesAreEmpty = setup(EmptyTables)

  import com.debiki.v0._
  val T = Templates

  "A v0.DAO in an empty 0.0.2 repo" when tablesAreEmpty should {
    "find version 0.0.2" >> {
      dao.checkRepoVersion() must_== Full("0.0.2")
    }
  }

  "A v0.DAO in an empty 0.0.2 repo" when tablesAreEmpty can {
    shareVariables()
    // -------------
    val ex1_postText = "postText0-3kcvxts34wr"
    var ex1_debate: Debate = null

    "create a debate with a root post" >> {
      val rootPost = T.post.copy(id = "0", text = ex1_postText)
      val debateNoId = Debate(guid = "?", posts = rootPost::Nil)
      dao.create(defaultPagePath, debateNoId) must beLike {
        case Full(d: Debate) =>
          ex1_debate = d
          d.postCount must_== 1
          d.guid.length must be_>(1)  // not = '?'
          d must havePostLike(T.post, id = "0", text = ex1_postText)
          true
      }
    }

    "find the debate and the post again" >> {
      dao.load(defaultTenantId, ex1_debate.guid) must beLike {
        case Full(d: Debate) => {
          d must havePostLike(T.post, id = "0", text = ex1_postText)
          true
        }
      }
    }

    val ex2_emptyPost = T.post.copy(parent = "0", text = "")
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
    val ex3_rating = T.rating.copy(
        postId = "0",  tags = "Interesting"::"Funny"::Nil)  // 2 tags
    "save a post rating, with 2 tags" >> {
      dao.save(defaultTenantId, ex1_debate.guid, List(ex3_rating)
              ) must beLike {
        case Full(List(r: Rating)) =>
          ex3_ratingId = r.id
          r must matchRating(ex3_rating, id = ex3_ratingId)
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
    val ex4_rating1 = T.rating.copy(id = "?1", postId = "0",
                        tags = "Funny"::Nil)
    var ex4_rating2Id = ""
    val ex4_rating2 = T.rating.copy(id = "?2", postId = "0",
                        tags = "Boring"::"Stupid"::Nil)
    var ex4_rating3Id = ""
    val ex4_rating3 = T.rating.copy(id = "?3", postId = "0",
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
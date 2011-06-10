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
  def dao: v0.Dao
  def close() = dao.close()
  def createRestorePoint(): Unit
  def revertToRestorePoint(): Unit
}

object DaoTckTest {
  sealed class What
  case object EmptySchema extends What
  case object EmptyTables extends What
  case object TablesWithData extends What

  type TestContextBuilder = Function2[What, String, TestContext]

  val defaultTenantId = "default"
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
      ctx.close()
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
    by = "Author", ip = "?.?.?.?", text = "")
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
      val rootPost = T.post.copy(id = "root", text = ex1_postText)
      val debateNoId = Debate(id = "?", posts = rootPost::Nil)
      dao.create(defaultTenantId, debateNoId) must beLike {
        case Full(d: Debate) =>
          ex1_debate = d
          d.postCount must_== 1
          d.id.length must be_>(1)  // not = '?'
          d must havePostLike(T.post, id = "root", text = ex1_postText)
          true
      }
    }

    "find the debate and the post again" >> {
      dao.load(defaultTenantId, ex1_debate.id) must beLike {
        case Full(d: Debate) => {
          d must havePostLike(T.post, id = "root", text = ex1_postText)
          //d.post("root") must beLike {
          //  case Some(p: Post) =>
          //    p.id must_== "root"
          //    p.parent must_== T.post.parent
          //    p.date must match_(T.post.date)
          //    p.by must_== T.post.by
          //    p.ip must_== T.post.ip
          //    p.text must_== ex1_postText
          //    p.where must_== T.post.where
          //    true
          //}
          true
        }
      }
    }

    val ex2_emptyPost = T.post.copy(parent = "root", text = "")
    var ex2_id = ""
    "save an empty root post child post" >> {
      dao.save(defaultTenantId, ex1_debate.id, List(ex2_emptyPost)
              ) must beLike {
        case Full(List(p: Post)) =>
          ex2_id = p.id
          p must matchPost(ex2_emptyPost, id = ex2_id)
          true
      }
    }

    "find the empty post again" >> {
      dao.load(defaultTenantId, ex1_debate.id) must beLike {
        case Full(d: Debate) => {
          d must havePostLike(ex2_emptyPost, id = ex2_id)

          //d.post(ex2_id) must beLike {
          //  case Some(p: Post) =>
          //    p must matchPost(ex2_emptyPost, id = ex2_id,
          //     by = "cats", where = "rats", date = new ju.Date)
          //    //val ex = ex2_emptyPost
          //    //p.id must_== ex2_id
          //    //p.parent must_== ex.parent
          //    //p.date must match_(ex.date)
          //    //p.by must_== ex.by
          //    //p.ip must_== ex.ip
          //    //p.text must_== ex.text
          //    //p.where must_== ex.where
          //    true
          //}
          true
        }
      }
    }
    // -------------
  }

}


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
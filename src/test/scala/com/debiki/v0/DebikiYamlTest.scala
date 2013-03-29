/**
 * Copyright (c) 2011 Kaj Magnus Lindberg (born 1979)
 */

/*

package com.debiki.v0

import org.specs._
import org.specs.specification.PendingUntilFixed
import net.liftweb.common.{Box, Full, Empty, Failure}
import java.io.{File, FileNotFoundException}

object DebikiYamlTest {

  private val testResDir =
      new File(Thread.currentThread.getContextClassLoader.getResource(
        "v0/debates/empty_file.yaml").getFile).getParent
  def pathTo(debateGuid: String): String = testResDir +"/"+ debateGuid
  def loadDebateFromPath(debatePath: String): Box[Debate] =
    DebikiYaml().loadDebateFromPath(pathTo(debatePath))
}

class DebikiYamlTest extends SpecificationWithJUnit with PendingUntilFixed {
  import DebikiYamlTest._

  "DebikiYaml" should {
    "fail for invalid paths" >> {
      loadDebateFromPath("non_existing_file.yaml") must beLike {
        case Failure(_, _: Full[FileNotFoundException], _) => true
      }
    }
    "fail for valid and invalid paths" >> {
      val fileHere = new File(pathTo("big_blog_debate.yaml"))
      fileHere must exist
      val fileGone = new File(pathTo("non_existing_file.yaml"))
      DebikiYaml().loadDebateFromFiles(fileHere, fileGone) must beLike {
        case Failure(_, _: Full[FileNotFoundException], _) => true
      }
    }
    "find nothing in empty files" >> {
      loadDebateFromPath("empty_file.yaml") must beLike {
        case Empty => true
      }
    }
    "load big-blog-debate correctly" >> {
      val debate = loadDebateFromPath("big_blog_debate.yaml").open_!
      debate.guid must_== "test_debate"
      debate.postCount must_== 26
      debate.ratingsOn("j").length must_== 1
      debate.ratingsOn("c").length must_== 2
      //assert(debate.postScore("h") == 3)
    }
    "load a debate from all files in a directory" >> {
      loadDebateFromPath("debate_in_3_files") must beLike {
        case Full(d: Debate) =>
          d.guid must_== "debate_in_3_files"
          d.postCount must_== 2
          true
      }
    }
    "load a debate from a list of files" >> {
      val dir = new File(pathTo("debate_in_3_files"))
      val file_000 = new File(dir, "000.yaml")
      val file_002 = new File(dir, "002.yaml")
      DebikiYaml().loadDebateFromFiles(file_000, file_002) must beLike {
        case Full(d: Debate) =>
          d.guid must_== "debate_in_3_files"
          d.postCount must_== 1  // post 001 not loaded
          true
      }
    }
  }

}

*/
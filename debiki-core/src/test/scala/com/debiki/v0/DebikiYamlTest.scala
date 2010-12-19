// vim: ts=2 sw=2 et
/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package com.debiki.v0

import org.specs._
import org.specs.specification.PendingUntilFixed
import net.liftweb.common.{Box, Full, Empty, Failure}
import java.io.{File, FileNotFoundException}

object DebikiYamlTest {

  private val testResDir =
      new File(Thread.currentThread.getContextClassLoader.getResource(
        "v0/debates/empty-file.yaml").getFile).getParent
  def pathTo(debateId: String): String = testResDir +"/"+ debateId
  def loadDebateFromPath(debatePath: String): Box[Debate] =
    DebikiYaml().loadDebateFromPath(pathTo(debatePath))
}

class DebikiYamlTest extends SpecificationWithJUnit with PendingUntilFixed {
  import DebikiYamlTest._

  "DebikiYaml" should {
    "fail for invalid paths" >> {
      loadDebateFromPath("non-existing-file.yaml") must beLike {
        case Failure(_, _: Full[FileNotFoundException], _) => true
      }
    }
    "fail for valid and invalid paths" >> {
      val fileHere = new File(pathTo("big-blog-debate.yaml"))
      fileHere must exist
      val fileGone = new File(pathTo("non-existing-file.yaml"))
      DebikiYaml().loadDebateFromFiles(fileHere, fileGone) must beLike {
        case Failure(_, _: Full[FileNotFoundException], _) => true
      }
    }
    "find nothing in empty files" >> {
      loadDebateFromPath("empty-file.yaml") must beLike {
        case Empty => true
      }
    }
    "load big-blog-debate correctly" >> {
      val debate = loadDebateFromPath("big-blog-debate.yaml").open_!
      debate.id must_== "test-debate"
      debate.postCount must_== 26
      debate.ratingsOn("j").length must_== 1
      debate.ratingsOn("c").length must_== 2
      //assert(debate.postScore("h") == 3)
    }
    "load a debate from all files in a directory" >> {
      loadDebateFromPath("debate-in-3-files") must beLike {
        case Full(d: Debate) =>
          d.id must_== "debate-in-3-files"
          d.postCount must_== 2
          true
      }
    }
    "load a debate from a list of files" >> {
      val dir = new File(pathTo("debate-in-3-files"))
      val file_000 = new File(dir, "000.yaml")
      val file_002 = new File(dir, "002.yaml")
      DebikiYaml().loadDebateFromFiles(file_000, file_002) must beLike {
        case Full(d: Debate) =>
          d.id must_== "debate-in-3-files"
          d.postCount must_== 1  // post 001 not loaded
          true
      }
    }
  }

}
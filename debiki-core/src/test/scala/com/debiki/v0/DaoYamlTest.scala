// vim: ts=2 sw=2 et
/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package com.debiki.v0

import org.junit._
import Assert._
import org.yaml.{snakeyaml => y}

object DaoYamlTest {

  private val testOutDir = System.getProperty("build.testOutputDirectory")

  object Paths {
    val MmaDebate = testOutDir +"/v0/compactDebate/_debate.yaml"
  }
}

@Test
class DaoYamlTest {
  import DaoYamlTest._

  @Test
  def testLoad() {
    val dao: Dao = new DaoYaml
    val debate = dao.getDebate(Paths.MmaDebate)
    assert(debate.id == "compactDebate")
    assert(debate.postCount == 26)
    assert(debate.postVotes("j").length == 1)
    //assert(debate.postScore("h") == 3)
  }

}
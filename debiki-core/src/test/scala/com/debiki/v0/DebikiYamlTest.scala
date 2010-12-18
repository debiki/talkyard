// vim: ts=2 sw=2 et
/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package com.debiki.v0

import org.junit._
import Assert._
import org.yaml.{snakeyaml => y}

object DebikiYamlTest {

  private val testOutDir = System.getProperty("build.testOutputDirectory")

  object Paths {
    val MmaDebate = testOutDir +"/v0/_debate.yaml"
  }
}

@Test
class DebikiYamlTest {
  import DebikiYamlTest._

  @Test
  def testLoad() {
    val dao: Dao = new DebikiYaml
    val debate = dao.getDebate(Paths.MmaDebate)
    assert(debate.id == "test-debate")
    assert(debate.postCount == 26)
    assert(debate.ratingsOn("j").length == 1)
    assert(debate.ratingsOn("c").length == 2)
    //assert(debate.postScore("h") == 3)
  }

}
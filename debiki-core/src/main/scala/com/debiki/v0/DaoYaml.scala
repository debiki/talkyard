// vim: ts=2 sw=2 et
/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package com.debiki.v0

import com.debiki.v0.Prelude._
import org.yaml.{snakeyaml => y}
import y.{constructor => yc, nodes => yn}
import scala.collection.JavaConversions._
import scala.collection.{mutable => mut}
import java.{io => jio, util => ju}

class DaoYaml extends Dao {

  private def buildDebate(iter: Iterable[Object]): Option[Debate] = {
    var debate: Option[Debate] = None
    var posts = List[Post]()
    for (obj <- iter) obj match {
      case d: Debate =>
        if (debate.isDefined) unsupported("More than one debate found: "+
                                "Don't know to which debate the posts belong")
        debate = Some(d)
      case p: Post => posts = p :: posts
      case x => println("What is this: "+ x)
    }
    debate.map(_.copy(posts = posts))
  }

  def loadDebateFromText(yamlText: String): Option[Debate] = {
    val dc = new DebateConstructor
    val yaml = new y.Yaml(new y.Loader(dc))
    val iterable = yaml.loadAll(yamlText)
    buildDebate(iterable)
  }

  override def getDebate(id: String): Debate = {
    var debate: Option[Debate] = None
    val dc = new DebateConstructor
    val yaml = new y.Yaml(new y.Loader(dc))
    val file = new jio.File(id)
    val iterable = yaml.loadAll(new jio.FileInputStream(file))
    debate = buildDebate(iterable)
    illegalArgIf(debate.isEmpty, "Debate not found: "+ id)
    debate.get
  }

  private class DebateConstructor extends yc.SafeConstructor {

    private val yamlTagPrefix = "!"//"!org.debiki.v0.debikigenhtml."

    yamlConstructors.put(
      new yn.Tag(yamlTagPrefix +"Debate"), new ConstrDebate)
    yamlConstructors.put(
      new yn.Tag(yamlTagPrefix +"Post"), new ConstrPost)

    private class ConstrDebate extends DebikiMapConstr {

      override def handleTuples(tuples: ju.List[yn.NodeTuple]): Debate = {
        var debateId: Option[String] = None
        for (t <- tuples) asText(t.getKeyNode) match {
          case "id" => debateId = Some(asText(t.getValueNode))
          case _ => // ignore unknown entries
        }
        illegalArgIf(debateId.isEmpty, "Debate id missing")
        new Debate(debateId.get, Nil)
      }
    }

    private class ConstrPost extends DebikiMapConstr {

      override def handleTuples(tuples: ju.List[yn.NodeTuple]): Post = {
        var id: Option[String] = None
        var parent: Option[String] = None
        var owner: Option[String] = None
        var text: Option[String] = None

        for (t <- tuples) asText(t.getKeyNode) match {
          case "id" => id = Some(asText(t.getValueNode))
          case "parent" => parent = Some(asText(t.getValueNode))
          case "owner" => owner = Some(asText(t.getValueNode))
          case "text" => text = Some(asText(t.getValueNode))
          case _ => // ignore unknown entries
        }

        illegalArgIf(id.isEmpty, "`id' entry missing")
        illegalArgIf(parent.isEmpty, "`parent' entry missing")
        illegalArgIf(text.isEmpty, "`text' entry missing")

        new Post(id = id.get, parent = parent.get,
                  owner = owner, text = text.get)
      }
    }

    // Helper class: Loops through all Yaml map entries in a Yaml map node.
    private abstract class DebikiMapConstr extends yc.AbstractConstruct {
      override def construct(node: yn.Node): Object = {
        val tuples: ju.List[yn.NodeTuple] = node match {
          case m: yn.MappingNode => m.getValue
          case x => illegalArgBadClass("`node'", "MappingNode", x)
        }
        handleTuples(tuples)
      }
      def handleTuples(tuples: ju.List[yn.NodeTuple]): Object
    }

  }

  private def asText(n: yn.Node) = n match {
    case s: yn.ScalarNode => s.getValue
    case x => illegalArgBadClass("A Yaml map key", "ScalarNode", x)
  }

  private def illegalArgBadClass(what: String,
                                   expected: String, obj: Object) =
    throw new IllegalArgumentException(
        what +" is not a "+ expected + "; it is a "+
        obj.getClass.getSimpleName)

}
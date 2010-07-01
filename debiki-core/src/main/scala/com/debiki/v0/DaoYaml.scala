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

object DaoYaml {

  /** Notice: DoS or XSS attack: Bad input gives corrupt Yaml.
   */
  def toYaml(post: Post): String = {
    val sb = new mut.StringBuilder
    sb ++= "\n--- !Post"
    sb ++= "\nparent: " ++= post.parent
    sb ++= "\nid: " ++= post.id

    // (If `owner' is inlined on the subsequent `sb ++= ...' line,
    // the below compilation error follows. If it's converted to a String
    // all is fine though. Weird.
    // [INFO]  found   : java.lang.Comparable[java.lang.String]
    // [INFO]  required: scala.collection.TraversableOnce[Char]  )
    val owner = post.owner.getOrElse("?") // compilation error if...
    sb ++= "\nowner: \"" ++= owner += '"' //... inlined here

    sb ++= "\ndate: " ++= toIso8601(post.date)
    var indentedText = post.text.replaceAll("\n", "\n ") // indents 1 space
    indentedText = indentedText.replace("\r", "") // convert \r\n to \n
    sb ++= "\ntext: |1\n " ++= indentedText // note: ' ' after \n!
    sb.toString
  }

  /** Warning: DoS or XSS attack: Bad input gives corrupt Yaml.
   */
  def toYaml(vote: Vote): String = {
    val sb = new mut.StringBuilder
    sb ++= "\n--- !Vote"
    sb ++= "\nby: \"" ++= vote.voterId += '"'
    sb ++= "\ndate: " ++= toIso8601(vote.date)
    sb ++= "\npost: " ++= vote.postId
    sb ++= "\nvalues: " ++= vote.values.mkString("[\"", "\", \"", "\"]")
    sb.toString
  }

}

class DaoYaml extends Dao {

  private def buildDebate(iter: Iterable[Object]): Option[Debate] = {
    var debate: Option[Debate] = None
    var posts = List[Post]()
    var votes = List[Vote]()
    for (obj <- iter) obj match {
      case d: Debate =>
        if (debate.isDefined) unsupported("More than one debate found: "+
                                "Don't know to which debate the posts belong")
        debate = Some(d)
      case p: Post => posts ::= p
      case v: Vote => votes ::= v
      case x => unimplemented("Handling of: "+ x)
    }
    debate.map(_.copy(posts = posts, votes = votes))
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
    yamlConstructors.put(
      new yn.Tag(yamlTagPrefix +"Vote"), new ConstrVote)

    private class ConstrDebate extends DebikiMapConstr {

      override def handleTuples(tuples: ju.List[yn.NodeTuple]): Debate = {
        var debateId: Option[String] = None
        for (t <- tuples) asText(t.getKeyNode) match {
          case "id" => debateId = Some(asText(t.getValueNode))
          case _ => // ignore unknown entries
        }
        illegalArgIf(debateId.isEmpty, "Debate id missing")
        new Debate(debateId.get, posts = Nil, votes = Nil)
      }
    }

    private class ConstrPost extends DebikiMapConstr {

      override def handleTuples(tuples: ju.List[yn.NodeTuple]): Post = {
        var id: Option[String] = None
        var parent: Option[String] = None
        var date: Option[ju.Date] = None
        var owner: Option[String] = None
        var text: Option[String] = None

        for (t <- tuples) asText(t.getKeyNode) match {
          case "id" => id = Some(asText(t.getValueNode))
          case "parent" => parent = Some(asText(t.getValueNode))
          case "date" => date = Some(asDate(t.getValueNode))
          case "owner" => owner = Some(asText(t.getValueNode))
          case "text" => text = Some(asText(t.getValueNode))
          case _ => // fine, allow future extensions
        }

        illegalArgIf(id.isEmpty, "`id' entry missing")
        illegalArgIf(parent.isEmpty, "`parent' entry missing")
        illegalArgIf(date.isEmpty, "`date' entry missing")
        illegalArgIf(text.isEmpty, "`text' entry missing")

        new Post(id = id.get, parent = parent.get, date = date.get,
                  owner = owner, text = text.get)
      }
    }

    private class ConstrVote extends DebikiMapConstr {

      override def handleTuples(tuples: ju.List[yn.NodeTuple]): Vote = {
        var voterId: Option[String] = None
        var postId: Option[String] = None
        var date: Option[ju.Date] = None
        var values: List[String] = null

        for (t <- tuples) asText(t.getKeyNode) match {
          case "by" => voterId = Some(asText(t.getValueNode))
          case "post" => postId = Some(asText(t.getValueNode))
          case "date" => date = Some(asDate(t.getValueNode))
          case "values" => values = asTextList(t.getValueNode)
          case _ => // fine, allow future extensions
        }

        illegalArgIf(voterId.isEmpty, "`id' entry missing")
        illegalArgIf(postId.isEmpty, "`parent' entry missing")
        illegalArgIf(date.isEmpty, "`date' entry missing")
        illegalArgIf(values == null, "`values' entry missing")

        Vote(postId = postId.get, voterId = voterId.get, date = date.get,
             values = values)
      }
    }

    // Helper class: Loops through all Yaml map entries in a Yaml map node.
    private abstract class DebikiMapConstr extends yc.AbstractConstruct {
      override def construct(node: yn.Node): Object = {
        try {
          val tuples: ju.List[yn.NodeTuple] = node match {
            case m: yn.MappingNode => m.getValue
            case x => illegalArgBadClass("`node'", "MappingNode", x)
          }
          handleTuples(tuples)
        }
        catch {
          case e: Exception => throw new RuntimeException(
              "Error parsing this node: "+ debugReprOf(node), e)
        }
      }
      def handleTuples(tuples: ju.List[yn.NodeTuple]): Object
    }

    private def asInt(n: yn.Node) = asText(n).toInt

    private def asText(n: yn.Node) = n match {
      case s: yn.ScalarNode => s.getValue
      case x => illegalArgBadClass("A Yaml map key", "ScalarNode", x)
    }

    private def asDate(n: yn.Node): ju.Date = {
      // ConstructYamlTimestamp throws a YAMLException if the node
      // cannot be parsed as a Date.
      val date = yamlConstructors.get(yn.Tag.TIMESTAMP).construct(n)
      date.asInstanceOf[ju.Date]
    }

    private def asTextList(n: yn.Node): List[String] = n match {
      case s: yn.SequenceNode =>
        val values: ju.List[yn.Node] = s.getValue
        values.toList.map(asText(_))
      case x => illegalArgBadClass("`values'", "SequenceNode", x)
    }

    /** Debug-prints a SnakeYaml node. The default toString prints
     *  not-very-usable info (for my particular need) so I've copy-edited
     *  org.yaml.snakeyaml.nodes.MappingNode's toString to include some
     *  more info.
     *  DoS attacks possible? Flooding appservers with long log messages?
     *  XSS attack? User provided data included in exception, shown in browser?
     */
    private def debugReprOf(node: yn.Node): String = node match {
      case m: yn.MappingNode =>
        val sb = new StringBuilder
        val ns: Iterator[yn.NodeTuple] = m.getValue.iterator
        while (ns.hasNext) {
          val n = ns.next()
          sb.append("{ key=")
          sb.append(n.getKeyNode.toString)
          sb.append("; value=Node<")
          // SnakeYaml here appends
          //   System.identityHashCode(node.getValueNode()),
          // so as to avoid overflow in case of recursive structures.
          // Including values 1 layer down should be safe though:
          sb.append(n.getValueNode.toString)
          sb.append("> }")
        }
        var repr = "<"+ m.getClass.getSimpleName +
                    " "+ m.getTag +" "+ sb.toString +">"
        // Sanitize HTML somewhat. Is some DoS attack possible, since end user
        // provided text is/might be included here?
        repr = repr.replace('<', '«') // « is not <
        repr = repr.replace('>', '»')
        // Remove obvious info
        repr = repr.replace("org.yaml.snakeyaml.nodes.", "")
        repr = repr.replace("tag=tag:yaml.org,2002:", "!")
        repr = repr.replace("tag=", "!")
        repr = repr.replace("key=","")
        repr.replace("value=","")
      case _ =>
        node.toString
    }

  }

  private def illegalArgBadClass(what: String,
                                   expected: String, obj: Object) =
    throw new IllegalArgumentException(
        what +" is not a "+ expected + "; it is a "+
        obj.getClass.getSimpleName)

}

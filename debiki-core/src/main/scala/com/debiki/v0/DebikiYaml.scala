// vim: fdm=marker ts=2 sw=2 et tw=78 wiw=82 fo=tcqwn list
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
import java.{io => jio, util => ju, lang => jl}
import net.liftweb.common.{Box, Empty, Full, Failure}

object DebikiYaml {

  def apply() = new DebikiYaml

  /** Notice: DoS or XSS attack: Bad input gives corrupt Yaml.
   */
  def toYaml(debate: Debate): String = {
    unimplementedIf(debate.postCount > 0, "Saving of posts and other stuff")
    val sb = new mut.StringBuilder
    sb ++= "\n--- !Debate"
    sb ++= "\nid: " ++= debate.id
    sb.toString
  }

  /** Notice: DoS or XSS attack: Bad input gives corrupt Yaml.
   */
  def toYaml(post: Post): String = {
    val sb = new mut.StringBuilder
    sb ++= "\n--- !Post"
    sb ++= "\nparent: " ++= post.parent
    sb ++= "\nid: " ++= post.id
    sb ++= "\nby: \"" ++= post.by += '"'
    sb ++= "\nip: \"" ++= post.ip += '"'
    sb ++= "\ndate: " ++= toIso8601(post.date)
    sb ++= "\ntext: |1\n" ++= stripIndent(post.text)
    sb.toString
  }

  /** Warning: DoS or XSS attack: Bad input gives corrupt Yaml.
   */
  def toYaml(rating: Rating): String = {
    val sb = new mut.StringBuilder
    sb ++= "\n--- !Rating"
    sb ++= "\nby: \"" ++= rating.by += '"'
    sb ++= "\nip: \"" ++= rating.ip += '"'
    sb ++= "\ndate: " ++= toIso8601(rating.date)
    sb ++= "\npost: " ++= rating.postId
    sb ++= "\ntags: " ++= rating.tags.mkString("[\"", "\", \"", "\"]")
    sb.toString
  }

  /** Warning: DoS or XSS attack: Bad input gives corrupt Yaml.
   */
  def toYaml(edit: Edit): String = {
    val sb = new mut.StringBuilder
    sb ++= "\n--- !Edit"
    sb ++= "\nid: \"" ++= edit.id += '"'
    sb ++= "\nby: \"" ++= edit.by += '"'
    sb ++= "\nip: \"" ++= edit.ip += '"'
    sb ++= "\ndate: " ++= toIso8601(edit.date)
    sb ++= "\npost: " ++= edit.postId
    sb ++= "\ntext: |1\n" ++= stripIndent(edit.text)
    sb ++= "\ndesc: |1\n" ++= stripIndent(edit.desc)
    sb.toString
  }

  /** Warning: DoS or XSS attack: Bad input gives corrupt Yaml.
   */
  def toYaml(editVote: EditVote): String = {
    val sb = new mut.StringBuilder
    sb ++= "\n--- !EditVote"
    sb ++= "\nid: \"" ++= editVote.id += '"'
    sb ++= "\nby: \"" ++= editVote.by += '"'
    sb ++= "\nip: \"" ++= editVote.ip += '"'
    sb ++= "\ndate: " ++= toIso8601(editVote.date)
    sb ++= "\nlike: " ++= editVote.like.mkString("[\"", "\", \"", "\"]")
    sb ++= "\ndiss: " ++= editVote.diss.mkString("[\"", "\", \"", "\"]")
    sb.toString
  }

  /** Warning: DoS or XSS attack: Bad input gives corrupt Yaml.
   */
  def toYaml(ea: EditApplied): String = {
    val sb = new mut.StringBuilder
    sb ++= "\n--- !EditApplied"
    sb ++= "\nedit: \"" ++= ea.editId += '"'
    sb ++= "\ndate: " ++= toIso8601(ea.date)
    sb ++= "\ndebug: |1\n" ++= stripIndent(ea.debug)
    sb ++= "\nresult: |1\n" ++= stripIndent(ea.result)
    sb.toString
  }

  def toYaml(result: AddVoteResults): String = {
    val sb = new mut.StringBuilder
    for (ea <- result.newEditsApplied) sb ++= toYaml(ea)
    sb.toString
  }

  private def stripIndent(text: String) =
    " " + // indent first line, 1 space
    stripStartEndBlanks(text).
        replaceAll("\n", "\n "). // indent other lines
        replace("\r", "") // convert \r\n to \n
}

class DebikiYaml {

  private def buildDebate(iter: Iterable[Object]): Box[Debate] = {
    var debate: Box[Debate] = Empty
    var posts = List[Post]()
    var ratings = List[Rating]()
    var edits = List[Edit]()
    var editVotes = List[EditVote]()
    var editsApplied = List[EditApplied]()
    for (obj <- iter) obj match {
      case d: Debate =>
        if (debate.isDefined) unsupported("More than one debate found: "+
                                "Don't know to which debate the posts belong")
        debate = Some(d)
      case p: Post => posts ::= p
      case r: Rating => ratings ::= r
      case e: Edit => edits ::= e
      case v: EditVote => editVotes ::= v
      case a: EditApplied => editsApplied ::= a
      case x => unimplemented("Handling of: "+ x)
    }
    debate.map(_.copy(posts = posts, ratings = ratings,
        edits = edits, editVotes = editVotes, editsApplied = editsApplied))
  }

  /** Loads a debate from all Yaml documents in a text.
   */
  def loadDebateFromText(text: String): Box[Debate] = {
    val dc = new DebateConstructor
    val yaml = new y.Yaml(new y.Loader(dc))
    val iterable = yaml.loadAll(text)
    buildDebate(iterable)
  }

  def loadDebateFromPath(path: String): Box[Debate] =
    loadDebateFromFiles(new jio.File(path))

  /** Loads a debate from all Yaml documents specified.
   *
   * If many files are specified, they are sorted by name and then
   * concatenated to a single stream. If a directory is specified,
   * all files in that directory are loaded (but no recursion into child
   * directories).
   */
  def loadDebateFromFiles(files: jio.File*): Box[Debate] = {
    var debate: Option[Debate] = None
    val dc = new DebateConstructor
    try {
      var fs = files flatMap { f =>
        if (f.isFile) f :: Nil
        else if (f.isDirectory) f.listFiles.filter(_.isFile)
        else if (!f.exists) throw new jio.FileNotFoundException(f.getPath)
        else throw new jio.IOException("Weird file: "+ f.getPath)
      }
      fs = fs sortBy (_.getName)  // for deterministic behavior
      val isEnum: ju.Enumeration[jio.FileInputStream] =
            fs.map((f: jio.File) => new jio.FileInputStream(f)).iterator
            //.asJavaEnumeration  -- required in 2.8.1?
      val is = new jio.SequenceInputStream(isEnum)
      val iter: jl.Iterable[Object] = new y.Yaml(new y.Loader(dc)).loadAll(is)
      buildDebate(iter)

      // `iter' becomes Nil, or keeps only iters.head(), weird:
      //val iters = for (f <- files2) yield {
      //  val is = new jio.FileInputStream(f)
      //  val javaIterable = new y.Yaml(new y.Loader(dc)).loadAll(is)
      //  javaIterable: Iterable[Object]
      //}
      //val iter: Iterable[Object] = collection.Iterable.concat(iters: _*)
      //buildDebate(iter)
    }
    catch {
      case e: jio.IOException => return Failure(
        "IO error, files: " + files, Full(e), Empty)
      case e: jio.FileNotFoundException => return Failure(
        "Files not found: " + files, Full(e), Empty)
    }
  }

  private class DebateConstructor extends yc.SafeConstructor {

    private val yamlTagPrefix = "!"//"!org.debiki.v0.debikigenhtml."

    yamlConstructors.put(
      new yn.Tag(yamlTagPrefix +"Debate"), new ConstrDebate)
    yamlConstructors.put(
      new yn.Tag(yamlTagPrefix +"Post"), new ConstrPost)
    yamlConstructors.put(
      new yn.Tag(yamlTagPrefix +"Rating"), new ConstrRating)
    yamlConstructors.put(
      new yn.Tag(yamlTagPrefix +"Edit"), new ConstrEdit)
    yamlConstructors.put(
      new yn.Tag(yamlTagPrefix +"EditVote"), new ConstrEditVote)
    yamlConstructors.put(
      new yn.Tag(yamlTagPrefix +"EditApplied"), new ConstrEditApplied)

    private class ConstrDebate extends DebikiMapConstr {

      override def handleTuples(tuples: ju.List[yn.NodeTuple]): Debate = {
        var debateId: Option[String] = None
        for (t <- tuples) asText(t.getKeyNode) match {
          case "id" => debateId = Some(asText(t.getValueNode))
          case _ => // ignore unknown entries
        }
        illegalArgIf(debateId.isEmpty, "Debate id missing")
        Debate.empty(debateId.get)
      }
    }

    private class ConstrPost extends DebikiMapConstr {

      override def handleTuples(tuples: ju.List[yn.NodeTuple]): Post = {
        var id: Option[String] = None
        var parent: Option[String] = None
        var date: Option[ju.Date] = None
        var by: Option[String] = None
        var text: Option[String] = None
        var ip = "?.?.?.?"

        for (t <- tuples) asText(t.getKeyNode) match {
          case "id" => id = Some(asText(t.getValueNode))
          case "parent" => parent = Some(asText(t.getValueNode))
          case "date" => date = Some(asDate(t.getValueNode))
          case "by" => by = Some(asText(t.getValueNode))
          case "ip" => ip = asText(t.getValueNode)
          case "text" => text = Some(asText(t.getValueNode))
          case _ => // fine, allow future extensions
        }

        illegalArgIf(id.isEmpty, "`id' entry missing")
        illegalArgIf(parent.isEmpty, "`parent' entry missing")
        illegalArgIf(date.isEmpty, "`date' entry missing")
        illegalArgIf(text.isEmpty, "`text' entry missing")

        new Post(id = id.get, parent = parent.get, date = date.get,
                  by = by.get, ip = ip, text = text.get)
      }
    }

    private class ConstrRating extends DebikiMapConstr {

      override def handleTuples(tuples: ju.List[yn.NodeTuple]): Rating = {
        var by: Option[String] = None
        var postId: Option[String] = None
        var date: Option[ju.Date] = None
        var tags: List[String] = null
        var ip = "?.?.?.?"

        for (t <- tuples) asText(t.getKeyNode) match {
          case "by" => by = Some(asText(t.getValueNode))
          case "ip" => ip = asText(t.getValueNode)
          case "post" => postId = Some(asText(t.getValueNode))
          case "date" => date = Some(asDate(t.getValueNode))
          case "tags" => tags = asTextList(t.getValueNode)
          case _ => // fine, allow future extensions
        }

        illegalArgIf(by.isEmpty, "`by' entry missing")
        illegalArgIf(postId.isEmpty, "`parent' entry missing")
        illegalArgIf(date.isEmpty, "`date' entry missing")
        illegalArgIf(tags == null, "`tags' entry missing")

        Rating(postId = postId.get, by = by.get, ip = ip,
               date = date.get, tags = tags)
      }
    }

    private class ConstrEdit extends DebikiMapConstr2 {

      val text = new KeyVal[String]("text", asText)
      val desc = new KeyVal[String]("desc", asText)

      override def construct() = Edit(
          id = id.value, postId = postId.value, date = date.value,
          by = by.value, ip = ip.value, text = text.value,
          desc = desc.value)
    }

    private class ConstrEditVote extends DebikiMapConstr2 {

      val edit = new KeyVal[String]("edit", asText)
      val like = new KeyVal[List[String]]("like", asTextList, Some(Nil))
      val diss = new KeyVal[List[String]]("diss", asTextList, Some(Nil))

      override def construct() = EditVote(
          id = id.value, by = by.value, ip = ip.value,
          date = date.value, like = like.value, diss = diss.value)
    }

    private class ConstrEditApplied extends DebikiMapConstr2 {

      val edit = new KeyVal[String]("edit", asText)
      val result = new KeyVal[String]("result", asText)

      override def construct() = EditApplied(
          editId = edit.value, date = date.value, result = result.value)
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

    /** Loops through all Yaml map entries in a Yaml map node,
     *  and stores some frequently used values in certain fields,
     *  based on their key names. The same key-name/field combination
     *  is used regardless of what type of Yaml object is being read.
     *  This entails a map entry with a given name means the same,
     *  regardless of context.  For example, `post' is always a String;
     *  `date' is always a ju.Date.
     *  Subclasses can add their own unique key/value fields.
     */
    private abstract class DebikiMapConstr2 extends yc.AbstractConstruct {

      var keyVals: List[KeyVal[_]] = Nil

      class KeyVal[E](
        val key: String,
        private val valueFromNode: Function1[yn.Node, E],
        private val default: Option[E] = None
      ){
        private var _value: Option[E] = None
        def parseValue(n: yn.Node) { _value = Some(valueFromNode(n)) }
        def value: E = {
          _read = true;
          _value.getOrElse(default.getOrElse(
            throw new RuntimeException("`"+ key +"' entry missing")))
        }
        var _read = false
        def read = _read
        keyVals ::= this
      }

      val id = new KeyVal[String]("id", asText)
      val postId = new KeyVal[String]("post", asText)
      val date = new KeyVal[ju.Date]("date", asDate)
      val by = new KeyVal[String]("by", asText)
      val ip = new KeyVal[String]("ip", asText, Some("?.?.?.?"))
      val debug = new KeyVal[String]("debug", asText)

      def construct(): Object

      override def construct(node: yn.Node): Object = {
        try {
          val tuples: ju.List[yn.NodeTuple] = node match {
            case m: yn.MappingNode => m.getValue
            case x => illegalArgBadClass("`node'", "MappingNode", x)
          }

          for (t <- tuples; kv <- keyVals) {
            val key = asText(t.getKeyNode)
            if (kv.key == key) {
              kv.parseValue(t.getValueNode)
              // break -- no, there is no break?
            }
          }

          construct()
        }
        catch {
          case e: Exception => throw new RuntimeException(
              "Error parsing this node: "+ debugReprOf(node), e)
        }
      }
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
      case s: yn.ScalarNode =>
        List[String](s.getValue)
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

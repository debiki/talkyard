// vim: ts=2 sw=2 et
package debikigenhtml

import org.yaml.{snakeyaml => y}
import io._
import scala.collection.JavaConversions._
import scala.collection.{mutable => mut}

object HtmlUtil {
  val htmlPrefix =
"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN"
 "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">"""
  val css = """
div {
  float: none;
  margin-top: 0px;
  margin-right: auto;
  margin-bottom: 0px;
  margin-left: auto;
}
.thread {
  float: inherit;
  margin: 7px 3px 3px 10px;
  border: 1px;
  border-color: #A0A0A0;
  border-style: solid none none none;
  }
.left {
  float: left;
  width: 48%
  }
.right {
  float: right;
  width: 48%
  }
"""
}

/**
 * Test conversion from YAML to HTML of debate / discussion.
 */
object App {
  def main(args: Array[String]) {
    var dir = ""
    var out = "-"
    var layoutMgr: LayoutManager = new SimpleLayoutManager
    var i = 0
    while (i < args.length) {
      args(i) match {
        case a =>
            // Option value required for these args
            if (i + 1 >= args.length)
              error("Value missing for option: "+ a)
            a match {
              case "-d" => dir = args(i+1)
              case "-o" => out = args(i+1)
              case _ => error("Bad option: "+ a)
            }
            i += 1
      }
      i += 1
    }
    val debate = Debate.fromDir(dir)
    val xml =
      <html xmlns="http://www.w3.org/1999/xhtml"
        xmlns:lift="http://liftweb.net/">
        <head>
          <title>Test mock layout</title>
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
          <style type="text/css">{HtmlUtil.css}</style>
        </head>
        <body>{
          layoutMgr.layout(debate)
        }</body>
      </html>
    val html = HtmlUtil.htmlPrefix + xml

    if (out == "-") println(html)
    else {
      val writer = new java.io.FileWriter(out)
      writer.write(html.toString)
      writer.close
    }
  }
}

object DebikiYaml {

  def newYaml: y.Yaml = {
    val opts = new y.DumperOptions
    //opts.setDefaultFlowStyle(y.DumperOptions.FlowStyle.BLOCK)
    //opts.setDefaultScalarStyle(y.DumperOptions.ScalarStyle.LITERAL)
    opts.setLineBreak(y.DumperOptions.LineBreak.UNIX)
    opts.setIndent(1)
    val loader = new y.Loader(new y.constructor.SafeConstructor)
    new y.Yaml(loader, new y.Dumper(opts))
  }

}

object Util {

  def requireDir(dirPath: String) {
    require(dirPath ne null, "Path is null")
    require(dirPath endsWith "/", "Dir path does not end with '/'")
  }

}

import Util._

object Debate {

  val RootPost = "_root"

  class UnsafeSeed(val debateMeta: Object) {
    val ids = mut.Set[String]()
    val logs = mut.Map[String, Object]()
    val props = mut.Map[String, Object]()
    val texts = mut.Map[String, String]()
  }

  def fromDir(dirPath: String): Debate = {
    requireDir(dirPath)
    val yaml = DebikiYaml.newYaml

    // Find main debate file, create seed
    val seed = new UnsafeSeed(
          yaml.load(Source.fromPath(dirPath +"_debate.yaml").mkString))

    // Find individual post files
    for {
      f <- (new java.io.File(dirPath).listFiles)
      if !f.isDirectory
      postId = f.getName.takeWhile(_ != '.')
    }{
      var isPost = true
      if (f.getName.endsWith(".props.yaml"))
        seed.props += postId -> yaml.load(Source.fromFile(f).mkString)
      else if (f.getName.endsWith(".log.yaml"))
        seed.logs += postId -> yaml.load(Source.fromFile(f).mkString)
      else if (f.getName.endsWith(".text"))
        seed.texts += postId -> Source.fromFile(f).mkString
      else
        isPost = false
      if (isPost)
        seed.ids += postId
    }

    fromSeed(seed)
  }

  def fromSeed(seed: UnsafeSeed): Debate = {

    // === Parse layout

    val layoutObj = seed.debateMeta match {
      case m: java.util.LinkedHashMap[String, Object] => m.get("layout")
      case x => error("debateObj contains no map, found: "+
                      x.getClass.getSimpleName)
    }

    require(layoutObj ne null, "`layout' entry missing")

    var layoutMap = Map[String, List[String]]()

    def addPosts(parent: String, obj: Object) {
      require(!layoutMap.contains(parent), parent +" found twice")
      var childPosts = List[String]()
      val arr = obj match {
        case a: java.util.ArrayList[Object] => a
        case x => error(parent +" not followed by a list, found: "+
                        x.getClass.getSimpleName)
      }
      for (x <- arr) x match {
        case m: java.util.LinkedHashMap[String, Object] =>
          require(m.size == 1)
          for ((post, childList) <- m) {
            childPosts = post :: childPosts
            addPosts(post, childList)
          }
        case x => error(parent +"'s list contains a non-map: "+
                        x.getClass.getSimpleName)
      }

      layoutMap = layoutMap + (parent -> childPosts.reverse)
    }

    addPosts(RootPost, layoutObj)

    // === Parse posts

    var posts = Map[String, Post]()
    for (id <- seed.ids) {
      try {
        posts = posts + (id -> Post.fromObjs(id, seed.texts.get(id).get,
                         seed.props.get(id).get, seed.logs.get(id).get))
      } catch {
        case x: NoSuchElementException =>
            System.err.println("File missing for post ["+ id +"], ignored")
      }
    }

    new Debate(layoutMap, posts)
  }
}

class Debate(
  val layout: Map[String, List[String]],
  val posts: Map[String, Post]
){

  override def toString: String = {
    def showLayout(post: String, depth: Int) = {
      val children = layout.get(post).getOrElse(Nil)
      (" " * depth) +"- "+ post +": "+
        (if (children.isEmpty) "[]\n" else "\n")
    }
    "layout:\n"+ showLayout("root", 0)
  }
}

object Post {

  def fromFiles(dirPath: String, id: String): Post = {
    requireDir(dirPath)
    val text = Source.fromPath(dirPath + id +".text").mkString
    val props = Source.fromPath(dirPath + id +".props.yaml").mkString
    val log = Source.fromPath(dirPath + id +".log.yaml").mkString
    val yaml = DebikiYaml.newYaml
    fromObjs(id, text, yaml.load(props), yaml.load(log))
  }

  def fromObjs(id: String, text: String, props: Object, log: Object): Post = {
    val propsMap = props match {
      case m: java.util.Map[String, Object] => m
      case x => error("Post's root property map missing, found: "+
                      x.getClass.getSimpleName)
    }
//    val text = map.get("text") match {
//      case t: String => t
//      case _ => error("`text' is not a String")
//    }
    val logList = log match {
      case l: java.util.List[Object] => l
      case x => error("Post's root log list missing, found: "+
                      x.getClass.getSimpleName)
    }
    new Post(id, text)
  }

}

class Post(
  val id: String,
  val text: String
){

}

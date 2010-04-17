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
/* Brief CSS-reset */
html, div, h1, h2, p, pre {
  padding: 0;
  margin: 0;
}
div {
  margin: 0px auto;
  padding: 3px;
}
.thread {
  float: left;
  margin: 7px 3px 3px 10px;
  border: 1px;
  border-color: #A0A0A0 #A0F0F0 #F0A0F0;
  border-style: solid;
  }
.depth-1 {
  width: 48%;
  }
.depth-2 * {
  float: none;
  }

* {
  overflow: hidden
  }
*:hover {
  overflow: visible;
  }

* {
  background-color: inherit;
  }
.depth-1:hover {
  background-color: #FEF;
  }
.depth-2:hover {
  background-color: #FDF;
  }
.depth-3:hover {
  background-color: #FCF;
  }

.post {
  position: relative;
  }
.post .meta {
  display: none;
  position: absolute;
  top: -10px;
  margin: 0;
  padding: 0 1.2em;
  background-color: lightGrey;
  }
.post:hover .meta {
  display: block
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
    var widths = List[Int]()
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
              case "-w" =>
                widths = args(i+1).split(",").toList.map(_.toInt)
              case _ => error("Bad option: "+ a)
            }
            i += 1
      }
      i += 1
    }

    val debate: Debate = (new DaoYaml).getDebate(dir)
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

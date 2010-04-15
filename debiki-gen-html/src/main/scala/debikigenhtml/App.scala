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

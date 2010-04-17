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

/* === Standard tags === */

/* --- Brief CSS-reset ---*/
html, div, h1, h2, p, pre {
  padding: 0;
  margin: 0;
}

/* --- Standard elems ---*/
p {
  margin: 0 0 0.7em;
}
p:last-child {
  margin-bottom: 0;
}

/* === Threads === */

/* --- Indentation ---*/
.thread.depth-0 {
  /* center root post */
  margin: 1em auto;
  }
.thread.depth-0 .thread {
  margin: 1em 0 0 0;
  border-top: 1px solid lightGrey;
  }
.thread.depth-1 .thread {
  padding-left: 0.6em;
  border-top: none;
  border-left: 1px solid #A0A0A0;
  }

/* --- Float ---*/
.thread {
  float: left;
  }
.depth-2 * {
  float: none;
  }

/* --- Width ---*/
.depth-1 {
  max-width: 25em;
  }
.post {
  max-width: 25em;
  min-width: 22em;
  }

/* === Hover === */

/* --- Overflow ---*/
body * {
  overflow: hidden
  }
body *:hover {
  overflow: visible;
  }

/* --- Color ---*/
* {
	background-color: inherit;
}
.depth-1:hover {
	background-color: #FAEAFA;
}
.depth-2:hover {
	background-color: #FAE2FA;
}
.depth-3:hover {
	background-color: #FADDFA;
}
.depth-4:hover {
	background-color: #FAD7FA;
}

/* --- Posts --- */
.post {
  position: relative;
  }
.post .meta {
  display: none;
  position: absolute;
  top: -16px;
  margin: 0;
  padding: 0 1.2em;
  background-color: lightGrey;
  }
.post:hover .meta {
  display: block
  }

/* --- Post border ---*/
.post .text {
  /* invisible border, so tags won't move when border 
    made visible (when hovering) */
	border: 1px dashed rgba(1,1,1,0);
	padding: 0 3px 3px;
	padding-bottom: 0; /* tag p's bottom margin suffice */
}
.post:hover .text {
	border: 1px dashed gray;
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

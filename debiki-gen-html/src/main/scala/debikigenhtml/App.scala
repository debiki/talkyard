// vim: ts=2 sw=2 et
package debikigenhtml

// Nice threads:
// http://springthistle.com/wp-content/uploads/2010/03/comments.png

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
html, div, h1, h2, p, pre, hr {
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

/* === Debate === */

.debate {
  margin-left: 0.3em;
}

/* === Threads === */

/* --- Indentation ---*/
.thread.depth-0 {
  /* center root post */
  margin: 1em auto;
  }
.thread.depth-0 .thread {
  margin: 1em 0 0 0;
  border-left: 1em solid white;
  border-bottom: 1ex solid white;
  }
.thread.depth-0 > .thread {
  margin-left: 0.5em;
  }
.xx.thread.depth-0 > .thread:nth-child(2) {
  /* thread no. 2 is currently the leftmost one,
   * need no left margin, since whole .debate already
   * has left margin.
   * - no, disable. Might indent badly on Android.
   */
  margin-left: 0;
  }
.thread.depth-1 .thread {
  margin-left: 0.0em;
  padding-left: 0;
  border-top: none;
  }
.thread.depth-0 .thread:hover {
  border-left: 1em solid #CCC;
  border-bottom: 1ex solid #777;
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
  /* Avoids >1 column for this depth */
  max-width: 25em;
  }
.post {
  max-width: 25em;
  min-width: 22em;
  --max-height: 4em;
  }
.post:hover {
  --z-index: 100;
  --max-height: none;
}

/* === Hover === */

/* --- Overflow --- (not in use) */
body * {
  overflow: hidden
  }
body *:hover {
  overflow: visible;
  }

/* === Posts === */

.post {
  border-top: 5px solid #EEE;
  }

.post:hover {
	background-color: #DDFFDD;
}

/* --- Meta ---*/
.post {
  position: relative;
  }
.post .meta {
  display: none;
  position: absolute;
  top: -16px;
  margin: 0;
  padding: 0 1.2em 0 5px; /* there's a .thread border to the left */
  background-color: lightGrey;
  }
.post:hover .meta {
  --display: block
  }

/* --- Buttons ---*/
.post .owner,
.post .time {
  float: left;
}

.post .owner {
  padding-right: 1em;
}

.post .time {
  margin-right: 1em;
}

.post .edit,
.post .rate,
.post .reply {
  float: right;
  margin-left: 1em;
  visibility: hidden;
}

.post:hover .edit,
.post:hover .rate,
.post:hover .reply {
  visibility: visible;
}

.post .owner,
.post .time,
.post .edit,
.post .rate,
.post .reply {
  padding: 0 1ex;
  background-color: #DDD;
  position: relative;
}

.post:hover .owner,
.post:hover .time,
.post:hover .edit,
.post:hover .rate,
.post:hover .reply {
  --background-color: #DDF;
}

.post .owner:hover,
.post .time:hover,
.post .edit:hover,
.post .rate:hover,
.post .reply:hover {
  background-color: #CCF;
  cursor: crosshair;
}

/* --- Text ---*/
.post .text {
  clear: both;
	padding: 3px 3px 3px 0;
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

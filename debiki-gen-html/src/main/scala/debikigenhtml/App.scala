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

/* --- CSS-reset ---*/
/* http://meyerweb.com/eric/tools/css/reset/ */
/* v1.0 | 20080212 */

html, body, div, span, applet, object, iframe,
h1, h2, h3, h4, h5, h6, p, blockquote, pre,
a, abbr, acronym, address, big, cite, code,
del, dfn, em, font, img, ins, kbd, q, s, samp,
small, strike, strong, sub, sup, tt, var,
b, u, i, center,
dl, dt, dd, ol, ul, li,
fieldset, form, label, legend,
table, caption, tbody, tfoot, thead, tr, th, td {
	margin: 0;
	padding: 0;
	border: 0;
	outline: 0;
	font-size: 100%;
	vertical-align: baseline;
	background: transparent;
}
body {
	line-height: 1;
}
ol, ul {
	list-style: none;
}
blockquote, q {
	quotes: none;
}
blockquote:before, blockquote:after,
q:before, q:after {
	content: '';
	content: none;
}

/* remember to define focus styles! */
:focus {
	outline: 0;
}

/* remember to highlight inserts somehow! */
ins {
	text-decoration: none;
}
del {
	text-decoration: line-through;
}

/* tables still need 'cellspacing="0"' in the markup */
table {
	border-collapse: collapse;
	border-spacing: 0;
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
  background-color: #DDD;
}

.post .owner {
  padding-right: 1em;
}

.post .edit,
.post .vote,
.post .reply {
  float: right;
  margin-left: 0.5em;
  background-color: #BBF;
  visibility: hidden;
}

.post:hover .edit,
.post:hover .vote,
.post:hover .reply {
  visibility: visible;
}

.post .owner,
.post .time,
.post .edit,
.post .vote,
.post .reply {
  padding: 1px 0.3em;
  margin-bottom: 2px;
  position: relative;
}

.post .owner:hover,
.post .time:hover,
.post .edit:hover,
.post .vote:hover,
.post .reply:hover {
  background-color: #CCF;
  cursor: default;
}

/* --- Text ---*/
.post .text {
  clear: both;
	padding: 3px 3px 3px 0;
}

/* --- Menus ---*/
.post .menu {
  position: absolute;
  background-color: #CCF;
  left: 1ex;
  z-index: 100;
}

.post .menu li {
  padding: 0.8ex 1ex;
}

.post .menu li:hover {
  background-color: #EEF;
  cursor: crosshair;
}

#hidden-menus {
  display: none;
}

.post .menu .sub.menu {
  visibility: hidden;
  left: 2em;
  background-color: #DBF;
}

.post .menu li:hover > .sub.menu {
  visibility: visible;
}

.post .sub.menu li:hover {
  background-color: #EDF;
}

/* === Misc === */

.parent-ref {
  font-weight: bold;
}

.highlight {
  outline: blue dotted medium
}

"""

  val Menus =
    <div id="hidden-menus">
      <ul id="edit-menu" class="menu">
        <li>Edit</li>
        <li>Copy&nbsp;&amp;&nbsp;edit</li>
        <li>Delete</li>
        <li>Move</li>
      </ul>
      <ul id="vote-menu" class="menu">
        <li class="up">Vote&nbsp;up</li>
        <li class="down">Vote&nbsp;down</li>
        <li class="it">It...
          <ul class="sub menu">
            <li>Agrees&nbsp;(with&nbsp;the&nbsp;<span class="parent-ref">parent</span>&nbsp;post,
              <i>but not necessarily with you</i>)</li>
            <li>Disagrees</li>
          </ul>
        </li>
        <li class="it-is">It is...
          <ul class="sub menu">
            <li>Interesting</li>
            <li>Obvious</li>
            <li>Insightsful</li>
            <li>Stupid</li>
            <li>Funny</li>
            <li>Off topic</li>
            <li>Troll</li>
          </ul>
        </li>
        <li class="suggestions">Vote&nbsp;on&nbsp;suggestions...
          <ul class="sub menu">
            <li>Show&nbsp;all</li>
          </ul>
        </li>
      </ul>
      <ul id="reply-menu" class="menu">
        <li>Just&nbsp;reply</li>
        <li>Agree</li>
        <li>Dissent</li>
        <li>Off&nbsp;topic</li>
      </ul>
    </div>

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
          <script type="text/javascript" src="jquery-1.4.2.js" />
          <script type="text/javascript" src="debiki.js" />
        </head>
        <body>
          { layoutMgr.layout(debate) }
          { HtmlUtil.Menus }
        </body>
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

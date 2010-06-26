// vim: ts=2 sw=2 et

package com.debiki.v0

import org.yaml.{snakeyaml => y}
import io._
import scala.collection.JavaConversions._
import scala.collection.{mutable => mut}

object HtmlUtil {

  val htmlPrefix =
"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN"
 "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">"""

}

/**
 * Test conversion from YAML to HTML of debate / discussion.
 */
private[debiki] object App {
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
          <link type="text/css" rel="stylesheet"
              href="css/debiki/jquery-ui-1.8.1.custom.css"/>
          <link type='text/css' rel='stylesheet' href='debiki.css' />
          <script type="text/javascript" src="jquery-1.4.2.js" />
          <script type="text/javascript"
              src="js/debiki-jquery-ui-1.8.1.custom.min.js" />
          <!-- <script type="text/javascript"
              src="http://ajax.googleapis.com/ajax/libs/jqueryui/1.8.1/jquery-ui.min.js"/> -->
          <script type="text/javascript" src="js/debiki-dragscrollable.js" />
          <script type="text/javascript" src="debiki.js" />
          <script type="text/javascript" src="js/debiki-layout.js" />
          <script type="text/javascript">
            jQuery.noConflict()(function($){{
              $('body').debiki_dragscrollable(
                  {{ dragSelector: '.dw-thread', scrollable: '.dw-thread' }});
            }});
          </script>
        </head>
        <body>
          { layoutMgr.layout(debate) }
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

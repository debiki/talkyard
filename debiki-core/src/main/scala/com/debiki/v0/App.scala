// vim: ts=2 sw=2 et

package com.debiki.v0

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

  val Menus =
    <div id="hidden-menus">
      <div id='action-menu' class='ui-state-default'>
        <div class='reply'>Reply</div>
        <div class='vote'>Vote</div>
        <div class='edit'>Edit</div>
      </div>
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
      <div class='reply-template'>
        <div class='depth-3 thread reply preview'>
          <div class='post'>
            <div class='owner'><i>Your reply</i></div>
            <div class='text'>The cat was playing in the garden.</div>
          </div>
          <form class='agree reply'
              action='http://localhost:8084/tinywiki/Wiki.jsp?page=Main'
              accept-charset='UTF-8'
              method='post'>
            <input type='hidden' name='parent' value='a'/>
            <input type='hidden' name='author' value='Unknown'/>
            <textarea name='reply' rows='10' cols='30'
              >The cat was playing in the garden.</textarea><br/>
            <input class='submit' type='submit' value='Submit reply'/>
            <button class='cancel' type='button'>Cancel</button>
          </form>
        </div>
      </div>
    </div>

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

/*
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
*/

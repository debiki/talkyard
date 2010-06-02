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

  val ccWikiLicense =
    <a rel="license" href="http://creativecommons.org/licenses/by/3.0/">
      Creative Commons Attribution 3.0 Unported License
    </a>

  val submitButtonText = "Submit reply"

  val Menus =
    <div id="dw-hidden-menus">
      <div id='dw-action-menu' class='ui-state-default'>
        <div class='dw-reply'>Reply</div>
        <div class='dw-vote'>Vote</div>
        <div class='dw-edit'>Edit</div>
      </div>
      <ul id="dw-edit-menu" class="dw-menu">
        <li>Edit</li>
        <li>Copy&nbsp;&amp;&nbsp;edit</li>
        <li>Delete</li>
        <li>Move</li>
      </ul>
      <ul id="dw-vote-menu" class="dw-menu">
        <li class="dw-up">Vote&nbsp;up</li>
        <li class="dw-down">Vote&nbsp;down</li>
        <li class="dw-it">It...
          <ul class="dw-sub dw-menu">
            <li>Agrees&nbsp;(with&nbsp;the&nbsp;<span class="dw-parent-ref">parent</span>&nbsp;post,
              <i>but not necessarily with you</i>)</li>
            <li>Disagrees</li>
          </ul>
        </li>
        <li class="dw-it-is">It is...
          <ul class="dw-sub dw-menu">
            <li>Interesting</li>
            <li>Obvious</li>
            <li>Insightsful</li>
            <li>Stupid</li>
            <li>Funny</li>
            <li>Off topic</li>
            <li>Troll</li>
          </ul>
        </li>
        <li class="dw-suggestions">Vote&nbsp;on&nbsp;suggestions...
          <ul class="dw-sub dw-menu">
            <li>Show&nbsp;all</li>
          </ul>
        </li>
      </ul>
      <ul id="dw-reply-menu" class="dw-menu">
        <li>Just&nbsp;reply</li>
        <li>Agree</li>
        <li>Dissent</li>
        <li>Off&nbsp;topic</li>
      </ul>
      <div class='dw-reply-template'>
        <div class='dw-depth-3 dw-thread dw-reply dw-preview'>
          <div class='dw-post'>
            <div class='dw-owner'><i>Your reply</i></div>
          </div>
          <form class='dw-agree dw-reply'
              action='http://localhost:8084/tinywiki/Wiki.jsp?page=Main'
              accept-charset='UTF-8'
              method='post'>
            <input type='hidden' name='parent' value='a'/>
            <input type='hidden' name='author' value='Unknown'/>
            <textarea name='reply' rows='10' cols='34'
              >The cat was playing in the garden.</textarea><br/>
            <p class='dw-user-contrib-license'>
              By clicking <i>{submitButtonText}</i>, you agree to license
              the text you submit under the {ccWikiLicense}.
            </p>
            <input class='dw-submit' type='submit' value={submitButtonText}/>
            <button class='dw-cancel' type='button'>Cancel</button>
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

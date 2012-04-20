/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package com.debiki.v0

import _root_.net.{liftweb => lw}
import _root_.scala.xml.{Node, NodeSeq, Text}
import _root_.scala.util.matching.Regex
import Prelude._


/** A template source page for some Web template engine.
 */
trait TemplateSource {
  /** Configuration values. */
  def params: TemplateParams
  /** The html source for this template. */
  def html: NodeSeq
}


case object TemplateSrcHtml {

  val DefaultText =
    """|#extend: no-template
       |---
       |<html>
       |<head>
       |# Elements you place here are appended to the page's <head>.
       |</head>
       |<body>
       |# This <div> will be replaced by the page body and title, and comments.
       |   <div id='debiki-page'></div>
       |</body>
       |</head>
       |""" stripMargin

}


/** A HTML template source file; it's a HTML document with some Yaml
 * configuration at the top.
 *
 * Template source example:  (the text above '---' is the Yaml config options.
 * (Yaml documents are terminated by '---'.)
 *
 *     extend: /parent/template
 *     ---
 *     <html>
 *       ...
 *     </html>
 */
case class TemplateSrcHtml(post: ViPo, path: String) extends TemplateSource {

  // A regex that splits on the end-of-Yaml-document indicator, '---'.
  // More exactly, split on: (newline)---(newline)(whitespace)(<)
  // but does not consume the first newline, nor the '<'
  // -- they're part of the Yaml and HTML documents.
  // Do this by using lookbehind and lookahead regex groups,
  // i.e. the "(?...)" stuff below. Find info on lookahead/behind here:
  //   http://docs.oracle.com/javase/6/docs/api/java/util/regex/Pattern.html
  // (You could test it in the console:
  //  val x = "(?<=\n)---\r?\n\\s*(?=<)".r; x split "Yaml\n---\n\n\n<html>"
  // )
  val docBoundaryRegex = "(?<=\n)---\r?\n\\s*(?=<)".r

  // All lines that start with # (as the first non-space/tab) are comments.
  // (( "(?m)" makes ^ match newlines, in addition to the start of the doc. ))
  val commentLineRegex = """(?m)^[ \t]*#.*$""".r

  lazy val (
    params: TemplateParams,
    /** The html source for this template. */
    html: NodeSeq
  ) = {
    val templateSrcWithComments = post.text
    val templateSrc = commentLineRegex.
          replaceAllIn(templateSrcWithComments, "")

    // Extract the Yaml and html documents
    val (yamlSrc: String, htmlSrc: String) =
        (docBoundaryRegex findFirstMatchIn templateSrc) match {
      case Some(matsh: Regex.Match) =>
        (matsh.before, matsh.after)
      case None =>
        // There's no --- boundary. If the source starts with a '<'
        // then it's probably html, otherwise assume it's Yaml.
        if (("""^\s*<""".r findFirstIn templateSrc) isDefined) {
          ("", templateSrc)
        } else {
          (templateSrc, "")
        }
    }

    // Read config options from Yaml doc.
    // For now, only support for `extend: /some/template'.
    // (( "(?m)" turns on multiline mode, so '^' matches not only the start
    // of the document, but also the start of a new line, Apparently, "(?m)"
    // doesn't count as a match group, so "(\w)" is the first group, 1. ))
    val params = new TemplateParamsMutable
    ("""(?m)^(\w+): *(\S+)$""".r findAllIn yamlSrc
        ).matchData foreach { matsh =>
      val paramName = matsh.group(1)
      val paramValue = matsh.group(2)
      paramName match {
        case CommentVisibility.ParamName =>
          params.commentVisibility = Some(CommentVisibility.parse(paramValue))
        case TemplateToExtend.ParamName =>
          params.templateToExtend = Some(TemplateToExtend.parse(paramValue))
        case badParam =>
          // For now, die.
          runErr("DwE33UC7", "Invalid template parameter: "+ safed(badParam))
      }
    }

    val html: NodeSeq = {
      // (Is this needed if no <html> around <head> and <body>?:
      //   <div>"+ htmlText +"</div>").open_!.child  )
      if (htmlSrc nonEmpty) lw.util.Html5.parse(htmlSrc).open_!
      else Nil
    }

    (params.toImmutable, html)
  }
}


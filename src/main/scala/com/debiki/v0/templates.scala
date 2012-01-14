/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package com.debiki.v0

import _root_.net.{liftweb => lw}
import _root_.scala.xml.{Node, NodeSeq, Text}
import _root_.scala.util.matching.Regex
import Page.Page
import Prelude._


// If I add more engines, then perhaps this'd be useful:
/** A template source page for some Web template engine.
sealed abstract class TemplateSource {
}
 */


sealed abstract class TemplateToExtend

object TemplateToExtend {
  case object ExtendParentFolderTmpl extends TemplateToExtend
  case object ExtendNoTemplate extends TemplateToExtend
  case class ExtendSpecificTmpl(path: String) extends TemplateToExtend
}

import TemplateToExtend._


/** A HTML template source file; it's a HTML document with some Yaml
 * configuration at the top.
 *
 * Template source example:  (the text above '---' is the Yaml config options.
 * (Yaml documents are terminated by '---'.)
 *
 *     extend: /0/parent/template
 *     ---
 *     <html>
 *       ...
 *     </html>
 */
case class TemplateSrcHtml(post: ViPo) {

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

  // All lines that start with # (on the first column) are comments.
  // (( "(?m)" makes ^ match newlines, in addition to the start of the doc. ))
  val commentLineRegex = """(?m)^#.*$""".r

  lazy val (
    /** Which parent template this page should be included in. */
    templateToExtend: TemplateToExtend,
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
    val templToExtend = ("""(?m)^extend: *(\S+)$""".r findFirstMatchIn yamlSrc
                        ).map(_.group(1)) match {
      case Some("no-template") => ExtendNoTemplate
      case Some(path) =>
        // Could ensure any template contains some '/' or it's an error
        // for sure?
        // ExtendSpecificTmpl(path)
        unimplemented("Extending specific template [debiki_error_6y8Cw35]")
      case None => ExtendParentFolderTmpl
    }

    val html: NodeSeq = {
      // (Is this needed if no <html> around <head> and <body>?:
      //   <div>"+ htmlText +"</div>").open_!.child  )
      if (htmlSrc nonEmpty) lw.util.Html5.parse(htmlSrc).open_!
      else Nil
    }

    (templToExtend, html)
  }
}


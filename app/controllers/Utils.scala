/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package controllers

import com.debiki.v0._
import debiki._
import debiki.DebikiHttp._
import com.debiki.v0.{liftweb => lw}
import java.{util => ju}
import play.api._
import play.api.data._
import play.api.data.Forms._
import play.api.mvc.{Action => _, _}
import Actions._
import Prelude._

object Utils extends Results with http.ContentTypes {


  /**
   * Prefixes `<!DOCTYPE html>` to the reply, otherwise Internet Explorer
   * enters the terrible Quirks mode. Also sets the Content-Type header.
   */
  def OkHtml(htmlNode: xml.NodeSeq) =
    Ok(_serializeHtml(htmlNode)) as HTML

  def ForbiddenHtml(htmlNode: xml.NodeSeq) =
    Forbidden(_serializeHtml(htmlNode)) as HTML

  def BadReqHtml(htmlNode: xml.NodeSeq) =
    BadRequest(_serializeHtml(htmlNode)) as HTML

  /**
   * Adds doctype and serializes to html using a real HTML5 writer.
   *
   * Some pros with using a real HTML5 writer: it won't escape '"' when found
   * inside script tags (which is very annoying when you e.g. copy-paste
   * Twitter's Follow Button <script> elem).
   */
  private def _serializeHtml(htmlNode: xml.NodeSeq): String = {
    require(htmlNode.size == 1)
    "<!DOCTYPE html>\n"+ lw.Html5.toString(htmlNode.head)
  }

  /**
   * Prefixes `<?xml version=...>` to the post data.
   */
  def OkXml(xmlNode: xml.NodeSeq, contentType: String = "text/xml") =
    Ok("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"+ xmlNode) as contentType


  def renderOrRedirect(pageReq: PageRequest[_], rootPost: PageRoot)
        : PlainResult = {
    if (isAjax(pageReq.request)) {
      val pageHtml = Debiki.TemplateEngine.renderPage(pageReq, rootPost)
      OkHtml(pageHtml)
    } else {
      val viewRoot =
        if (rootPost.isDefault) ""
        else "?view=" + rootPost.id
      Redirect(pageReq.pagePath.path + viewRoot)
    }
  }


  def formHtml(pageReq: PageRequest[_], pageRoot: PageRoot) =
    FormHtml(
      newUrlConfig(pageReq), pageReq.xsrfToken.token,
      pageRoot, pageReq.permsOnPage)


  object ValidationImplicits {

    implicit def queryStringToValueGetter(
        queryString: Map[String, Seq[String]]) =
      new FormInpReader(queryString)

    implicit def pageReqToFormInpReader(pageReq: PagePostRequest) =
      new FormInpReader(pageReq.request.body)

    implicit def seqToSeqChecker[A](seq: Seq[A]) =
      new SeqChecker[A](seq)

    implicit def textToTextChecker(text: String) =
      new TextChecker(text)

    /**
     * Adds rich methods like `getEmptyAsNone` to a PagePostRequest.
     */
    class FormInpReader(val body: Map[String, Seq[String]]) {

      def getFirst(param: String): Option[String] =
        body.get(param).map(_.head)

      def getOrThrowBadReq(param: String): String =
        body.get(param).map(_.head) getOrElse throwBadReq(
          "DwE03Jk5", "Parameter missing: "+ param)

      def getEmptyAsNone(param: String): Option[String] =
        body.get(param).map(_.head) match {
          case None => None
          case Some("") => None
          case s: Some[_] => s
        }

      def getNoneAsEmpty(param: String): String =
        body.get(param).map(_.head) match {
          case None => ""
          case Some(s) => s
        }

      def listSkipEmpty(param: String): Seq[String] = {
        body.get(param) match {
          case None => Nil
          case Some(values) => values.filterNot(_ isEmpty)
        }
      }
    }

    /**
     * Pimps class Seq with som form input validation helpers.
     */
    class SeqChecker[A](val seq: Seq[A]) {
      def ifEmpty(block: => Unit): Seq[A] = {
        if (seq isEmpty) block
        seq
      }
    }

    /**
     * Pimps class String with som form input validation helpers.
     */
    class TextChecker(val text: String) {
      def ifNotOneOf(chars: String, block: => Unit): String = {
        if (!(chars contains text)) block
        text
      }
    }
  }

}


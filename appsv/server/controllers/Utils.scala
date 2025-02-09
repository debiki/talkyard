/**
 * Copyright (C) 2012 Kaj Magnus Lindberg (born 1979)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

package controllers

import scala.collection.Seq
import com.debiki.core._
import debiki.EdHttp._
import java.{lang => jl}
import play.api._
import play.api.libs.json.{Json, JsValue, JsArray, JsObject}
import play.api.mvc._


object Utils extends Results with http.ContentTypes {


  /** Gatling doesn't understand this prefix */
  private val SafeJsonPrefix = {
    // safePrefix =
    ")]}',\n"  // [5LKW02D4]
    /* This doesn't work in Play 2.8, and currently isn't needed anyay.  [PLAY28]
    Play.maybeApplication match {
      case Some(app) =>
        if (app.configuration.getBoolean("talkyard.addSafeJsonPrefix")
          .orElse(app.configuration.getBoolean("debiki.addSafeJsonPrefix")).contains(false)) ""
        else safePrefix
      case None =>
        safePrefix
    } */
  }


  /**
   * Prefixes the JSON string with characters that prevents the JSON
   * from being parsed as Javascript from a <script> tag.
   * That attack works only if the returned data is an array: "[ ... ]",
   * because it redefines the array constructor so the returned array can get
   * executed as a js statement (if it's top level, not nested in an obj),
   * making it possible for hostile websites to steal people's data via JSONP.
   * But prefixing the returned json with the below prefix, breaks such attacks.
   * See:
   *   - JSON Vulnerability Protection
   *     https://docs.angularjs.org/api/ng/service/$http#json-vulnerability-protection
   *   - http://haacked.com/archive/2008/11/20/anatomy-of-a-subtle-json-vulnerability.aspx
   * Ty's Javascript strips the ")]}'," prefix  [5LKW02D4]
   * before parsing the JSON.

   CLEAN_UP // don't have 3x these at 3 places !

   */

  def OkSafeJsValue(json: JsValue, pretty: Bo = false): Result = {
    val jsonString = if (pretty) Json.prettyPrint(json) else Json.stringify(json)
    // Would excluding the prefix be a maybe breaking API change?
    // Better post about this in the forum first.
    val prefix = SafeJsonPrefix // if (json.isInstanceOf[JsObject]) "" else SafeJsonPrefix
    Ok(prefix + jsonString) as JSON
  }

  /** Doesn't incl the
    * don't-parse-as-a-script tag — that's only meaningful for browsers?
    * And not needed, when returning a JsObject.
    */
  def OkApiJson(json: JsObject, pretty: Bo = false): Result = {
    val jsonString = if (pretty) Json.prettyPrint(json) else Json.stringify(json)
    Ok(jsonString) as JSON
  }


  /**
   * Prefixes `<?xml version=...>` to the post data.
   */
  def OkXml(xmlNode: xml.NodeSeq, contentType: String = "text/xml"): Result =
    Ok("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"+ xmlNode) as contentType



  object ValidationImplicits {

    implicit def queryStringToValueGetter(
        queryString: Map[String, Seq[String]]): FormInpReader =
      new FormInpReader(queryString)

    implicit def seqToSeqChecker[A](seq: Seq[A]): SeqChecker[A] =
      new SeqChecker[A](seq)

    implicit def textToTextChecker(text: String): TextChecker =
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

      def getLong(param: String): Option[Long] =
        getFirst(param) map { value =>
          try { value.toLong }
          catch {
            case _: jl.NumberFormatException =>
              throwBadReq("DwE4XK71", s"Param `$param' is not an Long, it is: `$value'")
          }
        }

      def getInt(param: String): Option[Int] =
        getFirst(param) map { value =>
          try { value.toInt }
          catch {
            case _: jl.NumberFormatException =>
              throwBadReq("DwE4XK71", s"Param `$param' is not an Int, it is: `$value'")
          }
        }

      def getBool(param: String): Option[Boolean] =
        getFirst(param).map(_ == "t")

      def getBoolOrFalse(param: String): Boolean =
        getBool(param) getOrElse false

      def getBoolOrTrue(param: String): Boolean =
        getBool(param) getOrElse true

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


  def parsePathRanges(baseFolder: String, queryString: Map[String, Seq[String]],
        urlParamPrefix: String = "in"): PathRanges = {

    import Utils.ValidationImplicits._

    def makeListOfParamValues(paramName: String): List[String] = {
      val pathsString = queryString.getEmptyAsNone(paramName) getOrElse {
        return Nil
      }
      val pathsListNoPrefix = pathsString.split(",").toList
      pathsListNoPrefix map { path =>
        val isAbsolute = path.startsWith("/")
        if (isAbsolute) path else baseFolder + path
      }
    }

    var folderPathsList = List[String]()
    var treePathsList = List[String]()
    var pageIdsList = List[String]()
    val forWholeTree = queryString.getFirst(urlParamPrefix +"-tree")
    val forCurFolder = queryString.getFirst(urlParamPrefix +"-folder")

    if (forWholeTree isDefined) {
      // Include everything in the tree designated by basePath.
      // Need consider no other parameters (parent paths like "/../" are not
      // supported).
      treePathsList = List(baseFolder)
    } else {
      treePathsList = makeListOfParamValues(urlParamPrefix +"-trees")
      folderPathsList = makeListOfParamValues(urlParamPrefix +"-folders")
      pageIdsList = queryString.getEmptyAsNone("for-pages")
         .map(_.split(",").toList) getOrElse Nil
      if (forCurFolder isDefined) {
        folderPathsList ::= baseFolder
      }
    }

    // List folder contents, by default.
    if (folderPathsList.isEmpty && treePathsList.isEmpty && pageIdsList.isEmpty)
      folderPathsList ::= baseFolder

    PathRanges(folders = folderPathsList, trees = treePathsList,
        pageIds = pageIdsList)
  }


  /** Converts e.g.  blog.some.company.com  to  blog-some-company,  which can then be used
    * to construct an address like   comments-for-blog-some-company.talkyard.net  where
    * blog comments can be hosted.
    *
    * Unfortunately, Google Chrome easily thinks that at least addresses like
    *         comments-for-blog-some-company-com.talkyard.net
    * looks suspiciously similar to
    *                      blog.some.company.com
    * and shows a hacker warning when the blog amin visits the comments site to administrate or
    * setup comments.  Now trying to work around that, by excluding the TLD. So we now generate:
    *         comments-for-blog-some-company.talkyard.net   (without  '-com')
    * Hopefully this works, but who knows.
    *
    * Blog comments are also accessible via  site-<pub-id>.talkyard.net,
    * e.g.  site-123abcd45.talkyard.net — this is used as the hostname for the blog comments
    * iframes. End users don't see at all, unless they look at the html source. And maybe
    * in the address bar of a login popup window.
    * Admins, though, might find such ID based addresses hard to remember,
    * when configuring the site or moderating comments. Not sure what to do about it —
    * the underlying problem is a sloppy risk identification algorithm by Google?
    * (They'll need to use either a pretty long & random site id, or get a security warning?)
    * After all, "comments-for-example-com.talkyard.net" does *not* look like "example.com"?
    */
  def makeLocalHostnameFromEmbeddingAdr(embAdr: St): St = {
    var host = embAdr.replaceFirst("""^(https?:)?\/\/""", "")
          // www.weird.com/some/path?query#hash —> www.weird.com  only
          .replaceFirst("[/?#].*$", "")

    // Let's allow "--" in "e2e-test--".  Looks nice, and,  more importantly,
    // I won't have to update lots of e2e test hostnames.  Also see: [7UKPwF2]
    val hasE2eTestPrefix = host.startsWith("e2e-test--")
    if (hasE2eTestPrefix) host = host.drop("e2e-test--".length)

    val hasSmokeTestPrefix = host.startsWith("smoke-test--") && !hasE2eTestPrefix
    if (hasSmokeTestPrefix) host = host.drop("smoke-test--".length)

    var result = host
          // Drops the TLD, e.g. ".com", ".org" but also ".co.uk" and such "two parts TLDs".
          // And any port number:
          // blog.com.pany.com:8080 —> blog.com.pany,  or www.example.co.uk —> www.example
          // (And any trailing dots.)
          .replaceFirst("""\.([^.]{2,3}\.[^.]{2}|[^.]+)(:[0-9]*)?[.:]*$""", "")
          // Leading and trailing symbols (why would there be? don't know).
          .replaceAll("""^[.:-]+""", "")
          .replaceAll("""[.:-]+$""", "")
          // blog.com-pany —> blog-com-pany
          .replaceAll("[.:-]+", "-")

    if (hasE2eTestPrefix) result = "e2e-test--" + result
    if (hasSmokeTestPrefix) result = "smoke-test--" + result
    result
  }

}


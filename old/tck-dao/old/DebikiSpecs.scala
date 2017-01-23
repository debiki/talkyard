/**
 * Copyright (C) 2011-2013 Kaj Magnus Lindberg (born 1979)
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

package com.debiki.tck.dao.old
/*
import com.debiki.core._
import com.debiki.core.Prelude._
import java.{util => ju, lang => jl}
import org.specs2.matcher.Matcher
import org.specs2.matcher.Expectable


/** Test utilities.
 */
object DebikiSpecs {

  // Formats dates like so: 2001-07-04T12:08:56.235-0700
  val simpleDate = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSZ")
  def d2s(d: ju.Date) = simpleDate.format(d)

  def match_(right: ju.Date) = new Matcher[ju.Date] {
    def apply[S <: ju.Date](expectable: Expectable[S]) = {
      val l = expectable.value
      result(right.getTime == l.getTime, "Same date", simpleDate.format(l) +
          " is not "+ simpleDate.format(right), expectable)
    }
  }

  def matchPagePath(
        pagePath: PagePath = null,
        tenantId: String = null,
        folder: String = null,
        pageId: Option[String] = null,
        //guidInPath: Option[Boolean] = None, ?? hmm
        pageSlug: String = null) = new Matcher[PagePath] {

    def apply[S <: PagePath](expectable: Expectable[S]) = {
      val left = expectable.value
      val test = _test(left, pagePath) _
      var errs =
        test("tenantId", tenantId, _.tenantId) :::
        test("folder", folder, _.folder) :::
        test("pageId", pageId, _.pageId) :::
        test("pageSlug", pageSlug, _.pageSlug) ::: Nil
      result(errs isEmpty, "OK", errs.mkString(", and "), expectable)
    }
  }

  def havePostLike(
        post: RawPostAction[PostActionPayload.CreatePost] = null,
        id: ActionId = PageParts.NoId,
        parent: Option[PostId] = null,
        ctime: ju.Date = null,
        ip: String = null,
        text: String = null,
        where: Option[String] = null) = new Matcher[PageParts] {
    def apply[S <: PageParts](expectable: Expectable[S]) = {
      val left = expectable.value
      assert((id != PageParts.NoId) || (post ne null))  // must know id
      var id2 = id
      if (id == PageParts.NoId) id2 = post.id
      left.getPost(id2) match {
        case Some(leftPost: Post) =>
          result(_matchPostImpl(
              leftPost.rawAction, post, id, parent, ctime, ip, text, where),
            expectable)
        case None =>
          result(false, "", "Post missing, id: "+ id2, expectable)
      }
    }
  }

  def matchPost(  // COULD write unit test for this one!
        post: RawPostAction[PostActionPayload.CreatePost] = null,
        id: ActionId = PageParts.NoId,
        parent: Option[PostId] = null,
        ctime: ju.Date = null,
        ip: String = null,
        text: String = null,
        where: Option[String] = null) =
          new Matcher[RawPostAction[PostActionPayload.CreatePost]] {
    def apply[S <: RawPostAction[PostActionPayload.CreatePost]](
          expectable: Expectable[S]) = {
      val left = expectable.value
      result(_matchPostImpl(
          left, post, id, parent, ctime, ip, text, where),
        expectable)
    }
  }

  private def _matchPostImpl(
        leftPost: RawPostAction[PostActionPayload.CreatePost],
        post: RawPostAction[PostActionPayload.CreatePost],
        id: ActionId,
        parent: Option[ActionId],
        ctime: ju.Date,
        ip: String,
        text: String,
        where: Option[String]): (Boolean, String, String) = {
    val test = _test(leftPost, post) _
    val testId = _testId(leftPost, post) _
    var errs =
      testId("id", id, _.id) :::
        test("parent", parent, _.payload.parentPostId) :::
        test("ctime", ctime, _.creationDati) :::
        test("ip", ip, _.ip) :::
        test("text", text, _.payload.text) :::
        test("where", where, _.payload.where) ::: Nil
    (errs isEmpty, "OK", errs.mkString(", and "))
  }

  def matchUser(
        user: User = null,
        id: String = null,
        displayName: String = null,
        email: String = null,
        country: String = null,
        website: String = null,
        isSuperAdmin: jl.Boolean = null) = new Matcher[User] {
    def apply[S <: User](expectable: Expectable[S]) = {
      val left = expectable.value
      val test = _test(left, user) _
      val errs =
          test("id", id, _.id) :::
          test("displayName", displayName, _.displayName) :::
          test("email", email, _.email) :::
          test("country", country, _.country) :::
          test("website", website, _.website) :::
          test("isSuperAdmin", isSuperAdmin,
              u => Boolean.box(u.isAdmin)) ::: Nil
      result(errs isEmpty, "OK", errs.mkString(", and "), expectable)
    }
  }

  /** Returns List(error: String), or Nil. */
  private def _testId[T <: AnyRef](left: T, right: T)
      (what: String, value: ActionId, getValue: (T) => ActionId): List[String] = {
    var v = value
    if ((value == PageParts.NoId) && (right ne null)) v = getValue(right)
    val lv = getValue(left)
    List(v match {
      case PageParts.NoId => return Nil // skip this field
      case `lv` => return Nil // matched, fine
      case bad =>
        "`"+ what +"' is: `"+ lv +"', should be: `"+ v +"'"
    })
  }


  /** Returns List(error: String), or Nil. */
  private def _test[T <: AnyRef, V <: AnyRef]
        (left: T, right: T)
        (what: String, value: V, getValue: (T) => V): List[String] = {
    var v = value
    if ((value eq null) && (right ne null)) v = getValue(right)
    val lv = getValue(left)
    List(v match {
      case null => return Nil // skip this field
      case `lv` => return Nil // matched, fine
      case bad: ju.Date =>
        "`"+ what +"' is: "+
            d2s(lv.asInstanceOf[ju.Date]) + ", should be: "+ d2s(bad)
      case bad =>
        "`"+ what +"' is: `"+ lv +"', should be: `"+ v +"'"
    })
  }
}

*/
// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list

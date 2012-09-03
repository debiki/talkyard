package com.debiki.v0.tck

/**
 * Copyright (c) 2011 Kaj Magnus Lindberg (born 1979)
 */

import com.debiki.v0._
import com.debiki.v0.Prelude._
import com.debiki.v0.PagePath._  // Guid case classes
import java.{util => ju, lang => jl}
import org.specs._
import org.specs.matcher.Matcher

/** Test utilities.
 */
object DebikiSpecs {

  // Formats dates like so: 2001-07-04T12:08:56.235-0700
  val simpleDate = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSZ")
  def d2s(d: ju.Date) = simpleDate.format(d)

  def match_(right: ju.Date) = new Matcher[ju.Date] {
    def apply(left: => ju.Date) = {
      val l = left  // evaluate this lazy argument
      (right.getTime == l.getTime, "Same date", simpleDate.format(l) +
          " is not "+ simpleDate.format(right))
    }
  }

  def matchPagePath(
        pagePath: PagePath = null,
        tenantId: String = null,
        folder: String = null,
        pageId: Option[String] = null,
        //guidInPath: Option[Boolean] = None,  TODO
        pageSlug: String = null) = new Matcher[PagePath] {
    def apply(left: => PagePath) = {
      val test = _test(left, pagePath) _
      var errs =
        test("tenantId", tenantId, _.tenantId) :::
        test("folder", folder, _.folder) :::
        test("pageId", pageId, _.pageId) :::
        test("pageSlug", pageSlug, _.pageSlug) ::: Nil
      (errs isEmpty, "OK", errs.mkString(", and "))
    }
  }

  def havePostLike(
        post: Post = null,
        id: String = null,
        parent: String = null,
        ctime: ju.Date = null,
        loginId: String = null,
        newIp: String = null,
        text: String = null,
        where: Option[String] = null) = new Matcher[Debate] {
    def apply(left: => Debate) = {
      assert((id ne null) || (post ne null))  // must know id
      var id2 = id
      if (id eq null) id2 = post.id
      left.post(id2) match {
        case Some(p: Post) =>
          matchPost(post, id = id, parent = parent, ctime = ctime,
              loginId = loginId, newIp = newIp, text = text, where = where).apply(p)
        case None =>
          (false, "", "Post missing, id: "+ id2)
      }
    }
  }

  def matchPost(  // COULD write unit test for this one!
        post: Post = null,
        id: String = null,
        parent: String = null,
        ctime: ju.Date = null,
        loginId: String = null,
        newIp: String = null,
        text: String = null,
        where: Option[String] = null) = new Matcher[Post] {
    def apply(left: => Post) = {
      val test = _test(left, post) _
      var errs =
          test("id", id, _.id) :::
          test("parent", parent, _.parent) :::
          test("ctime", ctime, _.ctime) :::
          test("loginId", loginId, _.loginId) :::
          test("newIp", newIp, _.newIp) :::
          test("text", text, _.text) :::
          test("where", where, _.where) ::: Nil
      (errs isEmpty, "OK", errs.mkString(", and "))
    }
  }

  def haveRatingLike(
        rating: Rating = null,
        id: String = null,
        postId: String = null,
        ctime: ju.Date = null,
        loginId: String = null,
        newIp: String = null,
        tags: List[String] = null) = new Matcher[Debate] {
    def apply(left: => Debate) = {
      assert((id ne null) || (rating ne null))  // must know id
      var id2 = id
      if (id2 eq null) id2 = rating.id
      left.rating(id2) match {
        case Some(r: Rating) =>
          matchRating(rating, id = id, postId = postId, ctime = ctime,
              loginId = loginId, newIp = newIp, tags = tags).apply(r)
        case None =>
          (false, "", "Rating missing, id: "+ id2)
      }
    }
  }

  def matchRating(
        rating: Rating = null,
        id: String = null,
        postId: String = null,
        ctime: ju.Date = null,
        loginId: String = null,
        newIp: String = null,
        tags: List[String] = null) = new Matcher[Rating] {
    def apply(left: => Rating) = {
      val test = _test(left, rating) _
      val errs =
          test("id", id, _.id) :::
          test("postId", postId, _.postId) :::
          test("ctime", ctime, _.ctime) :::
          test("loginId", loginId, _.loginId) :::
          test("newIp", newIp, _.newIp) :::
          test("tags", if (tags ne null) tags.sorted else null,
                _.tags.sorted) ::: Nil
      (errs isEmpty, "OK", errs.mkString(", and "))
    }
  }

  def matchUser(
        user: User = null,
        id: String = null,
        displayName: String = null,
        email: String = null,
        country: String = null,
        website: String = null,
        isSuperAdmin: jl.Boolean = null) = new Matcher[User] {
    def apply(left: => User) = {
      val test = _test(left, user) _
      val errs =
          test("id", id, _.id) :::
          test("displayName", displayName, _.displayName) :::
          test("email", email, _.email) :::
          test("country", country, _.country) :::
          test("website", website, _.website) :::
          test("isSuperAdmin", isSuperAdmin,
              u => Boolean.box(u.isAdmin)) ::: Nil
      (errs isEmpty, "OK", errs.mkString(", and "))
    }
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

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

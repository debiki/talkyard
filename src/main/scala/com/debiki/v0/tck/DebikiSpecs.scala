package com.debiki.v0.tck

/**
 * Copyright (c) 2011 Kaj Magnus Lindberg (born 1979)
 */

import com.debiki.v0._
import com.debiki.v0.Prelude._
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
        post: PostActionDto[PostActionPayload.CreatePost] = null,
        id: String = null,
        parent: String = null,
        ctime: ju.Date = null,
        loginId: String = null,
        newIp: String = null,
        text: String = null,
        where: Option[String] = null) = new Matcher[PageParts] {
    def apply[S <: PageParts](expectable: Expectable[S]) = {
      val left = expectable.value
      assert((id ne null) || (post ne null))  // must know id
      var id2 = id
      if (id eq null) id2 = post.id
      left.getPost(id2) match {
        case Some(leftPost: Post) =>
          result(_matchPostImpl(
              leftPost.actionDto, post, id, parent, ctime, loginId, newIp, text, where),
            expectable)
        case None =>
          result(false, "", "Post missing, id: "+ id2, expectable)
      }
    }
  }

  def matchPost(  // COULD write unit test for this one!
        post: PostActionDto[PostActionPayload.CreatePost] = null,
        id: String = null,
        parent: String = null,
        ctime: ju.Date = null,
        loginId: String = null,
        newIp: String = null,
        text: String = null,
        where: Option[String] = null) =
          new Matcher[PostActionDto[PostActionPayload.CreatePost]] {
    def apply[S <: PostActionDto[PostActionPayload.CreatePost]](
          expectable: Expectable[S]) = {
      val left = expectable.value
      result(_matchPostImpl(
          left, post, id, parent, ctime, loginId, newIp, text, where),
        expectable)
    }
  }

  private def _matchPostImpl(
        leftPost: PostActionDto[PostActionPayload.CreatePost],
        post: PostActionDto[PostActionPayload.CreatePost],
        id: String,
        parent: String,
        ctime: ju.Date,
        loginId: String,
        newIp: String,
        text: String,
        where: Option[String]): (Boolean, String, String) = {
    val test = _test(leftPost, post) _
    var errs =
      test("id", id, _.id) :::
        test("parent", parent, _.payload.parentPostId) :::
        test("ctime", ctime, _.creationDati) :::
        test("loginId", loginId, _.loginId) :::
        test("newIp", newIp, _.newIp) :::
        test("text", text, _.payload.text) :::
        test("where", where, _.payload.where) ::: Nil
    (errs isEmpty, "OK", errs.mkString(", and "))
  }

  def haveRatingLike(
        rating: Rating = null,
        id: String = null,
        postId: String = null,
        ctime: ju.Date = null,
        loginId: String = null,
        userId: String = null,
        newIp: String = null,
        tags: List[String] = null) = new Matcher[PageParts] {
    def apply[S <: PageParts](expectable: Expectable[S]) = {
      val left = expectable.value: PageParts
      assert((id ne null) || (rating ne null))  // must know id
      var id2 = id
      if (id2 eq null) id2 = rating.id
      left.rating(id2) match {
        case Some(r: Rating) =>
          result(
            _matchRatingImpl(r, rating, id = id, postId = postId, ctime = ctime,
              loginId = loginId, userId = userId, newIp = newIp, tags = tags),
            expectable)
        case None =>
          result(false, "", "Rating missing, id: "+ id2, expectable)
      }
    }
  }

  def matchRating(
        rating: Rating = null,
        id: String = null,
        postId: String = null,
        ctime: ju.Date = null,
        loginId: String = null,
        userId: String = null,
        newIp: String = null,
        tags: List[String] = null) = new Matcher[Rating] {
    def apply[S <: Rating](expectable: Expectable[S]) = {
      val leftRating = expectable.value
      result(
        _matchRatingImpl(leftRating, rating, id, postId, ctime, loginId,
            userId, newIp, tags),
        expectable)
    }
  }

  private def _matchRatingImpl(
      leftRating: Rating,
      rating: Rating,
      id: String,
      postId: String,
      ctime: ju.Date,
      loginId: String,
      userId: String,
      newIp: String,
      tags: List[String]): (Boolean, String, String) = {
    val test = _test(leftRating, rating) _
    val errs =
      test("id", id, _.id) :::
        test("postId", postId, _.postId) :::
        test("ctime", ctime, _.ctime) :::
        test("loginId", loginId, _.loginId) :::
        test("userId", userId, _.userId) :::
        test("newIp", newIp, _.newIp) :::
        test("tags", if (tags ne null) tags.sorted else null,
          _.tags.sorted) ::: Nil
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

package com.debiki.v0.tck

/**
 * Copyright (c) 2011 Kaj Magnus Lindberg (born 1979)
 */

import com.debiki.v0._
import com.debiki.v0.Prelude._
import java.{util => ju}
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

  def havePostLike(
        post: Post = null,
        id: String = null,
        parent: String = null,
        date: ju.Date = null,
        by: String = null,
        ip: String = null,
        text: String = null,
        where: Option[String] = null) = new Matcher[Debate] {
    def apply(left: => Debate) = {
      assert((id ne null) || (post ne null))  // must know id
      var id2 = id
      if (id eq null) id2 = post.id
      left.post(id2) match {
        case Some(p: Post) =>
          matchPost(post, id = id, parent = parent, date = date,
              by = by, ip = ip, text = text, where = where).apply(p)
        case None =>
          (false, "", "Post missing, id: "+ id2)
      }
    }
  }

  def matchPost(  // COULD write unit test for this one!
        post: Post = null,
        id: String = null,
        parent: String = null,
        date: ju.Date = null,
        by: String = null,
        ip: String = null,
        text: String = null,
        where: Option[String] = null) = new Matcher[Post] {
    def apply(left: => Post) = {
      var errs = List[String]()
      def test[T <: AnyRef](what: String, value: T, field: (Post) => T) {
        var v = value
        if ((value eq null) && (post ne null)) v = field(post)
        val lv = field(left)
        v match {
          case null => // skip this field
          case `lv` => // matched, fine
          case bad: ju.Date =>
            errs ::= "`"+ what +"' is: "+
                d2s(lv.asInstanceOf[ju.Date]) + ", should be: "+ d2s(bad)
          case bad =>
            errs ::= "`"+ what +"' is: `"+ lv +"', should be: `"+ v +"'"
        }
      }
      test("id", id, _.id)
      test("parent", parent, _.parent)
      test("date", date, _.date)
      test("by", by, _.by)
      test("ip", ip, _.ip)
      test("text", text, _.text)
      test("where", where, _.where)
      (errs isEmpty, "OK", errs.mkString(", and "))
    }
  }

}

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

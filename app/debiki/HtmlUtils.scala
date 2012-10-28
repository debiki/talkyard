/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0.Prelude._
import java.{util => ju}
import xml.NodeSeq


object HtmlUtils {

  def ifThen(condition: Boolean, html: NodeSeq): NodeSeq =
    if (condition) html else Nil

  def link(address: String): xml.Node = <a href={address}>{address}</a>

  def dateAbbr(date: ju.Date, cssClass: String): NodeSeq = {
    val dateStr = toIso8601(date)
    <abbr class={"dw-date "+ cssClass} title={toIso8601T(dateStr)}>, {
      dateStr}</abbr>
  }

}

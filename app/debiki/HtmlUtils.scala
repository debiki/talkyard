/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

object HtmlUtils {

  def link(address: String): xml.Node = <a href={address}>{address}</a>

}
